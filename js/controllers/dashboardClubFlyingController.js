 app.controller('DashboardClubFlyingController', DashboardClubFlyingController);

    DashboardClubFlyingController.$inject = ['UserService', 'MemberService', 'MembershipService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'PoidService',  'LicenceService', 'MedicalService', 'DifferencesService', 'AuthenticationService', '$http', 'PaymentService', 'PackageService', 'BookoutService'];
    function DashboardClubFlyingController(UserService, MemberService, MembershipService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, PoidService,  LicenceService, MedicalService, DifferencesService, AuthenticationService, $http, PaymentService, PackageService, BookoutService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        vm.club.member = {};
                                vm.club.member.payment_now = true;

        vm.imported_new_headers = [];

        // vm.club.member.membership_id = {};

        vm.test = "Package valid until 12/03/2022<br /> To be used on:<br /> G-BOOF <br /> G-OARU";
        
        vm.action = $state.current.data.action;

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.no_show_cols = ["membership_start", "membership_id", "selected"];


        $scope.sortType     = 'Email'; // set the default sort type
        $scope.sortReverse  = false;  // set the default sort order
        $scope.searchTool   = '';     // set the default search/filter term

        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);


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

                       
            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id

                //incomplete_club

                PlaneService.GetIncompleteClub(vm.club_id)
                    .then(function(data){
                        vm.club.flights = data.bookouts;
                        // vm.club.member.membership_id.selected = vm.club.member.membership_id;
                        // vm.membership = vm.club.member.membership_name;
                        // vm.club.membership = vm.club.member.membership_name;
                        // //console.log(vm.club.memberships);
                    });


                

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
                                     if(flight_obj.booking.instructor_nok.noks.length > 0){
                                         for(var j=0;j<flight_obj.booking.instructor_nok.noks.length;j++){
                                             nok2 = nok2 + "<br />Emergency Contact ("+(j+1)+"): <br />"+flight_obj.booking.instructor_nok.noks[j].first_name+ " " +flight_obj.booking.instructor_nok.noks[j].last_name + " <br />relationship: "+flight_obj.booking.instructor_nok.noks[j].relationship+"<br />t: "+flight_obj.booking.instructor_nok.noks[j].phone_number+ " <br /> e: "+flight_obj.booking.instructor_nok.noks[j].email_address+"<br />";
                                         }
                                     } 

                                    pax = pax + "<br /><span class='bolder'>Instructor Present</span> <br /> "+flight_obj.booking.instructor.first_name+" "+flight_obj.booking.instructor.last_name+" <br /> "+nok2;
                                }
                            if(flight_obj.user_id > 0){
                                    
                                    var nok1 = "";
                                     if(flight_obj.booking.user_nok.noks.length > 0){
                                         for(var j=0;j<flight_obj.booking.user_nok.noks.length;j++){
                                             nok1 = nok1 + "<br />Emergency Contact ("+(j+1)+"): <br />"+flight_obj.booking.user_nok.noks[j].first_name+ " " +flight_obj.booking.user_nok.noks[j].last_name + " <br />relationship: "+flight_obj.booking.user_nok.noks[j].relationship+"<br />t: "+flight_obj.booking.user_nok.noks[j].phone_number+ " <br /> e: "+flight_obj.booking.user_nok.noks[j].email_address+"<br />";
                                         }
                                     } 

                                    // var nok1 = "<br /><br />Emergency Contact ("+(j+1)+"): <br />"+flight_obj.passengers[i].nok[j].first_name+ " " +flight_obj.passengers[i].nok[j].last_name + " <br />relationship: "+flight_obj.passengers[i].nok[j].relationship+"<br />t: "+flight_obj.passengers[i].nok[j].phone_number+ " <br /> e: "+flight_obj.passengers[i].nok[j].email_address+"<br />";
                                    pax = pax + "<br /><span class='bolder'>Member Present</span><br />"+flight_obj.booking.user.first_name+ " " +flight_obj.booking.user.last_name + " <br />"+nok1;
                            }
                            return pax;

                            // var b = '<accordion close-others="oneAtATime"> <accordion-group heading="Static Header, initially expanded" is-open="true"> This content is straight in the template. </accordion-group> <accordion-group heading="TITLE" ng-repeat="group in groups"> Some content here </accordion-group> <accordion-group heading="Dynamic Body Content"> <p>The body of the accordion group grows to fit the contents</p> <button class="btn btn-default btn-sm" ng-click="addItem()">Add Item</button> <div ng-repeat="item in items">{{item}}</div> </accordion-group> <accordion-group is-open="isopen"> <accordion-heading> I can have markup, too! <i class="pull-right glyphicon" ng-class="{\'glyphicon-chevron-down\': isopen, \'glyphicon-chevron-right\': !isopen}"></i> </accordion-heading> This is just some content to illustrate fancy headings. </accordion-group> </accordion>';
                            // return b;
                        }






            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $window.history.back();
        }

        vm.load_adsb = function(icao_hex){
            var httpPath = "https://globe.adsbexchange.com/?icao="+icao_hex;
            window.open(httpPath, '_blank', '');
        }


        vm.cancel_bookout = function(id){

            var a = confirm("Please confirm you wish to cancel the bookout.");
            if(a){
                BookoutService.CancelBookout(id)
                 .then(function(data){

                     if(data.success){

                       //load_bookings();
                        PlaneService.GetIncompleteClub(vm.club_id)
                            .then(function(data){
                                vm.club.flights = data.bookouts;
                            });

                     } else {
                         alert(data.message);
                     }
                                                
                    });
            }

        }

         


    }