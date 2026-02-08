 app.controller('ManageAccountController', ManageAccountController);

    ManageAccountController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'PaymentService'];
    function ManageAccountController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, PaymentService) {
        
        var vm = this;
        vm.user = $rootScope.globals.currentUser;
        //vm.user_id = vm.user.id;
        vm.avatar = "";
        vm.address = "Please choose address...";
        vm.user.address_line1 = "Please choose";
        vm.addresses = {};
        vm.show_addresses = false;
        vm.show_address = false;
        vm.show_search = false;


        UserService.GetById(vm.user.id)
                .then(function (data) {
                    if(data.success){
                        data.user.dob = new Date(data.user.dob);
                        vm.user = data.user;

                        if(vm.user.address_line1 !== ""){
                            vm.show_address = true;
                            vm.show_search = false;
                            vm.show_addresses = false;
                        }

                        // //console.log("NOK", vm.user);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }
                });


        $scope.processFiles = function(files){

            for(var i=0; i<files.length; i++){
                // //console.log("JSON", files[i].file_return);
                var j = JSON.parse(files[i].file_return);
                // //console.log("PARSED", j);
                files[i].file.temp_path = j.saved_url;
                // //console.log("file", files[i].file);
                vm.avatar = files[i].file;
                vm.user.avatar = vm.avatar.temp_path;
                vm.user.update_avatar = true;
                // //console.log(vm.avatar);
            }
           
        }


        $scope.show_form = function(){
            // //console.log("show form");
            vm.show_address = true;
        }

        $scope.set_address = function(){
            // //console.log("set address");

            vm.user.address_line1 = vm.address.line1;
            vm.user.address_line2 = vm.address.line2;
            vm.user.address_line3 = vm.address.line3;
            vm.user.address_line4 = vm.address.line4;
            vm.user.address_postcode = vm.address.postcode;
            vm.user.address_locality = vm.address.locality;
            vm.user.address_city = vm.address.city;
            vm.user.address_county = vm.address.county;
            vm.user.address_country = vm.address.country;

            vm.show_address = true;

        }

        $scope.get_addresses = function(){

            vm.address = {};

            //  trial key
            //  auth: api-key: BP-8KOdw8ka3F2eDU-Zz-g5865   
            //  https://api.getAddress.io/v2/uk/{postcode}
            // PaymentService.getAddress()

            PaymentService.GetAddresses(vm.postcode)
                .then(function (data) {
                    if(data.success){

                        // //console.log("addresses: "+data.addresses);
                        vm.addresses = data.addresses;

                        if(vm.addresses && vm.addresses.length > 0){
                            vm.show_addresses = true;
                        } else {
                            alert("We couldn't find your address from your postcode, please enter it manually")
                            vm.show_addresses = false;
                            vm.show_address = true;
                        }
                        //fill the drop down menu

                    } else {
                        // //console.log("WOOOPSIES...");
                        //this should be very very rare...
                        alert("We couldn't find your address from your postcode, please enter it manually")
                        vm.show_addresses = false;
                        vm.show_address = true;

                    }
                });



        }



        
        $scope.save_user = function(valid){

            // //console.log("VALID", valid);

            if(valid){
                //now let's double check the content of the form


                //avatar - not required --> check if updated
                //above not required i don't think
                if(!vm.user.update_avatar){
                    delete vm.user.avatar;
                }

                //phone number
                if(!vm.user.phone_number || vm.user.phone_number == ""){
                    alert("Please enter a mobile phone number");
                    return false;
                }

                //updated_password
                if(vm.user.new_password){
                    if(vm.user.new_password !== vm.user.new_password2){
                        alert("Please ensure your updated passwords match");
                        return false;
                    } else {


                          //lets add complexity here :-)
                           var strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')
                            if(strongPassword.test(vm.user.new_password)) {
                              //console.log("password strength OK");
                            } else {
                              vm.show_error = true;
                              alert("Your password must be at least 8 characters in length, contain 1 uppercase, 1 lowercase, 1 number, and 1 special character");
                              return false;
                            }


                       // if(vm.user.new_password.length > 7){
                       //      //at the moment this will suffice!
                       //      // //console.log("Password basic tests are OK to send!")


                       // } else {
                       //      alert("Password must be at least 8 characters");
                       //      return false;
                       // }

                    }
                }





                //current password to save changes
                if(!vm.user.password){
                    alert("Please enter your current password to ensure that these changes are made by you.");
                    return false;
                }


                //if we get here then at least we know to a certain degree that everything is working as we expect.
                 UserService.Update(vm.user)
                    .then(function (data) {
                        if(data.success){
                            alert("Changes updated successfully.");
                            $state.go('dashboard.my_account', {}, { reload: true });

                        } else {
                            if(data.message == "Password entered failed"){
                                alert("The password entered was incorrect");
                            } else {
                                alert("something horrible happened!");
                            }
                            //this should be very very rare...
                        }
                    });



            } else {

                // //console.log("something went wrong here...");

            }


        }
        
        


    }