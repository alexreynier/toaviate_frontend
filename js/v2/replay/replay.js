/* ═══════════════════════════════════════════════════════════════════════════
   v2 FLIGHT REPLAY — design: mockups/my-account/flight-replay.html (approved). Built 8 Nov 2026.
   The approved design IS the live replay page (same controller, six-pack, map, airspace, height profile, weather,
   track analysis, photos, notes, lightbox) with two changes:
     1. the header is the uniform hero (registration as the headline, type · route · date, labelled crew facts);
     2. the styling is the design-token version of css/flight-replay.css + css/flight-weather.css (night mode works),
        scoped under .frv2 in css/v2/replay.css so v1 keeps its own look.
   So: state dashboard.v2.flight_replay runs the existing FlightReplayController on views/v2/replay/replay.html.
   The height profile is <frv2-height-profile> below: the live directive with its three colours read from CSS
   variables (--fr-chart-*), falling back to today's colours — exactly mockups/my-account/flightHeightProfile.tokens.js.
   Share links (C30, flight-sharing-build.md, built 9 Nov against the contract):
     • FrShareV2Controller (as sh, on the page wrapper): the Share / Shared button in the hero and the Share dialog —
       pick what a link shows, create a view link or an invite, copy, preview, turn off. Only club flights (not ?src=sd).
     • State flight_share (/f/:token, PUBLIC — also in app.js publicStates / publicPages / unauthEndpoints) →
       FlightShareV2Controller on views/v2/replay/share.html: logo bar, "Shared flight" hero, the same replay (the live
       FlightReplayController instantiated with a stand-in FlightReplayService that serves the public payload; weather,
       airspace, track analysis and the crew's debrief panel are left out), photos + comments, and on invite links the
       visitor's add-a-photo / add-a-comment. Any failure = the one "This link isn't available" page.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.flight_replay', {
        url: '/my_account/flight_replay/:flight_id?src',
        controller: 'FlightReplayController',
        templateUrl: 'views/v2/replay/replay.html',
        controllerAs: 'vm'
    });
    DesignRoutesProvider.map('dashboard.flight_replay', 'dashboard.v2.flight_replay');
    // PUBLIC shared flight (C30). The path is baked into shared links and social posts — it can never change.
    // ?preview=<flight_id> = the crew's "Preview" (a banner and Back to the replay).
    $stateProvider.state('flight_share', {
        url: '/f/:token?preview',
        controller: 'FlightShareV2Controller',
        templateUrl: 'views/v2/replay/share.html',
        controllerAs: 'fs',
        data: { v2Design: true }
    });
}]);

/* ═════════ C30 · share links: API (resolve, never reject: { success:false, error, status } on a refusal / HTTP error) ═════════ */
app.factory('FlightShareV2Data', FlightShareV2Data);
FlightShareV2Data.$inject = ['$http', '$location'];
function FlightShareV2Data($http, $location) {
    var service = {};
    service.List = List;
    service.Create = Create;
    service.TurnOff = TurnOff;
    service.Get = Get;
    service.AddComment = AddComment;
    service.AddPhoto = AddPhoto;
    return service;

    function base(sheet) { return '/api/v1/flight_replay/' + encodeURIComponent(sheet) + '/shares'; }
    function pub(token) { return '/api/v1/flight_share/' + encodeURIComponent(token); }
    function List(sheet) { return $http.get(base(sheet)).then(handleSuccess, handleError2); }
    function Create(sheet, body) { return $http.post(base(sheet), body).then(handleSuccess, handleError2); }
    function TurnOff(sheet, publicId) { return $http.post(base(sheet) + '/' + encodeURIComponent(publicId) + '/off', {}).then(handleSuccess, handleError2); }
    // public (no session): every failure is the same 404
    // preview = the crew's own look (not counted as an open: ?preview=1)
    function Get(token, preview) { return $http.get(pub(token) + (preview ? '?preview=1' : '')).then(handleSuccess, handlePublicError); }
    function AddComment(token, body) { return $http.post(pub(token) + '/comment', body).then(handleSuccess, handlePublicError); }
    function AddPhoto(token, file, fields) {
        var fd = new FormData();
        fd.append('file', file);
        angular.forEach(fields || {}, function (v, k) { if (v !== null && v !== undefined && v !== '') { fd.append(k, v); } });
        return $http.post(pub(token) + '/photo', fd, { transformRequest: angular.identity, headers: { 'Content-Type': undefined } }).then(handleSuccess, handlePublicError);
    }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data && typeof res.data === 'object' ? res.data : {};
        return { success: false, error: d.error || null, message: d.message || null, status: res.status };
    }
    function handlePublicError(res) {
        var d = res.data && typeof res.data === 'object' ? res.data : {};
        return { success: false, error: d.error || null, message: d.message || null, status: res.status };
    }
}

