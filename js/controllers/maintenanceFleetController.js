// MaintenanceFleetController — fleet list + per-aircraft detail tabs, and the
// aircraft page's "Add maintenance check" form.
// Routes:
//   dashboard.maintenance.fleet              → list
//   dashboard.maintenance.fleet.aircraft     → detail with tab=… query param
app.controller('MaintenanceFleetController', MaintenanceFleetController);

MaintenanceFleetController.$inject = ['$rootScope', '$scope', '$state', '$stateParams', 'ToastService', 'MaintenanceAccessService'];
function MaintenanceFleetController($rootScope, $scope, $state, $stateParams, ToastService, MaintenanceAccessService) {
    var vm = this;

    function parentCtx() {
        var p = $scope.$parent;
        while (p && !p.vm) p = p.$parent;
        return p && p.vm ? p.vm : {};
    }
    var ctx = parentCtx();
    vm.org_id    = ctx.org_id;
    vm.is_admin  = !!ctx.is_admin;
    vm.is_senior = !!ctx.is_senior;
    vm.can_edit  = vm.is_admin || vm.is_senior;

    vm.plane_id = $stateParams.plane_id ? parseInt($stateParams.plane_id, 10) : null;
    vm.action   = vm.plane_id ? 'detail' : 'list';

    vm.loading  = true;
    vm.fleet    = [];
    vm.search   = '';

    // detail state
    vm.plane          = null;
    vm.tab            = 'checks';
    vm.checks         = [];
    vm.flights        = [];
    vm.issues         = [];
    vm.airframe_log   = [];
    vm.engine_logs    = {};   // engine_id → []
    vm.prop_logs      = {};   // prop_id   → []
    vm.tab_loading    = false;
    vm.tab_counts     = { checks:0, flights:0, issues:0, airframe:0 };

    vm.read_only     = false;   // a FORMER aircraft (see loadDetail)

    vm.setTab        = setTab;
    vm.formatDate    = formatDate;
    vm.periodsLabel  = periodsLabel;
    vm.checkStatus   = checkStatus;
    vm.issueStatus   = issueStatus;
    vm.openAddCheck  = openAddCheck;

    if (vm.action === 'list') {
        loadFleet();
    } else {
        loadDetail();
    }

    function loadFleet() {
        vm.loading = true;
        MaintenanceAccessService.Fleet(vm.org_id).then(function(res) {
            vm.loading = false;
            if (res && res.success !== false) {
                vm.fleet = (res.fleet || res.aircraft || res.data || res || []);
                if (!angular.isArray(vm.fleet)) vm.fleet = [];
            } else {
                ToastService.error('Failed to load fleet', res && res.message);
            }
        });
    }

    function loadDetail() {
        vm.loading = true;
        MaintenanceAccessService.Fleet(vm.org_id).then(function(res) {
            var fleet = (res && (res.fleet || res.aircraft || res.data || res)) || [];
            if (!angular.isArray(fleet)) fleet = [];
            vm.plane = find(fleet, function(p) { return parseInt(p.plane_id || p.id, 10) === vm.plane_id; });
            if (!vm.plane) {
                vm.loading = false;
                ToastService.error('Aircraft not found', 'This aircraft is not nominated to your organisation.');
                $state.go('dashboard.maintenance.fleet');
                return;
            }
            // An aircraft the organisation USED to maintain (the club ended the
            // nomination, or the aircraft left the club): its records of that period
            // stay readable for 7 years — read-only (backend refuses any write).
            vm.read_only = !!vm.plane.read_only || vm.plane.status === 'former';
            if (vm.read_only) vm.can_edit = false;
            vm.loading = false;
            setTab('checks');
        });
    }

    function setTab(tab) {
        vm.tab = tab;
        vm.tab_loading = true;
        var pid = vm.plane_id;
        var p;

        if (tab === 'checks')   p = MaintenanceAccessService.Checks(pid).then(function(r){ vm.checks = list(r, 'checks'); vm.tab_counts.checks = vm.checks.length; });
        else if (tab === 'flights') p = MaintenanceAccessService.Flights(pid).then(function(r){ vm.flights = list(r, 'flights'); vm.tab_counts.flights = vm.flights.length; });
        else if (tab === 'issues')  p = MaintenanceAccessService.Issues(pid).then(function(r){ vm.issues = list(r, 'issues'); vm.tab_counts.issues = vm.issues.length; });
        // the logbook endpoints answer { maintenance_checks: [...] } (they were read
        // as 'entries', so every logbook tab showed "No … log entries")
        else if (tab === 'airframe') p = MaintenanceAccessService.AirframeLogbook(pid).then(function(r){ vm.airframe_log = list(r, 'maintenance_checks'); vm.tab_counts.airframe = vm.airframe_log.length; });
        else if (tab.indexOf('engine:') === 0) {
            var eid = parseInt(tab.split(':')[1], 10);
            p = MaintenanceAccessService.EngineLogbook(pid, eid).then(function(r){ vm.engine_logs[eid] = list(r, 'maintenance_checks'); });
        }
        else if (tab.indexOf('prop:') === 0) {
            var prid = parseInt(tab.split(':')[1], 10);
            p = MaintenanceAccessService.PropellerLogbook(pid, prid).then(function(r){ vm.prop_logs[prid] = list(r, 'maintenance_checks'); });
        }

        if (p && p.finally) p.finally(function() { vm.tab_loading = false; });
        else vm.tab_loading = false;
    }

    // ── Add maintenance check ──
    // In the workspace itself: POST maintenance_access/occurrence, gated on the
    // backend by AccessControl::canMaintainPlane (a member of an org nominated
    // for this aircraft). It used to jump to Manage Club's maintenance page,
    // which needs a club-admin club (current_club_admin) — engineers aren't
    // club admins, and the Manage Club route guard refuses them.
    // Same check fields as the club form (minus extension / workpack / CRS).
    vm.maintenance_types = ['annual', '25hours', '50hours', '100hours', 'interim', '6months', 'workpack'];
    vm.check_form = null;      // null = closed
    vm.check_saving = false;
    vm.closeAddCheck = function() { vm.check_form = null; };
    vm.saveCheck = saveCheck;

    function openAddCheck() {
        if (!vm.can_edit || vm.read_only) return;
        var now = new Date();
        vm.check_form = {
            maintenance_type: '',
            check_date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            check_time: new Date(1970, 0, 1, now.getHours(), now.getMinutes()),   // input[type=time] binds a Date
            hours_remaining: undefined,
            next_check: undefined,
            checked_by: '',
            notes: ''
        };
    }

    function saveCheck() {
        var f = vm.check_form;
        if (!f || vm.check_saving) return;
        if (!f.maintenance_type) { ToastService.warning('Maintenance Type Required', 'Please select a maintenance type.'); return; }
        if (!f.check_date) { ToastService.warning('Date Required', 'Please enter the date of maintenance.'); return; }
        if (!angular.isDate(f.check_time) || isNaN(f.check_time.getTime())) { ToastService.warning('Time Required', 'Please enter the time of maintenance.'); return; }
        if (f.hours_remaining === undefined || f.hours_remaining === null || f.hours_remaining === '' || !f.next_check) {
            ToastService.warning('Maintenance Incomplete', 'Please add the hours and the date of the next check.');
            return;
        }
        var payload = {
            plane_id: vm.plane_id,
            maintenance: {
                maintenance_type: f.maintenance_type,
                // datetime of the check, local time as typed
                check_date: dateOnly(f.check_date) + ' ' + pad(f.check_time.getHours()) + ':' + pad(f.check_time.getMinutes()) + ':00',
                hours_remaining: f.hours_remaining,
                // calendar date — formatted from the picker in LOCAL time
                expiry_date: dateOnly(f.next_check),
                // the engineer who signed out the aircraft (optional; stored since 2026-11-06)
                checked_by: f.checked_by || '',
                description: f.notes || ''
            }
        };
        vm.check_saving = true;
        MaintenanceAccessService.AddOccurrence(payload).then(function(res) {
            vm.check_saving = false;
            if (!res || res.success === false) {
                ToastService.error('Check Not Saved', (res && res.message) || 'The maintenance check could not be saved.');
                return;
            }
            ToastService.success('Maintenance Check Saved', 'The check has been recorded on ' + ((vm.plane && vm.plane.registration) || 'the aircraft') + '.');
            vm.check_form = null;
            setTab('checks');
        });
    }

    function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
    function dateOnly(d) {
        if (!d) return null;
        if (angular.isString(d)) return d.substring(0, 10);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function list(r, key) {
        if (!r) return [];
        var v = r[key] || r.data || r;
        return angular.isArray(v) ? v : [];
    }
    function find(arr, pred) {
        for (var i = 0; i < arr.length; i++) if (pred(arr[i])) return arr[i];
        return null;
    }
    // "12/03/2021 – 05/11/2026" for each period a former aircraft was maintained
    function periodsLabel(p) {
        var periods = (p && p.periods) || [];
        return periods.map(function(x) { return dmy(x.start) + ' – ' + dmy(x.end); }).join(', ');
    }
    function dmy(s) {
        if (!s) return '—';
        s = String(s).substring(0, 10).split('-');
        return s.length === 3 ? (s[2] + '/' + s[1] + '/' + s[0]) : '—';
    }
    function formatDate(s) {
        if (!s) return '—';
        s = String(s).substring(0, 10);
        return s;
    }
    function checkStatus(c) {
        if (!c.expiry_date) return { cls:'mxo-badge--slate', label:'No expiry' };
        var days = Math.floor((new Date(c.expiry_date).getTime() - Date.now()) / 86400000);
        if (days < 0)  return { cls:'mxo-badge--danger', label:'Overdue' };
        if (days < 14) return { cls:'mxo-badge--warn',   label:'Due soon' };
        return { cls:'mxo-badge--ok', label:'OK' };
    }
    function issueStatus(i) {
        var s = (i.status || '').toLowerCase();
        if (s === 'closed' || s === 'resolved') return { cls:'mxo-badge--ok', label:'Resolved' };
        if (s === 'in_progress' || s === 'open') return { cls:'mxo-badge--warn', label: i.status };
        return { cls:'mxo-badge--info', label: i.status || 'Reported' };
    }
}
