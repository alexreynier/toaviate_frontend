/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2 · Signatures (the instructor's signing queue)
   Design: mockups/instructor-dashboard/signatures.html (approved 9 Nov 2026; the number field is "FI / CRI / FE number").
   Replaces v1 dashboard.manage_user.pending_signatures (views/manageuser/pending_signatures.html,
   EndorsementQueueController + the EndorsementSignModalCtrl / EndorsementStampModalCtrl dialogs) behind the v2 switch.
   Tracker: mockups/v2-build/fe-instructor-signatures.md.

   State: dashboard.v2.instructor_signatures  /manage_user/pending_signatures  ← dashboard.manage_user.pending_signatures

   Data (be-alex-3e.md contract C34; the same routes as v1, through LogbookEndorsementsService):
     GET    logbook_endorsements/queue           → {success, queue[]}: the stored row + pilot_name, club_title,
                                                   line_state live|retired|missing, can_sign, cannot_sign_reason,
                                                   line (null when missing) + plane_id, aircraft_type, aircraft_colour,
                                                   departure_name, arrival_name, retired_reason merged|claim_cancelled|null
     POST   logbook_endorsements/{id}/sign       {instructor_name, instructor_number, endorsement_text,
                                                   signature_image | use_saved_signature:true}  (several = one call per line)
     POST   logbook_endorsements/{id}/decline    {reason} → {success, pilot_emailed}  (D17: the pilot is e-mailed the reason)
     DELETE logbook_endorsements/{id}            withdraw a signature made this visit (the signing instructor may)
     GET | POST | DELETE logbook_endorsements/my_signature   the saved stamp
   Any missing C34 field falls back (older backend): line_state from line, can_sign from the line, type from the model.
   Signing without a request (POST logbook_endorsements/sign, D16) is not on this screen (Hours instructed, later).

   Here: SignaturesV2Data (reads, writes, words) · <sgn-pad> (the signature pad, mockup markup) · sgn-ink (a saved
   signature drawn in the theme's ink) · sgn-portal (a dialog moved to <body>) · InstructorSignaturesV2Controller.
   Views: views/v2/instructor_signatures/*.html · CSS: css/v2/instructor-signatures.css (sgn-).
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.instructor_signatures', {
        url: '/manage_user/pending_signatures',
        templateUrl: 'views/v2/instructor_signatures/signatures.html',
        controller: 'InstructorSignaturesV2Controller',
        controllerAs: 'vm'
    });
    DesignRoutesProvider.map('dashboard.manage_user.pending_signatures', 'dashboard.v2.instructor_signatures');
}]);


/* ═════ SignaturesV2Data: the reads and writes (v1's service), and one helper per domain (raw values never reach the screen) ═════ */
app.factory('SignaturesV2Data', SignaturesV2Data);
SignaturesV2Data.$inject = ['LogbookEndorsementsService', 'InsCore', '$sce'];
function SignaturesV2Data(LogbookEndorsementsService, InsCore, $sce) {
    var LES = LogbookEndorsementsService;
    // the role on the student's line (capacity), as My logbook says it
    var CAP = {
        P1: { label: 'PIC', long: 'Pilot in command — a solo' },
        PUT: { label: 'Dual', long: 'Student with an instructor' },
        PICUS: { label: 'PICUS', long: 'Pilot in command under supervision' },
        P2: { label: 'Co-pilot', long: 'Co-pilot' }
    };
    var NO_CAP = { label: 'Role not recorded', long: 'Role not recorded' };
    // C34 error codes in words (the server's own message wins when it has one)
    var ERRORS = {
        LINE_RETIRED: 'This flight is no longer in the student’s logbook, so a signature on it would not show.',
        FORBIDDEN: 'You can’t sign this line: it needs a live instructor membership of the flight’s club, and the request must name you.',
        NOT_YOUR_FLIGHT: 'You weren’t this flight’s instructor, so you can sign it only when the student asks you.',
        UNSUPPORTED_CHARACTERS: 'Emoji can’t be saved. Remove them and try again.'
    };

    return {
        wordings: LES.wordings,
        Queue: Queue,
        Stamp: Stamp,
        SaveStamp: function (image, name, number) { return LES.SaveMySignature(image, name, number); },
        DeleteStamp: function () { return LES.DeleteMySignature(); },
        Sign: function (id, body) { return LES.SignRequest(id, body); },
        Decline: function (id, reason) { return LES.Decline(id, reason); },
        Withdraw: function (id) { return LES.Revoke(id); },
        ok: ok,
        errorText: errorText,
        cap: cap,
        waited: waited,
        decorate: decorate,
        doneSub: doneSub
    };

    function ok(res) { return !!res && res.success !== false; }
    function errorText(res, fallback) {
        if (!res) { return fallback; }
        var msg = typeof res.message === 'string' ? res.message : (res.message && typeof res.message.message === 'string' ? res.message.message : '');
        if (msg && !/^\s*</.test(msg) && msg !== 'Request failed') { return msg; }
        return ERRORS[res.error] || fallback;
    }
    function cap(c) { return CAP[c] || NO_CAP; }
    // 'today' · 'yesterday' · '6 days ago' · '3 weeks ago'
    function waited(days) { return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? days + ' days ago' : Math.floor(days / 7) + ' weeks ago'; }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function icao(c) { return '<b class="ta-icao">' + esc(c) + '</b>'; }

    function Queue() {
        return LES.Queue().then(function (d) {
            if (!ok(d)) { return { success: false, message: errorText(d, 'Your signing queue could not be loaded.') }; }
            var today = InsCore.today();
            var rows = (d.queue || d.requests || []).map(function (r) { return decorate(r, today); });
            rows.sort(function (a, b) { return a.created < b.created ? -1 : a.created > b.created ? 1 : a.id - b.id; });   // oldest first, as v1
            return { success: true, queue: rows };
        });
    }
    function Stamp() {
        return LES.GetMySignature().then(function (d) {
            if (!ok(d)) { return { success: false, message: errorText(d, 'Your stamp could not be loaded.') }; }
            var g = d.exists && d.signature ? d.signature : null;
            return { success: true, stamp: g ? { image: g.signature_image || '', name: g.instructor_name || '', number: g.instructor_number || '', updated: g.updated_at || null } : null };
        });
    }

    /* one queue row → everything the templates show, worked out once */
    function decorate(r, today) {
        var l = r.line || null;
        var state = r.line_state || (l ? 'live' : 'missing');
        var gone = !l || state !== 'live';
        var created = String(r.created_at || '');
        var days = created ? InsCore.daysBetween(created.slice(0, 10), today) : 0;
        var pilot = String(r.pilot_name || '').trim() || 'A student';
        var first = InsCore.firstName(pilot);
        var x = {
            id: +r.id, pid: +r.pilot_user_id || 0, pilot: pilot, first: first,
            note: String(r.request_note || '').trim() || null,
            clubId: +r.club_id || 0, clubTitle: r.club_title || '',
            created: created, days: days, old: days >= 14,
            ago: waited(days), askedDay: created ? 'asked ' + InsCore.fDay(created) : '',
            asked: created ? InsCore.fDay(created) + ' ' + InsCore.fTime(created) : '',
            askedShort: created ? InsCore.fDay(created) : '',
            gone: gone, state: state,
            why: r.cannot_sign_reason || null,
            line: null
        };
        // C34: can_sign is false for a gone line, or when the caller no longer teaches at the club (Decline still works)
        x.canSign = !gone && (r.can_sign === undefined || r.can_sign === null ? true : !!r.can_sign);
        x.blocked = !gone && !x.canSign;
        if (gone) {
            // a missing or retired line (merged into another flight, or its claim cancelled): Decline only, and why
            x.edge = 'var(--ta-bad)';
            // C34 line.retired_reason (merged | claim_cancelled); an older backend without it: read cannot_sign_reason's words
            var rr = l && l.retired_reason ? l.retired_reason : (/merged/i.test(x.why || '') ? 'merged' : /claim/i.test(x.why || '') ? 'claim_cancelled' : null);
            var merged = state === 'retired' && rr === 'merged', claim = state === 'retired' && rr === 'claim_cancelled';
            x.retiredReason = state === 'retired' ? rr : null;
            x.goneSub = merged ? 'Merged into another flight after ' + first + ' asked'
                : claim ? 'Its claim was cancelled after ' + first + ' asked'
                : 'Deleted or merged after ' + first + ' asked';
            x.goneWhy = merged ? 'It was merged into another flight after ' + first + ' asked'
                : claim ? 'Its claim was cancelled after ' + first + ' asked'
                : 'It was deleted or merged into another flight after ' + first + ' asked';
            return x;
        }
        var c = cap(l.capacity), dep = l.departure_place || '', arr = l.arrival_place || '';
        var local = !arr || dep === arr;
        var hours = +l.total_time || 0;
        var times = l.departure_time && l.arrival_time ? l.departure_time + '–' + l.arrival_time : (l.departure_time || l.arrival_time || '');
        x.line = {
            reg: l.registration || '', type: l.aircraft_type || l.aircraft_model || '', model: l.aircraft_model || l.aircraft_type || '',
            colour: l.aircraft_colour || null, date: l.flight_date || '', dep: dep, arr: arr, local: local,
            off: l.departure_time || '', on: l.arrival_time || '', hours: hours, hm: InsCore.hm(hours), cap: c
        };
        x.edge = x.line.colour || 'var(--ta-line-2)';
        x.day = InsCore.fDay(l.flight_date);
        x.routeShort = local ? (dep || '—') + ' local' : (dep || '—') + ' → ' + arr;
        x.titleHtml = $sce.trustAsHtml(esc(x.day) + ' · ' + (local ? icao(dep || '—') + ' local' : icao(dep || '—') + ' → ' + icao(arr)));
        x.sub = [times, x.line.hm, c.label].filter(Boolean).join(' · ');
        x.dateLong = InsCore.fDayLong(l.flight_date);
        function nm(code, name) { return name && name !== code ? ' <span class="ta-muted">' + esc(name) + '</span>' : ''; }
        x.routeLongHtml = $sce.trustAsHtml(local
            ? icao(dep || '—') + nm(dep, l.departure_name) + ' · local'
            : icao(dep || '—') + nm(dep, l.departure_name) + ' → ' + icao(arr) + nm(arr, l.arrival_name));
        x.brakes = (l.departure_time || '—') + ' → ' + (l.arrival_time || '—');
        x.dlgTitle = x.day + ' ' + String(l.flight_date || '').slice(0, 4) + ' · ' + x.line.reg;
        x.dlgSub = x.routeShort + ' · ' + [times, x.line.hm + ' ' + c.label].filter(Boolean).join(' · ') + ' · ';
        x.batchSub = pilot + ' · ' + x.day + ' · ' + x.routeShort;
        return x;
    }
    // a line in "Done this visit": 'Fri 30 Oct · EGLD → EGTK · 1:45 · “wording”'
    function doneSub(x, text) {
        if (!x.line) { return 'Flight no longer in the logbook'; }
        return x.day + ' · ' + x.routeShort + ' · ' + x.line.hm + (text ? ' · “' + text + '”' : '');
    }
}


/* ═════ <sgn-pad image="…" label="…" clear-label="…" on-draw="…"> — the signature pad as the mockup draws it: a dashed
   box with "Sign here with your finger or mouse", solid once signed, and "Clear and sign again" under it.
   The pen shows in the theme's ink (as the mockup's stamp does: light at night). The image handed back is always drawn
   in dark ink (#1e3a5f, v1's pen) on a transparent ground, because it goes on logbooks and CAA forms. Model = '' or a
   'data:image/png' URL (the only format the backend accepts), retina capped at 2×. The drawing survives resizes
   (phone keyboards fire them). Uses the checked-in libs/js/signature_pad.js (global SignaturePad), as v1's <sig-pad>. ═════ */
app.directive('sgnPad', ['$timeout', '$window', function ($timeout, $window) {
    var INK = '#1e3a5f', MIN_W = 0.8, MAX_W = 2.2;
    return {
        restrict: 'E',
        scope: { image: '=', label: '@', clearLabel: '@', onDraw: '&' },
        template:
            '<div class="sgn-pad" ng-class="{\'sgn-pad--on\': drawn}" role="img" aria-label="{{ drawn ? \'Signature drawn\' : label }}">' +
              '<canvas class="sgn-pad__cv"></canvas>' +
              '<span class="sgn-pad__hint" ng-if="!drawn"><i class="fas fa-signature" aria-hidden="true"></i>{{ label }}</span>' +
            '</div>' +
            '<button type="button" class="ta-link" ng-if="drawn" ng-click="clear()" no-busy-guard><i class="fas fa-eraser" aria-hidden="true"></i>{{ clearLabel }}</button>',
        link: function (scope, element) {
            var box = element[0].querySelector('.sgn-pad'), canvas = element[0].querySelector('canvas');
            var pad = null, ratio = 1, ro = null, tries = 0;
            scope.drawn = false;

            function ink() { var v = ''; try { v = getComputedStyle(box).getPropertyValue('--ta-ink').trim(); } catch (e) {} return v || INK; }
            function size() {
                var w = canvas.offsetWidth, h = canvas.offsetHeight;
                if (!w || !h) { return false; }
                var r = Math.max(1, Math.min($window.devicePixelRatio || 1, 2));
                if (canvas.width === Math.round(w * r) && canvas.height === Math.round(h * r)) { return true; }
                var data = pad ? pad.toData() : null;
                ratio = r;
                canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
                canvas.getContext('2d').scale(ratio, ratio);
                if (pad) { pad.clear(); if (data && data.length) { pad.fromData(data); } }
                return true;
            }
            /* the stored image: the same strokes re-drawn in dark ink on a transparent canvas of the same size */
            function exportPng() {
                var data = pad ? pad.toData() : [];
                if (!data.length) { return ''; }
                var off = document.createElement('canvas');
                off.width = canvas.width; off.height = canvas.height;
                off.getContext('2d').scale(ratio, ratio);
                var p2 = new $window.SignaturePad(off, { penColor: INK, minWidth: MIN_W, maxWidth: MAX_W });
                p2.fromData(data.map(function (g) { return angular.extend({}, g, { penColor: INK }); }));
                var url = p2.toDataURL('image/png');
                p2.off();
                return url;
            }
            function init() {
                if (typeof $window.SignaturePad === 'undefined') { return; }
                if (!size()) { if (tries++ < 30) { $timeout(init, 60, false); } return; }
                pad = new $window.SignaturePad(canvas, { penColor: ink(), minWidth: MIN_W, maxWidth: MAX_W });
                pad.addEventListener('beginStroke', function () { pad.penColor = ink(); });
                pad.addEventListener('endStroke', function () {
                    scope.$applyAsync(function () {
                        var url = pad.isEmpty() ? '' : exportPng();
                        scope.drawn = !!url;
                        scope.image = url;
                        if (url) { scope.onDraw(); }
                    });
                });
                if ($window.ResizeObserver) { ro = new $window.ResizeObserver(function () { size(); }); ro.observe(canvas); }
                else { $window.addEventListener('resize', size); }
            }
            scope.clear = function () {
                if (pad) { pad.clear(); }
                scope.drawn = false;
                scope.image = '';
            };
            // the page resets the model (a dialog opened again): follow it
            scope.$watch('image', function (v) { if (!v && scope.drawn) { if (pad) { pad.clear(); } scope.drawn = false; } });

            $timeout(init, 0, false);
            scope.$on('$destroy', function () {
                if (ro) { ro.disconnect(); } else { $window.removeEventListener('resize', size); }
                if (pad) { pad.off(); }
            });
        }
    };
}]);


/* ═════ sgn-ink="expr" — a saved signature (a PNG data URL) drawn as a mask in the theme's ink, like the mockup's stamp
   (dark by day, light at night), with no night-mode rule. An image that isn't transparent (an old opaque stamp) is shown
   as it is instead. ═════ */
app.directive('sgnInk', function () {
    function transparent(img) {
        try {
            var w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
            if (!w || !h) { return false; }
            c.width = w; c.height = h;
            var ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            var pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [Math.floor(w / 2), 0]];
            return pts.some(function (p) { return ctx.getImageData(p[0], p[1], 1, 1).data[3] < 16; });
        } catch (e) { return false; }
    }
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var el = element[0], seq = 0;
            scope.$watch(attrs.sgnInk, function (url) {
                var mine = ++seq;
                el.classList.remove('sgn-sig--mask', 'sgn-sig--img');
                el.style.webkitMaskImage = ''; el.style.maskImage = ''; el.style.backgroundImage = '';
                if (!url || !/^data:image\/png;base64,/.test(url)) { return; }
                var img = new Image();
                img.onload = function () {
                    if (mine !== seq) { return; }
                    var u = 'url("' + url + '")';
                    if (transparent(img)) { el.style.webkitMaskImage = u; el.style.maskImage = u; el.classList.add('sgn-sig--mask'); }
                    else { el.style.backgroundImage = u; el.classList.add('sgn-sig--img'); }
                };
                img.src = url;
            });
        }
    };
});

