app.factory('GoCardService', GoCardService);

    GoCardService.$inject = ['$http', '$location'];
    function GoCardService($http, $location) {
        var service = {};



        service.SetupGoCard = SetupGoCard;
        service.SetupMandate = SetupMandate;
        service.GenerateLink = GenerateLink;
        service.GenerateUpdateLink = GenerateUpdateLink;
        service.UpdateMandate = UpdateMandate;



        return service;
        
        function GenerateUpdateLink(detail){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/go_card/generate_update_link', detail).then(handleSuccess, handleError2);
        }

        function UpdateMandate(detail){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/go_card/update_mandate', detail).then(handleSuccess, handleError2);
        }

        function SetupMandate(detail){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/go_card/create_mandate', detail).then(handleSuccess, handleError2);
        }

        function SetupGoCard(details){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/go_card/setup', details).then(handleSuccess, handleError2);
        }

        function GenerateLink(details){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/go_card/generate_link', details).then(handleSuccess, handleError2);
        }

        function GetAll() {
            return $http.get('/api/v1/users').then(handleSuccess, handleError2);
        }
      
        function Create(user) {
            return $http.post('/api/v1/users', user).then(handleSuccess, handleError2);
        }

        function Update(user) {
            return $http.put('/api/v1/users/' + user.id, user).then(handleSuccess, handleError2);
        }

        function Delete(id) {
            return $http.delete('/api/v1/users/' + id).then(handleSuccess, handleError2);
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