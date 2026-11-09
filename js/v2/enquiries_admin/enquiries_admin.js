/* ═══════════════════════════════════════════════════════════════════════════
   ToAviate admin: sales enquiries inbox — "Ask us" questions members send to ToAviate sales (owner, 9 Nov 2026).
   The member side (the dialog + the member's thread page) is js/v2/enquiries/ — this file only talks to the API.

   State  dashboard.super_admin.sales_enquiries   /super_admin/sales_enquiries?id&status&q
          (a child of the super-admin hub, whose controller already keeps non-staff out; data.v2Design gives the v2
          ground + shell; no v1 twin, so not mapped). The opened thread and the filters live in the query string,
          kept in sync with $location.search(…).replace() and reloadOnSearch:false (no history entries, no reload).
   API    (be-alex-3e.md contract C19 — ToAviate staff only)
          GET  sales_enquiries?status=&q=&page=&per_page=   list + counts
          GET  sales_enquiries/{id}                          the thread
          POST sales_enquiries/{id}/messages {message}       staff reply → e-mails the member; status → answered
                                                             ("Send & close" = the reply, then PUT closed)
          PUT  sales_enquiries/{id} {status}                 open | answered | closed
          SalesEnquiriesAdminData reads the responses tolerantly (normalise*) so field-name details of C19 stay in one place.
   Also: <enqa-open-badge> — the open count on the super-admin hub's tile (views/super_admin.html).
   Page CSS: css/v2/enquiries_admin.css (.enqa-*), on ta-base.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', function ($stateProvider) {
    $stateProvider.state('dashboard.super_admin.sales_enquiries', {
        url: '/sales_enquiries?id&status&q',
        templateUrl: 'views/v2/enquiries_admin/inbox.html',
        controller: 'SalesEnquiriesAdminController', controllerAs: 'vm',
        reloadOnSearch: false,
        data: { v2Design: true }
    });
}]);


// ═══════════════════════════════════════════════════════════════════════
// SalesEnquiriesAdminData — the four calls + the words (one helper per domain)
// ═══════════════════════════════════════════════════════════════════════
app.factory('SalesEnquiriesAdminData', SalesEnquiriesAdminData);
SalesEnquiriesAdminData.$inject = ['$http', '$location'];
function SalesEnquiriesAdminData($http, $location) {
    var STATUS = {
        open: { tone: 'warn', label: 'Open', icon: 'fa-inbox' },
        answered: { tone: 'good', label: 'Answered', icon: 'fa-reply' },
        closed: { tone: 'muted', label: 'Closed', icon: 'fa-archive' }
    };
    // where an "Ask us" dialog was opened (context.source) in words, for when the dialog sent no page name
    var SOURCES = { home: 'My Account home', questions: 'Your questions', claim_a_flight: 'Claim a flight', trackers: 'Trackers',
        tracker_shop: 'Tracker shop', logbook: 'My logbook', bookout: 'Book out' };
    var CONTEXT_LABELS = { page: 'Page', page_title: 'Page', url: 'Address', path: 'Address', club: 'Club', club_name: 'Club', aircraft: 'Aircraft',
        registration: 'Aircraft', plane: 'Aircraft', screen: 'Screen', feature: 'Feature', plan: 'Plan', product: 'Product' };
    var service = {};
    service.List = List;
    service.Get = Get;
    service.Reply = Reply;
    service.SetStatus = SetStatus;
    service.status = function (s) { return STATUS[s] || STATUS.open; };
    service.statuses = ['open', 'answered', 'closed'];
    service.normalise = normalise;
    service.message = message;
    service.contextRows = contextRows;
    service.topicWord = topicWord;
    service.age = age;
    service.when = when;
    return service;

    function List(params) {
        var q = [];
        angular.forEach(params || {}, function (v, k) { if (v !== null && v !== undefined && v !== '') { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); } });
        return $http.get('/api/v1/sales_enquiries' + (q.length ? '?' + q.join('&') : '')).then(handleSuccess, handleError2);
    }
    function Get(id) { return $http.get('/api/v1/sales_enquiries/' + id).then(handleSuccess, handleError2); }
    function Reply(id, body) { return $http.post('/api/v1/sales_enquiries/' + id + '/messages', { message: body }).then(handleSuccess, handleError2); }
    function SetStatus(id, status) { return $http.put('/api/v1/sales_enquiries/' + id, { status: status }).then(handleSuccess, handleError2); }

    // ── reading C19 tolerantly ──
    function name(o) {
        if (!o) { return ''; }
        if (o.name) { return o.name; }
        return [o.first_name, o.last_name].filter(Boolean).join(' ');
    }
    function obj(v) { if (!v) { return null; } if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return { page: v }; } } return v; }
    function normalise(e) {
        if (!e) { return null; }
        var member = e.member || e.user || {};
        var club = e.club || {};
        var msgs = angular.isArray(e.messages) ? e.messages.map(message) : null;
        var last = e.last_message ? message(e.last_message) : (msgs && msgs.length ? msgs[msgs.length - 1] : null);
        // list rows: first_message is the question's opening words (a STRING, 140 characters); threads: messages[0]
        var first = msgs && msgs.length ? msgs[0]
            : (typeof e.first_message === 'string' ? { id: null, from: 'member', author: '', body: e.first_message, at: e.created_at || '', emailed: null }
            : (e.first_message ? message(e.first_message) : null));
        var status = STATUS[e.status] ? e.status : 'open';
        var out = {
            id: parseInt(e.id, 10),
            status: status,
            topic: e.topic || e.subject || '',
            member: { id: parseInt(member.id || e.user_id, 10) || 0, name: name(member) || e.member_name || e.name || 'A member', email: member.email || e.member_email || e.email || '' },
            club: (club.name || e.club_name || e.club_title) ? { id: parseInt(club.id || e.club_id, 10) || 0, name: club.name || e.club_name || e.club_title } : null,
            context: obj(e.context),
            first: first, last: last, messages: msgs,
            count: parseInt(e.message_count || e.messages_count || (msgs ? msgs.length : 0), 10) || 0,
            created_at: e.created_at || (first && first.at) || '',
            updated_at: e.updated_at || e.last_message_at || (last && last.at) || e.created_at || ''
        };
        // waiting on ToAviate: the backend's flag, else the member spoke last on an enquiry that isn't closed
        // C19 sends awaiting_member (the last message is from staff) on list rows
        out.needs_reply = (e.needs_reply !== undefined && e.needs_reply !== null) ? !!(+e.needs_reply)
            : (e.awaiting_member !== undefined && e.awaiting_member !== null) ? (status !== 'closed' && !(+e.awaiting_member))
            : (status !== 'closed' && (!last || last.from === 'member'));
        out.unread = (e.unread !== undefined && e.unread !== null) ? !!(+e.unread) : out.needs_reply;
        return out;
    }
    function message(m) {
        var staff = +m.from_staff === 1 || m.from_staff === true || m.from === 'staff' || m.author_type === 'staff' || +m.is_staff === 1;
        return {
            id: m.id,
            from: staff ? 'staff' : 'member',
            author: m.author_name || name(m.author) || (staff ? 'ToAviate' : ''),
            body: m.body || m.message || m.text || '',
            at: m.created_at || m.at || '',
            // C31: emailed_at = when the member's e-mail went out; "· e-mailed" is shown only once it's set
            emailed: m.emailed_at !== undefined ? !!m.emailed_at : (m.emailed === undefined ? null : !!(+m.emailed)),
            emailed_at: m.emailed_at || ''
        };
    }
    function topicWord(t) {
        t = String(t || '').replace(/_/g, ' ').trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'General question';
    }
    function contextRows(ctx) {
        var rows = [];
        if (!ctx || typeof ctx !== 'object') { return rows; }
        var has = function (label) { return rows.some(function (r) { return r.k === label; }); };
        // the page it was asked from: the dialog's page name, else its source in words (never the raw slug)
        var src = typeof ctx.source === 'string' ? ctx.source.trim() : '';
        var page = typeof ctx.page === 'string' && ctx.page.trim() ? ctx.page.trim() : (src ? (SOURCES[src] || topicWord(src)) : '');
        if (page) { rows.push({ k: 'Page', v: /^[a-z0-9_]+$/.test(page) ? topicWord(page) : page }); }
        // the details the member agreed to share: items [{k, v}] as they were shown in the dialog
        if (angular.isArray(ctx.items)) {
            ctx.items.forEach(function (i) {
                if (!i || typeof i !== 'object' || i.v === null || i.v === undefined || i.v === '' || typeof i.v === 'object') { return; }
                var label = String(i.k || '').trim() || 'Detail';
                if (!has(label)) { rows.push({ k: label, v: String(i.v) }); }
            });
        }
        angular.forEach(ctx, function (v, k) {
            if (k === 'source' || k === 'page' || k === 'items') { return; }
            if (v === null || v === undefined || v === '' || typeof v === 'object') { return; }
            var label = CONTEXT_LABELS[k] || topicWord(k);
            if (has(label)) { return; }
            v = String(v);
            // a page slug ("claim_a_flight") reads as words; registrations / addresses stay as they are
            if ((k === 'page' || k === 'screen' || k === 'feature') && /^[a-z0-9_]+$/.test(v)) { v = topicWord(v); }
            rows.push({ k: label, v: v });
        });
        return rows;
    }
    function parse(s) { return s ? moment(String(s).slice(0, 19).replace('T', ' '), 'YYYY-MM-DD HH:mm:ss') : moment.invalid(); }
    // "now", "12 min", "3 h", "2 d", then "4 Nov"
    function age(s) {
        var m = parse(s); if (!m.isValid()) { return ''; }
        var min = moment().diff(m, 'minutes');
        if (min < 1) { return 'now'; }
        if (min < 60) { return min + ' min'; }
        if (min < 24 * 60) { return Math.floor(min / 60) + ' h'; }
        if (min < 7 * 24 * 60) { return Math.floor(min / 1440) + ' d'; }
        return m.format('D MMM');
    }
    function when(s) { var m = parse(s); return m.isValid() ? m.format('ddd D MMM YYYY, HH:mm') : ''; }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data;
        if (d && typeof d === 'object' && d.error) { return { success: false, error: d.error, message: d.message || d, status: res.status }; }
        return { success: false, message: d, status: res.status };
    }
}


// ═══════════════════════════════════════════════════════════════════════
// The inbox: list (filters, search, paging) + the opened thread (context, messages, reply, status)
// ═══════════════════════════════════════════════════════════════════════
app.controller('SalesEnquiriesAdminController', SalesEnquiriesAdminController);
SalesEnquiriesAdminController.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$location', '$timeout', 'SalesEnquiriesAdminData', 'ToastService'];
function SalesEnquiriesAdminController($rootScope, $scope, $state, $stateParams, $location, $timeout, SalesEnquiriesAdminData, ToastService) {
    var vm = this;
    var D = vm.D = SalesEnquiriesAdminData;
    var PER_PAGE = 30;
    var seq = 0, tseq = 0, qTimer = null;
    var DRAFTS_KEY = 'toaviate_enqa_drafts';
    var drafts = readDrafts();          // id → typed reply: kept while you look at another enquiry, and over a refresh (sessionStorage)

    vm.user = $rootScope.globals.currentUser;
    vm.filter = ['open', 'answered', 'closed', 'all'].indexOf($stateParams.status) > -1 ? $stateParams.status : 'open';
    vm.q = $stateParams.q || '';
    vm.load = 'loading';                // loading | ready | error | denied
    vm.rows = [];
    vm.counts = { open: 0, answered: 0, closed: 0, total: 0 };
    vm.pagination = null;
    vm.selId = parseInt($stateParams.id, 10) || null;
    vm.t = null;                        // the opened enquiry (normalised, with messages)
    vm.tload = null;                    // loading | ready | error | missing
    vm.draft = { body: '' };
    vm.sending = false;
    vm.statusBusy = false;
    vm.err = null;                      // 'empty' when Send is pressed with nothing written

    vm.setFilter = function (f) { if (vm.filter === f) { return; } vm.filter = f; syncUrl(); fetch(false); };
    vm.onQ = function () { if (qTimer) { $timeout.cancel(qTimer); } qTimer = $timeout(function () { syncUrl(); fetch(false); }, 300); };
    vm.clearQ = function () { vm.q = ''; syncUrl(); fetch(false); };
    vm.reload = function () { fetch(false); };
    vm.more = function () { if (vm.pagination && vm.pagination.has_more && !vm.moreBusy) { fetch(true); } };
    vm.open = open;
    vm.closeThread = function () { keepDraft(); vm.selId = null; vm.t = null; vm.tload = null; syncUrl(); };
    vm.retryThread = function () { if (vm.selId) { loadThread(vm.selId); } };
    vm.send = send;
    vm.setStatus = setStatus;
    vm.status = D.status;
    vm.topic = D.topicWord;
    vm.age = D.age;
    vm.when = D.when;
    vm.backToHub = function () { $state.go('dashboard.super_admin'); };
    vm.mailto = function () { return vm.t && vm.t.member.email ? 'mailto:' + vm.t.member.email : ''; };
    vm.keyReply = function (e) {
        // Ctrl / ⌘ + Enter sends (Enter alone is a new line in a reply)
        if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(false); }
    };

    fetch(false);
    if (vm.selId) { vm.draft = { body: drafts[vm.selId] || '' }; loadThread(vm.selId); }

    function syncUrl() {
        $location.search('id', vm.selId || null).search('status', vm.filter === 'open' ? null : vm.filter).search('q', vm.q ? vm.q : null).replace();
    }

    function fetch(append) {
        var my = ++seq;
        var page = append && vm.pagination ? vm.pagination.page + 1 : 1;
        if (append) { vm.moreBusy = true; } else if (vm.load !== 'ready') { vm.load = 'loading'; } else { vm.refreshing = true; }
        return D.List({ status: vm.filter, q: (vm.q || '').trim(), page: page, per_page: PER_PAGE }).then(function (data) {
            if (my !== seq) { return; }
            vm.moreBusy = false; vm.refreshing = false;
            if (!data || !data.success) {
                if (!append) { vm.load = data && (data.error === 'FORBIDDEN' || data.status === 403) ? 'denied' : 'error'; }
                else { ToastService.error('Couldn\'t load more', 'Try again in a moment.'); }
                return;
            }
            var rows = (data.enquiries || data.items || data.rows || []).map(D.normalise).filter(Boolean);
            vm.rows = append ? vm.rows.concat(rows.filter(function (r) { return !vm.rows.some(function (x) { return x.id === r.id; }); })) : rows;
            var p = data.pagination || data;
            var total = +p.total || vm.rows.length, per = +p.per_page || PER_PAGE, pg = +p.page || page;
            vm.pagination = { page: pg, total: total, has_more: p.has_more !== undefined ? !!p.has_more : pg * per < total };
            if (data.counts) {
                var c = data.counts;
                vm.counts = { open: +c.open || 0, answered: +c.answered || 0, closed: +c.closed || 0 };
                vm.counts.total = +c.total || (vm.counts.open + vm.counts.answered + vm.counts.closed);
            } else if (!append) { readCounts(vm.filter, total); }
            vm.load = 'ready';
            // desktop: with nothing opened, open the first row so the split view isn't empty
            if (!vm.selId && vm.rows.length && isDesktop()) { open(vm.rows[0], true); }
        });
    }
    // C19's list has no per-status counts: read each status's total (cheap; refreshed after every change)
    var cseq = 0;
    function readCounts(current, currentTotal) {
        var my = ++cseq, got = {};
        if (current !== 'all') { got[current] = currentTotal; }
        var want = D.statuses.filter(function (s) { return got[s] === undefined; });
        var done = function () {
            if (my !== cseq) { return; }
            vm.counts = { open: got.open || 0, answered: got.answered || 0, closed: got.closed || 0 };
            vm.counts.total = vm.counts.open + vm.counts.answered + vm.counts.closed;
        };
        if (!want.length) { done(); return; }
        var left = want.length;
        want.forEach(function (s) {
            D.List({ status: s, page: 1, per_page: 1 }).then(function (d) {
                got[s] = d && d.success ? (+((d.pagination || d).total) || 0) : (vm.counts[s] || 0);
                if (--left === 0) { done(); }
            });
        });
    }
    function isDesktop() { return window.matchMedia ? window.matchMedia('(min-width: 900px)').matches : true; }

    function keepDraft() { if (vm.selId) { drafts[vm.selId] = vm.draft.body; saveDrafts(); } }
    function readDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFTS_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function saveDrafts() {
        try { var o = {}; angular.forEach(drafts, function (v, k) { if (v && String(v).trim()) { o[k] = v; } }); sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
    }
    function open(row, auto) {
        if (!row) { return; }
        if (vm.selId === row.id && vm.t) { return; }
        keepDraft();
        vm.selId = row.id;
        vm.draft = { body: drafts[row.id] || '' };
        vm.err = null;
        if (!auto) { syncUrl(); } else { $location.search('id', vm.selId).replace(); }
        loadThread(row.id, row);
    }
    function loadThread(id, row) {
        var my = ++tseq;
        vm.tload = 'loading';
        vm.t = row ? angular.extend({}, row, { messages: null }) : null;
        return D.Get(id).then(function (data) {
            if (my !== tseq) { return; }
            if (!data || !data.success) {
                vm.tload = data && (data.error === 'NOT_FOUND' || data.status === 404) ? 'missing' : 'error';
                return;
            }
            vm.t = D.normalise(data.enquiry || data.item || data);
            vm.ctxRows = D.contextRows(vm.t.context);       // computed once: a fresh array per digest would loop ng-repeat
            vm.tload = 'ready';
            patchRow(vm.t);
            scrollThread();
        });
    }
    function patchRow(t) {
        vm.rows.forEach(function (r, i) {
            if (r.id === t.id) {
                vm.rows[i] = angular.extend({}, r, { status: t.status, needs_reply: t.needs_reply, unread: false, last: t.last || r.last, updated_at: t.updated_at || r.updated_at, count: t.count || r.count });
            }
        });
    }
    function scrollThread() {
        $timeout(function () { var el = document.getElementById('enqa-msgs'); if (el) { el.scrollTop = el.scrollHeight; } }, 50);
    }

    function send(close) {
        var t = vm.t, body = String(vm.draft.body || '').trim();
        if (!t || vm.sending) { return; }
        if (!body) {
            vm.err = 'empty';
            $timeout(function () { var el = document.getElementById('enqa-reply'); if (el) { el.focus(); } });
            return;
        }
        vm.err = null;
        vm.sending = true;
        var id = t.id;
        D.Reply(id, body).then(function (data) {
            vm.sending = false;
            if (!data || !data.success) {
                ToastService.error('Reply not sent', (data && data.error === 'VALIDATION_ERROR' ? 'Replies are 1 to 5,000 characters. ' : '') + (textOf(data && data.message) || 'Nothing was sent to the member — your text is still here, try again.'));
                return;
            }
            drafts[id] = ''; saveDrafts();
            if (vm.t && vm.t.id === id) {
                vm.draft = { body: '' };
                var updated = data.enquiry ? D.normalise(data.enquiry) : null;
                if (updated && updated.messages) { vm.t = updated; vm.ctxRows = D.contextRows(updated.context); }
                else {
                    var msg = data.message && typeof data.message === 'object' ? D.message(data.message) : { id: 'new' + Date.now(), from: 'staff', author: [vm.user.first_name, vm.user.last_name].join(' '), body: body, at: moment().format('YYYY-MM-DD HH:mm:ss') };
                    vm.t.messages = (vm.t.messages || []).concat([msg]);
                    vm.t.last = msg;
                    vm.t.status = updated ? updated.status : 'answered';      // a staff reply answers it; "Send & close" closes below
                    vm.t.needs_reply = false;
                }
                scrollThread();
            }
            var finish = function (closeRefused) {
                if (closeRefused) {
                    ToastService.warning('Reply sent — not closed', (t.member.name || 'The member') + ' gets it by e-mail, but the question couldn\'t be closed'
                        + (closeRefused !== true ? ': ' + closeRefused : '') + '. Close it from Status.');
                } else {
                    ToastService.success(close ? 'Reply sent and closed' : 'Reply sent', (t.member.name || 'The member') + ' gets it by e-mail.', { confetti: false });
                }
                if (vm.t && vm.t.id === id) { patchRow(vm.t); }
                fetch(false);      // counts + the row's place in the filtered list
            };
            // the backend closes with the reply (close:1); if it didn't, close it here
            if (close && vm.t && vm.t.id === id && vm.t.status !== 'closed') {
                D.SetStatus(id, 'closed').then(function (r) {
                    if (r && r.success) { if (vm.t && vm.t.id === id) { vm.t.status = 'closed'; } finish(); return; }
                    finish(textOf(r && r.message) || true);
                });
            } else { finish(); }
        });
    }

    function setStatus(s) {
        var t = vm.t;
        if (!t || t.status === s || vm.statusBusy) { return; }
        var before = t.status;
        vm.statusBusy = true;
        D.SetStatus(t.id, s).then(function (data) {
            vm.statusBusy = false;
            if (!data || !data.success) {
                ToastService.error('Status not changed', textOf(data && data.message) || 'Try again in a moment.');
                return;
            }
            if (vm.t && vm.t.id === t.id) {
                vm.t.status = data.enquiry && data.enquiry.status ? data.enquiry.status : s;
                vm.t.needs_reply = s === 'closed' ? false : vm.t.needs_reply;
                patchRow(vm.t);
            }
            ToastService.success('Marked as ' + D.status(s).label.toLowerCase(), before === 'closed' && s !== 'closed' ? 'It is back in the open list.' : '', { confetti: false });
            fetch(false);
        });
    }
    function textOf(m) {
        if (!m) { return ''; }
        if (typeof m === 'string') { return /<[a-z!\/]/i.test(m) || m.length > 300 ? '' : m; }   // an HTML error page is not a message
        return typeof m.message === 'string' ? textOf(m.message) : '';
    }

    // the typed reply survives leaving the page / a refresh
    $scope.$watch(function () { return vm.draft.body; }, function (n, o) { if (n !== o && vm.selId) { drafts[vm.selId] = n; saveDrafts(); } });
    $scope.$on('$destroy', function () { if (qTimer) { $timeout.cancel(qTimer); } });
}


// <enqa-open-badge> — the open-enquiries count on the super-admin hub tile (one cheap list call; nothing when 0 or on error)
app.directive('enqaOpenBadge', ['SalesEnquiriesAdminData', '$state', function (SalesEnquiriesAdminData, $state) {
    return {
        restrict: 'E',
        template: '<span class="sms-box-badge" ng-if="n > 0" title="{{ n }} open {{ n === 1 ? \'enquiry\' : \'enquiries\' }}">{{ n }}</span>',
        scope: {},
        link: function (scope) {
            scope.n = 0;
            // the hub's default content is linked for a moment even on a deep link into a child page: count on the hub only
            if ($state.current && $state.current.name && $state.current.name !== 'dashboard.super_admin') { return; }
            SalesEnquiriesAdminData.List({ status: 'open', per_page: 1 }).then(function (d) {
                if (d && d.success) { scope.n = +((d.counts && d.counts.open) || (d.pagination || d).total || 0); }
            });
        }
    };
}]);
