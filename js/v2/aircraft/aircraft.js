/* ═══════════════════════════════════════════════════════════════════════════
   v2 AIRCRAFT — design: mockups/my-account/aircraft.html (approved). Built 8 Nov 2026.
   Three screens, one controller (AircraftV2Controller, dispatched by data.screen):
     • fleet    dashboard.v2.aircraft              /my_account/aircraft_status                 (v1 dashboard.my_account.aircraft_status)
     • one      dashboard.v2.aircraft_one          /my_account/aircraft_status/:registration   (v1 …aircraft_status2 — opens that aircraft)
     • journey  dashboard.v2.aircraft_journey_log  /my_account/aircraft_journey_log/:plane_id  (v1 …aircraft_journey_log)
   Same server calls as v1 (AircraftStatusController / AircraftJourneyLogsController): planes/{user}/user_maintenance,
   planes/get_journey_log, plane_tech_log_sheets, aircraft_checks, lubricant_receipts, the plane document file routes,
   manual flights and the journey-log export. Views: views/v2/aircraft/*. Styles: css/v2/aircraft.css (.acs-*).

   Rules from the approved design:
   • One status helper (acStatus): Grounded → No maintenance record → Maintenance overdue → Document expired →
     No-fly defect → Maintenance due soon (≤ 5 h / ≤ 10 days) → Document expiring (≤ 30 days) → Defect open → Serviceable.
     "Maintenance" is the scheduled work; a check / transit check is the pilot's own check — never a bare "check".
   • The hours/days meters EMPTY like a fuel gauge as time runs out (owner decision).
   • Grounded comes from the maintenance booking covering now (backend C5: grounded, grounded_since/until/by).
   • The journey log always shows brakes off → brakes on; only the rounding follows the club (TimeDisplayService,
     window pinned to 'block'); the Times dialog changes the rounding for this viewer only.
   Hidden until the backend sends them: last maintenance date + hours flown since it, "out flying since" (location.out),
   reporter names on defects (shown only as "you"), the extra fields of backend-companion §8 "aircraft".
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    function st(url, view, screen) {
        return { url: url, templateUrl: 'views/v2/aircraft/' + view + '.html', controller: 'AircraftV2Controller', controllerAs: 'vm', data: { screen: screen } };
    }
    $stateProvider
        .state('dashboard.v2.aircraft', st('/my_account/aircraft_status', 'fleet', 'fleet'))
        .state('dashboard.v2.aircraft_one', st('/my_account/aircraft_status/:registration', 'one', 'one'))
        .state('dashboard.v2.aircraft_journey_log', st('/my_account/aircraft_journey_log/:plane_id', 'journey', 'journey'));
    DesignRoutesProvider
        .map('dashboard.my_account.aircraft_status', 'dashboard.v2.aircraft')
        .map('dashboard.my_account.aircraft_status2', 'dashboard.v2.aircraft_one')
        .map('dashboard.my_account.aircraft_journey_log', 'dashboard.v2.aircraft_journey_log');
}]);

/* The big maintenance payload (every club, aircraft, defect and check) is shared by the fleet and the one-aircraft page:
   kept for a minute so opening an aircraft from the fleet is instant. Writes update the cached objects in place. */
app.factory('AircraftV2Data', AircraftV2Data);
AircraftV2Data.$inject = ['PlaneService', 'SchedulerV2Service', '$q'];
function AircraftV2Data(PlaneService, SchedulerV2Service, $q) {
    var TTL = 60000, cache = null, extras = null;
    var service = { maintenance: maintenance, aircraftExtras: aircraftExtras, drop: drop };
    return service;

    function maintenance(user_id, force) {
        if (!force && cache && cache.user === user_id && (Date.now() - cache.at) < TTL) { return cache.p; }
        var p = PlaneService.GetByUserMaintenance(user_id).then(function (data) {
            if (!data || data.success === false || !angular.isArray(data.clubs)) { cache = null; }
            return data;
        });
        cache = { user: user_id, at: Date.now(), p: p };
        return p;
    }
    // Colour, model and seats per aircraft: the maintenance payload has none of them; the v2 scheduler's day
    // resources do (one call, cached for the session). Optional — the pages work without it.
    function aircraftExtras() {
        if (extras) { return extras; }
        var d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        extras = SchedulerV2Service.GetDay({ date: day, days: 1 }).then(function (res) {
            var out = { ins: {} };
            ((res && res.resources && res.resources.aircraft) || []).forEach(function (a) { out[+a.id] = { colour: a.colour || null, model: a.model || '', seats: +a.seats || null }; });
            // instructors' own colours + codes: the initials circle on a flight is the instructor's, as on the scheduler
            ((res && res.resources && res.resources.instructors) || []).forEach(function (i) { out.ins[+i.id] = { colour: i.colour || null, code: i.code || '' }; });
            return out;
        }, function () { return { ins: {} }; });
        extras.then(function (o) { if (!o || Object.keys(o).length < 2) { extras = null; } });
        return extras;
    }
    function drop() { cache = null; }
}

app.controller('AircraftV2Controller', AircraftV2Controller);
AircraftV2Controller.$inject = ['AircraftV2Data', 'BookoutService', 'PlaneService', 'AircraftChecksService', 'DefectMediaService', 'TimeDisplayService', 'LogbookExportService',
    'ManualFlightService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$timeout', '$q', '$http', '$uibModal', '$window', '$log'];
