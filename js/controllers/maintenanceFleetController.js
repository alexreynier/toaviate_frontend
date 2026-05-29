// MaintenanceFleetController — fleet list + per-aircraft detail tabs.
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

    vm.setTab        = setTab;
    vm.formatDate    = formatDate;
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
        else if (tab === 'airframe') p = MaintenanceAccessService.AirframeLogbook(pid).then(function(r){ vm.airframe_log = list(r, 'entries'); vm.tab_counts.airframe = vm.airframe_log.length; });
        else if (tab.indexOf('engine:') === 0) {
            var eid = parseInt(tab.split(':')[1], 10);
            p = MaintenanceAccessService.EngineLogbook(pid, eid).then(function(r){ vm.engine_logs[eid] = list(r, 'entries'); });
        }
        else if (tab.indexOf('prop:') === 0) {
            var prid = parseInt(tab.split(':')[1], 10);
            p = MaintenanceAccessService.PropellerLogbook(pid, prid).then(function(r){ vm.prop_logs[prid] = list(r, 'entries'); });
        }

        if (p && p.finally) p.finally(function() { vm.tab_loading = false; });
        else vm.tab_loading = false;
    }

    function openAddCheck() {
        // Delegate to the existing club maintenance check form.
        if (!vm.can_edit) return;
        $state.go('dashboard.manage_club.maintenance.detail', { plane_id: vm.plane_id });
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
