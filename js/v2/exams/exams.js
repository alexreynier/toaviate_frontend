/* ═══════════════════════════════════════════════════════════════════════════
   v2 screen: exams — design: mockups/my-account/questionnaires-exams.html (approved 7 Nov 2026)
   Questionnaires hub (assigned + history), take a questionnaire, its result, lesson material, theory exams, CAA forms.

   v1 it replaces:  dashboard.my_account.assigned / questionnaires / questionnaire_take / questionnaire_result / material_view
                    (StudentQuestionnaireController, views/my_account/questionnaires/*), dashboard.my_account.my_exams
                    (MyExamsController), dashboard.my_account.caa_forms (CaaFormsController, screen 'member').
   Same server calls as v1: course_assignments/mine (+ /{id}/viewed), questionnaires/mine, questionnaires/{id}/open,
   questionnaires/attempt/{id} (+ /save, /submit), questionnaires/{id} (option labels — instructors only, as in v1),
   course_materials/{id} (+ /file, /stream, /status, /track, /target/{type}/{id}), exam_sales/user_clubs/{me},
   exam_sales/user/{club}/{me}, exams/course/{id}, exam_record_files/record/{id} + /file/{id}, caa_forms/mine,
   caa_forms/queue?club_id, caa_forms/{id}/pdf. Signing a CAA form opens today's form page (dashboard.caa_form).
   The Training hub bar is the shared partial views/v2/training/_hub.html (+ the trnTabsInView directive in
   js/v2/training/training.js) so the five Training tabs read the same on every page.
   Views: views/v2/exams/*.html · CSS: css/v2/exams.css (page prefix qx-, tokens only).

   Hidden until the backend adds them (backend-companion.md §4 "Questionnaires and exams", Can follow):
     • assignment detail — who set it (name), the lesson / course it is for, question count, time guide and
       "score as soon as you submit" on the hub (course_assignments/mine sends ids only); the take page shows them
       once the questionnaire is open (questionnaires/{id}/open sends title, time limit and instant scoring);
     • "still awaiting review" after an instant score (needs a needs_review field): an instantly scored attempt reads Reviewed;
     • the multiple-choice options on a result (students can't read the questionnaire definition): answers show as
       "Answer recorded" + right / wrong, unless this browser has just taken it (the options are kept for the session);
     • the CAA form's document label and who started it (list rows carry the initiator's id only).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.questionnaires', {
            url: '/my_account/questionnaires',
            templateUrl: 'views/v2/exams/hub.html',
            controller: 'QxHubV2Controller', controllerAs: 'vm',
            data: { screen: 'mine' }
        })
        .state('dashboard.v2.questionnaire_take', {
            url: '/my_account/questionnaire/:questionnaire_id/take?attach_type&attach_id&timing&sitting',
            templateUrl: 'views/v2/exams/take.html',
            controller: 'QxTakeV2Controller', controllerAs: 'vm',
            data: { screen: 'take' }
        })
        .state('dashboard.v2.questionnaire_result', {
            url: '/my_account/questionnaire/attempt/:attempt_id',
            templateUrl: 'views/v2/exams/result.html',
            controller: 'QxResultV2Controller', controllerAs: 'vm',
            data: { screen: 'result' }
        })
        .state('dashboard.v2.material_view', {
            url: '/my_account/material/:material_id',
            templateUrl: 'views/v2/exams/material.html',
            controller: 'QxMaterialV2Controller', controllerAs: 'vm',
            data: { screen: 'material' }
        })
        .state('dashboard.v2.my_exams', {
            url: '/my_account/my_exams',
            templateUrl: 'views/v2/exams/exams.html',
            controller: 'QxExamsV2Controller', controllerAs: 'vm'
        })
        .state('dashboard.v2.caa_forms', {
            url: '/my_account/caa_forms',
            templateUrl: 'views/v2/exams/caa.html',
            controller: 'QxCaaV2Controller', controllerAs: 'vm',
            data: { screen: 'member' }
        });
    DesignRoutesProvider
        .map('dashboard.my_account.questionnaires', 'dashboard.v2.questionnaires')
        .map('dashboard.my_account.assigned', 'dashboard.v2.questionnaires')
        .map('dashboard.my_account.questionnaire_take', 'dashboard.v2.questionnaire_take')
        .map('dashboard.my_account.questionnaire_result', 'dashboard.v2.questionnaire_result')
        .map('dashboard.my_account.material_view', 'dashboard.v2.material_view')
        .map('dashboard.my_account.my_exams', 'dashboard.v2.my_exams')
        .map('dashboard.my_account.caa_forms', 'dashboard.v2.caa_forms');
}]);

/* ═════ words, dates and statuses for this screen (one helper per domain) ═════ */
app.factory('QxV2Data', QxV2Data);
QxV2Data.$inject = ['$rootScope', 'CourseAssignmentService', 'CaaFormsService'];
function QxV2Data($rootScope, CourseAssignmentService, CaaFormsService) {
    var X = {};
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    X.LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    X.pd = function (s) {
        if (!s || String(s).indexOf('0000-00-00') === 0) { return null; }
        var p = String(s).replace('T', ' ').split(' '), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    };
    X.ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    X.today = function () { return X.ymd(new Date()); };
    X.fDate = function (s) { var d = X.pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    X.fDay = function (s) { var d = X.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
    X.fDayLong = function (s) { var d = X.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    X.fTime = function (s) { var t = String(s || '').replace('T', ' ').split(' ')[1] || ''; return /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5) : ''; };
    X.monthKey = function (s) { var d = X.pd(s); return d ? MONTH[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    X.plural = function (n, w, many) { return n + ' ' + (n === 1 ? w : (many || w + 's')); };
    X.mmss = function (sec) { var a = Math.abs(Math.round(+sec || 0)); return Math.floor(a / 60) + ':' + pad(a % 60); };
    X.mins = function (sec) { return Math.max(1, Math.round((+sec || 0) / 60)) + ' min'; };
    X.words = function (t) { var s = String(t || '').trim(); return X.plural(s ? s.split(/\s+/).length : 0, 'word'); };
    X.pct = function (a, b) { return +b ? Math.round(+a / +b * 100) : 0; };
    X.num = function (x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; };
    X.trim = function (s) { return String(s == null ? '' : s).trim(); };
    // a server message fit to show: a short sentence, never an HTML error page or an object
    X.msg = function (data) { if (data && data.status != null && (+data.status <= 0 || +data.status >= 500)) { return ''; }   // a server / connection failure body is never a sentence for the member
        var m = data && data.message; if (m && typeof m === 'object') { m = m.message; } return (typeof m === 'string' && m && !/^\s*</.test(m) && m.length < 300) ? m : ''; };
    X.first = function (name) { return X.trim(name).split(/\s+/)[0] || ''; };
    X.lessonLine = function (start) { return (String(start).slice(0, 10) === X.today() ? 'Lesson today, ' : 'Lesson ' + X.fDay(start) + ', ') + X.fTime(start); };
    X.initials = function (name) { var p = X.trim(name).split(/\s+/); return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); };
    X.trunc = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    X.money = function (x, sym) { var n = X.num(x); return (n < 0 ? '−' : '') + (sym || '£') + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

    /* ── the questionnaires hub: assignments + attempts merged per questionnaire (v1's mergeMine rule) ── */
    function attemptGroup(at) {
        var s = at.attempt_status || at.status;
        if (at.needs_review === true || +at.needs_review === 1) { return 'awaiting_review'; }   // C21: written answers still to mark (even with an instant MC score)
        if (s === 'reviewed' || +at.score_released === 1 || at.score_released === true) { return 'reviewed'; }
        if (s === 'submitted') { return 'awaiting_review'; }
        return 'to_do';
    }
    X.merge = function (assignments, attempts) {
        var byQ = {}, currentByQ = {};
        attempts = attempts || [];
        attempts.forEach(function (at) { var c = currentByQ[at.questionnaire_id]; if (!c || (+at.id || 0) >= (+c.id || 0)) { currentByQ[at.questionnaire_id] = at; } });
        var current = {}; Object.keys(currentByQ).forEach(function (q) { current[currentByQ[q].id] = true; });
        var history = {};
        attempts.filter(function (at) { return !current[at.id]; }).forEach(function (at) { (history[at.questionnaire_id] = history[at.questionnaire_id] || []).push(at); });
        Object.keys(history).forEach(function (q) { history[q].sort(function (a, b) { return (+b.id || 0) - (+a.id || 0); }); });
        var rows = [];
        (assignments || []).forEach(function (a) {
            if (a.item_type === 'material') {
                rows.push({ key: 'm' + a.id, item: 'material', id: a.item_id, title: a.item_title || 'Reading', message: X.trim(a.message), due: a.due_date || null,
                    setAt: a.assigned_at || a.created_at, status: a.status, completedAt: a.completed_at, assignmentId: a.id, history: [],
                    // C21 assignment detail
                    by: X.trim(a.assigned_by_name), target: X.trim(a.target_title) || null, booking: a.next_booking || null,
                    ft: a.file_type === 'video' ? 'video' : (a.file_type ? 'pdf' : null), failed: a.processing_status === 'failed' });
                return;
            }
            byQ[a.item_id] = { key: 'q' + a.item_id, item: 'q', qid: a.item_id, title: a.item_title, message: X.trim(a.message), due: a.due_date || null,
                setAt: a.assigned_at || a.created_at, attach_type: a.attach_type, attach_id: a.attach_id, timing: a.timing, sitting: a.course_sitting_id,
                assignmentId: a.id, isRetake: +a.is_retake === 1, attempt: null, group: 'to_do',
                // C21 assignment detail
                by: X.trim(a.assigned_by_name), target: X.trim(a.target_title) || null, booking: a.next_booking || null,
                qn: +a.question_count || 0, limit: +a.time_limit_minutes || 0, instant: +a.instant_mc_score === 1,
                // a retake set but not opened yet: its assignment is still open and links no attempt (or an older one)
                retakeOpen: +a.is_retake === 1 && a.status !== 'completed', linkedAttempt: a.attempt_id ? +a.attempt_id : null };
            rows.push(byQ[a.item_id]);   // keep the backend's order (due date, then newest) for both kinds
        });
        attempts.filter(function (at) { return current[at.id]; }).forEach(function (at) {
            var r = byQ[at.questionnaire_id];
            if (!r) {
                r = byQ[at.questionnaire_id] = { key: 'q' + at.questionnaire_id, item: 'q', qid: at.questionnaire_id, title: at.questionnaire_title || at.title,
                    message: '', due: null, setAt: at.opened_at, attach_type: at.attach_type, attach_id: at.attach_id, timing: at.timing, sitting: at.course_sitting_id, assignmentId: null, attempt: null, group: 'to_do' };
                rows.push(r);
            }
            if (r.retakeOpen && r.linkedAttempt !== +at.id && attemptGroup(at) !== 'to_do') {
                (history[r.qid] = history[r.qid] || []).unshift(at);   // the take before the retake: history, the row stays To do
                return;
            }
            r.attempt = at; r.group = attemptGroup(at);
            r.title = r.title || at.questionnaire_title || at.title;
            r.target = at.target_title || r.target || null;
            r.inProgress = r.group === 'to_do' && (at.status === 'opened' || at.status === 'in_progress');
            r.score = (+at.score_released === 1 && at.max_score != null && +at.max_score > 0) ? { auto: X.num(at.auto_score), max: X.num(at.max_score) } : null;
            if (+at.attempt_number > 1 && r.group === 'to_do') { r.isRetake = true; }
        });
        Object.keys(byQ).forEach(function (k) { var r = byQ[k]; r.history = history[r.qid] || []; });
        rows.forEach(function (r) { r.st = X.rowStatus(r); r.act = X.rowAction(r); });
        return rows;
    };
    X.isTodo = function (r) { return r.item === 'material' ? r.status !== 'completed' : r.group === 'to_do'; };
    X.isWait = function (r) { return r.item !== 'material' && r.group === 'awaiting_review'; };
    X.isDone = function (r) { return r.item === 'material' ? r.status === 'completed' : r.group === 'reviewed'; };
    X.overdue = function (r) { return !!r.due && r.due < X.today() && X.isTodo(r); };
    X.rowStatus = function (r) {
        if (r.item === 'material') {
            if (r.failed) { return { tone: 'bad', label: 'Couldn’t be prepared', ic: 'fa-exclamation-triangle' }; }
            if (r.status === 'completed') { return { tone: 'good', label: r.ft === 'video' ? 'Watched' : (r.ft ? 'Read' : 'Done'), ic: 'fa-check' }; }
            if (X.overdue(r)) { return { tone: 'bad', label: 'Overdue', ic: 'fa-exclamation-circle' }; }
            return { tone: 'warn', label: r.status === 'viewed' ? 'Opened' : (r.ft === 'video' ? 'To watch' : 'To read'), ic: 'fa-book-open' };
        }
        if (r.group === 'reviewed') { return { tone: 'good', label: 'Reviewed', ic: 'fa-check' }; }
        if (r.group === 'awaiting_review') { return { tone: 'info', label: 'Awaiting review', ic: 'fa-hourglass-half' }; }
        if (X.overdue(r)) { return { tone: 'bad', label: 'Overdue', ic: 'fa-exclamation-circle' }; }
        if (r.isRetake) { return { tone: 'warn', label: 'Retake', ic: 'fa-redo' }; }
        if (r.inProgress) { return { tone: 'warn', label: 'In progress', ic: 'fa-pen' }; }
        return { tone: 'warn', label: 'To do', ic: 'fa-pen' };
    };
    X.rowAction = function (r) {
        if (r.item === 'material') {
            if (r.failed) { return 'Open'; }
            var verb = r.ft === 'video' ? 'Watch' : (r.ft ? 'Read' : 'Open');
            return r.status === 'completed' ? verb + ' again' : verb;
        }
        if (r.group === 'reviewed') { return 'See result'; }
        if (r.group === 'awaiting_review') { return 'See your answers'; }
        if (r.inProgress) { return 'Continue'; }
        return r.isRetake ? 'Start retake' : 'Start';
    };
    X.when = function (r) {
        var at = r.attempt;
        if (X.isTodo(r)) {
            var lesson = r.booking && r.booking.start ? X.lessonLine(r.booking.start) : '';
            if (X.overdue(r)) { return { bad: true, l1: 'Overdue · due ' + X.fDay(r.due), l2: lesson }; }
            if (r.due) { return { l1: 'Due ' + X.fDay(r.due), l2: lesson }; }
            return { l1: 'No due date', l2: lesson || (r.setAt ? 'Set ' + X.fDay(r.setAt) : '') };
        }
        if (X.isWait(r)) { return { l1: 'Submitted ' + X.fDay(at && at.submitted_at), l2: (r.by ? X.first(r.by) : 'Your instructor') + ' reviews it next' }; }
        if (r.item === 'material') { return { l1: (r.ft === 'video' ? 'Watched ' : (r.ft ? 'Read ' : 'Done ')) + (r.completedAt ? X.fDay(r.completedAt) : ''), l2: 'Marked as done' }; }
        return { l1: 'Reviewed ' + X.fDay((at && (at.reviewed_at || at.submitted_at)) || ''), l2: '' };
    };
    X.sortTodo = function (list) {
        return list.slice().sort(function (a, b) {
            var oa = X.overdue(a) ? 0 : 1, ob = X.overdue(b) ? 0 : 1; if (oa !== ob) { return oa - ob; }
            return (a.due || '9999') < (b.due || '9999') ? -1 : ((a.due || '9999') > (b.due || '9999') ? 1 : 0);
        });
    };
    X.doneDate = function (r) { return r.item === 'material' ? (r.completedAt || '') : ((r.attempt && (r.attempt.reviewed_at || r.attempt.submitted_at)) || ''); };
    X.histStatus = function (at) {
        if (at.status === 'reviewed' || +at.score_released === 1) { return { tone: 'good', label: 'Reviewed', ic: 'fa-check' }; }
        if (at.status === 'submitted') { return { tone: 'info', label: 'Awaiting review', ic: 'fa-hourglass-half' }; }
        return { tone: 'muted', label: 'Not submitted', ic: '' };
    };
    X.histViewable = function (at) { return at.status === 'submitted' || at.status === 'reviewed' || !!at.submitted_at; };
    X.markViewed = function (r) { if (r && r.assignmentId) { CourseAssignmentService.MarkViewed(r.assignmentId); } };
    X.hubCounts = function (hub) { CourseAssignmentService.MineCount().then(function (d) { hub.todo = (d && typeof d.count === 'number') ? d.count : 0; }); X.signCount(hub); };
    /* the CAA forms tab's badge: my own forms waiting for my applicant signature (the CAA page itself adds the per-club queue) */
    X.signCount = function (hub) {
        var me = +((($rootScope.globals || {}).currentUser || {}).id || 0);
        CaaFormsService.Mine().then(function (d) {
            if (!d || d.success === false || hub.cur === 'caa') { return; }
            hub.sign = (d.forms || []).filter(function (f) {
                return f.status === 'awaiting_signatures' && !f.read_only && (f.signatures || []).some(function (s) { return s.role === 'applicant' && s.status === 'pending' && (s.signer_user_id == null || +s.signer_user_id === me); });
            }).length;
        });
    };

    /* ── CAA forms ── */
    var CAA_STATUS = {
        draft: { tone: 'pend', label: 'Being prepared', ic: 'fa-pen' },
        awaiting_signatures: { tone: 'info', label: 'Waiting for signatures', ic: 'fa-hourglass-half' },
        awaiting_hot: { tone: 'info', label: 'With the Head of Training', ic: 'fa-user-tie' },
        completed: { tone: 'good', label: 'Completed', ic: 'fa-check' },
        declined: { tone: 'bad', label: 'Declined', ic: 'fa-times-circle' },
        cancelled: { tone: 'muted', label: 'Cancelled', ic: 'fa-ban' }
    };
    X.ROLE = { applicant: 'Applicant (you)', instructor: 'Instructor', examiner: 'Examiner', hot: 'Head of Training' };
    X.caaTitle = function (f) { return f.title || CaaFormsService.typeTitle(f.form_type); };
    X.caaStatus = function (f, need) { return need ? { tone: 'warn', label: 'Needs your signature', ic: 'fa-pen-nib' } : (CAA_STATUS[f.status] || { tone: 'muted', label: String(f.status || '').replace(/_/g, ' '), ic: '' }); };
    X.caaSteps = function (f) {
        var sigs = f.signatures || [], st = [{ t: 'Prepared', s: f.status === 'draft' ? 'now' : 'done' }];
        ['applicant', 'instructor', 'examiner'].forEach(function (role) {
            var s = sigs.filter(function (x) { return x.role === role; })[0]; if (!s) { return; }
            st.push({ t: role === 'applicant' ? 'You sign' : X.ROLE[role] + ' signs', s: s.status === 'signed' ? 'done' : (s.status === 'declined' ? 'bad' : (f.status === 'awaiting_signatures' ? 'now' : '')) });
        });
        var hot = sigs.filter(function (x) { return x.role === 'hot'; })[0];
        if (hot) { st.push({ t: 'Head of Training', s: hot.status === 'signed' ? 'done' : (hot.status === 'declined' ? 'bad' : (f.status === 'awaiting_hot' ? 'now' : '')) }); }
        st.push({ t: 'Completed', s: f.status === 'completed' ? 'done' : '' });
        var k = st.filter(function (x) { return x.s === 'done'; }).length;
        return { steps: st, label: f.status === 'completed' ? 'All done' : 'Step ' + Math.min(k + 1, st.length) + ' of ' + st.length };
    };
    X.sigPill = function (f, s) {
        if (s.status === 'signed') { return { tone: 'good', label: 'Signed ' + X.fDay(s.signed_at), ic: 'fa-check' }; }
        if (s.status === 'declined') { return { tone: 'bad', label: 'Declined ' + X.fDay(s.signed_at), ic: 'fa-times-circle' }; }
        if (s.role === 'applicant' && f.status === 'awaiting_signatures') { return { tone: 'warn', label: 'Waiting for you', ic: 'fa-pen-nib' }; }
        if (s.role === 'hot' && f.status !== 'awaiting_hot') { return { tone: 'muted', label: 'After the others', ic: '' }; }
        return { tone: 'info', label: 'Waiting', ic: 'fa-hourglass-half' };
    };

    /* ── theory exams: one helper for purchases + their invoices ── */
    X.invKind = function (s) {
        return { confirmed: 'paid', paid_out: 'paid', paid: 'paid', complete: 'paid', completed: 'paid', pending_submission: 'requesting', submitted: 'requested',
            issued: 'unpaid', created: 'unpaid', failed: 'failed', charged_back: 'failed' }[s] || null;
    };
    X.invPill = function (s) {
        var k = X.invKind(s);
        return k === 'paid' ? { tone: 'good', label: 'Paid', ic: 'fa-check' } : k === 'requesting' ? { tone: 'pend', label: 'Requesting', ic: 'fa-university' }
            : k === 'requested' ? { tone: 'info', label: 'Requested', ic: 'fa-university' } : k === 'unpaid' ? { tone: 'warn', label: 'To pay', ic: 'fa-exclamation-circle' }
            : k === 'failed' ? { tone: 'bad', label: 'Payment failed', ic: 'fa-times-circle' } : null;
    };
    X.subject = function (exam, purchases) {
        var ps = purchases.filter(function (p) { return +p.exam_id === +exam.id; }).sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? -1 : 1; });
        var res = ps.filter(function (p) { return p.status === 'result_entered'; }).sort(function (a, b) { return String(a.record_date) < String(b.record_date) ? -1 : 1; });
        var pass = res.filter(function (p) { return +p.record_pass_fail === 1; })[0] || null, open = ps.filter(function (p) { return p.status === 'purchased'; })[0] || null;
        var unpaid = ps.filter(function (p) { return p.status !== 'cancelled' && X.invKind(p.invoice_status) === 'unpaid'; })[0] || null;
        var x = { id: +exam.id, title: exam.title || (ps[0] && ps[0].exam_title) || 'Exam', description: exam.description, ps: ps, res: res, pass: pass, open: open, unpaid: unpaid,
            last: res[res.length - 1] || null, best: res.length ? Math.max.apply(null, res.map(function (p) { return X.num(p.record_result); })) : null,
            state: pass ? 'pass' : (open ? 'wait' : (res.length ? 'fail' : (ps.length ? 'cancelled' : 'none'))), files: [] };
        x.st = x.state === 'pass' ? { tone: 'good', label: 'Passed', ic: 'fa-check' } : x.state === 'wait' ? (x.unpaid ? { tone: 'warn', label: 'To pay', ic: 'fa-exclamation-circle' } : { tone: 'info', label: 'Awaiting result', ic: 'fa-hourglass-half' })
            : x.state === 'fail' ? { tone: 'bad', label: 'Not passed', ic: 'fa-times' } : x.state === 'cancelled' ? { tone: 'muted', label: 'Cancelled', ic: 'fa-ban' } : { tone: 'muted', label: 'Not bought yet', ic: 'fa-minus' };
        if (x.state === 'none') { x.sub = 'Not bought yet'; }
        else if (x.state === 'cancelled') { x.sub = 'Purchase cancelled ' + X.fDate(ps[0].created_at); }
        else { x.sub = (res.length ? X.plural(res.length, 'sitting') : 'Bought ' + X.fDate(open.created_at)) + (pass && res.length > 1 ? ' · passed on attempt ' + (res.indexOf(pass) + 1) : '') + (open && res.length ? ' · re-sit bought ' + X.fDate(open.created_at) : ''); }
        return x;
    };
    return X;
}

/* ═════ PAGE: Questionnaires hub ═════ */
app.controller('QxHubV2Controller', QxHubV2Controller);
QxHubV2Controller.$inject = ['$rootScope', '$q', '$state', 'CourseAssignmentService', 'QuestionnaireService', 'QxV2Data'];
function QxHubV2Controller($rootScope, $q, $state, CourseAssignmentService, QuestionnaireService, QxV2Data) {
    var vm = this, X = QxV2Data;
    vm.X = X;
    vm.user = $rootScope.globals.currentUser;
    vm.hub = { cur: 'assigned', title: 'Questionnaires', hint: 'Work your instructor sets you, and everything you’ve done', icon: 'fa-clipboard-check', todo: 0, sign: 0 };
    vm.loading = true;
    vm.error = '';
    vm.rows = []; vm.filter = 'all'; vm.open = null;
    var signAsked = false;
    vm.setFilter = function (f) { vm.filter = f; vm.open = null; build(); };
    vm.toggle = function (r) { vm.open = vm.open === r.key ? null : r.key; };
    vm.go = go;
    vm.goAttempt = function (at) { if (X.histViewable(at)) { $state.go('dashboard.my_account.questionnaire_result', { attempt_id: at.id }); } };
    vm.reload = load;
    load();

    function load() {
        vm.loading = true; vm.error = '';
        $q.all([CourseAssignmentService.Mine(), QuestionnaireService.Mine()]).then(function (r) {
            vm.loading = false;
            if ((!r[0] || r[0].success === false) && (!r[1] || r[1].success === false)) {
                vm.error = 'Your questionnaires couldn’t be loaded. Check your connection and try again.';
                return;
            }
            var assignments = ((r[0] && r[0].items) || (angular.isArray(r[0]) ? r[0] : [])).filter(function (a) { return a.status !== 'revoked' && !a.revoked; });
            vm.rows = X.merge(assignments, (r[1] && r[1].items) || []);
            build();
        });
    }
    function build() {
        var rows = vm.rows;
        vm.todo = X.sortTodo(rows.filter(X.isTodo));
        vm.wait = rows.filter(X.isWait);
        vm.done = rows.filter(X.isDone).sort(function (a, b) { return X.doneDate(a) < X.doneDate(b) ? 1 : -1; });
        vm.hub.todo = vm.todo.length;
        if (!signAsked) { signAsked = true; X.signCount(vm.hub); }
        vm.next = vm.todo[0] || null;
        vm.chips = [{ k: 'all', label: 'All', n: rows.length }, { k: 'todo', label: 'To do', n: vm.todo.length, attn: true }, { k: 'wait', label: 'Awaiting review', n: vm.wait.length }, { k: 'done', label: 'Done', n: vm.done.length }]
            .filter(function (c) { return c.k === 'all' || c.n; });
        var f = vm.filter, groups = [];
        if ((f === 'all' || f === 'todo') && vm.todo.length) { groups.push({ k: 'todo', label: 'To do', ic: 'fa-pen', attn: true, list: vm.todo }); }
        if ((f === 'all' || f === 'wait') && vm.wait.length) { groups.push({ k: 'wait', label: 'Waiting for your instructor', ic: 'fa-hourglass-half', list: vm.wait }); }
        if ((f === 'all' || f === 'done') && vm.done.length) { groups.push({ k: 'done', label: 'Done', ic: 'fa-check', list: vm.done }); }
        vm.groups = groups;
    }
    function go(r) {
        X.markViewed(r);
        if (r.item === 'material') { $state.go('dashboard.my_account.material_view', { material_id: r.id }); return; }
        if (r.attempt && r.attempt.id && r.group !== 'to_do') { $state.go('dashboard.my_account.questionnaire_result', { attempt_id: r.attempt.id }); return; }
        $state.go('dashboard.my_account.questionnaire_take', { questionnaire_id: r.qid, attach_type: r.attach_type, attach_id: r.attach_id, timing: r.timing, sitting: r.sitting });
    }
}

/* ═════ PAGE: take a questionnaire (one question per screen, soft timer, check your answers, submit) ═════ */
app.controller('QxTakeV2Controller', QxTakeV2Controller);
QxTakeV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$interval', '$document', '$window', 'QuestionnaireService', 'CourseService', 'CourseAssignmentService', 'ToastService', 'QxV2Data'];
function QxTakeV2Controller($rootScope, $scope, $state, $stateParams, $interval, $document, $window, QuestionnaireService, CourseService, CourseAssignmentService, ToastService, QxV2Data) {
    var vm = this, X = QxV2Data;
    vm.X = X;
    vm.qid = $stateParams.questionnaire_id;
    vm.loading = true; vm.error = '';
    vm.step = 'intro';           // intro | q | review | done
    vm.idx = 0;
    vm.answers = {};             // question_id -> { selected: [], text: '' }
    vm.miss = false;             // a submit was tried with required questions left
    vm.elapsed = 0;              // seconds, the attempt's saved time + this visit
    vm.savedAt = null;
    vm.dlg = null;
    vm.submitting = false;
    var unsaved = 0, dirty = false, timer = null;

    var ctx = {};
    if ($stateParams.attach_type) { ctx.attach_type = $stateParams.attach_type; }
    if ($stateParams.attach_id) { ctx.attach_id = $stateParams.attach_id; }
    if ($stateParams.timing) { ctx.timing = $stateParams.timing; }
    if ($stateParams.sitting) { ctx.course_sitting_id = $stateParams.sitting; }

    // the assignment that set this questionnaire, if any: its note, due date and retake flag for the intro
    CourseAssignmentService.Mine().then(function (d) {
        var items = ((d && d.items) || []).filter(function (x) { return x.item_type === 'questionnaire' && +x.item_id === +vm.qid && x.status !== 'revoked'; })
            .sort(function (x, y) { return ((x.status === 'completed') - (y.status === 'completed')) || ((+y.id || 0) - (+x.id || 0)); });
        var a = items[0];
        if (a) { vm.asg = { message: X.trim(a.message), setAt: a.assigned_at || a.created_at, due: a.due_date || null, retake: +a.is_retake === 1 && a.status !== 'completed' }; }
    });

    QuestionnaireService.Open(vm.qid, ctx).then(function (data) {
        vm.loading = false;
        if (!data || data.success === false) {
            vm.error = X.msg(data) || 'This questionnaire couldn’t be opened.';
            if (ToastService.handledInline) { ToastService.handledInline(); }   // the page says it: no generic "Not saved" toast on top
            return;
        }
        vm.attempt = data.attempt || {};
        vm.q = data.questionnaire || {};
        vm.questions = vm.q.questions || [];
        vm.limit = (+vm.q.time_limit_minutes || 0) * 60;
        vm.elapsed = +vm.attempt.time_spent_seconds || 0;
        vm.mcN = vm.questions.filter(isMC).length; vm.ftN = vm.questions.length - vm.mcN;
        vm.retake = +vm.attempt.attempt_number > 1;
        var saved = 0;
        (data.answers || []).forEach(function (a) {
            var sel = angular.isArray(a.selected_option_ids) ? a.selected_option_ids : (a.selected_option_ids ? String(a.selected_option_ids).split(',') : []);
            vm.answers[a.question_id] = { selected: sel.map(Number), text: a.free_text_answer || '' };
            saved++;
        });
        vm.questions.forEach(function (qq) {
            if (!vm.answers[qq.id]) { vm.answers[qq.id] = { selected: [], text: '' }; }
            if (qq.image_file_id) { CourseService.GetLessonContentFileData(qq.image_file_id).then(function (d) { if (d && d.data_uri) { qq._img = d.data_uri; } }); }
        });
        remember();
        // a saved attempt picks up where it was: the first unanswered question
        if (saved && (vm.attempt.status === 'in_progress' || vm.attempt.status === 'opened')) {
            vm.step = 'q';
            var i = -1; vm.questions.some(function (qq, k) { if (!answered(qq)) { i = k; return true; } return false; });
            vm.idx = i < 0 ? 0 : i;
            vm.savedAt = 'earlier';
            startTimer();
        }
        if (vm.attempt.status === 'submitted' || vm.attempt.status === 'reviewed') { vm.alreadyIn = true; }
    });

    // the option labels, kept for this browser session so "See your answers" can show them (students can't read the definition)
    function remember() {
        try {
            var defs = vm.questions.map(function (qq) { return { id: qq.id, type: qq.type, prompt: qq.prompt, points: qq.points, required: qq.required, multi_select: qq.multi_select, options: (qq.options || []).map(function (o) { return { id: o.id, label: o.label }; }) }; });
            sessionStorage.setItem('toaviate_v2_qx_def_' + vm.qid, JSON.stringify({ title: vm.q.title, instant: +vm.q.instant_mc_score === 1, questions: defs }));
        } catch (e) {}
    }

    function isMC(qq) { return qq.type === 'multiple_choice'; }
    function answered(qq) { var a = vm.answers[qq.id] || {}; return isMC(qq) ? !!(a.selected && a.selected.length) : !!(a.text && String(a.text).trim()); }
    vm.isMC = isMC; vm.answered = answered;
    vm.answeredN = function () { return (vm.questions || []).filter(answered).length; };
    vm.missing = function () { return (vm.questions || []).map(function (qq, i) { return { q: qq, i: i }; }).filter(function (x) { return +x.q.required === 1 && !answered(x.q); }); };
    vm.missingText = function () { return vm.missing().map(function (x) { return 'question ' + (x.i + 1); }).join(', '); };
    vm.optBlank = function () { return (vm.questions || []).filter(function (qq) { return +qq.required !== 1 && !answered(qq); }).length; };
    vm.ftAnswered = function () { return (vm.questions || []).filter(function (qq) { return !isMC(qq) && answered(qq); }).length; };
    vm.cur = function () { return vm.questions ? vm.questions[vm.idx] : null; };
    vm.isChosen = function (qq, o) { var a = vm.answers[qq.id]; return !!a && a.selected.indexOf(+o.id) > -1; };
    vm.pick = function (qq, o) {
        var a = vm.answers[qq.id], id = +o.id;
        if (+qq.multi_select === 1) { var i = a.selected.indexOf(id); if (i > -1) { a.selected.splice(i, 1); } else { a.selected.push(id); } }
        else { a.selected = [id]; }
        dirty = true;
    };
    vm.typed = function () { dirty = true; };
    vm.summary = function (qq) {
        var a = vm.answers[qq.id] || {};
        if (!answered(qq)) { return +qq.required === 1 ? 'Not answered yet' : 'Not answered · optional'; }
        if (isMC(qq)) { return (qq.options || []).map(function (o, j) { return a.selected.indexOf(+o.id) > -1 ? X.LET[j] + ' — ' + o.label : null; }).filter(Boolean).join(' · '); }
        return '“' + X.trunc(a.text, 110) + '”';
    };
    vm.navClass = function (qq, i) {
        return { 'qx-nav__b--done': answered(qq), 'qx-nav__b--miss': !answered(qq) && vm.miss && +qq.required === 1, 'qx-nav__b--now': i === vm.idx && vm.step === 'q' };
    };
    vm.left = function () { return vm.limit - vm.elapsed; };
    vm.timerTone = function () { var l = vm.left(); return l < 0 ? 'over' : (l <= 120 ? 'warn' : 'ok'); };

    vm.begin = function () { vm.step = 'q'; vm.idx = 0; startTimer(); };
    vm.jump = function (i) { vm.idx = i; vm.step = 'q'; scrollTop(); };
    vm.prev = function () { if (vm.idx > 0) { vm.idx--; scrollTop(); } };
    vm.next = function () { if (vm.idx < vm.questions.length - 1) { vm.idx++; scrollTop(); } };
    vm.review = function () { vm.step = 'review'; scrollTop(); };
    vm.backToQ = function () { vm.step = 'q'; scrollTop(); };
    vm.askSubmit = function () {
        if (vm.missing().length) { vm.miss = true; vm.step = 'review'; ToastService.warning('Almost there', X.plural(vm.missing().length, 'required question') + ' still to answer.'); scrollTop(); return; }
        vm.dlg = 'submit';
    };
    vm.closeDlg = function () { if (!vm.submitting) { vm.dlg = null; } };
    vm.submit = submit;
    vm.saveAndLeave = function () {
        save(true).then(function (d) {
            if (d && d.success === false) { ToastService.error('Not saved', 'Your answers are still here. Check your connection and try again.'); return; }
            ToastService.success('Saved', 'Your progress is saved — come back to it any time.'); $state.go('dashboard.my_account.questionnaires');
        });
    };
    vm.toResult = function () { $state.go('dashboard.my_account.questionnaire_result', { attempt_id: vm.attempt.id }); };
    vm.toHub = function () { $state.go('dashboard.my_account.questionnaires'); };

    function scrollTop() { try { $window.scrollTo(0, 0); } catch (e) {} }
    function payload() {
        return vm.questions.map(function (qq) {
            var a = vm.answers[qq.id] || {};
            return isMC(qq) ? { question_id: qq.id, selected_option_ids: a.selected || [] } : { question_id: qq.id, free_text_answer: a.text || '' };
        });
    }
    function startTimer() {
        if (timer) { return; }
        timer = $interval(function () {
            if (vm.step !== 'q' && vm.step !== 'review') { return; }
            vm.elapsed++; unsaved++;
            if (unsaved >= 30) { save(false); }          // saves as you go: about every 30 seconds (v1's rhythm)
        }, 1000);
    }
    function save(force) {
        if (!vm.attempt || !vm.attempt.id || vm.step === 'done') { return { then: function (f) { f(); } }; }
        if (!force && !dirty && unsaved < 30) { return { then: function (f) { f(); } }; }
        var add = unsaved; unsaved = 0; dirty = false;
        return QuestionnaireService.SaveAttempt(vm.attempt.id, { answers: payload(), add_seconds: add }).then(function (d) {
            if (d && d.success !== false) { vm.savedAt = new Date().toTimeString().slice(0, 5); vm.saveFailed = false; }
            else { vm.saveFailed = true; unsaved += add; dirty = true; }   // keep the time + changes for the next try (every 30 s, or Save and leave)
            return d;
        });
    }
    function submit() {
        vm.submitting = true;
        if (timer) { $interval.cancel(timer); timer = null; }
        QuestionnaireService.Submit(vm.attempt.id, { answers: payload(), add_seconds: unsaved }).then(function (data) {
            vm.submitting = false;
            if (!data || !data.success) {
                ToastService.error('Not submitted', X.msg(data) || 'Something went wrong — your answers are still here. Try again.');
                startTimer(); return;
            }
            unsaved = 0; dirty = false;
            vm.attempt = data.attempt || vm.attempt;
            vm.dlg = null; vm.step = 'done';
            vm.instant = vm.attempt && +vm.attempt.score_released === 1 && vm.attempt.max_score != null && +vm.attempt.max_score > 0
                ? { auto: X.num(vm.attempt.auto_score), max: X.num(vm.attempt.max_score) } : null;
            ToastService.success('Submitted', vm.instant ? ('Scored ' + vm.instant.auto + ' / ' + vm.instant.max) : 'Your instructor will review it with you.');
            scrollTop();
        });
    }
    function onKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && vm.dlg) { $scope.$apply(function () { vm.closeDlg(); }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        $document.off('keydown', onKey);
        if (timer) { $interval.cancel(timer); timer = null; }
        if (vm.attempt && vm.attempt.id && vm.step !== 'done' && vm.step !== 'intro' && (dirty || unsaved > 0)) {
            QuestionnaireService.SaveAttempt(vm.attempt.id, { answers: payload(), add_seconds: unsaved });
        }
    });
}

/* ═════ PAGE: the result of an attempt ═════ */
app.controller('QxResultV2Controller', QxResultV2Controller);
QxResultV2Controller.$inject = ['$rootScope', '$state', '$stateParams', '$timeout', 'QuestionnaireService', 'QxV2Data'];
function QxResultV2Controller($rootScope, $state, $stateParams, $timeout, QuestionnaireService, QxV2Data) {
    var vm = this, X = QxV2Data;
    vm.X = X;
    vm.loading = true; vm.error = '';
    vm.rf = 'all';
    vm.setFilter = function (f) { vm.rf = f; };
    vm.toQ = function (i) { $timeout(function () { var el = document.getElementById('qx-rq-' + i); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, 0); };
    vm.back = function () {
        if ($rootScope.cameFrom && $rootScope.cameFrom('dashboard.v2.training_records')) { $rootScope.safeBack(); return; }
        $state.go('dashboard.my_account.questionnaires');
    };

    QuestionnaireService.GetAttempt($stateParams.attempt_id).then(function (data) {
        if (!data || data.success === false) { vm.loading = false; vm.error = X.msg(data) || 'This result couldn’t be loaded.'; return; }
        vm.attempt = data.attempt || data;
        vm.answers = data.answers || [];
        vm.released = +vm.attempt.score_released === 1 || vm.attempt.status === 'reviewed';
        vm.reviewed = vm.attempt.status === 'reviewed';
        var qid = vm.attempt.questionnaire_id, cached = null;
        try { cached = JSON.parse(sessionStorage.getItem('toaviate_v2_qx_def_' + qid) || 'null'); } catch (e) {}
        vm.title = data.questionnaire_title || vm.attempt.questionnaire_title || (cached && cached.title) || 'Questionnaire';
        // every multiple-choice answer carries its options (labels always; the key once released when the
        // questionnaire lets students see the correct answers — C17). Older APIs sent no labels: then the
        // definition (instructors) or this browser's copy from taking it.
        var labelled = vm.answers.every(function (a) { return a.type !== 'multiple_choice' || angular.isArray(a.options); });
        if (labelled) {
            build(cached ? cached.questions : []);
            vm.loading = false;
            return;
        }
        QuestionnaireService.Get(qid).then(function (def) {
            var item = def && def.success !== false && def.item;
            if (item && item.title) { vm.title = item.title; }
            build(item ? item.questions : (cached ? cached.questions : []));
            vm.loading = false;
        }, function () { build(cached ? cached.questions : []); vm.loading = false; });
    });

    function build(defs) {
        var byId = {}; (defs || []).forEach(function (q) { byId[q.id] = q; });
        vm.rows = vm.answers.map(function (a, i) {
            var def = byId[a.question_id] || {}, type = a.type || def.type, mc = type === 'multiple_choice';
            var sel = (angular.isArray(a.selected_option_ids) ? a.selected_option_ids : (a.selected_option_ids ? String(a.selected_option_ids).split(',') : [])).map(String);
            var list = angular.isArray(a.options) ? a.options : (def.options || []);
            var corr = angular.isArray(a.correct_option_ids) ? a.correct_option_ids.map(String) : null;
            var isKey = function (o) { return corr ? corr.indexOf(String(o.id)) > -1 : +o.is_correct === 1; };
            var keyKnown = corr ? corr.length > 0 : list.some(function (o) { return +o.is_correct === 1; });
            var right = a.is_correct === 1 || a.is_correct === '1' || a.is_correct === true;
            var opts = list.map(function (o, j) {
                var ch = sel.indexOf(String(o.id)) > -1, cls = '', ic = 'far fa-circle', tg = '';
                if (vm.released && keyKnown) { if (isKey(o)) { cls = 'qx-ro--right'; ic = 'fas fa-check-circle'; tg = ch ? 'Your answer · right' : 'Right answer'; } else if (ch) { cls = 'qx-ro--wrong'; ic = 'fas fa-times-circle'; tg = 'Your answer'; } }
                else if (ch) { cls = (vm.released ? (right ? 'qx-ro--right' : 'qx-ro--wrong') : 'qx-ro--mine'); ic = vm.released ? (right ? 'fas fa-check-circle' : 'fas fa-times-circle') : 'fas fa-dot-circle'; tg = vm.released && right ? 'Your answer · right' : 'Your answer'; }
                if (o.retired) { tg = (tg ? tg + ' · ' : '') + 'option since changed'; }   // a pick the instructor has replaced since
                return { label: X.LET[j] + ' — ' + o.label, cls: cls, ic: ic, tg: tg };
            });
            var points = +def.points || +a.points || +a.awarded_points || 0;   // a.points: the question's max (on the attempt since C17)
            var r = { i: i, prompt: a.prompt || def.prompt, mc: mc, sel: sel, answered: sel.length > 0 || !!X.trim(a.free_text_answer), text: a.free_text_answer || '',
                right: right, opts: opts, keyKnown: keyKnown, comment: vm.released ? X.trim(a.instructor_comment) : '', required: def.required != null ? +def.required === 1 : (a.required == null ? true : (a.required === true || +a.required === 1)) };
            if (mc && vm.released) { r.kind = right ? 'good' : 'bad'; r.pill = right ? { tone: 'good', label: 'Right' + (points ? ' · ' + (a.awarded_points != null ? X.num(a.awarded_points) : points) + ' of ' + points : ''), ic: 'fa-check' } : { tone: 'bad', label: 'Wrong' + (points ? ' · 0 of ' + points : ''), ic: 'fa-times' }; }
            else if (mc) { r.kind = ''; r.pill = { tone: 'muted', label: 'Not marked yet', ic: '' }; }
            else if (vm.reviewed || r.comment) { r.kind = 'info'; r.pill = { tone: 'info', label: 'Written · reviewed', ic: 'fa-comment-dots' }; }
            else { r.kind = 'pend'; r.pill = { tone: 'pend', label: 'Awaiting review', ic: 'fa-hourglass-half' }; }
            return r;
        });
        var mcRows = vm.rows.filter(function (r) { return r.mc; });
        var pts = (defs && defs.length ? defs.filter(function (q) { return q.type === 'multiple_choice'; }).map(function (q) { return +q.points || 0; })
            : vm.answers.filter(function (a) { return a.type === 'multiple_choice'; }).map(function (a) { return +a.points || 0; }));
        vm.marksEach = pts.length && pts[0] > 0 && pts.every(function (x) { return x === pts[0]; }) ? pts[0] : 0;   // "2 marks each" when every MC question scores the same
        vm.ftAnswered = vm.rows.filter(function (r) { return !r.mc && r.answered; }).length;
        vm.mcN = mcRows.length; vm.mcRight = mcRows.filter(function (r) { return r.right; }).length;
        vm.ftN = vm.rows.length - vm.mcN;
        vm.hasScore = vm.released && vm.attempt.max_score != null && X.num(vm.attempt.max_score) > 0;
        vm.pctScore = vm.hasScore ? X.pct(vm.attempt.auto_score, vm.attempt.max_score) : null;
        vm.wrongN = vm.released ? mcRows.filter(function (r) { return !r.right; }).length : 0;
        // the club hides the key (show_correct_answers off): say why wrong answers don't show the right one
        vm.keyHidden = vm.wrongN > 0 && !mcRows.some(function (r) { return r.keyKnown; });
        vm.chips = [{ k: 'all', label: 'All', n: vm.rows.length }, { k: 'wrong', label: 'Wrong', n: vm.wrongN, attn: true }, { k: 'written', label: 'Written', n: vm.ftN }].filter(function (c) { return c.k === 'all' || c.n; });
        var kinds = {}; vm.rows.forEach(function (r) { kinds[r.kind] = 1; });
        vm.legend = [['good', 'Right'], ['bad', 'Wrong'], ['', 'Not marked yet'], ['info', 'Written · reviewed'], ['pend', 'Awaiting review']].filter(function (l) { return kinds[l[0]]; });
        vm.sub = vm.reviewed ? ('Reviewed' + (vm.attempt.reviewed_at ? ' · ' + X.fDay(vm.attempt.reviewed_at) : '')) : (vm.released ? 'Score in · your instructor still reviews your written answers' : 'Waiting for your instructor to review it');
    }
    vm.show = function (r) { return vm.rf === 'all' || (vm.rf === 'wrong' && r.mc && vm.released && !r.right) || (vm.rf === 'written' && !r.mc); };
}

/* ═════ PAGE: lesson material (PDF or video), engagement tracked as in v1 ═════ */
app.controller('QxMaterialV2Controller', QxMaterialV2Controller);
QxMaterialV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$interval', '$timeout', '$sce', 'CourseMaterialService', 'CourseAssignmentService', 'QuestionnaireService', 'ToastService', 'QxV2Data'];
function QxMaterialV2Controller($rootScope, $scope, $state, $stateParams, $interval, $timeout, $sce, CourseMaterialService, CourseAssignmentService, QuestionnaireService, ToastService, QxV2Data) {
    var vm = this, X = QxV2Data;
    vm.X = X;
    vm.id = $stateParams.material_id;
    vm.loading = true; vm.error = '';
    vm.kind = null; vm.processing = false; vm.failed = false;
    vm.access = null; vm.others = [];
    vm.done = false;
    var beat = null, seconds = 0, revoke = null, blobUrl = null;

    CourseMaterialService.Get(vm.id).then(function (meta) {
        var m = (meta && meta.item) ? meta.item : meta;
        if (!m || (meta && meta.success === false)) { vm.loading = false; vm.error = X.msg(meta) || 'This material couldn’t be opened.'; return; }
        vm.m = m;
        if (m.my_access) { vm.access = m.my_access; vm.done = +m.my_access.completed === 1; }   // C21: my progress on the material itself
        vm.kind = m.file_type === 'video' ? 'video' : 'pdf';
        vm.paras = String(m.description || '').split(/\n\s*\n/).map(X.trim).filter(Boolean);
        vm.eyebrow = vm.kind === 'video' ? 'Video' + (+m.duration_seconds ? ' · ' + X.mmss(m.duration_seconds) : '')
            : 'PDF' + (+m.pdf_pages ? ' · ' + X.plural(+m.pdf_pages, 'page') : '') + (+m.file_size ? ' · ' + sizeText(+m.file_size) : '');
        if (vm.kind === 'video') { loadVideo(m); } else { loadPdf(); }
        // my progress + the rest of the same lesson / course come from the target's list (it carries my_access);
        // the target's published questionnaires join the "Also for this lesson" list
        if (m.attach_type && m.attach_id) {
            CourseMaterialService.ListForTarget(m.attach_type, m.attach_id).then(function (d) {
                var items = (d && d.items) || [];
                items.forEach(function (x) { if (+x.id === +vm.id) { vm.access = x.my_access || null; vm.done = vm.done || !!(x.my_access && +x.my_access.completed === 1); } });
                vm.others = items.filter(function (x) { return +x.id !== +vm.id; }).map(function (x) {
                    var vid = x.file_type === 'video';
                    return { m: x, title: x.title, ic: vid ? 'fa-film' : 'fa-file-pdf', sub: (vid ? 'Video' + (+x.duration_seconds ? ' · ' + X.mmss(x.duration_seconds) : '') : 'PDF' + (+x.pdf_pages ? ' · ' + X.plural(+x.pdf_pages, 'page') : '')) + (x.my_access && +x.my_access.completed === 1 ? ' · done' : '') };
                }).concat(vm.others.filter(function (o) { return o.q; }));
            });
            QuestionnaireService.GetForTarget(m.attach_type, m.attach_id).then(function (d) {
                var qs = ((d && d.items) || []).filter(function (q) { return +q.is_published === 1 || q.is_published === true || q.is_published == null; }).map(function (q) {
                    return { q: q, title: q.title, ic: 'fa-clipboard-check', sub: 'Questionnaire' + (+q.question_count ? ' · ' + X.plural(+q.question_count, 'question') : '') };
                });
                vm.others = vm.others.filter(function (o) { return !o.q; }).concat(qs);
            });
        }
        // the assignment that shared it (its due date)
        CourseAssignmentService.Mine().then(function (d) {
            var a = ((d && d.items) || []).filter(function (x) { return x.item_type === 'material' && +x.item_id === +vm.id && x.status !== 'revoked'; })[0];
            if (a) { vm.due = a.due_date || null; }
        });
    });
    function sizeText(b) { return b >= 1048576 ? (Math.round(b / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

    function loadPdf() {
        CourseMaterialService.GetFile(vm.id).then(function (data) {
            vm.loading = false;
            if (!data || data.success === false || !data.data_uri) { vm.error = X.msg(data) || 'The PDF couldn’t be loaded.'; return; }
            vm.m = angular.extend(vm.m || {}, data);
            blobUrl = toBlobUrl(data.data_uri);
            vm.pdfUrl = $sce.trustAsResourceUrl(blobUrl || data.data_uri);
            vm.rawUrl = blobUrl || data.data_uri;
            heartbeat();
        });
    }
    function loadVideo(meta) {
        if (meta.processing_status && meta.processing_status !== 'ready') {
            vm.loading = false;
            vm.failed = meta.processing_status === 'failed';
            vm.processing = !vm.failed;
            if (vm.failed) { return; }
            $timeout(function () {
                CourseMaterialService.GetStatus(vm.id).then(function (st) { meta.processing_status = (st && st.processing_status) || meta.processing_status; loadVideo(meta); });
            }, 5000);
            return;
        }
        CourseMaterialService.GetVideoObjectUrl(vm.id).then(function (res) {
            vm.loading = false; vm.processing = false;
            if (!res || !res.success) { vm.error = (res && res.message) || 'The video couldn’t be loaded.'; return; }
            vm.videoUrl = $sce.trustAsResourceUrl(res.url);
            revoke = res.revoke;
            heartbeat();
        });
    }
    function toBlobUrl(uri) {
        try {
            var p = String(uri).split(','), mime = (/data:([^;]+)/.exec(p[0]) || [])[1] || 'application/pdf', bin = atob(p[1]), arr = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { arr[i] = bin.charCodeAt(i); }
            return URL.createObjectURL(new Blob([arr], { type: mime }));
        } catch (e) { return null; }
    }
    function heartbeat() {   // engagement time, every 15 s (v1)
        beat = $interval(function () { seconds += 15; CourseMaterialService.Track(vm.id, { add_seconds: 15 }); }, 15000);
    }
    vm.fullScreen = function () { if (vm.rawUrl) { window.open(vm.rawUrl, '_blank'); } };
    vm.markDone = function () {
        vm.marking = true;
        CourseMaterialService.Track(vm.id, { add_seconds: seconds % 15, completed: true }).then(function (d) {
            vm.marking = false;
            if (d && d.success === false) { ToastService.error('Not marked', X.msg(d) || 'Try again in a moment.'); return; }
            vm.done = true;
            ToastService.success('Marked as done', 'Your instructor can see you’ve ' + (vm.kind === 'video' ? 'watched' : 'read') + ' it.');
        });
    };
    vm.open = function (o) {
        if (o.q) { $state.go('dashboard.my_account.questionnaire_take', { questionnaire_id: o.q.questionnaire_id || o.q.id, attach_type: vm.m.attach_type, attach_id: vm.m.attach_id, timing: o.q.timing || 'pre' }); return; }
        $state.go('dashboard.my_account.material_view', { material_id: o.m.id });
    };
    vm.back = function () {
        if ($rootScope.cameFrom && ($rootScope.cameFrom('dashboard.v2.syllabus_view_lesson') || $rootScope.cameFrom('dashboard.v2.syllabus_view_course'))) { $rootScope.safeBack(); return; }
        $state.go('dashboard.my_account.questionnaires');
    };
    $scope.$on('$destroy', function () {
        if (beat) { $interval.cancel(beat); }
        if (revoke) { revoke(); }
        if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }
    });
}

/* ═════ PAGE: theory exams ═════ */
app.controller('QxExamsV2Controller', QxExamsV2Controller);
QxExamsV2Controller.$inject = ['$rootScope', '$scope', '$q', '$sce', '$document', 'ExamSalesService', 'CourseService', 'ToastService', 'QxV2Data'];
function QxExamsV2Controller($rootScope, $scope, $q, $sce, $document, ExamSalesService, CourseService, ToastService, QxV2Data) {
    var vm = this, X = QxV2Data;
    vm.X = X;
    vm.user = $rootScope.globals.currentUser;
    vm.hub = { cur: 'exams', title: 'Theory exams', hint: 'Your ground exams: results, re-sits and certificates', icon: 'fa-award', todo: 0, sign: 0, tools: 'views/v2/exams/_club_scope.html' };
    X.hubCounts(vm.hub);
    vm.loading = true; vm.error = '';
    vm.clubs = []; vm.club = null; vm.courses = []; vm.open = null;
    vm.cert = null;
    vm.selectClub = selectClub;
    vm.toggle = function (x) { vm.open = vm.open === x.id ? null : x.id; if (vm.open) { loadFiles(x); } };
    vm.viewCert = viewCert;
    vm.closeCert = function () { vm.cert = null; };
    vm.downloadCert = downloadCert;
    vm.reload = function () { if (vm.club) { selectClub(vm.club, true); } };

    function onKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && vm.cert) { $scope.$apply(function () { vm.cert = null; }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    ExamSalesService.GetUserClubs(vm.user.id).then(function (data) {
        if (!data || data.success !== true || !angular.isArray(data.items)) { vm.loading = false; vm.error = 'Your exams couldn’t be loaded just now. Try again in a moment.'; return; }
        vm.clubs = data.items.map(function (c) { return { id: c.id, title: X.trim(c.title), sym: c.currency_symbol || '£', member: +c.member === 1, exams: +c.exams || 0 }; });
        if (!vm.clubs.length) { vm.loading = false; return; }
        var withExams = vm.clubs.filter(function (c) { return c.exams > 0; });
        selectClub(withExams.length ? withExams[0] : vm.clubs[0]);
    });

    function selectClub(club, force) {
        if (!force && vm.club === club && vm.courses.length) { return; }
        vm.club = club; vm.loading = true; vm.error = ''; vm.courses = []; vm.open = null;
        ExamSalesService.GetByUser(club.id, vm.user.id).then(function (data) {
            if (vm.club !== club) { return; }
            if (!data || data.success === false) { vm.loading = false; vm.error = 'Your exams couldn’t be loaded just now. Try again in a moment.'; return; }
            var purchases = ((data.purchases || data.items) || []).slice(), byCourse = {}, order = [];
            // C21: results an instructor entered with no purchase behind them — shown as sittings, without price / invoice
            (data.records || []).forEach(function (r) {
                purchases.push({ id: 'r' + r.id, _record: true, exam_id: r.exam_id, exam_title: r.exam_title, course_id: r.course_id, course_title: r.course_title,
                    course_short_title: r.course_short_title, pass_mark_percent: r.pass_mark_percent, status: 'result_entered', exam_record_id: r.id,
                    record_result: r.result, record_pass_fail: r.pass_fail, record_date: r.date, created_at: r.date, price: null, invoice_status: null, sitting: r.sitting, examiner: r.examiner });
            });
            purchases.forEach(function (p) {
                var k = +p.course_id || 0;
                if (!byCourse[k]) { byCourse[k] = { id: k, title: X.trim(p.course_title) || 'Theory exams', short: X.trim(p.course_short_title), ps: [] }; order.push(k); }
                byCourse[k].ps.push(p);
            });
            $q.all(order.map(function (k) { return k ? CourseService.GetExamsByCourseId(k) : $q.when(null); })).then(function (res) {
                vm.loading = false;
                vm.courses = order.map(function (k, i) { return course(byCourse[k], (res[i] && res[i].items) || []); });
            });
        });
    }
    function course(c, exams) {
        var known = {}; exams.forEach(function (e) { known[+e.id] = true; });
        c.ps.forEach(function (p) { p._inv = X.invPill(p.invoice_status); });   // once: a fresh object per digest would never settle
        c.ps.forEach(function (p) { if (!known[+p.exam_id]) { known[+p.exam_id] = true; exams.push({ id: p.exam_id, title: p.exam_title }); } });
        var subs = exams.map(function (e) { return X.subject(e, c.ps); });
        var n = subs.length, pass = subs.filter(function (x) { return x.state === 'pass'; }), wait = subs.filter(function (x) { return x.state === 'wait'; }),
            fail = subs.filter(function (x) { return x.state === 'fail'; }), none = subs.filter(function (x) { return x.state === 'none' || x.state === 'cancelled'; });
        var firstSat = c.ps.filter(function (p) { return p.record_date; }).map(function (p) { return String(p.record_date).slice(0, 10); }).sort()[0], win = null;
        if (firstSat) { var d0 = X.pd(firstSat), end = new Date(d0.getFullYear(), d0.getMonth() + 19, 0); win = X.ymd(end); }
        var lastPass = pass.slice().sort(function (a, b) { return String(a.pass.record_date) < String(b.pass.record_date) ? 1 : -1; })[0];
        var attn = subs.filter(function (x) { return x.unpaid; });
        // C20: the course's short name for the card title; the pass mark when every exam on it shares one
        var marks = {}; c.ps.forEach(function (p) { if (p.pass_mark_percent != null && p.pass_mark_percent !== '') { marks[+p.pass_mark_percent] = 1; } });
        var markList = Object.keys(marks);
        return { id: c.id, title: c.title, short: c.short || c.title, passMark: markList.length === 1 ? +markList[0] : null, subs: subs, attn: attn, rest: subs.filter(function (x) { return !x.unpaid; }), n: n, nPass: pass.length, nWait: wait.length, nFail: fail.length, nNone: none.length,
            waitTitles: wait.map(function (x) { return x.title; }).join(', '), failTitles: fail.map(function (x) { return x.title; }).join(', '), noneTitles: none.map(function (x) { return x.title; }).join(', '),
            lastPass: lastPass, finishBy: win, firstSat: firstSat, owed: attn.reduce(function (s, x) { return s + X.num(x.unpaid.price); }, 0) };
    }
    function loadFiles(x) {
        if (x._filesLoaded) { return; }
        x._filesLoaded = true;
        x.ps.filter(function (p) { return p.exam_record_id; }).forEach(function (p) {
            ExamSalesService.GetFilesForRecord(p.exam_record_id).then(function (d) {
                var files = (d && (d.files || d.items)) || (angular.isArray(d) ? d : []);
                files.forEach(function (f) { f._p = p; x.files.push(f); });
            });
        });
    }
    function viewCert(f, x) {
        vm.cert = { f: f, x: x, loading: true, error: false };
        ExamSalesService.GetFile(f.id).then(function (d) {
            if (!vm.cert || vm.cert.f !== f) { return; }
            vm.cert.loading = false;
            if (!d || d.success === false || !d.data_uri) { vm.cert.error = true; return; }
            vm.cert.uri = d.data_uri;
            vm.cert.pdf = f.file_type === 'pdf' || /^data:application\/pdf/.test(d.data_uri);
            if (vm.cert.pdf) { vm.cert.blob = toBlob(d.data_uri); vm.cert.src = vm.cert.blob ? $sce.trustAsResourceUrl(URL.createObjectURL(vm.cert.blob)) : null; }
        });
    }
    function toBlob(uri) {
        try {
            var p = String(uri).split(','), mime = (/data:([^;]+)/.exec(p[0]) || [])[1] || 'application/octet-stream', bin = atob(p[1]), arr = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { arr[i] = bin.charCodeAt(i); }
            return new Blob([arr], { type: mime });
        } catch (e) { return null; }
    }
    function downloadCert() {
        if (!vm.cert || !vm.cert.uri) { return; }
        var b = vm.cert.blob || toBlob(vm.cert.uri); if (!b) { ToastService.error('Download failed', 'Try again in a moment.'); return; }
        var url = URL.createObjectURL(b), a = document.createElement('a');
        a.href = url; a.download = vm.cert.f.original_name || 'certificate';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }
}

/* ═════ PAGE: CAA forms (forms waiting for my signature + every form about me) ═════ */
app.controller('QxCaaV2Controller', QxCaaV2Controller);
QxCaaV2Controller.$inject = ['$rootScope', '$q', '$state', 'CaaFormsService', 'ToastService', 'QxV2Data'];
function QxCaaV2Controller($rootScope, $q, $state, CaaFormsService, ToastService, QxV2Data) {
    var vm = this, X = QxV2Data;
    vm.X = X;
    vm.user = $rootScope.globals.currentUser;
    vm.me = +vm.user.id;
    vm.hub = { cur: 'caa', title: 'CAA forms', hint: 'Paperwork to sign, and your completed forms to download', icon: 'fa-file-contract', todo: 0, sign: 0 };
    X.hubCounts(vm.hub);
    vm.loading = true; vm.error = '';
    vm.sign = []; vm.rest = []; vm.pastClubs = []; vm.open = null;
    vm.toggle = function (f) { vm.open = vm.open === f.key ? null : f.key; };
    vm.openForm = function (f) { $state.go('dashboard.caa_form', { id: f.id }); };
    vm.pdf = pdf;
    vm.reload = load;
    load();

    function load() {
        vm.loading = true; vm.error = '';
        CaaFormsService.Mine().then(function (data) {
            if (!data || data.success === false) { vm.loading = false; vm.error = X.msg(data) || 'Your CAA forms couldn’t be loaded. Try again in a moment.'; return; }
            var clubs = data.clubs || [], forms = (data.forms || []).map(decorate);
            vm.pastClubs = clubs.filter(function (c) { return +c.member !== 1; });
            var live = clubs.filter(function (c) { return +c.member === 1; });
            $q.all(live.map(function (c) {
                return CaaFormsService.Queue(c.club_id).then(function (res) {
                    var rows = (res && res.success === false) ? [] : ((res && (res.queue || res.items)) || (angular.isArray(res) ? res : []));
                    rows.forEach(function (r) { r.club_title = r.club_title || c.title; });
                    return rows;
                });
            })).then(function (per) {
                vm.loading = false;
                var queue = [].concat.apply([], per), byId = {};
                forms.forEach(function (f) { byId[f.id] = f; });
                var sign = [];
                queue.forEach(function (q) {
                    var f = byId[q.id] || decorate(angular.extend({ signatures: [] }, q));
                    f.need = true; f.role = q.role; f.st = X.caaStatus(f, true);
                    if (!byId[q.id]) { byId[q.id] = f; }
                    if (sign.indexOf(f) < 0) { sign.push(f); }
                });
                forms.forEach(function (f) {   // a form about me with my applicant signature pending also needs me
                    if (sign.indexOf(f) > -1) { return; }
                    var mine = (f.signatures || []).filter(function (s) { return s.role === 'applicant' && s.status === 'pending' && (+s.signer_user_id === vm.me || s.signer_user_id == null); })[0];
                    if (mine && f.status === 'awaiting_signatures' && !f.read_only) { f.need = true; f.role = 'applicant'; f.st = X.caaStatus(f, true); sign.push(f); }
                });
                vm.sign = sign;
                vm.rest = forms.filter(function (f) { return sign.indexOf(f) < 0; });
                vm.hub.sign = sign.length;
            });
        });
    }
    function decorate(f) {
        f.key = 'f' + f.id;
        f.docs = (f.document_labels || []).filter(function (x) { return X.trim(x); }).join(', ');   // C21: the form's documents
        f.titleText = X.caaTitle(f) + (f.docs && f.form_type === 'certified_true_copy' ? ' — ' + f.docs : '');
        f.st = X.caaStatus(f, false);
        f.steps = X.caaSteps(f);
        f.declined = (f.signatures || []).filter(function (s) { return s.status === 'declined'; })[0] || null;
        return f;
    }
    function pdf(f) {
        if (f._pdf) { return; }   // one download at a time (a GET: the busy guard doesn't cover it)
        f._pdf = true;
        CaaFormsService.GetPdf(f.id, (f.form_type || 'caa_form') + '.pdf').then(function (res) {
            f._pdf = false;
            if (!res || res.success === false) { ToastService.error('PDF unavailable', X.msg(res) || 'The PDF could not be made. Try again in a moment.'); return; }
            var url = URL.createObjectURL(res.blob), a = document.createElement('a');
            a.href = url; a.download = res.filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 250);
        });
    }
}
