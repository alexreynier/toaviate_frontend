/* ═══════════════════════════════════════════════════════════════════════════
   v2 screen: documents — design: mockups/my-account/vouchers-documents.html (approved 7 Nov 2026)
   Club documents hub (Documents · Price list) and My vouchers (+ Book your flight).

   v1 it replaces:  dashboard.my_account.all_documents  (views/my_account/all_documents.html, AllDocumentsController)
                    dashboard.my_account.all_prices     (views/my_account/all_prices.html,    AllDocumentsController)
                    dashboard.my_account.my_vouchers    (views/my_account/my_vouchers.html,   MyVouchersController)
   Same server calls as v1: plane_documents/get_all_from_user/{user}, club_documents/show_file/{file},
   vouchers/my_vouchers_all, vouchers/voucher_slots/{id}/{from}/{days}, vouchers/book, vouchers/cancel_booking/{id}.
   Views: views/v2/documents/*.html · CSS: css/v2/documents.css (page prefix vd-, tokens only).

   C20 (be-alex-3e, 9 Nov) reads: clubs[].my_membership → "Your membership" (price card line + pill on that tier),
   planes[].aircraft_colour (bg_colour, else colour) → aircraft edges, vouchers' experience_description → "what it
   covers", flight.plane.colour / flight.instructor.colour on used vouchers. The club's home airfield comes from
   airfields/{base_airfield_id}. experience_booking_duration isn't drawn (the experience title carries the length).
   "New" / "New version" pills compare against this browser's last visit (localStorage), as the mockup proposes.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.all_documents', {
            url: '/my_account/all_documents',
            templateUrl: 'views/v2/documents/club_docs.html',
            controller: 'ClubDocsV2Controller', controllerAs: 'vm',
            data: { page: 'documents' }
        })
        .state('dashboard.v2.all_prices', {
            url: '/my_account/price_list',
            templateUrl: 'views/v2/documents/club_docs.html',
            controller: 'ClubDocsV2Controller', controllerAs: 'vm',
            data: { page: 'prices' }
        })
        .state('dashboard.v2.my_vouchers', {
            url: '/my_account/my_vouchers',
            templateUrl: 'views/v2/documents/vouchers.html',
            controller: 'VouchersV2Controller', controllerAs: 'vm',
            data: { page: 'list' }
        })
        // v2 only: in v1 the slot search swaps views inside my_vouchers; here it is a page with ← My vouchers.
        .state('dashboard.v2.voucher_book', {
            url: '/my_account/my_vouchers/:voucher_id/book',
            templateUrl: 'views/v2/documents/voucher_book.html',
            controller: 'VouchersV2Controller', controllerAs: 'vm',
            data: { page: 'book' }
        });
    DesignRoutesProvider
        .map('dashboard.my_account.all_documents', 'dashboard.v2.all_documents')
        .map('dashboard.my_account.all_prices', 'dashboard.v2.all_prices')
        .map('dashboard.my_account.my_vouchers', 'dashboard.v2.my_vouchers')
        .classic('dashboard.v2.voucher_book', 'dashboard.my_account.my_vouchers');   // v2-only page: classic = My vouchers
}]);

/* ═════ shared formatting for this screen (one helper per domain — no raw value reaches the page) ═════ */
app.factory('VdV2Fmt', function () {
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var SYM = { GBP: '£', EUR: '€', USD: '$' };
    var f = {};
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    // Parses the API's wall-clock "YYYY-MM-DD[ HH:MM[:SS]]" without any timezone shift.
    f.pd = function (s) {
        if (!s || String(s).indexOf('0000-00-00') === 0) { return null; }
        var p = String(s).replace('T', ' ').split(' '), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    };
    f.ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    f.stamp = function (d) { return f.ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
    f.today = function () { return f.ymd(new Date()); };
    f.addDays = function (s, n) { var d = f.pd(s); d.setDate(d.getDate() + n); return f.ymd(d); };
    f.daysBetween = function (a, b) { var x = f.pd(a), y = f.pd(b); if (!x || !y) { return 0; } return Math.round((y - x) / 86400000); };
    f.fDate = function (s) { var d = f.pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    f.fDay = function (s) { var d = f.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
    f.fDayLong = function (s) { var d = f.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    f.fTime = function (s) { var t = String(s || '').replace('T', ' ').split(' ')[1] || String(s || ''); return /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5) : ''; };
    f.num = function (x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; };     // API decimals arrive as strings
    f.money = function (x, cur) {
        var n = f.num(x), sym = SYM[cur || 'GBP'];
        var s = Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (n < 0 ? '−' : '') + (sym != null ? sym : (cur ? cur + ' ' : '£')) + s;
    };
    f.hm = function (minutes) { var m = Math.round(f.num(minutes)); return Math.floor(m / 60) + ':' + pad(m % 60); };
    f.plural = function (n, w, many) { return n + ' ' + (n === 1 ? w : (many || w + 's')); };
    f.codeGroups = function (c) { return String(c || '').replace(/(.{4})(?=.)/g, '$1 '); };
    f.has = function (str, q) { return String(str || '').toLowerCase().indexOf(q) > -1; };
    f.trim = function (s) { return String(s == null ? '' : s).replace(/\s+$/, '').replace(/^\s+/, ''); };
    // a server message fit to show: a short sentence, never an HTML error page or an object
    f.msg = function (data) { if (data && data.status != null && (+data.status <= 0 || +data.status >= 500)) { return ''; }   // a server / connection failure body is never a sentence for the member
        var m = data && data.message; if (m && typeof m === 'object') { m = m.message; } return (typeof m === 'string' && m && !/^\s*</.test(m) && m.length < 300) ? m : ''; };

    // file types (the API answers application/octet-stream, so the type comes from the file name)
    var FT = {
        pdf: { k: 'pdf', ic: 'fa-file-pdf', label: 'PDF', mime: 'application/pdf', view: true },
        doc: { k: 'doc', ic: 'fa-file-word', label: 'Word document', mime: 'application/msword' },
        xls: { k: 'xls', ic: 'fa-file-excel', label: 'Spreadsheet', mime: 'application/vnd.ms-excel' },
        ppt: { k: 'ppt', ic: 'fa-file-powerpoint', label: 'Presentation', mime: 'application/vnd.ms-powerpoint' },
        img: { k: 'img', ic: 'fa-file-image', label: 'Image', mime: 'image/*', view: true },
        zip: { k: 'zip', ic: 'fa-file-archive', label: 'Zip archive', mime: 'application/zip' },
        vid: { k: 'vid', ic: 'fa-file-video', label: 'Video', mime: 'video/mp4', view: true },
        file: { k: 'file', ic: 'fa-file', label: 'File', mime: 'application/octet-stream' }
    };
    var IMG = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
    f.fileType = function (name) {
        var ext = String(name || '').split('.').pop().toLowerCase();
        if (ext === 'pdf') { return FT.pdf; }
        if (/^docx?$/.test(ext)) { return FT.doc; }
        if (/^(xlsx?|csv)$/.test(ext)) { return FT.xls; }
        if (/^pptx?$/.test(ext)) { return FT.ppt; }
        if (IMG[ext]) { return angular.extend({}, FT.img, { mime: IMG[ext] }); }
        if (ext === 'zip') { return FT.zip; }
        if (/^(mp4|avi|mov)$/.test(ext)) { return FT.vid; }
        return FT.file;
    };
    f.ext = function (name) { var p = String(name || '').split('.'); return p.length > 1 ? p.pop().toLowerCase() : ''; };

    // charging basis — the invoice PDF's own words (flightChargeTimes.js EXPLAIN, shortened)
    var BASIS = {
        airborne_plus_allowance: { s: 'Airborne + taxi allowance', x: 'airborne time (first take-off to last landing, rounded to 5 minutes) plus a taxi allowance, so it can differ from your brakes off to brakes on.' },
        flight_rounded: { s: 'Airborne time', x: 'first take-off to last landing, rounded to the nearest 5 minutes.' },
        flight_exact: { s: 'Airborne time, to the minute', x: 'first take-off to last landing, to the minute.' },
        airborne_actual: { s: 'Tracker airborne time', x: 'your airborne time as recorded by the aircraft tracker, to the minute.' },
        brakes_rounded: { s: 'Brakes off to on', x: 'brakes off to brakes on, rounded to the nearest 5 minutes.' },
        brakes_exact: { s: 'Brakes off to on, to the minute', x: 'your actual brakes off to brakes on time, to the minute.' },
        tacho: { s: 'Tacho reading', x: 'the aircraft\'s tacho reading, not clock time.' },
        hobbs: { s: 'Hobbs reading', x: 'the aircraft\'s hobbs reading, not clock time.' }
    };
    BASIS.airborne = BASIS.flight_rounded; BASIS.brakes = BASIS.brakes_rounded; BASIS.flight = BASIS.brakes_rounded;
    f.basis = function (t) { return BASIS[t] || BASIS.tacho; };
    f.basisKey = function (t) { return BASIS[t] ? t : 'tacho'; };
    var LESSON = { brakes: 'Per hour, brakes off to brakes on', plane: 'Per hour, the same time as the aircraft', session: 'Per session' };
    f.lessonCharge = function (t) { return LESSON[t] || 'Per hour'; };
    var TERM = { free: 'Free', daily: 'Per day', weekly: 'Per week', monthly: 'Per month', quarterly: 'Per quarter', annually: 'Per year', yearly: 'Per year', once: 'One-off (lifetime)', lifetime: 'One-off (lifetime)' };
    f.term = function (t) { return TERM[t] || (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : ''); };
    var SURCHARGE = { flight: 'per flight', hour: 'per hour', taxi: 'per taxi' };
    f.surcharge = function (t) { return SURCHARGE[t] || ''; };

    // voucher status — never a raw value on screen
    f.vStatus = function (v) {
        if (+v.flight_completed) { return { k: 'used', tone: 'muted', ic: 'fa-check-double', label: 'Used' }; }
        if (v.booking) {
            if (f.hoursUntil(v.booking.start) < 0) { return { k: 'flown', tone: 'info', ic: 'fa-hourglass-half', label: 'Awaiting sign-off' }; }
            return { k: 'booked', tone: 'good', ic: 'fa-calendar-check', label: 'Booked' };
        }
        if (+v.redeemed) { return { k: 'used', tone: 'muted', ic: 'fa-check-double', label: 'Used', byClub: true }; }
        if (v.expiry_date && v.expiry_date < f.today()) { return { k: 'expired', tone: 'bad', ic: 'fa-times-circle', label: 'Expired' }; }
        return { k: 'ready', tone: 'info', ic: 'fa-gift', label: 'Ready to use' };
    };
    f.hoursUntil = function (dt) { var d = f.pd(dt); return d ? (d - new Date()) / 3600000 : 0; };
    f.leftText = function (n) { return n <= 0 ? 'Last day to book' : f.plural(n, 'day') + ' left to book'; };
    return f;
});

/* ═════ Club documents hub: Documents + Price list (one controller, like v1's AllDocumentsController) ═════ */
app.controller('ClubDocsV2Controller', ClubDocsV2Controller);
ClubDocsV2Controller.$inject = ['$rootScope', '$scope', '$state', '$http', '$window', '$timeout', 'ClubDocumentService', 'BookoutService', 'ToastService', 'VdV2Fmt'];
function ClubDocsV2Controller($rootScope, $scope, $state, $http, $window, $timeout, ClubDocumentService, BookoutService, ToastService, VdV2Fmt) {
    var vm = this, F = VdV2Fmt;
    var SEEN_KEY = 'toaviate_v2_docs_seen';     // { last: 'YYYY-MM-DD HH:MM:SS', ids: { key: 1 } } — per browser
    var SCOPE_KEY = 'toaviate_v2_docs_club';    // remembered club scope (both tabs)

    vm.F = F;
    vm.user = $rootScope.globals.currentUser;
    vm.page = ($state.current.data && $state.current.data.page) || 'documents';
    vm.loading = true;
    vm.error = '';
    vm.clubs = [];
    vm.q = '';
    vm.club = readLocal(SCOPE_KEY) || 'all';
    vm.seen = readSeen();
    vm.view = { cards: [], changed: [], total: 0 };

    vm.go = function (state, params) { $state.go(state, params || {}); };
    vm.setClub = function (id) { vm.club = id; writeLocal(SCOPE_KEY, id); vm.recompute(); };
    vm.clearQ = function () { vm.q = ''; vm.recompute(); };
    vm.recompute = recompute;
    vm.viewDoc = viewDoc;
    vm.downloadDoc = downloadDoc;
    // a search that finds no document but looks like a registration (G-BMTJ, N12345…): its paperwork is on Aircraft status
    vm.regLike = function () { var q = F.trim(vm.q).toUpperCase(); return /^[A-Z0-9]{1,2}-?[A-Z0-9]{2,5}$/.test(q) && /\d|-/.test(q) ? q : ''; };
    vm.aircraftStatus = function () {
        var reg = vm.regLike();
        if (reg) { vm.go('dashboard.my_account.aircraft_status2', { registration: reg }); } else { vm.go('dashboard.my_account.aircraft_status'); }
    };
    vm.markAllSeen = markAllSeen;
    vm.reload = load;

    load();

    function load() {
        vm.loading = true; vm.error = '';
        ClubDocumentService.GetByUserId(vm.user.id).then(function (data) {
            vm.loading = false;
            if (!data || data.success === false || !angular.isArray(data.clubs)) {
                vm.error = 'Your clubs\' documents couldn\'t be loaded. Check your connection and try again.';
                return;
            }
            vm.clubs = data.clubs.map(normaliseClub);
            // the club's home airfield (ICAO + name) for the club headers and the landing-fee line
            var byAf = {};
            vm.clubs.forEach(function (c) { if (c.airfieldId) { (byAf[c.airfieldId] = byAf[c.airfieldId] || []).push(c); } });
            Object.keys(byAf).forEach(function (id) {
                BookoutService.GetAirfieldById(id).then(function (d) {
                    var a = d && d.success !== false && d.airfield;
                    if (!a) { return; }
                    byAf[id].forEach(function (c) { c.icao = a.code || ''; c.airfield = F.trim(a.title); });
                });
            });
            if (vm.club !== 'all' && !vm.clubs.some(function (c) { return String(c.id) === String(vm.club); })) { vm.club = 'all'; }
            recompute();
        });
    }

    function normaliseClub(c) {
        var club = {
            id: c.id, title: F.trim(c.title), currency: c.currency || c.account_currency || 'GBP', airfieldId: +c.base_airfield_id || 0, icao: '', airfield: '',
            vat: +c.vat_registered === 1 && F.num(c.vat_rate) > 0, vatRate: F.num(c.vat_rate),
            terms: [], docs: [], planes: [], instruction: [], memberships: []
        };
        // the three terms documents v1 appends to the club's documents when they are set
        if (c.membership_terms) { club.terms.push(mkDoc(club, 'm', 'Membership terms & conditions', 'What your membership includes and how it renews', c.membership_terms, c.membership_updated, c.membership_updated, true)); }
        if (c.privacy_terms) { club.terms.push(mkDoc(club, 'p', 'Privacy terms', 'How the club uses and keeps your personal data', c.privacy_terms, c.privacy_updated, c.privacy_updated, true)); }
        if (c.passenger_terms) { club.terms.push(mkDoc(club, 'x', 'Passenger terms & conditions', 'For anyone you take flying', c.passenger_terms, c.passenger_updated, c.passenger_updated, true)); }
        (c.documents || []).forEach(function (d) { club.docs.push(mkDoc(club, d.id, d.title, d.description, d.document, d.updated_at, d.created_at, false)); });
        (c.planes || []).forEach(function (p) {
            var ch = p.charges || {}, none = !F.num(ch.charge_rate_unit), sur = ch.surcharge_type && ch.surcharge_type !== 'none' && F.num(ch.surcharge_fee) > 0;
            club.planes.push({
                registration: p.registration, type: p.plane_type || '', model: p.type_name && p.type_name !== p.plane_type ? p.type_name : (p.manufacturer || ''),
                colour: p.aircraft_colour || p.bg_colour || p.colour || '', none: none, basisKey: F.basisKey(ch.charge_type), basis: F.basis(ch.charge_type).s,   // colour: C20 rule, bg_colour first
                rate: F.num(ch.charge_rate_unit), landing: F.num(ch.landing_fee), tg: F.num(ch.touch_and_go_fee),
                sur: sur, surFee: F.num(ch.surcharge_fee), surUnit: F.surcharge(ch.surcharge_type)
            });
        });
        (c.instruction || []).forEach(function (x) { club.instruction.push({ title: x.title, charge: F.lessonCharge(x.charge_type), price: F.num(x.price) }); });
        // C20: the member's own tier here (often not joinable, so maybe not in memberships[])
        club.myMem = c.my_membership && c.my_membership.name ? { id: +c.my_membership.membership_id || 0, name: F.trim(c.my_membership.name) } : null;
        (c.memberships || []).forEach(function (x) {
            club.memberships.push({ name: x.membership_name, term: F.term(x.payment_term), free: x.payment_term === 'free' || !F.num(x.price), price: F.num(x.price), currency: x.currency || club.currency,
                mine: !!club.myMem && (club.myMem.id ? +x.membership_id === club.myMem.id : F.trim(x.membership_name) === club.myMem.name) });
        });
        return club;
    }

    function mkDoc(club, id, title, description, file, updated, created, isTerms) {
        var ft = F.fileType(file);
        return { key: club.id + ':' + id + ':' + (updated || ''), id: id, club: club, title: F.trim(title) || 'Untitled document', description: F.trim(description),
            file: file || '', ft: ft, updated: F.pd(updated) ? updated : (F.pd(created) ? created : null), created: created, terms: isTerms };
    }

    function fresh(d) {
        if (!vm.seen.last || vm.seen.ids[d.key]) { return null; }
        if (!d.terms && F.pd(d.created) && d.created > vm.seen.last) { return 'new'; }
        if (d.updated && d.updated > vm.seen.last) { return 'updated'; }
        return null;
    }

    function recompute() {
        var q = F.trim(vm.q).toLowerCase(), scoped = vm.clubs.filter(function (c) { return vm.club === 'all' || String(c.id) === String(vm.club); });
        var cards = [], changed = [], total = 0;
        scoped.forEach(function (c) {
            var all = c.terms.concat(c.docs);
            all.forEach(function (d) { d.fresh = fresh(d); if (d.fresh) { changed.push(d); } });
            total += all.length;
            if (vm.page === 'documents') {
                var match = function (d) { return !q || F.has(d.title, q) || F.has(d.description, q); };
                var terms = c.terms.filter(match), docs = c.docs.filter(match);
                if (q && !terms.length && !docs.length) { return; }
                cards.push({ club: c, terms: terms, docs: docs, total: all.length, shown: terms.length + docs.length, aircraft: c.planes.length && !q });
            } else {
                var planes = c.planes.filter(function (p) { return !q || F.has(p.registration, q) || F.has(p.type, q) || F.has(p.model, q); });
                var lessons = c.instruction.filter(function (x) { return !q || F.has(x.title, q); });
                var mems = c.memberships.filter(function (x) { return !q || F.has(x.name, q); });
                if (q && !planes.length && !lessons.length && !mems.length) { return; }
                var used = {}, bases = [];
                planes.forEach(function (p) { if (!p.none && !used[p.basisKey]) { used[p.basisKey] = 1; bases.push(F.basis(p.basisKey)); } });
                cards.push({ club: c, planes: planes, lessons: lessons, mems: mems, anySur: planes.some(function (p) { return p.sur; }), bases: bases,
                    nothing: !c.planes.length && !c.instruction.length && !c.memberships.length });
            }
        });
        vm.view = { cards: cards, changed: changed, total: total, q: q };
    }

    // ── "New" pills: compared with this browser's last visit ──
    function readSeen() {
        var s = readLocal(SEEN_KEY, true);
        if (!s || !s.last) { s = { last: F.stamp(new Date()), ids: {} }; writeLocal(SEEN_KEY, s, true); }   // first visit: nothing is "new"
        s.ids = s.ids || {};
        return s;
    }
    function markSeen(d) { if (!d.fresh) { return; } vm.seen.ids[d.key] = 1; writeLocal(SEEN_KEY, vm.seen, true); recompute(); }
    function markAllSeen() { vm.seen = { last: F.stamp(new Date()), ids: {} }; writeLocal(SEEN_KEY, vm.seen, true); recompute(); ToastService.success('Marked as seen', 'New and changed documents are no longer highlighted.'); }

    // ── open / save a file: fetched as before (club_documents/show_file), typed from its name ──
    function fetchFile(d) {
        var name = String(d.file).replace(/^.*[\\\/]/, '');
        return $http.get('/api/v1/club_documents/show_file/' + encodeURIComponent(name), { responseType: 'arraybuffer' });
    }
    // a reply that is not the file (a refusal sent as JSON, or nothing at all)
    function notAFile(res) { var t = (res && res.headers && res.headers('Content-Type')) || ''; return !res || !res.data || !res.data.byteLength || t.indexOf('application/json') > -1; }
    // the document in a dialog (Alex, 10 Nov 2026: shown here, not "click to preview") — PDFs and images; the
    // rest (video…) still opens in a new tab
    vm.docView = null;
    vm.closeDocView = function () { vm.docView = null; };
    function docViewKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && vm.docView) { $scope.$applyAsync(vm.closeDocView); } }
    $window.document.addEventListener('keydown', docViewKey);
    $scope.$on('$destroy', function () { $window.document.removeEventListener('keydown', docViewKey); });
    function viewDoc(d) {
        if (!d.file) { ToastService.warning('No file attached', 'The club hasn\'t uploaded a file for ' + d.title + ' yet.'); return; }
        if (!d.ft.view) { downloadDoc(d); return; }
        if (d.ft.k === 'pdf' || d.ft.k === 'img') { vm.docView = d; markSeen(d); return; }
        if (d._busy) { return; }   // one open at a time per document (a GET: the busy guard doesn't cover it)
        d._busy = true;
        // the window opens inside the click, so popup blockers allow it; it is pointed at the file once it arrives
        var w = null;
        try { w = $window.open('', '_blank'); if (w && w.document) { w.document.title = d.title; w.document.body.innerHTML = '<p style="font-family:sans-serif;color:#64748b;padding:24px">Opening ' + d.title.replace(/</g, '&lt;') + '…</p>'; } } catch (e) {}
        var failed = function () {
            d._busy = false;
            if (w) { try { w.close(); } catch (e) {} }
            ToastService.error('Download failed', 'There was an error opening ' + d.title + '. Try again in a moment.');
        };
        fetchFile(d).then(function (res) {
            if (notAFile(res)) { failed(); return; }
            d._busy = false;
            var url = URL.createObjectURL(new Blob([res.data], { type: d.ft.mime }));
            if (w && !w.closed) { w.location.href = url; } else { $window.location.href = url; }
            markSeen(d);
        }, failed);
    }
    function downloadDoc(d) {
        if (!d.file) { ToastService.warning('No file attached', 'The club hasn\'t uploaded a file for ' + d.title + ' yet.'); return; }
        if (d._busy) { return; }
        d._busy = true;
        fetchFile(d).then(function (res) {
            d._busy = false;
            if (notAFile(res)) { ToastService.error('Download failed', 'There was an error downloading ' + d.title + '. Try again in a moment.'); return; }
            var blob = new Blob([res.data], { type: d.ft.mime === 'image/*' ? 'application/octet-stream' : d.ft.mime });
            var url = URL.createObjectURL(blob), a = document.createElement('a'), ext = F.ext(d.file);
            a.href = url; a.download = d.title.replace(/[\\\/:*?"<>|]+/g, ' ').trim() + (ext ? '.' + ext : '');
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            $timeout(function () { URL.revokeObjectURL(url); }, 60000, false);
            markSeen(d);
        }, function () {
            d._busy = false;
            ToastService.error('Download failed', 'There was an error downloading ' + d.title + '. Try again in a moment.');
        });
    }

    function readLocal(k, json) { try { var v = localStorage.getItem(k); return json ? (v ? JSON.parse(v) : null) : v; } catch (e) { return null; } }
    function writeLocal(k, v, json) { try { localStorage.setItem(k, json ? JSON.stringify(v) : v); } catch (e) {} }
}

/* ═════ My vouchers + Book your flight ═════ */
app.controller('VouchersV2Controller', VouchersV2Controller);
VouchersV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$document', '$timeout', 'VoucherService', 'ClubDocumentService', 'BookoutService', 'ToastService', 'VdV2Fmt'];
function VouchersV2Controller($rootScope, $scope, $state, $stateParams, $document, $timeout, VoucherService, ClubDocumentService, BookoutService, ToastService, VdV2Fmt) {
    var vm = this, F = VdV2Fmt;
    vm.F = F;
    vm.user = $rootScope.globals.currentUser;
    vm.page = ($state.current.data && $state.current.data.page) || 'list';
    vm.loading = true;
    vm.error = '';
    vm.vouchers = [];
    vm.groups = { ready: [], booked: [], past: [], soon: [] };
    vm.ask = null;              // id of the voucher whose cancel is being confirmed
    vm.cancelling = false;

    // book page
    vm.voucher = null;
    vm.tomorrow = F.addDays(F.today(), 1);
    vm.from = vm.tomorrow;
    vm.days = 14;
    vm.dayOpts = [[7, '1 week'], [14, '2 weeks'], [28, '4 weeks'], [60, '2 months']];
    vm.pickerOptions = { min: vm.tomorrow, allowPast: false, weekStart: 1 };
    vm.slots = [];
    vm.dayGroups = [];
    vm.pagination = {};
    vm.searching = false;
    vm.searched = false;
    vm.searchError = '';
    vm.noInstructor = false;
    vm.experience = null;
    vm.dlg = null;              // { slot, plane, instructor }
    vm.booking = false;

    vm.copy = copy;
    vm.goBook = function (v) { $state.go('dashboard.v2.voucher_book', { voucher_id: v.id }); };
    vm.askCancel = function (v) {
        if (!v.can_cancel) { ToastService.warning('Can\'t cancel online', v.cancel_message || 'This booking can\'t be cancelled online. Call the club.'); return; }
        vm.ask = v.id;
    };
    vm.keep = function () { vm.ask = null; };
    vm.cancelYes = cancelYes;
    vm.prevWeek = function () { var f = F.addDays(vm.from, -7); vm.from = f < vm.tomorrow ? vm.tomorrow : f; search(); };
    vm.nextWeek = function () { vm.from = F.addDays(vm.from, 7); search(); };
    vm.goTomorrow = function () { vm.from = vm.tomorrow; search(); };
    vm.setDays = function (n) { vm.days = n; search(); };
    vm.onPickDate = function () { if (vm.from < vm.tomorrow) { vm.from = vm.tomorrow; } search(); };
    vm.cal = null;
    vm.openCal = function () { vm.cal = { pick: vm.from }; };
    vm.closeCal = function () { vm.cal = null; };
    vm.calPicked = function () { if (vm.cal && vm.cal.pick) { vm.from = vm.cal.pick < vm.tomorrow ? vm.tomorrow : vm.cal.pick; vm.cal = null; search(); } };
    vm.calBusy = function (date) { return vm.voucher && date === vm.voucher.expiry_date ? 1 : 0; };   // the expiry day carries a dot
    vm.more = more;
    vm.pickSlot = pickSlot;
    vm.closeDlg = function () { if (!vm.booking) { vm.dlg = null; } };
    vm.confirm = confirm;
    vm.search = search;
    vm.reload = load;

    function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) { $scope.$apply(function () { if (vm.cal) { vm.cal = null; } else if (vm.dlg) { vm.closeDlg(); } else { vm.ask = null; } }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    load();

    function load() {
        vm.loading = true; vm.error = '';
        VoucherService.GetMyVouchersAll().then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                vm.error = F.msg(data) || 'Your vouchers couldn\'t be loaded. Check your connection and try again.';
                return;
            }
            vm.vouchers = (data.vouchers || []).map(decorate);
            group();
            if (vm.vouchers.length) { loadAirfields(); }
            if (vm.page === 'book') { startBook(); }
        });
    }

    // the club's home airfield, for "Club local time · Fairoaks (EGTF)" (the voucher payload carries the club id only)
    vm.af = {};
    function loadAirfields() {
        ClubDocumentService.GetByUserId(vm.user.id).then(function (d) {
            ((d && d.clubs) || []).forEach(function (c) {
                if (!+c.base_airfield_id) { return; }
                BookoutService.GetAirfieldById(c.base_airfield_id).then(function (r) {
                    var a = r && r.success !== false && r.airfield;
                    if (a && a.code) { vm.af[+c.id] = { code: a.code, name: F.trim(a.title) }; }
                });
            });
        });
    }
    vm.afText = function (v) { var a = v && vm.af[+v.club_id]; return a ? (a.name ? a.name + ' (' + a.code + ')' : a.code) : ''; };
    function decorate(v) {
        v._st = F.vStatus(v);
        v._left = v.expiry_date ? F.daysBetween(F.today(), v.expiry_date) : 9999;
        v._soon = v._st.k === 'ready' && v.expiry_date && v._left <= 30;
        if (v._st.k === 'ready' && v.expiry_date) {
            var made = v.created_at ? String(v.created_at).slice(0, 10) : null, total = made ? Math.max(1, F.daysBetween(made, v.expiry_date)) : 365;
            v._used = Math.min(100, Math.max(4, Math.round((1 - v._left / total) * 100)));
        }
        if (v.booking) { v._h = F.hoursUntil(v.booking.start); }
        if (v.flight && v.flight.instructor) {
            var i = v.flight.instructor;
            v._ins = { name: F.trim((i.first_name || '') + ' ' + (i.last_name || '')), code: ((i.first_name || '').charAt(0) + (i.last_name || '').charAt(0)).toUpperCase(), colour: i.colour || '' };
        }
        v._covers = F.trim(v.experience_description);   // C20: what the voucher covers
        return v;
    }

    function group() {
        var g = { ready: [], booked: [], past: [], soon: [] };
        vm.vouchers.forEach(function (v) { var k = v._st.k; (k === 'ready' ? g.ready : (k === 'booked' || k === 'flown') ? g.booked : g.past).push(v); });
        g.ready.sort(function (a, b) { return (a.expiry_date || '9') < (b.expiry_date || '9') ? -1 : 1; });
        g.booked.sort(function (a, b) { return a.booking.start < b.booking.start ? -1 : 1; });
        g.soon = g.ready.filter(function (v) { return v._soon; });
        g.cols = (g.ready.length || g.booked.length ? 1 : 0) + (g.past.length ? 1 : 0);
        vm.groups = g;
    }

    vm.whenText = function (v) {
        var h = v._h;
        if (!(h > 0)) { return ''; }
        return 'in ' + (h < 48 ? F.plural(Math.floor(h), 'hour') : F.plural(F.daysBetween(F.today(), String(v.booking.start).slice(0, 10)), 'day'));
    };

    function copy(code) {
        var done = function () { $scope.$evalAsync(function () { ToastService.success('Code copied', 'Voucher code ' + code + ' is on your clipboard.'); }); };
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(String(code)).then(done, function () { fallbackCopy(code); done(); }); return; }
        } catch (e) {}
        fallbackCopy(code); done();
    }
    function fallbackCopy(code) {
        try { var t = document.createElement('textarea'); t.value = String(code); t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } catch (e) {}
    }

    function cancelYes(v) {
        vm.cancelling = true;
        VoucherService.CancelVoucherBooking(v.id).then(function (data) {
            vm.cancelling = false;
            if (data && data.success) {
                vm.ask = null;
                ToastService.success('Flight cancelled', 'Your voucher is ready to book again.');
                load();
            } else {
                if (data && typeof data.status === 'number' && (data.status <= 0 || data.status >= 500)) { ToastService.error('Not cancelled', 'The cancellation didn\'t go through. Check your connection and try again.'); return; }
                ToastService.error('Not cancelled', F.msg(data) || 'This flight can\'t be cancelled online. Call the club.');
                vm.ask = null; load();   // a refusal: show the booking as it is now
            }
        });
    }

    /* ── Book your flight ── */
    function startBook() {
        var id = +$stateParams.voucher_id;
        vm.voucher = vm.vouchers.filter(function (v) { return +v.id === id && v._st.k === 'ready'; })[0] || null;
        if (vm.voucher) { search(); }
    }

    function params(page) { return { instructor_id: 0, page: page, per_page: 8 }; }

    function search() {
        if (!vm.voucher) { return; }
        vm.searching = true; vm.searchError = ''; vm.noInstructor = false; vm.dlg = null;
        var from = vm.from, days = vm.days;
        VoucherService.GetVoucherSlots(vm.voucher.id, from, days, params(1)).then(function (data) {
            if (from !== vm.from || days !== vm.days) { return; }   // a newer search started
            vm.searching = false; vm.searched = true;
            if (!data || data.success === false) {
                var msg = F.msg(data) || 'The search didn\'t work. Try again in a moment.';
                if (msg.toLowerCase().indexOf('no instructors are qualified') > -1) { vm.noInstructor = true; }
                vm.searchError = msg; vm.slots = []; vm.dayGroups = []; vm.pagination = {};
                return;
            }
            vm.experience = data.experience || vm.experience;
            vm.slots = data.available_slots || [];
            vm.pagination = data.pagination || {};
            regroup();
        });
    }

    function more() {
        if (!vm.pagination.has_more || vm.searching) { return; }
        vm.searching = true;
        VoucherService.GetVoucherSlots(vm.voucher.id, vm.from, vm.days, params((vm.pagination.page || 1) + 1)).then(function (data) {
            vm.searching = false;
            if (!data || data.success === false) { ToastService.error('No more slots loaded', F.msg(data) || 'Try again in a moment.'); return; }
            vm.slots = vm.slots.concat(data.available_slots || []);
            vm.pagination = data.pagination || {};
            regroup();
        });
    }

    function regroup() {
        var groups = [], by = {};
        vm.slots.forEach(function (s) {
            if (!by[s.date]) { by[s.date] = { date: s.date, slots: [], late: vm.voucher.expiry_date && s.date > vm.voucher.expiry_date, tomorrow: s.date === vm.tomorrow }; groups.push(by[s.date]); }
            by[s.date].slots.push(s);
        });
        vm.dayGroups = groups;
    }

    vm.toDate = function () { return F.addDays(vm.from, vm.days - 1); };

    function pickSlot(s) {
        // v1 rule: the first free aircraft and instructor are picked for the member (they are not shown)
        var plane = (s.available_planes && s.available_planes.length) ? s.available_planes[0] : null;
        var instructor = plane && plane.available_instructors && plane.available_instructors.length ? plane.available_instructors[0]
            : ((s.available_instructors && s.available_instructors.length) ? s.available_instructors[0] : null);
        if (!plane || !instructor) {
            ToastService.warning('Slot unavailable', 'That slot has just been taken. Pick another one, or search again.');
            vm.slots = vm.slots.filter(function (x) { return x !== s; }); regroup();
            return;
        }
        vm.dlg = { slot: s, plane: plane, instructor: instructor, start: s.slot_start || (s.date + ' ' + s.start_time), late48: F.hoursUntil(s.slot_start || (s.date + ' ' + s.start_time)) < 48 };
    }

    function confirm() {
        if (!vm.dlg) { return; }
        var d = vm.dlg;
        vm.booking = true;
        VoucherService.BookVoucher({
            voucher_id: vm.voucher.id, plane_id: d.plane.id, instructor_id: d.instructor.id,
            start: d.slot.slot_start, end: d.slot.slot_end, experience_title: vm.voucher.experience_title || ''
        }).then(function (data) {
            vm.booking = false;
            if (data && data.success) {
                vm.dlg = null;
                ToastService.success('Flight booked', F.fDay(d.start) + ', ' + F.fTime(d.slot.start_time || d.start) + ' — a confirmation email is on its way.');
                $state.go('dashboard.v2.my_vouchers');
            } else if (data && typeof data.status === 'number' && (data.status <= 0 || data.status >= 500)) {   // the request failed (connection / server): keep the sheet so it can be sent again
                ToastService.error('Not booked', 'The booking didn\'t go through. Check your connection and try again.');
            } else {   // the club refused it (slot taken, instructor no longer free…): back to a fresh list of slots
                ToastService.error('Not booked', F.msg(data) || 'That slot can\'t be booked any more. Pick another one.');
                search();
            }
        });
    }
}
