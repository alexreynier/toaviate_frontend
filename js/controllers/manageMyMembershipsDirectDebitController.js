 app.controller('ManageMyMembershipsDirectDebitController', ManageMyMembershipsDirectDebitController);

    ManageMyMembershipsDirectDebitController.$inject = ['UserService', 'MemberService', 'MembershipService', 'PaymentService', 'InstructorService', 'HolidayService', 'ClubService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'NokService', 'GoCardService', '$cookies'];
    function ManageMyMembershipsDirectDebitController(UserService, MemberService, MembershipService, PaymentService, InstructorService, HolidayService, ClubService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, NokService, GoCardService, $cookies) {
        
        var vm = this;        

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;        
      
        vm.success = true;
  

        switch($state.current.data.action){
          
            case "direct_debit":

                var mandate = $location.search().redirect_flow_id;
                ////console.log("DIRECT DEBIT SORTING 444", mandate);
                //RE0002NPM29SQ1F4B57R8E3AT4YJAPZG
                var session = $cookies.get('gcl_sess');

                var object = {
                    mandate: mandate,
                    session: session,
                    member_accepted: false

                };

                if($cookies.get("gcl_member_accepted")){
                    object["member_accepted"] = true;
                }



                GoCardService.SetupMandate(object).then(function (data) {
                    if(data.success){
                        //vm.requests = data.requests;

                        vm.club = data.club;
                        // //console.log("memberships", vm.memberships);
                        vm.success = true;

                    } else {
                        // //console.log("WOOOPSIES...");
                        vm.success = false;
                        //this should be very very rare...
                    }

                });
                



               


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  





        
        
        


    }