// ═══════════════════════════════════════════════════════════════════
//  AddressLookupService
//  Google-Places-backed address autocomplete (proxied server-side —
//  the key never reaches the browser). One session id must be reused
//  for a whole lookup (every Autocomplete call + the final Details
//  call) — that's how Google bills it as a single session; discard it
//  after selection. The old postcode → pick-your-house flow is dead
//  upstream — every form now uses the <address-lookup> directive.
//  Backend contract: FRONTEND_ADDRESS_LOOKUP_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.factory('AddressLookupService', AddressLookupService);

AddressLookupService.$inject = ['$http'];
function AddressLookupService($http) {
    var base = '/api/v1/addresses';
    function ok(r){ return r.data; }
    function err(r){ return (r && r.data) ? r.data : { success: false, message: 'Request failed' }; }
    var s = {};

    // Suggestions as the user types.
    s.Autocomplete = function(q, session){
        return $http.get(base + '/autocomplete?q=' + encodeURIComponent(q)
            + '&session=' + encodeURIComponent(session)).then(ok, err);
    };

    // Selected suggestion → structured address for the form.
    s.Details = function(placeId, session){
        return $http.get(base + '/details/' + placeId + '?session=' + encodeURIComponent(session)).then(ok, err);
    };

    // New session id per address-entry attempt (any random token ≤64 chars).
    s.NewSession = function(){
        return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    };

    return s;
}
