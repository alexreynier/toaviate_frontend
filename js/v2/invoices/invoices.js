/* ═══════════════════════════════════════════════════════════════════════════
   v2 INVOICES & PAYMENTS — design: mockups/my-account/invoices-payments.html (approved 7 Nov 2026).
   Replaces, while the v2 switch is on (js/v2/core/design.js):
     dashboard.my_account.invoices  (views/my_account/all_invoices.html, AllInvoicesController)
     dashboard.my_account.payments  (views/my_account/all_payments.html, AllPaymentsController)
   Same server calls as v1: invoices/get_all_for_user, invoices/get_all_upcoming_for_user, payments/get_for_user,
   users/{id}/memberships (mandate per club), invoice_pdf/get_ad_hoc_invoice, and for paying the calls of the shared
   payment accordion (js/directives/datetime.js), drawn here as the mockup's record dialog: members/{id}/info/{club},
   cards/create_payment_intent_new_card (+ save_card_on_intent, Stripe Payment Element / confirmPayment),
   cards/create_saved_card_intent (+ 3-D Secure confirmCardPayment, cards/check_payment), cards/create_cardmachine_intent
   (+ check_payment polling, clear_machine, retry_payment_machine), then payments/process_payment.
   Page CSS: css/v2/invoices.css (.bil-*). Views: views/v2/invoices/.

   Hidden until the backend lands (mockups/v2-build/fe-money.md "Waiting on backend"):
     • the Account credit tab / statement (needs invoices/v2/statement) — the credit balance itself shows (members.balance)
     • Pay on a FAILED invoice, "Try the direct debit again", "Set up a new direct debit" from an invoice
     • credit applied at issue ("Paid from credit", part-paid invoices) and the bank's refusal reason
     • Pay on a Requesting (pending_submission) invoice — the server refuses cards there since 7 Nov (same as v1)
   ═══════════════════════════════════════════════════════════════════════════ */
// UX pass 2 (learning, 9 Nov): a server message fit to show — a short sentence from a 2xx / 4xx reply, never an HTML error
// page, an object or a 5xx / connection body (those showed raw in dialogs and toasts)
function bilWhy(data) {
    if (!data) { return ''; }
    if (typeof data.status === 'number' && (data.status <= 0 || data.status >= 500)) { return ''; }
    var m = data.message; if (m && typeof m === 'object') { m = m.message; }
    return (typeof m === 'string' && m && !/^\s*</.test(m) && m.length < 300) ? m : '';
}

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.invoices', {
            url: '/my_account/invoices',
            templateUrl: 'views/v2/invoices/invoices.html',
            controller: 'InvoicesV2Controller', controllerAs: 'vm',
            data: { tab: 'invoices' }
        })
        .state('dashboard.v2.payments', {
            url: '/my_account/payments',
            templateUrl: 'views/v2/invoices/invoices.html',
            controller: 'InvoicesV2Controller', controllerAs: 'vm',
            data: { tab: 'payments' }
        });
    DesignRoutesProvider
        .map('dashboard.my_account.invoices', 'dashboard.v2.invoices')
        .map('dashboard.my_account.payments', 'dashboard.v2.payments');
}]);

