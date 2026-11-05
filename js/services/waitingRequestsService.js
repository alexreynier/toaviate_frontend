// ─────────────────────────────────────────────────────────────────────────
// WaitingRequestsService — the school-style waiting list ("call me if a slot
// comes up") that ships with Scheduler v2. Additive to the old aircraft
// waiting-list rows (bookings.waiting_list), which are untouched.
// Contract: backend FRONTEND_SCHEDULER_V2_GUIDE.md §2.
//
//   List({club_id, date, status, user_id?})     ONE day (the staff panel): requests that include that day;
//                                                 `status` means THAT day's status; rows carry `day` (the date row)
//                                                 and `queue_position` (1..n among the LIVE requests of that day)
//   List({club_id, from, to, status})           a range / everything: `status` = the request's derived summary;
//                                                 `queue_position` = place among the club's live requests
//   Get(id, date?)                               one request (`request`); with date: + `day` and THAT day's queue_position
//   Create({club_id, kind, plane_type, plane_id, instructor_id, notice, notes, dates:[{date, preference}]})
//   Update(id, {status, date?, notes?, fulfilled_booking_id?, complete_request?})
//                                                 member: 'cancelled' only (whole request);
//                                                 staff: contacted|fulfilled|declined|open on ONE date (`date:'YYYY-MM-DD'`
//                                                 or `date_id`) — without a date every still-live date (old callers);
//                                                 fulfilled + complete_request:true (the Book flow) also closes every
//                                                 other live day as fulfilled with `fulfilled_elsewhere: 1`
//
// EVERY list is FIRST COME FIRST SERVED (ordered by created_at, id) — never re-sort a list by anything else.
//   Matches({club_id, start, end, plane_id, instructor_id})   staff only — ranked requests with an open / contacted
//                                                 day in the slot; each match carries `day` (the matched date row)
//
// STATUS LIVES PER DATE (2026-11-05): every `dates[]` row has its own status
// (open | contacted | fulfilled | declined, + status_by / status_at /
// fulfilled_booking_id). The request's `status` is only the derived summary:
// cancelled / expired override; else open while ANY day is open, else contacted,
// else fulfilled, else declined. Name a day's state through dateTone / dateLabel —
// the UI words are: open → "Waiting", contacted → "Contacted", fulfilled → "Booked"
// (or "Booked elsewhere" when the day was closed because ANOTHER day of the request
// was booked), declined → "Couldn't take it". The API enum values never change.
//
// `.enums` carries the dropdown values + labels so every screen names a kind,
// notice or preference the same way.
// ─────────────────────────────────────────────────────────────────────────
app.factory('WaitingRequestsService', WaitingRequestsService);
WaitingRequestsService.$inject = ['$http', '$location'];
function WaitingRequestsService($http, $location) {
    var service = {};
    service.List = List;
    service.Get = Get;
    service.Create = Create;
    service.Update = Update;
    service.Matches = Matches;

    service.enums = {
        kinds: [
            { id: 'dual', label: 'Dual lesson', hint: 'With an instructor' },
            { id: 'solo', label: 'Solo', hint: 'Student solo, authorised on the day' },
            { id: 'hire', label: 'Self-fly hire', hint: 'Licensed pilot, no instructor' }
        ],
        notices: [
            { id: 'under_30', label: 'Under 30 minutes', hint: "I'm at the airfield / very close" },
            { id: '30',       label: '30 minutes' },
            { id: '45',       label: '45 minutes' },
            { id: '60',       label: '1 hour' },
            { id: 'over_60',  label: 'More than an hour' }
        ],
        preferences: [
            { id: 'any', label: 'Any time' },
            { id: 'am',  label: 'Morning' },
            { id: 'pm',  label: 'Afternoon' }
        ],
        statuses: {
            open:      { label: 'Waiting',          tone: 'info' },
            contacted: { label: 'Contacted',        tone: 'warning' },
            fulfilled: { label: 'Booked',           tone: 'success' },
            declined:  { label: "Couldn't take it", tone: 'muted' },
            cancelled: { label: 'Cancelled',        tone: 'muted' },
            expired:   { label: 'Expired',          tone: 'muted' }
        },
        elsewhereLabel: 'Booked elsewhere'
    };
    service.kindLabel = function (k) { return labelOf(service.enums.kinds, k, 'Booking'); };
    service.noticeLabel = function (n) { return labelOf(service.enums.notices, n, ''); };
    service.preferenceLabel = function (p) { return p === 'am' ? 'AM' : (p === 'pm' ? 'PM' : 'Any'); };
    // never blank: an unknown value reads as itself, a missing one (an old backend / a row without a status) as "Waiting"
    service.statusLabel = function (s) { return (service.enums.statuses[s] || {}).label || (s ? String(s) : service.enums.statuses.open.label); };
    service.statusTone = function (s) { return (service.enums.statuses[s] || {}).tone || 'muted'; };
    // a DAY's state (chips / pills): open = plain, contacted = info, fulfilled = success (+ --elsewhere), declined = struck/muted.
    // Both take the status string OR the date row (so "Booked elsewhere" can be told from "Booked").
    service.dateTone = function (d) {
        var s = (d && typeof d === 'object') ? d.status : d;
        return { open: 'open', contacted: 'contacted', fulfilled: 'fulfilled', declined: 'declined' }[s] || 'open';
    };
    service.dateLabel = function (d) {
        if (d && typeof d === 'object') {
            if (d.status === 'fulfilled' && parseInt(d.fulfilled_elsewhere, 10) === 1) { return service.enums.elsewhereLabel; }
            return service.statusLabel(d.status || 'open');
        }
        return service.statusLabel(d || 'open');
    };
    service.isLiveStatus = function (s) { return !s || s === 'open' || s === 'contacted'; };
    // "Added 3 days ago" — how long the member has been in the queue (first come first served)
    service.addedAgo = function (created_at) {
        if (!created_at) { return ''; }
        var m = moment(String(created_at).replace(' ', 'T'));
        if (!m.isValid()) { return ''; }
        var mins = moment().diff(m, 'minutes');
        if (mins < 1) { return 'Added just now'; }
        if (mins < 60) { return 'Added ' + mins + ' min ago'; }
        var hours = Math.round(mins / 60);
        if (hours < 24) { return 'Added ' + hours + (hours === 1 ? ' hour ago' : ' hours ago'); }
        var days = Math.round(hours / 24);
        if (days < 14) { return 'Added ' + days + (days === 1 ? ' day ago' : ' days ago'); }
        var weeks = Math.round(days / 7);
        if (days < 60) { return 'Added ' + weeks + ' weeks ago'; }
        return 'Added ' + m.format('D MMM');
    };
    // the request's row for one day ('YYYY-MM-DD'); the backend sends it as `day` for a one-day list / a match,
    // this is the fallback (after a PUT, or an old backend without per-date status)
    service.dayOf = function (request, date) {
        if (!request || !date) { return null; }
        var want = String(date).substr(0, 10);
        for (var i = 0; i < (request.dates || []).length; i++) {
            if (String(request.dates[i].date).substr(0, 10) === want) { return request.dates[i]; }
        }
        return null;
    };
    // how many of the request's days are still live (open or contacted)
    service.liveDays = function (request) {
        var n = 0;
        angular.forEach((request && request.dates) || [], function (d) { if (!d.status || d.status === 'open' || d.status === 'contacted') { n++; } });
        return n;
    };
    return service;

    function List(params) {
        return $http.get('/api/v1/waiting_requests' + query(params)).then(handleSuccess, handleError2);
    }
    function Get(id, date) {
        return $http.get('/api/v1/waiting_requests/' + id + query({ date: date })).then(handleSuccess, handleError2);
    }
    function Create(body) {
        return $http.post('/api/v1/waiting_requests', body).then(handleSuccess, handleError2);
    }
    function Update(id, body) {
        return $http.put('/api/v1/waiting_requests/' + id, body).then(handleSuccess, handleError2);
    }
    function Matches(params) {
        return $http.get('/api/v1/waiting_requests/matches' + query(params)).then(handleSuccess, handleError2);
    }

    // ── private ──
    function labelOf(list, id, fallback) {
        for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i].label; } }
        return fallback;
    }
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
