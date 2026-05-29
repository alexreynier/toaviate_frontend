// MaintenanceAccessService
// Read-only-ish workspace endpoints surfaced to a maintenance organisation
// for the aircraft nominated to it. Aircraft "occurrence" = maintenance check.
app.factory('MaintenanceAccessService', MaintenanceAccessService);

MaintenanceAccessService.$inject = ['$http'];
function MaintenanceAccessService($http) {
    var service = {};

    service.Fleet            = Fleet;
    service.Checks           = Checks;
    service.Flights          = Flights;
    service.Issues           = Issues;
    service.AirframeLogbook  = AirframeLogbook;
    service.EngineLogbook    = EngineLogbook;
    service.PropellerLogbook = PropellerLogbook;
    service.AddOccurrence    = AddOccurrence;
    service.UpdateOccurrence = UpdateOccurrence;

    return service;

    function Fleet(org_id) {
        return $http.get('/api/v1/maintenance_access/fleet/' + org_id).then(ok, err);
    }

    function Checks(plane_id) {
        return $http.get('/api/v1/maintenance_access/checks/' + plane_id).then(ok, err);
    }

    function Flights(plane_id) {
        return $http.get('/api/v1/maintenance_access/flights/' + plane_id).then(ok, err);
    }

    function Issues(plane_id) {
        return $http.get('/api/v1/maintenance_access/issues/' + plane_id).then(ok, err);
    }

    function AirframeLogbook(plane_id) {
        return $http.get('/api/v1/maintenance_access/logbook/' + plane_id + '/airframe').then(ok, err);
    }

    function EngineLogbook(plane_id, engine_id) {
        return $http.get('/api/v1/maintenance_access/logbook/' + plane_id + '/engine/' + engine_id).then(ok, err);
    }

    function PropellerLogbook(plane_id, propeller_id) {
        return $http.get('/api/v1/maintenance_access/logbook/' + plane_id + '/propeller/' + propeller_id).then(ok, err);
    }

    // payload must include plane_id; same shape as the club add-maintenance form.
    function AddOccurrence(payload) {
        return $http.post('/api/v1/maintenance_access/occurrence', payload).then(ok, err);
    }

    function UpdateOccurrence(id, payload) {
        return $http.put('/api/v1/maintenance_access/occurrence/' + id, payload).then(ok, err);
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
