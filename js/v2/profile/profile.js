/* ═══════════════════════════════════════════════════════════════════════════
   v2 PROFILE — design: mockups/my-account/profile.html (approved 7 Nov 2026), built 8 Nov.
   My details hub (Profile · Security · Next of kin · Reminders) + Proof of ID (in the My documents hub)
   + Invite a pilot. Replaces, while the v2 switch is on (js/v2/core/design.js):
     dashboard.my_account.manage            → dashboard.v2.manage        (ProfileV2Controller)
     dashboard.my_account.nok (+ .add/.edit) → dashboard.v2.nok / nok_add / nok_edit (NokV2Controller)
     dashboard.my_account.poid (+ .add/.edit) → dashboard.v2.poid / poid_add / poid_edit (PoidV2Controller)
     dashboard.my_account.invite_pilot       → dashboard.v2.invite_pilot (InvitePilotV2Controller)
   Same server calls as v1 (UserService, NokService, PoidService, LogbookSignupService, AuthenticationService.Login3).
   Dates are sent as plain YYYY-MM-DD (backend contract C2, landed 8 Nov).
   Views: views/v2/profile/*.html · CSS: css/v2/profile.css (prefix pro-).
   Hidden until the backend has it: each club's check of a proof of ID (member_checks/v2/mine, B16).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.manage', {
            url: '/my_account/manage',
            templateUrl: 'views/v2/profile/profile.html',
            controller: 'ProfileV2Controller', controllerAs: 'vm'
        })
        .state('dashboard.v2.nok', {
            url: '/my_account/next_of_kin',
            templateUrl: 'views/v2/profile/nok.html',
            controller: 'NokV2Controller', controllerAs: 'vm',
            data: { action: 'list' }
        })
        .state('dashboard.v2.nok_add', {
            url: '/my_account/next_of_kin/add',
            templateUrl: 'views/v2/profile/nok_form.html',
            controller: 'NokV2Controller', controllerAs: 'vm',
            data: { action: 'add' }
        })
        .state('dashboard.v2.nok_edit', {
            url: '/my_account/next_of_kin/edit/:nok_id',
            templateUrl: 'views/v2/profile/nok_form.html',
            controller: 'NokV2Controller', controllerAs: 'vm',
            data: { action: 'edit' }
        })
        .state('dashboard.v2.poid', {
            url: '/my_account/proof_of_id',
            templateUrl: 'views/v2/profile/poid.html',
            controller: 'PoidV2Controller', controllerAs: 'vm',
            data: { action: 'list' }
        })
        .state('dashboard.v2.poid_add', {
            url: '/my_account/proof_of_id/add',
            templateUrl: 'views/v2/profile/poid_form.html',
            controller: 'PoidV2Controller', controllerAs: 'vm',
            data: { action: 'add' }
        })
        .state('dashboard.v2.poid_edit', {
            url: '/my_account/proof_of_id/edit/:poid_id',
            templateUrl: 'views/v2/profile/poid_form.html',
            controller: 'PoidV2Controller', controllerAs: 'vm',
            data: { action: 'edit' }
        })
        .state('dashboard.v2.invite_pilot', {
            url: '/my_account/invite_pilot',
            templateUrl: 'views/v2/profile/invite_pilot.html',
            controller: 'InvitePilotV2Controller', controllerAs: 'vm'
        });
    DesignRoutesProvider
        .map('dashboard.my_account.manage', 'dashboard.v2.manage')
        .map('dashboard.my_account.nok', 'dashboard.v2.nok')
        .map('dashboard.my_account.nok.add', 'dashboard.v2.nok_add')
        .map('dashboard.my_account.nok.edit', 'dashboard.v2.nok_edit')
        .map('dashboard.my_account.poid', 'dashboard.v2.poid')
        .map('dashboard.my_account.poid.add', 'dashboard.v2.poid_add')
        .map('dashboard.my_account.poid.edit', 'dashboard.v2.poid_edit')
        .map('dashboard.my_account.invite_pilot', 'dashboard.v2.invite_pilot');
}]);


/* ═══ ProfileV2Util — the helpers every people screen shares (dates, the proof-of-ID status helper, the
   password rules, copy-to-clipboard). Also used by js/v2/security and js/v2/licences. ═══ */
