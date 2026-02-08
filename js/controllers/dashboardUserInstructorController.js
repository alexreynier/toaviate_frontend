 app.controller('DashboardUserInstructorController', DashboardUserInstructorController);

    DashboardUserInstructorController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window'];
    function DashboardUserInstructorController(UserService, MemberService, InstructorService, MembershipService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        vm.club.member = {};
        
        vm.imported_new_headers = [];

        // vm.club.member.membership_id = {};
        
        vm.action = $state.current.data.action;
        

        vm.user = $rootScope.globals.currentUser;
        // vm.club_id = 6;
        // vm.user_id = 59;
        vm.user_id = vm.user.id;



        vm.no_show_cols = ["membership_start", "membership_id", "selected"];


        $scope.sortType     = 'Email'; // set the default sort type
        $scope.sortReverse  = false;  // set the default sort order
        $scope.searchTool   = '';     // set the default search/filter term




          $scope.mytime = new Date();

          $scope.hstep = 1;
          $scope.mstep = 15;

         vm.days = [
            {
                day: "Monday",
                from_variable: "monday_from_time",
                to_variable: "monday_to_time",
                disabled_variable: "monday_disabled"
            },
            {
                day: "Tuesday",
                from_variable: "tuesday_from_time",
                to_variable: "tuesday_to_time",
                disabled_variable: "tuesday_disabled"
            },
            {
                day: "Wednesday",
                from_variable: "wednesday_from_time",
                to_variable: "wednesday_to_time",
                disabled_variable: "wednesday_disabled"
            },
            {
                day: "Thursday",
                from_variable: "thursday_from_time",
                to_variable: "thursday_to_time",
                disabled_variable: "thursday_disabled"
            },
            {
                day: "Friday",
                from_variable: "friday_from_time",
                to_variable: "friday_to_time",
                disabled_variable: "friday_disabled"
            },
            {
                day: "Saturday",
                from_variable: "saturday_from_time",
                to_variable: "saturday_to_time",
                disabled_variable: "saturday_disabled"
            },
            {
                day: "Sunday",
                from_variable: "sunday_from_time",
                to_variable: "sunday_to_time",
                disabled_variable: "sunday_disabled"
            }
         ];


         var timezone = "Europe/London";

        // var from_default = new Date(luxon.DateTime.now().setZone(timezone).toISO());
        var from_default = new Date();
        from_default.setHours( 9 );
        from_default.setMinutes( 0 );

        // var to_default = new Date(luxon.DateTime.now().setZone(timezone).toISO());
        var to_default = moment.utc("2021-01-01T18:15:00Z").toISOString(); //moment.utc("2021-01-01T09:00Z").format(); //new Date();
        // to_default.setHours( 18 );
        // to_default.setMinutes( 0 );





        InstructorService.GetAvailability(vm.user.id)
                    .then(function(data){



                        vm.available_times = data;
                        for(var i =0;i<vm.available_times.length;i++){
                            //resetting all the defaults to 9am to 5pm every single day - prob should be done in the backend...
                            if(vm.available_times[i]["monday_from_time"] == vm.available_times[i]["monday_to_time"]){
                                // alert("now monday ==> ", vm.available_times[i]["monday_from_time"]);
                               vm.available_times[i]["monday_from_time"] = from_default;
                               vm.available_times[i]["monday_to_time"] = to_default;
                            }
                            if(vm.available_times[i]["tuesday_from_time"] == vm.available_times[i]["tuesday_to_time"]){
                               vm.available_times[i]["tuesday_from_time"] = from_default;
                               vm.available_times[i]["tuesday_to_time"] = to_default;
                            }
                            if(vm.available_times[i]["wednesday_from_time"] == vm.available_times[i]["wednesday_to_time"]){
                               vm.available_times[i]["wednesday_from_time"] = from_default;
                               vm.available_times[i]["wednesday_to_time"] = to_default;
                            }
                            if(vm.available_times[i]["thursday_from_time"] == vm.available_times[i]["thursday_to_time"]){
                               vm.available_times[i]["thursday_from_time"] = from_default;
                               vm.available_times[i]["thursday_to_time"] = to_default;
                            }
                            if(vm.available_times[i]["friday_from_time"] == vm.available_times[i]["friday_to_time"]){
                               vm.available_times[i]["friday_from_time"] = from_default;
                               vm.available_times[i]["friday_to_time"] = to_default;
                            }
                            if(vm.available_times[i]["saturday_from_time"] == vm.available_times[i]["saturday_to_time"]){
                               vm.available_times[i]["saturday_from_time"] = from_default;
                               vm.available_times[i]["saturday_to_time"] = to_default;
                            }
                            if(vm.available_times[i]["sunday_from_time"] == vm.available_times[i]["sunday_to_time"]){
                               vm.available_times[i]["sunday_from_time"] = from_default;
                               vm.available_times[i]["sunday_to_time"] = to_default;
                            }


                            // console.log("MONDAY === ");
                            // console.log("DEFAULT: ", vm.available_times[i]["monday_from_time"] );
                            // var a = vm.available_times[i]["monday_from_time"];
                            // var b = a.split(":");
                            // console.log("SPLIT: ", b);
                            // console.log("COMPOSED: "+b[0]+" and "+b[1]);
                            // console.log("PARSE", Date.parse("2021-01-01T"+vm.available_times[i]["monday_from_time"]+"Z", "HH:mm:s")  );
                            // console.log("PARSE2", Date.parseString(Date.parse("2021-01-01T"+vm.available_times[i]["monday_from_time"]+"Z").toString(), "HH:mm:s")  );
                            // //console.log('LUXON ', luxon.DateTime().fromFormat(vm.available_times[i]["monday_from_time"], "HH:mm:s") );
                            // console.log("PARSE3: ", Date.parseString(vm.available_times[i]["monday_to_time"], "HH:mm:s"));
                            // console.log("PARSE4: ", luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["monday_from_time"]+"Z").setZone("Europe/London").toLocaleString(luxon.DateTime.DATETIME_FULL)   ); //.toFormat('dd MMM yyyy HH:mm:s')


                            vm.available_times[i]["monday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["monday_from_time"]+"Z").setZone("UTC").toHTTP()) ; //Date(luxon.DateTime.now(), "HH:mm:s");//Date.parseString(Date.parse("2021-01-01T"+vm.available_times[i]["monday_from_time"]+"Z"), "HH:mm:s") ;//luxon.DateTime().fromFormat(vm.available_times[i]["monday_from_time"], "HH:mm:s") ;//Date.parseString(vm.available_times[i]["monday_from_time"], "HH:mm:s");
                            vm.available_times[i]["monday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["monday_to_time"]+"Z").setZone("UTC").toHTTP());// Date.parseString(vm.available_times[i]["monday_to_time"], "HH:mm:s");
                            vm.available_times[i]["monday_disabled"] = parseInt(vm.available_times[i]["monday_disabled"]);

                            vm.available_times[i]["tuesday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["tuesday_from_time"]+"Z").setZone("UTC").toHTTP()) ; //Date.parseString(vm.available_times[i]["tuesday_from_time"], "HH:mm:s");
                            vm.available_times[i]["tuesday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["tuesday_to_time"]+"Z").setZone("UTC").toHTTP()) ; //Date.parseString(vm.available_times[i]["tuesday_to_time"], "HH:mm:s"); 
                            vm.available_times[i]["tuesday_disabled"] = parseInt(vm.available_times[i]["tuesday_disabled"]);

                            vm.available_times[i]["wednesday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["wednesday_from_time"]+"Z").setZone("UTC").toHTTP()) ;//Date.parseString(vm.available_times[i]["wednesday_from_time"], "HH:mm:s");
                            vm.available_times[i]["wednesday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["wednesday_to_time"]+"Z").setZone("UTC").toHTTP()) ;//Date.parseString(vm.available_times[i]["wednesday_to_time"], "HH:mm:s");
                            vm.available_times[i]["wednesday_disabled"] = parseInt(vm.available_times[i]["wednesday_disabled"]);

                            vm.available_times[i]["thursday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["thursday_from_time"]+"Z").setZone("UTC").toHTTP()) ;//Date.parseString(vm.available_times[i]["thursday_from_time"], "HH:mm:s");
                            vm.available_times[i]["thursday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["thursday_to_time"]+"Z").setZone("UTC").toHTTP()) ;//Date.parseString(vm.available_times[i]["thursday_to_time"], "HH:mm:s");
                            vm.available_times[i]["thursday_disabled"] = parseInt(vm.available_times[i]["thursday_disabled"]);

                            vm.available_times[i]["friday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["friday_from_time"]+"Z").setZone("UTC").toHTTP()) ; //Date.parseString(vm.available_times[i]["friday_from_time"], "HH:mm:s");
                            vm.available_times[i]["friday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["friday_to_time"]+"Z").setZone("UTC").toHTTP()) ; //Date.parseString(vm.available_times[i]["friday_to_time"], "HH:mm:s");
                            vm.available_times[i]["friday_disabled"] = parseInt(vm.available_times[i]["friday_disabled"]);

                            vm.available_times[i]["saturday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["saturday_from_time"]+"Z").setZone("UTC").toHTTP()) ;///Date.parseString(vm.available_times[i]["saturday_from_time"], "HH:mm:s");
                            vm.available_times[i]["saturday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["saturday_to_time"]+"Z").setZone("UTC").toHTTP()) ;///Date.parseString(vm.available_times[i]["saturday_to_time"], "HH:mm:s");
                            vm.available_times[i]["saturday_disabled"] = parseInt(vm.available_times[i]["saturday_disabled"]);

                            vm.available_times[i]["sunday_from_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["sunday_from_time"]+"Z").setZone("UTC").toHTTP()) ;//Date.parseString(vm.available_times[i]["sunday_from_time"], "HH:mm:s");
                            vm.available_times[i]["sunday_to_time"] = new Date(luxon.DateTime.fromISO("2021-01-01T"+vm.available_times[i]["sunday_to_time"]+"Z").setZone("UTC").toHTTP()) ;//Date.parseString(vm.available_times[i]["sunday_to_time"], "HH:mm:s");
                            vm.available_times[i]["sunday_disabled"] = parseInt(vm.available_times[i]["sunday_disabled"]);




                        }

                        if(vm.available_times.length == 1){




                            if(vm.available_times[0]["monday_from_time"] == vm.available_times[0]["monday_to_time"]){
                                // alert("now monday ==> ", vm.available_times[i]["monday_from_time"]);
                               vm.available_times[0]["monday_from_time"] = from_default;
                               vm.available_times[0]["monday_to_time"] = to_default;
                            }
                            if(vm.available_times[0]["tuesday_from_time"] == vm.available_times[0]["tuesday_to_time"]){
                               vm.available_times[0]["tuesday_from_time"] = from_default;
                               vm.available_times[0]["tuesday_to_time"] = to_default;
                            }
                            if(vm.available_times[0]["wednesday_from_time"] == vm.available_times[0]["wednesday_to_time"]){
                               vm.available_times[0]["wednesday_from_time"] = from_default;
                               vm.available_times[0]["wednesday_to_time"] = to_default;
                            }
                            if(vm.available_times[0]["thursday_from_time"] == vm.available_times[0]["thursday_to_time"]){
                               vm.available_times[0]["thursday_from_time"] = from_default;
                               vm.available_times[0]["thursday_to_time"] = to_default;
                            }
                            if(vm.available_times[0]["friday_from_time"] == vm.available_times[0]["friday_to_time"]){
                               vm.available_times[0]["friday_from_time"] = from_default;
                               vm.available_times[0]["friday_to_time"] = to_default;
                            }
                            if(vm.available_times[0]["saturday_from_time"] == vm.available_times[0]["saturday_to_time"]){
                               vm.available_times[0]["saturday_from_time"] = from_default;
                               vm.available_times[0]["saturday_to_time"] = to_default;
                            }
                            if(vm.available_times[0]["sunday_from_time"] == vm.available_times[0]["sunday_to_time"]){
                               vm.available_times[0]["sunday_from_time"] = from_default;
                               vm.available_times[0]["sunday_to_time"] = to_default;
                            }


                            //instructor of only one club
                            //alert("only 1");

                            vm.selected_club = vm.available_times[0];


                            //console.log("selected is : "+vm.selected_club);
                            //console.log(vm.selected_club);
                            //console.log(vm.selected_club.club_id);

                            vm.selected_now = $.grep(vm.available_times, function(e){ 
                                    return e.club_id == vm.selected_club.club_id; 
                            });
                            //console.log(vm.selected_now);
                            vm.available_time = vm.selected_now[0];


                        }





                    });


// Some testing variables

        // vm.available_times = [{
        //     club_id: 6,
        //     club_name: "Alex's Club",
            
        //     monday_from_time: from_default,
        //     monday_to_time: to_default,
        //     monday_disabled: false,

        //     tuesday_from_time: from_default,
        //     tuesday_to_time: to_default,
        //     tuesday_disabled: false,

        //     wednesday_from_time: from_default,
        //     wednesday_to_time: to_default,
        //     wednesday_disabled: false,

        //     thursday_from_time: from_default,
        //     thursday_to_time: to_default,
        //     thursday_disabled: false,

        //     friday_from_time: from_default,
        //     friday_to_time: to_default,
        //     friday_disabled: false,

        //     saturday_from_time: from_default,
        //     saturday_to_time: to_default,
        //     saturday_disabled: false,

        //     sunday_from_time: from_default,
        //     sunday_to_time: to_default,
        //     sunday_disabled: false

        // },
        // {

        //     club_id: 8,
        //     club_name: "Alouette Club",

        //     monday_from_time: from_default,
        //     monday_to_time: to_default,
        //     monday_disabled: false,

        //     tuesday_from_time: from_default,
        //     tuesday_to_time: to_default,
        //     tuesday_disabled: false,

        //     wednesday_from_time: from_default,
        //     wednesday_to_time: to_default,
        //     wednesday_disabled: false,

        //     thursday_from_time: from_default,
        //     thursday_to_time: to_default,
        //     thursday_disabled: false,

        //     friday_from_time: from_default,
        //     friday_to_time: to_default,
        //     friday_disabled: false,

        //     saturday_from_time: from_default,
        //     saturday_to_time: to_default,
        //     saturday_disabled: false,

        //     sunday_from_time: from_default,
        //     sunday_to_time: to_default,
        //     sunday_disabled: false

        // }];


       

        // if(vm.available_times.length > 1){
        //     vm.available_time = vm.available_times[0]; //this will be the selected state.
        //     vm.selected_club = vm.available_times[0]; //this will be the selected state.
        // } else {
        //     vm.available_time = vm.available_times[0]; //this will be the selected state.
        //     vm.selected_club = vm.available_times[0]; //this will be the selected state.
        // }

        $scope.ismeridian = false;
        $scope.toggleMode = function() {
            $scope.ismeridian = ! $scope.ismeridian;
        };

        $scope.update_time = function(name) {
            var d = new Date();
            d.setHours( 14 );
            d.setMinutes( 0 );
            vm.available_time[name] = d;
        };

          $scope.changed_time = function(name) {
            console.log('Time changed to: ' + vm.available_time[name]);
          };

          $scope.disable_time = function(day){
            vm.available_time[day] = (vm.available_time[day]) ? false : true;
          }

          $scope.change_club = function(){
            //console.log("selected is : "+vm.selected_club);
            //console.log(vm.selected_club);
            //console.log(vm.selected_club.club_id);

            vm.selected_now = $.grep(vm.available_times, function(e){ 
                    return e.club_id == vm.selected_club.club_id; 
            });
            //console.log(vm.selected_now);
            vm.available_time = vm.selected_now[0];

            // vm.available_time = vm.selected_club;
          }

          $scope.save_club_times = function(){

            //vm.available_times
            //console.log("selected club is:", vm.available_time);
            //console.log("selected club is:", vm.selected_club);
            //.toUTCString()
            //actually update it...

  


            InstructorService.SetAvailability(vm.available_time)
                    .then(function(data){
                        //console.log("CHECK IT HAS BEEN DEALT WITH");
                        //console.log(data);



                    });

                    //console.log("LENGTH BEFORE: "+vm.available_times.length);
            
                    vm.available_times = $.grep(vm.available_times, function(e){ 
                                return e.club_id != vm.available_time.club_id; 
                        });
                    //console.log("LENGTH AFTER: "+vm.available_times.length);

                    //console.log("PUSING: ");
                    //console.log(vm.available_time);

                    vm.available_times.push(vm.available_time);

                    $state.go('dashboard.manage_user.instructor_availability');

            

          }

          // $scope.clear = function() {
          //   $scope.mytime = null;
          // };


/* ----------------------------------------------------------------------- */




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

                MemberService.GetMemberPlanes($stateParams.member_id, vm.club_id)
                    .then(function(data){
                        vm.club.planes = data;   
                        //console.log(vm.club.planes);
                    });

                 MemberService.GetById($stateParams.member_id, vm.club_id)
                    .then(function(data){
                        vm.club.member = data;   
                        //console.log(vm.club);
                        vm.club.member.is_manager = (vm.club.member.is_manager == 1) ? true : false;
                        vm.club.member.approved = (vm.club.member.approved == 1) ? true : false;
                        vm.club.member.instructor = (vm.club.member.instructor == 1) ? true : false;
                        vm.club.member.membership_start = Date.parse(vm.club.member.membership_start);
                        vm.page_title = "Edit a Member - "+vm.club.member.first_name+" "+vm.club.member.last_name;

                        vm.club.member.membership_start = new Date(vm.club.member.membership_start);

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
                        club_id: vm.club_id
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
            vm.club.member.club_id = vm.club_id;
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
            vm.club.member.club_id = vm.club_id;
           
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