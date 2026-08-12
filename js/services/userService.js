app.factory('UserService', UserService);

    UserService.$inject = ['$http', '$location', '$q'];
    function UserService($http, $location, $q) {
        var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.GetByUsername = GetByUsername;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.Verify = Verify;
        service.InvitePassenger = InvitePassenger;
        service.GetInvite = GetInvite;
        service.GetPaxSecureInvite = GetPaxSecureInvite;
        service.InviteSignup = InviteSignup;
        service.GetAccess = GetAccess;
        service.DeleteInvitation = DeleteInvitation;
        service.ChangeInvitation = ChangeInvitation;
        service.GetInvoices = GetInvoices;
        service.GetAdminClubs = GetAdminClubs;
        service.GetInstructorClubs = GetInstructorClubs;
        service.GetStaffClubs = GetStaffClubs;
        service.GetUpcoming = GetUpcoming;
        service.GetPayments = GetPayments;
        service.ConfirmPaxInvite = ConfirmPaxInvite;
        service.GetPaxSecureInvite2 = GetPaxSecureInvite2;
        service.SignupUserFromPassenger = SignupUserFromPassenger;
        service.ResendPaxCode = ResendPaxCode;
        service.GetInvoicesUserClub = GetInvoicesUserClub;


        return service;

        function GetPayments(user_id){
            return $http.get('/api/v1/payments/get_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetAll() {
            return $http.get('/api/v1/users').then(handleSuccess, handleError2);
        }

        function GetAdminClubs(user_id){
            return $http.get('/api/v1/clubs/get_all_admin_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetInstructorClubs(user_id){
            return $http.get('/api/v1/clubs/get_all_instructor_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        // Clubs where the user is STAFF (instructor OR manager OR CAA
        // HoT/deputy). Uses the dedicated backend endpoint (live — see
        // BACKEND_STAFF_CLUBS_GUIDE.md); the client-side union of the
        // instructor + admin lists remains as a fallback for older API
        // deploys (it covers everyone except a HoT/deputy who is neither).
        // NB: GetAdminClubs is is_manager=1 ONLY — never use it alone to
        // enumerate an instructor's clubs (that lockout bit student records
        // and the CAA hub).
        function GetStaffClubs(user_id){
            return $http.get('/api/v1/clubs/get_all_staff_for_user/'+user_id)
                .then(handleSuccess, function(){ return { success: false }; })
                .then(function(data){
                    if (data && data.success && data.clubs) { return data; }
                    return $q.all([
                        GetInstructorClubs(user_id),
                        GetAdminClubs(user_id)
                    ]).then(function(res){
                        var clubs = [];
                        var seen = {};
                        res.forEach(function(r){
                            ((r && r.clubs) || []).forEach(function(c){
                                if (c && c.id && !seen[c.id]) { seen[c.id] = true; clubs.push(c); }
                            });
                        });
                        return { success: true, clubs: clubs };
                    });
                });
        }

        function GetInvoices(user_id){
            return $http.get('/api/v1/invoices/get_all_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetInvoicesUserClub(user_id, club_id, offset=0, batch=5, all=0){
                                   // invoices/get_all_upcoming_for_user_by_club/:user_id/:club_id
            return $http.get('/api/v1/invoices/get_all_upcoming_for_user_by_club/'+user_id+'/'+club_id+'?offset='+offset+"&batch="+batch+"&all="+all).then(handleSuccess, handleError2);

        }

        function GetUpcoming(user_id){
            return $http.get('/api/v1/invoices/get_all_upcoming_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/users/' + id).then(handleSuccess, handleError2);
        }

        function GetByUsername(username) {
            return $http.get('/api/v1/users/' + username).then(handleSuccess, handleError2);
        }

        function Create(user) {
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/users', user).then(handleSuccess, handleError2);
        }

        function Update(user) {
            return $http.put('/api/v1/users/' + user.id, user).then(handleSuccess, handleError2);
        }

        function Delete(id) {
            return $http.delete('/api/v1/users/' + id).then(handleSuccess, handleError2);
        }

        function Verify(id, verify_token) {
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            // verify_token is the canonical body key (the backend also accepts
            // verify_link as a legacy alias — see FRONTEND_LOGBOOK_SIGNUP_GUIDE.md).
            return $http.post('/api/v1/users/' + id + '/verify', {"verify_token": verify_token}).then(handleSuccess, handleError2);
        }

        function GetAccess(id) {
            return $http.get('/api/v1/users/' + id + '/access').then(handleSuccess, handleError2);
        }


        

        function InvitePassenger(email, invited_by, club_id, membership_id, booking_id){
            var obj = {
                email: email,
                invited_by: invited_by,
                club_id: club_id,
                membership_id: membership_id,
                booking_id: booking_id
            };
            return $http.post('/api/v1/invitations', obj).then(handleSuccess, handleError2);
        }

        function GetInvite(token){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            if(token){
                // Invitation lookup is a PUBLIC page (the recipient is usually
                // logged out). Use handleErrorNoRedirect so a 401/error here does
                // NOT bounce them to /login — the controller shows an inline error.
                return $http.get('/api/v1/invitations/' + token).then(handleSuccess, handleErrorNoRedirect);
            } else {
                return false;
            }

        }

        function GetPaxInvite(token){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            if(token){
                return $http.get('/api/v1/invitations/' + token).then(handleSuccess, handleError2);
            } else {
                return false;
            }
        }

        function ConfirmPaxInvite(token, data){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            if(token && data){
                return $http.post('/api/v1/invitations/signup_pax', data).then(handleSuccess, handleError2);
            } else {
                return false;
            }
        }

        function GetPaxSecureInvite(token, code){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            if(token){
                return $http.get('/api/v1/invitations/' + token + '/' + code).then(handleSuccess, handleError2);
            } else {
                return false;
            }
        }

        function GetPaxSecureInvite2(token, code){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            if(token){
                return $http.post('/api/v1/invitations/verify_invitation_for_user', {"token": token, "code": code}).then(handleSuccess, handleError2);
            } else {
                return false;
            }
        }

        function InviteSignup(data){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/invitations/signup', data).then(handleSuccess, handleError2);
        }

        function SignupUserFromPassenger(token, data){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/invitations/create_user', data).then(handleSuccess, handleError2);
        }

        function ResendPaxCode(token){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/invitations/resend_pax_code', { token: token }).then(handleSuccess, handleError2);
        }

        function ChangeInvitation(data, booking_id){
            return $http.post('/api/v1/invitations/change_invitation/'+booking_id, data).then(handleSuccess, handleError2);
        }

        function DeleteInvitation(id){
            return $http.delete('/api/v1/invitations/'+ id).then(handleSuccess, handleError2);
        }

        // private functions

        function handleSuccess(res) {
            //console.log("SUCCESS");
            return res.data;
        }

        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                $location.path('/login');
            }

            return { success: false, message: res.data, status: res.status };
        }

        // Like handleError2 but never redirects to /login. For PUBLIC endpoints
        // (e.g. invitation lookup) where a 401/error must not bounce a
        // logged-out recipient off the page.
        function handleErrorNoRedirect(res) {
            console.log("ERROR (no redirect)", res);
            return { success: false, message: res.data, status: res.status };
        }

        function handleError(error) {
            console.log("HANDLE ERROR ONE", error);
            return function () {
                return { success: false, message: error };
            };
        }
    }