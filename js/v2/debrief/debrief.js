/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2: DEBRIEF (the instructor files the student's training record after a flight).
   Design: mockups/instructor-dashboard/debrief.html (+ debrief-core.js / debrief-core.css), approved 8 Nov 2026.
   Views: views/v2/debrief/*.html · styles: css/v2/debrief.css (dbf-, shared with My Account's book-in "Finish & debrief").
   Tracker: mockups/v2-build/fe-instructor-debrief.md.

   v1 twin: dashboard.manage_user.debriefing (DashboardInstructorBriefController, views/manageuser/debriefing.html). Same
   endpoints, so v1 keeps working unchanged:
     GET  bookings/for_debrief_pls/{sheet} (or bookings/for_debrief/{booking} when there is no sheet)
          → flight, student, the flight's instructor, lesson (+ items, TEM, bullets), lesson_reason / lesson_from,
            competences (the club's grading scale), all_items (the course's objectives), split part 2, import note,
            filer_is_instructor + instructor_options (filing on someone's behalf).
          Read when present (backend-companion.md §4.6, being added): lesson_statuses[], student_courses[],
            existing_record, aircraft{reg,type,model,colour}, flight_minutes, student.temporary, club_title,
            club_courses[{id,title,short_title,lesson_count}] (replaces courses/club), student_courses[].lesson_count;
            competences[].not_applicable (M6, D14). Each falls back to today's reads when absent. lesson_statuses feed
            the pickers only: the "Recent records" strip is always the per-record read (one chip per record).
     GET  courses/club/{club} · lessons/course/{course} · tags/course/{course} · training_records/student/{course}/{user}
          (records, and all_items after a course switch) · bookings/next_lesson/{user}/{course} (the suggestion after a
          course switch: the server's rule) · lessons/{id}, lesson_bullets/lesson/{id}, lesson_tem/lesson/{id},
          lesson_items/lesson/{id} (a lesson switch) · lesson_content_files/lesson/{id} + file/{id} (the brief's files)
          · planes/{id}/club/{club} (the aircraft, until the response carries it)
     POST training_records (v1's payload; tags as {id, flight_tag_id, title, logging_time in minutes})

   Where you go: Back = ?from (records_to_file | student_records | instructed_hours | debriefs), else the page you came
   from when it is an instructor page, else the Instructor Dashboard (decided 8 Nov 2026). Saving goes to the same
   place, or straight to part 2's book-in when "Book in part 2" is chosen. The v2 book-in's "Finish & debrief" hands
   over to the v1 state name; the mapping below lands it here while the switch is on.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_debrief', {
        url: '/manage_user/debriefing/:booking_id/:plane_log_sheet_id/:split_next_id/:split_booking_id?from',
        templateUrl: 'views/v2/debrief/debrief.html',
        controller: 'DebriefV2Controller',
        controllerAs: 'vm',
        params: { booking_id: null, split_next_id: null, split_booking_id: null, plane_log_sheet_id: null, from: null }
    });
    DesignRoutesProvider.map('dashboard.manage_user.debriefing', 'dashboard.v2.instructor_debrief');
}]);

/* ── reads, writes and words (the API goes through the v1 services, so both designs share one access rule) ── */
app.factory('DebriefV2Data', DebriefV2Data);
DebriefV2Data.$inject = ['$q', 'InsCore', 'BookingService', 'CourseService', 'PlaneService'];
function DebriefV2Data($q, InsCore, BookingService, CourseService, PlaneService) {
    var AV = ['#2563eb', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#b45309', '#4f46e5'];
    var X = {
        AV: AV,
        // reads
        load: function (plsId, bookingId) { return +plsId > 0 ? BookingService.GetForForDebriefPls(plsId) : BookingService.GetForForDebrief(bookingId); },
        courses: function (clubId) { return CourseService.GetCoursesByClubId(clubId); },
        lessons: function (courseId) { return CourseService.GetLessonsByCourseId(courseId); },
        tags: function (courseId) { return CourseService.GetTagsByCourseId(courseId); },
        records: function (studentId, courseId) { return CourseService.GetStudentTrainingRecords(studentId, courseId); },
        nextLesson: function (studentId, courseId) { return BookingService.GetNextLesson ? BookingService.GetNextLesson(studentId, courseId) : $q.when({ success: false }); },
        lessonContent: function (id) {
            return $q.all([CourseService.GetLessonById(id), CourseService.GetBulletsByLessonId(id), CourseService.GetTemByLessonId(id), CourseService.GetItemsByLessonId(id)]).then(function (r) {
                var row = (r[0] && r[0].item) || null;
                if (!row) { return null; }
                row = angular.extend({}, row);
                row.bullets = (r[1] && r[1].bullets) || {};
                row.tem = (r[2] && r[2].items) || [];
                row.items = (r[3] && r[3].items) || [];
                return row;
            });
        },
        files: function (lessonId) { return CourseService.GetLessonContentFiles(lessonId); },
        fileData: function (fileId) { return CourseService.GetLessonContentFileData(fileId); },
        plane: function (planeId, clubId) { return PlaneService.GetById(planeId, clubId); },
        save: function (payload) { return CourseService.CreateTrainingRecord(payload); },

        // words
        name: function (p) { return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).replace(/\s+/g, ' ').trim() : ''; },
        avColour: function (id) { return AV[Math.abs(+id || 0) % AV.length]; },
        /* 'HH:MM[:SS]' or 'YYYY-MM-DD HH:MM:SS' → 'HH:MM' (seconds round to the minute, as v1's brakesTime) */
        hhmm: function (v) {
            var s = String(v || ''); if (s.indexOf(' ') > -1) { s = s.split(' ')[1]; }
            var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s); if (!m) { return ''; }
            var h = +m[1], mi = +m[2]; if (+(m[3] || 0) >= 30) { mi++; if (mi === 60) { mi = 0; h = (h + 1) % 24; } }
            return InsCore.p2(h) + ':' + InsCore.p2(mi);
        },
        /* the aircraft's model, as the v2 reads write it: "Cessna 152" from manufacturer + type_name */
        model: function (p) {
            if (!p) { return ''; }
            if (p.model) { return String(p.model); }
            var man = String(p.manufacturer || '').trim(), type = String(p.type_name || p.plane_model || '').trim();
            // the model alone when it already starts with the make as a whole word ("Piper" + "Piper PA-28"), not "Robin" + "Robinson R22"
            if (man && type && (type.toLowerCase() === man.toLowerCase() || type.toLowerCase().indexOf(man.toLowerCase() + ' ') === 0)) { return type; }
            return (man + ' ' + type).trim();
        },
        /* dark text on the light grade colours, white on the dark ones (decided 8 Nov 2026) */
        inkFor: function (hex) {
            var h = String(hex || '').replace('#', '');
            if (h.length === 3) { h = h.split('').map(function (c) { return c + c; }).join(''); }
            if (!/^[0-9a-f]{6}$/i.test(h)) { return '#ffffff'; }
            var v = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }).map(function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
            return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.18 ? '#0f172a' : '#ffffff';
        },
        /* the club's grading scale: [{ id, t, ic, c, vars, na }] — the icon column is faicon (v1 read the wrong name) */
        scale: function (rows) {
            var list = (rows || []).slice().sort(function (a, b) { return (+a.organise || 0) - (+b.organise || 0); });
            var flagged = list.some(function (c) { return c.not_applicable !== undefined && c.not_applicable !== null; });
            return list.map(function (c) {
                var colour = c.colour || c.grade_colour || '', ic = String(c.faicon || c.icon || c.grade_icon || '').replace(/^(fas|far|fa)\s+/, '').replace(/^fa-/, '');
                var t = String(c.title || 'Grade');
                // M6 / D14: the per-grade flag; until it lands, a grade called N/A, Not applicable or Not covered
                var na = flagged ? +c.not_applicable === 1 : /^(n\/?a|not applicable|not covered)$/i.test(t.trim());
                return { id: +c.id, t: t, ic: 'fa-' + (ic || 'minus'), c: colour || null, na: na, vars: colour ? '--g: ' + colour + '; --gi: ' + X.inkFor(colour) : '' };
            });
        },
        bullets: function (list) {
            return (list || []).filter(function (b) { return +b.deleted !== 1; }).map(function (b) { var f = String(b.bullet_format == null ? '0' : b.bullet_format); return { t: b.title || '', h: f !== '0' && f !== '' }; });
        },
        isPdf: function (f) { return !!f && (f.file_type === 'pdf' || f.mime_type === 'application/pdf' || /\.pdf$/i.test(f.original_name || '')); },
        /* a lesson with its content, from for_debrief(_pls).lesson, lessons/{id} + the per-kind reads, or C37's
           bookings/v2/brief/{booking}.lesson (which also carries files metadata): { id, t, o, n, aim, ref, desc, check,
           items[{id,t,k,l}], tem[{a,b,c}], preflight[{t,h}], airex[], debrief[], files[{id,n,k}] | null } */
        lessonOf: function (row, n) {
            var id = +row.id, b = row.bullets || {};
            return {
                id: id, t: row.title || 'Lesson', o: +row.organise || 0, n: n || (+row.organise || 0) + 1,
                aim: row.aim || '', ref: row.course_reference || '', desc: row.description || '',
                check: /check ?point/i.test(row.title || ''),
                items: (row.items || []).filter(function (i) { return +i.deleted !== 1; }).map(function (i) { return { id: +i.id, t: i.title || '', k: i.description || '', l: id }; }),
                tem: (row.tem || []).filter(function (t) { return +t.deleted !== 1; }).map(function (t) { return { a: t.threat || '', b: t.consequence || '', c: t.mitigation || '' }; }),
                preflight: X.bullets(b.preflight), airex: X.bullets(b.airex), debrief: X.bullets(b.debrief),
                files: angular.isArray(row.files) ? X.filesOf(row.files) : null
            };
        },
        filesOf: function (rows) { return (rows || []).map(function (f) { return { id: +f.id, n: f.original_name || f.name || 'File', k: X.isPdf(f) ? 'pdf' : 'img', uri: null, loading: false, err: false }; }); }
    };
    return X;
}

/* ── <dbf-pick f="course|lesson|next|instr"> — picker A (ta-base .ta-pick + .ta-pickmenu): a field-like button that opens
   a list with its own search; a dropdown under the field on desktop, a bottom sheet on phones. The mockup's "smart
   pickers" are this component (the v2 book-in builds the same one). Its state lives on the page (vm.cb, vm.pf[f]). ── */
