    app.factory('BookingPreferencesService', BookingPreferencesService);

    BookingPreferencesService.$inject = ['$http', '$location'];
    function BookingPreferencesService($http, $location) {
        var service = {};

        service.GetModes              = GetModes;
        service.GetPreferences        = GetPreferences;
        service.GetClubPreferences    = GetClubPreferences;
        service.SavePreferences       = SavePreferences;

        return service;


        // ── Reference data: all available booking modes ──────────
        function GetModes() {
            return $http.get('/api/v1/instructor_booking_preferences/modes')
                .then(handleSuccess, handleError2);
        }

        // ── Single instructor's preferences ─────────────────────
        function GetPreferences(userId, clubId) {
            return $http.get('/api/v1/instructor_booking_preferences/' + userId + '/' + clubId)
                .then(handleSuccess, handleError2);
        }

        // ── All instructors for a club (admin view) ─────────────
        function GetClubPreferences(clubId) {
            return $http.get('/api/v1/instructor_booking_preferences/club/' + clubId)
                .then(handleSuccess, handleError2);
        }

        // ── Create / update preferences ─────────────────────────
        function SavePreferences(userId, clubId, data) {
            return $http.put('/api/v1/instructor_booking_preferences/' + userId + '/' + clubId, data)
                .then(handleSuccess, handleError2);
        }


        // ── Helpers ─────────────────────────────────────────────
        function handleSuccess(res) {
            return res.data;
        }

        function handleError2(res) {
            console.log('ERROR', res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
