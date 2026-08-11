// ═══════════════════════════════════════════════════════════════════
//  SuperAdminSecurityController
//  ToAviate super-admin — Account Security tools:
//    · per-club "require two-factor" toggle
//        GET/PUT two_factor/club_requirement/{club_id}
//    · lockout reset for users who lost phone + recovery codes
//        POST two_factor/admin_reset/{user_id} {reset_passkeys:0|1}
//  Backend is authoritative (non-staff get 403); the @toaviate.com
//  gate here is UX only, same as PlatformKeysController.
//  Backend contract: FRONTEND_TWO_FACTOR_GUIDE.md §4
// ═══════════════════════════════════════════════════════════════════

app.controller('SuperAdminSecurityController', SuperAdminSecurityController);

SuperAdminSecurityController.$inject = ['TwoFactorService', 'ClubService', 'UserService',
                                        'ToastService', '$rootScope'];
function SuperAdminSecurityController(TwoFactorService, ClubService, UserService,
                                      ToastService, $rootScope) {
    var vm = this;

    // ── Access gate — ToAviate platform staff only (backend is authoritative) ──
    vm.user     = $rootScope.globals.currentUser;
    vm.is_staff = $rootScope.isToAviateStaff();

    vm.loading = true;

    // Club requirement toggle
    vm.clubs = [];
    vm.selectedClub = null;
    vm.requirement = null;         // {require_two_factor: 0|1}
    vm.requirementLoading = false;
    vm.requirementSaving = false;
    vm.loadRequirement = loadRequirement;
    vm.toggleRequirement = toggleRequirement;

    // Lockout reset
    vm.lookupId = '';
    vm.lookupBusy = false;
    vm.foundUser = null;
    vm.resetConfirm = null;        // {reset_passkeys: 0|1} pending inline confirmation
    vm.resetBusy = false;
    vm.lookupUser = lookupUser;
    vm.askReset = function (withPasskeys) { vm.resetConfirm = { reset_passkeys: withPasskeys ? 1 : 0 }; };
    vm.cancelReset = function () { vm.resetConfirm = null; };
    vm.runReset = runReset;

    if (!vm.is_staff) {
        vm.loading = false;
        return;
    }

    loadClubs();

    function loadClubs() {
        ClubService.GetAll().then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Load Clubs', (data && data.message) || 'Please refresh and try again.');
                return;
            }
            vm.clubs = data.clubs || (angular.isArray(data) ? data : []);
        });
    }

    // ── Club requirement ──

    function loadRequirement() {
        vm.requirement = null;
        if (!vm.selectedClub) { return; }
        vm.requirementLoading = true;
        TwoFactorService.GetClubRequirement(vm.selectedClub.id).then(function (data) {
            vm.requirementLoading = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Load Setting', (data && data.message) || 'Please try again.');
                return;
            }
            vm.requirement = { require_two_factor: parseInt(data.require_two_factor, 10) || 0 };
        });
    }

    function toggleRequirement() {
        if (!vm.selectedClub || !vm.requirement || vm.requirementSaving) { return; }
        var next = vm.requirement.require_two_factor ? 0 : 1;
        vm.requirementSaving = true;
        TwoFactorService.SetClubRequirement(vm.selectedClub.id, next).then(function (data) {
            vm.requirementSaving = false;
            if (data && data.success !== false) {
                vm.requirement.require_two_factor = next;
                ToastService.success(next ? 'Two-Factor Now Required' : 'Two-Factor Now Optional',
                    (vm.selectedClub.name || 'This club') + (next ?
                        ' members without 2FA or a passkey will be pushed into setup at their next login.' :
                        ' members can now use 2FA optionally.'));
            } else {
                ToastService.error('Could Not Save', (data && data.message) || 'Please try again.');
            }
        });
    }

    // ── Lockout reset ──

    function lookupUser() {
        var id = (vm.lookupId || '').toString().trim();
        vm.foundUser = null;
        vm.resetConfirm = null;
        if (!id) {
            ToastService.highlightField('sa-sec-user-id');
            ToastService.warning('User ID Required', 'Enter the numeric user ID to look up.');
            return;
        }
        vm.lookupBusy = true;
        UserService.GetById(id).then(function (data) {
            vm.lookupBusy = false;
            var user = data && (data.user || (data.id ? data : null));
            if (user && user.id) {
                vm.foundUser = user;
            } else {
                ToastService.error('User Not Found', (data && data.message) || 'No user with that ID.');
            }
        });
    }

    function runReset() {
        if (!vm.foundUser || !vm.resetConfirm || vm.resetBusy) { return; }
        var withPasskeys = vm.resetConfirm.reset_passkeys;
        vm.resetBusy = true;
        TwoFactorService.AdminReset(vm.foundUser.id, withPasskeys).then(function (data) {
            vm.resetBusy = false;
            vm.resetConfirm = null;
            if (data && data.success !== false) {
                ToastService.success('Security Reset Complete',
                    'TOTP enrolment wiped' + (withPasskeys ? ' along with all passkeys' : '') +
                    ' for ' + (vm.foundUser.first_name || '') + ' ' + (vm.foundUser.last_name || '') +
                    '. They can sign in with just their password now.');
            } else {
                ToastService.error('Reset Failed', (data && data.message) || 'Please try again.');
            }
        });
    }
}
