 app.controller('ManageNokController', ManageNokController);

    ManageNokController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'NokService', 'ToastService'];
    function ManageNokController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, NokService, ToastService) {
        
        var vm = this;        

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;        
        vm.noks = [];
        vm.clearFieldError = ToastService.clearFieldError;

        
    


        switch($state.current.data.action){
            case "add":

                    //vm.selected_component = vm.components[0];
                    //vm.selected_component = 
                    

                    // //console.log("AA", vm.selected_component);

            

            break;
            case "edit":

            // //console.log("EDIT ONE");
             //console.log("PARAMS: ", $stateParams);

             NokService.GetById($stateParams.nok_id)
                .then(function (data) {
                    if(data.success){
                        vm.nok = data.nok;
                        //console.log("NOK", vm.nok);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                //console.log("LIST ALL");

                 //1 get the user's nok...
                 //list stuff

                NokService.GetByUserId(vm.user.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        vm.noks = data.noks;

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  



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

           

      

          



            $scope.delete_nok = function(id){

              
                var a = prompt("Are you sure you wish to delete this nok? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){

                    //console.log("WE DELETE IT");

                    NokService.Delete(vm.user.id, id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                //refresh?
                                $state.go('dashboard.my_account.nok', {}, { reload: true });

                            } else {

                                ToastService.error('Delete Failed', 'Something went terribly wrong: ' + data.message);

                            }

                        });


                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_nok = function(isValid){

                // ── Pre-submit validation with highlight + scroll ──
                var checks = [
                    { ok: vm.nok.first_name,    field: 'first_name',   label: 'First Name' },
                    { ok: vm.nok.last_name,     field: 'last_name',    label: 'Last Name' },
                    { ok: vm.nok.phone_number,  field: 'phone_number', label: 'Phone Number' },
                    { ok: vm.nok.relationship,  field: 'relationship', label: 'Relationship' },
                    { ok: vm.nok.address,       field: 'address',      label: 'Address' }
                ];
                if (!ToastService.validateForm(checks)) return false;

                vm.nok.user_id = vm.user.id;

                if(vm.nok.id){
                    
                    //then its an udpate
                    //merge the images left?

                    NokService.Update(vm.nok)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                ToastService.success('Saved', 'Next of kin updated successfully.');
                                $state.go('dashboard.my_account.nok', {}, { reload: true });


                            } else {

                                ToastService.error('Update Failed', 'Something went terribly wrong: ' + data.message);

                            }

                        });

                } else {


                

                    NokService.Create(vm.nok)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                ToastService.success('Saved', 'Next of kin created successfully.');
                                $state.go('dashboard.my_account.nok', {}, { reload: true });


                            } else {

                                ToastService.error('Create Failed', 'Something went terribly wrong: ' + data.message);

                            }

                        });


                }



            };



        
        


    }