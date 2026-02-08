 app.controller('ManageDifferencesController', ManageDifferencesController);

    ManageDifferencesController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'DifferencesService'];
    function ManageDifferencesController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, DifferencesService) {
        
        var vm = this;

         DifferencesService.GetDifferences()
                .then(function (data) {
                    // //console.log(data);
                        vm.all_differences = data;
                });

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

          DifferencesService.GetByUserId(vm.user.id)
                .then(function (data) {
                        var diff = data.differences.differences;
                        for(var i=0;i<diff.length;i++){
                            if(diff[i].sign_off_date == "0000-00-00"){
                               delete diff[i].sign_off_date;
                            }
                            diff[i].sign_off_date = new Date(diff[i].sign_off_date);
                            diff[i].day = (diff[i].day == 1)? true : false;
                            diff[i].night = (diff[i].night == 1)? true : false;
                            diff[i].vfr = (diff[i].vfr == 1)? true : false;
                            diff[i].ifr = (diff[i].ifr == 1)? true : false;
                        }
                        data.differences.differences = diff;
                        vm.differences = data.differences;
                        // //console.log("GET DIFFS", vm.differences);
                        clean_differences_list();

                });

        vm.differences = {
            images: [],
            differences: [],
            user_id: vm.user.id
        };

        vm.differences_images = [];
        

        function clean_differences_list(){
            // //console.log("HIT");
            if(vm.differences.differences.length > 0){
                // //console.log("got > 0 diffs");
                 for(var i=0;i<vm.differences.differences.length;i++){
                    // //console.log("i : ", i);
                    vm.all_differences = $.grep(vm.all_differences, function(el){ 
                        return el.id != vm.differences.differences[i].differences_id; 
                    });

                 }
                 
            }

           
        }



         $scope.add_differences = function(){

                //remove from first array
                if(vm.selected_differences){
                    vm.all_differences = $.grep(vm.all_differences, function(el){ 
                        return el.id != vm.selected_differences.id; 
                    });

                    vm.selected_differences.day = true;
                    vm.selected_differences.vfr = true;


                    vm.differences.differences.push(vm.selected_differences);

                    //clear selected
                    delete vm.selected_differences;
                }
                
                
                //clean the array to show what we want to show :)
                //delete $scope.formData.license.add_to[bit_type];

            }

            $scope.remove_differences = function(index){

                //add to dropdown
                vm.all_differences.push(vm.differences.differences[index]);
                vm.differences.differences.splice(index,1)

                //$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);

                //  //console.log($scope.formData.license[bit_type]);
                //  $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
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

           

           $scope.remove_real_file = function(file){

                //remove_file

                vm.differences.images = $.grep(vm.differences.images, function(e){ 
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
                    //console.log(data);
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
                    vm.differences_images.push(files[i].file);
                }

                //    for(var i=0; i<files.length; i++){
                //     // //console.log("JSON", files[i].file_return);
                //     var j = JSON.parse(files[i].file_return);
                //     // //console.log("PARSED", j);
                //     files[i].file.temp_path = j.saved_url;
                //     // //console.log("file", files[i].file);
                //     vm.poid_images.push(files[i].file);
                // }

               
            }

        
        $scope.save_differences = function(){


                if(vm.differences_images.length < 1 && vm.differences.images.length < 1){

                    $(".drop").focus();
                    alert("You must at least have 1 image of the differences page of your log book!");

                    return false;   
                }


                if(vm.differences.differences.length < 1){

                    $("#differences").focus();
                    alert("You must at least have 1 differences to be able to save the image(s) above!");
                    
                    return false;   
                }




                //compile the required elements YAY

                // //console.log("differences GOOD TO GO ", vm.differences);


                 //clean shizzle before sending
                 //why keep sending back heavy data?


                    for(var i=0;i<vm.differences.images.length;i++){
                        delete vm.differences.images[i].data_uri;
                    }
                    vm.differences.user_id = vm.user.id;
                    vm.differences.images = vm.differences.images.concat(vm.differences_images);

                    // vm.licence.images = vm.licence_images;
                   

                    
                    //then its an udpate
                    //merge the images left?
                    DifferencesService.Update(vm.differences)
                        .then(function (data) {
                            // //console.log(data);
                            if(data.success){
                               
                                alert("Differences Saved!");
                                $state.go('dashboard.my_account', {}, { reload: true });


                            } else {

                                alert("Something went terribly wrong... \n\n "+data.message);

                            }
                        });


            };

    }