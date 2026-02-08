app.controller('LoginController', LoginController);
 
    LoginController.$inject = ['$location', 'AuthenticationService', 'FlashService'];
    function LoginController($location, AuthenticationService, FlashService) {
        var vm = this;
 
        vm.login = login;

        vm.login_session;
        vm.login_key;
 
        (function initController() {
            // reset login status
            //AuthenticationService.ClearCredentials();
            var check = AuthenticationService.CheckLoggedIn();
            if(check){
                $location.path('/dashboard');
            } else {
                AuthenticationService.ClearCredentials();
            }


            AuthenticationService.Login0( function (response) {
                if (response.success) {
                    // //console.log("HELLO success", response.login_session);
                    // AuthenticationService.SetCredentials(vm.email, vm.password, response.user, response.session);
                    // setTimeout(function(){
                    //     $location.path('/dashboard');
                    // }, 20);

                    vm.login_session = response.login_session;

                } else {
                    // //console.log("HELLO FAIL", response);
                    //FlashService.Error(response.error);
                    // vm.error = response.error;
                    // vm.dataLoading = false;
                }
            });


            // AuthenticationService.Login1("thisisuser", "session", function (response) {
            //     if (response.success) {
            //         //console.log("HELLO success", response);
            //         // AuthenticationService.SetCredentials(vm.email, vm.password, response.user, response.session);
            //         // setTimeout(function(){
            //         //     $location.path('/dashboard');
            //         // }, 20);
            //     } else {
            //         //console.log("HELLO FAIL", response);
            //         //FlashService.Error(response.error);
            //         // vm.error = response.error;
            //         // vm.dataLoading = false;
            //     }
            // });






        })();



       
 
        function login() {

            vm.dataLoading = true;

            AuthenticationService.Login1(vm.email, vm.login_session, function (response) {
                if (response.success) {
                    // //console.log("HELLO success", response);
                    // AuthenticationService.SetCredentials(vm.email, vm.password, response.user, response.session);
                    // setTimeout(function(){
                    //     $location.path('/dashboard');
                    // }, 20);

                    var login_key = response.login_key;


                    //if success --> THEN we do the next bit
                    AuthenticationService.Login2(vm.password, login_key, function (response) {
                    if (response.success) {
                        // //console.log("HELLO success", response);
                        // AuthenticationService.SetCredentials(vm.email, vm.password, response.user, response.session);
                        // setTimeout(function(){
                        //     $location.path('/dashboard');
                        // }, 20);


                        //if success --> THEN we do the next bit

                        AuthenticationService.SetCredentials2(vm.email, vm.password, response.user, response.session, function(response){
                            // //console.log("TWO :: ", response);
                             // setTimeout(function(){
                                 if(response && (response.access.instructor.length > 0 || response.access.manager.length > 0)){
                                     $location.path('/dashboard');
                                 } else {
                                     $location.path('/dashboard/my_account');
                                 }

                                
                            // }, 20);
                        });
                       







                    } else {
                        // //console.log("HELLO FAIL", response);
                        //FlashService.Error(response.error);
                        // vm.error = response.error;
                        // vm.dataLoading = false;
                        vm.error = response.error;
                        vm.dataLoading = false;
                    }
                });








                } else {
                    // //console.log("HELLO FAIL", response);
                    //FlashService.Error(response.error);
                    // vm.error = response.error;
                    // vm.dataLoading = false;
                    vm.error = response.error;
                    vm.dataLoading = false;
                }
            });








            // vm.dataLoading = true;
            // AuthenticationService.Login(vm.email, vm.password, function (response) {
            //     if (response.success) {
            //         AuthenticationService.SetCredentials(vm.email, vm.password, response.user, response.session);
            //         setTimeout(function(){
            //             $location.path('/dashboard');
            //         }, 20);
            //     } else {
            //         //FlashService.Error(response.error);
            //         vm.error = response.error;
            //         vm.dataLoading = false;
            //     }
            // });
        };

        function logout(){
            // reset login status
            AuthenticationService.ClearCredentials();
        }


    }