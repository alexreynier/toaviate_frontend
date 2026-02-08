 app.controller('DashboardUserInstructorHolidayController', DashboardUserInstructorHolidayController);

    DashboardUserInstructorHolidayController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig'];
    function DashboardUserInstructorHolidayController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig) {
        var vm = this;

        var defaultStartTime = 480;
        var defaultEndTime = 1080;

        $scope.va1 = '123';
        
        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        vm.club.member = {};
        
        vm.imported_new_headers = [];

        // vm.club.member.membership_id = {};
        
        vm.action = $state.current.data.action;



        //vm.club_id = 6;
        //vm.user_id = 59;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        vm.no_show_cols = ["membership_start", "membership_id", "selected"];

        var newDate = new Date();
        
        var h_start = Math.floor( defaultStartTime / 60);          
        var i_start = defaultStartTime % 60;
        var h_end = Math.floor( defaultEndTime / 60);          
        var i_end = defaultEndTime % 60;

        var defaultStart = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_start, i_start, 0);
        var defaultEnd = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_end, i_end, 0);


        $scope.myDatetimeRange = {
            date: {
                from: defaultStart,
                to: defaultEnd
            },
            time: {
                from: defaultStartTime, // default low value
                to: defaultEndTime, // default high value
                step: 15, // step width
                minRange: 15, // min range
                hours24: true // true for 24hrs based time | false for PM and AM
            }
        };

        $scope.myDatetimeLabels = {
            date: {
                from: 'Start date',
                to: 'End date'
            }
        };

    $scope.toggle = true;
    $scope.toggleDirective = function() {
        $scope.toggle = !$scope.toggle;
    };

    $scope.whentimechangedata = {};
    $scope.overridePicker = true;




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

    $scope.whenTimeChange = function (data) {
        // //console.log('schedule changes', data);
      
        var from = get_times(data, "from");
        var to = get_times(data, "to");

        $scope.myDatetimeRange.date.from = from;
        $scope.myDatetimeRange.date.to = to;
        //from and to are datetimes


        $scope.whentimechangedata = data;
    };

    // show only time slider
    $scope.timeRangePicker = {
        time: {
            from: 480, // default low value
            to: 1020, // default high value
            step: 15, // step width
            minRange: 15, // min range
            hours24: true // true for 24hrs based time | false for PM and AM
        }
    };

    // show only date pickers
    $scope.dateRangePicker = {
        date: {
            from: new Date(),
            to: new Date()
        }
    };



    // directive with max range in date pickers
    var
        _today      = new Date(),
        _yesterday  = new Date( _today.getTime() - (86400000 * 10) );

    $scope.datePickerWithRange = {
        date: {
            from: new Date(),
            to: new Date(),
            max: _today,
            min: _yesterday
        },
        time: {
            from: 420, // default low value
            to: 1020, // default high value
            step: 15, // step width
            minRange: 15, // min range
            hours24: true // true for 24hrs based time | false for PM and AM
        }
    };


    // $scope.maxRangeDate = 5; //days

/*
        $scope.sortType     = 'Email'; // set the default sort type
        $scope.sortReverse  = false;  // set the default sort order
        $scope.searchTool   = '';     // set the default search/filter term

        $scope.myDatetimeRange = {
          "time": {
            "from": 480,
            "to": 1215,
            "dFrom": 0,
            "dTo": 1440,
            "step": 15,
            "minRange": 15,
            "hours24": false
          },
          "hasDatePickers": false,
          "hasTimeSliders": true
        };


   
    $scope.myDatetimeLabels = {
        date: {
            from: 'Start date',
            to: 'End date'
        }
    };


    $scope.toggle = true;
    $scope.toggleDirective = function() {
        $scope.toggle = !$scope.toggle;
    };

    $scope.whentimechangedata = {};

    $scope.whenTimeChange = function (data) {
        //console.log('schedule changes', data);
        $scope.whentimechangedata = data;
    };

    // show only time slider
    $scope.timeRangePicker = {
        time: {
            from: 480, // default low value
            to: 1020, // default high value
            step: 15, // step width
            minRange: 15, // min range
            hours24: false // true for 24hrs based time | false for PM and AM
        }
    };

    // show only date pickers
    $scope.dateRangePicker = {
        date: {
            from: new Date(),
            to: new Date()
        }
    };

    // directive with max range in date pickers
    var
        _today      = new Date(),
        _yesterday  = new Date( _today.getTime() - (86400000 * 10) );

    $scope.datePickerWithRange = {
        date: {
            from: new Date(),
            to: new Date(),
            max: _today,
            min: _yesterday
        }
    };
    $scope.maxRangeDate = 5; //days


          $scope.mytime = new Date();


AND THE HTML IS:
                            <div rg-range-picker="myDatetimeRange" labels="myDatetimeLabels"></div>


*/







