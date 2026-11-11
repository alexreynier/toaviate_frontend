/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · Debriefs (To debrief + Entered for you)
   Design: mockups/instructor-dashboard/debriefs.html (approved 9 Nov 2026). Tracker: mockups/v2-build/fe-instructor-debriefs.md.
   Replaces v1 dashboard.manage_user.debriefing_list (views/manageuser/debriefing_list.html, DashboardInstructorBriefController
   data.action 'debrief_list': BookingService.GetBookingsToDebrief, RecordsToFileService, MissingStudentsService and the
   MissingStudentResolveModalController modal) behind the v2 switch.

   State: dashboard.v2.instructor_debriefs  /manage_user/debriefing_list?tab=entered  ← dashboard.manage_user.debriefing_list

   Data (be-alex-3e.md contract C36, list landed 9 Nov 21:53):
     GET  bookings/v2/debriefs?q&student_id&plane_id&club_id&status=all|ready|bookin|who|import&sort=new|old&offset&limit(≤100)
          → {today, total, counts{all,ready,bookin,who,import}, period_counts[{key,count}], waiting, oldest_flight_date, over_a_week,
             clubs[{id,title,count,member_count}], facets{students, aircraft}, records_to_confirm, flights[]}: one list for v1's two
             (booked lessons + flights without a record). Rows are grouped against `today`; headers count period_counts.
     GET  training_records/awaiting_confirmation → {records[] + club_title, aircraft_colour, aircraft_type, aircraft_model,
          entered_by_colour (instructors only: the initials circle; others get the grey person icon), on_behalf_by_id}
     POST training_records/confirm/{id}  (ALREADY_SUPERSEDED carries current_id: the row is refreshed in place)
     POST missing_students/dismiss/{club} {plane_log_sheet_ids, restore?} → {flights_updated, skipped[], record_not_required_by/at}
          refusals FORBIDDEN / NOT_DISMISSABLE (+ skipped[].reason)
     "Who was the student?" (v1's resolve modal, as a record dialog / bottom sheet):
     GET  missing_students/queue/{club}  (this flight's name group: name_key, candidates, the other flights with that name)
     GET  members/search/{club}?q&limit=50  (the club's current members + imported_user; STAFF only, which an instructor is),
          in the dialog as the design draws it: radio rows like the candidates, six shown, then 'N more match'
     POST missing_students/assign/{club}  {user_id, plane_log_sheet_ids} | {user_id, name_key, all:true}
     POST missing_students/create/{club}  {first_name, last_name, email?, plane_log_sheet_ids | name_key + all}
     GET  training_records/to_file/{club}?per_page=1 (club admins only: the Records to File line's counts)

   Leaving for the debrief (?from=debriefs: its Back and Save return to dashboard.manage_user.debriefing_list, which lands
   here), the book-in or a student's record remembers the view in sessionStorage (toaviate_dbl_view {tab, club, chip, sort,
   find, find_info, q, shown, at} and toaviate_dbl_focus {key, at}) and v1's toaviate_debrief_list_page (the page v1 opens
   at = how many rows are shown here). Coming back puts the same view back, scrolls to that flight and flashes it once.

   Here: DebriefsV2Data (the reads and writes, and one helper per domain: status, the lesson line, periods, words),
   dbl-portal (a dialog's scrim moved to <body>), InstructorDebriefsV2Controller and <dbl-resolve-dialog>.
   Views: views/v2/instructor_debriefs/ · CSS: css/v2/instructor-debriefs.css (dbl-).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_debriefs', {
        url: '/manage_user/debriefing_list?tab',
        templateUrl: 'views/v2/instructor_debriefs/debriefs.html',
        controller: 'InstructorDebriefsV2Controller',
        controllerAs: 'vm',
        reloadOnSearch: false   // the tab follows the page into the URL without reloading it
    });
    DesignRoutesProvider.map('dashboard.manage_user.debriefing_list', 'dashboard.v2.instructor_debriefs');
}]);


