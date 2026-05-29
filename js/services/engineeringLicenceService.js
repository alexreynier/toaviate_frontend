// EngineeringLicenceService
// Encrypted engineering licences per org-member.
// Licence numbers + documents are hidden by default; call ListDecrypted / GetFile
// only on an explicit "reveal" or "download" user action.
app.factory('EngineeringLicenceService', EngineeringLicenceService);

EngineeringLicenceService.$inject = ['$http'];
function EngineeringLicenceService($http) {
    var service = {};

    service.ListByMember     = ListByMember;
    service.ListDecrypted    = ListDecrypted;
    service.GetFile          = GetFile;
    service.Create           = Create;
    service.Update           = Update;
    service.Remove           = Remove;

    return service;

    function ListByMember(org_member_id) {
        return $http.get('/api/v1/engineering_licences/member/' + org_member_id).then(ok, err);
    }

    function ListDecrypted(org_member_id) {
        return $http.get('/api/v1/engineering_licences/member/' + org_member_id + '/decrypt').then(ok, err);
    }

    function GetFile(licence_id) {
        return $http.get('/api/v1/engineering_licences/file/' + licence_id).then(ok, err);
    }

    function Create(payload) {
        // payload: {maintenance_org_id, org_member_id, user_id, licence_type,
        //           licence_number, issued_date, expiry_date, document?:{temp_path}}
        return $http.post('/api/v1/engineering_licences', payload).then(ok, err);
    }

    function Update(id, payload) {
        return $http.put('/api/v1/engineering_licences/' + id, payload).then(ok, err);
    }

    function Remove(id) {
        return $http.delete('/api/v1/engineering_licences/' + id).then(ok, err);
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
