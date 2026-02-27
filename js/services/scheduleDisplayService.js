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

        // ── Token Management Endpoints (authenticated) ──
        service.GenerateToken     = GenerateToken;
        service.GetToken          = GetToken;
        service.RevokeToken       = RevokeToken;
        service.UpdateDisplaySettings = UpdateDisplaySettings;

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

        function handleError(res) {
            return { success: false, message: res.data ? res.data.message : 'Request failed' };
        }
    }
