 app.controller('MyAccountController', MyAccountController);

    MyAccountController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'VoucherService', 'BookoutService', 'ToastService', 'CourseAssignmentService'];
    function MyAccountController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, VoucherService, BookoutService, ToastService, CourseAssignmentService) {

        var vm = this;


        vm.user = $rootScope.globals.currentUser;

        // Outstanding "assigned to me" count for the dashboard tile badge.
        vm.assignedCount = 0;
        CourseAssignmentService.MineCount().then(function(data) {
            vm.assignedCount = (data && typeof data.count === 'number') ? data.count : 0;
        });
        //console.log("USER HERE IS : ", vm.user);

        // Bookings / bookouts / to-pay data for the dashboard home view
        vm.bookings = [];
        vm.bookouts = [];
        vm.to_pay = [];
        vm.to_complete_split = [];

        vm.force_show_admins = false;
        if (vm.user && vm.user.access && vm.user.access.manager) {
            vm.force_show_admins = true;
        } else if (vm.user && vm.user.access && vm.user.access.instructor) {
            vm.force_show_admins = true;
        }

        load_bookings();

        function load_bookings() {
            BookingService.GetTodayBookingsUser(vm.user.id)
                .then(function(data) {
                    vm.bookings = data.bookings;
                    vm.to_pay = data.to_pay;
                    vm.to_complete_split = data.to_complete_split;
                });

            BookoutService.GetBookoutsToComplete(vm.user.id)
                .then(function(data) {
                    vm.bookouts = data.bookouts;
                });
        }

        vm.cancel_bookout = function(id) {
            var a = confirm("Are you sure you wish to cancel the bookout?");
            if (a) {
                BookoutService.CancelBookout(id)
                    .then(function(data) {
                        if (data.success) {
                            load_bookings();
                        } else {
                            ToastService.error('Error', data.message);
                        }
                    });
            }
        };

        vm.cancel_booking = function(id) {
            var a = confirm("Are you sure you wish to cancel the booking?");
            if (a) {
                BookoutService.DeleteBooking(vm.user.id, id)
                    .then(function(data) {
                        if (data.success) {
                            load_bookings();
                        } else {
                            ToastService.error('Error', data.message);
                        }
                    });
            }
        };

        // Check if user has any vouchers (single lightweight call)
        vm.hasVouchers = false;

        VoucherService.HasVouchers()
            .then(function(data) {
                if (data && data.success && data.has_vouchers) {
                    vm.hasVouchers = true;
                }
            })
            .catch(function() {
                // Silently fail — button just stays hidden
            });


    }