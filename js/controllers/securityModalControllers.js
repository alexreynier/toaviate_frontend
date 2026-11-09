// ═══════════════════════════════════════════════════════════════════
//  Security modals — My Account → Security
//    TwoFactorEnableModalCtrl   3-step enrolment: password → scan QR +
//                               confirm code → recovery codes (show-once)
//    TwoFactorDisableModalCtrl  what changes, then a step-up (password + second step) to disable
//    RecoveryCodesModalCtrl     regenerate recovery codes (show-once)
//    PasskeyAddModalCtrl        password re-auth → browser ceremony → label
//    PasskeyRenameModalCtrl     rename a passkey
//    PasskeyDeleteModalCtrl     password re-auth to remove a passkey
//  Secrets are shown exactly once — the show-once modals use
//  backdrop:'static' so they can't be dismissed accidentally.
//  Backend contract: FRONTEND_TWO_FACTOR_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

// ── Shared helpers (file-local, prefixed to avoid concat collisions) ──

function secCopyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { secCopyFallback(text, done); });
    } else {
        secCopyFallback(text, done);
    }
}

function secCopyFallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done();
}

function secDownloadCodes(codes, filename) {
    var content = 'ToAviate two-factor recovery codes\n' +
                  'Each code works exactly once. Keep them somewhere safe.\n\n' +
                  codes.join('\n') + '\n';
    var blob = new Blob([content], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}


// ═══ Enable 2FA — 3-step wizard ═══

app.controller('TwoFactorEnableModalCtrl', TwoFactorEnableModalCtrl);

TwoFactorEnableModalCtrl.$inject = ['$uibModalInstance', 'TwoFactorService', 'ToastService', '$timeout'];
function TwoFactorEnableModalCtrl($uibModalInstance, TwoFactorService, ToastService, $timeout) {
    var vm = this;

    vm.step = 'password';          // 'password' → 'scan' → 'codes'
    vm.busy = false;
    vm.password = '';
    vm.code = '';
    vm.secret = null;
    vm.qrDataUrl = null;
    vm.recovery_codes = [];
    vm.codesSaved = false;         // user must tick before finishing
    vm.copied = false;
    vm.copiedSecret = false;

    vm.submitPassword = submitPassword;
    vm.submitCode     = submitCode;
    vm.copySecret     = copySecret;
    vm.copyCodes      = copyCodes;
    vm.downloadCodes  = function () { secDownloadCodes(vm.recovery_codes, 'toaviate-recovery-codes.txt'); };
    vm.done           = function () { $uibModalInstance.close(true); };
    vm.cancel         = function () { $uibModalInstance.dismiss('cancel'); };

    function submitPassword() {
        if (!vm.password) {
            ToastService.highlightField('tfa-enable-password');
            ToastService.warning('Password Required', 'Confirm your password to set up two-factor authentication.');
            return;
        }
        vm.busy = true;
        TwoFactorService.Setup(vm.password).then(function (data) {
            vm.busy = false;
            if (data && data.success !== false && data.otpauth_uri) {
                vm.secret = data.secret;
                vm.qrDataUrl = makeQr(data.otpauth_uri);
                vm.step = 'scan';
                $timeout(function () {
                    var el = document.getElementById('tfa-enable-code');
                    if (el) { el.focus(); }
                }, 100);
            } else if (data && data.error === 'WRONG_PASSWORD') {
                ToastService.highlightField('tfa-enable-password');
                ToastService.error('Wrong Password', 'That password was not recognised. Please try again.');
            } else {
                ToastService.error('Setup Failed', (data && data.message) || 'Please try again.');
            }
        });
    }

    function submitCode() {
        var code = (vm.code || '').trim();
        if (!code) {
            ToastService.highlightField('tfa-enable-code');
            ToastService.warning('Code Required', 'Enter the 6-digit code from your authenticator app.');
            return;
        }
        vm.busy = true;
        TwoFactorService.Confirm(code).then(function (data) {
            vm.busy = false;
            if (data && data.success && data.recovery_codes) {
                vm.recovery_codes = data.recovery_codes;
                vm.step = 'codes';
            } else if (data && data.error === 'WRONG_CODE') {
                vm.code = '';
                ToastService.highlightField('tfa-enable-code');
                ToastService.error('Wrong Code', 'That code did not match. Check your authenticator app and try again.');
            } else if (data && data.error === 'TOO_MANY_ATTEMPTS') {
                ToastService.error('Too Many Attempts', 'Please wait a while, then restart the setup.');
                $uibModalInstance.dismiss('cancel');
            } else {
                ToastService.error('Confirmation Failed', (data && data.message) || 'Please try again.');
            }
        });
    }

    // Rendered locally — the secret never leaves the page.
    function makeQr(uri) {
        try {
            if (typeof qrcode === 'undefined') { return null; }
            var qr = qrcode(0, 'M');
            qr.addData(uri);
            qr.make();
            return qr.createDataURL(6, 12);
        } catch (e) {
            console.log('QR render failed:', e);
            return null;      // manual-entry secret is still shown
        }
    }

    function copySecret() {
        secCopyText(vm.secret, function () {
            $timeout(function () { vm.copiedSecret = true; });
            $timeout(function () { vm.copiedSecret = false; }, 2000);
        });
    }

    function copyCodes() {
        secCopyText(vm.recovery_codes.join('\n'), function () {
            $timeout(function () { vm.copied = true; });
            $timeout(function () { vm.copied = false; }, 2000);
        });
    }
}


// ═══ Disable 2FA ═══

app.controller('TwoFactorDisableModalCtrl', TwoFactorDisableModalCtrl);

TwoFactorDisableModalCtrl.$inject = ['$uibModalInstance', 'TwoFactorService', 'StepUpService', 'ToastService'];
function TwoFactorDisableModalCtrl($uibModalInstance, TwoFactorService, StepUpService, ToastService) {
    var vm = this;

    vm.busy = false;
    vm.clubRequires = false;       // set when the backend refuses with CLUB_REQUIRES_2FA

    vm.submit = submit;
    vm.cancel = function () { $uibModalInstance.dismiss('cancel'); };

    // C22 (9 Nov 2026): turning two-factor off needs a step-up (purpose two_factor_off) — the password AND the
    // member's second step. POST two_factor/disable {step_up_token}; a password or code alone answers STEP_UP_REQUIRED
    // (StepUpService.Run re-asks once on that).
    function submit() {
        if (vm.busy) { return; }
        vm.busy = true;
        StepUpService.Run({
            purpose: 'two_factor_off',
            title: 'Turn off two-factor',
            text: 'Because this removes a layer of protection, we check your password and your second step.'
        }, function (token) {
            return TwoFactorService.Disable({ step_up_token: token });
        }).then(function (data) {
            vm.busy = false;
            if (data && data.success) {
                $uibModalInstance.close(true);
            } else if (data && data.error === 'CANCELLED') {
                return;                                    // closed the step-up — stay here, quietly
            } else if (data && data.error === 'CLUB_REQUIRES_2FA') {
                vm.clubRequires = true;
            } else if (data && data.error === 'TOO_MANY_ATTEMPTS') {
                ToastService.error('Too Many Attempts', 'Wait a while before trying again.');
            } else {
                var msg = data && typeof data.message === 'string' && data.message.length < 240 && data.message.indexOf('<') === -1 ? data.message : '';
                ToastService.error('Could Not Disable', msg || 'Please try again.');
            }
        });
    }
}


// ═══ Regenerate recovery codes ═══

app.controller('RecoveryCodesModalCtrl', RecoveryCodesModalCtrl);

RecoveryCodesModalCtrl.$inject = ['$uibModalInstance', 'TwoFactorService', 'ToastService', '$timeout'];
function RecoveryCodesModalCtrl($uibModalInstance, TwoFactorService, ToastService, $timeout) {
    var vm = this;

    vm.step = 'password';          // 'password' → 'codes'
    vm.busy = false;
    vm.password = '';
    vm.recovery_codes = [];
    vm.codesSaved = false;
    vm.copied = false;

    vm.submit        = submit;
    vm.copyCodes     = copyCodes;
    vm.downloadCodes = function () { secDownloadCodes(vm.recovery_codes, 'toaviate-recovery-codes.txt'); };
    vm.done          = function () { $uibModalInstance.close(true); };
    vm.cancel        = function () { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        if (!vm.password) {
            ToastService.highlightField('recovery-password');
            ToastService.warning('Password Required', 'Confirm your password to generate new recovery codes.');
            return;
        }
        vm.busy = true;
        TwoFactorService.RegenerateRecoveryCodes(vm.password).then(function (data) {
            vm.busy = false;
            if (data && data.recovery_codes) {
                vm.recovery_codes = data.recovery_codes;
                vm.step = 'codes';
            } else if (data && data.error === 'WRONG_PASSWORD') {
                ToastService.highlightField('recovery-password');
                ToastService.error('Wrong Password', 'That password was not recognised. Please try again.');
            } else {
                ToastService.error('Could Not Generate Codes', (data && data.message) || 'Please try again.');
            }
        });
    }

    function copyCodes() {
        secCopyText(vm.recovery_codes.join('\n'), function () {
            $timeout(function () { vm.copied = true; });
            $timeout(function () { vm.copied = false; }, 2000);
        });
    }
}


// ═══ Add passkey ═══

app.controller('PasskeyAddModalCtrl', PasskeyAddModalCtrl);

PasskeyAddModalCtrl.$inject = ['$uibModalInstance', 'WebauthnService', 'ToastService'];
function PasskeyAddModalCtrl($uibModalInstance, WebauthnService, ToastService) {
    var vm = this;

    vm.busy = false;
    vm.waiting = false;            // browser prompt is up
    vm.password = '';
    vm.label = '';

    vm.submit = submit;
    vm.cancel = function () { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        if (!vm.password) {
            ToastService.highlightField('passkey-add-password');
            ToastService.warning('Password Required', 'Confirm your password to add a passkey.');
            return;
        }
        vm.busy = true;
        vm.waiting = true;
        WebauthnService.Register(vm.password, (vm.label || '').trim()).then(function (data) {
            vm.busy = false;
            vm.waiting = false;
            if (data && data.success) {
                $uibModalInstance.close(true);
            } else if (data && data.error === 'WRONG_PASSWORD') {
                ToastService.highlightField('passkey-add-password');
                ToastService.error('Wrong Password', 'That password was not recognised. Please try again.');
            } else if (data && data.error === 'CEREMONY_CANCELLED') {
                // user dismissed the browser prompt — stay open, no toast
            } else if (data && data.error === 'ALREADY_REGISTERED') {
                ToastService.warning('Already Registered', 'This device already has a passkey for your account.');
            } else if (data && data.error === 'CHALLENGE_EXPIRED') {
                ToastService.warning('Timed Out', 'The prompt expired — please try again.');
            } else {
                ToastService.error('Could Not Add Passkey', (data && data.message) || 'Please try again.');
            }
        });
    }
}


// ═══ Rename passkey ═══

app.controller('PasskeyRenameModalCtrl', PasskeyRenameModalCtrl);

PasskeyRenameModalCtrl.$inject = ['$uibModalInstance', 'WebauthnService', 'ToastService', 'passkey'];
function PasskeyRenameModalCtrl($uibModalInstance, WebauthnService, ToastService, passkey) {
    var vm = this;

    vm.busy = false;
    vm.passkey = passkey;
    vm.label = passkey.label;

    vm.submit = submit;
    vm.cancel = function () { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        var label = (vm.label || '').trim();
        if (!label) {
            ToastService.highlightField('passkey-rename-label');
            ToastService.warning('Name Required', 'Give the passkey a name (e.g. "Alex\'s iPhone").');
            return;
        }
        vm.busy = true;
        WebauthnService.Rename(vm.passkey.id, label).then(function (data) {
            vm.busy = false;
            if (data && data.success !== false) {
                $uibModalInstance.close(true);
            } else {
                ToastService.error('Could Not Rename', (data && data.message) || 'Please try again.');
            }
        });
    }
}


// ═══ Delete passkey ═══

app.controller('PasskeyDeleteModalCtrl', PasskeyDeleteModalCtrl);

PasskeyDeleteModalCtrl.$inject = ['$uibModalInstance', 'WebauthnService', 'ToastService', 'passkey'];
function PasskeyDeleteModalCtrl($uibModalInstance, WebauthnService, ToastService, passkey) {
    var vm = this;

    vm.busy = false;
    vm.passkey = passkey;
    vm.password = '';

    vm.submit = submit;
    vm.cancel = function () { $uibModalInstance.dismiss('cancel'); };

    function submit() {
        if (!vm.password) {
            ToastService.highlightField('passkey-delete-password');
            ToastService.warning('Password Required', 'Confirm your password to remove this passkey.');
            return;
        }
        vm.busy = true;
        WebauthnService.Remove(vm.passkey.id, vm.password).then(function (data) {
            vm.busy = false;
            if (data && data.success !== false) {
                $uibModalInstance.close(true);
            } else if (data && data.error === 'WRONG_PASSWORD') {
                ToastService.highlightField('passkey-delete-password');
                ToastService.error('Wrong Password', 'That password was not recognised. Please try again.');
            } else {
                ToastService.error('Could Not Remove', (data && data.message) || 'Please try again.');
            }
        });
    }
}


// ═══ Public: "STOP THIS RESET" (/two_factor_reset_cancel/:token) ═══
//  C22 (9 Nov 2026). A ToAviate administrator asked to reset the member's two-factor; the member's e-mail carries a
//  stop link. No session, no app chrome — like /email_cancel (EmailCancelController): GET only SHOWS who / when /
//  until when; the reset is stopped only by the explicit POST behind the button (mail scanners prefetch links).
//  Every failure is the backend's uniform 404 → the one "invalid or expired" panel. The API prefix is in the
//  interceptor's unauthEndpoints, the state in publicStates + publicPages (js/app.js).
//  Kept in this file (loaded on every page) so the public page needs no new <script> tag.

app.controller('TwoFactorResetCancelController', TwoFactorResetCancelController);

TwoFactorResetCancelController.$inject = ['$stateParams', 'TwoFactorService'];
function TwoFactorResetCancelController($stateParams, TwoFactorService) {
    var vm = this;
    var token = $stateParams.token;

    vm.state = 'loading';       // loading | summary | done | invalid
    vm.firstName = '';
    vm.requestedLabel = '';
    vm.holdLabel = '';
    vm.busy = false;
    vm.stop = stop;

    load();

    function load() {
        if (!token) { vm.state = 'invalid'; return; }
        TwoFactorService.ResetCancelGet(token).then(function (data) {
            if (!data || data.success === false) { vm.state = 'invalid'; return; }
            vm.firstName = data.first_name || '';
            vm.requestedLabel = label(data.requested_at);
            vm.holdLabel = label(data.hold_until);
            vm.state = 'summary';
        });
    }

    function stop() {
        if (vm.busy) { return; }
        vm.busy = true;
        TwoFactorService.ResetCancelPost(token).then(function (data) {
            vm.busy = false;
            vm.state = (data && data.success !== false) ? 'done' : 'invalid';
        });
    }

    // the API's times are UTC — shown in the reader's own time ("Mon 9 Nov 2026, 14:05")
    function label(value) {
        if (!value) { return ''; }
        if (typeof moment === 'function') {
            var m = moment.utc(String(value), 'YYYY-MM-DD HH:mm:ss');
            if (m.isValid()) { return m.local().format('ddd D MMM YYYY, HH:mm'); }
        }
        return String(value) + ' UTC';
    }
}
