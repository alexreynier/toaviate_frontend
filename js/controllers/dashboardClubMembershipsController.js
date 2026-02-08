 app.controller('DashboardClubMembershipsController', DashboardClubMembershipsController);

    DashboardClubMembershipsController.$inject = ['UserService', 'MembershipService', 'ClubService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window'];
    function DashboardClubMembershipsController(UserService, MembershipService, ClubService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        
        

        vm.action = $state.current.data.action;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;
        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);


        ClubService.GetById(vm.club_id)
        .then(function(data){
                console.log("DATA HERE", data);
                        vm.club = data;   
                        vm.club.membership = {};

        //default



        switch(vm.action){
            case "add":
                //console.log("adding a new membership please");
                vm.page_title = "Add a New membership";

                //setting some default values here
                vm.club.membership.currency = vm.club.account_currency;
                vm.club.membership.passenger_only = 0;
                vm.club.membership.passenger_only_default = 0;

                 MembershipService.GetAllMembershipPlanes(vm.club_id, 1)
                    .then(function(data){
                        vm.club_planes = data.membership_planes;   
                    });

            break;
            case "edit":
                //console.log("edit an existing membership");
                MembershipService.GetById($stateParams.membership_id, vm.club_id)
                    .then(function(data){
                        vm.club.membership = data;   
                        //console.log(vm.club);
                        vm.page_title = "Edit a membership - "+vm.club.membership.membership_name;
                    });

                MembershipService.GetAllMembershipPlanes(vm.club_id, $stateParams.membership_id)
                    .then(function(data){
                        vm.club_planes = data.membership_planes;   
                    });


            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                MembershipService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.memberships = data;   
                        console.log("one", vm.club.memberships);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  


         });
        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $window.history.back();
        }

        $scope.save = function(){
            if(vm.action == "add"){
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.club.membership);
                $scope.update();



            }




        }


        $scope.create = function(){
            //console.log("CREATE ME NOW");
            vm.club.membership.club_id = vm.club_id;
            MembershipService.Create(vm.club.membership)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.memberships');
                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            alert("Are you sure you would like to delete this membership?");
            MembershipService.Update(vm.club.membership)
                .then(function(data){
                    //console.log(data);
                });
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.membership.club_id = vm.club_id;
            MembershipService.Update(vm.club.membership)
                .then(function(data){
                    //console.log("new membership is : ",data);
                    //console.log("saved");

                    if(vm.club.membership.plane_access == 1){
                        //sort out what we need from the club_planes
                        var send_planes = [];
                        for(var i=0;i<vm.club_planes.length;i++){
                            var plane = {
                                id: vm.club_planes[i].id,
                                tacho_hour_fee: vm.club_planes[i].membership_tacho_hour_fee,
                                landing_fee: vm.club_planes[i].membership_landing_fee,
                                touch_and_go_fee: vm.club_planes[i].membership_touch_and_go_fee,
                                access: vm.club_planes[i].access,
                                membership_id: data,
                                plane_id: vm.club_planes[i].plane_id
                            };
                            send_planes.push(plane);
                        }


                        //then we need to make an additional call to UPDATE all these...
                         MembershipService.UpdateMembershipPlanes(data, send_planes)
                            .then(function(data){
                                //console.log(data);

                            });

                    }

                    $state.go('dashboard.manage_club.memberships');
                });
        }

        initController();

        vm.previous_price = 0;

        vm.update_price = function(){

            ////console.log("previous price: ", vm.previous_price);

            if(vm.club.membership.payment_term == "free"){
                vm.previous_price = (vm.club.membership.price > 0)? vm.club.membership.price : 0;
                vm.club.membership.price = 0;
            } else {
                vm.club.membership.price = (vm.club.membership.price > 0) ? vm.club.membership.price : ((vm.previous_price > 0) ? vm.previous_price : 0);
            }

        }

        

        function initController() {
           //console.log("check if access is okay");
        }


            var warning_msg = "By deleting this membership, you will also cancel all reservations that this membership currently has."

          // $scope.open = function(membership_id) {
          //     alert("HI");
          //     //console.log("log =- ", membership_id);

          //   var modalInstance = $uibModal.open({
          //     animation: true,
          //     templateUrl: 'views/modals/deleteModal.html',
          //     controller: 'ModalInstanceCtrl',
          //     size: "lg",
          //     resolve: {
          //       id: function () {
          //         return membership_id;
          //       },
          //       warning: function(){
          //           return warning_msg;
          //       }
          //     }
          //   });
          //   modalInstance.result.then(function (membership_id) {
          //     $log.info('PRESSED GO: '+membership_id);
          //     MembershipService.Delete(membership_id)
          //     .then(function(){
          //       //console.log("HELLO DELETE");
          //       //update view?
          //        vm.club.memberships = $.grep(vm.club.memberships, function(e){ 
          //           return e.id != membership_id; 
          //       });
          //     })
          //   }, function () {
          //     $log.info('Modal dismissed at: ' + new Date());
          //   });
          // };


           $scope.open = function (memberships) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return memberships;
                },
                params: function() {
                  return {id: memberships};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (memberships) {
              $log.info('PRESSED GO: '+memberships.id);


                MembershipService.Delete(memberships.id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.memberships = $.grep(vm.club.memberships, function(e){ 
                    return e.id != memberships.id; 
                });
              })


            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

         


    }