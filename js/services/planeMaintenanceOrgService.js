// PlaneMaintenanceOrgService
// Per-aircraft nomination of a maintenance organisation by the club.
app.factory('PlaneMaintenanceOrgService', PlaneMaintenanceOrgService);

PlaneMaintenanceOrgService.$inject = ['$http'];
function PlaneMaintenanceOrgService($http) {
    var service = {};

    service.GetForPlane = GetForPlane;
    service.ListForClub = ListForClub;
    service.Save        = Save;
    service.Clear       = Clear;

    return service;

    function GetForPlane(plane_id, club_id) {
        return $http.get('/api/v1/plane_maintenance_org/plane/' + plane_id + '/club/' + club_id).then(ok, err);
    }

    function ListForClub(club_id) {
        return $http.get('/api/v1/plane_maintenance_org/club/' + club_id).then(ok, err);
    }

    function Save(plane_id, club_id, maintenance_org_id) {
        return $http.post('/api/v1/plane_maintenance_org', {
            plane_id: plane_id,
            club_id: club_id,
            maintenance_org_id: maintenance_org_id
        }).then(ok, err);
    }

    function Clear(plane_id, club_id) {
        return $http({
            method: 'DELETE',
            url: '/api/v1/plane_maintenance_org',
            data: { plane_id: plane_id, club_id: club_id },
            headers: { 'Content-Type': 'application/json' }
        }).then(ok, err);
    }

    function ok(res)  { return res.data; }
    function err(res) {
        return {
            success: false,
            message: (res.data && res.data.message) || 'Request failed.',
            error: (res.data && res.data.error) || null,
            status: res.status
        };
    }
}
