// ManualFlightModalController — "Add a missing flight" modal.
// Two entry points: upload a SkyDemon .flightlog (parsed server-side into a
// prefilled, fully-editable form) or enter the flight manually. Creates an
// unclaimed plane_log_sheets row that drops into the book-in-unclaimed flow.
// Backend contract: FRONTEND_MANUAL_FLIGHTS_GUIDE.md
app.controller('ManualFlightModalController', ManualFlightModalController);

    ManualFlightModalController.$inject = ['$scope', '$timeout', '$uibModalInstance', 'ManualFlightService', 'PlaneService', 'ToastService', 'clubId', 'planeId'];
    function ManualFlightModalController($scope, $timeout, $uibModalInstance, ManualFlightService, PlaneService, ToastService, clubId, planeId) {

        var TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
        var MAX_FILE_BYTES = 20 * 1024 * 1024;

        // ═══════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════

        $scope.step = 'choose';        // choose | parsing | form
        $scope.entryMode = null;       // 'upload' | 'form'
        $scope.clubId = clubId;

        $scope.dragOver = false;
        $scope.parsed = null;          // raw "parsed" block from the upload (display only)
        $scope.parsedFileName = '';

        $scope.aircraftList = [];
        $scope.aircraftLoading = true;
        // The form lives inside an ng-if child scope, so the aircraft ng-model
        // must bind through an object ("always use a dot") to reach this scope.
        $scope.sel = { plane: null };
        $scope.unmatchedRegistration = '';   // log file reg when not in the fleet

        $scope.flight = newBlankFlight();

        // Airfield pickers — one state object per side
        $scope.airfields = {
            from: newAirfieldPicker(),
            to: newAirfieldPicker()
        };

        $scope.showMore = false;       // tacho / fuel / oil / notes
        $scope.saving = false;
        $scope.duplicate = null;       // existing_flight from a duplicate response
        $scope.possibleDuplicate = null; // pre-warning from the parse step

        function newBlankFlight() {
            return {
                flight_date: null,     // Date object (input[date]); converted on submit
                brakes_off: '',
                takeoff_time: '',
                landing_time: '',
                brakes_on: '',
                full_stop_landings: 1,
                touch_and_go: 0,
                remote_landings: 0,
                tacho_start: null,
                tacho_end: null,
                fuel_uplift_litres: null,
                oil_uplift_litres: null,
                flight_notes: '',
                source: null
            };
        }

        function newAirfieldPicker() {
            return {
                selected: null,        // { id, code, title, distance_nm? }
                candidates: [],        // nearest-airfield guesses from the upload
                searchText: '',
                results: [],
                searching: false,
                open: false
            };
        }


        // ═══════════════════════════════════════════════
        // INIT — load the club fleet for the aircraft picker
        // ═══════════════════════════════════════════════

        PlaneService.GetAllByClub(clubId).then(function(data) {
            $scope.aircraftLoading = false;
            if (data && data.length) {
                $scope.aircraftList = data;
                if (planeId) {
                    $scope.sel.plane = findPlane(planeId);
                }
            }
        });

        function findPlane(id) {
            for (var i = 0; i < $scope.aircraftList.length; i++) {
                if ($scope.aircraftList[i].id == id) { return $scope.aircraftList[i]; }
            }
            return null;
        }


        // ═══════════════════════════════════════════════
        // STEP NAVIGATION
        // ═══════════════════════════════════════════════

        $scope.startManual = function() {
            $scope.entryMode = 'form';
            $scope.flight = newBlankFlight();
            $scope.flight.flight_date = new Date();
            $scope.parsed = null;
            $scope.possibleDuplicate = null;
            $scope.airfields.from = newAirfieldPicker();
            $scope.airfields.to = newAirfieldPicker();
            if (planeId && !$scope.sel.plane) {
                $scope.sel.plane = findPlane(planeId);
            }
            $scope.step = 'form';
        };

        $scope.backToChoose = function() {
            $scope.step = 'choose';
            $scope.entryMode = null;
            $scope.duplicate = null;
        };


        // ═══════════════════════════════════════════════
        // UPLOAD → PARSE
        // ═══════════════════════════════════════════════

        $scope.onDragState = function(isDragging) {
            $scope.dragOver = isDragging;
        };

        $scope.onFilesPicked = function(files) {
            if (!files || files.length === 0) { return; }
            var file = files[0];

            if (file.size > MAX_FILE_BYTES) {
                ToastService.error('File Too Large', 'SkyDemon log files are limited to 20 MB.');
                return;
            }
            if (file.name && file.name.toLowerCase().indexOf('.flightlog') === -1) {
                ToastService.warning('Unexpected File Type', 'That doesn\'t look like a SkyDemon .flightlog file — trying to read it anyway.');
            }

            $scope.parsedFileName = file.name;
            $scope.step = 'parsing';

            ManualFlightService.ParseFlightlog(clubId, file).then(function(data) {
                if (data && data.success) {
                    applyParseResult(data);
                    $scope.entryMode = 'upload';
                    $scope.step = 'form';
                } else {
                    $scope.step = 'choose';
                    ToastService.error('Could Not Read Log File', (data && data.message) || 'The file could not be parsed.');
                }
            });
        };

        function applyParseResult(data) {
            var prefill = data.prefill || {};
            $scope.parsed = data.parsed || null;
            $scope.possibleDuplicate = data.possible_duplicate || null;
            $scope.duplicate = null;

            $scope.flight = newBlankFlight();
            $scope.flight.flight_date = parseYMD(prefill.flight_date);
            $scope.flight.brakes_off = prefill.brakes_off || '';
            $scope.flight.takeoff_time = prefill.takeoff_time || '';
            $scope.flight.landing_time = prefill.landing_time || '';
            $scope.flight.brakes_on = prefill.brakes_on || '';
            $scope.flight.full_stop_landings = angular.isNumber(prefill.full_stop_landings) ? prefill.full_stop_landings : 1;
            $scope.flight.touch_and_go = prefill.touch_and_go || 0;
            $scope.flight.source = prefill.source || 'skydemon';

            // Fleet dropdown — prefer the parse response's fleet list (same ids)
            if (data.club_aircraft && data.club_aircraft.length) {
                $scope.aircraftList = data.club_aircraft;
                $scope.aircraftLoading = false;
            }
            if (data.aircraft_match) {
                $scope.sel.plane = findPlane(data.aircraft_match.id) || data.aircraft_match;
                $scope.unmatchedRegistration = '';
            } else {
                $scope.sel.plane = null;
                $scope.unmatchedRegistration = (data.parsed && data.parsed.registration) || '';
            }

            // Airfield candidates, closest first — default to the best guess
            $scope.airfields.from = newAirfieldPicker();
            $scope.airfields.to = newAirfieldPicker();
            $scope.airfields.from.candidates = data.from_airfield_candidates || [];
            $scope.airfields.to.candidates = data.to_airfield_candidates || [];
            $scope.airfields.from.selected = pickCandidate($scope.airfields.from.candidates, prefill.from_airport_id);
            $scope.airfields.to.selected = pickCandidate($scope.airfields.to.candidates, prefill.to_airport_id);
        }

        function pickCandidate(candidates, preferred_id) {
            if (!candidates || candidates.length === 0) { return null; }
            if (preferred_id) {
                for (var i = 0; i < candidates.length; i++) {
                    if (candidates[i].id == preferred_id) { return candidates[i]; }
                }
            }
            return candidates[0];
        }


        // ═══════════════════════════════════════════════
        // AIRFIELD PICKERS
        // ═══════════════════════════════════════════════

        $scope.searchAirfield = function(side) {
            var picker = $scope.airfields[side];
            var query = (picker.searchText || '').trim();
            if (query.length < 3) {
                picker.results = [];
                return;
            }
            picker.searching = true;
            // The endpoint matches against code+title; spaces are sent as
            // underscores like the other airfield-search consumers.
            ManualFlightService.SearchAirfields(query.replace(/\s/g, '_')).then(function(data) {
                picker.searching = false;
                if (data && angular.isArray(data.airfields)) {
                    picker.results = data.airfields;
                } else if (angular.isArray(data)) {
                    picker.results = data;
                } else {
                    picker.results = [];
                }
            });
        };

        $scope.openAirfieldPicker = function(side) {
            $scope.airfields[side].open = true;
        };

        $scope.closeAirfieldPicker = function(side) {
            // Delay so a click on a result registers before the list closes
            $timeout(function() { $scope.airfields[side].open = false; }, 250);
        };

        $scope.selectAirfield = function(side, airfield) {
            var picker = $scope.airfields[side];
            picker.selected = airfield;
            picker.searchText = '';
            picker.results = [];
            picker.open = false;
        };

        $scope.clearAirfield = function(side) {
            var picker = $scope.airfields[side];
            picker.selected = null;
            picker.searchText = '';
            picker.results = [];
        };


        // ═══════════════════════════════════════════════
        // LANDINGS STEPPERS
        // ═══════════════════════════════════════════════

        $scope.bumpLandings = function(field, delta) {
            var value = parseInt($scope.flight[field], 10);
            if (isNaN(value)) { value = 0; }
            value = value + delta;
            if (value < 0) { value = 0; }
            $scope.flight[field] = value;
        };

        $scope.totalLandings = function() {
            return (parseInt($scope.flight.full_stop_landings, 10) || 0) +
                   (parseInt($scope.flight.touch_and_go, 10) || 0);
        };


        // ═══════════════════════════════════════════════
        // SUBMIT
        // ═══════════════════════════════════════════════

        $scope.save = function() {
            if ($scope.saving) { return; }

            var checks = [
                { ok: $scope.sel.plane && $scope.sel.plane.id, field: 'mf-aircraft', label: 'Aircraft' },
                { ok: isValidDate($scope.flight.flight_date), field: 'mf-date', label: 'Flight Date' },
                { ok: TIME_REGEX.test($scope.flight.brakes_off), field: 'mf-brakes-off', label: 'Brakes Off Time (UTC, HH:MM)' },
                { ok: TIME_REGEX.test($scope.flight.brakes_on), field: 'mf-brakes-on', label: 'Brakes On Time (UTC, HH:MM)' },
                { ok: !$scope.flight.takeoff_time || TIME_REGEX.test($scope.flight.takeoff_time), field: 'mf-takeoff', label: 'Takeoff Time (UTC, HH:MM)' },
                { ok: !$scope.flight.landing_time || TIME_REGEX.test($scope.flight.landing_time), field: 'mf-landing', label: 'Landing Time (UTC, HH:MM)' },
                { ok: $scope.totalLandings() > 0, field: 'mf-landings', label: 'At Least One Landing' }
            ];
            if (!ToastService.validateForm(checks)) { return; }

            submitFlight(false);
        };

        $scope.confirmDuplicate = function() {
            submitFlight(true);
        };

        $scope.cancelDuplicate = function() {
            $scope.duplicate = null;
        };

        function submitFlight(allow_duplicate) {
            $scope.saving = true;

            var payload = {
                club_id: clubId,
                plane_id: $scope.sel.plane.id,
                flight_date: toYMD($scope.flight.flight_date),
                brakes_off: $scope.flight.brakes_off,
                brakes_on: $scope.flight.brakes_on,
                full_stop_landings: parseInt($scope.flight.full_stop_landings, 10) || 0,
                touch_and_go: parseInt($scope.flight.touch_and_go, 10) || 0,
                remote_landings: parseInt($scope.flight.remote_landings, 10) || 0,
                allow_duplicate: !!allow_duplicate
            };

            if ($scope.flight.takeoff_time) { payload.takeoff_time = $scope.flight.takeoff_time; }
            if ($scope.flight.landing_time) { payload.landing_time = $scope.flight.landing_time; }
            if ($scope.airfields.from.selected) { payload.from_airport_id = $scope.airfields.from.selected.id; }
            if ($scope.airfields.to.selected) { payload.to_airport_id = $scope.airfields.to.selected.id; }
            if ($scope.flight.tacho_start) { payload.tacho_start = parseFloat($scope.flight.tacho_start); }
            if ($scope.flight.tacho_end) { payload.tacho_end = parseFloat($scope.flight.tacho_end); }
            if ($scope.flight.fuel_uplift_litres) { payload.fuel_uplift_litres = parseFloat($scope.flight.fuel_uplift_litres); }
            if ($scope.flight.oil_uplift_litres) { payload.oil_uplift_litres = parseFloat($scope.flight.oil_uplift_litres); }
            if ($scope.flight.flight_notes) { payload.flight_notes = $scope.flight.flight_notes; }
            if ($scope.flight.source) { payload.source = $scope.flight.source; }

            ManualFlightService.Create(payload).then(function(data) {
                $scope.saving = false;

                if (data && data.success) {
                    $uibModalInstance.close({
                        success: true,
                        pls_id: data.pls_id,
                        flight: data.flight
                    });
                    return;
                }

                if (data && data.duplicate) {
                    $scope.duplicate = data.existing_flight || {};
                    return;
                }

                ToastService.error('Could Not Add Flight', (data && data.message) || 'Something went wrong — please try again.');
            });
        }


        // ═══════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════

        function isValidDate(d) {
            return d instanceof Date && !isNaN(d.getTime());
        }

        // Local-date → "YYYY-MM-DD" without any timezone shifting
        function toYMD(d) {
            var month = d.getMonth() + 1;
            var day = d.getDate();
            return d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
        }

        // "YYYY-MM-DD" → local Date (avoids the UTC shift of new Date(string))
        function parseYMD(str) {
            if (!str) { return new Date(); }
            var parts = str.split('-');
            if (parts.length !== 3) { return new Date(); }
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }

        $scope.shortTime = function(time) {
            return (time && time.length >= 5) ? roundTimeToMinute(time) : (time || '—');
        };

        $scope.dismiss = function() {
            $uibModalInstance.dismiss('cancel');
        };
    }
