// ═══════════════════════════════════════════════════════════════════
//  AdhocAvailabilityService
//  CRUD for instructor ad-hoc availability dates
// ═══════════════════════════════════════════════════════════════════

app.factory('AdhocAvailabilityService', AdhocAvailabilityService);

AdhocAvailabilityService.$inject = ['$http', '$location'];

function AdhocAvailabilityService($http, $location) {
    var service = {};

    service.GetAll      = GetAll;
    service.GetInRange  = GetInRange;
    service.Create      = Create;
    service.Update      = Update;
    service.Delete      = Delete;

    return service;


    // ─── List all future ad-hoc dates for a user ─────────────────
    function GetAll(userId) {
        return $http.get('/api/v1/instructor_adhoc_availability/' + userId)
            .then(handleSuccess, handleError);
    }

    // ─── List ad-hoc dates in a date range ───────────────────────
    function GetInRange(userId, startDate, endDate) {
        return $http.get('/api/v1/instructor_adhoc_availability/' + userId + '/' + startDate + '/' + endDate)
            .then(handleSuccess, handleError);
    }

    // ─── Add ad-hoc date(s) — single or bulk via `dates` array ──
    function Create(payload) {
        return $http.post('/api/v1/instructor_adhoc_availability', payload)
            .then(handleSuccess, handleError);
    }

    // ─── Edit an ad-hoc slot ─────────────────────────────────────
    function Update(slotId, changes) {
        return $http.put('/api/v1/instructor_adhoc_availability/' + slotId, changes)
            .then(handleSuccess, handleError);
    }

    // ─── Delete an ad-hoc slot ───────────────────────────────────
    function Delete(slotId) {
        return $http.delete('/api/v1/instructor_adhoc_availability/' + slotId)
            .then(handleSuccess, handleError);
    }


    // ─── Handlers ────────────────────────────────────────────────

    function handleSuccess(res) {
        return res.data;
    }

    function handleError(res) {
        console.error('AdhocAvailabilityService error', res);
        if (res.status === 401) {
            $location.path('/login');
        }
        return { success: false, message: res.data, status: res.status };
    }
}
