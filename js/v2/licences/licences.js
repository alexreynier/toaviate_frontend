/* ═══════════════════════════════════════════════════════════════════════════
   v2 LICENCES · MEDICAL · DIFFERENCES — design: mockups/my-account/licences-medical.html (approved 7 Nov 2026),
   built 8 Nov. The My documents hub (Licences · Medical · Differences · Proof of ID — the last is
   js/v2/profile's PoidV2Controller, club members only). Replaces, while the v2 switch is on:
     dashboard.my_account.licence (+ .add / .edit)  → dashboard.v2.licence / licence_add / licence_edit
     dashboard.my_account.medical (+ .add / .edit)  → dashboard.v2.medical / medical_add / medical_edit
     dashboard.my_account.differences               → dashboard.v2.differences
   Same server calls as v1 (LicenceService, MedicalService, DifferencesService, AuthenticationService.Login3,
   RemindersService for the reminder note). Dates go as plain YYYY-MM-DD (contract C2, landed 8 Nov).
   Views: views/v2/licences/*.html · CSS: css/v2/licences.css (prefix lic-).
   Each live club's check of a record (difference rows too, by user_difference_id): GET member_checks/v2/mine (C9, 8 Nov).
   C28 (9 Nov): medical `limitations` (≤120), differences `signed_off_by` (≤100), "Needed to fly G-XXXX solo at <club>"
   from GET member_checks/v2/needed_for (MemberChecksV2.neededFor / diffNeeds).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.licence', {
            url: '/my_account/licence',
            templateUrl: 'views/v2/licences/licences.html',
            controller: 'DocsHubV2Controller', controllerAs: 'vm',
            data: { action: 'list', screen: 'licences' }
        })
        .state('dashboard.v2.licence_add', {
            url: '/my_account/licence/add',
            templateUrl: 'views/v2/licences/licence_form.html',
            controller: 'DocFormV2Controller', controllerAs: 'vm',
            data: { action: 'add', kind: 'licence' }
        })
        .state('dashboard.v2.licence_edit', {
            url: '/my_account/licence/edit/:licence_id',
            templateUrl: 'views/v2/licences/licence_form.html',
            controller: 'DocFormV2Controller', controllerAs: 'vm',
            data: { action: 'edit', kind: 'licence' }
        })
        .state('dashboard.v2.medical', {
            url: '/my_account/medical',
            templateUrl: 'views/v2/licences/medical.html',
            controller: 'DocsHubV2Controller', controllerAs: 'vm',
            data: { action: 'list', screen: 'medical' }
        })
        .state('dashboard.v2.medical_add', {
            url: '/my_account/medical/add',
            templateUrl: 'views/v2/licences/medical_form.html',
            controller: 'DocFormV2Controller', controllerAs: 'vm',
            data: { action: 'add', kind: 'medical' }
        })
        .state('dashboard.v2.medical_edit', {
            url: '/my_account/medical/edit/:medical_id',
            templateUrl: 'views/v2/licences/medical_form.html',
            controller: 'DocFormV2Controller', controllerAs: 'vm',
            data: { action: 'edit', kind: 'medical' }
        })
        .state('dashboard.v2.differences', {
            url: '/my_account/differences',
            templateUrl: 'views/v2/licences/differences.html',
            controller: 'DocsHubV2Controller', controllerAs: 'vm',
            data: { action: 'list', screen: 'differences' }
        });
    DesignRoutesProvider
        .map('dashboard.my_account.licence', 'dashboard.v2.licence')
        .map('dashboard.my_account.licence.add', 'dashboard.v2.licence_add')
        .map('dashboard.my_account.licence.edit', 'dashboard.v2.licence_edit')
        .map('dashboard.my_account.medical', 'dashboard.v2.medical')
        .map('dashboard.my_account.medical.add', 'dashboard.v2.medical_add')
        .map('dashboard.my_account.medical.edit', 'dashboard.v2.medical_edit')
        .map('dashboard.my_account.differences', 'dashboard.v2.differences');
}]);


/* ═══ LicencesV2Data — reference lists (cached for the visit), the member's records, the tab counts ═══ */
app.factory('LicencesV2Data', LicencesV2Data);
LicencesV2Data.$inject = ['$q', 'LicenceService', 'MedicalService', 'DifferencesService', 'PoidService', 'RemindersService'];
function LicencesV2Data($q, LicenceService, MedicalService, DifferencesService, PoidService, RemindersService) {
    var refs = null, counts = null, countsAt = 0;
    var d = {};
    function arr(x) { return angular.isArray(x) ? x : []; }
    d.refs = function () {
        if (!refs) {
            refs = $q.all([LicenceService.GetLicenceTypes(), LicenceService.GetRatings(), LicenceService.GetAuthority(), MedicalService.GetComponents(), DifferencesService.GetDifferences()])
                .then(function (r) {
                    var out = { types: arr(r[0]), ratings: arr(r[1]), authority: arr(r[2]), comps: arr(r[3]), diffs: arr(r[4]) };
                    if (!out.types.length || !out.authority.length) { refs = null; }   // try again next time
                    return out;
                });
        }
        return refs;
    };
    d.byId = function (list, id) { for (var i = 0; i < (list || []).length; i++) { if (+list[i].id === +id) { return list[i]; } } return null; };
    d.load = function (user, which) {
        var clubMember = !!(user.access && user.access.show_booking);
        return $q.all([
            which.lic ? LicenceService.GetByUserId(user.id) : $q.when(null),
            which.med ? MedicalService.GetByUserId(user.id) : $q.when(null),
            which.dif ? DifferencesService.GetByUserId(user.id) : $q.when(null),
            which.poid && clubMember ? PoidService.GetByUserId(user.id) : $q.when(null)
        ]).then(function (r) {
            var out = {
                licences: r[0] && r[0].success ? arr(r[0].licences) : null,
                medicals: r[1] && r[1].success ? arr(r[1].medicals) : null,
                diffs: r[2] && r[2].success && r[2].differences ? { rows: arr(r[2].differences.differences), images: arr(r[2].differences.images) } : null,
                poids: r[3] && r[3].success ? arr(r[3].poids) : null
            };
            counts = counts || {};
            if (out.licences) { counts.licences = out.licences.length; }
            if (out.medicals) { counts.medical = out.medicals.length; }
            if (out.diffs) { counts.differences = out.diffs.rows.length; }
            if (out.poids) { counts.poid = out.poids.length; }
            countsAt = Date.now();
            return out;
        });
    };
    /* the hub tab counts: one fetch of every list, re-used for 30 s */
    d.counts = function (user) {
        if (counts && Date.now() - countsAt < 30000 && counts.licences !== undefined && counts.medical !== undefined && counts.differences !== undefined) { return $q.when(counts); }
        return d.load(user, { lic: true, med: true, dif: true, poid: true }).then(function () { return counts; });
    };
    d.dirty = function () { countsAt = 0; };
    /* the member's own reminder offsets for a type ('licence' | 'rating' | 'medical') */
    d.reminders = function () {
        return RemindersService.GetPreferences().then(function (r) { return r && r.success ? r : null; });
    };
    return d;
}


