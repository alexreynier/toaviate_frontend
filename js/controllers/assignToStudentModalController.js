// ─────────────────────────────────────────────────────
// AssignToStudentModalController — student-first assignment. Opened from the
// instructor's "Student Questionnaires" page with a student already chosen.
//
// The instructor narrows down: Course → (optional) Lesson → Pre/Post timing,
// then picks one of the questionnaires *attached to that target*. This keeps the
// choice tight even when a club has many courses. Then optional message / due
// date / email, and assign to the one student.
//
// (Material is assigned from the course/lesson content view instead — there is
//  no club-wide material library endpoint to pick from here.)
//
// Resolves: clubId, student ({id, name}).
// ─────────────────────────────────────────────────────
app.controller('AssignToStudentModalController', AssignToStudentModalController);

    AssignToStudentModalController.$inject = ['$uibModalInstance', 'CourseAssignmentService', 'QuestionnaireService', 'CourseService', 'ToastService', '$q', 'clubId', 'student'];
    function AssignToStudentModalController($uibModalInstance, CourseAssignmentService, QuestionnaireService, CourseService, ToastService, $q, clubId, student) {
        var m = this;
        m.student = student;           // { id, name }

        // ── Scope selectors ──
        m.courses = [];
        m.lessons = [];
        m.courseId = null;             // selected course id
        m.lessonId = null;             // selected lesson id (null = whole course)
        m.timing = 'pre';              // 'pre' | 'post'

        // ── Questionnaire list for the current scope ──
        m.questionnaires = [];
        m.pick = null;                 // chosen questionnaire object
        m.loadingCourses = true;
        m.loadingLessons = false;
        m.loadingQs = false;

        // ── Assignment details ──
        m.message = '';
        m.dueDate = null;
        m.sendEmail = true;

        // Load the club's courses up front.
        CourseService.GetCoursesByClubId(clubId).then(function(data) {
            m.loadingCourses = false;
            m.courses = listOf(data, ['items', 'courses']);
        });

        function listOf(data, keys) {
            if (angular.isArray(data)) return data;
            if (data) for (var i = 0; i < keys.length; i++) if (angular.isArray(data[keys[i]])) return data[keys[i]];
            return [];
        }

        // Course changed → load its lessons + refresh questionnaire list (whole course).
        m.onCourseChange = function() {
            m.lessonId = null;
            m.lessons = [];
            m.pick = null;
            if (!m.courseId) { m.questionnaires = []; return; }
            m.loadingLessons = true;
            CourseService.GetLessonsByCourseId(m.courseId).then(function(data) {
                m.loadingLessons = false;
                m.lessons = listOf(data, ['items', 'lessons']);
            });
            loadQuestionnaires();
        };

        // Lesson or timing changed → refresh questionnaire list.
        m.onScopeChange = function() { m.pick = null; loadQuestionnaires(); };

        m.setTiming = function(t) { if (m.timing !== t) { m.timing = t; m.onScopeChange(); } };

        function loadQuestionnaires() {
            if (!m.courseId) { m.questionnaires = []; return; }
            var type = m.lessonId ? 'lesson' : 'course';
            var id = m.lessonId ? m.lessonId : m.courseId;
            m.loadingQs = true;
            QuestionnaireService.GetForTarget(type, id, m.timing).then(function(data) {
                m.loadingQs = false;
                var list = listOf(data, ['items', 'questionnaires']);
                // only assignable (published) questionnaires
                m.questionnaires = list.filter(function(q) { return q.is_published !== false && q.is_published !== 0; });
            });
        }

        m.choose = function(q) { m.pick = (m.pick && m.pick.id === q.id) ? null : q; };

        function ymd(d) {
            if (!d) return null;
            if (typeof d === 'string') return d.slice(0, 10);
            var y = d.getFullYear(), mo = ('0' + (d.getMonth() + 1)).slice(-2), da = ('0' + d.getDate()).slice(-2);
            return y + '-' + mo + '-' + da;
        }

        m.assign = function() {
            if (!m.pick) { ToastService.warning('Pick a questionnaire', 'Choose what to assign.'); return; }
            var payload = {
                item_type: 'questionnaire',
                item_id: m.pick.id,
                student_ids: [m.student.id],
                message: m.message || '',
                due_date: ymd(m.dueDate),
                send_email: m.sendEmail ? true : false,
                // carry scope so the deep link + attempt bind to the right target/timing
                attach_type: m.lessonId ? 'lesson' : 'course',
                attach_id: m.lessonId ? m.lessonId : m.courseId,
                timing: m.timing,
                course_id: m.courseId
            };
            submit(payload, false);
        };

        // ── Re-assign confirmation ──
        // needs_confirm:true (student already_completed) is NOT an error — show the
        // message, and on confirm re-POST with confirm:true to grant a fresh blank
        // attempt (the old one is preserved).
        m.confirmNeeded = false;
        m.confirmMessage = '';
        var pendingPayload = null;

        function submit(payload, confirmed) {
            m.saving = true;
            if (confirmed) payload.confirm = true;
            CourseAssignmentService.Share(payload).then(function(data) {
                m.saving = false;

                if (data && data.needs_confirm && !confirmed) {
                    pendingPayload = payload;
                    m.confirmMessage = data.message ||
                        'This student has already completed this questionnaire. Re-assign anyway? A fresh retake will be granted.';
                    m.confirmNeeded = true;
                    return;
                }

                m.confirmNeeded = false;
                if (!data || data.success === false) { ToastService.error('Could not assign', (data && data.message) || ''); return; }
                var emailed = (data.results || []).filter(function(r) { return r.emailed; }).length;
                ToastService.success('Assigned to ' + (m.student.name || 'student'),
                    m.sendEmail && emailed ? 'They’ve been emailed a link.' : 'Added to their tasks.');
                $uibModalInstance.close(data);
            });
        }

        m.confirmReassign = function() {
            if (!pendingPayload) return;
            submit(pendingPayload, true);
        };
        m.cancelReassign = function() {
            m.confirmNeeded = false;
            pendingPayload = null;
        };

        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }
