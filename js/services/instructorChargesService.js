app.factory('InstructorCharges', InstructorCharges);

    InstructorCharges.$inject = ['$http', '$location'];
    function InstructorCharges($http, $location) {
        var service = {};
        
        service.GetByClubId = GetByClubId;
        service.GetByCourseId = GetByCourseId;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.GetUpdatedCharges = GetUpdatedCharges;

        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...
        function GetByCourseId(id){
            return $http.get('/api/v1/instructor_charges/course/' + id).then(handleSuccess, handleError2);
        }

        function GetUpdatedCharges(id){
            return $http.get('/api/v1/plane_log_sheets/update_tuition_book_in/' + id).then(handleSuccess, handleError2);
        }
       
        function GetByClubId(club_id) {
            return $http.get('/api/v1/instructor_charges/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/instructor_charges/' + id).then(handleSuccess, handleError2);
        }

        function Create(item) {
            return $http.post('/api/v1/instructor_charges', item).then(handleSuccess, handleError2);
        }

        function Update(item, user_id) {
            return $http.put('/api/v1/instructor_charges/' + item.id +'?user_id='+user_id, item).then(handleSuccess, handleError2);
        }

        function Delete(user_id, id) {
            return $http.delete('/api/v1/instructor_charges/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
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