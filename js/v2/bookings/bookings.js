/* ═══════════════════════════════════════════════════════════════════════════
   v2 screen: bookings — design: mockups/my-account/bookings.html (approved) — My bookings + one booking's history.
   Built 8 Nov 2026 beside v1 (views/my_account/upcoming_bookings.html + booking_audit_trail.html), switched by the
   global v2 switch (js/v2/core/design.js).

   States (same param names as v1):
     dashboard.v2.bookings         /my_account/upcoming_bookings?open      ← dashboard.my_account.upcoming_bookings
     dashboard.v2.booking_history  /my_account/booking_history/:booking_id ← dashboard.my_account.booking_audit_trail

   Data: GET bookings/v2/upcoming (contract C1, mockups/v2-build/be-alex-3e.md) — the caller's own bookings with kind,
   status, waiting-list place, passengers, lesson / course, aircraft + instructor colours and the can_* flags.
   History: GET booking_audit_trail/booking/{id} (v1's call); ids in the snapshots are turned into names here from
   scheduler/v2/booking/{id}, the scheduler day's resources and the course's lessons (best effort — the backend's
   readable history is "can follow").
   Writes stay on today's routes: cancel = DELETE bookings/{id}?reason=&notes= through CancellationFeesService
   (+ the fee claim), with the shared reason picker <cancel-reason-fields>, exactly like the scheduler card.

   Suggest a time (contract C44, 9 Nov — design: mockups/instructor-dashboard/my-schedule.html, pages "Sam's side"):
   the same read carries offers[] (not paged) — requests the instructor answered with 1–3 other times. Open ones are the
   "Needs you" cards above the day groups (Take this time → POST bookings/v2/offer/{id}/take {index}; None of these work →
   …/reply {message?} or DELETE bookings/v2/offer/{id}); replied and ended ones (48 h) sit under "Your requests". The
   e-mail's link is ?offer={id} (data.keepV2With keeps it on v2 with the switch off): the card is scrolled to and
   highlighted, an ended / unknown offer gets a note. Refusals are worded in the card (ToastService.handledInline()).

   SHARED with the v2 home (js/v2/home/home.js injects them):
     BookingsV2Data      the read + the copy helpers (status / kind / passenger words, dates, lengths)
     <bkg-cancel-dialog> the cancel record dialog (CSS in css/v2/bookings.css, which loads app-wide)
   Page CSS: css/v2/bookings.css (.bkg-*).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.bookings', {
            url: '/my_account/upcoming_bookings?open&offer',   // offer = a Suggest-a-time offer from the e-mail link (C44)
            data: { keepV2With: 'offer' },   // the classic Bookings page has no offers: the e-mail link stays on v2 (design.js)
            templateUrl: 'views/v2/bookings/upcoming.html',
            controller: 'BookingsV2Controller', controllerAs: 'vm'
        })
        .state('dashboard.v2.booking_history', {
            url: '/my_account/booking_history/:booking_id',
            templateUrl: 'views/v2/bookings/history.html',
            controller: 'BookingHistoryV2Controller', controllerAs: 'vm'
        });
    DesignRoutesProvider
        .map('dashboard.my_account.upcoming_bookings', 'dashboard.v2.bookings')
        .map('dashboard.my_account.booking_audit_trail', 'dashboard.v2.booking_history');
}]);


// ═══════════════════════════════════════════════════════════════════════
// BookingsV2Data — bookings/v2/upcoming + ONE helper per domain (guidelines §7: raw enums never reach the screen)
// ═══════════════════════════════════════════════════════════════════════
app.factory('BookingsV2Data', BookingsV2Data);
BookingsV2Data.$inject = ['$http', '$location', 'SchedulerV2Service'];
function BookingsV2Data($http, $location, SchedulerV2Service) {
    // tables first (a var below the return is hoisted but never assigned)
    var KIND_ICONS = { dual: 'fa-user-friends', solo: 'fa-user', hire: 'fa-key', trial: 'fa-star', maint: 'fa-wrench' };
    var WALL = 'YYYY-MM-DD HH:mm:ss';
    var service = {};

    service.Upcoming = Upcoming;
    service.History = History;
    service.lastChange = lastChange;
    service.feeText = feeText;
    service.parse = parse;
    service.fTime = fTime;
    service.fDay = fDay;
    service.fDayLong = fDayLong;
    service.fDate = fDate;
    service.dayWord = dayWord;
    service.daysBetween = daysBetween;
    service.len = len;
    service.minutesBetween = minutesBetween;
    service.ord = ord;
    service.firstName = firstName;
    service.kindLabel = function (k) { return SchedulerV2Service.kindLabel(k); };
    service.kindIcon = function (k) { return KIND_ICONS[k] || 'fa-calendar'; };
    service.state = state;
    service.paxState = paxState;
    service.notFinal = notFinal;
    service.todayOf = todayOf;
    // Suggest a time (C44): the student's side
    service.TakeOffer = TakeOffer;
    service.ReplyOffer = ReplyOffer;
    service.CancelOffer = CancelOffer;
    service.rel = rel;
    service.initials = initials;
    service.offerOpen = function (it) { return !!(it && it.offer && it.offer.state === 'open'); };
    return service;

    // GET bookings/v2/upcoming?page&per_page&club_id&q → { summary, bookings[], pagination, now, viewer_id }
    function Upcoming(params) {
        var q = [];
        angular.forEach(params || {}, function (v, k) {
            if (v !== null && v !== undefined && v !== '' && v !== 0) { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); }
        });
        return $http.get('/api/v1/bookings/v2/upcoming' + (q.length ? '?' + q.join('&') : '')).then(handleSuccess, handleError2);
    }

    // ── Suggest a time (contract C44, be-alex-3e.md): the student answers an offer of other times ──
    // Errors come back as HTTP 200 {success:false, error, message, state | offer_state}: NOT_OPEN{state},
    // TIME_GONE{offer_state}, VOUCHER_IN_USE, FORBIDDEN, NOT_FOUND, BUSY, SAVE_FAILED, VALIDATION_ERROR.
    // POST bookings/v2/offer/{offer_id}/take {index} → {success, booking_id, offer}
    function TakeOffer(offerId, index) {
        return $http.post('/api/v1/bookings/v2/offer/' + offerId + '/take', { index: index }).then(handleSuccess, handleError2);
    }
    // POST bookings/v2/offer/{offer_id}/reply {message?} → {success, offer} (open → replied)
    function ReplyOffer(offerId, message) {
        return $http.post('/api/v1/bookings/v2/offer/' + offerId + '/reply', message ? { message: message } : {}).then(handleSuccess, handleError2);
    }
    // DELETE bookings/v2/offer/{offer_id} → {success, offer} (the student cancels: closed, closed_reason "cancelled")
    function CancelOffer(offerId) {
        return $http['delete']('/api/v1/bookings/v2/offer/' + offerId).then(handleSuccess, handleError2);
    }

    // GET bookings/v2/history/{id} (C23) → { success, booking_id, entries[] } — the audit trail plus reason_label / note /
    // reason_key and, on the cancellation, fee {outcome, amount, currency, invoice_number, at}; synthetic:true = an old cancellation
    function History(id) { return $http.get('/api/v1/bookings/v2/history/' + id).then(handleSuccess, handleError2); }

    // a row's last_change (someone else's latest change) in words: { verb: 'Moved'|'Extended'|'Changed', who, when, summary }
    function lastChange(lc, today) {
        if (!lc || !lc.by) { return null; }
        var f = lc.fields || [];
        var verb = lc.action === 'extended' ? 'Extended' : (f.indexOf('start') > -1 || f.indexOf('end') > -1 || f.indexOf('plane_id') > -1) ? 'Moved' : 'Changed';
        var d = daysBetween(today || moment().format('YYYY-MM-DD'), String(lc.at).slice(0, 10));
        var rel = d === 0 ? 'today' : d === -1 ? 'yesterday' : (d < 0 && d > -7) ? (-d) + ' days ago' : fDay(lc.at);
        return { verb: verb, who: lc.by.name || 'Someone', first: firstName(lc.by.name || 'Someone'), rel: rel, time: fTime(lc.at), summary: lc.summary || '' };
    }

    // the fee on a cancellation, as the design writes it: "No-show fee of £50.00 charged · invoice TPC2563"
    function feeText(fee, key, money, feeName) {
        if (!fee || !fee.outcome || fee.outcome === 'none') { return ''; }
        var name = feeName(key || fee.reason_key);
        name = name.charAt(0).toUpperCase() + name.slice(1);
        var amt = fee.amount !== null && fee.amount !== undefined ? ' of ' + money(fee.amount, fee.currency) : '';
        if (fee.outcome === 'charged') { return name + amt + ' charged' + (fee.invoice_number ? ' · invoice ' + fee.invoice_number : ''); }
        if (fee.outcome === 'waived') { return name + amt + ' waived — not charged'; }
        if (fee.outcome === 'reversed') { return name + amt + ' charged, then reversed' + (fee.invoice_number ? ' · invoice ' + fee.invoice_number + ' voided' : ''); }
        if (fee.outcome === 'due') { return name + amt + ' may be charged — the club hasn\'t decided yet'; }
        return '';
    }

    // ── dates: every booking time is club wall-clock (never shifted) ──
    function parse(s) {
        if (!s) { return moment.invalid(); }
        s = String(s);
        return s.length <= 10 ? moment(s, 'YYYY-MM-DD') : moment(s.slice(0, 19).replace('T', ' '), WALL);
    }
    function fTime(s) { var m = parse(s); return m.isValid() ? m.format('HH:mm') : ''; }
    function fDay(s) { var m = parse(s); return m.isValid() ? m.format('ddd D MMM') : ''; }
    function fDayLong(s) { var m = parse(s); return m.isValid() ? m.format('ddd D MMM YYYY') : ''; }
    function fDate(s) { var m = parse(s); return m.isValid() ? m.format('D MMM YYYY') : ''; }
    function todayOf(now) { var m = parse(now); return (m.isValid() ? m : moment()).format('YYYY-MM-DD'); }
    function daysBetween(a, b) { return Math.round(parse(String(b).slice(0, 10)).diff(parse(String(a).slice(0, 10)), 'days', true)); }
    // Today / Tomorrow / Yesterday / "Tue 10 Nov"
    function dayWord(s, today) {
        var d = daysBetween(today || moment().format('YYYY-MM-DD'), s);
        return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : fDay(s);
    }
    function minutesBetween(a, b) { return Math.round(parse(b).diff(parse(a), 'minutes', true)); }
    // a booking length, guidelines §4.7: "1h30", "2h", "45m"
    function len(m) {
        m = Math.max(0, Math.round(m || 0));
        var h = Math.floor(m / 60), r = m % 60;
        return h ? h + 'h' + (r ? (r < 10 ? '0' + r : r) : '') : r + 'm';
    }
    function ord(n) {
        n = parseInt(n, 10) || 0;
        var t = n % 100;
        if (t >= 11 && t <= 13) { return n + 'th'; }
        return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    }
    function firstName(n) { return String(n || '').split(' ')[0]; }
    function initials(n) {
        var p = String(n || '').trim().split(/\s+/);
        return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
    }
    // a moment in words, relative to today: "today 11:20", "yesterday 18:30", "tomorrow 09:00", "Wed 4 Nov 18:30"
    function rel(s, today) {
        var d = daysBetween(today || moment().format('YYYY-MM-DD'), s);
        return (d === 0 ? 'today' : d === -1 ? 'yesterday' : d === 1 ? 'tomorrow' : fDay(s)) + ' ' + fTime(s);
    }

    // dashed card / chip = not final (awaiting confirmation, or a waiting-list place) — the scheduler's rule
    function notFinal(b) { return !!b && (b.status === 'pending' || b.waiting_list > 0); }

    // The booking's status in the viewer's words → { tone, label, icon }
    function state(b) {
        if (!b) { return { tone: 'muted', label: '', icon: '' }; }
        if (b._cancelled) { return { tone: 'bad', label: 'Cancelled', icon: 'fa-times-circle' }; }
        if (b.waiting_list > 0) {
            return { tone: 'warn', label: 'Waiting list' + (b.waiting_position ? ' · ' + ord(b.waiting_position) + ' in line' : ''), icon: 'fa-hourglass-half' };
        }
        if (b.status === 'pending') {
            if (b.can_approve) { return { tone: 'warn', label: 'Needs your confirmation', icon: 'fa-exclamation-circle' }; }
            if (b.pending_by === 'club') { return { tone: 'pend', label: 'Awaiting club approval', icon: 'fa-hourglass-half' }; }
            // be-alex-3e (10 Nov): voucher requests routed to "both" — the instructor OR the club may confirm
            if (b.pending_by === 'both') { return { tone: 'pend', label: b.instructor && b.instructor.name ? 'Awaiting ' + firstName(b.instructor.name) + ' or the club' : 'Awaiting the club', icon: 'fa-hourglass-half' }; }
            return { tone: 'pend', label: b.instructor && b.instructor.name ? 'Awaiting ' + firstName(b.instructor.name) + '\'s confirmation' : 'Awaiting confirmation', icon: 'fa-hourglass-half' };
        }
        if (b.booked_out) { return { tone: 'info', label: 'Booked out', icon: 'fa-plane-departure' }; }
        if (b.kind === 'maint') { return { tone: 'muted', label: 'Maintenance', icon: 'fa-wrench' }; }
        return { tone: 'good', label: 'Confirmed', icon: 'fa-check' };
    }

    // passengers: the invitation status in the booking panel's words
    function paxState(p) {
        var s = p && p.status;
        if (s === 'accepted' || s === 'member') { return { tone: 'good', label: 'Ready to fly', icon: 'fa-check' }; }
        if (s === 'declined') { return { tone: 'bad', label: 'Declined', icon: 'fa-times' }; }
        return { tone: 'pend', label: 'Invited — awaiting reply', icon: 'fa-envelope' };
    }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data;
        if (d && typeof d === 'object' && d.error) { return { success: false, error: d.error, message: d.message || d, status: res.status }; }
        return { success: false, message: d, status: res.status };
    }
}


// ═══════════════════════════════════════════════════════════════════════
// <bkg-cancel-dialog booking viewer-id on-done="…(result)" on-close="…">
// The cancel record dialog (aircraft colour as its edge): the shared reason picker (+ the club's fee), the note,
// the waiting-list line. DELETE bookings/{id}?reason&notes, then the fee claim when switched on —
// CancellationFeesService.CancelBooking, the scheduler card's call. Esc / the scrim / × close it.
// `booking` is a bookings/v2/upcoming row (or the same shape).
// ═══════════════════════════════════════════════════════════════════════
app.directive('bkgCancelDialog', function () {
    return {
        restrict: 'E',
        scope: { booking: '=', viewerId: '=', onDone: '&', onClose: '&' },
        templateUrl: 'views/v2/bookings/cancel_dialog.html',
        controller: 'BookingCancelV2Controller',
        controllerAs: 'cx',
        bindToController: true
    };
});

app.controller('BookingCancelV2Controller', BookingCancelV2Controller);
BookingCancelV2Controller.$inject = ['$scope', '$element', '$timeout', '$document', 'CancellationFeesService', 'BookingsV2Data', 'ToastService'];
function BookingCancelV2Controller($scope, $element, $timeout, $document, CancellationFeesService, BookingsV2Data, ToastService) {
    var cx = this;
    cx.D = BookingsV2Data;
    cx.state = { reason: '', notes: '' };
    cx.err = null;
    cx.busy = false;

    cx.waiting = function () { return !!(cx.booking && cx.booking.waiting_list > 0); };
    cx.pilotName = function () { return (cx.booking && cx.booking.pilot && cx.booking.pilot.name) || 'the pilot'; };
    cx.isStaffView = function () { return !!(cx.booking && cx.booking.role === 'instructor'); };
    // "Lesson with Kate Ellis" / "Sam Carter with Alex Reynier" (instructor view) / "Self-fly hire"
    cx.withWho = function () {
        var b = cx.booking || {};
        if (b.role === 'instructor') { return (b.pilot && b.pilot.name ? b.pilot.name : 'Student') + (b.instructor ? ' with ' + b.instructor.name : ''); }
        var what = b.lesson ? b.lesson.title : BookingsV2Data.kindLabel(b.kind);
        return what + (b.instructor ? ' with ' + b.instructor.name : '');
    };
    cx.goLabel = function () {
        if (cx.waiting()) { return 'Leave the waiting list'; }
        if (cx.state.claim && cx.state.fee > 0) { return 'Cancel & charge ' + CancellationFeesService.money(cx.state.fee, cx.state.currency); }
        return 'Cancel booking';
    };
    // "Keep booking" closes at once (an explicit choice); Esc, the scrim and × ask first when a note has been typed
    cx.close = function () { if (!cx.busy) { cx.discardAsk = false; cx.onClose(); } };
    cx.dismiss = function () {
        if (cx.busy) { return; }
        if (String(cx.state.notes || '').trim() && !cx.discardAsk) { cx.discardAsk = true; return; }
        cx.close();
    };
    cx.keepEditing = function () { cx.discardAsk = false; $timeout(function () { var el = document.getElementById('bkg-cx-notes'); if (el) { el.focus(); } }); };
    cx.scrim = function (e) { if (e && e.target === e.currentTarget) { cx.dismiss(); } };

    cx.go = function () {
        var b = cx.booking;
        if (!b || cx.busy) { return; }
        if (!cx.state.reason) { cx.err = 'reason'; return; }
        if (cx.state.key === 'other' && !String(cx.state.notes || '').trim()) {
            cx.err = 'notes';
            $timeout(function () { var el = document.getElementById('bkg-cx-notes'); if (el) { el.focus(); } });
            return;
        }
        if (cx.waiting()) { cx.state.claim = false; }   // a waiting-list place never carries a fee
        cx.err = null;
        cx.busy = true;
        CancellationFeesService.CancelBooking(cx.viewerId, b.id, cx.state).then(function (res) {
            cx.busy = false;
            if (!res || !res.success) {
                ToastService.error('Not cancelled', (res && res.message) || 'The booking could not be cancelled — nothing has changed.');
                return;
            }
            var reg = b.aircraft ? b.aircraft.reg : 'the aircraft';
            if (cx.waiting()) {
                ToastService.success('Off the waiting list', 'For ' + reg + ' on ' + BookingsV2Data.fDay(b.start) + '.', { confetti: false });
            } else if (res.claim && res.claim.success) {
                ToastService.success('Booking cancelled', CancellationFeesService.outcomeText(res.claim, cx.state.currency), { confetti: false });
            } else if (res.claim) {
                ToastService.warning('Booking cancelled, fee not added', CancellationFeesService.outcomeText(res.claim) + ' You can claim it from Cancellations.');
            } else {
                ToastService.success('Booking cancelled', 'The reason is on the booking\'s history.', { confetti: false });
            }
            cx.onDone({ result: { booking: b, reason: cx.state.reason, key: cx.state.key, notes: cx.state.notes, claim: res.claim || null } });
        });
    };

    $scope.$watch(function () { return cx.state.reason; }, function (v) { if (v && cx.err === 'reason') { cx.err = null; } });
    $scope.$watch(function () { return cx.state.notes; }, function (v) { if (v && String(v).trim() && cx.err === 'notes') { cx.err = null; } });

    function onKey(e) { if (e.keyCode === 27) { $scope.$apply(cx.discardAsk ? cx.close : cx.dismiss); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });
    $timeout(function () { var el = $element[0].querySelector('.ta-dlg'); if (el) { el.focus(); } });
}


// ═══════════════════════════════════════════════════════════════════════
// My bookings (Upcoming)
// ═══════════════════════════════════════════════════════════════════════
app.controller('BookingsV2Controller', BookingsV2Controller);
BookingsV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$timeout', '$q', 'BookingsV2Data', 'MemberService', 'ToastService'];
function BookingsV2Controller($rootScope, $scope, $state, $stateParams, $timeout, $q, BookingsV2Data, MemberService, ToastService) {
    var vm = this;
    var D = vm.D = BookingsV2Data;
    var PER_PAGE = 20;
    var qTimer = null;
    var seq = 0;
    var cancelledIds = {};        // cancelled in this visit
    var base = null;              // the last read without a search: the tiles and chip counts describe it (a search narrows the list only)

    vm.user = $rootScope.globals.currentUser;
    vm.isStaff = isStaff();
    vm.load = 'loading';          // loading | error | ready
    vm.rows = [];
    vm.summary = null;
    vm.pagination = null;
    vm.today = moment().format('YYYY-MM-DD');
    vm.nowStr = moment().format('YYYY-MM-DD HH:mm:ss');
    vm.club = 0;                  // 0 = all clubs
    vm.clubs = [];                // [{id, name}] — only drawn with more than one
    vm.q = '';
    vm.filter = 'all';            // all | attn | wait
    vm.openId = parseInt($stateParams.open, 10) || null;
    vm.groups = [];
    vm.tiles = [];
    vm.moreBusy = false;
    vm.cx = null;                 // the booking being cancelled (dialog open)
    vm.everAny = false;           // anything at all upcoming (decides the "no bookings" empty state)
    // Suggest a time (C44): offers[] from the same read — requests the instructor answered with other times
    vm.offers = [];               // every listed offer (open, replied, ended in the last 48 h), decorated
    vm.ofNeed = [];               // open ones: the "Needs you" cards (after the filter / search)
    vm.ofOther = [];              // replied cards + the ended lines ("Your requests")
    vm.declinedReqs = [];         // lesson requests an instructor declined in the last 48 h (upcoming `declined[]`, owner 10 Nov)
    vm.decShown = [];             // …the ones the filter / search show
    vm.ofs = {};                  // per offer id: { nowork, text, cancelAsk, busy: null|'take'|'reply'|'cancel', taking, err }
    vm.offerId = parseInt($stateParams.offer, 10) || null;    // ?offer= — the e-mail's "SEE THE TIMES" link
    vm.offerNote = null;          // what that link found when the offer has ended / isn't here: { tone, icon, title, text }
    vm.offerHi = null;            // the offer given a brief highlight (deep link)
    vm.justBooked = null;         // the booking "Take this time" made in this visit ("Booked just now")
    var offerLanded = false;      // the deep link is handled once

    vm.reload = function () { fetch(false); };
    vm.more = more;
    vm.setClub = function (id) { if (vm.club === id) { return; } vm.club = id; vm.openId = null; fetch(false); };
    vm.setFilter = setFilter;
    vm.onQ = function () { if (qTimer) { $timeout.cancel(qTimer); } qTimer = $timeout(function () { fetch(false); }, 300); };
    vm.clearQ = function () { vm.q = ''; fetch(false); };
    vm.toggle = function (b) { vm.openId = vm.openId === b.id ? null : b.id; };
    vm.state = function (b) {
        if (vm.justBooked && b && b.id === vm.justBooked && !b._cancelled) { return { tone: 'good', label: 'Booked just now', icon: 'fa-check' }; }
        return D.state(b);
    };
    vm.paxState = D.paxState;
    vm.who = who;
    vm.title = title;
    vm.subParts = subParts;
    vm.declined = declined;
    vm.multiClub = function () { return vm.clubs.length > 1 || (vm.summary && vm.summary.club_ids && vm.summary.club_ids.length > 1); };
    vm.bookOut = function (b) { $state.go('dashboard.my_account.bookout_with_booking', { booking_id: b.id }); };
    vm.history = function (b) { $state.go('dashboard.my_account.booking_audit_trail', { booking_id: b.id }); };
    vm.onScheduler = function (b) { $state.go('dashboard.scheduler_v2', { date: b.date }); };
    vm.edit = function (b) { $state.go('dashboard.scheduler_v2.edit', { booking_id: b.id, date: b.date }); };
    vm.newBooking = function () { $state.go('dashboard.scheduler_v2.add', {}); };
    vm.openScheduler = function () { $state.go('dashboard.scheduler_v2', {}); };
    vm.findSlot = function () { $state.go('dashboard.slot_search'); };
    vm.toConfirm = function () { $state.go('dashboard.manage_user.my_schedule'); };
    vm.startCancel = function (b) { vm.cx = b; };
    vm.closeCancel = function () { vm.cx = null; };
    vm.cancelled = cancelled;
    vm.rentalText = function (b) { return (b.rental_items || []).map(function (r) { return r.title + (r.quantity > 1 ? ' × ' + r.quantity : ''); }).join(', '); };
    vm.liveCount = function () { return vm.rows.filter(function (b) { return !b._cancelled; }).length; };
    // Suggest a time (C44)
    vm.ui = ui;
    vm.take = take;
    vm.noWork = function (it) { var u = ui(it); u.nowork = true; u.cancelAsk = false; u.err = null; };
    vm.askAgain = askAgain;
    vm.cancelAsk = function (it) { var u = ui(it); u.cancelAsk = true; u.err = null; };
    vm.cancelNo = function (it) { ui(it).cancelAsk = false; };
    vm.cancelOffer = cancelOffer;
    vm.showTaken = showTaken;
    vm.bookAnother = function (it) { $state.go('dashboard.scheduler_v2', { date: it && it.date && it.date >= vm.today ? it.date : null }); };
    vm.closeOfferNote = function () { vm.offerNote = null; };
    // who a pending request waits for, as the subject of "… hasn't confirmed yet" (pending_by: instructor | club | both)
    vm.pendingWho = function (b) {
        var ins = b && b.instructor && b.instructor.name ? b.instructor.name : '';
        if (b && b.pending_by === 'club') { return 'The club'; }
        if (b && b.pending_by === 'both') { return ins ? ins + ' or the club' : 'The club'; }
        return ins || 'The club';
    };
    vm.hasOffers = function () { return vm.offers.length > 0 || vm.declinedReqs.length > 0; };   // anything under "Your requests"
    vm.reqNote = function () {
        if (!vm.ofOther.length) { return 'Declined requests stay here for 2 days'; }
        return 'Other times suggested · ended' + (vm.decShown.length ? ' and declined' : '') + ' ones stay here for 2 days';
    };

    fetch(false);

    function isStaff() {
        var a = (vm.user && vm.user.access) || {};
        return !!((a.instructor && a.instructor.length) || (a.manager && a.manager.length));
    }

    // page 1 (replace) or the next page (append)
    function fetch(append) {
        var my = ++seq;
        var page = append && vm.pagination ? vm.pagination.page + 1 : 1;
        if (!append) { vm.load = vm.load === 'ready' ? 'ready' : 'loading'; vm.refreshing = true; }
        return D.Upcoming({ page: page, per_page: PER_PAGE, club_id: vm.club || null, q: (vm.q || '').trim() }).then(function (data) {
            if (my !== seq) { return; }
            vm.refreshing = false;
            if (!data || !data.success) {
                if (!append) { vm.load = 'error'; }
                else { ToastService.error('Couldn\'t load more bookings', 'The connection dropped — try Show more again.'); }
                return;
            }
            vm.today = D.todayOf(data.now);
            vm.nowStr = data.now || vm.nowStr;
            var rows = (data.bookings || []).map(decorate);
            if (append) {
                var seen = {};
                vm.rows.forEach(function (b) { seen[b.id] = true; });
                rows.forEach(function (b) { if (!seen[b.id]) { vm.rows.push(b); } });
            } else {
                // a booking cancelled in this visit stays as a quiet line until you leave (even if a stale read still lists it)
                var ghosts = vm.rows.filter(function (b) { return b._cancelled; });
                rows = rows.filter(function (r) { return !cancelledIds[r.id]; });
                vm.rows = rows.concat(ghosts);
                vm.rows.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id; });
            }
            vm.summary = data.summary || null;
            vm.pagination = data.pagination || null;
            setOffers(data.offers);
            setDeclined(data.declined);
            if (!(vm.q || '').trim()) { base = { summary: vm.summary, pagination: vm.pagination, rows: vm.rows }; }
            if (!vm.club && !(vm.q || '').trim() && vm.summary) { vm.everAny = vm.summary.total > 0; }
            else if (vm.summary && vm.summary.total > 0) { vm.everAny = true; }
            learnClubs();
            vm.load = 'ready';
            rebuild();
            if (vm.openId) { scrollToOpen(); }
            landOffer();
        });
    }

    function more() {
        if (vm.moreBusy || !vm.pagination || !vm.pagination.has_more) { return $q.when(); }
        vm.moreBusy = true;
        return fetch(true).then(function () { vm.moreBusy = false; }, function () { vm.moreBusy = false; });
    }

    // a filter chip looks at every upcoming booking: load the rest first (at most a few pages)
    function setFilter(f) {
        vm.filter = f;
        vm.openId = null;
        rebuild();
        if (f !== 'all') { loadAll(0); }
    }
    function loadAll(n) {
        if (n > 6 || !vm.pagination || !vm.pagination.has_more) { return; }
        more().then(function () { loadAll(n + 1); });
    }

    function decorate(b) {
        b._attn = attnOf(b);
        b._lc = D.lastChange(b.last_change, vm.today);      // "Moved by Kate · yesterday" (C23; null when the viewer made it)
        return b;
    }
    // Needs a look: a passenger declined; a request still unconfirmed two days after it was made (calendar days, as the
    // design's "asked on Wed" → Fri); (instructor) waiting for your yes
    function attnOf(b) {
        if (b.waiting_list > 0) { return null; }
        if (b.can_approve) { return 'confirm'; }
        if (declined(b)) { return 'pax'; }
        if (b.status === 'pending' && b.created_at && D.daysBetween(String(b.created_at).slice(0, 10), vm.today) >= 2) { return 'pending'; }
        return null;
    }
    function declined(b) {
        var out = null;
        (b.passengers || []).forEach(function (p) { if (!out && p.status === 'declined') { out = p; } });
        return out;
    }

    function learnClubs() {
        var byId = {};
        vm.clubs.forEach(function (c) { byId[c.id] = c; });
        vm.rows.concat(vm.offers).forEach(function (b) { if (b.club_id && !byId[b.club_id]) { byId[b.club_id] = { id: b.club_id, name: b.club_name }; vm.clubs.push(byId[b.club_id]); } });
        var ids = (vm.summary && vm.summary.club_ids) || [];
        var missing = ids.filter(function (id) { return !byId[id]; });
        if (missing.length && !vm._clubsAsked) {
            vm._clubsAsked = true;
            MemberService.GetUserMemberships(vm.user.id).then(function (data) {
                (data && data.memberships || []).forEach(function (m) {
                    var id = parseInt(m.club_id, 10);
                    if (id && !byId[id] && ids.indexOf(id) > -1) { byId[id] = { id: id, name: m.club_name }; vm.clubs.push(byId[id]); }
                });
            });
        }
    }

    function matches(b) {
        if (vm.filter === 'attn') { return !!b._attn && !b._cancelled; }
        if (vm.filter === 'wait') { return b.waiting_list > 0 && !b._cancelled; }
        return true;
    }

    // day groups + tiles, from the loaded rows (counts that cover every booking come from the summary)
    function rebuild() {
        var groups = [], by = {};
        vm.rows.filter(matches).forEach(function (b) {
            var d = b.date || String(b.start).slice(0, 10);
            if (!by[d]) { by[d] = { date: d, items: [] }; groups.push(by[d]); }
            by[d].items.push(b);
        });
        groups.forEach(function (g) {
            var diff = D.daysBetween(vm.today, g.date);
            g.today = diff === 0;
            g.word = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : '';
            g.day = D.fDay(g.date);
            var live = g.items.filter(function (b) { return !b._cancelled; });
            var flying = live.filter(function (b) { return !(b.waiting_list > 0); });
            var mins = flying.reduce(function (s, b) { return s + (b.minutes || 0); }, 0);
            var nw = live.length - flying.length, parts = [];
            if (flying.length) { parts.push(flying.length + ' booking' + (flying.length > 1 ? 's' : '') + ' · ' + D.len(mins)); }
            if (nw) { parts.push(nw + ' waiting-list place' + (nw > 1 ? 's' : '')); }
            g.count = parts.join(' · ');
        });
        vm.groups = groups;
        // offers aren't paged and the search doesn't reach them server-side: filter them here
        var q = (vm.q || '').trim().toLowerCase();
        var shown = vm.filter === 'wait' ? [] : vm.offers.filter(function (it) { return !q || it._search.indexOf(q) > -1; });
        vm.ofNeed = shown.filter(function (it) { return it._st === 'open'; });
        vm.ofOther = vm.filter === 'attn' ? [] : shown.filter(function (it) { return it._st !== 'open'; });
        vm.decShown = vm.filter !== 'all' ? [] : vm.declinedReqs.filter(function (d) { return !q || d._search.indexOf(q) > -1; });
        vm.nOffers = vm.offers.filter(function (it) { return it._st === 'open'; }).length;
        var bRows = (base && base.rows) || vm.rows, bSum = (base && base.summary) || vm.summary;
        vm.nAttn = bRows.filter(function (b) { return b._attn && !b._cancelled; }).length + vm.nOffers;
        vm.nWait = bRows.filter(function (b) { return b.waiting_list > 0 && !b._cancelled; }).length;
        if (bSum && bSum.waiting > vm.nWait) { vm.nWait = bSum.waiting; }
        if (bSum && bSum.to_confirm > 0 && vm.isStaff) { vm.nAttn = Math.max(vm.nAttn, bSum.to_confirm); }
        vm.allCount = bSum ? bSum.total : vm.rows.length;
        vm.tiles = buildTiles(bRows, bSum, (base && base.pagination) || vm.pagination);
    }

    function offerWho(it) { return it ? it._by : 'Your instructor'; }
    function buildTiles(rows, s, pag) {
        var live = rows.filter(function (b) { return !b._cancelled; });
        if (!s || !live.length) { return []; }
        var out = [], rest = [];
        var next = null;
        live.forEach(function (b) { if (!next && !(b.waiting_list > 0) && b.start >= vm.nowStr) { next = b; } });
        if (!next) { live.forEach(function (b) { if (!next && !(b.waiting_list > 0)) { next = b; } }); }
        if (next) {
            var m = D.minutesBetween(vm.nowStr, next.start), cd = m > 0 && m < 24 * 60 ? 'in ' + D.len(m) : '';
            var whoTxt = next.role === 'instructor' ? (next.pilot && next.pilot.name) : (next.instructor ? 'with ' + next.instructor.name : D.kindLabel(next.kind).toLowerCase());
            out.push({ cls: 'ta-tile--progress', icon: 'fa-plane-departure', k: 'Next flight', words: true,
                v: (D.daysBetween(vm.today, next.date) === 0 ? 'Today ' : D.fDay(next.start) + ', ') + D.fTime(next.start),
                s: [next.aircraft ? next.aircraft.reg : '', whoTxt, cd].filter(Boolean).join(' · ') });
        }
        if (vm.nAttn) {
            var why = [];
            if (vm.nOffers) { why.push(vm.nOffers === 1 ? offerWho(vm.offers.filter(function (it) { return it._st === 'open'; })[0]) + ' suggested other times' : 'other times suggested'); }
            live.forEach(function (b) {
                if (b._attn === 'pax') { why.push('a passenger declined'); }
                else if (b._attn === 'pending') { why.push('not confirmed yet'); }
            });
            out.push({ cls: 'ta-tile--attn', icon: 'fa-exclamation-circle', k: vm.isStaff && s.to_confirm ? 'To confirm' : 'Needs a look', v: vm.nAttn,
                s: vm.isStaff && s.to_confirm ? vm.nAttn + (vm.nAttn === 1 ? ' student waiting' : ' students waiting') + ' for your yes or no' : uniq(why).join(' · '),
                go: vm.nAttn === 1 ? 'Show it' : 'Show them', goFilter: 'attn' });
        }
        if (s.waiting > 0) {
            var w = null;
            live.forEach(function (b) { if (!w && b.waiting_list > 0) { w = b; } });
            out.push({ icon: 'fa-hourglass-half', k: 'Waiting list', v: s.waiting,
                s: w ? (w.waiting_position ? D.ord(w.waiting_position) + ' in line for ' : 'For ') + (w.aircraft ? w.aircraft.reg : 'an aircraft') + ', ' + D.fDay(w.start) : 'Places on a waiting list' });
        }
        var loaded = live.length, clubsN = (s.club_ids || []).length;
        var last = live.length ? live[live.length - 1] : null;      // the list's last booking (a waiting-list place included)
        rest.push({ icon: 'fa-calendar-check', k: 'Upcoming', v: s.total,
            s: pag && pag.has_more
                ? (vm.isStaff ? 'as pilot or instructor · ' : '') + 'next ' + loaded + ' shown below'
                : (last ? 'until ' + D.fDay(last.start) : '') + (clubsN > 1 ? ' · at ' + clubsN + ' clubs' : '') });
        out = out.concat(rest);
        if (out.length < 4 && s.booked_minutes > 0) {
            out.push({ icon: 'fa-clock', k: 'Booked time', v: D.len(s.booked_minutes), s: 'Total length of these bookings — not flight time' });
        }
        return out.slice(0, 4);
    }
    function uniq(a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) < 0) { o.push(x); } }); return o; }

    // card words
    function title(b) { return b.lesson ? b.lesson.title : D.kindLabel(b.kind); }
    function subParts(b) {
        var p = [];
        if (b.lesson) { p.push(D.kindLabel(b.kind)); }
        if (b.course) { p.push(b.course.title); }
        if (b.voucher_id > 0) { p.push('Voucher'); }
        if (vm.multiClub() && b.club_name) { p.push(b.club_name); }
        return p.join(' · ');
    }
    // who's on it from the viewer's side: the student (instructor view, grey icon) or the instructor (initials circle)
    function who(b) {
        if (b.role === 'instructor') { return { kind: 'member', name: (b.pilot && b.pilot.name) || 'Student', title: 'Student' }; }
        if (b.instructor) { return { kind: 'instructor', name: b.instructor.name, code: b.instructor.code, colour: b.instructor.colour, title: b.instructor.name + ' (instructor)' }; }
        return { kind: 'none', name: 'No instructor' };
    }

    function cancelled(result) {
        var b = result && result.booking;
        vm.cx = null;
        if (!b) { return; }
        cancelledIds[b.id] = true;
        b._cancelled = { reason: result.reason, key: result.key, fee: result.claim && result.claim.success ? result.claim.fee : 0, currency: result.claim && result.claim.currency };
        if (vm.openId === b.id) { vm.openId = null; }
        rebuild();
        // the summary (tiles) changed server-side — refresh it quietly; the ghost line stays
        $timeout(function () { fetch(false); }, 600);
    }
    vm.reasonWords = function (b) {
        var r = b._cancelled && b._cancelled.reason;
        if (!r) { return ''; }
        return /^Other/.test(r) ? 'Other' : r;
    };

    function scrollToOpen() {
        $timeout(function () {
            var el = document.getElementById('bkg-bk-' + vm.openId);
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center' }); }
        }, 120);
    }
    function scrollToId(id) {
        $timeout(function () {
            var el = document.getElementById(id);
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center' }); }
        }, 120);
    }

    // ═══ Suggest a time (contract C44) — the student's side ═══
    // An offer is an item of its own (the request was released when the times were sent), shaped like a booking card for
    // the time ASKED for, plus offer{state, note, times[]…} and can_take / can_reply / can_cancel. Ended or not is
    // offer.state only (never open_until: a taken or withdrawn offer keeps a future open_until).
    function setOffers(list) {
        if (!angular.isArray(list)) { list = []; }
        var colours = {};      // instructor colours from the booking rows (an offer names people by id + name only)
        vm.rows.forEach(function (b) { if (b.instructor && b.instructor.id && b.instructor.colour) { colours[b.instructor.id] = b.instructor.colour; } });
        vm.offers = list.map(function (it) { return decorateOffer(it, colours); });
    }

    // a lesson request an instructor declined: one quiet line under "Your requests" for 48 h, with their reason when given
    // (be-alex-3e: upcoming `declined[]` = { booking_id, declined_at, start, end, aircraft, lesson, course, by, reason })
    function setDeclined(list) {
        vm.declinedReqs = (angular.isArray(list) ? list : []).map(function (d) {
            var by = d.by && String(d.by.name || '').trim() ? String(d.by.name).trim() : 'Your instructor';
            var reg = d.aircraft && d.aircraft.reg ? d.aircraft.reg : '', reason = String(d.reason || '').trim();
            return { id: +d.booking_id, raw: d, date: String(d.start || '').slice(0, 10),
                txt: by + ' declined your request for ' + D.fDay(d.start) + ', ' + D.fTime(d.start) + (reg ? ' (' + reg + ')' : '') + (reason ? ' — “' + reason + '”' : '.'),
                _search: [reg, by, d.lesson && d.lesson.title, d.course && d.course.title, d.club_name, reason, 'declined'].join(' ').toLowerCase() };
        });
    }

    function ui(it) {
        var id = it && it.offer_id;
        if (!vm.ofs[id]) { vm.ofs[id] = { nowork: false, text: '', cancelAsk: false, busy: null, taking: null, err: null }; }
        return vm.ofs[id];
    }

    function decorateOffer(it, colours) {
        var o = it.offer = it.offer || {};
        o.times = angular.isArray(o.times) ? o.times : [];
        colours = colours || {};
        var st = o.state === 'withdrawn' ? 'closed' : (o.state || 'closed');     // the student sees withdrawn as closed
        var ins = it.instructor && it.instructor.name ? it.instructor : null;
        var by = o.offered_by && o.offered_by.name ? o.offered_by : null;
        var insF = ins ? D.firstName(ins.name) : '', byF = by ? D.firstName(by.name) : '';
        var who = by || ins;
        var asked = D.fDay(it.start) + ' at ' + D.fTime(it.start);
        var until = o.open_until || o.expires_at || '';
        it._st = st;
        it._by = byF || insF || 'The club';                      // who suggested the times
        it._to = insF || byF || 'the club';                      // who an answer goes to
        it._insAv = ins ? { code: D.initials(ins.name), colour: colours[ins.id] || '' } : null;
        it._av = who ? { code: D.initials(who.name), name: who.name, colour: colours[who.id] || '' } : null;
        it._date = D.fDay(it.start);
        it._askedShort = D.fDay(it.start) + ' ' + D.fTime(it.start);
        // "Dana can't do Sun 15 Nov at 08:00 and has suggested other times." (an admin may send them on the instructor's behalf)
        it._lead = ins && (!by || by.id === ins.id) ? insF + ' can\'t do ' + asked + ' and has suggested other times.'
            : ins ? insF + ' can\'t do ' + asked + ', so ' + byF + ' has suggested other times.'
            : 'The club can\'t do ' + asked + (by ? ', so ' + byF + ' has' : ' and has') + ' suggested other times.';
        it._agreed = 'Take one and it\'s booked: ' + (insF ? insF + ' has' : 'the club has') + ' already agreed.';
        it._sent = o.sent_at ? D.rel(o.sent_at, vm.today) : '';
        it._until = until ? D.fDay(until) + ' ' + D.fTime(until) : '';
        it._replied = o.replied_at ? D.rel(o.replied_at, vm.today) : '';
        it._times = o.times.slice().sort(function (a, b) { return (+a.index || 0) - (+b.index || 0); }).map(function (t) {
            var pl = t.plane || {};
            // a replied / ended offer has nothing to take (alex-3e: every time reads gone until new times are sent)
            var gone = st !== 'open' ? t.state !== 'taken' : (!!t.gone || t.state === 'gone');
            var closes = t.closes_at ? String(t.closes_at) : '';
            var soon = !gone && closes && until && closes < String(until);
            var why = '';
            if (t.same_aircraft) { why = 'The aircraft you asked for'; }
            else if (it.aircraft) { why = 'Different aircraft' + (pl.type ? (it.aircraft.type && pl.type === it.aircraft.type ? ' · also a ' : ' · a ') + pl.type : ''); }
            return {
                index: +t.index || 0, plane: pl, same: !!t.same_aircraft, why: why, gone: gone, taken: t.state === 'taken',
                when: D.fDay(t.start) + ' · ' + D.fTime(t.start) + '–' + D.fTime(t.end),
                len: D.len(t.minutes || D.minutesBetween(t.start, t.end)),
                sameDay: String(t.start).slice(0, 10) === String(it.date || it.start || '').slice(0, 10),
                soon: soon ? D.rel(closes, vm.today) : '',
                goneWhy: closes && closes <= vm.nowStr ? 'Gone: it could be taken until ' + D.rel(closes, vm.today) : 'Gone: someone else booked that time'
            };
        });
        it._liveN = it._times.filter(function (t) { return !t.gone; }).length;
        it._soonAny = it._times.some(function (t) { return !!t.soon; });
        it._taken = it._times.filter(function (t) { return t.taken; })[0] || null;
        it._end = endLine(it);
        it._search = [it.aircraft && it.aircraft.reg, ins && ins.name, by && by.name, it.lesson && it.lesson.title, it.course && it.course.title,
            it.club_name, it.notes, o.note, D.kindLabel(it.kind)].concat(o.times.map(function (t) { return t.plane && t.plane.reg; })).join(' ').toLowerCase();
        return it;
    }

    // an ended offer as one quiet line (it stays listed for 48 h)
    function endLine(it) {
        var o = it.offer, asked = it._askedShort;
        if (it._st === 'taken') {
            var t = it._taken;
            return { tone: 'good', icon: 'fa-check-circle', b: 'Booked', go: 'taken',
                txt: t ? 'you took ' + t.when + (t.plane.reg ? ' in ' + t.plane.reg : '') + ', instead of ' + asked : 'you took one of the times offered instead of ' + asked };
        }
        if (it._st !== 'closed') { return null; }
        if (o.closed_reason === 'cancelled') { return { tone: 'bad', icon: 'fa-times-circle', b: 'Cancelled', txt: 'your request for ' + asked + ' — nothing was booked, and ' + it._to + ' has been told.' }; }
        if (o.closed_reason === 'withdrawn') { return { tone: 'muted', icon: 'fa-times-circle', b: 'Closed', go: 'book', txt: 'your request for ' + asked + ' was closed and the times withdrawn — nothing was booked.' + saidWhy(it) }; }
        return { tone: 'muted', icon: 'fa-hourglass-end', b: 'Closed', go: 'book', txt: 'the times ' + it._by + ' suggested for ' + asked + ' ran out — nothing was booked.' };
    }

    // the instructor's reason for closing (DELETE …?reason= → offer.closed_note, C44), quoted when there is one
    function saidWhy(it) {
        var n = it.offer && it.offer.closed_note ? String(it.offer.closed_note).trim() : '';
        return n ? ' ' + it._by + ' said: “' + n + '”' : '';
    }

    // ?offer={id} (the e-mail link): pick the offer out once — scroll to it and highlight it; an ended or unknown one gets a note
    function landOffer() {
        if (offerLanded || !vm.offerId) { return; }
        offerLanded = true;
        var it = null;
        vm.offers.forEach(function (o) { if (+o.offer_id === vm.offerId) { it = o; } });
        if (!it) {
            vm.offerNote = { tone: 'info', icon: 'fa-info-circle', title: 'We couldn\'t find those times.',
                text: 'Other times your instructor suggests stay here until two days after the request ends — this one has gone, or it was sent to another account. Your bookings are below.' };
            return;
        }
        if (it._st === 'taken') {
            vm.offerNote = { tone: 'good', icon: 'fa-check-circle', title: 'You\'ve already taken one of those times.',
                text: it._taken ? 'It\'s booked: ' + it._taken.when + (it._taken.plane.reg ? ' in ' + it._taken.plane.reg : '') + '.' : 'It\'s in your bookings.' };
        } else if (it._st === 'closed') {
            vm.offerNote = { tone: 'info', icon: 'fa-info-circle', title: 'Those times are no longer open.',
                text: it.offer.closed_reason === 'cancelled' ? 'You cancelled the request. Nothing was booked.'
                    : it.offer.closed_reason === 'withdrawn' ? 'The request was closed and the times withdrawn. Nothing was booked.' + saidWhy(it)
                    : 'Nobody took them before they ran out, so the request closed. Nothing was booked.' };
        }
        hiOffer(it.offer_id);
    }
    function hiOffer(id) {
        vm.offerHi = id;
        scrollToId('bkg-of-' + id);
        $timeout(function () { if (vm.offerHi === id) { vm.offerHi = null; } }, 2600);
    }

    // the item a write returned replaces the old one in place (the card moves: Needs you → Your requests)
    function replaceOffer(item) {
        if (!item || !item.offer_id) { return; }
        var colours = {};
        vm.rows.forEach(function (b) { if (b.instructor && b.instructor.id && b.instructor.colour) { colours[b.instructor.id] = b.instructor.colour; } });
        var done = false;
        vm.offers = vm.offers.map(function (o) { if (+o.offer_id === +item.offer_id) { done = true; return decorateOffer(item, colours); } return o; });
        if (!done) { vm.offers.push(decorateOffer(item, colours)); }
        rebuild();
    }

    // Take this time → booked at once (the instructor already agreed); the new confirmed booking appears with "Booked just now"
    function take(it, t) {
        var u = ui(it);
        if (u.busy || !it.can_take || !t || t.gone) { return; }
        u.busy = 'take'; u.taking = t.index; u.err = null;
        D.TakeOffer(it.offer_id, t.index).then(function (res) {
            u.busy = null; u.taking = null;
            if (res && res.success) {
                u.nowork = false; u.cancelAsk = false;
                vm.justBooked = parseInt(res.booking_id, 10) || null;
                if (res.offer) { replaceOffer(res.offer); }
                else { it.offer.state = 'taken'; it.offer.taken_booking_id = vm.justBooked; replaceOffer(it); }
                ToastService.success('Booked', t.when + (t.plane.reg ? ' in ' + t.plane.reg : '') + (it._insAv ? ' with ' + it._to : '') + '. You\'ve both been e-mailed a calendar invite.', { confetti: false });
                fetch(false).then(function () { if (vm.justBooked) { scrollToId('bkg-bk-' + vm.justBooked); } });
                return;
            }
            failed(it, 'take', res);
        });
    }

    // None of these work → ask for other times (with an optional note)
    function askAgain(it) {
        var u = ui(it);
        if (u.busy || !it.can_reply) { return; }
        u.busy = 'reply'; u.err = null;
        D.ReplyOffer(it.offer_id, String(u.text || '').trim()).then(function (res) {
            u.busy = null;
            if (res && res.success) {
                u.nowork = false; u.cancelAsk = false;
                if (res.offer) { replaceOffer(res.offer); } else { fetch(false); }
                ToastService.success('Sent', it._to + ' will suggest other times or let you know.', { confetti: false });
                return;
            }
            failed(it, 'reply', res);
        });
    }

    // …or cancel the request (open or replied): nothing is booked, the instructor is told
    function cancelOffer(it) {
        var u = ui(it);
        if (u.busy || !it.can_cancel) { return; }
        u.busy = 'cancel'; u.err = null;
        D.CancelOffer(it.offer_id).then(function (res) {
            u.busy = null;
            if (res && res.success) {
                u.nowork = false; u.cancelAsk = false;
                if (res.offer) { replaceOffer(res.offer); } else { fetch(false); }
                ToastService.success('Request cancelled', 'Nothing is booked, and ' + it._to + ' has been told.', { confetti: false });
                return;
            }
            failed(it, 'cancel', res);
        });
    }

    // a refused write, in words: shown in the card (ToastService.handledInline() keeps the write guard's "Not saved" quiet);
    // when the answer means the offer moved on, the list is read again — and if the card left "Needs you", a toast says it
    function failed(it, action, res) {
        var u = ui(it), code = res && res.error, nm = it._to;
        var cap = nm.charAt(0).toUpperCase() + nm.slice(1);
        var msg;
        if (code === 'TIME_GONE') {
            msg = { title: 'Someone else has just booked that time.', text: res.offer_state === 'closed'
                ? 'It was the last one left, so the request has closed — nothing was booked.'
                : 'Take one of the others, or tell ' + nm + ' none of them work.' };
        } else if (code === 'NOT_OPEN') {
            var s = res.state;
            msg = s === 'taken' ? { title: 'You\'ve already taken one of these times.', text: 'It\'s in your bookings below.' }
                : s === 'replied' ? { title: 'You\'ve already asked for other times.', text: cap + ' will suggest new ones or let you know.' }
                : s === 'closed' || s === 'withdrawn' ? { title: 'This request has closed.', text: 'Nothing was booked. You can book another time from the scheduler.' }
                : { title: 'These times are no longer open.', text: 'Nothing was booked.' };
        } else if (code === 'VOUCHER_IN_USE') {
            msg = { title: 'Your voucher is already on another booking.', text: 'The voucher on this request has been used since you asked, so this time can\'t be booked with it. Call the club, or ask ' + nm + ' for other times.' };
        } else if (code === 'FORBIDDEN') {
            msg = { title: 'Only the member who asked can answer these times.', text: 'They were offered to another account — log in as that member to answer them.' };
        } else if (code === 'NOT_FOUND') {
            msg = { title: 'These times aren\'t there any more.', text: 'The offer may have been withdrawn. Nothing was booked.' };
        } else if (code === 'BUSY') {
            msg = { title: action === 'take' ? 'Not booked yet.' : 'Not sent yet.', text: 'Someone else was answering at the same moment — please try again.' };
        } else if (code === 'SAVE_FAILED') {
            msg = { title: 'Not booked.', text: 'The booking couldn\'t be made and nothing was changed — please try again.' };
        } else if (code === 'VALIDATION_ERROR') {
            msg = { title: 'Not sent.', text: textOf(res.message) || 'Please check the note and try again.' };
        } else {
            var st = res && res.status;
            msg = { title: action === 'take' ? 'Not booked.' : action === 'reply' ? 'Not sent.' : 'Not cancelled.',
                text: !res || st === -1 || st === 0 ? 'The connection to ToAviate dropped — nothing has changed. Please try again.'
                    : st >= 500 ? 'ToAviate had a problem with that — nothing has changed. Please try again in a moment.'
                    : (textOf(res.message) || 'Nothing has changed. Please try again.') };
        }
        u.err = msg;
        ToastService.handledInline();
        if (code === 'TIME_GONE' || code === 'NOT_OPEN' || code === 'NOT_FOUND') {
            var id = it.offer_id;
            fetch(false).then(function () {
                var now = null;
                vm.offers.forEach(function (o) { if (+o.offer_id === +id) { now = o; } });
                if (!now || now._st !== 'open') { u.err = null; ToastService.warning(msg.title, msg.text); }
            });
        }
    }
    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return /^\s*</.test(m) ? '' : m; } return m.message || ''; }

    // "Show booking" on a taken offer: open the new booking in the list (loading more pages if it's further on)
    function showTaken(it) {
        var id = it && it.offer && it.offer.taken_booking_id;
        if (!id) { return; }
        var found = vm.rows.some(function (b) { return b.id === id && !b._cancelled; });
        if (found) { vm.loadTries = 0; vm.filter = 'all'; vm.openId = id; rebuild(); scrollToOpen(); return; }
        if (vm.pagination && vm.pagination.has_more && (vm.loadTries || 0) < 6) {
            vm.loadTries = (vm.loadTries || 0) + 1;
            more().then(function () { showTaken(it); });
            return;
        }
        vm.loadTries = 0;
        $state.go('dashboard.my_account.booking_audit_trail', { booking_id: id });
    }

    $scope.$on('$destroy', function () { if (qTimer) { $timeout.cancel(qTimer); } });
}


// ═══════════════════════════════════════════════════════════════════════
// Booking history — one booking's trail as a timeline, ids turned into names
// ═══════════════════════════════════════════════════════════════════════
app.controller('BookingHistoryV2Controller', BookingHistoryV2Controller);
BookingHistoryV2Controller.$inject = ['$rootScope', '$state', '$stateParams', '$q', 'BookingsV2Data', 'BookingAuditTrailService', 'SchedulerV2Service', 'CourseService', 'CancellationFeesService'];
function BookingHistoryV2Controller($rootScope, $state, $stateParams, $q, BookingsV2Data, BookingAuditTrailService, SchedulerV2Service, CourseService, CancellationFeesService) {
    var vm = this;
    var D = vm.D = BookingsV2Data;

    vm.user = $rootScope.globals.currentUser;
    vm.bookingId = parseInt($stateParams.booking_id, 10) || 0;
    vm.load = 'loading';           // loading | error | denied | ready
    vm.entries = [];
    vm.b = null;                   // the booking: a bookings/v2/upcoming row, else the scheduler detail, else the snapshot
    vm.order = 'new';
    vm.tech = null;
    vm.staffView = false;          // the trail came with emails / IPs → staff
    vm.today = moment().format('YYYY-MM-DD');

    // name maps: plane id → {reg, type, colour}; user id → {name, code, colour, instructor}; lesson id → title
    var planes = {}, people = {}, lessons = {};

    vm.retry = activate;
    vm.back = back;
    vm.backLabel = backLabel;
    vm.list = list;
    vm.setOrder = function (o) { vm.order = o; };
    vm.toggleTech = function (e) { vm.tech = vm.tech === e.id ? null : e.id; };
    vm.showInList = function () { $state.go('dashboard.v2.bookings', { open: vm.b && !vm.b._gone ? vm.b.id : null }); };
    vm.state = function () { return vm.b ? D.state(vm.b) : null; };

    activate();

    function activate() {
        vm.load = 'loading';
        if (!vm.bookingId) { vm.load = 'error'; return; }
        $q.all([
            readTrail(vm.bookingId),
            D.Upcoming({ per_page: 50 }),
            SchedulerV2Service.GetBooking(vm.bookingId)
        ]).then(function (res) {
            var trail = res[0], up = res[1], det = res[2];
            if (!trail || !trail.success) {
                var forbidden = trail && (trail.status === 403 || trail.error === 'FORBIDDEN' || (trail.message && trail.message.error === 'FORBIDDEN'));
                vm.load = forbidden ? 'denied' : 'error';
                return;
            }
            if (up && up.success) { vm.today = D.todayOf(up.now); }
            var entries = trail.entries || trail.audit_trail || [];
            vm.staffView = entries.some(function (e) { return !!(e.actor_email || e.ip_address); });
            var row = null;
            ((up && up.success && up.bookings) || []).forEach(function (b) { if (b.id === vm.bookingId) { row = b; } });
            vm.b = row || fromDetail(det && det.success ? det.booking : null) || fromSnapshot(entries);
            learn(vm.b, entries);
            return resolveNames(vm.b, entries).then(function () {
                vm.entries = entries.map(shape);
                vm.load = 'ready';
            });
        }, function () { vm.load = 'error'; });
    }

    // bookings/v2/history (C23: reasons, fee outcomes, old cancellations); booking_audit_trail while C23 isn't on the server
    function readTrail(id) {
        return D.History(id).then(function (h) {
            if (h && h.success) { return h; }
            if (h && (h.error === 'FORBIDDEN' || h.status === 403)) { return h; }
            return BookingAuditTrailService.GetBookingAuditTrail(id);
        });
    }

    // the scheduler's booking detail → the list shape the page reads
    function fromDetail(x) {
        if (!x) { return null; }
        return {
            id: x.id, club_id: x.club_id, club_name: '', start: x.start, end: x.end, date: String(x.start).slice(0, 10),
            minutes: D.minutesBetween(x.start, x.end), kind: x.kind, status: x.status, waiting_list: x.waiting_list > 0 ? 1 : 0,
            waiting_position: null, booked_out: !!x.booked_out, aircraft: x.aircraft || null, instructor: x.instructor || null,
            pilot: { id: x.pilot ? x.pilot.id : 0, name: x.pilot ? (x.pilot.full_name || x.pilot.name) : '' },
            lesson: x.lesson ? { id: 0, title: x.lesson } : null, course: x.course ? { id: x.course_id || 0, title: x.course } : null,
            role: x.pilot && x.pilot.id === vm.user.id ? 'pilot' : 'instructor', _complete: !!x.complete
        };
    }
    // a booking that is gone (cancelled) or not on the viewer's schedule: what the trail remembers
    function fromSnapshot(entries) {
        var snap = null;
        entries.forEach(function (e) { if (!snap) { snap = e.snapshot_after || e.snapshot_before; } });
        if (!snap) { return null; }
        var gone = entries.some(function (e) { return e.action === 'deleted'; });
        return {
            id: vm.bookingId, club_id: parseInt(snap.club_id, 10) || 0, start: snap.start, end: snap.end, date: String(snap.start || '').slice(0, 10),
            minutes: D.minutesBetween(snap.start, snap.end),
            kind: snap.maintenance_flight == 1 ? 'maint' : (parseInt(snap.instructor_id, 10) > 0 ? 'dual' : 'hire'), status: snap.requires_approval == 1 && snap.booking_approved != 1 ? 'pending' : 'confirmed',
            waiting_list: parseInt(snap.waiting_list, 10) > 0 ? 1 : 0, aircraft: snap.registration ? { id: parseInt(snap.plane_id, 10), reg: snap.registration } : null,
            instructor: null, pilot: { id: parseInt(snap.user_id, 10) || 0, name: [snap.user_first_name, snap.user_last_name].filter(Boolean).join(' ') },
            lesson: null, course: null, _plane_id: parseInt(snap.plane_id, 10) || 0, _instructor_id: parseInt(snap.instructor_id, 10) || 0,
            _lesson_id: parseInt(snap.lesson_id, 10) || 0, _course_id: parseInt(snap.course_id, 10) || 0, _cancelled: gone ? {} : null, _gone: gone
        };
    }

    // seed the name maps with what we already know
    function learn(b, entries) {
        if (b) {
            if (b.aircraft && b.aircraft.id) { planes[b.aircraft.id] = b.aircraft; }
            if (b.instructor && b.instructor.id) { people[b.instructor.id] = { name: b.instructor.name, code: b.instructor.code, colour: b.instructor.colour, instructor: true }; }
            if (b.pilot && b.pilot.id && b.pilot.name) { people[b.pilot.id] = people[b.pilot.id] || { name: b.pilot.name }; }
            if (b.lesson && b.lesson.id) { lessons[b.lesson.id] = b.lesson.title; }
        }
        entries.forEach(function (e) {
            var id = parseInt(e.actor_user_id, 10);
            if (id && !people[id] && (e.actor_first_name || e.actor_last_name)) { people[id] = { name: [e.actor_first_name, e.actor_last_name].filter(Boolean).join(' ') }; }
            [e.snapshot_before, e.snapshot_after].forEach(function (s) {
                if (!s) { return; }
                var pid = parseInt(s.plane_id, 10);
                if (pid && s.registration && !planes[pid]) { planes[pid] = { id: pid, reg: s.registration }; }
                var uid = parseInt(s.user_id, 10);
                if (uid && (s.user_first_name || s.user_last_name) && !people[uid]) { people[uid] = { name: [s.user_first_name, s.user_last_name].filter(Boolean).join(' ') }; }
                var iid = parseInt(s.instructor_id, 10);
                if (iid && (s.instructor_first_name || s.instructor_last_name) && !people[iid]) { people[iid] = { name: [s.instructor_first_name, s.instructor_last_name].filter(Boolean).join(' '), instructor: true }; }
            });
        });
    }

    // the rest from the scheduler day's resources (aircraft + instructors of the club) and the course's lessons
    function resolveNames(b, entries) {
        var needPlane = false, needPerson = false, courseIds = {};
        entries.forEach(function (e) {
            [e.snapshot_before, e.snapshot_after].forEach(function (s) {
                if (!s) { return; }
                var pid = parseInt(s.plane_id, 10); if (pid && (!planes[pid] || !planes[pid].colour)) { needPlane = true; }
                var iid = parseInt(s.instructor_id, 10); if (iid && !people[iid]) { needPerson = true; }
                var lid = parseInt(s.lesson_id, 10), cid = parseInt(s.course_id, 10);
                if (lid && !lessons[lid] && cid) { courseIds[cid] = true; }
            });
        });
        var calls = [];
        var date = (b && b.date) || '';
        if ((needPlane || needPerson) && date) {
            calls.push(SchedulerV2Service.GetDay({ date: date, days: 1, club_id: (b && b.club_id) || null, show_all_instructors: 1 }).then(function (d) {
                var r = (d && d.success && d.resources) || {};
                (r.aircraft || []).forEach(function (a) { if (!planes[a.id] || !planes[a.id].colour) { planes[a.id] = { id: a.id, reg: a.reg, type: a.type, model: a.model, colour: a.colour }; } });
                (r.instructors || []).forEach(function (i) {
                    var p = people[i.id] || {};
                    people[i.id] = { name: p.name || i.name, code: i.code, colour: i.colour, instructor: true };
                });
                if (b && !b.club_name && d && d.settings && d.settings.clubs) {
                    d.settings.clubs.forEach(function (c) { if (parseInt(c.id, 10) === parseInt(b.club_id, 10)) { b.club_name = c.title || c.name || ''; } });
                }
            }));
        }
        Object.keys(courseIds).slice(0, 3).forEach(function (cid) {
            calls.push(CourseService.GetLessonsByCourseId(cid).then(function (d) {
                var arr = angular.isArray(d) ? d : (d && (d.lessons || d.items || d.data)) || [];
                arr.forEach(function (l) { if (l && l.id) { lessons[l.id] = lessonTitle(l); } });
            }));
        });
        return $q.all(calls).then(function () {
            if (b && b._gone) {
                if (b._plane_id && planes[b._plane_id]) { b.aircraft = planes[b._plane_id]; }
                if (b._instructor_id && people[b._instructor_id]) { var p = people[b._instructor_id]; b.instructor = { id: b._instructor_id, name: p.name, code: p.code, colour: p.colour }; }
                if (b._lesson_id && lessons[b._lesson_id]) { b.lesson = { id: b._lesson_id, title: lessons[b._lesson_id] }; }
            }
        }, function () {});
    }
    function lessonTitle(l) {
        var n = l.organise || l.lesson_number || l.number;
        return (n ? 'Lesson ' + n + ': ' : '') + (l.title || l.name || '');
    }

    // ── one entry → what the timeline shows ──
    function shape(e) {
        var a = e.snapshot_before || {}, b = e.snapshot_after || {};
        var uid = parseInt(e.actor_user_id, 10) || 0;
        var you = uid === parseInt(vm.user.id, 10);
        var actor = people[uid] || { name: [e.actor_first_name, e.actor_last_name].filter(Boolean).join(' ') || 'Someone' };
        var role = '';
        if (!you) {
            if (vm.b && vm.b.pilot && vm.b.pilot.id === uid) { role = 'Pilot'; }
            else if (actor.instructor) { role = 'Instructor'; }
            else { role = 'Club staff'; }
        }
        var meta = actionMeta(e);
        var rows = [];
        if (e.action === 'created' && e.snapshot_after) {
            rows.push(row('When', null, timeTxt(b.start, b.end, true)));
            rows.push(row('Aircraft', null, null, planeChip(b.plane_id)));
            if (parseInt(b.instructor_id, 10) > 0) { rows.push(row('Instructor', null, null, null, personChip(b.instructor_id))); }
            if (parseInt(b.lesson_id, 10) > 0) { rows.push(row('Lesson', null, lessonTxt(b.lesson_id))); }
            if (b.description) { rows.push(row('Notes', null, '“' + b.description + '”')); }
            if (parseInt(b.waiting_list, 10) > 0) { rows.push(row('Waiting list', null, 'A waiting-list place')); }
            if (b.requires_approval == 1) { rows.push(row('Confirmation', null, 'Needs the instructor to confirm')); }
        }
        if ((e.action === 'updated' || e.action === 'extended') && e.snapshot_before && e.snapshot_after) {
            if (a.start !== b.start || a.end !== b.end) {
                var same = String(a.start).slice(0, 10) === String(b.start).slice(0, 10);
                rows.push(row('Time', timeTxt(a.start, a.end, !same), timeTxt(b.start, b.end, !same)));
            }
            if (String(a.plane_id) !== String(b.plane_id)) { rows.push(row('Aircraft', null, null, planeChip(b.plane_id), null, planeChip(a.plane_id))); }
            if (String(a.instructor_id || 0) !== String(b.instructor_id || 0)) { rows.push(row('Instructor', null, null, null, personChip(b.instructor_id), null, personChip(a.instructor_id))); }
            if (String(a.user_id) !== String(b.user_id)) { rows.push(row('Pilot', personName(a.user_id), personName(b.user_id))); }
            if (String(a.lesson_id || 0) !== String(b.lesson_id || 0)) { rows.push(row('Lesson', lessonTxt(a.lesson_id), lessonTxt(b.lesson_id))); }
            if (String(a.description || '') !== String(b.description || '')) { rows.push(row('Notes', a.description ? '“' + a.description + '”' : 'None', b.description ? '“' + b.description + '”' : 'None')); }
            if (String(a.solo || 0) !== String(b.solo || 0)) { rows.push(row('Potential solo', a.solo == 1 ? 'On' : 'Off', b.solo == 1 ? 'On' : 'Off')); }
            if (String(a.waiting_list || 0) !== String(b.waiting_list || 0)) { rows.push(row('Waiting list', a.waiting_list > 0 ? 'On the waiting list' : 'On the schedule', b.waiting_list > 0 ? 'On the waiting list' : 'On the schedule')); }
            if (String(a.course_id || 0) !== String(b.course_id || 0) && !(String(a.lesson_id || 0) !== String(b.lesson_id || 0))) { rows.push(row('Course', a.course_id > 0 ? 'A course' : 'None', b.course_id > 0 ? 'Another course' : 'None')); }
        }
        if (e.action === 'deleted' && e.snapshot_before) {
            rows.push(row('Was', null, timeTxt(a.start, a.end, true), planeChip(a.plane_id)));
        }
        // an update that changed only things the rows don't draw: name them instead of showing an empty entry
        var other = '';
        if ((e.action === 'updated' || e.action === 'extended') && !rows.length && e.snapshot_before && e.snapshot_after) {
            var names = { course_id: 'course', tuition_id: 'tuition type', requires_approval: 'confirmation', booking_approved: 'confirmation', booking_status: 'confirmation',
                voucher_id: 'voucher', free_seats: 'free seats', maintenance_flight: 'maintenance flag', club_id: 'club', solo: 'potential solo' };
            var seenN = [];
            Object.keys(names).forEach(function (k) { if (String(a[k] == null ? '' : a[k]) !== String(b[k] == null ? '' : b[k]) && seenN.indexOf(names[k]) < 0) { seenN.push(names[k]); } });
            other = seenN.length ? 'Changed the ' + seenN.join(', ') + '.' : 'Saved without a visible change.';
        }
        var reason = null;
        if (e.reason_label || e.note || e.reason) {
            // C23 splits the stored "Label — notes" (reason_label / note); older reads carry it in reason
            var parts = String(e.reason || '').split(' — ');
            var head = e.reason_label || (e.reason_label === undefined ? parts[0] : '');
            var note = e.note !== undefined && e.note !== null ? e.note : (parts.length > 1 ? parts.slice(1).join(' — ') : '');
            reason = { bad: e.action === 'deleted' || e.action === 'declined', head: /^Other/.test(head || '') ? 'Other' : (head || ''), note: note || '' };
        }
        var fee = e.action === 'deleted' ? D.feeText(e.fee, e.reason_key, CancellationFeesService.money, CancellationFeesService.feeName) : '';
        if (fee && !reason) { reason = { bad: true, head: '', note: '' }; }
        if (reason) { reason.fee = fee; reason.feeTone = e.fee ? e.fee.outcome : ''; }
        return {
            id: e.id, at: e.created_at, meta: meta, you: you, actor: actor, actorId: uid, role: role, rows: rows, reason: reason,
            when: D.fDay(e.created_at) + ', ' + D.fTime(e.created_at), rel: relDay(e.created_at),
            tech: (e.actor_email || e.ip_address || e.user_agent) ? { email: e.actor_email, ip: e.ip_address, ua: e.user_agent } : null,
            text: e.action === 'approved' ? 'The booking is confirmed and shows solid on the scheduler.' : e.action === 'briefed' ? 'The instructor marked the lesson as briefed.'
                : other ? other : e.synthetic ? 'From the club\'s cancellation record — this booking was cancelled before the history was kept.' : '',
            synthetic: !!e.synthetic, noActor: !uid && !(e.actor_first_name || e.actor_last_name)
        };
    }
    function actionMeta(e) {
        if (e.action === 'created') {
            return (e.snapshot_after && parseInt(e.snapshot_after.waiting_list, 10) > 0) ? { t: 'Added to the waiting list', ic: 'fa-hourglass-half', tone: 'brand' } : { t: 'Booked', ic: 'fa-plus', tone: 'brand' };
        }
        if (e.action === 'updated') {
            var a = e.snapshot_before || {}, b = e.snapshot_after || {};
            var moved = a.start !== b.start || a.end !== b.end || String(a.plane_id) !== String(b.plane_id);
            return moved ? { t: 'Moved', ic: 'fa-arrows-alt', tone: 'info' } : { t: 'Changed', ic: 'fa-pen', tone: 'info' };
        }
        return ({
            approved: { t: 'Confirmed', ic: 'fa-check', tone: 'good' }, declined: { t: 'Declined', ic: 'fa-ban', tone: 'bad' },
            deleted: { t: 'Cancelled', ic: 'fa-times', tone: 'bad' }, extended: { t: 'Extended', ic: 'fa-arrows-alt-h', tone: 'info' },
            briefed: { t: 'Briefed', ic: 'fa-clipboard-check', tone: 'good' }
        })[e.action] || { t: 'Changed', ic: 'fa-pen', tone: 'info' };
    }
    // { k, from, to, toAc, toWho, fromAc, fromWho } — chips for aircraft / people, text otherwise
    function row(k, from, to, toAc, toWho, fromAc, fromWho) {
        // "None" is drawn quiet (.bkg-chg__none), as the design does
        var r = { k: k, from: from, to: to, toAc: toAc || null, toWho: toWho || null, fromAc: fromAc || null, fromWho: fromWho || null, hasFrom: from != null || !!fromAc || !!fromWho };
        if (r.from === 'None') { r.from = null; r.fromNone = true; }
        if (r.to === 'None') { r.to = null; r.toNone = true; }
        return r;
    }
    function planeChip(id) {
        id = parseInt(id, 10) || 0;
        if (!id) { return { none: true }; }
        var p = planes[id];
        return p ? { reg: p.reg, type: p.type, colour: p.colour, model: p.model } : { reg: 'Aircraft #' + id };
    }
    function personChip(id) {
        id = parseInt(id, 10) || 0;
        if (!id) { return { none: true, name: 'No instructor' }; }
        var p = people[id];
        return p ? { name: p.name, code: p.code, colour: p.colour, instructor: !!p.instructor } : { name: 'Instructor #' + id, code: '', instructor: true };
    }
    function personName(id) { id = parseInt(id, 10) || 0; return id ? ((people[id] && people[id].name) || 'Member #' + id) : 'None'; }
    function lessonTxt(id) { id = parseInt(id, 10) || 0; return id ? (lessons[id] || 'Lesson #' + id) : 'None'; }
    function timeTxt(s, e, withDate) { return s ? (withDate ? D.fDay(s) + ' · ' : '') + D.fTime(s) + '–' + D.fTime(e) : '—'; }
    function relDay(at) {
        var d = D.daysBetween(vm.today, String(at).slice(0, 10));
        return d === 0 ? 'today' : d === -1 ? 'yesterday' : (d < 0 && d > -7) ? (-d) + ' days ago' : '';
    }

    // newest first by default (today's page), oldest first reads as a story
    function list() {
        var e = vm.entries.slice().sort(function (x, y) { return x.at < y.at ? -1 : x.at > y.at ? 1 : x.id - y.id; });
        return vm.order === 'old' ? e : e.reverse();
    }
    vm.created = function () { var c = null; vm.entries.forEach(function (e) { if (e.meta.t === 'Booked' || e.meta.t === 'Added to the waiting list') { if (!c || e.at < c.at) { c = e; } } }); return c; };
    vm.lastChange = function () { var c = vm.created(), l = null; vm.entries.forEach(function (e) { if (e !== c && (!l || e.at > l.at)) { l = e; } }); return l; };
    // the dashed "Next:" node — what the booking is waiting for
    vm.tail = function () {
        var b = vm.b;
        if (!b || b._cancelled || b._gone) { return null; }
        if (b.waiting_list > 0) { return { t: (b.waiting_position ? D.ord(b.waiting_position) + ' in line' : 'On the waiting list') + (b.aircraft ? ' for ' + b.aircraft.reg : ''), s: 'If the booking ahead is cancelled, yours can move onto the schedule automatically.' }; }
        if (b.status === 'pending') {
            if (b.can_approve) { return { t: 'Waiting for you to confirm', s: ((b.pilot && b.pilot.name) || 'The pilot') + ' gets an email when you confirm or decline.' }; }
            var n = b.instructor ? b.instructor.name : 'the club';
            return { t: 'Waiting for ' + n + ' to confirm', s: 'The slot is held. You\'ll get an email when ' + (b.instructor ? D.firstName(n) : 'the club') + ' confirms or declines.' };
        }
        return null;
    };
    vm.withWho = function () {
        var b = vm.b; if (!b) { return ''; }
        var what = b.lesson ? b.lesson.title : (b.kind ? D.kindLabel(b.kind) : 'Booking');
        if (b.role === 'instructor' && b.pilot && b.pilot.name) { return what + ' · ' + b.pilot.name + (b.instructor ? ' with ' + b.instructor.name : ''); }
        return what + (b.instructor ? ' with ' + b.instructor.name : '');
    };

    function back() {
        var p = $rootScope.previousState;
        if (p && p.name && p.name !== 'dashboard.v2.booking_history') { $state.go(p.name, p.params || {}); return; }
        $state.go('dashboard.my_account.upcoming_bookings');
    }
    function backLabel() {
        var p = $rootScope.previousState, n = p && p.name ? p.name : '';
        if (n.indexOf('dashboard.scheduler_v2') === 0 || n === 'dashboard.bookings') { return 'Scheduler'; }
        if (n === 'dashboard.v2.home' || n === 'dashboard.my_account') { return 'My Account'; }
        return 'My bookings';
    }
}
