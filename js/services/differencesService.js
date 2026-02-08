app.factory('DifferencesService', DifferencesService);

    DifferencesService.$inject = ['$http', '$location'];
    function DifferencesService($http, $location) {
        var service = {};

        service.GetDifferences = GetDifferences;
        service.GetByUserId = GetByUserId;
        service.GetByUserIdClub = GetByUserIdClub;

        service.Update = Update;
        
       
        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        function GetDifferences() {
            return $http.get('/api/v1/differences').then(handleSuccess, handleError2);
        }

       
      

        function GetByUserId(id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/user_differences/' + id).then(handleSuccess, handleError2);
        }

        function GetByUserIdClub(id, club_id) {
            //TODO
            //this is awful... needs to be sorted out...
            return $http.get('/api/v1/user_differences/' + id +"/"+club_id).then(handleSuccess, handleError2);
        }

        //  function GetByUserId(id, club_id) {
        //     //TODO
        //     //this is awful... needs to be sorted out...
        //     return $http.get('/api/v1/user_differences/' + id +"/"+club_id).then(handleSuccess, handleError2);
        // }



        // function Create(licence) {
        //     return $http.post('/api/v1/licences', licence).then(handleSuccess, handleError2);
        // }

        function Update(differences) {
            return $http.put('/api/v1/user_differences/' + differences.user_id, differences).then(handleSuccess, handleError2);
        }

        // function Delete(user_id, id) {
        //     return $http.delete('/api/v1/licences/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
        // }

        // function DeleteTmp(file) {
        //     return $http.post('tmp_rm.php', {tmp: file}).then(handleSuccess, handleError2);
        // }

        
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