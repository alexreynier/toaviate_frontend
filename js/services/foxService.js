app.factory('FoxService', FoxService);

    FoxService.$inject = ['$http', '$location'];
    function FoxService($http, $location) {
        var service = {};
        
        service.GetFoxEntries = GetFoxEntries;
        service.GetFoxEntriesByPlane = GetFoxEntriesByPlane;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.ResetAllClubPlanes = ResetAllClubPlanes;
        service.FixUncombinedLogs = FixUncombinedLogs;
        service.ResetOneClubPlane = ResetOneClubPlane;

        return service; 

        
        function FixUncombinedLogs(club_id){
            // console.log("we're in the foxService here");
            //v1/fox/reset_aeroplane
            return $http.get('/api/v1/fox/fix_uncombined').then(handleSuccess, handleError2);
        
        }

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...
        function ResetOneClubPlane(plane_id){
            // console.log("we're in the foxService here");
            //v1/fox/reset_aeroplane
            return $http.get('/api/v1/fox/reset_aeroplane/'+plane_id).then(handleSuccess, handleError2);
        
        }

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...
        function ResetAllClubPlanes(club_id){
            // console.log("we're in the foxService here");
            //v1/fox/reset_aeroplane
            return $http.get('/api/v1/fox/reset_all_aeroplanes/'+club_id).then(handleSuccess, handleError2);
        
        }

        function GetFoxEntries(user_id) {
            // console.log("we're in the foxService here");
            return $http.get('/api/v1/fox/user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetFoxEntriesByPlane(plane_id) {
            // console.log("we're in the foxService here");
            return $http.get('/api/v1/fox/plane/'+plane_id).then(handleSuccess, handleError2);
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