app.directive('dbfPick', function () {
    return {
        restrict: 'E',
        replace: true,
        scope: true,
        templateUrl: 'views/v2/debrief/_pick.html',
        link: function (scope, el, attrs) {
            scope.f = attrs.f;
            scope.$watch(function () { return scope.vm && scope.vm.pf ? scope.vm.pf[scope.f] : null; }, function (v) { scope.P = v || {}; });
        }
    };
});

/* dbf-plain on the page: ngAnimate off inside it. The motion here is plain CSS (ins-rise, ta-open, ta-pop, ta-sheet on
   arrival); with ngAnimate on, an element carrying a CSS animation lingered after ng-if removed it (it waited for a
   "leave" animation), so a closed dialog, a removed tag or a closed remark box stayed on screen for a moment. */
app.directive('dbfPlain', ['$animate', function ($animate) {
    return { restrict: 'A', link: function (scope, element) { $animate.enabled(element, false); } };
}]);

app.controller('DebriefV2Controller', DebriefV2Controller);
DebriefV2Controller.$inject = ['$scope', '$rootScope', '$state', '$stateParams', '$timeout', '$window', '$sce', '$q', 'InsCore', 'DebriefV2Data', 'ToastService'];
function DebriefV2Controller($scope, $rootScope, $state, $stateParams, $timeout, $window, $sce, $q, InsCore, X, ToastService) {
    var vm = this;
    var plural = InsCore.plural;
    var me = InsCore.me();
    var RING = 2 * Math.PI * 23;
    var CB_TITLE = { course: 'Course', lesson: 'Lesson taught', next: 'Next lesson', instr: 'Instructor who gave the lesson' };
    var CB_PH = { course: 'Search courses', lesson: 'Lesson number or title', next: 'Lesson number or title', instr: 'Search instructors' };
    var courseSeq = 0, lessonSeq = 0, dataVer = 0;

    vm.state = 'loading';         // loading | ready | error
    vm.D = null;                  // the flight: who, what, where (for_debrief)
    vm.S = null;                  // what the instructor has entered
    vm.L = null;                  // the lesson being debriefed (items, TEM, bullets)
    vm.C = null;                  // its course
    vm.courses = [];              // the club's courses [{ id, t, nLessons }]
    vm.lessons = [];              // the course's live lessons, in order [{ id, t, o, n, row }]
    vm.lessonsById = {};
    vm.itemsBy = {};              // lesson id → the lesson's objectives [{ id, t, k, l }]
    vm.allItems = [];             // the course's objectives
    vm.recs = [];                 // the student's records on this course, newest first [{ l, done, date }]
    vm.tagsAll = [];
    vm.files = [];
    vm.cb = { f: null, q: '', hi: 0 };
    vm.cbm = { rows: [], flat: [] };
    vm.pf = {};
    vm.rd = { req: [], opt: [], cks: [], left: [] };
    vm.hm = InsCore.hmMin;
    vm.dayOf = InsCore.fDay;
    vm.lname = lname;
    vm.rmkText = function (id) { return vm.S ? trimmed(vm.S.rmk[id]) : ''; };

    /* ════════ load ════════ */
    vm.reload = load;
    load();

    function load() {
        vm.state = 'loading';
        var pls = +$stateParams.plane_log_sheet_id || 0, bid = +$stateParams.booking_id || 0;
        X.load(pls, bid).then(function (data) {
            if (!data || data.success === false) {
                var code = data ? (data.error || (data.message && data.message.error)) : null;
                vm.origin = originOf(null);
                vm.state = 'error';
                if (code === 'FORBIDDEN' || (data && data.status === 403)) {
                    vm.err = 'forbidden';
                    ToastService.error('No access', 'You can only debrief flights at your own club, or flights you instructed.');
                    vm.origin.go();
                    return;
                }
                vm.err = code === 'NOT_FOUND' ? 'notfound' : 'load';
                return;
            }
            setup(data);
        });
    }

    function setup(data) {
        var sheet = data.log_sheet && +data.log_sheet.id > 0 ? data.log_sheet : null;
        var st = data.student && +data.student.id > 0 ? data.student : null;
        var ins = data.instructor && +data.instructor.id > 0 ? data.instructor : null;
        var seen = {};
        var opts = (data.instructor_options || []).map(function (o) { return { id: +o.id, name: X.name(o), colour: o.colour || null }; })
            .filter(function (o) { if (!(o.id > 0) || seen[o.id]) { return false; } seen[o.id] = true; return true; });
        var ac = data.aircraft || {};
        var minutes = data.flight_minutes != null && data.flight_minutes !== '' ? Math.round(+data.flight_minutes)
            : (sheet ? Math.round(parseFloat(sheet.brakes_times_rounded || sheet.brakes_time || sheet.flight_time || 0) * 60) || 0 : 0);
        var needsBookIn = sheet ? (sheet.needs_book_in !== undefined ? +sheet.needs_book_in === 1 : +sheet.booked_in !== 1) : true;
        var D = vm.D = {
            plsId: sheet ? +sheet.id : 0,
            bookingId: (+$stateParams.booking_id > 0 ? +$stateParams.booking_id : 0) || (+data.booking_id || 0) || (sheet ? +sheet.booking_id || 0 : 0),
            clubId: +data.club_id || (sheet ? +sheet.club_id : 0) || +me.current_club_instructor || 0,
            clubTitle: data.club_title || (data.club && data.club.title) || '',
            hasSheet: !!sheet,
            booked: !!sheet && !needsBookIn,
            behalf: data.filer_is_instructor === false,
            student: st ? { id: +st.id, name: X.name(st), first: st.first_name || InsCore.firstName(X.name(st)), temporary: !!st.temporary } : null,
            instructor: ins ? { id: +ins.id, name: X.name(ins) } : null,
            viewer: { id: +me.id, name: X.name(me) },
            options: opts,
            importNote: data.import_note || null,
            existing: data.existing_record || null,
            staff: !!($rootScope.isToAviateStaff && $rootScope.isToAviateStaff()),
            scale: X.scale(data.competences),
            flight: {
                date: sheet ? sheet.flight_date : '',
                reg: ac.reg || ac.registration || '',
                type: ac.type || ac.plane_type || '',
                model: X.model(ac),
                kind: sheet && +sheet.dual_flight !== 1 ? 'solo' : 'dual',
                off: sheet ? X.hhmm(sheet.brakes_off_rounded || sheet.brakes_off) : '',
                on: sheet ? X.hhmm(sheet.brakes_on_rounded || sheet.brakes_on) : '',
                recOff: sheet ? X.hhmm(sheet.brakes_off) : '',
                recOn: sheet ? X.hhmm(sheet.brakes_on) : '',
                min: minutes,
                fs: sheet ? +sheet.full_stop_landings || 0 : 0,
                tg: sheet ? +sheet.touch_and_go || 0 : 0,
                part: ''
            }
        };
        D.split = splitOf(data, st, D.flight);
        if (D.split) { D.flight.part = 'part 1 of 2'; }
        D.na = D.scale.filter(function (g) { return g.na; })[0] || null;
        D.scaleText = D.scale.map(function (g) { return g.t; }).join(' · ');
        D.optionsById = {};
        D.options.forEach(function (o) { D.optionsById[o.id] = o; });
        if (D.instructor && !D.optionsById[D.instructor.id]) { var fo = { id: D.instructor.id, name: D.instructor.name, colour: null }; D.options.unshift(fo); D.optionsById[fo.id] = fo; }
        D.viewerIsInstr = !!D.optionsById[D.viewer.id];
        if (D.viewerIsInstr && D.optionsById[D.viewer.id].name) { D.viewer.name = D.optionsById[D.viewer.id].name; }
        D.optionsSorted = D.options.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
        D.maxMin = Math.round(D.flight.min / 5) * 5;
        vm.origin = originOf(D);

        vm.S = {
            courseId: +data.course_id || null, lessonId: null, sugg: null, from: data.lesson_from || null, change: false,
            grades: {}, rmk: {}, rmkOpen: null, scope: 'lesson', q: '', open: {},
            remarks: '', tags: [], status: null, next: 'order', nextId: null,
            instr: D.behalf ? (D.instructor ? D.instructor.id : null) : null,
            split: D.split ? 'now' : null,
            brief: false, tab: null, file: 0, dlg: null, showErr: false, flash: null, busy: false, saved: false, leaveOk: false, naUndo: null, kb: null
        };
        var S = vm.S;
        vm.flightCourse = S.courseId;
        if (data.lesson && +data.lesson.id > 0) {
            S.lessonId = +data.lesson.id;
            vm.L = lessonFull(data.lesson);
            S.sugg = suggOf(data.lesson_reason);
            vm.sugId = S.sugg === 'history' ? S.lessonId : null;
        }
        S.change = !S.lessonId;
        setItems(data.all_items || []);
        if (vm.L && !vm.itemsBy[vm.L.id] && vm.L.items.length) { vm.itemsBy[vm.L.id] = vm.L.items; }
        // C36: the student's lesson statuses at this club (every course) → the pickers and the "recent" strip, without
        // the training_records/student read; older responses fall back to that read
        vm.statuses = angular.isArray(data.lesson_statuses) ? data.lesson_statuses.map(function (x) {
            return { l: +x.lesson_id, c: +x.course_id, done: x.state ? x.state === 'signed_off' : +x.completed === 1, date: x.last_flight_date || x.flight_date || x.date || '', flights: +x.flights || 1 };
        }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }) : null;
        vm.studentCourseRows = angular.isArray(data.student_courses) ? data.student_courses.filter(function (x) { return x && typeof x === 'object'; }) : [];
        if (D.existing) {
            var ex = D.existing;
            D.existing = { lessonId: +ex.lesson_id || 0, by: ((ex.instructor_first_name || '') + ' ' + (ex.instructor_last_name || '')).trim(), on: (ex.recorded_at || ex.created_at) ? InsCore.fDay(ex.recorded_at || ex.created_at) : '', behalf: !!ex.entered_on_behalf };
        }

        var waits = [];
        if (S.courseId) { waits.push(courseContext(S.courseId, { first: true, lessonReason: data.lesson_reason })); }
        // the club's courses: for_debrief's club_courses[{id, title, short_title, lesson_count}] when it carries them
        // (in the server's order), else v1's courses/club read
        var pCourses = angular.isArray(data.club_courses) ? $q.when({ items: data.club_courses, ordered: true }) : X.courses(D.clubId);
        waits.push(pCourses.then(function (c) {
            var rows = ((c && c.items) || []).filter(function (x) { return x && +x.deleted !== 1; });
            vm.courses = (c && c.ordered ? rows : sortCourses(rows)).map(function (x) { return { id: +x.id, t: x.title || 'Course', nLessons: x.lesson_count != null ? +x.lesson_count : null }; });
            var sc = data.student_courses;
            vm.studentCourses = angular.isArray(sc) && sc.length ? sc.map(function (x) { return +(x && x.id !== undefined ? x.id : x); }) : (S.courseId ? [S.courseId] : []);
            // a course the student is on that the club list doesn't carry (or its lesson count) comes from student_courses
            vm.studentCourseRows.forEach(function (x) {
                var c = null; vm.courses.forEach(function (k) { if (k.id === +x.id) { c = k; } });
                if (!c) { vm.courses.push({ id: +x.id, t: x.title || 'Course', nLessons: x.lesson_count != null ? +x.lesson_count : null }); }
                else if (c.nLessons == null && x.lesson_count != null) { c.nLessons = +x.lesson_count; }
            });
            ver();
        }));
        if (!D.flight.reg && sheet && +sheet.plane_id > 0) {
            waits.push(X.plane(sheet.plane_id, sheet.club_id || D.clubId).then(function (p) {
                if (p && p.success !== false && p.registration) { D.flight.reg = p.registration; D.flight.type = p.plane_type || ''; D.flight.model = X.model(p); ver(); }
            }));
        }
        if (vm.L) { loadFiles(vm.L.id, vm.L.files); }
        $q.all(waits).then(function () { vm.state = 'ready'; ver(); });
    }

    function splitOf(data, st, flight) {
        var pend = data.pending_split_leg && +data.pending_split_leg.id > 0 ? data.pending_split_leg : null;
        var nextId = +$stateParams.split_next_id || 0;
        if (!pend && !(nextId > 0)) { return null; }
        var who = '';
        if (pend) {
            var picName = ((pend.pic_first_name || '') + ' ' + (pend.pic_last_name || '')).trim();
            var picIsStudent = st && +pend.pic_id === +st.id;
            if (+pend.authorised_solo === 1) { who = 'student solo' + (picName ? ' by ' + (picIsStudent ? (pend.pic_first_name || picName) : picName) : ''); }
            else { who = picName ? 'PIC ' + picName : 'nobody assigned yet'; }
        }
        var sp = { id: pend ? +pend.id : nextId, booking_id: pend ? +pend.booking_id || 0 : (+$stateParams.split_booking_id || 0),
            off: pend ? X.hhmm(pend.brakes_off_rounded || pend.brakes_off) : '', on: pend ? X.hhmm(pend.brakes_on_rounded || pend.brakes_on) : '', who: who };
        var head = [sp.off && sp.on ? sp.off + '–' + sp.on : '', sp.who].filter(Boolean).join(' · ');
        sp.line = (head ? head + '. ' : '') + 'This debrief is for part 1' + (flight.off && flight.on ? ' (' + flight.off + '–' + flight.on + ')' : '') + '.';
        return sp;
    }

    function sortCourses(list) {
        return list.slice().sort(function (a, b) {
            var ao = parseInt(a.display_order, 10), bo = parseInt(b.display_order, 10);
            ao = isNaN(ao) ? 1e6 : ao; bo = isNaN(bo) ? 1e6 : bo;
            return ao - bo || String(a.title || '').localeCompare(String(b.title || ''));
        });
    }

    function setItems(rows) {
        var by = {}, all = [];
        (rows || []).forEach(function (r) {
            if (+r.deleted === 1) { return; }
            var it = { id: +r.id, t: r.title || '', k: r.description || '', l: +r.lesson_id };
            if (!(it.id > 0)) { return; }
            (by[it.l] = by[it.l] || []).push(it); all.push(it);
        });
        vm.itemsBy = by; vm.allItems = all;
    }

    /* lessons + tags + the student's records for a course; after a switch, the server's suggestion too */
    function courseContext(courseId, o) {
        o = o || {};
        var seq = ++courseSeq, S = vm.S, D = vm.D;
        vm.courseLoading = true;
        vm.recsLoading = !!D.student;
        var pLessons = X.lessons(courseId).then(function (r) {
            if (seq !== courseSeq) { return; }
            var rows = ((r && r.items) || []).filter(function (l) { return +l.deleted !== 1; });
            rows.sort(function (a, b) { var ao = a.organise == null ? -1e9 : +a.organise, bo = b.organise == null ? -1e9 : +b.organise; return ao - bo || (+a.id - +b.id); });
            vm.lessons = rows.map(function (l, i) { return { id: +l.id, t: l.title || 'Lesson', o: +l.organise || 0, n: i + 1, row: l }; });
            vm.lessonsById = {};
            vm.lessons.forEach(function (l) { vm.lessonsById[l.id] = l; });
            if (vm.L && vm.lessonsById[vm.L.id]) { vm.L.n = vm.lessonsById[vm.L.id].n; }
        });
        X.tags(courseId).then(function (r) {
            if (seq !== courseSeq) { return; }
            vm.tagsAll = ((r && r.items) || []).filter(function (t) { return +t.deleted !== 1; }).map(function (t) { return { id: +t.id, title: t.title || 'Tag' }; });
            ver();
        });
        // the records read (v1 made it too): the "Recent records" strip, one chip per record, and the course's objectives
        // after a switch. lesson_statuses (C36) only feed the pickers.
        var pRecs = !D.student ? $q.when(null) : X.records(D.student.id, courseId).then(function (r) {
            if (seq !== courseSeq) { return; }
            vm.recsLoading = false;
            var ok = r && r.success !== false;
            if (ok && !o.first && angular.isArray(r.all_items)) { setItems(r.all_items); }
            var dates = {};
            ((ok && r.log_sheets) || []).forEach(function (s) { dates[+s.id] = s.flight_date; });
            var recs = [];
            ((ok && r.training_records) || []).forEach(function (t) {
                if (!(+t.lesson_id > 0) || +t.deleted === 1) { return; }
                recs.push({ l: +t.lesson_id, done: +t.completed === 1, date: t.flight_date || dates[+t.plane_log_sheet_id] || String(t.recorded_at || t.created_at || '').slice(0, 10), id: +t.id || 0 });
            });
            recs.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id - a.id); });
            vm.recs = recs;
        });
        if (!D.student) { vm.recs = []; vm.recsLoading = false; }
        var both = $q.all([pLessons, pRecs]);
        if (o.first) {
            // the first paint waits for the records too (the page skeleton covers it), so the strip never reflows the
            // page; after a course switch the strip shows chip-shaped skeletons while the read loads
            return both.then(function () {
                if (seq !== courseSeq) { return; }
                vm.courseLoading = false;
                if (vm.L && !o.lessonReason) { S.sugg = guessSugg(); vm.sugId = S.sugg === 'history' ? S.lessonId : null; }
                ver();
            });
        }
        var pNext = D.student ? X.nextLesson(D.student.id, courseId) : $q.when(null);
        return $q.all([both, pNext]).then(function (res) {
            if (seq !== courseSeq) { return; }
            vm.courseLoading = false;
            var nx = res[1], lid = nx && nx.success !== false && nx.lesson ? +nx.lesson.id : 0, reason = nx && nx.reason;
            if (!(lid > 0)) {
                var g = clientSuggestion();
                if (g) { lid = g.lid; reason = g.done ? 'after_completed' : 'repeat_incomplete'; }
            }
            if (lid > 0 && vm.lessonsById[lid]) {
                S.from = fromRecords(reason);
                var sg = suggOf(reason) || 'history';
                vm.sugId = sg === 'history' ? lid : null;
                setLesson(lid, sg);
                S.change = false;
            } else {
                S.change = true;
            }
            ver();
        });
    }

    function suggOf(reason) {
        if (!reason) { return null; }
        if (reason === 'booking') { return 'backend'; }
        if (reason === 'first_lesson') { return 'course_start'; }
        if (/^(next_lesson_id|repeat_incomplete|after_completed|course_complete|history|suggested)$/.test(reason)) { return 'history'; }
        return null;
    }
    /* an older response without lesson_reason: say what the records show */
    function guessSugg() {
        if (!vm.L) { return null; }
        if (!vm.recs.length) { return vm.lessons.length && vm.lessons[0].id === vm.L.id ? 'course_start' : 'backend'; }
        var r = vm.recs[0], l = vm.lessonsById[r.l];
        vm.S.from = { title: l ? l.t : 'Lesson', flight_date: r.date, completed: r.done };
        return 'history';
    }
    /* the mockup's rule, only when the server's suggestion can't be read */
    function clientSuggestion() {
        var r = vm.recs[0]; if (!r || !vm.lessonsById[r.l]) { return null; }
        var l = vm.lessonsById[r.l], next = r.done ? lessonAfter(l) || l : l;
        return { lid: next.id, done: r.done };
    }
    function fromRecords(reason) {
        if (!vm.recs.length) { return null; }
        var r = vm.recs[0];
        if (reason === 'after_completed' || reason === 'course_complete') {
            var best = null;
            vm.recs.forEach(function (x) { var l = vm.lessonsById[x.l]; if (x.done && l && (!best || l.n > best.n)) { best = { n: l.n, r: x }; } });
            if (best) { r = best.r; }
        }
        var l = vm.lessonsById[r.l];
        return { title: l ? l.t : 'Lesson', flight_date: r.date, completed: r.done };
    }

    function lessonFull(row, n) { var listed = vm.lessonsById[+row.id]; return X.lessonOf(row, n || (listed ? listed.n : null)); }
    /* a lesson from the course list, shown at once; its TEM and bullets follow */
    function lessonStub(l) {
        var L = lessonFull(angular.extend({}, l.row || {}, { id: l.id, title: l.t, organise: l.o, items: [], tem: [], bullets: {} }), l.n);
        L.items = (vm.itemsBy[l.id] || []).slice();
        return L;
    }
    function setLesson(id, sugg) {
        var S = vm.S, seq = ++lessonSeq, l = vm.lessonsById[id];
        S.lessonId = id; S.sugg = sugg; S.brief = false; S.tab = null; S.file = 0;
        vm.L = l ? lessonStub(l) : null;
        X.lessonContent(id).then(function (row) {
            if (seq !== lessonSeq || !row) { return; }
            var L = lessonFull(row, l ? l.n : null);
            if (!L.items.length && vm.itemsBy[id]) { L.items = vm.itemsBy[id].slice(); }
            if (L.items.length && !vm.itemsBy[id]) { vm.itemsBy[id] = L.items; vm.allItems = vm.allItems.concat(L.items); }
            vm.L = L;
            ver();
        });
        loadFiles(id, null);
        ver();
    }
    function loadFiles(lessonId, known) {
        var seq = lessonSeq;
        vm.files = known || [];
        if (known) { return; }
        X.files(lessonId).then(function (r) {
            if (seq !== lessonSeq) { return; }
            vm.files = X.filesOf((r && r.items) || []);
            ver();
        });
    }
    function fileData(f) {
        if (!f || f.uri || f.loading || f.err) { return; }
        f.loading = true;
        X.fileData(f.id).then(function (r) {
            f.loading = false;
            if (r && r.success && r.data_uri) { f.uri = r.data_uri; f.src = $sce.trustAsResourceUrl(r.data_uri); } else { f.err = true; }
        }, function () { f.loading = false; f.err = true; });
    }

    /* ════════ where Back and Save go ════════ */
    function originOf(D) {
        var from = $stateParams.from, prev = $rootScope.previousState;
        function to(label, name, params) { return { label: label, go: function () { $state.go(name, params || {}); } }; }
        if (from === 'records_to_file') { return to('Records to File', 'dashboard.manage_club.records_to_file'); }
        if (from === 'instructed_hours') { return to('Hours Instructed', 'dashboard.manage_user.instructed_hours'); }
        if (from === 'debriefs' || from === 'debriefing_list') { return to('Debriefs', 'dashboard.manage_user.debriefing_list'); }
        if (from === 'student_records') {
            return { label: 'Student records', go: function () {
                var S = vm.S;
                if (D && D.student && S && S.courseId) { $state.go('dashboard.manage_user.student_records', { club_id: D.clubId, student_id: D.student.id, course_id: S.courseId }); }
                else { $state.go('dashboard.manage_user.student_records'); }
            } };
        }
        var LABELS = {
            'dashboard.manage_user': 'Instructor Dashboard', 'dashboard.v2.instructor_home': 'Instructor Dashboard',
            'dashboard.manage_user.debriefing_list': 'Debriefs', 'dashboard.v2.instructor_debriefs': 'Debriefs',
            'dashboard.manage_user.my_schedule': 'My schedule', 'dashboard.v2.instructor_schedule': 'My schedule',
            'dashboard.manage_user.student_records': 'Student records', 'dashboard.v2.instructor_students': 'Student records',
            'dashboard.manage_user.instructed_hours': 'Hours Instructed', 'dashboard.v2.instructor_hours': 'Hours Instructed',
            'dashboard.manage_club.records_to_file': 'Records to File',
            'dashboard.scheduler_v2': 'Scheduler', 'dashboard.bookings': 'Scheduler'
        };
        if (prev && LABELS[prev.name]) { return to(LABELS[prev.name], prev.name, prev.params); }
        return to('Instructor Dashboard', 'dashboard.manage_user');
    }

    /* ════════ lookups and words ════════ */
    function lname(l) { return l ? 'Lesson ' + l.n + ' · ' + l.t : ''; }
    function lessonAfter(l) {
        if (!l) { return null; }
        for (var k = 0; k < vm.lessons.length; k++) { if (vm.lessons[k].id === l.id) { return vm.lessons[k + 1] || null; } }
        return null;
    }
    function nameOf(id) { var o = vm.D.optionsById[id]; return o ? o.name : (vm.D.viewer.id === id ? vm.D.viewer.name : ''); }
    function courseOf(id) {
        for (var i = 0; i < vm.courses.length; i++) { if (vm.courses[i].id === +id) { return vm.courses[i]; } }
        return id ? { id: +id, t: 'Course', nLessons: null } : null;
    }
    function itemsOfCurrent() { return vm.L ? vm.L.items : []; }
    function isGraded(id) { var v = vm.S.grades[id]; return v !== undefined && v !== null && v !== ''; }
    function gradeOf(id) {
        var v = vm.S.grades[id];
        if (v === undefined || v === null) { return null; }
        for (var i = 0; i < vm.D.scale.length; i++) { if (vm.D.scale[i].id === +v) { return vm.D.scale[i]; } }
        return null;
    }
    vm.gradeOf = gradeOf;
    vm.isGraded = isGraded;
    /* the lesson's status in the student's records: lesson_statuses when the response carries it, else the records */
    function recFor(lid) {
        var list = vm.statuses || vm.recs;
        for (var i = 0; i < list.length; i++) { if (list[i].l === lid) { return list[i]; } }
        return null;
    }
    function hasEntries() {
        var S = vm.S; if (!S) { return false; }
        return Object.keys(S.grades).length > 0 || !!String(S.remarks || '').trim() || S.tags.length > 0 || Object.keys(S.rmk).some(function (k) { return String(S.rmk[k] || '').trim(); });
    }
    function trimmed(s) { return String(s || '').trim(); }
    function nextText() {
        var S = vm.S, L = vm.L; if (!L) { return ''; }
        if (S.next === 'pick' && S.nextId && vm.lessonsById[S.nextId]) { return 'Next: ' + lname(vm.lessonsById[S.nextId]); }
        var nx = lessonAfter(L); return nx ? 'Next: ' + lname(nx) : 'Last lesson on the course';
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    /* the mockup's highlight: the first place the letters appear */
    function hl(text, q) {
        text = String(text || ''); q = String(q || '');
        if (!q) { return esc(text); }
        var i = text.toLowerCase().indexOf(q.toLowerCase());
        return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark class="ta-mark">' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    }
    vm.hlq = function (t) { var q = vm.S && trimmed(vm.S.q).length >= 2 ? trimmed(vm.S.q) : ''; return $sce.trustAsHtml(hl(t, q)); };
    function av(id) {
        var o = vm.D.optionsById[id], name = o ? o.name : nameOf(id);
        return { c: (o && o.colour) || X.avColour(id), ini: InsCore.initials(name).toUpperCase(), tip: name + ' (instructor)' };
    }

    /* ════════ everything derived from the state: one pass per change, the template reads plain values ════════ */
    function ver() { dataVer++; }
    $scope.$watch(function () {
        var S = vm.S; if (!S || !vm.D) { return 'none'; }
        var g = Object.keys(S.grades).map(function (k) { return k + ':' + S.grades[k]; }).join(',');
        var t = S.tags.map(function (x) { return x.id + (x.whole ? 'w' : x.min); }).join(',');
        var rm = Object.keys(S.rmk).filter(function (k) { return trimmed(S.rmk[k]); }).join(',');
        return [dataVer, S.lessonId, S.courseId, S.instr, S.status, S.next, S.nextId, S.split, S.showErr, S.busy, S.scope, S.q, S.change, S.brief, S.tab, S.file,
            S.naUndo ? S.naUndo.length : 0, S.remarks, g, t, rm, JSON.stringify(S.open), vm.courseLoading, vm.recsLoading, vm.state, vm.L ? vm.L.id + ':' + vm.L.items.length : ''].join('|');
    }, refresh);

    function refresh() {
        var D = vm.D, S = vm.S, L = vm.L; if (!D || !S) { return; }
        vm.C = courseOf(S.courseId);
        var items = itemsOfCurrent(), g = items.filter(function (i) { return isGraded(i.id); }).length;
        var anyGrade = Object.keys(S.grades).length > 0, rem = !!trimmed(S.remarks), req = [];

        /* readiness: the rail, the phone strip + bar, the final card */
        if (!D.booked) { req.push({ card: 'booked', t: 'Flight booked in', n: 'Book the flight in', done: false, msg: 'Book the flight in first, then save the record' }); }
        if (D.behalf) { req.push({ card: 'instr', t: 'Instructor', s: S.instr ? nameOf(S.instr) : '', n: 'Choose the instructor', done: !!S.instr, msg: 'Choose the instructor who gave this lesson' }); }
        req.push({ card: 'lesson', t: 'Lesson', s: L ? lname(L) : '', n: 'Choose the lesson', done: !!L, msg: 'Choose the lesson you taught' });
        var objsReq = null;
        if (L) {
            var met = anyGrade || rem || (!items.length && S.status === 'done');
            objsReq = { card: 'objs', t: items.length ? g + ' of ' + items.length + ' graded' : 'Nothing to grade',
                s: items.length ? (!met ? 'Grade one, or write a general remark' : g < items.length ? (!g ? 'A general remark covers it' : 'You can save a partial debrief') : 'Every objective graded') : 'Write a remark or mark it completed',
                n: items.length ? 'Grade the objectives' : 'Write a remark or sign it off', done: met, part: met && items.length > 0 && g < items.length,
                msg: items.length ? 'Grade at least one objective, or write a general remark' : 'This lesson has no objectives: write a general remark or mark it completed' };
            req.push(objsReq);
            req.push({ card: 'status', t: S.status === 'done' ? 'Completed' : S.status === 'notdone' ? 'Not completed' : 'Completed or not', s: S.status === 'done' ? nextText() : '', n: 'Say whether it was completed', done: !!S.status, msg: 'Say whether the lesson was completed' });
        }
        var opt = L ? [{ card: 'remarks', t: 'General remarks', done: rem }, { card: 'tags', t: S.tags.length ? plural(S.tags.length, 'flight tag') : 'Flight tags', done: S.tags.length > 0 }] : [];
        var done = req.filter(function (x) { return x.done; }).length, left = req.filter(function (x) { return !x.done; });
        var all = !left.length, pct = req.length ? done / req.length : 1, ung = items.filter(function (i) { return !isGraded(i.id); });
        function ck(i, isOpt) {
            var cls = isOpt ? 'ta-ck--opt' : '';
            cls += i.part ? ' ta-ck--part' : i.done ? ' ta-ck--done' : (!isOpt && S.showErr ? ' ta-ck--bad' : '');
            return { card: i.card, t: i.t, s: i.s || '', cls: cls, ic: i.part ? 'fa-adjust' : (!i.done && !isOpt && S.showErr ? 'fa-exclamation' : 'fa-check') };
        }
        vm.rd = {
            req: req, opt: opt, done: done, total: req.length, left: left, all: all, next: left[0] || null, C: RING, off: RING * (1 - pct), pct: Math.round(pct * 100),
            cks: req.map(function (i) { return ck(i, false); }).concat(opt.map(function (i) { return ck(i, true); })),
            lead: all ? (ung.length ? plural(ung.length, 'objective') + ' not graded: you can still save' : 'Everything is in') : 'What saving the record needs',
            phone: items.length && L ? { graded: true, g: items.length - ung.length, n: items.length, ung: ung.length, pct: Math.round((items.length - ung.length) / items.length * 100), showNext: !(left[0] && left[0].card === 'objs') }
                : { graded: false, pct: Math.round(pct * 100) }
        };
        vm.objErr = !!(S.showErr && objsReq && !objsReq.done);
        vm.statusErr = !!(S.showErr && L && !S.status);
        vm.lessonErr = !!(S.showErr && !L);

        /* card numbers, and which cards are green */
        var n = 0; vm.num = {};
        if (D.behalf) { vm.num.instr = ++n; }
        vm.num.lesson = ++n;
        if (L) { vm.num.objs = ++n; vm.num.remarks = ++n; vm.num.tags = ++n; vm.num.status = ++n; }
        vm.num.final = ++n;
        function doneOf(id) { var both = req.concat(opt); for (var i = 0; i < both.length; i++) { if (both[i].card === id) { return !!both[i].done; } } return false; }
        vm.cd = { instr: doneOf('instr'), lesson: doneOf('lesson'), objs: items.length ? g === items.length : !!(objsReq && objsReq.done), remarks: rem, tags: S.tags.length > 0, status: !!S.status, final: all };

        /* hero */
        var f = D.flight, ins = D.behalf ? S.instr : (D.instructor ? D.instructor.id : null);
        vm.hero = {
            title: D.student ? D.student.name : 'No student attached yet',
            sub: [f.date ? InsCore.fDayLong(f.date) : '', (f.reg + ' ' + f.model).trim(), f.kind === 'solo' ? 'Solo' : 'Dual', f.part].filter(Boolean).join(' · '),
            facts: [
                { k: 'Flight time', v: InsCore.hmMin(f.min), s: f.off && f.on ? 'Brakes ' + f.off + '–' + f.on : '', tip: f.off ? 'Brakes off to on, to the nearest 5 minutes · recorded ' + f.recOff + '–' + f.recOn : '' },
                { k: 'Landings', v: String(f.fs + f.tg), s: plural(f.fs, 'full stop') + ' · ' + f.tg + ' T&G', tip: plural(f.fs, 'full-stop landing') + ' and ' + plural(f.tg, 'touch and go', 'touch and goes') },
                { k: 'Instructor', v: ins ? nameOf(ins) : 'Not chosen',
                    s: D.behalf ? (S.instr ? (S.instr === D.viewer.id ? 'You gave it' : 'Filed by you, ' + D.viewer.name) : 'Choose below') : (D.instructor && D.instructor.id === D.viewer.id ? 'You' : '') },
                { k: 'Course', v: vm.C ? vm.C.t : 'Not chosen', s: L ? lname(L) : 'Lesson not chosen yet' }
            ]
        };

        /* lesson card: the chip and why this lesson */
        vm.who = D.student ? D.student.first : 'the student';
        vm.chip = !L ? { tone: 'warn', ic: 'fa-exclamation-circle', t: 'Needs choosing' }
            : S.sugg === 'history' ? { tone: 'info', ic: 'fa-history', t: 'Suggested from records' }
            : S.sugg === 'course_start' ? { tone: 'warn', ic: 'fa-info-circle', t: 'First lesson suggested' }
            : S.sugg === 'chosen' ? { tone: 'good', ic: 'fa-check', t: 'Chosen by you' }
            : { tone: 'info', ic: 'fa-calendar-check', t: 'From the booking' };
        vm.why = null;
        if (L && S.sugg === 'history' && S.from && S.from.title) {
            var fr = S.from, frDone = fr.completed === true || +fr.completed === 1;
            vm.why = { kind: 'history', title: fr.title, when: frDone ? 'signed off ' + InsCore.fDay(fr.flight_date) : 'flown ' + InsCore.fDay(fr.flight_date) + ', not signed off yet', what: frDone ? 'next one' : 'lesson again' };
        } else if (L && S.sugg === 'backend') { vm.why = { kind: 'booking' }; }
        vm.firstN = vm.lessons.length ? vm.lessons[0].n : 1;
        if (D.existing) {
            var exL = D.existing.lessonId ? vm.lessonsById[D.existing.lessonId] : null;
            vm.existLine = (D.existing.by ? ' by ' + D.existing.by : '') + (D.existing.on ? ' on ' + D.existing.on : '') + (exL ? ' (' + lname(exL) + ')' : '');
        }

        /* recent records on this course */
        vm.recs5 = vm.recs.slice(0, 5).map(function (r, i) {
            var l = vm.lessonsById[r.l];
            return { cls: 'dbf-hist__i--' + (r.done ? 'done' : 'flown') + (i === 0 ? ' dbf-hist__i--latest' : ''), ic: r.done ? 'fa-check-circle' : 'fa-redo', n: l ? l.n : '?',
                t: (l ? l.t : 'Lesson').replace(/^[A-Z]\d+ - /, ''), tip: (r.done ? 'Signed off' : 'Not signed off') + ' · ' + InsCore.fDay(r.date) + (r.flights > 1 ? ' · ' + r.flights + ' flights' : '') };
        });
        vm.recsMore = vm.recs.length > 5 ? vm.recs.length - 5 : 0;

        vm.brief = briefOf(L);
        objectives();
        vm.tagsAvail = vm.tagsAll.filter(function (t) { return !S.tags.some(function (x) { return x.id === t.id; }); });
        vm.nextL = L ? lessonAfter(L) : null;
        vm.nextPicked = S.nextId && vm.lessonsById[S.nextId] ? vm.lessonsById[S.nextId] : null;

        /* the final card's summary */
        var other = Object.keys(S.grades).length - g;
        vm.sum = {
            instr: D.behalf && S.instr ? nameOf(S.instr) + (S.instr !== D.viewer.id ? ' · awaiting their confirmation' : '') : '',
            objs: L && items.length ? g + ' of ' + items.length + ' graded' + (g < items.length ? ' · ' + (items.length - g) + ' not graded' : '') + (other ? ' · plus ' + plural(other, 'objective') + ' from other lessons' : '') : '',
            mix: mix(vm.allItems.length ? vm.allItems : items),
            remarks: rem ? (trimmed(S.remarks).length > 90 ? trimmed(S.remarks).slice(0, 90) + '…' : trimmed(S.remarks)) : '',
            tags: S.tags.map(function (t) { return t.title + ' ' + (t.whole ? 'whole flight' : InsCore.hmMin(t.min)); }).join(', '),
            status: S.status === 'done' ? 'Completed · ' + nextText() : S.status === 'notdone' ? 'Not completed · Lesson ' + (L ? L.n : '') + ' is suggested again' : ''
        };
        vm.sp = saveParts();
        pickFields();
    }

    function saveParts() {
        var D = vm.D, S = vm.S, dest = vm.origin ? vm.origin.label : 'the Instructor Dashboard';
        if (S.busy) { return { busy: true, t: 'Saving…', s: '' }; }
        if (!D.booked) { return { wait: true, ic: 'fa-plane-arrival', t: 'Book the flight in first', s: 'Then this record can be saved' }; }
        if (D.split && S.split === 'now') { return { ic: 'fa-save', t: 'Save & book in part 2', s: 'Part 2: ' + [D.split.off && D.split.on ? D.split.off + '–' + D.split.on : 'still to book in', D.split.who].filter(Boolean).join(' · ') }; }
        if (D.behalf && S.instr && S.instr !== D.viewer.id) { return { ic: 'fa-save', t: 'Save for ' + nameOf(S.instr), s: 'Shows as awaiting ' + InsCore.firstName(nameOf(S.instr)) + '\'s confirmation · back to ' + dest }; }
        return { ic: 'fa-save', t: 'Save the record', s: (D.student ? D.student.first : 'The student') + ' sees it in My Training · back to ' + dest };
    }

    function mix(pool) {
        var S = vm.S;
        return vm.D.scale.map(function (g) {
            return { id: g.id, t: g.t, vars: g.vars, n: pool.filter(function (i) { return String(S.grades[i.id]) === String(g.id); }).length };
        }).filter(function (x) { return x.n; });
    }

    function briefOf(L) {
        if (!L) { return { parts: [] }; }
        var p = [];
        if (vm.files.length) { p.push({ id: 'files', t: 'Content', ic: 'fa-images', n: vm.files.length, w: plural(vm.files.length, 'file') }); }
        if (L.tem.length) { p.push({ id: 'tem', t: 'TEM', ic: 'fa-shield-alt', n: L.tem.length, w: L.tem.length + ' TEM' }); }
        if (L.preflight.length) { p.push({ id: 'preflight', t: 'Pre-flight', ic: 'fa-clipboard-check', n: L.preflight.length, w: L.preflight.length + ' pre-flight' }); }
        if (L.airex.length) { p.push({ id: 'airex', t: 'Air exercises', ic: 'fa-plane', n: L.airex.length, w: plural(L.airex.length, 'air exercise') }); }
        if (L.debrief.length) { p.push({ id: 'debrief', t: 'Debrief points', ic: 'fa-comments', n: L.debrief.length, w: plural(L.debrief.length, 'debrief point') }); }
        var ids = p.map(function (x) { return x.id; }), S = vm.S;
        var tab = ids.indexOf(S.tab) > -1 ? S.tab : (ids.indexOf('debrief') > -1 ? 'debrief' : ids.indexOf('airex') > -1 ? 'airex' : ids[0]);
        var file = vm.files.length ? vm.files[Math.min(S.file, vm.files.length - 1)] : null;
        if (S.brief && tab === 'files' && file) { fileData(file); }
        return { parts: p, summary: p.map(function (x) { return x.w; }).join(' · '), tab: tab, file: file, fileIdx: Math.min(S.file, Math.max(0, vm.files.length - 1)),
            list: tab === 'preflight' || tab === 'airex' || tab === 'debrief' ? L[tab] : [] };
    }

    function objectives() {
        var S = vm.S, L = vm.L, items = itemsOfCurrent(), q = trimmed(S.q), searching = q.length >= 2, whole = S.scope === 'course';
        var pool = whole || searching ? vm.allItems : items;
        var gp = pool.filter(function (i) { return isGraded(i.id); }).length, donePool = pool.length > 0 && gp === pool.length;
        var ungraded = items.filter(function (i) { return !isGraded(i.id); }).length, gradedHere = items.length - ungraded, na = vm.D.na;
        vm.prog = {
            done: donePool, g: gp, n: pool.length, onCourse: whole && !searching ? ' on the course' : '',
            ic: donePool ? 'fa-check-circle' : gp ? 'fa-adjust' : 'fa-exclamation-triangle', pct: pool.length ? Math.round(gp / pool.length * 100) : 0,
            mix: mix(pool),
            rest: na && !whole && !searching && ungraded && gradedHere ? ungraded : 0,
            undo: na && S.naUndo && !whole && !searching ? S.naUndo.length : 0,
            na: na ? na.t : ''
        };
        vm.objs = {
            empty: !items.length && !whole && !searching,
            mode: !whole && !searching ? 'lesson' : 'groups',
            sub: whole ? 'Whole course · ' + plural(vm.allItems.length, 'objective') : items.length ? plural(items.length, 'objective') + ' on Lesson ' + (L ? L.n : '') + ' · grade what you covered' : 'Lesson ' + (L ? L.n : '') + ' has no objectives',
            groups: [], none: false, q: q
        };
        if (vm.objs.mode === 'groups') {
            var ql = q.toLowerCase(), any = false;
            vm.objs.groups = vm.lessons.map(function (l) {
                var mine = vm.itemsBy[l.id] || [];
                var its = mine.map(function (it, i) { return { it: it, i: i + 1 }; })
                    .filter(function (x) { return !searching || x.it.t.toLowerCase().indexOf(ql) > -1 || l.t.toLowerCase().indexOf(ql) > -1; });
                if (!its.length) { return null; }
                any = true;
                var gi = mine.filter(function (i) { return isGraded(i.id); }).length, isThis = !!(L && l.id === L.id);
                var open = searching || (S.open[l.id] !== undefined ? S.open[l.id] : (isThis || gi > 0));
                return { id: l.id, name: lname(l), isThis: isThis, open: open, count: searching ? plural(its.length, 'match', 'matches') : gi + ' of ' + mine.length, shown: open ? its : [] };
            }).filter(Boolean);
            vm.objs.none = !any;
        }
    }

    /* ════════ pickers ════════ */
    function lessonRowSub(l, f) {
        var S = vm.S, r = recFor(l.id), nItems = (vm.itemsBy[l.id] || []).length;
        if (f === 'next' && l.id === S.lessonId) { return { t: 'This flight\'s lesson', cls: 'info' }; }
        if (f === 'next' && vm.nextL && l.id === vm.nextL.id) { return { t: 'Next in the course', cls: 'info' }; }
        if (f === 'lesson' && vm.sugId && vm.sugId === l.id) { return { t: 'Suggested from records', cls: 'info' }; }
        if (r) { return r.done ? { t: 'Signed off ' + InsCore.fDay(r.date), cls: 'good' } : { t: 'Flown ' + InsCore.fDay(r.date) + ', not signed off', cls: 'warn' }; }
        return { t: plural(nItems, 'objective'), cls: '' };
    }
    function pickFields() {
        var S = vm.S, D = vm.D, L = vm.L, C = vm.C, nx = vm.nextPicked;
        vm.pf.course = { label: 'Course', ic: 'fa-book', title: C ? C.t : '', sub: C && !vm.courseLoading && vm.lessons.length ? plural(vm.lessons.length, 'lesson') : '',
            hint: 'On two courses at once (Night and IMC)? Switch here.', cbTitle: CB_TITLE.course, cbPh: CB_PH.course };
        vm.pf.lesson = { label: 'Lesson taught', req: true, disabled: !C || vm.courseLoading, num: L ? L.n : 0, ic: L ? '' : 'fa-chalkboard-teacher', title: L ? L.t : '',
            sub: L ? 'Lesson ' + L.n + ' · ' + plural(L.items.length, 'objective') : '', ph: vm.courseLoading ? 'Loading the lessons…' : C ? 'Choose the lesson' : 'Choose the course first',
            err: S.showErr && !L && C ? 'Choose the lesson you taught.' : '', hint: L ? 'Switching the lesson clears the grades you have entered.' : '', cbTitle: CB_TITLE.lesson, cbPh: CB_PH.lesson };
        vm.pf.next = { label: 'Next lesson', num: nx ? nx.n : 0, ic: nx ? '' : 'fa-chalkboard-teacher', title: nx ? nx.t : '', sub: nx ? 'Lesson ' + nx.n + ' · ' + plural((vm.itemsBy[nx.id] || []).length, 'objective') : '',
            ph: 'Choose the next lesson', cbTitle: CB_TITLE.next, cbPh: CB_PH.next };
        vm.pf.instr = { label: 'Instructor', req: true, av: S.instr ? av(S.instr) : null, avEmpty: !S.instr, title: S.instr ? nameOf(S.instr) : '', sub: S.instr ? (S.instr === D.viewer.id ? 'You' : 'Instructor') : '',
            first: S.instr ? InsCore.firstName(nameOf(S.instr)) : '',
            err: S.showErr && !S.instr ? 'Choose the instructor before saving: the record is filed under their name.' : '', cbTitle: CB_TITLE.instr, cbPh: CB_PH.instr };
        if (vm.cb.f) { cbModel(); }
    }

    function cbModel() {
        var C = vm.cb, D = vm.D, S = vm.S, q = trimmed(C.q), ql = q.toLowerCase(), groups = [], hint = '', foot = '', empty = null;
        var cur = C.f === 'course' ? S.courseId : C.f === 'lesson' ? S.lessonId : C.f === 'next' ? S.nextId : S.instr;
        if (C.f === 'course') {
            var m = function (c) { return c.t.toLowerCase().indexOf(ql) > -1; };
            var it = function (c) {
                var nl = c.id === S.courseId && vm.lessons.length ? vm.lessons.length : c.nLessons;
                return { id: c.id, ic: 'fa-book', t: c.t, s: (nl != null ? plural(nl, 'lesson') : '') + (c.id === vm.flightCourse ? (nl != null ? ' · ' : '') + 'the flight\'s course' : ''), cls: '' };
            };
            var sc = vm.studentCourses || [];
            var mine = sc.map(function (id) { return courseOf(id); }).filter(function (c) { return c && m(c); });
            var others = vm.courses.filter(function (c) { return sc.indexOf(c.id) < 0 && m(c); });
            if (mine.length) { groups.push({ label: (D.student ? D.student.first + '\'s courses' : 'The student\'s courses'), items: mine.map(it) }); }
            if (others.length) { groups.push({ label: 'Other courses ' + (D.clubTitle ? 'at ' + D.clubTitle : 'at the club'), items: others.map(it) }); }
            if (!groups.length) { empty = { t: 'No course called ‘' + q + '’', s: '' }; }
        } else if (C.f === 'lesson' || C.f === 'next') {
            var ls = vm.lessons.filter(function (l) { return !q || l.t.toLowerCase().indexOf(ql) > -1 || String(l.n) === q || ('lesson ' + l.n).indexOf(ql) === 0; });
            if (!vm.lessons.length) { empty = { t: vm.courseLoading ? 'Loading the lessons…' : 'No lessons on this course yet', s: '' }; }
            else if (ls.length) {
                groups.push({ label: '', items: ls.map(function (l) { var sb = lessonRowSub(l, C.f); return { id: l.id, num: l.n, t: l.t, s: sb.t, cls: sb.cls }; }) });
                foot = q ? plural(ls.length, 'match', 'matches') : plural(ls.length, 'lesson') + ' on ' + (vm.C ? vm.C.t : 'this course');
            } else { empty = { t: 'No lesson matches ‘' + q + '’', s: 'Search by number (10) or title (circuits).' }; }
            if (!q) { hint = 'Type a number or a word from the title'; }
        } else if (C.f === 'instr') {
            var row = function (o, s) { return { id: o.id, person: o.id, t: o.name, s: s || 'Instructor', cls: s ? 'info' : '' }; };
            if (!q) {
                var sug = [];
                if (D.instructor) { sug.push(D.instructor.id); }
                if (D.viewerIsInstr && sug.indexOf(D.viewer.id) < 0) { sug.push(D.viewer.id); }
                groups.push({ label: 'Suggested', items: sug.filter(function (id) { return D.optionsById[id]; }).map(function (id) {
                    return row(D.optionsById[id], id === D.viewer.id ? (D.instructor && id === D.instructor.id ? 'You · on this flight' : 'You') : 'On this flight');
                }) });
                groups.push({ label: 'All instructors · ' + D.options.length, items: D.optionsSorted.filter(function (o) { return sug.indexOf(o.id) < 0; }).map(function (o) { return row(o); }) });
            } else {
                var hits = D.optionsSorted.filter(function (o) { return o.name.toLowerCase().indexOf(ql) > -1; });
                if (hits.length) { groups.push({ label: 'Results', items: hits.map(function (o) { return row(o); }) }); foot = plural(hits.length, 'instructor'); }
                else { empty = { t: 'No instructor called ‘' + q + '’', s: 'Searching all ' + D.options.length + ' instructors ' + (D.clubTitle ? 'at ' + D.clubTitle : 'at the club') + '.' }; }
            }
        }
        var rows = [], flat = [];
        groups.forEach(function (gr, gi) {
            if (!gr.items.length) { return; }
            if (gr.label) { rows.push({ rk: 'g' + gi, grp: gr.label }); }
            gr.items.forEach(function (x) {
                var r = { rk: 'o' + x.id, id: x.id, idx: flat.length, t: x.t, th: $sce.trustAsHtml(hl(x.t, q)), s: x.s, scls: x.cls ? 'ta-pickmenu__s--' + x.cls : '', on: String(x.id) === String(cur),
                    num: x.num || 0, ic: x.num || x.person ? '' : x.ic, av: x.person ? av(x.person) : null };
                rows.push(r); flat.push(r);
            });
        });
        if (C.hi >= flat.length) { C.hi = Math.max(0, flat.length - 1); }
        vm.cbm = { rows: rows, flat: flat, hint: hint, foot: foot, empty: empty };
    }

    vm.cbOpen = function (f) {
        if (vm.cb.f === f) { vm.cbClose(); return; }
        vm.cb = { f: f, q: '', hi: 0 };
        cbModel();
        var cur = f === 'course' ? vm.S.courseId : f === 'lesson' ? vm.S.lessonId : f === 'next' ? vm.S.nextId : vm.S.instr, i = -1;
        vm.cbm.flat.forEach(function (r, k) { if (String(r.id) === String(cur)) { i = k; } });
        vm.cb.hi = i > -1 ? i : 0;
        $timeout(function () {
            var qe = document.getElementById('dbf-cb-q'); if (qe) { try { qe.focus({ preventScroll: true }); } catch (e) { qe.focus(); } }
            var o = document.getElementById('dbf-cb-o-' + vm.cb.hi), l = document.getElementById('dbf-cb-list');
            if (o && l) { l.scrollTop = Math.max(0, o.offsetTop - 60); }
        }, 40);
    };
    vm.cbClose = function () { vm.cb = { f: null, q: '', hi: 0 }; };
    vm.cbQ = function () { vm.cb.hi = 0; cbModel(); };
    vm.cbKey = function (ev) {
        var k = ev.key || '', flat = vm.cbm.flat || [];
        if (k === 'ArrowDown' || k === 'ArrowUp') {
            ev.preventDefault();
            vm.cb.hi = Math.max(0, Math.min(flat.length - 1, vm.cb.hi + (k === 'ArrowDown' ? 1 : -1)));
            $timeout(function () {
                var l = document.getElementById('dbf-cb-list'), o = document.getElementById('dbf-cb-o-' + vm.cb.hi);
                if (l && o) { if (o.offsetTop < l.scrollTop) { l.scrollTop = o.offsetTop - 30; } else if (o.offsetTop + o.offsetHeight > l.scrollTop + l.clientHeight) { l.scrollTop = o.offsetTop + o.offsetHeight - l.clientHeight + 6; } }
            }, 0, false);
        } else if (k === 'Enter') {
            ev.preventDefault();
            var r = flat[vm.cb.hi]; if (r) { vm.cbPick(r); }
        }
    };
    vm.cbPick = function (r) {
        if (!r || r.grp) { return; }
        var f = vm.cb.f, id = +r.id;
        vm.cbClose();
        if (f === 'course') { want('course', id); }
        else if (f === 'lesson') { want('lesson', id); }
        else if (f === 'next') { vm.S.nextId = id; vm.S.next = 'pick'; }
        else { vm.S.instr = id; if (vm.S.showErr) { refresh(); vm.S.showErr = vm.rd.left.length > 0; } }
    };

    /* a course / lesson switch clears what was entered for the old lesson, so it asks first */
    function want(kind, id) {
        var S = vm.S;
        if (kind === 'course' ? id === S.courseId : id === S.lessonId) { return; }
        if (hasEntries()) { S.dlg = { k: 'switch', kind: kind, id: id }; dlgFocus(); return; }
        if (kind === 'course') { doCourse(id); } else { doLesson(id); }
    }
    function resetEntries() {
        var S = vm.S;
        S.grades = {}; S.rmk = {}; S.rmkOpen = null; S.remarks = ''; S.tags = []; S.status = null; S.next = 'order'; S.nextId = null; S.naUndo = null; S.open = {}; S.q = ''; S.scope = 'lesson'; S.kb = null;
    }
    function doLesson(id) {
        resetEntries();
        vm.S.change = false;
        setLesson(id, 'chosen');
    }
    function doCourse(id) {
        var S = vm.S; resetEntries();
        S.courseId = id; S.lessonId = null; S.sugg = null; S.brief = false; S.tab = null; S.from = null; S.change = true;
        vm.L = null; vm.files = []; vm.lessons = []; vm.lessonsById = {}; vm.recs = []; vm.tagsAll = []; vm.sugId = null;
        setItems([]);
        ++lessonSeq;
        courseContext(id, {});
        ver();
    }
    vm.dlgTitle = function () {
        var d = vm.S && vm.S.dlg; if (!d || d.k !== 'switch') { return ''; }
        if (d.kind === 'course') { var c = courseOf(d.id); return c ? c.t : 'Course'; }
        return lname(vm.lessonsById[d.id]);
    };
    vm.dlgBits = function () {
        var S = vm.S, g = Object.keys(S.grades).length, bits = [];
        if (g) { bits.push({ b: plural(g, 'objective'), pre: 'graded ' }); }
        if (trimmed(S.remarks)) { bits.push({ pre: 'written general remarks' }); }
        if (S.tags.length) { bits.push({ b: plural(S.tags.length, 'tag'), pre: 'added ' }); }
        if (!bits.length) { bits.push({ pre: 'written remarks on objectives' }); }
        return bits;
    };
    $scope.$watch(function () { return vm.S && vm.S.dlg ? vm.S.dlg : null; }, function (d) { vm.dlgParts = d && d.k === 'switch' ? vm.dlgBits() : []; });
    vm.switchOk = function () {
        var S = vm.S, d = S.dlg; S.dlg = null; if (!d) { return; }
        var to = d.kind === 'course' ? (courseOf(d.id) || {}).t : lname(vm.lessonsById[d.id]);
        if (d.kind === 'course') { doCourse(d.id); } else { doLesson(d.id); }
        ToastService.success(d.kind === 'course' ? 'Course switched' : 'Lesson switched', 'Switched to ' + to, { confetti: false });
    };
    vm.dlgClose = function () { if (vm.S) { vm.S.dlg = null; } };
    vm.scrim = function (ev) { if (ev && ev.target === ev.currentTarget) { vm.dlgClose(); } };
    function dlgFocus() { $timeout(function () { var b = document.getElementById('dbf-dlg-keep'); if (b) { b.focus(); } }, 30); }

    vm.toggleChange = function () { vm.S.change = !vm.S.change; vm.cbClose(); };

    /* ════════ situation cards ════════ */
    vm.instrSelf = function () { vm.S.instr = vm.D.viewer.id; };
    vm.setSplit = function (v) { vm.S.split = v; };
    vm.bookIn = function () {
        var D = vm.D;
        if (D.plsId > 0) { $state.go('dashboard.my_account.book_in', { id: D.plsId }); }
        else if (D.bookingId > 0) { $state.go('dashboard.my_account.bookout_with_booking', { booking_id: D.bookingId, lesson_id: vm.S.lessonId || null }); }
        else { ToastService.warning('No flight yet', 'This booking has not been flown and booked in yet.'); }
    };
    vm.openRecord = function () {
        var D = vm.D, S = vm.S;
        if (!D.student) { return; }
        $state.go('dashboard.manage_user.student_records', { club_id: D.clubId, student_id: D.student.id, course_id: S.courseId, flight: D.plsId || null });
    };

    /* ════════ the lesson brief ════════ */
    vm.toggleBrief = function () { vm.S.brief = !vm.S.brief; };
    vm.briefTab = function (id) { vm.S.brief = true; vm.S.tab = id; vm.S.file = 0; };
    vm.fileSel = function (i) { vm.S.file = i; };
    vm.openPdf = function (f) {
        if (!f || !f.uri) { return; }
        try {
            var parts = f.uri.split(','), bin = atob(parts[1]), buf = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { buf[i] = bin.charCodeAt(i); }
            var url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
            $window.open(url, '_blank', 'noopener');
            $timeout(function () { URL.revokeObjectURL(url); }, 60000, false);
        } catch (e) { ToastService.error('Could not open the PDF', 'Try again, or read it here.'); }
    };

    /* ════════ objectives ════════ */
    vm.grade = function (it, g) { vm.S.kb = null; setGrade(it.id, g.id); focusObj(it.id); };
    function setGrade(id, gid) { var S = vm.S; S.grades[id] = gid; S.naUndo = null; refresh(); S.showErr = S.showErr && vm.rd.left.length > 0; }
    vm.rmkOpen = function (it) {
        vm.S.rmkOpen = it.id;
        $timeout(function () {
            var t = document.getElementById('dbf-rm-' + it.id); if (!t) { return; }
            try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); }
            var n = (t.value || '').length; try { t.setSelectionRange(n, n); } catch (e2) {}
            see(t);
        }, 30);
    };
    vm.rmkDone = function () { vm.S.rmkOpen = null; };
    vm.setScope = function (v) { vm.S.scope = v; vm.S.q = ''; };
    vm.qClear = function () { vm.S.q = ''; };
    vm.toggleGroup = function (gr) { var o = angular.copy(vm.S.open); o[gr.id] = !gr.open; vm.S.open = o; };
    vm.restNA = function () {
        var S = vm.S, na = vm.D.na; if (!na) { return; }
        var ids = itemsOfCurrent().filter(function (i) { return !isGraded(i.id); }).map(function (i) { return i.id; });
        ids.forEach(function (id) { S.grades[id] = na.id; });
        S.naUndo = ids;
        ToastService.success('Marked ' + na.t, plural(ids.length, 'objective') + ' marked ' + na.t, { confetti: false });
    };
    vm.undoNA = function () { var S = vm.S; (S.naUndo || []).forEach(function (id) { delete S.grades[id]; }); S.naUndo = null; };
    vm.nextTodo = function () {
        var S = vm.S, it = itemsOfCurrent().filter(function (i) { return !isGraded(i.id); })[0];
        if (!it) { return; }
        if (S.scope !== 'lesson' || S.q) { S.scope = 'lesson'; S.q = ''; }
        S.kb = it.id; focusObj(it.id);
    };

    /* ════════ remarks, tags, status ════════ */
    vm.tagAdd = function (t) { vm.S.tags.push({ id: t.id, title: t.title, whole: true, min: Math.max(5, Math.min(vm.D.maxMin, 30)) }); };
    vm.tagDel = function (t) { vm.S.tags = vm.S.tags.filter(function (x) { return x.id !== t.id; }); };
    vm.tagWhole = function (t, w) { t.whole = !!w; };
    vm.tagMin = function (t, d) { t.min = Math.max(5, Math.min(Math.max(5, vm.D.maxMin), t.min + d)); };
    vm.setStatus = function (v) { vm.S.status = v; if (vm.S.showErr) { refresh(); vm.S.showErr = vm.rd.left.length > 0; } };
    vm.setNext = function (v) {
        var S = vm.S; S.next = v;
        if (v === 'pick' && !S.nextId) { $timeout(function () { vm.cbOpen('next'); }, 0); }
    };

    /* ════════ moving around ════════ */
    vm.goTo = function (id) {
        var S = vm.S; S.flash = id; vm.cbClose();
        $timeout(function () { var el = document.getElementById('dbf-c-' + id); if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 30);
        $timeout(function () { if (S.flash === id) { S.flash = null; } }, 900);
    };
    /* keep an element clear of the fixed header and the phone's bottom bar (.dbf-obj carries its own scroll-margin) */
    function see(el) {
        var r = el.getBoundingClientRect(), top = 50 + 8, bar = document.querySelector('.ta-ready__foot');
        var bottom = $window.innerHeight - (bar && getComputedStyle(bar).position === 'fixed' ? bar.offsetHeight : 0) - 8;
        if (r.top < top || r.bottom > bottom) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
    function focusObj(id) {
        $timeout(function () { var el = document.getElementById('dbf-o-' + id); if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } see(el); } }, 20, false);
    }

    /* keyboard: Esc closes the picker / dialog / remark; on a focused objective 1–n grades it and moves on, ↑ ↓ move */
    function onKey(ev) {
        if (vm.state !== 'ready' || !vm.S || vm.S.saved) { return; }
        var S = vm.S, k = ev.key || '';
        if (k === 'Escape' || k === 'Esc' || ev.keyCode === 27) {
            if (vm.cb.f || S.dlg || S.rmkOpen) {
                ev.preventDefault();
                $scope.$apply(function () { if (vm.cb.f) { vm.cbClose(); } else if (S.dlg) { S.dlg = null; } else { S.rmkOpen = null; } });
            }
            return;
        }
        if (vm.cb.f || S.dlg) { return; }
        var t = ev.target; if (!t || !t.closest) { return; }
        var row = t.closest('.dbf-obj');
        if (!row || t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
        var id = +row.getAttribute('data-obj'), rows = Array.prototype.map.call(document.querySelectorAll('.dbf-obj'), function (r) { return +r.getAttribute('data-obj'); }), i = rows.indexOf(id), sc = vm.D.scale;
        if (/^[1-9]$/.test(k) && +k <= sc.length) {
            ev.preventDefault();
            var nx = rows[i + 1] || id;
            $scope.$apply(function () { setGrade(id, sc[+k - 1].id); S.kb = nx; });
            focusObj(nx);
        } else if (k === 'ArrowDown' || k === 'ArrowUp') {
            ev.preventDefault();
            var to = rows[i + (k === 'ArrowDown' ? 1 : -1)];
            if (to) { $scope.$apply(function () { S.kb = to; }); focusObj(to); }
        }
    }
    document.addEventListener('keydown', onKey);

    /* ════════ leaving with unsaved entries asks first ════════ */
    vm.back = function () {
        if (vm.S && !vm.S.saved && hasEntries()) { vm.S.dlg = { k: 'leave', go: function () { vm.origin.go(); } }; dlgFocus(); return; }
        if (vm.S) { vm.S.leaveOk = true; }
        vm.origin.go();
    };
    vm.leave = function () {
        var S = vm.S, d = S.dlg; S.dlg = null; S.leaveOk = true;
        if (d && d.go) { d.go(); }
    };
    $scope.$on('$stateChangeStart', function (ev, to, toParams) {
        var S = vm.S;
        if (ev.defaultPrevented || !S || S.saved || S.leaveOk || !hasEntries()) { return; }
        if (to.name === $state.current.name) { return; }
        ev.preventDefault();
        vm.cbClose();
        var name = to.name, params = angular.copy(toParams);
        S.dlg = { k: 'leave', go: function () { $state.go(name, params); } };
        dlgFocus();
    });
    function onUnload(e) { if (vm.S && !vm.S.saved && !vm.S.leaveOk && hasEntries()) { e.preventDefault(); e.returnValue = ''; return ''; } }
    $window.addEventListener('beforeunload', onUnload);
    $scope.$on('$destroy', function () {
        document.removeEventListener('keydown', onKey);
        $window.removeEventListener('beforeunload', onUnload);
    });

    /* ════════ save ════════ */
    /* what the save did besides filing: future lessons moved on (D12) and tags capped at the flight time */
    function savedExtras(data) {
        var out = '', moved = angular.isArray(data.bookings_moved) ? data.bookings_moved.length : 0;
        if (moved) {
            var nl = data.next_lesson, l = nl && vm.lessonsById[+nl.id];
            out += ' · ' + plural(moved, 'future lesson') + ' moved to ' + (l ? lname(l) : (nl && nl.title) || 'the next lesson');
        }
        var capped = angular.isArray(data.tags_capped) ? data.tags_capped : [];
        if (capped.length) {
            var names = vm.S.tags.filter(function (t) { return capped.some(function (c) { return +(c && c.id !== undefined ? c.id : c) === t.id; }); }).map(function (t) { return t.title.toUpperCase(); });
            out += ' · ' + (names.length ? names.join(', ') : plural(capped.length, 'tag')) + ' capped at the flight time (' + InsCore.hmMin(vm.D.maxMin) + ')';
        }
        return out;
    }
    vm.overrideNo = function () { vm.S.override = null; };
    vm.save = function (override) {
        var D = vm.D, S = vm.S, L = vm.L;
        if (!S || S.busy) { return; }
        S.override = null;
        vm.cbClose();
        refresh();
        if (vm.rd.left.length) {
            S.showErr = true;
            var first = vm.rd.left[0];
            ToastService.warning('Before you save', first.msg);
            vm.goTo(first.card);
            return;
        }
        if (!D.student) {
            ToastService.error('No student', 'This flight has no student attached yet — resolve the student first (Missing Students).');
            return;
        }
        var ids = [];
        Object.keys(S.grades).forEach(function (k) { if (isGraded(k)) { ids.push(+k); } });
        Object.keys(S.rmk).forEach(function (k) { if (trimmed(S.rmk[k]) && ids.indexOf(+k) < 0) { ids.push(+k); } });
        var lessonOfItem = {};
        vm.allItems.forEach(function (i) { lessonOfItem[i.id] = i.l; });
        L.items.forEach(function (i) { lessonOfItem[i.id] = i.l; });
        var payload = {
            club_id: D.clubId,
            items: ids.map(function (id) { return { id: id, lesson_item_id: id, lesson_id: lessonOfItem[id] || null, result: isGraded(id) ? +S.grades[id] : null, remarks: trimmed(S.rmk[id]) }; }),
            general_remarks: S.remarks || '',
            lesson_id: L.id,
            course_id: S.courseId,
            user_id: D.student.id,
            instructor_id: D.behalf ? +S.instr : (D.instructor ? D.instructor.id : D.viewer.id),
            completed_by: D.viewer.id,
            plane_log_sheet_id: D.plsId,
            next_lesson_id: S.status === 'done' && S.next === 'pick' && S.nextId ? S.nextId : null,
            completed: S.status === 'done' ? 1 : 0,
            booking_id: D.bookingId || 0,
            flight_tags: S.tags.map(function (t) { return { id: t.id, flight_tag_id: t.id, title: t.title, logging_time: t.whole ? D.maxMin : t.min }; })
        };
        if (override === true) { payload.confirm_student_override = true; }
        S.busy = true;
        X.save(payload).then(function (data) {
            S.busy = false;
            if (data && data.success) {
                S.saved = true; S.dlg = null;
                var who = D.student.name, more = savedExtras(data);
                if (D.split && S.split === 'now') {
                    ToastService.success('Record saved', 'Record saved for ' + who + '. Now book in part 2' + more, { confetti: false, duration: more ? 6000 : 3000 });
                    $state.go('dashboard.my_account.book_in', { id: D.split.id });
                    return;
                }
                if (D.behalf && S.instr && S.instr !== D.viewer.id) { ToastService.success('Record saved', 'Saved for ' + nameOf(S.instr) + ': it shows as awaiting their confirmation' + more, { confetti: false, duration: more ? 6000 : 3000 }); }
                else { ToastService.success('Record saved', 'Training record saved for ' + who + more, { confetti: false, duration: more ? 6000 : 3000 }); }
                vm.origin.go();
                return;
            }
            var code = data ? (data.error || (data.message && typeof data.message === 'object' ? data.message.error : null)) : null;
            var why = data ? (typeof data.message === 'string' ? data.message : (data.message && data.message.message) || '') : '';
            var raw = (data && data.message && typeof data.message === 'object') ? data.message : ((data && data.data) || data || {});
            if (code === 'STUDENT_NOT_ON_FLIGHT') {
                // D15: the record must be for the flight's student; staff may confirm an override, asked in place
                var fs = raw.flight_student, fsName = fs ? ((fs.first_name || '') + ' ' + (fs.last_name || '')).trim() : '';
                if (raw.can_override) {
                    S.override = { name: fsName };
                    ToastService.handledInline();
                    vm.goTo('final');
                } else {
                    ToastService.error('Not this flight\'s student', why || (fsName ? 'This flight\'s student is ' + fsName + ', so the record can\'t be filed for someone else.' : 'This flight has no student identified yet.'));
                }
            } else if (code === 'COURSE_NOT_IN_CLUB') {
                ToastService.error('Course not at this club', why || 'Choose a course of the flight\'s club, then the lesson.');
                S.change = true; vm.goTo('lesson');
            } else if (code === 'ITEM_NOT_ON_COURSE') {
                ToastService.error('Objective not on this course', why || 'An objective you graded isn\'t on this course any more. Check the grades, then save again.');
                vm.goTo('objs');
            } else if (code === 'RESULT_NOT_ON_SCALE') {
                ToastService.error('Grade not on the club\'s scale', why || 'The club\'s grades have changed. Reload the page and grade again.');
                vm.goTo('objs');
            } else if (code === 'DUPLICATE_TAG' || code === 'TAG_NOT_ON_COURSE') {
                ToastService.error(code === 'DUPLICATE_TAG' ? 'Tag added twice' : 'Tag not on this course', why || (code === 'DUPLICATE_TAG' ? 'Each flight tag can be added once.' : 'A flight tag isn\'t on this course. Remove it and save again.'));
                vm.goTo('tags');
            } else if (code === 'INSTRUCTOR_REQUIRED') {
                if (S.instr === D.viewer.id || !D.behalf) { S.instr = null; }
                D.behalf = true; S.showErr = true;
                ToastService.error('Instructor required', why || 'Choose the instructor who gave this lesson.');
                vm.goTo('instr');
            } else if (code === 'DUPLICATE') {
                ToastService.error('Already filed', why || 'A training record already exists for this student on this flight.');
            } else if (code === 'FORBIDDEN') {
                ToastService.error('No access', why || 'You can only file records for flights at your club, or flights you instructed.');
            } else if (data && (data.status === 0 || code === 'NETWORK_ERROR')) {
                ToastService.error('Not saved', 'We could not reach the server: the flight stays in your debrief list.');
            } else {
                ToastService.error('Save failed', why || 'We could not save the training record. Nothing was changed.');
            }
        }, function () {
            S.busy = false;
            ToastService.error('Not saved', 'We could not reach the server: the flight stays in your debrief list.');
        });
    };
}
