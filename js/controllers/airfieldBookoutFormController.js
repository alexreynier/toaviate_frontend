// ═══════════════════════════════════════════════════════════════════
//  AirfieldBookoutFormController
//  Public pilot bookout form — no auth, accessed via /bookout/:icao
//  Supports: create, edit (via edit_code), delete
// ═══════════════════════════════════════════════════════════════════

app.controller('AirfieldBookoutFormController', AirfieldBookoutFormController);

    AirfieldBookoutFormController.$inject = [
        'AirfieldBookoutService', '$scope', '$stateParams', '$timeout'
    ];
    function AirfieldBookoutFormController(
        AirfieldBookoutService, $scope, $stateParams, $timeout
    ) {
        var vm = this;

        // ── Route params ──
        vm.icao = ($stateParams.icao || '').toUpperCase();

        // ── Page state ──
        vm.loading       = true;
        vm.error         = false;
        vm.error_message = '';
        vm.submitting    = false;
        vm.submitted     = false;
        vm.editing       = false;
        vm.deleting      = false;
        vm.show_edit_lookup = false;

        // ── Airfield info ──
        vm.airfield      = null;
        vm.aircraft_list = [];

        // ── Form data ──
        vm.form = {
            registration:   '',
            aircraft_type:  '',
            pic_name:       '',
            from:           '',
            to:             '',
            pob_outbound:   1,
            pob_inbound:    null,
            notes:          '',
            plane_id:       null
        };

        // ── Edit mode ──
        vm.edit_code     = '';
        vm.edit_lookup_code = '';
        vm.bookout_id    = null;
        vm.result_code   = '';

        // ── Autocomplete ──
        vm.reg_search    = '';
        vm.filtered_aircraft = [];
        vm.show_dropdown = false;
        vm.lookup_done   = false;

        // ── Airfield ui-select ──
        vm.selected_from         = null;
        vm.selected_to           = null;
        vm.from_airfield_options = [];
        vm.to_airfield_options   = [];
        vm.preset_airfields      = [];   // LOCAL, CCTS + base airfield

        // ── Search tracking ──
        var _lastFromSearch = '';
        var _lastToSearch   = '';

        // ── Public methods ──
        vm.filterAircraft       = filterAircraft;
        vm.selectAircraft       = selectAircraft;
        vm.onRegistrationBlur   = onRegistrationBlur;
        vm.setQuickFrom         = setQuickFrom;
        vm.setQuickTo           = setQuickTo;
        vm.setQuickRoute        = setQuickRoute;
        vm.searchFromAirfields  = searchFromAirfields;
        vm.searchToAirfields    = searchToAirfields;
        vm.onFromSelected       = onFromSelected;
        vm.onToSelected         = onToSelected;
        vm.onFromRemoved        = onFromRemoved;
        vm.onToRemoved          = onToRemoved;
        vm.airfieldTagTransform = airfieldTagTransform;
        vm.submitBookout        = submitBookout;
        vm.startNewBookout      = startNewBookout;
        vm.showEditLookup       = showEditLookup;
        vm.lookupEditCode       = lookupEditCode;
        vm.updateBookout        = updateBookout;
        vm.cancelEdit           = cancelEdit;
        vm.deleteBookout        = deleteBookout;
        vm.hideDropdown         = hideDropdown;
        vm.copyEditCode         = copyEditCode;

        // ── Init ──
        init();


        function init() {
            if (!vm.icao) {
                vm.loading = false;
                vm.error = true;
                vm.error_message = 'No airfield ICAO code provided. Please check the URL.';
                return;
            }

            AirfieldBookoutService.LoadFormData(vm.icao)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.airfield      = data.airfield;
                        vm.aircraft_list = data.aircraft || [];

                        // Build preset airfield options for From / To ui-select
                        vm.preset_airfields = [
                            { code: 'LOCAL', title: 'Local Flight' },
                            { code: 'CCTS',  title: 'Circuits' }
                        ];
                        if (vm.airfield && vm.airfield.code) {
                            vm.preset_airfields.push({
                                code:  vm.airfield.code,
                                title: vm.airfield.title || vm.airfield.code
                            });
                        }
                        vm.from_airfield_options = angular.copy(vm.preset_airfields);
                        vm.to_airfield_options   = angular.copy(vm.preset_airfields);
                    } else {
                        vm.error = true;
                        vm.error_message = data.message || 'Airfield not found. Please check the ICAO code.';
                    }
                }, function() {
                    vm.loading = false;
                    vm.error = true;
                    vm.error_message = 'Could not connect to the server. Please try again.';
                });
        }


        // ═══════════════════════════════════════════
        //  Aircraft Registration Autocomplete
        // ═══════════════════════════════════════════

        function filterAircraft() {
            var q = (vm.form.registration || '').toUpperCase();
            vm.form.registration = q;

            if (q.length < 1) {
                vm.filtered_aircraft = [];
                vm.show_dropdown = false;
                return;
            }

            vm.filtered_aircraft = vm.aircraft_list.filter(function(ac) {
                return ac.registration.toUpperCase().indexOf(q) > -1;
            }).slice(0, 8);

            vm.show_dropdown = vm.filtered_aircraft.length > 0;
            vm.lookup_done = false;
        }

        function selectAircraft(ac) {
            vm.form.registration  = ac.registration;
            vm.form.aircraft_type = ac.plane_type || '';
            vm.form.plane_id      = ac.plane_id || null;
            vm.show_dropdown      = false;
            vm.lookup_done        = true;
        }

        function hideDropdown() {
            $timeout(function() {
                vm.show_dropdown = false;
            }, 200);
        }

        function onRegistrationBlur() {
            hideDropdown();
            vm.form.registration = (vm.form.registration || '').toUpperCase();

            // Lookup aircraft type if not already done
            if (!vm.lookup_done && vm.form.registration.length >= 4) {
                AirfieldBookoutService.LookupAircraft(vm.icao, vm.form.registration)
                    .then(function(data) {
                        if (data.success) {
                            vm.form.aircraft_type = data.aircraft_type || '';
                            vm.form.plane_id      = data.plane_id || null;
                        }
                        vm.lookup_done = true;
                    });
            }
        }


        // ═══════════════════════════════════════════
        //  Quick-pick buttons  (each sets BOTH from AND to)
        // ═══════════════════════════════════════════

        function setQuickFrom(value) {
            // Kept for backward compat — sets BOTH fields
            _applyQuickPick(value);
        }

        function setQuickTo(value) {
            _applyQuickPick(value);
        }

        function setQuickRoute(value) {
            _applyQuickPick(value);
        }

        function _applyQuickPick(value) {
            vm.form.from = value;
            vm.form.to   = value;

            // Sync the ui-select model objects
            var match = _findPresetByCode(value);
            vm.selected_from = match || { code: value, title: value };
            vm.selected_to   = match || { code: value, title: value };
        }

        function _findPresetByCode(code) {
            for (var i = 0; i < vm.preset_airfields.length; i++) {
                if (vm.preset_airfields[i].code === code) return vm.preset_airfields[i];
            }
            return null;
        }


        // ═══════════════════════════════════════════
        //  Airfield Search for From / To ui-select
        // ═══════════════════════════════════════════

        function searchFromAirfields(search) {
            _lastFromSearch = search || '';
            _searchAirfields(search, 'from');
        }

        function searchToAirfields(search) {
            _lastToSearch = search || '';
            _searchAirfields(search, 'to');
        }

        function _searchAirfields(search, field) {
            if (!search || search.length < 1) {
                if (field === 'from') vm.from_airfield_options = angular.copy(vm.preset_airfields);
                else                  vm.to_airfield_options   = angular.copy(vm.preset_airfields);
                return;
            }

            var q = search.toUpperCase();

            // Client-side filter presets first (LOCAL, CCTS, base airfield)
            var presetMatches = vm.preset_airfields.filter(function(af) {
                return af.code.toUpperCase().indexOf(q) > -1 ||
                       af.title.toUpperCase().indexOf(q) > -1;
            });

            // Server search — service adds Api-Key header automatically
            if (q.length >= 2 && q.length <= 4) {
                AirfieldBookoutService.SearchAirfieldsByCode(q)
                    .then(function(data) {
                        var results = (data && data.airfields) ? data.airfields : [];
                        _mergeAndSet(field, presetMatches, results);
                    }, function() {
                        _mergeAndSet(field, presetMatches, []);
                    });
            } else if (q.length > 4) {
                AirfieldBookoutService.SearchAirfields(q)
                    .then(function(data) {
                        var results = (data && data.airfields) ? data.airfields : [];
                        _mergeAndSet(field, presetMatches, results);
                    }, function() {
                        _mergeAndSet(field, presetMatches, []);
                    });
            } else {
                _mergeAndSet(field, presetMatches, []);
            }
        }

        function _mergeAndSet(field, presets, serverResults) {
            var codes = {};
            var merged = [];
            presets.forEach(function(p) { codes[p.code] = true; merged.push(p); });
            serverResults.forEach(function(af) {
                if (!codes[af.code]) {
                    codes[af.code] = true;
                    merged.push(af);
                }
            });

            // Inject a custom free-text entry at the top if the search text
            // doesn't exactly match any existing option's code
            var searchText = (field === 'from') ? _lastFromSearch : _lastToSearch;
            if (searchText && searchText.length > 0) {
                var upper = searchText.toUpperCase();
                var exactMatch = merged.some(function(af) {
                    return af.code.toUpperCase() === upper;
                });
                if (!exactMatch) {
                    merged.unshift({ code: upper, title: upper, _custom: true });
                }
            }

            if (field === 'from') vm.from_airfield_options = merged;
            else                  vm.to_airfield_options   = merged;
        }

        function onFromSelected($item) {
            vm.form.from = $item ? $item.code : '';
        }

        function onToSelected($item) {
            vm.form.to = $item ? $item.code : '';
        }

        function onFromRemoved() {
            vm.form.from = '';
        }

        function onToRemoved() {
            vm.form.to = '';
        }

        function airfieldTagTransform(text) {
            return { code: text.toUpperCase(), title: text.toUpperCase(), _custom: true };
        }


        // ═══════════════════════════════════════════
        //  Create Bookout
        // ═══════════════════════════════════════════

        function submitBookout() {
            if (!vm.form.registration || !vm.form.pic_name) return;

            vm.submitting = true;
            var payload = {
                registration:  vm.form.registration.toUpperCase(),
                aircraft_type: vm.form.aircraft_type || null,
                pic_name:      vm.form.pic_name,
                from:          vm.form.from || null,
                to:            vm.form.to || null,
                pob_outbound:  vm.form.pob_outbound || 1,
                pob_inbound:   vm.form.pob_inbound || vm.form.pob_outbound || 1,
                notes:         vm.form.notes || null,
                plane_id:      vm.form.plane_id || null
            };

            AirfieldBookoutService.CreateBookout(vm.icao, payload)
                .then(function(data) {
                    vm.submitting = false;
                    if (data.success) {
                        vm.submitted    = true;
                        vm.bookout_id   = data.id;
                        vm.result_code  = data.edit_code;
                    } else {
                        alert(data.message || 'Could not submit bookout. Please try again.');
                    }
                }, function() {
                    vm.submitting = false;
                    alert('Connection error. Please check your internet and try again.');
                });
        }


        // ═══════════════════════════════════════════
        //  Edit / Delete Bookout
        // ═══════════════════════════════════════════

        function showEditLookup() {
            vm.show_edit_lookup = true;
            vm.edit_lookup_code = '';
        }

        function lookupEditCode() {
            if (!vm.edit_lookup_code || vm.edit_lookup_code.length < 4) return;

            vm.submitting = true;
            AirfieldBookoutService.GetBookoutByCode(vm.icao, vm.edit_lookup_code)
                .then(function(data) {
                    vm.submitting = false;
                    if (data.success) {
                        vm.editing    = true;
                        vm.bookout_id = data.id;
                        vm.edit_code  = vm.edit_lookup_code;
                        vm.show_edit_lookup = false;

                        // Populate form
                        vm.form.registration   = data.registration || '';
                        vm.form.aircraft_type  = data.aircraft_type || '';
                        vm.form.pic_name       = data.pic_name || '';
                        vm.form.from           = data.from_location || '';
                        vm.form.to             = data.to_location || '';
                        vm.form.pob_outbound   = data.pob_outbound || 1;
                        vm.form.pob_inbound    = data.pob_inbound || null;
                        vm.form.notes          = data.notes || '';
                        vm.form.plane_id       = data.plane_id || null;
                        vm.lookup_done         = true;

                        // Sync ui-select models
                        if (vm.form.from) {
                            vm.selected_from = _findPresetByCode(vm.form.from) ||
                                               { code: vm.form.from, title: vm.form.from };
                        }
                        if (vm.form.to) {
                            vm.selected_to = _findPresetByCode(vm.form.to) ||
                                             { code: vm.form.to, title: vm.form.to };
                        }
                    } else {
                        alert(data.message || 'Bookout not found with that edit code.');
                    }
                });
        }

        function updateBookout() {
            if (!vm.bookout_id || !vm.edit_code) return;

            vm.submitting = true;
            var payload = {
                edit_code:     vm.edit_code,
                registration:  vm.form.registration.toUpperCase(),
                aircraft_type: vm.form.aircraft_type || null,
                pic_name:      vm.form.pic_name,
                from:          vm.form.from || null,
                to:            vm.form.to || null,
                pob_outbound:  vm.form.pob_outbound || 1,
                pob_inbound:   vm.form.pob_inbound || vm.form.pob_outbound || 1,
                notes:         vm.form.notes || null
            };

            AirfieldBookoutService.UpdateBookout(vm.icao, vm.bookout_id, payload)
                .then(function(data) {
                    vm.submitting = false;
                    if (data.success) {
                        vm.submitted   = true;
                        vm.result_code = vm.edit_code;
                    } else {
                        alert(data.message || 'Could not update bookout.');
                    }
                });
        }

        function cancelEdit() {
            vm.editing = false;
            vm.bookout_id = null;
            vm.edit_code = '';
            resetForm();
        }

        function deleteBookout() {
            if (!vm.bookout_id || !vm.edit_code) return;
            if (!confirm('Delete this bookout? This cannot be undone.')) return;

            vm.deleting = true;
            AirfieldBookoutService.DeleteBookout(vm.icao, vm.bookout_id, vm.edit_code)
                .then(function(data) {
                    vm.deleting = false;
                    if (data.success) {
                        vm.editing = false;
                        vm.bookout_id = null;
                        vm.edit_code = '';
                        resetForm();
                        alert('Bookout deleted successfully.');
                    } else {
                        alert(data.message || 'Could not delete bookout.');
                    }
                });
        }


        // ═══════════════════════════════════════════
        //  Reset / New
        // ═══════════════════════════════════════════

        function startNewBookout() {
            vm.submitted   = false;
            vm.editing     = false;
            vm.bookout_id  = null;
            vm.edit_code   = '';
            vm.result_code = '';
            vm.show_edit_lookup = false;
            resetForm();
        }

        function resetForm() {
            vm.form = {
                registration:   '',
                aircraft_type:  '',
                pic_name:       '',
                from:           '',
                to:             '',
                pob_outbound:   1,
                pob_inbound:    null,
                notes:          '',
                plane_id:       null
            };
            vm.lookup_done   = false;
            vm.selected_from = null;
            vm.selected_to   = null;
            vm.from_airfield_options = angular.copy(vm.preset_airfields);
            vm.to_airfield_options   = angular.copy(vm.preset_airfields);
        }

        function copyEditCode() {
            var code = vm.result_code;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(code);
            } else {
                var el = document.createElement('textarea');
                el.value = code;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }
        }
    }
