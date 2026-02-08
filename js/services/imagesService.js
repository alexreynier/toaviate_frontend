app.factory('ImagesService', ImagesService);

    ImagesService.$inject = ['$http', '$location'];
    function ImagesService($http, $location) {
        var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.GetOne = GetOne;
       
        return service; 

        function GetAll() {
            return $http.get('/api/v1/images').then(handleSuccess, handleError2);
        }

        function GetOne(id){
            return $http.get('/api/v1/images/' + id).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/images/' + id).then(handleSuccess, handleError2);
        }

        function Create(images) {
            return $http.post('/api/v1/images', images).then(handleSuccess, handleError2);
        }

        function Update(image) {
            return $http.put('/api/v1/images/' + image.id, image).then(handleSuccess, handleError2);
        }

        function Delete(id) {
            return $http.delete('/api/v1/images/' + id).then(handleSuccess, handleError2);
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