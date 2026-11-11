app.controller('DashboardSuperAdminController', DashboardSuperAdminController);

    DashboardSuperAdminController.$inject = ['$rootScope', '$location'];
    function DashboardSuperAdminController($rootScope, $location) {
        var vm = this;

        vm.user = $rootScope.globals.currentUser;

        // ── ToAviate platform-staff gate ──
        // Only ToAviate staff may reach the hub: the shared
        // $rootScope.isToAviateStaff() (the account's staff flag). We also
        // hard-stop non-staff who deep-link straight to /dashboard/super_admin
        // by bouncing them home.
        vm.is_toaviate_staff = $rootScope.isToAviateStaff();

        if (!vm.is_toaviate_staff) {
            $location.path('/dashboard');
            return;
        }
    }
