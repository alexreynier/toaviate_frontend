// ═══════════════════════════════════════════════════════════════════
//  AirfieldHubAdminController
//  ToAviate STAFF screen for the AirfieldHub integration — the parts that
//  are server-wide rather than per-club:
//     – Environments (which have a key configured on this server)
//     – Directory sync (mirror AFH's airfield list per environment)
//     – Queue health (outbox counts; `dead` is the number that matters)
//
//  Per-club settings (enable / environment / stage / registration link) are
//  a SEPARATE screen — see airfieldHubClubController.js. The split follows
//  the guide: §3 is club-scoped, but §8.1 is explicit that the credential is
//  per-ENVIRONMENT and server-held, so environment/directory/queue are not a
//  club manager's business.
//
//  There is deliberately NO key input anywhere in this controller. See the
//  header of airfieldHubService.js.
//
//  Contract: FRONTEND_AIRFIELDHUB_INTEGRATION_GUIDE.md §3.1, §3.4, §3.6
// ═══════════════════════════════════════════════════════════════════

app.controller('AirfieldHubAdminController', AirfieldHubAdminController);

AirfieldHubAdminController.$inject = ['AirfieldHubService', 'ToastService', '$rootScope', '$scope', '$timeout'];
function AirfieldHubAdminController(AirfieldHubService, ToastService, $rootScope, $scope, $timeout) {

    var vm = this;

    vm.user = $rootScope.globals.currentUser;
    vm.is_staff = $rootScope.isToAviateStaff();

    vm.active_tab = 'environments';
    vm.setTab = setTab;

    vm.loading = true;
    vm.environments = [];
    vm.selected_env = null;

    // Directory
    vm.directory = null;
    vm.directory_loading = false;
    vm.syncing = false;
    vm.sync_result = null;
    vm.dir_search = '';

    // Queue
    vm.outbox = null;
    vm.outbox_loading = false;
    vm.draining = false;

    // Credentials (write-only — see the service)
    vm.cred_form = null;      // null = closed; otherwise the editing form
    vm.cred_saving = false;
    vm.testing = false;
    vm.test_result = null;
    vm.confirm_clear = false;

    vm.openCredentials = openCredentials;
    vm.closeCredentials = closeCredentials;
    vm.saveCredentials = saveCredentials;
    vm.testEnvironment = testEnvironment;
    vm.askClear        = askClear;
    vm.cancelClear     = cancelClear;
    vm.clearCredentials = clearCredentials;
    vm.credsDirty      = credsDirty;

    vm.selectEnv       = selectEnv;
    vm.runSync         = runSync;
    vm.loadDirectory   = loadDirectory;
    vm.loadOutbox      = loadOutbox;
    vm.drainQueue      = drainQueue;
    vm.dismissSync     = dismissSync;
    vm.num             = num;
    vm.confirmedCount  = confirmedCount;

    init();


    function init() {
        // The backend is authoritative; this is a UX guard so non-staff get a
        // clear message instead of a wall of failed requests.
        if (!vm.is_staff) {
            vm.loading = false;
            return;
        }

        AirfieldHubService.GetEnvironments()
            .then(function (data) {
                vm.loading = false;
                if (!data || !data.success) {
                    vm.error = (data && data.message) || 'Could not load environments.';
                    return;
                }
                vm.environments = data.environments || [];

                // Default to the first CONFIGURED environment — selecting an
                // unconfigured one would only produce a refusal.
                for (var i = 0; i < vm.environments.length; i++) {
                    if (vm.environments[i].configured) {
                        selectEnv(vm.environments[i]);
                        break;
                    }
                }
            });
    }

    function setTab(tab) {
        vm.active_tab = tab;
        // Load lazily so opening the page doesn't fire three requests.
        if (tab === 'directory' && vm.selected_env && !vm.directory) { loadDirectory(); }
        if (tab === 'queue'     && vm.selected_env && !vm.outbox)    { loadOutbox(); }
    }

    function selectEnv(env) {
        // Unconfigured environments are rendered disabled with an explanation
        // rather than hidden (an admin wondering where production went
        // deserves an answer) — but they must not become selectable.
        if (!env || !env.configured) { return; }

        vm.selected_env = env;
        vm.directory = null;
        vm.outbox = null;
        vm.sync_result = null;

        if (vm.active_tab === 'directory') { loadDirectory(); }
        if (vm.active_tab === 'queue')     { loadOutbox(); }
    }


    // ── Credentials ────────────────────────────
    //
    // WRITE-ONLY. AirfieldHub issues these keys to us, so the admin pastes
    // them; we store them server-side (encrypted) and never render a value
    // back. Same one-way contract as our own platform keys and the
    // BookedScheduler credentials.
    //
    // Editing an environment that already has a key is a ROTATION: leave a
    // field blank to keep the current value, so the webhook secret can be
    // changed without re-entering the partner key.

    function openCredentials(env) {
        var target = env || vm.selected_env;
        if (!target) { return; }

        vm.test_result = null;
        vm.confirm_clear = false;
        vm.cred_form = {
            environment:    target.environment,
            base_url:       target.base_url || '',
            partner_key:    '',
            webhook_secret: '',
            // Existing values drive the placeholder copy — we can show that a
            // key EXISTS and its last 4 chars, never the key itself.
            had_key:        !!target.configured,
            had_secret:     !!target.has_webhook_secret,
            key_hint:       target.key_hint || null
        };
    }

    function closeCredentials() {
        vm.cred_form = null;
        vm.confirm_clear = false;
    }

    function credsDirty() {
        if (!vm.cred_form) { return false; }
        var f = vm.cred_form;
        var envRow = findEnv(f.environment);
        return !!(f.partner_key || f.webhook_secret
               || (f.base_url && f.base_url !== (envRow && envRow.base_url)));
    }

    function saveCredentials() {
        if (!vm.cred_form || vm.cred_saving) { return; }

        var f = vm.cred_form;

        // A brand-new environment needs at least a key to be usable; a
        // rotation may legitimately change only one field.
        if (!f.had_key && !f.partner_key) {
            ToastService.warning('Partner key required',
                'Paste the key AirfieldHub issued for this environment.');
            return;
        }

        // Send ONLY what changed — omitted fields keep their stored value.
        var payload = {};
        if (f.partner_key)    { payload.partner_key    = f.partner_key.trim(); }
        if (f.webhook_secret) { payload.webhook_secret = f.webhook_secret.trim(); }
        if (f.base_url)       { payload.base_url       = f.base_url.trim(); }

        vm.cred_saving = true;
        AirfieldHubService.SaveCredentials(f.environment, payload)
            .then(function (data) {
                vm.cred_saving = false;

                if (!data || !data.success) {
                    ToastService.error('Could not save credentials',
                        (data && data.message) || 'Please try again.');
                    return;
                }

                // Clear the pasted secrets from scope the moment they're
                // stored — no reason to keep them in memory.
                f.partner_key = '';
                f.webhook_secret = '';

                ToastService.success('Credentials saved',
                    'Stored on the server. They cannot be read back — keep your copy safe.');

                closeCredentials();
                refreshEnvironments(f.environment);
            });
    }

    // Proves the STORED key actually works, so a rotation isn't a leap of
    // faith. The key never comes to the browser: our server makes the call.
    function testEnvironment() {
        var env = vm.selected_env;
        if (!env || vm.testing) { return; }

        vm.testing = true;
        vm.test_result = null;

        AirfieldHubService.TestEnvironment(env.environment)
            .then(function (data) {
                vm.testing = false;
                vm.test_result = {
                    ok: !!(data && data.success),
                    message: (data && data.message) ||
                             (data && data.success ? 'AirfieldHub responded.' : 'No response from AirfieldHub.')
                };
            });
    }

    function askClear()    { vm.confirm_clear = true; }
    function cancelClear() { vm.confirm_clear = false; }

    function clearCredentials() {
        var env = vm.selected_env;
        if (!env) { return; }

        vm.cred_saving = true;
        AirfieldHubService.ClearCredentials(env.environment)
            .then(function (data) {
                vm.cred_saving = false;
                vm.confirm_clear = false;

                if (!data || !data.success) {
                    // The backend refuses while clubs still point at this
                    // environment — they'd silently stop dispatching.
                    ToastService.error('Could not remove credentials',
                        (data && data.message) || 'Please try again.');
                    return;
                }

                ToastService.success('Credentials removed',
                    'This environment can no longer be selected.');
                closeCredentials();
                refreshEnvironments(null);
            });
    }

    function findEnv(name) {
        for (var i = 0; i < vm.environments.length; i++) {
            if (vm.environments[i].environment === name) { return vm.environments[i]; }
        }
        return null;
    }

    // Re-read the booleans after any credential change, keeping the admin on
    // the environment they were working with where possible.
    function refreshEnvironments(keepEnv) {
        AirfieldHubService.GetEnvironments()
            .then(function (data) {
                if (!data || !data.success) { return; }
                vm.environments = data.environments || [];

                var target = keepEnv ? findEnv(keepEnv) : null;
                if (target && target.configured) {
                    vm.selected_env = target;
                    return;
                }
                // Previously selected environment may have just been cleared.
                if (vm.selected_env && !findEnvConfigured(vm.selected_env.environment)) {
                    vm.selected_env = null;
                    for (var i = 0; i < vm.environments.length; i++) {
                        if (vm.environments[i].configured) { selectEnv(vm.environments[i]); break; }
                    }
                }
            });
    }

    function findEnvConfigured(name) {
        var e = findEnv(name);
        return !!(e && e.configured);
    }


    // ── Directory ──────────────────────────────

    function loadDirectory() {
        if (!vm.selected_env) { return; }
        vm.directory_loading = true;

        AirfieldHubService.GetAirfields(vm.selected_env.environment)
            .then(function (data) {
                vm.directory_loading = false;
                if (!data || !data.success) {
                    vm.directory = { airfields: [] };
                    return;
                }
                vm.directory = data;
            });
    }

    function runSync() {
        if (!vm.selected_env || vm.syncing) { return; }

        vm.syncing = true;
        vm.sync_result = null;

        AirfieldHubService.SyncDirectory(vm.selected_env.environment)
            .then(function (data) {
                vm.syncing = false;
                if (!data || !data.success) {
                    ToastService.error('Directory sync failed',
                        (data && data.message) || 'Please try again.');
                    return;
                }
                vm.sync_result = data;
                ToastService.success('Directory synced',
                    num(data.network_confirmed) + ' airfields can receive movements.');
                loadDirectory();
            });
    }

    function dismissSync() { vm.sync_result = null; }

    // matched_local < received is NORMAL (AFH knows airfields we don't), so
    // the UI must not present it as an error.
    function confirmedCount() {
        if (!vm.directory || !vm.directory.airfields) { return 0; }
        var n = 0;
        for (var i = 0; i < vm.directory.airfields.length; i++) {
            if (Number(vm.directory.airfields[i].network_confirmed) === 1) { n++; }
        }
        return n;
    }


    // ── Queue health ───────────────────────────

    function loadOutbox() {
        if (!vm.selected_env) { return; }
        vm.outbox_loading = true;

        AirfieldHubService.GetOutbox(vm.selected_env.environment)
            .then(function (data) {
                vm.outbox_loading = false;
                vm.outbox = (data && data.success) ? (data.counts || {}) : null;
            });
    }

    function drainQueue() {
        if (vm.draining) { return; }
        vm.draining = true;

        AirfieldHubService.RunCron()
            .then(function () {
                // Give the drain a moment before re-reading, otherwise the
                // counts often come back unchanged and it reads as a no-op.
                $timeout(function () {
                    vm.draining = false;
                    loadOutbox();
                    ToastService.success('Queue drained', 'Outbox counts refreshed.');
                }, 800);
            });
    }


    // MySQL returns numerics as strings; coerce before arithmetic/comparison.
    function num(v) { return Number(v || 0); }
}
