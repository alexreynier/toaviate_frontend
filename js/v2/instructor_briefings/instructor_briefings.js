/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · BRIEFINGS (the lessons you're booked to teach) and the BRIEF for one lesson.
   Design: mockups/instructor-dashboard/briefings.html (approved 9 Nov 2026; "Decisions needed" taken as decided: the
   booking's lesson first, debrief points on the brief, the list runs as far as the backend's window).
   Views: views/v2/instructor_briefings/*.html · CSS: css/v2/instructor-briefings.css (brf-) · tracker:
   mockups/v2-build/fe-instructor-briefings.md.

   Replaces v1 dashboard.manage_user.briefing (/briefing) and dashboard.manage_user.briefing_lesson
   (/briefing/:booking_id/lesson/:lesson_id/:club_id), both DashboardInstructorBriefController, behind the v2 switch.

   Data (be-alex-3e.md C37, landed 21:53):
     GET bookings/v2/briefings          → {window, clubs[], counts{}, briefings[{booking_id, club_id, club_title, start, end,
                                           minutes, description, solo, booked_out, booked_out_at, student, aircraft, course,
                                           lesson{id,number,title,aim,solo,course_id}, lesson_reason, lesson_from}]}
     GET bookings/v2/brief/{booking}    → {booking, student, instructor, aircraft, course{…lesson_count}, lesson{row + items,
                                           tem, files (metadata), bullets{preflight, airex, debrief}, number, lesson_count,
                                           course}, lesson_reason, lesson_from, lesson_statuses[], student_courses[],
                                           club_courses[], pre_lesson_questionnaires[]}
     PUT bookings/set_briefed/{id} {course_id, lesson_id}   Go flying (v1's write, BookingService), then the book-out
   A lesson switched on the page reads as v1 / the v2 Debrief do (DebriefV2Data: lessons/course, lessons/{id} + bullets
   + TEM + items, lesson_content_files + file/{id}, training_records/student for the objective counts, bookings/
   next_lesson for the suggestion) and its pre-lesson questionnaire as v1 meant to (QuestionnaireService
   StudentAttemptsForTarget). The student snapshot is StudentSnapshotService.Get (training_records/snapshot), drawn as the
   mockup's record dialog (a bottom sheet on phones).

   Here: BriefingsV2Data (reads, the write, one helper per domain) · brf-portal (a dialog moved to <body>) · brf-leave
   (a briefed lesson fading and collapsing out of the list) · <brf-snapshot> + BriefingSnapshotV2Controller ·
   BriefingsV2Controller (the list) · BriefingLessonV2Controller (the brief; its course / lesson pickers are the
   Debrief's <dbf-pick>, driven by vm.pf / vm.cb / vm.cbm here).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_briefings', {
        url: '/manage_user/briefing',
        templateUrl: 'views/v2/instructor_briefings/list.html',
        controller: 'BriefingsV2Controller',
        controllerAs: 'vm'
    });
    $stateProvider.state('dashboard.v2.instructor_briefing_lesson', {
        url: '/manage_user/briefing/:booking_id/lesson/:lesson_id/:club_id',
        templateUrl: 'views/v2/instructor_briefings/lesson.html',
        controller: 'BriefingLessonV2Controller',
        controllerAs: 'vm'
    });
    DesignRoutesProvider.map('dashboard.manage_user.briefing', 'dashboard.v2.instructor_briefings');
    DesignRoutesProvider.map('dashboard.manage_user.briefing_lesson', 'dashboard.v2.instructor_briefing_lesson');
}]);


/* ═════ BriefingsV2Data: reads, the write, and the words (raw values never reach the screen) ═════ */
app.factory('BriefingsV2Data', BriefingsV2Data);
BriefingsV2Data.$inject = ['$window', 'InsCore', 'DebriefV2Data', 'BookingService', 'QuestionnaireService', 'StudentSnapshotService'];
function BriefingsV2Data($window, InsCore, DebriefV2Data, BookingService, QuestionnaireService, StudentSnapshotService) {
    var plural = InsCore.plural;
    var JUST_KEY = 'toaviate_brf_just_briefed';   // the lesson Go flying just briefed: the list shows it leaving, once
    var HISTORY = /^(next_lesson_id|repeat_incomplete|after_completed|course_complete)$/;

    var X = {
        // reads
        list: function () { return InsCore.get('bookings/v2/briefings'); },
        brief: function (id) { return InsCore.get('bookings/v2/brief/' + encodeURIComponent(id)); },
        lessons: function (courseId) { return DebriefV2Data.lessons(courseId); },
        lessonContent: function (id) { return DebriefV2Data.lessonContent(id); },
        files: function (lessonId) { return DebriefV2Data.files(lessonId); },
        fileData: function (fileId) { return DebriefV2Data.fileData(fileId); },
        records: function (studentId, courseId) { return DebriefV2Data.records(studentId, courseId); },
        nextLesson: function (studentId, courseId) { return DebriefV2Data.nextLesson(studentId, courseId); },
        attempts: function (clubId, studentId, lessonId) { return QuestionnaireService.StudentAttemptsForTarget(clubId, studentId, 'lesson', lessonId, 'pre'); },
        snapshot: function (studentId, bookingId) { return StudentSnapshotService.Get(studentId, { booking_id: bookingId }); },
        // the write (v1's: one access rule for both designs)
        setBriefed: function (id, body) { return BookingService.SetBookingToBriefed(id, body); },

        // words
        HISTORY: HISTORY,
        code: code, message: message,
        name: name, first: first,
        lshort: lshort, lname: lname,
        whenWord: whenWord, dayHead: dayHead,
        clubShort: clubShort, clubTiny: clubTiny,
        why: why, row: row, lessonLite: lessonLite, quizFromBrief: quizFromBrief, quizFromAttempts: quizFromAttempts,
        remember: remember, justBriefed: justBriefed
    };
    return X;

    /* the backend's refusal code, wherever the service put it */
    function code(res) {
        if (!res) { return null; }
        if (res.error) { return res.error; }
        var m = res.message;
        if (m && typeof m === 'object' && m.error) { return m.error; }
        if (res.data && typeof res.data === 'object' && res.data.error) { return res.data.error; }
        return null;
    }
    function message(res) {
        if (!res) { return ''; }
        var m = res.message;
        if (m && typeof m === 'object') { m = m.message; }
        m = typeof m === 'string' ? m : '';
        return /^\s*</.test(m) || m === 'Request failed' ? '' : m;
    }
    function name(p) { return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).replace(/\s+/g, ' ').trim() : ''; }
    function first(p) { return p ? (p.first_name || InsCore.firstName(name(p))) : ''; }

    /* "A10" from "A10 - Circuits" (the code before the dash), else "Lesson 7" */
    function lshort(L) {
        if (!L) { return ''; }
        var t = String(L.t || L.title || ''), i = t.indexOf(' - ');
        if (i > 0 && i <= 6) { return t.slice(0, i); }
        var n = L.n || L.number;
        return n ? 'Lesson ' + n : t;
    }
    /* "Lesson 10 · A10 - Circuits" */
    function lname(L) { if (!L) { return ''; } var n = L.n || L.number; return (n ? 'Lesson ' + n + ' · ' : '') + (L.t || L.title || 'Lesson'); }
    /* 'Today' · 'Tomorrow' · 'Yesterday' · 'Sat 7 Nov' */
    function whenWord(d) { return InsCore.dayWord(d) || InsCore.fDay(d); }
    /* a day's group header: 'Today · Fri 6 Nov' · 'Tomorrow · Sat 7 Nov' · 'Sun 8 Nov' */
    function dayHead(d) { var w = InsCore.dayWord(d); return (w === 'Today' || w === 'Tomorrow' ? w + ' · ' : '') + InsCore.fDay(d); }
    /* "The Pilot Centre" · "Westfield" (a club's name without "Flying Club") — the row tag, the search sub-line, the switch */
    function clubShort(t) { var s = String(t || '').replace(/\s+(Flying Club|Flying School|Aero Club|Flight Training|Flight Centre)\b.*$/i, '').trim(); return s || String(t || ''); }
    /* "Pilot Centre" · "Westfield" (phones) */
    function clubTiny(t) { var s = clubShort(t).replace(/^The\s+/i, '').trim(); return s || clubShort(t); }

    /* why this lesson — the Debrief's words (the mockup's lessonWhy): { tone, icon, label, why } */
    function why(reason, from, who, courseTitle) {
        var f = from ? { t: from.title, n: from.number } : null, when = from && from.flight_date ? InsCore.fDay(from.flight_date) : '';
        var done = from && (from.completed === true || +from.completed === 1);
        who = who || 'the student';
        switch (reason) {
            case 'booking': return { tone: 'info', icon: 'fa-calendar-check', label: 'From the booking', why: 'Chosen when the lesson was booked' };
            case 'chosen': return { tone: 'good', icon: 'fa-check', label: 'Chosen by you', why: 'Go flying saves it on the booking' };
            case 'after_completed':
            case 'next_lesson_id':
                return { tone: 'info', icon: 'fa-history', label: 'Suggested from records', why: f ? 'Next after ' + lshort(f) + ', ' + (done ? 'signed off ' : 'flown ') + when : 'The next lesson on ' + who + '\'s records' };
            case 'repeat_incomplete': return { tone: 'info', icon: 'fa-history', label: 'Suggested from records', why: f ? lshort(f) + ' again: flown ' + when + ', not signed off' : 'Flown last time, not signed off' };
            case 'course_complete': return { tone: 'info', icon: 'fa-history', label: 'Suggested from records', why: 'Every lesson on ' + (courseTitle || 'the course') + ' is signed off; the last one is shown' };
            case 'first_lesson': return { tone: 'warn', icon: 'fa-info-circle', label: 'First lesson suggested', why: 'No records for ' + who + ' on ' + (courseTitle || 'this course') + ' yet' };
            case 'no_lessons': return { tone: 'warn', icon: 'fa-exclamation-circle', label: 'Needs choosing', why: 'The booking\'s course has no lessons yet' };
            case 'none': return { tone: 'warn', icon: 'fa-exclamation-circle', label: 'Needs choosing', why: 'Choose the lesson: Go flying saves it on the booking' };
            default: return { tone: 'warn', icon: 'fa-exclamation-circle', label: 'Needs choosing', why: 'No course on the booking: choose it when you brief' };
        }
    }

    function lessonLite(l) {
        if (!l || !(+l.id > 0)) { return null; }
        return { id: +l.id, n: l.number != null ? +l.number : null, t: l.title || 'Lesson', aim: l.aim || '', solo: l.solo === true || +l.solo === 1, courseId: +l.course_id || null };
    }

    /* one bookings/v2/briefings row → everything the list shows, worked out once */
    function row(b) {
        var st = b.student || null, ac = InsCore.ac(b.aircraft), co = b.course && +b.course.id > 0 ? { id: +b.course.id, t: b.course.title || 'Course', short: b.course.short_title || '' } : null;
        var L = lessonLite(b.lesson), start = String(b.start || ''), end = String(b.end || ''), date = start.slice(0, 10);
        var who = st ? first(st) : 'the student';
        var w = why(L ? (b.lesson_reason || 'booking') : (co ? 'no_lessons' : 'no_course'), b.lesson_from || null, who, co ? co.t : '');
        var out = b.booked_out === true || +b.booked_out === 1, outAt = b.booked_out_at ? InsCore.fTime(b.booked_out_at) : '';
        var minutes = b.minutes != null ? +b.minutes : InsCore.minutesBetween(start, end);
        var r = {
            id: +b.booking_id || +b.id, clubId: +b.club_id || 0, club: b.club_title || '', clubShort: clubShort(b.club_title), start: start, end: end, date: date,
            t0: InsCore.fTime(start), t1: InsCore.fTime(end), len: InsCore.len(minutes), minutes: minutes,
            note: String(b.description || '').trim(), solo: !!b.solo, out: out, outAt: outAt,
            st: st ? { id: +st.id, name: name(st) || 'Student', first: who, email: st.email || '', phone: st.phone_number || '', temporary: !!st.temporary } : null,
            ac: { reg: ac.reg || '—', type: ac.type || '', model: ac.model || '', colour: ac.colour || '' },
            co: co, L: L, reason: b.lesson_reason || null, from: b.lesson_from || null, why: w
        };
        r.name = r.st ? r.st.name : 'No student';
        r.lessonTxt = L ? (co ? co.t + ' · ' : '') + L.t : co ? co.t + ' · no lessons yet' : 'No course on the booking';
        r.pill = out ? { tone: 'muted', label: 'Booked out' + (outAt ? ' ' + outAt : ''), icon: 'fa-plane-departure' } : { tone: w.tone, label: w.label, icon: w.icon };
        r.go = out ? 'Open' : L ? 'Brief' : 'Choose';
        r.goBtn = out ? 'Open the brief' : L ? 'Brief ' + lshort(L) : 'Choose the lesson';
        r.goIc = out ? 'fa-book-open' : L ? 'fa-chalkboard-teacher' : 'fa-book';
        r.aimT = L ? lname(L) : (co ? co.t + ' has no lessons yet' : 'No course on this booking');
        r.aimS = L ? L.aim : 'Choose the course and lesson when you brief: Go flying saves them on the booking.';
        r.whyIc = out ? 'fa-plane-departure' : w.icon;
        r.whyT = out ? 'Booked out' + (outAt ? ' at ' + outAt : '') + ' without a brief. It stays here until the flight is debriefed.' : w.why;
        r.acLine = [ac.reg, ac.model, r.club].filter(Boolean).join(' · ');
        r.hay = (L ? L.t : '') + ' ' + (co ? co.t : '');
        return r;
    }

    /* the pre-lesson questionnaires → [{ key, attemptId, title, done, sub }] */
    function quizFromBrief(rows, who) {
        return (rows || []).map(function (q) {
            var a = q.attempt || null;
            var done = !!a && (a.done === true || a.status === 'submitted' || a.status === 'reviewed');
            return quizRow(q.questionnaire_id + ':' + (a ? a.id : 0), a ? +a.id : 0, q.title, done, a ? +a.time_spent_seconds || 0 : 0, !!a && (!!a.reviewed_at || a.status === 'reviewed'), !a, who, !done && notStarted(a));
        });
    }
    function quizFromAttempts(items, who) {
        return (items || []).map(function (a) {
            var done = a.status === 'submitted' || a.status === 'reviewed';
            return quizRow('a:' + a.id, +a.id || 0, a.questionnaire_title || a.title, done, +a.time_spent_seconds || 0, a.status === 'reviewed' || !!a.reviewed_at, false, who, !done && notStarted(a));
        });
    }
    function quizTime(s) { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + 'm ' + InsCore.p2(s % 60) + 's'; }
    /* an attempt set but not opened yet (a granted retake): C37 attempt.started === false (10 Nov); an older reply or v1's
       attempts read: status 'opened' with no opened_at (Questionnaires::is_started's rule) */
    function notStarted(a) {
        if (!a) { return false; }
        if (a.started === false) { return true; }
        if (a.started === true) { return false; }
        return a.status === 'opened' && !a.opened_at;
    }
    function quizRow(key, attemptId, title, done, secs, reviewed, noAttempt, who, set) {
        var sub = done ? 'Took ' + quizTime(secs) + (reviewed ? ' · you\'ve reviewed it' : '')
            : noAttempt || set ? 'Not started yet: ' + who + ' can do it before the lesson'
            : 'Started, ' + quizTime(secs) + ' so far: ' + who + ' can finish it before the lesson';
        return { key: key, attemptId: attemptId, title: title || 'Questionnaire', done: !!done, sub: sub, pill: done ? 'Completed' : set ? 'Set · not started' : 'Not yet done' };
    }

    /* Go flying succeeded: remember the lesson (as a briefings row), so the list shows it leaving once */
    function remember(rowLike, who) {
        try { $window.sessionStorage.setItem(JUST_KEY, JSON.stringify({ id: +rowLike.booking_id, at: Date.now(), first: who || '', row: rowLike })); } catch (e) {}
    }
    function justBriefed() {
        var v = null;
        try { v = JSON.parse($window.sessionStorage.getItem(JUST_KEY) || 'null'); $window.sessionStorage.removeItem(JUST_KEY); } catch (e) { v = null; }
        return v && v.id > 0 && Date.now() - (+v.at || 0) < 30 * 60 * 1000 ? v : null;
    }
}


