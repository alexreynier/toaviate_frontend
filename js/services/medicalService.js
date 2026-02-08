app.factory('MedicalService', MedicalService);

    MedicalService.$inject = ['$http', '$location'];
    function MedicalService($http, $location) {
        var service = {};

        service.GetAll = GetAll;
        service.GetMedicalTypes = GetMedicalTypes;
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

        function GetMedicalTypes() {
            return $http.get('/api/v1/medical_components').then(handleSuccess, handleError2);
        }

        function GetComponents() {
            return $http.get('/api/v1/medical_components').then(handleSuccess, handleError2);
        }

        function GetAuthority() {
            return $http.get('/api/v1/authority').then(handleSuccess, handleError2);
        }




        function GetAll() {
            return $http.get('/api/v1/medicals').then(handleSuccess, handleError2);
        }

        function GetById(id, thumbs=1, decrypted=0) {

            var end = "";
            if(thumbs == 1 || decrypted == 1){

                end = "?";
                end += (thumbs == 1) ? "st=1&" : "";
                end += (decrypted == 1) ? "sd=1" : "";

            }

            // console.log("ADDITIONAL BIT: ", end);

            return $http.get('/api/v1/medicals/' + id + end).then(handleSuccess, handleError2);
        }

        function GetByUserId(id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/medicals/?user_id=' + id).then(handleSuccess, handleError2);
        }

        function GetByUserIdClub(id, club_id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/medicals/'+club_id+'?user_id=' + id).then(handleSuccess, handleError2);
        }

        function Create(medical) {
            return $http.post('/api/v1/medicals', medical).then(handleSuccess, handleError2);
        }

        function Update(medical) {
            return $http.put('/api/v1/medicals/' + medical.id, medical).then(handleSuccess, handleError2);
        }

        function Delete(user_id, id) {
            return $http.delete('/api/v1/medicals/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
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