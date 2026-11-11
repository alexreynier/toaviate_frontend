/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · CAA forms — design: mockups/instructor-dashboard/caa-forms.html (approved 9 Nov 2026).
   Built beside v1 (views/manageuser/caa_forms/list.html, new.html, _eligibility.html; CaaFormsController screens
   'list' and 'new') behind the global v2 switch (js/v2/core/design.js). Tracker: mockups/v2-build/fe-instructor-caa-forms.md.

   States (the v1 param names):
     dashboard.v2.instructor_caa_forms      /manage_user/caa_forms?club_id&tab   ← dashboard.manage_user.caa_forms
     dashboard.v2.instructor_caa_forms_new  /manage_user/caa_forms/new?club_id   ← dashboard.manage_user.caa_forms_new
   The form page (dashboard.caa_form, /caa_form/:id: the draft editor, sign / decline, files, audit) stays v1. Open the
   form, Review and sign and Countersign all go there.

   Data: v1's routes through CaaFormsService, with the C35 additions (mockups/v2-build/be-alex-3e.md, landed 21:41):
     GET caa_forms?club_id        forms[] (+ has_open_box, initiated_by_name / _colour, document_labels[],
                                  signatures[].signer_colour) and roles {is_instructor, is_hot, can_manage_deputies, can_create}
     GET caa_forms/queue          rows + open_to_any (D22); the row's signatures come from the club list (same form id)
     GET caa_forms/hot_queue      only when roles.is_hot (the tab follows roles, not a FORBIDDEN reply)
     GET/POST/DELETE caa_forms/deputies   + can_manage, live / is_instructor (D18: deputies are live instructors), appointment_history[]
     GET caa_forms/types, caa_forms/prefill/{type}/{user}?club_id&course_id&expiry_date, POST caa_forms, GET …/{id}/pdf
     Members: GET members/club_and_name/{club}/{q} (2+ letters, 50 rows, current members: a form needs one). "Your recent
     students first" + the member count: GET training_records/v2/students/{club}?scope=mine (F4, C39), left out if it fails.
     C35 additions read here: aircraft_colour on the revalidation candidates / flights counted, windows' from_club /
     from_manual, email_sent_at (+ email_send_count) on outside signers, sources for the seeded hours, signer_display_name on
     pending named boxes (the club's instructor list is the fallback), course_hours as decimal hours.
     Endorse a training flight: POST logbook_endorsements/sign (C34, the stamp from GET logbook_endorsements/my_signature).

   Here: CfmV2Data (reads + ONE words helper for the domain: raw enums never reach the screen), the two controllers and
   <cfm-endorse-dialog>. Views: views/v2/instructor_caa_forms/. CSS: css/v2/instructor-caa-forms.css (.cfm-*).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.instructor_caa_forms', {
            url: '/manage_user/caa_forms?club_id&tab',
            templateUrl: 'views/v2/instructor_caa_forms/list.html',
            controller: 'CfmHubV2Controller', controllerAs: 'vm',
            reloadOnSearch: false   // the club and tab follow the page into the URL without reloading it
        })
        .state('dashboard.v2.instructor_caa_forms_new', {
            url: '/manage_user/caa_forms/new?club_id',
            templateUrl: 'views/v2/instructor_caa_forms/new.html',
            controller: 'CfmNewV2Controller', controllerAs: 'vm',
            reloadOnSearch: false
        });
    DesignRoutesProvider
        .map('dashboard.manage_user.caa_forms', 'dashboard.v2.instructor_caa_forms')
        .map('dashboard.manage_user.caa_forms_new', 'dashboard.v2.instructor_caa_forms_new');
}]);


/* cfm-still (on the page): ngAnimate off for the page. The motion is CSS (ins-rise as content arrives, ta-open, ta-pop /
   ta-sheet); with ngAnimate on, a row or a step section that leaves would wait out its finished ins-rise animation
   (up to ~0.7 s with the stagger) before going, so old and new content overlapped and the page jumped. */
app.directive('cfmStill', ['$animate', function ($animate) {
    return { restrict: 'A', link: function (scope, element) { $animate.enabled(element, false); } };
}]);


