 app.controller('UpdateMyMembershipDirectDebitController', UpdateMyMembershipDirectDebitController);

    UpdateMyMembershipDirectDebitController.$inject = ['UserService', 'MemberService', 'MembershipService', 'PaymentService', 'InstructorService', 'HolidayService', 'ClubService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'NokService', 'GoCardService', '$cookies'];
    function UpdateMyMembershipDirectDebitController(UserService, MemberService, MembershipService, PaymentService, InstructorService, HolidayService, ClubService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, NokService, GoCardService, $cookies) {
        
        var vm = this;        

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;        
      
        vm.success = true;

        vm.return_id = $stateParams.membership_id;
  

        switch($state.current.data.action){
          
            case "direct_debit2":

                var mandate = $location.search().redirect_flow_id;
                ////console.log("DIRECT DEBIT SORTING 444", mandate);
                //RE0002NPM29SQ1F4B57R8E3AT4YJAPZG
                var session = $cookies.get('gcl_sess');

                var object = {
                    mandate: mandate,
                    session: session,
                    membership_id: $stateParams.membership_id
                };
                //console.log("THE TOTALS:::", object);

                if($cookies.get("gcl_member_accepted")){
                    object["member_accepted"] = true;
                }



                GoCardService.UpdateMandate(object).then(function (data) {
                    if(data.error){
                        //vm.requests = data.requests;
                        //vm.club = data.club;
                        // //console.log("memberships", vm.memberships);
                        // vm.success = true;
                        vm.success = false;
                        //console.log("There was an error: ", data);
                        //now that this is saved... we should do something about it?
                        //window.location = "";

                    } else {

                        //console.log("HAPPY RESPONSE: ", data);
                        vm.success = true;

                        //window.location = "";
                        $state.go('dashboard.my_account.memberships.edit', {membership_id: vm.return_id}, {reload: true});

                        // //console.log("WOOOPSIES...");
                        // vm.success = false;
                        //this should be very very rare...
                    }

                });
                



               


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  






        
        


    }