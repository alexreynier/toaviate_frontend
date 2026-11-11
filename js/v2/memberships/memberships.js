/* ═══════════════════════════════════════════════════════════════════════════
   v2 MEMBERSHIPS & PAYMENT METHODS — design: mockups/my-account/memberships-cards.html.
   Replaces, while the v2 switch is on (js/v2/core/design.js):
     dashboard.my_account.memberships (+ .add, .accept, .edit, .direct_debit, .update_direct_debit)
     dashboard.my_account.payment_methods (+ .add)
   Same server calls as v1 (ManageMyMembershipsController, ManageMyMembershipsDirectDebitController,
   UpdateMyMembershipDirectDebitController, ManagePaymentsController, ManagePaymentsAddController):
   users/{id}/memberships, memberships/requests_by_user|request_by_id|request|accept_request|club_available,
   DELETE memberships/request/{id}, members/{id}/for_user (GET/PUT), members/instructor_update, clubs/,
   cards/get_member_cards|update_default_card|delete_member_card|create_new_customer|confirm_setup,
   go_card/generate_update_link|create_mandate|update_mandate, term_documents/show_file.
   Stripe: per-club publishable key via PaymentService.GetClubStripeKey, SetupIntent + Payment Element (CLAUDE.md "Stripe").
   Page CSS: css/v2/memberships.css (.mem-*). Views: views/v2/memberships/.

   Hidden until the backend lands (mockups/v2-build/fe-money.md "Waiting on backend"):
     • joining / accepting BY CARD (needs an optional payment_method on memberships/request) — join and accept stay
       direct debit, as today
     • "card only" clubs (what each club takes is not on the payloads) — direct-debit actions show for every club, as v1
     • the price on a membership comes from the club's joinable tiers when it is one of them (price + currency are not on
       users/{id}/memberships yet); the airfield / address under a club name
   ═══════════════════════════════════════════════════════════════════════════ */
// UX pass 2 (learning, 9 Nov): a server message fit to show — a short sentence from a 2xx / 4xx reply, never an HTML error
// page, an object or a 5xx / connection body (those showed raw in dialogs and toasts)
function memWhy(data) {
    if (!data) { return ''; }
    if (typeof data.status === 'number' && (data.status <= 0 || data.status >= 500)) { return ''; }
    var m = data.message; if (m && typeof m === 'object') { m = m.message; }
    return (typeof m === 'string' && m && !/^\s*</.test(m) && m.length < 300) ? m : '';
}

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    function st(name, url, tpl, ctrl, data, extra) {
        $stateProvider.state(name, angular.extend({ url: url, templateUrl: 'views/v2/memberships/' + tpl, controller: ctrl, controllerAs: 'vm', data: data }, extra || {}));
    }
    st('dashboard.v2.memberships', '/my_account/memberships', 'memberships.html', 'MembershipsV2Controller', { page: 'list' });
    st('dashboard.v2.memberships_join', '/my_account/memberships/add?club_id', 'join.html', 'MembershipJoinV2Controller', { page: 'join' });
    st('dashboard.v2.memberships_accept', '/my_account/memberships/accept/:request_id', 'accept.html', 'MembershipAcceptV2Controller', { page: 'accept' });
    st('dashboard.v2.membership', '/my_account/memberships/edit/:membership_id', 'detail.html', 'MembershipDetailV2Controller', { page: 'detail' });
    st('dashboard.v2.memberships_dd', '/my_account/memberships/direct-debit', 'dd.html', 'MembershipDDV2Controller', { page: 'dd', mode: 'setup' });
    st('dashboard.v2.membership_dd_update', '/my_account/memberships/edit/:membership_id/update_direct_debit', 'dd.html', 'MembershipDDV2Controller', { page: 'dd', mode: 'update' });
    st('dashboard.v2.payment_methods', '/my_account/payment_methods?club_id&setup_intent&setup_intent_client_secret&redirect_status', 'cards.html', 'PaymentMethodsV2Controller', { page: 'cards' }, { reloadOnSearch: false });
    st('dashboard.v2.payment_methods_add', '/my_account/payment_methods/add?club_id', 'addcard.html', 'AddCardV2Controller', { page: 'addcard' });
    DesignRoutesProvider
        .map('dashboard.my_account.memberships', 'dashboard.v2.memberships')
        .map('dashboard.my_account.memberships.add', 'dashboard.v2.memberships_join')
        .map('dashboard.my_account.memberships.accept', 'dashboard.v2.memberships_accept')
        .map('dashboard.my_account.memberships.edit', 'dashboard.v2.membership')
        .map('dashboard.my_account.memberships.direct_debit', 'dashboard.v2.memberships_dd')
        .map('dashboard.my_account.memberships.update_direct_debit', 'dashboard.v2.membership_dd_update')
        .map('dashboard.my_account.payment_methods', 'dashboard.v2.payment_methods')
        .map('dashboard.my_account.payment_methods.add', 'dashboard.v2.payment_methods_add');
}]);

// GoCardless returns to the v1 URL with ?redirect_flow_id=…; the v1 → v2 move (design.js) keeps only the declared params,
// so the flow id is kept here, at boot, before the first state change. Read once by MembershipDDV2Controller.
app.run(['$location', function ($location) {
    try {
        var flow = $location.search().redirect_flow_id;
        if (flow) { sessionStorage.setItem('toaviate_v2_gcl_flow', JSON.stringify({ flow: String(flow), at: Date.now() })); }
    } catch (e) {}
}]);

