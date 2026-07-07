// MaintenanceSignupController — public single-page signup for a maintenance organisation.
app.controller('MaintenanceSignupController', MaintenanceSignupController);

MaintenanceSignupController.$inject = ['$rootScope', '$scope', '$state', '$location', 'ToastService', 'MaintenanceOrganisationService', 'SignupDraftService', 'SignupPreviewService', 'PasswordPolicyService'];
function MaintenanceSignupController($rootScope, $scope, $state, $location, ToastService, MaintenanceOrganisationService, SignupDraftService, SignupPreviewService, PasswordPolicyService) {
    var vm = this;

    vm.submitting = false;
    vm.submitted  = false;
    vm.tnc        = false;
    vm.invite     = null;          // { token, email, organisation_name, club_title, plane_registration, message, inviter_name }
    vm.invite_loading = false;

    vm.user = {
        first_name: '', last_name: '', email: '', phone: '',
        dob_day: '', dob_month: '', dob_year: '',
        password: '', password2: ''
    };

    vm.org = {
        title: '', is_company: 1, company_name: '', company_number: '',
        address: '', address_line_1: '', address_line_2: '',
        city: '', post_code: '', country: 'GB',
        email: '', phone_number: '',
        approval_ref: '', website: ''
    };

    vm.days   = range(1, 31);
    vm.months = [
        {v:'01', n:'January'}, {v:'02', n:'February'}, {v:'03', n:'March'},
        {v:'04', n:'April'},   {v:'05', n:'May'},      {v:'06', n:'June'},
        {v:'07', n:'July'},    {v:'08', n:'August'},   {v:'09', n:'September'},
        {v:'10', n:'October'}, {v:'11', n:'November'}, {v:'12', n:'December'}
    ];
    var thisYear = new Date().getFullYear();
    vm.years = range(thisYear - 18, thisYear - 80);

    vm.submit = submit;
    vm.clearFieldError = function(e) { ToastService.clearFieldError(e); };

    // Live password-requirements checklist under the password field.
    vm.pwCheck = PasswordPolicyService.Rules;

    // ── Refresh robustness: auto-save a sanitised draft (never passwords)
    // so an accidental refresh doesn't wipe the whole form. ──
    var DRAFT_KEY = 'maintenance_signup';
    var draft = SignupDraftService.Load(DRAFT_KEY);
    if (draft) {
        if (draft.user) { angular.extend(vm.user, draft.user); }
        if (draft.org)  { angular.extend(vm.org,  draft.org); }
        if (vm.user.first_name || vm.org.title) {
            ToastService.success('Progress Restored', 'Welcome back — we saved what you had entered so far.');
        }
    }
    SignupDraftService.Watch($scope, DRAFT_KEY, function () {
        return { user: vm.user, org: vm.org };
    });

    // ── Honor ?invite=<token> from a club's invitation email ──
    var inviteToken = $location.search().invite;
    // Design preview: ?invite=preview loads sample data and simulates the
    // submit locally (non-production only).
    var isPreview = SignupPreviewService.IsPreview(inviteToken);
    if (isPreview) {
        vm.invite = SignupPreviewService.GetMaintenanceInvite(inviteToken);
        if (vm.invite.email)             vm.user.email = vm.invite.email;
        if (vm.invite.organisation_name) vm.org.title  = vm.invite.organisation_name;
        ToastService.warning('Design Preview', 'Sample invite data — the submit is simulated, nothing is saved.');
    } else if (inviteToken) {
        vm.invite_loading = true;
        MaintenanceOrganisationService.GetInvite(inviteToken).then(function(res) {
            vm.invite_loading = false;
            if (res && res.success !== false && res.invite) {
                vm.invite = res.invite;
                if (vm.invite.email)             vm.user.email = vm.invite.email;
                if (vm.invite.organisation_name) vm.org.title  = vm.invite.organisation_name;
            } else {
                ToastService.warning('Invite link expired',
                    'You can still sign up below — just ask your club to re-link your aircraft afterwards.');
            }
        });
    }

    function submit() {
        var checks = [
            { ok: !!vm.user.first_name,  field: 'mxo_first',     label: 'First name' },
            { ok: !!vm.user.last_name,   field: 'mxo_last',      label: 'Last name' },
            { ok: !!vm.user.email,       field: 'mxo_email',     label: 'Your email' },
            { ok: !!vm.user.password, field: 'mxo_password', label: 'Password' },
            { ok: vm.user.password === vm.user.password2, field: 'mxo_password2', label: 'Password confirmation must match' },
            { ok: !!vm.user.dob_day && !!vm.user.dob_month && !!vm.user.dob_year, field: 'mxo_dob_day', label: 'Date of birth' },
            { ok: !!vm.org.title,        field: 'mxo_org_title', label: 'Organisation trading name' },
            { ok: !!vm.org.company_name, field: 'mxo_company',   label: 'Registered company name' },
            { ok: !!vm.org.address_line_1, field: 'mxo_addr1',   label: 'Address' },
            { ok: !!vm.org.city,         field: 'mxo_city',      label: 'City' },
            { ok: !!vm.org.post_code,    field: 'mxo_post',      label: 'Postcode' },
            { ok: !!vm.org.email,        field: 'mxo_org_email', label: 'Organisation email' },
            { ok: !!vm.tnc,              field: 'mxo_tnc',       label: 'Accept the terms & conditions' }
        ];
        if (!ToastService.validateForm(checks)) return;

        // Tell the user exactly which password rule failed.
        var pwMessage = PasswordPolicyService.Message(vm.user.password);
        if (pwMessage) {
            ToastService.highlightField('mxo_password');
            ToastService.warning('Password Not Strong Enough', pwMessage);
            return;
        }

        // Flatten address for the backend's `address` convenience field.
        vm.org.address = [vm.org.address_line_1, vm.org.address_line_2, vm.org.city, vm.org.post_code]
            .filter(function(s){ return !!s; }).join(', ');

        if (isPreview) {
            vm.submitted = true;
            SignupDraftService.Clear(DRAFT_KEY);
            ToastService.success('Preview', 'Signup simulated — this is the post-submit screen.',
                { confetti: true, duration: 4500 });
            return;
        }

        vm.submitting = true;
        MaintenanceOrganisationService.Signup({
            tnc: vm.tnc,
            user: vm.user,
            organisation: vm.org,
            invite_token: inviteToken || null
        }).then(function(res) {
            vm.submitting = false;
            if (res && res.success) {
                vm.submitted = true;
                SignupDraftService.Clear(DRAFT_KEY);
                ToastService.success('Organisation created',
                    'Check your inbox to verify your email, then sign in.',
                    { confetti: true, duration: 4500 });
            } else {
                ToastService.error('Signup failed', (res && res.message) || 'Please try again.');
            }
        });
    }

    function range(from, to) {
        var arr = [], step = from <= to ? 1 : -1;
        for (var i = from; step > 0 ? i <= to : i >= to; i += step) arr.push(i);
        return arr;
    }
}
