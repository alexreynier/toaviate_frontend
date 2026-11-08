app.controller('MyExamsController', MyExamsController);

    MyExamsController.$inject = ['ExamSalesService', '$rootScope', '$scope', '$state', '$uibModal'];
    function MyExamsController(ExamSalesService, $rootScope, $scope, $state, $uibModal) {

        // Student view of their own ground exams: purchases, results and CAA
        // certificates (tap to view the decrypted file). Read-only — no
        // pricing, no audit, no other students. BACKEND_EXAM_SALES_GUIDE.md §5.5.

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.loading = true;
        vm.loadFailed = false;
        vm.items = [];
        vm.clubs = [];          // [{id, title, currency, member, exams}] — chips when more than one
        vm.club = null;

        // The clubs, by name, from exam_sales/user_clubs: every club the user is
        // a member of plus every club that sold them an exam — one they have
        // left, or whose membership lapsed, included. (The list used to come
        // from current memberships, named through clubs/{id}, which refuses an
        // ex-member: "Club #id", or no clubs at all for a student who had left.)
        ExamSalesService.GetUserClubs(vm.user.id).then(function(data) {
            if (!data || data.success !== true || !angular.isArray(data.items)) {
                vm.loading = false;
                vm.loadFailed = true;
                return;
            }
            vm.clubs = data.items.map(function(c) {
                return { id: c.id, title: c.title || '', currency: c.currency_symbol || '£',
                         member: Number(c.member) === 1, exams: Number(c.exams) || 0 };
            });
            if (!vm.clubs.length) {
                vm.loading = false;
                return;
            }
            // already in title order — open the first club that has exams
            var withExams = vm.clubs.filter(function(c) { return c.exams > 0; });
            vm.selectClub(withExams.length ? withExams[0] : vm.clubs[0]);
        });

        vm.selectClub = function(club) {
            vm.club = club;
            vm.loading = true;
            vm.items = [];
            ExamSalesService.GetByUser(club.id, vm.user.id).then(function(data) {
                if (vm.club !== club) { return; }   // a newer chip was picked meanwhile
                vm.loading = false;
                vm.loadFailed = !data || data.success === false;
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
