app.factory('NokService', NokService);

    NokService.$inject = ['$http', '$location'];
    function NokService($http, $location) {
        var service = {};
        
        service.GetByUserId = GetByUserId;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
       

        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        function GetByUserId(user_id) {
            return $http.get('/api/v1/next_of_kins?user_id='+user_id).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/next_of_kins/' + id).then(handleSuccess, handleError2);
        }

        function Create(nok) {
            return $http.post('/api/v1/next_of_kins', nok).then(handleSuccess, handleError2);
        }

        function Update(nok) {
            return $http.put('/api/v1/next_of_kins/' + nok.id, nok).then(handleSuccess, handleError2);
        }

        function Delete(user_id, id) {
            return $http.delete('/api/v1/next_of_kins/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
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