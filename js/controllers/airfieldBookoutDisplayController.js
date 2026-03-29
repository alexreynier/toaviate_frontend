// ═══════════════════════════════════════════════════════════════════
//  AirfieldBookoutDisplayController
//  Controller / ATC Display — full-screen dashboard
//  Token-based access via /bookout-display/:token
// ═══════════════════════════════════════════════════════════════════

app.controller('AirfieldBookoutDisplayController', AirfieldBookoutDisplayController);

    AirfieldBookoutDisplayController.$inject = [
        'AirfieldBookoutService', '$scope', '$stateParams', '$interval', '$timeout'
    ];
    function AirfieldBookoutDisplayController(
        AirfieldBookoutService, $scope, $stateParams, $interval, $timeout
    ) {
        var vm = this;

        // ── Route params ──
        vm.token = $stateParams.token;

        // ── Page state ──
        vm.loading        = true;
        vm.error          = false;
        vm.error_message  = '';
        vm.connected      = true;

        // ── Airfield info ──
        vm.airfield       = null;
        vm.label          = '';
        vm.airfield_timezone = 'Europe/London';

        // ── Clock ──
        vm.current_time   = '';
        vm.current_date   = '';
        vm.last_updated   = '';

        // ── Bookouts ──
        vm.bookouts       = [];
        vm.server_time    = null;

        // ── Date filtering ──
        vm.selected_date  = null;      // null = today (live), or 'YYYY-MM-DD'
        vm.is_past_date   = false;
        vm.display_date_label = 'Today';
        vm.date_picker_value = '';

        // ── Tower creation ──
        vm.display_allow_create = false;
        vm.allow_public_edit    = false;
        vm.show_create_form     = false;
        vm.creating             = false;
        vm.create_form = {
            registration:   '',
            aircraft_type:  '',
            pic_name:       '',
            from:           '',
            to:             '',
            pob_outbound:   1,
            pob_inbound:    null,
            notes:          ''
        };
        vm.create_reg_search      = '';
        vm.create_filtered_aircraft = [];
        vm.create_show_dropdown   = false;
        vm.create_aircraft_list   = [];

        // ── Tower edit ──
        vm.show_edit_form     = false;
        vm.editing_bookout    = null;
        vm.edit_saving        = false;
        vm.edit_form = {
            registration:   '',
            aircraft_type:  '',
            pic_name:       '',
            from:           '',
            to:             '',
            pob_outbound:   1,
            pob_inbound:    null,
            notes:          ''
        };

        // ── Public methods ──
        vm.copyRow        = copyRow;
        vm.confirmRow     = confirmRow;
        vm.closeRow       = closeRow;
        vm.getStatusClass = getStatusClass;
        vm.getStatusLabel = getStatusLabel;
        vm.formatTime     = formatTime;
        vm.formatPobIn    = formatPobIn;
        vm.viewToday      = viewToday;
        vm.viewDate       = viewDate;
        vm.prevDay        = prevDay;
        vm.nextDay        = nextDay;
        vm.onDatePicked   = onDatePicked;
        vm.copyAllBookouts = copyAllBookouts;
        vm.toggleCreateForm = toggleCreateForm;
        vm.filterCreateAircraft = filterCreateAircraft;
        vm.selectCreateAircraft = selectCreateAircraft;
        vm.hideCreateDropdown   = hideCreateDropdown;
        vm.onCreateRegBlur      = onCreateRegBlur;
        vm.setCreateQuick       = setCreateQuick;
        vm.submitCreateBookout  = submitCreateBookout;
        vm.cancelCreateForm     = cancelCreateForm;
        vm.editRow              = editRow;
        vm.deleteRow            = deleteRow;
        vm.submitEditBookout    = submitEditBookout;
        vm.cancelEditForm       = cancelEditForm;

        var pollTimer     = null;
        var clockTimer    = null;

        // ── Init ──
        init();


        function init() {
            if (!vm.token) {
                vm.loading = false;
                vm.error = true;
                vm.error_message = 'No display token provided.';
                return;
            }

            // Start clock
            updateClock();
            clockTimer = $interval(updateClock, 1000);

            // Fetch display info
            AirfieldBookoutService.GetDisplayInfo(vm.token)
                .then(function(data) {
                    if (data.success) {
                        vm.airfield = data.airfield;
                        vm.label = data.label || '';
                        if (data.airfield && data.airfield.timezone) {
                            vm.airfield_timezone = data.airfield.timezone;
                        }
                        if (data.settings) {
                            vm.display_allow_create = !!data.settings.display_allow_create;
                            vm.allow_public_edit    = !!data.settings.allow_public_edit;
                        }
                        // Set initial date to today
                        vm.selected_date = null;
                        vm.display_date_label = 'Today';
                        loadTodayBookouts();
                    } else {
                        vm.loading = false;
                        vm.error = true;
                        vm.error_message = data.message || 'Invalid or expired display token.';
                    }
                }, function() {
                    vm.loading = false;
                    vm.error = true;
                    vm.error_message = 'Could not connect to the server.';
                });
        }


        // ═══════════════════════════════════════════
        //  Load Bookouts
        // ═══════════════════════════════════════════

        function loadTodayBookouts() {
            AirfieldBookoutService.GetDisplayToday(vm.token)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.bookouts     = data.bookouts || [];
                        vm.server_time  = data.server_time;
                        vm.is_past_date = false;
                        vm.connected    = true;
                        updateLastUpdated();
                        startPolling();
                    }
                }, function() {
                    vm.loading = false;
                    vm.connected = false;
                });
        }

        function loadDateBookouts(dateStr) {
            vm.loading = true;
            stopPolling();
            AirfieldBookoutService.GetDisplayDate(vm.token, dateStr)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.bookouts    = data.bookouts || [];
                        vm.is_past_date = !!data.is_past;
                        vm.server_time = data.server_time;
                        vm.connected   = true;
                        updateLastUpdated();
                    }
                }, function() {
                    vm.loading = false;
                    vm.connected = false;
                });
        }


        // ═══════════════════════════════════════════
        //  Date Navigation
        // ═══════════════════════════════════════════

        function viewToday() {
            vm.selected_date = null;
            vm.display_date_label = 'Today';
            vm.is_past_date = false;
            vm.date_picker_value = '';
            vm.loading = true;
            loadTodayBookouts();
        }

        function viewDate(dateStr) {
            var today = _getTodayStr();
            if (dateStr === today) {
                viewToday();
                return;
            }
            vm.selected_date = dateStr;
            vm.display_date_label = _formatDateLabel(dateStr);
            vm.date_picker_value = dateStr;
            loadDateBookouts(dateStr);
        }

        function prevDay() {
            var ref = vm.selected_date || _getTodayStr();
            var d = new Date(ref);
            d.setDate(d.getDate() - 1);
            viewDate(_dateToStr(d));
        }

        function nextDay() {
            var ref = vm.selected_date || _getTodayStr();
            var d = new Date(ref);
            d.setDate(d.getDate() + 1);
            viewDate(_dateToStr(d));
        }

        function onDatePicked() {
            if (vm.date_picker_value) {
                viewDate(vm.date_picker_value);
            }
        }

        function _getTodayStr() {
            var now = new Date();
            return _dateToStr(now);
        }

        function _dateToStr(d) {
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        }

        function _formatDateLabel(dateStr) {
            try {
                var parts = dateStr.split('-');
                var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                return d.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            } catch (e) {
                return dateStr;
            }
        }


        // ═══════════════════════════════════════════
        //  Copy All Bookouts (CSV)
        // ═══════════════════════════════════════════

        function copyAllBookouts() {
            var header = 'Registration, Type, PIC, From, To, POB Out, POB In, Notes, Time, Status';
            var lines = [header];
            var sorted = vm.bookouts.slice().sort(function(a, b) {
                return (a.created_at || '').localeCompare(b.created_at || '');
            });
            for (var i = 0; i < sorted.length; i++) {
                var b = sorted[i];
                lines.push([
                    b.registration || '',
                    b.aircraft_type || '',
                    b.pic_name || '',
                    b.from_location || '',
                    b.to_location || '',
                    b.pob_outbound || '',
                    b.pob_inbound || '',
                    (b.notes || '').replace(/,/g, ';'),
                    formatTime(b.created_at),
                    b.status || ''
                ].join(', '));
            }
            var csv = lines.join('\n');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(csv);
            } else {
                var el = document.createElement('textarea');
                el.value = csv;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }
        }


        // ═══════════════════════════════════════════
        //  Tower-Side Bookout Creation
        // ═══════════════════════════════════════════

        function toggleCreateForm() {
            vm.show_create_form = !vm.show_create_form;
            if (vm.show_create_form) {
                resetCreateForm();
                // Load aircraft list for autocomplete
                if (vm.airfield && vm.airfield.code && vm.create_aircraft_list.length === 0) {
                    AirfieldBookoutService.LoadFormData(vm.airfield.code)
                        .then(function(data) {
                            if (data.success) {
                                vm.create_aircraft_list = data.aircraft || [];
                            }
                        });
                }
            }
        }

        function cancelCreateForm() {
            vm.show_create_form = false;
            resetCreateForm();
        }

        function resetCreateForm() {
            vm.create_form = {
                registration:   '',
                aircraft_type:  '',
                pic_name:       '',
                from:           '',
                to:             '',
                pob_outbound:   1,
                pob_inbound:    null,
                notes:          ''
            };
            vm.create_filtered_aircraft = [];
            vm.create_show_dropdown = false;
            vm.creating = false;
        }

        function filterCreateAircraft() {
            var q = (vm.create_form.registration || '').toUpperCase();
            vm.create_form.registration = q;
            if (q.length < 1) {
                vm.create_filtered_aircraft = [];
                vm.create_show_dropdown = false;
                return;
            }
            vm.create_filtered_aircraft = vm.create_aircraft_list.filter(function(ac) {
                return ac.registration.toUpperCase().indexOf(q) > -1;
            }).slice(0, 8);
            vm.create_show_dropdown = vm.create_filtered_aircraft.length > 0;
        }

        function selectCreateAircraft(ac) {
            vm.create_form.registration  = ac.registration;
            vm.create_form.aircraft_type = ac.plane_type || '';
            vm.create_show_dropdown = false;
        }

        function hideCreateDropdown() {
            $timeout(function() {
                vm.create_show_dropdown = false;
            }, 200);
        }

        function onCreateRegBlur() {
            hideCreateDropdown();
            vm.create_form.registration = (vm.create_form.registration || '').toUpperCase();
            if (vm.create_form.registration.length >= 4 && !vm.create_form.aircraft_type && vm.airfield) {
                AirfieldBookoutService.LookupAircraft(vm.airfield.code, vm.create_form.registration)
                    .then(function(data) {
                        if (data.success) {
                            vm.create_form.aircraft_type = data.aircraft_type || '';
                        }
                    });
            }
        }

        function setCreateQuick(value) {
            vm.create_form.from = value;
            vm.create_form.to   = value;
        }

        function submitCreateBookout() {
            if (!vm.create_form.registration || !vm.create_form.pic_name) return;
            vm.creating = true;

            var payload = {
                registration:  vm.create_form.registration.toUpperCase(),
                pic_name:      vm.create_form.pic_name,
                aircraft_type: vm.create_form.aircraft_type || null,
                from:          vm.create_form.from || null,
                to:            vm.create_form.to || null,
                pob_outbound:  vm.create_form.pob_outbound || 1,
                pob_inbound:   vm.create_form.pob_inbound || vm.create_form.pob_outbound || 1,
                notes:         vm.create_form.notes || null
            };

            AirfieldBookoutService.CreateDisplayBookout(vm.token, payload)
                .then(function(data) {
                    vm.creating = false;
                    if (data.success) {
                        vm.show_create_form = false;
                        resetCreateForm();
                        // Refresh now — delta will also pick it up
                        if (!vm.selected_date) {
                            loadTodayBookouts();
                        }
                    } else {
                        alert(data.message || 'Could not create bookout.');
                    }
                }, function() {
                    vm.creating = false;
                    alert('Connection error. Please try again.');
                });
        }


        // ═══════════════════════════════════════════
        //  Tower-Side Bookout Editing (public edit)
        // ═══════════════════════════════════════════

        function editRow(bookout) {
            vm.editing_bookout = bookout;
            vm.edit_form = {
                registration:  bookout.registration || '',
                aircraft_type: bookout.aircraft_type || '',
                pic_name:      bookout.pic_name || '',
                from:          bookout.from_location || '',
                to:            bookout.to_location || '',
                pob_outbound:  bookout.pob_outbound || 1,
                pob_inbound:   bookout.pob_inbound || null,
                notes:         bookout.notes || ''
            };
            vm.show_edit_form = true;

            // Load aircraft list for autocomplete if not loaded
            if (vm.airfield && vm.airfield.code && vm.create_aircraft_list.length === 0) {
                AirfieldBookoutService.LoadFormData(vm.airfield.code)
                    .then(function(data) {
                        if (data.success) {
                            vm.create_aircraft_list = data.aircraft || [];
                        }
                    });
            }
        }

        function cancelEditForm() {
            vm.show_edit_form = false;
            vm.editing_bookout = null;
            vm.edit_saving = false;
        }

        function submitEditBookout() {
            if (!vm.editing_bookout || !vm.edit_form.registration || !vm.edit_form.pic_name) return;
            vm.edit_saving = true;

            var payload = {};
            // Only send changed fields
            if (vm.edit_form.registration !== (vm.editing_bookout.registration || ''))
                payload.registration = vm.edit_form.registration.toUpperCase();
            if (vm.edit_form.aircraft_type !== (vm.editing_bookout.aircraft_type || ''))
                payload.aircraft_type = vm.edit_form.aircraft_type;
            if (vm.edit_form.pic_name !== (vm.editing_bookout.pic_name || ''))
                payload.pic_name = vm.edit_form.pic_name;
            if (vm.edit_form.from !== (vm.editing_bookout.from_location || ''))
                payload.from = vm.edit_form.from;
            if (vm.edit_form.to !== (vm.editing_bookout.to_location || ''))
                payload.to = vm.edit_form.to;
            if (vm.edit_form.pob_outbound !== (vm.editing_bookout.pob_outbound || 1))
                payload.pob_outbound = vm.edit_form.pob_outbound;
            if (vm.edit_form.pob_inbound !== vm.editing_bookout.pob_inbound)
                payload.pob_inbound = vm.edit_form.pob_inbound;
            if (vm.edit_form.notes !== (vm.editing_bookout.notes || ''))
                payload.notes = vm.edit_form.notes;

            // If nothing changed, just close
            if (Object.keys(payload).length === 0) {
                cancelEditForm();
                return;
            }

            AirfieldBookoutService.EditDisplayBookout(vm.token, vm.editing_bookout.id, payload)
                .then(function(data) {
                    vm.edit_saving = false;
                    if (data.success) {
                        // Update local state immediately
                        angular.extend(vm.editing_bookout, {
                            registration:  vm.edit_form.registration.toUpperCase(),
                            aircraft_type: vm.edit_form.aircraft_type,
                            pic_name:      vm.edit_form.pic_name,
                            from_location: vm.edit_form.from,
                            to_location:   vm.edit_form.to,
                            pob_outbound:  vm.edit_form.pob_outbound,
                            pob_inbound:   vm.edit_form.pob_inbound,
                            notes:         vm.edit_form.notes
                        });
                        vm.show_edit_form = false;
                        vm.editing_bookout = null;
                    } else {
                        alert(data.message || 'Could not update bookout.');
                    }
                }, function() {
                    vm.edit_saving = false;
                    alert('Connection error. Please try again.');
                });
        }

        function deleteRow(bookout) {
            if (!confirm('Remove this bookout for ' + (bookout.registration || 'unknown') + '?')) return;

            bookout._deleting = true;
            AirfieldBookoutService.DeleteDisplayBookout(vm.token, bookout.id)
                .then(function(data) {
                    bookout._deleting = false;
                    if (data.success) {
                        var idx = vm.bookouts.indexOf(bookout);
                        if (idx > -1) vm.bookouts.splice(idx, 1);
                    } else {
                        alert(data.message || 'Could not delete bookout.');
                    }
                }, function() {
                    bookout._deleting = false;
                    alert('Connection error. Please try again.');
                });
        }


        // ═══════════════════════════════════════════
        //  Delta Polling (every 10 seconds)
        // ═══════════════════════════════════════════

        function stopPolling() {
            if (pollTimer) {
                $interval.cancel(pollTimer);
                pollTimer = null;
            }
        }

        function startPolling() {
            if (pollTimer) return;
            // Only poll when viewing today (live data)
            if (vm.selected_date) return;

            pollTimer = $interval(function() {
                if (!vm.server_time) return;

                AirfieldBookoutService.GetDelta(vm.token, vm.server_time)
                    .then(function(data) {
                        vm.connected = true;

                        if (!data.success) {
                            if (data.message && data.message.toLowerCase().indexOf('invalid') > -1) {
                                vm.error = true;
                                vm.error_message = 'Display token has been revoked.';
                                $interval.cancel(pollTimer);
                            }
                            return;
                        }

                        // Upsert new/updated bookouts
                        if (data.bookouts && data.bookouts.length > 0) {
                            for (var i = 0; i < data.bookouts.length; i++) {
                                upsertBookout(data.bookouts[i]);
                            }
                        }

                        // Remove closed bookouts
                        if (data.closed_ids && data.closed_ids.length > 0) {
                            vm.bookouts = vm.bookouts.filter(function(b) {
                                return data.closed_ids.indexOf(b.id) === -1;
                            });
                        }

                        // Update server time
                        vm.server_time = data.server_time;
                        updateLastUpdated();
                    }, function() {
                        vm.connected = false;
                    });
            }, 10000);
        }

        function upsertBookout(incoming) {
            for (var i = 0; i < vm.bookouts.length; i++) {
                if (vm.bookouts[i].id === incoming.id) {
                    // Update existing
                    angular.extend(vm.bookouts[i], incoming);
                    return;
                }
            }
            // New entry — add to beginning
            vm.bookouts.unshift(incoming);
        }


        // ═══════════════════════════════════════════
        //  Status Actions
        // ═══════════════════════════════════════════

        function copyRow(bookout) {
            // Build CSV line
            var csv = [
                bookout.registration || '',
                bookout.aircraft_type || '',
                bookout.pic_name || '',
                bookout.from_location || '',
                bookout.to_location || '',
                bookout.pob_outbound || '',
                bookout.pob_inbound || '',
                bookout.notes || ''
            ].join(', ');

            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(csv);
            } else {
                var el = document.createElement('textarea');
                el.value = csv;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }

            // Only advance status when copying from active
            if (bookout.status === 'active') {
                AirfieldBookoutService.UpdateStatus(vm.token, bookout.id, 'copied')
                    .then(function(data) {
                        if (data.success) {
                            bookout.status = 'copied';
                        }
                    });
            }
        }

        function confirmRow(bookout) {
            AirfieldBookoutService.UpdateStatus(vm.token, bookout.id, 'confirmed')
                .then(function(data) {
                    if (data.success) {
                        bookout.status = 'confirmed';
                    }
                });
        }

        function closeRow(bookout) {
            AirfieldBookoutService.CloseBookout(vm.token, bookout.id)
                .then(function(data) {
                    if (data.success) {
                        var idx = vm.bookouts.indexOf(bookout);
                        if (idx > -1) vm.bookouts.splice(idx, 1);
                    }
                });
        }


        // ═══════════════════════════════════════════
        //  Display Helpers
        // ═══════════════════════════════════════════

        function getStatusClass(status) {
            switch (status) {
                case 'active':    return 'abd-status--active';
                case 'copied':    return 'abd-status--copied';
                case 'confirmed': return 'abd-status--confirmed';
                case 'closed':    return 'abd-status--closed';
                default:          return '';
            }
        }

        function getStatusLabel(status) {
            switch (status) {
                case 'active':    return 'NEW';
                case 'copied':    return 'COPIED';
                case 'confirmed': return 'CONFIRMED';
                case 'closed':    return 'CLOSED';
                default:          return status;
            }
        }

        function formatTime(dateStr) {
            if (!dateStr) return '';
            try {
                var d = new Date(dateStr);
                // Try to use airfield timezone
                if (vm.airfield_timezone) {
                    return d.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: vm.airfield_timezone
                    });
                }
                var h = String(d.getHours()).padStart(2, '0');
                var m = String(d.getMinutes()).padStart(2, '0');
                return h + ':' + m;
            } catch (e) {
                return dateStr;
            }
        }

        function formatPobIn(bookout) {
            if (bookout.pob_inbound === null || bookout.pob_inbound === undefined) {
                return '—';
            }
            return bookout.pob_inbound;
        }

        function updateClock() {
            var now = new Date();
            try {
                vm.current_time = now.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: vm.airfield_timezone
                });
                vm.current_date = now.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: vm.airfield_timezone
                });
            } catch (e) {
                var h = String(now.getHours()).padStart(2, '0');
                var m = String(now.getMinutes()).padStart(2, '0');
                var s = String(now.getSeconds()).padStart(2, '0');
                vm.current_time = h + ':' + m + ':' + s;
            }
        }

        function updateLastUpdated() {
            var now = new Date();
            try {
                vm.last_updated = now.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: vm.airfield_timezone
                });
            } catch (e) {
                vm.last_updated = vm.current_time;
            }
        }


        // ═══════════════════════════════════════════
        //  Cleanup
        // ═══════════════════════════════════════════

        $scope.$on('$destroy', function() {
            if (pollTimer)  $interval.cancel(pollTimer);
            if (clockTimer) $interval.cancel(clockTimer);
        });
    }
