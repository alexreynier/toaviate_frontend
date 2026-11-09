// ═══════════════════════════════════════════════════════════════════
//  TwoFactorService
//  TOTP two-factor authentication — status, enrolment (setup → confirm
//  → show-once recovery codes), disable, recovery-code regeneration,
//  plus the ToAviate-staff club-requirement toggle and admin reset.
//  The 2FA *login* step (users/login_2fa) lives in AuthenticationService
//  next to the rest of the login ladder.
//  Backend contract: FRONTEND_TWO_FACTOR_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.factory('TwoFactorService', TwoFactorService);

TwoFactorService.$inject = ['$http', '$location'];
function TwoFactorService($http, $location) {
    var service = {};

    service.GetStatus                = GetStatus;
    service.Setup                    = Setup;
    service.Confirm                  = Confirm;
    service.Disable                  = Disable;
    service.RegenerateRecoveryCodes  = RegenerateRecoveryCodes;

    // ToAviate super-admin only
    service.GetClubRequirement       = GetClubRequirement;
    service.SetClubRequirement       = SetClubRequirement;
    service.AdminReset               = AdminReset;
    service.AdminResetRequests       = AdminResetRequests;
    service.AdminResetComplete       = AdminResetComplete;

    // Public — the member's "STOP THIS RESET" e-mail link (/two_factor_reset_cancel/:token, no session)
    service.ResetCancelGet           = ResetCancelGet;
    service.ResetCancelPost          = ResetCancelPost;

    return service;

    // ── Member-facing ──

    function GetStatus() {
        return $http.get('/api/v1/two_factor/status').then(handleSuccess, handleError);
    }

    // Step 1 of enrolment — returns {secret, otpauth_uri}. Shown once, ever.
    function Setup(password) {
        return $http.post('/api/v1/two_factor/setup', { password: password }).then(handleSuccess, handleError);
    }

    // Step 2 — returns {success, recovery_codes:[10]}. Also shown once, ever.
    function Confirm(code) {
        return $http.post('/api/v1/two_factor/confirm', { code: code }).then(handleSuccess, handleError);
    }

    // payload is {password} or {code}
    function Disable(payload) {
        return $http.post('/api/v1/two_factor/disable', payload).then(handleSuccess, handleError);
    }

    // Invalidates ALL previous codes — returns {recovery_codes:[10]}, shown once.
    function RegenerateRecoveryCodes(password) {
        return $http.post('/api/v1/two_factor/recovery_codes', { password: password }).then(handleSuccess, handleError);
    }

    // ── ToAviate super-admin ──

    function GetClubRequirement(club_id) {
        return $http.get('/api/v1/two_factor/club_requirement/' + club_id).then(handleSuccess, handleError);
    }

    function SetClubRequirement(club_id, require_two_factor) {
        return $http.put('/api/v1/two_factor/club_requirement/' + club_id,
            { require_two_factor: require_two_factor ? 1 : 0 }).then(handleSuccess, handleError);
    }

    // Support action for locked-out users (C22, 9 Nov 2026) — two steps, each behind the staff member's own
    // step-up (purpose admin_recovery):
    //   1. AdminReset opens a request {reason 5–500, reset_passkeys, step_up_token} → {success, request:{id, status,
    //      hold_until, expires_at, …}} (or {success, already_pending:true, request}). The member is e-mailed a STOP link.
    //   2. after the 24 h hold, AdminResetComplete {step_up_token} wipes TOTP (and passkeys if asked).
    //      HOLD_NOT_PASSED (+hold_until) · EXPIRED · NOT_FOUND.
    function AdminReset(user_id, payload) {
        return $http.post('/api/v1/two_factor/admin_reset/' + user_id, {
            reason: payload.reason, reset_passkeys: payload.reset_passkeys ? 1 : 0, step_up_token: payload.step_up_token
        }).then(handleSuccess, handleError);
    }

    // → {success, requests:[… newest first, up to 10]}
    function AdminResetRequests(user_id) {
        return $http.get('/api/v1/two_factor/admin_reset/' + user_id).then(handleSuccess, handleError);
    }

    function AdminResetComplete(user_id, step_up_token) {
        return $http.post('/api/v1/two_factor/admin_reset/' + user_id + '/complete',
            { step_up_token: step_up_token }).then(handleSuccess, handleError);
    }

    // ── Public stop page (token = the credential; every failure is the same 404) ──

    // → {success, first_name, requested_at, hold_until}
    function ResetCancelGet(token) {
        return $http.get('/api/v1/two_factor_reset_cancel/' + encodeURIComponent(token)).then(handleSuccess, handleError);
    }

    // → {success}
    function ResetCancelPost(token) {
        return $http.post('/api/v1/two_factor_reset_cancel/' + encodeURIComponent(token) + '/cancel', {}).then(handleSuccess, handleError);
    }

    // ── Handlers — resolve (never reject); normalise the backend's
    //    {error:'WRONG_PASSWORD'|'WRONG_CODE'|…} onto data.error ──

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
            hold_until: data ? data.hold_until : undefined,     // HOLD_NOT_PASSED (admin reset complete)
            fields: data ? data.fields : undefined,             // VALIDATION_ERROR
            status: res ? res.status : 0
        };
    }
}
