/* ═══════════════════════════════════════════════════════════════════════════
   v2 screen: training — design: mockups/my-account/training.html (approved 7 Nov 2026)
   Syllabus (your courses + the clubs' courses), one course (progress + lessons), one lesson, training records.

   v1 it replaces:  dashboard.my_account.syllabus              (views/my_account/courses.html, DashboardCourseSyllabusController)
                    dashboard.my_account.syllabus_view_course  (views/my_account/course.html,  DashboardCourseSyllabusViewController)
                    dashboard.my_account.syllabus_view_lesson  (views/my_account/lesson.html,  DashboardCourseSyllabusViewController)
                    dashboard.my_account.training_records      (views/my_account/student_record.html, DashboardStudentRecordsController)
   Same server calls as v1: courses/user/{me}, courses/{id}, lessons/course/{id}, lessons/{id}, lesson_bullets|lesson_tem|
   lesson_items/lesson/{id}, lesson_content_files/lesson/{id} + /file/{id}, exams/course/{id},
   training_records/student/{course}/{me}, course_record_export/{course}/{me}, questionnaires/mine + /target/{type}/{id},
   course_materials/target/{type}/{id}; plus two reads the student may already make: bookings/next_lesson/{me}/{course}
   (the backend's own "next lesson" rule) and solo_requirements/status/{club}/{me}/{course} (pre-solo checks).
   Views: views/v2/training/*.html · CSS: css/v2/training.css (page prefix trn-, tokens only).

   Not built (mockup proposals that need backend first — see the tracker):
     • "Awaiting your confirmation" of a debrief by the student (needs training_records.student_acknowledged_at);
     • course minimum hours (no course setting) and lesson phases (no field) — one flat lesson list, hours without a target.
   The record row opens in place and lists only the objectives graded on that flight (v1's drawer listed all 184).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.syllabus', {
            url: '/my_account/syllabus',
            templateUrl: 'views/v2/training/syllabus.html',
            controller: 'TrnSyllabusV2Controller', controllerAs: 'vm',
            data: { action: 'list_member' }
        })
        .state('dashboard.v2.syllabus_view_course', {
            url: '/my_account/syllabus/:course_id',
            templateUrl: 'views/v2/training/course.html',
            controller: 'TrnCourseV2Controller', controllerAs: 'vm',
            data: { action: 'view' }
        })
        .state('dashboard.v2.syllabus_view_lesson', {
            url: '/my_account/syllabus/course/:course_id/lesson/:lesson_id',
            templateUrl: 'views/v2/training/lesson.html',
            controller: 'TrnLessonV2Controller', controllerAs: 'vm',
            data: { action: 'view_lesson' }
        })
        .state('dashboard.v2.training_records', {
            url: '/my_account/training_records?course_id',
            templateUrl: 'views/v2/training/records.html',
            controller: 'TrnRecordsV2Controller', controllerAs: 'vm',
            data: { action: 'student_record' }
        });
    DesignRoutesProvider
        .map('dashboard.my_account.syllabus', 'dashboard.v2.syllabus')
        .map('dashboard.my_account.syllabus_view_course', 'dashboard.v2.syllabus_view_course')
        .map('dashboard.my_account.syllabus_view_lesson', 'dashboard.v2.syllabus_view_lesson')
        .map('dashboard.my_account.training_records', 'dashboard.v2.training_records');
}]);
// a v1 deep link /dashboard/my_account/training_records?course_id=… loses the param on the move to v2 (the v1 state declares
// none): keep it for the v2 records page, which reads it once
app.run(['$rootScope', '$location', function ($rootScope, $location) {
    $rootScope.$on('$stateChangeStart', function (e, to) {
        if (to.name !== 'dashboard.my_account.training_records') { return; }
        var c = +$location.search().course_id;
        if (c) { try { sessionStorage.setItem('toaviate_v2_trn_course_want', String(c)); } catch (x) {} }
    });
}]);

/* The Training hub's tab row (5 tabs, as in the questionnaires-exams mockup) scrolls sideways on phones:
   keep the selected tab in view. Used by the training and exams v2 pages. */
app.directive('trnTabsInView', ['$timeout', function ($timeout) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            var t = null;
            function centre() {
                var row = el[0], on = row.querySelector('.ta-tab--on');
                if (!on || row.scrollWidth <= row.clientWidth) { return; }
                row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
            }
            function later() { if (t) { $timeout.cancel(t); } t = $timeout(centre, 120, false); }
            later();
            angular.element(window).on('resize', later);
            scope.$on('$destroy', function () { angular.element(window).off('resize', later); if (t) { $timeout.cancel(t); } });
        }
    };
}]);

