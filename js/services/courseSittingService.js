// ─────────────────────────────────────────────────────
// CourseSittingService — recurring-course "sittings" (runs).
// A sitting is one run of a course for a student; questionnaire attempts are
// scoped to the open sitting so re-doing a recurring course (e.g. a 6-monthly
// Dual Check) gives a fresh set of questionnaires while history is preserved.
// ─────────────────────────────────────────────────────
app.factory('CourseSittingService', CourseSittingService);

    CourseSittingService.$inject = ['$http', '$location'];
    function CourseSittingService($http, $location) {

        var base = '/api/v1/course_sittings';
        var s = {};

        // Start a run. {course_id, user_id?, due_date?, due_in_months?, notes?}
        // user_id defaults to the caller; only instructors may start for another student.
        s.Start            = function(data) { return $http.post(base, data).then(ok, err); };
        s.Get              = function(id) { return $http.get(base + '/' + id).then(ok, err); };
        s.ForStudent       = function(course_id, student_id) { return $http.get(base + '/student/' + course_id + '/' + student_id).then(ok, err); };
        s.ForCourse        = function(course_id) { return $http.get(base + '/course/' + course_id).then(ok, err); };   // roster (instructor)
        s.Complete         = function(id, notes) { return $http.post(base + '/' + id + '/complete', { notes: notes || '' }).then(ok, err); };
        s.Cancel           = function(id, notes) { return $http.post(base + '/' + id + '/cancel', { notes: notes || '' }).then(ok, err); };
        s.Update           = function(id, data) { return $http.put(base + '/' + id, data).then(ok, err); };
        s.Delete           = function(id) { return $http.delete(base + '/' + id).then(ok, err); };

        return s;

        function ok(r) { return r.data; }
        function err(r) {
            if (r && r.status == 401) { $location.path('/login'); }
            var d = r && r.data;
            return { success: false, code: d ? d.code : (r ? r.status : 0), message: d ? (d.message || d.error) : 'Request failed' };
        }
    }
