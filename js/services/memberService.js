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
        service.SearchClubMembers = SearchClubMembers;    // every CURRENT member by name/email (2026-11-04)
        service.GetAllByPics = GetAllByPics;
        service.GetAllByPicsBookinout = GetAllByPicsBookinout;
        service.GetCompany = GetCompany;
        service.GetCompanyDetail = GetCompanyDetail;
        service.VerifyPhone = VerifyPhone;
        service.VerifyPhoneInvite = VerifyPhoneInvite;
        service.VerifyInvitedUser = VerifyInvitedUser;
        service.ResendPhoneCode = ResendPhoneCode;
        service.GetMandate = GetMandate;


        service.GetAllByClubStudents = GetAllByClubStudents;
        service.GetAllByClubPaginated = GetAllByClubPaginated;
        service.GetNoEndDate = GetNoEndDate;   // memberships with no end date (2026-11-07)
       
        return service; 

        function GetMandate(user_id, club_id){
                
            return $http.get('/api/v1/members/'+user_id+'/info/'+club_id).then(handleSuccess, handleError2);
        }
        
        // Text the signup's phone code. token = the invitation that created the
        // account (proof it's theirs); the backend also accepts the logged-in user.
        function VerifyInvitedUser(id, token){
            return $http.post('/api/v1/users/verify_invited_user', {"id": id, "token": token || ""}).then(handleSuccess, handleError2);
        }

        // A fresh code (rate-limited server-side).
        function ResendPhoneCode(id){
            return $http.post('/api/v1/users/resend_phone_code', {"id": id}).then(handleSuccess, handleError2);
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

        // userId: that one current member (the booking panel resolving a waiting-list request's member) — same row shape
        function SearchClubMembers(club_id, q, limit, instructorsOnly, userId){
            return $http.get('/api/v1/members/search/' + club_id + '?q=' + encodeURIComponent(q || '') + '&limit=' + (limit || 25) + (instructorsOnly ? '&instructors=1' : '') + (parseInt(userId, 10) > 0 ? '&user_id=' + parseInt(userId, 10) : '')).then(handleSuccess, handleError2);
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

        // GET members/needs_end_date/{club_id} — the club's current memberships with no end date:
        // needs_end_date (not staff: NOT live, suggested_end given) and staff_open_ended (fine).
        // club_id 0 = ToAviate staff's per-club counts. BACKEND_MEMBER_DATA_ACCESS_GUIDE.md §8a.
        function GetNoEndDate(club_id) {
            return $http.get('/api/v1/members/needs_end_date/' + club_id).then(handleSuccess, handleError2);
        }

        function GetAllByClubPaginated(club_id, page, per_page, search) {
            var params = '?page=' + page + '&per_page=' + per_page;
            if (search && search.trim() !== '') {
                params += '&search=' + encodeURIComponent(search.trim());
            }
            return $http.get('/api/v1/members/club/' + club_id + params).then(handleSuccess, handleError2);
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
            // (the caller sets member.club_id — it was overwritten with club "6" here; the backend
            // only lets the club's admins add members to it)
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