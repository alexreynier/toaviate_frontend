/* v2: questions to ToAviate sales (member side: the "Ask us" dialog + your questions) — be-alex-3e sales enquiries contract.
   States under dashboard.v2.* (see js/v2/core/design.js). */
/* ═══════════════════════════════════════════════════════════════════════════
   v2 QUESTIONS TO TOAVIATE — member side (owner, 9 Nov 2026: "add a functionality to get an answer from sales").
   The ToAviate admin inbox is js/v2/enquiries_admin (another builder); the backend is be-alex-3e (D).

   • SalesEnquiryService — every call + the shared words (topics, statuses). Contract C19 (backend
     BACKEND_SALES_ENQUIRIES_GUIDE.md, landed 9 Nov):
       POST sales_enquiries {topic, message, context?, club_id?} → { success, enquiry }            (e-mails ToAviate)
       GET  sales_enquiries/mine → { enquiries: [{ id, topic, status, created_at, updated_at, last_reply_at, message_count,
                                     last_message { from_staff, body (140), created_at }, awaiting_member }] }
       GET  sales_enquiries/{id} → { enquiry: { …, club_title, context, messages: [{ id, from_staff, author_name, body, created_at }] } }
       POST sales_enquiries/{id}/messages {message} → { success, enquiry }   (status back to open; e-mails ToAviate)
     Statuses open | answered | closed. A staff reply e-mails the member ("READ AND REPLY" → my_account/questions/{id}).
     Refusals: VALIDATION_ERROR (fields: [message|topic|context|club_id]), NOT_FOUND, ENQUIRY_CLOSED, RATE_LIMITED
     (10 member messages a rolling hour), UNSUPPORTED_CHARACTERS (emoji — the central interceptor toasts it).
     Shapes are read through norm*() only.
   • "Ask us" anywhere: EnquiryAsk.open({ topic, context }) (a dialog appended to <body>), or the trigger button
       <enq-ask topic="trackers" context="vm.enqCtx" club-id="vm.clubId" label="Ask us about trackers" on-sent="vm.enqSent(enquiry)"></enq-ask>
     context = { source: 'claim_a_flight', page: 'Claim a flight', items: [{ k: 'Club', v: 'The Pilot Centre' }] } — shown
     to the member before sending, and only sent while "Include these details" stays on.
   • The member page: dashboard.v2.enquiries (/dashboard/v2/my_account/questions) lists your questions; its child
     dashboard.v2.enquiries.thread (/:enquiry_id) opens one in the right-hand pane (the whole screen on phones), with
     ToAviate's replies and a reply box while it isn't closed. v2 only — no v1 state to map (data.v2Design), and it
     opens whatever the design switch says (there is no classic page to send anyone to; "Back to classic designs" is
     shown only while the switch is on and goes to My Account).
   • E-mail links: /my_account/questions[/:id] (what the reply e-mail sends today) and /dashboard/my_account/questions[/:id]
     (the classic-style URL, which the v2 states take at cut-over) both forward here, so old e-mails keep working.
   Styles: css/v2/enquiries.css (.enq-*), on ta-base.css.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', function ($stateProvider) {
    function forward(list) {
        return ['$state', '$stateParams', '$timeout', function ($state, $stateParams, $timeout) {
            $timeout(function () {
                if (list || !$stateParams.enquiry_id) { $state.go('dashboard.v2.enquiries', {}, { location: 'replace' }); }
                else { $state.go('dashboard.v2.enquiries.thread', { enquiry_id: $stateParams.enquiry_id }, { location: 'replace' }); }
            });
        }];
    }
    var WAIT = '<main class="ta-page"><p class="ta-hint">Opening your questions…</p></main>';
    $stateProvider
        .state('questions_link', { url: '/my_account/questions', template: WAIT, controller: forward(true) })
        .state('questions_link_one', { url: '/my_account/questions/:enquiry_id', template: WAIT, controller: forward(false) })
        .state('dashboard.questions_link', { url: '/my_account/questions', template: WAIT, controller: forward(true) })
        .state('dashboard.questions_link_one', { url: '/my_account/questions/:enquiry_id', template: WAIT, controller: forward(false) })
        .state('dashboard.v2.enquiries', {
            url: '/my_account/questions',
            templateUrl: 'views/v2/enquiries/enquiries.html',
            controller: 'EnquiriesV2Controller', controllerAs: 'vm',
            data: { v2Design: true }
        })
        .state('dashboard.v2.enquiries.thread', {
            url: '/:enquiry_id',
            views: { 'thread@dashboard.v2.enquiries': { templateUrl: 'views/v2/enquiries/_thread.html', controller: 'EnquiryThreadV2Controller', controllerAs: 'th' } },
            data: { v2Design: true }
        });
}]);

/* ═════ the data layer + the shared words ═════ */
app.factory('SalesEnquiryService', SalesEnquiryService);
SalesEnquiryService.$inject = ['$http', '$location'];
function SalesEnquiryService($http, $location) {
    var base = '/api/v1/sales_enquiries';
    var TOPICS = {
        trackers: { key: 'trackers', label: 'Trackers', icon: 'fa-satellite-dish', title: 'Ask ToAviate about trackers',
            placeholder: 'For example: what would it take to fit trackers at my club, and what do they cost?' },
        general: { key: 'general', label: 'General question', icon: 'fa-comment', title: 'Ask ToAviate a question',
            placeholder: 'Ask us anything — how something works, an idea, or a problem you’ve hit.' }
    };
    var STATUS = {
        open: { label: 'Waiting for our reply', short: 'Waiting', tone: 'info', icon: 'fa-hourglass-half' },
        answered: { label: 'Answered', short: 'Answered', tone: 'good', icon: 'fa-reply' },
        closed: { label: 'Closed', short: 'Closed', tone: 'muted', icon: 'fa-check' }
    };
    var MIN = 10, MAX = 5000;   // the backend's MAX_MESSAGE
    var service = {
        TOPICS: TOPICS, MIN: MIN, MAX: MAX,
        topic: function (k) { return TOPICS[k] || { key: k || 'general', label: k ? String(k).charAt(0).toUpperCase() + String(k).slice(1).replace(/_/g, ' ') : 'Question', icon: 'fa-comment', title: 'Ask ToAviate a question', placeholder: TOPICS.general.placeholder }; },
        status: function (k) { return STATUS[k] || STATUS.open; },
        Create: Create, Mine: Mine, Get: Get, Reply: Reply,
        normEnquiry: normEnquiry, normMessage: normMessage
    };
    return service;

    function Create(topic, message, context, clubId) {
        var body = { topic: topic, message: message, context: context || null };
        if (clubId) { body.club_id = clubId; }
        return $http.post(base, body).then(handleSuccess, handleError2);
    }
    function Mine() { return $http.get(base + '/mine').then(handleSuccess, handleError2); }
    function Get(id) { return $http.get(base + '/' + encodeURIComponent(id)).then(handleSuccess, handleError2); }
    function Reply(id, message) { return $http.post(base + '/' + encodeURIComponent(id) + '/messages', { message: message }).then(handleSuccess, handleError2); }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data && typeof res.data === 'object' ? res.data : {};
        // never the raw body as the message: an HTTP error's body is an HTML page (UX pass 2: it reached the toasts)
        return { success: false, error: d.error || null, message: typeof d.message === 'string' ? d.message : '', fields: d.fields || null, status: res.status };
    }

    /* one message in a thread: who wrote it (the member or ToAviate), the words, when */
    function normMessage(m) {
        m = m || {};
        var staff = m.from_staff === true || +m.from_staff === 1 || m.from === 'staff';
        var name = String(m.author_name || (staff ? 'ToAviate' : 'You'));
        // a member sees ToAviate staff as "Sam · ToAviate" (the backend's words); make sure "ToAviate" is said once
        if (staff && name.indexOf('ToAviate') < 0) { name += ' · ToAviate'; }
        return { id: m.id, staff: staff, body: String(m.body != null ? m.body : ''), name: name, at: String(m.created_at || '') };
    }
    /* where a question was asked from, in words — never a raw slug ("claim_a_flight") */
    function pageName(p) {
        p = String(p || '').trim();
        var known = { claim_a_flight: 'Claim a flight', questions: 'Your questions', home: 'Home', logbook: 'My logbook' };
        if (known[p]) { return known[p]; }
        return /^[a-z0-9_]+$/.test(p) ? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, ' ') : p;
    }
    /* one question: summary rows (the list) and full threads both come through here */
    function normEnquiry(e) {
        e = e || {};
        var msgs = (e.messages || []).map(normMessage);
        var lm = e.last_message ? normMessage(e.last_message) : null;   // list rows carry only the last message (140 characters)
        var first = msgs[0], last = msgs[msgs.length - 1] || lm;
        var ctx = e.context && typeof e.context === 'object' && !angular.isArray(e.context) ? e.context : null;
        var count = e.message_count != null ? +e.message_count : msgs.length;
        return {
            id: e.id, ref: e.reference || '', topic: e.topic || 'general', status: STATUS[e.status] ? e.status : 'open',
            created: String(e.created_at || (first && first.at) || ''),
            last: String((last && last.at) || e.updated_at || e.created_at || ''),
            lastStaff: !!(last && last.staff),
            awaiting: e.awaiting_member != null ? !!e.awaiting_member : !!(last && last.staff),
            // the question itself: the thread's first message, or the list row's last one while it's the only one
            preview: String(e.first_message || (first && first.body) || (count <= 1 && lm ? lm.body : '')),
            lastBody: String((last && last.body) || ''),
            count: count, club: e.club_title || '',
            messages: msgs, context: ctx,
            ctxLine: (ctx ? [pageName(ctx.page || ctx.source)].concat((angular.isArray(ctx.items) ? ctx.items : []).map(function (i) { return i && i.v; })) : [])
                .concat(e.club_title && !(ctx && JSON.stringify(ctx).indexOf(e.club_title) > -1) ? [e.club_title] : []).filter(Boolean).join(' · ')
        };
    }
}

