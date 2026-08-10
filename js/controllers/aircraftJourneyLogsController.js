 app.controller('AircraftJourneyLogsController', AircraftJourneyLogsController);

    AircraftJourneyLogsController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'ClubDocumentService', 'PlaneDocumentService', '$http', 'PlaneService', '$sce', 'ToastService', 'LogbookExportService', 'ManualFlightService'];
    function AircraftJourneyLogsController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, LicenceService, ClubDocumentService, PlaneDocumentService, $http, PlaneService, $sce, ToastService, LogbookExportService, ManualFlightService) {
        
        var vm = this;

        vm.clubs = [];
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;


        vm.looking_for = $stateParams.registration;
        if(vm.looking_for){
            $scope.my_search2 = vm.looking_for;
        }


        vm.defect_severity;
        vm.defect_severities = [
            { title: "No Fly Item - Ground the plane"},
            { title: "Flyable - needs to be checked at next maintenance"},
            { title: "Not urgent - but needs noting"},
            { title: "Unsure of severity"}
        ]; 


        // //console.log("MAIN PLANE id: ", $stateParams.plane_id);


        ////console.log("REG: "+$stateParams.registration);


         PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, 0, 25)
            .then(function (data) {
                    // //console.log("ALL is : ", data);
                   vm.logs = data.logs;
                   vm.aircraft = data.aircraft;

                   // Server-resolved club (via club_planes, current_plane = 1)
                   // and manager verdict — see backend get_journey_log (2026-08).
                   vm.journey_club_id = data.club_id || 0;
                   vm.viewer_is_club_manager = data.viewer_is_club_manager;

                   setupManualFlightAccess();

                });

            vm.current_offset = 0;
            vm.loaded_per_batch = 25;
            vm.all_loaded = false;

            vm.load_more = function(){
                vm.current_offset = vm.current_offset + vm.loaded_per_batch;
                PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, vm.current_offset, vm.loaded_per_batch)
                .then(function (data) {
                        // //console.log("ALL is : ", data);
                        if(data.logs.length > 0){
                            data.logs.forEach(log => vm.logs.push(log));
                        } else {
                            vm.all_loaded = true;
                        }
                       //vm.logs = data.logs;


                    });

            }



            // ═══════════════════════════════════════════════
            // MANUAL FLIGHT ENTRY — "Add missing flight" (managers only)
            // ═══════════════════════════════════════════════
            vm.can_add_flight = false;
            vm.addFlightUndo = null;   // { pls_id, registration, busy, timer }

            function manualFlightClubId() {
                if (vm.journey_club_id) {
                    return vm.journey_club_id;
                }
                if (vm.aircraft && vm.aircraft.club_id) {
                    return vm.aircraft.club_id;
                }
                // Old-backend fallback — the journey log payload may not carry club_id
                return (vm.user.current_club_admin && vm.user.current_club_admin.id) || 0;
            }

            function setupManualFlightAccess() {
                // The backend's viewer_is_club_manager verdict is authoritative —
                // it resolves the plane's current club via club_planes and checks
                // the viewer's role server-side.
                if (typeof vm.viewer_is_club_manager !== 'undefined') {
                    vm.can_add_flight = !!(vm.viewer_is_club_manager && manualFlightClubId());
                    return;
                }
                // Old-backend fallback: client-side role check
                var club_id = manualFlightClubId();
                vm.can_add_flight = !!(club_id && vm.user.access && vm.user.access.manager &&
                    vm.user.access.manager.indexOf(club_id) > -1);
            }

            vm.openAddFlight = function() {
                var modalInstance = $uibModal.open({
                    animation: true,
                    templateUrl: 'views/modals/manual_flight_form.html',
                    controller: 'ManualFlightModalController',
                    size: 'lg',
                    backdrop: 'static',
                    keyboard: false,
                    resolve: {
                        clubId: function() { return manualFlightClubId(); },
                        planeId: function() { return $stateParams.plane_id; }
                    }
                });

                modalInstance.result.then(function(result) {
                    if (result && result.success) {
                        // The undo snackbar is the success confirmation — no toast
                        // on top of it (they share the bottom-centre position).
                        refreshJourneyLogs();
                        showAddFlightUndo(result);
                    }
                }, function() {
                    $log.info('Manual flight modal dismissed');
                });
            };

            // Re-fetch everything loaded so far so the new row appears in place
            function refreshJourneyLogs() {
                PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, 0, vm.current_offset + vm.loaded_per_batch)
                    .then(function (data) {
                        vm.logs = data.logs;
                    });
            }

            function showAddFlightUndo(result) {
                if (vm.addFlightUndo && vm.addFlightUndo.timer) {
                    $timeout.cancel(vm.addFlightUndo.timer);
                }
                vm.addFlightUndo = {
                    pls_id: result.pls_id,
                    registration: (result.flight && result.flight.registration) || '',
                    busy: false,
                    timer: $timeout(function() { vm.addFlightUndo = null; }, 10000)
                };
            }

            vm.dismissAddFlightUndo = function() {
                if (vm.addFlightUndo && vm.addFlightUndo.timer) {
                    $timeout.cancel(vm.addFlightUndo.timer);
                }
                vm.addFlightUndo = null;
            };

            vm.undoAddFlight = function() {
                if (!vm.addFlightUndo || vm.addFlightUndo.busy) { return; }
                vm.addFlightUndo.busy = true;
                ManualFlightService.Delete(vm.addFlightUndo.pls_id).then(function(data) {
                    if (data && data.success) {
                        ToastService.success('Flight Removed', 'The manually added flight has been undone.', { duration: 3000, confetti: false });
                        vm.dismissAddFlightUndo();
                        refreshJourneyLogs();
                    } else {
                        vm.addFlightUndo.busy = false;
                        ToastService.error('Could Not Undo', (data && data.message) || 'This flight can no longer be removed.');
                    }
                });
            };


            // ── Export (server-generated CSV / Excel / PDF, UK CAA format) ──
            LogbookExportService.attach(vm, {
                baseName: function(){
                    var reg = (vm.aircraft && vm.aircraft.registration) ? vm.aircraft.registration : 'Aircraft';
                    return reg + '_Journey_Logbook';
                },
                download: function(format, filename, filters){
                    return PlaneService.DownloadJourneyLog($stateParams.plane_id, format, filename, filters);
                }
            });

            // Open the flight replay/debrief. Shown only when the journey row
            // carries has_track (a recorded device track). log.id is the
            // plane_log_sheets.id the replay endpoints key on.
            vm.canReplay = function(log){
                return !!(log && log.has_track && log.id);
            };
            vm.viewReplay = function(log){
                if(!vm.canReplay(log)) return;
                $state.go('dashboard.flight_replay', { flight_id: log.id });
            };

            vm.get_initial = function(text){
                return (!!text) ? text.charAt(0) : '';
            }


            vm.clean_times = function(time){
                if(time == "00:00:00"){
                    return " - ";
                }
                return roundTimeToMinute(time);
            }

            vm.round_brake_times = function(first, second, start_end){
                if(start_end == 0){
                    //first = brakes_off
                    //second = takeoff
                    if(second < first){
                        
                    }

                } else {
                    //first = landing
                    //second = takeoff

                }
            }


            vm.round_brake_times_end = function(input, earlier_input=null){
            
                if(input){
                  if(input.indexOf(":") > -1){
                    var split = input.split(":");
                    var x = split[1];



                    var min_nearest_five = ((x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5);
                    


                    if(min_nearest_five < 10){
                      min_nearest_five = "0"+min_nearest_five;
                    } else if(min_nearest_five == 60){
                      split[0]++;
                      min_nearest_five = "00";
                    } else if(min_nearest_five > 60){
                      split[0]++;
                      min_nearest_five = (min_nearest_five - 60);
                    }


                    if(earlier_input && earlier_input.indexOf(":") > -1){
                            // console.log("total calculated?");
                            // console.log("earlier_input: ", earlier_input);
                            // console.log("input: ", input);
                            var esplit = earlier_input.split(":");
                            var ehour = esplit[0];
                            var emin = esplit[1];
                            var etot = (parseInt(ehour)*60) + parseInt(emin); 
                            // console.log("etot: ", etot);
                            var hr = split[0];
                            var mn = min_nearest_five;
                            var tot = (parseInt(hr)*60) + parseInt(mn);
                            // console.log("tot: ", tot);

                            if(etot > tot){
                                //the earlier time is after the end time
                                // console.log("etot > tot");
                                min_nearest_five = parseInt(min_nearest_five) + 5;
                                if(min_nearest_five == 60){
                                    split[0]++; 
                                    min_nearest_five = "00";
                                } else if(min_nearest_five > 60){
                                    split[0]++;
                                    min_nearest_five = (min_nearest_five - 60);
                                    if(min_nearest_five < 10 ){
                                      min_nearest_five = "0"+min_nearest_five;
                                    }
                                }
                                // console.log("split: ", split[0]);
                                // console.log("min_nearest_five: ", min_nearest_five);
                            }

                    }
                    //essentially we add 5 in case something happens over the limit

                    return split[0] + ":" + min_nearest_five;
                  } else {
                    return input;
                  }
                } else {
                  return '';
                }
          

          }




          vm.round_brake_times_start = function(input, earlier_input=null){
            
                if(input){
                  if(input.indexOf(":") > -1){
                    var split = input.split(":");
                    var x = split[1];



                    var min_nearest_five = ((x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5);
                    


                    if(min_nearest_five < 10){
                      min_nearest_five = "0"+min_nearest_five;
                    } else if(min_nearest_five == 60){
                      split[0]++;
                      min_nearest_five = "00";
                    } else if(min_nearest_five > 60){
                      split[0]++;
                      min_nearest_five = (min_nearest_five - 60);
                    }


                    if(earlier_input && earlier_input.indexOf(":") > -1){
                            // console.log("total calculated?");
                            // console.log("earlier_input: ", earlier_input);
                            // console.log("input: ", input);
                            var esplit = earlier_input.split(":");
                            var ehour = esplit[0];
                            var emin = esplit[1];
                            var etot = (parseInt(ehour)*60) + parseInt(emin); 
                            // console.log("etot: ", etot);
                            var hr = split[0];
                            var mn = min_nearest_five;
                            var tot = (parseInt(hr)*60) + parseInt(mn);
                            // console.log("tot: ", tot);

                            if(etot < tot){
                                //the earlier time is after the end time
                                // console.log("etot < tot");
                                min_nearest_five = parseInt(min_nearest_five) - 5;
                                if(min_nearest_five == 60){
                                    split[0]++; 
                                    min_nearest_five = "00";
                                } else if(min_nearest_five > 60){
                                    split[0]++;
                                    min_nearest_five = (min_nearest_five - 60);
                                    if(min_nearest_five < 10 ){
                                      min_nearest_five = "0"+min_nearest_five;
                                    }
                                } else if(min_nearest_five < 0){
                                    split[0]--;
                                    min_nearest_five = (60 + parseInt(min_nearest_five));
                                }
                                // console.log("split: ", split[0]);
                                // console.log("min_nearest_five: ", min_nearest_five);
                            }

                    }
                    //essentially we add 5 in case something happens over the limit

                    return split[0] + ":" + min_nearest_five;
                  } else {
                    return input;
                  }
                } else {
                  return '';
                }
          

          }



            $scope.filter_detail = function(show_all = 0){
                return (show_all == 0) ? {status: "open"} : {};
            }

           
          
            $scope.get_icon = function(file){

                var ft = file.name;
                ft = ft.split('.').pop();
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }


            vm.get_icon2 = function(file){

                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }

        
        $scope.search = function(row){
            ////console.log("hi", (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1));
            return (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1);
        };

        function convert_string_to_date(date){
            if(date && date.indexOf("/") > -1){
                //then we prob have a date:::
                    var d = date.split("/");
                    var rtn = d[2]+"-"+d[1]+"-"+d[0];
                    //console.log("D", rtn);
                    return rtn;
            }
        }

        // function check_if_month(input) {
        //     var months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

        //     var monthPartOfInput = input.substring(0, 3).toLowerCase();                         

        //     // if (months.indexOf(monthPartOfInput) == -1){
        //     //     // TODO: Show validation error
        //     // }
        // }

        function test_date(search, date){


            if(search.length < 2){
                return false;
            }

            if(search && search.length <= 3){
                if(date.indexOf(search) > -1){
                    return true;
                }
            } else {
                var parsed_date = "";
                var b = moment(search);
                if(b.isValid() && b.format("YYYY") != "2001"){
                    parsed_date = b.format("YYYY-MM-DD");
                } else if(b.isValid()){
                    parsed_date = b.format("MM-DD");
                }


                var search_type = 0;

                if(parsed_date !== "" && date.indexOf(parsed_date) > -1){
                    // //console.log("found");
                    return true;
                } else {

                    //backup in case of wrong parsing data::;
                    //european method

                    if(search.length <= 5 && search.length >= 4){

                        var c = moment(search, "DDMM");
                        // //console.log("C is : ", c);
                        if(c.isValid()){
                            var c2 = c.format("MM-DD");
                            if(date.indexOf(c2) > -1){
                                return true;
                            }
                        }

                    } else if(search.length == 8 || search.length == 10){
                        
                        var c = moment(search, "DDMMYYYY");
                        // //console.log("C is : ", c);
                        if(c.isValid()){
                            var c2 = c.format("YYYY-MM-DD");
                            if(date.indexOf(c2) > -1){
                                return true;
                            }
                        }

                    }

                    // //console.log("not found");
                    return false;
                }
            }

        }


        function test_name(fname, lname, search){

            var search2 = search.toLowerCase();
            var fullname = fname+" "+lname;
            fullname = fullname.toLowerCase();    
            // //console.log("fullname: ", fullname);
            // //console.log("search: ", search2);
            // //console.log("match: ", (fullname.indexOf(search2) > -1));
            if(search.length > 2 && (fullname.indexOf(search2) > -1) ){
                return true;
            } else {
                return false;
            }

        }

        function test_aircraft(registration, search){

            var search2 = search.toLowerCase();
            var fullname = registration.replace("-", "");
            fullname = fullname.toLowerCase();    
             ////console.log("fullname: ", fullname);
            // //console.log("search: ", search2);
            // //console.log("match: ", (fullname.indexOf(search2) > -1));
            if(search.length > 2 && (fullname.indexOf(search2) > -1) ){
                return true;
            } else {
                return false;
            }

        }

        function test_airfield(search, name, code){
            var name2 = name.toLowerCase();
            var code2 = code.toLowerCase();
            var search2 = search.toLowerCase();

            if(search2.length > 2 && (name2.indexOf(search2) > -1)){
                return true;
            } else if(search2.length > 2 && (code2.indexOf(search2) > -1)){
                return true;
            } else {
                return false;
            }



        }

        $scope.search2 = function(row){
            //(angular.lowercase(row.first_name).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)  || (angular.lowercase(row.last_name).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)
            ////console.log("answer", (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1));
            // return ((angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || (angular.lowercase(row.flight_time).indexOf(angular.lowercase($scope.my_search2)) || '') !== -1)));
            //(angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)
           
            // if( (test_date($scope.my_search2, row.flight_date)) || (angular.lowercase(row.destination_airport).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.departure_airport).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.destination_airport_code).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.departure_airport_code).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)){
            //     return true;
            // } else {
            //     return false;
            // }test_aircraft
            ////console.log($scope.my_search2);
            if(!$scope.my_search2 || ($scope.my_search2 == "")){
                return true;
            }else if(test_date($scope.my_search2, row.flight_date)){
                return true;
            } else if(test_name(row.first_name, row.last_name, $scope.my_search2 )){
                return true;
            } else if(test_airfield($scope.my_search2, row.departure_airport, row.departure_airport_code)){
                return true;
            } else if(test_airfield($scope.my_search2, row.destination_airport, row.destination_airport_code)){
                return true;
            }else {
                return false;
            }

            // we are testing for the date, the pilot, the departure and destination.

            // return (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1); // ? (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) : (angular.lowercase(row.flight_time).indexOf(angular.lowercase($scope.my_search2) || '') !== -1);

        };

        $scope.getMySearchCount = function(str){
            var docs = str.documents;
            var total = 0;
            for(var i=0;i<docs.length;i++){
                if($scope.search(docs[i])){
                    total++;
                }
            }
            return total;
        }

        $scope.getMySearchCount2 = function(str){
            var charges = str.charges;
            var total = 0;
            for(var i=0;i<charges.length;i++){
                if($scope.search(charges[i])){
                    total++;
                }
            }
            return total;
        }

        //  $scope.get_hours_from_decimal = function(time){

        //     if(time){
        //         var n = new Date(0,0);
        //         n.setMinutes(+time * 60);
        //         return n.toTimeString().slice(0,5);
        //     } else {
        //         return "N/A";
        //     }

        // }

        $scope.get_hours_from_decimal = function(time){

            if(time){
                 var sign = time < 0 ? "-" : "";
                 var hour = Math.floor(Math.abs(time));
                 var min = Math.round((Math.abs(time) * 60) % 60);
                 if(min == 60){
                     hour++;
                     min = 0;
                 }
                 return sign + (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
             } else {
                 return "N/A";
             }
        }





        $scope.downloadDocument = function(doc, type) {
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
                    ToastService.error('Download Failed', 'There was an error downloading the selected document(s).');
                })
        };

        $scope.downloadClubDocument = function(doc) {
            var data = $.param({
                id: doc
            });

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/club_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Failed', 'There was an error downloading the selected document(s).');
                })
        };

        // vm.list_pilots = function(row){

        //     var p1 = "";
        //     var put = "";

        //     if(row.instructor_first_name && row.instructor_first_name !== null){
        //         p1 = "PIC: "+row.instructor_first_name+" "+row.instructor_last_name;
        //         put = "<br />PUT: "+row.first_name+" "+row.last_name;
        //     } else {
        //         if(row.first_name && row.first_name !== null){
        //             p1 = "PIC: "+row.first_name+" "+row.last_name;
        //         } else {
        //             p1 = "PIC not yet set!";
        //         }
        //     }

        //     return $sce.getTrustedHtml('<div>'+p1+' '+put+'</div>');

        // }

        vm.list_pilots = function(row){

            var p1 = "";
            var put = "";

            // if(row.instructor_first_name && row.instructor_first_name !== null){
            //     p1 = "PIC: "+row.instructor_first_name+" "+row.instructor_last_name;
            //     put = "<br />PUT: "+row.first_name+" "+row.last_name;
            // } else {
            //     if(row.first_name && row.first_name !== null){
            //         p1 = "PIC: "+row.first_name+" "+row.last_name;
            //     } else {
            //         p1 = "PIC not yet set!";
            //     }
            // }

            p1 = "PIC: "+ vm.get_pic(row);
            put = vm.get_put(row);
            if(put && put !== ""){
                put = "<br />PUT: " + put;
            }

            if(p1 && p1 == ""){
                p1 = "No PIC set yet!";
            }

            return $sce.getTrustedHtml('<div>'+p1+' '+put+'</div>');

        }

        vm.get_pic = function(log){

            var p1 = "";

            if(log.pic_first_name && log.pic_first_name !== null){
                p1 = vm.get_initial(log.pic_first_name) + ". " + log.pic_last_name;
            } else if(log.instructor_first_name && log.instructor_first_name !== ""){
                p1 = vm.get_initial(log.instructor_first_name) + ". " + log.instructor_last_name;
            } else if(log.instructor_id == 0 && log.first_name && log.first_name !== ""){
                p1 = vm.get_initial(log.first_name) + ". " + log.last_name;
            }

            return p1;

        }

        vm.get_put = function(log){

            var put = "";

            if(log.put_first_name && log.put_first_name !== null){
                put = vm.get_initial(log.put_first_name) + ". " + log.put_last_name;
            } else if(log.instructor_id > 0 && log.first_name && log.first_name !== ""){
                put = vm.get_initial(log.first_name) + ". " + log.last_name;
            } 

            return put;

        }

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


        $scope.get_icon2 = function(file){
                // //console.log("FILE", file);
                if(!file || file == ""){
                    return "";
                }
                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }
      



    }