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
        ALREADY_SEPARATE: 1,  // bs_sync "create temporary account" → inline "Create anyway" confirm
        MERGE_CONFIRM_REQUIRED: 1,  // bs_sync convert → inline "merge into X?" confirm
        EMAIL_IN_USE: 1,      // bs_sync convert → inline field error on the typed email
        // Account email addresses + step-up (FRONTEND_ACCOUNT_EMAILS_GUIDE.md):
        // every one of these is rendered inline by the step-up modal, the
        // Security-page card, the public confirm pages or the staff recovery card.
        STEP_UP_REQUIRED: 1, WRONG_PASSWORD: 1, WRONG_CODE: 1, TOO_MANY_ATTEMPTS: 1,
        EXPIRED: 1, INVALID_EMAIL: 1, LIMIT_REACHED: 1, IS_PRIMARY: 1, NOT_VERIFIED: 1,
        RATE_LIMITED: 1, ADMIN_2FA_REQUIRED: 1, FOUR_EYES: 1, OPEN_CASE_EXISTS: 1,
        ALREADY_ADDED: 1, SEND_FAILED: 1, BAD_PURPOSE: 1, EMAIL_TAKEN: 1, IMPORTED_USER: 1,
        VALIDATION_ERROR: 1, NO_PRIMARY: 1, ALREADY_ON_ACCOUNT: 1, CASE_CLOSED: 1,
        ALREADY_APPROVED: 1, COMPLETION_FAILED: 1,
        // Track data (FRONTEND_TRACK_DATA_GUIDE.md): reconciliation Apply + admin link tools
        // render these inline / as their own toasts.
        NOTHING_TO_APPLY: 1, BAD_FIELDS: 1, NO_TRACK: 1, UNAVAILABLE: 1, BAD_DECISION: 1,
        ENTRY_REQUIRED: 1, ENTRY_NOT_FOUND: 1, ENTRY_IMEI_MISMATCH: 1, ALREADY_LINKED: 1,
        ALREADY_UNLINKED: 1, FILE_MISSING: 1, APPLY_FAILED: 1, EMPTY_SEGMENT: 1,
        PHANTOM_SPLIT_POINT: 1, BLOCKED: 1, NOT_SUSPECT: 1, NOT_A_SPLIT: 1,  // split picker confirm / suspect-splits unsplit
        OTHER_LEG_ACKNOWLEDGEMENT_REQUIRED: 1,  // cancel-claim on a split pair → checkbox in the modal
        // Records entered on an instructor's behalf (BACKEND_ADMIN_STUDENT_RECORDS_GUIDE.md):
        // the debrief flags its instructor picker; confirm/edit toast their own outcome.
        INSTRUCTOR_REQUIRED: 1, NOTHING_TO_CONFIRM: 1, ALREADY_SUPERSEDED: 1,
        // clubs.double_booking_by (scheduler v2 drag / booking panel): the controller toasts its own
        // "this club only lets instructors and admins add a second booking" line.
        DOUBLE_BOOKING_NOT_ALLOWED: 1,
        // Cancellation fees (CancellationFeesService): the booking card / panel popup / Cancellations
        // panel toast their own "fee not added / not reversed" line.
        ALREADY_CLAIMED: 1, NO_FEE: 1, NO_PILOT: 1, NOT_CLAIMED: 1, ALREADY_COLLECTED: 1, NOT_AVAILABLE: 1,
        // Book-out refusals (POST plane_log_sheets): the book-out page opens its airworthiness /
        // pilot-checks dialogs or toasts and scrolls to the pre-flight check card itself.
        airworthiness: 1, pilot_checks: 1, aircraft_check_required: 1, booking_invalid: 1, not_allowed: 1,
        already_booked_out: 1, save_failed: 1, booking_waiting_list: 1, booking_not_approved: 1,
        // Book-in v2 (be-alex-3e C4: context / quote / commit): the v2 book-in page shows its own message for each.
        QUOTE_CHANGED: 1, INCOMPLETE: 1, IN_PROGRESS: 1, SPLIT_NOT_SUPPORTED: 1, ALREADY_BOOKED_IN: 1, NOT_BUILT: 1,
        // …and C26 ("looks like yours"): a booking that can't take the flight — the page says so and books it in on its own.
        BOOKING_NOT_LINKABLE: 1,
        // Two-step sign-in safety (be-alex-3e C22): the v1/v2 turn-off dialogs show the club rule themselves; the
        // super-admin reset says "Not yet — until …" for a reset still inside its 24 h hold.
        CLUB_REQUIRES_2FA: 1, HOLD_NOT_PASSED: 1,
        // Emoji / 4-byte characters: unsupportedCharactersInterceptor (below) toasts its own
        // warning — for a request it blocked before sending AND for the backend's refusal.
        UNSUPPORTED_CHARACTERS: 1
    };
    var SILENT_URLS = [
        '/users/login',              // the login ladder reports its own outcomes
        '/users/two_factor_help',    // "Lost your phone?" on the code screen says what happened itself (C28)
        '/invitations/accept_existing',
        '/webauthn/',
        '/account_email_confirm/',  // public confirm/cancel pages render one uniform "invalid link" panel
        '/two_factor_reset_cancel/' // public "STOP THIS RESET" page — same uniform panel (C22)
    ];
    // a book-in v2 quote (POST plane_log_sheets/v2/book_in/{pls}/quote) saves nothing: the page shows what is missing
    var SILENT_URL_PATTERNS = [/\/plane_log_sheets\/v2\/book_in\/\d+\/quote(\?|$)/,
        // background writes nobody pressed for (v2 training): "viewed" when a row opens, the material heartbeat, the
        // questionnaire autosave — their pages say what they need to ("Not saved — trying again"); Mark as done toasts its own
        /\/course_assignments\/\d+\/viewed(\?|$)/, /\/course_materials\/\d+\/track(\?|$)/, /\/questionnaires\/attempt\/\d+\/save(\?|$)/];

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
        for (var j = 0; j < SILENT_URL_PATTERNS.length; j++) { if (SILENT_URL_PATTERNS[j].test(url)) { return true; } }
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