// ═══════════════════════════════════════════════════════════════════════
// CfmV2Data — reads, writes and the words (the member's side's words, from the instructor's seat)
// ═══════════════════════════════════════════════════════════════════════
app.factory('CfmV2Data', CfmV2Data);
CfmV2Data.$inject = ['$q', 'InsCore', 'CaaFormsService', 'UserService', 'MemberService', 'InstructorService', 'LogbookEndorsementsService', 'CourseService'];
function CfmV2Data($q, InsCore, CaaFormsService, UserService, MemberService, InstructorService, LogbookEndorsementsService, CourseService) {
    var C = InsCore;
    var CLUB_KEY = 'toaviate_instructor_selected_club_id';   // shared with v1, so both remember the same club
    /* form type → short name, CAA code, category, signer roles, HoT countersigns, eligibility check, family.
       GET caa_forms/types stays authoritative for roles, flags and titles; these are the words. */
    var WORDS = {
        srg1157_reval: ['SEP revalidation by experience', 'SRG1157', 'revalidation', ['applicant', 'instructor'], false, true, 'reval'],
        srg1107_reval: ['SEP revalidation certificate', 'SRG1107', 'revalidation', ['applicant', 'instructor'], false, true, 'reval'],
        srg1157_skill_test: ['Skill test or proficiency check', 'SRG1157', 'skill_test', ['applicant', 'examiner'], false, false, 'skill_test'],
        srg1157_ir: ['Instrument rating test', 'SRG1157', 'skill_test', ['applicant', 'examiner'], false, false, 'skill_test'],
        srg2128: ['PPL(A) skill test report', 'SRG2128', 'skill_test', ['applicant', 'examiner'], false, false, 'skill_test'],
        srg2130: ['CPL(A) skill test report', 'SRG2130', 'skill_test', ['applicant', 'examiner'], false, false, 'skill_test'],
        srg2129: ['Test failure report', 'SRG2129', 'skill_test', ['examiner'], false, false, 'skill_test'],
        srg1176: ['IMC / IR(R) test report', 'SRG1176', 'skill_test', ['applicant', 'examiner'], false, false, 'skill_test'],
        srg2199: ['Examiner record', 'SRG2199', 'skill_test', ['applicant', 'examiner'], false, false, 'skill_test'],
        certified_true_copy: ['Certified true copy', '', 'certification', ['hot'], true, false, 'true_copy'],
        caa5016: ['PPL course completion', 'CAA5016', 'certificate', ['instructor', 'hot'], true, false, 'caa_certificate'],
        caa5017: ['Night rating course completion', 'CAA5017', 'certificate', ['instructor', 'hot'], true, false, 'caa_certificate'],
        caa5019: ['IMC / IR(R) course completion', 'CAA5019', 'certificate', ['instructor', 'hot'], true, false, 'caa_certificate'],
        caa5020: ['Aerobatic, banner, mountain or flight test course completion', 'CAA5020', 'certificate', ['instructor', 'hot'], true, false, 'caa_certificate'],
        course_certificate: ['Course completion certificate (club)', '', 'certificate', ['instructor', 'hot'], true, false, 'certificate']
    };
    var CAT = { revalidation: ['Revalidation', 'fa-sync-alt'], skill_test: ['Skill tests and examiner reports', 'fa-clipboard-check'], certification: ['Certification', 'fa-copy'], certificate: ['Course certificates', 'fa-graduation-cap'] };
    var CAT_ORDER = ['revalidation', 'skill_test', 'certification', 'certificate'];
    var ROLE = { applicant: 'Applicant', instructor: 'Instructor', examiner: 'Examiner', hot: 'Head of Training' };
    var WHO = { applicant: 'the applicant', instructor: 'an instructor', examiner: 'an examiner', hot: 'the Head of Training' };
    var STATUS = {
        draft: ['pend', 'Draft', 'fa-pen'], awaiting_signatures: ['info', 'Waiting for signatures', 'fa-hourglass-half'],
        awaiting_hot: ['info', 'With the Head of Training', 'fa-user-tie'], completed: ['good', 'Completed', 'fa-check'],
        declined: ['bad', 'Declined', 'fa-times-circle'], cancelled: ['muted', 'Cancelled', 'fa-ban']
    };
    /* where a prefilled box came from (prefill.sources) */
    var SRC = { users: 'from profile', user_licences: 'from licence', user_licences_ratings: 'from rating', sms_settings: 'from club', clubs: 'from club',
        courses: 'from course', training_records: 'from records', logbook: 'from logbook', manual: 'from pilot’s entries', 'logbook+manual': 'from logbook + pilot’s entries',
        'flight_tags (night)': 'from night tags', 'flight_tags (instrument)': 'from instrument tags' };
    /* the wizard's boxes: the editor schema (CaaFormsService.schema) by family; skill tests show the design's set (the rest
       stays in the draft editor). The club certificate's course_hours is an hours box (C35: decimal hours, or left out). */
    var SKILL_TEST = ['test_kind', 'class_rating', 'rating_tested', 'test_date', 'location', 'aircraft_type', 'aircraft_registration', 'result', 'notes'];
    var HINTS = {
        total_hours_validity: 'SRG1107 §3.1 first box: total flight time in the 24-month validity period',
        total_hours_12m: 'Checklist figure; not printed on SRG1107',
        rating_tested: 'Type tests only — leave blank for a class test'
    };
    var FCL = 'Training Flight(s) iaw FCL.740.A(b)(1)(ii)';

    var apiTypes = null, typeCache = {}, insCache = {}, recentCache = {};

    var S = {
        ROLE: ROLE, CAT_ORDER: CAT_ORDER, FCL: FCL, CLUB_KEY: CLUB_KEY,
        typeOf: typeOf, catOf: catOf, whoSigns: whoSigns, srcWord: srcWord, parseHours: CaaFormsService.parseHours, hm: C.hm,
        fDay: C.fDay, fDate: C.fDate, fDayLong: C.fDayLong, fTime: C.fTime, when: when, plural: plural, firstName: C.firstName,
        initials: initials, mScore: mScore, tagName: tagName, lowerFirst: lowerFirst,
        decorate: decorate, layout: layout, rememberClub: rememberClub, savedClub: savedClub,
        clubs: clubs, hub: hub, hotQueue: hotQueue, deputies: deputies, addDeputy: addDeputy, removeDeputy: removeDeputy,
        instructors: instructors, searchMembers: searchMembers, recentStudents: recentStudents,
        types: types, prefill: prefill, create: create, pdf: pdf, mySignature: mySignature, signDirect: signDirect,
        sortCourses: function (list) { return CourseService.sortByDisplayOrder ? CourseService.sortByDisplayOrder(list || []) : (list || []); }
    };
    return S;

    // ── words ──
    function plural(n, one, many) { return (+n || 0).toLocaleString('en-GB') + ' ' + (+n === 1 ? one : (many || one + 's')); }
    /* this year: the weekday ("Thu 5 Nov"); older: the year ("27 Oct 2025") */
    function when(s) { return !s ? '' : String(s).slice(0, 4) === C.today().slice(0, 4) ? C.fDay(s) : C.fDate(s); }
    function initials(n) { return String(n || '').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
    function lowerFirst(s) { s = String(s || ''); return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
    /* a course's flight tag as typed ("INSTRUMENT FLYING" → "Instrument flying") */
    function tagName(t) { t = String(t || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }
    function srcWord(src) { return src ? (SRC[src] || 'prefilled') : ''; }
    function catOf(c) { var x = CAT[c]; return x ? { label: x[0], icon: x[1] } : { label: CaaFormsService.categoryLabels[c] || 'Other forms', icon: 'fa-file-alt' }; }
    function typeOf(ft) {
        if (typeCache[ft]) { return typeCache[ft]; }
        var w = WORDS[ft], a = (apiTypes && apiTypes[ft]) || {};
        var sigs = (a.signatures || (w ? w[3] : [])).slice();
        var hot = a.hot_countersign !== undefined ? !!a.hot_countersign : !!(w && w[4]);
        if (hot && sigs.indexOf('hot') < 0) { sigs.push('hot'); }
        var t = {
            form_type: ft,
            short: w ? w[0] : (a.title || CaaFormsService.typeTitle(ft)),
            code: w ? w[1] : '',
            category: a.category || (w ? w[2] : 'skill_test'),
            signatures: sigs,
            hot_countersign: hot,
            has_eligibility: a.has_eligibility !== undefined ? !!a.has_eligibility : !!(w && w[5]),
            family: CaaFormsService.familyOf(ft) || (w ? w[6] : null),
            title: a.title || CaaFormsService.typeTitle(ft)
        };
        t.who = whoSigns(t);
        t.icon = catOf(t.category).icon;
        typeCache[ft] = t;
        return t;
    }
    function whoSigns(t) {
        var w = (t.signatures || []).map(function (r) { return WHO[r] || r; });
        return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : (w[0] || 'the people it names');
    }
    function docsOf(f) { return (f.document_labels || []).filter(Boolean).map(lowerFirst).join(', '); }

    /* first names beat surnames, both beat e-mail; words match from their start (0 = no match) */
    function mScore(p, q) {
        var t = String(q || '').trim().toUpperCase().split(/\s+/).filter(Boolean), sc = 0;
        if (!t.length) { return 1; }
        var f = String(p.first_name || '').toUpperCase(), l = String(p.last_name || '').toUpperCase(), e = String(p.email || '').toUpperCase();
        for (var i = 0; i < t.length; i++) {
            var x = t[i], s = f.indexOf(x) === 0 ? 3 : l.indexOf(x) === 0 ? 2 : e.indexOf(x) === 0 ? 1 : 0;
            if (!s) { return 0; }
            sc += s;
        }
        return sc;
    }

    // ── one status helper, one steps helper, one signature-box helper ──
    function sigOf(f, role) { return (f.signatures || []).filter(function (s) { return s.role === role; })[0] || null; }
    function mineBox(f, me) { return (f.signatures || []).filter(function (s) { return s.role !== 'hot' && +s.signer_user_id === me && s.status === 'pending'; })[0] || null; }
    function needsMe(f, me) { return (f.status === 'awaiting_signatures' || f.status === 'awaiting_hot') && !!mineBox(f, me); }
    /* an open box (D22): a pending instructor / examiner box nobody was named for and not e-mailed outside */
    function openBox(f) {
        if (f.status !== 'awaiting_signatures') { return null; }
        var sigs = f.signatures || [];
        if (!sigs.length) { return f.has_open_box ? { role: 'instructor' } : null; }
        return sigs.filter(function (s) { return (s.role === 'instructor' || s.role === 'examiner') && !s.signer_user_id && !s.is_external && !s.signer_email && s.status === 'pending'; })[0] || null;
    }
    function pill(tone, label, icon) { return { tone: tone, label: label, icon: icon || null }; }
    function statusOf(f, c) {
        if (f._mine) { return pill('warn', 'Needs your signature', 'fa-pen-nib'); }
        if (f.status === 'awaiting_hot' && c.isHot) { return pill('warn', 'Needs your countersignature', 'fa-stamp'); }
        var s = STATUS[f.status] || ['muted', 'Status unknown', 'fa-question'];
        return pill(s[0], s[1], s[2]);
    }
    function steps(f, me) {
        var ty = typeOf(f.form_type), st = [{ t: 'Prepared', s: f.status === 'draft' ? 'now' : 'done' }];
        ['applicant', 'instructor', 'examiner'].forEach(function (role) {
            var s = sigOf(f, role) || (f.status === 'draft' && ty.signatures.indexOf(role) > -1 ? { status: 'pending' } : null);
            if (!s) { return; }
            st.push({ t: s.signer_user_id && +s.signer_user_id === me ? 'You sign' : ROLE[role] + ' signs', s: s.status === 'signed' ? 'done' : s.status === 'declined' ? 'bad' : f.status === 'awaiting_signatures' ? 'now' : '' });
        });
        var hot = sigOf(f, 'hot') || (ty.hot_countersign && f.status === 'draft' ? { status: 'pending' } : null);
        if (hot) { st.push({ t: 'Head of Training', s: hot.status === 'signed' ? 'done' : hot.status === 'declined' ? 'bad' : f.status === 'awaiting_hot' ? 'now' : '' }); }
        st.push({ t: 'Completed', s: f.status === 'completed' ? 'done' : '' });
        st.forEach(function (x, i) { x.line = i > 0; });
        return st;
    }
    function miniLabel(f, st) {
        if (f.status === 'completed') { return 'All done'; }
        if (f.status === 'declined') { return 'Stopped'; }
        var k = st.filter(function (x) { return x.s === 'done'; }).length;
        return 'Step ' + Math.min(k + 1, st.length) + ' of ' + st.length;
    }
    /* one signature box, as a line: who, what they sign as, where it stands */
    function sigLine(f, s, c) {
        var who, av, p, me = c.me, person = s.signer_user_id ? c.person(s.signer_user_id) : null;
        var name = s.signer_name || s.signer_display_name || (person && person.name) || '';
        if (s.role === 'applicant') { who = f.subject_name || name || 'The applicant'; av = { kind: 'member', icon: 'fa-user' }; }
        else if (s.role === 'hot') {
            who = s.signer_user_id ? (name || 'Head of Training') : 'Head of Training or a deputy';
            av = s.signer_user_id && name ? { kind: 'ins', ini: initials(name), colour: s.signer_colour || (person && person.colour) || null, title: name + ' (instructor)' } : { kind: 'member', icon: 'fa-user-shield' };
        }
        else if (s.is_external) { who = (s.signer_name || 'External ' + ROLE[s.role].toLowerCase()) + (s.signer_email ? ' · ' + s.signer_email : ''); av = { kind: 'member', icon: 'fa-envelope' }; }
        else if (!s.signer_user_id) { who = 'Any instructor at the club'; av = { kind: 'any' }; }
        else {
            who = (name || 'A named ' + ROLE[s.role].toLowerCase()) + (+s.signer_user_id === me ? ' (you)' : '');
            av = name ? { kind: 'ins', ini: initials(name), colour: s.signer_colour || (person && person.colour) || null, title: name + ' (instructor)' } : { kind: 'member', icon: 'fa-user' };
        }
        if (s.status === 'signed') { p = pill('good', 'Signed ' + when(s.signed_at), 'fa-check'); }
        else if (s.status === 'declined') { p = pill('bad', 'Declined' + (s.signed_at ? ' ' + C.fDay(s.signed_at) : ''), 'fa-times-circle'); }
        else if (f.status === 'draft') { p = pill('muted', 'After it’s sent'); }
        else if (s.role === 'hot') { p = f.status === 'awaiting_hot' ? (c.isHot ? pill('warn', 'Waiting for you', 'fa-stamp') : pill('info', 'Waiting', 'fa-hourglass-half')) : pill('muted', 'After the others'); }
        else if (s.signer_user_id && +s.signer_user_id === me) { p = pill('warn', 'Waiting for you', 'fa-pen-nib'); }
        else if (s.is_external) { p = pill('pend', s.email_sent_at ? 'Emailed ' + C.fDay(s.email_sent_at) : 'Emailed', 'fa-envelope'); }
        else if (!s.signer_user_id) { p = pill('pend', 'Nobody named yet', 'fa-user-plus'); }
        else { p = pill('info', 'Waiting', 'fa-hourglass-half'); }
        return { id: s.id, who: who, sub: ROLE[s.role] + (s.role === 'applicant' ? ' · the member the form is about' : ''), av: av, pill: p };
    }

    /* everything a row and its opened detail show, worked out once per load (c: me, isHot, isInstructor, clubTitle(id), person(id)) */
    function decorate(f, c) {
        var ty = typeOf(f.form_type), me = c.me, box = mineBox(f, me);
        f.signatures = f.signatures || [];
        f._ty = ty;
        f._docs = docsOf(f);
        f._t = ty.short + (f._docs ? ' — ' + f._docs : '');
        f._code = ty.code;
        f._by = f.initiated_by_name || f.initiator_name || (c.person(f.initiated_by) || {}).name || 'an instructor';
        f._byMe = +f.initiated_by === me;
        f._mine = f._qrole ? !f._qopen : needsMe(f, me);
        var ob = openBox(f);
        f._any = f._qrole ? !!f._qopen : (!!ob && c.isInstructor && +f.subject_user_id !== me);
        f._anyRole = f._qrole || (ob && ob.role) || 'instructor';
        f._myRole = f._qrole || (box && box.role) || 'instructor';
        f._hotNow = f.status === 'awaiting_hot' && !!c.isHot;
        f._st = statusOf(f, c);
        f._icon = f._mine ? 'fa-file-signature' : ty.icon;
        var calm = f.status === 'completed' ? 'ta-ic--good' : f.status === 'declined' ? 'ta-ic--bad' : '';
        f._toneF = f._mine ? 'ta-ic--brand' : calm;
        f._toneQ = f._mine || f._hotNow ? 'ta-ic--brand' : calm;
        f._steps = steps(f, me);
        f._mini = miniLabel(f, f._steps);
        f._subF = f.subject_name + ' · started by ' + (f._byMe ? 'you' : f._by) + ' · ' + when(f.created_at);
        f._subQ = f.subject_name + ' · signing as ' + (f._mine ? ROLE[f._myRole] : 'the ' + String(ROLE[f._anyRole] || '').toLowerCase()) + ' · started by ' + f._by;
        f._subH = f.subject_name + ' · started by ' + f._by + ' · ' + when(f.created_at);
        f._qPill = f._any && !f._mine ? pill('pend', 'Any instructor can sign', 'fa-users') : f._st;
        f._waitQ = 'waiting since ' + C.fDay(f.locked_at || f.created_at);
        f._waitH = 'waiting since ' + C.fDay(f.updated_at || f.created_at);
        f._hotPills = f.signatures.filter(function (s) { return s.role !== 'hot'; }).map(function (s) { return pill('good', ROLE[s.role] + ' · ' + (s.signer_name || ''), 'fa-check'); });
        f._hay = [f.subject_name, ty.short, ty.code, ty.title, f.title, f._docs, f._by].join(' ').toLowerCase();
        // the opened row
        var notes = [], dec = f.signatures.filter(function (s) { return s.status === 'declined'; })[0];
        var ext = f.signatures.filter(function (s) { return s.is_external && s.status === 'pending'; })[0];
        if (f._mine) { notes.push({ cls: 'ta-note--warn', icon: 'fa-pen-nib', b: 'Your signature is needed', t: ' as the ' + ROLE[f._myRole].toLowerCase() + '. Read the form through' + (f._byMe ? '' : ' — ' + f._by + ' filled it in') + ' — then sign.' }); }
        if (f._any && !f._mine) { notes.push({ cls: 'ta-note--info', icon: 'fa-users', b: 'Nobody was named for the ' + ROLE[f._anyRole].toLowerCase() + '’s box,', t: ' so any instructor at the club can sign it. It shows in every instructor’s “To sign” list.' }); }
        if (ext) {
            var sent = ext.email_sent_at ? (+ext.email_send_count > 1 ? ', sent ' + ext.email_send_count + ' times, last ' + C.fDay(ext.email_sent_at) : ', ' + C.fDay(ext.email_sent_at)) : '';
            notes.push({ cls: '', icon: 'fa-envelope', b: 'Sent to an outside ' + ROLE[ext.role].toLowerCase() + ':', t: ' ' + (ext.signer_name || 'the ' + ROLE[ext.role].toLowerCase()) + (ext.signer_email ? ' (' + ext.signer_email + ')' : '') + sent + '. They sign from the emailed link; the box can’t be signed in the app. The link lasts 30 days.' });
        }
        if (dec) {
            var decName = dec.signer_name || dec.signer_display_name || (c.person(dec.signer_user_id) || {}).name || ROLE[dec.role];
            notes.push({ cls: 'ta-note--bad', icon: 'fa-times-circle', b: 'Declined by ' + decName + (dec.signed_at ? ', ' + C.fDay(dec.signed_at) : '') + ':',
                t: (dec.decline_reason ? ' “' + dec.decline_reason + '”' : '') + ' ' + (f._byMe ? 'Revert it to a draft on the form page, correct it and send it again.' : f._by + ' can revert it to a draft, correct it and send it again.') });
        }
        if (f.status === 'draft') { notes.push({ cls: 'ta-note--info', icon: 'fa-pen', b: 'Not sent for signatures yet.', t: ' Open the draft to check the details and submit it; nobody is asked to sign until then.' }); }
        if (f.status === 'completed') { notes.push({ cls: 'ta-note--good', icon: 'fa-check-circle', b: '', t: 'Completed ' + C.fDayLong(f.completed_at || f.updated_at) + '. The PDF is the official CAA form with every signature on it.' }); }
        f._notes = notes;
        f._sigs = f.signatures.map(function (s) { return sigLine(f, s, c); });
        f._facts = [
            { dt: 'Form', dd: f.title || ty.title },
            { dt: 'Member', dd: f.subject_name },
            f._docs ? { dt: 'Documents', dd: f._docs.charAt(0).toUpperCase() + f._docs.slice(1) } : { dt: 'Club', dd: c.clubTitle(f.club_id) },
            { dt: 'Started', dd: when(f.created_at), sm: '· ' + (f._byMe ? 'you' : f._by) },
            { dt: 'Last change', dd: when(f.updated_at || f.created_at) },
            f.completed_at ? { dt: 'Completed', dd: when(f.completed_at) } : (ty.hot_countersign || sigOf(f, 'hot') ? { dt: 'Head of Training', dd: 'Countersigns' } : { dt: 'Head of Training', dd: '', sm: 'Not needed' })
        ];
        f._openLabel = f.status === 'draft' ? 'Open the draft' : 'Open the form';
        f._signBtn = f._mine || f._any ? 'sign' : f._hotNow ? 'hot' : '';
        return f;
    }

    /* the wizard's boxes for a form type: [{ title, fields: [{ key, label, type, options, optionLabels, hint, full }] }] */
    function layout(ft) {
        var fam = typeOf(ft).family, schema = CaaFormsService.schema(ft) || [], byKey = {};
        schema.forEach(function (g) { g.fields.forEach(function (d) { byKey[d.key] = d; }); });
        var groups = schema.map(function (g) { return { title: g.title, keys: g.fields.map(function (d) { return d.key; }) }; });
        if (fam === 'skill_test') { groups = [groups[0], { title: 'Test details', keys: SKILL_TEST }]; }
        return groups.map(function (g) {
            return { title: g.title, fields: g.keys.filter(function (k) { return k !== 'sections'; }).map(function (k) {
                var d = byKey[k] || { key: k, label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '), type: 'text' };
                var out = { key: k, label: d.label, type: d.type || 'text', options: d.options || null, optionLabels: d.optionLabels || {}, hint: HINTS[k] || null, full: d.type === 'textarea' };
                if (fam === 'skill_test' && k === 'class_rating') { out.label = 'Class rating tested'; out.type = 'text'; out.options = null; out.hint = 'Class tests only, e.g. “SEP (land)” — use this or the type field'; }
                return out;
            }) };
        });
    }

    // ── the club, remembered (v1's key, and in the URL) ──
    function savedClub() { try { return localStorage.getItem(CLUB_KEY); } catch (e) { return null; } }
    function rememberClub(id) { try { localStorage.setItem(CLUB_KEY, String(id)); } catch (e) { /* private window */ } }

    // ── reads ──
    function asList(d, key) {
        if (angular.isArray(d)) { return d; }
        if (d && angular.isArray(d[key])) { return d[key]; }
        if (d && angular.isArray(d.items)) { return d.items; }
        return [];
    }
    /* staff clubs = instructor OR manager OR Head of Training / deputy (v1's UserService.GetStaffClubs) */
    function clubs() {
        return UserService.GetStaffClubs(C.myId()).then(function (d) {
            var seen = {};
            return ((d && d.clubs) || []).map(function (c) { return { id: +c.id, title: c.title || c.name || 'Club' }; })
                .filter(function (c) { if (!c.id || seen[c.id]) { return false; } seen[c.id] = 1; return true; });
        }, function () { return []; });
    }
    /* the club list + my queue in one go; the countersign queue only for the Head of Training, deputies and managers */
    function hub(clubId) {
        return $q.all([CaaFormsService.List(clubId), CaaFormsService.Queue(clubId)]).then(function (r) {
            var list = r[0] || {}, q = r[1] || {};
            if (list.success === false) { return { ok: false, error: list }; }
            var roles = list.roles || null, isHot = roles ? !!roles.is_hot : null;
            var out = { ok: true, forms: asList(list, 'forms'), queue: q.success === false ? [] : asList(q, 'queue'), roles: roles, readOnly: !!list.read_only, queueFailed: q.success === false };
            if (isHot === false) { out.isHot = false; out.hot = []; return out; }
            return hotQueue(clubId).then(function (h) {
                // no roles (an older API): v1's rule, the countersign queue answering means HoT / deputy here
                out.isHot = isHot === null ? h.ok : isHot;
                out.hot = h.rows;
                return out;
            });
        });
    }
    function hotQueue(clubId) {
        return CaaFormsService.HotQueue(clubId).then(function (h) {
            var ok = !!h && h.success !== false;
            return { ok: ok, rows: ok ? asList(h, 'queue') : [] };
        });
    }
    function deputies(clubId) {
        return CaaFormsService.GetDeputies(clubId).then(function (d) {
            if (!d || d.success === false) { return { ok: false, error: d }; }
            return { ok: true, hot: d.head_of_training || null, list: d.deputies || [], canManage: d.can_manage, history: d.appointment_history || [] };
        });
    }
    function addDeputy(clubId, userId) { return CaaFormsService.AddDeputy(clubId, userId); }
    function removeDeputy(id) { return CaaFormsService.RemoveDeputy(id); }
    /* the club's live instructors (names + colours): pending signers' names and the deputy picker */
    function instructors(clubId) {
        if (!insCache[clubId]) {
            insCache[clubId] = InstructorService.GetAllByClub(clubId, C.myId()).then(function (d) {
                var seen = {};
                return ((d && d.instructors) || []).map(function (i) {
                    var id = +(i.user_id || 0), fn = i.first_name || '', ln = i.last_name || '';
                    return { user_id: id, first_name: fn, last_name: ln, name: (fn + ' ' + ln).trim() || i.name || '', email: i.email || '', colour: i.booking_colour || i.instructor_colour || null };
                }).filter(function (i) { if (!i.user_id || seen[i.user_id]) { return false; } seen[i.user_id] = 1; return true; });
            }, function () { return []; });
            insCache[clubId].then(function (l) { if (!l.length) { delete insCache[clubId]; } });
        }
        return insCache[clubId];
    }
    /* GET members/club_and_name/{club}/{q}: names + e-mail of the club's current members (2+ letters, 50 at most) */
    function searchMembers(clubId, q) {
        return MemberService.GetAllByClubAndName(clubId, encodeURIComponent(q)).then(function (d) {
            if (!d || d.success === false) { return { ok: false, rows: [] }; }
            return { ok: true, rows: asList(d, 'members').map(person).filter(function (m) { return m.user_id > 0; }) };
        });
    }
    function person(m) {
        var fn = m.first_name || '', ln = m.last_name || '';
        if (!fn && !ln && m.name) { var p = String(m.name).split(' '); fn = p.shift(); ln = p.join(' '); }
        return { user_id: +(m.user_id || m.id || 0), first_name: fn, last_name: ln, name: (fn + ' ' + ln).trim(), email: m.email || '' };
    }
    /* "Your recent students" — F4, C39: GET training_records/v2/students/{club}?scope=mine, your students at the club ("Needs
       you" first). Here: current members only (the form needs one), latest flight first, 8 at most; the second line is the
       e-mail, else the course. clubs[].member_count gives the picker its "all 1,900 members". A failed read (not an instructor
       there) leaves both out. → { rows, count } */
    function recentStudents(clubId) {
        if (!recentCache[clubId]) {
            recentCache[clubId] = C.get('training_records/v2/students/' + clubId, { scope: 'mine', limit: 30 }).then(function (d) {
                var ok = d && d.success !== false, rows = ok ? (d.students || []) : [];
                var club = ok ? (d.clubs || []).filter(function (c) { return +c.club_id === +clubId; })[0] : null;
                var count = club && club.member_count !== undefined && club.member_count !== null ? +club.member_count : null;
                return { count: count, rows: (angular.isArray(rows) ? rows : []).filter(function (r) {
                    var st = r.membership && r.membership.status;
                    return !st || st === 'member' || st === 'needs_end_date';
                }).map(function (r) {
                    var p = person(r);
                    p.last = (r.last_flight && r.last_flight.date) || null;
                    p.sub = (r.course && (r.course.short_title || r.course.title)) || (r.membership && r.membership.name) || '';
                    return p;
                }).filter(function (p) { return p.user_id > 0 && p.name; })
                  .sort(function (a, b) { return (b.last || '') < (a.last || '') ? -1 : (b.last || '') > (a.last || '') ? 1 : 0; }).slice(0, 8) };
            }, function () { return { count: null, rows: [] }; });
        }
        return recentCache[clubId];
    }
    function types() {
        return CaaFormsService.GetTypes().then(function (d) {
            if (!d || d.success === false) { return { ok: false, error: d }; }
            apiTypes = {}; typeCache = {};
            (d.types || []).forEach(function (t) { apiTypes[t.form_type] = t; });
            return { ok: true, list: (d.types || []).map(function (t) { return typeOf(t.form_type); }) };
        });
    }
    function prefill(ft, userId, clubId, courseId, expiry) { return CaaFormsService.GetPrefill(ft, userId, clubId, courseId || null, expiry || null); }
    function create(body) { return CaaFormsService.Create(body); }
    /* the official PDF (auth-headed blob; the name from X-Filename) */
    function pdf(f) {
        return CaaFormsService.GetPdf(f.id, (f._t || 'CAA form') + ' — ' + (f.subject_name || '') + '.pdf').then(function (res) {
            if (!res || res.success === false) { return res || { success: false }; }
            var url = URL.createObjectURL(res.blob), a = document.createElement('a');
            a.href = url; a.download = res.filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 250);
            return { success: true, filename: res.filename };
        });
    }
    function mySignature() { return LogbookEndorsementsService.GetMySignature(); }
    function signDirect(body) { return LogbookEndorsementsService.SignDirect(body); }
}


// ═══════════════════════════════════════════════════════════════════════
// The hub: Club forms · To sign · Head of Training (+ deputies)
// ═══════════════════════════════════════════════════════════════════════
app.controller('CfmHubV2Controller', CfmHubV2Controller);
CfmHubV2Controller.$inject = ['$scope', '$state', '$stateParams', '$timeout', '$document', '$q', 'InsCore', 'CfmV2Data', 'ToastService'];
function CfmHubV2Controller($scope, $state, $stateParams, $timeout, $document, $q, InsCore, D, ToastService) {
    var vm = this, me = InsCore.myId(), seq = 0, seen = {}, people = {};
    var FILT = [['', 'All'], ['draft', 'Draft'], ['awaiting_signatures', 'Waiting for signatures'], ['awaiting_hot', 'With the Head of Training'], ['completed', 'Completed'], ['declined', 'Declined']];

    vm.D = D;
    vm.load = 'loading';            // loading | ready | error | noclubs
    vm.tab = ['forms', 'queue', 'hot'].indexOf($stateParams.tab) > -1 ? $stateParams.tab : 'forms';
    vm.clubs = [];
    vm.club = null;
    vm.forms = [];
    vm.queue = { mine: [], open: [] };
    vm.hotRows = [];
    vm.roles = null;
    vm.isHot = false;
    vm.isInstructor = false;
    vm.canCreate = false;
    vm.tabs = [{ key: 'forms', icon: 'fa-folder-open', label: 'Club forms', n: null }, { key: 'queue', icon: 'fa-file-signature', label: 'To sign', n: null }];
    vm.f = { st: '', mine: false, q: '' };
    vm.limit = 40;
    vm.items = [];
    vm.chips = [];
    vm.mineN = 0;
    vm.shown = 0;
    vm.matched = 0;
    vm.open = null;
    // Head of Training and deputies
    vm.deps = null;
    vm.rmDep = null;
    vm.newDep = null;
    vm.depValue = null;
    vm.depErr = null;
    vm.depBusy = false;
    vm.depQ = '';
    vm.instructors = null;

    vm.clubTitle = clubTitle;
    vm.setTab = setTab;
    vm.setClub = setClub;
    vm.toggle = function (it) { vm.open = vm.open === it.key ? null : it.key; };
    vm.setSt = function (v) { vm.f.st = v; vm.limit = 40; vm.open = null; build(); };
    vm.setMine = function () { vm.f.mine = !vm.f.mine; vm.limit = 40; build(); };
    vm.onQ = function () { vm.limit = 40; build(); };
    vm.clearFilters = function () { vm.f = { st: '', mine: false, q: '' }; vm.limit = 40; build(); };
    vm.more = function () { vm.limit += 40; build(); };
    vm.reload = loadClub;
    vm.openForm = function (f, ev) { if (ev) { ev.stopPropagation(); } $state.go('dashboard.caa_form', { id: f.id }); };
    // straight to the v2 state (its v1 name works too, but the v1 → v2 hop reloaded this page's data on the way out)
    vm.newForm = function () { $state.go('dashboard.v2.instructor_caa_forms_new', { club_id: vm.club }); };
    vm.pdf = pdf;
    /* the row's Review and sign / PDF are spans inside the row's button (as the design draws them): Enter / Space work them */
    vm.keyOpen = function (ev, f) { if (ev.keyCode === 13 || ev.keyCode === 32) { ev.preventDefault(); ev.stopPropagation(); vm.openForm(f); } };
    vm.keyPdf = function (ev, f) { if (ev.keyCode === 13 || ev.keyCode === 32) { ev.preventDefault(); ev.stopPropagation(); pdf(f); } };
    vm.depSource = depSource;
    vm.depPick = function (key, row) { vm.newDep = { user_id: +key, name: row.t }; vm.depValue = { av: row.av, name: row.t }; vm.depErr = null; };
    vm.depClear = function () { vm.newDep = null; vm.depValue = null; };
    vm.addDep = addDep;
    vm.askRemove = function (d) { vm.rmDep = d.id; };
    vm.keepDep = function () { vm.rmDep = null; };
    vm.removeDep = removeDep;

    function clubTitle(id) { var c = vm.clubs.filter(function (x) { return x.id === +id; })[0]; return c ? c.title : 'this club'; }
    /* reloadOnSearch:false on the state: only the URL changes (v1's notify:false left ui-router's state stale, so the next
       navigation re-ran this page's reads on its way out) */
    function syncUrl() { $state.go('.', { club_id: vm.club, tab: vm.tab }, { location: 'replace' }); }

    function setTab(t) {
        if (vm.tab === t) { return; }
        vm.tab = t; vm.open = null; vm.rmDep = null;
        syncUrl(); build();
    }
    function setClub(id) {
        id = +id;
        if (vm.club === id) { return; }
        vm.club = id; D.rememberClub(id);
        vm.open = null; vm.f = { st: '', mine: false, q: '' }; vm.limit = 40;
        syncUrl(); loadClub();
    }

    // ── load ──
    D.clubs().then(function (list) {
        vm.clubs = list;
        if (!list.length) { vm.load = 'noclubs'; return; }
        var want = $stateParams.club_id || D.savedClub(), pick = list.filter(function (c) { return String(c.id) === String(want); })[0] || list[0];
        vm.club = pick.id;
        D.rememberClub(pick.id);
        loadClub();
    });

    function loadClub() {
        var s = ++seq, club = vm.club;
        vm.load = 'loading';
        vm.tabs.forEach(function (t) { t.n = null; });
        vm.deps = null; vm.rmDep = null; vm.newDep = null; vm.depValue = null; vm.depErr = null; vm.instructors = null;
        $q.all([D.hub(club), D.instructors(club)]).then(function (r) {
            if (s !== seq) { return; }
            var res = r[0], ins = r[1] || [];
            if (!res.ok) { vm.load = 'error'; vm.err = (res.error && res.error.message) || null; return; }
            people = {};
            ins.forEach(function (i) { people[i.user_id] = i; });
            vm.instructors = ins;
            vm.roles = res.roles;
            vm.queueFailed = !!res.queueFailed;
            vm.isHot = !!res.isHot;
            vm.isInstructor = res.roles ? !!res.roles.is_instructor : InsCore.isInstructorAt(club);
            // New form: roles.can_create (C35); an API without it → v1's gate (an instructor, or the HoT / a deputy / a manager)
            vm.canCreate = res.roles ? (res.roles.can_create !== undefined ? !!res.roles.can_create : (!!res.roles.is_instructor || !!res.roles.is_hot)) : true;
            var ctx = { me: me, isHot: vm.isHot, isInstructor: vm.isInstructor, clubTitle: clubTitle, person: function (id) { return people[+id] || null; } };
            var byId = {};
            vm.forms = res.forms.map(function (f) { byId[f.id] = f; return D.decorate(f, ctx); });
            var mine = [], open = [], dup = {};
            res.queue.forEach(function (q) {
                var k = q.id + ':' + q.role; if (dup[k]) { return; } dup[k] = 1;
                var base = angular.copy(byId[q.id] || q);
                base._qrole = q.role; base._qopen = !!q.open_to_any;
                D.decorate(base, ctx);
                base._qkey = k;
                (base._qopen ? open : mine).push(base);
            });
            vm.queue = { mine: mine.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }), open: open };
            vm.hotRows = (res.hot || []).map(function (f) { return D.decorate(f, ctx); }).sort(function (a, b) { return a.updated_at < b.updated_at ? -1 : 1; });
            vm.mineN = vm.forms.filter(function (f) { return f._byMe; }).length;
            vm.tabs = [{ key: 'forms', icon: 'fa-folder-open', label: 'Club forms', n: vm.forms.length },
                { key: 'queue', icon: 'fa-file-signature', label: 'To sign', n: mine.length + open.length }];
            if (vm.isHot) { vm.tabs.push({ key: 'hot', icon: 'fa-user-shield', label: 'Head of Training', n: vm.hotRows.length }); }
            if (vm.tab === 'hot' && !vm.isHot) { vm.tab = 'forms'; syncUrl(); }
            seen = {};
            vm.load = 'ready';
            build();
            if (vm.isHot) { loadDeps(club, s); }
        });
    }
    function loadDeps(club, s) {
        D.deputies(club).then(function (d) {
            if (s !== seq) { return; }
            if (!d.ok) { vm.deps = { failed: true }; return; }   // the list is a nicety (as v1): the queue still works
            var canManage = d.canManage !== undefined ? !!d.canManage : !!(vm.roles && vm.roles.can_manage_deputies);
            vm.deps = { hot: d.hot ? depRow(d.hot) : null, list: d.list.map(depRow), canManage: canManage, history: d.history };
        });
    }
    /* a person on the deputies card: avatar (initials in their colour when they're an instructor here) */
    function depRow(p) {
        var i = people[+p.user_id] || null, lapsed = p.live === false || p.is_instructor === false;
        return angular.extend({}, p, { _ini: D.initials(p.name), _colour: i ? i.colour : null, _ins: !!i || p.is_instructor === true, _you: +p.user_id === me, _lapsed: lapsed });
    }

    // ── the list: flat items (a group header or a form row) so the rows stay siblings, as the design's markup ──
    function build() {
        var items = [], fresh = 0, mode = vm.tab;
        function row(f, key) {
            var k = mode + ':' + key;
            items.push({ key: k, f: f, i: seen[k] ? 0 : Math.min(fresh++, 7) });
            seen[k] = 1;
        }
        function grp(key, label, icon, n, attn) { var k = mode + ':g:' + key; items.push({ key: k, g: true, label: label, icon: icon, n: n, attn: !!attn, i: seen[k] ? 0 : Math.min(fresh++, 7) }); seen[k] = 1; }
        if (mode === 'forms') {
            var all = vm.forms, q = (vm.f.q || '').trim().toLowerCase();
            vm.chips = FILT.map(function (c) {
                var n = c[0] ? all.filter(function (f) { return f.status === c[0]; }).length : all.length;
                return { v: c[0], label: c[1], n: n, show: !!n || !c[0] || vm.f.st === c[0], attn: c[0] === 'declined' };
            }).filter(function (c) { return c.show; });
            var list = all.filter(function (f) {
                if (vm.f.st && f.status !== vm.f.st) { return false; }
                if (vm.f.mine && !f._byMe) { return false; }
                return !q || f._hay.indexOf(q) > -1;
            });
            var order = function (a, b) { return (a.updated_at || '') < (b.updated_at || '') ? 1 : -1; };
            var groups = [['declined', 'Declined — to correct', 'fa-times-circle', list.filter(function (f) { return f.status === 'declined'; }), true],
                ['progress', 'In progress', 'fa-hourglass-half', list.filter(function (f) { return f.status === 'draft' || f.status === 'awaiting_signatures' || f.status === 'awaiting_hot'; })],
                ['completed', 'Completed', 'fa-check', list.filter(function (f) { return f.status === 'completed'; })]];
            var shown = 0;
            groups.forEach(function (g) {
                if (!g[3].length || shown >= vm.limit) { return; }
                var rows = g[3].sort(order).slice(0, vm.limit - shown);
                shown += rows.length;
                grp(g[0], g[1], g[2], g[3].length, g[4]);
                rows.forEach(function (f) { row(f, f.id); });
            });
            vm.shown = shown;
            vm.matched = list.length;
        } else if (mode === 'queue') {
            if (vm.queue.mine.length) { grp('mine', 'Needs your signature · oldest first', 'fa-pen-nib', vm.queue.mine.length, true); vm.queue.mine.forEach(function (f) { row(f, f._qkey); }); }
            if (vm.queue.open.length) { grp('open', 'Open to any instructor', 'fa-users', vm.queue.open.length); vm.queue.open.forEach(function (f) { row(f, f._qkey); }); }
        } else if (vm.hotRows.length) {
            grp('hot', 'Waiting for your countersignature', 'fa-stamp', vm.hotRows.length, true);
            vm.hotRows.forEach(function (f) { row(f, f.id); });
        }
        vm.items = items;
    }

    function pdf(f, ev) {
        if (ev) { ev.stopPropagation(); }
        if (f._pdf) { return; }
        f._pdf = true;
        D.pdf(f).then(function (res) {
            f._pdf = false;
            if (!res || res.success === false) { ToastService.error('PDF unavailable', (res && res.message) || 'The PDF could not be made. Please try again.'); }
        });
    }

    // ── the deputy picker (D18: deputies are the club's live instructors, so it searches them) ──
    function depSource(q) {
        q = String(q || '').trim();
        if (!vm.instructors) { return { groups: [], busy: 'Loading the club’s instructors…' }; }
        var taken = {}, all = vm.instructors;
        if (vm.deps && vm.deps.hot) { taken[vm.deps.hot.user_id] = 1; }
        ((vm.deps && vm.deps.list) || []).forEach(function (d) { taken[d.user_id] = 1; });
        // an instructor: the initials circle in their colour (the app-wide rule: initials = instructor)
        function rowOf(i) { return { key: String(i.user_id), t: i.name, s: 'Instructor', av: { code: D.initials(i.name), colour: i.colour || null, title: i.name + ' (instructor)' }, i: i }; }
        if (!q) {
            var hint = { hint: 'Type a name to search all ' + D.plural(all.length, 'instructor') + ' at ' + clubTitle(vm.club) };
            /* C35 appointment_history (most often first, then most recent): the past deputies who are live instructors here now,
               as the design's "often appointed"; with none, the instructors not yet appointed, A–Z. Never both under one label. */
            var past = ((vm.deps && vm.deps.history) || []).filter(function (h) {
                return !h.current && people[+h.user_id] && +h.user_id !== me && !(vm.deps.hot && +vm.deps.hot.user_id === +h.user_id);
            }).slice(0, 4).map(function (h) { return people[+h.user_id]; });
            if (past.length) { return { groups: [{ label: 'Instructors at ' + clubTitle(vm.club), right: 'often appointed', rows: past.map(rowOf) }, hint] }; }
            var free = all.filter(function (i) { return !taken[i.user_id] && i.user_id !== me; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
            return { groups: [{ label: 'Instructors at ' + clubTitle(vm.club), right: free.length > 4 ? 'not yet appointed' : '', rows: free.slice(0, 4).map(rowOf) }, hint] };
        }
        var hits = all.map(function (i) { return { i: i, s: D.mScore(i, q) }; }).filter(function (x) { return x.s; })
            .sort(function (a, b) { return b.s - a.s || (a.i.last_name < b.i.last_name ? -1 : 1); });
        var out = { groups: [{ label: 'Instructors', right: D.plural(hits.length, 'match', 'matches'), rows: hits.slice(0, 40).map(function (x) { return rowOf(x.i); }) }],
            empty: { t: 'Nobody matches “' + q + '”', s: 'Deputies are the club’s instructors. Try a first name or a surname.' } };
        if (hits.length > 40) { out.groups.push({ hint: (hits.length - 40) + ' more — keep typing to narrow it down' }); }
        return out;
    }
    function addDep() {
        if (vm.depBusy) { return; }
        var d = vm.newDep, deps = vm.deps || {};
        if (!d) { vm.depErr = 'Choose who to appoint as deputy Head of Training'; return; }
        if ((deps.hot && +deps.hot.user_id === d.user_id) || (deps.list || []).some(function (x) { return +x.user_id === d.user_id; })) { vm.depErr = d.name + ' can already countersign here'; return; }
        vm.depBusy = true; vm.depErr = null;
        var club = vm.club, s = seq;
        D.addDeputy(club, d.user_id).then(function (res) {
            vm.depBusy = false;
            if (!res || res.success === false) {
                ToastService.error('Not appointed', (res && res.message) || 'Please try again.');
                return;
            }
            ToastService.success('Deputy appointed', d.name + ' can now countersign in your place', { confetti: false });
            vm.newDep = null; vm.depValue = null;
            D.deputies(club).then(function (r) {
                if (s !== seq || !r.ok || !vm.deps) { return; }
                var before = {}; (vm.deps.list || []).forEach(function (x) { before[x.id] = 1; });
                vm.deps.list = r.list.map(function (x) { var row = depRow(x); row._new = !before[x.id]; return row; });
                if (r.hot) { vm.deps.hot = depRow(r.hot); }
            });
        });
    }
    function removeDep(d) {
        if (d._busy) { return; }
        d._busy = true;
        D.removeDeputy(d.id).then(function (res) {
            d._busy = false;
            if (!res || res.success === false) {
                ToastService.error('Not removed', (res && res.message) || 'Please try again.');
                return;
            }
            vm.rmDep = null;
            d._leaving = true;   // fade and collapse, then the toast
            $timeout(function () {
                if (vm.deps && vm.deps.list) { vm.deps.list = vm.deps.list.filter(function (x) { return x.id !== d.id; }); }
                ToastService.success('Deputy removed', d.name + ' can no longer countersign here', { confetti: false });
            }, 210);
        });
    }

    // Esc: the remove confirmation, then the opened row (the pickers handle their own Esc)
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented) { return; }
        if (vm.rmDep) { $scope.$apply(function () { vm.rmDep = null; }); return; }
        if (vm.open) { $scope.$apply(function () { vm.open = null; }); }
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });
}


