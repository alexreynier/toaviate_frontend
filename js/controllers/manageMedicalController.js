 app.controller('ManageMedicalController', ManageMedicalController);

    ManageMedicalController.$inject = ['UserService', 'MemberService', 'AuthenticationService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'LicenceService', 'MedicalService'];
    function ManageMedicalController(UserService, MemberService, AuthenticationService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, LicenceService, MedicalService) {
        
        var vm = this;        

        vm.medical_images = [];
        vm.medical = {
                images: [],
                components: []
        };
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        MedicalService.GetMedicalTypes()
                .then(function (data) {
                    vm.medical_types = data;
                    // //console.log("medical_types: ", vm.medical_types);
                });


        MedicalService.GetAuthority()
            .then(function (data) {
                vm.authority = data;
                // //console.log("authority: ", vm.authority);
            });

        MedicalService.GetComponents()
            .then(function (data) {
                vm.components = data;
                // //console.log("authority: ", vm.authority);
            });


        switch($state.current.data.action){
            case "add":

                    //vm.selected_component = vm.components[0];
                    //vm.selected_component = 
                    

                    // //console.log("AA", vm.selected_component);

            

            break;
            case "edit":

            // //console.log("EDIT ONE");
            // //console.log("PARAMS: ", $stateParams);

             MedicalService.GetById($stateParams.medical_id, 1, 0)
                .then(function (data) {
                    if(data.success){
                        vm.medical = data.medical;
                        vm.medical.examination_date = new Date(vm.medical.examination_date);

                        vm.medical.state_of_issue = $.grep(vm.authority, function(e){ return e.id == vm.medical.authority_id; })[0];
                        // //console.log("SET", vm.medical.state_of_issue);

                        //pre-selection bits?
                        // //console.log("NEW RATINGS", vm.medical.components);
                        for(var i=0;i<vm.medical.components.length;i++){
                            delete vm.medical.components[i].id;
                            vm.medical.components[i].id = vm.medical.components[i].component_id;
                            delete vm.medical.components[i].component_id;
                            vm.medical.components[i].expiry_date = new Date(vm.medical.components[i].expiry_date);

                            //need to remove the component from the components lists too :)
                            vm.components = $.grep(vm.components, function(e){ 
                                return e.id != vm.medical.components[i].id; 
                            });

                        }



                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                //console.log("LIST ALL");

                 //1 get the user's medical...
                 //list stuff

                MedicalService.GetByUserId(vm.user.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        vm.user_medicals = data.medicals;

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



            $scope.add_component = function(){

                //remove from first array
                vm.components = $.grep(vm.components, function(e){ 
                    return e.id != vm.selected_component.id; 
                });

                vm.medical.components.push(vm.selected_component);

                //clear selected
                delete vm.selected_component;
                
                //clean the array to show what we want to show :)
                //delete $scope.formData.license.add_to[bit_type];

            }

            $scope.remove_component = function(index){

                //add to dropdown
                vm.components.push(vm.medical.components[index]);
                vm.medical.components.splice(index,1)

                //$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);

                //  //console.log($scope.formData.license[bit_type]);
                //  $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }

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
                // //console.log("THIS", id);
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

                vm.medical.images = $.grep(vm.medical.images, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                

          }



          vm.show_loading = false;
          vm.blurred = true;
          vm.show_temp_login = false;

          $scope.getDecrypted = function(){
              vm.show_loading = true;
              MedicalService.GetById($stateParams.medical_id, 1, 1)
                .then(function (data) {

                    if(data.success){
                        vm.medical = data.medical;
                        vm.medical.examination_date = new Date(vm.medical.examination_date);

                        vm.medical.state_of_issue = $.grep(vm.authority, function(e){ return e.id == vm.medical.authority_id; })[0];
                        ////console.log("SET", vm.medical.state_of_issue);

                        //pre-selection bits?
                        ////console.log("NEW RATINGS", vm.medical.components);
                        for(var i=0;i<vm.medical.components.length;i++){
                            delete vm.medical.components[i].id;
                            vm.medical.components[i].id = vm.medical.components[i].component_id;
                            delete vm.medical.components[i].component_id;
                            vm.medical.components[i].expiry_date = new Date(vm.medical.components[i].expiry_date);

                            //need to remove the component from the components lists too :)
                            vm.components = $.grep(vm.components, function(e){ 
                                return e.id != vm.medical.components[i].id; 
                            });

                        }

                        vm.blurred = false;
                        vm.show_loading = false;
                    } else {

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


              //console.log("CLICKED", vm.re_login_pass);

              //now we use the token that has been assigned already to verify the login password

                AuthenticationService.Login3(vm.re_login_pass, create_sample(120), function (response) {
                    //console.log("resp", response);
                    if (response.success) {


                        //we now need to call the query that was called before (decryption)

                        $scope.getDecrypted();




                        vm.show_temp_login = false;
                    } else {
                        alert("This is the wrong password - please try again...");
                    }
                });



              //vm.show_temp_login = true;

          }

          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            // //console.log("REMOVE: ", j);
            // //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            MedicalService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        // //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.medical_images = [];
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
                    vm.medical_images.push(files[i].file);
                }
               
            }



            $scope.delete_medical = function(id){

              
                var a = prompt("Are you sure you wish to delete this medical? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){


                    //console.log("WE DELETE IT");


                    MedicalService.Delete(vm.user.id, id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.user_medicals = $.grep(vm.user_medicals, function(e){ 
                                    return e.id != id; 
                                });
                                
                                //refresh?
                                $state.reload();
                                $state.go('dashboard.my_account.medical');

                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });



                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_medical = function(isValid){

                vm.show_loading = true;

                if(vm.medical_images.length < 1 && vm.medical.images.length < 1){

                    $(".drop").focus();
                    alert("You must at least have 1 image of your medical!");

                    vm.show_loading = false;
                    return false;   
                }


                if(!vm.medical.state_of_issue){
                    $("#state_of_issue").focus();
                    alert("You must select a medical state of issue");
                    vm.show_loading = false;
                    return false;
                }


                if(vm.medical.components.length < 1){

                    $("#components").focus();
                    alert("You must at least have 1 component!");
                    vm.show_loading = false;
                    return false;   
                }

                //console.log("FLOW: ", vm.medical_images);



                //compile the required elements YAY

                //console.log("LICENCE GOOD TO GO ", vm.medical);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    for(var i=0;i<vm.medical.images.length;i++){
                        delete vm.medical.images[i].data_uri;
                    }

                    // vm.medical.images = vm.medical_images;
                    vm.medical.images = vm.medical.images.concat(vm.medical_images);
                    vm.medical.authority_id = vm.medical.state_of_issue.id;
                    vm.medical.user_id = vm.user.id;

                    delete vm.medical.medical_type;
                    delete vm.medical.state_of_issue;


                if(vm.medical.id){
                    //then its an udpate

                    //merge the images left?
                    MedicalService.Update(vm.medical)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", vm.medical);
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.go('dashboard.my_account.medical', {}, { reload: true });

                                vm.show_loading = false;




                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);
                                vm.show_loading = false;

                            }

                        });

                } else {


                   


                    //then its a create
                    //console.log(vm.medical);

                    MedicalService.Create(vm.medical)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", vm.medical);
                                //console.log("HUZZAH", data);
                                vm.show_loading = false;
                                //then we need to remove this from the list of files...
                                $state.go('dashboard.my_account.medical', {}, { reload: true });
                                
                                //move somewhere?
                               // $state.reload();
                               // $state.go('dashboard.my_account.medical', {}, { reload: true });


                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);
                                vm.show_loading = false;

                            }

                        });


                }



            };



        
        


    }