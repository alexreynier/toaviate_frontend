/**
 * unsupportedCharactersInterceptor (js/services/writeGuardService.js) —
 * emoji / 4-byte characters are refused before an API write is sent.
 * Backend counterpart: BACKEND_UNSUPPORTED_CHARACTERS_GUIDE.md.
 *
 * Loads the real writeGuardService.js with a tiny fake `app.factory`, then
 * drives a request through the same interceptor chain app.js registers
 * (writeGuardInterceptor → apiUrlInterceptor (stubbed) → unsupported…),
 * replicating AngularJS 1.4's ordering: request hooks first-to-last, response
 * hooks last-to-first, a request-stage rejection skipping the server.
 *
 * Run: node tests/unsupported-characters-interceptor-test.js
 */
var fs = require('fs');
var path = require('path');

var factories = {};
var app = { factory: function (name, def) { factories[name] = def; } };
var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'writeGuardService.js'), 'utf8');
new Function('app', src)(app);

// ── fakes ────────────────────────────────────────────────────────────────
function FakeFormData() {}
function FakeBlob() {}
var $window = {
    FormData: FakeFormData, Blob: FakeBlob, ArrayBuffer: ArrayBuffer,
    document: { addEventListener: function () {} }
};
var $q = { reject: function (v) { return Promise.reject(v); } };
var toasts = [];
var ToastService = {
    lastShownAt: 0,
    warning: function (t, s) { toasts.push(['warning', t, s]); ToastService.lastShownAt = Date.now(); },
    error: function (t, s) { toasts.push(['error', t, s]); ToastService.lastShownAt = Date.now(); },
    success: function () {}
};
var $injector = { get: function (n) { if (n === 'ToastService') { return ToastService; } throw new Error('no ' + n); } };

function make(name) {
    var def = factories[name];
    var deps = { '$window': $window, '$q': $q, '$injector': $injector };
    if (typeof def === 'function') {           // app.factory('WriteGuard', WriteGuard) + WriteGuard.$inject
        return def.apply(null, (def.$inject || []).map(function (d) { return deps[d]; }));
    }
    var fn = def[def.length - 1];
    return fn.apply(null, def.slice(0, -1).map(function (d) { return d === 'WriteGuard' ? WriteGuard : deps[d]; }));
}
var WriteGuard = make('WriteGuard');
var wg = make('writeGuardInterceptor');
var uc = make('unsupportedCharactersInterceptor');
var au = { request: function (c) { c.url = 'https://local-api.toaviate.com' + c.url; return c; } };   // apiUrlInterceptor's prefixing

// AngularJS 1.4 chain: [wg.req, au.req, uc.req, server, uc.res, au.res, wg.res]
function send(config, server) {
    var chain = [
        [wg.request, null], [au.request, null], [uc.request, null],
        [function (c) { server.calls++; return server.answer(c); }, null],
        [uc.response, uc.responseError], [au.response || null, au.responseError || null], [wg.response, wg.responseError]
    ];
    var p = Promise.resolve(config);
    chain.forEach(function (pair) { p = p.then(pair[0] || undefined, pair[1] || undefined); });
    return p;
}
function okServer() { return { calls: 0, answer: function (c) { return { data: { success: true }, status: 200, config: c }; } }; }
function refusingServer(body) { return { calls: 0, answer: function (c) { return { data: body, status: 200, config: c }; } }; }

