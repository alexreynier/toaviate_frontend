/* ═══════════════════════════════════════════════════════════════════════════
   v2 SECURITY — design: mockups/my-account/security.html (approved 7 Nov 2026), built 8 Nov.
   My details → Security: a status band, Sign-in (password · two-factor · passkeys), Email addresses (with the
   "Confirm it's you" step-up), Recovery codes, and the club's 2FA enrolment lock. Replaces, while the v2 switch is on:
     dashboard.my_account.security → dashboard.v2.security (SecurityV2Controller)
   Same server calls as v1: TwoFactorService, WebauthnService, AccountEmailsService, StepUpService.Start/Verify
   (the step-up dialog is drawn here in the v2 design instead of views/modals/step_up.html), UserService.Update
   (Change password, the same dialog as Profile). QR codes are drawn on the page (libs/js/qrcode-generator.js).
   Enrolment lock: localStorage toaviate_2fa_setup_required = <user id> (set at login); app.js pins /dashboard*
   to the Security page (both /dashboard/my_account/security and /dashboard/v2/my_account/security); this page
   clears the flag as soon as the account has a second factor — exactly as SecuritySettingsController does.
   Show-once secrets (setup key, recovery codes): no ×, no scrim or Esc close, Finish only after "I've saved these".
   Waiting on backend (kept as today until it lands): turning two-factor off with a second factor (a step-up purpose),
   a passkey as a step-up choice, the new recovery-code alphabet, the "lost my phone" request on the sign-in page.
   Views: views/v2/security/security.html · CSS: css/v2/security.css (prefix sc-).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider.state('dashboard.v2.security', {
        url: '/my_account/security',
        templateUrl: 'views/v2/security/security.html',
        controller: 'SecurityV2Controller', controllerAs: 'vm'
    });
    DesignRoutesProvider.map('dashboard.my_account.security', 'dashboard.v2.security');
}]);


/* ═══ SecurityV2Words — the one wording helper per domain (two-factor, passkeys, email addresses) ═══ */
app.factory('SecurityV2Words', ['ProfileV2Util', function (U) {
    var W = {};
    W.LOW_CODES = 3;   /* one "running low" rule: 3 or fewer (decided 7 Nov) */
    /* AAGUID → where the passkey lives (a small table, decided 7 Nov) */
    var AAG = {
        'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': { name: 'iCloud Keychain', ic: 'fab fa-apple', works: 'Synced to your Apple devices' },
        'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': { name: 'iCloud Keychain', ic: 'fab fa-apple', works: 'Synced to your Apple devices' },
        '08987058-cadc-4b81-b6e1-30de50dcbe96': { name: 'Windows Hello', ic: 'fab fa-windows', works: 'This computer only' },
        '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': { name: 'Windows Hello', ic: 'fab fa-windows', works: 'This computer only' },
        '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': { name: 'Windows Hello', ic: 'fab fa-windows', works: 'This computer only' },
        'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': { name: 'Google Password Manager', ic: 'fab fa-google', works: 'Synced to your Google account' },
        'adce0002-35bc-c60a-648b-0b25f1f05503': { name: 'Chrome on Mac', ic: 'fab fa-chrome', works: 'This browser on this Mac' },
        'bada5566-a7aa-401f-bd96-45619a55120d': { name: '1Password', ic: 'fas fa-key', works: 'Synced to your 1Password vault' },
        'd548826e-79b4-db40-a3d8-11116f7e8349': { name: 'Bitwarden', ic: 'fas fa-shield-alt', works: 'Synced to your Bitwarden vault' },
        '531126d6-e717-415c-9320-3d9aa6981239': { name: 'Dashlane', ic: 'fas fa-key', works: 'Synced to your Dashlane vault' },
        'cb69481e-8ff7-4039-93ec-0a2729a154a8': { name: 'YubiKey 5', ic: 'fab fa-usb', works: 'A key you plug in or tap' },
        'ee882879-721c-4913-9775-3dfcce97072a': { name: 'YubiKey 5', ic: 'fab fa-usb', works: 'A key you plug in or tap' },
        'fa2b99dc-9e39-4257-8f92-4a30d23c4118': { name: 'YubiKey 5', ic: 'fab fa-usb', works: 'A key you plug in or tap' }
    };
    W.pkKind = function (pk) {
        var a = AAG[String(pk.aaguid || '').toLowerCase()]; if (a) { return a; }
        var t = pk.transports || [];
        if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = [t]; } }
        if (t.indexOf('usb') > -1 || t.indexOf('nfc') > -1) { return { name: 'Security key', ic: 'fab fa-usb', works: 'A key you plug in or tap' }; }
        return { name: 'Passkey', ic: 'fas fa-fingerprint', works: +pk.is_discoverable ? 'Signs in without typing your email' : 'Asks for your email first' };
    };
    /* "today 08:12" · "yesterday 17:48" · "2 Nov 2026" */
    W.when = function (s) {
        if (!s) { return null; }
        var d = U.day(s), t = U.fTime(s), n = U.daysBetween(d, U.today());
        if (n === 0) { return 'today ' + t; }
        if (n === 1) { return 'yesterday ' + t; }
        return U.fDate(s);
    };
    W.Cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
    W.hoursLeft = function (s) { return s ? moment(s).diff(moment(), 'minutes', true) / 60 : null; };
    W.expires = function (r) {
        if (!r.verify_expires_at) { return 'awaiting confirmation'; }
        var h = W.hoursLeft(r.verify_expires_at);
        if (h <= 0) { return 'link expired'; }
        return h >= 1 ? 'link expires in ' + Math.round(h) + ' h' : 'link expires in ' + Math.max(1, Math.round(h * 60)) + ' min';
    };
    W.email = function (r) {
        if (+r.is_primary) { return { tone: 'info', label: 'Primary', icon: 'fa-star' }; }
        if (r.pending) { return W.hoursLeft(r.verify_expires_at) !== null && W.hoursLeft(r.verify_expires_at) <= 0 ? { tone: 'bad', label: 'Link expired', icon: 'fa-unlink' } : { tone: 'pend', label: 'Awaiting confirmation', icon: 'fa-clock' }; }
        return { tone: 'good', label: 'Verified', icon: 'fa-check' };
    };
    W.codesTone = function (n) { return n === 0 ? 'bad' : n <= W.LOW_CODES ? 'warn' : 'good'; };
    W.verdict = function (status, passkeys) {
        if (status && status.enabled) { return { tone: 'good', ic: 'fa-shield-alt', t: 'Well protected', s: passkeys ? 'To sign in you need your password and a code from your phone — or one of your passkeys.' : 'To sign in you need your password and a code from your phone.' }; }
        if (passkeys) { return { tone: '', ic: 'fa-fingerprint', t: 'Passkeys on', s: 'Your passkeys are strong, but your password still works on its own. Turn on two-factor to cover it too.' }; }
        return { tone: 'warn', ic: 'fa-exclamation-triangle', t: 'Password only', s: 'Anyone who learns your password can sign in. Two-factor takes about two minutes to set up.' };
    };
    W.mask = function (e) { e = String(e || ''); var at = e.indexOf('@'); return at > 0 ? e.charAt(0) + '***' + e.slice(at) : e; };
    /* the backend's account-email codes → plain words (v1's errorCopy, plus "sent 5 times" for a refused resend) */
    W.emailError = function (data, max, resend) {
        var code = data && data.error;
        switch (code) {
            case 'INVALID_EMAIL': return 'That doesn\'t look like an email address.';
            case 'ALREADY_ADDED': return 'That address is already on your account.';
            case 'SEND_FAILED': return 'We could not send the email just now — try again in a moment.';
            case 'LIMIT_REACHED': return resend ? 'We\'ve sent this link 5 times. Remove the address and add it again.' : 'You can have up to ' + (max || 3) + ' addresses. Remove one first.';
            case 'RATE_LIMITED': return 'Wait a moment before resending.';
            case 'IS_PRIMARY': return 'Make another address primary before removing this one.';
            case 'NOT_VERIFIED': return 'Confirm that address before making it your primary.';
            case 'NOT_FOUND': return 'That address is no longer on your account.';
            case 'FORBIDDEN': return 'You don\'t have permission to do that.';
            case 'TOO_MANY_ATTEMPTS': return 'Too many attempts. Try again later.';
        }
        var m = U.msg(data, ''); if (m) { return m; }
        return 'Something went wrong. Try again.';
    };
    return W;
}]);