/* ═════ DebriefsV2Data: the reads and writes, and one helper per domain (raw values never reach the screen) ═════ */
app.factory('DebriefsV2Data', DebriefsV2Data);
DebriefsV2Data.$inject = ['InsCore'];
function DebriefsV2Data(InsCore) {
    var I = InsCore;
    var PAGE = 25, MAX = 100;
    var STATUS = {
        to_debrief: { tone: 'warn', icon: 'fa-comments', label: 'To debrief' },
        student_unknown: { tone: 'warn', icon: 'fa-question-circle', label: 'Student not identified' },
        off: { tone: 'muted', icon: 'fa-ban', label: 'No record needed' }
    };
    var CHIPS = [['all', 'All'], ['ready', 'Ready to debrief'], ['bookin', 'Book in first'], ['who', 'Student not identified'], ['import', 'Import note only']];
    var MATCH = ['Surname match', 'Close match', 'Same name'];
    var counts = {};             // club id → its member count (memberCount)

    return {
        PAGE: PAGE, MAX: MAX, CHIPS: CHIPS, MATCH: MATCH,
        list: function (params) { return I.get('bookings/v2/debriefs', params); },
        awaiting: function () { return I.get('training_records/awaiting_confirmation'); },
        confirm: function (id) { return I.post('training_records/confirm/' + id, {}); },
        dismiss: function (club, ids, restore) { var b = { plane_log_sheet_ids: ids }; if (restore) { b.restore = true; } return I.post('missing_students/dismiss/' + club, b); },
        queue: function (club) { return I.get('missing_students/queue/' + club); },
        members: function (club, q, limit) { return I.get('members/search/' + club, { q: q, limit: limit || 20 }); },
        assign: function (club, body) { return I.post('missing_students/assign/' + club, body); },
        create: function (club, body) { return I.post('missing_students/create/' + club, body); },
        toFile: function (club) { return I.get('training_records/to_file/' + club, { per_page: 1 }); },
        memberCount: memberCount, knowMemberCount: knowMemberCount, periodKey: periodKey,
        colour: colour, plural: plural, hhmm: hhmm, period: period, whenWord: whenWord, latestWord: latestWord,
        name: name, sheetName: sheetName, titleCase: titleCase, clubShort: clubShort, clubTiny: clubTiny, status: status, decorate: decorate, decorateRec: decorateRec
    };

    /* the club's live members, for "Search all 1,900 members": bookings/v2/debriefs clubs[].member_count (C36), remembered per
       club by the page; null when the answer had none, and the label says "Search all members" */
    function knowMemberCount(club, n) { if (+club && n != null && !isNaN(+n)) { counts[+club] = +n; } }
    function memberCount(club) { return counts[+club] === undefined ? null : counts[+club]; }
    function plural(n, one, many) { n = +n || 0; return n.toLocaleString('en-GB') + ' ' + (n === 1 ? one : (many || one + 's')); }
    /* an aircraft / person colour from the server, or '' (it only ever reaches a CSS custom property) */
    function colour(c) { c = String(c || '').trim(); return /^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl)a?\([\d\s.,%]+\)$/i.test(c) ? c : ''; }
    function hhmm(t) { return String(t || '').slice(0, 5); }
    function name(p) { return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim() : ''; }
    /* what the paper sheet called an unidentified student ("Ben ANDERSON", a surname only, or nothing) */
    function sheetName(f) { return f && f.suggested_student ? name(f.suggested_student) : ''; }
    /* a club's name where space is short, as the mockup writes them: "Westfield Flying Club" → Westfield; on phones "The Pilot
       Centre" → Pilot Centre (the full name stays in the opened row) */
    function clubShort(t) { return String(t || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+(Flying Club|Flying School|Aero Club|Gliding Club)$/i, '').trim() || String(t || ''); }
    function clubTiny(t) { return clubShort(t).replace(/^The\s+/i, ''); }
    function titleCase(s) { return String(s || '').toLowerCase().replace(/(^|[\s\-'])[a-z]/g, function (c) { return c.toUpperCase(); }); }

    /* the list's group headers, in the mockup's words: Today, Yesterday, Earlier this week, Last week, then the month */
    function period(d, today) {
        if (!d) { return 'No date'; }
        var g = I.daysBetween(d, today), dow = I.pd(today).getDay() || 7;
        if (g <= 0) { return 'Today'; }
        if (g === 1) { return 'Yesterday'; }
        if (g < dow) { return 'Earlier this week'; }
        if (g < dow + 7) { return 'Last week'; }
        return I.fMonth(d);
    }
    /* the same periods as keys, as the server's period_counts [{key, count}] (C36) writes them: today, yesterday, this_week
       (Monday of this week up to the day before yesterday), last_week (the Monday-to-Sunday before, less yesterday), YYYY-MM
       for everything older, undated without a date; the first that fits wins */
    function periodKey(d, today) {
        if (!d) { return 'undated'; }
        var g = I.daysBetween(d, today), dow = I.pd(today).getDay() || 7;
        if (g <= 0) { return 'today'; }
        if (g === 1) { return 'yesterday'; }
        if (g < dow) { return 'this_week'; }
        if (g < dow + 7) { return 'last_week'; }
        return String(d).slice(0, 7);
    }
    function whenWord(d, today) { if (!d) { return ''; } var g = I.daysBetween(d, today); return g === 0 ? 'Today' : g === 1 ? 'Yesterday' : I.fDay(d); }
    function latestWord(d, today) { if (!d) { return ''; } var w = whenWord(d, today); return 'latest ' + (w === 'Today' || w === 'Yesterday' ? w.toLowerCase() : w); }

    /* ONE helper for a flight's status: the debrief's words */
    function status(f) {
        if (f._off) { return STATUS.off; }
        if (f._book) { return { tone: 'pend', icon: 'fa-plane-arrival', label: 'Book in part ' + f._leg + ' first' }; }
        if (!f.student) { return STATUS.student_unknown; }
        return STATUS.to_debrief;
    }

    /* one flight → everything its row and its opened row show, worked out once (underscore keys are never sent anywhere) */
    function decorate(f, ctx) {
        var ac = I.ac(f.aircraft || {}), s = f.student;
        var off = hhmm(f.brakes_off_rounded) || hhmm(f.brakes_off), on = hhmm(f.brakes_on_rounded) || hhmm(f.brakes_on);
        f._key = 'f' + f.plane_log_sheet_id;
        f._reg = ac.reg || 'No aircraft';
        f._type = ac.type || '';
        f._model = ac.model || '';
        f._edge = colour(ac.colour) || 'var(--ta-line)';
        f._regTitle = ac.reg ? ac.reg + (ac.model ? ' · ' + ac.model : '') : '';
        f._day = I.fDay(f.flight_date);
        f._dayLong = I.fDayLong(f.flight_date);
        f._offT = off; f._onT = on;
        f._recOff = hhmm(f.brakes_off); f._recOn = hhmm(f.brakes_on);
        f._rounded = !!(hhmm(f.brakes_off_rounded) && (f._recOff !== off || f._recOn !== on));
        f._min = f.flight_minutes == null ? null : +f.flight_minutes;
        f._hm = f._min == null ? '' : I.hmMin(f._min);
        f._win = off + (on ? '–' + on : '') + (f._hm ? ' · ' + f._hm : '');
        f._name = name(s);
        f._first = s ? (s.first_name || f._name) : '';
        f._sheet = sheetName(f);
        f._temp = !!(s && s.temporary);
        f._solo = f.kind === 'supervised_solo';
        f._course = f.course ? (f.course.title || f.course.short_title || '') : '';
        f._lessonT = f.lesson ? (f.lesson.title || '') : '';
        f._book = !!(f.needs_book_in || f.status === 'book_in_first');
        f._leg = f.tpc_split_leg || 2;
        f._lesson = f._book ? 'Part ' + f._leg + ' of a split flight · ' + (s ? f._first + (f._solo ? ' solo' : '') : 'not booked in')
            : f._lessonT ? (f._course ? f._course + ' · ' : '') + f._lessonT
            : f.import_note ? 'Imported flight · lesson chosen in the debrief'
            : f.claimed ? 'Claimed flight · lesson chosen in the debrief'
            : 'Lesson chosen in the debrief';
        f._lessonFrom = f.lesson_source === 'booking' ? 'from the booking' : 'suggested from records';
        f._contact = s ? [s.email, s.phone_number].filter(function (x) { return !!x; }).join(' · ') : '';
        f._clubTag = ctx && ctx.clubTag && +f.club_id !== ctx.home ? clubShort(f.club_title) : '';
        f._matched = !!(ctx && ctx.matched && ctx.matched[f.plane_log_sheet_id]);
        f._st = status(f);
        if (f._i === undefined) { f._i = 0; }   // the rise-in stagger (the page sets it for rows that arrive)
        return f;
    }

    /* one record entered for you → its row and opened row */
    function decorateRec(r, ctx) {
        // alex-3e's record edit signal (10 Nov) when the row carries it; the older on_behalf_edit flag otherwise
        var edited = r.edited != null ? (r.edited === true || +r.edited === 1) : +r.on_behalf_edit === 1;
        var byFirst = r.on_behalf_by_first_name || r.entered_by_first_name || '', byLast = r.on_behalf_by_first_name ? (r.on_behalf_by_last_name || '') : (r.entered_by_last_name || '');
        var ac = ctx && ctx.aircraft ? ctx.aircraft[r.registration] : null;
        r._key = 'r' + r.id;
        r._reg = r.registration || 'No aircraft';
        r._type = r.aircraft_type || (ac ? (ac.type || '') : '');
        r._model = r.aircraft_model || (ac ? (ac.model || '') : '');
        r._edge = colour(r.aircraft_colour) || colour(ac && ac.colour) || 'var(--ta-line)';
        r._regTitle = r.registration ? r.registration + (r._model ? ' · ' + r._model : '') : '';
        r._day = I.fDay(r.flight_date);
        r._dayLong = I.fDayLong(r.flight_date);
        r._offT = hhmm(r.brakes_off); r._onT = hhmm(r.brakes_on);
        r._win = r._offT + (r._onT ? '–' + r._onT : '');
        r._name = ((r.student_first_name || '') + ' ' + (r.student_last_name || '')).trim() || 'Student';
        r._first = r.student_first_name || r._name;
        r._lessonT = r.lesson_title || '';
        r._sub = [r.course_title, r.lesson_title].filter(function (x) { return !!x; }).join(' · ');
        r._edited = edited;
        r._by = (byFirst + ' ' + byLast).trim() || 'the club';
        r._byFirst = byFirst || r._by;
        r._byCode = I.initials(r._by).toUpperCase();
        r._byColour = colour(r.entered_by_colour);
        /* an initials circle means an instructor, app-wide: the backend colours only instructors (DisplayColours), or says so;
           a club admin who isn't one gets the grey person icon */
        r._byInstructor = !!(r._byColour || +r.entered_by_is_instructor === 1 || +r.on_behalf_by_is_instructor === 1 || r.on_behalf_by_instructor === true);
        r._enteredBy = ((r.entered_by_first_name || '') + ' ' + (r.entered_by_last_name || '')).trim() || r._by;
        r._createdDay = (r.recorded_at || r.created_at) ? I.fDay(r.recorded_at || r.created_at) : '';   // first filed (an edit's created_at is the edit time)
        r._sortKey = String(r.flight_date || '') + ' ' + r._offT;
        return r;
    }
}


/* dbl-portal — moves a dialog's scrim to <body> while it lives (the fixed header and page stacking can't trap it), with
   ngAnimate off on it: the dialog leaves <main class="ta-page">, inside which design.js already turns ngAnimate off. */
app.directive('dblPortal', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            $animate.enabled(el, false);
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
}]);


/* ═════ the page ═════ */
app.controller('InstructorDebriefsV2Controller', InstructorDebriefsV2Controller);
InstructorDebriefsV2Controller.$inject = ['$scope', '$state', '$stateParams', '$timeout', '$q', '$document', '$window', 'InsCore', 'DebriefsV2Data', 'TaComboMatch', 'ToastService'];
function InstructorDebriefsV2Controller($scope, $state, $stateParams, $timeout, $q, $document, $window, InsCore, DebriefsV2Data, TaComboMatch, ToastService) {
    var vm = this, D = DebriefsV2Data, M = TaComboMatch, I = InsCore;
    var VIEW_KEY = 'toaviate_dbl_view', FOCUS_KEY = 'toaviate_dbl_focus', V1_PAGE_KEY = 'toaviate_debrief_list_page', FRESH_MS = 30 * 60 * 1000;
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var seq = 0, eseq = 0, typeTimer = null, dimTimer = null, flashTimer = null, prefetching = null;
    var matched = {};            // plane_log_sheet_id → true: a student was attached here this visit ("Student matched")

    vm.D = D;
    vm.today = I.today();
    vm.tab = 'todo';
    vm.S = { club: null, chip: 'all', sort: 'new', find: null, q: '' };   // find: 's:<student id>' | 'a:<plane id | registration>'
    vm.findInfo = null;          // { kind: 's' | 'a', id, name | reg, type, model, colour }
    vm.findValue = null;         // what <ta-combo> shows when closed (a stable object)
    vm.findSummary = null;
    vm.scopeLn = null;
    vm.cbQ = '';
    vm.cbVer = 0;

    // To debrief
    vm.st = 'loading';           // loading (skeleton) | ready | error
    vm.res = null;               // the last answer (counts, clubs, facets, waiting…)
    vm.clubs = [];
    vm.clubAll = 0;
    vm.pool = [];                // the flights fetched so far, in the server's order
    vm.shown = D.PAGE;           // how many of them are on screen
    vm.total = 0;
    vm.groups = [];
    vm.gen = 0;                  // bumped on every fresh answer, so rows rise in again
    vm.dim = false;
    vm.moreBusy = false;
    vm.todoN = null;
    vm.headline = { waiting: null, oldest: null };   // the hint: every flight of yours, whatever the filters
    // Entered for you
    vm.est = 'loading';
    vm.recs = [];
    vm.egroups = [];
    vm.eShown = D.PAGE;
    vm.eTotal = 0;
    vm.eGen = 0;
    vm.entN = null;

    vm.open = null;              // the opened row's key
    vm.confirmDismiss = null;    // the flight whose "No record needed" asks first
    vm.flashKey = null;
    vm.rs = null;                // the flight in the "Who was the student?" dialog
    vm.admin = null;             // { title, nText } for a club admin's Records to File line
    vm.skel4 = [0, 1, 2, 3];
    vm.skel3 = [0, 1, 2];
    vm.hint = 'Flights waiting for your training record, and records filed for you';

    vm.setTab = setTab;
    vm.setChip = function (c) { if (vm.S.chip === c) { return; } vm.S.chip = c; chips(); load('filter'); };
    vm.setClub = function (id) { id = +id || null; if (vm.S.club === id) { return; } vm.S.club = id; load('filter'); };
    vm.setSort = setSort;
    vm.reset = reset;
    vm.toggle = function (x) { vm.open = vm.open === x._key ? null : x._key; vm.confirmDismiss = null; };
    vm.more = more;
    vm.eMore = eMore;
    vm.retry = function () { load('first'); };
    vm.eRetry = function () { loadEntered(true); };
    vm.findSource = findSource;
    vm.findPick = findPick;
    vm.findClear = findClear;
    vm.findType = findType;
    vm.findLeave = function () { /* what was typed stays the filter (the mockup) */ };
    vm.debrief = debrief;
    vm.debriefHref = debriefHref;
    vm.bookIn = bookIn;
    vm.resolve = resolve;
    vm.resolved = resolved;
    vm.closeResolve = function () { vm.rs = null; };
    vm.dismissAsk = function (f, ev) { stop(ev); vm.confirmDismiss = f._key; };
    vm.dismissNo = function () { vm.confirmDismiss = null; };
    vm.dismissYes = function (f) { dismiss(f, false); };
    vm.undo = function (f, ev) { stop(ev); dismiss(f, true); };
    vm.review = review;
    vm.confirm = confirmRec;
    vm.toFile = function () { $state.go('dashboard.manage_club.records_to_file'); };
    /* Enter / Space on the row's inner buttons (role=button spans inside the row's own button, as the design draws them) */
    vm.key = function (ev, x, what) {
        if (ev.keyCode !== 13 && ev.keyCode !== 32) { return; }
        ev.preventDefault(); ev.stopPropagation();
        vm[what](x, ev);
    };
    vm.chipList = [];
    vm.hasItems = function () { return vm.tab === 'todo' ? (vm.st !== 'loading' || !!vm.res) && vm.clubAll > 0 : vm.est === 'ready' && vm.recs.length > 0; };

    phPlaceholder();
    if (phoneMq && phoneMq.addListener) { phoneMq.addListener(onMq); }
    start();

    /* ════════ start: the remembered view, then both reads at once ════════ */
    function start() {
        var v = readKey(VIEW_KEY), focus = readKey(FOCUS_KEY), now = Date.now();
        try { sessionStorage.removeItem(FOCUS_KEY); } catch (e) { /* storage off */ }
        var fresh = !!(v && v.at && now - v.at < FRESH_MS);
        var back = focus && focus.key && now - (focus.at || 0) < FRESH_MS ? focus : null;
        if (v) {
            vm.S.chip = D.CHIPS.some(function (c) { return c[0] === v.chip; }) ? v.chip : 'all';
            vm.S.sort = v.sort === 'old' ? 'old' : 'new';
            vm.S.club = +v.club || null;
        }
        var tab = $stateParams.tab === 'entered' ? 'entered' : $stateParams.tab === 'todo' ? 'todo' : (fresh && v.tab === 'entered' ? 'entered' : 'todo');
        vm.tab = tab;
        if (fresh && v.tab === tab) {
            if (v.find && v.find_info && /^[sa]:.+$/.test(v.find)) { vm.S.find = v.find; vm.findInfo = v.find_info; }
            else if (v.q) { vm.S.q = String(v.q); vm.cbQ = vm.S.q; }
        }
        var shown = v && v.shown ? +v.shown : 0;
        if (!shown) { try { shown = (parseInt(sessionStorage.getItem(V1_PAGE_KEY), 10) || 1) * D.PAGE; } catch (e) { shown = D.PAGE; } }
        shown = Math.max(D.PAGE, Math.min(shown || D.PAGE, 400));
        if (tab === 'todo') { vm.shown = shown; } else { vm.eShown = shown; }
        setValue();
        if (tab === 'entered' && $stateParams.tab !== 'entered') { syncUrl(); }
        load('first', back && back.key.charAt(0) === 'f' ? back.key : null);
        loadEntered(false, back && back.key.charAt(0) === 'r' ? back.key : null);
        adminLine();
    }

    /* ════════ To debrief: the read ════════ */
    function query(offset, limit) {
        var S = vm.S, f = S.find || '';
        return {
            q: S.q && S.q.trim() ? S.q.trim() : null,
            student_id: f.indexOf('s:') === 0 ? f.slice(2) : null,
            plane_id: f.indexOf('a:') === 0 ? f.slice(2) : null,
            club_id: S.club || null,
            status: S.chip !== 'all' ? S.chip : null,
            sort: S.sort,
            offset: offset || 0,
            limit: limit || D.PAGE
        };
    }
    /* how: 'first' → the skeleton; 'filter' → the list dims until the answer, then the rows rise in again;
       'quiet' → the same rows refreshed in place (a student attached). The latest request wins. */
    function load(how, focusKey) {
        var my = ++seq;
        prefetching = null;
        if (how !== 'quiet') { vm.open = null; vm.confirmDismiss = null; }
        if (how === 'filter') { vm.shown = D.PAGE; }
        vm.moreBusy = false;
        if (vm.tab === 'todo') { saveView(); }
        busy(how);
        var want = Math.min(D.MAX, Math.max(D.PAGE, vm.shown));
        return D.list(query(0, want)).then(function (res) {
            if (my !== seq) { return; }
            if (!res || res.success === false || !angular.isArray(res.flights)) { idle(); if (how !== 'quiet' || vm.st !== 'ready') { vm.st = 'error'; } hint(); return; }
            // a club that has nothing left is dropped (the club switch only lists clubs with flights)
            if (vm.S.club && !(res.clubs || []).some(function (c) { return +c.id === vm.S.club; })) { vm.S.club = null; load(how, focusKey); return; }
            take(res, how);
            idle();
            vm.st = 'ready';
            if (vm.shown > vm.pool.length && vm.pool.length < vm.total) { fetchMore(vm.shown).then(function () { prefetch(); if (focusKey) { flash(focusKey); } }); }
            else { prefetch(); if (focusKey) { flash(focusKey); } }
        });
    }
    function busy(how) {
        cancelDim();
        if (how === 'first' || vm.st !== 'ready') { vm.st = 'loading'; vm.dim = false; return; }
        if (how === 'filter') { dimTimer = $timeout(function () { vm.dim = true; }, 90); }
    }
    function idle() { cancelDim(); vm.dim = false; }
    function cancelDim() { if (dimTimer) { $timeout.cancel(dimTimer); dimTimer = null; } }

    function ctxOf(res) {
        var clubs = (res && res.clubs) || [], home = null, max = -1;
        clubs.forEach(function (c) { if (+c.count > max) { max = +c.count; home = +c.id; } });
        return { matched: matched, home: home, clubTag: clubs.length > 1 && !vm.S.club };
    }
    function take(res, how) {
        if (how !== 'quiet') { vm.gen++; }
        var keepOff = {};
        vm.pool.forEach(function (f) { if (f._off) { keepOff[f.plane_log_sheet_id] = true; } });
        res.counts = res.counts || { all: 0, ready: 0, bookin: 0, who: 0, import: 0 };
        vm.res = res;
        if (/^\d{4}-\d{2}-\d{2}$/.test(res.today || '')) { vm.today = res.today; }   // the day the server's periods were worked out on
        vm.clubs = (res.clubs || []).length > 1 ? res.clubs.map(function (c) { return angular.extend({}, c, { id: +c.id, _short: D.clubShort(c.title), _tiny: D.clubTiny(c.title) }); }) : [];
        vm.clubAll = (res.clubs || []).reduce(function (a, c) { return a + (+c.count || 0); }, 0);
        (res.clubs || []).forEach(function (c) { D.knowMemberCount(c.id, c.member_count); });
        if (!vm.S.club) { vm.headline = { waiting: +res.waiting || 0, oldest: res.oldest_flight_date || null }; }
        else if (vm.headline.waiting === null) { vm.headline = { waiting: vm.clubAll, oldest: null }; }
        vm.total = +res.total || 0;
        var ctx = ctxOf(res);
        vm.pool = [];
        (res.flights || []).forEach(function (f) { if (keepOff[f.plane_log_sheet_id]) { f._off = true; } vm.pool.push(D.decorate(f, ctx)); });
        if (how !== 'quiet') { stagger(0); }
        // the records entered for you name the aircraft by registration only: their type and model come from these facets
        if (vm.recs.length) { var acs = aircraftByReg(); vm.recs.forEach(function (r) { if (!r._type) { D.decorateRec(r, { aircraft: acs }); } }); }
        chips();
        regroup();
        setSummary();
        vm.cbVer++;
    }
    /* the chips that count (a chip with nothing in it hides, unless it is the one chosen) */
    function chips() {
        var c = (vm.res && vm.res.counts) || {};
        vm.chipList = D.CHIPS.filter(function (x) { return x[0] === 'all' || (+c[x[0]] || 0) > 0 || vm.S.chip === x[0]; })
            .map(function (x) { return { k: x[0], label: x[1], n: +c[x[0]] || 0, attn: x[0] === 'who' || x[0] === 'bookin' }; });
    }
    /* rows [have, want) of this view, in reads of up to 100 → true | false (failed) | null (the view changed) */
    function fetchMore(want) {
        var my = seq, have = vm.pool.length;
        want = Math.min(want, vm.total);
        if (want <= have) { return $q.when(true); }
        return D.list(query(have, Math.min(D.MAX, Math.max(D.PAGE, want - have)))).then(function (res) {
            if (my !== seq) { return null; }
            if (!res || res.success === false || !angular.isArray(res.flights)) { return false; }
            var seen = {}, ctx = ctxOf(vm.res);
            vm.pool.forEach(function (f) { seen[f._key] = 1; });
            res.flights.forEach(function (f) { D.decorate(f, ctx); if (!seen[f._key]) { seen[f._key] = 1; f._i = 0; vm.pool.push(f); } });
            if (res.total !== undefined) { vm.total = +res.total || 0; }
            regroup();
            if (vm.pool.length < want && vm.pool.length < vm.total && res.flights.length) { return fetchMore(want); }
            return true;
        });
    }
    /* a backlog of up to 100: the rest arrives quietly once the first 25 are on screen, so every group header counts exactly
       and "Show 25 more" is instant. Past 100, the next 25 are fetched each time some are shown. */
    function prefetch() {
        if (vm.pool.length >= vm.total || prefetching) { return; }
        if (vm.total > D.MAX && vm.pool.length >= vm.shown + D.PAGE) { return; }
        var want = vm.total <= D.MAX ? vm.total : vm.shown + D.PAGE;
        prefetching = fetchMore(want).then(function () { prefetching = null; }, function () { prefetching = null; });
    }
    function more() {
        if (vm.moreBusy || vm.shown >= vm.total) { return; }
        var next = vm.shown + D.PAGE;
        if (vm.pool.length >= Math.min(next, vm.total)) { reveal(next); return; }
        vm.moreBusy = true;
        var my = seq;
        (prefetching || $q.when()).then(function () { return my === seq ? fetchMore(next) : null; }).then(function (done) {
            if (my !== seq) { return; }
            vm.moreBusy = false;
            if (done === null) { return; }
            if (done === false) { ToastService.error('Not loaded', 'More flights couldn’t be loaded. Please try again.'); return; }
            reveal(next);
        });
    }
    function reveal(next) {
        var from = vm.shown;
        vm.shown = Math.min(next, vm.pool.length);
        stagger(from);
        regroup();
        saveView();
        prefetch();
    }
    /* the rise-in stagger, counted from the first new row */
    function stagger(from) { vm.pool.forEach(function (f, i) { f._i = i >= from ? i - from : 0; }); }
    /* the rows on screen by period, each header counting the whole period (exact once the period is all here) */
    function regroup() {
        var out = [], cur = null, by = {}, today = vm.today, rows = vm.pool.slice(0, vm.shown), all = vm.pool.length >= vm.total;
        var lastP = vm.pool.length ? D.period(vm.pool[vm.pool.length - 1].flight_date, today) : null;
        vm.pool.forEach(function (f) { var p = D.period(f.flight_date, today); by[p] = (by[p] || 0) + 1; });
        rows.forEach(function (f) {
            var p = D.period(f.flight_date, today);
            if (!cur || cur.key !== p) { cur = { key: p, rows: [], i: f._i || 0 }; out.push(cur); }
            cur.rows.push(f);
        });
        // exact counts from the server when it sends them (period_counts, over the whole filtered list), else what is here
        var pc = {};
        ((vm.res && vm.res.period_counts) || []).forEach(function (x) { if (x && x.key) { pc[x.key] = +x.count || 0; } });
        out.forEach(function (g) {
            var k = D.periodKey(g.rows[0].flight_date, today);
            g.n = pc[k] !== undefined ? D.plural(Math.max(pc[k], by[g.key]), 'flight') : !all && g.key === lastP ? by[g.key] + '+ flights' : D.plural(by[g.key], 'flight');
        });
        vm.groups = out;
        vm.nextN = Math.min(D.PAGE, vm.total - vm.shown);
        vm.todoN = vm.headline.waiting === null ? null : Math.max(0, vm.headline.waiting - vm.pool.filter(function (f) { return f._off; }).length);
        hint();
    }

    /* ════════ Entered for you (one read; the search, the order and "Show more" work in the page) ════════ */
    function loadEntered(again, focusKey) {
        var my = ++eseq;
        if (again) { vm.est = 'loading'; }
        return D.awaiting().then(function (res) {
            if (my !== eseq) { return; }
            if (!res || res.success === false || !angular.isArray(res.records)) { vm.est = 'error'; hint(); return; }
            var acs = aircraftByReg();
            vm.recs = res.records.map(function (r) { return D.decorateRec(r, { aircraft: acs }); });
            vm.est = 'ready';
            vm.eGen++;
            eRegroup(0);
            hint();
            if (vm.tab === 'entered') { setSummary(); vm.cbVer++; }
            if (focusKey) { flash(focusKey); }
        });
    }
    function aircraftByReg() {
        var out = {}, F = (vm.res && vm.res.facets) || {};
        (F.aircraft || []).forEach(function (a) { if (a.registration) { out[a.registration] = a; } });
        return out;
    }
    function eFiltered() {
        var S = vm.S, f = S.find || '', q = (S.q || '').trim(), list = vm.recs;
        if (f.indexOf('s:') === 0) { return list.filter(function (r) { return String(r.student_id) === f.slice(2); }); }
        if (f.indexOf('a:') === 0) { return list.filter(function (r) { return r.registration === f.slice(2); }); }
        if (!q) { return list; }
        var t = M.toks(q), nq = M.norm(q), regs = uniq(list.map(function (r) { return r.registration; }));
        if (nq.length < 3 && regs.some(function (g) { return M.regScore(g, nq) >= 70; })) { return list.filter(function (r) { return M.regScore(r.registration, nq) >= 70; }); }
        return list.filter(function (r) {
            return t.every(function (tk) { return M.regScore(r.registration, tk) || M.wordHit(r._name, tk) || M.wordHit(r._lessonT, tk) || M.wordHit(r.course_title, tk); });
        });
    }
    function eRegroup(from) {
        var list = eFiltered().slice().sort(function (a, b) { var k = a._sortKey < b._sortKey ? -1 : a._sortKey > b._sortKey ? 1 : 0; return vm.S.sort === 'old' ? k : -k; });
        var rows = list.slice(0, vm.eShown), out = [], cur = null, by = {}, today = vm.today;
        list.forEach(function (r) { var p = D.period(r.flight_date, today); by[p] = (by[p] || 0) + 1; });
        rows.forEach(function (r, i) {
            r._i = i >= from ? i - from : 0;
            var p = D.period(r.flight_date, today);
            if (!cur || cur.key !== p) { cur = { key: p, rows: [], i: r._i }; out.push(cur); }
            cur.rows.push(r);
        });
        out.forEach(function (g) { g.n = D.plural(by[g.key], 'record'); });
        vm.egroups = out;
        vm.eTotal = list.length;
        vm.eNextN = Math.min(D.PAGE, vm.eTotal - vm.eShown);
        vm.eLeft = vm.recs.filter(function (r) { return !r._done; }).length;
    }
    function eMore() {
        if (vm.moreBusy || vm.eShown >= vm.eTotal) { return; }
        vm.moreBusy = true;
        $timeout(function () { var from = vm.eShown; vm.eShown += D.PAGE; vm.moreBusy = false; eRegroup(from); saveView(); }, reduce && reduce.matches ? 0 : 160);
    }

    /* the page bar's line: every flight of yours (whatever the filters) and every record to confirm */
    function hint() {
        var todo = vm.todoN;
        var ent = vm.est === 'ready' ? vm.recs.filter(function (r) { return !r._done; }).length : (vm.res ? +vm.res.records_to_confirm || 0 : null);
        vm.entN = ent;
        if (todo === null || ent === null) { vm.hint = 'Flights waiting for your training record, and records filed for you'; return; }
        if (!todo && !ent) { vm.hint = 'Nothing waiting for you'; return; }
        var o = vm.headline.oldest;
        vm.hint = (todo ? D.plural(todo, 'flight') + ' waiting for your debrief' + (o && I.daysBetween(o, vm.today) > 6 ? ', the oldest from ' + I.fDay(o) : '') : 'Every flight debriefed')
            + (ent ? ' · ' + D.plural(ent, 'record') + ' to confirm' : '');
    }

    /* ════════ tabs · order · reset ════════ */
    function setTab(t) {
        if (vm.tab === t) { return; }
        vm.tab = t;
        vm.open = null; vm.confirmDismiss = null;
        if (typeTimer) { $timeout.cancel(typeTimer); typeTimer = null; }
        vm.S.find = null; vm.findInfo = null; vm.S.q = ''; vm.cbQ = '';
        setValue();
        syncUrl();
        if (t === 'todo') { load('filter'); }
        else { vm.eShown = D.PAGE; vm.eGen++; eRegroup(0); setSummary(); vm.cbVer++; saveView(); }
        if ($window.scrollY > 0) { $window.scrollTo(0, 0); }
    }
    function syncUrl() { $state.go('.', { tab: vm.tab === 'entered' ? 'entered' : null }, { location: 'replace' }); }
    function setSort(s) {
        if (vm.S.sort === s) { return; }
        vm.S.sort = s;
        if (vm.tab === 'todo') { load('filter'); } else { vm.open = null; vm.eShown = D.PAGE; vm.eGen++; eRegroup(0); saveView(); }
    }
    function reset() {
        if (typeTimer) { $timeout.cancel(typeTimer); typeTimer = null; }
        vm.S.find = null; vm.findInfo = null; vm.S.q = ''; vm.cbQ = '';
        setValue();
        if (vm.tab === 'todo') { vm.S.chip = 'all'; vm.S.club = null; chips(); load('filter'); }
        else { vm.open = null; vm.eShown = D.PAGE; vm.eGen++; eRegroup(0); setSummary(); saveView(); }
    }

    /* ════════ the search over students and aircraft (the shared <ta-combo>, js/v2/logbook/logbook.js) ════════ */
    function onMq() { $scope.$applyAsync(phPlaceholder); }
    function phPlaceholder() {
        var regs = vm.tab === 'entered' ? uniq(vm.recs.map(function (r) { return r.registration; })) : (((vm.res && vm.res.facets) || {}).aircraft || []).map(function (a) { return a.registration; });
        regs = regs.filter(function (r) { return !!r; });
        var ex = regs.filter(function (r) { return /BA$/.test(r); })[0] || regs[0] || 'G-BMTJ', end = String(ex).slice(-2);
        vm.findPh = phoneMq && phoneMq.matches ? 'Student or aircraft, e.g. ' + end : 'Search students or aircraft: ' + end + ' finds ' + ex;
    }
    function uniq(a) { var s = {}, out = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; out.push(x); } }); return out; }
    /* what the dropdown lists: the server's facets for To debrief (club scope), the records' own for Entered for you */
    function facets() {
        if (vm.tab === 'todo') {
            var F = (vm.res && vm.res.facets) || {}, clubs = {};
            ((vm.res && vm.res.clubs) || []).forEach(function (c) { clubs[c.id] = c.title; });
            return {
                n: vm.res ? +vm.res.waiting || 0 : 0, noun: 'flight',
                students: (F.students || []).map(function (s) { return { key: 's:' + s.id, id: s.id, name: D.name(s), temp: !!s.temporary, club: D.clubShort(clubs[s.club_id] || ''), count: +s.count || 0, latest: s.latest_flight_date }; }),
                aircraft: (F.aircraft || []).map(function (a) { return { key: 'a:' + a.id, id: a.id, reg: a.registration || '', type: a.type || '', model: a.model || '', colour: D.colour(a.colour), club: D.clubShort(clubs[a.club_id] || ''), count: +a.count || 0, latest: a.latest_flight_date }; })
            };
        }
        var st = {}, ac = {}, acs = aircraftByReg(), sl = [], al = [];
        vm.recs.forEach(function (r) {
            var s = st[r.student_id];
            if (!s) { s = st[r.student_id] = { key: 's:' + r.student_id, id: r.student_id, name: r._name, temp: false, club: D.clubShort(r.club_title), count: 0, latest: r.flight_date }; sl.push(s); }
            s.count++; if (r.flight_date > s.latest) { s.latest = r.flight_date; }
            if (r.registration) {
                var a = ac[r.registration];
                if (!a) { a = ac[r.registration] = { key: 'a:' + r.registration, id: r.registration, reg: r.registration, type: r._type, model: r._model || (acs[r.registration] || {}).model || '', colour: D.colour(r.aircraft_colour), club: D.clubShort(r.club_title), count: 0, latest: r.flight_date }; al.push(a); }
                a.count++; if (r.flight_date > a.latest) { a.latest = r.flight_date; }
            }
        });
        return { n: vm.recs.length, noun: 'record', students: sl, aircraft: al };
    }
    function nameScore(n, t) { var sc = 0; for (var i = 0; i < t.length; i++) { if (!M.wordHit(n, t[i])) { return 0; } sc += 60; } return sc; }
    function acScore(a, t) {
        var sc = 0;
        for (var i = 0; i < t.length; i++) { var v = M.regScore(a.reg, t[i]) || (M.wordHit(a.type + ' ' + a.model, t[i]) ? 40 : 0); if (!v) { return 0; } sc += v; }
        return sc;
    }
    function findSource(q) {
        q = String(q || '').trim();
        var F = facets(), t = M.toks(q), noun = F.noun, today = vm.today;
        var sHits = F.students.map(function (s) { return { s: s, sc: t.length ? nameScore(s.name, t) : 1 }; }).filter(function (x) { return x.sc; })
            .sort(function (a, b) { return (b.sc - a.sc) || (b.s.count - a.s.count) || (a.s.name < b.s.name ? -1 : a.s.name > b.s.name ? 1 : 0); });
        var aHits = F.aircraft.map(function (a) { return { a: a, sc: t.length ? acScore(a, t) : 1 }; }).filter(function (x) { return x.sc; })
            .sort(function (a, b) { return (b.sc - a.sc) || (b.a.count - a.a.count); });
        /* one or two letters are nearly always the end of a registration: then only aircraft match (BA → G-SHBA, not Lucy Barnes) */
        var only = !!q && M.norm(q).length < 3 && F.aircraft.some(function (a) { return acScore(a, t) >= 70; });
        var sRows = only ? [] : sHits.map(function (x) {
            var s = x.s;
            return { key: s.key, av: { member: true, title: s.name }, t: s.name, s: (s.temp ? 'Temporary member · ' : '') + s.club, r: D.plural(s.count, noun), rs: D.latestWord(s.latest, today), on: vm.S.find === s.key };
        });
        var aRows = aHits.map(function (x) {
            var a = x.a;
            return { key: a.key, ac: a.colour || undefined, t: a.reg, s: [a.model, a.club].filter(function (v) { return !!v; }).join(' · '), r: D.plural(a.count, noun), rs: D.latestWord(a.latest, today), on: vm.S.find === a.key };
        });
        var groups = [];
        if (!q) { groups.push({ rows: [{ key: 'all', lead: 'fa-list', t: noun === 'record' ? 'Every record' : 'Every flight', s: D.plural(F.students.length, 'student') + ' · ' + D.plural(F.aircraft.length, 'aircraft', 'aircraft'), r: D.plural(F.n, noun), on: !vm.S.find }] }); }
        if (only) { groups.push({ label: 'Aircraft', right: D.plural(aRows.length, 'match', 'matches'), rows: aRows }); }
        else {
            groups.push({ label: 'Students', right: q ? D.plural(sRows.length, 'match', 'matches') : D.plural(sRows.length, 'student'), rows: sRows });
            groups.push({ label: 'Aircraft', right: q ? D.plural(aRows.length, 'match', 'matches') : D.plural(aRows.length, 'aircraft', 'aircraft'), rows: aRows });
        }
        return { groups: groups, empty: { t: 'Nothing matches “' + q + '”', s: 'Try a student’s name, or the last two letters of a registration.' } };
    }
    function findPick(key) {
        if (key === 'all') { findClear(); return; }
        var F = facets(), info = null;
        F.students.forEach(function (s) { if (s.key === key) { info = { kind: 's', id: s.id, name: s.name }; } });
        F.aircraft.forEach(function (a) { if (a.key === key) { info = { kind: 'a', id: a.id, reg: a.reg, type: a.type, model: a.model, colour: a.colour }; } });
        if (!info) { return; }
        if (typeTimer) { $timeout.cancel(typeTimer); typeTimer = null; }
        if (vm.S.find === key && !vm.S.q) { return; }
        vm.S.find = key; vm.findInfo = info; vm.S.q = ''; vm.cbQ = '';
        setValue();
        applyFind();
    }
    function findClear() {
        if (typeTimer) { $timeout.cancel(typeTimer); typeTimer = null; }
        var had = !!(vm.S.find || vm.S.q);
        vm.S.find = null; vm.findInfo = null; vm.S.q = ''; vm.cbQ = '';
        setValue();
        if (had) { applyFind(); }
    }
    /* typing filters as you go (the server's q on To debrief), and replaces a picked student or aircraft */
    function findType(q) {
        q = String(q || '');
        if (vm.S.find) { vm.S.find = null; vm.findInfo = null; setValue(); }
        if (q.trim() === (vm.S.q || '').trim() && q.trim()) { vm.S.q = q; return; }
        vm.S.q = q;
        if (typeTimer) { $timeout.cancel(typeTimer); }
        typeTimer = $timeout(function () { typeTimer = null; applyFind(); }, vm.tab === 'todo' ? 250 : 0);
    }
    function applyFind() {
        if (vm.tab === 'todo') { load('filter'); }
        else { vm.open = null; vm.eShown = D.PAGE; vm.eGen++; eRegroup(0); saveView(); }
        setSummary();
    }
    /* Esc / Cancel in the search empty what was typed: the filter goes with it */
    $scope.$watch(function () { return vm.cbQ; }, function (v, old) {
        if (v === old || (v || '') !== '' || !(vm.S.q || '').trim() || vm.S.find) { return; }
        if (typeTimer) { $timeout.cancel(typeTimer); typeTimer = null; }
        vm.S.q = '';
        applyFind();
    });
    function setValue() {
        var fi = vm.findInfo, v = null;
        if (fi && fi.kind === 'a') { v = { ac: { reg: fi.reg, type: fi.type, colour: D.colour(fi.colour), title: fi.reg + (fi.model ? ' · ' + fi.model : '') } }; }
        else if (fi) { v = { av: { member: true, title: fi.name }, name: fi.name }; }
        if (!angular.equals(v, vm.findValue)) { vm.findValue = v; }
    }
    function setSummary() {
        var noun = vm.tab === 'todo' ? 'flight' : 'record';
        var n = vm.tab === 'todo' ? (vm.res ? +vm.res.waiting || 0 : 0) : vm.recs.length;
        var s = !vm.S.find && !(vm.S.q || '').trim() ? { pre: '', b: D.plural(n, noun) } : null;
        if (!angular.equals(s, vm.findSummary)) { vm.findSummary = s; }
        phPlaceholder();
        // the line under the bar: what the list is narrowed to, and how many it holds (before the chips)
        var fi = vm.findInfo, nn = vm.tab === 'todo' ? (vm.res ? +(vm.res.counts || {}).all || 0 : 0) : vm.eTotal, q = (vm.S.q || '').trim();
        vm.scopeLn = !fi && !q ? null : { kind: fi ? fi.kind : 'q', name: fi ? (fi.kind === 's' ? fi.name : fi.reg) : q, n: D.plural(nn, noun), noun: noun };
    }
    $scope.$watchGroup([function () { return vm.res && vm.res.counts && vm.res.counts.all; }, function () { return vm.eTotal; }, function () { return vm.tab; }], function () { setSummary(); });

    /* ════════ leaving: the debrief · the book-in · a student's record (each remembers the view and this row) ════════ */
    function stop(ev) { if (ev && ev.stopPropagation) { ev.stopPropagation(); } }
    function debriefParams(f) { return { booking_id: f.booking_id || 0, plane_log_sheet_id: f.plane_log_sheet_id, split_next_id: null, split_booking_id: null, from: 'debriefs' }; }
    function debriefHref(f) { return $state.href('dashboard.manage_user.debriefing', debriefParams(f)); }
    function debrief(f, ev) {
        if (!f || f._off || f._book || !f.student) { if (ev && ev.preventDefault) { ev.preventDefault(); } return; }
        if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) && ev.currentTarget && ev.currentTarget.tagName === 'A') { remember(f); return; }   // a new tab: the link does it
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        stop(ev);
        remember(f);
        $state.go('dashboard.manage_user.debriefing', debriefParams(f));
    }
    function bookIn(f, ev) {
        stop(ev);
        if (!f || !f._book || f._off) { return; }
        remember(f);
        $state.go('dashboard.my_account.book_in', { id: f.plane_log_sheet_id });
    }
    function review(r, ev) {
        stop(ev);
        if (!r) { return; }
        remember(r);
        $state.go('dashboard.manage_user.student_records', { club_id: r.club_id, student_id: r.student_id, course_id: r.course_id, flight: r.plane_log_sheet_id || null });
    }

    /* ════════ No record needed · Undo (missing_students/dismiss, D13) ════════ */
    function dismiss(f, restore) {
        if (!f || f._busy) { return; }
        f._busy = restore ? 'undo' : 'dismiss';
        D.dismiss(f.club_id, [f.plane_log_sheet_id], restore).then(function (res) {
            f._busy = null;
            var code = res && res.error, skipped = (res && (res.skipped || (res.data && res.data.skipped))) || [], why = skipped[0] && skipped[0].reason;
            if (res && res.success !== false && (+res.flights_updated || 0) > 0) { settle(f, !restore); return; }
            ToastService.handledInline();
            if (code === 'NOT_DISMISSABLE' && why === 'unchanged') { settle(f, !restore, true); return; }
            if (code === 'FORBIDDEN' || why === 'not_allowed') {
                ToastService.error('Not changed', 'Only the flight’s instructor or a club admin can mark it “no record needed” or put it back.');
            } else if (why === 'not_live') {
                ToastService.warning('Not changed', 'This flight was merged into another, or its claim was cancelled. Reload the page to see the list as it is now.');
            } else if (why === 'not_found') {
                ToastService.warning('Not changed', 'This flight is no longer on the club’s records. Reload the page to see the list as it is now.');
            } else if (why === 'not_eligible') {
                ToastService.warning('Not changed', 'This flight isn’t one that needs a training record, so there is nothing to mark.');
            } else if (code === 'TOO_MANY') {
                ToastService.error('Not changed', 'That was too many flights at once.');
            } else {
                ToastService.error(restore ? 'Not put back' : 'Not changed', (res && res.message) || 'That didn’t save. Please try again.');
            }
        });
    }
    /* the row fades to its muted "No record needed" state (or back), then the toast */
    function settle(f, off, already) {
        f._off = off;
        f._st = D.status(f);
        vm.confirmDismiss = null;
        regroup();
        $timeout(function () {
            if (off) { ToastService.success(already ? 'Already marked' : 'Marked as needing no record', f._reg + ' · ' + f._day + ' leaves your list when the page reloads. Undo puts it back.', { confetti: false }); }
            else { ToastService.success('Back on your list', f._reg + ' · ' + f._day + ' still needs a training record.', { confetti: false }); }
        }, 200, false);
    }

    /* ════════ Who was the student? ════════ */
    function resolve(f, ev) { stop(ev); if (!f || f.student || f._off || f._book) { return; } vm.rs = f; }
    /* a student attached: those flights flip to "To debrief" with "Student matched" (the list read again, in place) */
    function resolved(result) {
        vm.rs = null;
        ((result && result.ids) || []).forEach(function (id) { matched[id] = true; });
        load('quiet');
    }

    /* ════════ Entered for you: Confirm (ALREADY_SUPERSEDED → the row refreshed in place) ════════ */
    function confirmRec(r, ev) {
        stop(ev);
        if (!r || r._busy || r._done || r._leaving) { return; }
        r._busy = true;
        D.confirm(r.id).then(function (res) {
            r._busy = false;
            if (res && res.success !== false) {
                r._done = true;
                eRegroup(0);
                hint();
                $timeout(function () { ToastService.success('Record confirmed', r._name + ': your record is confirmed.', { confetti: false }); }, 200, false);
                return;
            }
            ToastService.handledInline();
            var code = res && res.error, cur = res && (res.current_id || (res.data && res.data.current_id));
            if (code === 'ALREADY_SUPERSEDED') { superseded(r, cur); }
            else if (code === 'NOTHING_TO_CONFIRM') { leave(r, function () { ToastService.warning('Nothing to confirm', 'This record doesn’t need your confirmation any more.'); }); }
            else if (code === 'NOT_FOUND') { leave(r, function () { ToastService.warning('Record not found', 'This record no longer exists.'); }); }
            else if (code === 'FORBIDDEN') { ToastService.error('Not allowed', 'Only the instructor named on a record can confirm it.'); }
            else { ToastService.error('Not confirmed', (res && res.message) || 'The record couldn’t be confirmed. Please try again.'); }
        });
    }
    /* edited since the list loaded: the live version takes the row's place, opened, with the reason */
    function superseded(r, currentId) {
        r._busy = true;
        D.awaiting().then(function (res) {
            r._busy = false;
            var list = res && res.success !== false && angular.isArray(res.records) ? res.records : null, live = null;
            if (list && currentId) { list.forEach(function (x) { if (+x.id === +currentId) { live = x; } }); }
            if (!live) {
                leave(r, function () { ToastService.warning('Record changed', 'This record was changed or deleted since the list loaded, so there is nothing to confirm here now.'); });
                return;
            }
            D.decorateRec(live, { aircraft: aircraftByReg() });
            live._fresh = true;
            var i = vm.recs.indexOf(r);
            if (i > -1) { vm.recs[i] = live; } else { vm.recs.unshift(live); }
            vm.open = live._key;
            eRegroup(0);
            ToastService.warning('Record changed', 'This record was edited since the list loaded. It has been refreshed: check it again before you confirm.');
        });
    }
    /* a row that leaves the list: it fades and collapses (~220 ms), goes, then the toast */
    function leave(r, after) {
        var el = document.getElementById('dbl-' + r._key);
        if (el) { el.style.setProperty('--h', el.offsetHeight + 'px'); }   // the collapse starts from the row's own height
        r._leaving = true;
        $timeout(function () {
            var i = vm.recs.indexOf(r);
            if (i > -1) { vm.recs.splice(i, 1); }
            if (vm.open === r._key) { vm.open = null; }
            eRegroup(0);
            hint();
            if (after) { after(); }
        }, reduce && reduce.matches ? 0 : 230);
    }

    /* ════════ a club admin: the way into Records to File ════════ */
    function adminLine() {
        var mine = I.managerClubs();
        if (!mine.length) { return; }
        var cur = I.me().current_club_admin, club = cur && mine.indexOf(+cur.id) > -1 ? +cur.id : mine[0];
        var title = cur && +cur.id === club ? cur.title : '';
        D.toFile(club).then(function (res) {
            var s = res && res.success !== false ? res.summary : null;
            if (!s) { return; }
            var n = (s.by_instructor || []).length, open = +s.open || 0;
            vm.admin = { title: title, nText: open ? ' (' + open.toLocaleString('en-GB') + (n ? ', across ' + D.plural(n, 'instructor') : '') + ')' : '' };
        });
    }

    /* ════════ the view, remembered in this tab (sessionStorage) ════════ */
    function readKey(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function saveView() {
        var S = vm.S, shown = vm.tab === 'todo' ? vm.shown : vm.eShown;
        try {
            sessionStorage.setItem(VIEW_KEY, JSON.stringify({ tab: vm.tab, club: S.club, chip: S.chip, sort: S.sort, find: S.find, find_info: vm.findInfo, q: S.q || '', shown: shown, at: Date.now() }));
            if (vm.tab === 'todo') { sessionStorage.setItem(V1_PAGE_KEY, String(Math.max(1, Math.ceil(shown / D.PAGE)))); }
        } catch (e) { /* storage off */ }
    }
    function remember(x) {
        saveView();
        try { sessionStorage.setItem(FOCUS_KEY, JSON.stringify({ key: x._key, at: Date.now() })); } catch (e) { /* storage off */ }
    }
    /* back from the debrief, the book-in or the record: that row, scrolled to and flashed once (when it is still here) */
    function flash(key) {
        var list = key.charAt(0) === 'f' ? vm.pool.slice(0, vm.shown) : vm.recs;
        if (!list.some(function (x) { return x._key === key; })) { return; }
        vm.flashKey = key;
        $timeout(function () {
            var el = document.getElementById('dbl-' + key);
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center' }); }
        }, 80, false);
        if (flashTimer) { $timeout.cancel(flashTimer); }
        flashTimer = $timeout(function () { vm.flashKey = null; }, 2800);
    }

    /* Esc: the search closes itself (<ta-combo> stops the key) and the dialog handles its own; then the question, then the row */
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented || vm.rs) { return; }
        if (vm.confirmDismiss) { $scope.$apply(function () { vm.confirmDismiss = null; }); return; }
        if (vm.open) { $scope.$apply(function () { vm.open = null; }); }
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        seq++; eseq++;
        cancelDim();
        if (typeTimer) { $timeout.cancel(typeTimer); }
        if (flashTimer) { $timeout.cancel(flashTimer); }
        $document.off('keydown', onKey);
        if (phoneMq && phoneMq.removeListener) { phoneMq.removeListener(onMq); }
    });
}