/* ----------------------------------------------------------------------- */


    var date = new Date();
    var d = date.getDate();
    var m = date.getMonth();
    var y = date.getFullYear();

    /* event source that pulls from google.com */
    // $scope.eventSource = {
    //         url: "http://www.google.com/calendar/feeds/usa__en%40holiday.calendar.google.com/public/basic",
    //         className: 'gcal-event',           // an option!
    //         currentTimezone: 'America/Chicago' // an option!
    // };

    /* event source that contains custom events on the scope */
     $scope.events = [];
    //   {title: 'All Day Event',start: new Date(y, m, 1)},
    //   {title: 'Long Event',start: new Date(y, m, d - 5),end: new Date(y, m, d - 2)},
    //   {id: 999,title: 'Repeating Event',start: new Date(y, m, d - 3, 16, 0),allDay: false},
    //   {id: 999,title: 'Repeating Event',start: new Date(y, m, d + 4, 16, 0),allDay: false},
    //   {title: 'Birthday Party',start: new Date(y, m, d + 1, 19, 0),end: new Date(y, m, d + 1, 22, 30),allDay: false},
    //   {title: 'Click for Google',start: new Date(y, m, 28),end: new Date(y, m, 29),url: 'http://google.com/'}
    // ];

     HolidayService.GetAll(vm.user.id)
        .then(function(data){
             for(var i=0; i<data.length;i++){
                 $scope.events.push({
                     id: data[i].id,
                     title: data[i].title,
                     start: new Date(data[i].from_date),
                     end: new Date(data[i].to_date),
                     allDay: data[i].allDay,
                     className: ['customFeed']
                 });
             }

             //console.log("bits of events = ", $scope.events);

        });


    /* event source that calls a function on every view switch */
    // $scope.eventsF = function (start, end, timezone, callback) {
    //   var s = new Date(start).getTime() / 1000;
    //   var e = new Date(end).getTime() / 1000;
    //   var m = new Date(start).getMonth();
    //   var events = [{title: 'Feed Me ' + m,start: s + (50000),end: s + (100000),allDay: false, className: ['customFeed']}];
    //   callback(events);
    // };

    // $scope.calEventsExt = {
    //    color: '#f00',
    //    textColor: 'yellow',
    //    events: [
    //       {type:'party',title: 'Lunch',start: new Date(y, m, d, 12, 0),end: new Date(y, m, d, 14, 0),allDay: false},
    //       {type:'party',title: 'Lunch 2',start: new Date(y, m, d, 12, 0),end: new Date(y, m, d, 14, 0),allDay: false},
    //       {type:'party',title: 'Click for Google',start: new Date(y, m, 28),end: new Date(y, m, 29),url: 'http://google.com/'}
    //     ]
    // };



    /* alert on eventClick */
    $scope.alertOnEventClick = function( date, jsEvent, view){
        $scope.alertMessage = (date.title + ' was clicked ');

        //show event details

    };

    /* alert on Drop */
     $scope.alertOnDrop = function(event, delta, revertFunc, jsEvent, ui, view){
  
        // for(var i = 0; i < $scope.events.length; i++){
        //     if($scope.events[i]._id == event._id){
        //         $scope.events[i].start = moment(event.start + delta);
        //         $scope.events[i].end = moment(event.end + delta);
        //     }
        // }


        // //console.log(event);

        //event was updated --> please save
        HolidayService.Update(vm.user.id, event)
        .then(function(data){
            //console.log(data);
        });

       $scope.alertMessage = ('Event Updated');
    };

    /* alert on Resize */
    $scope.alertOnResize = function(event, delta, revertFunc, jsEvent, ui, view ){
        
        //event was updated --> please save
        HolidayService.Update(vm.user.id, event)
        .then(function(data){
            //console.log(data);
        });

       $scope.alertMessage = ('Event Updated');
    };



    /* add and removes an event source of choice */
    $scope.addRemoveEventSource = function(sources,source) {
      var canAdd = 0;
      angular.forEach(sources,function(value, key){
        if(sources[key] === source){
          sources.splice(key,1);
          canAdd = 1;
        }
      });
      if(canAdd === 0){
        sources.push(source);
      }
    };


   

    $scope.whole_day_booking = false;
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



    /* add custom event*/
    $scope.addEvent = function() {

      var myFrom = $scope.myDatetimeRange.date.from; 
      var myTo = $scope.myDatetimeRange.date.to; 

      // $scope.date_from = new Date(myFrom.getFullYear(), myFrom.getMonth(), myFrom.getDate(), 0, 0, 0);
      // $scope.date_to = new Date(myTo.getFullYear(), myTo.getMonth(), myTo.getDate(), 23, 59, 59);

      var new_event = {
        title: 'Holiday',
        start: myFrom,
        end: myTo,
        className: ['openSesame'],
        allDay: $scope.whole_day_booking
      };

      $scope.events.push(new_event);

      //editable: true / false can be added :)
      //create the event in the DB

      HolidayService.Create(vm.user.id, new_event)
        .then(function(data){
            //console.log(data);

            $state.go('dashboard.manage_user.instructor_holidays');

            
        });

    };

    /* remove event */
    $scope.remove = function(index) {

        var delete_id = $scope.events[index].id;
        // //console.log("DELETE: "+delete_id);
        // //console.log($scope.events[index]);

      HolidayService.Delete(vm.user.id, delete_id)
        .then(function(data){
            
            $scope.events.splice(index,1);

        });


    };

    /* Change View */
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

    

    /* Render Tooltip */
    $scope.eventRender = function( event, element, view ) {
        element.attr({'tooltip': event.title,
                      'tooltip-append-to-body': true});
        $compile(element)($scope);
    };

    /* config object */
    $scope.uiConfig = {
      schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
      calendar:{
        height: 650,
        editable: true,
        header:{
          left: 'title',
          center: '',
          right: 'today prev,next'
        },
        firstDay: 1,
        slotEventOverlap: false,
        eventClick: $scope.alertOnEventClick,
        eventDrop: $scope.alertOnDrop,
        eventResize: $scope.alertOnResize,
        eventRender: $scope.eventRender
      }
    };

    $scope.changeLang = function() {
    
        $scope.uiConfig.calendar.dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        $scope.uiConfig.calendar.dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
    };

    /* event sources array*/
    $scope.eventSources = [$scope.events];
    // $scope.eventSources2 = [$scope.calEventsExt, $scope.eventsF, $scope.events];



