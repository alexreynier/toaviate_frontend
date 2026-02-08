 app.controller('AddLicenceController', AddLicenceController);

    AddLicenceController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService'];
    function AddLicenceController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, LicenceService) {
        
        var vm = this;
        vm.licence_images = [];
        vm.licence = {
                images: [],
                ratings: []
        };
        //vm.user_id = 59;

        // //console.log("THIS GETS CALLED ALEX");

        LicenceService.GetLicenceTypes()
                .then(function (data) {
                    vm.licence_types = data;
                    // //console.log("licence_types: ", vm.licence_types);
                });

        LicenceService.GetRatings()
            .then(function (data) {
                vm.ratings = data;
                // //console.log("ratings: ", vm.ratings);
                    // //console.log("THIS GETS EXECUTED");
                    //got to set this as we're only adding here
                    for(var i=0;i<vm.ratings.length; i++){
                        // //console.log("LOOP", vm.ratings[i]);
                        if(vm.ratings[i].id == 7){
                            vm.selected_rating = vm.ratings[i];
                            // //console.log("FOUND", vm.selected_rating);
                            $scope.add_rating();
                            break;
                        }
                    }
            });

        LicenceService.GetAuthority()
            .then(function (data) {
                vm.authority = data;
                // //console.log("authority: ", vm.authority);
            });




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

            }


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








            $scope.save_licence = function(isValid){

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

                if(vm.licence.id){
                    //then its an udpate

                    //merge the images left?


                } else {


                    //clean shizzle before sending
                    vm.licence.images = vm.licence_images;
                    vm.licence.licence_id = vm.licence.licence_type.id;
                    vm.licence.authority_id = vm.licence.state_of_issue.id;
                    vm.licence.user_id = vm.user_id;

                    delete vm.licence.licence_type;
                    delete vm.licence.state_of_issue;


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





                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }

                        });


                }



            };


        
        


    }