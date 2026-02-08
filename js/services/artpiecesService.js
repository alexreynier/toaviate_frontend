app.factory('ArtpiecesService', ArtpiecesService);

    ArtpiecesService.$inject = ['$http'];
    function ArtpiecesService($http) {
        var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.AddCategory = AddCategory;
        service.DeleteCategory = DeleteCategory;

        return service;

        function GetAll() {
            return $http.get('/api/v1/artpieces').then(handleSuccess, handleError('Error getting all artpieces'));
        }

        function GetById(id) {
            return $http.get('/api/v1/artpieces/' + id).then(handleSuccess, handleError('Error getting artpiece by id'));
        }

        function Create(artpiece) {
            return $http.post('/api/v1/artpieces', artpiece).then(handleSuccess, handleError('Error creating artpiece'));
        }

        function Update(artpiece) {
            return $http.put('/api/v1/artpieces/' + artpiece.id, artpiece).then(handleSuccess, handleError('Error updating artpiece'));
        }

        function AddCategory(linker){
            return $http.post('/api/v1/artpieces/' + linker.artpiece_id + '/categories', linker).then(handleSuccess, handleError('Error adding category'));
        }

        function DeleteCategory(linker){
            return $http.delete('/api/v1/artpieces/' + linker.artpiece_id + '/categories/' + linker.category_id).then(handleSuccess, handleError('Error deleting artpiece'));
        }

        function Delete(id) {
            return $http.delete('/api/v1/artpieces/' + id).then(handleSuccess, handleError('Error deleting artpiece'));
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