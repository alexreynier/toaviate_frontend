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
 * button open a dark lightbox over the whole window, in the style of the defect photo one (css/defect-media.css
 * .dm-lightbox): the document centred on a near-black ground, round translucent buttons top-right, Esc / a click on the
 * ground closes. An image zooms on click (fit <-> large, scroll to pan); a PDF fills the screen in the browser's own
 * reader (pages, zoom, search). Download and "Open in a new tab" live in its bar. The lightbox is appended to <body>
 * (no ancestor's transform / overflow can clip it) and the app header steps aside while it shows (body.ta-docfull-open,
 * css/v2/core.css). Styles: .ta-docfull* in css/ta-base.css. iOS PDFs keep "Open in a new tab" (a frame shows one page).
 */
app.directive('taDocView', ['$http', '$window', '$sce', '$compile', '$timeout', function ($http, $window, $sce, $compile, $timeout) {
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
    // the full-screen lightbox (compiled against a child scope and appended to <body> — see the header note)
    var TA_DOC_FULL =
        '<div class="ta-docfull" ng-class="{\'ta-docfull--zoom\': dv.zoom, \'ta-docfull--pdf\': dv.kind === \'pdf\'}" role="dialog" aria-modal="true" aria-label="{{ title || \'Document\' }}" tabindex="-1" ng-click="dv.closeFull()" data-e2e="ta-docfull">' +
        '  <div class="ta-docfull__bar" ng-click="$event.stopPropagation()">' +
        '    <span class="ta-docfull__ic"><i class="fas" ng-class="dv.kind === \'pdf\' ? \'fa-file-pdf\' : \'fa-file-image\'"></i></span>' +
        '    <div class="ta-docfull__ttl"><b>{{ title || \'Document\' }}</b><span>{{ dv.meta() }}</span></div>' +
        '    <button type="button" class="ta-docfull__btn" ng-if="dv.kind === \'image\'" ng-click="dv.toggleZoom()" no-busy-guard title="{{ dv.zoom ? \'Fit to the screen\' : \'Zoom in\' }}" aria-label="{{ dv.zoom ? \'Fit to the screen\' : \'Zoom in\' }}"><i class="fas" ng-class="dv.zoom ? \'fa-search-minus\' : \'fa-search-plus\'"></i></button>' +
        '    <button type="button" class="ta-docfull__btn" ng-click="dv.save()" no-busy-guard title="Download" aria-label="Download"><i class="fas fa-download"></i></button>' +
        '    <button type="button" class="ta-docfull__btn" ng-click="dv.open()" no-busy-guard title="Open in a new tab" aria-label="Open in a new tab"><i class="fas fa-external-link-alt"></i></button>' +
        '    <button type="button" class="ta-docfull__btn ta-docfull__btn--x" ng-click="dv.closeFull()" no-busy-guard title="Close (Esc)" aria-label="Close"><i class="fas fa-times"></i></button>' +
        '  </div>' +
        '  <div class="ta-docfull__stage">' +
        '    <img class="ta-docfull__img" ng-if="dv.kind === \'image\'" ng-src="{{ dv.url }}" alt="{{ title || \'Document\' }}" ng-click="$event.stopPropagation(); dv.toggleZoom()">' +
        '    <iframe class="ta-docfull__pdf" ng-if="dv.kind === \'pdf\'" ng-src="{{ dv.frameUrl }}" title="{{ title || \'Document\' }}"></iframe>' +
        '  </div>' +
        '  <div class="ta-docfull__hint" ng-if="dv.kind === \'image\'" ng-click="$event.stopPropagation()">{{ dv.zoom ? \'Click the image to fit it to the screen\' : \'Click the image to zoom\' }}<span> · Esc to close</span></div>' +
        '</div>';
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
            var dv = scope.dv = { state: 'none', kind: null, url: null, frameUrl: null, ext: '', mime: null, bytes: 0, zoom: false };
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
            /* ── the full-screen lightbox ── */
            var full = null;       // { el, scope, key, focus } while it is open
            dv.meta = function () { return [dv.kind === 'pdf' ? 'PDF' : (dv.ext || '').toUpperCase(), taDocSize(dv.bytes)].filter(Boolean).join(' · '); };
            dv.full = function () {
                if (full || dv.state !== 'ready' || (dv.kind !== 'image' && dv.kind !== 'pdf')) { return; }
                var fs = scope.$new();
                var node = $compile(TA_DOC_FULL)(fs);
                // Esc closes the lightbox ONLY: caught on the way down, so the page's own Escape handler (which would
                // close the dialog underneath) never sees it
                var key = function (e) {
                    if (e.key !== 'Escape' && e.keyCode !== 27) { return; }
                    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); }
                    scope.$applyAsync(closeFull);
                };
                full = { el: node, scope: fs, key: key, focus: $window.document.activeElement };
                dv.zoom = false;
                $window.document.body.appendChild(node[0]);
                $window.document.body.classList.add('ta-docfull-open');
                $window.document.addEventListener('keydown', key, true);
                $timeout(function () { if (full && full.el[0].focus) { try { full.el[0].focus(); } catch (e) {} } }, 0, false);
            };
            function closeFull() {
                if (!full) { return; }
                var f = full; full = null;
                $window.document.removeEventListener('keydown', f.key, true);
                $window.document.body.classList.remove('ta-docfull-open');
                f.scope.$destroy();
                f.el.remove();
                dv.zoom = false;
                if (f.focus && f.focus.focus) { try { f.focus.focus(); } catch (e) {} }
            }
            dv.closeFull = closeFull;
            // fit <-> large: at least twice the fitted width (a phone photo is far bigger than the screen; a small scan
            // still gets bigger), never more than four times; the stage scrolls
            dv.toggleZoom = function () {
                if (!full) { return; }
                var img = full.el[0].querySelector('.ta-docfull__img');
                if (!img) { return; }
                if (dv.zoom) { img.style.width = ''; dv.zoom = false; return; }
                var fit = img.clientWidth || 1;
                img.style.width = Math.round(Math.min(Math.max(img.naturalWidth || 0, fit * 2), fit * 4)) + 'px';
                dv.zoom = true;
            };
            // save the file under the document's own name ("Insurance.pdf"), not the stored one
            dv.save = function () {
                if (!dv.url) { return; }
                var base = String(scope.title || 'Document').replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Document';
                var ext = dv.kind === 'pdf' ? 'pdf' : (dv.ext || (dv.mime || '').split('/').pop() || '').toLowerCase();
                var a = $window.document.createElement('a');
                a.href = dv.url; a.download = ext ? base + '.' + ext : base;
                $window.document.body.appendChild(a); a.click(); $window.document.body.removeChild(a);
            };
            scope.$watchGroup(['file', 'route'], function () { dv.load(); });
            scope.$on('$destroy', function () { dv.req = null; clear(); });
        }
    };
}]);
