// ═══════════════════════════════════════════════════════════════════
//  EmailCancelController — public "this wasn't me" / recovery veto page.
//  /email_cancel/:token — the link in the warning email sent to the
//  CURRENT addresses when a recovery case is opened. GET only SHOWS the
//  summary (masked new address + when the case was opened); the request
//  is cancelled by an explicit POST from the button — mail scanners
//  prefetch links, so the GET must never act.
//  MUST work with no session: no $rootScope.globals access here, and the
//  account_email_confirm endpoints are exempted from the auth interceptor.
//  ANY failure renders the one uniform "invalid or expired" panel — never
//  detail (the backend 404s uniformly too).
//  Backend contract: FRONTEND_ACCOUNT_EMAILS_GUIDE.md §2.3 / §7
// ═══════════════════════════════════════════════════════════════════

app.controller('EmailCancelController', EmailCancelController);

EmailCancelController.$inject = ['$stateParams', 'AccountEmailsService'];
function EmailCancelController($stateParams, AccountEmailsService) {
    var vm = this;

    var token = $stateParams.token;

    vm.state = 'loading';       // loading | summary | done | invalid
    vm.new_email_masked = '';
    vm.openedAtLabel = '';

    vm.busy = false;

    vm.cancelRequest = cancelRequest;

    load();

    function load() {
        if (!token) {
            vm.state = 'invalid';
            return;
        }
        AccountEmailsService.CancelGet(token).then(function(data) {
            if (!data || data.success === false) {
                vm.state = 'invalid';
                return;
            }
            vm.new_email_masked = data.new_email_masked || '';
            vm.openedAtLabel = formatOpenedAt(data.opened_at);
            vm.state = 'summary';
        });
    }

    function cancelRequest() {
        if (vm.busy) { return; }
        vm.busy = true;
        AccountEmailsService.CancelPost(token).then(function(data) {
            vm.busy = false;
            if (data && data.success !== false) {
                vm.state = 'done';
                return;
            }
            vm.state = 'invalid';
        });
    }

    // "opened 26 Oct 2026, 14:05" — moment is loaded globally; fall back to
    // the raw string if it can't be parsed so the line is never blank.
    function formatOpenedAt(value) {
        if (!value) { return ''; }
        if (typeof moment === 'function') {
            var m = moment(value);
            if (m.isValid()) { return m.format('D MMM YYYY, HH:mm'); }
        }
        return String(value);
    }
}
