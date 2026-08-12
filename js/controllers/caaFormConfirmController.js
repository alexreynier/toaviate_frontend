// ═══════════════════════════════════════════════════════════════════
//  CaaFormConfirmController — public CAA-form signing page.
//  /caa_form_confirm/:token — an external instructor/examiner (no account)
//  reviews the locked form and signs or declines from an emailed,
//  single-use link (30-day expiry).
//  MUST work with no session: no $rootScope.globals access here, and the
//  caa_form_confirm endpoints are exempted from the auth interceptor.
//  Backend contract: FRONTEND_CAA_FORMS_GUIDE.md §5
// ═══════════════════════════════════════════════════════════════════

app.controller('CaaFormConfirmController', CaaFormConfirmController);

CaaFormConfirmController.$inject = ['CaaFormsService', 'ToastService', '$stateParams'];
function CaaFormConfirmController(CaaFormsService, ToastService, $stateParams) {
    var vm = this;

    var token = $stateParams.token;

    vm.state = 'loading';    // loading | open | handled | done | declined | invalid
    vm.handledStatus = null; // signed | declined | expired | completed | …

    vm.payload = null;
    vm.displayGroups = [];
    vm.grid = null;
    vm.matrix = null;
    vm.sections = {};

    vm.form = { name: '', number: '', signature_image: '', declaration_accepted: false, eligibility_override_note: '' };
    vm.busy = false;

    vm.declineOpen = false;
    vm.declineReason = '';

    vm.roleLabel = function(r){ return CaaFormsService.roleLabels[r] || r; };
    vm.pretty = function(str){ return str ? String(str).replace(/_/g, ' ') : ''; };
    vm.sectionOf = function(id){ return vm.sections[id] || ''; };
    vm.cellMark = function(id) {
        var v = vm.sectionOf(id);
        if (v === 'pass') { return 'P'; }
        if (v === 'fail') { return 'F'; }
        if (v === 'na') { return '—'; }
        return '';
    };

    vm.sign = sign;
    vm.decline = decline;
    vm.toggleDecline = function() { vm.declineOpen = !vm.declineOpen; };

    load();

    function load() {
        CaaFormsService.PublicGet(token).then(function(data) {
            if (!data || data.success === false) {
                vm.state = 'invalid';
                return;
            }
            if (data.status === 'open') {
                vm.state = 'open';
                vm.payload = data;
                vm.form.name = (data.signer && data.signer.name) || '';
                vm.form.number = (data.signer && data.signer.number) || '';
                // Read-only render of the locked form contents.
                var ft = data.form_type;
                vm.displayGroups = CaaFormsService.displayGroups(ft, data.form_data);
                vm.grid = (ft && CaaFormsService.grids[ft]) || null;
                vm.matrix = CaaFormsService.isMatrixType(ft) ? CaaFormsService.matrix : null;
                vm.sections = (data.form_data && data.form_data.sections) || {};
                return;
            }
            if (data.status) {
                vm.state = 'handled';
                vm.handledStatus = data.status;
                return;
            }
            vm.state = 'invalid';
        });
    }

    function sign() {
        if (!vm.form.signature_image) {
            ToastService.warning('Signature Required', 'Please draw your signature in the pad.');
            return;
        }
        if (!vm.form.declaration_accepted && vm.payload.declaration) {
            ToastService.warning('Declaration Required', 'Tick the declaration to confirm it applies.');
            return;
        }
        if (vm.payload.needs_eligibility_override && !(vm.form.eligibility_override_note || '').trim()) {
            ToastService.highlightField('caa-pub-override');
            ToastService.warning('Note Required', 'The eligibility checklist did not pass — explain why you are signing anyway.');
            return;
        }

        var payload = { signature_image: vm.form.signature_image };
        if ((vm.form.name || '').trim()) { payload.name = vm.form.name.trim(); }
        if ((vm.form.number || '').trim()) { payload.number = vm.form.number.trim(); }
        if (vm.payload.declaration) { payload.declaration_accepted = true; }
        if (vm.payload.needs_eligibility_override) {
            payload.eligibility_override_note = vm.form.eligibility_override_note.trim();
        }

        vm.busy = true;
        CaaFormsService.PublicSign(token, payload).then(function(data) {
            vm.busy = false;
            if (data && data.success !== false) {
                vm.state = 'done';
            } else {
                ToastService.error('Could Not Sign', (data && data.message) || 'Please try again.');
            }
        });
    }

    function decline() {
        vm.busy = true;
        CaaFormsService.PublicDecline(token, (vm.declineReason || '').trim()).then(function(data) {
            vm.busy = false;
            if (data && data.success !== false) {
                vm.state = 'declined';
            } else {
                ToastService.error('Could Not Decline', (data && data.message) || 'Please try again.');
            }
        });
    }
}
