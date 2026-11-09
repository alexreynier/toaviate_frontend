// ═══════════════════════════════════════════════════════════════════
//  SuperAdminSecurityController
//  ToAviate super-admin — Account Security tools:
//    · per-club "require two-factor" toggle
//        GET/PUT two_factor/club_requirement/{club_id}
//    · lockout reset for users who lost phone + recovery codes — two steps since C22 (9 Nov 2026), each behind the
//      staff member's own step-up (StepUpService.Run, purpose admin_recovery):
//        POST two_factor/admin_reset/{user_id} {reason, reset_passkeys, step_up_token} → a request held 24 h
//          (the member is e-mailed a STOP link → the public /two_factor_reset_cancel/:token page)
//        POST two_factor/admin_reset/{user_id}/complete {step_up_token} once the hold has passed
//        GET  two_factor/admin_reset/{user_id} → requests[] (newest first) — all times UTC
//  Backend is authoritative (non-staff get 403); the @toaviate.com
//  gate here is UX only, same as PlatformKeysController.
//  Backend contract: FRONTEND_TWO_FACTOR_GUIDE.md §4
// ═══════════════════════════════════════════════════════════════════

app.controller('SuperAdminSecurityController', SuperAdminSecurityController);

SuperAdminSecurityController.$inject = ['TwoFactorService', 'ClubService', 'UserService',
                                        'ToastService', 'StepUpService', '$rootScope', '$interval', '$scope'];
