// FlightWeatherService — stored METAR/TAF snapshots per flight (FRONTEND_FLIGHT_WEATHER_GUIDE.md).
// Weather rows are immutable once stored, so GetForFlight caches per flight id —
// repeated opens of the same flight never refetch.
app.factory('FlightWeatherService', FlightWeatherService);

FlightWeatherService.$inject = ['$http', '$location', '$q'];
function FlightWeatherService($http, $location, $q) {

    var service = {};
    service.GetForFlight = GetForFlight;
    service.GetLatest = GetLatest;
    service.ClearCache = ClearCache;

    // flight_id -> promise of the API payload (cache the promise so concurrent
    // mounts for the same flight share one request).
    var cache = {};

    return service;

    // force=true bypasses the cache (retry affordance after a fetch failure).
    function GetForFlight(flight_id, force) {
        if (!force && cache[flight_id]) { return cache[flight_id]; }
        var promise = $http.get('/api/v1/flight_weather/for_flight/' + flight_id)
            .then(handleSuccess, handleError2)
            .then(function (data) {
                // Only cache good payloads — errors/forbidden may be transient
                // (the on-demand fetch path can time out on first try).
                if (!data || data.success === false) { delete cache[flight_id]; }
                return data;
            });
        cache[flight_id] = promise;
        return promise;
    }

    // Latest live METAR per airfield (today's bookings chips). Not cached —
    // callers poll no more often than every 10 minutes.
    function GetLatest(airfield_ids) {
        var ids = (airfield_ids || []).join(',');
        if (!ids) { return $q.when({ success: true, conditions: {} }); }
        return $http.get('/api/v1/flight_weather/latest?airfield_ids=' + ids)
            .then(handleSuccess, handleError2);
    }

    function ClearCache() { cache = {}; }

    function handleSuccess(res) { return res.data; }

    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}