/* ═════ data + words for the training pages (one helper per domain — no raw value reaches the page) ═════ */
app.factory('TrnV2Data', TrnV2Data);
TrnV2Data.$inject = ['$q', '$http', '$state', 'CourseService', 'QuestionnaireService', 'CourseMaterialService', 'TimeDisplayService', 'CourseAssignmentService', 'QxV2Data'];
function TrnV2Data($q, $http, $state, CourseService, QuestionnaireService, CourseMaterialService, TimeDisplayService, CourseAssignmentService, QxV2Data) {
    var D = {};
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function pad(n) { return (n < 10 ? '0' : '') + n; }

    /* ── formatting (API dates are wall-clock "YYYY-MM-DD[ HH:MM:SS]": never shifted) ── */
    D.pd = function (s) {
        if (!s || String(s).indexOf('0000-00-00') === 0) { return null; }
        var p = String(s).replace('T', ' ').split(' '), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        if (!d[0] || !d[1] || !d[2]) { return null; }
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
    };
    D.fDate = function (s) { var d = D.pd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    D.fDay = function (s) { var d = D.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; };
    D.fDayLong = function (s) { var d = D.pd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; };
    D.monthKey = function (s) { var d = D.pd(s); return d ? MONTH[d.getMonth()] + ' ' + d.getFullYear() : 'No date'; };
    D.today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    D.hm = function (mins) { var m = Math.round(Math.abs(+mins || 0)); return Math.floor(m / 60) + ':' + pad(m % 60); };
    D.hoursToMins = function (h) { var n = parseFloat(h); return isNaN(n) ? 0 : Math.round(n * 60); };
    D.plural = function (n, w, many) { return n + ' ' + (n === 1 ? w : (many || w + 's')); };
    D.name = function (f, l) { return [f, l].filter(function (x) { return x && String(x).trim(); }).join(' ').trim(); };
    D.initials = function (f, l) { return ((f || '').trim().charAt(0) + (l || '').trim().charAt(0)).toUpperCase() || '?'; };
    D.firstName = function (full) { return String(full || '').split(' ')[0]; };
    D.stripTag = function (s) { return String(s || '').replace(/\s*\[TPC import [^\]]*\]\s*/g, ' ').trim(); };
    D.hasTag = function (s) { return /\[TPC import [^\]]*\]/.test(s || ''); };
    D.trim = function (s) { return String(s == null ? '' : s).trim(); };
    // a server message fit to show: a short sentence, never an HTML error page or an object
    D.msg = function (data) { if (data && data.status != null && (+data.status <= 0 || +data.status >= 500)) { return ''; }   // a server / connection failure body is never a sentence for the member
        var m = data && data.message; if (m && typeof m === 'object') { m = m.message; } return (typeof m === 'string' && m && !/^\s*</.test(m) && m.length < 300) ? m : ''; };

    /* ── lessons: "A13 - First Solo (Check Point)" + "Duration: 1:30\nCHECK POINT.\nPre-requisites:\n- …" ── */
    D.parseLesson = function (raw, i) {
        var full = D.trim(raw.title), m = /^([A-Z]{1,3}\d+[A-Za-z]?)\s*[-–:]\s*(.*)$/.exec(full);
        var title = m ? m[2] : full, cp = /\(\s*check\s*-?\s*point\s*\)/i.test(title);
        title = title.replace(/\s*\(\s*check\s*-?\s*point\s*\)\s*/i, ' ').trim();
        var dur = '', prereq = [], more = [];
        String(raw.description || '').split('\n').forEach(function (line) {
            var t = line.trim(); if (!t) { return; }
            var d = /^Duration:\s*(.*)$/i.exec(t);
            if (d) { dur = d[1]; return; }
            if (/^CHECK\s*POINT\.?$/i.test(t)) { cp = true; return; }
            if (/^Pre-?requisites:?$/i.test(t)) { return; }
            if (/^[-•]\s+/.test(t)) { prereq.push(t.replace(/^[-•]\s+/, '')); return; }
            more.push(t);
        });
        return { id: +raw.id, i: i, n: i + 1, code: m ? m[1] : null, title: title || full, full: full, cp: cp, solo: +raw.solo === 1, phase: D.trim(raw.phase),
            aim: D.trim(raw.aim), ref: D.trim(raw.course_reference), dur: dur, prereq: prereq, more: more.join(' '), items: [], itemsTotal: 0 };
    };
    D.lessonList = function (items) {
        return (items || []).slice().sort(function (a, b) { return ((+a.organise || 0) - (+b.organise || 0)) || ((+a.id || 0) - (+b.id || 0)); })
            .map(function (r, i) { return D.parseLesson(r, i); });
    };
    D.lessonLabel = function (l) { return l ? (l.code ? l.code + ' · ' : 'Lesson ' + l.n + ' · ') + l.title : ''; };
    D.lessonCode = function (l) { return l ? (l.code || String(l.n)) : ''; };

    /* ── grades: the club's competency set mapped to the design tones (best = good, worst = bad, N/A = muted) ── */
    var HELP = { good: 'meets the standard', warn: 'practise it again', bad: 'your instructor teaches it again', muted: 'not covered on that flight', info: 'graded' };
    var DEF_IC = { good: 'fa-star', warn: 'fa-star-half-alt', bad: 'fa-chalkboard-teacher', muted: 'fa-minus', info: 'fa-circle' };
    var DEFAULT_SET = [{ id: 1, title: 'N/A', faicon: null, colour: null, organise: 0 }, { id: 2, title: 'Re-Teach', faicon: 'chalkboard-teacher', colour: '#900C3F', organise: 1 },
        { id: 3, title: 'Revise', faicon: 'star-half-alt', colour: '#FF5733', organise: 2 }, { id: 4, title: 'Competent', faicon: 'star', colour: '#4CBB17', organise: 3 }];
    D.gradeSet = function (competences) {
        var src = (competences && competences.length) ? competences : DEFAULT_SET;
        var list = src.map(function (c) { return { id: +c.id, name: D.trim(c.title) || 'Grade', faicon: c.faicon, colour: c.colour, organise: +c.organise || 0 }; });
        var na = list.filter(function (c) { return /^n\s*\/?\s*a$/i.test(c.name) || !c.colour; });
        var real = list.filter(function (c) { return na.indexOf(c) < 0; }).sort(function (a, b) { return a.organise - b.organise; });
        real.forEach(function (c, k) { c.tone = k === real.length - 1 ? 'good' : (k === 0 && real.length >= 3 ? 'bad' : 'warn'); });
        na.forEach(function (c) { c.tone = 'muted'; });
        var byId = {}, ORDER = { good: 0, warn: 1, bad: 2, muted: 3 };
        list.forEach(function (c) { c.ic = c.faicon ? 'fa-' + String(c.faicon).replace(/^fa-/, '') : DEF_IC[c.tone]; c.help = HELP[c.tone]; byId[c.id] = c; });
        var legend = list.slice().sort(function (a, b) { return (ORDER[a.tone] - ORDER[b.tone]) || (b.organise - a.organise); });
        function of(entry) {
            if (!entry) { return null; }
            if (entry.result != null && byId[+entry.result]) { return byId[+entry.result]; }
            var nm = D.trim(entry.grade_name).toLowerCase();
            for (var i = 0; i < list.length; i++) { if (list[i].name.toLowerCase() === nm) { return list[i]; } }
            return nm ? { id: 0, name: entry.grade_name, tone: 'info', ic: entry.grade_icon ? 'fa-' + entry.grade_icon : DEF_IC.info, help: HELP.info } : null;
        }
        return { list: list, legend: legend, byId: byId, of: of };
    };

    /* ── one flight on the course: the log sheet + its training record ── */
    function isPlaceholder(tr) {
        if (!tr) { return false; }
        return !tr.lesson_id && !D.stripTag(tr.general_remarks) && D.hasTag(tr.general_remarks) && !(tr.items && tr.items.length);
    }
    function flight(ls, tr, lById, me, G) {
        var lessonId = +((tr && tr.lesson_id) || ls.lesson_id) || null, L = lessonId ? lById[lessonId] || null : null;
        var mode = TimeDisplayService.resolve(+ls.club_id || null, null), v = TimeDisplayService.pick(ls, mode, { window: 'block' }) || {};
        var mins = v.durationMins != null ? v.durationMins : D.hoursToMins(ls.brakes_times_rounded);
        var role = +ls.is_picus === 1 ? 'picus' : (+ls.pic_id === me ? 'solo' : 'dual');   // student in command = solo (PIC), else dual (PUT)
        var picIsIns = !!ls.pic_first_name && +ls.pic_id !== me;
        var insF = picIsIns ? ls.pic_first_name : ls.instructor_first_name;
        var insL = picIsIns ? ls.pic_last_name : ls.instructor_last_name;
        var insC = picIsIns ? (ls.pic_colour || '') : (ls.instructor_colour || '');   // C20 person colours (booking, else instructor colour)
        if (tr && tr.record_instructor_first_name && role === 'dual') { insF = tr.record_instructor_first_name; insL = tr.record_instructor_last_name; insC = ls.instructor_colour || insC; }
        var ph = +ls.import_note_only === 1 || isPlaceholder(tr);
        var f = {
            id: +ls.id, ls: ls, tr: tr, date: String(ls.flight_date || '').slice(0, 10), sort: String(ls.flight_date || '') + ' ' + (ls.brakes_off || ''),
            from: v.from || '', to: v.to || '', mins: mins || 0, tip: v.tooltip || '', role: role,
            reg: ls.registration || '', type: ls.plane_type || '', model: ls.type_name && ls.type_name !== '-' ? ls.type_name : '',
            ins: { name: D.name(insF, insL), code: D.initials(insF, insL), colour: insC }, insName: D.name(insF, insL), acColour: ls.aircraft_colour || '',
            lesson: L, ph: ph, track: !!ls.has_track,
            dep: { code: ls.departure_airport_code || '', name: ls.departure_airport || '' }, arr: { code: ls.destination_airport_code || '', name: ls.destination_airport || '' },
            remarks: tr ? D.stripTag(tr.general_remarks) : '', imp: !!(tr && !ph && D.hasTag(tr.general_remarks)),
            completed: !!(tr && +tr.completed === 1 && !ph && L), grades: [], counts: [], work: [], tags: []
        };
        if (tr) {
            var counts = {};
            (tr.items || []).forEach(function (it) {
                var g = G.of(it); if (!g) { return; }
                var row = { id: +it.lesson_item_id, title: it.item_title || '', g: g, rem: D.trim(it.remarks) };
                f.grades.push(row);
                counts[g.id] = counts[g.id] || { g: g, n: 0 }; counts[g.id].n++;
                if (g.tone === 'warn' || g.tone === 'bad') { f.work.push(row); }
            });
            G.legend.forEach(function (g) { if (counts[g.id]) { f.counts.push(counts[g.id]); } });
            Object.keys(counts).forEach(function (k) { if (!G.byId[k]) { f.counts.push(counts[k]); } });
            f.onBehalf = +tr.entered_on_behalf === 1;
            f.awaiting = +tr.awaiting_instructor_confirmation === 1;
            f.recIns = D.name(tr.record_instructor_first_name, tr.record_instructor_last_name) || f.insName;
            f.enteredBy = D.name(tr.on_behalf_by_first_name || tr.entered_by_first_name, tr.on_behalf_by_first_name ? tr.on_behalf_by_last_name : tr.entered_by_last_name);
            f.confirmed = tr.instructor_confirmed_at ? { by: D.name(tr.confirmed_by_first_name, tr.confirmed_by_last_name) || f.recIns, at: tr.instructor_confirmed_at } : null;
            // be-alex-3e's edit signal (10 Nov): `edited` is the ONLY "changed after filing" flag (absent = false); recorded_at is
            // the first filing, kept through edits (an edited row's created_at is the edit time); edit_reason alone can be a
            // filing override note, so it shows only on an edited record
            f.recordedAt = tr.recorded_at || tr.created_at;
            f.edited = tr.edited === true || +tr.edited === 1
                ? { at: tr.edited_at || tr.created_at, reason: D.trim(tr.edit_reason), by: D.trim(tr.edited_by_name) } : null;
            (tr.flight_tags || []).forEach(function (t) {
                var title = t && (t.title || t.tag || t.name); if (!title) { return; }
                var m = t.tag_minutes != null ? +t.tag_minutes : (t.tag_time != null ? D.hoursToMins(t.tag_time) : (t.minutes != null ? +t.minutes : (t.time != null ? D.hoursToMins(t.time) : (t.hours != null ? D.hoursToMins(t.hours) : null))));   // the API sends tag_minutes + tag_time (hours)
                f.tags.push({ title: title, mins: m });
            });
        }
        // C21: the student confirms they read the debrief. Only debriefs filed / edited since the feature landed ask
        // (ACK_SINCE), so years of history don't all turn amber; import notes and imported records never ask.
        f.ack = null;
        if (tr && !ph && !f.imp && Object.prototype.hasOwnProperty.call(tr, 'student_acknowledged_at')) {
            if (tr.student_acknowledged_at) { f.ack = 'done'; f.ackAt = tr.student_acknowledged_at; }
            else if (String(tr.updated_at || tr.created_at || '') >= ACK_SINCE) { f.ack = 'pending'; }
        }
        f.title = ph ? 'Flight without a debrief' : (L ? D.lessonLabel(L) : (tr ? 'No lesson recorded' : 'No debrief yet'));
        f.pills = recPills(f);
        f.hay = [f.title, D.fDayLong(f.date), D.fDate(f.date), f.date, f.reg, f.type, f.insName, f.dep.code, f.dep.name, f.arr.code, f.arr.name, f.remarks].join(' ').toLowerCase();
        return f;
    }
    var ACK_SINCE = '2026-11-09';
    D.recPills = function (f) { return recPills(f); };
    function P(tone, label, ic) { return { tone: tone, label: label, ic: ic }; }
    function recPills(f) {
        if (f.ph) { return [P('import', 'Import note only', 'fa-file-import')]; }
        if (!f.tr) { return [P('muted', 'No debrief yet', 'fa-pen')]; }
        var out = [];
        if (f.lesson) { out.push(f.completed ? P('good', 'Lesson signed off', 'fa-check') : P('info', 'Lesson to repeat', 'fa-redo')); }
        if (f.onBehalf && f.awaiting) { out.push(P('pend', 'Awaiting ' + D.firstName(f.recIns) + '\'s confirmation', 'fa-hourglass-half')); }
        if (f.onBehalf && f.confirmed) { out.push(P('good', 'Confirmed by ' + D.firstName(f.confirmed.by), 'fa-user-check')); }
        if (f.ack === 'pending') { out.push(P('warn', 'Awaiting your confirmation', 'fa-pen-nib')); }
        if (f.imp) { out.push(P('muted', 'Imported', 'fa-file-import')); }
        return out;
    }

    /* ── a course's progress, from training_records/student/{course}/{me} ── */
    D.progress = function (lessons, payload, me, next) {
        payload = payload || {};
        var G = D.gradeSet(payload.competences), lById = {};
        lessons.forEach(function (l) { lById[l.id] = l; l.items = []; l.itemsTotal = 0; });
        (payload.all_items || []).forEach(function (it) {
            var l = lById[+it.lesson_id]; if (!l) { return; }
            var e = it.last_entry, g = e ? G.of(e) : null;
            l.items.push({ id: +it.id, title: it.title, description: it.description,
                last: g ? { g: g, date: e.flight_date, ins: D.name(e.instructor_first_name || e.completed_by_first_name, e.instructor_first_name ? e.instructor_last_name : e.completed_by_last_name), rem: D.trim(e.remarks) } : null });
            l.itemsTotal = Math.max(l.itemsTotal, +it.lesson_items_total || 0);
        });
        var trById = {}, trByPls = {};
        (payload.training_records || []).forEach(function (tr) { trById[tr.id] = tr; trByPls[tr.plane_log_sheet_id] = tr; });
        var flights = (payload.log_sheets || []).map(function (ls) {
            var tr = trById[ls.training_record_id] || trByPls[ls.id] || null;
            return flight(ls, tr, lById, me, G);
        }).sort(function (a, b) { return a.sort < b.sort ? -1 : (a.sort > b.sort ? 1 : a.id - b.id); });
        var st = lessons.map(function () { return { recs: [], done: null, last: null }; });
        var ph = 0, awaiting = 0, ackPending = 0, firstAck = null;
        flights.forEach(function (f) {
            if (f.ph) { ph++; }
            if (f.ack === 'pending') { ackPending++; if (!firstAck) { firstAck = f; } }
            if (f.onBehalf && f.awaiting) { awaiting++; }
            if (!f.lesson) { return; }
            var s = st[f.lesson.i]; s.recs.push(f); s.last = f; if (f.completed && !s.done) { s.done = f; }
        });
        var signed = 0, items = 0, competent = 0, revise = 0, graded = 0, firstSolo = null;
        lessons.forEach(function (l, i) {
            if (st[i].done) { signed++; }
            if (l.solo && firstSolo === null) { firstSolo = i; }
            items += Math.max(l.items.length, l.itemsTotal);
            l.items.forEach(function (it) { if (it.last) { graded++; if (it.last.g.tone === 'good') { competent++; } if (it.last.g.tone === 'warn' || it.last.g.tone === 'bad') { revise++; } } });
        });
        var enrolled = flights.length > 0 || (payload.training_records || []).length > 0;
        var p = { G: G, lessons: lessons, enrolled: enrolled, flights: flights, st: st, signed: signed, items: items, competent: competent, revise: revise, graded: graded,
            firstSolo: firstSolo, ph: ph, awaiting: awaiting, ackPending: ackPending, firstAck: firstAck, latest: flights.length ? flights[flights.length - 1] : null,
            records_only: payload.syllabus_access === false };
        var h = payload.course_hours || {};
        p.totalMins = D.hoursToMins(h.course_total); p.picMins = D.hoursToMins(h.course_pic); p.putMins = D.hoursToMins(h.course_put); p.picusMins = D.hoursToMins(h.course_picus);
        if (!p.totalMins && flights.length) { p.totalMins = flights.reduce(function (a, f) { return a + f.mins; }, 0); }
        // C21: the course's minimum hours (null when the course sets none)
        var minH = parseFloat(payload.course_minimum_hours);
        p.minH = minH > 0 ? minH : null;
        p.minMins = p.minH ? Math.round(p.minH * 60) : 0;
        p.minPct = p.minH ? Math.min(100, Math.round(p.totalMins / p.minMins * 100)) : 0;
        p.minOver = !!p.minH && p.totalMins >= p.minMins;
        p.minText = p.minH ? (p.minH % 1 ? p.minH.toFixed(1) : String(p.minH)) + ' h' : '';
        // C21: lesson phases, in syllabus order (consecutive lessons sharing a phase)
        p.phases = [];
        lessons.forEach(function (l) { var last = p.phases[p.phases.length - 1]; if (l.phase && (!last || last.t !== l.phase)) { p.phases.push({ t: l.phase }); } });
        p.customTags = [];
        angular.forEach(h.custom_tags || {}, function (val, tag) { p.customTags.push({ title: tag, mins: D.hoursToMins(val) }); });
        D.applyNext(p, next);
        return p;
    };
    /* the next lesson: the backend's rule (bookings/next_lesson) when it answered, else the same rule on the records */
    D.applyNext = function (p, next) {
        p.next = null; p.repeat = false; p.complete = false;
        if (!p.enrolled || !p.lessons.length) { return; }
        var byId = {}; p.lessons.forEach(function (l) { byId[l.id] = l; });
        if (next && next.success !== false && next.lesson && byId[+next.lesson.id]) {
            p.next = byId[+next.lesson.id].i; p.repeat = next.reason === 'repeat_incomplete'; p.complete = next.reason === 'course_complete';
            return;
        }
        var withLesson = p.flights.filter(function (f) { return f.lesson && f.tr && !f.ph; }), latest = withLesson[withLesson.length - 1];
        if (!latest) { p.next = 0; return; }
        if (latest.completed) {
            if (latest.lesson.i + 1 < p.lessons.length) { p.next = latest.lesson.i + 1; } else { p.next = latest.lesson.i; p.complete = true; }
        } else { p.next = latest.lesson.i; p.repeat = true; }
    };
    /* the flight that set the "to work on" list: the latest record on the lesson being repeated */
    D.workOn = function (p) {
        if (!p || p.next == null || !p.repeat) { return []; }
        var s = p.st[p.next]; return s && s.last ? s.last.work : [];
    };

    /* ── questionnaires + material attached to a course or a lesson (the student's to-dos) ── */
    D.attached = function (type, id) {
        return $q.all([QuestionnaireService.Mine(), QuestionnaireService.GetForTarget(type, id), CourseMaterialService.ListForTarget(type, id)]).then(function (r) {
            var attempts = (r[0] && r[0].items) || [], out = { pre: [], post: [] };
            ((r[1] && r[1].items) || []).filter(function (q) { return q.is_published; }).forEach(function (q) {
                var qid = q.questionnaire_id || q.id, timing = q.timing || 'pre';
                var a = attempts.filter(function (at) { return String(at.questionnaire_id) === String(qid) && (at.timing || 'pre') === timing; })
                    .reduce(function (best, at) { return (!best || (+at.id || 0) >= (+best.id || 0)) ? at : best; }, null);
                var x = { type: 'q', id: qid, title: q.title, desc: q.description, n: +q.question_count || 0, status: a && !QxV2Data.notStarted(a) ? a.status : 'not_started', attempt: a,
                    score: a && a.score_released && +a.max_score ? [a.auto_score, a.max_score] : null, at: a ? (a.submitted_at || a.updated_at) : null,
                    timing: timing, attachType: type, attachId: id };
                (timing === 'post' ? out.post : out.pre).push(x);
            });
            ((r[2] && r[2].items) || []).forEach(function (m) {
                var x = { type: 'm', id: m.id, title: m.title, desc: m.description, ft: m.file_type === 'video' ? 'video' : 'pdf', done: !!(m.my_access && m.my_access.completed), timing: m.timing === 'pre' ? 'pre' : 'post' };
                (x.timing === 'pre' ? out.pre : out.post).push(x);
            });
            return out;
        }, function () { return { pre: [], post: [] }; });
    };
    D.notStarted = QxV2Data.notStarted;   // a granted retake not opened yet (exams.js)
    D.outcome = QxV2Data.outcome;         // an instructor's Passed / Not passed on a reviewed attempt (exams.js)
    D.todoDone = function (x) { return x.type === 'm' ? !!x.done : (x.status === 'reviewed' || x.status === 'submitted'); };
    D.openCount = function (list) { return (list || []).filter(function (x) { return !D.todoDone(x); }).length; };
    D.qStatus = function (x, attn) {
        if (x.type === 'm') {
            return x.done ? { tone: 'good', ic: 'fa-check', label: 'Done', act: x.ft === 'video' ? 'Watch' : 'Read' }
                : (attn ? { tone: 'warn', ic: 'fa-exclamation-circle', label: 'To do', act: x.ft === 'video' ? 'Watch' : 'Read' } : { tone: 'muted', ic: '', label: 'Not opened', act: x.ft === 'video' ? 'Watch' : 'Read' });
        }
        if (x.status === 'reviewed') { var oc = QxV2Data.outcome(x.attempt); return { tone: oc ? oc.tone : 'good', ic: oc ? oc.ic : 'fa-check', label: oc ? oc.label : 'Reviewed', act: 'View result' }; }
        if (x.status === 'submitted') { return { tone: 'info', ic: 'fa-paper-plane', label: 'Submitted', act: 'View result' }; }
        if (x.status === 'in_progress' || x.status === 'opened') { return { tone: 'info', ic: 'fa-pen', label: 'In progress', act: 'Continue' }; }
        return attn ? { tone: 'warn', ic: 'fa-exclamation-circle', label: 'To do', act: 'Start' } : { tone: 'muted', ic: '', label: 'Not started', act: 'Start' };
    };
    D.openTodo = function (x) {
        if (x.type === 'm') { $state.go('dashboard.my_account.material_view', { material_id: x.id }); return; }
        if (x.attempt && (x.status === 'submitted' || x.status === 'reviewed')) { $state.go('dashboard.my_account.questionnaire_result', { attempt_id: x.attempt.id }); return; }
        $state.go('dashboard.my_account.questionnaire_take', { questionnaire_id: x.id, attach_type: x.attachType, attach_id: x.attachId, timing: x.timing || 'pre' });
    };

    /* ── pre-solo requirements (solo_requirements/status — the student may read their own) ── */
    var REQ_KIND = { medical: 'Medical', exam: 'Ground exam', questionnaire: 'Questionnaire', manual: 'Instructor sign-off' };
    /* C21: the student confirms they have read a debrief (POST training_records/{id}/acknowledge, own records only) */
    D.acknowledge = function (id) {
        return $http.post('/api/v1/training_records/' + id + '/acknowledge', {}).then(function (r) { return r.data; },
            function (r) { var d = r && r.data; return { success: false, status: r ? r.status : 0, error: d && d.error, message: d && typeof d === 'object' ? d.message : null }; });
    };
    D.reqs = function (data) {
        return ((data && data.requirements) || []).map(function (r) {
            var kind = r.auto_type || 'manual', s;
            if (r.satisfied || r.state === 'satisfied') { s = { tone: 'good', ic: 'fa-check', label: 'Done', you: false }; }
            else if (r.state === 'pending_review') { s = { tone: 'info', ic: 'fa-hourglass-half', label: 'Waiting for review', you: false }; }
            else if (r.state === 'in_progress') { s = { tone: 'info', ic: 'fa-pen', label: 'Started', you: true }; }
            else if (r.state === 'not_signed_off') { s = { tone: 'muted', ic: 'fa-signature', label: 'Instructor signs off', you: false }; }
            else { s = { tone: 'warn', ic: 'fa-exclamation', label: 'For you to do', you: true }; }
            return { id: r.id, name: r.name, kind: kind, kindLabel: REQ_KIND[kind] || 'Requirement', detail: D.trim(r.detail), s: s, qid: r.questionnaire_id || null, done: s.tone === 'good' };
        });
    };
    D.startReq = function (r) {
        if (r && r.qid) { $state.go('dashboard.my_account.questionnaire_take', { questionnaire_id: r.qid }); return; }
        $state.go('dashboard.my_account.questionnaires');
    };
    D.reqSummary = function (reqs) {
        var done = reqs.filter(function (r) { return r.done; }).length, you = reqs.filter(function (r) { return r.s.you; }).length;
        return { done: done, you: you, all: reqs.length > 0 && done === reqs.length, pct: reqs.length ? Math.round(done / reqs.length * 100) : 0 };
    };

    /* ── the club's courses for this member (current clubs; records-only courses kept for the records page) ── */
    D.myCourses = function (me) {
        return CourseService.GetCoursesByUserId(me).then(function (data) {
            var items = (data && data.success !== false && angular.isArray(data.items)) ? data.items : [];
            return items.map(function (c) {
                if (c.time_display) { TimeDisplayService.setClubMode(c.club_id, c.time_display); }
                return { id: +c.club_id, title: D.trim(c.title), member: Number(c.member) !== 0,
                    courses: CourseService.sortByDisplayOrder(c.courses || []).map(function (co) { co.club_title = D.trim(c.title); return co; }) };
            });
        });
    };
    D.hubCounts = function (hub) {
        CourseAssignmentService.MineCount().then(function (d) { hub.todo = (d && typeof d.count === 'number') ? d.count : 0; });
        QxV2Data.signCount(hub);   // the CAA forms tab's badge (one helper, in the exams module)
    };
    return D;
}