/* ═════ "2 h ago"-free dates: Today, 14:05 · Yesterday, 09:12 · 4 Nov, 14:05 · 4 Nov 2025 ═════ */
app.factory('EnqFmt', ['LgbFmt', function (F) {
    function when(s, withTime) {
        if (!s) { return ''; }
        var day = String(s).slice(0, 10), t = F.fTime(s), g = F.daysBetween(day, F.today()), d = F.pd(day);
        var label = g === 0 ? 'Today' : g === 1 ? 'Yesterday' : (d.getFullYear() === new Date().getFullYear() ? d.getDate() + ' ' + F.MON[d.getMonth()] : F.fDate(day));
        return withTime && t ? label + ', ' + t : label;
    }
    function short(s) {   // the list's right-hand column: a time today, else the date
        if (!s) { return ''; }
        var day = String(s).slice(0, 10), g = F.daysBetween(day, F.today()), d = F.pd(day);
        return g === 0 ? F.fTime(s) : g === 1 ? 'Yesterday' : (d.getFullYear() === new Date().getFullYear() ? d.getDate() + ' ' + F.MON[d.getMonth()] : F.fDate(day));
    }
    function dayLabel(s) { var day = String(s || '').slice(0, 10), g = F.daysBetween(day, F.today()); return !day ? '' : g === 0 ? 'Today' : g === 1 ? 'Yesterday' : F.fDayLong(day); }
    return { when: when, short: short, dayLabel: dayLabel, fDate: F.fDate };
}]);

