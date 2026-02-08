app.factory('MemberService', MemberService);

    MemberService.$inject = ['$http', '$location'];
    function MemberService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetAllByClub = GetAllByClub;
        service.GetById = GetById;
        service.Create = Create;
        service.CreateMany = CreateMany;
        service.Verify = Verify;

        service.SendInvite = SendInvite;
        service.send_invite_by_club = send_invite_by_club;

        service.Update = Update;
        service.Delete = Delete;
        service.GetMemberPlanes = GetMemberPlanes;
        service.SaveMemberPlanes = SaveMemberPlanes;

        service.GetUserMemberships = GetUserMemberships;

        service.GetAllByClubInstructor = GetAllByClubInstructor;

        service.GetAllByClubAndName = GetAllByClubAndName;
        service.GetOneForUser = GetOneForUser;
        service.UpdateOneByUser = UpdateOneByUser;
        service.GetUserClubs = GetUserClubs;
        service.GetAllByPics = GetAllByPics;
        service.GetAllActiveByClub = GetAllActiveByClub;
        service.GetAllByPics = GetAllByPics;
        service.GetAllByPicsBookinout = GetAllByPicsBookinout;
        service.GetCompany = GetCompany;
        service.GetCompanyDetail = GetCompanyDetail;
        service.VerifyPhone = VerifyPhone;
        service.VerifyPhoneInvite = VerifyPhoneInvite;
        service.VerifyInvitedUser = VerifyInvitedUser;
        service.GetMandate = GetMandate;


        service.GetAllByClubStudents = GetAllByClubStudents;
       
        return service; 

        function GetMandate(user_id, club_id){
                
            return $http.get('/api/v1/members/'+user_id+'/info/'+club_id).then(handleSuccess, handleError2);
        }
        
        function VerifyInvitedUser(id){
                
            return $http.post('/api/v1/users/verify_invited_user', {"id": id}).then(handleSuccess, handleError2);
        }

        function VerifyPhoneInvite(verification, id){

            return $http.post('/api/v1/users/verify_phone_invite', {"id": id, "verification": verification}).then(handleSuccess, handleError2);


        }

        function VerifyPhone(verification, id){

            return $http.post('/api/v1/users/verify_phone', {"id": id, "verification": verification}).then(handleSuccess, handleError2);

        }

        function SendInvite(invitation){
            return $http.post('/api/v1/members/send_invite', invitation).then(handleSuccess, handleError2);
        }

        function send_invite_by_club(invitation){
            return $http.post('/api/v1/members/send_invite_by_club', invitation).then(handleSuccess, handleError2);
        }

        function GetCompany(name){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";

            return $http.post('/api/v1/users/company', {"name": name}).then(handleSuccess, handleError2);
        }

        function GetCompanyDetail(number){
            return $http.post('/api/v1/users/company_detail', {"number": number}).then(handleSuccess, handleError2);
        }

        function GetUserMemberships(user_id){
            return $http.get('/api/v1/users/'+user_id+'/memberships').then(handleSuccess, handleError2);
        }

        function GetUserClubs(user_id){
            return $http.get('/api/v1/users/'+user_id+'/clubs').then(handleSuccess, handleError2);
        }

        function GetAllActiveByClub(club_id, end){
            return $http.get('/api/v1/members/active_club/'+club_id+'/'+end).then(handleSuccess, handleError2);
        }

        function GetAll() {
            return $http.get('/api/v1/members/').then(handleSuccess, handleError2);
        }

        function GetAllByClub(club_id) {
            return $http.get('/api/v1/members/club/'+club_id).then(handleSuccess, handleError2);
        }

        function GetAllByClubStudents(club_id) {
            return $http.get('/api/v1/members/club_student/'+club_id).then(handleSuccess, handleError2);
        }

        function GetAllByPics(club_id, user_id) {
            return $http.get('/api/v1/members/get_pics/'+club_id+'/'+user_id).then(handleSuccess, handleError2);
        }

        function GetAllByClubInstructor(club_id, user_id){
            return $http.get('/api/v1/members/get_instructors/'+club_id+'/'+user_id).then(handleSuccess, handleError2);
        }

        function GetAllByPicsBookinout(booking_id, club_id, user_id, supervised=0){
            return $http.get('/api/v1/members/pics_book_in_out/'+booking_id+'/'+club_id+'/'+user_id+'/'+supervised).then(handleSuccess, handleError2);
        }

        //  function GetAllByClubCurrent(club_id) {
        //     return $http.get('/api/v1/members/club2/'+club_id).then(handleSuccess, handleError2);
        // }

        function GetAllByClubAndName(club_id, name) {
            return $http.get('/api/v1/members/club_and_name/'+club_id+'/'+name).then(handleSuccess, handleError2);
        }

        function GetById(membership_id, club_id) {
            console.log("club_id "+club_id);
            console.log("membership_id "+membership_id);
            return $http.get('/api/v1/members/' + membership_id + '/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetOneForUser(id){
            
            return $http.get('/api/v1/members/' + id + '/for_user').then(handleSuccess, handleError2);
        }

        function UpdateOneByUser(id, obj){
            return $http.put('/api/v1/members/' + id + '/for_user', obj).then(handleSuccess, handleError2);
        }

        function GetMemberPlanes(user_id, club_id){
            return $http.get('/api/v1/members/user/'+user_id+'/club/'+club_id+'/planes').then(handleSuccess, handleError2);
        }

         function SaveMemberPlanes(user_id, club_id, planes){
            return $http.post('/api/v1/members/user/'+user_id+'/club/'+club_id+'/planes', planes).then(handleSuccess, handleError2);
        }

        function GetByUrl(url){
            return $http.post('/api/v1/members/get_by_url', url).then(handleSuccess, handleError2);
        }

        function Create(member) {
            //this is actually where we invite the user to join
            member.club_id = "6";
            var url = '/api/v1/members/';
            return $http.post(url, member).then(handleSuccess, handleError2);
        }

        function CreateMany(members){
            var url = '/api/v1/members/many';
            return $http.post(url, members).then(handleSuccess, handleError2);
        }

        function Update(membership) {
            return $http.put('/api/v1/members/' + membership.id, membership).then(handleSuccess, handleError2);
        }

        function Verify(verify) {
            return $http.put('/api/v1/member_checks', verify).then(handleSuccess, handleError2);
        }

        

        function Delete(club_membership_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/members/' + club_membership_id).then(handleSuccess, handleError2);
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