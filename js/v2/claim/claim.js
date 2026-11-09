/* ═══════════════════════════════════════════════════════════════════════════
   v2 CLAIM A FLIGHT — design: mockups/my-account/claim-journey.html (approved). Beside v1
   (views/my_account/claim_a_flight.html, ClaimAFlightController) behind the global v2 switch (js/v2/core/design.js).
   Same server calls as v1: FoxService.GetFoxEntries (GET fox/user/{id}) and GetFoxEntriesByPlane (fox/plane/{id}?offset).
   "This was me" goes straight to the book-in (dashboard.my_account.book_in {id: plane_log_sheet_id}), as v1's CLAIM.
   Styles: css/v2/claim.css (.cj-*), on css/ta-base.css. The aircraft search is <ta-combo> (js/v2/logbook/logbook.js),
   with TaComboMatch + LgbFmt from that file.

   My journey log is retired in v2 (owner, 6 Nov 2026 — mockup notes "My journey log: retired"): the v1 state maps to
   dashboard.v2.my_journey_log, which hands over to the v2 logbook (same flights; the accepted gaps are in the notes).

   Backend C6 (be-alex-3e.md, landed 19:39): each fox/user aircraft carries aircraft_colour (the row edge) and
   open_total (the flights the list can actually hand out — used for every count; total_unclaimed / total stay for
   paging only, next_offset is in raw entry space), and every row carries has_track (the replay button).
   Backend C26 (B27, landed 12:07): each flight may carry match_booking { booking_id, start, end, kind, instructor } — the
   member's OWN booking on that aircraft that was never booked out (last 60 days). Those flights go first, in the
   mockup's "Looks like yours" card with a "Your 09:00–10:30 booking" pill, and "This was me" opens the book-in WITH the
   booking (dashboard.my_account.book_in { id: sheet, booking_id }) so the book-in links it instead of creating one.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.claim_a_flight', {
            url: '/my_account/claim_a_flight',
            templateUrl: 'views/v2/claim/claim.html',
            controller: 'ClaimV2Controller', controllerAs: 'vm'
        })
        .state('dashboard.v2.my_journey_log', {
            url: '/my_account/my_journey_log',
            template: '<main class="ta-page"><p class="ta-hint">Opening your logbook…</p></main>',
            controller: ['$state', '$timeout', function ($state, $timeout) {
                $timeout(function () { $state.go('dashboard.v2.logbook', {}, { location: 'replace' }); });
            }]
        });
    DesignRoutesProvider
        .map('dashboard.my_account.claim_a_flight', 'dashboard.v2.claim_a_flight')
        .map('dashboard.my_account.my_journey_log', 'dashboard.v2.my_journey_log');
}]);

app.controller('ClaimV2Controller', ClaimV2Controller);

ClaimV2Controller.$inject = ['FoxService', 'TimeDisplayService', 'ToastService', 'TaComboMatch', 'LgbFmt', 'SalesEnquiryService', 'DesignService', '$rootScope', '$scope', '$state', '$q', '$timeout', '$window', '$document', '$sce'];
function ClaimV2Controller(FoxService, TimeDisplayService, ToastService, TaComboMatch, LgbFmt, SalesEnquiryService, DesignService, $rootScope, $scope, $state, $q, $timeout, $window, $document, $sce) {
    var vm = this, F = LgbFmt, M = TaComboMatch;
    var LOAD_MORE = 20, FIRST_PAGE = 10;

    vm.user = $rootScope.globals.currentUser;
    vm.T = F.today();
    vm.Fmt = F;
    vm.loading = true;
    vm.loadError = false;
    vm.clubs = [];
    vm.acf = 'all';            // what the page is about: 'all' | 'club:<name>' | a registration
    vm.acq = '';               // the letters typed in the search (filters the list live)
    vm.open = null;
    vm.howOpen = false;
    vm.dlg = null;
    vm.loadingMore = false;
    /* the times dialog's words, as approved in the mockup (the modes themselves stay TimeDisplayService's) */
    var MODE_COPY = {
        block_rounded:    { title: 'Brakes off → brakes on', sub: 'Rounded to the nearest 5 minutes — the logbook convention' },
        block_exact:      { title: 'Brakes off → brakes on', sub: 'Exactly as recorded, to the minute' },
        airborne_rounded: { title: 'First take-off → last landing', sub: 'Rounded to the nearest 5 minutes; taxi time not shown' },
        airborne_exact:   { title: 'First take-off → last landing', sub: 'Exactly as the tracker recorded it, to the minute' }
    };
    vm.MODES = TimeDisplayService.MODES.map(function (m) { return angular.extend({}, m, MODE_COPY[m.value] || {}); });

    var mq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    vm.phone = !!(mq && mq.matches);
    function onMq() { $scope.$applyAsync(function () { vm.phone = !!mq.matches; }); }
    if (mq) { if (mq.addEventListener) { mq.addEventListener('change', onMq); } else if (mq.addListener) { mq.addListener(onMq); } }
    function onKey(ev) {
        if ((ev.key !== 'Escape' && ev.key !== 'Esc') || ev.defaultPrevented || !vm.dlg) { return; }
        $scope.$apply(function () { vm.dlg = null; });
    }
    $document.on('keydown', onKey);
    var offTd = $scope.$on(TimeDisplayService.EVENT, function () { if (!vm.clubs.length) { return; } retime(); if (vm.fleet) { view(); } });
    $scope.$on('$destroy', function () {
        offTd(); $document.off('keydown', onKey);
        if (mq) { if (mq.removeEventListener) { mq.removeEventListener('change', onMq); } else if (mq.removeListener) { mq.removeListener(onMq); } }
    });

    // ── times (TimeDisplayService: viewer override > aircraft > club) ──
    // FoxService puts an HTTP error's raw body in .message — an HTML page must never reach a toast (UX pass 2)
    function safeMsg(m) { return typeof m === 'string' && m.length < 240 && m.indexOf('<') === -1 ? m : ''; }
    function hasNum(v) { return v !== null && v !== undefined && v !== ''; }
    function clean(t) { var m = String(t || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m && !/^0000-00-00/.test(String(t)) ? F.p2(+m[1]) + ':' + m[2] + ':' + (m[3] || '00') : null; }
    function exact(t) { var c = clean(t); if (!c) { return null; } return $window.roundTimeToMinute ? $window.roundTimeToMinute(c) : c.slice(0, 5); }
    function minsOf(hm) { var m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); return m ? +m[1] * 60 + (+m[2]) : null; }
    function between(a, b) { var x = minsOf(a), y = minsOf(b); if (x === null || y === null) { return null; } var d = y - x; return d < 0 ? d + 1440 : d; }
    function hmMins(m) { return m === null ? '—' : Math.floor(m / 60) + ':' + F.p2(m % 60); }
    function modeFor(f) { return TimeDisplayService.resolve(f.club_id, f.plane_time_display || null); }
    function firstClubId() { return vm.clubs.length ? vm.clubs[0].club_id : null; }
    vm.modeDef = function () {
        var o = TimeDisplayService.getViewerOverride();
        return TimeDisplayService.def(o || TimeDisplayService.clubModeSync(firstClubId()) || TimeDisplayService.DEFAULT_MODE);
    };
    vm.clubDef = function () { return TimeDisplayService.def(TimeDisplayService.clubModeSync(firstClubId()) || TimeDisplayService.DEFAULT_MODE); };
    vm.isOverride = function () { return !!TimeDisplayService.getViewerOverride(); };

    // ── "most accurate wins": the track file's figure when it was analysed cleanly, else the tracker's ──
    function trackOk(f) { return f.track_calculated_status === 'ok' && (hasNum(f.airborne_seconds_calculated) || hasNum(f.landings_calculated)); }
    function bestAirSec(f) { return trackOk(f) && Number(f.airborne_seconds_calculated) > 0 ? Number(f.airborne_seconds_calculated) : Number(f.airborne_seconds || 0); }
    function bestLdg(f) { return trackOk(f) && hasNum(f.landings_calculated) ? Number(f.landings_calculated) : Number(f.number_landings || 0); }
    function sourceTip(f, what) { return (what === 'landings' ? 'Landings ' : 'Airborne time ') + (trackOk(f) ? 'from the recorded track file' : 'recorded by the tracker'); }
    function ldgBreakdown(f) {
        if (!trackOk(f)) { return 'counted by the tracker'; }
        var b = [];
        if (+f.full_stop_landings_calculated) { b.push(f.full_stop_landings_calculated + ' full stop'); }
        if (+f.stop_and_go_calculated) { b.push(f.stop_and_go_calculated + ' stop-and-go'); }
        if (+f.touch_and_go_calculated) { b.push(f.touch_and_go_calculated + ' touch-and-go'); }
        if (+f.go_arounds_calculated) { b.push(f.go_arounds_calculated + ' go-around'); }
        return (b.length ? b.join(', ') : 'none') + ' — from the recorded track';
    }
    /* ONE status helper for claim rows — raw track statuses never reach the screen */
    function claimFlag(f) {
        if (+f.split_leg === 2) { return { tone: 'info', icon: 'fa-cut', label: 'Part 2 of a split flight', why: 'The first part of this flight is already booked in; this is the rest of it.' }; }
        if (f.track_calculated_status === 'file_mismatch') { return { tone: 'warn', icon: 'fa-exclamation-triangle', label: 'Track doesn’t match', why: 'The recording on file isn’t this flight, so the tracker’s own times and landings are used.' }; }
        if (f.track_calculated_status === 'no_events') { return { tone: 'muted', icon: 'fa-question-circle', label: 'No take-offs in the track', why: 'The track was checked but no take-offs or landings could be found in it; the tracker’s figures are used.' }; }
        return null;
    }
    function whenWord(d) { var g = F.daysBetween(d, vm.T); return g === 0 ? 'today' : g === 1 ? 'yesterday' : F.fDay(d); }

    /* the member's own booking this flight falls in (C26): "Your 09:00–10:30 booking" */
    function matchOf(f) {
        var m = f.match_booking;
        if (!m || !m.booking_id) { return null; }
        var hm = function (s) { var x = /(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(String(s || '')); return x ? (x[1].length === 1 ? '0' : '') + x[1] + ':' + x[2] : ''; };
        var from = hm(m.start), to = hm(m.end), day = String(m.start || '').slice(0, 10);
        var other = /^\d{4}-\d{2}-\d{2}$/.test(day) && day !== f.flight_date;   // a booking that started the day before
        return { id: m.booking_id, kind: m.kind || '', instructor: m.instructor || null,
            label: 'Your ' + (other ? F.fDay(day) + ' ' : '') + (from && to ? from + '–' + to + ' ' : '') + 'booking' };
    }
    /* the route line, built once per row (escaped) — the mockup puts it straight into .ta-row__sub, no wrapper span */
    function routeHtml(r) {
        var E = TaComboMatch.esc;
        if (!r) { return '<span class="ta-muted">Airfields not recorded</span>'; }
        if (r.local) { return '<b class="ta-icao">' + E(r.from) + '</b> ' + E(r.fromName) + ' · local'; }
        return '<b class="ta-icao">' + E(r.from) + '</b> ' + E(r.fromName) + ' → <b class="ta-icao">' + E(r.to) + '</b> ' + E(r.toName);
    }

    // ── one flight row, ready to show (times re-picked when the time display changes) ──
    function prepFlight(f, p) {
        f.registration = p.reg; f.plane_type = p.type; f.type_name = p.model; f.club_id = p.club_id; f.club_name = p.club;
        f.plane_time_display = p.time_display; f.plane_id = p.plane_id;
        f._k = 'c' + f.id;
        f.flight_date = String(f.flight_date || (f.brakes_off || '')).slice(0, 10);
        f._stamp = f.flight_date + ' ' + (clean(f.brakes_off) || '00:00:00');
        f._ac = p.colour;
        f._air = F.hm(bestAirSec(f) / 3600);
        f._airTip = sourceTip(f, 'airborne') + ' — ' + (bestAirSec(f) / 3600).toFixed(2) + ' h';
        f._ldg = bestLdg(f);
        f._ldgTip = sourceTip(f, 'landings');
        f._ldgWords = ldgBreakdown(f);
        f._airWords = sourceTip(f, 'airborne').replace('Airborne time ', '');
        f._flag = claimFlag(f);
        var a = f.from_airfield_code, b = f.to_airfield_code;
        f._route = (!a && !b) ? null : { from: a || '?', fromName: f.from_airfield_name || (a ? '' : 'unknown'), to: b || '?', toName: f.to_airfield_name || (b ? '' : 'unknown'), local: !!a && a === b };
        f._canReplay = f.has_track === true;
        f._match = matchOf(f);
        f._sub = $sce.trustAsHtml(routeHtml(f._route) + '<span class="ta-phone-only"> · ' + TaComboMatch.esc(F.plural(f._ldg, 'landing')) + '</span>');
        timeRow(f);
        return f;
    }
    function timeRow(f) {
        var mode = modeFor(f), v = TimeDisplayService.pick(f, mode), d = TimeDisplayService.def(mode);
        f._t = { from: v.from, to: v.to, dur: v.durationHM, tip: v.tooltip, window: v.window };
        f._rounded = d.rounded;
        f._pts = [['Brakes off', f.brakes_off, false], ['Take-off', f.takeoff_time, true], ['Landing', f.landing_time, true], ['Brakes on', f.brakes_on, false]].map(function (x) {
            var c = clean(x[1]); return { k: x[0], air: x[2], v: c ? exact(c) : '—', r: c && d.rounded ? TimeDisplayService.roundToFive(c) : '' };
        });
        f._shownK = v.window === 'block' ? 'Block' : 'Airborne';
        f._blockExact = hmMins(between(exact(f.brakes_off), exact(f.brakes_on)));
    }
    function retime() {
        vm.clubs.forEach(function (c) { c.planes.forEach(function (p) { p.flights.forEach(timeRow); p.latest = p.flights[0] ? whenWord(p.flights[0].flight_date) + ' ' + p.flights[0]._t.from : ''; }); });
        vm.winLabel = vm.modeDef().window === 'block' ? 'Brakes off → on' : 'Take-off → landing';
    }

    // ── load ──
    function load() {
        vm.loading = true; vm.loadError = false;
        FoxService.GetFoxEntries(vm.user.id).then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                vm.loadError = true; vm.clubs = [];
                ToastService.error('Could not load the flights to claim', safeMsg(data && data.message) || 'Please try again.');
                return;
            }
            vm.clubs = (data.to_claim || []).map(function (club) {
                var cid = club.club_id || club.id || null;
                if (cid) { TimeDisplayService.loadClubMode(cid); }
                return { club_id: cid, club: club.club_name || 'Your club', planes: (club.aircraft || []).map(function (pl) {
                    var tn = pl.type_name && String(pl.type_name).trim() !== '-' ? pl.type_name : '';
                    var p = { reg: pl.registration || '—', plane_id: pl.plane_id, type: pl.plane_type || '', model: tn || pl.plane_type || '', club: club.club_name || 'Your club', club_id: cid,
                        tracker: !!pl.imei, time_display: pl.time_display || null, colour: pl.aircraft_colour || pl.bg_colour || pl.colour || null,
                        has_more: pl.has_more, next_offset: pl.next_offset, total: +pl.total_unclaimed || 0, open_total: hasNum(pl.open_total) ? +pl.open_total : null, exhausted: false };
                    p.flights = (pl.flights || []).map(function (f) { return prepFlight(f, p); }).sort(function (a, b) { return b._stamp.localeCompare(a._stamp); });
                    return p;
                }) };
            });
            retime();
            build();
        });
    }
    vm.retry = load;

    // ── the fleet, the view and the list ──
    function olderOf(p) {
        if (p.exhausted || p.has_more === false) { return 0; }
        if (p.open_total !== null && p.open_total !== undefined) { return Math.max(0, p.open_total - p.flights.length); }   // C6: the honest count
        if (p.has_more === true) { return Math.max(1, p.total - (hasNum(p.next_offset) ? +p.next_offset : p.flights.length)); }
        if (p.has_more === false) { return 0; }
        return p.flights.length >= FIRST_PAGE - 2 ? null : 0;   // legacy API: "the first page looked full", count unknown
    }
    function waiting(p) { return p.flights.length + (p.older || 0); }
    function build() {
        var fleet = [];
        vm.clubs.forEach(function (c) { c.planes.forEach(function (p) { p.older = olderOf(p); p.n = waiting(p); fleet.push(p); }); });
        vm.fleet = fleet;
        vm.trackers = fleet.filter(function (p) { return p.tracker; });
        vm.trackerClubs = [];
        vm.clubs.forEach(function (c) { var t = c.planes.filter(function (p) { return p.tracker; }); if (t.length) { vm.trackerClubs.push({ club: c.club, planes: t }); } });
        vm.all = [];
        fleet.forEach(function (p) { vm.all = vm.all.concat(p.flights); });
        vm.total = fleet.reduce(function (s, p) { return s + p.n; }, 0);
        vm.withFlights = fleet.filter(function (p) { return p.n; }).length;
        vm.hint = vm.all.length ? F.plural(vm.total, 'flight') + ' on ' + F.plural(vm.withFlights, 'aircraft', 'aircraft') + ' that nobody has booked in yet'
            : 'Flights your clubs’ trackers recorded that nobody has booked in yet';
        var newest = fleet.filter(function (p) { return p.flights.length; }).sort(function (a, b) { return b.flights[0]._stamp.localeCompare(a.flights[0]._stamp); })[0];
        vm.placeholder = newest ? 'Search aircraft: ' + newest.reg.slice(-2) + ' finds ' + newest.reg : 'Search aircraft';
        vm.enqCtx = enqContext();
        vm.enqClubId = vm.clubs.length === 1 ? (vm.clubs[0].club_id || null) : null;   // the question is filed under the club when there's only one
        view();
    }
    /* "Ask us about trackers" (sales enquiries, js/v2/enquiries): the member's clubs and aircraft go with the question,
       shown in the dialog first and only sent while "Include these details" stays on */
    function enqContext() {
        var items = [], clubs = vm.clubs.map(function (c) { return c.club; }).filter(Boolean);
        var regs = vm.fleet.map(function (p) { return p.reg; }).filter(function (r) { return r && r !== '—'; });
        if (clubs.length) { items.push({ k: clubs.length === 1 ? 'Club' : 'Clubs', v: clubs.join(', ') }); }
        if (regs.length) { items.push({ k: 'Aircraft', v: regs.slice(0, 8).join(', ') + (regs.length > 8 ? ' and ' + (regs.length - 8) + ' more' : '') }); }
        items.push({ k: 'Trackers fitted', v: vm.trackers.length ? vm.trackers.map(function (p) { return p.reg; }).join(', ') : 'None yet' });
        return { source: 'claim_a_flight', page: 'Claim a flight', items: items };
    }
    // the questions this member has sent ToAviate — a quiet link at the end of the page when there are any
    vm.enq = { n: 0, answered: 0 };
    SalesEnquiryService.Mine().then(function (data) {
        if (!data || data.success === false) { return; }
        var list = (data.enquiries || []).map(SalesEnquiryService.normEnquiry);
        vm.enq = { n: list.length, answered: list.filter(function (e) { return e.status === 'answered'; }).length };
    });
    $scope.$on('enq:created', function () { vm.enq = { n: vm.enq.n + 1, answered: vm.enq.answered }; });
    function hay(p) { return { reg: p.reg, hay: p.type + ' ' + p.model + ' ' + p.club }; }
    function view() {
        var q = (vm.acq || '').trim(), v;
        if (q) { v = { kind: 'q', q: q, planes: M.matches(vm.fleet, q, hay, false) }; }
        else if (vm.acf.indexOf('club:') === 0) { var c = vm.acf.slice(5); v = { kind: 'club', club: c, planes: vm.fleet.filter(function (p) { return p.club === c; }) }; }
        else if (vm.acf !== 'all') { v = { kind: 'ac', planes: vm.fleet.filter(function (p) { return p.reg === vm.acf; }) }; if (!v.planes.length) { vm.acf = 'all'; v = { kind: 'all', planes: vm.fleet }; } }
        else { v = { kind: 'all', planes: vm.fleet }; }
        v.n = v.planes.reduce(function (s, p) { return s + p.n; }, 0);
        vm.v = v;
        var regs = {};
        v.planes.forEach(function (p) { regs[p.plane_id] = 1; });
        var shown = vm.all.filter(function (f) { return regs[f.plane_id]; }).sort(function (a, b) { return b._stamp.localeCompare(a._stamp); });
        vm.shownN = shown.length;
        // flights in the member's own bookings go first ("Looks like yours"), the rest by day
        var mine = shown.filter(function (f) { return f._match; }), rest = shown.filter(function (f) { return !f._match; });
        vm.mine = mine.map(function (f) { return { k: f._k, f: f }; });
        vm.restN = rest.length;
        var days = [], byDay = {};
        rest.forEach(function (f) { if (!byDay[f.flight_date]) { byDay[f.flight_date] = { d: f.flight_date, rows: [] }; days.push(byDay[f.flight_date]); } byDay[f.flight_date].rows.push(f); });
        days.forEach(function (g) { g.label = (g.d === vm.T ? 'Today · ' : '') + F.fDay(g.d); g.n = F.plural(g.rows.length, 'flight'); });
        vm.days = days;
        var flat = [];
        days.forEach(function (g) { flat.push({ k: 'g' + g.d, g: g }); g.rows.forEach(function (f) { flat.push({ k: f._k, f: f }); }); });
        vm.flat = flat;
        vm.sections = (vm.mine.length ? [{ k: 'mine', mine: true, flat: vm.mine }] : []).concat([{ k: 'all', mine: false, flat: flat }]);
        // the older-flights footer: one line however many aircraft are in view
        var left = v.planes.filter(function (p) { return p.older === null || p.older > 0; });
        vm.foot = null;
        if (left.length) {
            var known = left.every(function (p) { return p.older !== null; }), n = left.reduce(function (s, p) { return s + (p.older || 0); }, 0);
            vm.foot = { more: true, text: (known ? F.plural(n, 'older flight') : 'Older flights') + ' on ' + (left.length === 1 ? left[0].reg : left.length + ' aircraft') };
        } else if (v.planes.some(function (p) { return p.loadedMore; })) {
            vm.foot = { more: false, text: 'That’s every unclaimed flight' + (v.planes.length === 1 ? ' on ' + v.planes[0].reg : '') + '.' };
        }
        // the empty state for what was picked or typed
        vm.vempty = null;
        if (!shown.length) {
            if (!v.planes.length) { vm.vempty = { ic: 'fa-search', t: 'No aircraft matches “' + v.q + '”', d: 'Only aircraft at your clubs are searched. Try the last two letters of the registration, or a type like C152.' }; }
            else if (v.planes.length === 1 && !v.planes[0].tracker) { vm.vempty = { ic: 'fa-satellite-dish', t: v.planes[0].reg + ' has no tracker fitted', d: 'Its flights can’t show up here. If you flew it, book in from your booking instead, or ask ' + v.planes[0].club + '.', bookings: true }; }
            else if (v.planes.length === 1) { vm.vempty = { ic: 'fa-check', t: 'Nothing to claim on ' + v.planes[0].reg, d: 'Every flight its tracker recorded has been booked in. New flights show up here soon after landing.' }; }
            else { vm.vempty = { ic: 'fa-check', t: 'Nothing to claim on these aircraft', d: 'Every flight their trackers recorded has been booked in.' }; }
        }
        // the search field when closed
        var one = v.kind === 'ac' ? v.planes[0] : null;
        vm.acValue = one ? { ac: { reg: one.reg, type: one.type, colour: one.colour, title: one.reg + ' · ' + one.model } } : v.kind === 'club' ? { tag: v.club } : null;
        vm.acSummary = one ? null : { pre: (v.kind === 'all' ? 'All aircraft' : F.plural(v.planes.length, 'aircraft', 'aircraft')) + ' · ', b: F.plural(v.n, 'flight') };
        vm.banner = one ? { p: one, n: one.n, latest: one.flights[0] ? F.fDay(one.flights[0].flight_date) + ', ' + one.flights[0]._t.from : '' } : null;
        vm.cbVer = (vm.cbVer || 0) + 1;
    }
    $scope.$watch(function () { return vm.acq; }, function (n, o) { if (n !== o && vm.fleet) { vm.open = null; view(); } });

    // ── the aircraft search (picker B): grouped by club, what can be claimed first, newest first ──
    vm.acGroups = function (q) {
        q = (q || '').trim();
        var list = vm.fleet || [], clubs = [], groups = [];
        list.forEach(function (p) { if (clubs.indexOf(p.club) < 0) { clubs.push(p.club); } });
        var hits = q ? M.matches(list, q, hay, false) : list;
        function sc(p) { return q ? M.score(p.reg, hay(p).hay, q) : 0; }
        function rank(a, b) { return (sc(b) - sc(a)) || ((b.tracker ? 1 : 0) - (a.tracker ? 1 : 0)) || ((b.n ? 1 : 0) - (a.n ? 1 : 0)) || ((b.flights[0] ? b.flights[0]._stamp : '').localeCompare(a.flights[0] ? a.flights[0]._stamp : '')) || (a.reg < b.reg ? -1 : 1); }
        function row(p) {
            return { key: p.reg, ac: p.colour || null, t: p.reg, s: p.model + (clubs.length > 1 && q ? ' · ' + p.club : ''), on: !q && vm.acf === p.reg, quiet: !p.n,
                r: !p.tracker ? 'No tracker' : p.n ? F.plural(p.n, 'flight') : 'Nothing to claim', rs: p.flights[0] ? 'latest ' + p.latest : '' };
        }
        if (!q) { groups.push({ rows: [{ key: 'all', lead: 'fa-plane', t: 'All aircraft', s: vm.withFlights + ' of ' + list.length + ' have flights to claim', r: F.plural(vm.total, 'flight'), on: vm.acf === 'all', noHl: true }] }); }
        clubs.forEach(function (c) {
            var inClub = list.filter(function (p) { return p.club === c; }), ps = inClub.filter(function (p) { return hits.indexOf(p) > -1; }).sort(rank), rows = ps.map(row);
            if (!q && clubs.length > 1) { rows.unshift({ key: 'club:' + c, lead: 'fa-layer-group', t: 'All at ' + c, s: F.plural(inClub.length, 'aircraft', 'aircraft'), r: F.plural(inClub.reduce(function (s, p) { return s + p.n; }, 0), 'flight'), on: vm.acf === 'club:' + c, noHl: true }); }
            groups.push({ label: c, right: q ? ps.length + (ps.length === 1 ? ' match' : ' matches') : F.plural(inClub.length, 'aircraft', 'aircraft'), rows: rows });
        });
        return { groups: groups, empty: { t: 'No aircraft matches “' + q + '”', s: 'Try the last two letters of the registration, or a type like C152.' } };
    };
    vm.acPick = function (key) { vm.acf = key; vm.acq = ''; vm.open = null; view(); };
    vm.acClear = function () { vm.acf = 'all'; vm.acq = ''; vm.open = null; view(); };

    // ── rows ──
    vm.toggle = function (f) { vm.open = vm.open === f._k ? null : f._k; };
    vm.claim = function (f, ev) {
        if (ev) { ev.stopPropagation(); }
        if (!f.plane_log_sheet_id) { ToastService.warning('This flight can’t be claimed yet', 'Its journey log entry isn’t ready. Try again in a minute.'); return; }
        // a flight in the member's own booking: the book-in links that booking (C26) instead of starting from nothing.
        // booking_id is a query param of the v2 book-in only (the v1 state has no such param, so a mapped jump would drop it)
        if (f._match && DesignService.isV2()) { $state.go('dashboard.v2.book_in', { id: f.plane_log_sheet_id, booking_id: f._match.id }); return; }
        $state.go('dashboard.my_account.book_in', { id: f.plane_log_sheet_id });
    };
    vm.replay = function (f, ev) {
        if (ev) { ev.stopPropagation(); }
        if (!f._canReplay) { return; }
        $state.go('dashboard.flight_replay', { flight_id: f.plane_log_sheet_id });
    };

    // ── older flights: the next 20 for each aircraft in view that has more ──
    vm.more = function () {
        if (vm.loadingMore) { return; }
        var ps = vm.v.planes.filter(function (p) { return p.older === null || p.older > 0; });
        if (!ps.length) { return; }
        vm.loadingMore = true;
        $q.all(ps.map(function (p) {
            var offset = hasNum(p.next_offset) ? +p.next_offset : p.flights.length;
            return FoxService.GetFoxEntriesByPlane(p.plane_id, offset, LOAD_MORE).then(function (data) {
                if (!data || data.success === false) { return { p: p, err: safeMsg(data && data.message) || 'Please try again.' }; }
                var seen = {}, added = 0;
                p.flights.forEach(function (f) { seen[f.id] = true; });
                (data.fox_entries || []).forEach(function (f) { if (!seen[f.id]) { seen[f.id] = true; p.flights.push(prepFlight(f, p)); added++; } });
                p.flights.sort(function (a, b) { return b._stamp.localeCompare(a._stamp); });
                p.loadedMore = true;
                if (hasNum(data.open_total)) { p.open_total = +data.open_total; }
                if (data.has_more !== undefined) { p.has_more = !!data.has_more; p.next_offset = data.next_offset; if (hasNum(data.total)) { p.total = +data.total; } }
                else if (!added) { p.exhausted = true; return { p: p, legacyEnd: true }; }
                else { p.next_offset = offset + (data.fox_entries || []).length; }
                return { p: p };
            });
        })).then(function (res) {
            vm.loadingMore = false;
            var err = res.filter(function (r) { return r.err; })[0];
            if (err) { ToastService.error('Could not load more flights', err.err); }
            if (res.some(function (r) { return r.legacyEnd; })) { ToastService.warning('No more flights', 'That’s everything the server can return for now.'); }
            retime();
            build();
        });
    };

    // ── how flight times are shown (the viewer's choice, on this device) ──
    vm.openTimes = function () { vm.dlg = 'td'; $timeout(function () { var x = document.querySelector('.ta-dlg .ta-dlg__x'); if (x) { x.focus(); } }, 60); };
    vm.closeDlg = function () { vm.dlg = null; };
    vm.scrim = function (ev) { if (ev.target === ev.currentTarget) { vm.dlg = null; } };
    vm.setMode = function (m) { TimeDisplayService.setViewerOverride(m === vm.clubDef().value ? null : m); };
    vm.resetMode = function () { TimeDisplayService.setViewerOverride(null); };
    vm.modeIcon = function (m) { return m.window === 'block' ? (m.rounded ? 'fa-clock' : 'fa-stopwatch') : (m.rounded ? 'fa-plane-departure' : 'fa-plane'); };

    load();
}
