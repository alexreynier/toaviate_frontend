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

    // Support action for locked-out users — wipes TOTP, and passkeys too when asked.
    function AdminReset(user_id, reset_passkeys) {
        return $http.post('/api/v1/two_factor/admin_reset/' + user_id,
            { reset_passkeys: reset_passkeys ? 1 : 0 }).then(handleSuccess, handleError);
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
            status: res ? res.status : 0
        };
    }
}
