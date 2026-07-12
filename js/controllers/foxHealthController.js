// ─────────────────────────────────────────────────────
// Fox tracker health & unmatched flights (ToAviate management).
//   FoxTrackerHealthController — registry vs transmitted identity board,
//     one-tap "fix identity" (adopt transmitted ccid + backfill), unknown
//     devices → register.
//   FoxUnmatchedController — flights with no tech-log sheet, one-click
//     matching against the pre-computed candidate or a manual aircraft.
// Contract: FRONTEND_FOX_UNMATCHED_FLIGHTS_GUIDE.md.
// ─────────────────────────────────────────────────────

app.controller('FoxTrackerHealthController', FoxTrackerHealthController);

    FoxTrackerHealthController.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$interval', '$timeout', '$window', 'FoxTrackerService', 'ToastService'];
    function FoxTrackerHealthController($rootScope, $scope, $state, $stateParams, $interval, $timeout, $window, FoxTrackerService, ToastService) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.authorised = $rootScope.isToAviateStaff();
        if (!vm.authorised) return;

        vm.loading = true;
        vm.trackers = [];
        vm.unknown_devices = [];
        vm.summary = { mismatches: 0, never_seen: 0, unknown: 0, unmatched: 0 };
        vm.fix = null;   // fix-identity dialog state

        // ?tracker= from the CCID-mismatch alert emails — highlight + scroll.
        var spot_tracker = parseInt($stateParams.tracker, 10) || null;
        var spotted = false;
        function spotTracker() {
            if (!spot_tracker || spotted) { return; }
            vm.trackers.forEach(function(t) {
                if (t.tracker_id == spot_tracker || t.id == spot_tracker) {
                    t._spot = true;
                    spotted = true;
                }
            });
            if (spotted) {
                $timeout(function() {
                    var el = document.getElementById('fxh-tracker-' + spot_tracker);
                    if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center' }); }
                }, 350);
            }
        }

        vm.load = function(quiet) {
            if (!quiet) { vm.loading = true; }
            FoxTrackerService.GetHealth().then(function(data) {
                vm.loading = false;
                if (!data.success) {
                    if (!quiet) { ToastService.error('Load Failed', data.message); }
                    return;
                }
                var trackers = data.trackers || [];
                // Mismatches to the top, never-seen (muted) to the bottom.
                trackers.sort(function(a, b) { return rank(a) - rank(b); });
                vm.trackers = trackers;
                vm.unknown_devices = data.unknown_devices || [];
                vm.summary = {
                    mismatches: trackers.filter(function(t) { return t.ccid_mismatch; }).length,
                    never_seen: trackers.filter(function(t) { return t.never_seen; }).length,
                    unknown: vm.unknown_devices.length,
                    unmatched: trackers.reduce(function(sum, t) { return sum + (parseInt(t.unmatched_entries, 10) || 0); }, 0)
                };
                spotTracker();
            });
        };

        function rank(t) {
            if (t.ccid_mismatch) return 0;
            if (t.never_seen) return 2;
            return 1;
        }

        vm.load();

        // Health data is cheap — poll every 60 s while the board is visible,
        // and refetch when the tab regains focus.
        var poll = $interval(function() { vm.load(true); }, 60000);
        function onFocus() { $scope.$applyAsync(function() { vm.load(true); }); }
        $window.addEventListener('focus', onFocus);
        $scope.$on('$destroy', function() {
            $interval.cancel(poll);
            $window.removeEventListener('focus', onFocus);
        });

        // ── Fix identity ──
        vm.openFix = function(tracker) {
            vm.fix = {
                tracker: tracker,
                reason: '',
                advanced: false,
                manual_imei: tracker.imei,
                manual_ccid: tracker.stored_ccid,
                allow_mismatch: false,
                conflict: null,      // transmitted_ccid from a ccid_mismatch refusal
                error: null,
                busy: false
            };
        };

        vm.closeFix = function() { vm.fix = null; };

        vm.fixUseTransmitted = function() {
            if (!vm.fix || !vm.fix.conflict) { return; }
            vm.fix.manual_ccid = vm.fix.conflict;
            vm.fix.conflict = null;
            vm.fix.allow_mismatch = false;
        };

        vm.confirmFix = function() {
            var fix = vm.fix;
            if (!fix || fix.busy) { return; }
            var tracker = fix.tracker;

            var body;
            if (fix.advanced) {
                body = { reason: fix.reason || '' };
                if (fix.manual_imei && fix.manual_imei !== tracker.imei) { body.imei = fix.manual_imei; }
                if (fix.manual_ccid && fix.manual_ccid !== tracker.stored_ccid) { body.ccid = fix.manual_ccid; }
                if (fix.allow_mismatch) { body.allow_ccid_mismatch = true; }
                if (!body.imei && !body.ccid) {
                    fix.error = 'No identity change — edit the IMEI or CCID, or use "Adopt transmitted".';
                    return;
                }
            } else {
                body = { adopt_transmitted: true, reason: fix.reason || '' };
            }

            fix.busy = true;
            fix.error = null;
            fix.conflict = null;
            FoxTrackerService.CorrectIdentity(tracker.id || tracker.tracker_id, body).then(function(data) {
                fix.busy = false;
                if (data.success) {
                    var reg = tracker.registration || 'the aircraft';
                    var backfilled = data.pls_regenerated || 0;
                    ToastService.success('Identity Corrected',
                        backfilled > 0
                            ? backfilled + ' dropped flight(s) added to ' + reg + '\'s tech log.'
                            : 'Registry now matches what the device transmits.');
                    vm.fix = null;
                    vm.load(true);
                    // Green pulse on the healed row once the refetch lands.
                    $timeout(function() {
                        for (var i = 0; i < vm.trackers.length; i++) {
                            if (vm.trackers[i].tracker_id === tracker.tracker_id) { vm.trackers[i]._fixed = true; }
                        }
                    }, 600);
                } else if (data.reason === 'ccid_mismatch') {
                    fix.conflict = data.transmitted_ccid;
                    fix.error = data.message;
                } else {
                    fix.error = data.message || 'The identity could not be corrected.';
                }
            });
        };

        // ── Unknown devices → register (pre-filled create form) ──
        vm.registerUnknown = function(device) {
            $state.go('dashboard.super_admin.fox_tracker_add', { imei: device.imei, ccid: device.ccid });
        };

        vm.openUnmatched = function(tracker) {
            $state.go('dashboard.super_admin.fox_unmatched', { imei: tracker.imei });
        };

        // ── Display helpers ──
        vm.ago = function(ts) {
            if (!ts) { return 'never'; }
            return moment(String(ts).replace(' ', 'T')).fromNow();
        };

        vm.copy = function(text) {
            if (!text) { return; }
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text);
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                ToastService.success('Copied', text);
            } catch (e) {}
        };
    }


