// ═══════════════════════════════════════════════════════════════════
//  Account email addresses — My Account → Security → "Email addresses"
//    AccountEmailsController          the card (list / add / resend /
//                                     remove / make primary)
//    EmailMakePrimaryModalController  confirm dialog before the
//                                     make-primary step-up
//  Bound with ng-controller="AccountEmailsController as ae" on the
//  card itself (never on an ng-if element — this Angular skips the
//  controller there).
//  Every write that is gated by a step-up (add / remove / make primary)
//  goes through StepUpService.Run, which opens the password + factor
//  modal, calls the action with the token and retries once on
//  STEP_UP_REQUIRED. Because the write starts AFTER a modal, the global
//  busy guard can't cover it, so those flows keep their own busy flags.
//  Backend contract: FRONTEND_ACCOUNT_EMAILS_PLAN.md §1 A–C, §6, §7
// ═══════════════════════════════════════════════════════════════════

app.controller('AccountEmailsController', AccountEmailsController);

AccountEmailsController.$inject = ['$scope', '$rootScope', '$timeout', '$interval', '$uibModal', '$cookieStore',
                                   'AccountEmailsService', 'StepUpService', 'ToastService'];
function AccountEmailsController($scope, $rootScope, $timeout, $interval, $uibModal, $cookieStore,
                                 AccountEmailsService, StepUpService, ToastService) {
    var ae = this;

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var RESEND_LOCK_MS = 45 * 1000;
    var DEFAULT_LIMITS = { max_verified: 3, max_pending: 3 };

    // ── State ──
    ae.loading = true;
    ae.loadError = false;
    ae.addresses = [];
    ae.limits = angular.copy(DEFAULT_LIMITS);
    ae.verifiedCount = 0;
    ae.pendingCount = 0;
    ae.canAdd = false;

    // Inline add form
    ae.adding = false;
    ae.addBusy = false;
    ae.newEmail = '';
    ae.addError = '';
    ae.addNotice = '';

    // ── API ──
    ae.reload = load;
    ae.openAdd = openAdd;
    ae.cancelAdd = cancelAdd;
    ae.submitAdd = submitAdd;
    ae.resend = resend;
    ae.resendLocked = resendLocked;
    ae.askRemove = askRemove;
    ae.cancelRemove = cancelRemove;
    ae.confirmRemove = confirmRemove;
    ae.makePrimary = makePrimary;
    ae.statusLabel = statusLabel;
    ae.expiresLabel = expiresLabel;

    // Tick every 30 s so the "expires in …" countdowns stay live.
    var ticker = $interval(function () { ae.now = Date.now(); }, 30000);
    $scope.$on('$destroy', function () { $interval.cancel(ticker); });

    load();

    // ── Load ──

    function load() {
        ae.loading = true;
        ae.loadError = false;
        AccountEmailsService.List().then(function (data) {
            ae.loading = false;
            if (!data || !data.success) {
                ae.loadError = true;
                console.log('AccountEmails: list failed', data);
                return;
            }
            ae.addresses = mergeTransient(ae.addresses, data.addresses || []);
            ae.limits = angular.extend({}, DEFAULT_LIMITS, data.limits || {});
            recount();
        });
    }

    // Rows are replaced on every reload; carry the per-row transient
    // state (_underscore convention) across by id so a 45 s resend lock
    // or an open "Remove?" prompt doesn't vanish mid-interaction.
    function mergeTransient(oldRows, newRows) {
        var byId = {};
        angular.forEach(oldRows, function (r) { byId[r.id] = r; });
        angular.forEach(newRows, function (r) {
            var prev = byId[r.id];
            if (prev) {
                r._resendLockedUntil = prev._resendLockedUntil;
                r._confirmRemove = prev._confirmRemove;
                r._busy = prev._busy;
            }
        });
        return newRows;
    }

    function recount() {
        var verified = 0, pending = 0;
        angular.forEach(ae.addresses, function (r) {
            if (r.pending) { pending++; } else { verified++; }
        });
        ae.verifiedCount = verified;
        ae.pendingCount = pending;
        ae.canAdd = verified < ae.limits.max_verified && pending < ae.limits.max_pending;
    }

    // ── Labels ──

    function statusLabel(row) {
        if (row.is_primary) { return 'Primary · verified'; }
        if (row.pending) { return 'Pending · ' + expiresLabel(row); }
        return 'Verified';
    }

    function expiresLabel(row) {
        if (!row.verify_expires_at) { return 'awaiting confirmation'; }
        var mins = Math.round(moment(row.verify_expires_at).diff(moment(), 'minutes', true));
        if (mins <= 0) { return 'expired'; }
        if (mins >= 60) { return 'expires in ' + Math.round(mins / 60) + ' h'; }
        return 'expires in ' + mins + ' min';
    }

    // ── Add ──

    function openAdd() {
        ae.adding = true;
        ae.addError = '';
        ae.addNotice = '';
        $timeout(function () {
            var el = document.getElementById('field-ae-email');
            if (el) { el.focus(); }
        }, 50);
    }

    function cancelAdd() {
        ae.adding = false;
        ae.newEmail = '';
        ae.addError = '';
    }

    function submitAdd() {
        var email = (ae.newEmail || '').trim();
        ae.addError = '';
        ae.addNotice = '';

        if (!EMAIL_RE.test(email)) {
            ae.addError = errorCopy({ error: 'INVALID_EMAIL' });
            return;
        }
        if (!ae.canAdd) {
            ae.addError = errorCopy({ error: 'LIMIT_REACHED' });
            return;
        }
        if (ae.addBusy) { return; }

        ae.addBusy = true;
        StepUpService.Run({
            purpose: 'account_emails',
            deliverTo: null,
            title: 'Add an address',
            text: 'Confirm it\'s you before adding ' + email + ' to your account.'
        }, function (token) {
            return AccountEmailsService.Add(email, token);
        }).then(function (data) {
            ae.addBusy = false;
            if (data && data.success) {
                // Neutral by design: identical whether the address was free
                // or belongs to someone else (never reveal ownership).
                var msg = neutralAddMessage(data, email);
                ae.addNotice = msg;
                ae.newEmail = '';
                ae.adding = false;
                ToastService.success('Confirmation Sent', msg);
                load();
            } else if (data && data.error === 'CANCELLED') {
                // user backed out of the step-up — nothing to say
            } else {
                ae.addError = errorCopy(data);
                ToastService.error('Address Not Added', ae.addError);
            }
        });
    }

    function neutralAddMessage(data, email) {
        var msg = (data && data.message) ? String(data.message) : ('Check ' + email + ' for a confirmation link.');
        if (!/expires/i.test(msg)) { msg += ' It expires in 24 hours.'; }
        return msg;
    }

    // ── Resend ──

    function resendLocked(row) {
        if (row.can_resend === false) { return true; }
        return !!(row._resendLockedUntil && row._resendLockedUntil > Date.now());
    }

    function resend(row) {
        if (resendLocked(row)) { return; }

        row._resendLockedUntil = Date.now() + RESEND_LOCK_MS;
        $timeout(function () { row._resendLockedUntil = null; }, RESEND_LOCK_MS);

        AccountEmailsService.Resend(row.id).then(function (data) {
            if (data && data.success) {
                ToastService.success('Confirmation Resent', 'Check ' + row.email + ' for a new link.');
                load();
            } else if (data && data.error === 'RATE_LIMITED') {
                ToastService.warning('Please Wait', errorCopy(data));
            } else {
                ToastService.error('Not Resent', errorCopy(data));
            }
        });
    }

    // ── Remove (inline confirm, then step-up) ──

    function askRemove(row) {
        angular.forEach(ae.addresses, function (r) { r._confirmRemove = false; });
        row._confirmRemove = true;
    }

    function cancelRemove(row) {
        row._confirmRemove = false;
    }

    function confirmRemove(row) {
        if (row._busy) { return; }
        row._confirmRemove = false;
        row._busy = true;

        StepUpService.Run({
            purpose: 'account_emails',
            deliverTo: null,
            title: 'Remove an address',
            text: 'Confirm it\'s you before removing ' + row.email + ' from your account.'
        }, function (token) {
            return AccountEmailsService.Remove(row.id, token);
        }).then(function (data) {
            row._busy = false;
            if (data && data.success) {
                ToastService.success('Address Removed', row.email + ' is no longer on your account.');
                load();
            } else if (data && data.error === 'CANCELLED') {
                // backed out
            } else {
                ToastService.error('Not Removed', errorCopy(data));
            }
        });
    }

    // ── Make primary (confirm dialog → step-up) ──

    function makePrimary(row) {
        if (row._busy || row.is_primary || row.pending) { return; }

        var current = currentPrimaryEmail();

        $uibModal.open({
            windowClass: 'sec-modal-window',   // clears the fixed top nav
            templateUrl: 'views/modals/email_make_primary.html',
            controller: 'EmailMakePrimaryModalController',
            controllerAs: 'vm',
            resolve: {
                address: function () { return row; },
                currentEmail: function () { return current; }
            }
        }).result.then(function (confirmed) {
            if (!confirmed) { return; }
            runMakePrimary(row);
        }, function () {});
    }

    function runMakePrimary(row) {
        row._busy = true;
        StepUpService.Run({
            purpose: 'account_emails',
            deliverTo: null,
            title: 'Change your sign-in address',
            text: 'Confirm it\'s you before making ' + row.email + ' your sign-in address.'
        }, function (token) {
            return AccountEmailsService.MakePrimary(row.id, token);
        }).then(function (data) {
            row._busy = false;
            if (data && data.success) {
                var newEmail = (data.user && data.user.email) ? data.user.email : row.email;
                applyNewPrimary(newEmail);
                ToastService.success('Sign-in Address Changed',
                    'Your sign-in address is now ' + newEmail + '. Other devices have been signed out.');
                load();
            } else if (data && data.error === 'CANCELLED') {
                // backed out
            } else {
                ToastService.error('Not Changed', errorCopy(data));
            }
        });
    }

    function currentPrimaryEmail() {
        var user = $rootScope.globals && $rootScope.globals.currentUser;
        if (user && user.email) { return user.email; }
        for (var i = 0; i < ae.addresses.length; i++) {
            if (ae.addresses[i].is_primary) { return ae.addresses[i].email; }
        }
        return '';
    }

    // Plan §6: update the email in place and re-persist the globals the
    // way AuthenticationService.SetCredentials does ($cookieStore 'globals').
    // Deliberately NOT SetCredentials itself — that re-runs the access
    // fetch and resets the auth gate for nothing.
    function applyNewPrimary(email) {
        if (!email || !$rootScope.globals || !$rootScope.globals.currentUser) { return; }
        $rootScope.globals.currentUser.email = email;
        $cookieStore.put('globals', $rootScope.globals);
    }

    // ── Error copy (plan §7) ──

    function errorCopy(data) {
        var code = data && data.error;
        var max = (ae.limits && ae.limits.max_verified) || DEFAULT_LIMITS.max_verified;
        switch (code) {
            case 'INVALID_EMAIL':  return 'That doesn\'t look like an email address.';
            case 'ALREADY_ADDED':
                return 'That address is already on your account.';
            case 'SEND_FAILED':
                return 'We could not send the email just now — please try again in a moment.';
            case 'LIMIT_REACHED':  return 'You can have up to ' + max + ' addresses. Remove one first.';
            case 'RATE_LIMITED':   return 'Please wait a moment before resending.';
            case 'IS_PRIMARY':     return 'Make another address primary before removing this one.';
            case 'NOT_VERIFIED':   return 'Confirm that address before making it your sign-in address.';
            case 'NOT_FOUND':      return 'That address is no longer on your account.';
            case 'FORBIDDEN':      return 'You don\'t have permission to do that.';
            case 'TOO_MANY_ATTEMPTS': return 'Too many attempts. Please try again later.';
        }
        if (data && data.message && typeof data.message === 'string') { return data.message; }
        return 'Something went wrong. Please try again.';
    }
}


// ═══ Make-primary confirm dialog ═══
// Resolves true on confirm; the caller then runs the step-up.

app.controller('EmailMakePrimaryModalController', EmailMakePrimaryModalController);

EmailMakePrimaryModalController.$inject = ['$uibModalInstance', 'address', 'currentEmail'];
function EmailMakePrimaryModalController($uibModalInstance, address, currentEmail) {
    var vm = this;

    var STAFF_RE = /@toaviate\.com$/i;

    vm.address = address || {};
    vm.currentEmail = currentEmail || '';

    // Plan §6 caveat: isToAviateStaff() is a regex on @toaviate.com, so a
    // staff member moving to a non-staff address loses the admin menu
    // until the platform-admin flag lands.
    vm.staffWarning = STAFF_RE.test(vm.currentEmail) && !STAFF_RE.test(vm.address.email || '');

    vm.confirm = function () { $uibModalInstance.close(true); };
    vm.cancel = function () { $uibModalInstance.dismiss('cancel'); };
}