/* ═════ shared bits for the four controllers ═════ */
// "Confirm I have read this debrief" on a record row (records + lesson pages): ask → Yes → POST, row + counts updated in place
function trnV2Ack(vm, D, ToastService, onChange) {
    vm.ackAsk = null;
    vm.askAck = function (f) { vm.ackAsk = f.id; };
    vm.ackNo = function () { vm.ackAsk = null; };
    vm.ackDo = function (f) {
        if (vm.acking) { return; }
        vm.acking = true;   // own flag: a 0 ms double tap got past the busy guard in the UX pass
        D.acknowledge(f.tr.id).then(function (d) {
            vm.acking = false;
            if (d && d.success) {
                f.ack = 'done'; f.ackAt = d.student_acknowledged_at || D.today(); f.tr.student_acknowledged_at = f.ackAt; f.pills = D.recPills(f); vm.ackAsk = null;
                if (vm.p) { vm.p.ackPending = Math.max(0, vm.p.ackPending - 1); vm.p.firstAck = vm.p.flights.filter(function (x) { return x.ack === 'pending'; })[0] || null; }
                ToastService.success('Debrief confirmed', 'The club can see you have read it.');
                if (onChange) { onChange(); }
            } else if (d && d.error === 'NOT_FOUND') {
                vm.ackAsk = null;
                ToastService.error('Not confirmed', 'This debrief has just been changed by your instructor. Here is the new version.');
                if (onChange) { onChange(true); }
            } else {
                ToastService.error('Not confirmed', D.msg(d) || 'That didn\'t go through. Try again in a moment.');
            }
        });
    };
}
function trnV2Hub(cur, title, hint, icon) { return { cur: cur, title: title, hint: hint, icon: icon || 'fa-graduation-cap', todo: 0, sign: 0 }; }

