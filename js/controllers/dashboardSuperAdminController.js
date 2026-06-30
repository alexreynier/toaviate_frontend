app.controller('DashboardSuperAdminController', DashboardSuperAdminController);

    DashboardSuperAdminController.$inject = ['$rootScope', '$location'];
    function DashboardSuperAdminController($rootScope, $location) {
        var vm = this;

        vm.user = $rootScope.globals.currentUser;

        // ── ToAviate platform-staff gate ──
        // Only @toaviate.com staff may reach the hub. This matches the shared
        // $rootScope.isToAviateStaff() helper; we also hard-stop non-staff who
        // deep-link straight to /dashboard/super_admin by bouncing them home.
        vm.is_toaviate_staff = !!(vm.user && vm.user.email &&
            /@toaviate\.com$/i.test(vm.user.email));

        if (!vm.is_toaviate_staff) {
            $location.path('/dashboard');
            return;
        }
    }
