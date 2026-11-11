/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · HOME (what needs you, today's lessons, every part of the dashboard with a live line)
   Design: mockups/instructor-dashboard/home.html, page "home" (approved 9 Nov 2026; the "compare" page is a design
   explainer, not built). Tracker: mockups/v2-build/fe-instructor-home.md.

   Replaces v1 dashboard.manage_user (views/manage_user.html: nine purple tiles, DashboardController) behind the v2 switch.
   dashboard.manage_user is the PARENT of every v1 instructor state, but design.js redirects on the exact state name only,
   so mapping it moves the home alone: a child (…manage_user.debriefing_list) still lands on its own page.

   State: dashboard.v2.instructor_home  /manage_user  ← dashboard.manage_user

   Data (be-alex-3e.md contract C43, landed 9 Nov 21:53), one read:
     GET instructor_dashboard/v2/summary → {success, now (UK), viewer_id, is_instructor, clubs[{id, name}],
         attention[{key: debriefs|requests|signatures|caa|confirm|availability, tone, count, title, sub, oldest_at,
                    club_id, sort}] (≤6, in order),
         today[{booking_id, club_id, start, end, kind, status, pending_by,
                state: request|awaiting_club|to_brief|briefed|flying|to_debrief|debriefed, pilot{id, name, colour},
                aircraft{id, reg, type, colour}|null, lesson{id, title}|null, course{id, title}|null, sheet_id, out_at,
                landed_at, authorised_by_me, can_approve, can_book_out, can_book_in}],
         coming_up[≤4 {booking_id, club_id, start, end, kind, status, pending_by, state, pilot, aircraft, lesson}],
         tiles{schedule, briefings, debriefs, students, signatures, caa, hours, availability: {line, tone, count}},
         badges{debriefs, signatures, caa}, failed[section names]}
     Titles, subs and tile lines are the server's words. A non-instructor gets is_instructor:false and empty sections
     (D5: "You're not an instructor at a club yet"). A failed section keeps the page: its tile falls back to a plain line.
   Writes (a request on today's list, D6), My schedule's own calls through InsScheduleV2Data:
     PUT bookings/accept_booking/{id}/{uid} {}          Accept   → the row becomes "To brief"
     PUT bookings/decline_booking/{id}/{uid} {}         Decline  → the row fades and collapses, then the toast
   Every link goes to the v1 state name of its screen; DesignRoutes picks the design (go() below keeps the params a v1
   state does not declare, e.g. Debriefs' ?tab=entered).

   Here: InsHomeV2Data (the read, and one helper per domain: needs, lesson states, kinds, tiles) ·
   InstructorHomeV2Controller. View: views/v2/instructor_home/home.html · CSS: css/v2/instructor-home.css (ih-).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_home', {
        url: '/manage_user',
        templateUrl: 'views/v2/instructor_home/home.html',
        controller: 'InstructorHomeV2Controller',
        controllerAs: 'vm'
    });
    DesignRoutesProvider.map('dashboard.manage_user', 'dashboard.v2.instructor_home');
}]);


