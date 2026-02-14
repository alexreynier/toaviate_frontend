app.factory('AircraftChecksService', AircraftChecksService);

    AircraftChecksService.$inject = ['$http', '$location'];
    function AircraftChecksService($http, $location) {

        var service = {};

        // Check Type Management (Club Admin)
        service.GetCheckTypes = GetCheckTypes;
        service.GetActiveCheckTypes = GetActiveCheckTypes;
        service.GetCheckType = GetCheckType;
        service.CreateCheckType = CreateCheckType;
        service.UpdateCheckType = UpdateCheckType;
        service.DeleteCheckType = DeleteCheckType;

        // Required Check Query
        service.GetRequiredCheck = GetRequiredCheck;

        // Aircraft Check CRUD
        service.CreateCheck = CreateCheck;
        service.GetCheck = GetCheck;
        service.GetChecksByPlane = GetChecksByPlane;
        service.GetChecksByPlaneDate = GetChecksByPlaneDate;
        service.GetChecksByClub = GetChecksByClub;
        service.GetChecksByBooking = GetChecksByBooking;
        service.UpdateCheck = UpdateCheck;
        service.DeleteCheck = DeleteCheck;

        // Audit
        service.GetAuditLog = GetAuditLog;
        service.GetAuditByPlane = GetAuditByPlane;

        return service;

        // ── Check Type Management ──

        function GetCheckTypes(club_id) {
            return $http.get('/api/v1/aircraft_checks/check_types/' + club_id).then(handleSuccess, handleError2);
        }

        function GetActiveCheckTypes(club_id) {
            return $http.get('/api/v1/aircraft_checks/active_check_types/' + club_id).then(handleSuccess, handleError2);
        }

        function GetCheckType(id) {
            return $http.get('/api/v1/aircraft_checks/check_type/' + id).then(handleSuccess, handleError2);
        }

        function CreateCheckType(data) {
            return $http.post('/api/v1/aircraft_checks/check_type', data).then(handleSuccess, handleError2);
        }

        function UpdateCheckType(id, data) {
            return $http.put('/api/v1/aircraft_checks/check_type/' + id, data).then(handleSuccess, handleError2);
        }

        function DeleteCheckType(id) {
            return $http.delete('/api/v1/aircraft_checks/check_type/' + id).then(handleSuccess, handleError2);
        }

        // ── Required Check Query ──

        function GetRequiredCheck(plane_id, flight_date, booking_id) {
            var url = '/api/v1/aircraft_checks/required/' + plane_id + '/' + flight_date;
            if (booking_id) {
                url += '/' + booking_id;
            }
            return $http.get(url).then(handleSuccess, handleError2);
        }

        // ── Aircraft Check CRUD ──

        function CreateCheck(data) {
            return $http.post('/api/v1/aircraft_checks', data).then(handleSuccess, handleError2);
        }

        function GetCheck(id) {
            return $http.get('/api/v1/aircraft_checks/' + id).then(handleSuccess, handleError2);
        }

        function GetChecksByPlane(plane_id) {
            return $http.get('/api/v1/aircraft_checks/plane/' + plane_id).then(handleSuccess, handleError2);
        }

        function GetChecksByPlaneDate(plane_id, flight_date) {
            return $http.get('/api/v1/aircraft_checks/plane/' + plane_id + '/' + flight_date).then(handleSuccess, handleError2);
        }

        function GetChecksByClub(club_id) {
            return $http.get('/api/v1/aircraft_checks/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetChecksByBooking(booking_id) {
            return $http.get('/api/v1/aircraft_checks/booking/' + booking_id).then(handleSuccess, handleError2);
        }

        function UpdateCheck(id, data) {
            return $http.put('/api/v1/aircraft_checks/' + id, data).then(handleSuccess, handleError2);
        }

        function DeleteCheck(id) {
            return $http.delete('/api/v1/aircraft_checks/' + id).then(handleSuccess, handleError2);
        }

        // ── Audit ──

        function GetAuditLog(check_id) {
            return $http.get('/api/v1/aircraft_checks/audit/' + check_id).then(handleSuccess, handleError2);
        }

        function GetAuditByPlane(plane_id) {
            return $http.get('/api/v1/aircraft_checks/audit_plane/' + plane_id).then(handleSuccess, handleError2);
        }

        // ── Private ──

        function handleError2(res) {
            console.log("ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }

        function handleSuccess(res) {
            return res.data;
        }
    }