// ═══════════════════════════════════════════════════════════════════
//  unsupportedCharactersInterceptor — emoji & other 4-byte characters
//  (backend: BACKEND_UNSUPPORTED_CHARACTERS_GUIDE.md).
//
//  The database connection can't store a character outside the Basic
//  Multilingual Plane (every emoji is one), so the API refuses any write
//  that carries one: {success:false, error:"UNSUPPORTED_CHARACTERS",
//  message:"Emoji and some special symbols can't be saved — please remove
//  them from: <fields>.", fields:[...]} (HTTP 200).
//
//  This interceptor catches it BEFORE sending: it scans the JSON body of
//  every API write for a surrogate pair, and when it finds one it does not
//  send the request — the caller gets exactly what the server would have
//  answered (a 200 whose body is that refusal, so every handler that reads
//  data.success / data.message behaves as for the real one) — and it toasts
//  the message, naming the field(s). It toasts the backend's refusal too
//  (UNSUPPORTED_CHARACTERS is in writeGuard's HANDLED_CODES, so the generic
//  "Not saved" toast stays out of the way). Never scanned: file uploads
//  (FormData / Blob / File / binary), password fields (hashed server-side,
//  never stored as text), non-API URLs, reads.
//
//  Registered LAST in app.js (after apiUrlInterceptor): a blocked request
//  never reaches the network or the circuit breaker's failure count.
// ═══════════════════════════════════════════════════════════════════
app.factory('unsupportedCharactersInterceptor', ['$q', '$injector', '$window', function ($q, $injector, $window) {
    var CODE = 'UNSUPPORTED_CHARACTERS';
    var SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
    var SECRET_KEY = /password|passwd|passphrase/i;
    var MAX_NAMED = 5;
    var MAX_DEPTH = 40;

    function isWrite(config) {
        var m = ((config && config.method) || 'GET').toUpperCase();
        return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
    }

    function isApiUrl(url) {
        return typeof url === 'string' && url.indexOf('api/v1/') > -1;
    }

    function isOpaque(v) {
        var w = $window || {};
        if (w.FormData && v instanceof w.FormData) { return true; }
        if (w.Blob && v instanceof w.Blob) { return true; }              // File is a Blob
        if (w.ArrayBuffer && (v instanceof w.ArrayBuffer || (w.ArrayBuffer.isView && w.ArrayBuffer.isView(v)))) { return true; }
        if (w.URLSearchParams && v instanceof w.URLSearchParams) { return true; }
        if (v instanceof Date || typeof v.toJSON === 'function') { return true; }   // serialises to a date string
        return false;
    }

    // Field paths, in the backend's format: "nok.first_name", "items[2].title".
    function scan(value, path, depth, seen, out) {
        if (typeof value === 'string') {
            if (SURROGATE_PAIR.test(value)) { out.push(path || 'the request'); }
            return out;
        }
        if (!value || typeof value !== 'object' || depth > MAX_DEPTH || isOpaque(value)) { return out; }
        if (seen.indexOf(value) > -1) { return out; }
        seen.push(value);
        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) { scan(value[i], path + '[' + i + ']', depth + 1, seen, out); }
            return out;
        }
        for (var k in value) {
            if (!Object.prototype.hasOwnProperty.call(value, k)) { continue; }
            if (k.charAt(0) === '$' && k.charAt(1) === '$') { continue; }   // angular.toJson drops $$hashKey & co.
            if (typeof value[k] === 'function' || SECRET_KEY.test(k)) { continue; }
            if (SURROGATE_PAIR.test(k)) { out.push(path || '(a field name)'); continue; }
            scan(value[k], path ? path + '.' + k : k, depth + 1, seen, out);
        }
        return out;
    }

    function fieldsOf(data) {
        if (data === null || data === undefined) { return []; }
        if (typeof data === 'string') {
            if (!SURROGATE_PAIR.test(data)) { return []; }
            try { return scan(JSON.parse(data), '', 0, [], []); } catch (e) { return ['the request']; }
        }
        return scan(data, '', 0, [], []);
    }

    // "nok.first_name" → "nok › first name" — the backend's wording, word for word.
    function label(path) {
        return String(path).replace(/\[\d+\]/g, '').replace(/_/g, ' ').split('.').join(' › ').replace(/^\s+|\s+$/g, '');
    }

    function refusal(fields) {
        var labels = [];
        for (var i = 0; i < fields.length; i++) {
            var l = label(fields[i]);
            if (l && labels.indexOf(l) === -1) { labels.push(l); }
        }
        var list = labels.slice(0, MAX_NAMED).join(', ');
        if (labels.length > MAX_NAMED) { list += ' and ' + (labels.length - MAX_NAMED) + ' more'; }
        return {
            success: false,
            error: CODE,
            message: "Emoji and some special symbols can't be saved — please remove them from: " + list + '.',
            fields: fields
        };
    }

    function toast(data) {
        try {
            $injector.get('ToastService').warning('Not saved', data.message, { duration: 7000 });
        } catch (e) {}
    }

    function isRefusal(data) {
        return !!(data && typeof data === 'object' && data.error === CODE);
    }

    var service = {
        request: function (config) {
            if (!config || !isWrite(config) || !isApiUrl(config.url)) { return config; }
            var fields = fieldsOf(config.data);
            if (!fields.length) { return config; }
            return $q.reject({ data: refusal(fields), status: 200, config: config, _blockedClientSide: true,
                               statusText: 'Not sent: emoji / unsupported characters in the request.' });
        },
        response: function (response) {
            if (response && isRefusal(response.data)) { toast(response.data); }
            return response;
        },
        responseError: function (rejection) {
            if (rejection && rejection._blockedClientSide) {
                // Answer the caller the way the server would have: a 200 carrying the refusal.
                toast(rejection.data);
                return { data: rejection.data, status: 200, config: rejection.config, statusText: rejection.statusText,
                         headers: function () { return null; }, _blockedClientSide: true };
            }
            if (rejection && isRefusal(rejection.data)) { toast(rejection.data); }
            return $q.reject(rejection);
        },
        // exposed for tests
        _fieldsOf: fieldsOf,
        _refusal: refusal
    };
    return service;
}]);

