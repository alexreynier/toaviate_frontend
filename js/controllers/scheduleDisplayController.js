 app.controller('ScheduleDisplayController', ScheduleDisplayController);

    ScheduleDisplayController.$inject = ['ScheduleDisplayService', '$scope', '$stateParams', '$interval', '$timeout'];
    function ScheduleDisplayController(ScheduleDisplayService, $scope, $stateParams, $interval, $timeout) {
        var vm = this;

        // ── State ──
        vm.token = $stateParams.token;
        vm.club_name = '';
        vm.loading = true;
        vm.error = false;
        vm.error_message = '';
        vm.revoked = false;
        vm.current_time = '';
        vm.connected = true;
        vm.today_label = '';

        var currentVersion = -1;
        var pollTimer = null;
        var clockTimer = null;

        // ── Initialise ──
        init();

        function init() {
            if (!vm.token) {
                vm.loading = false;
                vm.error = true;
                vm.error_message = 'No display token provided. Please check the URL.';
                return;
            }

            // Start the clock
            updateClock();
            clockTimer = $interval(updateClock, 1000);

            // Fetch club info
            ScheduleDisplayService.GetClubInfo(vm.token)
                .then(function(data) {
                    if (data.success) {
                        // Backend returns { club: { id, title } }
                        vm.club_name = (data.club && data.club.title) ? data.club.title : (data.club_name || data.name || '');
                        vm.loading = false;
                        // Calendar will be initialised from the view's inline script
                        // once it detects vm.loading === false
                    } else {
                        vm.loading = false;
                        vm.error = true;
                        vm.error_message = 'Invalid or expired display token. Please ask your club manager to generate a new link.';
                    }
                }, function() {
                    vm.loading = false;
                    vm.error = true;
                    vm.error_message = 'Could not connect to the server. Please check your internet connection.';
                });
        }

        // ── Clock ──
        function updateClock() {
            var now = new Date();
            var hours = String(now.getHours()).padStart(2, '0');
            var mins  = String(now.getMinutes()).padStart(2, '0');
            var secs  = String(now.getSeconds()).padStart(2, '0');
            vm.current_time = hours + ':' + mins + ':' + secs;

            var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            vm.today_label = days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
        }

        // ── Load schedule data (called from view) ──
        $scope.loadSchedule = function(start, end) {
            return ScheduleDisplayService.GetSchedule(vm.token, start, end)
                .then(function(data) {
                    if (data.success !== false && data.resources) {
                        currentVersion = data.schedule_version;
                        vm.connected = true;

                        // Filter out waiting list resources (waiting == 1)
                        data.resources = data.resources.filter(function(r) {
                            return r.waiting != 1;
                        });

                        // Also filter out events assigned to waiting list resources
                        data.events = data.events.filter(function(e) {
                            return !e.waiting_list || e.waiting_list == 0;
                        });

                        return data;
                    } else {
                        if (data.message && data.message.toLowerCase().indexOf('revok') > -1) {
                            vm.revoked = true;
                        }
                        return null;
                    }
                }, function() {
                    vm.connected = false;
                    return null;
                });
        };

        // ── Start polling ──
        $scope.startPolling = function() {
            if (pollTimer) return;

            pollTimer = $interval(function() {
                ScheduleDisplayService.GetVersion(vm.token)
                    .then(function(data) {
                        vm.connected = true;

                        if (!data.success) {
                            // Token was revoked
                            vm.revoked = true;
                            $interval.cancel(pollTimer);
                            pollTimer = null;
                            return;
                        }

                        if (data.schedule_version !== currentVersion) {
                            // Something changed — trigger reload from view
                            $scope.$broadcast('schedule:version-changed');
                        }
                    }, function() {
                        // Network error — will retry next poll
                        vm.connected = false;
                    });
            }, 30000); // 30 seconds
        };

        // ── Schedule midnight rollover ──
        $scope.scheduleMidnightRollover = function() {
            var now = new Date();
            var tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 5, 0); // 5 seconds past midnight

            var msUntilMidnight = tomorrow.getTime() - now.getTime();

            $timeout(function() {
                $scope.$broadcast('schedule:midnight-rollover');
                $scope.scheduleMidnightRollover(); // schedule next
            }, msUntilMidnight);
        };

        // ── Cleanup ──
        $scope.$on('$destroy', function() {
            if (pollTimer) { $interval.cancel(pollTimer); }
            if (clockTimer) { $interval.cancel(clockTimer); }
        });
    }