/* ═══ LicStatus — the one status helper for this domain: a date → tone, word, icon, rank (guidelines §4.6) ═══ */
app.factory('LicStatus', ['ProfileV2Util', function (U) {
    var SOON = 30;   /* "expires in N days" from 30 days out = the first default expiry reminder */
    var S = { SOON: SOON };
    S.exp = function (expiry) {
        var e = U.day(expiry);
        if (!e) { return { tone: 'good', label: 'Valid', short: 'Valid', icon: 'fa-check', rank: 0, when: 'No expiry', none: true }; }
        var n = U.daysLeft(e);
        if (n < 0) { return { tone: 'bad', label: 'Expired', short: 'Expired', icon: 'fa-times-circle', rank: 3, n: n, when: 'Expired ' + U.fDate(e) }; }
        if (n <= SOON) { return { tone: 'warn', label: n === 0 ? 'Expires today' : 'Expires in ' + U.plural(n, 'day'), short: 'Expiring soon', icon: 'fa-hourglass-half', rank: 2, n: n, when: 'Expires ' + U.fDate(e) }; }
        return { tone: 'good', label: 'Valid', short: 'Valid', icon: 'fa-check', rank: 0, n: n, when: 'Expires ' + U.fDate(e) };
    };
    S.worst = function (list) { return list.reduce(function (a, b) { return b.rank > a.rank ? b : a; }, { tone: 'good', label: 'Valid', icon: 'fa-check', rank: 0 }); };
    /* the figure: "23 days", "16 months", "4 years" */
    S.left = function (n) {
        if (n === null || n === undefined) { return ''; }
        if (n < 0) { return 'Expired'; }
        if (n === 0) { return 'Today'; }
        if (n <= 60) { return U.plural(n, 'day'); }
        var m = Math.floor(n / 30.44);
        return m < 24 ? m + ' months' : Math.floor(m / 12) + ' years';
    };
    /* share of the validity already used, for the meter (3–100 %) */
    S.used = function (start, end) {
        var tot = U.daysBetween(start, end), used = U.daysBetween(start, U.today());
        if (tot === null || used === null || tot <= 0) { return 100; }
        return Math.max(3, Math.min(100, Math.round(used / tot * 100)));
    };
    S.meterTone = function (end) { var n = U.daysLeft(end); return n === null ? '' : n < 0 ? 'bad' : n <= SOON ? 'warn' : ''; };
    return S;
}]);


/* ═══ <lic-docs-bar active="licences|medical|differences|poid"> — the My documents hub page bar ═══ */
app.directive('licDocsBar', ['$rootScope', '$state', 'LicencesV2Data', 'ProfileV2Util', function ($rootScope, $state, LicencesV2Data, U) {
    return {
        restrict: 'E',
        replace: true,
        scope: { active: '@', counts: '=?' },
        templateUrl: 'views/v2/licences/_docs_bar.html',
        link: function (scope) {
            var me = $rootScope.globals.currentUser;
            var tabs = [
                { k: 'licences', ic: 'fa-certificate', t: 'Licences', state: 'dashboard.my_account.licence' },
                { k: 'medical', ic: 'fa-heartbeat', t: 'Medical', state: 'dashboard.my_account.medical' },
                { k: 'differences', ic: 'fa-random', t: 'Differences', state: 'dashboard.my_account.differences' },
                { k: 'poid', ic: 'fa-id-badge', t: 'Proof of ID', state: 'dashboard.my_account.poid' }
            ];
            // Proof of ID is club members only, as today — kept while you're on it (a deep link), so the bar shows where you are
            if (!(me.access && me.access.show_booking) && scope.active !== 'poid') { tabs.pop(); }
            scope.tabs = tabs;
            scope.go = function (t) { if (t.k !== scope.active) { U.go(t.state); } };
            scope.toAccount = function () { U.go('dashboard.my_account'); };   // not "back": <design-back> (no isolate scope) puts its own back() on this scope
            if (!scope.counts) {
                scope.counts = {};
                LicencesV2Data.counts(me).then(function (c) { scope.counts = c || {}; });
            }
        }
    };
}]);