// Moves its element to <body> while it lives (dialogs: the fixed header and page stacking can't trap them).
app.directive('bilPortal', function () {
    return {
        restrict: 'A',
        link: function (scope, el) {
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
});

/* ═════ data: the four reads of the page, cached between the two tabs ═════ */
app.factory('InvoicesV2Data', InvoicesV2Data);
InvoicesV2Data.$inject = ['$http', '$location', '$q', 'UserService', 'MemberService'];
function InvoicesV2Data($http, $location, $q, UserService, MemberService) {
    var service = {};
    service.ui = { club: 'all', fInv: 'all', fPay: 'all', q: '' };   // kept while moving between the two tabs
    service.last = null;                                              // { userId, r } — shown at once on the other tab
    service.load = load;
    service.GetPdf = GetPdf;
    return service;

    function load(userId) {
        return $q.all({
            invoices: UserService.GetInvoices(userId),
            upcoming: UserService.GetUpcoming(userId),
            payments: UserService.GetPayments(userId),
            memberships: MemberService.GetUserMemberships(userId)
        }).then(function (r) {
            service.last = { userId: userId, r: r };
            return r;
        });
    }

    function GetPdf(invoiceId) {
        return $http.get('/api/v1/invoice_pdf/get_ad_hoc_invoice/' + invoiceId, { responseType: 'arraybuffer' })
            .then(function (res) {
                // UX pass 2: a refusal sent as JSON (or nothing) must not be saved as "<number>.pdf"
                var type = (res.headers && res.headers('Content-Type')) || '';
                if (!res.data || !res.data.byteLength || type.indexOf('application/json') > -1) { return { success: false }; }
                return { success: true, data: res.data, headers: res.headers };
            }, handleError2);
    }

    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}

/* ═════ the page (both tabs) ═════ */
app.controller('InvoicesV2Controller', InvoicesV2Controller);
InvoicesV2Controller.$inject = ['$rootScope', '$scope', '$state', '$timeout', '$document', '$log', 'InvoicesV2Data', 'MemberService', 'PaymentService', 'BookoutService', 'ToastService'];
function InvoicesV2Controller($rootScope, $scope, $state, $timeout, $document, $log, InvoicesV2Data, MemberService, PaymentService, BookoutService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.tab = ($state.current.data && $state.current.data.tab) || 'invoices';
    vm.ui = InvoicesV2Data.ui;
    vm.open = {};
    vm.anim = null;
    vm.loading = true;
    vm.error = false;
    vm.clubs = [];
    vm.invoices = [];
    vm.payments = [];
    vm.pay = null;

    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var SYM = { GBP: '£', EUR: '€', USD: '$' };

    /* ── words: one helper per domain, raw statuses never reach the screen ── */
    var INV_ST = {
        issued: { l: 'To pay', t: 'warn', ic: 'fa-exclamation-circle' }, created: { l: 'To pay', t: 'warn', ic: 'fa-exclamation-circle' },
        direct_debit: { l: 'Queued for direct debit', t: 'pend', ic: 'fa-university' },   // UX pass 2: not the NEXT collection (that's pending_submission)
        pending_submission: { l: 'Requesting', t: 'pend', ic: 'fa-university' },
        submitted: { l: 'Requested', t: 'info', ic: 'fa-university' },
        confirmed: { l: 'Paid', t: 'good', ic: 'fa-check' }, paid_out: { l: 'Paid', t: 'good', ic: 'fa-check' }, paid: { l: 'Paid', t: 'good', ic: 'fa-check' },
        settled: { l: 'Paid', t: 'good', ic: 'fa-check' },
        payment_pending: { l: 'Payment being confirmed', t: 'pend', ic: 'fa-hourglass-half' },
        dd_held: { l: 'Being checked by the club', t: 'warn', ic: 'fa-search' },
        failed: { l: 'Failed', t: 'bad', ic: 'fa-times-circle' }, customer_approval_denied: { l: 'Failed', t: 'bad', ic: 'fa-times-circle' },
        charged_back: { l: 'Charged back', t: 'bad', ic: 'fa-undo' },
        late_failure_settled: { l: 'Settled', t: 'muted', ic: 'fa-check' },
        free: { l: 'No charge', t: 'muted', ic: 'fa-gift' }, voided: { l: 'Voided', t: 'muted', ic: 'fa-ban' },
        cancelled: { l: 'Cancelled', t: 'muted', ic: 'fa-ban' }, refunded: { l: 'Refunded', t: 'muted', ic: 'fa-undo' },
        custom: { l: 'Being prepared', t: 'muted', ic: 'fa-pen' }
    };
    var PAY_ST = {
        pending_submission: { l: 'Requesting', t: 'pend', ic: 'fa-university', step: 0 }, toaviate_ready: { l: 'Requesting', t: 'pend', ic: 'fa-university', step: 0 },
        submitted: { l: 'Requested', t: 'info', ic: 'fa-university', step: 1 },
        confirmed: { l: 'Paid', t: 'good', ic: 'fa-check', step: 2 }, paid_out: { l: 'Paid', t: 'good', ic: 'fa-check', step: 2 }, paid: { l: 'Paid', t: 'good', ic: 'fa-check', step: 2 },
        settled: { l: 'Paid', t: 'good', ic: 'fa-check', step: 2 }, free: { l: 'No charge', t: 'muted', ic: 'fa-gift', step: 2 },
        failed: { l: 'Failed', t: 'bad', ic: 'fa-times-circle', step: -1 }, payment_failed: { l: 'Failed', t: 'bad', ic: 'fa-times-circle', step: -1 },
        customer_approval_denied: { l: 'Failed', t: 'bad', ic: 'fa-times-circle', step: -1 },
        charged_back: { l: 'Charged back', t: 'bad', ic: 'fa-undo', step: -1 },
        requires_action: { l: 'Waiting for your bank', t: 'pend', ic: 'fa-hourglass-half' }, awaiting_confirm: { l: 'Being confirmed', t: 'pend', ic: 'fa-hourglass-half' },
        refunded: { l: 'Refunded', t: 'muted', ic: 'fa-undo' }, voided: { l: 'Voided', t: 'muted', ic: 'fa-ban' }, cancelled: { l: 'Cancelled', t: 'muted', ic: 'fa-ban' },
        created: { l: 'Created', t: 'muted' }, issued: { l: 'Created', t: 'muted' }
    };
    var KINDS = {
        dual: { ic: 'fa-user-friends', label: 'Dual lesson' }, solo: { ic: 'fa-user', label: 'Supervised solo' }, hire: { ic: 'fa-key', label: 'Self-fly hire' },
        trial: { ic: 'fa-star', label: 'Trial lesson' }, membership: { ic: 'fa-id-card', label: 'Membership' }, fee: { ic: 'fa-receipt', label: 'Charge' },
        exam: { ic: 'fa-graduation-cap', label: 'Exam' }, credit: { ic: 'fa-hand-holding-usd', label: 'Credit' }, sub: { ic: 'fa-satellite-dish', label: 'Subscription' }
    };
    var PAID = ['paid', 'paid_out', 'confirmed', 'settled'];
    var DD_ST = ['direct_debit', 'pending_submission', 'submitted'];

    /* ── formatting ── */
    function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
    function r2(n) { return Math.round(n * 100) / 100; }
    function trim(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
    function pd(s) {
        if (!s) { return null; }
        var p = String(s).split(/[ T]/), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    }
    function fDate(s) { var d = pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; }
    function fDay(s) { var d = pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; }
    function fDayLong(s) { var d = pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; }
    function fTime(s) { var m = String(s || '').match(/[ T](\d{2}:\d{2})/); return m ? m[1] : ''; }
    function monthKey(s) { var d = pd(s); return d ? MONTH[d.getMonth()] + ' ' + d.getFullYear() : 'Undated'; }
    function money(n, cur) {
        var sym = SYM[cur || 'GBP'];
        var txt = Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (n < 0 ? '−' : '') + (sym != null ? sym + txt : txt + ' ' + (cur || ''));
    }
    // decimal hours → H:MM, rounded to the nearest minute (v1's convert_decimal_to_hours)
    function hm(h) { var m = Math.round(Math.abs(num(h)) * 60); return (num(h) < 0 ? '-' : '') + Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
    function cap(s) { s = trim(s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
    vm.money = money;
    vm.fDate = fDate;
    vm.fDay = fDay;

    // club names arrive in capitals with trailing spaces ("THE PILOT CENTRE "): show them as names
    function clubName(t) {
        t = trim(t);
        if (t && t === t.toUpperCase() && /[A-Z]/.test(t)) {
            t = t.toLowerCase().replace(/(^|[\s\-'(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\bToaviate\b/, 'ToAviate');
        }
        return t;
    }
    function brandIcon(b) {
        b = String(b || '').toLowerCase();
        return /visa/.test(b) ? 'fab fa-cc-visa' : /master/.test(b) ? 'fab fa-cc-mastercard' : /amex|american/.test(b) ? 'fab fa-cc-amex' : 'far fa-credit-card';
    }
    function brandName(b) {
        b = String(b || '').toLowerCase();
        return /visa/.test(b) ? 'Visa' : /master/.test(b) ? 'Mastercard' : /amex|american/.test(b) ? 'Amex' : b ? cap(b) : 'Card';
    }
    function cycleTxt(c) {
        return { daily: 'Collected daily', weekly: 'Collected weekly', fortnightly: 'Collected every two weeks', monthly: 'Collected monthly' }[c] || (c ? 'Collected ' + c : '');
    }

    /* ═════ building the view model from the four reads ═════ */
    var clubIndex = {};
    function clubOf(id, title, cur) {
        id = parseInt(id, 10) || 0;
        var c = clubIndex[id];
        if (!c) {
            c = clubIndex[id] = { id: id, title: clubName(title) || 'Club', cur: cur || 'GBP', cycle: '', collection: null, credit: null, packages: [],
                mandate: false, mandateState: null, memberRowId: null, member: false };
            vm.clubs.push(c);
        } else if (title && c.title === 'Club') { c.title = clubName(title); }
        return c;
    }

    function build(r) {
        clubIndex = {};
        vm.clubs = [];
        vm.error = !!(httpFailed(r.invoices) || httpFailed(r.payments) || httpFailed(r.upcoming));

        // clubs: the accounts first (one per club — a member with old rows used to see the club repeated)
        ((r.upcoming && r.upcoming.upcoming) || []).forEach(function (u) {
            var c = clubOf(u.id, u.title, u.account_currency || u.user_currency);
            if (c.member) { return; }
            c.member = true;
            c.cycle = cycleTxt(u.billing_cycle);
            c.collection = u.collection_date || null;
            c.credit = num(u.balance);   // members.balance: v1's "Account Balance" (null reads as 0.00)
            c.packages = (u.packages || []).map(packageVm);
        });
        ((r.memberships && r.memberships.memberships) || []).forEach(function (m) {
            var c = clubOf(m.club_id, m.club_name);
            if (m.has_direct_debit || m.account_bank) { c.mandate = true; c.mandateState = m.gcl_status || 'active'; c.bank = trim(m.account_bank); c.ending = m.account_ending; c.ddCancelled = false; }
            else if (!c.mandate && m.gcl_status) {
                c.mandateState = m.gcl_status;
                // the bank (or the club's GoCardless) ended the mandate: say so instead of "No direct debit"
                c.ddCancelled = ['cancelled', 'failed', 'expired', 'consumed', 'blocked', 'suspended_by_payer'].indexOf(m.gcl_status) > -1;
            }
            if (!c.memberRowId || (m.membership_id > 0 && m.current == 1)) { c.memberRowId = m.id; }
        });

        vm.invoices = ((r.invoices && r.invoices.invoices) || []).map(invoiceVm);
        vm.payments = ((r.payments && r.payments.payments) || []).map(paymentVm);
        vm.invoices.sort(function (a, b) { return a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : b.id - a.id; });
        vm.payments.sort(function (a, b) { return a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : b.id - a.id; });

        vm.clubs.forEach(function (c) { c.s = summary(c); });
        vm.many = vm.clubs.length > 1;
        if (vm.ui.club !== 'all' && !clubIndex[vm.ui.club]) { vm.ui.club = 'all'; }
        if (!vm.many) { vm.ui.club = 'all'; }
        refresh();
    }
    function httpFailed(x) { return !x || (x.success === false && x.status); }

    function packageVm(p) {
        var exp = null;
        if (num(p.validity) > 0 && pd(p.created_at)) { var d = pd(p.created_at); d.setDate(d.getDate() + num(p.validity)); exp = d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
        return {
            title: trim(p.title) || 'Package', dual: hm(p.remaining_hours_dual), solo: hm(p.remaining_hours_solo),
            bought: fDate(p.created_at), expires: exp,
            aircraft: (p.aircraft || []).map(function (a) { return { reg: a.registration, type: a.plane_type, colour: a.colour || null }; })
        };
    }

    function crewOf(fd) {
        var hc = fd.holder_capacity;
        if (hc === 'PUT') { return [{ k: 'Instructor', v: fd.pic_name }, { k: 'Student (PUT)', v: fd.put_name }]; }
        if (hc === 'PICUS') { return [{ k: 'PIC', v: fd.pic_name }, { k: 'Supervised by', v: fd.instructor_name }]; }
        if (num(fd.authorised_solo) > 0) { return [{ k: 'PIC', v: fd.pic_name }, { k: 'Supervised by', v: fd.instructor_name }]; }
        return [{ k: 'PIC', v: fd.pic_name }];
    }
    function legKind(fd) {
        if (fd.holder_capacity === 'PUT' || num(fd.dual_flight) === 1) { return 'dual'; }
        if (fd.holder_capacity === 'PICUS' || num(fd.authorised_solo) > 0) { return 'solo'; }
        return 'hire';
    }
    function itemVm(x) {
        var vat = num(x.vat_rate), pkg = num(x.member_package_id) > 0;
        return {
            t: trim(x.title), u: num(x.unit).toFixed(2), pkg: pkg,
            unitTxt: pkg ? '—' : money(r2(vat > 0 ? num(x.unit_price) * (1 + vat / 100) : num(x.unit_price))),
            vatTip: vat > 0 ? 'Includes VAT at ' + vat + '%' : 'No VAT charged on this item',
            totalTxt: pkg ? '—' : money(num(x.total)), vat: vat
        };
    }

    // what the leg was charged for, by the club's charge basis (the rules of <flight-charge-times> / the invoice PDF):
    // { h: 'H:MM', s: 'brakes 11:05–12:17' }
    function chargedOf(fd) {
        function t(x) { return x && x !== '00:00:00' && x !== '00:00' ? String(x).slice(0, 5) : null; }
        function mins(a, b) { if (!a || !b) { return null; } var A = a.split(':'), B = b.split(':'), m = (+B[0] * 60 + +B[1]) - (+A[0] * 60 + +A[1]); return m < 0 ? m + 1440 : m; }
        function hmm(m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
        var basis = fd.charge_basis || (fd.tpc_brakes_off ? 'airborne_plus_allowance' : ''), a, b, m;
        if (basis === 'airborne_plus_allowance') {
            m = mins(t(fd.tpc_brakes_off), t(fd.tpc_brakes_on)); a = t(fd.takeoff_rounded); b = t(fd.landing_rounded);
            var ab = mins(a, b);
            if (m !== null) { return { h: hmm(m), s: (a && b && ab !== null) ? 'airborne ' + a + '–' + b + ' + ' + (m - ab) + ' min taxi' : 'charged ' + t(fd.tpc_brakes_off) + '–' + t(fd.tpc_brakes_on) }; }
        } else if (basis === 'airborne_rounded') {
            a = t(fd.takeoff_rounded); b = t(fd.landing_rounded); m = mins(a, b);
            if (m !== null) { return { h: hmm(m), s: 'airborne ' + a + '–' + b }; }
        } else if (basis === 'brakes_exact') {
            a = t(fd.brakes_off); b = t(fd.brakes_on); m = mins(a, b);
            if (m !== null) { return { h: hmm(m), s: 'brakes ' + a + '–' + b }; }
        } else if (basis === 'flight_exact') {
            a = t(fd.takeoff_time); b = t(fd.landing_time); m = mins(a, b);
            if (m !== null) { return { h: hmm(m), s: 'takeoff ' + a + '–landing ' + b }; }
        } else if (basis === 'airborne_actual') {
            if (num(fd.airborne_time) > 0) { return { h: hm(fd.airborne_time), s: 'airborne, as recorded' }; }
            a = t(fd.takeoff_time); b = t(fd.landing_time); m = mins(a, b);
            if (m !== null) { return { h: hmm(m), s: 'airborne ' + a + '–' + b }; }
        } else if (basis === 'tacho' || basis === 'hobbs') {
            var ts = parseFloat(fd.tacho_start), te = parseFloat(fd.tacho_end);
            if (!isNaN(ts) && !isNaN(te) && te > ts) { return { h: hm(te - ts), s: basis + ' ' + ts.toFixed(2) + '–' + te.toFixed(2) }; }
        }
        a = t(fd.brakes_off_rounded); b = t(fd.brakes_on_rounded); m = mins(a, b);
        return m !== null ? { h: hmm(m), s: 'brakes ' + a + '–' + b } : null;
    }

    function invoiceVm(raw) {
        var c = clubOf(raw.club_id, raw.club_title, raw.currency);
        if (raw.club && raw.club.stripe_id) { c.cards = true; }
        var cur = raw.currency || c.cur, total = r2(num(raw.total)), status = raw.status;
        var keys = Object.keys(raw.flights || {}).sort(function (a, b) { return (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0); });
        var flights = keys.map(function (k) { return raw.flights[k]; });
        var isFlight = num(raw.plane_id) > 0 && !(num(raw.membership_id) > 0) && flights.some(function (f) { return f.flight_details && f.flight_details.flight_date; });
        var allItems = [], legs = null, vatRate = 0;
        flights.forEach(function (f) { (f.items || []).forEach(function (x) { if (!x.ui_hidden) { allItems.push(x); vatRate = Math.max(vatRate, num(x.vat_rate)); } }); });
        var kind, title;
        var first = allItems[0] ? trim(allItems[0].title) : '';
        if (isFlight) {
            legs = flights.map(function (f, n) {
                var fd = f.flight_details || {};
                return {
                    n: n + 1, from: trim(f.from || fd.from_airfield) || '—', to: trim(f.to || fd.to_airfield) || '—', date: fDayLong(fd.flight_date), fd: fd,
                    fromIcao: fd.from_icao || null, toIcao: fd.to_icao || null, charged: chargedOf(fd),
                    crew: crewOf(fd).filter(function (x) { return x.v; }),
                    items: (f.items || []).filter(function (x) { return !x.ui_hidden; }).map(itemVm), totalTxt: money(r2(num(f.total)), cur)
                };
            });
            kind = legKind(legs[0].fd);
            var stops = [legs[0].from];
            legs.forEach(function (l) { if (stops[stops.length - 1] !== l.to || stops.length === 1) { stops.push(l.to); } });
            var route = (legs.length === 1 && legs[0].from === legs[0].to) ? legs[0].from + ' local' : stops.join(' → ');
            title = KINDS[kind].label + ' · ' + route;
        } else if (num(raw.membership_id) > 0) {
            kind = 'membership'; title = cap(first.split(' - ')[0]) || 'Membership';
        } else if (total < 0) {
            kind = 'credit'; title = cap(first.split(' - ')[0]) || 'Credit';
        } else {
            var lower = first.toLowerCase(), byExam = allItems.some(function (x) { return num(x.exam_purchase_id) > 0; });
            kind = byExam || /exam/.test(lower) ? 'exam' : /subscription|tracker/.test(lower) ? 'sub' : num(raw.voucher_id) > 0 ? 'trial' : 'fee';
            title = cap(first.split(' - ')[0]) || 'Invoice';
        }
        var st = total < 0 ? { l: 'Credit note', t: 'good', ic: 'fa-plus-circle' } : (INV_ST[status] || { l: 'Other', t: 'muted', ic: 'fa-circle' });
        var payable = (status === 'issued' || status === 'created') && total > 0;
        var failed = status === 'failed' || status === 'charged_back' || status === 'customer_approval_denied';
        var subParts = [raw.invoice_number];
        if (legs) { subParts.push(legs.length > 1 ? legs.length + ' legs' : legs[0].charged ? legs[0].charged.h + ' charged' : 'flown ' + fDay(legs[0].fd.flight_date)); }
        else if (allItems.length > 1) { subParts.push(allItems.length + ' items'); }
        else if (first && first.split(' - ')[1]) { subParts.push(trim(first.split(' - ').slice(1).join(' - '))); }
        var i = {
            id: raw.id, num: raw.invoice_number, club: c, cur: cur, status: status, st: st, kind: kind, kindLabel: (KINDS[kind] || {}).label, kindIc: (KINDS[kind] || {}).ic,
            title: title, sub: subParts.filter(Boolean).join(' · '),
            reg: raw.plane_registration || null, type: raw.plane_type || '', acColour: raw.plane_colour || null, date: raw.created_at, dateTxt: fDate(raw.created_at), sort: String(raw.created_at || ''),   // plane_colour: asked of the backend (SchedulerV2::plane_colour)
            total: total, totalTxt: money(total, cur), payable: payable, failed: failed, isCredit: total < 0, voided: status === 'voided',
            attn: payable || failed, legs: legs, multi: !!(legs && legs.length > 1),
            items: legs ? null : allItems.map(itemVm), vatLine: vatRate > 0 ? 'Prices include VAT at ' + vatRate + '%' : 'No VAT charged',
            panelHd: num(raw.membership_id) > 0 ? 'Membership invoice' : total < 0 ? 'Credit' : 'Charges',
            month: monthKey(raw.created_at)
        };
        i.note = invoiceNote(i);
        i.hay = [i.num, i.title, i.reg || '', i.dateTxt, Math.abs(total).toFixed(2), i.st.l, c.title].join(' ').toLowerCase();
        return i;
    }
    function invoiceNote(i) {
        var c = i.club, when = c.collection ? ' on ' + fDay(c.collection) : '';
        switch (i.status) {
            case 'failed': case 'customer_approval_denied': return { t: 'bad', ic: 'fa-times-circle', b: 'Your bank refused this direct debit.', s: 'Contact ' + c.title + ' to settle it.' };
            case 'charged_back': return { t: 'bad', ic: 'fa-undo', b: 'This payment was charged back at your bank.', s: 'Contact ' + c.title + ' to settle it.' };
            case 'pending_submission': return { t: 'info', ic: 'fa-university', s: 'Being collected by direct debit' + when + ' — nothing to do.' };
            case 'submitted': return { t: 'info', ic: 'fa-university', s: 'Requested from your bank. ' + c.title + ' receives it in a few working days — nothing to do.' };
            case 'direct_debit': return { t: 'info', ic: 'fa-university', s: 'Queued for a later direct debit collection — nothing to do.' };
            case 'payment_pending': return { t: 'info', ic: 'fa-hourglass-half', s: 'We\'re confirming a payment for this invoice with the payment provider — don\'t pay it again. This is checked every hour.' };
            case 'dd_held': return { t: 'warn', ic: 'fa-search', s: 'Held back from the direct debit collection while ' + c.title + ' checks whether it has already been paid. Nothing to do.' };
            case 'voided': return { t: '', ic: 'fa-ban', s: 'This invoice was voided — there is nothing to pay.' };
        }
        if (i.isCredit) { return { t: 'good', ic: 'fa-plus-circle', s: 'A credit of ' + money(-i.total, i.cur) + ' from ' + c.title + ' in your favour.' }; }
        return null;
    }

    function methodOf(p) {
        var m = String(p.payment_method || '');
        switch (m) {
            case 'GoCardless': return { l: 'Direct debit', ic: 'fas fa-university', dd: true };
            case 'GoCardless + Credit': return { l: 'Direct debit + credit', ic: 'fas fa-university', dd: true };
            case 'Credit': return { l: 'Account credit', ic: 'fas fa-coins' };
            case 'transfer': return { l: 'Bank transfer', ic: 'fas fa-exchange-alt' };
            case 'Equilibrium': return { l: 'Not required', ic: 'fas fa-equals', detail: 'Credits and charges cancelled out' };
            case 'free': return { l: 'No charge', ic: 'fas fa-gift' };
            case 'skip': return { l: 'Not charged', ic: 'fas fa-forward' };
        }
        if (/stripe|card/i.test(m)) {
            var card = p.last4 ? brandName(p.brand) + ' •••• ' + p.last4 : '';
            if (p.method_used === 'card_present') { return { l: 'Card machine', ic: 'fas fa-cash-register', detail: card }; }
            return { l: card || 'Card', ic: brandIcon(p.brand), card: true };
        }
        return { l: m ? cap(m) : 'Payment', ic: 'fas fa-receipt' };
    }
    function stepsOf(st) {
        if (st.step === -1) { return [{ l: 'Requested', c: 'done', line: '' }, { l: st.l, c: 'bad', line: 'todo' }]; }
        return ['Requesting', 'Requested', 'Paid'].map(function (l, n) {
            return { l: l, c: (n < st.step || (n === 2 && st.step === 2)) ? 'done' : n === st.step ? 'now' : '', line: n ? (n <= st.step ? 'done' : 'todo') : '' };
        });
    }
    function paymentVm(raw) {
        var c = clubOf(raw.club_id, raw.club_title, raw.currency);
        var cur = raw.currency || c.cur, m = methodOf(raw), st = PAY_ST[raw.status] || { l: 'Other', t: 'muted', ic: 'fa-circle' };
        var p = {
            id: raw.id, club: c, cur: cur, amount: r2(num(raw.amount)), method: m, st: st, isDD: !!m.dd && st.step !== undefined,
            date: raw.created_at, dateTxt: fDate(raw.created_at), timeTxt: fTime(raw.created_at), sort: String(raw.created_at || ''),
            ref: raw.transaction_id || '', exp: (raw.exp_month && raw.exp_year) ? ('0' + raw.exp_month).slice(-2) + '/' + raw.exp_year : '',
            refunded: num(raw.amount_refunded) > 0 ? money(num(raw.amount_refunded), cur) : '', refundReason: trim(raw.refund_reason),
            month: monthKey(raw.created_at)
        };
        p.amountTxt = money(p.amount, cur);
        p.steps = p.isDD ? stepsOf(st) : null;
        p.explain = !m.dd ? '' : ({ 0: 'Requesting — the collection is being set up with your bank.', 1: 'Requested — sent to your bank; ' + c.title + ' receives it in a few working days.', 2: 'Paid — ' + c.title + ' has received this payment.' }[st.step]
            || (st.t === 'bad' ? 'Your bank refused this collection. Contact ' + c.title + ' to settle it.' : ''));
        p.hay = [String(p.id), m.l, p.amount.toFixed(2), p.dateTxt, st.l, c.title].join(' ').toLowerCase();
        return p;
    }

    function summary(c) {
        var L = vm.invoices.filter(function (i) { return i.club === c; });
        function sum(f) { return r2(L.filter(f).reduce(function (s, i) { return s + i.total; }, 0)); }
        var owed = L.filter(function (i) { return i.payable; });
        var credits = L.filter(function (i) { return i.isCredit && (i.status === 'issued' || i.status === 'created'); });
        return {
            toPay: r2(owed.reduce(function (s, i) { return s + i.total; }, 0)), owedCount: owed.length,
            creditNotes: r2(-credits.reduce(function (s, i) { return s + i.total; }, 0)),
            nextDD: sum(function (i) { return i.status === 'pending_submission'; }),
            queued: sum(function (i) { return i.status === 'direct_debit'; }),
            collecting: sum(function (i) { return i.status === 'submitted'; }),
            failed: sum(function (i) { return i.failed && i.total > 0; }),
            failedCount: L.filter(function (i) { return i.failed && i.total > 0; }).length,
            pending: L.filter(function (i) { return i.status === 'payment_pending'; }).length
        };
    }

    /* ═════ filters, search, groups ═════ */
    function inClub(x) { return vm.ui.club === 'all' || x.club.id === vm.ui.club; }
    function invMatches(i, f, q) {
        if (!inClub(i)) { return false; }
        if (f === 'todo' && !i.attn) { return false; }
        if (f === 'dd' && DD_ST.indexOf(i.status) < 0) { return false; }
        if (f === 'paid' && (PAID.indexOf(i.status) < 0 || i.isCredit)) { return false; }
        if (f === 'credit' && !i.isCredit) { return false; }
        if (q && i.hay.indexOf(q) < 0) { return false; }
        return true;
    }
    function payMatches(p, f, q) {
        if (!inClub(p)) { return false; }
        if (f === 'progress' && !(p.st.step === 0 || p.st.step === 1 || p.st.t === 'pend')) { return false; }
        if (f === 'paid' && p.st.step !== 2) { return false; }
        if (f === 'failed' && p.st.t !== 'bad') { return false; }
        if (q && p.hay.indexOf(q) < 0) { return false; }
        return true;
    }
    function groupByMonth(rows, amountOf, curOf) {
        var groups = [], cur = null;
        rows.forEach(function (x) {
            if (!cur || cur.label !== x.month) { cur = { key: 'm:' + x.month, label: x.month, rows: [], total: 0 }; groups.push(cur); }
            cur.rows.push(x); cur.total = r2(cur.total + amountOf(x));
        });
        groups.forEach(function (g) { g.totalTxt = money(g.total, curOf(g)); });
        return groups;
    }
    function flatten(groups, kind) {
        var out = [];
        groups.forEach(function (g) {
            out.push({ key: 'g:' + g.key, g: g });
            g.rows.forEach(function (x) { out.push({ key: kind + ':' + x.id, x: x }); });
        });
        return out;
    }
    function scopeCur() { var c = vm.ui.club !== 'all' ? clubIndex[vm.ui.club] : vm.clubs[0]; return c ? c.cur : 'GBP'; }

    function refresh() {
        var q = trim(vm.ui.q).toLowerCase();
        vm.visibleClubs = vm.clubs.filter(function (c) { return vm.ui.club === 'all' || c.id === vm.ui.club; });
        vm.allView = vm.many && vm.ui.club === 'all';
        vm.owedClubs = vm.clubs.filter(function (c) { return c.s && c.s.toPay > 0; }).length;
        // invoices
        var all = vm.invoices.filter(inClub);
        var ic = function (f) { return all.filter(function (i) { return invMatches(i, f, ''); }).length; };
        vm.invChips = [['all', 'All'], ['todo', 'Needs attention'], ['dd', 'Direct debit'], ['paid', 'Paid'], ['credit', 'Credit notes']]
            .map(function (x) { return { f: x[0], l: x[1], n: ic(x[0]), attn: x[0] === 'todo' }; })
            .filter(function (x) { return x.f === 'all' || x.n > 0 || vm.ui.fInv === x.f; });
        var rows = vm.invoices.filter(function (i) { return invMatches(i, vm.ui.fInv, q); });
        var attn = rows.filter(function (i) { return i.attn; }), rest = rows.filter(function (i) { return !i.attn; });
        vm.invGroups = [];
        if (attn.length) {
            vm.invGroups.push({ key: 'attn', attn: true, label: 'Needs your attention', rows: attn, payAll: payAllBundles(),
                totalTxt: money(r2(attn.reduce(function (s, i) { return s + (i.total > 0 ? i.total : 0); }, 0)), scopeCur()) });
        }
        vm.invGroups = vm.invGroups.concat(groupByMonth(rest, function (i) { return i.total; }, function (g) { return g.rows[0].cur; }));
        vm.invFlat = flatten(vm.invGroups, 'inv');
        vm.invAll = all.length; vm.invShown = rows.length;
        vm.invTotal = vm.invoices.filter(inClub).length;
        // payments
        var pall = vm.payments.filter(inClub);
        var pc = function (f) { return pall.filter(function (p) { return payMatches(p, f, ''); }).length; };
        vm.payChips = [['all', 'All'], ['progress', 'In progress'], ['paid', 'Paid'], ['failed', 'Failed']]
            .map(function (x) { return { f: x[0], l: x[1], n: pc(x[0]) }; })
            .filter(function (x) { return x.f === 'all' || x.n > 0 || vm.ui.fPay === x.f; });
        var prow = vm.payments.filter(function (p) { return payMatches(p, vm.ui.fPay, q); });
        vm.payGroups = groupByMonth(prow, function (p) { return p.amount; }, function (g) { return g.rows[0].cur; });
        vm.payFlat = flatten(vm.payGroups, 'pay');
        vm.payAll = pall.length; vm.payShown = prow.length;
    }
    vm.refresh = refresh;

    vm.goTab = function (t) { if (t !== vm.tab) { $state.go(t === 'payments' ? 'dashboard.v2.payments' : 'dashboard.v2.invoices'); } };
    vm.setClub = function (id) { vm.ui.club = id; vm.open = {}; refresh(); };
    vm.setInv = function (f) { vm.ui.fInv = f; refresh(); };
    vm.setPay = function (f) { vm.ui.fPay = f; refresh(); };
    vm.clearAll = function () { vm.ui.fInv = 'all'; vm.ui.fPay = 'all'; vm.ui.q = ''; refresh(); };
    vm.showTodo = function (c) {
        if (vm.many) { vm.ui.club = c.id; }
        vm.ui.fInv = 'todo';
        if (vm.tab !== 'invoices') { $state.go('dashboard.my_account.invoices'); return; }
        refresh();
    };
    // the Pay / PDF controls inside a row's button are spans (the mockup's markup): Enter / Space work on them too
    vm.spanKey = function (e, what, i) {
        var k = e.which || e.keyCode;
        if (k !== 13 && k !== 32) { return; }
        e.preventDefault(); e.stopPropagation();
        if (what === 'pay') { vm.openPay(i, e); } else { vm.pdf(i, e); }
    };
    vm.cardLoading = function () { return !!(stripePay && stripePay.loading); };
    vm.toggle = function (key) {
        vm.open[key] = !vm.open[key];
        vm.anim = vm.open[key] ? key : null;
    };
    vm.rowKey = function (e, key) {
        var k = e.which || e.keyCode;
        if (k === 13 || k === 32) { e.preventDefault(); vm.toggle(key); }
    };
    vm.setupDD = function (c) {
        if (c.memberRowId) { $state.go('dashboard.my_account.memberships.edit', { membership_id: c.memberRowId }); }
    };

    /* ═════ PDF ═════ */
    vm.pdf = function (i, $event) {
        if ($event) { $event.stopPropagation(); }
        if (vm.pdfBusy) { return; }
        vm.pdfBusy = i.id;
        InvoicesV2Data.GetPdf(i.id).then(function (res) {
            vm.pdfBusy = null;
            if (!res.success) { ToastService.error('Download failed', 'The PDF of invoice ' + i.num + ' could not be made just now. Try again in a moment.'); return; }
            saveBlob(res.data, res.headers, i.num + '.pdf');
        });
    };
    function saveBlob(data, headers, fallback) {
        try {
            var h = headers ? headers() : {};
            var blob = new Blob([data], { type: h['content-type'] || 'application/pdf' });
            var url = window.URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = h['x-filename'] || fallback; a.style.display = 'none';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            $timeout(function () { window.URL.revokeObjectURL(url); }, 1000);
        } catch (ex) {
            $log.info('Invoice download failed', ex);
            ToastService.error('Download failed', 'Your browser could not save the PDF.');
        }
    }

    /* ═════ pay: the mockup's record dialog (bottom sheet on phones). The calls are the shared payment accordion's
       (js/directives/datetime.js), so the server sees exactly what v1 sends; Stripe steps keep their own busy flag. ═════ */
    var stripePay = null;   // { stripe, elements, element, intentId } for the "New card" option

    /* ── "Pay all" (11 Nov 2026): a club's unpaid invoices in ONE payment — backend `invoice_ids`
          (BACKEND_PAY_TOGETHER_GUIDE.md). Per club only: each club is paid on its own account. A bundle stands in for
          the invoice in the pay dialog (same fields: club, total, num…) with `bundle: true` and its invoices. ── */
    var PAY_ALL_MAX = 30;   // Invoices::PAY_TOGETHER_MAX
    function payAllBundle(c) {
        // every payable invoice of the club (not only the rows a search or a chip leaves in view), oldest first
        var invs = vm.invoices.filter(function (i) { return i.club === c && i.payable; })
            .sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0; });
        if (invs.length < 2) { return null; }
        var more = invs.length > PAY_ALL_MAX ? invs.length - PAY_ALL_MAX : 0;
        if (more) { invs = invs.slice(0, PAY_ALL_MAX); }
        var total = r2(invs.reduce(function (s, i) { return s + i.total; }, 0));
        return { bundle: true, payable: true, club: c, invs: invs, ids: invs.map(function (i) { return i.id; }), n: invs.length, more: more,
            total: total, totalTxt: money(total, c.cur), num: invs.length + ' invoices', title: invs.length + ' invoices', kindIc: 'fa-layer-group' };
    }
    // the clubs in view with two or more invoices to pay: [{ club, n, totalTxt, label }]
    function payAllBundles() {
        var clubs = vm.clubs.filter(function (c) { return vm.ui.club === 'all' || c.id === vm.ui.club; });
        var out = clubs.map(payAllBundle).filter(Boolean);
        out.forEach(function (b) { b.label = 'Pay all ' + b.n + (out.length > 1 ? ' · ' + b.club.title : '') + ' · ' + b.totalTxt; });
        return out;
    }
    vm.payAllFor = function (c) { return payAllBundle(c); };
    vm.openPayAll = function (c, $event) {
        if ($event) { $event.stopPropagation(); }
        var b = payAllBundle(c);
        if (b) { vm.openPay(b); }
    };

    vm.openPay = function (i, $event) {
        if ($event) { $event.stopPropagation(); }
        if (!i.payable) { return; }
        var c = i.club;
        teardownCard();
        vm.pay = { inv: i, stage: 'loading', edge: 'var(--ta-warn)', method: null, opts: [], saveCard: false, err: '' };
        MemberService.GetMandate(vm.user.id, c.id).then(function (data) {
            var P = vm.pay;
            if (!P || P.inv !== i) { return; }
            if (!data || !data.success) {
                P.stage = 'error';
                P.err = bilWhy(data) || 'Your payment options could not be loaded. Try again in a moment.';
                return;
            }
            var info = data.info || {}, cards = data.cards || [], machine = data.machine || {};
            var hasDD = !!info.account_bank;
            // card machine: the server's answer for the caller first (C10 `machine.can_use`: staff of the club, or
            // `members_allowed` and a live member); before C10, work it out here — staff of the club always, members too
            // unless the club keeps it for staff (`machine.members_allowed === false`; absent = members may use it)
            var acc = (vm.user && vm.user.access) || {}, cid = Number(c.id);
            var staffHere = [].concat(acc.instructor || [], acc.manager || [], acc.super_admin || []).map(Number).indexOf(cid) > -1;
            var mayUse = (typeof machine.can_use === 'boolean') ? machine.can_use : (staffHere || machine.members_allowed !== false);
            var machineMine = !!machine.success && mayUse;
            if (!machine.success && machine.id && mayUse) {
                ToastService.warning('Card machine offline', 'The club\'s card machine is not responding. Wake it up and open Pay again to use it.');
            }
            var opts = [];
            // direct debit first and selected whenever there is a mandate (it costs the club far less than a card)
            if (hasDD) { opts.push({ id: 'dd', ic: 'fas fa-university', t: 'Direct debit', s: 'Added to your collection' + (c.collection ? ' on ' + fDay(c.collection) : ''), tag: { t: 'good', l: 'Recommended' } }); }
            cards.forEach(function (k) {
                opts.push({ id: 'saved:' + k.stripe_id, card: k, ic: brandIcon(k.brand), t: brandName(k.brand) + ' •••• ' + k.last4,
                    s: 'Saved card' + (k.exp_month && k.exp_year ? ' · expires ' + ('0' + k.exp_month).slice(-2) + '/' + String(k.exp_year).slice(-2) : '') });
            });
            opts.push({ id: 'new', ic: 'fas fa-plus', t: 'New card', s: 'Debit or credit card' });
            // the card machine takes one invoice at a time (not offered for "Pay all")
            if (machineMine && !i.bundle) { opts.push({ id: 'machine', ic: 'fas fa-cash-register', t: 'Card machine', s: 'At the club desk — the reader shows the amount' }); }
            P.opts = opts;
            P.info = info;
            P.send = i.bundle ? { club_id: c.id, user_id: vm.user.id, invoice_ids: i.ids } : { club_id: c.id, user_id: vm.user.id, invoice_id: i.id };
            P.stage = 'choose';
            vm.pickPay(opts[0].id);
        });
        focusSoon('[data-e2e=bil-pay-dlg] .ta-dlg__x');
    };

    vm.pickPay = function (id) {
        var P = vm.pay;
        if (!P || P.stage !== 'choose') { return; }
        P.method = id; P.err = '';
        if (id === 'new') { startCard(P); }
        focusSoon('[data-e2e=bil-pay-dlg] .ta-opt--on');
    };
    vm.payPrimary = function () {
        var P = vm.pay;
        if (!P || !P.method) { return ''; }
        var amt = P.inv.totalTxt;
        return P.method === 'dd' ? (P.inv.bundle ? 'Add all ' + P.inv.n + ' to direct debit' : 'Add to direct debit') : P.method === 'machine' ? 'Send ' + amt + ' to the reader' : 'Pay ' + amt;
    };
    vm.payPrimaryIc = function () {
        var m = vm.pay && vm.pay.method;
        return m === 'dd' ? 'fas fa-university' : m === 'machine' ? 'fas fa-cash-register' : 'fas fa-lock';
    };
    vm.payBlocked = function () {
        var P = vm.pay;
        return !P || P.stage !== 'choose' || !P.method || (P.method === 'new' && (!stripePay || !stripePay.ready));
    };

    // "New card": a PaymentIntent for this invoice and Stripe's Payment Element (the club's own publishable key)
    function teardownCard() {
        if (stripePay && stripePay.element) { try { stripePay.element.destroy(); } catch (e) {} }
        stripePay = null;
    }
    function startCard(P) {
        if (stripePay && stripePay.inv === P.inv) { return; }
        teardownCard();
        var S = stripePay = { inv: P.inv, ready: false, loading: true };
        P.cardMsg = '';
        PaymentService.CreatePaymentIntentNewCard(P.send).then(function (data) {
            if (stripePay !== S) { return; }
            // refused before Stripe (BELOW_MINIMUM, RATE_UNAVAILABLE, INVOICE_NOT_PAYABLE…): say why
            if (!data || data.success === false || !data.client_secret) {
                S.loading = false;
                P.cardMsg = bilWhy(data) || 'The card payment could not be started — try again or choose another way to pay.';
                ToastService.warning('Card payment unavailable', P.cardMsg);   // (own toast: keeps the write guard's generic "Not saved" away)
                return;
            }
            S.intentId = data.payment_intent_id;
            PaymentService.GetClubStripeKey(P.inv.club.id).then(function (key) {
                if (stripePay !== S) { return; }
                S.stripe = Stripe(key);
                S.elements = S.stripe.elements({ clientSecret: data.client_secret, appearance: { theme: document.body.classList.contains('night-mode') ? 'night' : 'stripe', variables: { colorPrimary: '#2d5a8e', borderRadius: '8px' } } });
                S.element = S.elements.create('payment', { layout: 'tabs', wallets: { link: 'never' }, paymentMethodOrder: ['card', 'apple_pay', 'google_pay'] });
                S.element.on('ready', function () { $scope.$applyAsync(function () { S.ready = true; S.loading = false; }); });
                S.element.on('change', function (e) { S.dirty = !e.empty; });   // typed card details: closing asks first
                S.element.on('loaderror', function () { $scope.$applyAsync(function () { S.loading = false; P.cardMsg = 'The card form couldn\'t be loaded — close this and try again.'; }); });
                $timeout(function () { var el = document.getElementById('bil-card-el'); if (el && stripePay === S) { S.element.mount(el); } });
            }).catch(function (err) {
                $scope.$applyAsync(function () {
                    S.loading = false;
                    P.cardMsg = (err && err.code === 'stripe_js_unavailable')
                        ? 'We couldn\'t load the secure card form. Your network or a browser extension may be blocking js.stripe.com — allow it and try again.'
                        : 'Card payments aren\'t set up for this club yet. Contact the club or choose another way to pay.';
                });
            });
        });
    }

    vm.payGo = function () {
        var P = vm.pay;
        if (vm.payBlocked()) { return; }
        P.err = '';
        if (P.method === 'dd') { record(P, 'direct-debit', ''); return; }
        if (P.method === 'machine') { startMachine(P); return; }
        if (P.method === 'new') { payNewCard(P); return; }
        if (P.method.indexOf('saved:') === 0) { paySaved(P, P.method.slice(6)); }
    };

    function payNewCard(P) {
        var S = stripePay;
        P.stage = 'busy';
        var go = function () {
            S.stripe.confirmPayment({ elements: S.elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' }).then(function (res) {
                $scope.$applyAsync(function () {
                    if (vm.pay !== P) { return; }
                    if (res.error) {
                        P.stage = 'choose';
                        P.err = res.error.code === 'payment_intent_authentication_failure'
                            ? 'Your card issuer\'s check wasn\'t passed — try again or choose another way to pay.' : (res.error.message || 'Your card was not charged — try again.');
                        return;
                    }
                    if (res.paymentIntent && res.paymentIntent.status === 'succeeded') { record(P, 'new-card', res.paymentIntent); return; }
                    P.stage = 'choose'; P.err = 'There was an error processing your payment — nothing was recorded. Try again.';
                });
            });
        };
        // "Save this card": flag the intent before confirming; a failure here still lets the payment go ahead
        if (P.saveCard && S.intentId) {
            PaymentService.SetSaveCardOnIntent({ payment_intent_id: S.intentId, club_id: P.inv.club.id, user_id: vm.user.id }).then(go);
        } else { go(); }
    }

    function paySaved(P, cardId) {
        P.stage = 'busy';
        var send = angular.extend({}, P.send, { card_id: cardId });
        PaymentService.CreateSavedPaymentIntent(send).then(function (data) {
            if (vm.pay !== P) { return; }
            if (data && data.success) { record(P, 'saved-card', data.payment); return; }
            // refused (FORBIDDEN…) or any failure without a 3-D Secure step: say why
            if (!data || !data.client_secret) {
                P.stage = 'choose';
                P.err = bilWhy(data) || 'The payment could not be taken — nothing was charged. Try again or choose another way to pay.';
                ToastService.error('Payment not taken', P.err);
                return;
            }
            // the bank wants to check it's you (3-D Secure)
            PaymentService.GetClubStripeKey(P.inv.club.id).then(function (key) {
                Stripe(key).confirmCardPayment(data.client_secret, { payment_method: data.payment_method, return_url: data.card_url && data.card_url.return_url }).then(function (res) {
                    $scope.$applyAsync(function () {
                        if (vm.pay !== P) { return; }
                        if (res.error) {
                            P.stage = 'choose';
                            P.err = res.error.code === 'payment_intent_authentication_failure'
                                ? 'Your card issuer\'s check wasn\'t passed — try again or choose another way to pay.' : (res.error.message || 'Your card was not charged — try again.');
                            return;
                        }
                        if (res.paymentIntent && res.paymentIntent.status === 'succeeded') {
                            BookoutService.CheckPayment(data.paymentID).then(function (chk) {
                                if (chk && chk.success) { record(P, 'saved-card', res.paymentIntent); }
                                else { P.stage = 'choose'; P.err = 'The payment was approved but couldn\'t be confirmed — check Payments before trying again.'; }
                            });
                            return;
                        }
                        P.stage = 'choose'; P.err = 'The payment didn\'t complete — try again.';
                    });
                });
            }).catch(function (err) {
                $scope.$applyAsync(function () {
                    P.stage = 'choose';
                    P.err = (err && err.code === 'stripe_js_unavailable')
                        ? 'We couldn\'t load the secure card check. Your network or a browser extension may be blocking js.stripe.com.'
                        : 'Card payments aren\'t set up for this club yet. Contact the club or choose another way to pay.';
                });
            });
        });
    }

    // the card machine: send the amount to the reader, then poll until it's paid (30 tries, every 5 s)
    function startMachine(P) {
        P.stage = 'busy';
        PaymentService.CreateCardMachinePaymentIntent(P.send).then(function (data) {
            if (vm.pay !== P) { return; }
            if (!data || !data.success) {
                P.stage = 'choose';
                // CARD_MACHINE_STAFF_ONLY / BELOW_MINIMUM / the reader not answering carry their own sentence
                P.err = bilWhy(data) || 'We couldn\'t reach the card machine — try again.';
                ToastService.error('Card machine not started', P.err);
                return;
            }
            P.paymentId = data.paymentID;
            P.stage = 'machine'; P.machineMsg = '';
            poll(P);
        });
    }
    function poll(P) {
        var tries = 0, seen = {};
        P.polling = true;
        (function attempt() {
            if (vm.pay !== P || !P.polling) { return; }
            BookoutService.CheckPayment(P.paymentId).then(function (data) {
                if (vm.pay !== P || !P.polling) { return; }
                tries++;
                if (data && data.success && data.status) { P.polling = false; record(P, 'card-machine', data.paymentIntent); return; }
                var info = data && data.success ? data.add_info : null;
                if (info && info.charge && !seen[info.charge]) {
                    seen[info.charge] = true; P.polling = false;
                    P.machineMsg = 'The card machine reported a problem' + (info.message ? ': ' + info.message : '') + '. Try again, or cancel and choose another way to pay.';
                    return;
                }
                if (tries >= 30) { P.polling = false; P.machineMsg = 'The payment wasn\'t confirmed — try again, or cancel and choose another way to pay.'; return; }
                $timeout(attempt, 5000);
            });
        })();
    }
    vm.machineRetry = function () {
        var P = vm.pay; if (!P || P.stage !== 'machine') { return; }
        P.machineMsg = ''; P.retrying = true;
        BookoutService.RetryPaymentMachine(P.paymentId, P.inv.club.id).then(function (data) {
            P.retrying = false;
            if (data && data.success) { poll(P); return; }
            if (data && data.message === 'The payment has already been successfully made.') { record(P, 'card-machine', data.paymentIntent); return; }
            P.machineMsg = bilWhy(data) || 'The card machine didn\'t answer — try again.';
            if (ToastService.handledInline) { ToastService.handledInline(); }   // said in the dialog: no generic "Not saved" toast
        });
    };
    vm.machineCancel = function () {
        var P = vm.pay; if (!P || P.stage !== 'machine') { return; }
        P.polling = false; P.retrying = true;
        BookoutService.ClearMachine(P.paymentId, P.inv.club.id).then(function (data) {
            P.retrying = false;
            // UX pass 2: a refused / failed clear means the reader may still take the card — don't say it was cancelled
            if (!data || data.success === false) {
                var said = bilWhy(data).replace(/[.\s]+$/, '');
                P.machineMsg = 'The reader couldn\'t be cleared' + (said ? ': ' + said : '') + '. If it still shows the amount, cancel it on the card machine, or try again.';
                if (ToastService.handledInline) { ToastService.handledInline(); }   // said in the dialog: no generic "Not saved" toast
                return;
            }
            P.stage = 'choose'; P.err = 'The card machine payment was cancelled — nothing was taken.';
        });
    };

    // the payment is taken (or direct debit chosen): record it like v1 (payments/process_payment)
    function record(P, methodLabel, paymentIntent) {
        var i = P.inv;
        P.stage = 'busy';
        var body = { user_id: vm.user.id, club_id: i.club.id, paymentIntent: paymentIntent, method: methodLabel };
        if (i.bundle) { body.invoice_ids = i.ids; } else { body.invoice_id = i.id; }
        PaymentService.ProcessPayment(body)
            .then(function (data) {
                if (vm.pay !== P) { return; }
                if (data && data.success) {
                    teardownCard();
                    P.stage = 'done'; P.edge = 'var(--ta-good)'; P.done = methodLabel;
                    var when = i.club.collection ? ' on ' + fDay(i.club.collection) : '';
                    if (methodLabel === 'direct-debit') { P.doneTitle = 'Set up'; P.doneText = 'Added to your direct debit — requested' + when + '.'; }
                    else {
                        var k = (P.opts.filter(function (o) { return o.id === P.method; })[0] || {});
                        P.doneTitle = 'Paid';
                        P.doneText = (methodLabel === 'card-machine' ? 'Paid at the club\'s card machine.' : 'Paid with ' + (k.card ? k.t : 'your card') + '.') + ' The receipt is in Payments.';
                    }
                    ToastService.success(methodLabel === 'direct-debit' ? 'Added to your direct debit' : 'Payment received', (i.bundle ? i.n + ' invoices' : 'Invoice ' + i.num) + ' · ' + i.totalTxt);
                    reload(true);
                    focusSoon('[data-e2e=bil-pay-dlg] .ta-dlg__ft .ta-btn--primary');
                } else {
                    // refusals say why (payments/process_payment: FORBIDDEN / NOT_FOUND / INVOICE_NOT_PAYABLE)
                    var why = bilWhy(data) || '';
                    if (methodLabel === 'direct-debit') {
                        P.stage = 'choose';
                        P.err = why || 'The direct debit couldn\'t be set up for ' + (i.bundle ? 'these invoices' : 'this invoice') + ' — nothing was taken. Try again, or choose another way to pay.';
                        ToastService.error('Not added to your direct debit', P.err);
                    } else {
                        // the card / reader HAS been charged: never offer a second charge — say so, give the reference
                        P.stage = 'unrecorded'; P.edge = 'var(--ta-bad)'; P.err = why;
                        P.ref = (data && data.payment_intent_id) || (paymentIntent && (paymentIntent.id || paymentIntent.payment_intent)) || '';
                        // the server e-mails the club's managers for these refusals of a succeeded payment (once per pi_)
                        P.clubTold = !!(data && ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'CUSTOMER_MISMATCH', 'INVOICE_MISMATCH', 'INVOICE_NOT_FOUND'].indexOf(data.error) > -1);
                        ToastService.error('Payment not recorded', 'Your card was charged, but the invoice' + (i.bundle ? 's weren\'t' : ' wasn\'t') + ' updated. ' + (P.clubTold ? 'The club has been told — don\'t pay again.' : 'Don\'t pay again — contact ' + i.club.title + '.'));
                        reload(true);
                    }
                }
            });
    }

    vm.closePay = function (force) {
        var P = vm.pay;
        if (!P || P.stage === 'busy' || (P.stage === 'machine' && (P.polling || P.retrying))) { return; }   // 'unrecorded' closes normally
        // card details typed into Stripe's form: ask before throwing them away
        if (!force && P.stage === 'choose' && stripePay && stripePay.dirty) { P.confirmClose = true; return; }
        teardownCard();
        vm.pay = null;
    };

    function focusSoon(sel) { $timeout(function () { var el = document.querySelector(sel); if (el) { el.focus(); } }, 60); }
    function onKey(e) {
        if ((e.which || e.keyCode) === 27 && vm.pay) { $scope.$applyAsync(vm.closePay); }
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); teardownCard(); if (vm.pay) { vm.pay.polling = false; } });

    /* ═════ load ═════ */
    function reload(quiet) {
        if (!quiet) { vm.loading = !InvoicesV2Data.last; }
        return InvoicesV2Data.load(vm.user.id).then(function (r) {
            vm.loading = false;
            build(r);
        });
    }
    vm.retry = function () { vm.loading = true; vm.error = false; reload(); };

    if (InvoicesV2Data.last && InvoicesV2Data.last.userId === vm.user.id) {
        vm.loading = false;
        build(InvoicesV2Data.last.r);
        reload(true);
    } else {
        reload();
    }
}
