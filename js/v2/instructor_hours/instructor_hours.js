/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · Hours instructed
   Design: mockups/instructor-dashboard/hours-instructed.html (approved 9 Nov 2026).
   Replaces v1 dashboard.manage_user.instructed_hours (views/manageuser/instructed_hours.html, InstructedHoursController +
   InstructorHoursService → GET instructor_hours?from&to) behind the v2 switch. Tracker: mockups/v2-build/fe-instructor-hours.md.

   State: dashboard.v2.instructor_hours  /manage_user/instructed_hours  ← dashboard.manage_user.instructed_hours

   Data (be-alex-3e.md contract C41, landed 9 Nov 21:38), one read per view:
     GET instructor_hours/v2/summary?from&to&club_id&student_id&plane_id&include_solo=1&todo=0&page=1&per_page=60
       → {success, from, to, range_capped, include_solo, todo, club_id, student_id, plane_id,
          totals{hours, dual_hours, solo_hours, flights, dual_flights, solo_flights, landings, students, records_to_file,
                 records_to_confirm},
          presets[{id, from, to, flights, solo_flights}], months[{key, dual_hours, solo_hours, hours, flights, first_index}],
          clubs[{id, title, flights}], facets{students[{id, name, flights, hours, clubs[{id, title}], club_title|null}],
          aircraft[{plane_id, registration, type, model, colour, flights, hours}]},
          flights[v1 row + plane_id, aircraft_colour, aircraft_type, aircraft_model, to_file], page, per_page, total}
     record_status: recorded | awaiting_confirmation | missing | import_note | student_unknown (a record is needed, the
     student isn't identified) | not_required | no_student (no record needed).
     Totals, months and flights follow the range, the solo switch, the club and the search (student / aircraft); the range
     chips count every flight of yours in their own range; todo=1 narrows only the list (and total / paging).

   Leaving for the replay, the training record or the debrief ("Fill in record", ?from=instructed_hours) remembers the view
   and the flight in sessionStorage (v1's keys, a superset of v1's shape, so both designs read them):
     toaviate_ih_view   {preset, from, to, include_solo, filter_club, only_todo, find, find_info, page, at}
     toaviate_ih_focus  {id, at, page}
   The debrief's Back / Save go to dashboard.manage_user.instructed_hours with no params; DesignRoutes lands them here, and
   this page puts back the same range and filters, loads the same pages, scrolls to that flight and flashes it once (when
   under 30 minutes old), then forgets the marker.

   Here: HoursV2Data (the read, and one helper per domain: range chips, record state, flight kind, words) · hrs-count
   (a tile's number counting to its value) · InstructorHoursV2Controller.
   Views: views/v2/instructor_hours/hours.html · CSS: css/v2/instructor-hours.css (hrs-).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_hours', {
        url: '/manage_user/instructed_hours',
        templateUrl: 'views/v2/instructor_hours/hours.html',
        controller: 'InstructorHoursV2Controller',
        controllerAs: 'vm'
    });
    DesignRoutesProvider.map('dashboard.manage_user.instructed_hours', 'dashboard.v2.instructor_hours');
}]);


