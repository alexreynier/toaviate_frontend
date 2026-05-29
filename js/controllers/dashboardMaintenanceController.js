// DashboardMaintenanceController — parent for /dashboard/maintenance and its children.
// Owns the org switcher, current_org context, role flags and shared loaders.
app.controller('DashboardMaintenanceController', DashboardMaintenanceController);

DashboardMaintenanceController.$inject = ['$rootScope', '$scope', '$state', '$cookies', 'ToastService', 'MaintenanceOrganisationService'];
function DashboardMaintenanceController($rootScope, $scope, $state, $cookies, ToastService, MaintenanceOrganisationService) {
    var vm = this;

    vm.$state    = $state;
    vm.user      = $rootScope.globals.currentUser || {};
    vm.user_id   = vm.user.id;
    vm.orgs      = [];
    vm.org       = null;     // currently selected org with role flags
    vm.org_id    = null;
    vm.is_admin  = false;
    vm.is_senior = false;
    vm.loading   = true;
    vm.error     = null;

    vm.onOrgSelected = onOrgSelected;
    vm.signOutOfOrg  = signOutOfOrg;

    init();

    function init() {
        if (!vm.user_id) {
            vm.loading = false;
            vm.error = 'You must be signed in.';
            return;
        }
        MaintenanceOrganisationService.GetForUser(vm.user_id).then(function(res) {
            vm.loading = false;
            if (res && res.success !== false && (res.organisations || res.success)) {
                vm.orgs = (res.organisations || res.data || res || []).slice();
                if (!angular.isArray(vm.orgs)) vm.orgs = [];
                if (!vm.orgs.length) {
                    vm.error = 'You are not a member of any maintenance organisation yet.';
                    return;
                }
                var saved = $cookies.get('toaviate_selected_org_id');
                var match = saved && find(vm.orgs, function(o) { return String(o.id) === String(saved); });
                selectOrg(match || vm.orgs[0]);
            } else {
                vm.error = (res && res.message) || 'Unable to load your organisations.';
            }
        });
    }

    function selectOrg(org) {
        vm.org      = org;
        vm.org_id   = org && org.id;
        vm.is_admin = !!(org && (org.is_manager === 1 || org.is_manager === true));
        vm.is_senior = !!(org && (org.is_senior === 1  || org.is_senior  === true)) || vm.is_admin;
        $rootScope.globals.currentUser.current_org = org;
        $cookies.put('toaviate_selected_org_id', String(org.id));
    }

    function onOrgSelected(item) {
        selectOrg(item);
        // Reload current state so child controllers refresh against the new org.
        $state.reload();
    }

    function signOutOfOrg() {
        $cookies.remove('toaviate_selected_org_id');
        $state.go('dashboard');
    }

    function find(arr, pred) {
        for (var i = 0; i < arr.length; i++) if (pred(arr[i])) return arr[i];
        return null;
    }
}
