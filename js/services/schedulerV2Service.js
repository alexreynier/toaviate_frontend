// ─────────────────────────────────────────────────────────────────────────
// SchedulerV2Service — the Scheduler v2 READ endpoints (scheduler/v2/*) plus
// the copy / formatting helpers shared by the v2 page, the booking card and
// the waiting-list modals. Mutations deliberately stay on the legacy booking
// endpoints (BookingService.updateBooking / DeleteBooking) — they carry the
// conflict and override rules. Contract: backend FRONTEND_SCHEDULER_V2_GUIDE.md §1 / §5.
// ─────────────────────────────────────────────────────────────────────────
app.factory('SchedulerV2Service', SchedulerV2Service);
SchedulerV2Service.$inject = ['$http', '$location', '$q'];
function SchedulerV2Service($http, $location, $q) {
    var service = {};

    // localStorage / sessionStorage keys (one place, read by the v1 toggle too)
    service.FLAG_KEY = 'toaviate_scheduler_v2';           // '1' → the v1 list state redirects to v2
    service.DAYS_KEY = 'toaviate_sv2_days';               // remembered day count (1|3|7)
    service.VIEW_KEY = 'toaviate_sv2_view';               // sessionStorage {date, days} — the return trip from add-booking
    service.SHOW_ALL_KEY = 'toaviate_bookings_show_all_instructors';   // v1's viewer override (read once as a seed)
    service.HIDE_KEY = 'toaviate_sv2_hide_unavailable';                 // '1'|'0' — the viewer's "hide instructors not working today" choice

    service.lastSettings = null;                            // settings of the last day response (day_start/day_end, clubs[] with opening_hours…)
    service.openingHoursFor = openingHoursFor;
    service.openingHoursOn = openingHoursOn;
    service.GetDay = GetDay;
    service.GetBooking = GetBooking;
    service.GetMonth = GetMonth;
    service.GetVersion = GetVersion;
    service.InvalidateMonths = InvalidateMonths;

    service.kindLabel = kindLabel;
    service.kindColour = kindColour;
    service.statusLabel = statusLabel;
    service.fmtTime = fmtTime;
    service.fmtRange = fmtRange;
    service.fmtDuration = fmtDuration;
    service.fmtLongDate = fmtLongDate;
    service.fmtShortDate = fmtShortDate;
    service.toLegacyDateTime = toLegacyDateTime;
    service.toWallClock = toWallClock;
    service.parse = parse;
    service.initials = initials;
    service.busyLevel = busyLevel;

    // state + tables (declared BEFORE the return — a `var` below it is hoisted but never assigned)
    var monthCache = {};                 // 'club|YYYY-MM' → { at, data }
    var MONTH_TTL = 10 * 60 * 1000;
    var KIND_LABELS = { dual: 'Dual lesson', solo: 'Solo', hire: 'Self-fly hire', trial: 'Trial lesson', maint: 'Maintenance' };
    var KIND_COLOURS = { dual: '#2d5a8e', solo: '#7c3aed', hire: '#0d9488', trial: '#d97706', maint: '#94a3b8' };
    var WALL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;   // the wall-clock digits of any API/lib datetime string
    var OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;                                      // …and whether it carries a zone suffix
    return service;

    // ── Reads ──────────────────────────────────────────────────────────

    // GET scheduler/v2/day?date&days&club_id&show_all_instructors&hide_unavailable
    //   hide_unavailable=1   → the viewer's "hide instructors not working today" (works whatever the club setting)
    //   show_all_instructors → the viewer's override of a club that hides them
    function GetDay(params) {
        return $http.get('/api/v1/scheduler/v2/day' + query(params)).then(function (res) {
            var data = handleSuccess(res);
            // the booking panel (a child state) reads the hours the scheduler shows (day_start / day_end) from here
            if (data && data.success && data.settings) { service.lastSettings = data.settings; }
            return data;
        }, handleError2);
    }

    // GET scheduler/v2/booking/{id}
    function GetBooking(id) {
        return $http.get('/api/v1/scheduler/v2/booking/' + id).then(handleSuccess, handleError2);
    }

    // GET scheduler/v2/month?month=YYYY-MM&club_id — cached per month (+club)
    // for the date picker's busy dots. The cache is dropped by InvalidateMonths()
    // whenever the schedule changes (refetch after a move / cancel / version bump).
    function GetMonth(month, club_id) {
        var key = (club_id || 0) + '|' + month;
        var hit = monthCache[key];
        if (hit && (Date.now() - hit.at) < MONTH_TTL) { return $q.when(hit.data); }
        return $http.get('/api/v1/scheduler/v2/month' + query({ month: month, club_id: club_id })).then(handleSuccess, handleError2)
            .then(function (data) {
                if (data && data.success) { monthCache[key] = { at: Date.now(), data: data }; }
                return data;
            });
    }
    function InvalidateMonths() { monthCache = {}; }

    // GET scheduler/v2/version?club_id
    function GetVersion(club_id) {
        return $http.get('/api/v1/scheduler/v2/version' + query({ club_id: club_id })).then(handleSuccess, handleError2);
    }

    // ── Club opening hours (settings.clubs[].opening_hours of the last day response) ──
    // {"1"(Mon)…"7"(Sun): {open:'HH:MM', close:'HH:MM'} | null (closed all day)}; a missing weekday = not set;
    // null = the club has no opening hours configured. The panel's hours note reads these.
    function openingHoursFor(club_id) {
        var st = service.lastSettings, clubs = st && angular.isArray(st.clubs) ? st.clubs : [];
        club_id = parseInt(club_id, 10);
        if (!(club_id > 0)) { return null; }
        for (var i = 0; i < clubs.length; i++) {
            if (parseInt(clubs[i].id, 10) === club_id) { return (clubs[i].opening_hours && angular.isObject(clubs[i].opening_hours)) ? clubs[i].opening_hours : null; }
        }
        return null;
    }
    // the entry for a date: { state: 'closed' } | { state: 'open', open, close, openMin, closeMin } | { state: 'unset' }
    // (close '00:00' = midnight → 1440); `hours` null → 'unset'
    function openingHoursOn(hours, date) {
        if (!hours || !angular.isObject(hours)) { return { state: 'unset' }; }
        var m = moment(date);
        if (!m.isValid()) { return { state: 'unset' }; }
        var key = String(m.isoWeekday());
        if (!hours.hasOwnProperty(key)) { return { state: 'unset' }; }
        var e = hours[key];
        if (e === null || e === false) { return { state: 'closed' }; }
        if (!e || !e.open || !e.close) { return { state: 'unset' }; }
        var toMin = function (t) { var p = String(t).split(':'); var h = parseInt(p[0], 10), mi = parseInt(p[1] || '0', 10); return (isNaN(h) || isNaN(mi)) ? null : h * 60 + mi; };
        var o = toMin(e.open), c = toMin(e.close);
        if (o === null || c === null) { return { state: 'unset' }; }
        if (c === 0) { c = 1440; }
        return { state: 'open', open: String(e.open).slice(0, 5), close: String(e.close).slice(0, 5), openMin: o, closeMin: c };
    }

    // ── Copy helpers (name a kind / status through these, never ad hoc) ──

    function kindLabel(kind) { return KIND_LABELS[kind] || 'Booking'; }
    function kindColour(kind) { return KIND_COLOURS[kind] || KIND_COLOURS.dual; }
    function statusLabel(status) { return status === 'pending' ? 'Awaiting instructor confirmation' : 'Confirmed'; }

    // ── Times ──────────────────────────────────────────────────────────
    // The app's convention (v1 FullCalendar `timezone:'UTC'`): a stored booking
    // time is CLUB WALL-CLOCK time and is never shifted. Every string the API
    // hands us ('2026-11-24 11:00:00', the lib's 'YYYY-MM-DD HH:mm:ss', or a
    // '…+00:00' suffixed one) must therefore read back as the same digits in any
    // browser timezone — a plain moment(str) on an offset-suffixed string would
    // convert it to local time (11:00+00:00 → 12:00 in BST). parse() keeps the
    // digits: offset strings go through moment.parseZone (fixed offset, no
    // conversion), plain strings through moment() (local, no offset involved).
    function parse(dt) {
        if (dt === null || dt === undefined || dt === '') { return moment.invalid(); }
        if (typeof dt === 'string') { return OFFSET_RE.test(dt) && WALL_RE.test(dt) ? moment.parseZone(dt) : moment(dt); }
        return moment(dt);
    }
    // 'YYYY-MM-DD HH:mm:ss' wall-clock, by string slicing when the input is a string
    // (nothing to convert, nothing to get wrong) — Dates/moments are formatted local.
    function toWallClock(dt) {
        if (typeof dt === 'string') {
            var m = WALL_RE.exec(dt);
            if (m) { return m[1] + '-' + m[2] + '-' + m[3] + ' ' + (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00'); }
        }
        var mm = parse(dt);
        return mm.isValid() ? mm.format('YYYY-MM-DD HH:mm:ss') : '';
    }
    // The legacy PUT bookings/{id}/{user} gets v1's exact date wire format:
    // FullCalendar 3 moments are "ambiguously zoned" (no `timezone` option on the
    // v1 calendar) so moment.toJSON → 'YYYY-MM-DD[T]HH:mm:ss' with no offset.
    function toLegacyDateTime(dt) { var w = toWallClock(dt); return w ? w.replace(' ', 'T') : ''; }

    function fmtTime(dt) { return dt ? parse(dt).format('HH:mm') : ''; }
    function fmtRange(start, end) { return fmtTime(start) + ' – ' + fmtTime(end); }
    function fmtDuration(start, end) {
        if (!start || !end) { return ''; }
        var mins = Math.round(moment(toWallClock(end)).diff(moment(toWallClock(start)), 'minutes'));
        if (mins <= 0) { return ''; }
        var h = Math.floor(mins / 60), m = mins % 60;
        if (m === 0) { return h + ' h'; }
        return (h > 0 ? h + ' h ' : '') + (m < 10 ? '0' + m : m) + (h > 0 ? '' : ' min');
    }
    function fmtLongDate(d) { return d ? parse(d).format('dddd D MMMM YYYY') : ''; }
    function fmtShortDate(d) { return d ? parse(d).format('ddd D MMM') : ''; }

    function initials(name) {
        if (!name) { return ''; }
        var parts = String(name).replace(/\./g, '').trim().split(/\s+/);
        var out = '';
        for (var i = 0; i < parts.length && out.length < 2; i++) { if (parts[i]) { out += parts[i].charAt(0).toUpperCase(); } }
        return out;
    }

    // bookings-per-day → the date picker's 0..3 dot level
    function busyLevel(count) {
        count = parseInt(count, 10) || 0;
        if (count <= 0) { return 0; }
        if (count <= 3) { return 1; }
        if (count <= 8) { return 2; }
        return 3;
    }

    // ── private ──
    function query(params) {
        var q = [];
        angular.forEach(params || {}, function (v, k) {
            if (v !== null && v !== undefined && v !== '') { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); }
        });
        return q.length ? '?' + q.join('&') : '';
    }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}
