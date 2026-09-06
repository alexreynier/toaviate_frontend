app.factory('FlightEditsService', FlightEditsService);

    FlightEditsService.$inject = ['$http', '$location'];
    function FlightEditsService($http, $location) {

        var service = {};

        service.GetFlight = GetFlight;
        service.GetPlaneLogSheet = GetPlaneLogSheet;
        service.Preview = Preview;
        service.Apply = Apply;
        service.GetHistory = GetHistory;
        service.GetHistoryByClub = GetHistoryByClub;
        service.GetAuditDetail = GetAuditDetail;
        service.ProcessAdjustmentPayment = ProcessAdjustmentPayment;
        service.WaiveAdjustment = WaiveAdjustment;
        service.GetNeedsReview = GetNeedsReview;
        service.GetNeedsReviewCount = GetNeedsReviewCount;

        return service;

        // ── Load full flight data for a booking-based flight ──
        function GetFlight(bookingId) {
            return $http.get('/api/v1/flight_edits/flight/' + bookingId)
                .then(handleSuccess, handleError2);
        }

        // ── Load flight data for a PLS-only flight (no booking) ──
        function GetPlaneLogSheet(plsId) {
            return $http.get('/api/v1/flight_edits/pls/' + plsId)
                .then(handleSuccess, handleError2);
        }

        // ── Preview changes (no mutations) ──
        function Preview(data) {
            return $http.post('/api/v1/flight_edits/preview', data)
                .then(handleSuccess, handleError2);
        }

        // ── Apply changes with full cascade ──
        function Apply(data) {
            return $http.post('/api/v1/flight_edits/apply', data)
                .then(handleSuccess, handleError2);
        }

        // ── Edit history for one booking ──
        function GetHistory(bookingId) {
            return $http.get('/api/v1/flight_edits/history/' + bookingId)
                .then(handleSuccess, handleError2);
        }

        // ── Flights whose RECORDED times are self-contradictory ──
        //
        // Most commonly brakes on stored before brakes off. No rounding rule
        // can recover the real times, so a human has to correct them.
        //
        // This list is DERIVED, not a stored flag — there is nothing to mark
        // as resolved and no dismiss. Once the times are corrected the flight
        // stops matching and drops off by itself. Manager-only; the backend
        // returns {success:false, message} otherwise.
        function GetNeedsReview(clubId, page, perPage) {
            page = page || 1;
            perPage = perPage || 20;
            return $http.get('/api/v1/flight_edits/needs_review/' + clubId +
                             '?page=' + page + '&per_page=' + perPage)
                .then(handleSuccess, handleError2);
        }

        // Just the number, for the badge. Empty is the NORMAL state — most
        // clubs return 0 and the banner is hidden entirely.
        function GetNeedsReviewCount(clubId) {
            return $http.get('/api/v1/flight_edits/needs_review_count/' + clubId)
                .then(handleSuccess, handleError2);
        }

        // ── Club-wide edit history (paginated) ──
        function GetHistoryByClub(clubId, page, perPage) {
            page = page || 1;
            perPage = perPage || 20;
            return $http.get('/api/v1/flight_edits/history_by_club/' + clubId + '?page=' + page + '&per_page=' + perPage)
                .then(handleSuccess, handleError2);
        }

        // ── Deep audit for one edit session ──
        function GetAuditDetail(editId) {
            return $http.get('/api/v1/flight_edits/audit_detail/' + editId)
                .then(handleSuccess, handleError2);
        }

        // ── Pay an outstanding adjustment ──
        function ProcessAdjustmentPayment(data) {
            return $http.post('/api/v1/flight_edits/process_adjustment_payment', data)
                .then(handleSuccess, handleError2);
        }

        // ── Waive an outstanding adjustment ──
        function WaiveAdjustment(data) {
            return $http.post('/api/v1/flight_edits/waive_adjustment', data)
                .then(handleSuccess, handleError2);
        }

        // ── Private helpers ──
        function handleSuccess(res) {
            return res.data;
        }

        function handleError2(res) {
            console.log("ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
