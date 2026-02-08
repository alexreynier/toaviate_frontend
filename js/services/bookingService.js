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
        
        service.GetForForDebrief = GetForForDebrief;
        service.GetBookingsToDebrief = GetBookingsToDebrief;

        service.GetForForDebriefPls = GetForForDebriefPls;

        return service;

        function GetBookingsToReview(user_id){
            return $http.get('/api/v1/bookings/to_approve/'+user_id).then(handleSuccess, handleError2);
        }

        function GetForBookIn(id){
            return $http.get('/api/v1/plane_log_sheets/'+id).then(handleSuccess, handleError2);
        }

        function GetAllUserClub(user_id,club_id,start,end){
            // /bookings/user_club/USER_ID/CLUB_ID/START/END
            return $http.get('/api/v1/bookings/user_club/'+user_id+'/'+club_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetAll(user_id, start, end) {
            return $http.get('/api/v1/bookings/'+user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetAllInstructor(user_id, start, end) {
            return $http.get('/api/v1/bookings/instructor_schedule/'+user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetTodayBookingsUser(user_id) {
            return $http.get('/api/v1/bookings/user_bookings_today/'+user_id).then(handleSuccess, handleError2);
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

        function GetPlaneInstructors(user_id, plane_id, start, end, show_all){
            return $http.get('/api/v1/bookings/plane_instructors/'+user_id+'/'+plane_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        // function GetPlaneInstructors2(user_id, plane_id, start, end, show_all){
        //     //this is for the all instructors not presently booked elsewhere...
        //     return $http.get('/api/v1/bookings/plane_instructors3/'+user_id+'/'+plane_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError('Error getting all Image'));
        // }

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

        function DeleteBooking(user_id, delete_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/bookings/' + delete_id + '?user_id=' + user_id).then(handleSuccess, handleError2);
        }




        //instructor briefing tools::
        function GetBookingsToBrief(instructor_id){

            return $http.get('/api/v1/bookings/instructor_brief').then(handleSuccess, handleError2);

        }

        function GetBookingsToDebrief(instructor_id){

            return $http.get('/api/v1/bookings/instructor_debrief').then(handleSuccess, handleError2);

        }

        function SetBookingToBriefed(booking_id){
            return $http.put('/api/v1/bookings/set_briefed/'+booking_id, {}).then(handleSuccess, handleError2);

        }



        function GetForForDebrief(booking_id){
            return $http.get('/api/v1/bookings/for_debrief/'+booking_id, {}).then(handleSuccess, handleError2);

        }

        function GetForForDebriefPls(pls_id){
            //GetForForDebriefPls
            return $http.get('/api/v1/bookings/for_debrief_pls/'+pls_id, {}).then(handleSuccess, handleError2);
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