/* ═══════════════════════════════════════════════════════════════════════════
   v2 FIND A SLOT — design: mockups/my-account/find-a-slot.html (approved 10 Nov 2026, 20:29). Beside the v1 screen
   (dashboard.slot_search: views/bookings/slot_search.html, SlotSearchController) behind the global v2 switch.
   Guide: FRONTEND_FIND_A_SLOT_V2_GUIDE.md · tracker: ../mockups/v2-build/fe-find-a-slot.md
   Views: views/v2/find_a_slot/*.html · styles: css/v2/find_a_slot.css (.fsl-*, on css/ta-base.css).

   One read per club / first day / range / single-or-double: GET bookings/v2/find_a_slot/{club}/{date}/{days}?double_slot
   (Models\FindASlotV2 — every day × club slot of the range, taken ones too, every free aircraft, the free instructors,
   "Yours", the allowance, the instructors' booking_mode, course → qualified instructors). The aircraft type, the
   instructor and the course filter on the client — instant, and "Not with Kate" can be told from "Taken".
   Booking = POST bookings/ (BookingService.Create, the scheduler v2 panel's path); with a type only (the club assigns
   the aircraft, or an instructor is chosen) the plane_id is the read's `picks[type]` — the backend's own per-type pick.
   The instructor + course fields are the shared <ta-combo> (js/v2/logbook/logbook.js); "Join the waiting list" opens the
   scheduler's member waiting-request form (WaitingRequestFormController, views/modals/waiting_request_form.html).
   Owner decisions (10 Nov, tracker "Decisions"): a phone opens on the List, a desktop on the Grid (DEFAULT_VIEW); the
   member's last choice is remembered per browser; a club with clubs.find_a_slot_grid_only = 1 shows the grid only (no List
   tab). "Join the waiting list" (empty state) never leaves the page: a short confirm sheet, then POST waiting_requests
   (WaitingRequestsService.Create — the scheduler v2 form's API) with the search's days (≤ 10, the endpoint's limit),
   type, instructor, and (batch 21, 11 Nov) the course as `course_id` and the length as `slots_needed` (2 = double slot) —
   their own fields now, no longer written into the request's notes.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.find_a_slot', {
        url: '/my_account/find_a_slot',
        templateUrl: 'views/v2/find_a_slot/find_a_slot.html',
        controller: 'FindASlotV2Controller', controllerAs: 'vm',
        data: { action: 'search' }
    });
    DesignRoutesProvider.map('dashboard.slot_search', 'dashboard.v2.find_a_slot');
}]);

/* ── the one read ── */
app.factory('FindASlotV2Data', FindASlotV2Data);
FindASlotV2Data.$inject = ['$http', '$location'];
function FindASlotV2Data($http, $location) {
    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data || {};
        return { success: false, error: d.error || 'NETWORK', message: d.message || (typeof d === 'string' ? d : ''), status: res.status };
    }
    return {
        search: function (clubId, from, days, dbl) {
            return $http.get('/api/v1/bookings/v2/find_a_slot/' + encodeURIComponent(clubId) + '/' + encodeURIComponent(from) + '/' + (+days || 14) + (dbl ? '?double_slot=1' : ''))
                .then(handleSuccess, handleError2);
        }
    };
}

/* ── the From date: the mockup's own middle button opens the app's date picker (ToAviateDatePicker.attach) ──
   <button fsl-date-pick="vm.S.from" fsl-on-pick="vm.setFrom(date)"> */
app.directive('fslDatePick', ['$window', function ($window) {
    return {
        restrict: 'A',
        scope: { value: '=fslDatePick', onPick: '&fslOnPick' },
        link: function (scope, el) {
            var P = $window.ToAviateDatePicker, att = null;
            if (!P || !P.attach) { return; }
            att = P.attach(el[0], {
                value: scope.value || null, allowPast: false,
                onPick: function (d) { scope.$evalAsync(function () { scope.onPick({ date: d }); }); }
            });
            scope.$watch('value', function (v) { if (att && att.picker && v) { att.picker.setValue(v); } });
            scope.$on('$destroy', function () { if (att) { att.destroy(); att = null; } });
        }
    };
}]);

