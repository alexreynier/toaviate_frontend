app.controller('LoginController', LoginController);
 
    LoginController.$inject = ['$location', 'AuthenticationService', 'FlashService', '$timeout', 'ToastService', '$rootScope', 'authGate', 'WebauthnService', 'LogbookSignupService', 'MaintenanceOrganisationService'];
    function LoginController($location, AuthenticationService, FlashService, $timeout, ToastService, $rootScope, authGate, WebauthnService, LogbookSignupService, MaintenanceOrganisationService) {
        var vm = this;

        vm.login = login;

        vm.login_session;
        vm.login_key;

        // ── Two-factor step (shown when login2 returns two_factor_required) ──
        vm.stage = 'password';            // 'password' | 'email_code' | 'code'
        vm.email_verify_token = null;     // login_stages token while the email code is pending
        vm.emailHint = '';                // masked address the code went to
        vm.emailCode = '';
        vm.resendIn = 0;                  // seconds until "Send a new code" is allowed again
        vm.two_factor_token = null;       // 64-char token from login2 — 5 min / 6 attempts
        vm.code = '';
        vm.codeType = 'totp';             // 'totp' | 'recovery'
        vm.attemptsRemaining = null;
        vm.submitCode = submitCode;
        vm.submitEmailCode = submitEmailCode;
        vm.resendEmailCode = resendEmailCode;
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

                        if (response.email_verification_required) {
                            // Correct password, unconfirmed email address: a 6-digit
                            // code has just been emailed — no session until it is
                            // entered. (2FA, if enabled, follows after.)
                            enterEmailCodeStage(response);
                            return;
                        }

                        if (response.two_factor_required) {
                            // Shape C — 2FA is enabled on this account, so there is
                            // NO session yet. Pivot to the code screen; the token is
                            // valid for 5 minutes / 6 attempts.
                            enterTwoFactorStage(response);
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

            // An invitation signup whose paid membership was never completed
            // (payment skipped / abandoned): the only thing this account can do
            // until it pays is finish that step. Flag read by the route guard in
            // app.js and cleared by the invitation wizard on completion; the
            // backend re-asserts it at every login.
            var paymentGate = response.payment_setup_required || null;
            try {
                if (paymentGate && paymentGate.token) {
                    localStorage.setItem('toaviate_payment_setup_required', JSON.stringify({ user_id: response.user.id, token: paymentGate.token, club_title: paymentGate.club_title || '' }));
                } else {
                    localStorage.removeItem('toaviate_payment_setup_required');
                }
            } catch(e) {}

            // Logged in via a recovery code — nag when they're running low.
            if (typeof response.recovery_codes_remaining !== 'undefined' && response.recovery_codes_remaining < 10) {
                ToastService.warning('Recovery Codes Running Low',
                    'You have ' + response.recovery_codes_remaining + ' recovery code' +
                    (response.recovery_codes_remaining === 1 ? '' : 's') +
                    ' left. Generate a fresh set in My Details → Security.');
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

                // A club invitation waiting to be accepted into this existing
                // account ("log in to accept" — FRONTEND_LOGBOOK_SIGNUP_GUIDE
                // §5)? Resolve it first, then do the normal redirect.
                var inviteToken = null;
                try { inviteToken = localStorage.getItem('toaviate_accept_invitation'); } catch(e) {}
                if (inviteToken) {
                    acceptPendingInvitation(inviteToken, function() { doRedirect(response); });
                } else {
                    doRedirect(response);
                }
            });

            function doRedirect(response) {

                // Enrolment required — go straight to the Security page; the
                // route guard keeps the rest of the app locked until done.
                if (setupRequired) {
                    $location.path('/dashboard/my_account/security');
                    return;
                }
                if (paymentGate && paymentGate.token) {
                    ToastService.warning('Finish Your Membership', 'Your ' + (paymentGate.club_title ? paymentGate.club_title + ' ' : '') + 'membership still needs a payment method - let\'s finish that first.');
                    $location.path('/invitations/' + paymentGate.token + '/your_club');
                    return;
                }

                 // Check for a stored return URL from a prior auto-logout
                 var returnUrl = null;
                 try { returnUrl = localStorage.getItem('toaviate_return_url'); } catch(e) {}
                 // Discard return URLs that point to signup/public flows — users
                 // should never be sent back to a signup form after logging in.
                 var signupPrefixes = ['/passenger_signup', '/club_signup', '/user_signup', '/invitations', '/register', '/login', '/display', '/password_reset', '/registration_success', '/registration_verification', '/disabled', '/gallery', '/free_logbook', '/logbook_invite', '/endorsement_confirm', '/caa_form_confirm'];
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
                 } else if(response && response.access && response.access.pilot && response.access.pilot.length === 0){
                     // No club as a pilot: a passenger lands on My Account, a
                     // maintenance-organisation founder in their workspace, and a
                     // club-less free-logbook account on the logbook.
                     if (response.access.passenger && response.access.passenger.length > 0) {
                         $location.path('/dashboard/my_account');
                     } else {
                         MaintenanceOrganisationService.GetForUser(response.id).then(function(res){
                             var orgs = (res && res.success !== false && res.organisations) ? res.organisations : [];
                             $location.path(orgs.length ? '/dashboard/maintenance' : '/dashboard/my_account/logbook');
                         }, function(){ $location.path('/dashboard/my_account/logbook'); });
                     }
                 } else if(response) {
                     $location.path('/dashboard/my_account');
                 } else {
                     // Access level fetch failed but user is authenticated — redirect to dashboard as fallback
                     $location.path('/dashboard');
                 }
            }
        }

        // ── Accept a club invitation into this (existing) account ──
        // The invitation signup flow stored the token when the backend said
        // "existing account — log in to accept". FORBIDDEN (wrong email)
        // keeps the token so logging in with the invited email still works.
        function acceptPendingInvitation(token, done) {
            LogbookSignupService.AcceptExisting(token).then(function(data) {
                if (data && data.success && data.mode === 'payment_pending') {
                    // Accepted onto this account; the membership fee is paid AS the
                    // account on the invitation's payment step. The same gate the
                    // backend re-asserts at every login pins the app there.
                    try {
                        localStorage.removeItem('toaviate_accept_invitation');
                        localStorage.setItem('toaviate_payment_setup_required', JSON.stringify({
                            user_id: ($rootScope.globals && $rootScope.globals.currentUser) ? $rootScope.globals.currentUser.id : 0,
                            token: token, club_title: ''
                        }));
                    } catch(e) {}
                    ToastService.success('Invitation Accepted', 'Now choose how to pay for the membership to finish.');
                    $location.path('/invitations/' + token + '/your_club');
                    return;
                }
                if (data && data.success) {
                    try { localStorage.removeItem('toaviate_accept_invitation'); } catch(e) {}
                    ToastService.success('Welcome to the Club!',
                        data.already_accepted ? 'This invitation was already accepted — you\'re all set.'
                                              : 'The club invitation has been accepted on your account.');
                } else if (data && data.error === 'FORBIDDEN') {
                    ToastService.error('Different Email',
                        'This invitation was sent to a different email address — please log in with the invited email to accept it.');
                } else if (data && data.payment_required) {
                    try { localStorage.removeItem('toaviate_accept_invitation'); } catch(e) {}
                    ToastService.warning('Payment Required', data.message ||
                        'This invitation carries a membership fee. Ask the club to waive the fee on the invitation, or to invoice you directly.');
                } else {
                    try { localStorage.removeItem('toaviate_accept_invitation'); } catch(e) {}
                    if (data && data.message) { ToastService.error('Invitation', data.message); }
                }
                done();
            });
        }


        function enterTwoFactorStage(response) {
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
        }

        // ── Email confirmation screen ──
        // "Please confirm your email address - we've sent a code": shown when the
        // password is right but users.verified is still 0 (an account whose
        // verification link was never clicked). The code is emailed by login2;
        // the resend button cools down for 45 s to match the backend.

        var resendTimer = null;
        function startResendCooldown(seconds) {
            vm.resendIn = seconds;
            if (resendTimer) { $timeout.cancel(resendTimer); }
            (function tick() {
                if (vm.resendIn <= 0) { resendTimer = null; return; }
                resendTimer = $timeout(function () { vm.resendIn -= 1; tick(); }, 1000);
            })();
        }

        function enterEmailCodeStage(response) {
            vm.email_verify_token = response.email_verify_token;
            vm.emailHint = response.email_hint || vm.email;
            vm.emailCode = '';
            vm.attemptsRemaining = null;
            vm.error = null;
            vm.stage = 'email_code';
            vm.dataLoading = false;
            startResendCooldown(response.code_sent === false ? 0 : 45);
            $timeout(function () {
                var el = document.getElementById('email_code');
                if (el) { el.focus(); }
            }, 100);
        }

        function submitEmailCode() {
            var code = String(vm.emailCode || '').replace(/\D/g, '');
            if (code.length !== 6) {
                ToastService.highlightField('email_code');
                ToastService.warning('Code Required', 'Please enter the 6-digit code from the email we just sent you.');
                return;
            }
            vm.dataLoading = true;
            vm.error = null;
            AuthenticationService.LoginVerifyEmail(vm.email_verify_token, code, function (response) {
                if (response.success) {
                    ToastService.success('Email Confirmed', 'Thanks - your email address is verified.');
                    if (response.two_factor_required) { enterTwoFactorStage(response); return; }
                    completeLogin(response);
                    return;
                }
                vm.dataLoading = false;
                if (response.error === 'WRONG_CODE') {
                    vm.attemptsRemaining = (typeof response.attempts_remaining === 'number') ? response.attempts_remaining : null;
                    vm.emailCode = '';
                    ToastService.error('Code Not Recognised', response.message || 'That code was not recognised. Please check the email and try again.');
                    $timeout(function () { var el = document.getElementById('email_code'); if (el) { el.focus(); } }, 50);
                    return;
                }
                // EXPIRED / TOO_MANY_ATTEMPTS / lockout — start again
                ToastService.error('Please Sign In Again', response.message || response.error || 'That confirmation has expired - please sign in again.');
                backToPassword();
            });
        }

        function resendEmailCode() {
            if (vm.resendIn > 0 || vm.dataLoading) { return; }
            vm.resending = true;
            AuthenticationService.ResendLoginEmailCode(vm.email_verify_token, function (response) {
                vm.resending = false;
                if (response && response.success) {
                    vm.attemptsRemaining = null;
                    vm.emailCode = '';
                    ToastService.success('New Code Sent', response.message || 'A new code is on its way to ' + vm.emailHint + '.');
                    startResendCooldown(45);
                } else if (response && response.error === 'EXPIRED') {
                    ToastService.error('Please Sign In Again', response.message || 'That sign-in has expired.');
                    backToPassword();
                } else {
                    ToastService.warning('Not Sent', (response && (response.message || response.error)) || 'Could not send a new code right now - please wait a moment and try again.');
                    startResendCooldown(15);
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
            vm.email_verify_token = null;
            vm.emailCode = '';
            vm.resendIn = 0;
            if (resendTimer) { $timeout.cancel(resendTimer); resendTimer = null; }
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