app.factory('ProfileV2Util', ProfileV2Util);
ProfileV2Util.$inject = ['$timeout', '$state', '$window', 'ToastService', 'DesignRoutes', 'DesignService'];
function ProfileV2Util($timeout, $state, $window, ToastService, DesignRoutes, DesignService) {
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var u = {};
    u.flash = null;          // { kind, id } — the card to flash once after a save (set by a form, read by its list)

    /* a stored date → 'YYYY-MM-DD' or '' (blank, null and the 0000-00-00 / 1970 placeholders read as "not set") */
    u.day = function (s) {
        if (!s) { return ''; }
        var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m || m[1] === '0000' || s === '1970-01-01') { return ''; }
        return m[1] + '-' + m[2] + '-' + m[3];
    };
    u.today = function () { return moment().format('YYYY-MM-DD'); };
    /* '4 Nov 2026' — never shifted by the device's timezone */
    u.fDate = function (s) {
        var d = u.day(s); if (!d) { return ''; }
        var p = d.split('-');
        return (+p[2]) + ' ' + MON[(+p[1]) - 1] + ' ' + p[0];
    };
    u.fTime = function (s) { var m = String(s || '').match(/\d{2}:\d{2}/); return m ? m[0] : ''; };
    u.daysBetween = function (a, b) {   /* b − a in whole days, both 'YYYY-MM-DD' */
        var x = u.day(a), y = u.day(b); if (!x || !y) { return null; }
        var pa = x.split('-'), pb = y.split('-');
        return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
    };
    u.daysLeft = function (d) { return u.daysBetween(u.today(), d); };
    u.ageOn = function (dob) {
        var b = u.day(dob); if (!b) { return null; }
        var t = u.today().split('-'), p = b.split('-'), a = (+t[0]) - (+p[0]);
        if ((+t[1]) < (+p[1]) || ((+t[1]) === (+p[1]) && (+t[2]) < (+p[2]))) { a--; }
        return a;
    };
    u.plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
    /* a server message fit to show a person (a short sentence), else the fallback — an HTML error page, an object or
       a JSON dump never reaches a toast */
    u.msg = function (data, fallback) {
        var m = data && data.message;
        if (typeof m === 'string') { m = m.trim(); }
        return (typeof m === 'string' && m && m.length <= 240 && m.indexOf('<') === -1 && m.charAt(0) !== '{' && m.charAt(0) !== '[') ? m : fallback;
    };
    u.digits = function (s) { return String(s || '').replace(/\D/g, '').length; };
    u.EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    /* the live password rules (the same five as the backend's check_user_password_strength) */
    u.PW_RULES = [
        { t: '8 or more characters', ok: function (p) { return p.length >= 8; } },
        { t: 'An uppercase letter', ok: function (p) { return /[A-Z]/.test(p); } },
        { t: 'A lowercase letter', ok: function (p) { return /[a-z]/.test(p); } },
        { t: 'A number', ok: function (p) { return /[0-9]/.test(p); } },
        { t: 'A symbol, like ! or #', ok: function (p) { return /[^A-Za-z0-9]/.test(p); } }
    ];
    u.pwOk = function (p) { p = p || ''; return u.PW_RULES.every(function (r) { return r.ok(p); }); };

    /* one status helper for proof of ID (guidelines §4.6): valid / expires soon (≤ 90 days) / expired */
    u.poidState = function (p) {
        var d = u.day(p && p.expiry_date); if (!d) { return 'none'; }
        var n = u.daysLeft(d);
        return n < 0 ? 'expired' : n <= 90 ? 'soon' : 'valid';
    };
    u.poidPill = function (p) {
        var s = u.poidState(p);
        if (s === 'expired') { return { tone: 'bad', label: 'Expired', icon: 'fa-times-circle' }; }
        if (s === 'soon') { return { tone: 'warn', label: 'Expires soon', icon: 'fa-exclamation-circle' }; }
        if (s === 'none') { return { tone: 'muted', label: 'No expiry date', icon: 'fa-calendar' }; }
        var ck = p._checks;   // each live club's check (member_checks/v2/mine), when known
        if (ck && ck.length) {
            return ck.every(function (c) { return c.verified; }) ? { tone: 'good', label: 'Checked by your clubs', icon: 'fa-check-circle' } : { tone: 'pend', label: 'Awaiting a check', icon: 'fa-hourglass-half' };
        }
        return { tone: 'good', label: 'Valid', icon: 'fa-check-circle' };
    };
    /* the sub-line of one club's check row: "Checked by Kate Ellis · 20 Mar 2026" / "Not checked yet" */
    u.checkLine = function (c, notYet) {
        if (!c.verified) { return notYet || 'Not checked yet'; }
        return 'Checked' + (c.by ? ' by ' + c.by : '') + (c.at ? ' · ' + u.fDate(c.at) : '');
    };
    u.poidIcon = function (title) { return /passport/i.test(title || '') ? 'fa-passport' : 'fa-id-card'; };

    /* copy text; done() runs inside a digest */
    u.copy = function (text, done) {
        function ok() { $timeout(done); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(ok, fallback);
        } else { fallback(); }
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            ok();
        }
    };
    u.focus = function (id, ms) {
        $timeout(function () {
            var el = document.getElementById(id);
            if (el) { try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); } }
        }, ms || 80);
    };
    u.scrollToError = function () {
        $timeout(function () {
            var el = document.querySelector('.ta-page .ta-field--error');
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        }, 60);
    };
    /* a random string for AuthenticationService.Login3 (the re-enter-your-password step for encrypted images) */
    u.sample = function (length) {
        var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r = '';
        for (var i = 0; i < length; i++) { r += c.charAt(Math.floor(Math.random() * c.length)); }
        return r;
    };
    /* Esc closes an in-page dialog: attach once per controller, removed on $destroy */
    u.onEscape = function (scope, fn) {
        function key(e) { if (e.key === 'Escape' || e.keyCode === 27) { scope.$apply(fn); } }
        document.addEventListener('keydown', key);
        scope.$on('$destroy', function () { document.removeEventListener('keydown', key); });
    };
    /* the upload.php response of an ng-flow file → its staged path (temp/…) */
    u.flowPath = function (file) {
        try { var j0 = JSON.parse(file.file_return); return (j0.success === false) ? null : (j0.saved_url || null); } catch (e) { return null; }
    };
    /* A PDF (12 Nov 2026: licences, medicals, proof of ID): upload.php turns every page into its own staged JPEG and
       answers "pages" — one scan per page. An image has just its saved_url. */
    u.flowPaths = function (file) {
        try {
            var j = JSON.parse(file.file_return);
            if (j.success === false) { return []; }
            if (angular.isArray(j.pages) && j.pages.length) { return j.pages.slice(); }
            return j.saved_url ? [j.saved_url] : [];
        } catch (e) { return []; }
    };
    u.isPdf = function (file) { return String((file && file.getExtension && file.getExtension()) || '').toLowerCase() === 'pdf'; };
    /* why upload.php refused a file ("That PDF has 30 pages — 12 at most…"), or '' */
    u.upWhy = function (file) {
        try { var j = JSON.parse(file.file_return); return ((j.success === false || !j.saved_url) && j.message) ? String(j.message) : ''; } catch (e) { return ''; }
    };
    /* the staged scans of a form's new files, a PDF's pages in order: [{temp_path, name}] */
    u.stagedImages = function (files) {
        var out = [];
        (files || []).forEach(function (f) {
            var paths = u.flowPaths(f);
            paths.forEach(function (p, i) { out.push({ temp_path: p, name: paths.length > 1 ? f.name + ' (page ' + (i + 1) + ')' : f.name }); });
        });
        return out;
    };
    /* how many scans the new files come to (a 3-page PDF is 3) */
    u.stagedCount = function (files) {
        return (files || []).reduce(function (n, f) { return n + Math.max(1, u.flowPaths(f).length); }, 0);
    };
    /* the line under a finished file: "3 pages, saved as images" for a PDF, else the caller's word */
    u.pdfLabel = function (f) { var n = u.flowPaths(f).length; return n + (n === 1 ? ' page' : ' pages') + ', saved as ' + (n === 1 ? 'an image' : 'images'); };
    /* one ng-flow file: 'up' while it uploads · 'ok' once upload.php handed back a staged path · 'bad' when the upload
       failed, or upload.php answered without a path (flow.js reports a failed file as 100% done, so progress alone
       left it "Uploading 100%" for ever and the form refused to save) */
    u.upState = function (f) {
        if (!f || f.error) { return 'bad'; }
        if (f.file_return !== undefined && f.file_return !== null) { return u.flowPath(f) ? 'ok' : 'bad'; }
        return 'up';
    };
    u.upBusy = function ($flow) { return !!($flow && $flow.files.some(function (f) { return u.upState(f) === 'up'; })); };
    u.upBad = function ($flow) { return !!($flow && $flow.files.some(function (f) { return u.upState(f) === 'bad'; })); };
    u.upPct = function (f) { return Math.round(Math.min(1, f.progress()) * 100); };
    u.upLabel = function (f, done) {
        var st = u.upState(f);
        if (st === 'bad') { return u.upWhy(f) || 'Upload failed — remove it and try again'; }
        if (st === 'up') { return (u.isPdf(f) && u.upPct(f) >= 100) ? 'Reading the pages…' : 'Uploading ' + u.upPct(f) + '%'; }
        return u.isPdf(f) ? u.pdfLabel(f) : done;
    };
    /* AuthenticationService.Login3 answers an HTTP failure (server down, 500) with this fixed error — that isn't a wrong password */
    u.loginDown = function (res) { return !!(res && res.error === 'Authentication failed. Please try again.'); };
    /* flow-file-added: images only — a refused file says why (once per pick, not once per file) */
    var lastRefused = 0;
    u.imageOnly = function (file) {
        var ok = !!{ png: 1, gif: 1, jpg: 1, jpeg: 1, heic: 1, heif: 1, webp: 1, bmp: 1 }[String(file.getExtension() || '').toLowerCase()];   // every image is stored as a JPEG (10 Nov 2026)
        if (!ok && Date.now() - lastRefused > 1500) {
            lastRefused = Date.now();
            ToastService.warning('That file wasn\'t added', '"' + file.name + '" isn\'t an image — use a JPG, PNG, HEIC or GIF.');
        }
        return ok;
    };
    /* flow-file-added for the forms that also take a PDF (licence, medical, proof of ID): the flow sends pdf=1 */
    u.docOnly = function (file) {
        var ok = !!{ png: 1, gif: 1, jpg: 1, jpeg: 1, heic: 1, heif: 1, webp: 1, bmp: 1, pdf: 1 }[String(file.getExtension() || '').toLowerCase()];
        if (!ok && Date.now() - lastRefused > 1500) {
            lastRefused = Date.now();
            ToastService.warning('That file wasn\'t added', '"' + file.name + '" isn\'t a photo or a PDF — use a JPG, PNG, HEIC or PDF.');
        }
        return ok;
    };
    /* flow-file-success: a file upload.php refused says why at once (a PDF with too many pages, a locked PDF …) */
    u.upDone = function (file) {
        var why = u.upWhy(file);
        if (why) { ToastService.error('"' + file.name + '" wasn\'t added', why); }
    };
    /* flow-file-error */
    u.upFailed = function (file) {
        ToastService.error('Upload failed', '"' + (file && file.name) + '" didn\'t upload — remove it and try again.');
    };

    /* go to a page by its v1 state name, straight to its v2 state while the v2 switch is on. Going through the
       v1 name made the design redirect (js/v2/core/design.js) re-go with location:'replace', which overwrote the
       page you were on in the browser history — Back then skipped it. */
    u.go = function (name, params, opts) {
        var v2 = DesignService.isV2() ? DesignRoutes.v2For(name) : null;
        return $state.go(v2 || name, params || {}, opts);
    };
    /* "You have unsaved changes": a form page asks before its typed text is thrown away — on any navigation
       (tabs, the site menu, browser back, switching design) and on Cancel. isDirty() says whether there is anything
       to lose; vm.leaveOk = true lets a successful save leave without asking. Renders views/v2/profile/_leave_dlg.html. */
    u.guardLeave = function (scope, vm, isDirty) {
        vm.leave = null;
        vm.leaveOk = false;
        function dirty() { try { return !vm.leaveOk && !!isDirty(); } catch (e) { return false; } }
        scope.$on('$stateChangeStart', function (e, to, params) {
            if (e.defaultPrevented || !dirty()) { return; }
            e.preventDefault();
            vm.leave = { to: to.name, params: angular.copy(params) };
        });
        vm.keepEditing = function () { vm.leave = null; };
        vm.discard = function () {
            var l = vm.leave;
            vm.leave = null;
            if (!l) { return; }
            if (l.to) { vm.leaveOk = true; $state.go(l.to, l.params); }
            else if (l.fn) { l.fn(); }
        };
        vm.askDiscard = function (fn) { if (dirty()) { vm.leave = { fn: fn }; } else { fn(); } };
        vm.leaveScrim = function ($event) { if ($event.target === $event.currentTarget) { vm.keepEditing(); } };
        function unload(e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; return ''; } }
        $window.addEventListener('beforeunload', unload);
        function key(e) { if (vm.leave && (e.key === 'Escape' || e.keyCode === 27)) { scope.$apply(vm.keepEditing); } }
        document.addEventListener('keydown', key);
        scope.$on('$destroy', function () { $window.removeEventListener('beforeunload', unload); document.removeEventListener('keydown', key); });
    };
    /* a stable fingerprint of the fields a form edits (trimmed strings; '' for empty) */
    u.snap = function (o, keys) {
        var out = {};
        (keys || Object.keys(o || {})).forEach(function (k) {
            var v = o ? o[k] : null;
            if (v === null || v === undefined) { v = ''; }
            out[k] = typeof v === 'string' ? v.trim() : v;
        });
        return angular.toJson(out);
    };
    return u;
}


