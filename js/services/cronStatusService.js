app.factory('CronStatusService', CronStatusService);

CronStatusService.$inject = ['$http'];
function CronStatusService($http) {
    var service = {};

    service.GetSummary   = GetSummary;
    service.GetRecent    = GetRecent;

    return service;

    // ── GET /api/v1/cron_runs/summary ──────────────────────────────
    function GetSummary() {
        return $http.get('/api/v1/cron_runs/summary')
            .then(handleSuccess, handleError);
    }

    // ── GET /api/v1/cron_runs/recent[/{slug}[/{limit}]] ────────────
    function GetRecent(slug, limit) {
        var url = '/api/v1/cron_runs/recent';
        if (slug) {
            url += '/' + encodeURIComponent(slug);
            if (limit) {
                url += '/' + parseInt(limit, 10);
            }
        }
        return $http.get(url).then(handleSuccess, handleError);
    }

    // ─── helpers ───────────────────────────────────────────────────
    function handleSuccess(res) {
        return res.data;
    }

    function handleError(res) {
        return { success: false, message: (res.data && res.data.message) || 'Request failed.' };
    }
}
