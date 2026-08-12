// ═══════════════════════════════════════════════════════════════════
//  EndorsementConfirmController
//  PUBLIC page (no login) at /endorsement_confirm/:token — the link in
//  the "please confirm this endorsement" email. The instructor reviews
//  the flight + endorsement, optionally fixes their name/number, signs
//  if no in-person signature exists, then confirms (or declines).
//  Confirm/decline are single-use. Every terminal state pitches the
//  free digital logbook (one-click signup when signup.can_signup).
//  Contracts: FRONTEND_LOGBOOK_ENDORSEMENTS_GUIDE.md §6,
//             FRONTEND_LOGBOOK_SIGNUP_GUIDE.md §3
// ═══════════════════════════════════════════════════════════════════

app.controller('EndorsementConfirmController', EndorsementConfirmController);

EndorsementConfirmController.$inject = ['LogbookEndorsementsService', 'LogbookSignupService',
                                        'ToastService', '$stateParams', '$location'];
function EndorsementConfirmController(LogbookEndorsementsService, LogbookSignupService,
                                      ToastService, $stateParams, $location) {
    var vm = this;

    var token = $stateParams.token;

    vm.state = 'loading';        // loading | review | done | declined | handled | invalid
    vm.busy = false;
    vm.payload = null;           // full PublicGet payload
    vm.flight = null;
    vm.endorsement = null;
    vm.pilot_name = '';
    vm.signup = null;            // {headline, blurb, signup_url, can_signup}
    vm.handledStatus = null;     // when the link was already used/expired

    // Editable stamp fields + signature (required when none exists yet)
    vm.form = { instructor_name: '', instructor_number: '', signature_image: '' };
    vm.needsSignature = false;

    // Decline
    vm.declineOpen = false;
    vm.declineReason = '';

    // One-click signup card
    vm.signupForm = { first_name: '', last_name: '', password: '', password2: '' };
    vm.signupState = 'offer';    // offer | created | existing
    vm.signupBusy = false;
    vm.lockedEmail = '';

    vm.confirm = confirm;
    vm.toggleDecline = function() { vm.declineOpen = !vm.declineOpen; };
    vm.decline = decline;
    vm.createAccount = createAccount;
    vm.goLogin = function() { $location.path('/login'); };

    load();

    function load() {
        LogbookEndorsementsService.PublicGet(token).then(function(data) {
            vm.payload = data;
            vm.signup = (data && data.signup) || null;

            if (data && data.status === 'pending_email_confirm' && data.flight) {
                vm.state = 'review';
                vm.flight = data.flight;
                vm.endorsement = data.endorsement || {};
                vm.pilot_name = data.pilot_name || 'The pilot';
                vm.form.instructor_name = vm.endorsement.instructor_name || '';
                vm.form.instructor_number = vm.endorsement.instructor_number || '';
                vm.needsSignature = !(vm.endorsement.signature_image || vm.endorsement.has_signature_image);
                vm.lockedEmail = vm.endorsement.instructor_email || '';
                seedSignupNames();
            } else if (data && data.status) {
                // expired / confirmed / declined / revoked — already handled
                vm.state = 'handled';
                vm.handledStatus = data.status;
                vm.lockedEmail = (data.endorsement && data.endorsement.instructor_email) || '';
                seedSignupNames();
            } else {
                vm.state = 'invalid';
            }
        });
    }

    function seedSignupNames() {
        // Prefill the one-click card from the endorsement's instructor name.
        var name = (vm.form.instructor_name || (vm.endorsement && vm.endorsement.instructor_name) || '').trim();
        if (name && !vm.signupForm.first_name) {
            var parts = name.split(/\s+/);
            vm.signupForm.first_name = parts.shift() || '';
            vm.signupForm.last_name = parts.join(' ');
        }
    }

    function confirm() {
        if (vm.needsSignature && !vm.form.signature_image) {
            ToastService.warning('Signature Required', 'Please draw your signature before confirming.');
            return;
        }
        var extras = {};
        if ((vm.form.instructor_name || '').trim())   { extras.instructor_name = vm.form.instructor_name.trim(); }
        if ((vm.form.instructor_number || '').trim()) { extras.instructor_number = vm.form.instructor_number.trim(); }
        if (vm.form.signature_image)                  { extras.signature_image = vm.form.signature_image; }

        vm.busy = true;
        LogbookEndorsementsService.PublicConfirm(token, extras).then(function(data) {
            vm.busy = false;
            if (data && data.success) {
                vm.state = 'done';
                if (data.signup) { vm.signup = data.signup; }
                seedSignupNames();
            } else if (data && data.status) {
                vm.state = 'handled';
                vm.handledStatus = data.status;
            } else {
                ToastService.error('Could Not Confirm', (data && data.message) || 'Please try again.');
            }
        });
    }

    function decline() {
        vm.busy = true;
        LogbookEndorsementsService.PublicDecline(token, (vm.declineReason || '').trim()).then(function(data) {
            vm.busy = false;
            if (data && data.success) {
                vm.state = 'declined';
                if (data.signup) { vm.signup = data.signup; }
            } else if (data && data.status) {
                vm.state = 'handled';
                vm.handledStatus = data.status;
            } else {
                ToastService.error('Could Not Decline', (data && data.message) || 'Please try again.');
            }
        });
    }

    // ── One-click free-logbook signup (account on the endorsement email) ──
    function createAccount() {
        if (!vm.signupForm.password || vm.signupForm.password !== vm.signupForm.password2) {
            ToastService.warning('Passwords', 'Please enter matching passwords.');
            return;
        }
        vm.signupBusy = true;
        LogbookSignupService.FromEndorsement(token, vm.signupForm.password, vm.signupForm.password2,
                                             (vm.signupForm.first_name || '').trim(),
                                             (vm.signupForm.last_name || '').trim())
            .then(function(data) {
                vm.signupBusy = false;
                if (data && data.success) {
                    vm.signupState = 'created';   // already verified — no email round-trip
                } else if (data && data.code === 'EXISTING_ACCOUNT') {
                    vm.signupState = 'existing';
                } else {
                    ToastService.error('Could Not Create Account', (data && data.message) || 'Please try again.');
                }
            });
    }
}