/* ═════ <dbl-resolve-dialog flight="vm.rs" on-done="vm.resolved(result)" on-close="vm.closeResolve()">
   "Who was the student?" — v1's MissingStudentResolveModalController as a record dialog in the aircraft's colour (a bottom sheet
   on phones): the members the sheet's name matches, a search of the club's members, or a temporary member; then this flight or
   every flight with the same name. Field ids kept from v1: field-msqm-first / -last / -email. ═════ */
app.directive('dblResolveDialog', function () {
    return {
        restrict: 'E',
        scope: { flight: '=', onDone: '&', onClose: '&' },
        templateUrl: 'views/v2/instructor_debriefs/resolve_dialog.html',
        controller: 'DebriefsResolveV2Controller',
        controllerAs: 'rs',
        bindToController: true
    };
});

app.controller('DebriefsResolveV2Controller', DebriefsResolveV2Controller);
DebriefsResolveV2Controller.$inject = ['$scope', '$timeout', '$document', '$window', 'InsCore', 'DebriefsV2Data', 'TaComboMatch', 'ToastService'];
function DebriefsResolveV2Controller($scope, $timeout, $document, $window, InsCore, DebriefsV2Data, TaComboMatch, ToastService) {
    var rs = this, D = DebriefsV2Data, M = TaComboMatch, f = rs.flight, seq = 0, timer = null, opener = document.activeElement, SHOW = 6;
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var sheet = f.suggested_student || {};
    rs.f = f;
    rs.step = 'pick';            // pick | confirm | create
    rs.loading = true;           // finding this flight's name group in the club's queue
    rs.group = null;             // { name_key, flight_count, flights, candidates }
    rs.cands = [];
    rs.others = [];              // the OTHER unknown flights with the same sheet name
    rs.othersText = '';
    rs.sel = null;               // the member chosen (a candidate or a search result): { id, first_name, last_name, name, email, temp, instructor, extra }
    rs.q = '';                   // the member search (in the dialog, as the design draws it)
    rs.search = { busy: false, q: '', rows: [], shown: [], more: '', err: false };
    rs.memberCount = null;       // "Search all 1,900 members" (else "Search all members")
    rs.scope = 'one';
    rs.form = { first: D.titleCase(sheet.first_name), last: D.titleCase(sheet.last_name), email: '' };
    rs.err = {};
    rs.busy = false;
    rs.sheet = D.sheetName(f);
    rs.example = String(sheet.last_name || sheet.first_name || 'smith').toLowerCase().replace(/[^a-z]/g, '').slice(0, 4) || 'smit';

    rs.memberCount = D.memberCount(f.club_id) ? D.memberCount(f.club_id).toLocaleString('en-GB') : null;
    D.queue(f.club_id).then(function (res) {
        rs.loading = false;
        var groups = res && res.success !== false ? res.groups || [] : [];
        groups.forEach(function (g) {
            if (rs.group) { return; }
            (g.flights || []).forEach(function (x) { if (+x.plane_log_sheet_id === +f.plane_log_sheet_id) { rs.group = g; } });
        });
        if (!rs.group) { return; }
        var g = rs.group;
        rs.cands = (g.candidates || []).slice(0, 5).map(function (c) { return person(c, D.MATCH[Math.max(0, Math.min(2, +c.score || 0))]); });
        // the "no name on the sheet" group isn't one person: only this flight
        rs.others = g.name_key ? (g.flights || []).filter(function (x) { return +x.plane_log_sheet_id !== +f.plane_log_sheet_id; })
            .map(function (x) { return { id: +x.plane_log_sheet_id, text: (x.registration || '') + ' ' + InsCore.fDay(x.flight_date) }; }) : [];
        rs.othersText = rs.others.map(function (x) { return x.text; }).join(' · ');
        rs.scope = rs.others.length ? 'all' : 'one';
        if (!rs.form.first && g.first_name) { rs.form.first = D.titleCase(g.first_name); }
        if (!rs.form.last && g.last_name) { rs.form.last = D.titleCase(g.last_name); }
    });

    function person(p, extra) {
        return { id: +(p.id || p.user_id), first_name: p.first_name || '', last_name: p.last_name || '', name: D.name(p), email: p.email || '',
            temp: +p.imported_user === 1, instructor: +p.instructor === 1, extra: extra || '' };
    }

    /* ── step 1: a candidate, or a member from the search (both are the same radio rows: picking one selects it) ── */
    rs.choose = function (c) { if (rs.busy) { return; } rs.sel = angular.extend({}, c); };
    rs.isOn = function (c) { return !!(rs.sel && rs.sel.id === c.id); };
    /* the club's current members (members/search: staff only), from two letters, 250 ms after the last key; the latest wins */
    rs.typed = function () {
        var q = String(rs.q || '').trim();
        if (timer) { $timeout.cancel(timer); timer = null; }
        var my = ++seq;
        rs.search.err = false;
        if (q.length < 2) { rs.search.q = q; rs.search.busy = false; rs.search.rows = []; rs.search.shown = []; rs.search.more = ''; return; }
        rs.search.busy = true;
        timer = $timeout(function () {
            D.members(f.club_id, q, 50).then(function (res) {
                if (my !== seq) { return; }
                rs.search.busy = false;
                rs.search.q = q;
                rs.search.err = !(res && res.success !== false);
                var t = M.toks(q), lq = q.toLowerCase();
                // the design's rule: every word starts a word of the name, or the email starts with what was typed (the server
                // matches anywhere; 50 rows, its most, so the filter rarely runs short)
                rs.search.rows = ((res && res.members) || []).map(function (m) { return person(m); }).filter(function (p) {
                    return t.every(function (tk) { return M.wordHit(p.name, tk); }) || p.email.toLowerCase().indexOf(lq) === 0;
                });
                // six shown, as the design does, then how many more match
                rs.search.shown = rs.search.rows.slice(0, SHOW);
                var extra = rs.search.rows.length - rs.search.shown.length, plus = res && res.more ? '+' : '';
                rs.search.more = extra > 0 ? extra + plus + ' more match: keep typing to narrow it down' : plus ? 'More match: keep typing to narrow it down' : '';
            });
        }, 250);
    };
    rs.next = function () { if (rs.sel && !rs.busy) { rs.step = 'confirm'; rs.err = {}; } };
    rs.toCreate = function () { if (rs.busy) { return; } rs.step = 'create'; rs.err = {}; if (!(phoneMq && phoneMq.matches)) { focus('field-msqm-first'); } };
    rs.back = function () { if (rs.busy) { return; } rs.step = 'pick'; rs.err = {}; };
    rs.setScope = function (s) { if (!rs.busy) { rs.scope = s; } };
    rs.fixed = function (k) {
        if (!rs.err[k]) { return; }
        if (k === 'email' || String(rs.form[k] || '').trim()) { delete rs.err[k]; }
    };
    rs.count = function () { return rs.scope === 'all' && rs.others.length ? rs.others.length + 1 : 1; };
    rs.goLabel = function () { var n = rs.count(); return (rs.step === 'create' ? 'Create and attach ' : 'Attach ') + (n > 1 ? D.plural(n, 'flight') : 'this flight'); };
    rs.plural = D.plural;

    /* ── save: attach the member (assign) or make a temporary member (create) ── */
    rs.save = function () {
        if (rs.busy) { return; }
        var all = !!(rs.scope === 'all' && rs.others.length && rs.group && rs.group.name_key), body, who, call, step = rs.step;
        if (step === 'confirm') {
            if (!rs.sel) { return; }
            body = all ? { user_id: rs.sel.id, name_key: rs.group.name_key, all: true } : { user_id: rs.sel.id, plane_log_sheet_ids: [f.plane_log_sheet_id] };
            who = rs.sel.name; call = D.assign;
        } else {
            var c = rs.form, first = String(c.first || '').trim(), last = String(c.last || '').trim(), email = String(c.email || '').trim();
            rs.err = {};
            if (!first) { rs.err.first = 'Enter their first name'; }
            if (!last) { rs.err.last = 'Enter their last name'; }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { rs.err.email = 'That email address doesn’t look right: check it, or leave it blank'; }
            if (rs.err.first || rs.err.last || rs.err.email) { focus(rs.err.first ? 'field-msqm-first' : rs.err.last ? 'field-msqm-last' : 'field-msqm-email'); return; }
            body = { first_name: first, last_name: last };
            if (all) { body.name_key = rs.group.name_key; body.all = true; } else { body.plane_log_sheet_ids = [f.plane_log_sheet_id]; }
            if (email) { body.email = email; }
            who = first + ' ' + last; call = D.create;
        }
        rs.busy = true;
        call(f.club_id, body).then(function (res) {
            rs.busy = false;
            if (res && res.success !== false) {
                var n = +res.flights_assigned || 0, they = n > 1 ? 'they’re' : 'it’s';
                var ids = all ? [f.plane_log_sheet_id].concat(rs.others.map(function (x) { return x.id; })) : [f.plane_log_sheet_id];
                if (step === 'create' && res.existing) {
                    ToastService.success('Temporary member reused', 'A temporary member called ' + who + ' was already at the club: ' + D.plural(n, 'flight') + ' attached to them, ready to debrief.', { confetti: false });
                } else if (step === 'create') {
                    ToastService.success('Temporary member created', who + ' attached to ' + D.plural(n, 'flight') + ': ' + they + ' ready to debrief. Turn them into a real account from Imported Users.', { confetti: false });
                } else {
                    ToastService.success('Student attached', who + ' attached to ' + D.plural(n || 1, 'flight') + ': ' + they + ' ready to debrief.', { confetti: false });
                }
                rs.onDone({ result: { ids: ids, name: who, count: n } });
                return;
            }
            ToastService.handledInline();
            var code = res && res.error;
            if (code === 'NAME_REQUIRED') { rs.err = {}; if (!String(rs.form.first || '').trim()) { rs.err.first = 'Enter their first name'; } if (!String(rs.form.last || '').trim()) { rs.err.last = 'Enter their last name'; } if (!rs.err.first && !rs.err.last) { rs.err.first = 'Enter their first name'; } focus('field-msqm-first'); }
            else if (code === 'INVALID_EMAIL') { rs.err = { email: 'That email address doesn’t look right: check it, or leave it blank' }; focus('field-msqm-email'); }
            else if (code === 'USER_NOT_FOUND' || code === 'USER_REQUIRED') { ToastService.warning('Member not found', 'That member couldn’t be found any more. Search for them again.'); rs.step = 'pick'; rs.sel = null; }
            else if (code === 'NO_FLIGHTS') { ToastService.warning('Nothing attached', 'This flight already has a student, or it isn’t one the club’s missing-students queue can fix (a flight with a booking). Reload the page to see it as it is now.'); }
            else if (code === 'FORBIDDEN') { ToastService.error('Not allowed', 'Only the club’s instructors and admins can say who flew.'); }
            else { ToastService.error('Not saved', (res && res.message) || 'That didn’t save. Please try again.'); }
        });
    };

    /* × / Cancel / Esc / the scrim close — never while it saves */
    rs.close = function () { if (!rs.busy) { rs.onClose(); } };
    rs.scrim = function (e) { if (e && e.target === e.currentTarget) { rs.close(); } };
    function focus(id) { $timeout(function () { var el = document.getElementById(id); if (el) { el.focus(); } }, 30, false); }
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented) { return; }
        $scope.$apply(rs.close);
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        seq++;
        if (timer) { $timeout.cancel(timer); }
        $document.off('keydown', onKey);
        if (opener && opener.focus && document.body.contains(opener)) { try { opener.focus(); } catch (e) { /* gone */ } }
    });
    $timeout(function () { var el = document.querySelector('body > .dbl-rs-scrim .ta-dlg'); if (el) { el.focus(); } }, 40, false);
}
