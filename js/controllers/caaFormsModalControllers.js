// ═══════════════════════════════════════════════════════════════════
//  CAA forms — modal controllers (FRONTEND_CAA_FORMS_GUIDE.md).
//  Sign / send-to-external / audit trail / attached-file preview.
//  Signature capture reuses the logbook-endorsements saved-stamp record
//  (logbook_endorsements/my_signature) and the shared <sig-pad> directive.
// ═══════════════════════════════════════════════════════════════════

// ── Sign a signature box ─────────────────────────────────────────────
app.controller('CaaSignModalCtrl', CaaSignModalCtrl);

CaaSignModalCtrl.$inject = ['$uibModalInstance', 'CaaFormsService', 'LogbookEndorsementsService', 'ToastService',
                            '$rootScope', 'context'];
function CaaSignModalCtrl($uibModalInstance, CaaFormsService, LogbookEndorsementsService, ToastService,
                          $rootScope, context) {
    var vm = this;

    var user = $rootScope.globals.currentUser;
    vm.form = context.form;
    vm.box = context.box;
    vm.role = context.box.role;
    vm.roleLabel = CaaFormsService.roleLabels[vm.role] || vm.role;
    vm.declaration = context.declaration;
    // Applicants just sign; certifying roles must accept the declaration.
    vm.needsDeclaration = vm.role !== 'applicant';
    vm.needsOverride = !!context.needsOverride;
    vm.busy = false;

    var savedNumber = '';
    try { savedNumber = localStorage.getItem('toaviate_instructor_number') || ''; } catch (e) {}

    vm.model = {
        name: ((user.first_name || '') + ' ' + (user.last_name || '')).trim(),
        number: vm.needsDeclaration ? savedNumber : '',
        signature_image: '',
        declaration_accepted: false,
        eligibility_override_note: ''
    };

    // Saved stamp — same record the logbook endorsements use.
    vm.savedStamp = null;
    vm.useSaved = false;
    if (vm.needsDeclaration) {
        LogbookEndorsementsService.GetMySignature().then(function(data) {
            if (data && data.exists && data.signature) {
                vm.savedStamp = data.signature;
                vm.useSaved = true;
                if (!vm.model.number && data.signature.instructor_number) {
                    vm.model.number = data.signature.instructor_number;
                }
            }
        });
    }

    vm.submit = submit;
    vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        var usingSaved = !!(vm.useSaved && vm.savedStamp);
        if (!usingSaved && !vm.model.signature_image) {
            ToastService.warning('Signature Required', 'Please draw your signature in the pad.');
            return;
        }
        if (vm.needsDeclaration && !(vm.model.name || '').trim() && !usingSaved) {
            ToastService.highlightField('caa-sign-name');
            ToastService.warning('Name Required', 'Enter your full name as it should appear on the form.');
            return;
        }
        if (vm.needsDeclaration && !vm.model.declaration_accepted) {
            ToastService.warning('Declaration Required', 'Tick the declaration to confirm it applies.');
            return;
        }
        if (vm.needsOverride && !(vm.model.eligibility_override_note || '').trim()) {
            ToastService.highlightField('caa-sign-override');
            ToastService.warning('Note Required', 'The eligibility checklist did not pass — explain why you are signing anyway.');
            return;
        }

        if (vm.needsDeclaration) {
            try { localStorage.setItem('toaviate_instructor_number', vm.model.number || ''); } catch (e) {}
        }

        var payload = { role: vm.role };
        if (usingSaved) { payload.use_saved_signature = true; }
        else { payload.signature_image = vm.model.signature_image; }
        if ((vm.model.name || '').trim()) { payload.name = vm.model.name.trim(); }
        if ((vm.model.number || '').trim()) { payload.number = vm.model.number.trim(); }
        if (vm.needsDeclaration) { payload.declaration_accepted = true; }
        if (vm.needsOverride) { payload.eligibility_override_note = vm.model.eligibility_override_note.trim(); }

        vm.busy = true;
        CaaFormsService.Sign(vm.form.id, payload).then(function(data) {
            vm.busy = false;
            if (data && data.success !== false) {
                $uibModalInstance.close(true);
            } else {
                ToastService.error('Could Not Sign', (data && data.message) || 'Please try again.');
            }
        });
    }
}

