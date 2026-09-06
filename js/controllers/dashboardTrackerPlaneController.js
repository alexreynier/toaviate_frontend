app.controller('DashboardTrackerPlaneController', DashboardTrackerPlaneController);

DashboardTrackerPlaneController.$inject = [
    '$rootScope', '$scope', '$state', '$stateParams', 'TrackerPlaneService', 'PlaneService', 'ToastService', '$timeout', 'TrackerHealthService'
];

function DashboardTrackerPlaneController($rootScope, $scope, $state, $stateParams, TrackerPlaneService, PlaneService, ToastService, $timeout, TrackerHealthService) {

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
    vm.club_id = vm.user.current_club_admin ? vm.user.current_club_admin.id : null;
    vm.is_manager = $rootScope.isToAviateStaff();
    if (!vm.is_manager) return;

    // ── Action routing ──
    vm.action = $state.current.data ? $state.current.data.action : 'list';

    // ── Data ──
    vm.trackers = [];
    vm.planes = [];
    vm.loading = false;
    vm.search_text = '';

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

    // ── Init ──
    if (vm.action === 'list') {
        loadFleetSummary();
    } else if (vm.action === 'detail') {
        loadPlaneDetail();
    }

    // ═══════════════════════════════════════════
    // FLEET SUMMARY (LIST)
    // ═══════════════════════════════════════════

    function loadFleetSummary() {
        vm.loading = true;
        var planesLoaded = false;
        var trackersLoaded = false;

        function checkReady() {
            if (planesLoaded && trackersLoaded) vm.loading = false;
        }

        // Load all planes for the club
        PlaneService.GetAllByClub(vm.club_id).then(function(data) {
            vm.planes = data || [];
            planesLoaded = true;
            checkReady();
        });

        // Load all tracker assignments for the club
        TrackerPlaneService.GetByClub(vm.club_id).then(function(data) {
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
        if (!vm.search_text) return vm.planes;
        var q = vm.search_text.toLowerCase();
        return vm.planes.filter(function(p) {
            var tracker = vm.getTrackerForPlane(p);
            return (p.registration && p.registration.toLowerCase().indexOf(q) > -1) ||
                   (p.plane_type && p.plane_type.toLowerCase().indexOf(q) > -1) ||
                   (tracker && tracker.label && tracker.label.toLowerCase().indexOf(q) > -1) ||
                   (tracker && tracker.imei && tracker.imei.indexOf(q) > -1);
        });
    };

    vm.countWithTracker = function() {
        var count = 0;
        for (var i = 0; i < vm.planes.length; i++) {
            if (vm.getTrackerForPlane(vm.planes[i])) count++;
        }
        return count;
    };

    vm.openPlaneDetail = function(plane) {
        $state.go('dashboard.super_admin.tracker_plane_detail', { plane_id: plane.plane_id });
    };

    // ═══════════════════════════════════════════
    // PLANE DETAIL
    // ═══════════════════════════════════════════

    function loadPlaneDetail() {
        vm.loading = true;
        var planeLoaded = false;
        var trackerLoaded = false;
        var logLoaded = false;

        function checkReady() {
            if (planeLoaded && trackerLoaded && logLoaded) vm.loading = false;
        }

        // Get plane info
        PlaneService.GetById(vm.plane_id).then(function(data) {
            vm.plane = data || {};
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
            assigned_from_date: formatDateForInput(new Date()),
            assigned_from_time: formatTimeForInput(new Date()),
            notes: ''
        };
        loadAvailableTrackers();
    };

    vm.submitAssign = function() {
        var checks = [
            { ok: vm.assign_data.tracker, field: 'assign_tracker_select', label: 'Tracker selection' },
            { ok: vm.assign_data.assigned_from_date, field: 'assign_date', label: 'Installation date' }
        ];
        if (!ToastService.validateForm(checks)) return;

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
                vm.dialog = null;
                ToastService.success('Tracker Assigned', data.message);
                loadPlaneDetail();
            } else {
                ToastService.error('Assignment Failed', data.message);
            }
        });
    };

    // ═══════════════════════════════════════════
    // SWAP TRACKER
    // ═══════════════════════════════════════════

    vm.openSwap = function() {
        vm.dialog = 'swap';
        vm.swap_data = {
            new_tracker: null,
            effective_at_date: formatDateForInput(new Date()),
            effective_at_time: formatTimeForInput(new Date()),
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
            unassigned_at_date: formatDateForInput(new Date()),
            unassigned_at_time: formatTimeForInput(new Date()),
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
                vm.dialog = null;
                ToastService.success('Tracker Removed',
                    data.fox_entries_floated + ' entries floated, ' +
                    data.plane_log_sheets_affected + ' log sheets affected.');
                loadPlaneDetail();
            } else {
                ToastService.error('Unassign Failed', data.message);
            }
        });
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
