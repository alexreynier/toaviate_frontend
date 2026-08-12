// ═══════════════════════════════════════════════════════════════════
//  InvitePilotController
//  My Account → Invite a Pilot (the referral loop — available to ALL
//  users). Send invites + list mine with status chips; open invites
//  expose a copyable landing-page link. Success is NEUTRAL ("sent")
//  even when the invitee already has an account.
//  Backend contract: FRONTEND_LOGBOOK_SIGNUP_GUIDE.md §4
// ═══════════════════════════════════════════════════════════════════

app.controller('InvitePilotController', InvitePilotController);

InvitePilotController.$inject = ['LogbookSignupService', 'ToastService', '$timeout'];
function InvitePilotController(LogbookSignupService, ToastService, $timeout) {
    var vm = this;

    vm.loading = true;
    vm.sending = false;
    vm.email = '';
    vm.first_name = '';
    vm.invites = [];

    vm.send = send;
    vm.copyLink = copyLink;
    vm.inviteLink = function(i) { return window.location.origin + '/logbook_invite/' + i.token; };

    load();

    function load() {
        LogbookSignupService.Invites().then(function(data) {
            vm.loading = false;
            vm.invites = (data && data.invites) || [];
        });
    }

    function send() {
        if (!(vm.email || '').trim()) {
            ToastService.highlightField('invp-email');
            ToastService.warning('Email Required', "Enter the pilot's email address.");
            return;
        }
        vm.sending = true;
        LogbookSignupService.Invite(vm.email.trim(), (vm.first_name || '').trim()).then(function(data) {
            vm.sending = false;
            if (data && data.success) {
                ToastService.success('Invitation Sent', 'They\'ll receive an email with their personal invite link.');
                vm.email = ''; vm.first_name = '';
                load();
            } else {
                // Rate limits / resend cap / send failure — show verbatim.
                ToastService.error('Could Not Send', (data && data.message) || 'Please try again.');
            }
        });
    }

    function copyLink(i) {
        var text = vm.inviteLink(i);
        function done() {
            $timeout(function() { i._copied = true; });
            $timeout(function() { i._copied = false; }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function() { fallback(); });
        } else { fallback(); }
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            done();
        }
    }
}
