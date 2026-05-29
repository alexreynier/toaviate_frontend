// MaintenanceSettingsController — edit / deactivate the organisation (admin only).
app.controller('MaintenanceSettingsController', MaintenanceSettingsController);

MaintenanceSettingsController.$inject = ['$rootScope', '$scope', '$state', 'ToastService', 'MaintenanceOrganisationService'];
function MaintenanceSettingsController($rootScope, $scope, $state, ToastService, MaintenanceOrganisationService) {
    var vm = this;

    function parentCtx() {
        var p = $scope.$parent;
        while (p && !p.vm) p = p.$parent;
        return p && p.vm ? p.vm : {};
    }
    var ctx = parentCtx();
    vm.org_id   = ctx.org_id;
    vm.is_admin = !!ctx.is_admin;

    vm.loading = true;
    vm.saving  = false;
    vm.org     = null;

    vm.save        = save;
    vm.deactivate  = deactivate;
    vm.clearFieldError = function(e) { ToastService.clearFieldError(e); };

    load();

    function load() {
        if (!vm.org_id) { vm.loading = false; return; }
        vm.loading = true;
        MaintenanceOrganisationService.GetById(vm.org_id).then(function(res) {
            vm.loading = false;
            if (res && res.success !== false) {
                vm.org = res.organisation || res.data || res;
            } else {
                ToastService.error('Failed to load', res && res.message);
            }
        });
    }

    function save() {
        if (!vm.is_admin) return;
        var checks = [
            { ok: !!vm.org.title, field: 'mxs_title', label: 'Trading name' },
            { ok: !!vm.org.email, field: 'mxs_email', label: 'Email' }
        ];
        if (!ToastService.validateForm(checks)) return;

        vm.saving = true;
        MaintenanceOrganisationService.Update(vm.org_id, vm.org).then(function(res) {
            vm.saving = false;
            if (res && res.success !== false) {
                ToastService.success('Settings saved', null, { confetti: false });
                load();
            } else {
                ToastService.error('Could not save', res && res.message);
            }
        });
    }

    function deactivate() {
        if (!vm.is_admin) return;
        if (!confirm('Deactivate this maintenance organisation? This will remove its access to clubs\' fleets.')) return;
        MaintenanceOrganisationService.Deactivate(vm.org_id).then(function(res) {
            if (res && res.success !== false) {
                ToastService.success('Organisation deactivated');
                $state.go('dashboard');
            } else {
                ToastService.error('Could not deactivate', res && res.message);
            }
        });
    }
}
