'use strict';
/*
 * <ta-doc-view route="plane_crs" file="vm.doc.file" title="vm.doc.t"></ta-doc-view>
 *
 * Shows a stored document INSIDE the dialog (Alex, 10 Nov 2026 — "load the document on this view rather than a
 * click to preview"): the file is fetched through its show_file route (the app's login goes with it — a plain
 * <img src> or <iframe src> to the API never could), typed from its first bytes (the API serves every document as
 * application/octet-stream), then rendered as an <img> (JPEG / PNG / GIF / WebP / BMP), a PDF <iframe>, or — for
 * anything else — the file's icon with "Open" (new tab). A spinner while it loads, a plain message when it fails.
 * The object URL is revoked when the element goes.
 *
 * FULL SCREEN (owner, 11 Nov 2026 — "emulate the defects image full-screen"): the image itself and the "Full screen"
 * button open the shared lightbox, TaDocFull (below). iOS PDFs keep "Open in a new tab" (a frame shows one page).
 */
/*
 * TaDocFull — the full-screen document lightbox, ONE for every v2 screen (owner, 13 Nov 2026: "zoom into the document,
 * or see it full screen" on My Account; until then it lived inside <ta-doc-view> and the licence / medical / proof-of-ID
 * scans had no way to be read at size).
 *
 *   var h = TaDocFull.open({
 *       index: 0,                                   // the page to start on
 *       count: function () { return n; },           // a number or a function (pages can arrive late)
 *       at: function (i) { return { url, kind: 'image' | 'pdf', title, sub, name, ext, frameUrl }; },   // read every digest
 *       onIndex: function (i) {},                   // the viewer moved to page i
 *       onClose: function () {},
 *       actions: true                               // Download + Open in a new tab (off for encrypted scans)
 *   });
 *   h.close();
 *
 * The look is the defect photo lightbox's (css/defect-media.css .dm-lightbox): the document centred on a near-black
 * ground, round translucent buttons top-right; Esc or a click on the ground closes. Appended to <body> (no ancestor's
 * transform / overflow can clip it); the app header steps aside while it shows (body.ta-docfull-open, css/v2/core.css).
 * Styles: .ta-docfull* in css/ta-base.css.
 *
 * ZOOM (images): the − / + pill steps through ZOOM_STEPS (1 = fitted to the screen); a click / tap on the image goes
 * fit <-> large AT THAT POINT; pinch on a touch screen and ctrl + wheel (a trackpad pinch) zoom smoothly about the
 * fingers / the pointer; keys + − 0. The stage scrolls to pan. A PDF fills the screen in the browser's own reader
 * (pages, zoom, search). Several pages: the "2 of 4" pill and the left / right arrow keys; a page change returns to fit.
 */
