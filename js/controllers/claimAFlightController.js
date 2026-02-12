 app.controller('ClaimAFlightController', ClaimAFlightController);

    ClaimAFlightController.$inject = ['UserService', 'FoxService', '$rootScope', '$scope', '$stateParams', '$location'];
    function ClaimAFlightController(UserService, FoxService, $rootScope, $scope, $stateParams, $location) {
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.unclaimed = [];

        vm.looking_for = $stateParams.registration;

        // View toggle: 'aircraft' (grouped by aircraft) or 'all' (flat list)
        vm.activeView = 'aircraft';
        vm.setView = function(view) { vm.activeView = view; };

        // Aircraft ui-select
        vm.aircraftList = [];      // flat list of all aircraft for the ui-select
        vm.selectedAircraft = null;
        vm.allFlights = [];        // flat list of every flight for the "all" view

        vm.onAircraftSelected = function(item) {
            vm.selectedAircraft = item || null;
        };

        vm.clearAircraftFilter = function() {
            vm.selectedAircraft = null;
        };

        // Build helper lists after data loads
        function buildHelperLists() {
            vm.aircraftList = [];
            vm.allFlights = [];
            if (!vm.unclaimed || !vm.unclaimed.to_claim) return;

            vm.unclaimed.to_claim.forEach(function(club) {
                (club.aircraft || []).forEach(function(plane) {
                    var entry = {
                        plane_id: plane.plane_id,
                        registration: plane.registration,
                        plane_type: plane.plane_type,
                        club_name: club.club_name,
                        label: plane.registration + ' — ' + plane.plane_type
                    };
                    vm.aircraftList.push(entry);

                    (plane.flights || []).forEach(function(log) {
                        vm.allFlights.push({
                            registration: plane.registration,
                            plane_type: plane.plane_type,
                            club_name: club.club_name,
                            flight_date: log.flight_date,
                            brakes_time: log.brakes_time,
                            plane_log_sheet_id: log.plane_log_sheet_id,
                            brakes_off: log.brakes_off,
                            brakes_on: log.brakes_on,
                            from_airfield_code: log.from_airfield_code,
                            from_airfield_name: log.from_airfield_name,
                            to_airfield_code: log.to_airfield_code,
                            to_airfield_name: log.to_airfield_name,
                            airborne_seconds: log.airborne_seconds,
                            number_landings: log.number_landings,
                            takeoffs_landings: log.takeoffs_landings
                        });
                    });
                });
            });

            // Sort all flights newest first (by flight_date + brakes_off time)
            vm.allFlights.sort(function(a, b) {
                var dateA = new Date(a.flight_date + ' ' + (a.brakes_off || '00:00'));
                var dateB = new Date(b.flight_date + ' ' + (b.brakes_off || '00:00'));
                return dateB - dateA;
            });

            // Pre-select aircraft if route param was provided
            if (vm.looking_for) {
                var match = vm.aircraftList.filter(function(a) {
                    return a.registration.toLowerCase().indexOf(vm.looking_for.toLowerCase()) !== -1;
                });
                if (match.length) vm.selectedAircraft = match[0];
            }
        }

        // Filter functions for aircraft view
        vm.aircraftFilter = function(plane) {
            if (!vm.selectedAircraft) return true;
            return plane.registration === vm.selectedAircraft.registration;
        };

        // vm.allUsers = [];
        // vm.deleteUser = deleteUser;

        initController();

        function initController() {
            // loadCurrentUser();
            console.log("init claim a flight controller");
            GetFoxEntries();
            // loadAllUsers();
        }

        function GetFoxEntries() {
            //is this a club_id ? OR is this a USER id --> therefore return all clubs with all un-claimed flights?
            FoxService.GetFoxEntries($rootScope.globals.currentUser.id)
                .then(function (data) {
                    console.log("GetFoxEntries was called here");
                    vm.unclaimed = data;
                    console.log("vm.unclaimed", vm.unclaimed);
                    buildHelperLists();
                });
        }

        // function loadAllUsers() {
        //     UserService.GetAll()
        //         .then(function (data) {
        //             vm.allUsers = data.users;
        //         });
        // }

       
        // function deleteUser(id) {
        //     UserService.Delete(id)
        //     .then(function(data) {
        //         if(data.success){
	       //          $location.path('/');
        //         }
        //     });
        // }

        $scope.search = function(row){
            ////console.log("hi", (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1));
            return (angular.lowercase(row.title).indexOf(angular.lowercase($scope.my_search) || '') !== -1);
        };

        $scope.search2 = function(row){
            return (angular.lowercase(row.registration).indexOf(angular.lowercase($scope.my_search2) || '') !== -1);
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
        
        vm.clean_times = function(time){
                return time.substring(0,5);
        }

        vm.difference_times = function(to, from){
            var to_datetime = moment(to);
            var from_datetime = moment(from);
            // console.log("to datetime", to_datetime);
            // console.log("from datetime", from_datetime);
            var duration = moment.duration(from_datetime.diff(to_datetime));
            var hours = duration.asHours();
            //now to hours and seconds??
            var hour = Math.floor(Math.abs(hours));
            var min = Math.round((Math.abs(hours) * 60) % 60);
            return (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
            //return hours;
        }

        vm.difference_times_decimal = function(to, from){
            var to_datetime = moment(to);
            var from_datetime = moment(from);
            var duration = moment.duration(from_datetime.diff(to_datetime));
            var hours = duration.asHours();
            return hours;
        }

        vm.airborne_decimal = function(seconds){
             var hours = seconds / 60 / 60;
             return hours;
        }

        vm.airborne_to_hours = function(seconds){
             var hours = seconds / 60 / 60;
             var hour = Math.floor(Math.abs(hours));
             var min = Math.round((Math.abs(hours) * 60) % 60);
             if(min == 60){
                 hour = hour +1;
                 min = 0;
             }
             return (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
        }

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


    }