/* ═════ PAGE: Syllabus (your courses + the clubs' courses) ═════ */
app.controller('TrnSyllabusV2Controller', TrnSyllabusV2Controller);
TrnSyllabusV2Controller.$inject = ['$rootScope', '$q', '$state', 'CourseService', 'BookingService', 'SoloRequirementsService', 'TrnV2Data'];
function TrnSyllabusV2Controller($rootScope, $q, $state, CourseService, BookingService, SoloRequirementsService, TrnV2Data) {
    var vm = this, D = TrnV2Data;
    vm.D = D;
    vm.user = $rootScope.globals.currentUser;
    vm.me = +vm.user.id;
    vm.hub = trnV2Hub('syllabus', 'Training', 'Your courses, training records, questionnaires and exams');
    vm.loading = true;
    vm.clubs = [];
    vm.mine = [];          // [{ course, p, next lesson, reqs }]
    vm.browse = [];        // [{ club, courses: [{ course, n }] }]
    vm.noCourseClubs = [];
    vm.open = function (c) { $state.go('dashboard.my_account.syllabus_view_course', { course_id: c.id }); };
    D.hubCounts(vm.hub);

    D.myCourses(vm.me).then(function (clubs) {
        // the syllabus is for CURRENT members (v1 rule): records-only courses stay on Training records
        vm.clubs = clubs.filter(function (c) { return c.member; }).map(function (c) {
            return angular.extend({}, c, { courses: c.courses.filter(function (co) { return Number(co.records_only) !== 1; }) });
        });
        vm.loading = false;
        var mine = [], browse = [], none = [];
        vm.clubs.forEach(function (club) {
            var others = [];
            club.courses.forEach(function (co) {
                if (+co.has_records === 1) { mine.push({ course: co, club: club, loading: true }); }
                else { others.push({ course: co, n: null }); }
            });
            if (others.length) { browse.push({ club: club, courses: others }); }
            if (!club.courses.length) { none.push(club); }
        });
        vm.mine = mine; vm.browse = browse; vm.noCourseClubs = none;
        mine.forEach(loadMine);
        browse.forEach(function (g) {
            g.courses.forEach(function (x) {
                CourseService.GetLessonsByCourseId(x.course.id).then(function (d) { x.n = (d && d.items) ? d.items.length : 0; });
            });
        });
    });

    function loadMine(m) {
        $q.all([CourseService.GetLessonsByCourseId(m.course.id), CourseService.GetStudentTrainingRecords(vm.me, m.course.id), BookingService.GetNextLesson(vm.me, m.course.id)]).then(function (r) {
            var lessons = D.lessonList(r[0] && r[0].items), payload = (r[1] && r[1].success !== false) ? r[1] : {};
            m.progError = !(r[1] && r[1].success !== false);   // the records didn't load: say so, don't pretend nothing was flown
            m.p = D.progress(lessons, payload, vm.me, r[2]);
            m.lesson = m.p.next != null ? lessons[m.p.next] : null;
            m.work = D.workOn(m.p);
            setNextText(m);
            m.loading = false;
            if (m.lesson && m.lesson.solo) {
                SoloRequirementsService.GetStatus(m.club.id, vm.me, m.course.id).then(function (d) { m.reqs = D.reqs(d); m.reqSum = D.reqSummary(m.reqs); });
            }
            if (m.lesson) { D.attached('lesson', m.lesson.id).then(function (a) { m.before = D.openCount(a.pre); setNextText(m); }); }
        });
    }
    /* the up-next sub-line as one string: "Work on: a; b" (or the aim) + " · 2 things to do before the lesson" */
    function setNextText(m) {
        if (!m.lesson) { m.nextText = ''; return; }
        m.nextText = (m.work.length ? 'Work on: ' + m.work.map(function (w) { return w.title; }).join('; ') : (m.lesson.aim || ''))
            + (m.before ? ' · ' + D.plural(m.before, 'thing') + ' to do before the lesson' : '');
    }
    vm.lessonsPct = function (p) { return p && p.lessons.length ? Math.round(p.signed / p.lessons.length * 100) : 0; };
}

