// ═══════════════════════════════════════════════════════════════════
//  AirfieldHubService
//  Bilateral integration with AirfieldHub (AFH): one booking in ToAviate
//  books the aircraft OUT of the departure field and files a PPR at the
//  destination.
//
//    – Platform (ToAviate staff): environments, directory sync, queue health
//    – Club (manager): enable/environment/stage + aircraft registration link
//    – Pilot-facing: which destinations can file PPR, and the PPR decision
//
//  Backend contract: BACKEND_AIRFIELDHUB_INTEGRATION_GUIDE.md
//  Frontend guide:   FRONTEND_AIRFIELDHUB_INTEGRATION_GUIDE.md
//  Partner contract: PARTNER_API.md (AirfieldHub's own doc — it WINS on any
//                    disagreement).
//
//  ── Two rules this service exists to enforce ──
//
//  1. NO KEYS, EVER. The `afh_` partner key is per-ENVIRONMENT and lives on
//     the ToAviate server; the `tak_` platform key is AirfieldHub's. Neither
//     is per-club. /environments returns booleans only, by design. This
//     service must never send, receive, render or accept a key — if a ticket
//     asks for a "club AirfieldHub key" field, that is a misunderstanding to
//     correct, not to build. The frontend NEVER talks to AirfieldHub
//     directly; it talks to ToAviate, which holds the key and proxies.
//
//  2. AFH's VOCABULARY, NOT OURS. Statuses are capitalised exactly as the
//     partner sends them — 'New' / 'Approved' / 'Rejected' / 'Cancelled' /
//     'Pending' / 'Arrived' / 'Departed'. Never lowercase them and never
//     translate them into our words in a payload. Humanising for DISPLAY is
//     fine and lives in .describeStatus() below, which is the single place
//     that mapping is allowed to happen.
// ═══════════════════════════════════════════════════════════════════

app.factory('AirfieldHubService', AirfieldHubService);

