// GclMonitorService — data layer for the ToAviate-admin GoCardless monitor
// AND the Platform Earnings section (webhook deliveries, event outcomes,
// platform revenue/fees — all under the API's gcl_monitor/ namespace).
// Read-only except FeeSync. See FRONTEND_GCL_MONITOR_GUIDE.md,
// FRONTEND_PLATFORM_FEES_GUIDE.md and BACKEND_GCL_MONITOR_GUIDE.md.
//
// Conventions (same as trackerCommerceService):
//  - app.factory + $inject, every call .then(handleSuccess, handleError)
//  - success responses come back as the raw body ({ success:true, ... });
//    errors RESOLVE (never reject) with { success:false, message, status }
//  - the apiUrlInterceptor in app.js prefixes '/api/v1/...' automatically
app.factory('GclMonitorService', GclMonitorService);
    GclMonitorService.$inject = ['$http', '$location'];
    function GclMonitorService($http, $location) {
        var base = '/api/v1';
        var s = {};

        function qs(params) {
            if (!params) { return ''; }
            var parts = [];
            for (var k in params) {
                if (params.hasOwnProperty(k) && params[k] !== null && params[k] !== undefined && params[k] !== '') {
                    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
                }
            }
            return parts.length ? ('?' + parts.join('&')) : '';
        }

        // ── Endpoints (all GET, ToAviate-admin only) ──────────────────────
        s.Overview    = function()        { return $http.get(base + '/gcl_monitor/overview').then(handleSuccess, handleError); };
        s.Deliveries  = function(filters) { return $http.get(base + '/gcl_monitor/deliveries' + qs(filters)).then(handleSuccess, handleError); };
        s.GetDelivery = function(id)      { return $http.get(base + '/gcl_monitor/delivery/' + id).then(handleSuccess, handleError); };
        s.Events      = function(filters) { return $http.get(base + '/gcl_monitor/events' + qs(filters)).then(handleSuccess, handleError); };
        s.Revenue     = function(filters) { return $http.get(base + '/gcl_monitor/revenue' + qs(filters)).then(handleSuccess, handleError); };
        s.Fees        = function(filters) { return $http.get(base + '/gcl_monitor/fees' + qs(filters)).then(handleSuccess, handleError); };
        // The one mutation in this module: import GoCardless costs from the
        // payout API. Time-budgeted (~20s) and resumable — keep calling while
        // the response says complete:false. Idempotent, safe to re-trigger.
        s.FeeSync     = function(payload)  { return $http.post(base + '/gcl_monitor/fee_sync', payload || {}).then(handleSuccess, handleError); };

        // ── Shared reference data (filters + badge colour maps) ───────────
        s.enums = {
            sources:          ['club', 'tracker'],
            deliveryStatuses: ['ok', 'failed', '403', '498', '500'],
            deliveryOutcomes: ['ok', 'invalid_signature', 'no_secret', 'event_errors', 'gate_rejected'],
            eventOutcomes:    ['processed', 'duplicate', 'unmatched', 'unhandled', 'error'],
            granularities:    ['day', 'week', 'month', 'year']
        };

        s.sourceLabels = { club: 'Club webhooks', tracker: 'Tracker billing' };

        // event outcome → trk-badge modifier (colours per the guide:
        // processed green, duplicate grey, unmatched amber, unhandled grey-blue, error red)
        s.badges = {
            outcome: {
                processed: 'trk-badge--green', duplicate: 'trk-badge--grey',
                unmatched: 'trk-badge--amber', unhandled: 'trk-badge--blue',
                error: 'trk-badge--red'
            }
        };

        // HTTP status we answered GoCardless → badge (200 green, 403 red, 498 orange, 500 red)
        s.statusBadge = function(code) {
            code = parseInt(code, 10);
            if (code >= 200 && code < 300) { return 'trk-badge--green'; }
            if (code === 498)              { return 'trk-badge--orange'; }
            return 'trk-badge--red';
        };

        return s;

        function handleSuccess(res) { return res.data; }
        function handleError(res) {
            if (res.status == 401) { $location.path('/login'); }
            var body = res.data || {};
            return {
                success: false,
                error: body.error,
                message: body.message || body,
                status: res.status
            };
        }
    }
