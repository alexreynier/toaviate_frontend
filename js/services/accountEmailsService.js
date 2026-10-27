// ═══════════════════════════════════════════════════════════════════
//  AccountEmailsService
//  Multiple email addresses per account — list / add / resend / remove /
//  make primary (member, step-up gated), the PUBLIC confirm + cancel
//  token pages (no session — the links are opened from email on any
//  device), and the ToAviate-staff email-recovery case endpoints.
//  Mutations that need a step_up_token get it from StepUpService.Run.
//  Backend contract: BACKEND_ACCOUNT_EMAILS_PLAN.md §5.2–5.4
// ═══════════════════════════════════════════════════════════════════

app.factory('AccountEmailsService', AccountEmailsService);

AccountEmailsService.$inject = ['$http', '$location'];
function AccountEmailsService($http, $location) {
    var service = {};

    // Member — own account
    service.List         = List;
    service.Add          = Add;
    service.Resend       = Resend;
    service.Remove       = Remove;
    service.MakePrimary  = MakePrimary;

    // Public token pages (logged-out)
    service.ConfirmGet   = ConfirmGet;
    service.ConfirmPost  = ConfirmPost;
    service.ConfirmSms   = ConfirmSms;
    service.CancelGet    = CancelGet;
    service.CancelPost   = CancelPost;

    // ToAviate staff — email recovery
    service.AdminLookup        = AdminLookup;
    service.AdminOpenRecovery  = AdminOpenRecovery;
    service.AdminListRecovery  = AdminListRecovery;
    service.AdminGetRecovery   = AdminGetRecovery;
    service.AdminApprove       = AdminApprove;
    service.AdminCancel        = AdminCancel;
    service.AdminEvents        = AdminEvents;

    return service;

    // ── Member (authenticated, own account only) ──

    // → {success, addresses:[{id, email, is_primary, verified_at, pending, verify_expires_at, can_resend}],
    //    limits:{max_verified, max_pending}}
    function List() {
        return $http.get('/api/v1/account_emails').then(handleSuccess, handleError);
    }

    // → {success, message, address:{id, email, pending:true}} — identical whether or
    //    not the address belongs to someone else (never reveals ownership).
    function Add(email, stepUpToken) {
        return $http.post('/api/v1/account_emails', { email: email, step_up_token: stepUpToken })
            .then(handleSuccess, handleError);
    }

    function Resend(id) {
        return $http.post('/api/v1/account_emails/' + id + '/resend', {}).then(handleSuccess, handleError);
    }

    // DELETE carries a JSON body ({step_up_token}) — needs the explicit config form
    // (same as WebauthnService.Remove).
    function Remove(id, stepUpToken) {
        return $http.delete('/api/v1/account_emails/' + id, {
            data: { step_up_token: stepUpToken },
            headers: { 'Content-Type': 'application/json' }
        }).then(handleSuccess, handleError);
    }

    // → {success, user:{…clean user with the new email…}, sessions_revoked:n}
    function MakePrimary(id, stepUpToken) {
        return $http.post('/api/v1/account_emails/' + id + '/make_primary', { step_up_token: stepUpToken })
            .then(handleSuccess, handleError);
    }

    // ── Public confirm / cancel (Api-Key only, no session) ──
    // Any failure is a uniform 404 — these must NOT bounce to /login.

    // → {success, email_masked, first_name, kind:'add'|'recovery'}
    function ConfirmGet(token) {
        return $http.get('/api/v1/account_email_confirm/' + encodeURIComponent(token))
            .then(handleSuccess, handlePublicError);
    }

    // → {success, email, sms_required?:true, case_token?}
    function ConfirmPost(token) {
        return $http.post('/api/v1/account_email_confirm/' + encodeURIComponent(token) + '/confirm', {})
            .then(handleSuccess, handlePublicError);
    }

    // recovery only
    function ConfirmSms(token, code) {
        return $http.post('/api/v1/account_email_confirm/' + encodeURIComponent(token) + '/sms', { code: code })
            .then(handleSuccess, handlePublicError);
    }

    // → {success, kind:'recovery', new_email_masked, opened_at}
    function CancelGet(token) {
        return $http.get('/api/v1/account_email_confirm/' + encodeURIComponent(token) + '/cancel')
            .then(handleSuccess, handlePublicError);
    }

    function CancelPost(token) {
        return $http.post('/api/v1/account_email_confirm/' + encodeURIComponent(token) + '/cancel', {})
            .then(handleSuccess, handlePublicError);
    }

    // ── ToAviate staff (strict gate + admin 2FA + step-up 'admin_recovery') ──

    function AdminLookup(q) {
        return $http.get('/api/v1/account_emails/admin/lookup', { params: { q: q } })
            .then(handleSuccess, handleError);
    }

    // payload: {user_id, new_email, verification_notes, verification_checks:[…], step_up_token}
    function AdminOpenRecovery(payload) {
        return $http.post('/api/v1/account_emails/admin/recovery', payload).then(handleSuccess, handleError);
    }

    // → {success, open:[…], recent:[…]}
    function AdminListRecovery() {
        return $http.get('/api/v1/account_emails/admin/recovery').then(handleSuccess, handleError);
    }

    function AdminGetRecovery(id) {
        return $http.get('/api/v1/account_emails/admin/recovery/' + id).then(handleSuccess, handleError);
    }

    // second admin only — backend enforces FOUR_EYES
    function AdminApprove(id, stepUpToken) {
        return $http.post('/api/v1/account_emails/admin/recovery/' + id + '/approve', { step_up_token: stepUpToken })
            .then(handleSuccess, handleError);
    }

    function AdminCancel(id, stepUpToken, reason) {
        return $http.post('/api/v1/account_emails/admin/recovery/' + id + '/cancel',
            { step_up_token: stepUpToken, reason: reason }).then(handleSuccess, handleError);
    }

    // → user_security_events for one user
    function AdminEvents(user_id) {
        return $http.get('/api/v1/account_emails/admin/events', { params: { user_id: user_id } })
            .then(handleSuccess, handleError);
    }

    // ── Handlers — resolve (never reject); normalise the backend's
    //    {error:'STEP_UP_REQUIRED'|'LIMIT_REACHED'|…} onto data.error ──

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

    // Public pages run logged-out: a 401/404 here is the uniform
    // "invalid or expired link", never a reason to redirect to /login.
    function handlePublicError(res) {
        var data = res && res.data;
        return {
            success: false,
            error: (data && data.error) || null,
            status: res ? res.status : 0,
            message: data ? (data.message || data.error || data) : 'Request failed'
        };
    }
}
