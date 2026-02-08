app.factory('MembershipService', MembershipService);

    MembershipService.$inject = ['$http', '$location'];
    function MembershipService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetAllByClub = GetAllByClub;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.GetAllMembershipPlanes = GetAllMembershipPlanes;
        service.AddMembershipPlanes = AddMembershipPlanes;
        service.UpdateMembershipPlanes = UpdateMembershipPlanes;
        service.GetAllMembershipPlanesNew = GetAllMembershipPlanesNew;
        service.GetAllByClubAvailable = GetAllByClubAvailable;
        service.SendRequest = SendRequest;
        service.GetRequestsByUser = GetRequestsByUser;
        service.GetRequestsByClub = GetRequestsByClub;
        service.DeleteRequest = DeleteRequest;
        service.GetRequestsById = GetRequestsById;
        service.AcceptRequest = AcceptRequest;
        service.ClubAcceptRequest = ClubAcceptRequest;

        service.ResendRequest = ResendRequest;

        return service; 


        function GetAll() {
            return $http.get('/api/v1/memberships/').then(handleSuccess, handleError2);
        }
        
        function GetAllByClub(club_id) {
            return $http.get('/api/v1/memberships/club/'+club_id).then(handleSuccess, handleError2);
        }
        //http://local.arrow.com/api/v1/memberships/club_available/9
        function GetAllByClubAvailable(club_id) {
            return $http.get('/api/v1/memberships/club_available/'+club_id).then(handleSuccess, handleError2);
        }

        function GetById(membership_id, club_id) {
            console.log("club_id "+club_id);
            console.log("membership_id "+membership_id);
            return $http.get('/api/v1/memberships/' + membership_id + '/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetByUrl(url){
            return $http.post('/api/v1/memberships/get_by_url', url).then(handleSuccess, handleError2);
        }

        function Create(club) {
            var url = '/api/v1/memberships/';
            return $http.post(url, club).then(handleSuccess, handleError2);
        }

        function SendRequest(request) {
            var url = '/api/v1/memberships/request';
            return $http.post(url, request).then(handleSuccess, handleError2);
        }

        function ResendRequest(request) {
            var url = '/api/v1/memberships/resend_request';
            return $http.post(url, request).then(handleSuccess, handleError2);
        }

        function AcceptRequest(id, obj){
            var url = '/api/v1/memberships/accept_request/'+id;
            return $http.put(url, obj).then(handleSuccess, handleError2);
        }

        function ClubAcceptRequest(id, obj){
            var url = '/api/v1/memberships/club_accepts_request/'+id;
            return $http.put(url, obj).then(handleSuccess, handleError2);
        }
        
        function GetRequestsByUser(user_id) {
            return $http.get('/api/v1/memberships/requests_by_user/' + user_id).then(handleSuccess, handleError2);
        }

        function GetRequestsByClub(club_id){
            return $http.get('/api/v1/memberships/requests_by_club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetRequestsById(id) {
            return $http.get('/api/v1/memberships/request_by_id/' + id).then(handleSuccess, handleError2);
        }

      
        
        function UpdateRequests(id, content) {
            return $http.put('/api/v1/memberships/request/' + id, content).then(handleSuccess, handleError2);
        }

        function DeleteRequest(id) {
            return $http.delete('/api/v1/memberships/request/' + id).then(handleSuccess, handleError2);
        }

        function Update(membership) {
            return $http.put('/api/v1/memberships/' + membership.membership_id, membership).then(handleSuccess, handleError2);
        }

        function Delete(club_membership_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/memberships/' + club_membership_id).then(handleSuccess, handleError2);
        }

        function GetAllMembershipPlanes(club_id, membership_id){
            return $http.get('/api/v1/membership_planes/'+club_id+'/'+membership_id).then(handleSuccess, handleError2);
        }

        
        function GetAllMembershipPlanesNew(club_id, membership_id){
            return $http.get('/api/v1/planes/club/'+club_id).then(handleSuccess, handleError2);
        }


        function AddMembershipPlanes(club_id, membership_plane){
            return $http.post('/api/v1/membership_planes/'+club_id, membership_plane).then(handleSuccess, handleError2);
        }

        function UpdateMembershipPlanes(membership_id, membership_planes){
            return $http.put('/api/v1/membership_planes/'+membership_id, membership_planes).then(handleSuccess, handleError2);
        }


        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                $location.path('/login');
            }    

            return { success: false, message: res.data, status: res.status };
        }


        // private functions

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(error) {
            return function () {
                return { success: false, message: error };
            };
        }
    }