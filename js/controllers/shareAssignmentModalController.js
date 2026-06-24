// ─────────────────────────────────────────────────────
// ShareAssignmentModalController — instructor shares a questionnaire/material
// with one or more students (message + optional due date). Used via $uibModal.
// Resolves: clubId, item ({type, id, title}), context ({attach_type, attach_id,
// timing, course_sitting_id, course_id}).
// ─────────────────────────────────────────────────────
app.controller('ShareAssignmentModalController', ShareAssignmentModalController);

    ShareAssignmentModalController.$inject = ['$uibModalInstance', 'CourseAssignmentService', 'MemberService', 'ToastService', '$q', 'clubId', 'item', 'context'];
    function ShareAssignmentModalController($uibModalInstance, CourseAssignmentService, MemberService, ToastService, $q, clubId, item, context) {
        var m = this;
        m.item = item;                 // { type, id, title }
        m.context = context || {};
        m.loadingStudents = true;
        m.students = [];               // all club members
        m.selected = [];               // chosen students
        m.message = '';
        m.dueDate = null;
        m.sendEmail = true;

        (MemberService.GetAllByClub ? MemberService.GetAllByClub(clubId) : $q.when([])).then(function(data) {
            m.loadingStudents = false;
            var members = (data && data.members) ? data.members : (angular.isArray(data) ? data : []);
            m.students = members.map(function(mem) {
                return { id: mem.user_id || mem.id, name: ((mem.first_name || '') + ' ' + (mem.last_name || '')).trim(), email: mem.email || '' };
            }).filter(function(s) { return s.id; });
        });

        // ui-select multiple gives us m.selected directly; keep a removeable chip list.
        m.removeStudent = function(s) {
            m.selected = m.selected.filter(function(x) { return x.id !== s.id; });
        };

        function ymd(d) {
            if (!d) return null;
            if (typeof d === 'string') return d.slice(0, 10);
            var y = d.getFullYear(), mo = ('0' + (d.getMonth() + 1)).slice(-2), da = ('0' + d.getDate()).slice(-2);
            return y + '-' + mo + '-' + da;
        }

        m.share = function() {
            if (!m.selected.length) { ToastService.warning('Pick a student', 'Choose at least one student to share with.'); return; }
            var payload = {
                item_type: m.item.type,
                item_id: m.item.id,
                student_ids: m.selected.map(function(s) { return s.id; }),
                message: m.message || '',
                due_date: ymd(m.dueDate),
                send_email: m.sendEmail ? true : false
            };
            // Carry the course/lesson context so the deep link + attempt bind correctly.
            ['attach_type', 'attach_id', 'timing', 'course_sitting_id', 'course_id'].forEach(function(k) {
                if (m.context[k] != null && m.context[k] !== '') payload[k] = m.context[k];
            });
            submit(payload, false);
        };

        // ── Re-assign confirmation ──
        // The backend returns needs_confirm:true (NOT an error) when a student in
        // results[] has already_completed:true. We surface its message and, on
        // confirm, re-POST the identical payload with confirm:true — which re-assigns
        // and grants a fresh blank attempt (the old one is preserved). confirm:true
        // is idempotent-friendly, so re-sending all students is safe.
        m.confirmNeeded = false;
        m.confirmMessage = '';
        var pendingPayload = null;

        function submit(payload, confirmed) {
            m.sharing = true;
            if (confirmed) payload.confirm = true;
            CourseAssignmentService.Share(payload).then(function(data) {
                m.sharing = false;

                if (data && data.needs_confirm && !confirmed) {
                    // Not an error — ask the instructor, then retry with confirm:true.
                    pendingPayload = payload;
                    m.confirmMessage = data.message ||
                        'One or more students have already completed this. Re-assign anyway? A fresh retake will be granted.';
                    m.confirmNeeded = true;
                    return;
                }

                m.confirmNeeded = false;
                if (!data || data.success === false) { ToastService.error('Could not share', (data && data.message) || ''); return; }
                var shared = data.shared || (data.results ? data.results.length : m.selected.length);
                var emailed = (data.results || []).filter(function(r) { return r.emailed; }).length;
                ToastService.success('Shared with ' + shared + ' student' + (shared === 1 ? '' : 's'),
                    m.sendEmail ? (emailed + ' notified by email.') : 'Added to their tasks (no email).');
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
