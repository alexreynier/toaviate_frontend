// ─────────────────────────────────────────────────────
// DefaultCoursesService — ToAviate base-syllabus library.
// Contract: FRONTEND_DEFAULT_COURSES_GUIDE.md.
// A default course is an ordinary course whose club_id is 0 (the reserved
// template space) — authoring reuses the normal course screens pointed at
// club 0 (the dashboard.super_admin.default_course_* alias states). These
// endpoints are ToAviate-admin gated server-side (403 for everyone else).
// Copy errors: ALREADY_COPIED (confirm → re-POST force:true),
// COPY_BUSY (never auto-retry), NOT_FOUND, BAD_CLUB.
// ─────────────────────────────────────────────────────
app.factory('DefaultCoursesService', DefaultCoursesService);

    DefaultCoursesService.$inject = ['$http', '$location'];
    function DefaultCoursesService($http, $location) {

        var base = '/api/v1/default_courses';
        var s = {};

        s.List = function(){ return $http.get(base).then(handleSuccess, handleError); };
        s.Create = function(d){ return $http.post(base, d).then(handleSuccess, handleError); };

        // Searchable copy-target dropdown (≤20, alphabetical — same q= pattern
        // as tpc_import/people). Club 0 is never in the results.
        s.Clubs = function(q){ return $http.get(base + '/clubs?q=' + encodeURIComponent(q || '')).then(handleSuccess, handleError); };

        // Read-only: counts of everything the copy would create.
        s.CopyPreview = function(id, club_id){ return $http.get(base + '/' + id + '/copy_preview/' + club_id).then(handleSuccess, handleError); };

        // The deep copy. force:true re-copies after an ALREADY_COPIED confirm.
        s.Copy = function(id, club_id, force){
            var body = { club_id: club_id };
            if (force) { body.force = true; }
            return $http.post(base + '/' + id + '/copy', body).then(handleSuccess, handleError);
        };

        return s;

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
