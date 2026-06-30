app.controller('DashboardFoxTrackersController', DashboardFoxTrackersController);

DashboardFoxTrackersController.$inject = [
    '$rootScope', '$scope', '$state', '$stateParams', 'FoxTrackerService', 'ToastService', '$timeout', 'TrackerHealthService'
];

function DashboardFoxTrackersController($rootScope, $scope, $state, $stateParams, FoxTrackerService, ToastService, $timeout, TrackerHealthService) {

    var vm = this;

    // ── Auth gate — ToAviate platform staff ──
    // Same gate as the ToAviate Admin tab (the shared $rootScope.isToAviateStaff
    // helper). Currently any @toaviate.com user; per-staff roles can refine this
    // single block in future without touching every tool.
    vm.user = $rootScope.globals.currentUser;
    vm.authorised = $rootScope.isToAviateStaff();
    if (!vm.authorised) return;

    // ── Action routing ──
    vm.action = $state.current.data ? $state.current.data.action : 'list';

    // ── Data ──
    vm.trackers = [];
    vm.tracker = null;
    vm.assignments = [];
    vm.change_log = [];
    vm.loading = false;
    vm.search_text = '';
    vm.filter_status = '';
    vm.filter_assignment = '';

    // ── Create form ──
    vm.new_tracker = {
        imei: '',
        ccid: '',
        fox_id: '',
        label: '',
        device_type: 'foxAvionix11',
        notes: ''
    };

    // ── Edit state ──
    vm.editing = false;
    vm.edit_data = {};

    // ── Confirm dialogs ──
    vm.confirm_action = null;  // 'deactivate' | 'retire'
    vm.confirm_tracker = null;

    // ── Init based on action ──
    if (vm.action === 'list') {
        loadTrackers();
    } else if (vm.action === 'detail') {
        loadDetail($stateParams.tracker_id);
    } else if (vm.action === 'add') {
        // nothing to preload
    }

    // ═══════════════════════════════════════════
    // LIST
    // ═══════════════════════════════════════════

    function loadTrackers() {
        vm.loading = true;
        FoxTrackerService.GetAll().then(function(data) {
            vm.loading = false;
            if (data.success) {
                vm.trackers = data.trackers || [];
            } else {
                ToastService.error('Load Failed', data.message);
            }
        });
    }

    vm.filteredTrackers = function() {
        var list = vm.trackers;
        if (vm.filter_status) {
            list = list.filter(function(t) { return t.status === vm.filter_status; });
        }
        if (vm.filter_assignment === 'assigned') {
            list = list.filter(function(t) { return t.current_plane_id != null; });
        } else if (vm.filter_assignment === 'unassigned') {
            list = list.filter(function(t) { return t.current_plane_id == null; });
        }
        if (vm.search_text) {
            var q = vm.search_text.toLowerCase();
            list = list.filter(function(t) {
                return (t.imei && t.imei.toLowerCase().indexOf(q) > -1) ||
                       (t.ccid && t.ccid.toLowerCase().indexOf(q) > -1) ||
                       (t.label && t.label.toLowerCase().indexOf(q) > -1) ||
                       (t.fox_id && t.fox_id.toLowerCase().indexOf(q) > -1);
            });
        }
        return list;
    };

    vm.countByStatus = function(status) {
        return vm.trackers.filter(function(t) { return t.status === status; }).length;
    };

    vm.clearFilters = function() {
        vm.search_text = '';
        vm.filter_status = '';
        vm.filter_assignment = '';
    };

    vm.openDetail = function(tracker) {
        $state.go('dashboard.super_admin.fox_tracker_detail', { tracker_id: tracker.id });
    };

    // ═══════════════════════════════════════════
    // DETAIL
    // ═══════════════════════════════════════════

    function loadDetail(trackerId) {
        vm.loading = true;
        FoxTrackerService.GetDetail(trackerId).then(function(data) {
            vm.loading = false;
            if (data.success) {
                vm.tracker = data.tracker;
                vm.assignments = data.assignments || [];
            } else {
                ToastService.error('Load Failed', data.message);
            }
        });
        loadChangeLog(trackerId);
    }

    function loadChangeLog(trackerId) {
        FoxTrackerService.GetChangeLog(trackerId).then(function(data) {
            if (data.success) {
                vm.change_log = (data.change_log || []).map(function(entry) {
                    if (entry.details && typeof entry.details === 'string') {
                        try { entry.parsed_details = JSON.parse(entry.details); }
                        catch(e) { entry.parsed_details = null; }
                    }
                    return entry;
                });
            }
        });
    }

    // ── Edit mode ──
    vm.startEdit = function() {
        vm.editing = true;
        vm.edit_data = {
            label: vm.tracker.label,
            fox_id: vm.tracker.fox_id,
            device_type: vm.tracker.device_type,
            notes: vm.tracker.notes
        };
    };

    vm.cancelEdit = function() {
        vm.editing = false;
        vm.edit_data = {};
    };

    vm.saveEdit = function() {
        vm.saving = true;
        FoxTrackerService.Edit(vm.tracker.id, vm.edit_data).then(function(data) {
            vm.saving = false;
            if (data.success) {
                ToastService.success('Tracker Updated', data.message);
                vm.editing = false;
                loadDetail(vm.tracker.id);
            } else {
                ToastService.error('Update Failed', data.message);
            }
        });
    };

    // ── Status actions ──
    vm.showConfirm = function(action, tracker) {
        vm.confirm_action = action;
        vm.confirm_tracker = tracker || vm.tracker;
    };

    vm.cancelConfirm = function() {
        vm.confirm_action = null;
        vm.confirm_tracker = null;
    };

    vm.executeConfirm = function() {
        var tracker = vm.confirm_tracker;
        var action = vm.confirm_action;
        vm.confirm_busy = true;

        var promise;
        if (action === 'deactivate') {
            promise = FoxTrackerService.Deactivate(tracker.id);
        } else if (action === 'reactivate') {
            promise = FoxTrackerService.Reactivate(tracker.id);
        } else if (action === 'retire') {
            promise = FoxTrackerService.Retire(tracker.id);
        }

        if (promise) {
            promise.then(function(data) {
                vm.confirm_busy = false;
                vm.confirm_action = null;
                vm.confirm_tracker = null;
                if (data.success) {
                    ToastService.success('Done', data.message);
                    if (vm.action === 'detail') {
                        loadDetail(tracker.id);
                    } else {
                        loadTrackers();
                    }
                } else {
                    ToastService.error('Action Failed', data.message);
                }
            });
        }
    };

    // ═══════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════

    vm.clearFieldError = function(event) {
        ToastService.clearFieldError(event);
    };

    vm.createTracker = function() {
        var checks = [
            { ok: vm.new_tracker.imei && /^\d{15}$/.test(vm.new_tracker.imei), field: 'imei', label: 'IMEI (must be exactly 15 digits)' },
            { ok: vm.new_tracker.ccid && vm.new_tracker.ccid.trim().length > 0, field: 'ccid', label: 'CCID' }
        ];

        if (!ToastService.validateForm(checks)) return;

        vm.creating = true;
        FoxTrackerService.Create(vm.new_tracker).then(function(data) {
            vm.creating = false;
            if (data.success) {
                ToastService.success('Tracker Created', 'ID: ' + data.tracker_id);
                $state.go('dashboard.super_admin.fox_trackers');
            } else {
                ToastService.error('Creation Failed', data.message);
            }
        });
    };

    // ── Navigation ──
    vm.goBack = function() {
        if (vm.action === 'detail' || vm.action === 'add') {
            $state.go('dashboard.super_admin.fox_trackers');
        } else {
            $state.go('dashboard.super_admin');
        }
    };

    // ── Helpers ──
    vm.statusBadgeClass = function(status) {
        if (status === 'active') return 'snazzy-table__badge--success';
        if (status === 'inactive') return 'snazzy-table__badge--warning';
        if (status === 'retired') return 'snazzy-table__badge--danger';
        return '';
    };

    // ── Device health (keyed off last_seen) ── delegated to the shared
    // TrackerHealthService so the Fox Trackers list and the Aircraft Trackers
    // view stay in sync on thresholds/labels.
    vm.healthState      = TrackerHealthService.state;
    vm.healthBadgeClass = TrackerHealthService.badgeClass;
    vm.healthLabel      = TrackerHealthService.label;
    vm.lastSeenHuman    = TrackerHealthService.lastSeenHuman;
    vm.tsLocal          = TrackerHealthService.tsLocal;

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

    vm.formatDetails = function(entry) {
        if (!entry.parsed_details) return entry.details || '';
        var parts = [];
        var d = entry.parsed_details;
        for (var key in d) {
            if (d.hasOwnProperty(key) && d[key].old !== undefined) {
                parts.push(key + ': "' + (d[key].old || '') + '" → "' + (d[key].new || '') + '"');
            }
        }
        return parts.length ? parts.join(', ') : JSON.stringify(d);
    };
}
