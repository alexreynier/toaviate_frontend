app.controller('ScheduleDisplayController', ScheduleDisplayController);

    // The clubhouse TV, /display/:token (public: the display token, no login). Rebuilt 11 Nov 2026 from the approved
    // mockup mockups/schedule-display/tv.html: the schedule is drawn by libs/js/toaviate-display.js (ToAviateDisplay)
    // from GET schedule_display/{token}/day; this controller does the reads, the clock, the states and the timers.
    // Contract: backend FRONTEND_SCHEDULE_DISPLAY_V2_GUIDE.md. A TV has no menu, so there is no v1 / v2 switch here.
    //
    //   · reads: /settings + /day at start, then /version every 30 s (a change → the day again; a save on the settings
    //     page bumps it) and the day every 10 minutes (weather, notices);
    //   · after the day's last booking (and before midnight) it shows tomorrow, labelled; at 00:00:05 club time it rolls
    //     over to the new day (the classic page's midnight rollover);
    //   · an invalid / revoked token → "Link turned off" with the pairing address; a failed request → "No connection":
    //     the last day stays up with its age, or (nothing loaded yet) a full screen that retries every 20 s;
    //   · no idle blur (app.js idleExemptStates).
    //
    // The settings page previews this page in an iframe (frontend-6f, views/manageclub/schedule_display.html):
    //   ?set=<URL-encoded JSON partial settings>  overrides the fetched settings; every value may be a string
    //                                             (ToAviateDisplay.settings coerces: pageturn parsed and clamped 5–60,
    //                                             on / off keys take true / 1, theme takes "night");
    //   ?date=YYYY-MM-DD                          shows that day (no switch to tomorrow, no rollover);
    //   ?preview=1                                renders as normal, without the version poll.
    // A parent page on the same origin may also post {type: 'schedule-display-preview', set: {...}} to redraw with new
    // options without reloading the iframe.
    ScheduleDisplayController.$inject = ['ScheduleDisplayService', 'TvFullscreen', '$scope', '$stateParams', '$location', '$interval', '$window', '$document'];
    function ScheduleDisplayController(ScheduleDisplayService, TvFullscreen, $scope, $stateParams, $location, $interval, $window, $document) {
        var vm = this;
        var POLL_MS = 30000;           // the version poll
        var REFRESH_MS = 10 * 60000;   // the day again regardless (weather is cached 10 min on the server; notices expire)
        var RETRY_S = 20;              // "Can't reach ToAviate · Trying again in 20 s"
        var ROLLOVER_S = 5;            // seconds after midnight
        var THEME_KEY = 'toaviate_tv_theme';   // the TV's last theme: it starts (and shows "Link turned off") in it

        vm.token = $stateParams.token;
        vm.view = 'loading';           // loading | schedule | revoked | error
        vm.clock = '';
        vm.club_name = '';
        vm.retry_in = RETRY_S;
        vm.dark = false;
        vm.pair_address = ($window.location.host || 'toaviate.com') + '/display/tv';

        var search = $location.search();
        var preview = isOn(last(search.preview));
        var pinnedDate = validDate(last(search.date)) ? last(search.date) : null;
        var overrides = parseSet(last(search.set));

        var doc = $document[0], html = doc.documentElement, body = doc.body;
        var hadNight = body.classList.contains('night-mode');
        var tv = null;
        var day = null, dayMode = 'today', dayToday = null, switchAt = null;
        var baseSettings = rememberedTheme() ? { theme: rememberedTheme() } : null;
        var settings = ToAviateDisplay.settings(overrides || {}, baseSettings);
        // lastRead: 'HH:MM:SS' of the last successful contact with the server — a day read, or a version poll whatever it
        // answered (owner, 11 Nov: "Updated" should tick while the TV is online). The footer shows it; offline, the header's
        // "Offline · updated HH:MM" uses the same stamp, so the two always agree. A failed request never moves it.
        var version = null, lastOk = null, offlineSince = null, lastRead = null;
        var skewMs = 0, loadSeq = 0, loading = false, lastAttempt = 0, lastFailed = false, lastMinute = '';
        var tickTimer = null, pollTimer = null, refreshTimer = null, retryTimer = null;

        html.classList.add('sdv-html');
        body.classList.add('sdv-body');
        applyTheme();
        // full screen (not in the settings preview's bezel): the 1rem = 100vh / 54 canvas follows by itself; redraw to refit
        vm.fs = preview ? { enabled: false } : TvFullscreen.attach($scope, function () { $window.setTimeout(draw, 250); });
        init();

        function init() {
            if (!vm.token) { linkOff(); return; }
            tick();
            tickTimer = $interval(tick, 1000, 0, false);
            ScheduleDisplayService.GetSettings(vm.token).then(function (r) {
                if (r && r.success && r.settings && !day) {
                    baseSettings = r.settings;
                    settings = ToAviateDisplay.settings(overrides || {}, baseSettings);
                    applyTheme();
                }
            });
            loadDay();
            if (!preview) { pollTimer = $interval(poll, POLL_MS); }
            refreshTimer = $interval(function () { if (day && !offlineSince && vm.view === 'schedule') { loadDay(); } }, REFRESH_MS);
            $window.addEventListener('message', onMessage);
        }

        // ── club time: the device clock, corrected when it disagrees with the server's "now" (a TV set to UTC in summer) ──
        function clubNow() { return new Date(new Date().getTime() + skewMs); }
        function noteServerNow(s) {
            var p = parseDateTime(s);
            if (!p) { return; }
            var dev = new Date(); dev.setSeconds(0, 0);
            var diff = p.getTime() - dev.getTime();
            skewMs = Math.abs(diff) <= 90000 ? 0 : diff;   // the server's minute is truncated: a minute either way is the same clock
        }

        // ── the day ──
        function loadDay() {
            var seq = ++loadSeq;
            loading = true;
            lastAttempt = new Date().getTime();
            var extra = preview && overrides ? { set: JSON.stringify(overrides) } : null;
            return ScheduleDisplayService.GetDay(vm.token, pinnedDate, extra).then(function (r) {
                if (seq !== loadSeq) { return; }
                if (!usable(r)) { loading = false; return; }
                noteServerNow(r.now);
                // a manager's day on demand (settings.show_date): the day read with no ?date= answers it as source
                // 'override'. Show it as given, labelled by its date, with no tomorrow switch while it is set.
                if (!pinnedDate && r.source === 'override') {
                    loading = false;
                    show(r, r.date === r.today ? 'today' : (r.date === addDays(r.today, 1) ? 'tomorrow' : 'day'), r.today, null);
                    return;
                }
                var at = pinnedDate ? null : switchAtFor(r);
                if (at && stamp(clubNow()) >= at) {
                    // flying has finished for today: show tomorrow, labelled
                    return ScheduleDisplayService.GetDay(vm.token, addDays(r.today, 1), extra).then(function (r2) {
                        if (seq !== loadSeq) { return; }
                        loading = false;
                        if (!usable(r2)) { return; }
                        show(r2, 'tomorrow', r.today, null);
                    });
                }
                loading = false;
                show(r, !pinnedDate || pinnedDate === r.today ? 'today' : 'day', r.today, at);
            });
        }
        function usable(r) {
            if (!r || r.network) { lastFailed = true; goOffline(); return false; }
            if (!r.success) { linkOff(); return false; }
            lastFailed = false;
            return true;
        }
        function show(d, mode, today, at) {
            day = d; dayMode = mode; dayToday = today; switchAt = at;
            version = d.version;
            baseSettings = d.settings || baseSettings;
            settings = ToAviateDisplay.settings(overrides || {}, baseSettings || {});
            lastOk = hm(clubNow());
            lastRead = hms(clubNow());
            offlineSince = null;
            stopRetry();
            vm.club_name = d.club && d.club.name ? d.club.name : '';
            vm.view = 'schedule';
            applyTheme();
            if (!preview) { try { $window.localStorage.setItem(THEME_KEY, settings.theme); } catch (e) { /* private mode */ } }
            draw();
        }
        /* When the TV moves on to tomorrow ('Y-m-d H:i', or null = stay on today until midnight), by settings.day_switch
           (owner, 11 Nov): 'close' (default) at the club's closing time; 'last_booking' after the last booking ends;
           'midnight' never before the midnight rollover. */
        function switchAtFor(d) {
            var rule = ToAviateDisplay.settings(overrides || {}, d.settings || baseSettings || {}).day_switch || 'close';
            if (rule === 'midnight') { return null; }
            if (rule === 'last_booking') { return lastFlyingAt(d); }
            var close = (d.club && d.club.close) || '20:00';
            return close >= '24:00' ? null : d.date + ' ' + close;
        }
        /* The 'last_booking' rule: the end of the day's last booking that ends today ('Y-m-d H:i'). A booking that
           runs past midnight keeps today up; a day with nothing ending after opening waits for closing time. */
        function lastFlyingAt(d) {
            var lastEnd = null, overnight = false, open = (d.club && d.club.open) || '08:00', close = (d.club && d.club.close) || '20:00';
            (d.bookings || []).forEach(function (b) {
                var end = String(b.end || '');
                if (end.substr(0, 10) > d.date) { overnight = true; }
                else if (lastEnd === null || end > lastEnd) { lastEnd = end; }
            });
            if (overnight) { return null; }
            if (lastEnd === null || lastEnd.substr(11, 5) <= open) { return close >= '24:00' ? null : d.date + ' ' + close; }
            return lastEnd;
        }
        function draw() {
            if (!day) { return; }
            if (!tv) {
                var el = doc.getElementById('sdv-host');
                if (!el) { return; }
                tv = ToAviateDisplay.create(el);
            }
            var n = clubNow();
            tv.render(day, settings, {
                mode: dayMode,
                now: dayMode === 'today' ? ToAviateDisplay.utils.minutesOn(stamp(n), day.date) : null,
                clock: hm(n),
                offline: offlineSince,
                updated: lastRead       // "Powered by ToAviate · Updated 15:35:02", bottom right
            });
        }

        // ── every second (no digest): the clock, the minute redraw, tomorrow after the last booking, midnight ──
        function tick() {
            var n = clubNow(), key = stamp(n);
            // a load at most every 5 s (every 20 s after a failure): a server whose date flips a few seconds after the
            // TV's is asked again, not hammered
            var retryOk = !loading && new Date().getTime() - lastAttempt > (lastFailed ? RETRY_S * 1000 : 5000);
            if (day && !pinnedDate && ymd(n) !== dayToday && n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds() >= ROLLOVER_S && retryOk) {
                loadDay();   // midnight rollover: the club's date moved on
                return;
            }
            if (key === lastMinute) { return; }
            lastMinute = key;
            vm.clock = hm(n);
            $scope.$applyAsync();
            if (day && dayMode === 'today' && switchAt && key >= switchAt && retryOk) { loadDay(); return; }
            if (vm.view === 'schedule') { draw(); }
        }

        // ── the 30-second version poll (not in the settings preview) ──
        function poll() {
            if (vm.view === 'revoked') { return; }
            ScheduleDisplayService.GetVersion(vm.token).then(function (r) {
                if (!r || r.network) { goOffline(); return; }
                if (!r.success) { linkOff(); return; }
                lastOk = hm(clubNow());
                if (!day || offlineSince) { if (!loading) { loadDay(); } return; }
                if (String(r.schedule_version) !== String(version)) { loadDay(); return; }
                lastRead = hms(clubNow());   // the same schedule, confirmed now: the footer's "Updated" moves on
                if (vm.view === 'schedule') { draw(); }
            });
        }

        // ── states ──
        function goOffline() {
            if (vm.view === 'revoked') { return; }
            if (day) {
                if (!offlineSince) { offlineSince = lastRead ? lastRead.substr(0, 5) : (lastOk || hm(clubNow())); }   // the same stamp as the credit line
                vm.view = 'schedule';
                draw();
                if (preview) { startRetry(); }   // no version poll to notice the connection coming back
            } else {
                vm.view = 'error';
                startRetry();
            }
            $scope.$applyAsync();
        }
        function startRetry() {
            if (retryTimer) { return; }
            vm.retry_in = RETRY_S;
            retryTimer = $interval(function () {
                vm.retry_in -= 1;
                if (vm.retry_in <= 0) { vm.retry_in = RETRY_S; if (!loading) { loadDay(); } }
            }, 1000);
        }
        function stopRetry() { if (retryTimer) { $interval.cancel(retryTimer); retryTimer = null; } }
        function linkOff() {
            vm.view = 'revoked';
            day = null;
            stopRetry();
            if (pollTimer) { $interval.cancel(pollTimer); pollTimer = null; }
            if (refreshTimer) { $interval.cancel(refreshTimer); refreshTimer = null; }
            if (tv) { tv.destroy(); tv = null; }
            $scope.$applyAsync();
        }
        // the TV's theme comes from its settings (a TV has no user switch): dark = the ta-night.css tokens
        function applyTheme() {
            vm.dark = settings.theme === 'dark';
            body.classList.toggle('night-mode', vm.dark);
        }

        // a settings page on the same origin can redraw the preview with new options without reloading the iframe
        function onMessage(ev) {
            if (!ev || ev.origin !== $window.location.origin || !ev.data || ev.data.type !== 'schedule-display-preview') { return; }
            overrides = ev.data.set && typeof ev.data.set === 'object' ? ev.data.set : null;
            settings = ToAviateDisplay.settings(overrides || {}, baseSettings || {});
            applyTheme();
            draw();
            $scope.$applyAsync();
            // names, notices and weather are applied by the server from the draft (the day read honours `set` for a manager's
            // session), so fetch the day again too, debounced while the manager clicks through the options
            if (preview) {
                if (refetchTimer) { $window.clearTimeout(refetchTimer); }
                refetchTimer = $window.setTimeout(function () { refetchTimer = null; loadDay(); }, 300);
            }
        }
        var refetchTimer = null;

        $scope.$on('$destroy', function () {
            [tickTimer, pollTimer, refreshTimer, retryTimer].forEach(function (t) { if (t) { $interval.cancel(t); } });
            $window.removeEventListener('message', onMessage);
            if (refetchTimer) { $window.clearTimeout(refetchTimer); refetchTimer = null; }
            if (tv) { tv.destroy(); tv = null; }
            html.classList.remove('sdv-html');
            body.classList.remove('sdv-body');
            body.classList.toggle('night-mode', hadNight);
        });

        // ── helpers ──
        function rememberedTheme() {
            var t = null;
            try { t = $window.localStorage.getItem(THEME_KEY); } catch (e) { t = null; }
            return t === 'dark' || t === 'light' ? t : null;
        }
        function last(v) { return Array.isArray(v) ? v[v.length - 1] : v; }
        function isOn(v) { return v === true || v === 1 || v === '1' || v === 'true'; }
        function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00').getTime()); }
        function parseSet(raw) {
            if (raw === null || raw === undefined || raw === '' || raw === true) { return null; }
            var o = raw;
            if (typeof raw === 'string') {
                try { o = JSON.parse(raw); } catch (e) {
                    try { o = JSON.parse(decodeURIComponent(raw)); } catch (e2) { o = null; }   // encoded twice
                }
            }
            return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
        }
        function pad2(n) { return (n < 10 ? '0' : '') + n; }
        function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
        function hm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
        function hms(d) { return hm(d) + ':' + pad2(d.getSeconds()); }
        function stamp(d) { return ymd(d) + ' ' + hm(d); }
        function parseDateTime(s) {
            var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
            return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0) : null;
        }
        function addDays(s, n) {
            var p = String(s).split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n, 12, 0, 0);
            return ymd(d);
        }
    }