app.controller('FindASlotV2Controller', FindASlotV2Controller);
FindASlotV2Controller.$inject = ['$rootScope', '$scope', '$state', '$timeout', '$document', '$window', 'FindASlotV2Data', 'MemberService', 'CourseService', 'BookingService', 'WaitingRequestsService', 'ToastService', 'LgbFmt'];
function FindASlotV2Controller($rootScope, $scope, $state, $timeout, $document, $window, FindASlotV2Data, MemberService, CourseService, BookingService, WaitingRequestsService, ToastService, LgbFmt) {
    var vm = this;
    var F = LgbFmt;

    /* ── owner decisions (10 Nov) — one place each ── */
    var DEFAULT_VIEW = { desk: 'grid', phone: 'list' };   // Grid or List first (a remembered choice wins; grid-only clubs: grid)
    var WAITING_LIST = true;                               // the empty state offers "Join the waiting list"
    var WAIT_MAX_DAYS = 10;                                // waiting_requests takes at most 10 dates per request

    var RANGES = [[7, '1 week'], [14, '2 weeks'], [28, '4 weeks'], [60, '2 months']];
    var VIEW_KEY = 'toaviate_fsl_view';
    var AV = ['#2563eb', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#b45309', '#4f46e5'];
    var DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var seq = 0;

    vm.user = $rootScope.globals.currentUser;
    vm.RANGES = RANGES;
    vm.WAITING_LIST = WAITING_LIST;
    vm.today = F.today();
    vm.load = 'loading';          // loading | ready | error | noclub
    vm.err = null;                // { code, title, text } when the read fails
    vm.clubs = [];                // [{ id, title }]
    vm.courses = [];
    vm.data = null;
    vm.S = { club: null, from: vm.today, range: 14, type: 'all', ins: null, course: null, dbl: false, view: readView() };
    vm.dlg = null;                // the booking sheet
    vm.wl = null;                 // the waiting-list sheet
    vm.gridOnly = false;          // clubs.find_a_slot_grid_only
    vm.cbVer = 0;
    vm.SK = new Array(14);        // the loading grid's skeleton cells
    vm.painted = false;           // the first answer has been drawn (skeletons before it; the runway for a slow re-search)
    vm.longWait = false;          // a re-search running for more than LONG_MS shows <ta-runway>
    var LONG_MS = 600, longTimer = null;
    vm.BOOK_STEPS = ['Booking the slot', 'Done'];
    vm.WAIT_STEPS = ['Sending the request', 'Done'];

    /* ═════════ load ═════════ */
    function init() {
        MemberService.GetUserClubs(vm.user.id).then(function (data) {
            var list = (data && data.clubs) || [];
            vm.clubs = list.map(function (c) { return { id: parseInt(c.id, 10), title: String(c.title || c.name || '').trim() }; })
                .filter(function (c) { return c.id > 0; });
            if (!vm.clubs.length) { vm.load = 'noclub'; return; }
            vm.S.club = vm.clubs[0].id;
            loadClub();
        });
    }
    function loadClub() {
        vm.courses = [];
        var club = vm.S.club;
        CourseService.GetCoursesByClubId(club).then(function (data) {
            if (club !== vm.S.club) { return; }
            var items = (data && data.items) ? data.items : (angular.isArray(data) ? data : []);
            vm.courses = (CourseService.sortByDisplayOrder ? CourseService.sortByDisplayOrder(items) : items)
                .filter(function (c) { return c && !(+c.deleted); })
                .map(function (c) { return { id: parseInt(c.id, 10), title: String(c.title || '').trim(), sub: courseSub(c) }; });
            recompute();
        });
        search();
    }
    function courseSub(c) {
        var s = String(c.description || c.short_title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return s.length > 70 ? s.slice(0, 68).replace(/\s+\S*$/, '') + '…' : s;
    }
    function fromWords() {
        var S = vm.S, d = F.pd(S.from);
        vm.fromWord = S.from === vm.today ? 'Today' : dayWord(S.from);
        vm.fromSub = d.getDate() + ' ' + F.MON[d.getMonth()];
        vm.fromDay = F.fDay(S.from);
        vm.toDate = F.addDays(S.from, S.range - 1);
        vm.toDay = F.fDay(vm.toDate);
        vm.rangeTxt = rangeLabel(S.range);
    }
    function search() {
        var my = ++seq;
        fromWords();
        vm.load = 'loading';
        vm.longWait = false;
        if (longTimer) { $timeout.cancel(longTimer); }
        if (vm.painted) { longTimer = $timeout(function () { if (my === seq && vm.load === 'loading') { vm.longWait = true; } }, LONG_MS); }
        vm.err = null;
        vm.dlg = null;
        FindASlotV2Data.search(vm.S.club, vm.S.from, vm.S.range, vm.S.dbl).then(function (res) {
            if (my !== seq) { return; }
            if (!res || !res.success) { fail(res || {}); return; }
            vm.data = res;
            index();
            recompute();
            vm.load = 'ready';
            vm.painted = true;
            vm.longWait = false;
        });
    }
    // after a booking: the same search again without the skeleton (the slot already shows "Yours")
    function refreshQuietly() {
        var my = ++seq;
        FindASlotV2Data.search(vm.S.club, vm.S.from, vm.S.range, vm.S.dbl).then(function (res) {
            if (my !== seq || !res || !res.success) { return; }
            vm.data = res; index(); recompute();
        });
    }
    function fail(res) {
        var code = res.error || 'NETWORK';
        var club = clubName();
        var map = {
            NO_SLOTS: { icon: 'fa-clock', title: club + ' hasn’t set up booking slots yet', text: 'Find a slot works from the club’s own slots (Morning 1, Afternoon 2…). Until an administrator adds them, book from the scheduler.' },
            NO_DOUBLE: { icon: 'fa-layer-group', title: 'No back-to-back slots at ' + club, text: 'The club’s slots don’t run on from each other, so there’s no double slot to book. Switch Double slot off to see single slots.' },
            NO_AIRCRAFT: { icon: 'fa-plane', title: 'No aircraft to book at ' + club, text: 'The club has no aircraft on its fleet list for booking right now.' },
            FORBIDDEN: { icon: 'fa-lock', title: 'You’re not a member of ' + club, text: 'Only members can see a club’s free slots. If your membership has just ended, renew it from Memberships.' },
            BAD_REQUEST: { icon: 'fa-calendar-times', title: 'That date didn’t work', text: 'Pick the first day again.' }
        };
        vm.err = map[code] || { icon: 'fa-exclamation-triangle', title: 'We couldn’t load the free slots', text: (res.message && res.status !== 0 && typeof res.message === 'string' && res.message.length < 200 ? res.message + ' ' : '') + 'Nothing has changed — try again in a moment.', retry: true };
        vm.err.code = code;
        vm.data = null;
        vm.load = 'error';
        vm.longWait = false;
    }

    /* ═════════ the data, indexed ═════════ */
    var P = {}, I = {};
    function index() {
        var D = vm.data;
        P = {}; I = {};
        (D.planes || []).forEach(function (p) { P[+p.id] = p; });
        (D.instructors || []).forEach(function (i, n) {
            var name = (String(i.first_name || '') + ' ' + String(i.last_name || '')).replace(/\s+/g, ' ').trim() || 'Instructor';
            var code = (i.initials || name.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2)).toUpperCase();
            I[+i.id] = { id: +i.id, name: name, first: String(i.first_name || name).trim(), code: code, mode: i.booking_mode || 'open', order: n,
                av: { code: code, colour: i.colour || AV[Math.abs(+i.id || 0) % AV.length], title: name + ' (instructor)' } };
        });
        vm.fleet = [];
        var types = {};
        (D.planes || []).forEach(function (p) { var t = String(p.plane_type || ''); if (!t) { return; } if (!types[t]) { types[t] = { type: t, n: 0, name: p.type_name || '' }; vm.fleet.push(types[t]); } types[t].n++; });
        vm.nPlanes = (D.planes || []).length;
        if (vm.S.type !== 'all' && !types[vm.S.type]) { vm.S.type = 'all'; }
        if (vm.S.ins && !I[vm.S.ins]) { vm.S.ins = null; }
        vm.pick = +D.allow_aircraft_selection === 1;
        vm.gridOnly = +D.find_a_slot_grid_only === 1;
        vm.view = vm.gridOnly ? 'grid' : vm.S.view;
        vm.me = D.me || { restricted: false, limit: { max: 0, used: 0, exempt: false, at_limit: false } };
    }
    function teaches(course, id) {
        var m = vm.data && vm.data.course_instructors;
        if (!course || !m) { return true; }   // no qualification rows at the club: everyone teaches everything
        return (m[String(course)] || []).indexOf(+id) > -1;
    }
    function courseOf(id) { for (var i = 0; i < vm.courses.length; i++) { if (vm.courses[i].id === +id) { return vm.courses[i]; } } return null; }
    vm.courseTitle = function () { var c = courseOf(vm.S.course); return c ? c.title : ''; };
    function insList() { return Object.keys(I).map(function (k) { return I[k]; }).sort(function (a, b) { return a.order - b.order; }); }
    function clubName() { for (var i = 0; i < vm.clubs.length; i++) { if (vm.clubs[i].id === vm.S.club) { return vm.clubs[i].title || 'the club'; } } return 'the club'; }
    vm.clubName = clubName;

    /* ═════════ words ═════════ */
    function hhmm(t) { return String(t || '').slice(0, 5); }
    function dayWord(ymd) { if (ymd === vm.today) { return 'Today'; } if (ymd === F.addDays(vm.today, 1)) { return 'Tomorrow'; } return DOWL[F.pd(ymd).getDay()].slice(0, 3); }
    function rangeLabel(n) { for (var i = 0; i < RANGES.length; i++) { if (RANGES[i][0] === n) { return RANGES[i][1]; } } return n + ' days'; }
    vm.rangeLabel = rangeLabel;
    function modeTxt(m) { return m === 'instructor_approval' ? 'Confirms bookings first' : m === 'admin_approval' ? 'The club confirms first' : 'Books straight in'; }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    function typeNames(ids) { var t = {}, out = []; ids.forEach(function (id) { var p = P[id]; if (p && !t[p.plane_type]) { t[p.plane_type] = 1; out.push(p.plane_type); } }); return out; }
    function mineText(m) {
        var who = m.instructor_first_name ? 'with ' + m.instructor_first_name : 'solo';
        return (m.registration ? m.registration + ' · ' : '') + who + (/^pending/.test(m.status || '') ? ' · to confirm' : '');
    }

    /* ═════════ the answer: grid rows, list days, tiles, sentence — rebuilt when the data or a filter changes ═════════ */
    function filt(cell) {
        var S = vm.S;
        var planes = S.type === 'all' ? cell.planes : cell.planes.filter(function (id) { return P[id] && P[id].plane_type === S.type; });
        var ins = cell.instructors.filter(function (id) { return I[id] && (!S.ins || id === S.ins) && (!S.course || teaches(S.course, id)); })
            .sort(function (a, b) { return I[a].order - I[b].order; });
        return { planes: planes, ins: ins, free: !!cell.free && planes.length > 0 && !((S.ins || S.course) && !ins.length) };
    }
    function recompute() {
        var D = vm.data, S = vm.S;
        if (!D) { return; }
        vm.atLimit = !!(vm.me && vm.me.limit && vm.me.limit.at_limit);
        vm.cols = (D.slots_config || []).map(function (c) { return { key: c.key, label: c.label || (hhmm(c.start_time) + '–' + hhmm(c.end_time)), s: hhmm(c.start_time), e: hhmm(c.end_time) }; });
        var colBy = {}; vm.cols.forEach(function (c) { colBy[c.key] = c; });
        var rows = [], days = [], nFree = 0, first = null, insFree = {};
        (D.days || []).forEach(function (day) {
            var row = { date: day.date, word: dayWord(day.date), sub: F.fDay(day.date).slice(4), long: F.fDayLong(day.date).slice(4), today: day.date === vm.today, we: !!day.weekend, cells: [] };
            var items = [], dayFree = 0;
            (day.cells || []).forEach(function (cell) {
                var col = colBy[cell.slot]; if (!col) { return; }
                var f = filt(cell), key = day.date + '|' + cell.slot;
                var x = { key: key, col: col, date: day.date, cell: cell, f: f, kind: 'free' };
                // the instructor finder's "N free in the range": every slot that instructor could take, before the filters
                if (cell.free && !cell.mine && cell.planes.length) { cell.instructors.forEach(function (id) { insFree[id] = (insFree[id] || 0) + 1; }); }
                if (cell.mine) {
                    x.kind = 'mine'; x.txt = mineText(cell.mine);
                    x.aria = col.label + ', ' + F.fDay(day.date) + ': your booking';
                    items.push(x);
                } else if (!f.free) {
                    x.kind = 'taken';
                    x.txt = !cell.free ? (cell.reason === 'past' ? 'Past' : 'Taken') : (f.planes.length ? (S.ins && I[S.ins] ? 'Not with ' + I[S.ins].first : 'No instructor') : 'Taken');
                    x.aria = col.label + ', ' + F.fDay(day.date) + ': ' + x.txt.toLowerCase();
                } else {
                    var nT = typeNames(f.planes);
                    x.avs = f.ins.slice(0, 3).map(function (id) { return I[id].av; });
                    x.avs4 = f.ins.slice(0, 4).map(function (id) { return I[id].av; });
                    x.more = Math.max(0, f.ins.length - 3);
                    x.more4 = Math.max(0, f.ins.length - 4);
                    x.nB = vm.pick ? f.planes.length : nT.length;
                    x.nW = vm.pick ? 'aircraft' : (nT.length === 1 ? 'type' : 'types');
                    x.types = nT.join(', ');
                    x.names = f.ins.slice(0, 3).map(function (id) { return I[id].first; }).join(', ') + (f.ins.length > 3 ? ' and ' + (f.ins.length - 3) + ' more' : '');
                    x.someConfirm = f.ins.some(function (id) { return I[id].mode !== 'open'; });
                    x.aria = col.label + ', ' + F.fDay(day.date) + ': free';
                    nFree++; dayFree++;
                    if (!first) { first = x; }
                    items.push(x);
                }
                row.cells.push(x);
            });
            rows.push(row);
            if (items.length) { days.push({ date: day.date, word: row.word, long: row.long, today: row.today, free: dayFree, items: items }); }
        });
        vm.rows = rows;
        vm.listDays = days;
        vm.nFree = nFree;
        vm.nCells = rows.length * vm.cols.length;
        vm.first = first;
        vm.insFree = insFree;
        vm.filtered = S.type !== 'all' || !!S.ins || !!S.course || S.dbl;
        fromWords();
        var il = insList();
        vm.legendAv = il.length ? il[0].av : { code: 'FI', colour: AV[0], title: 'Instructor' };
        vm.egName = il.length ? il[0].first.slice(0, 2) : 'Ka';
        var c0 = (D.slots_config || [])[0], mins = 0;
        if (c0) { var a = String(c0.start_time).split(':'), b = String(c0.end_time).split(':'); mins = (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]); }
        if (mins > 0 && !S.dbl) { mins = mins * 2; }
        vm.dblTxt = mins > 0 ? ' — ' + (mins % 60 ? F.hm(mins / 60) : (mins / 60) + ' hours') : '';
        vm.sentence = sentence();
        vm.tiles = tiles();
        vm.emptyTitle = 'Nothing free ' + (S.ins && I[S.ins] ? 'with ' + I[S.ins].first + ' ' : '') + 'in the ' + rangeLabel(S.range) + ' from ' + (S.from === vm.today ? 'today' : F.fDay(S.from));
        vm.qualifiedN = insList().filter(function (i) { return teaches(S.course, i.id); }).length;
        setComboValues();
        if (vm.dlg) { dlgRefresh(); }
    }
    function sentence() {
        var S = vm.S, n = vm.nFree;
        return { b: String(n), rest: ' free ' + (S.dbl ? 'double ' : '') + 'slot' + (n === 1 ? '' : 's') + ' in the ' + rangeLabel(S.range) + ' from ' + (S.from === vm.today ? 'today' : F.fDay(S.from))
            + (S.type !== 'all' ? ' in a ' + S.type : '') + (S.ins && I[S.ins] ? ' with ' + I[S.ins].first : '') + (S.course && courseOf(S.course) ? ' for ' + courseOf(S.course).title : '') };
    }
    function tiles() {
        var out = [], f = vm.first, L = vm.me.limit || {};
        if (f) {
            out.push({ cls: 'ta-tile--progress', icon: 'fa-bolt', k: 'Next free slot', v: dayWord(f.date) + ' ' + f.col.s, words: true,
                s: f.col.label + ' · ' + (f.f.ins.length ? 'with ' + f.f.ins.slice(0, 2).map(function (id) { return I[id].first; }).join(' or ') + (f.f.ins.length > 2 ? ' + ' + (f.f.ins.length - 2) + ' more' : '') : 'solo, no instructor free'),
                go: vm.atLimit ? null : f });
        } else {
            out.push({ icon: 'fa-bolt', k: 'Next free slot', v: 'Nothing in range', words: true, quiet: true, s: 'Try a wider range or fewer filters' });
        }
        out.push({ icon: 'fa-th', k: 'Free slots', v: String(vm.nFree), s: 'of ' + vm.nCells + ' in the ' + rangeLabel(vm.S.range) });
        if (+L.max > 0 && !L.exempt) {
            var left = Math.max(0, L.max - L.used);
            out.push({ cls: left === 0 ? 'ta-tile--attn' : '', icon: 'fa-ticket-alt', k: 'Bookings you can hold', v: String(L.used), of: 'of ' + L.max,
                s: left === 0 ? 'At the club’s limit — cancel one to book another' : left + ' more upcoming booking' + (left === 1 ? '' : 's') + ' allowed' });
        } else {
            out.push({ icon: 'fa-calendar-check', k: 'Your bookings', v: String(+L.used || 0), s: 'upcoming · ' + (+L.max > 0 ? 'no limit for you' : 'no limit at this club') });
        }
        return out;
    }

    /* ═════════ the search card ═════════ */
    vm.setClub = function (id) { if (vm.S.club === id) { return; } vm.S.club = id; vm.S.ins = null; vm.S.course = null; vm.S.type = 'all'; loadClub(); };
    vm.setRange = function (n) { if (vm.S.range === n) { return; } vm.S.range = n; search(); };
    vm.setType = function (t) { vm.S.type = t; recompute(); };
    vm.toggleDbl = function () { vm.S.dbl = !vm.S.dbl; search(); };
    vm.setFrom = function (d) { if (!d) { return; } vm.S.from = d < vm.today ? vm.today : d; search(); };
    vm.prev = function () { if (vm.S.from <= vm.today) { return; } var d = F.addDays(vm.S.from, -vm.S.range); vm.S.from = d < vm.today ? vm.today : d; search(); };
    vm.next = function () { vm.S.from = F.addDays(vm.S.from, vm.S.range); search(); };
    vm.reset = function () { var dbl = vm.S.dbl; vm.S.type = 'all'; vm.S.ins = null; vm.S.course = null; vm.S.dbl = false; if (dbl) { search(); } else { recompute(); } };
    vm.retry = function () { search(); };

    /* the smart-search fields (<ta-combo>): instructors grouped by who is free in the range, courses with how many teach them */
    vm.insSource = function (q) {
        var S = vm.S, ql = String(q || '').trim().toLowerCase();
        var list = insList().filter(function (i) { return teaches(S.course, i.id); });
        var hits = ql ? list.filter(function (i) {
            var n = i.name.toLowerCase();
            return n.indexOf(ql) > -1 || i.code.toLowerCase() === ql || n.split(' ').some(function (w) { return w.indexOf(ql) === 0; });
        }) : list;
        var rows = hits.map(function (i) {
            var n = vm.insFree[i.id] || 0;
            return { key: String(i.id), av: i.av, t: i.name, s: modeTxt(i.mode), r: n ? n + ' free' : 'None free', rs: n ? 'in the ' + rangeLabel(S.range) : '', on: S.ins === i.id, quiet: !n, noHlSub: true, _n: n };
        });
        rows.sort(function (a, b) { return (b._n - a._n) || (a.t < b.t ? -1 : 1); });
        var groups = [];
        if (!ql) { groups.push({ rows: [{ key: '', lead: 'fa-users', t: 'Any instructor', s: plural(list.length, 'instructor') + (S.course && courseOf(S.course) ? ' teach ' + courseOf(S.course).title : ' at the club'), on: !S.ins, noHl: true }] }); }
        var top = rows.filter(function (r) { return r._n > 0; }), none = rows.filter(function (r) { return !r._n; });
        if (top.length) { groups.push({ label: ql ? 'Matches' : 'Free in the ' + rangeLabel(S.range), right: top.length + (ql ? (top.length === 1 ? ' match' : ' matches') : ''), rows: top }); }
        if (none.length) { groups.push({ label: 'Not free in this range', right: String(none.length), rows: none }); }
        return { groups: groups, empty: { t: 'No instructor matches “' + String(q || '').trim() + '”', s: 'Try a first name or initials, like KE.' } };
    };
    vm.insPick = function (key) {
        vm.S.ins = key ? parseInt(key, 10) || null : null;
        recompute();
    };
    vm.insClear = function () { vm.S.ins = null; recompute(); };
    vm.crsSource = function (q) {
        var S = vm.S, ql = String(q || '').trim().toLowerCase();
        var hits = vm.courses.filter(function (c) { return !ql || (c.title + ' ' + c.sub).toLowerCase().indexOf(ql) > -1; });
        var all = insList();
        var rows = hits.map(function (c) {
            var n = all.filter(function (i) { return teaches(c.id, i.id); }).length;
            return { key: String(c.id), lead: 'fa-graduation-cap', t: c.title, s: c.sub, r: String(n), rs: n === 1 ? 'instructor' : 'instructors', on: S.course === c.id };
        });
        var groups = [];
        if (!ql) { groups.push({ rows: [{ key: '', lead: 'fa-plane', t: 'Any course — just flying', s: 'Hire, a check flight or any lesson', on: !S.course, noHl: true }] }); }
        groups.push({ label: ql ? 'Matches' : 'Courses at the club', right: String(hits.length), rows: rows });
        return { groups: groups, empty: { t: 'No course matches “' + String(q || '').trim() + '”', s: 'Try PPL, night or IR.' } };
    };
    vm.crsPick = function (key) {
        var S = vm.S;
        S.course = key ? parseInt(key, 10) || null : null;
        if (S.ins && S.course && !teaches(S.course, S.ins) && I[S.ins]) {
            ToastService.warning('Instructor cleared', I[S.ins].first + ' doesn’t teach ' + (courseOf(S.course) ? courseOf(S.course).title : 'that course') + '.');
            S.ins = null;
        }
        recompute();
    };
    vm.crsClear = function () { vm.S.course = null; recompute(); };
    function setComboValues() {
        var S = vm.S, i = S.ins ? I[S.ins] : null, c = S.course ? courseOf(S.course) : null;
        vm.insValue = i ? { av: i.av, name: i.name } : null;
        vm.insSummary = i ? null : { b: String(vm.qualifiedN), post: vm.qualifiedN === 1 ? ' instructor' : ' instructors' };
        vm.crsValue = c ? { tag: c.title } : null;
        vm.crsSummary = c ? null : { b: String(vm.courses.length), post: vm.courses.length === 1 ? ' course' : ' courses' };
        vm.cbVer++;
    }

    /* ═════════ results: Grid | List (remembered per browser) ═════════ */
    function readView() {
        var v = null;
        try { v = $window.localStorage.getItem(VIEW_KEY); } catch (e) { v = null; }
        if (v === 'grid' || v === 'list') { return v; }
        var phone = $window.matchMedia && $window.matchMedia('(max-width: 768px)').matches;
        return phone ? DEFAULT_VIEW.phone : DEFAULT_VIEW.desk;
    }
    vm.view = vm.S.view;          // what shows: the member's view, or the grid when the club shows the grid only
    vm.setView = function (v) {
        if (vm.gridOnly) { return; }
        vm.S.view = vm.view = v;
        try { $window.localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    };

    /* ═════════ the booking sheet ═════════ */
    vm.open = function (x) {
        if (!x || x.kind !== 'free') { return; }
        if (vm.atLimit) { ToastService.warning('At the club’s limit', 'You’re at ' + clubName() + '’s limit of ' + vm.me.limit.max + ' upcoming bookings.'); return; }
        var S = vm.S, f = x.f, tk = typeNames(f.planes);
        var ins = S.ins && f.ins.indexOf(S.ins) > -1 ? S.ins : null;   // the instructor you searched for is pre-picked
        vm.dlg = { x: x, key: x.key, q: '', booked: false, busy: false, err: null,
            sel: { ins: ins, ac: (vm.pick && !ins && f.planes.length === 1) ? f.planes[0] : null, type: (S.type !== 'all' && tk.indexOf(S.type) > -1) ? S.type : (tk.length === 1 ? tk[0] : null) } };
        dlgRefresh();
    };
    vm.openFirst = function () { if (vm.first) { vm.open(vm.first); } };
    vm.close = function () {
        var booked = vm.dlg && vm.dlg.booked;
        vm.dlg = null;
        if (booked) { refreshQuietly(); }
    };
    vm.scrim = function (e) { if (e && e.target === e.currentTarget && !(vm.dlg && vm.dlg.busy)) { vm.close(); } };
    vm.selIns = function (id) { var d = vm.dlg; if (!d || d.booked) { return; } d.sel.ins = id || null; if (id) { d.sel.ac = null; } d.err = null; dlgRefresh(); };
    vm.selAc = function (id) { var d = vm.dlg; if (!d || d.booked) { return; } d.sel.ac = id; d.sel.type = P[id] ? P[id].plane_type : d.sel.type; d.err = null; dlgRefresh(); };
    vm.selType = function (t) { var d = vm.dlg; if (!d || d.booked) { return; } d.sel.type = t; d.err = null; dlgRefresh(); };
    vm.dlgQ = function () { dlgRefresh(); };
    function dlgRefresh() {
        var d = vm.dlg, x = d.x, f = x.f, sel = d.sel;
        var ii = f.ins.map(function (id) { return I[id]; }).filter(Boolean)
            .sort(function (a, b) { return ((a.mode === 'open' ? 0 : 1) - (b.mode === 'open' ? 0 : 1)) || (a.name < b.name ? -1 : 1); });
        var q = String(d.q || '').trim().toLowerCase();
        d.many = f.ins.length > 5;
        d.ins = (q ? ii.filter(function (i) { return i.name.toLowerCase().indexOf(q) > -1; }) : ii).map(function (i) {
            return { id: i.id, name: i.name, first: i.first, av: i.av, ap: i.mode !== 'open', club: i.mode === 'admin_approval',
                s: i.mode === 'admin_approval' ? 'The club confirms the request first' : i.mode !== 'open' ? 'Your booking is a request until ' + i.first + ' confirms it' : 'Books straight in' };
        });
        d.searching = !!q;
        d.insK = f.ins.length ? plural(f.ins.length, 'instructor') + ' free' : 'no instructor free — solo only';
        var si = sel.ins ? I[sel.ins] : null;
        d.approval = !!(si && si.mode !== 'open');
        d.byClub = !!(si && si.mode === 'admin_approval');
        d.insName = si ? si.first : '';
        d.pickMode = vm.pick && !sel.ins;
        d.planes = f.planes.map(function (id) { var p = P[id]; return { id: id, reg: p.registration, sub: (p.type_name ? p.type_name + ' · ' : '') + p.plane_type, colour: p.colour || 'var(--ta-brand-2)' }; });
        var types = {}, tl = [];
        f.planes.forEach(function (id) { var t = P[id].plane_type; if (!types[t]) { types[t] = { type: t, n: 0 }; tl.push(types[t]); } types[t].n++; });
        d.types = tl;
        d.typeHint = vm.pick && sel.ins ? 'With an instructor the club picks the aircraft of that type.' : 'You’ll see the registration once the club has assigned it — before the day.';
        d.ready = d.pickMode ? !!sel.ac : !!sel.type;
        var edgeP = sel.ac && P[sel.ac] ? P[sel.ac].colour : null;
        d.edge = edgeP || (si ? si.av.colour : 'var(--ta-brand-2)');
        d.title = F.fDayLong(x.date);
        d.shortDay = F.fDay(x.date);
        d.when = x.col.s + '–' + x.col.e;
        var w = dayWord(x.date);
        d.whenWord = (w === 'Today' || w === 'Tomorrow') ? w.toLowerCase() : F.fDay(x.date);
        d.course = vm.S.course && courseOf(vm.S.course) ? courseOf(vm.S.course).title : '';
        d.dbl = vm.S.dbl;
    }
    vm.book = function () {
        var d = vm.dlg; if (!d || d.busy || d.booked || !d.ready) { return; }
        var sel = d.sel, cell = d.x.cell;
        var planeId = d.pickMode ? sel.ac : (cell.picks && cell.picks[sel.type]);
        if (!planeId) { d.err = 'Pick an aircraft type first.'; return; }
        d.busy = true; d.err = null;
        var booking = { club_id: vm.S.club, user_id: vm.user.id, plane_id: planeId, instructor_id: sel.ins || 0, start: cell.slot_start, end: cell.slot_end,
            booked_by: vm.user.id, override: 0, course_id: vm.S.course || 0 };
        BookingService.Create(vm.user.id, booking).then(function (data) {
            d.busy = false;
            if (data && data.success) {
                var pending = !!(data.requires_approval || data.booking_status === 'pending_admin' || data.booking_status === 'pending_instructor') || d.approval;
                d.booked = true;
                d.done = { pending: pending, byClub: data.booking_status === 'pending_admin' || (!data.booking_status && d.byClub),
                    reg: d.pickMode && P[planeId] ? P[planeId].registration : null, type: P[planeId] ? P[planeId].plane_type : sel.type, colour: P[planeId] ? P[planeId].colour : null,
                    ins: sel.ins ? I[sel.ins] : null };
                ToastService.success(pending ? 'Request sent' : 'Booked', pending ? 'It holds the slot until it’s confirmed.' : 'It’s on the scheduler and in My bookings.', { confetti: false });
                // the slot turns to "Yours" at once; the quiet refetch on close brings the rest
                cell.mine = { booking_id: data.id || data.booking_id || 0, registration: d.pickMode && P[planeId] ? P[planeId].registration : (P[planeId] ? P[planeId].plane_type : ''),
                    instructor_first_name: sel.ins && I[sel.ins] ? I[sel.ins].first : null, status: pending ? 'pending' : 'confirmed' };
                if (vm.me && vm.me.limit) { vm.me.limit.used = (+vm.me.limit.used || 0) + 1; vm.me.limit.at_limit = !vm.me.limit.exempt && vm.me.limit.max > 0 && vm.me.limit.used >= vm.me.limit.max; }
                var keep = vm.dlg; recompute(); vm.dlg = keep;
                return;
            }
            ToastService.handledInline();
            if (data && data.reason === 'max_future_bookings') {
                if (vm.me && vm.me.limit) { vm.me.limit.at_limit = true; vm.me.limit.used = Math.max(+vm.me.limit.used || 0, +vm.me.limit.max || 0); }
                vm.limitMsg = data.message;
                vm.dlg = null;
                recompute();
                ToastService.warning('At the club’s limit', data.message || 'Cancel a booking to book another.');
                return;
            }
            d.err = (data && typeof data.message === 'string' && data.message) ? data.message : 'The booking didn’t go through — nothing was booked. Try again, or pick another slot.';
        });
    };

    /* ═════════ elsewhere ═════════ */
    vm.openScheduler = function () { $state.go('dashboard.scheduler_v2', { date: vm.S.from }); };
    vm.myBookings = function () { $state.go('dashboard.my_account.upcoming_bookings'); };
    /* ═════════ "Join the waiting list" — in the page: what will be requested, then POST waiting_requests ═════════ */
    vm.waitingList = function () {
        if (!vm.data || !WAITING_LIST) { return; }
        var S = vm.S, days = [];
        for (var i = 0; i < S.range; i++) { var d = F.addDays(S.from, i); if (d >= vm.today) { days.push({ date: d, word: dayWord(d), sub: F.fDay(d).slice(4), on: days.length < WAIT_MAX_DAYS }); } }
        var kind = (S.ins || S.course) ? 'dual' : (vm.me && vm.me.restricted ? 'solo' : 'hire');
        vm.wl = { days: days, capped: days.length > WAIT_MAX_DAYS, kind: kind, notice: '60', busy: false, done: null,
            kinds: WaitingRequestsService.enums.kinds, notices: WaitingRequestsService.enums.notices };
        wlRefresh();
    };
    function wlRefresh() {
        var w = vm.wl, S = vm.S;
        w.n = w.days.filter(function (d) { return d.on; }).length;
        w.full = w.n >= WAIT_MAX_DAYS;
        w.type = S.type !== 'all' ? S.type : '';
        w.ins = (w.kind === 'dual' && S.ins && I[S.ins]) ? I[S.ins] : null;
        w.courseId = S.course && courseOf(S.course) ? courseOf(S.course).id : null;
        w.course = w.courseId ? courseOf(S.course).title : '';
        w.dbl = !!S.dbl;                                   // a double-slot search asks for two slots back to back
        var on = w.days.filter(function (d) { return d.on; });
        w.span = on.length ? (on.length === 1 ? F.fDay(on[0].date) : F.fDay(on[0].date) + ' – ' + F.fDay(on[on.length - 1].date)) : '';
    }
    vm.wlDay = function (d) { if (!vm.wl || vm.wl.busy || vm.wl.done) { return; } if (!d.on && vm.wl.full) { ToastService.warning('Up to ' + WAIT_MAX_DAYS + ' days', 'A waiting-list request takes up to ' + WAIT_MAX_DAYS + ' days — untick one first.'); return; } d.on = !d.on; wlRefresh(); };
    vm.wlKind = function (k) { if (!vm.wl || vm.wl.busy || vm.wl.done) { return; } vm.wl.kind = k; wlRefresh(); };
    vm.wlNotice = function (n) { if (!vm.wl || vm.wl.busy || vm.wl.done) { return; } vm.wl.notice = n; };
    vm.wlClose = function () { if (vm.wl && vm.wl.busy) { return; } vm.wl = null; };
    vm.wlScrim = function (e) { if (e && e.target === e.currentTarget) { vm.wlClose(); } };
    vm.wlSend = function () {
        var w = vm.wl; if (!w || w.busy || w.done || !w.n) { return; }
        var body = { club_id: vm.S.club, kind: w.kind, plane_type: w.type || null, plane_id: null,
            instructor_id: w.ins ? w.ins.id : null, notice: w.notice, notes: '',
            course_id: w.courseId || null, slots_needed: w.dbl ? 2 : 1,
            dates: w.days.filter(function (d) { return d.on; }).map(function (d) { return { date: d.date, preference: 'any' }; }) };
        w.busy = true;
        WaitingRequestsService.Create(body).then(function (data) {
            w.busy = false;
            if (data && data.success) {
                w.done = { span: w.span, n: w.n };
                ToastService.success('On the waiting list', 'We’ll call you if a matching slot comes up.', { confetti: false });
                return;
            }
            ToastService.handledInline();
            var m = data && data.message;
            if (m && typeof m === 'object') { m = m.message; }
            ToastService.error('Not added to the waiting list', (typeof m === 'string' && m && !/^\s*</.test(m)) ? m : 'The request could not be saved — nothing was sent. Try again in a moment.');
        });
    };

    /* Esc closes the sheet (an open <ta-combo> handles its own Esc first) */
    function onKey(e) {
        if (!(e.key === 'Escape' || e.keyCode === 27) || document.querySelector('.ta-combo--open, .tadp-pop:not([hidden])')) { return; }
        if (vm.wl && !vm.wl.busy) { $scope.$apply(function () { vm.wlClose(); }); return; }
        if (vm.dlg && !vm.dlg.busy) { $scope.$apply(function () { vm.close(); }); }
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); seq++; if (longTimer) { $timeout.cancel(longTimer); } });

    fromWords();
    init();
}
