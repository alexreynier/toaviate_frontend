/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · Student questionnaires
   Design: mockups/instructor-dashboard/student-questionnaires.html (approved 9 Nov 2026; "Decided 9 Nov 2026": Set a
   questionnaire opens on the student's course as a whole, searchable by name, a lesson narrows it, and pre / post is a pill
   on each row, never a filter). Replaces v1 dashboard.manage_user.student_questionnaires (views/manageclub/course_content/
   student.html, CourseContentController screen 'student' + AssignToStudentModalController) behind the v2 switch.
   Tracker: mockups/v2-build/fe-instructor-questionnaires.md.

   State: dashboard.v2.instructor_questionnaires  /manage_user/student_questionnaires?student_id
          ← dashboard.manage_user.student_questionnaires (same param). reloadOnSearch:false: the page itself moves between
          "Find a student" and "One student" (?student_id), pushing history, so Back returns to the find page.

   Data (be-alex-3e.md contract C40, plus C39's student search):
     GET  training_records/v2/students/{club}?scope=mine        the clubs (title, member_count) + "your students" (the combo's
                                                                  list before you type, "who needs you first")
     GET  training_records/v2/student_search/{club}?q=           the live search, 2+ letters (mine / others)
     GET  questionnaires/v2/waiting/{club}?scope=mine|club       the queue: to review (oldest first) + overdue, with counts
     GET  questionnaires/v2/student/{club}/{student}             one student: attempts + open assignments + next booking
     GET  questionnaires/v2/course/{course}?student_id           Set a questionnaire: every questionnaire in the course and its
                                                                  lessons (pre / post), with the student's latest take
     GET  courses/club/{club}, lessons/course/{course}           the course select and the lesson picker (v1's CourseService)
     POST course_assignments                                     set (v1's share): needs_confirm → the retake step (confirm:true);
                                                                  already_set → nothing new was sent, the open one is shown
     POST course_assignments/{id}/remind                         once a week (TOO_SOON + next_allowed_at; NO_EMAIL; NOT_OPEN)
     POST course_assignments/{id}/revoke                         Remove from the student's list (asks first)
   Reviewing an attempt stays its own page (v1 dashboard.manage_club.questionnaire_review: mark, notes, release; D25: only
   release or mark reviewed takes it out of the queue). On the way back the reviewed attempt fades and collapses out of the
   waiting list, then the toast (sessionStorage toaviate_sqn_review).

   Here: QuestionnairesV2Data (reads, writes, one helper per domain) · sqn-portal (a dialog moved to <body>) · sqn-leave
   (fade and collapse) · sqn-row (one row of a student's list) · InstructorQuestionnairesV2Controller.
   Views: views/v2/instructor_questionnaires/*.html · CSS: css/v2/instructor-questionnaires.css (sqn-).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_questionnaires', {
        url: '/manage_user/student_questionnaires?student_id',
        templateUrl: 'views/v2/instructor_questionnaires/questionnaires.html',
        controller: 'InstructorQuestionnairesV2Controller',
        controllerAs: 'vm',
        reloadOnSearch: false   // find ↔ one student follow the page into the URL without reloading it
    });
    DesignRoutesProvider.map('dashboard.manage_user.student_questionnaires', 'dashboard.v2.instructor_questionnaires');
}]);


/* ═════ QuestionnairesV2Data: the reads and writes, and the words (raw values never reach the screen) ═════ */
app.factory('QuestionnairesV2Data', QuestionnairesV2Data);
QuestionnairesV2Data.$inject = ['InsCore', 'CourseService', '$window'];
function QuestionnairesV2Data(InsCore, CourseService, $window) {
    var C = InsCore;
    var CLUB_KEY = 'toaviate_sqn_club', REVIEW_KEY = 'toaviate_sqn_review';
    // kept for this visit of the app: the last answers, so a trip to the review page and back paints at once
    var mem = { hint: null, focus: null, waiting: {}, mine: {}, stu: {} };
    var ERR = {
        FORBIDDEN: 'You need a live instructor membership of this club (or to be its Head of Training) for this.',
        NOT_FOUND: 'We couldn’t find that student at this club.',
        NETWORK_ERROR: 'We couldn’t reach the server. Check your connection and try again.'
    };

    return {
        mem: mem,
        // reads
        students: function (club) { return C.get('training_records/v2/students/' + club, { scope: 'mine', limit: 100 }); },
        search: function (club, q) { return C.get('training_records/v2/student_search/' + club, { q: q, limit: 12 }); },
        waiting: function (club, scope, kind, offset) { return C.get('questionnaires/v2/waiting/' + club, { scope: scope, kind: kind || 'all', limit: 200, offset: offset || '' }); },
        student: function (club, id) { return C.get('questionnaires/v2/student/' + club + '/' + id); },
        course: function (courseId, studentId) { return C.get('questionnaires/v2/course/' + courseId, { student_id: studentId }); },
        courses: courses,
        lessons: lessons,
        // writes
        set: function (body) { return C.post('course_assignments', body); },
        remind: function (id) { return C.post('course_assignments/' + id + '/remind', {}); },
        remove: function (id) { return C.post('course_assignments/' + id + '/revoke', {}); },
        // the club, remembered between visits; the attempt sent to review, remembered for the trip back
        savedClub: function () { try { return +($window.localStorage.getItem(CLUB_KEY) || 0); } catch (e) { return 0; } },
        rememberClub: function (id) { try { $window.localStorage.setItem(CLUB_KEY, String(id)); } catch (e) { /* storage off */ } },
        rememberReview: function (v) { try { $window.sessionStorage.setItem(REVIEW_KEY, JSON.stringify(angular.extend({ at: Date.now() }, v))); } catch (e) { /* storage off */ } },
        takeReview: takeReview,
        // words
        ok: ok, code: code, errorText: errorText, num: num,
        name: name, lessonName: lessonName, target: target, dayW: dayW, waitWord: waitWord, mins: mins, questionsWords: questionsWords,
        scoringWords: scoringWords, attemptState: attemptState, setState: setState, membershipWords: membershipWords, materialWhat: materialWhat,
        isVideo: isVideo
    };

    function listOf(d, keys) {
        if (angular.isArray(d)) { return d; }
        for (var i = 0; d && i < keys.length; i++) { if (angular.isArray(d[keys[i]])) { return d[keys[i]]; } }
        return null;
    }
    function courses(club) {
        return CourseService.GetCoursesByClubId(club).then(function (d) {
            var list = listOf(d, ['items', 'courses']);
            if (!list) { return { success: false, message: errorText(d, 'The club’s courses could not be loaded.') }; }
            return { success: true, items: CourseService.sortByDisplayOrder(list).filter(function (c) { return !+c.deleted; }) };
        });
    }
    function lessons(courseId) {
        return CourseService.GetLessonsByCourseId(courseId).then(function (d) {
            var list = listOf(d, ['items', 'lessons']);
            if (!list) { return { success: false }; }
            list = list.filter(function (l) { return !+l.deleted; });
            list.sort(function (a, b) { return (+a.organise || 0) - (+b.organise || 0) || (+a.id - +b.id); });
            return { success: true, items: list };
        });
    }
    function takeReview() {
        var v = null;
        try { v = JSON.parse($window.sessionStorage.getItem(REVIEW_KEY) || 'null'); $window.sessionStorage.removeItem(REVIEW_KEY); } catch (e) { v = null; }
        return v && v.attempt_id > 0 && Date.now() - (+v.at || 0) < 3 * 60 * 60 * 1000 ? v : null;
    }

    function ok(d) { return !!d && d.success !== false; }
    function code(d) { return d ? (d.error || (d.data && d.data.error) || null) : null; }
    function errorText(d, fallback) {
        if (!d) { return fallback; }
        var c = code(d);
        if (c && ERR[c]) { return ERR[c]; }
        var m = typeof d.message === 'string' ? d.message : '';
        if (m && !/^\s*</.test(m) && m !== 'Request failed' && m !== c && m.length < 300) { return m; }
        return fallback;
    }
    function num(n) { n = +n; return Math.round(n) === n ? String(n) : String(Math.round(n * 10) / 10); }
    function name(p) { return ((p && p.first_name || '') + ' ' + (p && p.last_name || '')).trim() || 'This student'; }
    /* "Ex 8 First solo"; a title that already starts with its code ("A13 First Solo") is kept as it is */
    function lessonName(ref, title) {
        title = String(title || '').trim(); ref = String(ref || '').trim();
        if (!ref) { return title || 'A lesson'; }
        if (!title) { return ref; }
        return title.toLowerCase().indexOf(ref.toLowerCase()) === 0 ? title : ref + ' ' + title;
    }
    /* where it sits, and before or after: "Before Ex 8: First solo" · "After the course · PPL(A)" */
    function target(type, title, ref, courseTitle, timing) {
        var w = timing === 'pre' ? 'Before ' : timing === 'post' ? 'After ' : '';
        if (type === 'lesson') {
            title = String(title || '').trim(); ref = String(ref || '').trim();
            var n = ref && title && title.toLowerCase().indexOf(ref.toLowerCase()) !== 0 ? ref + ': ' + title : (title || ref || 'a lesson');
            return w ? w + n : 'Lesson · ' + n;
        }
        var ct = String(courseTitle || title || '').trim();
        return (w ? w + 'the course' : 'The course') + (ct ? ' · ' + ct : '');
    }
    /* 'Today' · 'Yesterday' · 'Thu 5 Nov' */
    function dayW(s) { var n = C.ago(s); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : C.fDay(s); }
    function waitWord(days) { return days <= 0 ? 'came in today' : C.plural(days, 'day') + ' waiting'; }
    function mins(sec) { sec = +sec || 0; return sec < 60 ? 'under a minute' : Math.round(sec / 60) + ' min'; }
    /* "10 multiple choice, 1 written" */
    function questionsWords(mc, w) { mc = +mc || 0; w = +w || 0; return (mc ? mc + ' multiple choice' : '') + (mc && w ? ', ' : '') + (w ? w + ' written' : ''); }
    /* how it is scored, in the mockup's words */
    function scoringWords(instant, mc) { return instant ? 'scored on submitting' : (+mc ? 'you review it' : 'written answers'); }
    function attemptState(a) {
        // a take that's set but not opened (a granted retake: status 'opened', opened_at null, C40 started:false) is never
        // "In progress"
        if (a.started === false && a.status !== 'submitted' && a.status !== 'reviewed') { return a.n > 1 || a.retake ? { tone: 'muted', ic: 'fa-redo', label: 'Retake set · not started' } : { tone: 'muted', ic: null, label: 'Not started' }; }
        // the instructor's explicit pass (10 Nov: review_outcome) — "reviewed" alone is not "passed"
        if (a.status === 'reviewed' && a.outcome === 'passed') { return { tone: 'good', ic: 'fa-check', label: 'Reviewed · passed' }; }
        if (a.status === 'reviewed' && a.outcome === 'not_passed') { return { tone: 'warn', ic: 'fa-redo', label: 'Reviewed · not passed' }; }
        if (a.status === 'reviewed') { return { tone: 'good', ic: 'fa-check', label: a.released ? 'Reviewed' : 'Reviewed · not released' }; }
        if (a.status === 'submitted') { return { tone: 'warn', ic: 'fa-clipboard-check', label: 'To review' }; }
        if (a.status === 'in_progress' || a.status === 'opened') { return { tone: 'info', ic: 'fa-pen', label: 'In progress' }; }
        return { tone: 'muted', ic: null, label: 'Not started' };
    }
    function isVideo(s) { return String(s.fileType || '').toLowerCase() === 'video'; }
    function setState(s) {
        var mat = s.type === 'material';
        if (s.overdue) { return { tone: 'bad', ic: 'fa-exclamation-circle', label: 'Overdue' }; }
        if (s.status === 'viewed' && s.attemptStarted !== false) { return { tone: 'info', ic: mat ? 'fa-book-open' : 'fa-pen', label: mat ? 'Opened' : 'In progress' }; }
        if (s.retake) { return { tone: 'muted', ic: 'fa-redo', label: s.attemptStarted === false ? 'Retake set · not started' : 'Retake set' }; }
        return { tone: 'muted', ic: null, label: mat ? (isVideo(s) ? 'Not watched' : 'Not read') : 'Not started' };
    }
    /* "Video · 4 min" (C40 duration_seconds) · "PDF" (no page count is stored) */
    function materialWhat(s) {
        var t = String(s.fileType || '').toLowerCase();
        if (t === 'video') { return 'Video' + (s.duration ? ' · ' + mins(s.duration) : ''); }
        return t === 'pdf' ? 'PDF' : t === 'image' ? 'Image' : t ? t.toUpperCase() : 'File';
    }
    /* the member's standing, in words (D27: ex-members and imported students are labelled) */
    function membershipWords(row) {
        var m = row.membership || {};
        if (row.kind === 'ex_member') { return 'Ex-member' + (m.ends ? ' · left ' + C.fDate(m.ends) : ''); }
        if (row.kind === 'records_only') { return row.imported ? 'Imported records only' : 'Records only'; }
        return m.name || m.label || 'Member';
    }
}


/* sqn-portal on a dialog's scrim: moved to <body> (clear of the page's stacking and the fixed header), removed with its
   scope, ngAnimate off on it. It sits on a template's root inside an always-present host, never on an ng-if element. */
app.directive('sqnPortal', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            $animate.enabled(el, false);
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
}]);

/* sqn-leave="expr": when it turns true, the element fades and collapses (~220 ms, css .sqn-leaving) */
app.directive('sqnLeave', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            scope.$watch(attrs.sqnLeave, function (v) {
                if (!v) { return; }
                var e = el[0];
                e.style.maxHeight = e.offsetHeight + 'px';
                void e.offsetHeight;
                e.classList.add('sqn-leaving');
                ($window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () { e.style.maxHeight = '0px'; });
            });
        }
    };
}]);

