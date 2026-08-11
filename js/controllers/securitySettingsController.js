// ═══════════════════════════════════════════════════════════════════
//  SecuritySettingsController
//  My Account → Security — two-factor authentication (TOTP) and
//  passkeys (biometric / device sign-in). All secrets (TOTP secret,
//  recovery codes) are shown exactly once by the modals in
//  securityModalControllers.js — this screen only ever sees status.
//  Also hosts the enrolment lock: when login2 returned
//  two_factor_setup_required, the route guard in app.js pins the user
//  here until they enable 2FA or add a passkey.
//  Backend contract: FRONTEND_TWO_FACTOR_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.controller('SecuritySettingsController', SecuritySettingsController);

SecuritySettingsController.$inject = ['TwoFactorService', 'WebauthnService', 'ToastService',
                                      '$rootScope', '$uibModal'];
function SecuritySettingsController(TwoFactorService, WebauthnService, ToastService,
                                    $rootScope, $uibModal) {
    var vm = this;

    vm.user = $rootScope.globals.currentUser;

    vm.loading = true;
    vm.status = null;              // {enabled, pending_confirmation, confirmed_at, recovery_codes_remaining, passkey_count, club_requires_two_factor}
    vm.passkeys = [];
    vm.passkeySupported = WebauthnService.isSupported();
    vm.setupRequired = false;      // club mandates 2FA and the user has nothing yet

    // MySQL datetimes ('YYYY-MM-DD HH:mm:ss') — Angular's date filter can't
    // parse them, so format via moment (global).
    vm.fmtDate = function (s) { return s ? moment(s).format('D MMM YYYY') : ''; };

    vm.openEnable     = openEnable;
    vm.openDisable    = openDisable;
    vm.openRegenerate = openRegenerate;
    vm.addPasskey     = addPasskey;
    vm.renamePasskey  = renamePasskey;
    vm.deletePasskey  = deletePasskey;

    load();

    function load() {
        vm.loading = true;
        TwoFactorService.GetStatus().then(function (data) {
            if (!data || data.success === false) {
                vm.loading = false;
                ToastService.error('Could Not Load Security Settings',
                    (data && data.message) || 'Please refresh and try again.');
                return;
            }
            vm.status = data;
            refreshSetupRequired();

            if (!vm.passkeySupported) {
                vm.loading = false;
                return;
            }
            WebauthnService.List().then(function (res) {
                vm.loading = false;
                vm.passkeys = (res && res.credentials) || [];
            });
        });
    }

    // The lock flag is set at login. Clear it as soon as the account actually
    // has a second factor (enrolled here, or reset/enrolled elsewhere).
    function refreshSetupRequired() {
        var flag = null;
        try { flag = localStorage.getItem('toaviate_2fa_setup_required'); } catch(e) {}
        var flagged = flag && String(vm.user.id) === flag;
        var hasFactor = vm.status && (vm.status.enabled || vm.status.passkey_count > 0);
        if (flagged && hasFactor) {
            clearSetupFlag();
            flagged = false;
        }
        vm.setupRequired = !!flagged;
    }

    function clearSetupFlag() {
        try { localStorage.removeItem('toaviate_2fa_setup_required'); } catch(e) {}
    }

    // ── Two-factor (TOTP) ──

    function openEnable() {
        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/security_two_factor_enable.html',
            controller: 'TwoFactorEnableModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static',
            keyboard: false
        }).result.then(function (enabled) {
            if (enabled) {
                clearSetupFlag();
                ToastService.success('Two-Factor Enabled',
                    'Your account is now protected. You will be asked for a code at every login.');
                load();
            }
        }, function () {});
    }

    function openDisable() {
        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/security_two_factor_disable.html',
            controller: 'TwoFactorDisableModalCtrl',
            controllerAs: 'vm'
        }).result.then(function (disabled) {
            if (disabled) {
                ToastService.success('Two-Factor Disabled',
                    'Codes are no longer required at login.');
                load();
            }
        }, function () {});
    }

    function openRegenerate() {
        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/security_recovery_codes.html',
            controller: 'RecoveryCodesModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static',
            keyboard: false
        }).result.then(function (regenerated) {
            if (regenerated) { load(); }
        }, function () {});
    }

    // ── Passkeys ──

    function addPasskey() {
        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/security_passkey_add.html',
            controller: 'PasskeyAddModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static'
        }).result.then(function (added) {
            if (added) {
                clearSetupFlag();
                ToastService.success('Passkey Added',
                    'You can now sign in with this device\'s biometrics or PIN.');
                load();
            }
        }, function () {});
    }

    function renamePasskey(passkey) {
        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/security_passkey_rename.html',
            controller: 'PasskeyRenameModalCtrl',
            controllerAs: 'vm',
            resolve: { passkey: function () { return passkey; } }
        }).result.then(function (renamed) {
            if (renamed) { load(); }
        }, function () {});
    }

    function deletePasskey(passkey) {
        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/security_passkey_delete.html',
            controller: 'PasskeyDeleteModalCtrl',
            controllerAs: 'vm',
            resolve: { passkey: function () { return passkey; } }
        }).result.then(function (removed) {
            if (removed) {
                ToastService.success('Passkey Removed', 'That passkey can no longer be used to sign in.');
                load();
            }
        }, function () {});
    }
}