/* ------------------------------------------------------------------------ */










        ////console.log("club_id : "+vm.club_id);

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);

        switch(vm.action){
            case "add":
                //console.log("adding a new member please");
                vm.page_title = "Add a New member";

                

            break;
            case "edit":
                //console.log("edit an existing membership");

                // MemberService.GetMemberPlanes($stateParams.member_id, vm.club_id)
                //     .then(function(data){
                //         vm.club.planes = data;   
                //         //console.log(vm.club.planes);
                //     });

                //  MemberService.GetById($stateParams.member_id, vm.club_id)
                //     .then(function(data){
                //         vm.club.member = data;   
                //         //console.log(vm.club);
                //         vm.club.member.is_manager = (vm.club.member.is_manager == 1) ? true : false;
                //         vm.club.member.approved = (vm.club.member.approved == 1) ? true : false;
                //         vm.club.member.instructor = (vm.club.member.instructor == 1) ? true : false;
                //         vm.club.member.membership_start = Date.parse(vm.club.member.membership_start);
                //         vm.page_title = "Edit a Member - "+vm.club.member.first_name+" "+vm.club.member.last_name;

                //         vm.club.member.membership_start = new Date(vm.club.member.membership_start);

                //         // $("#membership_start").datepicker({
                //         //     format: 'dd-mm-yyyy',
                //         //     startDate: vm.club.member.membership_start,
                //         //     endDate: ''
                //         //   }).on("show", function() {
                //         //     $(this).val(new Date()).datepicker('update');
                //         //   });

                //     });

                //  MembershipService.GetAllByClub(vm.club_id)
                //     .then(function(data){
                //         vm.club.memberships = data;   
                //         // vm.club.member.membership_id.selected = vm.club.member.membership_id;
                //         // vm.membership = vm.club.member.membership_name;
                //         // vm.club.membership = vm.club.member.membership_name;
                //         //console.log(vm.club.memberships);
                //     });
            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                // MemberService.GetAllByClub('6')
                //     .then(function(data){
                //         vm.club.members = data;   
                //         //console.log(vm.club.members);
                //     });

                //  MembershipService.GetAllByClub(vm.club_id)
                //     .then(function(data){
                //         vm.club.memberships = data;   
                //         // vm.club.member.membership_id.selected = vm.club.member.membership_id;
                //         // vm.membership = vm.club.member.membership_name;
                //         // vm.club.membership = vm.club.member.membership_name;
                //         //console.log(vm.club.memberships);
                //     });
                // $scope.checkAll = function () {
                //     //console.log("check all");
                //     if ($scope.selectedAll) {
                //         $scope.selectedAll = true;
                //     } else {
                //         $scope.selectedAll = false;
                //     }
                //     angular.forEach(vm.club.members, function(member) {
                //         member.selected = $scope.selectedAll;
                //     });
                // };


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
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.club.membership);
                $scope.update();
            }
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

       


        $scope.processData = function() {
            //get the stuff
            allText = vm.import_users;
            var tobesorter = {
                csv: vm.import_users,
                separator: ",",
                header: true
            }
            vm.imported_users = $scope.csvToJSON(tobesorter);

             for(var b=0;b<vm.imported_users.length;b++){
                if(vm.imported_users[b].membership_start){
                    vm.imported_users[b].membership_start = new Date(vm.imported_users[b].membership_start);
                } else {
                    vm.imported_users[b].membership_start = new Date();
                }
                //below set the default membership perhaps?
                vm.imported_users[b].membership_id = 4;
                vm.imported_users[b].membership = { membership_id: 4, membership_name: "Annual Membership" };
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
            membership_id: "Membership Name"
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
                //console.log("ALL HEADERS HERE ! YAY!");
                
                for(var b=0;b<vm.imported_users.length;b++){
                    if(vm.imported_users[b].membership){
                        if(vm.imported_users[b].membership.membership_id){
                            vm.imported_users[b]["membership_id"] = vm.imported_users[b].membership.membership_id;
                            delete vm.imported_users[b].membership;
                        }
                    }
                }

                //console.log("===--->===");
                //console.log(vm.imported_users);
                //console.log("===--->===");

                vm.imported_new_headers.push("membership_id");
                vm.imported_new_headers.push("membership_start");

                //now we generate the users with the correct headings for our tables
                var to_import_users = [];
                for(var d=0; d<vm.imported_users.length;d++){
                    var obj = {
                        user: {},
                        club_id: 6
                    };
                    for(var c=0; c<vm.imported_new_headers.length;c++){
                        if(vm.imported_new_headers[c]){
                            //console.log(vm.imported_new_headers[c]);
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
                //console.log("--==--");
                //console.log(to_import_users);
                //console.log("--==--");

                //now that we have what we want to add to our 
                MemberService.CreateMany(to_import_users)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.members');
                });

            } else {
                //console.log("missing key elements in headers!");
                alert("You must select the First Name, Last Name and Email Address to be able to add the user to the system!");
            }
        


        }


        $scope.create = function(){
            //console.log("CREATE ME NOW");
            vm.club.member.club_id = 6;
            MemberService.Create(vm.club.member)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club.members');
                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            alert("Are you sure you would like to delete this membership?");
            MemberService.Update(vm.club.membership)
                .then(function(data){
                    //console.log(data);
                });
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.member.club_id = 6;
           
            MemberService.Update(vm.club.member)
                        .then(function(data){
                            //console.log(data);
                            //console.log("saved");
                            $state.go('dashboard.manage_club.members');
                        });
                        
            MemberService.SaveMemberPlanes(vm.club.member.id, vm.club.member.club_id, vm.club.planes)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved THE PLANES");
                     
                });

                //         function SaveMemberPlanes(user_id, club_id, planes){

        }

        $scope.selected_members = function(type){
            //get the selected members
            //console.log(vm.club.members);
            vm.selected_members = $.grep(vm.club.members, function(e){ 
                return e.selected == true; 
            });
            //console.log(vm.selected_members);

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

            $state.go('dashboard.manage_club.members');

        }

        $scope.update_membership = function(item, model){
            vm.club.member.membership_id = item.membership_id;
            vm.club.member.membership_name = item.membership_name;
        }

        initController();

        function initController() {
           //console.log("check if access is okay");
        }


        var warning_msg = "By deleting this membership, you will also cancel all reservations that this membership currently has."

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