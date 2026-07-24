// AircraftRegistryService — data layer for the ToAviate-admin Aircraft
// Registry sync (CAA G-INFO → our `aircraft` REFERENCE table). This module
// only ever touches the reference/autocomplete database — club fleet rows in
// `planes` are never read or written by a sync. There is deliberately no
// delete endpoint anywhere in this feature.
// See FRONTEND_AIRCRAFT_REGISTRY_SYNC_GUIDE.md.
//
// Conventions (same as trackerCommerceService / gclMonitorService):
//  - app.factory + $inject, every call .then(handleSuccess, handleError)
//  - success responses come back as the raw body ({ success:true, ... });
//    errors RESOLVE (never reject) with { success:false, message, status }
//  - the apiUrlInterceptor in app.js prefixes '/api/v1/...' automatically
app.factory('AircraftRegistryService', AircraftRegistryService);
    AircraftRegistryService.$inject = ['$http', '$location'];
    function AircraftRegistryService($http, $location) {
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

        // ── Status + runs ─────────────────────────────────────────────────
        s.Status     = function()        { return $http.get(base + '/aircraft_registry/status').then(handleSuccess, handleError); };
        s.GetRun     = function(id)      { return $http.get(base + '/aircraft_registry/run/' + id).then(handleSuccess, handleError); };
        s.Runs       = function()        { return $http.get(base + '/aircraft_registry/runs').then(handleSuccess, handleError); };

        // Creates a STAGED run — nothing is scraped until Start. recaptcha_keys
        // is optional (empty = token-free; the CAA API currently needs none).
        s.CreateRun  = function(recaptcha_keys) { return $http.post(base + '/aircraft_registry/run', { recaptcha_keys: recaptcha_keys || '' }).then(handleSuccess, handleError); };
        s.StartRun   = function(id)      { return $http.post(base + '/aircraft_registry/run/' + id + '/start', {}).then(handleSuccess, handleError); };
        s.PauseRun   = function(id)      { return $http.post(base + '/aircraft_registry/run/' + id + '/pause', {}).then(handleSuccess, handleError); };
        // Cancel keeps already-applied batches; nothing rolls back.
        s.CancelRun  = function(id)      { return $http.post(base + '/aircraft_registry/run/' + id + '/cancel', {}).then(handleSuccess, handleError); };
        // Advances ONE batch in the foreground and returns the updated run.
        // Looped (~every 2–3s) while the tab is open for a faster apply; the
        // 15-min cron does the same unattended when the tab is closed.
        s.ProcessRun = function(id)      { return $http.post(base + '/aircraft_registry/run/' + id + '/process', {}).then(handleSuccess, handleError); };

        // ── Advisories (changes held because the reg is club-assigned) ────
        s.Advisories      = function(status) { return $http.get(base + '/aircraft_registry/advisories' + qs({ status: status })).then(handleSuccess, handleError); };
        // Apply = update the REFERENCE row only (never the club's plane row).
        s.ApplyAdvisory   = function(id) { return $http.post(base + '/aircraft_registry/advisories/' + id + '/apply', {}).then(handleSuccess, handleError); };
        // Dismiss = keep our reference data as-is.
        s.DismissAdvisory = function(id) { return $http.post(base + '/aircraft_registry/advisories/' + id + '/dismiss', {}).then(handleSuccess, handleError); };

        // ── Shared reference data ─────────────────────────────────────────
        s.enums = {
            runStates:        ['staged', 'running', 'paused', 'done', 'cancelled', 'error'],
            phases:           ['search', 'details', 'dereg'],
            advisoryStatuses: ['pending', 'applied', 'dismissed']
        };

        s.badges = {
            run: {
                staged: 'trk-badge--blue', running: 'trk-badge--violet', paused: 'trk-badge--amber',
                done: 'trk-badge--green', cancelled: 'trk-badge--grey', error: 'trk-badge--red'
            },
            advisory: {
                pending: 'trk-badge--amber', applied: 'trk-badge--green', dismissed: 'trk-badge--grey'
            }
        };

        return s;

        function handleSuccess(res) { return res.data; }
        // Preserves body keys (e.g. error:'RUN_IN_PROGRESS' + its run object)
        // so controllers can branch on them even when the HTTP status errored.
        function handleError(res) {
            if (res && res.status == 401) { $location.path('/login'); }
            var body = (res && res.data && typeof res.data === 'object') ? res.data : {};
            var out = { status: res && res.status };
            for (var k in body) { if (body.hasOwnProperty(k)) { out[k] = body[k]; } }
            out.success = false;
            if (!out.message) { out.message = out.error || 'Request failed'; }
            return out;
        }
    }
