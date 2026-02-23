app.factory('InstructorQualificationsService', InstructorQualificationsService);

    InstructorQualificationsService.$inject = ['$http', '$location'];
    function InstructorQualificationsService($http, $location) {
        var service = {};

        // ── Matrix endpoints ────────────────────────────────────
        service.GetCourseMatrix       = GetCourseMatrix;
        service.GetTuitionMatrix      = GetTuitionMatrix;
        service.GetExperienceMatrix   = GetExperienceMatrix;

        // ── Per-instructor overview ─────────────────────────────
        service.GetOverview           = GetOverview;

        // ── Set qualifications (replace-all) ────────────────────
        service.SetCourses            = SetCourses;
        service.SetTuition            = SetTuition;
        service.SetExperiences        = SetExperiences;

        // ── Bulk / Select All ───────────────────────────────────
        service.BulkCourses           = BulkCourses;
        service.BulkTuition           = BulkTuition;
        service.BulkExperiences       = BulkExperiences;

        // ── Delete single link ──────────────────────────────────
        service.DeleteLink            = DeleteLink;

        // ── Per-item instructors ────────────────────────────────
        service.GetCourseInstructors      = GetCourseInstructors;
        service.GetTuitionInstructors     = GetTuitionInstructors;
        service.GetExperienceInstructors  = GetExperienceInstructors;

        return service;


        // ═══════════════════════════════════════════════════════════
        //  MATRIX ENDPOINTS
        // ═══════════════════════════════════════════════════════════

        function GetCourseMatrix(club_id) {
            return $http.get('/api/v1/instructor_qualifications/course_matrix/' + club_id)
                .then(handleSuccess, handleError2);
        }

        function GetTuitionMatrix(club_id) {
            return $http.get('/api/v1/instructor_qualifications/tuition_matrix/' + club_id)
                .then(handleSuccess, handleError2);
        }

        function GetExperienceMatrix(club_id) {
            return $http.get('/api/v1/instructor_qualifications/experience_matrix/' + club_id)
                .then(handleSuccess, handleError2);
        }


        // ═══════════════════════════════════════════════════════════
        //  PER‑INSTRUCTOR OVERVIEW
        // ═══════════════════════════════════════════════════════════

        function GetOverview(club_id, user_id) {
            return $http.get('/api/v1/instructor_qualifications/overview/' + club_id + '/' + user_id)
                .then(handleSuccess, handleError2);
        }


        // ═══════════════════════════════════════════════════════════
        //  SET QUALIFICATIONS (replace-all per instructor)
        // ═══════════════════════════════════════════════════════════

        function SetCourses(club_id, user_id, course_ids) {
            return $http.post('/api/v1/instructor_qualifications/set_courses', {
                club_id: club_id,
                user_id: user_id,
                course_ids: course_ids
            }).then(handleSuccess, handleError2);
        }

        function SetTuition(club_id, user_id, tuition_type_ids) {
            return $http.post('/api/v1/instructor_qualifications/set_tuition', {
                club_id: club_id,
                user_id: user_id,
                tuition_type_ids: tuition_type_ids
            }).then(handleSuccess, handleError2);
        }

        function SetExperiences(club_id, user_id, experience_ids) {
            return $http.post('/api/v1/instructor_qualifications/set_experiences', {
                club_id: club_id,
                user_id: user_id,
                experience_ids: experience_ids
            }).then(handleSuccess, handleError2);
        }


        // ═══════════════════════════════════════════════════════════
        //  BULK / SELECT ALL
        // ═══════════════════════════════════════════════════════════

        function BulkCourses(club_id, mode, target_id) {
            return $http.post('/api/v1/instructor_qualifications/bulk_courses', {
                club_id: club_id,
                mode: mode,
                target_id: target_id
            }).then(handleSuccess, handleError2);
        }

        function BulkTuition(club_id, mode, target_id) {
            return $http.post('/api/v1/instructor_qualifications/bulk_tuition', {
                club_id: club_id,
                mode: mode,
                target_id: target_id
            }).then(handleSuccess, handleError2);
        }

        function BulkExperiences(club_id, mode, target_id) {
            return $http.post('/api/v1/instructor_qualifications/bulk_experiences', {
                club_id: club_id,
                mode: mode,
                target_id: target_id
            }).then(handleSuccess, handleError2);
        }


        // ═══════════════════════════════════════════════════════════
        //  DELETE SINGLE LINK
        // ═══════════════════════════════════════════════════════════

        function DeleteLink(link_id, type) {
            return $http.delete('/api/v1/instructor_qualifications/' + link_id + '?type=' + type)
                .then(handleSuccess, handleError2);
        }


        // ═══════════════════════════════════════════════════════════
        //  PER-ITEM INSTRUCTOR LISTS
        // ═══════════════════════════════════════════════════════════

        function GetCourseInstructors(club_id, course_id) {
            return $http.get('/api/v1/instructor_qualifications/course_instructors/' + club_id + '/' + course_id)
                .then(handleSuccess, handleError2);
        }

        function GetTuitionInstructors(club_id, tuition_type_id) {
            return $http.get('/api/v1/instructor_qualifications/tuition_instructors/' + club_id + '/' + tuition_type_id)
                .then(handleSuccess, handleError2);
        }

        function GetExperienceInstructors(club_id, experience_id) {
            return $http.get('/api/v1/instructor_qualifications/experience_instructors/' + club_id + '/' + experience_id)
                .then(handleSuccess, handleError2);
        }


        // ═══════════════════════════════════════════════════════════
        //  HELPERS
        // ═══════════════════════════════════════════════════════════

        function handleSuccess(res) {
            return res.data;
        }

        function handleError2(res) {
            console.log('InstructorQualificationsService ERROR', res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