/* brf-portal on a dialog's scrim: moved to <body> (clear of the page's stacking), removed with its scope. Put it on a
   template's root inside an always-present host — never on an ng-if element (its end marker would stay behind). */
app.directive('brfPortal', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            $animate.enabled(el, false);
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
}]);

/* brf-leave="expr": when it turns true, the element fades and collapses (~220 ms, css/v2/instructor-briefings.css) */
app.directive('brfLeave', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            scope.$watch(attrs.brfLeave, function (v) {
                if (!v) { return; }
                var e = el[0];
                e.style.maxHeight = e.offsetHeight + 'px';
                void e.offsetHeight;
                e.classList.add('brf-leaving');
                ($window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () { e.style.maxHeight = '0px'; });
            });
        }
    };
}]);


/* ═════ <brf-snapshot of="{ studentId, bookingId, name, club, reg, type, model, colour }" on-close="…">
   The student snapshot as the mockup's record dialog (a bottom sheet on phones): contact, this booking, the course and
   where they are on it, other courses, recent records with remarks that expand. Read-only. ═════ */
app.directive('brfSnapshot', function () {
    return {
        restrict: 'E',
        scope: { of: '=', onClose: '&' },
        templateUrl: 'views/v2/instructor_briefings/snapshot.html',
        controller: 'BriefingSnapshotV2Controller',
        controllerAs: 'sx',
        bindToController: true
    };
});