app.controller('FoxUnmatchedController', FoxUnmatchedController);

    FoxUnmatchedController.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$timeout', 'FoxTrackerService', 'PlaneService', 'ClubService', 'ToastService'];
    function FoxUnmatchedController($rootScope, $scope, $state, $stateParams, $timeout, FoxTrackerService, PlaneService, ClubService, ToastService) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.authorised = $rootScope.isToAviateStaff();
        if (!vm.authorised) return;

        vm.loading = true;
        vm.entries = [];
        vm.total = 0;
        vm.limit = 100;
        vm.clubs = [];
        vm.match = null;   // match dialog state

        // Deep-linkable filters (the health board's badge links pass ?imei=;
        // the admin alert emails pass ?entry= — that entry gets highlighted).
        vm.filters = {
            club_id: $stateParams.club_id || '',
            imei: $stateParams.imei || '',
            from: null,
            to: null
        };
        vm.spot_entry = parseInt($stateParams.entry, 10) || null;
        vm.spot_note = null;   // "already matched" fallback when it's gone

        // ── Reason taxonomy (BACKEND_FOX_UNMATCHED_FLIGHTS_GUIDE.md §2.2) ──
        // ~80% of the backlog is duplicates + blips; the default view hides
        // those so only the rows needing a human remain.
        var REASONS = {
            likely_duplicate: { label: 'already logged',      cls: 'blue',  icon: 'fa-copy',                 noise: true,  health: false },
            spurious_wakeup:  { label: 'not a flight',        cls: 'grey',  icon: 'fa-bolt',                 noise: true,  health: false },
            unknown_device:   { label: 'unknown device',      cls: 'amber', icon: 'fa-question-circle',     noise: false, health: true },
            ccid_mismatch:    { label: 'tracker CCID wrong',  cls: 'red',   icon: 'fa-broadcast-tower',     noise: false, health: true },
            before_assignment:{ label: 'pre-installation',    cls: 'grey',  icon: 'fa-history',             noise: false, health: false },
            not_assigned:     { label: 'never assigned',      cls: 'amber', icon: 'fa-unlink',              noise: false, health: true },
            unusable_times:   { label: 'corrupt times',       cls: 'red',   icon: 'fa-clock',               noise: false, health: false },
            pipeline_failure: { label: 'safe to match',       cls: 'green', icon: 'fa-check-circle',        noise: false, health: false }
        };
        var UNKNOWN_REASON = { label: 'unclassified', cls: 'grey', icon: 'fa-circle', noise: false, health: false };

        vm.reasonMeta = function(entry) {
            return REASONS[entry.reason] || UNKNOWN_REASON;
        };

        // Duplicates would be refused by the backend — de-emphasise Match.
        vm.matchDiscouraged = function(entry) {
            return entry.reason === 'likely_duplicate' || entry.reason === 'spurious_wakeup';
        };

        vm.hide_noise = true;    // default ON: hide already-logged + non-flights
        vm.reason_filter = '';   // one reason code, from the summary chips
        vm.reason_counts = [];   // [{reason, meta, count}] over the FETCHED set

        // Picking a reason chip shows those rows even when they're "noise".
        vm.setReasonFilter = function(reason) {
            vm.reason_filter = (vm.reason_filter === reason) ? '' : reason;
        };

        vm.entryVisible = function(entry) {
            if (vm.reason_filter) { return entry.reason === vm.reason_filter; }
            if (vm.hide_noise && vm.reasonMeta(entry).noise) { return false; }
            return true;
        };

        vm.visibleCount = function() {
            return vm.entries.filter(vm.entryVisible).length;
        };

        function buildReasonCounts() {
            var counts = {};
            vm.entries.forEach(function(entry) {
                var key = entry.reason || '_none';
                counts[key] = (counts[key] || 0) + 1;
            });
            vm.reason_counts = Object.keys(counts).map(function(key) {
                return { reason: key, meta: REASONS[key] || UNKNOWN_REASON, count: counts[key] };
            }).sort(function(a, b) { return b.count - a.count; });
        }

        // The duplicate's reason_detail names the existing sheet — pull the id
        // out so the chip can deep-link to the read-only flight detail page.
        vm.duplicateSheetId = function(entry) {
            if (entry.reason !== 'likely_duplicate' || !entry.reason_detail) { return null; }
            var match = String(entry.reason_detail).match(/sheet\s*#?\s*(\d+)|#(\d+)/i);
            return match ? parseInt(match[1] || match[2], 10) : null;
        };

        vm.openSheet = function(sheet_id) {
            if (sheet_id) { $state.go('dashboard.flight_replay', { flight_id: sheet_id }); }
        };

        vm.toggleDetail = function(entry) { entry._showDetail = !entry._showDetail; };

        ClubService.GetAll().then(function(data) {
            vm.clubs = (data && (data.clubs || data.items)) || (angular.isArray(data) ? data : []);
        });

        vm.load = function() {
            vm.loading = true;
            var params = {
                club_id: vm.filters.club_id || null,
                imei: (vm.filters.imei || '').trim() || null,
                from: vm.filters.from ? moment(vm.filters.from).format('YYYY-MM-DD') : null,
                to: vm.filters.to ? moment(vm.filters.to).format('YYYY-MM-DD') : null,
                // Hunting one entry from an email link: fetch the deepest page
                // so it's actually in the set.
                limit: vm.spot_entry ? 500 : null
            };
            FoxTrackerService.GetUnmatched(params).then(function(data) {
                vm.loading = false;
                if (!data.success) {
                    ToastService.error('Load Failed', data.message);
                    return;
                }
                vm.entries = data.entries || [];
                vm.total = data.total || vm.entries.length;
                vm.limit = data.limit || 100;
                buildReasonCounts();
                spotEntry();
            });
        };

        // ?entry= from the admin alert emails: highlight + scroll to the row
        // (un-hiding it if the noise filter would swallow it); if it's no
        // longer unmatched, say so instead of showing nothing.
        function spotEntry() {
            vm.spot_note = null;
            if (!vm.spot_entry) { return; }
            var found = null;
            vm.entries.forEach(function(entry) { if (entry.id == vm.spot_entry) { found = entry; } });
            if (!found) {
                vm.spot_note = 'ENTRY #' + vm.spot_entry + ' is not on the unmatched list — it has most likely already been matched into a tech log.';
                return;
            }
            found._spot = true;
            found._showFlight = true;   // the email recipient wants the full picture
            if (vm.hide_noise && vm.reasonMeta(found).noise && !vm.reason_filter) { vm.hide_noise = false; }
            $timeout(function() {
                var el = document.getElementById('fxu-entry-' + found.id);
                if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center' }); }
            }, 350);
        }

        vm.load();

        vm.clearFilters = function() {
            vm.filters = { club_id: '', imei: '', from: null, to: null };
            vm.load();
        };

        // ── Row display helpers ──
        vm.duration = function(seconds) {
            seconds = parseInt(seconds, 10) || 0;
            var h = Math.floor(seconds / 3600);
            var m = Math.round((seconds % 3600) / 60);
            if (h > 0) { return h + ' h ' + m + ' m'; }
            return m + ' m';
        };

        // "2026-07-08 14:02 → 15:44" when same-day, both full stamps otherwise.
        // Server-local datetimes — displayed as-is, never timezone-shifted.
        vm.times = function(entry) {
            var off = String(entry.brakes_off || '');
            var on = String(entry.brakes_on || '');
            if (!off) { return '—'; }
            if (on && off.slice(0, 10) === on.slice(0, 10)) {
                return off.slice(0, 16) + ' → ' + on.slice(11, 16);
            }
            return off.slice(0, 16) + (on ? ' → ' + on.slice(0, 16) : '');
        };

        vm.toHealth = function() {
            $state.go('dashboard.super_admin.fox_tracker_health');
        };

        // ── Flight details panel (per row, auto-open on the spotted entry) ──
        // Renders everything the payload carries; takeoff/landing times and
        // airfield names light up when the backend joins them (until then the
        // cells show what exists — ids for airfields, dashes for the rest).
        vm.toggleFlight = function(entry) { entry._showFlight = !entry._showFlight; };

        vm.flightDate = function(entry) {
            var off = String(entry.brakes_off || '');
            if (!off) { return '—'; }
            var m = moment(off.replace(' ', 'T'));
            return m.isValid() ? m.format('ddd D MMM YYYY') : off.slice(0, 10);
        };

        vm.timeOf = function(ts) {
            if (!ts) { return '—'; }
            var s = String(ts);
            return s.length >= 16 ? s.slice(11, 16) : s;
        };

        // Block (brakes) time = brakes_on − brakes_off; server-local stamps.
        vm.blockTime = function(entry) {
            if (!entry.brakes_off || !entry.brakes_on) { return '—'; }
            var off = moment(String(entry.brakes_off).replace(' ', 'T'));
            var on = moment(String(entry.brakes_on).replace(' ', 'T'));
            if (!off.isValid() || !on.isValid() || on.isBefore(off)) { return '—'; }
            return vm.duration(on.diff(off, 'seconds'));
        };

        // Prefer joined names/ICAO (start_airfield / start_airfield_icao …);
        // fall back to the raw id; '—' when the device reported nothing.
        vm.airfieldLabel = function(entry, which) {
            var name = entry[which + '_airfield'] || entry[which + '_airfield_name'];
            var icao = entry[which + '_airfield_icao'];
            if (name) { return name + (icao ? ' (' + icao + ')' : ''); }
            if (icao) { return icao; }
            var id = entry[which + '_airfield_id'];
            return id ? 'airfield #' + id : '—';
        };

        vm.copy = function(text) {
            if (!text) { return; }
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text);
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                ToastService.success('Copied', text);
            } catch (e) {}
        };

        // ── Match dialog ──
        vm.openMatch = function(entry) {
            vm.match = {
                entry: entry,
                use_suggestion: !!entry.suggested_plane_id,
                picking: !entry.suggested_plane_id,   // manual aircraft picker open
                club_id: entry.suggested_club_id || vm.filters.club_id || '',
                plane_id: null,
                planes: [],
                planes_loading: false,
                error: null,
                busy: false
            };
            if (vm.match.picking && vm.match.club_id) { vm.matchClubChanged(); }
        };

        vm.closeMatch = function() { vm.match = null; };

        vm.matchPickManually = function() {
            vm.match.picking = true;
            vm.match.use_suggestion = false;
            if (vm.match.club_id) { vm.matchClubChanged(); }
        };

        // Club follows the plane list — pick a club, then its aircraft.
        vm.matchClubChanged = function() {
            var m = vm.match;
            if (!m || !m.club_id) { m.planes = []; m.plane_id = null; return; }
            m.planes_loading = true;
            m.plane_id = null;
            PlaneService.GetAllByClub(m.club_id).then(function(data) {
                m.planes_loading = false;
                m.planes = (data && (data.items || data.planes)) || (angular.isArray(data) ? data : []);
            });
        };

        vm.confirmMatch = function() {
            var m = vm.match;
            if (!m || m.busy) { return; }
            var body = {};
            if (!m.use_suggestion) {
                if (!m.plane_id) {
                    m.error = 'Pick the aircraft this flight belongs to.';
                    return;
                }
                body.plane_id = m.plane_id;
                body.club_id = m.club_id;
            }
            m.busy = true;
            m.error = null;
            FoxTrackerService.MatchEntry(m.entry.id, body).then(function(data) {
                m.busy = false;
                if (data.success) {
                    ToastService.success('Flight Matched', 'ENTRY #' + m.entry.id + ' → tech log sheet #' + data.plane_log_sheet_id + '.');
                    var entry = m.entry;
                    vm.match = null;
                    // Collapse the row out, then drop it and decrement the total.
                    entry._matched = true;
                    $timeout(function() {
                        var idx = vm.entries.indexOf(entry);
                        if (idx > -1) { vm.entries.splice(idx, 1); }
                        vm.total = Math.max(0, vm.total - 1);
                    }, 450);
                } else {
                    // Duplicate / unusable-times / already-matched — the backend
                    // message is self-explanatory; show it verbatim in the dialog.
                    m.error = data.message || 'The flight could not be matched.';
                }
            });
        };
    }
