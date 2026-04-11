app.factory('AccountingExportService', AccountingExportService);

AccountingExportService.$inject = ['$http', '$q', 'EnvConfig'];
function AccountingExportService($http, $q, EnvConfig) {
    var service = {};

    // Settings
    service.GetSettings = GetSettings;
    service.SaveSettings = SaveSettings;

    // Codes
    service.GetCodes = GetCodes;
    service.SaveMemberCodes = SaveMemberCodes;
    service.AutoGenerateMemberCodes = AutoGenerateMemberCodes;
    service.SaveAircraftCodes = SaveAircraftCodes;
    service.SaveItemCodes = SaveItemCodes;
    service.SaveMembershipCodes = SaveMembershipCodes;

    // Export
    service.GetPreview = GetPreview;
    service.DownloadExport = DownloadExport;
    service.GetHistory = GetHistory;

    return service;

    // ──── Settings ────

    function GetSettings(clubId) {
        return $http.get('/api/v1/accounting_export/settings/' + clubId)
            .then(handleSuccess, handleError);
    }

    function SaveSettings(clubId, settings) {
        return $http.post('/api/v1/accounting_export/settings/' + clubId, settings)
            .then(handleSuccess, handleError);
    }

    // ──── Codes ────

    function GetCodes(clubId) {
        return $http.get('/api/v1/accounting_export/codes/' + clubId)
            .then(handleSuccess, handleError);
    }

    function SaveMemberCodes(clubId, codes) {
        return $http.post('/api/v1/accounting_export/codes/' + clubId + '/members', { codes: codes })
            .then(handleSuccess, handleError);
    }

    function AutoGenerateMemberCodes(clubId, prefix, startNumber, overwrite) {
        return $http.post('/api/v1/accounting_export/codes/' + clubId + '/members/auto_generate', {
            prefix: prefix,
            start_number: startNumber,
            overwrite: overwrite || false
        }).then(handleSuccess, handleError);
    }

    function SaveAircraftCodes(clubId, codes) {
        return $http.post('/api/v1/accounting_export/codes/' + clubId + '/aircraft', { codes: codes })
            .then(handleSuccess, handleError);
    }

    function SaveItemCodes(clubId, codes) {
        return $http.post('/api/v1/accounting_export/codes/' + clubId + '/items', { codes: codes })
            .then(handleSuccess, handleError);
    }

    function SaveMembershipCodes(clubId, codes) {
        return $http.post('/api/v1/accounting_export/codes/' + clubId + '/memberships', { codes: codes })
            .then(handleSuccess, handleError);
    }

    // ──── Export Preview ────

    function GetPreview(clubId, startDate, endDate, type, includeFees) {
        var params = 'start_date=' + startDate + '&end_date=' + endDate;
        params += '&type=' + (type || 'daybook');
        params += '&include_fees=' + (includeFees ? 1 : 0);
        return $http.get('/api/v1/accounting_export/preview/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── CSV Download ────

    function DownloadExport(clubId, startDate, endDate, type, includeFees) {
        var deferred = $q.defer();
        var params = 'start_date=' + startDate + '&end_date=' + endDate;
        params += '&type=' + (type || 'daybook');
        params += '&include_fees=' + (includeFees ? 1 : 0);
        var path = '/api/v1/accounting_export/export/' + clubId + '?' + params;
        var fullUrl = EnvConfig.getApiBaseUrl() + path;

        var xhr = new XMLHttpRequest();
        xhr.open('GET', fullUrl, true);
        xhr.responseType = 'blob';

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
                if (contentType.indexOf('application/json') !== -1) {
                    var reader = new FileReader();
                    reader.onload = function() {
                        try {
                            var errData = JSON.parse(reader.result);
                            deferred.resolve({ success: false, message: errData.error || 'Export failed.' });
                        } catch (e) {
                            deferred.resolve({ success: false, message: 'Export failed.' });
                        }
                    };
                    reader.readAsText(xhr.response);
                    return;
                }
                var disposition = xhr.getResponseHeader('content-disposition') || '';
                var filename = 'accounting_export.csv';
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

    // ──── History ────

    function GetHistory(clubId, limit, offset) {
        var params = 'limit=' + (limit || 50) + '&offset=' + (offset || 0);
        return $http.get('/api/v1/accounting_export/history/' + clubId + '?' + params)
            .then(handleSuccess, handleError);
    }

    // ──── Helpers ────

    function handleSuccess(response) {
        return response.data;
    }

    function handleError(response) {
        var data = response.data || {};
        return {
            success: false,
            message: data.error || data.message || 'An error occurred.',
            code: data.code || null
        };
    }
}
