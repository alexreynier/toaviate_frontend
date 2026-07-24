// One controller serves every screen of the ToAviate-admin Aircraft Registry
// sync (CAA G-INFO → our reference/autocomplete table); the screen is chosen
// by the route's data.screen (same architecture as GclMonitorController).
// Screens: sync, advisories, history.
//
// The three server-enforced safety rules this UI surfaces (never re-implements):
//   1. nothing is ever deleted — vanished regs are marked deregistered;
//   2. club-assigned registrations are never auto-updated — they park as
//      advisories reviewed one-by-one (and only the REFERENCE row changes);
//   3. a run is created staged and only scrapes after an explicit Start.
//
// Access: ToAviate staff only — the backend is authoritative (403 FORBIDDEN),
// this mirrors TrackerAdminController's client-side bounce.
app.controller('AircraftRegistryController', AircraftRegistryController);
    AircraftRegistryController.$inject = ['AircraftRegistryService', 'ToastService', '$rootScope', '$scope', '$state', '$location', '$interval', '$timeout', '$window'];
    function AircraftRegistryController(AircraftRegistryService, ToastService, $rootScope, $scope, $state, $location, $interval, $timeout, $window) {
        var vm = this;
        vm.user = $rootScope.globals.currentUser;
        vm.is_toaviate_staff = !!(vm.user && vm.user.email && /@toaviate\.com$/i.test(vm.user.email));
        if (!vm.is_toaviate_staff) {
            $location.path('/dashboard');
            return;
        }

        vm.screen = $state.current.data.screen;
        vm.enums = AircraftRegistryService.enums;
        vm.loading = false;
        vm.forbidden = false;

        // ── Sub-nav (shared partial views/manageclub/aircraft_registry/_nav.html) ──
        vm.nav = [
            { screen: 'sync',       state: 'dashboard.super_admin.aircraft_registry',            label: 'Sync',       icon: 'fa-sync-alt' },
            { screen: 'advisories', state: 'dashboard.super_admin.aircraft_registry_advisories', label: 'Advisories', icon: 'fa-clipboard-check' },
            { screen: 'history',    state: 'dashboard.super_admin.aircraft_registry_history',    label: 'History',    icon: 'fa-history' }
        ];
        vm.go = function(state, params) { $state.go(state, params || {}); };

        // ── Shared helpers ────────────────────────────────────────────────
        vm.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };
        vm.runBadge      = function(st) { return AircraftRegistryService.badges.run[st]      || 'trk-badge--grey'; };
        vm.advisoryBadge = function(st) { return AircraftRegistryService.badges.advisory[st] || 'trk-badge--grey'; };
        // Timestamps arrive as UTC — relative on screen, absolute local on hover
        vm.ago = function(ts) { return ts ? moment.utc(String(ts).replace(' ', 'T')).fromNow() : ''; };
        vm.abs = function(ts) { return ts ? moment.utc(String(ts).replace(' ', 'T')).local().format('ddd D MMM YYYY, HH:mm:ss') : ''; };
        vm.duration = function(run) {
            if (!run || !run.created_at) { return '—'; }
            var start = moment.utc(String(run.created_at).replace(' ', 'T'));
            var end = run.finished_at ? moment.utc(String(run.finished_at).replace(' ', 'T')) : moment.utc();
            var mins = Math.max(0, Math.round(end.diff(start, 'minutes', true)));
            if (mins < 1) { return '<1 min'; }
            if (mins < 60) { return mins + ' min'; }
            return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
        };

        function toastFail(title, data) {
            if (data && (data.status === 403 || data.error === 'FORBIDDEN')) { vm.forbidden = true; return; }
            ToastService.error(title, (data && data.message) || 'Something went wrong. Please try again.');
        }

        // Pending-advisories count for the nav badge (fed by status on every screen)
        vm.pending_advisories = 0;

        // ── Run presentation helpers ──────────────────────────────────────
        var PHASES = ['search', 'details', 'dereg'];
        vm.phaseSteps = [
            { key: 'search',  label: 'Scan register',  icon: 'fa-search' },
            { key: 'details', label: 'Fetch details',  icon: 'fa-database' },
            { key: 'dereg',   label: 'Reconcile',      icon: 'fa-check-double' }
        ];
        vm.phaseState = function(run, key) {
            if (!run) { return 'todo'; }
            if (run.state === 'done') { return 'done'; }
            var current = PHASES.indexOf(run.phase);
            var idx = PHASES.indexOf(key);
            if (idx < current) { return 'done'; }
            if (idx === current) { return run.state === 'running' ? 'active' : 'held'; }
            return 'todo';
        };
        // Search phase progress is knowable (prefix sweep AA…ZZ → 676 buckets);
        // details/dereg have no cheap total, so their bars shimmer indeterminate.
        vm.searchFraction = function(run) {
            if (!run || !run.cursor_prefix || !/^[A-Z]{2}$/i.test(run.cursor_prefix)) { return 0; }
            var p = run.cursor_prefix.toUpperCase();
            return ((p.charCodeAt(0) - 65) * 26 + (p.charCodeAt(1) - 65)) / 676;
        };
        vm.overallPercent = function(run) {
            if (!run) { return 0; }
            if (run.state === 'done') { return 100; }
            var current = Math.max(0, PHASES.indexOf(run.phase));
            var within = run.phase === 'search' ? vm.searchFraction(run) : 0.5;
            return Math.min(99, Math.round(((current + within) / 3) * 100));
        };
        vm.phaseCopy = function(run) {
            if (!run) { return ''; }
            switch (run.phase) {
                case 'search':  return 'Scanning the register — ' + (run.found_new || 0) + ' new aircraft found so far.';
                case 'details': return 'Fetching details — ' + (run.updated_ref || 0) + ' updated, ' + (run.advisories_raised || 0) + ' held for review.';
                case 'dereg':   return 'Reconciling — ' + (run.deregistered || 0) + ' no longer on the register (marked deregistered, not deleted).';
                default:        return '';
            }
        };
        vm.runActive = function(run) {
            return run && (run.state === 'staged' || run.state === 'running' || run.state === 'paused');
        };

        // Pop a counter when its value changes so the grid feels alive
        var COUNTER_KEYS = ['found_new', 'updated_ref', 'advisories_raised', 'deregistered', 'errors'];
        vm.bumped = {};
        function adoptRun(run) {
            if (!run) { return; }
            if (vm.run) {
                COUNTER_KEYS.forEach(function(k) {
                    if (run[k] !== vm.run[k]) {
                        vm.bumped[k] = true;
                        $timeout(function() { vm.bumped[k] = false; }, 500);
                    }
                });
            }
            vm.run = run;
            vm.pending_advisories = vm.status && vm.status.pending_advisories >= 0 ? vm.status.pending_advisories : vm.pending_advisories;
            if (!vm.runActive(run)) { stopPolling(); }
        }

        init();
        function init() {
            switch (vm.screen) {
                case 'sync':       initSync(); break;
                case 'advisories': initAdvisories(); break;
                case 'history':    initHistory(); break;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // SYNC — status cards + the run panel (start / pause / cancel / boost)
        // ══════════════════════════════════════════════════════════════════
        var pollTimer = null;
        var boostTimer = null;
        var processing = false;

        function initSync() {
            vm.loading = true;
            vm.show_advanced = false;
            vm.recaptcha_keys = '';
            vm.cancel_open = false;
            vm.boost = false;
            loadStatus(false);

            // Guard rail: never cache status — re-fetch on tab focus while a
            // run is active (the cron may have advanced it in the background).
            var onFocus = function() {
                if (vm.runActive(vm.run)) { $scope.$applyAsync(function() { loadStatus(true); }); }
            };
            $window.addEventListener('focus', onFocus);
            $scope.$on('$destroy', function() {
                $window.removeEventListener('focus', onFocus);
                stopPolling();
                stopBoost();
            });
        }

        function loadStatus(quiet) {
            AircraftRegistryService.Status().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { if (!quiet) { toastFail('Could not load the registry status', data); } return; }
                vm.status = data;
                vm.pending_advisories = data.pending_advisories || 0;
                if (data.active_run) {
                    adoptRun(data.active_run);
                    if (vm.runActive(data.active_run)) { startPolling(); }
                } else if (!vm.run || vm.runActive(vm.run)) {
                    // No active run server-side. Keep a just-finished run on
                    // screen (its summary + counters) until the admin dismisses
                    // it — only clear when we held nothing or a stale "active".
                    vm.run = null;
                    stopPolling();
                }
            });
        }
        vm.reload = function() { vm.run = null; loadStatus(false); };

        vm.stalenessDays = function() {
            return vm.status && vm.status.reference ? vm.status.reference.staleness_days : null;
        };
        vm.stalenessLevel = function() {
            var d = vm.stalenessDays();
            if (d === null || d === undefined) { return 'never'; }
            if (d > 60) { return 'stale'; }
            return 'fresh';
        };

        // ── Polling (read-only, every 3s while a run is live) ─────────────
        function startPolling() {
            if (pollTimer || !vm.run) { return; }
            pollTimer = $interval(function() {
                if (vm.boost) { return; }   // boost loop is already advancing + reporting
                AircraftRegistryService.GetRun(vm.run.id).then(function(data) {
                    if (data && data.success === false) { return; }
                    adoptRun(data.run || data);
                    if (!vm.runActive(vm.run)) { loadStatus(true); }
                });
            }, 3000);
        }
        function stopPolling() {
            if (pollTimer) { $interval.cancel(pollTimer); pollTimer = null; }
        }

        // ── Boost — advance a batch in the foreground every ~2.5s ─────────
        vm.toggleBoost = function() {
            vm.boost = !vm.boost;
            if (vm.boost) { runBoost(); } else { stopBoost(); }
        };
        function runBoost() {
            stopBoost();
            boostTimer = $interval(function() {
                if (processing || !vm.run || vm.run.state !== 'running') { return; }
                processing = true;
                AircraftRegistryService.ProcessRun(vm.run.id).then(function(data) {
                    processing = false;
                    if (data && data.success === false) { return; }
                    adoptRun(data.run || data);
                    if (!vm.runActive(vm.run)) {
                        vm.boost = false;
                        stopBoost();
                        loadStatus(true);
                    }
                });
            }, 2500);
        }
        function stopBoost() {
            if (boostTimer) { $interval.cancel(boostTimer); boostTimer = null; }
        }

        // ── Start / pause / resume / cancel ───────────────────────────────
        vm.startSync = function() {
            vm.starting = true;
            AircraftRegistryService.CreateRun(vm.recaptcha_keys).then(function(data) {
                if (data && data.success === false) {
                    // One is already staged/running/paused — adopt it instead
                    // of creating a second.
                    if (data.error === 'RUN_IN_PROGRESS' && data.run) {
                        vm.starting = false;
                        ToastService.warning('A sync is already in progress', 'Showing the existing run instead of starting a second one.');
                        adoptRun(data.run);
                        if (vm.runActive(data.run)) { startPolling(); }
                        return;
                    }
                    vm.starting = false;
                    toastFail('Could not create the sync', data);
                    return;
                }
                var run = data.run || data;
                AircraftRegistryService.StartRun(run.id).then(function(started) {
                    vm.starting = false;
                    if (started && started.success === false) { toastFail('Could not start the sync', started); return; }
                    ToastService.success('Sync started', "The register scan is underway — you can close this page and it'll finish in the background.");
                    adoptRun(started.run || started);
                    startPolling();
                });
            });
        };
        vm.pauseRun = function() {
            vm.pausing = true;
            AircraftRegistryService.PauseRun(vm.run.id).then(function(data) {
                vm.pausing = false;
                if (data && data.success === false) { toastFail('Could not pause the sync', data); return; }
                adoptRun(data.run || data);
                ToastService.success('Sync paused', 'Nothing more will be scraped until you resume.');
            });
        };
        vm.resumeRun = function() {
            vm.resuming = true;
            AircraftRegistryService.StartRun(vm.run.id).then(function(data) {
                vm.resuming = false;
                if (data && data.success === false) { toastFail('Could not resume the sync', data); return; }
                adoptRun(data.run || data);
                startPolling();
                ToastService.success('Sync resumed', 'Picking up right where it left off.');
            });
        };
        vm.cancelRun = function() {
            vm.cancelling = true;
            AircraftRegistryService.CancelRun(vm.run.id).then(function(data) {
                vm.cancelling = false;
                vm.cancel_open = false;
                if (data && data.success === false) { toastFail('Could not cancel the sync', data); return; }
                adoptRun(data.run || data);
                vm.boost = false;
                stopBoost();
                ToastService.success('Sync cancelled', 'Everything already applied is kept — reruns are idempotent.');
                loadStatus(true);
            });
        };

        // ══════════════════════════════════════════════════════════════════
        // ADVISORIES — held changes for club-assigned registrations
        // ══════════════════════════════════════════════════════════════════
        function initAdvisories() {
            vm.advisory_filter = 'pending';
            vm.advisories = [];
            loadAdvisories();
            // status feeds the nav badge
            AircraftRegistryService.Status().then(function(data) {
                if (data && data.success !== false) { vm.pending_advisories = data.pending_advisories || 0; }
            });
        }
        function loadAdvisories() {
            vm.loading = true;
            AircraftRegistryService.Advisories(vm.advisory_filter).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the advisories', data); return; }
                vm.advisories = (data && data.advisories) || [];
            });
        }
        vm.setAdvisoryFilter = function(f) {
            if (vm.advisory_filter === f) { return; }
            vm.advisory_filter = f;
            loadAdvisories();
        };
        vm.changeKeys = function(adv) {
            return adv && adv.changes ? Object.keys(adv.changes) : [];
        };
        function resolveAdvisory(adv, action, label) {
            adv.busy = action;
            var call = action === 'apply' ? AircraftRegistryService.ApplyAdvisory : AircraftRegistryService.DismissAdvisory;
            call(adv.id).then(function(data) {
                adv.busy = null;
                if (data && data.success === false) { toastFail('Could not ' + label.toLowerCase() + ' the change', data); return; }
                adv.leaving = true;   // slide-out animation, then drop from the list
                $timeout(function() {
                    vm.advisories = vm.advisories.filter(function(a) { return a.id !== adv.id; });
                    vm.pending_advisories = Math.max(0, vm.pending_advisories - 1);
                }, 380);
                ToastService.success(label, action === 'apply'
                    ? adv.registration + ' updated in the reference database. The club’s own aircraft record was not touched.'
                    : 'Kept our reference data for ' + adv.registration + '.');
            });
        }
        vm.applyAdvisory   = function(adv) { resolveAdvisory(adv, 'apply', 'Change applied'); };
        vm.dismissAdvisory = function(adv) { resolveAdvisory(adv, 'dismiss', 'Change dismissed'); };

        // ══════════════════════════════════════════════════════════════════
        // HISTORY — past runs, read-only
        // ══════════════════════════════════════════════════════════════════
        function initHistory() {
            vm.loading = true;
            AircraftRegistryService.Runs().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the run history', data); return; }
                vm.runs = (data && data.runs) || [];
            });
            AircraftRegistryService.Status().then(function(data) {
                if (data && data.success !== false) { vm.pending_advisories = data.pending_advisories || 0; }
            });
        }
    }
