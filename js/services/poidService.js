app.factory('PoidService', PoidService);

    PoidService.$inject = ['$http', '$location'];
    function PoidService($http, $location) {
        var service = {};

        service.GetAll = GetAll;
        service.GetPoidTypes = GetPoidTypes;
        service.GetComponents = GetComponents;
        service.GetAuthority = GetAuthority;
        service.GetByUserId = GetByUserId;
        service.GetByUserIdClub = GetByUserIdClub;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.DeleteTmp = DeleteTmp;
       
        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        function GetPoidTypes() {
            return $http.get('/api/v1/poid_components').then(handleSuccess, handleError2);
        }

        function GetComponents() {
            return $http.get('/api/v1/poid_components').then(handleSuccess, handleError2);
        }

        function GetAuthority() {
            return $http.get('/api/v1/authority').then(handleSuccess, handleError2);
        }




        function GetAll() {
            return $http.get('/api/v1/poids').then(handleSuccess, handleError2);
        }

        function GetById(id, thumbs=1, decrypted=0) {

            var end = "";
            if(thumbs == 1 || decrypted == 1){

                end = "?";
                end += (thumbs == 1) ? "st=1&" : "";
                end += (decrypted == 1) ? "sd=1" : "";

            }

            return $http.get('/api/v1/poids/' + id + end).then(handleSuccess, handleError2);
        }

        function GetByUserId(id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/poids/?user_id=' + id).then(handleSuccess, handleError2);
        }

        function GetByUserIdClub(id, club_id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/poids/'+club_id+'?user_id=' + id).then(handleSuccess, handleError2);
        }

        function Create(poid) {
            return $http.post('/api/v1/poids', poid).then(handleSuccess, handleError2);
        }

        function Update(poid) {
            return $http.put('/api/v1/poids/' + poid.id, poid).then(handleSuccess, handleError2);
        }

        function Delete(user_id, id) {
            return $http.delete('/api/v1/poids/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
        }

        function DeleteTmp(file) {
            return $http.post('tmp_rm.php', {tmp: file}).then(handleSuccess, handleError2);
        }

        
        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                //THIS MIGHT NOT BE APPROPRIATE
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