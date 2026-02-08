 app.controller('ManageLicenceController', ManageLicenceController);

    ManageLicenceController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'AuthenticationService'];
    function ManageLicenceController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, LicenceService, AuthenticationService) {
        
        var vm = this;
        vm.licence_images = [];
        vm.licence = {
                images: [],
                ratings: []
        };

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        LicenceService.GetLicenceTypes()
                .then(function (data) {
                    vm.licence_types = data;
                    // //console.log("licence_types: ", vm.licence_types);
                });

        LicenceService.GetRatings()
            .then(function (data) {
                vm.ratings = data;
                // //console.log("ratings: ", vm.ratings);

                if($state.current.data.action == "add"){

                    vm.selected_rating = $.grep(vm.ratings, function(e){ return e.id == 7; })[0];
                    $scope.add_rating();

                    // for(var i=0;i<vm.ratings.length; i++){
                    //     //console.log("LOOP", vm.ratings[i]);
                    //     if(vm.ratings[i].id == 7){
                    //         vm.selected_rating = vm.ratings[i];
                    //         //console.log("FOUND", vm.selected_rating);
                    //         $scope.add_rating();
                    //         break;
                    //     }
                    // }
                }
               


            });

        LicenceService.GetAuthority()
            .then(function (data) {
                vm.authority = data;
                // //console.log("authority: ", vm.authority);
            });


        switch($state.current.data.action){
            case "add":

                    //vm.selected_rating = vm.ratings[0];
                    //vm.selected_rating = 
                    

                    // //console.log("AA", vm.selected_rating);

            

            break;
            case "edit":

            // //console.log("EDIT ONE");
            // //console.log("PARAMS: ", $stateParams);

             LicenceService.GetById($stateParams.licence_id, 1, 0)
                .then(function (data) {
                    if(data.success){
                        vm.licence = data.licence;
                        vm.licence.licence_issue_date = new Date(vm.licence.licence_issue_date);
                        vm.licence.licence_expiry_date = new Date(vm.licence.licence_expiry_date);
                        // //console.log("licence", vm.licence);

                        vm.licence.licence_type = $.grep(vm.licence_types, function(e){ return e.id == vm.licence.licence_id; })[0];
                        vm.licence.state_of_issue = $.grep(vm.authority, function(e){ return e.id == vm.licence.authority_id; })[0];
                        // //console.log("SET", vm.licence.state_of_issue);

                        //pre-selection bits?
                        // //console.log("NEW RATINGS", vm.licence.ratings);
                        for(var i=0;i<vm.licence.ratings.length;i++){
                            delete vm.licence.ratings[i].id;
                            vm.licence.ratings[i].id = vm.licence.ratings[i].rating_id;
                            delete vm.licence.ratings[i].rating_id;
                            vm.licence.ratings[i].test_date = new Date(vm.licence.ratings[i].test_date);
                            vm.licence.ratings[i].expiry_date = new Date(vm.licence.ratings[i].expiry_date);

                            //need to remove the rating from the ratings lists too :)
                            vm.ratings = $.grep(vm.ratings, function(e){ 
                                return e.id != vm.licence.ratings[i].id; 
                            });

                        }



                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                // //console.log("LIST ALL");

                 //1 get the user's licence...
                 //list stuff

                LicenceService.GetByUserId(vm.user.id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        vm.user_licences = data.licences;

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



            $scope.add_rating = function(){

                //remove from first array
                vm.ratings = $.grep(vm.ratings, function(e){ 
                    return e.id != vm.selected_rating.id; 
                });

                vm.licence.ratings.push(vm.selected_rating);

                //clear selected
                delete vm.selected_rating;
                
                //clean the array to show what we want to show :)
                //delete $scope.formData.license.add_to[bit_type];

            }

            $scope.remove_rating = function(index){

                //add to dropdown
                vm.ratings.push(vm.licence.ratings[index]);
                vm.licence.ratings.splice(index,1)

                //$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);

                //  //console.log($scope.formData.license[bit_type]);
                //  $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }

            //default add the first rating required...
            



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

                vm.licence.images = $.grep(vm.licence.images, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            // //console.log("REMOVE: ", j);
            // //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            LicenceService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        // //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.licence_images = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        // //console.log("WOOOPSIES...");
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
                    vm.licence_images.push(files[i].file);
                }
               
            }



            $scope.delete_licence = function(id){


                var a = prompt("Are you sure you wish to delete this licence? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){
                    // //console.log("WE DELETE IT");


                    LicenceService.Delete(vm.user.id, id)
                        .then(function (data) {
                            // //console.log(data);
                            if(data.success){
                                // //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.user_licences = $.grep(vm.user_licences, function(e){ 
                                    return e.id != id; 
                                });
                                
                                //refresh?
                                $state.reload();
                                $state.go('dashboard.my_account.licence');

                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });



                } else {
                    //console.log("ignore");
                }


            }




            vm.show_loading = false;
            vm.blurred = true;
            vm.show_temp_login = false;

              $scope.getDecrypted = function(){
                  vm.show_loading = true;
                  // LicenceService.GetById($stateParams.licence_id, 1, 1)
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




                  LicenceService.GetById($stateParams.licence_id, 1, 1)
                    .then(function (data) {
                        if(data.success){
                            vm.licence = data.licence;
                            vm.licence.licence_issue_date = new Date(vm.licence.licence_issue_date);
                            vm.licence.licence_expiry_date = new Date(vm.licence.licence_expiry_date);
                            // //console.log("licence", vm.licence);

                            vm.licence.licence_type = $.grep(vm.licence_types, function(e){ return e.id == vm.licence.licence_id; })[0];
                            vm.licence.state_of_issue = $.grep(vm.authority, function(e){ return e.id == vm.licence.authority_id; })[0];
                            // //console.log("SET", vm.licence.state_of_issue);

                            //pre-selection bits?
                            // //console.log("NEW RATINGS", vm.licence.ratings);
                            for(var i=0;i<vm.licence.ratings.length;i++){
                                delete vm.licence.ratings[i].id;
                                vm.licence.ratings[i].id = vm.licence.ratings[i].rating_id;
                                delete vm.licence.ratings[i].rating_id;
                                vm.licence.ratings[i].test_date = new Date(vm.licence.ratings[i].test_date);
                                vm.licence.ratings[i].expiry_date = new Date(vm.licence.ratings[i].expiry_date);

                                //need to remove the rating from the ratings lists too :)
                                vm.ratings = $.grep(vm.ratings, function(e){ 
                                    return e.id != vm.licence.ratings[i].id; 
                                });

                            }

                            vm.show_loading = false;
                            vm.blurred = false;

                        } else {

                                if(data.fail == "templogin"){
                                    // //console.log("WOOOPSIES...", data);
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
                                alert("This is the wrong password - please try again...");
                            }
                        });



                      //vm.show_temp_login = true;

                  }



            $scope.save_licence = function(isValid){
                vm.show_loading = true;

                if(vm.licence_images.length < 1 && vm.licence.images.length < 1){

                    $(".drop").focus();
                    alert("You must at least have 1 image of your licence!");

                    return false;   
                }


                if(!vm.licence.licence_type){
                    $("#licence_type").focus();
                    alert("You must select a licence type");

                    return false;
                }


                if(!vm.licence.state_of_issue){
                    $("#state_of_issue").focus();
                    alert("You must select a licence state of issue");

                    return false;
                }


                if(vm.licence.ratings.length < 1){

                    $("#ratings").focus();
                    alert("You must at least have 1 rating!");
                    
                    return false;   
                }

                // //console.log("FLOW: ", vm.licence_images);



                //compile the required elements YAY

                // //console.log("LICENCE GOOD TO GO ", vm.licence);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    for(var i=0;i<vm.licence.images.length;i++){
                        delete vm.licence.images[i].data_uri;
                    }

                    // vm.licence.images = vm.licence_images;
                    vm.licence.images = vm.licence.images.concat(vm.licence_images);

                    vm.licence.licence_id = vm.licence.licence_type.id;
                    vm.licence.authority_id = vm.licence.state_of_issue.id;
                    vm.licence.user_id = vm.user.id;

                    delete vm.licence.licence_type;
                    delete vm.licence.state_of_issue;


                if(vm.licence.id){
                    //then its an udpate

                    //merge the images left?
                    LicenceService.Update(vm.licence)
                        .then(function (data) {
                            // //console.log(data);
                            if(data.success){
                                // //console.log("HUZZAH", vm.licence);
                                // //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.go('dashboard.my_account.licence', {}, { reload: true });

                                vm.show_loading = false;




                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);
                                vm.show_loading = false;

                            }

                        });

                } else {


                   


                    //then its a create
                    // //console.log(vm.licence);

                    LicenceService.Create(vm.licence)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                // //console.log("HUZZAH", vm.licence);
                                // //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.reload();
                                vm.show_loading = false;
                                $state.go('dashboard.my_account.licence', {}, { reload: true });


                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);
                                vm.show_loading = false;

                            }

                        });


                }



            };


        
        


    }