// ── Send a box to an external signer ────────────────────────────────
app.controller('CaaExternalModalCtrl', CaaExternalModalCtrl);

CaaExternalModalCtrl.$inject = ['$uibModalInstance', 'CaaFormsService', 'ToastService', 'context'];
function CaaExternalModalCtrl($uibModalInstance, CaaFormsService, ToastService, context) {
    var vm = this;

    vm.form = context.form;
    vm.box = context.box;
    vm.roleLabel = CaaFormsService.roleLabels[context.box.role] || context.box.role;
    vm.busy = false;
    vm.model = { email: '', name: '', number: '' };

    vm.submit = submit;
    vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        var email = (vm.model.email || '').trim();
        if (!email || email.indexOf('@') === -1) {
            ToastService.highlightField('caa-ext-email');
            ToastService.warning('Email Required', "Enter the signer's email — the signing link goes there.");
            return;
        }
        vm.busy = true;
        CaaFormsService.SendExternal(vm.form.id, {
            role: vm.box.role,
            email: email,
            name: (vm.model.name || '').trim() || undefined,
            number: (vm.model.number || '').trim() || undefined
        }).then(function(data) {
            vm.busy = false;
            if (data && data.success !== false) {
                $uibModalInstance.close(true);
            } else {
                ToastService.error('Could Not Send', (data && data.message) || 'Please try again.');
            }
        });
    }
}

// ── Audit trail ──────────────────────────────────────────────────────
app.controller('CaaAuditModalCtrl', CaaAuditModalCtrl);

CaaAuditModalCtrl.$inject = ['$uibModalInstance', 'CaaFormsService', 'context'];
function CaaAuditModalCtrl($uibModalInstance, CaaFormsService, context) {
    var vm = this;

    vm.form = context.form;
    vm.loading = true;
    vm.entries = [];

    vm.icons = {
        created: 'fa-plus-circle', updated: 'fa-pen', submitted: 'fa-paper-plane',
        signed: 'fa-stamp', declined: 'fa-times-circle', reverted: 'fa-undo',
        completed: 'fa-check-circle', cancelled: 'fa-ban',
        eligibility_overridden: 'fa-exclamation-triangle',
        external_sent: 'fa-envelope', external_resent: 'fa-envelope',
        file_uploaded: 'fa-paperclip', file_removed: 'fa-trash-alt',
        pdf_generated: 'fa-file-pdf', deputy_added: 'fa-user-plus',
        deputy_removed: 'fa-user-minus', email_failed: 'fa-exclamation-circle'
    };
    vm.pretty = function(str){ return str ? String(str).replace(/_/g, ' ') : ''; };
    vm.close = function() { $uibModalInstance.dismiss('cancel'); };

    // details can arrive as a decoded object — flatten it for display.
    vm.detailText = function(d) {
        if (!d) { return ''; }
        if (angular.isString(d)) { return d; }
        try {
            return Object.keys(d).map(function(k) {
                var v = d[k];
                return vm.pretty(k) + ': ' + (angular.isObject(v) ? JSON.stringify(v) : v);
            }).join(' · ');
        } catch (e) { return ''; }
    };

    CaaFormsService.GetAudit(vm.form.id).then(function(data) {
        vm.loading = false;
        if (data && data.success === false) { return; }
        vm.entries = (data && (data.events || data.audit || data.entries)) || (angular.isArray(data) ? data : []);
    });
}

// ── Attached-file preview (certified true copy) ─────────────────────
app.controller('CaaFilePreviewModalCtrl', CaaFilePreviewModalCtrl);

CaaFilePreviewModalCtrl.$inject = ['$uibModalInstance', '$sce', 'context'];
function CaaFilePreviewModalCtrl($uibModalInstance, $sce, context) {
    var vm = this;

    vm.file = context.file;
    vm.isPdf = (context.data_uri || '').indexOf('application/pdf') > -1;
    vm.data_uri = vm.isPdf ? $sce.trustAsResourceUrl(context.data_uri) : context.data_uri;
    vm.close = function() { $uibModalInstance.dismiss('cancel'); };
}
