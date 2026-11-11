/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · Availability & time off (S10). Design: mockups/instructor-dashboard/availability.html
   (approved 9 Nov 2026): pages "When you teach", "Time off" and "Add time off". Built 9 Nov 2026 beside v1
   (InstructorScheduleController + views/manageuser/instructor_schedule.html), switched by the global v2 switch.
   Tracker: mockups/v2-build/fe-instructor-availability.md.

   States (v1 has no params; the form adds an optional ?change=<time off id> for "Change"):
     dashboard.v2.instructor_availability   /manage_user/instructor/availability        ← dashboard.manage_user.instructor_availability
     dashboard.v2.instructor_holidays       /manage_user/instructor/holidays            ← dashboard.manage_user.instructor_holidays
     dashboard.v2.instructor_holidays_form  /manage_user/instructor/holidays/add?change ← dashboard.manage_user.instructor_holidays_form

   Reads (contract C42, mockups/v2-build/be-alex-3e.md), always the signed-in caller:
     GET instructor_availability/v2/mine                       clubs (hours, mode, set_up, extra dates) + time off with clashes
     GET instructor_availability/v2/preview?club_id&from&days  "What students see": the server's own rule, never computed here
     GET instructor_availability/v2/clashes?from&to[&all_day]  the lessons a time off would clash with, before saving
                                                               (also the calendar's dots: your lessons in the months on show)
   Writes (the shared routes, as v1):
     PUT    instructor_availability/{uid}/{club}   any subset: the mode alone, or the week (*_from_time, *_to_time, *_disabled)
     POST   instructor_adhoc_availability          {club_id, dates[], from_time, to_time, notes} → {added[], skipped[]}
     PUT / DELETE instructor_adhoc_availability/{id}  (an overlap → OVERLAP)
     POST   instructor_holiday {title, from_date, to_date, allDay}; PUT / DELETE instructor_holiday/{id}
            whole days: plain YYYY-MM-DD for the first and the LAST day (D20); timed: "YYYY-MM-DD HH:MM" UK wall-clock.
   Refusals are HTTP 403 FORBIDDEN; VALIDATION_ERROR is a 200 with success:false (and fields[] on the v2 reads).

   Here:
     InsAvailabilityV2Data        the reads (cached, so a tab switch draws at once), the writes and the words
     iav-cal                      attribute on a wrapper of <ta-date-picker inline="true">: range / multi-day picking drawn as
                                  the approved month calendar (classes iav-d--*; the picker itself stays a single-date picker)
     iav-to-body                  moves a dialog scrim to <body> (no transformed ancestor can trap it)
     InsAvailabilityV2Controller  the three pages (vm.page), the dates dialog and the time-off form
   Page CSS: css/v2/instructor-availability.css (.iav-*).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.instructor_availability', {
            url: '/manage_user/instructor/availability',
            templateUrl: 'views/v2/instructor_availability/weekly.html',
            controller: 'InsAvailabilityV2Controller', controllerAs: 'vm',
            data: { action: 'list', iavPage: 'weekly' }
        })
        .state('dashboard.v2.instructor_holidays', {
            url: '/manage_user/instructor/holidays',
            templateUrl: 'views/v2/instructor_availability/holidays.html',
            controller: 'InsAvailabilityV2Controller', controllerAs: 'vm',
            data: { action: 'list', iavPage: 'holidays' }
        })
        .state('dashboard.v2.instructor_holidays_form', {
            url: '/manage_user/instructor/holidays/add?change',
            templateUrl: 'views/v2/instructor_availability/form.html',
            controller: 'InsAvailabilityV2Controller', controllerAs: 'vm',
            data: { action: 'add', iavPage: 'add' }
        });
    DesignRoutesProvider
        .map('dashboard.manage_user.instructor_availability', 'dashboard.v2.instructor_availability')
        .map('dashboard.manage_user.instructor_holidays', 'dashboard.v2.instructor_holidays')
        .map('dashboard.manage_user.instructor_holidays_form', 'dashboard.v2.instructor_holidays_form');
}]);


// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// InsAvailabilityV2Data: the C42 reads, the shared writes, and ONE set of words for this domain (guidelines §7)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
app.factory('InsAvailabilityV2Data', InsAvailabilityV2Data);
InsAvailabilityV2Data.$inject = ['InsCore'];
function InsAvailabilityV2Data(InsCore) {
    var C = InsCore;
    var DAYS = [
        { k: 'monday', name: 'Monday', short: 'Mon' }, { k: 'tuesday', name: 'Tuesday', short: 'Tue' },
        { k: 'wednesday', name: 'Wednesday', short: 'Wed' }, { k: 'thursday', name: 'Thursday', short: 'Thu' },
        { k: 'friday', name: 'Friday', short: 'Fri' }, { k: 'saturday', name: 'Saturday', short: 'Sat' },
        { k: 'sunday', name: 'Sunday', short: 'Sun' }
    ];
    var TIMES = [];
    for (var m = 300; m <= 1380; m += 15) { TIMES.push(m2t(m)); }   // 05:00–23:00 in 15-minute steps (the mockup's selects)
    var extraTimes = {};
    var cache = { mine: null, previews: {} };

    var s = {
        DAYS: DAYS, TITLES: ['Holiday', 'Training', 'Appointment', 'Personal'],
        // reads
        mine: mine, preview: preview, clashes: clashes, cached: function () { return cache.mine; },
        cachedPreview: function (clubId) { return cache.previews[clubId] || null; },
        forget: function () { cache.mine = null; cache.previews = {}; },
        forgetPreview: function (clubId) { if (clubId) { delete cache.previews[clubId]; } else { cache.previews = {}; } },
        // writes
        saveWeek: saveWeek, addDates: addDates, changeDate: changeDate, removeDate: removeDate,
        addTimeOff: addTimeOff, changeTimeOff: changeTimeOff, removeTimeOff: removeTimeOff,
        // what the pages hand each other (kept here, so a state change keeps them)
        drafts: {},        // club_id → the unsaved week { monday: {on, from, to}, … }
        club: null,        // the club last shown on "When you teach"
        flash: null,       // { id, open }: the time off to highlight on "Time off" after a save
        // words
        t2m: t2m, m2t: m2t, times: times, day: day, dayWord: dayWord, fDayY: fDayY, holLast: holLast, holDays: holDays,
        holWhen: holWhen, holLen: holLen, clashWho: clashWho, clashWhen: clashWhen, pvRow: pvRow, failText: failText,
        joinAnd: joinAnd
    };
    return s;

    // ── reads ──
    function mine() {
        return C.get('instructor_availability/v2/mine').then(function (r) {
            if (r && r.success) { cache.mine = r; }
            return r;
        });
    }
    function preview(clubId, from) {
        return C.get('instructor_availability/v2/preview', { club_id: clubId, from: from, days: 14 }).then(function (r) {
            if (r && r.success) { cache.previews[clubId] = r; }
            return r;
        });
    }
    /* whole days: the first and the LAST day (YYYY-MM-DD); otherwise UK "YYYY-MM-DD HH:MM" */
    function clashes(from, to, allDay) {
        return C.get('instructor_availability/v2/clashes', allDay ? { from: from, to: to, all_day: 1 } : { from: from, to: to });
    }

    // ── writes (the shared routes) ──
    function saveWeek(clubId, body) { return C.put('instructor_availability/' + C.myId() + '/' + clubId, body); }
    function addDates(body) { return C.post('instructor_adhoc_availability', body); }
    function changeDate(id, body) { return C.put('instructor_adhoc_availability/' + id, body); }
    function removeDate(id) { return C.del('instructor_adhoc_availability/' + id); }
    function addTimeOff(body) { return C.post('instructor_holiday', body); }
    function changeTimeOff(id, body) { return C.put('instructor_holiday/' + id, body); }
    function removeTimeOff(id) { return C.del('instructor_holiday/' + id); }

    // ── words ──
    function t2m(t) { var p = String(t || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
    function m2t(x) { return C.p2(Math.floor(x / 60)) + ':' + C.p2(x % 60); }
    /* the select's options; a saved time off the 15-minute grid (v1 allowed any) is kept, in order */
    function times(v) {
        if (!v || TIMES.indexOf(v) > -1) { return TIMES; }
        if (!extraTimes[v]) { extraTimes[v] = TIMES.concat([v]).sort(); }
        return extraTimes[v];
    }
    function day(str) { return String(str || '').slice(0, 10); }
    /* 'Today' / 'Tomorrow' / '' against the server's today (UK) */
    function dayWord(d, today) { var n = C.daysBetween(today, d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : ''; }
    /* "Tue 10 Nov" this year, "Tue 10 Nov 2027" otherwise */
    function fDayY(d, year) { return day(d).slice(0, 4) === String(year) ? C.fDay(d) : C.fDayLong(d); }
    function holLast(h) { return h.last_day || (h.all_day ? C.addDays(day(h.to), -1) : day(h.to || h.from)); }
    function holDays(h) { return C.daysBetween(day(h.from), holLast(h)) + 1; }
    /* "Tue 10 Nov · 14:00–18:00" · "Fri 27 Nov · whole day" · "Mon 21 Dec – Wed 23 Dec · whole days" */
    function holWhen(h, withYear, year) {
        var f = day(h.from), l = holLast(h), fd = withYear ? C.fDayLong : function (x) { return fDayY(x, year); };
        if (!h.all_day) {
            var tf = C.fTime(h.from), tt = C.fTime(h.to), td = day(h.to);
            if (td && td !== f && !(tt === '00:00' && C.addDays(f, 1) === td)) { return fd(f) + ' ' + tf + ' – ' + fd(td) + ' ' + tt; }
            return fd(f) + ' · ' + tf + '–' + (td !== f && tt === '00:00' ? '24:00' : tt);
        }
        return f === l ? fd(f) + ' · whole day' : fd(f) + ' – ' + fd(l) + ' · whole days';
    }
    function holLen(h) { return h.all_day ? C.plural(holDays(h), 'day') : C.len(C.minutesBetween(h.from, h.to)); }
    function clashWho(b) {
        var who = (b.pilot && b.pilot.name) || 'No name';
        return who + (b.lesson && b.lesson.title ? ' · ' + b.lesson.title : '');
    }
    function clashWhen(b) { return C.fDay(b.start) + ' · ' + C.fTime(b.start) + '–' + C.fTime(b.end); }
    /* one preview day → { no, head, sub: [{ic, t}] } (the mockup's dayInfo, from the server's windows / off / reason) */
    function pvRow(r, clubName, mode) {
        var offs = r.off || [], wins = r.windows || [], sub = [];
        var whole = offs.filter(function (o) { return o.all_day || (o.from === '00:00' && o.to === '24:00'); })[0];
        var away = function (o) { return { ic: 'fa-umbrella-beach', t: 'Away ' + o.from + '–' + o.to }; };
        if (!r.bookable) {
            if (r.reason === 'time_off' && whole) { return { no: true, head: 'Time off', sub: [{ ic: 'fa-umbrella-beach', t: whole.title || 'Time off' }] }; }
            if (r.reason === 'time_off') { return { no: true, head: 'Not bookable', sub: offs.map(away) }; }
            if (r.reason === 'not_set_up') { return { no: true, head: 'Not bookable', sub: [{ ic: 'fa-exclamation-circle', t: 'No hours saved at ' + clubName + ' yet' }] }; }
            if (r.reason === 'no_date') { return { no: true, head: 'Not bookable', sub: [{ ic: 'fa-calendar-day', t: 'No date added' }] }; }
            return { no: true, head: 'Not bookable', sub: [{ ic: 'fa-moon', t: 'Day off' }] };
        }
        if (wins.some(function (w) { return w.source === 'weekly'; })) { sub.push({ ic: 'fa-calendar-week', t: 'Weekly hours' }); }
        if (wins.some(function (w) { return w.source === 'extra'; })) { sub.push({ ic: 'fa-calendar-plus', t: mode === 'adhoc' ? 'Your date' : 'Extra date' }); }
        offs.forEach(function (o) { sub.push(away(o)); });
        return { no: false, head: wins.map(function (w) { return w.from + '–' + w.to; }).join(' + '), sub: sub };
    }
    /* what to say when a write is refused (InsCore resolves { success:false, error, message, status }) */
    function failText(res, fallback, what) {
        if (!res) { return fallback; }
        if (res.error === 'OVERLAP') { return 'That overlaps a time you already have on that date. Change the times, or change the one that\'s there.'; }
        if (res.status === 403 || res.error === 'FORBIDDEN') {
            return what === 'time_off' ? 'Only you, a manager of a club where you teach, or ToAviate staff can change this time off.'
                : 'You aren\'t a current instructor at this club, so this can\'t be changed here. Ask a club manager.';
        }
        if (res.status === 404 || res.error === 'NOT_FOUND') { return 'It isn\'t there any more. The page has been refreshed.'; }
        if (typeof res.message === 'string' && res.message && res.error !== 'SERVER_ERROR' && res.error !== 'NETWORK_ERROR' && res.message.length < 200) { return res.message; }
        return fallback;
    }
    function joinAnd(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
}


// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// iav-cal="cfg": range / multi-day picking on the <ta-date-picker inline="true"> inside this element.
// The picker (libs/js/toaviate-datepicker.js) stays a single-date picker; its model only says which month to show. A tap on a
// day goes to cfg.tap(date) first (capture phase); after every render of the picker the days get
//   iav-d--sel / --start / --end / --in (cfg.cls(date) → { sel, start, end, inr }), iav-d--off (cfg.off: time off already),
//   iav-d--gone (trailing weeks of the next month, so a month has only the rows it needs, as the approved calendar)
// and an aria-label / aria-pressed that say the same. cfg.sig() changes whenever the picking changes (re-decorates).
// After each render the month on show goes to cfg.shown('YYYY-MM') (arrows, PageUp / PageDown, arrow keys across a month).
// The lesson dots are the picker's own (options.dots + get-busy; the host bumps options.busyVersion when they arrive).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
app.directive('iavCal', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var host = element[0];
            var LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            function cfg() { return scope.$eval(attrs.iavCal); }
            function long(ds) { var p = ds.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]); return LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
            function decorate() {
                var c = cfg();
                if (!c) { return; }
                var title = host.querySelector('.tadp__title');
                if (title && !title.disabled) { title.disabled = true; title.setAttribute('tabindex', '-1'); }   // no month / year zoom: the approved calendar's title is a heading
                var cells = host.querySelectorAll('.tadp__days > .tadp__d'), last = -1, i;
                for (i = 0; i < cells.length; i++) { if (!cells[i].classList.contains('tadp__d--other')) { last = i; } }
                var rowEnd = (Math.floor(last / 7) + 1) * 7, shown = last > -1 ? String(cells[last].getAttribute('data-d')).slice(0, 7) : '';
                if (shown && shown !== host.getAttribute('data-ym')) {
                    host.setAttribute('data-ym', shown);
                    if (c.shown) { scope.$evalAsync(function () { c.shown(shown); }); }
                }
                for (i = 0; i < cells.length; i++) {
                    var b = cells[i], ds = b.getAttribute('data-d'), other = b.classList.contains('tadp__d--other');
                    var k = other ? {} : (c.cls(ds) || {}), off = !other && c.off(ds), dot = !other && c.dot(ds);
                    b.classList.toggle('iav-d--sel', !!k.sel);
                    b.classList.toggle('iav-d--start', !!k.start);
                    b.classList.toggle('iav-d--end', !!k.end);
                    b.classList.toggle('iav-d--in', !!k.inr);
                    b.classList.toggle('iav-d--off', !!off);
                    b.classList.toggle('iav-d--gone', other && i >= rowEnd);
                    if (other) { continue; }
                    b.removeAttribute('aria-selected');
                    b.removeAttribute('aria-current');
                    b.setAttribute('aria-pressed', k.sel || k.inr ? 'true' : 'false');
                    b.setAttribute('aria-label', long(ds) + (off ? ', ' + (c.offWord || 'time off') : '') + (dot ? ', ' + c.dotWord : ''));
                }
            }
            function onClick(e) {
                var b = e.target && e.target.closest ? e.target.closest('.tadp__d') : null;
                if (!b || !host.contains(b) || b.disabled || b.classList.contains('tadp__d--other')) { return; }
                var ds = b.getAttribute('data-d'), c = cfg();
                if (c && ds) { scope.$apply(function () { c.tap(ds); }); }
            }
            host.addEventListener('click', onClick, true);
            var mo = window.MutationObserver ? new MutationObserver(decorate) : null;
            if (mo) { mo.observe(host, { childList: true, subtree: true }); }
            scope.$watch(function () { var c = cfg(); return c && c.sig ? c.sig() : ''; }, decorate);
            scope.$on('$destroy', function () { host.removeEventListener('click', onClick, true); if (mo) { mo.disconnect(); } });
        }
    };
});

