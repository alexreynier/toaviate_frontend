// ═══════════════════════════════════════════════════════════════════
//  SuperAdminAirworthinessController
//  ToAviate super-admin — Aircraft Airworthiness (owner 2026-11-08):
//    · every aircraft's airworthiness type: Certificate of Airworthiness
//      (CofA — its validity is the ARC) or Permit to Fly (expires)
//    · what it reads as now (the one document every page shows), its
//      fleets, the UK register's category (a mismatch is flagged)
//    · ToAviate staff change the type (club admins cannot), with an
//      inline confirmation and an optional reason; every change is logged
//        GET planes/airworthiness_types
//        PUT planes/{plane_id}/airworthiness_type {airworthiness_type, reason}
//  Backend is authoritative (non-staff get FORBIDDEN); the staff gate
//  here is UX only, same as SuperAdminRenewalsController.
//  Contract: backend BACKEND_AIRCRAFT_DOCUMENTS_ACCESS_GUIDE.md §10.7
// ═══════════════════════════════════════════════════════════════════

app.controller('SuperAdminAirworthinessController', SuperAdminAirworthinessController);

SuperAdminAirworthinessController.$inject = ['PlaneService', 'ToastService', '$rootScope'];
function SuperAdminAirworthinessController(PlaneService, ToastService, $rootScope) {
    var vm = this;

    vm.is_staff = $rootScope.isToAviateStaff();

    vm.loading  = true;
    vm.migrated = true;
    vm.aircraft = [];
    vm.recent   = [];
    vm.search   = '';
    vm.onlyMismatch = false;
    vm.confirm  = null;      // {plane, to, reason}
    vm.saving   = false;
    vm.lastResult = null;    // the last change's answer (warnings)

    vm.reload   = load;
    vm.matches  = matches;
    vm.typeLabel = typeLabel;
    vm.mismatchCount = mismatchCount;
    vm.askChange = function (a) {
        vm.lastResult = null;
        vm.confirm = { plane: a, to: a.airworthiness_type === 'ptf' ? 'cofa' : 'ptf', reason: '' };
    };
    vm.cancel   = function () { vm.confirm = null; };
    vm.runChange = runChange;

    if (!vm.is_staff) {
        vm.loading = false;
        return;
    }

    load();

    function load() {
        vm.loading = true;
        PlaneService.GetAirworthinessTypes().then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Load Aircraft', (data && data.message && data.message.message) || (data && data.message) || 'Please refresh and try again.');
                return;
            }
            vm.aircraft = angular.isArray(data.aircraft) ? data.aircraft : [];
            vm.recent   = angular.isArray(data.recent_changes) ? data.recent_changes : [];
            vm.migrated = !!data.migrated;
        });
    }

    function typeLabel(t) {
        return t === 'ptf' ? 'Permit to Fly' : 'CofA + ARC';
    }

    function matches(a) {
        if (vm.onlyMismatch && !a.register_mismatch) { return false; }
        var q = (vm.search || '').toLowerCase().replace(/[\s-]/g, '');
        if (!q) { return true; }
        var clubs = (a.clubs || []).map(function (c) { return c.title; }).join(' ').toLowerCase();
        return String(a.registration || '').toLowerCase().replace(/[\s-]/g, '').indexOf(q) !== -1
            || String(a.plane_id) === q
            || clubs.indexOf(q) !== -1;
    }

    function mismatchCount() {
        var n = 0;
        angular.forEach(vm.aircraft, function (a) { if (a.register_mismatch) { n++; } });
        return n;
    }

    function runChange() {
        if (!vm.confirm || vm.saving) { return; }
        var c = vm.confirm;
        vm.saving = true;
        PlaneService.SetAirworthinessType(c.plane.plane_id, c.to, c.reason).then(function (data) {
            vm.saving = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Change', (data && data.message && data.message.message) || (data && data.message) || 'Please try again.');
                return;
            }
            vm.confirm = null;
            vm.lastResult = data;
            ToastService.success('Airworthiness Type Changed', data.message || (c.plane.registration + ' changed.'), { confetti: false });
            load();
        });
    }
}
