app.controller('LoginController', LoginController);
 
    LoginController.$inject = ['$location', 'AuthenticationService', 'FlashService', '$timeout', 'ToastService'];
    function LoginController($location, AuthenticationService, FlashService, $timeout, ToastService) {
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
                    vm.error = response.error || 'Unable to initialise login. Please refresh the page.';
                    vm.dataLoading = false;
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

            // ── Pre-submit validation with highlight + scroll ──
            if (!vm.email || vm.email.trim() === '') {
                ToastService.highlightField('email');
                ToastService.warning('Email Required', 'Please enter your email address.');
                return;
            }
            if (!vm.password || vm.password === '') {
                ToastService.highlightField('password');
                ToastService.warning('Password Required', 'Please enter your password.');
                return;
            }

            vm.dataLoading = true;
            vm.error = null;

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

                        // Timeout fallback: if SetCredentials2 takes too long (e.g., API hanging),
                        // redirect to dashboard anyway after 10 seconds
                        var loginTimeoutFired = false;
                        var loginTimeout = $timeout(function() {
                            if (!loginTimeoutFired) {
                                loginTimeoutFired = true;
                                console.warn('Login timeout - proceeding to dashboard');
                                $location.path('/dashboard');
                            }
                        }, 10000);

                        AuthenticationService.SetCredentials2(vm.email, vm.password, response.user, response.session, function(response){
                            // Cancel the timeout since callback completed
                            if (loginTimeout) {
                                $timeout.cancel(loginTimeout);
                            }
                            if (loginTimeoutFired) {
                                // Timeout already fired, don't redirect again
                                return;
                            }
                            loginTimeoutFired = true;

                            // //console.log("TWO :: ", response);
                             // setTimeout(function(){

                                 // Check for a stored return URL from a prior auto-logout
                                 var returnUrl = null;
                                 try { returnUrl = localStorage.getItem('toaviate_return_url'); } catch(e) {}
                                 if (returnUrl) {
                                     try { localStorage.removeItem('toaviate_return_url'); } catch(e) {}
                                     // Wait for credentials/session to fully propagate before navigating
                                     $timeout(function(){
                                         $location.path(returnUrl);
                                     }, 1000);
                                 } else if(response && response.access && (response.access.instructor.length > 0 || response.access.manager.length > 0)){
                                     $location.path('/dashboard');
                                 } else if(response) {
                                     $location.path('/dashboard/my_account');
                                 } else {
                                     vm.error = 'Login succeeded but we could not load your access level. Please try again.';
                                     vm.dataLoading = false;
                                 }

                                
                            // }, 20);
                        });
                       







                    } else {
                        ToastService.highlightField('password');
                        ToastService.error('Login Failed', response.error || 'Invalid password. Please try again.');
                        vm.error = response.error;
                        vm.dataLoading = false;
                    }
                });








                } else if (response.error === "The login session has expired - please try again") {
                    // Session expired — refresh login0 and retry automatically
                    AuthenticationService.Login0(function (login0Response) {
                        if (login0Response.success) {
                            vm.login_session = login0Response.login_session;
                            // Retry login1 with the fresh session
                            login();
                        } else {
                            vm.error = login0Response.error || 'Unable to refresh login session. Please refresh the page.';
                            vm.dataLoading = false;
                        }
                    });
                } else {
                    ToastService.highlightField('email');
                    ToastService.error('Login Failed', response.error || 'Email not recognised. Please check and try again.');
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