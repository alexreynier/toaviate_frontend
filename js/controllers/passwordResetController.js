 app.controller('PasswordResetController', PasswordResetController);

    PasswordResetController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'PoidService',  'LicenceService', 'MedicalService', 'DifferencesService', 'AuthenticationService', 'ToastService'];
    function PasswordResetController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, PoidService,  LicenceService, MedicalService, DifferencesService, AuthenticationService, ToastService) {
        var vm = this;

       
        vm.show_error = false;
        vm.show_error2 = false;

        vm.show_thankyou = false;

        $scope.password_reset = function(){

            if (!vm.email || vm.email.trim() === '') {
                ToastService.highlightField('reset_email');
                ToastService.warning('Email Required', 'Please enter your email address.');
                return false;
            }

            if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(vm.email)){

                  AuthenticationService.ResetPassword(vm.email, function(data){
                        ////console.log(data);
                        vm.show_thankyou = true;
                        vm.show_error = false;

                    });

            } else {

                ToastService.highlightField('reset_email');
                ToastService.warning('Invalid Email', 'Please enter a valid email address.');
                vm.show_error = true;

            }

          
        }

        $scope.go_login = function(){
            $location.path("/login");
        }

        $scope.password_reset2 = function(){

            if(!vm.password || vm.password === ""){
                ToastService.highlightField('new_password');
                ToastService.warning('Password Required', 'Please enter a new password.');
                vm.show_error = true;
                return false;
            }

            if(vm.password.length < 8){
                ToastService.highlightField('new_password');
                ToastService.warning('Password Too Short', 'Your password must be at least 8 characters.');
                vm.show_error2 = true;
                return false;
            }

            var strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')
            if(strongPassword.test(vm.password)) {
              //console.log("password strength OK");
            } else {
              ToastService.highlightField('new_password');
              vm.show_error = true;
              ToastService.warning('Weak Password', 'Your password must be at least 8 characters in length, contain 1 uppercase, 1 lowercase, 1 number, and 1 special character');
              return false;
            }

                AuthenticationService.ResetPassword2(vm.password, $stateParams.token, function(data){
                        ////console.log(data);
                        vm.show_thankyou = true;
                        vm.show_error = false;
                        vm.show_error2 = false;

                        vm.thank_you = data.message;


                    });

        }

    

         


    }