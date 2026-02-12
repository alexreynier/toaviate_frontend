 app.controller('DashboardClubMemberRequestsController', DashboardClubMemberRequestsController);

    DashboardClubMemberRequestsController.$inject = ['UserService', 'MemberService', 'MembershipService', 'PaymentService', 'InstructorService', 'HolidayService', 'ClubService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'NokService', '$cookies', 'ToastService'];
    function DashboardClubMemberRequestsController(UserService, MemberService, MembershipService, PaymentService, InstructorService, HolidayService, ClubService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, NokService, $cookies, ToastService) {
        
        var vm = this;        

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;  

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        vm.noks = [];
        vm.requests = [];
        vm.auto_renew = false;

        
    




        function update_requests(){
            MembershipService.GetRequestsByClub(vm.club_id)
                .then(function (data) {
                    if(data.success){
                        vm.requests = data.requests;
                        //console.log("memberships", vm.memberships);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });
        }

        update_requests();

            $scope.popup = [];

            $scope.open = function(id, $event) {
                //console.log("THIS", id);
                //this comment would allow the event not to be affect by clicking it again... not sure this is a good idea
                if($scope.popup[id] && $scope.popup[id].opened == true){
                    $event.preventDefault();
                    $event.stopPropagation();
                } else {
                    $scope.popup[id] = {opened: true};
                }
            };

            $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = $scope.formats[0];

            $scope.datePickerOptions = {
                                        format: 'dd/MM/yyyy',
                                        showWeeks: false
                                    };

           

            vm.show_memberships = false;

        





            $scope.accept_request = function(id){

                //basic checks...
                var obj = {
                    status: "Accepted"
                };

                MembershipService.ClubAcceptRequest(id, obj)
                .then(function (data) {
                    // //console.log("ACCEPT HERE", data);
                    //vm.memberships = data;

                    update_requests();

                    // $state.go('dashboard.my_account.memberships', {}, {reload: true});

                }); 

            }


            $scope.decline_request = function(){


                MembershipService.ClubDeclineRequest(vm.this_req.id)
                .then(function (data) {
                    //console.log("DECLINE HERE", data);
                    //vm.memberships = data;

                    update_requests();

                    // $state.go('dashboard.my_account.memberships', {}, {reload: true});

                }); 

            }


          

            // $scope.delete_request = function(){


            //     MembershipService.ClubDeclineRequest(vm.this_req.id)
            //     .then(function (data) {
            //         //console.log("DECLINE HERE", data);
            //         //vm.memberships = data;

            //         update_requests();

            //         // $state.go('dashboard.my_account.memberships', {}, {reload: true});

            //     }); 

            // }







            $scope.delete_request = function(id){
                MembershipService.DeleteRequest(id)
                .then(function (data) {
                    //console.log("DELETE HERE", data);


                    update_requests();
                }); 
            }

             $scope.resend_request = function(id){
                MembershipService.ResendRequest({request_id: id})
                .then(function (data) {
                    //vm.memberships = data;

                    if(data.success){
                        ToastService.success('Request Sent', 'Request re-sent. Please ask them to check their junk / spam folders if they do not see it within the next 5 minutes.')
                    }

                    update_requests();
                }); 
            }


        
        


    }