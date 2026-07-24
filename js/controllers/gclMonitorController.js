// One controller serves every screen of the ToAviate-admin GoCardless monitor
// (webhook HEALTH only — the money screens live in the separate Platform
// Earnings section, platformEarningsController.js); the screen is chosen by
// the route's data.screen (same architecture as TrackerAdminController).
// Screens: overview, deliveries, events. Read-only feature.
//
// Access: ToAviate staff only — the backend is authoritative, this mirrors
// TrackerAdminController's client-side bounce.
app.controller('GclMonitorController', GclMonitorController);
    GclMonitorController.$inject = ['GclMonitorService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$location', '$interval'];
    function GclMonitorController(GclMonitorService, ToastService, $rootScope, $scope, $state, $stateParams, $location, $interval) {
        var vm = this;
        vm.user = $rootScope.globals.currentUser;
        vm.is_toaviate_staff = !!(vm.user && vm.user.email && /@toaviate\.com$/i.test(vm.user.email));
        if (!vm.is_toaviate_staff) {
            $location.path('/dashboard');
            return;
        }

        vm.screen = $state.current.data.screen;
        vm.enums  = GclMonitorService.enums;
        vm.sourceLabels = GclMonitorService.sourceLabels;
        vm.loading = false;

        // ── Sub-nav (shared partial views/manageclub/gcl_monitor/_nav.html) ──
        vm.nav = [
            { screen: 'overview',   state: 'dashboard.super_admin.gcl_monitor',            label: 'Overview',   icon: 'fa-heartbeat' },
            { screen: 'deliveries', state: 'dashboard.super_admin.gcl_monitor_deliveries', label: 'Deliveries', icon: 'fa-inbox' },
            { screen: 'events',     state: 'dashboard.super_admin.gcl_monitor_events',     label: 'Events',     icon: 'fa-exchange-alt' }
        ];
        vm.go = function(state, params) { $state.go(state, params || {}); };

        // ── Shared helpers ────────────────────────────────────────────────
        vm.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };
        vm.cur = function(code) {
            if (code === 'GBP' || !code) { return '£'; }
            if (code === 'EUR') { return '€'; }
            if (code === 'USD') { return '$'; }
            return code + ' ';
        };
        vm.num = function(v) { return parseFloat(v) || 0; };
        vm.statusBadge  = GclMonitorService.statusBadge;
        vm.outcomeBadge = function(o) { return GclMonitorService.badges.outcome[o] || 'trk-badge--grey'; };
        // Timestamps arrive as UTC — relative on screen, absolute local on hover
        vm.ago = function(ts) { return ts ? moment.utc(String(ts).replace(' ', 'T')).fromNow() : ''; };
        vm.abs = function(ts) { return ts ? moment.utc(String(ts).replace(' ', 'T')).local().format('ddd D MMM YYYY, HH:mm:ss') : ''; };

        // Delivery-outcome explainer tooltips (gate_rejected is the one that matters)
        vm.deliveryOutcomeHint = function(outcome) {
            var hints = {
                ok: 'Signature verified and every event handled.',
                invalid_signature: 'The webhook signature did not match our secret — GoCardless answered 498 and will retry.',
                no_secret: 'No webhook secret is configured for this endpoint, so nothing can be verified.',
                event_errors: 'The delivery was accepted but one or more events failed while processing.',
                gate_rejected: 'The request was refused before the webhook code ran (this is the failure mode that once went unnoticed — investigate immediately).'
            };
            return hints[outcome] || '';
        };

        function toastFail(title, data) {
            ToastService.error(title, (data && data.message) || 'Something went wrong. Please try again.');
        }

        init();
        function init() {
            switch (vm.screen) {
                case 'overview':   initOverview(); break;
                case 'deliveries': initDeliveries(); break;
                case 'events':     initEvents(); break;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // OVERVIEW — webhook health at a glance, auto-refreshed every 60s
        // ══════════════════════════════════════════════════════════════════
        function initOverview() {
            vm.loading = true;
            loadOverview(false);
            // Read-only screen, safe to keep fresh (per the guide: 60s)
            var refresh = $interval(function() { loadOverview(true); }, 60000);
            $scope.$on('$destroy', function() { $interval.cancel(refresh); });
        }
        function loadOverview(silent) {
            GclMonitorService.Overview().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) {
                    if (!silent) { toastFail('Could not load the GoCardless overview', data); }
                    return;
                }
                vm.overview = data;
                vm.health = ['club', 'tracker'].map(buildHealth);
                vm.attention_count = ((data.erroring_events || []).length) + ((data.recent_failed_deliveries || []).length);
            });
        }
        // One health card per webhook source: green if every delivery in the
        // last 30 days was 2xx, amber if any 4xx/5xx, grey if nothing arrived.
        function buildHealth(source) {
            var rows = (vm.overview.deliveries_by_status || []).filter(function(r) { return r.source === source; });
            var last = null;
            ((vm.overview.last_delivery) || []).forEach(function(r) { if (r.source === source) { last = r.last_at; } });
            var total = 0, failed = 0;
            rows.forEach(function(r) {
                total += (parseInt(r.deliveries, 10) || 0);
                if (r.http_status >= 400) { failed += (parseInt(r.deliveries, 10) || 0); }
            });
            var state, text;
            if (!total && !last) {
                state = 'never';
                text = 'Nothing received yet — check the webhook endpoint is configured in the GoCardless dashboard.';
            } else if (!total) {
                state = 'quiet';
                text = 'No deliveries in the last 30 days.';
            } else if (failed) {
                state = 'warn';
                text = failed + ' of ' + total + ' deliver' + (total === 1 ? 'y' : 'ies') + ' in the last 30 days failed.';
            } else {
                state = 'ok';
                text = 'All ' + total + ' deliver' + (total === 1 ? 'y' : 'ies') + ' in the last 30 days succeeded.';
            }
            return {
                source: source,
                label: vm.sourceLabels[source],
                state: state,
                text: text,
                last_at: last,
                statuses: rows.sort(function(a, b) { return a.http_status - b.http_status; })
            };
        }
        // Chip deep-links: Overview → pre-filtered Deliveries / Events tabs
        vm.openDeliveries = function(source, status) {
            $state.go('dashboard.super_admin.gcl_monitor_deliveries', { source: source || null, status: status || null });
        };
        vm.openEvents = function(source, outcome) {
            $state.go('dashboard.super_admin.gcl_monitor_events', { source: source, outcome: outcome || null });
        };
        vm.openFailedDelivery = function(d) {
            $state.go('dashboard.super_admin.gcl_monitor_deliveries', { open: d.id });
        };
        vm.outcomeCount = function(source, outcome) {
            var rows = ((vm.overview || {}).events_by_outcome || {})[source] || [];
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].outcome === outcome) { return rows[i]; }
            }
            return null;
        };

        // ══════════════════════════════════════════════════════════════════
        // DELIVERIES — every HTTP POST GoCardless made to us
        // ══════════════════════════════════════════════════════════════════
        function initDeliveries() {
            vm.sourceFilter = $stateParams.source || '';
            vm.statusFilter = $stateParams.status || '';
            vm.page = 1;
            vm.deliveries = [];
            vm.total = null;
            loadDeliveries(true);
            // ?open= deep-link from the Overview "needs attention" panel —
            // pin that delivery's full detail above the table.
            if ($stateParams.open) {
                vm.pinned_loading = true;
                GclMonitorService.GetDelivery($stateParams.open).then(function(data) {
                    vm.pinned_loading = false;
                    if (data && data.success === false) { toastFail('Could not load the delivery', data); return; }
                    // Wrapped as { detail } so _delivery_detail.html can serve
                    // both this pinned card and the in-table drawers.
                    vm.pinned_row = { detail: data.delivery || data };
                });
            }
        }
        function loadDeliveries(reset) {
            vm.loading = true;
            GclMonitorService.Deliveries({ source: vm.sourceFilter, status: vm.statusFilter, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load deliveries', data); return; }
                var rows = (data && data.deliveries) || [];
                vm.deliveries = reset ? rows : vm.deliveries.concat(rows);
                if (data && data.total !== undefined) { vm.total = parseInt(data.total, 10); }
                vm.has_more = (vm.total !== null) ? (vm.deliveries.length < vm.total) : (rows.length > 0);
            });
        }
        vm.setSource = function(source) { vm.sourceFilter = source; vm.page = 1; loadDeliveries(true); };
        vm.setStatus = function(status) { vm.statusFilter = status; vm.page = 1; loadDeliveries(true); };
        vm.loadMoreDeliveries = function() { vm.page++; loadDeliveries(false); };
        // Row click → expandable detail drawer (fetches the stored body)
        vm.toggleDelivery = function(d) {
            d.open = !d.open;
            if (d.open && !d.detail && !d.detail_loading) {
                d.detail_loading = true;
                GclMonitorService.GetDelivery(d.id).then(function(data) {
                    d.detail_loading = false;
                    if (data && data.success === false) { toastFail('Could not load the delivery detail', data); return; }
                    d.detail = data.delivery || data;
                });
            }
        };
        vm.prettyJson = function(body) {
            if (!body) { return ''; }
            if (typeof body === 'string') {
                try { return JSON.stringify(JSON.parse(body), null, 2); } catch (e) { return body; }
            }
            return JSON.stringify(body, null, 2);
        };
        vm.copyPayload = function(body, $event) {
            if ($event) { $event.stopPropagation(); }
            var text = vm.prettyJson(body);
            copyText(text);
        };
        function copyText(text) {
            var done = function() { ToastService.success('Copied', 'The payload is on your clipboard.'); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, function() { legacyCopy(text); done(); });
            } else {
                legacyCopy(text);
                done();
            }
        }
        function legacyCopy(text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
        }

        // ══════════════════════════════════════════════════════════════════
        // EVENTS — per-event processing log (club / tracker shapes differ)
        // ══════════════════════════════════════════════════════════════════
        function initEvents() {
            vm.eventSource = $stateParams.source === 'tracker' ? 'tracker' : 'club';
            vm.outcomeFilter = $stateParams.outcome || '';
            vm.page = 1;
            vm.events = [];
            vm.total = null;
            loadEvents(true);
        }
        function loadEvents(reset) {
            vm.loading = true;
            GclMonitorService.Events({ source: vm.eventSource, outcome: vm.outcomeFilter, page: vm.page }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load events', data); return; }
                var rows = (data && data.events) || [];
                vm.events = reset ? rows : vm.events.concat(rows);
                if (data && data.total !== undefined) { vm.total = parseInt(data.total, 10); }
                vm.has_more = (vm.total !== null) ? (vm.events.length < vm.total) : (rows.length > 0);
            });
        }
        vm.setEventSource = function(source) {
            vm.eventSource = source;
            vm.page = 1;
            loadEvents(true);
        };
        vm.setOutcome = function(outcome) { vm.outcomeFilter = outcome; vm.page = 1; loadEvents(true); };
        vm.loadMoreEvents = function() { vm.page++; loadEvents(false); };
    }
