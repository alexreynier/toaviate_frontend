// ═══════════════════════════════════════════════════════════════════
//  WebauthnService
//  Passkey (WebAuthn) support — biometric / device sign-in.
//  Owns the base64url ⇄ ArrayBuffer conversion both ceremonies need,
//  and wraps each full ceremony (server options → browser prompt →
//  server verify) in a single promise so controllers stay simple.
//  login_options / login_verify are PUBLIC endpoints (pre-auth) —
//  they are exempted from the session-expiry interceptor in app.js.
//  Backend contract: FRONTEND_TWO_FACTOR_GUIDE.md §1.3 + §3
// ═══════════════════════════════════════════════════════════════════

app.factory('WebauthnService', WebauthnService);

WebauthnService.$inject = ['$http', '$location', '$q'];
function WebauthnService($http, $location, $q) {
    var service = {};

    service.isSupported = isSupported;
    service.Login       = Login;          // full pre-auth ceremony → login2 shape
    service.Register    = Register;       // full add-passkey ceremony
    service.List        = List;
    service.Rename      = Rename;
    service.Remove      = Remove;

    return service;

    function isSupported() {
        return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get);
    }

    // ── Passkey LOGIN (public — no session yet) ──
    // Resolves with the login2 shape {success, user, session} or a
    // normalised {success:false, error, message}. Challenges are
    // single-use and expire in 2 minutes — a fresh one per attempt.
    function Login() {
        return $http.post('/api/v1/webauthn/login_options', {}).then(handleSuccess, handleError)
            .then(function (data) {
                if (!data || data.success === false || !data.publicKey) {
                    return failureOf(data, 'Passkey sign-in is unavailable right now.');
                }
                var publicKey = prepRequestOptions(data.publicKey);
                var started = new Date().getTime();
                return $q.when(navigator.credentials.get({ publicKey: publicKey }))
                    .then(function (cred) {
                        return $http.post('/api/v1/webauthn/login_verify', {
                            challenge_key: data.challenge_key,
                            credential: {
                                id: cred.id,
                                response: {
                                    clientDataJSON:    b64u(cred.response.clientDataJSON),
                                    authenticatorData: b64u(cred.response.authenticatorData),
                                    signature:         b64u(cred.response.signature),
                                    userHandle:        cred.response.userHandle ? b64u(cred.response.userHandle) : null
                                }
                            }
                        }).then(handleSuccess, handleError);
                    }, function (err) { return ceremonyError(err, started); });
            });
    }

    // ── Add a passkey (authenticated, password re-auth) ──
    // Resolves {success, credential:{id, label, is_discoverable}} or
    // {success:false, error:'WRONG_PASSWORD'|'ALREADY_REGISTERED'|
    //  'CHALLENGE_EXPIRED'|'CEREMONY_CANCELLED'|…, message}.
    function Register(password, label) {
        return $http.post('/api/v1/webauthn/register_options', { password: password }).then(handleSuccess, handleError)
            .then(function (data) {
                if (!data || data.success === false || !data.publicKey) {
                    return failureOf(data, 'Could not start passkey registration.');
                }
                var publicKey = prepCreationOptions(data.publicKey);
                var started = new Date().getTime();
                return $q.when(navigator.credentials.create({ publicKey: publicKey }))
                    .then(function (cred) {
                        return $http.post('/api/v1/webauthn/register_verify', {
                            challenge_key: data.challenge_key,
                            label: label || 'Passkey',
                            credential: {
                                id: cred.id,
                                rawId: b64u(cred.rawId),
                                response: {
                                    clientDataJSON:    b64u(cred.response.clientDataJSON),
                                    attestationObject: b64u(cred.response.attestationObject)
                                },
                                transports: cred.response.getTransports ? cred.response.getTransports() : [],
                                clientExtensionResults: cred.getClientExtensionResults()
                            }
                        }).then(handleSuccess, handleError);
                    }, function (err) { return ceremonyError(err, started); });
            });
    }

    // ── Passkey management (authenticated) ──

    function List() {
        return $http.get('/api/v1/webauthn').then(handleSuccess, handleError);
    }

    function Rename(id, label) {
        return $http.put('/api/v1/webauthn/' + id, { label: label }).then(handleSuccess, handleError);
    }

    // DELETE carries a JSON body ({password}) — needs the explicit config form.
    function Remove(id, password) {
        return $http({
            method: 'DELETE',
            url: '/api/v1/webauthn/' + id,
            data: { password: password },
            headers: { 'Content-Type': 'application/json' }
        }).then(handleSuccess, handleError);
    }

    // ── base64url ⇄ ArrayBuffer ──

    function b64u(buf) {
        var bytes = new Uint8Array(buf);
        var str = '';
        for (var i = 0; i < bytes.length; i++) { str += String.fromCharCode(bytes[i]); }
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function fromB64u(s) {
        var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        return bytes.buffer;
    }

    // navigator.credentials.get() options — challenge + allowCredentials ids
    function prepRequestOptions(publicKey) {
        var pk = angular.copy(publicKey);
        pk.challenge = fromB64u(pk.challenge);
        if (pk.allowCredentials) {
            for (var i = 0; i < pk.allowCredentials.length; i++) {
                pk.allowCredentials[i].id = fromB64u(pk.allowCredentials[i].id);
            }
        }
        return pk;
    }

    // navigator.credentials.create() options — challenge + user.id + excludeCredentials ids
    function prepCreationOptions(publicKey) {
        var pk = angular.copy(publicKey);
        pk.challenge = fromB64u(pk.challenge);
        if (pk.user && pk.user.id) { pk.user.id = fromB64u(pk.user.id); }
        if (pk.excludeCredentials) {
            for (var i = 0; i < pk.excludeCredentials.length; i++) {
                pk.excludeCredentials[i].id = fromB64u(pk.excludeCredentials[i].id);
            }
        }
        return pk;
    }

    // ── Handlers — resolve (never reject) ──

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
            status: res ? res.status : 0
        };
    }

    // The browser prompt was dismissed / timed out / blocked.
    // NotAllowedError covers BOTH a genuine user cancel AND the browser
    // refusing to open the prompt at all (e.g. Chrome blocks WebAuthn
    // entirely on origins with TLS certificate errors — common in local
    // dev). A real cancel needs a human to see and dismiss a dialog, so an
    // instant rejection means blocked, not cancelled — callers silence
    // CANCELLED but must surface BLOCKED/FAILED.
    function ceremonyError(err, started) {
        console.log('WebAuthn ceremony error:', err && err.name, err && err.message);
        var elapsed = new Date().getTime() - (started || 0);
        var dismissable = err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
        if (dismissable && elapsed < 1500) {
            return {
                success: false,
                error: 'CEREMONY_BLOCKED',
                message: 'Your browser refused to open the passkey prompt. This can happen ' +
                         'on sites with certificate problems or when passkeys are disabled. ' +
                         'Please sign in with your password instead.'
            };
        }
        return {
            success: false,
            error: dismissable ? 'CEREMONY_CANCELLED' : 'CEREMONY_FAILED',
            message: dismissable ? 'Passkey prompt was cancelled.'
                                 : ((err && err.message) || 'The passkey prompt failed on this device.')
        };
    }

    function failureOf(data, fallback) {
        return {
            success: false,
            error: (data && data.error) || null,
            message: (data && (data.message || data.error)) || fallback
        };
    }
}