/* ═════ HoursV2Data: the read, and one helper per domain (raw values never reach the screen) ═════ */
app.factory('HoursV2Data', HoursV2Data);
HoursV2Data.$inject = ['InsCore'];
function HoursV2Data(InsCore) {
    var I = InsCore;
    var PER_PAGE = 60, PER_PAGE_MAX = 200;
    var KIND = {
        dual: { label: 'Dual', long: 'Dual — you were aboard', ic: 'fa-user-friends' },
        solo: { label: 'Supervised solo', long: 'Supervised solo — you authorised it from the ground, not aboard', ic: 'fa-user' }
    };

    return {
        PER_PAGE: PER_PAGE,
        PER_PAGE_MAX: PER_PAGE_MAX,
        summary: summary,
        ok: ok,
        presets: presets,
        fRange: fRange,
        plural: plural,
        num: num,
        kind: kind,
        canOpen: canOpen,
        rec: rec,
        decorate: decorate,
        monthLabel: monthLabel,
        colour: colour
    };

    function summary(params) { return I.get('instructor_hours/v2/summary', params); }
    function ok(res) { return !!res && res.success !== false && !!res.totals; }
    function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
    /* '2,103 landings' (the mockup writes thousands with a comma) */
    function plural(n, one, many) { n = +n || 0; return n.toLocaleString('en-GB') + ' ' + (n === 1 ? one : (many || one + 's')); }
    function monthLabel(key) { var p = String(key || '').split('-'); return p.length === 2 ? I.MONTH[+p[1] - 1] + ' ' + p[0] : String(key || ''); }
    /* an aircraft colour from the server, or '' (it only ever reaches a CSS custom property) */
    function colour(c) { c = String(c || '').trim(); return /^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl)a?\([\d\s.,%]+\)$/i.test(c) ? c : ''; }

    /* '7 Oct – 6 Nov 2026' · '1 Dec 2025 – 6 Jan 2026' */
    function fRange(a, b) {
        if (!a || !b) { return ''; }
        var da = I.pd(a), db = I.pd(b);
        return da.getFullYear() === db.getFullYear()
            ? da.getDate() + ' ' + I.MON[da.getMonth()] + ' – ' + db.getDate() + ' ' + I.MON[db.getMonth()] + ' ' + db.getFullYear()
            : I.fDate(a) + ' – ' + I.fDate(b);
    }

    /* the range chips, in the page's order: today's ranges (v1's presets), then the server's own ranges and counts (UK day) */
    function presets(today, server) {
        var t = I.pd(today), y = t.getFullYear(), m = t.getMonth();
        function month(back) { var a = new Date(y, m - back, 1), b = new Date(y, m - back + 1, 0); return { from: I.ymd(a), to: I.ymd(b) }; }
        var m0 = month(0), m1 = month(1), m2 = month(2);
        var list = [
            { id: 'last30', from: I.addDays(today, -30), to: today },
            { id: 'last90', from: I.addDays(today, -90), to: today },
            { id: 'month', from: m0.from, to: m0.to },
            { id: 'month-1', from: m1.from, to: m1.to },
            { id: 'month-2', from: m2.from, to: m2.to },
            { id: 'year', from: y + '-01-01', to: today },
            { id: 'year-1', from: (y - 1) + '-01-01', to: (y - 1) + '-12-31' }
        ];
        var by = {};
        (server || []).forEach(function (p) { if (p && p.id) { by[p.id] = p; } });
        list.forEach(function (p) {
            var s = by[p.id];
            if (s) { p.from = s.from || p.from; p.to = s.to || p.to; p.flights = +s.flights || 0; p.solo = +s.solo_flights || 0; p.has = true; }
            else { p.flights = 0; p.solo = 0; p.has = false; }
            p.label = p.id === 'last30' ? 'Last 30 days' : p.id === 'last90' ? 'Last 90 days' : p.id === 'year' ? 'This year'
                : p.id === 'year-1' ? String(p.from).slice(0, 4) : I.MONTH[+String(p.from).slice(5, 7) - 1];
        });
        return list;
    }

    function kind(k) { return KIND[k] || KIND.dual; }
    function canOpen(f) { return !!(f && f.training_record_id && f.course_id && (f.record_user_id || f.student_id)); }
    /* the training-record state (record_status), as the mockup's recInfo. C41's student_unknown (a record is needed but the
       student isn't identified, the Debriefs list's word) is filled in from the debrief too; no_student needs no record. */
    function rec(f) {
        switch (f.record_status) {
            case 'recorded': return { tone: 'good', ic: 'fa-clipboard-check', label: 'Record filed', why: canOpen(f) ? 'Filed. Open it on Student records to read or change it.' : 'Filed, but the record has no course, so it can’t be opened from here.' };
            case 'awaiting_confirmation': return { tone: 'warn', ic: 'fa-user-check', label: 'Confirm the record', todo: true, act: 'Confirm record', go: 'open', why: 'The club entered this record for you. Check it and confirm it.' };
            case 'missing': return { tone: 'warn', ic: 'fa-pen', label: 'Record to fill in', todo: true, act: 'Fill in record', go: 'fill', why: 'No training record yet. Debrief this flight; saving brings you back here.' };
            case 'import_note': return { tone: 'warn', ic: 'fa-pen', label: 'Record to fill in', tag: 'import note', todo: true, act: 'Fill in record', go: 'fill', why: 'Only the TPC import note so far: nobody has debriefed this flight. Filing the record replaces the note.' };
            case 'student_unknown': return { tone: 'warn', ic: 'fa-pen', label: 'Record to fill in', todo: true, act: 'Fill in record', go: 'fill', why: 'No student is named on this flight yet. Debrief it and say who flew; saving brings you back here.' };
            case 'not_required': return { tone: 'muted', ic: 'fa-minus-circle', label: 'Not required', why: 'Marked as not needing a training record.' };
            default: return { tone: 'muted', ic: 'fa-user-slash', label: 'No student', why: 'Nobody else was on this flight, so there is no training record.' };
        }
    }
    /* one flight row → everything the template shows, worked out once (underscore keys are never sent anywhere) */
    function decorate(f) {
        f.hours = num(f.hours);
        f.landings = +f.landings || 0;
        f._k = kind(f.kind);
        f._kind = f.kind === 'solo' ? 'solo' : 'dual';
        f._r = rec(f);
        f._open = canOpen(f);
        f._good = !f._r.todo && f._r.tone === 'good' && f._open;
        f._day = I.fDay(f.flight_date);
        f._dayLong = I.fDayLong(f.flight_date);
        f._off = String(f.brakes_off || '').slice(0, 5);
        f._on = String(f.brakes_on || '').slice(0, 5);
        f._hm = I.hm(f.hours);
        f._type = f.aircraft_type || '';
        f._model = f.aircraft_model || '';
        f._edge = colour(f.aircraft_colour) || 'var(--ta-line)';
        f._who = f.student_name || 'No student';
        f._tail = f.lesson_title ? ' · ' + f.lesson_title : '';
        f._mk = String(f.flight_date || '').slice(0, 7);
        f._ldg = f.landings === 1 ? 'landing' : 'landings';
        return f;
    }
}


