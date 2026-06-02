// ─────────────────────────────────────────────────────
// PersonalLogbookController — a pilot's personal logbook.
// Screens (by route data.screen):
//   list  → My Logbook (combined verified + tentative, totals, by-source, export)
//   add   → add a manual flight
//   edit  → edit a manual flight (manual entries only)
// Manual entries can NEVER carry ToAviate-club tuition — no instructor/tuition/
// club pickers; only free-text external instructor + dual time.
// ─────────────────────────────────────────────────────
app.controller('PersonalLogbookController', PersonalLogbookController);

    PersonalLogbookController.$inject = ['PersonalLogbookService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$timeout'];
    function PersonalLogbookController(PersonalLogbookService, ToastService, $rootScope, $scope, $state, $stateParams, $timeout) {
        var vm = this;

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        vm.loading = false;
        vm.saving = false;

        vm.capacities = ['P1', 'PICUS', 'P2', 'PUT', 'INSTRUCTOR'];

        vm.back = function() { $state.go('dashboard.my_account.logbook'); };

        switch (vm.screen) {
            case 'list':   initList(); break;
            case 'stats':  initStats(); break;
            case 'import': initImport(); break;
            default:       initForm(); break;   // add / edit
        }

        // ════════════════════════════════════════════
        // LIST — combined logbook
        // ════════════════════════════════════════════
        function initList() {
            vm.filters = { from: null, to: null };

            // ── Display preferences (persisted in localStorage) ──
            //  timeFormat: 'hms' (HH:mm, default) | 'decimal'
            //  placeFormat: 'name' (airfield name, default) | 'icao'
            try { vm.timeFormat = localStorage.getItem('toaviate_lb_timefmt') || 'hms'; } catch (e) { vm.timeFormat = 'hms'; }
            try { vm.placeFormat = localStorage.getItem('toaviate_lb_placefmt') || 'name'; } catch (e) { vm.placeFormat = 'name'; }

            vm.toggleTimeFormat = function() {
                vm.timeFormat = (vm.timeFormat === 'hms') ? 'decimal' : 'hms';
                try { localStorage.setItem('toaviate_lb_timefmt', vm.timeFormat); } catch (e) {}
            };
            vm.togglePlaceFormat = function() {
                vm.placeFormat = (vm.placeFormat === 'name') ? 'icao' : 'name';
                try { localStorage.setItem('toaviate_lb_placefmt', vm.placeFormat); } catch (e) {}
            };

            load();
        }

        // Format a decimal-hours value per the user's chosen display.
        //   hms     → "1:30"   (HH:mm, same converter the rest of the app uses)
        //   decimal → "1.5"    (one-dp decimal hours)
        vm.fmtTime = function(time) {
            var n = parseFloat(time);
            if (!n) return vm.timeFormat === 'decimal' ? '' : '';   // blank for 0/empty in the table
            if (vm.timeFormat === 'decimal') {
                return (Math.round(n * 100) / 100).toString();
            }
            var sign = n < 0 ? '-' : '';
            var hour = Math.floor(Math.abs(n));
            var min = Math.round((Math.abs(n) * 60) % 60);
            if (min === 60) { hour++; min = 0; }
            return sign + hour + ':' + (min < 10 ? '0' : '') + min;
        };
        // Same, but shows "0:00" / "0" rather than blank — for the headline totals.
        vm.fmtTotal = function(time) {
            var n = parseFloat(time) || 0;
            if (vm.timeFormat === 'decimal') return (Math.round(n * 100) / 100).toString();
            var hour = Math.floor(n);
            var min = Math.round((n * 60) % 60);
            if (min === 60) { hour++; min = 0; }
            return hour + ':' + (min < 10 ? '0' : '') + min;
        };

        // Departure/arrival place per the user's chosen display.
        // The API exposes the airfield name (*_airport) and ICAO code
        // (*_airport_code) separately, plus *_place (the code) for back-compat.
        //   name mode (default): show the airfield NAME, ICAO on hover.
        //   icao mode:           show the ICAO code, name on hover.
        // Each mode falls back to whatever is available if a field is missing
        // (e.g. a freeform private strip that only has *_place).
        vm.depPlace = function(e) {
            var code = e.departure_airport_code || e.departure_place || '';
            var name = e.departure_airport || '';
            return (vm.placeFormat === 'icao') ? (code || name) : (name || code);
        };
        vm.arrPlace = function(e) {
            var code = e.arrival_airport_code || e.arrival_place || '';
            var name = e.arrival_airport || '';
            return (vm.placeFormat === 'icao') ? (code || name) : (name || code);
        };
        // The other format, shown in the tooltip on hover.
        vm.depPlaceAlt = function(e) {
            var code = e.departure_airport_code || e.departure_place || '';
            var name = e.departure_airport || '';
            return (vm.placeFormat === 'icao') ? name : code;
        };
        vm.arrPlaceAlt = function(e) {
            var code = e.arrival_airport_code || e.arrival_place || '';
            var name = e.arrival_airport || '';
            return (vm.placeFormat === 'icao') ? name : code;
        };

        function load() {
            vm.loading = true;
            var f = {};
            if (vm.filters.from) f.from = toYMD(vm.filters.from);
            if (vm.filters.to) f.to = toYMD(vm.filters.to);
            PersonalLogbookService.GetLogbook(f).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) {
                    ToastService.error('Could not load logbook', data.message || '');
                    vm.entries = []; vm.totals = null; vm.bySource = [];
                    return;
                }
                vm.entries = data.entries || [];
                vm.totals = data.totals || null;
                vm.bySource = data.by_source || [];
            });
        }
        vm.applyFilter = function() { load(); };
        vm.clearFilter = function() { vm.filters = { from: null, to: null }; load(); };

        vm.editEntry = function(e) {
            if (e.kind !== 'manual') return;   // only manual rows are editable
            $state.go('dashboard.my_account.logbook_edit', { entry_id: e.ref_id });
        };

        vm.deleteEntry = function(e) {
            if (e.kind !== 'manual') return;
            e._confirmDelete = true;
        };
        vm.cancelDelete = function(e) { e._confirmDelete = false; };
        vm.confirmDelete = function(e) {
            e._deleting = true;
            PersonalLogbookService.DeleteManual(e.ref_id).then(function(data) {
                if (data && data.success) {
                    ToastService.success('Deleted', 'Manual entry removed.');
                    load();
                } else {
                    e._deleting = false;
                    ToastService.error('Could not delete', (data && data.message) || '');
                }
            });
        };

        vm.exporting = false;
        vm.exportLogbook = function(format) {
            vm.exporting = true;
            var f = {};
            if (vm.filters.from) f.from = toYMD(vm.filters.from);
            if (vm.filters.to) f.to = toYMD(vm.filters.to);
            PersonalLogbookService.Download(format, f).then(function(res) {
                vm.exporting = false;
                if (res && res.success) {
                    ToastService.success('Export ready', 'Your logbook is downloading.');
                } else {
                    ToastService.error('Export failed', (res && res.message) || '');
                }
            });
        };

        // ════════════════════════════════════════════
        // ADD / EDIT — manual flight form
        // ════════════════════════════════════════════
        function initForm() {
            vm.isEdit = vm.screen === 'edit';
            vm.entry = blankEntry();
            vm.airfields = [];                 // current autocomplete results
            vm.departureAirfield = null;       // picked airfield object {id, code, title}
            vm.arrivalAirfield = null;

            if (vm.isEdit) {
                vm.loading = true;
                PersonalLogbookService.GetManual($stateParams.entry_id).then(function(data) {
                    vm.loading = false;
                    if (data && data.success === false) {
                        ToastService.error('Not found', data.message || 'Could not load that entry.');
                        $state.go('dashboard.my_account.logbook');
                        return;
                    }
                    // Coerce date strings → Date objects for input[type=date].
                    if (data.flight_date) data.flight_date = fromYMD(data.flight_date);
                    vm.entry = angular.extend(blankEntry(), data);
                    // Pre-populate the airfield pickers from the saved entry so the
                    // selection shows on edit (the entry carries id + name + code).
                    if (data.departure_airfield_id || data.departure_airport || data.departure_airport_code) {
                        vm.departureAirfield = {
                            id: data.departure_airfield_id || 0,
                            code: data.departure_airport_code || data.departure_place || '',
                            title: data.departure_airport || data.departure_place || ''
                        };
                    }
                    if (data.arrival_airfield_id || data.arrival_airport || data.arrival_airport_code) {
                        vm.arrivalAirfield = {
                            id: data.arrival_airfield_id || 0,
                            code: data.arrival_airport_code || data.arrival_place || '',
                            title: data.arrival_airport || data.arrival_place || ''
                        };
                    }
                    // If the entry has a total but no usable dep/arr times, show the
                    // manual-total field so the existing value is editable.
                    if ((!vm.entry.departure_time || !vm.entry.arrival_time) && vm.entry.total_time > 0) {
                        vm.manualTotal = true;
                    }
                });
            }
        }

        // Airfield autocomplete — server-side search (shared registry), matching
        // the bookout flow. Triggered by ui-select's refresh as the pilot types.
        var airfieldTimer = null;
        vm.searchAirfields = function(term) {
            if (!term || term.length < 2) return;
            PersonalLogbookService.SearchAirfields(term.replace(/\s/g, '_')).then(function(data) {
                if (data && data.success && angular.isArray(data.airfields)) {
                    vm.airfields = data.airfields;
                } else {
                    vm.airfields = [];
                }
            });
        };

        function blankEntry() {
            return {
                flight_date: null,
                departure_place: '', departure_time: '',
                arrival_place: '', arrival_time: '',
                registration: '',
                aircraft_make: '', aircraft_model: '', aircraft_type: '', aircraft_class: '',
                engine_type: 'single', multi_pilot: 0, is_simulator: 0, sim_type: '',
                capacity: 'P1',
                total_time: null,
                pic_time: null, picus_time: null, copilot_time: null, dual_time: null, instructor_time: null,
                night_time: null, ifr_time: null, cross_country_time: null,
                day_landings: null, night_landings: null,
                instructor_name: '', remarks: '', external_club_name: ''
            };
        }

        // Aircraft registration lookup (debounced, on the registration field).
        var lookupTimer = null;
        vm.lookupAircraft = function() {
            var reg = (vm.entry.registration || '').trim();
            if (lookupTimer) $timeout.cancel(lookupTimer);
            if (reg.length < 3) return;
            lookupTimer = $timeout(function() {
                vm.lookingUp = true;
                PersonalLogbookService.LookupAircraft(reg).then(function(data) {
                    vm.lookingUp = false;
                    if (data && data.found) {
                        // Pre-fill, but don't clobber anything the pilot already typed.
                        if (!vm.entry.aircraft_make)  vm.entry.aircraft_make  = data.make && data.make !== '-' ? data.make : vm.entry.aircraft_make;
                        if (!vm.entry.aircraft_model) vm.entry.aircraft_model = data.model && data.model !== '-' ? data.model : vm.entry.aircraft_model;
                        if (!vm.entry.aircraft_type)  vm.entry.aircraft_type  = data.type || vm.entry.aircraft_type;
                        if (!vm.entry.aircraft_class) vm.entry.aircraft_class = data.class || vm.entry.aircraft_class;
                        if (data.engine_type) vm.entry.engine_type = data.engine_type;
                        vm.aircraftFound = true;
                        ToastService.success('Aircraft found', data.registration + ' — ' + (data.type || data.model || ''));
                    } else {
                        vm.aircraftFound = false;
                    }
                });
            }, 500);
        };

        // Which single function-time field a capacity maps to (SEP/MEP are single-
        // pilot, so the whole flight's hours go to one function).
        var CAPACITY_FIELD = {
            'P1': 'pic_time',
            'PICUS': 'picus_time',
            'P2': 'copilot_time',
            'PUT': 'dual_time',
            'INSTRUCTOR': 'instructor_time'
        };
        vm.capacityFieldLabel = function() {
            switch (vm.entry && vm.entry.capacity) {
                case 'P1': return 'PIC';
                case 'PICUS': return 'PICUS';
                case 'P2': return 'P2 / Co-pilot';
                case 'PUT': return 'Dual';
                case 'INSTRUCTOR': return 'Instructor';
                default: return '';
            }
        };

        // Compute the flight total (decimal hours) from departure/arrival HH:MM.
        // Returns 0 if either time is missing/invalid. Handles flights past midnight.
        function parseHHMM(t) {
            if (!t) return null;
            var m = String(t).match(/^(\d{1,2}):(\d{2})$/);
            if (!m) return null;
            var h = +m[1], mi = +m[2];
            if (h > 23 || mi > 59) return null;
            return h * 60 + mi;
        }
        vm.computeTotal = function() {
            var dep = parseHHMM(vm.entry.departure_time);
            var arr = parseHHMM(vm.entry.arrival_time);
            if (dep === null || arr === null) return 0;
            var mins = arr - dep;
            if (mins < 0) mins += 24 * 60;   // crossed midnight
            return Math.round((mins / 60) * 100) / 100;
        };
        // The total used for display + submit: computed from times, unless the
        // pilot has chosen to override it manually (no times, or a known total).
        vm.effectiveTotal = function() {
            if (vm.manualTotal) return parseFloat(vm.entry.total_time) || 0;
            return vm.computeTotal();
        };
        vm.manualTotal = false;
        vm.toggleManualTotal = function() {
            vm.manualTotal = !vm.manualTotal;
            if (!vm.manualTotal) vm.entry.total_time = null;
        };
        // A simulator session has no flight times — switch to manual total entry.
        vm.onSimToggle = function() {
            if (vm.entry.is_simulator) vm.manualTotal = true;
        };

        vm.save = function() {
            var e = vm.entry;

            // ── Client-side validation (mirror backend rules to avoid round-trips) ──
            if (!e.flight_date) { ToastService.warning('Date required', 'When was the flight?'); return; }

            // Total is computed from the dep/arr times (or a manual override).
            var total = vm.effectiveTotal();
            if (!e.is_simulator && total <= 0) {
                if (vm.manualTotal) {
                    ToastService.warning('Total time required', 'Enter the total flight time (decimal hours).');
                } else {
                    ToastService.warning('Times required', 'Enter departure and arrival times so the total can be calculated (or switch to enter a total manually).');
                }
                return;
            }

            // Capacity drives the single function-time field for the whole flight.
            // Clear all function fields, then set the one for the chosen capacity.
            e.pic_time = e.picus_time = e.copilot_time = e.dual_time = e.instructor_time = null;
            var capField = CAPACITY_FIELD[e.capacity];
            if (capField) e[capField] = total;

            // Condition times (night/IFR/XC) are independent of capacity — just ≤ total.
            var condFields = [
                ['night_time', 'Night time'], ['ifr_time', 'IFR time'], ['cross_country_time', 'Cross-country time']
            ];
            for (var i = 0; i < condFields.length; i++) {
                var v = parseFloat(e[condFields[i][0]]) || 0;
                if (v > total) {
                    ToastService.warning('Time exceeds total', condFields[i][1] + ' cannot exceed the total time.'); return;
                }
            }

            // Build the payload — strip empty values and NEVER send tuition/club fields.
            var payload = {};
            angular.forEach(e, function(val, key) {
                if (key.charAt(0) === '_') return;
                if (val === null || val === '' || val === undefined) return;
                payload[key] = val;
            });
            payload.flight_date = toYMD(e.flight_date);
            payload.total_time = total;
            payload.multi_pilot = e.multi_pilot ? 1 : 0;
            payload.is_simulator = e.is_simulator ? 1 : 0;

            // ── Airfields ──
            // Send the registry id when an airfield was picked (authoritative);
            // also send the code as freeform *_place for back-compat / unlisted strips.
            // A real airfield has id > 0; the "NOT LISTED" sentinel (id 0) is treated
            // as freeform text only.
            delete payload.departure_place; delete payload.arrival_place;
            if (vm.departureAirfield) {
                if (vm.departureAirfield.id > 0) payload.departure_airfield_id = vm.departureAirfield.id;
                if (vm.departureAirfield.code) payload.departure_place = vm.departureAirfield.code;
            }
            if (vm.arrivalAirfield) {
                if (vm.arrivalAirfield.id > 0) payload.arrival_airfield_id = vm.arrivalAirfield.id;
                if (vm.arrivalAirfield.code) payload.arrival_place = vm.arrivalAirfield.code;
            }

            vm.saving = true;
            var call = vm.isEdit
                ? PersonalLogbookService.UpdateManual($stateParams.entry_id, payload)
                : PersonalLogbookService.AddManual(payload);
            call.then(function(data) {
                vm.saving = false;
                if (data && data.success) {
                    ToastService.success(vm.isEdit ? 'Flight updated' : 'Flight logged', 'Added to your tentative hours.');
                    $state.go('dashboard.my_account.logbook');
                } else {
                    ToastService.error('Could not save', (data && data.message) || 'Please check the fields and try again.');
                }
            });
        };

        // ════════════════════════════════════════════
        // STATISTICS
        // ════════════════════════════════════════════
        function initStats() {
            vm.loading = true;
            vm.periodKeys = [
                { key: 'last_1_month',   label: '1 Month' },
                { key: 'last_6_months',  label: '6 Months' },
                { key: 'last_12_months', label: '12 Months' },
                { key: 'last_24_months', label: '24 Months' },
                { key: 'all_time',       label: 'All Time' }
            ];
            vm.activePeriod = 'all_time';
            vm.setPeriod = function(k) { vm.activePeriod = k; };
            vm.period = function() { return (vm.stats && vm.stats.periods) ? vm.stats.periods[vm.activePeriod] : null; };

            PersonalLogbookService.GetStats().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) {
                    ToastService.error('Could not load stats', data.message || '');
                    return;
                }
                vm.stats = data;
                vm.sep = data.sep_currency || { has_sep: false };
            });
            // Reuse the list formatter (defaults to HH:mm; honours the saved pref).
            try { vm.timeFormat = localStorage.getItem('toaviate_lb_timefmt') || 'hms'; } catch (e) { vm.timeFormat = 'hms'; }
        }

        // Percentage helper for the split bars (guards divide-by-zero).
        vm.pct = function(part, whole) {
            part = parseFloat(part) || 0; whole = parseFloat(whole) || 0;
            if (whole <= 0) return 0;
            return Math.round((part / whole) * 100);
        };

        // ════════════════════════════════════════════
        // CSV IMPORT (preview → review → confirm)
        // ════════════════════════════════════════════
        function initImport() {
            vm.importStep = 'pick';        // 'pick' | 'review' | 'done'
            vm.importFileName = '';
            vm.importRows = [];
            vm.importSummary = null;
            vm.importResult = null;
            vm.importing = false;
        }

        // Called from the file input's onchange (same pattern as bs_sync):
        //   onchange="angular.element(this).scope().vm.onImportFile(this.files)"
        // The native event fires outside Angular, so wrap in $apply.
        vm.onImportFile = function(files) {
            $scope.$apply(function() {
                var file = files && files[0];
                if (!file) return;
                // Reject non-CSV early (the backend also rejects, but fail fast).
                if (!/\.csv$/i.test(file.name)) {
                    ToastService.error('CSV only', 'Please export your logbook as CSV and upload that.');
                    return;
                }
                vm.importFileName = file.name;
                vm.importing = true;
                PersonalLogbookService.ImportPreview(file).then(function(data) {
                    vm.importing = false;
                    if (!data || data.success === false) {
                        ToastService.error('Import failed', (data && data.message) || 'Could not read that file.');
                        return;
                    }
                    vm.importSummary = data.summary || null;
                    // Keep each row; pre-select everything that isn't an error.
                    vm.importRows = (data.rows || []).map(function(r) {
                        r._include = (r.status !== 'error');
                        return r;
                    });
                    vm.importStep = 'review';
                });
            });
        };

        vm.importStatusClass = function(status) {
            if (status === 'ready') return 'lb-import-row--ready';
            if (status === 'review') return 'lb-import-row--review';
            return 'lb-import-row--error';
        };
        vm.importIncludedCount = function() {
            return vm.importRows.filter(function(r) { return r._include && r.status !== 'error'; }).length;
        };

        vm.confirmImport = function() {
            var rows = vm.importRows
                .filter(function(r) { return r._include && r.status !== 'error'; })
                .map(function(r) { return r.entry; });
            if (!rows.length) {
                ToastService.warning('Nothing to import', 'Select at least one row.');
                return;
            }
            vm.importing = true;
            PersonalLogbookService.ImportConfirm(rows).then(function(data) {
                vm.importing = false;
                if (!data || data.success === false) {
                    ToastService.error('Import failed', (data && data.message) || '');
                    return;
                }
                vm.importResult = data;   // { imported, failed, results }
                vm.importStep = 'done';
                ToastService.success('Imported', (data.imported || 0) + ' flight(s) added to your logbook.');
            });
        };

        vm.restartImport = function() { initImport(); };

        // ── Date helpers (input[type=date] uses Date objects; API uses YYYY-MM-DD) ──
        function toYMD(d) {
            if (!d) return '';
            if (typeof d === 'string') return d.slice(0, 10);
            var y = d.getFullYear(), m = ('0' + (d.getMonth() + 1)).slice(-2), dd = ('0' + d.getDate()).slice(-2);
            return y + '-' + m + '-' + dd;
        }
        function fromYMD(str) {
            if (!str) return null;
            if (str instanceof Date) return str;
            var p = String(str).slice(0, 10).split('-');
            return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
        }
    }
