app.factory('ClubPaymentService', ClubPaymentService);

    ClubPaymentService.$inject = ['$http', '$location'];
    function ClubPaymentService($http, $location) {
        var service = {};


        service.GetPaymentsByClub = GetPaymentsByClub;

        service.GetPaymentTypes = GetPaymentTypes;
        service.GetByUserId = GetByUserId;
        service.GetAuthority = GetAuthority;
        service.Create = Create;
        service.Delete = Delete;
        service.Refund = Refund;
       
        service.GetUserForPayment = GetUserForPayment;

        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        function GetPaymentsByClub(club_id){
            return $http.get('/api/v1/payments/by_club/'+club_id).then(handleSuccess, handleError2);
        }

        function Refund(refund) {
            return $http.post('/api/v1/payments/refund', refund).then(handleSuccess, handleError2);
        }


        
        

        function GetPaymentTypes() {
            return $http.get('/api/v1/poid_components').then(handleSuccess, handleError2);
        }

        function GetAuthority() {
            return $http.get('/api/v1/authority').then(handleSuccess, handleError2);
        }

        function GetUserForPayment() {
            return $http.get('/api/v1/cards/user').then(handleSuccess, handleError2);
        }

        function GetByUserId(user_id){
            return $http.get('/api/v1/cards/'+user_id).then(handleSuccess, handleError2);
        }

        function Create(card) {
            return $http.post('/api/v1/cards', card).then(handleSuccess, handleError2);
        }

        

        function Delete(id, user_id) {
            return $http.delete('/api/v1/cards/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
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