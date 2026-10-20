app.controller('DashboardTrackerPlaneController', DashboardTrackerPlaneController);

DashboardTrackerPlaneController.$inject = [
    '$rootScope', '$scope', '$state', '$stateParams', 'TrackerPlaneService', 'PlaneService', 'ToastService', '$timeout', 'TrackerHealthService', 'ClubService'
];

function DashboardTrackerPlaneController($rootScope, $scope, $state, $stateParams, TrackerPlaneService, PlaneService, ToastService, $timeout, TrackerHealthService, ClubService) {

    var vm = this;

    // ── Device health (keyed off tracker.last_seen) ── shared with the Fox
    // Trackers list via TrackerHealthService. The by_club endpoint this page uses
    // returns last_seen on each tracker; helpers accept a tracker object.
    vm.healthState      = TrackerHealthService.state;
    vm.healthBadgeClass = TrackerHealthService.badgeClass;
    vm.healthLabel      = TrackerHealthService.label;
    vm.lastSeenHuman    = TrackerHealthService.lastSeenHuman;
    vm.tsLocal          = TrackerHealthService.tsLocal;

    // ── Auth gate — ToAviate platform staff ──
    // This tool lives in the ToAviate Admin hub, so it uses the same gate as the
    // tab (shared $rootScope.isToAviateStaff helper) rather than the per-club
    // manager check. vm.is_manager is kept as the view's allow/deny flag name.
    vm.user = $rootScope.globals.currentUser;
    vm.is_manager = $rootScope.isToAviateStaff();
    if (!vm.is_manager) return;

    // ── Club scope ──
    // A ToAviate admin isn't tied to one club, so the fleet list carries its
    // own club picker (persisted across visits). Priority: the club explicitly
    // handed over in the URL (detail links from the fleet list / device
    // registry) → last club picked here → the admin's selected admin club.
    var CLUB_STORE_KEY = 'toaviate_tracker_fleet_club';
    var storedClub = parseInt(localStorage.getItem(CLUB_STORE_KEY), 10);
    vm.club_id = parseInt($stateParams.club_id, 10)
        || (!isNaN(storedClub) ? storedClub : null)
        || (vm.user.current_club_admin ? vm.user.current_club_admin.id : null);
    vm.clubs = [];

    // ── Action routing ──
    vm.action = $state.current.data ? $state.current.data.action : 'list';

    // ── Data ──
    vm.trackers = [];
    vm.planes = [];
    vm.loading = false;
    vm.search_text = '';
    vm.filter_tracked = ''; // '' | 'tracked' | 'untracked'

    // ── Per-plane detail ──
    vm.plane = null;
    vm.current_tracker = null;
    vm.assignment_history = [];
    vm.change_log = [];
    vm.plane_id = $stateParams.plane_id ? parseInt($stateParams.plane_id) : null;

    // ── Dialog state ──
    vm.dialog = null; // 'assign' | 'swap' | 'unassign'
    vm.dialog_busy = false;
    vm.available_trackers = [];
    vm.available_loading = false;

    // ── Assign form ──
    vm.assign_data = {
        tracker: null,
        assigned_from_date: null,
        assigned_from_time: '12:00',
        notes: ''
    };

    // ── Swap form ──
    vm.swap_data = {
        new_tracker: null,
        effective_at_date: null,
        effective_at_time: '12:00',
        notes: ''
    };

    // ── Unassign form ──
    vm.unassign_data = {
        unassigned_at_date: null,
        unassigned_at_time: '12:00',
        notes: ''
    };

    // ── Swap result ──
    vm.swap_result = null;

    // ── Assign result ──
    // Only populated when a back-dated assign actually claimed something —
    // a plain "installed today" assign has nothing to report and stays a toast.
    vm.assign_result = null;

    // ── Unassign result ──
    vm.unassign_result = null;

    // Guards against a slow response for club A landing after the admin has
    // already switched the picker to club B. MUST be initialised before the
    // init block below calls loadFleetSummary().
    var fleet_load_token = 0;

    // ── Init ──
    if (vm.action === 'list') {
        vm.loading = true;
        loadClubs();
        if (vm.club_id) loadFleetSummary();
    } else if (vm.action === 'detail') {
        loadPlaneDetail();
    }

    // ═══════════════════════════════════════════
    // CLUB PICKER
    // ═══════════════════════════════════════════

    function loadClubs() {
        ClubService.GetAll().then(function(data) {
            vm.clubs = (data && (data.clubs || data.items)) || (angular.isArray(data) ? data : []);
            // Club ids can arrive as strings — re-point vm.club_id at the
            // list's own value so the <select> matches it, and fall back to
            // the first club when the remembered one no longer exists (or
            // nothing resolved a club at all).
            var match = null;
            for (var i = 0; i < vm.clubs.length; i++) {
                if (parseInt(vm.clubs[i].id, 10) === parseInt(vm.club_id, 10)) { match = vm.clubs[i]; break; }
            }
            if (match) {
                vm.club_id = match.id;
            } else if (vm.clubs.length > 0) {
                vm.club_id = vm.clubs[0].id;
                loadFleetSummary();
            } else if (!vm.club_id) {
                vm.loading = false;
            }
        });
    }

    vm.changeClub = function() {
        if (!vm.club_id) return;
        try { localStorage.setItem(CLUB_STORE_KEY, String(vm.club_id)); } catch (e) {}
        loadFleetSummary();
    };

    // ═══════════════════════════════════════════
    // FLEET SUMMARY (LIST)
    // ═══════════════════════════════════════════

    function loadFleetSummary() {
        var token = ++fleet_load_token;
        vm.loading = true;
        var planesLoaded = false;
        var trackersLoaded = false;

        function checkReady() {
            if (planesLoaded && trackersLoaded) vm.loading = false;
        }

        // Load all planes for the club
        PlaneService.GetAllByClub(vm.club_id).then(function(data) {
            if (token !== fleet_load_token) return;
            vm.planes = data || [];
            planesLoaded = true;
            checkReady();
        });

        // Load all tracker assignments for the club
        TrackerPlaneService.GetByClub(vm.club_id).then(function(data) {
            if (token !== fleet_load_token) return;
            if (data.success) {
                vm.trackers = data.trackers || [];
            } else {
                vm.trackers = [];
            }
            // MUST follow every assignment to vm.trackers — the card lookup
            // reads the index, not the array.
            indexTrackers();
            trackersLoaded = true;
            checkReady();
        });
    }

    // plane_id → tracker, rebuilt whenever the tracker list changes.
    // The card template calls getTrackerForPlane several times per plane and
    // ng-repeat re-evaluates every digest, so a linear scan per call was
    // O(planes × trackers × calls) on every frame. The map makes it a lookup.
    var trackerByPlaneId = {};

    function indexTrackers() {
        trackerByPlaneId = {};
        for (var i = 0; i < vm.trackers.length; i++) {
            var t = vm.trackers[i];
            if (t.current_plane_id !== null && t.current_plane_id !== undefined) {
                trackerByPlaneId[String(t.current_plane_id)] = t;
            }
        }
    }
    vm.indexTrackers = indexTrackers;

    vm.getTrackerForPlane = function(plane) {
        if (!plane) { return null; }
        return trackerByPlaneId[String(plane.plane_id)] || null;
    };

    // ── Last flight ──
    // `last_seen` says when the TRACKER last reported; `last_flight` says when
    // the AIRCRAFT last actually flew. They diverge exactly when it matters:
    // a stale tracker on an aircraft that has been flying means the tracker
    // has failed, whereas a stale tracker on an aircraft that hasn't flown
    // for months is expected.
    //
    // CAVEAT: the by_club endpoint feeding this list returns last_seen but
    // NOT last_flight (by_plane, used by the detail page, does). So the row
    // is gated on the field actually being present — absent data must not
    // render as "no flight recorded", which claims something false about the
    // aircraft. If by_club starts returning it, the row appears by itself.
    vm.hasLastFlight = function(plane) {
        var t = vm.getTrackerForPlane(plane);
        return !!(t && t.last_flight);
    };

    // Full local timestamp incl. time — used for the tooltip.
    vm.lastFlightLocal = function(plane) {
        var t = vm.getTrackerForPlane(plane);
        return (t && t.last_flight) ? TrackerHealthService.tsLocal(t.last_flight) : 'Never';
    };

    // Date only, for the card line. tsLocal() gives 'DD MMM YYYY HH:mm' —
    // trim the time so the card stays scannable, matching the plain date the
    // "Since <assigned>" line above it already shows.
    vm.lastFlightDate = function(plane) {
        var full = vm.lastFlightLocal(plane);
        if (!full || full === 'Never' || full === '—') { return full; }
        return full.replace(/\s\d{2}:\d{2}$/, '');
    };

    // Relative form ("3 months ago") for the at-a-glance line; returns null
    // when there is no timestamp so the template can omit the row entirely
    // rather than print a dash.
    //
    // lastSeenHuman() takes a raw timestamp as well as a tracker object, so
    // this reuses the service's UTC parsing rather than repeating it here —
    // one place decides how these timestamps are read.
    vm.lastFlightHuman = function(plane) {
        var t = vm.getTrackerForPlane(plane);
        if (!t || !t.last_flight) { return null; }
        var human = TrackerHealthService.lastSeenHuman(t.last_flight);
        return (human === '—') ? null : human;
    };

    vm.filteredPlanes = function() {
        var list = vm.planes;
        if (vm.filter_tracked === 'tracked') {
            list = list.filter(function(p) { return !!vm.getTrackerForPlane(p); });
        } else if (vm.filter_tracked === 'untracked') {
            list = list.filter(function(p) { return !vm.getTrackerForPlane(p); });
        }
        if (!vm.search_text) return list;
        var q = vm.search_text.toLowerCase();
        return list.filter(function(p) {
            var tracker = vm.getTrackerForPlane(p);
            return (p.registration && p.registration.toLowerCase().indexOf(q) > -1) ||
                   (p.plane_type && p.plane_type.toLowerCase().indexOf(q) > -1) ||
                   (tracker && tracker.label && tracker.label.toLowerCase().indexOf(q) > -1) ||
                   (tracker && tracker.imei && tracker.imei.indexOf(q) > -1);
        });
    };

    vm.setTrackedFilter = function(value) {
        vm.filter_tracked = (vm.filter_tracked === value) ? '' : value;
    };

    vm.countWithTracker = function() {
        var count = 0;
        for (var i = 0; i < vm.planes.length; i++) {
            if (vm.getTrackerForPlane(vm.planes[i])) count++;
        }
        return count;
    };

    vm.openPlaneDetail = function(plane) {
        $state.go('dashboard.super_admin.tracker_plane_detail', { plane_id: plane.plane_id, club_id: vm.club_id });
    };

    // "Assign" shortcut on an untracked fleet card — lands on the plane's
    // detail page with the assign dialog already open.
    vm.openPlaneAssign = function(plane, $event) {
        if ($event) { $event.stopPropagation(); }
        $state.go('dashboard.super_admin.tracker_plane_detail', { plane_id: plane.plane_id, club_id: vm.club_id, assign: '1' });
    };

    // ═══════════════════════════════════════════
    // PLANE DETAIL
    // ═══════════════════════════════════════════

    // ?assign=1 (fleet card / registry shortcut) opens the assign dialog as
    // soon as we know the plane really has no tracker — first load only, not
    // on the reloads that follow an action.
    var auto_assign_pending = ($stateParams.assign === '1');

    function loadPlaneDetail() {
        vm.loading = true;
        var planeLoaded = false;
        var trackerLoaded = false;
        var logLoaded = false;

        function checkReady() {
            if (planeLoaded && trackerLoaded && logLoaded) {
                vm.loading = false;
                if (auto_assign_pending && !vm.current_tracker) {
                    auto_assign_pending = false;
                    vm.openAssign();
                }
            }
        }

        // Get plane info
        PlaneService.GetById(vm.plane_id, vm.club_id).then(function(data) {
            vm.plane = data || {};
            // The plane's own club is authoritative for the assign/swap
            // payloads — the URL/stored club is just how we got here.
            if (vm.plane.club_id) { vm.club_id = parseInt(vm.plane.club_id, 10); }
            planeLoaded = true;
            checkReady();
        });

        // Get tracker info + history
        TrackerPlaneService.GetByPlane(vm.plane_id).then(function(data) {
            if (data.success) {
                vm.current_tracker = data.current_tracker;
                vm.assignment_history = data.assignment_history || [];
            }
            trackerLoaded = true;
            checkReady();
        });

        // Get change log
        TrackerPlaneService.GetChangeLogByPlane(vm.plane_id).then(function(data) {
            if (data.success) {
                vm.change_log = (data.change_log || []).map(function(entry) {
                    if (entry.details && typeof entry.details === 'string') {
                        try { entry.parsed_details = JSON.parse(entry.details); }
                        catch(e) { entry.parsed_details = null; }
                    }
                    return entry;
                });
            }
            logLoaded = true;
            checkReady();
        });
    }

    // ═══════════════════════════════════════════
    // ASSIGN TRACKER
    // ═══════════════════════════════════════════

    vm.openAssign = function() {
        vm.dialog = 'assign';
        vm.assign_data = {
            tracker: null,
            // Date OBJECTS, not strings — Angular 1.4.7's input[date]/input[time]
            // throw ngModel:datefmt (and render blank) on a string model.
            // buildDatetime() handles both shapes.
            assigned_from_date: nowForInputs(),
            assigned_from_time: nowForInputs(),
            notes: ''
        };
        vm.assign_result = null;
        loadAvailableTrackers();
    };

    // True once the admin has typed an installation date earlier than today.
    // Drives the in-dialog heads-up that this is a backfill, not just a
    // paperwork date — the assign will pull the tracker's floating flights
    // from that date onto this aircraft.
    vm.assignIsBackdated = function() {
        var chosen = vm.assign_data ? vm.assign_data.assigned_from_date : null;
        if (!chosen) { return false; }
        var datePart = (chosen instanceof Date) ? formatDateForInput(chosen) : chosen;
        return datePart < formatDateForInput(new Date());
    };

    vm.submitAssign = function() {
        var checks = [
            { ok: vm.assign_data.tracker, field: 'assign_tracker_select', label: 'Tracker selection' },
            { ok: vm.assign_data.assigned_from_date, field: 'assign_date', label: 'Installation date' }
        ];
        if (!ToastService.validateForm(checks)) return;

        // A back-dated install rewrites history (claims flights, generates
        // tech log sheets), so it gets the same review step a swap has.
        // A "fitted today" assign has nothing to review and goes straight through.
        if (vm.assignIsBackdated()) {
            vm.dialog = 'assign_confirm';
            return;
        }
        vm.executeAssign();
    };

    vm.executeAssign = function() {
        var datetime = buildDatetime(vm.assign_data.assigned_from_date, vm.assign_data.assigned_from_time);

        vm.dialog_busy = true;
        TrackerPlaneService.Assign({
            tracker_id: vm.assign_data.tracker.id,
            plane_id: vm.plane_id,
            club_id: vm.club_id,
            assigned_from: datetime,
            notes: vm.assign_data.notes || null
        }).then(function(data) {
            vm.dialog_busy = false;
            if (data.success) {
                // A back-dated assign claims the tracker's floating flights in
                // the backfill window. That is a real data change the admin
                // needs to see, so it gets the same result dialog as a swap
                // rather than a toast that scrolls away. An assign that pulled
                // nothing in (the normal "fitted today" case) stays a toast.
                var result = TrackerPlaneService.NormalizeAssignResult(data);
                if (result.claimed_anything) {
                    vm.assign_result = result;
                    vm.dialog = 'assign_result';
                } else {
                    vm.dialog = null;
                    ToastService.success('Tracker Assigned', data.message);
                    loadPlaneDetail();
                }
            } else {
                ToastService.error('Assignment Failed', data.message);
            }
        });
    };

    vm.closeAssignResult = function() {
        vm.dialog = null;
        vm.assign_result = null;
        loadPlaneDetail();
    };

    // ═══════════════════════════════════════════
    // SWAP TRACKER
    // ═══════════════════════════════════════════

    vm.openSwap = function() {
        vm.dialog = 'swap';
        vm.swap_data = {
            new_tracker: null,
            effective_at_date: nowForInputs(),
            effective_at_time: nowForInputs(),
            notes: ''
        };
        vm.swap_result = null;
        loadAvailableTrackers();
    };

    vm.submitSwap = function() {
        var checks = [
            { ok: vm.swap_data.new_tracker, field: 'swap_tracker_select', label: 'New tracker selection' },
            { ok: vm.swap_data.effective_at_date, field: 'swap_date', label: 'Effective date' }
        ];
        if (!ToastService.validateForm(checks)) return;

        vm.dialog = 'swap_confirm';
    };

    vm.executeSwap = function() {
        var datetime = buildDatetime(vm.swap_data.effective_at_date, vm.swap_data.effective_at_time);

        vm.dialog_busy = true;
        TrackerPlaneService.Swap({
            plane_id: vm.plane_id,
            club_id: vm.club_id,
            old_tracker_id: vm.current_tracker.id,
            new_tracker_id: vm.swap_data.new_tracker.id,
            effective_at: datetime,
            notes: vm.swap_data.notes || null
        }).then(function(data) {
            vm.dialog_busy = false;
            if (data.success) {
                vm.swap_result = normalizeSwapResult(data);
                vm.dialog = 'swap_result';
            } else {
                ToastService.error('Swap Failed', data.message);
            }
        });
    };

    vm.closeSwapResult = function() {
        vm.dialog = null;
        vm.swap_result = null;
        loadPlaneDetail();
    };

    // ═══════════════════════════════════════════
    // UNASSIGN TRACKER
    // ═══════════════════════════════════════════

    vm.openUnassign = function() {
        vm.dialog = 'unassign';
        vm.unassign_data = {
            unassigned_at_date: nowForInputs(),
            unassigned_at_time: nowForInputs(),
            notes: ''
        };
    };

    vm.submitUnassign = function() {
        var checks = [
            { ok: vm.unassign_data.unassigned_at_date, field: 'unassign_date', label: 'Removal date' }
        ];
        if (!ToastService.validateForm(checks)) return;

        var datetime = buildDatetime(vm.unassign_data.unassigned_at_date, vm.unassign_data.unassigned_at_time);

        vm.dialog_busy = true;
        TrackerPlaneService.Unassign({
            tracker_id: vm.current_tracker.id,
            unassigned_at: datetime,
            notes: vm.unassign_data.notes || null
        }).then(function(data) {
            vm.dialog_busy = false;
            if (data.success) {
                // Removing a tracker floats entries and touches tech log
                // sheets — real data changes, so show them in a result dialog
                // like assign/swap do, not a toast that scrolls away.
                vm.unassign_result = {
                    tracker_label: vm.current_tracker.label || vm.current_tracker.imei,
                    entries_floated: toCount(data.fox_entries_floated),
                    log_sheets_affected: toCount(data.plane_log_sheets_affected)
                };
                vm.dialog = 'unassign_result';
            } else {
                ToastService.error('Unassign Failed', data.message);
            }
        });
    };

    vm.closeUnassignResult = function() {
        vm.dialog = null;
        vm.unassign_result = null;
        loadPlaneDetail();
    };

    // ═══════════════════════════════════════════
    // SHARED HELPERS
    // ═══════════════════════════════════════════

    function loadAvailableTrackers() {
        vm.available_loading = true;
        vm.available_trackers = [];
        TrackerPlaneService.GetUnassigned().then(function(data) {
            vm.available_loading = false;
            if (data.success) {
                vm.available_trackers = data.trackers || [];
            } else {
                ToastService.error('Load Failed', data.message || 'Could not load available trackers.');
            }
        });
    }

    vm.closeDialog = function() {
        vm.dialog = null;
        vm.dialog_busy = false;
    };

    vm.clearFieldError = function(event) {
        ToastService.clearFieldError(event);
    };

    vm.goBack = function() {
        if (vm.action === 'detail') {
            $state.go('dashboard.super_admin.tracker_planes');
        } else {
            $state.go('dashboard.super_admin');
        }
    };

    // ── Format helpers ──
    function nowForInputs() {
        var d = new Date();
        d.setSeconds(0, 0); // input[time] renders stray seconds/ms otherwise
        return d;
    }

    function formatDateForInput(d) {
        var y = d.getFullYear();
        var m = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return y + '-' + m + '-' + day;
    }

    function formatTimeForInput(d) {
        var h = ('0' + d.getHours()).slice(-2);
        var min = ('0' + d.getMinutes()).slice(-2);
        return h + ':' + min;
    }

    function buildDatetime(dateVal, timeVal) {
        var datePart, timePart;
        if (dateVal instanceof Date) {
            datePart = formatDateForInput(dateVal);
        } else {
            datePart = dateVal;
        }
        if (timeVal instanceof Date) {
            timePart = formatTimeForInput(timeVal);
        } else {
            timePart = timeVal || '12:00';
        }
        return datePart + ' ' + timePart + ':00';
    }

    function normalizeSwapResult(data) {
        var payload = angular.copy(data || {});
        var details = payload.results || {};

        payload.metrics = {
            entries_moved: details.new_entries_claimed !== undefined
                ? details.new_entries_claimed
                : (payload.fox_entries_moved || 0),
            entries_floated: details.old_entries_floated !== undefined
                ? details.old_entries_floated
                : (payload.fox_entries_floated || 0),
            log_sheets: details.old_pls_removed !== undefined
                ? details.old_pls_removed
                : (payload.plane_log_sheets_affected || 0),
            flights: details.pls_regenerated !== undefined
                ? details.pls_regenerated
                : (payload.flights_affected || 0),
            logbooks_recalculated: !!details.logbooks_recalculated
        };

        return payload;
    }

    // (Assign-result normalisation moved to TrackerPlaneService — it is shared
    // with the tracker-first assign dialog on the registry / device pages.)

    function toCount(value) {
        if (value === null || value === undefined || value === '') { return 0; }
        var n = parseInt(value, 10);
        return isNaN(n) ? 0 : n;
    }

    // 'YYYY-MM-DD HH:MM:SS' (UTC) → local 'DD MMM YYYY HH:mm', reusing the
    // tracker health service so these timestamps are parsed in exactly one
    // place across the tracker pages.
    vm.backfillStamp = function(ts) {
        if (!ts) { return '—'; }
        return TrackerHealthService.tsLocal(ts);
    };

    vm.actionIcon = function(action) {
        var map = {
            'created': 'fa-plus-circle',
            'assigned': 'fa-link',
            'unassigned': 'fa-unlink',
            'swapped': 'fa-exchange-alt',
            'edited': 'fa-pencil-alt',
            'deactivated': 'fa-pause-circle',
            'reactivated': 'fa-play-circle',
            'retired': 'fa-ban'
        };
        return map[action] || 'fa-circle';
    };

    vm.actionColor = function(action) {
        var map = {
            'created': '#16a34a',
            'assigned': '#2563eb',
            'unassigned': '#f59e0b',
            'swapped': '#8b5cf6',
            'edited': '#64748b',
            'deactivated': '#f59e0b',
            'reactivated': '#16a34a',
            'retired': '#dc2626'
        };
        return map[action] || '#64748b';
    };

    vm.actionBadgeClass = function(action) {
        var map = {
            'assigned': 'snazzy-table__badge--success',
            'unassigned': 'snazzy-table__badge--warning',
            'swapped': 'snazzy-table__badge--info',
            'deactivated': 'snazzy-table__badge--danger',
            'reactivated': 'snazzy-table__badge--success',
            'retired': 'snazzy-table__badge--danger'
        };
        return map[action] || '';
    };

    vm.formatDetails = function(entry) {
        if (!entry.parsed_details) return entry.details || '';
        var d = entry.parsed_details;
        var parts = [];
        if (d.old_entries_floated !== undefined) parts.push(d.old_entries_floated + ' entries floated');
        if (d.old_pls_removed !== undefined) parts.push(d.old_pls_removed + ' PLS removed');
        if (d.new_entries_claimed !== undefined) parts.push(d.new_entries_claimed + ' entries claimed');
        if (d.pls_regenerated !== undefined) parts.push(d.pls_regenerated + ' PLS regenerated');
        if (d.logbooks_recalculated) parts.push('logbooks recalculated');
        if (parts.length) return parts.join(' · ');
        // Fallback: show all key-value changes
        for (var key in d) {
            if (d.hasOwnProperty(key) && d[key] && typeof d[key] === 'object' && d[key].old !== undefined) {
                parts.push(key + ': "' + (d[key].old || '') + '" → "' + (d[key].new || '') + '"');
            }
        }
        return parts.length ? parts.join(', ') : '';
    };
}