// iav-to-body: this (always present, unstyled) host of the dialogs moves to <body> while the page exists, so no transformed
// ancestor can trap the fixed scrim. The ng-if's stay INSIDE the host: an ng-if block that is moved itself loses its end
// marker, and its removal would then take every later <body> child with it (the toasts). ngAnimate is off inside it, as
// ins-plain does for the page: a closing dialog goes at once instead of waiting out its pop-in animation.
app.directive('iavToBody', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, element) {
            $animate.enabled(element, false);
            document.body.appendChild(element[0]);
            scope.$on('$destroy', function () { if (element[0].parentNode) { element[0].parentNode.removeChild(element[0]); } });
        }
    };
}]);


// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// The three pages: weekly ("When you teach"), holidays ("Time off"), add ("Add / Change time off")
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
app.controller('InsAvailabilityV2Controller', InsAvailabilityV2Controller);
InsAvailabilityV2Controller.$inject = ['$scope', '$state', '$stateParams', '$timeout', '$document', 'InsCore', 'InsAvailabilityV2Data', 'ToastService'];
function InsAvailabilityV2Controller($scope, $state, $stateParams, $timeout, $document, InsCore, InsAvailabilityV2Data, ToastService) {
    var vm = this, C = InsCore, D = InsAvailabilityV2Data;
    var QUIET = { confetti: false };
    var CLUB_KEY = 'toaviate_iav_club';
    var pvSeq = 0, fcSeq = 0, monSeq = 0, fcTimer = null, dead = false, opener = null;

    vm.C = C;
    vm.D = D;
    vm.DAYS = D.DAYS;
    vm.page = ($state.current.data && $state.current.data.iavPage) || 'weekly';
    vm.load = 'loading';            // loading | ready | error
    vm.today = C.today();           // replaced by the server's (UK) today
    vm.year = vm.today.slice(0, 4);
    vm.clubs = [];
    vm.club = null;
    vm.up = [];
    vm.past = [];

    // weekly page
    vm.dr = null;                   // the draft week of vm.club
    vm.tried = false;
    vm.saving = false;
    vm.modeAsk = null;
    vm.modeBusy = false;
    vm.delAsk = null;
    vm.delBusy = false;
    vm.hiSlot = null;
    vm.pv = null;                   // the preview rows of vm.club
    vm.pvBusy = false;
    vm.pvErr = false;
    vm.dlg = null;                  // the Add dates / Change a date dialog

    // holidays page
    vm.holOpen = null;
    vm.holAsk = null;
    vm.holBusy = false;
    vm.hiHol = null;
    vm.showPast = false;

    // add page
    vm.f = emptyForm();
    vm.fErr = {};
    vm.fBusy = false;
    vm.fClash = [];
    vm.fClashBusy = false;
    vm.lessonDays = {};             // 'YYYY-MM-DD' → true: lessons booked with you (the calendar's dots)

    start();

    // ═══ loading: the cached read draws at once (a tab switch), the fresh one follows ═══
    function start() {
        var cached = D.cached();
        if (cached && cached.today) { vm.today = cached.today; vm.year = vm.today.slice(0, 4); }
        if (vm.page === 'add') { initForm(); }
        if (cached) { apply(cached); }
        refresh();
    }
    function refresh() {
        return D.mine().then(function (r) {
            if (dead) { return; }
            if (r && r.success) { apply(r); return; }
            if (!vm.M) { vm.load = 'error'; vm.loadMsg = D.failText(r, 'Your availability couldn\'t be loaded. Check your connection and try again.'); }
        });
    }
    vm.retry = function () { vm.load = 'loading'; refresh(); };

    function apply(r) {
        var first = !vm.M;
        vm.M = r;
        vm.today = r.today || vm.today;
        vm.year = vm.today.slice(0, 4);
        vm.clubs = r.clubs || [];
        vm.up = (r.time_off && r.time_off.upcoming) || [];
        vm.past = (r.time_off && r.time_off.past) || [];
        vm.load = 'ready';
        pickClub();
        if (vm.page === 'holidays') { holidaysReady(); }
        if (vm.page === 'add') { formReady(first); }
    }

    // ═══ the club (weekly page): remembered per browser; else the first club not set up; else the first ═══
    function pickClub() {
        if (!vm.clubs.length) { vm.club = null; vm.dr = null; return; }
        var want = vm.club ? vm.club.club_id : (D.club || readClub());
        var c = vm.clubs.filter(function (x) { return x.club_id === want; })[0];
        if (!c) { c = vm.clubs.filter(function (x) { return !x.set_up; })[0] || vm.clubs[0]; }
        var changed = !vm.club || vm.club.club_id !== c.club_id;
        vm.club = c;
        D.club = c.club_id;
        vm.dr = draftFor(c);
        if (vm.page === 'weekly' && (changed || !vm.pv)) { loadPreview(); }
    }
    function readClub() { try { return +window.localStorage.getItem(CLUB_KEY) || null; } catch (e) { return null; } }
    function saveClub(id) { try { window.localStorage.setItem(CLUB_KEY, String(id)); } catch (e) { /* private mode */ } }
    vm.setClub = function (c) {
        if (!c || (vm.club && c.club_id === vm.club.club_id)) { return; }
        vm.club = c; D.club = c.club_id; saveClub(c.club_id);
        vm.dr = draftFor(c);
        vm.modeAsk = null; vm.delAsk = null; vm.tried = false; vm.hiSlot = null;
        loadPreview();
    };
    vm.clubLabel = function () { return vm.club ? vm.club.name || 'this club' : ''; };

    // ═══ the week: a draft per club (kept in the data service, so a tab switch keeps unsaved edits) ═══
    function draftFor(c) {
        if (!D.drafts[c.club_id]) { D.drafts[c.club_id] = suggest(c); }
        return D.drafts[c.club_id];
    }
    /* never saved → weekdays 09:00–18:00 as a prefilled suggestion (decided: say "Not set up"; Save opens bookings) */
    function suggest(c) {
        var w = {};
        D.DAYS.forEach(function (x, i) {
            if (!c.set_up) { w[x.k] = { on: i < 5, from: '09:00', to: '18:00' }; return; }
            var v = (c.days && c.days[x.k]) || {}, ok = v.from && v.to && D.t2m(v.from) < D.t2m(v.to);
            w[x.k] = { on: !!v.on, from: ok ? v.from : '09:00', to: ok ? v.to : '18:00' };
        });
        return w;
    }
    function changedDays() {
        var c = vm.club, d = vm.dr;
        if (!c || !d) { return []; }
        if (!c.set_up) { return D.DAYS.map(function (x) { return x.k; }); }
        return D.DAYS.map(function (x) { return x.k; }).filter(function (k) {
            var a = d[k], b = (c.days && c.days[k]) || {};
            return !!a.on !== !!b.on || (a.on && (a.from !== b.from || a.to !== b.to));
        });
    }
    function weekBody(d) {
        var body = {};
        D.DAYS.forEach(function (x) { body[x.k + '_from_time'] = d[x.k].from; body[x.k + '_to_time'] = d[x.k].to; body[x.k + '_disabled'] = d[x.k].on ? 0 : 1; });
        return body;
    }
    function keepWeek(c, d) {
        c.days = {};
        D.DAYS.forEach(function (x) { var v = d[x.k]; c.days[x.k] = { on: v.on, from: v.from, to: v.to }; });
        c.set_up = true;
        delete D.drafts[c.club_id];
        if (vm.club === c) { vm.dr = draftFor(c); }
    }
    vm.changedCount = function () { return changedDays().length; };
    vm.isChanged = function (k) { return !!(vm.club && vm.club.set_up && changedDays().indexOf(k) > -1); };
    vm.badDays = function () { var d = vm.dr; return d ? D.DAYS.filter(function (x) { var v = d[x.k]; return v.on && D.t2m(v.from) >= D.t2m(v.to); }) : []; };
    vm.dayErr = function (k) { var v = vm.dr && vm.dr[k]; return !!(vm.tried && v && v.on && D.t2m(v.from) >= D.t2m(v.to)); };
    vm.dayLen = function (v) { var a = D.t2m(v.from), b = D.t2m(v.to); return b > a ? C.len(b - a) : '—'; };
    /* the day drawn on the 06:00–22:00 track */
    vm.track = function (v) {
        var a = Math.max(0, (D.t2m(v.from) - 360) / 960 * 100), w = Math.max(0, Math.min(100 - a, (D.t2m(v.to) - D.t2m(v.from)) / 960 * 100));
        return '--a:' + a.toFixed(2) + '%;--w:' + w.toFixed(2) + '%';
    };
    vm.weekLen = function () {
        var d = vm.dr;
        return C.len(d ? D.DAYS.reduce(function (s, x) { var v = d[x.k], a = D.t2m(v.from), b = D.t2m(v.to); return s + (v.on && b > a ? b - a : 0); }, 0) : 0);
    };
    vm.weekHint = function () {
        var bad = vm.badDays();
        if (vm.tried && bad.length) { return { ic: 'fa-exclamation-circle', t: 'Fix ' + bad.map(function (x) { return x.name; }).join(' and ') + ' first' }; }
        if (!vm.club.set_up) { return { t: 'Not saved — students can\'t book you at ' + vm.clubLabel() + ' yet' }; }
        var n = changedDays().length;
        if (n) { return { t: C.plural(n, 'day') + ' changed · not saved yet' }; }
        return { ic: 'fa-check', t: 'Saved · ' + vm.weekLen() + ' a week' };
    };
    vm.pausedLine = function () {
        var c = vm.club, on = D.DAYS.filter(function (x) { return c.days && c.days[x.k] && c.days[x.k].on; });
        return on.length ? on.map(function (x) { return x.short + ' ' + c.days[x.k].from + '–' + c.days[x.k].to; }).join(' · ') : 'No weekly hours saved';
    };
    vm.copyMonday = function () {
        var d = vm.dr, m = d.monday;
        ['tuesday', 'wednesday', 'thursday', 'friday'].forEach(function (k) { d[k] = { on: m.on, from: m.from, to: m.to }; });
        ToastService.success('Monday copied', 'Monday\'s hours copied to Tuesday–Friday. Save to keep them.', QUIET);
    };
    vm.undo = function () {
        D.drafts[vm.club.club_id] = suggest(vm.club);
        vm.dr = D.drafts[vm.club.club_id];
        vm.tried = false;
    };
    vm.saveWeek = function () {
        var c = vm.club;
        if (vm.saving || !c) { return; }
        vm.tried = true;
        if (vm.badDays().length) {
            $timeout(function () { var el = document.querySelector('.iav-day--err select'); if (el) { el.focus(); } });
            return;
        }
        var d = vm.dr, wasNew = !c.set_up;
        vm.saving = true;
        D.saveWeek(c.club_id, weekBody(d)).then(function (r) {
            vm.saving = false;
            if (!r || r.success === false) {
                ToastService.error('Hours not saved', D.failText(r, 'Your weekly hours couldn\'t be saved. Nothing has changed.'));
                return;
            }
            keepWeek(c, d);
            vm.tried = false;
            if (wasNew) { ToastService.success('Saved', 'Students can now book you at ' + (c.name || 'this club') + ' in these hours.', QUIET); }
            else { ToastService.success('Weekly hours saved', 'For ' + (c.name || 'this club') + '.', QUIET); }
            afterWeeklyWrite(c);
        });
    };

    // ═══ the mode: asks in place, then saves only the mode (a club never saved also saves the suggested week) ═══
    vm.askMode = function (v) { if (!vm.modeBusy) { vm.modeAsk = vm.club.mode === v ? null : v; } };
    vm.keepMode = function () { if (!vm.modeBusy) { vm.modeAsk = null; } };
    vm.slotCount = function () { return vm.club ? (vm.club.extra_dates || []).length : 0; };
    vm.switchMode = function () {
        var c = vm.club, v = vm.modeAsk;
        if (!c || !v || vm.modeBusy) { return; }
        var wasNew = !c.set_up, d = vm.dr, body = wasNew ? weekBody(d) : {};
        body.availability_mode = v;
        vm.modeBusy = true;
        D.saveWeek(c.club_id, body).then(function (r) {
            vm.modeBusy = false;
            if (!r || r.success === false) {
                ToastService.error('Not switched', D.failText(r, 'How students book you couldn\'t be changed. Nothing has changed.'));
                return;
            }
            c.mode = v;
            if (wasNew) { keepWeek(c, d); }
            vm.modeAsk = null;
            vm.tried = false;
            if (v === 'adhoc') { ToastService.success('Saved', 'At ' + (c.name || 'this club') + ' students can now book you only on the dates you add.', QUIET); }
            else { ToastService.success('Saved', 'Students can book you in your weekly hours at ' + (c.name || 'this club') + ' again.', QUIET); }
            afterWeeklyWrite(c);
        });
    };
    function afterWeeklyWrite(c) {
        D.forgetPreview(c.club_id);
        if (vm.club && vm.club.club_id === c.club_id) { loadPreview(); }
        D.mine().then(function (r) { if (!dead && r && r.success) { apply(r); } });
    }

    // ═══ what students see: the server's 14 days (never computed here) ═══
    function loadPreview() {
        var c = vm.club;
        if (!c) { vm.pv = null; return; }
        var seq = ++pvSeq, cached = D.cachedPreview(c.club_id);
        vm.pvErr = false;
        if (cached) { vm.pv = rowsOf(cached, c); } else if (vm.pvClub !== c.club_id) { vm.pv = null; }
        vm.pvClub = c.club_id;
        vm.pvBusy = true;
        D.preview(c.club_id, vm.today).then(function (r) {
            if (dead || seq !== pvSeq) { return; }
            vm.pvBusy = false;
            if (r && r.success) { vm.pv = rowsOf(r, c); return; }
            if (!vm.pv) { vm.pvErr = true; }
        });
    }
    vm.reloadPreview = loadPreview;
    function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function rowsOf(r, c) {
        return (r.days || []).map(function (x) {
            var info = D.pvRow(x, c.name || 'this club', r.mode), n = (x.lessons && x.lessons.count) || 0, d = C.pd(x.date);
            info.date = x.date;
            info.dw = D.dayWord(x.date, vm.today) || C.DOW[d.getDay()];
            info.dn = d.getDate() + ' ' + C.MON[d.getMonth()];
            info.n = n ? C.plural(n, 'lesson') : '';
            info.subHtml = info.sub.map(function (x) { return '<i class="fas ' + x.ic + '"></i>' + esc(x.t); }).join(' · ');   // ng-bind-html ($sanitize)
            info.key = x.date + '|' + info.head + '|' + info.sub.map(function (s) { return s.t; }).join('·') + '|' + info.n;
            return info;
        });
    }

    // ═══ extra dates (the weekly page's list) ═══
    var slotMemo = { src: null, sig: '', list: [] };
    vm.slots = function () {
        var src = (vm.club && vm.club.extra_dates) || [];
        var sig = src.map(function (s) { return s.id + s.date + s.from + s.to + (s.notes || '') + (s._leaving ? 'x' : ''); }).join(',');
        if (slotMemo.src === src && slotMemo.sig === sig) { return slotMemo.list; }
        var list = src.slice().sort(function (a, b) { return (a.date + a.from) < (b.date + b.from) ? -1 : 1; }), month = '';
        list.forEach(function (s) {
            var mk = C.fMonth(s.date);
            s._month = list.length > 6 && mk !== month ? mk : '';
            if (s._month) { month = mk; }
        });
        slotMemo = { src: src, sig: sig, list: list };
        return list;
    };
    vm.slotDow = function (s) { return C.DOW[C.pd(s.date).getDay()]; };
    vm.slotD = function (s) { return C.pd(s.date).getDate(); };
    vm.slotMon = function (s) { return C.MON[C.pd(s.date).getMonth()]; };
    vm.slotWhen = function (s) { var w = D.dayWord(s.date, vm.today); return (w ? w + ' · ' : '') + s.from + '–' + s.to; };
    vm.slotLen = function (s) { return C.len(D.t2m(s.to) - D.t2m(s.from)); };
    vm.askDel = function (s) { if (!vm.delBusy) { vm.delAsk = s.id; } };
    vm.keepDel = function () { if (!vm.delBusy) { vm.delAsk = null; } };
    vm.removeDate = function (s) {
        if (!s || vm.delBusy) { return; }
        vm.delBusy = true;
        if (vm.dlg) { vm.dlg.busy = 'remove'; }
        D.removeDate(s.id).then(function (r) {
            vm.delBusy = false;
            if (vm.dlg) { vm.dlg.busy = false; }
            var c = vm.club;
            if (!r || r.success === false) {
                ToastService.error('Not removed', D.failText(r, 'The date couldn\'t be removed. Nothing has changed.'));
                if (r && (r.status === 404 || r.error === 'NOT_FOUND')) { vm.dlg = null; vm.delAsk = null; afterWeeklyWrite(c); }
                return;
            }
            var words = C.fDay(s.date) + ', ' + s.from + '–' + s.to;
            vm.dlg = null;
            vm.delAsk = null;
            s._leaving = true;
            $timeout(function () {
                c.extra_dates = (c.extra_dates || []).filter(function (x) { return x.id !== s.id; });
                ToastService.success('Removed', words + '. Students can no longer book you then.', QUIET);
                afterWeeklyWrite(c);
            }, 230);
        });
    };

    // ── the dialog (a sheet on phones): Add dates, with a multi-day calendar / Change a date ──
    vm.openAdd = function () {
        opener = document.activeElement;
        vm.delAsk = null;
        vm.dlg = { type: 'add', dates: [], from: '09:00', to: '17:00', notes: '', err: {}, busy: false };
        vm.dlgCal = {
            anchor: vm.today.slice(0, 7) + '-01', dotWord: 'already has a date', offWord: 'time off',
            opts: calOpts(),
            cls: function (ds) { return vm.dlg && vm.dlg.dates.indexOf(ds) > -1 ? { sel: true, start: true, end: true } : null; },
            off: function (ds) { return !!offDays()[ds]; },
            dot: function (ds) { return slotDays()[ds] > 0; },
            busy: function (ds) { return slotDays()[ds] > 0 ? 1 : 0; },
            tap: function (ds) { vm.pick(ds); },
            sig: function () { return vm.dlg ? vm.dlg.dates.join(',') + '|' + offSig() : ''; }
        };
        focusDlg();
    };
    vm.openEdit = function (s) {
        opener = document.activeElement;
        vm.delAsk = null;
        vm.dlg = { type: 'edit', id: s.id, slot: s, from: s.from, to: s.to, notes: s.notes || '', err: {}, ask: false, busy: false };
        focusDlg();
    };
    function focusDlg() { $timeout(function () { var el = document.getElementById('iav-dlg'); if (el) { el.focus(); } }); }
    vm.closeDlg = function () {
        if (!vm.dlg || vm.dlg.busy) { return; }
        vm.dlg = null;
        if (opener && opener.focus && document.body.contains(opener)) { try { opener.focus(); } catch (e) { /* gone */ } }
        opener = null;
    };
    vm.scrim = function (e) { if (e && e.target === e.currentTarget) { vm.closeDlg(); } };
    vm.pick = function (ds) {
        var d = vm.dlg, i = d.dates.indexOf(ds);
        if (i > -1) { d.dates.splice(i, 1); } else { d.dates.push(ds); }
        d.err.dates = false;
    };
    vm.unpick = function (ds) { vm.dlg.dates = vm.dlg.dates.filter(function (x) { return x !== ds; }); };
    vm.picked = function () { return vm.dlg ? vm.dlg.dates.slice().sort() : []; };
    vm.dlgTimes = function () { vm.dlg.err.times = false; };
    vm.dlgMode = function () { return vm.club && vm.club.mode === 'adhoc' ? 'your date' : 'extra date'; };
    vm.dlgSave = function () {
        var d = vm.dlg, c = vm.club, err = {};
        if (!d || d.busy) { return; }
        if (d.type === 'add' && !d.dates.length) { err.dates = true; }
        if (D.t2m(d.from) >= D.t2m(d.to)) { err.times = 'Until has to be after From.'; }
        if (d.type === 'edit' && !err.times) {
            var hit = (c.extra_dates || []).filter(function (x) { return x.id !== d.id && x.date === d.slot.date && x.from < d.to && x.to > d.from; })[0];
            if (hit) { err.times = 'That overlaps your other time that day, ' + hit.from + '–' + hit.to + '.'; }
        }
        if (err.dates || err.times) { d.err = err; return; }
        d.busy = 'save';
        if (d.type === 'edit') {
            D.changeDate(d.id, { from_time: d.from, to_time: d.to, notes: d.notes || null }).then(function (r) {
                d.busy = false;
                if (!r || r.success === false) {
                    if (r && r.error === 'OVERLAP') { d.err = { times: 'That overlaps your other time that day.' }; return; }
                    if (r && r.error === 'VALIDATION_ERROR') { d.err = { times: r.message || 'Until has to be after From.' }; return; }
                    ToastService.error('Not saved', D.failText(r, 'The date couldn\'t be changed. Nothing has changed.'));
                    return;
                }
                var s = d.slot;
                s.from = d.from; s.to = d.to; s.notes = d.notes || null;
                vm.hiSlot = s.id;
                vm.dlg = null;
                ToastService.success('Saved', C.fDay(s.date) + ': ' + s.from + '–' + s.to + '.', QUIET);
                afterWeeklyWrite(c);
            });
            return;
        }
        D.addDates({ club_id: c.club_id, dates: d.dates.slice().sort(), from_time: d.from, to_time: d.to, notes: d.notes || null }).then(function (r) {
            d.busy = false;
            if (!r || r.success === false) {
                if (r && r.error === 'VALIDATION_ERROR') { d.err = { times: r.message || 'Until has to be after From.' }; return; }
                ToastService.error('Dates not added', D.failText(r, 'Your dates couldn\'t be added. Nothing has changed.'));
                return;
            }
            var added = r.added || [], skipped = (r.skipped || []).map(function (x) {
                var hit = (c.extra_dates || []).filter(function (y) { return y.date === x.date && y.from < d.to && y.to > d.from; })[0];
                return C.fDay(x.date) + (hit ? ' (already ' + hit.from + '–' + hit.to + ')' : '');
            });
            c.extra_dates = (c.extra_dates || []).concat(added.map(function (a) {
                return { id: +a.id, date: D.day(a.available_date), from: String(a.from_time).slice(0, 5), to: String(a.to_time).slice(0, 5), notes: a.notes || null, on_time_off: false };
            }));
            vm.hiSlot = added.length ? +added[0].id : null;
            vm.dlg = null;
            var t = C.plural(added.length, 'date') + ' added';
            if (skipped.length) { ToastService.warning(t, 'Skipped ' + skipped.join(', ') + ': they overlap a time you already have.'); }
            else { ToastService.success(t, 'Students can book you then.', QUIET); }
            afterWeeklyWrite(c);
        });
    };
    vm.askRemoveInDlg = function () { if (!vm.dlg.busy) { vm.dlg.ask = true; } };
    vm.keepInDlg = function () { if (!vm.dlg.busy) { vm.dlg.ask = false; } };
    function slotDays() {
        var m = {};
        ((vm.club && vm.club.extra_dates) || []).forEach(function (s) { m[s.date] = (m[s.date] || 0) + 1; });
        return m;
    }

    // ═══ time off (holidays page) ═══
    function holidaysReady() {
        var f = D.flash;
        if (!f) { return; }
        D.flash = null;
        vm.hiHol = f.id;
        vm.holOpen = f.open ? f.id : null;
    }
    vm.clashTotal = function () { return vm.up.reduce(function (s, h) { return s + (h.clashes || []).length; }, 0); };
    vm.nextIn = function (h) { var n = C.daysBetween(vm.today, D.day(h.from)); return n <= 0 ? 'now' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; };
    vm.nextWhen = function (h) { return D.fDayY(h.from, vm.year) + (h.all_day ? '' : ' · ' + C.fTime(h.from)); };
    vm.daysOff = function () {
        var all = vm.up.concat(vm.past).filter(function (h) { return D.day(h.from).slice(0, 4) === vm.year; });
        return {
            days: all.filter(function (h) { return h.all_day; }).reduce(function (s, h) { return s + D.holDays(h); }, 0),
            parts: all.filter(function (h) { return !h.all_day; }).length
        };
    };
    vm.when = function (h, past) { return D.holWhen(h, past, vm.year); };
    vm.title = function (h) { return h.title || 'Time off'; };
    vm.toggleHol = function (h) {
        if (vm.holBusy) { return; }
        vm.holOpen = vm.holOpen === h.id ? null : h.id;
        vm.holAsk = null;
    };
    vm.showClash = function () {
        var h = vm.up.filter(function (x) { return (x.clashes || []).length; })[0];
        if (!h) { return; }
        vm.holOpen = h.id; vm.holAsk = null;
        $timeout(function () { var el = document.getElementById('iav-hol-' + h.id); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
    };
    vm.togglePast = function () { vm.showPast = !vm.showPast; };
    vm.openBooking = function (b) { $state.go('dashboard.scheduler_v2.edit', { booking_id: b.booking_id, date: D.day(b.start) }); };
    vm.changeHol = function (h) { $state.go('dashboard.v2.instructor_holidays_form', { change: h.id }); };
    vm.addNew = function () { $state.go('dashboard.v2.instructor_holidays_form', { change: null }); };
    vm.askHolDel = function (h) { if (!vm.holBusy) { vm.holAsk = h.id; } };
    vm.keepHol = function () { if (!vm.holBusy) { vm.holAsk = null; } };
    vm.removeHol = function (h, past) {
        if (vm.holBusy) { return; }
        vm.holBusy = true;
        D.removeTimeOff(h.id).then(function (r) {
            vm.holBusy = false;
            if (!r || r.success === false) {
                ToastService.error('Not removed', D.failText(r, 'The time off couldn\'t be removed. Nothing has changed.', 'time_off'));
                if (r && (r.status === 404 || r.error === 'NOT_FOUND')) { vm.holAsk = null; D.forget(); refresh(); }
                return;
            }
            vm.holAsk = null;
            h._leaving = true;
            $timeout(function () {
                vm.up = vm.up.filter(function (x) { return x.id !== h.id; });
                vm.past = vm.past.filter(function (x) { return x.id !== h.id; });
                vm.holOpen = null;
                ToastService.success('Removed', '“' + vm.title(h) + '”. ' + (past ? 'It\'s off your list.' : 'Students can book you then again.'), QUIET);
                D.forget();
                refresh();
            }, 230);
        });
    };

    // ═══ add / change time off (the form page) ═══
    function emptyForm() { return { start: null, end: null, allDay: true, from: '09:00', to: '13:00', title: '', editing: null }; }
    function initForm() {
        var ym = vm.today.slice(0, 7);
        vm.fcA = calPart('a', ym);
        vm.fcB = calPart('b', nextYm(ym, 1));
        loadMonthLessons();
    }
    function formReady(first) {
        if (vm.fcA && vm.fcA.opts.today !== vm.today) {
            [vm.fcA, vm.fcB].forEach(function (c) { c.opts.today = vm.today; c.opts.min = vm.today; });
        }
        if (!first) { return; }
        var id = +($stateParams.change || 0);
        if (!id) { return; }
        var h = vm.up.filter(function (x) { return x.id === id; })[0];
        if (!h) {
            ToastService.warning('Nothing to change', 'That time off isn\'t coming up any more. You can add a new one here.');
            return;
        }
        var s0 = D.day(h.from), e0 = h.all_day ? D.holLast(h) : D.day(h.to), tEnd = C.fTime(h.to);
        if (!h.all_day && tEnd === '00:00' && e0 > s0) { e0 = C.addDays(e0, -1); tEnd = '23:00'; }
        vm.f = { start: s0, end: e0 > s0 ? e0 : null, allDay: !!h.all_day, from: h.all_day ? '09:00' : C.fTime(h.from), to: h.all_day ? '13:00' : tEnd,
            title: h.title || '', editing: h.id };
        showMonth(s0.slice(0, 7));
        formChanged();
    }
    function calOpts() {
        return { today: vm.today, min: vm.today, allowPast: false, weekStart: 1, otherDays: false, weekends: false, shortcuts: false,
            dots: true, busyVersion: 0, locale: { weekdaysShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] } };
    }
    function nextYm(ym, k) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + C.p2(m + 1); }
    function calPart(part, ym) {
        return {
            part: part, anchor: ym + '-01', ym: ym, dotWord: 'lessons booked with you', offWord: 'time off',
            opts: calOpts(),
            cls: rangeCls,
            off: function (ds) { return !!offDays()[ds]; },
            dot: function (ds) { return !!vm.lessonDays[ds]; },
            busy: function (ds) { return vm.lessonDays[ds] ? 1 : 0; },
            tap: formTap,
            shown: function (m) { calShown(part, m); },
            sig: function () { return (vm.f.start || '') + '|' + (vm.f.end || '') + '|' + offSig(); }
        };
    }
    /* the two calendars show consecutive months: when one moves, the other follows. A picker's first render shows today's
       month before its model reaches it, so a calendar counts only once it has shown its own month (ready). */
    function calShown(part, ym) {
        var me = part === 'a' ? vm.fcA : vm.fcB, other = part === 'a' ? vm.fcB : vm.fcA;
        if (!me || !other) { return; }
        if (!me.ready) { if (ym === me.ym) { me.ready = true; } return; }
        if (ym === me.ym) { return; }
        me.ym = ym;
        var want = nextYm(ym, part === 'a' ? 1 : -1);
        if (other.ym !== want) { other.ym = want; setAnchor(other, want); }
        loadMonthLessons();
    }
    function setAnchor(cal, ym) { var v = ym + '-01'; cal.anchor = cal.anchor === v ? ym + '-02' : v; }
    function showMonth(ym) {
        if (!vm.fcA) { return; }
        var min = vm.today.slice(0, 7);
        if (ym < min) { ym = min; }
        vm.fcA.ym = ym; setAnchor(vm.fcA, ym);
        vm.fcB.ym = nextYm(ym, 1); setAnchor(vm.fcB, vm.fcB.ym);
        loadMonthLessons();
    }
    function rangeCls(ds) {
        var f = vm.f;
        if (!f.start) { return null; }
        var e = f.end || f.start;
        if (ds === f.start && ds === e) { return { sel: true, start: true, end: true }; }
        if (ds === f.start) { return { sel: true, start: true }; }
        if (ds === e) { return { sel: true, end: true }; }
        return ds > f.start && ds < e ? { inr: true } : null;
    }
    /* tap the first day, then the last; one tap twice is a single day; a third tap starts again */
    function formTap(ds) {
        var f = vm.f;
        vm.fErr = {};
        if (!f.start || f.end) { f.start = ds; f.end = null; }
        else if (ds < f.start) { f.start = ds; }
        else { f.end = ds === f.start ? null : ds; }
        formChanged();
    }
    vm.clearDays = function () { vm.f.start = null; vm.f.end = null; vm.fErr = {}; formChanged(); };
    vm.nDays = function () { return vm.f.start ? C.daysBetween(vm.f.start, vm.f.end || vm.f.start) + 1 : 0; };
    vm.formChanged = function () { vm.fErr = {}; formChanged(); };
    vm.chip = function (t) { vm.f.title = vm.f.title === t ? '' : t; };
    /* the range as the time-off POST would store it: { from, to, all_day, last_day } */
    vm.rng = function () {
        var f = vm.f;
        if (!f.start) { return null; }
        var end = f.end || f.start;
        return f.allDay ? { from: f.start + ' 00:00:00', to: C.addDays(end, 1) + ' 00:00:00', all_day: true, last_day: end }
            : { from: f.start + ' ' + f.from + ':00', to: end + ' ' + f.to + ':00', all_day: false, last_day: end };
    };
    vm.rngWhen = function () { var r = vm.rng(); return r ? D.holWhen(r, false, vm.year) : ''; };
    vm.rngLen = function () { var r = vm.rng(); return r ? D.holLen(r) : ''; };
    vm.ctaSub = function () {
        if (!vm.rng()) { return 'Pick the days first'; }
        return vm.f.allDay ? 'Not bookable for ' + C.plural(vm.nDays(), 'day') : 'Not bookable ' + vm.f.from + '–' + vm.f.to;
    };
    vm.appliesAt = function () { return vm.clubs.length ? D.joinAnd(vm.clubs.map(function (c) { return c.name; })) : 'Every club you teach at'; };
    function timedBad() { var f = vm.f; return !!(!f.allDay && f.start && !f.end && D.t2m(f.from) >= D.t2m(f.to)); }
    /* the lessons this time off would clash with, as soon as the days (or the times) are picked */
    function formChanged() {
        if (fcTimer) { $timeout.cancel(fcTimer); fcTimer = null; }
        var f = vm.f, seq = ++fcSeq;
        if (!f.start || timedBad()) { vm.fClash = []; vm.fClashBusy = false; return; }
        vm.fClashBusy = true;
        fcTimer = $timeout(function () {
            var end = f.end || f.start;
            var p = f.allDay ? D.clashes(f.start, end, true) : D.clashes(f.start + ' ' + f.from, end + ' ' + f.to, false);
            p.then(function (r) {
                if (dead || seq !== fcSeq) { return; }
                vm.fClashBusy = false;
                vm.fClash = r && r.success ? (r.clashes || []) : [];
            });
        }, 220);
    }
    /* the calendar's dots: your lessons in the two months on show (one clashes read covers both) */
    function loadMonthLessons() {
        if (!vm.fcA || !vm.fcB) { return; }
        var a = vm.fcA.ym, b = vm.fcB.ym, lo = (a < b ? a : b) + '-01', hiYm = a < b ? b : a;
        var hi = C.addDays(nextYm(hiYm, 1) + '-01', -1), key = lo + '|' + hi;
        if (vm.monKey === key) { return; }
        vm.monKey = key;
        var seq = ++monSeq;
        D.clashes(lo, hi, true).then(function (r) {
            if (dead || seq !== monSeq || !r || !r.success) { return; }
            var m = angular.extend({}, vm.lessonDays);
            (r.clashes || []).forEach(function (x) {
                var d0 = D.day(x.start), d1 = D.day(x.end);
                if (d1 > d0 && C.fTime(x.end) === '00:00') { d1 = C.addDays(d1, -1); }
                for (var d = d0, i = 0; d <= d1 && i < 7; d = C.addDays(d, 1), i++) { m[d] = true; }
            });
            vm.lessonDays = m;
            vm.fcA.opts.busyVersion++;
            vm.fcB.opts.busyVersion++;
        });
    }
    /* whole-day time off already booked (hatched), leaving out the one being changed */
    var offCache = { key: null, map: {} };
    function offDays() {
        var editing = vm.f && vm.f.editing, key = editing + '|' + vm.up.map(function (h) { return h.id + h.from + h.to + h.all_day; }).join(',');
        if (offCache.key === key) { return offCache.map; }
        var m = {};
        vm.up.forEach(function (h) {
            if (!h.all_day || h.id === editing) { return; }
            for (var d = D.day(h.from), l = D.holLast(h), i = 0; d <= l && i < 400; d = C.addDays(d, 1), i++) { m[d] = true; }
        });
        offCache = { key: key, map: m };
        return m;
    }
    function offSig() { offDays(); return offCache.key; }
    vm.fSave = function () {
        var f = vm.f, err = {};
        if (vm.fBusy) { return; }
        if (!f.start) { err.dates = 'Pick the first day you\'re off.'; }
        if (timedBad()) { err.times = 'Back at has to be after Off from.'; }
        if (err.dates || err.times) {
            vm.fErr = err;
            $timeout(function () { var el = document.getElementById(err.dates ? 'iav-f-dates' : 'iav-ft'); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
            return;
        }
        var end = f.end || f.start, editing = f.editing, clashN = vm.fClash.length, words = vm.rngWhen();
        var body = f.allDay ? { title: f.title || 'Time off', from_date: f.start, to_date: end, allDay: 1 }
            : { title: f.title || 'Time off', from_date: f.start + ' ' + f.from, to_date: end + ' ' + f.to, allDay: 0 };
        vm.fBusy = true;
        (editing ? D.changeTimeOff(editing, body) : D.addTimeOff(body)).then(function (r) {
            vm.fBusy = false;
            if (!r || r.success === false) {
                if (r && r.error === 'VALIDATION_ERROR') {
                    var fl = r.fields || (r.data && r.data.fields) || [], msg = r.message || 'Check the days and times.';
                    vm.fErr = !f.allDay && fl.some(function (x) { return /time|^to/.test(x); }) ? { times: msg } : { dates: msg };
                    return;
                }
                ToastService.error(editing ? 'Not saved' : 'Time off not added', D.failText(r, 'Your time off couldn\'t be saved. Nothing has changed.', 'time_off'));
                return;
            }
            // Time off draws at once from the last read, then the fresh one brings this one in, highlighted (and open if it clashes)
            D.flash = { id: +(r.id || editing || 0), open: clashN > 0 };
            D.forgetPreview();
            $state.go('dashboard.v2.instructor_holidays');
            ToastService.success(editing ? 'Saved' : 'Time off added', words + '. Students can\'t book you then.', QUIET);
        });
    };
    vm.cancelForm = function () { $state.go('dashboard.v2.instructor_holidays'); };

    // ═══ pages, tabs, keys ═══
    vm.go = function (page) {
        var name = { weekly: 'dashboard.v2.instructor_availability', holidays: 'dashboard.v2.instructor_holidays' }[page];
        if (name && page !== vm.page) { $state.go(name); }
    };
    /* a fixed action bar on phones: the week's Save (every-week mode), Add time off */
    vm.hasBar = function () {
        if (vm.load !== 'ready') { return false; }
        if (vm.page === 'weekly') { return !!vm.club && vm.club.mode === 'regular'; }
        return true;
    };

    function onKey(e) {
        if (e.keyCode !== 27) { return; }
        $scope.$apply(function () {
            if (vm.dlg) { if (vm.dlg.ask && !vm.dlg.busy) { vm.dlg.ask = false; return; } vm.closeDlg(); return; }
            if (vm.modeAsk && !vm.modeBusy) { vm.modeAsk = null; }
            if (vm.delAsk && !vm.delBusy) { vm.delAsk = null; }
            if (vm.holAsk && !vm.holBusy) { vm.holAsk = null; }
        });
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        dead = true;
        $document.off('keydown', onKey);
        if (fcTimer) { $timeout.cancel(fcTimer); }
    });
}
