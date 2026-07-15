// DashboardMaintenanceController — parent for /dashboard/maintenance and its children.
// Owns the org switcher, current_org context, role flags and shared loaders.
app.controller('DashboardMaintenanceController', DashboardMaintenanceController);

DashboardMaintenanceController.$inject = ['$rootScope', '$scope', '$state', '$cookies', 'ToastService', 'MaintenanceOrganisationService', 'TrackerCommerceService'];
function DashboardMaintenanceController($rootScope, $scope, $state, $cookies, ToastService, MaintenanceOrganisationService, TrackerCommerceService) {
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
                acceptPendingTrackerInvite();
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

    // A club may have invited this org to take on Fox trackers before the user
    // signed up (signup stores the token — see maintenanceSignupController).
    // Complete the link the first time the workspace loads after login.
    function acceptPendingTrackerInvite() {
        var token = null;
        try { token = localStorage.getItem('toaviate_tracker_invite'); } catch (e) {}
        if (!token || !vm.org_id) { return; }
        TrackerCommerceService.AcceptMaintenanceInvite({ token: token, maintenance_org_id: vm.org_id }).then(function(res) {
            if (res && res.success !== false) {
                try { localStorage.removeItem('toaviate_tracker_invite'); } catch (e) {}
                ToastService.success('Trackers linked',
                    (res.linked_units || 'The') + ' tracker' + (res.linked_units == 1 ? '' : 's') + ' from the inviting club are now in your Trackers area.');
                $state.go('dashboard.maintenance.trackers');
            } else if (res && (res.error === 'invite_accepted' || res.error === 'invite_revoked' || res.error === 'invite_expired' || res.error === 'invite_invalid')) {
                // Dead token — drop it quietly so we don't retry forever.
                try { localStorage.removeItem('toaviate_tracker_invite'); } catch (e) {}
            }
            // Other failures (e.g. transient) keep the token for the next visit.
        });
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