AirfieldHubService.$inject = ['$http', '$q'];
function AirfieldHubService($http, $q) {

    var BASE = '/api/v1/airfieldhub_sync';

    // The mirrored AFH directory changes rarely (a sync is a deliberate admin
    // action) but is read on every destination pick, so cache per environment.
    // Short TTL bounds staleness right after a sync; ClearDirectoryCache()
    // drops it immediately when the admin runs one.
    var DIRECTORY_TTL_MS = 10 * 60 * 1000;
    var directoryCache = {};   // { env: { at: ms, byIcao: {...}, list: [...] } }

    var service = {};

    // ── Platform (ToAviate staff) ──
    service.GetEnvironments     = GetEnvironments;
    service.SaveCredentials     = SaveCredentials;
    service.TestEnvironment     = TestEnvironment;
    service.ClearCredentials    = ClearCredentials;
    service.SyncDirectory       = SyncDirectory;
    service.GetAirfields        = GetAirfields;
    service.GetOutbox           = GetOutbox;
    service.RunCron             = RunCron;

    // ── Club (manager) ──
    service.GetConfig           = GetConfig;
    service.SaveConfig          = SaveConfig;
    service.PushClubLink        = PushClubLink;

    // ── Flights / PPR ──
    service.GetFlights          = GetFlights;

    // ── Destination lookup (used by the bookout forms) ──
    service.LookupDestination   = LookupDestination;
    service.ClearDirectoryCache = ClearDirectoryCache;

    // ── Display helpers (the ONLY place API values become English) ──
    service.describeStatus      = describeStatus;
    service.stages              = STAGES;
    service.stageLabel          = stageLabel;

    return service;


    // ═══════════════════════════════════════════
    //  Platform — environments, directory, queue
    // ═══════════════════════════════════════════

    function GetEnvironments() {
        return $http.get(BASE + '/environments').then(handleSuccess, handleError);
    }

    // ── Credentials: WRITE-ONLY, one way ──
    //
    // AirfieldHub ISSUES these to us (unlike our own platform keys, which we
    // generate and can show once) — so the admin pastes them in. They are
    // stored server-side, encrypted at rest, and NEVER returned to the
    // browser: /environments answers `configured` / `has_webhook_secret`
    // booleans and a `key_hint` (last 4 chars) only.
    //
    // Same one-way contract as our platform keys and the BookedScheduler
    // credentials: you can SET and ROTATE, you can never READ BACK. If an
    // admin loses the value they re-paste it from AirfieldHub; we cannot
    // recover it for them, by design.
    //
    // Omit a field to leave it unchanged — so the webhook secret can be
    // rotated without re-entering the partner key, and vice versa.
    //   creds = { partner_key?: string, webhook_secret?: string, base_url?: string }
    function SaveCredentials(environment, creds) {
        return $http.post(BASE + '/credentials/' + encodeURIComponent(environment), creds)
            .then(function (res) {
                // A new key may point at a different AFH instance whose
                // directory differs — don't serve the old one from cache.
                ClearDirectoryCache(environment);
                return res.data;
            }, handleError);
    }

    // Server-side round trip to AirfieldHub to prove the stored key actually
    // works, so an admin isn't left guessing after a rotation. The key never
    // travels to the browser for this — we ask our own server to try it.
    function TestEnvironment(environment) {
        return $http.post(BASE + '/test/' + encodeURIComponent(environment), {})
            .then(handleSuccess, handleError);
    }

    // Removes the stored credentials for an environment. Any club pointing at
    // it stops being `effective` immediately, so the backend refuses while
    // clubs are still attached and returns them in `clubs` for the warning.
    function ClearCredentials(environment) {
        return $http.delete(BASE + '/credentials/' + encodeURIComponent(environment))
            .then(function (res) {
                ClearDirectoryCache(environment);
                return res.data;
            }, handleError);
    }

    // Full replace of the mirrored airfield directory for one environment.
    // MUST be run at least once per environment before anything can be
    // dispatched: no directory means nothing is network_confirmed, so every
    // flight is silently skipped.
    function SyncDirectory(environment) {
        return $http.post(BASE + '/sync_directory', { environment: environment })
            .then(function (res) {
                ClearDirectoryCache(environment);   // counts just changed
                return res.data;
            }, handleError);
    }

    function GetAirfields(environment) {
        return $http.get(BASE + '/airfields/' + encodeURIComponent(environment))
            .then(handleSuccess, handleError);
    }

    function GetOutbox(environment) {
        return $http.get(BASE + '/outbox/' + encodeURIComponent(environment))
            .then(handleSuccess, handleError);
    }

    // Drains the queue on demand. The cron does this on a schedule; exposing
    // it gives admins a "send now" and makes the §7 walkthrough testable
    // without waiting.
    function RunCron() {
        return $http.get(BASE + '/cron').then(handleSuccess, handleError);
    }


    // ═══════════════════════════════════════════
    //  Club — config + registration link
    // ═══════════════════════════════════════════

    function GetConfig(club_id) {
        return $http.get(BASE + '/config/' + club_id).then(handleSuccess, handleError);
    }

    // config = { afh_enabled: 0|1, afh_environment: 'dev'|…, afh_stage: 0..4 }
    // The backend rejects two combinations with a specific message — enabling
    // with no environment, and choosing an environment with no key on this
    // server. Callers should surface data.message rather than a generic error.
    function SaveConfig(club_id, config) {
        return $http.post(BASE + '/config/' + club_id, config)
            .then(handleSuccess, handleError);
    }

    // Pushes this club's current aircraft registrations to AFH so AFH can
    // mirror tower-created movements back for THIS club's aircraft only.
    // It is a FULL REPLACE, so re-running it is also how the list is kept in
    // check — safe to run any time.
    function PushClubLink(club_id) {
        return $http.post(BASE + '/club_link/' + club_id, {})
            .then(handleSuccess, handleError);
    }


    // ═══════════════════════════════════════════
    //  Flights / PPR
    // ═══════════════════════════════════════════

    function GetFlights(club_id) {
        return $http.get(BASE + '/flights/' + club_id).then(handleSuccess, handleError);
    }


    // ═══════════════════════════════════════════
    //  Destination lookup
    // ═══════════════════════════════════════════

    // Resolves ONE destination against the mirrored directory and answers the
    // only question the bookout forms care about: can a PPR be filed here
    // automatically?
    //
    // Resolves (never rejects) with:
    //   { known: bool, confirmed: bool, airfield: {...}|null, reason: string }
    //
    // `reason` distinguishes "we looked and it isn't on AFH" from "we couldn't
    // look" — the UI must not claim an airfield is unsupported when the
    // directory simply failed to load. Callers treat anything other than
    // confirmed:true as "arrange PPR yourself", which is the safe default.
    function LookupDestination(environment, icao) {
        if (!environment || !icao) {
            return $q.resolve({ known: false, confirmed: false, airfield: null, reason: 'no_input' });
        }

        var code = String(icao).trim().toUpperCase();

        return loadDirectory(environment).then(function (dir) {
            if (!dir) {
                return { known: false, confirmed: false, airfield: null, reason: 'directory_unavailable' };
            }
            var af = dir.byIcao[code] || null;
            if (!af) {
                return { known: false, confirmed: false, airfield: null, reason: 'not_in_directory' };
            }
            // network_confirmed is the ONLY flag that means "can receive
            // movements". Present-but-unconfirmed is common (AFH lists many
            // airfields; only some are live on the network).
            var confirmed = (Number(af.network_confirmed) === 1);
            return {
                known: true,
                confirmed: confirmed,
                airfield: af,
                reason: confirmed ? 'confirmed' : 'not_confirmed'
            };
        });
    }

    function loadDirectory(environment) {
        var hit = directoryCache[environment];
        if (hit && (nowMs() - hit.at) < DIRECTORY_TTL_MS) {
            return $q.resolve(hit);
        }

        return GetAirfields(environment).then(function (data) {
            if (!data || !data.success || !angular.isArray(data.airfields)) { return null; }

            var byIcao = {};
            for (var i = 0; i < data.airfields.length; i++) {
                var af = data.airfields[i];
                var key = (af.icao || af.code || '').toUpperCase();
                if (key) { byIcao[key] = af; }
            }

            var entry = { at: nowMs(), byIcao: byIcao, list: data.airfields };
            directoryCache[environment] = entry;
            return entry;
        }, function () {
            return null;   // resolve, so a lookup failure never breaks a booking
        });
    }

    function ClearDirectoryCache(environment) {
        if (environment) { delete directoryCache[environment]; }
        else { directoryCache = {}; }
    }


    // ═══════════════════════════════════════════
    //  Display helpers
    // ═══════════════════════════════════════════

    // The rollout stages. Stage 0 dispatches NOTHING even when enabled —
    // that is the point: configure, verify, then start the flow.
    var STAGES = [
        { value: 0, label: 'Off',
          help: 'Configured, but nothing is sent to AirfieldHub yet.' },
        { value: 1, label: 'Shadow',
          help: 'Flights are sent to AirfieldHub. Nothing changes for controllers on either side.' },
        { value: 2, label: 'Mirror',
          help: 'The AirfieldHub board is live read-only. Controllers still work in ToAviate.' },
        { value: 3, label: 'Dual-write',
          help: 'AirfieldHub is the working board. The ToAviate display stays as a fallback.' },
        { value: 4, label: 'AirfieldHub only',
          help: 'The ToAviate tower display is retired for this airfield.' }
    ];

    function stageLabel(stage) {
        for (var i = 0; i < STAGES.length; i++) {
            if (STAGES[i].value === Number(stage)) { return STAGES[i].label; }
        }
        return 'Unknown';
    }

    // Humanises an AFH status for DISPLAY only — the API value is never
    // changed. `kind` is 'arrival' or 'departure'; the same status reads
    // differently on each leg, and getting this wrong is dangerous:
    //
    //   'New' on an ARRIVAL means AWAITING the airfield's decision. It is not
    //   approval and must never be rendered green or imply the pilot may
    //   launch. On a DEPARTURE there is no PPR at all, so approval language
    //   must not appear.
    function describeStatus(status, kind) {
        var isArrival = (kind === 'arrival');

        switch (status) {
            case 'Pending':
                return { text: 'Queued', tone: 'neutral', icon: 'fa-clock' };
            case 'New':
                return isArrival
                    ? { text: 'Awaiting PPR', tone: 'info', icon: 'fa-hourglass-half' }
                    : { text: 'Booked out',   tone: 'info', icon: 'fa-plane-departure' };
            case 'Approved':
                return isArrival
                    ? { text: 'PPR approved', tone: 'success', icon: 'fa-check-circle' }
                    // A departure has no PPR to approve; stay factual.
                    : { text: 'Booked out',   tone: 'info',    icon: 'fa-plane-departure' };
            case 'Rejected':
                return isArrival
                    ? { text: 'PPR refused',  tone: 'error', icon: 'fa-times-circle' }
                    : { text: 'Refused',      tone: 'error', icon: 'fa-times-circle' };
            case 'Cancelled':
                return { text: 'Cancelled', tone: 'muted', icon: 'fa-ban' };
            case 'Arrived':
                return { text: 'Arrived',  tone: 'muted', icon: 'fa-plane-arrival' };
            case 'Departed':
                return { text: 'Departed', tone: 'muted', icon: 'fa-plane-departure' };
            default:
                // Unknown status from a partner API: show it verbatim rather
                // than swallowing it, so a contract change is visible.
                return { text: status || 'Unknown', tone: 'neutral', icon: 'fa-question-circle' };
        }
    }


    // ═══════════════════════════════════════════
    //  Plumbing
    // ═══════════════════════════════════════════

    // Date.now() via a named helper so the intent is obvious and there is one
    // place to stub it if this ever needs testing with a fake clock.
    function nowMs() { return new Date().getTime(); }

    function handleSuccess(res) { return res.data; }

    function handleError(res) {
        return {
            success: false,
            message: (res && res.data && (res.data.message || res.data.error))
                ? (res.data.message || res.data.error)
                : 'Could not reach AirfieldHub settings. Please try again.',
            status: res ? res.status : 0
        };
    }
}
