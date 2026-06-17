// ─────────────────────────────────────────────────────
// CourseAssignmentService — instructor→student sharing of questionnaires/material.
// Sharing emails the student a deep link and puts the item in their "Assigned to
// me" tab; status auto-tracks assigned → viewed → completed from the underlying
// attempt/access. Polymorphic: item_type is 'questionnaire' | 'material'.
// ─────────────────────────────────────────────────────
app.factory('CourseAssignmentService', CourseAssignmentService);

    CourseAssignmentService.$inject = ['$http', '$location'];
    function CourseAssignmentService($http, $location) {

        var base = '/api/v1/course_assignments';
        var s = {};

        // Share an item with one or more students.
        //   {item_type, item_id, student_id | student_ids:[], message?, due_date?,
        //    attach_type?, attach_id?, timing?, course_sitting_id?, course_id?, send_email?}
        s.Share = function(data) { return $http.post(base, data).then(ok, err); };

        // Student inbox.
        s.Mine      = function(status) { return $http.get(base + '/mine' + (status ? ('?status=' + status) : '')).then(ok, err); };
        s.MineCount = function() { return $http.get(base + '/mine/count').then(ok, err); };
        s.Get       = function(id) { return $http.get(base + '/' + id).then(ok, err); };
        s.MarkViewed= function(id) { return $http.post(base + '/' + id + '/viewed', {}).then(ok, err); };

        // Instructor views.
        s.ForStudent = function(club_id, student_id) { return $http.get(base + '/student/' + club_id + '/' + student_id).then(ok, err); };
        s.ForItem    = function(item_type, item_id) { return $http.get(base + '/item/' + item_type + '/' + item_id).then(ok, err); };
        s.Update     = function(id, data) { return $http.put(base + '/' + id, data).then(ok, err); };
        s.Revoke     = function(id) { return $http.post(base + '/' + id + '/revoke', {}).then(ok, err); };
        s.Delete     = function(id) { return $http.delete(base + '/' + id).then(ok, err); };

        return s;

        function ok(r) { return r.data; }
        function err(r) {
            if (r && r.status == 401) { $location.path('/login'); }
            var d = r && r.data;
            return { success: false, code: d ? d.code : (r ? r.status : 0), message: d ? (d.message || d.error) : 'Request failed' };
        }
    }
