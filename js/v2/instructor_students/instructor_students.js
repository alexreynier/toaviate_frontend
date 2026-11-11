/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · STUDENT RECORDS — design: mockups/instructor-dashboard/student-records.html (approved 9 Nov 2026).
   Built beside v1 (views/manageuser/student_records.html, DashboardStudentRecordsController) behind the global v2 switch
   (js/v2/core/design.js). Tracker: mockups/v2-build/fe-instructor-students.md. Views: views/v2/instructor_students/*.html.
   CSS: css/v2/instructor-students.css (stu-). The Edit page is built from the debrief's pieces (dbf- classes, css/v2/debrief.css).

   State (v1's param names): dashboard.v2.instructor_students  /manage_user/student_records?club_id&student_id&course_id&flight&tab
     ← dashboard.manage_user.student_records. Everything lives in the query string (reloadOnSearch: false; the page writes it
     with $state.go('.', params, {location: 'replace'}), so the page is one stop in the browser history, as v1).
     tab = flights | progress | presolo | exams | edit (the TAB is a query param, not the hash: the design switch moves pages
     with $state.go(target, $state.params), which keeps declared params and drops a hash; v1 doesn't declare tab, so v2 → v1
     drops it and v1 → v2 lands on Flights). flight = a plane_log_sheet id: opens Flights with that record open and
     highlighted once (Hours Instructed, the debrief's Save), then leaves the URL; with tab=edit it is the record being edited.

   Data (contract C39 in mockups/v2-build/be-alex-3e.md, landed 22:03, and v1's routes):
     find     GET training_records/v2/students/{club}?scope=mine&limit=100  (clubs[], counts, students[] — "Your students")
              GET training_records/v2/student_search/{club}?q=&limit=12     (2+ letters: mine[] + others[])
     student  GET training_records/student/{course}/{user}   records, flights, objectives (latest grade), exams, questionnaires
              GET lessons/course/{course} · bookings/next_lesson/{user}/{course} · training_records/snapshot/{user}?club_id
              GET training_records/v2/medical_file/{club}/{user} (the whole file, history, access_log, remind)
              GET solo_requirements/status/{club}/{user}/{course} · courses/club/{club} · caa_forms?club_id&subject_user_id
              GET training_records/to_file/{club}?student_id (club admins) · training_records/student/{course}/{user}/{flight} (Edit)
              GET medicals/{id}?sd=1&club_id (the scan, behind the password step: fail "templogin" → users/login3)
     writes   POST training_records/confirm/{id} (+reason) · PUT training_records/{id} · POST solo_requirements/sign_off · revoke
              POST course_assignments (Set it) · POST course_assignments/{id}/remind · POST medicals/remind · POST medicals/{id}/query
              PUT member_checks · POST/PUT/DELETE exam_records (+ exam_record_files) · GET course_record_export (PDF)
   The flights / progress mapping is TrnV2Data's (the student's own v2 Training page reads the same endpoint), so a record
   reads the same to the student and to the instructor. Raw enums never reach the screen: StuV2Data holds the words.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_students', {
        url: '/manage_user/student_records?club_id&student_id&course_id&flight&tab',
        templateUrl: 'views/v2/instructor_students/students.html',
        controller: 'InstructorStudentsV2Controller',
        controllerAs: 'vm',
        reloadOnSearch: false   // club, student, course and tab follow the page into the URL without reloading it
    });
    DesignRoutesProvider.map('dashboard.manage_user.student_records', 'dashboard.v2.instructor_students');
}]);


/* ═════ StuV2Data: reads, writes and the words (one helper per domain) ═════ */
app.factory('StuV2Data', StuV2Data);
StuV2Data.$inject = ['$q', '$http', 'InsCore', 'CourseService', 'BookingService', 'StudentSnapshotService', 'SoloRequirementsService',
    'CourseAssignmentService', 'CaaFormsService', 'RecordsToFileService', 'ExamSalesService', 'MemberService'];
function StuV2Data($q, $http, InsCore, CourseService, BookingService, StudentSnapshotService, SoloRequirementsService,
    CourseAssignmentService, CaaFormsService, RecordsToFileService, ExamSalesService, MemberService) {
    var C = InsCore;
    var CLUB_KEY = 'toaviate_instructor_selected_club_id';   // shared with v1 (and CAA forms), so both remember the same club
    var ORIGIN_KEY = 'toaviate_sr_origin';                    // shared with v1: where BACK goes
    var EXPORT_KEY = 'sr_export_skip_progress';               // shared with v1 (TEMPORARY, review by 13 Nov 2026)
    var AV = ['#2563eb', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#b45309', '#4f46e5'];
    var REQ_KIND = { medical: 'Medical', exam: 'Ground exam', questionnaire: 'Questionnaire', manual: 'Instructor sign-off' };
    /* the CAA limitation codes in plain words, with what they mean for a lesson ('bad' = no solo): help for reading the
       certificate (decided 9 Nov 2026: no code list; this only explains the code that is on it) */
    var LIM = {
        VDL: ['Wear corrective lenses for distance, and carry a spare pair of spectacles', 'Check they have their glasses, and the spare pair'],
        VML: ['Wear multifocal spectacles (distance, intermediate and near), and carry a spare pair', 'Check they have their glasses, and the spare pair'],
        VNL: ['Have spectacles for near vision to hand, and carry a spare pair', 'Check they have their reading glasses'],
        CCL: ['Correction by contact lenses only', 'Check they are wearing their lenses'],
        VCL: ['Valid by day only (colour vision)', 'Day flying only'],
        OSL: ['Valid only with a safety pilot, in an aircraft with dual controls', 'No solo flights on this medical', 'bad'],
        OPL: ['Valid only without passengers', 'Doesn\'t affect solo training'],
        TML: ['Valid for a shorter period than usual', 'Note the expiry date'],
        SSL: ['Special restrictions, as written on the certificate', 'Read the certificate for the detail']
    };
    var ORIGIN_LABELS = {
        'dashboard': 'Dashboard',
        'dashboard.manage_user': 'Instructor Dashboard', 'dashboard.v2.instructor_home': 'Instructor Dashboard',
        'dashboard.manage_user.instructed_hours': 'Hours Instructed', 'dashboard.v2.instructor_hours': 'Hours Instructed',
        'dashboard.manage_user.my_schedule': 'My Schedule', 'dashboard.v2.instructor_schedule': 'My Schedule',
        'dashboard.manage_user.debriefing_list': 'Debriefs', 'dashboard.v2.instructor_debriefs': 'Debriefs',
        'dashboard.manage_user.debriefing': 'Debrief', 'dashboard.v2.instructor_debrief': 'Debrief',
        'dashboard.manage_user.caa_forms': 'CAA Forms', 'dashboard.v2.instructor_caa_forms': 'CAA Forms',
        'dashboard.manage_user.caa_forms_new': 'CAA Form', 'dashboard.v2.instructor_caa_forms_new': 'CAA Form',
        'dashboard.manage_user.student_questionnaires': 'Student questionnaires', 'dashboard.v2.instructor_questionnaires': 'Student questionnaires',
        'dashboard.manage_user.briefing': 'Briefings', 'dashboard.v2.instructor_briefings': 'Briefings',
        'dashboard.manage_club.records_to_file': 'Records to File',
        'dashboard.scheduler_v2': 'Scheduler'
    };

    var D = {
        CLUB_KEY: CLUB_KEY, ORIGIN_KEY: ORIGIN_KEY, ORIGIN_LABELS: ORIGIN_LABELS, LIM: LIM, REQ_KIND: REQ_KIND, AV: AV,
        // reads
        students: function (club, params) { return C.get('training_records/v2/students/' + club, params); },
        search: function (club, q) { return C.get('training_records/v2/student_search/' + club, { q: q, limit: 12 }); },
        records: function (student, course) { return CourseService.GetStudentTrainingRecords(student, course); },
        flightRecord: function (student, course, pls) { return CourseService.GetStudentTrainingRecordsForFlight(student, course, pls); },
        lessons: function (course) { return CourseService.GetLessonsByCourseId(course); },
        nextLesson: function (student, course) { return BookingService.GetNextLesson ? BookingService.GetNextLesson(student, course) : $q.when(null); },
        snapshot: function (student, club) { return StudentSnapshotService.Get(student, { club_id: club }); },
        medicalFile: function (club, user) { return C.get('training_records/v2/medical_file/' + club + '/' + user); },
        scan: function (id, club) { return C.get('medicals/' + id, { sd: 1, st: 0, club_id: club }); },   // full size (st=0), the club it is opened for
        /* an archived version's scan (live 10 Nov): by the history[] entry's archived_id (never medical_id: versions share it); the
           same gates as the live scan (templogin, image_viewed in the log); same shape, images may be { data_uri: null, missing } */
        scanArchived: function (archivedId, club) { return C.get('medicals/archived/' + archivedId, { sd: 1, st: 0, club_id: club }); },
        solo: function (club, user, course) { return SoloRequirementsService.GetStatus(club, user, course); },
        clubCourses: function (club) { return CourseService.GetCoursesByClubId(club); },
        tags: function (course) { return CourseService.GetTagsByCourseId(course); },
        caaDocs: function (club, user) { return CaaFormsService.List(club, { subject_user_id: user }); },
        caaPdf: function (f) { return CaaFormsService.GetPdf(f.id, (f.form_type || 'caa_form') + '.pdf'); },
        caaTitle: function (f) { return f.title || (CaaFormsService.typeTitle ? CaaFormsService.typeTitle(f.form_type) : '') || 'CAA form'; },
        unfiled: function (club, user) { return RecordsToFileService.Queue(club, { student_id: user, per_page: 50 }); },
        studentQx: function (club, user) { return C.get('questionnaires/v2/student/' + club + '/' + user); },
        examAudit: function (id) { return ExamSalesService.GetRecordAudit(id); },
        sortCourses: function (list) { return CourseService.sortByDisplayOrder ? CourseService.sortByDisplayOrder(list || []) : (list || []); },
        // writes
        confirm: function (id, reason) { return RecordsToFileService.Confirm(id, reason); },
        saveRecord: function (payload, id) { return CourseService.UpdateTrainingRecord(payload, id); },
        signOff: function (payload) { return SoloRequirementsService.SignOff(payload); },
        revoke: function (id) { return SoloRequirementsService.RevokeSignOff(id); },
        share: function (payload) { return CourseAssignmentService.Share(payload); },
        remind: function (id) { return C.post('course_assignments/' + id + '/remind', {}); },
        medRemind: function (club, user) { return C.post('medicals/remind', { club_id: club, user_id: user }); },
        medQuery: function (id, club, message) { return C.post('medicals/' + id + '/query', { club_id: club, message: message }); },
        medCheck: function (club, user, medId) { return MemberService.Verify({ check_type: 'medical', user_id: user, club_id: club, check_id: medId, verified: 1 }); },
        examAdd: function (body) { return CourseService.CreateExamRecord(body); },
        examSave: function (id, body) { return ExamSalesService.UpdateRecord(id, body); },
        examDelete: function (id) { return ExamSalesService.DeleteRecord(id); },
        examUpload: function (file, id) { return ExamSalesService.UploadFile(file, id); },
        exportPdf: function (course, student, include) { return CourseService.ExportCourseRecord(course, student, { include_progress: include }); },

        // words
        name: name, initials: initials, avColour: function (id) { return AV[Math.abs(+id || 0) % AV.length]; },
        P: P, lessonCode: lessonCode, lessonTitle: lessonTitle, isoWords: isoWords, msg: msg, leftWords: leftWords, nextRemind: nextRemind,
        studentRow: studentRow, medFile: medFile, medStatus: medStatus, reqRow: reqRow, examRows: examRows, quizRow: quizRow, rememberClub: rememberClub, savedClub: savedClub,
        exportSkip: function () { try { return localStorage.getItem(EXPORT_KEY) === '1'; } catch (e) { return false; } },
        setExportSkip: function (v) { try { localStorage.setItem(EXPORT_KEY, v ? '1' : '0'); } catch (e) { /* storage off */ } }
    };
    return D;

    function name(f, l) { return [f, l].filter(function (x) { return x && String(x).trim(); }).join(' ').replace(/\s+/g, ' ').trim(); }
    function initials(n) { var p = String(n || '').trim().split(/\s+/); return (((p[0] || '')[0] || '') + (p.length > 1 ? (p[p.length - 1][0] || '') : '')).toUpperCase(); }
    /* a pill for the templates: { cls: 'ta-pill--good' | 'stu-pill--import' …, label, ic } */
    function P(tone, label, ic) { return { cls: /^(stu-|ta-)/.test(tone) ? tone : 'ta-pill--' + tone, label: label, ic: ic || null }; }
    /* "A13 - First Solo (Check Point)" → A13; else the lesson's reference ("Ex 6"); else "Lesson 6" */
    function lessonCode(l) {
        if (!l) { return ''; }
        var m = /^([A-Z]{1,3}\d+[A-Za-z]?)\s*[-–:]\s*/.exec(String(l.title || '').trim());
        return m ? m[1] : (l.reference || l.course_reference || (l.number != null ? 'Lesson ' + (+l.number || 0) : ''));
    }
    /* D24 (backend-companion §6): no "check point" marker for now, so "(Check Point)" leaves the title */
    function lessonTitle(l) { return l ? String(l.title || '').trim().replace(/^([A-Z]{1,3}\d+[A-Za-z]?)\s*[-–:]\s*/, '').replace(/\s*\(\s*check\s*-?\s*point\s*\)\s*/i, ' ').trim() : ''; }
    /* a backend sentence with ISO dates ("valid until 2027-04-23") in the app's words ("23 Apr 2027") */
    function isoWords(s) { return String(s || '').replace(/\b(\d{4}-\d{2}-\d{2})(?: \d{2}:\d{2}(?::\d{2})?)?\b/g, function (x, d) { return C.fDate(d); }); }
    /* a server message fit to show (never an HTML page or an object) */
    function msg(data, fallback) {
        var m = data && data.message; if (m && typeof m === 'object') { m = m.message; }
        return (typeof m === 'string' && m && !/^\s*</.test(m) && m.length < 300) ? m : (fallback || '');
    }
    function plural(n, one, many) { return C.plural(n, one, many); }
    function leftWords(n) {
        if (n < 0) { return 'expired ' + plural(-n, 'day') + ' ago'; }
        if (n <= 60) { return plural(n, 'day') + ' left'; }
        var mo = Math.round(n / 30.44), y = Math.floor(mo / 12);
        return mo < 24 ? plural(mo, 'month') + ' left' : plural(y, 'year') + (mo % 12 ? ' ' + plural(mo % 12, 'month') : '') + ' left';
    }
    /* decided 9 Nov 2026: one reminder a week per item; it unlocks at 00:00 UK on the day seven days after the last one */
    function nextRemind(at) { return at ? C.addDays(String(at).slice(0, 10), 7) : null; }
    function rememberClub(id) { try { localStorage.setItem(CLUB_KEY, String(id)); } catch (e) { /* storage off */ } }
    function savedClub() { try { return +localStorage.getItem(CLUB_KEY) || null; } catch (e) { return null; } }

    /* ── one student on the find list (C39 row): who needs you first, where they are ── */
    function studentRow(s, me) {
        var nl = s.next_lesson || null, reason = nl ? nl.reason : null, last = s.last_flight || null, today = C.today();
        var code = nl ? lessonCode(nl) : '', title = nl ? lessonTitle(nl) : '';
        var complete = reason === 'course_complete', repeat = reason === 'repeat_incomplete';
        var agoDays = last && last.date ? C.daysBetween(last.date, today) : null;
        var n = s.needs || {}, pill;
        if (+n.record_to_confirm > 0) { pill = P('warn', +n.record_to_confirm > 1 ? n.record_to_confirm + ' records to confirm' : 'Record to confirm', 'fa-pen-nib'); }
        else if (+n.questionnaire_to_review > 0) { pill = P('warn', 'Questionnaire to review', 'fa-clipboard-check'); }
        else if (+n.flights_to_file > 0) { pill = P('warn', plural(+n.flights_to_file, 'flight') + ' to file', 'fa-file-signature'); }
        else if (!s.course) { pill = P('muted', 'No training records'); }
        else if (complete) { pill = P('good', 'Course complete', 'fa-check'); }
        else if (s.first_solo_next) { pill = P('solo', 'Up next: first solo', 'fa-user'); }
        else if (agoDays != null && agoDays > 30) { pill = P('muted', 'Not flown for ' + Math.max(5, Math.round(agoDays / 7)) + ' weeks'); }
        else if (repeat && nl) { pill = P('info', 'Repeating ' + code, 'fa-redo'); }
        else if (s.imported && !last) { pill = P('muted', 'Imported · no lessons yet', 'fa-file-import'); }
        else { pill = P('info', 'In training', 'fa-plane'); }
        var course = s.course ? (s.course.title || s.course.short_title || 'Course') : '';
        var sub = !s.course ? ((s.membership && (s.membership.label || s.membership.name)) || 'Member')
            : course + (nl ? ' · ' + (complete ? 'all lessons signed off' : (repeat ? 'repeating ' : 'next ') + (code ? code + ' ' : '') + title) : ' · no lessons recorded yet');
        var insName = last ? (last.instructor_name || '') : '';
        return {
            id: +s.user_id, first: s.first_name || '', last: s.last_name || '', name: name(s.first_name, s.last_name) || 'Student', email: s.email || '',
            course: s.course ? { id: +s.course.id, title: course } : null, sub: sub, pill: pill,
            needs: !!s.needs_you, solo: !!s.before_first_solo, firstSoloNext: !!s.first_solo_next, idle: agoDays != null && agoDays > 30,
            lastDate: last ? last.date : null, lastWord: last ? (C.dayWord(last.date) || C.fDay(last.date)) : '',
            lastWith: last ? (+last.instructor_id === me ? 'you' : (insName || 'an instructor')) : '',
            hours: C.hm(+s.course_hours || 0), hoursN: +s.course_hours || 0, toConfirm: +n.record_to_confirm || 0, raw: s
        };
    }

    /* ── the medical file (C39 medical_file): the current certificate, the earlier ones, the log ── */
    function medOne(m) {
        if (!m) { return null; }
        var classes = (m.classes || []).map(function (c) { return { t: c.title || 'Medical', exp: c.expiry_date || null }; });
        var first = classes.filter(function (c) { return c.exp; }).sort(function (a, b) { return a.exp < b.exp ? -1 : 1; })[0] || null;
        var codes = (m.limitation_codes && m.limitation_codes.length ? m.limitation_codes : String(m.limitations || '').split(/[\s,;\/]+/)).map(function (x) { return String(x).trim().toUpperCase(); }).filter(Boolean);
        var a = m.authority ? (typeof m.authority === 'object' ? m.authority : { title: String(m.authority) }) : null;
        return {
            id: +m.id, current: !!m.current, num: m.certificate_number || '', exam: m.examination_date || null,
            auth: a ? (a.abbreviation && a.title && a.title.trim() !== a.abbreviation.trim() ? a.title.trim() + ' (' + a.abbreviation.trim() + ')' : (a.title || a.abbreviation || '')).trim() : '',
            authShort: a ? (a.abbreviation || a.title || '') : '',
            classes: classes, dates: (m.date_records || []).map(function (d) { return { t: d.title || 'Date', d: d.date }; }),
            first: first, exp: m.expiry_date || (first && first.exp) || null, expired: !!(m.expiry_date || (first && first.exp)) && String(m.expiry_date || first.exp).slice(0, 10) < C.today(), lim: codes.join(' '), codes: codes, limText: m.limitations || '',
            osl: !!m.osl || codes.indexOf('OSL') > -1, pages: +m.page_count || 0, saved: m.updated_at || m.created_at || null, changed: null,
            check: m.check && +m.check.verified === 1 ? { by: m.check.checked_by_name || 'the club', byId: +m.check.checked_by || 0, at: m.check.checked_at } : null
        };
    }
    function medFile(res) {
        var meds = ((res && res.medicals) || []).map(medOne).filter(Boolean);
        /* archived versions (history[]): since 10 Nov they keep their classes, date records, expiry and scans; listed with the earlier
           certificates when they carry them (an older answer without them: only the log line, as before) */
        var archived = ((res && res.history) || []).filter(function (h) { return angular.isArray(h.classes) && h.classes.length; }).map(function (h) {
            var m = medOne(angular.extend({}, h, { id: h.medical_id, current: false, check: null }));
            m.archived = true; m.archivedId = +h.archived_id || 0; m.archivedAt = h.archived_at || h.updated_at || null;
            return m;
        }).sort(function (a, b) { return String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')); });
        var cur = meds.filter(function (m) { return m.current; })[0] || null;
        if (!cur && meds.length && !(res.summary && res.summary.state === 'none')) { cur = meds[0]; }
        // an edit by the member archives the row (history[]): the newest archived version of the current medical is its last change
        if (cur) { ((res && res.history) || []).forEach(function (h) { if (+h.medical_id === cur.id || !h.medical_id) { var at = h.archived_at || h.updated_at; if (at && (!cur.changed || at > cur.changed)) { cur.changed = at; } } }); }
        return {
            cur: cur, earlier: meds.filter(function (m) { return m !== cur; }).concat(archived), summary: (res && res.summary) || {},
            history: (res && res.history) || [], log: (res && res.access_log) || [],
            remind: (res && res.remind) || { last_at: null, next_allowed_at: null, allowed: true }
        };
    }
    /* none | expired | lim | soon | unchecked | valid → the tone, the hero button's words */
    function medStatus(f, today) {
        var m = f && f.cur;
        if (!m) { return { tone: 'bad', key: 'none', btn: 'No medical on file' }; }
        var c = m.first, n = c && c.exp ? C.daysBetween(today, c.exp) : null, lim = m.codes.filter(function (x) { return LIM[x] && LIM[x][2] === 'bad'; })[0];
        if (n != null && n < 0) { return { tone: 'bad', key: 'expired', btn: 'Medical expired ' + C.fDay(c.exp), n: n }; }
        if (lim || m.osl) { return { tone: 'bad', key: 'lim', btn: 'Medical · ' + (lim || 'OSL') + ': no solo', n: n, code: lim || 'OSL' }; }
        if (n != null && n <= 30) { return { tone: 'warn', key: 'soon', btn: 'Medical expires in ' + plural(n, 'day'), n: n }; }
        if (!m.check) { return { tone: 'info', key: 'unchecked', btn: 'Medical · not checked by the club yet', n: n }; }
        return { tone: 'good', key: 'valid', btn: 'Medical · ' + (c ? c.t + ' to ' + C.fDate(c.exp) : 'on file') + (m.lim ? ' · ' + m.lim : ''), n: n };
    }

    /* ── a pre-solo requirement (solo_requirements/status) → state, words, actions ── */
    function reqState(r) {
        var s = r.state;
        if (r.satisfied || s === 'satisfied') { return { tone: 'good', ic: 'fa-check', label: 'Done' }; }
        if (s === 'pending_review') { return { tone: 'warn', ic: 'fa-clipboard-check', label: 'To review' }; }
        if (s === 'in_progress') { return { tone: 'info', ic: 'fa-pen', label: 'Started' }; }
        if (s === 'not_signed_off') { return { tone: 'warn', ic: 'fa-signature', label: 'To sign off' }; }
        if (s === 'medical_limitation') { return { tone: 'bad', ic: 'fa-exclamation-triangle', label: 'No solo on this medical' }; }
        if (s === 'no_medical') { return { tone: 'bad', ic: 'fa-times', label: 'No medical on file' }; }
        if (s === 'below_min_score') { return { tone: 'bad', ic: 'fa-times', label: 'Below the pass mark' }; }
        // a knowledge check reviewed but not passed (the explicit pass, 10 Nov) is an open check, amber: a retake can still pass it
        if (s === 'not_passed') { return r.auto_type === 'questionnaire' ? { tone: 'warn', ic: 'fa-times', label: 'Not passed' } : { tone: 'bad', ic: 'fa-times', label: 'Not passed' }; }
        if (s === 'medical_expired' || s === 'medical_class_not_accepted') { return { tone: 'bad', ic: 'fa-times', label: 'Medical not valid' }; }
        return { tone: 'muted', ic: 'fa-circle', label: 'Not done yet' };
    }
    function reqRow(r) {
        var kind = r.auto_type || 'manual', so = r.sign_off && +r.sign_off.revoked !== 1 ? r.sign_off : null;
        var detail = isoWords(String(r.detail || '').trim());
        if (so) {
            detail = 'Signed off by ' + (so.signed_off_by_name || 'an instructor') + ' · ' + C.fDate(so.signed_off_at) + (so.expires_at ? ' · expires ' + C.fDate(so.expires_at) : '') + (so.notes ? ' · “' + String(so.notes).trim() + '”' : '');
        } else if (!detail && kind === 'manual') { detail = 'Waiting for an instructor to sign it off'; }
        return {
            id: +r.id, name: r.name || 'Requirement', kind: kind, kindLabel: REQ_KIND[kind] || 'Requirement', auto: !!r.auto_type, state: r.state, satisfied: !!r.satisfied || r.state === 'satisfied',
            s: reqState(r), detail: detail, so: so, courseId: +r.course_id || null, courseTitle: r.course_title || '', qid: +r.questionnaire_id || null,
            evidence: r.evidence || null, assignment: r.assignment || null, answers: r.answers || null, raw: r
        };
    }

    /* ── ground exams: every sitting (v1 showed one per exam), in order ── */
    function examRows(exams, records) {
        var byExam = {}, out = [], titles = {};
        (exams || []).forEach(function (e) { titles[+e.id] = e.title || 'Exam'; });
        (records || []).filter(function (x) { return +x.deleted !== 1; }).forEach(function (x) { (byExam[+x.exam_id] = byExam[+x.exam_id] || []).push(x); });
        var order = (exams || []).map(function (e) { return +e.id; });
        Object.keys(byExam).forEach(function (k) { if (order.indexOf(+k) < 0) { order.push(+k); } });
        order.forEach(function (eid) {
            var list = (byExam[eid] || []).slice().sort(function (a, b) { return ((+a.sitting || 0) - (+b.sitting || 0)) || String(a.date || '').localeCompare(String(b.date || '')) || (+a.id - +b.id); });
            list.forEach(function (x, i) {
                var pass = x.pass_fail === null || x.pass_fail === undefined || x.pass_fail === '' ? null : +x.pass_fail;
                var res = x.result === null || x.result === undefined || x.result === '' ? null : Math.round(parseFloat(x.result) * 10) / 10;
                out.push({ id: +x.id, examId: eid, title: titles[eid] || x.exam_title || 'Exam', sitting: +x.sitting || (i + 1), many: list.length > 1, set: x.set_no || '', result: res,
                    pass: pass, examiner: x.examiner || '', notes: x.notes || '', date: x.date ? String(x.date).slice(0, 10) : null, raw: x,
                    pill: pass === null ? P('muted', 'Not taken') : pass ? P('good', 'Passed', 'fa-check') : P('bad', 'Not passed', 'fa-times') });
            });
        });
        var notTaken = (exams || []).filter(function (e) { return !byExam[+e.id]; }).map(function (e) { return e.title || 'Exam'; });
        return { rows: out, notTaken: notTaken };
    }
    /* a questionnaire attempt on the course (training_records/student questionnaires[]; staff see unreleased scores) */
    function quizRow(q) {
        var st = q.status, rev = st === 'reviewed' || (+q.score_released === 1 && st !== 'submitted');
        // a granted retake reads status 'opened' + started:false (alex-3e, 10 Nov): set, not started, never "in progress"
        var notStarted = q.started === false || q.started === 0, outcome = q.review_outcome || null;
        var pill = outcome === 'passed' ? P('good', 'Passed', 'fa-check') : outcome === 'not_passed' ? P('warn', 'Not passed', 'fa-times') : rev ? P('good', 'Reviewed', 'fa-check') : st === 'submitted' ? P('warn', 'To review', 'fa-clipboard-check')
            : (st === 'in_progress' || st === 'opened') && !notStarted ? P('info', 'In progress', 'fa-pen')
            : (st === 'opened' || st === 'in_progress') && notStarted ? P('info', 'Set · not started', 'fa-paper-plane') : P('muted', 'Not started');
        var max = +q.max_score || 0;
        return { id: +q.attempt_id, title: q.questionnaire_title || 'Questionnaire', when: q.timing === 'post' ? 'After the lesson' : 'Before the lesson',
            attempt: +q.attempt_number || 1, at: q.submitted_at || null, pill: pill, review: !!q.needs_review || st === 'submitted',
            score: max ? { a: q.auto_score == null ? '—' : (Math.round(+q.auto_score * 10) / 10), b: max } : null, raw: q };
    }
}


/* stu-portal (an always-present host for the dialogs): moved to <body> while the page lives, so the fixed header and the page's
   stacking can't trap a dialog; ngAnimate off on it (it leaves <main class="ta-page">, where design.js turns it off). The
   dialogs inside it come and go with ng-if; the host itself is never ng-if'd (an ng-if element moved to body would take its
   end marker's later siblings with it on removal). */
app.directive('stuPortal', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            $animate.enabled(el, false);
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
}]);

/* stu-file: <input type="file" stu-file="vm.examFile($files)"> → the chosen files (the CAA portal certificate) */
app.directive('stuFile', ['$parse', function ($parse) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            var fn = $parse(attrs.stuFile);
            el.on('change', function () { var files = el[0].files; scope.$apply(function () { fn(scope, { $files: files }); }); el[0].value = ''; });
            scope.$on('$destroy', function () { el.off('change'); });
        }
    };
}]);


