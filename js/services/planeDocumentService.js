app.factory('PlaneDocumentService', PlaneDocumentService);

    PlaneDocumentService.$inject = ['$http', '$location'];
    function PlaneDocumentService($http, $location) {
        var service = {};

     
        service.GetByPlaneId = GetByPlaneId;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.DeleteTmp = DeleteTmp;
       
        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

      



        function GetById(id, user_id) {
            return $http.get('/api/v1/plane_documents/' + id).then(handleSuccess, handleError2);
        }

        function GetByPlaneId(id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/plane_documents/' + id).then(handleSuccess, handleError2);
        }

     
        function Create(poid) {
            return $http.post('/api/v1/plane_documents', poid).then(handleSuccess, handleError2);
        }

        function Update(poid) {
            return $http.put('/api/v1/plane_documents/' + poid.id, poid).then(handleSuccess, handleError2);
        }

        function Delete(user_id, id) {
            return $http.delete('/api/v1/plane_documents/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
        }

        function DeleteTmp(file) {
            return $http.post('tmp_rm.php', {tmp: file}).then(handleSuccess, handleError2);
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