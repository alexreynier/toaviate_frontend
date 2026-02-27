 app.controller('DisplayPairingController', DisplayPairingController);

    DisplayPairingController.$inject = ['ScheduleDisplayService', '$scope', '$interval', '$timeout', '$window'];
    function DisplayPairingController(ScheduleDisplayService, $scope, $interval, $timeout, $window) {
        var vm = this;

        // ── State ──
        vm.code = '';
        vm.codeDigits = [];
        vm.sessionUuid = '';
        vm.paired = false;
        vm.expired = false;
        vm.loading = true;
        vm.error = false;
        vm.error_message = '';
        vm.countdown = 600; // 10 minutes
        vm.countdownDisplay = '10:00';
        vm.current_time = '';

        var pollTimer = null;
        var countdownTimer = null;
        var clockTimer = null;

        // ── Initialise ──
        init();

        function init() {
            updateClock();
            clockTimer = $interval(updateClock, 1000);
            requestNewCode();
        }

        // ── Clock ──
        function updateClock() {
            var now = new Date();
            var hours = String(now.getHours()).padStart(2, '0');
            var mins  = String(now.getMinutes()).padStart(2, '0');
            var secs  = String(now.getSeconds()).padStart(2, '0');
            vm.current_time = hours + ':' + mins + ':' + secs;
        }

        // ── Request a new pairing code ──
        function requestNewCode() {
            vm.loading = true;
            vm.expired = false;
            vm.paired = false;
            vm.error = false;

            ScheduleDisplayService.RequestPairingCode()
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.code = data.code;
                        vm.codeDigits = data.code.split('');
                        vm.sessionUuid = data.session_uuid;

                        // Calculate countdown from expiry
                        var expiresAt = new Date(data.expires_at).getTime();
                        vm.countdown = Math.floor((expiresAt - Date.now()) / 1000);
                        if (vm.countdown < 0) vm.countdown = 600;

                        updateCountdownDisplay();
                        startPolling();
                        startCountdown();
                    } else {
                        vm.error = true;
                        vm.error_message = data.message || 'Failed to generate pairing code. Please refresh the page.';
                    }
                }, function() {
                    vm.loading = false;
                    vm.error = true;
                    vm.error_message = 'Could not connect to the server. Please check your internet connection and refresh.';
                });
        }

        vm.requestNewCode = requestNewCode;

        // ── Poll for pairing status ──
        function startPolling() {
            stopPolling();
            pollTimer = $interval(function() {
                if (!vm.sessionUuid || vm.paired || vm.expired) return;

                ScheduleDisplayService.CheckPairingStatus(vm.sessionUuid)
                    .then(function(data) {
                        if (data.success && data.paired) {
                            vm.paired = true;
                            stopPolling();
                            stopCountdown();

                            // Redirect to the actual display page after a brief pause
                            $timeout(function() {
                                $window.location.href = '/display/' + data.token;
                            }, 2500);
                        }

                        if (!data.success && data.expired) {
                            vm.expired = true;
                            stopPolling();
                            stopCountdown();
                        }
                    }, function() {
                        // Network error — will retry next poll
                    });
            }, 3000);
        }

        function stopPolling() {
            if (pollTimer) {
                $interval.cancel(pollTimer);
                pollTimer = null;
            }
        }

        // ── Countdown timer ──
        function startCountdown() {
            stopCountdown();
            countdownTimer = $interval(function() {
                vm.countdown--;
                updateCountdownDisplay();
                if (vm.countdown <= 0) {
                    vm.expired = true;
                    stopCountdown();
                    stopPolling();
                }
            }, 1000);
        }

        function stopCountdown() {
            if (countdownTimer) {
                $interval.cancel(countdownTimer);
                countdownTimer = null;
            }
        }

        function updateCountdownDisplay() {
            var mins = Math.max(0, Math.floor(vm.countdown / 60));
            var secs = Math.max(0, vm.countdown % 60);
            vm.countdownDisplay = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }

        // ── Cleanup ──
        $scope.$on('$destroy', function() {
            stopPolling();
            stopCountdown();
            if (clockTimer) { $interval.cancel(clockTimer); }
        });
    }