/* ═══ Profile (My details → Profile) ═══ */
app.controller('ProfileV2Controller', ProfileV2Controller);
ProfileV2Controller.$inject = ['$rootScope', '$scope', '$q', '$state', '$window', 'UserService', 'NokService', 'PoidService', 'ToastService', 'ProfileV2Util'];
function ProfileV2Controller($rootScope, $scope, $q, $state, $window, UserService, NokService, PoidService, ToastService, U) {
    var vm = this;
    vm.me = $rootScope.globals.currentUser;
    vm.U = U;
    vm.clubMember = !!(vm.me.access && vm.me.access.show_booking);
    vm.loading = true;
    vm.loadError = false;
    vm.user = null;
    vm.noks = [];
    vm.poids = [];
    vm.edit = false;
    vm.draft = null;
    vm.errs = {};
    vm.dlg = null;              // 'confirm' | 'pw'
    vm.saving = false;
    vm.dobOptions = { max: U.today(), shortcuts: false, dots: false, value: '1990-01-01' };
    vm.rules = U.PW_RULES;

    vm.reload = load;
    vm.todoList = [];        // computed once per load (an ng-repeat over a function that builds new objects never settles)
    vm.openList = [];
    vm.isNew = function () { return vm.user && !U.day(vm.user.dob) && !vm.user.address_line1; };
    vm.addrLines = addrLines;
    vm.hasCaa = function () { return !!vm.user && Object.prototype.hasOwnProperty.call(vm.user, 'caa_reference_number'); };
    vm.startEdit = startEdit;
    vm.cancelEdit = cancelEdit;
    vm.todoGo = todoGo;
    vm.applyAddress = applyAddress;
    vm.clearErr = function (k) { if (vm.errs[k]) { delete vm.errs[k]; } };
    vm.photoFiles = photoFiles;
    vm.saveAsk = saveAsk;
    vm.saveDo = saveDo;
    vm.openPw = openPw;
    vm.pwSave = pwSave;
    vm.close = close;
    vm.scrim = function ($event) { if ($event.target === $event.currentTarget) { close(); } };
    vm.goSecurity = function () { U.go('dashboard.my_account.security'); };

    U.onEscape($scope, close);
    // edit mode asks before typed changes are lost (Cancel, the tabs, the menu, back, switching design)
    var EDIT_KEYS = ['dob', 'address_line1', 'address_line2', 'address_line3', 'address_line4', 'address_locality', 'address_city', 'address_county', 'address_postcode', 'address_country', 'caa_reference_number'];
    function editSnap(d) { return U.snap(d, EDIT_KEYS) + '|' + String((d && d.phone_number) || '').replace(/\D/g, '').slice(-9); }
    U.guardLeave($scope, vm, function () { return vm.edit && vm.draft && (vm.newPhoto || vm.photoBusy || editSnap(vm.draft) !== vm.editSnap0); });
    load();

    function load() {
        vm.loading = true;
        vm.loadError = false;
        $q.all([
            UserService.GetById(vm.me.id),
            NokService.GetByUserId(vm.me.id),
            vm.clubMember ? PoidService.GetByUserId(vm.me.id) : $q.when({ success: true, poids: [] })
        ]).then(function (r) {
            vm.loading = false;
            if (!r[0] || !r[0].success || !r[0].user) { vm.loadError = true; return; }
            vm.user = r[0].user;
            vm.user.dob = U.day(vm.user.dob);
            vm.noks = (r[1] && r[1].noks) || [];
            vm.poids = (r[2] && r[2].poids) || [];
            vm.todoList = todos();
            vm.openList = vm.todoList.filter(function (t) { return !t.done; });
        });
    }

    function addrLines(u) {
        if (!u) { return []; }
        return [u.address_line1, u.address_line2, u.address_line3, u.address_line4, u.address_city, u.address_county, u.address_postcode, u.address_country]
            .filter(function (x) { return x && String(x).trim(); });
    }

    /* what still needs doing (drives the attention card, the new-member checklist and the identity pill) */
    function todos() {
        var u = vm.user, list = [];
        if (!u) { return list; }
        list.push({ k: 'phone', done: !!u.phone_number, t: 'Mobile number', s: 'Your club uses it to reach you about bookings', go: 'edit', ic: 'fa-mobile-alt', verb: 'Add' });
        list.push({ k: 'dob', done: !!U.day(u.dob), t: 'Date of birth', s: 'It prefills the CAA forms your club prepares', go: 'edit', ic: 'fa-birthday-cake', verb: 'Add' });
        list.push({ k: 'addr', done: !!u.address_line1, t: 'Home address', s: 'Kept on your membership record', go: 'edit', ic: 'fa-home', verb: 'Add' });
        list.push({ k: 'nok', done: vm.noks.length > 0, t: 'Emergency contact', attnT: 'No emergency contact', s: 'Someone your club can call if something happens while you\'re flying', go: 'nok', ic: 'fa-user-friends', verb: 'Add contact', tone: 'warn' });
        if (vm.clubMember) {
            var expired = vm.poids.filter(function (p) { return U.poidState(p) === 'expired'; })[0];
            var valid = vm.poids.some(function (p) { return U.poidState(p) !== 'expired'; });
            list.push({ k: 'poid', done: valid, t: 'Proof of ID', attnT: expired ? 'Your proof of ID has expired' : 'No proof of ID',
                s: expired ? 'Your ' + String(expired.title || 'ID').replace(/^UK /, '') + ' expired on ' + U.fDate(expired.expiry_date) + ' — add your new one' : 'A passport or driving licence your club can check',
                go: 'poid', ic: 'fa-id-badge', verb: expired ? 'Update ID' : 'Add ID', tone: expired ? 'bad' : 'warn' });
        }
        return list;
    }
    function todoGo(t) {
        if (t.go === 'edit') { startEdit(); return; }
        if (t.go === 'nok') { U.go('dashboard.my_account.nok.add'); return; }
        U.go('dashboard.my_account.poid');
    }

    function startEdit() {
        vm.draft = angular.copy(vm.user);
        vm.draft.dob = U.day(vm.draft.dob);
        vm.caaTouched = false;
        vm.errs = {};
        vm.lookFilled = false;
        vm.newPhoto = null;
        vm.photoBusy = false;
        vm.editSnap0 = editSnap(vm.draft);
        vm.edit = true;
        $window.scrollTo(0, 0);
    }
    function cancelEdit() {
        vm.edit = false; vm.draft = null; vm.errs = {}; vm.lookFilled = false; vm.newPhoto = null; vm.photoBusy = false;
        $window.scrollTo(0, 0);
    }

    // <address-lookup> pick → the (always editable) lines
    function applyAddress(a) {
        if (!vm.draft || !a) { return; }
        vm.draft.address_line1 = a.line1 || '';
        vm.draft.address_line2 = a.line2 || '';
        vm.draft.address_line3 = a.line3 || '';
        vm.draft.address_line4 = a.line4 || '';
        vm.draft.address_postcode = a.postcode || '';
        vm.draft.address_locality = a.locality || '';
        vm.draft.address_city = a.city || '';
        vm.draft.address_county = a.county || '';
        vm.draft.address_country = a.country || '';
        vm.lookFilled = true;
    }

    // ng-flow: the photo circle uploads to upload.php; the staged path is saved with the details
    // flow-complete fires for a failed upload too — photoFailed has already said so and put the old photo back
    function photoFiles(files) {
        vm.photoBusy = false;
        var f = files && files[files.length - 1];
        if (!f || f.error) { return; }
        var path = U.flowPath(f);
        if (!path) { photoFailed(f, f.flowObj); return; }
        vm.newPhoto = { path: path, file: f };
        vm.clearErr('avatar');
    }
    vm.photoStart = function () { vm.photoBusy = true; vm.newPhoto = null; vm.clearErr('avatar'); };
    vm.photoFailed = photoFailed;
    function photoFailed(file, $flow) {
        vm.photoBusy = false;
        vm.newPhoto = null;
        vm.errs.avatar = 'Your photo didn\'t upload — try again, or use a smaller JPG, PNG or GIF.';
        ToastService.error('Photo not uploaded', 'Try again, or use a smaller JPG, PNG or GIF.');
        if ($flow) { $flow.cancel(); }
    }

    function validate(d) {
        var e = {};
        // UX pass 2b: intl-tel-input leaves the model empty while the typed number is invalid — say that, not "add a number"
        var typed = String(((document.getElementById('phone_number') || {}).value) || '').trim();
        if (!d.phone_number || !String(d.phone_number).trim()) { e.phone_number = typed ? 'That number doesn\'t look right — pick the country, then type the whole number, e.g. +44 7700 900123.' : 'Add a mobile number — your club uses it to reach you.'; }
        else if (U.digits(d.phone_number) < 7) { e.phone_number = 'That number looks too short — include the country code, e.g. +44 7700 900123.'; }
        if (d.dob && U.daysBetween(d.dob, U.today()) < 365 * 5) { e.dob = 'Check the year — that date is too recent.'; }
        return e;
    }

    function saveAsk() {
        vm.errs = validate(vm.draft);
        if (vm.photoBusy) { vm.errs.avatar = 'Wait for your photo to finish uploading.'; }
        var ks = Object.keys(vm.errs);
        if (ks.length) {
            ToastService.warning('Check the highlighted field' + (ks.length > 1 ? 's' : ''), vm.errs[ks[0]]);
            U.scrollToError();
            return;
        }
        vm.cpw = ''; vm.cpwErr = null; vm.dlg = 'confirm';
        U.focus('pro-cur-pw', 120);
    }

    function saveDo() {
        if (vm.saving) { return; }
        if (!vm.cpw) { vm.cpwErr = 'Enter your current password.'; U.focus('pro-cur-pw'); return; }
        var d = vm.draft;
        var p = {
            id: vm.user.id, password: vm.cpw,
            phone_number: d.phone_number,
            address_line1: d.address_line1 || '', address_line2: d.address_line2 || '', address_line3: d.address_line3 || '', address_line4: d.address_line4 || '',
            address_city: d.address_city || '', address_county: d.address_county || '', address_postcode: d.address_postcode || '',
            address_country: d.address_country || '', address_locality: d.address_locality || ''
        };
        if (d.dob) { p.dob = d.dob; }
        // GET users/{id} doesn't return the CAA reference: only send it when it was shown or typed, never a blank over a stored one
        if (vm.hasCaa() || (vm.caaTouched && d.caa_reference_number)) { p.caa_reference_number = d.caa_reference_number || ''; }
        if (vm.newPhoto) { p.avatar = vm.newPhoto.path; p.update_avatar = true; }
        vm.saving = true;
        UserService.Update(p).then(function (data) {
            vm.saving = false;
            if (data && data.success) {
                vm.dlg = null; vm.cpw = '';
                vm.edit = false; vm.draft = null; vm.newPhoto = null; vm.lookFilled = false;
                ToastService.success('Your details are saved', 'Your clubs see the changes straight away.');
                $window.scrollTo(0, 0);
                load();
                return;
            }
            var msg = data && data.message;
            if (msg === 'Password entered failed') { vm.cpwErr = 'That password isn\'t right — try again.'; vm.cpw = ''; U.focus('pro-cur-pw'); ToastService.error('Not saved', 'That password isn\'t right.'); return; }
            vm.dlg = null; vm.cpw = '';
            if (data && data.error === 'VALIDATION_ERROR' && /birth/i.test(msg || '')) { vm.errs.dob = 'That date of birth isn\'t a valid date.'; ToastService.error('Not saved', vm.errs.dob); U.scrollToError(); return; }
            if (data && data.error === 'INVALID_UPLOAD') { vm.errs.avatar = 'The photo didn\'t upload properly — add it again.'; vm.newPhoto = null; ToastService.error('Not saved', vm.errs.avatar); return; }
            ToastService.error('Not saved', U.msg(data, 'Your changes could not be saved — try again.'));
        });
    }

    function openPw() {
        vm.pw = { cur: '', n1: '', n2: '' }; vm.pwErr = {}; vm.dlg = 'pw';
        U.focus('pw-cur', 120);
    }
    function pwSave() {
        if (vm.saving) { return; }
        var p = vm.pw, e = {};
        if (!p.cur) { e.cur = 'Enter your current password.'; }
        if (!U.pwOk(p.n1)) { e.n1 = 'Meet every rule below.'; }
        if (!p.n2) { e.n2 = 'Type the new password again.'; } else if (p.n2 !== p.n1) { e.n2 = 'The two new passwords don\'t match.'; }
        vm.pwErr = e;
        var k = Object.keys(e);
        if (k.length) { U.focus({ cur: 'pw-cur', n1: 'pw-new', n2: 'pw-new2' }[k[0]]); return; }
        vm.saving = true;
        UserService.Update({ id: vm.me.id, password: p.cur, new_password: p.n1, new_password2: p.n2 }).then(function (data) {
            vm.saving = false;
            if (data && data.success) {
                vm.dlg = null; vm.pw = null;
                ToastService.success('Password changed', 'Use it next time you log in.');
                return;
            }
            if (data && data.message === 'Password entered failed') { vm.pwErr = { cur: 'That password isn\'t right.' }; p.cur = ''; U.focus('pw-cur'); ToastService.error('Not changed', 'That password isn\'t right.'); return; }
            if (data && data.error === 'VALIDATION_ERROR') { vm.pwErr = { n1: U.msg(data, 'Choose a stronger password.') }; ToastService.error('Not changed', vm.pwErr.n1); U.focus('pw-new'); return; }
            ToastService.error('Not changed', U.msg(data, 'Try again in a moment.')); U.focus('pw-new2');   // the fields were disabled while saving
        });
    }

    function close() {
        if (vm.saving || !vm.dlg) { return; }
        vm.dlg = null; vm.cpw = ''; vm.pw = null;
    }
}


