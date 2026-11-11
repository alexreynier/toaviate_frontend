app.controller('DashboardClubDataImportController', DashboardClubDataImportController);

    // Manage Club → Data Import. Until 2026-11-10 the training-records import
    // (tpc_import_home.html, TpcImportController) and the course reassign tool
    // (training_record_reassign.html, TrainingRecordReassignController) were a
    // manager-gated section of the Settings page; this page hosts the same two
    // partials (batch 18). Both partials carry their own controller and manager
    // gate; this controller only provides the page's own manager flag for the
    // "managers only" note (the backend gates every tpc_import endpoint).
    DashboardClubDataImportController.$inject = ['$rootScope'];
    function DashboardClubDataImportController($rootScope) {
        var vm = this;
        var user = $rootScope.globals.currentUser;
        vm.club_id = user.current_club_admin ? user.current_club_admin.id : null;
        vm.is_manager = !!(user.access && user.access.manager &&
            user.access.manager.indexOf(vm.club_id) > -1);
    }