// Moves its element to <body> while it lives (dialogs: the fixed header and page stacking can't trap them).
app.directive('memPortal', function () {
    return {
        restrict: 'A',
        link: function (scope, el) {
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
});

/* ═════ shared words, helpers and reads ═════ */
app.factory('MembershipsV2Data', MembershipsV2Data);
MembershipsV2Data.$inject = ['$http', '$location', '$q', '$timeout', '$cookies', 'MemberService', 'MembershipService', 'PaymentService', 'GoCardService', 'ToastService'];
function MembershipsV2Data($http, $location, $q, $timeout, $cookies, MemberService, MembershipService, PaymentService, GoCardService, ToastService) {
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var SYM = { GBP: '£', EUR: '€', USD: '$' };
    var TERMS = {
        monthly: { per: 'a month', every: 'Renews every month', ic: 'fa-redo', next: 'then every month' },
        annually: { per: 'a year', every: 'Renews every year', ic: 'fa-redo', next: 'then every year' },
        yearly: { per: 'a year', every: 'Renews every year', ic: 'fa-redo', next: 'then every year' },
        daily: { per: 'a day', every: 'Charged for each day', ic: 'fa-calendar-day', next: 'then for each day' },
        once: { per: 'once', every: 'Pay once — no renewal', ic: 'fa-infinity', next: 'nothing more after that' },
        free: { per: '', every: 'No fee', ic: 'fa-gift', next: '' }
    };
    var BRANDS = { visa: ['fab fa-cc-visa', 'Visa'], mastercard: ['fab fa-cc-mastercard', 'Mastercard'], amex: ['fab fa-cc-amex', 'Amex'], 'american express': ['fab fa-cc-amex', 'Amex'],
        discover: ['fab fa-cc-discover', 'Discover'], diners: ['fab fa-cc-diners-club', 'Diners Club'], 'diners club': ['fab fa-cc-diners-club', 'Diners Club'], jcb: ['fab fa-cc-jcb', 'JCB'] };

    var S = {};
    S.cardCache = {};          // club_id → { loading, error, cards, default_card }
    S.priceCache = {};         // club_id → promise of the club's joinable tiers

    /* ── formatting ── */
    S.trim = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
    S.num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
    S.pd = function (s) {
        if (!s) { return null; }
        var p = String(s).split(/[ T]/), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    };
    S.fDate = function (s) { var d = S.pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    S.fDay = function (s) { var d = S.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
    S.fDateTime = function (s) { var d = S.pd(s); return d ? S.fDate(s) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : ''; };
    S.money = function (n, cur) {
        var sym = SYM[cur || 'GBP'], txt = Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (n < 0 ? '−' : '') + (sym != null ? sym + txt : txt + ' ' + (cur || ''));
    };
    S.today = function () { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
    S.daysTo = function (s) { var d = S.pd(s); return d ? Math.round((d - S.today()) / 86400000) : null; };
    S.daysTxt = function (d) { return d === 0 ? 'Ends today' : d === 1 ? '1 day left' : d >= 730 ? Math.floor(d / 365) + ' years left' : d + ' days left'; };
    S.agoTxt = function (d) { d = -d; return d === 1 ? 'yesterday' : d + ' days ago'; };
    // the club monogram: the initials of its name (The Pilot Centre → TPC); one word → its capitals (ToAviate → TA)
    S.mono = function (title) {
        var w = S.trim(title).split(' ').filter(function (x) { return x && !/^(of|and|&)$/i.test(x); });
        if (w.length === 1) { var caps = w[0].replace(/[^A-Z]/g, ''); return (caps.length >= 2 ? caps.slice(0, 3) : w[0].slice(0, 2)).toUpperCase(); }
        return (w.slice(0, 3).map(function (x) { return x.charAt(0); }).join('') || '?').toUpperCase();
    };
    S.clubTitle = function (t) {   // club names arrive in capitals with trailing spaces: show them as names
        t = S.trim(t);
        if (t && t === t.toUpperCase() && /[A-Z]/.test(t)) {
            t = t.toLowerCase().replace(/(^|[\s\-'(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\bToaviate\b/, 'ToAviate');
        }
        return t;
    };

    /* ── words: terms, prices ── */
    S.TERMS = TERMS;
    S.term = function (t) { return TERMS[String(t || '').toLowerCase()] || null; };
    S.isFree = function (o) { var t = String(o.payment_term || '').toLowerCase(); return t === 'free' || (o.price !== undefined && o.price !== null && o.price !== '' && S.num(o.price) === 0); };
    S.priceKnown = function (o) { return o.price !== undefined && o.price !== null && o.price !== ''; };
    S.priceTxt = function (o) {
        if (S.isFree(o)) { return 'Free'; }
        var t = S.term(o.payment_term);
        if (!S.priceKnown(o)) { return t && !(o.membership_ends && S.daysTo(o.membership_ends) < 0) ? t.every : ''; }   // UX pass 2: an ended membership doesn't "Renew every month"
        return S.money(S.num(o.price), o.currency || 'GBP') + (t && t.per ? ' ' + t.per : '');
    };
    S.nextTxt = function (o) { var t = S.term(o.payment_term); return t ? t.next : ''; };

    /* ── cards ── */
    S.brand = function (b) { return BRANDS[String(b || '').toLowerCase()] || ['far fa-credit-card', b ? String(b).charAt(0).toUpperCase() + String(b).slice(1) : 'Card']; };
    S.cardName = function (c) { return S.brand(c.brand)[1] + ' •••• ' + c.last4; };
    S.cardExp = function (c) {
        var t = new Date(), m = parseInt(c.exp_month, 10), y = parseInt(c.exp_year, 10);
        if (y < 100) { y += 2000; }
        var left = (y - t.getFullYear()) * 12 + (m - (t.getMonth() + 1));
        return { label: ('0' + m).slice(-2) + '/' + y, expired: left < 0, soon: left >= 0 && left <= 2, thisMonth: left === 0 };
    };
    S.expTxt = function (c) { var x = S.cardExp(c); return x.expired ? 'has expired' : x.thisMonth ? 'expires at the end of this month' : 'expires ' + x.label; };
    S.cardPill = function (c) { var x = S.cardExp(c); return x.expired ? { t: 'bad', l: 'Expired', ic: 'fa-times-circle' } : x.soon ? { t: 'warn', l: x.thisMonth ? 'Expires this month' : 'Expiring soon', ic: 'fa-exclamation-circle' } : null; };
    S.defaultCard = function (cc) { return cc && cc.cards ? (cc.cards.filter(function (x) { return x.stripe_id === cc.default_card; })[0] || null) : null; };

    // GET-like read (a POST): one call per club, cached for the session of the page
    S.cardsFor = function (userId, clubId, fresh) {
        clubId = parseInt(clubId, 10);
        var cc = S.cardCache[clubId];
        if (cc && !fresh && !cc.error) { return cc; }
        cc = S.cardCache[clubId] = cc || { cards: [], default_card: null };
        cc.loading = true; cc.error = false;
        PaymentService.GetMemberCards({ user_id: userId, club_id: clubId }).then(function (data) {
            cc.loading = false;
            if (data && data.success) { cc.cards = data.cards || []; cc.default_card = data.default_card || null; }
            else { cc.error = true; }
        });
        return cc;
    };
    S.setCards = function (clubId, data) {
        var cc = S.cardCache[parseInt(clubId, 10)] || (S.cardCache[parseInt(clubId, 10)] = {});
        cc.loading = false; cc.error = false; cc.cards = data.cards || []; cc.default_card = data.default_card || null;
        return cc;
    };

    /* ── mandate + status (one helper each — no raw GoCardless states on screen) ── */
    S.hasDD = function (m) { return !!(m.has_direct_debit || m.account_bank || m.account_ending); };
    S.ddState = function (m) {
        if (!S.hasDD(m)) { return { t: 'muted', l: 'Not set up', ic: 'fa-minus-circle', ok: false }; }
        var g = m.gcl_status;
        if (!g || g === 'active') { return { t: 'good', l: 'Mandate active', ic: 'fa-check', ok: true }; }
        if (['pending_customer_approval', 'pending_submission', 'submitted'].indexOf(g) > -1) { return { t: 'pend', l: 'Being set up', ic: 'fa-hourglass-half', ok: true }; }
        return { t: 'bad', l: 'Mandate cancelled', ic: 'fa-times-circle', ok: false };
    };
    // how this membership is paid: members.default_payment_method ('gocardless' | 'stripe' | null)
    S.payOf = function (m, cc) {
        if (!(m.membership_id > 0)) { return { kind: 'none', ic: 'fas fa-user-friends', t: 'Nothing to pay', s: 'Passenger membership' }; }
        var dd = S.ddState(m), card = S.defaultCard(cc);
        if (m.default_payment_method === 'gocardless' || (!m.default_payment_method && S.hasDD(m))) {
            return { kind: 'dd', ic: 'fas fa-university', t: 'Direct debit', s: S.hasDD(m) ? (S.trim(m.account_bank) || 'Your bank') + ' · account ending ' + (m.account_ending || '—') : 'No direct debit set up yet', pill: dd, problem: !dd.ok };
        }
        if (m.default_payment_method === 'stripe') {
            if (!cc || cc.loading) { return { kind: 'card', ic: 'far fa-credit-card', t: 'Card', s: 'Loading your cards…' }; }
            if (cc.error) { return { kind: 'card', ic: 'far fa-credit-card', t: 'Card', s: 'Your saved cards couldn\'t be loaded just now' }; }
            if (!card) { return { kind: 'card', ic: 'far fa-credit-card', t: 'Card', s: 'No saved card with this club', pill: { t: 'warn', l: 'Add a card', ic: 'fa-exclamation-circle' }, problem: true }; }
            var x = S.cardExp(card);
            return { kind: 'card', ic: S.brand(card.brand)[0], t: 'Card · ' + S.cardName(card), s: 'Default card · expires ' + x.label, pill: S.cardPill(card), problem: x.expired || x.soon, card: card };
        }
        if (S.isFree(m)) { return { kind: 'free', ic: 'fas fa-gift', t: 'Nothing to pay', s: 'This membership is free' }; }
        var once = String(m.payment_term || '').toLowerCase() === 'once';
        return { kind: 'none', ic: 'fas fa-wallet', t: 'No payment method yet', s: 'Choose how the club charges you', pill: { t: 'muted', l: 'Not set up' }, problem: !once };
    };
    // membership status: Starts … · Active · Renewal due (ends, auto-renew off) · Card expiring / Card expired / Add a card / Direct debit to sort / Payment to sort (auto-renew, payment problem) · Ended
    S.memStatus = function (m, cc) {
        if (m.membership_start && S.daysTo(m.membership_start) > 0) { return { t: 'info', l: 'Starts ' + S.fDay(m.membership_start), ic: 'fa-hourglass-start', future: true }; }
        if (!m.membership_ends) { return { t: 'good', l: 'Active', ic: 'fa-check' }; }
        var d = S.daysTo(m.membership_ends);
        if (d < 0) { return { t: 'bad', l: 'Ended', ic: 'fa-calendar-times' }; }
        if (d <= 30 && m.auto_renew != 1) { return { t: 'warn', l: 'Renewal due', ic: 'fa-exclamation-circle', why: 'ends' }; }
        if (m.auto_renew == 1 && m.membership_id > 0) {
            // UX pass 2: name the problem — "Renewal due" on a membership renewing in 67 days read as if it were ending
            var p = S.payOf(m, cc);
            if (p.problem) {
                var l = p.kind === 'card' ? (p.card ? (S.cardExp(p.card).expired ? 'Card expired' : 'Card expiring') : 'Add a card')
                    : p.kind === 'dd' ? 'Direct debit to sort' : 'Payment to sort';
                return { t: 'warn', l: l, ic: 'fa-exclamation-circle', why: 'pay' };
            }
        }
        return { t: 'good', l: 'Active', ic: 'fa-check' };
    };
    // membership requests (requested_by club | user)
    S.reqStatus = function (r) {
        if (r.requested_by === 'club') { return { t: 'warn', l: 'Invitation', ic: 'fa-envelope-open-text' }; }
        if (r.last4) { return { t: 'pend', l: 'Request pending', ic: 'fa-hourglass-half' }; }
        if (!r.has_mandate) { return { t: 'warn', l: 'Direct debit not finished', ic: 'fa-exclamation-circle' }; }
        return { t: 'pend', l: 'Request pending', ic: 'fa-hourglass-half' };
    };

    // the club's joinable tiers (memberships/club_available) — also where a membership's price comes from today
    S.tiers = function (clubId) {
        clubId = parseInt(clubId, 10);
        if (!S.priceCache[clubId]) {
            S.priceCache[clubId] = MembershipService.GetAllByClubAvailable(clubId).then(function (data) {
                return angular.isArray(data) ? data : ((data && data.memberships) || []);
            });
        }
        return S.priceCache[clubId];
    };

    // the numbered "what happens next" lists
    S.ddSteps = function (mode, o, clubTitle) {
        var third = mode === 'join'
            ? [clubTitle + ' approves your request', 'Then ' + (S.isFree(o) ? 'your membership starts' : (S.priceKnown(o) ? S.money(S.num(o.price), o.currency) + ' is collected' : 'the first payment is collected') + (S.nextTxt(o) ? ', ' + S.nextTxt(o) : '')) + '. GoCardless emails you before every payment.']
            : mode === 'accept'
                ? ['Your membership starts', (o.membership_start ? 'From ' + S.fDate(o.membership_start) + '. ' : '') + (S.isFree(o) ? 'There is no fee.' : (S.priceKnown(o) ? S.money(S.num(o.price), o.currency) : 'The first payment') + ' is collected by direct debit' + (o.first_payment ? ' on ' + S.fDate(o.first_payment) : '') + (S.nextTxt(o) ? ', ' + S.nextTxt(o) : '') + '.')]
                : ['Used from the next payment', 'Nothing is collected now. Renewals and club charges come from this account.'];
        return [
            ['Your bank details, on GoCardless', 'A secure page run by GoCardless, ' + clubTitle + '\'s direct debit provider. ToAviate never sees your account number.'],
            ['Back here automatically', 'We confirm the direct debit with GoCardless — it takes a few seconds.'],
            third
        ];
    };

    /* ── GoCardless hand-off for an existing membership (set up / update bank details) — v1 change_direct_debit ── */
    S.goToGoCardless = function (userId, clubId, memberRowId) {
        return GoCardService.GenerateUpdateLink({ user_id: userId, club_id: clubId, membership_id: memberRowId }).then(function (data) {
            if (data && data.success && data.link) {
                $cookies.put('gcl_sess', data.session);
                // never needed for an update (the server reads it only for a club's own offer): don't leave it behind
                $cookies.remove('gcl_member_accepted');
                window.location = data.link;
                return true;
            }
            // FORBIDDEN (not your membership) / NO_DD_INTEGRATION / DD_SETUP_FAILED carry their own sentence
            var why = (data && typeof data.error === 'string') ? (memWhy(data) || null) : null;
            ToastService.error(data && data.error === 'NO_DD_INTEGRATION' ? 'Direct debit unavailable' : 'Direct debit not started',
                why || 'We couldn\'t open GoCardless just now. Try again in a few minutes, or contact the club.');
            return false;
        });
    };

    /* ── club documents (term_documents/show_file) — opened in a new tab; the tab is opened on the click so no blocker eats it ── */
    S.openDoc = function (file, label) {
        if (!file) {
            ToastService.warning('Not uploaded yet', 'The club hasn\'t uploaded its ' + (label || 'document').toLowerCase() + ' to ToAviate yet — ask them to add it.');
            return;
        }
        var w = null;
        try { w = window.open('', '_blank'); } catch (e) {}
        var name = String(file).replace(/^.*[\\\/]/, '');
        $http.get('/api/v1/term_documents/show_file/' + name, { responseType: 'arraybuffer' }).then(function (res) {
            var type = (res.headers && res.headers('Content-Type')) || '';
            if (!res.data || !res.data.byteLength || type.indexOf('application/json') > -1) {   // UX pass 2: a refusal is never opened as the PDF
                if (w) { try { w.close(); } catch (e) {} }
                ToastService.error('Document unavailable', 'This file can\'t be opened at the moment — contact the club.');
                return;
            }
            var url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            if (w) { w.location = url; } else { window.location = url; }
        }, function () {
            if (w) { try { w.close(); } catch (e) {} }
            ToastService.error('Document unavailable', 'This file can\'t be opened at the moment — contact the club.');
        });
    };

    return S;
}

/* ═════ page: memberships ═════ */
app.controller('MembershipsV2Controller', MembershipsV2Controller);
MembershipsV2Controller.$inject = ['$rootScope', '$scope', '$state', '$q', '$timeout', '$document', 'MembershipsV2Data', 'MemberService', 'MembershipService', 'ToastService'];
function MembershipsV2Controller($rootScope, $scope, $state, $q, $timeout, $document, D, MemberService, MembershipService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.D = D;
    vm.loading = true;
    vm.error = false;
    vm.memberships = [];
    vm.requests = [];
    vm.reqArm = null;
    vm.dlg = null;

    function load() {
        $q.all({ m: MemberService.GetUserMemberships(vm.user.id), r: MembershipService.GetRequestsByUser(vm.user.id) }).then(function (res) {
            vm.loading = false;
            vm.error = !(res.m && res.m.success);
            var rows = (res.m && res.m.memberships) || [];
            vm.memberships = rows.map(memVm);
            vm.requests = ((res.r && res.r.success && res.r.requests) || []).map(reqVm);
            // cards per club (the default card shows on each membership), prices from the club's tiers
            var clubs = {};
            vm.memberships.forEach(function (m) {
                if (clubs[m.club_id]) { return; }
                clubs[m.club_id] = true;
                D.cardsFor(vm.user.id, m.club_id);
                D.tiers(m.club_id).then(function (tiers) {
                    vm.memberships.forEach(function (x) {
                        if (x.club_id !== m.club_id || !(x.membership_id > 0) || D.priceKnown(x.raw)) { return; }
                        var t = tiers.filter(function (k) { return k.membership_id == x.membership_id; })[0];
                        if (t) { x.raw.price = t.price; x.raw.currency = t.currency || 'GBP'; if (!x.raw.payment_term) { x.raw.payment_term = t.payment_term; } }
                    });
                    refresh();
                });
            });
            refresh();
        });
    }

    function memVm(raw) {
        // C14: the club's home airfield {id, icao, name} | null — the place line under the club name
        var af = raw.airfield && (raw.airfield.icao || raw.airfield.name) ? raw.airfield : null;
        return { raw: raw, id: raw.id, club_id: parseInt(raw.club_id, 10), membership_id: parseInt(raw.membership_id, 10) || 0, title: D.clubTitle(raw.club_name), mono: D.mono(D.clubTitle(raw.club_name)),
            afIcao: af && af.icao ? af.icao : '', afName: af ? D.trim(af.name) : '' };
    }
    function reqVm(r) {
        var title = D.clubTitle(r.title);
        return { raw: r, id: r.id, club_id: parseInt(r.club_id, 10), title: title, mono: D.mono(title), invite: r.requested_by === 'club', st: D.reqStatus(r),
            line: D.trim(r.membership_name) + (D.priceTxt(r) ? ' · ' + D.priceTxt(r) : '') + (r.requested_by === 'club' && r.membership_start ? ' · starts ' + D.fDate(r.membership_start) : ''),
            sub: r.requested_by === 'club' ? 'Accept to set up the direct debit and start your membership.'
                : r.last4 ? 'Card saved — the first payment is charged when the club approves.'
                : r.has_mandate ? 'Direct debit ready — ' + (D.priceKnown(r) && !D.isFree(r) ? D.money(D.num(r.price), r.currency) + ' is collected' : 'your membership starts') + ' when the club approves.'
                : 'The direct debit wasn\'t finished, so the club can\'t approve this yet. Cancel it and join again.' };
    }

    // everything that depends on cards / prices is recomputed here (cards arrive one club at a time)
    function refresh() {
        vm.memberships.forEach(function (m) {
            var raw = m.raw, cc = D.cardCache[m.club_id];
            m.passenger = !(m.membership_id > 0);
            m.st = D.memStatus(raw, cc);
            m.pay = D.payOf(raw, cc);
            m.name = D.trim(raw.membership_name) || 'Passenger';
            m.price = m.passenger ? 'No fee' : D.priceTxt(raw);
            m.priceMoney = m.passenger ? '' : D.isFree(raw) ? 'Free' : D.priceKnown(raw) ? D.money(D.num(raw.price), raw.currency || 'GBP') : '';
            m.pricePer = (m.priceMoney && !D.isFree(raw)) ? ((D.term(raw.payment_term) || {}).per || '') : '';
            m.free = D.isFree(raw);
            m.hasDD = D.hasDD(raw);
            var ends = raw.membership_ends, d = ends ? D.daysTo(ends) : null;
            m.ends = ends; m.endsTxt = D.fDate(ends); m.days = d;
            m.daysTxt = d === null ? '' : d < 0 ? D.agoTxt(d) : D.daysTxt(d);
            if (ends && raw.membership_start) {
                var total = Math.max(1, Math.round((D.pd(ends) - D.pd(raw.membership_start)) / 86400000));
                m.done = Math.min(100, Math.max(4, Math.round((total - Math.max(d, 0)) / total * 100)));
            } else { m.done = d !== null && d < 0 ? 100 : 50; }
            m.meter = d !== null && d < 0 ? 'ta-meter--bad' : d !== null && d <= 30 ? 'ta-meter--warn' : '';
            m.startTxt = D.fDate(raw.membership_start);
            m.autoRenew = raw.auto_renew == 1;
            m.attn = m.st.t === 'warn' || m.st.t === 'bad';
        });
        var rank = { bad: 0, warn: 1, info: 2, good: 2 };
        vm.sorted = vm.memberships.slice().sort(function (a, b) {
            var ra = a.passenger ? 3 : rank[a.st.t], rb = b.passenger ? 3 : rank[b.st.t];
            return ra - rb || a.title.localeCompare(b.title);
        });
        tiles();
    }

    function tiles() {
        var paid = vm.memberships.filter(function (m) { return !m.passenger; });
        var active = paid.filter(function (m) { return m.st.t !== 'bad'; }).length, ended = paid.length - active, pax = vm.memberships.length - paid.length;
        vm.t1 = { v: active + ' active', s: (ended ? ended + ' ended · ' : '') + 'at ' + paid.length + ' club' + (paid.length === 1 ? '' : 's') + (pax ? ' · plus ' + pax + ' passenger membership' + (pax > 1 ? 's' : '') : '') };
        var next = paid.filter(function (m) { return m.ends && m.days >= 0; }).sort(function (a, b) { return a.ends < b.ends ? -1 : 1; })[0];
        vm.t2 = null;
        if (next) {
            var due = next.days <= 30 && !next.autoRenew;
            vm.t2 = { due: due, k: next.autoRenew ? 'Next renewal' : 'Ends next', v: next.endsTxt,
                s: next.title + ' · ' + (due ? 'in ' + next.days + ' days, won\'t renew on its own' : next.autoRenew ? 'renews automatically' : 'in ' + next.days + ' days') };
        }
        var inv = vm.requests.filter(function (r) { return r.invite; });
        if (inv.length) {
            vm.t3 = { kind: 'inv', v: String(inv.length), s: inv[0].title + ' invited you to join' };
        } else {
            var probs = [];
            paid.forEach(function (m) {
                if (m.st.t === 'bad' || !m.pay.problem) { return; }
                var x = m.pay.card ? D.cardExp(m.pay.card) : null;
                probs.push(m.pay.card ? D.cardName(m.pay.card) + ' at ' + m.title + (x.expired ? ' has expired' : ' expires ' + (x.thisMonth ? 'this month' : 'soon')) : (m.pay.kind === 'dd' ? 'Direct debit not working at ' : 'No payment method at ') + m.title);
            });
            vm.t3 = probs.length ? { kind: 'probs', v: probs.length + ' to sort out', s: probs[0] } : { kind: 'ok' };
        }
    }

    /* actions */
    vm.manage = function (m) { $state.go('dashboard.my_account.memberships.edit', { membership_id: m.id }); };
    vm.cardsFor = function (m) { $state.go('dashboard.my_account.payment_methods', { club_id: m.club_id }); };
    // straight to the v2 join page: the v1 add state has no club_id param, so the v1 → v2 move would drop it
    vm.rejoin = function (m) { $state.go('dashboard.v2.memberships_join', { club_id: m.club_id }); };
    vm.accept = function (r) { $state.go('dashboard.my_account.memberships.accept', { request_id: r.id }); };
    vm.renewOn = function (m) {
        if (m.renewBusy) { return; }
        m.renewBusy = true;
        MemberService.UpdateOneByUser(m.id, { auto_renew: 1 }).then(function (data) {
            m.renewBusy = false;
            if (data && data.success === false) { ToastService.error('Not saved', 'Auto-renew couldn\'t be turned on just now — try again.'); return; }
            m.raw.auto_renew = 1; refresh();
            ToastService.success('Auto-renew is on', m.title + ' renews on ' + m.endsTxt + '.');
        });
    };
    vm.reqArmSet = function (r) { vm.reqArm = r ? r.id : null; };
    vm.reqYes = function (r) {
        if (vm.reqBusy) { return; }
        vm.reqBusy = true;
        MembershipService.DeleteRequest(r.id).then(function (data) {
            vm.reqBusy = false;
            vm.reqArm = null;
            if (data && data.success === false) {
                // FORBIDDEN / REQUEST_NOT_FOUND carry their own sentence
                ToastService.error('Not removed', memWhy(data) || 'This request couldn\'t be removed — try again.');
                return;
            }
            vm.requests = vm.requests.filter(function (x) { return x !== r; });
            tiles();
            ToastService.success(r.invite ? 'Invitation declined' : 'Request cancelled', r.invite ? 'The invitation from ' + r.title + ' is gone.' : 'Your request to join ' + r.title + ' is cancelled.');
        });
    };

    /* the GoCardless dialog (set up / update bank details) */
    vm.gcl = function (m, mode) { vm.dlg = { m: m, mode: mode, busy: false, steps: D.ddSteps('update', m.raw, m.title) }; focusSoon('[data-e2e=mem-gcl-dlg] .ta-btn--primary'); };
    vm.gclGo = function () {
        var G = vm.dlg; if (!G || G.busy) { return; }
        G.busy = true;
        D.goToGoCardless(vm.user.id, G.m.club_id, G.m.id).then(function (ok) { if (!ok) { G.busy = false; } });
    };
    vm.closeDlg = function () { if (vm.dlg && !vm.dlg.busy) { vm.dlg = null; } };

    function focusSoon(sel) { $timeout(function () { var el = document.querySelector(sel); if (el) { el.focus(); } }, 60); }
    function onKey(e) { if ((e.which || e.keyCode) === 27) { $scope.$applyAsync(function () { if (vm.dlg) { vm.closeDlg(); } else { vm.reqArm = null; } }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });
    $scope.$watch(function () {
        var s = ''; Object.keys(D.cardCache).forEach(function (k) { var c = D.cardCache[k]; s += k + (c.loading ? 'l' : '') + (c.error ? 'e' : '') + (c.cards || []).length + c.default_card + ';'; }); return s;
    }, function () { if (!vm.loading) { refresh(); } });

    load();
}

/* ═════ page: join a club ═════ */
app.controller('MembershipJoinV2Controller', MembershipJoinV2Controller);
MembershipJoinV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$q', '$timeout', '$cookies', 'MembershipsV2Data', 'MemberService', 'MembershipService', 'ClubService', 'ToastService'];
function MembershipJoinV2Controller($rootScope, $scope, $state, $stateParams, $q, $timeout, $cookies, D, MemberService, MembershipService, ClubService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.D = D;
    vm.loading = true;
    vm.q = '';
    vm.club = null;
    vm.tiers = [];
    vm.tier = null;
    vm.terms = false;
    vm.ack = false;
    vm.err = {};
    vm.busy = false;
    var mine = {};

    $q.all({ clubs: ClubService.GetAll(), m: MemberService.GetUserMemberships(vm.user.id), r: MembershipService.GetRequestsByUser(vm.user.id) }).then(function (res) {
        vm.loading = false;
        // a live membership marks the club (a passenger membership doesn't: a passenger can still join properly)
        ((res.m && res.m.memberships) || []).forEach(function (m) { if (m.membership_id > 0 && (!m.membership_ends || D.daysTo(m.membership_ends) >= 0)) { mine[m.club_id] = 'member'; } });
        ((res.r && res.r.requests) || []).forEach(function (r) { mine[r.club_id] = mine[r.club_id] || 'req'; });
        var list = angular.isArray(res.clubs) ? res.clubs : ((res.clubs && res.clubs.clubs) || []);
        vm.clubs = list.map(function (c) {
            var title = D.clubTitle(c.title), addr = D.trim(c.address) || [c.address_line_1, c.city, c.post_code].map(D.trim).filter(Boolean).join(', ');
            // C14: the club's airfield (the members' clubs list carries it; the staff list may not)
            var icao = c.airfield && c.airfield.icao ? c.airfield.icao : '', afName = c.airfield ? D.trim(c.airfield.name) : '';
            return { id: parseInt(c.id, 10), title: title, mono: D.mono(title), address: addr || afName, icao: icao, mine: mine[c.id] || null,
                membership_terms: c.membership_terms, privacy_terms: c.privacy_terms, hay: (title + ' ' + addr + ' ' + icao + ' ' + afName + ' ' + (c.id || '')).toLowerCase() };
        });
        vm.filter();
        if ($stateParams.club_id) {
            var pre = vm.clubs.filter(function (c) { return c.id == $stateParams.club_id; })[0];
            if (pre && pre.mine !== 'member' && pre.mine !== 'req') { vm.pick(pre); }
        }
    });

    vm.filter = function () {
        var q = D.trim(vm.q).toLowerCase();
        vm.results = (vm.clubs || []).filter(function (c) { return !q || c.hay.indexOf(q) > -1; })
            .sort(function (a, b) { return (a.mine ? 1 : 0) - (b.mine ? 1 : 0) || a.title.localeCompare(b.title); });
    };
    vm.pick = function (c) {
        if (c.mine) { return; }
        vm.club = c; vm.tier = null; vm.err = {}; vm.terms = false; vm.ack = false;
        vm.tiersLoading = true;
        D.tiers(c.id).then(function (tiers) {
            if (vm.club !== c) { return; }
            vm.tiersLoading = false;
            vm.tiers = tiers.map(function (t) {
                var term = D.isFree(t) ? D.TERMS.free : (D.term(t.payment_term) || D.TERMS.free);
                // C15: plane_access / rates (yes / no only); before C15, aircraft access = not a passenger-only tier
                var planes = (typeof t.plane_access === 'boolean' || t.plane_access === 0 || t.plane_access === 1) ? !!t.plane_access : t.passenger_only != 1;
                var perks = [planes ? ['fa-plane', 'Fly the club aircraft'] : ['fa-ban', 'No aircraft hire']];
                if (t.rates === true || t.rates === 1) { perks.push(['fa-tag', 'Member rates']); }
                if (t.passenger_only == 1) { perks.push(['fa-user-friends', 'Fly as a passenger']); }
                perks.push([term.ic, term.every]);
                return { raw: t, id: t.id, name: D.trim(t.membership_name), free: D.isFree(t), priceTxt: D.isFree(t) ? 'Free' : D.money(D.num(t.price), t.currency || 'GBP'), per: term.per,
                    perks: perks, planes: planes, passenger: t.passenger_only == 1 };
            });
        });
    };
    vm.change = function () { vm.club = null; vm.tier = null; vm.terms = false; vm.ack = false; vm.err = {}; $timeout(function () { var el = document.getElementById('mem-q'); if (el) { el.focus(); } }, 50); };
    vm.pickTier = function (t) { vm.tier = t; vm.err.tier = false; vm.steps = D.ddSteps('join', t.raw, vm.club.title); };
    vm.left = function () {
        if (!vm.club) { return 'Choose a club'; }
        if (!vm.tier) { return 'Choose a membership'; }
        if (!vm.terms || !vm.ack) { return (!vm.terms && !vm.ack) ? '2 checks left' : '1 check left'; }
        return D.priceTxt(vm.tier.raw) + ' · after approval';
    };
    vm.doc = function (file, label) { D.openDoc(file, label); };
    vm.submit = function () {
        if (vm.busy) { return; }
        if (!vm.club) {
            ToastService.warning('Choose a club first', 'Search for the club you want to join.');
            $timeout(function () { var el = document.getElementById('mem-q'); if (el) { el.focus(); } }, 50);
            return;
        }
        vm.err = { tier: !vm.tier, terms: !!vm.tier && !vm.terms, ack: !!vm.tier && !vm.ack };
        if (vm.err.tier || vm.err.terms || vm.err.ack) { return; }
        vm.busy = true;
        // membership_id is the TIER (memberships.id); the server sets everything else (v1 request())
        MembershipService.SendRequest({ user_id: vm.user.id, club_id: vm.club.id, membership_id: vm.tier.raw.membership_id }).then(function (data) {
            if (data && data.success && data.mandate && data.mandate.on_file) {
                // asked again where the earlier request is still with the club: updated, its direct debit already set up
                ToastService.success('Request updated', 'Your direct debit is already set up, so ' + vm.club.title + ' just needs to approve it.');
                $state.go('dashboard.my_account.memberships');
            } else if (data && data.success && data.mandate && data.mandate.link) {
                $cookies.put('gcl_sess', data.mandate.session);
                // your own request is approved by the club, never on the way back from GoCardless
                $cookies.remove('gcl_member_accepted');
                window.location = data.mandate.link;
            } else {
                vm.busy = false;
                // FORBIDDEN / INVALID_MEMBERSHIP / NO_DD_INTEGRATION / REQUEST_PAYMENT_PENDING carry their own sentence
                ToastService.error(data && data.error === 'NO_DD_INTEGRATION' ? 'Direct debit unavailable' : 'Request not sent',
                    memWhy(data) || 'Your request couldn\'t be sent — try again.');
            }
        });
    };
}

/* ═════ page: accept an invitation ═════ */
app.controller('MembershipAcceptV2Controller', MembershipAcceptV2Controller);
MembershipAcceptV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$cookies', 'MembershipsV2Data', 'MembershipService', 'ToastService'];
function MembershipAcceptV2Controller($rootScope, $scope, $state, $stateParams, $cookies, D, MembershipService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.D = D;
    vm.loading = true;
    vm.terms = false;
    vm.err = false;
    vm.declineArm = false;
    vm.busy = false;

    MembershipService.GetRequestsById($stateParams.request_id).then(function (data) {
        vm.loading = false;
        var r = data && data.success ? data.request : null;
        if (!r) { vm.missing = true; return; }
        vm.r = r;
        vm.title = D.clubTitle(r.title);
        vm.mono = D.mono(vm.title);
        vm.invite = r.requested_by === 'club';
        vm.priceTxt = D.priceTxt(r);
        vm.priceMoney = (!D.isFree(r) && D.priceKnown(r)) ? D.money(D.num(r.price), r.currency || 'GBP') : '';
        vm.pricePer = vm.priceMoney ? ((D.term(r.payment_term) || {}).per || '') : '';
        vm.every = (D.term(r.payment_term) || {}).every || '';
        // C31 (9 Nov): a FREE tier is accepted without a direct debit — the server answers {completed: true, mandate: null}
        vm.free = D.isFree(r);
        vm.steps = vm.free
            ? [['Agree and accept', 'Tick the club\'s terms below, then press Accept invitation.'],
               ['You\'re a member', (r.membership_start && D.daysTo(r.membership_start) > 0 ? 'Your membership starts on ' + D.fDate(r.membership_start) + '. ' : 'Your membership starts straight away. ') + 'There is no fee and no direct debit to set up.']]
            : D.ddSteps('accept', r, vm.title);
    });

    vm.doc = function (file, label) { D.openDoc(file, label); };
    vm.decline = function () {
        if (vm.declining) { return; }
        vm.declining = true;
        MembershipService.DeleteRequest(vm.r.id).then(function (data) {
            vm.declining = false;
            if (data && data.success === false) {
                vm.declineArm = false;
                ToastService.error('Not declined', memWhy(data) || 'The invitation couldn\'t be declined — try again.');
                return;
            }
            ToastService.success('Invitation declined', 'The invitation from ' + vm.title + ' is gone.');
            $state.go('dashboard.my_account.memberships');
        });
    };
    vm.submit = function () {
        if (vm.busy) { return; }
        if (!vm.terms) { vm.err = true; return; }
        vm.busy = true;
        // the server takes club / person from the request itself (v1 accept_it)
        MembershipService.AcceptRequest(vm.r.id, { request_id: vm.r.id }).then(function (data) {
            // C31: accepted outright (a free tier) — no GoCardless step
            if (data && data.success !== false && data.completed) {
                vm.busy = false; vm.done = true;
                ToastService.success('You\'re a member', 'Welcome to ' + vm.title + '.', { confetti: false });
                return;
            }
            if (!data || data.success === false || !data.mandate || !data.mandate.link) {
                vm.busy = false;
                // FORBIDDEN (not your offer) / REQUEST_NOT_FOUND / NO_DD_INTEGRATION
                ToastService.error(data && data.error === 'NO_DD_INTEGRATION' ? 'Direct debit unavailable' : 'Could not accept',
                    memWhy(data) || 'This invitation couldn\'t be accepted — try again.');
                return;
            }
            $cookies.put('gcl_sess', data.mandate.session);
            $cookies.put('gcl_member_accepted', true);
            window.location = data.mandate.link;
        });
    };
}

/* ═════ page: back from GoCardless (joining / accepting, or new bank details) ═════ */
app.controller('MembershipDDV2Controller', MembershipDDV2Controller);
MembershipDDV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$location', '$cookies', '$timeout', 'MembershipsV2Data', 'GoCardService', 'MemberService', 'MembershipService', 'ToastService'];
function MembershipDDV2Controller($rootScope, $scope, $state, $stateParams, $location, $cookies, $timeout, D, GoCardService, MemberService, MembershipService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.update = $state.current.data.mode === 'update';
    vm.membershipId = $stateParams.membership_id;
    vm.accepted = !vm.update && !!$cookies.get('gcl_member_accepted');
    vm.mode = vm.update ? 'update' : vm.accepted ? 'accept' : 'join';
    vm.stage = 'saving';

    // the flow id: from the URL (v2 link) or kept at boot (v1 URL moved to v2) — used once
    var flow = $location.search().redirect_flow_id;
    try {
        var kept = JSON.parse(sessionStorage.getItem('toaviate_v2_gcl_flow') || 'null');
        if (!flow && kept && kept.flow && (Date.now() - kept.at) < 30 * 60 * 1000) { flow = kept.flow; }
        sessionStorage.removeItem('toaviate_v2_gcl_flow');
    } catch (e) {}

    vm.steps = vm.mode === 'join' ? ['Membership chosen', 'Bank details', 'Confirmed', 'Club approves']
        : vm.mode === 'accept' ? ['Invitation', 'Bank details', 'Confirmed', 'Membership starts'] : ['Bank details', 'Confirmed', 'Back to your membership'];
    vm.stepClass = function (i) {
        var at = vm.update ? (vm.stage === 'done' ? 2 : 1) : (vm.stage === 'done' ? 3 : 2);
        if (i < at) { return 'ta-steps__s--done'; }
        if (i === at) { return vm.stage === 'failed' ? 'ta-steps__s--bad' : 'ta-steps__s--now'; }
        return '';
    };
    vm.lineDone = function (i) { var at = vm.update ? (vm.stage === 'done' ? 2 : 1) : (vm.stage === 'done' ? 3 : 2); return i <= at && vm.stage !== 'failed'; };

    if (!flow) {
        vm.stage = 'none';
    } else if (vm.update) {
        if (vm.membershipId) {
            MemberService.GetOneForUser(vm.membershipId).then(function (d) { if (d && d.success) { vm.clubTitle = D.clubTitle(d.membership.club_name); } });
        }
        GoCardService.UpdateMandate({ mandate: flow, session: $cookies.get('gcl_sess'), membership_id: vm.membershipId }).then(function (data) {
            $cookies.remove('gcl_member_accepted');
            if (!data || !data.success) {
                vm.stage = 'failed';
                // FORBIDDEN (not your membership) / NO_DD_INTEGRATION carry their own sentence
                vm.why = (data && typeof data.error === 'string') ? memWhy(data) : '';
                return;
            }
            vm.stage = 'done';
            ToastService.success('Bank details saved', 'Payments' + (vm.clubTitle ? ' to ' + vm.clubTitle : '') + ' now come from your new account.');
            $state.go('dashboard.my_account.memberships.edit', { membership_id: vm.membershipId }, { location: 'replace' });
        });
    } else {
        var body = { mandate: flow, session: $cookies.get('gcl_sess'), member_accepted: vm.accepted };
        GoCardService.SetupMandate(body).then(function (data) {
            $cookies.remove('gcl_member_accepted');
            if (!data || !data.success) {
                vm.stage = 'failed';
                vm.why = memWhy(data);
                return;
            }
            vm.stage = 'done';
            vm.clubTitle = D.clubTitle(data.club && data.club.title) || 'the club';
            vm.pending = !!data.membership_pending;
            vm.serverLine = memWhy(data);
            // joining: the summary of the request the club now has (the open request at that club)
            if (vm.mode === 'join') {
                MembershipService.GetRequestsByUser(vm.user.id).then(function (rq) {
                    var title = vm.clubTitle.toLowerCase(), cid = data.club && data.club.id;
                    var r = ((rq && rq.requests) || []).filter(function (x) { return x.requested_by !== 'club' && (cid ? x.club_id == cid : D.clubTitle(x.title).toLowerCase() === title); })[0];
                    if (r) { vm.req = { name: D.trim(r.membership_name), price: D.priceTxt(r), money: (!D.isFree(r) && D.priceKnown(r)) ? D.money(D.num(r.price), r.currency || 'GBP') : '' }; }
                });
            }
        });
    }
    vm.retry = function () {
        if (vm.update && vm.membershipId) { $state.go('dashboard.my_account.memberships.edit', { membership_id: vm.membershipId }); return; }
        $state.go(vm.mode === 'accept' ? 'dashboard.my_account.memberships' : 'dashboard.my_account.memberships.add');
    };
}

/* ═════ page: one membership (edit) ═════ */
app.controller('MembershipDetailV2Controller', MembershipDetailV2Controller);
MembershipDetailV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$timeout', '$document', 'MembershipsV2Data', 'MemberService', 'InstructorService', 'ToastService'];
function MembershipDetailV2Controller($rootScope, $scope, $state, $stateParams, $timeout, $document, D, MemberService, InstructorService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.D = D;
    vm.id = $stateParams.membership_id;      // the member row — for_user overwrites membership.id with the plan id
    vm.loading = true;
    vm.dlg = null;
    vm.pref = {};

    function load() {
        MemberService.GetOneForUser(vm.id).then(function (data) {
            vm.loading = false;
            if (!data || !data.success || !data.membership) { vm.missing = true; return; }
            vm.m = data.membership;
            vm.title = D.clubTitle(vm.m.club_name);
            vm.clubId = parseInt(vm.m.club_id, 10);
            vm.cc = D.cardsFor(vm.user.id, vm.clubId, true);
            vm.auto = vm.m.auto_renew == 1;
            vm.isInstructor = vm.m.instructor == 1;
            vm.pref = { reminders: vm.m.mute_booking_reminders == 0, notifications: vm.m.mute_booking_emails == 0, summary: vm.m.instructor_daily_summary == 1 };
            vm.docs = [['membership_terms', 'membership_updated', 'Membership terms'], ['privacy_terms', 'privacy_updated', 'Privacy policy'], ['passenger_terms', 'passenger_updated', 'Passenger terms']]
                .map(function (x) { return { file: vm.m[x[0]], updated: vm.m[x[1]] ? D.fDateTime(vm.m[x[1]]) : '', label: x[2] }; });
            if (!D.priceKnown(vm.m) && vm.m.membership_id > 0) {
                D.tiers(vm.clubId).then(function (tiers) {
                    var t = tiers.filter(function (k) { return k.membership_id == vm.m.membership_id; })[0];
                    if (t) { vm.m.price = t.price; vm.m.currency = t.currency || 'GBP'; refresh(); }
                });
            }
            refresh();
        });
    }
    function refresh() {
        if (!vm.m) { return; }
        var m = vm.m;
        vm.st = D.memStatus(m, vm.cc);
        vm.pay = D.payOf(m, vm.cc);
        vm.dd = D.ddState(m);
        vm.hasDD = D.hasDD(m);
        vm.dcard = D.defaultCard(vm.cc);
        vm.takesCards = !!m.club_stripe_id;
        vm.free = D.isFree(m);
        vm.priceTxt = m.membership_id > 0 ? D.priceTxt(m) : 'No fee';
        vm.ends = m.membership_ends; vm.days = vm.ends ? D.daysTo(vm.ends) : null;
        vm.endsTxt = D.fDate(vm.ends);
        vm.renewSub = vm.ends ? (vm.days < 0 ? 'Ended ' + vm.endsTxt : (vm.auto ? 'Renews ' : 'Ends ') + vm.endsTxt + ' · ' + D.daysTxt(vm.days)) : 'No end date';
        vm.endsK = vm.ends ? (vm.days < 0 ? 'Ended' : vm.auto ? 'Renews' : 'Ends') : 'Ends';
        vm.startTxt = D.fDate(m.membership_start) || '—';
        vm.cardLine = vm.dcard ? D.cardName(vm.dcard) + ' · expires ' + D.cardExp(vm.dcard).label + (vm.cc.cards.length > 1 ? ' · ' + vm.cc.cards.length + ' cards saved' : '') : 'No card saved with ' + vm.title;
        vm.cardsSummary = vm.cc.loading ? 'Loading your cards…' : vm.cc.error ? 'Your saved cards couldn\'t be loaded just now.'
            : vm.cc.cards.length ? vm.cc.cards.length + ' card' + (vm.cc.cards.length > 1 ? 's' : '') + ' saved with ' + vm.title + (vm.dcard ? ' — ' + D.cardName(vm.dcard) + ' is the default.' : ' — none is the default.')
            : 'No cards saved with ' + vm.title + '.';
        vm.renewText = vm.auto
            ? 'On ' + vm.endsTxt + ' the club charges ' + (D.priceKnown(m) && !vm.free ? D.money(D.num(m.price), m.currency) : 'the renewal') + ' using your default payment method' + (vm.pay.kind === 'dd' ? ' — direct debit' : vm.pay.card ? ' — ' + D.cardName(vm.pay.card) : '') + '.'
            : 'Your membership ends on ' + vm.endsTxt + '. You\'ll get a reminder email before then.';
        vm.payWarn = !vm.auto || !vm.pay.problem ? '' : vm.pay.kind === 'dd' ? 'Auto-renew is on but there\'s no working direct debit — set one up below or the renewal will fail.'
            : vm.pay.card ? 'Your default card ' + D.expTxt(vm.pay.card) + (D.cardExp(vm.pay.card).expired ? '' : ', before this renews') + ' — add a new card or switch to direct debit below.'
            : 'Auto-renew is on but you have no saved card — add one below or the renewal will fail.';
    }
    $scope.$watch(function () { return vm.cc ? (vm.cc.loading ? 'l' : '') + (vm.cc.error ? 'e' : '') + vm.cc.cards.length + vm.cc.default_card : ''; }, refresh);

    vm.setAuto = function () {
        var want = vm.auto;
        MemberService.UpdateOneByUser(vm.id, { auto_renew: want ? 1 : 0 }).then(function (data) {
            if (data && data.success === false) { vm.auto = !want; refresh(); ToastService.error('Not saved', 'Auto-renew couldn\'t be changed just now — try again.'); return; }
            vm.m.auto_renew = want ? 1 : 0; refresh();
            ToastService.success('Saved', 'Auto-renew is now ' + (want ? 'on' : 'off') + ' for ' + vm.title + '.');
        });
    };
    vm.setDefault = function (name) {
        if (name === 'gocardless' && !vm.hasDD) { vm.gcl('setup'); return; }
        if (name === 'stripe' && !vm.dcard) { $state.go('dashboard.my_account.payment_methods.add', { club_id: vm.clubId }); return; }
        if (vm.m.default_payment_method === name || vm.settingDefault) { return; }
        vm.settingDefault = name;
        MemberService.UpdateOneByUser(vm.id, { default_payment_method: name }).then(function (data) {
            vm.settingDefault = null;
            if (data && data.success === false) {
                // the server says why (NO_MANDATE / NO_CARD / VALIDATION_ERROR)
                ToastService.error('Not changed', memWhy(data) || 'Your default payment method couldn\'t be changed — try again.');
                return;
            }
            vm.m.default_payment_method = name; refresh();
            ToastService.success('Default updated', (name === 'stripe' ? 'Card payments are' : 'Direct debit is') + ' now how you pay ' + vm.title + '.');
        });
    };
    vm.savePref = function () {
        var p = vm.pref;
        if (vm.isInstructor) {
            var update = { id: vm.id, mute_booking_emails: p.notifications ? 0 : 1, mute_booking_reminders: p.reminders ? 0 : 1, instructor_daily_summary: p.summary ? 1 : 0 };
            InstructorService.UpdateInstructor(update, vm.clubId).then(function (data) {
                if (data && data.success) {
                    vm.m.mute_booking_emails = update.mute_booking_emails; vm.m.mute_booking_reminders = update.mute_booking_reminders; vm.m.instructor_daily_summary = update.instructor_daily_summary;
                    ToastService.success('Saved', 'Email preferences updated.');
                } else {
                    vm.pref = { reminders: vm.m.mute_booking_reminders == 0, notifications: vm.m.mute_booking_emails == 0, summary: vm.m.instructor_daily_summary == 1 };
                    ToastService.error('Not saved', memWhy(data) || 'Your email preferences couldn\'t be saved.');
                }
            });
        } else {
            var obj = { mute_booking_reminders: p.reminders ? 0 : 1 };
            MemberService.UpdateOneByUser(vm.id, obj).then(function (data) {
                if (data && data.success) { vm.m.mute_booking_reminders = obj.mute_booking_reminders; ToastService.success('Saved', 'Booking reminder preference updated.'); }
                else { vm.pref.reminders = vm.m.mute_booking_reminders == 0; ToastService.error('Not saved', 'Your booking reminder preference couldn\'t be saved.'); }
            });
        }
    };
    // the document in a dialog (Alex, 10 Nov 2026); none uploaded → the same notice as before
    vm.docView = null;
    vm.doc = function (d) { if (!d.file) { D.openDoc(d.file, d.label); return; } vm.docView = d; };
    vm.closeDocView = function () { vm.docView = null; };
    vm.manageCards = function () { $state.go('dashboard.my_account.payment_methods', { club_id: vm.clubId }); };
    vm.addCard = function () { $state.go('dashboard.my_account.payment_methods.add', { club_id: vm.clubId }); };

    vm.gcl = function (mode) { vm.dlg = { mode: mode, busy: false, steps: D.ddSteps('update', vm.m, vm.title) }; $timeout(function () { var el = document.querySelector('[data-e2e=mem-gcl-dlg] .ta-btn--primary'); if (el) { el.focus(); } }, 60); };
    vm.gclGo = function () {
        var G = vm.dlg; if (!G || G.busy) { return; }
        G.busy = true;
        D.goToGoCardless(vm.user.id, vm.clubId, vm.id).then(function (ok) { if (!ok) { G.busy = false; } });
    };
    vm.closeDlg = function () { if (vm.dlg && !vm.dlg.busy) { vm.dlg = null; } };
    function onKey(e) { if ((e.which || e.keyCode) === 27) { if (vm.docView) { $scope.$applyAsync(vm.closeDocView); } else if (vm.dlg) { $scope.$applyAsync(vm.closeDlg); } } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    load();
}

/* ═════ page: payment methods (saved cards per club) ═════ */
app.controller('PaymentMethodsV2Controller', PaymentMethodsV2Controller);
PaymentMethodsV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$location', '$document', 'MembershipsV2Data', 'MemberService', 'PaymentService', 'ToastService'];
function PaymentMethodsV2Controller($rootScope, $scope, $state, $stateParams, $location, $document, D, MemberService, PaymentService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.D = D;
    vm.loading = true;
    vm.clubs = [];
    vm.scope = 'all';
    vm.rm = null;

    MemberService.GetUserMemberships(vm.user.id).then(function (data) {
        vm.loading = false;
        if (!data || !data.success) { vm.error = true; return; }
        var seen = {};
        (data.memberships || []).forEach(function (m) {
            var id = parseInt(m.club_id, 10);
            if (!id || seen[id]) { return; }
            seen[id] = true;
            var title = D.clubTitle(m.club_name);
            vm.clubs.push({ id: id, title: title, mono: D.mono(title), m: m, dd: D.hasDD(m) ? D.ddState(m) : null, cc: D.cardsFor(vm.user.id, id, true) });
        });
        if ($stateParams.club_id && seen[parseInt($stateParams.club_id, 10)] && vm.clubs.length > 1) { vm.scope = parseInt($stateParams.club_id, 10); }
        refresh();
    });

    function refresh() {
        vm.shown = vm.clubs.filter(function (c) { return vm.scope === 'all' || c.id === vm.scope; });
        vm.alerts = [];
        vm.clubs.forEach(function (c) {
            (c.cc.cards || []).forEach(function (k) { var x = D.cardExp(k); if (x.expired || x.soon) { vm.alerts.push(D.cardName(k) + ' with ' + c.title + ' ' + D.expTxt(k)); } });
            c.sub = c.cc.loading ? 'Loading saved cards…' : c.cc.error ? 'Saved cards unavailable' : c.cc.cards.length ? c.cc.cards.length + ' saved card' + (c.cc.cards.length > 1 ? 's' : '') + (c.cc.default_card ? '' : ' · no default') : 'No saved cards';
            c.cards = (c.cc.cards || []).map(function (k) {
                var x = D.cardExp(k);
                return { raw: k, id: k.stripe_id, icon: D.brand(k.brand)[0], brandName: D.brand(k.brand)[1], last4: k.last4, funding: k.funding || '', exp: x.label, expired: x.expired,
                    def: k.stripe_id === c.cc.default_card, pill: D.cardPill(k) };
            });
            c.noDefault = c.cc.cards && c.cc.cards.length && !c.cc.default_card;
            c.emptyLine = c.dd && c.dd.ok ? 'You pay ' + c.title + ' by direct debit, so a card is optional — it\'s offered when you pay an invoice or a booking.'
                : 'To book ' + c.title + '\'s aircraft you need a saved card or a direct debit with the club.';
        });
    }
    $scope.$watch(function () { var s = ''; vm.clubs.forEach(function (c) { s += c.id + (c.cc.loading ? 'l' : '') + (c.cc.error ? 'e' : '') + (c.cc.cards || []).length + c.cc.default_card + ';'; }); return s; }, refresh);

    vm.setScope = function (s) { vm.scope = s; vm.rm = null; refresh(); };
    vm.retry = function (c) { c.cc = D.cardsFor(vm.user.id, c.id, true); };
    vm.add = function (c) { $state.go('dashboard.my_account.payment_methods.add', { club_id: c.id }); };
    vm.makeDefault = function (c, k) {
        if (k.def || vm.settingDefault) { return; }
        vm.settingDefault = k.id;
        PaymentService.UpdateDefaultCard({ user_id: vm.user.id, club_id: c.id, card_id: k.id }).then(function (data) {
            vm.settingDefault = null;
            if (data && data.success) {
                if (data.cards) { D.setCards(c.id, data); } else { c.cc.default_card = data.default_card || k.id; }
                refresh();
                ToastService.success('Default card updated', 'The card ending ' + k.last4 + ' is now your default card for ' + c.title + '.');
            } else {
                // FORBIDDEN / CARD_NOT_FOUND carry their own sentence
                ToastService.error('Not changed', memWhy(data) || 'Your default card couldn\'t be changed — try again.');
                if (data && data.error === 'CARD_NOT_FOUND') { c.cc = D.cardsFor(vm.user.id, c.id, true); }   // UX pass 2: the card is gone — show the list as it is now
            }
        });
    };
    vm.arm = function (k) { vm.rm = k ? k.id : null; };
    vm.remove = function (c, k) {
        if (vm.removing) { return; }
        vm.removing = true;
        PaymentService.DeleteMemberCard({ user_id: vm.user.id, club_id: c.id, card_id: k.id }).then(function (data) {
            vm.removing = false;
            vm.rm = null;
            if (data && data.success) {
                ToastService.success('Card removed', 'The card ending ' + k.last4 + ' has been removed.');
                c.cc = D.cardsFor(vm.user.id, c.id, true);
            } else {
                ToastService.error('Not removed', memWhy(data) || 'That card couldn\'t be removed — try again.');
                if (data && data.error === 'CARD_NOT_FOUND') { c.cc = D.cardsFor(vm.user.id, c.id, true); }   // UX pass 2: already gone — refresh
            }
        });
    };
    function onKey(e) { if ((e.which || e.keyCode) === 27 && vm.rm) { $scope.$applyAsync(function () { vm.rm = null; }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    // a redirect-based card set-up (3-D Secure page) comes back here: finalise it (sets the default, links the customer)
    (function setupReturn() {
        var si = $stateParams.setup_intent, status = $stateParams.redirect_status;
        if (!si) { return; }
        $location.search('setup_intent', null).search('setup_intent_client_secret', null).search('redirect_status', null).replace();
        if (status === 'succeeded') {
            PaymentService.ConfirmSetup({ setup_intent_id: si, user_id: vm.user.id, club_id: parseInt($stateParams.club_id, 10) || 0 }).then(function (data) {
                if (data && data.success) { ToastService.success('Card saved', 'Your new card is saved and is now your default card.'); }
                vm.clubs.forEach(function (c) { if (c.id == $stateParams.club_id) { c.cc = D.cardsFor(vm.user.id, c.id, true); } });
            });
        } else {
            ToastService.error('Card not added', 'The card set-up wasn\'t completed — try again.');
        }
    })();
}

/* ═════ page: add a card (SetupIntent + Stripe Payment Element) ═════ */
app.controller('AddCardV2Controller', AddCardV2Controller);
AddCardV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$timeout', 'MembershipsV2Data', 'MemberService', 'PaymentService', 'ToastService'];
function AddCardV2Controller($rootScope, $scope, $state, $stateParams, $timeout, D, MemberService, PaymentService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;
    vm.D = D;
    vm.loading = true;
    vm.clubs = [];
    vm.club = null;
    vm.picking = false;
    vm.stage = 'pick';           // pick → loading → ready → saving
    vm.err = '';
    var stripe = null, elements = null, element = null;

    MemberService.GetUserMemberships(vm.user.id).then(function (data) {
        vm.loading = false;
        if (!data || !data.success) { vm.err = 'We couldn\'t load your clubs — try again shortly.'; return; }
        var seen = {};
        (data.memberships || []).forEach(function (m) {
            var id = parseInt(m.club_id, 10);
            if (!id || seen[id]) { return; }
            seen[id] = true;
            var title = D.clubTitle(m.club_name);
            vm.clubs.push({ id: id, title: title, mono: D.mono(title), cc: D.cardsFor(vm.user.id, id) });
        });
        var pre = null;
        if ($stateParams.club_id) { pre = vm.clubs.filter(function (c) { return c.id == $stateParams.club_id; })[0]; }
        if (!pre && vm.clubs.length === 1) { pre = vm.clubs[0]; }
        if (pre) { vm.pick(pre); }
    });

    // how many cards are already saved with a club (null while unknown)
    vm.saved = function (c) { return c && c.cc && !c.cc.loading && !c.cc.error ? (c.cc.cards || []).length : null; };
    vm.pick = function (c) {
        if (vm.stage === 'saving') { return; }
        vm.club = c; vm.picking = false;
        start();
    };
    vm.change = function () { if (vm.stage !== 'saving') { vm.picking = true; } };
    vm.back = function (force) {
        if (!force && vm.dirty && vm.stage === 'ready') { vm.confirmLeave = true; return; }   // ask before throwing typed card details away
        $state.go('dashboard.my_account.payment_methods', vm.club ? { club_id: vm.club.id } : {});
    };

    function teardown() {
        if (element) { try { element.destroy(); } catch (e) {} }
        element = null; elements = null; stripe = null;
    }
    function start() {
        var c = vm.club;
        teardown();
        vm.err = ''; vm.stage = 'loading';
        PaymentService.CreateNewCustomer({ club_id: c.id, user_id: vm.user.id }).then(function (data) {
            if (vm.club !== c) { return; }
            if (!data || !data.success || !data.secret) {
                vm.stage = 'error';
                vm.err = memWhy(data) || (data && typeof data.error === 'string' && data.error.length > 20 && data.error) || c.title + ' doesn\'t take card payments yet — contact the club, or choose another club.';
                ToastService.warning('Card form not available', vm.err);
                return;
            }
            PaymentService.GetClubStripeKey(c.id).then(function (key) {
                if (vm.club !== c) { return; }
                stripe = Stripe(key);
                elements = stripe.elements({ clientSecret: data.secret, appearance: { theme: document.body.classList.contains('night-mode') ? 'night' : 'stripe', variables: { colorPrimary: '#2d5a8e', borderRadius: '8px' } } });
                element = elements.create('payment', { layout: 'tabs' });
                element.on('loaderror', function () { $scope.$applyAsync(function () { vm.stage = 'error'; vm.err = 'The card form couldn\'t be loaded — go back and try again.'; }); });
                element.on('change', function (e) { vm.dirty = !e.empty; });   // typed card details: leaving asks first
                vm.stage = 'ready';
                $timeout(function () { element.mount('#payment-element'); });
            }).catch(function (err) {
                vm.stage = 'error';
                vm.err = (err && err.code === 'stripe_js_unavailable')
                    ? 'We couldn\'t load the secure card form. Your network or a browser extension may be blocking js.stripe.com — allow it and try again.'
                    : c.title + ' doesn\'t take card payments yet. Contact the club.';
            });
        });
    }

    // Stripe's confirmSetup is not an ng-click write: the busy guard can't see it, so this page keeps its own flag
    vm.save = function () {
        if (vm.stage !== 'ready' || !stripe || !elements) { return; }
        var c = vm.club;
        vm.stage = 'saving'; vm.stripeErr = '';
        stripe.confirmSetup({
            elements: elements,
            confirmParams: { return_url: $state.href('dashboard.v2.payment_methods', { club_id: c.id }, { absolute: true }) },
            redirect: 'if_required'
        }).then(function (result) {
            $scope.$applyAsync(function () {
                if (result.error) { vm.stage = 'ready'; vm.stripeErr = result.error.message || 'Your card couldn\'t be saved — check the details and try again.'; return; }
                var intent = result.setupIntent;
                if (!intent || intent.status !== 'succeeded') { vm.stage = 'ready'; vm.stripeErr = 'The card set-up didn\'t complete — try again.'; return; }
                PaymentService.ConfirmSetup({ setup_intent_id: intent.id, user_id: vm.user.id, club_id: c.id }).then(function () {
                    // the card is attached at Stripe even if the finalise call hiccups: Payment methods reads it from there
                    D.cardsFor(vm.user.id, c.id, true);
                    ToastService.success('Card saved', 'It\'s now your default card for ' + c.title + '.');
                    $state.go('dashboard.my_account.payment_methods', { club_id: c.id });
                });
            });
        });
    };
    $scope.$on('$destroy', teardown);
}