app.controller('BriefingSnapshotV2Controller', BriefingSnapshotV2Controller);
BriefingSnapshotV2Controller.$inject = ['$scope', '$timeout', '$document', '$state', 'InsCore', 'BriefingsV2Data', 'DebriefV2Data'];
function BriefingSnapshotV2Controller($scope, $timeout, $document, $state, InsCore, X, DebriefV2Data) {
    var sx = this, plural = InsCore.plural, opener = document.activeElement;
    var o = sx.of || {};
    sx.name = o.name || 'Student snapshot';
    sx.sub = o.club || '';
    sx.state = 'loading';
    sx.open = {};

    X.snapshot(o.studentId, o.bookingId).then(function (d) {
        if (!d || d.success === false) {
            sx.state = 'error';
            sx.err = X.code(d) === 'FORBIDDEN' || (d && d.status === 403) ? 'You can see the snapshot of students at your club, or on a lesson you’re booked to teach.' : (X.message(d) || 'The snapshot didn’t load. Check your connection and try again.');
            return;
        }
        build(d);
    });

    function build(d) {
        var st = d.student || {}, b = d.booking || null, me = InsCore.myId();
        sx.name = X.name(st) || sx.name;
        var member = st.member === true || +st.member === 1;
        var mem = member ? (st.membership_name || 'Member') + (st.membership_ends ? ' until ' + InsCore.fDate(st.membership_ends) : '') : (st.membership_label || 'Not a current member');
        sx.sub = [mem, o.club || ''].filter(Boolean).join(' · ') + (+st.imported_user === 1 ? ' · Imported account, not yet converted' : '');
        sx.phone = st.phone_number || '';
        sx.email = st.email || '';
        sx.bk = b ? {
            when: InsCore.fDayLong(b.start) + ' · ' + InsCore.fTime(b.start) + '–' + InsCore.fTime(b.end),
            reg: b.registration || o.reg || '', type: b.plane_type || o.type || '', model: o.model || '', colour: o.colour || '',
            instr: b.instructor ? b.instructor + (+b.instructor_id === me ? ' (you)' : '') : '',
            note: String(b.description || '').trim()
        } : null;
        var focusId = +d.focus_course_id || 0, focus = null, others = [];
        (d.courses || []).forEach(function (c) {
            var x = {
                id: +c.id, t: c.title || 'Course', records: +c.records || 0, hm: InsCore.hm(c.hours), last: c.last_flight ? InsCore.fDate(c.last_flight) : '—',
                total: +c.items_total || 0, graded: +c.items_graded || 0, pct: Math.round(+c.progress_pct || 0), awaiting: +c.awaiting_confirmation || 0
            };
            x.recordsT = plural(x.records, 'record');
            if (focusId > 0 && x.id === focusId) { focus = x; } else { others.push(x); }
        });
        sx.known = +d.known_course_id > 0;
        sx.focus = focus;
        sx.others = others;
        sx.next = d.next_lesson ? X.lname({ t: d.next_lesson.title, n: d.next_lesson.organise != null ? +d.next_lesson.organise + 1 : null }) : '';
        sx.clubId = +d.club_id || 0;
        sx.studentId = +st.id || o.studentId;
        sx.first = st.first_name || InsCore.firstName(sx.name);
        sx.club = X.clubShort(o.club) || 'this club';
        sx.recent = (d.recent_records || []).map(function (r) {
            // recent_records: completed, lesson_number, instructor_id / _colour, plane_type, aircraft_colour (landed after C37);
            // an older reply without them shows the reference · title, no signed-off pill, a colour from the name
            var who = String(r.instructor || '').trim(), imported = +r.import_note_only === 1;
            var lesson = imported && !r.lesson_title ? 'Import note only'
                : r.lesson_title && r.lesson_number != null ? X.lname({ t: r.lesson_title, n: +r.lesson_number })
                : ([r.lesson_reference, r.lesson_title].filter(Boolean).join(' · ') || 'No lesson recorded');
            var signed = imported || r.completed === undefined || r.completed === null ? null : +r.completed === 1;
            var avc = r.instructor_colour || DebriefV2Data.avColour(+r.instructor_id > 0 ? +r.instructor_id : hash(who));
            return {
                id: +r.id, date: r.flight_date ? InsCore.fDate(r.flight_date) : 'No flight date', reg: r.registration || '', hm: +r.brakes_times_rounded > 0 ? InsCore.hm(r.brakes_times_rounded) : '',
                type: r.plane_type || '', acColour: r.aircraft_colour || '', signed: signed,
                awaiting: +r.awaiting_instructor_confirmation === 1, imported: imported, lesson: lesson, course: !focus ? (r.course_title || '') : '',
                who: who, av: who ? { ini: InsCore.initials(who).toUpperCase(), c: avc } : null,
                graded: plural(+r.items_graded || 0, 'objective') + ' graded', rmk: String(r.general_remarks || '').trim()
            };
        });
        sx.state = 'ready';
    }
    function hash(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }

    sx.toggle = function (r) { sx.open[r.id] = !sx.open[r.id]; };
    sx.record = function (courseId) {
        var p = { club_id: sx.clubId || null, student_id: sx.studentId, course_id: courseId || null };
        sx.close();
        $state.go('dashboard.manage_user.student_records', p);
    };
    sx.close = function () { sx.onClose(); };
    sx.scrim = function (e) { if (e && e.target === e.currentTarget) { sx.close(); } };

    function onKey(e) { if (e.keyCode === 27) { e.preventDefault(); $scope.$apply(sx.close); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        $document.off('keydown', onKey);
        if (opener && opener.focus && document.documentElement.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); } }
    });
    $timeout(function () { var el = document.querySelector('.brf-snapdlg'); if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }, 0, false);
}


