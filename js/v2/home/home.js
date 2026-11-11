/* ═══════════════════════════════════════════════════════════════════════════
   v2 screen: home — design: mockups/my-account/home.html (approved "Home — v2 compact" + "Reminders").
   Built 8 Nov 2026 beside v1 (views/my_account/home.html + MyAccountController, views/my_account/reminders.html +
   RemindersController), switched by the global v2 switch (js/v2/core/design.js).

   States:
     dashboard.v2.home       /my_account            ← dashboard.my_account
     dashboard.v2.reminders  /my_account/reminders  ← dashboard.my_account.reminders
   (v1's other My Account pages are children of dashboard.my_account; mapping the parent moves only the home itself.)

   Home data — v1's calls plus the v2 list:
     plane_log_sheets/incomplete/{me}      bookouts to book in (the sheet id Book in needs)   BookoutService.GetBookoutsToComplete
     bookings/user_bookings_today/{me}     to_pay + to_complete_split (+ the instructor's suggested lesson for Brief)
     bookings/v2/upcoming (C1)             today's bookings with can_book_out / can_cancel, and "Coming up"
     payment-mode banner, vouchers probe, assigned-to-me count, past-training probe — exactly as v1.
   Writes: cancel book-out (DELETE plane_log_sheets/{id}, confirmed in place), cancel booking (the shared
   <bkg-cancel-dialog> from js/v2/bookings/bookings.js — reason + fee, DELETE bookings/{id}?reason&notes).

   GET my_account/v2/summary (contract C29): the "Needs you" chips / "All up to date", every tile's live status line (in its
   tone) and the training / safety badges. An open Suggest-a-time offer (C44, offers[] on bookings/v2/upcoming) adds its
   own "Needs you" chip first → My bookings ?offer={id}. If it fails the page quietly stays as before (no chips, no lines). Still hidden:
   the new-member "Get ready to fly" checklist (an open owner decision). See mockups/v2-build/fe-home-bookings.md.
   Page CSS: css/v2/home.css (.hm-* / .hmc-*).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.home', {
            url: '/my_account',
            templateUrl: 'views/v2/home/home.html',
            controller: 'HomeV2Controller', controllerAs: 'vm'
        })
        .state('dashboard.v2.reminders', {
            url: '/my_account/reminders',
            templateUrl: 'views/v2/home/reminders.html',
            controller: 'RemindersV2Controller', controllerAs: 'vm'
        });
    DesignRoutesProvider
        .map('dashboard.my_account', 'dashboard.v2.home')
        .map('dashboard.my_account.reminders', 'dashboard.v2.reminders');
}]);


// ═══════════════════════════════════════════════════════════════════════
// My Account home — v2 compact
// ═══════════════════════════════════════════════════════════════════════
app.controller('HomeV2Controller', HomeV2Controller);
HomeV2Controller.$inject = ['$rootScope', '$scope', '$state', '$location', '$timeout', '$q', '$http', 'BookingsV2Data', 'BookingService', 'BookoutService',
    'MemberService', 'PaymentModeService', 'PaymentService', 'VoucherService', 'CourseAssignmentService', 'CourseService',
    'ExamSalesService', 'CaaFormsService', 'ToastService', 'SalesEnquiryService', 'EnquiryAsk'];
function HomeV2Controller($rootScope, $scope, $state, $location, $timeout, $q, $http, BookingsV2Data, BookingService, BookoutService,
    MemberService, PaymentModeService, PaymentService, VoucherService, CourseAssignmentService, CourseService,
    ExamSalesService, CaaFormsService, ToastService, SalesEnquiryService, EnquiryAsk) {

    var vm = this;
    var D = vm.D = BookingsV2Data;
    var PM_SWITCH_RECENT_DAYS = 30;
    var COMING_UP_MAX = 8;
    var knownAc = {}, knownIns = {};     // aircraft by registration / instructors by id, from the v2 rows

    vm.user = $rootScope.globals.currentUser;
    vm.today = moment().format('YYYY-MM-DD');
    vm.nowStr = moment().format('YYYY-MM-DD HH:mm:ss');
    vm.loading = true;
    vm.loadFailed = false;
    vm.rows = [];              // today: [{type: bookout|split|topay|booking|next, key, b, raw, lead, state, title, sub, ...}]
    vm.comingUp = [];          // the strip: future bookings as chips
    vm.summary = null;
    vm.cbo = null;             // the book-out whose cancel is being confirmed in place
    vm.cx = null;              // the booking being cancelled (dialog)
    vm.assignedCount = 0;
    vm.hasVouchers = false;
    vm.pastTraining = null;
    vm.payment_switch_banner = null;

    vm.showBooking = function () { return !!(vm.user && vm.user.access && vm.user.access.show_booking); };
    vm.hasClubRole = function () {
        var a = vm.user && vm.user.access;
        return !!(a && ((a.pilot && a.pilot.length) || (a.instructor && a.instructor.length) || (a.manager && a.manager.length)));
    };
    vm.longToday = function () { return D.fDayLong(vm.today); };
    // the home's booking length, as the approved design writes it: "2h00", "1h30"
    vm.dur = function (m) { m = Math.max(0, Math.round(m || 0)); var r = m % 60; return Math.floor(m / 60) + 'h' + (r < 10 ? '0' + r : r); };
    vm.go = function (state, params) { $state.go(state, params || {}); };
    vm.bookFlight = function () { $state.go('dashboard.scheduler_v2', {}); };
    vm.openUp = function (b) { $state.go('dashboard.v2.bookings', { open: b.id }); };
    vm.reload = loadRows;
    vm.act = act;
    vm.askCancelBookout = function (row) { vm.cbo = row.key; };
    vm.keepBookout = function () { vm.cbo = null; };
    vm.cancelBookout = cancelBookout;
    vm.startCancel = function (row) { vm.cx = row.b; };
    vm.closeCancel = function () { vm.cx = null; };
    vm.cancelled = function () { vm.cx = null; loadRows(); };
    vm.dismiss_payment_switch_banner = dismissBanner;
    vm.openPastTraining = function () { if (vm.pastTraining) { $state.go(vm.pastTraining.state); } };
    vm.tile = tile;
    vm.acct = null;                // GET my_account/v2/summary (C29), null until it answers — or when it fails
    vm.attn = [];
    vm.offerAttn = [];             // C44: one "Needs you" chip per open Suggest-a-time offer (bookings/v2/upcoming offers[])
    var sumAttn = [];              // the summary's own chips (C29)
    vm.attnAll = false;
    vm.attnShown = function () { return vm.attnAll ? vm.attn : vm.attn.slice(0, 3); };
    vm.attnGo = attnGo;
    vm.setup = null;               // the "Get ready to fly" checklist (C31 summary.checklist) — new members only
    vm.setupAll = false;           // the one-line strip, or every step
    vm.stepGo = stepGo;
    vm.groups = [];

    // ── v1's probes, unchanged ──
    CourseAssignmentService.MineCount().then(function (data) {
        vm.assignedCount = (data && typeof data.count === 'number') ? data.count : 0;
    });
    if (!vm.hasClubRole() && vm.user && vm.user.id) { probePastTraining(); }
    probeVouchers(true);
    probeEnquiries();
    loadPaymentSwitchBanner();
    loadRows();
    loadAccountSummary();
    buildGroups();

    // ═══ today's rows ═══
    function loadRows() {
        var uid = vm.user.id;
        vm.loadFailed = false;
        return $q.all([
            BookoutService.GetBookoutsToComplete(uid),
            BookingService.GetTodayBookingsUser(uid),
            D.Upcoming({ per_page: 30 })
        ]).then(function (res) {
            vm.loading = false;
            var bo = res[0] || {}, td = res[1] || {}, up = res[2] || {};
            if (up.success) {
                vm.today = D.todayOf(up.now);
                vm.nowStr = up.now || vm.nowStr;
                vm.summary = up.summary || null;
                vm.offerAttn = offerChips(up.offers);
                mergeAttn();
            }
            if (!up.success && !bo.success && !td.bookings) { vm.loadFailed = true; }
            build(bo.bookouts || [], td, up.success ? (up.bookings || []) : []);
            buildGroups();
        }, function () { vm.loading = false; vm.loadFailed = true; });
    }

    function build(bookouts, td, upRows) {
        var byId = {};
        upRows.forEach(function (b) { byId[b.id] = b; });
        // v1-only rows (an unfinished flight from an earlier day) name only a registration and an instructor id:
        // borrow the aircraft colour / type and the instructor's name / initials / colour from any v2 row that has them
        knownAc = {}; knownIns = {};
        upRows.forEach(function (b) {
            if (b.aircraft && b.aircraft.reg) { knownAc[b.aircraft.reg] = b.aircraft; }
            if (b.instructor && b.instructor.id) { knownIns[b.instructor.id] = b.instructor; }
        });
        var v1Today = {};
        (td.bookings || []).forEach(function (b) { v1Today[b.id] = b; });
        var rows = [], shown = {};

        // 1 · in the air → Book in (the sheet id) · Cancel book-out (confirmed in place)
        bookouts.forEach(function (x) {
            var bk = x.booking || {};
            var b = merge(byId[bk.id], bk);
            var overdue = b.end && vm.nowStr > D.parse(b.end).format('YYYY-MM-DD HH:mm:ss');
            shown[bk.id] = true;
            rows.push({
                type: 'bookout', key: 'o' + x.id, b: b, raw: x, role: b.role,
                state: overdue ? { tone: 'warn', label: 'Overdue', icon: 'fa-clock' } : { tone: 'info', label: 'Flying now', icon: 'fa-plane-departure' },
                title: D.kindLabel(b.kind) + (b.role === 'instructor' && b.pilot.name ? ' with ' + D.firstName(b.pilot.name) : ''),
                sub: b.lesson ? b.lesson.title : '',
                from: airfield(x.from_airport), to: airfield(x.to_airport),
                outAt: x.created_at ? D.fTime(x.created_at) : '', pob: x.pob
            });
        });
        var blocker = rows.length ? rows[0].b : null;

        // 2 · the tracker split a flight in two → book in the second leg
        (td.to_complete_split || []).forEach(function (x) {
            if (shown['s' + x.id]) { return; }
            shown['s' + x.id] = true;
            var b = merge(byId[x.id], x);
            rows.push({
                type: 'split', key: 's' + x.id, b: b, raw: x, role: b.role,
                state: { tone: 'warn', label: 'Second leg to fill in', icon: 'fa-code-branch' },
                title: 'Complete the flight split', sub: 'fill in the second leg'
            });
        });

        // 3 · booked in, not paid → Finish & pay (waits while a leg is still booked out) · Another leg
        (td.to_pay || []).forEach(function (x) {
            if (shown['p' + x.id]) { return; }
            shown['p' + x.id] = true;
            var b = merge(byId[x.id], x);
            rows.push({
                type: 'topay', key: 'p' + x.id, b: b, raw: x, role: b.role,
                state: { tone: 'warn', label: 'To finish & pay', icon: 'fa-receipt' },
                title: 'Finish your flight', sub: x.booked_in_at ? 'booked in at ' + D.fTime(x.booked_in_at) + ', not paid yet' : 'booked in, not paid yet',
                blockedBy: blocker && blocker.aircraft ? blocker.aircraft.reg : (blocker ? 'the aircraft' : '')
            });
        });

        // 4 · today's bookings (bookings/v2/upcoming) not booked out yet
        upRows.forEach(function (b) {
            if (b.booked_out || shown[b.id]) { return; }
            if (D.daysBetween(vm.today, b.date) !== 0 && !(b.started && b.date < vm.today)) { return; }
            var v1 = v1Today[b.id];
            rows.push({
                type: 'booking', key: 'b' + b.id, b: b, raw: v1 || null, role: b.role,
                state: homeState(b),
                title: D.kindLabel(b.kind) + (b.role === 'instructor' && b.pilot && b.pilot.name ? ' with ' + D.firstName(b.pilot.name) : ''),
                sub: b.lesson ? b.lesson.title : '',
                waiting: D.notFinal(b),
                briefLesson: (v1 && v1.lesson && v1.lesson.id) || (b.lesson && b.lesson.id) || 0
            });
        });

        // the future, after today
        var future = upRows.filter(function (b) { return !b.booked_out && D.daysBetween(vm.today, b.date) > 0; });
        if (!rows.length && future.length) {
            var n = future.shift();
            rows.push({
                type: 'next', key: 'n' + n.id, b: n, role: n.role, state: homeState(n),
                title: D.kindLabel(n.kind) + (n.role === 'instructor' && n.pilot && n.pilot.name ? ' with ' + D.firstName(n.pilot.name) : ''),
                sub: n.lesson ? n.lesson.title : '', waiting: D.notFinal(n)
            });
        }
        rows.forEach(function (r, i) { r.lead = i === 0; });
        vm.rows = rows;
        vm.todayCount = rows.filter(function (r) { return r.type !== 'next'; }).length;
        vm.comingUp = future.slice(0, COMING_UP_MAX);
        if (vm.cbo && !rows.some(function (r) { return r.key === vm.cbo; })) { vm.cbo = null; }
    }

    // a v1 row (bookings.* + registration) on its own, or merged into its v2 twin
    function merge(v2, v1) {
        if (v2) { return v2; }
        v1 = v1 || {};
        var me = parseInt(vm.user.id, 10);
        var iid = parseInt(v1.instructor_id, 10) || 0;
        var instr = v1.instructor && (v1.instructor.first_name || v1.instructor.last_name)
            ? { id: iid, name: [v1.instructor.first_name, v1.instructor.last_name].filter(Boolean).join(' '), code: initials(v1.instructor) }
            : null;
        if (iid && knownIns[iid]) { instr = angular.extend({}, instr || {}, knownIns[iid]); }
        var pilot = v1.user ? { id: parseInt(v1.user_id, 10), name: [v1.user.first_name, v1.user.last_name].filter(Boolean).join(' ') } : { id: parseInt(v1.user_id, 10) || 0, name: '' };
        return {
            id: parseInt(v1.id, 10), club_id: parseInt(v1.club_id, 10), start: v1.start, end: v1.end, date: String(v1.start || '').slice(0, 10),
            minutes: D.minutesBetween(v1.start, v1.end), kind: parseInt(v1.instructor_id, 10) > 0 ? 'dual' : 'hire', status: 'confirmed',
            waiting_list: 0, aircraft: v1.registration ? (knownAc[v1.registration] || { reg: v1.registration, type: v1.plane_type || '' }) : null,
            instructor: instr, pilot: pilot, role: parseInt(v1.user_id, 10) === me ? 'pilot' : 'instructor', lesson: null,
            can_cancel: false, can_book_out: false,
            _whoUnknown: !instr && parseInt(v1.instructor_id, 10) > 0    // a v1 row names nobody: say nothing rather than "Just you"
        };
    }
    function initials(u) { return ((u.first_name || '').charAt(0) + (u.last_name || '').charAt(0)).toUpperCase(); }
    function airfield(a) {
        if (!a) { return null; }
        var code = a.icao || a.ident || a.icao_code || a.code || '';
        return code || a.name ? { code: code, name: a.name || '' } : null;
    }
    // ONE helper for every booking state on this page (guidelines 4.6)
    function homeState(b) {
        if (b.waiting_list > 0) { return { tone: 'pend', label: 'Waiting list', icon: 'fa-hourglass-half' }; }
        if (b.status === 'pending') {
            if (b.can_approve) { return { tone: 'warn', label: 'Needs your confirmation', icon: 'fa-exclamation-circle' }; }
            return b.pending_by === 'club' ? { tone: 'pend', label: 'Awaiting the club', icon: 'fa-user-clock' }
                : b.pending_by === 'both' ? { tone: 'pend', label: 'Awaiting instructor or club', icon: 'fa-user-clock' }   // voucher requests routed to both
                : { tone: 'pend', label: 'Awaiting instructor', icon: 'fa-user-clock' };
        }
        if (b.role === 'instructor') { return { tone: 'info', label: 'You\'re instructing', icon: 'fa-chalkboard-teacher' }; }
        return { tone: 'good', label: 'Confirmed', icon: 'fa-check' };
    }

    // the one right action per row
    function act(row, what) {
        var b = row.b;
        if (what === 'bookin') { $state.go('dashboard.my_account.book_in', { id: row.raw.id }); }
        else if (what === 'split') { $state.go('dashboard.my_account.book_in', { id: row.raw.pls_id }); }
        else if (what === 'finish') { $state.go('dashboard.my_account.finish_and_pay', { id: b.id }); }
        else if (what === 'leg' || what === 'bookout') { $state.go('dashboard.my_account.bookout_with_booking', { booking_id: b.id }); }
        else if (what === 'brief') { $state.go('dashboard.manage_user.briefing_lesson', { booking_id: b.id, lesson_id: row.briefLesson || 0, club_id: b.club_id }); }
        else if (what === 'sched') { $state.go('dashboard.scheduler_v2', { date: b.date }); }
    }

    function cancelBookout(row) {
        vm.cboBusy = true;
        BookoutService.CancelBookout(row.raw.id).then(function (data) {
            vm.cboBusy = false;
            if (data && data.success) {
                vm.cbo = null;
                ToastService.success('Book-out cancelled', (row.b.aircraft ? row.b.aircraft.reg : 'The aircraft') + ' is back to ready to book out.', { confetti: false });
                loadRows();
            } else {
                ToastService.error('Not cancelled', textOf(data && data.message) || 'The book-out could not be cancelled.');
            }
        });
    }
    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }

    // ═══ the sections (today's tiles, grouped; gates are v1's ng-ifs) ═══
    function tile(t) { if (t.click) { t.click(); } else { $state.go(t.state, t.params || {}); } }

    // ═══ the account summary (C29) ═══
    var GO = { invoices: 'dashboard.my_account.invoices', payments: 'dashboard.my_account.payments', memberships: 'dashboard.my_account.memberships',
        payment_methods: 'dashboard.my_account.payment_methods', licences: 'dashboard.my_account.licence', licence: 'dashboard.my_account.licence',
        medical: 'dashboard.my_account.medical', medicals: 'dashboard.my_account.medical', differences: 'dashboard.my_account.differences',
        poid: 'dashboard.my_account.poid', profile: 'dashboard.my_account.manage', details: 'dashboard.my_account.manage',
        safety: 'dashboard.my_account.sms', training: 'dashboard.my_account.questionnaires', questionnaires: 'dashboard.my_account.questionnaires',
        aircraft: 'dashboard.my_account.aircraft_status', vouchers: 'dashboard.my_account.my_vouchers', logbook: 'dashboard.my_account.logbook' };
    // the chip's action words and icon, by key (the API names the destination, the page names the action)
    var ACT = { document_expired: ['Update it', 'fa-certificate'], document_due: ['Renew it', 'fa-certificate'], dd_failed: ['Pay now', 'fa-university'],
        to_pay: ['Pay now', 'fa-receipt'], safety_to_read: ['Read it', 'fa-shield-alt'], membership_ending: ['Renew', 'fa-id-card'], tasks: ['Open them', 'fa-tasks'] };
    var TONE_ICON = { good: 'fa-check-circle', warn: 'fa-exclamation-circle', bad: 'fa-times-circle' };
    function loadAccountSummary() {
        $http.get('/api/v1/my_account/v2/summary').then(function (res) {
            var d = res.data;
            if (!d || !d.success) { return; }            // quietly: the page works as before without it
            vm.acct = d;
            sumAttn = (d.attention || []).slice().sort(function (a, b) { return (+a.sort || 0) - (+b.sort || 0); }).map(function (a) {
                var act = ACT[a.key] || ['Open', 'fa-info-circle'], label = act[0], icon = act[1];
                if (a.key === 'document_expired' || a.key === 'document_due') {
                    var medical = /medical|class \d|lapl/i.test(a.title || ''), go = String(a.go || '').split(/[\s/|]+/)[0];
                    if (medical) { icon = 'fa-heartbeat'; label = 'Update medical'; }
                    else if (go === 'licences' || go === 'licence') { label = 'Open licences'; }
                    else if (go === 'poid') { label = 'Update ID'; }
                    else if (go === 'profile' || go === 'details') { label = 'Open details'; }
                }
                return { key: a.key, tone: a.tone === 'bad' || a.tone === 'warn' ? a.tone : 'info', title: a.title, sub: a.sub || '', go: a.go, label: label, icon: icon, club_id: a.club_id };
            });
            mergeAttn();
            vm.setup = readChecklist(d.checklist);
            buildGroups();
        }, function () { /* quietly */ });
    }
    // ═══ "Get ready to fly" (C31): {show, steps:[{key, done, title, sub, go}]} — the same steps at every club ═══
    // the button words and the page, by step (the API's go names the area: profile | memberships | payment_methods | licences | scheduler)
    var STEP = { details_complete: ['Add your details', 'dashboard.my_account.manage'], membership_accepted: ['Open memberships', 'dashboard.my_account.memberships'],
        next_of_kin: ['Add next of kin', 'dashboard.my_account.nok'], proof_of_id: ['Add proof of ID', 'dashboard.my_account.poid'],
        payment_method: ['Set up payment', 'dashboard.my_account.payment_methods'], medical: ['Add medical', 'dashboard.my_account.medical'],
        first_booking: ['Open the scheduler', 'dashboard.scheduler_v2'] };
    var STEP_GO = { profile: 'dashboard.my_account.manage', memberships: 'dashboard.my_account.memberships', payment_methods: 'dashboard.my_account.payment_methods',
        licences: 'dashboard.my_account.licence', scheduler: 'dashboard.scheduler_v2' };
    function readChecklist(c) {
        if (!c || !c.show || !angular.isArray(c.steps) || !c.steps.length) { return null; }
        var steps = c.steps.map(function (x) {
            var m = STEP[x.key] || ['Open', STEP_GO[x.go] || GO[x.go] || 'dashboard.my_account'], done = x.done === true || +x.done === 1;
            // the medical is needed before solo, not before the first lesson: it never becomes "Next" (the mockup's "Later")
            return { key: x.key, done: done, t: x.title || '', s: x.sub || '', act: m[0], state: m[1], go: x.go, later: !done && x.key === 'medical' };
        });
        var done = steps.filter(function (x) { return x.done; }).length, next = null;
        steps.some(function (x) { if (!x.done && !x.later) { next = x; return true; } return false; });
        return { steps: steps, done: done, n: steps.length, left: steps.length - done, pct: Math.round(done / steps.length * 100), next: next };
    }
    function stepGo(x) { $state.go(x.state || STEP_GO[x.go] || 'dashboard.my_account'); }
    // Suggest a time (C44): an open offer of other times needs the member's answer — first, it can run out within 48 h
    function offerChips(list) {
        return (angular.isArray(list) ? list : []).filter(function (o) { return o && o.offer && o.offer.state === 'open'; }).map(function (o) {
            var by = (o.offer.offered_by && o.offer.offered_by.name) || (o.instructor && o.instructor.name) || '';
            var until = o.offer.open_until || o.offer.expires_at;
            var n = (o.offer.times || []).filter(function (t) { return !t.gone; }).length;
            return { key: 'offer', offerId: o.offer_id, tone: 'warn', icon: 'fa-exchange-alt', label: 'Choose a time',
                title: (by ? D.firstName(by) : 'Your instructor') + ' suggested other times',
                sub: 'For your lesson on ' + D.fDay(o.start) + ' at ' + D.fTime(o.start) + ' · ' + n + (n === 1 ? ' time' : ' times') + ' to choose from'
                    + (until ? ', open until ' + D.fDay(until) + ' ' + D.fTime(until) : '') };
        });
    }
    function mergeAttn() { vm.attn = vm.offerAttn.concat(sumAttn); }
    function attnGo(a) {
        if (a.offerId) { $state.go('dashboard.v2.bookings', { offer: a.offerId }); return; }
        var g = String(a.go || '');
        if (/^dashboard\./.test(g)) { $state.go(g); return; }
        if (g.charAt(0) === '/') { $location.path(g); return; }
        var key = g.split(/[\s/|]+/)[0];
        $state.go(GO[key] || (a.key === 'tasks' ? GO.training : 'dashboard.my_account'));
    }
    // a tile's live line from the summary: { s, tone, icon } — "ok" / "info" read as plain lines (colour only for problems)
    function liveLine(k) {
        var t = vm.acct && vm.acct.tiles && vm.acct.tiles[k];
        if (!t || !t.line) { return null; }
        var tone = t.tone === 'warn' || t.tone === 'bad' || t.tone === 'good' ? t.tone : '';
        return { s: t.line, tone: tone, icon: TONE_ICON[tone] || '' };
    }
    function buildGroups() {
        var showB = vm.showBooking(), club = vm.hasClubRole();
        var nextLine = null;
        if (vm.summary) {
            if (vm.summary.next) {
                var nb = null;
                vm.comingUp.concat(vm.rows.map(function (r) { return r.b; })).forEach(function (b) { if (b && b.id === vm.summary.next.id) { nb = b; } });
                nextLine = 'Next: ' + (D.daysBetween(vm.today, vm.summary.next.start) === 0 ? 'today' : D.fDay(vm.summary.next.start)) + ' · ' + D.fTime(vm.summary.next.start)
                    + (nb && nb.aircraft ? ' in ' + nb.aircraft.reg : '');
            } else if (!vm.summary.total) { nextLine = 'No upcoming bookings'; }
        }
        var training = null;
        if (club) {
            training = { k: 'training', t: 'Training', ic: 'fa-graduation-cap', state: 'dashboard.my_account.syllabus', badge: vm.assignedCount, badgeTitle: 'Tasks from your instructor',
                links: [['Syllabus', 'dashboard.my_account.syllabus'], ['Training records', 'dashboard.my_account.training_records'], ['Questionnaires', 'dashboard.my_account.questionnaires'], ['Exams', 'dashboard.my_account.my_exams'], ['CAA forms', 'dashboard.my_account.caa_forms']] };
        } else if (vm.pastTraining) {
            training = { k: 'training', t: 'Training', ic: 'fa-graduation-cap', click: vm.openPastTraining, s: 'Your records from a club you were a member of' };
        }
        var G = [
            { label: 'Flying', ic: 'fa-plane-departure', tiles: [
                showB && { k: 'bookings', t: 'My bookings', ic: 'fa-calendar-alt', state: 'dashboard.my_account.upcoming_bookings', s: nextLine },
                showB && { k: 'aircraft', t: 'Aircraft status', ic: 'fa-plane', state: 'dashboard.my_account.aircraft_status' },
                showB && { k: 'claim', t: 'Claim a flight', ic: 'fa-paper-plane', state: 'dashboard.my_account.claim_a_flight' }
            ] },
            { label: 'Training & logbook', ic: 'fa-graduation-cap', tiles: [
                training,
                { k: 'logbook', t: 'My logbook', ic: 'fa-book', state: 'dashboard.my_account.logbook' }
            ] },
            { label: 'Money', ic: 'fa-wallet', tiles: [
                showB && { k: 'invoices', t: 'Invoices & payments', ic: 'fa-file-invoice-dollar', state: 'dashboard.my_account.invoices', links: [['Invoices', 'dashboard.my_account.invoices'], ['Payments', 'dashboard.my_account.payments']] },
                { k: 'memberships', t: 'Memberships & cards', ic: 'fa-id-card', state: 'dashboard.my_account.memberships', links: [['Memberships', 'dashboard.my_account.memberships'], ['Payment methods', 'dashboard.my_account.payment_methods']] },
                vm.hasVouchers && { k: 'vouchers', t: 'My vouchers', ic: 'fa-ticket-alt', state: 'dashboard.my_account.my_vouchers' }
            ] },
            { label: 'Me & documents', ic: 'fa-user', tiles: [
                { k: 'details', t: 'My details', ic: 'fa-user', state: 'dashboard.my_account.manage', links: [['Details', 'dashboard.my_account.manage'], ['Security', 'dashboard.my_account.security'], ['Next of kin', 'dashboard.my_account.nok'], ['Reminders', 'dashboard.my_account.reminders']] },
                { k: 'documents', t: 'My documents', ic: 'fa-folder-open', state: 'dashboard.my_account.licence', links: [['Licences', 'dashboard.my_account.licence'], ['Medicals', 'dashboard.my_account.medical'], ['Differences', 'dashboard.my_account.differences']].concat(showB ? [['Proof of ID', 'dashboard.my_account.poid']] : []) }
            ] },
            { label: 'Club & safety', ic: 'fa-shield-alt', tiles: [
                showB && { k: 'clubdocs', t: 'Club documents', ic: 'fa-building', state: 'dashboard.my_account.all_documents', links: [['Documents', 'dashboard.my_account.all_documents'], ['Pricelist', 'dashboard.my_account.all_prices']] },
                club && { k: 'safety', t: 'Safety (SMS)', ic: 'fa-shield-alt', state: 'dashboard.my_account.sms' },
                vm.enquiries && vm.enquiries.total > 0 && { k: 'questions', t: 'Your questions to ToAviate', ic: 'fa-comments', state: 'dashboard.v2.enquiries',
                    badge: vm.enquiries.replied, badgeTitle: 'ToAviate has replied',
                    s: vm.enquiries.replied ? (vm.enquiries.replied === 1 ? '1 new reply' : vm.enquiries.replied + ' new replies') : (vm.enquiries.open ? 'Waiting for our reply' : 'All answered') },
                // always there (owner, 9 Nov): a quiet way to ask ToAviate something — the shared "Ask us" dialog (js/v2/enquiries)
                { k: 'ask', t: 'Ask ToAviate a question', ic: 'fa-comment-dots', quiet: true, click: askToAviate, s: 'We reply by email' }
            ] }
        ];
        var badges = (vm.acct && vm.acct.badges) || {};
        vm.groups = G.map(function (g) {
            g.tiles = g.tiles.filter(Boolean).map(function (t) {
                // the live status line (C29) in its tone; My bookings keeps its own line from the v2 list
                var live = t.k !== 'bookings' && t.k !== 'questions' && t.k !== 'ask' ? liveLine(t.k) : null;
                if (live) { t.s = live.s; t.tone = live.tone; t.toneIcon = live.icon; }
                if (t.k === 'training' && badges.training !== undefined) { t.badge = +badges.training; }
                if (t.k === 'safety' && +badges.safety > 0) { t.badge = +badges.safety; t.badgeTitle = 'To read'; }
                // no line (summary missing): on phones, where the sub-links are hidden, name what's inside
                t.inside = (t.links || []).map(function (l) { return l[0]; }).join(' · ');
                return t;
            });
            return g;
        }).filter(function (g) { return g.tiles.length; });
    }
    // the badge and the past-training tile arrive late
    $scope.$watchGroup([function () { return vm.assignedCount; }, function () { return vm.hasVouchers; }, function () { return vm.pastTraining; }, function () { return vm.enquiries && vm.enquiries.total + ':' + vm.enquiries.replied; }], function (n, o) {
        if (n !== o) { buildGroups(); }
    });

    // ═══ v1's probes (MyAccountController), unchanged ═══
    function probePastTraining() {
        CourseService.GetCoursesByUserId(vm.user.id).then(function (data) {
            var clubs = (data && data.success !== false && angular.isArray(data.items)) ? data.items : [];
            var hasRecords = clubs.some(function (club) {
                return (club.courses || []).some(function (c) { return Number(c.has_records) === 1; });
            });
            if (hasRecords) { vm.pastTraining = { state: 'dashboard.my_account.training_records' }; return; }
            ExamSalesService.GetUserClubs(vm.user.id).then(function (res) {
                var exClubs = (res && res.success === true && angular.isArray(res.items)) ? res.items : [];
                if (exClubs.some(function (c) { return Number(c.exams) > 0; })) { vm.pastTraining = { state: 'dashboard.my_account.my_exams' }; return; }
                CaaFormsService.Mine().then(function (caa) {
                    if (caa && caa.success === true && angular.isArray(caa.forms) && caa.forms.length) { vm.pastTraining = { state: 'dashboard.my_account.caa_forms' }; }
                });
            });
        });
    }

    function askToAviate() { EnquiryAsk.open({ topic: 'general', context: { source: 'home' } }); }
    // a question sent from any "Ask us" dialog: the "Your questions" tile appears / updates
    $scope.$on('enq:created', function () { probeEnquiries(); });

    // questions to ToAviate sales (be-alex-3e C19): the tile shows only once the member has asked something
    function probeEnquiries() {
        SalesEnquiryService.Mine().then(function (data) {
            var rows = (data && data.success !== false && angular.isArray(data.enquiries)) ? data.enquiries : [];
            vm.enquiries = {
                total: rows.length,
                replied: rows.filter(function (e) { return e.status === 'answered' && e.last_message && e.last_message.from_staff; }).length,
                open: rows.filter(function (e) { return e.status === 'open'; }).length
            };
        });
    }
    function probeVouchers(retry) {
        VoucherService.HasVouchers().then(function (data) {
            if (data && data.success && data.has_vouchers) { vm.hasVouchers = true; }
            else if (retry && (!data || data.success === false)) { $timeout(function () { probeVouchers(false); }, 3000); }
        }).catch(function () { if (retry) { $timeout(function () { probeVouchers(false); }, 3000); } });
    }

    // Payment-mode switch banner: a club switched mode recently and the member has no payment method in the new mode.
    function loadPaymentSwitchBanner() {
        MemberService.GetUserMemberships(vm.user.id).then(function (data) {
            if (!data || !data.success || !data.memberships) { return; }
            data.memberships.forEach(function (m) {
                if (vm.payment_switch_banner || !m.club_id) { return; }
                evaluateClubSwitch(m);
            });
        });
    }
    function evaluateClubSwitch(membership) {
        PaymentModeService.GetStatus(membership.club_id).then(function (status) {
            if (vm.payment_switch_banner) { return; }
            if (!status || !status.success || !status.payment_mode_switched_at) { return; }
            var switched = moment(status.payment_mode_switched_at);
            if (!switched.isValid() || moment().diff(switched, 'days') > PM_SWITCH_RECENT_DAYS) { return; }
            if (bannerDismissed(membership.club_id, status.payment_mode_switched_at)) { return; }
            if (membership.has_direct_debit) { return; }
            PaymentService.GetMemberCards({ user_id: vm.user.id, club_id: membership.club_id }).then(function (cardData) {
                var hasCard = !!(cardData && cardData.cards && cardData.cards.length > 0);
                if (hasCard || vm.payment_switch_banner) { return; }
                vm.payment_switch_banner = {
                    club_id: membership.club_id,
                    club_name: membership.club_name || 'your club',
                    mode: status.payment_mode,
                    switched_at: status.payment_mode_switched_at,
                    is_live: status.payment_mode === 'live'
                };
            });
        });
    }
    function bannerKey(club_id, switched_at) { return 'pm_banner_dismissed_' + vm.user.id + '_' + club_id + '_' + switched_at; }
    function bannerDismissed(club_id, switched_at) { try { return window.localStorage.getItem(bannerKey(club_id, switched_at)) === '1'; } catch (e) { return false; } }
    function dismissBanner() {
        if (!vm.payment_switch_banner) { return; }
        try { window.localStorage.setItem(bannerKey(vm.payment_switch_banner.club_id, vm.payment_switch_banner.switched_at), '1'); } catch (e) { /* ignore */ }
        vm.payment_switch_banner = null;
    }
}


