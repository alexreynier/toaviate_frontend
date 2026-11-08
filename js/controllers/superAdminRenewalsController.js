// ═══════════════════════════════════════════════════════════════════
//  SuperAdminRenewalsController
//  ToAviate super-admin — Membership Renewals:
//    · automatic membership renewals run for EVERY club (2026-11-07);
//      ToAviate staff pause a club that is not ready (nobody there is
//      charged; its auto-renew members are told it will not renew)
//        GET clubs/renewals_paused
//        PUT clubs/{club_id}/renewals_paused {paused: 1|0}
//    · shows the global kill switch (MEMBERSHIP_RENEWALS_DISABLED in the
//      server config — not changeable here)
//    · the Direct Debit collection (2026-11-07): runs for every club too;
//      staff pause a club the same way (its queued invoices wait), and see
//      queued / held / unconfirmed collections per club
//        PUT clubs/{club_id}/dd_collection_paused {paused: 1|0}
//      kill switch DD_COLLECTION_DISABLED (server config)
//      Contract: backend BACKEND_DD_COLLECTION_GUIDE.md §7
//  Backend is authoritative (non-staff get FORBIDDEN); the staff gate
//  here is UX only, same as SuperAdminSecurityController.
//  Contract: backend BACKEND_MEMBERSHIP_RENEWALS_GUIDE.md §7
// ═══════════════════════════════════════════════════════════════════

app.controller('SuperAdminRenewalsController', SuperAdminRenewalsController);

SuperAdminRenewalsController.$inject = ['ClubService', 'ToastService', '$rootScope'];
function SuperAdminRenewalsController(ClubService, ToastService, $rootScope) {
    var vm = this;

    // ── Access gate — ToAviate platform staff only (backend is authoritative) ──
    vm.user     = $rootScope.globals.currentUser;
    vm.is_staff = $rootScope.isToAviateStaff();

    vm.loading  = true;
    vm.clubs    = [];
    vm.disabled = false;     // the global kill switch
    vm.migrated = true;
    vm.ddDisabled = false;   // the Direct Debit collection's kill switch
    vm.ddMigrated = true;
    vm.search   = '';
    vm.confirm  = null;      // {club, paused} — the inline confirmation
    vm.saving   = false;

    vm.reload     = load;
    vm.matches    = matches;
    vm.askToggle  = function (club) { vm.confirm = { club: club, kind: 'renewals', paused: club.renewals_paused ? 0 : 1 }; };
    vm.askDdToggle = function (club) { vm.confirm = { club: club, kind: 'dd', paused: parseInt(club.dd_collection_paused, 10) === 1 ? 0 : 1 }; };
    vm.ddPausedCount = ddPausedCount;
    vm.cancel     = function () { vm.confirm = null; };
    vm.runToggle  = runToggle;
    vm.pausedCount = pausedCount;

    if (!vm.is_staff) {
        vm.loading = false;
        return;
    }

    load();

    function load() {
        vm.loading = true;
        ClubService.GetRenewalsPaused().then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Load Clubs', (data && data.message && data.message.message) || (data && data.message) || 'Please refresh and try again.');
                return;
            }
            vm.clubs    = angular.isArray(data.clubs) ? data.clubs : [];
            vm.disabled = !!parseInt(data.disabled, 10);
            vm.migrated = !!parseInt(data.migrated, 10);
            vm.ddDisabled = !!parseInt(data.dd_disabled, 10);
            vm.ddMigrated = !!parseInt(data.dd_migrated, 10);
        });
    }

    function matches(club) {
        var q = (vm.search || '').toLowerCase().trim();
        if (!q) { return true; }
        return String(club.title || '').toLowerCase().indexOf(q) !== -1 || String(club.id) === q;
    }

    function pausedCount() {
        var n = 0;
        angular.forEach(vm.clubs, function (c) { if (parseInt(c.renewals_paused, 10) === 1) { n++; } });
        return n;
    }

    function ddPausedCount() {
        var n = 0;
        angular.forEach(vm.clubs, function (c) { if (parseInt(c.dd_collection_paused, 10) === 1) { n++; } });
        return n;
    }

    function runToggle() {
        if (!vm.confirm || vm.saving) { return; }
        if (vm.confirm.kind === 'dd') { return runDdToggle(); }
        var club = vm.confirm.club;
        var paused = vm.confirm.paused;
        vm.saving = true;
        ClubService.SetRenewalsPaused(club.id, paused).then(function (data) {
            vm.saving = false;
            vm.confirm = null;
            if (!data || data.success === false) {
                ToastService.error('Could Not Save', (data && data.message && data.message.message) || (data && data.message) || 'Please try again.');
                return;
            }
            club.renewals_paused         = parseInt(data.renewals_paused, 10) || 0;
            club.renewals_paused_at      = data.renewals_paused_at;
            club.renewals_paused_by_name = data.renewals_paused_by_name;
            ToastService.success(paused ? 'Renewals Paused' : 'Renewals Resumed',
                club.title + (paused ? ': nobody will be charged automatically.' : ': automatic renewals run again.'), { confetti: false });
        });
    }

    function runDdToggle() {
        var club = vm.confirm.club;
        var paused = vm.confirm.paused;
        vm.saving = true;
        ClubService.SetDdCollectionPaused(club.id, paused).then(function (data) {
            vm.saving = false;
            vm.confirm = null;
            if (!data || data.success === false) {
                ToastService.error('Could Not Save', (data && data.message && data.message.message) || (data && data.message) || 'Please try again.');
                return;
            }
            club.dd_collection_paused         = parseInt(data.dd_collection_paused, 10) || 0;
            club.dd_collection_paused_at      = data.dd_collection_paused_at;
            club.dd_collection_paused_by_name = data.dd_collection_paused_by_name;
            ToastService.success(paused ? 'Collection Paused' : 'Collection Resumed',
                club.title + (paused ? ': no Direct Debit is collected until it is resumed.' : ': the Direct Debit collection runs again.'), { confetti: false });
        });
    }
}
