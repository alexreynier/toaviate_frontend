// MaintenanceOrgMemberService
// Members of a maintenance organisation (admins / seniors / normal).
app.factory('MaintenanceOrgMemberService', MaintenanceOrgMemberService);

MaintenanceOrgMemberService.$inject = ['$http'];
function MaintenanceOrgMemberService($http) {
    var service = {};

    service.ListByOrg = ListByOrg;
    service.Get       = Get;
    service.Add       = Add;
    service.Update    = Update;
    service.Remove    = Remove;

    return service;

    function ListByOrg(org_id) {
        return $http.get('/api/v1/maintenance_org_members/org/' + org_id).then(ok, err);
    }

    function Get(id) {
        return $http.get('/api/v1/maintenance_org_members/' + id).then(ok, err);
    }

    function Add(payload) {
        // payload: { maintenance_org_id, user:{first_name,last_name,email,phone}, is_senior, is_manager }
        return $http.post('/api/v1/maintenance_org_members', payload).then(ok, err);
    }

    function Update(id, payload) {
        return $http.put('/api/v1/maintenance_org_members/' + id, payload).then(ok, err);
    }

    function Remove(id) {
        return $http.delete('/api/v1/maintenance_org_members/' + id).then(ok, err);
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
