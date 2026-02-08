 app.controller('MyAccountController', MyAccountController);

    MyAccountController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService'];
    function MyAccountController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService) {
        
        var vm = this;
       

        vm.user = $rootScope.globals.currentUser;
        //console.log("USER HERE IS : ", vm.user);

        
        


    }