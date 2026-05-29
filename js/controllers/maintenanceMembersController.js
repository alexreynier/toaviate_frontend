// MaintenanceMembersController — list/add/edit/remove org members.
app.controller('MaintenanceMembersController', MaintenanceMembersController);

MaintenanceMembersController.$inject = ['$rootScope', '$scope', '$state', 'ToastService', 'MaintenanceOrgMemberService'];
function MaintenanceMembersController($rootScope, $scope, $state, ToastService, MaintenanceOrgMemberService) {
    var vm = this;

    // Read parent org context.
    function parentCtx() {
        var p = $scope.$parent;
        while (p && !p.vm) p = p.$parent;
        return p && p.vm ? p.vm : {};
    }

    var ctx = parentCtx();
    vm.org_id   = ctx.org_id;
    vm.is_admin = !!ctx.is_admin;

    vm.loading  = true;
    vm.members  = [];
    vm.search   = '';

    vm.show_form = false;
    vm.editing   = null;
    vm.form      = newForm();

    vm.openAdd    = openAdd;
    vm.openEdit   = openEdit;
    vm.closeForm  = closeForm;
    vm.saveMember = saveMember;
    vm.toggleRole = toggleRole;
    vm.removeMember = removeMember;
    vm.roleLabel = roleLabel;
    vm.roleBadge = roleBadge;

    load();

    function load() {
        if (!vm.org_id) { vm.loading = false; return; }
        vm.loading = true;
        MaintenanceOrgMemberService.ListByOrg(vm.org_id).then(function(res) {
            vm.loading = false;
            if (res && res.success !== false) {
                vm.members = (res.members || res.data || res || []).slice();
                if (!angular.isArray(vm.members)) vm.members = [];
            } else {
                ToastService.error('Failed to load', res && res.message);
            }
        });
    }

    function newForm() {
        return {
            first_name: '', last_name: '', email: '', phone: '',
            is_senior: 0, is_manager: 0
        };
    }

    function openAdd() {
        if (!vm.is_admin) return;
        vm.editing = null;
        vm.form    = newForm();
        vm.show_form = true;
    }

    function openEdit(m) {
        if (!vm.is_admin) return;
        vm.editing = m;
        vm.form = {
            first_name: m.first_name || '',
            last_name:  m.last_name  || '',
            email:      m.email      || '',
            phone:      m.phone_number || m.phone || '',
            is_senior:  m.is_senior ? 1 : 0,
            is_manager: m.is_manager ? 1 : 0
        };
        vm.show_form = true;
    }

    function closeForm() {
        vm.show_form = false;
        vm.editing = null;
        vm.form = newForm();
    }

    function saveMember() {
        if (!vm.is_admin) return;

        if (vm.editing) {
            // Existing member — only roles are editable here.
            var payload = { is_senior: vm.form.is_senior ? 1 : 0, is_manager: vm.form.is_manager ? 1 : 0 };
            MaintenanceOrgMemberService.Update(vm.editing.id, payload).then(function(res) {
                if (res && res.success !== false) {
                    ToastService.success('Member updated', null, { confetti: false });
                    closeForm(); load();
                } else {
                    ToastService.error('Update failed', res && res.message);
                }
            });
            return;
        }

        var checks = [
            { ok: !!vm.form.first_name, field: 'mxm_first', label: 'First name' },
            { ok: !!vm.form.last_name,  field: 'mxm_last',  label: 'Last name' },
            { ok: !!vm.form.email,      field: 'mxm_email', label: 'Email' }
        ];
        if (!ToastService.validateForm(checks)) return;

        var addPayload = {
            maintenance_org_id: vm.org_id,
            user: {
                first_name: vm.form.first_name,
                last_name:  vm.form.last_name,
                email:      vm.form.email,
                phone:      vm.form.phone
            },
            is_senior:  vm.form.is_senior ? 1 : 0,
            is_manager: vm.form.is_manager ? 1 : 0
        };
        MaintenanceOrgMemberService.Add(addPayload).then(function(res) {
            if (res && res.success !== false) {
                var pending = res.member && res.member.linked_user === false;
                ToastService.success(pending ? 'Invite sent' : 'Member added',
                    pending ? 'They\'ll appear once they sign up.' : null,
                    { confetti: true });
                closeForm(); load();
            } else {
                ToastService.error('Could not add member', res && res.message);
            }
        });
    }

    function toggleRole(m, role) {
        if (!vm.is_admin) return;
        var payload = {};
        payload[role] = m[role] ? 0 : 1;
        MaintenanceOrgMemberService.Update(m.id, payload).then(function(res) {
            if (res && res.success !== false) {
                m[role] = payload[role];
                ToastService.success('Role updated', null, { confetti: false, duration: 1800 });
            } else {
                ToastService.error('Update failed', res && res.message);
            }
        });
    }

    function removeMember(m) {
        if (!vm.is_admin) return;
        if (!confirm('Remove ' + (m.first_name || 'this member') + ' from the organisation?')) return;
        MaintenanceOrgMemberService.Remove(m.id).then(function(res) {
            if (res && res.success !== false) {
                ToastService.success('Member removed', null, { confetti: false });
                load();
            } else {
                ToastService.error('Could not remove', res && res.message);
            }
        });
    }

    function roleLabel(m) {
        if (m.is_manager) return 'Admin';
        if (m.is_senior)  return 'Senior';
        return 'Member';
    }
    function roleBadge(m) {
        if (m.is_manager) return 'mxo-badge--info';
        if (m.is_senior)  return 'mxo-badge--teal';
        return 'mxo-badge--slate';
    }
}