/* ═════ InsHomeV2Data: the read, and one helper per domain (raw values never reach the screen) ═════ */
app.factory('InsHomeV2Data', InsHomeV2Data);
InsHomeV2Data.$inject = ['InsCore'];
function InsHomeV2Data(InsCore) {
    var C = InsCore;

    /* every part of the Instructor Dashboard: what it's called, its icon, and the v1 state it opens (DesignRoutes picks
       the design). `plain` is the line a tile shows when its live line is missing (a failed section, or the read failed). */
    var TILES = {
        schedule: { t: 'My schedule', ic: 'fa-calendar-alt', to: 'dashboard.manage_user.my_schedule', plain: 'Your lessons and lesson requests' },
        briefings: { t: 'Briefings', ic: 'fa-chalkboard', to: 'dashboard.manage_user.briefing', plain: 'Brief your students before they fly' },
        debriefs: { t: 'Debriefs', ic: 'fa-clipboard-check', to: 'dashboard.manage_user.debriefing_list', plain: 'File your students’ training records' },
        students: { t: 'Student records', ic: 'fa-user-graduate', to: 'dashboard.manage_user.student_records', plain: 'Your students’ training records' },
        questionnaires: { t: 'Student questionnaires', ic: 'fa-tasks', to: 'dashboard.manage_user.student_questionnaires', plain: 'Set and review your students’ questionnaires' },
        signatures: { t: 'Signatures', ic: 'fa-file-signature', to: 'dashboard.manage_user.pending_signatures', plain: 'Logbook lines your students asked you to sign' },
        caa: { t: 'CAA forms', ic: 'fa-file-contract', to: 'dashboard.manage_user.caa_forms', plain: 'Start, sign and countersign CAA forms' },
        hours: { t: 'Hours instructed', ic: 'fa-stopwatch', to: 'dashboard.manage_user.instructed_hours', plain: 'Your dual and supervised solo hours' },
        availability: { t: 'Availability & holidays', ic: 'fa-calendar-check', to: 'dashboard.manage_user.instructor_availability', plain: 'When students can book you, and your time off' }
    };
    var GROUPS = [
        { key: 'lessons', label: 'Lessons', ic: 'fa-plane-departure', tiles: ['schedule', 'briefings', 'debriefs'] },
        { key: 'students', label: 'Students', ic: 'fa-user-graduate', tiles: ['students', 'questionnaires'] },
        { key: 'signoffs', label: 'Sign-offs', ic: 'fa-stamp', tiles: ['signatures', 'caa'] },
        { key: 'time', label: 'Your time', ic: 'fa-clock', tiles: ['hours', 'availability'] }
    ];
    /* the questionnaires tile keeps the mockup's static line (C43: no to-review count yet, so no chip and no badge) */
    var STATIC = { questionnaires: 'Set and review your students’ questionnaires' };
    /* which section of the read feeds which tile (the names in failed[]) */
    var SECTION_OF = { schedule: 'lessons', briefings: 'briefings', debriefs: 'debriefs', students: 'students', signatures: 'signatures', caa: 'caa', hours: 'hours', availability: 'availability' };
    var ATTN_SECTIONS = ['debriefs', 'requests', 'signatures', 'caa', 'availability'];

    /* "Needs you": the icon and the verb on each kind of chip */
    var NEEDS = {
        debriefs: { ic: 'fa-clipboard-check', go: 'File' },
        requests: { ic: 'fa-calendar-plus', go: 'Answer' },
        signatures: { ic: 'fa-file-signature', go: 'Sign' },
        caa: { ic: 'fa-file-contract', go: 'Sign' },
        confirm: { ic: 'fa-user-check', go: 'Confirm' },
        availability: { ic: 'fa-calendar-check', go: 'Set it' }
    };

    /* one helper for every lesson state: the pill (tone, words, icon) */
    var STATES = {
        to_debrief: { tone: 'warn', label: 'To debrief', ic: 'fa-clipboard-check' },
        flying: { tone: 'info', label: 'Flying', ic: 'fa-plane' },
        to_brief: { tone: 'muted', label: 'To brief', ic: 'fa-chalkboard' },
        briefed: { tone: 'good', label: 'Briefed', ic: 'fa-check' },
        request: { tone: 'pend', label: 'Waiting for you', ic: 'fa-hourglass-half' },
        awaiting_club: { tone: 'pend', label: 'Awaiting club approval', ic: 'fa-hourglass-half' },
        debriefed: { tone: 'good', label: 'Debriefed', ic: 'fa-clipboard-check' },
        // booked in, but no record is due from you (C43, 10 Nov): never "Debriefed"
        landed: { tone: 'good', label: 'Landed', ic: 'fa-plane-arrival' }
    };
    /* the first thing to do is highlighted: the first lesson to debrief, else the first request, else the first to brief */
    var LEAD_ORDER = ['to_debrief', 'request', 'to_brief'];

    var SEEN_KEY = 'toaviate_ih_home';   // lastSeen / remember (below): this tab's memory of the last read

    var KINDS = {
        dual: { ic: 'fa-user-friends', label: 'Dual lesson', title: 'Dual lesson' },
        solo: { ic: 'fa-user', label: 'Solo', title: 'Supervised solo' },
        hire: { ic: 'fa-key', label: 'Self-fly hire', title: 'Self-fly hire' },
        trial: { ic: 'fa-star', label: 'Trial lesson', title: 'Trial lesson' },
        maint: { ic: 'fa-wrench', label: 'Maintenance', title: 'Maintenance' }
    };

    return {
        TILES: TILES, GROUPS: GROUPS, NEEDS: NEEDS, STATES: STATES, KINDS: KINDS,
        summary: summary, needOf: needOf, needTarget: needTarget, kindOf: kindOf, stateOf: stateOf, lessonRow: lessonRow,
        decorate: decorate, upRow: upRow, leadOf: leadOf, tilesOf: tilesOf, clubsWords: clubsWords, attnFailed: attnFailed, hhmm: hhmm,
        lastSeen: lastSeen, remember: remember
    };

    function summary() { return C.get('instructor_dashboard/v2/summary'); }

    function hhmm(s) { return C.fTime(s); }
    function kindOf(k) { return KINDS[k] || KINDS.dual; }
    function stateOf(s) { return STATES[s] || STATES.to_brief; }
    function nameOf(b) { return (b.pilot && String(b.pilot.name || '').trim()) || 'No student named'; }

    /* one chip of "Needs you" (the server's title and sub; our icon and verb) */
    function needOf(a) {
        var n = NEEDS[a.key] || { ic: 'fa-exclamation-circle', go: 'Open' };
        return { key: a.key, tone: a.tone === 'warn' || a.tone === 'bad' ? a.tone : '', ic: n.ic, go: n.go, title: a.title || '', sub: a.sub || '', clubId: +a.club_id || null };
    }
    /* where a chip goes: the v1 state and its params */
    function needTarget(n) {
        switch (n.key) {
            case 'debriefs': return { to: TILES.debriefs.to };
            case 'requests': return { to: TILES.schedule.to };
            case 'signatures': return { to: TILES.signatures.to };
            // C43 names a club only when every form is a Head of Training one at one club: straight to that tab
            case 'caa': return n.clubId ? { to: TILES.caa.to, params: { club_id: n.clubId, tab: 'hot' } } : { to: TILES.caa.to, params: { tab: 'queue' } };
            case 'confirm': return { to: TILES.debriefs.to, params: { tab: 'entered' } };
            case 'availability': return { to: TILES.availability.to };
        }
        return { to: 'dashboard.manage_user' };
    }

    /* one of today's lessons → everything the row shows, worked out once */
    function lessonRow(b, clubName) {
        var k = kindOf(b.kind), who = nameOf(b), ac = b.aircraft ? C.ac(b.aircraft) : null;
        var r = {
            id: +b.booking_id, clubId: +b.club_id || 0, start: b.start, end: b.end, kind: KINDS[b.kind] ? b.kind : 'dual', k: k,
            state: STATES[b.state] ? b.state : 'to_brief', pendingBy: b.pending_by || null, who: who, first: C.firstName(who), ac: ac && ac.reg ? ac : null,
            acStyle: ac && ac.colour ? '--ac: ' + ac.colour : '', acTitle: ac ? ac.reg + (ac.type ? ' · ' + ac.type : '') : '',
            lessonId: b.lesson && b.lesson.id ? +b.lesson.id : 0,
            // the booking's lesson; a lesson not chosen yet shows its course
            lessonT: b.lesson && b.lesson.title ? b.lesson.title : (b.course && b.course.title ? b.course.title : ''),
            sheetId: +b.sheet_id || 0, outAt: b.out_at || null, landedAt: b.landed_at || null, mine: !!b.authorised_by_me,
            canApprove: !!b.can_approve,
            range: hhmm(b.start) + '–' + hhmm(b.end), dur: C.len(C.minutesBetween(b.start, b.end)),
            club: clubName || ''
        };
        r.title = k.title + ' · ' + who;
        r.aria = k.label + ' with ' + who + (r.ac ? ', ' + r.ac.reg : '') + ', ' + r.range;
        return decorate(r);
    }
    /* the state's pill, facts and next action (again after Accept) */
    function decorate(r) {
        var s = r.state;
        r.st = stateOf(s);
        // a voucher request either side may answer (pending_by 'both', 10 Nov): say so, keep the buttons
        if (s === 'request' && r.pendingBy === 'both') { r.st = angular.extend({}, r.st, { label: 'Waiting for you or the club' }); }
        r.facts = [];
        if ((s === 'to_debrief' || s === 'debriefed' || s === 'landed') && r.landedAt) { r.facts.push({ ic: 'fa-plane-arrival', t: 'Landed ' + hhmm(r.landedAt) }); }   // D8
        if (s === 'flying') {
            r.facts.push({ ic: 'fa-plane-departure', t: (r.outAt ? 'Out ' + hhmm(r.outAt) + ' · ' : '') + 'back by ' + hhmm(r.end) });
            if (r.mine) { r.facts.push({ ic: 'fa-user-check', t: 'You authorised it' }); }
        }
        if (s === 'request') { r.facts.push({ ic: 'fa-info-circle', t: r.first + ' can’t fly until ' + (r.pendingBy === 'both' ? 'you or the club accept' : 'you accept') }); }
        if (s === 'awaiting_club') { r.facts.push({ ic: 'fa-info-circle', t: 'The club approves this one' }); }
        if (r.club) { r.facts.push({ ic: 'fa-map-marker-alt', t: r.club }); }   // today's lessons are at more than one of your clubs
        r.act = s === 'to_debrief' ? 'debrief' : s === 'to_brief' ? 'brief' : s === 'briefed' ? 'open' : (s === 'request' && r.canApprove) ? 'answer' : '';
        return r;
    }
    function leadOf(rows) {
        for (var i = 0; i < LEAD_ORDER.length; i++) {
            for (var j = 0; j < rows.length; j++) { if (rows[j].state === LEAD_ORDER[i]) { return rows[j].id; } }
        }
        return null;
    }
    /* one "Coming up" chip */
    function upRow(b) {
        var ac = b.aircraft ? C.ac(b.aircraft) : null;
        return { id: +b.booking_id, kind: KINDS[b.kind] ? b.kind : 'dual', k: kindOf(b.kind), when: C.fDay(b.start) + ' · ' + hhmm(b.start), sub: nameOf(b) + (ac && ac.reg ? ' · ' + ac.reg : '') };
    }
    /* the four groups with each tile's live line, tone and badge */
    function tilesOf(res) {
        var tiles = (res && res.tiles) || {}, badges = (res && res.badges) || {}, failed = (res && res.failed) || [];
        return GROUPS.map(function (g) {
            return {
                key: g.key, label: g.label, ic: g.ic,
                tiles: g.tiles.map(function (key) {
                    var T = TILES[key], live = tiles[key], ok = !!live && failed.indexOf(SECTION_OF[key]) < 0;
                    var line = STATIC[key] || (ok && live.line ? live.line : T.plain);
                    var tone = !STATIC[key] && ok && (live.tone === 'warn' || live.tone === 'bad') ? live.tone : '';
                    var badge = failed.indexOf(SECTION_OF[key]) < 0 && +badges[key] > 0 ? +badges[key] : 0;
                    return { key: key, t: T.t, ic: T.ic, to: T.to, line: line, tone: tone, badge: badge };
                })
            };
        });
    }
    /* "The Pilot Centre and Westfield Flying Club" */
    function clubsWords(clubs) {
        var n = (clubs || []).map(function (c) { return String(c.name || '').trim(); }).filter(function (x) { return !!x; });
        if (!n.length) { return ''; }
        return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
    }
    /* did a section that feeds "Needs you" fail? (then the page never says "All up to date") */
    function attnFailed(res) { return ((res && res.failed) || []).some(function (s) { return ATTN_SECTIONS.indexOf(s) > -1; }); }

    /* what this tab saw at the last read (sessionStorage, per user): the clubs' names, so the bar says "instructing at …" while
       the next read is on its way, and whether anything needed you, so the loading bar keeps a place for "Needs you" only when
       it is likely to be filled. Never required: an empty or unreadable store just means the name alone, and the placeholder. */
    function lastSeen(uid) {
        try {
            var v = JSON.parse(sessionStorage.getItem(SEEN_KEY) || 'null');
            return v && +v.uid === +uid && uid ? v : null;
        } catch (e) { return null; }
    }
    function remember(uid, res) {
        try {
            sessionStorage.setItem(SEEN_KEY, JSON.stringify({ uid: +uid, instructor: res.is_instructor !== false,
                clubs: (res.clubs || []).map(function (c) { return { id: +c.id, name: c.name }; }), attn: (res.attention || []).length }));
        } catch (e) {}
    }
}


