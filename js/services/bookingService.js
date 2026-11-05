app.factory('BookingService', BookingService);

    BookingService.$inject = ['$http', '$location'];
    function BookingService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetEdit = GetEdit;
        service.Create = Create;
        // service.Update = Update;
        service.DeleteBooking = DeleteBooking;
        service.GetInstructors = GetInstructors;
        service.GetAllPlanes = GetAllPlanes;
        service.GetPlaneInstructors = GetPlaneInstructors;
        service.GetRentalItems = GetRentalItems;
        service.updateBooking = updateBooking;
        service.GetAllUserClub = GetAllUserClub;
        service.GetPlaneInstructorsEdit = GetPlaneInstructorsEdit;
        service.GetClubInstructors = GetClubInstructors;
        service.GetIfCurrent = GetIfCurrent;
        service.GetTodayBookingsUser = GetTodayBookingsUser;
        service.GetForBookout = GetForBookout;
        service.GetForBookIn = GetForBookIn;
        service.GetBookingsToReview = GetBookingsToReview;
        service.GetAllInstructor = GetAllInstructor;
        service.AcceptBooking = AcceptBooking;
        service.DeclineBooking = DeclineBooking;
        service.ResendInvitation = ResendInvitation;
        service.DeleteInvitation = DeleteInvitation;

        service.GetBookingsToBrief = GetBookingsToBrief;
        service.GetBookingsToDebrief = GetBookingsToDebrief;
        service.SetBookingToBriefed = SetBookingToBriefed;

        service.GetUpcoming = GetUpcoming;
        
        service.GetForForDebrief = GetForForDebrief;
        service.GetBookingsToDebrief = GetBookingsToDebrief;

        service.GetForForDebriefPls = GetForForDebriefPls;

        service.GetInstructorByUser = GetInstructorByUser;
        service.GetInstructorPlanes = GetInstructorPlanes;
        service.GetBookingsToApproveClub = GetBookingsToApproveClub;
        service.GetNextLesson = GetNextLesson;
        service.GetScheduleVersion = GetScheduleVersion;
        service.PassengerPreview = PassengerPreview;          // what saving will do for each passenger (accepted | invited)
        service.PassengerDeclineGet = PassengerDeclineGet;    // public "can't make it" page (token) — shows only
        service.PassengerDeclinePost = PassengerDeclinePost;  // … and the explicit POST that declines

        return service;

        function GetBookingsToReview(user_id){
            return $http.get('/api/v1/bookings/to_approve/'+user_id).then(handleSuccess, handleError2);
        }
        function GetBookingsToApproveClub(club_id){
            return $http.get('/api/v1/bookings/to_approve_club/'+club_id).then(handleSuccess, handleError2);
        }

        // Scheduler v2 booking panel: the suggested next lesson for a student on a course
        // (the briefing / debrief rule). → { success, lesson: {id,title,organise,course_reference}|null, reason }
        function GetNextLesson(user_id, course_id){
            return $http.get('/api/v1/bookings/next_lesson/'+user_id+'/'+course_id).then(handleSuccess, handleError2);
        }

        function GetForBookIn(id){
            return $http.get('/api/v1/plane_log_sheets/'+id).then(handleSuccess, handleError2);
        }

        function GetAllUserClub(user_id,club_id,start,end){
            // /bookings/user_club/USER_ID/CLUB_ID/START/END
            return $http.get('/api/v1/bookings/user_club/'+user_id+'/'+club_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetAll(user_id, start, end, show_all_instructors) {
            // show_all_instructors: the viewer's override of the club's
            // hide_unavailable_instructors calendar setting (bookings page toggle)
            var q = show_all_instructors ? '?show_all_instructors=1' : '';
            return $http.get('/api/v1/bookings/'+user_id+'/'+start+'/'+end + q).then(handleSuccess, handleError2);
        }

        function GetAllInstructor(user_id, start, end) {
            return $http.get('/api/v1/bookings/instructor_schedule/'+user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetTodayBookingsUser(user_id) {
            return $http.get('/api/v1/bookings/user_bookings_today/'+user_id).then(handleSuccess, handleError2);
        }

        function GetUpcoming(user_id, page, per_page, club_id) {
            var params = '?page=' + (page || 1) + '&per_page=' + (per_page || 20);
            if (club_id) params += '&club_id=' + club_id;
            return $http.get('/api/v1/bookings/upcoming/' + user_id + params).then(handleSuccess, handleError2);
        }
        
        function GetForBookout(user_id, booking_id) {
            return $http.get('/api/v1/bookings/for_bookout/'+user_id+'/'+booking_id).then(handleSuccess, handleError2);
        }

        function GetEdit(user_id, booking_id) {
            return $http.get('/api/v1/bookings/edit/'+user_id+'/'+booking_id).then(handleSuccess, handleError2);
        }

        function updateBooking(update, user_id){
            update.person_editing = user_id;
            //console.log("UPDATE CONTENT", update);
            //start and end need to be defined...
            return $http.put('/api/v1/bookings/'+update.id+'/'+user_id, update).then(handleSuccess, handleError2);
        }

        function AcceptBooking(id, user_id){
            return $http.put('/api/v1/bookings/accept_booking/'+id+'/'+user_id, {}).then(handleSuccess, handleError2);
        }
        function DeclineBooking(id, user_id, content){
            return $http.put('/api/v1/bookings/decline_booking/'+id+'/'+user_id, content).then(handleSuccess, handleError2);
        }

        function GetIfCurrent(user_id, plane_id, end_date){
            return $http.get('/api/v1/bookings/pilot_currency/'+user_id+'/'+plane_id+'/'+end_date).then(handleSuccess, handleError2);
        }

        function GetAllPlanes(user_id, start, end, show_all, rented_id = 0) {
            console.log("GET ALL PLANES? ");
            return $http.get('/api/v1/bookings/planes/'+user_id+'/'+start+'/'+end+"?show_all="+show_all+"&rented_id="+rented_id).then(handleSuccess, handleError2);
        }

        function GetInstructors(user_id, start, end, show_all){
            return $http.get('/api/v1/bookings/instructors/'+user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetInstructorByUser(user_id){
            return $http.get('/api/v1/bookings/instructor_by_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetInstructorPlanes(user_id, instructor_user_id, start, end){
            return $http.get('/api/v1/bookings/instructor_planes/'+user_id+'/'+instructor_user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetPlaneInstructors(user_id, plane_id, start, end, show_all){
            return $http.get('/api/v1/bookings/plane_instructors/'+user_id+'/'+plane_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        // function GetPlaneInstructors2(user_id, plane_id, start, end, show_all){
        //     //this is for the all instructors not presently booked elsewhere...
        //     return $http.get('/api/v1/bookings/plane_instructors3/'+user_id+'/'+plane_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError('Error getting all Image'));
        // }

        // Scheduler v2 booking panel, Who BEFORE What (2026-11-04): the club's current instructors for the slot,
        // before any aircraft is chosen. Same rows as plane_instructors (+ available / reason / busy_with) plus
        // course_ids / courses_restricted / plane_ids for the aircraft + tuition cascade. show_all=0 keeps only the
        // available rows (members); booking_id (optional) excludes that booking from the busy check (an edit).
        function GetClubInstructors(user_id, club_id, start, end, show_all, booking_id){
            var q = '?show_all=' + (show_all ? 1 : 0) + (booking_id ? '&booking_id=' + booking_id : '');
            return $http.get('/api/v1/bookings/club_instructors/'+user_id+'/'+club_id+'/'+start+'/'+end + q).then(handleSuccess, handleError2);
        }

        function GetPlaneInstructorsEdit(user_id, plane_id, start, end, show_all, booking_id){
            return $http.get('/api/v1/bookings/plane_instructors2/'+user_id+'/'+plane_id+'/'+start+'/'+end+"/"+booking_id+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        function GetRentalItems(club_id, start, end, show_all){
            return $http.get('/api/v1/bookings/rental_items/'+club_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        function Create(user_id, booking) {
            var url = '/api/v1/bookings/';
            return $http.post(url, booking).then(handleSuccess, handleError2);
        }

        
        // GET bookings/passenger_preview?club_id&booking_end[&booking_id]&passengers=<json [{user_id, email}]>
        //   → {success, passengers:[{email, user_id, name, has_account, status_after_save: 'accepted'|'invited'}]}
        function PassengerPreview(club_id, booking_end, passengers, booking_id){
            var q = '?club_id=' + encodeURIComponent(club_id || 0) + '&booking_end=' + encodeURIComponent(booking_end || '') +
                    (booking_id ? '&booking_id=' + encodeURIComponent(booking_id) : '') +
                    '&passengers=' + encodeURIComponent(JSON.stringify(passengers || []));
            return $http.get('/api/v1/bookings/passenger_preview' + q).then(handleSuccess, handleError2);
        }

        // PUBLIC (token, no session): GET only displays, POST acts — mail scanners prefetch links
        function PassengerDeclineGet(token){
            return $http.get('/api/v1/passenger_decline/' + encodeURIComponent(token)).then(handleSuccess, handleError2);
        }
        function PassengerDeclinePost(token){
            return $http.post('/api/v1/passenger_decline/' + encodeURIComponent(token), {}).then(handleSuccess, handleError2);
        }

        function ResendInvitation(content, id){
               // /resend_invitation
            return $http.post('/api/v1/invitations/resend_invitation/'+id, content).then(handleSuccess, handleError2);
        }

        function DeleteInvitation(content, id){
            //DeleteInvitation
            return $http.delete('/api/v1/invitations/'+id).then(handleSuccess, handleError2);
        }

        // function Update(user_id, holiday) {
        //     //maybe some sanitation required here? especially for the user_id bit...
        //      var send = {
        //         id: holiday.id,
        //         user_id: user_id,
        //         title: holiday.title,
        //         from_date: holiday.start,
        //         to_date: holiday.end,
        //         allDay: holiday.allDay
        //     }
        //     return $http.put('/api/v1/instructor_holiday/' + holiday.id, send).then(handleSuccess, handleError('Error updating Image'));
        // }

        function DeleteBooking(user_id, delete_id, reason, notes) {
            // reason / notes (optional) are stored on the audit trail entry and the archived booking
            var q = '?user_id=' + user_id;
            if (reason) { q += '&reason=' + encodeURIComponent(reason); }
            if (notes) { q += '&notes=' + encodeURIComponent(notes); }
            return $http.delete('/api/v1/bookings/' + delete_id + q).then(handleSuccess, handleError2);
        }




        //instructor briefing tools::
        function GetBookingsToBrief(instructor_id){

            return $http.get('/api/v1/bookings/instructor_brief').then(handleSuccess, handleError2);

        }

        // params (optional): { fd_page, fd_per_page } pages "Flights without a student record"
        function GetBookingsToDebrief(instructor_id, params){
            var q = [];
            angular.forEach(params || {}, function(v, k){ if(v !== null && v !== undefined && v !== ''){ q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); } });
            return $http.get('/api/v1/bookings/instructor_debrief' + (q.length ? '?' + q.join('&') : '')).then(handleSuccess, handleError2);

        }

        function SetBookingToBriefed(booking_id, data){
            return $http.put('/api/v1/bookings/set_briefed/'+booking_id, data || {}).then(handleSuccess, handleError2);

        }



        function GetForForDebrief(booking_id){
            return $http.get('/api/v1/bookings/for_debrief/'+booking_id, {}).then(handleSuccess, handleError2);

        }

        function GetForForDebriefPls(pls_id){
            //GetForForDebriefPls
            return $http.get('/api/v1/bookings/for_debrief_pls/'+pls_id, {}).then(handleSuccess, handleError2);
        }














        // ── Schedule version check (lightweight polling) ──
        // Mirrors ScheduleDisplayService.GetVersion but for authenticated users.
        // Backend endpoint: GET /api/v1/bookings/schedule_version/:user_id
        // Expected response: { success: true, schedule_version: <number> }
        function GetScheduleVersion(user_id) {
            return $http.get('/api/v1/bookings/schedule_version/' + user_id).then(handleSuccess, handleError2);
        }


        // private functions

        function handleSuccess(res) {
            return res.data;
        }

        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                $location.path('/login');
            }    

            return { success: false, message: res.data, status: res.status };
        }

        function handleError(error) {
            return function () {
                return { success: false, message: error };
            };
        }
    }