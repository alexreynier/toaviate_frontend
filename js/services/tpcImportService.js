app.factory('TpcImportService', TpcImportService);

    TpcImportService.$inject = ['$http', '$location'];
    function TpcImportService($http, $location) {

        // "The Pilot Centre style import" — training-records workbook (.xlsx)
        // upload → background processing → staged-row review (edit / match /
        // replace / reject) → apply → revert. Nothing touches live flights
        // until rows are applied; tracker times, fox links and replays are
        // never modified and every override is snapshotted server-side.
        // Contract: FRONTEND_TPC_IMPORT_GUIDE.md / tpc_import.controller.php.

        var base = '/api/v1/tpc_import';
        var service = {};

        // ── Runs ──
        service.Upload = Upload;               // multipart .xlsx ≤100MB → { run_id, processing }
        service.GetRuns = GetRuns;
        service.GetRun = GetRun;               // run + summary — the poll target
        service.Process = Process;             // re-process (clears staged rows/edits)
        service.DeleteRun = DeleteRun;         // only when no applied rows

        // ── Rows ──
        service.GetRows = GetRows;             // paged; filters via params
        service.GetRow = GetRow;               // full row incl. candidates + db_before
        service.EditRow = EditRow;             // PUT — date/reg/time edits clear + rematch
        service.RowAction = RowAction;         // match/insert/skip/reject/restore/rematch/assign_person/create_person

        // ── Apply / revert / people ──
        service.Apply = Apply;                 // { row_ids: [...] } inline | { all: true } background
        service.Revert = Revert;               // undoes every applied row of the run
        service.People = People;               // person picker search

        // ── Duplicate-flights cleanup ──
        service.CleanupPreview = CleanupPreview;  // GET — read-only scan + confirm_token
        service.CleanupRun = CleanupRun;          // POST — delete one batch with the token

        // ── Course/lesson pickers + bulk reassignment ──
        // BACKEND_TRAINING_RECORD_COURSE_GUIDE.md. The importer guesses a
        // course from the free-text exercise cell and falls back to PPL —
        // these let a reviewer see/fix it per row, and move already-applied
        // records in bulk.
        service.CoursesForClub = CoursesForClub;      // courses + their lessons
        service.SearchRecords = SearchRecords;        // applied training records
        service.ReassignRecords = ReassignRecords;    // move to another course

        return service;

        function Upload(club_id, file) {
            var fd = new FormData();
            fd.append('file', file);
            return $http.post(base + '/upload/' + club_id, fd, {
                headers: { 'Content-Type': undefined },
                transformRequest: angular.identity,
                timeout: 600000   // 10 min — 100MB workbooks on slow uplinks
            }).then(handleSuccess, handleError2);
        }

        function GetRuns(club_id) {
            return $http.get(base + '/runs/' + club_id).then(handleSuccess, handleError2);
        }

        function GetRun(run_id) {
            return $http.get(base + '/run/' + run_id).then(handleSuccess, handleError2);
        }

        function Process(run_id) {
            return $http.post(base + '/process/' + run_id, {}).then(handleSuccess, handleError2);
        }

        function DeleteRun(run_id) {
            return $http.delete(base + '/run/' + run_id).then(handleSuccess, handleError2);
        }

        // params: { status, action, issue, q, date_from, date_to, edited, page, per_page }
        function GetRows(run_id, params) {
            var parts = [];
            angular.forEach(params || {}, function(v, k) {
                if (v !== null && v !== undefined && v !== '') { parts.push(k + '=' + encodeURIComponent(v)); }
            });
            return $http.get(base + '/rows/' + run_id + (parts.length ? '?' + parts.join('&') : '')).then(handleSuccess, handleError2);
        }

        function GetRow(row_id) {
            return $http.get(base + '/row/' + row_id).then(handleSuccess, handleError2);
        }

        function EditRow(row_id, changes) {
            return $http.put(base + '/row/' + row_id, changes).then(handleSuccess, handleError2);
        }

        function RowAction(row_id, body) {
            return $http.post(base + '/row/' + row_id + '/action', body).then(handleSuccess, handleError2);
        }

        function Apply(run_id, body) {
            return $http.post(base + '/apply/' + run_id, body).then(handleSuccess, handleError2);
        }

        function Revert(run_id) {
            return $http.post(base + '/revert/' + run_id, {}).then(handleSuccess, handleError2);
        }

        function People(club_id, q) {
            return $http.get(base + '/people/' + club_id + '?q=' + encodeURIComponent(q || '')).then(handleSuccess, handleError2);
        }

        // ── Duplicate-flights cleanup (one-off recovery) ──
        // GET is read-only: counts + samples + a confirm_token. POST deletes
        // one batch (≤limit) using that token; loop GET→POST while
        // `remaining` > 0. Errors: STATE_CHANGED (re-GET silently),
        // RUN_BUSY / CLEANUP_BUSY (stop, no auto-retry), TOKEN_REQUIRED.
        function CleanupPreview(club_id) {
            return $http.get(base + '/cleanup_duplicates/' + club_id).then(handleSuccess, handleError2);
        }
        function CleanupRun(club_id, confirm_token, limit) {
            return $http.post(base + '/cleanup_duplicates/' + club_id, {
                confirm_token: confirm_token,
                limit: limit || 500
            }).then(handleSuccess, handleError2);
        }

        function CoursesForClub(club_id) {
            return $http.get(base + '/courses/' + club_id).then(handleSuccess, handleError2);
        }
        function SearchRecords(params) {
            var qs = Object.keys(params || {})
                .filter(function(k){ return params[k] !== null && params[k] !== undefined && params[k] !== ''; })
                .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
                .join('&');
            return $http.get('/api/v1/training_records/search' + (qs ? '?' + qs : '')).then(handleSuccess, handleError2);
        }
        function ReassignRecords(club_id, record_ids, course_id, lesson_id) {
            return $http.post('/api/v1/training_records/reassign', {
                club_id: club_id,
                record_ids: record_ids,
                course_id: course_id,
                lesson_id: lesson_id || null
            }).then(handleSuccess, handleError2);
        }

        function handleSuccess(res) { return res.data; }

        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            return { success: false, message: res.data && (res.data.message || res.data.error) || res.data, error: res.data && res.data.error, status: res.status };
        }
    }
