// ═══════════════════════════════════════════════════════════════════
//  StepUpModalController — views/modals/step_up.html
//  Reusable re-authentication modal opened by StepUpService.RequireToken
//  / StepUpService.Run. Resolves (closes) with the step_up_token string;
//  dismisses on cancel.
//
//  Stages:
//    'password'  confirm password → StepUpService.Start
//    'factor'    second factor, by the start response's `method`:
//                  totp        6-digit code (or a recovery code via the link)
//                  email_code  6-digit code sent to a verified address,
//                              optional "send to a different address" +
//                              "resend" (45 s cooldown)
//                  passkey     "Use your passkey" → navigator.credentials.get
//                              with the start response's publicKey → Verify
//                              {credential}. No code fallback — the backend
//                              chose passkey because the account has one.
//    close(step_up_token) on success.
//
//  Errors stay inline (the modal is the single voice here): WRONG_PASSWORD,
//  WRONG_CODE (+ attempts_remaining), RATE_LIMITED; EXPIRED drops back to
//  the password stage with a note; TOO_MANY_ATTEMPTS shows a message and
//  dismisses after 2.5 s. The password is cleared whenever the modal closes.
//
//  The busy guard already locks the pressed button during the POST —
//  vm.busy only drives the button label / spinner.
//  Backend contract: BACKEND_ACCOUNT_EMAILS_PLAN.md §5.1
// ═══════════════════════════════════════════════════════════════════

// ── File-local WebAuthn helpers (prefixed to avoid concat collisions).
//    Mirror the private b64u / fromB64u / prepRequestOptions in
//    webauthnService.js — the credential shape sent to step_up/verify is
//    identical to the one WebauthnService.Login sends to webauthn/login_verify.

