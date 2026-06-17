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
            m.sharing = true;
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

            CourseAssignmentService.Share(payload).then(function(data) {
                m.sharing = false;
                if (!data || data.success === false) { ToastService.error('Could not share', (data && data.message) || ''); return; }
                var shared = data.shared || (data.results ? data.results.length : m.selected.length);
                var emailed = (data.results || []).filter(function(r) { return r.emailed; }).length;
                ToastService.success('Shared with ' + shared + ' student' + (shared === 1 ? '' : 's'),
                    m.sendEmail ? (emailed + ' notified by email.') : 'Added to their tasks (no email).');
                $uibModalInstance.close(data);
            });
        };

        m.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }
