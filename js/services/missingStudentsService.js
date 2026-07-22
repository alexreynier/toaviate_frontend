app.factory('MissingStudentsService', MissingStudentsService);

    MissingStudentsService.$inject = ['$http', '$location'];
    function MissingStudentsService($http, $location) {

        // Missing student records — flights imported from the TPC training-records
        // workbook (or tracker-claimed) whose student could not be matched by name.
        // Admin/instructor queue: assign an existing member, create a temporary
        // member (same mechanism as BookedScheduler imports — converted to a real
        // account on the Imported Users screen), or dismiss the row entirely.
        // Contract: FRONTEND_MISSING_STUDENT_RECORDS_GUIDE.md.
        // All calls require instructor / manager / club-super-admin membership.

        var base = '/api/v1/missing_students';
        var service = {};

        service.GetQueue = GetQueue;   // club-wide queue, grouped per person
        service.People = People;       // member search (same shape as TPC people picker)
        service.Assign = Assign;       // { user_id, name_key, all:true } or { user_id, plane_log_sheet_ids }
        service.Create = Create;       // { first_name, last_name, email?, name_key, all:true }
        service.Dismiss = Dismiss;     // { plane_log_sheet_ids } (+ restore:true to undo)

        return service;

        function GetQueue(club_id) {
            return $http.get(base + '/queue/' + club_id).then(handleSuccess, handleError2);
        }

        function People(club_id, q) {
            return $http.get(base + '/people/' + club_id + '?q=' + encodeURIComponent(q || '')).then(handleSuccess, handleError2);
        }

        function Assign(club_id, body) {
            return $http.post(base + '/assign/' + club_id, body).then(handleSuccess, handleError2);
        }

        function Create(club_id, body) {
            return $http.post(base + '/create/' + club_id, body).then(handleSuccess, handleError2);
        }

        function Dismiss(club_id, body) {
            return $http.post(base + '/dismiss/' + club_id, body).then(handleSuccess, handleError2);
        }

        function handleSuccess(res) { return res.data; }

        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            return { success: false, message: res.data && (res.data.message || res.data.error) || res.data, error: res.data && res.data.error, status: res.status };
        }
    }
