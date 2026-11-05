// ─────────────────────────────────────────────────────────────────────────
// CancellationFeesService — no-show / late-cancellation fees (2026-11-05).
// Backend: models/cancellation_fees.model.php (Models\CancellationFees).
//
// A club sets, per cancellation reason, the fee it MAY claim (Manage Club → Settings →
// Booking Settings → Cancellation Fees) and who may claim it ('staff' = instructors +
// admins, 'admins' = admins only). Nothing is ever charged automatically: staff decide
// per cancellation — at cancellation time (the reason picker's "Charge the fee" switch)
// or later from the Cancellations list. Weather / aircraft / instructor / airfield /
// airspace reasons can never carry a fee. A claim raises a one-line invoice for the
// booking's pilot: queued for the club's direct-debit run when they have a mandate,
// otherwise left on their account (Pay Now). Admins can reverse a claim while the
// invoice is uncollected (it is voided).
//
//   Policy(club_id)          GET  cancellations/policy?club_id=   (cached 60 s per club)
//                              → {reasons:[{key,label,staff_only,chargeable,fee}], currency, claimers, is_staff, can_claim}
//   List(params)             GET  cancellations?club_id&from&to&status=due|claimed|waived|reversed|all   (staff)
//   Claim(id) / Waive(id) / Reverse(id)    POST cancellations/{cancelled_booking_id}/claim|waive|reverse
//   CancelBooking(userId, bookingId, state)   DELETE bookings/{id} with the reason LABEL + notes, then — when
//                              state.claim and the reason has a fee — Claim(cancelled_booking_id). Resolves
//                              {success, message?, cancelledId, claim: null | claim response}. Never rejects.
//   outcomeText(claim)       the toast sub-line for a claim response
//
// Reason labels are stored verbatim (cancelled_bookings.cancellation_reason + the audit trail) —
// the backend maps them to stable keys; never rename one.
// ─────────────────────────────────────────────────────────────────────────
app.factory('CancellationFeesService', CancellationFeesService);
CancellationFeesService.$inject = ['$http', '$location', '$q', 'BookingService'];
function CancellationFeesService($http, $location, $q, BookingService) {
    var service = {};
    var POLICY_TTL = 60 * 1000;
    var policyCache = {};          // club_id → { at, promise }

    // Used while the policy loads (and if it can't): the member-visible list, no fees.
    // Mirrors Models\CancellationFees::REASONS.
    var FALLBACK_REASONS = [
        { key: 'pilot_unwell', label: 'Pilot Unwell', chargeable: true },
        { key: 'pilot_unavailable', label: 'Pilot Unavailable', chargeable: true },
        { key: 'weather_home', label: 'Weather at home base' },
        { key: 'weather_destination', label: 'Weather at destination' },
        { key: 'plane_unavailable', label: 'Plane Unavailable' },
        { key: 'plane_unserviceable', label: 'Plane Unserviceable' },
        { key: 'plane_late', label: 'Plane Returned Too Late by previous booking' },
        { key: 'instructor_unavailable', label: 'Instructor Not Available' },
        { key: 'airfield_closed', label: 'Airfield Closed' },
        { key: 'airspace_closed', label: 'Airspace Closed' },
        { key: 'other', label: 'Other - please specify', chargeable: true }
    ];
    // The settings editor's rows: the chargeable reasons, in the order a club thinks about them.
    var CHARGEABLE = [
        { key: 'no_show', label: 'No-show', hint: 'The pilot did not turn up. Only staff can pick this reason.' },
        { key: 'late_cancellation', label: 'Late cancellation', hint: 'Cancelled at short notice. Only staff can pick this reason.' },
        { key: 'pilot_unwell', label: 'Pilot unwell', hint: '' },
        { key: 'pilot_unavailable', label: 'Pilot unavailable', hint: '' },
        { key: 'other', label: 'Other', hint: '"Other - please specify"' }
    ];
    var NEVER_CHARGED = ['Weather at home base or destination', 'Aircraft unavailable or unserviceable',
        'Aircraft returned late by the previous booking', 'Instructor not available', 'Airfield closed', 'Airspace closed'];
    var SYMBOLS = { GBP: '£', EUR: '€', USD: '$' };

    service.Policy = Policy;
    service.List = List;
    service.Claim = Claim;
    service.Waive = Waive;
    service.Reverse = Reverse;
    service.CancelBooking = CancelBooking;
    service.fallbackReasons = function () { return angular.copy(FALLBACK_REASONS); };
    service.chargeable = CHARGEABLE;
    service.neverCharged = NEVER_CHARGED;
    service.symbol = symbol;
    service.money = money;
    service.feeName = feeName;
    service.outcomeText = outcomeText;
    service.statusLabel = statusLabel;
    service.clearPolicy = function (club_id) { if (club_id) { delete policyCache[club_id]; } else { policyCache = {}; } };
    return service;

    function Policy(club_id) {
        club_id = parseInt(club_id, 10) || 0;
        var hit = policyCache[club_id];
        if (hit && (new Date().getTime() - hit.at) < POLICY_TTL) { return hit.promise; }
        var p = $http.get('/api/v1/cancellations/policy?club_id=' + club_id).then(handleSuccess, handleError2).then(function (data) {
            if (!data || !data.success) { delete policyCache[club_id]; }
            return data;
        });
        policyCache[club_id] = { at: new Date().getTime(), promise: p };
        return p;
    }

    function List(params) {
        var q = [];
        angular.forEach(params || {}, function (v, k) { if (v !== undefined && v !== null && v !== '') { q.push(k + '=' + encodeURIComponent(v)); } });
        return $http.get('/api/v1/cancellations' + (q.length ? '?' + q.join('&') : '')).then(handleSuccess, handleError2);
    }
    function Claim(id) { return $http.post('/api/v1/cancellations/' + id + '/claim', {}).then(handleSuccess, handleError2); }
    function Waive(id) { return $http.post('/api/v1/cancellations/' + id + '/waive', {}).then(handleSuccess, handleError2); }
    function Reverse(id) { return $http.post('/api/v1/cancellations/' + id + '/reverse', {}).then(handleSuccess, handleError2); }

    // state: { reason: label, key, notes, claim: bool, fee: number }
    function CancelBooking(userId, bookingId, state) {
        state = state || {};
        return BookingService.DeleteBooking(userId, bookingId, state.reason, state.notes).then(function (data) {
            if (!data || !data.success) {
                return { success: false, message: textOf(data && data.message) || 'The booking could not be cancelled.', error: data && data.error };
            }
            var cid = parseInt(data.cancelled_booking_id, 10) || 0;
            var out = { success: true, cancelledId: cid, claim: null };
            if (!state.claim || !(state.fee > 0)) { return out; }
            if (!cid) { out.claim = { success: false, message: 'The fee could not be added — claim it from Cancellations.' }; return out; }
            return Claim(cid).then(function (c) { out.claim = c || { success: false }; return out; });
        });
    }

    function symbol(currency) { var c = String(currency || 'GBP').toUpperCase(); return SYMBOLS[c] || (c + ' '); }
    function money(amount, currency) {
        var n = parseFloat(amount);
        if (isNaN(n)) { n = 0; }
        return symbol(currency) + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    // "no-show fee" / "late cancellation fee" / "cancellation fee"
    function feeName(key) {
        if (key === 'no_show') { return 'no-show fee'; }
        if (key === 'late_cancellation') { return 'late cancellation fee'; }
        return 'cancellation fee';
    }
    function outcomeText(claim, currency) {
        if (!claim) { return ''; }
        if (!claim.success) { return textOf(claim.message) || 'The fee was not added.'; }
        var amt = money(claim.fee, claim.currency || currency);
        return amt + ' charged' + (claim.collection === 'direct_debit' ? ', collected with the next direct debit.' : ', on their account to pay.');
    }
    function statusLabel(row) {
        var f = (row && row.fee) || {};
        if (f.status === 'claimed') { return 'Charged'; }
        if (f.status === 'waived') { return 'Waived'; }
        if (f.status === 'reversed') { return 'Reversed'; }
        if (f.due > 0) { return 'To decide'; }
        return 'No fee';
    }

    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }
    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data;
        if (d && typeof d === 'object' && d.error) { return { success: false, error: d.error, message: d.message || d, status: res.status }; }
        return { success: false, message: d, status: res.status };
    }
}
