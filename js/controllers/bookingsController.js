 app.controller('BookingsController', BookingsController);

    BookingsController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'InstructorCharges', 'CourseService', 'ToastService'];
    function BookingsController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, InstructorCharges, CourseService, ToastService) {
        
        var vm = this;
        var defaultStartTime = 480;
        var defaultEndTime = 1080;

        $scope.va1 = '123';
        

        vm.user = $rootScope.globals.currentUser;

        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        vm.club.member = {};
        
        vm.imported_new_headers = [];
        vm.see_booking = {};

        vm.is_current = false;
        vm.currency_type = "";
        vm.currency_days = "";

        vm.booking_self = true;

        vm.times_clean_type = "start_times";


        // vm.club.member.membership_id = {};
        
        vm.action = $state.current.data.action;
        vm.return_to = $state.current.data.return_to;
        vm.club_id = 0;

        //just in case i missed a changed value...
        vm.user_id = vm.user.id;

        vm.no_show_cols = ["membership_start", "membership_id", "selected"];

        var newDate = new Date();
        
        var h_start = Math.floor( defaultStartTime / 60 );          
        var i_start = defaultStartTime % 60;
        var h_end = Math.floor( defaultEndTime / 60 );          
        var i_end = defaultEndTime % 60;

        var defaultStart = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_start, i_start, 0);
        var defaultEnd = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_end, i_end, 0);
        vm.default_date =  new Date();

        vm.datepickerOptions = {
            customClass: getDayClass,
            format: 'dd/MM/yyyy',
            showWeeks: false
        }

        vm.dateTimeRangePickerOptions = {
            hour_step: 1,
            minute_step: 30,
            min_date: today,
            datepicker:{
                customClass: getDayClass,
                format: 'dd/MM/yyyy',
                showWeeks: false,
                minDate: today
            }
            ,
            business_hours: {
                from: "09:00",
                to: "22:30"
            }
        };

        $scope.whole_day_booking = false;


        // BookingService.GetAll(vm.user.id, moment().format("Y-M-D"), "")
        //     .then(function(data){
        //         $scope.all_events = data.events;
        //         $scope.all_resources = data.resources;
        //     });


        vm.instructor_charges = [];




        vm.cancellation = { 
                            reasons: [
                                "Pilot Unwell",
                                "Pilot Unavailable",
                                "Weather at home base",
                                "Weather at destination",
                                "Plane Unavailable",
                                "Plane Unserviceable",
                                "Plane Returned Too Late by previous booking",
                                "Instructor Not Available",
                                "Airfield Closed",
                                "Airspace Closed",
                                "Other - please specify"
                            ],
                            notes: ""
                        };



        var today = new Date();
        today.setMinutes(0);
        today.setSeconds(0);
        var end = moment(today);
        end.add(2, "hours");
        end = new Date(end);
        end.setSeconds(0);

        var datepicker_today = new Date().format("d/M/yyyy");


        vm.start_times = [];
        vm.end_times = [];

        vm.new_booking = {
            start_date: today,
            end_date: today,
            free_seats: [],
            passengers: [],
            options: vm.dateTimeRangePickerOptions
        };

        $scope.toggle = true;
        $scope.whentimechangedata = {};
        $scope.overridePicker = true;

        var date = Date();
        vm.planes = [];
        init_times();

      $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
      $scope.format = $scope.formats[0];
        //prepare_add_edit();


       


        switch(vm.action){
            case "add":
                //console.log("adding a new member please");
                vm.page_title = "Add a Booking";

                //update_bookings();

                vm.new_booking = {
                                    start_date: today,
                                    end_date: today,
                                    free_seats: [],
                                    passengers: [],
                                    options: vm.dateTimeRangePickerOptions
                };
                figure_out_steps();





            break;
            case "edit":
                vm.page_title = "Edit a Booking";
                //console.log("edit an existing booking");

                vm.see_booking.visible = 0;

                // vm.default_date = new Date("2016-10-11");
                vm.new_booking = {
                                    start_date: today,
                                    end_date: today,
                                    free_seats: [],
                                    passengers: [],
                                    options: vm.dateTimeRangePickerOptions
                };
                figure_out_steps();
                //vm.new_booking.
                //get a single events
                
                update_bookings();

                if($stateParams.booking_id){



                     BookingService.GetEdit(vm.user.id, $stateParams.booking_id)
                        .then(function(data){
                            //console.log("GETTING CONTENT FROM EDIT : ", data);

                            if(data.success){


                                //console.log("EDIT THIS CONTENT HERE", data);
                                //console.log("CHECK CONTENT FROM RETURN", data.booking.instructor);

                                vm.new_booking = data.booking;
                                //console.log("MY INSTRUCTOR HERE: ", vm.new_booking.instructor);
                                vm.new_booking.options = vm.dateTimeRangePickerOptions;
                                vm.new_booking.edit_booking = 1;

                                vm.new_booking.start_date = new Date(vm.new_booking.start);
                                // vm.new_booking.start_time = {time: moment(vm.new_booking.start).format("HH:mm"), disabled: 1};
                                vm.new_booking.start_time = {time: moment(vm.new_booking.start).format("HH:mm")};
                                vm.new_booking.end_date = new Date(vm.new_booking.end);
                                vm.new_booking.end_time = {time: moment(vm.new_booking.end).format("HH:mm")};

                                vm.new_booking.after_booking_end = moment().isAfter(moment(vm.new_booking.end));
                                
                                //vm.default_date = new Date(vm.new_booking.start);
                                
                                
                                if(vm.new_booking.instructor && vm.new_booking.instructor.id == vm.user_id){
                                    vm.booking_self = false;
                                }


                                 //this will require breaking up quite a bit... but to access the parent one...
                                $scope.$parent.vm.default_date =  vm.new_booking.start_date;
                                setTimeout(function(){
                                    $scope.$parent.vm.see_booking.visible = 0;
                                    $scope.$apply();



                                }, 1000);

                                // //console.log("DEFAULT", vm.default_date);                               

                                generate_datetimes();

                                $scope.update_dateTime("edit");
                                
                                // //console.log("EDIT", vm.new_booking);
                                // //console.log("=== CHECK AT EDIT", vm.new_booking.instructor);
                                

                                // InstructorCharges.GetByClubId(vm.new_booking.club_id)
                                //     .then(function(data){

                                //         vm.instructor_charges = data.items;  
                                //         // //console.log("====> ", data); 
                                //     });

                                //vm.courses

                                CourseService.GetCoursesByClubId(vm.new_booking.club_id)
                                .then(function(data){
                                    vm.courses = data.items;   
                                });



                                //get all the club members by first and last name and email --> nothing else
                                //this would only include the members that are for the plane that was selected....


                                ////console.log("BEFORE GET", vm.new_booking.end_time);
                                prepare_add_edit(vm.new_booking.club_id, vm.new_booking.end);



                                if(vm.new_booking.rental_items){
                                    //then we may have shizzle to check / update
                                    for(var i=0;i<vm.new_booking.rental_items.length;i++){
                                        //first and foremost we need to check the available bits....
                                        // //console.log("NO TO BOOK: "+vm.new_booking.rental_items[i]["number_to_book"]);
                                        vm.new_booking.rental_items[i]["number_to_book"] = parseInt(vm.new_booking.rental_items[i]["number_to_book"]);
                                    }
                                }

                                if(vm.new_booking.free_seats){
                                    // //console.log("FREE", vm.new_booking.free_seats);
                                    vm.new_booking.free_seats = parseInt(vm.new_booking.free_seats);
                                }

                                if(vm.new_booking.instructor){
                                    // //console.log("MY INSTRUCTOR HERE22: ", vm.new_booking.instructor);

                                }




                                if((vm.club_id == 0 || !vm.club_id) && vm.new_booking.plane && vm.new_booking.plane.id){
                                    vm.club_id = vm.new_booking.plane.club_id;
                                }

                                free_places();
                                
                                // //console.log("MY INSTRUCTOR HERE2244: ", vm.new_booking.instructor);

                            } else {
                                ToastService.error('Booking Error', data.message);
                                $state.go('dashboard.bookings.add');
                            }

                        });


                }
               


               
            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                // //console.log("VM", vm);
                // //console.log("VM", $stateParams);

                //alert("LIST");
                //alert(moment($stateParams.start).add(1, "hour").format("HH:mm"));

             


                vm.show_no_membership_message = false;
                vm.hide_dropdown = false; 
                vm.clubs = [];

                //we need to get the memberships that the user is a member of....
                MemberService.GetUserClubs(vm.user.id)
                 .then(function(data){
                        vm.clubs = data.clubs;

                        //console.log("CLUBS HERE : ", data);

                        if(vm.clubs && vm.clubs.length > 1){
                            vm.hide_dropdown = true;
                        } else if(vm.clubs.length == 1) {
                            vm.club_id = vm.clubs[0].id;
                            // //console.log("SETTING THE CLUB ID HERE:: ", vm.club_id);
                        }
                    
                        update_bookings();

                    });
                 
                 //generate_datetimes();

                //  BookingService.GetAllPlanes(vm.user.id, moment(vm.new_booking.start_datetime).format("Y-M-D HH:mm"), moment(vm.new_booking.end_datetime).format("Y-M-D HH:mm"), 0, 0)
                // .then(function(data){
                   
                //     vm.planes = data;
                //     // //console.log("PLANES NOW SET", vm.planes);
                //     if($stateParams.plane_id){
                //         // //console.log("plane_id", $stateParams.plane_id);
                //         for(var i=0;i<vm.planes.length;i++){
                //             // //console.log("I", i);
                //             // //console.log("id 1", vm.planes[i].id);
                //             // //console.log("I", i);
                //             if(parseInt(vm.planes[i].id) == $stateParams.plane_id){
                //                 vm.new_booking.plane = vm.planes[i];
                //                 // //console.log("found", vm.planes[i]);
                //             }
                //         }

                //     }

                // });

            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  



        function getAllPlaneUpdate(){
            check_times();
            //$scope.update_dateTime('edit');
             // BookingService.GetAllPlanes(vm.user.id, vm.new_booking.start_datetime, vm.new_booking.end_datetime, 0, 0)
             //    .then(function(data){
                   
             //        //this gets the events and bookings for the period checked here...
             //        // var events = data.events;
             //        vm.planes = data;
                

             //    });
        }

        
       
        $scope.back = function(){
            $window.history.back();
        }

        /* THIS SECTION IS ABOUT THE CALENDAR SHOWN ON ALL PAGES */


        /* FUNCTIONS REQUIRED FOR ALL PAGES SHOWING THE BOOKINGS ON CALENDAR */


        $scope.test = function(){
            //console.log("UPDATE");
            vm.new_booking.instructor = {
                id: 90,
                first_name: "A",
                last_name: "REYNIER"
            };
        }
    

    $scope.updateEvents = function(start, end){
        ////console.log("start", start, "end", end);

        BookingService.GetAll(vm.user.id, start, end)
        .then(function(data){
            //console.log(data);

            $scope.all_events = data.events;
            $scope.all_resources = data.resources;

            // //console.log("hello", $scope.all_events);
            // //console.log("hello", $scope.all_resources);

            return data;

        });
    }



    /* Render Tooltip */
    $scope.eventRender = function( event, element, view ) {
        element.attr({'tooltip': event.title,
                      'tooltip-append-to-body': true});
        $compile(element)($scope);
    };

    
    $scope.alertOnClicked = function(calEvent, jsEvent, view){
            
            vm.see_booking = calEvent;

            vm.see_booking.start_date = moment(vm.see_booking.start).format("DD/MM/YYYY");
            vm.see_booking.end_date = moment(vm.see_booking.end).format("DD/MM/YYYY");
            vm.see_booking.start_time = moment(vm.see_booking.start).format("HH:mm");
            vm.see_booking.end_time = moment(vm.see_booking.end).format("HH:mm");

            vm.see_booking.start_datetime = new Date(new Date(vm.see_booking.start).toUTCString());
            vm.see_booking.end_datetime = new Date(vm.see_booking.end);
            vm.see_booking.visible = 1;

            vm.see_booking.after_booking_end = moment().isAfter(moment(vm.see_booking.end));

            $scope.$apply();
    };


    $scope.close_details = function(){
            vm.see_booking.visible = 0;
    }


    $scope.changeLang = function() {
    
        $scope.uiConfig.calendar.dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        $scope.uiConfig.calendar.dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
    };

    $scope.changed = function () {
        // $log.log('Time changed to: ' + $scope.mytime);
        $scope.check_plane_availability();
    };

    function j_changed() {
        // $log.log('Time changed to: ' + $scope.mytime);
        $scope.check_plane_availability();
    };

    $scope.check_plane_availability = function(){
       
        generate_datetimes();

        //getALL?
        var getA = (vm.new_booking.edit_booking == 1)? 1 : 0;
        var plane_id = (vm.new_booking.plane_id > 0)? vm.new_booking.plane_id : 0;
        if(vm.new_booking.plane && vm.new_booking.plane.id){
            plane_id = vm.new_booking.plane.id;
        }

        console.log("START", vm.new_booking.start_datetime);
        // console.log("START", moment(vm.new_booking.start_datetime).format("Y-M-D HH:mm"));
        console.log("START iso", new Date(vm.new_booking.start_datetime).toIsoString());
        console.log("END", vm.new_booking.end_datetime);

        BookingService.GetAllPlanes(vm.user.id, vm.new_booking.start_datetime, vm.new_booking.end_datetime, 0, plane_id)
        .then(function(data){
           
            //this gets the events and bookings for the period checked here...
            // var events = data.events;
            vm.planes = data;
            

            if(getA == 1){
                //then I just want to iterate through these and return the plane already selected as "available..."

                ////console.log("PLANE", vm.new_booking.plane);

                for(var i = 0; i<vm.planes.length; i++){
                    if(vm.planes[i].id == vm.new_booking.plane.id){
                        reset_chosen = 0;
                        vm.new_booking.plane = vm.planes[i];
                        //chosen is still available WOOOO
                        $scope.check_rental_items();
                    }
                }



            } else {

                 //check if anything was already selected...
                var reset_chosen = 1;
                if(vm.new_booking.plane){
                    for(var i = 0; i<vm.planes.length; i++){
                        if(vm.planes[i].id == vm.new_booking.plane.id){
                            reset_chosen = 0;
                            //chosen is still available WOOOO
                            $scope.check_rental_items();
                        }
                    }
                    if(reset_chosen == 1){
                        //then we just need to clear currently selected plane
                        vm.new_booking.plane = {};
                        delete(vm.new_booking.plane);
                    }
                    //otherwise we can leave that we've already done! :)
                }


            }

        });

    }

    $scope.events = [];

    function getDayClass(data) {
        var date = data.date,
          mode = data.mode;
        if (mode === 'day') {
          var dayToCheck = new Date(date).setHours(0,0,0,0);

          for (var i = 0; i < $scope.events.length; i++) {
            var currentDay = new Date($scope.events[i].date).setHours(0,0,0,0);

            if (dayToCheck === currentDay) {
              return $scope.events[i].status;
            }
          }
        }

        return '';
      }


    $scope.addOne = function(start=null, plane_id=null, end=null){
        // //console.log("ADDING HERE --> with ", start);

        if(start && !end){                 
            end = moment(start).add(1, "hour").format();
        }

        //alert(end);
        $state.go('dashboard.bookings.add', {"start": start, "plane_id": plane_id, "end": end});
    }

    $scope.cancel_changes = function(){
        $state.go('dashboard.bookings.add');
    }

    $scope.check_rental_items = function(){
        generate_datetimes();

        vm.rental_items = [];

        if(vm.new_booking.plane){

            var club_id = (vm.new_booking.edit_booking == 1) ? vm.new_booking.club_id : vm.new_booking.plane.club_id;

            BookingService.GetRentalItems(club_id, moment(vm.new_booking.start_datetime).format("Y-M-D HH:mm"), moment(vm.new_booking.end_datetime).format("Y-M-D HH:mm"), 0)
            .then(function(data){
           
                vm.rental_items = data;

                if(vm.new_booking.rental_items){
                    //then we may have shizzle to check / update
                    for(var i=0;i<vm.new_booking.rental_items;i++){
                        //first and foremost we need to check the available bits....
                        var found = 0;
                        for(var j=0;j<vm.rental_items.length;j++){
                            if(vm.rental_items[j]["id"] == vm.new_booking.rental_items[i]["id"]){
                                //then we need to check that the current numbers available are still the same as before...
                                if(parseInt(vm.new_booking.rental_items[i]["number_to_book"]) > parseInt(vm.rental_items[j]["number_available"])){
                                    vm.new_booking.rental_items[i]["number_to_book"] = parseInt(vm.rental_items[j]["number_available"]);
                                }
                                vm.new_booking.rental_items[i]["number_available"] = parseInt(vm.rental_items[j]["number_available"]);
                                found = 1;
                                break;
                            }
                        }
                        if(found == 0){
                            //then we need to remove it...
                            delete vm.new_booking.rental_items[i];
                        }

                    }

                }


                for(var k=0; k<vm.rental_items.length;k++){
                    vm.rental_items[k].number = 0;
                }

                //if there is one already selected?
                //check if anything was already selected...
                if(vm.new_booking.rental_items){
                    for(var j=0; j<vm.new_booking.rental_items; j++){
                        var reset_chosen = 1;
                        for(var i = 0; i<vm.rental_items.length; i++){
                            if(vm.rental_items[i].id == vm.new_booking.rental_items[j].id){
                                reset_chosen = 0;
                                //chosen is still available WOOOO
                            }
                        }
                        if(reset_chosen == 1){
                            //then we just need to clear currently selected plane
                            delete vm.new_booking.rental_items[j];
                        }
                    }
                    //otherwise we can leave that we've already done! :)
                }




            });

        }
    }

    function check_times(clean_type = null){

            var c = new Date();
            var a = (vm.new_booking.start_time) ? vm.new_booking.start_time.time.split(":") : [c.getHours(), c.getMinutes()];
            var b = new Date(vm.new_booking.start_date);
            b.setHours(a[0]);
            b.setMinutes(a[1]);
            b.setSeconds(0);
            var future = moment(b).add(1, "hour").format();

            //check if the end_time is set && if the end time is > start time...
            if(start_after_end() || !vm.new_booking.end_time){

                clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);

                var id;
                // vm.end_times.forEach(function(time, i){ 
                //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                // });
                vm.end_times.some(function(time, i){ 
                  if(time.time == moment(future).format("HH:mm")){ id = i; return i;};  
                });

                vm.new_booking.end_time = {};
                vm.new_booking.end_time = vm.end_times[id];

            } else {
                if(!clean_type){
                    clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);
                } 
            }


             //need to update the selection of the end time if this has been set
            if(vm.new_booking.end_time && vm.new_booking.end_time.disabled == 1){

                var id;
                //used to use a forEach loop but decided to run a some loop instead due to the benefit of not going through all elements
                // vm.end_times.forEach(function(time, i){ 
                //   if(time.time == moment(future).format("HH:mm")){ id = i; return true;}; 
                // });
                vm.end_times.some(function(time, i){ 
                  if(time.time == moment(future).format("HH:mm")){ id = i; return i;};  
                });

                vm.new_booking.end_time = {};
                vm.new_booking.end_time = vm.end_times[id];

            }

            if(vm.new_booking.start_time && vm.new_booking.start_time.disabled == 1){
                if(!clean_type){
               
                var id;
                vm.start_times.some(function(time, i){ 
                  if(time.disabled == 0){ id = i; return i;}; 
                });

                vm.new_booking.start_time = {};
                vm.new_booking.start_time = vm.start_times[id];
                 } 

                calculate_duration();
            }
    }

    $scope.update_dateTime = function(which_update, params=null){

        ////console.log("UPDATE TIME HERE", which_update);

        switch(which_update){

            case 'start_date':

                booking_today();

                if(vm.new_booking.start_date > vm.new_booking.end_date){
                    vm.new_booking.end_date = vm.new_booking.start_date;
                }

                clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');

                check_times();

                if(start_after_end()){
                    add_hour_to_end();
                }

            break;

            case 'end_date':

                 booking_today();
                
                check_times();

                if(vm.new_booking.end_date < vm.new_booking.start_date){
                    vm.new_booking.start_date = vm.new_booking.end_date;
                    clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                } else {
                    clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                    clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times');
                }

                if(start_after_end()){
                    add_hour_to_end();
                }


            break;

            case 'start_time':

                // alert("start_time");
                //do we need to clean the times? if so.. 
                booking_today();

                check_times();

                //we need to calculate the time in between the start and the end!
                calculate_duration();
                

            break;

            case 'end_time':
                // vm.times_clean_type = "start_times";
                // if(moment(vm.new_booking.start).unix() < moment().unix()){
                //     vm.times_clean_type = "past";
                // }
                if(vm.times_clean_type == "past"){
                    //alert("end_time");
                    check_times("edit");
                } else {
                    check_times();
                }


            break;

            case 'edit':

                // //this is the edit function that needs to be setup.
                // booking_today();

                // //number 1 = we have set start and end of the current date....
                // // setTimeout(function(){
                // //     check_times();
                // //     // calculate_duration();
                // // }, 5000);
                // //console.log("ASD ",vm.new_booking.start_date);
                // // clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                // check_times();
                // calculate_duration();
                //alert("EDIT 1");


 //start_times
                vm.times_clean_type = "start_times";
                if(moment(vm.new_booking.start).unix() < moment().unix()){
                    vm.times_clean_type = "past";
                    //clean_times(check_relative_date(vm.new_booking.start_date), "end_times");
                                


                } else {
                                check_times();
                    booking_today();
                }
                calculate_duration();

                setTimeout(function(){
                    //do we need to clean the times? if so.. 
                    // pre_select_value_id("start_times", vm.new_booking.start_time);
                    pre_select_value_id();
                    //we need to calculate the time in between the start and the end!
                }, 500);




                //we need to set the previously selected plane here...


            break;

            case 'edit2':

                // //this is the edit function that needs to be setup.
                // booking_today();

                // //number 1 = we have set start and end of the current date....
                // // setTimeout(function(){
                // //     check_times();
                // //     // calculate_duration();
                // // }, 5000);
                // //console.log("ASD ",vm.new_booking.start_date);
                // // clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                // check_times();
                // calculate_duration();

                booking_today();

                clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');

                check_times();

                calculate_duration();

                setTimeout(function(){
                    //do we need to clean the times? if so.. 
                    // pre_select_value_id("start_times", vm.new_booking.start_time);
                    pre_select_value_id();
                    //we need to calculate the time in between the start and the end!

                     if(params){
                        // alert("plane");
                        // alert(params);
                        // //console.log("SELECT ME ", vm.planes);
                                for(var i=0;i<vm.planes.length;i++){
                                    // //console.log("I", i);
                                    // //console.log("id 1", vm.planes[i].id);
                                    // //console.log("I", i);
                                    if(parseInt(vm.planes[i].id) == params){
                                        vm.new_booking.plane = vm.planes[i];
                                        $scope.getPlaneInstructors(vm.new_booking.plane.id);
                                         ////console.log("found", vm.new_booking);
                                         $scope.$apply();
                                    }
                                }
                    }
                    
                }, 500);




                //we need to set the previously selected plane here...


            break;


        }


        //an update on the form would require an update of the plane / waiting lists available
        $scope.check_plane_availability();

        if(vm.new_booking.plane){
            //then we check what is available for these guys!
            $scope.check_rental_items();
        }

        //if the plane was already selected - then we can also update the instructors so as to not require
        //the user to have to re-select the plane
        if(vm.new_booking.plane){
            $scope.getPlaneInstructors();
        }


    }




    function pre_select_value_id(){

        vm.start_times.forEach(function(times, i){
            // //console.log(times.time+" == "+vm.new_booking.start_time.time);
            if(times.time == vm.new_booking.start_time.time){
                // //console.log("THIS I ", i);
                vm.new_booking.start_time = vm.start_times[i];
            }

        });
        // //console.log("END", vm.end_times);

         vm.end_times.forEach(function(times, i){

            if(times.time == vm.new_booking.end_time.time){
                // //console.log("THIS I ", i);
                vm.new_booking.end_time = vm.end_times[i];
            }

        });

        $scope.$apply();

    }



    $scope.update_booking = function(valid){


        //alert("UPDATE");

        generate_datetimes();

        if(valid){

                // //console.log("VALID SUBMISSION");
                // //console.log("START", vm.new_booking.start_datetime);
                // //console.log("END", vm.new_booking.end_datetime);

                var booking = {};
                var booking = jQuery.extend(true, {}, vm.new_booking); 
                // //console.log(booking);
                delete booking.options;
                delete booking.instructor;
                delete booking.plane;
                delete booking.start_date;
                delete booking.start_time;
                delete booking.end_date;
                delete booking.end_time;
                delete booking.start_datetime;
                delete booking.end_datetime;
                delete booking.tuition_required;
                delete booking.after_booking_end;
                // //console.log(booking);
                // //console.log(vm.new_booking);
                booking.free_seats = (vm.new_booking.free_seats.constructor === Array) ? 0 : vm.new_booking.free_seats;
                booking.start = vm.new_booking.start_datetime;
                booking.end = vm.new_booking.end_datetime;
                booking.course_id = vm.new_booking.tuition_required.id;


// Date.parse(vm.new_booking.start_datetime)

                if(moment(Date.parse(vm.new_booking.end_datetime)).add(1, "hour").isBefore()){
                    ToastService.warning('Past Booking', 'This booking ends in the past by more than an hour - you cannot amend a booking that finished in the past.');
                    return false;
                }
                //30 mintues leeway in case of booking starting within the 15 minute period or similar
                // if(moment(vm.new_booking.start_datetime).add(30, "minutes") < moment()){
                //     alert("This booking starts in the past - you cannot create a booking in the past.");
                //     return false;
                // }






                // //console.log("START", booking.start);
                // //console.log("END", booking.end);

                ////console.log("PLANE", vm.new_booking.plane);
                booking.resourceId = vm.new_booking.plane.id;

                if(vm.new_booking.plane.id.toString().indexOf("w") > -1){
                    booking.changed_to_waiting_list = true;
                    booking.resourceId = vm.new_booking.plane.id.slice(0, -1);
                }

                if(!vm.booking_self){
                    booking.user_id = vm.new_booking.user.user_id;
                    booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : vm.user.id;
                } else {
                    booking.user_id = vm.user.id;
                    booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;
                }
                
                


                booking.plane_id = vm.new_booking.plane.id;
                booking.override = (vm.new_booking.override) ? vm.new_booking.override : 0;
                booking.club_id = vm.new_booking.plane.club_id;

                // //console.log("====> booking to be sent = ", booking);

                check_before_changing_event(booking);

        }

    }

    $scope.update_club = function(){
            //console.log("we changed club here");
            vm.club_id = vm.change_club.id;
                //console.log("CLUB ID IS :", vm.club_id);
                if(vm.user.access.instructor.indexOf(vm.club_id) > -1 || vm.user.access.manager.indexOf(vm.club_id) > -1){
                    //console.log("THIS IS AN INSTRUCTOR/MANAGER IN THIS CLUB...");
                    vm.booking_self = false;
                } else {
                    vm.booking_self = true;
                }
            //now we need to update the planes the user can see on the calendar! 
            update_bookings();

    }

    function update_bookings(){


         // BookingService.GetAllUserClub(vm.user.id,vm.club_id, moment().format("Y-M-D"), "")
         //        .then(function(data){
                   
         //            $scope.all_events = data.events;
         //            $scope.all_resources = data.resources;

         //        });

         //console.log("UPDATE BOOKINGS ");
         BookingService.GetAll(vm.user.id, moment().format("Y-M-D"), "")
        .then(function(data){
            //console.log(data);

            $scope.all_events = data.events;
            $scope.all_resources = data.resources;

            //console.log("hello", $scope.all_events);
            //console.log("hello", $scope.all_resources);

            return data;

        });

    }

    /* alert on eventClick */
    $scope.alertOnEventClick = function( date, jsEvent, view){
        $scope.alertMessage = (date.title + ' was clicked ');
        //console.log("HELLO BOOBIES");
        //console.log(event);
        //show event details

    };

    /* alert on Drop */
     $scope.alertOnDrop = function(event, delta, revertFunc, jsEvent, ui, view){
  


        if(event.resourceId.toString().indexOf("w") > -1){
            event.changed_to_waiting_list = true;
            event.resourceId = event.resourceId.slice(0, -1);
        }

        // //console.log("HELLO BOOBIES", event);


        check_before_changing_event(event);
       
    };


    /* alert on Resize */
    $scope.alertOnResize = function(event, delta, revertFunc, jsEvent, ui, view ){
        
        check_before_changing_event(event);

    };



    $scope.override_booking_change = function(override){

        vm.error_event[override] = true;
        //vm.error_event.override = true;

        check_before_changing_event(vm.error_event, true);


    }

    $scope.decline_booking_change = function(){

        vm.booking_errors = {};
        vm.error_event = {};
        $('#calendar').fullCalendar('removeEvents');
        $('#calendar').fullCalendar('addEventSource', all_events);

    }


    function check_before_changing_event(event, err=null){
        //the important bit is the eventID 

       if(err){
         vm.booking_errors = {};
            vm.error_event = {};
       }

        var evnt = jQuery.extend({}, event);

        // evnt.start = moment(evnt.start).format("YYYY-MM-DD HH:mm");
        // evnt.end = moment(evnt.end).format("YYYY-MM-DD HH:mm");
        
        //this covers the change of plane for the booking...
        evnt.plane_id = event.resourceId;
        if(event.instructor_id !== ""){
            evnt.instructor_id = event.instructor_id;
        } else {
            evnt.instructor_id = "0";
        }
        //updatable bits:

        delete evnt._start;
        delete evnt._end;
        delete evnt._id;
        delete evnt.source;
        delete evnt._allDay;
        delete evnt.allDay;
        delete evnt.className;
        delete evnt.plane;
        delete evnt.title;
        delete evnt.editable;
        delete evnt.resourceIds;
        evnt.update_rental_items = true;

        // //console.log("EVENT CHANGE", evnt);

        var original_event;
        for(var i=0; i<$scope.all_events.length;i++){
            if($scope.all_events[i].id == evnt.id){
                original_event = $scope.all_events[i];
                // //console.log("original EVENT", original_event);
            }
        }


        // //console.log("original end: ", moment(original_event.end).unix());
        // //console.log("new end is : ", evnt.end.unix());

        // //console.log("1original start: ", original_event.start);
        // //console.log("1new start is : ", evnt.start);

        // //console.log("2original start: ", moment(original_event.start).unix());
        // //console.log("2new start is : ", evnt.start.unix());

        // //console.log("1original start again: ", original_event.start);


        //event in the past cannot be amended AFTER the booking - but the booking can be exte

        // //console.log("all_events", $scope.all_events);

        if(moment(Date.parse(evnt.end)) < moment()){
            ToastService.warning('Past Booking', 'This booking ends in the past - you cannot amend a booking in the past.');
            return false;
        }
        // 30 mintues leeway in case of booking starting within the 15 minute period or similar
        if(moment(evnt.start).add(30, "minutes") < moment()){
                // //console.log("start is older than 30 minutes ago");
                // //console.log("1original start again: ", original_event.start);

            if(moment(original_event.end) !== evnt.end){
                // //console.log("end is not the same end");
                // //console.log("original end: ", moment(original_event.end).unix());
                // //console.log("new end is : ", evnt.end.unix());

                var p = confirm("This booking starts in the past - you cannot amend the start date or time of a booking in the past, would you like to amend the end time along with any other changes you have made?");
                if(p){  
                    // //console.log("START UPDATE = ",evnt.start );
                    evnt.start = original_event.start;
                    // //console.log("START UPDATE = ",evnt.start );
                } else {
                    return false;
                }

            }




            //let's reset the booking'start time

           




           // return false;
        }

        // //console.log("UPDATE CONTENT BEFORE", evnt);

        BookingService.updateBooking(evnt, vm.user.id)
        .then(function(data){
            //console.log(data);

            if(data.success == true){
                //console.log("the booking did not need to be altered and has been updated successfully.", evnt);

                //only if the edition is being made from the "edit" otherwise the changes are already reflected appropriately.
                if(evnt.edit_booking == 1){
                    $scope.$parent.updateEvents(evnt.start, evnt.end);
                }
                
                ToastService.success('Changes Saved', 'Your changes were saved successfully');
                
                if(vm.return_to == "bookout") {
                    //console.log("WE ARE AT THE BOOKOUT BIT - SO RETURN THERE!!!");
                    $state.go('dashboard.my_account.bookout_with_booking', { "booking_id": event.id });
                } else {
                    //console.log("NORMAL booking");
                    $state.go('dashboard.bookings.add');
                }



            } else {
                //display the error
                //console.log("The booking cannot remain the same due to : "+data.message);

                //hollow :::     $("#calendar").fullCalendar('refetchEvents');


                //I have decided to do this as a sequential check / accept / decline as opposed to combined
                //this can be altered at a later date to be combined, with accept / decline on each error
                //but this is more work than i can do right now!

                var errors = [];
                if(data.instructor !== true){
                    errors.push({
                        type: "instructor",
                        message: "It looks like your instructor is not available on the updated date and time",
                        api: data.instructor,
                        override: "instructor_override",
                        button: "" 
                    });
                } else if(data.check_user !== true){

                    if(data.check_user.indexOf("self-certify") > -1){

                        errors.push({
                            type: "check_user",
                            message: "It would appear that you are not within the currency requirements to book this aircraft for this flight.",
                            api: data.check_user,
                            override: "currency_override",
                            button: "I am Current" 
                        });


                    } else {
                        errors.push({
                            type: "check_user",
                            message: "It looks like your user account does not allow this booking to happen",
                            api: data.check_user,
                            override: "currency_override",
                            button: "" 
                        });
                    }

                   
                } else if(data.rental_items !== true){
                    errors.push({
                        type: "rental_items",
                        message: "It looks like some of the rental items are not available",
                        api: data.rental_items,
                        override: "update_rental_items",
                        button: "Confirm Changes" 
                    });
                }


                //show the errors:::

                // alert("ERROR FOUND IN ALTERING THE BOOKING");

                vm.booking_errors = errors;
                //console.log("ERRORS ARE : ", vm.booking_errors);
                vm.error_event = evnt;

                //on GO--> check_before_changing_event(evnt)    


                //if CANCEL?
                //this would reset the change... do we want this?
                //$("#calendar").fullCalendar('refetchEvents');



            }

            return data;

        });

    }

    $scope.wholeDay = function(){

       if($scope.whole_day_booking == true){
            $scope.whole_day_booking = false;
            $scope.myDatetimeRange.time.from = defaultStartTime;
            $scope.myDatetimeRange.time.to = defaultEndTime;
       } else {
            $scope.whole_day_booking = true;
            $scope.myDatetimeRange.time.from = 0;
            $scope.myDatetimeRange.time.to = 1440;
       }
       

    }

    //Changing the view of the calendar
    $scope.changeView = function(view,calendar) {
      uiCalendarConfig.calendars[calendar].fullCalendar('changeView',view);
    };

    /* Change View */
    $scope.renderCalender = function(calendar) {
      $timeout(function() {
        if(uiCalendarConfig.calendars[calendar]){
          uiCalendarConfig.calendars[calendar].fullCalendar('render');
        }
      });
    };

























    /* THIS SECTION IS ABOUT THE ADD / EDIT OF THE CALENDAR EVENTS VIA THE EDIT / ADD NEW BOOKING */

    /* ADD OR EDIT THE BOOKING */

    function figure_out_steps(){
        //console.log("OPTIONS", vm.dateTimeRangePickerOptions);
        vm.new_booking.options = vm.dateTimeRangePickerOptions;
         for(var i=0;i<24;i+=vm.new_booking.options.hour_step){

            if(vm.new_booking.options.minute_step && vm.new_booking.options.minute_step > 0){
                for(var j=0; j<(60/vm.new_booking.options.minute_step); j++){
                    var k = vm.new_booking.options.minute_step * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                    vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                }
            } else {
                vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
            }

        }
    }

    function init_times(){
       for(var i=0;i<24;i+=vm.new_booking.options.hour_step){

            if(vm.new_booking.options.minute_step && vm.new_booking.options.minute_step > 0){
                for(var j=0; j<(60/vm.new_booking.options.minute_step); j++){
                    var k = vm.new_booking.options.minute_step * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                    vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                }
            } else {
                vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
            }

        } 
    }
    

    $scope.add_rental_item = function(){
        if(vm.rental_item && vm.new_booking.rental_items && vm.rental_item.id){
            var add_to_list = 1;
            var delete_this = 0;
            for(var j=0; j<vm.new_booking.rental_items.length; j++){
                if(vm.new_booking.rental_items[j].id == vm.rental_item.id){
                    add_to_list = 0;
                    delete_this = vm.new_booking.rental_items[j];
                    //console.log("item was already found there...");
                }
            }
            if(add_to_list == 1){
                //then its not already in teh list!
                vm.new_booking.rental_items.push(vm.rental_item);
                delete vm.rental_item;

            }

        } else {
            if(vm.rental_item){
                //console.log("rental_item is: ", vm.rental_item);
                if(!vm.new_booking.rental_items){
                    //init here if its the first item...
                    vm.new_booking.rental_items = [];
                }
                vm.new_booking.rental_items.push(vm.rental_item);
                delete vm.rental_item;
            }
               
        }

    }


    $scope.rental_item_remove = function(id){
        //as this is before we actually do the shizzle!
        vm.new_booking.rental_items = $.grep(vm.new_booking.rental_items, function(e){ 
                return e.id != id; 
        });
    }



    $scope.getPlaneInstructors = function(){


        //console.log("CHANGE OF PLANE HERE");

        // Determine the club from the selected plane (most reliable source)
        var booking_club_id = parseInt(vm.new_booking.plane.club_id) || vm.club_id;
        vm.club_id = booking_club_id;

        if((vm.user.access.instructor.indexOf(booking_club_id) > -1) || (vm.user.access.manager.indexOf(booking_club_id) > -1) ){
            //console.log("NOT BOOKING FOR SELF?");
            vm.booking_self = false;
            prepare_add_edit();
        } else {
            vm.booking_self = true;
        }

        if( vm.user.access.manager.indexOf(booking_club_id) > -1 ){
            vm.booking_admin = true;
        } else {
            vm.booking_admin = false;
        }

        vm.init_passengers();
        $scope.check_rental_items();


        if(vm.action == "add"){

          


            BookingService.GetPlaneInstructors(vm.user.id, vm.new_booking.plane.id, vm.new_booking.start_datetime, vm.new_booking.end_datetime, (vm.booking_self)? 0 : 1)
            .then(function(data){
                //console.log(data);
                //console.log("NEW INSTRUCTORS ARE : ", data);
                vm.instructors = data;

                var reset_chosen = 1;
                if(vm.new_booking.instructor){
                    for(var i = 0; i<vm.instructors.length; i++){
                        if(vm.instructors[i].id == vm.new_booking.instructor.id){
                            reset_chosen = 0;
                        }
                    }
                    if(reset_chosen == 1){
                        //then we just need to clear currently selected plane
                        vm.new_booking.instructor = {};
                        delete(vm.new_booking.instructor);
                    }
                    //otherwise we can leave that we've already done! :)
                }
                free_places();
            });


        } else {
            //must be edit... sooooooo

            BookingService.GetPlaneInstructorsEdit(vm.user.id, vm.new_booking.plane.id, vm.new_booking.start_datetime, vm.new_booking.end_datetime, (vm.booking_self)? 0 : 1, vm.new_booking.id)
            .then(function(data){
                //console.log(data);
                //console.log("NEW INSTRUCTORS ARE : ", data);


                vm.instructors = data;

                var reset_chosen = 1;
                if(vm.new_booking.instructor){
                    for(var i = 0; i<vm.instructors.length; i++){
                        if(vm.instructors[i].id == vm.new_booking.instructor.id){
                            reset_chosen = 0;
                        }
                    }
                    if(reset_chosen == 1){
                        //then we just need to clear currently selected plane
                        vm.new_booking.instructor = {};
                        delete(vm.new_booking.instructor);
                    }
                    //otherwise we can leave that we've already done! :)
                }
                free_places();
            });

        }


        // InstructorCharges.GetByClubId(vm.new_booking.plane.club_id)
        //         .then(function(data){
        //             vm.instructor_charges = data.items;  
        //             ////console.log("====> ", data); 
        //         });

         CourseService.GetCoursesByClubId(vm.new_booking.plane.club_id)
                    .then(function(data){
                        vm.courses = data.items;   
                    });


        //console.log("vm.new_booking.plane.club_id", vm.new_booking.plane.club_id);
        //console.log("vm.new_booking.plane.club_id", vm.user.access.instructor);
        //console.log("INDEX :: ", vm.user.access.instructor.indexOf(parseInt(vm.new_booking.plane.club_id)));
        
        // if(vm.user.access.instructor.indexOf(parseInt(vm.new_booking.plane.club_id)) > -1){
        //     //console.log("THIS IS AN INSTRUCTOR IN THIS CLUB...");
        //     vm.booking_self = false;
        // }





        //if is_current getPlaneInstructors
        BookingService.GetIfCurrent(vm.user_id, vm.new_booking.plane.id, vm.new_booking.end_datetime)
        .then(function (data) {
            ////console.log(data);
            if(data.success){
                //use GB airfields first...
                vm.is_current = data.is_current;
                //console.log("CURRENCY ", vm.is_current);

                vm.currency_type = data.requirements.currency_type;
                vm.currency_days = data.requirements.currency_days;
            } else {
            }
        });
        

        

    }


    function free_places(){
        // //console.log("UPDATE FREE PLACES...", vm.new_booking.passengers.length);
        // //console.log("UPDATE FREE PLACES...", vm.new_booking.instructor);

        vm.free_seats = [];

        var seats = vm.new_booking.plane.seats - 1;

        if(vm.new_booking.instructor){
            if(vm.new_booking.instructor.id > 0){
                // //console.log("the instructor was selected for this flight...");
                seats--;
            }
        }

        if(vm.new_booking.passengers.length > 0){
            for(var i=0;i<vm.new_booking.passengers.length;i++){
                if(vm.new_booking.passengers[i] && vm.new_booking.passengers[i]["email"] !== ""){
                    seats--;
                }
            }
        }

        for(var i=0; i<seats;i++){
            vm.free_seats.push(i);
        }

        // //console.log("free seats now...", vm.free_seats);

        // $scope.$apply();

    }


    $scope.clear_booking = function(){
        vm.new_booking = {
            start_date: today,
            end_date: today,
            free_seats: [],
            passengers: [],
            instructor: undefined,
            options: vm.dateTimeRangePickerOptions
        };
        $scope.submitted = false;
    }

    function calculate_duration(){
        if(vm.new_booking.start_date && vm.new_booking.start_time){
            var start_datetime = new Date(vm.new_booking.start_date);
            var start_time = vm.new_booking.start_time.time.split(":");
            start_datetime.setHours(start_time[0]);
            start_datetime.setMinutes(start_time[1]);
            start_datetime.setSeconds(0);
            // //console.log("START DATETIME", start_datetime);  

            vm.end_times.forEach(function(time, i){ 
                //no need to go through each element if its not required to be shown!
                if(time.disabled == 0){

                    var end_datetime = new Date(vm.new_booking.end_date);
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

    vm.seats_in_plane = function(){
            free_places();

            //base
            var no_seats = vm.new_booking.plane.seats;

            //check if instructor aboard?
            if(vm.new_booking.instructor){   
                no_seats--;
            }

            //include self
            no_seats--;

            // //console.log("seats left", no_seats);


            //return final number
            return no_seats;
        }

        vm.adding_a_member = function(){
            //console.log("ADDING ONE?");
            vm.init_passengers();
        }

        vm.init_passengers = function(){
            var no_of_seats = vm.seats_in_plane();
            // var already_filled = 0;
            // for(var i=0;i<vm.new_booking.passengers.length;i++){
            //         if(vm.new_booking.passengers[i] && vm.new_booking.passengers[i]["email"] !== ""){
            //             already_filled++;
            //         }          
            // };
            // var cc = no_of_seats - already_filled;
            // // //console.log("CCCC seats -> ",no_of_seats);
            // // //console.log("CCCC already_filled -> ",already_filled);
            // // //console.log("CCCC -> ",cc);
            // if(cc > 0){
                vm.new_booking.passengers.push({
                    first_name: "",
                    last_name: "",
                    email: "",
                    status: ""
                });
            // }
            
        }

        var setting_new_member;


        var set_new_member = function(email, index){
            // //console.log("SET MEMBER NOW 123");
            vm.new_booking.passengers[index] = {
                                id: 0,
                                email: email,
                                first_name: "",
                                last_name: "",
                                is_member: false,
                                status: "to_invite"
                            };
            // //console.log("HELLO");
            vm.init_passengers();
            free_places();
        }

        vm.new_passenger_invite_ready = function(index){

            //let's check the email address -->
             // 
            var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

            if(email_regex.test(vm.new_booking.passengers[index].email)){

                // //console.log("SET MEMBER NOW 123");
                vm.new_booking.passengers[index].is_member = false;
                vm.new_booking.passengers[index].status = "to_invite";

                // //console.log("HELLO");
                vm.init_passengers();
                free_places();
                vm.show_new_passenger_invitation = false;
            } else {
                ToastService.warning('Invalid Email', 'The email address appears to be incorrect - please double check the email address entered.');
                return false;
            }
        }


        $scope.cancel_booking = function(booking_id){

            //HOW DO WE CANCEL A BOOKING???
            //at some point we need to define the booking cancellation reasons here (and make a nice popup style cancel)

            var a = prompt("Are you sure you wish to cancel this booking? Please type YES in the box below to confirm.");
            if(a == "YES"){
                //then we need to delete the booking... 

            BookingService.DeleteBooking(vm.user.id, booking_id)
            .then(function(data){
                //console.log(data);
                ToastService.success('Booking Cancelled', 'The booking has been cancelled');

                if(data.success){
                    $state.go('dashboard.bookings.add');
                    
                     $scope.all_events = $.grep($scope.all_events, function(e){ 
                        return e.id != booking_id; 
                    });

                    $('#calendar').fullCalendar('refetchEvents');
                    $('#calendar').fullCalendar('removeEvents');
                    $('#calendar').fullCalendar('addEventSource', $scope.all_events);

                } else {
                    ToastService.error('Error', 'An error occurred');
                    //console.log("ERROR", data);
                }

            });


            } else {
                $state.go('dashboard.bookings.add');
            }

        }

       


        function prepare_add_edit(club_id=null, after_booking_end=null){

            var cid = (club_id) ? club_id : vm.club_id;
            var bed = (after_booking_end) ? after_booking_end : vm.new_booking.end_datetime;

            if(cid > 0 && bed){

                 MemberService.GetAllActiveByClub(cid, bed)
                    .then(function (data) {
                        //console.log("members are : ", data);
                        //console.log("CLUB ID IS :", vm.club_id);

                        if(vm.user.access.instructor.indexOf(vm.club_id) > -1){
                            //console.log("THIS IS AN INSTRUCTOR IN THIS CLUB...");
                            vm.booking_self = false;
                        }

                        //use GB airfields first...
                        vm.members = data;


                        if(vm.new_booking.instructor && vm.new_booking.instructor.id == vm.user.id){
                            vm.booking_self = false;
                        }

                        if(!vm.new_booking.user){
                            // vm.booking_self = false;
                            //set the member

                            vm.new_booking.user = vm.members.find(function(member, index) {
                                                                    if(member.user_id == vm.new_booking.user_id)
                                                                        return true;
                                                                });

                        }



                        for(var i=0;i<vm.members.length;i++){
                            vm.members[i].is_member = true;
                        }
                        //console.log(vm.members);
                    
                    });

            }

           
        }



        vm.remove_invite = function(i){


                vm.new_booking.passengers.splice(i, 1);
                vm.init_passengers();


        }


        vm.remove_passenger = function(i){


            var to_remove = vm.new_booking.passengers[i];
            if( vm.pax_invited(to_remove) ){

                //full removal from the backend
                BookingService.DeleteInvitation(to_remove, to_remove.id)
                .then(function(data){
                    //console.log(data);
                    if(data.success == true){
                        //alert(data.message);
                        vm.new_booking.passengers.splice(i, 1);
                        vm.init_passengers();
                    } else {
                        ToastService.error('Error', data.message);
                    }

                });




            } else {

                //this pax was not YET saved - hence just remove from list

                vm.new_booking.passengers.splice(i, 1);
                vm.init_passengers();

            }

                //below YES --> but needs to remove the invitation as well.

                // vm.new_booking.passengers.splice(i, 1);
                // vm.init_passengers();

        }

        vm.resend_invitation = function(i){


            var to_resend = vm.new_booking.passengers[i];
             BookingService.ResendInvitation(to_resend, to_resend.id)
                .then(function(data){
                    //console.log(data);
                    if(data.success == true){
                        ToastService.success('Success', data.message);
                    } else {
                        ToastService.error('Error', data.message);
                    }

                });


        }

        vm.pax_invited = function(pax){
            if(pax.status == "" || pax.status == "to_invite"){
                return false;
            }
            return true;
        }

        vm.get_passenger_status = function(member){
            // //console.log("MEMBER", member);
            if(member){

                if(member.is_member){
                    // //console.log("this one is true");
                    return "This passenger is already club member and hence is ready for flight";
                } else {

                    if(member.status == "accepted"){
                        return "This passenger has accepted the terms and is ready for flight";
                    } else if(member.status == "declined"){
                        return "This passenger has declined the terms";
                    } else if(member.status == "to_invite"){
                        return "Invitation will be sent once the booking is saved.";
                    } else if(member.status == "invited"){
                        return "This passenger has been invited but has not yet responded.";
                    } else {
                        return "";
                    }
                }

                return "";
            }

        }

        vm.get_passenger_status_edit = function(member){
            // //console.log("MEMBER", member);
            if(member){

                if(member.is_member){
                    // //console.log("this one is true");
                    return "This passenger is already club member and hence is ready for flight";
                } else {

                    if(member.status == "accepted"){
                        return "This passenger has accepted the terms and is ready for flight";
                    } else if(member.status == "declined"){
                        return "This passenger has declined the terms";
                    } else if(member.status == "to_invite"){
                        return "Invitation will be sent once the booking is saved.";
                    } else if(member.status == "member"){
                        return "This passenger is a member";
                    } else if(member.status == "invited"){
                        return "This passenger has been invited but has not yet accepted.";
                    }else {
                        return "";
                    }
                }

                return "";
            }

        }

        vm.invite_new_passenger = function(index){

            //console.log("HERE");
            //console.log(vm.new_booking.passengers[index]);

            vm.show_new_passenger_invitation = true;
            vm.new_pax = index;


        }

        vm.close_passenger_invitation = function(){
            vm.new_pax = -1;
            vm.show_new_passenger_invitation = false;
        }

        $scope.get_members = function(name, index){


            ////console.log("get members", name);
            if((vm.club_id == 0 || !vm.club_id) && vm.new_booking.plane && vm.new_booking.plane.id){
                vm.club_id = vm.new_booking.plane.club_id;
            }

            if(name.length > 2){

                 MemberService.GetAllByClubAndName(vm.club_id, name)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.members = data.members;

                        if(vm.members.length < 1){
                            ////console.log("not found in members");
                            vm.new_booking.passengers[index].not_found = true;
                            vm.new_booking.passengers[index].email = "";
                            vm.new_booking.passengers[index].status = "";
                            vm.new_booking.passengers[index].first_name = "";
                            vm.new_booking.passengers[index].last_name = "";

                            
                           // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

                            var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            if(email_regex.test(name)){

                                vm.new_booking.passengers[index].email = name;

                            } else {
                                if(name.indexOf(" ") > -1){
                                    var splits = name.split(" ");
                                    vm.new_booking.passengers[index].first_name = splits[0];
                                    vm.new_booking.passengers[index].last_name = splits[1];
                                } else {
                                    vm.new_booking.passengers[index].first_name = name;
                                }
                            }


                        }

                    } else {
                        //clear original vals
                            vm.new_booking.passengers[index].status = "";
                            vm.new_booking.passengers[index].email = "";
                            vm.new_booking.passengers[index].first_name = "";
                            vm.new_booking.passengers[index].last_name = "";
                        //if email add the email here

                             var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            
                                       // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

                            if(email_regex.test(name)){
                                ////console.log("here we match?  it is an email?");
                                vm.new_booking.passengers[index].email = name;
                                vm.new_booking.passengers[index].not_found = true;

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

        $scope.save = function(){
            if(vm.action == "add"){
                ////console.log("CREATE click");
                $scope.create();
            } else {
                ////console.log("EDIT click");
                ////console.log(vm.club.membership);
                generate_datetimes();
                $scope.update();
            }
        }

        $scope.update = function() {
            var d = new Date();
            d.setHours( 14 );
            d.setMinutes( 0 );
            $scope.mytime = d;
        };

        vm.show_self_option = false;

        $scope.select_plane = function(val){
            $scope.check_rental_items();
            free_places();

            ////console.log("AIRCRAFT SELECTED");
            if( (vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ){
                vm.show_self_option = true;
            } else {
                vm.show_self_option = false;
            }


            if(vm.user.access.instructor.indexOf(vm.club_id) > -1){
                //console.log("THIS IS AN INSTRUCTOR IN THIS CLUB...");
                vm.booking_self = false;
            }

            
        }

        function generate_datetimes(){
            var start = new Date(vm.new_booking.start_date);
            var c = new Date();
            var start_split = (vm.new_booking.start_time) ? vm.new_booking.start_time.time.split(":") : [c.getHours(), c.getMinutes()];
            // var start_split = vm.new_booking.start_time.time.split(":");

            start.setHours(start_split[0]);
            start.setMinutes(start_split[1]);
            start.setSeconds(0);

            var end = new Date(vm.new_booking.end_date);
            //var end_split = vm.new_booking.end_time.time.split(":");
            var end_split = (vm.new_booking.end_time) ? vm.new_booking.end_time.time.split(":") : [c.getHours(), c.getMinutes()];

            end.setHours(end_split[0]);
            end.setMinutes(end_split[1]);
            end.setSeconds(0);

            vm.new_booking.start_datetime = moment(start).format("Y-M-D HH:mm");
            vm.new_booking.end_datetime = moment(end).format("Y-M-D HH:mm");
        }

        function get_times(data, tofrom){
            var date = $scope.myDatetimeRange.date[tofrom];
            var d = date.getDate();
            var m = date.getMonth();
            var y = date.getFullYear();
            
            //need to combuine both
            var a = data[tofrom];
            var h = a.slice(0,2);
            var i = a.slice(3,5);
            // i = (i == 00)? 0 : i;
            i = (i.toString() == "00")? 0 : i;

            // $scope.myDatetimeRange.date.from = new Date(y, m, d, h, m, 0);
            // //console.log("vars are: "+y+", "+m+", "+d+", "+h+", "+i+", "+0+" soooo");
            var date = new Date(y, m, d, h, i, 0);
            return date;
        }

        function check_business_hours(i, k = null, start = 0){
            //i is hours
            //k is minutes
            k = parseInt(k);
            i = parseInt(i);

            var this_step_disabled = 0; 
            if(vm.new_booking.options.business_hours){
                var split = vm.new_booking.options.business_hours.from.split(":");
                var split2 = vm.new_booking.options.business_hours.to.split(":");

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

            var this_date = new Date(vm.new_booking.start_date);

            //console.log("HERE WE GO this_date!", this_date);
            //console.log("HERE WE GO start_end!", start_end);
            //console.log("HERE WE GO vm[start_end]!", vm[start_end]);

            vm[start_end].forEach(function(time, i){

                //this may very well be the case function here to change when the re-do the times            
                var split_time = time.time.split(":");
                this_date.setHours(split_time[0]);
                this_date.setMinutes(split_time[1]);
                this_date.setSeconds(0);


                if( moment(this_date).isAfter(moment(compare_date)) ){
                    //vm[start_end][i].disabled = 0;
                    vm[start_end][i].disabled = check_business_hours(parseInt(split_time[0]), parseInt(split_time[1]), (start_end == "start_times")? 1 : 0);
                } else {
                    vm[start_end][i].disabled = 1;
                }
            });

        //by definition as we are changing something to cause this function from being called - we need to recalculate the times:
        calculate_duration();

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

    function add_hour_to_end(){
        var a = vm.new_booking.start_time.time.split(":");
        //var b = new Date();
        var b = new Date(vm.new_booking.start_date);
        b.setHours(a[0]);
        b.setMinutes(a[1]);
        b.setSeconds(0);
        var future = moment(b).add(1, "hour").format();
       // clean_times('after', 'end_times', future);
       //

         //clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', future);



        if(parseInt(a[0]) >= 23){
            if(moment(vm.new_booking.start_date).isSame(moment(vm.new_booking.end_date))){
                 // //console.log("THIS ADD DAY");
                // //console.log("start", vm.new_booking.start_date);
                // //console.log("end", vm.new_booking.end_date);
                 // //console.log("after or = 11pm - then we need to change the date that follows the same pattern");
                vm.new_booking.end_date = new Date(moment(vm.new_booking.end_date).add(1, "day").format());
                clean_times('future', 'end_times');

                //set it to 00:00 hours probably a wise thing...
                vm.new_booking.end_time = vm.end_times[0];


            } 
        } else {
            clean_times('after', 'end_times', b);
        }

    }


    function start_after_end(){
            var start_after_end = false;
            if(vm.new_booking.end_time){
                // //console.log("START AFTER END LOOP");
                var start_datetime = new Date(vm.new_booking.start_date);
                var start_time = vm.new_booking.start_time.time.split(":");
                start_datetime.setHours(start_time[0]);
                start_datetime.setMinutes(start_time[1]);
                start_datetime.setSeconds(0);

                var end_datetime = new Date(vm.new_booking.end_date);
                var end_time = vm.new_booking.end_time.time.split(":");
                end_datetime.setHours(end_time[0]);
                end_datetime.setMinutes(end_time[1]);
                end_datetime.setSeconds(0);

                if(moment(start_datetime).isAfter(moment(end_datetime)) || moment(start_datetime).isSame(end_datetime) || end_datetime == start_datetime){
                    start_after_end = true;
                }


            }
            return start_after_end;
    }


    function booking_today(){
        if(moment(vm.new_booking.start_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
            //console.log("WE ARE TODAY?");
            clean_times('today', 'start_times');

        } else {
            // //console.log("should get full day");
            if(moment(vm.new_booking.start_date).isAfter(moment()) ){
                clean_times('future', 'start_times');
            }
        }

        if(moment(vm.new_booking.end_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
            if(vm.new_booking.start_time){
               //console.log("START TIME", vm.new_booking.start_time);
                add_hour_to_end(); 
            }
            clean_times(check_relative_date(vm.new_booking.start_date), 'end_times');
        }


        if(vm.new_booking.end_date == vm.new_booking.start_date){
                // //console.log("booking today where end = start");
                if(vm.new_booking.start_time){
                    var a = vm.new_booking.start_time.time.split(":");
                    var b = new Date(vm.new_booking.start_date);
                    b.setHours(a[0]);
                    b.setMinutes(a[1]);
                    b.setSeconds(0);

                    //we need to check the times give
                    if(start_after_end()){
                        clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                        // //console.log("UPDATE END BITS IF START > END required?");
                        clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);
                        add_hour_to_end();
                    } else {
                        // //console.log("UPDATE END BITS IF START > END 2", check_relative_date(vm.new_booking.start_date, "end"));
                        clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);
                    }


                }
        }

    }

    // clean_times('today', 'start_times');
    booking_today();


    function check_relative_date(date, start_end = "start"){
        var relative = "today";
        // //console.log("RELATIVE TIME CHECK", date);
        if(moment(moment(date).format("YYYY/MM/DD")).isAfter(moment().format("YYYY/MM/DD"))){
            relative = "future";

            //then is after today
            // the catch is that if date == start / end date --> THEN we need to present that it is today even though it isnt - this is premise
            // that is valid only for the "END" cases (so that we return AFTER rather than today) --> otherwise the end_times available won't reflect
            //the fact that the start_times have been selected allowing the user to select an end time before start time (which is silly really...)

            if(vm.new_booking.start_date && vm.new_booking.end_date && start_end == "end"){
                if(moment(vm.new_booking.start_date).isSame(moment(vm.new_booking.end_date))){
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


      if($stateParams.start){
                    //alert("add");
                    vm.new_booking.start_date = new Date($stateParams.start);
                    vm.new_booking.end_date = new Date($stateParams.start);
                    vm.new_booking.start_time = {time: moment($stateParams.start).format("HH:mm")};
                    vm.new_booking.end_time = {time: moment($stateParams.start).add(30, "minutes").format("HH:mm") };

                    vm.default_date = vm.new_booking.start_date;



                    setTimeout(function(){


                        //console.log("CALL ME HERE BOOBS");


                        var new_event = {
                                         "id":"TEMP",
                                         "title":"TEMPORARY",
                                         "resourceId": 7,
                                         "start":"2021-03-21 19:30:00",
                                         "end":"2021-03-21 21:00:00",
                                         "editable":false,
                                         "color":"#FFcccc",
                                         "opacity":"1"
                                      };
                    

                                      $('#calendar').fullCalendar('renderEvent', new_event);


                    $scope.update_dateTime("edit2", $stateParams.plane_id);



                    }, 1000);

                    


      

                }




    $scope.make_booking = function(isValid){

        //console.log("make booking", isValid);
            $scope.submitted = true;
            // check to make sure the form is completely valid
            if(isValid) {
                // //console.log('our form is working');
                //then we send the booking request to the server woooohooooo!

                //clean and prepare the bits that we require
                var booking = {};
                var booking = jQuery.extend(true, {}, vm.new_booking); 
                // //console.log(booking);
                delete booking.options;
                delete booking.instructor;
                delete booking.plane;
                delete booking.start_date;
                delete booking.start_time;
                delete booking.end_date;
                delete booking.end_time;
                delete booking.start_datetime;
                delete booking.end_datetime;
                delete booking.tuition_required;
                delete booking.user;
                // //console.log(booking);
                // //console.log(vm.new_booking);

                //generate_datetimes();

                // //console.log("START DATE1 : ", vm.new_booking.start_datetime );

                // //console.log("START DATE2 : ", moment(vm.new_booking.start_datetime).isAfter() );
                // //console.log("START DATE3 : ", moment(vm.new_booking.start_datetime).isBefore() );

                // //console.log("START DATE4 : ", moment(Date.parse(vm.new_booking.start_datetime)) );
                // //console.log("END DATE : ", moment(vm.new_booking.end_datetime) );
                // //console.log("NOW : ", moment());

                if(moment(Date.parse(vm.new_booking.start_datetime)).isBefore()){
                    ToastService.warning('Past Booking', 'This booking ends in the past - you cannot create a booking in the past.');
                    return false;
                }
                //30 mintues leeway in case of booking starting within the 15 minute period or similar
                if(moment(Date.parse(vm.new_booking.start_datetime)).add(30, "minutes").isBefore()){
                    ToastService.warning('Past Booking', 'This booking starts in the past - you cannot create a booking in the past.');
                    return false;
                }





                booking.override = (vm.new_booking.override) ? vm.new_booking.override : 0;

                if(vm.booking_self){
                    // //console.log("SELF");
                    booking.user_id = vm.user.id;
                    booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;
                    // //console.log("USER IS ", booking.user_id);
                } else {
                    // //console.log("NON SELF");

                    booking.user_id = vm.new_booking.user.user_id;
                    if(vm.user.access.manager.indexOf(vm.club_id) > -1){
                        //admin does not automatically become the instructor...
                        booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;                
                    } else {
                        //then its an instructor - so likely booking for student not just member
                        booking.instructor_id = vm.user.id;                
                    }
                    booking.booked_by_admin_instructor = 1;
                    booking.override = 1;

                }
               




                booking.free_seats = (vm.new_booking.free_seats.constructor === Array) ? 0 : vm.new_booking.free_seats;
                booking.start = vm.new_booking.start_datetime;
                booking.end = vm.new_booking.end_datetime;               
                booking.plane_id = vm.new_booking.plane.id;
                booking.club_id = vm.new_booking.plane.club_id;
                booking.booked_by = vm.user.id;
                booking.course_id = (vm.new_booking.tuition_required) ? vm.new_booking.tuition_required.id : 0;

                // //console.log("UUID ",booking.user_id);

                // return false;

                // //console.log("new booking obj to be sent... ",booking);

                //make booking call with new_booking as items to send! :D wooohoooooooo :P
                BookingService.Create(vm.user.id, booking)
                .then(function(data){
                    //console.log(data);
                    if(data.success == true){
                        // //console.log("WAS SENT HERE! ");
                        $scope.clear_booking();
                        

                        BookingService.GetAll(vm.user.id, moment(vm.new_booking.start_date).format("Y-M-D"), "")
                            .then(function(data){

                                $scope.all_events = data.events;
                                $scope.all_resources = data.resources;

                                $('#calendar').fullCalendar('refetchEvents');
                                $('#calendar').fullCalendar('removeEvents');
                                $('#calendar').fullCalendar('addEventSource', $scope.all_events);
                            });

                        

                        //$("#calendar").fullCalendar("refetchEvents");
                        //must have some sort of feedback saying booking was made successfully!
                        $state.go('dashboard.bookings.add');
                    } else {

                        // //console.log("clearly something went wrong here... :'-( ", data.message);
                        //if it is something about currency - perhaps return the possibility of self-certify or book instructor for this purpose!
                        
                        if(data.more && data.more.length > 0){
                            // //console.log("MORE");
                            var addon = "";

                            for(var i=0;i<data.more.length;i++){
                                if(data.more[i]["name"] == "differences_verified"){
                                    addon += "\n - Your differences training sign-offs need to be verified by a member of staff. \n";
                                }
                                if(data.more[i]["name"] == "licence_verified"){
                                    addon += "\n - Your licence needs to be verified by a member of staff. \n";
                                }
                                if(data.more[i]["name"] == "medical_verified"){
                                    addon += "\n - Your medical needs to be verified by a member of staff. \n";
                                }
                                if(data.more[i]["name"] == "medical"){
                                    addon += "\n - You need to upload a copy of your medical. \n";
                                }
                                if(data.more[i]["name"] == "licence"){
                                    addon += "\n - You need to upload a copy of your licence. \n";
                                }
                                if(data.more[i]["name"] == "differences"){
                                    addon += "\n - You need to upload a copy of your differences training signed off. \n";
                                }
                                // addon += "You need to add your "+data.more[i][0]+" to book solo";
                            }
                            // //console.log("MORE:: ", addon);

                            data.message = data.message + addon;
                        }

                        ToastService.error('Error', data.message);
                    }
                    
                });


            } else {
                //console.log("NOT SENT - please fix errors");
            }

    }






















        
        

      












        // MODALS FOR ALL THE POPUPS TO BE CHANGED INTO --> SAMPLE HERE

        // var warning_msg = "By deleting this membership, you will also cancel all reservations that this membership currently has."

        $scope.popup2 = {
          opened: false
        };

        $scope.popup3 = {
          opened: false
        };

        $scope.popup4 = {
          opened: false
        };
          
        $scope.open2 = function() {
          $scope.popup2.opened = true;
        };

          $scope.open3 = function() {
          $scope.popup3.opened = true;
        };

          $scope.open4 = function() {
          $scope.popup4.opened = true;
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