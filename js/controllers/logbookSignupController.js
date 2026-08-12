// ═══════════════════════════════════════════════════════════════════
//  LogbookSignupController
//  PUBLIC growth-funnel pages (keyed by route data.screen):
//    'register' → /free_logbook — self-serve "get your free digital
//                 logbook" signup. NEUTRAL success: "check your email"
//                 always, even for emails that already have accounts.
//    'invite'   → /logbook_invite/:token — invite-link landing page,
//                 prefilled from the invite.
//  Backend contract: FRONTEND_LOGBOOK_SIGNUP_GUIDE.md §2 + §4
// ═══════════════════════════════════════════════════════════════════

app.controller('LogbookSignupController', LogbookSignupController);

LogbookSignupController.$inject = ['LogbookSignupService', 'ToastService', '$state', '$stateParams', '$location'];
function LogbookSignupController(LogbookSignupService, ToastService, $state, $stateParams, $location) {
    var vm = this;

    vm.screen = ($state.current.data && $state.current.data.screen) || 'register';
    vm.state = 'form';           // form | sent | ready | invalid  (+ loading for invite)
    vm.busy = false;
    vm.inviter = '';
    vm.emailLockedHint = false;  // invite: keeping the invited email skips verification

    vm.form = { first_name: '', last_name: '', email: '', password: '', password2: '' };

    vm.submit = submit;
    vm.goLogin = function() { $location.path('/login'); };

    if (vm.screen === 'invite') {
        vm.state = 'loading';
        LogbookSignupService.GetInvite($stateParams.token).then(function(data) {
            if (data && data.success !== false && (data.email || data.first_name || data.inviter_first_name)) {
                vm.state = 'form';
                vm.inviter = data.inviter_first_name || '';
                vm.form.first_name = data.first_name || '';
                vm.form.email = data.email || '';
                vm.invitedEmail = data.email || '';
            } else {
                vm.state = 'invalid';   // uniform 404 message — link to public signup
            }
        });
    }

    function validate() {
        if (!vm.form.first_name.trim()) {
            ToastService.highlightField('fls-first'); ToastService.warning('First Name Required', 'Please enter your first name.'); return false;
        }
        if (!vm.form.last_name.trim()) {
            ToastService.highlightField('fls-last'); ToastService.warning('Last Name Required', 'Please enter your last name.'); return false;
        }
        if (!vm.form.email.trim()) {
            ToastService.highlightField('fls-email'); ToastService.warning('Email Required', 'Please enter your email address.'); return false;
        }
        if (!vm.form.password || vm.form.password !== vm.form.password2) {
            ToastService.highlightField('fls-password2'); ToastService.warning('Passwords', 'Please enter matching passwords.'); return false;
        }
        return true;
    }

    function submit() {
        if (!validate()) { return; }
        vm.busy = true;

        if (vm.screen === 'invite') {
            LogbookSignupService.FromInvite({
                token: $stateParams.token,
                first_name: vm.form.first_name.trim(), last_name: vm.form.last_name.trim(),
                email: vm.form.email.trim(), password: vm.form.password, password2: vm.form.password2
            }).then(function(data) {
                vm.busy = false;
                if (data && data.success && data.verified) {
                    vm.state = 'ready';          // kept the invited email — pre-verified
                } else if (data && data.success) {
                    vm.state = 'sent';           // changed the email — verification round-trip
                } else {
                    ToastService.error('Signup Failed', (data && data.message) || 'Please try again.');
                }
            });
            return;
        }

        LogbookSignupService.Register({
            first_name: vm.form.first_name.trim(), last_name: vm.form.last_name.trim(),
            email: vm.form.email.trim(), password: vm.form.password, password2: vm.form.password2
        }).then(function(data) {
            vm.busy = false;
            if (data && data.success) {
                vm.state = 'sent';               // ALWAYS neutral — never reveals existing accounts
            } else {
                // Rate limits etc. — show the backend's message verbatim.
                ToastService.error('Signup Failed', (data && data.message) || 'Please try again.');
            }
        });
    }
}
