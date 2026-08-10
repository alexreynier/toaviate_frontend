// ═══════════════════════════════════════════════════════════════════
//  PlatformKeyService
//  ToAviate super-admin management of the API keys external platforms
//  (airshows.toaviate, future partners) use to call ToAviate
//  server-to-server:
//    – List every key with status, scopes and usage
//    – Create (the full secret is returned ONCE, on create/rotate only)
//    – Edit name/description/scopes/IP pins, enable/disable
//    – Rotate the secret, revoke instantly, hard delete
//  Backend contract: FRONTEND_PLATFORM_KEYS_ADMIN_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.factory('PlatformKeyService', PlatformKeyService);

PlatformKeyService.$inject = ['$http', '$location'];
function PlatformKeyService($http, $location) {

    var service = {};

    service.GetAll     = GetAll;
    service.GetOne     = GetOne;
    service.Create     = Create;
    service.Update     = Update;
    service.Regenerate = Regenerate;
    service.Revoke     = Revoke;
    service.Delete     = Delete;

    // Status of a key row (MySQL returns numerics as strings — coerce).
    //   active == 1                → 'active'
    //   active == 0 && revoked_at  → 'revoked'
    //   active == 0 otherwise      → 'disabled'
    service.statusOf = statusOf;

    // Scope strings are "METHOD path-pattern" (e.g. "GET airshows/aircraft/*").
    service.scope_methods = ['GET', 'POST', 'PUT', 'DELETE'];
    service.parseScope    = parseScope;

    return service;

    // ── CRUD ──
    function GetAll() {
        return $http.get('/api/v1/platform_keys').then(handleSuccess, handleError2);
    }

    function GetOne(id) {
        return $http.get('/api/v1/platform_keys/' + id).then(handleSuccess, handleError2);
    }

    // Returns { success, id, key, key_prefix } — the ONLY time the full
    // secret is ever returned. Show it once, never store it.
    function Create(key) {
        return $http.post('/api/v1/platform_keys', key).then(handleSuccess, handleError2);
    }

    // Accepts any subset of platform_name / description / allowed_endpoints /
    // allowed_ips / active. active:1 on a revoked key re-activates it.
    function Update(id, changes) {
        return $http.put('/api/v1/platform_keys/' + id, changes)
            .then(handleSuccess, handleError2);
    }

    // Old secret stops working immediately. Same show-once response as Create.
    function Regenerate(id) {
        return $http.post('/api/v1/platform_keys/' + id + '/regenerate', {})
            .then(handleSuccess, handleError2);
    }

    // Emergency stop — keeps the row + usage history.
    function Revoke(id) {
        return $http.post('/api/v1/platform_keys/' + id + '/revoke', {})
            .then(handleSuccess, handleError2);
    }

    // Hard delete — usage history is lost. Prefer Revoke.
    function Delete(id) {
        return $http.delete('/api/v1/platform_keys/' + id)
            .then(handleSuccess, handleError2);
    }

    // ── Helpers ──
    function statusOf(key) {
        if (!key) { return 'disabled'; }
        if (parseInt(key.active, 10) === 1) { return 'active'; }
        return key.revoked_at ? 'revoked' : 'disabled';
    }

    // "GET airshows/aircraft/*" → { method: 'GET', path: 'airshows/aircraft/*' }
    function parseScope(scope) {
        var s     = String(scope || '').trim();
        var space = s.indexOf(' ');
        if (space === -1) { return { method: 'GET', path: s }; }
        return {
            method: s.slice(0, space).toUpperCase(),
            path:   s.slice(space + 1).trim()
        };
    }

    function handleSuccess(res) {
        return res.data;
    }

    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}
