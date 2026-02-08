app.factory('ImageUploadService', ImageUploadService);

    ImageUploadService.$inject = ['$http'];
    function ImageUploadService($http) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
       
        return service; 

        function GetAll(id) {
            return $http.get('/api/v1/artpieces/'+id+'/images').then(handleSuccess, handleError('Error getting all Image'));
        }

        function GetById(artpiece_id, image_id) {
            return $http.get('/api/v1/artpieces/' + artpiece_id + '/images/'+ image_id).then(handleSuccess, handleError('Error getting Image by id'));
        }

        function Create(images) {
            var url = '/api/v1/artpieces/' + images.artpiece_id + '/images';
            return $http.post(url, images).then(handleSuccess, handleError('Error creating Image'));
        }

        function Update(images) {
            return $http.put('/api/v1/artpieces/' + images.artpiece_id + '/images', images).then(handleSuccess, handleError('Error updating Image'));
        }

        function Delete(artpiece_id, image_id) {
            return $http.delete('/api/v1/artpieces/' + artpiece_id + '/images/' + image_id).then(handleSuccess, handleError('Error deleting Image'));
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