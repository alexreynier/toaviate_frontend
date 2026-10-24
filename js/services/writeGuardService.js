// ═══════════════════════════════════════════════════════════════════
//  WriteGuard
//  App-wide double-submit protection. Tracks every in-flight WRITE
//  request (POST / PUT / PATCH / DELETE) that goes through $http and
//  lets the companion ng-click / ng-submit directive (js/directives/
//  busyGuard.js) correlate "this press started that write" so it can
//  lock the pressed element — disabled + spinner — until the write
//  settles. Nothing here changes what any controller does; it only
//  observes requests and hands out ids.
//
//  How the correlation works: a capture-phase listener on <document>
//  snapshots the write counter at the very START of every click /
//  submit, before any handler runs. The directive compares that mark
//  with the counter one tick later: any write ids above the mark were
//  started by this press.
//
//  Opt an element out with the `no-busy-guard` attribute.
// ═══════════════════════════════════════════════════════════════════

app.factory('WriteGuard', WriteGuard);
WriteGuard.$inject = ['$window'];
function WriteGuard($window) {
    var seq = 0;            // id handed to each write request, strictly increasing
    var inflight = {};      // id -> true while that request hasn't settled
    var waiters = [];       // { ids:{id:true}, remaining:n, cb } — callbacks awaiting a set of ids
    var eventMark = { ev: null, seq: 0 };

    var service = {
        isWrite: isWrite,
        begin: begin,
        end: end,
        seq: function () { return seq; },
        markFor: markFor,
        startedSince: startedSince,
        whenSettled: whenSettled
    };

    var doc = $window.document;
    if (doc && doc.addEventListener) {
        doc.addEventListener('click', stamp, true);
        doc.addEventListener('submit', stamp, true);
    }

    return service;

    function stamp(ev) {
        eventMark.ev = ev;
        eventMark.seq = seq;
    }

    function isWrite(config) {
        var m = ((config && config.method) || 'GET').toUpperCase();
        return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
    }

    function begin() {
        var id = ++seq;
        inflight[id] = true;
        return id;
    }

    function end(id) {
        if (!id || !inflight[id]) { return; }
        delete inflight[id];
        var fire = [];
        for (var i = waiters.length - 1; i >= 0; i--) {
            var w = waiters[i];
            if (w.ids[id]) {
                w.remaining--;
                if (w.remaining <= 0) {
                    waiters.splice(i, 1);
                    fire.push(w.cb);
                }
            }
        }
        for (var k = 0; k < fire.length; k++) { fire[k](); }
    }

    // The counter value as it was when this DOM event began (so writes the
    // event's handlers start are "after" it). Falls back to the live counter
    // for synthetic events that never passed through the document (e.g.
    // ngTouch's triggerHandler('click') on a tap) — the directive's listener
    // runs before the handler in that case, so "now" is still "before".
    function markFor(ev) {
        var native = ev && (ev.originalEvent || ev);
        if (native && native === eventMark.ev) { return eventMark.seq; }
        return seq;
    }

    // Ids of writes that were started after `mark` and are still in flight.
    function startedSince(mark) {
        var ids = [];
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id) && (+id) > mark) { ids.push(+id); }
        }
        return ids;
    }

    // Call cb once every id in `ids` has settled (success or failure).
    function whenSettled(ids, cb) {
        var set = {}, remaining = 0;
        for (var i = 0; i < ids.length; i++) {
            if (inflight[ids[i]]) { set[ids[i]] = true; remaining++; }
        }
        if (!remaining) { cb(); return; }
        waiters.push({ ids: set, remaining: remaining, cb: cb });
    }
}

