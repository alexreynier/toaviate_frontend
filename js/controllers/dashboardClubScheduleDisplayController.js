app.controller('DashboardClubScheduleDisplayController', DashboardClubScheduleDisplayController);

    // Manage Club → Settings → Schedule display (clubhouse TV). Rebuilt 2026-11-11 from the approved mockup
    // mockups/schedule-display/settings.html (owner, 11 Nov): every option the TV offers with a live preview of the
    // real TV page, the default view marked on every choice, Return to default options, and the TV link + pairing
    // card (the token / pairing calls are the 2026-11-10 ones, unchanged). Options contract:
    // FRONTEND_SCHEDULE_DISPLAY_V2_GUIDE.md §2 — GET/PUT/DELETE schedule_display_tokens/{club}/settings; the PUT is
    // a partial patch of what changed, refused as a whole on a bad value. A save bumps the schedule version, so
    // every TV follows within 30 s. The TV itself is the public /display/:token page (ScheduleDisplayController).
    DashboardClubScheduleDisplayController.$inject = ['ScheduleDisplayService', 'ToastService', '$rootScope', '$scope', '$sce', '$window', '$timeout', '$stateParams', '$location'];
    function DashboardClubScheduleDisplayController(ScheduleDisplayService, ToastService, $rootScope, $scope, $sce, $window, $timeout, $stateParams, $location) {
        var vm = this;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.club_title = ($rootScope.globals.currentUser.current_club_admin.title || '').trim();

        // ── the options ──
        // the owner's favourite (10 Nov) is the default every club starts with; the server's `defaults` replace this once loaded
        vm.DEF = { layout: 'timeline', rows: 'packed', insrows: 'booked', idle: 'strip', window: 'day', pageturn: '15', names: 'initial', reg: 'circle', regpos: 'right', times: 'off', notices: 'on', weather: 'off', theme: 'light' };
        vm.LABEL = { day_switch: 'Moving on to tomorrow', pageturn: 'Page turn', layout: 'Layout', rows: 'Rows', insrows: 'Instructors without bookings', idle: 'Aircraft with nothing booked', window: 'Hours shown', names: 'Names', reg: 'Aircraft on bookings', regpos: 'Aircraft position', times: 'Times on bookings', notices: 'Safety notices', weather: 'Weather', theme: 'Colours', badge: 'Club badge' };
        vm.options = {};            // the backend's option lists (a key the backend doesn't offer yet, e.g. `badge`, hides its field)
        vm.club_logo = null;        // the club's uploaded logo (a data URI from the settings read), for the Club badge choice
        vm.KEYS = Object.keys(vm.DEF);
        vm.turn = { min: 5, max: 60, step: 5 };
        vm.saved = copy(vm.DEF);
        vm.draft = copy(vm.DEF);
        // "What the TV shows now" (owner via alex-3e, 11 Nov): settings.show_date pins a day (today … +31); null = the rule.
        // An action, not a draft: each press PUTs show_date straight away (a save bumps the version, the TVs follow).
        vm.showDate = null; vm.today = null; vm.tomorrow = null; vm.showBusy = false;
        vm.optionsLoading = true;
        vm.optionsError = null;     // the options endpoint refused / is missing: the link card still works
        vm.saving = false;
        vm.askReset = false;
        vm.askOff = false;

        // option lists for the repeated choices (kept out of the template: ngRepeat reads an " as " inside a literal as an alias)
        vm.NAME_OPTS = [['initial', 'S. Carter'], ['short', 'Sam C.'], ['full', 'Sam Carter'], ['hidden', 'Booked']];
        vm.REG_OPTS = [['circle', 'Colour circle', 'Last letters on the aircraft’s colour.'], ['tile', 'Colour tile', 'The same, square: never mistaken for an instructor.'], ['auto', 'G-BMTJ, TJ when tight', 'Full registration; the last letters on a short booking.'], ['short', 'Always TJ', 'The last letters, as said on the radio.'], ['full', 'Always G-BMTJ', 'The full registration; the name shrinks first.']];
        vm.namesHint = { initial: 'First initial and surname: S. Carter.', short: 'First name and initial: Sam C.', full: 'Full names, on a screen anyone in the club house can read.', hidden: 'Bookings say "Booked"; the instructor and aircraft still show.' };

        vm.unsaved = function () { return diff(vm.draft, vm.saved); };
        vm.fromDef = function () { return diff(vm.draft, vm.DEF); };
        vm.isDef = function (k, v) { return vm.DEF[k] === String(v); };
        vm.changed = function (k, k2) { return vm.draft[k] !== vm.DEF[k] || (k2 ? vm.draft[k2] !== vm.DEF[k2] : false); };
        vm.board = function () { return vm.draft.layout === 'board'; };
        vm.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

        vm.set = function (k, v) { vm.draft[k] = String(v); vm.askReset = false; };
        vm.turnBy = function (dir) {
            var n = (parseInt(vm.draft.pageturn, 10) || 15) + dir * vm.turn.step;
            vm.draft.pageturn = String(Math.min(vm.turn.max, Math.max(vm.turn.min, n)));
            vm.askReset = false;
        };
        vm.discard = function () { vm.draft = copy(vm.saved); vm.askReset = false; ToastService.success('Changes discarded', 'The options are back to what is saved.'); };
        vm.resetAsk = function () { vm.askReset = true; };
        vm.resetNo = function () { vm.askReset = false; };
        vm.resetYes = function () { vm.draft = copy(vm.DEF); vm.askReset = false; if (vm.showDate) { setShowDate(''); } ToastService.success('Back to the default view', 'Save to send it to your TVs.'); };
        vm.jump = function (k) {
            var id = { pageturn: 'sdx-layout', layout: 'sdx-layout', rows: 'sdx-rows', insrows: 'sdx-rows', idle: 'sdx-rows', names: 'sdx-bookings', reg: 'sdx-bookings', regpos: 'sdx-bookings', times: 'sdx-bookings' }[k] || 'sdx-extras';
            var el = $window.document.getElementById(id);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        };

        vm.save = function () {
            var keys = vm.unsaved();
            if (!keys.length || vm.saving) { return; }
            var patch = {};
            keys.forEach(function (k) { patch[k] = (k === 'pageturn') ? parseInt(vm.draft[k], 10) : vm.draft[k]; });
            vm.saving = true;
            return ScheduleDisplayService.SaveDisplayOptions(vm.club_id, patch).then(function (data) {
                vm.saving = false;
                if (data && data.success) {
                    takeSettings(data);
                    ToastService.success('Saved', 'Your TVs show the new view within 30 seconds.');
                    return;
                }
                if (data && data.error === 'VALIDATION_ERROR') {
                    ToastService.error('Not saved', (data.field && vm.LABEL[data.field] ? vm.LABEL[data.field] + ': ' : '') + (data.message || 'One of the options is not allowed.'));
                    return;
                }
                ToastService.error('Not saved', (data && data.message) || 'The options could not be saved.');
            });
        };

        function loadOptions() {
            vm.optionsLoading = true;
            ScheduleDisplayService.GetDisplayOptions(vm.club_id).then(function (data) {
                vm.optionsLoading = false;
                if (!data || !data.success) { vm.optionsError = (data && data.error === 'FORBIDDEN') ? 'Only a club manager can change the TV options.' : 'The TV options could not be loaded.'; return; }
                takeSettings(data);
            });
        }
        function takeSettings(data) {
            if (data.defaults) {   // the server's defaults are the key list (a new option, e.g. `badge`, arrives this way)
                var def = {};
                // show_date is the "what the TV shows now" pin (its own control), never a draft option; a null default is no option
                Object.keys(data.defaults).forEach(function (k) { if (k === 'show_date' || data.defaults[k] === null || data.defaults[k] === undefined) { return; } def[k] = String(data.defaults[k]); });
                vm.DEF = def; vm.KEYS = Object.keys(def);
                vm.KEYS.forEach(function (k) { if (!vm.LABEL[k]) { vm.LABEL[k] = k.charAt(0).toUpperCase() + k.slice(1); } });
            }
            if (data.page_turn) { vm.turn = { min: +data.page_turn.min || 5, max: +data.page_turn.max || 60, step: +data.page_turn.step || 5 }; }
            if (data.options) { vm.options = data.options; }
            if (Object.prototype.hasOwnProperty.call(data, 'logo')) { vm.club_logo = data.logo || null; }   // the club's uploaded logo (a data URI), null when none
            vm.saved = normalise(data.settings || {}, vm.DEF);
            vm.draft = copy(vm.saved);
            if (data.settings && Object.prototype.hasOwnProperty.call(data.settings, 'show_date')) { vm.showDate = data.settings.show_date || null; }
            if (data.today) { vm.today = data.today; }
            if (data.tomorrow) { vm.tomorrow = data.tomorrow; }
        }
        // ── the day the TV shows now ──
        vm.showDateLabel = function () {
            if (!vm.showDate) { return 'today, by the rule'; }
            if (vm.showDate === vm.today) { return 'today (pinned)'; }
            if (vm.showDate === vm.tomorrow) { return 'tomorrow, ' + fmtDay(vm.showDate); }
            return fmtDay(vm.showDate);
        };
        vm.canStep = function (dir) {
            var base = vm.showDate || vm.today;
            if (!base || !vm.today) { return false; }
            var d = addDays(base, dir);
            return d >= vm.today && d <= addDays(vm.today, 31);
        };
        vm.stepShown = function (dir) { if (vm.canStep(dir)) { setShowDate(addDays(vm.showDate || vm.today, dir)); } };
        vm.showTomorrow = function () { if (vm.tomorrow) { setShowDate(vm.tomorrow); } };
        vm.showByRule = function () { setShowDate(''); };
        function setShowDate(d) {
            if (vm.showBusy) { return; }
            vm.showBusy = true;
            return ScheduleDisplayService.SaveDisplayOptions(vm.club_id, { show_date: d }).then(function (data) {
                vm.showBusy = false;
                if (data && data.success) {
                    vm.showDate = (data.settings && data.settings.show_date) || null;
                    if (data.today) { vm.today = data.today; }
                    if (data.tomorrow) { vm.tomorrow = data.tomorrow; }
                    ToastService.success('TV updated', vm.showDate ? 'Showing ' + fmtDay(vm.showDate) + ' within 30 seconds.' : 'Back to the rule within 30 seconds.');
                    return;
                }
                ToastService.error('Not changed', (data && data.message) || 'The day could not be changed.');
            });
        }
        function addDays(ymd, n) { var p = ymd.split('-').map(Number); var d = new Date(p[0], p[1] - 1, p[2] + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
        function fmtDay(ymd) { var p = ymd.split('-').map(Number); var d = new Date(p[0], p[1] - 1, p[2]); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]; }
        // every option as a string (pageturn arrives as a number); unknown keys dropped, missing keys = default
        function normalise(src, def) {
            var out = {};
            Object.keys(def).forEach(function (k) { out[k] = (src[k] === undefined || src[k] === null) ? String(def[k]) : String(src[k]); });
            return out;
        }
        function diff(a, b) { return vm.KEYS.filter(function (k) { return a[k] !== b[k]; }); }
        function copy(o) { return JSON.parse(JSON.stringify(o)); }

        // ── the preview: the real TV page with the draft options, scaled into the bezel (sdx-tv directive) ──
        // The iframe loads ONCE per link (with the draft of that moment in ?set=); later changes are posted to it
        // (the TV page's 'schedule-display-preview' message, same origin), so the bezel never reloads or flickers.
        var previewToken = null, previewUrl = null;
        vm.previewUrl = function () {
            if (!vm.display_token) { return null; }
            var tok = vm.display_token + '|' + (vm.showDate || '');
            if (tok !== previewToken) {
                previewToken = tok;
                previewUrl = $sce.trustAsResourceUrl(vm.display_url + '?preview=1&set=' + encodeURIComponent(JSON.stringify(vm.draft)));
            }
            return previewUrl;
        };
        $scope.$watch(function () { return JSON.stringify(vm.draft); }, function (n, o) {
            if (n === o) { return; }
            var f = $window.document.querySelector('#sdx-tv iframe');
            if (f && f.contentWindow) { try { f.contentWindow.postMessage({ type: 'schedule-display-preview', set: vm.draft }, $window.location.origin); } catch (e) {} }
        });
        vm.openFullScreen = function () { if (vm.display_url) { $window.open(vm.display_url, '_blank'); } };

        // ── the TV link (token) and pairing — unchanged calls ──
        vm.display_token = null;
        vm.display_url = '';
        vm.display_loading = false;
        vm.display_copied = false;
        vm.pairing_code = '';
        vm.pairing_loading = false;
        vm.display_pairing_url = $window.location.origin + '/display/tv';
        vm.pairing_host = $window.location.host + '/display/tv';
        vm.shortUrl = function () {
            if (!vm.display_token) { return ''; }
            var t = vm.display_token;
            return $window.location.host + '/display/' + (t.length > 10 ? t.substr(0, 4) + '…' + t.substr(t.length - 4) : t);
        };

        vm.loadDisplayToken = function () {
            vm.display_loading = true;
            ScheduleDisplayService.GetToken(vm.club_id).then(function (data) {
                vm.display_loading = false;
                if (data.success && data.token) {
                    vm.display_token = data.token;
                    vm.display_url = $window.location.origin + '/display/' + data.token;
                } else {
                    vm.display_token = null;
                    vm.display_url = '';
                }
            }, function () { vm.display_loading = false; });
        };
        vm.generateDisplayToken = function () {
            vm.display_loading = true;
            ScheduleDisplayService.GenerateToken(vm.club_id).then(function (data) {
                vm.display_loading = false;
                if (data.success && data.token) {
                    vm.display_token = data.token;
                    vm.display_url = $window.location.origin + '/display/' + data.token;
                    ToastService.success('TV link created', 'Copy it or open it on any screen.');
                } else {
                    ToastService.error('No link created', data.message || 'The TV link could not be created.');
                }
            }, function () { vm.display_loading = false; ToastService.error('No link created', 'Could not connect to the server.'); });
        };
        vm.offAsk = function () { vm.askOff = true; };
        vm.offNo = function () { vm.askOff = false; };
        vm.offYes = function () {
            vm.askOff = false;
            vm.display_loading = true;
            ScheduleDisplayService.RevokeToken(vm.club_id).then(function (data) {
                vm.display_loading = false;
                if (data.success) {
                    vm.display_token = null;
                    vm.display_url = '';
                    ToastService.warning('TV link turned off', 'Every TV using it has stopped. Pair them again to get a new link.');
                } else {
                    ToastService.error('Still on', data.message || 'The link could not be turned off.');
                }
            }, function () { vm.display_loading = false; ToastService.error('Still on', 'Could not connect to the server.'); });
        };
        vm.copyDisplayUrl = function () {
            var done = function () {
                vm.display_copied = true;
                ToastService.success('Link copied', 'Paste it into the TV\'s browser.');
                $timeout(function () { vm.display_copied = false; }, 2000);
            };
            if ($window.navigator.clipboard && $window.navigator.clipboard.writeText) {
                $window.navigator.clipboard.writeText(vm.display_url).then(function () { $scope.$applyAsync(done); }, function () { legacyCopy(done); });
            } else { legacyCopy(done); }
        };
        function legacyCopy(done) {
            var input = $window.document.getElementById('sd_token_url');
            if (!input) { return; }
            input.select();
            try { $window.document.execCommand('copy'); } catch (e) {}
            done();
        }
        vm.openDisplayInNewTab = function () { if (vm.display_url) { $window.open(vm.display_url, '_blank'); } };

        // the code reads "000 000" while typing; digits only
        vm.codeTyped = function () {
            var digits = String(vm.pairing_code || '').replace(/\D/g, '').slice(0, 6);
            vm.pairing_code = digits.length > 3 ? digits.slice(0, 3) + ' ' + digits.slice(3) : digits;
        };
        vm.codeDigits = function () { return String(vm.pairing_code || '').replace(/\D/g, ''); };
        vm.linkPairingCode = function () {
            var code = vm.codeDigits();
            if (code.length !== 6) { ToastService.warning('Type the 6-digit code', 'It is shown on the TV at ' + vm.pairing_host + '.'); return; }
            vm.pairing_loading = true;
            ScheduleDisplayService.LinkPairingCode(code, vm.club_id).then(function (data) {
                vm.pairing_loading = false;
                if (data.success) {
                    ToastService.success('TV paired', data.message || 'It shows the schedule now.');
                    vm.pairing_code = '';
                    vm.loadDisplayToken();      // pairing creates the link when there was none
                } else {
                    ToastService.error('Not paired', data.message || 'Invalid or expired code. Check the code on the TV screen.');
                }
            }, function () { vm.pairing_loading = false; ToastService.error('Not paired', 'Could not connect to the server.'); });
        };

        vm.loadDisplayToken();
        loadOptions();

        // the TV's pairing QR: /dashboard/manage_club/schedule_display?pair_tv=472913 → the code is filled in, the person presses Pair
        var qr = String($stateParams.pair_tv || '').replace(/\D/g, '').slice(0, 6);
        if (qr) {
            vm.pairing_code = qr; vm.codeTyped();
            $location.search('pair_tv', null).replace();
            $timeout(function () {
                var el = $window.document.getElementById('sdx-code');
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
                ToastService.success('Code from the TV', 'Press "Pair this TV" to connect it.');
            }, 600);
        }
    }

/* ── the mockup's small drawings: a TV layout in miniature, and a booking as the TV draws it ── */
app.directive('sdxMini', sdxMini);
function sdxMini() {
    var C = ['#2563eb', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#0d9488'];
    function bar(x, w, c) { return '<b style="--x:' + x + '%;--w:' + w + '%' + (c ? ';--c:' + c : '') + '"></b>'; }
    function insRow(i) { return '<span class="sdx-mini__row"><i style="--c:' + C[i] + '"></i>' + bar(14 + i * 3, 26, 'var(--ta-t-dual)') + bar(46 + i * 2, 24, 'var(--ta-t-dual)') + '</span>'; }
    function hireLine(a, b) { return '<span class="sdx-mini__row">' + bar(a, 22, 'var(--ta-t-hire)') + bar(b, 26, 'var(--ta-t-hire)') + '</span>'; }
    function acRow(i, a, w) { return '<span class="sdx-mini__row sdx-mini__row--edge" style="--c:' + C[i] + '">' + bar(a, w) + '</span>'; }
    var MINI = {
        timeline: '<span class="sdx-mini__hd"></span>' + insRow(0) + insRow(1) + insRow(3) + '<span class="sdx-mini__row sdx-mini__row--grp"></span>' + hireLine(10, 50) + '<span class="sdx-mini__free"></span>',
        split: '<span class="sdx-mini__hd"></span><span class="sdx-mini__cols"><span class="sdx-mini__stack">' + insRow(0) + insRow(1) + insRow(3) + hireLine(10, 50) + '</span><span class="sdx-mini__panel"><i></i><i></i><i></i><i></i><i></i></span></span>',
        board: '<span class="sdx-mini__hd"></span>' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<span class="sdx-mini__line" style="--c:' + C[i] + '"><i></i><i></i><i></i><i></i></span>'; }).join(''),
        packed: insRow(0) + insRow(1) + insRow(3) + '<span class="sdx-mini__row sdx-mini__row--grp"></span>' + hireLine(8, 44) + hireLine(30, 70),
        instructors: insRow(0) + insRow(1) + insRow(3) + '<span class="sdx-mini__row sdx-mini__row--grp"></span>' + acRow(4, 10, 30) + acRow(5, 45, 28) + acRow(6, 60, 30),
        aircraft: [0, 1, 2, 3, 4, 5, 6].map(function (i) { return acRow(i, 10 + (i * 13) % 50, 26); }).join('')
    };
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            el.addClass('sdx-mini').attr('aria-hidden', 'true');
            el.html(MINI[attrs.sdxMini] || '');
        }
    };
}
app.directive('sdxSample', sdxSample);
function sdxSample() {
    function draw(reg, pos) {
        var shown = { circle: 'TJ', tile: 'TJ', auto: 'G-BMTJ', short: 'TJ', full: 'G-BMTJ' }[reg];
        var right = pos === 'right';
        var mark = (reg === 'circle' || reg === 'tile')
            ? '<span class="sdx-bk__badge' + (reg === 'tile' ? ' sdx-bk__badge--tile' : '') + (right ? '' : ' sdx-bk__badge--sm') + '">TJ</span>'
            : '<span class="sdx-bk__reg">' + shown + '</span>';
        return '<span class="sdx-bk' + (right ? ' sdx-bk--right' : '') + '" style="--ac:#2563eb"><span class="sdx-bk__k"><i class="fas fa-user-friends"></i></span><span class="sdx-bk__txt"><span class="sdx-bk__nm">A. Khan</span>' + (right ? '' : '<span class="sdx-bk__sub">' + mark + '</span>') + '</span>' + (right ? mark : '') + '</span>';
    }
    return {
        restrict: 'A',
        scope: { sdxSample: '@', pos: '=' },
        link: function (scope, el) {
            scope.$watch('pos', function (p) { el.html(draw(scope.sdxSample, p)); });
        }
    };
}
/* the 1920×1080 TV page scaled into whatever width the bezel has */
app.directive('sdxTv', sdxTv);
sdxTv.$inject = ['$window'];
function sdxTv($window) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            var node = el[0];
            function fit() {
                var f = node.querySelector('iframe');
                if (!f) { return; }
                var s = node.clientWidth / 1920;
                if (s > 0) { f.style.transform = 'scale(' + s + ')'; }
            }
            var ro = null;
            if ($window.ResizeObserver) { ro = new $window.ResizeObserver(fit); ro.observe(node); }
            angular.element($window).on('resize', fit);
            scope.$watch(function () { return node.querySelector('iframe') ? 1 : 0; }, fit);
            scope.$on('$destroy', function () { if (ro) { ro.disconnect(); } angular.element($window).off('resize', fit); });
        }
    };
}