/* ═══ Next of kin (list + form) ═══ */
app.controller('NokV2Controller', NokV2Controller);
NokV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$timeout', 'NokService', 'UserService', 'ToastService', 'ProfileV2Util'];
function NokV2Controller($rootScope, $scope, $state, $stateParams, $timeout, NokService, UserService, ToastService, U) {
    var vm = this;
    vm.me = $rootScope.globals.currentUser;
    vm.action = $state.current.data.action;
    vm.loading = true;
    vm.noks = [];
    vm.rels = ['Partner', 'Parent', 'Sibling', 'Child', 'Friend'];
    vm.errs = {};
    vm.removing = null;
    vm.flash = null;
    vm.home = null;          // the member's own address ("Same as mine")

    vm.askRemove = function (n) { vm.removing = n.id; };
    vm.keep = function () { vm.removing = null; };
    vm.remove = remove;
    vm.setRel = function (r) { vm.nok.relationship = r; vm.clearErr('relationship'); };
    vm.clearErr = function (k) { if (vm.errs[k]) { delete vm.errs[k]; } };
    vm.applyAddress = function (a) { if (!a) { return; } vm.nok.address = a.formatted || [a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(', '); vm.clearErr('address'); };
    vm.sameAsMine = sameAsMine;
    vm.save = save;
    vm.phoneHref = function (n) { return 'tel:' + String(n || '').replace(/[^+\d]/g, ''); };
    vm.go = function (s, p) { U.go(s, p); };

    U.onEscape($scope, function () { vm.removing = null; });
    var NOK_KEYS = ['first_name', 'last_name', 'relationship', 'email_address', 'address'];
    function nokSnap(n) { return U.snap(n, NOK_KEYS) + '|' + String((n && n.phone_number) || '').replace(/\D/g, '').slice(-9); }
    if (vm.action !== 'list') { U.guardLeave($scope, vm, function () { return !vm.loading && !vm.loadError && vm.nok0 !== undefined && nokSnap(vm.nok) !== vm.nok0; }); }

    if (vm.action === 'list') {
        if (U.flash && U.flash.kind === 'nok') { vm.flash = U.flash.id; U.flash = null; $timeout(function () { vm.flash = null; }, 2000); }
        loadList();
    } else {
        vm.nok = { first_name: '', last_name: '', relationship: '', phone_number: '', email_address: '', address: '' };
        UserService.GetById(vm.me.id).then(function (d) { if (d && d.success && d.user && d.user.address_line1) { vm.home = d.user; } });
        if (vm.action === 'edit') {
            NokService.GetById($stateParams.nok_id).then(function (data) {
                vm.loading = false;
                if (data && data.success && data.nok) { vm.nok = data.nok; vm.nok.email_address = vm.nok.email_address || ''; vm.nok0 = nokSnap(vm.nok); }
                else { vm.loadError = true; }
            });
        } else { vm.loading = false; vm.nok0 = nokSnap(vm.nok); }
    }

    vm.reload = loadList;
    function loadList() {
        vm.loading = true;
        vm.loadError = false;
        NokService.GetByUserId(vm.me.id).then(function (data) {
            vm.loading = false;
            if (data && data.success) { vm.noks = data.noks || []; } else { vm.loadError = true; }
        });
    }

    function remove(n) {
        NokService.Delete(vm.me.id, n.id).then(function (data) {
            vm.removing = null;
            if (data && data.success) {
                ToastService.success(n.first_name + ' ' + n.last_name + ' removed', 'They are no longer one of your emergency contacts.');
                vm.noks = vm.noks.filter(function (x) { return x.id !== n.id; });
            } else {
                ToastService.error('Not removed', U.msg(data, 'Try again in a moment.'));
            }
        });
    }

    function sameAsMine() {
        var u = vm.home; if (!u) { return; }
        vm.nok.address = [u.address_line1, u.address_line2, u.address_line3, u.address_line4, u.address_city, u.address_postcode]
            .filter(function (x) { return x && String(x).trim(); }).join('\n');
        vm.clearErr('address');
        ToastService.success('Copied your home address', 'Change anything that\'s different for them.');
    }

    function save() {
        var n = vm.nok, e = {};
        function blank(x) { return !x || !String(x).trim(); }
        if (blank(n.first_name)) { e.first_name = 'Add their first name.'; }
        if (blank(n.last_name)) { e.last_name = 'Add their last name.'; }
        if (blank(n.relationship)) { e.relationship = 'Say how they\'re related to you.'; }
        if (blank(n.phone_number)) { e.phone_number = 'Add a number your club can call.'; }
        else if (U.digits(n.phone_number) < 7) { e.phone_number = 'That number looks too short.'; }
        if (n.email_address && !U.EMAIL_RE.test(String(n.email_address).trim())) { e.email_address = 'That doesn\'t look like an email address.'; }
        if (blank(n.address)) { e.address = 'Add their address.'; }
        vm.errs = e;
        var ks = Object.keys(e);
        if (ks.length) { ToastService.warning('Check the highlighted field' + (ks.length > 1 ? 's' : ''), e[ks[0]]); U.scrollToError(); return; }
        var body = { first_name: n.first_name.trim(), last_name: n.last_name.trim(), relationship: n.relationship.trim(), phone_number: n.phone_number.trim(),
            email_address: (n.email_address || '').trim(), address: n.address, user_id: vm.me.id };
        if (n.id) { body.id = n.id; }
        (n.id ? NokService.Update(body) : NokService.Create(body)).then(function (data) {
            if (data && data.success) {
                ToastService.success(body.first_name + ' ' + body.last_name + ' is saved as an emergency contact', 'Your clubs see the change straight away.');
                U.flash = { kind: 'nok', id: n.id || data.id || null };
                vm.leaveOk = true;
                U.go('dashboard.my_account.nok');
            } else {
                ToastService.error('Not saved', U.msg(data, 'Try again in a moment.'));
            }
        });
    }
}


/* ═══ Proof of ID (list + form) — in the My documents hub ═══ */
app.controller('PoidV2Controller', PoidV2Controller);
PoidV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$q', '$timeout', 'PoidService', 'AuthenticationService', 'ToastService', 'ProfileV2Util', 'MemberChecksV2', 'TaDocFull'];
function PoidV2Controller($rootScope, $scope, $state, $stateParams, $q, $timeout, PoidService, AuthenticationService, ToastService, U, Checks, TaDocFull) {
    var vm = this;
    vm.me = $rootScope.globals.currentUser;
    vm.action = $state.current.data.action;
    vm.clubMember = !!(vm.me.access && vm.me.access.show_booking);
    vm.U = U;
    vm.loading = true;
    vm.poids = [];
    vm.revealed = false;     // images decrypted for this visit
    vm.images = {};          // poid id → decrypted images [{id, data_uri}]
    vm.removing = null;
    vm.errs = {};
    vm.dlg = null;           // 'reveal'
    vm.types = ['UK passport', 'UK driving licence', 'Passport (other country)', 'National ID card'];
    vm.expOptions = { shortcuts: false, dots: false, allowPast: false };

    vm.pill = U.poidPill;
    vm.state = U.poidState;
    vm.left = function (p) { return U.daysLeft(p.expiry_date); };
    vm.icon = U.poidIcon;
    vm.validCount = function () { return vm.poids.filter(function (p) { return U.poidState(p) !== 'expired'; }).length; };
    vm.firstExpired = function () { return vm.poids.filter(function (p) { return U.poidState(p) === 'expired'; })[0]; };
    vm.shortTitle = function (p) { return String((p && p.title) || 'ID').replace(/^UK /, ''); };
    vm.askRemove = function (p) { vm.removing = p.id; };
    vm.keep = function () { vm.removing = null; };
    vm.remove = remove;
    vm.reveal = reveal;
    vm.hide = function () { vm.revealed = false; };
    vm.revealDo = revealDo;
    vm.close = close;
    vm.scrim = function ($event) { if ($event.target === $event.currentTarget) { close(); } };
    vm.setType = function (t) { vm.poid.title = t; vm.clearErr('title'); };
    vm.clearErr = function (k) { if (vm.errs[k]) { delete vm.errs[k]; } };
    vm.flowAdded = U.docOnly;
    vm.flowDone = U.upDone;
    vm.uploading = U.upBusy;
    vm.flowFailed = U.upFailed;
    vm.removeExisting = function (img) { vm.poid.images = vm.poid.images.filter(function (i) { return i.id !== img.id; }); };
    vm.removeNew = removeNew;
    vm.save = save;
    vm.imgCount = function ($flow) { return (vm.poid ? vm.poid.images.length : 0) + ($flow ? U.stagedCount($flow.files) : 0); };
    vm.pct = function (f) { return Math.round(f.progress() * 100); };
    vm.go = function (s, p) { U.go(s, p); };

    U.onEscape($scope, function () { if (vm.dlg) { close(); } else { vm.removing = null; } });
    function poidSnap(p) { return p ? U.snap({ t: p.title, e: p.expiry_date, i: (p.images || []).map(function (i) { return i.id; }).join(',') }) : ''; }
    if (vm.action !== 'list') {
        U.guardLeave($scope, vm, function () {
            return !vm.loading && !vm.loadError && ((vm.flowRef && vm.flowRef.files.length > 0) || poidSnap(vm.poid) !== vm.poid0);
        });
    }

    Checks.get().then(function (d) { vm.clubNames = Checks.names(d); });

    if (vm.action === 'list') {
        if (U.flash && U.flash.kind === 'poid') { vm.flash = U.flash.id; U.flash = null; $timeout(function () { vm.flash = null; }, 2000); }
        loadList();
    } else {
        vm.poid = { title: '', expiry_date: '', images: [] };
        if (vm.action === 'edit') {
            PoidService.GetById($stateParams.poid_id, 1, 0).then(function (data) {
                vm.loading = false;
                if (!data || !data.success || !data.poid) { vm.loadError = true; return; }
                vm.poid = data.poid;
                vm.poid.images = (vm.poid.images || []).map(function (i) { return { id: i.id }; });
                vm.wasExpired = U.poidState(vm.poid) === 'expired';
                vm.poid.expiry_date = vm.wasExpired ? '' : U.day(vm.poid.expiry_date);
                vm.poid0 = poidSnap(vm.poid);
            });
        } else { vm.loading = false; vm.poid0 = poidSnap(vm.poid); }
    }

    vm.reload = loadList;
    function loadList() {
        vm.loading = true;
        vm.loadError = false;
        $q.all([PoidService.GetByUserId(vm.me.id), Checks.get()]).then(function (r) {
            vm.loading = false;
            var data = r[0];
            if (data && data.success) {
                vm.poids = (data.poids || []).map(function (p) { p._checks = Checks.rows(r[1], 'poid', p.id) || []; return p; });
            } else { vm.loadError = true; }
        });
    }

    function remove(p) {
        PoidService.Delete(vm.me.id, p.id).then(function (data) {
            vm.removing = null;
            if (data && data.success) {
                Checks.dirty();
                ToastService.success('Your ' + (p.title || 'proof of ID') + ' was removed', 'Your clubs no longer see it.');
                vm.poids = vm.poids.filter(function (x) { return x.id !== p.id; });
            } else {
                ToastService.error('Not removed', U.msg(data, 'Try again in a moment.'));
            }
        });
    }

    /* Show images: decrypt every record shown here (list) or this one (form). The backend asks for the password
       again when the sign-in is older than 5 minutes (fail: "templogin") — then the "Confirm it's you" dialog. */
    function reveal() {
        var ids = vm.action === 'list' ? vm.poids.map(function (p) { return p.id; }) : [vm.poid.id];
        vm.revealing = true;
        $q.all(ids.map(function (id) { return PoidService.GetById(id, 1, 1); })).then(function (rs) {
            vm.revealing = false;
            var needLogin = rs.some(function (d) { return d && d.fail === 'templogin'; });
            if (needLogin) { vm.cpw = ''; vm.cpwErr = null; vm.dlg = 'reveal'; U.focus('pro-cur-pw', 120); return; }
            var ok = false;
            rs.forEach(function (d, i) {
                if (d && d.success && d.poid) { ok = true; vm.images[ids[i]] = d.poid.images || []; }
            });
            if (ok) { vm.revealed = true; vm.dlg = null; }
            else { ToastService.error('Images not shown', 'They could not be opened just now — try again.'); }
        });
    }
    function revealDo() {
        if (!vm.cpw) { vm.cpwErr = 'Enter your password.'; U.focus('pro-cur-pw'); return; }
        vm.checking = true;
        AuthenticationService.Login3(vm.cpw, U.sample(120), function (res) {
            $timeout(function () {
                vm.checking = false;
                if (res && res.success) { vm.cpw = ''; vm.dlg = null; reveal(); }
                else if (U.loginDown(res)) { vm.cpwErr = 'Your password couldn\'t be checked just now — try again in a moment.'; U.focus('pro-cur-pw'); }
                else { vm.cpwErr = 'That password isn\'t right — try again.'; vm.cpw = ''; U.focus('pro-cur-pw'); }
            });
        });
    }
    function close() { if (vm.checking) { return; } vm.dlg = null; vm.cpw = ''; }
    vm.imgOf = function (p, i) { var list = vm.images[p.id] || []; return list[i] && /^data:/.test(list[i].data_uri) ? list[i].data_uri : null; };
    vm.formImg = function (img) { var list = vm.images[vm.poid && vm.poid.id] || []; for (var i = 0; i < list.length; i++) { if (list[i].id === img.id && /^data:/.test(list[i].data_uri)) { return list[i].data_uri; } } return null; };
    /* a shown image opens full screen with zoom (owner, 13 Nov 2026) — the shared lightbox, TaDocFull (js/v2/core/docview.js);
       no Download / new tab: the images are shown from the encrypted copy and stay in the page. `p` = the record, `at` = the
       image (the form) or its position (the list). */
    var fullView = null;
    vm.imgFull = function (p, at) {
        if (!p || !vm.revealed) { return; }
        var list = function () { return (vm.images[p.id] || []).filter(function (im) { return /^data:/.test(im.data_uri); }); };
        var start = 0, all = vm.images[p.id] || [], k;
        for (k = 0; k < all.length; k++) { if (angular.isNumber(at) ? k === at : all[k].id === at.id) { start = Math.max(0, list().indexOf(all[k])); break; } }
        fullView = TaDocFull.open({
            index: start, actions: false,
            count: function () { return list().length; },
            at: function (i) { var im = list()[i]; return { url: im ? im.data_uri : null, kind: 'image', title: p.title || 'Proof of ID', sub: 'Image ' + (i + 1) }; },
            onClose: function () { fullView = null; }
        });
    };
    $scope.$on('$destroy', function () { if (fullView) { fullView.close(); } });

    function removeNew(file, $flow) {
        var paths = U.flowPaths(file);
        file.cancel();
        paths.forEach(function (p) { PoidService.DeleteTmp(p); });      // a PDF: every page it was turned into
    }

    function save($flow) {
        var p = vm.poid, e = {}, files = ($flow && $flow.files) || [];
        if (!p.images.length && !files.length) { e.images = 'Add at least one photo of the document.'; }
        else if (U.upBad($flow)) { e.images = 'A photo didn\'t upload — remove it (×) and add it again.'; }
        else if (vm.uploading($flow)) { e.images = 'Wait for the upload to finish.'; }
        if (!p.title || !String(p.title).trim()) { e.title = 'Say what kind of ID this is.'; }
        if (!p.expiry_date) { e.exp = 'Add the expiry date.'; }
        else if (U.daysLeft(p.expiry_date) < 0) { e.exp = 'This date has passed — add an ID that\'s still valid.'; }
        vm.errs = e;
        var ks = Object.keys(e);
        if (ks.length) { ToastService.warning('Check the highlighted field' + (ks.length > 1 ? 's' : ''), e[ks[0]]); U.scrollToError(); return; }
        var staged = U.stagedImages(files);
        var body = { title: String(p.title).trim(), expiry_date: p.expiry_date, user_id: vm.me.id,
            images: p.images.map(function (i) { return { id: i.id }; }).concat(staged) };
        if (p.id) { body.id = p.id; }
        vm.saving = true;
        (p.id ? PoidService.Update(body) : PoidService.Create(body)).then(function (data) {
            vm.saving = false;
            if (data && data.success) {
                Checks.dirty();
                ToastService.success('Proof of ID saved', 'Your clubs can now check it.');
                U.flash = { kind: 'poid', id: data.id || null };
                vm.leaveOk = true;
                U.go('dashboard.my_account.poid');
            } else if (data && data.error === 'INVALID_UPLOAD') {
                vm.errs.images = 'One of the photos didn\'t upload properly — remove it and add it again.';
                ToastService.error('Not saved', vm.errs.images); U.scrollToError();
            } else {
                ToastService.error('Not saved', U.msg(data, 'Try again in a moment.'));
            }
        });
    }
}


/* ═══ Invite a pilot ═══ */
app.controller('InvitePilotV2Controller', InvitePilotV2Controller);
InvitePilotV2Controller.$inject = ['$rootScope', '$timeout', 'LogbookSignupService', 'ToastService', 'ProfileV2Util'];
function InvitePilotV2Controller($rootScope, $timeout, LogbookSignupService, ToastService, U) {
    var vm = this;
    vm.U = U;
    vm.MAX = 5;
    vm.loading = true;
    vm.invites = [];
    vm.inv = { email: '', first_name: '' };
    vm.err = null;           // field error on the email
    vm.note = null;          // what the server refused, in the card
    vm.copied = null;
    vm.flash = null;

    vm.joined = function () { return vm.invites.filter(function (i) { return i.status === 'joined'; }).length; };
    vm.capped = function (i) { return (+i.email_send_count || 0) >= vm.MAX; };
    vm.anyCapped = function () { return vm.invites.some(function (i) { return i.status === 'invited' && vm.capped(i); }); };
    vm.link = function (i) { return window.location.origin + '/logbook_invite/' + i.token; };
    vm.send = send;
    vm.again = again;
    vm.copy = copy;
    vm.clear = function () { vm.err = null; vm.note = null; };

    load();

    vm.reload = load;
    function load() {
        vm.loading = true;
        vm.loadError = false;
        LogbookSignupService.Invites().then(function (data) {
            vm.loading = false;
            vm.loadError = !data || data.success === false || !angular.isArray(data.invites);   // never "No invites yet" when the list didn't load
            vm.invites = (data && data.invites) || [];
        });
    }

    function send() {
        var em = (vm.inv.email || '').trim().toLowerCase();
        vm.note = null;
        if (!em) { vm.err = 'Enter the pilot\'s email address.'; U.focus('invp-email'); return; }
        if (!U.EMAIL_RE.test(em)) { vm.err = 'That doesn\'t look like an email address.'; U.focus('invp-email'); return; }
        vm.err = null;
        vm.sending = true;
        LogbookSignupService.Invite(em, (vm.inv.first_name || '').trim()).then(function (data) {
            vm.sending = false;
            if (data && data.success) {
                ToastService.success('Invitation sent', 'If they\'re new to ToAviate, they get a personal link to sign up.');
                vm.inv = { email: '', first_name: '' };
                flashEmail(em);
            } else {
                vm.note = U.msg(data, 'The invitation could not be sent. Try again.');
                ToastService.error('Not sent', vm.note);
            }
        });
    }
    function again(i) {
        LogbookSignupService.Invite(i.email, i.first_name || '').then(function (data) {
            if (data && data.success) { ToastService.success('Invitation sent again', 'To ' + i.email + '.'); flashEmail(i.email); }
            else { ToastService.error('Not sent', U.msg(data, 'Try again in a moment.')); }
        });
    }
    function flashEmail(em) {
        LogbookSignupService.Invites().then(function (data) {
            if (!data || !angular.isArray(data.invites)) { return; }   // a failed refresh keeps the list you had
            vm.invites = data.invites; vm.loadError = false;
            var row = vm.invites.filter(function (x) { return String(x.email).toLowerCase() === em; })[0];
            if (row) { vm.flash = row.id; $timeout(function () { vm.flash = null; }, 2000); }
        });
    }
    function copy(i) {
        U.copy(vm.link(i), function () {
            vm.copied = i.id;
            ToastService.success('Invite link copied', 'Send it to them yourself — it works until they join.');
            $timeout(function () { if (vm.copied === i.id) { vm.copied = null; } }, 2000);
        });
    }
}


/* ═══ <pro-details-bar active="profile|security|nok|reminders" nok-count="…" locked="…" heading="…" sub="…"> — the My details
   hub page bar (Profile · Security · Next of kin · Reminders). The Security page (js/v2/security) uses it too;
   `locked` = the 2FA enrolment lock: no Back, the other tabs say why they don't open. ═══ */
app.directive('proDetailsBar', ['$state', 'ToastService', 'ProfileV2Util', function ($state, ToastService, U) {
    var TABS = [
        { k: 'profile', ic: 'fa-id-card', t: 'Profile', state: 'dashboard.my_account.manage' },
        { k: 'security', ic: 'fa-lock', t: 'Security', state: 'dashboard.my_account.security' },
        { k: 'nok', ic: 'fa-user-friends', t: 'Next of kin', state: 'dashboard.my_account.nok' },
        { k: 'reminders', ic: 'fa-bell', t: 'Reminders', state: 'dashboard.my_account.reminders' }
    ];
    return {
        restrict: 'E',
        replace: true,
        scope: { active: '@', nokCount: '=?', locked: '=?', icon: '@', heading: '@', sub: '@' },
        templateUrl: 'views/v2/profile/_details_bar.html',
        link: function (scope) {
            scope.tabs = TABS;
            scope.go = function (t) {
                if (t.k === scope.active) { return; }
                if (scope.locked) { ToastService.warning('Add a second step first', 'The other pages open once your sign-in has one.'); return; }
                U.go(t.state);
            };
            scope.toAccount = function () { if (!scope.locked) { U.go('dashboard.my_account'); } };   // not "back": <design-back> (no isolate scope) puts its own back() on this scope
        }
    };
}]);


/* ═══ MemberChecksV2 — each live club's check of the member's own documents (GET member_checks/v2/mine,
   contract C9, landed 8 Nov). A document with no check row for a club hasn't been checked by that club.
   Shared by proof of ID (here) and licences / medical / differences (js/v2/licences). ═══ */
app.factory('MemberChecksV2', MemberChecksV2);
MemberChecksV2.$inject = ['$http'];
function MemberChecksV2($http) {
    var cache = null, at = 0, s = {};
    s.get = function () {
        if (cache && Date.now() - at < 30000) { return cache; }
        at = Date.now();
        cache = $http.get('/api/v1/member_checks/v2/mine').then(function (res) { return res.data; }, function (res) {
            cache = null;
            return { success: false, status: res && res.status };   // the checks just stay hidden; the global interceptor handles a 401
        });
        return cache;
    };
    s.dirty = function () { cache = null; };
    s.clubName = function (c) { return String((c && c.title) || '').trim(); };
    /* C28: what a solo booking checks at each live club (club_plane_requirements) → GET member_checks/v2/needed_for
       {clubs:[{club_id, title, aircraft:[{plane_id, registration, may_book_solo}], licences, medicals, differences:[{difference_id, plane_ids}]}]} */
    var needCache = null, needAt = 0;
    s.neededFor = function () {
        if (needCache && Date.now() - needAt < 60000) { return needCache; }
        needAt = Date.now();
        needCache = $http.get('/api/v1/member_checks/v2/needed_for').then(function (res) { return res.data; }, function () { needCache = null; return { success: false }; });
        return needCache;
    };
    /* the aircraft a difference is needed for, per club → [{club, regs:[…]}] (none → []) */
    s.diffNeeds = function (data, differenceId) {
        if (!data || !data.success) { return []; }
        return (data.clubs || []).map(function (c) {
            var need = (c.differences || []).filter(function (d) { return +d.difference_id === +differenceId; })[0];
            if (!need) { return null; }
            var ids = (need.plane_ids || []).map(Number);
            var regs = (c.aircraft || []).filter(function (a) { return ids.indexOf(+a.plane_id) > -1 && a.registration; }).map(function (a) { return String(a.registration).trim(); });
            return regs.length ? { club: s.clubName(c), regs: regs } : null;
        }).filter(Boolean);
    };
    /* one row per live club for a document → [{club, club_id, verified, by, at}]; null when the read failed (hide the section) */
    s.rows = function (data, type, id) {
        if (!data || !data.success) { return null; }
        return (data.clubs || []).map(function (c) {
            var ck = (data.checks || []).filter(function (x) { return x.check_type === type && +x.check_id === +id && +x.club_id === +c.id; })[0];
            var ok = !!(ck && (ck.verified === true || +ck.verified === 1));
            return { club: s.clubName(c), club_id: +c.id, verified: ok, by: ok && ck.checked_by ? ck.checked_by.name : null, at: ok ? ck.checked_at : null };
        });
    };
    /* the same list as escaped HTML with each name in bold (the mockups' club notes); 'your clubs' when there are none */
    s.namesHtml = function (data) {
        var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var n = data && data.success ? (data.clubs || []).map(s.clubName).filter(Boolean).map(function (x) { return '<b>' + esc(x) + '</b>'; }) : [];
        return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : (n[0] || 'your clubs');
    };
    /* "THE PILOT CENTRE and TOAVIATE" */
    s.names = function (data) {
        var n = data && data.success ? (data.clubs || []).map(s.clubName).filter(Boolean) : [];
        return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : (n[0] || '');
    };
    return s;
}