/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The list: every lesson you're booked to teach that isn't briefed, by day (C37's 60 days), with the smart search,
   the club switch, the chips and rows that open in place.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.controller('BriefingsV2Controller', BriefingsV2Controller);
BriefingsV2Controller.$inject = ['$scope', '$state', '$timeout', '$window', '$sce', 'InsCore', 'BriefingsV2Data', 'TaComboMatch', 'ToastService'];
function BriefingsV2Controller($scope, $state, $timeout, $window, $sce, InsCore, X, M, ToastService) {
    var vm = this, plural = InsCore.plural;
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var CHIPS = [['all', 'All'], ['today', 'Today'], ['week', 'Next 7 days'], ['choose', 'Needs choosing']];
    var IDLE_HINT = 'Your students\' lessons, ready to brief before you fly';

    vm.load = 'loading';
    vm.skel = [1, 2, 3, 4];
    vm.hint = IDLE_HINT;
    vm.S = { club: 0, f: 'all', q: '', chip: 'all', open: null };
    vm.all = [];
    vm.live = [];
    vm.items = [];
    vm.rows = [];
    vm.gen = 0;
    vm.leavingNow = false;
    vm.cbQ = ''; vm.cbValue = null; vm.cbSum = null; vm.cbVer = 0; vm.cbClearable = false;
    vm.snapFor = null;

    vm.reload = load;
    load();

    function load() {
        vm.load = 'loading';
        X.list().then(function (d) {
            if (!d || d.success === false) {
                var c = X.code(d);
                vm.load = 'error';
                vm.loadMsg = c === 'FORBIDDEN' ? 'You need a live instructor membership of a club to see its lessons.' : (d && (d.status === 0 || c === 'NETWORK_ERROR') ? 'We couldn’t reach the server. Check your connection and try again.' : 'Something went wrong on our side. Try again in a moment.');
                return;
            }
            vm.all = (d.briefings || []).map(X.row).filter(function (r) { return r.id > 0; });
            vm.all.sort(byStart);
            vm.load = 'ready';
            rebuild();
            leaving();
        });
    }
    function byStart(a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id; }

    /* ── what's in view: the mockup's live → inScope → searched → chip ── */
    function live() { return vm.all.filter(function (r) { return !r.gone; }); }
    function clubsIn(list) {
        var seen = {}, out = [];
        list.forEach(function (r) { if (!seen[r.clubId]) { seen[r.clubId] = { id: r.clubId, title: r.club, n: 0 }; out.push(seen[r.clubId]); } seen[r.clubId].n++; });
        return out;
    }
    function inScope(list) { var c = vm.S.club; return list.filter(function (r) { return !c || r.clubId === c; }); }
    function regsOf(list) { var seen = {}, out = []; list.forEach(function (r) { if (r.ac.reg !== '—' && !seen[r.ac.reg]) { seen[r.ac.reg] = 1; out.push(r.ac.reg); } }); return out; }
    function acScore(r, q) { return M.score(r.ac.reg, r.ac.type + ' ' + r.ac.model, q); }
    function nameScore(text, q) { var t = M.toks(q), tot = 0; if (!t.length) { return 0; } for (var i = 0; i < t.length; i++) { if (!M.wordHit(text, t[i])) { return 0; } tot += 60; } return tot; }
    /* one or two letters are nearly always the end of a registration: then only aircraft match (BA → G-SHBA, not Lucy Barnes) */
    function shortReg(q, list) { return M.norm(q).length < 3 && list.some(function (r) { return acScore(r, q) >= 70; }); }
    function searched(list) {
        var S = vm.S, q = String(S.q || '').trim();
        if (S.f.indexOf('st:') === 0) { return list.filter(function (r) { return r.st && String(r.st.id) === S.f.slice(3); }); }
        if (S.f.indexOf('ac:') === 0) { return list.filter(function (r) { return r.ac.reg === S.f.slice(3); }); }
        if (!q) { return list; }
        if (shortReg(q, list)) { return list.filter(function (r) { return acScore(r, q) >= 70; }); }
        return list.filter(function (r) { return acScore(r, q) || nameScore(r.name, q) || nameScore(r.hay, q); });
    }
    function chipHit(c, r) {
        var g = InsCore.daysBetween(InsCore.today(), r.date);
        return c === 'all' || (c === 'today' && g <= 0) || (c === 'week' && g < 7) || (c === 'choose' && !r.L);
    }
    function homeClub(list) {
        var n = {}, best = 0, top = 0;
        list.forEach(function (r) { n[r.clubId] = (n[r.clubId] || 0) + 1; if (n[r.clubId] > top) { top = n[r.clubId]; best = r.clubId; } });
        return best;
    }

    function rebuild() {
        var S = vm.S, all = live(), now = InsCore.now();
        vm.live = all;
        vm.clubs = clubsIn(all);
        if (S.club && !vm.clubs.some(function (c) { return c.id === S.club; })) { S.club = 0; }
        vm.scopes = vm.clubs.length > 1 ? [{ id: 0, label: 'All clubs', tiny: 'All', n: all.length }].concat(vm.clubs.map(function (c) { return { id: c.id, label: X.clubShort(c.title), tiny: X.clubTiny(c.title), n: c.n }; })) : [];
        var home = homeClub(all), multi = vm.clubs.length > 1;

        // the page bar's hint: the count, how far ahead, and the next lesson
        if (all.length) {
            var next = all.filter(function (r) { return !r.out && r.start >= now; })[0];
            var span = InsCore.daysBetween(InsCore.today(), all[all.length - 1].date) + 1;
            var nw = next ? X.whenWord(next.date) : '';
            vm.hint = plural(all.length, 'lesson') + ' to brief' + (span > 1 ? ' over the next ' + span + ' days' : ' today')
                + (next ? ' · next ' + (nw === 'Today' ? 'at' : nw + ',') + ' ' + next.t0 + ' with ' + next.name : '');
        } else {
            vm.hint = IDLE_HINT;
        }

        var scope = inScope(all), pre = searched(scope), shown = pre.filter(function (r) { return chipHit(S.chip, r); });
        vm.scope = scope;
        vm.chips = CHIPS.map(function (c) { return { id: c[0], t: c[1], n: pre.filter(function (r) { return chipHit(c[0], r); }).length }; }).filter(function (c) { return c.id === 'all' || c.n > 0; });
        if (!vm.chips.some(function (c) { return c.id === S.chip; })) { S.chip = 'all'; shown = pre; }

        // a row leaving (just briefed) keeps its place until it has gone
        var rows = shown.concat(vm.all.filter(function (r) { return r.gone; })).sort(byStart);
        vm.rows = shown;
        vm.any = rows.length > 0;
        var items = [], i = 0, day = null, grp = null;
        rows.forEach(function (r) {
            r.clubTag = multi && !S.club && r.clubId !== home;
            if (r.date !== day) {
                day = r.date;
                grp = { grp: true, k: 'd' + day, d: day, head: X.dayHead(day), n: 0, i: Math.min(i++, 7) };
                items.push(grp);
            }
            if (!r.gone) { grp.n++; }
            items.push({ k: 'r' + r.id, r: r, i: Math.min(i++, 7) });
        });
        items.forEach(function (it) { if (it.grp) { it.count = plural(it.n, 'lesson'); it.allGone = it.n === 0; } });
        vm.items = items;

        // the scope line under the bar
        var st = S.f.indexOf('st:') === 0 ? (scope.filter(function (r) { return r.st && String(r.st.id) === S.f.slice(3); })[0] || null) : null;
        var ac = S.f.indexOf('ac:') === 0 ? S.f.slice(3) : null, q = String(S.q || '').trim(), esc = M.esc;
        vm.q = q;
        vm.scopeLn = st || ac || q ? $sce.trustAsHtml((st ? '<b>' + esc(st.name) + '</b>' : ac ? 'Lessons on <b>' + esc(ac) + '</b>' : '<b>' + plural(pre.length, 'lesson') + '</b> matching “' + esc(q) + '”') + ' · ' + plural(pre.length, 'lesson')) : null;

        // the search box while closed: who / what is picked, or the count
        var v = null, sum = null;
        if (st) { v = { av: { member: true, size: 'md', title: 'Student' }, name: st.name }; }   // the mockup's 32px memberLead
        else if (ac) { var a0 = scope.filter(function (r) { return r.ac.reg === ac; })[0]; v = { ac: { reg: ac, type: a0 ? a0.ac.type : '', colour: a0 ? a0.ac.colour : '', title: ac + (a0 && a0.ac.model ? ' · ' + a0.ac.model : '') } }; }
        else if (!q) { sum = { b: plural(scope.length, 'lesson'), post: ' to brief' }; }
        if (!angular.equals(v, vm.cbValue)) { vm.cbValue = v; }
        if (!angular.equals(sum, vm.cbSum)) { vm.cbSum = sum; }
        vm.cbClearable = !!(st || ac || q);
        placeholder();
    }
    function placeholder() {
        var regs = regsOf(vm.scope || []), hint = regs.filter(function (r) { return /BA$/.test(r); })[0] || regs[0] || 'G-BMTJ';
        vm.cbPh = phoneMq && phoneMq.matches ? 'Student or aircraft, e.g. ' + hint.slice(-2) : 'Search students or aircraft: ' + hint.slice(-2) + ' finds ' + hint;
    }
    if (phoneMq) {
        var onMq = function () { $scope.$applyAsync(placeholder); };
        if (phoneMq.addEventListener) { phoneMq.addEventListener('change', onMq); } else if (phoneMq.addListener) { phoneMq.addListener(onMq); }
        $scope.$on('$destroy', function () { if (phoneMq.removeEventListener) { phoneMq.removeEventListener('change', onMq); } else if (phoneMq.removeListener) { phoneMq.removeListener(onMq); } });
    }

    /* ── the smart search (<ta-combo>): Every lesson, Students, Aircraft ── */
    vm.cbSource = function (q) {
        var S = vm.S, list = inScope(live()), regs = regsOf(list);
        q = String(q || '').trim();
        var only = q && shortReg(q, list), multi = clubsIn(live()).length > 1;
        var people = {}, order = [];
        list.forEach(function (r) { if (!r.st) { return; } var k = r.st.id; if (!people[k]) { people[k] = []; order.push(k); } people[k].push(r); });
        var nextWord = function (r) { return X.whenWord(r.date).toLowerCase().replace(/^(mon|tue|wed|thu|fri|sat|sun)/, function (x) { return x[0].toUpperCase() + x.slice(1); }); };
        var pRows = only ? [] : order.map(function (k) { return { k: k, bs: people[k], sc: q ? nameScore(people[k][0].name, q) : 1 }; })
            .filter(function (p) { return p.sc; })
            .sort(function (a, b) { return (b.sc - a.sc) || (a.bs[0].start < b.bs[0].start ? -1 : 1); })
            .map(function (p) {
                var r = p.bs[0];
                return { key: 'st:' + p.k, av: { member: true, title: 'Student' }, t: r.name, s: (r.co ? r.co.t : 'No course') + (multi ? ' · ' + r.clubShort : ''), r: plural(p.bs.length, 'lesson'), rs: 'next ' + nextWord(r) + ' ' + r.t0, on: S.f === 'st:' + p.k };
            });
        var aRows = regs.map(function (reg) { var bs = list.filter(function (r) { return r.ac.reg === reg; }); return { reg: reg, bs: bs, sc: q ? acScore(bs[0], q) : 1 }; })
            .filter(function (a) { return a.sc; })
            .sort(function (a, b) { return (b.sc - a.sc) || (a.bs[0].start < b.bs[0].start ? -1 : 1); })
            .map(function (a) {
                var r = a.bs[0];
                return { key: 'ac:' + a.reg, ac: r.ac.colour || null, t: a.reg, s: [r.ac.model, r.clubShort].filter(Boolean).join(' · '), r: plural(a.bs.length, 'lesson'), rs: 'next ' + X.whenWord(r.date) + ' ' + r.t0, on: S.f === 'ac:' + a.reg };
            });
        var groups = [];
        if (!q) { groups.push({ rows: [{ key: 'all', lead: 'fa-list', t: 'Every lesson', s: plural(order.length, 'student') + ' · ' + plural(regs.length, 'aircraft', 'aircraft'), r: plural(list.length, 'lesson'), on: S.f === 'all', noHl: true }] }); }
        if (only) { groups.push({ label: 'Aircraft', right: plural(aRows.length, 'match', 'matches'), rows: aRows }); }
        else {
            groups.push({ label: 'Students', right: q ? plural(pRows.length, 'match', 'matches') : plural(pRows.length, 'student'), rows: pRows });
            groups.push({ label: 'Aircraft', right: q ? plural(aRows.length, 'match', 'matches') : plural(aRows.length, 'aircraft', 'aircraft'), rows: aRows });
        }
        return { groups: groups, empty: { t: 'Nothing matches “' + q + '”', s: 'Try a student\'s name, or the last two letters of a registration.' } };
    };
    vm.cbPick = function (key) { var S = vm.S; S.f = key || 'all'; S.q = ''; vm.cbQ = ''; S.open = null; vm.gen++; rebuild(); };
    // a click away (or Tab) keeps what was typed as the list's filter, as in the mockup (the scope line offers Show every lesson)
    vm.cbLeave = function () {};
    vm.cbClear = function () { var S = vm.S; S.f = 'all'; S.q = ''; vm.cbQ = ''; S.open = null; vm.gen++; rebuild(); };
    // typing filters the list as you go (the mockup's cbq): a typed search replaces a picked student / aircraft. Rows that
    // stay keep their place (no re-rise per keystroke); rows that come back rise in as new
    $scope.$watch(function () { return vm.cbQ; }, function (v, old) {
        if (v === old || (v || '') === (vm.S.q || '')) { return; }
        var S = vm.S; S.q = v || ''; if (S.q) { S.f = 'all'; } S.open = null; rebuild();
    });

    /* ── the club switch, chips, show every lesson ── */
    vm.setClub = function (id) { if (vm.S.club === id) { return; } vm.S.club = id; vm.S.open = null; vm.gen++; rebuild(); vm.cbVer++; };
    vm.setChip = function (id) { if (vm.S.chip === id) { return; } vm.S.chip = id; vm.S.open = null; vm.gen++; rebuild(); };
    vm.reset = function () { angular.extend(vm.S, { f: 'all', q: '', chip: 'all', club: 0, open: null }); vm.cbQ = ''; vm.gen++; rebuild(); };

    /* ── rows ── */
    vm.cls = function (it) {
        if (it.grp) { return 'ta-group ins-rise'; }
        var r = it.r;
        return 'ta-row ins-q-row ins-rise' + (vm.S.open === r.id ? ' ta-row--open' : '') + (r.out ? ' brf-row--done' : '');
    };
    vm.leaves = function (it) { return it.grp ? !!(it.allGone && vm.leavingNow) : !!(it.r && it.r.leaving); };
    vm.toggle = function (r) { if (r.gone) { return; } vm.S.open = vm.S.open === r.id ? null : r.id; };
    vm.brief = function (r, ev) {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        if (!r || r.gone) { return; }
        $state.go('dashboard.manage_user.briefing_lesson', { booking_id: r.id, lesson_id: r.L ? r.L.id : 0, club_id: r.clubId });
    };
    vm.snap = function (r, ev) {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        if (!r || !r.st || r.gone) { return; }
        vm.snapFor = { studentId: r.st.id, bookingId: r.id, name: r.name, club: r.club, reg: r.ac.reg, type: r.ac.type, model: r.ac.model, colour: r.ac.colour };
    };
    vm.snapClose = function () { vm.snapFor = null; };
    /* Enter / Space on the row's own buttons (role=button spans inside the row button, as in the mockup) */
    vm.key = function (ev, fn, r) { var k = ev.key; if (k === 'Enter' || k === ' ' || k === 'Spacebar') { fn(r, ev); } };
    vm.toScheduler = function () { $state.go('dashboard.add_booking'); };

    /* ── a lesson Go flying just briefed: it fades and collapses out of the list, then the toast ── */
    function leaving() {
        var j = X.justBriefed();
        if (!j || vm.all.some(function (r) { return r.id === j.id; })) { return; }
        var who = j.first || 'The student';
        function toast() { ToastService.success('Briefed', who + ' is briefed: the lesson has left this list', { confetti: false }); }
        var r = j.row ? X.row(j.row) : null;
        if (!r || !r.id || (reduce && reduce.matches)) { toast(); return; }
        r.gone = true;
        r.leaving = false;
        vm.all.push(r);
        rebuild();
        $timeout(function () { r.leaving = true; vm.leavingNow = true; }, 520);
        $timeout(function () { vm.leavingNow = false; vm.all = vm.all.filter(function (x) { return x !== r; }); rebuild(); toast(); }, 520 + 240);
    }
}


/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The brief for one lesson: hero, the lesson card (with the course / lesson pickers), the pre-lesson questionnaire,
   one card per part of the brief, and Go flying (the rail on desktop, the bottom bar on phones).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.controller('BriefingLessonV2Controller', BriefingLessonV2Controller);
BriefingLessonV2Controller.$inject = ['$scope', '$state', '$stateParams', '$timeout', '$window', '$sce', '$q', 'InsCore', 'BriefingsV2Data', 'DebriefV2Data', 'ToastService'];
function BriefingLessonV2Controller($scope, $state, $stateParams, $timeout, $window, $sce, $q, InsCore, X, D, ToastService) {
    var vm = this, plural = InsCore.plural;
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var contentSeq = 0, courseLoads = {};

    vm.state = 'loading';
    vm.cb = { f: null, q: '', hi: 0 };
    vm.cbm = { rows: [], flat: [] };
    vm.pf = {};
    vm.S = null;
    vm.L = null;
    vm.files = [];
    vm.quiz = [];
    vm.snapFor = null;
    vm.skel3 = [1, 2, 3];

    vm.reload = load;
    load();

    function load() {
        vm.state = 'loading';
        X.brief($stateParams.booking_id).then(function (d) {
            if (!d || d.success === false) {
                var c = X.code(d);
                vm.err = c === 'NOT_FOUND' || c === 'VALIDATION_ERROR' || (d && d.status === 404) ? 'notfound' : (c === 'FORBIDDEN' || (d && d.status === 403)) ? 'forbidden' : 'load';
                vm.errMsg = vm.err === 'forbidden' ? (X.message(d) || 'Only the booking’s instructor or the club’s instructors can open this brief.') : '';
                vm.state = 'error';
                return;
            }
            setup(d);
        });
    }

    function lessonFrom(row, n, total) {
        var L = D.lessonOf(row, n || (+row.number || null));
        L.solo = row.solo === true || +row.solo === 1;
        L.courseId = +row.course_id || (row.course && +row.course.id) || null;
        L.total = total || +row.lesson_count || null;
        return L;
    }

    function setup(d) {
        var b = d.booking || {}, start = String(b.start || ''), end = String(b.end || '');
        vm.B = {
            id: +b.id, clubId: +b.club_id || +$stateParams.club_id || 0, club: b.club_title || '', start: start, end: end, date: start.slice(0, 10),
            t0: InsCore.fTime(start), t1: InsCore.fTime(end), len: InsCore.len(b.minutes != null ? +b.minutes : InsCore.minutesBetween(start, end)),
            solo: !!b.solo, briefed: !!b.briefed, out: !!b.booked_out, outAt: b.booked_out_at ? InsCore.fTime(b.booked_out_at) : '',
            waiting: !!b.waiting_list, pending: b.pending_by || null, note: String(b.description || '').trim()
        };
        var st = d.student;
        vm.st = st && +st.id > 0 ? { id: +st.id, name: X.name(st) || 'Student', first: X.first(st), email: st.email || '', phone: st.phone_number || '' } : null;
        vm.who = vm.st ? vm.st.first : 'the student';
        var ac = InsCore.ac(d.aircraft);
        vm.ac = { reg: ac.reg || '—', type: ac.type || '', model: ac.model || '', colour: ac.colour || '' };
        vm.raw = d;

        // the club's courses (display order), then any the booking or the student is on that the club list lacks
        vm.courses = (d.club_courses || []).map(function (c) { return { id: +c.id, t: c.title || 'Course', n: c.lesson_count != null ? +c.lesson_count : null }; });
        var addCourse = function (c) { if (c && +c.id > 0 && !courseOf(+c.id, true)) { vm.courses.push({ id: +c.id, t: c.title || 'Course', n: c.lesson_count != null ? +c.lesson_count : null }); } };
        addCourse(d.course);
        (d.student_courses || []).forEach(addCourse);
        vm.mine = (d.student_courses || []).filter(function (c) { return +c.records > 0; }).map(function (c) { return +c.id; });
        vm.statuses = {};
        (d.lesson_statuses || []).forEach(function (s) { vm.statuses[+s.lesson_id] = { done: s.state === 'signed_off', date: s.last_flight_date || '' }; });
        vm.lessonsBy = {}; vm.itemsN = {}; vm.sugg = {};

        var L0 = d.lesson && +d.lesson.id > 0 ? lessonFrom(d.lesson, null, d.lesson.lesson_count) : null;
        var cid = L0 && L0.courseId ? L0.courseId : (+b.course_id || (d.course && +d.course.id) || null);
        var c0 = cid ? courseOf(cid, true) : null;
        vm.S = {
            cid: cid, reason: L0 ? (d.lesson_reason || 'booking') : (d.lesson_reason === 'no_lessons' || (c0 && c0.n === 0) ? 'no_lessons' : cid ? 'none' : 'no_course'),
            from: d.lesson_from || null, change: false, err: false, file: 0, saving: false
        };
        vm.L = L0;
        vm.files = L0 && L0.files ? L0.files : [];
        if (L0 && (X.HISTORY.test(vm.S.reason) || vm.S.reason === 'first_lesson')) { vm.sugg[cid] = L0.id; }
        vm.quiz = X.quizFromBrief(d.pre_lesson_questionnaires, vm.who);

        // a lesson named in the URL that isn't the brief's (v1 shows the URL's lesson): show that one
        var want = +$stateParams.lesson_id || 0;
        if (want > 0 && (!L0 || want !== L0.id)) {
            X.lessonContent(want).then(function (row) {
                if (row && +row.id > 0) {
                    vm.S.cid = +row.course_id || vm.S.cid; vm.S.reason = 'chosen'; vm.S.from = null;
                    vm.L = lessonFrom(row, null, null);
                    vm.files = []; vm.quiz = [];
                    loadFiles(vm.L.id, ++contentSeq);
                    loadQuiz(vm.L.id, contentSeq);
                    ensureCourse(vm.S.cid).then(function () { numberL(); derive(); });
                }
                ready();
            });
            return;
        }
        ready();
    }
    function ready() {
        vm.state = 'ready';
        if (!vm.L && vm.S.cid) { ensureCourse(vm.S.cid); }
        derive();
    }

    /* ── lookups ── */
    function courseOf(id, strict) {
        for (var i = 0; i < (vm.courses || []).length; i++) { if (vm.courses[i].id === +id) { return vm.courses[i]; } }
        return id && !strict ? { id: +id, t: 'Course', n: null } : null;
    }
    function lessonsOf(cid) { return vm.lessonsBy[cid] || null; }
    function nLessons(cid) { var ls = lessonsOf(cid), c = courseOf(cid, true); return ls ? ls.length : (c && c.n != null ? c.n : null); }
    /* the lesson's place and the course's size, once the course's lessons are known */
    function numberL() {
        var L = vm.L, ls = vm.S ? lessonsOf(vm.S.cid) : null;
        if (!L || !ls) { return; }
        ls.forEach(function (l) { if (l.id === L.id) { L.n = l.n; } });
        L.total = ls.length;
    }

    /* the course's lessons (+ the objective counts and the suggestion, for the picker's status lines) */
    function ensureCourse(cid) {
        if (!cid) { return $q.when(); }
        if (courseLoads[cid]) { return courseLoads[cid]; }
        var st = vm.st;
        var pL = X.lessons(cid).then(function (r) {
            var rows = ((r && r.items) || []).filter(function (l) { return +l.deleted !== 1; });
            rows.sort(function (a, b) { var ao = a.organise == null ? -1e9 : +a.organise, bo = b.organise == null ? -1e9 : +b.organise; return ao - bo || (+a.id - +b.id); });
            vm.lessonsBy[cid] = rows.map(function (l, i) { return { id: +l.id, t: l.title || 'Lesson', o: +l.organise || 0, n: i + 1, row: l }; });
            var c = courseOf(cid, true); if (c) { c.n = vm.lessonsBy[cid].length; }
            if (cid === vm.S.cid) { numberL(); }
            derive();
        });
        var pI = st ? X.records(st.id, cid).then(function (r) {
            ((r && r.success !== false && r.all_items) || []).forEach(function (it) { if (+it.deleted === 1) { return; } var l = +it.lesson_id; vm.itemsN[l] = (vm.itemsN[l] || 0) + 1; });
            derive();
        }) : $q.when();
        var pS = st && vm.sugg[cid] === undefined ? X.nextLesson(st.id, cid).then(function (r) {
            if (vm.sugg[cid] === undefined) { vm.sugg[cid] = r && r.success !== false && r.lesson && +r.lesson.id > 0 ? +r.lesson.id : null; }
            derive();
        }) : $q.when();
        courseLoads[cid] = $q.all([pL, pI, pS]);
        return courseLoads[cid];
    }

    /* a lesson chosen on the page: shown at once from the course list, its content follows */
    function setLesson(l) {
        var seq = ++contentSeq, cid = vm.S.cid, ls = lessonsOf(cid) || [];
        var stub = lessonFrom(angular.extend({}, l.row || {}, { id: l.id, title: l.t, organise: l.o, items: [], tem: [], bullets: {}, files: null }), l.n, ls.length || null);
        stub.courseId = stub.courseId || cid;
        stub.loading = true;
        vm.L = stub; vm.files = []; vm.quiz = []; vm.S.file = 0;
        X.lessonContent(l.id).then(function (row) {
            if (seq !== contentSeq) { return; }
            if (!row) { vm.L.loading = false; vm.L.failed = true; derive(); return; }
            var L = lessonFrom(row, l.n, ls.length || null);
            L.courseId = L.courseId || cid;
            vm.L = L;
            derive();
        });
        loadFiles(l.id, seq);
        loadQuiz(l.id, seq);
        derive();
    }
    function loadFiles(lessonId, seq) {
        X.files(lessonId).then(function (r) {
            if (seq !== contentSeq) { return; }
            vm.files = D.filesOf((r && r.items) || []);
            derive();
        });
    }
    function loadQuiz(lessonId, seq) {
        if (!vm.st || !vm.B.clubId) { return; }
        X.attempts(vm.B.clubId, vm.st.id, lessonId).then(function (r) {
            if (seq !== contentSeq) { return; }
            vm.quiz = X.quizFromAttempts(r && r.success !== false ? r.items : [], vm.who);
            derive();
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

    /* ════════ everything the template shows, from the state: one pass per change ════════ */
    function derive() {
        var S = vm.S; if (!S || !vm.B) { return; }
        var L = vm.L, C = S.cid ? courseOf(S.cid) : null, B = vm.B, nL = S.cid ? nLessons(S.cid) : null;
        vm.C = C;
        var w = vm.W = X.why(L ? S.reason : (S.reason === 'no_lessons' || (C && nL === 0) ? 'no_lessons' : C ? 'none' : 'no_course'), S.from, vm.who, C ? C.t : '');
        var short = L ? X.lshort(L) : '', ww = X.whenWord(B.date);

        // hero
        var total = L ? (L.total || nL) : null;
        vm.H = {
            badge: L ? (L.n || '') : '',
            title: L ? L.t : 'Choose the lesson',
            sub: L ? [C ? C.t : '', L.n ? 'Lesson ' + L.n + (total ? ' of ' + total : '') : ''].filter(Boolean).join(' · ') : C ? C.t + ' · no lesson chosen yet' : 'This booking has no course yet',
            facts: [
                { k: 'Student', v: vm.st ? vm.st.name : 'No student', s: C ? C.t : 'No course' },
                { k: 'Booked', v: B.t0 + '–' + B.t1, s: ww + (ww.length < 9 ? ' · ' + InsCore.fDay(B.date) : '') + ' · ' + B.len },
                { k: 'Aircraft', v: vm.ac.reg, s: [vm.ac.model, B.solo ? 'Solo' : 'Dual'].filter(Boolean).join(' · ') },
                { k: 'Lesson', v: L ? short : 'Not chosen', s: w.label }
            ]
        };

        // the lesson card
        vm.pickOpen = !L || S.change;
        vm.card = {
            title: L ? 'The lesson' : 'Which lesson are you briefing?',
            sub: L ? w.why : C ? (nL === 0 ? C.t + ' has no lessons yet: choose another course' : 'Choose the lesson on ' + C.t + ': Go flying saves it on the booking') : 'The booking has no course. Choose the course and the lesson: Go flying saves both on the booking.',
            objs: L ? (L.items.length || 'None') : '',
            check: !!(L && L.check),
            checkTxt: L && L.solo ? 'A solo lesson: the book-out asks for the supervising instructor and solo checks.' : 'Signed off by the Head of Training\'s rules for check points.'
        };
        vm.notes = [];
        if (B.waiting) { vm.notes.push({ k: 'wait', tone: 'warn', ic: 'fa-hourglass-half', b: 'On the waiting list.', t: 'The book-out opens once the booking has its place.' }); }
        else if (B.pending) { vm.notes.push({ k: 'pend', tone: 'warn', ic: 'fa-hourglass-half', b: 'Waiting for approval.', t: 'The book-out opens once the ' + (B.pending === 'club' ? 'club approves' : 'instructor approves') + ' the booking.' }); }
        if (B.briefed) { vm.notes.push({ k: 'brf', tone: 'good', ic: 'fa-check-circle', b: 'Already briefed.', t: 'Go flying saves the lesson again and opens the book-out.' }); }
        else if (B.out) { vm.notes.push({ k: 'out', tone: 'info', ic: 'fa-plane-departure', b: 'Booked out' + (B.outAt ? ' at ' + B.outAt : '') + ' without a brief.', t: 'Go flying marks it briefed and saves the lesson on the booking.' }); }

        // the parts of the brief (empty parts are left out, as v1)
        var p = [];
        if (L && !L.loading) {
            if (vm.files.length) { p.push({ id: 'files', ic: 'fa-images', t: 'Lesson content', n: vm.files.length, w: plural(vm.files.length, 'file') }); }
            if (L.tem.length) { p.push({ id: 'tem', ic: 'fa-exclamation-triangle', t: 'Threats and errors', n: L.tem.length, w: plural(L.tem.length, 'threat') }); }
            if (L.preflight.length) { p.push({ id: 'preflight', ic: 'fa-clipboard-list', t: 'Pre-flight', n: L.preflight.length, w: plural(L.preflight.length, 'point') }); }
            if (L.airex.length) { p.push({ id: 'airex', ic: 'fa-cloud-sun', t: 'Air exercises', n: L.airex.length, w: plural(L.airex.length, 'exercise') }); }
            if (L.items.length) { p.push({ id: 'items', ic: 'fa-tasks', t: 'Objectives', n: L.items.length, w: plural(L.items.length, 'objective') }); }
            if (L.debrief.length) { p.push({ id: 'debrief', ic: 'fa-comments', t: 'Debrief points', n: L.debrief.length, w: plural(L.debrief.length, 'point') }); }
        }
        vm.parts = p;
        vm.has = {}; p.forEach(function (x) { vm.has[x.id] = x; });
        vm.nav = p.length > 1 ? [{ id: 'lesson', ic: 'fa-book-open', t: 'The lesson', n: '' }].concat(vm.quiz.length ? [{ id: 'quiz', ic: 'fa-question-circle', t: 'Pre-lesson questionnaire', n: '' }] : [], p) : [];
        vm.fileIdx = Math.min(S.file, Math.max(0, vm.files.length - 1));
        vm.file = vm.files.length ? vm.files[vm.fileIdx] : null;
        // every file is read once the card shows (as v1 did), so a file that can't be read shows on its thumbnail at once
        if (vm.has.files) { vm.files.forEach(fileData); }

        // the rail: what Go flying does
        vm.ready = !!L;
        vm.sum = [
            { ic: 'fa-user', k: 'Student', v: vm.st ? vm.st.name : 'No student' },
            { ic: 'fa-calendar-alt', k: 'Booked', v: B.t0 + '–' + B.t1, em: ww },
            { ic: 'fa-plane', k: 'Aircraft', v: vm.ac.reg, em: vm.ac.type },
            L ? { ic: 'fa-book-open', k: 'Lesson', v: short, em: S.reason === 'booking' ? 'on the booking' : 'saved to the booking' } : { ic: 'fa-book-open', k: 'Lesson', v: '', emOnly: 'Not chosen yet' }
        ];
        vm.goSub = L ? 'Saves ' + short + ' on the booking, then opens the book-out' : 'Then Go flying saves it and opens the book-out';
        vm.goSubPhone = L ? 'Saves ' + short + ' on the booking' : '';

        pickFields(C, nL);
    }

    /* ════════ the pickers (<dbf-pick>, picker A: a dropdown on desktop, a bottom sheet with its own search on phones) ════════ */
    function lessonStatus(l, sugg) {
        var r = vm.statuses[l.id];
        if (r && r.done) { return { t: 'Signed off ' + InsCore.fDay(r.date), cls: 'good' }; }
        if (r) { return { t: 'Flown ' + InsCore.fDay(r.date) + ', not signed off', cls: 'warn' }; }
        if (sugg && sugg === l.id) { return { t: 'Suggested from records', cls: 'info' }; }
        var n = vm.itemsN[l.id] != null ? vm.itemsN[l.id] : (vm.L && vm.L.id === l.id && !vm.L.loading ? vm.L.items.length : null);
        return { t: n != null ? plural(n, 'objective') : '', cls: '' };
    }
    function pickFields(C, nL) {
        var S = vm.S, L = vm.L, hasL = nL == null ? true : nL > 0;
        vm.pf.course = { label: 'Course', labelIc: 'fa-book', closeIb: true, ic: 'fa-book', title: C ? C.t : '', sub: C ? (nL != null ? plural(nL, 'lesson') : '') : 'The booking has none',
            ph: 'Choose the course', cbTitle: 'Course', cbPh: 'Search courses' };
        var lsub = L ? lessonStatus(L, null).t : !C ? '' : nL == null ? 'Loading the lessons…' : nL ? plural(nL, 'lesson') + ' in ' + C.t : 'Add them in Manage Club → Courses';
        vm.pf.lesson = { label: 'Lesson', labelIc: 'fa-list-ol', closeIb: true, ic: 'fa-list-ol', noEnd: !C || !hasL, title: L ? X.lname(L) : '', sub: lsub,
            ph: !C ? 'Choose the course first' : hasL ? 'Choose the lesson' : 'No lessons in this course yet', disabled: !C || !hasL,
            err: S.err && !L ? 'Choose the lesson you\'re briefing.' : '', cbTitle: 'Lesson', cbPh: 'Search: a number (10) or words (circuits)' };
        if (vm.cb.f) { cbModel(); }
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function cbModel() {
        var cb = vm.cb, S = vm.S, q = String(cb.q || '').trim(), ql = q.toLowerCase(), groups = [], foot = '', empty = null;
        if (cb.f === 'course') {
            var hit = function (c) { return !ql || c.t.toLowerCase().indexOf(ql) > -1; };
            var row = function (c) { var n = nLessons(c.id); return { id: c.id, t: c.t, s: n == null ? '' : n ? plural(n, 'lesson') : 'No lessons yet', cls: n === 0 ? 'warn' : '' }; };
            var mine = (vm.mine || []).map(function (id) { return courseOf(id, true); }).filter(Boolean);
            if (mine.length && !q) { groups.push({ label: vm.who + '\'s courses', items: mine.map(row) }); }
            groups.push({ label: 'Courses at ' + (X.clubShort(vm.B.club) || 'the club'), items: vm.courses.filter(function (c) { return q ? hit(c) : mine.indexOf(c) < 0; }).map(row) });
            foot = 'Courses in the club\'s display order';
            if (!vm.courses.length) { empty = { t: 'No courses at ' + (X.clubShort(vm.B.club) || 'this club') + ' yet', s: 'Add them in Manage Club → Courses.' }; }
            else if (!groups.some(function (g) { return g.items.length; })) { empty = { t: 'Nothing matches “' + q + '”', s: 'Try part of the course name.' }; }
        } else if (cb.f === 'lesson') {
            var ls = lessonsOf(S.cid), C = courseOf(S.cid), sugg = vm.sugg[S.cid] || null;
            if (!ls) { empty = { t: 'Loading the lessons…', s: '' }; }
            else {
                var lhit = function (l) { return !ql || l.t.toLowerCase().indexOf(ql) > -1 || String(l.n) === ql.replace(/^lesson\s*/, '') || ('lesson ' + l.n).indexOf(ql) > -1; };
                var lrow = function (l) { var st = lessonStatus(l, sugg); return { id: l.id, t: X.lname(l), s: st.t, cls: st.cls }; };
                var sl = sugg ? ls.filter(function (l) { return l.id === sugg; })[0] : null;
                if (sl && !q) { groups.push({ label: 'Suggested', items: [lrow(sl)] }); }
                groups.push({ label: C ? C.t : 'Lessons', items: ls.filter(lhit).map(lrow) });
                if (!groups.some(function (g) { return g.items.length; })) { empty = ls.length ? { t: 'Nothing matches “' + q + '”', s: 'Try the lesson number, or a word from its title.' } : { t: 'No lessons in this course yet', s: 'Add them in Manage Club → Courses.' }; }
                foot = vm.st ? 'Status from ' + vm.who + '\'s records' : '';
            }
        }
        var cur = cb.f === 'course' ? S.cid : (vm.L ? vm.L.id : null), rows = [], flat = [];
        if (!empty) {
            groups.forEach(function (g, gi) {
                if (!g.items.length) { return; }
                rows.push({ rk: 'g' + gi, grp: g.label });
                g.items.forEach(function (x) {
                    var r = { rk: 'g' + gi + 'o' + x.id, id: x.id, idx: flat.length, t: x.t, th: $sce.trustAsHtml(esc(x.t)), s: x.s, scls: x.cls ? 'ta-pickmenu__s--' + x.cls : '', on: String(x.id) === String(cur), num: 0, ic: '' };
                    rows.push(r); flat.push(r);
                });
            });
        }
        if (cb.hi >= flat.length) { cb.hi = Math.max(0, flat.length - 1); }
        // the lesson picker's foot carries the ↑ ↓ Enter key caps (the mockup's), the course picker's doesn't
        vm.cbm = { rows: rows, flat: flat, hint: '', foot: foot, keys: cb.f === 'lesson' && !!foot, empty: empty };
    }
    vm.cbOpen = function (f) {
        if (vm.cb.f === f) { vm.cbClose(); return; }
        if (f === 'lesson' && vm.S.cid) { ensureCourse(vm.S.cid); }
        vm.cb = { f: f, q: '', hi: 0 };
        cbModel();
        var i = -1; vm.cbm.flat.forEach(function (r, k) { if (r.on && i < 0) { i = k; } });
        vm.cb.hi = i > -1 ? i : 0;
        $timeout(function () {
            // desktop: straight into the search (on phones the keyboard would cover the sheet)
            var qe = document.getElementById('dbf-cb-q');
            if (qe && !(phoneMq && phoneMq.matches)) { try { qe.focus({ preventScroll: true }); } catch (e) { qe.focus(); } }
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
            if (!flat.length) { return; }
            vm.cb.hi = (vm.cb.hi + (k === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length;
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
        var f = vm.cb.f;
        vm.cbClose();
        if (f === 'course') { pickCourse(+r.id); } else if (f === 'lesson') { pickLesson(+r.id); }
    };
    // a course: the lesson is chosen next (its picker opens straight away unless the course has no lessons)
    function pickCourse(id) {
        var S = vm.S;
        S.cid = id; S.reason = 'none'; S.from = null; S.file = 0;
        ++contentSeq;
        vm.L = null; vm.files = []; vm.quiz = [];
        ensureCourse(id).then(function () { derive(); if (vm.cb.f === 'lesson') { cbModel(); } });
        derive();
        if (nLessons(id) !== 0) { $timeout(function () { if (!vm.cb.f && vm.S.cid === id && !vm.L && nLessons(id) !== 0) { vm.cbOpen('lesson'); } }, 0); }
    }
    function pickLesson(id) {
        var S = vm.S, ls = lessonsOf(S.cid) || [], l = ls.filter(function (x) { return x.id === id; })[0];
        if (!l) { return; }
        S.change = false;
        if (vm.L && vm.L.id === id) { derive(); return; }
        S.reason = 'chosen'; S.from = null; S.err = false; S.file = 0;
        setLesson(l);
        ToastService.success('Lesson chosen', 'Briefing ' + X.lshort(l) + ' · Go flying saves it on the booking', { confetti: false });
    }
    vm.toggleChange = function () {
        vm.S.change = !vm.S.change; vm.cbClose();
        if (vm.S.change && vm.S.cid) { ensureCourse(vm.S.cid); }
        derive();
    };

    /* ════════ the brief ════════ */
    vm.fileSel = function (i) { vm.S.file = i; derive(); };
    vm.fileRetry = function (f) { if (!f) { return; } f.err = false; f.uri = null; fileData(f); };
    vm.openPdf = function (f) {
        if (!f || !f.uri) { return; }
        try {
            var parts = f.uri.split(','), bin = atob(parts[1]), buf = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { buf[i] = bin.charCodeAt(i); }
            var url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
            $window.open(url, '_blank', 'noopener');
            $timeout(function () { URL.revokeObjectURL(url); }, 60000, false);
        } catch (e) { ToastService.error('Couldn’t open the PDF', 'Try again, or read it here.'); }
    };
    /* the jump links (the rail on desktop, chips on phones) scroll smoothly to their card */
    vm.jump = function (id) {
        var el = document.getElementById('brf-s-' + id);
        if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };
    vm.review = function (a) { if (a && a.attemptId) { $state.go('dashboard.manage_club.questionnaire_review', { attempt_id: a.attemptId }); } };
    vm.snap = function () {
        if (!vm.st) { return; }
        vm.snapFor = { studentId: vm.st.id, bookingId: vm.B.id, name: vm.st.name, club: vm.B.club, reg: vm.ac.reg, type: vm.ac.type, model: vm.ac.model, colour: vm.ac.colour };
    };
    vm.snapClose = function () { vm.snapFor = null; };

    /* ════════ Go flying: set_briefed with the course and lesson, then the book-out ════════ */
    vm.fly = function () {
        var S = vm.S, L = vm.L;
        if (!S || S.saving) { return; }
        if (!L) {
            S.err = true; S.change = true; vm.cbClose();
            if (S.cid) { ensureCourse(S.cid); }
            derive();
            $timeout(function () { vm.jump('lesson'); }, 30);
            ToastService.warning('Choose the lesson first', S.cid ? 'Choose the lesson you\'re briefing first' : 'Choose the course and lesson first');
            return;
        }
        var body = { course_id: L.courseId || S.cid || null, lesson_id: L.id };
        S.saving = true;
        vm.cbClose();
        X.setBriefed(vm.B.id, body).then(function (res) {
            if (res && res.success) {
                var short = X.lshort(L), C = courseOf(body.course_id, true), raw = vm.raw || {};
                X.remember({
                    booking_id: vm.B.id, club_id: vm.B.clubId, club_title: vm.B.club, start: vm.B.start, end: vm.B.end, description: vm.B.note, solo: vm.B.solo,
                    booked_out: vm.B.out, booked_out_at: raw.booking ? raw.booking.booked_out_at : null, student: raw.student, aircraft: raw.aircraft,
                    course: C ? { id: C.id, title: C.t } : raw.course, lesson: { id: L.id, number: L.n, title: L.t, aim: L.aim, solo: L.solo, course_id: body.course_id },
                    lesson_reason: S.reason, lesson_from: S.from
                }, vm.st ? vm.st.first : '');
                ToastService.success('Briefed', (vm.st ? vm.st.first : 'The student') + ' briefed on ' + short + ': booking out ' + vm.ac.reg, { confetti: false });
                $state.go('dashboard.my_account.bookout_with_booking', { booking_id: vm.B.id, lesson_id: L.id });
                return;
            }
            S.saving = false;
            refused(res);
        }, function () {
            S.saving = false;
            ToastService.error('Not briefed', 'We couldn’t reach the server. Nothing was booked out; try again.');
        });
    };
    /* every refusal in our own words (the write guard's generic toast stays quiet for handled codes) */
    function refused(res) {
        var c = X.code(res), m = res && res.message && typeof res.message === 'object' ? res.message : (res || {}), reason = m.reason || (res && res.reason);
        if (c === 'FORBIDDEN') { ToastService.error('Not briefed', 'Only the booking’s instructor or the club’s instructors can brief this lesson. Nothing was booked out.'); }
        else if (c === 'NOT_FOUND') { ToastService.error('Not briefed', 'This booking no longer exists: it may have been cancelled. Nothing was booked out.'); }
        else if (c === 'BAD_REQUEST' && reason === 'course_not_in_club') { ToastService.error('Not briefed', 'That course isn’t one of this club’s. Choose another course, then Go flying.'); vm.S.change = true; $timeout(function () { vm.jump('lesson'); }, 30); }
        else if (c === 'BAD_REQUEST') { ToastService.error('Not briefed', 'That lesson isn’t on this course any more. Choose the lesson again, then Go flying.'); vm.S.change = true; $timeout(function () { vm.jump('lesson'); }, 30); }
        else if (c === 'VALIDATION_ERROR') { ToastService.error('Not briefed', 'This booking can’t be briefed from here. Nothing was booked out.'); }
        else if (c === 'UNSUPPORTED_CHARACTERS') { ToastService.handledInline(); }
        else if (res && (res.status === 0 || c === 'NETWORK_ERROR')) { ToastService.error('Not briefed', 'We couldn’t reach the server. Nothing was booked out; try again.'); }
        else { ToastService.error('Not briefed', 'Couldn’t save the brief. Nothing was booked out; try again.'); }
        derive();
    }

    /* Esc closes the open picker (the snapshot dialog closes itself) */
    function onKey(ev) {
        if ((ev.key === 'Escape' || ev.key === 'Esc' || ev.keyCode === 27) && vm.cb.f && !vm.snapFor) { ev.preventDefault(); $scope.$apply(vm.cbClose); }
    }
    document.addEventListener('keydown', onKey);
    $scope.$on('$destroy', function () { document.removeEventListener('keydown', onKey); });
}
