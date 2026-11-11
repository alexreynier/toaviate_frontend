    app.factory('AuthenticationService', AuthenticationService);
 
    AuthenticationService.$inject = ['$http', '$cookieStore', '$rootScope', '$timeout', '$q', 'UserService', 'EnvConfig', 'authGate'];
    function AuthenticationService($http, $cookieStore, $rootScope, $timeout, $q, UserService, EnvConfig, authGate) {
        var service = {};
 
        service.Login = Login;
        
        service.Login0 = Login0;
        service.Login1 = Login1;
        service.Login2 = Login2;
        service.Login2FA = Login2FA;
        service.TwoFactorHelp = TwoFactorHelp;
        service.LoginVerifyEmail = LoginVerifyEmail;
        service.ResendLoginEmailCode = ResendLoginEmailCode;
        service.Login3 = Login3;
        service.Logout = Logout;

        service.ResetPassword = ResetPassword;
        service.ResetPassword2 = ResetPassword2;

        service.SetCredentials = SetCredentials;
        service.SetCredentials2 = SetCredentials2;

        service.ClearCredentials = ClearCredentials;
        service.GetCredentials = GetCredentials;
        service.CheckLoggedIn = CheckLoggedIn;
        // users/{id}/access rows → the currentUser.access shape
        service.ProcessAccess = processAccess;
        // Persisted login state — see "Persisted login state" below
        service.PersistGlobals = PersistGlobals;
        service.Rehydrate = Rehydrate;
        service.IsHydrated = IsHydrated;
        service.PickAdminClub = pickAdminClub;

        $http.defaults.headers.common['Api-Key'] = EnvConfig.getApiKey();

        // ── Persisted login state (the `globals` cookie) ──
        // A page refresh restores $rootScope.globals from the `globals` cookie
        // (app.js run block). Browsers silently DROP a cookie over 4 KB, and the
        // full currentUser — every membership row plus the whole Manage Club
        // club row (80+ columns) — grew past that for admins (user 5: 4152 B),
        // so their club vanished on refresh and Manage Club pages threw on
        // `current_club_admin.id`. So the cookie holds a SLIM copy only:
        //   id, email, first_name, last_name, authdata (the Basic user:session),
        //   current_club_instructor, the access role arrays + show_* flags the
        //   menus and route guards read synchronously, and current_club_admin
        //   cut down to CLUB_FIELDS;
        // and Rehydrate() puts the rest back from the server (access rows →
        // ProcessAccess, the full admin club row) once per page load / login.
        // The Manage Club route guard (app.js) waits for it before any Manage
        // Club page renders; DashboardController uses the same call for its
        // club list. Always write the cookie through PersistGlobals() — never
        // $cookieStore.put('globals', …) directly. Contract: frontend CLAUDE.md
        // "Persisted login state".
        var GLOBALS_COOKIE_BUDGET = 3500;   // bytes of `globals=<encoded JSON>` (browsers drop > 4096)
        var ACCESS_ARRAYS = ['manager', 'pilot', 'instructor', 'super_admin', 'passenger', 'sms_post'];
        // toaviate_staff: users.toaviate_staff, from GET users/{id}/access — what $rootScope.isToAviateStaff() reads
        var ACCESS_FLAGS = ['show_manager', 'show_sms', 'show_instructor', 'show_booking', 'show_approval_warning', 'toaviate_staff'];
        // the admin club fields code may read before Rehydrate lands: the id
        // everywhere, the title (headers / trackers), the booking edit windows
        // (bookings / scheduler edit checks)
        var CLUB_FIELDS = ['id', 'title', 'edit_window_admin_minutes', 'edit_window_instructor_minutes', 'edit_window_member_minutes'];
        var SELECTED_CLUB_KEY = 'toaviate_selected_club_id';   // the Manage Club club, shared with DashboardController
        var hydration = null;   // { uid, promise, settled, ok } — this page load's / login's server copy

        return service;

        // The slim copy of `globals` for the cookie. level 0 = everything the
        // contract lists; each higher level drops more, for the (so far
        // theoretical) account whose role arrays alone overflow the budget —
        // Rehydrate restores the dropped parts on every page load.
        function slimGlobals(globals, level) {
            var cu = globals.currentUser;
            var out = {
                id: cu.id,
                email: cu.email,
                authdata: cu.authdata
            };
            if (level < 4) {
                out.first_name = cu.first_name;
                out.last_name = cu.last_name;
                if (cu.current_club_instructor !== undefined && cu.current_club_instructor !== null) {
                    out.current_club_instructor = cu.current_club_instructor;
                }
            }
            var access = cu.access || {};
            out.access = {};
            for (var a = 0; a < ACCESS_ARRAYS.length; a++) {
                var key = ACCESS_ARRAYS[a];
                var list = angular.isArray(access[key]) ? access[key] : [];
                // level 2 empties the arrays nothing gates a page on; level 3+ all
                // of them (empty, not absent — code calls .indexOf on them)
                if (level >= 3 || (level === 2 && (key === 'pilot' || key === 'passenger'))) { list = []; }
                out.access[key] = list.slice();
            }
            for (var f = 0; f < ACCESS_FLAGS.length; f++) {
                out.access[ACCESS_FLAGS[f]] = !!access[ACCESS_FLAGS[f]];
            }
            var club = cu.current_club_admin;
            if (club && club.id !== undefined && club.id !== null && level < 4) {
                var fields = level === 0 ? CLUB_FIELDS : ['id', 'title'];
                out.current_club_admin = {};
                for (var c = 0; c < fields.length; c++) {
                    if (club[fields[c]] !== undefined) { out.current_club_admin[fields[c]] = club[fields[c]]; }
                }
            }
            return { currentUser: out };
        }

        // What angular-cookies' $$cookieWriter measures: name=value, both URI-encoded.
        function cookieBytes(value) {
            return ('globals=' + encodeURIComponent(angular.toJson(value))).length;
        }

        // Write the slim `globals` cookie from $rootScope.globals (which keeps
        // the full in-memory copy). Never over GLOBALS_COOKIE_BUDGET: trims
        // level by level and logs when it has to.
        function PersistGlobals() {
            var g = $rootScope.globals;
            if (!g || !g.currentUser || !g.currentUser.id) { return; }
            var slim = null, bytes = 0, level;
            for (level = 0; level <= 4; level++) {
                slim = slimGlobals(g, level);
                bytes = cookieBytes(slim);
                if (bytes <= GLOBALS_COOKIE_BUDGET) { break; }
            }
            if (level > 4) {
                console.error('globals cookie: still ' + bytes + ' bytes at the smallest level — not written; a refresh will need a new login.');
                return;
            }
            if (level > 0) {
                console.warn('globals cookie: trimmed to level ' + level + ' (' + bytes + ' bytes) to stay under ' + GLOBALS_COOKIE_BUDGET + '; the rest is rehydrated from the server.');
            }
            $cookieStore.put('globals', slim);
        }

        // The admin club to select from a get_all_admin_for_user list: the one
        // saved in localStorage, else `fallbackId` (the cookie's club), else the
        // first; null for an empty list.
        function pickAdminClub(clubs, fallbackId) {
            if (!angular.isArray(clubs) || clubs.length === 0) { return null; }
            var saved = null;
            try { saved = localStorage.getItem(SELECTED_CLUB_KEY); } catch (e) {}
            var wanted = [saved, fallbackId];
            for (var w = 0; w < wanted.length; w++) {
                if (wanted[w] === null || wanted[w] === undefined || wanted[w] === '') { continue; }
                for (var i = 0; i < clubs.length; i++) {
                    if (clubs[i] && String(clubs[i].id) === String(wanted[w])) { return clubs[i]; }
                }
            }
            return clubs[0];
        }

        function rememberAdminClub(club) {
            if (!club || club.id === undefined || club.id === null) { return; }
            try { localStorage.setItem(SELECTED_CLUB_KEY, String(club.id)); } catch (e) {}
        }

        // True once this page load's (or login's) server copy has landed for
        // the logged-in user — successfully or not.
        function IsHydrated() {
            var u = $rootScope.globals && $rootScope.globals.currentUser;
            return !!(u && u.id && hydration && hydration.uid === String(u.id) && hydration.settled);
        }

        // Put back what the slim cookie leaves out: GET users/{id}/access →
        // currentUser.access (ProcessAccess) and GET clubs/get_all_admin_for_user
        // → currentUser.current_club_admin (the full row of the saved / cookie /
        // first admin club), then re-write the slim cookie. Once per page load
        // and per login (SetCredentials2 seeds it): later calls get the same
        // promise unless `force` (the guard's one re-check before refusing) or
        // the last attempt failed. Resolves (never rejects) with the two raw
        // responses { access, clubs } — or null when nobody is logged in.
        function Rehydrate(force) {
            var u = $rootScope.globals && $rootScope.globals.currentUser;
            if (!u || !u.id) { return $q.when(null); }
            var uid = String(u.id);
            if (!force && hydration && hydration.uid === uid && (!hydration.settled || hydration.ok)) {
                return hydration.promise;
            }
            var h = { uid: uid, settled: false, ok: false, promise: null };
            hydration = h;
            h.promise = $q.all([UserService.GetAccess(u.id), UserService.GetAdminClubs(u.id)]).then(function (res) {
                var result = { access: res[0], clubs: res[1] };
                var current = $rootScope.globals && $rootScope.globals.currentUser;
                if (current && String(current.id) === uid && hydration === h) {
                    h.ok = applyServerState(current, result.access, result.clubs);
                    PersistGlobals();
                }
                h.settled = true;
                return result;
            }, function () {
                h.settled = true;
                return { access: null, clubs: null };
            });
            return h.promise;
        }

        // Apply the two server responses to the in-memory currentUser; true when both were good.
        function applyServerState(current, accessRes, clubsRes) {
            var accessOk = !!(accessRes && accessRes.success && angular.isArray(accessRes.access));
            if (accessOk) {
                current.access = processAccess(accessRes.access, accessRes.toaviate_staff);
                var ins = current.access.instructor;
                if (ins.length === 0) {
                    delete current.current_club_instructor;
                } else if (ins.indexOf(current.current_club_instructor) === -1) {
                    current.current_club_instructor = ins[0];
                }
            }
            var clubsOk = !!(clubsRes && clubsRes.success);
            if (clubsOk) {
                var had = current.current_club_admin;
                var picked = pickAdminClub(clubsRes.clubs, had ? had.id : null);
                if (picked) {
                    current.current_club_admin = picked;
                    rememberAdminClub(picked);
                } else {
                    delete current.current_club_admin;   // not a club admin (any more)
                }
            }
            return accessOk && clubsOk;
        }


        function Logout(callback){

            $http.post('/api/v1/users/logout', {})
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Logout failed:', status, data);
                   callback({ success: false, error: 'Logout request failed. Please try again.' });
            });

        }


        function Login0(callback){


            $http.post('/api/v1/users/login0', {})
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Login0 failed:', status, data);
                   callback({ success: false, error: 'Unable to initialise login. Please refresh and try again.' });
            });


        }


        function Login1(username, session, callback){
            //var user = Base64.encode(username);
            var user = Base64.encode(session + "," + username);

            $http.post('/api/v1/users/login1', { a: user })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Login1 failed:', status, data);
                   callback({ success: false, error: 'Login failed. Please check your connection and try again.' });
            });

        }


        function Login2(password, session, callback){


            var user = Base64.encode(session + "," + password);

            $http.post('/api/v1/users/login2', { a: user })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Login2 failed:', status, data);
                   callback({ success: false, error: 'Authentication failed. Please try again.' });
            });


        }


        // Completes a 2FA login after login2 returned two_factor_required.
        // token = the 64-char two_factor_token from login2; type = 'totp' | 'recovery'.
        // Success returns the login2 shape {success, user, session}. Wrong-code
        // responses ({error:'WRONG_CODE', attempts_remaining} etc.) are passed
        // through to the caller even on non-2xx statuses so the login screen
        // can show attempts left / expiry.
        // Email confirmation at login (users.verified = 0 with a correct
        // password): the 6-digit code emailed by login2. Same "token,code"
        // Base64 convention as login_2fa; errors (WRONG_CODE / EXPIRED /
        // TOO_MANY_ATTEMPTS) pass through so the screen can react.
        function LoginVerifyEmail(token, code, callback){
            var a = Base64.encode(token + "," + code);
            $http.post('/api/v1/users/login_verify_email', { a: a })
               .success(function (response) { callback(response); })
               .error(function (data, status) {
                   console.log('LoginVerifyEmail failed:', status, data);
                   if (data && (data.error || data.message)) { data.success = false; callback(data); }
                   else { callback({ success: false, error: 'Verification failed. Please check your connection and try again.' }); }
               });
        }
        function ResendLoginEmailCode(token, callback){
            $http.post('/api/v1/users/login_resend_email_code', { token: token })
               .success(function (response) { callback(response); })
               .error(function (data, status) {
                   console.log('ResendLoginEmailCode failed:', status, data);
                   callback((data && typeof data === 'object') ? angular.extend({ success: false }, data) : { success: false, message: 'Could not send a new code. Please try again.' });
               });
        }

        function Login2FA(token, code, type, callback){

            var user = Base64.encode(token + "," + code);

            $http.post('/api/v1/users/login_2fa', { a: user, type: type })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Login2FA failed:', status, data);
                   if (data && data.error) {
                       data.success = false;
                       callback(data);
                   } else {
                       callback({ success: false, error: 'Verification failed. Please check your connection and try again.' });
                   }
            });

        }


        // "Lost your phone and your recovery codes?" on the 2-step code screen (C28, 9 Nov 2026). Public; only works with the
        // live two_factor_token of this sign-in (password step < 30 min old). The answer is always the same neutral
        // {success:true, message}: ToAviate staff are e-mailed to check it's the member (then a C22 held reset), the
        // member's addresses are told. It never removes two-factor. Rate-limited to 3 a day.
        function TwoFactorHelp(token, note, callback){

            $http.post('/api/v1/users/two_factor_help', { a: Base64.encode(token || ''), note: note || '' })
               .success(function (response) {
                   callback(response || { success: true });
            }).error(function (data, status) {
                   console.log('TwoFactorHelp failed:', status, data);
                   callback({ success: false, status: status });
            });

        }

        function Login3(password, session, callback){


            var user = Base64.encode(session + "," + password);

            $http.post('/api/v1/users/login3', { a: user })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Login3 failed:', status, data);
                   callback({ success: false, error: 'Authentication failed. Please try again.' });
            });


        }

        function ResetPassword(email, callback){


            $http.post('/api/v1/users/reset_password', { email: email })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('ResetPassword failed:', status, data);
                   callback({ success: false, error: 'Password reset request failed. Please try again.' });
            });


        }

        function ResetPassword2(password, token, callback){

            var user = Base64.encode(token + "," + password);

            $http.post('/api/v1/users/reset_password2', { a: user })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('ResetPassword2 failed:', status, data);
                   callback({ success: false, error: 'Password reset failed. The link may have expired.' });
            });


        }



 
        function Login(email, password, callback) {
 
            /* Dummy authentication for testing, uses $timeout to simulate api call
             ----------------------------------------------*/
            // $timeout(function () {
            //     var response;
            //     UserService.GetByUsername(username)
            //         .then(function (user) {
            //             if (user !== null && user.password === password) {
            //                 response = { success: true };
            //             } else {
            //                 response = { success: false, message: 'Username or password is incorrect' };
            //             }
            //             callback(response);
            //         });
            // }, 1000);
 
            /* Use this for real authentication
             ----------------------------------------------*/
            $http.post('/api/v1/users/login', { email: email, password: password })
               .success(function (response) {
                   callback(response);
            }).error(function (data, status) {
                   console.log('Login failed:', status, data);
                   callback({ success: false, error: 'Login failed. Please check your connection and try again.' });
            });
 
        }

        function GetCredentials(){
            return $cookieStore.get('globals');
        }


        function CheckLoggedIn(){
            if($cookieStore.get("globals") !== "" || $rootScope.globals !== ""){
                // console.log("root", $rootScope.globals);
                if($rootScope.globals == $cookieStore.get("globals")){
                    // console.log("OK ITS THE SAME");
                    return true;
                } else if($rootScope.globals && $rootScope.globals.currentUser && $rootScope.globals.currentUser.id) {
                    alert("It looks like you've been logged out due to inactivity - please login again.");
                    // console.log("its been tempered with / something went wrong - so lets override it all...");
                    // --> I think we should offer the redirect?
                    return false;
                  
                } else {
                    // console.log("You are not logged in?");
                    return false;
                }


            } else {
                // console.log("cookie not set");
                return false;
            }
        }

        function getAdminClubs(user_id){
           
        }

        function getManagerClubs(user_id){
            UserService.GetAdminClubs(user_id)
            .then(function(data){
                // console.log("GETTING CLUBS HERE ", data.clubs);
                return data.clubs;   
                
            });
        }

        function getCurrentAdminClub(){
                //think about preferences and setting the "most favoured" one.
                return vm.clubs[0];
                //console.log("vm.clubs[0]", vm.clubs[0]);
        }

        // staff: the access read's toaviate_staff (the account's ToAviate-staff flag). A caller that has only the
        // membership rows (none today) leaves it out and gets false.
        function processAccess(access, staff){

            var obj = {
                toaviate_staff: Number(staff) === 1 || staff === true,
                manager: [],
                pilot: [],
                instructor: [],
                super_admin: [],
                passenger: [],      // pax memberships (is_pax) — not pilots, land on My Account
                sms_post: [],       // clubs where the user holds an SMS post (sms_settings) — opens Manage Club's SMS screens
                items: access,
                show_manager: false,
                show_sms: false,
                show_instructor: false,
                show_booking: false,
                show_approval_warning: false
            };



            for(var i=0;i<access.length;i++){

                if(Number(access[i].is_pax) === 1){ obj.passenger.push(access[i].club_id); }

                if(access[i].approved == 1){
                    obj.pilot.push(access[i].club_id);
                } else if(access[i].approved == 0 && access[i].membership_id > 0){
                    obj.pilot.push(access[i].club_id);
                }

                if(access[i].instructor == 1){
                    obj.instructor.push(access[i].club_id);
                }

                if(access[i].is_manager == 1){
                    obj.manager.push(access[i].club_id);
                }

                if(access[i].club_super_admin == 1){
                    obj.super_admin.push(access[i].club_id);
                }

                if(access[i].sms_post == 1){
                    obj.sms_post.push(access[i].club_id);
                }


            }


            // Manage Club is for club admins: a manager OR a club super-admin of
            // any club (ToAviate staff are let in by the route guard in app.js).
            if(obj.manager.length > 0 || obj.super_admin.length > 0){
                obj.show_manager = true;
            }
            // SMS post holders get a "Safety Management" menu entry straight into
            // Manage Club's SMS screens (the guard in app.js opens those to them).
            if(obj.sms_post.length > 0){
                obj.show_sms = true;
            }
            if(obj.instructor.length > 0){
                obj.show_instructor = true;
               // obj.instruct_clubs = getInstructorClubs(user_id);
            }
            if(obj.pilot.length > 0){
                obj.show_booking = true;
            }

            return obj;

        }
 
        function SetCredentials(email, password, user, session) {

            // console.log("SET SET SET ME");

            ClearCredentials();

            // Fresh, valid session — re-open the auth gate so the interceptor
            // resumes issuing authenticated calls (it blocks them after a 401).
            authGate.reset();

            var authdata = Base64.encode(user.id + ':' + session);
                
            $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line
            $http.defaults.headers.common['Session'] = session;

            // console.log("USER", user);
            //$rootScope.globals.currentUser.id
            // console.log("SESSION IS ", session);

            UserService.GetAccess(user.id)
                .then(function (data) {
                    // console.log("SENT access check");
                    // console.log(data);
                    if(data.success){

                        
                        $rootScope.globals = {
                            currentUser: {
                                // Prefer the email the SERVER returned. The
                                // passkey path has no typed email (WebAuthn
                                // identifies the user by credential), so the
                                // `email` argument is undefined there — and a
                                // missing email silently breaks anything keyed
                                // off it.
                                email: (user && user.email) ? user.email : email,
                                authdata: authdata,
                                id: user.id,
                                first_name: user.first_name,
                                last_name: user.last_name,
                                access: processAccess(data.access, data.toaviate_staff)
                            }
                        };

                        //console.log("HEYA");
                        // $rootScope.globals.currentUser.current_club_instructor = vm.clubs[0];
                        //$rootScope.globals.currentUser.current_club_instructor
                        // set the default instructor --> 
                        if($rootScope.globals.currentUser.access.instructor.length > 0){
                            // console.log("we are an instructor SOMEWHERE, setting: ", $rootScope.globals.currentUser.access.instructor[0]);
                            $rootScope.globals.currentUser.current_club_instructor = $rootScope.globals.currentUser.access.instructor[0];
                        } else {
                            // console.log("ELSE ERROR: ", $rootScope.globals.currentUser.access);
                        }


                        $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line

                        PersistGlobals();
                        $cookieStore.put('session', session);

                        // console.log("access is ", $rootScope.globals.currentUser.access);

                    } else {
                       

                    }
                });

            
 
            
        }


        function SetCredentials2(email, password, user, session, callback) {
            // console.log("SET SET SET ME");

            ClearCredentials();

            // Fresh, valid session — re-open the auth gate so the interceptor
            // resumes issuing authenticated calls (it blocks them after a 401).
            authGate.reset();

            var authdata = Base64.encode(user.id + ':' + session);
                
            $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line
            $http.defaults.headers.common['Session'] = session;

            // console.log("USER", user);
            //$rootScope.globals.currentUser.id
            // console.log("SESSION IS ", session);

            UserService.GetAccess(user.id)
                .then(function (data) {
                    // console.log("SENT access check");
                    // console.log(data);
                    if(data.success){

                        
                        $rootScope.globals = {
                            currentUser: {
                                // Prefer the email the SERVER returned. The
                                // passkey path has no typed email (WebAuthn
                                // identifies the user by credential), so the
                                // `email` argument is undefined there — and a
                                // missing email silently breaks anything keyed
                                // off it.
                                email: (user && user.email) ? user.email : email,
                                authdata: authdata,
                                id: user.id,
                                first_name: user.first_name,
                                last_name: user.last_name,
                                access: processAccess(data.access, data.toaviate_staff)
                            }
                        };

                        if($rootScope.globals.currentUser.access.instructor.length > 0){
                             // console.log("we are an instructor SOMEWHERE, setting: ", $rootScope.globals.currentUser.access.instructor[0]);
                            $rootScope.globals.currentUser.current_club_instructor = $rootScope.globals.currentUser.access.instructor[0];
                        } else {
                             // console.log("ELSE ERROR: ", $rootScope.globals.currentUser.access);
                        }

                        $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line

                        PersistGlobals();
                        $cookieStore.put('session', session);

                        // console.log("access is", $rootScope.globals.currentUser.access);

                        // If user has manager / super-admin access, fetch admin clubs and set current_club_admin before callback
                        // This ensures child controllers have current_club_admin available immediately
                        if ($rootScope.globals.currentUser.access.show_manager) {
                            UserService.GetAdminClubs(user.id)
                                .then(function (clubData) {
                                    if (clubData.success) {
                                        // saved selection (localStorage) else the first club
                                        var selectedClub = pickAdminClub(clubData.clubs, null);
                                        if (selectedClub) {
                                            $rootScope.globals.currentUser.current_club_admin = selectedClub;
                                            rememberAdminClub(selectedClub);
                                            PersistGlobals();   // slim: the club's id/title only
                                        }
                                        // this login IS the page's server copy — DashboardController
                                        // and the Manage Club guard reuse it instead of re-fetching
                                        hydration = { uid: String(user.id), settled: true, ok: true,
                                                      promise: $q.when({ access: data, clubs: clubData }) };
                                    }
                                    callback($rootScope.globals.currentUser);
                                })
                                .catch(function() {
                                    // If admin clubs fetch fails, still proceed with callback
                                    callback($rootScope.globals.currentUser);
                                });
                        } else {
                            callback($rootScope.globals.currentUser);
                        }
                    } else {
                       
                        callback(false) ;
                    }
                })
                .catch(function(err) {
                    // If GetAccess fails, still call the callback with false to avoid hanging login
                    console.error('GetAccess failed:', err);
                    callback(false);
                });

            
 
            
        }
 
        function ClearCredentials() {
            hydration = null;
            $rootScope.globals = {};
            $cookieStore.remove('globals');
            $cookieStore.remove('session');
            $http.defaults.headers.common.Authorization = 'Basic 123';
            $http.defaults.headers.common['Session'] = "ABC123";
        }
    }
 
    // Base64 encoding service used by AuthenticationService
    var Base64 = {
 
        keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
 
        encode: function (input) {
            var output = "";
            var chr1, chr2, chr3 = "";
            var enc1, enc2, enc3, enc4 = "";
            var i = 0;
 
            do {
                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);
 
                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;
 
                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }
 
                output = output +
                    this.keyStr.charAt(enc1) +
                    this.keyStr.charAt(enc2) +
                    this.keyStr.charAt(enc3) +
                    this.keyStr.charAt(enc4);
                chr1 = chr2 = chr3 = "";
                enc1 = enc2 = enc3 = enc4 = "";
            } while (i < input.length);
 
            return output;
        },
 
        decode: function (input) {
            var output = "";
            var chr1, chr2, chr3 = "";
            var enc1, enc2, enc3, enc4 = "";
            var i = 0;
 
            // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
            var base64test = /[^A-Za-z0-9\+\/\=]/g;
            if (base64test.exec(input)) {
                window.alert("There were invalid base64 characters in the input text.\n" +
                    "Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='\n" +
                    "Expect errors in decoding.");
            }
            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
 
            do {
                enc1 = this.keyStr.indexOf(input.charAt(i++));
                enc2 = this.keyStr.indexOf(input.charAt(i++));
                enc3 = this.keyStr.indexOf(input.charAt(i++));
                enc4 = this.keyStr.indexOf(input.charAt(i++));
 
                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;
 
                output = output + String.fromCharCode(chr1);
 
                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }
 
                chr1 = chr2 = chr3 = "";
                enc1 = enc2 = enc3 = enc4 = "";
 
            } while (i < input.length);
 
            return output;
        }
    };