app.factory('TrackerPlaneService', TrackerPlaneService);

TrackerPlaneService.$inject = ['$http', '$location'];
function TrackerPlaneService($http, $location) {

    var service = {};

    service.GetByPlane        = GetByPlane;
    service.GetByClub         = GetByClub;
    service.GetUnassigned     = GetUnassigned;
    service.Assign            = Assign;
    service.Unassign          = Unassign;
    service.Swap              = Swap;
    service.GetChangeLogByPlane = GetChangeLogByPlane;

    return service;

    function GetByPlane(planeId) {
        return $http.get('/api/v1/fox_trackers/by_plane/' + planeId)
            .then(handleSuccess, handleError);
    }

    function GetByClub(clubId) {
        return $http.get('/api/v1/fox_trackers/by_club/' + clubId)
            .then(handleSuccess, handleError);
    }

    function GetUnassigned() {
        return $http.get('/api/v1/fox_trackers/unassigned')
            .then(handleSuccess, handleError);
    }

    function Assign(data) {
        return $http.post('/api/v1/fox_trackers/assign', data)
            .then(handleSuccess, handleError);
    }

    function Unassign(data) {
        return $http.post('/api/v1/fox_trackers/unassign', data)
            .then(handleSuccess, handleError);
    }

    function Swap(data) {
        return $http.post('/api/v1/fox_trackers/swap', data)
            .then(handleSuccess, handleError);
    }

    function GetChangeLogByPlane(planeId) {
        return $http.get('/api/v1/fox_trackers/change_log_by_plane/' + planeId)
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
