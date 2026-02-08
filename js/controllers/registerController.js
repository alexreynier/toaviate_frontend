app.controller('RegisterController', RegisterController);
 
    RegisterController.$inject = ['UserService', '$location', '$rootScope', 'FlashService', '$stateParams'];
    function RegisterController(UserService, $location, $rootScope, FlashService, $stateParams) {
        var vm = this;
        vm.verify_status = "";
 
        vm.register = register;
 
        function register() {
            vm.dataLoading = true;
            UserService.Create(vm.user)
                .then(function (response) {
                    if (response.success) {
                        FlashService.Success('Registration successful', true);
                        $location.path('/registration_success');
                    } else {
                        FlashService.Error(response.error);
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