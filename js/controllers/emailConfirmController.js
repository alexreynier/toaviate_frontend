// ═══════════════════════════════════════════════════════════════════
//  EmailConfirmController — public "confirm this email address" page.
//  /email_confirm/:token — the link from the verification email. Works for
//  both kinds of token: 'add' (a second address on the user's account) and
//  'recovery' (a staff-opened recovery case moving the sign-in address).
//  GET only SHOWS the summary; the address is confirmed by an explicit
//  POST from the Confirm button — mail scanners prefetch links, so the GET
//  must never act. A recovery POST may come back with sms_required, in
//  which case a 6-digit code step is shown inline.
//  MUST work with no session: no $rootScope.globals access here, and the
//  account_email_confirm endpoints are exempted from the auth interceptor.
//  ANY failure renders the one uniform "invalid or expired" panel — never
//  detail (the backend 404s uniformly too).
//  Backend contract: FRONTEND_ACCOUNT_EMAILS_GUIDE.md §2.3 / §7
// ═══════════════════════════════════════════════════════════════════

app.controller('EmailConfirmController', EmailConfirmController);

EmailConfirmController.$inject = ['$stateParams', '$timeout', 'AccountEmailsService'];
function EmailConfirmController($stateParams, $timeout, AccountEmailsService) {
    var vm = this;

    var token = $stateParams.token;

    vm.state = 'loading';       // loading | summary | sms | done | invalid
    vm.kind = 'add';            // 'add' | 'recovery'
    vm.email_masked = '';
    vm.first_name = '';

    vm.busy = false;

    // SMS sub-step (recovery only)
    vm.code = '';
    vm.codeError = '';
    vm.attemptsRemaining = null;

    vm.confirmAddress = confirmAddress;
    vm.submitCode = submitCode;
    vm.codeLooksValid = codeLooksValid;

    load();

    function load() {
        if (!token) {
            vm.state = 'invalid';
            return;
        }
        AccountEmailsService.ConfirmGet(token).then(function(data) {
            if (!data || data.success === false) {
                vm.state = 'invalid';
                return;
            }
            vm.kind = data.kind === 'recovery' ? 'recovery' : 'add';
            vm.email_masked = data.email_masked || '';
            vm.first_name = data.first_name || '';
            vm.state = 'summary';
        });
    }

    function confirmAddress() {
        if (vm.busy) { return; }
        vm.busy = true;
        AccountEmailsService.ConfirmPost(token).then(function(data) {
            vm.busy = false;
            if (!data || data.success === false) {
                vm.state = 'invalid';
                return;
            }
            if (data.sms_required) {
                vm.code = '';
                vm.codeError = '';
                vm.attemptsRemaining = null;
                vm.state = 'sms';
                focusCode();
                return;
            }
            vm.state = 'done';
        });
    }

    function codeLooksValid() {
        return /^\d{6}$/.test(String(vm.code || '').trim());
    }

    function submitCode() {
        if (vm.busy) { return; }
        var code = String(vm.code || '').replace(/\s+/g, '');
        if (!/^\d{6}$/.test(code)) {
            vm.codeError = 'Enter the 6-digit code from the text message.';
            focusCode();
            return;
        }
        vm.codeError = '';
        vm.busy = true;
        AccountEmailsService.ConfirmSms(token, code).then(function(data) {
            vm.busy = false;
            // The backend answers a wrong code with success:true + sms_verified:false
            // + error:'WRONG_CODE' (the request itself succeeded) — only a verified
            // code is "done".
            if (data && data.success !== false && data.sms_verified !== false && !data.error) {
                vm.state = 'done';
                return;
            }
            if (data && data.error === 'WRONG_CODE') {
                var left = parseInt(data.attempts_remaining, 10);
                vm.attemptsRemaining = isNaN(left) ? null : left;
                if (vm.attemptsRemaining === 0) {
                    // No attempts left — the token is dead; same uniform panel.
                    vm.state = 'invalid';
                    return;
                }
                vm.codeError = "That code isn't right.";
                vm.code = '';
                focusCode();
                return;
            }
            // Anything else (expired, used, unknown) → the uniform panel.
            vm.state = 'invalid';
        });
    }

    function focusCode() {
        $timeout(function() {
            var el = document.getElementById('field-ec-code');
            if (el) { el.focus(); }
        }, 50);
    }
}