function stepUpB64u(buf) {
    var bytes = new Uint8Array(buf);
    var str = '';
    for (var i = 0; i < bytes.length; i++) { str += String.fromCharCode(bytes[i]); }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stepUpFromB64u(s) {
    var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return bytes.buffer;
}

// navigator.credentials.get() options — challenge + allowCredentials ids
function stepUpPrepRequestOptions(publicKey) {
    var pk = angular.copy(publicKey);
    pk.challenge = stepUpFromB64u(pk.challenge);
    if (pk.allowCredentials) {
        for (var i = 0; i < pk.allowCredentials.length; i++) {
            pk.allowCredentials[i].id = stepUpFromB64u(pk.allowCredentials[i].id);
        }
    }
    return pk;
}


app.controller('StepUpModalController', StepUpModalController);

StepUpModalController.$inject = ['$scope', '$uibModalInstance', '$timeout', 'StepUpService', 'WebauthnService', 'ToastService', 'opts'];
function StepUpModalController($scope, $uibModalInstance, $timeout, StepUpService, WebauthnService, ToastService, opts) {
    var vm = this;

    var RESEND_COOLDOWN = 45;          // seconds
    var DISMISS_AFTER_LOCKOUT = 2500;  // ms

    vm.opts    = opts || {};
    vm.purpose = vm.opts.purpose || 'account_emails';
    vm.title   = vm.opts.title || 'Confirm it\'s you';
    vm.text    = vm.opts.text  || 'For your security, confirm your password to continue.';

    vm.stage  = 'password';            // 'password' → 'factor'
    vm.method = null;                  // 'totp' | 'email_code' | 'passkey'
    vm.busy   = false;
    vm.waitingPasskey = false;         // browser prompt is up
    vm.passkeySupported = WebauthnService.isSupported();

    vm.password     = '';
    vm.code         = '';
    vm.recoveryCode = '';
    vm.useRecovery  = false;           // totp: recovery-code input instead of the 6-digit one

    vm.error = '';                     // inline error for the current stage
    vm.note  = '';                     // informational note (e.g. after EXPIRED)
    vm.attemptsRemaining = null;

    vm.stepUpKey    = null;
    vm.sentToMasked = '';
    vm.publicKey    = null;
    vm.deliverTo    = (vm.opts.deliverTo !== undefined) ? vm.opts.deliverTo : null;
    vm.addresses    = [];              // verified addresses the code can go to (email_code)
    vm.pickingAddress = false;
    vm.pickedAddress  = null;
    vm.resendWait   = 0;               // seconds left on the resend cooldown
    var resendTimer = null;
    var lockoutTimer = null;

    vm.submitPassword   = submitPassword;
    vm.submitCode       = submitCode;
    vm.usePasskey       = usePasskey;
    vm.toggleRecovery   = toggleRecovery;
    vm.showAddressPicker = showAddressPicker;
    vm.sendToAddress    = sendToAddress;
    vm.resend           = resend;
    vm.backToPassword   = backToPassword;
    vm.cancel           = cancel;

    // Clear the password however the modal goes away (close, dismiss, $destroy).
    $scope.$on('modal.closing', wipeSecrets);
    $scope.$on('$destroy', function () {
        wipeSecrets();
        if (resendTimer)  { $timeout.cancel(resendTimer); }
        if (lockoutTimer) { $timeout.cancel(lockoutTimer); }
    });

    // ── Stage 1 — password ──

    function submitPassword() {
        if (vm.busy) { return; }
        if (!vm.password) {
            vm.error = 'Please enter your password.';
            ToastService.highlightField('step-up-password');
            return;
        }
        vm.error = '';
        vm.note = '';
        start(vm.deliverTo);
    }

    // Shared by the first submit, "send to a different address" and "resend".
    function start(deliverTo) {
        vm.busy = true;
        StepUpService.Start(vm.password, vm.purpose, deliverTo).then(function (data) {
            vm.busy = false;
            if (data && data.success && data.step_up_key) {
                vm.stepUpKey    = data.step_up_key;
                vm.method       = data.method;
                vm.sentToMasked = data.sent_to_masked || '';
                vm.publicKey    = data.publicKey || null;
                vm.challengeKey = data.challenge_key || null;   // passkey: echoed back on verify
                vm.attemptsRemaining = null;
                vm.code = '';
                vm.recoveryCode = '';
                vm.useRecovery = false;
                vm.pickingAddress = false;
                vm.pickedAddress = null;
                vm.error = '';
                // "Send to a different address" only when there is a choice:
                // the start response's `addresses` wins, else whatever the
                // caller passed in opts.alternatives / opts.addresses.
                var list = angular.isArray(data.verified_addresses) ? data.verified_addresses
                         : (angular.isArray(data.addresses) ? data.addresses
                         : (vm.opts.alternatives || vm.opts.addresses || []));
                vm.addresses = angular.isArray(list) ? list : [];
                vm.stage = 'factor';
                if (vm.method === 'email_code') { startResendCooldown(); }
                focusLater(codeInputId());
            } else if (data && data.error === 'WRONG_PASSWORD') {
                vm.error = 'That password was not recognised. Please try again.';
                vm.password = '';
                ToastService.highlightField('step-up-password');
            } else if (data && data.error === 'TOO_MANY_ATTEMPTS') {
                lockout();
            } else if (data && data.error === 'RATE_LIMITED') {
                vm.error = 'Please wait a moment before trying again.';
            } else {
                vm.error = (data && data.message) || 'Could not verify your password. Please try again.';
            }
        });
    }

    // ── Stage 2 — factor ──

    function submitCode() {
        if (vm.busy) { return; }
        var payload;
        if (vm.method === 'totp' && vm.useRecovery) {
            var rc = (vm.recoveryCode || '').trim();
            if (!rc) {
                vm.error = 'Enter one of your recovery codes.';
                ToastService.highlightField('step-up-recovery');
                return;
            }
            payload = { type: 'recovery', code: rc };
        } else {
            var code = (vm.code || '').replace(/\s+/g, '');
            if (!code) {
                vm.error = 'Enter the 6-digit code.';
                ToastService.highlightField(codeInputId() || 'step-up-code');
                return;
            }
            payload = { code: code };
        }
        verify(payload);
    }

    function verify(payload) {
        vm.busy = true;
        vm.error = '';
        return StepUpService.Verify(vm.stepUpKey, payload).then(function (data) {
            vm.busy = false;
            vm.waitingPasskey = false;
            if (data && data.success && data.step_up_token) {
                $uibModalInstance.close(data.step_up_token);
                return true;
            }
            if (data && data.error === 'WRONG_CODE') {
                vm.attemptsRemaining = (data.attempts_remaining !== undefined && data.attempts_remaining !== null)
                    ? data.attempts_remaining : null;
                vm.error = (vm.attemptsRemaining !== null)
                    ? 'Wrong code — ' + vm.attemptsRemaining + ' attempt' + (vm.attemptsRemaining == 1 ? '' : 's') + ' remaining'
                    : 'Wrong code — please try again.';
                vm.code = '';
                vm.recoveryCode = '';
                focusLater(codeInputId());
            } else if (data && data.error === 'EXPIRED') {
                backToPassword('That took too long — please confirm your password again.');
            } else if (data && data.error === 'TOO_MANY_ATTEMPTS') {
                lockout();
            } else if (data && data.error === 'RATE_LIMITED') {
                vm.error = 'Please wait a moment before trying again.';
            } else if (vm.method === 'passkey') {
                vm.error = 'Passkey didn\'t work — try again';
            } else {
                vm.error = (data && data.message) || 'Verification failed. Please try again.';
            }
            return false;
        });
    }

    // Passkey: browser ceremony with the publicKey from the start response,
    // then Verify with the same credential shape as webauthn/login_verify.
    function usePasskey() {
        if (vm.busy) { return; }
        if (!vm.passkeySupported) {
            vm.error = 'This browser doesn\'t support passkeys. Try another device or browser.';
            return;
        }
        if (!vm.publicKey) {
            vm.error = 'Passkey didn\'t work — try again';
            return;
        }
        var publicKey;
        try {
            publicKey = stepUpPrepRequestOptions(vm.publicKey);
        } catch (e) {
            console.log('Step-up passkey: bad publicKey options', e);
            vm.error = 'Passkey didn\'t work — try again';
            return;
        }
        vm.busy = true;
        vm.waitingPasskey = true;
        vm.error = '';
        navigator.credentials.get({ publicKey: publicKey }).then(function (cred) {
            // Back inside a digest via $timeout — this is a native promise.
            $timeout(function () {
                verify({
                    challenge_key: vm.challengeKey,
                    credential: {
                        id: cred.id,
                        response: {
                            clientDataJSON:    stepUpB64u(cred.response.clientDataJSON),
                            authenticatorData: stepUpB64u(cred.response.authenticatorData),
                            signature:         stepUpB64u(cred.response.signature),
                            userHandle:        cred.response.userHandle ? stepUpB64u(cred.response.userHandle) : null
                        }
                    }
                });
            });
        }, function (err) {
            console.log('Step-up passkey ceremony error:', err && err.name, err && err.message);
            $timeout(function () {
                vm.busy = false;
                vm.waitingPasskey = false;
                vm.error = 'Passkey didn\'t work — try again';
            });
        });
    }

    function toggleRecovery() {
        vm.useRecovery = !vm.useRecovery;
        vm.error = '';
        vm.code = '';
        vm.recoveryCode = '';
        focusLater(codeInputId());
    }

    // email_code — "Send to a different address"
    function showAddressPicker() {
        vm.pickingAddress = true;
        vm.pickedAddress = null;
        vm.error = '';
    }

    function sendToAddress() {
        if (vm.busy) { return; }
        if (!vm.pickedAddress) {
            vm.error = 'Choose an address first.';
            return;
        }
        vm.deliverTo = vm.pickedAddress.id;
        start(vm.deliverTo);          // fresh step_up_key for the new address
    }

    // email_code — "Resend code" (re-runs Start; 45 s cooldown)
    function resend() {
        if (vm.busy || vm.resendWait > 0) { return; }
        vm.note = '';
        start(vm.deliverTo);
    }

    function startResendCooldown() {
        if (resendTimer) { $timeout.cancel(resendTimer); }
        vm.resendWait = RESEND_COOLDOWN;
        tick();

        function tick() {
            if (vm.resendWait <= 0) { resendTimer = null; return; }
            resendTimer = $timeout(function () {
                vm.resendWait -= 1;
                tick();
            }, 1000);
        }
    }

    // ── Transitions ──

    function backToPassword(note) {
        vm.stage = 'password';
        vm.method = null;
        vm.stepUpKey = null;
        vm.publicKey = null;
        vm.code = '';
        vm.recoveryCode = '';
        vm.useRecovery = false;
        vm.pickingAddress = false;
        vm.waitingPasskey = false;
        vm.attemptsRemaining = null;
        vm.error = '';
        vm.note = note || '';
        vm.password = '';
        focusLater('step-up-password');
    }

    function lockout() {
        vm.error = 'Too many attempts — please wait a while before trying again.';
        vm.busy = true;               // nothing else can be pressed while we close
        lockoutTimer = $timeout(function () {
            $uibModalInstance.dismiss('too_many_attempts');
        }, DISMISS_AFTER_LOCKOUT);
    }

    function cancel() {
        wipeSecrets();
        $uibModalInstance.dismiss('cancel');
    }

    function wipeSecrets() {
        vm.password = '';
        vm.code = '';
        vm.recoveryCode = '';
    }

    // Which input to focus for the current factor / mode (null for passkey).
    function codeInputId() {
        if (vm.method === 'totp')       { return vm.useRecovery ? 'step-up-recovery' : 'step-up-code'; }
        if (vm.method === 'email_code') { return 'step-up-code-email'; }
        return null;
    }

    function focusLater(id) {
        if (!id) { return; }
        $timeout(function () {
            var el = document.getElementById(id);
            if (el) { el.focus(); }
        }, 120);
    }
}
