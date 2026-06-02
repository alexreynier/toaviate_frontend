// ─────────────────────────────────────────────────────
// PersonalLogbookService — a pilot's personal logbook.
// Every endpoint is scoped to the logged-in user (no club id): a pilot only
// ever sees and edits their own logbook. Combines verified club hours
// (read-only) with tentative manual entries (editable here).
// Matches the app convention: app.factory + .then(handleSuccess, handleError).
// ─────────────────────────────────────────────────────
app.factory('PersonalLogbookService', PersonalLogbookService);

    PersonalLogbookService.$inject = ['$http', '$location'];
    function PersonalLogbookService($http, $location) {

        var base = '/api/v1/personal_logbook';
        var s = {};

        // Build a ?from=&to= query string (skips empty values).
        function qs(f) {
            if (!f) return '';
            var p = Object.keys(f).filter(function(k){ return f[k]; })
                          .map(function(k){ return k + '=' + encodeURIComponent(f[k]); });
            return p.length ? ('?' + p.join('&')) : '';
        }

        // Combined logbook (club + manual) with totals + by_source breakdown.
        s.GetLogbook = function(filters) {
            return $http.get(base + qs(filters)).then(handleSuccess, handleError);
        };

        // Registration → make/model/type lookup (call as the pilot types the reg).
        s.LookupAircraft = function(reg) {
            return $http.get(base + '/aircraft/' + encodeURIComponent(reg)).then(handleSuccess, handleError);
        };

        // Airfield autocomplete (shared registry used across the app).
        // Matches ICAO code + name; returns { success, airfields:[{id,code,title,…}] }.
        s.SearchAirfields = function(search) {
            return $http.get('/api/v1/airfields/all/' + encodeURIComponent(search)).then(handleSuccess, handleError);
        };

        // Manual entries CRUD.
        s.ListManual   = function(filters) { return $http.get(base + '/manual' + qs(filters)).then(handleSuccess, handleError); };
        s.GetManual    = function(id) { return $http.get(base + '/manual/' + id).then(handleSuccess, handleError); };
        s.AddManual    = function(entry) { return $http.post(base + '/manual', entry).then(handleSuccess, handleError); };
        s.UpdateManual = function(id, entry) { return $http.put(base + '/manual/' + id, entry).then(handleSuccess, handleError); };
        s.DeleteManual = function(id) { return $http.delete(base + '/manual/' + id).then(handleSuccess, handleError); };

        // Export endpoint URL (csv | excel). The download itself goes through the
        // $http interceptor (so the Api-Key/session headers are attached) — see
        // Download() below.
        s.ExportUrl = function(format, filters) {
            return base + '/export/' + (format === 'excel' ? 'excel' : 'csv') + qs(filters);
        };

        // Stream the export as a blob and save it client-side (keeps auth headers).
        s.Download = function(format, filters) {
            var url = s.ExportUrl(format, filters);
            return $http.get(url, { responseType: 'blob' }).then(function(resp) {
                var ct = resp.headers('Content-Type') || (format === 'excel'
                    ? 'application/vnd.ms-excel' : 'text/csv');
                var blob = new Blob([resp.data], { type: ct });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'Personal_Logbook.' + (format === 'excel' ? 'xls' : 'csv');
                document.body.appendChild(a);
                a.click();
                a.remove();
                return { success: true };
            }, function() {
                return { success: false, message: 'Could not generate the export.' };
            });
        };

        // Statistics — rolling-period + all-time breakdowns + SEP currency.
        s.GetStats = function() {
            return $http.get(base + '/stats').then(handleSuccess, handleError);
        };

        // CSV import — two steps. Preview parses + resolves but saves NOTHING;
        // confirm POSTs back the approved entry objects.
        s.ImportPreview = function(file) {
            var fd = new FormData();
            fd.append('file', file);
            return $http.post(base + '/import', fd, {
                headers: { 'Content-Type': undefined },   // let the browser set the multipart boundary
                transformRequest: angular.identity
            }).then(handleSuccess, handleError);
        };
        s.ImportConfirm = function(rows) {
            return $http.post(base + '/import/confirm', { rows: rows }).then(handleSuccess, handleError);
        };

        return s;

        // ── Helpers ──
        function handleSuccess(res) { return res.data; }
        function handleError(res) {
            if (res && res.status == 401) { $location.path('/login'); }
            var data = res && res.data;
            return {
                success: false,
                error: data ? data.error : null,
                message: data ? (data.message || data.error) : 'Request failed',
                status: res ? res.status : 0
            };
        }
    }