/* ═════ hrs-count="vm.tot.hours" hrs-fmt="hm" — a tile's number counts from what it showed to its new value (~0.5 s, eased);
   reduced motion sets it at once ═════ */
app.directive('hrsCount', ['$window', function ($window) {
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    function hm(h) { var m = Math.round((+h || 0) * 60); return Math.floor(m / 60) + ':' + p2(m % 60); }
    function whole(n) { return Math.round(+n || 0).toLocaleString('en-GB'); }
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var el = element[0], fmt = attrs.hrsFmt === 'hm' ? hm : whole, shown = 0, raf = null;
            function paint(v) { el.textContent = fmt(v); }
            function stop() { if (raf && $window.cancelAnimationFrame) { $window.cancelAnimationFrame(raf); } raf = null; }
            paint(0);
            scope.$watch(attrs.hrsCount, function (v) {
                v = +v || 0;
                stop();
                if (v === shown || (reduce && reduce.matches) || !$window.requestAnimationFrame) { shown = v; paint(v); return; }
                var from = shown, t0 = null, dur = 520;
                function step(ts) {
                    if (t0 === null) { t0 = ts; }
                    var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
                    shown = k < 1 ? from + (v - from) * e : v;
                    paint(shown);
                    raf = k < 1 ? $window.requestAnimationFrame(step) : null;
                }
                raf = $window.requestAnimationFrame(step);
            });
            scope.$on('$destroy', stop);
        }
    };
}]);


