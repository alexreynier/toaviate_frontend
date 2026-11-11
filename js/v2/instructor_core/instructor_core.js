/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Instructor Dashboard v2: shared core (mockups-40). Designs: mockups/instructor-dashboard/*.html (approved 8–9 Nov 2026).
   CSS: css/v2/instructor.css (zone, the Instructor tag, shared ins- components, the ins-rise animation).
   Plan and file map: mockups/instructor-dashboard/css/README.md · tracker: mockups/v2-build/fe-instructor.md.

   Angular registrations only. In the Grunt build, the js/v2 screen files are concatenated alphabetically (debrief/ comes before
   instructor_core/), so no screen may rely on a top-level global from this file. Inject InsCore instead.

   States: every instructor v2 state is `dashboard.v2.instructor_*` (URL /dashboard/v2/manage_user/…). design.js gives
   them the instructor zone (body[data-zone="instructor"]); nothing in a template sets colours.

     InsCore      dates and words as the mockups write them (club wall-clock time, never shifted); numbers (h:mm, 1h30);
                  the signed-in instructor and their clubs; GET / POST / PUT / DELETE with the v2 { success:false } convention
     <ins-tag>    the "Instructor" tag above a page title or in a hero's top row: <ins-tag></ins-tag> or <ins-tag text="…">
     ins-rise     CSS class (instructor.css): content that arrives fades up, staggered by style="--i: n" (cap 8);
                  reduced motion turns it off
     ins-plain    attribute: ngAnimate off inside an element. Rows and blocks carry their own CSS motion (ins-rise, ta-open), and
                  ngAnimate would otherwise hold a leaving ng-repeat row or ng-if block on screen for that animation's length.
                  Every <main class="ta-page"> already gets this from design.js (taPage); use ins-plain only outside <main>.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

app.factory('InsCore', InsCore);
InsCore.$inject = ['$http', '$location', '$rootScope'];
function InsCore($http, $location, $rootScope) {
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var API = '/api/v1/';

    var s = {
        MON: MON, MONTH: MONTH, DOW: DOW, DOW_LONG: DOW_LONG,
        // dates, as the mockup kit writes them ('YYYY-MM-DD[ HH:mm[:ss]]' strings are club wall-clock time)
        p2: p2, pd: pd, ymd: ymd, stamp: stamp, today: today, now: now, addDays: addDays, daysBetween: daysBetween, minutesBetween: minutesBetween,
        fDate: fDate, fDay: fDay, fDayLong: fDayLong, fTime: fTime, fMonth: fMonth, dayWord: dayWord, whenShort: whenShort, ago: ago, askedWords: askedWords,
        // numbers and words
        hm: hm, hmMin: hmMin, len: len, plural: plural, firstName: firstName, initials: initials, ord: ord,
        // the signed-in instructor
        me: me, myId: myId, instructorClubs: instructorClubs, managerClubs: managerClubs, isInstructorAt: isInstructorAt, isManagerAt: isManagerAt,
        // http (the v2 convention: success → response body; failure → { success:false, error, message, status })
        get: get, post: post, put: put, del: del, qs: qs, handleSuccess: handleSuccess, handleError: handleError,
        // aircraft: the colour is only ever the 4px left edge / the chip's swatch (DESIGN_GUIDELINES)
        ac: ac
    };
    return s;

    function p2(n) { return (n < 10 ? '0' : '') + n; }
    function pd(str) {
        if (!str) { return null; }
        if (str instanceof Date) { return str; }
        var p = String(str).replace('T', ' ').split(' '), d = p[0].split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0, t[2] || 0);
    }
    function ymd(d) { d = pd(d); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    function stamp(d) { d = pd(d); return ymd(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
    function now() { return stamp(new Date()); }
    function today() { return ymd(new Date()); }
    function addDays(str, n) { var d = pd(str); d.setDate(d.getDate() + n); return ymd(d); }
    function daysBetween(a, b) { return Math.round((pd(ymd(b)) - pd(ymd(a))) / 86400000); }
    function minutesBetween(a, b) { return Math.round((pd(b) - pd(a)) / 60000); }
    function fDate(str) { var d = pd(str); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; }
    function fDay(str) { var d = pd(str); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; }
    function fDayLong(str) { var d = pd(str); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : ''; }
    function fTime(str) { return (String(str || '').replace('T', ' ').split(' ')[1] || '').slice(0, 5); }
    function fMonth(str) { var d = pd(str); return d ? MONTH[d.getMonth()] + ' ' + d.getFullYear() : ''; }
    /* 'Today' / 'Tomorrow' / 'Yesterday' / '' */
    function dayWord(str) { var n = daysBetween(today(), str); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : ''; }
    /* 'Today 13:30' · 'Tomorrow 09:00' · 'Mon 9 Nov, 09:00' */
    function whenShort(str) { var w = dayWord(str); return (w ? w + ' ' : fDay(str) + ', ') + fTime(str); }
    /* whole days since a date (0 = today) */
    function ago(str) { return daysBetween(str, today()); }
    /* 'today 07:48' · 'yesterday 22:10' · 'Wed 4 Nov 18:42' */
    function askedWords(str) { var n = ago(str); return (n === 0 ? 'today' : n === 1 ? 'yesterday' : fDay(str)) + ' ' + fTime(str); }

    /* decimal hours → 'h:mm' */
    function hm(h) { var m = Math.round((+h || 0) * 60); var sign = m < 0 ? '−' : ''; m = Math.abs(m); return sign + Math.floor(m / 60) + ':' + p2(m % 60); }
    /* minutes → 'h:mm' */
    function hmMin(m) { return hm((+m || 0) / 60); }
    /* minutes → a booking's length '1h30' · '45m' · '2h' (DESIGN_GUIDELINES 4.7) */
    function len(m) { m = Math.round(+m || 0); var h = Math.floor(m / 60), r = m % 60; return h ? h + 'h' + (r ? p2(r) : '') : r + 'm'; }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    function firstName(n) { return String(n || '').trim().split(/\s+/)[0]; }
    function initials(n) { var p = String(n || '').trim().split(/\s+/); return ((p[0] || '')[0] || '') + (p.length > 1 ? (p[p.length - 1][0] || '') : ''); }
    function ord(n) { var v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }

    function me() { return ($rootScope.globals && $rootScope.globals.currentUser) || {}; }
    function myId() { return +(me().id || 0); }
    function ids(list) { return (list || []).map(function (x) { return +x; }).filter(function (x) { return x > 0; }); }
    function instructorClubs() { return ids(me().access && me().access.instructor); }
    function managerClubs() { return ids(me().access && me().access.manager); }
    function isInstructorAt(clubId) { return instructorClubs().indexOf(+clubId) > -1; }
    function isManagerAt(clubId) { return managerClubs().indexOf(+clubId) > -1; }

    /* { a: 1, b: '', c: null } → '?a=1' (empty values dropped; arrays repeat the key) */
    function qs(params) {
        var q = [];
        angular.forEach(params || {}, function (v, k) {
            if (v === null || v === undefined || v === '') { return; }
            if (angular.isArray(v)) { v.forEach(function (x) { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)); }); return; }
            q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        });
        return q.length ? '?' + q.join('&') : '';
    }
    function url(path, params) { return API + String(path).replace(/^\/+/, '').replace(/^api\/v1\//, '') + qs(params); }
    function get(path, params) { return $http.get(url(path, params)).then(handleSuccess, handleError); }
    function post(path, body, params) { return $http.post(url(path, params), body || {}).then(handleSuccess, handleError); }
    function put(path, body, params) { return $http.put(url(path, params), body || {}).then(handleSuccess, handleError); }
    function del(path, params) { return $http['delete'](url(path, params)).then(handleSuccess, handleError); }
    function handleSuccess(res) { return res.data; }
    function handleError(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data;
        if (d && typeof d === 'object' && (d.error || d.success === false)) { return { success: false, error: d.error, message: d.message || d.error, status: res.status, data: d }; }
        return { success: false, message: typeof d === 'string' ? d : 'Something went wrong. Please try again.', status: res.status };
    }

    /* an aircraft for the templates: { reg, type, model, colour } from any of the shapes the backend uses */
    function ac(x) {
        x = x || {};
        return { reg: x.reg || x.registration || '', type: x.type || x.type_short || x.plane_type || '', model: x.model || x.plane_model || '', colour: x.colour || x.color || x.aircraft_colour || x.plane_colour || '' };
    }
}

/* <ins-tag></ins-tag> → the "Instructor" tag (css/v2/instructor.css). In a hero's top row it turns white, and on phones it
   stands in for the hero's eyebrow (the CSS does both). */
app.directive('insTag', function () {
    return {
        restrict: 'E',
        replace: true,
        scope: { text: '@' },
        template: '<span class="ins-tag"><i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>{{ text || \'Instructor\' }}</span>'
    };
});

/* <main class="ta-page" ins-plain> → ngAnimate off inside the page (see the header). */
app.directive('insPlain', ['$animate', function ($animate) {
    return { restrict: 'A', link: function (scope, el) { $animate.enabled(el, false); } };
}]);
