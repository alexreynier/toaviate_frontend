// ─────────────────────────────────────────────────────────────────────────
// boPresolo — the pre-solo requirements panel of the book-out page
// (mockups/bookout-redesign.html vReqs(); backend contract
// BACKEND_PRE_SOLO_COURSE_REQUIREMENTS_GUIDE.md §4.3 / §4.5 / §6.3).
//
//   <bo-presolo club-id="vm.club_id" student-id="vm.student_id"
//               course-id="vm.course_id"            (optional — the booking's course)
//               flight-date="'2026-11-05'"          (optional — 'YYYY-MM-DD'; Date / moment also accepted)
//               booking-id="vm.booking_id" lesson-id="vm.lesson_id"   (the return trip)
//               mode="'intent'"                     ('intent' = may send solo · 'auth' = authorised solo)
//               on-status="vm.onPresoloStatus(status)"
//               before-leave="vm.saveDraft()"></bo-presolo>
//
// NB AngularJS here is 1.4.7: no one-way '<' bindings and no $onInit, so the
// inputs are '=' / '=?' (read-only — this directive never writes them) and
// everything starts from the $watchGroup below.
//
// Loads GET solo_requirements/status/{club}/{student}[/{course}]?date= on mount
// and whenever club / student / course / flight date change. After every load
// on-status receives the API object + `outstanding` (count of unmet rows).
// No requirements configured → the panel hides and on-status gets
// {requirements:[], all_satisfied:true, outstanding:0}. A failed load →
// {success:false, unavailable:true, requirements:[], all_satisfied:false,
// outstanding:0, message} and an inline "Try again" row.
//
// Row actions (staff = instructor / manager / super_admin of club-id; the
// server enforces every one of these too):
//   medical               View medical → read-only sheet (GET medicals/{club}?user_id=)
//                         + Open certificate (the member page's MedicalService.GetById
//                         decrypt call, incl. its password re-check on fail:'templogin')
//   questionnaire pending  Review now (staff) → before-leave(), sessionStorage bo_return,
//                         questionnaire_review for evidence.id
//   exam unmet            Enter result (staff) → before-leave(), bo_return, student record
//   manual unmet          Sign off now (staff) → inline sign-off, same-day by default
// ─────────────────────────────────────────────────────────────────────────
app.directive('boPresolo', ['SoloRequirementsService', 'MemberService', 'ToastService', '$rootScope', '$state', '$q', '$timeout', '$uibModal',
    function (SoloRequirementsService, MemberService, ToastService, $rootScope, $state, $q, $timeout, $uibModal) {

    var RETURN_KEY = 'bo_return';

    var TYPE_LABELS = {
        medical: 'Auto · medical',
        questionnaire: 'Auto · questionnaire',
        exam: 'Auto · exam',
        manual: 'Instructor sign-off'
    };

    // medical_limitation (C39 / D19): a medical with an OSL-type limitation fails the solo check — a safety rule shared with the backend
    var FAIL_STATES = ['medical_expired', 'medical_class_not_accepted', 'medical_limitation', 'below_min_score', 'not_passed', 'no_medical'];

    // ── date helpers (all dates are local calendar days, 'YYYY-MM-DD') ──
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function isoOf(value) {
        if (!value) { return null; }
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value.getFullYear() + '-' + pad2(value.getMonth() + 1) + '-' + pad2(value.getDate());
        }
        if (typeof moment !== 'undefined' && moment.isMoment(value)) {
            return value.isValid() ? value.format('YYYY-MM-DD') : null;
        }
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
        if (m) { return m[1] + '-' + m[2] + '-' + m[3]; }
        if (typeof moment !== 'undefined') {
            var mm = moment(value);
            if (mm.isValid()) { return mm.format('YYYY-MM-DD'); }
        }
        return null;
    }

    function todayIso() { return isoOf(new Date()); }

    function dateObj(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)) : null;
    }

    function addDays(iso, n) {
        var d = dateObj(iso);
        if (!d) { return null; }
        d.setDate(d.getDate() + n);
        return isoOf(d);
    }

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // '2027-01-04' → '4 Jan 2027'; withDay → 'Mon 4 Jan 2027'; noYear drops the year.
    function fmtDate(value, withDay, noYear) {
        var d = dateObj(isoOf(value));
        if (!d) { return ''; }
        return (withDay ? DAYS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()] + (noYear ? '' : ' ' + d.getFullYear());
    }

    function fmtPct(value) {
        var n = parseFloat(value);
        if (isNaN(n)) { return ''; }
        return (Math.round(n * 10) / 10) + '%';
    }

    // Services resolve { success:false, message: res.data } on HTTP errors, so
    // `message` can be a string, an object, an HTML error page or empty —
    // only a short plain sentence is worth showing.
    function readable(text) {
        return typeof text === 'string' && text && text.length <= 300 && text.indexOf('<') === -1 ? text : null;
    }
    function messageOf(data, fallback) {
        if (data) {
            var msg = readable(data.message) || (data.message ? readable(data.message.message) : null);
            if (msg) { return msg; }
            if (data.error === 'FORBIDDEN' || (data.message && data.message.error === 'FORBIDDEN')) { return 'Only the club\'s instructors and managers can do that.'; }
        }
        return fallback;
    }

    function initials(first, last) {
        return ((first ? String(first).charAt(0) : '') + (last ? String(last).charAt(0) : '')).toUpperCase() || '?';
    }

    // ── the read-only medical sheet ($uibModal; template views/directives/bookout_presolo_medical.html) ──
    var MedicalModalController = ['$uibModalInstance', 'ctx', 'MedicalService', 'AuthenticationService', 'ToastService',
        function ($uibModalInstance, ctx, MedicalService, AuthenticationService, ToastService) {
        var md = this;
        md.ctx = ctx;
        md.firstCap = ctx.student && ctx.student.first ? ctx.student.first.charAt(0).toUpperCase() + ctx.student.first.slice(1) : 'The student';
        md.loading = true;
        md.forbidden = false;
        md.error = null;
        md.medicals = [];
        md.cert = {};          // by user_medical id: { loading, images, error, reauth, password, reauthError }
        var certificateClass = null;   // medical_components id → is_certificate (date trackers have no expiry)

        md.close = function () { $uibModalInstance.dismiss('close'); };
        md.fmtDate = fmtDate;

        MedicalService.GetComponents().then(function (rows) {
            if (!angular.isArray(rows)) { return; }
            certificateClass = {};
            rows.forEach(function (c) { certificateClass[String(c.id)] = String(c.is_certificate) === '1'; });
            decorate();
        });

        MedicalService.GetByUserIdClub(ctx.studentId, ctx.clubId).then(function (data) {
            md.loading = false;
            if (data && data.success && angular.isArray(data.medicals)) {
                md.medicals = data.medicals;
                decorate();
                return;
            }
            if (data && (data.error === 'FORBIDDEN' || data.status === 403 || (data.message && data.message.error === 'FORBIDDEN'))) {
                md.forbidden = true;
                return;
            }
            md.error = messageOf(data, 'The medical records could not be loaded — please try again.');
        });

        function decorate() {
            var on = ctx.flightIso || todayIso();
            md.medicals.forEach(function (med) {
                med._verified = String(med.verified) === '1';
                med._checkedBy = med.checked_by_name || (med.checked_by && String(med.checked_by) === String(ctx.meId) ? 'you' : null);
                med._hasImages = angular.isArray(med.images) && med.images.length > 0;
                med._usedForPresolo = !!(ctx.evidence && String(ctx.evidence.user_medical_id) === String(med.id));
                (med.components || []).forEach(function (c) {
                    var tracker = certificateClass ? certificateClass[String(c.component_id)] === false : /^last\s/i.test(c.title || '');
                    var iso = isoOf(c.expiry_date);
                    c._tracker = tracker;
                    c._date = fmtDate(iso);
                    c._inDate = !tracker && !!iso && iso >= on;
                    c._expired = !tracker && !!iso && iso < on;
                    c._presolo = !!(ctx.evidence && med._usedForPresolo && String(ctx.evidence.component_id) === String(c.component_id));
                });
            });
        }

        // "Open certificate" — the same decrypting fetch the club member page's
        // openDocument('medicals', id) makes; a session older than 10 minutes gets
        // fail:'templogin' and must re-enter the password (AuthenticationService.Login3,
        // exactly as the member page does) before the images are released.
        md.openCertificate = function (med) {
            var c = md.cert[med.id] || (md.cert[med.id] = {});
            if (c.images && c.images.length) { c.open = !c.open; return; }
            c.loading = true;
            c.error = null;
            MedicalService.GetById(med.id, 0, 1).then(function (data) {
                c.loading = false;
                if (data && data.success && data.medical) {
                    c.images = data.medical.images || [];
                    c.open = true;
                    c.reauth = false;
                    if (!c.images.length) { c.error = 'No certificate image has been uploaded.'; }
                    return;
                }
                if (data && data.fail === 'templogin') {
                    c.reauth = true;
                    c.password = '';
                    c.reauthError = null;
                    return;
                }
                c.error = messageOf(data, 'You can\'t view this certificate.');
            });
        };

        md.confirmPassword = function (med) {
            var c = md.cert[med.id];
            if (!c || !c.password) { if (c) { c.reauthError = 'Enter your password.'; } return; }
            c.reauthError = null;
            AuthenticationService.Login3(c.password, randomToken(120), function (response) {
                if (response && response.success) {
                    c.password = '';
                    c.reauth = false;
                    md.openCertificate(med);
                } else {
                    c.reauthError = 'That password is not right — please try again.';
                    ToastService.error('Wrong password', 'Please try again.');
                }
            });
        };

        function randomToken(length) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', out = '';
            for (var i = 0; i < length; i++) { out += chars.charAt(Math.floor(Math.random() * chars.length)); }
            return out;
        }
    }];

    return {
        restrict: 'E',
        scope: {
            clubId: '=',
            studentId: '=',
            courseId: '=?',
            flightDate: '=?',
            bookingId: '=?',
            lessonId: '=?',
            mode: '=?',
            onStatus: '&',
            beforeLeave: '&'
        },
        templateUrl: 'views/directives/bookout_presolo.html',
        controllerAs: 'pv',
        bindToController: true,
        controller: ['$scope', '$element', function ($scope, $element) {
            var pv = this;
            var me = ($rootScope.globals && $rootScope.globals.currentUser) || {};
            var seq = 0;
            var lastSatisfied = {};     // requirement id → satisfied at the previous load (state-change pulse)
            var leaving = false;
            var watchedWho = null;      // club:student the rows belong to

            pv.loading = false;
            pv.loaded = false;
            pv.hidden = true;           // no requirements → render nothing
            pv.error = null;
            pv.status = null;
            pv.rows = [];
            pv.sign = null;             // the open inline sign-off form
            pv.justMet = {};
            pv.me = {
                id: me.id,
                name: ((me.first_name || '') + ' ' + (me.last_name || '')).replace(/^\s+|\s+$/g, '') || 'You',
                initials: initials(me.first_name, me.last_name)
            };
            pv.student = { first: 'the student', full: 'the student', self: false, poss: 'the student\'s' };
            pv.fmtDate = fmtDate;

            // ── who is looking ──
            function isStaff() {
                var access = me.access || {};
                var club = parseInt(pv.clubId, 10);
                if (!(club > 0)) { return false; }
                var lists = [access.instructor, access.manager, access.super_admin];
                for (var i = 0; i < lists.length; i++) {
                    if (angular.isArray(lists[i]) && (lists[i].indexOf(club) > -1 || lists[i].indexOf(String(club)) > -1)) { return true; }
                }
                return false;
            }

            function flightIso() { return isoOf(pv.flightDate); }

            pv.isIntent = function () { return pv.mode !== 'auth'; };

            // The student's name for the sentences ("Sam needs to complete it").
            // The viewer themselves → their own name; staff → the club's member
            // lookup (instructors/managers only); otherwise a neutral wording.
            var nameFor = null;
            function resolveStudent() {
                var key = pv.clubId + ':' + pv.studentId;
                if (nameFor === key) { return; }
                nameFor = key;
                if (me.id && String(pv.studentId) === String(me.id)) {
                    pv.student = { first: me.first_name || 'You', full: pv.me.name, self: true, poss: 'your' };
                    return;
                }
                pv.student = { first: 'the student', full: 'the student', self: false, poss: 'the student\'s' };
                if (!pv.staff) { return; }
                MemberService.SearchClubMembers(pv.clubId, '', 1, false, pv.studentId).then(function (data) {
                    if (nameFor !== key) { return; }
                    var m = data && data.success && angular.isArray(data.members) ? data.members[0] : null;
                    if (m && (m.first_name || m.last_name)) {
                        pv.student = {
                            first: m.first_name || m.last_name,
                            full: ((m.first_name || '') + ' ' + (m.last_name || '')).replace(/^\s+|\s+$/g, ''),
                            self: false, poss: (m.first_name || m.last_name) + '\'s'
                        };
                        buildRows();
                    }
                });
            }

            // ── load ──
            pv.load = function (quiet) {
                if (!pv.clubId || !pv.studentId) { return; }
                var my = ++seq;
                pv.staff = isStaff();
                resolveStudent();
                if (!quiet || !pv.status) { pv.loading = true; }
                pv.error = null;
                SoloRequirementsService.GetStatus(pv.clubId, pv.studentId, pv.courseId || null, flightIso()).then(function (data) {
                    if (my !== seq) { return; }       // a newer request superseded this one
                    pv.loading = false;
                    pv.loaded = true;

                    if (!data || data.success === false) {
                        pv.error = (data && data.error === 'FORBIDDEN') ? 'You can\'t see this student\'s pre-solo requirements.'
                                 : messageOf(data, 'The pre-solo requirements could not be loaded.');
                        pv.hidden = false;
                        if (!pv.status) { pv.rows = []; }
                        emit({ success: false, unavailable: true, message: pv.error, requirements: [], all_satisfied: false, outstanding: 0 });
                        return;
                    }

                    var reqs = angular.isArray(data.requirements) ? data.requirements : [];
                    var outstanding = 0;
                    var met = {};
                    reqs.forEach(function (r) {
                        if (!r.satisfied) { outstanding++; }
                        met[r.id] = !!r.satisfied;
                        if (r.satisfied && lastSatisfied.hasOwnProperty(r.id) && !lastSatisfied[r.id]) { flash(r.id); }
                    });
                    lastSatisfied = met;

                    var status = angular.extend({}, data, { requirements: reqs, outstanding: outstanding });
                    if (!reqs.length) { status.all_satisfied = true; }

                    if (pv.sign && !reqs.some(function (r) { return r.id === pv.sign.id && !r.satisfied; })) { pv.sign = null; }

                    pv.status = reqs.length ? status : null;
                    pv.hidden = !reqs.length;
                    buildRows();
                    emit(reqs.length ? status : { success: true, requirements: [], all_satisfied: true, outstanding: 0 });
                });
            };

            function emit(status) {
                try { pv.onStatus({ status: status }); } catch (e) { console.log('bo-presolo on-status failed', e); }
            }

            function flash(id) {
                pv.justMet[id] = true;
                $timeout(function () { delete pv.justMet[id]; }, 1800);
            }

            // ── row view-models (computed once per load, never in bindings) ──
            function kindOf(req) {
                if (req.satisfied) { return 'ok'; }
                if (req.state === 'pending_review' || req.state === 'in_progress') { return 'review'; }
                if (FAIL_STATES.indexOf(req.state) > -1) { return 'fail'; }
                return 'todo';
            }

            function typeOf(req) {
                return (req.auto_type === 'medical' || req.auto_type === 'questionnaire' || req.auto_type === 'exam') ? req.auto_type : 'manual';
            }

            function evidenceText(req, type) {
                var ev = req.evidence || {};
                var so = req.sign_off;
                var parts;
                if (type === 'medical' && ev.component_title && ev.expiry_date) {
                    var lim = Array.isArray(ev.limitations) ? ev.limitations.join(', ') : (ev.limitations || '');
                    return ev.component_title + ' — valid until ' + fmtDate(ev.expiry_date) + (lim ? ', limitation ' + lim : '') + ' (medical records)';
                }
                if (type === 'exam' && (ev.result !== undefined || ev.date)) {
                    var hasResult = ev.result !== null && ev.result !== undefined && ev.result !== '';
                    parts = (hasResult ? fmtPct(ev.result) : 'Passed') + (ev.date ? ' on ' + fmtDate(ev.date) : '');
                    if (req.min_score_percent !== null && req.min_score_percent !== undefined && req.min_score_percent !== '') {
                        parts += ' — pass mark ' + fmtPct(req.min_score_percent);
                    }
                    return parts + ' (exam results)';
                }
                if (type === 'questionnaire' && (ev.reviewed_at || ev.submitted_at)) {
                    parts = ev.status === 'reviewed' && ev.reviewed_at ? 'Reviewed on ' + fmtDate(ev.reviewed_at) : 'Submitted on ' + fmtDate(ev.submitted_at);
                    if (ev.score_percent !== null && ev.score_percent !== undefined && ev.score_percent !== '') {
                        parts += ' · ' + fmtPct(ev.score_percent);
                    } else if (parseFloat(ev.max_score) > 0 && ev.auto_score !== null && ev.auto_score !== undefined) {
                        parts += ' · score ' + (Math.round(parseFloat(ev.auto_score) * 10) / 10) + ' / ' + (Math.round(parseFloat(ev.max_score) * 10) / 10);
                    }
                    if (req.min_score_percent !== null && req.min_score_percent !== undefined && req.min_score_percent !== '') {
                        parts += ' — pass mark ' + fmtPct(req.min_score_percent);
                    }
                    return parts;
                }
                if (type === 'manual' && so) {
                    var who = so.signed_off_by_name || so.signer_name ||
                              (so.signed_off_by && String(so.signed_off_by) === String(me.id) ? 'you' : 'an instructor');
                    parts = 'Signed off by ' + who + (so.signed_off_at ? ' on ' + fmtDate(so.signed_off_at) : '');
                    parts += so.expires_at ? ' · valid until ' + fmtDate(so.expires_at) : ' · no expiry';
                    if (so.notes) { parts += ' · ' + so.notes; }
                    return parts;
                }
                return req.detail || 'Met';
            }

            // What a viewer who can't act sees in the action slot.
            function hintFor(req, type, kind) {
                if (req.satisfied || type === 'medical') { return null; }
                var first = pv.student.self ? 'You' : pv.student.first.charAt(0).toUpperCase() + pv.student.first.slice(1);
                var need = pv.student.self ? 'need' : 'needs';
                if (type === 'questionnaire') {
                    if (req.state === 'not_attempted') { return first + ' ' + need + ' to complete it'; }
                    if (req.state === 'in_progress') { return first + ' ' + need + ' to finish and submit it'; }
                    if (req.state === 'pending_review' && !pv.staff) { return 'Waiting for an instructor to review it'; }
                    if (req.state === 'below_min_score') { return first + ' ' + need + ' to retake it'; }
                    return null;
                }
                if (!pv.staff) {
                    if (type === 'exam') { return 'An instructor enters exam results'; }
                    if (type === 'manual') { return 'Needs an instructor sign-off'; }
                }
                return null;
            }

            function buildRows() {
                var reqs = pv.status ? pv.status.requirements : [];
                pv.rows = reqs.map(function (req) {
                    var type = typeOf(req);
                    var kind = kindOf(req);
                    var ev = req.evidence || {};
                    var row = {
                        req: req,
                        id: req.id,
                        type: type,
                        kind: kind,
                        typeLabel: TYPE_LABELS[type],
                        icon: kind === 'ok' ? 'fas fa-check-circle' : kind === 'review' ? 'fas fa-hourglass-half' : kind === 'fail' ? 'fas fa-times-circle' : 'far fa-circle',
                        evidence: req.satisfied ? evidenceText(req, type) : null,
                        detail: req.satisfied ? null : (req.detail || (type === 'manual' ? 'Needs an instructor sign-off' : 'Not yet met')),
                        canMedical: type === 'medical',
                        canReview: !req.satisfied && type === 'questionnaire' && req.state === 'pending_review' && !!ev.id && pv.staff,
                        canExam: !req.satisfied && type === 'exam' && pv.staff &&
                                 (req.state === 'not_passed' || req.state === 'below_min_score' || req.state === 'not_attempted'),
                        canSign: !req.satisfied && type === 'manual' && req.state === 'not_signed_off' && pv.staff
                    };
                    row.hint = (row.canReview || row.canExam || row.canSign) ? null : hintFor(req, type, kind);
                    return row;
                });
                pv.metCount = reqs.length - (pv.status ? pv.status.outstanding : 0);
            }

            // ── leaving for another screen and coming back ──
            // The parent saves its form draft (before-leave, may return a promise),
            // then sessionStorage bo_return tells the destination how to get back.
            function writeReturn(extra) {
                var ret;
                if (pv.bookingId) {
                    var params = { booking_id: pv.bookingId };
                    if (pv.lessonId) { params.lesson_id = pv.lessonId; }
                    ret = { state: 'dashboard.my_account.bookout_with_booking', params: params, label: 'book-out', at: Date.now() };
                } else {
                    ret = { state: 'dashboard.my_account.bookout', params: {}, label: 'book-out', at: Date.now() };
                }
                angular.extend(ret, extra || {});
                try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(ret)); } catch (e) {}
            }

            function leaveTo(state, params, extra) {
                if (leaving) { return; }
                leaving = true;
                var saved;
                try { saved = pv.beforeLeave(); } catch (e) { saved = null; console.log('bo-presolo before-leave failed', e); }
                writeReturn(extra);
                var go = function () {
                    $state.go(state, params).then(null, function () { leaving = false; });
                };
                $q.when(saved).then(go, go);
            }

            pv.review = function (row) {
                var ev = row.req.evidence || {};
                if (!row.canReview || !ev.id) { return; }
                leaveTo('dashboard.manage_club.questionnaire_review', { attempt_id: ev.id }, { attempt_id: ev.id });
            };

            pv.enterResult = function (row) {
                if (!row.canExam) { return; }
                var params = { club_id: pv.clubId, student_id: pv.studentId };
                var course = row.req.course_id || pv.courseId;
                if (course) { params.course_id = course; }
                leaveTo('dashboard.manage_user.student_records', params);
            };

            // ── medical sheet ──
            pv.viewMedical = function (row) {
                var modal = $uibModal.open({
                    animation: true,
                    templateUrl: 'views/directives/bookout_presolo_medical.html',
                    controller: MedicalModalController,
                    controllerAs: 'md',
                    windowClass: 'bop-modal-window',
                    backdropClass: 'bop-modal-backdrop',
                    resolve: {
                        ctx: function () {
                            return {
                                clubId: pv.clubId,
                                studentId: pv.studentId,
                                meId: me.id,
                                student: pv.student,
                                flightIso: flightIso(),
                                requirement: row.req.name,
                                evidence: row.req.evidence || null
                            };
                        }
                    }
                });
                modal.result.then(angular.noop, angular.noop);
            };

            // ── inline instructor sign-off ──
            // Validity defaults to the flight's own day (a circuit check is normally
            // same-day only); the solo gate compares expires_at with the flight date.
            pv.presets = [
                { id: 'day', days: 0 },
                { id: 'week', days: 7, label: '7 days' },
                { id: 'month', days: 28, label: '28 days' },
                { id: 'none', label: 'No expiry' },
                { id: 'custom', label: 'Pick a date' }
            ];

            pv.presetLabel = function (p) {
                if (p.id !== 'day') { return p.label; }
                var base = flightIso() || todayIso();
                return 'Today\'s flight only · ' + fmtDate(base, true, true);
            };

            pv.startSign = function (row) {
                if (!row.canSign) { return; }
                pv.sign = { id: row.id, preset: 'day', expires: dateObj(flightIso() || todayIso()), notes: '', error: null };
            };

            pv.cancelSign = function () { pv.sign = null; };

            pv.setPreset = function (p) {
                var s = pv.sign;
                if (!s) { return; }
                var base = flightIso() || todayIso();
                s.preset = p.id;
                s.error = null;
                if (p.days !== undefined) {
                    s.expires = dateObj(addDays(base, p.days));
                } else if (p.id === 'none') {
                    s.expires = null;
                } else if (p.id === 'custom' && !s.expires) {
                    s.expires = dateObj(base);
                }
            };

            // Typing a date of your own switches the chips to "Pick a date".
            pv.expiresEdited = function () {
                if (!pv.sign) { return; }
                pv.sign.preset = 'custom';
                pv.sign.error = null;
            };

            pv.signUntil = function () {
                var s = pv.sign;
                if (!s || s.preset === 'none') { return null; }
                return isoOf(s.expires) ? fmtDate(s.expires, true) : 'the date you pick';
            };

            pv.submitSign = function (row) {
                var s = pv.sign;
                if (!s || s.id !== row.id) { return; }
                var payload = { club_id: pv.clubId, user_id: pv.studentId, requirement_id: row.id };
                if (s.preset !== 'none') {
                    var iso = isoOf(s.expires);
                    if (!iso) { s.error = 'Pick the date this sign-off is valid until, or choose No expiry.'; return; }
                    var flight = flightIso();
                    if (flight && iso < flight) {
                        s.error = 'That date is before the flight (' + fmtDate(flight, true) + ') — the sign-off would not cover it.';
                        return;
                    }
                    payload.expires_at = iso;
                }
                var notes = (s.notes || '').replace(/^\s+|\s+$/g, '');
                if (notes) { payload.notes = notes; }
                s.error = null;
                SoloRequirementsService.SignOff(payload).then(function (data) {
                    if (data && data.success) {
                        ToastService.success('Signed off', '"' + row.req.name + '" is recorded against your name on ' + pv.student.poss + ' record.');
                        if (pv.sign === s) { pv.sign = null; }
                        pv.load(true);
                    } else {
                        s.error = messageOf(data, 'The sign-off could not be recorded — please try again.');
                        ToastService.error('Not signed off', s.error);
                    }
                });
            };

            // ── (re)load on mount and whenever the inputs change ──
            $scope.$watchGroup([
                function () { return pv.clubId; },
                function () { return pv.studentId; },
                function () { return pv.courseId; },
                function () { return flightIso(); }
            ], function () {
                var who = pv.clubId + ':' + pv.studentId;
                if (who !== watchedWho) { watchedWho = who; lastSatisfied = {}; pv.status = null; pv.rows = []; }
                pv.sign = null;
                pv.load();
            });
        }]
    };
}]);
