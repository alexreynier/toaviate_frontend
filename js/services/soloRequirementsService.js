app.factory('SoloRequirementsService', SoloRequirementsService);

    SoloRequirementsService.$inject = ['$http', '$location'];
    function SoloRequirementsService($http, $location) {

        // Club-defined pre-solo requirements (medical / questionnaire / exams…)
        // + per-student sign-offs and readiness status. Used by the club-admin
        // requirements editor, the instructor readiness screen, and the
        // bookout form's student-solo gate.
        // Requirements are club-wide (course_id null) or scoped to a course,
        // and are either manual (instructor sign-off) or auto-verified:
        //   auto_type 'medical'       — against the student's medical records
        //                               (optionally limited to accepted classes),
        //   auto_type 'questionnaire' — latest attempt at a linked questionnaire
        //                               (reviewed by an instructor by default),
        //   auto_type 'exam'          — a linked ground exam, optionally at a
        //                               minimum pass mark.
        // Contracts: FRONTEND_BOOKOUT_PILOT_CHECKS_GUIDE.md +
        // BACKEND_PRE_SOLO_COURSE_REQUIREMENTS_GUIDE.md.

        var service = {};

        service.GetForClub = GetForClub;           // active only, ordered
        service.GetForClubAdmin = GetForClubAdmin; // all incl. inactive
        service.Get = Get;
        service.Create = Create;
        service.SeedDefaults = SeedDefaults;
        service.Update = Update;
        service.Delete = Delete;

        service.GetStatus = GetStatus;             // per-student readiness
        service.SignOff = SignOff;
        service.RevokeSignOff = RevokeSignOff;

        service.GetExamsByClub = GetExamsByClub;   // exam picker (editor)

        return service;

        // course_id (optional) narrows to club-wide + that course's rows.
        function GetForClub(club_id, course_id) {
            return $http.get('/api/v1/solo_requirements/club/' + club_id + (course_id ? '/' + course_id : '')).then(handleSuccess, handleError2);
        }

        function GetForClubAdmin(club_id, course_id) {
            return $http.get('/api/v1/solo_requirements/club_admin/' + club_id + (course_id ? '/' + course_id : '')).then(handleSuccess, handleError2);
        }

        function Get(id) {
            return $http.get('/api/v1/solo_requirements/' + id).then(handleSuccess, handleError2);
        }

        // requirement = { club_id, name, description?,
        //                 auto_type: null|'medical'|'questionnaire'|'exam',
        //                 course_id?: null|id,             // null = all courses
        //                 medical_component_ids?: "1,2,3", // medical: accepted classes (empty = any certificate class)
        //                 questionnaire_id?, require_review?: 1|0,
        //                 exam_id?, min_score_percent?,
        //                 active: 1|0, display_order }
        function Create(requirement) {
            return $http.post('/api/v1/solo_requirements', requirement).then(handleSuccess, handleError2);
        }

        // Seeds Medical (auto) + Pre-solo questionnaire + Air law ground exam.
        // Refused if the club already has any requirements.
        function SeedDefaults(club_id) {
            return $http.post('/api/v1/solo_requirements/seed_defaults', { club_id: club_id }).then(handleSuccess, handleError2);
        }

        function Update(id, changes) {
            return $http.put('/api/v1/solo_requirements/' + id, changes).then(handleSuccess, handleError2);
        }

        // Refused when sign-offs exist ("set it inactive instead").
        function Delete(id) {
            return $http.delete('/api/v1/solo_requirements/' + id).then(handleSuccess, handleError2);
        }

        // Readiness for one student: { all_satisfied, date, course_id, course_ids,
        //   requirements: [ { id, name, auto_type, course_id, course_title,
        //     satisfied, via, state, detail, evidence, sign_off } ] }
        // With no course_id the backend derives the student's active courses;
        // pass the booking's/record's course whenever you have one.
        function GetStatus(club_id, user_id, course_id) {
            return $http.get('/api/v1/solo_requirements/status/' + club_id + '/' + user_id + (course_id ? '/' + course_id : '')).then(handleSuccess, handleError2);
        }

        // signoff = { club_id, user_id, requirement_id, expires_at?: 'YYYY-MM-DD', notes? }
        // Auto items (medical/questionnaire/exam) are refused (system-verified only).
        function SignOff(signoff) {
            return $http.post('/api/v1/solo_requirements/sign_off', signoff).then(handleSuccess, handleError2);
        }

        function RevokeSignOff(sign_off_id) {
            return $http.put('/api/v1/solo_requirements/sign_off/' + sign_off_id + '/revoke', {}).then(handleSuccess, handleError2);
        }

        // All ground exams of the club, for the requirement editor's exam picker
        // (CourseService.GetExamsByCourseId covers the course-scoped case).
        function GetExamsByClub(club_id) {
            return $http.get('/api/v1/exams/club/' + club_id).then(handleSuccess, handleError2);
        }

        function handleSuccess(res) { return res.data; }

        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            return { success: false, message: res.data, status: res.status };
        }
    }
