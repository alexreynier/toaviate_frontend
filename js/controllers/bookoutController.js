 app.controller('BookoutController', BookoutController);

    BookoutController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$interval', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'BookoutService', '$filter', 'InstructorCharges', 'PlaneService', '$http', '$cookieStore', 'AuthenticationService', 'CourseService', 'ToastService'];
    function BookoutController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $interval, $timeout, uiCalendarConfig, BookingService, LicenceService, BookoutService, $filter, InstructorCharges, PlaneService, $http, $cookieStore, AuthenticationService, CourseService, ToastService) {
        
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



        $scope.accept_defects = function(){


            var a = confirm("You accept to fly the aircraft despite known defect(s) which have been reported by previous pilots");
            if(a){
                vm.bookout.accept_defects = true;
            } else {
                //do nothing
            }



        }

        $scope.reject_defects = function(){

            var a = confirm("Would you like to cancel this booking?");
            if(a){
                
            } else {
                //do nothing
                vm.bookout.accept_defects = false;
            }
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
                       vm.bookout.passengers = data.passengers;

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
                                        vm.club.plane = data;  
                                        
                                        status();

                                        //console.log("BOOOO - get all maintenance....", vm.club.plane);
                                        // vm.page_title = "Edit a Plane Maintenance - "+vm.club.plane.registration;
                                    });


                                    vm.pics = pics;
                                    //vm.bookout.pic
                                    process_booking_to_bookout(data.booking);

                            });

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
                case "noise": 
                    controller = "plane_documents";
                break;
                case "docs": 
                    controller = "plane_documents";
                break;
                default:
                    controller = "plane_documents";
                break;
            }

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/'+controller+'/show_file/'+ddd, {
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
            var octetStreamMime = 'application/octet-stream';
            var success = false;

            // Get the headers
            headers = headers();
            //var ttt = title.toLowerCase().replace(/\W/g, '_');
            // Get the filename from the x-filename header or default to "download.bin"
            var filename = headers['x-filename'] || 'download.zip';

            // Determine the content type from the header or default to "application/octet-stream"
            var contentType = headers['content-type'] || octetStreamMime;

            try {
                // Try using msSaveBlob if supported
                var blob = new Blob([data], {
                    type: contentType
                });
                if (navigator.msSaveBlob)
                    navigator.msSaveBlob(blob, filename);
                else {
                    // Try using other saveBlob implementations, if available
                    var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
                    if (saveBlob === undefined) throw "Not supported";
                    saveBlob(blob, filename);
                }
                success = true;
            } catch (ex) {
                $log.info("saveBlob method failed with the following exception:");
                $log.info(ex);
            }

            if (!success) {
                // Get the blob url creator
                var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
                if (urlCreator) {
                    // Try to use a download link
                    var link = document.createElement('a');
                    if ('download' in link) {
                        // Try to simulate a click
                        try {
                            // Prepare a blob URL
                            var blob = new Blob([data], {
                                type: contentType
                            });
                            var url = urlCreator.createObjectURL(blob);
                            link.setAttribute('href', url);

                            // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
                            link.setAttribute("download", filename);

                            // Simulate clicking the download link
                            var event = document.createEvent('MouseEvents');
                            event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                            link.dispatchEvent(event);
                            success = true;

                        } catch (ex) {
                            $log.info("Download link method with simulated click failed with the following exception:");
                            $log.info(ex);
                        }
                    }

                    if (!success) {
                        // Fallback to window.location method
                        try {
                            // Prepare a blob URL
                            // Use application/octet-stream when using window.location to force download
                            var blob = new Blob([data], {
                                type: octetStreamMime
                            });
                            var url = urlCreator.createObjectURL(blob);
                            window.location = url;
                            success = true;
                        } catch (ex) {
                            $log.info("Download link method with window.location failed with the following exception:");
                            $log.info(ex);
                        }
                    }
                }
            }

            if (!success) {
                // Fallback to window.open method
                $log.info("No methods worked for saving the arraybuffer, using last resort window.open");
                window.open(httpPath, '_blank', '');
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

            $scope.status.certificate = (plane.certificate.days_to_expiry > 0)? "ok" : "expired";
            $scope.status.insurance = (plane.insurance.days_to_expiry > 0)? "ok" : "expired";
            $scope.status.radio_licence = (plane.radio_licence.days_to_expiry > 0)? "ok" : "expired";



        }

        vm.update_course = function(){

            if(vm.bookout.selected_course && vm.bookout.selected_course.id > 0){
                //let us set it
                // console.log("ONE COURSE?", vm.bookout.selected_course.id);
                 CourseService.GetChargesByCourseId(vm.bookout.selected_course.id)
                                        .then(function(data){
                                            vm.instructor_charges = data.items; 

                                            if(vm.instructor_charges.length == 1){
                                                vm.bookout.tuition_required = vm.instructor_charges[0];
                                            }

                                        });

            } else {
                // console.log("MORE COURSE?");
                //let us clear it?
                 InstructorCharges.GetByClubId(vm.bookout.club_id)
                                        .then(function(data){
                                            vm.instructor_charges = data.items; 

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
            vm.bookout.return = new Date(booking.end);
            vm.bookout.booking_start = new Date(booking.start);


            if((vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ){
                //console.log("NOT BOOKING FOR SELF?");
                vm.can_authorise = true;
                //prepare_add_edit();
            }


             PlaneService.GetOpenIssues(booking.plane.id)
            .then(function (data) {
                    ////console.log("data is : ", data);
                   vm.reported_defects = data;
                });

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

                // vm.bookout.tuition_required
                CourseService.GetCoursesByClubId(vm.bookout.club_id)
                                .then(function(data){
                                    vm.courses = data.items;   
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
                                    vm.update_course();



                 });

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
            vm.bookout.passengers = booking.passengers;
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


            BookoutService.GetAirfieldsByCode(location_default)
                .then(function (data) {
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                        var selected_location = vm.airfields.find(item => item.id === booking.plane_details.location.id);
                        //console.log("selected_location", selected_location);
                        vm.bookout.from_airfield = selected_location;
                       }
                    });

          
            //booking.plane_details.location.id
            // vm.bookout.pic = selected_pic;


        }


        $scope.selected_airfield_check = function(){
            //console.log("airfield has been selected", vm.bookout.from_airfield.id);
            if(vm.bookout.from_airfield.id == 150 || (vm.bookout.to_airfield && vm.bookout.to_airfield.id == 150)){
                //console.log("extra information required");
                vm.extra_information_required = true;
            } else {
                if(!vm.filing_flightplan && vm.bookout.from_airfield.id !== 150){
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

                if( (!vm.bookout.is_current || vm.bookout.is_current == 0) && vm.bookout.instructor_id < 1 ){
                    ToastService.highlightField('is_current');
                    ToastService.warning('Currency Check', 'Please confirm that you are current according to the club rules, as you do not have an instructor booked.');
                    return false;
                }







                //check the destination is entered if required
                if(vm.bookout.flight_type.id == 2 && (!vm.bookout.to_airfield || (vm.bookout.to_airfield.id < 1 && vm.bookout.to_airfield.title == "" ) )){
                    ToastService.highlightField('to_airfield');
                    ToastService.warning('Missing Destination', 'As you selected this flight to be a departure, please select a destination airfield');
                    return false;
                }










                if(!vm.bookout.accept_defects && vm.reported_defects.length > 0){
                    ToastService.highlightField('accept_defects');
                    ToastService.warning('Defects Acknowledgement', 'You must state that you have read the defects currently reported and accept to fly the plane in the condition provided prior to booking out the plane.');
                    return false;
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
                    dual_flight: (vm.bookout.instructor_id > 0 && vm.bookout.pic.id == vm.bookout.instructor.id) ? 1 : 0,
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
                    routing_via_id: (vm.bookout.routing_via) ? vm.bookout.routing_via.id : 0
                }



                 if(bookout_obj.to_airport_id == 0){
                    bookout_obj.new_to_airport = vm.bookout.to_airfield;
                    bookout_obj.new_to_airport.title = bookout_obj.new_to_airport.title.replace("NOT LISTED : ", "");
                }

                if(bookout_obj.from_airport_id == 0){
                    bookout_obj.new_from_airport = vm.bookout.from_airfield;
                    bookout_obj.new_from_airport.title = bookout_obj.new_from_airport.title.replace("NOT LISTED : ", "");
                }    


                // console.log("READY WITH: ", bookout_obj);
                // return false;

                BookoutService.SendBookout(vm.user.id, bookout_obj)
                .then(function(data){
                    if(data.success){
                        $state.go('dashboard.my_account.booked_out', {booking_id: vm.bookout.booking_id});
                    } else {
                        ToastService.error('Bookout Failed', 'Something went wrong: ' + (data.message || 'Unknown error'));
                    }
                });


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