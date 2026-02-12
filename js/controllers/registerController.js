app.controller('RegisterController', RegisterController);
 
    RegisterController.$inject = ['UserService', '$location', '$rootScope', 'FlashService', '$stateParams', 'ToastService'];
    function RegisterController(UserService, $location, $rootScope, FlashService, $stateParams, ToastService) {
        var vm = this;
        vm.verify_status = "";
 
        vm.register = register;
 
        function register() {
            // ── Pre-submit validation with highlight + scroll ──
            if (!vm.user || !vm.user.first_name || vm.user.first_name.trim() === '') {
                ToastService.highlightField('first_name');
                ToastService.warning('First Name Required', 'Please enter your first name.');
                return;
            }
            if (!vm.user.last_name || vm.user.last_name.trim() === '') {
                ToastService.highlightField('last_name');
                ToastService.warning('Last Name Required', 'Please enter your last name.');
                return;
            }
            if (!vm.user.email || vm.user.email.trim() === '') {
                ToastService.highlightField('email');
                ToastService.warning('Email Required', 'Please enter your email address.');
                return;
            }
            if (!vm.user.password || vm.user.password === '') {
                ToastService.highlightField('password');
                ToastService.warning('Password Required', 'Please enter a password.');
                return;
            }
            var strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})');
            if (!strongPassword.test(vm.user.password)) {
                ToastService.highlightField('password');
                ToastService.warning('Weak Password', 'Your password must be at least 8 characters, containing 1 uppercase, 1 lowercase, 1 number, and 1 special character.');
                return;
            }

            vm.dataLoading = true;
            UserService.Create(vm.user)
                .then(function (response) {
                    if (response.success) {
                        ToastService.success('Registration Successful', 'Please check your email to verify your account.');
                        $location.path('/registration_success');
                    } else {
                        ToastService.error('Registration Failed', response.error || 'Something went wrong. Please try again.');
                        vm.dataLoading = false;
                    }
                });
        }


        if($stateParams.token && $stateParams.userId){

            //console.log("THIS IS A VERIFY TOKEN");

             UserService.Verify($stateParams.userId, $stateParams.token)
                .then(function (response) {
                    if (response.success) {
                        vm.title = "Thank You!";
                        vm.verify_status = "Your email address has been verified.";
                    } else {
                        vm.title = "Sorry!";
                        vm.verify_status = "Sorry - something went wrong here! Please try clicking the link your email again. Should this still be a problem, please contact support.";
                    }
                });

        }            


           


    







    }