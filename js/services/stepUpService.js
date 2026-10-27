// ═══════════════════════════════════════════════════════════════════
//  StepUpService
//  Re-authentication ("step-up") for sensitive account actions —
//  password, then a second factor (TOTP / recovery code, emailed code,
//  or passkey) → a short-lived step_up_token the caller spends once on
//  the gated endpoint. Generic: account_emails today, password change
//  and passkey enrolment later.
//
//  Start / Verify are the raw endpoints. RequireToken opens the modal
//  (views/modals/step_up.html + StepUpModalController) and resolves with
//  the token. Run is what callers should actually use:
//
//      StepUpService.Run(
//          { purpose: 'account_emails', deliverTo: null,
//            title: 'Add an email address',
//            text:  'Confirm your password to add an address.' },
//          function (token) { return AccountEmailsService.Add(vm.email, token); }
//      ).then(function (data) {
//          if (data.error === 'CANCELLED') { return; }        // user closed the modal — stay quiet
//          if (data.success) { ... } else { ToastService.error('Not added', data.message); }
//      });
//
//  Run(opts, action) → promise that ALWAYS resolves (never rejects):
//    · opens the modal; on success calls action(token) — action must
//      return a promise of a normal service result object;
//    · if that result is {success:false, error:'STEP_UP_REQUIRED'} (token
//      expired / already spent) it reopens the modal ONCE and retries;
//    · if the user dismisses the modal at any point it resolves
//      {success:false, error:'CANCELLED'};
//    · otherwise resolves with whatever action() resolved.
//
//  opts = { purpose: 'account_emails' | 'admin_recovery',
//           deliverTo: <address_id | null>,        // email_code: which verified address
//           title: string, text: string,           // modal header + intro copy (optional)
//           alternatives: [{id, email}] }          // optional: verified addresses the user may
//                                                  // pick for the emailed code (the start
//                                                  // response's `addresses` wins when present)
//
//  Backend contract: BACKEND_ACCOUNT_EMAILS_PLAN.md §5.1
// ═══════════════════════════════════════════════════════════════════

app.factory('StepUpService', StepUpService);

StepUpService.$inject = ['$http', '$location', '$uibModal', '$q'];
function StepUpService($http, $location, $uibModal, $q) {
    var service = {};

    service.Start        = Start;
    service.Verify       = Verify;
    service.RequireToken = RequireToken;
    service.Run          = Run;

    return service;

    // ── Endpoints ──

    // → {success, step_up_key, method:'totp'|'passkey'|'email_code',
    //    alternatives:['recovery'], sent_to_masked?, publicKey?, addresses?}
    //    or {success:false, error:'WRONG_PASSWORD'|'TOO_MANY_ATTEMPTS'|'RATE_LIMITED'|…}
    function Start(password, purpose, deliverTo) {
        var body = { password: password, purpose: purpose };
        if (deliverTo !== null && deliverTo !== undefined && deliverTo !== '') {
            body.deliver_to = deliverTo;
        }
        return $http.post('/api/v1/step_up/start', body).then(handleSuccess, handleError);
    }

    // payload: {code} | {type:'recovery', code} | {credential:{…}}
    // → {success, step_up_token, expires_in:600}
    //    or {success:false, error:'WRONG_CODE', attempts_remaining:n} | 'EXPIRED' | …
    function Verify(stepUpKey, payload) {
        return $http.post('/api/v1/step_up/verify', angular.extend({ step_up_key: stepUpKey }, payload))
            .then(handleSuccess, handleError);
    }

    // ── Modal ──

    // Resolves with the step_up_token string; rejects when the user dismisses.
    function RequireToken(opts) {
        return $uibModal.open({
            templateUrl: 'views/modals/step_up.html',
            controller: 'StepUpModalController',
            controllerAs: 'vm',
            backdrop: 'static',
            keyboard: false,
            windowClass: 'sec-modal-window',
            resolve: { opts: function () { return opts || {}; } }
        }).result;
    }

    // See the header comment for the full semantics.
    function Run(opts, action) {
        return attempt(false);

        function attempt(retried) {
            return RequireToken(opts).then(function (token) {
                return $q.when(action(token)).then(function (result) {
                    if (result && result.success === false && result.error === 'STEP_UP_REQUIRED' && !retried) {
                        console.log('StepUpService.Run: token rejected, re-authenticating once');
                        return attempt(true);
                    }
                    return result;
                }, function (err) {
                    // Services resolve-never-reject, so this only fires on a thrown bug.
                    console.log('StepUpService.Run: action failed', err);
                    return { success: false, error: 'ACTION_FAILED', message: 'Something went wrong. Please try again.' };
                });
            }, function () {
                return { success: false, error: 'CANCELLED', message: 'Cancelled.' };
            });
        }
    }

    // ── Handlers — resolve (never reject); same shape as TwoFactorService ──

    function handleSuccess(res) { return res.data; }

    function handleError(res) {
        if (res && res.status == 401) {
            $location.path('/login');
        }
        var data = res && res.data;
        return {
            success: false,
            error: data ? data.error : null,
            message: data ? (data.message || data.error) : 'Request failed',
            attempts_remaining: data ? data.attempts_remaining : undefined,
            status: res ? res.status : 0
        };
    }
}
