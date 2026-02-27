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

        // ── Public methods ──
        vm.filterAircraft       = filterAircraft;
        vm.selectAircraft       = selectAircraft;
        vm.onRegistrationBlur   = onRegistrationBlur;
        vm.setQuickFrom         = setQuickFrom;
        vm.setQuickTo           = setQuickTo;
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
        //  Quick-pick buttons
        // ═══════════════════════════════════════════

        function setQuickFrom(value) {
            vm.form.from = value;
        }

        function setQuickTo(value) {
            vm.form.to = value;
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
                pob_inbound:   vm.form.pob_inbound || null,
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
                pob_inbound:   vm.form.pob_inbound || null,
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
            vm.lookup_done = false;
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