// ═══════════════════════════════════════════════════════════════════
//  errorBodyInterceptor (9 Nov) — an API error that comes back as an HTML page (PHP fatal, proxy 502) or with no body
//  reached the services as a raw string: many services hand `res.data` straight back, a string passes every
//  `data.success !== false` check (so a failed save read as done), and the HTML landed in toasts. Error responses
//  (status ≥ 400 except 401, or 0 = network) whose body is not an object become
//  { success:false, error:'SERVER_ERROR'|'NETWORK_ERROR'|'REQUEST_FAILED', message, status }. JSON error bodies are
//  untouched; 401 is left to the session freeze; successful responses are never changed.
// ═══════════════════════════════════════════════════════════════════
app.factory('errorBodyInterceptor', ['$q', function ($q) {
    return {
        responseError: function (response) {
            var cfg = response && response.config, url = cfg && cfg.url || '';
            if (url.indexOf('/api/') > -1 && response.status !== 401 && (response.data === null || response.data === undefined || typeof response.data !== 'object')) {
                var status = response.status || 0;
                response.data = {
                    success: false,
                    error: status === 0 || status === -1 ? 'NETWORK_ERROR' : (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED'),
                    message: status === 0 || status === -1 ? 'We couldn’t reach the server — check your connection and try again.'
                        : (status >= 500 ? 'The server had a problem — please try again in a moment.' : 'That request didn’t go through — please try again.'),
                    status: status
                };
                // code that glues the body into a sentence ('Error: ' + data.message) gets the message, not [object Object]
                Object.defineProperty(response.data, 'toString', { value: function () { return this.message; } });
            }
            return $q.reject(response);
        }
    };
}]);
