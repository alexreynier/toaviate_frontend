app.factory('InvoicesService', InvoicesService);

    InvoicesService.$inject = ['$http', '$location'];
    function InvoicesService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetAllByClub = GetAllByClub;
        service.GetAllByBooking = GetAllByBooking;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
       
       
        return service; 

        function GetAll() {
            return $http.get('/api/v1/planes/').then(handleSuccess, handleError2);
        }

        function GetOpenIssues(plane_id) {
            return $http.get('/api/v1/plane_tech_log_sheets/open_issues/'+plane_id).then(handleSuccess, handleError2);
        }

        function GetAllIssues(plane_id) {
            return $http.get('/api/v1/plane_tech_log_sheets/all_issues/'+plane_id).then(handleSuccess, handleError2);
        }

        function AddDefect(obj){
            return $http.post('/api/v1/plane_tech_log_sheets', obj).then(handleSuccess, handleError2);
        }

        function DeleteDefect(id){
            return $http.delete('/api/v1/plane_tech_log_sheets/' + id).then(handleSuccess, handleError2);
        }


        function GetAllByBooking(booking_id) {
            return $http.get('/api/v1/invoices/get_all_from_booking/'+booking_id).then(handleSuccess, handleError2);
        }

        function GetAllSheetReceipts(sheet_id){
            return $http.get('/api/v1/lubricant_receipts/sheet/'+sheet_id).then(handleSuccess, handleError2);
        }

        function AddReceipt(obj){
            return $http.post('/api/v1/lubricant_receipts', obj).then(handleSuccess, handleError2);
        }

        function DeleteReceipt(id){
            return $http.delete('/api/v1/lubricant_receipts/' + id).then(handleSuccess, handleError2);
        }
 

        function GetAllByClub(club_id) {
            return $http.get('/api/v1/planes/club/'+club_id).then(handleSuccess, handleError2);
        }

        function GetById(plane_id, club_id) {
            console.log("club_id "+club_id);
            console.log("plane_id "+plane_id);
            return $http.get('/api/v1/planes/' + plane_id + '/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetByUrl(url){
            return $http.post('/api/v1/planes/get_by_url', url).then(handleSuccess, handleError2);
        }

        function Create(club) {
            var url = '/api/v1/planes/';
            return $http.post(url, club).then(handleSuccess, handleError2);
        }

        function Update(plane) {
            return $http.put('/api/v1/planes/' + plane.plane_id, plane).then(handleSuccess, handleError2);
        }

        function Delete(club_plane_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/planes/' + club_plane_id).then(handleSuccess, handleError2);
        }

        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                //THIS MIGHT NOT BE APPROPRIATE?
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