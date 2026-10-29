app.factory('RecordsToFileService', RecordsToFileService);

    RecordsToFileService.$inject = ['$http', '$location'];
    function RecordsToFileService($http, $location) {

        // Club admins filing student training records on an instructor's behalf
        // (backend BACKEND_ADMIN_STUDENT_RECORDS_GUIDE.md).
        //
        //   Queue(club_id, params)     flights of the club still needing a record
        //                              (club admins only — FORBIDDEN otherwise)
        //   Unconfirmed(club_id, p)    records entered on an instructor's behalf
        //                              that the instructor has not confirmed yet
        //   AwaitingConfirmation()     the CALLER's own records entered for them
        //   Confirm(id)                the record's instructor confirms it
        //
        // Writing the record itself stays in CourseService.CreateTrainingRecord /
        // UpdateTrainingRecord (the debrief form and the student record page).

        var base = '/api/v1/training_records';
        var service = {};

        service.Queue = Queue;                         // ?has_student|no_student|no_instructor&instructor_id&student_id&plane_id&date_from&date_to&page&per_page
        service.Unconfirmed = Unconfirmed;             // ?instructor_id
        service.AwaitingConfirmation = AwaitingConfirmation;
        service.Confirm = Confirm;

        return service;

        function Queue(club_id, params) {
            return $http.get(base + '/to_file/' + club_id + query(params)).then(handleSuccess, handleError2);
        }

        function Unconfirmed(club_id, params) {
            return $http.get(base + '/unconfirmed/' + club_id + query(params)).then(handleSuccess, handleError2);
        }

        function AwaitingConfirmation() {
            return $http.get(base + '/awaiting_confirmation').then(handleSuccess, handleError2);
        }

        function Confirm(id) {
            return $http.post(base + '/confirm/' + id, {}).then(handleSuccess, handleError2);
        }

        // { a: 1, b: null, c: '' } → "?a=1" (empty values are left out)
        function query(params) {
            var parts = [];
            angular.forEach(params || {}, function(value, key) {
                if (value === null || value === undefined || value === '') { return; }
                parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            });
            return parts.length ? ('?' + parts.join('&')) : '';
        }

        function handleSuccess(res) { return res.data; }

        // Same normalised shape as MissingStudentsService: the backend's code
        // (FORBIDDEN, ALREADY_SUPERSEDED, …) is lifted onto data.error whether it
        // came back as a 200 body or an HTTP error body.
        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            return {
                success: false,
                message: res.data && (res.data.message || res.data.error) || res.data,
                error: res.data && res.data.error,
                status: res.status
            };
        }
    }