function SuperAdminSecurityController(TwoFactorService, ClubService, UserService,
                                      ToastService, StepUpService, $rootScope, $interval, $scope) {
    var vm = this;

    // ── Access gate — ToAviate platform staff only (backend is authoritative) ──
    vm.user     = $rootScope.globals.currentUser;
    vm.is_staff = $rootScope.isToAviateStaff();

    vm.loading = true;

    // Club requirement toggle
    vm.clubs = [];
    vm.selectedClub = null;
    vm.requirement = null;         // {require_two_factor: 0|1}
    vm.requirementLoading = false;
    vm.requirementSaving = false;
    vm.loadRequirement = loadRequirement;
    vm.toggleRequirement = toggleRequirement;

    // Lockout reset (two steps: request → 24 h hold the member can stop → complete)
    vm.lookupId = '';
    vm.lookupBusy = false;
    vm.foundUser = null;
    vm.resetConfirm = null;        // {reset_passkeys: 0|1, reason: ''} — the request form
    vm.resetBusy = false;
    vm.reasonErr = '';
    vm.requests = null;            // GET two_factor/admin_reset/{uid} — newest first; null while loading
    vm.requestsError = false;
    vm.lookupUser = lookupUser;
    vm.askReset = function (withPasskeys) { vm.resetConfirm = { reset_passkeys: withPasskeys ? 1 : 0, reason: '' }; vm.reasonErr = ''; };
    vm.cancelReset = function () { vm.resetConfirm = null; vm.reasonErr = ''; };
    vm.runReset = runReset;
    vm.completeReset = completeReset;
    vm.loadRequests = loadRequests;
    vm.pending = function () { return (vm.requests || []).filter(function (r) { return r.status === 'pending'; })[0] || null; };
    vm.holdPassed = function (r) { var m = utc(r && r.hold_until); return !!m && !m.isAfter(moment()); };
    vm.when = function (s) { var m = utc(s); return m ? m.local().format('ddd D MMM YYYY, HH:mm') : ''; };
    vm.left = function (s) {
        var m = utc(s); if (!m) { return ''; }
        var mins = Math.max(0, Math.ceil(m.diff(moment(), 'minutes', true)));
        var h = Math.floor(mins / 60), mm = mins % 60;
        return h ? h + ' h ' + (mm ? mm + ' min' : '') : mm + ' min';
    };
    vm.statusLabel = function (r) {
        return { pending: 'Waiting — the member can stop it', cancelled: 'Stopped by the member', completed: 'Completed', expired: 'Expired' }[r.status] || r.status;
    };
    // the hold ends while the page is open → the Complete button wakes up without a reload
    var tick = $interval(function () { vm.now = Date.now(); }, 30000);
    $scope.$on('$destroy', function () { $interval.cancel(tick); });

    if (!vm.is_staff) {
        vm.loading = false;
        return;
    }

    loadClubs();

    function loadClubs() {
        ClubService.GetAll().then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Load Clubs', (data && data.message) || 'Please refresh and try again.');
                return;
            }
            vm.clubs = data.clubs || (angular.isArray(data) ? data : []);
        });
    }

    // ── Club requirement ──

    function loadRequirement() {
        vm.requirement = null;
        if (!vm.selectedClub) { return; }
        vm.requirementLoading = true;
        TwoFactorService.GetClubRequirement(vm.selectedClub.id).then(function (data) {
            vm.requirementLoading = false;
            if (!data || data.success === false) {
                ToastService.error('Could Not Load Setting', (data && data.message) || 'Please try again.');
                return;
            }
            vm.requirement = { require_two_factor: parseInt(data.require_two_factor, 10) || 0 };
        });
    }

    function toggleRequirement() {
        if (!vm.selectedClub || !vm.requirement || vm.requirementSaving) { return; }
        var next = vm.requirement.require_two_factor ? 0 : 1;
        vm.requirementSaving = true;
        TwoFactorService.SetClubRequirement(vm.selectedClub.id, next).then(function (data) {
            vm.requirementSaving = false;
            if (data && data.success !== false) {
                vm.requirement.require_two_factor = next;
                ToastService.success(next ? 'Two-Factor Now Required' : 'Two-Factor Now Optional',
                    (vm.selectedClub.name || 'This club') + (next ?
                        ' members without 2FA or a passkey will be pushed into setup at their next login.' :
                        ' members can now use 2FA optionally.'));
            } else {
                ToastService.error('Could Not Save', (data && data.message) || 'Please try again.');
            }
        });
    }

    // ── Lockout reset ──

    function lookupUser() {
        var id = (vm.lookupId || '').toString().trim();
        vm.foundUser = null;
        vm.resetConfirm = null;
        vm.requests = null;
        if (!id) {
            ToastService.highlightField('sa-sec-user-id');
            ToastService.warning('User ID Required', 'Enter the numeric user ID to look up.');
            return;
        }
        vm.lookupBusy = true;
        UserService.GetById(id).then(function (data) {
            vm.lookupBusy = false;
            var user = data && (data.user || (data.id ? data : null));
            if (user && user.id) {
                vm.foundUser = user;
                loadRequests();
            } else {
                ToastService.error('User Not Found', (data && data.message) || 'No user with that ID.');
            }
        });
    }

    // the backend's DATETIMEs are UTC (api.php sets the default timezone) — shown in the viewer's own time
    function utc(s) {
        if (!s || typeof moment !== 'function') { return null; }
        var m = moment.utc(String(s), 'YYYY-MM-DD HH:mm:ss');
        return m.isValid() ? m : null;
    }

    function loadRequests() {
        if (!vm.foundUser) { return; }
        vm.requests = null;
        vm.requestsError = false;
        TwoFactorService.AdminResetRequests(vm.foundUser.id).then(function (data) {
            if (!data || data.success === false || !angular.isArray(data.requests)) { vm.requests = []; vm.requestsError = true; return; }
            vm.requests = data.requests;
        });
    }

    function name() { return ((vm.foundUser.first_name || '') + ' ' + (vm.foundUser.last_name || '')).trim() || 'this member'; }

    // Step 1 — open the request (reason 5–500), behind the staff member's own step-up
    function runReset() {
        if (!vm.foundUser || !vm.resetConfirm || vm.resetBusy) { return; }
        var reason = String(vm.resetConfirm.reason || '').trim();
        if (reason.length < 5 || reason.length > 500) {
            vm.reasonErr = reason.length > 500 ? 'Keep the reason under 500 characters.' : 'Say why (at least 5 characters) — it is logged and shown to other staff.';
            ToastService.highlightField('sa-sec-reason');
            return;
        }
        vm.reasonErr = '';
        var withPasskeys = vm.resetConfirm.reset_passkeys;
        vm.resetBusy = true;
        StepUpService.Run({
            purpose: 'admin_recovery',
            title: 'Request a reset for ' + name(),
            text: 'Confirm it\'s you. The member is e-mailed straight away and can stop the reset for 24 hours.'
        }, function (token) {
            return TwoFactorService.AdminReset(vm.foundUser.id, { reason: reason, reset_passkeys: withPasskeys, step_up_token: token });
        }).then(function (data) {
            vm.resetBusy = false;
            if (data && data.error === 'CANCELLED') { return; }
            if (data && data.success !== false && data.request) {
                vm.resetConfirm = null;
                if (data.already_pending) {
                    ToastService.warning('A Reset Is Already Waiting', 'Nothing new was sent — the open request is shown below.');
                } else {
                    ToastService.success('Reset Requested',
                        name() + ' has been e-mailed and can stop it until ' + vm.when(data.request.hold_until) + '. Come back after that to complete it.');
                }
                loadRequests();
                return;
            }
            if (data && data.error === 'VALIDATION_ERROR') {
                vm.reasonErr = 'Say why (5 to 500 characters).';
                ToastService.highlightField('sa-sec-reason');
                ToastService.error('Reset Not Requested', vm.reasonErr);
                return;
            }
            ToastService.error('Reset Not Requested', safeMsg(data) || 'Please try again.');
        });
    }

    // Step 2 — after the hold, complete it (again behind a step-up)
    function completeReset(r) {
        if (!vm.foundUser || !r || vm.resetBusy) { return; }
        vm.resetBusy = true;
        StepUpService.Run({
            purpose: 'admin_recovery',
            title: 'Complete the reset for ' + name(),
            text: 'Confirm it\'s you. This removes their two-factor' + (r.reset_passkeys ? ' and all their passkeys' : '') + ' now.'
        }, function (token) {
            return TwoFactorService.AdminResetComplete(vm.foundUser.id, token);
        }).then(function (data) {
            vm.resetBusy = false;
            if (data && data.error === 'CANCELLED') { return; }
            if (data && data.success !== false) {
                ToastService.success('Security Reset Complete',
                    'Two-factor removed' + (r.reset_passkeys ? ' along with all passkeys' : '') + ' for ' + name() +
                    '. They can sign in with just their password now.');
                loadRequests();
                return;
            }
            if (data && data.error === 'HOLD_NOT_PASSED') {
                ToastService.warning('Not Yet', 'The member can stop this until ' + vm.when(data.hold_until || r.hold_until) + '.');
            } else if (data && data.error === 'EXPIRED') {
                ToastService.error('Request Expired', 'It was not completed within 7 days. Open a new request if it is still needed.');
            } else if (data && data.error === 'NOT_FOUND') {
                ToastService.error('No Open Request', 'It may have been stopped by the member. The list below is up to date.');
            } else {
                ToastService.error('Reset Failed', safeMsg(data) || 'Please try again.');
            }
            loadRequests();
        });
    }

    function safeMsg(data) {
        var m = data && data.message;
        return (typeof m === 'string' && m.length < 240 && m.indexOf('<') === -1) ? m : '';
    }
}