function frsDay(s) {
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], p = String(s || '').split(' ')[0].split('-').map(Number);
    return p[0] && p[1] && p[2] ? p[2] + ' ' + MON[p[1] - 1] : '';
}
var FRS_PICKS = { photos: 'photos', comments: 'comments', debrief: 'debrief notes', crew: 'crew names' };
function frsPlural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

/* ═════════ C30 · the Share button + dialog on the member replay ═════════
   GET …/shares answers { shares, can_share } to people who can see the photos and notes (crew, club staff). can_share =
   crew who may make links; anyone else sees "Shared · n links" once a link exists, and may turn one off. Track-only
   viewers (FORBIDDEN) get no button. */
app.controller('FrShareV2Controller', FrShareV2Controller);
FrShareV2Controller.$inject = ['$scope', '$rootScope', '$state', '$stateParams', '$window', '$document', '$timeout', 'FlightShareV2Data', 'ToastService'];
function FrShareV2Controller($scope, $rootScope, $state, $stateParams, $window, $document, $timeout, FlightShareV2Data, ToastService) {
    var sh = this;
    sh.ready = false;
    sh.shares = [];
    sh.canShare = false;
    sh.trackOnly = false;
    sh.dlg = false;
    if ($scope.pub || $stateParams.src === 'sd' || !$stateParams.flight_id) { return; }     // public page / SkyDemon: no sharing

    var me = ($rootScope.globals && $rootScope.globals.currentUser) || {};
    sh.myFirst = me.first_name || 'you';
    sh.sheet = $stateParams.flight_id;

    function decorate(l) {
        l._invite = l.kind === 'invite';
        l._title = l._invite ? (l.invitee_name || 'One person') + ' (invited)' : 'Anyone with the link';
        var picks = ['Track'].concat(Object.keys(FRS_PICKS).filter(function (k) { return +l['show_' + k]; }).map(function (k) { return FRS_PICKS[k]; }));
        var by = l.created_by && l.created_by.id && +l.created_by.id !== +me.id ? 'Made by ' + l.created_by.name + ' · ' : '';
        l._sub = by + picks.join(', ') + ' · Opened ' + frsPlural(+l.opens || 0, 'time') + (l.emailed_at ? ' · E-mailed ' + frsDay(l.emailed_at) : '');
        l._url = l.path ? ($window.location.origin + '/' + String(l.path).replace(/^\//, '')) : '';
        return l;
    }
    function load() {
        FlightShareV2Data.List(sh.sheet).then(function (r) {
            sh.ready = true;
            if (r && r.success && angular.isArray(r.shares)) {
                sh.canShare = !!r.can_share;
                sh.shares = r.shares.filter(function (l) { return !l.turned_off_at; }).map(decorate)
                    .sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? 1 : -1; });
                sh.available = true;
            } else {
                sh.available = false;
                sh.trackOnly = !!(r && r.error === 'FORBIDDEN');     // can see the track, not the photos / notes
            }
        });
    }
    load();

    sh.label = function () {
        if (!sh.available) { return ''; }
        var n = sh.shares.length;
        if (sh.canShare) { return 'Share' + (n ? ' · ' + frsPlural(n, 'link') : ''); }
        return n ? 'Shared · ' + frsPlural(n, 'link') : '';
    };
    function vm() { return $scope.vm || {}; }
    sh.counts = function () {
        var a = vm().annotations || [];
        return { photos: (vm().photos || []).length, comments: a.filter(function (x) { return !(x.is_instructor_note || x.kind === 'coaching'); }).length,
            debrief: a.filter(function (x) { return x.is_instructor_note || x.kind === 'coaching'; }).length };
    };

    sh.open = function () {
        sh.dlg = true; sh.mode = 'view'; sh.offAsk = null; sh.off = false;
        sh.o = { photos: true, comments: true, debrief: false, crew: false };
        sh.inv = { name: '', email: '', err: null };
    };
    sh.close = function () { if (sh.busy) { return; } sh.dlg = false; sh.offAsk = null; };
    sh.setMode = function (m) { sh.mode = m; sh.inv.err = null; };
    function onKey(e) { if ((e.key === 'Escape' || e.keyCode === 27) && sh.dlg) { $scope.$applyAsync(function () { if (sh.offAsk) { sh.offAsk = null; } else { sh.close(); } }); } }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () { $document.off('keydown', onKey); });

    function body(kind) {
        var b = { kind: kind, show_photos: sh.o.photos ? 1 : 0, show_comments: sh.o.comments ? 1 : 0, show_debrief: sh.o.debrief ? 1 : 0, show_crew: sh.o.crew ? 1 : 0 };
        if (kind === 'invite') { b.invitee_name = (sh.inv.name || '').trim(); if ((sh.inv.email || '').trim()) { b.invitee_email = sh.inv.email.trim(); } }
        return b;
    }
    function created(r, done) {
        sh.busy = false;
        if (r && r.success && r.share) { sh.shares.unshift(decorate(r.share)); done(r); return; }
        if (r && r.error === 'SHARING_OFF') { sh.off = true; ToastService.handledInline(); return; }
        if (r && r.error === 'VALIDATION_ERROR' && sh.mode === 'invite') { sh.inv.err = 'name'; ToastService.handledInline(); return; }
        ToastService.error('No link made', r && r.error === 'NOT_SHAREABLE' ? 'This flight can’t be shared — it isn’t booked in yet, or it has been merged or released.'
            : r && r.error === 'FORBIDDEN' ? 'Only the crew who flew it can share this flight.' : (r && r.message) || 'Please try again.');
    }
    sh.create = function () {
        if (sh.busy) { return; }
        sh.busy = true;
        FlightShareV2Data.Create(sh.sheet, body('view')).then(function (r) { created(r, function () { ToastService.success('Link ready', 'Copy it from the list below.'); }); });
    };
    sh.invite = function () {
        if (sh.busy) { return; }
        var I = sh.inv;
        var nm = (I.name || '').trim(), em = (I.email || '').trim();
        I.err = !nm ? 'name' : (em && !/^\S+@\S+\.\S+$/.test(em)) ? 'email' : null;
        if (I.err) { $timeout(function () { var el = document.getElementById(I.err === 'name' ? 'frs-iname' : 'frs-iemail'); if (el) { el.focus(); } }); return; }
        sh.busy = true;
        FlightShareV2Data.Create(sh.sheet, body('invite')).then(function (r) {
            created(r, function (res) {
                // C32: an invite with an e-mail address is e-mailed (emailed / emailed_at); past the daily limit the link is
                // still made (emailed:false, email_error TOO_MANY_EMAILS). No address, or an older backend: the sharer sends it.
                var sh2 = res.share || {};
                if (em && (res.emailed === true || sh2.emailed_at)) { ToastService.success('Invite e-mailed to ' + nm, 'They get their own link to the flight.'); }
                else if (em && res.emailed === false) {
                    ToastService.warning('Link made', 'We couldn’t e-mail it' + (res.email_error === 'TOO_MANY_EMAILS' ? ' (today’s limit for invite e-mails is reached)' : '') + ', so copy it instead.');
                }
                else { ToastService.success('Invite link ready for ' + nm, 'Copy it from the list below and send it to them.'); }
                sh.inv = { name: '', email: '', err: null };
            });
        });
    };
    sh.copy = function (l) {
        if (!l._url) { return; }
        function done() { ToastService.success('Link copied', l._url.replace(/^https?:\/\//, '')); }
        function fallback() {
            var t = document.createElement('textarea'); t.value = l._url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
            document.body.appendChild(t); t.select();
            var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(t);
            if (ok) { done(); } else { ToastService.warning('Couldn’t copy', 'Select the link and copy it: ' + l._url); }
        }
        if ($window.navigator.clipboard && $window.navigator.clipboard.writeText) {
            $window.navigator.clipboard.writeText(l._url).then(function () { $scope.$applyAsync(done); }, function () { $scope.$applyAsync(fallback); });
        } else { fallback(); }
    };
    sh.preview = function (l) {
        if (!l.token) { return; }
        sh.dlg = false;
        $state.go('flight_share', { token: l.token, preview: sh.sheet });
    };
    sh.turnOff = function (l) {
        if (l._off) { return; }
        l._off = true;
        FlightShareV2Data.TurnOff(sh.sheet, l.public_id).then(function (r) {
            l._off = false;
            if (r && r.success) {
                sh.shares = sh.shares.filter(function (x) { return x !== l; });
                sh.offAsk = null;
                ToastService.success('Link turned off', 'The page stops working straight away.');
            } else {
                ToastService.error('Link not turned off', (r && r.message) || 'Please try again.');
            }
        });
    };
}

// <input type="file" frs-file-change="fs.photoChosen(files)"> — the change event (a plain array of File objects)
app.directive('frsFileChange', function () {
    return { restrict: 'A', link: function (scope, el, attrs) {
        el.on('change', function () {
            var files = Array.prototype.slice.call(el[0].files || []);
            el[0].value = '';            // the same file can be picked again
            scope.$evalAsync(function () { scope.$eval(attrs.frsFileChange, { files: files }); });
        });
        scope.$on('$destroy', function () { el.off('change'); });
    } };
});

/* ═════════ C30 · the public page: /f/:token ═════════ */
app.controller('FlightShareV2Controller', FlightShareV2Controller);
FlightShareV2Controller.$inject = ['$scope', '$rootScope', '$stateParams', '$controller', '$q', '$timeout', '$window', '$templateRequest', 'FlightShareV2Data', 'FlightReplayService', 'ToastService'];
function FlightShareV2Controller($scope, $rootScope, $stateParams, $controller, $q, $timeout, $window, $templateRequest, FlightShareV2Data, FlightReplayService, ToastService) {
    var fs = this;
    $scope.pub = fs;              // replay.html leaves out the crew-only parts when pub is set
    fs.token = $stateParams.token;
    fs.state = 'loading';
    fs.preview = $stateParams.preview && $rootScope.globals && $rootScope.globals.currentUser ? $stateParams.preview : null;
    fs.photos = [];
    fs.notes = [];
    fs.vname = '';
    fs.vtext = '';
    try { fs.vname = localStorage.getItem('toaviate_share_name') || ''; } catch (e) { fs.vname = ''; }
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    fs.day = function (s) {
        var p = String(s || '').split(' ')[0].split('-').map(Number);
        if (!p[0] || !p[1] || !p[2]) { return ''; }
        var d = new Date(p[0], p[1] - 1, p[2]);
        return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
    };
    function place(a) { if (!a) { return ''; } var n = String(a.name || '').replace(/\s+(international\s+)?(aerodrome|airport|airfield)$/i, '').trim(); return n || a.code || ''; }
    // a photo url is flight_share/{token}/photo/{id} relative to the API base: no size = full, ?size=thumb = 480 px
    function sized(u, size) { u = String(u || ''); if (!size) { return u; } return u + (u.indexOf('?') > -1 ? '&' : '?') + 'size=' + size; }

    var track = [];
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    // track_time = unix UTC seconds (the clock of track[].ts) → the replay's "YYYY-MM-DD HH:MM:SS" UTC
    function utc(sec) {
        sec = +sec;
        if (!sec) { return null; }
        var d = new Date(sec * 1000);
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
    }
    function at(sec) {         // the track position at a time (the nearest recorded point) — never the photo's own GPS
        sec = +sec;
        if (!sec || !track.length) { return null; }
        var best = null, bd = Infinity;
        for (var i = 0; i < track.length; i++) {
            var ts = +track[i].ts || Date.parse(String(track[i].t).replace(' ', 'T') + 'Z') / 1000, d = Math.abs(ts - sec);
            if (d < bd) { bd = d; best = track[i]; }
        }
        return best;
    }
    function photo(p, i) {
        var pt = at(p.track_time);
        return { id: p.id || ('v' + i), url: FlightReplayService.PhotoUrl(sized(p.url)), thumb: FlightReplayService.PhotoUrl(sized(p.url, 'thumb')), width: p.width, height: p.height,
            caption: p.caption || '', taken_at: utc(p.track_time), latitude: pt ? pt.lat : null, longitude: pt ? pt.lon : null,
            uploaded_by_name: p.visitor_name || p.name || '', _visitor: !!(p.visitor_name), position_source: 'time' };
    }
    function note(n, i, coaching) {
        var pt = at(n.track_time);
        return { id: (coaching ? 'd' : 'c') + i, kind: coaching ? 'coaching' : 'comment', body: n.body, author_name: n.name || (coaching ? 'Instructor' : 'Visitor'),
            at_time: utc(n.track_time), latitude: pt ? pt.lat : null, longitude: pt ? pt.lon : null, is_instructor_note: !!coaching };
    }
    // visitor posts: VALIDATION_ERROR / LIMIT_REACHED / RATE_LIMITED come as 200 + success:false; a dead link is a 404
    function postError(r, what) {
        if (r && r.status === 404) { return 'This link isn’t available any more.'; }
        if (r && r.error === 'LIMIT_REACHED') { return what === 'photo' ? 'This link has all the photos it can take.' : 'This link has all the comments it can take.'; }
        if (r && r.error === 'RATE_LIMITED') { return 'That’s a lot in a row — wait a minute, then try again.'; }
        if (r && r.error === 'VALIDATION_ERROR') { return what === 'photo' ? 'Use a JPEG, PNG or WebP photo up to 10 MB.' : 'Keep the comment under 1,000 characters.'; }
        if (r && r.status === 413) { return 'That photo is too big.'; }
        return (r && r.message) || 'Please try again.';
    }
    function build(d) {
        track = angular.isArray(d.track) ? d.track : [];
        fs.photos = (d.photos || []).map(photo);
        fs.notes = (d.comments || []).map(function (n, i) { return note(n, i, false); }).concat((d.debrief || []).map(function (n, i) { return note(n, i, true); }));
        var f = d.flight || {};
        return {
            success: true,
            flight: { registration: f.registration, aircraft_type: f.aircraft_type, flight_date: f.date, departure_airport: f.from ? f.from.name : '', departure_airport_code: f.from ? f.from.code : '',
                destination_airport: f.to ? f.to.name : '', destination_airport_code: f.to ? f.to.code : '' },
            summary: d.summary || null, baro: d.baro || null, has_track: track.length > 0, track: track, track_note: null,
            photos: fs.photos, annotations: fs.notes
        };
    }

    // the replay template is fetched first, so the map's element exists when the live controller builds the map
    $q.all([FlightShareV2Data.Get(fs.token, !!fs.preview), $templateRequest('views/v2/replay/replay.html').catch(function () { return null; })]).then(function (res) {
        var d = res[0];
        if (!d || !d.success || !d.flight) { fs.state = 'gone'; return; }
        fs.d = d;
        fs.canAdd = !!d.can_add && d.kind === 'invite';
        fs.showPhotos = angular.isArray(d.photos);
        fs.showNotes = angular.isArray(d.comments) || angular.isArray(d.debrief);
        var f = d.flight, crew = angular.isArray(d.crew) ? d.crew.filter(Boolean) : [];
        fs.title = f.registration;
        fs.route = place(f.from) + ' → ' + place(f.to) + (f.date ? ' · ' + fs.day(f.date) : '');
        fs.who = crew.length ? 'Flown by ' + crew[0] + (crew.length > 1 ? ' with ' + crew.slice(1).join(', ') : '') : (d.shared_by ? 'Shared by ' + d.shared_by : '');
        fs.sub2 = [f.aircraft_type && f.aircraft_type !== '-' ? f.aircraft_type : '', fs.who].filter(Boolean).join(' · ');
        fs.invitee = d.invitee_name || '';
        if (!fs.vname && fs.invitee) { fs.vname = fs.invitee; }        // C32: "Posting as Jane" — still editable
        var data = build(d);
        // the live replay controller, fed the public payload (no weather / airspace / analysis; nothing to add or delete through it)
        var none = function () { return $q.when({ success: false }); };
        var stub = { GetReplay: function () { return $timeout(function () { return data; }, 0); }, GetSkydemonReplay: none, GetAirspace: none, AddPhoto: none, DeletePhoto: none,
            AddAnnotation: none, DeleteAnnotation: none, PhotoUrl: function (u) { return u; } };
        $scope.vm = $controller('FlightReplayController', { $scope: $scope, $stateParams: { flight_id: 'share' }, FlightReplayService: stub,
            BookingService: { GetForBookIn: none } });
        fs.state = 'ready';
        document.title = f.registration + ' · shared flight';
    });

    fs.openPhoto = function (ph) { if ($scope.vm && $scope.vm.openPhoto) { $scope.vm.openPhoto(ph); } };
    function rememberName() { try { if (fs.vname.trim()) { localStorage.setItem('toaviate_share_name', fs.vname.trim()); } } catch (e) { /* private window */ } }
    fs.postName = function () { return (fs.vname || '').trim() || fs.invitee; };

    fs.addComment = function () {
        var t = (fs.vtext || '').trim();
        if (!t) { ToastService.warning('Write a comment first', ''); return; }
        if (t.length > 1000) { ToastService.warning('That’s a long one', 'Keep it under 1,000 characters.'); return; }
        if (fs.sending) { return; }
        fs.sending = true;
        rememberName();
        FlightShareV2Data.AddComment(fs.token, { body: t, visitor_name: fs.postName() || undefined }).then(function (r) {
            fs.sending = false;
            if (r && r.success) {
                var c = r.comment || {};
                fs.notes.unshift({ id: 'n' + Date.now(), kind: 'comment', body: c.body || t, author_name: c.name || fs.postName() || 'You', at_time: utc(c.track_time), is_instructor_note: false });
                if ($scope.vm) { $scope.vm.annotations = fs.notes; }
                fs.vtext = '';
                ToastService.success('Comment added', '');
            } else {
                ToastService.error('Comment not added', postError(r, 'comment'));
            }
        });
    };
    var MAX = 10 * 1024 * 1024, TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    fs.pickPhoto = function () { var el = document.getElementById('frs-vfile'); if (el) { el.click(); } };
    fs.photoChosen = function (files) {
        var file = files && files[0];
        if (!file) { return; }
        (function () {
            if (TYPES.indexOf(file.type) < 0) { ToastService.warning('That file can’t be added', 'Use a JPEG, PNG or WebP photo.'); return; }
            if (file.size > MAX) { ToastService.warning('That photo is too big', 'Photos can be up to 10 MB.'); return; }
            if (fs.uploading) { return; }
            fs.uploading = true;
            rememberName();
            FlightShareV2Data.AddPhoto(fs.token, file, { visitor_name: fs.postName() }).then(function (r) {
                fs.uploading = false;
                if (r && r.success) {
                    if (r.photo && r.photo.url) { var np = photo(r.photo, fs.photos.length); np._visitor = true; np.uploaded_by_name = fs.postName() || 'You'; fs.photos.push(np); }
                    else { refresh(); }
                    ToastService.success('Photo added', '');
                } else {
                    ToastService.error('Photo not added', postError(r, 'photo'));
                }
            });
        })();
    };
    function refresh() {
        FlightShareV2Data.Get(fs.token).then(function (d) {
            if (!d || !d.success) { return; }
            fs.photos = (d.photos || []).map(photo);
            if ($scope.vm) { $scope.vm.photos = fs.photos; }
        });
    }
}

/* small view helpers for the hero (names, route, model) — the controller stays the shared one */
app.filter('frv2Model', function () {
    return function (f) {
        if (!f) { return ''; }
        var t = String(f.aircraft_type || '').trim();
        if (t && t !== '-') { return t; }
        var m = String(f.manufacturer || '').replace(/\b(aircraft|company|corporation|corp|inc|ltd|limited|industries)\b\.?/gi, '').replace(/\s{2,}/g, ' ').trim();
        if (m && m === m.toUpperCase() && m.replace(/[^A-Z]/g, '').length > 4) {
            m = m.replace(/[A-Z0-9]+/g, function (w) { return (!/[AEIOUY]/.test(w) || /\d/.test(w)) ? w : w.charAt(0) + w.slice(1).toLowerCase(); });
        }
        return m;
    };
});
app.filter('frv2Place', function () {
    return function (name, code) {
        var n = String(name || '').replace(/\s+(international\s+)?(aerodrome|airport|airfield)$/i, '').trim();
        return n || code || '';
    };
});
app.filter('frv2Day', function () {
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return function (s) {
        var p = String(s || '').split(' ')[0].split('-').map(Number);
        if (!p[0] || !p[1] || !p[2]) { return ''; }
        var d = new Date(p[0], p[1] - 1, p[2]);
        return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
    };
});

// The live <flight-height-profile> (js/directives/flightHeightProfile.js) with its three canvas colours taken from the
// stylesheet — copied from mockups/my-account/flightHeightProfile.tokens.js, plus a redraw when night mode flips.
app.directive('frv2HeightProfile', ['$window', '$timeout', function ($window, $timeout) {
    // read a colour from the stylesheet (--fr-chart-*), so the chart follows night mode; falls back to today's colour
    function chartColour(name, fallback) { return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback; }
    return {
        restrict: 'E',
        scope: { track: '=', currentIndex: '=', onSeek: '&' },
        template: '<canvas class="fr-profile__canvas"></canvas>',
        link: function (scope, element) {

            var canvas = element[0].querySelector('canvas');
            var chart = null;

            // Chart.js plugin: draw a vertical cursor at the current index.
            var cursorPlugin = {
                id: 'frCursor',
                afterDatasetsDraw: function (c) {
                    var idx = scope.currentIndex || 0;
                    var meta = c.getDatasetMeta(0);
                    if (!meta || !meta.data || !meta.data[idx]) return;
                    var x = meta.data[idx].x;
                    var ctx = c.ctx, top = c.chartArea.top, bot = c.chartArea.bottom;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, top); ctx.lineTo(x, bot);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = chartColour('--fr-chart-cursor', '#1e3a5f');
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x, meta.data[idx].y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = chartColour('--fr-chart-cursor', '#1e3a5f');
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.fill(); ctx.stroke();
                    ctx.restore();
                }
            };

            function altOf(p) {
                var a = p.alt_recommended_ft;
                if (a == null) a = p.alt_ft;
                return a || 0;
            }

            function build() {
                if (!scope.track || !scope.track.length || !$window.Chart) return;

                var labels = scope.track.map(function (p) {
                    var s = p.elapsed_s || 0;
                    var m = Math.floor(s / 60);
                    return m + ':' + (('0' + Math.round(s % 60)).slice(-2));
                });
                var data = scope.track.map(altOf);

                var ctx = canvas.getContext('2d');
                var grad = ctx.createLinearGradient(0, 0, 0, 220);
                grad.addColorStop(0, 'rgba(45, 90, 142, 0.35)');
                grad.addColorStop(1, 'rgba(45, 90, 142, 0.02)');

                chart = new $window.Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            borderColor: function () { return chartColour('--fr-chart-line', '#2d5a8e'); },
                            backgroundColor: grad,
                            borderWidth: 2,
                            fill: true,
                            pointRadius: 0,
                            tension: 0.25
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        interaction: { intersect: false, mode: 'index' },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                displayColors: false,
                                callbacks: {
                                    title: function (items) { return 'T+' + items[0].label; },
                                    label: function (item) { return Math.round(item.parsed.y) + ' ft'; }
                                }
                            }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#94a3b8', font: { size: 10 } } },
                            y: { grid: { color: function () { return chartColour('--fr-chart-grid', '#eef2f7'); } }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: function (v) { return v + ' ft'; } } }
                        },
                        onClick: function (evt, els, c) {
                            var pts = c.getElementsAtEventForMode(evt, 'index', { intersect: false }, false);
                            if (pts && pts.length) {
                                var i = pts[0].index;
                                scope.$applyAsync(function () { scope.onSeek({ i: i }); });
                            }
                        }
                    },
                    plugins: [cursorPlugin]
                });
            }

            // Build once the track arrives (after the controller's load()).
            var un = scope.$watch('track', function (t) {
                if (t && t.length && !chart) { $timeout(build); }
            });

            // Redraw the cursor as the scrubber moves.
            scope.$watch('currentIndex', function () { if (chart) chart.draw(); });

            // The container height changes when entering/leaving fullscreen.
            // Chart.js's ResizeObserver usually catches this, but force a resize
            // after the CSS transition so the canvas buffer matches its new box
            // (otherwise the labels can look squashed/stretched).
            scope.$on('fr-profile-resize', function () {
                if (!chart) return;
                $timeout(function () { chart.resize(); }, 80);
            });

            // night mode flips the stylesheet colours: redraw so the canvas follows
            var mo = $window.MutationObserver ? new $window.MutationObserver(function () { if (chart) { chart.update('none'); } }) : null;
            if (mo) { mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); }

            scope.$on('$destroy', function () {
                if (mo) { mo.disconnect(); }
                un();
                if (chart) { chart.destroy(); chart = null; }
            });
        }
    };
}]);