/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The page: Find a student, then the student (hero + Flights · Progress · Pre-solo · Exams & forms) and Edit a record.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.controller('InstructorStudentsV2Controller', InstructorStudentsV2Controller);
InstructorStudentsV2Controller.$inject = ['$scope', '$rootScope', '$state', '$stateParams', '$location', '$timeout', '$q', '$window', '$sce',
    'InsCore', 'StuV2Data', 'TrnV2Data', 'DebriefV2Data', 'TaComboMatch', 'ToastService', 'AuthenticationService', 'DesignRoutes'];
function InstructorStudentsV2Controller($scope, $rootScope, $state, $stateParams, $location, $timeout, $q, $window, $sce,
    InsCore, StuV2Data, TrnV2Data, DebriefV2Data, TaComboMatch, ToastService, AuthenticationService, DesignRoutes) {
    var vm = this, C = InsCore, D = StuV2Data, T = TrnV2Data, X = DebriefV2Data, M = TaComboMatch;
    var SELF = 'dashboard.v2.instructor_students', V1 = 'dashboard.manage_user.student_records';
    var TABS = ['flights', 'progress', 'presolo', 'exams', 'edit'];
    var HELP = { good: 'meets the standard', warn: 'practise it again', bad: 'teach it again', muted: 'not covered on that flight', info: 'graded' };
    var me = C.myId(), user = C.me();
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var findSeq = 0, stuSeq = 0, searchSeq = 0, searchTimer = null, left = false, lastUrl = null, leaving = false, flashTimer = null;
    var plural = C.plural, P = D.P;
    var entered = false, syncLater = false;

    vm.C = C;
    vm.D = D;
    vm.today = C.today();
    vm.view = null;                 // 'find' | 'student'
    vm.tab = 'flights';
    vm.club = null;
    vm.clubs = [];
    vm.F = { st: 'loading', chip: 'all', all: [], items: [], chips: [], counts: {}, showAll: false, gen: 0, more: null, toConfirm: 0 };
    vm.cbQ = '';
    vm.cbVer = 0;
    vm.findRes = null;              // the last student_search answer { q, mine, others, … }
    vm.findBusy = false;
    vm.X = null;                    // the student on screen
    vm.R = { chip: 'all', q: '', open: null, wx: null, more: false, hi: null, flash: null };   // Flights
    vm.Pg = { chip: 'all', q: '', open: null };                                                  // Progress
    vm.Ps = { sign: null, signF: {}, revoke: null, kc: null, kcF: {}, busy: null, kcBusy: null, kcNote: {} };   // Pre-solo
    vm.Ex = { open: null, del: null, busy: null, pdf: null };                                    // Exams & forms
    vm.E = null;                    // Edit a record
    vm.dlg = null;                  // the dialog on screen: { t: 'medical' | 'course' | 'export' | 'cfi' | 'exam' | 'hist' | 'removal' | 'identity' | 'leave', … }
    vm.skel = [0, 1, 2, 3, 4];
    vm.isAdmin = false;
    vm.originLabel = null;
    vm.phone = function () { return !!(phoneMq && phoneMq.matches); };
    vm.meId = me;
    vm.signPickerOpts = { allowPast: false };
    vm.examPickerOpts = { allowPast: true };
    /* a course's flight tag as typed ("INSTRUMENT FLYING" → "Instrument flying") */
    vm.tagName = function (t) { t = String(t || '').trim(); return t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
    vm.recCls = function (x) {
        if (x.grp) { return 'ta-group'; }
        var f = x.f, R = vm.R;
        return 'ta-row stu-rec ins-rise' + (R.open === f.id ? ' ta-row--open stu-rec--open' : '') + (f.ph ? ' stu-rec--import' : '') + (R.hi === f.id ? ' stu-rec--hi' : '') + (R.flash === f.id ? ' stu-rec--flash' : '');
    };
    vm.lessonCls = function (x) {
        if (x.grp) { return 'ta-group'; }
        var l = x.l;
        return 'ta-row ins-rise' + (vm.lessonOpenNow(l) ? ' ta-row--open' : '') + (l.state === 'next' ? ' stu-row--next' + (l.solo ? ' stu-row--solo' : '') : '');
    };
    /* a pre-solo row shows only its state pill when it has no action of its own */
    vm.reqPillOnly = function (r) {
        return !(r.kind === 'medical' || r.kc || r.state === 'pending_review' || (r.kind === 'questionnaire' && r.state === 'not_passed' && r.evidence) || (r.kind === 'manual' && !r.satisfied && vm.Ps.sign !== r.id)
            || (r.kind === 'manual' && r.satisfied && r.so && vm.Ps.revoke !== r.id) || (r.kind === 'exam' && !r.satisfied));
    };
    vm.medClassNames = function (m) { return m ? m.classes.map(function (c) { return c.t; }).join(' · ') || 'Medical' : ''; };
    vm.edScaleWords = function () { return vm.E && vm.E.scale ? vm.E.scale.map(function (g) { return g.t; }).join(' · ') : ''; };
    vm.edMark = function (text) {
        var q = vm.E ? String(vm.E.q || '').trim() : '', s = M.esc(text);
        if (q.length < 2) { return $sce.trustAsHtml(s); }
        var re = new RegExp('(' + q.split(/\s+/).filter(Boolean).map(function (t) { return M.esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig');
        return $sce.trustAsHtml(s.replace(re, '<mark class="ta-mark">$1</mark>'));
    };

    vm.origin = resolveOrigin();
    vm.originLabel = originLabel(vm.origin);

    $scope.$on('$destroy', function () { left = true; document.removeEventListener('keydown', onKey); if (searchTimer) { $timeout.cancel(searchTimer); } });
    document.addEventListener('keydown', onKey);
    $scope.$on('$locationChangeSuccess', fromUrl);
    $scope.$on('$stateChangeStart', leaveGuard);

    start();
    $timeout(function () { entered = true; if (syncLater) { syncLater = false; syncUrl(); } }, 0);

    /* ════════ start: the URL decides (club, student, course, tab, flight) ════════ */
    function start() {
        var p = $stateParams;
        vm.club = +p.club_id || D.savedClub() || firstClub();
        vm.isAdmin = isAdminAt(vm.club);
        if (+p.student_id) {
            openStudent({ id: +p.student_id }, { course: +p.course_id || null, tab: TABS.indexOf(p.tab) > -1 ? p.tab : 'flights', flight: +p.flight || null, fromUrl: true });
        } else {
            vm.view = 'find';
            syncUrl();
        }
        loadFind('first');
    }
    function firstClub() {
        var list = C.instructorClubs().concat(C.managerClubs());
        return list[0] || +user.current_club_instructor || null;
    }
    function isAdminAt(club) {
        var a = (user && user.access) || {}, cid = +club || 0;
        if (!cid) { return false; }
        return ['manager', 'super_admin'].some(function (r) { return (a[r] || []).some(function (c) { return +c === cid; }); });
    }
    function canEditAt(club) {
        var a = (user && user.access) || {}, cid = +club || +vm.club || 0;
        return ['instructor', 'manager', 'super_admin'].some(function (r) { return (a[r] || []).some(function (c) { return +c === cid; }); });
    }

    /* the URL follows the page (one stop in the browser history, as v1) */
    function urlParams() {
        var x = vm.view === 'student' && vm.X ? vm.X : null;
        return {
            club_id: vm.club || null,
            student_id: x ? x.id : null,
            course_id: x && x.courseId ? x.courseId : null,
            tab: x && vm.tab !== 'flights' ? vm.tab : null,
            flight: x && vm.tab === 'edit' && vm.E ? vm.E.pls : null
        };
    }
    function urlKey(p) { return [p.club_id || '', p.student_id || '', p.course_id || '', p.tab || '', p.flight || ''].join('|'); }
    /* Not during the entering transition: a replace in the same digest as the transition's own URL push replaces the PREVIOUS
       history entry (Home → Student records → Back then left the app). The first write waits for the next digest (entered). */
    function syncUrl() {
        if (!entered) { syncLater = true; return; }
        if (left || $state.current.name !== SELF) { return; }
        var p = urlParams();
        lastUrl = urlKey(p);
        $state.go('.', p, { location: 'replace', notify: true });
    }
    /* a URL change the page didn't make (a link to this page while it is open): follow it */
    function fromUrl() {
        if (left || $state.current.name !== SELF) { return; }
        // only this page's own URL: browser Back to another page fires this while the state is still ours
        if (!/\/manage_user\/student_records$/.test($location.path())) { return; }
        var s = $location.search(), p = { club_id: +s.club_id || null, student_id: +s.student_id || null, course_id: +s.course_id || null, tab: s.tab || null, flight: +s.flight || null };
        if (lastUrl === null || urlKey(p) === lastUrl) { return; }
        lastUrl = urlKey(p);
        if (p.club_id && p.club_id !== vm.club) { vm.club = p.club_id; vm.isAdmin = isAdminAt(vm.club); loadFind('first'); }
        if (p.student_id && (!vm.X || vm.X.id !== p.student_id || (p.course_id && p.course_id !== vm.X.courseId))) {
            openStudent({ id: p.student_id }, { course: p.course_id, tab: TABS.indexOf(p.tab) > -1 && p.tab !== 'edit' ? p.tab : 'flights', flight: p.flight, fromUrl: true });
        } else if (!p.student_id && vm.view === 'student') { showFind(); }
        else if (p.student_id && p.tab && p.tab !== vm.tab && p.tab !== 'edit' && TABS.indexOf(p.tab) > -1) { setTab(p.tab); }
    }

    /* ── where BACK goes: the page the user came from (v1's rule and its sessionStorage key, so both designs agree) ── */
    function readOrigin() { try { return JSON.parse(sessionStorage.getItem(D.ORIGIN_KEY) || 'null'); } catch (e) { return null; } }
    function writeOrigin(o) { try { sessionStorage.setItem(D.ORIGIN_KEY, JSON.stringify(o)); } catch (e) { /* storage off */ } }
    function same(a, b) { return !!a && !!b && (a === b || DesignRoutes.v2For(a) === b || DesignRoutes.v2For(b) === a || DesignRoutes.v1For(a) === b || DesignRoutes.v1For(b) === a); }
    function resolveOrigin() {
        var prev = $rootScope.previousState, stored = readOrigin();
        if (prev && prev.name && !same(prev.name, SELF) && prev.name !== V1) {
            var returning = stored && stored.excursion && same(stored.excursion, prev.name);
            if (!returning) { stored = { name: prev.name, params: prev.params || {} }; }
        }
        if (stored) { stored.excursion = null; writeOrigin(stored); }
        if (!stored || !stored.name || same(stored.name, SELF) || stored.name === V1) { return null; }
        var st = $state.get(stored.name);
        return st && !st.abstract ? stored : null;
    }
    function originLabel(o) {
        if (!o) { return null; }
        if (D.ORIGIN_LABELS[o.name]) { return D.ORIGIN_LABELS[o.name]; }
        var st = $state.get(o.name);
        return (st && st.data && st.data.hub && st.data.hub.title) || null;
    }
    /* leave for a page that comes back here (its Back / Save return), keeping this page's origin for the return */
    function goAndReturn(state, params) {
        var o = readOrigin();
        if (o) { o.excursion = state; writeOrigin(o); }
        $state.go(state, params || {});
    }
    vm.goOrigin = function () {
        if (vm.origin) { $state.go(vm.origin.name, vm.origin.params || {}); } else { $state.go('dashboard.manage_user'); }
    };
    /* the hero's back link: the find page when the student was picked there (or nothing else is known), else the origin */
    vm.heroBack = function () {
        if (vm.X && !vm.X.fromFind && vm.origin) { vm.goOrigin(); return; }
        showFind();
    };
    vm.heroBackLabel = function () { return vm.X && !vm.X.fromFind && vm.origin && vm.originLabel ? vm.originLabel : 'Student records'; };

    /* ════════════════════════════════ FIND A STUDENT ════════════════════════════════ */
    function loadFind(how) {
        var my = ++findSeq, F = vm.F;
        if (!vm.club) { F.st = 'noclub'; return; }
        if (how === 'first' || F.st !== 'ready') { F.st = 'loading'; }
        var rows = [], first = null;
        function page(offset) {
            return D.students(vm.club, { scope: 'mine', limit: 100, offset: offset }).then(function (res) {
                if (my !== findSeq) { return null; }
                if (!res || res.success === false || !angular.isArray(res.students)) { return res || { success: false }; }
                if (!first) { first = res; }
                rows = rows.concat(res.students);
                if (res.more && res.students.length && rows.length < 600) { return page(rows.length); }
                first.students = rows;
                return first;
            });
        }
        page(0).then(function (res) {
            if (my !== findSeq || !res) { return; }
            if (res.success === false) {
                // a club this user doesn't instruct at (a stale remembered one): try their first club once
                // a club this user doesn't teach at (a stale remembered one, or a link from another club's page): the find page moves to
                // their first club; a student opened by that link stays on the link's club (their records answer, or say no access)
                if ((res.error === 'FORBIDDEN' || res.status === 403) && vm.view === 'find' && vm.club !== firstClub() && firstClub()) { vm.club = firstClub(); vm.isAdmin = isAdminAt(vm.club); syncUrl(); loadFind('first'); return; }
                F.st = res.error === 'FORBIDDEN' || res.status === 403 ? 'forbidden' : 'error';
                return;
            }
            vm.clubs = (res.clubs || []).map(function (c) {
                var t = String(c.title || 'Club').trim();
                return { id: +c.club_id, title: t, short: clubShort(t), mine: +c.my_students || 0, members: +c.member_count || 0, everyone: !!c.can_see_everyone };
            });
            if (vm.clubs.length && !clubObj()) { vm.club = vm.clubs[0].id; vm.isAdmin = isAdminAt(vm.club); syncUrl(); loadFind('first'); return; }
            var c = clubObj();
            if (c) { c.mine = +((res.counts || {}).all) || c.mine; }
            F.counts = res.counts || {};
            F.all = (res.students || []).map(function (s) { return D.studentRow(s, me); });
            F.toConfirm = F.all.reduce(function (a, r) { return a + r.toConfirm; }, 0);
            if (how !== 'quiet') { F.gen++; }   // a quiet refresh (after a confirm) changes rows in place, nothing rises again
            F.st = 'ready';
            regroup();
            vm.cbVer++;
            if (vm.X && !vm.X.row) { vm.X.row = rowFor(vm.X.id); }
            if (vm.X) { heroFacts(); }   // the club's name in the hero
        });
    }
    function clubObj() { for (var i = 0; i < vm.clubs.length; i++) { if (vm.clubs[i].id === vm.club) { return vm.clubs[i]; } } return null; }
    vm.clubObj = clubObj;
    vm.clubTitle = function () { var c = clubObj(); return c ? c.title : 'your club'; };
    function clubShort(t) {
        var s = String(t || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^the\s+/i, '').replace(/\s+(flying|aero|gliding|flight)?\s*(club|school)\b.*$/i, '').trim();
        return s || t;
    }
    function rowFor(id) { var r = null; vm.F.all.forEach(function (x) { if (x.id === id) { r = x; } }); return r; }

    vm.setClub = function (id) {
        id = +id;
        if (vm.club === id) { return; }
        vm.club = id; vm.isAdmin = isAdminAt(id);
        D.rememberClub(id);
        vm.F.chip = 'all'; vm.F.showAll = false; vm.findRes = null; vm.cbQ = '';
        syncUrl();
        loadFind('club');
    };
    vm.retryFind = function () { loadFind('first'); };
    vm.setChip = function (k) { if (vm.F.chip === k) { return; } vm.F.chip = k; vm.F.showAll = false; vm.F.gen++; regroup(); };
    vm.showAllStudents = function () { vm.F.showAll = true; regroup(); };
    function regroup() {
        var F = vm.F, chip = F.chip, n = F.counts || {};
        F.chips = [['all', 'All', n.all], ['needs', 'Needs you', n.needs_you, true], ['solo', 'Before the first solo', n.before_first_solo], ['idle', 'Not flown for 30 days', n.idle_30]]
            .map(function (c) { return { k: c[0], label: c[1], n: +c[2] || 0, attn: !!c[3] }; })
            .filter(function (c) { return c.k === 'all' || c.n > 0 || c.k === chip; });
        F.all.forEach(function (r) { if (!r.href) { r.href = $state.href(SELF, { club_id: vm.club, student_id: r.id, course_id: r.course ? r.course.id : null }); } });
        var keep = F.all.filter(function (r) { return chip === 'all' || (chip === 'needs' && r.needs) || (chip === 'solo' && r.solo) || (chip === 'idle' && r.idle); });
        var groups = [
            ['needs', 'Needs you', 'fa-exclamation-circle', keep.filter(function (r) { return r.needs; })],
            ['recent', 'Flown in the last 30 days', null, keep.filter(function (r) { return !r.needs && r.lastDate && !r.idle; })],
            ['older', 'Not flown for 30 days or more', null, keep.filter(function (r) { return !r.needs && (!r.lastDate || r.idle); })]
        ];
        var cap = F.showAll ? 100000 : 30, shown = 0, items = [], i = 0;
        groups.forEach(function (g) {
            var rows = g[3].filter(function () { return shown++ < cap; });
            if (!rows.length) { return; }
            items.push({ grp: true, key: 'g:' + g[0], label: g[1], ic: g[2], attn: g[0] === 'needs', n: plural(g[3].length, 'student'), i: i++ });
            rows.forEach(function (r) { items.push({ key: 's:' + r.id, r: r, i: i++ }); });
        });
        F.items = items;
        F.shownN = Math.min(cap, keep.length);
        F.keepN = keep.length;
        F.more = keep.length > cap ? { shown: cap, total: keep.length } : null;
    }

    /* ── the live search (picker B): your students first, then everyone else at the club (2+ letters, on the server) ── */
    function score(r, q) {
        var t = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean), sc = 0;
        if (!t.length) { return 1; }
        var f = String(r.first || '').toLowerCase(), l = String(r.last || '').toLowerCase(), full = f + ' ' + l, e = String(r.email || '').toLowerCase();
        for (var i = 0; i < t.length; i++) { var x = t[i], s = f.indexOf(x) === 0 ? 100 : l.indexOf(x) === 0 ? 90 : full.indexOf(x) > -1 ? 60 : e.indexOf(x) > -1 ? 40 : 0; if (!s) { return 0; } sc += s; }
        return sc;
    }
    function mineCombo(r) {
        return { key: 'u:' + r.id, data: { id: r.id, first: r.first, last: r.last, course: r.course }, av: { member: true, title: 'Member' }, t: r.name,
            s: (r.email ? r.email + ' · ' : '') + r.sub, r: r.lastDate ? (C.dayWord(r.lastDate) || C.fDay(r.lastDate)) : '—', rs: r.lastDate ? 'last flown' : '' };
    }
    function otherCombo(s) {
        var course = s.course ? (s.course.title || s.course.short_title) : '', nl = s.next_lesson;
        var kind = s.kind === 'ex_member' ? 'Ex-member' : s.kind === 'records_only' ? 'Records only' : ((s.membership && (s.membership.name || s.membership.label)) || 'Member');
        if (s.mine) { return mineCombo(D.studentRow(s, me)); }
        return { key: 'u:' + s.user_id, data: { id: +s.user_id, first: s.first_name, last: s.last_name, course: s.course ? { id: +s.course.id, title: course } : null },
            av: { member: true, title: 'Member' }, t: D.name(s.first_name, s.last_name) || 'Member', s: (s.email ? s.email + ' · ' : '') + kind,
            r: course || 'No training records', rs: course ? (s.imported ? 'imported' : nl ? 'at ' + D.lessonCode(nl) : '') : '', quiet: !course };
    }
    vm.findSource = function (q) {
        var t = String(q || '').trim(), c = clubObj(), title = c ? c.title : 'the club', members = c && c.members ? c.members.toLocaleString('en-GB') : '';
        var mine = vm.F.all;
        var empty = { t: 'Nobody at ' + title + ' matches “' + t + '”', s: 'Try the first few letters of the first name or the surname, or part of the e-mail.' };
        if (!t) {
            var recent = mine.filter(function (r) { return r.lastDate; }).sort(function (a, b) { return a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0; }).slice(0, 6);
            return { groups: [{ label: 'Your students · flown most recently', right: plural(mine.length, 'student'), rows: recent.map(mineCombo) }],
                foot: 'Type a name or e-mail to search all ' + (members ? members + ' ' : '') + 'members of ' + title, empty: { t: 'No students of yours here yet', s: 'Type a name or e-mail to search everyone at ' + title + '.' } };
        }
        var local = mine.map(function (r) { return { r: r, s: score(r, t) }; }).filter(function (x) { return x.s > 0; })
            .sort(function (a, b) { return (b.s - a.s) || (a.r.name < b.r.name ? -1 : 1); }).map(function (x) { return x.r; });
        if (t.length < 2) {
            return { groups: [{ label: 'Your students', right: plural(local.length, 'match', 'matches'), rows: local.slice(0, 5).map(mineCombo) },
                { label: 'Other members of ' + title, rows: [{ hint: true, t: 'Type one more letter to search all ' + (members ? members + ' ' : '') + 'members' }] }], empty: empty };
        }
        var res = vm.findRes && vm.findRes.q === t ? vm.findRes : null;
        if (!res) {
            return { groups: [{ label: 'Your students', right: plural(local.length, 'match', 'matches'), rows: local.slice(0, 5).map(mineCombo) }], busy: 'Searching everyone at ' + title + '…', empty: empty };
        }
        var mineRows = (res.mine || []).slice(0, 5).map(otherCombo), others = (res.others || []).slice(0, 6).map(otherCombo);
        var mt = +res.mine_total || (res.mine || []).length, ot = +res.others_total || (res.others || []).length, shown = mineRows.length + others.length;
        return {
            groups: [
                { label: 'Your students', right: plural(mt, 'match', 'matches'), rows: mineRows },
                { label: 'Other members of ' + title, right: plural(ot, 'match', 'matches'), rows: others }
            ],
            foot: (mt + ot > shown || res.more) ? 'Showing ' + shown + ' of ' + (mt + ot) + ' matches · keep typing to narrow it down' : '',
            empty: res.failed ? { t: 'The search didn’t answer', s: 'Check your connection, then type again.' } : empty
        };
    };
    vm.findType = function (q) {
        var t = String(q || '').trim();
        if (searchTimer) { $timeout.cancel(searchTimer); searchTimer = null; }
        if (t.length < 2 || !vm.club) { return; }
        if (vm.findRes && vm.findRes.q === t) { return; }
        var my = ++searchSeq, club = vm.club;
        searchTimer = $timeout(function () {
            D.search(club, t).then(function (res) {
                if (my !== searchSeq || club !== vm.club) { return; }
                vm.findRes = res && res.success !== false ? angular.extend({}, res, { q: t }) : { q: t, mine: [], others: [], failed: true };
                vm.cbVer++;
            });
        }, 180);
    };
    vm.findClear = function () { vm.cbQ = ''; vm.findRes = null; };
    vm.findPick = function (key, row) { if (row && row.data) { openStudent(row.data, { course: row.data.course ? row.data.course.id : null, fromFind: true }); } };
    vm.openRow = function (r, ev) { if (ev) { ev.preventDefault(); } openStudent({ id: r.id, first: r.first, last: r.last, course: r.course }, { course: r.course ? r.course.id : null, fromFind: true }); };

    function showFind() {
        if (vm.tab === 'edit' && vm.E && vm.E.dirty && !leaving) { vm.dlg = { t: 'leave', then: showFind }; return; }
        vm.view = 'find'; vm.X = null; vm.E = null; vm.dlg = null; vm.tab = 'flights';
        syncUrl();
        scrollTop();
        if (vm.F.st !== 'ready') { loadFind('first'); } else { vm.F.gen++; }
    }
    vm.showFind = showFind;
    function scrollTop() { $timeout(function () { if ($window.scrollTo) { $window.scrollTo(0, 0); } }, 0, false); }

    /* ════════════════════════════════ THE STUDENT ════════════════════════════════ */
    /* who: { id, first?, last?, course? } · o: { course, tab, flight, fromFind, fromUrl } */
    function openStudent(who, o) {
        o = o || {};
        var row = rowFor(who.id);
        vm.view = 'student';
        vm.tab = o.tab && o.tab !== 'edit' ? o.tab : 'flights';
        vm.E = null; vm.dlg = null;
        vm.R = { chip: 'all', q: '', open: null, wx: null, more: false, hi: null, flash: null };
        vm.Pg = { chip: 'all', q: '', open: null };
        vm.Ps = { sign: null, signF: {}, revoke: null, kc: null, kcF: {}, busy: null, kcBusy: null, kcNote: {} };
        vm.Ex = { open: null, del: null, busy: null, pdf: null };
        var first = who.first || (row && row.first) || '', last = who.last || (row && row.last) || '';
        vm.X = { id: +who.id, first: first, last: last, name: D.name(first, last), st: 'loading', courseId: +o.course || null, fromFind: !!o.fromFind,
            row: row, link: +o.flight || null, editLink: o.tab === 'edit' && +o.flight ? +o.flight : null, med: null, medSt: 'loading', solo: null, soloSt: 'loading',
            docs: [], unfiled: [], unfiledTotal: 0, snap: null, courses: [], clubCourses: null, gen: 0 };
        syncUrl();
        if (!o.fromUrl) { scrollTop(); }
        loadStudent();
    }
    vm.openStudent = openStudent;

    function loadStudent() {
        var my = ++stuSeq, x = vm.X, club = vm.club;
        var snap = D.snapshot(x.id, club);
        snap.then(function (s) { if (my !== stuSeq) { return; } applySnap(s); });
        loadMedical(my);
        if (!x.courseId) {
            // no course in the link: the student's focus course (the snapshot's rule), else the one with the latest records
            snap.then(function (s) {
                if (my !== stuSeq) { return; }
                var cs = (s && s.courses) || [], focus = +(s && s.focus_course_id) || 0;
                var best = cs.filter(function (c) { return +c.id === focus; })[0] || cs.slice().sort(function (a, b) { return String(b.last_flight || '').localeCompare(String(a.last_flight || '')); })[0];
                x.courseId = best ? +best.id : (x.row && x.row.course ? x.row.course.id : null);
                if (!x.courseId) {
                    // nothing on any course: the club's first course, so every tab can say what will appear
                    clubCourses().then(function (list) { if (my !== stuSeq) { return; } x.courseId = list.length ? list[0].id : null; syncUrl(); loadCourse(my); });
                    return;
                }
                syncUrl();
                loadCourse(my);
            });
        } else { loadCourse(my); }
    }
    function applySnap(s) {
        var x = vm.X;
        if (!s || s.success === false) { x.snap = null; return; }
        x.snap = s;
        var st = s.student || {};
        if (!x.first && st.first_name) { x.first = st.first_name; x.last = st.last_name || ''; x.name = D.name(x.first, x.last); }
        x.membership = st.membership_name || st.membership_label || '';
        x.memberLabel = st.membership_label || '';
        x.memberSince = st.member_since || null;
        x.courses = (s.courses || []).map(function (c) { return { id: +c.id, title: c.title || 'Course', records: +c.records || 0, last: c.last_flight || null, hours: +c.hours || 0, lessons: +c.lessons_total || 0 }; });
        heroFacts();
    }
    function clubCourses() {
        var x = vm.X;
        if (x && x.clubCourses) { return $q.when(x.clubCourses); }
        return D.clubCourses(vm.club).then(function (res) {
            var rows = ((res && res.items) || []).filter(function (c) { return c && +c.deleted !== 1; });
            rows = D.sortCourses(rows);   // the club's own order (as v1's pickers)
            var list = rows.map(function (c) { return { id: +c.id, title: c.title || 'Course', lessons: c.lesson_count != null ? +c.lesson_count : null }; });
            if (x) { x.clubCourses = list; }
            return list;
        });
    }

    function loadCourse(my) {
        var x = vm.X, cid = x.courseId;
        if (!cid) { x.st = 'nocourse'; heroFacts(); tabs(); return; }
        x.st = x.p ? 'reload' : 'loading';
        $q.all([D.records(x.id, cid), D.lessons(cid), D.nextLesson(x.id, cid), clubCourses()]).then(function (r) {
            if (my !== stuSeq) { return; }
            var payload = r[0];
            if (!payload || payload.success === false) {
                x.st = 'error';
                x.err = payload && (payload.error === 'FORBIDDEN' || payload.status === 403) ? 'forbidden' : 'load';
                x.errMsg = D.msg(payload);
                return;
            }
            build(payload, r[1], r[2]);
            followCourseClub(payload, my);
            loadSolo(my);
            loadDocs(my);
            loadUnfiled(my);
            afterBuild();
        });
    }
    /* A link can carry a club the viewer doesn't teach at (another club's page, an old e-mail): the records say whose course it
       is, so the club-scoped reads (medical file, pre-solo, documents, the club's courses and names) follow the course's club */
    function followCourseClub(payload, my) {
        var x = vm.X, row = (payload.training_records || [])[0] || (payload.log_sheets || [])[0], cc = row ? +row.club_id : 0;
        if (!cc || cc === +vm.club) { return; }
        vm.club = cc; vm.isAdmin = isAdminAt(cc); x.clubCourses = null;
        syncUrl();
        D.snapshot(x.id, cc).then(function (s) { if (my === stuSeq) { applySnap(s); } });
        loadMedical(my);
        clubCourses().then(function () { if (my === stuSeq) { heroFacts(); } });
        loadFind('first');
    }
    vm.retryStudent = function () { loadCourse(++stuSeq); loadMedical(stuSeq); };

    /* the records → flights, lessons, exams (TrnV2Data's mapping: the student's own page reads the same endpoint) */
    function build(payload, lessonsRes, next) {
        var x = vm.X, st = payload.student || {};
        if (st.first_name) { x.first = st.first_name; x.last = st.last_name || ''; x.name = D.name(x.first, x.last); }
        var lessons = T.lessonList((lessonsRes && lessonsRes.items) || []);
        var p = T.progress(lessons, payload, x.id, next && next.success !== false ? next : null);
        x.payload = payload; x.p = p; x.G = p.G;
        x.cfiAllowed = !!payload.can_confirm_for_instructor;
        x.courseTitle = courseTitle(x.courseId);
        // colours: an instructor's from the flight rows (C20), an aircraft's from its flights
        x.insColour = {}; x.acColour = {}; x.acType = {};
        (payload.log_sheets || []).forEach(function (ls) {
            var n = D.name(ls.instructor_first_name, ls.instructor_last_name); if (n && ls.instructor_colour) { x.insColour[n] = ls.instructor_colour; }
            var pn = D.name(ls.pic_first_name, ls.pic_last_name); if (pn && ls.pic_colour) { x.insColour[pn] = ls.pic_colour; }
            if (ls.registration) { x.acColour[ls.registration] = ls.aircraft_colour || x.acColour[ls.registration] || ''; x.acType[ls.registration] = ls.plane_type || ''; }
        });
        x.itemLesson = {}; x.itemTitle = {};
        (payload.all_items || []).forEach(function (it) { x.itemLesson[+it.id] = +it.lesson_id; x.itemTitle[+it.id] = it.title || ''; });
        x.lessonById = {}; p.lessons.forEach(function (l) { x.lessonById[l.id] = l; l.code = l.code || l.ref || String(l.n); });
        x.legend = p.G.legend.map(function (g) { return { name: g.name, cls: 'ta-pill--' + g.tone, ic: g.ic, help: HELP[g.tone] || 'graded' }; });
        x.flights = p.flights.slice().reverse().map(decorate);
        x.byPls = {}; x.flights.forEach(function (f) { x.byPls[f.id] = f; });
        x.mineAw = x.flights.filter(function (f) { return f.mineAw; });
        lessonRows();
        var ex = D.examRows(payload.exams, payload.exam_records);
        x.exams = ex.rows; x.notTaken = ex.notTaken; x.examList = (payload.exams || []).filter(function (e) { return +e.deleted !== 1; });
        x.quiz = (payload.questionnaires || []).map(D.quizRow);
        quizWords();
        x.st = 'ready';
        x.gen++;
        if (vm.tab === 'progress') { openLatestLesson(); }
        heroFacts();
        tabs();
        flightList();
    }
    function courseTitle(id) {
        var x = vm.X, t = '';
        (x.courses || []).forEach(function (c) { if (c.id === +id) { t = c.title; } });
        (x.clubCourses || []).forEach(function (c) { if (!t && c.id === +id) { t = c.title; } });
        if (!t && x.row && x.row.course && x.row.course.id === +id) { t = x.row.course.title; }
        return t || 'Course';
    }
    function ins(nameStr, id) {
        var x = vm.X, n = String(nameStr || '').trim();
        if (!n) { return null; }
        return { name: n, code: D.initials(n), colour: (x && x.insColour[n]) || D.avColour(id || n.length * 7), title: n + ' (instructor)', you: +id === me };
    }
    function first(n) { return C.firstName(n); }
    function youOr(n, id) { return (+id && +id === me) ? 'you' : n; }

    /* ── one flight on the course, from the instructor's seat ── */
    function decorate(f) {
        var x = vm.X, tr = f.tr, ls = f.ls || {};
        f.recId = tr ? +tr.id : null;
        f.recAt = tr ? (tr.recorded_at || tr.created_at || null) : null;          // first filed (kept through edits)
        f.isEdited = !!tr && (tr.edited === true || +tr.edited === 1);         // the ONLY "changed after filing" signal
        f.insId = tr ? +tr.instructor_id : +ls.instructor_id || 0;
        f.insAv = f.ins && f.ins.name ? { code: f.ins.code, colour: f.ins.colour || D.avColour(f.insId), title: f.ins.name + ' (instructor)' } : null;
        f.mine = !!tr && f.insId === me;
        f.mineAw = !!(tr && f.onBehalf && f.awaiting && f.mine);
        f.canCfi = !!(tr && f.onBehalf && f.awaiting && !f.mine && x.cfiAllowed);
        f.cfiFor = !!(tr && +tr.confirmed_for_instructor === 1);
        f.kind = f.role === 'solo' ? 'solo' : 'dual';
        f.kindWord = f.role === 'solo' ? 'Solo' : f.role === 'picus' ? 'PICUS' : 'Dual';
        f.hm = C.hmMin(f.mins);
        f.dayLong = C.fDayLong(f.date);
        f.day = C.fDay(f.date);
        f.month = C.fMonth(f.date);
        f.recOff = X.hhmm(ls.brakes_off); f.recOn = X.hhmm(ls.brakes_on);
        f.recorded = (f.recOff && f.recOn && (f.recOff !== f.from || f.recOn !== f.to)) ? f.recOff + '–' + f.recOn : '';
        f.acModel = f.model || '';
        f.pills = recPills(f);
        f.countPills = f.counts.map(function (c) { return { cls: 'ta-pill--' + c.g.tone, label: c.n + ' ' + c.g.name, ic: c.g.ic }; });
        f.workText = f.work.length ? f.work[0].title + (f.work.length > 1 ? ' +' + (f.work.length - 1) + ' more' : '') : '';
        // the objectives graded on this flight, by lesson (a heading only when more than one lesson, or not the record's own)
        var byL = {}, order = [];
        f.grades.forEach(function (g) {
            var lid = x.itemLesson[g.id] || (f.lesson ? f.lesson.id : 0);
            if (!byL[lid]) { byL[lid] = []; order.push(lid); }
            byL[lid].push({ t: g.title || x.itemTitle[g.id] || 'Objective', pill: { cls: 'ta-pill--' + g.g.tone, label: g.g.name, ic: g.g.ic }, rem: g.rem });
        });
        f.objGroups = order.map(function (lid) { var L = x.lessonById[lid]; return { head: (order.length > 1 || !f.lesson || lid !== f.lesson.id) && L ? L.code + ' ' + L.title : '', rows: byL[lid] }; });
        f.objN = f.grades.length;
        var lt = f.lesson ? Math.max(f.lesson.items.length, f.lesson.itemsTotal || 0) : 0;
        f.objOf = f.lesson ? lt : 0;
        f.skipped = f.lesson ? Math.max(0, lt - (byL[f.lesson.id] || []).length) : 0;
        f.remarkAv = f.insAv;
        f.ficTitle = f.role === 'solo' ? 'Pilot in command · authorised by' : 'Pilot in command · student';
        f.canEdit = !!tr && !f.ph && canEditAt(vm.club);
        f.trail = trail(f);
        f.hay = (f.hay || '') + ' ' + M.norm(f.reg).toLowerCase() + ' ' + (f.lesson ? f.lesson.code.toLowerCase() : '');
        f.lessonRef = f.lesson ? f.lesson.code : '';
        if (!f.ph && f.lesson) { f.title = f.lesson.code + ' · ' + f.lesson.title; }
        return f;
    }
    function recPills(f) {
        if (f.ph) { return [P('stu-pill--import', 'Import note only', 'fa-file-import')]; }
        if (!f.tr) { return [P('muted', 'No debrief yet', 'fa-pen')]; }
        var out = [];
        if (f.lesson) { out.push(f.completed ? P('good', 'Lesson signed off', 'fa-check') : P('info', 'Lesson to repeat', 'fa-redo')); }
        if (f.onBehalf && f.awaiting) { out.push(angular.extend(f.mine ? P('warn', 'Awaiting your confirmation', 'fa-pen-nib') : P('pend', 'Awaiting ' + first(f.recIns) + '\'s confirmation', 'fa-hourglass-half'), { aw: true })); }
        if (f.onBehalf && f.confirmed) { out.push(f.cfiFor ? P('good', 'Confirmed for ' + first(f.recIns), 'fa-user-check') : P('good', 'Confirmed by ' + first(f.confirmed.by), 'fa-user-check')); }
        if (f.imp) { out.push(P('muted', 'Imported', 'fa-file-import')); }
        return out;
    }
    /* the record's trail. "Edited" only when the backend says so (`edited`, alex-3e 10 Nov): edited_by is written on filing too,
       and edit_reason can be a filing override note (D15). "Recorded" is the first filing (`recorded_at`, kept through edits; an
       edited row's created_at is the edit time). */
    function trail(f) {
        var tr = f.tr, out = [];
        if (!tr) { return out; }
        if (f.onBehalf && f.enteredBy) { out.push({ a: 'Entered by ', b: f.enteredBy, c: ' for ' + (f.recIns || 'the instructor') + ' · ' + C.fDate(f.recAt || f.date) }); }
        else { out.push({ a: f.imp || f.ph ? 'Imported · filed under ' : 'Recorded by ', b: f.recIns || f.insName || 'the instructor', c: ' · ' + C.fDate(f.recAt || f.date) }); }
        if (f.confirmed) {
            if (f.cfiFor) { out.push({ a: 'Confirmed for ' + (f.recIns || 'the instructor') + ' by ', b: f.confirmed.by, c: ' · ' + C.fDate(f.confirmed.at) + (tr.instructor_confirm_note ? ' — “' + tr.instructor_confirm_note + '”' : '') }); }
            else { out.push({ a: 'Confirmed by ', b: f.confirmed.by, c: ' · ' + C.fDate(f.confirmed.at) }); }
        }
        if (f.isEdited) {
            var by = tr.edited_by_id != null && +tr.edited_by_id === me ? 'you' : String(tr.edited_by_name || '').trim();
            out.push({ a: 'Edited' + (tr.edited_at ? ' ' + C.fDate(tr.edited_at) : '') + (by ? ' by ' : ''), b: by, c: tr.edit_reason ? ' — “' + String(tr.edit_reason).trim() + '”' : '' });
        }
        return out;
    }

    /* ── the hero: where the student is, at a glance ── */
    function heroFacts() {
        var x = vm.X;
        if (!x) { return; }
        x.courseTitle = x.courseId ? courseTitle(x.courseId) : '';
        var p = x.p, has = !!(p && p.flights.length), facts = [];
        if (has) {
            var L = p.next != null ? p.lessons[p.next] : null, latestL = null;
            p.flights.forEach(function (f) { if (f.lesson && f.tr && !f.ph) { latestL = f; } });
            var doneL = latestL && p.st[latestL.lesson.i].done;
            var open = x.reqs ? x.reqs.filter(function (r) { return !r.satisfied; }).length : null;
            facts.push({ k: 'Lessons signed off', v: p.signed + ' of ' + p.lessons.length, s: p.signed && doneL ? latestL.lesson.code + ' signed off ' + C.fDay(doneL.date) : 'Signed off by an instructor' });
            facts.push({ k: 'Up next', v: L ? L.code + ' ' + L.title : '—', s: L ? (p.complete ? 'Course complete' : p.repeat ? 'A repeat of the last lesson' : L.solo && p.next === p.firstSolo ? 'First solo' + (open != null ? ' · ' + plural(open, 'pre-solo check') + ' open' : '') : L.solo ? 'Solo lesson' : 'Dual lesson') : 'From the latest record' });
            var lt = p.latest, li = vm.X.byPls && lt ? vm.X.byPls[lt.id] : null;
            facts.push({ k: 'Last flown', v: C.dayWord(lt.date) === 'Today' || C.dayWord(lt.date) === 'Yesterday' ? C.dayWord(lt.date) : C.fDay(lt.date), s: 'with ' + (li && li.mine ? 'you' : (lt.insName || 'an instructor')) + (lt.reg ? ' · ' + lt.reg : '') });
            facts.push({ k: 'Course hours', v: C.hmMin(p.totalMins), s: 'Brakes off to on · ' + plural(p.flights.length, 'flight') });
            x.since = p.flights[0].date;
        } else {
            facts.push({ k: 'Course', v: x.courseTitle || 'No course', s: 'No records yet' });
            if (x.memberSince) { facts.push({ k: 'Member since', v: C.fDay(x.memberSince), s: x.membership || x.memberLabel || 'Member' }); }
            else { facts.push({ k: 'Membership', v: x.membership || 'Member', s: x.memberLabel && x.memberLabel !== x.membership ? x.memberLabel : 'At ' + vm.clubTitle() }); }
            facts.push({ k: 'Course hours', v: '0:00', s: 'Nothing flown on this course' });
            x.since = null;
        }
        x.facts = facts;
        x.sub = [x.courseTitle, vm.clubTitle()].filter(Boolean).join(' · ') + (x.since ? ' · training since ' + C.fDate(x.since) : '');
    }
    function tabs() {
        var x = vm.X, p = x.p;
        var t = [{ k: 'flights', ic: 'fa-plane', label: 'Flights', n: p ? p.flights.length : 0 }, { k: 'progress', ic: 'fa-tasks', label: 'Progress', n: 0 }];
        if (x.reqs && x.reqs.length && p && p.lessons.length) { t.push({ k: 'presolo', ic: 'fa-user-check', label: 'Pre-solo', n: x.reqs.filter(function (r) { return !r.satisfied; }).length }); }
        t.push({ k: 'exams', ic: 'fa-graduation-cap', label: 'Exams & forms', n: 0 });
        x.tabs = t;
        if (vm.tab === 'presolo' && x.soloSt === 'ready' && !t.some(function (y) { return y.k === 'presolo'; })) { vm.tab = 'flights'; syncUrl(); }
    }
    function openLatestLesson() {
        var x = vm.X, p = x && x.p, L = null;
        if (!p || vm.Pg.open != null) { return; }
        p.flights.forEach(function (f) { if (f.lesson && f.tr && !f.ph) { L = f.lesson; } });
        if (L) { vm.Pg.open = L.i; }
    }
    function setTab(k) {
        if (vm.tab === k) { return; }
        if (vm.tab === 'edit' && vm.E && vm.E.dirty && !leaving) { vm.dlg = { t: 'leave', then: function () { setTab(k); } }; return; }
        vm.tab = k; vm.E = null;
        if (k === 'flights') { flightList(); }
        if (k === 'progress') { openLatestLesson(); }
        syncUrl();
    }
    vm.setTab = setTab;
    function afterBuild() {
        var x = vm.X;
        // ?flight= : Flights with that record open and highlighted once (then the URL lets it go, as v1 consumed it)
        if (x.editLink) { var e = x.byPls[x.editLink]; x.editLink = null; x.link = null; if (e && e.canEdit) { vm.edit(e); return; } }
        if (x.link) {
            var f = x.byPls[x.link];
            x.link = null;
            if (f) {
                vm.tab = 'flights';
                // the design keeps "Showing the newest 30": unfold the rest only when the linked flight is older than that
                vm.R.open = f.id; vm.R.hi = f.id; vm.R.more = x.flights.indexOf(f) >= 30; vm.R.linked = vm.origin && !vm.X.fromFind ? f.id : null;
                flightList();
                flash(f.id);
            }
            syncUrl();
            return;
        }
    }
    /* scroll a record into view and flash it once */
    function flash(id) {
        vm.R.flash = id;
        if (flashTimer) { $timeout.cancel(flashTimer); }
        $timeout(function () { var el = document.getElementById('stu-r' + id); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, 60, false);
        flashTimer = $timeout(function () { vm.R.flash = null; }, 2200);
    }

    /* ════════ Flights ════════ */
    function flightList() {
        var x = vm.X, R = vm.R;
        if (!x || !x.flights) { return; }
        var q = String(R.q || '').toLowerCase().trim(), nq = M.norm(q).toLowerCase(), c = R.chip;
        var cnt = { all: x.flights.length, signed: 0, repeat: 0, awaiting: 0, ph: 0 };
        x.flights.forEach(function (f) { if (f.completed) { cnt.signed++; } else if (!f.ph && f.lesson) { cnt.repeat++; } if (f.onBehalf && f.awaiting) { cnt.awaiting++; } if (f.ph) { cnt.ph++; } });
        x.rChips = [['all', 'All'], ['signed', 'Signed off'], ['repeat', 'To repeat'], ['awaiting', 'Awaiting confirmation'], ['ph', 'Import notes']]
            .filter(function (k) { return k[0] === 'all' || cnt[k[0]] || k[0] === c; })
            .map(function (k) { return { k: k[0], label: k[1], n: cnt[k[0]], attn: k[0] === 'awaiting' && x.mineAw.length > 0 }; });
        var list = x.flights.filter(function (f) {
            if (c === 'signed' && !f.completed) { return false; }
            if (c === 'repeat' && (f.completed || f.ph || !f.lesson)) { return false; }
            if (c === 'awaiting' && !(f.onBehalf && f.awaiting)) { return false; }
            if (c === 'ph' && !f.ph) { return false; }
            if (q && f.hay.indexOf(q) < 0 && !(nq.length >= 2 && M.norm(f.reg).toLowerCase().indexOf(nq) > -1)) { return false; }
            return true;
        });
        var cap = R.more || q || c !== 'all' ? 100000 : 30, shown = list.slice(0, cap), items = [], byM = {}, months = [], i = 0;
        shown.forEach(function (f) { if (!byM[f.month]) { byM[f.month] = []; months.push(f.month); } byM[f.month].push(f); });
        months.forEach(function (m) {
            var mins = byM[m].reduce(function (a, f) { return a + f.mins; }, 0);
            items.push({ grp: true, key: 'm:' + m, label: m, right: plural(byM[m].length, 'flight') + ' · ' + C.hmMin(mins), i: i++ });
            byM[m].forEach(function (f) { items.push({ key: 'f:' + f.id, f: f, i: i++ }); });
        });
        x.rItems = items;
        x.rMore = list.length > shown.length ? { shown: shown.length, total: list.length, rest: list.length - shown.length } : null;
        x.rEmpty = !list.length;
        x.rGen = (x.rGen || 0) + 1;
    }
    vm.flightList = flightList;
    vm.setRChip = function (k) { if (vm.R.chip === k) { return; } vm.R.chip = k; vm.R.open = null; flightList(); };
    vm.rSearch = function () { vm.R.open = null; flightList(); };
    vm.rClear = function () { vm.R.chip = 'all'; vm.R.q = ''; flightList(); };
    vm.rMore = function () { vm.R.more = true; flightList(); };
    vm.toggleRec = function (f) { vm.R.open = vm.R.open === f.id ? null : f.id; vm.R.wx = null; if (vm.R.hi !== f.id) { vm.R.hi = null; } };
    vm.toggleWx = function (f) { vm.R.wx = vm.R.wx === f.id ? null : f.id; };
    vm.showRec = function (f) {
        vm.tab = 'flights'; vm.R.chip = 'all'; vm.R.q = ''; vm.R.more = true; vm.R.open = f.id; vm.R.hi = f.id;
        flightList(); syncUrl(); flash(f.id);
    };
    vm.replay = function (f) { if (f && f.track) { goAndReturn('dashboard.flight_replay', { flight_id: f.id }); } };
    vm.lessonOpen = function (f) {
        if (!f.lesson) { return; }
        vm.Pg.chip = 'all'; vm.Pg.q = ''; vm.Pg.open = f.lesson.i;
        setTab('progress');
        $timeout(function () { var el = document.getElementById('stu-l' + f.lesson.i); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 80, false);
    };
    /* an import-note-only flight: debrief it (saving replaces the note; the debrief comes back here) */
    vm.fillIn = function (f) {
        goAndReturn('dashboard.manage_user.debriefing', { booking_id: +(f.ls && f.ls.booking_id) > 0 ? +f.ls.booking_id : 0, plane_log_sheet_id: f.id, split_next_id: null, split_booking_id: null, from: 'student_records' });
    };
    vm.fileUnfiled = function (u) {
        if (!u || +u.needs_book_in === 1) { return; }
        goAndReturn('dashboard.manage_user.debriefing', { booking_id: +u.booking_id > 0 ? +u.booking_id : 0, plane_log_sheet_id: u.plane_log_sheet_id, split_next_id: null, split_booking_id: null, from: 'student_records' });
    };
    vm.toRecordsToFile = function () { goAndReturn('dashboard.manage_club.records_to_file'); };

    /* confirm it was my lesson (the record entered for me): it leaves "Needs you" */
    vm.confirmRec = function (f) {
        if (!f || !f.recId || vm.R.busy) { return; }
        vm.R.busy = f.id;
        D.confirm(f.recId).then(function (res) {
            vm.R.busy = null;
            if (res && res.success) {
                // it leaves "Needs you": the note and the pill fade and collapse (~200 ms), then the toast
                vm.R.leaving = f.id;
                $timeout(function () {
                    vm.R.leaving = null;
                    f.awaiting = false; f.confirmed = { by: D.name(user.first_name, user.last_name) || 'you', at: vm.today }; f.mineAw = false;
                    f.pills = recPills(f); f.trail = trail(f);
                    vm.X.mineAw = vm.X.flights.filter(function (y) { return y.mineAw; });
                    flightList();
                    ToastService.success('Record confirmed', 'It no longer shows as awaiting your confirmation.', { confetti: false });
                    reloadQuiet();
                }, 220);
                return;
            }
            var code = res && res.error;
            if (code === 'ALREADY_SUPERSEDED') { ToastService.warning('Record changed', 'It was edited since you opened it: the records have been reloaded.'); reloadQuiet(); }
            else if (code === 'NOTHING_TO_CONFIRM') { ToastService.warning('Nothing to confirm', 'This record doesn’t need your confirmation.'); reloadQuiet(); }
            else if (code === 'FORBIDDEN') { ToastService.error('Not allowed', 'Only the instructor named on a record can confirm it.'); }
            else { ToastService.error('Not confirmed', D.msg(res, 'The record could not be confirmed. Try again.')); }
        });
    };
    /* the same records again, keeping what is open (after a confirm, a sign-off, an exam) */
    function reloadQuiet(then) {
        var my = stuSeq, x = vm.X;
        if (!x || !x.courseId) { return; }
        $q.all([D.records(x.id, x.courseId), D.lessons(x.courseId), D.nextLesson(x.id, x.courseId)]).then(function (r) {
            if (my !== stuSeq || !vm.X || vm.X !== x || !r[0] || r[0].success === false) { return; }
            var keepGen = x.gen;
            build(r[0], r[1], r[2]);
            x.gen = keepGen;          // nothing rises in again: the same rows, refreshed in place
            if (vm.F.st === 'ready') { loadFind('quiet'); }
            if (then) { then(); }
        });
    }

    /* ════════ Progress ════════ */
    function lessonRows() {
        var x = vm.X, p = x.p, lastEntry = {};
        (x.payload.all_items || []).forEach(function (it) { if (it.last_entry) { lastEntry[+it.id] = it.last_entry; } });
        p.lessons.forEach(function (l, i) {
            var s = p.st[i], state = s.done ? 'done' : (i === p.next ? 'next' : 'todo');
            var n = Math.max(l.items.length, l.itemsTotal || 0), graded = l.items.filter(function (it) { return it.last; }), comp = graded.filter(function (it) { return it.last.g.tone === 'good'; }).length;
            l.state = state;
            l.rev = graded.some(function (it) { return it.last.g.tone === 'warn' || it.last.g.tone === 'bad'; });
            l.tags = (state === 'next' ? [P('stu-pill--next', p.repeat ? 'Up next · repeat' : 'Up next', 'fa-forward')] : []).concat(l.solo ? [P('solo', 'Solo', 'fa-user')] : []);
            l.who = s.done ? { av: ins(s.done.insName, s.done.tr && s.done.tr.instructor_id), t: s.done.insName } : s.last ? { av: ins(s.last.insName, s.last.tr && s.last.tr.instructor_id), t: 'Last ' + C.fDay(s.last.date) } : null;
            l.sub = state === 'done' ? 'Signed off ' + C.fDate(s.done.date) + ' · ' + plural(s.recs.length, 'flight') + (s.done.imp ? ' · imported, no grades' : '') : s.recs.length ? plural(s.recs.length, 'flight') + ' · not signed off yet' : (l.aim || '');
            if (!n) { l.fig = 'No objectives'; l.end = { none: true, t: 'No objectives' }; }
            else if (!graded.length) { l.fig = s.recs.length ? 'Not graded' : plural(n, 'objective'); l.end = { none: true, t: l.fig }; }
            else { l.fig = comp + ' / ' + n + ' competent'; l.end = { none: false, t: l.fig, pct: Math.round(comp / n * 100) }; }
            l.nRecs = s.recs.length;
            l.gradedN = graded.length; l.nObj = n;
            l.objs = l.items.map(function (it) {
                var e = lastEntry[it.id], g = it.last;
                if (!g || !e) { return { t: it.title, none: true }; }
                var insN = D.name(e.instructor_first_name, e.instructor_last_name), by = D.name(e.completed_by_first_name, e.completed_by_last_name);
                var reg = e.registration || '';
                return { t: it.title, pill: { cls: 'ta-pill--' + g.g.tone, label: g.g.name, ic: g.g.ic }, day: C.fDay(e.flight_date || g.date), reg: reg,
                    acType: e.plane_type || x.acType[reg] || '', acColour: x.acColour[reg] || '', acTitle: reg + (e.type_name ? ' · ' + e.type_name : ''),
                    av: ins(insN, e.instructor_id), insName: insN, by: by && +e.completed_by !== +e.instructor_id ? by : '', rem: String(e.remarks || '').trim() };
            });
            l.hay = (l.code + ' ' + l.title + ' ' + (l.aim || '')).toLowerCase();
        });
        // tiles
        var nL = p.lessons.length, ph = p.next != null ? p.lessons[p.next].phase : '';
        x.tiles = { signed: p.signed, n: nL, pct: nL ? Math.round(p.signed / nL * 100) : 0, phase: ph ? 'In ' + ph.replace(' · ', ': ').replace(/^Phase/, 'phase') : 'Signed off by an instructor',
            competent: p.competent, items: p.items, revise: p.revise, reviseWords: p.G.list.filter(function (g) { return g.tone === 'warn' || g.tone === 'bad'; }).sort(function (a, b) { return b.organise - a.organise; }).map(function (g) { return g.name; }).join(' or ') || 'a revise', next: p.next != null ? p.lessons[p.next].code + ' ' + p.lessons[p.next].title : '—',
            nextSub: p.repeat ? 'The last lesson was not signed off, so it repeats' : p.complete ? 'Every lesson is signed off' : 'The lesson after the last one signed off' };
        x.phaseN = p.phases.length;
        progressList();
    }
    function progressList() {
        var x = vm.X, p = x.p, Pg = vm.Pg, f = Pg.chip, q = String(Pg.q || '').toLowerCase().trim(), items = [], i = 0;
        if (!p) { return; }
        var cnt = { all: p.lessons.length, done: p.signed, todo: p.lessons.length - p.signed, rev: p.lessons.filter(function (l) { return l.rev; }).length };
        x.lChips = [['all', 'All'], ['done', 'Signed off'], ['todo', 'Still to do'], ['rev', 'With objectives to revise']]
            .filter(function (k) { return k[0] === 'all' || cnt[k[0]] || k[0] === f; }).map(function (k) { return { k: k[0], label: k[1], n: cnt[k[0]] }; });
        var shown = [];
        p.lessons.forEach(function (l) {
            l.hit = null;
            if (f === 'done' && l.state !== 'done') { return; }
            if (f === 'todo' && l.state === 'done') { return; }
            if (f === 'rev' && !l.rev) { return; }
            if (q) {
                var inL = l.hay.indexOf(q) > -1, obj = null;
                l.items.forEach(function (it) { if (!obj && String(it.title || '').toLowerCase().indexOf(q) > -1) { obj = it.title; } });
                if (!inL && !obj) { return; }
                l.hit = { obj: inL ? null : obj };
            }
            shown.push(l);
        });
        // phases: consecutive lessons sharing a phase (C21); one "Lessons" group when the course has none
        var groups = [];
        p.lessons.forEach(function (l) { var key = l.phase || 'Lessons', g = groups[groups.length - 1]; if (!g || g.t !== key) { groups.push({ t: key, ls: [] }); } groups[groups.length - 1].ls.push(l); });
        groups.forEach(function (g, gi) {
            var ids = g.ls.filter(function (l) { return shown.indexOf(l) > -1; });
            if (!ids.length) { return; }
            var signed = g.ls.filter(function (l) { return l.state === 'done'; }).length;
            items.push({ grp: true, key: 'p:' + gi, label: g.t, right: signed + ' of ' + g.ls.length + ' signed off', i: i++ });
            ids.forEach(function (l) { items.push({ key: 'l:' + l.id, l: l, i: i++ }); });
        });
        x.lItems = items;
        x.lEmpty = !shown.length;
        x.lGen = (x.lGen || 0) + 1;
    }
    vm.setLChip = function (k) { if (vm.Pg.chip === k) { return; } vm.Pg.chip = k; progressList(); };
    vm.lSearch = function () { progressList(); };
    vm.lClear = function () { vm.Pg.chip = 'all'; vm.Pg.q = ''; progressList(); };
    vm.toggleLesson = function (l) { vm.Pg.open = vm.Pg.open === l.i ? null : l.i; };
    vm.lessonOpenNow = function (l) { return vm.Pg.open === l.i || !!l.hit; };
    vm.lessonFlights = function (l) { vm.R.q = l.code; vm.R.chip = 'all'; vm.R.open = null; setTab('flights'); flightList(); };
    /* a search match, marked (escaped, then <mark class="ta-mark">) */
    vm.mark = function (text) {
        var q = String(vm.Pg.q || '').trim(), s = M.esc(text);
        if (!q) { return $sce.trustAsHtml(s); }
        var re = new RegExp('(' + q.split(/\s+/).filter(Boolean).map(function (t) { return M.esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig');
        return $sce.trustAsHtml(s.replace(re, '<mark class="ta-mark">$1</mark>'));
    };

    /* ════════ Pre-solo (solo_requirements/status): the medical, the knowledge check, sign-offs ════════ */
    function loadSolo(my) {
        var x = vm.X;
        x.soloSt = 'loading';
        D.solo(vm.club, x.id, x.courseId).then(function (res) {
            if (my !== stuSeq || vm.X !== x) { return; }
            if (!res || !res.success || !angular.isArray(res.requirements)) { x.reqs = []; x.soloSt = 'none'; tabs(); heroFacts(); return; }
            x.reqs = res.requirements.map(D.reqRow);
            x.allSolo = !!res.all_satisfied;
            x.soloSt = 'ready';
            reqView();
            tabs();
            heroFacts();
        });
    }
    vm.reloadSolo = function () { loadSolo(stuSeq); };
    /* the rows as the page shows them (the medical row follows the medical file) */
    function reqView() {
        var x = vm.X;
        if (!x || !x.reqs) { return; }
        var ms = x.med ? D.medStatus(x.med, vm.today) : null, m = x.med && x.med.cur;
        x.reqs.forEach(function (r) {
            r.pill = { cls: 'ta-pill--' + r.s.tone, label: r.s.label, ic: r.s.ic }; r.icTone = r.s.tone; r.icIc = r.s.ic; r.note = null; r.limTag = null;
            if (r.kind === 'medical') {
                var det = r.detail;
                if (x.med && !m) { det = 'No medical on file · a first solo needs a Class 2, LAPL or Pilot Medical Declaration'; }
                else if (m) {
                    var c = m.first, n = c && c.exp ? C.daysBetween(vm.today, c.exp) : null;
                    det = (c ? c.t + ' · ' + (n < 0 ? 'expired ' + C.fDate(c.exp) : 'valid until ' + C.fDate(c.exp) + (n != null && n <= 30 ? ' (' + plural(n, 'day') + ')' : '')) : 'On file') + (m.lim ? ' · limitation ' + m.lim : '') + (m.check ? '' : ' · not checked by the club yet');
                }
                r.detailShown = det;
                if (m && m.lim) { var L = D.LIM[m.codes[0]]; r.limTag = { t: 'Limitation ' + m.lim, ic: /^V|^CCL/.test(m.codes[0] || '') ? 'fa-glasses' : 'fa-info-circle', title: L ? L[0] : 'As printed on the certificate' }; }
                var tone = null;
                if (ms && ms.key === 'soon') { tone = { tone: 'warn', ic: 'fa-hourglass-half', label: 'Expiring' }; }
                if (ms && ms.key === 'none') { tone = { tone: 'bad', ic: 'fa-times', label: 'No medical on file' }; }
                if (ms && ms.key === 'lim' || r.state === 'medical_limitation') {
                    tone = { tone: 'bad', ic: 'fa-exclamation-triangle', label: 'No solo on this medical' };
                    var code = (ms && ms.code) || 'OSL';
                    r.note = { b: code + ': valid only with a safety pilot.', t: x.first + ' can’t fly solo on this medical' + (r.state === 'medical_limitation' ? '.' : ', though the automatic check passes it.') };
                }
                if (tone) { r.pill = { cls: 'ta-pill--' + tone.tone, label: tone.label, ic: tone.ic }; r.icTone = tone.tone; r.icIc = tone.ic; }
            } else { r.detailShown = r.detail; }
            r.kc = r.kind === 'questionnaire' && r.state !== 'pending_review' && r.state !== 'not_passed' && !r.satisfied ? kcInfo(r) : null;
            if (r.kc) { r.detailShown = r.kc.det; }
            if (r.kc && r.kc.st) { r.pill = { cls: 'ta-pill--' + r.kc.st.tone, label: r.kc.st.label, ic: r.kc.st.ic }; r.icTone = r.kc.st.tone; r.icIc = r.kc.st.ic; }
        });
        var rv = x.reqs.filter(function (r) { return r.kind === 'questionnaire' && r.state === 'pending_review'; })[0];
        x.kcReview = rv ? { name: String(rv.name || 'knowledge check').replace(/\s+passed$/i, '').replace(/^[A-Z](?=[a-z])/, function (c) { return c.toLowerCase(); }) } : null;
        var done = x.reqs.filter(function (r) { return r.satisfied; }).length;
        x.soloSum = { done: done, n: x.reqs.length, all: x.reqs.length > 0 && done === x.reqs.length, pct: x.reqs.length ? Math.round(done / x.reqs.length * 100) : 0, open: x.reqs.length - done };
    }
    /* the knowledge check: not set → Set it; set and open → when, due, opened, answered so far, overdue; Remind once a week */
    /* set → opened → started (answers in) → submitted. A granted retake is `not_attempted` with the attempt not started
       (opened_at null, started false): "set, not started", never "in progress" (alex-3e, 10 Nov). */
    function kcInfo(r) {
        var x = vm.X, a = r.assignment, ans = r.answers || {}, n = +ans.question_count || 0, mins = +r.raw.questionnaire_time_limit_minutes || 0;
        var len = (n ? plural(n, 'question') : 'the questionnaire') + (mins ? ', about ' + plural(mins, 'minute') : '');
        var retake = /retake/i.test(String(r.raw.detail || ''));
        if (!a && retake) { return { det: D.isoWords(String(r.raw.detail || '').trim()) + ' · ' + len, st: { tone: 'info', ic: 'fa-paper-plane', label: 'Set · not started' }, none: true }; }
        if (!a) { return { det: 'Not set for ' + x.first + ' yet · ' + len, set: true }; }
        var over = !!a.overdue || (!!a.due_date && String(a.due_date).slice(0, 10) < vm.today && !a.completed_at);
        var remAt = vm.Ps.kcNote[r.id] && vm.Ps.kcNote[r.id].at ? vm.Ps.kcNote[r.id].at : a.reminded_at;
        var next = vm.Ps.kcNote[r.id] && vm.Ps.kcNote[r.id].next ? String(vm.Ps.kcNote[r.id].next).slice(0, 10) : D.nextRemind(remAt);
        var locked = !!next && next > vm.today, opened = a.status !== 'assigned' || !!a.viewed_at;
        var started = r.state === 'in_progress' || (+ans.answered_count || 0) > 0;
        var remWord = remAt ? ' · reminded ' + (String(remAt).slice(0, 10) === vm.today ? 'today ' + C.fTime(remAt) : C.fDay(remAt)) + (locked ? ', next reminder from ' + C.fDay(next) : '') : '';
        var det = (retake ? 'Retake set by ' : 'Set by ') + youOr(a.assigned_by_name || 'an instructor', a.assigned_by) + ' ' + C.fDay(a.assigned_at) + ' · '
            + (a.due_date ? (over ? 'overdue since ' + C.fDay(a.due_date) : 'due ' + C.fDay(a.due_date)) : 'no due date') + ' · '
            + (!opened ? 'not opened yet' : !started ? 'opened, not started yet' : (+ans.answered_count || 0) + ' of ' + (n || '?') + ' answered') + remWord
            + (a.emailed === false || (a.emailed !== true && !a.email_sent_at) ? ' · no email sent' : '') + (a.student_mutes_assignment_emails ? ' · ' + x.first + ' has turned off assignment emails' : '');
        var st = over ? { tone: 'bad', ic: 'fa-exclamation-circle', label: 'Overdue' } : !opened ? { tone: 'info', ic: 'fa-paper-plane', label: 'Set · not opened' }
            : !started ? { tone: 'info', ic: 'fa-paper-plane', label: 'Set · not started' } : { tone: 'info', ic: 'fa-pen', label: 'Started' };
        return { det: det, st: st, over: over, locked: locked, next: next, id: +a.id };
    }
    vm.signAsk = function (r) { vm.Ps.sign = r.id; vm.Ps.signF = { exp: null, notes: '' }; vm.Ps.revoke = null; vm.Ps.kc = null; };
    vm.signCancel = function () { vm.Ps.sign = null; };
    vm.signOff = function (r) {
        if (vm.Ps.busy) { return; }
        var x = vm.X, F = vm.Ps.signF, body = { club_id: vm.club, user_id: x.id, requirement_id: r.id };
        if (F.exp) { body.expires_at = String(F.exp).slice(0, 10); }
        if (F.notes && F.notes.trim()) { body.notes = F.notes.trim(); }
        vm.Ps.busy = 'sign:' + r.id;
        D.signOff(body).then(function (res) {
            vm.Ps.busy = null;
            if (res && res.success) { vm.Ps.sign = null; ToastService.success('Signed off', '“' + r.name + '” signed off for ' + x.first + '.'); loadSolo(stuSeq); return; }
            ToastService.error('Not signed off', D.msg(res, 'The sign-off could not be recorded. Try again.'));
        });
    };
    vm.revokeAsk = function (r) { vm.Ps.revoke = r.id; vm.Ps.sign = null; };
    vm.revokeNo = function () { vm.Ps.revoke = null; };
    vm.revoke = function (r) {
        if (vm.Ps.busy || !r.so) { return; }
        vm.Ps.busy = 'revoke:' + r.id;
        D.revoke(r.so.id).then(function (res) {
            vm.Ps.busy = null; vm.Ps.revoke = null;
            if (res && res.success) { ToastService.success('Sign-off revoked', '“' + r.name + '” sign-off revoked for ' + vm.X.first + '. The history keeps it.'); loadSolo(stuSeq); return; }
            ToastService.error('Not revoked', D.msg(res, 'The sign-off could not be revoked. Try again.'));
        });
    };
    vm.reviewNow = function (r) {
        var id = r && r.evidence && (r.evidence.id || r.evidence.attempt_id);
        if (id) { goAndReturn('dashboard.manage_club.questionnaire_review', { attempt_id: id }); }
        else { $state.go('dashboard.manage_user.student_questionnaires', { student_id: vm.X.id }); }
    };
    /* Set it (course_assignments share, "Set" is the word: decided 9 Nov 2026) */
    vm.kcOpen = function (r) {
        var x = vm.X;
        vm.Ps.kc = r.id; vm.Ps.sign = null; vm.Ps.revoke = null;
        var n = r.answers && +r.answers.question_count, mins = +r.raw.questionnaire_time_limit_minutes || 0;
        vm.Ps.kcF = { msg: 'Please do the ' + String(r.name || 'knowledge check').toLowerCase().replace(/\s+passed$/, '') + ' before your first solo. It’s ' + (n ? plural(n, 'question') : 'a short questionnaire') + (mins ? ', about ' + plural(mins, 'minute') : '') + ', and we’ll go through it together.', due: 'week', email: true, nextLesson: null };
        if (x.nextLesson === undefined) {
            x.nextLesson = null;
            D.studentQx(vm.club, x.id).then(function (res) {
                var nb = res && res.success !== false && res.next_booking;
                x.nextLesson = nb && nb.start ? String(nb.start).slice(0, 10) : null;
                if (x.nextLesson && vm.Ps.kc === r.id && vm.Ps.kcF.due === 'week') { vm.Ps.kcF.due = 'next'; }
            });
        } else if (x.nextLesson) { vm.Ps.kcF.due = 'next'; }
    };
    vm.kcDues = function () {
        var x = vm.X, out = [{ k: 'none', t: 'No date' }];
        if (x && x.nextLesson) { out.push({ k: 'next', t: 'Before the next lesson · ' + C.fDay(x.nextLesson) }); }
        out.push({ k: 'week', t: 'In a week · ' + C.fDay(C.addDays(vm.today, 7)) });
        return out;
    };
    vm.kcDuesList = [];
    $scope.$watch(function () { return vm.X && vm.Ps.kc ? (vm.X.nextLesson || '') + '|' + vm.today : ''; }, function () { vm.kcDuesList = vm.X ? vm.kcDues() : []; });
    vm.kcCancel = function () { vm.Ps.kc = null; };
    vm.kcSet = function (r) {
        if (vm.Ps.busy) { return; }
        var x = vm.X, F = vm.Ps.kcF, due = F.due === 'next' ? x.nextLesson : F.due === 'week' ? C.addDays(vm.today, 7) : null;
        if (!r.qid) { ToastService.error('Not set', 'This check has no questionnaire to set. Ask the club to choose one in Manage Club → Pilot checks.'); return; }
        vm.Ps.busy = 'kc:' + r.id;
        D.share({ item_type: 'questionnaire', item_id: r.qid, student_id: x.id, course_id: x.courseId, message: String(F.msg || '').trim() || null, due_date: due, send_email: !!F.email }).then(function (res) {
            vm.Ps.busy = null;
            var one = res && res.results && res.results[0];
            if (res && res.success !== false && (!one || one.ok)) {
                vm.Ps.kc = null;
                if (one && one.already_set) { ToastService.success('Already set', 'It was already set for ' + x.first + ' and still open: nothing new was sent.'); }
                else if (one && one.emailed === false || !F.email) { ToastService.success('Set', 'It’s in ' + x.first + '’s Assigned to me (no email sent).'); }
                else { ToastService.success('Set', x.first + ' has been emailed a link, and it’s in their Assigned to me.'); }
                loadSolo(stuSeq);
                return;
            }
            ToastService.error('Not set', D.msg(one || res, 'It could not be set just now. Try again.'));
        });
    };
    /* Remind (C40): once a week; TOO_SOON is said in the row, in our words */
    vm.kcRemind = function (r) {
        var k = r.kc;
        if (!k || k.locked || vm.Ps.kcBusy) { return; }
        var x = vm.X;
        vm.Ps.kcBusy = r.id;
        D.remind(k.id).then(function (res) {
            vm.Ps.kcBusy = null;
            if (res && res.success) {
                vm.Ps.kcNote[r.id] = { at: res.reminded_at || C.now(), next: res.next_remind_at || D.nextRemind(res.reminded_at || C.now()) };
                if (r.assignment) { r.assignment.reminded_at = res.reminded_at || C.now(); }
                reqView();
                var nextW = C.fDay(String(vm.Ps.kcNote[r.id].next).slice(0, 10));
                if (res.emails_muted) { ToastService.success('Reminder flagged', x.first + ' has turned off assignment emails, so it’s flagged in their Assigned to me only. Next one possible from ' + nextW + '.'); }
                else { ToastService.success('Reminder sent', x.first + ' has an email with the link, and it’s flagged in their Assigned to me. Next one possible from ' + nextW + '.'); }
                return;
            }
            var data = (res && res.data) || res || {};
            if (res && res.error === 'TOO_SOON') {
                vm.Ps.kcNote[r.id] = { at: data.reminded_at || (r.assignment && r.assignment.reminded_at) || null, next: data.next_allowed_at || data.next_remind_at, said: 'A reminder already went ' + (data.reminded_at ? 'on ' + C.fDay(data.reminded_at) : 'this week') + '. You can send another from ' + C.fDay(String(data.next_allowed_at || data.next_remind_at || '').slice(0, 10)) + '.' };
                reqView();
                ToastService.handledInline();
                return;
            }
            if (res && res.error === 'NO_EMAIL') {
                vm.Ps.kcNote[r.id] = { said: x.first + ' has no email address on file, so the reminder can’t be emailed. It stays in their Assigned to me.' };
                ToastService.handledInline();
                return;
            }
            ToastService.error('Not sent', D.msg(res, 'The reminder could not be sent. Try again.'));
        });
    };

    /* ════════ the medical file (C39) ════════ */
    function loadMedical(my) {
        var x = vm.X;
        x.medSt = 'loading';
        D.medicalFile(vm.club, x.id).then(function (res) {
            if (my !== stuSeq || vm.X !== x) { return; }
            if (!res || res.success === false) { x.med = null; x.medSt = res && (res.error === 'FORBIDDEN' || res.status === 403) ? 'forbidden' : 'error'; return; }
            x.med = D.medFile(res);
            x.medS = D.medStatus(x.med, vm.today);
            x.medSt = 'ready';
            medLog();
            reqView();
        });
    }
    function medLog() {
        var x = vm.X, f = x.med, rows = [];
        if (!f) { return; }
        var word = { image_viewed: 'Opened the certificate', query_sent: 'Asked ' + x.first + ' to correct the entry', medical_reminded: 'Asked ' + x.first + ' to add or renew the medical' };
        (f.history || []).forEach(function (h) { rows.push({ at: h.archived_at || h.updated_at, who: x.first, t: 'Changed the medical (the earlier entry is kept)' }); });
        if (f.cur && f.cur.check) { rows.push({ at: f.cur.check.at, who: f.cur.check.byId === me ? 'you' : f.cur.check.by, t: 'Checked it against the certificate' }); }
        (f.log || []).forEach(function (l) { rows.push({ at: l.at, who: +l.user_id === me ? 'you' : (l.name || 'Someone'), t: word[l.action] || 'Opened the file' }); });
        rows.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
        rows.forEach(function (r) { r.when = String(r.at || '').slice(0, 10) === vm.today ? 'Today' + (String(r.at).length > 10 ? ' ' + C.fTime(r.at) : '') : C.fDate(r.at); });
        f.rows = rows;
    }
    vm.openMedical = function () {
        var x = vm.X;
        if (!x || !x.med) { return; }
        vm.dlg = { t: 'medical', view: 0, page: 0, pw: '', pwErr: null, busy: false, diff: false, diffText: '', diffSent: false, imgs: null, full: false, rot: 0 };
        medVm();
        // unlocked earlier this visit: the scan opens straight away (and the opening is logged by the server)
        if (vm.scanUnlocked && x.med.cur) { scan(); }
    };
    function medVm() {
        var g = vm.dlg;
        if (!g || g.t !== 'medical') { return; }
        var m = vm.medM();
        g.m = m;
        g.note = m ? vm.medNote() : null;
        g.lim = vm.medLim(m);
        g.rows = vm.medClassRows(m);
        g.names = vm.medClassNames(m);
        var n = g.imgs ? g.imgs.length : (m ? m.pages : 0), pages = [];
        for (var i = 0; i < n; i++) { pages.push(i); }
        g.pages = pages;
    }
    vm.medM = function () { var g = vm.dlg, f = vm.X && vm.X.med; if (!g || !f) { return null; } return g.view ? f.earlier[g.view - 1] : f.cur; };
    vm.medNote = function () {
        var x = vm.X, g = vm.dlg, m = vm.medM(), s = x.medS || {}, club = vm.clubTitle();
        if (!m) { return null; }
        if (g.view) { var n0 = m.exp ? C.daysBetween(vm.today, m.exp) : 0; return { tone: 'muted', ic: 'fa-history', b: 'An earlier certificate', t: ', ' + (n0 < 0 ? 'expired ' + C.fDate(m.exp) : 'valid until ' + C.fDate(m.exp)) + '. Kept in the file.', back: true }; }
        var c = m.first;
        return {
            valid: { tone: 'good', ic: 'fa-check-circle', b: 'Valid for solo flights until ' + (c ? C.fDate(c.exp) : '—') + '.', t: m.lim ? ' One limitation: ' + m.lim + '.' : '' },
            soon: { tone: 'warn', ic: 'fa-hourglass-half', b: 'Expires on ' + (c ? C.fDayLong(c.exp) : '—') + ', in ' + plural(s.n || 0, 'day') + '.', t: ' A solo after that date is refused at book-out until ' + x.first + ' adds the renewed certificate.' },
            expired: { tone: 'bad', ic: 'fa-times-circle', b: 'Expired on ' + (c ? C.fDayLong(c.exp) : '—') + '.', t: ' Solo bookings and book-outs that need it are refused until ' + x.first + ' adds a new one. Dual lessons with you can go ahead.' },
            unchecked: { tone: 'info', ic: 'fa-info-circle', b: 'In date, but nobody at ' + club + ' has checked it against the certificate yet.', t: ' ' + x.first + (m.saved ? ' saved it on ' + C.fDate(m.saved) + '.' : ' saved it.') + ' Open the certificate and compare it with what ' + x.first + ' entered.' },
            lim: { tone: 'bad', ic: 'fa-exclamation-triangle', b: (s.code || 'OSL') + ' on the certificate: valid only with a safety pilot.', t: ' ' + x.first + ' can’t fly solo on this medical.' }
        }[s.key] || null;
    };
    vm.medClassRows = function (m) {
        if (!m) { return []; }
        if (m._rows) { return m._rows; }
        m._rows = m.classes.map(function (c) {
            var n = c.exp ? C.daysBetween(vm.today, c.exp) : null, tone = n == null ? 'good' : n < 0 ? 'bad' : n <= 30 ? 'warn' : 'good';
            return { t: c.t, s: c.exp ? (n < 0 ? 'Expired ' : 'Valid until ') + C.fDayLong(c.exp) + ' · ' + D.leftWords(n) : 'No expiry entered', tone: tone,
                pill: { cls: 'ta-pill--' + tone, label: n < 0 ? 'Expired' : n != null && n <= 30 ? 'Expiring' : 'Valid', ic: n < 0 ? 'fa-times' : n != null && n <= 30 ? 'fa-hourglass-half' : 'fa-check' } };
        }).concat(m.dates.map(function (d) { return { t: d.t, s: C.fDayLong(d.d) + ' · a date record, it doesn’t expire', tone: 'date', pill: { cls: 'ta-pill--muted', label: 'Date', ic: 'fa-calendar-check' } }; }));
        return m._rows;
    };
    vm.medLim = function (m) {
        if (!m || !m.lim) { return null; }
        var L = D.LIM[m.codes[0]];
        return { code: m.lim, t: L ? L[0] : 'As printed on the certificate', s: L ? L[1] : 'Read the certificate for the detail', bad: !!(L && L[2] === 'bad') || m.osl };
    };
    vm.medAsk = function () {
        var x = vm.X, s = x && x.medS;
        if (!s || ['none', 'expired', 'soon'].indexOf(s.key) < 0) { return null; }
        var r = x.med.remind || {}, next = r.next_allowed_at ? String(r.next_allowed_at).slice(0, 10) : null, locked = r.allowed === false || (!!next && next > vm.today);
        return { word: s.key === 'none' ? 'add it' : 'renew it', locked: locked, last: r.last_at, next: next,
            note: locked ? 'Asked ' + (String(r.last_at || '').slice(0, 10) === vm.today ? 'today' : C.fDay(r.last_at)) + ' · you can ask again from ' + C.fDay(next) : '' };
    };
    $scope.$watch(function () { var x = vm.X, r = x && x.med && x.med.remind; return x && x.medS ? x.medS.key + '|' + (r ? r.next_allowed_at + '|' + r.allowed : '') : ''; }, function () { vm.medAskInfo = vm.medAsk(); });
    vm.medRemind = function () {
        var x = vm.X, a = vm.medAskInfo, g = vm.dlg;
        if (!a || a.locked || !g || g.busy) { return; }
        g.busy = 'remind';
        D.medRemind(vm.club, x.id).then(function (res) {
            g.busy = false;
            if (res && res.success) {
                x.med.remind = { last_at: res.reminded_at || C.now(), next_allowed_at: res.next_allowed_at, allowed: false };
                x.med.log.unshift({ at: res.reminded_at || C.now(), user_id: me, name: 'you', action: 'medical_reminded' }); medLog();
                ToastService.success('Sent', x.first + (res.emailed === false ? ' couldn’t be emailed, but it’s flagged in the app' : ' has an email asking them to ' + (a.word === 'add it' ? 'add their medical' : 'add the renewed certificate') + ' in My Account') + '. You can ask again from ' + C.fDay(String(res.next_allowed_at || C.addDays(vm.today, 7)).slice(0, 10)) + '.');
                return;
            }
            var data = (res && res.data) || res || {};
            if (res && res.error === 'TOO_SOON') {
                x.med.remind = { last_at: data.last_at || null, next_allowed_at: data.next_allowed_at || null, allowed: false };
                ToastService.handledInline();   // the footer now says when they were asked and when you can ask again
                return;
            }
            if (res && res.error === 'NO_EMAIL') { g.noEmail = x.first + ' has no email address on file, so the request can’t be sent.'; ToastService.handledInline(); return; }
            ToastService.error('Not sent', D.msg(res, 'The request could not be sent. Try again.'));
        });
    };
    /* the certificate: behind your password, as everywhere a medical scan is decrypted; every opening is logged */
    function scan() {
        var g = vm.dlg, x = vm.X, m = vm.medM();
        if (!g || !m) { return; }
        g.busy = 'scan'; g.imgs = null; g.scanErr = null; g.refused = null;
        (m.archived ? D.scanArchived(m.archivedId, vm.club) : D.scan(m.id, vm.club)).then(function (res) {
            if (vm.dlg !== g) { return; }
            g.busy = false;
            if (res && (res.fail === 'templogin' || (res.data && res.data.fail === 'templogin'))) { vm.scanUnlocked = false; g.locked = true; return; }
            if (res && res.success) {
                // one entry per page; a page whose file is gone ({ data_uri: null, missing }) stays as null: "no longer available"
                var imgs = ((res.medical && res.medical.images) || []).map(function (im) { return im && /^data:/.test(im.data_uri || '') ? im.data_uri : null; });
                g.imgs = imgs; g.page = 0; g.locked = false; vm.scanUnlocked = true; medVm();
                x.med.log.unshift({ at: C.now(), user_id: me, name: 'you', action: 'image_viewed' }); medLog();
                return;
            }
            // a refusal (an unknown or not-your id is always FORBIDDEN): no password helps, so the lock gives way to the refusal words
            if (res && res.error === 'FORBIDDEN') { g.refused = 'You can’t open this certificate.'; ToastService.handledInline(); return; }
            g.scanErr = 'The certificate couldn’t be opened just now. Try again.';
        });
    }
    vm.unlock = function () {
        var g = vm.dlg;
        if (!g || g.busy) { return; }
        if (!String(g.pw || '').trim()) { g.pwErr = 'Enter your password to open it'; focus('stu-mpw'); return; }
        g.busy = 'pw'; g.pwErr = null;
        AuthenticationService.Login3(g.pw, sample(120), function (res) {
            $timeout(function () {
                if (vm.dlg !== g) { return; }
                g.busy = false;
                if (res && res.success) { g.pw = ''; vm.scanUnlocked = true; scan(); return; }   // the grant holds even if this one scan is refused
                g.pwErr = res && res.error === 'Authentication failed. Please try again.' ? 'Your password couldn’t be checked just now. Try again in a moment.' : 'That isn’t your password. Try again.';
                g.pw = ''; focus('stu-mpw');
            });
        });
    };
    function sample(n) { var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r = ''; for (var i = 0; i < n; i++) { r += c.charAt(Math.floor(Math.random() * c.length)); } return r; }
    function focus(id, ms) { $timeout(function () { var el = document.getElementById(id); if (el) { el.focus(); } }, ms || 30, false); }
    vm.medView = function (i) {
        var g = vm.dlg; g.view = i; g.page = 0; g.imgs = null; g.full = false; g.rot = 0; g.refused = null; g.scanErr = null;
        medVm();
        if (vm.scanUnlocked) { scan(); }
    };
    vm.medPage = function (i) { var g = vm.dlg; if (g && g.imgs && i < g.imgs.length) { g.page = i; g.full = false; } };
    vm.medPages = function () { var g = vm.dlg, m = vm.medM(), n = g && g.imgs ? g.imgs.length : (m ? m.pages : 0); var out = []; for (var i = 0; i < Math.max(n, 0); i++) { out.push(i); } return out; };
    vm.medFull = function (on) { var g = vm.dlg; if (g && (!on || (g.imgs && g.imgs[g.page]))) { g.full = !!on; g.rot = 0; } };
    vm.medRotate = function () { var g = vm.dlg; if (g) { g.rot = (g.rot + 90) % 360; } };
    vm.medCheck = function () {
        var g = vm.dlg, x = vm.X, m = vm.medM();
        if (!g || g.busy || !g.imgs || !g.imgs.some(Boolean) || !m) { return; }
        g.busy = 'check';
        D.medCheck(vm.club, x.id, m.id).then(function (res) {
            g.busy = false;
            if (res && res.success !== false) {
                m.check = { by: 'you', byId: me, at: vm.today };
                x.medS = D.medStatus(x.med, vm.today); medLog(); reqView(); medVm();
                ToastService.success('Marked as checked', 'Checked against the certificate, in your name. The club sees it too.');
                return;
            }
            ToastService.error('Not marked', D.msg(res, 'It could not be marked as checked. Try again.'));
        });
    };
    vm.medDiff = function () {
        var g = vm.dlg, m = vm.medM();
        if (!g || !g.imgs) { return; }
        g.diff = true;
        g.diffText = 'Something on your medical entry doesn’t match your certificate' + (m && m.lim ? ' (the limitation entered is ' + m.lim + ')' : '') + '. Please check it in My Account → Licences & medical.';   // not focused: on phones that pops the keyboard over the file
    };
    vm.medDiffNo = function () { if (vm.dlg) { vm.dlg.diff = false; } };
    vm.medDiffSend = function () {
        var g = vm.dlg, x = vm.X, m = vm.medM(), t = String(g && g.diffText || '').trim();
        if (!g || g.busy || !m) { return; }
        if (!t) { g.diffErr = 'Say what’s different'; return; }
        g.busy = 'diff'; g.diffErr = null;
        D.medQuery(m.id, vm.club, t.slice(0, 1000)).then(function (res) {
            g.busy = false;
            if (res && res.success) {
                g.diff = false; g.diffSent = true;
                x.med.log.unshift({ at: C.now(), user_id: me, name: 'you', action: 'query_sent' }); medLog();
                ToastService.success('Sent to ' + x.first, res.emailed === false ? 'It’s in the medical’s log; ' + x.first + ' couldn’t be emailed.' : 'The medical stays unchecked until the entry matches.');
                return;
            }
            if (res && res.error === 'NO_EMAIL') { g.diffErr = x.first + ' has no email address on file, so it can’t be sent.'; ToastService.handledInline(); return; }
            ToastService.error('Not sent', D.msg(res, 'It could not be sent. Try again.'));
        });
    };

    /* ════════ Exams & forms ════════ */
    function loadDocs(my) {
        var x = vm.X;
        x.docsSt = 'loading';
        D.caaDocs(vm.club, x.id).then(function (res) {
            if (my !== stuSeq || vm.X !== x) { return; }
            var forms = (res && res.success !== false && (res.forms || res.items)) || (angular.isArray(res) ? res : []);
            x.docs = (forms || []).filter(function (f) { return f.status === 'completed'; }).map(function (f) {
                var by = (f.signatures || []).filter(function (s) { return s.status === 'signed' && s.role !== 'applicant'; }).map(function (s) { return s.signer_display_name || D.name(s.signer_first_name, s.signer_last_name); }).filter(Boolean)[0] || f.initiated_by_name || '';
                return { id: +f.id, title: D.caaTitle(f), at: f.completed_at || f.updated_at || f.created_at, by: by, raw: f };
            });
            x.docsSt = 'ready';
        });
    }
    function loadUnfiled(my) {
        var x = vm.X;
        x.unfiled = []; x.unfiledTotal = 0;
        if (!vm.isAdmin) { return; }
        D.unfiled(vm.club, x.id).then(function (res) {
            if (my !== stuSeq || vm.X !== x || !res || !res.success) { return; }   // FORBIDDEN / a failure: the section stays hidden
            x.unfiled = (res.flights || []).map(function (u) {
                var off = X.hhmm(u.brakes_off), on = X.hhmm(u.brakes_on), mins = off && on ? C.minutesBetween('2000-01-01 ' + off, '2000-01-01 ' + on) : Math.round((+u.flight_time || 0) * 60);
                var insN = u.instructor ? D.name(u.instructor.first_name, u.instructor.last_name) : '';
                return { id: +u.plane_log_sheet_id, raw: u, day: C.fDayLong(u.flight_date), win: off + (on ? '–' + on : ''), hm: C.hmMin(Math.max(0, mins)),
                    kind: u.kind === 'supervised_solo' ? 'solo' : 'dual', kindWord: u.kind === 'dual' ? 'Dual' : u.kind === 'supervised_solo' ? 'Supervised solo' : 'Instructional',
                    part: +u.needs_book_in === 1 ? 'part ' + (u.tpc_split_leg || 2) + ' · not booked in' : '', reg: u.registration || '', type: u.plane_type || '', acColour: x.acColour[u.registration] || '',
                    ins: insN ? { name: insN, av: ins(insN, u.instructor.id) } : null, needsBookIn: +u.needs_book_in === 1 };
            });
            x.unfiledTotal = +res.total || x.unfiled.length;
        });
    }
    vm.examToggle = function (e) { vm.Ex.open = vm.Ex.open === e.id ? null : e.id; vm.Ex.del = null; };
    vm.examDelAsk = function (e) { vm.Ex.del = e.id; };
    vm.examDelNo = function () { vm.Ex.del = null; };
    vm.examDelete = function (e) {
        if (vm.Ex.busy) { return; }
        vm.Ex.busy = 'del:' + e.id;
        D.examDelete(e.id).then(function (res) {
            vm.Ex.busy = null;
            if (res && res.success) { vm.Ex.del = null; vm.Ex.open = null; ToastService.success('Result deleted', '“' + e.title + '” removed from ' + vm.X.first + '’s records. It stays in the history.'); reloadQuiet(); return; }
            ToastService.error('Not deleted', D.msg(res, 'The exam result could not be deleted.'));
        });
    };
    vm.examAdd = function () {
        var x = vm.X;
        vm.dlg = { t: 'exam', mode: 'add', examId: '', pass: null, date: vm.today, result: '', sitting: 1, set: '', examiner: '', notes: '', reason: '', files: [], err: {}, busy: false };
    };
    vm.examEdit = function (e, ev) {
        if (ev) { ev.stopPropagation(); }
        vm.dlg = { t: 'exam', mode: 'edit', id: e.id, examId: e.examId, title: e.title, pass: e.pass, date: e.date || vm.today, result: e.result == null ? '' : String(e.result), sitting: e.sitting, set: e.set, examiner: e.examiner, notes: e.notes, reason: '', files: [], err: {}, busy: false };
    };
    vm.examKey = function (ev, e) { if (ev.keyCode === 13 || ev.keyCode === 32) { ev.preventDefault(); vm.examEdit(e, ev); } };
    vm.examPick = function () {
        var g = vm.dlg, x = vm.X;
        g.err.exam = false;
        g.sitting = x.exams.filter(function (e) { return e.examId === +g.examId; }).length + 1;
    };
    vm.examPass = function (v) { var g = vm.dlg; g.pass = v; g.err.pass = false; };
    vm.examSit = function (d) { var g = vm.dlg; g.sitting = Math.max(1, (+g.sitting || 1) + d); };
    vm.examFiles = function (files) {
        var g = vm.dlg, ok = { 'image/png': 1, 'image/jpeg': 1, 'application/pdf': 1 };
        angular.forEach(files, function (f) {
            if (!ok[f.type]) { ToastService.warning('Not added', '“' + f.name + '”: only PNG, JPG or PDF certificates can be attached.'); return; }
            if (f.size > 20 * 1024 * 1024) { ToastService.warning('Too large', '“' + f.name + '” is over the 20 MB limit.'); return; }
            g.files.push(f);
        });
    };
    vm.examFileDel = function (i) { vm.dlg.files.splice(i, 1); };
    vm.examSave = function () {
        var g = vm.dlg, x = vm.X, err = {};
        if (!g || g.busy) { return; }
        if (g.mode === 'add' && !g.examId) { err.exam = true; }
        if (g.pass !== 0 && g.pass !== 1) { err.pass = true; }
        if (!g.date) { err.date = true; }
        var res0 = String(g.result == null ? '' : g.result).trim(), result = res0 === '' ? null : parseFloat(res0.replace('%', '').replace(',', '.'));
        if (result !== null && (isNaN(result) || result < 0 || result > 100)) { err.result = true; }
        g.err = err;
        if (Object.keys(err).length) {
            $timeout(function () { var el = document.querySelector('.ta-dlg .ta-field--error'); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30, false);
            return;
        }
        var body = { date: String(g.date).slice(0, 10), pass_fail: g.pass, sitting: String(g.sitting || ''), set_no: g.set || '', examiner: g.examiner || '', notes: g.notes || '' };
        if (result !== null) { body.result = result; }
        g.busy = true;
        var p;
        if (g.mode === 'add') { body.course_id = x.courseId; body.exam_id = +g.examId; body.user_id = x.id; p = D.examAdd(body); }
        else { if (String(g.reason || '').trim()) { body.reason = g.reason.trim(); } p = D.examSave(g.id, body); }
        p.then(function (res) {
            if (!res || res.success === false) { g.busy = false; ToastService.error('Not saved', D.msg(res, 'The result could not be saved. Try again.')); return; }
            var id = g.mode === 'add' ? +(res.id || res.exam_record_id || (res.item && res.item.id)) : g.id;
            uploads(g.files, id).then(function (failed) {
                g.busy = false;
                if (vm.dlg === g) { vm.dlg = null; }
                var title = g.mode === 'add' ? ((x.examList.filter(function (e) { return +e.id === +g.examId; })[0] || {}).title || 'The exam') : g.title;
                ToastService.success(g.mode === 'add' ? 'Result added' : 'Result saved', g.mode === 'add' ? title + ' result added to ' + x.first + '’s records.' : 'The change is in its history.');
                if (failed.length) { ToastService.warning('Some certificates failed', failed.join(', ') + ' could not be attached. Try again from the result.'); }
                reloadQuiet(function () { vm.Ex.open = id; });
            });
        });
    };
    function uploads(files, id) {
        var failed = [], list = (files || []).slice();
        function next(i) {
            if (i >= list.length || !id) { return $q.when(failed); }
            return D.examUpload(list[i], id).then(function (r) { if (!r || !r.success) { failed.push('“' + list[i].name + '”'); } return next(i + 1); });
        }
        return next(0);
    }
    vm.examHistory = function (e) {
        var g = { t: 'hist', title: e.title, sitting: e.sitting, st: 'loading', rows: [] };
        vm.dlg = g;
        D.examAudit(e.id).then(function (res) {
            if (vm.dlg !== g) { return; }
            var trail = (res && (res.trail || res.items)) || (angular.isArray(res) ? res : []);
            if (!res || res.success === false) { g.st = 'error'; return; }
            g.rows = trail.slice().sort(function (a, b) { return String(a.created_at || '').localeCompare(String(b.created_at || '')); }).map(function (t) {
                var who = D.name(t.actor_first_name, t.actor_last_name) || 'Someone', act = String(t.action || '').replace(/_/g, ' ');
                var what = t.changes_summary ? String(t.changes_summary) : (act ? act.charAt(0).toUpperCase() + act.slice(1) : 'Changed the result');
                return { who: who, av: ins(who, t.actor_id || t.user_id), what: what + (t.reason ? ' — “' + String(t.reason).trim() + '”' : ''), when: C.fDayLong(t.created_at) };
            });
            g.st = 'ready';
        });
    };
    /* "Before A10 Circuits · 12 questions": the attempt's target and length come with C40's student read */
    function quizWords() {
        var x = vm.X;
        if (!x || !x.quiz || !x.quiz.length) { return; }
        var apply = function () {
            var by = {}; ((x.qx && x.qx.attempts) || []).forEach(function (a) { by[+(a.id || a.attempt_id)] = a; });
            x.quiz.forEach(function (q) {
                var a = by[q.id]; if (!a) { return; }
                var ref = String(a.course_reference || '').trim(), t = String(a.target_title || '').trim(), onCourse = a.attach_type === 'course' || (!ref && t && t === a.course_title);
                q.when = (q.raw.timing === 'post' || a.timing === 'post' ? 'After ' : 'Before ') + (onCourse || !t ? 'the course' : (ref ? ref + ' ' : '') + t)
                    + (+a.question_count ? ' · ' + plural(+a.question_count, 'question') : '');
            });
        };
        if (x.qx) { apply(); return; }
        D.studentQx(vm.club, x.id).then(function (res) {
            if (vm.X !== x || !res || res.success === false) { return; }
            x.qx = res;
            var nb = res.next_booking; if (x.nextLesson === undefined) { x.nextLesson = nb && nb.start ? String(nb.start).slice(0, 10) : null; }
            apply();
        });
    }
    vm.openQuiz = function (q) {
        if (q && q.id) { goAndReturn('dashboard.manage_club.questionnaire_review', { attempt_id: q.id }); }
    };
    vm.allQuestionnaires = function () { goAndReturn('dashboard.manage_user.student_questionnaires', { student_id: vm.X.id }); };
    vm.openDoc = function (d) { goAndReturn('dashboard.caa_form', { id: d.id }); };
    vm.docPdf = function (d, ev) {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        if (vm.Ex.pdf) { return; }
        vm.Ex.pdf = d.id;
        D.caaPdf(d.raw).then(function (res) {
            vm.Ex.pdf = null;
            if (!res || res.success === false || !res.blob) { ToastService.error('PDF unavailable', D.msg(res, 'The PDF could not be made just now.')); return; }
            download(res.blob, res.filename || 'caa_form.pdf');
            ToastService.success('PDF downloaded', d.title);
        });
    };
    vm.docKey = function (ev, d) { if (ev.keyCode === 13 || ev.keyCode === 32) { vm.docPdf(d, ev); } };
    function download(blob, filename) {
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 250);
    }

    /* ════════ the hero's dialogs: change course, export ════════ */
    vm.openCourses = function () {
        var g = { t: 'course', st: 'loading', mine: [], other: [] };
        vm.dlg = g;
        clubCourses().then(function (list) {
            if (vm.dlg !== g) { return; }
            var x = vm.X, recs = {};
            (x.courses || []).forEach(function (c) { recs[c.id] = c; });
            function opt(c) {
                var r = recs[c.id];
                return { id: c.id, t: c.title, on: c.id === x.courseId, s: r && r.records ? plural(r.records, 'flight') + (r.last ? ' · last ' + C.fDay(r.last) : '') : (c.lessons != null ? (c.lessons ? plural(c.lessons, 'lesson') : 'No lessons yet') + ' · no records' : 'No records') };
            }
            var all = list.slice();
            (x.courses || []).forEach(function (c) { if (!all.some(function (k) { return k.id === c.id; })) { all.push({ id: c.id, title: c.title, lessons: c.lessons || null }); } });
            g.mine = all.filter(function (c) { return recs[c.id] && recs[c.id].records; }).map(opt);
            g.other = all.filter(function (c) { return !(recs[c.id] && recs[c.id].records); }).map(opt);
            g.n = list.length;
            g.st = 'ready';
        });
    };
    vm.setCourse = function (c) {
        var x = vm.X;
        vm.dlg = null;
        if (c.id === x.courseId) { return; }
        x.courseId = c.id; x.p = null; x.reqs = null; x.soloSt = 'loading';
        vm.R = { chip: 'all', q: '', open: null, wx: null, more: false, hi: null, flash: null }; vm.Pg = { chip: 'all', q: '', open: null };
        if (vm.tab === 'presolo') { vm.tab = 'flights'; }
        syncUrl();
        loadCourse(++stuSeq);
        loadMedical(stuSeq);
        ToastService.success('Course changed', 'Showing ' + x.first + '’s ' + c.t + '.');
    };
    vm.openExport = function () { vm.dlg = { t: 'export', skip: D.exportSkip(), busy: false }; };
    vm.exportSkip = function () { D.setExportSkip(vm.dlg.skip); };
    vm.doExport = function () {
        var g = vm.dlg, x = vm.X;
        if (!g || g.busy) { return; }
        g.busy = true;
        D.exportPdf(x.courseId, x.id, !g.skip).then(function (res) {
            g.busy = false;
            if (res && res.data && !(res.success === false)) {
                var blob = new Blob([res.data], { type: 'application/pdf' });
                download(blob, 'Course_Record_' + String(x.courseTitle || '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + String(x.first + '_' + x.last).replace(/[^a-zA-Z0-9_]/g, '') + '_' + x.courseId + '.pdf');
                if (vm.dlg === g) { vm.dlg = null; }
                ToastService.success('Course record downloaded', g.skip ? 'Without the syllabus progress pages.' : x.first + '’s ' + x.courseTitle + ', one PDF.');
                return;
            }
            ToastService.error('Export failed', 'The course record PDF could not be made. Try again.');
        }, function () { g.busy = false; ToastService.error('Export failed', 'The course record PDF could not be made. Try again.'); });
    };

    /* ════════ Confirm for the instructor (club super-admins / staff): a reason, 5+ characters ════════ */
    vm.cfiReasons = ['Instructor has left the club', 'Instructor no longer instructs at the club', 'Instructor cannot be reached'];
    vm.openCfi = function (f) { vm.dlg = { t: 'cfi', f: f, reason: '', err: false, busy: false }; };
    vm.cfiPick = function (t) { vm.dlg.reason = t; vm.dlg.err = false; };
    vm.cfiDo = function () {
        var g = vm.dlg, f = g && g.f, reason = String(g && g.reason || '').trim();
        if (!g || g.busy) { return; }
        if (reason.length < 5) { g.err = true; focus('stu-cfi'); return; }
        g.busy = true;
        D.confirm(f.recId, reason).then(function (res) {
            g.busy = false;
            if (res && res.success) {
                if (vm.dlg === g) { vm.dlg = null; }
                ToastService.success('Record confirmed', 'Confirmed for ' + f.recIns + ': the record shows you confirmed it for them.', { confetti: false });
                reloadQuiet();
                return;
            }
            if (res && res.error === 'REASON_REQUIRED') { g.err = true; ToastService.handledInline(); return; }
            if (res && res.error === 'ALREADY_SUPERSEDED') { if (vm.dlg === g) { vm.dlg = null; } ToastService.warning('Record changed', 'It was edited since you opened it: the records have been reloaded.'); reloadQuiet(); return; }
            ToastService.error('Not confirmed', D.msg(res, 'The record could not be confirmed.'));
        });
    };

    /* ════════ dialogs: close, scrim, Esc ════════ */
    vm.closeDlg = function () {
        var g = vm.dlg;
        if (!g) { return; }
        if (g.busy === true || g.busy === 'remind' || g.busy === 'diff' || g.busy === 'check' || (g.t === 'export' && g.busy)) { return; }
        if (g.t === 'medical' && g.full) { g.full = false; return; }
        vm.dlg = null;
    };
    vm.scrim = function (ev) { if (ev.target === ev.currentTarget) { vm.closeDlg(); } };
    function onKey(e) {
        if (e.key !== 'Escape' && e.keyCode !== 27) { return; }
        if (vm.E && vm.E.pick) { $scope.$apply(function () { vm.E.pick = null; }); return; }
        if (vm.dlg) { $scope.$apply(vm.closeDlg); }
    }

    /* ════════════════════════ EDIT A RECORD (the debrief's form, pre-filled, plus the reason for the edit) ════════════════════════
       PUT training_records/{id} treats the stored record as the base (BACKEND_TRAINING_RECORD_EDIT_GUIDE.md): only what can
       change is sent (never user_id / plane_log_sheet_id / club_id / course_id). items = every objective with a grade or a
       remark, from any lesson (the whole snapshot); clearing a graded one asks first (item_removal, now before Save). */
    vm.edit = function (f) {
        var x = vm.X;
        if (!f || !f.canEdit) { return; }
        vm.tab = 'edit';
        vm.dlg = null;
        vm.E = { pls: f.id, f: f, st: 'loading' };
        syncUrl();
        scrollTop();
        var E = vm.E;
        $q.all([D.flightRecord(x.id, x.courseId, f.id), D.tags(x.courseId)]).then(function (r) {
            if (vm.E !== E) { return; }
            var res = r[0], te = res && res.this_entry;
            if (!res || res.success === false || !te || !te.id) {
                vm.E = null; vm.tab = 'flights'; syncUrl();
                ToastService.warning('No record to edit', res && res.success === false ? D.msg(res, 'The record could not be opened. Try again.') : 'There’s no training record on this flight yet: file one from the debrief.');
                return;
            }
            edInit(E, f, res, te, (r[1] && r[1].items) || []);
        });
    };
    function trim(s) { return String(s == null ? '' : s).trim(); }
    function edInit(E, f, res, te, tagsAll) {
        var x = vm.X, items = [], by = {};
        E.trId = +te.id;
        E.scale = X.scale(res.competences && res.competences.length ? res.competences : x.payload.competences);
        E.scaleById = {}; E.scale.forEach(function (g) { E.scaleById[g.id] = g; });
        E.g = {}; E.rm = {};
        (res.all_items || []).forEach(function (it) {
            var o = { id: +it.id, t: it.title || 'Objective', k: it.description && it.description !== 'Demo objective' ? it.description : '', l: +it.lesson_id };
            items.push(o); (by[o.l] = by[o.l] || []).push(o);
            var e = it.this_entry;
            if (e && e.result != null && e.result !== '' && +e.result > 0) { E.g[o.id] = +e.result; }
            if (e && trim(e.remarks)) { E.rm[o.id] = String(e.remarks); }
        });
        E.items = items; E.itemsBy = by;
        E.g0 = angular.extend({}, E.g); E.rm0 = angular.extend({}, E.rm);
        var tag = /\s*(\[TPC import [^\]]*\])\s*$/.exec(String(te.general_remarks || ''));
        E.tag = tag ? tag[1] : '';
        E.remarks = String(te.general_remarks || '').replace(/\s*\[TPC import [^\]]*\]\s*$/, '').trim();
        E.lesson = +te.lesson_id || (f.lesson ? f.lesson.id : null); E.orig = E.lesson;
        E.maxMin = Math.max(5, Math.round((f.mins || 0) / 5) * 5);
        E.tags = (te.flight_tags || []).map(function (t) {
            var m = t.tag_minutes != null ? +t.tag_minutes : Math.round((+t.tag_time || 0) * 60 / 5) * 5;
            return { fid: +t.flight_tag_id || +t.id, title: t.title || 'Tag', min: Math.min(E.maxMin, Math.max(5, m)), whole: m >= E.maxMin - 5 };
        });
        E.tagsAll = tagsAll.filter(function (t) { return +t.deleted !== 1; }).map(function (t) { return { id: +t.id, title: t.title || 'Tag' }; });
        E.status = +te.completed === 1 ? 'done' : 'repeat';
        var L = x.lessonById[E.lesson], after = L ? x.p.lessons[L.i + 1] : null, stored = +te.next_lesson_id || 0;
        E.next = !stored || (after && stored === after.id) || !x.lessonById[stored] ? 'order' : stored;
        E.reason = ''; E.scope = 'lesson'; E.q = ''; E.open = {}; E.rmOpen = null; E.pick = null; E.pq = ''; E.err = null; E.dirty = false; E.saving = false;
        E.st = 'ready';
        edView();
    }
    function edLesson() { return vm.E && vm.X ? vm.X.lessonById[vm.E.lesson] || null : null; }
    function edNext() {
        var E = vm.E, x = vm.X, L = edLesson();
        if (!L) { return null; }
        return E.next === 'order' ? (x.p.lessons[L.i + 1] || L) : (x.lessonById[E.next] || null);
    }
    function edDropped() {
        var E = vm.E, keys = Object.keys(E.g0).concat(Object.keys(E.rm0)).filter(function (k, i, a) { return a.indexOf(k) === i; });
        return keys.filter(function (k) { return !E.g[k] && !trim(E.rm[k]); });
    }
    function edView() {
        var E = vm.E, x = vm.X;
        if (!E || E.st !== 'ready') { return; }
        var q = trim(E.q).toLowerCase(), searching = q.length >= 2, whole = E.scope === 'course', graded = {}, groups = [];
        Object.keys(E.g).concat(Object.keys(E.g0)).forEach(function (k) { var it = itemOf(+k); if (it) { graded[it.l] = true; } });
        x.p.lessons.forEach(function (l) {
            if (!(whole || searching || l.id === E.lesson || graded[l.id])) { return; }
            var all = E.itemsBy[l.id] || [], name = l.code + ' ' + l.title;
            var its = all.map(function (it, k) { return { it: it, idx: k + 1 }; })
                .filter(function (o) { return !searching || o.it.t.toLowerCase().indexOf(q) > -1 || name.toLowerCase().indexOf(q) > -1; });
            if (!its.length) { return; }
            var isThis = l.id === E.lesson, open = searching || (E.open[l.id] !== undefined ? E.open[l.id] : (isThis || !!graded[l.id]));
            var gi = all.filter(function (it) { return E.g[it.id]; }).length;
            groups.push({ id: l.id, name: name, isThis: isThis, open: open, count: searching ? plural(its.length, 'match', 'matches') : gi + ' of ' + all.length, rows: its });
        });
        E.groups = groups;
        E.heads = groups.length > 1 || (groups.length === 1 && !groups[0].isThis);
        E.none = !groups.length;
        var L = edLesson(), its = L ? (E.itemsBy[L.id] || []) : [];
        E.L = L; E.gl = its.filter(function (it) { return E.g[it.id]; }).length; E.nl = its.length;
        E.pct = E.nl ? Math.round(E.gl / E.nl * 100) : 0;
        E.moved = E.lesson !== E.orig;
        E.origL = x.lessonById[E.orig] || null;
        E.N = edNext();
        E.drop = edDropped();
        E.hint = E.moved ? 'Lesson moved · a reason is needed' : E.drop.length ? plural(E.drop.length, 'grade') + ' cleared' : E.dirty ? 'Unsaved changes' : 'No changes yet';
        E.tagsAvail = E.tagsAll.filter(function (t) { return !E.tags.some(function (y) { return y.fid === t.id; }); });
        var f = E.f;
        E.barSub = x.name + ' · ' + C.fDay(f.date) + ' · ' + f.reg + ' · ' + f.hm + ' ' + (f.role === 'solo' ? 'solo' : 'dual') + ' with ' + (f.insName || 'the instructor');
    }
    vm.edView = edView;
    function itemOf(id) { var E = vm.E; for (var i = 0; i < E.items.length; i++) { if (E.items[i].id === id) { return E.items[i]; } } return null; }
    function touch() { vm.E.dirty = true; if (vm.E.err === 'empty') { vm.E.err = null; } edView(); }
    vm.edGrade = function (it, g) { var E = vm.E; if (E.g[it.id] === g.id) { delete E.g[it.id]; } else { E.g[it.id] = g.id; } touch(); };
    vm.edGradeOf = function (it) { var E = vm.E; return E && E.g[it.id] ? E.scaleById[E.g[it.id]] || null : null; };
    vm.edCleared = function (it) { var E = vm.E; return !!(E && !E.g[it.id] && E.g0[it.id]); };
    vm.edWas = function (it) { var E = vm.E, g = E && E.scaleById[E.g0[it.id]]; return g ? g.t : 'a grade'; };
    vm.edRmOpen = function (it) { vm.E.rmOpen = it.id; focus('stu-rm-' + it.id, 40); };
    vm.edRmDone = function () { var E = vm.E, id = E.rmOpen; E.rmOpen = null; if (id && trim(E.rm[id]) !== trim(E.rm0[id])) { touch(); } };
    vm.edRmText = function (it) { return vm.E ? trim(vm.E.rm[it.id]) : ''; };
    vm.edScope = function (s) { vm.E.scope = s; edView(); };
    vm.edQ = function () { edView(); };
    vm.edQClear = function () { vm.E.q = ''; edView(); };
    vm.edGroup = function (gr) { vm.E.open[gr.id] = !gr.open; edView(); };
    vm.edRemarks = function () { var E = vm.E; E.dirty = true; if (E.err === 'empty' && trim(E.remarks)) { E.err = null; } edView(); };
    vm.edReason = function () { var E = vm.E; if (E.err === 'reason' && trim(E.reason)) { E.err = null; } };
    vm.edStatus = function (s) { var E = vm.E; if (E.status === s) { return; } E.status = s; touch(); };
    /* the lesson pickers (picker A, ta-base .ta-pick + .ta-pickmenu: a dropdown on desktop, a bottom sheet on phones) */
    vm.edPick = function (which) {
        var E = vm.E;
        E.pick = E.pick === which ? null : which; E.pq = ''; E.pickHi = 0;
        edPickRows();
        if (E.pick && !vm.phone()) { focus('stu-pq', 30); }
    };
    vm.edPickClose = function () { if (vm.E) { vm.E.pick = null; } };
    function edPickRows() {
        var E = vm.E, x = vm.X, q = trim(E.pq).toLowerCase(), cur = E.pick === 'lesson' ? E.lesson : (E.N ? E.N.id : null);
        E.pickRows = x.p.lessons.filter(function (l) { return !q || (l.code + ' ' + l.title).toLowerCase().indexOf(q) > -1; }).map(function (l) {
            var s = x.p.st[l.i];
            return { l: l, t: l.code + ' · ' + l.title, s: (s.done ? 'Signed off ' + C.fDate(s.done.date) : s.recs.length ? plural(s.recs.length, 'flight') + ' · not signed off' : 'Not flown yet') + (l.solo ? ' · solo' : ''), good: !!s.done, on: l.id === cur };
        });
    }
    vm.edPickQ = function () { vm.E.pickHi = 0; edPickRows(); };
    vm.edPickDo = function (row) {
        var E = vm.E, x = vm.X, l = row.l;
        if (E.pick === 'lesson') { E.lesson = l.id; E.open[l.id] = true; }
        else { var L = edLesson(), after = L ? x.p.lessons[L.i + 1] : null; E.next = after && after.id === l.id ? 'order' : l.id; }
        E.pick = null; E.err = E.err === 'reason' ? E.err : null;
        touch();
    };
    vm.edPickKey = function (ev) {
        var E = vm.E, n = (E.pickRows || []).length;
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); if (n) { E.pickHi = (E.pickHi + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n; } }
        else if (ev.key === 'Enter') { ev.preventDefault(); if (E.pickRows[E.pickHi]) { vm.edPickDo(E.pickRows[E.pickHi]); } }
    };
    /* flight tags: tap one to add it (whole flight); "Part of it" with a 5-minute stepper capped at the flight */
    vm.edTagAdd = function (t) { var E = vm.E; E.tags.push({ fid: t.id, title: t.title, min: E.maxMin, whole: true }); touch(); };
    vm.edTagDel = function (t) { var E = vm.E; E.tags = E.tags.filter(function (y) { return y !== t; }); touch(); };
    vm.edTagWhole = function (t, on) { var E = vm.E; t.whole = on; t.min = on ? E.maxMin : Math.max(5, Math.round(E.maxMin / 2 / 5) * 5); touch(); };
    vm.edTagMin = function (t, d) { var E = vm.E; t.min = Math.max(5, Math.min(E.maxMin, t.min + d)); touch(); };

    vm.edCancel = function () {
        var E = vm.E;
        if (E && E.dirty) { vm.dlg = { t: 'leave', then: edBack }; return; }
        edBack();
    };
    function edBack(saved) {
        var E = vm.E, pls = E ? E.pls : null;
        vm.E = null; vm.tab = 'flights'; vm.dlg = null;
        if (pls) { vm.R.open = pls; vm.R.chip = 'all'; vm.R.q = ''; vm.R.more = true; vm.R.hi = saved ? pls : vm.R.hi; }
        syncUrl();
        flightList();
        if (pls) { flash(pls); }
    }
    vm.leaveYes = function () {
        var g = vm.dlg;
        leaving = true;
        if (vm.E) { vm.E.dirty = false; }
        vm.dlg = null;
        if (g && g.then) { g.then(); } else { edBack(); }
        $timeout(function () { leaving = false; }, 0);
    };
    function leaveGuard(e, to, toParams) {
        if (e.defaultPrevented || leaving || !vm.E || !vm.E.dirty || vm.tab !== 'edit' || to.name === SELF) { return; }
        e.preventDefault();
        vm.dlg = { t: 'leave', then: function () { $state.go(to.name, toParams); } };
    }

    vm.edSave = function () {
        var E = vm.E;
        if (!E || E.st !== 'ready' || E.saving) { return; }
        var any = Object.keys(E.g).some(function (k) { return E.g[k]; }) || Object.keys(E.rm).some(function (k) { return trim(E.rm[k]); });
        if (!any && !trim(E.remarks)) {
            E.err = 'empty';
            ToastService.warning('Nothing to save', 'Grade at least one objective, or write a general remark.');
            scrollTo('stu-e-objs');
            return;
        }
        if (E.moved && !trim(E.reason)) {
            E.err = 'reason';
            ToastService.warning('Reason required', 'You moved this record to another lesson: give a reason for the edit.');
            scrollTo('field-edit-reason'); focus('stu-ereason', 300);
            return;
        }
        if (E.drop.length) { vm.dlg = { t: 'removal', rows: dropRows(E.drop) }; return; }
        edSend({});
    };
    vm.edSaveRemove = function () { vm.dlg = null; edSend({ confirm_item_removal: true }); };
    vm.edSaveIdentity = function () { var g = vm.dlg; vm.dlg = null; edSend(angular.extend({ confirm_identity_change: true }, g && g.extra)); };
    function dropRows(ids) {
        var E = vm.E, x = vm.X;
        return ids.map(function (k) {
            var it = itemOf(+k), L = it ? x.lessonById[it.l] : null, g = E.scaleById[E.g0[k]];
            return { code: L ? L.code : '', t: it ? it.t : (x.itemTitle[+k] || 'Objective'), was: g ? g.t : 'a remark' };
        });
    }
    function scrollTo(id) { $timeout(function () { var el = document.getElementById(id); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 40, false); }
    function edPayload(extra) {
        var E = vm.E, items = [], keys = Object.keys(E.g).concat(Object.keys(E.rm)).filter(function (k, i, a) { return a.indexOf(k) === i; });
        keys.sort(function (a, b) { return +a - +b; }).forEach(function (k) {
            var g = E.g[k] || null, rm = trim(E.rm[k]);
            if (g || rm) { items.push({ lesson_item_id: +k, result: g, remarks: rm }); }
        });
        var body = {
            update_record_id: E.trId,
            edited_by: me,
            items: items,
            general_remarks: trim(E.remarks) + (E.tag ? (trim(E.remarks) ? ' ' : '') + E.tag : ''),
            lesson_id: E.lesson,
            completed: E.status === 'done' ? 1 : 0,
            flight_tags: E.tags.map(function (t) { return { flight_tag_id: t.fid, id: t.fid, title: t.title, logging_time: t.whole ? E.maxMin : t.min }; }),
            edit_reason: trim(E.reason)
        };
        if (E.status === 'done' && E.N) { body.next_lesson_id = E.N.id; }
        return angular.extend(body, extra || {});
    }
    function edSend(extra) {
        var E = vm.E;
        if (!E || E.saving) { return; }
        E.saving = true;
        var payload = edPayload(extra);
        D.saveRecord(payload, E.trId).then(function (res) {
            if (vm.E !== E) { return; }
            E.saving = false;
            var d = res && res.error ? res : (res && res.message && typeof res.message === 'object' ? res.message : res) || {};
            if (res && res.success) {
                E.dirty = false;
                ToastService.success('Record saved', 'Saved as a new version' + (payload.edit_reason ? ', with your reason.' : '. The original stays in its history.'));
                var pls = E.pls;
                edBack(true);
                reloadQuiet(function () { vm.R.open = pls; vm.R.hi = pls; flightList(); flash(pls); });
                return;
            }
            if (d.error === 'CONFIRM_REQUIRED' && d.confirm === 'item_removal') {
                vm.dlg = { t: 'removal', server: d.message || '', rows: dropRows((d.removed_lesson_item_ids || []).map(String)) };
                ToastService.handledInline();
                return;
            }
            if (d.error === 'CONFIRM_REQUIRED' && d.confirm === 'identity_change') {
                vm.dlg = { t: 'identity', msg: d.message || 'This would move the record to a different student or flight.', changes: (d.changes || []).map(function (c) { return { field: c.field, from: c.from_name || c.from, to: c.to_name || c.to }; }), extra: extra };
                ToastService.handledInline();
                return;
            }
            if (d.error === 'ALREADY_SUPERSEDED') { ToastService.error('Record out of date', 'It was edited elsewhere since you opened it. Go back to the flights, open it again and redo the change.'); return; }
            if (d.error === 'FORBIDDEN') { ToastService.error('Not allowed', 'Only the club’s instructors and admins can edit its records.'); return; }
            ToastService.error('Not saved', D.msg(d, 'The record could not be saved. Try again.'));
        });
    }
}