app.factory('TaDocFull', ['$rootScope', '$compile', '$window', '$timeout', '$sce', function ($rootScope, $compile, $window, $timeout, $sce) {
    var ZOOM_STEPS = [1, 1.5, 2, 3, 4, 6, 8];
    var TPL =
        '<div class="ta-docfull" ng-class="{\'ta-docfull--pdf\': v.kind === \'pdf\'}" role="dialog" aria-modal="true" aria-label="{{ v.title || \'Document\' }}" tabindex="-1" ng-click="v.close()" data-e2e="ta-docfull">' +
        '  <div class="ta-docfull__bar" ng-click="$event.stopPropagation()">' +
        '    <span class="ta-docfull__ic"><i class="fas" ng-class="v.kind === \'pdf\' ? \'fa-file-pdf\' : \'fa-file-image\'"></i></span>' +
        '    <div class="ta-docfull__ttl"><b>{{ v.title || \'Document\' }}</b><span>{{ v.sub }}</span></div>' +
        '    <button type="button" class="ta-docfull__btn" ng-if="v.actions && v.url" ng-click="v.save()" no-busy-guard title="Download" aria-label="Download"><i class="fas fa-download"></i></button>' +
        '    <button type="button" class="ta-docfull__btn" ng-if="v.actions && v.url" ng-click="v.open()" no-busy-guard title="Open in a new tab" aria-label="Open in a new tab"><i class="fas fa-external-link-alt"></i></button>' +
        '    <button type="button" class="ta-docfull__btn ta-docfull__btn--x" ng-click="v.close()" no-busy-guard title="Close (Esc)" aria-label="Close"><i class="fas fa-times"></i></button>' +
        '  </div>' +
        '  <div class="ta-docfull__stage">' +
        '    <div class="ta-docfull__wait" ng-if="!v.url"><i class="fas fa-circle-notch fa-spin"></i></div>' +
        '    <img class="ta-docfull__img" ng-if="v.url && v.kind === \'image\'" ng-src="{{ v.url }}" alt="{{ v.title || \'Document\' }}" ng-click="$event.stopPropagation(); v.tap($event)">' +
        '    <iframe class="ta-docfull__pdf" ng-if="v.url && v.kind === \'pdf\'" ng-src="{{ v.frameUrl }}" title="{{ v.title || \'Document\' }}"></iframe>' +
        '  </div>' +
        '  <div class="ta-docfull__tools" ng-if="v.n > 1 || v.kind === \'image\'" ng-click="$event.stopPropagation()">' +
        '    <div class="ta-docfull__pill" ng-if="v.n > 1" data-e2e="ta-docfull-pages">' +
        '      <button type="button" class="ta-docfull__pb" ng-click="v.go(-1)" ng-disabled="v.i <= 0" no-busy-guard title="Previous page" aria-label="Previous page"><i class="fas fa-chevron-left"></i></button>' +
        '      <b aria-live="polite">{{ v.i + 1 }} of {{ v.n }}</b>' +
        '      <button type="button" class="ta-docfull__pb" ng-click="v.go(1)" ng-disabled="v.i >= v.n - 1" no-busy-guard title="Next page" aria-label="Next page"><i class="fas fa-chevron-right"></i></button>' +
        '    </div>' +
        '    <div class="ta-docfull__pill" ng-if="v.kind === \'image\'" data-e2e="ta-docfull-zoom">' +
        '      <button type="button" class="ta-docfull__pb" ng-click="v.step(-1)" ng-disabled="v.z <= 1" no-busy-guard title="Zoom out" aria-label="Zoom out"><i class="fas fa-search-minus"></i></button>' +
        '      <button type="button" class="ta-docfull__pv" ng-click="v.fit()" ng-disabled="v.z <= 1" no-busy-guard title="Fit to the screen" aria-label="Zoom {{ v.zLabel() }}. Fit to the screen">{{ v.zLabel() }}</button>' +
        '      <button type="button" class="ta-docfull__pb" ng-click="v.step(1)" ng-disabled="v.z >= v.zMax" no-busy-guard title="Zoom in" aria-label="Zoom in"><i class="fas fa-search-plus"></i></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="ta-docfull__hint" ng-if="v.kind === \'image\'" ng-click="$event.stopPropagation()"><span class="ta-docfull__hint-mouse">{{ v.z > 1 ? \'Scroll to move around · click the image to fit it to the screen\' : \'Click the image to zoom\' }} · Esc to close</span><span class="ta-docfull__hint-touch">{{ v.z > 1 ? \'Drag to move around · tap to fit it to the screen\' : \'Pinch or tap to zoom\' }}</span></div>' +
        '</div>';
    var cur = null;        // { el, scope, off, focus, opts } while it is open — one at a time
    var service = {};
    service.open = open;
    service.close = close;
    service.isOpen = function () { return !!cur; };
    $rootScope.$on('$stateChangeSuccess', close);   // the page went (browser Back, a link): the lightbox goes with it
    return service;

    function close() {
        if (!cur) { return; }
        var c = cur; cur = null;
        c.off();
        $window.document.body.classList.remove('ta-docfull-open');
        c.scope.$destroy();
        c.el.remove();
        if (c.focus && c.focus.focus) { try { c.focus.focus(); } catch (e) {} }
        if (c.opts.onClose) { try { c.opts.onClose(); } catch (e) {} }
    }

    function open(opts) {
        close();
        opts = opts || {};
        var doc = $window.document;
        var fs = $rootScope.$new(true);
        var v = fs.v = { i: Math.max(0, parseInt(opts.index, 10) || 0), n: 1, z: 1, zMax: 4, actions: opts.actions !== false,
            url: null, frameUrl: null, kind: null, title: '', sub: '' };
        var item = {}, framed = null, fitW = 0;
        var node = $compile(TPL)(fs);
        var root = node[0];
        function img() { return root.querySelector('.ta-docfull__img'); }
        function stage() { return root.querySelector('.ta-docfull__stage'); }

        // the caller's data is read every digest (a full-size scan replaces its thumbnail when it arrives)
        fs.$watch(function () {
            var n = angular.isFunction(opts.count) ? opts.count() : opts.count;
            v.n = Math.max(1, parseInt(n, 10) || 1);
            if (v.i > v.n - 1) { v.i = v.n - 1; }
            item = (opts.at && opts.at(v.i)) || {};
            v.url = item.url || null;
            v.kind = v.url ? (item.kind === 'pdf' ? 'pdf' : 'image') : (item.kind || null);
            v.title = item.title || '';
            v.sub = item.sub || '';
            if (v.kind !== 'pdf') { framed = null; v.frameUrl = null; }
            else if (framed !== v.url) { framed = v.url; v.frameUrl = item.frameUrl || $sce.trustAsResourceUrl(v.url); }   // an <iframe> needs a trusted resource URL
        });

        /* ── zoom ── z = the image's width over its fitted width (1 = fit). The class and the width go on at once (not
           through the digest) so the new box can be measured and the point under the pointer kept where it was. */
        function setZoom(z, ax, ay) {
            var im = img(), st = stage();
            if (!im || !st) { return; }
            if (v.z <= 1) { fitW = im.clientWidth || fitW || 1; v.zMax = Math.max(4, Math.min(8, Math.ceil((im.naturalWidth || 0) / fitW))); }
            z = Math.max(1, Math.min(v.zMax, z));
            if (z < 1.02) { z = 1; }
            var before = im.getBoundingClientRect(), sr = st.getBoundingClientRect();
            if (ax === undefined || ax === null) { ax = sr.left + sr.width / 2; ay = sr.top + sr.height / 2; }
            var fx = before.width ? Math.max(0, Math.min(1, (ax - before.left) / before.width)) : 0.5;
            var fy = before.height ? Math.max(0, Math.min(1, (ay - before.top) / before.height)) : 0.5;
            if (z === 1) { root.classList.remove('ta-docfull--zoom'); im.style.width = ''; }
            else { root.classList.add('ta-docfull--zoom'); im.style.width = Math.round(fitW * z) + 'px'; }
            v.z = z;
            if (z > 1) {
                var after = im.getBoundingClientRect();
                st.scrollLeft += (after.left + fx * after.width) - ax;
                st.scrollTop += (after.top + fy * after.height) - ay;
            }
        }
        v.zLabel = function () { return v.z <= 1 ? 'Fit' : Math.round(v.z * 100) + '%'; };
        v.fit = function () { setZoom(1); };
        v.step = function (dir) {
            var k, next = v.z;
            if (dir > 0) { next = v.zMax; for (k = 0; k < ZOOM_STEPS.length; k++) { if (ZOOM_STEPS[k] > v.z + 0.01) { next = ZOOM_STEPS[k]; break; } } }
            else { next = 1; for (k = ZOOM_STEPS.length - 1; k >= 0; k--) { if (ZOOM_STEPS[k] < v.z - 0.01) { next = ZOOM_STEPS[k]; break; } } }
            setZoom(next);
        };
        // fit <-> large: at least twice the fitted width (a phone photo is far bigger than the screen; a small scan still
        // gets bigger), never more than four times — at the point that was clicked
        v.tap = function ($event) {
            var im = img();
            if (!im) { return; }
            if (v.z > 1) { setZoom(1); return; }
            var fit = im.clientWidth || 1;
            setZoom(Math.min(Math.max((im.naturalWidth || 0) / fit, 2), 4), $event && $event.clientX, $event && $event.clientY);
        };
        v.go = function (stepBy) {
            var to = Math.max(0, Math.min(v.n - 1, v.i + stepBy));
            if (to === v.i) { return; }
            setZoom(1);
            v.i = to;
            var st = stage(); if (st) { st.scrollLeft = 0; st.scrollTop = 0; }
            if (opts.onIndex) { opts.onIndex(to); }
        };
        v.close = close;
        v.open = function () {
            if (!v.url) { return; }
            try { $window.open(v.url, '_blank'); } catch (e) { /* blocked: nothing else to do */ }
        };
        // save the file under the document's own name ("Insurance.pdf"), not the stored one
        v.save = function () {
            if (!v.url) { return; }
            var base = String(item.name || v.title || 'Document').replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Document';
            var ext = v.kind === 'pdf' ? 'pdf' : String(item.ext || '').toLowerCase();
            var a = doc.createElement('a');
            a.href = v.url; a.download = ext ? base + '.' + ext : base;
            doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
        };

        /* ── keys, wheel, pinch (plain listeners: none of them is an ng-event) ── */
        // Esc closes the lightbox ONLY: caught on the way down, so the page's own Escape handler (which would close the
        // dialog underneath) never sees it
        function onKey(e) {
            var k = e.key, act = null;
            if (k === 'Escape' || e.keyCode === 27) { act = close; }
            else if (e.ctrlKey || e.metaKey || e.altKey) { return; }
            else if (k === 'ArrowLeft' && v.n > 1) { act = function () { v.go(-1); }; }
            else if (k === 'ArrowRight' && v.n > 1) { act = function () { v.go(1); }; }
            else if ((k === '+' || k === '=') && v.kind === 'image') { act = function () { v.step(1); }; }
            else if ((k === '-' || k === '_') && v.kind === 'image') { act = function () { v.step(-1); }; }
            else if (k === '0' && v.kind === 'image') { act = v.fit; }
            if (!act) { return; }
            e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); }
            fs.$applyAsync(act);
        }
        // ctrl + wheel = a trackpad pinch (and ctrl + mouse wheel): zoom about the pointer, never the browser's page zoom
        function onWheel(e) {
            if (!e.ctrlKey || v.kind !== 'image') { return; }
            e.preventDefault();
            setZoom(v.z * Math.exp(-(e.deltaY || 0) * 0.01), e.clientX, e.clientY);
            fs.$applyAsync();
        }
        var pinch = null;      // { d, z } while two fingers are down
        function spread(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy) || 1; }
        function onTouchStart(e) {
            if (e.touches.length === 2 && v.kind === 'image' && img()) { pinch = { d: spread(e.touches), z: v.z }; }
        }
        function onTouchMove(e) {
            if (!pinch || e.touches.length !== 2) { return; }
            e.preventDefault();
            setZoom(pinch.z * spread(e.touches) / pinch.d, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
        }
        function onTouchEnd(e) {
            if (pinch && e.touches.length < 2) { pinch = null; fs.$applyAsync(); }
        }
        doc.addEventListener('keydown', onKey, true);
        root.addEventListener('wheel', onWheel, { passive: false });
        root.addEventListener('touchstart', onTouchStart, { passive: true });
        root.addEventListener('touchmove', onTouchMove, { passive: false });
        root.addEventListener('touchend', onTouchEnd, { passive: true });
        root.addEventListener('touchcancel', onTouchEnd, { passive: true });

        cur = { el: node, scope: fs, focus: doc.activeElement, opts: opts, off: function () { doc.removeEventListener('keydown', onKey, true); } };
        doc.body.appendChild(root);
        doc.body.classList.add('ta-docfull-open');
        $timeout(function () { if (cur && cur.el === node && root.focus) { try { root.focus(); } catch (e) {} } }, 0, false);
        return { close: function () { if (cur && cur.el === node) { close(); } } };
    }
}]);

