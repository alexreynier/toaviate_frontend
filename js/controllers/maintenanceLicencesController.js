// MaintenanceLicencesController — engineering licences across all org members.
// Numbers + documents are encrypted server-side; we only request the decrypted
// list when the user explicitly clicks "Reveal".
app.controller('MaintenanceLicencesController', MaintenanceLicencesController);

MaintenanceLicencesController.$inject = ['$rootScope', '$scope', '$window', 'ToastService',
    'EngineeringLicenceService', 'MaintenanceOrgMemberService'];
function MaintenanceLicencesController($rootScope, $scope, $window, ToastService,
    EngineeringLicenceService, MaintenanceOrgMemberService) {

    var vm = this;

    function parentCtx() {
        var p = $scope.$parent;
        while (p && !p.vm) p = p.$parent;
        return p && p.vm ? p.vm : {};
    }

    var ctx = parentCtx();
    vm.org_id    = ctx.org_id;
    vm.is_admin  = !!ctx.is_admin;
    vm.is_senior = !!ctx.is_senior;
    vm.can_edit  = vm.is_admin || vm.is_senior;

    vm.loading   = true;
    vm.members   = [];        // [{id, user_id, first_name, last_name, licences:[...]}]
    vm.search    = '';
    vm.show_form = false;
    vm.editing   = null;
    vm.form      = newForm();

    vm.openAdd     = openAdd;
    vm.openEdit    = openEdit;
    vm.closeForm   = closeForm;
    vm.saveLicence = saveLicence;
    vm.removeLicence = removeLicence;
    vm.reveal      = reveal;
    vm.downloadDoc = downloadDoc;
    vm.expiryClass = expiryClass;
    vm.expiryLabel = expiryLabel;

    // ── File upload (ng-flow) ──
    $scope.processLicenceFile = function(files) {
        if (!files || !files.length) return;
        try {
            var j = JSON.parse(files[files.length - 1].file_return);
            vm.form.document = {
                temp_path: j.saved_url,
                name: (j.files && j.files.file && j.files.file.name) || 'document'
            };
            $scope.$applyAsync();
        } catch(e) {
            ToastService.error('Upload error', 'Could not parse upload response.');
        }
    };

    load();

    function load() {
        if (!vm.org_id) { vm.loading = false; return; }
        vm.loading = true;
        MaintenanceOrgMemberService.ListByOrg(vm.org_id).then(function(res) {
            var members = (res && (res.members || res.data || res)) || [];
            if (!angular.isArray(members)) members = [];
            vm.members = members.map(function(m) { m.licences = []; m.expanded = false; return m; });

            // Fan-out: load licences per member.
            var done = 0;
            if (!vm.members.length) { vm.loading = false; return; }
            vm.members.forEach(function(m) {
                EngineeringLicenceService.ListByMember(m.id).then(function(r) {
                    var list = (r && (r.licences || r.data || r)) || [];
                    if (!angular.isArray(list)) list = [];
                    m.licences = list;
                    if (++done === vm.members.length) vm.loading = false;
                });
            });
        });
    }

    function newForm() {
        return {
            org_member_id: null,
            user_id: null,
            licence_type: '',
            licence_number: '',
            issued_date: '',
            expiry_date: '',
            document: null
        };
    }

    function openAdd(member) {
        if (!vm.can_edit) return;
        vm.editing = null;
        vm.form = newForm();
        vm.form.org_member_id = member.id;
        vm.form.user_id = member.user_id;
        vm.form._member_label = (member.first_name || '') + ' ' + (member.last_name || '');
        vm.show_form = true;
    }

    function openEdit(member, licence) {
        if (!vm.can_edit) return;
        // Need decrypted number for editing — fetch on demand.
        EngineeringLicenceService.ListDecrypted(member.id).then(function(r) {
            var list = (r && (r.licences || r.data || r)) || [];
            var dec = find(list, function(l) { return l.id === licence.id; }) || licence;
            vm.editing = licence;
            vm.form = {
                org_member_id:  member.id,
                user_id:        member.user_id,
                licence_type:   dec.licence_type   || '',
                licence_number: dec.licence_number || '',
                issued_date:    (dec.issued_date || '').substring(0, 10),
                expiry_date:    (dec.expiry_date || '').substring(0, 10),
                document:       null,
                _member_label:  (member.first_name || '') + ' ' + (member.last_name || ''),
                _has_document:  !!dec.has_document
            };
            vm.show_form = true;
        });
    }

    function closeForm() {
        vm.show_form = false;
        vm.editing = null;
        vm.form = newForm();
    }

    function saveLicence() {
        if (!vm.can_edit) return;
        var checks = [
            { ok: !!vm.form.licence_type,   field: 'mxl_type',  label: 'Licence type' },
            { ok: !!vm.form.licence_number, field: 'mxl_num',   label: 'Licence number' },
            { ok: !!vm.form.expiry_date,    field: 'mxl_exp',   label: 'Expiry date' }
        ];
        if (!ToastService.validateForm(checks)) return;

        var payload = {
            maintenance_org_id: vm.org_id,
            org_member_id:      vm.form.org_member_id,
            user_id:            vm.form.user_id,
            licence_type:       vm.form.licence_type,
            licence_number:     vm.form.licence_number,
            issued_date:        vm.form.issued_date || null,
            expiry_date:        vm.form.expiry_date
        };
        if (vm.form.document && vm.form.document.temp_path) {
            payload.document = { temp_path: vm.form.document.temp_path };
        }

        var op = vm.editing
            ? EngineeringLicenceService.Update(vm.editing.id, payload)
            : EngineeringLicenceService.Create(payload);

        op.then(function(res) {
            if (res && res.success !== false) {
                ToastService.success(vm.editing ? 'Licence updated' : 'Licence added',
                    'Expires ' + payload.expiry_date, { confetti: !vm.editing });
                closeForm(); load();
            } else {
                ToastService.error('Could not save', res && res.message);
            }
        });
    }

    function removeLicence(licence) {
        if (!vm.can_edit) return;
        if (!confirm('Delete this engineering licence? This cannot be undone.')) return;
        EngineeringLicenceService.Remove(licence.id).then(function(res) {
            if (res && res.success !== false) {
                ToastService.success('Licence deleted', null, { confetti: false });
                load();
            } else {
                ToastService.error('Could not delete', res && res.message);
            }
        });
    }

    function reveal(member, licence) {
        EngineeringLicenceService.ListDecrypted(member.id).then(function(r) {
            var list = (r && (r.licences || r.data || r)) || [];
            var dec = find(list, function(l) { return l.id === licence.id; });
            if (dec && dec.licence_number) {
                licence._revealed = dec.licence_number;
            } else {
                ToastService.error('Reveal failed', (r && r.message) || 'Could not decrypt.');
            }
        });
    }

    function downloadDoc(licence) {
        EngineeringLicenceService.GetFile(licence.id).then(function(r) {
            if (r && r.success && r.data) {
                var mime = mimeFor(r.type);
                var dataUri = 'data:' + mime + ';base64,' + r.data;
                // Open in a new tab; the browser handles PDFs/images natively.
                var w = $window.open();
                if (w) {
                    if (r.type === 'pdf') {
                        w.location.href = dataUri;
                    } else {
                        w.document.write('<img style="max-width:100%;height:auto" src="' + dataUri + '"/>');
                    }
                }
            } else {
                ToastService.error('Could not load document', r && r.message);
            }
        });
    }

    function expiryClass(licence) {
        if (!licence.expiry_date) return 'mxo-badge--slate';
        var days = daysUntil(licence.expiry_date);
        if (days < 0)  return 'mxo-badge--danger';
        if (days < 30) return 'mxo-badge--warn';
        return 'mxo-badge--ok';
    }
    function expiryLabel(licence) {
        if (!licence.expiry_date) return 'No expiry';
        var days = daysUntil(licence.expiry_date);
        if (days < 0)  return 'Expired ' + (-days) + 'd ago';
        if (days < 30) return 'Expires in ' + days + 'd';
        return licence.expiry_date.substring(0,10);
    }
    function daysUntil(iso) {
        var t = new Date(iso).getTime();
        return Math.floor((t - Date.now()) / 86400000);
    }
    function mimeFor(t) {
        t = (t || '').toLowerCase();
        if (t === 'pdf') return 'application/pdf';
        if (t === 'png') return 'image/png';
        if (t === 'jpg' || t === 'jpeg') return 'image/jpeg';
        if (t === 'gif') return 'image/gif';
        return 'application/octet-stream';
    }
    function find(arr, pred) {
        for (var i = 0; i < arr.length; i++) if (pred(arr[i])) return arr[i];
        return null;
    }
}
