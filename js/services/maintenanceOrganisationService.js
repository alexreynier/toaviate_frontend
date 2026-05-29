// MaintenanceOrganisationService
// CRUD for maintenance organisations (top-level stakeholder) + signup.
app.factory('MaintenanceOrganisationService', MaintenanceOrganisationService);

MaintenanceOrganisationService.$inject = ['$http'];
function MaintenanceOrganisationService($http) {
    var service = {};

    service.ListAll       = ListAll;
    service.GetById       = GetById;
    service.GetForUser    = GetForUser;
    service.GetAdminForUser = GetAdminForUser;
    service.Signup        = Signup;
    service.RegisterExisting = RegisterExisting;
    service.Update        = Update;
    service.Deactivate    = Deactivate;
    service.Invite        = Invite;
    service.GetInvite     = GetInvite;

    return service;

    function ListAll() {
        return $http.get('/api/v1/maintenance_organisations').then(ok, err);
    }

    function GetById(id) {
        return $http.get('/api/v1/maintenance_organisations/' + id).then(ok, err);
    }

    function GetForUser(user_id) {
        return $http.get('/api/v1/maintenance_organisations/for_user/' + user_id).then(ok, err);
    }

    function GetAdminForUser(user_id) {
        return $http.get('/api/v1/maintenance_organisations/admin_for_user/' + user_id).then(ok, err);
    }

    // Public signup — no session, just Api-Key (the interceptor handles base URL).
    function Signup(payload) {
        return $http.post('/api/v1/maintenance_organisations', payload).then(ok, err);
    }

    // Existing logged-in user creating an org.
    function RegisterExisting(organisation) {
        return $http.post('/api/v1/maintenance_organisations/register', { organisation: organisation }).then(ok, err);
    }

    function Update(id, payload) {
        return $http.put('/api/v1/maintenance_organisations/' + id, payload).then(ok, err);
    }

    function Deactivate(id) {
        return $http.delete('/api/v1/maintenance_organisations/' + id).then(ok, err);
    }

    // Club admin invites an unregistered maintenance org by email.
    // payload: { email, organisation_name?, club_id, plane_id?, message? }
    function Invite(payload) {
        return $http.post('/api/v1/maintenance_organisations/invite', payload).then(ok, err);
    }

    // Public — resolve an invite token on the signup page (returns prefill data).
    function GetInvite(token) {
        return $http.get('/api/v1/maintenance_organisations/invite/' + token).then(ok, err);
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