/* ═════ InstructorHoursV2Controller ═════ */
app.controller('InstructorHoursV2Controller', InstructorHoursV2Controller);
InstructorHoursV2Controller.$inject = ['$scope', '$state', '$timeout', '$q', '$document', '$window', 'InsCore', 'HoursV2Data', 'TaComboMatch', 'ToastService'];
function InstructorHoursV2Controller($scope, $state, $timeout, $q, $document, $window, InsCore, HoursV2Data, TaComboMatch, ToastService) {
    var vm = this, D = HoursV2Data, M = TaComboMatch;
    var VIEW_KEY = 'toaviate_ih_view', FOCUS_KEY = 'toaviate_ih_focus', FRESH_MS = 30 * 60 * 1000;
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var seq = 0, dimTimer = null, skelTimer = null, flashTimer = null;

    vm.today = InsCore.today();
    vm.st = 'loading';            // loading (skeleton) | ready | error
    vm.S = { preset: 'last30', from: null, to: null, solo: true, club: null, todo: false, find: null };   // find: 's:<student id>' | 'a:<plane id>'
    vm.findInfo = null;           // { kind: 's' | 'a', id, name | reg, type, model, colour, text: 'with …' | 'in …' }
    vm.findValue = null;          // what <ta-combo> shows when closed (a stable object)
    vm.cbQ = '';
    vm.cbVer = 0;
    vm.custom = { from: null, to: null, err: null };
    vm.pickerOpts = { max: vm.today, shortcuts: false };   // a past range: no days after today, no forward shortcuts (Tomorrow, Next week)
    vm.presets = D.presets(vm.today, null);
    vm.data = null;               // the last answer: { totals, months, clubs, facets, solo }
    vm.tot = null;
    vm.clubs = [];
    vm.months = [];
    vm.rows = [];                 // the flights loaded so far, in the server's order
    vm.groups = [];               // the rows by month (each with its subtotal)
    vm.total = 0;
    vm.gen = 0;                   // bumped on every fresh answer, so rows and months rise in again
    vm.openId = null;
    vm.flashId = null;
    vm.dim = false;               // a filter is being applied: the content dims until the answer
    vm.moreBusy = null;           // 'more' | 'all' while more rows load
    vm.skelTiles = [0, 1, 2, 3, 4];
    vm.skelRows = [0, 1, 2, 3, 4];

    vm.usePreset = usePreset;
    vm.customShow = customShow;
    vm.customFixed = function (k) { if (vm.custom.err && vm.custom.err[k]) { vm.custom.err[k] = null; } };
    vm.setClub = setClub;
    vm.setSolo = function () { load('filter'); };
    vm.setTodo = setTodo;
    vm.findSource = findSource;
    vm.findPick = findPick;
    vm.findClear = findClear;
    vm.toggle = function (f) { vm.openId = vm.openId === f.id ? null : f.id; };
    vm.jump = jump;
    vm.more = more;
    vm.retry = function () { load('first'); };
    vm.track = track;
    vm.openRec = openRec;
    vm.fill = fill;
    vm.act = function (f, ev) { stopEv(ev); if (f._r.go === 'open') { openRec(f); } else { fill(f); } };
    /* Enter / Space on the row's inner buttons (role=button spans inside the row's own button, as the design draws them) */
    vm.key = function (ev, f, what) {
        if (ev.keyCode !== 13 && ev.keyCode !== 32) { return; }
        ev.preventDefault(); ev.stopPropagation();
        vm[what](f);
    };

    phPlaceholder();
    if (phoneMq && phoneMq.addListener) { phoneMq.addListener(onMq); }
    restore();

    /* ════════ the read ════════ */
    function query(page, perPage) {
        var S = vm.S, f = S.find || '';
        return {
            from: S.from, to: S.to, include_solo: S.solo ? 1 : 0, todo: S.todo ? 1 : 0, club_id: S.club || null,
            student_id: f.indexOf('s:') === 0 ? f.slice(2) : null, plane_id: f.indexOf('a:') === 0 ? f.slice(2) : null,
            page: page || 1, per_page: perPage || D.PER_PAGE
        };
    }
    /* how: 'first' → the skeleton at once; 'range' → dim, then the skeleton if the answer takes a moment; 'filter' → dim.
       The latest request wins. after(): once the new view is on screen. */
    function load(how, after) {
        var my = ++seq;
        vm.openId = null;
        vm.moreBusy = null;
        vm.rangeText = D.fRange(vm.S.from, vm.S.to);
        saveView(1);
        busy(how);
        return D.summary(query(1)).then(function (res) {
            if (my !== seq) { return; }
            if (!D.ok(res)) { idle(); vm.st = 'error'; return; }
            // a club without flights in this range is dropped (the mockup's load()); a "Records to file" filter with
            // nothing left to file goes back to every flight (v1)
            if (vm.S.club && !(res.clubs || []).some(function (c) { return +c.id === vm.S.club; })) { vm.S.club = null; load(how, after); return; }
            if (vm.S.todo && !todoOf(res.totals)) { vm.S.todo = false; load(how, after); return; }
            take(res);
            idle();
            vm.st = 'ready';
            saveView();
            chipInView();
            if (res.range_capped) { ToastService.warning('Range shortened', 'Hours go back five years at most, so this shows ' + vm.rangeText + '.'); }
            if (after) { after(); }
        });
    }
    function busy(how) {
        cancelTimers();
        if (how === 'first' || vm.st !== 'ready') { vm.st = 'loading'; vm.dim = false; return; }
        dimTimer = $timeout(function () { vm.dim = true; }, 90);
        if (how === 'range') { skelTimer = $timeout(function () { vm.st = 'loading'; vm.dim = false; }, 380); }
    }
    function idle() { cancelTimers(); vm.dim = false; }
    function cancelTimers() {
        if (dimTimer) { $timeout.cancel(dimTimer); dimTimer = null; }
        if (skelTimer) { $timeout.cancel(skelTimer); skelTimer = null; }
    }
    function todoOf(t) { return t ? (+t.records_to_file || 0) + (+t.records_to_confirm || 0) : 0; }

    /* a fresh answer: totals, chips, months, clubs, the first page of flights */
    function take(res) {
        vm.gen++;
        vm.S.from = res.from || vm.S.from;
        vm.S.to = res.to || vm.S.to;
        vm.rangeText = D.fRange(vm.S.from, vm.S.to);
        vm.presets = D.presets(vm.today, res.presets);
        vm.none = vm.presets.every(function (p) { return p.has && !p.flights; });
        vm.data = { totals: res.totals, months: res.months || [], clubs: res.clubs || [], facets: res.facets || { students: [], aircraft: [] }, solo: res.include_solo !== false };
        vm.tot = res.totals;
        vm.clubs = vm.data.clubs.length > 1 ? vm.data.clubs : [];
        vm.total = +res.total || 0;
        vm.rows = [];
        append(res.flights || [], 0);
        words();
        months();
        groups();
        setValue();
        vm.cbVer++;
    }
    function append(list, offset) {
        var seen = {}, n = 0, have = vm.rows.length;
        vm.rows.forEach(function (f) { seen[f.id] = 1; });
        list.forEach(function (f, i) {
            if (offset + i < have || seen[f.id]) { return; }
            seen[f.id] = 1;
            D.decorate(f);
            f._i = n++;                 // the rise-in stagger, counted from the first new row
            vm.rows.push(f);
        });
    }
    function pagesLoaded() { return Math.max(1, Math.ceil(vm.rows.length / D.PER_PAGE)); }

    /* the tiles' lines and the empty state's words */
    function words() {
        var t = vm.tot, fi = vm.findInfo, who = fi ? ' ' + fi.text : '';
        var nclubs = vm.S.club || (fi && fi.kind === 'a') ? 1 : vm.data.clubs.filter(function (c) { return +c.flights > 0; }).length;
        vm.todoN = todoOf(t);
        vm.tiles = {
            hours: D.plural(t.flights, 'flight') + ' · ' + D.plural(t.landings, 'landing') + who,
            dual: D.plural(t.dual_flights, 'flight') + ' · you were aboard',
            solo: D.plural(t.solo_flights, 'flight') + ' · authorised, not aboard',
            students: fi && fi.kind === 's' ? 'just ' + fi.name + ' — clear the search for everyone' : 'taught or supervised' + (nclubs > 1 ? ', across ' + nclubs + ' clubs' : ''),
            todo: D.plural(vm.todoN, 'flight') + ' still need a record from you'
        };
        vm.empty = {
            h: fi ? 'Nothing ' + fi.text + ' in this range' : 'Nothing instructed in this range',
            p: fi ? 'Try a longer range, or clear the search to see every flight.'
                : vm.none ? 'Flights appear here once they are booked in with you as the instructor, and solos once you authorise them.'
                : 'Flights appear here once they are booked in with you as the instructor. Try a longer range.'
        };
        vm.totalText = (+vm.total || 0).toLocaleString('en-GB');
    }
    /* By month: one row per month, the bar scaled to the busiest month, the split written out */
    function months() {
        var solo = vm.data.solo, ms = vm.data.months;
        var max = Math.max.apply(null, ms.map(function (m) { return D.num(m.dual_hours) + (solo ? D.num(m.solo_hours) : 0); }).concat([0])) || 1;
        vm.months = ms.map(function (m) {
            var dual = D.num(m.dual_hours), sh = solo ? D.num(m.solo_hours) : 0, tot = dual + sh, n = +m.flights || 0, label = D.monthLabel(m.key);
            return {
                key: m.key, label: label, hm: InsCore.hm(tot), first: m.first_index == null ? null : +m.first_index,
                segD: dual ? (dual / max * 100).toFixed(1) + '%' : null,
                segS: sh ? (sh / max * 100).toFixed(1) + '%' : null,
                sub: InsCore.hm(dual) + ' dual' + (solo ? ' · ' + InsCore.hm(sh) + ' solo' : '') + ' · ' + D.plural(n, 'flight'),
                tip: label + ': ' + InsCore.hm(tot) + ' — ' + InsCore.hm(dual) + ' dual' + (solo ? ', ' + InsCore.hm(sh) + ' supervised solo' : '') + ', ' + D.plural(n, 'flight')
            };
        });
    }
    /* the list's month headers with their subtotal. Every flight: the server's month. "Records to file": the month's count
       from first_index, its hours once all its rows are here. */
    function groups() {
        var by = {}, listed = {}, out = [], cur = null;
        vm.data.months.forEach(function (m) { by[m.key] = m; });
        var firsts = vm.data.months.filter(function (m) { return m.first_index != null; }).sort(function (a, b) { return a.first_index - b.first_index; });
        firsts.forEach(function (m, i) { listed[m.key] = (i + 1 < firsts.length ? +firsts[i + 1].first_index : vm.total) - (+m.first_index); });
        vm.rows.forEach(function (f) {
            if (!cur || cur.key !== f._mk) { cur = { key: f._mk, label: D.monthLabel(f._mk), rows: [], i: f._i }; out.push(cur); }
            cur.rows.push(f);
        });
        out.forEach(function (g) {
            var m = by[g.key];
            if (!vm.S.todo && m) { g.sub = InsCore.hm(D.num(m.hours)) + ' · ' + D.plural(+m.flights || 0, 'flight'); return; }
            var n = listed[g.key] != null ? listed[g.key] : g.rows.length;
            var h = g.rows.length >= n ? g.rows.reduce(function (a, f) { return a + f.hours; }, 0) : null;
            g.sub = (h !== null ? InsCore.hm(h) + ' · ' : '') + D.plural(n, 'flight');
        });
        vm.groups = out;
        vm.nextN = Math.min(D.PER_PAGE, vm.total - vm.rows.length);
    }

    /* rows [loaded, want) of the current view: pages of 60, or of 200 for a long stretch; in parallel, kept in order.
       → true, false (a read failed) or null (the view changed meanwhile) */
    function fetchTo(want) {
        var have = vm.rows.length, my = seq;
        want = Math.min(want, vm.total);
        if (want <= have) { return $q.when(true); }
        var per = want - have > 4 * D.PER_PAGE ? D.PER_PAGE_MAX : D.PER_PAGE;
        var first = Math.floor(have / per) + 1, last = Math.ceil(want / per), calls = [];
        for (var p = first; p <= last; p++) { calls.push(D.summary(query(p, per))); }
        return $q.all(calls).then(function (res) {
            if (my !== seq) { return null; }
            if (!res.every(D.ok)) { return false; }
            res.forEach(function (r) {
                var off = ((+r.page || 1) - 1) * per;
                append((r.flights || []).slice(0, Math.max(0, want - off)), off);
            });
            groups();
            return true;
        });
    }
    function more(all) {
        if (vm.moreBusy || vm.rows.length >= vm.total) { return; }
        vm.moreBusy = all ? 'all' : 'more';
        fetchTo(all ? vm.total : vm.rows.length + D.PER_PAGE).then(function (done) {
            if (done === null) { return; }
            vm.moreBusy = null;
            if (done === false) { ToastService.error('Not loaded', 'More flights couldn’t be loaded. Please try again.'); return; }
            saveView();
        });
    }
    /* By month → its flights: load the pages up to that month, then bring its header into view */
    function jump(m) {
        var key = m.key, first = m.first;
        if (first === null) {
            // nothing of that month in this list ("Records to file"): the next older month that has some
            var later = vm.months.filter(function (x) { return x.key < key && x.first !== null; })[0];
            if (!later) { return; }
            key = later.key; first = later.first;
        }
        function go() {
            $timeout(function () {
                var el = document.getElementById('hrs-m-' + key);
                if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: reduce && reduce.matches ? 'auto' : 'smooth' }); }
            }, 40, false);
        }
        if (first < vm.rows.length) { go(); return; }
        if (vm.moreBusy) { return; }
        vm.moreBusy = 'more';
        fetchTo(Math.ceil((first + 1) / D.PER_PAGE) * D.PER_PAGE).then(function (done) {
            if (done === null) { return; }
            vm.moreBusy = null;
            if (done === false) { ToastService.error('Not loaded', 'That month’s flights couldn’t be loaded. Please try again.'); return; }
            saveView();
            go();
        });
    }

    /* ════════ range · custom dates · club · solo · records to file ════════ */
    function presetOf(id) { return vm.presets.filter(function (p) { return p.id === id; })[0] || null; }
    function usePreset(id) {
        vm.custom.err = null;
        if (id === 'custom') {
            if (vm.S.preset !== 'custom') { vm.S.preset = 'custom'; vm.custom.from = vm.S.from; vm.custom.to = vm.S.to; saveView(); chipInView(); }
            return;
        }
        var p = presetOf(id);
        if (!p) { return; }
        if (vm.S.preset === id && vm.S.from === p.from && vm.S.to === p.to && vm.st === 'ready') { return; }
        vm.S.preset = id; vm.S.from = p.from; vm.S.to = p.to;
        chipInView();
        load('range');
    }
    function customShow() {
        var c = vm.custom;
        if (!c.from || !c.to) { c.err = { from: !c.from ? 'Pick a from date' : null, to: !c.to ? 'Pick a to date' : null }; return; }
        if (c.from > c.to) { c.err = { from: 'The from date is after the to date' }; return; }
        c.err = null;
        vm.S.from = c.from; vm.S.to = c.to;
        load('range');
    }
    function setClub(id) {
        id = +id || null;
        if (vm.S.club === id) { return; }
        vm.S.club = id;
        load('filter');
    }
    function setTodo(on) {
        if (vm.S.todo === !!on) { return; }
        vm.S.todo = !!on;
        load('filter');
    }
    /* phones: the chip rows scroll sideways, so keep the chosen range in view (the mockup's keepChipInView) */
    function chipInView() {
        $timeout(function () {
            var on = document.querySelector('.hrs-tools .ta-chip--on'), row = on && on.parentElement;
            if (!row || row.scrollWidth <= row.clientWidth) { return; }
            var r = row.getBoundingClientRect(), c = on.getBoundingClientRect();
            if (c.left < r.left || c.right > r.right) {
                var left = row.scrollLeft + c.left - r.left - 12;
                if (row.scrollTo && !(reduce && reduce.matches)) { row.scrollTo({ left: left, behavior: 'smooth' }); } else { row.scrollLeft = left; }
            }
        }, 0, false);
    }

    /* ════════ the search over the range's students and aircraft (the shared <ta-combo>, js/v2/logbook/logbook.js) ════════ */
    function onMq() { $scope.$applyAsync(phPlaceholder); }
    function phPlaceholder() { vm.findPh = phoneMq && phoneMq.matches ? 'Student or aircraft' : 'Find a student or aircraft — BA finds G-SHBA'; }
    function findSource(q) {
        q = String(q || '').trim();
        var t = M.toks(q), F = (vm.data && vm.data.facets) || {}, sl = F.students || [], al = F.aircraft || [];
        var multi = !!(vm.data && vm.data.clubs.length > 1);
        /* a student is the grey member icon (initials mean an instructor, app-wide); only the name is underlined, as the design
           does (noHlSub), while an aircraft's model is. A first name beats a surname: PRI finds Priya Shah before Callum Price */
        function sSc(s) {
            if (!t.length) { return 1; }
            var sc = 0;
            for (var i = 0; i < t.length; i++) { if (!M.wordHit(s.name, t[i])) { return 0; } sc += M.norm(s.name).indexOf(t[i]) === 0 ? 2 : 1; }
            return sc;
        }
        /* the end of a registration first: BA finds G-SHBA ahead of G-BABK */
        function aSc(a) {
            if (!t.length) { return 1; }
            var sc = 0;
            for (var i = 0; i < t.length; i++) {
                var v = M.regScore(a.registration, t[i]) || (M.wordHit((a.type || '') + ' ' + (a.model || ''), t[i]) ? 40 : 0);
                if (!v) { return 0; }
                sc += v;
            }
            return sc;
        }
        var sHits = sl.filter(sSc).sort(function (a, b) { return sSc(b) - sSc(a) || D.num(b.hours) - D.num(a.hours) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
        var aHits = al.filter(aSc).sort(function (a, b) { return aSc(b) - aSc(a) || (+b.flights || 0) - (+a.flights || 0); });
        var gS = {
            label: q ? 'Students' : 'Your students in this range',
            right: q ? D.plural(sHits.length, 'match', 'matches') : (sl.length > 8 ? 'top 8 of ' + sl.length + ' · type a name' : D.plural(sl.length, 'student')),
            rows: (q ? sHits : sHits.slice(0, 8)).map(function (s) {
                var sub = D.plural(+s.flights || 0, 'flight');
                return { key: 's:' + s.id, av: { member: true, title: s.name }, t: s.name, s: multi ? sub + clubWords(s, sub) : sub, noHlSub: true, r: InsCore.hm(s.hours), rs: 'in this range', on: vm.S.find === 's:' + s.id };
            })
        };
        var gA = {
            label: 'Aircraft',
            right: D.plural(aHits.length, 'aircraft', 'aircraft'),
            rows: aHits.map(function (a) { return { key: 'a:' + a.plane_id, ac: D.colour(a.colour) || undefined, t: a.registration, s: a.model || '', r: InsCore.hm(a.hours), rs: D.plural(+a.flights || 0, 'flight'), on: vm.S.find === 'a:' + a.plane_id }; })
        };
        /* one or two letters are nearly always the end of a registration: the aircraft first */
        var n = M.norm(q).length;
        var list = n > 0 && n < 3 && aHits.some(function (a) { return aSc(a) >= 90; }) ? [gA, gS] : [gS, gA];
        if (!q && vm.S.find) { list.unshift({ rows: [{ key: 'all', lead: 'fa-list', t: 'Every student and aircraft', s: 'Clear the search', on: false }] }); }
        return {
            groups: list,
            empty: q ? { t: 'Nobody and nothing matches “' + q + '”', s: 'Try a student’s first name, or the last two letters of a registration.' }
                : { t: 'No students or aircraft in this range', s: 'Try a longer range.' }
        };
    }
    /* a student's club(s) on their search row, when you teach at 2+ clubs (C41 facets: club_title = the one club, else null
       with clubs[] in club-id order): ' · The Pilot Centre', ' · The Pilot Centre · Westfield Flying Club' when that fits a
       phone's line (about 34 characters with the flight count), else ' · The Pilot Centre + 1 club' */
    function clubWords(s, lead) {
        if (s.club_title) { return ' · ' + s.club_title; }
        var titles = (s.clubs || []).map(function (c) { return c && c.title; }).filter(Boolean);
        if (!titles.length) { return ''; }
        var all = ' · ' + titles.join(' · ');
        if (titles.length === 1 || (lead + all).length <= 34) { return all; }
        return ' · ' + titles[0] + ' + ' + D.plural(titles.length - 1, 'club');
    }
    function findPick(key) {
        if (key === 'all') { findClear(); return; }
        if (key === vm.S.find) { return; }
        var F = (vm.data && vm.data.facets) || {}, id = +String(key).slice(2), info = null;
        if (String(key).indexOf('s:') === 0) {
            var s = (F.students || []).filter(function (x) { return +x.id === id; })[0];
            if (s) { info = { kind: 's', id: id, name: s.name, text: 'with ' + s.name }; }
        } else {
            var a = (F.aircraft || []).filter(function (x) { return +x.plane_id === id; })[0];
            if (a) { info = { kind: 'a', id: id, reg: a.registration, type: a.type || '', model: a.model || '', colour: D.colour(a.colour), text: 'in ' + a.registration }; }
        }
        if (!info) { return; }
        vm.S.find = key; vm.findInfo = info; vm.cbQ = '';
        setValue();
        load('filter');
    }
    function findClear() {
        vm.cbQ = '';
        if (!vm.S.find) { return; }
        vm.S.find = null; vm.findInfo = null;
        setValue();
        load('filter');
    }
    function setValue() {
        var fi = vm.findInfo, v = null;
        if (fi && fi.kind === 'a') { v = { ac: { reg: fi.reg, type: fi.type, colour: D.colour(fi.colour), title: fi.reg + (fi.model ? ' · ' + fi.model : '') } }; }
        else if (fi) { v = { av: { member: true, title: fi.name }, name: fi.name }; }
        if (!angular.equals(v, vm.findValue)) { vm.findValue = v; }
    }

    /* ════════ closing the loop: replay · training record · debrief (each remembers the view and this flight) ════════ */
    function stopEv(ev) { if (ev && ev.stopPropagation) { ev.stopPropagation(); } }
    function track(f, ev) {
        stopEv(ev);
        if (!f || !f.has_track) { return; }
        remember(f);
        $state.go('dashboard.flight_replay', { flight_id: f.id });
    }
    function openRec(f, ev) {
        stopEv(ev);
        if (!f || !f._open) { return; }
        remember(f);
        $state.go('dashboard.manage_user.student_records', {
            club_id: f.record_club_id || f.club_id,
            student_id: f.record_user_id || f.student_id,
            course_id: f.course_id,
            flight: f.id
        });
    }
    function fill(f, ev) {
        stopEv(ev);
        if (!f || !f._r.todo || f._r.go !== 'fill') { return; }
        remember(f);
        $state.go('dashboard.manage_user.debriefing', {
            booking_id: f.booking_id || 0,
            plane_log_sheet_id: f.id,
            split_next_id: null,
            split_booking_id: null,
            from: 'instructed_hours'
        });
    }

    /* ════════ the view, remembered in this tab (sessionStorage; v1's keys, a superset of v1's shape) ════════ */
    function readKey(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function saveView(page) {
        var S = vm.S;
        try {
            sessionStorage.setItem(VIEW_KEY, JSON.stringify({
                preset: S.preset, from: S.preset === 'custom' ? S.from : null, to: S.preset === 'custom' ? S.to : null,
                include_solo: S.solo, filter_club: S.club, only_todo: S.todo,
                find: S.find, find_info: vm.findInfo, page: page || pagesLoaded(), at: Date.now()
            }));
        } catch (e) {}
    }
    function remember(f) {
        saveView();
        try { sessionStorage.setItem(FOCUS_KEY, JSON.stringify({ id: f.id, at: Date.now(), page: pagesLoaded() })); } catch (e) {}
    }
    function restore() {
        var S = vm.S, v = readKey(VIEW_KEY), focus = readKey(FOCUS_KEY), now = Date.now();
        try { sessionStorage.removeItem(FOCUS_KEY); } catch (e) {}
        var fresh = !!(v && v.at && now - v.at < FRESH_MS);
        if (v && v.preset) {
            S.solo = v.include_solo !== false;
            S.club = +v.filter_club || null;
            S.todo = !!v.only_todo;
            if (v.preset === 'custom' && v.from && v.to) { S.preset = 'custom'; S.from = v.from; S.to = v.to; vm.custom.from = v.from; vm.custom.to = v.to; }
            else { var p = presetOf(v.preset) || presetOf('last30'); S.preset = p.id; S.from = p.from; S.to = p.to; }
            if (fresh && v.find && v.find_info && /^[sa]:\d+$/.test(v.find)) { S.find = v.find; vm.findInfo = v.find_info; setValue(); }
        } else {
            var d = presetOf('last30'); S.preset = 'last30'; S.from = d.from; S.to = d.to;
        }
        var back = focus && focus.id && now - (focus.at || 0) < FRESH_MS ? focus : null;
        var pages = back ? (+back.page || 1) : (fresh ? (+v.page || 1) : 1);
        load('first', function () {
            if (pages <= 1) { if (back) { flash(back.id); } return; }
            fetchTo(pages * D.PER_PAGE).then(function (done) { if (back && done) { flash(back.id); } });
        });
    }
    /* back from the replay, the record or the debrief: that flight, scrolled to and flashed once */
    function flash(id) {
        if (!vm.rows.some(function (f) { return f.id === +id; })) { return; }
        vm.flashId = +id;
        $timeout(function () {
            var el = document.getElementById('hrs-f-' + id);
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center' }); }
        }, 80, false);
        if (flashTimer) { $timeout.cancel(flashTimer); }
        flashTimer = $timeout(function () { vm.flashId = null; }, 2800);
    }

    /* Esc: the search closes itself (<ta-combo> stops the key); then the opened row */
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented) { return; }
        if (vm.openId) { $scope.$apply(function () { vm.openId = null; }); }
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        seq++;
        cancelTimers();
        if (flashTimer) { $timeout.cancel(flashTimer); }
        $document.off('keydown', onKey);
        if (phoneMq && phoneMq.removeListener) { phoneMq.removeListener(onMq); }
    });
}
