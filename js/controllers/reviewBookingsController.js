
 app.controller('ReviewBookingsController', ReviewBookingsController);

    ReviewBookingsController.$inject = ['UserService','$cookieStore', 'BookingService', 'BookoutService', '$rootScope','$scope',  '$location', 'AuthenticationService'];
    function ReviewBookingsController(UserService, $cookieStore, BookingService, BookoutService, $rootScope, $scope, $location, AuthenticationService) {
        var vm = this;

        if(!$rootScope.globals.currentUser){
            AuthenticationService.CheckLoggedIn()
            .then(function(data){
                //console.log("DATA : ", data);
            });
        }

        vm.user = $rootScope.globals.currentUser;
        // //console.log("ROOTSCOPE", $rootScope.globals);

         //CheckLoggedIn

        vm.bookings = [];
        
        // //console.log("vmuser", vm.user);
        vm.allUsers = [];

        vm.clubs = [];

        var defaultStartTime = 480;
        var defaultEndTime = 1080;
        //calendar dates setup
        var newDate = new Date();
        var h_start = Math.floor( defaultStartTime / 60 );          
        var i_start = defaultStartTime % 60;
        var h_end = Math.floor( defaultEndTime / 60 );          
        var i_end = defaultEndTime % 60;
        var defaultStart = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_start, i_start, 0);
        var defaultEnd = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_end, i_end, 0);
        vm.default_date =  new Date();

        initController();

        function initController() {
           //console.log("check if access is okay");
        }




        //vm.default_date

        function get_the_approval_list(){
            BookingService.GetBookingsToReview(vm.user.id)
                    .then(function(data){

                        vm.bookings = data.bookings;   
                        
                    });
        }
        get_the_approval_list();

        $scope.all_events = [];
        $scope.all_resources = [];

        // BookingService.GetAllInstructor(vm.user.id, moment().format("Y-M-D"), "")
        //     .then(function(data){
        //         $scope.all_events = data.events;
        //         $scope.all_resources = data.resources;

        //         $('#calendar').fullCalendar('refetchEvents');
        //         $('#calendar').fullCalendar('removeEvents');
        //         $('#calendar').fullCalendar('addEventSource', $scope.all_events);

        //     });




        $scope.approve_booking = function(id){

            //approve me pleaseeeee
            BookingService.AcceptBooking(id, vm.user.id)
            .then(function(data){
                // //console.log(data);
                // //console.log("This has been approved...");
                get_the_approval_list();

            });
        }

        $scope.decline_booking = function(id){

            //decline me pleaseeeee
            BookingService.DeclineBooking(id, vm.user.id, {})
            .then(function(data){
                // //console.log(data);
                // //console.log("This has been decline...");
                get_the_approval_list();
                
            });

        }

        $scope.view_booking = function(id, start){

            //decline me pleaseeeee
            BookingService.GetAllInstructor(vm.user.id, start, "")
            .then(function(data){
                //console.log(data);

                // vm.default_date = new Date(start);
                // //console.log("DATE", vm.default_date);
                $("#calendar").fullCalendar("gotoDate", vm.default_date);


                //VERY hacky... not good - but it scrolls to the right place... maybe add a 

                var w = parseInt($('a.fc-timeline-event.booking'+id).css("left"));
                var b = parseInt($('a.fc-timeline-event.booking'+id).width());
                 let offsetEvent = w + (b/2) - ($('tbody .fc-time-area .fc-scroller').width()  / 2);

                $('tbody .fc-time-area .fc-scroller').animate({
                    scrollLeft:  offsetEvent
                }, 600);


                $scope.all_events = data.events;
                $scope.all_resources = data.resources;

                //animate the colour change
                $('a.fc-timeline-event.booking'+id).removeClass("highlight_item");
                setTimeout(function(){
                    $('a.fc-timeline-event.booking'+id).addClass("highlight_item");
                }, 200);

                // //console.log("hello", $scope.all_events);
                // //console.log("hello", $scope.all_resources);

                return data;

            });

        }



        //copy from the bookignsController
        $scope.updateEvents = function(start, end){
        ////console.log("start", start, "end", end);

        BookingService.GetAllInstructor(vm.user.id, start, end)
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
            vm.see_booking.can_be_edited = moment().isAfter(moment(vm.see_booking.end));

            $scope.$apply();
    };

    $scope.changeLang = function() {
    
        $scope.uiConfig.calendar.dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        $scope.uiConfig.calendar.dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
    };

    $scope.changed = function () {
        $log.log('Time changed to: ' + $scope.mytime);
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

        // //console.log("START", vm.new_booking.start_datetime);
        console.log("START REVIEWBOOKINGS", new Date(vm.new_booking.start_datetime).toIsoString());
        // //console.log("END", vm.new_booking.end_datetime);

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


    $scope.addOne = function(){
        $state.go('dashboard.bookings.add');
    }

    $scope.cancel_changes = function(){
        //$state.go('dashboard.bookings');
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


    $scope.update_booking = function(valid){
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
                // //console.log(booking);
                // //console.log(vm.new_booking);
                booking.free_seats = (vm.new_booking.free_seats.constructor === Array) ? 0 : vm.new_booking.free_seats;
                booking.start = vm.new_booking.start_datetime;
                booking.end = vm.new_booking.end_datetime;
                booking.tuition_id = vm.new_booking.tuition_required.id;

                // //console.log("START", booking.start);
                // //console.log("END", booking.end);

                booking.user_id = vm.user.id;
                booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;
                booking.plane_id = vm.new_booking.plane.id;
                booking.override = (vm.new_booking.override) ? vm.new_booking.override : 0;
                booking.club_id = vm.new_booking.plane.club_id;

                // //console.log("====> booking to be sent = ", booking);

                check_before_changing_event(booking);

        }

    }

    $scope.update_club = function(){
            // //console.log("we changed club here");
            vm.club_id = vm.change_club.id;
            //now we need to update the planes the user can see on the calendar! 
            update_bookings();

    }

    function update_bookings(){
         BookingService.GetAllUserClub(vm.user.id,vm.club_id, moment().format("Y-M-D"), "")
                .then(function(data){
                   
                    $scope.all_events = data.events;
                    $scope.all_resources = data.resources;

                });
    }

    /* alert on eventClick */
    $scope.alertOnEventClick = function( date, jsEvent, view){
        $scope.alertMessage = (date.title + ' was clicked ');
        // //console.log(event);
        //show event details

    };

    /* alert on Drop */
     $scope.alertOnDrop = function(event, delta, revertFunc, jsEvent, ui, view){
  

        check_before_changing_event(event);
       
    };


    /* alert on Resize */
    $scope.alertOnResize = function(event, delta, revertFunc, jsEvent, ui, view ){
        
        check_before_changing_event(event);

    };



    $scope.override_booking_change = function(override){

        vm.error_event[override] = true;
        check_before_changing_event(vm.error_event);


    }

    $scope.decline_booking_change = function(){

        vm.booking_errors = {};
        vm.error_event = {};
        $('#calendar').fullCalendar('removeEvents');
        $('#calendar').fullCalendar('addEventSource', all_events);

    }


    function check_before_changing_event(event){
        //the important bit is the eventID 


        var evnt = jQuery.extend({}, event);


        

        // evnt.start = moment(evnt.start).format("YYYY-MM-DD HH:mm");
        // evnt.end = moment(evnt.end).format("YYYY-MM-DD HH:mm");
        
        //this covers the change of plane for the booking...
        evnt.plane_id = event.resourceId;
        if(event.instructor_id !== ""){
            evnt.instructor_id = event.instructor_id;
                    if(event.tuition_required){
                        evnt.tuition_id = event.tuition_required.id;
                    }

        } else {
            evnt.instructor_id = "0";
        }


        // //console.log("evnt : ", evnt);
        // return false;

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

        // //console.log("UPDATE CONTENT BEFORE", evnt);

        BookingService.updateBooking(evnt, vm.user.id)
        .then(function(data){
            //console.log(data);

            if(data.success == true){
                //console.log("the booking did not need to be altered = and has been updated successfully.", evnt);

                //only if the edition is being made from the "edit" otherwise the changes are already reflected appropriately.
                if(evnt.edit_booking == 1){
                    $scope.$parent.updateEvents(evnt.start, evnt.end);
                }
                
                alert("Your changes were saved successfully");
                
                // if(vm.return_to == "bookout") {
                //     //console.log("WE ARE AT THE BOOKOUT BIT - SO RETURN THERE!!!");
                //     $state.go('dashboard.my_account.bookout_with_booking', { "booking_id": event.id });
                // } else {
                //     //console.log("NORMAL booking");
                //     $state.go('dashboard.bookings');
                // }



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
                        override: "instructor_override" 
                    });
                } else if(data.check_user !== true){
                    errors.push({
                        type: "check_user",
                        message: "It looks like your user account does not allow this booking to happen",
                        api: data.check_user,
                        override: "currency_override" 
                    });
                } else if(data.rental_items !== true){
                    errors.push({
                        type: "rental_items",
                        message: "It looks like some of the rental items are not available",
                        api: data.rental_items,
                        override: "update_rental_items" 
                    });
                }


                //show the errors:::

                //console.log("ERRORS ARE : ", errors);
                alert("ERROR FOUND IN ALTERING THE BOOKING");

                vm.booking_errors = errors;
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


        // BookoutService.GetBookoutsToComplete(vm.user.id)
        //             .then(function(data){

        //                 vm.bookouts = data.bookouts;   
                        
        //             });



    }