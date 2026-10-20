app.controller('DashboardFoxTrackersController', DashboardFoxTrackersController);

DashboardFoxTrackersController.$inject = [
    '$rootScope', '$scope', '$state', '$stateParams', 'FoxTrackerService', 'ToastService', '$timeout', 'TrackerHealthService', 'TrackerPlaneService', 'PlaneService', 'ClubService'
];

function DashboardFoxTrackersController($rootScope, $scope, $state, $stateParams, FoxTrackerService, ToastService, $timeout, TrackerHealthService, TrackerPlaneService, PlaneService, ClubService) {

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
        // Pre-filled from the health board's "Register tracker" (unknown
        // devices carry their transmitted identity).
        if ($stateParams.imei) { vm.new_tracker.imei = $stateParams.imei; }
        if ($stateParams.ccid) { vm.new_tracker.ccid = $stateParams.ccid; }
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

    // The backend refuses a CCID contradicted by observed traffic
    // (reason:'ccid_mismatch' + transmitted_ccid). Offer "use transmitted";
    // forcing past it is almost always the wrong move, so keep it tiny.
    vm.ccid_conflict = null;

    vm.createTracker = function(force) {
        var checks = [
            { ok: vm.new_tracker.imei && /^\d{15}$/.test(vm.new_tracker.imei), field: 'imei', label: 'IMEI (must be exactly 15 digits)' },
            { ok: vm.new_tracker.ccid && vm.new_tracker.ccid.trim().length > 0, field: 'ccid', label: 'CCID' }
        ];

        if (!ToastService.validateForm(checks)) return;

        var payload = angular.copy(vm.new_tracker);
        if (force) { payload.allow_ccid_mismatch = true; }

        vm.creating = true;
        FoxTrackerService.Create(payload).then(function(data) {
            vm.creating = false;
            if (data.success) {
                ToastService.success('Tracker Created', 'ID: ' + data.tracker_id);
                $state.go('dashboard.super_admin.fox_trackers');
            } else if (data.reason === 'ccid_mismatch') {
                vm.ccid_conflict = { message: data.message, transmitted_ccid: data.transmitted_ccid };
            } else {
                vm.ccid_conflict = null;
                ToastService.error('Creation Failed', data.message);
            }
        });
    };

    vm.useTransmittedCcid = function() {
        if (!vm.ccid_conflict) return;
        vm.new_tracker.ccid = vm.ccid_conflict.transmitted_ccid;
        vm.ccid_conflict = null;
        vm.createTracker();
    };

    vm.forceCreateAnyway = function() {
        vm.ccid_conflict = null;
        vm.createTracker(true);
    };

    // ═══════════════════════════════════════════
    // ASSIGN TO AIRCRAFT (tracker-first)
    // ═══════════════════════════════════════════
    // The plane-first version of this dialog lives on the Fleet page
    // (tracker_plane_detail.html). This one starts from a device: pick the
    // club, pick an untracked aircraft, date it, done. Same endpoint, same
    // backfill semantics, same result reporting. Shared template:
    // views/manageclub/fox_assign_dialog.html (ng-included by the registry
    // list AND the device detail page — both run this controller).

    vm.assign = null;             // { tracker, step:'form'|'confirm'|'result', club_id, plane, ... }
    vm.assign_clubs = [];
    vm.assign_planes = [];        // untracked planes of the chosen club
    vm.assign_planes_loading = false;
    vm.assign_tracked_count = 0;  // planes hidden because they already have a tracker
    vm.assign_result = null;

    vm.openAssignDialog = function(tracker, $event) {
        if ($event) { $event.stopPropagation(); }
        var now = new Date();
        now.setSeconds(0, 0); // input[time] renders stray seconds/ms otherwise
        vm.assign = {
            tracker: tracker,
            step: 'form',
            club_id: vm.user.current_club_admin ? vm.user.current_club_admin.id : null,
            plane: null,
            // Date OBJECTS, not strings — Angular 1.4.7's input[date]/input[time]
            // throw ngModel:datefmt (and render blank) on a string model.
            // buildDatetime() below handles both shapes.
            assigned_from_date: new Date(now),
            assigned_from_time: new Date(now),
            notes: '',
            busy: false
        };
        vm.assign_result = null;
        loadAssignClubs();
    };

    function loadAssignClubs() {
        if (vm.assign_clubs.length > 0) { assignClubsReady(); return; }
        ClubService.GetAll().then(function(data) {
            vm.assign_clubs = (data && (data.clubs || data.items)) || (angular.isArray(data) ? data : []);
            assignClubsReady();
        });
    }

    function assignClubsReady() {
        if (!vm.assign) return; // dialog closed while loading
        // Club ids can arrive as strings — re-point the preselected id at the
        // list's own value so the <select> matches it.
        if (vm.assign.club_id) {
            var match = null;
            for (var i = 0; i < vm.assign_clubs.length; i++) {
                if (parseInt(vm.assign_clubs[i].id, 10) === parseInt(vm.assign.club_id, 10)) { match = vm.assign_clubs[i]; break; }
            }
            vm.assign.club_id = match ? match.id : null;
        }
        if (!vm.assign.club_id && vm.assign_clubs.length === 1) {
            vm.assign.club_id = vm.assign_clubs[0].id;
        }
        if (vm.assign.club_id) { vm.assignClubChanged(); }
    }

    vm.assignClubChanged = function() {
        vm.assign.plane = null;
        vm.assign_planes = [];
        vm.assign_tracked_count = 0;
        if (!vm.assign.club_id) return;
        vm.assign_planes_loading = true;
        var club_id = vm.assign.club_id;
        var planes = null;
        var tracked = null;

        function ready() {
            if (planes === null || tracked === null) return;
            // Ignore stale responses if the club changed (or dialog closed) mid-flight.
            if (!vm.assign || vm.assign.club_id !== club_id) return;
            var trackedIds = {};
            tracked.forEach(function(t) {
                if (t.current_plane_id !== null && t.current_plane_id !== undefined) {
                    trackedIds[String(t.current_plane_id)] = true;
                }
            });
            // Only untracked aircraft are offered — a plane that already has a
            // tracker needs a SWAP from its own aircraft page, not a second assign.
            vm.assign_planes = planes.filter(function(p) { return !trackedIds[String(p.plane_id)]; });
            vm.assign_tracked_count = planes.length - vm.assign_planes.length;
            vm.assign_planes_loading = false;
        }

        PlaneService.GetAllByClub(club_id).then(function(data) {
            planes = angular.isArray(data) ? data : [];
            ready();
        });
        TrackerPlaneService.GetByClub(club_id).then(function(data) {
            tracked = (data && data.success && data.trackers) ? data.trackers : [];
            ready();
        });
    };

    // True once the admin has typed an installation date earlier than today —
    // drives the backfill heads-up and the extra confirm step.
    vm.assignDialogIsBackdated = function() {
        if (!vm.assign || !vm.assign.assigned_from_date) return false;
        var chosen = vm.assign.assigned_from_date;
        var datePart = (chosen instanceof Date) ? formatDateForInput(chosen) : chosen;
        return datePart < formatDateForInput(new Date());
    };

    vm.submitAssignDialog = function() {
        var checks = [
            { ok: vm.assign.club_id, field: 'fox_assign_club', label: 'Club selection' },
            { ok: vm.assign.plane, field: 'fox_assign_plane', label: 'Aircraft selection' },
            { ok: vm.assign.assigned_from_date, field: 'fox_assign_date', label: 'Installation date' }
        ];
        if (!ToastService.validateForm(checks)) return;

        // A back-dated install rewrites history (claims flights, generates
        // tech log sheets) — review it first, matching the Fleet page.
        if (vm.assignDialogIsBackdated()) {
            vm.assign.step = 'confirm';
            return;
        }
        vm.executeAssignDialog();
    };

    vm.executeAssignDialog = function() {
        vm.assign.busy = true;
        TrackerPlaneService.Assign({
            tracker_id: vm.assign.tracker.id,
            plane_id: vm.assign.plane.plane_id,
            club_id: vm.assign.club_id,
            assigned_from: buildDatetime(vm.assign.assigned_from_date, vm.assign.assigned_from_time),
            notes: vm.assign.notes || null
        }).then(function(data) {
            if (!vm.assign) return;
            vm.assign.busy = false;
            if (data.success) {
                var result = TrackerPlaneService.NormalizeAssignResult(data);
                if (result.claimed_anything) {
                    // Back-dated assign pulled in existing flights — show what
                    // it claimed rather than closing on a toast.
                    vm.assign_result = result;
                    vm.assign.step = 'result';
                } else {
                    var reg = vm.assign.plane.registration;
                    vm.closeAssignDialog();
                    ToastService.success('Tracker Assigned', 'Now installed on ' + reg + '.');
                    reloadAfterAssign();
                }
            } else {
                ToastService.error('Assignment Failed', data.message);
            }
        });
    };

    vm.closeAssignDialogResult = function() {
        vm.closeAssignDialog();
        reloadAfterAssign();
    };

    vm.closeAssignDialog = function() {
        vm.assign = null;
        vm.assign_result = null;
    };

    function reloadAfterAssign() {
        if (vm.action === 'detail' && vm.tracker) {
            loadDetail(vm.tracker.id);
        } else {
            loadTrackers();
        }
    }

    // ── Datetime helpers — same convention as the Fleet page dialogs ──
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
        var datePart = (dateVal instanceof Date) ? formatDateForInput(dateVal) : dateVal;
        var timePart = (timeVal instanceof Date) ? formatTimeForInput(timeVal) : (timeVal || '12:00');
        return datePart + ' ' + timePart + ':00';
    }

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
            'retired': 'fa-ban',
            'identity_corrected': 'fa-fingerprint',
            'entry_matched': 'fa-link'
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
            'retired': '#dc2626',
            'identity_corrected': '#8b5cf6',
            'entry_matched': '#16a34a'
        };
        return map[action] || '#64748b';
    };

    vm.formatDetails = function(entry) {
        var d = entry.parsed_details;

        // Identity fix: old→new ccid/imei, the reason, and the backfill count.
        if (entry.action === 'identity_corrected' && d) {
            var bits = [];
            ['ccid', 'imei'].forEach(function(key) {
                if (d[key] && d[key].old !== undefined) {
                    bits.push(key + ': "' + (d[key].old || '') + '" → "' + (d[key].new || '') + '"');
                }
            });
            if (d.reason) { bits.push('reason: "' + d.reason + '"'); }
            var regen = d.pls_regenerated !== undefined ? d.pls_regenerated : d.entries_claimed;
            if (regen !== undefined && regen !== null) { bits.push(regen + ' flight(s) backfilled'); }
            return bits.join(' · ');
        }

        // Manual flight match: entry → tech log sheet.
        if (entry.action === 'entry_matched' && d) {
            return 'Flight ENTRY #' + (d.fox_entry_id || '?') + ' manually matched → tech log sheet #' + (d.plane_log_sheet_id || '?');
        }

        if (!d) return entry.details || '';
        var parts = [];
        for (var key in d) {
            if (d.hasOwnProperty(key) && d[key] && d[key].old !== undefined) {
                parts.push(key + ': "' + (d[key].old || '') + '" → "' + (d[key].new || '') + '"');
            }
        }
        return parts.length ? parts.join(', ') : JSON.stringify(d);
    };
}
