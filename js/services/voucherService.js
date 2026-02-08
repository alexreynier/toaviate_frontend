app.factory('VoucherService', VoucherService);

    VoucherService.$inject = ['$http', '$location'];
    function VoucherService($http, $location) {
        var service = {};
        
        service.GetByClubId = GetByClubId;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        // service.Delete = Delete;

        service.GetUniqueCode = GetUniqueCode;
        service.CancelVoucher = CancelVoucher;
       

        // service.GetUpdatedCharges = GetUpdatedCharges;

        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        // function GetUpdatedCharges(id){
        //     return $http.get('/api/v1/plane_log_sheets/update_tuition_book_in/' + id).then(handleSuccess, handleError2);
        // }
       

        //function for discounts


        function GetUniqueCode(club_id) {
            return $http.get('/api/v1/vouchers/unique_voucher/' + club_id).then(handleSuccess, handleError2);
        }


        function GetByClubId(club_id) {
            return $http.get('/api/v1/vouchers/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/vouchers/' + id).then(handleSuccess, handleError2);
        }

        function Create(item) {
            return $http.post('/api/v1/vouchers', item).then(handleSuccess, handleError2);
        }

        function Update(item, user_id) {
            return $http.put('/api/v1/vouchers/' + item.id +'?user_id='+user_id, item).then(handleSuccess, handleError2);
        }

        function CancelVoucher(user_id, id) {
            return $http.delete('/api/v1/vouchers/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
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