var SMILE = '😀', PLANE = '🛩';
var failures = 0, passed = 0;
function check(cond, msg) { if (cond) { passed++; } else { failures++; console.error('  FAIL: ' + msg); } }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var tests = [
    function blocksAnEmojiNamingTheFields() {
        toasts = [];
        var server = okServer();
        return send({ method: 'POST', url: '/api/v1/invitations/signup', data: {
            first_name: 'Al' + SMILE, nok: { relationship: 'friend', first_name: PLANE + ' pilot' },
            items: [{ title: 'ok' }, { title: 'x' + SMILE }]
        } }, server).then(function (res) {
            check(server.calls === 0, 'blocked: never sent');
            check(res.status === 200 && res.data.success === false, 'answers like the server would (200 + refusal)');
            check(res.data.error === 'UNSUPPORTED_CHARACTERS', 'error code');
            check(JSON.stringify(res.data.fields) === JSON.stringify(['first_name', 'nok.first_name', 'items[1].title']), 'field paths ' + JSON.stringify(res.data.fields));
            check(res.data.message === "Emoji and some special symbols can't be saved — please remove them from: first name, nok › first name, items › title.",
                'same wording as the backend: ' + res.data.message);
            check(toasts.length === 1 && toasts[0][0] === 'warning' && toasts[0][2] === res.data.message, 'one warning toast with the message');
            check(WriteGuard.startedSince(0).length === 0, 'the pressed button is released (write settled)');
            return wait(200).then(function () { check(toasts.length === 1, 'no generic "Not saved" toast on top'); });
        });
    },
    function storableTextIsSent() {
        toasts = [];
        var server = okServer();
        return send({ method: 'PUT', url: '/api/v1/users/5', data: { first_name: 'Renée ✈ — £' } }, server).then(function (res) {
            check(server.calls === 1 && res.data.success === true, 'BMP text (é ✈ — £) goes through');
            check(toasts.length === 0, 'no toast');
        });
    },
    function uploadsPasswordsReadsAndOtherHostsAreNotScanned() {
        toasts = [];
        var server = okServer();
        var fd = new FakeFormData(); fd.name = 'x' + SMILE;
        var blob = new FakeBlob(); blob.name = SMILE;
        return Promise.all([
            send({ method: 'POST', url: '/api/v1/caa_forms/1/files', data: fd }, server),
            send({ method: 'POST', url: '/api/v1/defect_media', data: blob }, server),
            send({ method: 'POST', url: '/api/v1/users/login', data: { username: 'a@b.test', password: 'p' + SMILE, new_password2: SMILE } }, server),
            send({ method: 'GET', url: '/api/v1/members?q=' + SMILE, data: undefined }, server),
            send({ method: 'POST', url: 'https://maps.example.test/search', data: { q: SMILE } }, server),
            send({ method: 'POST', url: '/api/v1/bookings', data: { when: new Date(), $$hashKey: SMILE, onClick: function () {} } }, server)
        ]).then(function () {
            check(server.calls === 6, 'all six sent (' + server.calls + ')');
            check(toasts.length === 0, 'no toast');
        });
    },
    function aPreSerialisedJsonBodyIsScannedToo() {
        toasts = [];
        var server = okServer();
        return send({ method: 'POST', url: 'api/v1/notes', data: JSON.stringify({ text: 'hi ' + SMILE }) }, server).then(function (res) {
            check(server.calls === 0 && res.data.error === 'UNSUPPORTED_CHARACTERS', 'string body blocked');
            check(JSON.stringify(res.data.fields) === '["text"]', 'field from the parsed string');
        });
    },
    function theBackendRefusalIsToastedOnce() {
        toasts = [];
        var body = { success: false, error: 'UNSUPPORTED_CHARACTERS', message: "Emoji and some special symbols can't be saved — please remove them from: notes.", fields: ['notes'] };
        var server = refusingServer(body);
        return send({ method: 'POST', url: '/api/v1/notes', data: { notes: 'plain' } }, server).then(function (res) {
            check(server.calls === 1, 'sent (nothing to catch client-side)');
            check(res.data.error === 'UNSUPPORTED_CHARACTERS', 'handler sees the refusal');
            return wait(200).then(function () {
                check(toasts.length === 1 && toasts[0][0] === 'warning' && toasts[0][2] === body.message, 'exactly one warning toast: ' + JSON.stringify(toasts));
            });
        });
    },
    function manyFieldsAreSummarised() {
        var data = {};
        'abcdefg'.split('').forEach(function (k) { data[k] = SMILE; });
        var r = uc._refusal(uc._fieldsOf(data));
        check(r.fields.length === 7, '7 fields');
        check(/from: a, b, c, d, e and 2 more\.$/.test(r.message), r.message);
        var cyclic = { a: 'ok' }; cyclic.self = cyclic;
        check(uc._fieldsOf(cyclic).length === 0, 'a cyclic object does not loop');
    }
];

tests.reduce(function (p, t) {
    return p.then(function () { console.log('- ' + t.name); return t(); });
}, Promise.resolve()).then(function () {
    console.log('\n' + passed + ' passed, ' + failures + ' failed');
    process.exit(failures ? 1 : 0);
}, function (e) { console.error(e); process.exit(1); });