/* ═════ the page ═════ */
app.controller('InstructorHomeV2Controller', InstructorHomeV2Controller);
InstructorHomeV2Controller.$inject = ['$scope', '$state', '$q', '$timeout', 'InsCore', 'InsHomeV2Data', 'InsScheduleV2Data', 'ToastService', 'DesignService', 'DesignRoutes'];
function InstructorHomeV2Controller($scope, $state, $q, $timeout, InsCore, InsHomeV2Data, InsScheduleV2Data, ToastService, DesignService, DesignRoutes) {
    var vm = this, C = InsCore, D = InsHomeV2Data;
    var QUIET = { confetti: false };
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var gen = 0;        // the newest read wins

    vm.st = 'loading';  // loading | ready | error | none (not an instructor at any club, D5)
    vm.err = '';
    vm.attn = [];
    vm.attnAll = false;
    vm.upToDate = false;
    vm.rows = [];
    vm.up = [];
    vm.groups = [];
    vm.skel = [1, 2, 3];
    vm.attnSkel = false;   // the "Needs you" placeholder row while the read is on its way
    vm.busy = {};          // booking id → 'accept' | 'decline'
    vm.decline = null;     // the booking whose "Decline …?" is open
    vm.leadId = null;

    var me = C.me();
    vm.name = [me.first_name, me.last_name].filter(function (x) { return !!x; }).join(' ');
    vm.sub = vm.name;
    var seen = D.lastSeen(C.myId());
    if (seen && seen.instructor) { var w0 = D.clubsWords(seen.clubs); if (w0) { vm.sub = vm.name + (vm.name ? ' · ' : '') + 'instructing at ' + w0; } }

    /* ── the read ── */
    function load(quiet) {
        var my = ++gen;
        if (!quiet) {
            vm.st = 'loading';
            seen = D.lastSeen(C.myId());
            vm.attnSkel = !vm.attn.length && (!seen || (seen.instructor && seen.attn > 0));   // a place for "Needs you", unless the last read had none
        }
        return D.summary().then(function (res) {
            if (my !== gen) { return; }
            if (!res || res.success === false) {
                if (quiet) { return; }   // a refresh that fails keeps what's on screen
                vm.st = 'error';
                closeAttnSkel();
                vm.err = res && typeof res.message === 'string' && res.message && !/^\s*</.test(res.message) ? res.message : 'Something went wrong. Please try again.';
                vm.groups = D.tilesOf(null);
                vm.attn = [];
                vm.upToDate = false;
                return;
            }
            apply(res);
        });
    }
    vm.reload = function () { load(false); };

    function apply(res) {
        var clubs = res.clubs || [], names = {};
        clubs.forEach(function (c) { names[+c.id] = c.name; });
        var words = D.clubsWords(clubs);
        vm.sub = vm.name + (words ? (vm.name ? ' · ' : '') + 'instructing at ' + words : '');
        D.remember(C.myId(), res);
        if (res.is_instructor === false) { vm.st = 'none'; vm.attn = []; vm.rows = []; vm.up = []; vm.upToDate = false; closeAttnSkel(); return; }
        var failed = res.failed || [];
        vm.lessonsFailed = failed.indexOf('lessons') > -1;
        vm.attn = (res.attention || []).map(D.needOf);
        vm.upToDate = !vm.attn.length && !D.attnFailed(res);
        if (vm.attn.length) { vm.attnSkel = false; } else { closeAttnSkel(); }   // the real row takes the placeholder's place
        // more than one club: when all of today's lessons are at one of them, the Today line names it once; when they're
        // spread over several, each lesson says where it is
        var at = {}, today = res.today || [];
        today.forEach(function (b) { at[+b.club_id] = true; });
        var spread = clubs.length > 1 && Object.keys(at).length > 1;
        vm.todayClub = clubs.length > 1 && Object.keys(at).length === 1 ? names[+today[0].club_id] || '' : '';
        vm.rows = today.map(function (b) { return D.lessonRow(b, spread ? names[+b.club_id] : ''); });
        vm.up = (res.coming_up || []).map(D.upRow);
        vm.newbie = !vm.rows.length && vm.attn.some(function (a) { return a.key === 'availability'; });
        vm.groups = D.tilesOf(res);
        vm.dayLabel = C.fDay(res.now || C.now());
        if (vm.decline && !vm.rows.some(function (r) { return r.id === vm.decline && r.act === 'answer'; })) { vm.decline = null; }
        relead();
        vm.st = 'ready';
    }
    function relead() {
        vm.leadId = D.leadOf(vm.rows);
        vm.todayLine = vm.dayLabel + (vm.rows.length ? ' · ' + C.plural(vm.rows.length, 'lesson') + (vm.todayClub ? ' at ' + vm.todayClub : '') : '');
    }

    $scope.$on('$destroy', function () { gen++; });

    /* ── where things go: the v1 state, moved to its v2 design by DesignRoutes (a param the v1 state doesn't declare,
       like Debriefs' ?tab=entered, would be dropped on the way through the v1 name, so the v2 state is asked for directly) ── */
    function go(to, params) {
        var v2 = DesignService.isV2() ? DesignRoutes.v2For(to) : null;
        return $state.go(v2 || to, params || {});
    }
    vm.go = function (key) { var t = D.TILES[key]; if (t) { go(t.to); } };
    vm.tileGo = function (t) { go(t.to); };
    vm.needGo = function (n) { var x = D.needTarget(n); go(x.to, x.params); };
    vm.attnMore = function () { vm.attnAll = !vm.attnAll; };
    vm.act = function (r) {
        if (!r || vm.busy[r.id]) { return; }
        if (r.act === 'debrief') {
            if (!r.sheetId) { return go(D.TILES.debriefs.to); }
            return go('dashboard.manage_user.debriefing', { booking_id: r.id, plane_log_sheet_id: r.sheetId, split_next_id: 0, split_booking_id: 0 });
        }
        if (r.act === 'brief' || r.act === 'open') { return go('dashboard.manage_user.briefing_lesson', { booking_id: r.id, lesson_id: r.lessonId || 0, club_id: r.clubId }); }
    };

    /* ── a request on today's list (D6): Accept in place; Decline asks first (inline), then the row leaves ── */
    vm.accept = function (r) {
        if (!r || vm.busy[r.id] || r.act !== 'answer') { return; }
        vm.busy[r.id] = 'accept';
        if (vm.decline === r.id) { vm.decline = null; }
        InsScheduleV2Data.accept(r.id).then(function (res) {
            delete vm.busy[r.id];
            if (!res || res.success === false) {
                ToastService.error('Not accepted', errText(res, 'The request could not be accepted — nothing has changed.'));
                refresh();
                return;
            }
            var cur = vm.rows.filter(function (x) { return x.id === r.id; })[0] || r;   // a re-read meanwhile may have made a new row object
            cur.state = 'to_brief';   // a confirmed lesson, still to brief
            cur.canApprove = false;
            D.decorate(cur);
            relead();
            ToastService.success('Accepted', r.first + ' can book out at ' + D.hhmm(r.start) + '. They’ve been emailed, with a calendar invite.', QUIET);
            refresh();
        });
    };
    vm.declineAsk = function (r) { if (!r || vm.busy[r.id]) { return; } vm.decline = r.id; focusLater('ih-keep-' + r.id); };
    vm.declineNo = function () { var id = vm.decline; if (!id || vm.busy[id]) { return; } vm.decline = null; focusLater('ih-decline-' + id); };
    vm.declineYes = function (r) {
        if (!r || vm.busy[r.id]) { return; }
        vm.busy[r.id] = 'decline';
        InsScheduleV2Data.decline(r.id).then(function (res) {
            if (!res || res.success === false) {
                delete vm.busy[r.id];
                ToastService.error('Not declined', errText(res, 'Nothing has changed — try again in a moment.'));
                if (res && (res.error === 'NOT_PENDING' || res.error === 'NOT_FOUND' || res.error === 'FORBIDDEN')) { vm.decline = null; }
                refresh();
                return;
            }
            leave(r).then(function () {
                delete vm.busy[r.id];
                vm.decline = null;
                vm.rows = vm.rows.filter(function (x) { return x.id !== r.id; });   // by id: a re-read meanwhile may have made new row objects
                relead();
                ToastService.success('Declined', r.first + ' has been told by email, and the slot is free again.', QUIET);
                refresh();
            });
        });
    };

    function errText(res, fallback) {
        var m = res && typeof res.message === 'string' ? res.message : (res && res.message && typeof res.message.message === 'string' ? res.message.message : '');
        return m && !/^\s*</.test(m) && m !== 'Request failed' ? m : fallback;
    }
    function refresh() { load(true); }
    function focusLater(id) { $timeout(function () { var el = document.getElementById(id); if (el && el.focus) { el.focus(); } }, 30, false); }

    /* a lesson leaving the list: fade and collapse (~220 ms); then the change lands, and the toast */
    function leave(r) {
        var d = $q.defer(), el = document.getElementById('ih-l-' + r.id);
        if (!el || !el.animate || (reduce && reduce.matches)) { d.resolve(); return d.promise; }
        el.style.display = 'block';   // the wrapper has no box (display: contents) until it leaves
        el.style.overflow = 'hidden';
        el.style.pointerEvents = 'none';
        var h = el.offsetHeight;
        var a = el.animate([
            { opacity: 1, height: h + 'px', transform: 'scale(1)' },
            { opacity: 0, height: '0px', transform: 'scale(0.985)' }
        ], { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
        a.onfinish = function () { $scope.$applyAsync(d.resolve); };
        return d.promise;
    }

    /* nothing needs you: the "Needs you" placeholder folds away (~220 ms) instead of vanishing. The bar's 12px row gap is
       folded with it (margin-top), so nothing jumps when the row is finally removed. */
    function closeAttnSkel() {
        if (!vm.attnSkel) { return; }
        var el = document.querySelector('[data-e2e=ih-attn-skel]');
        if (!el || !el.animate || (reduce && reduce.matches)) { vm.attnSkel = false; return; }
        var cs = getComputedStyle(el), h = el.offsetHeight;
        el.style.overflow = 'hidden';
        var a = el.animate([
            { height: h + 'px', paddingTop: cs.paddingTop, borderTopWidth: cs.borderTopWidth, marginTop: '0px', opacity: 1 },
            { height: '0px', paddingTop: '0px', borderTopWidth: '0px', marginTop: '-12px', opacity: 0 }
        ], { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
        a.onfinish = function () { $scope.$applyAsync(function () { vm.attnSkel = false; }); };
    }

    /* Esc closes an open "Decline …?" */
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented || !vm.decline || vm.busy[vm.decline]) { return; }
        $scope.$apply(function () { vm.declineNo(); });
    }
    document.addEventListener('keydown', onKey);
    $scope.$on('$destroy', function () { document.removeEventListener('keydown', onKey); });

    load(false);
}
