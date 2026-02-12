 app.controller('BookinController', BookinController);

    BookinController.$inject = ['$sce', 'UserService', 'MemberService', 'FoxService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$interval', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'BookoutService', '$filter', 'PlaneService', 'InstructorCharges', 'PaymentService', 'InvoicesService', 'PackageService', 'CourseService', '$anchorScroll', 'smoothScroll', 'EnvConfig', 'ToastService'];
    function BookinController($sce, UserService, MemberService, FoxService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $interval, $timeout, uiCalendarConfig, BookingService, LicenceService, BookoutService, $filter, PlaneService, InstructorCharges, PaymentService, InvoicesService, PackageService, CourseService, $anchorScroll, smoothScroll, EnvConfig, ToastService) {
        
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        //this club ID needs to reflect the club that has been selected....
        vm.club_id = 0;
        vm.booking = {};

        //base location to sort the airfields below
        vm.wgs_n = "51.51";
        vm.wgs_e = "0.12";

        vm.split_flight = 0;
        vm.show_takeoff_landing_times = false;

        vm.change_booking = {};
        vm.show_change_plane = false;
        //we need to get the booking ID to pull as much data as we can!

        vm.bookout = {
            start: true,
            passengers: [],
            pic: {
                id: vm.user_id
            },
            plane: {}
        };

        vm.this_pls_id_raw = 0;

        vm.instructors = [];
        vm.pics = [];
        vm.instructor_charges = []; 
        vm.club_courses = [];      

        vm.can_authorise = false;

        vm.dateFormat = 'date:HH:mm \'on\' dd/MM/yyyy';
        var setting_new_member;

        vm.flight_times_complete = false;
        vm.calculated_invoice = false;

        vm.show_loading = true;

        vm.reported_defects = [];

        vm.scroll = true;

        vm.previous_invoice;

        vm.defect_severity;
        vm.defect_severities = [
            { title: "No Fly Item - Ground the plane"},
            { title: "Flyable - needs to be checked at next maintenance"},
            { title: "Not urgent - but needs noting"},
            { title: "Unsure of severity"}
        ];  


        vm.claim_a_flight = [];
        vm.claimed_flight = {};
        vm.auto_claim = 0;
        vm.ignore_next_tuition_change = false;

        vm.get_currency = function(iso_code){


           return $.grep(vm.currencies, function(e){ 
                        return e.iso_code == iso_code; 
                    })[0];

        }

        $scope.get_airfields = function(name){

            if(name.length > 2 && name.length < 5){

                 BookoutService.GetAirfieldsByCode(name)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                       
                         if(vm.airfields.length == 0){
                            //console.log("SETTINGS HERE");
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
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;


                        if(vm.airfields.length == 0){
                            //console.log("SETTINGS HERE");
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
        vm.original_bookout = {};
        $scope.reset_claim_my_flight = function(){
            //console.log("RESET CLAIM");
            vm.bookout = vm.original_bookout;
            vm.different_date_warning = false; 
            vm.claimed_flight = {};
            vm.calculate_invoice_for_flight();
            vm.flight_times_complete = false;
        }

        vm.different_date_warning = false;
        vm.has_used_claimed_flight = false;


        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        
        //direct-debit, saved-card, new-card, card-machine
        vm.donConfirm = function(methodLabel, paymentIntent){
            console.log("confirmation is called", methodLabel);
            console.log("paymentIntent", paymentIntent);
            //alert('Parent received D confirmation: ' + methodLabel);
            //vm.book_in_flight(methodLabel, paymentIntent);

            var where_to = "home";

            if(vm.user.id !== vm.bookout.payer_id && (vm.user.id == vm.bookout.pic_id || vm.user.id == vm.bookout.instructor_id)){
                //person booking in is the instructor - lets go to debrief:
                where_to = "debrief";
            } else if(vm.split_flight_confirmation == 1){
               // where_to = "split"; - i dont think we get here
            } 

            // else if(vm.can_authorise){
            //    card-machine option?
            //}


            //where_to : home, next, split, debrief

            vm.book_in_flight(where_to, methodLabel, paymentIntent);
        };


        vm.default_payment = 'direct-debit';

        vm.methods = [
            { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
            { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
          ];

          // vm.expandedId = 'direct-debit';
          // vm.selectedId = 'direct-debit';
          vm.savedCards = [
         
          ];

        
        $scope.claim_my_flight = function(force = false){
            // console.log("CLAIM MY FLGIHT PLEASE!!");
            // console.log("CAIMING", vm.claimed_flight);

            if(vm.bookout.flight_date !== vm.claimed_flight.flight_date && force === false){
                ToastService.warning('Date Mismatch', 'The bookout date and the flight you are claiming do not match - are you absolutely sure that this is your flight?');
                vm.different_date_warning = true;
                return false;
            }

            if(vm.this_claim_was_instructional == true){
                vm.this_was_instructional_claim();
            }

            vm.this_pls_id_raw = Object.assign({}, vm.bookout);
            console.log("vm.this_pls_id_raw", vm.this_pls_id_raw);

            vm.has_used_claimed_flight = true;

            vm.bookout.from_airfield = vm.claimed_flight.from_airport;
            vm.bookout.to_airfield = vm.claimed_flight.to_airport;

            if(vm.claimed_flight.from_airport.id == vm.claimed_flight.to_airport.id){
                if(vm.claimed_flight.touch_and_go > 2){
                    // circuits 3?
                    var selected_detail_type = vm.flight_types.find(item => item.id === 3);
                    vm.bookout.flight_type = selected_detail_type;
                } else {
                    //local flight? 1 
                    var selected_detail_type = vm.flight_types.find(item => item.id === 1);
                    vm.bookout.flight_type = selected_detail_type;
                }

            } else {
                var selected_detail_type = vm.flight_types.find(item => item.id === 2);
                vm.bookout.flight_type = selected_detail_type;
            }
            
            vm.bookout.flight_date = vm.claimed_flight.flight_date;

            vm.bookout.brakes_off_rounded =  vm.claimed_flight.brakes_off_rounded;
            vm.bookout.brakes_on_rounded = vm.claimed_flight.brakes_on_rounded;

            vm.bookout.brakes_off = {time: vm.claimed_flight.brakes_off};
            vm.bookout.brakes_on = {time: vm.claimed_flight.brakes_on};

            vm.bookout.touch_and_go = vm.claimed_flight.touch_and_go;
            vm.bookout.landings = vm.claimed_flight.full_stop_landings;
            
            vm.bookout.stops = vm.claimed_flight.stops;

            vm.bookout.fox_log_id = vm.claimed_flight.fox_log_id;
            vm.bookout.fox_claimed = 1;

            vm.bookout.takeoff_time = vm.claimed_flight.takeoff_time;
            vm.bookout.landing_time = vm.claimed_flight.landing_time;


            vm.bookout.takeoff_rounded = vm.claimed_flight.takeoff_rounded;
            vm.bookout.landing_rounded = vm.claimed_flight.landing_rounded;
            //console.log("TAKEOFF TIME HERE : ", vm.bookout.takeoff_time);

            //THIS IS THE KEY HERE delete this one once selected / complete
            vm.bookout.claimed_fox_plane_log_sheet_id = vm.claimed_flight.id;


            //set the important bits for the invoice now
            vm.flight_units.brakes_to_brakes = vm.claimed_flight.brakes_time;
            vm.flight_units.airborne_times = vm.claimed_flight.airborne_time;
            vm.flight_units.flight_time = vm.claimed_flight.flight_time;
            vm.flight_units.brakes_times_rounded = vm.bookout.brakes_times_rounded;
            
            //calculate the invoice yay
            vm.calculate_invoice_for_flight();
            vm.flight_times_complete = true;

            if(vm.bookout.plane_charges.charge_type == "tacho" || vm.bookout.plane_charges.charge_type == "hobbs"){
                //alert("Charges are based on tacho - please enter the final tacho number!");
                //scroll to the the correct bit?
            }

            console.log("BOOKING : ", vm.bookout.booking_id);
            console.log("PLS ID : ", vm.bookout.id);
        }


        $scope.update_pic = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);

            // if(vm.bookout.pic.user_id == vm.bookout.user_id){
            //     //user is P1
            //     var selected_pic = vm.pics.find(item => item.user_id === vm.bookout.pic.user_id);
            //     vm.bookout.pic = selected_pic;
            //     vm.bookout.pic_id = vm.bookout.pic.user_id;
            // }

            // if(vm.bookout.pic.user_id == vm.bookout.instructor_id){
            //     //instructor is P1
            //     var selected_put = vm.pics.find(item => item.user_id === vm.bookout.user_id);
            //     vm.bookout.put = selected_put;
            // }

            var selected_pic = vm.pics.find(item => item.user_id === vm.bookout.pic.user_id);
            vm.bookout.pic = selected_pic;
            vm.bookout.pic_id = vm.bookout.pic.user_id;
            // console.log("INSTRUCTION;:", vm.this_claim_was_instructional);

            if(!vm.this_claim_was_instructional || vm.this_claim_was_instructional == false){
                // console.log("yagh");
                PackageService.GetPackagesByUserId(vm.bookout.pic_id)
                .then(function (data) {
                // IF IT HAS A PACKAGE ID --> THEN WE NEED TO CHECK IT PUT THE CORRECT PAYMENT INFORMATION THERE
                    //console.log("BOOKOUT PACKAGE", data);
                    //console.log("BOOKOUT PACKAGE", data.packages);
                    vm.packages = data.items;

                    PlaneService.GetUpdatedCharges(vm.bookout.club_id, vm.bookout.plane_id, vm.bookout.pic_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                            vm.bookout.plane_charges = data.plane_charges;


                            vm.bookout.put_id = 0;
                            vm.bookout.put = {};
                            vm.bookout.instructor_id = 0;
                            if(vm.bookout.pic_id > 0){
                                vm.bookout.payer_id = vm.bookout.pic_id;
                            } else if(vm.bookout.user_id > 0) {
                                vm.bookout.payer_id = vm.bookout.pic_id;
                            } else {
                                //alert("It appears that no payer ID has been set yet.");
                            }


                            vm.calculate_invoice_for_flight();
                            // console.log("calc?");
                    });

                });


                

            } else {
                console.log("before change - this was instructional");
                if(vm.bookout.pic.instructor == 1){

                } else {
                    vm.this_claim_was_instructional = false;
                    vm.bookout.put_id = 0;
                    vm.bookout.put = {};
                    vm.bookout.instructor_id = 0;
                    if(vm.bookout.pic_id > 0){
                        vm.bookout.payer_id = vm.bookout.pic_id;
                    } else if(vm.bookout.user_id > 0) {
                        vm.bookout.payer_id = vm.bookout.pic_id;
                    } else {
                        //alert("It appears that no payer ID has been set yet.");
                    }
                    vm.calculate_invoice_for_flight();
                }
               
            }
            
            vm.complete_flight = false;

            if(vm.bookout.pic.user_id == vm.user.id){
                vm.can_authorise = false;
            }

            if(!vm.bookout.booking || vm.bookout.booking.user_id == 0 || vm.bookout.user_id == 0){
                vm.bookout.user_id = vm.bookout.pic.user_id;
            }


            if(vm.bookout.put_id == 0 && vm.bookout.instructor_id == 0){
                // console.log("TRYING HERE ==> ", vm.bookout.pic_id);
                // console.log("TRYING TWO ==> ", vm.bookout.payer_id);
                vm.bookout.payer_id = vm.bookout.pic_id;
                // console.log("TRYING THREE ==> ", vm.bookout.payer_id);
            } else {
                // console.log("TRYING PUT ID ==> ", vm.bookout.put_id);
                // console.log("INSTRUCTOR ID ==> ", vm.bookout.instructor_id);

            }

             if(vm.bookout.payer_id == 0){
                // console.log("PAYER ID = 0");
                //vm.bookout.payer_id = vm.bookout.pic_id;
            }




            if(vm.complete_flight){
                vm.complete_this_flight();
            }

            // if(vm.bookout.pic.user_id == vm.user.id && vm.bookout.instructor_id > 0){
            //     //console.log("okay... so you want the instructor to be put? interesting...");
            //     //adheres to booking

            // } else if(vm.bookout.instructor_id > 0 && vm.bookout.pic.user_id == vm.bookout.instructor_id) {
            //     //console.log("okay so you now have your booked instructor as the PIC again - nice");
            //     //adheres to booking

            // } else {
            //     //console.log("you've change instructor? what happened?");
            //     //availability has been checked hence we're OK

            // }


        }

        $scope.update_put = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);
            if(vm.bookout.put.user_id == vm.bookout.pic.user_id){
                ToastService.warning('Selection Error', 'Please select a different PIC to the PUT');
                vm.bookout.put = {};
                return false;
            }

            vm.complete_flight = false;
            
            var selected_put = vm.pics.find(item => item.user_id === vm.bookout.put.user_id);
            vm.bookout.put = selected_put;

            vm.bookout.put_id = selected_put.user_id;


            if(vm.bookout.put_id > 0){
                vm.bookout.instructor_id = vm.bookout.pic_id;

                vm.bookout.instructor = vm.bookout.pic;

                console.log("FI: ", vm.bookout.instructor);
                console.log("instructor_id: ", vm.bookout.instructor_id);

                $scope.update_pic();

            }



            PackageService.GetPackagesByUserId(vm.bookout.put_id)
            .then(function (data) {
            // IF IT HAS A PACKAGE ID --> THEN WE NEED TO CHECK IT PUT THE CORRECT PAYMENT INFORMATION THERE
                //console.log("BOOKOUT PACKAGE", data);
                //console.log("BOOKOUT PACKAGE", data.packages);
                vm.packages = data.items;
                PlaneService.GetUpdatedCharges(vm.bookout.club_id, vm.bookout.plane_id, vm.bookout.put_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                            vm.bookout.plane_charges = data.plane_charges;
                            vm.calculate_invoice_for_flight();
                    });
            });

            // if(vm.bookout.put_id > 0){
            //     vm.bookout.payer_id = vm.bookout.put_id;
            // }


            if(vm.bookout.pic_id !== 0 && vm.bookout.pic_id !== vm.bookout.instructor_id){
                vm.bookout.payer_id = vm.bookout.pic_id; //PIC is student supervised or otherwise solo
            } else if((vm.bookout.instructor_id > 0 && vm.bookout.put_id > 0) || vm.bookout.instructor_id > 0 && vm.bookout.user_id > 0){
                vm.bookout.payer_id = (vm.bookout.put_id > 0)? vm.bookout.put_id : vm.bookout.user_id; //put always pays
            } else if(vm.bookout.put_id > 0){
                vm.bookout.payer_id = vm.bookout.put_id;
            } else if(vm.bookout.put_id == 0 && vm.bookout.user_id == 0){
                vm.bookout.payer_id = vm.bookout.pic_id;
            } else {
                if(vm.bookout.instructor_id == 0){
                    vm.bookout.payer_id = vm.bookout.pic_id;
                }
                if(vm.bookout.payer_id == 0){
                    ToastService.warning('Payer Required', 'Please select a student or person paying for this flight');
                }
            }


            
            if(vm.complete_flight){
                vm.complete_this_flight();
            }

            // if(vm.bookout.put.user_id == vm.bookout.user_id){
            //     //user is P1
            //     var selected_put = vm.pics.find(item => item.user_id === vm.bookout.put.user_id);
            //     vm.bookout.put = selected_put;
            // }

            // if(vm.bookout.put.user_id == vm.bookout.instructor_id){
            //     //instructor is P1
            //     var selected_put = vm.pics.find(item => item.user_id === vm.bookout.user_id);
            //     vm.bookout.put = selected_put;
            // }


            // if(vm.bookout.pic.user_id == vm.user.id && vm.bookout.instructor_id > 0){
            //     //console.log("okay... so you want the instructor to be put? interesting...");
            //     //adheres to booking

            // } else if(vm.bookout.instructor_id > 0 && vm.bookout.pic.user_id == vm.bookout.instructor_id) {
            //     //console.log("okay so you now have your booked instructor as the PIC again - nice");
            //     //adheres to booking

            // } else {
            //     //console.log("you've change instructor? what happened?");
            //     //availability has been checked hence we're OK

            // }
        }

        $scope.update_instructor = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);
            
            var selected_instructor = vm.instructors.find(item => item.user_id === vm.bookout.instructor.user_id);
            
            //console.log("INSTRUCTOR UPDATE: ", selected_instructor);

            if(selected_instructor && selected_instructor.user_id > 0){
                vm.bookout.instructor = selected_instructor;
                vm.bookout.instructor_id = selected_instructor.user_id;
                if(vm.bookout.pic_id !== 0 && vm.bookout.pic_id !== vm.bookout.instructor_id){
                    vm.bookout.payer_id = vm.bookout.pic_id; //PIC is student supervised or otherwise solo
                } else if((vm.bookout.instructor_id > 0 && vm.bookout.put_id > 0) || vm.bookout.instructor_id > 0 && vm.bookout.user_id > 0){
                    vm.bookout.payer_id = (vm.bookout.put_id > 0)? vm.bookout.put_id : vm.bookout.user_id; //put always pays
                } else if(vm.bookout.put_id > 0){
                    vm.bookout.payer_id = vm.bookout.put_id;
                } else if(vm.bookout.put_id == 0 && vm.bookout.user_id == 0){
                    vm.bookout.payer_id = vm.bookout.pic_id;
                } else {
                    if(vm.bookout.instructor_id == 0){
                        vm.bookout.payer_id = vm.bookout.pic_id;
                    }
                    if(vm.bookout.payer_id == 0){
                        ToastService.warning('Payer Required', 'Please select a student or person paying for this flight');
                    }
                }
                // if(vm.bookout.pic_id > 0){
                //     vm.bookout.payer_id = vm.bookout.pic_id;
                // }
            } else {
                vm.bookout.instructor = {};
                vm.bookout.instructor_id = 0;
                vm.bookout.payer_id = vm.bookout.pic_id;
            }

            if(vm.complete_flight){
                vm.complete_this_flight();
            }
            
        }


        


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
        vm.split_flight_confirmation = 0;

        vm.split_this_flight = function(){
            vm.split_flight = 1;
            //add this pls_id to the split
            var split_send = vm.split_flight_time;
            split_send.booking_id = vm.bookout.booking_id;
            split_send.this_pls_id = vm.bookout.id;
            // console.log("split it");
            // console.log("vm.bookout.id : ", vm.bookout.id);
            // console.log("split_send : ", split_send);
            PlaneService.HypotheticalFlightSplit(vm.bookout.id, split_send)
             .then(function (data) {
                    // console.log("data is : ", data);
                    vm.split_one = data.first_flight;
                    
                    vm.split_flight = 1;    
                    // vm.split_one.brakes_off = {"time": vm.split_one.brakes_off};
                    // vm.split_one.brakes_on = {"time": vm.split_one.brakes_on};
                    vm.split_two = data.second_flight;
                    vm.split_two.brakes_off = {"time": vm.split_two.brakes_off};
                    vm.split_two.brakes_on = {"time": vm.split_two.brakes_on};
                });

        }

        vm.cancel_split = function(){
            vm.bookout = vm.original_bookout;
            vm.split_one = {};
            vm.split_two = {};
            vm.split_flight = 0;
            vm.split_flight_confirmation = 0;

            process_bookout_to_bookin(vm.bookout);


        }

        vm.update_split = function(){
            // console.log("we updated the split time hmmm...");
            // console.log(vm.split_flight_time);
            
            // console.log("flight 1");
            // console.log(vm.bookout.brakes_off_rounded);
            // console.log(vm.split_flight_time.time);

            // console.log("flight 2");
            // console.log(vm.split_flight_time.time);
            // console.log(vm.bookout.brakes_on_rounded);

            var pls_id = vm.bookout.id; 
            if(!pls_id || pls_id == null || pls_id == 0){
                //console.log("RAW> ", vm.this_pls_id_raw);
                pls_id = vm.this_pls_id_raw;
            }
               // console.log("RAWDAWG ", pls_id);

            if(vm.has_used_claimed_flight && vm.claimed_flight.id > 0){
                //console.log("SPLIT FLIGHT CLAIMED");
                pls_id = vm.claimed_flight.id;
            }

            var split_send = vm.split_flight_time;
            split_send.booking_id = vm.bookout.booking_id;
            split_send.this_pls_id = vm.bookout.id;

            // console.log("split it");
            // console.log("pls_id : ", pls_id);
            // console.log("split_send : ", split_send);

            //hypothetical_flight_split
            PlaneService.HypotheticalFlightSplit(pls_id, split_send)
             .then(function (data) {
                    console.log("data is : ", data);
                    vm.split_one = data.first_flight;
                    
                    vm.split_flight = 1;    
                    // vm.split_one.brakes_off = {"time": vm.split_one.brakes_off};
                    // vm.split_one.brakes_on = {"time": vm.split_one.brakes_on};
                    vm.split_two = data.second_flight;
                    vm.split_two.brakes_off = {"time": vm.split_two.brakes_off};
                    vm.split_two.brakes_on = {"time": vm.split_two.brakes_on};
                });


        }

        function clean_times(which, start_end, compared_to = null){

            var compare_date;

            // //console.log("CLEAN TIMES " ,which);


            var this_date = new Date();


            if(vm.bookout && vm.bookout.brakes_off){

                compare_date = new Date(compared_to);
                var split_time = vm.bookout.brakes_off.time.split(":");
                compare_date.setHours(split_time[0]);
                compare_date.setMinutes(split_time[1]);
                compare_date.setSeconds(0);

                this_date = new Date(compared_to);
                this_date.setHours(0);
                this_date.setMinutes(0);
                this_date.setSeconds(0);

            } else {
                switch(which){
                    case 'today':
                        // compare_date = new Date();
                        compare_date = new Date("1990-07-26");

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
                        this_date = new Date(compared_to);
                    break;
                    case 'before':
                    //differentiate here
                        compare_date = new Date(compared_to);
                    break;
                }
            }

          

            //console.log("THIS DATE", this_date);
            //console.log("COMPARE DATE", compare_date);



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
        //clean_times('today', 'start_times');
        clean_times('future', 'all_times');

        // vm.bookout.pic = vm.pics[0];
        vm.currency_days = 28;


        vm.dateTimeRangePickerOptions = {
                hour_step: 1,
                minute_step: 30,
                min_date: new Date(),
                business_hours: {
                    from: "09:00",
                    to: "22:30"
                }
            };


         vm.dateTimeRangePickerOptions2 = {
                hour_step: 1,
                minute_step: 5,
                min_date: new Date(),
                business_hours: {
                    from: "00:00",
                    to: "23:55"
                }
            };

            vm.options = {
                hour_step: 1,
                minute_step: 5,
                min_date: new Date(),
                business_hours: {
                    from: "00:00",
                    to: "23:55"
                }
            };




            vm.lubricant_type = [{ title: "Fuel"}, {title: "Oil"}];
            vm.who_paid = [{ title: "Me"}, {title: "Club"}];
            vm.receipt = {
                image: "",
                quantity: 0,
                price: 0,
                reimbursement: false,
                item: {title: "Fuel"}
            };

            $scope.processFiles = function(files){

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    files[i].file.temp_path = j.saved_url;
                    // //console.log("file", files[i].file);
                    vm.receipt_image = files[i].file;
                    vm.receipt.image = vm.receipt_image.temp_path;
                    //console.log("IMAGE", vm.receipt_image);
                }
               
            }

            vm.update_course = function(){

                console.log("do we need to update tuition to be offered from this?");
                // IF nothing selected --> give ALL OPTIONS
                if(vm.bookout.course && vm.bookout.course.id > 0){

                    console.log("vm.bookout.course", vm.bookout.course);

                     InstructorCharges.GetByCourseId(vm.bookout.course.id)
                    .then(function(data){
                        vm.instructor_charges = data.items;  

                        //check if updates selected tuition received list?
                        if(vm.instructor_charges.length == 1){
                            //set this automatically?
                            vm.bookout.tuition_required = vm.instructor_charges[0];
                        }
                         //UPDATE TUITION CHARGES
                        vm.ignore_next_tuition_change = true;
                        vm.update_tuition_charges(); //>> is this right?
                    });

                } else {
                     InstructorCharges.GetByClubId(vm.bookout.club_id)
                    .then(function(data){
                        vm.instructor_charges = data.items;  

                        //check if updates selected tuition received list?
                        if(vm.instructor_charges.length == 1){
                            //set this automatically?
                            vm.bookout.tuition_required = vm.instructor_charges[0];
                        }
                         //UPDATE TUITION CHARGES
                        vm.ignore_next_tuition_change = true;
                        vm.update_tuition_charges(); //>> is this right?

                    });
                }
                // InstructorCharges.GetByClubId(booking.club_id)
                // .then(function(data){
                //     vm.instructor_charges = data.items;  
                // });

                // IF course is selected --> GIVE ONLY THAT COURSE OPTION


               



            }

            vm.update_tuition_charges = function(){

                if(vm.bookout.tuition_required && vm.bookout.tuition_required.id > 0){


                    InstructorCharges.GetUpdatedCharges(vm.bookout.tuition_required.id)
                    .then(function (data) {
                        //console.log("data is : ", data);

                        vm.bookout.tuition_charges = data.tuition_charges;
                        vm.bookout.tuition_required = data.tuition_required;
                        vm.bookout.tuition_id = data.tuition_required.id;
                        console.log("tuition charges: ", vm.bookout);
                        vm.calculate_invoice_for_flight();

                        if(vm.complete_flight){
                            vm.complete_this_flight();
                        }
                        vm.ignore_next_tuition_change = false;
                    });

                } else {
                    if(!vm.ignore_next_tuition_change){
                        if(vm.bookout.instructor_id > 0){
                            ToastService.warning('Tuition Required', 'Please select a tuition type for this flight.');
                        }
                        vm.ignore_next_tuition_change = false;
                    }
                    
                }


            }

            vm.delete_receipt = function(id){

                 PlaneService.DeleteReceipt(id)
                .then(function (rcpt) {

                    PlaneService.GetAllSheetReceipts(vm.bookout.id)
                    .then(function (data) {
                        ////console.log("data is : ", data);
                        vm.lubricant_receipts = data;
                        vm.calculate_invoice_for_flight();

                    });

                });
            }


            vm.check_reimbursement = function(){

                if(vm.receipt.price < 0.01 || vm.receipt.currency == ""){
                    return false;
                }

                var obj = {
                    price: vm.receipt.price,
                    currency: vm.receipt.currency.iso_code,
                    club_id: vm.bookout.club_id
                }

                PlaneService.CheckReimbursement(obj)
                    .then(function (data) {
                        //console.log("conversion", data);

                        vm.receipt.reimbursed_amount = data.reimburse.reimbursed_amount;
                        vm.receipt.reimbursed_currency = data.reimburse.reimbursed_currency;
                        vm.receipt.reimbursed_rate = data.reimburse.rate;
                        vm.receipt.reimbursed_datetime = data.reimburse.datetime;


                    });


            }


            vm.add_receipt = function(){

                if(vm.receipt.reimbursement && !vm.receipt.image){
                    ToastService.warning('Receipt Required', 'You must upload a copy of your receipt if you wish to be reimbursed.');
                    return false;
                }

                var obj = {
                    plane_id: vm.bookout.plane_id,
                    club_id: vm.bookout.club_id,
                    user_id: vm.user.id,
                    plane_log_sheet_id: vm.bookout.id,
                    reimbursement: vm.receipt.reimbursement,
                    image: vm.receipt.image,
                    currency: vm.receipt.currency.iso_code,
                    item: vm.receipt.item.title,
                    quantity: vm.receipt.quantity,
                    price: vm.receipt.price
                }

                //console.log("OBJ TO SEND: ", obj);


                PlaneService.AddReceipt(obj)
                .then(function (rcpt) {
                            //console.log("RECEIPTS", rcpt);          
                            vm.lubricant_receipts.push(rcpt.item);


                            //clear the uploaded items...
                            vm.receipt = {
                                image: "",
                                quantity: 0,
                                price: 0,
                                reimbursement: false,
                                item: {title: "Fuel"}
                            };

                            vm.calculate_invoice_for_flight();

                });


            }

            /* ADD OR EDIT THE BOOKING */

            function check_business_hours(i, k = null, start = 0){
            //i is hours
            //k is minutes
            k = parseInt(k);
            i = parseInt(i);

            var this_step_disabled = 0; 
            if(vm.options.business_hours){
                var split = vm.options.business_hours.from.split(":");
                var split2 = vm.options.business_hours.to.split(":");

                if(start == 0){
                    //adjust to match times / end min 1 hour slots
                   // split2[0] = parseInt(split2[0]) + 1;
                } else {
                    split2[0] = parseInt(split2[0]) - 1;
                }

                if(k || k == 0){
                    
                    if(i < parseInt(split[0]) ){
                        // //console.log("we disable because "+i+":"+k+" is before "+split.join(":") );
                        this_step_disabled = 1;
                    } else if(i == parseInt(split[0]) && k < parseInt(split[1])){
                         // //console.log("we disable because "+i+":"+k+" is before "+split.join(":") );
                        this_step_disabled = 1;
                    }

                    // if(i >= parseInt(split2[0]) && k >= parseInt(split2[1]) ){
                    //     // //console.log("we disable because "+i+":"+k+" is after "+split2.join(":") );
                    //     this_step_disabled = 1;
                    // } 


                    if(i > parseInt(split2[0])){
                        this_step_disabled = 1; 
                    } else if( i == parseInt(split2[0]) && k > parseInt(split2[1])){
                        this_step_disabled = 1;
                    }


                } else {
                    if(parseInt(split[0]) < i){
                        this_step_disabled = 1;
                    } 
                    if(parseInt(split2[0]) > i){
                        this_step_disabled = 1;
                    } 
                }
            }

            return this_step_disabled;
        }

        vm.options = {};
        vm.start_times = [];
        vm.end_times = [];

        vm.takeoff_times = [];
        vm.landing_times = [];

        


            function figure_out_steps(){
                //console.log("OPTIONS", vm.dateTimeRangePickerOptions2);
                vm.options = vm.dateTimeRangePickerOptions2;
                 for(var i=0;i<24;i+=vm.options.hour_step){

                    if(vm.options.minute_step && vm.options.minute_step > 0){
                        for(var j=0; j<(60/vm.options.minute_step); j++){
                            var k = vm.options.minute_step * j;
                            k = ((k < 10) ? '0' : '') + k;
                            vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                            vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                        }
                    } else {
                        vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                        vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
                    }

                }
                // vm.takeoff_times = angular.copy(vm.start_times);
                // vm.landing_times = angular.copy(vm.end_times);
                angular.copy(vm.start_times, vm.takeoff_times);
                angular.copy(vm.end_times, vm.landing_times);
            }

            function init_times(){
               for(var i=0;i<24;i+=vm.options.hour_step){

                    if(vm.options.minute_step && vm.options.minute_step > 0){
                        for(var j=0; j<(60/vm.options.minute_step); j++){
                            var k = vm.options.minute_step * j;
                            k = ((k < 10) ? '0' : '') + k;
                            vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                            vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                        }
                    } else {
                        vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                        vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
                    }

                } 
                // vm.takeoff_times = angular.copy(vm.start_times);
                // vm.landing_times = angular.copy(vm.end_times);
                angular.copy(vm.start_times, vm.takeoff_times);
                angular.copy(vm.end_times, vm.landing_times);
            }

            function get_duration_str(seconds){
                //var seconds = Math.floor(seconds);
                // //console.log(seconds);
                // //console.log(moment.duration(seconds));
                // //console.log("days: "+moment.duration(seconds).days());
                // //console.log("hours: "+moment.duration(seconds).hours());
                // //console.log("minutes: "+moment.duration(seconds).minutes());

                var days = moment.duration(seconds).days();
                var hours = moment.duration(seconds).hours();
                var minutes = moment.duration(seconds).minutes();

                //occasional issue showing 59 minutes - unsure where but this is a fix for it... think moment() has a bug
                if(minutes == 59){
                    hours++;
                    minutes = 0;
                }


                var string = "";
                if(days > 0){
                    string = string+" "+days+" day";
                    string = (days > 1)? string+"s" : string;
                }
                if(hours > 0){
                    string = string+" "+hours+" hour";
                    string = (hours > 1)? string+"s" : string;
                }
                if(minutes > 0){
                    string = string+" "+minutes+" minute";
                    string = (minutes > 1)? string+"s" : string;
                }

                 // //console.log("STR : "+string);

                return string;

            }

            vm.calculate_my_brakes_duration = function(){
             //   calculate_duration(); //symlink
                 if(vm.bookout.start_date && vm.bookout.brakes_off){
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.brakes_off.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);
                    // //console.log("START DATETIME", start_datetime);  

                    vm.end_times.forEach(function(time, i){ 
                        //no need to go through each element if its not required to be shown!
                        if(time.disabled == 0){

                            var end_datetime = new Date(vm.bookout.end_date);
                            var end_time = time.time.split(":");
                            end_datetime.setHours(end_time[0]);
                            end_datetime.setMinutes(end_time[1]);  
                            end_datetime.setSeconds(0);
                            // //console.log("END DATETIME", end_datetime);  

                            var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                            //now we need to calculate the difference in datetime
                            // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                            var human_str = get_duration_str(difference);

                           


                            // //console.log("human string", human_str);
                            if(human_str == ""){
                                vm.end_times[i].disabled = 1;
                                //vm.takeoff_times[i].disabled = 1;
                            } else {
                                vm.end_times[i].duration = "( "+human_str+" )";
                            }


                        } else {
                            vm.end_times[i].duration = "";
                        }
                      //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    });

                    // console.log("SELECTED HERE: vm.show_takeoff_landing_times ", vm.show_takeoff_landing_times);

                    if(vm.show_takeoff_landing_times){
                        //also set the takeoff 5mins after taxi?
                        //vm.takeoff_times = vm.end_times;
                        angular.copy(vm.end_times, vm.takeoff_times);
                        // console.log("SELECTED HERE????", vm.takeoff_times);
                    }

                }
            }    

            function calculate_duration(){
                if(vm.bookout.start_date && vm.bookout.start_time){
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.start_time.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);
                    // //console.log("START DATETIME", start_datetime);  

                    vm.end_times.forEach(function(time, i){ 
                        //no need to go through each element if its not required to be shown!
                        if(time.disabled == 0){

                            var end_datetime = new Date(vm.bookout.end_date);
                            var end_time = time.time.split(":");
                            end_datetime.setHours(end_time[0]);
                            end_datetime.setMinutes(end_time[1]);  
                            end_datetime.setSeconds(0);
                            // //console.log("END DATETIME", end_datetime);  

                            var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                            //now we need to calculate the difference in datetime
                            // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                            var human_str = get_duration_str(difference);

                           


                            // //console.log("human string", human_str);
                            if(human_str == ""){
                                vm.end_times[i].disabled = 1;
                                //vm.takeoff_times[i].disabled = 1;
                            } else {
                                vm.end_times[i].duration = "( "+human_str+" )";
                            }


                        } else {
                            vm.end_times[i].duration = "";
                        }
                      //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    });

                    //console.log("SELECTED HERE: vm.show_takeoff_landing_times ", vm.show_takeoff_landing_times);

                    if(vm.show_takeoff_landing_times){
                        //also set the takeoff 5mins after taxi?
                        //vm.takeoff_times = vm.end_times;
                        angular.copy(vm.end_times, vm.takeoff_times);
                        //console.log("SELECTED HERE????", vm.takeoff_times);
                    }

                }
            }


            vm.calculate_airborne_duration = function(){
                if(vm.bookout.takeoff_time){
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.takeoff_time.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);
                    // //console.log("START DATETIME", start_datetime);  

                    vm.landing_times.forEach(function(time, i){ 
                        //no need to go through each element if its not required to be shown!
                        if(time.disabled == 0){

                            var end_datetime = new Date(vm.bookout.end_date);
                            var end_time = time.time.split(":");
                            end_datetime.setHours(end_time[0]);
                            end_datetime.setMinutes(end_time[1]);  
                            end_datetime.setSeconds(0);
                            // //console.log("END DATETIME", end_datetime);  

                            var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                            //now we need to calculate the difference in datetime
                            // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                            var human_str = get_duration_str(difference);

                           


                            // //console.log("human string", human_str);
                            if(human_str == ""){
                                vm.landing_times[i].disabled = 1;
                            } else {
                                vm.landing_times[i].duration = "( "+human_str+" )";
                            }


                        } else {
                            vm.landing_times[i].duration = "";
                        }
                      //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    });
                }
            }


            vm.calculate_after_landing_duration = function(){

                if(vm.show_takeoff_landing_times){
                        //also set the takeoff 5mins after taxi?

                        if(vm.bookout.start_date && vm.bookout.landing_time){
                            var start_datetime = new Date(vm.bookout.start_date);
                            var start_time = vm.bookout.landing_time.time.split(":");
                            start_datetime.setHours(start_time[0]);
                            start_datetime.setMinutes(start_time[1]);
                            start_datetime.setSeconds(0);
                            // //console.log("START DATETIME", start_datetime);  

                            vm.end_times.forEach(function(time, i){ 
                                //no need to go through each element if its not required to be shown!
                                if(time.disabled == 0){

                                    var end_datetime = new Date(vm.bookout.end_date);
                                    var end_time = time.time.split(":");
                                    end_datetime.setHours(end_time[0]);
                                    end_datetime.setMinutes(end_time[1]);  
                                    end_datetime.setSeconds(0);
                                    // //console.log("END DATETIME", end_datetime);  

                                    var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                                    //now we need to calculate the difference in datetime
                                    // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                                    var human_str = get_duration_str(difference);

                                   


                                    // //console.log("human string", human_str);
                                    if(human_str == ""){
                                        vm.end_times[i].disabled = 1;
                                    } else {
                                        vm.end_times[i].duration = "( "+human_str+" )";
                                    }


                                } else {
                                    vm.end_times[i].duration = "";
                                }
                              //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                            });

                            
                        }


                }


                
            }


            vm.flight_units = 
            {
                brakes_to_brakes: 0,
                airborne_times: 0,
                flight_time: 0,
                meter_units: (vm.bookout.end_tacho - vm.bookout.start_tacho)
            };

            vm.cancel_split = function(){
                vm.bookout = vm.original_bookout;
                vm.bookout.brakes_off = vm.bookout.brakes_off.time;
                vm.bookout.brakes_on = vm.bookout.brakes_on.time;
                console.log(vm.bookout);
                console.log(vm.bookout.brakes_on);
                vm.split_flight_confirmation = 0;
                vm.split_flight = 0;
                // vm.split_one = {};
                // vm.split_two = {};
                process_bookout_to_bookin(vm.bookout);
                //vm.calculate_my_airborne_duration();
            }

            vm.confirm_split = function(){
                console.log("CONFIRM SPLIT");

                vm.try_split = true;

                vm.before_split_bookout = vm.bookout;
                vm.split_flight_confirmation = 1;

                vm.original_bookout = vm.bookout;
                vm.split_one.touch_and_go = vm.bookout.touch_and_go;
                vm.split_one.tng = vm.bookout.tng;
                console.log("TNG : ", vm.split_one.touch_and_go);

                vm.split_one.full_stop_landings = vm.bookout.full_stop_landings
                vm.split_one.landings = vm.bookout.landings;
                vm.split_one.remote_landings = vm.bookout.remote_landings;
                vm.split_one.pic = vm.bookout.pic;
                vm.split_one.pic_id = vm.bookout.pic_id;
                vm.split_one.put = vm.bookout.put;
                vm.split_one.put_id = vm.bookout.put_id;
                vm.split_one.payer_id = vm.bookout.payer_id;
                vm.split_one.instructor = vm.bookout.instructor;
                vm.split_one.instructor_id = vm.bookout.instructor_id;
                vm.split_one.booking = vm.bookout.booking;
                vm.split_one.booking_id = vm.bookout.booking_id;
                if(vm.bookout.course && vm.bookout.course.id){
                    vm.split_one.course_id = vm.bookout.course.id;
                }
                vm.split_one.course = vm.bookout.course;
                vm.split_one.tuition_required = vm.bookout.tuition_required;
                //vm.split_one.tuition = vm.bookout.course;
                // vm.split_one.plane = vm.bookout.plane;
                //vm.bookout.course

                vm.split_one.authorised_solo = vm.bookout.authorised_solo;
                // vm.split_one.plane = vm.bookout.plane;
                // vm.split_one.plane = vm.bookout.plane;
                // vm.split_one.plane = vm.bookout.plane;


                //UPDATE THE FLIGHT TIME UNITS NOW
                vm.flight_units.brakes_to_brakes = vm.split_one.brakes_times;

                vm.flight_units.airborne_times = vm.split_one.airborne_time;

                vm.flight_units.flight_time = vm.split_one.flight_time;

                vm.flight_units.brakes_times_rounded = vm.split_one.brakes_times_rounded;


                console.log("OLD ONE - ", vm.split_one);

                vm.bookout = vm.split_one;

                console.log("SPLIT 1 - ", vm.split_one);
                console.log("SPLIT 2 - ", vm.split_two);
                
                process_bookout_to_bookin(vm.bookout);

                console.log("new bookout = ", vm.bookout);

                //vm.calculate_invoice_for_flight();
            }
            
            vm.calculate_my_airborne_duration = function(){

                if(vm.has_used_claimed_flight) { //and not overridden??
                    //this should never happen....

                    vm.flight_units.brakes_to_brakes = vm.claimed_flight.brakes_time;
                    vm.flight_units.airborne_times = vm.claimed_flight.airborne_time;
                    vm.flight_units.flight_time = vm.claimed_flight.flight_time;
                    vm.flight_units.brakes_times_rounded = vm.claimed_flight.brakes_times_rounded;

                    vm.calculate_invoice_for_flight();
                

                } else {


                    if((vm.bookout.takeoff_time && vm.bookout.takeoff_time.time) && (vm.bookout.landing_time && vm.bookout.landing_time.time)){

                        //console.log("BOTH SET SO", vm.bookout.brakes_off.time);
                        //console.log("BOTH SET SO", vm.bookout.brakes_on.time);
                        var start_datetime = new Date();
                        var start_time = vm.bookout.takeoff_time.time.split(":");
                        start_datetime.setHours(start_time[0]);
                        start_datetime.setMinutes(start_time[1]);
                        start_datetime.setSeconds(0);


                        var end_datetime = new Date();
                        //var end_time = time.time.split(":");
                        var end_time = vm.bookout.landing_time.time.split(":");
                        end_datetime.setHours(end_time[0]);
                        end_datetime.setMinutes(end_time[1]);  
                        end_datetime.setSeconds(0);


                        var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));
                        // var human_str = get_duration_str(difference);

                        vm.flight_units.airborne_times = moment.duration(difference).asHours();
                        //console.log("HELLO DURATION CALC", vm.flight_units.brakes_to_brakes);


                        vm.calculate_invoice_for_flight();
                        //  //console.log("HELLO DURATION CALC2", human_str);

                    }

                    if(vm.bookout.brakes_off && vm.bookout.brakes_off.time !== "" && vm.bookout.brakes_on && vm.bookout.brakes_on.time !== ""){


                        var bstart_datetime = new Date();
                        var bstart_time = vm.bookout.brakes_off.time.split(":");
                        bstart_datetime.setHours(bstart_time[0]);
                        bstart_datetime.setMinutes(bstart_time[1]);
                        bstart_datetime.setSeconds(0);


                        var bend_datetime = new Date();
                        //var end_time = time.time.split(":");
                        if(vm.bookout.brakes_on && vm.bookout.brakes_on.time){

                            var bend_time = vm.bookout.brakes_on.time.split(":");
                            bend_datetime.setHours(bend_time[0]);
                            bend_datetime.setMinutes(bend_time[1]);  
                            bend_datetime.setSeconds(0);


                            var difference = moment(moment(bend_datetime).startOf("minute")).diff(moment(bstart_datetime).startOf("minute"));
                            // var human_str = get_duration_str(difference);

                            vm.flight_units.brakes_to_brakes = moment.duration(difference).asHours();
                            //console.log("HELLO DURATION CALC", vm.flight_units.brakes_to_brakes);

                            //console.log("FLIGHT BRAKES UNITS : ", vm.flight_units.brakes_to_brakes);

                            vm.calculate_invoice_for_flight();


                        }
                        

                    }

                    

                    
                }


                vm.flight_times_complete = true;

            }



            vm.update_dateTime = function(){
                //console.log("STARTED", vm.bookout.brakes_off);
                //console.log("STARTED", vm.bookout.brakes_on);
                if(vm.has_used_claimed_flight) { //and not overridden??


                    vm.flight_units.brakes_to_brakes = vm.claimed_flight.brakes_time;
                    vm.flight_units.airborne_times = vm.claimed_flight.airborne_time;
                    vm.flight_units.flight_time = vm.claimed_flight.flight_time;

                    vm.calculate_invoice_for_flight();
                
                } else {


                    if((vm.bookout.brakes_off && vm.bookout.brakes_off.time) && (vm.bookout.brakes_on && vm.bookout.brakes_on.time)){

                        //console.log("BOTH SET SO", vm.bookout.brakes_off.time);
                        //console.log("BOTH SET SO", vm.bookout.brakes_on.time);
                        var start_datetime = new Date();
                        var start_time = vm.bookout.brakes_off.time.split(":");
                        start_datetime.setHours(start_time[0]);
                        start_datetime.setMinutes(start_time[1]);
                        start_datetime.setSeconds(0);


                        var end_datetime = new Date();
                        //var end_time = time.time.split(":");
                        var end_time = vm.bookout.brakes_on.time.split(":");
                        end_datetime.setHours(end_time[0]);
                        end_datetime.setMinutes(end_time[1]);  
                        end_datetime.setSeconds(0);


                        var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));
                        // var human_str = get_duration_str(difference);

                        vm.flight_units.brakes_to_brakes = moment.duration(difference).asHours();
                        //console.log("HELLO DURATION CALC", vm.flight_units.brakes_to_brakes);


                        vm.calculate_invoice_for_flight();
                        //  //console.log("HELLO DURATION CALC2", human_str);

                    }
                }


                vm.flight_times_complete = true;

            }


            function check_relative_date(date, start_end = "start"){
                var relative = "today";
                //console.log("RELATIVE TIME CHECK", date);
                if(moment(moment(date).format("YYYY/MM/DD")).isAfter(moment().format("YYYY/MM/DD"))){
                    relative = "future";

                    //then is after today
                    // the catch is that if date == start / end date --> THEN we need to present that it is today even though it isnt - this is premise
                    // that is valid only for the "END" cases (so that we return AFTER rather than today) --> otherwise the end_times available won't reflect
                    //the fact that the start_times have been selected allowing the user to select an end time before start time (which is silly really...)

                    if(vm.bookout.start_date && vm.bookout.end_date && start_end == "end"){
                        if(moment(vm.bookout.start_date).isSame(moment(vm.bookout.end_date))){
                            relative = "after"; // because we need to act as though it is after in the clean_times (to not be able to select end < start times)
                        }
                    }
                    
                } else if(moment(date).format("YYYY/MM/DD") == moment().format("YYYY/MM/DD")){
                    //then today
                    relative = (start_end == "start") ? "today" : "after";
                } else {
                    //must be in the past...
                    relative = "past";
                }
                
                // //console.log("relative is ", relative);
                return relative;
            }

            // function add_hour_to_end(){
            //     var a = vm.bookout.start_time.time.split(":");
            //     //var b = new Date();
            //     var b = new Date(vm.bookout.start_date);
            //     b.setHours(a[0]);
            //     b.setMinutes(a[1]);
            //     b.setSeconds(0);
            //     var future = moment(b).add(1, "hour").format();
            //    // clean_times('after', 'end_times', future);
            //    //

            //      //clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', future);



            //     if(parseInt(a[0]) >= 23){
            //         if(moment(vm.bookout.start_date).isSame(moment(vm.bookout.end_date))){
            //              // //console.log("THIS ADD DAY");
            //             // //console.log("start", vm.bookout.start_date);
            //             // //console.log("end", vm.bookout.end_date);
            //              // //console.log("after or = 11pm - then we need to change the date that follows the same pattern");
            //             vm.bookout.end_date = new Date(moment(vm.bookout.end_date).add(1, "day").format());
            //             clean_times('future', 'end_times');

            //             //set it to 00:00 hours probably a wise thing...
            //             vm.bookout.end_time = vm.end_times[0];


            //         } 
            //     } else {
            //         clean_times('after', 'end_times', b);
            //     }

            // }

        function check_times(){

                var c = new Date();
                var a = (vm.bookout.start_time) ? vm.bookout.start_time.time.split(":") : [c.getHours(), c.getMinutes()];
                var b = new Date(vm.bookout.start_date);
                b.setHours(a[0]);
                b.setMinutes(a[1]);
                b.setSeconds(0);
                var future = moment(b).add(1, "hour").format();

                //check if the end_time is set && if the end time is > start time...
                if(start_after_end() || !vm.bookout.end_time){
                    
                    clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);

                    var id;
                    // vm.end_times.forEach(function(time, i){ 
                    //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    // });
                    vm.end_times.some(function(time, i){ 
                      if(time.time == moment(future).format("H:mm")){ id = i; return i;};  
                    });

                    vm.bookout.end_time = {};
                    vm.bookout.end_time = vm.end_times[id];

                } else {
                    clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);
                }


                 //need to update the selection of the end time if this has been set
                if(vm.bookout.end_time && vm.bookout.end_time.disabled == 1){

                    var id;
                    //used to use a forEach loop but decided to run a some loop instead due to the benefit of not going through all elements
                    // vm.end_times.forEach(function(time, i){ 
                    //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    // });
                    vm.end_times.some(function(time, i){ 
                      if(time.time == moment(future).format("H:mm")){ id = i; return i;};  
                    });

                    vm.bookout.end_time = {};
                    vm.bookout.end_time = vm.end_times[id];

                }

                if(vm.bookout.start_time && vm.bookout.start_time.disabled == 1){

                    var id;
                    vm.start_times.some(function(time, i){ 
                      if(time.disabled == 0){ id = i; return i;}; 
                    });

                    vm.bookout.start_time = {};
                    vm.bookout.start_time = vm.start_times[id];

                    calculate_duration();
                }
        }




         function booking_today(){
                if(moment(vm.bookout.start_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
                    //console.log("WE ARE TODAY?");
                    clean_times('today', 'start_times');

                } else {
                    // //console.log("should get full day");
                    if(moment(vm.bookout.start_date).isAfter(moment()) ){
                        clean_times('future', 'start_times');
                    }
                }

                if(moment(vm.bookout.end_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
                    if(vm.bookout.start_time){
                       //console.log("START TIME", vm.bookout.start_time);
                        add_hour_to_end(); 
                    }
                    clean_times(check_relative_date(vm.bookout.start_date), 'end_times');
                }


                if(vm.bookout.end_date == vm.bookout.start_date){
                        // //console.log("booking today where end = start");
                        if(vm.bookout.start_time){
                            var a = vm.bookout.start_time.time.split(":");
                            var b = new Date(vm.bookout.start_date);
                            b.setHours(a[0]);
                            b.setMinutes(a[1]);
                            b.setSeconds(0);

                            //we need to check the times give
                            if(start_after_end()){
                                clean_times(check_relative_date(vm.bookout.start_date), 'start_times');
                                // //console.log("UPDATE END BITS IF START > END required?");
                                clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);
                                add_hour_to_end();
                            } else {
                                // //console.log("UPDATE END BITS IF START > END 2", check_relative_date(vm.bookout.start_date, "end"));
                                clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);
                            }


                        }
                }

            }

            // clean_times('today', 'start_times');
            booking_today();


        $scope.update_dateTime = function(which_update){

            //console.log("UPDATE TIME HERE", which_update);

            switch(which_update){

               

                case 'start_time':

                    //do we need to clean the times? if so.. 
                    booking_today();

                    check_times();

                    //we need to calculate the time in between the start and the end!
                    calculate_duration();
                    

                break;

                case 'end_time':
                    check_times();

                break;

                case 'edit':

                    // //this is the edit function that needs to be setup.
                    // booking_today();

                    // //number 1 = we have set start and end of the current date....
                    // // setTimeout(function(){
                    // //     check_times();
                    // //     // calculate_duration();
                    // // }, 5000);
                    // //console.log("ASD ",vm.bookout.start_date);
                    // // clean_times(check_relative_date(vm.bookout.start_date), 'start_times');
                    // check_times();
                    // calculate_duration();

                    booking_today();

                    clean_times(check_relative_date(vm.bookout.start_date), 'start_times');

                    check_times();

                    calculate_duration();

                    setTimeout(function(){
                        //do we need to clean the times? if so.. 
                        // pre_select_value_id("start_times", vm.bookout.start_time);
                        pre_select_value_id();
                        //we need to calculate the time in between the start and the end!
                    }, 500);




                    //we need to set the previously selected plane here...


                break;

            }


            //an update on the form would require an update of the plane / waiting lists available
          


        }



        function start_after_end(){
                var start_after_end = false;
                if(vm.bookout.end_time){
                    // //console.log("START AFTER END LOOP");
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.start_time.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);

                    var end_datetime = new Date(vm.bookout.end_date);
                    var end_time = vm.bookout.end_time.time.split(":");
                    end_datetime.setHours(end_time[0]);
                    end_datetime.setMinutes(end_time[1]);
                    end_datetime.setSeconds(0);

                    if(moment(start_datetime).isAfter(moment(end_datetime)) || moment(start_datetime).isSame(end_datetime) || end_datetime == start_datetime){
                        start_after_end = true;
                    }


                }
                return start_after_end;
        }

        figure_out_steps();
        init_times();

        switch($state.current.data.action){
            case "add":

                //console.log("bookout", $stateParams.id);
                //so now we can load the BOOKING with this ID, and therefore can sort it all out :)
                // let us preload the content required from the booking - fetch the booking
                //console.log("FETCH THE BOOKING");

                BookingService.GetForBookIn($stateParams.id)
                 .then(function (data) {
                    console.log("data is : ", data);
                    if(data.success){
                        //console.log("success");
                        

                        if(data.bookout.booked_in == 1){
                            ToastService.warning('Already Booked', 'It appears that you have already booked this flight back in.');
                            $state.go('dashboard.my_account', {}, { reload: true });
                        }

                        vm.original_bookout = data.bookout;
                        vm.bookout = data.bookout;

                        vm.claim_a_flight = data.unclaimed;
                        // BookingService.GetUnclaimedFlights(vm.bookout.plane_id).then(function (data) {
                        //         ////console.log("data is : ", data);
                        //         if(data.success){
                        //             console.log(data);
                        //         }
                        //     });


                        // FoxService.GetFoxEntriesByPlane(vm.bookout.plane_id)
                        // .then(function (data) {
                        //     if(data.success){
                        //         console.log(data);
                        //         vm.claim_a_flight = data.to_claim;
                        //     }

                        // });

                        //temporary bits to overcome the start and end times issues...
                        vm.bookout.start_date = new Date("2100/07/26");
                        vm.bookout.end_date = new Date("2100/07/26");
                        //console.log("RAW DATA HERE : ", data);
                        // MemberService.GetAllByPics(data.bookout.club_id, vm.user.id)

                        MemberService.GetAllByPicsBookinout(vm.bookout.booking_id, vm.bookout.club_id, vm.user.id, 1)
                            .then(function (pics) {
                                    vm.pics = pics;
                                    console.log("PICS: ", vm.pics);
                                    process_bookout_to_bookin(data.bookout);
                            });

                       MemberService.GetAllByClubInstructor(vm.bookout.club_id, vm.user.id)
                            .then(function (instructors) {
                                    vm.instructors = instructors.instructors;
                                    //process_bookout_to_bookin(data.bookout);
                            });


                        PackageService.GetPackagesForBookout(vm.bookout.id)
                            .then(function (data) {
                            // IF IT HAS A PACKAGE ID --> THEN WE NEED TO CHECK IT PUT THE CORRECT PAYMENT INFORMATION THERE
                                //console.log("BOOKOUT PACKAGE", data);
                                //console.log("BOOKOUT PACKAGE", data.packages);
                                vm.packages = data.packages;
                            });

                            // if(vm.bookout.put_id > 0){
                            //     vm.bookout.payer_id = vm.bookout.put_id;
                            // } else {
                            //     vm.bookout.payer_id = vm.bookout.pic_id;
                            // }

                            if(vm.bookout.payer_id == 0){
                                if(vm.bookout.pic_id !== 0 && vm.bookout.pic_id !== vm.bookout.instructor_id){
                                    vm.bookout.payer_id = vm.bookout.pic_id; //PIC is student supervised or otherwise solo
                                } else if((vm.bookout.instructor_id > 0 && vm.bookout.put_id > 0) || vm.bookout.instructor_id > 0 && vm.bookout.user_id > 0){
                                    vm.bookout.payer_id = (vm.bookout.put_id > 0)? vm.bookout.put_id : vm.bookout.user_id; //put always pays
                                } else if(vm.bookout.put_id > 0){
                                    vm.bookout.payer_id = vm.bookout.put_id;
                                } else if(vm.bookout.put_id == 0 && vm.bookout.user_id == 0){
                                    vm.bookout.payer_id = vm.bookout.pic_id;
                                } else {
                                    if(vm.bookout.instructor_id == 0){
                                        vm.bookout.payer_id = vm.bookout.pic_id;
                                    }
                                    if(vm.bookout.payer_id == 0){
                                        ToastService.warning('Payer Required', 'Please select a student or person paying for this flight');
                                    }
                                }
                            }


                        

                    }
                });

                
            break;
            case "edit":

            



            break;
            case "list":

             


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  
      

        vm.get_package_html = function(pack_obj){
            var used_on = "";
            for(var i=0;i<pack_obj.aircraft.length;i++){
                used_on = used_on + " " + pack_obj.aircraft[i].registration +" ("+ pack_obj.aircraft[i].plane_type +") <br />";
            }
            var text = "";
            if(pack_obj.validity == 0){
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package does not expire <br /> To be used on:<br />";
            } else {
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package expires on: "+ moment(pack_obj.created_at).add(pack_obj.validity, "days").format("D MMM Y") +" <br /> To be used on:<br />";
            }
    
            return text+used_on;

        }

        vm.this_was_a_supervised_solo = function(){
            vm.this_was_supervised_solo = !vm.this_was_supervised_solo;
            //pic probably is the payer
            if(vm.this_was_supervised_solo){
                vm.bookout.payer_id = vm.bookout.pic_id;
            } else if(vm.bookout.put_id > 0) {
                vm.bookout.payer_id = vm.bookout.put_id;
            } else if(vm.bookout.user_id > 0){
                vm.bookout.payer_id = vm.bookout.user_id;
            }

            // if(vm.complete_flight && vm.){
            //     vm.complete_this_flight();
            // }

        }

        vm.this_was_instructional_claim = function(){
            //toggle as it worked
            vm.this_claim_was_instructional = !vm.this_claim_was_instructional;
            vm.complete_flight = false;
            if(vm.this_claim_was_instructional){

                vm.ignore_next_tuition_change = true;

                //then PIC is the INSTRUCTOR
                //vm.bookout.instructor_id = vm.bookout.pic.user_id;
                vm.bookout.payer_id = vm.bookout.put_id;

                if(vm.bookout.instructor_id == 0 && (vm.bookout.pic && vm.bookout.pic.user_id > 0)){
                    vm.bookout.instructor_id = vm.bookout.pic.user_id;
                }

                preselect_course_and_tuition();

            } else {
                vm.bookout.put_id = 0;
                vm.bookout.put = {};
                vm.bookout.instructor_id = 0;
                if(vm.bookout.pic_id > 0){
                    vm.bookout.payer_id = vm.bookout.pic_id;
                } else if(vm.bookout.user_id > 0) {
                    vm.bookout.payer_id = vm.bookout.user_id;
                } else {
                    //alert("It appears that no payer ID has been set yet.");
                }
            }

            vm.calculate_invoice_for_flight();

            // if(vm.complete_flight){
            //     vm.complete_this_flight();
            // }

        }


        // vm.convert_decimal_to_hours = function(decimal_time){
        //     var temp = new Array();
        //     temp = decimal_time.toString().split('.');
            
        //     var hours = temp[0];
        //     if(hours < 10){
        //         hours = "0"+hours;
        //     }
        //     if(temp[1]){
        //        var minutes = 100 / temp[1];
        //         minutes = Math.round(60 / minutes); 

        //         if(minutes < 10){
        //             minutes = "0"+minutes;
        //         }
        //     } else {
        //         minutes = "00"
        //     }

        //     return hours + ':' + minutes;
        // }



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

        vm.add_defect = function(){


            var obj = {
                club_id: vm.bookout.club_id,
                user_id: vm.bookout.user_id,
                plane_id: vm.bookout.plane_id,
                defect: vm.defect,
                severity: vm.defect_severity.title,
                status: "open"
            }

            

        
            PlaneService.AddDefect(obj)
             .then(function (data) {
                    ////console.log("data is : ", data);
                    data.item.can_delete = true;

                   vm.reported_defects.push(data.item);

                   vm.defect = "";
                   vm.defect_severity = "";
                });

        }

        vm.delete_defect = function(id){
            //console.log("UNDO DEFECT ID ", id);

            PlaneService.DeleteDefect(id)
            .then(function (data) {
                    ////console.log("data is : ", data);
                   
                    PlaneService.GetOpenIssues(vm.bookout.plane_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                           vm.reported_defects = data;
                        });


                });

        }

        vm.tacho_error_highlight = false;

        vm.check_tacho_bigger = function(){

         if(vm.bookout.start_tacho >= vm.bookout.end_tacho){
                    ToastService.warning('Tacho Error', 'Please check start and end tacho. You cannot end on a smaller tacho.');
                    vm.tacho_error_highlight = true;
                } else {
                    vm.tacho_error_highlight = false;
                }

         }


        vm.calculate_invoice_for_flight = function(){
             console.log("RUN CALCULATION", vm.flight_units);
            //vm.flight_units where the units are stored
            if(vm.free_flight){
                if(vm.bookout.plane_charges){
                    vm.bookout.plane_charges.charge_rate_unit = 0;
                    vm.bookout.plane_charges.surcharge_fee = 0;
                    vm.bookout.plane_charges.landing_fee = 0;
                    vm.bookout.plane_charges.touch_and_go_fee = 0;
                }
                
                if(vm.bookout.tuition_charges){
                    vm.bookout.tuition_charges.price = 0;
                }
                
            }

            //vm.bookout.plane_charges where the fees are stored
            var plane_units = 0;


            if(vm.claimed_flight && vm.claimed_flight !== null){
                // console.log("NO SELECTED FLIGHT??");

                //plane units
                if(vm.bookout.plane_charges.charge_type == "flight"){
                    //then the units relate to the entered numbers:
                    plane_units = vm.flight_units.airborne_times;

                } else if(vm.bookout.plane_charges.charge_type == "airborne"){
                    //then the units relate to the entered numbers:
                    plane_units = vm.flight_units.airborne_times;

                } else if(vm.bookout.plane_charges.charge_type == "brakes"){
                    //then the units relate to the entered numbers:
                    if((!vm.flight_units.brakes_to_brakes || vm.flight_units.brakes_to_brakes == 0) && vm.bookout.brakes_times && vm.bookout.brakes_times > 0){
                                            plane_units = vm.bookout.brakes_times;
                                            vm.flight_units.brakes_to_brakes = vm.bookout.brakes_times;

                    } else {
                                            plane_units = vm.flight_units.brakes_to_brakes;
                    }

                } else if(vm.bookout.plane_charges.charge_type == "brakes_rounded"){
                    //then the units relate to the entered numbers:
                    plane_units = vm.flight_units.brakes_to_brakes;
                } else {
                    //hobbs --> to use the tacho area as the item
                    //then the units we need to calculate relate to the hours between brakes off and on.
                    plane_units = (vm.bookout.end_tacho - vm.bookout.start_tacho);
                }


            } else {
                // console.log("SELECT FLIGHT SO WE CAN USE THE FOLLOWING");
                //plane units
                if(vm.bookout.plane_charges.charge_type == "flight"){
                    //then the units relate to the entered numbers:
                    plane_units = vm.flight_units.flight_time;

                } else if(vm.bookout.plane_charges.charge_type == "airborne"){
                    //then the units relate to the entered numbers:
                    plane_units = vm.flight_units.airborne_times;

                } else if(vm.bookout.plane_charges.charge_type == "brakes"){
                    //then the units relate to the entered numbers:
                    //plane_units = vm.flight_units.brakes_to_brakes;

                    if((!vm.flight_units.brakes_to_brakes || vm.flight_units.brakes_to_brakes == 0) && vm.bookout.brakes_times && vm.bookout.brakes_times > 0){
                                            plane_units = vm.bookout.brakes_times;
                                            vm.flight_units.brakes_to_brakes = vm.bookout.brakes_times;

                    } else {
                                            plane_units = vm.flight_units.brakes_to_brakes;
                    }

                } else if(vm.bookout.plane_charges.charge_type == "brakes_rounded"){
                    //then the units relate to the entered numbers:
                    plane_units = vm.flight_units.brakes_times_rounded;
                } else {
                    //hobbs --> to use the tacho area as the item
                    //then the units we need to calculate relate to the hours between brakes off and on.
                    plane_units = (vm.bookout.end_tacho - vm.bookout.start_tacho);
                }

            }

            
            if((!vm.flight_units.brakes_to_brakes || vm.flight_units.brakes_to_brakes == 0) && vm.bookout.brakes_times && vm.bookout.brakes_times > 0){
                console.log("force it again");
                vm.flight_units.brakes_to_brakes = vm.bookout.brakes_times;
            }



            console.log("plane units: ", plane_units);
            vm.package_removed = [];
            vm.package_used = false;

            if(vm.packages && vm.packages.length > 0){

                for(var i=0;i<vm.packages.length;i++){
                                
                    vm.package_used = true;

                    if(vm.bookout.instructor_id && vm.bookout.instructor_id > 0){
                        //then its dual
                        if(vm.packages[i].remaining_hours_dual && vm.packages[i].remaining_hours_dual > 0){
                            if(plane_units < vm.packages[i].remaining_hours_dual){

                                var rem = vm.packages[i].remaining_hours_dual - plane_units;
                                vm.package_removed.push({solo_dual: "dual", title: vm.packages[i].title, member_packages_id: vm.packages[i].id, hours_dual_before: vm.packages[i].remaining_hours_dual, hours_dual_spent: plane_units, hours_dual_remaining_after: rem, hours_solo_remaining_after: vm.packages[i].remaining_hours_solo, package_id: vm.packages[i].package_id});
                                plane_units = 0;

                                break;
                            } else {

                                vm.package_removed.push({solo_dual: "dual", title: vm.packages[i].title, member_packages_id: vm.packages[i].id, hours_dual_before: vm.packages[i].remaining_hours_dual, hours_dual_spent: vm.packages[i].remaining_hours_dual, hours_dual_remaining_after: 0, hours_solo_remaining_after: vm.packages[i].remaining_hours_solo, package_id: vm.packages[i].package_id});
                                plane_units = plane_units - vm.packages[i].remaining_hours_dual;

                            }

                        }

                    } else {
                        //then its solo
                        if(vm.packages[i].remaining_hours_solo && vm.packages[i].remaining_hours_solo > 0){
                             if(plane_units < vm.packages[i].remaining_hours_solo){

                                var rem = vm.packages[i].remaining_hours_solo - plane_units;
                                vm.package_removed.push({solo_dual: "solo", title: vm.packages[i].title, member_packages_id: vm.packages[i].id, hours_solo_before: vm.packages[i].remaining_hours_solo, hours_solo_spent: plane_units, hours_solo_remaining_after: rem, hours_dual_remaining_after: vm.packages[i].remaining_hours_dual, package_id: vm.packages[i].package_id });
                                plane_units = 0;

                                break;
                            } else {

                                vm.package_removed.push({solo_dual: "solo", title: vm.packages[i].title, member_packages_id: vm.packages[i].id, hours_solo_before: vm.packages[i].remaining_hours_solo, hours_solo_spent: vm.packages[i].remaining_hours_solo, hours_solo_remaining_after: 0, hours_dual_remaining_after: vm.packages[i].remaining_hours_dual, package_id: vm.packages[i].package_id });
                                plane_units = plane_units - vm.packages[i].remaining_hours_solo;
                                
                            }

                        }

                    }

                }

            }    

            //console.log("charge rate: ", vm.bookout.plane_charges.charge_rate_unit);
            //console.log("plane_units: ", plane_units);
            var plane_total = (vm.bookout.plane_charges.charge_rate_unit * plane_units);
            //console.log("plane_total", plane_total);



            //plane surchages::::
            var surcharge_units = 0;
            if(vm.bookout.plane_charges.surcharge_type == "flight" || vm.bookout.plane_charges.surcharge_type == "taxi"){
                //then the units relate to the entered numbers:
                surcharge_units = 1;
            } else if(vm.bookout.plane_charges.surcharge_type !== "none") {
                //then the units are based on the plane units
                surcharge_units = plane_units;
            }

            var surcharge_total = (vm.bookout.plane_charges.surcharge_fee * surcharge_units);


            //landings and touch and goes etc...
            if(vm.bookout.landings < 0){
                vm.bookout.landings = 1;
            }
            var landing_units = vm.bookout.landings | 0;
            var landings_total = (landing_units * vm.bookout.plane_charges.landing_fee);

            if(vm.bookout.tng < 0){
                vm.bookout.tng = 1;
            }
            var tg_units = vm.bookout.tng | 0;
            var tng_total = (tg_units * vm.bookout.plane_charges.touch_and_go_fee);

            var tuition_charge_type = "none";
            var tuition_price = 0;
            var tuition_total = 0;
            var tuition_units = 0;

            if(!vm.packages || vm.packages.length == 0 || plane_units > 0){


                //TUITION CHARGES
                
                if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id > 0 && vm.bookout.tuition_charges){

                    tuition_charge_type = vm.bookout.tuition_charges.charge_type;
                    tuition_price = vm.bookout.tuition_charges.price;

                    if(tuition_charge_type == "brakes"){
                        tuition_units = vm.flight_units.brakes_to_brakes;
                        tuition_charge_type = "brakes off to brakes on hours";
                    } else if(tuition_charge_type == "brakes_rounded"){
                        tuition_units = vm.flight_units.brakes_times_rounded;
                        tuition_charge_type = "rounded brakes off to brakes on hours";
                    } else if(tuition_charge_type == "plane"){
                        tuition_units = plane_units;//(vm.bookout.end_tacho - vm.bookout.start_tacho);
                        tuition_charge_type = "plane units";
                    } else if(tuition_charge_type == "session"){
                        tuition_units = 1;
                        tuition_charge_type = "session";
                    }

                    tuition_total = (tuition_units * tuition_price);

                }


            }

            var total_to_remove = 0;
            var receipts = [];
            //need to process the reductions due to the receipts...
            if(vm.lubricant_receipts && vm.lubricant_receipts.length > 0){
                for(var i = 0;i<vm.lubricant_receipts.length;i++){

                    if(vm.lubricant_receipts[i].reimbursement == 1){
                        receipts.push(vm.lubricant_receipts[i]);
                        total_to_remove = Number.parseFloat(Number.parseFloat(total_to_remove) + Number.parseFloat(vm.lubricant_receipts[i].reimbursed_amount));
                    }

                } 
            }
            

            // //console.log("CALC HERE", total_to_remove);






            var total = (plane_total + surcharge_total + landings_total + tng_total + tuition_total - total_to_remove);
            // //console.log("plane_total plane_total", plane_total);
            // //console.log("plane_total surcharge_total", surcharge_total);
            // //console.log("plane_total landings_total", landings_total);
            // //console.log("plane_total tng_total", tng_total);
            // //console.log("plane_total tuition_total", tuition_total);
            // //console.log("plane_total total_to_remove", total_to_remove);

            vm.invoice_totals = vm.previous_total + total;

            vm.send.amount = vm.invoice_totals * 100;

            vm.plane_charges = {
                plane_charge_type: vm.bookout.plane_charges.charge_type,
                plane_unit_price: vm.bookout.plane_charges.charge_rate_unit,
                plane_units: plane_units,
                plane_total: plane_total,
                surcharge_charge_type: vm.bookout.plane_charges.surcharge_type,
                surcharge_unit_price: vm.bookout.plane_charges.surcharge_fee,
                surcharge_units: surcharge_units,
                surcharge_total: surcharge_total,
                landing_units: landing_units,
                landing_unit_price: vm.bookout.plane_charges.landing_fee,
                landing_total: landings_total,
                tng_units: tg_units,
                tng_unit_price: vm.bookout.plane_charges.touch_and_go_fee,
                tng_total: tng_total,
                tuition_charge_type: tuition_charge_type,
                tuition_unit_price: tuition_price,
                tuition_units: tuition_units,
                tuition_total: tuition_total,
                receipts: receipts,
                total: total
            };

            //vm.bookout.tuition_charges


            vm.calculated_invoice = true;

        }

        vm.instructor_charges = []; 


        // vm.update_book_in_options = function(){
        //     vm.complete_flight = ( (vm.bookout.flight_type.title !== "Local" && vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) || vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) ? false : true;
        // }


        vm.complete_flight = false;
        vm.complete_this_flight = function(){



            if(vm.tacho_error_highlight){
                ToastService.highlightField('tacho_end');
                ToastService.error('Meter Error', 'You cannot complete a flight where the last meter reading is greater than the start meter reading!');
                return false;
            }

            if(vm.this_claim_was_instructional && (vm.bookout.instructor_id == 0 || vm.bookout.tuition_id == 0)){
                ToastService.highlightField('instructor_id');
                ToastService.warning('Missing Details', 'You need to add an instructor and tuition type if this flight was instructional.');
                return false;
            }

            if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id == 0){
                ToastService.highlightField('tuition_id');
                ToastService.warning('Tuition Required', 'Please select a tuition type for this flight.');
                return false;
            }

            if(isNaN(vm.invoice_totals)){
                ToastService.warning('Form Incomplete', 'Please ensure you have filled in the form above - the current total for this invoice cannot be calculated without this.');
                return false;
            }


            // var getShort = {club_id: vm.bookout.booking.club_id,
            //     user_id: vm.bookout.booking.user_id};

            // //console.log("PASSING", getShort);
            // let's fetch some information about the user

            var club_id_confirmed = (vm.bookout.booking && vm.bookout.booking.club_id > 0)? vm.bookout.booking.club_id : vm.bookout.club_id;
            var user_id_confirmed = (vm.bookout.booking && vm.bookout.booking.user_id > 0)? vm.bookout.booking.user_id : vm.bookout.user_id;

            MemberService.GetMandate(vm.bookout.payer_id, club_id_confirmed)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                           
                            if(data.success){
                                vm.info = data.info;
                            }

                        });

            vm.cards = [];

            //NEED TO UPDATE THIS!!!!!
           var send = {
               user_id: vm.bookout.payer_id,
               club_id: club_id_confirmed,
               membership_id: 1
           }
            PaymentService.GetMemberCards(send)
            .then(function (data) {

                //console.log(data);
                vm.cards = data.cards;
                vm.savedCards = data.cards;
                // vm.membership_now.cards = data.cards;
                // vm.membership_now.default_card = data.default_card;

            });



            console.log("CONFIRM BOOKING IS : ", vm.bookout.booking_id);

            vm.complete_flight = true;
        }





        var compile_invoice = function(){
            var items = [];
            // vm.plane_charges
            //add plane costs

            if(vm.package_used && vm.package_removed && vm.package_removed.length > 0){
                for(var i=0;i<vm.package_removed.length;i++){
                    var uuint = (vm.package_removed[i].hours_dual_spent > 0) ? vm.package_removed[i].hours_dual_spent : vm.package_removed[i].hours_solo_spent;
                    items.push({package_id: vm.package_removed[i].package_id, title: "Package: "+vm.package_removed[i].title, hours: uuint, hours_type: vm.package_removed[i].solo_dual, member_packages_id: vm.packages[i].id, unit_price: 0, total: 0, organise: 0});
                    
                }
            //items.push({title: "Plane "+vm.plane_charges.plane_charge_type+" Charge", unit: vm.plane_charges.plane_units, unit_price: vm.plane_charges.plane_unit_price, total: vm.plane_charges.plane_total, organise: 0});
            }

            items.push({title: "Aircraft "+vm.plane_charges.plane_charge_type+" Charge", unit: vm.plane_charges.plane_units, unit_price: vm.plane_charges.plane_unit_price, total: vm.plane_charges.plane_total, organise: 0});
            if(vm.plane_charges.surcharge_total > 0){
                items.push({title: "Surcharge per "+vm.plane_charges.surcharge_charge_type, unit: vm.plane_charges.surcharge_units, unit_price: vm.plane_charges.surcharge_unit_price, total: vm.plane_charges.surcharge_total, organise: 1});
            }
            if(vm.plane_charges.tuition_total > 0){
                items.push({title: "Tuition Charge - "+vm.bookout.tuition_required.title, unit: vm.plane_charges.tuition_units, unit_price: vm.plane_charges.tuition_unit_price, total: vm.plane_charges.tuition_total, organise: 2});
            }
            if(vm.plane_charges.landing_total > 0){
                items.push({title: "Home Landing", unit: vm.plane_charges.landing_units, unit_price: vm.plane_charges.landing_unit_price, total: vm.plane_charges.landing_total, organise: 4});
            }
            if(vm.plane_charges.tng_total > 0){
                items.push({title: "Home Touch and Go", unit: vm.plane_charges.tng_units, unit_price: vm.plane_charges.tng_unit_price, total: vm.plane_charges.tng_total, organise: 3});
            }
           

            //RENTAL ITEMS !? --> make it free for now...

            for(var i=0;i<vm.plane_charges.receipts.length;i++){
                var org = parseInt(5 + i)
                items.push({title: "Reimbursement - "+vm.plane_charges.receipts[i].item, unit: vm.plane_charges.receipts[i].quantity, unit_price: (vm.plane_charges.receipts[i].price / vm.plane_charges.receipts[i].quantity), total: -vm.plane_charges.receipts[i].price, organise: org});
            }

            return items;
        }



        vm.get_package_html = function(pack_obj){
            var used_on = "";
            for(var i=0;i<pack_obj.aircraft.length;i++){
                used_on = used_on + " " + pack_obj.aircraft[i].registration +" ("+ pack_obj.aircraft[i].plane_type +") <br />";
            }
            var text = "";
            if(pack_obj.validity == 0){
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package does not expire <br /> To be used on:<br />";
            } else {
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package expires on: "+ moment(pack_obj.created_at).add(pack_obj.validity, "days").format("D MMM Y") +" <br /> To be used on:<br />";
            }
    
            return text+used_on;

        }


        vm.convert_decimal_to_hours = function(number){
            
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

            // Concate hours and minutes
            var time = sign + hour + ':' + minute;

            return time;

        }




        //complete the booking back in
        vm.book_in_flight = function(where_to = "home", payment = "none", paymentIntent = ""){
            vm.show_loading = true;

            //need to make sure that this is not the instructor paying for the flight..... 
            //If the instructor / management fills in these details, we want to make sure that the actual user gets charged.
            // console.log("vm.this_pls_id_raw", vm.this_pls_id_raw);
            // console.log("vm.bookout.booking_id 1 - ", vm.bookout.booking_id);



            // //to generate the payment side::::
            // vm.plane_charges
            // vm.payment_card 
            // vm.user.id


            // //defects already reported
            // //receipts already reported

            // //need to check / update::: 
            // detail_type_id
            // from_airport_id
            // to_airport_id
            // //if from_airport_id == to_airport_id ==> detail_type_id = 1 (local)


            // pic_id
            // tacho_start
            // tacho_end
            // brakes_off
            // brakes_on
            // //need to total the added receipts's quantities
            // oil_uplift_litres
            // fuel_uplift_litres

            // full_stop_landings
            // touch_and_go 

            // booked_in = 1
            // flight_date = today


            // dual_flight - mention
            // var dual_flight = (vm.bookout.pic_id !== vm.bookout.user_id)? 1 : 0;


            // var from_airfield = (vm.bookout.)

            

            //
            var flag_flight = false;

            //need to check that the start tacho has not been altered ==> otherwise we need to flag this....
            var oil = 0;
            var fuel = 0;
            for(var i=0;i<vm.lubricant_receipts.length;i++){
                if(vm.lubricant_receipts[i].item == "Fuel"){
                    fuel = Number.parseFloat(fuel) + Number.parseFloat(vm.lubricant_receipts[i].quantity);
                } else {
                    oil = Number.parseFloat(oil) + Number.parseFloat(vm.lubricant_receipts[i].quantity);
                }
            }


            //landings
            var total_landings = parseInt(parseInt(vm.bookout.landings) + parseInt(vm.bookout.tng) + parseInt(vm.bookout.remote_landings));
            if(total_landings < 1){
                if(confirm("It looks as though you didn't land, is that correct?")){
                    //console.log("how does a plane go for a flight but doesn't land anywhere?");
                    flag_flight = true;
                    //repositioning on airfield, maybe?
                } else {
                    return false;
                }
            }

            //only if we charge by tacho - surely?
            //if start tacho was not start tacho....
            if(vm.bookout.plane_charges.charge_type == "tacho" || vm.bookout.plane_charges.charge_type == "hobbs"){
                if(Number.parseFloat(vm.start_tacho_orig) !== Number.parseFloat(vm.bookout.start_tacho)){
                   if(confirm("It looks as though your start meter reading ["+vm.bookout.start_tacho+"] is not the same as the previous flight's last meter reading of "+vm.start_tacho_orig+" - is that correct?")){
                        //console.log("Someone seems to have a different tacho reading... need to flag this to management to check...");
                        flag_flight = true;
                        //repositioning on airfield, maybe?
                    } else {
                        return false;
                    } 
                }
            }




            // WHEN A USER ENTERS A NEW AIRFIELD / STRIP INTO THE SYSTEM ::: 
            // the vm.bookout.from_airfield.id = 0 
            // OR
            // vm.bookout.to_airfield.id = 0
            // we need a switchcase to add the airport details in the send if a number is not already in there
            // then if the ID = 0, and the new_from_airport is filled in, we add it to the DB before we add the logbook entry
            // then we flag that entry as "NEW AIRFIELD --> PLEASE VERIFY THE ENTRY for an admin to double check"
            // should be straight forward entry 

            // then once this is complete - we need to look at the problem with empty brakes time / estimated flight time
            // then we need to look at the logbooks --> separate the Engine, Prop, Airframe logbooks, and keep a separate tab on there


            var is_dual_flight = 0;
            if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id > 0){
                is_dual_flight = 1;
            }

            if(is_dual_flight == 0 && vm.put_id > 0 && vm.pic_id !== vm.put_id){
                is_dual_flight = 1;
            } else if(is_dual_flight == 0 && vm.put_id > 0){
                is_dual_flight = 1;
            }

            var authorised_solo = 0;
            var authorised_by = 0;
            if(vm.this_was_supervised_solo){
                authorised_solo = 1;
                if(vm.bookout.instructor && vm.bookout.instructor.user_id){
                    authorised_by = vm.bookout.instructor.user_id;
                } else if(vm.bookout.instructor_id > 0){
                    authorised_by = vm.bookout.instructor_id;
                }
            }

            //must be a claimed flight
            var bookout_user_id = vm.bookout.user_id;
            if(!bookout_user_id || bookout_user_id == 0){
                bookout_user_id = vm.bookout.payer_id;
            }

            var bookout_instructor_id = vm.bookout.instructor_id;
            if(!bookout_instructor_id || bookout_instructor_id == 0 && is_dual_flight == 1 && vm.bookout.pic_id > 0){
                bookout_instructor_id = vm.bookout.pic_id;
            }



            var put_id = vm.bookout.put_id;
            if(put_id == 0 && is_dual_flight == 1){
                put_id = vm.bookout.payer_id;
            }

            var pic_id = vm.bookout.pic_id;
            if(pic_id == 0 && is_dual_flight == 0){
                pic_id = vm.bookout.payer_id;
            }
            if(pic_id == 0 && vm.bookout.payer_id > 0 && bookout_instructor_id == 0){
                pic_id = vm.bookout.payer_id;
            }

            var to_airport_id = (vm.bookout.flight_type.id == 1)? vm.bookout.from_airfield.id : vm.bookout.to_airfield.id;

            if(is_dual_flight == 1 && bookout_instructor_id < 1){
                //instructor wasn't set above...
                console.log("did we forget to set the FI?");
            }

            var pay_with = {method: {}, method_name: ""};

            // if(payment == '' || payment == 'none'){
            //     // alert('unset payment method');
            // } else if(payment == 'cc'){
            //     // alert('pay by card');
            //     pay_with.method = vm.payment_card;
            //     pay_with.method_name = "stripe";
            // } else if (payment == 'dd'){
            //     // alert('pay by direct debit');
            //     pay_with.method = vm.info;
            //     pay_with.method_name = "gocardless";
            // } else if (payment == 'cm'){
            //     // alert('pay by card machine');
            //     pay_with.method_name = "cardmachine";
            // } else {
            //     alert('not sure on payment method');
            // }


           

            // console.log("PAY WITH : ", pay_with);
           // return false;


            var obj = {
                user_id: bookout_user_id,
                club_id: vm.bookout.club_id,
                plane_id: vm.bookout.plane_id,
                instructor_id: bookout_instructor_id,
                booking_id: vm.bookout.booking_id,
                payer_id: vm.bookout.payer_id,
                plane_log_sheet: {
                    dual_flight: is_dual_flight,
                    authorised_solo: authorised_solo,
                    authorised_by: authorised_by,
                    tuition_id: vm.bookout.tuition_id,
                    course_id: vm.bookout.course_id,
                    club_id: vm.bookout.club_id,
                    plane_id: vm.bookout.plane_id,
                    pic_id: pic_id,
                    put_id: put_id,
                    user_id: bookout_user_id,
                    payer_id: vm.bookout.payer_id,
                    detail_type_id: vm.bookout.flight_type.id,
                    from_airport_id: vm.bookout.from_airfield.id,
                    to_airport_id: to_airport_id,
                    tacho_start: vm.bookout.start_tacho,
                    tacho_end: vm.bookout.end_tacho,
                    brakes_off: vm.bookout.brakes_off.time,
                    brakes_on: vm.bookout.brakes_on.time,
                    oil_uplift_litres: oil,
                    fuel_uplift_litres: fuel,
                    full_stop_landings: vm.bookout.landings,
                    touch_and_go: vm.bookout.tng,
                    remote_landings: vm.bookout.remote_landings,
                    booked_in: 1,
                    original_id: vm.this_pls_id_raw.id,
                    booked_in_by: vm.user.id //,
                    // authorised_solo: (vm.bookout.authorised_solo)? true : false
                },
                invoice: compile_invoice(),
                paying_now: vm.complete_flight,
                pay_with: pay_with,
                free_flight: vm.free_flight,
                paymentIntent: paymentIntent,
                // card_id: (vm.complete_flight && !vm.free_flight && !vm.can_authorise && vm.payment_card.id > 0)? vm.payment_card.id : 0,
                flag_flight: flag_flight
            };



            if(payment == "new-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "saved-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "direct-debit"){
                //nothing to add - it should just work...
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "card-machine"){
                //nothing here at the moment?
                obj.paymentIntent = paymentIntent;
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "free"){
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            }

            //otherwise leave default




            if(to_airport_id == 0){
                obj.plane_log_sheet.new_to_airport = vm.bookout.to_airfield;
                obj.plane_log_sheet.new_to_airport.title = obj.plane_log_sheet.new_to_airport.title.replace("NOT LISTED : ", "");
            }

            if(vm.bookout.from_airfield.id == 0){
                obj.plane_log_sheet.new_from_airport = vm.bookout.from_airfield;
                obj.plane_log_sheet.new_from_airport.title = obj.plane_log_sheet.new_from_airport.title.replace("NOT LISTED : ", "");
            }    

            


            //we need to add some items if this links to a FOX AVIONIX FLIGHT LOG
            obj.plane_log_sheet.fox_log_id = vm.bookout.fox_log_id;
            obj.plane_log_sheet.fox_claimed = 1;

            obj.plane_log_sheet.takeoff_time = vm.bookout.takeoff_time;
            obj.plane_log_sheet.landing_time = vm.bookout.landing_time;

            if(vm.has_used_claimed_flight && vm.claimed_flight && vm.claimed_flight.takeoff_time && vm.claimed_flight.takeoff_time !== ""){
                obj.plane_log_sheet.takeoff_time = vm.claimed_flight.takeoff_time;
                obj.plane_log_sheet.landing_time = vm.claimed_flight.landing_time;

                obj.plane_log_sheet.landing_rounded = vm.claimed_flight.landing_rounded;
                obj.plane_log_sheet.takeoff_rounded = vm.claimed_flight.takeoff_rounded;
            }
            // console.log("TAKEOFF TIME 1 : ", obj.plane_log_sheet.takeoff_time);
            // console.log("TAKEOFF TIME 1 : ", vm.bookout.takeoff_time);
            // console.log("CLAIMED: ", vm.claimed_flight);

            
            
            // console.log("TAKEOFF TIME 2 : ", obj.plane_log_sheet.takeoff_time);

            obj.plane_log_sheet.brakes_time = vm.flight_units.brakes_to_brakes;
            obj.plane_log_sheet.airborne_time = vm.flight_units.airborne_times;


            //THIS IS THE KEY HERE delete this one once selected / complete
            obj.plane_log_sheet.claimed_fox_plane_log_sheet_id = vm.claimed_flight.id;

            if(vm.split_flight && vm.split_one){
                obj.plane_log_sheet.brakes_off_rounded = vm.split_one.brakes_off_rounded;
                obj.plane_log_sheet.brakes_on_rounded = vm.split_one.brakes_on_rounded;
                obj.plane_log_sheet.takeoff_time = vm.split_one.takeoff_time;
                obj.plane_log_sheet.landing_time = vm.split_one.landing_time;
                obj.plane_log_sheet.takeoff_rounded = vm.split_one.takeoff_rounded;
                obj.plane_log_sheet.landing_rounded = vm.split_one.landing_rounded;
                obj.plane_log_sheet.airborne_rounded = vm.split_one.airborne_rounded;
                obj.plane_log_sheet.brakes_times_rounded = vm.split_one.brakes_times_rounded;
                obj.plane_log_sheet.brakes_time = vm.split_one.brakes_time;
                obj.plane_log_sheet.flight_time = vm.split_one.flight_time;
                obj.plane_log_sheet.airborne_time = vm.split_one.airborne_time;
                obj.plane_log_sheet.flight_time = vm.split_one.flight_time;
            }

            if(vm.split_flight == 1 && vm.split_two && vm.split_two !== ""){

                //if there was a split - this is where we sort out the magic to go with it!
                console.log("vm.bookout.booking_id ", vm.bookout.booking_id);
                console.log("vm.split_two.booking ", vm.split_two.booking);
                delete vm.split_two.booking;
                delete vm.split_two.passengers;
                delete vm.split_two.from_airport;
                delete vm.split_two.to_airport;
                delete vm.split_two.plane_charges;
                delete vm.split_two.tuition_charges;
                delete vm.split_two.tuition_required;
                delete vm.split_two.pilot_in_command;
                delete vm.split_two.home_airport_id;
                delete vm.split_two.aircraft;
                delete vm.split_two.stops;
                delete vm.split_two.user;
                delete vm.split_two.last_tacho;
                delete vm.split_two.instructor;
                delete vm.split_two.id;

                // if there was an update of the destination on the book-in
                // and the flight was split - then they must start from that point 
                //on the next flight (hopefully anyway!!)

                if(to_airport_id > 0 && to_airport_id !== vm.split_two.from_airport_id){
                    vm.split_two.from_airport_id = to_airport_id;
                }
                //we didn't de-construct this - hence why this is not needed.
                // vm.split_two.brakes_on = vm.split_two.brakes_on.time;
                // vm.split_two.brakes_off = vm.split_two.brakes_off.time;

                if(vm.split_two && vm.split_two.brakes_on && vm.split_two.brakes_on.time){
                    vm.split_two.brakes_on = vm.split_two.brakes_on.time;
                }
                if(vm.split_two && vm.split_two.brakes_off && vm.split_two.brakes_off.time){
                    vm.split_two.brakes_off = vm.split_two.brakes_off.time;
                }
                if(vm.split_two){
                    vm.split_two.is_split_flight = 1;
                }

                if(vm.split_two && obj.plane_log_sheet.booking_id && obj.plane_log_sheet.booking_id > 0){
                    vm.split_two.booking_id = obj.plane_log_sheet.booking_id;
                }
               

                obj.plane_log_sheet.split_two = vm.split_two;

                obj.plane_log_sheet.is_split_flight = 1;

            }
            
           

            //IF THIS IS THE COMPLETION OF THE SPLIT FLIGHTS
            if(vm.is_split_flight && vm.is_split_flight == 1 && vm.split_flight == 0){
                //chances are this is when it is complete??
                //vm.is_split_complete = 1;
                obj.plane_log_sheet.is_split_complete = 1;

            }

            // console.log("is_split_flight : ", vm.is_split_flight);
            // console.log("split_flight : ", vm.split_flight);
            // console.log("obj pls ", obj.plane_log_sheet);
            // return false;


            if(obj && obj.plane_log_sheet && obj.plane_log_sheet.takeoff_time && obj.plane_log_sheet.takeoff_time.time && obj.plane_log_sheet.takeoff_time.time !== ""){
                obj.plane_log_sheet.takeoff_time = obj.plane_log_sheet.takeoff_time.time;
            }

            if(obj && obj.plane_log_sheet && obj.plane_log_sheet.landing_time && obj.plane_log_sheet.landing_time.time && obj.plane_log_sheet.landing_time.time !== ""){
                obj.plane_log_sheet.landing_time = obj.plane_log_sheet.landing_time.time;
            }
            

             // console.log("TO BE SENDING : ", obj);
             // console.log("where_to : ", where_to);
             // console.log("TO BE SENDING : ", obj);

            // console.log(obj);
            // return false;

            //return false;
            //vm.bookout.id is actually a plane_log_sheet_id ??? 

            BookoutService.BookInFlight(vm.bookout.id, obj)
            .then(function(data){
                ////console.log("SENT - ", data);

                vm.after_where_to = where_to;
                vm.after_data = data;
                

                //STOPPPPP
                            //return false;
                //vm.show_loading = false;
                
                if(data.success){
                    console.log("paymentID", vm.paymentID);
                    if(data.paymentID){
                        vm.payment_id = data.paymentID;
                        vm.paymentID = data.paymentID;
                    }

                    if(pay_with.method_name == "cardmachine"){
                        console.log("paymentID 1", vm.paymentID);
                        console.log("paymentID 2", data.paymentID);

                        vm.show_cardmachine = true;
                      
                        poll_check_payment(data.paymentID, 30, function(result) {
                            if (result) {
                                //alert("Payment confirmed!");
                                vm.stop_polling = true;
                                 vm.show_loading = false;
                                after_success_bookin(where_to, data);
                            } else {
                                //alert("Payment not confirmed - please try again");
                                 vm.show_loading = false;
                            }
                        });
                        console.log("check_payment ", check_payment);
                       


                    } else {
                         vm.show_loading = false;
                        vm.stop_polling = true;
                        after_success_bookin(where_to, data);
                    }

                
                } else {

                    if(pay_with.method_name == "stripe" && data.card_processor){
                        //we need to show the 3DS secondary auth
                        // alert("Your card processor requires authentication");
                        console.log("BEFORE STRIPE = ", data);

                        var stripe = Stripe(EnvConfig.getStripeKey());
                        stripe.confirmCardPayment(
                          data.client_secret,
                          {
                            payment_method: data.payment_method,
                            return_url: data.card_url.return_url
                          },
                          // Disable the default next action handling.
                          // {handleActions: false}
                        ).then(function(result) {
                          // Handle result.error or result.paymentIntent
                          // More details in Step 2.
                          console.log(result);
                         
                          if(result.error) {
                            console.error(result.error);
                            if(result.error.code == "payment_intent_authentication_failure"){
                                //alert("You have failed to pass your card issuer's authentication - please try again or pay with another payment method.");
                                vm.show_loading = false;
                                after_success_bookin(where_to, data);
                            }
                          } else if(result.paymentIntent.status === 'succeeded') {
                            console.log('Payment successful!');
                            //we need to let the server know the payment was successful so it can be entered into the transaction list
                            BookoutService.CheckPayment(data.paymentID)
                                .then(function(data){
                                    if(data.success){
                                       
                                        vm.show_loading = false;
                                        after_success_bookin(where_to, data);
                                        
                                    } else {
                                       // alert("We encountered an error - this invoice will be visible in your invoices for completion");
                                        console.log("NOTHING SENT?");
                                        vm.show_loading = false;
                                    }
                                });

                            

                          } else {
                            console.log("not sure what happened");
                             vm.show_loading = false;
                          }


                        });


                    } else if(data.error){

                        //there was an error with the link to the card machine...
                        ToastService.error('Card Machine Error', 'There was an error connecting to the card machine - please ensure that the card machine is ON and connected to the internet.');
                         vm.show_loading = false;
                        vm.show_cardmachine = true;

                    } else {
                        ToastService.error('Error', 'An error occurred: ' + data.message);
                         vm.show_loading = false;
                    }

                    // //console.log(data);
                }
            });

        }

        vm.close_machine_popup = function(){

            //clear the card machine and close the popup??

            //at this point the flight probably has already been booked back in... lets consider how to give options for payment
             BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                if(data.success){
                    console.log("machine should be clear now?", data);
                    vm.show_cardmachine = false;
                    vm.show_after_bookedin = true;

                } else {
                    console.log("No success on card machine clear");
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_cardmachine = false;
                    vm.show_after_bookedin = true;
                }
            });



            // vm.show_cardmachine = false;
            // vm.show_after_bookedin = true;

        }

        vm.cancel_machine = function(){

            //cancel the payment request?
            BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                if(data.success){
                    console.log("machine should be clear now?", data);
                    vm.show_cardmachine = false;
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_after_bookedin = true;
                    vm.stop_polling = true;

                } else {
                    console.log("No success on card machine clear");
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_after_bookedin = true;

                }
            });



        }

        vm.close_bookedin = function(){

            BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                 //once cleared - we continue?
                 console.log("regardless of clear - should now be cleared?");
                 vm.show_cardmachine = false;
                 vm.show_after_bookedin = false;
                 vm.stop_polling = true;
                 after_success_bookin(vm.after_where_to, vm.after_data);
            });

        }


        vm.reset_card_machine = function(){

            console.log("retry", vm.payment_id);
            //try to send the request a second time to the machine?
             BookoutService.RetryPaymentMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                console.log(data);
                if(data.success){
                    ToastService.success('Payment Sent', 'The card machine should hopefully be displaying the payment now');
                    //create new poll??
                    vm.stop_polling = false;
                    poll_check_payment(vm.payment_id, 30, function(result) {
                        if (result) {
                            ToastService.success('Payment Confirmed', 'Payment confirmed!');
                            vm.stop_polling = true;
                            after_success_bookin(vm.after_where_to, vm.after_data);
                        } else {
                            ToastService.error('Payment Failed', 'Payment not confirmed - please try again');
                        }
                    });
                } else {
                    if(data.success == false && data.message == "The payment has already been successfully made."){
                        vm.stop_polling = true;
                        after_success_bookin(vm.after_where_to, vm.after_data);
                    }
                    ToastService.error('Payment Error', data.message);
                }

            });


            vm.show_cardmachine = true;

        }

        function poll_check_payment(id, maxAttempts, finalCallback) {
            var attempts = 0;

                function attempt() {
                    check_payment(id, function(success) {
                        attempts++;
                        if (success) {
                            console.log("Payment confirmed!");
                            finalCallback(true);
                        } else if (attempts >= maxAttempts) {
                            console.log("Max attempts reached, giving up.");
                            finalCallback(false);
                        } else if (vm.stop_polling) {
                            console.log("called to stop polling");
                            finalCallback(false);
                            return;
                        } else {
                            console.log("Retrying in 10000 ms...");
                            setTimeout(attempt, 10000);
                        }
                    });
                }

                attempt(); // Start polling
        }

        function get_update_on_cardmachine(payment_id, retry, limit, callback2){
            if(retry <= limit){

                check_payment(payment_id, function(result) {
                    if (result) {
                        // do something if true
                        console.log("RESPONSE FROM CHECK PAYMENT IS TRUE");
                        callback2(true);//{success: true, message: "payment checked & done"};
                    } else {
                        // do something if false
                         console.log("delay and try again?");
                    
                        setTimeout(() => {
                          console.log("Delayed for 5 second.", payment_id);
                          console.log("Delayed for 5 second.", vm.payment_id);
                          retry++;
                          callback2(get_update_on_cardmachine(payment_id, retry, limit, callback));
                        }, 10000);
                    }
                });

                // var status_card = check_payment(payment_id);
                // console.log("STATUS HERE:", status_card);
                // if(status_card){
                //     console.log("RESPONSE FROM CHECK PAYMENT IS TRUE");
                //     return true;//{success: true, message: "payment checked & done"};
                // } else {
                //     console.log("delay and try again?");
                    
                //     setTimeout(() => {
                //       console.log("Delayed for 5 second.", payment_id);
                //       console.log("Delayed for 5 second.", vm.payment_id);
                //       retry++;
                //       return get_update_on_cardmachine(payment_id, retry, limit);
                //     }, 10000);
                // }
            } else {
                console.log("over limit?");
                callback2(false);// false;//{success: false, message: "too many attempts"};
            }
        }

        function check_payment(id, callback){

            BookoutService.CheckPayment(id)
            .then(function(data){
                if(data.success){
                    console.log("check payment", data);
                    if(data.status){
                        console.log("status = true");
                         callback(true);
                    } else {
                        console.log("status = false");
                         callback(false);
                    }
                    
                } else {
                        console.log("NOTHING SENT?");
                         callback(false);
                }
            });

           // return false;

        }



        function after_success_bookin(where_to, data){
                if(where_to == "home"){
                        $state.go('dashboard.my_account', {}, { reload: true });
                    } else if(where_to == "debrief") {
                        console.log("DEBRIEF!!");
                        //if((vm.user.id == vm.bookout.instructor_id) && (vm.bookout.booking_id > 0 || vm.bookout.course_id > 0)){
                        if((vm.user.id == vm.bookout.instructor_id || (vm.user.id == vm.bookout.pic_id && vm.bookout.put_id > 0)) && (vm.bookout.booking_id > 0 || vm.bookout.course_id > 0) ){
                          console.log("DEBRIEF 2!!");

                          // /debriefing/:booking_id/:plane_log_sheet_id
                          //:split_next_id/:split_booking_id
                          /*
                            "plane_log_sheet_id" => $split_two_id, --> data.split.plane_log_sheet_id
                            "booking_id" => $booking_id --> data.split.booking_id
                          */
                          //
                              var booking_id = 0;
                              if(vm.bookout.booking_id < 1){
                                  booking_id = data.split.booking_id;
                              } else {
                                  booking_id = vm.bookout.booking_id;
                              }

                            if(data.split){
                              console.log("DEBRIEF WITH DATA RESPONSE");
                              console.log(data);
                              // return false;

                                $state.go('dashboard.manage_user.debriefing', { booking_id: booking_id, plane_log_sheet_id: vm.bookout.id, split_next_id: data.split.plane_log_sheet_id, split_booking_id: data.split.booking_id }, { reload: true });
                            } else {
                              console.log("DEBRIEF without DATA RESPONSE");
                              // return false;
                                $state.go('dashboard.manage_user.debriefing', { booking_id: booking_id, plane_log_sheet_id: vm.bookout.id, split_next_id: 0, split_booking_id: 0 }, { reload: true });
                            }

                        } else {
                          console.log("DEBRIEF 3!!");
                          // return false;
                            $state.go('dashboard.my_account', {}, { reload: true });
                        }                        

                    } else if(where_to == "split") {

                        console.log("SPLIT HERE");
                        // //console.log("BOOKING _ID "+vm.bookout.booking_id);
                        //originally here --> but we don't want this...
                       // $state.go('dashboard.my_account.bookout_with_booking', {booking_id: vm.bookout.booking_id, claim_id: vm.claim_id, split: vm.split_two}, {reload: true });

                        var booking_id = 0;
                        if(vm.bookout.booking_id < 1){
                            booking_id = data.split.booking_id;
                        } else {
                            booking_id = vm.bookout.booking_id;
                        }

                       if((vm.user.id == vm.bookout.instructor_id || (vm.user.id == vm.bookout.pic_id && vm.bookout.put_id > 0)) && (vm.bookout.booking_id > 0 || vm.bookout.course_id > 0)){
                              console.log("SPLIT AND DEBRIEF???");
                          // /debriefing/:booking_id/:plane_log_sheet_id
                              // console.log("SPLIT and success in data obj");
                              // // split_flight_id: data.split.plane_log_sheet_id, 
                              // // split_flight_booking_id: data.split.booking_id, 
                              // // split: vm.split_two
                              // console.log("data.split.plane_log_sheet_id : ", data.split.plane_log_sheet_id);
                              // console.log("data.split.booking_id : ", data.split.booking_id);
                              // console.log("split : ", vm.split_two);
                              //  return false;
                              $state.go('dashboard.manage_user.debriefing', { booking_id: data.split.booking_id, plane_log_sheet_id: vm.bookout.id, split_next_id: data.split.plane_log_sheet_id, split_booking_id: data.split.booking_id }, { reload: true });

                            // $state.go('dashboard.manage_user.debriefing', {booking_id: vm.bookout.booking_id, plane_log_sheet_id: vm.bookout.id, split_flight_id: data.split.plane_log_sheet_id, split_flight_booking_id: data.split.booking_id, split: vm.split_two }, { reload: true });
                        } else {
                              // console.log("SPLIT back to account");
                              //  return false;
                            //$state.go('dashboard.my_account', {}, { reload: true });

                            //IF THIS PERSON IS BOOKING IT IN - I THINK THEY SHOULD CONTINUE THIS TO THE END....
                            $state.go('dashboard.my_account.book_in', {id: data.split.plane_log_sheet_id}, {reload: true });

                        }


                    } else {
                       $state.go('dashboard.my_account.bookout_with_booking', {booking_id: vm.bookout.booking_id}, {reload: true });
                    }
        }

        function preselect_course_and_tuition(){

            console.log("PRESELECT TUITION NOW");


            if(vm.club_courses.length == 1){
                //preset it??
                //console.log("length is 1", vm.bookout.course_id);
                if(!vm.bookout.course_id || vm.bookout.course_id == 0){
                   vm.bookout.course_id = vm.club_courses[0].id;
                   vm.bookout.course = vm.club_courses[0];
                    //console.log("HERE?", vm.bookout.course);
                }
            }
            console.log(vm.bookout.course_id);
            console.log(vm.club_courses);
            if(vm.bookout.course_id > 0){
                var selected_course = vm.club_courses.find(item => item.id === vm.bookout.course_id);
                vm.bookout.course = selected_course;
            }

            if(vm.instructor_charges.length == 1){
                //var selected_tuition = vm.instructor_charges.find(item => item.id === vm.bookout.instruction_required_id);
                vm.bookout.tuition_required = vm.instructor_charges[0];
            }

            vm.update_tuition_charges();

        }


        vm.this_claim_was_instructional = false;
        vm.this_was_supervised_solo = false;
        vm.start_tacho_orig;
        vm.send = {};

        function process_bookout_to_bookin(booking){

            // console.log(booking);
            //vm.bookout is where we want to fill the content....
            vm.bookout.booking_id = booking.booking_id;
            vm.bookout.club_id = booking.club_id;
            vm.bookout.user_id = booking.user_id;
            vm.bookout.plane = booking.plane;
            vm.club_id = booking.club_id;
            vm.is_split_flight = booking.is_split_flight;
            // vm.bookout.return = new Date(booking.end);
            // vm.bookout.booking_start = new Date(booking.start);
            
            // vm.this_pls_id_raw = vm.bookout.id;
            //vm.this_pls_id_raw = Object.assign({}, booking);

            vm.send = {
                club_id: vm.bookout.club_id,
                user_id: vm.user.id
                // ,
                // plane_log_sheet_id: booking.id
            }
            // console.log("booking", booking);
            // console.log("booking_id", booking.booking_id);

            /*
            VM.SEND --> TO THE PAYMENT MODAL
                if invoice --> remove booking_id add invoice_id 
                if no invoice / booking --> remove both and add amount * 100
                ie: amount: vm.invoice_totals * 100,
                user must be the user for that invoice / PAYER ID --> careful on admin functions
            */



             PlaneService.GetCurrencies(vm.club_id)
             .then(function(data){
                        vm.currencies = data.currencies;   
                        vm.club_currency = data.club_currency;

                        vm.receipt.currency = $.grep(vm.currencies, function(e){ 
                            return e.iso_code == vm.club_currency; 
                        })[0];;

                });


            



             //&& vm.bookout.user_id !== vm.user.id --> if no bookout was done, this wont work
             if(((vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ) ){
                // //console.log("NOT BOOKING FOR SELF?");
                vm.can_authorise = true;

            }



            vm.invoices = [];
            vm.previous_total = 0;

            vm.free_flight = false;

            // //console.log("actual stuff = ", booking);
            //there should also be a PILOT / OWNER -> NO MONEY REQUIRED bit
            if(booking.booking && booking.booking.maintenance_flight == 1){
                // //console.log("FREE FLIGHT WOOO");
                vm.free_flight = true;
                //vm.plane_charges.total = 0;
            }



                //IF THIS IS NOT SPLIT FLIGHT??? OTHERWISE... DISASTER?
                //need to check functionality before release!!
                if(vm.is_split_flight == 1){
                    //console.log("IS SPLIT?");

                    
                    InvoicesService.GetAllByBooking(booking.booking_id)
                    .then(function (data) {
                            //console.log("invoice data is : ", data);
                            if(data.success){
                                //console.log("data", data.invoices);
                                // vm.previous_invoice = data.invoice;
                                vm.previous_invoice = data.invoices;

                                // data.invoices.forEach((invoice) => function(){
                                //     console.log("each invoice", invoice);
                                //     invoice.flights.forEach((flight) => function(){
                                //         console.log("each flight", flight);
                                //         vm.invoices.push(flight);
                                //         vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(flight.total));
                                //     });
                                // });
                                for(var i=0;i<data.invoices.length;i++){
                                     Object.keys(data.invoices[i].flights).forEach(function(key) {
                                        var flight = data.invoices[i].flights[key];
                                        //console.log(key, flight);
                                        vm.invoices.push(flight);
                                        vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(flight.total));
                                    });



                                }

                               

                                // for (var key in data.invoices.flights) {
                                //     console.log("KEY ", key);
                                //     vm.invoices.push(data.invoices.flights[key]);
                                //     vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(data.invoices.flights[key]["total"]));
                                //     // for(var i=0;i<data.invoice.flights[key].length;i++){
                                //     // }
                                // }


                                
                                
                                // console.log("invoices", vm.invoices);
                                // //console.log("FLIGHTS TOTAL", vm.previous_total);
                                // vm.invoices = data.invoice.flights;
                            } else {
                                // //console.log("no invoices have yet been issued for this flight");
                            }


                        });

                } else {
                    console.log("NOT SPLIT?");


                }

            


            PlaneService.GetOpenIssues(booking.plane_id)
            .then(function (data) {
                    ////console.log("data is : ", data);
                   vm.reported_defects = data;
                });

              PlaneService.GetAllSheetReceipts(vm.bookout.id)
                .then(function (data) {
                    ////console.log("data is : ", data);
                    vm.lubricant_receipts = data;
                });


                InstructorCharges.GetByClubId(booking.club_id)
                .then(function(data){
                    vm.instructor_charges = data.items;  
                });

                


                //vm.club_courses = data.items




            //we need to update the PICS now...

           
            //we need to know where the plane was last booked-in at 
            //(ie: if last flight bookout was completed - where the plane landed at last)
            //if the last booking was not yet completed, then we can assume that this last flight was returning to base.
            if((booking && booking.id > 0) || (vm.try_split)){
                console.log("PIC ID: ", booking.pic_id);
                if(vm.pics && booking.pic_id){
                    var selected_pic = vm.pics.find(item => item.user_id === booking.pic_id);
                    console.log("selected_pic : ", selected_pic);
                    vm.bookout.pic = selected_pic;
                }
                


                // //console.log("booking.detail_type_id", booking.detail_type_id);

                var selected_detail_type = vm.flight_types.find(item => item.id === booking.detail_type_id);
                vm.bookout.flight_type = selected_detail_type;

                if(booking.instructor && booking.instructor !== "" && booking.instructor.user_id == booking.pic_id){
                    vm.bookout.put = vm.bookout.user;
                }


                if(vm.pics && booking.put_id){
                    var selected_put = vm.pics.find(item => item.user_id === booking.put_id);
                    console.log("selected_put : ", selected_put);
                    vm.bookout.put = selected_put;
                }

                // if(booking.instructor && booking.instructor.user_id > 0 && booking.pic_id == booking.user.id){

                // }

                vm.bookout.authorised_solo = (booking.authorised_solo == 1)? true : false;


                vm.bookout.from_airfield = booking.from_airport;
                vm.bookout.to_airfield = booking.to_airport;
                
                if(booking.course_id > 0){
                    vm.bookout.course_id = booking.course_id;
                } else if(booking.booking && booking.booking.course_id && booking.booking.course_id > 0){
                    vm.bookout.course_id = booking.booking.course_id;
                }

                vm.bookout.start_tacho = Number.parseFloat(booking.last_tacho);
                
                vm.start_tacho_orig = booking.last_tacho;



               
                 //this is where we sort out some of the last bits....

                //var instructor = vm.pics.find(item => item.user_id === booking.instructor.id);
                vm.bookout.instructor = booking.instructor;
                var selected_pic = vm.pics.find(item => item.user_id === booking.pic_id);
                vm.bookout.pic = selected_pic;


            }





            // if(booking.instructor && booking.instructor !== "" && booking.instructor.id > 0){
            //     // then we need to set the PIC as the instructor
            //     //select from pics where user_id = booking.user_id;
            //     var selected_pic = vm.pics.find(item => item.user_id === booking.instructor.id);
            //     //set the PIC now...
            //     vm.bookout.pic = selected_pic;
            //     vm.bookout.instructor_id = booking.instructor.id;
            //     vm.bookout.instructor = booking.instructor;


            //     var selected_put = vm.pics.find(item => item.user_id === booking.user_id);
            //     vm.bookout.put = selected_put;

            // } else {
            //     //then the user is the PIC
            //     var selected_pic = vm.pics.find(item => item.user_id === booking.user_id);
            //     vm.bookout.pic = selected_pic;

            // }

       

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

            //vm.update_book_in_options();

            BookoutService.GetAirfieldsByCode(location_default)
                .then(function (data) {
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                        // var selected_location = vm.airfields.find(item => item.id === booking.plane_details.location.id);
                        // //console.log("selected_location", selected_location);
                        // vm.bookout.from_airfield = selected_location;
                       }
                    });


            if(booking.fox_log_id && booking.fox_log_id > 0){
                vm.auto_claim = 1;
                //vm.has_used_claimed_flight = true;

                if(vm.bookout.from_airport.id == vm.bookout.to_airport.id){
                    if(vm.bookout.touch_and_go > 2){
                        // circuits 3?
                        var selected_detail_type = vm.flight_types.find(item => item.id === 3);
                        vm.bookout.flight_type = selected_detail_type;
                    } else {
                        //local flight? 1 
                        var selected_detail_type = vm.flight_types.find(item => item.id === 1);
                        vm.bookout.flight_type = selected_detail_type;
                    }

                } else {
                    var selected_detail_type = vm.flight_types.find(item => item.id === 2);
                    vm.bookout.flight_type = selected_detail_type;
                }

                vm.bookout.brakes_off = {time: vm.bookout.brakes_off};
                vm.bookout.brakes_on = {time: vm.bookout.brakes_on};

                //vm.bookout.touch_and_go = vm.bookout.touch_and_go;
                vm.bookout.tng = vm.bookout.touch_and_go;
                vm.bookout.landings = vm.bookout.full_stop_landings;

//                vm.bookout.fox_log_id = vm.claimed_flight.fox_log_id; already set
                vm.bookout.fox_claimed = 1;

                vm.has_used_claimed_flight = true;
                vm.has_requested_to_change_times = false;
                // vm.bookout.takeoff_time = vm.bookout.takeoff_time;
                // vm.bookout.landing_time = vm.bookout.landing_time;

                //THIS IS THE KEY HERE delete this one once selected / complete
                

                if(vm.claimed_flight && vm.claimed_flight.id > 0){
                    vm.bookout.claimed_fox_plane_log_sheet_id = vm.claimed_flight.id;
                }
                if(vm.bookout.fox_log_id > 0){
                    vm.bookout.claimed_fox_plane_log_sheet_id = vm.bookout.fox_log_id;
                }




                //WHAT DOES THIS DO!?

                //set the important bits for the invoice now
                vm.flight_units.brakes_to_brakes = vm.bookout.brakes_time;
                vm.flight_units.airborne_times = vm.bookout.airborne_time;
                vm.flight_units.flight_time = vm.bookout.flight_time;
                vm.flight_units.brakes_times_rounded = vm.bookout.brakes_times_rounded;

                //calculate the invoice yay
                vm.calculate_invoice_for_flight();
                vm.flight_times_complete = true;

                // if(vm.bookout.instructor_id > 0 || vm.bookout.put_id > 0 || vm.this_was_instructional_claim || vm.this_claim_was_instructional || vm.bookout.course_id > 0){
                //    // console.log("process bookout to book in");

                //     preselect_course_and_tuition();
                // }

                //IF THE PIC is authorised to SOLO
                //OR IF THE USER IS OWNER-FLIER!!

                // we need to set the PIC as themselves automatically
                // it feels silly to have to fill it in otherwise. 



            } else { 
                if(vm.bookout.plane_charges.charge_type == "airborne" || vm.bookout.plane_charges.charge_type == "flight"){
                    vm.show_takeoff_landing_times = true;
                }
                // console.log('else');
                
            }



            CourseService.GetCoursesByClubId(booking.club_id)
                .then(function(data){
                    vm.club_courses = data.items;

                    if(vm.bookout.instructor_id > 0 || vm.bookout.put_id > 0 || vm.this_was_instructional_claim || vm.this_claim_was_instructional || vm.bookout.course_id > 0){
                        // console.log("process bookout to book in");
                        preselect_course_and_tuition();
                        //try_split??
                    }
                });
            //booking.plane_details.location.id
            // vm.bookout.pic = selected_pic;

            // $location.hash('top');
            // $anchorScroll();
            if(vm.scroll){
                vm.scroll = false;
                smoothScroll.toTop();
                vm.show_loading = false;
            }
            

        }


            //nice looking date pickers


            $scope.popup = [];

            $scope.open = function(id, $event) {
                // //console.log("THIS", id);
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

           

         
        


    }