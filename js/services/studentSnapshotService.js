app.factory('StudentSnapshotService', StudentSnapshotService);

    StudentSnapshotService.$inject = ['$http', '$location', '$uibModal'];
    function StudentSnapshotService($http, $location, $uibModal) {

        // One screen of a student for the instructor / admin about to fly with
        // them (backend BACKEND_STUDENT_SNAPSHOT_GUIDE.md): contact details, the
        // course the booking is for and where they are on it, recent records.
        //
        //   Get(student_id, params)    GET /training_records/snapshot/{id}
        //                              params: { booking_id } (sets the club and
        //                              the known course) or { club_id }
        //   open(student_id, params)   the same, shown in a modal — returns the
        //                              $uibModal instance
        //
        // Read-only: writing records stays on the student record page.

        var base = '/api/v1/training_records';
        var service = {};

        service.Get = Get;
        service.open = open;

        return service;

        function Get(student_id, params) {
            return $http.get(base + '/snapshot/' + student_id + query(params)).then(handleSuccess, handleError2);
        }

        function open(student_id, params) {
            params = params || {};
            return $uibModal.open({
                templateUrl: 'views/directives/student_snapshot.html',
                controller: 'StudentSnapshotModalController',
                controllerAs: 'vm',
                size: 'lg',
                windowClass: 'ssn-modal-window',
                resolve: {
                    student_id: function() { return student_id; },
                    booking_id: function() { return params.booking_id || 0; },
                    club_id: function() { return params.club_id || 0; }
                }
            });
        }

        // { a: 1, b: null, c: '' } → "?a=1" (empty values are left out)
        function query(params) {
            var parts = [];
            angular.forEach(params || {}, function(value, key) {
                if (value === null || value === undefined || value === '' || value === 0) { return; }
                parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            });
            return parts.length ? ('?' + parts.join('&')) : '';
        }

        function handleSuccess(res) { return res.data; }

        // Same normalised shape as RecordsToFileService: the backend's code
        // (FORBIDDEN, NOT_FOUND, …) is lifted onto data.error whether it came
        // back as a 200 body or an HTTP error body.
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
