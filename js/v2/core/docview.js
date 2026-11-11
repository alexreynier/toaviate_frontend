'use strict';
/*
 * <ta-doc-view route="plane_crs" file="vm.doc.file" title="vm.doc.t"></ta-doc-view>
 *
 * Shows a stored document INSIDE the dialog (Alex, 10 Nov 2026 — "load the document on this view rather than a
 * click to preview"): the file is fetched through its show_file route (the app's login goes with it — a plain
 * <img src> or <iframe src> to the API never could), typed from its first bytes (the API serves every document as
 * application/octet-stream), then rendered as an <img> (JPEG / PNG / GIF / WebP / BMP), a PDF <iframe>, or — for
 * anything else — the file's icon with "Open" (new tab). A spinner while it loads, a plain message when it fails,
 * and "Open in a new tab" always available. The object URL is revoked when the element goes.
 */
app.directive('taDocView', ['$http', '$window', '$sce', function ($http, $window, $sce) {
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
    return {
        restrict: 'E',
        scope: { route: '@', file: '=', title: '=' },   // AngularJS 1.4: no '<' one-way binding
        template:
            '<div class="ta-docview" ng-class="{\'ta-docview--image\': dv.kind === \'image\', \'ta-docview--pdf\': dv.kind === \'pdf\'}">' +
            '  <div class="ta-docview__wait" ng-if="dv.state === \'loading\'"><i class="fas fa-spinner fa-spin"></i><span>Loading…</span></div>' +
            '  <img class="ta-docview__img" ng-if="dv.state === \'ready\' && dv.kind === \'image\'" ng-src="{{ dv.url }}" alt="{{ title || \'Document\' }}" ng-click="dv.open()" title="Open in a new tab">' +
            '  <iframe class="ta-docview__pdf" ng-if="dv.state === \'ready\' && dv.kind === \'pdf\'" ng-src="{{ dv.frameUrl }}" title="{{ title || \'Document\' }}"></iframe>' +
            '  <div class="ta-docview__other" ng-if="dv.state === \'ready\' && dv.kind === \'other\'"><i class="fas fa-file-alt"></i><b>{{ dv.ext | uppercase }} file</b><span>This type can’t be shown here.</span></div>' +
            '  <div class="ta-docview__other" ng-if="dv.state === \'ready\' && dv.kind === \'pdf-tab\'"><i class="fas fa-file-pdf"></i><b>PDF document</b><span>Opens in a new tab on iPhone and iPad.</span><button type="button" class="ta-btn ta-btn--primary ta-btn--sm" ng-click="dv.open()" no-busy-guard><i class="fas fa-external-link-alt"></i>Open the PDF</button></div>' +
            '  <div class="ta-docview__other ta-docview__other--bad" ng-if="dv.state === \'error\'"><i class="fas fa-exclamation-circle"></i><b>Couldn’t load the document</b><span>Please try again, or ask the club for a copy.</span></div>' +
            '  <div class="ta-docview__other" ng-if="dv.state === \'none\'"><i class="fas fa-file"></i><b>No file on record</b></div>' +
            '  <div class="ta-docview__bar" ng-if="dv.state === \'ready\' || dv.state === \'error\'">' +
            '    <span class="ta-docview__ext" ng-if="dv.ext">{{ dv.ext | uppercase }}</span><span class="ta-sp"></span>' +
            '    <button type="button" class="ta-btn ta-btn--sm" ng-click="dv.open()" no-busy-guard ng-if="dv.state === \'ready\'"><i class="fas fa-external-link-alt"></i>Open in a new tab</button>' +
            '    <button type="button" class="ta-btn ta-btn--sm" ng-click="dv.load()" no-busy-guard ng-if="dv.state === \'error\'"><i class="fas fa-redo"></i>Try again</button>' +
            '  </div>' +
            '</div>',
        link: function (scope, el) {
            var dv = scope.dv = { state: 'none', kind: null, url: null, frameUrl: null, ext: '', mime: null };
            var current = null;    // the object URL to revoke
            function clear() { if (current) { try { URL.revokeObjectURL(current); } catch (e) {} current = null; } dv.url = null; dv.frameUrl = null; }
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
            scope.$watchGroup(['file', 'route'], function () { dv.load(); });
            scope.$on('$destroy', function () { dv.req = null; clear(); });
        }
    };
}]);