/* initials for an instructor's circle (the app-wide rule: initials = an instructor) */
app.filter('sqnInitials', ['InsCore', function (InsCore) { return function (n) { return InsCore.initials(n).toUpperCase(); }; }]);

/* sqn-row: one row of a student's list (the three groups share it). An attribute template on the .ta-row itself, so the
   row keeps ta-base's .ta-row > .ta-row__main structure. */
app.directive('sqnRow', function () {
    return { restrict: 'A', templateUrl: 'views/v2/instructor_questionnaires/_row.html' };
});


/* ═════ the page ═════ */
app.controller('InstructorQuestionnairesV2Controller', InstructorQuestionnairesV2Controller);
InstructorQuestionnairesV2Controller.$inject = ['$scope', '$state', '$stateParams', '$location', '$timeout', '$window', '$document', '$sce', '$q',
    'QuestionnairesV2Data', 'InsCore', 'TaComboMatch', 'ToastService'];
function InstructorQuestionnairesV2Controller($scope, $state, $stateParams, $location, $timeout, $window, $document, $sce, $q,
    QuestionnairesV2Data, InsCore, TaComboMatch, ToastService) {
    var vm = this, D = QuestionnairesV2Data, C = InsCore, M = TaComboMatch, P = C.plural;
    var STATE = 'dashboard.v2.instructor_questionnaires';
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var CAP = 12;                       // the queue shows the oldest 12, then "Show all"
    var seq = { q: 0, s: 0, srch: 0, as: 0 };
    var srchTimer = null, lastFocus = null;
    var review = D.takeReview();        // an attempt sent to the review page, on its way back
    var me = C.myId(), myName = ((C.me().first_name || '') + ' ' + (C.me().last_name || '')).trim();

    vm.load = 'loading';                // the clubs: loading | ready | noclubs
    vm.clubs = [];
    vm.club = 0;
    vm.page = +$stateParams.student_id > 0 ? 'student' : 'find';
    vm.skel = [0, 1, 2];
    vm.Q = { scope: 'mine', f: 'review', more: false, state: 'loading', rev: [], od: [], counts: { to_review: 0, overdue: 0 }, msg: '', gen: 0 };
    vm.S = vm.page === 'student' ? { id: +$stateParams.student_id, state: 'loading', rows: [], g: { review: [], set: [], done: [] } } : null;
    vm.as = null;                       // Set a questionnaire (the dialog)
    vm.dlg = false;
    vm.cbQ = ''; vm.cbVer = 0;
    vm.mine = { loaded: false, list: [], total: 0 };
    vm.srch = {};                       // 'club|q' → the search's answer
    vm.qcap = CAP;
    vm.dayW = D.dayW;
    vm.fDay = C.fDay;
    vm.fTime = C.fTime;

    /* ════════ the clubs (titles, member counts, "your students"), then the page ════════ */
    vm.reload = start;
    start();

    function start() {
        vm.load = 'loading';
        var ins = C.instructorClubs(), cands = ins.concat(C.managerClubs().filter(function (x) { return ins.indexOf(x) < 0; }));
        var u = C.me(), saved = D.savedClub(), cci = +u.current_club_instructor || 0;
        var first = saved && cands.indexOf(saved) > -1 ? saved : (cci && cands.indexOf(cci) > -1 ? cci : cands[0]);
        if (!first) { vm.load = 'noclubs'; return; }
        D.students(first).then(function (d) {
            if (D.ok(d) && (d.clubs || []).length) {
                vm.clubs = d.clubs.map(function (c) { return { id: +c.club_id, title: c.title || '', short: shortTitle(c.title), members: +c.member_count || 0, mine: +c.my_students || 0 }; });
                if (!vm.clubs.some(function (c) { return c.id === +first; })) { vm.clubs.unshift({ id: +first, title: '', short: '', members: 0, mine: 0 }); }
            } else {
                // the clubs could not be read: carry on with the ids we know (their titles fall back to "your club")
                vm.clubs = cands.map(function (id) { return { id: id, title: '', short: '', members: 0, mine: 0 }; });
            }
            vm.club = +first;
            D.rememberClub(vm.club);
            if (D.ok(d)) { takeMine(vm.club, d); } else { vm.mine = { loaded: true, list: [], total: 0, club: vm.club, failed: true }; }
            vm.load = 'ready';
            sync(true);
        });
    }
    /* the club switch on phones: "Pilot Centre", "Westfield" */
    function shortTitle(t) {
        t = String(t || '').replace(/\s*\(demo\)\s*$/i, '').trim();
        var s = t.replace(/^the\s+/i, '').replace(/\s+(flying club|flying school|aero club|flight centre|flight training)$/i, '').trim();
        return s.length >= 3 ? s : t;
    }
    function clubOf(id) { return vm.clubs.filter(function (c) { return c.id === +id; })[0] || null; }
    vm.clubTitle = function (id) { var c = clubOf(id || vm.club); return c && c.title ? c.title : 'your club'; };

    vm.setClub = function (id) {
        id = +id;
        if (id === vm.club) { return; }
        vm.club = id; D.rememberClub(id);
        vm.cbQ = ''; vm.Q.more = false; vm.lastGroups = null;
        vm.mine = D.mem.mine[id] || { loaded: false, list: [], total: 0 };
        loadMine();
        loadQueue();
    };

    /* ════════ find ↔ one student (?student_id; history is pushed, so Back returns to the find page) ════════ */
    function sync(first) {
        if (vm.load !== 'ready' || $state.current.name !== STATE) { return; }
        var id = +($location.search().student_id || 0);
        if (id > 0) {
            if (first || vm.page !== 'student' || !vm.S || vm.S.id !== id || !vm.S.stu) { showStudent(id); }
        } else if (first || vm.page !== 'find') {
            showFind();
        }
    }
    $scope.$on('$locationChangeSuccess', function () { sync(false); });

    function showFind() {
        closeDialog(true);
        vm.page = 'find'; vm.S = null;
        scrollTop();
        loadQueue();
    }
    vm.toFind = function (ev) {
        if (ev) { ev.preventDefault(); }
        if (vm.dlg) { return; }
        $state.go('.', { student_id: null });
        showFind();
    };
    /* open a student from the search or the queue: hint = what we already know (the hero paints at once) */
    vm.openStudent = function (id, hint, focus, ev) {
        if (ev) { ev.preventDefault(); }
        id = +id;
        if (!id) { return; }
        D.mem.hint = hint ? angular.extend({ id: id }, hint) : null;
        D.mem.focus = focus || null;
        $state.go('.', { student_id: id });
        showStudent(id);
    };
    function scrollTop() { try { $window.scrollTo(0, 0); } catch (e) { /* no window */ } }

    /* ════════ the search (<ta-combo>): your students first, then everyone at the club ════════ */
    function takeMine(club, d) {
        var list = (d.students || []).map(function (s, i) {
            return { id: +s.user_id, first: s.first_name || '', name: D.name(s), email: s.email || '', ms: D.membershipWords({ membership: s.membership, kind: 'member' }), rv: +(s.needs && s.needs.questionnaire_to_review) || 0, qs: s.questionnaires || null, i: i };
        });
        var m = { loaded: true, list: list, total: d.counts ? (+d.counts.all || list.length) : list.length, club: club };
        D.mem.mine[club] = m;
        if (club === vm.club) { vm.mine = m; vm.cbVer++; }
    }
    function loadMine() {
        var club = vm.club;
        D.students(club).then(function (d) {
            if (D.ok(d)) { takeMine(club, d); }
            else if (club === vm.club && !vm.mine.loaded) { vm.mine = { loaded: true, list: [], total: 0, club: club, failed: true }; vm.cbVer++; }
        });
    }
    /* what is waiting for a student (from the queue already read) */
    function waitingFor(id) {
        var rv = 0, od = 0;
        vm.Q.rev.forEach(function (x) { if (x.stu.id === id && !x.ghost) { rv++; } });
        vm.Q.od.forEach(function (x) { if (x.stu.id === id) { od++; } });
        return { rv: rv, od: od };
    }
    /* a person in the search: what is waiting for you, else when they last submitted, else what is set, else "Nothing yet"
       (the mockup's right column), from the rows' C39 questionnaires {to_review, set_open (questionnaires and reading),
       last_submitted_at}. A row without it (an older backend) says what the queue knows: to review, or overdue. */
    function personRow(p, mine) {
        var w = waitingFor(p.id), q = p.qs, rv = Math.max(w.rv, mine ? (p.rv || 0) : 0, q ? +q.to_review || 0 : 0), r = '', rs = '', quiet = false;
        if (rv) { r = rv + ' to review'; rs = 'waiting for you'; }
        else if (q && q.last_submitted_at) { r = D.dayW(q.last_submitted_at); rs = 'last submitted'; }
        else if (q && +q.set_open) { r = P(+q.set_open, 'set'); rs = 'not done yet'; }
        else if (w.od) { r = w.od + ' overdue'; rs = 'not done yet'; }
        else if (q) { r = 'Nothing yet'; quiet = true; }
        return { key: String(p.id), av: { member: true, title: 'Member' }, t: p.name, s: (p.email ? p.email + ' · ' : '') + p.ms, r: r, rs: rs, quiet: quiet, _p: p };
    }
    /* "who needs you first": the most waiting for review first, then the server's order (as the mockup) */
    function need(p) { return Math.max(waitingFor(p.id).rv, p.rv || 0, p.qs ? +p.qs.to_review || 0 : 0); }
    function byNeed(a, b) { return (need(b) - need(a)) || (a.i - b.i); }
    function localHits(q) {
        var t = M.toks(q);
        return vm.mine.list.filter(function (p) { return t.every(function (x) { return M.wordHit(p.name, x) || M.norm(p.email).indexOf(x) === 0; }); });
    }
    vm.cbSource = function (q) {
        q = String(q || '').trim();
        var title = vm.clubTitle(), cl = clubOf(vm.club), members = cl && cl.members ? cl.members : 0;
        var everyone = members ? 'all ' + members.toLocaleString('en-GB') + ' members of ' + title : 'everyone at ' + title;
        if (!q) {
            if (!vm.mine.loaded) { return { groups: [], busy: 'Loading your students…' }; }
            var rows = vm.mine.list.slice().sort(byNeed).slice(0, 6).map(function (p) { return personRow(p, true); });
            if (!rows.length) { rows = [{ hint: true, t: vm.mine.failed ? 'Your students couldn’t be loaded. Type a name or e-mail to search.' : 'No students of yours at ' + title + ' yet: anyone you file a training record for appears here.' }]; }
            return { groups: [{ label: 'Your students · who needs you first', right: vm.mine.list.length ? P(vm.mine.total, 'student') : '', rows: rows }], foot: 'Type a name or e-mail to search ' + everyone };
        }
        var none = { t: 'Nobody at ' + title + ' matches “' + q + '”', s: 'Try the first letters of the first name or the surname, or part of the e-mail.' };
        if (M.norm(q).length < 2) {
            var hits = localHits(q).sort(byNeed);
            return { groups: [{ label: 'Your students', right: P(hits.length, 'match', 'matches'), rows: hits.slice(0, 5).map(function (p) { return personRow(p, true); }).concat([{ hint: true, t: 'Type one more letter to search ' + everyone + '.' }]) }] };
        }
        var key = vm.club + '|' + q.toLowerCase(), r = vm.srch[key];
        if (!r) { runSearch(q, key); return { groups: vm.lastGroups || [], busy: 'Searching…' }; }
        if (r.failed) { return { groups: [], empty: { t: 'The search didn’t work', s: r.message } }; }
        var mine = r.mine.map(function (x) { return personRow(x, true); }), others = r.others.map(function (x) { return personRow(x, false); });
        var shown = Math.min(5, mine.length) + Math.min(6, others.length), total = r.mineTotal + r.othersTotal;
        vm.lastGroups = [
            { label: 'Your students', right: P(r.mineTotal, 'match', 'matches'), rows: mine.slice(0, 5) },
            { label: 'Other members of ' + title, right: P(r.othersTotal, 'match', 'matches'), rows: others.slice(0, 6) }
        ];
        return { groups: vm.lastGroups, empty: none, foot: total > shown ? 'Showing ' + shown + ' of ' + total + ' matches · keep typing to narrow it down' : '' };
    };
    function runSearch(q, key) {
        if (srchTimer) { $timeout.cancel(srchTimer); }
        var my = ++seq.srch, club = vm.club;
        srchTimer = $timeout(function () {
            srchTimer = null;
            D.search(club, q).then(function (d) {
                if (!D.ok(d)) { vm.srch[key] = { failed: true, message: D.errorText(d, 'Try again in a moment.') }; }
                else {
                    var map = function (x, i) { return { id: +x.user_id, first: x.first_name || '', name: D.name(x), email: x.email || '', ms: D.membershipWords(x), rv: 0, qs: x.questionnaires || null, i: i }; };
                    vm.srch[key] = { mine: (d.mine || []).map(map), others: (d.others || []).map(map), mineTotal: +d.mine_total || (d.mine || []).length, othersTotal: +d.others_total || (d.others || []).length };
                }
                if (my === seq.srch) { vm.cbVer++; }
            });
        }, 200);
    }
    vm.cbType = function (q) { if (!String(q || '').trim()) { vm.lastGroups = null; } };
    vm.cbClear = function () { vm.cbQ = ''; vm.lastGroups = null; };
    vm.cbPick = function (key) {
        var id = +key, p = null, pools = [vm.mine.list];
        Object.keys(vm.srch).forEach(function (k) { var r = vm.srch[k]; if (!r.failed) { pools.push(r.mine, r.others); } });
        pools.forEach(function (l) { l.forEach(function (x) { if (!p && x.id === id) { p = x; } }); });
        vm.cbQ = '';
        vm.openStudent(id, p ? { name: p.name, first: p.first, sub: p.ms } : null);
    };

    /* ════════ the queue: what is waiting across your students (or the club) ════════ */
    vm.setScope = function (s) { if (vm.Q.scope === s) { return; } vm.Q.scope = s; vm.Q.more = false; loadQueue(); };
    vm.setQf = function (f) { if (vm.Q.f === f) { return; } vm.Q.f = f; vm.Q.more = false; vm.Q.gen++; };
    vm.qmore = function () { vm.Q.more = true; loadRest(); };
    vm.qlist = function () { return vm.Q.f === 'review' ? vm.Q.rev : vm.Q.od; };
    vm.qshown = function () { var l = vm.qlist(); return vm.Q.more ? l : l.slice(0, CAP); };
    vm.qcount = function () { return vm.Q.f === 'review' ? vm.Q.counts.to_review : vm.Q.counts.overdue; };

    function loadQueue() {
        var club = vm.club, scope = vm.Q.scope, key = club + '|' + scope, my = ++seq.q, cached = D.mem.waiting[key];
        if (cached) { applyQueue(cached, true); } else { vm.Q.state = 'loading'; vm.Q.rev = []; vm.Q.od = []; }
        D.waiting(club, scope).then(function (d) {
            if (my !== seq.q || vm.page !== 'find') { return; }
            if (!D.ok(d)) {
                if (cached) { return; }
                vm.Q.state = 'error'; vm.Q.msg = D.errorText(d, 'Something went wrong on our side. Try again in a moment.');
                return;
            }
            D.mem.waiting[key] = d;
            applyQueue(d, !cached);
            if (review) { if (review.page === 'find' && +review.club === club) { reviewedLeaves(); } else { review = null; } }
            vm.cbVer++;
        });
    }
    vm.reloadQueue = loadQueue;
    function applyQueue(d, rise) {
        var items = d.items || [];
        vm.Q.rev = items.filter(function (x) { return x.kind === 'review'; }).map(queueRow);
        vm.Q.od = items.filter(function (x) { return x.kind === 'overdue'; }).map(queueRow);
        vm.Q.counts = { to_review: d.counts ? +d.counts.to_review || 0 : vm.Q.rev.length, overdue: d.counts ? +d.counts.overdue || 0 : vm.Q.od.length };
        vm.Q.state = 'ready';
        if (rise) { vm.Q.gen++; }
    }
    /* "Show all": the first read brings up to 200 of both kinds; any more come page by page */
    function loadRest() {
        var kind = vm.Q.f === 'review' ? 'review' : 'overdue', have = vm.qlist().length, want = vm.qcount();
        if (have >= want || vm.Q.paging) { return; }
        vm.Q.paging = true;
        var club = vm.club, scope = vm.Q.scope;
        D.waiting(club, scope, kind, have).then(function (d) {
            vm.Q.paging = false;
            if (!D.ok(d) || club !== vm.club || scope !== vm.Q.scope) { return; }
            var rows = (d.items || []).filter(function (x) { return x.kind === kind; }).map(queueRow);
            if (kind === 'review') { vm.Q.rev = vm.Q.rev.concat(rows); } else { vm.Q.od = vm.Q.od.concat(rows); }
        });
    }
    function queueRow(x) {
        var stu = { id: +(x.student && x.student.user_id), name: D.name(x.student), first: (x.student && x.student.first_name) || '' };
        var t = x.target || {};
        var forW = D.target(t.type, t.title, t.course_reference, t.course_title, t.timing);
        if (x.kind === 'review') {
            return {
                key: 'r' + x.attempt_id, kind: 'review', attemptId: +x.attempt_id, stu: stu, title: (x.questionnaire && x.questionnaire.title) || 'Questionnaire', forW: forW,
                whenB: 'Submitted ' + D.dayW(x.submitted_at), whenS: D.waitWord(x.waiting_days !== undefined && x.waiting_days !== null ? +x.waiting_days : C.ago(x.submitted_at)),
                st: D.attemptState({ status: 'submitted' })
            };
        }
        var by = x.assigned_by_name || '';
        return {
            key: 'o' + x.assignment_id, kind: 'overdue', assignmentId: +x.assignment_id, stu: stu, title: (x.item && x.item.title) || 'Questionnaire', forW: forW,
            whenB: 'Was due ' + C.fDay(x.due_date), whenS: 'set by ' + (by && by === myName ? 'you' : (by || 'an instructor')),
            st: { tone: 'bad', ic: 'fa-exclamation-circle', label: 'Overdue' }
        };
    }
    vm.queueOpen = function (x, ev) {
        if (ev) { ev.preventDefault(); }
        if (x.ghost) { return; }
        vm.openStudent(x.stu.id, { name: x.stu.name, first: x.stu.first }, x.kind === 'review' ? 'a' + x.attemptId : 's' + x.assignmentId);
    };

    /* ════════ reviewing an attempt: its own page, and back ════════ */
    vm.review = function (attemptId, ev, row) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        attemptId = +attemptId;
        if (!attemptId || vm.dlg || (row && row.ghost)) { return; }
        var snap = null, index = 0;
        if (vm.page === 'find') {
            vm.Q.rev.forEach(function (x, i) { if (x.attemptId === attemptId) { snap = angular.copy(x); index = i; } });
        } else if (row && row.a && row.a.status === 'submitted') {
            snap = { key: row.key, title: row.title, sub: row.sub, forW: row.forW, when: row.when, score: row.score, icon: row.icon };
        }
        if (snap) { D.rememberReview({ attempt_id: attemptId, page: vm.page, club: vm.club, student_id: vm.S ? vm.S.id : 0, row: snap, index: index }); }
        $state.go('dashboard.manage_club.questionnaire_review', { attempt_id: attemptId });
    };
    /* Enter / Space on a button drawn inside a row's link or button (the mockup's span role=button) */
    vm.keyAct = function (ev, act, x) {
        if (ev.keyCode !== 13 && ev.keyCode !== 32) { return; }
        ev.preventDefault(); ev.stopPropagation();
        if (act === 'review') { vm.review(x.attemptId); } else if (act === 'open') { vm.queueOpen(x); } else if (act === 'row') { vm.rowAct(x); }
    };
    /* back from the review: if the attempt is no longer waiting, it leaves the list (fade and collapse), then the toast */
    function reviewedLeaves() {
        var r = review; review = null;
        if (!r || !r.row) { return; }
        if (vm.Q.rev.some(function (x) { return x.attemptId === +r.attempt_id; })) { return; }   // still waiting (notes saved only, D25)
        var ghost = angular.extend(r.row, { ghost: true, out: false });
        var at = Math.min(vm.Q.rev.length, Math.max(0, +r.index || 0));
        vm.Q.rev = vm.Q.rev.slice(0, at).concat([ghost], vm.Q.rev.slice(at));
        vm.Q.f = 'review';
        leave(ghost, function () { vm.Q.rev = vm.Q.rev.filter(function (x) { return x !== ghost; }); },
            'Reviewed', ghost.stu.first + '’s “' + ghost.title + '” is off the waiting list.');
    }
    function leave(obj, done, title, sub) {
        var still = reduce && reduce.matches;
        $timeout(function () {
            obj.out = true;
            $timeout(function () { done(); ToastService.success(title, sub, { confetti: false }); }, still ? 0 : 240);
        }, still ? 0 : 450);
    }

    /* ════════ one student ════════ */
    function showStudent(id) {
        var hint = D.mem.hint && D.mem.hint.id === id ? D.mem.hint : null, focus = D.mem.focus;
        D.mem.hint = null; D.mem.focus = null;
        closeDialog(true);
        vm.page = 'student';
        var S = vm.S = { id: id, state: 'loading', f: 'all', open: null, rm: null, err: null, focus: focus, gen: 0, rows: [], attempts: [], g: { review: [], set: [], done: [] },
            stu: hint ? { first: hint.first || C.firstName(hint.name), name: hint.name, sub: hint.sub ? hint.sub + ' · ' + vm.clubTitle() : '' } : null };
        scrollTop();
        var cached = D.mem.stu[vm.club + '|' + id];
        if (cached) { build(S, cached); S.state = 'ready'; S.gen++; afterLoad(S, false); }
        loadStudent(vm.club, [], !!cached);
    }
    vm.reloadStudent = function () { if (vm.S) { vm.S.state = 'loading'; loadStudent(vm.club, [], false); } };
    /* a deep link (?student_id) may be a student of another of my clubs: try each in turn */
    function loadStudent(club, tried, hasCopy) {
        var S = vm.S, my = ++seq.s;
        D.student(club, S.id).then(function (d) {
            if (my !== seq.s || vm.S !== S) { return; }
            if (!D.ok(d)) {
                var c = D.code(d);
                tried = tried.concat([club]);
                var next = vm.clubs.filter(function (x) { return tried.indexOf(x.id) < 0; })[0];
                if ((c === 'NOT_FOUND' || c === 'FORBIDDEN') && next && !hasCopy) { loadStudent(next.id, tried, false); return; }
                if (hasCopy) { return; }
                S.state = c === 'NOT_FOUND' ? 'notfound' : 'error';
                S.msg = D.errorText(d, 'Something went wrong on our side. Try again in a moment.');
                return;
            }
            if (club !== vm.club) { vm.club = club; D.rememberClub(club); vm.mine = D.mem.mine[club] || { loaded: false, list: [], total: 0 }; loadMine(); }
            D.mem.stu[club + '|' + S.id] = d;
            var open = S.open;
            build(S, d);
            if (open && S.rows.some(function (x) { return x.key === open; })) { S.open = open; }
            if (S.state !== 'ready') { S.state = 'ready'; S.gen++; }
            afterLoad(S, true);
        });
    }
    /* fresh = the server's answer (not the copy kept from the last visit): only that one says whether a review happened */
    function afterLoad(S, fresh) {
        if (S.focus && S.rows.some(function (r) { return r.key === S.focus; })) { S.open = S.focus; scrollToRow(S.focus); S.focus = null; }
        if (fresh && review) { if (review.page === 'student' && +review.student_id === S.id) { studentReviewed(S); } else { review = null; } }
    }
    function scrollToRow(key) {
        $timeout(function () {
            var el = document.getElementById('sqn-r-' + key);
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: reduce && reduce.matches ? 'auto' : 'smooth' }); }
        }, 320, false);
    }

    function build(S, d) {
        var s = d.student || {};
        S.stu = { id: +s.id || S.id, first: s.first_name || C.firstName(D.name(s)), name: D.name(s), sub: [s.membership_name || s.membership_label || '', vm.clubTitle()].filter(Boolean).join(' · ') };
        S.next = d.next_booking || null;
        S.focusCourse = +d.focus_course_id || 0;
        S.lastAt = (d.counts && d.counts.last_submitted_at) || null;
        var attempts = (d.attempts || []).map(att), byId = {};
        attempts.forEach(function (a) { byId[a.id] = a; });
        var rows = attempts.map(function (a) { return { key: 'a' + a.id, a: a, group: a.status === 'submitted' ? 'review' : a.status === 'reviewed' ? 'done' : 'set' }; });
        (d.assignments || []).map(asg).forEach(function (x) {
            if (!x.open) { return; }
            if (x.attemptId && byId[x.attemptId]) { rows.forEach(function (r) { if (r.a && r.a.id === x.attemptId) { r.s = x; } }); return; }
            rows.push({ key: 's' + x.id, s: x, group: 'set' });
        });
        S.attempts = attempts;
        rows.forEach(function (r) { decorate(r, S); });
        S.rows = rows;
        regroup(S);
    }
    function att(a) {
        var hasScore = a.max_score !== null && a.max_score !== undefined && +a.max_score > 0 && a.auto_score !== null && a.auto_score !== undefined;
        return {
            id: +a.id, qid: +a.questionnaire_id, n: +a.attempt_number || 1, status: a.status, opened: a.opened_at || null, submitted: a.submitted_at, time: +a.time_spent_seconds || 0,
            started: a.started === false ? false : !!(a.opened_at || a.submitted_at || a.status === 'in_progress' || a.started === true),
            released: +a.score_released === 1, by: a.reviewed_by_name || '', byColour: a.reviewed_by_colour || null, byMe: me > 0 && +a.reviewed_by === me, at: a.reviewed_at, notes: String(a.instructor_notes || '').trim(),
            outcome: a.review_outcome === 'passed' || a.review_outcome === 'not_passed' ? a.review_outcome : null,
            outcomeBy: a.outcome_by_name || '', outcomeByMe: me > 0 && +a.outcome_by === me, outcomeAt: a.outcome_at || null,
            title: a.questionnaire_title || 'Questionnaire', forW: D.target(a.attach_type, a.target_title, a.course_reference, a.course_title, a.timing),
            score: hasScore ? [D.num(a.auto_score), D.num(a.max_score)] : null,
            qn: +a.question_count || 0, mc: +a.mc_count || 0, w: +a.written_count || 0, instant: !!a.instant_mc_score, limit: +a.time_limit_minutes || 0,
            courseId: +a.course_id || 0, attachType: a.attach_type, attachId: +a.attach_id || 0, timing: a.timing
        };
    }
    function asg(x) {
        var open = x.open !== undefined && x.open !== null ? !!x.open : ['assigned', 'viewed'].indexOf(x.status) > -1;
        if (['completed', 'revoked', 'cancelled'].indexOf(x.status) > -1 || x.revoked_at) { open = false; }
        var by = x.assigned_by_name || '', byMe = me > 0 && +x.assigned_by === me;
        var s = {
            id: +x.id, type: x.item_type === 'material' ? 'material' : 'questionnaire', itemId: +x.item_id, title: x.item_title || (x.item_type === 'material' ? 'Reading' : 'Questionnaire'),
            status: x.status, open: open, retake: +x.is_retake === 1, msg: String(x.message || '').trim(), due: x.due_date || null, at: x.assigned_at,
            by: byMe ? 'you' : (by || 'an instructor'), byName: by || 'An instructor', byMe: byMe, byColour: x.assigned_by_colour || null,
            overdue: x.overdue !== undefined && x.overdue !== null ? !!x.overdue : (!!x.due_date && x.due_date < C.today()),
            emailed: x.emailed !== undefined && x.emailed !== null ? !!x.emailed : !!x.email_sent_at, muted: !!x.emails_muted,
            remindedAt: x.reminded_at || null, nextRemind: x.next_remind_at || null, canRemind: x.can_remind === undefined || x.can_remind === null ? !x.next_remind_at : !!x.can_remind,
            attemptId: +x.attempt_id || 0, attemptStarted: x.attempt_started === false ? false : x.attempt_started === true ? true : null,
            answered: +x.answered_count || 0, qn: +x.question_count || 0, limit: +x.time_limit_minutes || 0,
            forW: D.target(x.attach_type, x.target_title, x.course_reference, x.course_title, x.timing),
            fileType: x.file_type || (x.kind === 'video' ? 'video' : null), duration: +x.duration_seconds || 0
        };
        remindOf(s);
        return s;
    }
    /* Remind (C40): once a week; the lock ends at 00:00 seven days after the last reminder */
    function remindOf(s) {
        // locked = the weekly rule (next_remind_at); can_remind false with no lock = not possible here (not open, or reminders
        // not available on this server yet), so the button is left out
        var locked = !s.canRemind && !!s.nextRemind, when = '';
        if (s.remindedAt) { var n = C.ago(s.remindedAt); when = 'Reminded ' + (n === 0 ? 'today ' + C.fTime(s.remindedAt) : n === 1 ? 'yesterday' : C.fDay(s.remindedAt)); }
        s.rem = {
            locked: locked, hidden: !s.canRemind && !s.nextRemind,
            note: locked && s.nextRemind ? (when ? when + ' · you' : 'You') + ' can ask again from ' + C.fDay(s.nextRemind) : when,
            title: locked && s.nextRemind ? 'One reminder a week: the next from ' + C.fDay(s.nextRemind) : ''
        };
    }
    /* everything a row shows, worked out once */
    function decorate(r, S) {
        var a = r.a, s = r.s, mat = !!(s && s.type === 'material' && !a);
        if (a && s && s.retake) { a.retake = true; }
        if (a && s && s.attemptStarted === false) { a.started = false; }
        r.mat = mat;
        r.title = a ? a.title : s.title;
        r.forW = a ? a.forW : s.forW;
        r.st = s && (!a || a.status === 'in_progress' || a.status === 'opened') && (s.overdue || !a) ? D.setState(s) : D.attemptState(a);
        r.icon = mat ? (D.isVideo(s) ? 'fa-film' : 'fa-file-pdf') : 'fa-clipboard-check';
        r.ic = r.group === 'review' ? 'ta-ic--warn' : r.group === 'done' ? 'ta-ic--good' : r.st.tone === 'bad' ? 'ta-ic--bad' : '';
        r.sub = r.forW + (a && a.n > 1 ? ' · attempt ' + a.n : '') + (s && s.retake ? ' · retake' : '') + (mat ? ' · ' + D.materialWhat(s) : '');
        // the When cell
        var l1, l2 = '', bad = false;
        if (a && a.status === 'submitted') { l1 = 'Submitted ' + D.dayW(a.submitted); l2 = C.fTime(a.submitted) + ' · ' + D.waitWord(C.ago(a.submitted)); }
        else if (a && a.status === 'reviewed') { l1 = 'Reviewed ' + C.fDay(a.at || a.submitted); l2 = a.byMe ? 'by you' : (a.by ? 'by ' + a.by : ''); }
        else if (s && s.overdue) { bad = true; l1 = 'Overdue · due ' + C.fDay(s.due); l2 = 'set by ' + s.by; }
        else if (s && s.due) { l1 = 'Due ' + C.fDay(s.due); l2 = 'set by ' + s.by + (s.at ? ' ' + C.fDay(s.at) : ''); }
        else if (a && a.started && a.opened) { l1 = 'Opened ' + D.dayW(a.opened); l2 = 'not submitted yet'; }
        else if (s) { l1 = 'No due date'; l2 = 'set by ' + s.by + (s.at ? ' ' + C.fDay(s.at) : ''); }
        else { l1 = ''; l2 = ''; }   // a take set but not opened, with no assignment: no "Opened" line (the pill says it)
        r.when = { b: l1, s: l2, bad: bad };
        // the score: whether the student can see it (released or not); written ones say "no score"
        if (a && a.score) { r.score = { v: a.score[0], of: a.score[1], s: a.status === 'reviewed' ? (a.released ? 'released' : 'not released') : 'marked automatically' }; }
        else if (a && (a.status === 'submitted' || a.status === 'reviewed') && !a.mc) { r.score = { none: 'written' }; }
        else { r.score = { none: 'dash' }; }
        r.act = r.group === 'review' ? 'review' : a && a.status === 'reviewed' ? 'open' : 'details';
        r.facts = facts(r, S);
    }
    function facts(r, S) {
        var a = r.a, s = r.s, f = [], first = S.stu ? S.stu.first : 'the student';
        if (a && !a.started && a.status !== 'submitted' && a.status !== 'reviewed') {
            var qn = D.questionsWords(a.mc, a.w);
            f.push({ k: 'For', v: a.forW });
            f.push({ k: 'Questions', v: String(a.qn || (a.mc + a.w) || '—'), sm: qn ? '· ' + qn : '' });
            f.push({ k: 'Started', v: 'Not yet', sm: a.n > 1 ? '· attempt ' + a.n + ', a fresh take' : '' });
            if (s && s.due) { f.push({ k: 'Due', v: C.fDayLong(s.due) }); }
        } else if (a) {
            f.push({ k: 'For', v: a.forW });
            var qw = D.questionsWords(a.mc, a.w);
            f.push({ k: 'Questions', v: String(a.qn || (a.mc + a.w) || '—'), sm: qw ? '· ' + qw : '' });
            f.push({ k: 'Time spent', v: a.time ? D.mins(a.time) : '—', sm: a.opened ? '· opened ' + C.fDay(a.opened) + ' ' + C.fTime(a.opened) : '' });
            if (a.submitted) { f.push({ k: 'Submitted', v: C.fDayLong(a.submitted), sm: C.fTime(a.submitted) }); }
            if (a.score) { f.push({ k: 'Score', v: a.score[0] + ' / ' + a.score[1], sm: '· ' + (a.instant ? 'shown to ' + first + ' on submitting' : a.released ? 'released to ' + first : 'not released yet') }); }
            else { f.push({ k: 'Score', v: a.mc ? 'After review' : 'Written answers · no score' }); }
            if (a.status === 'reviewed') { f.push({ k: 'Reviewed', v: C.fDay(a.at || a.submitted), sm: a.byMe ? 'by you' : a.by ? 'by ' + a.by : '' }); }
            if (a.status === 'reviewed' && a.outcome) {
                f.push({ k: 'Outcome', v: a.outcome === 'passed' ? 'Passed' : 'Not passed', sm: ((a.outcomeByMe ? 'by you' : a.outcomeBy ? 'by ' + a.outcomeBy : '') + (a.outcomeAt ? ' ' + C.fDay(a.outcomeAt) : '')).trim() });
            }
            if (s && s.due) { f.push({ k: 'Due', v: C.fDayLong(s.due) }); }
        } else if (s) {
            var mat = s.type === 'material';
            f.push({ k: 'For', v: s.forW });
            f.push(mat ? { k: 'File', v: D.materialWhat(s) } : { k: 'Questions', v: s.qn ? String(s.qn) : '—', sm: s.limit ? '· about ' + s.limit + ' min' : '' });
            f.push({ k: 'Due', v: s.due ? C.fDayLong(s.due) : 'No due date' });
            var began = s.status === 'viewed' && s.attemptStarted !== false;
            f.push({ k: mat ? 'Opened' : 'Started', v: began ? 'Yes' : 'Not yet', sm: !mat && began && s.qn ? '· ' + s.answered + ' of ' + s.qn + ' answered' : '' });
        }
        return f;
    }
    function regroup(S) {
        var g = { review: [], set: [], done: [] };
        S.rows.forEach(function (r) { g[r.group].push(r); });
        g.review.sort(function (x, y) { return String(x.a.submitted) < String(y.a.submitted) ? -1 : 1; });
        g.set.sort(function (x, y) {
            var ox = x.s && x.s.overdue ? 0 : 1, oy = y.s && y.s.overdue ? 0 : 1;
            var dx = (x.s && x.s.due) || '9999', dy = (y.s && y.s.due) || '9999';
            return ox - oy || (dx < dy ? -1 : dx > dy ? 1 : 0) || (x.key < y.key ? -1 : 1);
        });
        g.done.sort(function (x, y) { return String(y.a.submitted || y.a.at) < String(x.a.submitted || x.a.at) ? -1 : 1; });
        g.review.concat(g.set, g.done).forEach(function (r, i) { r._i = i; });   // the rows rise in, staggered, in reading order
        S.g = g;
        // the other attempts of the same questionnaire, for an opened attempt
        S.rows.forEach(function (r) {
            r.others = !r.a ? [] : S.attempts.filter(function (x) { return x.qid === r.a.qid && x.id !== r.a.id; }).sort(function (x, y) { return y.n - x.n; }).map(function (x) {
                return { id: x.id, n: x.n, st: D.attemptState(x), score: x.score, day: x.submitted ? C.fDay(x.submitted) : '' };
            });
        });
        var od = S.rows.filter(function (r) { return r.s && r.s.overdue; }).map(function (r) { return r.s; });
        var last = S.attempts.filter(function (a) { return a.submitted; }).map(function (a) { return a.submitted; }).sort().pop() || S.lastAt;
        S.counts = { all: S.rows.length, review: g.review.length, set: g.set.length, done: g.done.length, od: od.length, last: last || null };
        S.chips = [['all', 'All', S.rows.length], ['review', 'To review', g.review.length, true], ['set', 'Set, not done', g.set.length], ['done', 'Reviewed', g.done.length]]
            .filter(function (c) { return c[0] === 'all' || c[2]; }).map(function (c) { return { k: c[0], label: c[1], n: c[2], attn: !!c[3] }; });
        if (S.f !== 'all' && !g[S.f].length) { S.f = 'all'; }
        S.note = overdueNote(S, od);
    }
    function overdueNote(S, od) {
        if (!od.length) { return null; }
        od.sort(function (x, y) { return String(x.due) < String(y.due) ? -1 : 1; });
        var first = S.stu.first || 'The student', nx = S.next, lesson = '';
        if (nx && nx.start) {
            var who = nx.instructor_name ? (nx.instructor_name === myName ? 'you' : nx.instructor_name) : '';
            lesson = '; ' + first + '’s next lesson is ' + (String(nx.start).slice(0, 10) === C.today() ? 'today at ' + C.fTime(nx.start) : C.fDay(nx.start)) + (who ? ' with ' + who : '');
        }
        var emailed = od.every(function (s) { return s.emailed; });
        return {
            b: od.length === 1 ? '“' + od[0].title + '” is overdue' : od.length + ' things are overdue',
            t: ' (due ' + C.fDay(od[0].due) + ')' + lesson + '. ' + (emailed ? first + ' has been e-mailed; you could go through it in the briefing.' : 'You could remind ' + first + ', or go through it in the briefing.')
        };
    }
    vm.showG = function (k) { return !!(vm.S && vm.S.g[k].length && (vm.S.f === 'all' || vm.S.f === k)); };
    var NONE = [];
    vm.gl = function (k) { return vm.showG(k) ? vm.S.g[k] : NONE; };
    vm.setF = function (f) { var S = vm.S; if (!S || S.f === f) { return; } S.f = f; S.open = null; S.rm = null; S.err = null; S.gen++; };
    vm.toggle = function (r, ev) { if (ev) { ev.preventDefault(); } if (!vm.S || r.ghost) { return; } vm.S.open = vm.S.open === r.key ? null : r.key; vm.S.rm = null; vm.S.err = null; };
    vm.rowAct = function (r, ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        if (r.ghost) { return; }
        if (r.act === 'review' || r.act === 'open') { vm.review(r.a.id, null, r); } else { vm.toggle(r); }
    };

    /* back from the review on the student page: the attempt moves from "Waiting for review" to "Reviewed"; its old row
       leaves the waiting group first */
    function studentReviewed(S) {
        var r = review; review = null;
        var row = S.rows.filter(function (x) { return x.a && x.a.id === +r.attempt_id; })[0];
        if (!row || row.a.status === 'submitted' || !r.row) { return; }
        var o = r.row;
        // the same key as the row it replaces in "Waiting for review", so that row's element stays and collapses
        var ghost = { key: 'a' + row.a.id, ghost: true, out: false, _i: 0, a: { id: row.a.id, status: 'submitted' }, group: 'review', title: o.title || row.title, forW: o.forW || row.forW,
            sub: o.sub || row.sub, st: D.attemptState({ status: 'submitted' }), icon: o.icon || row.icon, ic: 'ta-ic--warn', when: o.when || { b: 'Submitted', s: '' },
            score: o.score || { none: 'dash' }, act: 'review', facts: [], others: [] };
        S.g.review = [ghost].concat(S.g.review);
        var first = S.stu.first, released = row.a.released, outcome = row.a.outcome;
        leave(ghost, function () { S.g.review = S.g.review.filter(function (x) { return x !== ghost; }); },
            outcome === 'passed' ? 'Reviewed · passed' : outcome === 'not_passed' ? 'Reviewed · not passed' : 'Reviewed',
            released ? 'Released to ' + first + ': the score and your notes are on their Questionnaires.' : 'Marked reviewed. ' + first + ' sees the score and notes once you release them.');
    }

    /* ════════ Remove from the student's list (asks first; v1 removed on one click) ════════ */
    vm.rmAsk = function (r) { if (vm.S && !vm.S.busy) { vm.S.rm = r.s.id; vm.S.err = null; } };
    vm.rmKeep = function () { if (vm.S && !vm.S.busy) { vm.S.rm = null; } };
    vm.rmDo = function (r) {
        var S = vm.S;
        if (!S || S.busy || !r.s) { return; }
        S.busy = 'rm'; S.err = null;
        D.remove(r.s.id).then(function (d) {
            S.busy = null;
            if (!D.ok(d)) {
                S.err = { key: r.key, t: D.errorText(d, 'It couldn’t be removed. Nothing has changed: try again in a moment.') };
                ToastService.handledInline();
                return;
            }
            S.rm = null;
            var first = S.stu.first;
            if (r.a) {   // an attempt stays (only its assignment goes): the row stays, without the message
                reloadQuiet(function () { ToastService.success('Removed from ' + first + '’s list', 'Anything ' + first + ' started is kept.', { confetti: false }); });
                return;
            }
            S.open = null;
            r.out = true;
            $timeout(function () {
                S.rows = S.rows.filter(function (x) { return x !== r; });
                regroup(S);
                ToastService.success('Removed from ' + first + '’s list', 'It has gone from their Questionnaires.', { confetti: false });
                reloadQuiet();
            }, reduce && reduce.matches ? 0 : 240);
        });
    };
    function reloadQuiet(then) {
        var S = vm.S;
        if (!S) { if (then) { then(); } return; }
        var club = vm.club;
        D.student(club, S.id).then(function (d) {
            if (vm.S === S && D.ok(d)) {
                D.mem.stu[club + '|' + S.id] = d;
                var open = S.open;
                build(S, d);
                S.open = open && S.rows.some(function (x) { return x.key === open; }) ? open : null;
            }
            if (then) { then(); }
        });
    }

    /* ════════ Remind (C40 POST course_assignments/{id}/remind) ════════ */
    vm.remind = function (r) {
        var S = vm.S, s = r && r.s;
        if (!S || S.busy || !s || !s.open || s.rem.locked) { return; }
        S.busy = 'remind'; S.err = null;
        var first = S.stu.first;
        D.remind(s.id).then(function (d) {
            S.busy = null;
            if (!D.ok(d)) {
                var c = D.code(d), dd = d.data || d;
                if (c === 'TOO_SOON') {
                    s.canRemind = false;
                    s.nextRemind = dd.next_allowed_at || dd.next_remind_at || s.nextRemind;
                    s.remindedAt = dd.reminded_at || s.remindedAt;
                    remindOf(s);
                    S.err = { key: r.key, warn: true, t: (s.remindedAt ? first + ' was reminded ' + C.fDay(s.remindedAt) + '. ' : 'A reminder went this week. ') + (s.nextRemind ? 'You can ask again from ' + C.fDay(s.nextRemind) + '.' : 'You can ask again next week.') };
                } else if (c === 'NO_EMAIL') {
                    S.err = { key: r.key, t: first + ' has no e-mail address we can use, so the reminder couldn’t be sent. It is still on their Questionnaires.' };
                } else if (c === 'NOT_OPEN') {
                    S.err = { key: r.key, t: 'This is no longer open (done or removed), so there’s nothing to remind ' + first + ' about.' };
                    reloadQuiet();
                } else {
                    S.err = { key: r.key, t: D.errorText(d, 'The reminder couldn’t be sent. Try again in a moment.') };
                }
                ToastService.handledInline();
                return;
            }
            s.remindedAt = d.reminded_at || C.now();
            s.nextRemind = d.next_remind_at || C.addDays(C.today(), 7) + ' 00:00:00';
            s.canRemind = false;
            remindOf(s);
            var again = ' You can ask again from ' + C.fDay(s.nextRemind) + '.';
            if (d.emailed === false || d.emails_muted) {
                ToastService.success('Reminder recorded', first + ' has turned off assignment e-mails, so it’s flagged on their Questionnaires only.' + again, { confetti: false });
            } else {
                ToastService.success('Reminder sent', first + ' has an e-mail with the link, and it’s flagged on their Questionnaires.' + again, { confetti: false });
            }
        });
    };

    /* ════════ Set a questionnaire (a dialog; a bottom sheet on phones) ════════ */
    vm.openSet = function (retakeOf) {
        var S = vm.S;
        if (!S || S.state !== 'ready' || vm.dlg) { return; }
        lastFocus = document.activeElement;
        var A = vm.as = {
            step: 'form', anim: '', loading: true, failed: '', courses: [], course: 0, current: S.focusCourse, lessons: [], lessonById: {}, items: [], rows: [], lesson: null,
            qq: '', sel: null, msg: retakeOf ? 'Have another go now we’ve been through it.' : '', due: 'none', other: null, email: true,
            pick: false, pq: '', still: false, lopts: [], err: {}, busy: false, error: '', retake: retakeOf || null, dues: dueOptions(S), confirmMsg: ''
        };
        A.dpOpts = { allowPast: false, min: C.addDays(C.today(), 1) };
        vm.dlg = true;
        var my = ++seq.as;
        var want = retakeOf && retakeOf.courseId ? retakeOf.courseId : S.focusCourse;
        D.courses(vm.club).then(function (d) {
            if (my !== seq.as || vm.as !== A) { return; }
            A.courses = d.success ? d.items.map(function (c) { return { id: +c.id, title: c.title || c.name || 'Course' }; }) : [];
            if (want && !A.courses.some(function (c) { return c.id === want; })) { A.courses.unshift({ id: want, title: 'This student’s course' }); }
            var pickId = want || (A.courses[0] ? A.courses[0].id : 0);
            if (!pickId) { A.loading = false; A.failed = d.success ? 'none' : 'load'; A.failMsg = d.success ? '' : D.errorText(d, 'The club’s courses could not be loaded.'); return; }
            loadCourse(pickId, true);
        });
        $timeout(function () { var el = document.querySelector('.sqn-dlg'); if (el) { el.focus(); } }, 0, false);
    };
    vm.retake = function (r) { if (r && r.a) { vm.openSet({ qid: r.a.qid, courseId: r.a.courseId, attachType: r.a.attachType, attachId: r.a.attachId, timing: r.a.timing }); } };
    vm.setCourse = function () { var A = vm.as; if (A && !A.busy) { loadCourse(+A.course, false); } };
    vm.retryCourse = function () { var A = vm.as; if (A) { if (A.course) { loadCourse(+A.course, false); } else { closeDialog(true); vm.openSet(A.retake); } } };
    function loadCourse(courseId, firstTime) {
        var A = vm.as, my = ++seq.as, S = vm.S;
        A.course = courseId; A.lesson = null; A.qq = ''; A.pick = false; A.err = {}; A.error = '';
        if (!firstTime) { A.sel = null; }
        A.loading = true; A.failed = '';
        $q.all([D.course(courseId, S.id), D.lessons(courseId)]).then(function (res) {
            if (my !== seq.as || vm.as !== A) { return; }
            var d = res[0], l = res[1];
            A.loading = false;
            if (!D.ok(d)) { A.failed = 'load'; A.failMsg = D.errorText(d, 'The course’s questionnaires could not be loaded.'); return; }
            if (+d.current_course_id) { A.current = +d.current_course_id; }
            A.lessons = (l.success ? l.items : []).map(function (x) { return { id: +x.id, t: D.lessonName(x.course_reference, x.title), n: 0, ref: x.course_reference || '', title: x.title || '' }; });
            lessonExample(A);
            A.lessonById = {};
            A.lessons.forEach(function (x) { A.lessonById[x.id] = x; });
            A.items = (d.items || []).filter(function (it) { return it.is_published !== false && it.is_published !== 0; }).map(item);
            A.items.forEach(function (it) {
                if (!it.l) { return; }
                if (!A.lessonById[it.l]) { var x = { id: it.l, t: it.where, n: 0 }; A.lessons.push(x); A.lessonById[it.l] = x; }
                A.lessonById[it.l].n++;
            });
            if (A.retake && firstTime) {
                var R = A.retake;
                var hit = A.items.filter(function (it) { return it.qid === R.qid && (R.attachType === 'lesson' ? it.l === R.attachId : !it.l) && (!R.timing || it.timing === R.timing); })[0]
                    || A.items.filter(function (it) { return it.qid === R.qid; })[0];
                if (hit) { A.sel = hit.key; $timeout(function () { showInDialog(document.getElementById('sqn-opt-' + hit.key)); }, 80, false); }
            }
            relist(A);
        });
    }
    /* scroll the dialog (only the dialog, never the page behind) so a preselected questionnaire is in view */
    function showInDialog(el) {
        var dlg = el && el.closest ? el.closest('.sqn-dlg') : null;
        if (!dlg) { return; }
        var r = el.getBoundingClientRect(), d = dlg.getBoundingClientRect(), below = r.bottom - d.bottom + 16;
        if (below > 0) { dlg.scrollTop += below; }
    }
    function item(it) {
        var first = vm.S.stu.first, l = +it.lesson_id || 0;
        var latest = it.student_latest || null, done = latest && (latest.status === 'submitted' || latest.status === 'reviewed') ? latest : null;
        var where = l ? D.lessonName(it.target && it.target.course_reference, it.lesson_title || (it.target && it.target.title)) : 'The course';
        var mins = +it.time_limit_minutes || +it.minutes || 0;
        var bits = [P(+it.question_count || 0, 'question')];
        if (mins) { bits.push('about ' + mins + ' min'); }
        bits.push(D.scoringWords(it.scoring === 'instant' || !!it.instant_mc_score, it.mc_count));
        if (done) { bits.push(first + ' did it ' + C.fDay(done.submitted_at)); }
        else if (+it.open_assignment_id) { bits.push('already set for ' + first + ', not done yet'); }
        return {
            key: String(it.link_id || (it.questionnaire_id + '-' + l + '-' + it.timing)), qid: +it.questionnaire_id, title: it.title || 'Questionnaire', timing: it.timing === 'post' ? 'post' : 'pre',
            attachedTo: it.attached_to === 'lesson' || l ? 'lesson' : 'course', l: l, where: where, bits: bits, done: done, openId: +it.open_assignment_id || 0,
            pill: (it.timing === 'post' ? 'Post-' : 'Pre-') + (l ? 'lesson' : 'course')
        };
    }
    /* the list: in the whole course, grouped under the course or its lesson unless searching; a lesson narrows it */
    function relist(A) {
        var q = String(A.qq || '').trim().toLowerCase();
        var lesson = A.lesson !== null ? A.lessonById[A.lesson] || null : null;
        var all = A.items.filter(function (it) { return A.lesson === null || it.l === A.lesson; });
        var list = all.filter(function (it) { return !q || it.title.toLowerCase().indexOf(q) > -1 || (it.l && it.where.toLowerCase().indexOf(q) > -1); });
        var grouped = A.lesson === null && !q, last = null;
        A.rows = [];
        list.forEach(function (it) {
            if (grouped && it.where !== last) { last = it.where; A.rows.push({ grp: true, t: it.where, key: 'g-' + it.key }); }
            A.rows.push({ it: it, key: it.key, t: $sce.trustAsHtml(M.hl(it.title, A.qq)), w: !grouped && A.lesson === null && it.l ? $sce.trustAsHtml(M.hl(it.where, A.qq)) : null });
        });
        A.all = all.length;
        var c0 = A.courses.filter(function (c) { return c.id === A.course; })[0];
        A.courseTitle = c0 ? c0.title : 'this course';
        A.searchPh = 'Search questionnaires in ' + (lesson ? lesson.t.split(' ')[0] : A.courseTitle);
        A.hint = (q ? P(list.length, 'match', 'matches') + ' of ' : '') + P(all.length, 'questionnaire') + (A.lesson === null ? ' in the course, before and after its lessons' : ' for this lesson');
        A.none = list.length ? '' : q ? 'No questionnaire ' + (lesson ? 'for ' + lesson.t : 'in ' + A.courseTitle) + ' matches “' + String(A.qq).trim() + '”.' + (lesson ? ' Try the whole course.' : '')
            : 'Nothing is attached to ' + (lesson ? lesson.t : A.courseTitle) + (lesson ? '. Pick another lesson, or the whole course' : '') + '. Questionnaires are attached in Manage Club → Courses.';
        if (A.sel && !list.some(function (it) { return it.key === A.sel; }) && !all.some(function (it) { return it.key === A.sel; })) { A.sel = null; }
        A.lessonName = lesson ? lesson.t : 'Whole course';
        A.lessonSub = A.lessons.length ? (lesson ? 'One lesson · or the whole course' : 'All of it · or pick one of ' + P(A.lessons.length, 'lesson')) : 'This course has no lessons';
    }
    vm.asSearch = function () { if (vm.as) { relist(vm.as); } };
    vm.asPick = function (it) { var A = vm.as; if (!A || A.busy) { return; } A.sel = A.sel === it.key ? null : it.key; A.err = {}; A.error = ''; };
    vm.asDue = function (k) { var A = vm.as; if (!A || A.busy) { return; } A.due = k; A.err.due = false; };
    vm.courseLabel = function (c) { var A = vm.as; return c.title + (A && vm.S && vm.S.stu && c.id === A.current ? ' · ' + vm.S.stu.first + '’s course' : ''); };
    function dueOptions(S) {
        var out = [{ k: 'none', t: 'No due date' }], today = C.today();
        if (S.next && S.next.start) {
            var b = C.addDays(String(S.next.start).slice(0, 10), -1);
            if (b > today) { out.push({ k: b, t: 'Before the next lesson · ' + C.fDay(b) }); }
        }
        var w = C.addDays(today, 7);
        if (!out.some(function (o) { return o.k === w; })) { out.push({ k: w, t: 'In a week · ' + C.fDay(w) }); }
        out.push({ k: 'other', t: 'Another date…' });
        return out;
    }
    /* the lesson picker (.ta-pick + .ta-pickmenu with a search; a bottom sheet on phones) */
    /* the search takes focus only when the picker was opened from the keyboard (a click from Enter / Space has detail 0):
       the mockup draws it unfocused, and on phones focus would pop the keyboard over the sheet */
    vm.pickOpen = function (ev) {
        var A = vm.as;
        if (!A || !A.lessons.length || A.busy || A.loading) { return; }
        A.pick = !A.pick; A.pq = ''; A.still = false;
        var raw = ev && (ev.originalEvent || ev), byKey = !!raw && raw.detail === 0;   // jQuery's event wrapper doesn't copy detail
        if (A.pick) { listLessons(A); if (byKey && !phone()) { $timeout(function () { var el = document.getElementById('sqn-pq'); if (el) { el.focus(); } }, 30, false); } }
    };
    vm.pickClose = function () { if (vm.as) { vm.as.pick = false; } };
    vm.pickType = function () { var A = vm.as; if (A) { A.still = true; listLessons(A); } };
    vm.pickLesson = function (id) {
        var A = vm.as;
        if (!A) { return; }
        A.lesson = id === null || id === undefined ? null : +id; A.pick = false; A.qq = '';
        if (A.sel && !A.items.some(function (it) { return it.key === A.sel && (A.lesson === null || it.l === A.lesson); })) { A.sel = null; }
        relist(A);
    };
    vm.pickKey = function (ev) {
        var A = vm.as;
        if (!A || !A.lopts.length) { return; }
        if (ev.keyCode === 13) { ev.preventDefault(); vm.pickLesson(A.lopts[0].id); }
    };
    /* the lesson search's example, from this course: "Search lessons, e.g. stalling or Ex 5" */
    function lessonExample(A) {
        var withRef = A.lessons.filter(function (x) { return x.ref; }), mid = withRef[Math.floor(withRef.length / 2)] || A.lessons[Math.floor(A.lessons.length / 2)] || null;
        var word = mid ? (String(mid.title).replace(mid.ref, '').split(/[^A-Za-z]+/).filter(function (w) { return w.length > 3; }).sort(function (a, b) { return b.length - a.length; })[0] || '').toLowerCase() : '';
        A.refEg = mid && mid.ref ? mid.ref : '';
        A.pqPh = 'Search lessons' + (word || A.refEg ? ', e.g. ' + [word, A.refEg].filter(Boolean).join(' or ') : '');
    }
    function listLessons(A) {
        var q = String(A.pq || '').trim().toLowerCase();
        var whole = { id: null, t: 'Whole course', s: 'Everything in the course · ' + P(A.items.length, 'questionnaire'), info: false };
        A.lopts = [whole].concat(A.lessons.map(function (x) { return { id: x.id, t: x.t, s: x.n ? P(x.n, 'questionnaire') + ' attached' : 'Nothing attached', info: x.n > 0 }; }))
            .filter(function (o) { return !q || o.t.toLowerCase().indexOf(q) > -1; });
    }
    function phone() { return !!($window.matchMedia && $window.matchMedia('(max-width: 768px)').matches); }

    /* Set it (POST course_assignments, v1's Share). Already done → the retake step first (a fresh, blank retake). */
    vm.asDo = function (asRetake) {
        var A = vm.as, S = vm.S;
        if (!A || A.busy || A.loading || !S) { return; }
        var it = A.items.filter(function (x) { return x.key === A.sel; })[0];
        if (!it) { A.err = { q: true }; stepTo('form'); return; }
        if (A.due === 'other' && !A.other) { A.err = { due: true }; return; }
        if (it.done && !asRetake) { A.confirmMsg = ''; stepTo('retake'); return; }
        var due = A.due === 'none' ? null : A.due === 'other' ? A.other : A.due;
        A.err = {}; A.error = '';
        A.busy = true;
        var body = {
            item_type: 'questionnaire', item_id: it.qid, student_ids: [S.id], message: String(A.msg || '').trim(), due_date: due, send_email: !!A.email,
            attach_type: it.attachedTo, attach_id: it.attachedTo === 'lesson' ? it.l : A.course, timing: it.timing, course_id: A.course
        };
        if (asRetake) { body.confirm = true; }
        D.set(body).then(function (d) {
            A.busy = false;
            if (vm.as !== A) { return; }
            if (!D.ok(d)) { A.error = D.errorText(d, 'It couldn’t be set. Nothing has been sent: try again in a moment.'); ToastService.handledInline(); return; }
            var res = (d.results || []).filter(function (x) { return +x.student_id === S.id; })[0] || (d.results || [])[0] || {};
            if (d.needs_confirm && !asRetake) { A.confirmMsg = 'Setting it again gives ' + S.stu.first + ' a fresh, blank retake; the earlier attempt and its review are kept.'; stepTo('retake'); return; }
            if (res.ok === false && !res.already_set) { A.error = res.message && !/confirm:true/.test(res.message) ? res.message : 'It couldn’t be set for ' + S.stu.first + '.'; ToastService.handledInline(); return; }
            var first = S.stu.first, id = +res.id || 0, already = !!(res.already_set || d.already_set), emailOn = !!A.email;
            closeDialog(false);
            S.f = 'all';
            reloadQuiet(function () {
                // its row: 's<id>', or the retake's own take ('a<attempt>') when the assignment is linked to one
                var row = id ? S.rows.filter(function (x) { return x.s && x.s.id === id; })[0] : null;
                if (row) { S.open = row.key; scrollToRow(row.key); }
                if (already) {
                    ToastService.success('Already set for ' + first, 'It was still open, so nothing new was sent: it’s on their Questionnaires.', { confetti: false });
                } else {
                    ToastService.success((asRetake ? 'Retake set for ' : 'Set for ') + first, res.emailed ? 'They’ve been e-mailed a link.' : emailOn ? 'It’s on their Questionnaires (they’ve turned off assignment e-mails).' : 'It’s on their Questionnaires.', { confetti: false });
                }
            });
        });
    };
    function stepTo(step) {
        var A = vm.as;
        if (!A || A.step === step) { return; }
        A.anim = step === 'retake' ? 'in' : 'back'; A.step = step; A.error = ''; A.pick = false;
        $timeout(function () { var el = document.querySelector('.sqn-dlg'); if (el) { el.focus(); } }, 0, false);
    }
    vm.asBack = function () { if (vm.as && !vm.as.busy) { stepTo('form'); } };
    vm.asSelected = function () { var A = vm.as; return A ? A.items.filter(function (x) { return x.key === A.sel; })[0] || null : null; };
    vm.retakeText = function () {
        var it = vm.asSelected(), S = vm.S, A = vm.as;
        if (!it || !S || !A) { return ''; }
        if (!it.done) { return A.confirmMsg || ''; }
        var a = S.attempts.filter(function (x) { return x.id === +it.done.attempt_id; })[0];
        return S.stu.first + ' submitted “' + it.title + '” on ' + C.fDay(it.done.submitted_at) + (a && a.score ? ' (' + a.score[0] + ' / ' + a.score[1] + ')' : '') + '. Setting it again gives ' + S.stu.first + ' a fresh, blank retake; the earlier attempt and its review are kept.';
    };
    vm.asClose = function () { if (vm.as && vm.as.busy) { return; } closeDialog(false); };
    vm.scrim = function (e) { if (e && e.target === e.currentTarget) { vm.asClose(); } };
    function closeDialog(silent) {
        if (!vm.dlg) { return; }
        vm.dlg = false; vm.as = null; seq.as++;
        if (!silent && lastFocus && lastFocus.focus && document.documentElement.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) { /* gone */ } }
        lastFocus = null;
    }
    function onKey(e) {
        if (e.keyCode !== 27 || !vm.dlg) { return; }
        var A = vm.as;
        if (document.querySelector('.tadp-pop--open')) { return; }   // the date picker closes itself first
        if (A && A.pick) { e.preventDefault(); $scope.$apply(function () { A.pick = false; }); return; }
        if (A && A.busy) { return; }
        e.preventDefault();
        $scope.$apply(function () { if (A && A.step === 'retake') { stepTo('form'); } else { closeDialog(false); } });
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); if (srchTimer) { $timeout.cancel(srchTimer); } closeDialog(true); });
}