app.controller('SecurityV2Controller', SecurityV2Controller);
SecurityV2Controller.$inject = ['$rootScope', '$scope', '$q', '$timeout', '$interval', 'TwoFactorService', 'WebauthnService', 'AccountEmailsService',
    'StepUpService', 'UserService', 'AuthenticationService', 'ToastService', 'ProfileV2Util', 'SecurityV2Words'];
function SecurityV2Controller($rootScope, $scope, $q, $timeout, $interval, TwoFactorService, WebauthnService, AccountEmailsService,
    StepUpService, UserService, AuthenticationService, ToastService, U, W) {
    var vm = this;
    var FLAG = 'toaviate_2fa_setup_required';
    vm.me = $rootScope.globals.currentUser;
    vm.U = U; vm.W = W;
    vm.supported = WebauthnService.isSupported();
    vm.loading = true;
    vm.loadError = false;
    vm.status = null;
    vm.passkeys = [];
    vm.em = { loading: true, error: false, rows: [], limits: { max_verified: 3, max_pending: 3 } };
    vm.dlg = null;              // 'wizard' | 'regen' | 'off' | 'pw' | 'pkadd' | 'pkremove' | 'primary' | 'stepup'
    vm.pkOpen = null;
    vm.emOpen = null;
    vm.rules = U.PW_RULES;
    vm.locked = false;
    vm.resendLock = {};

    vm.hasFactor = function () { return !!(vm.status && (vm.status.enabled || (+vm.status.passkey_count > 0) || vm.passkeys.length)); };
    vm.verdict = function () { return W.verdict(vm.status, vm.passkeys.length); };
    vm.lastPk = function () { return vm.passkeys.map(function (p) { return p.last_used_at; }).filter(Boolean).sort().pop() || null; };
    vm.newestPk = function () { return vm.passkeys.map(function (p) { return p.created_at; }).filter(Boolean).sort().pop() || null; };
    vm.codes = function () { return vm.status ? (+vm.status.recovery_codes_remaining || 0) : 0; };
    vm.verifiedCount = function () { return vm.em.rows.filter(function (r) { return !r.pending; }).length; };
    vm.pendingCount = function () { return vm.em.rows.filter(function (r) { return r.pending; }).length; };
    vm.primary = function () { return vm.em.rows.filter(function (r) { return +r.is_primary; })[0] || null; };
    vm.canAdd = function () { return vm.verifiedCount() < vm.em.limits.max_verified && vm.pendingCount() < vm.em.limits.max_pending; };

    U.onEscape($scope, function () { vm.escape(); });
    var ticker = $interval(function () { vm.now = Date.now(); }, 30000);   // keeps "link expires in…" and resend locks live
    $scope.$on('$destroy', function () { $interval.cancel(ticker); stopCooldown(); wipe(); });

    load();
    loadEmails();

    function load() {
        vm.loadError = false;
        $q.all([TwoFactorService.GetStatus(), WebauthnService.List()]).then(function (r) {
            vm.loading = false;
            var st = r[0];
            if (!st || st.success === false) { vm.loadError = true; return; }
            vm.status = st;
            // the list, rename and remove don't need WebAuthn in the browser — only adding one does
            vm.passkeys = (r[1] && r[1].credentials) || [];
            refreshLock();
        });
    }
    vm.reload = function () { vm.loading = true; load(); };

    function refreshLock() {
        var flag = null;
        try { flag = localStorage.getItem(FLAG); } catch (e) {}
        var flagged = !!flag && String(vm.me.id) === flag;
        if (flagged && vm.hasFactor()) { try { localStorage.removeItem(FLAG); } catch (e) {} flagged = false; }
        vm.locked = flagged;
    }
    function liftToast(wasLocked, what, otherwise) {
        refreshLock();
        if (wasLocked && !vm.locked) { ToastService.success(what, 'Your club\'s requirement is met. Every page is open again.'); return; }
        ToastService.success(what, otherwise);
    }

    function loadEmails() {
        vm.em.loading = true; vm.em.error = false;
        AccountEmailsService.List().then(function (data) {
            vm.em.loading = false;
            if (!data || !data.success) { vm.em.error = true; return; }
            vm.em.rows = (data.addresses || []).slice().sort(function (a, b) { return (+b.is_primary - +a.is_primary) || ((a.pending ? 1 : 0) - (b.pending ? 1 : 0)) || (a.id - b.id); });
            vm.em.limits = angular.extend({ max_verified: 3, max_pending: 3 }, data.limits || {});
        });
    }
    vm.loadEmails = loadEmails;

    /* ── dialogs: which can close (show-once secrets and anything saving can't) ── */
    function busyOrStatic() {
        if (vm.dlg === 'wizard') { return vm.wz.busy || vm.wz.step !== 'password'; }
        if (vm.dlg === 'regen') { return vm.rg.busy || vm.rg.step === 'codes'; }
        var sub = { pw: vm.pw, pkadd: vm.pa, pkremove: vm.pr, stepup: vm.su, off: vm.off }[vm.dlg];
        return !!(sub && sub.busy);
    }
    function wipe() {
        if (vm.wz) { vm.wz.pw = ''; vm.wz.code = ''; }
        if (vm.rg) { vm.rg.pw = ''; }
        if (vm.pa) { vm.pa.pw = ''; }
        if (vm.pr) { vm.pr.pw = ''; }
        if (vm.su) { vm.su.pw = ''; vm.su.code = ''; vm.su.rc = ''; }
        if (vm.off) { vm.off.pw = ''; }
        if (vm.pw) { vm.pw.cur = ''; vm.pw.n1 = ''; vm.pw.n2 = ''; }
    }
    function closeDlg() {
        stopCooldown();
        if (vm.dlg === 'stepup' && vm.su && vm.su.onCancel) { var c = vm.su.onCancel; vm.su.onCancel = null; c(); }
        wipe();
        vm.dlg = null; vm.codesSaved = false; vm.copied = false;
    }
    vm.close = function () { if (busyOrStatic()) { return; } closeDlg(); };
    vm.escape = function () { if (!vm.dlg || busyOrStatic()) { return; } closeDlg(); };
    vm.scrim = function ($event) { if ($event.target === $event.currentTarget) { vm.close(); } };

    /* ═══ two-factor setup: Password → Scan → Enter code → Save codes ═══ */
    vm.tfaOn = function () {
        vm.wz = { step: 'password', pw: '', code: '', err: '', busy: false, wasLocked: vm.locked };
        vm.dlg = 'wizard'; vm.codesSaved = false; vm.copied = false;
        U.focus('tfa-enable-password', 120);
    };
    vm.wzIdx = function () { return { password: 0, scan: 1, code: 2, codes: 3 }[vm.wz.step]; };
    vm.wzPw = function () {
        var wz = vm.wz; if (wz.busy) { return; }
        if (!wz.pw) { wz.err = 'Enter your password to continue.'; U.focus('tfa-enable-password'); return; }
        wz.err = ''; wz.busy = true;
        TwoFactorService.Setup(wz.pw).then(function (data) {
            wz.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.success !== false && data.otpauth_uri) {
                wz.pw = '';
                wz.secret = data.secret || '';
                wz.uri = data.otpauth_uri;
                wz.qr = makeQr(data.otpauth_uri);
                wz.step = 'scan';
                return;
            }
            if (data && data.error === 'WRONG_PASSWORD') { wz.err = 'That password wasn\'t recognised. Try again.'; wz.pw = ''; U.focus('tfa-enable-password'); return; }
            if (data && data.error === 'ALREADY_ENABLED') { closeDlg(); ToastService.warning('Two-factor is already on', 'Nothing was changed.'); vm.reload(); return; }
            wz.err = U.msg(data, 'Setup could not start. Try again.'); U.focus('tfa-enable-password');   // the field was disabled while busy — give the cursor back
        });
    };
    function makeQr(uri) {   // drawn on the page — the secret never leaves it
        try {
            if (typeof qrcode === 'undefined') { return null; }
            var qr = qrcode(0, 'M'); qr.addData(uri); qr.make();
            return qr.createDataURL(6, 8);
        } catch (e) { console.log('QR render failed:', e); return null; }
    }
    vm.grouped = function (s) { return String(s || '').replace(/(.{4})/g, '$1 ').trim(); };
    vm.wzCopy = function () { U.copy(vm.wz.secret, function () { vm.wz.copied = true; ToastService.success('Key copied', 'Paste it into your authenticator app.'); $timeout(function () { if (vm.wz) { vm.wz.copied = false; } }, 2000); }); };
    vm.wzNext = function () { vm.wz.step = 'code'; vm.wz.err = ''; U.focus('tfa-enable-code', 120); };
    vm.wzBack = function () { if (vm.wz.busy) { return; } vm.wz.step = 'scan'; vm.wz.err = ''; };
    vm.wzCancel = function () { closeDlg(); ToastService.warning('Setup cancelled', 'Nothing was changed.'); };
    vm.wzCode = function () {
        var wz = vm.wz, c = String(wz.code || '').replace(/\s+/g, ''); if (wz.busy) { return; }
        if (!/^\d{6}$/.test(c)) { wz.err = 'Enter the 6 digits shown in the app.'; U.focus('tfa-enable-code'); return; }
        wz.err = ''; wz.busy = true;
        TwoFactorService.Confirm(c).then(function (data) {
            wz.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.success && data.recovery_codes) { wz.codes = data.recovery_codes; wz.step = 'codes'; wz.code = ''; return; }
            if (data && data.error === 'WRONG_CODE') { wz.err = 'That code didn\'t match. Check the app and try the new code.'; wz.code = ''; U.focus('tfa-enable-code'); return; }
            if (data && data.error === 'TOO_MANY_ATTEMPTS') { closeDlg(); ToastService.error('Too many attempts', 'Wait a while, then start the setup again.'); return; }
            wz.err = U.msg(data, 'That didn\'t work. Try again.'); U.focus('tfa-enable-code');
        });
    };

    /* ── show-once recovery codes (setup and "Make new codes") ── */
    vm.codesCopy = function (codes) { U.copy(codes.join('\n'), function () { vm.copied = true; ToastService.success('10 codes copied', 'Keep them somewhere safe.'); $timeout(function () { vm.copied = false; }, 2000); }); };
    vm.codesDl = function (codes) {
        var content = 'ToAviate two-factor recovery codes\nEach code works exactly once. Keep them somewhere safe.\n\n' + codes.join('\n') + '\n';
        var blob = new Blob([content], { type: 'text/plain' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'toaviate-recovery-codes.txt';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        $timeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    vm.codesFinish = function () {
        if (!vm.codesSaved) { return; }
        var fromWizard = vm.dlg === 'wizard', wasLocked = fromWizard && vm.wz.wasLocked;
        if (vm.wz) { vm.wz.codes = null; }
        if (vm.rg) { vm.rg.codes = null; }
        vm.dlg = null; vm.codesSaved = false; vm.copied = false;
        if (fromWizard) {
            TwoFactorService.GetStatus().then(function (st) {
                if (st && st.success !== false) { vm.status = st; }
                liftToast(wasLocked, 'Two-factor is on', 'You\'ll be asked for a code at every sign-in.');
            });
        } else {
            ToastService.success('New recovery codes saved', 'Your old codes no longer work.');
            vm.reload();
        }
    };

    /* ═══ new recovery codes ═══ */
    vm.rgOpen = function () { vm.rg = { step: 'password', pw: '', err: '', busy: false }; vm.dlg = 'regen'; vm.codesSaved = false; U.focus('recovery-password', 120); };
    vm.rgPw = function () {
        var rg = vm.rg; if (rg.busy) { return; }
        if (!rg.pw) { rg.err = 'Enter your password to make new codes.'; U.focus('recovery-password'); return; }
        rg.err = ''; rg.busy = true;
        TwoFactorService.RegenerateRecoveryCodes(rg.pw).then(function (data) {
            rg.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.recovery_codes) { rg.pw = ''; rg.codes = data.recovery_codes; rg.step = 'codes'; vm.status.recovery_codes_remaining = data.recovery_codes.length; return; }
            if (data && data.error === 'WRONG_PASSWORD') { rg.err = 'That password wasn\'t recognised. Try again.'; rg.pw = ''; U.focus('recovery-password'); return; }
            rg.err = U.msg(data, 'New codes could not be made. Try again.'); U.focus('recovery-password');
        });
    };

    /* ═══ turn two-factor off — what changes, then "Confirm it's you" with the purpose two_factor_off (C22, 9 Nov):
       the password AND the second step; POST two_factor/disable {step_up_token} ═══ */
    vm.tfaOff = function () { vm.off = { step: vm.status.club_requires_two_factor && !vm.passkeys.length ? 'club' : 'ask' }; vm.dlg = 'off'; };
    vm.offGo = function () {
        stepUp({ title: 'Turn off two-factor', text: 'Because this removes a layer of protection, we check your password and your second step.', purpose: 'two_factor_off' },
            function (token) { return TwoFactorService.Disable({ step_up_token: token }); },
            function (data) {
                if (data && data.success) { ToastService.warning('Two-factor is off', 'Your password alone signs you in now.'); vm.reload(); return; }
                if (data && data.error === 'CLUB_REQUIRES_2FA') { vm.off = { step: 'club' }; vm.dlg = 'off'; return; }
                if (data && data.error === 'TOO_MANY_ATTEMPTS') { ToastService.error('Too many attempts', 'Wait a while before trying again.'); return; }
                ToastService.error('Two-factor is still on', U.msg(data, 'It could not be turned off. Try again.'));
            });
    };
    vm.pkAddFromOff = function () { closeDlg(); vm.pkAdd(); };

    /* ═══ passkeys ═══ */
    vm.pkToggle = function (pk) { vm.pkOpen = vm.pkOpen === pk.id ? null : pk.id; vm.pkName = pk.label; vm.pkNameErr = false; };
    vm.pkRename = function (pk) {
        var name = String(vm.pkName || '').trim();
        if (!name) { vm.pkNameErr = true; U.focus('passkey-rename-label'); return; }
        vm.pkNameErr = false;
        WebauthnService.Rename(pk.id, name).then(function (data) {
            if (data && data.success !== false) { pk.label = name; ToastService.success('Renamed to “' + name + '”', 'So you can tell your devices apart.'); return; }
            ToastService.error('Not renamed', U.msg(data, 'Try again in a moment.'));
        });
    };
    vm.pkAdd = function () {
        if (!vm.supported) { return; }
        vm.pa = { pw: '', label: '', err: '', busy: false, cancelled: false, wasLocked: vm.locked }; vm.dlg = 'pkadd';
        U.focus('passkey-add-password', 120);
    };
    vm.pkCreate = function () {
        var pa = vm.pa; if (pa.busy) { return; }
        if (!pa.pw) { pa.err = 'Enter your password to add a passkey.'; U.focus('passkey-add-password'); return; }
        pa.err = ''; pa.cancelled = false; pa.busy = true;
        WebauthnService.Register(pa.pw, String(pa.label || '').trim()).then(function (data) {
            pa.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.success) {
                var wasLocked = pa.wasLocked;
                closeDlg();
                $q.all([TwoFactorService.GetStatus(), WebauthnService.List()]).then(function (r) {
                    if (r[0] && r[0].success !== false) { vm.status = r[0]; }
                    vm.passkeys = (r[1] && r[1].credentials) || vm.passkeys;
                    liftToast(wasLocked, 'Passkey added', 'Sign in with this device\'s Face ID, fingerprint or PIN.');
                });
                return;
            }
            if (data && data.error === 'WRONG_PASSWORD') { pa.err = 'That password wasn\'t recognised. Try again.'; pa.pw = ''; U.focus('passkey-add-password'); return; }
            if (data && data.error === 'CEREMONY_CANCELLED') { pa.cancelled = true; return; }
            if (data && data.error === 'ALREADY_REGISTERED') { pa.err = 'This device already has a passkey for your account.'; return; }
            if (data && data.error === 'CHALLENGE_EXPIRED') { pa.err = 'The prompt timed out. Try again.'; return; }
            pa.err = U.msg(data, 'The passkey could not be added. Try again.'); U.focus('passkey-add-password');
        });
    };
    vm.pkRemove = function (pk) { vm.pr = { pk: pk, pw: '', err: '', busy: false }; vm.dlg = 'pkremove'; U.focus('passkey-delete-password', 120); };
    vm.pkLastStep = function () { return !!(vm.status && !vm.status.enabled && vm.passkeys.length === 1); };
    vm.pkRemoveGo = function () {
        var pr = vm.pr; if (pr.busy) { return; }
        if (!pr.pw) { pr.err = 'Enter your password to remove it.'; U.focus('passkey-delete-password'); return; }
        pr.err = ''; pr.busy = true;
        WebauthnService.Remove(pr.pk.id, pr.pw).then(function (data) {
            pr.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.success !== false) {
                var label = pr.pk.label;
                vm.passkeys = vm.passkeys.filter(function (p) { return p.id !== pr.pk.id; });
                if (vm.status) { vm.status.passkey_count = vm.passkeys.length; }
                closeDlg(); vm.pkOpen = null;
                ToastService.success('“' + label + '” removed', 'It can no longer be used to sign in.');
                return;
            }
            if (data && data.error === 'WRONG_PASSWORD') { pr.err = 'That password wasn\'t recognised. Try again.'; pr.pw = ''; U.focus('passkey-delete-password'); return; }
            pr.err = U.msg(data, 'The passkey could not be removed. Try again.'); U.focus('passkey-delete-password');
        });
    };

    /* ═══ change password — the same dialog and rules as Profile (PUT users/{id}) ═══ */
    vm.pwOpen = function () { vm.pw = { cur: '', n1: '', n2: '', errs: {}, busy: false }; vm.dlg = 'pw'; U.focus('pw-cur', 120); };
    vm.pwSave = function () {
        var p = vm.pw, e = {}; if (p.busy) { return; }
        if (!p.cur) { e.cur = 'Enter your current password.'; }
        if (!U.pwOk(p.n1)) { e.n1 = 'Meet every rule below.'; }
        if (!p.n2) { e.n2 = 'Type the new password again.'; } else if (p.n2 !== p.n1) { e.n2 = 'The two new passwords don\'t match.'; }
        p.errs = e;
        var k = Object.keys(e); if (k.length) { U.focus({ cur: 'pw-cur', n1: 'pw-new', n2: 'pw-new2' }[k[0]]); return; }
        p.busy = true;
        UserService.Update({ id: vm.me.id, password: p.cur, new_password: p.n1, new_password2: p.n2 }).then(function (data) {
            p.busy = false;
            if (data && data.success) { closeDlg(); ToastService.success('Password changed', 'Use it next time you log in.'); return; }
            if (data && data.message === 'Password entered failed') { p.errs = { cur: 'That password isn\'t right.' }; p.cur = ''; U.focus('pw-cur'); ToastService.error('Not changed', 'That password isn\'t right.'); return; }
            if (data && data.error === 'VALIDATION_ERROR') { p.errs = { n1: U.msg(data, 'Choose a stronger password.') }; ToastService.error('Not changed', p.errs.n1); return; }
            ToastService.error('Not changed', U.msg(data, 'Try again in a moment.')); U.focus('pw-new2');
        });
    };

    /* ═══ email addresses (every change behind the step-up) ═══ */
    vm.emToggle = function (r) { if (+r.is_primary) { return; } vm.emOpen = vm.emOpen === r.id ? null : r.id; vm.emConfirm = null; };
    vm.emAddOpen = function () { if (!vm.canAdd()) { return; } vm.emAdding = true; vm.emErr = ''; vm.emNotice = ''; vm.emNew = ''; U.focus('field-ae-email', 80); };
    vm.emCancel = function () { vm.emAdding = false; vm.emNew = ''; vm.emErr = ''; };
    vm.emSubmit = function () {
        var e = String(vm.emNew || '').trim().toLowerCase();
        if (!U.EMAIL_RE.test(e)) { vm.emErr = W.emailError({ error: 'INVALID_EMAIL' }); U.focus('field-ae-email'); return; }
        if (vm.em.rows.some(function (r) { return String(r.email).toLowerCase() === e; })) { vm.emErr = W.emailError({ error: 'ALREADY_ADDED' }); U.focus('field-ae-email'); return; }
        if (!vm.canAdd()) { vm.emErr = W.emailError({ error: 'LIMIT_REACHED' }, vm.em.limits.max_verified); return; }
        vm.emErr = '';
        stepUp({ title: 'Before you add ' + e, text: 'For your security, confirm your password before adding an address.' },
            function (token) { return AccountEmailsService.Add(e, token); },
            function (data) {
                if (data && data.success) {
                    var msg = U.msg(data, 'Check ' + e + ' for a confirmation link.');
                    if (!/expires|24 hours/i.test(msg)) { msg += ' It works for 24 hours.'; }
                    vm.emNotice = msg; vm.emAdding = false; vm.emNew = '';
                    ToastService.success('Confirmation link sent', msg);
                    loadEmails();
                } else {
                    vm.emErr = W.emailError(data, vm.em.limits.max_verified);
                    ToastService.error('Address not added', vm.emErr);
                }
            });
    };
    vm.resendLocked = function (r) { return !!(vm.resendLock[r.id] && vm.resendLock[r.id] > Date.now()); };
    vm.emResend = function (r) {
        if (vm.resendLocked(r) || r.can_resend === false) { return; }
        vm.resendLock[r.id] = Date.now() + 45000;
        $timeout(function () { delete vm.resendLock[r.id]; }, 45000);
        AccountEmailsService.Resend(r.id).then(function (data) {
            if (data && data.success) { ToastService.success('New link sent', 'Check ' + r.email + ' for it.'); loadEmails(); return; }
            if (data && data.error === 'LIMIT_REACHED') { r.can_resend = false; }
            // a refusal that isn't about pace (server error, SEND_FAILED…) doesn't hold the button for 45 s
            if (!data || (data.error !== 'RATE_LIMITED' && data.error !== 'LIMIT_REACHED')) { delete vm.resendLock[r.id]; }
            ToastService.error('Not resent', W.emailError(data, vm.em.limits.max_verified, true));
        });
    };
    vm.emRemoveAsk = function (r) { vm.emConfirm = r.id; };
    vm.emRemoveNo = function () { vm.emConfirm = null; };
    vm.emRemoveYes = function (r) {
        vm.emConfirm = null;
        stepUp({ title: 'Before you remove ' + r.email, text: 'For your security, confirm your password before removing an address.' },
            function (token) { return AccountEmailsService.Remove(r.id, token); },
            function (data) {
                if (data && data.success) { vm.emOpen = null; vm.emNotice = ''; ToastService.success(r.email + ' removed', 'It is no longer on your account.'); loadEmails(); return; }
                ToastService.error('Not removed', W.emailError(data, vm.em.limits.max_verified));
            });
    };
    vm.emPrimary = function (r) {
        var cur = vm.primary() ? vm.primary().email : (vm.me.email || '');
        vm.mp = { row: r, current: cur };
        vm.dlg = 'primary';
    };
    vm.mpGo = function () {
        var r = vm.mp.row;
        stepUp({ title: 'Before you change your primary address', text: 'For your security, confirm your password before changing where your notifications go.' },
            function (token) { return AccountEmailsService.MakePrimary(r.id, token); },
            function (data) {
                if (data && data.success) {
                    var email = (data.user && data.user.email) ? data.user.email : r.email;
                    if ($rootScope.globals && $rootScope.globals.currentUser) { $rootScope.globals.currentUser.email = email; AuthenticationService.PersistGlobals(); }
                    vm.emOpen = null;
                    ToastService.success('Your primary address is now ' + email, 'Other devices were signed out.');
                    loadEmails();
                    return;
                }
                ToastService.error('Not changed', W.emailError(data, vm.em.limits.max_verified));
            });
    };

    /* ═══ "Confirm it's you" — password, then the factor the backend picks (StepUpService.Start / Verify).
       action(token) runs the write; a STEP_UP_REQUIRED answer asks once more (StepUpService.Run's rule). ═══ */
    var cooldown = null;
    function stopCooldown() { if (cooldown) { $interval.cancel(cooldown); cooldown = null; } }
    function stepUp(o, action, done) {
        stopCooldown();
        vm.su = { title: o.title, text: o.text, stage: 'password', method: null, pw: '', code: '', rc: '', err: '', note: '', busy: false,
            useRecovery: false, wait: 0, picking: false, picked: null, addresses: [], deliverTo: null, retried: false, lockout: false,
            action: action, done: done, onCancel: null, purpose: o.purpose || 'account_emails' };
        vm.dlg = 'stepup';
        U.focus('step-up-password', 120);
    }
    vm.suStepIdx = function () { return vm.su && vm.su.stage === 'password' ? 0 : 1; };
    vm.suPw = function () {
        var su = vm.su; if (su.busy) { return; }
        if (!su.pw) { su.err = 'Enter your password.'; U.focus('step-up-password'); return; }
        su.err = ''; su.note = '';
        suStart(su.deliverTo);
    };
    function suStart(deliverTo) {
        var su = vm.su;
        su.busy = true;
        StepUpService.Start(su.pw, su.purpose, deliverTo).then(function (data) {
            su.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.success && data.step_up_key) {
                su.key = data.step_up_key; su.method = data.method; su.alternatives = data.alternatives || [];
                su.sentTo = data.sent_to_masked || ''; su.publicKey = data.publicKey || null; su.challengeKey = data.challenge_key || null;
                su.addresses = angular.isArray(data.verified_addresses) ? data.verified_addresses : [];
                su.code = ''; su.rc = ''; su.useRecovery = false; su.picking = false; su.picked = null; su.err = '';
                su.stage = 'factor';
                if (su.method === 'email_code') { startCooldown(); }
                U.focus(su.method === 'totp' ? 'step-up-code' : su.method === 'email_code' ? 'step-up-code-email' : null, 120);
                return;
            }
            if (data && data.error === 'WRONG_PASSWORD') { su.err = 'That password wasn\'t recognised. Try again.'; su.pw = ''; U.focus('step-up-password'); return; }
            if (data && data.error === 'TOO_MANY_ATTEMPTS') { lockout(); return; }
            if (data && data.error === 'RATE_LIMITED') { su.err = 'Wait a moment before trying again.'; U.focus('step-up-password'); return; }
            su.err = U.msg(data, 'Your password could not be checked. Try again.'); U.focus('step-up-password');
        });
    }
    function startCooldown() {
        stopCooldown();
        vm.su.wait = 45;
        cooldown = $interval(function () { if (!vm.su) { stopCooldown(); return; } vm.su.wait -= 1; if (vm.su.wait <= 0) { stopCooldown(); } }, 1000);
    }
    function lockout() {
        var su = vm.su;
        su.lockout = true; su.busy = true; su.err = 'Too many attempts. Wait a few minutes before trying again — this closes by itself.';
        $timeout(function () { if (vm.su === su) { su.busy = false; closeDlg(); } }, 2500);
    }
    vm.suCode = function () {
        var su = vm.su; if (su.busy) { return; }
        var rec = su.method === 'totp' && su.useRecovery;
        var v = rec ? String(su.rc || '').trim() : String(su.code || '').replace(/\s+/g, '');
        if (rec ? !v : !/^\d{6}$/.test(v)) { su.err = rec ? 'Enter one of your recovery codes.' : 'Enter the 6-digit code.'; U.focus(rec ? 'step-up-recovery' : su.method === 'totp' ? 'step-up-code' : 'step-up-code-email'); return; }
        suVerify(rec ? { type: 'recovery', code: v } : { code: v });
    };
    function suVerify(payload) {
        var su = vm.su;
        su.busy = true; su.err = '';
        StepUpService.Verify(su.key, payload).then(function (data) {
            if (data && data.success && data.step_up_token) {
                // the write itself — still "busy" until it answers
                $q.when(su.action(data.step_up_token)).then(function (result) {
                    su.busy = false;
                    if (result && result.success === false && result.error === 'STEP_UP_REQUIRED' && !su.retried) {
                        su.retried = true; suBack('That took too long — confirm your password again.'); return;
                    }
                    var done = su.done; closeDlg(); if (done) { done(result); }
                });
                return;
            }
            su.busy = false;
            if (!data || data.success === false) { ToastService.handledInline(); }   // the dialog says what went wrong — no second, generic toast
            if (data && data.error === 'WRONG_CODE') {
                var n = data.attempts_remaining;
                su.err = (n !== undefined && n !== null) ? 'Wrong code — ' + n + ' attempt' + (+n === 1 ? '' : 's') + ' left.' : 'Wrong code — try again.';
                su.code = ''; su.rc = '';
                U.focus(su.method === 'totp' ? (su.useRecovery ? 'step-up-recovery' : 'step-up-code') : 'step-up-code-email');
                return;
            }
            if (data && data.error === 'EXPIRED') { suBack('That took too long — confirm your password again.'); return; }
            if (data && data.error === 'TOO_MANY_ATTEMPTS') { lockout(); return; }
            var codeId = su.method === 'totp' ? (su.useRecovery ? 'step-up-recovery' : 'step-up-code') : su.method === 'email_code' ? 'step-up-code-email' : null;
            if (data && data.error === 'RATE_LIMITED') { su.err = 'Wait a moment before trying again.'; if (codeId) { U.focus(codeId); } return; }
            su.err = su.method === 'passkey' ? 'Your passkey didn\'t work — try again.' : (U.msg(data, 'That didn\'t work. Try again.'));
            if (codeId) { U.focus(codeId); }
        });
    }
    function suBack(note) {
        var su = vm.su; stopCooldown();
        su.stage = 'password'; su.method = null; su.key = null; su.pkAlt = false; su.code = ''; su.rc = ''; su.pw = ''; su.useRecovery = false; su.picking = false; su.err = ''; su.note = note || '';
        U.focus('step-up-password', 120);
    }
    // C28: a member with an authenticator AND a passkey gets method totp + alternatives ['recovery','passkey'] (+ challenge_key /
    // publicKey) — "Use a passkey instead" switches to the passkey view; verify then sends type:'passkey'
    vm.suCanPk = function () { var su = vm.su; return !!(su && vm.supported && su.publicKey && su.challengeKey && (su.alternatives || []).indexOf('passkey') > -1); };
    vm.suUsePk = function () { var su = vm.su; if (su.busy) { return; } su.pkAlt = true; su.method = 'passkey'; su.useRecovery = false; su.err = ''; };
    vm.suUseApp = function () { var su = vm.su; if (su.busy) { return; } su.pkAlt = false; su.method = 'totp'; su.err = ''; su.code = ''; U.focus('step-up-code', 80); };
    vm.suRecovery = function () { var su = vm.su; su.useRecovery = !su.useRecovery; su.err = ''; su.code = ''; su.rc = ''; U.focus(su.useRecovery ? 'step-up-recovery' : 'step-up-code', 80); };
    vm.suResend = function () { var su = vm.su; if (su.wait > 0 || su.busy) { return; } suStart(su.deliverTo); };
    vm.suPick = function () { vm.su.picking = true; vm.su.picked = null; vm.su.err = ''; };
    vm.suPickBack = function () { vm.su.picking = false; vm.su.err = ''; };
    vm.suSend = function () {
        var su = vm.su; if (su.busy) { return; }
        if (!su.picked) { su.err = 'Choose an address first.'; return; }
        su.deliverTo = su.picked.id; suStart(su.deliverTo);
    };
    /* passkey: the browser ceremony with the start response's publicKey, then Verify — the credential shape of webauthn/login_verify */
    function b64u(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) { s += String.fromCharCode(b[i]); } return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function fromB64u(s) { var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) { b[i] = bin.charCodeAt(i); } return b.buffer; }
    vm.suPasskey = function () {
        var su = vm.su; if (su.busy) { return; }
        if (!vm.supported || !su.publicKey) { su.err = 'This browser doesn\'t support passkeys. Try another device or browser.'; return; }
        var pk;
        try {
            pk = angular.copy(su.publicKey); pk.challenge = fromB64u(pk.challenge);
            (pk.allowCredentials || []).forEach(function (c) { c.id = fromB64u(c.id); });
        } catch (e) { su.err = 'Your passkey didn\'t work — try again.'; return; }
        su.busy = true; su.waiting = true; su.err = '';
        navigator.credentials.get({ publicKey: pk }).then(function (cred) {
            $timeout(function () {
                su.waiting = false;
                suVerify({ type: 'passkey', challenge_key: su.challengeKey, credential: { id: cred.id, response: {
                    clientDataJSON: b64u(cred.response.clientDataJSON), authenticatorData: b64u(cred.response.authenticatorData),
                    signature: b64u(cred.response.signature), userHandle: cred.response.userHandle ? b64u(cred.response.userHandle) : null } } });
            });
        }, function () { $timeout(function () { su.busy = false; su.waiting = false; su.err = 'Your passkey didn\'t work — try again.'; }); });
    };
}