// Registered FIRST in $httpProvider.interceptors (see app.js) so its
// request hook runs before apiUrlInterceptor and its responseError hook
// runs after it — a write that apiUrlInterceptor refuses at the request
// stage (session expired) still comes back through here with its config,
// so the pressed button is released rather than waiting for the safety
// timeout.
//
// It also owns the OUTCOME feedback for failed writes. Many handlers in this
// app redirect on success and do nothing at all on failure, so the user
// would see the button unlock in silence. When a write fails (HTTP error, or
// a 2xx whose body says success:false) and nothing else has put a toast up
// within 150 ms, a generic "not saved" toast is shown. Handlers that already
// report their own error keep doing so — ToastService.lastShownAt is the
// de-dup signal. Responses whose failure is part of a handled contract
// (CONFIRM_REQUIRED, FORBIDDEN gating, 3DS requires_action, …) are skipped.
app.factory('writeGuardInterceptor', ['WriteGuard', '$q', '$injector', function (WriteGuard, $q, $injector) {
    var DEDUP_MS = 150;
    // Backend codes that controllers handle with their own UI (modals,
    // hidden controls, retries) — never auto-toast these.
    var HANDLED_CODES = {
        CONFIRM_REQUIRED: 1, FORBIDDEN: 1, ALREADY_COPIED: 1, COPY_BUSY: 1,
        not_configured: 1, stripe_js_unavailable: 1, LOOKUP_UNAVAILABLE: 1,
        LOOKUP_FAILED: 1, AUTHENTICATION: 1, requires_action: 1, two_factor_required: 1,
        two_factor_setup_required: 1, existing_account: 1, out_of_stock: 1,
        ALREADY_SEPARATE: 1   // bs_sync "create temporary account" → inline "Create anyway" confirm
    };
    var SILENT_URLS = [
        '/users/login',              // the login ladder reports its own outcomes
        '/invitations/accept_existing',
        '/webauthn/'
    ];

    function settle(x) {
        var cfg = x && x.config;
        if (!cfg && x && x.method && x.url) { cfg = x; } // a bare config was rejected
        if (cfg && cfg.__wgId) { WriteGuard.end(cfg.__wgId); }
    }

    function codeOf(data) {
        if (!data || typeof data !== 'object') { return null; }
        var c = data.error || data.code || data.fail || data.reason;
        if (data.requires_action) { return 'requires_action'; }
        if (data.out_of_stock) { return 'out_of_stock'; }
        return (typeof c === 'string') ? c : null;
    }

    function textOf(data) {
        if (!data) { return null; }
        if (typeof data === 'string') { return /^\s*</.test(data) ? null : data; } // not an HTML error page
        var m = data.message;
        if (m && typeof m === 'object') { m = m.message || m.error || null; }
        return (typeof m === 'string' && m) ? m : (typeof data.error === 'string' && data.error) || null;
    }

    function isSilentUrl(url) {
        if (!url) { return false; }
        for (var i = 0; i < SILENT_URLS.length; i++) { if (url.indexOf(SILENT_URLS[i]) > -1) { return true; } }
        return false;
    }

    function reportFailure(config, status, data) {
        if (!config || !config.__wgId || isSilentUrl(config.url)) { return; }
        if (status === 401) { return; }                   // session freeze owns this
        var code = codeOf(data);
        if (code && HANDLED_CODES[code]) { return; }
        var at = new Date().getTime();
        setTimeout(function () {
            var ToastService = $injector.get('ToastService');
            if (ToastService.lastShownAt >= at - 5) { return; }   // the handler spoke already
            var title, sub;
            if (status <= 0) {
                title = 'Not saved — no connection';
                sub = "We couldn't reach the server. Check your connection and try again.";
            } else if (status >= 500) {
                title = 'Not saved — server error';
                sub = textOf(data) || 'The server hit a problem handling that. Please try again.';
            } else {
                title = 'Not saved';
                sub = textOf(data) || 'The server rejected that change. Please check the details and try again.';
            }
            ToastService.error(title, sub);
        }, DEDUP_MS);
    }

    return {
        request: function (config) {
            if (WriteGuard.isWrite(config)) { config.__wgId = WriteGuard.begin(); }
            return config;
        },
        response: function (response) {
            settle(response);
            var d = response && response.data;
            if (response && response.config && response.config.__wgId && d && typeof d === 'object' && d.success === false) {
                reportFailure(response.config, response.status, d);
            }
            return response;
        },
        responseError: function (rejection) {
            settle(rejection);
            if (rejection && rejection.config && rejection.config.__wgId && !rejection._sessionExpired) {
                reportFailure(rejection.config, rejection.status, rejection.data);
            }
            return $q.reject(rejection);
        }
    };
}]);
