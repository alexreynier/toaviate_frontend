app.controller('MyExamsController', MyExamsController);

    MyExamsController.$inject = ['ExamSalesService', 'ClubService', '$rootScope', '$scope', '$state', '$uibModal'];
    function MyExamsController(ExamSalesService, ClubService, $rootScope, $scope, $state, $uibModal) {

        // Student view of their own ground exams: purchases, results and CAA
        // certificates (tap to view the decrypted file). Read-only — no
        // pricing, no audit, no other students. BACKEND_EXAM_SALES_GUIDE.md §5.5.

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.loading = true;
        vm.items = [];
        vm.clubs = [];          // [{id, title, currency}] — chips when a member of several
        vm.club = null;

        // Any club the user belongs to in any capacity can have sold them exams.
        var club_ids = [];
        angular.forEach(['pilot', 'instructor', 'manager'], function(role) {
            angular.forEach(vm.user.access[role] || [], function(id) {
                if (club_ids.indexOf(id) === -1) { club_ids.push(id); }
            });
        });

        if (!club_ids.length) {
            vm.loading = false;
        }

        var pending = club_ids.length;
        angular.forEach(club_ids, function(id) {
            ClubService.GetById(id).then(function(data) {
                vm.clubs.push({ id: id, title: (data && data.title) || ('Club #' + id), currency: (data && data.account_currency) || '£' });
                pending--;
                if (pending === 0) {
                    vm.clubs.sort(function(a, b) { return a.title.localeCompare(b.title); });
                    vm.selectClub(vm.clubs[0]);
                }
            });
        });

        vm.selectClub = function(club) {
            vm.club = club;
            vm.loading = true;
            vm.items = [];
            ExamSalesService.GetByUser(club.id, vm.user.id).then(function(data) {
                vm.loading = false;
                vm.items = (data && (data.purchases || data.items)) || [];
            });
        };

        // Paid / due chip from the invoice status joined onto the purchase
        // row (absent = unknown → no chip). Students pay from My Invoices.
        vm.payKind = function(item) {
            return ExamSalesService.InvoiceStatusKind(item.invoice_status);
        };

        vm.statusLabel = function(item) {
            if (item.status === 'result_entered') { return item.record_pass_fail == 1 ? 'passed' : 'not passed'; }
            if (item.status === 'cancelled') { return 'cancelled'; }
            return 'awaiting result';
        };

        // Certificates load lazily when a completed exam is expanded.
        vm.toggle = function(item) {
            item._open = !item._open;
            if (item._open && item.exam_record_id && !item._files && !item._filesLoading) {
                item._filesLoading = true;
                ExamSalesService.GetFilesForRecord(item.exam_record_id).then(function(data) {
                    item._filesLoading = false;
                    item._files = (data && (data.files || data.items)) || (angular.isArray(data) ? data : []);
                });
            }
        };

        vm.viewCertificate = function(f) {
            $uibModal.open({
                templateUrl: 'views/modals/exam_certificate_modal.html',
                controller: 'ExamCertificateModalController',
                controllerAs: 'vm',
                size: 'lg',
                resolve: { context: function() { return { file_id: f.id, title: f.original_name }; } }
            });
        };
    }