/* ═══ The hub lists: Licences · Medical · Differences ═══ */
app.controller('DocsHubV2Controller', DocsHubV2Controller);
DocsHubV2Controller.$inject = ['$rootScope', '$scope', '$state', '$q', '$timeout', 'LicencesV2Data', 'LicStatus', 'ProfileV2Util', 'LicenceService', 'MedicalService', 'DifferencesService', 'AuthenticationService', 'ToastService', 'MemberChecksV2'];
function DocsHubV2Controller($rootScope, $scope, $state, $q, $timeout, Data, LS, U, LicenceService, MedicalService, DifferencesService, AuthenticationService, ToastService, Checks) {
    var vm = this;
    vm.me = $rootScope.globals.currentUser;
    vm.screen = $state.current.data.screen;      // 'licences' | 'medical' | 'differences'
    vm.U = U; vm.LS = LS;
    vm.loading = true;
    vm.loadError = false;
    vm.refs = { types: [], ratings: [], authority: [], comps: [], diffs: [] };
    vm.licences = []; vm.medicals = []; vm.diffs = { rows: [], images: [] };
    vm.counts = {};
    vm.shown = {};           // 'lic:8' → decrypted thumbnails for this visit
    vm.del = null;           // 'lic:8' while its delete is being confirmed
    vm.dlg = null;           // { t: 'pw', key } | { t: 'view', key, i, imgs, loading }
    vm.flash = null;
    vm.remind = null;        // the reminder note's offsets (from GET reminders/preferences)

    vm.typeOf = function (id) { return Data.byId(vm.refs.types, id) || { abbreviation: '', title: '' }; };
    vm.authOf = function (id) { return Data.byId(vm.refs.authority, id) || { country: '', abbreviation: '' }; };
    vm.ratingOf = function (id) { return Data.byId(vm.refs.ratings, id) || { abbreviation: 'Rating', title: '' }; };
    vm.compOf = function (id) { return Data.byId(vm.refs.comps, id) || { title: 'Medical class', description: '', is_certificate: 1 }; };
    /* a rating's name: the list's own title / abbreviation (contract C6, 8 Nov), else the ratings reference list */
    vm.rName = function (r) { return r.abbreviation || vm.ratingOf(r.rating_id).abbreviation; };
    vm.rTitle = function (r) { return r.title || vm.ratingOf(r.rating_id).title; };
    vm.plural = U.plural;
    vm.go = function (s, p) { U.go(s, p); };
    // differences: unsaved ticks / dates / pages ask before they're thrown away
    if (vm.screen === 'differences') { U.guardLeave($scope, vm, function () { return !!vm.dd && !vm.dSaving && vm.dChanges(vm.flowRef) > 0; }); }
    vm.side = function (kind, i) { return kind === 'card' ? (['Front', 'Ratings page', 'Back'][i] || 'Page ' + (i + 1)) : (['Certificate', 'Second page'][i] || 'Page ' + (i + 1)); };

    load();
    if (U.flash && U.flash.kind === vm.screen) { vm.flash = U.flash.key; U.flash = null; $timeout(function () { vm.flash = null; }, 1800); }
    U.onEscape($scope, function () { if (vm.dlg) { vm.close(); } else if (vm.del) { vm.del = null; } });

    vm.reload = function () { Data.dirty(); Checks.dirty(); load(); };
    function load() {
        vm.loading = true;
        vm.loadError = false;
        $q.all([Data.refs(), Data.load(vm.me, { lic: true, med: true, dif: true, poid: true }), Data.reminders(), Checks.get()]).then(function (r) {
            vm.loading = false;
            vm.refs = r[0];
            vm.ck = r[3];   // each live club's check of these documents (member_checks/v2/mine, C9)
            var x = r[1];
            if (!x.licences || !x.medicals || !x.diffs) { vm.loadError = true; }
            vm.licences = (x.licences || []).map(prepLicence);
            vm.medicals = (x.medicals || []).map(prepMedical);
            vm.diffs = x.diffs || { rows: [], images: [] };
            vm.counts = { licences: vm.licences.length, medical: vm.medicals.length, differences: vm.diffs.rows.length, poid: x.poids ? x.poids.length : 0 };
            vm.remind = reminderLine(r[2]);
            vm.tileList = tiles();
            if (vm.screen === 'differences') { initDiffs(); loadNeeds(); }
        });
    }

    /* ── licences ── */
    function prepLicence(l) {
        l._key = 'lic:' + l.id;
        l._issued = U.day(l.licence_issue_date);
        l._expiry = U.day(l.licence_expiry_date);
        l.ratings = (l.ratings || []).map(function (r) { r._test = U.day(r.test_date); r._expiry = U.day(r.expiry_date); r._st = LS.exp(r._expiry); return r; });
        l.images = l.images || [];
        l._checks = Checks.rows(vm.ck, 'licence', l.id) || [];
        // the card pill: the licence, then its ratings, then the clubs' checks
        var all = [LS.exp(l._expiry)];
        l.ratings.forEach(function (r) { if (r._st.rank >= 2) { all.push({ tone: r._st.tone, icon: r._st.icon, rank: r._st.rank, label: r._st.rank === 3 ? 'Rating expired' : 'Rating ' + r._st.label.toLowerCase() }); } });
        l._st = LS.worst(all.concat(checkStates(l._checks)));
        // the soonest date on the licence → the days-left figure
        var dated = l.ratings.filter(function (r) { return r._expiry; }).map(function (r) { return { what: null, rating: r, start: r._test, end: r._expiry }; });
        if (l._expiry) { dated.push({ what: 'the licence', start: l._issued, end: l._expiry }); }
        dated.sort(function (a, b) { return a.end < b.end ? -1 : 1; });
        l._first = dated[0] || null;
        if (l._first) { l._first.st = LS.exp(l._first.end); }
        return l;
    }
    vm.firstWhat = function (l) { var f = l._first; return !f ? '' : f.what || vm.rName(f.rating); };

    /* ── medicals ── */
    function prepMedical(m) {
        m._key = 'med:' + m.id;
        m._exam = U.day(m.examination_date);
        m.components = (m.components || []).map(function (c) { c._expiry = U.day(c.expiry_date); c._st = LS.exp(c._expiry); return c; });
        m.images = m.images || [];
        m._checks = Checks.rows(vm.ck, 'medical', m.id) || [];
        return m;
    }
    function checkStates(rows) { return (rows || []).map(function (c) { return c.verified ? { tone: 'good', label: 'Valid', icon: 'fa-check', rank: 0 } : { tone: 'pend', label: 'Awaiting club check', icon: 'fa-user-clock', rank: 1 }; }); }
    vm.checkLine = function (c, what) { return U.checkLine(c, 'Not checked yet — they check your ' + what + ' before your next solo booking there'); };
    vm.isCert = function (c) { return +vm.compOf(c.component_id).is_certificate === 1; };
    vm.medCerts = function (m) { return m.components.filter(vm.isCert); };
    vm.medDated = function (m) { return m.components.filter(function (c) { return !vm.isCert(c); }); };
    vm.medStatus = function (m) { return LS.worst(vm.medCerts(m).map(function (c) { return c._st; }).concat(checkStates(m._checks))); };
    vm.medTitle = function (m) { var c = vm.medCerts(m).map(function (x) { return vm.compOf(x.component_id).title; }); return (c.length ? c.join(' · ') : 'Medical') + ' medical'; };
    vm.medWarn = function (m) { return vm.medCerts(m).some(function (c) { return c._st.rank >= 2; }); };
    vm.compRows = function (m) { return vm.medCerts(m).concat(vm.medDated(m)); };

    /* ── summary tiles (licences + medical tabs) ── */
    function tiles() {
        var out = [];
        if (!vm.licences.length && !vm.medicals.length && !vm.diffs.rows.length) { return out; }
        if (!vm.licences.length) { out.push({ tone: 'quiet', ic: 'fa-certificate', k: 'Licence', v: 'Not added', s: 'Add it with its ratings — not needed while you train.', go: vm.screen === 'licences' ? null : 'dashboard.my_account.licence', goL: 'Licences' }); }
        else {
            var l = vm.licences[0], ls = LS.exp(l._expiry);
            out.push({ tone: ls.rank === 3 ? 'bad' : ls.rank === 2 ? 'attn' : 'good', ic: 'fa-certificate', k: 'Licence', v: vm.typeOf(l.licence_id).abbreviation || l.licence_type || 'Licence', s: l._expiry ? ls.when : (U.day(l._issued) ? 'No expiry · issued ' + U.fDate(l._issued) : 'No expiry'), go: vm.screen === 'licences' ? null : 'dashboard.my_account.licence', goL: 'See licence' });
        }
        var rs = [];
        vm.licences.forEach(function (x) { x.ratings.forEach(function (r) { if (r._expiry) { rs.push(r); } }); });
        rs.sort(function (a, b) { return a._expiry < b._expiry ? -1 : 1; });
        if (!rs.length) { out.push({ tone: 'quiet', ic: 'fa-medal', k: 'Ratings', v: 'None yet', s: 'Your class rating and its expiry show here.' }); }
        else {
            var r = rs[0], s = r._st;
            out.push({ tone: s.rank === 3 ? 'bad' : s.rank === 2 ? 'attn' : 'good', ic: 'fa-medal', k: vm.rName(r), v: LS.left(s.n), s: s.rank === 3 ? 'Expired ' + U.fDate(r._expiry) + ' — no solo flying on it until renewed' : 'Left until it expires on ' + U.fDate(r._expiry) });
        }
        var cs = [];
        vm.medicals.forEach(function (m) { vm.medCerts(m).forEach(function (c) { if (c._expiry) { cs.push(c); } }); });
        cs.sort(function (a, b) { return a._expiry < b._expiry ? -1 : 1; });
        if (!cs.length) { out.push({ tone: 'quiet', ic: 'fa-heartbeat', k: 'Medical', v: 'Not added', s: 'Clubs check it before solo flights.', go: vm.screen === 'medical' ? null : 'dashboard.my_account.medical', goL: 'Add medical' }); }
        else {
            var c = cs[0], ms = c._st;
            out.push({ tone: ms.rank === 3 ? 'bad' : ms.rank === 2 ? 'attn' : 'good', ic: 'fa-heartbeat', k: 'Medical · ' + vm.compOf(c.component_id).title, v: LS.left(ms.n), s: (ms.rank === 3 ? 'Expired ' : 'Left until it expires on ') + U.fDate(c._expiry), go: vm.screen === 'medical' ? null : 'dashboard.my_account.medical', goL: 'See medical' });
        }
        // club checks: how many live clubs have checked everything here (member_checks/v2/mine)
        var ck = vm.ck, clubs = ck && ck.success ? (ck.clubs || []) : null;
        if (clubs && clubs.length) {
            var docs = (ck.documents || []).filter(function (d) { return d.check_type === 'licence' || d.check_type === 'medical' || d.check_type === 'differences'; });
            var WORD = { licence: 'licence', medical: 'medical', differences: 'differences' };
            if (!docs.length) { out.push({ tone: 'quiet', ic: 'fa-user-shield', k: 'Club checks', v: 'Nothing yet', s: 'Each club checks what you add here.' }); }
            else {
                var done = 0, waits = [];
                clubs.forEach(function (cl) {
                    var miss = docs.filter(function (d) { return !(ck.checks || []).some(function (x) { return x.check_type === d.check_type && +x.check_id === +d.check_id && +x.club_id === +cl.id && (x.verified === true || +x.verified === 1); }); });
                    if (!miss.length) { done++; return; }
                    var what = miss.map(function (d) { return WORD[d.check_type]; }).filter(function (w, i, a) { return a.indexOf(w) === i; });
                    waits.push({ club: Checks.clubName(cl), what: what.length > 1 ? what.slice(0, -1).join(', ') + ' and ' + what[what.length - 1] : what[0] });
                });
                var same = waits.length > 1 && waits.length === clubs.length && waits.every(function (w) { return w.what === waits[0].what; });
                var txt = !waits.length ? (clubs.length === 1 ? 'Your club has checked everything here.' : 'All your clubs have checked everything here.')
                    : same ? 'None of your clubs has checked your ' + waits[0].what + ' yet.'
                    : waits.map(function (w) { return w.club + ' hasn\'t checked your ' + w.what + ' yet'; }).join('. ') + '.';
                out.push({ tone: waits.length ? 'progress' : 'good', ic: 'fa-user-shield', k: 'Club checks', v: done + ' of ' + clubs.length, s: txt, words: false });
            }
        }
        return out;
    }
    vm.tileList = [];
    vm.tileGo = function (t) { U.go(t.go); };

    function reminderLine(r) {
        if (!r) { return null; }
        if (+r.mute_all_notifications === 1) { return { off: true }; }
        var p = {};
        (r.preferences || []).forEach(function (x) { p[x.reminder_type] = x; });
        function say(type, what) {
            var x = p[type]; if (!x || !+x.enabled) { return null; }
            var o = (x.offsets_days || []).map(Number).sort(function (a, b) { return b - a; });
            var big = o.filter(function (n) { return n > 1; }), extra = [];
            if (o.indexOf(1) > -1) { extra.push('the day before'); }
            if (o.indexOf(0) > -1) { extra.push('on the day'); }
            if (!big.length && !extra.length) { return null; }
            var t = 'We email you ' + (big.length ? big.join(' and ') + ' days before your ' + what + ' expires' : 'when your ' + what + ' is about to expire');
            if (big.length && extra.length) { t += ', ' + extra.join(' and '); }
            else if (!big.length) { t += ' (' + extra.join(' and ') + ')'; }
            return t + '.';
        }
        return { licence: say('rating', 'licence or a rating') || say('licence', 'licence'), medical: say('medical', 'medical') };
    }

    /* ── scans: encrypted; "Show scans" decrypts the thumbnails for this visit (password again after 5 minutes) ── */
    function getOne(key, thumbs, decrypt) {
        var p = key.split(':');
        return (p[0] === 'lic' ? LicenceService : MedicalService).GetById(+p[1], thumbs, decrypt);
    }
    function imagesOf(data) { var rec = data && (data.licence || data.medical); return rec ? (rec.images || []) : []; }
    vm.show = function (key) {
        vm.showing = key;
        getOne(key, 1, 1).then(function (data) {
            vm.showing = null;
            if (data && data.fail === 'templogin') { vm.dlg = { t: 'pw', key: key }; vm.pw = ''; vm.pwErr = null; U.focus('lic-pw', 120); return; }
            if (data && data.success) { vm.shown[key] = imagesOf(data); return; }
            ToastService.error('Scans not shown', 'They could not be opened just now — try again.');
        });
    };
    vm.pwOk = function () {
        if (!vm.pw) { vm.pwErr = 'Enter your password'; U.focus('lic-pw'); return; }
        vm.checking = true;
        var key = vm.dlg.key;
        AuthenticationService.Login3(vm.pw, U.sample(120), function (res) {
            $timeout(function () {
                vm.checking = false;
                if (res && res.success) { vm.dlg = null; vm.pw = ''; ToastService.success('Scans unlocked for this visit', 'They lock again when you leave this page.'); vm.show(key); }
                else if (U.loginDown(res)) { vm.pwErr = 'Your password couldn\'t be checked just now — try again in a moment'; U.focus('lic-pw'); }
                else { vm.pwErr = 'That isn\'t your password — try again'; vm.pw = ''; U.focus('lic-pw'); }
            });
        });
    };
    vm.thumb = function (key, i) { var l = vm.shown[key]; return l && l[i] && /^data:/.test(l[i].data_uri) ? l[i].data_uri : null; };
    vm.view = function (rec, i) {
        var key = rec._key;
        vm.dlg = { t: 'view', key: key, rec: rec, i: i, imgs: null, loading: true };
        getOne(key, 0, 1).then(function (data) {
            if (!vm.dlg || vm.dlg.key !== key) { return; }
            vm.dlg.loading = false;
            if (data && data.fail === 'templogin') { vm.dlg = { t: 'pw', key: key }; vm.pw = ''; U.focus('lic-pw', 120); return; }
            vm.dlg.imgs = imagesOf(data).map(function (im) { return /^data:/.test(im.data_uri) ? im.data_uri : null; });
        });
    };
    vm.viewSrc = function () { var g = vm.dlg; if (!g || g.t !== 'view') { return null; } return (g.imgs && g.imgs[g.i]) || vm.thumb(g.key, g.i); };
    vm.vnav = function (step) { var g = vm.dlg, n = g.rec.images.length; g.i = Math.max(0, Math.min(n - 1, g.i + step)); };
    vm.viewEdge = function (rec) { var st = rec._key.indexOf('lic') === 0 ? rec._st : vm.medStatus(rec); return st.rank === 3 ? 'var(--ta-bad)' : st.rank === 2 ? 'var(--ta-warn)' : 'var(--ta-good)'; };
    vm.close = function () { if (vm.checking) { return; } vm.dlg = null; vm.pw = ''; };
    vm.scrim = function ($event) { if ($event.target === $event.currentTarget) { vm.close(); } };

    /* ── delete in place ── */
    vm.askDel = function (key) { vm.del = key; };
    vm.keep = function () { vm.del = null; };
    vm.delYes = function (rec) {
        var lic = rec._key.indexOf('lic') === 0;
        (lic ? LicenceService : MedicalService).Delete(vm.me.id, rec.id).then(function (data) {
            vm.del = null;
            if (data && data.success) {
                Data.dirty(); Checks.dirty();
                if (lic) { vm.licences = vm.licences.filter(function (x) { return x.id !== rec.id; }); vm.counts.licences = vm.licences.length; }
                else { vm.medicals = vm.medicals.filter(function (x) { return x.id !== rec.id; }); vm.counts.medical = vm.medicals.length; }
                vm.tileList = tiles();
                ToastService.success((lic ? 'Licence' : 'Medical') + ' deleted', 'Your clubs no longer see it.');
            } else {
                ToastService.error('Not deleted', U.msg(data, 'Try again in a moment.'));
            }
        });
    };

    /* ═══ Differences — a checklist of every difference the app knows, saved as one set (PUT user_differences/{user}) ═══ */
    vm.COND = [['day', 'Day', 'fa-sun'], ['night', 'Night', 'fa-moon'], ['vfr', 'VFR', 'fa-eye'], ['ifr', 'IFR', 'fa-cloud']];
    var DIFF_IC = { 1: 'fa-plane-departure', 2: 'fa-fan', 3: 'fa-arrows-alt-v', 4: 'fa-compress-arrows-alt', 5: 'fa-desktop', 6: 'fa-sliders-h', 7: 'fa-wind', 8: 'fa-bolt' };
    vm.diffIc = function (df) { return DIFF_IC[df.id] || 'fa-random'; };
    function on(v) { return v === true || +v === 1; }
    function savedRows() {
        return vm.diffs.rows.map(function (r) {
            return { differences_id: +(r.differences_id || r.id), udid: r.user_difference_id ? +r.user_difference_id : null, sign: U.day(r.sign_off_date), day: on(r.day), night: on(r.night), vfr: on(r.vfr), ifr: on(r.ifr),
                by: String(r.signed_off_by || '').trim() };   // C28: who signed it off (≤100)
        });
    }
    function initDiffs() {
        vm.dSaved = savedRows();
        vm.dd = { rows: angular.copy(vm.dSaved), images: vm.diffs.images.map(function (i) { return { id: i.id, data_uri: i.data_uri }; }) };
        // each saved row's own club checks: member_checks check_id = the row's user_difference_id (C9)
        vm.dCk = {};
        vm.dSaved.forEach(function (r) { vm.dCk[r.differences_id] = r.udid ? (Checks.rows(vm.ck, 'differences', r.udid) || []) : []; });
        vm.dErr = {};
        vm.dOpen = vm.dd.rows.length ? vm.dd.rows[0].differences_id : null;
    }
    // C28 "Needed to fly G-XXXX solo at <club>" — computed once per load (an ng-repeat over a fresh array never settles)
    vm.dNeed = {};
    function loadNeeds() {
        Checks.neededFor().then(function (d) {
            var map = {};
            (vm.refs.diffs || []).forEach(function (df) { var n = Checks.diffNeeds(d, df.id); if (n.length) { map[+df.id] = n; } });
            vm.dNeed = map;
        });
    }
    vm.dRow = function (df) { for (var i = 0; i < vm.dd.rows.length; i++) { if (vm.dd.rows[i].differences_id === +df.id) { return vm.dd.rows[i]; } } return null; };
    vm.dSavedRow = function (df) { for (var i = 0; i < (vm.dSaved || []).length; i++) { if (vm.dSaved[i].differences_id === +df.id) { return vm.dSaved[i]; } } return null; };
    vm.dToggle = function (df) { vm.dOpen = vm.dOpen === +df.id ? null : +df.id; };
    vm.dAdd = function (df) { vm.dd.rows.push({ differences_id: +df.id, sign: '', day: true, night: false, vfr: true, ifr: false, by: '' }); };
    vm.dRemove = function (df) { vm.dd.rows = vm.dd.rows.filter(function (r) { return r.differences_id !== +df.id; }); delete vm.dErr['d' + df.id]; };
    vm.dCond = function (row, k) { row[k] = !row[k]; };
    vm.dConds = function (row) { return vm.COND.filter(function (c) { return row[c[0]]; }); };
    vm.dSub = function (df) {
        var row = vm.dRow(df);
        if (!row) { return 'Not signed off'; }
        if (!row.sign) { return 'Add the date it was signed off'; }
        var by = String(row.by || '').trim();
        return 'Signed off ' + U.fDate(row.sign) + (by ? ' by ' + by : '');
    };
    vm.dIsNew = function (df) { return !!vm.dRow(df) && !vm.dSavedRow(df); };
    vm.dChanged = function (df) {
        var a = vm.dSavedRow(df), b = vm.dRow(df);
        if (!a || !b) { return false; }
        return a.sign !== b.sign || a.day !== b.day || a.night !== b.night || a.vfr !== b.vfr || a.ifr !== b.ifr || (a.by || '') !== String(b.by || '').trim();
    };
    vm.dChanges = function ($flow) {
        if (!vm.dd) { return 0; }
        var n = 0;
        vm.refs.diffs.forEach(function (df) { var a = vm.dSavedRow(df), b = vm.dRow(df); if (!!a !== !!b) { n++; } else if (a && vm.dChanged(df)) { n++; } });
        var keptIds = vm.dd.images.map(function (i) { return i.id; }).join(','), savedIds = vm.diffs.images.map(function (i) { return i.id; }).join(',');
        if (keptIds !== savedIds) { n++; }
        if ($flow && $flow.files.length) { n++; }
        return n;
    };
    vm.dSignedCount = function () { return vm.dd ? vm.dd.rows.length : 0; };
    vm.dImgDel = function (img) { vm.dd.images = vm.dd.images.filter(function (i) { return i.id !== img.id; }); };
    vm.dUpDel = function (file) { var path = U.flowPath(file); file.cancel(); if (path) { LicenceService.DeleteTmp(path); } };
    vm.flowAdded = U.imageOnly;
    vm.uploading = U.upBusy;
    vm.flowFailed = U.upFailed;
    vm.pct = U.upPct;
    vm.dUndo = function ($flow) {
        if ($flow) { $flow.files.slice().forEach(function (f) { vm.dUpDel(f); }); }
        initDiffs();
        ToastService.success('Changes undone', 'Your differences are as they were saved.');
    };
    vm.dSave = function ($flow) {
        var er = {}, first = null;
        vm.dd.rows.forEach(function (r) { if (!r.sign) { er['d' + r.differences_id] = 'Pick the sign-off date'; if (first === null) { first = r.differences_id; } } else if (U.daysLeft(r.sign) > 0) { er['d' + r.differences_id] = 'That date is in the future'; if (first === null) { first = r.differences_id; } } });
        var files = ($flow && $flow.files) || [];
        if (vm.dd.rows.length && !vm.dd.images.length && !files.length) { er.scans = 'Add a photo of the differences page in your logbook'; }
        else if (U.upBad($flow)) { er.scans = 'A photo didn\'t upload — remove it (×) and add it again'; }
        else if (vm.uploading($flow)) { er.scans = 'Wait for the upload to finish'; }
        vm.dErr = er;
        var ks = Object.keys(er);
        if (ks.length) { if (first !== null) { vm.dOpen = first; } ToastService.warning('Check the highlighted fields', er[ks[0]]); U.scrollToError(); return; }
        var body = {
            user_id: vm.me.id,
            differences: vm.dd.rows.map(function (r) { return { id: r.differences_id, differences_id: r.differences_id, sign_off_date: r.sign, day: r.day ? 1 : 0, night: r.night ? 1 : 0, vfr: r.vfr ? 1 : 0, ifr: r.ifr ? 1 : 0,
                signed_off_by: String(r.by || '').trim().slice(0, 100) }; }),
            images: vm.dd.images.map(function (i) { return { id: i.id }; }).concat(files.map(function (f) { return { temp_path: U.flowPath(f), name: f.name }; }).filter(function (x) { return x.temp_path; }))
        };
        vm.dSaving = true;
        DifferencesService.Update(body).then(function (data) {
            vm.dSaving = false;
            if (data && data.success) {
                Data.dirty(); Checks.dirty();
                if ($flow) { $flow.cancel(); }
                ToastService.success('Differences saved', 'Your clubs will check them.');
                DifferencesService.GetByUserId(vm.me.id).then(function (d) {
                    if (d && d.success && d.differences) { vm.diffs = { rows: d.differences.differences || [], images: d.differences.images || [] }; }
                    vm.counts.differences = vm.diffs.rows.length;
                    initDiffs();
                    Checks.get().then(function (c) { vm.ck = c; initDiffs(); vm.dOpen = null; });
                    vm.dOpen = null;
                });
            } else if (data && data.error === 'INVALID_UPLOAD') {
                vm.dErr = { scans: 'One of the photos didn\'t upload properly — remove it and add it again.' };
                ToastService.error('Not saved', vm.dErr.scans); U.scrollToError();
            } else {
                ToastService.error('Not saved', U.msg(data, 'Try again in a moment.'));
            }
        });
    };
    vm.dChecksOf = function (df) { return (vm.dCk && vm.dCk[+df.id]) || []; };
    vm.dAllChecked = function (df) { var c = vm.dChecksOf(df); return c.length > 0 && c.every(function (x) { return x.verified; }); };
    vm.dpOptions = { shortcuts: false, dots: false, max: U.today() };
    vm.clearD = function (df) { delete vm.dErr['d' + df.id]; };
}


