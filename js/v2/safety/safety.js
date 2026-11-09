/* ═══════════════════════════════════════════════════════════════════════════
   v2 SAFETY (SMS member hub) — design: mockups/my-account/safety.html (approved). Built 8 Nov 2026.
   v1: dashboard.my_account.sms / sms_report_hazard / sms_report_occurrence / sms_acknowledgements /
   sms_bulletins (SmsMemberController, views/my_account/sms/*). Same server calls as v1 (SmsService).
   Views: views/v2/safety/*. Styles: css/v2/safety.css (.saf-*) on ta-base.css.

   One controller (SafetyV2Controller) for the five screens, dispatched by $state.current.data.screen:
     home · acks · bulletins (the hub: one page bar with three tabs) · report_hazard · report_occurrence.

   Member reads (C25 / B29, landed 9 Nov) — SafetyV2Data below:
     • GET sms/v2/my_reports → "Your reports" (own, non-anonymous reports, with the team's actions / closure notes) + legend.
     • GET sms/v2/acknowledgements → pending + acknowledged rows joined to the bulletin / document version, with due dates
       (due_state, days_overdue) and the acknowledged history. Falls back to the v1 pending list (SmsService.PendingAcks +
       the document join) if the v2 read fails, e.g. a club where the member has no live membership.
     • GET sms/v2/document_file/{club}/{version_id} → "Open the document" on a manual change (base64).
   Unread bulletins are tracked per browser (localStorage, no backend): a bulletin is New until you open it,
   for 30 days after it was published (older ones are never shown as New).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    function st(url, view, screen) {
        return { url: url, templateUrl: 'views/v2/safety/' + view + '.html', controller: 'SafetyV2Controller', controllerAs: 'vm', data: { screen: screen } };
    }
    $stateProvider
        .state('dashboard.v2.safety', st('/my_account/safety', 'home', 'home'))
        .state('dashboard.v2.safety_report_hazard', st('/my_account/safety/report_hazard', 'report', 'report_hazard'))
        .state('dashboard.v2.safety_report_occurrence', st('/my_account/safety/report_occurrence', 'report', 'report_occurrence'))
        .state('dashboard.v2.safety_acknowledgements', st('/my_account/safety/acknowledgements', 'acks', 'acks'))
        .state('dashboard.v2.safety_bulletins', st('/my_account/safety/bulletins', 'bulletins', 'bulletins'));
    DesignRoutesProvider
        .map('dashboard.my_account.sms', 'dashboard.v2.safety')
        .map('dashboard.my_account.sms_report_hazard', 'dashboard.v2.safety_report_hazard')
        .map('dashboard.my_account.sms_report_occurrence', 'dashboard.v2.safety_report_occurrence')
        .map('dashboard.my_account.sms_acknowledgements', 'dashboard.v2.safety_acknowledgements')
        .map('dashboard.my_account.sms_bulletins', 'dashboard.v2.safety_bulletins');
}]);

// v2 member reads for Safety (C25). Resolve, never reject: { success:false, error, status } on a refusal / HTTP error.
app.factory('SafetyV2Data', SafetyV2Data);
SafetyV2Data.$inject = ['$http', '$location'];
function SafetyV2Data($http, $location) {
    var service = {};
    service.MyReports = MyReports;
    service.Acks = Acks;
    service.DocumentFile = DocumentFile;
    return service;

    function q(clubId) { return clubId ? '?club_id=' + encodeURIComponent(clubId) : ''; }
    function MyReports(clubId) { return $http.get('/api/v1/sms/v2/my_reports' + q(clubId)).then(handleSuccess, handleError2); }
    function Acks(clubId) { return $http.get('/api/v1/sms/v2/acknowledgements' + q(clubId)).then(handleSuccess, handleError2); }
    function DocumentFile(clubId, versionId) { return $http.get('/api/v1/sms/v2/document_file/' + encodeURIComponent(clubId) + '/' + encodeURIComponent(versionId)).then(handleSuccess, handleError2); }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data && typeof res.data === 'object' ? res.data : {};
        return { success: false, error: d.error || null, message: d.message || null, status: res.status };
    }
}

app.controller('SafetyV2Controller', SafetyV2Controller);
SafetyV2Controller.$inject = ['SmsService', 'SafetyV2Data', 'AircraftV2Data', 'PlaneService', 'ClubService', 'BookoutService', 'ToastService', '$rootScope', '$scope', '$state', '$timeout', '$q', '$window'];
function SafetyV2Controller(SmsService, SafetyV2Data, AircraftV2Data, PlaneService, ClubService, BookoutService, ToastService, $rootScope, $scope, $state, $timeout, $q, $window) {
    var vm = this;
    var SMS_CLUB_KEY = 'toaviate_sms_club_id';          // shared with v1 (the remembered club)
    var READ_KEY = 'toaviate_sms_read_bulletins';       // v2: per-browser read receipts { club_id: { bulletin_id: 1 } }
    var NEW_DAYS = 30;

    vm.screen = $state.current.data.screen;
    vm.isHub = vm.screen === 'home' || vm.screen === 'acks' || vm.screen === 'bulletins';
    vm.isReport = vm.screen === 'report_hazard' || vm.screen === 'report_occurrence';
    vm.user = $rootScope.globals.currentUser;
    vm.user_id = vm.user.id;
    vm.fullName = ((vm.user.first_name || '') + ' ' + (vm.user.last_name || '')).trim();

    /* ═════════ reference data (SmsService.enums + v1 icons, FA5 names) ═════════ */
    var CAT_ICONS = {
        'Flight Operations': 'fa-plane-departure', 'Aerodrome': 'fa-map-marker-alt', 'Aircraft': 'fa-plane', 'Maintenance': 'fa-wrench',
        'Human Factors': 'fa-user', 'Fatigue': 'fa-bed', 'Weather': 'fa-cloud-showers-heavy', 'Security': 'fa-shield-alt',
        'IFR Operations': 'fa-cloud', 'Aerobatics': 'fa-sync', 'UPRT': 'fa-redo', 'Student Performance': 'fa-user-graduate',
        'Instructor Performance': 'fa-chalkboard-teacher'
    };
    vm.cats = (SmsService.enums.hazardCategory || []).map(function (c) { return { id: c, icon: CAT_ICONS[c] || 'fa-exclamation-triangle', label: catLabel(c) }; });
    vm.occTypes = [
        { id: 'accident', label: 'Accident', icon: 'fa-first-aid', sub: 'Someone was seriously hurt, or the aircraft was damaged' },
        { id: 'serious_incident', label: 'Serious incident', icon: 'fa-exclamation-triangle', sub: 'An accident very nearly happened' },
        { id: 'incident', label: 'Incident', icon: 'fa-exclamation-circle', sub: 'Safety was, or could have been, affected' },
        { id: 'reportable', label: 'Reportable occurrence', icon: 'fa-flag', sub: 'Another event the rules say must be reported' }
    ];
    vm.sevs = [
        { id: 'negligible', n: 1, label: 'Negligible', sub: 'Little or no effect on safety' },
        { id: 'minor', n: 2, label: 'Minor', sub: 'A nuisance — safety margins a little reduced' },
        { id: 'major', n: 3, label: 'Major', sub: 'Safety margins clearly reduced; injuries possible' },
        { id: 'hazardous', n: 4, label: 'Hazardous', sub: 'Safety margins largely gone; serious injury possible' },
        { id: 'catastrophic', n: 5, label: 'Catastrophic', sub: 'The aircraft destroyed, or people killed' }
    ];
    var BTYPE = {
        safety_bulletin: { label: 'Safety bulletin', plural: 'Safety bulletins', icon: 'fa-exclamation-triangle', tone: 'warn' },
        lesson_learned: { label: 'Lesson learned', plural: 'Lessons learned', icon: 'fa-lightbulb', tone: 'info' },
        notice: { label: 'Notice', plural: 'Notices', icon: 'fa-bullhorn', tone: 'quiet' },
        regulatory_update: { label: 'Regulatory update', plural: 'Regulatory updates', icon: 'fa-balance-scale', tone: 'brand' }
    };
    var AUDIENCE = { all: 'For everyone', instructors: 'For instructors', students: 'For students', staff: 'For staff' };

    /* ═════════ the one helper per domain: words on screen, never raw enums ═════════ */
    function catLabel(c) { return c === 'UPRT' ? c : c === 'IFR Operations' ? 'IFR operations' : String(c).charAt(0) + String(c).slice(1).toLowerCase(); }
    vm.catLabel = catLabel;
    vm.typeLabel = function (t) { var o = vm.occTypes.filter(function (x) { return x.id === t; })[0]; return o ? o.label : 'Occurrence'; };
    vm.sevLabel = function (s) { var o = vm.sevs.filter(function (x) { return x.id === s; })[0]; return o ? o.label : ''; };
    vm.btype = function (b) { return BTYPE[b && b.bulletin_type] || BTYPE.notice; };
    vm.sqClass = function (tone) { return { warn: 'ta-ic--warn', info: 'ta-ic--info', brand: 'ta-ic--group', quiet: 'saf-sq--quiet' }[tone] || 'saf-sq--quiet'; };
    vm.audience = function (b) { return AUDIENCE[b && b.audience] || ''; };

    /* ═════════ dates (server strings "YYYY-MM-DD HH:MM:SS" are club wall-clock; never new Date(str)) ═════════ */
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function pd(s) {
        if (!s) { return null; }
        var p = String(s).replace('T', ' ').split(' '), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    }
    function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function nowStr() { var d = new Date(); return ymd(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
    vm.fDate = function (s) { var d = pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    vm.fDay = function (s) { var d = pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
    vm.fDayLong = function (s) { var d = pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    vm.fTime = function (s) { var t = String(s || '').replace('T', ' ').split(' ')[1]; return t ? t.slice(0, 5) : ''; };
    vm.whenText = function (s) { return vm.fDayLong(s) + (vm.fTime(s) ? ', ' + vm.fTime(s) : ''); };
    function daysAgo(s) { var d = pd(s); return d ? Math.floor((new Date() - d) / 86400000) : 9999; }
    var TODAY = ymd(new Date());
    var YESTERDAY = (function () { var d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); })();

    /* ═════════ clubs (same rule as v1: every club in the access lists + the selected admin club) ═════════ */
    var access = vm.user.access || {}, myClubIds = {};
    ['pilot', 'instructor', 'manager', 'super_admin'].forEach(function (role) { (access[role] || []).forEach(function (id) { myClubIds[String(id)] = true; }); });
    if (vm.user.current_club_admin && vm.user.current_club_admin.id) { myClubIds[String(vm.user.current_club_admin.id)] = true; }
    var myClubIdList = Object.keys(myClubIds);
    var saved = null;
    try { saved = localStorage.getItem(SMS_CLUB_KEY); } catch (e) {}
    vm.club_id = (saved && myClubIds[saved]) ? saved : (myClubIdList.length ? myClubIdList[0] : null);
    vm.multiClub = myClubIdList.length > 1;
    vm.clubs = myClubIdList.map(function (id) { return { id: id, name: 'Club ' + id, base_airfield_id: null }; });
    vm.clubName = '';
    var clubsLoaded = ClubService.GetAllForUser(vm.user_id).then(function (data) {
        var list = angular.isArray(data) ? data : (data && data.clubs ? data.clubs : []);
        var named = list.filter(function (c) { return myClubIds[String(c.id)]; }).map(function (c) {
            return { id: String(c.id), name: tidyName(c.title || c.club_name || c.name || ('Club ' + c.id)), base_airfield_id: c.base_airfield_id || null };
        });
        if (named.length) { vm.clubs = named; }
        syncClub();
    });
    // ALL-CAPS names ("THE PILOT CENTRE") read better in title case — but only when the whole name is in capitals and longer
    // than 4 letters; acronyms (TPC, RAF, CAA…) stay, and ToAviate keeps its own casing
    var CAPS_KEEP = { TOAVIATE: 'ToAviate', RAF: 'RAF', UK: 'UK', USA: 'USA', CAA: 'CAA', LAA: 'LAA', BMAA: 'BMAA', ATC: 'ATC', ATO: 'ATO', DTO: 'DTO', FTO: 'FTO', PLC: 'PLC', LLP: 'LLP', LTD: 'Ltd' };
    function titleCaps(t) {
        t = String(t || '').trim();
        if (!t || t !== t.toUpperCase() || t.replace(/[^A-Z]/g, '').length <= 4) { return t.replace(/\btoaviate\b/gi, 'ToAviate'); }
        return t.replace(/[A-Z0-9]+/g, function (w) {
            if (CAPS_KEEP[w]) { return CAPS_KEEP[w]; }
            if (!/[AEIOUY]/.test(w) || /\d/.test(w)) { return w; }        // TPC, C152, G-BMTJ stay as they are
            return w.charAt(0) + w.slice(1).toLowerCase();
        });
    }
    function tidyName(t) { return titleCaps(t); }
    function club() { return vm.clubs.filter(function (c) { return String(c.id) === String(vm.club_id); })[0] || null; }
    function syncClub() { var c = club(); vm.clubName = c ? c.name : ''; }
    syncClub();

    vm.selectClub = function (id) {
        if (!id || String(id) === String(vm.club_id)) { return; }
        vm.club_id = String(id);
        try { localStorage.setItem(SMS_CLUB_KEY, vm.club_id); } catch (e) {}
        syncClub();
        vm.ackOpen = null; vm.bOpen = null; vm.filter = 'all';
        if (vm.isHub) { loadHub(); }
        if (vm.isReport) { onReportClubChange(); }
    };

    /* ═════════ navigation ═════════ */
    vm.go = function (screen) {
        var to = { home: 'dashboard.v2.safety', acks: 'dashboard.v2.safety_acknowledgements', bulletins: 'dashboard.v2.safety_bulletins',
            report_hazard: 'dashboard.v2.safety_report_hazard', report_occurrence: 'dashboard.v2.safety_report_occurrence' }[screen];
        if (to) { $state.go(to); }
    };
    vm.toMyAccount = function () { $state.go('dashboard.my_account'); };

    /* ═════════ per-browser read receipts for bulletins ═════════ */
    function readMap() { try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function markRead(b) {
        if (!b) { return; }
        b._new = false;
        var m = readMap(), k = String(vm.club_id);
        m[k] = m[k] || {}; m[k][b.id] = 1;
        try { localStorage.setItem(READ_KEY, JSON.stringify(m)); } catch (e) {}
        countUnread();
    }
    function countUnread() { vm.unreadCount = (vm.bulletins || []).filter(function (b) { return b._new; }).length; buildChips(); }

    /* ═════════ HUB: pending acknowledgements + bulletins for the chosen club ═════════ */
    vm.loading = false;
    vm.bulletins = [];
    vm.acks = [];
    vm.filter = 'all';
    vm.sig = vm.fullName;
    var hubSeq = 0;

    function bulletinParas(body) {
        // the body is plain text: lines starting "• " / "- " / "* " become a list, other lines paragraphs
        var out = [], ul = null;
        String(body || '').split(/\r?\n/).forEach(function (line) {
            var m = line.match(/^\s*(?:•|-|\*)\s+(.*)$/);
            if (m) { if (!ul) { ul = { list: [] }; out.push(ul); } ul.list.push(m[1]); return; }
            ul = null;
            if (line.trim()) { out.push({ p: line.trim() }); }
        });
        return out;
    }

    /* C11: valid from / valid until. The backend sends state (upcoming | current | expired) and the UK calendar days;
       older payloads have none of it, so a bulletin without dates is simply "current". */
    var THIS_YEAR = new Date().getFullYear();
    function dayText(ymdStr) { var d = pd(ymdStr); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== THIS_YEAR ? ' ' + d.getFullYear() : '') : ''; }
    function validity(b) {
        var from = b.valid_from_day || (b.valid_from ? String(b.valid_from).slice(0, 10) : null);
        var until = b.valid_until_day || (b.valid_until ? String(b.valid_until).slice(0, 10) : null);
        var st = b.state;
        if (st !== 'upcoming' && st !== 'current' && st !== 'expired') {
            st = (from && from > TODAY) ? 'upcoming' : (until && until < TODAY) ? 'expired' : 'current';
        }
        b._state = st;
        b._expired = st === 'expired';
        b._upcoming = st === 'upcoming';
        if (st === 'expired') { b._valid = until ? 'Expired ' + dayText(until) : 'Expired'; }
        else if (st === 'upcoming') { b._valid = 'From ' + dayText(from) + (until ? ' until ' + dayText(until) : ''); }
        else { b._valid = until ? 'Valid until ' + dayText(until) : ''; }
    }

    function loadHub() {
        if (!vm.club_id) { vm.loading = false; return; }
        var seq = ++hubSeq, cid = vm.club_id;
        vm.loading = true;
        vm.loadError = false;
        vm.reportsOk = false;
        $q.all([SafetyV2Data.Acks(cid), SmsService.ListBulletins(cid, { published: 1 }), SafetyV2Data.MyReports(cid)]).then(function (r) {
            if (seq !== hubSeq) { return; }
            var v2 = r[0];
            if (v2 && v2.success && angular.isArray(v2.acknowledgements)) { finishHub(seq, v2, null, r[1], r[2]); return; }
            // the v2 read refused (e.g. no live membership here) or failed: the v1 pending list, as before C25
            SmsService.PendingAcks(cid).then(function (acks) { if (seq === hubSeq) { finishHub(seq, null, acks, r[1], r[2]); } });
        });
    }

    function finishHub(seq, v2, acks, bl, reps) {
        vm.forbidden = !!((acks && acks.error === 'FORBIDDEN') || (bl && bl.error === 'FORBIDDEN'));
        vm.loadError = !vm.forbidden && ((acks && acks.success === false) || (bl && bl.success === false));
        var read = readMap()[String(vm.club_id)] || {};
        vm.bulletins = (angular.isArray(bl) ? bl : (bl && bl.items) || []).map(function (b) {
            decorateBulletin(b);
            // an expired bulletin is never New (C11); New lasts 30 days after publishing, per browser
            b._new = !b._expired && !read[b.id] && daysAgo(b.published_at) <= NEW_DAYS;
            return b;
        }).sort(function (a, b) { return String(a.published_at) < String(b.published_at) ? 1 : -1; });
        countUnread();
        vm.ackHistory = !!v2;      // the v2 read carries the acknowledged history and due dates
        if (v2) {
            vm.acks = v2.acknowledgements.map(fromV2).filter(function (a) { return a.acknowledged || !(a._b && a._b._expired); });
        } else {
            var rows = angular.isArray(acks) ? acks : (acks && acks.items) || [];
            // an expired bulletin is never "to acknowledge" (the backend leaves them out already — C11)
            vm.acks = rows.map(decorateAck).filter(function (a) { return !(a._b && a._b._expired); });
        }
        setReports(reps);
        vm.loading = false;
        if (!v2) { joinDocuments(seq); }
    }

    function decorateBulletin(b) {
        b._type = vm.btype(b);
        b._paras = bulletinParas(b.body);
        validity(b);
        return b;
    }

    // a v2 acknowledgement row → the row model the templates use (same fields as the v1 pending rows, plus due dates)
    function fromV2(row) {
        var a = {
            id: row.id, entity_type: row.entity_type, entity_id: row.entity_id,
            acknowledged: row.status === 'acknowledged' ? 1 : 0, acknowledged_at: row.acknowledged_at, signature_name: row.signature_name,
            created_at: row.requested_at, due_date: row.due_date || null, due_state: row.due_state || 'none', days_overdue: +row.days_overdue || 0
        };
        if (row.kind === 'bulletin') {
            var b = row.bulletin ? vm.bulletins.filter(function (x) { return +x.id === +row.bulletin.id; })[0] : null;
            if (!b && row.bulletin) {
                var rb = row.bulletin;
                b = decorateBulletin({ id: rb.id, bulletin_type: rb.type, title: rb.title, body: rb.body, published_at: rb.published_at,
                    valid_from: rb.valid_from, valid_until: rb.valid_until, valid_from_day: rb.valid_from_day, valid_until_day: rb.valid_until_day, state: rb.state });
            }
            a.entity_type = 'sms_bulletin';
            setBulletinAck(a, b || null);
        } else {
            var d = row.document;
            a._doc = true;
            a._tone = 'brand';
            a._icon = 'fa-book';
            a._title = (d && d.title) || 'A safety document to read';
            a._docType = d ? (d.doc_type || 'Document') : '';
            a._version = d ? (d.version_label || '') : '';
            a._effective = d ? d.effective_date : null;
            a._change = d ? (d.change_summary || '') : '';
            a._file = d ? (d.file_name || '') : '';
            a._hasFile = !!(d && d.has_file);
            a._versionId = d ? d.version_id : null;
            a._sub = d ? (a._docType + (a._version ? ' · version ' + a._version : '')) : 'Document · asked ' + vm.fDate(a.created_at);
        }
        a._read = false;
        return a;
    }

    function setBulletinAck(a, b) {
        a._b = b;
        a._title = b ? b.title : 'Safety bulletin';
        a._sub = (b ? b._type.label + ' · published ' + vm.fDate(b.published_at) + (b._valid ? ' · ' + b._valid : '') : 'Safety bulletin');
        a._tone = (b ? b._type : BTYPE.safety_bulletin).tone;
        a._icon = (b ? b._type : BTYPE.safety_bulletin).icon;
    }

    function decorateAck(a) {
        a._read = false;
        a.acknowledged = +a.acknowledged ? 1 : 0;
        if (a.entity_type === 'sms_bulletin') {
            setBulletinAck(a, vm.bulletins.filter(function (x) { return +x.id === +a.entity_id; })[0] || null);
        } else {
            a._doc = true;
            a._title = 'A safety document to read';
            a._sub = 'Document · asked ' + vm.fDate(a.created_at);
            a._tone = 'brand';
            a._icon = 'fa-book';
        }
        return a;
    }

    // A manual change arrives as a bare row (entity_id = sms_document_versions.id). Members may list the club's
    // documents, which carries the live version id, title, type, version label and effective date; the version's
    // change summary comes from the document itself.
    function joinDocuments(seq) {
        var docAcks = vm.acks.filter(function (a) { return a._doc; });
        if (!docAcks.length) { return; }
        SmsService.ListDocuments(vm.club_id).then(function (list) {
            if (seq !== hubSeq || !angular.isArray(list)) { return; }
            docAcks.forEach(function (a) {
                var d = list.filter(function (x) { return +x.current_version_id === +a.entity_id; })[0];
                if (!d) { return; }
                a._title = d.title || a._title;
                a._docType = d.doc_type || 'Document';
                a._version = d.current_version_label || '';
                a._effective = d.current_effective_date || null;
                a._sub = a._docType + (a._version ? ' · version ' + a._version : '');
                SmsService.GetDocument(vm.club_id, d.id).then(function (full) {
                    var v = full && angular.isArray(full.versions) ? full.versions.filter(function (x) { return +x.id === +a.entity_id; })[0] : null;
                    if (v) { a._change = v.change_summary || ''; }
                });
            });
        });
    }

    // Acknowledgement status words (mockup "Words and statuses"): Overdue · 6 days (bad) · Due today / Due Fri 13 Nov (warn within
    // a week) · Asked 3 Nov 2026 (no date set) · Acknowledged 6 Nov 2026 (good). Cached on the row, rebuilt when it changes.
    function daysUntil(s) { var d = pd(s); if (!d) { return null; } var t = pd(TODAY); return Math.round((d - t) / 86400000); }
    vm.ackStatus = function (a) {
        var key = a.acknowledged ? 'done:' + a.acknowledged_at : 'todo:' + (a.due_date || '') + ':' + (a.due_state || '');
        if (!a._st || a._st.key !== key) {
            var st;
            if (a.acknowledged) { st = { grp: 'done', tone: 'good', icon: 'fa-check', label: 'Acknowledged ' + vm.fDate(a.acknowledged_at) }; }
            else if (!a.due_date) { st = { grp: 'todo', tone: 'muted', icon: 'fa-clock', label: 'Asked ' + vm.fDate(a.created_at) }; }
            else {
                var n = daysUntil(a.due_date), state = a.due_state && a.due_state !== 'none' ? a.due_state : (n < 0 ? 'overdue' : n === 0 ? 'due_today' : 'upcoming');
                var over = a.days_overdue || (n < 0 ? -n : 1);
                st = state === 'overdue' ? { grp: 'over', tone: 'bad', icon: 'fa-exclamation-circle', label: 'Overdue · ' + over + (over === 1 ? ' day' : ' days') }
                    : state === 'due_today' ? { grp: 'todo', tone: 'warn', icon: 'fa-clock', label: 'Due today' }
                    : { grp: 'todo', tone: n !== null && n <= 7 ? 'warn' : 'muted', icon: 'fa-clock', label: 'Due ' + vm.fDay(a.due_date) };
            }
            st.key = key;
            a._st = st;
        }
        return a._st;
    };
    vm.pending = function () { return vm.acks.filter(function (a) { return !a.acknowledged; }); };
    vm.overdue = function () { return vm.acks.filter(function (a) { return !a.acknowledged && vm.ackStatus(a).grp === 'over'; }); };
    vm.todo = function () { return vm.acks.filter(function (a) { return !a.acknowledged && vm.ackStatus(a).grp !== 'over'; }); };
    vm.nextDue = function () { return vm.todo().filter(function (a) { return a.due_date; }).sort(function (x, y) { return String(x.due_date) < String(y.due_date) ? -1 : 1; })[0] || null; };
    // the oldest overdue item = the EARLIEST due date (not simply the first row)
    vm.oldestDue = function () { return vm.overdue().map(function (a) { return String(a.due_date || ''); }).filter(Boolean).sort()[0] || ''; };
    // acknowledged, newest signature first (the v2 read's history plus anything signed on this visit)
    vm.signed = function () {
        return vm.acks.filter(function (a) { return a.acknowledged; }).sort(function (x, y) { return String(x.acknowledged_at) < String(y.acknowledged_at) ? 1 : String(x.acknowledged_at) > String(y.acknowledged_at) ? -1 : 0; });
    };
    vm.ackForBulletin = function (b) {
        if (b && b._expired) { return null; }
        return vm.acks.filter(function (a) { return a.entity_type === 'sms_bulletin' && +a.entity_id === +b.id; })[0] || null;
    };

    vm.openAck = function (a) { vm.ackOpen = vm.ackOpen === a ? null : a; vm.sigErr = false; if (vm.ackOpen && a._b) { markRead(a._b); } };
    vm.gotoAck = function (a) { try { sessionStorage.setItem('toaviate_sms_open_ack', String(a.id)); } catch (e) {} $state.go('dashboard.v2.safety_acknowledgements'); };
    vm.later = function () { vm.ackOpen = null; if (vm.screen === 'bulletins') { vm.bOpen = null; } };
    vm.onSig = function () { if (vm.sig && vm.sig.trim().length >= 2) { vm.sigErr = false; } };

    vm.ack = function (a) {
        if (!a || !a._read || a._signing) { return; }
        if (!vm.sig || vm.sig.trim().length < 2) { vm.sigErr = true; ToastService.warning('Type your name', 'It’s your signature.'); return; }
        a._signing = true;
        SmsService.SignAck(vm.club_id, { entity_type: a.entity_type, entity_id: a.entity_id, signature_name: vm.sig.trim() }).then(function (data) {
            a._signing = false;
            if (data && data.success) {
                a.acknowledged = 1;
                a.acknowledged_at = nowStr();
                a.signature_name = vm.sig.trim();
                a._just = true;
                if (a._b) { markRead(a._b); }
                ToastService.success('Acknowledged', a._title);
                $timeout(function () { a._just = false; }, 600);
            } else {
                ToastService.error('Not signed', (data && data.message) || 'Please try again.');
            }
        });
    };

    // "Open the document" (C25): the version's file comes back base64; a tab is opened first so a pop-up blocker lets it through
    vm.openDoc = function (a) {
        if (!a || !a._versionId || a._opening) { return; }
        var w = null;
        try { w = $window.open('', '_blank'); } catch (e) { w = null; }
        a._opening = true;
        SafetyV2Data.DocumentFile(vm.club_id, a._versionId).then(function (r) {
            a._opening = false;
            if (r && r.success && r.data) {
                var url = null;
                try {
                    var bin = atob(r.data), u8 = new Uint8Array(bin.length);
                    for (var i = 0; i < bin.length; i++) { u8[i] = bin.charCodeAt(i); }
                    url = URL.createObjectURL(new Blob([u8], { type: r.type || 'application/pdf' }));
                } catch (e) { url = null; }
                if (url) {
                    if (w && !w.closed) { w.location.href = url; }
                    else { var l = document.createElement('a'); l.href = url; l.download = r.file_name || a._file || 'document'; document.body.appendChild(l); l.click(); document.body.removeChild(l); }
                    $timeout(function () { URL.revokeObjectURL(url); }, 60000);
                    return;
                }
            }
            if (w && !w.closed) { w.close(); }
            ToastService.error('Couldn’t open the document', r && r.error === 'FORBIDDEN' ? 'This version isn’t open to you — ask the safety team for a copy.'
                : r && r.error === 'NOT_FOUND' ? 'There’s no file for this version — ask the safety team for a copy.' : 'Please try again.');
        });
    };

    /* ═════════ YOUR REPORTS (C25: GET sms/v2/my_reports) ═════════ */
    var REP_ST = {
        received: { tone: 'pend', label: 'Received', icon: 'fa-inbox', line: 'With the safety team — nobody has picked it up yet.' },
        under_review: { tone: 'info', label: 'Under review', icon: 'fa-search', line: 'The safety team is looking at the risk and what to do about it.' },
        action_taken: { tone: 'good', label: 'Action taken', icon: 'fa-tools', line: 'Something is changing because of your report.' },
        closed: { tone: 'muted', label: 'Closed', icon: 'fa-check-circle', line: 'Finished — nothing more needs doing.' }
    };
    var REP_ORDER = ['received', 'under_review', 'action_taken', 'closed'];
    var ACT_ST = {
        completed: { tone: 'good', label: 'Done', icon: 'fa-check' }, in_progress: { tone: 'info', label: 'In progress', icon: 'fa-sync-alt' },
        open: { tone: 'pend', label: 'Open', icon: 'fa-inbox' }, overdue: { tone: 'bad', label: 'Overdue', icon: 'fa-exclamation-circle' },
        cancelled: { tone: 'muted', label: 'Cancelled', icon: '' }
    };
    vm.reports = [];
    vm.legend = REP_ORDER.map(function (k) { return { key: k, st: REP_ST[k], meaning: REP_ST[k].line }; });
    vm.repOpen = null;
    function setReports(r) {
        vm.reportsOk = !!(r && r.success && angular.isArray(r.reports));
        if (vm.reportsOk && angular.isArray(r.legend) && r.legend.length) {
            vm.legend = r.legend.filter(function (l) { return REP_ST[l.key]; }).map(function (l) { return { key: l.key, st: REP_ST[l.key], meaning: l.meaning || REP_ST[l.key].line }; });
        }
        vm.reports = vm.reportsOk ? r.reports.filter(function (x) { return !x.club_id || String(x.club_id) === String(vm.club_id); }).map(decorateReport) : [];
        vm.reports.forEach(function (x) { if (x.aerodrome) { reportAirfield(x); } });
    }
    function decorateReport(x) {
        var haz = x.kind === 'hazard', k = REP_ST[x.status_key] ? x.status_key : 'received';
        x._haz = haz;
        x._st = REP_ST[k];
        x._step = REP_ORDER.indexOf(k);
        x._key = x.kind + ':' + x.id;
        x._sub = haz ? 'Hazard' + (x.category ? ' · ' + catLabel(x.category) : '') : 'Occurrence' + (x.severity ? ' · ' + vm.sevLabel(x.severity).toLowerCase() + ' severity' : '');
        x._afName = '';
        x._actions = (x.actions || []).map(function (a) {
            var st = a.is_overdue ? ACT_ST.overdue : (ACT_ST[a.status] || ACT_ST.open);
            return { ref: a.reference, title: a.title, st: st, due: a.due_date && a.status !== 'completed' ? vm.fDate(a.due_date) : '' };
        });
        repTitle(x);
        return x;
    }
    function repTitle(x) {
        x._title = x._haz ? (x.title || 'Hazard report')
            : vm.typeLabel(x.occurrence_type) + (x.aerodrome ? ' at ' + x.aerodrome + (x._afName ? ' ' + x._afName : '') : '');
    }
    var repAf = {};
    function reportAirfield(x) {
        var code = String(x.aerodrome || '').toUpperCase();
        if (code.length !== 4) { return; }
        if (!repAf[code]) {
            repAf[code] = BookoutService.GetAirfieldsByCode(code).then(function (r) {
                var a = r && angular.isArray(r.airfields) ? r.airfields.filter(function (y) { return String(y.code).toUpperCase() === code; })[0] : null;
                return a ? shortAf(a.title) : '';
            });
        }
        repAf[code].then(function (name) { x._afName = name; repTitle(x); });
    }
    vm.openRep = function (x) { vm.repOpen = vm.repOpen === x._key ? null : x._key; };
    vm.repSteps = REP_ORDER.map(function (k) { return REP_ST[k].label; });

    /* bulletins */
    vm.openB = function (b) { vm.bOpen = vm.bOpen === b ? null : b; if (vm.bOpen) { markRead(b); } };
    vm.gotoB = function (b) { try { sessionStorage.setItem('toaviate_sms_open_bulletin', String(b.id)); } catch (e) {} $state.go('dashboard.v2.safety_bulletins'); };
    vm.setFilter = function (f) { vm.filter = f; vm.bOpen = null; };
    // the chip list is rebuilt only when the bulletins or the unread count change (a fresh array on every digest
    // would never settle: ng-repeat compares items by reference)
    function buildChips() {
        var counts = {}, live = vm.bulletins.filter(function (b) { return !b._expired; }), expired = vm.bulletins.length - live.length;
        live.forEach(function (b) { counts[b.bulletin_type] = (counts[b.bulletin_type] || 0) + 1; });
        var out = [{ id: 'all', label: 'All', n: vm.bulletins.length }];
        if (vm.unreadCount) { out.push({ id: 'new', label: 'New', n: vm.unreadCount }); }
        Object.keys(BTYPE).forEach(function (k) { if (counts[k]) { out.push({ id: k, label: BTYPE[k].plural, n: counts[k] }); } });
        if (expired) { out.push({ id: 'expired', label: 'Expired', n: expired }); }
        vm.chipList = out;
        if ((vm.filter === 'new' && !vm.unreadCount) || (vm.filter === 'expired' && !expired)) { vm.filter = 'all'; }
        vm.latestBulletins = live;      // the overview's "Latest bulletins" leaves expired ones out
    }
    vm.latestBulletins = [];
    vm.chipList = [];
    // the live list (current + upcoming) for the chosen filter; expired bulletins sit in their own group under it
    vm.shownBulletins = function () {
        if (vm.filter === 'expired') { return []; }
        return vm.bulletins.filter(function (b) { return !b._expired && (vm.filter === 'all' || (vm.filter === 'new' ? b._new : b.bulletin_type === vm.filter)); });
    };
    vm.expiredBulletins = function () {
        if (vm.filter !== 'all' && vm.filter !== 'expired') { return []; }
        return vm.bulletins.filter(function (b) { return b._expired; });
    };
    var B_ST = {
        todo: { tone: 'warn', icon: 'fa-file-signature', label: 'To acknowledge' },
        done: { tone: 'good', icon: 'fa-check', label: 'Acknowledged' },
        fresh: { tone: 'info', icon: '', label: 'New' },
        upcoming: { tone: 'pend', icon: 'fa-hourglass-start', label: 'Upcoming' },
        expired: { tone: 'muted', icon: 'fa-history', label: 'Expired' }
    };
    vm.bStatus = function (b) {      // shared constant objects: bound in watches, so they must not be rebuilt each digest
        if (b._expired) { return B_ST.expired; }     // no acknowledgement is asked once a bulletin has expired (C11)
        var a = b.requires_ack ? vm.ackForBulletin(b) : null;
        if (a && !a.acknowledged) { return B_ST.todo; }
        if (a && a.acknowledged) { return B_ST.done; }
        if (b._upcoming) { return B_ST.upcoming; }
        if (b._new) { return B_ST.fresh; }
        return null;
    };

    /* ═════════ REPORT FORMS ═════════ */
    vm.kind = vm.screen === 'report_hazard' ? 'haz' : 'occ';
    vm.errs = {};
    vm.planes = [];
    vm.planesLoading = false;
    vm.home = null;              // { code, title } of the club's base airfield
    vm.afName = '';              // name of the typed ICAO code, once known
    vm.sent = null;
    vm.dlg = null;
    var afCache = {};

    function newForm() {
        return { category: null, otype: null, severity: null, title: '', description: '', immediate: '', personnel: '',
            icao: '', when: 'today', date: TODAY, time: null, plane_id: null, anon: false };
    }
    vm.form = newForm();
    vm.datePickerOpts = { allowPast: true, max: TODAY };

    function loadPlanes() {
        vm.planes = [];
        if (!vm.club_id) { return; }
        vm.planesLoading = true;
        var cid = vm.club_id;
        PlaneService.GetAllByClub(cid).then(function (data) {
            if (cid !== vm.club_id) { return; }
            vm.planesLoading = false;
            var list = (data && data.planes) ? data.planes : (angular.isArray(data) ? data : []);
            vm.planes = list.filter(function (p) { return p && p.registration && +p.current_plane !== 0; }).map(function (p) {
                return { id: +(p.plane_id || p.id), reg: p.registration, type: p.plane_type || '' };
            });     // the club's own fleet order
            // aircraft colours (the chip's left edge) come with the scheduler's resources — optional
            AircraftV2Data.aircraftExtras().then(function (x) { vm.planes.forEach(function (pl) { var e = x && x[pl.id]; if (e && e.colour) { pl.colour = e.colour; } }); });
            // an aircraft from the other club doesn't belong to this report
            if (vm.form.plane_id && !vm.planes.some(function (p) { return p.id === vm.form.plane_id; })) {
                vm.form.plane_id = null;
                ToastService.warning('Aircraft cleared', 'It isn’t in ' + vm.clubName + '’s fleet.');
            }
        });
    }
    function loadHome() {
        vm.home = null;
        var c = club();
        if (!c || !c.base_airfield_id) { return; }
        var cid = vm.club_id;
        BookoutService.GetAirfieldById(c.base_airfield_id).then(function (r) {
            if (cid !== vm.club_id) { return; }
            var a = r && r.airfield;
            if (a && a.code) {
                vm.home = { code: String(a.code).toUpperCase(), title: shortAf(a.title) };
                afCache[vm.home.code] = vm.home.title;
                if (!vm.form.icao && !vm.form._icaoTouched) { vm.form.icao = vm.home.code; }
                lookupIcao();
            }
        });
    }
    function shortAf(t) { return String(t || '').replace(/\s+(Aerodrome|Airport|Airfield|International Airport|airport|aerodrome|airfield)$/i, '').trim(); }

    function onReportClubChange() {
        var oldHome = vm.home && vm.home.code;
        loadPlanes();
        clubsLoaded.then(function () {
            // the old club's home code follows the club; a typed code, or an explicit "Not at an airfield", stays as chosen
            if ((!vm.form.icao && !vm.form._icaoTouched) || (oldHome && vm.form.icao === oldHome)) { vm.form.icao = ''; vm.form._icaoTouched = false; }
            loadHome();
        });
    }

    var icaoTimer = null;
    function lookupIcao() {
        var code = (vm.form.icao || '').toUpperCase();
        vm.afName = afCache[code] || '';
        if (code.length !== 4 || afCache.hasOwnProperty(code)) { return; }
        if (icaoTimer) { $timeout.cancel(icaoTimer); }
        icaoTimer = $timeout(function () {
            BookoutService.GetAirfieldsByCode(code).then(function (r) {
                var a = r && angular.isArray(r.airfields) ? r.airfields.filter(function (x) { return String(x.code).toUpperCase() === code; })[0] : null;
                afCache[code] = a ? shortAf(a.title) : '';
                if ((vm.form.icao || '').toUpperCase() === code) { vm.afName = afCache[code]; }
            });
        }, 250);
    }
    vm.onIcao = function () {
        vm.form._icaoTouched = true;
        vm.form.icao = String(vm.form.icao || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
        lookupIcao();
    };
    vm.setIcao = function (code) { vm.form._icaoTouched = true; vm.form.icao = code || ''; lookupIcao(); };
    vm.afLine = function () {
        var c = vm.form.icao || '';
        if (!c) { return 'Not at an airfield'; }
        if (vm.afName) { return vm.afName; }
        return c.length === 4 ? (afCache.hasOwnProperty(c) ? 'Not on our list — it’ll be sent as you typed it' : 'Looking it up…') : 'Keep typing the 4-letter code';
    };
    vm.afKnown = function () { return !!(vm.form.icao && vm.afName); };

    vm.pick = function (field, v) {
        vm.form[field] = v;
        if (vm.errs[field]) { delete vm.errs[field]; }
    };
    vm.setWhen = function (w) {
        vm.form.when = w;
        if (w === 'today') { vm.form.date = TODAY; }
        else if (w === 'yesterday') { vm.form.date = YESTERDAY; }
        else if (vm.form.date === TODAY || vm.form.date === YESTERDAY) { var d = new Date(); d.setDate(d.getDate() - 2); vm.form.date = ymd(d); }
    };
    vm.onDatePicked = function () {
        if (!vm.form.date) { vm.form.date = TODAY; }
        if (vm.form.date > TODAY) { vm.form.date = TODAY; }
        vm.form.when = vm.form.date === TODAY ? 'today' : vm.form.date === YESTERDAY ? 'yesterday' : 'earlier';
    };
    $scope.$watch(function () { return vm.form.date; }, function (v, old) { if (v !== old) { vm.onDatePicked(); } });
    vm.planeOf = function (id) { return vm.planes.filter(function (p) { return p.id === id; })[0] || null; };
    vm.timeText = function () { var t = vm.form.time; return (t instanceof Date) ? pad2(t.getHours()) + ':' + pad2(t.getMinutes()) : ''; };

    vm.onText = function (field, min) {
        if (vm.errs[field] && (vm.form[field] || '').trim().length >= min) { delete vm.errs[field]; }
    };

    function missing() {
        var f = vm.form, m = [];
        if (vm.kind === 'haz') {
            if (!f.category) { m.push(['category', 'Pick the area it’s about', 'saf-f-category', 'area']); }
            if ((f.title || '').trim().length < 3) { m.push(['title', 'Add a short title — at least 3 characters', 'saf-title', 'title']); }
            if ((f.description || '').trim().length < 5) { m.push(['description', 'Tell us what you saw — a sentence is plenty', 'saf-desc', 'what you saw']); }
        } else {
            if (!f.otype) { m.push(['otype', 'Choose the closest type', 'saf-f-otype', 'type']); }
            if (!f.severity) { m.push(['severity', 'Choose how serious it was', 'saf-f-sev', 'how serious']); }
            if ((f.description || '').trim().length < 5) { m.push(['description', 'Tell us what happened — a few sentences is plenty', 'saf-desc', 'what happened']); }
        }
        return m;
    }
    vm.missing = missing;
    vm.leftHint = function () {
        var m = missing();
        return !m.length ? '' : m.length === 1 ? '1 thing left: ' + m[0][3] : m.length + ' things left';
    };
    vm.stepDone = function (n) {
        var f = vm.form;
        if (n === 1) { return vm.kind === 'haz' ? !!f.category : !!(f.otype && f.severity); }
        if (n === 3) { return vm.kind === 'haz' ? ((f.title || '').trim().length >= 3 && (f.description || '').trim().length >= 5) : (f.description || '').trim().length >= 5; }
        return false;
    };
    vm.serious = function () { return vm.form.otype === 'accident' || vm.form.otype === 'serious_incident'; };
    vm.short = function (t, n) { t = (t || '').trim(); return t.length > n ? t.slice(0, n - 2) + '…' : t; };
    function hasContent() {
        var f = vm.form;
        return !!(f.category || f.otype || f.severity || (f.title || '').trim() || (f.description || '').trim() || (f.immediate || '').trim() || (f.personnel || '').trim() || f.plane_id);
    }

    vm.shake = false;
    vm.send = function () {
        if (vm.sending) { return; }
        var m = missing();
        if (m.length) {
            vm.errs = {};
            m.forEach(function (x) { vm.errs[x[0]] = x[1]; });
            vm.shake = true;
            $timeout(function () { vm.shake = false; }, 450);
            ToastService.warning(m.length === 1 ? 'One thing to finish before sending' : m.length + ' things to finish before sending', m[0][1] + '.');
            $timeout(function () { var el = document.getElementById(m[0][2]); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
            return;
        }
        var f = vm.form, when = f.date || TODAY, payload, call;
        if (vm.kind === 'haz') {
            payload = {
                category: f.category, title: f.title.trim(), description: f.description.trim(),
                aerodrome: f.icao || '', immediate_actions: (f.immediate || '').trim(), is_anonymous: f.anon ? 1 : 0,
                // "When did you notice it?" goes in reported_at, the only date a hazard has (plain "YYYY-MM-DD HH:MM:SS")
                reported_at: when === TODAY ? nowStr() : when + ' 00:00:00'
            };
            if (f.plane_id) { payload.plane_id = f.plane_id; }
            call = SmsService.SubmitHazard(vm.club_id, payload);
        } else {
            payload = {
                occurrence_type: f.otype, severity: f.severity, description: f.description.trim(),
                personnel_involved: (f.personnel || '').trim(), aerodrome: f.icao || '',
                // C32: no time given → the date alone (the backend stores occurred_time_given:false), never a fake midnight
                occurred_at: vm.timeText() ? when + ' ' + vm.timeText() + ':00' : when
            };
            if (f.plane_id) { payload.plane_id = f.plane_id; }
            call = SmsService.ReportOccurrence(vm.club_id, payload);
        }
        vm.sending = true;
        call.then(function (data) {
            vm.sending = false;
            if (data && data.success) {
                vm.sent = { kind: vm.kind, ref: data.reference || '', anon: vm.kind === 'haz' && !!f.anon, club: vm.clubName, at: nowStr() };
                $timeout(function () { $window.scrollTo(0, 0); });
            } else {
                ToastService.error('Not sent', (data && data.message) || 'Your report is still here — try again.');
            }
        });
    };
    vm.another = function () { vm.sent = null; vm.errs = {}; vm.form = newForm(); if (vm.home) { vm.form.icao = vm.home.code; lookupIcao(); } };
    // Back asks first when something has been written (the $stateChangeStart guard below opens the dialog)
    vm.backFromForm = function () { vm.go('home'); };
    vm.closeDlg = function () { vm.dlg = null; vm._pendingState = null; };     // Keep writing (design.js restores the v2 switch itself)

    // a refresh / closing the tab with a half-written report asks first (the browser's own prompt)
    function onBeforeUnload(e) {
        if (vm.isReport && !vm.sent && !vm._leaving && hasContent()) { e.preventDefault(); e.returnValue = ''; return ''; }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    $scope.$on('$destroy', function () { window.removeEventListener('beforeunload', onBeforeUnload); });

    // Esc closes the leave dialog
    function onKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && vm.dlg) { $scope.$applyAsync(function () { vm.closeDlg(); }); } }
    document.addEventListener('keydown', onKey);
    $scope.$on('$destroy', function () { document.removeEventListener('keydown', onKey); });

    // A half-written report asks before the page is left by another route (menu, back button)
    $scope.$on('$stateChangeStart', function (event, toState, toParams) {
        if (!vm.isReport || vm.sent || vm._leaving || !hasContent()) { return; }
        if (toState.name === $state.current.name) { return; }
        event.preventDefault();
        vm._pendingState = { name: toState.name, params: toParams };     // the params too (a replay, an aircraft…)
        vm.dlg = 'leave';
    });
    vm.discard = function () {
        vm.dlg = null;
        vm._leaving = true;
        var to = vm._pendingState || { name: 'dashboard.v2.safety', params: {} };
        vm._pendingState = null;
        $state.go(to.name, to.params);
    };

    /* ═════════ start ═════════ */
    if (vm.isHub) {
        loadHub();
        // a row opened from the overview ("Read & acknowledge", a latest bulletin) opens on arrival
        var unwatch = $scope.$watch(function () { return vm.loading; }, function (busy) {
            if (busy) { return; }
            var openAckId = null, openBId = null;
            try { openAckId = sessionStorage.getItem('toaviate_sms_open_ack'); sessionStorage.removeItem('toaviate_sms_open_ack'); } catch (e) {}
            try { openBId = sessionStorage.getItem('toaviate_sms_open_bulletin'); sessionStorage.removeItem('toaviate_sms_open_bulletin'); } catch (e) {}
            if (vm.screen === 'acks' && openAckId) { vm.ackOpen = vm.acks.filter(function (a) { return String(a.id) === openAckId; })[0] || null; if (vm.ackOpen && vm.ackOpen._b) { markRead(vm.ackOpen._b); } }
            if (vm.screen === 'bulletins' && openBId) { vm.bOpen = vm.bulletins.filter(function (b) { return String(b.id) === openBId; })[0] || null; if (vm.bOpen) { markRead(vm.bOpen); } }
            if (!vm.loading && vm.club_id) { unwatch(); }
        });
    }
    if (vm.isReport) {
        loadPlanes();
        clubsLoaded.then(loadHome);
    }
}
