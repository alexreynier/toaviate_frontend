// DailyAircraftStatusService — manages the nightly aircraft status email
// report (settings, run history, manual trigger, and PDF downloads).
app.factory('DailyAircraftStatusService', DailyAircraftStatusService);

    DailyAircraftStatusService.$inject = ['$http', 'EnvConfig'];
    function DailyAircraftStatusService($http, EnvConfig) {

        var BASE = '/api/v1/daily_aircraft_status';

        var service = {
            GetSettings: GetSettings,
            UpdateSettings: UpdateSettings,
            GetRuns: GetRuns,
            RunNow: RunNow,
            BuildDownloadUrl: BuildDownloadUrl,
            DownloadPdf: DownloadPdf
        };

        return service;

        function GetSettings(club_id) {
            return $http.get(BASE + '/settings/' + club_id)
                .then(handleSuccess, handleError);
        }

        function UpdateSettings(club_id, payload) {
            return $http.put(BASE + '/settings/' + club_id, payload)
                .then(handleSuccess, handleError);
        }

        function GetRuns(club_id, limit) {
            var qs = limit ? ('?limit=' + encodeURIComponent(limit)) : '';
            return $http.get(BASE + '/runs/' + club_id + qs)
                .then(handleSuccess, handleError);
        }

        function RunNow(club_id) {
            return $http.post(BASE + '/run_now/' + club_id, {})
                .then(handleSuccess, handleError);
        }

        // Helper for building a download URL (used to anchor downloads in a new tab)
        function BuildDownloadUrl(club_id, type) {
            return BASE + '/download/' + club_id + '/' + type;
        }

        // Programmatic download via XHR (auth headers are attached by the
        // standard interceptor) — returns a blob URL that we open in a new tab.
        function DownloadPdf(club_id, type) {
            return $http.get(BASE + '/download/' + club_id + '/' + type, {
                responseType: 'arraybuffer'
            }).then(function(res) {
                var blob = new Blob([res.data], { type: 'application/pdf' });
                var url = (window.URL || window.webkitURL).createObjectURL(blob);
                window.open(url, '_blank');
                // Best effort cleanup — leave URL alive for tab to load
                setTimeout(function() {
                    try { (window.URL || window.webkitURL).revokeObjectURL(url); } catch (e) {}
                }, 60000);
                return { success: true };
            }, function(res) {
                var msg = 'Could not download the PDF.';
                try {
                    if (res.data) {
                        // arraybuffer error → try to decode JSON
                        var txt = new TextDecoder('utf-8').decode(new Uint8Array(res.data));
                        var parsed = JSON.parse(txt);
                        if (parsed && parsed.message) msg = parsed.message;
                    }
                } catch (e) {}
                return { success: false, message: msg };
            });
        }

        function handleSuccess(res) { return res.data; }
        function handleError(res) {
            return {
                success: false,
                message: (res && res.data && res.data.message) ? res.data.message : 'Request failed'
            };
        }
    }
