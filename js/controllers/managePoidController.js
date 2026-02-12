 app.controller('ManagePoidController', ManagePoidController);

    ManagePoidController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'PoidService', 'AuthenticationService', 'ToastService'];
    function ManagePoidController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, PoidService, AuthenticationService, ToastService) {
        
        var vm = this;        

        vm.poid_images = [];
        vm.poid = {
                images: []
        };


        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        //THIS MAY BE USED LATER WHEN WE SET REAL ID TYPES
        // PoidService.GetPoidTypes()
        //         .then(function (data) {
        //             vm.poid_types = data;
        //             //console.log("poid_types: ", vm.poid_types);
        //         });

    


        switch($state.current.data.action){
            case "add":

                    //vm.selected_component = vm.components[0];
                    //vm.selected_component = 
                    

                    // //console.log("AA", vm.selected_component);

            

            break;
            case "edit":

            // //console.log("EDIT ONE");
            // //console.log("PARAMS: ", $stateParams);

             PoidService.GetById($stateParams.poid_id, 1, 0)
                .then(function (data) {
                    if(data.success){
                        vm.poid = data.poid;
                        vm.poid.expiry_date = new Date(vm.poid.expiry_date);

                        
                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                //console.log("LIST ALL");

                 //1 get the user's poid...
                 //list stuff

                PoidService.GetByUserId(vm.user.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        vm.user_poids = data.poids;

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



            // $scope.add_component = function(){

            //     //remove from first array
            //     vm.components = $.grep(vm.components, function(e){ 
            //         return e.id != vm.selected_component.id; 
            //     });

            //     vm.poid.components.push(vm.selected_component);

            //     //clear selected
            //     delete vm.selected_component;
                
            //     //clean the array to show what we want to show :)
            //     //delete $scope.formData.license.add_to[bit_type];

            // }

            // $scope.remove_component = function(index){

            //     //add to dropdown
            //     vm.components.push(vm.poid.components[index]);
            //     vm.poid.components.splice(index,1)

            //     //$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);

            //     //  //console.log($scope.formData.license[bit_type]);
            //     //  $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            // }

            //default add the first component required...
            



/*

OLD VERSION FOR LEGACY PURPOSES

  $scope.add_element = function(bit_type){

                //remove from first array
                $scope[bit_type][bit_type] = $.grep($scope[bit_type][bit_type], function(e){ 
                    return e.id != $scope.formData.license.add_to[bit_type].id; 
                });

                if(bit_type == "differences"){
                    $scope.formData.license.add_to[bit_type].day = true;
                    $scope.formData.license.add_to[bit_type].vfr = true;
                }
                //console.log($scope.formData.license.add_to[bit_type]);

                $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
                
                //clean the array to show what we want to show :)
                delete $scope.formData.license.add_to[bit_type];

            }


            $scope.remove_element = function(bit_type, index){

                //add to dropdown
                $scope[bit_type][bit_type].push($scope.formData.license[bit_type][index]);
            
                $scope.formData.license[bit_type].splice(index,1)

                $scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);
                //console.log($scope.formData.license[bit_type]);
                //$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }


*/


            //nice looking date pickers


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

           

           $scope.remove_real_file = function(file){

                //remove_file

                vm.poid.images = $.grep(vm.poid.images, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            PoidService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.poid_images = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

            $scope.processFiles = function(files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    files[i].file.temp_path = j.saved_url;
                    // //console.log("file", files[i].file);
                    vm.poid_images.push(files[i].file);
                }


            }


            vm.show_loading = false;
            vm.blurred = true;
            vm.show_temp_login = false;

              $scope.getDecrypted = function(){
                  vm.show_loading = true;
                  // PoidService.GetById($stateParams.medical_id, 1, 1)
                  //   .then(function (data) {

                  //       if(data.success){
                  //           vm.medical = data.medical;
                  //           vm.medical.examination_date = new Date(vm.medical.examination_date);

                  //           vm.medical.state_of_issue = $.grep(vm.authority, function(e){ return e.id == vm.medical.authority_id; })[0];
                  //           ////console.log("SET", vm.medical.state_of_issue);

                  //           //pre-selection bits?
                  //           ////console.log("NEW RATINGS", vm.medical.components);
                  //           for(var i=0;i<vm.medical.components.length;i++){
                  //               delete vm.medical.components[i].id;
                  //               vm.medical.components[i].id = vm.medical.components[i].component_id;
                  //               delete vm.medical.components[i].component_id;
                  //               vm.medical.components[i].expiry_date = new Date(vm.medical.components[i].expiry_date);

                  //               //need to remove the component from the components lists too :)
                  //               vm.components = $.grep(vm.components, function(e){ 
                  //                   return e.id != vm.medical.components[i].id; 
                  //               });

                  //           }

                  //           vm.blurred = false;
                  //           vm.show_loading = false;
                  //       } else {
                  //           //console.log("WOOOPSIES...");
                  //           vm.show_loading = false;
                  //           //this should be very very rare...
                  //       }

                  //   });

                 PoidService.GetById($stateParams.poid_id, 1, 1)
                .then(function (data) {
                    if(data.success){
                        vm.poid = data.poid;
                        vm.poid.expiry_date = new Date(vm.poid.expiry_date);

                        vm.blurred = false;
                        vm.show_loading = false;
                    } else {
                        //console.log("WOOOPSIES...");
                        if(data.fail == "templogin"){
                                    //console.log("WOOOPSIES...", data);
                                    vm.show_temp_login = true;

                                }

                        vm.show_loading = false;
                        //this should be very very rare...
                    }

                });

              }


              function create_sample(length) {
                   var result           = '';
                   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                   var charactersLength = characters.length;
                   for ( var i = 0; i < length; i++ ) {
                      result += characters.charAt(Math.floor(Math.random() * charactersLength));
                   }
                   return result;
                }


                $scope.re_login = function(){


                      ////console.log("CLICKED", vm.re_login_pass);

                      //now we use the token that has been assigned already to verify the login password

                        AuthenticationService.Login3(vm.re_login_pass, create_sample(120), function (response) {
                            //console.log("resp", response);
                            if (response.success) {


                                //we now need to call the query that was called before (decryption)

                                $scope.getDecrypted();




                                vm.show_temp_login = false;
                            } else {
                                ToastService.error('Wrong Password', 'This is the wrong password - please try again.');
                            }
                        });



                      //vm.show_temp_login = true;

                  }



            $scope.delete_poid = function(id){

              
                var a = prompt("Are you sure you wish to delete this poid? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){


                    //console.log("WE DELETE IT");


                    PoidService.Delete(vm.user.id, id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.user_poids = $.grep(vm.user_poids, function(e){ 
                                    return e.id != id; 
                                });
                                
                                //refresh?
                                $state.reload();
                                $state.go('dashboard.my_account.poid');

                            } else {

                                ToastService.error('Error', data.message);

                            }

                        });



                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_poid = function(){
                
                vm.show_loading = true;

                if(vm.poid_images.length < 1 && vm.poid.images.length < 1){

                    ToastService.highlightField('.drop');
                    ToastService.warning('Image Required', 'You must at least have 1 image of your poid!');
                    vm.show_loading = false;
                    return false;   
                }


                if(!vm.poid.expiry_date){
                    ToastService.highlightField('expiry_date');
                    ToastService.warning('Expiry Required', 'You must enter an expiry date for your ID.');
                    vm.show_loading = false;
                    return false;
                }

                 if(!vm.poid.title){
                    ToastService.highlightField('title');
                    ToastService.warning('ID Type Required', 'You must enter an ID Type.');
                    vm.show_loading = false;
                    return false;
                }


              

                // //console.log("FLOW: ", vm.poid_images);



                //compile the required elements YAY

                // //console.log("LICENCE GOOD TO GO ", vm.poid);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    for(var i=0;i<vm.poid.images.length;i++){
                        delete vm.poid.images[i].data_uri;
                    }

                    // vm.poid.images = vm.poid_images;
                    vm.poid.images = vm.poid.images.concat(vm.poid_images);
                    vm.poid.user_id = vm.user.id;


                if(vm.poid.id){
                    //then its an udpate

                    //merge the images left?
                    PoidService.Update(vm.poid)
                        .then(function (data) {
                            // //console.log(data);
                            if(data.success){
                                // //console.log("HUZZAH", vm.poid);
                                // //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                            vm.show_loading = false;
                                //move somewhere?

                                ToastService.success('Saved', 'Your changes have been saved.');
                                $state.go('dashboard.my_account.poid', {}, { reload: true });





                            } else {

                                ToastService.error('Error', data.message);
                            vm.show_loading = false;

                            }

                        });

                } else {


                   


                    //then its a create
                    // //console.log(vm.poid);

                    PoidService.Create(vm.poid)
                        .then(function (data) {
                            // //console.log(data);
                            if(data.success){
                                // //console.log("HUZZAH", vm.poid);
                                // //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.show_loading = false;
    
                                $state.go('dashboard.my_account.poid', {}, { reload: true });
                                //move somewhere?
                               // $state.reload();
                               // $state.go('dashboard.my_account.poid', {}, { reload: true });


                            } else {

                                ToastService.error('Error', data.message);
                                vm.show_loading = false;

                            }

                        });


                }



            };



        
        


    }