app.factory('CategoryService', CategoryService);

    CategoryService.$inject = ['$http'];
    function CategoryService($http) {
        var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;

        return service;

        function GetAll() {
            return $http.get('/api/v1/categories').then(handleSuccess, handleError('Error getting all users'));
        }

        function GetById(id) {
            return $http.get('/api/v1/categories/' + id).then(handleSuccess, handleError('Error getting user by id'));
        }

        function Create(category) {
            return $http.post('/api/v1/categories', category).then(handleSuccess, handleError('Error creating user'));
        }

        function Update(category) {
            return $http.put('/api/v1/categories/' + category.id, category).then(handleSuccess, handleError('Error updating user'));
        }

        function Delete(id) {
            return $http.delete('/api/v1/categories/' + id).then(handleSuccess, handleError('Error deleting user'));
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