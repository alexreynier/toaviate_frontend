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

        // ── Public methods ──
        vm.copyRow        = copyRow;
        vm.confirmRow     = confirmRow;
        vm.closeRow       = closeRow;
        vm.getStatusClass = getStatusClass;
        vm.getStatusLabel = getStatusLabel;
        vm.formatTime     = formatTime;
        vm.formatPobIn    = formatPobIn;

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
                        loadActiveBookouts();
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
        //  Load Active Bookouts
        // ═══════════════════════════════════════════

        function loadActiveBookouts() {
            AirfieldBookoutService.GetActiveBookouts(vm.token)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.bookouts     = data.bookouts || [];
                        vm.server_time  = data.server_time;
                        vm.connected    = true;
                        updateLastUpdated();
                        startPolling();
                    }
                }, function() {
                    vm.loading = false;
                    vm.connected = false;
                });
        }


        // ═══════════════════════════════════════════
        //  Delta Polling (every 10 seconds)
        // ═══════════════════════════════════════════

        function startPolling() {
            if (pollTimer) return;

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

            // Update status
            AirfieldBookoutService.UpdateStatus(vm.token, bookout.id, 'copied')
                .then(function(data) {
                    if (data.success) {
                        bookout.status = 'copied';
                    }
                });
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
                default:          return '';
            }
        }

        function getStatusLabel(status) {
            switch (status) {
                case 'active':    return 'NEW';
                case 'copied':    return 'COPIED';
                case 'confirmed': return 'CONFIRMED';
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