/* ═══ Add / edit a licence or a medical — pages reached from the hub, with Back and a fixed action bar ═══ */
app.controller('DocFormV2Controller', DocFormV2Controller);
DocFormV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$q', '$timeout', 'LicencesV2Data', 'LicStatus', 'ProfileV2Util', 'LicenceService', 'MedicalService', 'AuthenticationService', 'ToastService', 'MemberChecksV2'];
function DocFormV2Controller($rootScope, $scope, $state, $stateParams, $q, $timeout, Data, LS, U, LicenceService, MedicalService, AuthenticationService, ToastService, Checks) {
    var vm = this;
    vm.me = $rootScope.globals.currentUser;
    vm.kind = $state.current.data.kind;          // 'licence' | 'medical'
    vm.action = $state.current.data.action;      // 'add' | 'edit'
    vm.lic = vm.kind === 'licence';
    vm.U = U;
    vm.loading = true;
    vm.errs = {};
    vm.refs = { types: [], ratings: [], authority: [], comps: [] };
    vm.add = { id: '' };
    vm.shown = null;         // decrypted thumbnails of the saved scans
    vm.dlg = null;
    vm.pastOptions = { shortcuts: false, dots: false, max: U.today() };
    vm.anyOptions = { shortcuts: false, dots: false };
    var Svc = vm.lic ? LicenceService : MedicalService;
    var recId = vm.lic ? $stateParams.licence_id : $stateParams.medical_id;

    vm.ratingOf = function (id) { return Data.byId(vm.refs.ratings, id) || { abbreviation: 'Rating', title: '' }; };
    vm.compOf = function (id) { return Data.byId(vm.refs.comps, id) || { title: 'Class', description: '', is_certificate: 1 }; };
    vm.typeOf = function (id) { return Data.byId(vm.refs.types, id) || { abbreviation: '', title: '' }; };
    vm.clearErr = function (k) { if (vm.errs[k]) { delete vm.errs[k]; } };
    vm.go = function (s, p) { U.go(s, p); };
    vm.errCount = function () { return Object.keys(vm.errs).length; };

    U.onEscape($scope, function () { vm.close(); });
    // ng-repeat stamps $$hashKey and the date picker may turn '' into null — neither is a change
    function fSnap(f) { return f ? JSON.stringify(f, function (k, v) { return k.indexOf('$$') === 0 ? undefined : (v === null || v === undefined ? '' : v); }) : ''; }
    U.guardLeave($scope, vm, function () {
        return !vm.loading && !vm.loadError && !!vm.f && ((vm.flowRef && vm.flowRef.files.length > 0) || fSnap(vm.f) !== vm.f0 || !!vm.add.id);
    });
    vm.clubsHtml = 'your clubs';
    Checks.get().then(function (d) { vm.clubNames = Checks.names(d); vm.clubsHtml = Checks.namesHtml(d); });

    $q.all([Data.refs(), vm.action === 'edit' ? Svc.GetById(recId, 1, 0) : $q.when(null)]).then(function (r) {
        vm.refs = r[0];
        vm.loading = false;
        if (vm.action === 'edit') {
            var rec = r[1] && (r[1].licence || r[1].medical);
            if (!r[1] || !r[1].success || !rec) { vm.loadError = true; return; }
            vm.f = vm.lic ? {
                id: rec.id, licence_id: rec.licence_id ? +rec.licence_id : '', authority_id: rec.authority_id ? +rec.authority_id : '', licence_number: rec.licence_number || '',
                issued: U.day(rec.licence_issue_date), expiry: U.day(rec.licence_expiry_date), noExpiry: !U.day(rec.licence_expiry_date),
                ratings: (rec.ratings || []).map(function (x) { return { id: +x.rating_id, test: U.day(x.test_date), expiry: U.day(x.expiry_date) }; }),
                images: (rec.images || []).map(function (i) { return { id: i.id }; })
            } : {
                id: rec.id, authority_id: rec.authority_id ? +rec.authority_id : '', certificate_number: rec.certificate_number || '', exam: U.day(rec.examination_date),
                limitations: rec.limitations || '',
                comps: (rec.components || []).map(function (x) { return { id: +x.component_id, expiry: U.day(x.expiry_date) }; }),
                images: (rec.images || []).map(function (i) { return { id: i.id }; })
            };
        } else {
            vm.f = vm.lic
                ? { licence_id: '', authority_id: '', licence_number: '', issued: '', expiry: '', noExpiry: false, ratings: [{ id: 7, test: '', expiry: '' }], images: [] }   // SEP (land) pre-added, as today
                : { authority_id: '', certificate_number: '', exam: '', limitations: '', comps: [], images: [] };
        }
        vm.f0 = fSnap(vm.f);
    });

    vm.availRatings = function () { return vm.refs.ratings.filter(function (r) { return !(vm.f && vm.f.ratings.some(function (x) { return x.id === +r.id; })); }); };
    vm.availComps = function () { return vm.refs.comps.filter(function (c) { return !(vm.f && vm.f.comps.some(function (x) { return x.id === +c.id; })); }); };
    vm.addRow = function () {
        if (!vm.add.id) { return; }
        if (vm.lic) { vm.f.ratings.push({ id: +vm.add.id, test: '', expiry: '' }); vm.clearErr('ratings'); }
        else { vm.f.comps.push({ id: +vm.add.id, expiry: '' }); vm.clearErr('comps'); }
        vm.add.id = '';
    };
    vm.delRow = function (i) {
        (vm.lic ? vm.f.ratings : vm.f.comps).splice(i, 1);
        Object.keys(vm.errs).forEach(function (k) { if (/^(r|c)\d/.test(k)) { delete vm.errs[k]; } });
    };
    vm.noExp = function () { if (vm.f.noExpiry) { vm.f.expiry = ''; } vm.clearErr('expiry'); };

    /* scans — a photo or a PDF (12 Nov 2026: upload.php turns each page of a PDF into its own scan) */
    vm.flowAdded = U.docOnly;
    vm.flowDone = U.upDone;
    vm.uploading = U.upBusy;
    vm.flowFailed = U.upFailed;
    vm.pct = U.upPct;
    vm.imgDel = function (img) { vm.f.images = vm.f.images.filter(function (i) { return i.id !== img.id; }); };
    vm.upDel = function (file) { var paths = U.flowPaths(file); file.cancel(); paths.forEach(function (p) { Svc.DeleteTmp(p); }); };
    vm.side = function (i) { return vm.lic ? (['Front', 'Ratings page', 'Back'][i] || 'Page ' + (i + 1)) : (['Certificate', 'Second page'][i] || 'Page ' + (i + 1)); };
    vm.savedThumb = function (img) { var l = vm.shown || []; for (var i = 0; i < l.length; i++) { if (l[i].id === img.id && /^data:/.test(l[i].data_uri)) { return l[i].data_uri; } } return null; };
    vm.show = function () {
        vm.showing = true;
        Svc.GetById(vm.f.id, 1, 1).then(function (data) {
            vm.showing = false;
            if (data && data.fail === 'templogin') { vm.dlg = 'pw'; vm.pw = ''; vm.pwErr = null; U.focus('lic-pw', 120); return; }
            var rec = data && (data.licence || data.medical);
            if (data && data.success && rec) { vm.shown = rec.images || []; return; }
            ToastService.error('Scans not shown', 'They could not be opened just now — try again.');
        });
    };
    vm.pwOk = function () {
        if (!vm.pw) { vm.pwErr = 'Enter your password'; U.focus('lic-pw'); return; }
        vm.checking = true;
        AuthenticationService.Login3(vm.pw, U.sample(120), function (res) {
            $timeout(function () {
                vm.checking = false;
                if (res && res.success) { vm.dlg = null; vm.pw = ''; vm.show(); }
                else if (U.loginDown(res)) { vm.pwErr = 'Your password couldn\'t be checked just now — try again in a moment'; U.focus('lic-pw'); }
                else { vm.pwErr = 'That isn\'t your password — try again'; vm.pw = ''; U.focus('lic-pw'); }
            });
        });
    };
    vm.close = function () { if (vm.checking) { return; } vm.dlg = null; vm.pw = ''; };
    vm.scrim = function ($event) { if ($event.target === $event.currentTarget) { vm.close(); } };

    function validate($flow) {
        var f = vm.f, er = {}, today = U.today(), files = ($flow && $flow.files) || [];
        if (vm.lic) {
            if (!f.licence_id) { er.type = 'Choose the licence type'; }
            if (!f.authority_id) { er.authority = 'Choose the country that issued it'; }
            if (!String(f.licence_number || '').trim()) { er.number = 'Enter the licence number'; }
            if (!f.issued) { er.issued = 'Pick the date it was issued'; } else if (f.issued > today) { er.issued = 'That date is in the future'; }
            if (!f.noExpiry && !f.expiry) { er.expiry = 'Pick the expiry date, or tick “It doesn\'t expire”'; }
            else if (!f.noExpiry && f.issued && f.expiry <= f.issued) { er.expiry = 'It can\'t expire before it was issued'; }
            if (!f.ratings.length) { er.ratings = 'Add at least one rating — usually SEP (land)'; }
            f.ratings.forEach(function (r, i) {
                if (!r.test) { er['r' + i + 'test'] = 'Pick the test date'; } else if (r.test > today) { er['r' + i + 'test'] = 'That date is in the future'; }
                if (!r.expiry) { er['r' + i + 'exp'] = 'Pick the expiry date'; } else if (r.test && r.expiry <= r.test) { er['r' + i + 'exp'] = 'It can\'t expire before the test'; }
            });
        } else {
            if (!f.authority_id) { er.authority = 'Choose the country that issued it'; }
            if (!String(f.certificate_number || '').trim()) { er.number = 'Enter the certificate number'; }
            if (!f.exam) { er.exam = 'Pick the examination date'; } else if (f.exam > today) { er.exam = 'That date is in the future'; }
            if (String(f.limitations || '').trim().length > 120) { er.limitations = 'Keep it to 120 characters — the codes as printed, such as VML'; }
            if (!f.comps.length) { er.comps = 'Add at least one class, such as Class 2'; }
            f.comps.forEach(function (c, i) { if (!c.expiry) { er['c' + i] = +vm.compOf(c.id).is_certificate === 1 ? 'Pick the expiry date' : 'Pick the date it was done'; } });
        }
        if (!f.images.length && !files.length) { er.scans = vm.lic ? 'Add at least one scan of your licence' : 'Add at least one scan of your certificate'; }
        else if (U.upBad($flow)) { er.scans = 'A scan didn\'t upload — remove it (×) and add it again'; }
        else if (vm.uploading($flow)) { er.scans = 'Wait for the upload to finish'; }
        return er;
    }

    vm.save = function ($flow) {
        if (vm.saving) { return; }
        vm.errs = validate($flow);
        var ks = Object.keys(vm.errs);
        if (ks.length) { ToastService.warning('Check the highlighted fields', vm.errs[ks[0]]); U.scrollToError(); return; }
        var f = vm.f, files = ($flow && $flow.files) || [];
        var images = f.images.map(function (i) { return { id: i.id }; }).concat(U.stagedImages(files));
        var body = vm.lic ? {
            licence_id: +f.licence_id, authority_id: +f.authority_id, licence_number: String(f.licence_number).trim(),
            licence_issue_date: f.issued, licence_expiry_date: f.noExpiry ? '' : f.expiry,
            ratings: f.ratings.map(function (r) { return { id: r.id, test_date: r.test, expiry_date: r.expiry }; }),
            images: images, user_id: vm.me.id
        } : {
            authority_id: +f.authority_id, certificate_number: String(f.certificate_number).trim(), examination_date: f.exam,
            limitations: String(f.limitations || '').trim(),      // C28: codes printed on the certificate (≤120), '' = none
            components: f.comps.map(function (c) { return { id: c.id, expiry_date: c.expiry }; }),
            images: images, user_id: vm.me.id
        };
        if (f.id) { body.id = f.id; }
        vm.saving = true;
        (f.id ? Svc.Update(body) : Svc.Create(body)).then(function (data) {
            vm.saving = false;
            if (data && data.success) {
                Data.dirty(); Checks.dirty();
                U.flash = { kind: vm.lic ? 'licences' : 'medical', key: data.id ? (vm.lic ? 'lic:' : 'med:') + data.id : null };
                ToastService.success((vm.lic ? 'Licence' : 'Medical') + (f.id ? ' updated' : ' added'), 'Your clubs will check it.');
                vm.leaveOk = true;
                U.go(vm.lic ? 'dashboard.my_account.licence' : 'dashboard.my_account.medical');
                return;
            }
            var msg = U.msg(data, '');
            if (data && data.error === 'VALIDATION_ERROR' && angular.isArray(data.fields) && data.fields.indexOf('limitations') > -1) {
                vm.errs.limitations = 'Keep it to 120 characters — the codes as printed, such as VML'; ToastService.error('Not saved', vm.errs.limitations); U.scrollToError(); return;
            }
            if (data && data.error === 'VALIDATION_ERROR') {
                if (/expiry/i.test(msg)) { vm.errs.expiry = msg; } else if (/issue/i.test(msg)) { vm.errs.issued = msg; } else if (/exam/i.test(msg)) { vm.errs.exam = msg; }
                ToastService.error('Not saved', msg || 'Check the dates.'); U.scrollToError(); return;
            }
            if (/examination_date/.test(msg)) { vm.errs.exam = 'That isn\'t a valid date.'; ToastService.error('Not saved', vm.errs.exam); U.scrollToError(); return; }
            if (data && data.error === 'INVALID_UPLOAD') { vm.errs.scans = 'One of the scans didn\'t upload properly — remove it and add it again.'; ToastService.error('Not saved', vm.errs.scans); U.scrollToError(); return; }
            ToastService.error('Not saved', msg || 'Try again in a moment.');
        });
    };
}
