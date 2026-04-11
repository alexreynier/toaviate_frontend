app.factory('FoxTrackerService', FoxTrackerService);

FoxTrackerService.$inject = ['$http', '$location'];
function FoxTrackerService($http, $location) {

    var service = {};

    service.GetAll         = GetAll;
    service.GetDetail      = GetDetail;
    service.GetUnassigned  = GetUnassigned;
    service.Create         = Create;
    service.Edit           = Edit;
    service.Deactivate     = Deactivate;
    service.Reactivate     = Reactivate;
    service.Retire         = Retire;
    service.GetChangeLog   = GetChangeLog;

    return service;

    function GetAll() {
        return $http.get('/api/v1/fox_trackers/list')
            .then(handleSuccess, handleError);
    }

    function GetDetail(trackerId) {
        return $http.get('/api/v1/fox_trackers/detail/' + trackerId)
            .then(handleSuccess, handleError);
    }

    function GetUnassigned() {
        return $http.get('/api/v1/fox_trackers/unassigned')
            .then(handleSuccess, handleError);
    }

    function Create(tracker) {
        return $http.post('/api/v1/fox_trackers/create', tracker)
            .then(handleSuccess, handleError);
    }

    function Edit(trackerId, data) {
        return $http.put('/api/v1/fox_trackers/edit/' + trackerId, data)
            .then(handleSuccess, handleError);
    }

    function Deactivate(trackerId) {
        return $http.put('/api/v1/fox_trackers/deactivate/' + trackerId)
            .then(handleSuccess, handleError);
    }

    function Reactivate(trackerId) {
        return $http.put('/api/v1/fox_trackers/reactivate/' + trackerId)
            .then(handleSuccess, handleError);
    }

    function Retire(trackerId) {
        return $http.delete('/api/v1/fox_trackers/retire/' + trackerId)
            .then(handleSuccess, handleError);
    }

    function GetChangeLog(trackerId) {
        return $http.get('/api/v1/fox_trackers/change_log/' + trackerId)
            .then(handleSuccess, handleError);
    }

    function handleError(res) {
        console.log("ERROR", res);
        if (res.status == 401) {
            $location.path('/login');
        }
        return { success: false, message: res.data ? res.data.message || res.data : 'An error occurred', status: res.status };
    }

    function handleSuccess(res) {
        return res.data;
    }
}
