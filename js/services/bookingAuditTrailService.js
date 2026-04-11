app.factory('BookingAuditTrailService', BookingAuditTrailService);

    BookingAuditTrailService.$inject = ['$http', '$location'];
    function BookingAuditTrailService($http, $location) {

        var service = {};

        service.GetBookingAuditTrail = GetBookingAuditTrail;
        service.GetClubAuditTrail = GetClubAuditTrail;
        service.GetAuditSummary = GetAuditSummary;

        return service;

        // Get full audit trail for a single booking
        function GetBookingAuditTrail(booking_id) {
            return $http.get('/api/v1/booking_audit_trail/booking/' + booking_id)
                .then(handleSuccess, handleError);
        }

        // Get paginated + filterable club-level audit log
        function GetClubAuditTrail(club_id, params) {
            var query = '?page=' + (params.page || 1) + '&per_page=' + (params.per_page || 25);
            if (params.action) query += '&action=' + params.action;
            if (params.actor_user_id) query += '&actor_user_id=' + params.actor_user_id;
            if (params.date_from) query += '&date_from=' + params.date_from;
            if (params.date_to) query += '&date_to=' + params.date_to;
            if (params.booking_id) query += '&booking_id=' + params.booking_id;
            return $http.get('/api/v1/booking_audit_trail/club/' + club_id + query)
                .then(handleSuccess, handleError);
        }

        // Get summary counts by action type
        function GetAuditSummary(club_id, date_from, date_to) {
            var query = '';
            if (date_from || date_to) {
                query = '?';
                if (date_from) query += 'date_from=' + date_from;
                if (date_from && date_to) query += '&';
                if (date_to) query += 'date_to=' + date_to;
            }
            return $http.get('/api/v1/booking_audit_trail/summary/' + club_id + query)
                .then(handleSuccess, handleError);
        }

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(res) {
            if (res.status === 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