/* sgn-portal — moves a dialog's scrim to <body> while it lives (page stacking and the fixed header can't trap it), with
   ngAnimate off on it: design.js turns ngAnimate off inside every <main class="ta-page">, and the dialog lives outside main
   (an ng-if block with a CSS animation would otherwise stay on screen for that animation's length after it is removed). */
app.directive('sgnPortal', ['$animate', function ($animate) {
    return {
        restrict: 'A',
        link: function (scope, el) {
            $animate.enabled(el, false);
            document.body.appendChild(el[0]);
            scope.$on('$destroy', function () { el.remove(); });
        }
    };
}]);


/* ═════ the page ═════ */
app.controller('InstructorSignaturesV2Controller', InstructorSignaturesV2Controller);
InstructorSignaturesV2Controller.$inject = ['$scope', '$q', '$timeout', '$document', '$window', 'SignaturesV2Data', 'InsCore', 'TaComboMatch', 'ToastService'];
function InstructorSignaturesV2Controller($scope, $q, $timeout, $document, $window, SignaturesV2Data, InsCore, TaComboMatch, ToastService) {
    var vm = this, D = SignaturesV2Data, M = TaComboMatch;
    var NUM_KEY = 'toaviate_instructor_number';   // v1's key: the number is remembered between visits
    var DLG = { sign: 'views/v2/instructor_signatures/sign_dialog.html', batch: 'views/v2/instructor_signatures/batch_dialog.html', stamp: 'views/v2/instructor_signatures/stamp_dialog.html' };
    var phoneMq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    var reduce = $window.matchMedia ? $window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var lastFocus = null;

    vm.wordings = D.wordings;
    vm.load = 'loading';          // loading | ready | error
    vm.loadMsg = '';
    vm.queue = [];
    vm.done = [];                 // signed / declined in this visit: [{ r, kind, text, reason, withdrawn, sub }]
    vm.stamp = null;              // { image, name, number, updated } | null
    vm.stampState = 'ok';         // ok | error (the stamp read failed: no stamp features until it loads)
    vm.sel = {};
    vm.nSel = 0;
    vm.openId = null;             // the opened row
    vm.decId = null;              // the row asking "Decline …?"
    vm.reason = '';
    vm.wdId = null;               // the done line asking "Take your stamp off …?"
    vm.club = 0;                  // 0 = all clubs
    vm.old = false;               // "Over 2 weeks" only
    vm.find = null;               // 's:<pilot id>' | 'a:<registration>'
    vm.findValue = null;
    vm.cbQ = '';
    vm.cbVer = 0;
    vm.gen = 0;                   // bumped when a filter changes, so the rows rise in again
    vm.dlg = null;                // sign | batch | stamp
    vm.dlgTpl = null;
    vm.busy = false;
    vm.form = null;
    vm.sform = null;
    vm.rmAsk = false;
    vm.all = [];
    vm.shown = [];
    vm.clubs = [];
    vm.skel = [0, 1, 2, 3];

    vm.reload = load;
    vm.reloadStamp = function () { loadStamp(); };
    vm.setClub = setClub;
    vm.setOld = setOld;
    vm.toggle = toggle;
    vm.selChanged = recount;
    vm.selAll = selAll;
    vm.selNone = function () { vm.sel = {}; recount(); };
    vm.findSource = findSource;
    vm.findPick = findPick;
    vm.findClear = findClear;
    vm.openSign = openSign;
    vm.openBatch = openBatch;
    vm.pickWord = pickWord;
    vm.fixed = fixed;
    vm.signGo = signGo;
    vm.batchGo = batchGo;
    vm.declineAsk = declineAsk;
    vm.declineNo = function () { if (!vm.busy) { vm.decId = null; } };
    vm.declineGo = declineGo;
    vm.wdAsk = function (d) { if (!vm.busy) { vm.wdId = d.r.id; } };
    vm.wdNo = function () { if (!vm.busy) { vm.wdId = null; } };
    vm.wdGo = wdGo;
    vm.openStamp = openStamp;
    vm.stampSave = stampSave;
    vm.rmStart = function () { if (!vm.busy) { vm.rmAsk = true; } };
    vm.rmNo = function () { if (!vm.busy) { vm.rmAsk = false; } };
    vm.rmGo = rmGo;
    vm.close = closeDlg;
    vm.scrim = function (e) { if (e && e.target === e.currentTarget) { closeDlg(); } };
    vm.myName = function () { var u = InsCore.me(); return ((u.first_name || '') + ' ' + (u.last_name || '')).trim(); };

    phPlaceholder();
    if (phoneMq && phoneMq.addListener) { phoneMq.addListener(onMq); }
    load();

    /* ── reads ── */
    function load() {
        vm.load = 'loading';
        $q.all([D.Queue(), D.Stamp()]).then(function (res) {
            var q = res[0];
            if (!D.ok(q)) { vm.load = 'error'; vm.loadMsg = q.message; return; }
            vm.queue = q.queue;
            setStamp(res[1]);
            vm.load = 'ready';
            keepState();
            refresh();
        });
    }
    function loadStamp() {
        return D.Stamp().then(function (st) {
            if (!D.ok(st) && vm.stampState === 'ok' && vm.stamp) { return; }   // a failed re-read keeps the stamp just saved
            setStamp(st);
            refresh();
        });
    }
    function setStamp(st) {
        if (D.ok(st)) { vm.stamp = st.stamp; vm.stampState = 'ok'; } else { vm.stamp = null; vm.stampState = 'error'; }
        stampWords();
    }
    function stampWords() {
        var s = vm.stamp;
        vm.stampTitle = s ? 'Your stamp · ' + (s.name || vm.myName()) + (s.number ? ' · No. ' + s.number : '') : '';
        vm.stampSub = s ? 'Signs each line with one tap. ' + (s.updated ? 'Saved ' + InsCore.fDate(s.updated) + '; CAA forms use the same stamp.' : 'CAA forms use the same stamp.') : '';
    }
    // after a re-read: drop selections and the opened row for lines that have gone
    function keepState() {
        var ids = {};
        vm.queue.forEach(function (r) { ids[r.id] = r; });
        Object.keys(vm.sel).forEach(function (k) { if (!ids[k] || !ids[k].canSign) { delete vm.sel[k]; } });
        if (vm.openId && !ids[vm.openId]) { vm.openId = null; vm.decId = null; }
        if (vm.club && !vm.queue.some(function (r) { return r.clubId === vm.club; })) { vm.club = 0; }
    }

    /* ── what the page shows (worked out when something changes, never per digest) ── */
    function inScope() { return vm.queue.filter(function (r) { return !vm.club || r.clubId === vm.club; }); }
    function matchFind(r) { return vm.find.indexOf('a:') === 0 ? !!r.line && r.line.reg === vm.find.slice(2) : 's:' + r.pid === vm.find; }
    function refresh() {
        var all = inScope();
        vm.all = all;
        vm.oldN = all.filter(function (r) { return r.old; }).length;
        if (!vm.oldN) { vm.old = false; }
        if (vm.find && !all.some(matchFind)) { vm.find = null; }
        vm.shown = all.filter(function (r) { return (!vm.old || r.old) && (!vm.find || matchFind(r)); });
        vm.signable = vm.shown.filter(function (r) { return r.canSign; }).length;
        // the club switch, only with more than one club in the queue
        var seen = {}, clubs = [];
        vm.queue.forEach(function (r) {
            if (!seen[r.clubId]) { seen[r.clubId] = { id: r.clubId, title: r.clubTitle || 'Club', n: 0 }; clubs.push(seen[r.clubId]); }
            seen[r.clubId].n++;
        });
        clubs.sort(function (a, b) { return a.id - b.id; });
        vm.clubs = clubs.length > 1 ? clubs : [];
        // the search shows from four lines (the mockup), and stays while it filters, so it can always be cleared
        vm.search = vm.queue.length > 3 || !!vm.find;
        vm.tools = vm.search || clubs.length > 1;
        setValue();
        recount();
    }
    function recount() {
        var ids = {};
        vm.queue.forEach(function (r) { ids[r.id] = r; });
        Object.keys(vm.sel).forEach(function (k) { if (!vm.sel[k] || !ids[k]) { delete vm.sel[k]; } });
        vm.nSel = Object.keys(vm.sel).length;
    }

    /* ── club switch · "Over 2 weeks" · opening a row · selection ── */
    function setClub(id) {
        if (vm.club === id) { return; }
        vm.club = id; vm.openId = null; vm.decId = null; vm.sel = {};
        vm.gen++; refresh();
    }
    function setOld(on) {
        if (vm.old === !!on) { return; }
        vm.old = !!on; vm.openId = null; vm.decId = null;
        vm.gen++; refresh();
    }
    function toggle(r) {
        if (vm.busy && vm.decId === r.id) { return; }
        vm.openId = vm.openId === r.id ? null : r.id;
        vm.decId = null;
    }
    function selAll() {
        if (vm.nSel) { vm.sel = {}; recount(); return; }
        vm.shown.forEach(function (r) { if (r.canSign) { vm.sel[r.id] = true; } });
        recount();
    }

    /* ── the search over the queue's students and aircraft (the shared <ta-combo>, js/v2/logbook/logbook.js): a student row is
       the grey person icon and only its name is underlined (noHlSub), as the mockup draws it ── */
    function onMq() { $scope.$applyAsync(phPlaceholder); }
    function phPlaceholder() { vm.findPh = phoneMq && phoneMq.matches ? 'Student or aircraft' : 'Find a student or aircraft — BA finds G-SHBA'; }
    function findSource(q) {
        q = String(q || '').trim();
        var t = M.toks(q), st = {}, sk = [], ac = {}, ak = [];
        inScope().forEach(function (r) {
            if (!st[r.pid]) { st[r.pid] = { name: r.pilot, n: 0 }; sk.push(r.pid); }
            st[r.pid].n++;
            if (r.line && r.line.reg) {
                if (!ac[r.line.reg]) { ac[r.line.reg] = { n: 0, colour: r.line.colour, type: r.line.type, model: r.line.model }; ak.push(r.line.reg); }
                ac[r.line.reg].n++;
            }
        });
        function sSc(name) {
            if (!t.length) { return 1; }
            var sc = 0;
            for (var i = 0; i < t.length; i++) { if (!M.wordHit(name, t[i])) { return 0; } sc += M.norm(name).indexOf(t[i]) === 0 ? 2 : 1; }
            return sc;
        }
        function aSc(reg) {
            if (!t.length) { return 1; }
            var a = ac[reg], sc = 0;
            for (var i = 0; i < t.length; i++) {
                var v = M.regScore(reg, t[i]) || (M.wordHit((a.type || '') + ' ' + (a.model || ''), t[i]) ? 40 : 0);
                if (!v) { return 0; }
                sc += v;
            }
            return sc;
        }
        var sl = sk.filter(function (k) { return sSc(st[k].name); }).sort(function (a, b) {
            return sSc(st[b].name) - sSc(st[a].name) || st[b].n - st[a].n || (st[a].name < st[b].name ? -1 : st[a].name > st[b].name ? 1 : 0);
        });
        var al = ak.filter(aSc).sort(function (a, b) { return aSc(b) - aSc(a) || ac[b].n - ac[a].n; });
        var gS = {
            label: 'Students',
            right: q ? InsCore.plural(sl.length, 'match', 'matches') : sl.length > 8 ? 'most lines first · type a name' : InsCore.plural(sl.length, 'student'),
            rows: sl.slice(0, q ? 50 : 8).map(function (k) { return { key: 's:' + k, av: { member: true, title: st[k].name }, t: st[k].name, s: InsCore.plural(st[k].n, 'line') + ' waiting', noHlSub: true, on: vm.find === 's:' + k }; })
        };
        var gA = {
            label: 'Aircraft',
            right: InsCore.plural(al.length, 'aircraft', 'aircraft'),
            rows: al.map(function (reg) { return { key: 'a:' + reg, ac: ac[reg].colour || undefined, t: reg, s: ac[reg].model || '', r: InsCore.plural(ac[reg].n, 'line'), on: vm.find === 'a:' + reg }; })
        };
        var n = M.norm(q).length;
        var regFirst = n > 0 && n < 3 && al.some(function (reg) { return aSc(reg) >= 90; });
        return { groups: regFirst ? [gA, gS] : [gS, gA], empty: { t: 'No request matches “' + q + '”', s: 'Try a student’s first name, or the last two letters of a registration.' } };
    }
    function setValue() {
        var f = vm.find, v = null;
        if (f && f.indexOf('a:') === 0) {
            var reg = f.slice(2), r = vm.queue.filter(function (x) { return x.line && x.line.reg === reg; })[0];
            v = { ac: { reg: reg, type: r ? r.line.type : '', colour: r ? r.line.colour : '', title: reg + (r && r.line.model ? ' · ' + r.line.model : '') } };
        } else if (f) {
            var p = vm.queue.filter(function (x) { return 's:' + x.pid === f; })[0];
            v = { av: { member: true, title: p ? p.pilot : '' }, name: p ? p.pilot : '' };   // 24px, as the Signatures mockup draws it (memberIcon(true))   // a student: the grey person icon (initials = instructors)
        }
        if (!angular.equals(v, vm.findValue)) { vm.findValue = v; }
    }
    function findPick(key) {
        vm.find = key; vm.cbQ = ''; vm.openId = null; vm.decId = null;
        vm.gen++; refresh();
    }
    function findClear() {
        vm.find = null; vm.cbQ = ''; vm.old = false; vm.openId = null; vm.decId = null;
        vm.gen++; refresh();
    }

    /* ── dialogs: a record dialog on desktop, a bottom sheet on phones (ta-base); Esc, the scrim and × close them ── */
    function openDlg(name) {
        lastFocus = document.activeElement;
        vm.busy = false;
        vm.dlg = name;
        vm.dlgTpl = DLG[name];
        $timeout(function () { var el = document.querySelector('body > .ta-dlg-scrim .ta-dlg'); if (el) { el.focus(); } }, 40, false);
    }
    function closeDlg() {
        if (vm.busy || !vm.dlg) { return; }
        if (vm.form && vm.form.rows) { vm.form.rows.forEach(function (r) { delete r._st; delete r._err; }); }
        vm.dlg = null; vm.dlgTpl = null; vm.rmAsk = false; vm.form = null; vm.sform = null;
        var back = lastFocus; lastFocus = null;
        $timeout(function () { if (back && back.focus && document.documentElement.contains(back)) { back.focus(); } }, 0, false);
    }
    function savedNumber() { try { return localStorage.getItem(NUM_KEY) || ''; } catch (e) { return ''; } }
    function rememberNumber(n) { try { localStorage.setItem(NUM_KEY, n || ''); } catch (e) {} }
    function focusField(id) { $timeout(function () { var el = document.getElementById(id); if (el) { el.focus(); } }, 0, false); }
    function pickWord(F, w) { F.text = w; fixed(F, 'text'); }
    // a field the user has just changed: its error goes
    function fixed(F, key) { if (F && F.err && F.err[key]) { F.err[key] = null; } }

    function openSign(r) {
        if (!r || !r.canSign || vm.busy) { return; }
        vm.form = { row: r, name: vm.myName(), num: savedNumber() || (vm.stamp ? vm.stamp.number : ''), text: '', saved: !!vm.stamp, image: '', err: {} };
        vm.form.savedFrom = vm.stamp && vm.stamp.updated ? 'Your stamp from ' + InsCore.fDate(vm.stamp.updated) + '.' : 'Your saved stamp.';
        openDlg('sign');
    }
    function signGo() {
        var F = vm.form;
        if (vm.busy || !F) { return; }
        var usingSaved = !!(vm.stamp && F.saved), err = {};
        if (!usingSaved && !String(F.name || '').trim()) { err.name = 'Enter your full name as it should appear on the stamp'; }
        if (!String(F.text || '').trim()) { err.text = 'Pick a wording, or type your own'; }
        if (!usingSaved && !F.image) { err.sig = 'Draw your signature in the pad'; }
        F.err = err;
        if (err.name) { focusField('end-sign-name'); return; }
        if (err.text) { focusField('end-sign-text'); return; }
        if (err.sig) {
            $timeout(function () { var p = document.querySelector('body > .ta-dlg-scrim .sgn-pad'); if (p && p.scrollIntoView) { p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 0, false);
            return;
        }
        rememberNumber(String(F.num || '').trim());   // the backend snapshots it per stamp; v1 remembers it locally too
        var body = { instructor_name: String(F.name || '').trim(), instructor_number: String(F.num || '').trim(), endorsement_text: String(F.text).trim() };
        if (usingSaved) { body.use_saved_signature = true; } else { body.signature_image = F.image; }
        var r = F.row;
        vm.busy = true;
        D.Sign(r.id, body).then(function (res) {
            vm.busy = false;
            if (!D.ok(res)) {
                ToastService.error('Not signed', D.errorText(res, 'Please try again.'));
                if (res && res.error === 'LINE_RETIRED') { refreshQueue(); }
                return;
            }
            closeDlg();
            leave([r], { kind: 'signed', text: body.endorsement_text }, function () {
                ToastService.success('Signed', 'The stamp is on ' + r.pilot + '’s logbook.', { confetti: false });
            });
        });
    }

    function openBatch() {
        if (!vm.stamp || !vm.nSel || vm.busy) { return; }
        var rows = vm.queue.filter(function (r) { return vm.sel[r.id] && r.canSign; });
        if (!rows.length) { return; }
        vm.form = { rows: rows, name: vm.stamp.name || vm.myName(), num: vm.stamp.number || '', text: D.wordings[0], err: {}, at: 0, n: rows.length };
        batchWords();
        openDlg('batch');
    }
    function batchWords() {
        var F = vm.form, who = {};
        F.rows.forEach(function (r) { who[r.pid || r.pilot] = 1; });
        F.title = InsCore.plural(F.rows.length, 'logbook line');
        F.sub = InsCore.plural(Object.keys(who).length, 'student') + ' · each line gets its own stamp';
    }
    /* several lines with the saved stamp: one call per line, in order. Each line shows how it went; the ones that fail
       stay in the dialog with the reason, the signed ones leave the queue. */
    function batchGo() {
        var F = vm.form;
        if (vm.busy || !F) { return; }
        if (!String(F.text || '').trim()) { F.err = { text: 'Pick a wording, or type your own' }; focusField('end-sign-text'); return; }
        F.err = {};
        var rows = F.rows.slice(), signed = [], failed = [];
        var body = { instructor_name: String(F.name || '').trim(), instructor_number: String(F.num || '').trim(), endorsement_text: String(F.text).trim(), use_saved_signature: true };
        rows.forEach(function (r) { r._st = 'wait'; delete r._err; });
        vm.busy = true;
        F.at = 0; F.n = rows.length;
        (function next(i) {
            if (i >= rows.length) { finish(); return; }
            var r = rows[i];
            r._st = 'busy'; F.at = i + 1;
            $timeout(function () { var el = document.getElementById('sgn-ln-' + r.id); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'nearest' }); } }, 0, false);
            D.Sign(r.id, body).then(function (res) {
                if (D.ok(res)) { r._st = 'done'; signed.push(r); }
                else { r._st = 'bad'; r._err = D.errorText(res, 'Not signed. Please try again.'); failed.push(r); ToastService.handledInline(); }
                next(i + 1);
            });
        })(0);
        function finish() {
            vm.busy = false;
            rememberNumber(body.instructor_number);
            signed.forEach(function (r) { delete vm.sel[r.id]; delete r._st; });
            recount();
            var n = signed.length;
            if (!failed.length) {
                closeDlg();
                leave(signed, { kind: 'signed', text: body.endorsement_text }, function () {
                    ToastService.success('Signed ' + InsCore.plural(n, 'line'), 'Each student sees your stamp on their logbook.', { confetti: false });
                });
                return;
            }
            F.rows = failed;
            F.n = failed.length;
            batchWords();
            if (n) { leave(signed, { kind: 'signed', text: body.endorsement_text }); }
            ToastService.warning(n ? 'Signed ' + n + ' of ' + (n + failed.length) : 'Nothing signed',
                InsCore.plural(failed.length, 'line') + ' couldn’t be signed; the reason is under each one.');
        }
    }

    /* ── decline (in place, in the opened row) ── */
    function declineAsk(r) {
        if (vm.busy) { return; }
        vm.openId = r.id; vm.decId = r.id; vm.reason = '';
        $timeout(function () { var el = document.getElementById('sgn-reason'); if (el) { el.focus(); } }, 30, false);
    }
    function declineGo(r) {
        if (vm.busy) { return; }
        var reason = String(vm.reason || '').trim();
        vm.busy = true;
        D.Decline(r.id, reason).then(function (res) {
            vm.busy = false;
            if (!D.ok(res)) { ToastService.error('Not declined', D.errorText(res, 'Please try again.')); refreshQueue(); return; }
            vm.decId = null;
            leave([r], { kind: 'declined', reason: reason }, function () {
                // D17: the backend e-mails the student the reason (pilot_emailed says it went)
                ToastService.success('Declined', res.pilot_emailed
                    ? r.first + ' has been e-mailed' + (reason ? ' your reason' : '') + ' and sees it as declined on the line.'
                    : r.first + ' sees it as declined on the line' + (reason ? ', with your reason' : '') + '.', { confetti: false });
            });
        });
    }

    /* ── withdraw a signature made this visit (two steps) ── */
    function wdGo(d) {
        if (vm.busy) { return; }
        vm.busy = true;
        D.Withdraw(d.r.id).then(function (res) {
            vm.busy = false;
            if (!D.ok(res)) { ToastService.error('Not withdrawn', D.errorText(res, 'Please try again.')); return; }
            d.withdrawn = true; vm.wdId = null;
            ToastService.success('Withdrawn', 'Your stamp is off ' + d.r.pilot + '’s line.', { confetti: false });
        });
    }

    /* ── my stamp ── */
    function openStamp() {
        if (vm.busy) { return; }
        var cur = vm.stamp, me = vm.myName();
        vm.rmAsk = false;
        vm.sform = { name: cur ? (cur.name || me) : me, num: cur ? (cur.number || savedNumber()) : savedNumber(), image: '', err: {} };
        vm.sform.title = cur ? (cur.name || me) : 'Save your stamp';
        vm.sform.sub = cur ? [cur.number ? 'No. ' + cur.number : '', cur.updated ? 'saved ' + InsCore.fDate(cur.updated) : 'saved'].filter(Boolean).join(' · ')
            : 'Your signature, saved once, applied with one tap';
        vm.sform.curLine = cur ? (cur.name || me) + (cur.number ? ' · No. ' + cur.number : '') : '';
        openDlg('stamp');
    }
    function stampSave() {
        var F = vm.sform;
        if (vm.busy || !F) { return; }
        var err = {};
        if (!F.image) { err.sig = 'Draw your signature in the pad — it becomes your saved stamp'; }
        if (!String(F.name || '').trim()) { err.name = 'Enter your name as it should appear on stamps'; }
        F.err = err;
        if (err.name) { focusField('stamp-name'); }
        if (err.name || err.sig) { return; }
        var name = String(F.name).trim(), num = String(F.num || '').trim(), had = !!vm.stamp;
        vm.busy = true;
        D.SaveStamp(F.image, name, num).then(function (res) {
            vm.busy = false;
            if (!D.ok(res)) { ToastService.error('Stamp not saved', D.errorText(res, 'Please try again.')); return; }
            rememberNumber(num);
            vm.stamp = { image: F.image, name: name, number: num, updated: InsCore.now() };
            vm.stampState = 'ok';
            stampWords();
            closeDlg();
            refresh();
            ToastService.success(had ? 'Stamp replaced' : 'Stamp saved', had ? 'New lines get your new signature.' : 'Sign each line with one tap.', { confetti: false });
            loadStamp();   // the server's copy (made transparent) and its saved date
        });
    }
    function rmGo() {
        if (vm.busy) { return; }
        vm.busy = true;
        D.DeleteStamp().then(function (res) {
            vm.busy = false;
            if (!D.ok(res)) { ToastService.error('Stamp not removed', D.errorText(res, 'Please try again.')); return; }
            vm.stamp = null; vm.sel = {}; vm.rmAsk = false;
            stampWords();
            closeDlg();
            refresh();
            ToastService.success('Stamp removed', 'You’ll draw your signature each time you sign.', { confetti: false });
        });
    }

    /* ── a line leaving the queue: it fades and collapses (~200 ms), joins "Done this visit", then the toast ── */
    function leave(rows, how, then) {
        var ids = rows.map(function (r) { return r.id; });
        var els = ids.map(function (id) { return document.getElementById('sgn-r-' + id); }).filter(Boolean);
        var calm = !els.length || !!(reduce && reduce.matches);
        if (!calm) {
            els.forEach(function (el) { el.style.maxHeight = el.offsetHeight + 'px'; el.classList.add('sgn-row--leave'); });
        }
        $timeout(function () {
            var gone = {};
            ids.forEach(function (id) { gone[id] = 1; delete vm.sel[id]; });
            vm.queue = vm.queue.filter(function (r) { return !gone[r.id]; });
            rows.forEach(function (r) {
                vm.done.unshift({ r: r, kind: how.kind, text: how.text || '', reason: how.reason || '', withdrawn: false, sub: D.doneSub(r, how.kind === 'signed' ? how.text : '') });
            });
            if (gone[vm.openId]) { vm.openId = null; vm.decId = null; }
            refresh();
            if (then) { then(); }
        }, calm ? 0 : 220);
    }
    /* the queue again after a refusal (the line may have gone, or been answered in another tab) */
    function refreshQueue() {
        D.Queue().then(function (q) {
            if (!D.ok(q)) { return; }
            vm.queue = q.queue;
            keepState();
            refresh();
        });
    }

    /* Esc: the search closes itself (<ta-combo> stops the key); then the dialog, the questions, the opened row */
    function onKey(e) {
        if (e.keyCode !== 27 || e.defaultPrevented) { return; }
        $scope.$apply(function () {
            if (vm.dlg) { if (vm.rmAsk && !vm.busy) { vm.rmAsk = false; return; } closeDlg(); return; }
            if (vm.busy) { return; }
            if (vm.wdId) { vm.wdId = null; return; }
            if (vm.decId) { vm.decId = null; return; }
            if (vm.openId) { vm.openId = null; }
        });
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        $document.off('keydown', onKey);
        if (phoneMq && phoneMq.removeListener) { phoneMq.removeListener(onMq); }
    });
}
