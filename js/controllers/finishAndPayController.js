 app.controller('FinishAndPayController', FinishAndPayController);

    FinishAndPayController.$inject = ['$sce', 'UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$interval', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'BookoutService', '$filter', 'PlaneService', 'InstructorCharges', 'PaymentService', 'InvoicesService', 'EnvConfig'];
    function FinishAndPayController($sce, UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $interval, $timeout, uiCalendarConfig, BookingService, LicenceService, BookoutService, $filter, PlaneService, InstructorCharges, PaymentService, InvoicesService, EnvConfig) {
        
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.show_loading = false;


        //this club ID needs to reflect the club that has been selected....
        vm.club_id = 6;
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
            },
            plane: {}
        };
      
        vm.dateFormat = 'date:HH:mm \'on\' dd/MM/yyyy';
        var setting_new_member;


        vm.reported_defects = [];

        vm.complete_flight = true;

        vm.previous_invoice;

        vm.defect_severity;
        vm.defect_severities = [
            { title: "No Fly Item - Ground the plane"},
            { title: "Flyable - needs to be checked at next maintenance"},
            { title: "Not urgent - but needs noting"},
            { title: "Unsure of severity"}
        ];  



        // vm.dmethods = [
        //     { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
        //     { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
        //     { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
        //     { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
        //   ];
        // vm.dsavedCards = [
        //   // { id:'card_1', brand:'Visa', last4:'4242', exp:'06/27', isDefault:true, nick:'Personal' },
        //   // { id:'card_2', brand:'Mastercard', last4:'1881', exp:'11/26', isDefault:false, nick:'Business' }
        // ];
        //direct-debit, saved-card, new-card, card-machine
        



        //SAMPLE ACCORDION MENU TO SELECT THE PAYMENT METHOD
        // // Right-side icons (same colour/style)
        // var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        //   var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        //   var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        //   var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        
          vm.donConfirm = function(methodLabel, paymentIntent){
            console.log("confirmation is called", methodLabel);
            console.log("paymentIntent", paymentIntent);
          //alert('Parent received D confirmation: ' + methodLabel);
            vm.book_in_flight(methodLabel, paymentIntent);
          };

          vm.default_payment = 'direct-debit';

          vm.methods = [
            { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
            { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
          ];

           vm.savedCards = [];


          // vm.expandedId = 'direct-debit';
          // vm.selectedId = 'direct-debit';
         

          // vm.dd   = { name: '', email: '', sortCode: '', account: '' };
          // vm.card = { name: '', number: '', exp: '', cvc: '' };

          // vm.toggle = function(id){ vm.expandedId = (vm.expandedId === id) ? null : id; vm.selectedId = id; };
          // vm.isExpanded = function(id){ return vm.expandedId === id; };
          // vm.keyHeader = function(e,id){ var k=e.which||e.keyCode; if(k===13||k===32){ e.preventDefault(); vm.toggle(id);} };
          // vm.ddReady   = function(){ return !!(vm.dd.name && vm.dd.email && vm.dd.sortCode && vm.dd.account); };
          // vm.cardReady = function(){ return !!(vm.card.name && vm.card.number && vm.card.exp && vm.card.cvc); };
          // vm.confirm   = function(label){ alert('Selected: ' + label); };
          // vm.selectedTitle = function(){
          //   for (var i=0;i<vm.methods.length;i++){ if(vm.methods[i].id===vm.selectedId){ return vm.methods[i].title; } }
          //   return null;
          // };

          // vm.switchTo = function(type){
          //     // find by type (no Array.find for ES5)
          //     for (var i = 0; i < vm.methods.length; i++) {
          //       if (vm.methods[i].type === type) {
          //         vm.selectedId = vm.methods[i].id;
          //         vm.expandedId = vm.methods[i].id;
          //         return;
          //       }
          //     }
          //   };

          // vm.selectedSavedCardId = (vm.savedCards[0] && vm.savedCards[0].id) || null;

          //   vm.selectSavedCard = function(id){
          //     vm.selectedSavedCardId = id;
          //   };

          //   vm.keySelectTile = function(e, id){
          //     var k = e.which || e.keyCode;
          //     // Enter(13) or Space(32) selects
          //     if (k === 13 || k === 32) { e.preventDefault(); vm.selectSavedCard(id); }
          //     // Optional: ArrowLeft/ArrowRight to move focus
          //   };

          //   vm.cardBrandIcon = function(brand){
          //     // Simple inline SVGs; extend as needed
          //     var visa = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#0a4595"/><text x="18" y="16" text-anchor="middle" font-size="10" fill="#fff" font-family="Arial, Helvetica, sans-serif">VISA</text></svg>';
          //     var mc = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#1f2937"/><circle cx="15" cy="12" r="6.5" fill="#eb001b"/><circle cx="21" cy="12" r="6.5" fill="#f79e1b" opacity=".9"/></svg>';
          //     var amex = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#2e77bb"/><text x="18" y="16" text-anchor="middle" font-size="9" fill="#fff" font-family="Arial, Helvetica, sans-serif">AMEX</text></svg>';

          //     var b = (brand || '').toLowerCase();
          //     var svg = /visa/.test(b) ? visa
          //             : /(master|mc)/.test(b) ? mc
          //             : /(amex|american)/.test(b) ? amex
          //             : '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#eef2ff"/><text x="18" y="15" text-anchor="middle" font-size="8" fill="#4f46e5" font-family="Arial, Helvetica, sans-serif">CARD</text></svg>';

          //     return $sce.trustAsHtml(svg);
          //   };

            // vm.pay_with_saved_card = function(){
            //     vm.show_loading = true;
            //     console.log("cardid = ", vm.selectedSavedCardId);
                
            //     // .. // .. /// .. /// .. // ... //
            //     //we need to create a payment intent for the booking rather than a singular invoice
            //     // PaymentService.CreatePaymentIntentBooking
            //     var obj = {
            //         booking_id: vm.bookout.booking_id,
            //         user_id: vm.user.id,
            //         card_id: vm.selectedSavedCardId
            //     }

            //     PaymentService.CreatePaymentIntentBooking(obj)
            //                 .then(function (data) {
            //                     //console.log(data);
            //                     if(data.success){
                                    








            //                         ////console.log("CARDS", vm.cards);
            //                     } else {
            //                        console.log("WOOOPSIES...", data);
            //                         //this should be very very rare...
            //                     }
            //     });


            // }
                





        vm.complete_flight = false;
        vm.complete_this_flight = function(){

            if(vm.tacho_error_highlight){
                alert("You cannot complete a fligth where the last meter reading is greater than the start meter reading!");
                return false;
            }

            var getShort = {club_id: vm.bookout.club_id,
                user_id: vm.bookout.user_id};

                // //console.log("PASSING", getShort);
            //let's fetch some information about the user
            MemberService.GetMandate(vm.bookout.user_id, vm.bookout.club_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                           
                            if(data.success){
                                vm.info = data.info;


                                vm.savedCards = data.cards;

                                if(vm.savedCards.length > 0){
                                    vm.methods[1].visible = true;
                                } else {
                                    vm.methods[1].visible = false;
                                }

                                vm.machine = data.machine;
                                if(vm.machine.success){
                                    vm.methods[3].visible = true;
                                } else {
                                    vm.methods[3].visible = false;
                                }
                            }

                        });




            vm.complete_flight = true;
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


        $scope.update_pic = function(){
            //console.log("--> ", vm.user.id);
            //console.log("--> ", vm.bookout.instructor_id);
            //console.log("--> ", vm.bookout.pic.user_id);

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


        // vm.cards = [];
        // PaymentService.GetByUserId(vm.user.id)
        //                     .then(function (data) {
        //                         //console.log(data);
        //                         if(data.success){
        //                             vm.cards = data.cards;
        //                             ////console.log("CARDS", vm.cards);
        //                         } else {
        //                            // //console.log("WOOOPSIES...");
        //                             //this should be very very rare...
        //                         }
        //                     });


        // the ARRIVAL option should be automatically filled in when there was a departure prior to the flight and home airfield was
        //entered as the destination

       

        switch($state.current.data.action){
            case "add":

                //console.log("bookout", $stateParams.id);
                //so now we can load the BOOKING with this ID, and therefore can sort it all out :)
                // let us preload the content required from the booking - fetch the booking
                //console.log("FETCH THE BOOKING");

                BookingService.GetForBookout(vm.user.id, $stateParams.id)
                 .then(function (data) {
                    ////console.log("data is : ", data);
                    if(data.success){
                        //console.log("success");
                        

                        if(data.booking.complete == 1){
                            alert("It appears that you have already completed this booking...");
                            $state.go('dashboard.my_account', {}, { reload: true });
                        }

                        vm.bookout = data.booking;

                        //temporary bits to overcome the start and end times issues...
                        vm.bookout.start_date = new Date("2100/07/26");
                        vm.bookout.end_date = new Date("2100/07/26");

                        MemberService.GetAllByPics(data.booking.club_id, vm.user.id)
                            .then(function (pics) {
                                    vm.pics = pics;
                                    process_bookout_to_bookin(data.booking);
                            });



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
      

        vm.calculate_invoice_for_flight = function(){

            //vm.flight_units where the units are stored


            // //vm.bookout.plane_charges where the fees are stored
            // var plane_units = 0;
            // //plane units
            // if(vm.bookout.plane_charges.charge_type == "brakes"){
            //     //then the units relate to the entered numbers:
            //     plane_units = vm.flight_units.brakes_to_brakes;
            // } else {
            //     //then the units we need to calculate relate to the hours between brakes off and on.
            //     plane_units = (vm.bookout.end_tacho - vm.bookout.start_tacho);
            // }

            // var plane_total = (vm.bookout.plane_charges.charge_rate_unit * plane_units);


            // //plane surchages::::
            // var surcharge_units = 0;
            // if(vm.bookout.plane_charges.surcharge_type == "flight"){
            //     //then the units relate to the entered numbers:
            //     surcharge_units = 1;
            // } else if(vm.bookout.plane_charges.surcharge_type !== "none") {
            //     //then the units are based on the plane units
            //     surcharge_units = plane_units;
            // }

            // var surcharge_total = (vm.bookout.plane_charges.surcharge_fee * surcharge_units);


            // //landings and touch and goes etc...
            // var landing_units = vm.bookout.landings | 0;
            // var landings_total = (landing_units * vm.bookout.plane_charges.landing_fee);


            // var tg_units = vm.bookout.tng | 0;
            // var tng_total = (tg_units * vm.bookout.plane_charges.touch_and_go_fee);



            // //TUITION CHARGES
            // var tuition_charge_type = "none";
            // var tuition_price = 0;
            // var tuition_total = 0;
            // var tuition_units = 0;
            // if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id > 0 && vm.bookout.tuition_charges){

            //     tuition_charge_type = vm.bookout.tuition_charges.charge_type;
            //     tuition_price = vm.bookout.tuition_charges.price;

            //     if(tuition_charge_type == "brakes"){
            //         tuition_units = vm.flight_units.brakes_to_brakes;
            //         tuition_charge_type = "brakes off to brakes on hours";
            //     } else if(tuition_charge_type == "plane"){
            //         tuition_units = (vm.bookout.end_tacho - vm.bookout.start_tacho);
            //         tuition_charge_type = "plane units";
            //     } else if(tuition_charge_type == "session"){
            //         tuition_units = 1;
            //         tuition_charge_type = "session";
            //     }

            //     tuition_total = (tuition_units * tuition_price);

            // }

            // var total_to_remove = 0;
            // var receipts = [];
            // //need to process the reductions due to the receipts...
            // for(var i = 0;i<vm.lubricant_receipts.length;i++){

            //     if(vm.lubricant_receipts[i].reimbursement == 1){
            //         receipts.push(vm.lubricant_receipts[i]);
            //         total_to_remove = Number.parseFloat(Number.parseFloat(total_to_remove) + Number.parseFloat(vm.lubricant_receipts[i].price));
            //     }

            // }

            // //console.log("CALC HERE", total_to_remove);






            // var total = (plane_total + surcharge_total + landings_total + tng_total + tuition_total - total_to_remove);

            vm.invoice_totals = vm.previous_total;

            vm.plane_charges = {
                // plane_charge_type: vm.bookout.plane_charges.charge_type,
                // plane_unit_price: vm.bookout.plane_charges.charge_rate_unit,
                // plane_units: plane_units,
                // plane_total: plane_total,
                // surcharge_charge_type: vm.bookout.plane_charges.surcharge_type,
                // surcharge_unit_price: vm.bookout.plane_charges.surcharge_fee,
                // surcharge_units: surcharge_units,
                // surcharge_total: surcharge_total,
                // landing_units: landing_units,
                // landing_unit_price: vm.bookout.plane_charges.landing_fee,
                // landing_total: landings_total,
                // tng_units: tg_units,
                // tng_unit_price: vm.bookout.plane_charges.touch_and_go_fee,
                // tng_total: tng_total,
                // tuition_charge_type: tuition_charge_type,
                // tuition_unit_price: tuition_price,
                // tuition_units: tuition_units,
                // tuition_total: tuition_total,
                //receipts: receipts,
                total: 0
            };

            //vm.bookout.tuition_charges

        }

        vm.instructor_charges = []; 


        // vm.update_book_in_options = function(){
        //     vm.complete_flight = ( (vm.bookout.flight_type.title !== "Local" && vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) || vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) ? false : true;
        // }
        vm.complete_flight = true;
       


        // var compile_invoice = function(){
        //     var items = [];
        //     // vm.plane_charges
        //     //add plane costs
        //     items.push({title: "Plane "+vm.plane_charges.plane_charge_type+" Charge", unit: vm.plane_charges.plane_units, unit_price: vm.plane_charges.plane_unit_price, total: vm.plane_charges.plane_total, organise: 0});
        //     if(vm.plane_charges.surcharge_total > 0){
        //         items.push({title: "Surcharge per "+vm.plane_charges.surcharge_charge_type, unit: vm.plane_charges.surcharge_units, unit_price: vm.plane_charges.surcharge_unit_price, total: vm.plane_charges.surcharge_total, organise: 1});
        //     }
        //     if(vm.plane_charges.tuition_total > 0){
        //         items.push({title: "Tuition Charge - "+vm.bookout.tuition_required.title, unit: vm.plane_charges.tuition_units, unit_price: vm.plane_charges.tuition_unit_price, total: vm.plane_charges.tuition_total, organise: 2});
        //     }
        //     if(vm.plane_charges.landing_total > 0){
        //         items.push({title: "Home Landing", unit: vm.plane_charges.landing_units, unit_price: vm.plane_charges.landing_unit_price, total: vm.plane_charges.landing_total, organise: 4});
        //     }
        //     if(vm.plane_charges.tng_total > 0){
        //         items.push({title: "Home Touch and Go", unit: vm.plane_charges.tng_units, unit_price: vm.plane_charges.tng_unit_price, total: vm.plane_charges.tng_total, organise: 3});
        //     }
           

        //     //RENTAL ITEMS !? --> make it free for now...

        //     for(var i=0;i<vm.plane_charges.receipts.length;i++){
        //         var org = parseInt(5 + i)
        //         items.push({title: "Reimbursement - "+vm.plane_charges.receipts[i].item, unit: vm.plane_charges.receipts[i].quantity, unit_price: (vm.plane_charges.receipts[i].price / vm.plane_charges.receipts[i].quantity), total: -vm.plane_charges.receipts[i].price, organise: org});
        //     }

        //     return items;
        // }






        //complete the booking back in
        vm.book_in_flight = function(method='', paymentIntent=null){

            var obj = {
                //payer_id: vm.bookout.payer_id, // >>>? is this required here?
                user_id: vm.bookout.user_id,
                club_id: vm.bookout.club_id,
                plane_id: vm.bookout.plane_id,
                booking_id: vm.bookout.booking_id,
                paying_now: vm.complete_flight,
                free_flight: (vm.invoice_totals == 0) ? true : false
            };

            //methods: bacs, card, new_card, cardmachine - overwritten
            //direct-debit, saved-card, new-card, card-machine
            if(method == "new-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = method;
            } else if(method == "saved-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = method;
            } else if(method == "direct-debit"){
                //nothing to add - it should just work...
                obj.method = method;
            } else if(method == "card-machine"){
                //nothing here at the moment?
                obj.paymentIntent = paymentIntent;
                obj.method = method;
            }

            // //console.log("TO BE SENDING : ", obj);
            //return false;
            BookoutService.PayBooking(vm.bookout.id, obj)
            .then(function(data){
                //console.log("SENT - ", data);
                if(data.success){
                        vm.show_loading = false;
                        $state.go('dashboard.my_account', {}, { reload: true });                    
                } else {
                    alert("an error occurred.... \n\n "+data.message);
                    vm.show_loading = false;
                    //console.log(data);
                }
            });

        }




        vm.start_tacho_orig;





        function process_bookout_to_bookin(booking){


            //vm.bookout is where we want to fill the content....
            vm.bookout.booking_id = booking.id;
            vm.bookout.club_id = booking.club_id;
            vm.bookout.user_id = booking.user_id;
            vm.bookout.plane = booking.plane;
            vm.club_id = booking.club_id;
            // vm.bookout.return = new Date(booking.end);
            // vm.bookout.booking_start = new Date(booking.start);


              if(((vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ) && vm.bookout.user_id !== vm.user.id){
                //console.log("NOT BOOKING FOR SELF?");
                vm.can_authorise = true;

            }


            vm.invoices = [];
            vm.previous_total = 0;
            InvoicesService.GetAllByBooking(booking.id)
            .then(function (data) {
                    //console.log("invoice data is : ", data);
                   
                    if(data.success){
                        //console.log("we already have invoices for this booking");
                        vm.previous_invoice = data.invoice;

                        for(var me in data.invoices){

                            for (var key in data.invoices[me].flights) {
                                //console.log("KEY ", key);

                                if(data.invoices[me] && data.invoices[me].status && data.invoices[me].status.toLowerCase() !== "paid"){
                                   vm.invoices.push(data.invoices[me].flights[key]);
                                    vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(data.invoices[me].flights[key]["total"]));
                                }
                                  

                                //vm.calculate_invoice_for_flight();
                                // for(var i=0;i<data.invoice.flights[key].length;i++){
                                // }
                            }

                        }
                        


                        // for (var key in data.invoice.flights) {
                        //     //console.log("KEY ", key);

                        //     if(data.invoice && data.invoice.status && data.invoice.status.toLowerCase() !== "paid"){
                        //        vm.invoices.push(data.invoice.flights[key]);
                        //         vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(data.invoice.flights[key]["total"]));
                        //     }
                              

                        //     //vm.calculate_invoice_for_flight();
                        //     // for(var i=0;i<data.invoice.flights[key].length;i++){
                        //     // }
                        // }
                        
                        vm.complete_this_flight();
                        vm.invoice_totals = vm.previous_total;

                        //was var send before...
                        vm.send = {
                            club_id: vm.bookout.club_id,
                            user_id: vm.user.id,
                            booking_id: booking.id
                        }

                        /*
                        VM.SEND --> TO THE PAYMENT MODAL
                            if invoice --> remove booking_id add invoice_id 
                            if no invoice / booking --> remove both and add amount * 100
                            ie: amount: vm.invoice_totals * 100,
                            user must be the user for that invoice / PAYER ID --> careful on admin functions
                        */

                        vm.show_add_card = true;

                        //SETUP THE VM TO SEE THE MENU HERE???
                        //AND INCLUDE THE SEND OBJ?

                        if(vm.previous_total == 0 || vm.invoices.length == 0){

                            alert("It appears that you have already completed this flight!");
                            $state.go('dashboard.my_account', {}, { reload: true });                    

                        }





                        /*
        --> ORIGINAL CODE HERE
                        PaymentService.CreatePaymentIntentNewCard(send)
                        .then(function (data) {
                            console.log("DATA HERE", data);
                            // Initialize Stripe.js
                            var stripe = Stripe('pk_test_51QttFFG8WiGSRCORyxkdZTO8oajcqz9OUsvcDJFpr9FB2PAdbzJc0tS7WNnfzKYsTiqHN1YDZi5UtXk4K52SeD4h00YWXuChNd');

                            const options = {
                              clientSecret: data.client_secret,
                              // Fully customizable with appearance API.
                              appearance: {},
                              paymentMethodOrder: ['card', 'apple_pay', 'google_pay']

                            };

                            // Set up Stripe.js and Elements using the SetupIntent's client secret
                            const elements = stripe.elements(options);

                            // Create and mount the Payment Element
                            const paymentElementOptions = { layout: 'tabs'};
                            const paymentElement = elements.create('payment', paymentElementOptions);
                            paymentElement.mount('#payment-element');


                            const submitButton = document.getElementById('submit-stripe');
                            if (submitButton) {
                              submitButton.addEventListener('click', async (event) => {

                                $scope.$apply(() => {
                                    vm.show_loading = true;
                                });
                                event.preventDefault();
                                //console.log('Submit button clicked!');
                                
                                // Process the payment manually
                                const {error, paymentIntent} = await stripe.confirmPayment({
                                  elements,
                                  confirmParams: {
                                   // return_url: 'https://example.com/order/confirmation',
                                  },
                                  redirect: 'if_required', // Only redirect if absolutely necessary
                                });
                                
                                if (error) {
                                  console.error(error);

                                  $scope.$apply(() => {
                                        vm.show_loading = false;
                                    });

                                } else if(paymentIntent){
                                    //console.log("SUCCESS??");
                                        if (paymentIntent.status === 'succeeded') {
                                            //console.log("PAYMENT SUCCEEDED!!");

                                            //this is where I will now look at confirming that this is paid etc...paymentIntent

                                            $scope.$apply(() => {
                                                vm.book_in_flight('new_card', paymentIntent);
                                            });
                                            

                                        } else {
                                             //console.log("There was an error processing your payment");
                                            $scope.$apply(() => {
                                                vm.show_loading = true;
                                            });
                                        }
                                }
                              });
                            }




                        });
 */







                //SAMPLE ACCORDION MENU TO SELECT THE PAYMENT METHOD

                        //console.log("FLIGHTS", vm.invoices);
                        //console.log("FLIGHTS TOTAL", vm.previous_total);
                        // vm.invoices = data.invoice.flights;
                    } else {
                        //console.log("no invoices have yet been issued for this flight");
                    }


                });



            // PlaneService.GetOpenIssues(booking.plane_id)
            // .then(function (data) {
            //         ////console.log("data is : ", data);
            //        vm.reported_defects = data;
            //     });

            //   PlaneService.GetAllSheetReceipts(vm.bookout.id)
            //     .then(function (data) {
            //         ////console.log("data is : ", data);
            //         vm.lubricant_receipts = data;
            //     });


            //     InstructorCharges.GetByClubId(booking.club_id)
            //     .then(function(data){
            //         vm.instructor_charges = data.items;  
            //     });
            //we need to update the PICS now...

           
            //we need to know where the plane was last booked-in at 
            //(ie: if last flight bookout was completed - where the plane landed at last)
            //if the last booking was not yet completed, then we can assume that this last flight was returning to base.


            
            // var selected_pic = vm.pics.find(item => item.user_id === booking.pic_id);
            // vm.bookout.pic = selected_pic;

            // //console.log("booking.detail_type_id", booking.detail_type_id);

            // // var selected_detail_type = vm.flight_types.find(item => item.id === booking.detail_type_id);
            // // vm.bookout.flight_type = selected_detail_type;

            // if(booking.instructor && booking.instructor !== "" && booking.instructor.id == booking.pic_id){
            //     vm.bookout.put = vm.bookout.user;
            // }

           

            // vm.bookout.from_airfield = booking.from_airport;
            // vm.bookout.to_airfield = booking.to_airport;

            // vm.bookout.start_tacho = Number.parseFloat(booking.last_tacho);
            
            // vm.start_tacho_orig = booking.last_tacho;



           
             //this is where we sort out some of the last bits....



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

       

            // if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.wgs_n){
            //     vm.wgs_n = booking.plane_details.location.wgs_n
            //     vm.wgs_e = booking.plane_details.location.wgs_e;
            // }
            // var location_default = "";

            // if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.code){
            //     location_default = booking.plane_details.location.code.slice(0, -1);
            // } else {
            //     location_default = "EG";
            // }

            // //vm.update_book_in_options();

            // BookoutService.GetAirfieldsByCode(location_default)
            //     .then(function (data) {
            //         if(data.success){
            //             //use GB airfields first...
            //             vm.airfields = data.airfields;
            //             // var selected_location = vm.airfields.find(item => item.id === booking.plane_details.location.id);
            //             // //console.log("selected_location", selected_location);
            //             // vm.bookout.from_airfield = selected_location;
            //            }
            //         });



            //booking.plane_details.location.id
            // vm.bookout.pic = selected_pic;


        }


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

           

         
        


    }