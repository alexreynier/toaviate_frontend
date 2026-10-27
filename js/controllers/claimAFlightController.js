 app.controller('ClaimAFlightController', ClaimAFlightController);

    ClaimAFlightController.$inject = ['UserService', 'FoxService', '$rootScope', '$scope', '$stateParams', '$location', 'ToastService', 'TimeDisplayService'];
    function ClaimAFlightController(UserService, FoxService, $rootScope, $scope, $stateParams, $location, ToastService, TimeDisplayService) {
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
        // ── Load more unclaimed flights for one aircraft ──
        // The API returns the newest 10 Fox entries per aircraft (fewer may show,
        // since entries without a log sheet are dropped after the limit). A page
        // is fetched with offset/limit and appended; `next_offset` from the API
        // keeps paging in raw-entry space. Until the API sends has_more we fall
        // back to "the first page looked full".
        var LOAD_MORE_PAGE = 20;
        var FIRST_PAGE = 10;
        vm.canLoadMore = function(plane){
            if (!plane || !plane.flights) { return false; }
            if (plane.has_more === true) { return true; }
            if (plane.has_more === false) { return false; }
            return plane.flights.length >= (FIRST_PAGE - 2) && !plane._exhausted;
        };
        vm.loadMore = function(plane){
            if (!plane || plane._loading_more) { return; }
            var offset = (plane.next_offset !== undefined && plane.next_offset !== null) ? plane.next_offset : plane.flights.length;
            plane._loading_more = true;
            FoxService.GetFoxEntriesByPlane(plane.plane_id, offset, LOAD_MORE_PAGE)
                .then(function(data){
                    plane._loading_more = false;
                    if (!data || data.success === false) {
                        ToastService.error('Could not load more', (data && data.message) || 'Please try again.');
                        return;
                    }
                    var seen = {};
                    plane.flights.forEach(function(f){ seen[f.id] = true; });
                    var added = 0;
                    (data.fox_entries || []).forEach(function(f){
                        if (!seen[f.id]) { plane.flights.push(f); seen[f.id] = true; added++; }
                    });
                    if (data.has_more !== undefined) {
                        plane.has_more = !!data.has_more;
                        plane.next_offset = data.next_offset;
                        plane.total_unclaimed = data.total;
                    } else if (added === 0) {
                        // Legacy API (no paging support) — nothing new came back.
                        plane._exhausted = true;
                        ToastService.warning('No more flights', 'That is everything the server can return for this aircraft right now.');
                    } else {
                        plane.next_offset = offset + (data.fox_entries || []).length;
                    }
                    buildHelperLists();
                });
        };

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
                            club_id: club.club_id || club.id || null,
                            plane_time_display: plane.time_display || null,
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
                            takeoffs_landings: log.takeoffs_landings,
                            split_leg: log.split_leg,
                            // track-derived counterparts (FRONTEND_TRACK_DATA_GUIDE.md §5)
                            airborne_seconds_calculated: log.airborne_seconds_calculated,
                            landings_calculated: log.landings_calculated,
                            full_stop_landings_calculated: log.full_stop_landings_calculated,
                            stop_and_go_calculated: log.stop_and_go_calculated,
                            touch_and_go_calculated: log.touch_and_go_calculated,
                            go_arounds_calculated: log.go_arounds_calculated,
                            phantom_pairs_calculated: log.phantom_pairs_calculated,
                            track_calculated_status: log.track_calculated_status
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
            vm.loading = true;
            FoxService.GetFoxEntries($rootScope.globals.currentUser.id)
                .then(function (data) {
                    console.log("GetFoxEntries was called here");
                    vm.loading = false;
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
                return roundTimeToMinute(time);
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

        // ── Track-derived counterparts beside the tracker's values (§5) ──
        // track_calculated_status: ok | file_mismatch | no_events | null (not analysed)
        function has_num(v){ return v !== null && v !== undefined && v !== ''; }
        // "Most accurate wins": the track file's figure when the recording was
        // analysed cleanly, otherwise the tracker's. Nobody on the claim list
        // needs to know which — the source is only a tooltip.
        vm.best_airborne_seconds = function(log){
            if(!log) { return null; }
            if(vm.has_track_calc(log) && log.track_calculated_status === 'ok' && has_num(log.airborne_seconds_calculated) && Number(log.airborne_seconds_calculated) > 0){
                return Number(log.airborne_seconds_calculated);
            }
            return has_num(log.airborne_seconds) ? Number(log.airborne_seconds) : null;
        };
        vm.best_landings = function(log){
            if(!log) { return null; }
            if(vm.has_track_calc(log) && log.track_calculated_status === 'ok' && has_num(log.landings_calculated)){
                return Number(log.landings_calculated);
            }
            return has_num(log.number_landings) ? Number(log.number_landings) : null;
        };
        vm.best_source_tip = function(log, what){
            var from_track = vm.has_track_calc(log) && log.track_calculated_status === 'ok';
            return (what === 'landings' ? 'Landings ' : 'Airborne time ') + (from_track ? 'from the recorded track file' : 'recorded by the tracker');
        };

        vm.has_track_calc = function(log){
            return !!(log && log.track_calculated_status && log.track_calculated_status !== 'no_events'
                      && (has_num(log.airborne_seconds_calculated) || has_num(log.landings_calculated)));
        };
        vm.track_status_label = function(log){
            if(!log || !log.track_calculated_status) { return ''; }
            return ({ file_mismatch: 'recording mismatch', no_events: 'no track events' })[log.track_calculated_status] || '';
        };
        vm.track_status_tip = function(log){
            if(!log || !log.track_calculated_status) { return ''; }
            return ({
                file_mismatch: 'The recording on file is not this flight — the track values do not describe it.',
                no_events: 'The recorded track was analysed but no take-offs or landings could be detected in it.'
            })[log.track_calculated_status] || '';
        };
        vm.airborne_minutes = function(seconds){
            if(!has_num(seconds)) { return null; }
            return Math.round(parseFloat(seconds) / 60);
        };
        vm.landings_calc_tip = function(log){
            if(!log) { return ''; }
            var bits = [];
            if(has_num(log.full_stop_landings_calculated)) { bits.push(log.full_stop_landings_calculated + ' full stop'); }
            if(has_num(log.stop_and_go_calculated))        { bits.push(log.stop_and_go_calculated + ' stop-and-go'); }
            if(has_num(log.touch_and_go_calculated))       { bits.push(log.touch_and_go_calculated + ' touch-and-go'); }
            if(has_num(log.go_arounds_calculated))         { bits.push(log.go_arounds_calculated + ' go-around'); }
            if(has_num(log.phantom_pairs_calculated) && log.phantom_pairs_calculated > 0) { bits.push(log.phantom_pairs_calculated + ' tracker "flight(s)" the track shows as taxi/glitch'); }
            return bits.length ? ('From the recorded track: ' + bits.join(', ')) : 'Landings detected in the recorded track';
        };

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