function AircraftV2Controller(AircraftV2Data, BookoutService, PlaneService, AircraftChecksService, DefectMediaService, TimeDisplayService, LogbookExportService,
    ManualFlightService, ToastService, $rootScope, $scope, $state, $stateParams, $timeout, $q, $http, $uibModal, $window, $log) {
    var vm = this;
    vm.screen = $state.current.data.screen;
    vm.user = $rootScope.globals.currentUser;
    vm.user_id = vm.user.id;
    var CLUB_KEY = 'toaviate_acs_club';

    /* ═════════ formatting (server strings are club wall-clock; never new Date(str)) ═════════ */
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function pd(s) {
        if (!s) { return null; }
        var p = String(s).replace('T', ' ').split(' '), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    }
    function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    var TODAY = ymd(new Date());                     // local date — v1 used the UTC date (wrong 00:00–01:00 in summer)
    vm.fDate = function (s) { var d = pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    vm.fDay = function (s) { var d = pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
    vm.fDayLong = function (s) { var d = pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    vm.fDayFull = function (s) { var d = pd(s); return d ? DOWL[d.getDay()] + ' ' + d.getDate() + ' ' + MONL[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    vm.fTime = function (s) { var t = String(s || '').replace('T', ' ').split(' ')[1]; return t ? t.slice(0, 5) : ''; };
    var THIS_YEAR = String(new Date().getFullYear());
    // "Thu 22 Oct" this year, "Sat 12 Dec 2020" otherwise
    vm.fDayY = function (s) { var d = pd(s); return d ? vm.fDay(s) + (String(d.getFullYear()) === THIS_YEAR ? '' : ' ' + d.getFullYear()) : ''; };
    vm.dayLabel = function (s) { return String(s || '').slice(0, 10) === TODAY ? 'Today' : vm.fDayY(s); };
    // placeholder dates (a 1908 ARC, a "0000-00-00") mean "not recorded", never "expired 117 years ago"
    function realDate(s) { var d = pd(s); return !!(d && d.getFullYear() >= 1950); }
    vm.realDate = realDate;
    function daysTo(s) { var a = pd(TODAY), b = pd(s); return (a && b) ? Math.round((b - a) / 86400000) : null; }
    function hm(h) { var m = Math.round(Math.abs(h) * 60); return Math.floor(m / 60) + ':' + pad2(m % 60); }
    function hmSigned(h) { return (h < 0 ? '−' : '') + hm(h); }
    function nf1(n) { var x = parseFloat(n); return isNaN(x) ? '—' : x.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    vm.nf1 = nf1;
    function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }
    vm.plural = plural;
    function initial(n) { return n ? String(n).charAt(0) + '.' : ''; }
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
    function tidy(t) { return titleCaps(t); }
    // "CESSNA AIRCRAFT COMPANY -" → "Cessna"; "PIPER AIRCRAFT CORPORATION CHEROKEE ARROW" → "Piper Cherokee Arrow"
    function tidyModel(m) {
        m = String(m || '').replace(/\s+-\s*$/, '').replace(/\b(aircraft|company|corporation|corp|inc|ltd|limited|industries)\b\.?/gi, '').replace(/\s{2,}/g, ' ').trim();
        return m === '-' ? '' : tidy(m);
    }
    function shortAf(t) { return String(t || '').replace(/\s+(international\s+)?(aerodrome|airport|airfield)$/i, '').trim(); }
    vm.shortAf = shortAf;

    /* ═════════ the one status helper per domain (raw values never reach the screen) ═════════ */
    var SEV = {
        'No Fly Item - Ground the plane': { k: 'nofly', label: 'No-fly', tone: 'bad', ic: 'fa-ban', sub: 'Not safe to fly — the aircraft should not fly until it is looked at' },
        'Flyable - needs to be checked at next maintenance': { k: 'maint', label: 'Flyable', tone: 'warn', ic: 'fa-wrench', sub: 'Check at the next maintenance' },
        'Not urgent - but needs noting': { k: 'note', label: 'Not urgent', tone: 'muted', ic: 'fa-sticky-note', sub: 'Needs noting' },
        'Unsure of severity': { k: 'unsure', label: 'Severity unsure', tone: 'info', ic: 'fa-question-circle', sub: 'Not sure how severe' }
    };
    var SEV_ORDER = ['No Fly Item - Ground the plane', 'Flyable - needs to be checked at next maintenance', 'Not urgent - but needs noting', 'Unsure of severity'];
    vm.sevOptions = SEV_ORDER.map(function (k) { return angular.extend({ value: k }, SEV[k]); });
    vm.sev = function (d) { return SEV[d && d.severity] || SEV['Unsure of severity']; };
    var DSTAT = { open: { tone: 'warn', label: 'Open', ic: 'fa-exclamation-circle' }, deferred: { tone: 'info', label: 'Deferred to next maintenance', ic: 'fa-calendar-alt' },
        resolved: { tone: 'good', label: 'Fixed', ic: 'fa-check' }, closed: { tone: 'muted', label: 'Closed', ic: 'fa-check' } };
    var DSTAT_OTHER = { tone: 'muted', label: 'Recorded', ic: 'fa-circle' };
    vm.dstat = function (d) { return DSTAT[d && d.status] || DSTAT_OTHER; };
    function isLive(d) { return d.status === 'open' || d.status === 'deferred'; }

    var WARN_DAYS = 30;   // AircraftAirworthiness::EXPIRY_WARN_DAYS — the backend's own warning window for documents
    function hTone(h) { return h <= 0 ? 'bad' : h <= 5 ? 'warn' : 'good'; }
    function dTone(d) { return d <= 0 ? 'bad' : d <= 10 ? 'warn' : 'good'; }
    // the bars EMPTY like a fuel gauge as hours / days run out (a sliver stays while any time is left)
    function barPct(left, interval) { return Math.max(left > 0 ? 4 : 0, Math.min(100, Math.round(left / (interval || 1) * 100))); }

    function pill(tone, label, ic) { return { tone: tone, label: label, ic: ic || '' }; }

    /* documents: one row shape for every certificate the payload carries */
    function docList(p) {
        var L = [], ptf = p.airworthiness_type === 'ptf', aw = p.airworthiness_document || p.arc || null;
        if (!ptf) {
            if (aw && (aw.certificate || aw.date_expiry)) { L.push({ k: 'arc', t: aw.label || 'Airworthiness review certificate (ARC)', ic: 'fa-certificate', doc: aw, route: aw.document_route === 'plane_arc' ? 'plane_arc' : 'plane_certificate' }); }
            if (p.certificate && p.certificate.certificate) { L.push({ k: 'cert', t: 'Certificate of airworthiness', ic: 'fa-stamp', doc: p.certificate, route: 'plane_certificate', noExpiry: !p.certificate.date_expiry, sub0: 'Doesn’t expire — the ARC keeps it valid' }); }
        } else {
            var pc = aw || p.certificate;
            if (pc) { L.push({ k: 'cert', t: 'Permit to fly', ic: 'fa-stamp', doc: pc, route: pc.document_route === 'plane_arc' ? 'plane_arc' : 'plane_certificate' }); }
        }
        if (p.insurance) { L.push({ k: 'ins', t: 'Insurance', ic: 'fa-shield-alt', doc: p.insurance, route: 'plane_insurance' }); }
        if (p.radio_licence) { L.push({ k: 'radio', t: 'Radio licence', ic: 'fa-broadcast-tower', doc: p.radio_licence, route: 'plane_radio_licence', noExpiry: !p.radio_licence.date_expiry && !!p.radio_licence.certificate, sub0: 'Doesn’t expire' }); }
        if (p.noise_certificate && p.noise_certificate.certificate) { L.push({ k: 'noise', t: 'Noise certificate', ic: 'fa-volume-down', doc: p.noise_certificate, route: 'plane_noise_certificate', noExpiry: true, sub0: 'Doesn’t expire' }); }
        if (p.crs && p.crs.certificate) { L.push({ k: 'crs', t: 'Certificate of release to service (CRS)', ic: 'fa-file-signature', doc: p.crs, route: 'plane_crs', crs: true }); }
        L.forEach(function (d) {
            d.file = d.doc && d.doc.certificate;
            if (d.crs) { d.tone = 'good'; d.pill = pill('good', 'Released', 'fa-check'); d.sub = 'Released ' + vm.fDate(d.doc.release_date) + (d.doc.release_time ? ' at ' + String(d.doc.release_time).slice(0, 5) : ''); return; }
            if (d.noExpiry || (d.doc && d.doc.expires === false)) { d.tone = 'good'; d.pill = pill('muted', 'No expiry'); d.sub = d.sub0 || 'Doesn’t expire'; return; }
            if (!d.doc || !d.doc.date_expiry || !realDate(d.doc.date_expiry)) {
                // a blank expiry is "not on file", never "expired" (backend B8 does the same)
                d.tone = 'quiet'; d.pill = pill('muted', 'No date on file', 'fa-question-circle'); d.sub = d.file ? 'No expiry date on file — ask the club' : 'Not on file — ask the club'; return;
            }
            d.days = daysTo(d.doc.date_expiry);
            d.sub = (d.days <= 0 ? 'Expired ' : 'Expires ') + vm.fDate(d.doc.date_expiry);
            if (d.days <= 0) { d.tone = 'bad'; d.pill = pill('bad', 'Expired', 'fa-times-circle'); }
            else if (d.days <= WARN_DAYS) { d.tone = 'warn'; d.pill = pill('warn', plural(d.days, 'day') + ' left', 'fa-hourglass-half'); }
            else { d.tone = 'good'; d.pill = pill('good', plural(d.days, 'day') + ' left', 'fa-check'); }
        });
        return L;
    }
    function docShort(d) { return { arc: 'ARC', cert: d.t === 'Permit to fly' ? 'Permit' : 'Certificate', ins: 'Insurance', radio: 'Radio licence', noise: 'Noise certificate', crs: 'CRS' }[d.k]; }

    function noRecord(p) { return !(p.maintenance && p.maintenance.next_maintenance); }
    function isGrounded(p) { return !!p.grounded || +p.in_maintenance === 1; }

    var METER = { tacho: 'Tacho', hobbs: 'Hobbs' };
    function chargeType(p) { return (p.charges && p.charges.charge_type) || p.charge_type || ''; }
    function meterOf(p) {
        var lab = METER[chargeType(p)], r = p.location ? p.location.meter_reading : null;
        if (r === '' || r === undefined) { r = null; }
        if (!lab && r == null) { return null; }     // charged on block / airborne time and no reading: no meter
        var out = !!(p.location && p.location.meter_warning);
        return { tone: '', v: r == null ? '—' : nf1(r), s: r == null ? 'No reading yet' : out ? 'before the last flight' : 'at the last book-in', label: lab || 'Meter' };
    }
    function figHours(p) {
        var m = p.maintenance || {};
        if (noRecord(p)) { return { tone: 'bad', v: '—', s: 'No record' }; }
        var h = parseFloat(m.hours_remaining) || 0, t = hTone(h), every = +p.hours_between_checks || 0;
        return { tone: t, v: hmSigned(h), s: t === 'bad' ? 'Overdue' : t === 'warn' ? 'Due soon' : (every ? 'every ' + every + ' hours' : 'left'), pct: barPct(h, every || 50) };
    }
    function noDate(p) { var m = p.maintenance || {}; return !noRecord(p) && !realDate(m.next_maintenance); }
    function figDays(p) {
        var m = p.maintenance || {};
        if (noRecord(p)) { return { tone: 'bad', v: '—', s: 'No record' }; }
        if (noDate(p)) { return { tone: 'quiet', v: '—', s: 'No date recorded', unit: '' }; }
        var d = parseInt(m.days_remaining, 10) || 0, t = dTone(d), when = vm.fDate(m.next_maintenance);
        if (d < -365) { return { tone: 'bad', v: 'Over a year', words: true, unit: 'overdue', s: 'Overdue · was due ' + when, pct: 0 }; }
        return { tone: t, v: String(d).replace('-', '−'), unit: 'days', s: (t === 'bad' ? 'Was due ' : t === 'warn' ? 'Due by ' : 'by ') + when, pct: barPct(d, parseFloat(m.normal_limit) || 365) };
    }

    function acStatus(p) {
        var m = p.maintenance || {}, docs = p._docs, open = p._open;
        var nofly = open.filter(function (d) { return vm.sev(d).k === 'nofly'; });
        var expired = docs.filter(function (d) { return d.tone === 'bad'; }), soon = docs.filter(function (d) { return d.tone === 'warn'; });
        var h = parseFloat(m.hours_remaining) || 0, dd = noDate(p) ? 9999 : (parseInt(m.days_remaining, 10) || 0);     // no real date: only hours decide
        if (isGrounded(p)) {
            var why = 'Out of service' + (p.grounded_since ? ' since ' + vm.fDay(p.grounded_since) + ' ' + vm.fTime(p.grounded_since) : '')
                + (p.grounded_until ? ', booked for maintenance until ' + (String(p.grounded_until).slice(0, 10) === TODAY ? vm.fTime(p.grounded_until) : vm.fDay(p.grounded_until) + ' ' + vm.fTime(p.grounded_until)) : '')
                + (p.grounded_by && p.grounded_by.name ? ' by ' + p.grounded_by.name : '')
                + (nofly[0] ? ': ' + String(nofly[0].defect).toLowerCase() : '') + '. Check with the club before you book it.';
            return { k: 'grounded', tone: 'bad', label: 'Grounded', ic: 'fa-ban', why: why };
        }
        if (noRecord(p)) { return { k: 'norecord', tone: 'bad', label: 'No maintenance record', ic: 'fa-question-circle', why: 'The club has no record of its last maintenance, so its hours and days can’t be worked out. Check with the club before you book it.' }; }
        if (h <= 0 || dd <= 0) { return { k: 'overdue', tone: 'bad', label: 'Maintenance overdue', ic: 'fa-times-circle', why: h <= 0 ? 'Over its hours by ' + hm(-h) + ' — it needs maintenance before it flies.' : 'Maintenance was due ' + vm.fDate(m.next_maintenance) + '.' }; }
        if (expired.length) { return { k: 'expired', tone: 'bad', label: 'Document expired', ic: 'fa-times-circle', why: expired[0].t + ' expired on ' + vm.fDate(expired[0].doc.date_expiry) + '.' }; }
        if (nofly.length) { return { k: 'nofly', tone: 'bad', label: 'No-fly defect', ic: 'fa-ban', why: nofly[0].defect + '.' }; }
        if (h <= 5 || dd <= 10) { return { k: 'due', tone: 'warn', label: 'Maintenance due soon', ic: 'fa-hourglass-half', why: h <= 5 ? 'Only ' + hm(h) + ' left before its next maintenance — longer flights may not fit.' : 'Its next maintenance is due in ' + plural(dd, 'day') + '.' }; }
        if (soon.length) { return { k: 'doc', tone: 'warn', label: 'Document expiring', ic: 'fa-file-alt', why: soon[0].t + ' expires in ' + plural(soon[0].days, 'day') + ' (' + vm.fDate(soon[0].doc.date_expiry) + ').' }; }
        if (open.length) { return { k: 'defect', tone: 'warn', label: 'Defect open', ic: 'fa-tools', why: plural(open.length, 'open defect') + ': ' + String(open[0].defect).toLowerCase() + '.' }; }
        return { k: 'ok', tone: 'good', label: 'Serviceable', ic: 'fa-check', why: '' };
    }

    /* ═════════ flights: one entry everywhere (PIC, PUT, from → to by name, brakes off → on, block) ═════════ */
    var tdCtx = {};
    function td(clubId) {
        var k = String(clubId || 0);
        if (!tdCtx[k]) { tdCtx[k] = TimeDisplayService.context(clubId || null, { window: 'block' }); }
        return tdCtx[k];
    }
    function person(first, last, id) {
        if (!first && !last) { return null; }
        var me = id && +id === +vm.user_id;
        return { id: id || null, me: me, short: me ? 'You' : (initial(first) + ' ' + (last || '')).trim(), full: me ? 'You' : ((first || '') + ' ' + (last || '')).trim() };
    }
    function decorateLog(l, clubId) {
        // PIC / PUT: v1's get_pic / get_put rules
        var pic = null, put = null, picIsIns = false;
        if (l.pic_first_name) { pic = person(l.pic_first_name, l.pic_last_name, l.pic_id); picIsIns = !!(l.instructor_id && +l.pic_id === +l.instructor_id); }
        else if (l.instructor_first_name) { pic = person(l.instructor_first_name, l.instructor_last_name, l.instructor_id); picIsIns = true; }
        else if (!+l.instructor_id && l.first_name) { pic = person(l.first_name, l.last_name, l.user_id); }
        if (l.put_first_name) { put = person(l.put_first_name, l.put_last_name, l.put_id); }
        else if (+l.instructor_id > 0 && l.first_name) { put = person(l.first_name, l.last_name, l.user_id); }
        if (pic && put && pic.full === put.full) { put = null; }
        l._pic = pic; l._put = put; l._picIns = picIsIns;
        l._picInitials = pic && !pic.me ? ((l.pic_first_name || l.instructor_first_name || '').charAt(0) + (l.pic_last_name || l.instructor_last_name || '').charAt(0)).toUpperCase() : '';
        var insX = picIsIns && extras.ins ? extras.ins[+(l.pic_first_name ? l.pic_id : l.instructor_id)] : null;
        if (insX && insX.code) { l._picInitials = insX.code; }
        l._insColour = insX && insX.colour ? insX.colour : null;
        l._solo = +l.authorised_solo === 1;
        l._ins = l.instructor_first_name ? (l.instructor_first_name + ' ' + (l.instructor_last_name || '')).trim() : '';
        l._from = shortAf(l.departure_airport) || l.departure_airport_code || '—';
        l._to = shortAf(l.destination_airport) || l.destination_airport_code || '—';
        var ctx = td(clubId || l.club_id);
        l._t = TimeDisplayService.pick(l, ctx.mode, { window: 'block' });
        var ex = TimeDisplayService.pick(l, 'block_exact', { window: 'block' }), rd = TimeDisplayService.pick(l, 'block_rounded', { window: 'block' });
        l._ex = ex; l._rd = rd;
        var air = TimeDisplayService.pick(l, ctx.def.rounded ? 'airborne_rounded' : 'airborne_exact', { window: 'airborne' });
        l._air = (air.window === 'airborne' && !air.missing) ? air : null;
        var fs = +l.full_stop_landings || 0, tg = +l.touch_and_go || 0;
        l._ldg = (fs || tg) ? [fs ? plural(fs, 'full stop') : '', tg ? tg + ' touch-and-go' : ''].filter(Boolean).join(' · ') : 'None recorded';
        var fu = parseFloat(l.fuel_uplift_litres) || 0, ou = parseFloat(l.oil_uplift_litres) || 0;
        l._up = (fu ? '+' + nf1(fu).replace(/\.0$/, '') + ' L' : '') + (ou ? (fu ? ' · ' : '+') + nf1(ou).replace(/\.0$/, '') + ' qt' : '');
        l._fuel = fu ? nf1(fu).replace(/\.0$/, '') + ' litres' : 'None';
        l._oil = ou ? nf1(ou).replace(/\.0$/, '') + ' quarts' : 'None';
        l._replay = !!(l.has_track && l.id);
        l._hay = null;
        return l;
    }
    vm.replay = function (l) { if (l && l._replay) { $state.go('dashboard.flight_replay', { flight_id: l.id }); } };

    /* ═════════ decorate an aircraft ═════════ */
    var extras = {};
    function decoratePlane(p, club) {
        p._club = club;
        p._docs = docList(p);
        p.defects = p.defects || [];
        p._open = p.defects.filter(function (d) { return d.status === 'open'; });
        p._live = p.defects.filter(isLive);
        p._older = p.defects.length - p._live.length;
        p._st = acStatus(p);
        p._hours = figHours(p);
        p._days = figDays(p);
        p._meter = meterOf(p);
        p._logs = (p.logs || []).map(function (l) { return decorateLog(l, club.id); }).sort(function (a, b) {
            var ka = String(a.flight_date) + ' ' + String(a.brakes_off || ''), kb = String(b.flight_date) + ' ' + String(b.brakes_off || '');
            return ka < kb ? 1 : ka > kb ? -1 : 0;
        });
        if (!p._checksAll) { p._checks = angular.isArray(p.aircraft_checks) ? p.aircraft_checks : (angular.isArray(p.checks_today) ? p.checks_today : (p._checks || [])); }
        p._receipts = (p.receipts || []).slice().sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? 1 : -1; });
        outState(p);      // before lines(): the flight line reads it
        lines(p);
        var bad = p._docs.filter(function (d) { return d.tone === 'bad'; }), soon = p._docs.filter(function (d) { return d.tone === 'warn'; });
        p._docTone = bad.length ? 'bad' : soon.length ? 'warn' : 'good';
        p._docValid = p._docs.length - bad.length;
        p._docTileS = bad.length ? bad[0].t + ' expired' : soon.length ? docShort(soon[0]) + ': ' + plural(soon[0].days, 'day') + ' left' : 'All in date';
        p._defTone = p._open.some(function (d) { return vm.sev(d).k === 'nofly'; }) ? 'bad' : p._open.length ? 'warn' : 'good';
        p._restr = [+p.nav_only ? 'Nav only' : '', +p.dual_only ? 'Dual only' : ''].filter(Boolean).join(' · ') || 'None';
        p._here = p.location && p.location.location ? (p.location.location.code ? p.location.location.code + ' ' : '') + shortAf(p.location.location.title) : '';
        p._fees = fees(p);
        var ht = p._hours.tone, dt = p._days.tone === 'quiet' ? 'good' : p._days.tone;     // "no date recorded" doesn't make it due
        p._maintPill = p._hours.v === '—' ? pill('bad', 'No record', 'fa-question-circle')
            : (ht === 'good' && dt === 'good') ? pill('good', 'In hours', 'fa-check')
            : (ht === 'bad' || dt === 'bad') ? pill('bad', 'Overdue', 'fa-times-circle') : pill('warn', 'Due soon', 'fa-hourglass-half');
        p._needA = !!+p.requires_check_a;
        p._model = p._model || '';
        p._hay = (p.registration + ' ' + String(p.registration).replace('-', '') + ' ' + (p.plane_type || '') + ' ' + p._model).toLowerCase();
        applyExtras(p);
        return p;
    }
    /* C24: location.out {since, by, pilot, booking_id, landed, stale} | null — an open book-out. Without the key (an older
       backend) the meter warning ("last flight has not booked back in yet") is all there is. */
    function outState(p) {
        var loc = p.location || {}, o = loc.out;
        p._out = null;
        if (loc.hasOwnProperty('out')) {
            if (o) {
                var who = o.pilot || o.by, me = who && +who.id === +vm.user_id;
                var at = o.since ? (String(o.since).slice(0, 10) === TODAY ? vm.fTime(o.since) : vm.fDay(o.since) + ' ' + vm.fTime(o.since)) : '';
                p._out = { k: o.stale ? 'stale' : o.landed ? 'landed' : 'flying', at: at, day: o.since ? vm.fDay(o.since) : '', with: who ? (me ? 'you' : who.name) : '' };
            }
            p._notBookedIn = !!(p._out && p._out.k !== 'flying');
        } else {
            p._notBookedIn = !!loc.meter_warning;
        }
        p._outTag = !p._out ? (p._notBookedIn ? 'Not booked back in yet' : '')
            : p._out.k === 'flying' ? 'Out flying' + (p._out.at ? ' since ' + p._out.at : '')
            : p._out.k === 'landed' ? 'Landed — not booked back in yet'
            : 'Not booked back in' + (p._out.day ? ' since ' + p._out.day : '');
        p._outNow = !p._out ? p._outTag
            : p._out.k === 'flying' ? p._outTag + (p._out.with ? ' with ' + p._out.with : '')
            : p._outTag;
    }
    function lines(p) {
        var live = p._live, open = p._open;
        if (!live.length) { p._lnDef = { rest: 'None reported' }; }
        else {
            var lead = open[0] || live[0];
            p._lnDef = { tone: p._open.some(function (d) { return vm.sev(d).k === 'nofly'; }) ? 'bad' : open.length ? 'warn' : '',
                b: [open.length ? open.length + ' open' : '', live.length > open.length ? (live.length - open.length) + ' deferred' : ''].filter(Boolean).join(' · '), rest: lead.defect };
        }
        var docs = p._docs, bad = docs.filter(function (d) { return d.tone === 'bad'; }), soon = docs.filter(function (d) { return d.tone === 'warn'; });
        var ren = docs.filter(function (d) { return d.days != null; }).sort(function (a, b) { return a.days - b.days; })[0];
        if (bad.length) { p._lnDoc = { tone: 'bad', b: docShort(bad[0]) + ' expired', rest: vm.fDate(bad[0].doc.date_expiry) }; }
        else if (soon.length) { p._lnDoc = { tone: 'warn', b: docShort(soon[0]) + ' expires in ' + plural(soon[0].days, 'day'), rest: vm.fDate(soon[0].doc.date_expiry) }; }
        else { p._lnDoc = { rest: 'All in date' + (ren ? ' · ' + docShort(ren) + ' next, ' + vm.fDate(ren.doc.date_expiry) : '') }; }
        var c = (p._checks || []).filter(function (x) { return String(x.checked_at || '').slice(0, 10) === TODAY; })[0];
        if (!c) { p._lnChk = { rest: isGrounded(p) ? 'None today · out of service' : 'None yet today' }; }
        else { p._lnChk = { b: vm.checkName(c), rest: (c.first_name ? initial(c.first_name) + ' ' + (c.last_name || '') + ' at ' : 'At ') + vm.fTime(c.checked_at) + ' · ' + nf1(c.fuel_us_gallons) + ' US gal, ' + nf1(c.oil_quarts) + ' qt' }; }
        var l = p._logs[0];
        if (p._out && p._out.k === 'flying') { p._lnFlt = { b: 'Out flying', rest: (p._out.at ? 'since ' + p._out.at : '') + (p._out.with ? (p._out.at ? ' ' : '') + 'with ' + p._out.with : '') }; }
        else if (p._out && p._out.k === 'landed') { p._lnFlt = { b: 'Landed', rest: 'not booked back in yet' + (p._out.with ? ' · ' + p._out.with : '') }; }
        else if (p._out) { p._lnFlt = { b: 'Not booked back in', rest: 'out since ' + p._out.at + (p._out.with ? ' with ' + p._out.with : '') }; }
        else if (p._notBookedIn) { p._lnFlt = { b: 'Not booked back in yet', rest: l ? 'last flight ' + vm.dayLabel(l.flight_date) : '' }; }
        else if (!l) { p._lnFlt = { rest: 'No flights yet' }; }
        else { p._lnFlt = { wrap: true, b: vm.dayLabel(l.flight_date), route: l._from + ' → ' + l._to, brakes: 'Brakes ' + l._t.from + ' → ' + l._t.to, pic: l._pic ? 'PIC ' + l._pic.short : '', put: l._put ? 'PUT ' + l._put.short : '' }; }
    }

    vm.checkName = function (c) {
        if (!c) { return ''; }
        if (c.check_type_name) { return c.check_type_name; }
        if (c.role === 'a_check' || c.check_type === 'check_a') { return 'A check'; }
        if (c.role === 'transit' || c.check_type === 'transit_check') { return 'Transit check'; }
        return c.check_type ? tidy(String(c.check_type).replace(/_/g, ' ')) : 'Check';
    };
    // the check's performer: an instructor gets their initials circle (own colour), anyone else the grey member icon
    vm.checkIns = function (c) { return (extras.ins && extras.ins[+c.performed_by]) || null; };
    vm.checkTone = function (c) { return (c.role === 'a_check' || c.check_type === 'check_a') ? 'good' : (c.role === 'transit' || c.check_type === 'transit_check') ? 'info' : 'muted'; };
    vm.checkIcon = function (c) { return vm.checkTone(c) === 'good' ? 'fa-clipboard-check' : vm.checkTone(c) === 'info' ? 'fa-sync-alt' : 'fa-clipboard'; };
    vm.isToday = function (s) { return String(s || '').slice(0, 10) === TODAY; };
    vm.today = TODAY;
    vm.pastOnly = { allowPast: true, max: TODAY };
    vm.$stateRegistration = $stateParams.registration || '';
    vm.hasA = function (p) { return (p._checks || []).some(function (c) { return vm.isToday(c.checked_at) && (c.role === 'a_check' || c.check_type === 'check_a'); }); };
    vm.checksShown = function (p) { return p._checksAll ? (p._checks || []) : (p._checks || []).filter(function (c) { return vm.isToday(c.checked_at); }); };
    vm.defectNames = function (p) { return p._live.map(function (d) { return d.defect; }).join(' · '); };
    vm.curIcon = function (p) { var c = p && p._club && (p._club.currency || p._club.account_currency); return c === 'EUR' ? 'fa-euro-sign' : c === 'USD' ? 'fa-dollar-sign' : 'fa-pound-sign'; };
    vm.maintPill = function (p) { return p._maintPill; };
    // C24: maintenance.last {date, type, hours_since} — the last real check (extensions skipped) and the hours flown since it.
    // An older backend sends neither: then the interval minus what's left (wrong after an extension, so only as a fallback).
    var MTYPE = { annual: 'annual', '25hours': '25-hour', '50hours': '50-hour', '100hours': '100-hour', interim: 'interim', '6months': '6-month', workpack: 'work pack' };
    vm.flownSince = function (p) {
        var m = p.maintenance || {};
        if (m.last && m.last.hours_since != null) { return hm(Math.max(0, parseFloat(m.last.hours_since) || 0)); }
        var every = +p.hours_between_checks || 0, left = parseFloat(m.hours_remaining) || 0;
        return every && !m.hasOwnProperty('last') ? hm(Math.max(0, every - left)) : '';
    };
    vm.lastMaint = function (p) {
        var l = p.maintenance && p.maintenance.last;
        if (!l || !l.date) { return ''; }
        var t = l.type && MTYPE[String(l.type).toLowerCase()];
        return (t ? 'the ' + t + ' check on ' : '') + vm.fDate(l.date);
    };
    vm.roundingShort = function (p) { var c = td(p && p._club ? p._club.id : null); return c.def && c.def.rounded ? 'rounded to 5 min' : 'exact'; };

    /* fees: the club's currency, words for the charge type (v1 printed "per brakes_rounded hour" with a hard-coded £) */
    var CUR = { GBP: '£', EUR: '€', USD: '$' };
    var CHARGE = {
        tacho: ['tacho hour', 'Charged on the tacho time you fly'], hobbs: ['Hobbs hour', 'Charged on the Hobbs time you fly'],
        brakes: ['block hour', 'Charged brakes off to brakes on'], brakes_rounded: ['block hour', 'Charged brakes off to brakes on, rounded to 5 minutes'],
        flight: ['block hour', 'Charged brakes off to brakes on'], airborne: ['airborne hour', 'Charged take-off to landing'],
        airborne_rounded: ['airborne hour', 'Charged take-off to landing, rounded to 5 minutes']
    };
    function money(v, cur) {
        var n = parseFloat(v); if (isNaN(n)) { n = 0; }
        var sym = CUR[cur] || '';
        return (n < 0 ? '−' : '') + sym + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (sym ? '' : ' ' + (cur || ''));
    }
    function fees(p) {
        var ch = p.charges, cur = (p._club && (p._club.currency || p._club.account_currency)) || 'GBP';
        if (!ch || ch.charge_rate_unit === null || ch.charge_rate_unit === undefined || ch.charge_rate_unit === '') { return null; }
        var cw = CHARGE[ch.charge_type] || ['hour', 'Charged per hour'];
        var home = p._here ? ' at ' + p._here : ' at home';
        var rows = [{ k: 'Per ' + cw[0], v: money(ch.charge_rate_unit, cur), s: cw[1] }];
        if (ch.surcharge_type && ch.surcharge_type !== 'none') { rows.push({ k: 'Surcharge per ' + ch.surcharge_type, v: money(ch.surcharge_fee, cur), s: 'Added to every ' + ch.surcharge_type }); }
        rows.push({ k: 'Landing' + home, v: money(ch.landing_fee, cur), s: 'Each full-stop landing at home' });
        rows.push({ k: 'Touch-and-go' + home, v: money(ch.touch_and_go_fee, cur), s: 'Each touch-and-go at home' });
        return rows;
    }

    /* ═════════ FLEET + ONE AIRCRAFT: load ═════════ */
    vm.loading = true;
    vm.clubs = [];
    vm.state = { club: 'all', chip: 'all', q: '' };
    try { var savedClub = localStorage.getItem(CLUB_KEY); if (savedClub) { vm.state.club = savedClub; } } catch (e) {}
    vm.fold = {};

    function load(force) {
        vm.loading = true;
        // colours / models / seats arrive separately and never hold up the page
        AircraftV2Data.aircraftExtras().then(function (x) {
            extras = x || { ins: {} };
            vm.allPlanes().forEach(function (p) { applyExtras(p); if (p._logs) { p._logs.forEach(function (l) { decorateLog(l, p._club.id); }); lines(p); } });
        });
        return AircraftV2Data.maintenance(vm.user_id, force).then(function (data) {
            vm.loading = false;
            vm.loadError = !data || data.success === false || !angular.isArray(data.clubs);
            vm.clubs = (data && data.clubs) || [];
            vm.clubs.forEach(function (c) {
                c._title = tidy(c.title);
                loadHome(c);
                c.planes = c.planes || [];
                c.planes.forEach(function (p) { decoratePlane(p, c); });
            });
            if (vm.state.club !== 'all' && !vm.clubs.some(function (c) { return String(c.id) === String(vm.state.club); })) { vm.state.club = 'all'; }
            fetchMissingChecks();
            refreshFleet();
            if (vm.screen === 'one') { pickOne(); }
        });
    }
    // the club's home airfield (club header "EGLD Denham", the hero's Home base) — one lookup per club, cached
    var homes = {};
    function loadHome(c) {
        var id = c.base_airfield_id;
        if (!id) { return; }
        if (!homes[id]) { homes[id] = BookoutService.GetAirfieldById(id).then(function (r) { var a = r && r.airfield; return a && a.code ? { code: String(a.code).toUpperCase(), title: shortAf(a.title) } : null; }); }
        homes[id].then(function (h) { c._home = h; });
    }
    function applyExtras(p) {
        var x = extras[+p.plane_id];
        if (!x) { return; }
        p._colour = x.colour || p._colour || null;
        p._model = tidyModel(x.model) || p._model || '';
        p._seats = x.seats || p._seats || null;
        p._hay = (p.registration + ' ' + String(p.registration).replace('-', '') + ' ' + (p.plane_type || '') + ' ' + p._model).toLowerCase();
    }
    // today's checks normally arrive embedded; when the backend hasn't embedded them, fetch per aircraft (v1 fallback)
    function fetchMissingChecks() {
        vm.clubs.forEach(function (c) {
            c.planes.forEach(function (p) {
                if (angular.isArray(p.aircraft_checks) || angular.isArray(p.checks_today)) { return; }
                p._checksLoading = true;
                AircraftChecksService.GetChecksByPlaneDate(p.plane_id, TODAY).then(function (d) {
                    p._checksLoading = false;
                    if (d && d.success) { p._checks = d.checks || []; lines(p); }
                });
            });
        });
    }

    vm.allPlanes = function () { var a = []; vm.clubs.forEach(function (c) { c.planes.forEach(function (p) { a.push(p); }); }); return a; };

    /* fleet: scope, chips, search — rebuilt only when something changes (no fresh arrays per digest) */
    vm.groups = [];
    vm.counts = { all: 0, attn: 0, ok: 0, grounded: 0 };
    function refreshFleet() {
        var S = vm.state, q = (S.q || '').trim().toLowerCase().replace(/\s+/g, ' ');
        var scoped = vm.clubs.filter(function (c) { return S.club === 'all' || String(c.id) === String(S.club); });
        var planes = []; scoped.forEach(function (c) { planes = planes.concat(c.planes); });
        vm.counts = {
            all: planes.length,
            attn: planes.filter(function (p) { return p._st.tone !== 'good'; }).length,
            ok: planes.filter(function (p) { return p._st.tone === 'good'; }).length,
            grounded: planes.filter(function (p) { return p._st.k === 'grounded'; }).length
        };
        if (S.chip !== 'all' && !vm.counts[S.chip]) { S.chip = 'all'; }
        vm.chipList = [{ id: 'all', label: 'All', n: vm.counts.all }, { id: 'attn', label: 'Needs attention', n: vm.counts.attn, attn: true },
            { id: 'ok', label: 'Serviceable', n: vm.counts.ok }, { id: 'grounded', label: 'Grounded', n: vm.counts.grounded }]
            .filter(function (c) { return c.id === 'all' || c.n > 0; });
        function show(p) {
            if (S.chip === 'attn' && p._st.tone === 'good') { return false; }
            if (S.chip === 'ok' && p._st.tone !== 'good') { return false; }
            if (S.chip === 'grounded' && p._st.k !== 'grounded') { return false; }
            if (q && p._hay.indexOf(q) < 0 && p._hay.indexOf(q.replace('-', '')) < 0) { return false; }
            return true;
        }
        vm.groups = scoped.map(function (c) { return { club: c, planes: c.planes.filter(show) }; }).filter(function (g) { return g.planes.length; });
    }
    vm.setClub = function (id) { vm.state.club = String(id); try { localStorage.setItem(CLUB_KEY, vm.state.club); } catch (e) {} refreshFleet(); };
    vm.setChip = function (id) { vm.state.chip = id; refreshFleet(); };
    vm.onSearch = function () { refreshFleet(); };
    vm.clearSearch = function () { vm.state.q = ''; vm.state.chip = 'all'; vm.setClub('all'); };
    vm.toggleFold = function (p, row) { vm.fold[p.plane_id] = vm.fold[p.plane_id] === row ? null : row; };
    vm.openOne = function (p) { $state.go('dashboard.v2.aircraft_one', { registration: p.registration }); };
    vm.openJourney = function (p) { $state.go('dashboard.v2.aircraft_journey_log', { plane_id: p.plane_id }); };
    vm.toFleet = function () { $state.go('dashboard.v2.aircraft'); };
    vm.jump = function (id) { var el = document.getElementById(id); if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };

    /* one aircraft */
    function pickOne() {
        var reg = String($stateParams.registration || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        vm.plane = vm.allPlanes().filter(function (p) { return String(p.registration).toUpperCase().replace(/[^A-Z0-9]/g, '') === reg; })[0] || null;
        vm.notFound = !vm.plane;
    }

    /* show fixed / closed defects, media, earlier checks */
    vm.allDef = {};
    vm.defectsShown = function (p) {
        if (!p) { return []; }
        var key = p.plane_id + ':' + (vm.allDef[p.plane_id] ? 1 : 0) + ':' + p.defects.length;
        if (p._defKey !== key) {
            p._defKey = key;
            p._defShown = (vm.allDef[p.plane_id] ? p.defects : p._live).slice().sort(function (a, b) {
                return isLive(a) !== isLive(b) ? (isLive(a) ? -1 : 1) : (String(a.created_at) < String(b.created_at) ? 1 : -1);
            });
        }
        return p._defShown;
    };
    // C24: reported_by {id, name, you} — members see "A member" unless it's them; club staff see the name
    vm.reportedBy = function (d) {
        var r = d && d.reported_by;
        if (r) { return r.you ? 'by you' : r.name ? 'by ' + (r.name === 'A member' ? 'a member' : r.name) : ''; }
        return d && d.user_id && +d.user_id === +vm.user_id ? 'by you' : '';
    };
    vm.loadAllChecks = function (p) {
        p._checksLoading = true;
        AircraftChecksService.GetChecksByPlane(p.plane_id).then(function (d) {
            p._checksLoading = false;
            if (d && d.success) { p._checks = d.checks || []; p._checksAll = true; }
        });
    };
    vm.receiptsShown = function (p) { return p._receiptsAll ? p._receipts : p._receipts.slice(0, 5); };
    vm.hasImage = function (image) {
        if (!image) { return false; }
        var i = image.indexOf('base64,');
        return i > -1 ? image.substring(i + 7).trim().length > 0 : image.trim().length > 0;
    };
    vm.qty = function (r) { return r.modified_quantity != null && r.modified_quantity !== '' ? r.modified_quantity : r.quantity; };
    vm.unit = function (r) { return r.item === 'Oil' ? 'qt' : 'L'; };

    /* ═════════ dialogs (record dialogs; bottom sheets on phones) ═════════ */
    vm.dlg = null;
    vm.form = {};
    vm.err = {};
    // Close (×, Cancel, the scrim, Esc) asks first when something has been typed into a form dialog; never while saving
    function dirty() {
        var F = vm.form || {};
        if (vm.dlg === 'defect') { return !!((F.defect || '').trim() || F.severity || (F.files && F.files.length)); }
        if (vm.dlg === 'check') { return !!(F.fuel || F.oil || (F.notes || '').trim() || F.confirm); }
        if (vm.dlg === 'fuel') { return !!(F.qty || F.price || F.file || F.reimb); }
        return false;
    }
    var pendingNav = null;      // a page change (menu, browser back, classic switch) held while "Discard?" is asked
    vm.closeDlg = function (force) {
        if (vm.busy) { return; }
        if (!force && dirty()) { vm.closeAsk = true; return; }
        vm.closeAsk = false; vm.dlg = null;
        if (force && pendingNav) { var to = pendingNav; pendingNav = null; $state.go(to.name, to.params); }
    };
    vm.keepEditing = function () { vm.closeAsk = false; pendingNav = null; };     // design.js restores the v2 switch itself
    function onKey(e) {
        if (e.key !== 'Escape' && e.keyCode !== 27) { return; }
        if (vm.dlg && !vm.busy) { $scope.$applyAsync(function () { if (vm.closeAsk) { vm.keepEditing(); } else { vm.closeDlg(); } }); }
    }
    // a phone sheet scrolls as a whole: bring the question into view (it sits in the footer, below a long form)
    $scope.$watch(function () { return vm.closeAsk; }, function (on) {
        if (!on) { return; }
        $timeout(function () { var b = document.querySelector('.ta-dlg [data-e2e=acs-discard]'), ft = b && b.closest ? b.closest('.ta-dlg__ft') : b; if (ft && ft.scrollIntoView) { ft.scrollIntoView({ block: 'end', behavior: 'smooth' }); } });
    });
    // Leaving the page with something typed in a dialog asks the same question first
    $scope.$on('$stateChangeStart', function (event, toState, toParams) {
        if (!vm.dlg || vm.busy || !dirty()) { return; }
        event.preventDefault();
        pendingNav = { name: toState.name, params: toParams };
        vm.closeAsk = true;
    });
    function onBeforeUnload(e) { if (vm.dlg && dirty()) { e.preventDefault(); e.returnValue = ''; return ''; } }
    window.addEventListener('beforeunload', onBeforeUnload);
    $scope.$on('$destroy', function () { window.removeEventListener('beforeunload', onBeforeUnload); });
    // Enter in a one-line field of a form dialog saves it (textareas keep their new line)
    vm.enterSave = function (e) {
        if (!e || (e.keyCode !== 13 && e.key !== 'Enter') || (e.target && e.target.tagName === 'TEXTAREA')) { return; }
        e.preventDefault();
        if (vm.dlg === 'check') { vm.saveCheck(); } else if (vm.dlg === 'fuel') { vm.saveFuel(); }
    };
    document.addEventListener('keydown', onKey);

    /* report a defect */
    vm.openDefect = function (p) {
        vm.dp = p; vm.err = {}; vm.closeAsk = false; vm.form = { defect: '', severity: null, files: [] }; vm.dlg = 'defect';
    };
    vm.addFiles = function (input) {
        var files = input && input.files ? Array.prototype.slice.call(input.files) : [];
        $scope.$applyAsync(function () { vm.form.files = (vm.form.files || []).concat(files); input.value = ''; });
    };
    vm.removeFile = function (i) { vm.form.files.splice(i, 1); };
    vm.saveDefect = function () {
        if (vm.busy) { return; }
        var p = vm.dp, F = vm.form;
        vm.err = {};
        if (!F.defect || !F.defect.trim()) { vm.err.defect = 'Say what’s wrong'; }
        if (!F.severity) { vm.err.severity = 'Choose how serious it is'; }
        if (vm.err.defect || vm.err.severity) { return; }
        vm.busy = true;
        PlaneService.AddDefect({ club_id: p._club.id, user_id: vm.user_id, plane_id: p.plane_id, defect: F.defect.trim(), severity: F.severity, status: 'open' }).then(function (data) {
            vm.busy = false;
            if (!data || !data.item) { ToastService.error('Defect not reported', (data && data.message) || 'Please try again.'); return; }
            var item = data.item;
            item.media_count = item.media_count || 0;
            p.defects.push(item);
            decoratePlane(p, p._club); refreshFleet();
            // a no-fly report e-mails the club's managers + the maintenance organisation (backend C6: `alerted`); it grounds nothing
            var told = +data.alerted || 0;
            vm.closeAsk = false;
            ToastService.success('Defect reported', 'On ' + p.registration + '. ' + (told > 0 ? 'The club has been told (' + told + (told === 1 ? ' person' : ' people') + ').' : 'The club sees it on its maintenance page.'));
            (F.files || []).forEach(function (file, idx) {
                DefectMediaService.UploadAndAttach(file, item.id, p._club.id, idx, vm.user_id).then(function (r) {
                    if (r && r.success) { item.media_count = (+item.media_count || 0) + 1; }
                    else { ToastService.warning('A photo didn’t upload', (r && r.message) || file.name); }
                });
            });
            vm.dlg = null;
        });
    };

    /* complete a check (the pilot's own A / transit check — not maintenance) */
    var typesByClub = {};
    vm.openCheck = function (p) {
        vm.dp = p; vm.err = {}; vm.closeAsk = false;
        var now = new Date();
        vm.form = { date: TODAY, time: new Date(1970, 0, 1, now.getHours(), now.getMinutes()), fuel: null, oil: null, notes: '', confirm: false, typeId: null };
        vm.checkTypes = []; vm.offered = null; vm.checkLoading = true;
        vm.dlg = 'check';
        var cid = p._club.id;
        var types = typesByClub[cid] ? $q.when(typesByClub[cid]) : AircraftChecksService.GetActiveCheckTypes(cid).then(function (d) { typesByClub[cid] = (d && d.check_types) || []; return typesByClub[cid]; });
        $q.all([types, AircraftChecksService.GetRequiredCheck(p.plane_id, TODAY)]).then(function (r) {
            vm.checkLoading = false;
            var list = r[0] || [], req = r[1];
            var role = req && req.required ? (req.check_type === 'check_a' ? 'a_check' : req.check_type === 'transit_check' ? 'transit' : null) : null;
            vm.offered = role ? (list.filter(function (t) { return t.role === role; })[0] || null) : null;
            vm.requiredMsg = req && req.required ? (req.check_type === 'transit_check' ? 'transit' : 'a') : null;
            vm.checkTypes = vm.offered ? [vm.offered].concat(list.filter(function (t) { return t.id !== vm.offered.id; })) : list;
            vm.form.typeId = vm.checkTypes.length ? vm.checkTypes[0].id : null;
        });
    };
    vm.checkType = function () { return vm.checkTypes.filter(function (t) { return t.id === vm.form.typeId; })[0] || null; };
    vm.saveCheck = function () {
        if (vm.busy || vm.checkLoading) { return; }
        var p = vm.dp, F = vm.form, t = vm.checkType();
        vm.err = {};
        if (!t) { vm.err.type = 'Choose the check'; }
        if (!(parseFloat(F.fuel) > 0)) { vm.err.fuel = 'Enter the fuel on board'; }
        if (!(parseFloat(F.oil) > 0)) { vm.err.oil = 'Enter the oil level'; }
        if (!F.confirm) { vm.err.confirm = 'Confirm you did the check'; }
        if (Object.keys(vm.err).length) { return; }
        var tm = F.time instanceof Date ? pad2(F.time.getHours()) + ':' + pad2(F.time.getMinutes()) : '12:00';
        var obj = { club_id: p._club.id, plane_id: p.plane_id, booking_id: null, check_type: t.code, check_type_id: t.id, performed_by: vm.user_id,
            checked_at: (F.date || TODAY) + 'T' + tm, fuel_us_gallons: parseFloat(F.fuel), oil_quarts: parseFloat(F.oil), flight_date: F.date || TODAY, notes: F.notes || '' };
        vm.busy = true;
        AircraftChecksService.CreateCheck(obj).then(function (data) {
            vm.busy = false;
            if (!(data && data.success)) { ToastService.error('Check not saved', (data && data.message) || 'Please try again.'); return; }
            ToastService.success((t.name || 'Check') + ' recorded', 'For ' + p.registration + '.');
            vm.dlg = null;
            p._checksLoading = true;
            var refresh = p._checksAll ? AircraftChecksService.GetChecksByPlane(p.plane_id) : AircraftChecksService.GetChecksByPlaneDate(p.plane_id, TODAY);
            refresh.then(function (d) { p._checksLoading = false; if (d && d.success) { p._checks = d.checks || []; p.aircraft_checks = p._checksAll ? p.aircraft_checks : p._checks; lines(p); } });
            AircraftChecksService.GetRequiredCheck(p.plane_id, TODAY).then(function (r) { if (r && !r.required) { p.requires_check_a = 0; p._needA = false; } });
        });
    };
    $scope.$watch(function () { return vm.form && vm.form.date; }, function (v) { if (vm.dlg === 'check' && v && v > TODAY) { vm.form.date = TODAY; } });

    /* add fuel / oil (outside a flight) */
    var curByClub = {};
    vm.openFuel = function (p) {
        vm.dp = p; vm.err = {}; vm.closeAsk = false;
        vm.form = { item: 'Fuel', qty: null, currency: null, price: null, reimb: false, file: null };
        vm.dlg = 'fuel';
        var cid = p._club.id;
        vm.currencies = curByClub[cid] || [];
        if (!curByClub[cid]) {
            PlaneService.GetCurrencies(cid).then(function (d) { curByClub[cid] = (d && d.currencies) || []; vm.currencies = curByClub[cid]; pickCur(); });
        } else { pickCur(); }
        function pickCur() {
            var want = (p._club.currency || p._club.account_currency || 'GBP');
            vm.form.currency = vm.currencies.filter(function (c) { return c.iso_code === want; })[0] || vm.currencies[0] || null;
        }
    };
    vm.setReceipt = function (input) {
        var f = input && input.files && input.files[0];
        $scope.$applyAsync(function () { vm.form.file = f || null; if (vm.err.file && f) { delete vm.err.file; } input.value = ''; });
    };
    function uploadReceipt(file) {
        if (!file) { return $q.when(''); }
        var fd = new FormData();
        fd.append('file', file);
        return $http.post($rootScope.uploadUrl, fd, { transformRequest: angular.identity, headers: { 'Content-Type': undefined } }).then(function (res) {
            var data = res.data;
            if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }
            return (data && (data.saved_url || data.temp_path)) || '';
        });
    }
    vm.saveFuel = function () {
        if (vm.busy) { return; }
        var p = vm.dp, F = vm.form;
        vm.err = {};
        if (!(parseFloat(F.qty) > 0)) { vm.err.qty = 'Enter how much you added'; }
        if (F.reimb && !F.file) { vm.err.file = 'Add a photo of the receipt so the club can pay you back'; }
        if (Object.keys(vm.err).length) { return; }
        vm.busy = true;     // the upload goes first, so the write guard can't see this press: own flag
        uploadReceipt(F.file).then(function (path) {
            return PlaneService.AddReceipt({ plane_id: p.plane_id, club_id: p._club.id, user_id: vm.user_id, plane_log_sheet_id: null, reimbursement: F.reimb,
                image: path || '', currency: F.currency ? F.currency.iso_code : '', item: F.item, quantity: parseFloat(F.qty), price: F.price });
        }).then(function (r) {
            vm.busy = false;
            if (r && r.item) {
                p.receipts = p.receipts || [];
                p.receipts.unshift(r.item);
                decoratePlane(p, p._club);
                ToastService.success(F.item + ' saved', nf1(F.qty) + (F.item === 'Oil' ? ' quarts' : ' litres') + ' for ' + p.registration + '.');
                vm.dlg = null;
            } else {
                ToastService.error('Not saved', (r && r.message) || 'The uplift could not be saved.');
            }
        }, function () {
            vm.busy = false;
            ToastService.error('Receipt photo didn’t upload', 'Try again, or save without the photo.');
        });
    };

    /* documents + receipts */
    vm.openDoc = function (p, d) { vm.dp = p; vm.doc = d; vm.dlg = 'doc'; };
    vm.openOtherDoc = function (p, o) {
        vm.dp = p; vm.doc = { t: o.title, sub: 'Updated ' + vm.fDate(o.updated_at), file: o.document, route: 'plane_documents', other: true }; vm.dlg = 'doc';
    };
    vm.docEdge = function (d) { return !d || d.other ? 'var(--ta-brand-2)' : d.tone === 'bad' ? 'var(--ta-bad)' : d.tone === 'warn' ? 'var(--ta-warn)' : d.tone === 'good' ? 'var(--ta-good)' : 'var(--ta-line-2)'; };
    vm.fileIcon = function (f) { return /\.(jpe?g|png|gif|webp)$/i.test(f || '') ? 'fa-file-image' : /\.pdf$/i.test(f || '') ? 'fa-file-pdf' : 'fa-file-alt'; };
    // Open the file in a new tab with its real type (v1 forced every file to PDF, so an image scan never showed).
    // Preview opens the file in a new tab with its real type; Download saves it (v1 forced every file to PDF).
    vm.openFile = function (d, download) {
        if (!d || !d.file) { return; }
        var name = String(d.file).replace(/^.*[\\\/]/, ''), w = null;
        if (!download) { try { w = $window.open('', '_blank'); } catch (e) { w = null; } }
        vm.fileBusy = true;
        $http.get('/api/v1/' + d.route + '/show_file/' + name, { responseType: 'arraybuffer' }).then(function (res) {
            vm.fileBusy = false;
            var type = (res.headers('content-type') || '').split(';')[0];
            if (!type || type === 'application/octet-stream') {
                type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : 'application/octet-stream';
            }
            var url = URL.createObjectURL(new Blob([res.data], { type: type }));
            if (w && !w.closed) { w.location.href = url; return; }
            var a = document.createElement('a'); a.href = url; a.download = res.headers('x-filename') || name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            $timeout(function () { URL.revokeObjectURL(url); }, 60000);
        }, function () {
            vm.fileBusy = false;
            if (w && !w.closed) { w.close(); }
            ToastService.error('Couldn’t open the document', 'Please try again, or ask the club for a copy.');
        });
    };
    vm.openReceipt = function (p, r) { vm.dp = p; vm.rc = r; vm.dlg = 'receipt'; };

    /* ═════════ JOURNEY LOG ═════════ */
    vm.logs = [];
    vm.dayGroups = [];
    vm.jq = '';
    vm.jopen = null;
    var PAGE = 25;
    vm.offset = 0;
    vm.allLoaded = false;
    vm.td = td(null);

    function loadJourney() {
        vm.loading = true;
        AircraftV2Data.aircraftExtras().then(function (x) {
            extras = x || { ins: {} };
            vm.logs.forEach(function (l) { decorateLog(l, vm.journeyClub); });
        });
        PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, 0, PAGE).then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) { vm.loadError = true; return; }
            vm.aircraft = data.aircraft || {};
            vm.aircraft._model = tidyModel([vm.aircraft.manufacturer, vm.aircraft.type_name].filter(function (x) { return x && x !== '-'; }).join(' '));
            vm.journeyClub = data.club_id || vm.aircraft.club_id || null;
            vm.td = td(vm.journeyClub);
            if (vm.aircraft.time_display) { vm.td.setPlane(vm.aircraft.time_display); }
            vm.canAddFlight = typeof data.viewer_is_club_manager !== 'undefined' ? !!(data.viewer_is_club_manager && journeyClubId())
                : !!(journeyClubId() && vm.user.access && vm.user.access.manager && vm.user.access.manager.indexOf(journeyClubId()) > -1);
            vm.logs = (data.logs || []).map(function (l) { return decorateLog(l, vm.journeyClub); });
            vm.offset = 0;
            vm.allLoaded = (data.logs || []).length < PAGE;     // v1 kept "Load more" when the first page already held every flight
            groupJourney();
        });
    }
    function journeyClubId() { return vm.journeyClub || (vm.user.current_club_admin && vm.user.current_club_admin.id) || 0; }
    vm.more = function () {
        if (vm.loadingMore || vm.allLoaded) { return; }
        vm.loadingMore = true;
        var off = vm.offset + PAGE;
        PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, off, PAGE).then(function (data) {
            vm.loadingMore = false;
            var rows = (data && data.logs) || [];
            vm.offset = off;
            rows.forEach(function (l) { vm.logs.push(decorateLog(l, vm.journeyClub)); });
            if (rows.length < PAGE) { vm.allLoaded = true; }
            groupJourney();
        });
    };
    function hay(l) {
        if (l._hay) { return l._hay; }
        var d = pd(l.flight_date);
        l._hay = [vm.fDayFull(l.flight_date), vm.fDayLong(l.flight_date), vm.fDate(l.flight_date), l.flight_date,
            d ? pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() : '',
            l._pic ? l._pic.full : '', l._put ? l._put.full : '', l._ins, (l._pic && l._pic.me) || (l._put && l._put.me) ? 'you me' : '',
            l.departure_airport_code, l.departure_airport, l.destination_airport_code, l.destination_airport].join(' ').toLowerCase();
        return l._hay;
    }
    function groupJourney() {
        var q = (vm.jq || '').trim().toLowerCase();
        var list = q ? vm.logs.filter(function (l) { var h = hay(l); return q.split(/\s+/).every(function (w) { return h.indexOf(w) > -1; }); }) : vm.logs;
        vm.jShown = list.length;
        var groups = [], cur = null;
        list.forEach(function (l) {
            if (!cur || cur.date !== l.flight_date) { cur = { date: l.flight_date, flights: [], mins: 0 }; groups.push(cur); }
            cur.flights.push(l);
            cur.mins += l._t.durationMins || 0;
        });
        groups.forEach(function (g) { g.label = (g.date === TODAY ? 'Today · ' : '') + vm.fDayLong(g.date); g.sub = plural(g.flights.length, 'flight') + (g.mins ? ' · ' + TimeDisplayService.hm(g.mins) : ''); });
        vm.dayGroups = groups;
    }
    vm.onJq = function () { vm.jopen = null; groupJourney(); };
    vm.clearJq = function () { vm.jq = ''; groupJourney(); };
    vm.toggleFlight = function (l) { vm.jopen = vm.jopen === l ? null : l; };
    vm.toAircraft = function () {
        if (vm.aircraft && vm.aircraft.registration) { $state.go('dashboard.v2.aircraft_one', { registration: vm.aircraft.registration }); }
        else { vm.toFleet(); }
    };

    /* the time rounding (brakes off → brakes on is fixed): per viewer, on this device */
    vm.openTimes = function () { vm.dlg = 'times'; };
    vm.roundingOptions = [
        { mode: 'block_rounded', t: 'Rounded to 5 minutes', s: 'Brakes off and brakes on to the nearest 5 minutes', ic: 'fa-clock', short: 'rounded to 5 min' },
        { mode: 'block_exact', t: 'Exact', s: 'Brakes off and brakes on to the minute', ic: 'fa-stopwatch', short: 'exact' }
    ];
    vm.roundingNow = function () { return vm.td && vm.td.def && vm.td.def.rounded ? vm.roundingOptions[0] : vm.roundingOptions[1]; };
    vm.clubRounding = function () { return vm.td && vm.td.clubDef && vm.td.clubDef.rounded ? 'block_rounded' : 'block_exact'; };
    vm.setRounding = function (mode) {
        // the club's own rounding clears the viewer override; the other one is kept just for this viewer
        TimeDisplayService.setViewerOverride(mode === vm.clubRounding() && !(vm.aircraft && vm.aircraft.time_display) ? null : mode);
        ToastService.success('Times now ' + (mode === 'block_rounded' ? 'rounded to 5 min' : 'exact'), 'Just for you, on this device.');
    };
    $scope.$on(TimeDisplayService.EVENT, function () {
        vm.logs.forEach(function (l) { decorateLog(l, vm.journeyClub); });
        if (vm.screen === 'journey') { groupJourney(); }
        vm.clubs.forEach(function (c) { c.planes.forEach(function (p) { p._logs.forEach(function (l) { decorateLog(l, c.id); }); lines(p); }); });
    });

    /* export: server-generated CSV / Excel / PDF (UK CAA layout) — the shared helper, with ta-date-picker strings bridged to its Dates */
    LogbookExportService.attach(vm, {
        baseName: function () { return ((vm.aircraft && vm.aircraft.registration) || 'Aircraft') + '_Journey_Logbook'; },
        download: function (format, filename, filters) { return PlaneService.DownloadJourneyLog($stateParams.plane_id, format, filename, filters); }
    });
    vm.ex = { from: '', to: '', fmt: 'pdf' };
    function toYmd(d) { return d instanceof Date ? ymd(d) : ''; }
    function fromYmd(s) { var d = pd(s); return d || null; }
    vm.openExport = function () { vm.setExportPreset(vm.exportPreset || 'all'); syncExFromFilters(); vm.dlg = 'export'; };
    function syncExFromFilters() { vm.ex.from = toYmd(vm.exportFilters.from); vm.ex.to = toYmd(vm.exportFilters.to); }
    vm.exPreset = function (k) { vm.setExportPreset(k); syncExFromFilters(); };
    $scope.$watchGroup([function () { return vm.ex.from; }, function () { return vm.ex.to; }], function (n, o) {
        if (vm.dlg !== 'export' || (n[0] === o[0] && n[1] === o[1])) { return; }
        if (n[0] !== toYmd(vm.exportFilters.from) || n[1] !== toYmd(vm.exportFilters.to)) {
            vm.exportFilters = { from: fromYmd(n[0]), to: fromYmd(n[1]) };
            vm.onExportDateChange();
        }
    });
    vm.exFormats = [
        { id: 'csv', ic: 'fa-file-alt', t: 'CSV', s: 'Opens in any spreadsheet' },
        { id: 'excel', ic: 'fa-file-excel', t: 'Excel', s: 'An .xlsx workbook' },
        { id: 'pdf', ic: 'fa-file-pdf', t: 'PDF', s: 'UK CAA journey log layout, landscape' }
    ];
    // the dialog closes only once the file is on its way; a failure keeps it open with the choices made (the service toasts)
    vm.exGo = function () {
        if (vm.exporting) { return; }
        vm.exportPanelOpen = true;
        vm.runExport(vm.ex.fmt);
        if (!vm.exporting) { return; }      // refused before sending (From after To): the service warned
        var stop = $scope.$watch(function () { return vm.exporting; }, function (busy, was) {
            if (was && !busy) { stop(); if (!vm.exportPanelOpen) { vm.dlg = null; } }
        });
    };
    vm.todayText = vm.fDate(TODAY);
    vm.exRange = function () {
        var f = vm.ex.from, t = vm.ex.to;
        if (!f && !t) { return 'Every flight'; }
        return (f ? vm.fDate(f) : 'First flight') + ' – ' + (t ? vm.fDate(t) : vm.fDate(TODAY));
    };
    vm.exLabel = function () { var f = vm.exFormats.filter(function (x) { return x.id === vm.ex.fmt; })[0]; return f ? f.t : ''; };

    /* add a missing flight (club managers): the shared manual-flight dialog, then a 10 s Undo */
    vm.openAddFlight = function () {
        $uibModal.open({
            animation: true, templateUrl: 'views/modals/manual_flight_form.html', controller: 'ManualFlightModalController', size: 'lg', backdrop: 'static', keyboard: false,
            resolve: { clubId: function () { return journeyClubId(); }, planeId: function () { return $stateParams.plane_id; } }
        }).result.then(function (result) {
            if (result && result.success) {
                refreshJourney();
                if (vm.undo && vm.undo.timer) { $timeout.cancel(vm.undo.timer); }
                vm.undo = { pls_id: result.pls_id, busy: false, timer: $timeout(function () { vm.undo = null; }, 10000) };
            }
        }, function () { $log.info('Manual flight dialog dismissed'); });
    };
    function refreshJourney() {
        PlaneService.GetAircraftJourneyLogs($stateParams.plane_id, 0, vm.offset + PAGE).then(function (data) {
            if (!data || !data.logs) { return; }
            var before = {};
            vm.logs.forEach(function (l) { before[l.id] = 1; });
            vm.logs = data.logs.map(function (l) { decorateLog(l, vm.journeyClub); l._new = !before[l.id]; return l; });
            groupJourney();
        });
    }
    vm.undoAdd = function () {
        if (!vm.undo || vm.undo.busy) { return; }
        vm.undo.busy = true;
        ManualFlightService.Delete(vm.undo.pls_id).then(function (data) {
            if (data && data.success) {
                ToastService.success('Flight removed', 'The manual entry is undone.');
                if (vm.undo && vm.undo.timer) { $timeout.cancel(vm.undo.timer); }
                vm.undo = null;
                refreshJourney();
            } else {
                vm.undo.busy = false;
                ToastService.error('Couldn’t undo', (data && data.message) || 'This flight can no longer be removed.');
            }
        });
    };

    /* ═════════ start ═════════ */
    $scope.$on('$destroy', function () { document.removeEventListener('keydown', onKey); if (vm.undo && vm.undo.timer) { $timeout.cancel(vm.undo.timer); } });
    if (vm.screen === 'journey') { loadJourney(); }
    else { load(false); }
}
