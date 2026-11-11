/* ═══════════════════════════════════════════════════════════════════════════
   v2 SIGN-IN, TWO-FACTOR AND PASSWORD RESET — design: mockups/login/login.html (approved 10 Nov 2026, "no band").
   Built 10 Nov 2026 beside the classic pages, behind the v2 switch.

   States (PUBLIC — also in app.js publicStates / publicPages): login_v2 (/v2/login), password_reset_v2
   (/v2/password_reset), password_reset2_v2 (/v2/password_reset/:token); each maps its classic state, so the
   services' 401 → /login, e-mailed reset links and bookmarks open whichever design the switch says.

   The sign-in page runs the LIVE LoginController (js/controllers/loginController.js — every stage, gate and redirect:
   e-mail code, two-factor, recovery codes, "lost my phone", passkeys, the 2FA-enrolment lock, the payment gate,
   invitation acceptance, return URLs, club-less accounts) on a v2 template. LoginV2Controller instantiates it with
   two stand-ins (locals, nothing in the classic file changes):
     • a quiet ToastService — refusals and "enter your …" warnings are said IN the card (a field message when the
       controller highlighted a field, else a note); successes and anything raised while signing in stay toasts;
     • an AuthenticationService wrapper — Login2 / SetCredentials2 report when the credentials were accepted and when
       the account is being opened, which drives the signing-in card (steps + the aircraft's take-off).
   The template keeps the element ids the controller focuses and highlights by (email, password, email_code,
   two_factor_code, two_factor_lost_why). The forgot / reset pages have a small controller of their own (the classic
   PasswordResetController is 60 lines of toasts; the v2 pages say it in the card and show the five password rules live).
   body.ta-login (set below) drops styles.css's body padding — these pages draw their own header.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('login_v2', {
            url: '/v2/login',
            templateUrl: 'views/v2/login/login.html',
            controller: 'LoginV2Controller',
            controllerAs: 'vm',
            data: { v2Login: true }
        })
        .state('password_reset_v2', {
            url: '/v2/password_reset',
            templateUrl: 'views/v2/login/forgot.html',
            controller: 'PasswordResetV2Controller',
            controllerAs: 'vm',
            data: { v2Login: true, action: 'forgot' }
        })
        .state('password_reset2_v2', {
            url: '/v2/password_reset/:token',
            templateUrl: 'views/v2/login/reset.html',
            controller: 'PasswordResetV2Controller',
            controllerAs: 'vm',
            data: { v2Login: true, action: 'reset' }
        });
    DesignRoutesProvider.map('login', 'login_v2');
    DesignRoutesProvider.map('password_reset', 'password_reset_v2');
    DesignRoutesProvider.map('password_reset2', 'password_reset2_v2');
}]);

// body.ta-login while one of these pages shows: no body padding (there is no fixed #main_header2), the grey ground
app.run(['$rootScope', function ($rootScope) {
    $rootScope.$on('$stateChangeSuccess', function (event, toState) {
        document.body.classList.toggle('ta-login', !!(toState.data && toState.data.v2Login));
    });
}]);

// ngAnimate off inside the page (as <main class="ta-page"> has): a card ng-if removes would otherwise linger for its
// pop animation's length
app.directive('lgPage', ['$animate', function ($animate) {
    return { restrict: 'C', link: function (scope, element) { $animate.enabled(element, false); } };
}]);

app.controller('LoginV2Controller', LoginV2Controller);
LoginV2Controller.$inject = ['$scope', '$controller', 'ToastService', 'AuthenticationService'];
function LoginV2Controller($scope, $controller, ToastService, AuthenticationService) {
    var ui = {
        note: null,                 // {tone: 'bad'|'warn', text, at} — a refusal said in the card
        errs: {},                   // field id → message (the controller highlighted that field)
        busy: { on: false, step: 0, first: '' },   // the signing-in card: 0 checking, 1 opening the account, 2 ready
        steps: ['Checking your details', 'Opening your clubs', 'Ready'],
        showPw: false,
        lastField: null
    };

    // ── the quiet ToastService: warnings / errors go into the card while it is showing ──
    var quiet = Object.create(ToastService);
    quiet.highlightField = function (id) { ui.lastField = id; return ToastService.highlightField(id); };
    quiet.warning = function (title, sub) { say('warn', title, sub); };
    quiet.error = function (title, sub) { say('bad', title, sub); };
    function say(tone, title, sub) {
        if (ui.busy.on) { ToastService[tone === 'bad' ? 'error' : 'warning'](title, sub); return; }   // the page is about to change
        var text = (typeof sub === 'string' && sub) ? sub : String(title || '');
        text = text.replace(/\s*\d+ attempts? remaining\.?\s*$/i, '');   // the card shows the attempts left on its own line
        var f = ui.lastField; ui.lastField = null;
        if (f) { ui.errs[f] = text; } else { ui.note = { tone: tone, text: text, at: new Date().getTime() }; }
        ToastService.handledInline();
    }

    // ── the AuthenticationService wrapper: the moments the signing-in card is made of ──
    var auth = Object.create(AuthenticationService);
    auth.Login2 = function (password, key, callback) {
        AuthenticationService.Login2(password, key, function (response) {
            if (response && response.success && !response.email_verification_required && !response.two_factor_required) { start(response.user); }
            callback(response);
        });
    };
    auth.SetCredentials2 = function (email, password, user, session, callback) {
        if (!ui.busy.on) { start(user); }   // a two-factor code, an e-mail code or a passkey accepted
        ui.busy.step = 1;
        AuthenticationService.SetCredentials2(email, password, user, session, function (response) {
            ui.busy.step = 2;
            callback(response);
        });
    };
    function start(user) {
        ui.busy.on = true; ui.busy.step = 0; ui.note = null; ui.errs = {};
        ui.busy.first = (user && typeof user.first_name === 'string') ? user.first_name.trim() : '';
    }

    // the live controller, on this page's scope; its instance is this controller's `vm`
    var vm = $controller('LoginController', { $scope: $scope, ToastService: quiet, AuthenticationService: auth });
    vm.ui = ui;
    ui.hasErrs = function () { for (var k in ui.errs) { if (ui.errs.hasOwnProperty(k)) { return true; } } return false; };   // vm.error (set by the controller beside its toast) shows only when no field carries it
    vm.page = 'signin';
    vm.year = new Date().getFullYear();
    // typing in a field clears what was said about it
    vm.clear = function (id) {
        if (id) {
            delete ui.errs[id];
            var el = document.getElementById(id);
            if (el) { el.classList.remove('field-error-highlight'); }
        }
        ui.note = null;
        vm.error = null;
    };
    // a stage change clears the field messages, and a note said on an earlier stage (one said in the same tick —
    // "sign in again" right before backToPassword — stays, it belongs to the stage we're arriving on)
    $scope.$watch(function () { return vm.stage; }, function (now, before) {
        if (now === before) { return; }
        ui.errs = {};
        if (ui.note && new Date().getTime() - ui.note.at > 100) { ui.note = null; }
        ui.showPw = false;
    });
    return vm;
}

/* ── forgot password (/v2/password_reset) and reset by link (/v2/password_reset/:token) ── */
app.controller('PasswordResetV2Controller', PasswordResetV2Controller);
PasswordResetV2Controller.$inject = ['$state', '$stateParams', '$timeout', 'AuthenticationService', 'ToastService'];
function PasswordResetV2Controller($state, $stateParams, $timeout, AuthenticationService, ToastService) {
    var vm = this;
    vm.action = ($state.current.data && $state.current.data.action) || 'forgot';
    vm.page = vm.action;
    vm.year = new Date().getFullYear();
    vm.errs = {};
    vm.busy = false;
    // forgot
    vm.email = '';
    vm.sent = false;
    // reset: the same five rules as the Security page and the backend's strength check
    vm.RULES = [
        { k: 'len', t: 'At least 8 characters', re: /.{8,}/ },
        { k: 'up', t: 'An upper-case letter', re: /[A-Z]/ },
        { k: 'low', t: 'A lower-case letter', re: /[a-z]/ },
        { k: 'num', t: 'A number', re: /[0-9]/ },
        { k: 'sp', t: 'A symbol, such as ! or #', re: /[^A-Za-z0-9]/ }
    ];
    vm.pw = '';
    vm.showPw = false;
    vm.done = false;
    vm.doneMsg = '';
    vm.dead = false;
    vm.deadMsg = '';

    vm.clear = function (id) { delete vm.errs[id]; delete vm.errs.form; };
    vm.ruleOk = function (r) { return r.re.test(vm.pw || ''); };
    vm.allOk = function () { for (var i = 0; i < vm.RULES.length; i++) { if (!vm.RULES[i].re.test(vm.pw || '')) { return false; } } return true; };

    function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || ''); }   // any plausible address (.aero, plus-addresses…)
    function focus(id) { $timeout(function () { var el = document.getElementById(id); if (el) { el.focus(); } }, 50); }

    // Neutral by design (never says whether the address exists) — but a failed request mustn't pretend an e-mail went out
    function send(again) {
        var email = String(vm.email || '').trim();
        vm.errs = {};
        if (!emailOk(email)) { vm.errs.email = 'Enter a valid email address'; focus('reset_email'); return; }
        vm.busy = true;
        AuthenticationService.ResetPassword(email, function (data) {
            vm.busy = false;
            if (data && data.success === false && data.message && !/not found|no account|unknown/i.test(String(data.message))) {
                ToastService.handledInline();
                if (again) { ToastService.error('Not Sent', String(data.message)); return; }
                vm.errs.form = String(data.message);
                return;
            }
            vm.email = email;
            vm.sent = true;
            if (again) { ToastService.success('Sent Again', 'If ' + email + ' has an account, a fresh link is on its way.'); }
        });
    }
    vm.send = function () { if (!vm.busy) { send(false); } };
    vm.sendAgain = function () { if (!vm.busy) { send(true); } };

    vm.reset = function () {
        if (vm.busy) { return; }
        vm.errs = {};
        var missing = [];
        for (var i = 0; i < vm.RULES.length; i++) { if (!vm.RULES[i].re.test(vm.pw || '')) { missing.push(vm.RULES[i].t.toLowerCase()); } }
        if (missing.length) { vm.errs.pw = (vm.pw ? 'Your password still needs: ' : 'Choose a password with: ') + missing.join(', '); focus('new_password'); return; }
        vm.busy = true;
        AuthenticationService.ResetPassword2(vm.pw, $stateParams.token, function (data) {
            vm.busy = false;
            if (!data || data.success === false) {
                // an expired / used link: say so, offer a new one
                ToastService.handledInline();
                vm.dead = true;
                vm.deadMsg = (data && typeof data.message === 'string' && data.message) ? data.message : 'Reset links only work once, and not for ever.';
                return;
            }
            vm.done = true;
            vm.doneMsg = (typeof data.message === 'string' && data.message) ? data.message : '';
        });
    };
}
