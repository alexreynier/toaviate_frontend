app.controller('DisplayPairingController', DisplayPairingController);

    // Pair a TV, /display/tv (public, no login). New look 11 Nov 2026 from the approved mockup
    // mockups/schedule-display/tv.html (screen "Pairing code" / "Connected"); the pairing calls are unchanged:
    // POST schedule_display_pairing → {code, session_uuid, expires_at}; GET schedule_display_pairing/{uuid} every 3 s →
    // {paired, token} | {expired}. Nothing to press on a TV: an expired code is replaced by a new one by itself, and a
    // failed request retries every 20 s. Once a manager enters the code: "Connected to …" and the schedule opens.
    DisplayPairingController.$inject = ['ScheduleDisplayService', 'TvFullscreen', '$scope', '$interval', '$timeout', '$window', '$document', '$sce', '$location'];
    function DisplayPairingController(ScheduleDisplayService, TvFullscreen, $scope, $interval, $timeout, $window, $document, $sce, $location) {
        var vm = this;
        var POLL_MS = 3000;
        var CODE_S = 600;              // a code lives 10 minutes (schedule_display_pairing.model.php)
        var RETRY_S = 20;
        var OPEN_MS = 2500;            // "Connected" stays up this long before the schedule opens
        // where a manager pairs the TV (frontend-6f's settings page, dashboard.manage_club.schedule_display)
        var SETTINGS_PATH = '/dashboard/manage_club/schedule_display';

        vm.view = 'loading';           // loading | code | paired | error
        vm.code = '';
        vm.code_spaced = '';
        vm.digits = [];
        vm.countdown = '';
        vm.clock = '';
        vm.club_name = '';
        vm.retry_in = RETRY_S;
        vm.qr = null;

        var doc = $document[0], html = doc.documentElement, body = doc.body;
        var hadNight = body.classList.contains('night-mode');
        var sessionUuid = '', secondsLeft = CODE_S, requesting = false;
        var clockTimer = null, pollTimer = null, countdownTimer = null, retryTimer = null, openTimer = null;

        html.classList.add('sdv-html');
        body.classList.add('sdv-body');
        body.classList.remove('night-mode');   // the pairing screen is in the light theme (no club yet, so no TV options)
        vm.fs = TvFullscreen.attach($scope);

        updateClock();
        clockTimer = $interval(updateClock, 1000);
        requestNewCode();

        function updateClock() {
            var now = new Date();
            vm.clock = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
        }

        // ── a code ──
        function requestNewCode() {
            if (requesting) { return; }
            requesting = true;
            stopPolling(); stopCountdown(); stopRetry();
            ScheduleDisplayService.RequestPairingCode().then(function (data) {
                requesting = false;
                if (!data || !data.success || !data.code) { failed(); return; }
                vm.code = String(data.code);
                vm.digits = vm.code.split('');
                vm.code_spaced = vm.code.length === 6 ? vm.code.substr(0, 3) + ' ' + vm.code.substr(3) : vm.code;
                sessionUuid = data.session_uuid;
                // the server's expiry is in its own time zone; trust it only when it says something sensible
                var left = Math.floor((new Date(String(data.expires_at || '').replace(' ', 'T')).getTime() - new Date().getTime()) / 1000);
                secondsLeft = left > 0 && left <= CODE_S ? left : CODE_S;
                updateCountdown();
                vm.qr = qrSvg($window.location.origin + SETTINGS_PATH + '?pair_tv=' + vm.code);
                vm.view = 'code';
                startPolling();
                startCountdown();
            });
        }
        function failed() {
            vm.view = 'error';
            vm.retry_in = RETRY_S;
            stopRetry();
            retryTimer = $interval(function () {
                vm.retry_in -= 1;
                if (vm.retry_in <= 0) { stopRetry(); requestNewCode(); }
            }, 1000);
        }

        // ── waiting for a manager to enter it ──
        function startPolling() {
            stopPolling();
            pollTimer = $interval(function () {
                if (!sessionUuid || vm.view !== 'code') { return; }
                ScheduleDisplayService.CheckPairingStatus(sessionUuid).then(function (data) {
                    if (vm.view !== 'code') { return; }
                    if (data && data.success && data.paired && data.token) { paired(data.token); return; }
                    if (data && !data.success && data.expired) { requestNewCode(); }   // a new code, by itself
                    // a network error: the next poll tries again
                });
            }, POLL_MS);
        }
        function paired(token) {
            stopPolling(); stopCountdown();
            vm.view = 'paired';
            ScheduleDisplayService.GetClubInfo(token).then(function (data) {
                if (data && data.success && data.club && data.club.title) { vm.club_name = data.club.title; }
            });
            // an in-app route, not a page load: a TV put in full screen while pairing stays in it
            openTimer = $timeout(function () { $location.url('/display/' + encodeURIComponent(token)); }, OPEN_MS);
        }

        // ── "A new code in 8:41" ──
        function startCountdown() {
            stopCountdown();
            countdownTimer = $interval(function () {
                secondsLeft -= 1;
                updateCountdown();
                if (secondsLeft <= 0) { requestNewCode(); }
            }, 1000);
        }
        function updateCountdown() {
            var s = Math.max(0, secondsLeft);
            vm.countdown = Math.floor(s / 60) + ':' + pad2(s % 60);
        }

        function stopPolling() { if (pollTimer) { $interval.cancel(pollTimer); pollTimer = null; } }
        function stopCountdown() { if (countdownTimer) { $interval.cancel(countdownTimer); countdownTimer = null; } }
        function stopRetry() { if (retryTimer) { $interval.cancel(retryTimer); retryTimer = null; } }

        // a QR code to pair from a phone: the settings page, with the code (libs/js/qrcode-generator.js)
        function qrSvg(text) {
            if (typeof $window.qrcode !== 'function') { return null; }
            try {
                var qr = $window.qrcode(0, 'M');
                qr.addData(text);
                qr.make();
                return $sce.trustAsHtml(qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }));
            } catch (e) { return null; }
        }
        function pad2(n) { return (n < 10 ? '0' : '') + n; }

        $scope.$on('$destroy', function () {
            stopPolling(); stopCountdown(); stopRetry();
            if (clockTimer) { $interval.cancel(clockTimer); }
            if (openTimer) { $timeout.cancel(openTimer); }
            html.classList.remove('sdv-html');
            body.classList.remove('sdv-body');
            body.classList.toggle('night-mode', hadNight);
        });
    }
