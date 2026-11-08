 app.controller('BookoutController', BookoutController);

    BookoutController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$interval', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'BookoutService', '$filter', 'InstructorCharges', 'PlaneService', '$http', '$cookieStore', 'AuthenticationService', 'CourseService', 'ToastService', 'AircraftChecksService', 'SoloRequirementsService', 'AirfieldHubService', 'CancellationFeesService', '$q'];
    function BookoutController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $interval, $timeout, uiCalendarConfig, BookingService, LicenceService, BookoutService, $filter, InstructorCharges, PlaneService, $http, $cookieStore, AuthenticationService, CourseService, ToastService, AircraftChecksService, SoloRequirementsService, AirfieldHubService, CancellationFeesService, $q) {
        
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        //this club ID needs to reflect the club that has been selected....
        //vm.club_id = 6;
        // SAY WHAAAAAT?

        //   {{ $rootScope.globals | json }} to be able to see what club was selected

     //vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;

        // vm.user = $rootScope.globals.currentUser;
        // vm.user_id = vm.user.id;

        vm.booking = {};

        //base location to sort the airfields below
        vm.wgs_n = "51.51";
        vm.wgs_e = "0.12";

        vm.change_booking = {};
        vm.show_change_plane = false;
        //we need to get the booking ID to pull as much data as we can!

        vm.bookout = {
            start: true,
            passengers: [],
            pic: {
                id: vm.user_id
            }
        };

        vm.reported_defects = [];

        vm.can_authorise = false;

        // Airworthiness/insurance book-out block popup state (force policy).
        vm.bookout_airworthiness = { visible: false };

        // ── Pilot checks / student solo state ──
        // (FRONTEND_BOOKOUT_PILOT_CHECKS_GUIDE.md)
        vm.bookout_pilot_checks = { visible: false };   // force-policy block popup
        vm.solo_intent = null;                          // 'student_solo' | 'solo_check' | null (dual bookouts)

        // The student's pre-solo readiness is shown by the shared <bo-presolo>
        // component (it fetches solo_requirements/status itself); it reports
        // back through vm.onPresoloStatus so the readiness rail can show an
        // informational "N requirement(s) outstanding" item (never blocking —
        // the server's pilot-checks policy decides).
        vm.presolo = null;                              // { requirements, all_satisfied, outstanding }

        // Toggle the "may send solo / solo check" intent on a dual bookout.
        vm.setSoloIntent = function(intent){
            vm.solo_intent = (vm.solo_intent === intent) ? null : intent;
            if (!vm.solo_intent) { vm.presolo = null; }
        };

        vm.onPresoloStatus = function(status){
            if (!status) { vm.presolo = null; return; }
            var reqs = angular.isArray(status.requirements) ? status.requirements : [];
            var outstanding = parseInt(status.outstanding, 10);
            if (isNaN(outstanding)) {
                outstanding = 0;
                for (var i = 0; i < reqs.length; i++) { if (!reqs[i].satisfied) { outstanding++; } }
            }
            vm.presolo = { requirements: reqs, all_satisfied: !!status.all_satisfied, outstanding: outstanding };
        };

        // Friendly next-step for an unmet requirement's state
        // (BACKEND_PRE_SOLO_COURSE_REQUIREMENTS_GUIDE.md §4.3/§4.4).
        vm.soloStateAction = function(state){
            switch (state) {
                case 'pending_review':              return 'Ask an instructor to review the questionnaire';
                case 'in_progress':                 return 'Finish and submit the questionnaire';
                case 'not_attempted':               return 'Complete the linked questionnaire or exam';
                case 'below_min_score':             return 'The pass mark was not reached — retake it';
                case 'not_passed':                  return 'Enter or achieve a passing exam result';
                case 'no_medical':                  return 'Add a medical to the student\'s records';
                case 'medical_expired':             return 'The medical has expired — renew it';
                case 'medical_class_not_accepted':  return 'A different medical class is required';
                case 'not_signed_off':              return 'Needs an instructor sign-off';
                default:                            return '';
            }
        };

        // The student ticked / unticked "Authorise Solo Flight". The pre-solo
        // panel appears with it (and fetches its own status); an old status
        // must not linger once the authorisation is off.
        vm.onAuthorisedSoloChange = function(){
            if (!vm.bookout.authorised_solo) { vm.presolo = null; }
        };

        // ── Aircraft Check A / Transit Check state ──
        vm.aircraft_check = {
            required: false,
            check_type: null,
            check_type_label: '',
            message: '',
            loading: false,
            lookup_failed: false,        // the "is a check needed?" lookup failed → book-out stays locked (fail closed)
            submitted: false,
            existing_check_id: null,
            prefilled: false,            // transit values were carried over from today's A-Check
            flights_since_check: null    // flights since that A-Check (0 → safe to prefill)
        };
        vm.check_form = {
            fuel_us_gallons: null,
            oil_quarts: null,
            checked_at: null,
            notes: '',
            confirmed: false
        };
        vm.check_submitting = false;

        // Parse a backend check timestamp (UTC "YYYY-MM-DD HH:MM:SS", or ISO) into a
        // Date object for the datetime-local input (which binds a Date, NOT a string —
        // a string throws [ngModel:datefmt]). Seconds zeroed for minute precision.
        // Returns null if it can't be parsed. Uses moment (available globally).
        function parseCheckDateTime(ts) {
            if (!ts) { return null; }
            var m = moment.utc(ts, 'YYYY-MM-DD HH:mm:ss', true);
            if (!m.isValid()) { m = moment.utc(ts); }        // lenient fallback (ISO etc.)
            if (!m.isValid()) { return null; }
            var d = m.local().toDate();
            d.setSeconds(0, 0);
            return d;
        }

        vm.bookout.plane = {
            id: 12,
            registration: "G-BSXA",
            type: "PA28",
            current_tacho: 5112.3,
            estimated_fuel: 100,
            consumption: 30,
            seats: 4,
            last_tacho: 3941.01,
            last_position: 12
        };


        

        //vm.custom_users = [];

        vm.dateFormat = 'date:HH:mm \'on\' dd/MM/yyyy';

        $scope.show_change_plane = function(){
            // //console.log("change plane");
            vm.show_change_plane = true;

        }

        // //console.log("PARASM", $stateParams);

        vm.seats_in_plane = function(){

            //base
            var no_seats = vm.bookout.plane.seats;

            //check if instructor aboard?
            if(vm.bookout.pic.id !== vm.user_id){   
                no_seats--;
            }

            if(vm.bookout.passengers.length > 0){
                no_seats = no_seats - vm.bookout.passengers.length;
            }

            //include self
            no_seats--;

            // //console.log(no_seats);

            //return final number
            return no_seats;
        }

        vm.init_passengers = function(){
            // var no_of_seats = vm.seats_in_plane();

            // //console.log("no_of_seats", no_of_seats);

            // for(var i=0;i<no_of_seats;i++){
            //     //console.log("-- loop", i);
            //     vm.bookout.passengers.push({
            //         first_name: "",
            //         last_name: "",
            //         email: "",
            //         user_id: i,
            //         status: ""
            //     });
            // };
        }
        

        $scope.amend_booking = function(){
            // //console.log("AMEND BOOKING NOW");

        }



        // BookoutService.GetAirfields("EG")
        //         .then(function (data) {
        //             //console.log(data);
        //             if(data.success){
        //                 //use GB airfields first...
        //                 vm.airfields = data.airfields;

        //             } else {
        //                 //console.log("WOOOPSIES...");
        //                 //this should be very very rare...
        //             }

        //         });



        // Defects decision — in-page now (was window.confirm). The acceptance
        // wording ("You accept to fly the aircraft despite the known defect(s)
        // reported by previous pilots") is on the decision panel the pilot
        // presses "Accept & fly" in, so the press itself is the acceptance.
        $scope.accept_defects = function(){
            vm.bookout.accept_defects = true;
        }

        // Reject → a sheet: Keep it / Amend booking / Cancel booking. The old
        // confirm("Would you like to cancel this booking?") did nothing on OK.
        $scope.reject_defects = function(){
            vm.bookout.accept_defects = false;
            vm.bo_reject = { visible: true, working: false };
        }


        $scope.get_hours_from_decimal = function(number){

            // if(time){
            //      var sign = time < 0 ? "-" : "";
            //      var hour = Math.floor(Math.abs(time));
            //      var min = Math.round((Math.abs(time) * 60) % 60);
            //      return sign + (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
            //  } else {
            //      return "N/A";
            //  }
            var sign = (number >= 0) ? 1 : -1;

            // Set positive value of number of sign negative
            number = number * sign;

            // Separate the int from the decimal part
            var hour = Math.floor(number);
            var decpart = number - hour;

            var min = 1 / 60;
            // Round to nearest minute
            decpart = min * Math.round(decpart / min);

            var minute = Math.floor(decpart * 60) + '';

            // Add padding if need
            if (minute.length < 2) {
            minute = '0' + minute; 
            }

            // Add Sign in final result
            sign = sign == 1 ? '' : '-';

            if(minute == 60){
                hour = hour+1;
                minute = '00';
            }

            // Concate hours and minutes
            var time = sign + hour + ':' + minute;

            return time;
            
        }




        $scope.get_airfields = function(name){

            if(name.length > 2 && name.length < 5){

                 BookoutService.GetAirfieldsByCode(name)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                       
                         if(vm.airfields.length == 0){
                            // //console.log("SETTINGS HERE");
                               vm.airfields = [
                                    {
                                        id:0,
                                        title: "NOT LISTED : "+ name,
                                        code: "ZZZZ",
                                        wgs_n: "0",
                                        wgs_e: "0"
                                    }];
                        }

                    } else {


                         //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            }

            if(name.length > 4){
                var code = name.replace(/\s/g, "_");
                BookoutService.GetAirfields(code)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;


                        if(vm.airfields.length == 0){
                            // //console.log("SETTINGS HERE");
                               vm.airfields = [
                                    {
                                        id:0,
                                        title: "NOT LISTED : "+ name,
                                        code: "ZZZZ",
                                        wgs_n: "0",
                                        wgs_e: "0"
                                    }];
                        }

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

            }


             

           
        }

        var setting_new_member;


        var set_new_member = function(email, index){
            // //console.log("before change ", vm.bookout.passengers);
            // //console.log("SET MEMBER NOW 123", vm.bookout.passengers[index]);
                
             var user_obj = {
                                id: 0,
                                email: email,
                                first_name: "",
                                last_name: "",
                                is_member: false,
                                status: "to_invite"
                            };

            if(vm.bookout.passengers[index].email !== ""){
                // //console.log("override it? and tell the server about it?", vm.bookout.passengers[index]);

                UserService.ChangeInvitation({from: vm.bookout.passengers[index], to: user_obj}, vm.bookout.booking_id)
                .then(function (data) {
                    if(data.success){
                        // //console.log("OK");

                    }
                });
            
            }
           

            // vm.custom_users.push(user_obj);
            // vm.members = vm.members.concat(vm.custom_users);
            // //console.log("CUSTOMER USERS", vm.custom_users);
            vm.bookout.passengers[index] = user_obj;
        }


        $scope.update_pic = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);

            if(vm.bookout.pic.user_id == vm.user.id && vm.bookout.instructor_id > 0){
                //console.log("okay... so you want the instructor to be put? interesting...");
                //adheres to booking

            } else if(vm.bookout.instructor_id > 0 && vm.bookout.pic.user_id == vm.bookout.instructor_id) {
                //console.log("okay so you now have your booked instructor as the PIC again - nice");
                //adheres to booking

            } else {
                //console.log("you've change instructor? what happened?");
                //availability has been checked hence we're OK

            }

            // The solo choices and the currency confirmation belong to the PIC
            // they were made for: a ticked "Authorise solo" was still sent after
            // switching the PIC back to the instructor.
            var pic_user = vm.bookout.pic ? vm.bookout.pic.user_id : null;
            if (!(vm.bookout.instructor_id > 0 && pic_user == vm.bookout.user_id)) {
                vm.bookout.authorised_solo = false;
            }
            if (!(vm.bookout.instructor_id > 0 && pic_user == vm.bookout.instructor_id)) {
                vm.solo_intent = null;
            }
            vm.presolo = null;
            vm.bookout.is_current = false;
        }


        // $scope.get_members = function(name, index){

        //     if(name.length > 2){

        //          MemberService.GetAllByClubAndName(vm.club_id, name)
        //         .then(function (data) {
        //             //console.log(data);
        //             if(data.success){
        //                 //use GB airfields first...
        //                 // var m = data.members;
        //                 // var members = m.concat(vm.custom_users);
        //                 vm.members = data.members;

        //             } else {



        //                 var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        //                 if(email_regex.test(name)){
        //                     //console.log("valid email address found");
        //                     //if entered bit is an email address
        //                     // vm.members = [
        //                     // {
        //                     //     id: 0,
        //                     //     email: name,
        //                     //     first_name: "",
        //                     //     last_name: "",
        //                     //     is_member: false
        //                     // }];
        //                         //console.log("BEFORE", setting_new_member);
        //                         clearTimeout(setting_new_member);
        //                         setting_new_member = undefined;
        //                         //console.log("AFTER", setting_new_member);

        //                         setting_new_member = setTimeout(set_new_member, 1000, name, index);
        //                         //console.log("again after", setting_new_member);
                            


        //                 } else {
        //                 //console.log("WOOOPSIES...");
        //                 //this should be very very rare...
        //                 }
                        

                   
        //             }

        //         });


        //     }
        // }





         vm.invite_new_passenger = function(index){

            // //console.log("HERE");
            // //console.log(vm.new_pax);

             if(vm.new_pax && vm.new_pax.email !== "" && vm.new_pax.is_member == false){


                 //send a single invitation to join the gang....
                 vm.new_pax.invited_by = vm.user.id;


                 BookoutService.AddPassenger(vm.new_pax, $stateParams.booking_id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                       ToastService.success('Invitation Sent', 'The invitation has been sent successfully');
                        vm.update_passenger_list();
                        vm.show_new_passenger_invitation = false;
                    }
                });






             } else {
                 ToastService.warning('Invalid Email', 'Please enter a valid email address to send the invitation to.');
             }
           


        }





        vm.add_new_passenger = function(index){

            // //console.log("HERE");
            // //console.log(vm.new_pax);

            // The picker is a tagging ui-select: Enter on typed text sets the
            // model to a plain STRING (and clearing it to undefined) — the
            // invite form below binds vm.new_pax.email etc., so hand it an
            // object built from whatever was typed.
            if (!vm.new_pax || angular.isString(vm.new_pax)) {
                var typed = angular.isString(vm.new_pax) ? vm.new_pax.trim() : '';
                vm.new_pax = { id: 0, email: '', first_name: '', last_name: '', is_member: false, status: '', not_found: true };
                if (typed.indexOf('@') > -1) {
                    vm.new_pax.email = typed.toLowerCase();
                } else if (typed) {
                    var parts = typed.split(/\s+/);
                    vm.new_pax.first_name = parts.shift();
                    vm.new_pax.last_name = parts.join(' ');
                }
            }

            if(vm.new_pax.is_member){


                //then we already have everything we need and we just invite them separately
                // var to_send = {
                //     booking_id: $stateParams.booking_id,
                //     club_id: vm.club_id
                // }
                vm.new_pax.club_id = vm.club_id;
                vm.new_pax.invited_by = vm.user.id;

                //add passenger to booking
                BookoutService.AddPassenger(vm.new_pax, $stateParams.booking_id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                       


                        //let's call the update on the passengers
                        vm.update_passenger_list();




                    }
                });




            } else {
                vm.show_new_passenger_invitation = true;
            }

           


        }


        vm.new_pax = {
                        id: 0,
                        email: "",
                        first_name: "",
                        last_name: "",
                        is_member: false,
                        status: "",
                        not_found: true
                    };

        vm.close_passenger_invitation = function(){
            vm.show_new_passenger_invitation = false;
        }

        $scope.get_members = function(name){

            // //console.log("GET MEMBER", name);
            ////console.log("get members", name);
            if((vm.club_id == 0 || !vm.club_id) && vm.bookout.plane && vm.bookout.plane.id){
                vm.club_id = vm.bookout.plane.club_id;
            }

            if(name.length > 2){

                 MemberService.GetAllByClubAndName(vm.club_id, name)
                .then(function (data) {
                    ////console.log(data);
                    if(data.success){
                        //use GB airfields first...

                        //filter the ones that are already there....
                        // myArray.filter( el => !toRemove.includes( el ) );
                        // var myArray = data.members.filter( el => !vm.bookout.passengers.includes( el ) ); //filter( ( el ) => !vm.bookout.passengers.includes( el ) );


                        var filtered_array = data.members.filter(ar => !vm.bookout.passengers.find(rm => (rm.email === ar.email) ));
                        //vm.members = data.members;
                        vm.members = filtered_array;
                        ////console.log("CHECK JANES", myArray);


                        if(vm.members.length < 1){
                            // //console.log("not found in members");
                            // vm.new_pax.not_found = true;
                            // vm.new_pax.email = "";
                            // vm.new_pax.status = "";
                            // vm.new_pax.first_name = "";
                            // vm.new_pax.last_name = "";

                            vm.new_pax = {
                                id: 0,
                                email: "",
                                first_name: "",
                                last_name: "",
                                is_member: false,
                                status: "",
                                not_found: true
                            };

                            
                           // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

                            var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            if(email_regex.test(name)){

                                vm.new_pax.email = name;

                            } else {
                                if(name.indexOf(" ") > -1){
                                    var splits = name.split(" ");
                                    vm.new_pax.first_name = splits[0];
                                    vm.new_pax.last_name = splits[1];
                                } else {
                                    vm.new_pax.first_name = name;
                                }
                            }


                        }

                    } else {
                        //clear original vals
                            vm.new_pax.status = "";
                            vm.new_pax.email = "";
                            vm.new_pax.first_name = "";
                            vm.new_pax.last_name = "";
                        //if email add the email here

                             var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            
                                       // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

                            if(email_regex.test(name)){
                                ////console.log("here we match?  it is an email?");
                                vm.new_pax.email = name;
                                vm.new_pax.not_found = true;

                            } else {
                                ////console.log("user not found?");
                            }


                        // var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                        // if(email_regex.test(name)){

                        //         clearTimeout(setting_new_member);
                        //         setting_new_member = undefined;

                        //         setting_new_member = setTimeout(set_new_member, 900, name, index);

                        // } else {
                        //     //console.log("WOOOPSIES...");
                        //     //this should be very very rare...
                        // }
                        

                   
                    }

                });


            }
        }

        var get_all_members = function(){


                 MemberService.GetAllByClub(vm.club_id)
                .then(function (data) {
                    ////console.log(data);
                        //use GB airfields first...
                        vm.members = data;
                        for(var i=0;i<vm.members.length;i++){
                            vm.members[i].is_member = true;
                        }
                        // //console.log(vm.members);
                
                });

            
        }

        get_all_members();


        // LEGACY MODE as of 7/11/26 — not used by any view. It called UserService.InvitePassenger → POST /invitations,
        // which the backend no longer accepts (NOT_FOUND). Passengers are invited with POST invitations/new_passenger/{booking_id}.
        vm.invite_passenger = function(email, i){
            ////console.log("SEND INVITE", vm.bookout.passengers[i]);

            var passenger_membership_id = 9;

            UserService.InvitePassenger(vm.bookout.passengers[i].email, vm.user_id, vm.club_id, passenger_membership_id, vm.bookout.booking_id)
                .then(function (data) {
                        //use GB airfields first...
                        ////console.log("INVITE IS ", data);
                        vm.bookout.passengers[i].status = data.invite.status;
                        vm.bookout.passengers[i].invitation_token = data.invite.invitation_token;
                
                });


        }

        vm.refresh_passenger = function(member, i){
            ////console.log("SEND REFRESH");
            UserService.GetInvite(vm.bookout.passengers[i].invitation_token)
                .then(function (data) {
                        //use GB airfields first...
                        // //console.log("INVITED IS ", data);
                        vm.bookout.passengers[i].status = data.status;
                        vm.bookout.passengers[i].user_id = data.user_id;
                        vm.bookout.passengers[i].first_name = data.first_name;
                        vm.bookout.passengers[i].last_name = data.last_name;
                });
            //vm.bookout.passengers[i].status = "accepted";
        }

        vm.update_passenger_list = function(){

            //let's get ALL the ones required
             BookoutService.GetPassengers($stateParams.booking_id)
                .then(function (data) {
                    ////console.log(data);
                    if(data.success){
                       //alert("GET");
                       ////console.log("PAX", data.passengers);
                       vm.bookout.passengers = boNormalisePax(data.passengers);

                       vm.new_pax = {
                            id: 0,
                            email: "",
                            first_name: "",
                            last_name: "",
                            is_member: false,
                            status: "",
                            not_found: true
                        };

                    }
                });

        }

        vm.resend_invitation = function(obj){

            var to_resend = obj;
             BookingService.ResendInvitation(to_resend, to_resend.id)
                .then(function(data){
                    // //console.log(data);
                    if(data.success == true){
                        ToastService.success('Success', data.message);
                    } else {
                        ToastService.error('Error', data.message);
                    }

                });
        }


        vm.refresh_all_passenger = function(){
            var i = 0;
             function next() {
                i++;
                if(i < vm.bookout.passengers.length) {
                    // //console.log("SEND REFRESH EVERYTHING");
                    if(vm.bookout.passengers[i] && vm.bookout.passengers[i].status == "invited" && vm.bookout.passengers[i].invitation_token !== ""){

                         UserService.GetInvite(vm.bookout.passengers[i].invitation_token)
                            .then(function (data) {
                                    // //console.log("INVITED IS ", data);
                                    // //console.log("INVITED IS ", vm.bookout.passengers[i]);
                                    vm.bookout.passengers[i].status = data.status;
                                    vm.bookout.passengers[i].user_id = data.user_id;
                                    vm.bookout.passengers[i].first_name = data.first_name;
                                    vm.bookout.passengers[i].last_name = data.last_name;
                            });
                    }
                } else {
                   /// nothing
                }
            }
            next();
         
            //vm.bookout.passengers[i].status = "accepted";
        }


        vm.get_passenger_status = function(member){
            // //console.log("MEMBER", member);
            if(member){


                if(member.is_member){
                    // //console.log("this one is true");
                    return "OK - is already club member";
                } else {

                    if(member.status == "accepted"){
                        return "OK - passenger has accepted the terms";
                    } else if(member.status == "declined"){
                        return "NO - passenger declined the offer";
                    } else if(member.status == "invited"){
                        return "Waiting for user response";
                    } else {
                        return "";
                    }
                }

                return "";
            }

        }


        

        vm.pics = [
            
        ];


        // the ARRIVAL option should be automatically filled in when there was a departure prior to the flight and home airfield was
        //entered as the destination

        vm.flight_types = [
            {
                id: 1,
                title: "Local"
            }, 
            {
                id: 2,
                title: "Departure"
            },
            {
                id: 3,
                title: "Circuits"
            },
            {
                id: 4,
                title: "Other"
            }
        ];


        vm.biggin_hill = {

            routes: [
                {
                    id: 1,
                    title: "Kenley"
                },
                {
                    id: 2,
                    title: "Sevenoaks"
                },
                {
                    id: 3,
                    title: "Swanley"
                },
                {
                    id: 4,
                    title: "Other"
                }
            ],
            parking: ""

        }

        vm.flight_rules = [
            {
                id: 1,
                title: "VFR"
            },
            {
                id: 2,
                title: "IFR"
            }
        ];



       


        function clean_times(which, start_end, compared_to = null){

            var compare_date;

            switch(which){
                case 'today':
                    compare_date = new Date();
                break;
                case 'past':
                    //we need to consider the back-dating as possible issue...
                    compare_date = new Date("1990-07-26");
                break;
                case 'future':
                    compare_date = new Date("1990-07-26");
                break;
                case 'after':
                //differentiate here
                    compare_date = new Date(compared_to);
                break;
                case 'before':
                //differentiate here
                    compare_date = new Date(compared_to);
                break;
            }

            var this_date = new Date();


            vm[start_end].forEach(function(time, i){

                        //this may very well be the case function here to change when the re-do the times            
                        var split_time = time.time.split(":");
                        this_date.setHours(split_time[0]);
                        this_date.setMinutes(split_time[1]);
                        this_date.setSeconds(0);


                        if( moment(this_date).isAfter(moment(compare_date)) ){
                            vm[start_end][i].disabled = 0;
                            //we should / could be checking airport opening hours...?
                            //vm[start_end][i].disabled = check_business_hours(parseInt(split_time[0]), parseInt(split_time[1]), (start_end == "start_times")? 1 : 0);
                        } else {
                            vm[start_end][i].disabled = 1;
                        }
                    });

                //by definition as we are changing something to cause this function from being called - we need to recalculate the times:
                //calculate_duration();

        }


        vm.start_times = [];
        vm.all_times = [];

        for(var i=0;i<24;i++){

                for(var j=0; j<(60/5); j++){
                    var k = 5 * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.start_times.push({time: i+":"+k, disabled: false});
                }

                for(var j=0; j<(60/10); j++){
                    var k = 10 * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.all_times.push({time: i+":"+k, disabled: false});
                }
           

        }
        clean_times('today', 'start_times');
        clean_times('future', 'all_times');
        vm.init_passengers();
        // vm.bookout.pic = vm.pics[0];
        vm.currency_days = 28;
        vm.extra_information_required = false;
        vm.filing_flightplan = false;

        vm.instructor_charges = [];

        vm.club = {
            plane: {}
        };

        switch($state.current.data.action){
            case "add":
                console.log("ADD");
                    //vm.selected_rating = vm.ratings[0];
                    //vm.selected_rating = 

                    // //console.log("AA", vm.selected_rating);
                // //console.log("booking_id", $stateParams.booking_id);
                //so now we can load the BOOKING with this ID, and therefore can sort it all out :)
                // let us preload the content required from the booking - fetch the booking
                // //console.log("FETCH THE BOOKING");

                BookingService.GetForBookout(vm.user.id, $stateParams.booking_id)
                 .then(function (data) {
                    // //console.log("data is : ", data);
                    if(data.success){
                        // //console.log("success");
                        vm.booking = data.booking;
                        MemberService.GetAllByPicsBookinout(data.booking.id, data.booking.club_id, vm.user.id)
                            .then(function (pics) {
                                    // a failed call resolves {success:false} — never an array
                                    if (!angular.isArray(pics)) { pics = []; }
                                    //use GB airfields first...
                                    ////console.log("PICS ARE", pics);

                                    // if(data.booking.course_id){
                                    //      CourseService.GetChargesByCourseId(data.booking.course_id)
                                    //     .then(function(data){
                                    //         vm.instructor_charges = data.items;  
                                    //     });
                                    // } else {
                                    //      InstructorCharges.GetByClubId(data.booking.club_id)
                                    //     .then(function(data){
                                    //         vm.instructor_charges = data.items;  
                                    //     });
                                    // }
                                   


                                    PlaneService.GetByIdMaintenance(vm.booking.plane.id, data.booking.club_id)
                                    .then(function(data){
                                        vm.club.plane = (data && typeof data === 'object') ? data : {};

                                        status();
                                        // the band + the client airworthiness gate read vm.club.plane:
                                        // the book-out stays locked until it has arrived
                                        vm.bo_plane_loaded = true;

                                        //console.log("BOOOO - get all maintenance....", vm.club.plane);
                                        // vm.page_title = "Edit a Plane Maintenance - "+vm.club.plane.registration;
                                    });


                                    vm.pics = pics;
                                    //vm.bookout.pic
                                    process_booking_to_bookout(data.booking);

                            });

                    } else {
                        // no access / not found: say so instead of an empty form
                        vm.bo_load_error = (data && typeof data.message === 'string' && data.message) ? data.message : "We couldn't load this booking.";
                    }
                });

                




            break;
            case "edit":

            console.log("EDIT ONE");
            // //console.log("PARAMS: ", $stateParams);

             LicenceService.GetById($stateParams.licence_id)
                .then(function (data) {
                    if(data.success){
                        vm.licence = data.licence;
                        vm.licence.licence_issue_date = new Date(vm.licence.licence_issue_date);
                        vm.licence.licence_expiry_date = new Date(vm.licence.licence_expiry_date);
                        // //console.log("licence", vm.licence);

                        vm.licence.licence_type = $.grep(vm.licence_types, function(e){ return e.id == vm.licence.licence_id; })[0];
                        vm.licence.state_of_issue = $.grep(vm.authority, function(e){ return e.id == vm.licence.authority_id; })[0];
                        // //console.log("SET", vm.licence.state_of_issue);

                        //pre-selection bits?
                        // //console.log("NEW RATINGS", vm.licence.ratings);
                        for(var i=0;i<vm.licence.ratings.length;i++){
                            delete vm.licence.ratings[i].id;
                            vm.licence.ratings[i].id = vm.licence.ratings[i].rating_id;
                            delete vm.licence.ratings[i].rating_id;
                            vm.licence.ratings[i].test_date = new Date(vm.licence.ratings[i].test_date);
                            vm.licence.ratings[i].expiry_date = new Date(vm.licence.ratings[i].expiry_date);

                            //need to remove the rating from the ratings lists too :)
                            vm.ratings = $.grep(vm.ratings, function(e){ 
                                return e.id != vm.licence.ratings[i].id; 
                            });

                        }



                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });



            break;
            case "list":

                // //console.log("LIST ALL");

                 //1 get the user's licence...
                 //list stuff

                LicenceService.GetByUserId(vm.user_id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        vm.user_licences = data.licences;

                    } else {
                        // //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            break;
            default:
                 //console.log("none of the above... redirect somewhere?");
            break;
        }  


        function base64ToBlob(base64) {
          const binaryString = window.atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; ++i) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          return new Blob([bytes], { type: 'application/pdf' });
        };


        $scope.show_file_now = false;
        $scope.show_file_url = "";

        // $scope.show_file = function(url){
        //    // var url = "api/v1/plane_radio_licence/show_file/"+url;
        //    //1559216525VmmkQHNrVx6yuTZzDz0h0Q7.jpg.jpg

        //     var ddd = url.replace(/^.*[\\\/]/, '');


        //    var url = "api/v1/plane_documents/show_file/"+ddd;
        //     $http.get(url).
        //       success(function(data, status, headers, config) {
        //         // 400/500 errors show up here
        //         //console.log("STATUS", status);
        //         if (status == 404 || status == 401)
        //         {
        //             alert("file not found");
        //             //console.log('Should never happen');

        //         }
        //         if(status == 200){

        //            $scope.show_file_url = url;
        //           // $scope.expression = '<embed src="'+url+'" width="100%" height="auto" />';
        //             $scope.show_file_now = true;

        //             setTimeout(function(){
        //                 var divElement = angular.element(document.querySelector('#add_embed'));
        //                 var htmlElement = angular.element('<embed src="'+url+'" width="100%" height="auto" />');
        //                 divElement.append(htmlElement);
        //                 $compile(divElement)($scope);
        //             }, 500)

                    


        //         }
        //       }).
        //       error(function(data, status, headers, config) {
        //         // never reached even for 400/500 status codes
        //         //console.log("STATUS", status);
        //          if (status == 404 || status == 401)
        //         {
        //             alert("file not found");
        //             //console.log('Should never happen');

        //         }
        //       });
        // }      


        // $scope.show_file = function(doc) {
        //     var data = $.param({
        //         id: doc
        //     });

        //     var ddd = doc.replace(/^.*[\\\/]/, '');

        //     $http.get('api/v1/plane_documents/show_file/'+ddd, {
        //             responseType: 'arraybuffer'
        //         })
        //         .success(function(data, status, headers) {
        //             var zipName = processArrayBufferToBlob(data, headers);

        //             //Delete file from temp folder in server - file needs to remain open until blob is created
        //             //deleteFileFromServerTemp(zipName);
        //         }).error(function(data, status) {
        //             alert("There was an error downloading the selected document(s).");
        //         })
        // };

        $scope.show_file = function(doc, type) {
            var data = $.param({
                id: doc
            });

            //alert("type", type);

            var controller = "plane_documents";

            switch(type){
                 case "radio": 
                    controller = "plane_radio_licence";
                break;
                 case "insurance": 
                    controller = "plane_insurance";
                break;
                 case "certificate":
                    controller = "plane_certificate";
                break;
                // the ARC (airworthiness_document.document_route === 'plane_arc')
                case "arc":
                    controller = "plane_arc";
                break;
                case "noise":
                    // noise certificates live under plane_noise_certificate — plane_documents
                    // never had the file (its 401 "not found" logged the pilot out)
                    controller = "plane_noise_certificate";
                break;
                case "crs":
                    controller = "plane_crs";
                break;
                case "docs":
                    controller = "plane_documents";
                break;
                default:
                    controller = "plane_documents";
                break;
            }

            var ddd = doc.replace(/^.*[\\\/]/, '');

            // returned so the redesigned document rows can spin their Open button
            return $http.get('api/v1/'+controller+'/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s)');
                })
        };

         function processArrayBufferToBlob(data, headers) {
            headers = headers();
            var filename = headers['x-filename'] || 'download.pdf';
            var contentType = headers['content-type'] || 'application/octet-stream';

            try {
                var blob = new Blob([data], { type: contentType });
                var url = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(function() { URL.revokeObjectURL(url); }, 250);
            } catch (ex) {
                $log.info("Download failed:");
                $log.info(ex);
            }

            return filename;
        };


        $scope.close_file = function(){
            $scope.show_file_now = false;
            $scope.show_file_url = "";
        }

        $scope.applyFilter = function(model, filter) {
            if(filter){

                var pieces = filter.split(':');

                var filterName = pieces[0];

                var params = [model];

                if(pieces.length>1){
                    
                    // //console.log("hello", pieces.slice(1).join(":"));
                    if(filterName.toLowerCase() == "date"){
                       params.push( pieces.slice(1).join(":") );
                    }
                    //params = params.slice(1, -1);
                    // //console.log("contact it", params);

                } else {
                    params = params.concat(pieces.slice(1));
                }

                return $filter(filterName).apply(this,params);
            }else{
                return model;
            }
        }

        $scope.status = {
            days: "",
            hours: "",
            insurance: "",
            certificate: "",
            radio_licence: "",
        };

        function status(){

            var plane = vm.club.plane;

            if(plane.maintenance){

                $scope.status.days = (plane.maintenance.days_remaining > 0)? "ok" : "expired";
                $scope.status.hours = (plane.maintenance.hours_remaining > 0)? "ok" : "expired";

            }

            // (a plane without one of these documents used to throw here). The server's status
            // wins: a CofA / a radio licence without an expiry is "ok" (days_to_expiry NULL), and
            // the ARC / Permit is airworthiness_document (BACKEND_AIRCRAFT_DOCUMENTS_ACCESS_GUIDE.md §10)
            function docStatus(doc){
                if (!doc) { return "expired"; }
                if (doc.status) { return doc.status; }
                return (doc.days_to_expiry > 0) ? "ok" : "expired";
            }
            $scope.status.certificate = docStatus(plane.airworthiness_document || plane.certificate);
            $scope.status.insurance = docStatus(plane.insurance);
            $scope.status.radio_licence = docStatus(plane.radio_licence);

            boBuildDocs();

        }

        // Returns the charges promise (the draft restore waits on it to re-pick
        // the tuition); callers that ignore it are unaffected.
        vm.update_course = function(){

            if(vm.bookout.selected_course && vm.bookout.selected_course.id > 0){
                //let us set it
                // console.log("ONE COURSE?", vm.bookout.selected_course.id);
                 return CourseService.GetChargesByCourseId(vm.bookout.selected_course.id)
                                        .then(function(data){
                                            // [] when refused (instructor_charges reads, book-out guide §16.5)
                                            vm.instructor_charges = (data && data.items) || [];

                                            if(vm.instructor_charges.length == 1){
                                                vm.bookout.tuition_required = vm.instructor_charges[0];
                                            }

                                        });

            } else {
                // console.log("MORE COURSE?");
                //let us clear it?
                 return InstructorCharges.GetByClubId(vm.bookout.club_id)
                                        .then(function(data){
                                            // [] when refused (instructor_charges reads, book-out guide §16.5)
                                            vm.instructor_charges = (data && data.items) || [];

                                            if(vm.instructor_charges.length == 1){
                                                vm.bookout.tuition_required = vm.instructor_charges[0];
                                            }
                                             
                                        });
                                           
            }

        }

        function process_booking_to_bookout(booking){


            //vm.bookout is where we want to fill the content....
            vm.bookout.booking_id = booking.id;
            vm.bookout.club_id = booking.club_id;
            vm.bookout.user_id = booking.user_id;
            vm.bookout.plane = booking.plane;
            vm.club_id = booking.club_id;
            vm.bookout.lesson_id = $stateParams.lesson_id || 0;
            // "YYYY-MM-DD HH:mm:ss" — new Date() on that is Invalid Date on iOS Safari
            vm.bookout.return = boParseDate(booking.end);
            vm.bookout.booking_start = boParseDate(booking.start);
            vm.bo_flight_date = $filter('date')(vm.bookout.booking_start, 'yyyy-MM-dd');   // <bo-presolo flight-date>

            // what the draft restore must wait for (each resolves, never rejects)
            var bo_loads = [];


            if((vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ){
                //console.log("NOT BOOKING FOR SELF?");
                vm.can_authorise = true;
                //prepare_add_edit();
            }


            bo_loads.push(boLoadDefects());

            //to be able to update the content of the members on the lists...
            get_all_members();

            //we need to update the PICS now...


            //we need to know where the plane was last booked-in at 
            //(ie: if last flight bookout was completed - where the plane landed at last)
            //if the last booking was not yet completed, then we can assume that this last flight was returning to base.



            if(booking.instructor && booking.instructor.id > 0){
                // then we need to set the PIC as the instructor
                //select from pics where user_id = booking.user_id;
                var selected_pic = vm.pics.find(item => item.user_id === booking.instructor.id);
                //set the PIC now...
                vm.bookout.pic = selected_pic;
                vm.bookout.instructor_id = booking.instructor.id;
                vm.bookout.instructor = booking.instructor;
                vm.bookout.course_id = booking.course_id;

               
                //set the tuition now... 
                //console.log("BOOKING HERE IS : ", booking);
                vm.bookout.tuition_required = booking.tuition_required;

                // Potential solo (bookings.solo — set on the scheduler v2 panel or by a solo lesson):
                // pre-set "I may send this student solo" so the provisional STUDENT SOLO airfield
                // book-out is created on save; the pre-solo panel shows the readiness straight away.
                // Other bookings are untouched (the instructor still picks the intent by hand).
                if(parseInt(booking.solo, 10) === 1 && !vm.solo_intent){
                    vm.solo_intent = 'student_solo';
                }

                // vm.bookout.tuition_required
                bo_loads.push(CourseService.GetCoursesByClubId(vm.bookout.club_id)
                                .then(function(data){
                                    vm.courses = CourseService.sortByDisplayOrder(data.items);   
                                     console.log("COURSES", vm.courses);
                                     console.log("COURSES", vm.bookout.course_id);

                                    //set new_booking.tuition-required 
                                    vm.bookout.selected_course = vm.courses.find(function(course, index) {
                                                                    if(course.id == vm.bookout.course_id)
                                                                        return true;
                                                                });

                                    //link to instructor charges??

                                    //auto-fill??
                                    console.log("vm.bookout.course_id", vm.bookout.course_id);
                                    return vm.update_course();



                 }));

                 // vm.bookout.tuition_required = vm.courses.find(function(course, index) {
                 //                                                    if(course.id == vm.bookout.course_id)
                 //                                                        return true;
                 //                                                });

                var selected_put = vm.pics.find(item => item.user_id === booking.user_id);
                vm.bookout.put = selected_put;
                //console.log("PICS ARE : ", vm.pics);
                //console.log("INSTRUCTOR IS : ", vm.bookout.instructor);
                //console.log("user IS : ", booking.user_id);
                //console.log("PIC IS : ", booking.pic);
                //console.log("PUT IS : ", vm.bookout.put);

            } else {
                //then the user is the PIC
                var selected_pic = vm.pics.find(item => item.user_id === booking.user_id);
                vm.bookout.pic = selected_pic;

            }

            //preload the pax
            vm.bookout.passengers = boNormalisePax(booking.passengers);
            //setup the pax addition on the bookout page
            vm.init_passengers();


            if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.wgs_n){
                vm.wgs_n = booking.plane_details.location.wgs_n
                vm.wgs_e = booking.plane_details.location.wgs_e;
            }
            var location_default = "";

            if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.code){
                location_default = booking.plane_details.location.code.slice(0, -1);
            } else {
                location_default = "EG";
            }


            bo_loads.push(BookoutService.GetAirfieldsByCode(location_default)
                .then(function (data) {
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                        var selected_location = vm.airfields.find(item => item.id === booking.plane_details.location.id);
                        //console.log("selected_location", selected_location);
                        vm.bookout.from_airfield = selected_location;
                       }
                    }));

            // ── Aircraft Check A / Transit Check query ──
            loadRequiredCheck();


            //booking.plane_details.location.id
            // vm.bookout.pic = selected_pic;

            vm.bo_loaded = true;

            // The pre-solo panel's "Review now" leaves the page and comes back:
            // once everything the form needs has arrived, put back what the
            // pilot had filled in (only on the book-out page itself — booked_out
            // shares this controller).
            $q.all(bo_loads).then(boRestoreDraft, boRestoreDraft);

        }

        // ── "Is a Check A / Transit Check needed?" ──
        // Fails CLOSED: a failed lookup used to leave required=false and let the
        // book-out through; now it sets lookup_failed, the book-out stays locked
        // and the check card offers Retry. Re-run after the server's
        // aircraft_check_required refusal, so it only ever FILLS empty fields —
        // what the pilot typed (or a restored draft) is never overwritten.
        var bo_check_seq = 0;
        function loadRequiredCheck(){
            var plane_id = vm.bookout.plane && vm.bookout.plane.id;
            if (!plane_id) { return $q.when(); }
            var seq = ++bo_check_seq;
            vm.aircraft_check.loading = true;
            vm.aircraft_check.lookup_failed = false;
            var flight_date = $filter('date')(vm.bookout.booking_start, 'yyyy-MM-dd');
            return AircraftChecksService.GetRequiredCheck(plane_id, flight_date, vm.bookout.booking_id)
                .then(function(data) {
                    if (seq !== bo_check_seq) { return; }   // a newer lookup owns the state
                    vm.aircraft_check.loading = false;
                    if (!data || !data.success) {
                        vm.aircraft_check.lookup_failed = true;
                        return;
                    }
                    vm.aircraft_check.required = data.required;
                    vm.aircraft_check.check_type = data.check_type;
                    vm.aircraft_check.message = data.message;
                    vm.aircraft_check.existing_check_id = data.existing_check_id || null;
                    vm.aircraft_check.flights_since_check =
                        (typeof data.flights_since_check !== 'undefined') ? data.flights_since_check : null;
                    vm.aircraft_check.prefilled = false;

                    if (data.required) {
                        // The check time defaults to fresh (now). datetime-local
                        // binds a DATE object in AngularJS 1.x (a string throws
                        // [ngModel:datefmt]); seconds/ms zeroed for minute precision.
                        if (!vm.check_form.checked_at) {
                            var now = new Date();
                            now.setSeconds(0, 0);
                            vm.check_form.checked_at = now;
                        }
                        vm.aircraft_check.check_type_label = (data.check_type === 'check_a') ? 'Check A' : 'Transit Check';

                        // ── Pre-fill a TRANSIT check from today's A-Check ──
                        // Carry over the A-Check's fuel/oil/notes (editable) when it
                        // hands back the earlier check's values — UNLESS there have
                        // explicitly been flights since (flights_since_check > 0), in
                        // which case fresh numbers are required. flights_since_check
                        // being 0 OR unknown (null/absent) is treated as "safe to
                        // carry over". Coerced to a number so a string "0" still works.
                        var prior = data.existing_check_data || data.a_check_data;
                        var flightsSince = vm.aircraft_check.flights_since_check;
                        var flightsSinceNum = (flightsSince === null || typeof flightsSince === 'undefined')
                            ? null : Number(flightsSince);
                        var noFlightsSince = (flightsSinceNum === null) || (flightsSinceNum <= 0);
                        if (data.check_type === 'transit_check' && prior && noFlightsSince && !boCheckFormTouched()) {
                            if (prior.fuel_us_gallons != null) { vm.check_form.fuel_us_gallons = prior.fuel_us_gallons; }
                            if (prior.oil_quarts != null)      { vm.check_form.oil_quarts = prior.oil_quarts; }
                            if (prior.notes)                   { vm.check_form.notes = prior.notes; }
                            // Also carry the A-Check's original date/time across
                            // (editable). The backend sends UTC "YYYY-MM-DD HH:MM:SS";
                            // the datetime-local input needs "yyyy-MM-ddTHH:mm".
                            var priorTime = prior.checked_at || prior.checked_at_utc;
                            var parsedTime = parseCheckDateTime(priorTime);
                            if (parsedTime) { vm.check_form.checked_at = parsedTime; }
                            vm.aircraft_check.prefilled = true;
                        }
                    }

                    // (re-runs can also UN-submit: the server gate says a check is still missing)
                    vm.aircraft_check.submitted = !!data.existing_check_id;
                });
        }

        // fuel / oil / notes already hold the pilot's (or a restored draft's) values
        function boCheckFormTouched(){
            var cf = vm.check_form;
            return (cf.fuel_us_gallons != null && cf.fuel_us_gallons !== '') ||
                   (cf.oil_quarts != null && cf.oil_quarts !== '') ||
                   !!cf.notes;
        }


        // ═══════════════════════════════════════════════════════════
        //  AirfieldHub — can we file the PPR for this destination?
        //  §4 of FRONTEND_AIRFIELDHUB_INTEGRATION_GUIDE.md.
        //
        //  This is INFORMATION ONLY. It never blocks, never gates the
        //  save, and never delays the submit: dispatch is queued
        //  server-side and the PPR decision arrives later by webhook.
        //  If anything here fails we simply say nothing, and the pilot
        //  arranges PPR the way they always have.
        // ═══════════════════════════════════════════════════════════

        vm.afh = { env: null, checking: false, result: null };

        // Resolve the club's AirfieldHub environment once. A club with the
        // integration off (or not effective) gets env=null, which disables
        // the whole feature for this form — no requests, no UI.
        function afhInit() {
            var club_id = vm.club_id || (vm.bookout && vm.bookout.plane && vm.bookout.plane.club_id);
            if (!club_id || vm.afh.env) { return; }

            AirfieldHubService.GetConfig(club_id)
                .then(function (data) {
                    // `effective` already means enabled AND environment set AND
                    // that environment has a key. Stage 0 dispatches nothing,
                    // so promising automatic PPR then would be a lie.
                    if (data && data.success && data.effective && Number(data.stage) > 0) {
                        vm.afh.env = data.environment;
                        // A destination may already be picked (edit / prefilled
                        // from a booking) — check it now that we know the env.
                        afhCheckDestination();
                    }
                });
        }

        function afhCheckDestination() {
            var to = vm.bookout && vm.bookout.to_airfield;

            // No environment, or no destination yet → show nothing.
            if (!vm.afh.env || !to) {
                vm.afh.result = null;
                return;
            }

            // The picker allows free text, so a destination can be a string
            // with no airfield record. Take whatever code we can find.
            var code = to.code || to.icao || (angular.isString(to) ? to : null);
            if (!code) { vm.afh.result = null; return; }

            vm.afh.checking = true;
            AirfieldHubService.LookupDestination(vm.afh.env, code)
                .then(function (res) {
                    vm.afh.checking = false;
                    // Guard against a slow response for a destination the
                    // pilot has since changed away from.
                    var current = vm.bookout && vm.bookout.to_airfield;
                    var currentCode = current && (current.code || current.icao);
                    if (currentCode && String(currentCode).toUpperCase() !== String(code).toUpperCase()) {
                        return;
                    }
                    vm.afh.result = res;
                });
        }

        vm.afhCheckDestination = afhCheckDestination;


        $scope.selected_airfield_check = function(){
            //console.log("airfield has been selected", vm.bookout.from_airfield.id);

            // AirfieldHub PPR availability for the chosen destination.
            afhInit();
            afhCheckDestination();

            // (the From picker can still be empty while its list loads)
            var from_id = vm.bookout.from_airfield ? vm.bookout.from_airfield.id : null;

            if(from_id == 150 || (vm.bookout.to_airfield && vm.bookout.to_airfield.id == 150)){
                //console.log("extra information required");
                vm.extra_information_required = true;
            } else {
                if(!vm.filing_flightplan && from_id !== 150){
                    if(vm.bookout.to_airfield && vm.bookout.to_airfield.id){
                        if(vm.bookout.to_airfield.id !== 150){
                            //console.log("not going to biggin and no need for filing a flightplan so wa can ignore this");
                            vm.extra_information_required = false;
                        }
                    } else {
                        //console.log("not going to biggin and no need for filing a flightplan so wa can ignore this");
                        vm.extra_information_required = false;
                    }
                    
                }
            }

        }


            $scope.add_rating = function(){

                //remove from first array
                vm.ratings = $.grep(vm.ratings, function(e){ 
                    return e.id != vm.selected_rating.id; 
                });

                vm.licence.ratings.push(vm.selected_rating);

                //clear selected
                delete vm.selected_rating;
                
                //clean the array to show what we want to show :)
                //delete $scope.formData.license.add_to[bit_type];

            }

            $scope.remove_rating = function(index){

                //add to dropdown
                vm.ratings.push(vm.licence.ratings[index]);
                vm.licence.ratings.splice(index,1)

                //$scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);

                //  //console.log($scope.formData.license[bit_type]);
                //  $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }

            //default add the first rating required...
            

            $scope.bookout_plane = function(){

                ////console.log("PAX ", vm.bookout.passengers);
                //flight type
                if(!vm.bookout.flight_type || vm.bookout.flight_type.id < 1){
                    ToastService.highlightField('flight_type');
                    ToastService.warning('Flight Type', 'You need to select a flight type - is this a local flight? Or a departure?');
                    return false;
                }

                if(!vm.bookout.pic || vm.bookout.pic.id < 1){
                    ToastService.highlightField('pic');
                    ToastService.warning('Missing PIC', 'You need to select a Pilot In Command (PIC)');
                    return false;
                }

                if( boCurrencyNeeded() && !vm.bookout.is_current ){
                    ToastService.highlightField('is_current');
                    ToastService.warning('Currency Check', 'Please confirm that you are current according to the club rules, as you do not have an instructor booked.');
                    return false;
                }







                //check the destination is entered if required
                // (Other (4) shows the To picker too — without a destination the
                // payload below threw on vm.bookout.to_airfield.id)
                if((vm.bookout.flight_type.id == 2 || vm.bookout.flight_type.id == 4) && (!vm.bookout.to_airfield || (vm.bookout.to_airfield.id < 1 && vm.bookout.to_airfield.title == "" ) )){
                    ToastService.highlightField('to_airfield');
                    ToastService.warning('Missing Destination', 'As you selected this flight to be a departure, please select a destination airfield');
                    return false;
                }










                if(!vm.bookout.accept_defects && vm.reported_defects.length > 0){
                    ToastService.highlightField('accept_defects');
                    ToastService.warning('Defects Acknowledgement', 'You must state that you have read the defects currently reported and accept to fly the plane in the condition provided prior to booking out the plane.');
                    return false;
                }

                // ── Aircraft Check A / Transit Check validation ──
                // We must KNOW whether a check is needed (the button is locked
                // meanwhile too — this is defence in depth).
                if (vm.aircraft_check.loading) {
                    ToastService.warning('Aircraft Check', 'Still checking whether a pre-flight check is needed — try again in a moment.');
                    return false;
                }
                if (vm.aircraft_check.lookup_failed) {
                    ToastService.warning('Aircraft Check', "We couldn't check whether a pre-flight check is needed. Retry the check on the Pre-flight check card.");
                    vm.bo_goto('check');
                    return false;
                }
                if (vm.aircraft_check.required && !vm.aircraft_check.submitted) {
                    if (!vm.check_form.fuel_us_gallons || vm.check_form.fuel_us_gallons <= 0) {
                        ToastService.warning('Aircraft Check', 'Please enter the fuel on board (US Gallons).');
                        return false;
                    }
                    if (!vm.check_form.oil_quarts || vm.check_form.oil_quarts <= 0) {
                        ToastService.warning('Aircraft Check', 'Please enter the oil on board (quarts).');
                        return false;
                    }
                    if (!vm.check_form.checked_at) {
                        ToastService.warning('Aircraft Check', 'Please enter the date and time that the check was performed.');
                        return false;
                    }
                    if (!vm.check_form.confirmed) {
                        ToastService.warning('Aircraft Check', 'You must confirm that you have performed this check and accept responsibility.');
                        return false;
                    }
                }

                //checking the pax are either member or accepted the invitation
                vm.refresh_all_passenger();

                var pax = vm.bookout.passengers;
                for(var i=0;i<pax.length;i++){
                    if(pax[i]["status"] == "to_invite"){
                        ToastService.warning('Passenger Invite', "You need to press the invitation button for your passenger who isn't already a member before booking out.");
                        return false;
                    }
                    if(pax[i]["status"] == "invited" && pax[i]["aboard"]){
                        ToastService.warning('Passenger Status', 'You need to make sure that your passenger has completed his membership and has agreed to the terms of your flight before you go flying.');
                        return false;
                    }
                }

                //then we compose our object for the server...

                var bookout_obj = {
                    club_id: vm.bookout.club_id,
                    plane_id: vm.bookout.plane.id,
                    user_id: vm.bookout.user_id,
                    pic_id: vm.bookout.pic.user_id,
                    booking_id: vm.bookout.booking_id,
                    is_pilot_current: vm.bookout.is_current,
                    // ticking the currency toggle IS the self-certification the server's force dialog offers
                    currency_override: (boCurrencyNeeded() && vm.bookout.is_current) ? 1 : 0,
                    // the instructor is PIC. pic.id is the MEMBERS row id and instructor.id a user id —
                    // comparing those made every book-out non-dual, so solo_intent was never sent.
                    dual_flight: (vm.bookout.instructor_id > 0 && Number(vm.bookout.pic.user_id) === Number(vm.bookout.instructor_id)) ? 1 : 0,
                    instructor_id: vm.bookout.instructor_id,
                    tuition_id: (vm.bookout.instructor_id > 0 && vm.bookout.tuition_required && !vm.bookout.authorised_solo) ? vm.bookout.tuition_required.id : 0,
                    detail_type_id: vm.bookout.flight_type.id,
                    from_airport_id: vm.bookout.from_airfield.id,
                    to_airport_id: (vm.bookout.flight_type.id == 1 || vm.bookout.flight_type.id == 3) ? vm.bookout.from_airfield.id : vm.bookout.to_airfield.id,
                    booked_out: 1,
                    booked_in: 0,
                    flight_date: new Date(vm.bookout.booking_start),
                    passengers: vm.bookout.passengers,
                    authorised_solo: (vm.bookout.authorised_solo)? true : false,
                    authorised_by: (vm.bookout.authorised_solo)? vm.user.id : 0,
                    //optional for Biggin / flightplan...
                    endurance_time: vm.bookout.endurance,
                    estimated_enroute_time: vm.bookout.en_route,
                    flight_rules: vm.bookout.flight_rule,
                    flight_notes: vm.bookout.additional_details,
                    parking_note: vm.bookout.parking_note,
                    estimated_departure: vm.bookout.departure,
                    routing_via_id: (vm.bookout.routing_via) ? vm.bookout.routing_via.id : 0,
                    lesson_id: vm.bookout.lesson_id || 0
                }



                 if(bookout_obj.to_airport_id == 0){
                    bookout_obj.new_to_airport = vm.bookout.to_airfield;
                    bookout_obj.new_to_airport.title = bookout_obj.new_to_airport.title.replace("NOT LISTED : ", "");
                }

                if(bookout_obj.from_airport_id == 0){
                    bookout_obj.new_from_airport = vm.bookout.from_airfield;
                    bookout_obj.new_from_airport.title = bookout_obj.new_from_airport.title.replace("NOT LISTED : ", "");
                }    


                // ── Student solo / pilot-checks fields ──
                // (FRONTEND_BOOKOUT_PILOT_CHECKS_GUIDE.md §5.1)
                if (bookout_obj.dual_flight == 1 && vm.solo_intent) {
                    // "I may send this student solo" / "solo check flight" —
                    // creates the provisional STUDENT SOLO airfield bookout.
                    bookout_obj.solo_intent = vm.solo_intent;
                    if (vm.bookout.put && vm.bookout.put.user_id) {
                        bookout_obj.put_id = vm.bookout.put.user_id;
                    }
                }
                if (vm.bookout.authorised_solo) {
                    // Who authorises the student solo — the booking's
                    // instructor (shown as "Pilot Authorising Flight").
                    bookout_obj.authorising_instructor_id = vm.bookout.instructor_id || 0;
                }

                // console.log("READY WITH: ", bookout_obj);
                // return false;

                // ── Submit aircraft check first if required, then bookout ──
                // Stash the payload so a Force book-out retry can resend it.
                vm._bookout_obj = bookout_obj;

                var doBookout = function(forceOverride) {
                    var payload = vm._bookout_obj;
                    if (forceOverride) payload.force_override = true;

                    vm.bookout_airworthiness.working = true;

                    BookoutService.SendBookout(vm.user.id, payload)
                    .then(function(data){
                        if(data.success){
                            // Book-out succeeded. Any airworthiness issues were already
                            // shown and acknowledged in the pre-book-out gate below, so
                            // just proceed to the booked-out screen.
                            vm.bookout_airworthiness = { visible: false };
                            vm.bookout_pilot_checks = { visible: false };
                            // Warn policy: checks ran, never block — surface each
                            // warning prominently (they persist across the redirect).
                            if (data.pilot_check_warning && data.pilot_check_warning.length) {
                                for (var w = 0; w < data.pilot_check_warning.length; w++) {
                                    ToastService.warning('Pilot Check', data.pilot_check_warning[w]);
                                }
                                // ...and kept for the booked-out screen, which lists them (toasts fade)
                                try { sessionStorage.setItem('bo_warnings_' + vm.bookout.booking_id, angular.toJson(data.pilot_check_warning)); } catch (e) {}
                            }
                            boDropDraft();
                            $state.go('dashboard.my_account.booked_out', {booking_id: vm.bookout.booking_id});
                        } else if (data.reason === 'pilot_checks') {
                            // Force policy: the pilot re-validation failed. Show every
                            // failure; offer self-certify when currency is the only
                            // problem, and Force for managers/super-admins.
                            vm.bookout_airworthiness = { visible: false };
                            vm.bookout_pilot_checks = {
                                visible: true,
                                message: data.message || 'The pilot checks for this flight did not pass.',
                                failures: (data.failures && data.failures.length) ? data.failures : [{ code: 'unknown', message: data.message || 'Pilot checks failed.' }],
                                can_override: data.can_override === true,
                                can_force: data.can_force_override === true,
                                working: false
                            };
                        } else if (data.reason === 'already_booked_out') {
                            // Booked out already (a second tap, or another device) — show that flight.
                            vm.bookout_airworthiness = { visible: false };
                            boDropDraft();
                            ToastService.warning('Already Booked Out', 'This flight is already booked out.');
                            $state.go('dashboard.my_account.booked_out', {booking_id: vm.bookout.booking_id});
                        } else if (data.reason === 'save_failed') {
                            // The log sheet could not be written; the booking is untouched and the
                            // draft is kept, so the pilot can simply press Book out again.
                            vm.bookout_airworthiness = { visible: false };
                            vm.bookout_pilot_checks = { visible: false };
                            ToastService.error('Not Booked Out', data.message || 'The book-out could not be saved. Nothing has changed — please try again.');
                        } else if (data.reason === 'booking_invalid') {
                            vm.bookout_airworthiness.working = false;
                            ToastService.error('Booking Problem', data.message || 'This booking could not be matched to the aircraft — please go back to the schedule and try again.');
                        } else if (data.reason === 'not_allowed') {
                            vm.bookout_airworthiness.working = false;
                            ToastService.error('Not Your Flight', data.message || "Only the booking's member, its instructor, or a club manager can book this flight out.");
                        } else if (data.reason === 'aircraft_check_required') {
                            // Server gate: no Check A / Transit Check recorded for this
                            // booking. Back to the check card, with a fresh lookup.
                            vm.bookout_airworthiness = { visible: false };
                            vm.bookout_pilot_checks = { visible: false };
                            vm.bo_on_check_required(data);
                        } else if (data.reason === 'airworthiness') {
                            // Force policy: a blocking airworthiness/insurance issue.
                            // Managers/super-admins (can_force_override) get a Force button.
                            // The backend says WHEN to block; we enrich the WHAT with a
                            // full client-side scan so every out-of-date item is visible.
                            vm.bookout_airworthiness = {
                                visible: true,
                                mode: 'force',
                                message: data.message || 'This aircraft has an airworthiness or insurance issue.',
                                hard_block: data.hard_block || null,
                                issues: mergeAirworthinessIssues(data.airworthiness_issues, buildAirworthinessIssues()),
                                can_force: data.can_force_override === true,
                                acknowledged: false,
                                working: false
                            };
                        } else {
                            vm.bookout_airworthiness.working = false;
                            ToastService.error('Bookout Failed', 'Something went wrong: ' + (data.message || 'Unknown error'));
                        }
                    }, function(){
                        vm.bookout_airworthiness.working = false;
                        ToastService.error('Bookout Failed', 'Could not connect to the server.');
                    });
                };

                // ── Pre-book-out airworthiness gate ──────────────────────────────
                // BEFORE we commit the book-out, scan the aircraft's documents/defects
                // client-side. If ANYTHING is out of date (expired ARC/insurance/radio,
                // missing CRS, overdue/low hours or days, no-fly defects) the pilot must
                // see the itemised list and ACKNOWLEDGE it in a blocking modal first —
                // they cannot unknowingly fly an unairworthy aircraft. Only once they
                // confirm do we actually send the book-out. This runs regardless of the
                // club's warn/force policy; the backend force block remains the hard
                // enforcement (handled in doBookout's 'airworthiness' branch).
                function startBookout(){
                    var issues = buildAirworthinessIssues();
                    if (issues.length > 0 && !(vm.bookout_airworthiness && vm.bookout_airworthiness.acknowledged)) {
                        vm.bookout_airworthiness = {
                            visible: true,
                            mode: 'warn',
                            message: 'This aircraft has the airworthiness or insurance issue(s) listed below. Please read them carefully before you book out and fly.',
                            issues: issues,
                            can_force: false,
                            acknowledged: false,
                            working: false
                        };
                        return;
                    }
                    doBookout();
                }

                // Confirm from the pre-book-out (warn) gate → proceed with the book-out.
                vm.confirmBookoutAirworthiness = function(){
                    if (!vm.bookout_airworthiness || !vm.bookout_airworthiness.acknowledged) return;
                    vm.bookout_airworthiness.working = true;
                    doBookout();
                };

                // Build a rich, categorised list of airworthiness issues from the
                // client-side aircraft data (vm.club.plane + open defects), so the
                // warning popup can show EXACTLY what's out of date — not just the
                // backend's summary message. Each issue: { key, label, detail,
                // severity: 'critical'|'warning', icon }.
                var LOW_HOURS_THRESHOLD = 2;   // < 2 hrs to next check → flag
                function buildAirworthinessIssues(){
                    var issues = [];
                    var plane = vm.club && vm.club.plane;
                    if (!plane) { return issues; }

                    function fmtDate(d){ return d ? $filter('date')($filter('asDate')(d), 'dd MMM yyyy') : ''; }
                    function isExpired(doc){
                        if (!doc) { return false; }
                        if (doc.status) { return String(doc.status).toLowerCase() === 'expired'; }
                        if (typeof doc.days_to_expiry !== 'undefined') { return doc.days_to_expiry <= 0; }
                        return false;
                    }

                    // Airworthiness certificate: the ARC of a CofA aircraft / the Permit to Fly —
                    // airworthiness_document, the record the server judges (a CofA on file with no
                    // ARC is valid: it does not expire)
                    var awd = plane.airworthiness_document || plane.certificate;
                    if (isExpired(awd)) {
                        var aw_name = (awd.kind === 'permit') ? 'Permit to Fly' : (awd.kind === 'cofa' ? 'Certificate of Airworthiness' : 'ARC');
                        issues.push({ key: 'certificate', label: 'Airworthiness certificate expired',
                            detail: awd.date_expiry ? aw_name + ' expired ' + fmtDate(awd.date_expiry) : (awd.id ? aw_name + ' has no expiry date on file' : 'No ' + aw_name + ' on file'),
                            severity: 'critical', icon: 'fa-file-contract' });
                    }
                    // Insurance
                    if (isExpired(plane.insurance)) {
                        issues.push({ key: 'insurance', label: 'Insurance expired',
                            detail: plane.insurance.date_expiry ? 'Expired ' + fmtDate(plane.insurance.date_expiry) : 'Insurance has expired',
                            severity: 'critical', icon: 'fa-shield-alt' });
                    }
                    // Radio licence: NOT an airworthiness issue (owner 2026-11-07 — its expiry is
                    // informational: shown in the documents list and reminded about, it never
                    // gates a book-out). It used to raise this acknowledge-before-book-out popup.
                    // Missing Certificate of Release to Service
                    if (!plane.crs || !plane.crs.certificate) {
                        issues.push({ key: 'crs', label: 'No Certificate of Release to Service',
                            detail: 'The aircraft has no current CRS on record.',
                            severity: 'critical', icon: 'fa-clipboard-check' });
                    }
                    // Maintenance: hours / days remaining to next check
                    if (plane.maintenance) {
                        var hrs = plane.maintenance.hours_remaining;
                        if (hrs != null && hrs <= 0) {
                            issues.push({ key: 'hours', label: 'Overdue for check (hours)',
                                detail: 'No hours remaining to the next check.',
                                severity: 'critical', icon: 'fa-clock' });
                        } else if (hrs != null && hrs < LOW_HOURS_THRESHOLD) {
                            issues.push({ key: 'hours', label: 'Low hours to next check',
                                detail: (Math.round(hrs * 10) / 10) + ' hrs remaining (under ' + LOW_HOURS_THRESHOLD + ' hrs).',
                                severity: 'warning', icon: 'fa-clock' });
                        }
                        var days = plane.maintenance.days_remaining;
                        if (days != null && days <= 0) {
                            issues.push({ key: 'days', label: 'Overdue for check (calendar)',
                                detail: 'No days remaining to the next check.',
                                severity: 'critical', icon: 'fa-calendar-times' });
                        }
                    }
                    // Open "No Fly" defects
                    (vm.reported_defects || []).forEach(function(d){
                        if (d.severity && d.severity.indexOf('No Fly') > -1) {
                            issues.push({ key: 'nofly_' + d.id, label: 'No-fly defect: grounded',
                                detail: d.defect || 'An open no-fly defect is on this aircraft.',
                                severity: 'critical', icon: 'fa-ban' });
                        }
                    });

                    return issues;
                }

                // Merge the backend's issue list with our client-side one, de-duping.
                // Backend issues are normalised to { label, detail, severity, icon }.
                // The server's refusal lists CODES (AircraftAirworthiness). Each maps to the
                // client scan's issue key — when the scan already explains it (with detail),
                // the code is dropped; otherwise it gets a readable label, never the raw code.
                var AW_CODE_ISSUES = {
                    hours_exceeded: { key: 'hours', label: 'Overdue for check (hours)', icon: 'fa-clock' },
                    hours_low: { key: 'hours', label: 'Low hours to next check', icon: 'fa-clock', severity: 'warning' },
                    next_check_due: { key: 'days', label: 'Overdue for check (calendar)', icon: 'fa-calendar-times' },
                    next_check_soon: { key: 'days', label: 'Check due soon (calendar)', icon: 'fa-calendar', severity: 'warning' },
                    insurance_expired: { key: 'insurance', label: 'Insurance expired', icon: 'fa-shield-alt' },
                    arc_expired: { key: 'certificate', label: 'Airworthiness certificate expired', icon: 'fa-file-contract' },
                    airworthiness_expired: { key: 'certificate', label: 'Airworthiness certificate expired', icon: 'fa-file-contract' },
                    radio_expired: { key: 'radio', label: 'Radio licence expired', icon: 'fa-broadcast-tower' },
                    crs_missing: { key: 'crs', label: 'No Certificate of Release to Service', icon: 'fa-clipboard-check' },
                    aircraft_grounded: { key: 'nofly_', label: 'Aircraft grounded', icon: 'fa-ban' },
                    aircraft_unavailable: { key: null, label: 'Aircraft unavailable (in maintenance or withdrawn)', icon: 'fa-tools' }
                };
                function mergeAirworthinessIssues(backendIssues, clientIssues){
                    var out = [];
                    var seen = {};
                    var clientKeys = [];
                    (clientIssues || []).forEach(function(c){ if (c && c.key) { clientKeys.push(String(c.key)); } });
                    function scanHas(key){
                        if (!key) { return false; }
                        for (var i = 0; i < clientKeys.length; i++) {
                            if (key.charAt(key.length - 1) === '_' ? clientKeys[i].indexOf(key) === 0 : clientKeys[i] === key) { return true; }
                        }
                        return false;
                    }
                    backendIssues = (backendIssues || []).map(function(it){
                        if (typeof it !== 'string') { return it; }
                        var m = AW_CODE_ISSUES[it];
                        if (m) { return scanHas(m.key) ? null : { label: m.label, icon: m.icon, severity: m.severity }; }
                        var words = it.replace(/_/g, ' ');
                        return { label: words.charAt(0).toUpperCase() + words.slice(1) };
                    }).filter(function(it){ return !!it; });
                    function add(it){
                        var label = (it && (it.label || it.message)) ? (it.label || it.message) : String(it);
                        var k = label.toLowerCase().replace(/\s+/g, ' ').trim();
                        if (seen[k]) { return; }
                        seen[k] = true;
                        out.push({
                            label: label,
                            detail: it.detail || '',
                            severity: it.severity || 'critical',
                            icon: it.icon || 'fa-exclamation-triangle'
                        });
                    }
                    (backendIssues || []).forEach(add);
                    (clientIssues || []).forEach(add);
                    return out;
                }

                // Confirm + resend the book-out with force_override (managers/super-admins).
                // Requires the pilot to have ticked the acknowledgement first.
                vm.forceBookout = function(){
                    if (!vm.bookout_airworthiness || !vm.bookout_airworthiness.acknowledged) return;
                    vm.bookout_airworthiness.working = true;
                    vm.bookout_airworthiness.visible = false;
                    doBookout(true);
                };
                vm.cancelBookoutAirworthiness = function(){
                    vm.bookout_airworthiness = { visible: false };
                };

                // ── Pilot-checks modal actions (force policy) ──
                // Self-certify: only offered when a lapsed currency is the SOLE
                // failure — resend with override:1 (the pilot certifies they
                // are safe and current to fly).
                vm.selfCertifyBookout = function(){
                    if (!vm.bookout_pilot_checks || !vm.bookout_pilot_checks.can_override) return;
                    vm.bookout_pilot_checks.working = true;
                    vm.bookout_pilot_checks.visible = false;
                    vm._bookout_obj.override = 1;
                    doBookout();
                };
                // Force: managers/super-admins only — resend with force_override.
                vm.forcePilotChecks = function(){
                    if (!vm.bookout_pilot_checks || !vm.bookout_pilot_checks.can_force) return;
                    vm.bookout_pilot_checks.working = true;
                    vm.bookout_pilot_checks.visible = false;
                    doBookout(true);
                };
                // Cancel: close the modal AND strip any override flags so a
                // later normal retry doesn't silently carry them.
                vm.cancelPilotChecks = function(){
                    vm.bookout_pilot_checks = { visible: false };
                    if (vm._bookout_obj) {
                        delete vm._bookout_obj.override;
                        delete vm._bookout_obj.force_override;
                    }
                };

                if (vm.aircraft_check.required && !vm.aircraft_check.submitted) {
                    vm.check_submitting = true;
                    var flight_date = $filter('date')(vm.bookout.booking_start, 'yyyy-MM-dd');
                    // checked_at is a Date (datetime-local) — format to the
                    // 'yyyy-MM-ddTHH:mm' string the API expects.
                    var checkedAtStr = (vm.check_form.checked_at instanceof Date)
                        ? $filter('date')(vm.check_form.checked_at, 'yyyy-MM-ddTHH:mm')
                        : vm.check_form.checked_at;
                    var check_payload = {
                        club_id: vm.bookout.club_id,
                        plane_id: vm.bookout.plane.id,
                        booking_id: vm.bookout.booking_id,
                        check_type: vm.aircraft_check.check_type,
                        performed_by: vm.user.id,
                        checked_at: checkedAtStr,
                        fuel_us_gallons: vm.check_form.fuel_us_gallons,
                        oil_quarts: vm.check_form.oil_quarts,
                        flight_date: flight_date,
                        notes: vm.check_form.notes || ''
                    };

                    AircraftChecksService.CreateCheck(check_payload)
                        .then(function(checkData) {
                            vm.check_submitting = false;
                            if (checkData.success) {
                                vm.aircraft_check.submitted = true;
                                ToastService.success('Check Submitted', vm.aircraft_check.check_type_label + ' submitted successfully.');
                                startBookout();
                            } else {
                                ToastService.error('Check Failed', 'Aircraft check could not be submitted: ' + (checkData.message || 'Unknown error'));
                            }
                        });
                } else {
                    startBookout();
                }


                //console.log("OBJECT HERE", bookout_obj);

            }




/*

OLD VERSION FOR LEGACY PURPOSES

  $scope.add_element = function(bit_type){

                //remove from first array
                $scope[bit_type][bit_type] = $.grep($scope[bit_type][bit_type], function(e){ 
                    return e.id != $scope.formData.license.add_to[bit_type].id; 
                });

                if(bit_type == "differences"){
                    $scope.formData.license.add_to[bit_type].day = true;
                    $scope.formData.license.add_to[bit_type].vfr = true;
                }
                //console.log($scope.formData.license.add_to[bit_type]);

                $scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
                
                //clean the array to show what we want to show :)
                delete $scope.formData.license.add_to[bit_type];

            }


            $scope.remove_element = function(bit_type, index){

                //add to dropdown
                $scope[bit_type][bit_type].push($scope.formData.license[bit_type][index]);
            
                $scope.formData.license[bit_type].splice(index,1)

                $scope.formData.license[bit_type] = $scope.formData.license[bit_type].filter(Boolean);
                //console.log($scope.formData.license[bit_type]);
                //$scope.formData.license[bit_type].push($scope.formData.license.add_to[bit_type]);
            }


*/


            //nice looking date pickers


            $scope.popup = [];

            $scope.open = function(id, $event) {
                //console.log("THIS", id);
                //this comment would allow the event not to be affect by clicking it again... not sure this is a good idea
                if($scope.popup[id] && $scope.popup[id].opened == true){
                    $event.preventDefault();
                    $event.stopPropagation();
                } else {
                    $scope.popup[id] = {opened: true};
                }
            };

            $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = $scope.formats[0];

            $scope.datePickerOptions = {
                                        format: 'dd/MM/yyyy',
                                        showWeeks: false
                                    };

           

           $scope.remove_real_file = function(file){

                //remove_file

                vm.licence.images = $.grep(vm.licence.images, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            LicenceService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.licence_images = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

            $scope.processFiles = function(files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    files[i].file.temp_path = j.saved_url;
                    // //console.log("file", files[i].file);
                    vm.licence_images.push(files[i].file);
                }
               
            }



            $scope.delete_licence = function(id){


                var a = prompt("Are you sure you wish to delete this licence? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){
                    //console.log("WE DELETE IT");


                    LicenceService.Delete(vm.user_id, id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                vm.user_licences = $.grep(vm.user_licences, function(e){ 
                                    return e.id != id; 
                                });
                                
                                //refresh?
                                $state.reload();
                                $state.go('dashboard.my_account.licence');

                            } else {

                                ToastService.error('Error', data.message);

                            }

                        });



                } else {
                    //console.log("ignore");
                }


            }




            $scope.save_licence = function(isValid){

                if(vm.licence_images.length < 1 && vm.licence.images.length < 1){

                    $(".drop").focus();
                    ToastService.warning('Missing Image', 'You must at least have 1 image of your licence!');

                    return false;   
                }


                if(!vm.licence.licence_type){
                    $("#licence_type").focus();
                    ToastService.warning('Missing Licence Type', 'You must select a licence type');

                    return false;
                }


                if(!vm.licence.state_of_issue){
                    $("#state_of_issue").focus();
                    ToastService.warning('Missing State', 'You must select a licence state of issue');

                    return false;
                }


                if(vm.licence.ratings.length < 1){

                    $("#ratings").focus();
                    ToastService.warning('Missing Rating', 'You must at least have 1 rating!');
                    
                    return false;   
                }

                //console.log("FLOW: ", vm.licence_images);



                //compile the required elements YAY

                //console.log("LICENCE GOOD TO GO ", vm.licence);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    for(var i=0;i<vm.licence.images.length;i++){
                        delete vm.licence.images[i].data_uri;
                    }

                    // vm.licence.images = vm.licence_images;
                    vm.licence.images = vm.licence.images.concat(vm.licence_images);

                    vm.licence.licence_id = vm.licence.licence_type.id;
                    vm.licence.authority_id = vm.licence.state_of_issue.id;
                    vm.licence.user_id = vm.user_id;

                    delete vm.licence.licence_type;
                    delete vm.licence.state_of_issue;


                if(vm.licence.id){
                    //then its an udpate

                    //merge the images left?
                    LicenceService.Update(vm.licence)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", vm.licence);
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.go('dashboard.my_account.licence', {}, { reload: true });





                            } else {

                                ToastService.error('Error', data.message);

                            }

                        });

                } else {


                   


                    //then its a create
                    //console.log(vm.licence);

                    LicenceService.Create(vm.licence)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("HUZZAH", vm.licence);
                                //console.log("HUZZAH", data);
                                //then we need to remove this from the list of files...
                                
                                
                                //move somewhere?
                                $state.reload();
                                $state.go('dashboard.my_account.licence', {}, { reload: true });


                            } else {

                                ToastService.error('Error', data.message);

                            }

                        });


                }



            };




            // ═══════════════════════════════════════════════════════════════
            //  BOOK-OUT PAGE (redesign 2026-11-06) — views/my_account/booking_out_form.html
            //  + css/bookout.css (.bo-*); spec: mockups/bookout-redesign.html.
            //  View state only: the book-out itself is still bookout_plane()
            //  above, whose validations stay as defence in depth.
            //  vm.bo_readiness() mirrors those validations so the ONE book-out
            //  button can be locked with the reason instead of failing on press.
            //  (booked_out.html shares this controller — nothing here assumes
            //  the book-out page except the draft restore, which checks.)
            // ═══════════════════════════════════════════════════════════════

            vm.bo_loaded = false;            // bookings/for_bookout answered + processed
            vm.bo_load_error = null;         // ...or why it couldn't be
            // booked-out screen: the pilot-check warnings the book-out answered with (read once)
            vm.bo_done_warnings = [];
            if ($state.current.name === 'dashboard.my_account.booked_out' && $stateParams.booking_id) {
                try {
                    var bo_w_key = 'bo_warnings_' + $stateParams.booking_id;
                    var bo_w = angular.fromJson(sessionStorage.getItem(bo_w_key) || '[]');
                    vm.bo_done_warnings = angular.isArray(bo_w) ? bo_w : [];
                    sessionStorage.removeItem(bo_w_key);
                } catch (e) { vm.bo_done_warnings = []; }
            }
            // the bare /bookout states (data.action list / edit) load no booking at all
            if ($state.current.data && $state.current.data.action !== 'add') {
                vm.bo_load_error = 'Open the book-out from one of your bookings — on My Account or the scheduler.';
            }
            vm.bo_plane_loaded = false;      // maintenance + documents (vm.club.plane)
            vm.bo_defects_loaded = false;
            vm.bo_defects_error = false;
            vm.bo_doc_list = [];
            vm.bo_docs_summary = { valid: 0, total: 0, tone: 'na', note: '' };
            vm.bo_reject = { visible: false, working: false };
            vm.bo_doc_opening = null;        // key of the document whose file is being fetched
            vm.bo_lesson_id = parseInt($stateParams.lesson_id, 10) || 0;   // <bo-presolo lesson-id>
            vm.bo_flight_date = vm.bo_flight_date || null;                 // 'YYYY-MM-DD' (<bo-presolo flight-date>)
            vm.bo_now = new Date();

            var BO_DRAFT_TTL = 3 * 60 * 60 * 1000;   // a draft older than this is stale (fuel/oil change)
            var BO_RING_C = 2 * Math.PI * 23;        // the rail's progress ring (r = 23)
            vm.bo_ring_c = BO_RING_C.toFixed(2);

            // "in 1h 58m" on the return-by tile — a 30 s tick is plenty
            var bo_clock = $interval(function(){ vm.bo_now = new Date(); }, 30000);
            var bo_flash_timer = null;

            // Escape closes the top-most dialog (never one that is mid-request)
            function boOnKey(e){
                if (e.key !== 'Escape' && e.keyCode !== 27) { return; }
                $scope.$applyAsync(function(){
                    if (vm.bookout_airworthiness.visible) {
                        if (!vm.bookout_airworthiness.working && vm.cancelBookoutAirworthiness) { vm.cancelBookoutAirworthiness(); }
                    } else if (vm.bookout_pilot_checks.visible) {
                        if (!vm.bookout_pilot_checks.working && vm.cancelPilotChecks) { vm.cancelPilotChecks(); }
                    } else if (vm.bo_reject.visible) {
                        vm.bo_close_reject();
                    } else if (vm.show_new_passenger_invitation) {
                        vm.close_passenger_invitation();
                    } else if ($scope.show_file_now) {
                        $scope.close_file();
                    }
                });
            }
            $window.document.addEventListener('keydown', boOnKey);

            $scope.$on('$destroy', function(){
                $interval.cancel(bo_clock);
                if (bo_flash_timer) { $timeout.cancel(bo_flash_timer); }
                $window.document.removeEventListener('keydown', boOnKey);
            });

            // ── small helpers ──
            function boParseDate(s){
                if (!s) { return null; }
                if (s instanceof Date) { return s; }
                var m = moment(String(s), ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DDTHH:mm'], true);
                if (m.isValid()) { return m.toDate(); }
                var d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            }
            function boNum(v){ var n = parseFloat(v); return isNaN(n) ? null : n; }
            function boPlural(n, word){ return n + ' ' + word + (n == 1 ? '' : 's'); }
            function boDur(mins){
                var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
                if (d > 0) { return d + 'd ' + h + 'h'; }
                if (h > 0) { return h + 'h ' + m + 'm'; }
                return m + 'm';
            }
            function boFmtDate(d){
                if (!d) { return ''; }
                var m = moment(d);
                return m.isValid() ? m.format('D MMM YYYY') : '';
            }
            function boFind(list, key, value){
                if (!angular.isArray(list) || value === null || value === undefined) { return null; }
                for (var i = 0; i < list.length; i++) {
                    if (list[i] && String(list[i][key]) === String(value)) { return list[i]; }
                }
                return null;
            }

            // ── people ──
            vm.bo_initials = function(p){
                if (!p) { return '?'; }
                var f = String(p.first_name || '').trim(), l = String(p.last_name || '').trim();
                if (!f && !l && p.name) {
                    var parts = String(p.name).trim().split(/\s+/);
                    f = parts[0] || '';
                    l = parts.length > 1 ? parts[parts.length - 1] : '';
                }
                if (!f && !l && p.email) { return String(p.email).charAt(0).toUpperCase(); }
                return ((f.charAt(0) || '') + (l.charAt(0) || '')).toUpperCase() || '?';
            };
            vm.bo_full_name = function(p){
                if (!p) { return ''; }
                var n = ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
                return n || p.name || p.email || '';
            };
            // the brand initials circle means INSTRUCTOR everywhere (CLAUDE.md visual rule);
            // PIC rows are member rows (user_id), the booking's instructor is a users row (id)
            vm.bo_is_instructor = function(p){
                var id = p ? (p.user_id || p.id) : null;
                return !!id && vm.bookout.instructor_id > 0 && id == vm.bookout.instructor_id;
            };
            vm.bo_person_role = function(p){
                if (!p) { return ''; }
                var id = p.user_id || p.id;
                if (vm.bookout.instructor_id > 0 && id == vm.bookout.instructor_id) { return 'Instructor'; }
                if (id == vm.bookout.user_id) { return vm.bookout.instructor_id > 0 ? 'Student' : 'Pilot'; }
                return 'Member';
            };
            vm.bo_person_sub = function(p){
                if (!p) { return ''; }
                var role = vm.bo_person_role(p);
                var tier = String(p.membership_name || '').trim();
                return (tier && tier.toLowerCase() !== role.toLowerCase()) ? role + ' · ' + tier : role;
            };
            vm.bo_instructor_short = function(){
                var i = vm.bookout.instructor;
                if (!(vm.bookout.instructor_id > 0) || !i) { return ''; }
                var f = String(i.first_name || '').trim(), l = String(i.last_name || '').trim();
                return (f ? f.charAt(0) + '. ' : '') + l;
            };
            function boIntentShown(){
                var b = vm.bookout;
                return b.instructor_id > 0 && !!b.pic && b.pic.user_id == b.instructor_id && !!b.put;
            }
            function boAuthShown(){
                var b = vm.bookout;
                return b.instructor_id > 0 && !!b.pic && b.pic.user_id == b.user_id && !!vm.can_authorise;
            }
            vm.bo_intent_shown = boIntentShown;
            vm.bo_auth_shown = boAuthShown;
            vm.bo_supervisor_shown = function(){
                var b = vm.bookout;
                return b.instructor_id > 0 && !!b.pic && b.pic.user_id == b.user_id;
            };
            vm.bo_put_shown = function(){
                var b = vm.bookout;
                return b.instructor_id > 0 && !!b.pic && b.pic.user_id == b.instructor_id;
            };

            // ── slot / return-by ──
            vm.bo_slot_sub = function(){
                var s = vm.bookout.booking_start, e = vm.bookout.return;
                if (s && e && $filter('date')(s, 'yyyy-MM-dd') !== $filter('date')(e, 'yyyy-MM-dd')) {
                    return 'until ' + $filter('date')(e, 'EEE d MMM');
                }
                return 'Your booking';
            };
            vm.bo_return_in = function(){
                var e = vm.bookout.return;
                if (!(e instanceof Date) || isNaN(e.getTime())) { return ''; }
                var mins = Math.round((e.getTime() - vm.bo_now.getTime()) / 60000);
                if (mins > 0) { return 'in ' + boDur(mins); }
                if (mins === 0) { return 'now'; }
                return 'ended ' + boDur(-mins) + ' ago';
            };
            vm.bo_return_late = function(){
                var e = vm.bookout.return;
                return (e instanceof Date) && e.getTime() < vm.bo_now.getTime();
            };

            // ── aircraft status band ──
            // Hours: amber under 5 h, red when none left (50 h gauge). Days: amber
            // under 14, red when none left (365-day gauge). Documents: amber under
            // 30 days, red expired. Same "expired" rule as the airworthiness gate.
            function boMaint(){ return (vm.club && vm.club.plane && vm.club.plane.maintenance) || null; }
            function boHours(){ var m = boMaint(); return m ? boNum(m.hours_remaining) : null; }
            function boDays(){ var m = boMaint(); return m ? boNum(m.days_remaining) : null; }
            function boTone(v, warn_below){
                if (v === null) { return 'na'; }
                if (v <= 0) { return 'bad'; }
                return v < warn_below ? 'warn' : 'ok';
            }
            vm.bo_hours_tone = function(){ return vm.bo_plane_loaded ? boTone(boHours(), 5) : 'na'; };
            vm.bo_days_tone = function(){ return vm.bo_plane_loaded ? boTone(boDays(), 14) : 'na'; };
            vm.bo_hours_text = function(){ var h = boHours(); return h === null ? '—' : $scope.get_hours_from_decimal(h); };
            vm.bo_days_text = function(){ var d = boDays(); return d === null ? '—' : String(Math.round(d)); };
            vm.bo_hours_sub = function(){ var h = boHours(); return h === null ? 'Not recorded' : (h <= 0 ? 'Check overdue' : 'to next check'); };
            vm.bo_days_sub = function(){ var d = boDays(); return d === null ? 'Not recorded' : (d <= 0 ? 'Check overdue' : 'to next check'); };
            vm.bo_hours_pct = function(){ var h = boHours(); return h === null ? 0 : Math.max(0, Math.min(100, h / 50 * 100)); };
            vm.bo_days_pct = function(){ var d = boDays(); return d === null ? 0 : Math.max(0, Math.min(100, d / 365 * 100)); };
            vm.bo_meter_text = function(){
                var pd = vm.booking && vm.booking.plane_details;
                var v = pd ? pd.meter_reading : null;
                if (v === null || v === undefined || v === '') { return '—'; }
                var n = boNum(v);
                return n === null ? String(v) : $filter('number')(n);
            };
            // the previous flight hasn't booked in — its end reading isn't known yet
            vm.bo_meter_warn = function(){
                var pd = vm.booking && vm.booking.plane_details;
                return !!(pd && pd.meter_warning);
            };

            function boDocState(doc){
                var na = { tone: 'na', chip: 'No expiry on file', chip_icon: 'fa-question', sub: 'No expiry date on file', days: null };
                if (!doc) { return na; }
                // a Certificate of Airworthiness does not expire: on file = valid (owner 2026-11-07)
                if (doc.expires === false && String(doc.status || '').toLowerCase() === 'ok') {
                    return { tone: 'ok', chip: 'Valid', chip_icon: 'fa-check', sub: 'Does not expire', days: null };
                }
                var days = boNum(doc.days_to_expiry);
                if (days === null && doc.date_expiry && moment(doc.date_expiry).isValid()) {
                    days = moment(doc.date_expiry).startOf('day').diff(moment().startOf('day'), 'days');
                }
                var expired = doc.status ? String(doc.status).toLowerCase() === 'expired' : (days !== null && days <= 0);
                var when = boFmtDate(doc.date_expiry);
                if (expired) { return { tone: 'bad', chip: 'Expired', chip_icon: 'fa-times', sub: when ? 'Expired ' + when : 'Expired', days: days }; }
                if (days === null) { return na; }
                if (days < 30) {
                    return { tone: 'warn', chip: boPlural(Math.max(1, Math.floor(days)), 'day') + ' left', chip_icon: 'fa-hourglass-half', sub: when ? 'Expires ' + when : 'Expires soon', days: days };
                }
                return { tone: 'ok', chip: 'Valid', chip_icon: 'fa-check', sub: when ? 'Expires ' + when : 'In date', days: days };
            }
            // Built once the maintenance call lands (status()) — a stable list for ng-repeat.
            function boBuildDocs(){
                var plane = (vm.club && vm.club.plane) || {};
                var list = [];
                function add(key, type, title, icon, doc){
                    var st = boDocState(doc);
                    // the issue date when one is on file (the certificate's date_issued was
                    // never stored before 2026-11-07): "Issued 10 Aug 2026 · Expires …"
                    var issued = (doc && doc.date_issued && String(doc.date_issued).indexOf('0000-00-00') !== 0) ? boFmtDate(doc.date_issued) : '';
                    list.push({ key: key, type: type, title: title, icon: icon, file: (doc && doc.certificate) ? doc.certificate : null,
                                tone: st.tone, chip: st.chip, chip_icon: st.chip_icon, sub: issued ? 'Issued ' + issued + ' · ' + st.sub : st.sub, days: st.days });
                }
                // the ARC (CofA aircraft) / Permit to Fly — airworthiness_document, the record the
                // server judges; its file is served by plane_arc or plane_certificate (document_route)
                var awd = plane.airworthiness_document || plane.certificate;
                add('certificate', (awd && awd.document_route === 'plane_arc') ? 'arc' : 'certificate',
                    (awd && awd.label) ? awd.label : (plane.airworthiness_type === 'ptf' ? 'Permit to Fly' : 'Airworthiness Review Certificate (ARC)'),
                    'fa-certificate', awd);
                add('insurance', 'insurance', 'Insurance', 'fa-shield-alt', plane.insurance);
                add('radio', 'radio', 'Radio licence', 'fa-broadcast-tower', plane.radio_licence);
                // Noise certificate (no expiry): listed when one is on file — the old
                // row's has_noise flag was never set, so it never showed at all.
                if (plane.noise && plane.noise.certificate) {
                    list.push({ key: 'noise', type: 'noise', title: 'Noise certificate', icon: 'fa-volume-down', file: plane.noise.certificate,
                                tone: 'ok', chip: 'On file', chip_icon: 'fa-check', sub: 'No expiry', days: null });
                }
                // Certificate of Release to Service: read-only for the pilot, no
                // expiry — shows when it was released. Only when a CRS exists.
                if (plane.crs && plane.crs.certificate) {
                    var rel = boFmtDate(plane.crs.release_date);
                    var rel_time = plane.crs.release_time ? String(plane.crs.release_time).slice(0, 5) : '';
                    list.push({ key: 'crs', type: 'crs', title: 'Certificate of Release to Service', icon: 'fa-file-signature', file: plane.crs.certificate,
                                tone: 'ok', chip: 'Released', chip_icon: 'fa-check',
                                sub: rel ? 'Released ' + rel + (rel_time ? ' at ' + rel_time : '') : 'Released to service', days: null });
                }
                vm.bo_doc_list = list;

                // The radio licence is information only (owner 2026-11-07): its row still says
                // "Expired", but it never turns the Documents tile / the aircraft step red.
                var valid = 0, bad = null, soon = null, unknown = null, info_expired = null;
                for (var i = 0; i < list.length; i++) {
                    var d = list[i];
                    if (d.tone === 'ok' || d.tone === 'warn') { valid++; }
                    if (d.tone === 'bad' && d.key === 'radio') { info_expired = d; continue; }
                    if (d.tone === 'bad' && !bad) { bad = d; }
                    if (d.tone === 'warn' && (!soon || d.days < soon.days)) { soon = d; }
                    if (d.tone === 'na' && !unknown) { unknown = d; }
                }
                vm.bo_docs_summary = {
                    valid: valid,
                    total: list.length,
                    tone: bad ? 'bad' : ((soon || unknown || info_expired) ? 'warn' : 'ok'),
                    note: bad ? bad.title + ' expired' : (info_expired ? info_expired.title + ' expired (for information)' : (soon ? soon.title + ': ' + soon.chip : (unknown ? unknown.title + ': no expiry on file' : 'All in date')))
                };
            }
            vm.bo_open_doc = function(doc){
                if (!doc || !doc.file || vm.bo_doc_opening) { return; }
                vm.bo_doc_opening = doc.key;
                var done = function(){ vm.bo_doc_opening = null; };
                var p = $scope.show_file(doc.file, doc.type);
                if (p && p['finally']) { p['finally'](done); } else { done(); }
            };

            // ── reported defects ──
            function boLoadDefects(){
                var plane_id = vm.bookout.plane && vm.bookout.plane.id;
                if (!plane_id) { vm.bo_defects_loaded = true; return $q.when(); }
                return PlaneService.GetOpenIssues(plane_id).then(function (data) {
                    if (angular.isArray(data)) {
                        vm.reported_defects = data;
                        vm.bo_defects_error = false;
                    } else {
                        // never treat "couldn't load" as "no defects"
                        vm.reported_defects = [];
                        vm.bo_defects_error = true;
                    }
                    vm.bo_defects_loaded = true;
                });
            }
            vm.bo_reload_defects = function(){
                vm.bo_defects_loaded = false;
                vm.bo_defects_error = false;
                boLoadDefects();
            };
            // "Delete my entry" (the template called this but it was never defined here)
            vm.delete_defect = function(id){
                PlaneService.DeleteDefect(id).then(function(data){
                    if (data && data.success === false) {
                        ToastService.error('Not Deleted', (typeof data.message === 'string' && data.message) || 'Your defect entry could not be deleted.');
                    } else {
                        ToastService.success('Entry Deleted', 'Your defect entry has been removed.', { confetti: false });
                    }
                    return boLoadDefects();
                });
            };
            vm.bo_defects_count = function(){ return angular.isArray(vm.reported_defects) ? vm.reported_defects.length : 0; };
            vm.bo_defect_tone = function(d){
                var s = String((d && d.severity) || '').toLowerCase();
                if (s.indexOf('no fly') > -1) { return 'bad'; }
                if (s.indexOf('not urgent') > -1) { return 'minor'; }
                if (s.indexOf('unsure') > -1) { return 'unsure'; }
                return 'warn';
            };
            vm.bo_defect_chip = function(d){
                var t = vm.bo_defect_tone(d);
                return t === 'bad' ? 'no' : (t === 'minor' ? 'muted' : 'wait');
            };
            vm.bo_defect_sev = function(d){
                var t = vm.bo_defect_tone(d);
                if (t === 'bad') { return 'No fly'; }
                if (t === 'minor') { return 'Not urgent'; }
                if (t === 'unsure') { return 'Severity unsure'; }
                var s = (d && d.severity) ? String(d.severity) : '';
                return s.toLowerCase().indexOf('flyable') > -1 ? 'Flyable' : (s || 'Reported');
            };
            vm.bo_defects_tone = function(){
                if (!vm.bo_defects_loaded) { return 'na'; }
                if (vm.bo_defects_error) { return 'bad'; }
                var list = vm.reported_defects || [];
                if (!list.length) { return 'ok'; }
                for (var i = 0; i < list.length; i++) { if (vm.bo_defect_tone(list[i]) === 'bad') { return 'bad'; } }
                return vm.bookout.accept_defects === true ? 'ok' : 'warn';
            };
            vm.bo_defects_sub = function(){
                if (!vm.bo_defects_loaded) { return 'Loading…'; }
                if (vm.bo_defects_error) { return "Couldn't load the defects"; }
                var list = vm.reported_defects || [], txt = [];
                for (var i = 0; i < list.length; i++) { txt.push(list[i].defect); }
                return txt.length ? txt.join(' · ') : 'Nothing reported';
            };

            // ── flight & route ──
            function boNeedsDestination(){
                var ft = vm.bookout.flight_type;
                return !!ft && (ft.id == 2 || ft.id == 4);
            }
            vm.bo_needs_destination = boNeedsDestination;
            // mirrors bookout_plane(): refused when missing, or an unlisted one with no title
            function boDestinationOk(){
                var to = vm.bookout.to_airfield;
                return !!to && !(to.id < 1 && to.title == "");
            }
            vm.bo_ft_icon = function(id){
                if (id == 1) { return 'fa-map-marker-alt'; }
                if (id == 2) { return 'fa-plane-departure'; }
                if (id == 3) { return 'fa-sync-alt'; }
                return 'fa-ellipsis-h';
            };
            vm.bo_set_flight_type = function(ft){
                vm.bookout.flight_type = ft;
                if (boNeedsDestination()) {
                    // a destination may already be picked: re-check AirfieldHub + Biggin Hill
                    $scope.selected_airfield_check();
                } else {
                    // Local / Circuits go from and back to the From airfield: a destination
                    // picked earlier must not keep the Biggin Hill block up
                    vm.extra_information_required = !!(vm.bookout.from_airfield && vm.bookout.from_airfield.id == 150);
                }
            };
            vm.bo_route_text = function(){
                var b = vm.bookout, ft = b.flight_type;
                if (!ft) { return ''; }
                var from = (b.from_airfield && (b.from_airfield.code || b.from_airfield.title)) || '…';
                if (boNeedsDestination()) {
                    var to = (b.to_airfield && (b.to_airfield.code || b.to_airfield.title)) || '…';
                    return ft.title + ' · ' + from + ' → ' + to;
                }
                return ft.title + ' · from and back to ' + from;
            };

            // ── passengers ──
            // The API sends aboard as 1 / 0 / "1"; an Angular checkbox is only
            // ticked by true, so a passenger already aboard showed an OFF switch
            // while the book-out treated them as aboard. Booleans from the start.
            function boNormalisePax(list){
                if (!angular.isArray(list)) { return list; }
                for (var i = 0; i < list.length; i++) {
                    var a = list[i] ? list[i].aboard : null;
                    if (list[i] && a !== true && a !== false) {
                        list[i].aboard = (a === 1 || a === '1' || a === 'true');
                    }
                }
                return list;
            }
            vm.bo_pax_can_board = function(p){ return !!p && (p.status == 'member' || p.status == 'accepted' || !!p.is_member); };
            vm.bo_pax_tone = function(p){
                if (vm.bo_pax_can_board(p)) { return 'ok'; }
                if (p && p.status == 'invited') { return 'wait'; }
                if (p && (p.status == 'to_invite' || p.status == 'declined')) { return 'no'; }
                return 'muted';
            };
            vm.bo_pax_icon = function(p){
                if (vm.bo_pax_can_board(p)) { return 'fa-check'; }
                if (p && p.status == 'invited') { return 'fa-envelope-open-text'; }
                if (p && p.status == 'to_invite') { return 'fa-envelope'; }
                if (p && p.status == 'declined') { return 'fa-times'; }
                return 'fa-question';
            };
            vm.bo_pax_label = function(p){
                if (!p) { return ''; }
                if (p.is_member || p.status == 'member') { return 'Member'; }
                if (p.status == 'accepted') { return 'Accepted'; }
                if (p.status == 'invited') { return 'Invited — awaiting reply'; }
                if (p.status == 'to_invite') { return 'Not invited yet'; }
                if (p.status == 'declined') { return 'Declined'; }
                return p.status || 'Unknown';
            };
            // a row that still needs its invitation → the invite form, pre-filled
            vm.bo_invite_row = function(p){
                vm.new_pax = { id: 0, email: (p && p.email) || '', first_name: (p && p.first_name) || '', last_name: (p && p.last_name) || '',
                               is_member: false, status: '', not_found: true };
                vm.show_new_passenger_invitation = true;
            };
            vm.bo_pax_has = function(status){
                var pax = vm.bookout.passengers || [];
                for (var i = 0; i < pax.length; i++) { if (pax[i].status == status) { return true; } }
                return false;
            };
            vm.bo_seats_free = function(){
                var seats = parseInt(vm.bookout.plane && vm.bookout.plane.seats, 10);
                if (!(seats > 0)) { return null; }
                var b = vm.bookout;
                var crew = vm.bo_put_shown() ? 2 : 1;   // dual: instructor + student
                var pax = b.passengers || [], aboard = 0;
                for (var i = 0; i < pax.length; i++) { if (pax[i].aboard) { aboard++; } }
                return Math.max(0, seats - crew - aboard);
            };
            vm.bo_pax_text = function(){
                var pax = vm.bookout.passengers || [], names = [];
                for (var i = 0; i < pax.length; i++) {
                    if (pax[i].aboard) { names.push(vm.bo_full_name(pax[i])); }
                }
                if (!names.length) { return pax.length ? 'None aboard yet' : 'None'; }
                return names.length + ' aboard · ' + names.join(', ');
            };
            vm.bo_crew_text = function(){
                var b = vm.bookout;
                if (!b.pic) { return 'Not chosen yet'; }
                var pic = vm.bo_full_name(b.pic);
                if (b.instructor_id > 0) {
                    var instr = vm.bo_full_name(b.instructor);
                    if (b.pic.user_id == b.instructor_id) { return pic + ' instructing ' + (vm.bo_full_name(b.put) || 'the student'); }
                    if (b.pic.user_id == b.user_id) {
                        return b.authorised_solo ? pic + ' — solo, authorised by ' + instr : pic + ', supervised by ' + instr;
                    }
                }
                return pic;
            };

            // ── readiness: bookout_plane()'s own checks, made visible ──
            // Order follows the cards (crew → flight → passengers → aircraft →
            // check) so "Next:" walks down the page. The pre-solo item is
            // informational only. Memoised on a signature: ng-repeat needs the
            // SAME array between digests (a fresh one each call = infdig).
            function boPaxReady(){
                var pax = vm.bookout.passengers || [];
                for (var i = 0; i < pax.length; i++) {
                    if (pax[i].status == 'to_invite') { return false; }
                    if (pax[i].status == 'invited' && pax[i].aboard) { return false; }
                }
                return true;
            }
            function boCheckFormDone(){
                var cf = vm.check_form;
                return cf.fuel_us_gallons > 0 && cf.oil_quarts > 0 && !!cf.checked_at && !!cf.confirmed;
            }
            vm.bo_check_done = boCheckFormDone;
            function boCheckLabel(){
                return vm.aircraft_check.check_type_label || (vm.aircraft_check.check_type === 'check_a' ? 'Check A' : 'Transit Check');
            }
            vm.bo_check_label = boCheckLabel;
            function boSoloOutstanding(){
                if (!vm.presolo) { return 0; }
                var active = (boIntentShown() && !!vm.solo_intent) || (boAuthShown() && !!vm.bookout.authorised_solo);
                return active ? (vm.presolo.outstanding || 0) : 0;
            }
            // The solo pilot self-certifies currency only when the server says they are out of it
            // on this aircraft (pics_book_in_out → type_current === false). pic.current is the
            // MEMBERSHIP flag — every PIC row has it — so the old toggle keyed on it never showed.
            function boCurrencyNeeded(){
                var b = vm.bookout;
                return !!(b && b.pic && b.pic.type_current === false && !(b.instructor_id > 0));
            }
            vm.bo_currency_needed = boCurrencyNeeded;
            vm.bo_currency_days = function(){
                var d = vm.bookout && vm.bookout.pic && vm.bookout.pic.currency_days;
                return d > 0 ? d : vm.currency_days;
            };
            vm.bo_currency_what = function(){
                var b = vm.bookout, t = b && b.pic && b.pic.currency_type, p = (b && b.plane) || {};
                if (t === 'class') { return 'an aircraft of this class' + (p.plane_class ? ' (' + p.plane_class + ')' : ''); }
                if (t === 'gear') { return 'an aircraft with this gear type'; }
                return 'the ' + (p.plane_type || 'aircraft type');
            };
            function boReadySig(){
                var b = vm.bookout, ac = vm.aircraft_check;
                var pax = b.passengers || [], p = '';
                for (var i = 0; i < pax.length; i++) { p += (pax[i].status || '') + (pax[i].aboard ? '+' : '-') + ','; }
                return [
                    vm.bo_loaded ? 1 : 0, vm.bo_defects_loaded ? 1 : 0, vm.bo_defects_error ? 1 : 0,
                    b.pic ? (b.pic.id + ':' + (boCurrencyNeeded() ? 1 : 0)) : '-',
                    b.is_current ? 1 : 0,
                    b.flight_type ? b.flight_type.id : 0,
                    boDestinationOk() ? 1 : 0,
                    p,
                    vm.bo_defects_count(), b.accept_defects === true ? 1 : 0,
                    ac.loading ? 1 : 0, ac.lookup_failed ? 1 : 0, ac.required ? 1 : 0, ac.submitted ? 1 : 0, boCheckLabel(),
                    boCheckFormDone() ? 1 : 0,
                    boSoloOutstanding(),
                    (b.plane && b.plane.plane_type) || ''
                ].join('|');
            }
            function boBuildReady(){
                var b = vm.bookout, ac = vm.aircraft_check, items = [], info = [];
                var type = (b.plane && b.plane.plane_type) || 'aircraft type';

                items.push({ key: 'pic', card: 'crew', t: 'Pilot in command', n: 'Choose the pilot in command', done: !!(b.pic && b.pic.id >= 1) });
                if (boCurrencyNeeded()) {
                    items.push({ key: 'cur', card: 'crew', t: (b.pic.currency_type === 'class' || b.pic.currency_type === 'gear') ? 'Currency confirmed' : 'Currency on the ' + type + ' confirmed', n: 'Confirm your currency', done: !!b.is_current });
                }
                items.push({ key: 'ft', card: 'flight', t: 'Flight type', n: 'Choose the flight type', done: !!(b.flight_type && b.flight_type.id >= 1) });
                if (boNeedsDestination()) {
                    items.push({ key: 'to', card: 'flight', t: 'Destination airfield', n: 'Choose the destination', done: boDestinationOk() });
                }
                if ((b.passengers || []).length) {
                    items.push({ key: 'pax', card: 'pax', t: 'Passengers invited & ready', n: 'Sort out your passengers', done: boPaxReady() });
                }
                var nd = vm.bo_defects_count();
                if (vm.bo_defects_error) {
                    items.push({ key: 'def', card: 'aircraft', t: "Reported defects couldn't be loaded", n: 'Reload the reported defects', done: false });
                } else if (nd) {
                    items.push({ key: 'def', card: 'aircraft', t: boPlural(nd, 'reported defect') + ' accepted', n: 'Review the reported defects', done: b.accept_defects === true });
                }
                if (ac.loading) {
                    items.push({ key: 'chk', card: 'check', t: 'Checking for a pre-flight check', n: 'Wait for the pre-flight check', done: false, wait: true });
                } else if (ac.lookup_failed) {
                    items.push({ key: 'chk', card: 'check', t: 'Pre-flight check lookup failed', n: 'Retry the pre-flight check lookup', done: false, failed: true });
                } else if (ac.required && !ac.submitted) {
                    var label = boCheckLabel();
                    items.push({ key: 'chk', card: 'check', t: label + ' completed', n: 'Complete the ' + label, done: boCheckFormDone() });
                }

                var so = boSoloOutstanding();
                if (so > 0) {
                    info.push({ key: 'solo', card: 'crew', t: 'Pre-solo: ' + boPlural(so, 'requirement') + ' outstanding', info: true });
                }

                var left = [], done = 0;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].done) { done++; } else { left.push(items[i]); }
                }
                return { items: items, info: info, left: left, done: done, total: items.length };
            }
            var bo_ready_cache = { sig: null, r: null };
            vm.bo_readiness = function(){
                var sig = boReadySig();
                if (sig !== bo_ready_cache.sig) { bo_ready_cache = { sig: sig, r: boBuildReady() }; }
                return bo_ready_cache.r;
            };
            // Locked while anything is outstanding, while the page's own data is
            // still arriving (the client airworthiness gate reads vm.club.plane),
            // and while the check is being submitted.
            vm.bo_cta_locked = function(){
                return !vm.bo_loaded || !vm.bo_plane_loaded || !vm.bo_defects_loaded || !!vm.check_submitting ||
                       vm.bo_readiness().left.length > 0;
            };
            vm.bo_cta_sub = function(){
                if (!vm.bo_loaded || !vm.bo_plane_loaded || !vm.bo_defects_loaded) { return "Loading the aircraft's status…"; }
                var r = vm.bo_readiness(), left = r.left.length, chk = null;
                for (var i = 0; i < left; i++) { if (r.left[i].key === 'chk') { chk = r.left[i]; } }
                var more = (left > 1) ? ' · ' + boPlural(left - 1, 'more item') : '';
                if (chk && chk.wait) { return 'Locked while we check whether a pre-flight check is needed' + more; }
                if (chk && chk.failed) { return "Locked — we couldn't check whether a pre-flight check is needed" + more; }
                if (chk) { return 'Locked until the ' + boCheckLabel() + ' is complete' + more; }
                if (left) { return 'Locked — finish ' + boPlural(left, 'item') + ' above'; }
                return 'Everything is ready';
            };
            vm.bo_card_done = function(card){
                if (!vm.bo_loaded) { return false; }
                if (card === 'final') { return !vm.bo_cta_locked(); }
                if (card === 'aircraft' && (!vm.bo_defects_loaded || !vm.bo_plane_loaded ||
                    vm.bo_docs_summary.tone === 'bad' || vm.bo_hours_tone() === 'bad' || vm.bo_days_tone() === 'bad')) { return false; }
                var r = vm.bo_readiness();
                for (var i = 0; i < r.left.length; i++) { if (r.left[i].card === card) { return false; } }
                return true;
            };
            vm.bo_progress_pct = function(){
                var r = vm.bo_readiness();
                return r.total ? Math.round(100 * r.done / r.total) : 100;
            };
            vm.bo_ring_offset = function(){
                var r = vm.bo_readiness();
                return (BO_RING_C * (1 - (r.total ? r.done / r.total : 1))).toFixed(2);
            };
            vm.bo_next_item = function(){
                var r = vm.bo_readiness();
                return r.left.length ? r.left[0] : null;
            };
            vm.bo_go_next = function(){
                var n = vm.bo_next_item();
                vm.bo_goto(n ? n.card : 'final');
            };

            // Smooth-scroll to a card (scroll-margin clears the fixed header) and
            // flash it, so the eye lands on what needs doing.
            vm.bo_goto = function(card){
                var el = $window.document.getElementById('bo-card-' + card);
                if (!el) { return; }
                var reduce = false;
                try { reduce = !!($window.matchMedia && $window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
                try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(true); }
                el.classList.remove('bo-card--flash');
                void el.offsetWidth;   // restart the animation when the same card is flashed twice
                el.classList.add('bo-card--flash');
                if (bo_flash_timer) { $timeout.cancel(bo_flash_timer); }
                bo_flash_timer = $timeout(function(){ el.classList.remove('bo-card--flash'); }, 1400, false);
            };

            // ── pre-flight check: retry + the server's gate ──
            vm.bo_retry_check_lookup = function(){ loadRequiredCheck(); };

            // POST plane_log_sheets refused with reason 'aircraft_check_required'
            // ({check_type, check_type_label, message}): show the card's form
            // again straight away, refresh the lookup, and take the pilot there.
            vm.bo_on_check_required = function(data){
                data = data || {};
                var ac = vm.aircraft_check;
                if (data.check_type) { ac.check_type = data.check_type; }
                ac.check_type_label = data.check_type_label || (ac.check_type === 'check_a' ? 'Check A' : 'Transit Check');
                ac.required = true;
                ac.submitted = false;
                ac.existing_check_id = null;
                ToastService.warning(ac.check_type_label + ' Required',
                    (typeof data.message === 'string' && data.message) || ('Complete the ' + ac.check_type_label + ' before booking this aircraft out.'));
                loadRequiredCheck();
                $timeout(function(){ vm.bo_goto('check'); }, 60);
            };

            // ── pilot-checks modal: "Fix in the pre-solo panel" ──
            vm.bo_fix_presolo = function(){
                if (vm.cancelPilotChecks) { vm.cancelPilotChecks(); } else { vm.bookout_pilot_checks = { visible: false }; }
                $timeout(function(){ vm.bo_goto('crew'); }, 60);
            };

            // ── reject the aircraft (defects): Keep it / Amend booking / Cancel booking ──
            vm.bo_close_reject = function(){
                if (vm.bo_reject.working) { return; }
                vm.bo_reject = { visible: false, working: false };
            };
            vm.bo_reject_amend = function(){
                if (vm.bo_reject.working) { return; }
                vm.bo_reject = { visible: false, working: false };
                vm.saveDraft();
                $state.go('dashboard.edit_from_bookout', { booking_id: vm.bookout.booking_id });
            };
            // The scheduler's own cancel (CancellationFeesService.CancelBooking →
            // DELETE bookings/{id} with a reason), with the reason fixed: the
            // aircraft is being rejected. Never claims a fee.
            vm.bo_reject_cancel = function(){
                if (vm.bo_reject.working || !vm.bookout.booking_id) { return; }
                vm.bo_reject.working = true;
                CancellationFeesService.CancelBooking(vm.user.id, vm.bookout.booking_id, {
                    reason: 'Plane Unserviceable',
                    notes: 'Aircraft rejected at book-out because of its reported defects.'
                }).then(function(data){
                    vm.bo_reject.working = false;
                    if (data && data.success) {
                        vm.bo_reject = { visible: false, working: false };
                        boDropDraft();
                        ToastService.success('Booking Cancelled', 'The booking has been cancelled.', { confetti: false });
                        $state.go('dashboard.my_account', {}, { reload: true });
                    } else {
                        ToastService.error('Error', (data && data.message) || 'An error occurred while cancelling the booking.');
                    }
                }, function(){
                    vm.bo_reject.working = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
            };

            // ── draft: the pre-solo panel's "Review now" leaves and comes back ──
            // sessionStorage bo_draft_<booking_id>: what the pilot entered (not the
            // booking's own data), with a timestamp; restored once the page's
            // lists have loaded (boRestoreDraft), cleared after a successful
            // book-out or a cancellation.
            function boDraftKey(){ return 'bo_draft_' + (vm.bookout.booking_id || $stateParams.booking_id); }
            function boDropDraft(){
                try { $window.sessionStorage.removeItem(boDraftKey()); } catch (e) {}
                try { $window.sessionStorage.removeItem('bo_return'); } catch (e) {}
            }
            function boPlain(o){
                if (!o || typeof o !== 'object') { return null; }
                try { return angular.fromJson(angular.toJson(o)); } catch (e) { return null; }
            }
            function boPaxKey(p){ return p.id ? 'i' + p.id : 'e' + String(p.email || '').toLowerCase(); }
            // acceptance covers THESE defects — a new report since means reading again
            function boDefectSig(){
                var list = angular.isArray(vm.reported_defects) ? vm.reported_defects : [], ids = [];
                for (var i = 0; i < list.length; i++) { ids.push(String(list[i].id)); }
                return ids.sort().join(',');
            }

            vm.saveDraft = function(){
                if (!vm.bo_loaded || !vm.bookout.booking_id) { return false; }
                var b = vm.bookout, cf = vm.check_form, aboard = {}, pax = b.passengers || [];
                for (var i = 0; i < pax.length; i++) { aboard[boPaxKey(pax[i])] = !!pax[i].aboard; }
                var draft = {
                    at: new Date().getTime(),
                    plane_id: b.plane ? b.plane.id : null,
                    pic_user_id: b.pic ? b.pic.user_id : null,
                    flight_type_id: b.flight_type ? b.flight_type.id : null,
                    from_airfield: boPlain(b.from_airfield),
                    to_airfield: boPlain(b.to_airfield),
                    aboard: aboard,
                    check_form: {
                        fuel_us_gallons: cf.fuel_us_gallons,
                        oil_quarts: cf.oil_quarts,
                        checked_at: (cf.checked_at instanceof Date && !isNaN(cf.checked_at.getTime())) ? cf.checked_at.getTime() : null,
                        notes: cf.notes || '',
                        confirmed: !!cf.confirmed
                    },
                    solo_intent: vm.solo_intent || null,
                    authorised_solo: !!b.authorised_solo,
                    course_id: b.selected_course ? b.selected_course.id : null,
                    tuition_id: b.tuition_required ? b.tuition_required.id : null,
                    flight_rule_id: b.flight_rule ? b.flight_rule.id : null,
                    routing_via_id: b.routing_via ? b.routing_via.id : null,
                    additional_details: b.additional_details || '',
                    parking_note: b.parking_note || '',
                    en_route: b.en_route ? b.en_route.time : null,
                    endurance: b.endurance ? b.endurance.time : null,
                    departure: b.departure ? b.departure.time : null,
                    is_current: !!b.is_current,
                    accept_defects: b.accept_defects === true,
                    defects: boDefectSig()
                };
                try {
                    $window.sessionStorage.setItem(boDraftKey(), angular.toJson(draft));
                    return true;
                } catch (e) {
                    return false;
                }
            };

            function boRestoreDraft(){
                if ($state.current.name !== 'dashboard.my_account.bookout_with_booking') { return; }
                // back on the book-out: <bo-presolo>'s return trip is over, draft or not
                try { $window.sessionStorage.removeItem('bo_return'); } catch (e) {}
                var raw = null, d = null;
                try { raw = $window.sessionStorage.getItem(boDraftKey()); } catch (e) { return; }
                if (!raw) { return; }
                try { d = angular.fromJson(raw); } catch (e) { d = null; }
                if (!d || !d.at || (new Date().getTime() - d.at) > BO_DRAFT_TTL) { boDropDraft(); return; }

                var b = vm.bookout;
                // the check numbers and the defects acceptance belong to ONE aircraft —
                // "Amend booking" may have swapped it
                var same_plane = d.plane_id !== null && d.plane_id !== undefined && b.plane && String(d.plane_id) === String(b.plane.id);

                // PIC first: the solo choices below only make sense for it.
                // ui-selects match by identity → always take the LOADED list's object.
                var pic = boFind(vm.pics, 'user_id', d.pic_user_id);
                if (pic) { b.pic = pic; }
                var ft = boFind(vm.flight_types, 'id', d.flight_type_id);
                if (ft) { b.flight_type = ft; }
                if (d.from_airfield) { b.from_airfield = boFind(vm.airfields, 'id', d.from_airfield.id > 0 ? d.from_airfield.id : null) || d.from_airfield; }
                if (d.to_airfield) { b.to_airfield = boFind(vm.airfields, 'id', d.to_airfield.id > 0 ? d.to_airfield.id : null) || d.to_airfield; }

                var pax = b.passengers || [];
                if (d.aboard) {
                    for (var i = 0; i < pax.length; i++) {
                        var k = boPaxKey(pax[i]);
                        if (Object.prototype.hasOwnProperty.call(d.aboard, k)) { pax[i].aboard = !!d.aboard[k]; }
                    }
                }

                if (same_plane && d.check_form) {
                    var cf = vm.check_form, s = d.check_form;
                    var fuel = boNum(s.fuel_us_gallons), oil = boNum(s.oil_quarts);
                    if (fuel !== null) { cf.fuel_us_gallons = fuel; }
                    if (oil !== null) { cf.oil_quarts = oil; }
                    if (s.checked_at) {
                        var at = new Date(s.checked_at);
                        if (!isNaN(at.getTime())) { cf.checked_at = at; }
                    }
                    if (s.notes) { cf.notes = s.notes; }
                    cf.confirmed = !!s.confirmed;
                    // the "from A-Check" tags would now describe the pilot's own numbers
                    if (fuel !== null || oil !== null) { vm.aircraft_check.prefilled = false; }
                }

                vm.solo_intent = (d.solo_intent === 'student_solo' || d.solo_intent === 'solo_check') ? d.solo_intent : null;
                b.authorised_solo = !!d.authorised_solo;
                b.is_current = !!d.is_current;
                if (same_plane && d.accept_defects && d.defects === boDefectSig()) { b.accept_defects = true; }

                // Biggin Hill extras
                var fr = boFind(vm.flight_rules, 'id', d.flight_rule_id);
                if (fr) { b.flight_rule = fr; }
                var rv = boFind(vm.biggin_hill.routes, 'id', d.routing_via_id);
                if (rv) { b.routing_via = rv; }
                if (d.additional_details) { b.additional_details = d.additional_details; }
                if (d.parking_note) { b.parking_note = d.parking_note; }
                var t_en = boFind(vm.all_times, 'time', d.en_route);
                if (t_en) { b.en_route = t_en; }
                var t_end = boFind(vm.all_times, 'time', d.endurance);
                if (t_end) { b.endurance = t_end; }
                var t_dep = boFind(vm.start_times, 'time', d.departure);
                if (t_dep) { b.departure = t_dep; }

                // course → its charges → the tuition (matched by id in the new list)
                var pick_tuition = function(){
                    var tu = boFind(vm.instructor_charges, 'id', d.tuition_id);
                    if (tu) { b.tuition_required = tu; }
                };
                var course = boFind(vm.courses, 'id', d.course_id);
                if (course && !(b.selected_course && String(b.selected_course.id) === String(course.id))) {
                    b.selected_course = course;
                    var p = vm.update_course();
                    if (p && p.then) { p.then(pick_tuition, pick_tuition); }
                } else {
                    pick_tuition();
                }

                // Biggin Hill block + AirfieldHub note for the restored route
                if (b.from_airfield) { $scope.selected_airfield_check(); }

                ToastService.success("We kept what you'd filled in", 'Your book-out form is as you left it.', { confetti: false });
            }


            $scope.logout = function(){
                //alert("LOG ME OUT");
                AuthenticationService.Logout(function(data){

                               AuthenticationService.ClearCredentials();
                                 
                                $cookieStore.remove('globals');
                                $cookieStore.remove('session');

                                // Clear return URL — this is an intentional logout, not a session timeout
                                try { localStorage.removeItem('toaviate_return_url'); } catch(e) {}

                                $location.path('/login');


                             
                            
                        });
            }

            $scope.go_flying = function(){
                //alert("LOG ME OUT");
             

                $state.go('dashboard.my_account', {}, { reload: true });


                       
            }







            //EDITING OF THE BOOKING FROM THE BOOKOUT...
             /* THIS SECTION IS ABOUT THE ADD / EDIT OF THE CALENDAR EVENTS VIA THE EDIT / ADD NEW BOOKING */

            // vm.dateTimeRangePickerOptions = {
            //     hour_step: 1,
            //     minute_step: 30,
            //     min_date: today,
            //     datepicker:{
            //         customClass: getDayClass,
            //         format: 'dd/MM/yyyy',
            //         showWeeks: false,
            //         minDate: today
            //     }
            //     ,
            //     business_hours: {
            //         from: "09:00",
            //         to: "22:30"
            //     }
            // };


            // /* ADD OR EDIT THE BOOKING */

            // function figure_out_steps(){
            //     //console.log("OPTIONS", vm.dateTimeRangePickerOptions);
            //     vm.new_booking.options = vm.dateTimeRangePickerOptions;
            //      for(var i=0;i<24;i+=vm.new_booking.options.hour_step){

            //         if(vm.new_booking.options.minute_step && vm.new_booking.options.minute_step > 0){
            //             for(var j=0; j<(60/vm.new_booking.options.minute_step); j++){
            //                 var k = vm.new_booking.options.minute_step * j;
            //                 k = ((k < 10) ? '0' : '') + k;
            //                 vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
            //                 vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
            //             }
            //         } else {
            //             vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
            //             vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
            //         }

            //     }
            // }

            // function init_times(){
            //    for(var i=0;i<24;i+=vm.new_booking.options.hour_step){

            //         if(vm.new_booking.options.minute_step && vm.new_booking.options.minute_step > 0){
            //             for(var j=0; j<(60/vm.new_booking.options.minute_step); j++){
            //                 var k = vm.new_booking.options.minute_step * j;
            //                 k = ((k < 10) ? '0' : '') + k;
            //                 vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
            //                 vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
            //             }
            //         } else {
            //             vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
            //             vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
            //         }

            //     } 
            // }


        












        


    }