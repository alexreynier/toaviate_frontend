




 app.controller('DashboardClubItemsController', DashboardClubItemsController);

    DashboardClubItemsController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'ItemService'];
    function DashboardClubItemsController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, ItemService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        var update_this_file = [];
        

        vm.action = $state.current.data.action;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;
        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
         //console.log($stateParams);
        // //console.log($stateParams.id);
        switch(vm.action){
            case "add":
                //console.log("adding a new plane please");
                vm.page_title = "Add a New Plane";
            break;
            case "edit":
                //console.log("edit an existing plane");
                 //console.log($stateParams);
                ItemService.GetById($stateParams.item_id)
                    .then(function(data){
                        vm.club.item = data.item;   
                        //console.log(vm.club);
                        vm.page_title = "Edit an Item - "+vm.club.item.title;
                    });


            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                ItemService.GetByClubId(vm.club_id)
                    .then(function(data){
                        vm.club.items = data.items;   
                        //console.log(vm.club.items);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

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
                //console.log(vm.club.plane);
                $scope.update();
            }
        }


        $scope.create = function(){
            //console.log("CREATE ME NOW");
            vm.club.item.club_id = vm.club_id;
            ItemService.Create(vm.club.item)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.items');

                });
        }

        // $scope.delete = function(){
        //     //console.log("CLICK");
        //     alert("Are you sure you would like to delete this plane?");
        //     ItemService.Delete(vm.user.id, vm.club.item)
        //         .then(function(data){
        //             //console.log(data);
        //         });
        // }

        $scope.delete = function(item){
            var a = confirm("Are you sure you would like to delete this item?");
            if(a){
                ItemService.Delete(vm.user.id, item.id)
                .then(function(data){
                    
                    if(data.success){

                         ItemService.GetByClubId(vm.club_id)
                        .then(function(data){
                            vm.club.items = data.items;   
                            // //console.log(vm.club.items);
                        });

                    } else {
                        alert("An error occured when trying to delete this item.");
                    }

                });
            }
            
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.item.club_id = vm.club_id;
            ItemService.Update(vm.club.item, vm.user.id)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.items');
                });
        }


        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }



      
















        initController();

        function initController() {
           //console.log("check if access is okay");
        }


            var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          $scope.open = function (plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return plane_id;
                },
                params: function() {
                  return {id: plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane_id) {
              $log.info('PRESSED GO: '+plane_id.id);
              ItemService.Delete(vm.user.id, plane_id.id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.items = $.grep(vm.club.items, function(e){ 
                    return e.id != plane_id.id; 
                });
              })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

         


    }