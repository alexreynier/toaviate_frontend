 app.controller('MyAccountController', MyAccountController);

    MyAccountController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'VoucherService'];
    function MyAccountController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, VoucherService) {
        
        var vm = this;
       

        vm.user = $rootScope.globals.currentUser;
        //console.log("USER HERE IS : ", vm.user);

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