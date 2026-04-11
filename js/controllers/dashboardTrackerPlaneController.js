app.controller('DashboardTrackerPlaneController', DashboardTrackerPlaneController);

DashboardTrackerPlaneController.$inject = [
    '$rootScope', '$scope', '$state', '$stateParams', 'TrackerPlaneService', 'PlaneService', 'ToastService', '$timeout'
];

function DashboardTrackerPlaneController($rootScope, $scope, $state, $stateParams, TrackerPlaneService, PlaneService, ToastService, $timeout) {

    var vm = this;

    // ── Auth ──
    vm.user = $rootScope.globals.currentUser;
    vm.club_id = vm.user.current_club_admin ? vm.user.current_club_admin.id : null;
    vm.is_manager = (vm.user.access && vm.user.access.manager && vm.user.access.manager.indexOf(vm.club_id) > -1);
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
            trackersLoaded = true;
            checkReady();
        });
    }

    vm.getTrackerForPlane = function(plane) {
        for (var i = 0; i < vm.trackers.length; i++) {
            if (vm.trackers[i].current_plane_id == plane.plane_id) {
                return vm.trackers[i];
            }
        }
        return null;
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
        $state.go('dashboard.manage_club.tracker_plane_detail', { plane_id: plane.plane_id });
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
                vm.swap_result = data;
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
            $state.go('dashboard.manage_club.tracker_planes');
        } else {
            $state.go('dashboard.manage_club');
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
