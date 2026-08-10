// ManualFlightService — add flights the trackers missed (manual form or
// SkyDemon .flightlog upload). Backend contract: FRONTEND_MANUAL_FLIGHTS_GUIDE.md
app.factory('ManualFlightService', ManualFlightService);

ManualFlightService.$inject = ['$http', '$location'];
function ManualFlightService($http, $location) {

    var service = {};
    service.ParseFlightlog = ParseFlightlog;
    service.Create = Create;
    service.Delete = Delete;
    service.SearchAirfields = SearchAirfields;
    return service;

    // Parse a SkyDemon .flightlog file (no DB write — prefill only)
    function ParseFlightlog(club_id, file) {
        var fd = new FormData();
        fd.append('file', file);
        return $http.post('/api/v1/manual_flights/parse_flightlog/' + club_id, fd, {
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined },
            timeout: 60000
        }).then(handleSuccess, handleError2);
    }

    // Create the flight (unclaimed row → book-in-unclaimed flow)
    function Create(flight) {
        return $http.post('/api/v1/manual_flights', flight).then(handleSuccess, handleError2);
    }

    // Undo — only allowed for manual rows that haven't been booked in
    function Delete(pls_id) {
        return $http.delete('/api/v1/manual_flights/' + pls_id).then(handleSuccess, handleError2);
    }

    // Airfield picker search (same endpoint the bookout flows use)
    function SearchAirfields(query) {
        return $http.get('/api/v1/airfields/all/' + encodeURIComponent(query)).then(handleSuccess, handleError2);
    }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}
