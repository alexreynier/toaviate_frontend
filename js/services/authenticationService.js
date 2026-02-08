    app.factory('AuthenticationService', AuthenticationService);
 
    AuthenticationService.$inject = ['$http', '$cookieStore', '$rootScope', '$timeout', 'UserService'];
    function AuthenticationService($http, $cookieStore, $rootScope, $timeout, UserService) {
        var service = {};
 
        service.Login = Login;
        
        service.Login0 = Login0;
        service.Login1 = Login1;
        service.Login2 = Login2;
        service.Login3 = Login3;
        service.Logout = Logout;

        service.ResetPassword = ResetPassword;
        service.ResetPassword2 = ResetPassword2;

        service.SetCredentials = SetCredentials;
        service.SetCredentials2 = SetCredentials2;

        service.ClearCredentials = ClearCredentials;
        service.GetCredentials = GetCredentials;
        service.CheckLoggedIn = CheckLoggedIn;
        
        $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";

        return service;


        function Logout(callback){

            $http.post('/api/v1/users/logout', {})
               .success(function (response) {
                   callback(response);
            });

        }


        function Login0(callback){


            $http.post('/api/v1/users/login0', {})
               .success(function (response) {
                   callback(response);
            });


        }


        function Login1(username, session, callback){
            //var user = Base64.encode(username);
            var user = Base64.encode(session + "," + username);

            $http.post('/api/v1/users/login1', { a: user })
               .success(function (response) {
                   callback(response);
            });

        }


        function Login2(password, session, callback){


            var user = Base64.encode(session + "," + password);

            $http.post('/api/v1/users/login2', { a: user })
               .success(function (response) {
                   callback(response);
            });


        }


        function Login3(password, session, callback){


            var user = Base64.encode(session + "," + password);

            $http.post('/api/v1/users/login3', { a: user })
               .success(function (response) {
                   callback(response);
            });


        }

        function ResetPassword(email, callback){


            $http.post('/api/v1/users/reset_password', { email: email })
               .success(function (response) {
                   callback(response);
            });


        }

        function ResetPassword2(password, token, callback){

            var user = Base64.encode(token + "," + password);

            $http.post('/api/v1/users/reset_password2', { a: user })
               .success(function (response) {
                   callback(response);
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

        function processAccess(access){

            var obj = {
                manager: [],
                pilot: [],
                instructor: [],
                items: access,
                show_manager: false,
                show_instructor: false,
                show_booking: false,
                show_approval_warning: false
            };



            for(var i=0;i<access.length;i++){

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


            }


            if(obj.manager.length > 0){
                obj.show_manager = true;
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
                                email: email,
                                authdata: authdata,
                                id: user.id,
                                first_name: user.first_name,
                                last_name: user.last_name,
                                access: processAccess(data.access)
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

                        $cookieStore.put('globals', $rootScope.globals);
                        $cookieStore.put('session', session);

                        // console.log("access is ", $rootScope.globals.currentUser.access);

                    } else {
                       

                    }
                });

            
 
            
        }


        function SetCredentials2(email, password, user, session, callback) {
            // console.log("SET SET SET ME");

            ClearCredentials();

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
                                email: email,
                                authdata: authdata,
                                id: user.id,
                                first_name: user.first_name,
                                last_name: user.last_name,
                                access: processAccess(data.access)
                            }
                        };

                        if($rootScope.globals.currentUser.access.instructor.length > 0){
                             // console.log("we are an instructor SOMEWHERE, setting: ", $rootScope.globals.currentUser.access.instructor[0]);
                            $rootScope.globals.currentUser.current_club_instructor = $rootScope.globals.currentUser.access.instructor[0];
                        } else {
                             // console.log("ELSE ERROR: ", $rootScope.globals.currentUser.access);
                        }

                        $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line

                        $cookieStore.put('globals', $rootScope.globals);
                        $cookieStore.put('session', session);

                        // console.log("access is", $rootScope.globals.currentUser.access);

                        callback($rootScope.globals.currentUser) ;
                    } else {
                       
                        callback(false) ;
                    }
                });

            
 
            
        }
 
        function ClearCredentials() {
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