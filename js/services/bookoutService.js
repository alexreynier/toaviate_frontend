app.filter('orderAirfields', function () {
  // custom value function for sorting
  function myValueFunction(card) {
    return card.values.opt1 + card.values.opt2;
  }

  function getDistance(airfield, default_lat, default_long) {
      var R = 6371; // Radius of the earth in km
      var dLat = deg2rad(airfield.wgs_n-default_lat);  // deg2rad below
      var dLon = deg2rad(airfield.wgs_e-default_long); 
      var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(default_lat)) * Math.cos(deg2rad(airfield.wgs_n)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      var d = R * c; // Distance in km
      return d;
    }

    function deg2rad(deg) {
      return deg * (Math.PI/180)
    }

  return function (obj, default_lat, default_long) {
    var array = [];
    if(default_lat && default_long && obj){

        Object.keys(obj).forEach(function (key) {
          // inject key into each object so we can refer to it from the template
          obj[key].name = key;
          array.push(obj[key]);
        });
        // apply a custom sorting function
       array.sort(function (a, b) {
          return getDistance(a, default_lat, default_long) - getDistance(b, default_lat, default_long);
        }); 
    }
    
    return array;
  };
});

app.filter('formatHours', function(){

    return function(input) {

        var n = new Date(0,0);
        n.setSeconds(+input * 60 * 60);

        return n.toTimeString().slice(0, 5);

    }
   
});


app.filter('addS', function(){

    return function(input, number) {

        if(number > 1){
            input = input+ "s";
        }

        return input;
    }
   
});
app.factory('BookoutService', BookoutService);

    BookoutService.$inject = ['$http', '$location'];
    function BookoutService($http, $location) {

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
        service.GetAirfields = GetAirfields;
        service.GetAirfieldsByCode = GetAirfieldsByCode;
        service.SendBookout = SendBookout;
        service.GetBookoutsToComplete = GetBookoutsToComplete;
        service.BookInFlight = BookInFlight;
        service.PayBooking = PayBooking;
        service.AddPassenger = AddPassenger;
        service.GetPassengers = GetPassengers;
        service.CancelBookout = CancelBookout;
        service.CheckPayment = CheckPayment;
        service.RetryPaymentMachine = RetryPaymentMachine;
        service.ClearMachine = ClearMachine;
        service.ConfirmPayment = ConfirmPayment;
       
        return service;
        //ConfirmPayment

        function ConfirmPayment(payment_id, club_id){
            return $http.post('/api/v1/cards/confirm_payment', {payment_id: payment_id, club_id: club_id}).then(handleSuccess, handleError2);
        }
        function ClearMachine(payment_id, club_id){
            return $http.post('/api/v1/cards/clear_machine', {paymentID: payment_id, club_id: club_id}).then(handleSuccess, handleError2);
        }
        function RetryPaymentMachine(payment_id, club_id){
            return $http.post('/api/v1/cards/retry_payment_machine', {paymentID: payment_id, club_id: club_id}).then(handleSuccess, handleError2);
        }

        function CheckPayment(id){
            return $http.post('/api/v1/cards/check_payment', {paymentID: id}).then(handleSuccess, handleError2);
        }

        function GetAirfields(start_with){
            return $http.get('/api/v1/airfields/all/'+start_with).then(handleSuccess, handleError2);
        }

        function GetAirfieldsByCode(code){
            return $http.get('/api/v1/airfields/code/'+code).then(handleSuccess, handleError2);
        }

        function GetAll(user_id, start, end) {
            return $http.get('/api/v1/bookings/'+user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        
        function AddPassenger(data, id){
            return $http.post("/api/v1/invitations/new_passenger/"+id, data).then(handleSuccess, handleError2);
        }

        function GetPassengers(id){
            return $http.get("/api/v1/invitations/"+id+"/passengers").then(handleSuccess, handleError2);
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

        function GetAllPlanes(user_id, start, end, show_all, rented_id = 0) {
            return $http.get('/api/v1/bookings/planes/'+user_id+'/'+start+'/'+end+"?show_all="+show_all+"&rented_id="+rented_id).then(handleSuccess, handleError2);
        }

        function GetInstructors(user_id, start, end, show_all){
            return $http.get('/api/v1/bookings/instructors/'+user_id+'/'+start+'/'+end).then(handleSuccess, handleError2);
        }

        function GetPlaneInstructors(user_id, plane_id, start, end, show_all){
            return $http.get('/api/v1/bookings/plane_instructors/'+user_id+'/'+plane_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        function GetRentalItems(club_id, start, end, show_all){
            return $http.get('/api/v1/bookings/rental_items/'+club_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        function Create(user_id, booking) {
            var url = '/api/v1/bookings/';
            return $http.post(url, booking).then(handleSuccess, handleError2);
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
        //     return $http.put('/api/v1/instructor_holiday/' + holiday.id, send).then(handleSuccess, handleError2);
        // }

        function DeleteBooking(user_id, delete_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/bookings/' + delete_id + '?user_id=' + user_id).then(handleSuccess, handleError2);
        }




        //NOWNOWNOW

        function GetBookoutsToComplete(user_id) {
            return $http.get('/api/v1/plane_log_sheets/incomplete/'+user_id).then(handleSuccess, handleError2);
        }

        function GetBookout(user_id, plane_id, id){
            return $http.get('/api/v1/plane_log_sheets/plane_instructors/'+user_id+'/'+plane_id+'/'+start+'/'+end+"?show_all="+show_all).then(handleSuccess, handleError2);
        }

        function SendBookout(user_id, bookout) {
            return $http.post('/api/v1/plane_log_sheets', bookout).then(handleSuccess, handleError2);
        }

        function UpdateBookout(id, amended_bookout) {
            //maybe some sanitation required here? especially for the user_id bit...
            return $http.put('/api/v1/plane_log_sheets/' + id, amended_bookout).then(handleSuccess, handleError2);
        }

        function DeleteBookout(user_id, delete_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/plane_log_sheets/' + delete_id + '?user_id=' + user_id).then(handleSuccess, handleError2);
        }

        function BookInFlight(id, complete_bookin) {
            //maybe some sanitation required here? especially for the user_id bit...
            return $http.put('/api/v1/plane_log_sheets/booking_in/' + id, complete_bookin).then(handleSuccess, handleError2);
        }

        function PayBooking(id, complete_payment){
            return $http.put('/api/v1/plane_log_sheets/payment_for/' + id, complete_payment).then(handleSuccess, handleError2);
        }

        function CancelBookout(id){
            return $http.delete('/api/v1/plane_log_sheets/' + id).then(handleSuccess, handleError2);
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