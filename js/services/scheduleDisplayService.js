// ScheduleDisplayService — handles public display endpoints (no auth)
// and token management endpoints (authenticated, manager-only).
app.factory('ScheduleDisplayService', ScheduleDisplayService);

    ScheduleDisplayService.$inject = ['$http', 'EnvConfig'];
    function ScheduleDisplayService($http, EnvConfig) {

        var service = {};

        // ── Public Display Endpoints (no auth required) ──
        service.GetSchedule       = GetSchedule;
        service.GetVersion        = GetVersion;
        service.GetClubInfo       = GetClubInfo;
        // the TV v2 (FRONTEND_SCHEDULE_DISPLAY_V2_GUIDE.md §1): the day, and the club's TV options
        service.GetDay            = GetDay;
        service.GetSettings       = GetSettings;

        // ── Token Management Endpoints (authenticated) ──
        service.GenerateToken     = GenerateToken;
        service.GetToken          = GetToken;
        service.RevokeToken       = RevokeToken;
        service.UpdateDisplaySettings = UpdateDisplaySettings;
        service.GetDisplayOptions = GetDisplayOptions;       // GET  schedule_display_tokens/{club}/settings → {settings, defaults, changed, page_turn, options}
        service.SaveDisplayOptions = SaveDisplayOptions;     // PUT  … a partial patch; refused whole on a bad value (VALIDATION_ERROR + field)
        service.ResetDisplayOptions = ResetDisplayOptions;   // DELETE … → defaults

        // ── Pairing Endpoints ──
        service.RequestPairingCode  = RequestPairingCode;
        service.CheckPairingStatus  = CheckPairingStatus;
        service.LinkPairingCode     = LinkPairingCode;

        return service;

        // ─────────────────────────────────────────────
        // Public endpoints — use raw $http with full URL
        // (no auth headers needed; the apiUrlInterceptor
        //  only prefixes /api/ paths, these go through it
        //  fine since schedule_display is under /api/v1/)
        // ─────────────────────────────────────────────

        function GetSchedule(token, start, end) {
            return $http.get('/api/v1/schedule_display/' + token + '/' + start + '/' + end)
                .then(handleSuccess, handleError);
        }

        function GetVersion(token) {
            return $http.get('/api/v1/schedule_display/' + token + '/version')
                .then(handleSuccess, handleError);
        }

        function GetClubInfo(token) {
            return $http.get('/api/v1/schedule_display/' + token + '/club_info')
                .then(handleSuccess, handleError);
        }

        // GET schedule_display/{token}/day?date=YYYY-MM-DD → the TV's day (fleet, instructors + hours, bookings with kind
        // and names by the display's rule, notices, weather, last_end). date optional (the club's today). `extra` = more
        // query params (the settings preview passes its draft as `set`).
        function GetDay(token, date, extra) {
            var params = {};
            if (date) { params.date = date; }
            if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k) && extra[k] !== null && extra[k] !== undefined) { params[k] = extra[k]; } } }
            return $http.get('/api/v1/schedule_display/' + token + '/day', { params: params })
                .then(handleSuccess, handleError);
        }

        // GET schedule_display/{token}/settings → {success, settings, schedule_version}
        function GetSettings(token) {
            return $http.get('/api/v1/schedule_display/' + token + '/settings')
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Token management — requires normal auth
        // ─────────────────────────────────────────────

        function GenerateToken(club_id) {
            return $http.post('/api/v1/schedule_display_tokens', { club_id: club_id })
                .then(handleSuccess, handleError);
        }

        function GetToken(club_id) {
            return $http.get('/api/v1/schedule_display_tokens/' + club_id)
                .then(handleSuccess, handleError);
        }

        function RevokeToken(club_id) {
            return $http.delete('/api/v1/schedule_display_tokens/' + club_id)
                .then(handleSuccess, handleError);
        }

        function UpdateDisplaySettings(club_id, settings) {
            return $http.put('/api/v1/schedule_display_tokens/' + club_id, settings)
                .then(handleSuccess, handleError);
        }

        // ── the display options (FRONTEND_SCHEDULE_DISPLAY_V2_GUIDE.md §2, 2026-11-11): what every TV of the club shows.
        // Every save bumps the schedule version, so the TVs pick it up on their next 30 s poll.
        function GetDisplayOptions(club_id) {
            return $http.get('/api/v1/schedule_display_tokens/' + club_id + '/settings')
                .then(handleSuccess, handleError);
        }
        function SaveDisplayOptions(club_id, patch) {
            return $http.put('/api/v1/schedule_display_tokens/' + club_id + '/settings', patch)
                .then(handleSuccess, handleErrorBody);
        }
        function ResetDisplayOptions(club_id) {
            return $http.delete('/api/v1/schedule_display_tokens/' + club_id + '/settings')
                .then(handleSuccess, handleError);
        }
        // keeps the backend's own body (error code + field) on a refused save
        function handleErrorBody(res) {
            var d = (res && res.data && typeof res.data === 'object') ? res.data : {};
            return { success: false, error: d.error, field: d.field, message: d.message || 'Request failed', status: res.status };
        }

        // ─────────────────────────────────────────────
        // Pairing — TV-side endpoints are public (no auth),
        // admin link endpoint requires auth
        // ─────────────────────────────────────────────

        function RequestPairingCode() {
            return $http.post('/api/v1/schedule_display_pairing')
                .then(handleSuccess, handleError);
        }

        function CheckPairingStatus(session_uuid) {
            return $http.get('/api/v1/schedule_display_pairing/' + session_uuid)
                .then(handleSuccess, handleError);
        }

        function LinkPairingCode(code, club_id) {
            return $http.post('/api/v1/schedule_display_pairing_link', { code: code, club_id: club_id })
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────

        function handleSuccess(res) {
            return res.data;
        }

        // network: true tells a failed request (no connection, server error) from the API's own refusal (a 200 with
        // success:false, e.g. "Invalid or revoked display token") — the TV shows "No connection" for one and
        // "Link turned off" for the other.
        function handleError(res) {
            return { success: false, network: true, status: res ? res.status : 0, message: res && res.data ? res.data.message : 'Request failed' };
        }
    }
