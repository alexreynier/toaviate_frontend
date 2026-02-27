// ═══════════════════════════════════════════════════════════════════
//  AirfieldBookoutService
//  Handles all Airfield Bookout system endpoints:
//    – Admin token management (authenticated)
//    – Public pilot bookout form (no auth)
//    – Controller display (token-based, no auth)
// ═══════════════════════════════════════════════════════════════════

app.factory('AirfieldBookoutService', AirfieldBookoutService);

    AirfieldBookoutService.$inject = ['$http'];
    function AirfieldBookoutService($http) {

        var service = {};

        // ── Admin: Token Management (authenticated) ──
        service.SetBaseAirfield     = SetBaseAirfield;
        service.GenerateToken       = GenerateToken;
        service.ListTokens          = ListTokens;
        service.RevokeToken         = RevokeToken;

        // ── Public: Pilot Bookout Form ──
        service.LoadFormData        = LoadFormData;
        service.LookupAircraft      = LookupAircraft;
        service.CreateBookout       = CreateBookout;
        service.GetBookoutByCode    = GetBookoutByCode;
        service.UpdateBookout       = UpdateBookout;
        service.DeleteBookout       = DeleteBookout;

        // ── Controller Display (token-based) ──
        service.GetDisplayInfo      = GetDisplayInfo;
        service.GetActiveBookouts   = GetActiveBookouts;
        service.GetDelta            = GetDelta;
        service.UpdateStatus        = UpdateStatus;
        service.CloseBookout        = CloseBookout;

        return service;


        // ═══════════════════════════════════════════
        //  Admin Endpoints
        // ═══════════════════════════════════════════

        function SetBaseAirfield(club_id, airfield_id) {
            return $http.put('/api/v1/airfield_bookout_tokens/' + club_id, {
                airfield_id: airfield_id
            }).then(handleSuccess, handleError);
        }

        function GenerateToken(club_id, label) {
            return $http.post('/api/v1/airfield_bookout_tokens/' + club_id, {
                label: label || null
            }).then(handleSuccess, handleError);
        }

        function ListTokens(club_id) {
            return $http.get('/api/v1/airfield_bookout_tokens/' + club_id)
                .then(handleSuccess, handleError);
        }

        function RevokeToken(club_id, token) {
            return $http.delete('/api/v1/airfield_bookout_tokens/' + club_id + '/' + token)
                .then(handleSuccess, handleError);
        }


        // ═══════════════════════════════════════════
        //  Public Pilot Form Endpoints
        // ═══════════════════════════════════════════

        function LoadFormData(icao) {
            return $http.get('/api/v1/airfield_bookout/' + icao)
                .then(handleSuccess, handleError);
        }

        function LookupAircraft(icao, registration) {
            return $http.get('/api/v1/airfield_bookout/' + icao + '/lookup/' + encodeURIComponent(registration))
                .then(handleSuccess, handleError);
        }

        function CreateBookout(icao, data) {
            return $http.post('/api/v1/airfield_bookout/' + icao, data)
                .then(handleSuccess, handleError);
        }

        function GetBookoutByCode(icao, editCode) {
            return $http.get('/api/v1/airfield_bookout/' + icao + '/edit/' + editCode)
                .then(handleSuccess, handleError);
        }

        function UpdateBookout(icao, bookoutId, data) {
            return $http.put('/api/v1/airfield_bookout/' + icao + '/' + bookoutId, data)
                .then(handleSuccess, handleError);
        }

        function DeleteBookout(icao, bookoutId, editCode) {
            return $http.delete('/api/v1/airfield_bookout/' + icao + '/' + bookoutId, {
                data: { edit_code: editCode },
                headers: { 'Content-Type': 'application/json' }
            }).then(handleSuccess, handleError);
        }


        // ═══════════════════════════════════════════
        //  Controller Display Endpoints
        // ═══════════════════════════════════════════

        function GetDisplayInfo(token) {
            return $http.get('/api/v1/airfield_bookout_display/' + token)
                .then(handleSuccess, handleError);
        }

        function GetActiveBookouts(token) {
            return $http.get('/api/v1/airfield_bookout_display/' + token + '/active')
                .then(handleSuccess, handleError);
        }

        function GetDelta(token, sinceIso) {
            return $http.get('/api/v1/airfield_bookout_display/' + token + '/delta/' + encodeURIComponent(sinceIso))
                .then(handleSuccess, handleError);
        }

        function UpdateStatus(token, bookoutId, status) {
            return $http.post('/api/v1/airfield_bookout_display/' + token + '/status/' + bookoutId, {
                status: status
            }).then(handleSuccess, handleError);
        }

        function CloseBookout(token, bookoutId) {
            return $http.post('/api/v1/airfield_bookout_display/' + token + '/close/' + bookoutId)
                .then(handleSuccess, handleError);
        }


        // ═══════════════════════════════════════════
        //  Helpers
        // ═══════════════════════════════════════════

        function handleSuccess(res) { return res.data; }

        function handleError(res) {
            return {
                success: false,
                message: (res.data && res.data.message) ? res.data.message : 'Request failed'
            };
        }
    }