/* ═════ the "Ask us" dialog — EnquiryAsk.open(opts) → promise of the new question (null when closed without sending) ═════ */
app.factory('EnquiryAsk', EnquiryAsk);
EnquiryAsk.$inject = ['$rootScope', '$compile', '$templateRequest', '$document', '$timeout', '$q', '$state', 'SalesEnquiryService', 'ToastService'];
function EnquiryAsk($rootScope, $compile, $templateRequest, $document, $timeout, $q, $state, SalesEnquiryService, ToastService) {
    var current = null;
    return { open: open, isOpen: function () { return !!current; } };

    function open(opts) {
        opts = opts || {};
        if (current) { return current.promise; }
        var done = $q.defer(), back = document.activeElement, S = SalesEnquiryService;
        var scope = $rootScope.$new(true), el = null;
        var ctx = opts.context || null, items = ctx && ctx.items ? ctx.items.filter(function (i) { return i && i.v; }) : [];
        var user = ($rootScope.globals && $rootScope.globals.currentUser) || {};
        scope.d = {
            t: S.topic(opts.topic || 'general'), topic: opts.topic || 'general', msg: opts.message || '', items: items, page: ctx && ctx.page || '',
            include: true, step: 'write', busy: false, err: '', confirm: false, enquiry: null, email: user.email || '', MAX: S.MAX
        };
        current = { promise: done.promise };

        scope.send = function () {
            var d = scope.d, text = (d.msg || '').trim();
            if (d.busy || d.step !== 'write') { return; }
            d.err = '';
            if (text.length < S.MIN) { d.err = text ? 'Tell us a little more — at least ' + S.MIN + ' characters.' : 'Write your question first.'; focusMsg(); return; }
            if (text.length > S.MAX) { d.err = 'That’s a bit long — please keep it under ' + S.MAX + ' characters.'; focusMsg(); return; }
            var context = d.include && ctx ? { source: ctx.source || '', page: ctx.page || '', items: items } : null;
            d.busy = true;
            return S.Create(d.topic, text, context, d.include && opts.clubId ? opts.clubId : null).then(function (data) {
                d.busy = false;
                if (data && data.success !== false && data.enquiry) {
                    d.enquiry = S.normEnquiry(data.enquiry);
                    d.step = 'sent'; d.confirm = false;
                    $rootScope.$broadcast('enq:created', d.enquiry);
                    $timeout(function () { var b = el && el[0].querySelector('.enq-ask__go'); if (b) { b.focus(); } }, 60);
                    return;
                }
                failed(data);
            });
        };
        function failed(data) {
            var code = data && data.error, msg = data && typeof data.message === 'string' ? data.message : '';
            var fields = data && data.fields ? (angular.isArray(data.fields) ? data.fields : Object.keys(data.fields)) : [];
            if (code === 'UNSUPPORTED_CHARACTERS') { scope.d.err = 'Emoji can’t be sent — please take them out and send again.'; focusMsg(); return; }   // the interceptor has toasted
            if (code === 'VALIDATION_ERROR' && fields.indexOf('message') > -1) { scope.d.err = msg || 'Check your question.'; ToastService.handledInline(); focusMsg(); return; }
            if (code === 'VALIDATION_ERROR' && (fields.indexOf('context') > -1 || fields.indexOf('club_id') > -1)) {
                scope.d.include = false;   // the page's details were refused: send without them
                ToastService.warning('We couldn’t attach the page details', 'Send it again without them — your text is still here.'); return;
            }
            if (code === 'RATE_LIMITED') { ToastService.warning('You’ve sent a lot of messages this hour', 'Please wait a little, then send it again — your text is still here.'); return; }
            if (code === 'FORBIDDEN') { ToastService.error('You can’t send questions from this account', msg || 'Please log in again.'); return; }
            ToastService.error('Your question wasn’t sent', (msg || 'Something went wrong.') + ' Your text is still here — try again.');
        }
        // closing: never throw away typed words without asking
        scope.close = function (force) {
            var d = scope.d;
            if (d.busy) { return; }
            if (!force && d.step === 'write' && (d.msg || '').trim() && !d.confirm) { d.confirm = true; $timeout(function () { var b = el && el[0].querySelector('.enq-ask__keep'); if (b) { b.focus(); } }, 30); return; }
            finish();
        };
        scope.keep = function () { scope.d.confirm = false; focusMsg(); };
        scope.scrim = function (ev) { if (ev.target === ev.currentTarget) { scope.close(); } };
        scope.goThread = function () {
            var e = scope.d.enquiry; finish();
            if (e && e.id != null) { $state.go('dashboard.v2.enquiries.thread', { enquiry_id: e.id }); }
        };
        scope.left = function () { var n = (scope.d.msg || '').length; return n > S.MAX - 500 ? S.MAX - n : null; };

        function onKey(ev) {
            if (ev.key === 'Escape' || ev.key === 'Esc') { scope.$apply(function () { if (scope.d.confirm) { scope.keep(); } else { scope.close(); } }); }
        }
        function focusMsg() { $timeout(function () { var t = el && el[0].querySelector('#enq-ask-msg'); if (t) { t.focus(); } }, 30); }
        function finish() {
            $document.off('keydown', onKey);
            var result = scope.d.step === 'sent' ? scope.d.enquiry : null;
            if (el) { el.remove(); }
            scope.$destroy(); current = null;
            if (back && back.focus && document.body.contains(back)) { try { back.focus(); } catch (e) {} }
            done.resolve(result);
        }

        $templateRequest('views/v2/enquiries/_ask.html').then(function (tpl) {
            if (!current) { return; }
            el = $compile(String(tpl).replace(/<!--[\s\S]*?-->/g, '').trim())(scope);   // one root element (the scrim)
            angular.element(document.body).append(el);
            $document.on('keydown', onKey);
            focusMsg();
        }, function () { current = null; ToastService.error('Couldn’t open the question form', 'Please reload the page and try again.'); done.resolve(null); });
        return done.promise;
    }
}