/* ═════ PAGE: one course ═════ */
app.controller('TrnCourseV2Controller', TrnCourseV2Controller);
TrnCourseV2Controller.$inject = ['$rootScope', '$q', '$state', '$stateParams', 'CourseService', 'BookingService', 'SoloRequirementsService', 'TrnV2Data'];
function TrnCourseV2Controller($rootScope, $q, $state, $stateParams, CourseService, BookingService, SoloRequirementsService, TrnV2Data) {
    var vm = this, D = TrnV2Data;
    vm.D = D;
    vm.user = $rootScope.globals.currentUser;
    vm.me = +vm.user.id;
    vm.courseId = +$stateParams.course_id;
    vm.loading = true;
    vm.error = '';
    vm.course = null;
    vm.p = null;
    vm.exams = [];
    vm.att = { pre: [], post: [] };
    vm.nextAtt = { pre: [], post: [] };
    vm.reqs = []; vm.reqSum = null;
    vm.lf = 'all'; vm.lq = '';
    vm.groups = [];
    vm.aboutOpen = false;
    vm.openLesson = function (l) { $state.go('dashboard.my_account.syllabus_view_lesson', { course_id: vm.courseId, lesson_id: l.id }); };
    vm.reload = function () { $state.reload(); };
    vm.setFilter = function (f) { vm.lf = f; build(); };
    vm.search = build;
    vm.clearFind = function () { vm.lf = 'all'; vm.lq = ''; build(); };
    vm.openTodo = D.openTodo;
    vm.startReq = D.startReq;
    vm.attn = function (k) { return k === 'next'; };

    CourseService.GetCourseById(vm.courseId).then(function (data) {
        if (!data || data.success === false || !data.item) {
            vm.loading = false;
            vm.error = D.msg(data) || 'This course could not be loaded.';
            return;
        }
        vm.course = data.item;
        vm.course.title = D.trim(vm.course.title);
        $q.all([D.myCourses(vm.me), CourseService.GetLessonsByCourseId(vm.courseId), CourseService.GetStudentTrainingRecords(vm.me, vm.courseId),
            BookingService.GetNextLesson(vm.me, vm.courseId), CourseService.GetExamsByCourseId(vm.courseId)]).then(function (r) {
            r[0].forEach(function (club) { if (club.id === +vm.course.club_id) { vm.clubTitle = club.title; } });
            var lessons = D.lessonList(r[1] && r[1].items), payload = (r[2] && r[2].success !== false) ? r[2] : {};
            vm.progError = !(r[2] && r[2].success !== false);   // the records didn't load: say so, don't pretend nothing was flown
            vm.p = D.progress(lessons, payload, vm.me, r[3]);
            vm.examRecs = {};
            (payload.exam_records || []).forEach(function (e) { vm.examRecs[+e.exam_id] = e; });
            vm.exams = (r[4] && r[4].items) || payload.exams || [];
            vm.examsPassed = vm.exams.filter(function (x) { var e = vm.examRecs[+x.id]; return e && +e.pass_fail === 1; }).length;
            vm.nextLesson = vm.p.next != null ? lessons[vm.p.next] : null;
            vm.work = D.workOn(vm.p);
            vm.showSolo = vm.p.enrolled && vm.p.firstSolo != null && vm.p.next != null && vm.p.next <= vm.p.firstSolo;
            vm.soloSoon = vm.showSolo && vm.p.next === vm.p.firstSolo;
            vm.soloAttn = vm.soloSoon;
            vm.firstSoloLesson = vm.p.firstSolo != null ? lessons[vm.p.firstSolo] : null;
            vm.loading = false;
            build();
            if (vm.showSolo) {
                SoloRequirementsService.GetStatus(+vm.course.club_id, vm.me, vm.courseId).then(function (d) { vm.reqs = D.reqs(d); vm.reqSum = D.reqSummary(vm.reqs); });
            }
            if (vm.nextLesson && vm.p.enrolled) { D.attached('lesson', vm.nextLesson.id).then(function (a) { vm.nextAtt = a; }); }
        });
        D.attached('course', vm.courseId).then(function (a) { vm.att = a; vm.attAll = a.pre.concat(a.post); });
    });

    function build() {
        var p = vm.p; if (!p) { return; }
        var q = D.trim(vm.lq).toLowerCase(), f = vm.lf, shown = [];
        p.lessons.forEach(function (l, i) {
            var s = p.st[i];
            if (f === 'done' && !s.done) { return; } if (f === 'todo' && s.done) { return; }
            if (f === 'cp' && !l.cp) { return; } if (f === 'solo' && !l.solo) { return; }
            var hit = null;
            if (q) {
                var inL = ((l.code || '') + ' ' + l.title + ' ' + l.aim).toLowerCase().indexOf(q) > -1;
                if (!inL) { for (var k = 0; k < l.items.length; k++) { if (String(l.items[k].title).toLowerCase().indexOf(q) > -1) { hit = l.items[k].title; break; } } }
                if (!inL && !hit) { return; }
            }
            shown.push(row(l, i, hit));
        });
        var cnt = { all: p.lessons.length, done: p.signed, todo: p.lessons.length - p.signed, cp: p.lessons.filter(function (l) { return l.cp; }).length, solo: p.lessons.filter(function (l) { return l.solo; }).length };
        vm.chips = [['all', 'All'], ['done', 'Signed off'], ['todo', 'Still to do'], ['solo', 'Solo'], ['cp', 'Check points']].filter(function (c) {
            return c[0] === 'all' || (cnt[c[0]] && (p.enrolled || (c[0] !== 'done' && c[0] !== 'todo')));
        }).map(function (c) { return { k: c[0], label: c[1], n: cnt[c[0]] }; });
        vm.rows = shown;
        // C21 phases: one group header per run of lessons sharing a phase ("Lessons" when the course sets none)
        var groups = [], cur = null;
        shown.forEach(function (r) { var t = r.l.phase || 'Lessons'; if (!cur || cur.t !== t) { cur = { t: t, rows: [] }; groups.push(cur); } cur.rows.push(r); });
        groups.forEach(function (g) {
            var ls = p.lessons.filter(function (l) { return (l.phase || 'Lessons') === g.t; });
            g.total = ls.length; g.signed = ls.filter(function (l) { return !!p.st[l.i].done; }).length;
        });
        vm.groups = groups;
    }
    function row(l, i, hit) {
        var p = vm.p, s = p.st[i], state = p.enrolled ? (s.done ? 'done' : (i === p.next ? 'next' : 'todo')) : 'todo';
        var sub;
        if (hit) { sub = 'Objective: ' + hit; }
        else if (state === 'done') { sub = 'Signed off ' + D.fDate(s.done.date) + ' · ' + D.plural(s.recs.length, 'flight') + (s.done.imp ? ' · imported, no grades' : ''); }
        else if (state === 'next' && p.repeat && s.last) { sub = 'Repeat · ' + D.plural(s.recs.length, 'flight') + ' so far · last ' + D.fDay(s.last.date); }
        else { sub = l.aim; }
        var nObj = Math.max(l.items.length, l.itemsTotal), comp = l.items.filter(function (it) { return it.last && it.last.g.tone === 'good'; }).length, graded = l.items.filter(function (it) { return it.last; }).length, fig;
        if (!nObj) { fig = { t: 'No objectives', none: true }; }
        else if (!p.enrolled || (!graded && !s.recs.length)) { fig = { t: D.plural(nObj, 'objective'), none: true }; }
        else if (!graded) { fig = { t: 'Not graded', none: true }; }
        else { fig = { t: comp + ' / ' + nObj + ' competent', pct: Math.round(comp / nObj * 100) }; }
        return { l: l, i: i, s: s, state: state, sub: sub, fig: fig,
            who: s.done ? { f: s.done, t: D.fDate(s.done.date) } : (s.last ? { f: s.last, t: 'Last ' + D.fDay(s.last.date) } : null) };
    }
    vm.lessonsPct = function () { return vm.p && vm.p.lessons.length ? Math.round(vm.p.signed / vm.p.lessons.length * 100) : 0; };
}

