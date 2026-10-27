// Instructor "hours instructed" summary — GET instructor_hours?from=YYYY-MM-DD&to=YYYY-MM-DD
// (own flights only; the backend scopes to the logged-in instructor).
app.factory('InstructorHoursService', InstructorHoursService);
InstructorHoursService.$inject = ['$http', '$location'];
function InstructorHoursService($http, $location) {
    var service = {};
    service.GetSummary = GetSummary;
    return service;

    function GetSummary(from, to) {
        var q = [];
        if (from) { q.push('from=' + encodeURIComponent(from)); }
        if (to)   { q.push('to=' + encodeURIComponent(to)); }
        return $http.get('/api/v1/instructor_hours' + (q.length ? '?' + q.join('&') : '')).then(handleSuccess, handleError2);
    }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}
