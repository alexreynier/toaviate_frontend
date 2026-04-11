app.factory('ClubStatsService', ClubStatsService);

ClubStatsService.$inject = ['$http', '$q', 'EnvConfig'];
function ClubStatsService($http, $q, EnvConfig) {
    var service = {};

    service.GetOverview = GetOverview;
    service.GetInstructors = GetInstructors;
    service.GetAircraft = GetAircraft;
    service.GetMembers = GetMembers;
    service.GetFinancial = GetFinancial;
    service.GetInstructorAircraft = GetInstructorAircraft;
    service.GetMemberAircraft = GetMemberAircraft;
    service.GetAircraftPilots = GetAircraftPilots;
    service.ExportCsv = ExportCsv;

    return service;

    // ──── Overview ────
    function GetOverview(clubId, startDate, endDate) {
        var params = buildDateParams(startDate, endDate);
        return $http.get('/api/v1/club_stats/overview/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── Instructors Leaderboard ────
    function GetInstructors(clubId, startDate, endDate, limit, offset) {
        var params = buildDateParams(startDate, endDate);
        params += '&limit=' + (limit || 20) + '&offset=' + (offset || 0);
        return $http.get('/api/v1/club_stats/instructors/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── Aircraft Leaderboard ────
    function GetAircraft(clubId, startDate, endDate, timeType, limit, offset) {
        var params = buildDateParams(startDate, endDate);
        params += '&time_type=' + (timeType || 'airborne');
        params += '&limit=' + (limit || 20) + '&offset=' + (offset || 0);
        return $http.get('/api/v1/club_stats/aircraft/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── Members Leaderboard ────
    function GetMembers(clubId, startDate, endDate, sortBy, limit, offset) {
        var params = buildDateParams(startDate, endDate);
        params += '&sort_by=' + (sortBy || 'hours');
        params += '&limit=' + (limit || 20) + '&offset=' + (offset || 0);
        return $http.get('/api/v1/club_stats/members/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── Financial ────
    function GetFinancial(clubId, startDate, endDate) {
        var params = buildDateParams(startDate, endDate);
        return $http.get('/api/v1/club_stats/financial/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── Drill-Downs ────
    function GetInstructorAircraft(clubId, instructorId, startDate, endDate) {
        var params = buildDateParams(startDate, endDate);
        params += (params ? '&' : '') + 'instructor_id=' + instructorId;
        return $http.get('/api/v1/club_stats/instructor_aircraft/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    function GetMemberAircraft(clubId, userId, startDate, endDate) {
        var params = buildDateParams(startDate, endDate);
        params += (params ? '&' : '') + 'user_id=' + userId;
        return $http.get('/api/v1/club_stats/member_aircraft/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    function GetAircraftPilots(clubId, planeId, startDate, endDate) {
        var params = buildDateParams(startDate, endDate);
        params += (params ? '&' : '') + 'plane_id=' + planeId;
        return $http.get('/api/v1/club_stats/aircraft_pilots/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── CSV Export ────
    function ExportCsv(clubId, type, startDate, endDate, entityParamName, entityId) {
        var deferred = $q.defer();
        var params = buildDateParams(startDate, endDate);
        params += (params ? '&' : '') + 'type=' + type;
        if (entityParamName && entityId) {
            params += '&' + entityParamName + '=' + entityId;
        }
        var path = '/api/v1/club_stats/export/' + clubId + '?' + params;
        var fullUrl = EnvConfig.getApiBaseUrl() + path;

        // Use raw XHR to avoid AngularJS $http JSON transform breaking blob responses
        var xhr = new XMLHttpRequest();
        xhr.open('GET', fullUrl, true);
        xhr.responseType = 'blob';

        // Copy auth headers from $http defaults
        var commonHeaders = $http.defaults.headers.common || {};
        if (commonHeaders['Authorization']) {
            xhr.setRequestHeader('Authorization', commonHeaders['Authorization']);
        }
        if (commonHeaders['Session']) {
            xhr.setRequestHeader('Session', commonHeaders['Session']);
        }
        xhr.setRequestHeader('Api-Key', EnvConfig.getApiKey());

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                var contentType = xhr.getResponseHeader('content-type') || '';
                // If JSON error response came back
                if (contentType.indexOf('application/json') !== -1) {
                    var reader = new FileReader();
                    reader.onload = function() {
                        try {
                            var errData = JSON.parse(reader.result);
                            deferred.resolve({ success: false, message: errData.message || 'Export failed.' });
                        } catch (e) {
                            deferred.resolve({ success: false, message: 'Export failed.' });
                        }
                    };
                    reader.readAsText(xhr.response);
                    return;
                }
                // Successful CSV — trigger download
                var disposition = xhr.getResponseHeader('content-disposition') || '';
                var filename = 'export.csv';
                var match = disposition.match(/filename[^;=\n]*=(["']?)([^"'\n;]*)\1/);
                if (match && match[2]) {
                    filename = match[2];
                }
                var downloadUrl = window.URL.createObjectURL(xhr.response);
                var a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                deferred.resolve({ success: true });
            } else {
                deferred.resolve({ success: false, message: 'Export request failed (HTTP ' + xhr.status + ').' });
            }
        };

        xhr.onerror = function() {
            deferred.resolve({ success: false, message: 'Network error during export.' });
        };

        xhr.send();
        return deferred.promise;
    }

    // ──── Helpers ────
    function buildDateParams(startDate, endDate) {
        var params = '';
        if (startDate) params += 'start_date=' + startDate;
        if (endDate) params += (params ? '&' : '') + 'end_date=' + endDate;
        return params;
    }

    function handleSuccess(response) {
        return response.data;
    }

    function handleError(response) {
        return { success: false, message: (response.data && response.data.message) || 'An error occurred loading statistics.' };
    }
}