/* ═════ PAGE: one lesson ═════ */
app.controller('TrnLessonV2Controller', TrnLessonV2Controller);
TrnLessonV2Controller.$inject = ['$rootScope', '$scope', '$q', '$sce', '$state', '$stateParams', '$document', '$window', 'CourseService', 'BookingService', 'SoloRequirementsService', 'ToastService', 'TrnV2Data'];
function TrnLessonV2Controller($rootScope, $scope, $q, $sce, $state, $stateParams, $document, $window, CourseService, BookingService, SoloRequirementsService, ToastService, TrnV2Data) {
    var vm = this, D = TrnV2Data;
    vm.D = D;
    vm.user = $rootScope.globals.currentUser;
    vm.me = +vm.user.id;
    vm.courseId = +$stateParams.course_id;
    vm.lessonId = +$stateParams.lesson_id;
    vm.loading = true;
    vm.error = '';
    vm.l = null; vm.p = null; vm.s = null;
    vm.bullets = { preflight: [], airex: [], debrief: [] };
    vm.tem = []; vm.items = [];
    vm.files = []; vm.att = { pre: [], post: [] };
    vm.reqs = []; vm.reqSum = null;
    vm.open = null; vm.wx = null;
    vm.viewer = null;
    vm.openTodo = D.openTodo;
    vm.startReq = D.startReq;
    vm.attn = function (k) { return k === 'before' && !!vm.isNext; };
    vm.go = function (l) { if (l) { $state.go('dashboard.my_account.syllabus_view_lesson', { course_id: vm.courseId, lesson_id: l.id }); } };
    vm.reload = function () { $state.reload(); };
    vm.toggleRec = function (f) { vm.open = vm.open === f.id ? null : f.id; vm.wx = null; vm.ackAsk = null; };
    vm.toggleWx = function (f) { vm.wx = vm.wx === f.id ? null : f.id; };
    vm.hideLesson = true;
    trnV2Ack(vm, D, ToastService, function (reload) { if (reload) { $state.reload(); } });

    function onKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && vm.viewer) { $scope.$apply(function () { vm.viewer = null; }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    CourseService.GetLessonById(vm.lessonId).then(function (data) {
        if (!data || data.success === false || !data.item) {
            vm.loading = false;
            vm.error = D.msg(data) || 'This lesson could not be loaded.';
            return;
        }
        var raw = data.item;
        $q.all([CourseService.GetCourseById(vm.courseId), CourseService.GetLessonsByCourseId(vm.courseId), CourseService.GetStudentTrainingRecords(vm.me, vm.courseId),
            BookingService.GetNextLesson(vm.me, vm.courseId), CourseService.GetBulletsByLessonId(vm.lessonId), CourseService.GetTemByLessonId(vm.lessonId),
            CourseService.GetItemsByLessonId(vm.lessonId), D.myCourses(vm.me)]).then(function (r) {
            vm.course = (r[0] && r[0].item) || { id: vm.courseId, title: '' };
            vm.course.title = D.trim(vm.course.title);
            var lessons = D.lessonList(r[1] && r[1].items), payload = (r[2] && r[2].success !== false) ? r[2] : {};
            vm.progError = !(r[2] && r[2].success !== false);   // the records didn't load: say so, don't pretend nothing was flown
            if (!lessons.some(function (l) { return l.id === vm.lessonId; })) { lessons.push(D.parseLesson(raw, lessons.length)); }
            vm.p = D.progress(lessons, payload, vm.me, r[3]);
            vm.lessons = lessons;
            vm.l = lessons.filter(function (l) { return l.id === vm.lessonId; })[0];
            vm.s = vm.p.st[vm.l.i];
            vm.prev = vm.l.i > 0 ? lessons[vm.l.i - 1] : null;
            vm.next = vm.l.i < lessons.length - 1 ? lessons[vm.l.i + 1] : null;
            vm.isNext = vm.p.enrolled && vm.l.i === vm.p.next;
            vm.recs = vm.s.recs.slice().reverse();
            var b = (r[4] && r[4].bullets) || {};
            ['preflight', 'airex', 'debrief'].forEach(function (k) {
                vm.bullets[k] = (b[k] || []).slice().sort(function (x, y) { return (+x.organise || 0) - (+y.organise || 0); })
                    .map(function (x) { return { t: x.title, h: String(x.bullet_format) !== '0' }; });
            });
            vm.tem = (r[5] && r[5].items) || [];
            // completion standards: the lesson's objectives with my latest grade on each (from the records' all_items)
            var latest = {}; vm.l.items.forEach(function (it) { latest[it.id] = it.last; });
            vm.items = ((r[6] && r[6].items) || []).slice().sort(function (x, y) { return (+x.organise || 0) - (+y.organise || 0); })
                .map(function (it) { return { id: +it.id, title: it.title, description: D.trim(it.description), last: latest[+it.id] || null }; });
            if (!vm.items.length && vm.l.items.length) { vm.items = vm.l.items; }
            vm.showSolo = vm.p.enrolled && vm.p.firstSolo === vm.l.i && !vm.s.done;
            vm.soloAttn = vm.isNext;
            vm.firstSoloLesson = vm.l;
            vm.loading = false;
            if (vm.showSolo) {
                SoloRequirementsService.GetStatus(+vm.course.club_id || 0, vm.me, vm.courseId).then(function (d) { vm.reqs = D.reqs(d); vm.reqSum = D.reqSummary(vm.reqs); });
            }
        });
        loadFiles();
        D.attached('lesson', vm.lessonId).then(function (a) { vm.att = a; });
    });

    /* briefing material (lesson_content_files): images load their data for the tile; a PDF loads when opened */
    function loadFiles() {
        CourseService.GetLessonContentFiles(vm.lessonId).then(function (data) {
            vm.files = ((data && data.items) || []).map(function (f) {
                var pdf = f.file_type === 'pdf' || f.mime_type === 'application/pdf';
                var x = { id: f.id, name: f.original_name || 'File', pdf: pdf, pages: +f.pdf_pages || 0, size: sizeText(f.file_size), data: null, loading: false, error: false };
                if (!pdf) { fetchData(x); }
                return x;
            });
        });
    }
    function fetchData(x) {
        if (x.data || x.loading) { return $q.when(x); }
        x.loading = true; x.error = false;
        return CourseService.GetLessonContentFileData(x.id).then(function (res) {
            x.loading = false;
            if (res && res.success && res.data_uri) {
                x.data = res.data_uri;
                if (x.pdf) { var u = dataToBlobUrl(x.data); if (u) { x.blobRaw = u; x.blob = $sce.trustAsResourceUrl(u); } }
            } else { x.error = true; }
            return x;
        }, function () { x.loading = false; x.error = true; return x; });
    }
    function sizeText(b) { b = +b || 0; if (!b) { return ''; } return b >= 1048576 ? (Math.round(b / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
    function dataToBlobUrl(data) {
        try {
            var parts = String(data).split(','), mime = (/data:([^;]+)/.exec(parts[0]) || [])[1] || 'application/octet-stream';
            var bin = atob(parts[1]), arr = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { arr[i] = bin.charCodeAt(i); }
            return URL.createObjectURL(new Blob([arr], { type: mime }));
        } catch (e) { return null; }
    }
    $scope.$on('$destroy', function () { vm.files.forEach(function (x) { if (x.blobRaw) { try { URL.revokeObjectURL(x.blobRaw); } catch (e) {} } }); });
    vm.openFile = function (x) { vm.viewer = x; fetchData(x); };
    vm.closeViewer = function () { vm.viewer = null; };
    vm.fullSize = function (x) {
        if (!x || !x.data) { return; }
        var u = x.blobRaw || dataToBlobUrl(x.data);
        if (u) { x.blobRaw = u; $window.open(u, '_blank'); } else { ToastService.error('Couldn\'t open the file', 'Try again in a moment.'); }
    };
}

/* ═════ PAGE: training records ═════ */
app.controller('TrnRecordsV2Controller', TrnRecordsV2Controller);
TrnRecordsV2Controller.$inject = ['$rootScope', '$scope', '$q', '$state', '$stateParams', '$document', '$timeout', 'CourseService', 'BookingService', 'ToastService', 'TrnV2Data'];
function TrnRecordsV2Controller($rootScope, $scope, $q, $state, $stateParams, $document, $timeout, CourseService, BookingService, ToastService, TrnV2Data) {
    var vm = this, D = TrnV2Data;
    var LAST_KEY = 'toaviate_v2_trn_course', SKIP_KEY = 'sr_export_skip_progress';   // the second is v1's own key
    vm.D = D;
    vm.user = $rootScope.globals.currentUser;
    vm.me = +vm.user.id;
    vm.hub = trnV2Hub('records', 'Training', 'Your courses, training records, questionnaires and exams');
    vm.hub.tools = 'views/v2/training/_records_scope.html';
    vm.hideLesson = false;
    vm.loading = true;
    vm.loadingRec = false;
    vm.courses = [];
    vm.course = null;
    vm.p = null;
    vm.rf = 'all'; vm.rq = '';
    vm.open = null; vm.wx = null;
    vm.dlg = null; vm.exporting = false;
    vm.skipProg = false;
    try { vm.skipProg = localStorage.getItem(SKIP_KEY) === '1'; } catch (e) {}
    vm.toggleRec = function (f) { vm.open = vm.open === f.id ? null : f.id; vm.wx = null; vm.ackAsk = null; };
    vm.toggleWx = function (f) { vm.wx = vm.wx === f.id ? null : f.id; };
    vm.setFilter = function (f) { vm.rf = f; vm.open = null; build(); };
    vm.search = function () { vm.open = null; build(); };
    vm.clearFilters = function () { vm.rf = 'all'; vm.rq = ''; build(); };
    vm.pick = pick;
    vm.showRec = showRec;
    vm.openExport = function () { vm.dlg = 'export'; };
    vm.closeDlg = function () { if (!vm.exporting) { vm.dlg = null; } };
    vm.rememberSkip = function () { try { localStorage.setItem(SKIP_KEY, vm.skipProg ? '1' : '0'); } catch (e) {} };
    vm.doExport = doExport;
    trnV2Ack(vm, D, ToastService, function (reload) { if (reload) { var c = vm.course; vm.p = null; vm.course = null; pick(c); } else { build(); } });
    D.hubCounts(vm.hub);

    function onKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && vm.dlg) { $scope.$apply(function () { vm.closeDlg(); }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    D.myCourses(vm.me).then(function (clubs) {
        var list = [];
        clubs.forEach(function (club) {
            club.courses.forEach(function (co) {
                if (+co.has_records === 1 || +co.records_only === 1) { list.push({ id: +co.id, title: D.trim(co.title), club: club.title, clubId: club.id, recordsOnly: +co.records_only === 1 || !club.member }); }
            });
        });
        vm.courses = list;
        vm.loading = false;
        if (!list.length) { return; }
        var want = +$stateParams.course_id || 0, last = 0;
        try { if (!want) { want = +sessionStorage.getItem('toaviate_v2_trn_course_want') || 0; } sessionStorage.removeItem('toaviate_v2_trn_course_want'); } catch (e) {}
        try { last = +localStorage.getItem(LAST_KEY) || 0; } catch (e) {}
        var pickOne = list.filter(function (c) { return c.id === want; })[0] || list.filter(function (c) { return c.id === last; })[0] || list[0];
        pick(pickOne);
    });

    function pick(c) {
        if (!c || (vm.course && vm.course.id === c.id && vm.p)) { return; }
        vm.course = c; vm.courseId = c.id; vm.p = null; vm.open = null; vm.wx = null; vm.rf = 'all'; vm.rq = '';
        try { localStorage.setItem(LAST_KEY, String(c.id)); } catch (e) {}
        vm.loadingRec = true; vm.recError = '';
        $q.all([CourseService.GetLessonsByCourseId(c.id), CourseService.GetStudentTrainingRecords(vm.me, c.id), BookingService.GetNextLesson(vm.me, c.id)]).then(function (r) {
            if (vm.course !== c) { return; }
            vm.loadingRec = false;
            if (!r[1] || r[1].success === false) {
                vm.recError = D.msg(r[1]) || 'Your training records for this course couldn\'t be loaded. Try again in a moment.';
                return;
            }
            var lessons = D.lessonList(r[0] && r[0].items);
            vm.p = D.progress(lessons, r[1], vm.me, r[2]);
            vm.since = vm.p.flights.length ? vm.p.flights[0].date : null;
            var recs = {}; (r[1].exam_records || []).forEach(function (e) { recs[+e.exam_id] = e; });
            vm.exams = (r[1].exams || []).map(function (x) { return { x: x, r: recs[+x.id] || null }; });
            vm.examsTaken = vm.exams.filter(function (e) { return e.r; });
            vm.quiz = (r[1].questionnaires || []).map(function (q) {
                var st = (q.status === 'reviewed' || q.score_released) ? (D.outcome(q) || { tone: 'good', ic: 'fa-check', label: 'Reviewed' })
                    : q.status === 'submitted' ? { tone: 'info', ic: 'fa-paper-plane', label: 'Submitted' }
                    : (q.status === 'opened' || q.status === 'in_progress') && !D.notStarted(q) ? { tone: 'info', ic: 'fa-pen', label: 'In progress' } : { tone: 'muted', ic: '', label: 'Not started' };
                return { q: q, title: q.questionnaire_title || q.title, when: q.timing === 'post' ? 'After' : 'Before', at: q.submitted_at, st: st,
                    score: q.score_released && +q.max_score ? q.auto_score + ' / ' + q.max_score : null,
                    canOpen: !!(q.attempt_id && (q.status === 'submitted' || q.status === 'reviewed' || q.score_released)) };
            });
            build();
        });
    }

    function build() {
        var p = vm.p; if (!p) { return; }
        var f = vm.rf, q = D.trim(vm.rq).toLowerCase();
        var cnt = { all: p.flights.length, signed: 0, repeat: 0, awaiting: p.awaiting + p.ackPending, ph: p.ph };
        p.flights.forEach(function (x) { if (x.completed) { cnt.signed++; } else if (!x.ph && x.lesson && x.tr) { cnt.repeat++; } });
        vm.chips = [['all', 'All'], ['signed', 'Signed off'], ['repeat', 'To repeat'], ['awaiting', 'Awaiting confirmation'], ['ph', 'Import notes']]
            .filter(function (c) { return c[0] === 'all' || cnt[c[0]]; }).map(function (c) { return { k: c[0], label: c[1], n: cnt[c[0]], attn: c[0] === 'awaiting' && p.ackPending > 0 }; });
        var list = p.flights.slice().reverse().filter(function (x) {
            if (f === 'signed' && !x.completed) { return false; }
            if (f === 'repeat' && (x.completed || x.ph || !x.lesson || !x.tr)) { return false; }
            if (f === 'awaiting' && !((x.onBehalf && x.awaiting) || x.ack === 'pending')) { return false; }
            if (f === 'ph' && !x.ph) { return false; }
            if (q && x.hay.indexOf(q) < 0) { return false; }
            return true;
        });
        var months = [], by = {};
        list.forEach(function (x) { var k = D.monthKey(x.date); if (!by[k]) { by[k] = { k: k, list: [], mins: 0 }; months.push(by[k]); } by[k].list.push(x); by[k].mins += x.mins; });
        vm.months = months;
        vm.firstAwaiting = p.flights.filter(function (x) { return x.onBehalf && x.awaiting; }).slice(-1)[0] || null;
    }

    function showRec(f) {
        vm.rf = 'all'; vm.rq = ''; build(); vm.open = f.id; vm.wx = null;
        $timeout(function () { var el = document.getElementById('trn-rec-' + f.id); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, 60);
    }

    function doExport() {
        if (!vm.course) { return; }
        vm.exporting = true;
        CourseService.ExportCourseRecord(vm.course.id, vm.me, { include_progress: !vm.skipProg }).then(function (res) {
            vm.exporting = false;
            var type = (res && res.headers && res.headers('Content-Type')) || '';
            if (res && res.data && (type.indexOf('application/json') > -1 || !res.data.byteLength)) {   // a refusal sent as JSON, or nothing: never save it as a PDF
                var said = ''; try { said = D.msg(JSON.parse(new TextDecoder().decode(res.data))); } catch (e) {}
                ToastService.error('Export failed', said || 'The course record PDF could not be made. Try again in a moment.');
                return;
            }
            if (res && res.data) {
                var url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), a = document.createElement('a');
                a.href = url;
                a.download = 'Course_Record_' + vm.course.title.replace(/[^a-zA-Z0-9]/g, '_') + '_' + D.name(vm.user.first_name, vm.user.last_name).replace(/[^a-zA-Z0-9]/g, '_') + '_' + vm.course.id + '.pdf';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                $timeout(function () { URL.revokeObjectURL(url); }, 60000, false);
                vm.dlg = null;
                ToastService.success('Course record downloaded', vm.skipProg ? 'Without the syllabus progress pages.' : 'Your hours, flights, debriefs and results in one PDF.');
            } else {
                ToastService.error('Export failed', 'The course record PDF could not be made. Try again in a moment.');
            }
        }, function () { vm.exporting = false; ToastService.error('Export failed', 'The course record PDF could not be made. Try again in a moment.'); });
    }
}
