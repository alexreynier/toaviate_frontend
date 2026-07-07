app.controller('RegisterController', RegisterController);
 
    RegisterController.$inject = ['UserService', '$location', '$rootScope', 'FlashService', '$stateParams', 'ToastService', '$scope', 'SignupDraftService', 'PasswordPolicyService'];
    function RegisterController(UserService, $location, $rootScope, FlashService, $stateParams, ToastService, $scope, SignupDraftService, PasswordPolicyService) {
        var vm = this;
        vm.verify_status = "";

        vm.register = register;

        // ── Refresh robustness: auto-save a sanitised draft (never the
        // password) so an accidental refresh doesn't wipe the form. ──
        var DRAFT_KEY = 'register';
        var draft = SignupDraftService.Load(DRAFT_KEY);
        if (draft && draft.user) {
            vm.user = angular.extend({}, draft.user, vm.user);
        }
        SignupDraftService.Watch($scope, DRAFT_KEY, function () {
            return { user: vm.user };
        });

        function register() {
            if (vm.dataLoading) { return; }
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
            var pwMessage = PasswordPolicyService.Message(vm.user.password);
            if (pwMessage) {
                ToastService.highlightField('password');
                ToastService.warning('Password Not Strong Enough', pwMessage);
                return;
            }

            vm.dataLoading = true;
            UserService.Create(vm.user)
                .then(function (response) {
                    if (response.success) {
                        SignupDraftService.Clear(DRAFT_KEY);
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