/* <enq-ask topic context label icon btn-class on-sent> — the trigger button; the dialog is EnquiryAsk */
app.directive('enqAsk', ['EnquiryAsk', function (EnquiryAsk) {
    return {
        restrict: 'E',
        scope: { topic: '@', context: '=?', clubId: '=?', label: '@', icon: '@', btnClass: '@', onSent: '&' },
        template: '<button type="button" class="{{ btnClass || \'ta-btn\' }}" ng-click="ask()" no-busy-guard><i class="fas {{ icon || \'fa-comment\' }}" aria-hidden="true"></i>{{ label || \'Ask us\' }}</button>',
        link: function (scope) {
            scope.ask = function () {
                EnquiryAsk.open({ topic: scope.topic || 'general', context: scope.context, clubId: scope.clubId || null }).then(function (enquiry) {
                    if (enquiry) { scope.onSent({ enquiry: enquiry }); }
                });
            };
        }
    };
}]);

/* ═════ the member page: your questions (list) — the thread is the child state below ═════ */
app.controller('EnquiriesV2Controller', EnquiriesV2Controller);
EnquiriesV2Controller.$inject = ['SalesEnquiryService', 'EnquiryAsk', 'EnqFmt', '$scope', '$state', '$stateParams'];
function EnquiriesV2Controller(SalesEnquiryService, EnquiryAsk, EnqFmt, $scope, $state, $stateParams) {
    var vm = this, S = SalesEnquiryService;
    vm.S = S; vm.Fmt = EnqFmt;
    vm.loading = true; vm.loadError = false; vm.list = [];
    vm.openId = null;

    function syncOpen() { vm.openId = $state.includes('dashboard.v2.enquiries.thread') ? String($state.params.enquiry_id) : null; }
    syncOpen();
    $scope.$on('$stateChangeSuccess', syncOpen);

    vm.load = function () {
        vm.loading = true; vm.loadError = false;
        return S.Mine().then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) { vm.loadError = true; return; }
            vm.list = (data.enquiries || []).map(row);
            sort();
        });
    };
    function row(e) {
        var x = e && e.ctxLine !== undefined ? e : S.normEnquiry(e);
        x._t = S.topic(x.topic); x._s = S.status(x.status);
        x._when = EnqFmt.short(x.last); x._whenLong = EnqFmt.when(x.last, true);
        x._sub = x.count > 1 ? (x.lastStaff ? 'ToAviate: ' : 'You: ') + (x.lastBody || x.preview) : '';
        x._n = x.count + (x.count === 1 ? ' message' : ' messages');
        return x;
    }
    function sort() { vm.list.sort(function (a, b) { return String(b.last).localeCompare(String(a.last)); }); vm.counts(); }
    vm.counts = function () { vm.nAnswered = vm.list.filter(function (x) { return x.status === 'answered'; }).length; };
    vm.load();

    vm.rowClick = function (x) { if (vm.openId === String(x.id)) { $scope.$broadcast('enq:reopen', x.id); } };
    vm.ask = function () {
        EnquiryAsk.open({ topic: 'general', context: { source: 'questions', page: 'Your questions', items: [] } });
    };
    // a question sent from anywhere (this page's button, or a dialog opened before) joins the list at once
    $scope.$on('enq:created', function (ev, e) {
        if (!e || vm.list.some(function (x) { return String(x.id) === String(e.id); })) { return; }
        vm.list.push(row(e)); sort();
    });
    // the thread changed (a reply sent, or a fresher status read): the row follows
    $scope.$on('enq:changed', function (ev, e) {
        var i = -1;
        vm.list.forEach(function (x, j) { if (String(x.id) === String(e.id)) { i = j; } });
        if (e.messages.length) { e.lastBody = e.messages[e.messages.length - 1].body; }
        if (i < 0) { vm.list.push(row(e)); } else { vm.list[i] = row(e); }
        sort();
    });
}

