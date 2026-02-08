app.factory('KeywordsService', KeywordsService);

    KeywordsService.$inject = ['$http', '$location'];
    function KeywordsService($http, $location) {
        var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
       
        return service; 

        function GetAll() {
            return $http.get('/api/v1/keywords').then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/keywords/' + id).then(handleSuccess, handleError2);
        }

        function Create(keywords) {
            return $http.post('/api/v1/keywords', keywords).then(handleSuccess, handleError2);
        }

        function Update(keywords) {
            return $http.put('/api/v1/keywords/' + keywords.id, keywords).then(handleSuccess, handleError2);
        }

        function Delete(id) {
            return $http.delete('/api/v1/keywords/' + id).then(handleSuccess, handleError2);
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