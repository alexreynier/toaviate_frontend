// ═══════════════════════════════════════════════════════════════════
//  LogbookSignupService
//  The free-digital-logbook growth funnel: public self-serve signup,
//  one-click instructor signup from the endorsement-confirm page,
//  invite-a-pilot (+ my invites), the public invite landing page, and
//  accepting a club invitation into an existing (logged-in) account.
//  NEUTRAL RESPONSES: the public signup endpoints never reveal whether
//  an email already has an account — "check your email" is the
//  universal success state.
//  Backend contract: FRONTEND_LOGBOOK_SIGNUP_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.factory('LogbookSignupService', LogbookSignupService);

LogbookSignupService.$inject = ['$http'];
function LogbookSignupService($http) {
    var base = '/api/v1/logbook_signup';
    function ok(r){ return r.data; }
    function err(r){ return (r && r.data) ? r.data : { success: false, message: 'Request failed' }; }
    var s = {};

    // PUBLIC — self-serve signup. Always neutral on success.
    // p: {first_name, last_name, email, password, password2}
    s.Register = function(p){ return $http.post(base + '/register', p).then(ok, err); };

    // PUBLIC — one-click signup on the endorsement-confirm page.
    // token = the SAME endorsement confirmation token from the page URL.
    s.FromEndorsement = function(token, password, password2, first, last){
        return $http.post(base + '/from_endorsement',
            { token: token, password: password, password2: password2,
              first_name: first, last_name: last }).then(ok, err);
    };

    // PUBLIC — invite-link signup page.
    s.GetInvite  = function(token){ return $http.get(base + '/invite/' + token).then(ok, err); };
    // p: {token, first_name, last_name, email, password, password2}
    s.FromInvite = function(p){ return $http.post(base + '/from_invite', p).then(ok, err); };

    // AUTH — invite a pilot + my invites.
    s.Invite  = function(email, first){ return $http.post(base + '/invite', { email: email, first_name: first }).then(ok, err); };
    s.Invites = function(){ return $http.get(base + '/invites').then(ok, err); };

    // AUTH — accept a club invitation into the logged-in account.
    s.AcceptExisting = function(token){
        return $http.post('/api/v1/invitations/accept_existing', { token: token }).then(ok, err);
    };

    return s;
}