/* ═════ one question: the thread + the reply box ═════ */
app.controller('EnquiryThreadV2Controller', EnquiryThreadV2Controller);
EnquiryThreadV2Controller.$inject = ['SalesEnquiryService', 'EnquiryAsk', 'EnqFmt', 'ToastService', '$scope', '$stateParams', '$timeout', '$window'];
function EnquiryThreadV2Controller(SalesEnquiryService, EnquiryAsk, EnqFmt, ToastService, $scope, $stateParams, $timeout, $window) {
    var th = this, S = SalesEnquiryService, id = $stateParams.enquiry_id;
    th.S = S; th.Fmt = EnqFmt;
    th.loading = true; th.err = null; th.e = null; th.reply = ''; th.rerr = ''; th.sending = false;
    th.mac = /Mac|iPhone|iPad|iPod/i.test(($window.navigator && ($window.navigator.platform || $window.navigator.userAgent)) || '');   // the hint says ⌘ + Enter on a Mac

    th.load = function () {
        th.loading = true; th.err = null;
        return S.Get(id).then(function (data) {
            th.loading = false;
            if (!data || data.success === false || !data.enquiry) {
                th.err = (data && (data.error === 'NOT_FOUND' || data.error === 'FORBIDDEN' || data.status === 404 || data.status === 403)) ? 'missing' : 'load';
                return;
            }
            set(S.normEnquiry(data.enquiry), true);
        });
    };
    function set(e, scroll) {
        th.e = e;
        th.t = S.topic(e.topic); th.st = S.status(e.status);
        th.days = groupDays(e.messages);
        $scope.$emit('enq:changed', e);
        if (scroll) { toEnd(); }
    }
    function groupDays(msgs) {
        var out = [], cur = null;
        msgs.forEach(function (m) {
            var day = m.at.slice(0, 10);
            if (!cur || cur.day !== day) { cur = { day: day, label: EnqFmt.dayLabel(m.at), msgs: [] }; out.push(cur); }
            m._time = m.at.slice(11, 16);
            cur.msgs.push(m);
        });
        return out;
    }
    // the newest message in view: the thread pane scrolls on desktop, the page on phones
    function toEnd() {
        $timeout(function () {
            var box = document.querySelector('.enq-th__msgs'), last = box && box.lastElementChild;
            if (!box) { return; }
            if (box.scrollHeight > box.clientHeight + 4) { box.scrollTop = box.scrollHeight; }
            else if (last && last.scrollIntoView && $window.innerWidth <= 768) { last.scrollIntoView({ block: 'end' }); }
        }, 60);
    }
    th.load();
    // the list's row for this question was clicked again (same state, so no transition): retry when it didn't load
    $scope.$on('enq:reopen', function (ev, rid) { if (String(rid) === String(id) && th.err && !th.loading) { th.load(); } });

    th.left = function () { var n = (th.reply || '').length; return n > S.MAX - 500 ? S.MAX - n : null; };
    th.key = function (ev) { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); th.send(); } };
    th.send = function () {
        var text = (th.reply || '').trim();
        if (th.sending || !th.e || th.e.status === 'closed') { return; }
        th.rerr = '';
        if (text.length < 2) { th.rerr = 'Write your reply first.'; focusReply(); return; }
        if (text.length > S.MAX) { th.rerr = 'That’s a bit long — please keep it under ' + S.MAX + ' characters.'; focusReply(); return; }
        th.sending = true;
        return S.Reply(th.e.id, text).then(function (data) {
            th.sending = false;
            if (!data || data.success === false) {
                if (data && data.error === 'UNSUPPORTED_CHARACTERS') { th.rerr = 'Emoji can’t be sent — please take them out and send again.'; focusReply(); return; }
                if (data && data.error === 'VALIDATION_ERROR') { th.rerr = data.message || 'Check your reply.'; ToastService.handledInline(); focusReply(); return; }
                if (data && data.error === 'NOT_FOUND') { ToastService.error('This question isn’t there any more', 'Go back to your questions and try again.'); return; }
                if (data && (data.error === 'ENQUIRY_CLOSED' || data.error === 'CLOSED')) {
                    ToastService.warning('This question was closed', 'Your reply wasn’t sent — you can send it as a new question.');
                    th.unsent = text; th.reply = '';
                    th.e.status = 'closed'; set(th.e, false); return;
                }
                if (data && data.error === 'RATE_LIMITED') { ToastService.warning('You’ve sent a lot of messages this hour', 'Please wait a little, then send it again — your reply is still here.'); return; }
                ToastService.error('Your reply wasn’t sent', ((data && typeof data.message === 'string' && data.message) || 'Something went wrong.') + ' Your text is still here — try again.');
                return;
            }
            th.reply = '';
            if (data.enquiry && data.enquiry.messages) { set(S.normEnquiry(data.enquiry), true); ToastService.success('Reply sent', 'We’ll answer by email and here.'); return; }
            var e = th.e;
            e.messages.push(S.normMessage(data.message || { body: text, from: 'member', created_at: nowStamp() }));
            if (data.enquiry && data.enquiry.status) { e.status = data.enquiry.status; } else if (e.status === 'answered') { e.status = 'open'; }
            e.last = e.messages[e.messages.length - 1].at; e.lastStaff = false; e.count = e.messages.length;
            set(e, true);
            ToastService.success('Reply sent', 'We’ll answer by email and here.');
        });
    };
    // a closed question: ask a new one on the same topic (an unsent reply comes along)
    th.askNew = function () {
        EnquiryAsk.open({ topic: th.e ? th.e.topic : 'general', message: th.unsent || '', context: th.e && th.e.context && th.e.context.page ? th.e.context : null }).then(function (e) { if (e) { th.unsent = ''; } });
    };
    function focusReply() { $timeout(function () { var t = document.getElementById('enq-reply'); if (t) { t.focus(); } }, 30); }
    function nowStamp() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
}
