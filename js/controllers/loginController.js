app.controller('LoginController', LoginController);
 
    LoginController.$inject = ['$location', 'AuthenticationService', 'FlashService', '$timeout', 'ToastService', '$rootScope', 'authGate', 'WebauthnService'];
    function LoginController($location, AuthenticationService, FlashService, $timeout, ToastService, $rootScope, authGate, WebauthnService) {
        var vm = this;

        vm.login = login;

        vm.login_session;
        vm.login_key;

        // ── Two-factor step (shown when login2 returns two_factor_required) ──
        vm.stage = 'password';            // 'password' | 'code'
        vm.two_factor_token = null;       // 64-char token from login2 — 5 min / 6 attempts
        vm.code = '';
        vm.codeType = 'totp';             // 'totp' | 'recovery'
        vm.attemptsRemaining = null;
        vm.submitCode = submitCode;
        vm.toggleRecovery = toggleRecovery;
        vm.backToPassword = backToPassword;

        // ── Passkey (biometric) sign-in ──
        vm.passkeySupported = WebauthnService.isSupported();
        vm.passkeyLoading = false;
        vm.passkeyLogin = passkeyLogin;

        (function initController() {
            // If the user is already logged in (e.g. they pressed Back and landed
            // on /login), DON'T clear their credentials — just send them on to
            // where they belong. We check the live session directly via
            // currentUser.id (the same check used by the route guard in app.js)
            // because AuthenticationService.CheckLoggedIn() compares objects with
            // == (reference compare → effectively always false) and would wrongly
            // log a valid user out here.
            //
            // BUT only bounce to the dashboard when the session is genuinely
            // active. If the interceptor has flagged the session as expired
            // (authGate), the stored currentUser is stale — stay on /login and
            // let them re-authenticate, otherwise we'd bounce straight back into
            // the dashboard's 401 storm.
            var loggedInUser = $rootScope.globals && $rootScope.globals.currentUser;
            if (loggedInUser && loggedInUser.id && !authGate.isExpired()) {
                if (loggedInUser.access && ((loggedInUser.access.instructor && loggedInUser.access.instructor.length > 0) ||
                                            (loggedInUser.access.manager && loggedInUser.access.manager.length > 0))) {
                    $location.path('/dashboard');
                } else {
                    $location.path('/dashboard/my_account');
                }
                return;
            }

            // Genuinely logged out — reset any stale login status.
            AuthenticationService.ClearCredentials();


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

                        if (response.two_factor_required) {
                            // Shape C — 2FA is enabled on this account, so there is
                            // NO session yet. Pivot to the code screen; the token is
                            // valid for 5 minutes / 6 attempts.
                            vm.two_factor_token = response.two_factor_token;
                            vm.methods = response.methods || ['totp'];
                            vm.codeType = 'totp';
                            vm.code = '';
                            vm.attemptsRemaining = null;
                            vm.error = null;
                            vm.stage = 'code';
                            vm.dataLoading = false;
                            $timeout(function () {
                                var el = document.getElementById('two_factor_code');
                                if (el) { el.focus(); }
                            }, 100);
                            return;
                        }

                        completeLogin(response);

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

        // ── Shared completion for all three entry paths (password, 2FA code,
        //    passkey). `response` is the login2 shape {success, user, session},
        //    optionally with two_factor_setup_required / recovery_codes_remaining. ──
        function completeLogin(response) {

            // Soft enforcement (shape B): the club requires 2FA and the user has
            // neither TOTP nor a passkey. The session IS valid — persist a flag
            // (read by the route guard in app.js and cleared by the Security page
            // once enrolment finishes) and land them on the enrolment page.
            var setupRequired = !!response.two_factor_setup_required;
            if (setupRequired) {
                try { localStorage.setItem('toaviate_2fa_setup_required', String(response.user.id)); } catch(e) {}
            }

            // Logged in via a recovery code — nag when they're running low.
            if (typeof response.recovery_codes_remaining !== 'undefined' && response.recovery_codes_remaining < 10) {
                ToastService.warning('Recovery Codes Running Low',
                    'You have ' + response.recovery_codes_remaining + ' recovery code' +
                    (response.recovery_codes_remaining === 1 ? '' : 's') +
                    ' left. Generate a fresh set in My Account → Security.');
            }

            // Timeout fallback: if SetCredentials2 takes too long (e.g., API hanging),
            // redirect to dashboard anyway after 10 seconds
            var loginTimeoutFired = false;
            var loginTimeout = $timeout(function() {
                if (!loginTimeoutFired) {
                    loginTimeoutFired = true;
                    console.warn('Login timeout - proceeding to dashboard');
                    $location.path(setupRequired ? '/dashboard/my_account/security' : '/dashboard');
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

                // Enrolment required — go straight to the Security page; the
                // route guard keeps the rest of the app locked until done.
                if (setupRequired) {
                    $location.path('/dashboard/my_account/security');
                    return;
                }

                 // Check for a stored return URL from a prior auto-logout
                 var returnUrl = null;
                 try { returnUrl = localStorage.getItem('toaviate_return_url'); } catch(e) {}
                 // Discard return URLs that point to signup/public flows — users
                 // should never be sent back to a signup form after logging in.
                 var signupPrefixes = ['/passenger_signup', '/club_signup', '/user_signup', '/invitations', '/register', '/login', '/display', '/password_reset', '/registration_success', '/registration_verification', '/disabled', '/gallery'];
                 if (returnUrl) {
                     for (var sp = 0; sp < signupPrefixes.length; sp++) {
                         if (returnUrl === signupPrefixes[sp] || returnUrl.indexOf(signupPrefixes[sp] + '/') === 0) {
                             returnUrl = null;
                             break;
                         }
                     }
                 }
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
                     // Access level fetch failed but user is authenticated — redirect to dashboard as fallback
                     $location.path('/dashboard');
                 }
            });
        }


        // ── 2FA code screen ──

        function submitCode() {
            var code = (vm.code || '').trim();
            if (!code) {
                ToastService.highlightField('two_factor_code');
                ToastService.warning('Code Required', vm.codeType === 'recovery' ?
                    'Please enter one of your recovery codes.' :
                    'Please enter the 6-digit code from your authenticator app.');
                return;
            }

            vm.dataLoading = true;
            vm.error = null;

            AuthenticationService.Login2FA(vm.two_factor_token, code, vm.codeType, function (response) {
                if (response.success) {
                    completeLogin(response);
                } else if (response.error === 'WRONG_CODE') {
                    vm.dataLoading = false;
                    vm.code = '';
                    vm.attemptsRemaining = response.attempts_remaining;
                    ToastService.highlightField('two_factor_code');
                    ToastService.error('Wrong Code', (response.message || 'That code was not recognised.') +
                        (typeof response.attempts_remaining !== 'undefined' ?
                            ' ' + response.attempts_remaining + ' attempt' + (response.attempts_remaining === 1 ? '' : 's') + ' remaining.' : ''));
                } else if (response.error === 'EXPIRED' || response.error === 'TOO_MANY_ATTEMPTS') {
                    // Token is dead — back to the start of the login.
                    ToastService.error(response.error === 'EXPIRED' ? 'Code Screen Expired' : 'Too Many Attempts',
                        'Please sign in again from the start.');
                    backToPassword();
                } else {
                    vm.dataLoading = false;
                    ToastService.error('Verification Failed', response.message || response.error || 'Please try again.');
                }
            });
        }

        function toggleRecovery() {
            vm.codeType = (vm.codeType === 'recovery') ? 'totp' : 'recovery';
            vm.code = '';
            $timeout(function () {
                var el = document.getElementById('two_factor_code');
                if (el) { el.focus(); }
            }, 100);
        }

        function backToPassword() {
            vm.stage = 'password';
            vm.two_factor_token = null;
            vm.code = '';
            vm.password = '';
            vm.attemptsRemaining = null;
            vm.dataLoading = false;
            // The login0 session may have expired while the code screen was up —
            // fetch a fresh one so the next attempt doesn't need the auto-retry.
            AuthenticationService.Login0(function (response) {
                if (response.success) {
                    vm.login_session = response.login_session;
                }
            });
        }


        // ── Passkey (biometric) sign-in ──

        function passkeyLogin() {
            if (vm.passkeyLoading || vm.dataLoading) { return; }
            vm.passkeyLoading = true;
            vm.error = null;

            WebauthnService.Login().then(function (response) {
                if (response && response.success) {
                    vm.dataLoading = true;
                    vm.passkeyLoading = false;
                    completeLogin(response);
                } else {
                    vm.passkeyLoading = false;
                    if (response && response.error === 'CEREMONY_CANCELLED') { return; }   // user dismissed the prompt — no toast
                    // Generic failure — offer password login instead (form is still there).
                    ToastService.error('Passkey Sign-In Failed',
                        (response && response.message) || 'Please sign in with your password instead.');
                }
            });
        }

        function logout(){
            // reset login status
            AuthenticationService.ClearCredentials();
        }


    }