// ═══════════════════════════════════════════════════════════════════════
// New form: Form → Member → Review (prefill, the revalidation check, the course, the boxes) → Create the draft
// ═══════════════════════════════════════════════════════════════════════
app.controller('CfmNewV2Controller', CfmNewV2Controller);
CfmNewV2Controller.$inject = ['$scope', '$state', '$stateParams', '$timeout', '$window', 'InsCore', 'CfmV2Data', 'ToastService'];
function CfmNewV2Controller($scope, $state, $stateParams, $timeout, $window, InsCore, D, ToastService) {
    var vm = this, me = InsCore.myId(), mq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var searches = {}, searchTimer = null;

    vm.D = D;
    vm.load = 'loading';            // loading | ready | error | noclubs
    vm.clubs = [];
    vm.club = null;
    vm.types = [];
    vm.tq = '';
    vm.typeItems = [];
    vm.typeN = 0;
    vm.phone = !!(mq && mq.matches);
    vm.names = ['Form', 'Member', 'Review'];
    vm.w = { step: 1, type: null, ty: null, subject: null };
    vm.recent = [];
    vm.mQ = '';
    vm.mVer = 0;
    vm.memberCount = null;     // the club's live members (C39 clubs[].member_count), for the picker's words
    vm.e = null;               // the revalidation check (vm.w.elig), decorated

    vm.clubTitle = function (id) { var c = vm.clubs.filter(function (x) { return x.id === +id; })[0]; return c ? c.title : 'this club'; };
    vm.setClub = setClub;
    vm.filterTypes = buildTypes;
    vm.pickType = pickType;
    vm.wStep = function (n) { vm.w.step = n; vm.w.err = null; };
    vm.back = back;
    vm.toReview = toReview;
    vm.memberSource = memberSource;
    vm.memberPick = function (key, row) { vm.w.subject = row.m; vm.w.err = null; };
    vm.changeMember = function () { vm.w.subject = null; vm.mQ = ''; $timeout(function () { var el = document.getElementById('cb-member'); if (el) { el.focus(); } }, 60); };
    vm.hasBar = function () { return vm.w.step === 2 || (vm.w.step === 3 && !!vm.w.pre && vm.w.busy !== 'prefill'); };
    vm.firstName = function () { return vm.w.subject ? vm.w.subject.first_name || D.firstName(vm.w.subject.name) : ''; };

    // review
    vm.isPre = function (k) { var w = vm.w, v = w.fields && w.fields[k]; return !!(w.src && w.src[k]) && v !== '' && v !== null && v !== undefined && v !== false; };
    vm.srcOf = function (k) { return vm.w.src ? D.srcWord(vm.w.src[k]) : ''; };
    /* the hours hint: strings / booleans only (an ng-if or ng-class on a fresh object each digest never settles) */
    vm.calcText = function (k) { var c = calc(k); return c ? c.t : ''; };
    vm.calcBad = function (k) { var c = calc(k); return !!(c && c.bad); };
    vm.fld = function (k) { vm.w.dirty = true; if (vm.w.ferr) { delete vm.w.ferr[k]; } };
    vm.course = pickCourse;
    vm.courseYes = function () { var c = vm.w.pendingCourse; vm.w.pendingCourse = null; loadCourse(c); };
    vm.courseNo = function () { vm.w.pendingCourse = null; };
    vm.recalc = recalc;
    vm.copyFig = copyFig;
    vm.copyDate = copyDate;
    vm.endorse = function (c) { vm.w.endorse = c; };
    vm.endorseClose = function () { vm.w.endorse = null; };
    vm.endorsed = endorsed;
    vm.canEndorse = canEndorse;
    vm.openRecords = function () { $state.go('dashboard.manage_user.student_records', { club_id: vm.club, student_id: vm.w.subject.user_id, course_id: vm.w.course }); };
    vm.create = create;
    vm.tagN = function () { var t = vm.w.ch && vm.w.ch.tag_hours; return t && typeof t === 'object' ? Object.keys(t).length : 0; };
    vm.isHoursCheck = function (c) { return !/landing|take/i.test(c.id || ''); };

    if (mq) {
        var onMq = function () { $scope.$evalAsync(function () { vm.phone = mq.matches; }); };
        if (mq.addEventListener) { mq.addEventListener('change', onMq); } else if (mq.addListener) { mq.addListener(onMq); }
        $scope.$on('$destroy', function () { if (mq.removeEventListener) { mq.removeEventListener('change', onMq); } else if (mq.removeListener) { mq.removeListener(onMq); } });
    }

    // ── load: the clubs, then the form types ──
    D.clubs().then(function (list) {
        vm.clubs = list;
        if (!list.length) { vm.load = 'noclubs'; return; }
        var want = $stateParams.club_id || D.savedClub(), pick = list.filter(function (c) { return String(c.id) === String(want); })[0] || list[0];
        vm.club = pick.id;
        D.rememberClub(pick.id);
        D.recentStudents(vm.club).then(function (r) { vm.recent = r.rows; vm.memberCount = r.count; });
        D.types().then(function (r) {
            if (!r.ok) { vm.load = 'error'; vm.err = (r.error && r.error.message) || null; return; }
            vm.types = r.list;
            vm.load = 'ready';
            buildTypes();
        });
    });

    function setClub(id) {
        id = +id;
        if (vm.club === id) { return; }
        vm.club = id; D.rememberClub(id);
        vm.w.subject = null; vm.recent = []; vm.memberCount = null; searches = {};
        $state.go('.', { club_id: id }, { location: 'replace' });
        D.recentStudents(id).then(function (r) { if (vm.club === id) { vm.recent = r.rows; vm.memberCount = r.count; } });
    }

    // ── step 1: which form ──
    function buildTypes() {
        var q = (vm.tq || '').trim().toLowerCase(), items = [], n = 0, cats = D.CAT_ORDER.slice();
        vm.types.forEach(function (t) { if (cats.indexOf(t.category) < 0) { cats.push(t.category); } });
        cats.forEach(function (c) {
            var cat = D.catOf(c);
            var ts = vm.types.filter(function (t) { return t.category === c && (!q || (t.short + ' ' + t.code + ' ' + t.title + ' ' + cat.label).toLowerCase().indexOf(q) > -1); });
            if (!ts.length) { return; }
            n += ts.length;
            items.push({ key: 'g:' + c, g: true, label: cat.label, icon: cat.icon, n: ts.length });
            ts.forEach(function (t) { items.push({ key: t.form_type, t: t }); });
        });
        vm.typeItems = items;
        vm.typeN = n;
    }
    function pickType(t) { vm.w.type = t.form_type; vm.w.ty = t; vm.w.step = 2; vm.w.err = null; vm.w.pre = null; }

    function back() {
        if (vm.w.busy === 'create') { return; }
        if (vm.w.step > 1) { vm.w.step--; vm.w.err = null; return; }
        $state.go('dashboard.v2.instructor_caa_forms', { club_id: vm.club });
    }

    // ── step 2: who it's for (the member picker: your recent students, then every member by name or e-mail) ──
    function memberSource(q) {
        q = String(q || '').trim();
        var club = vm.clubTitle(vm.club), groups = [];
        // a member: the grey person icon
        function rowOf(m, right) { return { key: String(m.user_id), t: m.name, s: m.email || m.sub || 'Member of ' + club, av: { member: true, title: m.name }, r: right ? ' ' : '', rs: right || '', m: m }; }
        if (q.length < 2) {
            var recent = vm.recent.filter(function (m) { return D.mScore(m, q); });
            if (recent.length) { groups.push({ label: 'Your recent students', right: 'flew with you lately', rows: recent.map(function (m) { return rowOf(m, m.last ? 'flew ' + D.fDay(m.last) : ''); }) }); }
            var all = vm.memberCount ? 'all ' + D.plural(vm.memberCount, 'member') + ' of ' + club : 'the members of ' + club;
            groups.push({ hint: q ? 'Type one more letter to search ' + all : 'Type a name or email to search ' + all });
            return { groups: groups };
        }
        var key = q.toLowerCase(), hit = searches[key];
        if (!hit) {
            if (searchTimer) { $timeout.cancel(searchTimer); }
            searchTimer = $timeout(function () { runSearch(q, key); }, 220);
            return { groups: [], busy: 'Searching…' };
        }
        if (hit.busy) { return { groups: [], busy: 'Searching…' }; }
        if (!hit.ok) { return { groups: [], empty: { t: 'The search didn’t work', s: 'Check your connection and type again.' } }; }
        var rows = hit.rows.map(function (m) { return { m: m, s: D.mScore(m, q) }; })
            .sort(function (a, b) { return b.s - a.s || (a.m.last_name < b.m.last_name ? -1 : a.m.last_name > b.m.last_name ? 1 : 0); });
        groups.push({ label: 'Members', right: (hit.rows.length >= 50 ? '50+ matches' : D.plural(hit.rows.length, 'match', 'matches')), rows: rows.map(function (x) { return rowOf(x.m); }) });
        var out = { groups: groups, empty: { t: 'Nobody matches “' + q + '”', s: 'Try a first name, a surname or an email address.' } };
        if (hit.rows.length >= 50) { groups.push({ hint: 'More than 50 — keep typing to narrow it down' }); }
        return out;
    }
    function runSearch(q, key) {
        var club = vm.club;
        searches[key] = { busy: true };
        D.searchMembers(club, q).then(function (r) {
            if (club !== vm.club) { return; }
            searches[key] = r;
            vm.mVer++;
        });
    }
    function toReview() {
        if (!vm.w.subject) { vm.w.err = 'Choose who this form is for'; return; }
        startReview();
    }

    // ── step 3: review ──
    function startReview() {
        var w = vm.w;
        w.step = 3; w.course = null; w.pendingCourse = null; w.manual = null; w.mErr = null; w.flts = false; w.alt = false; w.uncl = false;
        w.ferr = null; w.dirty = false; w.pre = null; w.courses = []; w.busy = 'prefill'; vm.e = null;
        var s = w.seq = (w.seq || 0) + 1;
        D.prefill(w.type, w.subject.user_id, vm.club).then(function (d) {
            if (s !== w.seq) { return; }
            w.busy = null;
            if (!d || d.success === false) {
                ToastService.error('Couldn’t fill the form in', (d && d.message) || 'Could not load ' + vm.firstName() + '’s details.');
                w.step = 2;
                return;
            }
            apply(d);
            w.courses = D.sortCourses((d.context && d.context.courses) || []);
        });
    }
    function apply(d) {
        var w = vm.w, ty = D.typeOf(w.type), f = d.fields || {}, src = angular.copy(d.sources || {});
        w.pre = d;
        w.elig = d.eligibility || null;
        w.ch = (d.context && d.context.course_hours) || null;
        w.src = src;
        w.groups = D.layout(w.type);
        var fields = {};
        w.groups.forEach(function (g) {
            g.fields.forEach(function (def) {
                var v = f[def.key];
                if (def.type === 'bool') { fields[def.key] = !!v && v !== '0' && v !== 'false'; }
                else { fields[def.key] = v === null || v === undefined ? '' : String(v); }
                if (def.type === 'select' && fields[def.key] && (def.options || []).indexOf(fields[def.key]) < 0) { def.options = [fields[def.key]].concat(def.options || []); }
            });
        });
        // a club course certificate: Course hours defaults to the chosen course's total (C35: decimal hours)
        if (w.ch && fields.course_hours === '' && w.ch.total_hours !== undefined && w.ch.total_hours !== null) {
            fields.course_hours = String(w.ch.total_hours);
            if (!src.course_hours) { src.course_hours = 'training_records'; }
        }
        w.fields = fields;
        w.noRef = fields.caa_reference_number === '';
        w.prefKeys = Object.keys(f);
        w.nPre = Object.keys(src).filter(function (k) { return fields[k] !== undefined && fields[k] !== '' && fields[k] !== false; }).length;
        w.isCert = ty.family === 'caa_certificate' || ty.family === 'certificate';
        w.tagWarn = null;
        if (w.ch && w.type === 'caa5017' && src.total_flight_hours === 'training_records') { w.tagWarn = 'night'; }
        if (w.ch && w.type === 'caa5019' && (f.instrument_hours === null || f.instrument_hours === undefined || f.instrument_hours === '')) { w.tagWarn = 'instrument'; }
        decorateElig();
    }
    /* the revalidation check, in the card's words (worked out once per answer) */
    function decorateElig() {
        var w = vm.w, e = w.elig;
        vm.e = e || null;
        if (!e) { return; }
        e._wins = [];
        /* C35: from_club / from_manual split each window; a line only when the pilot's own entries count */
        function win(label, x) {
            var m = x.from_manual || null, c = x.from_club || null;
            return { label: label, w: x, mix: m && +m.total > 0 ? (c ? D.hm(c.total) + ' from club flights · ' : '') + D.hm(m.total) + ' from the pilot’s own entries' + (+m.pic > 0 ? ' (' + D.hm(m.pic) + ' PIC)' : '') : '' };
        }
        if (e.windows && e.windows['12m']) { e._wins.push(win('Last 12 months', e.windows['12m'])); }
        if (e.windows && e.windows['24m']) { e._wins.push(win('Validity period (24 months)', e.windows['24m'])); }
        e._checks = e.checks || [];
        var tf = e._checks.filter(function (c) { return c.id === 'training_flight'; })[0] || null;
        e._tf = tf;
        var ev = tf && tf.evidence ? (angular.isArray(tf.evidence) ? tf.evidence : [tf.evidence]) : [];
        e._evidence = tf && tf.pass ? ev.filter(Boolean) : [];
        var raw = tf && !tf.pass ? (tf.candidates || []) : [];
        var hasIds = raw.some(function (c) { return c.instructor_id !== undefined; });
        e._cands = hasIds ? raw.filter(function (c) { return +c.instructor_id === me; }) : raw;
        e._colleagueOnly = raw.length > 0 && !e._cands.length;
        e._excluded = ((tf && tf.excluded_evidence) || []).map(function (x) { return angular.extend({}, x, { _why: D.lowerFirst(String(x.reason_text || 'it no longer counts').replace(/\.$/, '')) }); });
        var cf = e.class_filter || null;
        e._cf = cf && (cf.excluded_flights > 0 || (cf.combined && cf.combined.length > 1)) ? cf : null;
        if (e._cf) {
            e._cf._by = (cf.excluded_by_class || []).map(function (b) { return b.class + ' ' + b.flights + ' (' + D.hm(b.hours) + ')'; }).join(' · ');
            e._cf._classes = (cf.counted_classes || []).join(' and ');
        }
        e._anchor = e.anchor_source === 'manual' ? 'manual' : e.window_anchor === 'today' ? 'today' : 'rating';
        e._noRating = e.has_rating === false && e.anchor_source !== 'manual';
    }
    function calc(k) {
        var v = vm.w.fields[k];
        if (v === '' || v === null || v === undefined) { return null; }
        var d = D.parseHours(v);
        if (d === null) { return { bad: true, t: 'Not a time — enter e.g. 61.5 or 61:30' }; }
        return { bad: false, t: '= ' + D.hm(d) + (/[:h]/i.test(String(v)) ? ' · prints as ' + d : '') };
    }
    function pickCourse(c) {
        var w = vm.w;
        if (w.busy === 'course' || w.course === c.id) { return; }
        if (w.dirty) { w.pendingCourse = c; return; }
        loadCourse(c);
    }
    function loadCourse(c) {
        var w = vm.w, s = w.seq;
        w.busy = 'course';
        D.prefill(w.type, w.subject.user_id, vm.club, c.id).then(function (d) {
            if (s !== w.seq) { return; }
            w.busy = null;
            if (!d || d.success === false) { ToastService.error('Couldn’t work the course out', (d && d.message) || 'Please try again.'); return; }
            apply(d);
            w.dirty = false;
            if (w.ch) { w.course = c.id; }
            else { w.course = null; ToastService.warning('No course figures', 'That course has no usable records — fill the hours in by hand.'); }
        });
    }
    function recalc() {
        var w = vm.w;
        if (w.busy === 'recalc') { return; }
        if (!w.manual) { w.mErr = 'Enter the rating’s expiry date to recalculate against it'; return; }
        w.mErr = null; w.busy = 'recalc';
        var s = w.seq, manual = w.manual;
        D.prefill(w.type, w.subject.user_id, vm.club, null, manual).then(function (d) {
            if (s !== w.seq) { return; }
            w.busy = null;
            if (!d || d.success === false) { ToastService.error('Couldn’t recalculate', (d && d.message) || 'Please try again.'); return; }
            var e = d.eligibility;
            if (!e || !e.checks || !e.checks.length) { ToastService.warning('Not recalculated', 'The server didn’t work it out against that date. Fill the form in by hand.'); return; }
            w.elig = e; decorateElig();
            if (e.expiry_date) { w.fields.previous_expiry_date = e.expiry_date; }
            if (e.new_expiry_date) { w.fields.new_expiry_date = e.new_expiry_date; }
            w.dirty = true;
            ToastService.success('Recalculated', 'Against ' + D.fDate(manual) + '. The expiry dates are in the form; copy the hours in when you’re happy with them.', { confetti: false });
        });
    }
    function copyFig() {
        var w = vm.w, e = w.elig, wins = (e && e.windows) || {}, r = function (x) { return String(Math.round(parseFloat(x) * 100) / 100); };
        if (wins['24m']) { w.fields.total_hours_validity = r(wins['24m'].total); }
        if (wins['12m']) { w.fields.total_hours_12m = r(wins['12m'].total); w.fields.pic_hours_12m = r(wins['12m'].pic); }
        if (e.expiry_date) { w.fields.previous_expiry_date = e.expiry_date; if (e.new_expiry_date) { w.fields.new_expiry_date = e.new_expiry_date; } }
        w.dirty = true;
        ToastService.success('Figures copied', e._anchor === 'manual' ? 'Check them against the pilot’s logbook.' : 'Check them against the logbook; the window here is anchored to today.', { confetti: false });
    }
    function copyDate(date) {
        var w = vm.w, cur = String(w.fields.training_flight_dates || '').trim();
        if (cur.indexOf(date) > -1) { ToastService.warning('Already in the form', 'That date is already in the form.'); return; }
        w.fields.training_flight_dates = cur ? cur + ', ' + date : date;
        w.dirty = true;
        ToastService.success('Date added', 'The training flight date is in the form.', { confetti: false });
    }
    /* stamping says YOU flew the training: only club flights you instructed (or where nobody was recorded), never your own form */
    function canEndorse(c) {
        if (!c || !c.ref_id || (c.kind && c.kind !== 'club')) { return false; }
        if (c.instructor_id && +c.instructor_id !== me) { return false; }
        return !!vm.w.subject && +vm.w.subject.user_id !== me;
    }
    function endorsed() {
        var w = vm.w, s = w.seq, anchor = w.elig && w.elig._anchor === 'manual' ? w.elig.expiry_date : null;
        w.endorse = null;
        D.prefill(w.type, w.subject.user_id, vm.club, null, anchor).then(function (d) {
            if (s !== w.seq) { return; }
            var pass = false;
            if (d && d.success !== false && d.eligibility) { w.elig = d.eligibility; decorateElig(); pass = !!(w.elig._tf && w.elig._tf.pass); }
            ToastService.success('Flight endorsed', pass ? 'The training flight is now evidenced.' : 'One more short flight makes up the hour.', { confetti: false });
        });
    }
    function create() {
        var w = vm.w, err = {}, any = false;
        if (w.busy === 'create') { return; }
        w.groups.forEach(function (g) {
            g.fields.forEach(function (def) {
                var v = w.fields[def.key];
                if (def.type === 'hours' && v !== '' && v !== null && v !== undefined && D.parseHours(v) === null) { err[def.key] = 'Not a time — enter e.g. 61.5 or 61:30'; any = true; }
            });
        });
        if (D.typeOf(w.type).family === 'caa_certificate' && !w.fields.certificate_for) { err.certificate_for = 'Choose one — it ticks the box on the printed form'; any = true; }
        if (any) {
            w.ferr = err;
            $timeout(function () { var el = document.querySelector('.ta-page .ta-field--error'); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30);
            return;
        }
        w.ferr = null;
        w.busy = 'create';
        D.create({ club_id: vm.club, form_type: w.type, subject_user_id: w.subject.user_id, form_data: serialize() }).then(function (d) {
            if (!d || d.success === false || !d.id) {
                w.busy = null;
                ToastService.error('Not created', (d && d.message) || 'The draft could not be created. Please try again.');
                return;
            }
            ToastService.success('Draft created', 'Check the details, then submit it for signatures.', { confetti: false });
            $state.go('dashboard.caa_form', { id: d.id });
        });
    }
    /* POST-ready: hours as decimals (61:30 → 61.5); an empty number or date is left out (the server refuses '' for those) */
    function serialize() {
        var w = vm.w, out = {}, had = {};
        (w.prefKeys || []).forEach(function (k) { had[k] = 1; });
        w.groups.forEach(function (g) {
            g.fields.forEach(function (def) {
                var k = def.key, v = w.fields[k];
                if (def.type === 'hours') { var d = D.parseHours(v); if (d !== null) { out[k] = d; } return; }
                if (def.type === 'date') { if (v) { out[k] = v; } return; }
                if (def.type === 'bool') { if (v || had[k]) { out[k] = !!v; } return; }
                if ((v !== '' && v !== null && v !== undefined) || had[k]) { out[k] = v === null || v === undefined ? '' : v; }
            });
        });
        return out;
    }
}


// ═══════════════════════════════════════════════════════════════════════
// <cfm-endorse-dialog cand="…" pilot="…" on-done="…()" on-close="…()">
// The training flight's logbook stamp (POST logbook_endorsements/sign, C34 / D16): your saved stamp, or draw one.
// The name always comes from your account; the number from your stamp, else what you type. Esc / scrim / × close it.
// ═══════════════════════════════════════════════════════════════════════
app.directive('cfmEndorseDialog', function () {
    return {
        restrict: 'E',
        scope: { cand: '=', pilot: '=', onDone: '&', onClose: '&' },
        templateUrl: 'views/v2/instructor_caa_forms/endorse_dialog.html',
        controller: 'CfmEndorseV2Controller',
        controllerAs: 'dx',
        bindToController: true
    };
});
app.controller('CfmEndorseV2Controller', CfmEndorseV2Controller);
CfmEndorseV2Controller.$inject = ['$scope', '$element', '$timeout', '$document', 'InsCore', 'CfmV2Data', 'ToastService'];
function CfmEndorseV2Controller($scope, $element, $timeout, $document, InsCore, D, ToastService) {
    var dx = this, user = InsCore.me(), saved = '';
    try { saved = localStorage.getItem('toaviate_instructor_number') || ''; } catch (e) { /* private window */ }
    dx.D = D;
    dx.FCL = D.FCL;
    dx.name = ((user.first_name || '') + ' ' + (user.last_name || '')).trim();
    dx.stamp = null;             // the saved stamp, when there is one
    dx.stampLoad = true;
    dx.form = { number: saved, sig: '' };
    dx.busy = false;
    dx.err = null;
    dx.pilotName = function () { var p = dx.pilot || {}; return p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim(); };
    dx.pilotFirst = function () { var p = dx.pilot || {}; return p.first_name || D.firstName(dx.pilotName()); };
    dx.number = function () { return (dx.stamp && dx.stamp.instructor_number) || dx.form.number; };

    D.mySignature().then(function (d) {
        dx.stampLoad = false;
        if (d && d.exists && d.signature) { dx.stamp = d.signature; }
    });

    dx.close = function () { if (!dx.busy) { dx.onClose(); } };
    dx.scrim = function (e) { if (e && e.target === e.currentTarget) { dx.close(); } };
    dx.go = function () {
        if (dx.busy || dx.stampLoad) { return; }
        if (!dx.stamp && !dx.form.sig) { dx.err = 'Sign in the box — it goes on the stamp.'; return; }
        dx.err = null;
        dx.busy = true;
        var body = { entity_type: 'club', entity_id: dx.cand.ref_id, pilot_user_id: dx.pilot.user_id, endorsement_text: D.FCL };
        if (dx.stamp) { body.use_saved_signature = true; } else { body.signature_image = dx.form.sig; }
        if (!dx.stamp || !dx.stamp.instructor_number) {
            body.instructor_number = String(dx.form.number || '').trim();
            try { localStorage.setItem('toaviate_instructor_number', body.instructor_number); } catch (e) { /* private window */ }
        }
        D.signDirect(body).then(function (res) {
            dx.busy = false;
            if (!res || res.success === false) {
                var code = res && res.error;
                var msg = code === 'NOT_YOUR_FLIGHT' ? 'You weren’t this flight’s instructor, so the stamp has to come from whoever flew it.'
                    : code === 'LINE_RETIRED' ? 'This flight was merged or released, so it can’t be stamped.'
                    : (res && typeof res.message === 'string' && res.message) || 'The flight wasn’t stamped. Please try again.';
                ToastService.error('Not endorsed', msg);
                return;
            }
            dx.onDone({ result: res });
        });
    };
    function onKey(e) { if (e.keyCode === 27) { $scope.$apply(dx.close); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });
    $timeout(function () { var el = $element[0].querySelector('.ta-dlg'); if (el) { el.focus(); } });
}
