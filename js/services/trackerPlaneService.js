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
    service.NormalizeAssignResult = NormalizeAssignResult;

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

    // Assign returns its backfill counts flat on the response (not nested in a
    // `results` object the way swap does): entries_claimed, pls_created,
    // backfill_from, backfill_until. backfill_until is null when the window is
    // open-ended — the tracker was never moved to another aircraft afterwards,
    // so the window runs to now. Shared by the plane-first assign dialog
    // (tracker_plane_detail) and the tracker-first one (registry / device detail).
    function NormalizeAssignResult(data) {
        var payload = angular.copy(data || {});

        var claimed = toCount(payload.entries_claimed);
        var created = toCount(payload.pls_created);

        payload.metrics = {
            entries_claimed: claimed,
            pls_created: created
        };
        payload.window = {
            from: payload.backfill_from || null,
            until: payload.backfill_until || null,
            open_ended: !payload.backfill_until
        };
        // Older backends predate these fields entirely; undefined must not
        // render as "0 flights claimed", which asserts something we don't know.
        payload.claimed_anything = claimed > 0 || created > 0;

        return payload;
    }

    function toCount(value) {
        if (value === null || value === undefined || value === '') { return 0; }
        var n = parseInt(value, 10);
        return isNaN(n) ? 0 : n;
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
