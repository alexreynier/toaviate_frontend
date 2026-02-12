app.controller('DashboardClubMembersController', DashboardClubMembersController);

    DashboardClubMembersController.$inject = ['$sce', 'PaymentService', 'UserService', 'MemberService', 'MembershipService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'PoidService',  'LicenceService', 'MedicalService', 'DifferencesService', 'AuthenticationService', '$http', 'PackageService', 'ToastService'];
    function DashboardClubMembersController($sce, PaymentService, UserService, MemberService, MembershipService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, PoidService,  LicenceService, MedicalService, DifferencesService, AuthenticationService, $http, PackageService, ToastService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        vm.club.member = {};
        vm.club.member.user = {}; // Initialize user object for form binding
                                vm.club.member.payment_now = true;

        vm.imported_new_headers = [];

        // vm.club.member.membership_id = {};

        vm.test = "Package valid until 12/03/2022<br /> To be used on:<br /> G-BOOF <br /> G-OARU";
        
        vm.action = $state.current.data.action;

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.no_show_cols = ["membership_start", "membership_id", "selected"];

        vm.show_loading = true;

        $scope.sortType     = 'Email'; // set the default sort type
        $scope.sortReverse  = false;  // set the default sort order
        $scope.searchTool   = '';     // set the default search/filter term

        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);



        vm.show_pay_now = false;
        vm.show_loading = false;

        vm.last_invoice_opened = {};


        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        
          vm.donConfirm = function(methodLabel, paymentIntent){
            // console.log("confirmation is called", methodLabel);
            // console.log("paymentIntent", paymentIntent);
          //alert('Parent received D confirmation: ' + methodLabel);
            vm.complete_invoice(methodLabel, paymentIntent);
          };

          vm.default_payment = 'direct-debit';

          vm.methods = [
            { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: false },
            { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
          ];

           vm.savedCards = [];

           vm.complete_invoice = function(method, paymentIntent){

               //we now have a payment to complete
               //process_payment

               var obj = {
                   user_id: vm.last_invoice_opened.user_id,
                   club_id: vm.last_invoice_opened.club_id,
                   paymentIntent: paymentIntent,
                   invoice_id: vm.last_invoice_opened.id,
                   method: method
               }

               PaymentService.ProcessPayment(obj)
                   .then(function (data) {

                       if(data.success){

                           //finish with:
                           //RELOAD THE INVOICES!!!

                            UserService.GetInvoicesUserClub(vm.club.member.user_id, vm.club_id, vm.current_invoice_offset, vm.loaded_per_batch, 0)
                            .then(function (data) {
                                   vm.invoices = data.invoices;
                                   vm.upcoming = data.upcoming;


                                    vm.add_credit_amount = 0;
                                    vm.add_credit_note = "";
                                    vm.show_add_credit = false;    
                                    vm.show_loading = false;
                                       
                                    vm.show_pay_now = false;

                                    ToastService.success('Success', 'Operation completed successfully');


                                });



                           // ClubService.GetClubInvoices(vm.club_id, vm.from_date, vm.to_date)
                           //  .then(function (data) {
                           //         console.log("data is : ", data);
                           //         vm.invoices = data.invoices;
                           //         vm.totals = data.totals;

                           //         vm.show_pay_now = false;
                           //         vm.show_loading = false;
                           //         alert("SUCCESS!");


                           //      });

                           

                       } else {
                           ToastService.error('Error', 'Something happened which was not supposed to happen... Please try again');
                           console.log("===== ERROR =====");
                           console.log(data);
                           console.log("===== ERROR =====");
                       }


                   });

           }

           vm.close_pay_now = function(){
               vm.show_pay_now = false;
               vm.show_loading = false;
           }

           vm.show_payment_option = function(invoice){
            var status = invoice.status;
            if(status == "pending_submission"){
                return true;
            } else if(status == "issued"){
                return true;
            } else {
                return false;
            }

        }

        vm.info;

        vm.show_payment = function(invoice){
            console.log("invoice details: ", invoice);
            vm.last_invoice_opened = invoice;
            vm.send = {
                club_id: invoice.club_id,
                user_id: invoice.user_id,
                invoice_id: invoice.id
            }

            //get user cards
            //get user info

            MemberService.GetMandate(invoice.user_id, invoice.club_id)
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

                        vm.show_pay_now = true;
                    }

                });

           

        }







        $scope.get_human_status = function(status){

            var returned;
            switch(status){
                case 'issued':
            
                  returned = "Created";

              break;

              case 'pending_submission':
                  
                    returned = "Requesting";

              break;

              case 'submitted':
                    
                    returned = "Requested";

              break;

              case 'confirmed':
                    
                    returned = "Paid";

              break;

              case 'paid_out':
                    returned = "Paid";

              break;

              case 'failed':
                    returned = "Failed";

              break;

              case 'charged_back':
                    returned = "Charged Back";

              break;
              default:
                  returned = status;
              break
            }

            return returned;

        }

        switch(vm.action){
            case "add":
                //console.log("adding a new member please");
                vm.page_title = "Add a New member";

                // Prefill membership_start to today
                vm.club.member.membership_start = new Date();

                 MembershipService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.memberships = data;
                        // vm.club.member.membership_id.selected = vm.club.member.membership_id;
                        // vm.membership = vm.club.member.membership_name;
                        // vm.club.membership = vm.club.member.membership_name;
                        // //console.log(vm.club.memberships);
                    });

            break;
            case "edit":
                //console.log("edit an existing membership");

                

                 MemberService.GetById($stateParams.member_id, vm.club_id)
                    .then(function(data){
                        vm.club.member = data.member;   
                        // //console.log(vm.club);
                        vm.club.member.is_manager = (vm.club.member.is_manager == 1) ? true : false;
                        vm.club.member.approved = (vm.club.member.approved == 1) ? true : false;

                        

                        PoidService.GetByUserIdClub(vm.club.member.user_id, vm.club_id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                vm.poids = data.poids;
                                //console.log("POIDS", data.poids);
                            } else {
                                //console.log("WOOOPSIES...");
                                //this should be very very rare...
                            }

                        });


                        MedicalService.GetByUserIdClub(vm.club.member.user_id, vm.club_id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                vm.medicals = data.medicals;
                                //console.log("medicals", vm.medicals);
                            } else {
                                //console.log("WOOOPSIES...");
                                //this should be very very rare...
                            }

                        });

                        LicenceService.GetByUserIdClub(vm.club.member.user_id, vm.club_id)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                vm.licences = data.licences;
                                //console.log("LICENCES", vm.licences);

                            } else {
                                //console.log("WOOOPSIES...");
                                //this should be very very rare...
                            }

                        });

                        DifferencesService.GetByUserIdClub(vm.club.member.user_id, vm.club_id)
                        .then(function (data) {
                                var diff = data.differences.differences;
                                for(var i=0;i<diff.length;i++){
                                    if(diff[i].sign_off_date == "0000-00-00"){
                                       delete diff[i].sign_off_date;
                                    }
                                    diff[i].sign_off_date = new Date(diff[i].sign_off_date);
                                    diff[i].day = (diff[i].day == 1)? true : false;
                                    diff[i].night = (diff[i].night == 1)? true : false;
                                    diff[i].vfr = (diff[i].vfr == 1)? true : false;
                                    diff[i].ifr = (diff[i].ifr == 1)? true : false;
                                }
                                data.differences.differences = diff;
                                vm.differences = data.differences.differences;
                                vm.differences_images = data.differences.images;
                                //console.log("GET DIFFS", vm.differences);

                        });


                        PackageService.GetPackagesByUserIdAndClubId(vm.club.member.user_id, vm.club_id)
                            .then(function (data) {
                                //console.log(data);
                                vm.packages = data.items;
                            });


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

                        vm.get_pax_html = function(flight_obj){
                            var pax = "";
                             for(var i=0;i<flight_obj.passengers.length;i++){
                                 //"+flight_obj.passengers[i].nok[0].first_name+" "+flight_obj.passengers[i].nok[0].last_name+"
                                 var nok = "";
                                 if(flight_obj.passengers[i].nok.length > 0){
                                     for(var j=0;j<flight_obj.passengers[i].nok.length;j++){
                                         nok = nok + "<br /><br />Emergency Contact ("+(j+1)+"): <br />"+flight_obj.passengers[i].nok[j].first_name+ " " +flight_obj.passengers[i].nok[j].last_name + " <br />relationship: "+flight_obj.passengers[i].nok[j].relationship+"<br />t: "+flight_obj.passengers[i].nok[j].phone_number+ " <br /> e: "+flight_obj.passengers[i].nok[j].email_address+"<br />";
                                     }
                                 } 
                                pax = pax + "<span class='bolder'><b>" + flight_obj.passengers[i].first_name +" "+ flight_obj.passengers[i].last_name +"</b></span><br />e: "+flight_obj.passengers[i].email+"<br />t: "+((flight_obj.passengers[i].telephone_number) ? flight_obj.passengers[i].telephone_number : "unknown")+nok+"  <br /> <br />";
                            }
                            if(flight_obj.passengers.length == 0){

                            }
                            if(flight_obj.instructor_id > 0){

                                 var nok2 = "";
                                     if(vm.club.member.nok.noks.length > 0){
                                         for(var j=0;j<vm.club.member.nok.noks.length;j++){
                                             nok2 = nok2 + "<br />Emergency Contact ("+(j+1)+"): <br />"+vm.club.member.nok.noks[j].first_name+ " " +vm.club.member.nok.noks[j].last_name + " <br />relationship: "+vm.club.member.nok.noks[j].relationship+"<br />t: "+vm.club.member.nok.noks[j].phone_number+ " <br /> e: "+vm.club.member.nok.noks[j].email_address+"<br />";
                                         }
                                     } 

                                    pax = pax + "<br /><span class='bolder'>Instructor Present</span> <br /> "+flight_obj.booking.instructor.first_name+" "+flight_obj.booking.instructor.last_name+" <br /> "+nok2;
                                }
                            if(flight_obj.user_id > 0){
                                    
                                    var nok1 = "";
                                     if(vm.club.member.nok.noks.length > 0){
                                         for(var j=0;j<vm.club.member.nok.noks.length;j++){
                                             nok1 = nok1 + "<br />Emergency Contact ("+(j+1)+"): <br />"+vm.club.member.nok.noks[j].first_name+ " " +vm.club.member.nok.noks[j].last_name + " <br />relationship: "+vm.club.member.nok.noks[j].relationship+"<br />t: "+vm.club.member.nok.noks[j].phone_number+ " <br /> e: "+vm.club.member.nok.noks[j].email_address+"<br />";
                                         }
                                     } 

                                    // var nok1 = "<br /><br />Emergency Contact ("+(j+1)+"): <br />"+flight_obj.passengers[i].nok[j].first_name+ " " +flight_obj.passengers[i].nok[j].last_name + " <br />relationship: "+flight_obj.passengers[i].nok[j].relationship+"<br />t: "+flight_obj.passengers[i].nok[j].phone_number+ " <br /> e: "+flight_obj.passengers[i].nok[j].email_address+"<br />";
                                    pax = pax + "<br /><span class='bolder'>Member Present</span> <br />"+nok1;
                            }
                            return pax;

                            // var b = '<accordion close-others="oneAtATime"> <accordion-group heading="Static Header, initially expanded" is-open="true"> This content is straight in the template. </accordion-group> <accordion-group heading="TITLE" ng-repeat="group in groups"> Some content here </accordion-group> <accordion-group heading="Dynamic Body Content"> <p>The body of the accordion group grows to fit the contents</p> <button class="btn btn-default btn-sm" ng-click="addItem()">Add Item</button> <div ng-repeat="item in items">{{item}}</div> </accordion-group> <accordion-group is-open="isopen"> <accordion-heading> I can have markup, too! <i class="pull-right glyphicon" ng-class="{\'glyphicon-chevron-down\': isopen, \'glyphicon-chevron-right\': !isopen}"></i> </accordion-heading> This is just some content to illustrate fancy headings. </accordion-group> </accordion>';
                            // return b;
                        }



                        // vm.calculate_difference = function(package, difference){

                        //     var price = package.price;
                        //     var hours_dual = package.hours_dual;
                        //     var hours_solo = package.hours_solo;

                        //     var base = price / (hours_dual + hours_solo);

                        //     var initial_dual_price = base + difference;
                        //     var initial_solo_price = (price - (initial_dual_price * hours_dual)) / hours_solo;

                        //     var price_ratio = initial_dual_price / initial_solo_price;

                        //     var hour_ratio = hours_dual / hours_solo;
                        //     var remaining_ratio = hours_dual_remaining / hours_solo_remaining;
                        //     var remaining_hours = hours_dual_remaining / hours_solo_remaining;

                        //     //hello world

                        //     vm.package_split = {ratio: hour_ratio, remaining_ratio: remaining_ratio, dual_price: initial_dual_price, solo_price: initial_solo_price, price_ratio: price_ratio, remaining_hours: remaining_hours};

                        // }


                        // vm.calculate_change = function(slider_value){

                        //     //100 ==> everything in solo
                        //     //0 ==> everything in dual flights

                        //     var dual_percent = slide_value/100;
                        //     var dual_hours = dual_percent * remaining_hours;

                        //     var solo_percent = 100 - (slide_value/100);



                        //     var changme = slider_value - (vm.package_split.remaining_ratio * 100);
                        //     if(changeme > 0){
                        //         //then we are decreasing solo and increasing dual


                        //     } else {
                        //         //then we are increasing solo and decreasing dual
                        //     }


                        // }

                        vm.change_package = {};

                        vm.calculate_change = function(new_percent=0) {

                            // output.innerHTML = "slider percentage: "+Number(slider.value).toFixed(2)+"%";

                              ////console.log("CHANGE");

                            var slider_val = (new_percent > 0) ? new_percent : vm.change_package.slider_value;

                            vm.change_package.dual_percent = slider_val/100;
                            vm.change_package.dual_hours = ( vm.change_package.dual_percent * vm.change_package.remaining_price ) / vm.change_package.initial_dual_price;

                            // var solo_percent = 100 - (slider_val/100);

                            vm.change_package.dual_price = vm.change_package.dual_percent * vm.change_package.remaining_price;

                            if(vm.change_package.dual_price >= vm.change_package.remaining_price){

                               vm.change_package.dual_price = vm.change_package.remaining_price;
                               vm.change_package.dual_hours = vm.change_package.dual_price / vm.change_package.initial_dual_price;

                            }

                            vm.change_package.remaining_solo_hours = (vm.change_package.remaining_price - vm.change_package.dual_price) / vm.change_package.initial_solo_price; 
                            
                            console.log("CHANGE CALC??", vm.change_package);
                            vm.change_package.solo_number = vm.change_package.remaining_solo_hours;
                            vm.change_package.dual_number = vm.change_package.dual_hours;

                            // dual.innerHTML = "DUAL: "+Number(dual_hours).toFixed(2)+" hours"; // Display the default slider value
                            // dual_price_div.innerHTML = "DUAL: £"+Number(dual_price).toFixed(2);
                            
                            // vm.change_package.dual_number = dual_hours;

                            vm.change_package.solo_price = (vm.change_package.remaining_solo_hours * vm.change_package.initial_solo_price);

                            // solo.innerHTML = "SOLO: "+Number(remaining_solo_hours).toFixed(2)+" hours"; // Display the default slider value
                            // solo_number.value = remaining_solo_hours;
                            // solo_price_div.innerHTML = "SOLO: £"+Number(solo_price).toFixed(2);


                            // price_total.innerHTML = "TOTAL: £"+Number(solo_price + dual_price).toFixed(2);

                        }


                        vm.show_package_change = function(pack_obj){
                            console.log(pack_obj);

                            vm.show_package_popup = true;

                            var slider = document.getElementById("myRange");

                            vm.change_package.id = pack_obj.id;
                            vm.change_package.price = pack_obj.price;
                            // vm.change_package.hours_dual = pack_obj.hours_dual;
                            // vm.change_package.hours_solo = pack_obj.hours_solo;
                            // vm.change_package.dual_hours = pack_obj.hours_dual;
                            // vm.change_package.solo_hours = pack_obj.hours_solo;

                            vm.change_package.hours_dual = pack_obj.remaining_hours_dual;
                            vm.change_package.hours_solo = pack_obj.remaining_hours_solo;
                            vm.change_package.dual_hours = pack_obj.remaining_hours_dual;
                            vm.change_package.solo_hours = pack_obj.remaining_hours_solo;


                            // vm.change_package.dual_percent = pack_obj.hours_solo;
                            vm.change_package.difference = pack_obj.difference;
                            vm.change_package.hours_dual_remaining = pack_obj.remaining_hours_dual;
                            vm.change_package.hours_solo_remaining = pack_obj.remaining_hours_solo;

                            vm.change_package.solo_number = pack_obj.remaining_hours_solo;
                            vm.change_package.dual_number = pack_obj.remaining_hours_dual;
                            //console.log("vm.change_package.dual_number : ", vm.change_package.dual_number);

                            vm.change_package.base = (vm.change_package.price - (vm.change_package.difference * vm.change_package.hours_dual) ) / (vm.change_package.hours_dual + vm.change_package.hours_solo);
                            vm.change_package.initial_dual_price = vm.change_package.base + vm.change_package.difference;
                            if(vm.change_package.hours_solo > 0){
                                vm.change_package.initial_solo_price = ((vm.change_package.price - (vm.change_package.initial_dual_price * vm.change_package.hours_dual)) / vm.change_package.hours_solo);
                            } else {
                                vm.change_package.initial_solo_price = vm.change_package.base;
                            }
                            // var price_ratio = initial_dual_price / initial_solo_price;
                            vm.change_package.remaining_price = (vm.change_package.hours_dual_remaining * vm.change_package.initial_dual_price) + (vm.change_package.hours_solo_remaining * vm.change_package.initial_solo_price);

                            // var hour_ratio = hours_dual / hours_solo;
                            vm.change_package.remaining_ratio = (vm.change_package.initial_dual_price * vm.change_package.hours_dual_remaining) / vm.change_package.remaining_price;//hours_dual_remaining / (hours_solo_remaining + hours_dual_remaining);

                            vm.change_package.slider_value = (vm.change_package.remaining_ratio * 100);

                            //hello visuals
                            // var output = document.getElementById("demo");
                            // var solo = document.getElementById("solo");
                            // var dual = document.getElementById("dual");
                            // var solo_price_div = document.getElementById("solo_price");
                            // var dual_price_div = document.getElementById("dual_price");
                            // var price_total = document.getElementById("price_total");
                            // var dual_number = document.getElementById("dual_number");
                            // var solo_number = document.getElementById("solo_number");

                            // solo_number.value = hours_solo_remaining;
                            // solo_number.max = remaining_price / initial_solo_price;
                            // dual_number.value = hours_dual_remaining;
                            // dual_number.max = remaining_price / initial_dual_price;


                            // output.innerHTML = "slider percentage: "+slider.value+"%"; // Display the default slider value
                            // dual.innerHTML = "DUAL: "+hours_dual_remaining; // Display the default slider value
                            // solo.innerHTML = "SOLO: "+hours_solo_remaining; // Display the default slider value
                            // price_total.innerHTML = "REMAINING FUNDS: £"+remaining_price;

                            var percent = 0;


                            // Update the current slider value (each time you drag the slider handle)
                            // slider.oninput = calculate_change();
                            

                            //uncomment the calc
                            vm.calculate_change();

                        }
                        

                        vm.hide_package_change = function(){
                            vm.show_package_popup = false;
                        }

                        vm.refund_package_to_credit = function(){
                            vm.show_loading = true;
                            var check = confirm("Are you sure you wish to refund this package? This is irreversible!");
                            if(check){

                                 PackageService.RefundPackageToAccount(vm.change_package.id)
                                     .then(function (data) {
                                        //console.log(data);
                                        if(data.success) {
                                            vm.packages = data.items;
                                            vm.show_package_popup = false;
                                            vm.show_loading = false;
                                        } else {
                                            ToastService.error('Error', 'An error happened - please try again');
                                            vm.show_package_popup = false;
                                            vm.show_loading = false;
                                        }
                                        

                                    });

                            } else {
                                return false;
                            }
                           
                        }

                        vm.save_package_change = function(){
                            vm.show_loading = true;

                            var obj = {
                                "remaining_hours_dual": vm.change_package.dual_number,
                                "remaining_hours_solo": vm.change_package.solo_number
                            };

                            PackageService.SwapPackageHours(vm.change_package.id, obj)
                             .then(function (data) {
                                //console.log(data);
                                if(data.success) {
                                    vm.packages = data.items;
                                    vm.show_package_popup = false;
                                } else {
                                    ToastService.error('Error', 'An error happened - please try again');
                                    vm.show_package_popup = false;
                                }
                            vm.show_loading = false;

                            });

                        }

                        vm.change_numbers = function(solo_dual){
                            console.log("CHANGE NUMBER");
                            val = 0;
                            if(solo_dual == 'solo'){

                                if( vm.change_package.solo_number > (vm.change_package.remaining_price / vm.change_package.initial_solo_price) ){
                                    vm.change_package.solo_number = (vm.change_package.remaining_price / vm.change_package.initial_solo_price);
                                    val = 0;
                                } else if(vm.change_package.solo_number >= 0) {
                                    val = 1 - ((vm.change_package.solo_number * vm.change_package.initial_solo_price) / vm.change_package.remaining_price); // (remaining_hours - solo_number.value) / remaining_hours;
                                    ////console.log("SOLO: ", val);
                                } else {
                                    val = 1;
                                }

                            } else {

                                if( vm.change_package.dual_number > (vm.change_package.remaining_price / vm.change_package.initial_dual_price) ){
                                    vm.change_package.dual_number = (vm.change_package.remaining_price / vm.change_package.initial_dual_price);
                                    val = 1;
                                } else if(vm.change_package.dual_number >= 0) {
                                    val = (vm.change_package.dual_number * vm.change_package.initial_dual_price) / vm.change_package.remaining_price;
                                } else {
                                    val = 0;
                                }


                            }
                            vm.change_package.percent = (val * 100);
                            vm.change_package.slider_value = vm.change_package.percent;
                            vm.calculate_change(vm.change_package.percent);
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


                            if(minute == 60){
                                hour = hour+1;
                                minute = '00';
                            }


                            // Concate hours and minutes
                            var time = sign + hour + ':' + minute;

                            return time;

                        }
                        

                        vm.show_add_credit = false;    
                        vm.add_credit = function(){
                                
                            //show the add credit for the user.
                            vm.show_add_credit = true;

                        }

                        vm.close_credit = function(){
                            vm.show_add_credit = false;
                        }

                        vm.apply_credit = function(){
                            //create the negative invoice.
                            vm.show_loading = true;

                              
 
                            var obj_to_send = {
                                    items: [{ 
                                        quantity: 1,
                                        price: -vm.add_credit_amount,
                                        title: vm.add_credit_note,
                                        vat: 0,
                                        is_credit_from_admin: 1
                                }
                                ],
                              user: {user_id: vm.club.member.user_id},
                              club_id: vm.club_id,
                              payment: {direct_debit: true},
                              credit_only: 1
                            };


                            // SAMPLE OF WHERE WE NEED TO SEND THE SHIZZLE....
                            PaymentService.CreateCustom(obj_to_send)
                            .then(function (data) {
                                if(data.success){

                                    ////console.log("CARD: "+data);
                                    //fill the drop down menu
                                    //$state.go('dashboard.my_account.payment_methods', {}, { reload: true });
                                     UserService.GetInvoicesUserClub(vm.club.member.user_id, vm.club_id, vm.current_invoice_offset, vm.loaded_per_batch, 0)
                                    .then(function (data) {
                                           vm.invoices = data.invoices;
                                           vm.upcoming = data.upcoming;


                                            vm.add_credit_amount = 0;
                                            vm.add_credit_note = "";
                                            vm.show_add_credit = false;    
                                            vm.show_loading = false;

                                        });

                                   

                                } else {
                                    //console.log("WOOOPSIES...", data);
                                    //this should be very very rare...
                                    vm.show_loading = false;

                                }
                            });




                            




                        }


                        //planes/get_user_journey_log/:user_id/:club_id
                        
                        vm.current_offset = 0;
                        vm.current_invoice_offset = 0;
                        vm.loaded_per_batch = 5;
                        vm.all_loaded = false;
                        vm.all_invoices_loaded = false;

                        PlaneService.GetUserJourneyLogs(vm.club.member.user_id, vm.club_id, vm.current_offset, vm.loaded_per_batch)
                        .then(function (data) {
                            // //console.log(data);
                            vm.logs = data.logs;
                        });

                         // invoices/get_all_upcoming_for_user_by_club/:user_id/:club_id
                        
                        UserService.GetInvoicesUserClub(vm.club.member.user_id, vm.club_id, vm.current_invoice_offset, vm.loaded_per_batch, 0)
                        .then(function (data) {
                               vm.invoices = data.invoices;
                               vm.upcoming = data.upcoming;
                            });





                        vm.load_more = function(){
                            vm.current_offset = vm.current_offset + vm.loaded_per_batch;
                            PlaneService.GetUserJourneyLogs(vm.club.member.user_id, vm.club_id, vm.current_offset, vm.loaded_per_batch)
                            .then(function (data) {
                                    if(data.logs.length > 0){
                                        data.logs.forEach(log => vm.logs.push(log));
                                    } else {
                                        vm.all_loaded = true;
                                    }
                                   //vm.logs = data.logs;


                                });

                        }


                        vm.load_more_invoices = function(){
                            vm.current_invoice_offset = vm.current_invoice_offset + vm.loaded_per_batch;
                        UserService.GetInvoicesUserClub(vm.club.member.user_id, vm.club_id, vm.current_invoice_offset, vm.loaded_per_batch, 1)
                            .then(function (data) {
                                    if(data.invoices.length > 0){
                                        data.invoices.forEach(invoice => vm.invoices.push(invoice));
                                    } else {
                                        vm.all_invoices_loaded = true;
                                    }
                                   //vm.logs = data.logs;


                                });

                        }

                        vm.get_initial = function(text){
                            return text.charAt(0);
                        }

                        vm.clean_times = function(time){
                            if(time == "00:00:00"){
                                return " - ";
                            }
                            return time.substring(0,5);
                        }

                         $scope.get_hours_from_decimal = function(time){

                            if(time){
                                 var sign = time < 0 ? "-" : "";
                                 var hour = Math.floor(Math.abs(time));
                                 var min = Math.floor((Math.abs(time) * 60) % 60);
                                 if(min == 60){
                                     hour++;
                                     min = 0;
                                 }
                                 return sign + (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
                             } else {
                                 return "N/A";
                             }
                        }










                        vm.club.member.instructor = (vm.club.member.instructor == 1) ? true : false;
                        //vm.club.member.membership_start = Date.parse(vm.club.member.membership_start);
                        vm.page_title = "Edit a Member - "+vm.club.member.first_name+" "+vm.club.member.last_name;

                        vm.club.member.membership_start = new Date(vm.club.member.membership_start);

                        MemberService.GetMemberPlanes(vm.club.member.user_id, vm.club_id)
                        .then(function(data){
                            vm.club.planes = data;   
                            //console.log(vm.club.planes);
                        });

                        // $("#membership_start").datepicker({
                        //     format: 'dd-mm-yyyy',
                        //     startDate: vm.club.member.membership_start,
                        //     endDate: ''
                        //   }).on("show", function() {
                        //     $(this).val(new Date()).datepicker('update');
                        //   });

                    });

                 MembershipService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.memberships = data;   
                        // vm.club.member.membership_id.selected = vm.club.member.membership_id;
                        // vm.membership = vm.club.member.membership_name;
                        // vm.club.membership = vm.club.member.membership_name;
                        //console.log(vm.club.memberships);
                    });
            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                MemberService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.members = data;   
                        //console.log(vm.club.members);
                    });

                 MembershipService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.memberships = data;   
                        // vm.club.member.membership_id.selected = vm.club.member.membership_id;
                        // vm.membership = vm.club.member.membership_name;
                        // vm.club.membership = vm.club.member.membership_name;
                        //console.log(vm.club.memberships);
                    });
                $scope.checkAll = function () {
                    //console.log("check all");
                    if ($scope.selectedAll) {
                        $scope.selectedAll = true;
                    } else {
                        $scope.selectedAll = false;
                    }
                    angular.forEach(vm.club.members, function(member) {
                        member.selected = $scope.selectedAll;
                    });
                };


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $window.history.back();
        }

        $scope.save = function(){
            if(vm.action == "add"){
                // //console.log("CREATE click");
                $scope.create();
            } else {
                // //console.log("EDIT click");
                // //console.log(vm.club.membership);
                $scope.update();
            }
        }

        $scope.search = function(row){
            ////console.log("hi", (angular.lowercase(row.invoice_number).indexOf(angular.lowercase($scope.my_search) || '') !== -1));
            return ( (angular.lowercase(row.invoice_number).indexOf(angular.lowercase($scope.my_search) || '') !== -1) || 
                    (angular.lowercase(row.club_title).indexOf(angular.lowercase($scope.my_search) || '') !== -1) ||
                    (angular.lowercase(row.created_at.toString()).indexOf(angular.lowercase($scope.my_search) || '') !== -1) ||
                    (angular.lowercase(row.total.toString()).indexOf(angular.lowercase($scope.my_search) || '') !== -1) ||
                    (angular.lowercase(row.status).indexOf(angular.lowercase($scope.my_search) || '') !== -1) );
        };

        $scope.show_more = function(index){


            vm.invoices[index].show_more = (vm.invoices[index].show_more)? false : true;


        }


        // $scope.readCSV = function() {
        //     // http get request to read CSV file content
        //     $http.get('/angular/sample.csv').success($scope.processData);
        // };


        $scope.csvToJSON = function(content) {
                var lines=content.csv.split(/\r\n|\n/);
                var result = [];
                var start = 0;
                lines[0] += ",membership_id,membership_start,selected";
                for (var j=1; j<lines.length; j++) {
                    lines[j] += ",membership_id,membership_start,true";
                }
                var columnCount = lines[0].split(content.separator).length;

                var headers = [];
                if (content.header) {
                    headers=lines[0].split(content.separator);
                    vm.imported_headers = headers;
                    start = 1;
                }

                for (var i=start; i<lines.length; i++) {
                    var obj = {};
                        var currentline=lines[i].split(new RegExp(content.separator+'(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)'));
                        if ( currentline.length === columnCount ) {
                            if (content.header) {
                                for (var j=0; j<headers.length; j++) {
                                    obj[headers[j]] = currentline[j];
                                }
                            } else {
                                for (var k=0; k<currentline.length; k++) {
                                    obj[k] = currentline[k];
                                }
                            }
                            result.push(obj);
                        }
                   
                }

                //result = $scope.toPrettyJSON(result, 2);
                //console.log(result);

                return result;
            };

       
        vm.apply_default_memberships = function(){


             for(var b=0;b<vm.imported_users.length;b++){

                if(!vm.imported_users[b].membership || vm.imported_users[b].membership == {} || vm.imported_users[b].membership == ""){
                    vm.imported_users[b].membership_id = vm.default_membership.id;
                    vm.imported_users[b].membership = vm.default_membership;
                }
               
             }

        }


        function parseLooseDate(input, opts) {
          opts = opts || {};
          var prefer = opts.prefer || "DMY"; // default to UK style
          var useUTC = !!opts.utc;

          if (input == null) return null;

          // Already a Date?
          if (Object.prototype.toString.call(input) === "[object Date]") {
            return isNaN(input.getTime()) ? null : new Date(input.getTime());
          }

          // Timestamp?
          if (typeof input === "number" && isFinite(input)) {
            var dNum = new Date(input);
            return isNaN(dNum.getTime()) ? null : dNum;
          }

          var s = String(input).trim();
          if (!s) return null;

          // Try native ISO-ish first (safe formats like 2025-01-06, 2025-01-06T12:34:56Z)
          // BUT avoid native parsing for ambiguous slash formats like 01/02/2025.
          var looksAmbiguousSlash = /^\d{1,2}[\/. -]\d{1,2}[\/. -]\d{2,4}(\s+.*)?$/.test(s);
          if (!looksAmbiguousSlash) {
            var native = new Date(s);
            if (!isNaN(native.getTime())) return native;
          }

          // Normalize separators to "/"
          s = s.replace(/[.\-]/g, "/").replace(/\s+/g, " ").trim();

          // Split date and time
          var parts = s.split(" ");
          var datePart = parts[0];
          var timePart = parts.slice(1).join(" ").trim(); // ignore timezone words here

          var d = datePart.split("/");
          if (d.length !== 3) return null;

          // Parse ints
          var a = parseInt(d[0], 10);
          var b = parseInt(d[1], 10);
          var c = parseInt(d[2], 10);

          if (![a, b, c].every(function (n) { return isFinite(n); })) return null;

          // Expand 2-digit years (00-69 => 2000-2069, 70-99 => 1970-1999)
          function normalizeYear(y) {
            if (y >= 0 && y <= 99) return (y <= 69) ? (2000 + y) : (1900 + y);
            return y;
          }

          var year, month, day;

          // Detect yyyy/mm/dd (or yyyy/dd/mm if someone did that — we only accept yyyy first)
          if (d[0].length === 4) {
            year = a;
            month = b;
            day = c;
          } else if (d[2].length === 4) {
            year = c;
            // decide between DMY and MDY for a/b
            // If one is > 12, it's forced.
            if (a > 12 && b <= 12) { day = a; month = b; }
            else if (b > 12 && a <= 12) { month = a; day = b; }
            else {
              // ambiguous: both <= 12
              if (prefer === "MDY") { month = a; day = b; }
              else { day = a; month = b; } // DMY default
            }
          } else {
            // No 4-digit year found; accept 2-digit year at end
            year = normalizeYear(c);
            if (a > 12 && b <= 12) { day = a; month = b; }
            else if (b > 12 && a <= 12) { month = a; day = b; }
            else {
              if (prefer === "MDY") { month = a; day = b; }
              else { day = a; month = b; }
            }
          }

          // Basic range checks
          if (!(year >= 1 && year <= 9999)) return null;
          if (!(month >= 1 && month <= 12)) return null;
          if (!(day >= 1 && day <= 31)) return null;

          // Time (optional)
          var hh = 0, mm = 0, ss = 0;
          if (timePart) {
            // accept HH:mm or HH:mm:ss (ignore trailing timezone text)
            var mTime = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (mTime) {
              hh = parseInt(mTime[1], 10);
              mm = parseInt(mTime[2], 10);
              ss = mTime[3] ? parseInt(mTime[3], 10) : 0;
              if (hh > 23 || mm > 59 || ss > 59) return null;
            }
          }

          // Construct date
          var dt = useUTC
            ? new Date(Date.UTC(year, month - 1, day, hh, mm, ss, 0))
            : new Date(year, month - 1, day, hh, mm, ss, 0);

          // Validate (catches invalid dates like 31/02/2025)
          var y2 = useUTC ? dt.getUTCFullYear() : dt.getFullYear();
          var m2 = (useUTC ? dt.getUTCMonth() : dt.getMonth()) + 1;
          var d2 = useUTC ? dt.getUTCDate() : dt.getDate();

          if (y2 !== year || m2 !== month || d2 !== day) return null;

          return dt;
        }

        vm.change_header = function(index, h){
           
            if(vm.imported_new_headers[index] == "membership_start"){



                for(var b=0;b<vm.imported_users.length;b++){

                    try{
                       var parse_me =  parseLooseDate(vm.imported_users[b][h]);
                      // console.log("value: ", parse_me.toISOString());
                       if(!vm.imported_users[b].membership_start || vm.imported_users[b].membership_start == {} || vm.imported_users[b].membership_start == "" || !vm.imported_users[b].membership_start.getTime()){
                           //console.log(vm.imported_users[b].membership_start.getTime());
                           vm.imported_users[b].membership_start = new Date(parse_me.toISOString());
                       }

                    } catch(e){
                        console.log("didnt parse, ", e);
                    }
                    
                
                }
            }

        }

        vm.apply_default_start = function(){




             

        }

        function stripDoubleQuotes(str) {
          if (typeof str !== 'string') return str;
          return str.replace(/"/g, '');
        }

        $scope.processData = function() {
            //get the stuff
            //allText = vm.import_users;
            var tobesorter = {
                csv: vm.import_users,
                separator: ",",
                header: true
            }
            var test_mode = true;
            var test_e = "a";
            var test_mail = "@toaviate.com";

            vm.imported_users = $scope.csvToJSON(tobesorter);

             for(var b=0;b<vm.imported_users.length;b++){



                if(test_mode){
                   vm.imported_users[b].matching = vm.imported_users[b].email;
                   vm.imported_users[b].email = test_e + b + test_mail;
                }


                if(vm.imported_users[b].membership_start){
                    vm.imported_users[b].membership_start = new Date(vm.imported_users[b].membership_start);
                } else {
                    vm.imported_users[b].membership_start = new Date();
                }


                
                //below set the default membership perhaps?





                //vm.imported_users[b].membership = { membership_id: 4, membership_name: "Annual Membership" };
            }

            // split content based on new line
            // var allTextLines = allText.split(/\r\n|\n/);
            // var headers = allTextLines[0].split(',');
            // var lines = [];

            // for ( var i = 0; i < allTextLines.length; i++) {
            //     // split content based on comma
            //     var data = allTextLines[i].split(',');
            //     if (data.length == headers.length) {
            //         var tarr = [];
            //         for ( var j = 0; j < headers.length; j++) {
            //             tarr.push(data[j]);
            //         }
            //         lines.push(tarr);
            //     }
            // }
            // $scope.data = lines;
        };
       

        vm.user_columns = {
            first_name: "First Name", 
            last_name: "Last Name", 
            email: "Email Address",
            dob: "Date of Birth",
            membership_number: "Membership Number", 
            membership_start: "Membership Start Date",
            membership_id: "Membership Name",
            matching_email: "Matching Email"
        };


        $scope.import_column = function(name){
            // //console.log("update the field");
            // for(var i = 0; i < vm.imported_users.length; i++){
            //     var original_val = vm.imported_users[i][name];
            //     delete vm.imported_users[i][name];
            //     vm.imported_users[i][vm.change_col_to] = original_val;
            //     //console.log(vm.imported_users[i]);
            // }

        }

        vm.member_check = [];

        function check_member_requirements(){

            var poid = 0;
            var medical = 0;
            var licence = 0;
            var differences = 0;
            for(var i=0;i<vm.member_check.length;i++){


                var a = vm.member_check[i].type;

                switch(a){
                    case 'poid':
                        poid++;
                    break;
                    case 'medical':
                        medical++;
                    break;
                    case 'licence':
                        licence++;
                    break;
                    case 'difference':
                        difference++;
                    break;
                }
            }   

            if(poid > 0 && medical > 0 && licence > 0){
                //TODO
                //then we now need to check if they're not expired?
                //then we know that the user is actually 100% valid.

                vm.club.member.approved = 1;

            }

        }


        $scope.update_verification = function(type, obj, val){

            //console.log("UPDATE VERIFICATION ON : "+type+" WITH obj: ", obj);
            vm.member_check.push({"type": type, "obj": obj});

            var verify = {
                "check_type": type,
                "user_id": vm.club.member.user_id,
                "club_id": vm.club_id,
                "check_id": obj.id,
                "verified": val
            };

            MemberService.Verify(verify)
                .then(function(data){
                    // //console.log(data);
            });

            //call the put request here

            check_member_requirements();

        }


        $scope.import_users = function(){
            //console.log("import some users now");


            //first let's ignore the ones that weren't in the list
            vm.imported_users = $.grep(vm.imported_users, function(e){ 
                    return e.selected != "false"; 
            });

           
            // //console.log(vm.imported_users);
            // //console.log(vm.imported_headers);
            // //console.log(vm.imported_new_headers);

            //we need to verify that at least first name and last name in addition to email is present in the columns selected.
            if(vm.imported_new_headers.indexOf("first_name") > -1 && vm.imported_new_headers.indexOf("last_name") > -1 && vm.imported_new_headers.indexOf("email") > -1){
                // //console.log("ALL HEADERS HERE ! YAY!");
                
                for(var b=0;b<vm.imported_users.length;b++){
                    if(vm.imported_users[b].membership){
                        if(vm.imported_users[b].membership.membership_id){
                            vm.imported_users[b]["membership_id"] = vm.imported_users[b].membership.id;
                            delete vm.imported_users[b].membership;
                        }
                    }
                }

                // //console.log("===--->===");
                // //console.log(vm.imported_users);
                // //console.log("===--->===");

                vm.imported_new_headers.push("membership_id");
                vm.imported_new_headers.push("membership_start");

                //now we generate the users with the correct headings for our tables
                var to_import_users = [];
                for(var d=0; d<vm.imported_users.length;d++){
                    var obj = {
                        user: {},
                        club_id: vm.club_id
                    };
                    for(var c=0; c<vm.imported_new_headers.length;c++){
                        if(vm.imported_new_headers[c]){
                            // //console.log(vm.imported_new_headers[c]);
                            if(vm.imported_new_headers[c] == "first_name" || vm.imported_new_headers[c] == "last_name" || vm.imported_new_headers[c] == "dob" || vm.imported_new_headers[c] == "email"){
                                obj["user"][vm.imported_new_headers[c]] = vm.imported_users[d][Object.keys(vm.imported_users[d])[c]];
                            } else {
                                if(vm.imported_new_headers[c] == "membership_start" || vm.imported_new_headers[c] == "membership_id"){
                                    obj[vm.imported_new_headers[c]] = vm.imported_users[d][vm.imported_new_headers[c]];
                                } else {
                                    obj[vm.imported_new_headers[c]] = vm.imported_users[d][Object.keys(vm.imported_users[d])[c]];
                                }
                            }
                            //we can push this into a new object with new key!
                        } else {
                            //we ignore this one...
                            //console.log("blank");
                        }
                    }
                    to_import_users.push(obj);
                }
                // //console.log("--==--");
                // //console.log(to_import_users);
                // //console.log("--==--");

                //now that we have what we want to add to our 
                MemberService.CreateMany(to_import_users)
                .then(function(data){
                    // //console.log(data);
                    $state.go('dashboard.manage_club.members');
                });

            } else {
                //console.log("missing key elements in headers!");
                ToastService.warning('Missing Fields', 'You must select the First Name, Last Name and Email Address to be able to add the user to the system!');
            }
        


        }

        vm.sa_dual = false;
        vm.sa_solo = false;
        vm.sa_instruct = false;

        vm.select_all = function(select_all_what){
            if(select_all_what == "dual"){
                for(var i = 0; i < vm.club.planes.length; i++){
                    vm.club.planes[i].book_dual = 1;
                    vm.sa_dual = true;
                }
            } else if(select_all_what == "solo"){
                for(var i = 0; i < vm.club.planes.length; i++){
                    vm.club.planes[i].book_solo = 1;
                    vm.sa_solo = true;
                }
            } else if(select_all_what == "instruct"){
                for(var i = 0; i < vm.club.planes.length; i++){
                    vm.club.planes[i].instruct = 1;
                    vm.sa_instruct = true;
                }
            }
        }

        vm.deselect_all = function(select_all_what){
            if(select_all_what == "dual"){
                for(var i = 0; i < vm.club.planes.length; i++){
                    vm.club.planes[i].book_dual = 0;
                    vm.sa_dual = false;
                }
            } else if(select_all_what == "solo"){
                for(var i = 0; i < vm.club.planes.length; i++){
                    vm.club.planes[i].book_solo = 0;
                    vm.sa_solo = false;
                }
            } else if(select_all_what == "instruct"){
                for(var i = 0; i < vm.club.planes.length; i++){
                    vm.club.planes[i].instruct = 0;
                    vm.sa_instruct = false;
                }
            }
        }



        $scope.create = function(){
            //console.log("CREATE ME NOW");
            vm.club.member.club_id = vm.club_id;
            MemberService.Create(vm.club.member)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.members');
                });
        }

        // Helper function to clear error highlight when field is focused
        vm.clearFieldError = function(event) {
            if (event && event.target) {
                event.target.classList.remove('field-error-highlight');
            }
            // Also check parent for ui-select wrapper
            var parent = event.target.closest('.field-error-highlight');
            if (parent) {
                parent.classList.remove('field-error-highlight');
            }
        };

        // Helper function to highlight and scroll to invalid field
        function highlightAndScrollTo(fieldId) {
            // Clear any previous highlights
            var highlighted = document.querySelectorAll('.field-error-highlight');
            for (var i = 0; i < highlighted.length; i++) {
                highlighted[i].classList.remove('field-error-highlight');
            }
            
            // Find and highlight the field
            var field = document.getElementById(fieldId);
            if (field) {
                field.classList.add('field-error-highlight');
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                field.focus();
            }
        }

        //this should be admin / instructor only
        $scope.invite_member = function(){

                // Validation checks
                var first_name = vm.club.member.user && vm.club.member.user.first_name ? vm.club.member.user.first_name.trim() : '';
                var last_name = vm.club.member.user && vm.club.member.user.last_name ? vm.club.member.user.last_name.trim() : '';
                var email = vm.club.member.user && vm.club.member.user.email ? vm.club.member.user.email.trim() : '';

                if (!first_name) {
                    ToastService.error('Validation Error', 'First name is required');
                    highlightAndScrollTo('first_name');
                    return;
                }

                if (!last_name) {
                    ToastService.error('Validation Error', 'Last name is required');
                    highlightAndScrollTo('last_name');
                    return;
                }

                if (!email) {
                    ToastService.error('Validation Error', 'Email is required');
                    highlightAndScrollTo('email');
                    return;
                }

                if (!vm.club.member.membership_id) {
                    ToastService.error('Validation Error', 'Please select a membership');
                    highlightAndScrollTo('membership_select_wrapper');
                    return;
                }

                if (!vm.club.member.membership_start) {
                    ToastService.error('Validation Error', 'Membership start date is required');
                    highlightAndScrollTo('membership_start');
                    return;
                }

                // If membership is free (£0), force payment_now to true
                if (vm.club.selected_membership && vm.club.selected_membership.price == 0) {
                    vm.club.member.payment_now = true;
                }

                vm.club.member.club_id = vm.club_id;

                MemberService.send_invite_by_club(vm.club.member)
                    .then(function(data){
                        ////console.log(data);
                        $state.go('dashboard.manage_club.members');
                    });

        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this membership?');
            MemberService.Update(vm.club.membership)
                .then(function(data){
                   // //console.log(data);
                });
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.member.club_id = vm.club_id;

            var process_member_start_dt = new Date(vm.club.member.membership_start);
            if(!process_member_start_dt.isValid){
                process_member_start_dt = new Date();
            }


            vm.club.member.membership_start = process_member_start_dt; //.toISOString().split('T')[0];
           
            // console.log(vm.club.member);
            // return false;

            MemberService.Update(vm.club.member)
                        .then(function(data){
                            // //console.log(data);
                            // //console.log("saved");
                            $state.go('dashboard.manage_club.members');
                        });
                        
            MemberService.SaveMemberPlanes(vm.club.member.user_id, vm.club.member.club_id, vm.club.planes)
                .then(function(data){
                    ////console.log(data);
                    // //console.log("saved THE PLANES");
                     
                });

                //         function SaveMemberPlanes(user_id, club_id, planes){

        }

        function refresh_members(){

             MemberService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.members = data;   
                        
                        MembershipService.GetAllByClub(vm.club_id)
                        .then(function(data){
                            vm.club.memberships = data;   
                            return true;
                        });

                    });

            
        }


        vm.select_member_approval = false;
        $scope.selected_members = function(type){
            //get the selected members
            if(vm.select_member_approval){
                return false;
            }
            vm.show_loading = true;
            vm.select_member_approval = true;

            //console.log(vm.club.members);
            vm.selected_members = $.grep(vm.club.members, function(e){ 
                return e.selected == true; 
            });
            console.log(vm.selected_members);

            //type is the action required...
            

            for(var j=0;j < vm.selected_members.length; j++){

                if(type == "approve"){
                    vm.selected_members[j].approved = 1;
                } else {
                    vm.selected_members[j].approved = 0;
                }
                //console.log("here");
                MemberService.Update(vm.selected_members[j])
                    .then(function(data){
                        //console.log(data);
                        //console.log("saved");
                    });
            }
            console.log("refresh members");
            //vm.club.members = [];
            setTimeout(() => {  

                MemberService.GetAllByClub(vm.club_id)
                .then(function(data){
                    vm.club.members = data;   
                    console.log(vm.club.members);
                    MembershipService.GetAllByClub(vm.club_id)
                    .then(function(data){
                        vm.club.memberships = data;   
                        vm.select_member_approval = false;
                        vm.show_loading = false;
                        //$state.go('dashboard.manage_club.members');
                    });

                });

            }, 1000);

            


            // if(refresh_members()){
            //     vm.select_member_approval = false;
            //     vm.show_loading = false;
            // } else {
            //     alert("We failed to update the approval state of the member - please refresh this page");
            // }

            

        }

        $scope.update_membership = function(item, model){
            vm.club.member.membership_id = item.membership_id;
            vm.club.member.membership_name = item.membership_name;
            vm.club.selected_membership = item; // Store full item to check price
        }

        initController();

        function initController() {
           //console.log("check if access is okay");
        }


        var warning_msg = "By deleting this membership, you will also cancel all reservations that this membership currently has."


        function actually_open(id, params, document_type, document_id){



             var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/check_documents.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function() {
                  return id;
                },
                params: function() {
                  return params;
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });


            modalInstance.result.then(function (params) {
              $log.info('PRESSED GO: ', params);
              // alert("verified");


               for(var i=0; i<vm[document_type].length; i++){
                        // //console.log("ID", vm[document_type][i].id);
                        // //console.log("VERI", vm[document_type][i].verified);
                        // //console.log("DOCU", document_id);
                        if(vm[document_type][i].id == document_id && vm[document_type][i].verified != 1){
                            // //console.log("CHECK BELOW : ", vm[document_type][i]["verified"]);
                            // if(vm.poids[i].verified == 0){
                                vm[document_type][i].verified = 1;
                                // //console.log("HERE");
                                var action_name = (document_type == "differences")? "differences" : document_type.slice(0, -1);
                                $scope.update_verification(action_name, vm[document_type][i], 1);
                            // }
                        }
                    }   

              switch(document_type){
                case 'poids':
                    // vm.poids[0].verified = 0; 
                    // for(var i=0; i<vm.poids.length; i++){
                    //     //console.log("ID", vm.poids[i].id);
                    //     //console.log("VERI", vm.poids[i].verified);
                    //     if(vm.poids[i].id == document_id && vm.poids[i].verified != 1){
                    //         //console.log("CHECK BELOW : ", vm.poids[i]["verified"]);
                    //         // if(vm.poids[i].verified == 0){
                    //             vm.poids[i].verified = 1;
                    //             $scope.update_verification('poid', vm.poids[i], 1);
                    //         // }
                    //     }
                    // }   

                break;
                case 'medicals':


                break;
                case 'licences':

                break;
                case 'differences':

                break;
                default:
                    ToastService.error('Unknown Request', "Sorry - we didn't recognise the request");
                break;
            }


            }, function () {
              //alert("CLOSED");
              $log.info('Modal dismissed at: ' + new Date());
            });



        }


            vm.show_temp_login = false;
            vm.show_loading = false;


        function create_sample(length) {
                   var result           = '';
                   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                   var charactersLength = characters.length;
                   for ( var i = 0; i < length; i++ ) {
                      result += characters.charAt(Math.floor(Math.random() * charactersLength));
                   }
                   return result;
                }


                $scope.re_login = function(){


                      ////console.log("CLICKED", vm.re_login_pass);

                      //now we use the token that has been assigned already to verify the login password

                        AuthenticationService.Login3(vm.re_login_pass, create_sample(120), function (response) {
                            //console.log("resp", response);
                            if (response.success) {


                                //we now need to call the query that was called before (decryption)

                                //$scope.getDecrypted();
                               $scope.openDocument(vm.maybe.doc_type, vm.maybe.doc_id);



                                vm.show_temp_login = false;
                            } else {
                                ToastService.error('Wrong Password', 'This is the wrong password - please try again');
                            }
                        });



                      //vm.show_temp_login = true;

                  }



        $scope.openDocument = function(document_type, document_id) {

            vm.show_loading = true;

            var id = document_id;
            //document type : poids, medicals, licences, differences
            var images = [];
            switch(document_type){
                case 'poids':
                    //console.log("PROOF OF ID CHECK FOR ID: ", document_id);

                    PoidService.GetById(document_id, 0, 1)
                        .then(function (data) {
                            ////console.log(data);
                            if(data.success){
                                ////console.log("DATA RTN", data);
                                images = data.poid.images;

                                var params = {
                                    document_type: document_type,
                                    document_id: document_id,
                                    images: images
                                };
                                    vm.show_loading = false;

                                actually_open(id, params, document_type, document_id);
                            } else {
                                //this should be very very rare...


                                if(data.fail == "templogin"){
                                    ////console.log("WOOOPSIES...", data);
                                    vm.show_temp_login = true;
                                     vm.maybe = {
                                         doc_type: "poids",
                                         doc_id: document_id
                                     }

                                }
                                    vm.show_loading = false;



                            }
                    });

                break;
                case 'medicals':
                    ////console.log("MEDICAL CHECK FOR ID: ", document_id);

                    // MedicalService.GetById(document_id, vm.club.member.user_id)
                    MedicalService.GetById(document_id, 0, 1)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("DATA RTN", data);
                                images = data.medical.images;

                                var params = {
                                    document_type: document_type,
                                    document_id: document_id,
                                    images: images
                                };
                                    vm.show_loading = false;

                                actually_open(id, params, document_type, document_id);
                            } else {
                                ////console.log("WOOOPSIES...");
                                //this should be very very rare...

                                    vm.show_loading = false;

                                 vm.maybe = {
                                     doc_type: "medicals",
                                     doc_id: document_id
                                 }

                                if(data.fail == "templogin"){
                                    //console.log("WOOOPSIES...", data);
                                    vm.show_temp_login = true;
                                     vm.maybe = {
                                         doc_type: "medicals",
                                         doc_id: document_id
                                     }

                                }


                            }
                    });

                break;
                case 'licences':
                    //console.log("LICENCE CHECK FOR ID: ", document_id);
                    LicenceService.GetById(document_id, 0, 1)
                        .then(function (data) {
                            //console.log(data);
                            if(data.success){
                                //console.log("DATA RTN", data);
                                images = data.licence.images;

                                var params = {
                                    document_type: document_type,
                                    document_id: document_id,
                                    images: images
                                };
                                    vm.show_loading = false;

                                actually_open(id, params, document_type, document_id);
                            } else {
                                //console.log("WOOOPSIES...");
                                //this should be very very rare...
                                    vm.show_loading = false;


                                if(data.fail == "templogin"){
                                    //console.log("WOOOPSIES...", data);
                                    vm.show_temp_login = true;

                                     vm.maybe = {
                                         doc_type: "licences",
                                         doc_id: document_id
                                     }

                                }


                            }
                    });

                break;
                case 'differences':
                    //console.log("DIFFERENCES CHECK FOR ID: ", document_id);

                                var params = {
                                    document_type: document_type,
                                    document_id: document_id,
                                    images: vm.differences_images
                                };
                                //console.log("DOCUMENT ID ", document_id);
                                    vm.show_loading = false;
                                actually_open(id, params, document_type, document_id);

                break;
                default:
                                    vm.show_loading = false;
                    ToastService.error('Unknown Request', "Sorry - we didn't recognise the request");
                break;
            }




           
        };

        $scope.downloadInvoice = function(id) {
            // var data = $.param({
            //     id: doc
            // });

            //var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/invoice_pdf/get_ad_hoc_invoice/'+id, {
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
        

        $scope.open = function (member_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return member_id;
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });


            modalInstance.result.then(function (member_id) {
              $log.info('PRESSED GO: '+member_id);
              MemberService.Delete(member_id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.members = $.grep(vm.club.members, function(e){ 
                    return e.id != member_id; 
                });
              })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

         


    }