app.directive('taDocView', ['$http', '$window', '$sce', 'TaDocFull', function ($http, $window, $sce, TaDocFull) {
    function taDocSniff(buf) {
        try {
            var b = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
            if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) { return 'image/jpeg'; }
            if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) { return 'image/png'; }
            if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) { return 'image/gif'; }
            if (b[0] === 0x42 && b[1] === 0x4D) { return 'image/bmp'; }
            if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) { return 'image/webp'; }
            if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) { return 'application/pdf'; }
        } catch (e) { /* not an ArrayBuffer */ }
        return null;
    }
    // iOS Safari shows only a PDF's FIRST page inside a frame, with no scrolling — there the PDF gets a card whose
    // "Open in a new tab" is the real reader (frontend-6f's walk, 10 Nov 2026)
    var taDocIOS = /iP(hone|ad|od)/.test($window.navigator.userAgent || '') || ($window.navigator.platform === 'MacIntel' && $window.navigator.maxTouchPoints > 1);
    function taDocTypeFromName(name) {
        return /\.pdf$/i.test(name) ? 'application/pdf' : /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg'
            : /\.gif$/i.test(name) ? 'image/gif' : /\.webp$/i.test(name) ? 'image/webp' : 'application/octet-stream';
    }
    function taDocSize(n) { return !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
    return {
        restrict: 'E',
        scope: { route: '@', file: '=', title: '=' },   // AngularJS 1.4: no '<' one-way binding
        template:
            '<div class="ta-docview" ng-class="{\'ta-docview--image\': dv.kind === \'image\', \'ta-docview--pdf\': dv.kind === \'pdf\'}">' +
            '  <div class="ta-docview__wait" ng-if="dv.state === \'loading\'"><i class="fas fa-spinner fa-spin"></i><span>Loading…</span></div>' +
            '  <img class="ta-docview__img" ng-if="dv.state === \'ready\' && dv.kind === \'image\'" ng-src="{{ dv.url }}" alt="{{ title || \'Document\' }}" ng-click="dv.full()" title="View full screen">' +
            '  <iframe class="ta-docview__pdf" ng-if="dv.state === \'ready\' && dv.kind === \'pdf\'" ng-src="{{ dv.frameUrl }}" title="{{ title || \'Document\' }}"></iframe>' +
            '  <div class="ta-docview__other" ng-if="dv.state === \'ready\' && dv.kind === \'other\'"><i class="fas fa-file-alt"></i><b>{{ dv.ext | uppercase }} file</b><span>This type can’t be shown here.</span></div>' +
            '  <div class="ta-docview__other" ng-if="dv.state === \'ready\' && dv.kind === \'pdf-tab\'"><i class="fas fa-file-pdf"></i><b>PDF document</b><span>Opens in a new tab on iPhone and iPad.</span><button type="button" class="ta-btn ta-btn--primary ta-btn--sm" ng-click="dv.open()" no-busy-guard><i class="fas fa-external-link-alt"></i>Open the PDF</button></div>' +
            '  <div class="ta-docview__other ta-docview__other--bad" ng-if="dv.state === \'error\'"><i class="fas fa-exclamation-circle"></i><b>Couldn’t load the document</b><span>Please try again, or ask the club for a copy.</span></div>' +
            '  <div class="ta-docview__other" ng-if="dv.state === \'none\'"><i class="fas fa-file"></i><b>No file on record</b></div>' +
            '  <div class="ta-docview__bar" ng-if="dv.state === \'ready\' || dv.state === \'error\'">' +
            '    <span class="ta-docview__ext" ng-if="dv.ext">{{ dv.ext | uppercase }}</span><span class="ta-sp"></span>' +
            '    <button type="button" class="ta-btn ta-btn--sm" ng-click="dv.full()" no-busy-guard ng-if="dv.state === \'ready\' && (dv.kind === \'image\' || dv.kind === \'pdf\')" data-e2e="ta-doc-full"><i class="fas fa-expand"></i>Full screen</button>' +
            '    <button type="button" class="ta-btn ta-btn--sm" ng-click="dv.open()" no-busy-guard ng-if="dv.state === \'ready\' && dv.kind !== \'image\' && dv.kind !== \'pdf\'"><i class="fas fa-external-link-alt"></i>Open in a new tab</button>' +
            '    <button type="button" class="ta-btn ta-btn--sm" ng-click="dv.load()" no-busy-guard ng-if="dv.state === \'error\'"><i class="fas fa-redo"></i>Try again</button>' +
            '  </div>' +
            '</div>',
        link: function (scope, el) {
            var dv = scope.dv = { state: 'none', kind: null, url: null, frameUrl: null, ext: '', mime: null, bytes: 0 };
            var current = null;    // the object URL to revoke
            function clear() { closeFull(); if (current) { try { URL.revokeObjectURL(current); } catch (e) {} current = null; } dv.url = null; dv.frameUrl = null; }
            dv.load = function () {
                clear();
                var file = scope.file ? String(scope.file) : '';
                var route = scope.route ? String(scope.route) : '';
                if (!file || !route) { dv.state = 'none'; dv.kind = null; dv.ext = ''; return; }
                var name = file.replace(/^.*[\\\/]/, '');
                dv.ext = (name.indexOf('.') > -1) ? name.split('.').pop() : '';
                dv.state = 'loading'; dv.kind = null;
                var mine = {};
                dv.req = mine;
                $http.get('/api/v1/' + route + '/show_file/' + encodeURIComponent(name), { responseType: 'arraybuffer' }).then(function (res) {
                    if (dv.req !== mine) { return; }   // the file changed while this one loaded
                    var ct = (res.headers('content-type') || '').split(';')[0];
                    if (!res.data || !res.data.byteLength || ct.indexOf('application/json') > -1) { dv.state = 'error'; return; }
                    var mime = taDocSniff(res.data) || ((ct && ct !== 'application/octet-stream') ? ct : taDocTypeFromName(name));
                    dv.mime = mime;
                    dv.bytes = res.data.byteLength;
                    dv.kind = (mime.indexOf('image/') === 0) ? 'image' : (mime === 'application/pdf') ? (taDocIOS ? 'pdf-tab' : 'pdf') : 'other';
                    current = URL.createObjectURL(new Blob([res.data], { type: mime }));
                    dv.url = current;
                    dv.frameUrl = (dv.kind === 'pdf') ? $sce.trustAsResourceUrl(current) : null;   // an <iframe> needs a trusted resource URL
                    dv.state = 'ready';
                }, function () { if (dv.req === mine) { dv.state = 'error'; } });
            };
            dv.open = function () {
                if (!dv.url) { return; }
                try { $window.open(dv.url, '_blank'); } catch (e) { /* blocked: nothing else to do */ }
            };
            /* ── full screen: the shared lightbox (TaDocFull, above) ── */
            var full = null;       // its handle while it is open
            dv.meta = function () { return [dv.kind === 'pdf' ? 'PDF' : (dv.ext || '').toUpperCase(), taDocSize(dv.bytes)].filter(Boolean).join(' · '); };
            dv.full = function () {
                if (full || dv.state !== 'ready' || (dv.kind !== 'image' && dv.kind !== 'pdf')) { return; }
                full = TaDocFull.open({
                    count: 1,
                    at: function () {
                        return { url: dv.url, frameUrl: dv.frameUrl, kind: dv.kind, title: scope.title, sub: dv.meta(), name: scope.title,
                            ext: dv.ext || (dv.mime || '').split('/').pop() };
                    },
                    onClose: function () { full = null; }
                });
            };
            function closeFull() { if (full) { full.close(); } }
            scope.$watchGroup(['file', 'route'], function () { dv.load(); });
            scope.$on('$destroy', function () { dv.req = null; clear(); });
        }
    };
}]);
