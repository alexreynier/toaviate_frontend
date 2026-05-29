app.factory('LogbookHoursCorrectionService', LogbookHoursCorrectionService);

    LogbookHoursCorrectionService.$inject = ['$http', '$location'];
    function LogbookHoursCorrectionService($http, $location) {

        var service = {};

        service.CorrectAirframeHours = CorrectAirframeHours;
        service.CorrectEngineHours = CorrectEngineHours;
        service.CorrectPropellerHours = CorrectPropellerHours;
        service.GetCorrectionHistory = GetCorrectionHistory;
        service.GetCorrectionsByType = GetCorrectionsByType;
        service.GetAuditTrail = GetAuditTrail;

        return service;

        function CorrectAirframeHours(data) {
            return $http.post('/api/v1/logbook_hours_corrections/airframe', data).then(handleSuccess, handleError);
        }

        function CorrectEngineHours(data) {
            return $http.post('/api/v1/logbook_hours_corrections/engine', data).then(handleSuccess, handleError);
        }

        function CorrectPropellerHours(data) {
            return $http.post('/api/v1/logbook_hours_corrections/propeller', data).then(handleSuccess, handleError);
        }

        function GetCorrectionHistory(plane_id) {
            return $http.get('/api/v1/logbook_hours_corrections/' + plane_id).then(handleSuccess, handleError);
        }

        function GetCorrectionsByType(plane_id, logbook_type) {
            return $http.get('/api/v1/logbook_hours_corrections/' + plane_id + '/type/' + logbook_type).then(handleSuccess, handleError);
        }

        function GetAuditTrail(plane_id) {
            return $http.get('/api/v1/logbook_hours_corrections/audit/' + plane_id).then(handleSuccess, handleError);
        }

        // private functions
        function handleSuccess(res) {
            return res.data;
        }

        function handleError(res) {
            console.log("ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