// ═══════════════════════════════════════════════════════════════════════
// Reminders (My details hub → Reminders) — RemindersController's calls, the approved layout:
// master switch → expiry reminders (summary line, editor in place, inline errors) → booking emails per club →
// recently sent. Each change saves as it is made.
// ═══════════════════════════════════════════════════════════════════════
app.controller('RemindersV2Controller', RemindersV2Controller);
RemindersV2Controller.$inject = ['RemindersService', 'EmailLogService', 'MemberService', 'InstructorService', 'BookingsV2Data', '$rootScope', '$scope', '$state', '$timeout', '$q', 'ToastService'];
function RemindersV2Controller(RemindersService, EmailLogService, MemberService, InstructorService, BookingsV2Data, $rootScope, $scope, $state, $timeout, $q, ToastService) {
    var vm = this;
    var D = BookingsV2Data;
    var flashTimer = null;
    var ICONS = { medical: 'fa-medkit', licence: 'fa-certificate', rating: 'fa-star', membership: 'fa-id-card', card: 'fa-credit-card', poid: 'fa-passport', qualification: 'fa-graduation-cap' };
    var HINTS = { membership: 'Only memberships that don\'t renew by themselves get reminder emails.', card: 'We remind you before the end of the card\'s expiry month.' };
    var BOOKING_PREFS = [
        { key: 'reminders', field: 'mute_booking_reminders', inverted: true, instructorOnly: false, icon: 'fa-calendar-check', label: 'Booking reminders', desc: 'An email the evening before each upcoming booking.' },
        { key: 'notifications', field: 'mute_booking_emails', inverted: true, instructorOnly: true, icon: 'fa-envelope', label: 'Booking notifications', desc: 'An email each time a student books a lesson with you.' },
        { key: 'summary', field: 'instructor_daily_summary', inverted: false, instructorOnly: true, icon: 'fa-list-alt', label: 'Daily schedule summary', desc: 'One email listing all your bookings for tomorrow.' }
    ];

    vm.user = $rootScope.globals.currentUser;
    vm.loading = true;
    vm.loadFailed = false;
    vm.prefs = [];
    vm.muteAll = false;
    vm.master = null;
    vm.saved = null;            // key of the row that just saved ('master', a reminder type, 'club<id>')
    vm.openType = null;         // the reminder type whose times editor is open
    vm.err = null;              // { type, msg } — inline error of the open editor
    vm.newOff = {};             // reminder type → the "days" being typed
    vm.saving = {};
    vm.bookingLoading = true;
    vm.clubs = [];
    vm.histOpen = false;
    vm.histLoading = false;
    vm.history = null;

    vm.icon = function (t) { return ICONS[t] || 'fa-bell'; };
    vm.hint = function (t) { return HINTS[t] || ''; };
    vm.offChip = function (o) { o = +o; return o === 0 ? 'On the day' : o === 1 ? '1 day' : o + ' days'; };
    vm.offWord = offWord;
    vm.summary = offSummary;
    vm.retry = activate;
    vm.toggleMute = toggleMute;
    vm.toggleType = toggleType;
    vm.openTimes = function (p) { vm.openType = p ? p.reminder_type : null; vm.err = null; };
    vm.removeOffset = removeOffset;
    vm.addOffset = addOffset;
    vm.addKey = function (e, p) { if (e.keyCode === 13) { e.preventDefault(); addOffset(p); } };
    vm.resetToDefault = resetToDefault;
    vm.toggleBooking = toggleBooking;
    vm.retryClub = retryClub;
    vm.toggleHistory = toggleHistory;
    vm.histLabel = function (t) { var p = find(t); return p ? p.label : t; };
    vm.histWhen = function (s) { return s ? D.fDate(s) : ''; };
    vm.histLine = function (h) { return offWord(h.offset_value) + (h.due_key ? ' · expiry ' + D.fDate(h.due_key) : ''); };
    vm.go = function (state) { $state.go(state); };

    activate();
    loadClubs();

    function activate() {
        vm.loading = true;
        vm.loadFailed = false;
        RemindersService.GetPreferences().then(function (data) {
            vm.loading = false;
            if (data && data.success && data.preferences) {
                vm.muteAll = data.mute_all_notifications == 1;
                loadMasterMeta();
                apply(data.preferences);
            } else {
                vm.loadFailed = true;
            }
        });
    }
    function apply(preferences) {
        preferences.forEach(function (p) { p.offsets_days = sortDesc(p.offsets_days || []); p.enabled = p.enabled == 1 ? 1 : 0; });
        vm.prefs = preferences;
    }
    function find(t) { var o = null; vm.prefs.forEach(function (p) { if (p.reminder_type === t) { o = p; } }); return o; }
    function sortDesc(a) { return a.map(function (x) { return parseInt(x, 10); }).filter(function (x) { return !isNaN(x); }).sort(function (a, b) { return b - a; }); }
    function flash(key) {
        vm.saved = key;
        if (flashTimer) { $timeout.cancel(flashTimer); }
        flashTimer = $timeout(function () { if (vm.saved === key) { vm.saved = null; } }, 1800);
    }
    function offWord(o) { o = +o; return o === 0 ? 'On the day' : o === 1 ? '1 day before' : o + ' days before'; }
    // "30, 14 and 1 days before, and on the day"
    function offSummary(arr) {
        var days = (arr || []).filter(function (x) { return x > 0; }), zero = (arr || []).indexOf(0) > -1, t = '';
        if (days.length) {
            t = (days.length === 1 ? days[0] : days.slice(0, -1).join(', ') + ' and ' + days[days.length - 1]) + (days.length === 1 && days[0] === 1 ? ' day before' : ' days before');
        }
        if (zero) { t = t ? t + ', and on the day' : 'On the day'; }
        return t;
    }

    // ── master switch ──
    function loadMasterMeta() {
        EmailLogService.GetPreferences().then(function (data) {
            if (data && data.success && data.master) {
                vm.master = data.master;
                vm.muteAll = data.master.mute_all_notifications == 1;
            }
        });
    }
    vm.masterMeta = function () {
        var m = vm.master;
        if (!m || !m.updated_at) { return ''; }
        return 'Set by ' + (m.updated_by_name || 'you') + (m.updated_via === 'club_manager' ? ' (club manager)' : '') + ' on ' + D.fDate(m.updated_at) + (m.note ? ' — “' + m.note + '”' : '');
    };
    function toggleMute() {
        var want = !!vm.muteAll;        // ng-model already flipped it
        vm.muteSaving = true;
        RemindersService.SaveMasterMute(want).then(function (data) {
            vm.muteSaving = false;
            if (data && data.success) { flash('master'); loadMasterMeta(); }
            else {
                vm.muteAll = !want;
                ToastService.error('Not saved', (data && data.message) || 'That change could not be saved — try again.');
            }
        });
    }

    // ── expiry reminders (each change saves) ──
    function toggleType(p) {
        // ng-model flipped p._on
        p.enabled = p._on ? 1 : 0;
        if (!p.enabled && vm.openType === p.reminder_type) { vm.openType = null; }
        save(p, false);
    }
    function removeOffset(p, o) {
        if (p.offsets_days.length <= 1) { vm.err = { type: p.reminder_type, msg: 'Keep at least one reminder time — or switch this reminder off instead.' }; return; }
        p.offsets_days = p.offsets_days.filter(function (x) { return x !== o; });
        vm.err = null;
        save(p, true);
    }
    function addOffset(p) {
        var raw = String(vm.newOff[p.reminder_type] == null ? '' : vm.newOff[p.reminder_type]).trim(), n = parseInt(raw, 10);
        if (raw === '' || isNaN(n) || n < 0 || n > 365 || raw.indexOf('.') > -1 || !/^\d+$/.test(raw)) { vm.err = { type: p.reminder_type, msg: 'Use a whole number of days from 0 to 365.' }; return; }
        if (p.offsets_days.indexOf(n) > -1) { vm.newOff[p.reminder_type] = ''; vm.err = { type: p.reminder_type, msg: offWord(n) + ' is already on the list.' }; return; }
        if (p.offsets_days.length >= 8) { vm.err = { type: p.reminder_type, msg: 'You can have up to 8 reminder times for each item.' }; return; }
        p.offsets_days = sortDesc(p.offsets_days.concat([n]));
        vm.newOff[p.reminder_type] = '';
        vm.err = null;
        save(p, true);
    }
    function resetToDefault(p) { p.offsets_days = sortDesc(p.default_offsets || []); vm.err = null; save(p, true); }
    // NB: leaving offsets_days out of the PUT resets that type to its defaults server-side, so the current
    // offsets are always sent unless the row is (and stays) on the default timeline.
    function save(p, offsetsChanged) {
        var change = { reminder_type: p.reminder_type, enabled: p.enabled };
        if (offsetsChanged || !(p.is_default == 1)) { change.offsets_days = p.offsets_days; }
        vm.saving[p.reminder_type] = true;
        RemindersService.SavePreferences([change]).then(function (data) {
            vm.saving[p.reminder_type] = false;
            if (data && data.success && data.preferences) {
                apply(data.preferences);
                syncOn();
                flash(p.reminder_type);
            } else {
                ToastService.error('Not saved', (data && data.message) || 'That change could not be saved — try again.');
                activate();
            }
        });
    }
    function syncOn() { vm.prefs.forEach(function (p) { p._on = p.enabled == 1; }); }
    $scope.$watch(function () { return vm.prefs; }, syncOn);

    // ── booking emails (per club membership) ──
    function loadClubs() {
        vm.bookingLoading = true;
        MemberService.GetUserMemberships(vm.user.id).then(function (data) {
            if (!data || !data.success || !data.memberships) { vm.bookingLoading = false; return; }
            var rows = data.memberships.filter(function (m) { return m.membership_id > 0; });
            var fills = rows.filter(function (m) { return typeof m.mute_booking_reminders === 'undefined'; }).map(fill);
            $q.all(fills).then(function () {
                rows.forEach(function (m) { m._prefs = prefsFor(m); });
                vm.clubs = rows;
                vm.bookingLoading = false;
            });
        });
    }
    // the list may not carry the email flags: fetch the full membership (never take `id` from for_user)
    function fill(row) {
        return MemberService.GetOneForUser(row.id).then(function (data) {
            if (data && data.success && data.membership) {
                row.instructor = data.membership.instructor;
                row.mute_booking_reminders = data.membership.mute_booking_reminders;
                row.mute_booking_emails = data.membership.mute_booking_emails;
                row.instructor_daily_summary = data.membership.instructor_daily_summary;
                row._loadFailed = false;
            } else {
                row._loadFailed = true;
            }
        });
    }
    function retryClub(m) { m._retrying = true; fill(m).then(function () { m._retrying = false; m._prefs = prefsFor(m); }); }
    function prefsFor(m) {
        return BOOKING_PREFS.filter(function (d) { return !(d.instructorOnly && m.instructor != 1); }).map(function (d) {
            return { key: d.key, icon: d.icon, label: d.label, desc: d.desc, on: isOn(m, d) };
        });
    }
    function isOn(m, d) { return d.inverted ? (m[d.field] == 0) : (m[d.field] == 1); }
    function defFor(key) { var o = null; BOOKING_PREFS.forEach(function (d) { if (d.key === key) { o = d; } }); return o; }
    function toggleBooking(m, pref) {
        var d = defFor(pref.key);
        if (!d || m._loadFailed) { return; }
        var wantOn = !!pref.on;            // ng-model flipped it
        var value = d.inverted ? (wantOn ? 0 : 1) : (wantOn ? 1 : 0);
        var req;
        if (m.instructor == 1) {
            // instructor_update writes all three flags at once — echo the other two so they aren't reset
            var payload = { id: m.id, mute_booking_emails: m.mute_booking_emails, mute_booking_reminders: m.mute_booking_reminders, instructor_daily_summary: m.instructor_daily_summary };
            payload[d.field] = value;
            req = InstructorService.UpdateInstructor(payload, m.club_id);
        } else {
            var obj = {};
            obj[d.field] = value;
            req = MemberService.UpdateOneByUser(m.id, obj);
        }
        req.then(function (data) {
            if (data && data.success) { m[d.field] = value; flash('club' + m.id); }
            else {
                pref.on = isOn(m, d);
                ToastService.error('Not saved', (data && data.message) || 'Could not update your email preference — try again.');
            }
        });
    }

    // ── recently sent ──
    function toggleHistory() {
        vm.histOpen = !vm.histOpen;
        if (vm.histOpen && vm.history === null && !vm.histLoading) {
            vm.histLoading = true;
            RemindersService.GetHistory(30).then(function (data) {
                vm.histLoading = false;
                vm.history = (data && data.success && data.rows) ? data.rows : [];
            });
        }
    }

    $scope.$on('$destroy', function () { if (flashTimer) { $timeout.cancel(flashTimer); } });
}
