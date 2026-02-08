app.factory('InstructorService', InstructorService);

    InstructorService.$inject = ['$http', '$location'];
    function InstructorService($http, $location) {
        var service = {};

       
        service.Create = Create;
        service.SetAvailability = SetAvailability;
        service.GetAvailability = GetAvailability;
        service.Delete = Delete;

        service.GetAllByClub = GetAllByClub;
        service.UpdateOrder = UpdateOrder;
        service.UpdateInstructor = UpdateInstructor;

        return service;



        function GetAllByClub(club_id, user_id){
            return $http.get('/api/v1/members/get_instructors/'+club_id+'/'+user_id).then(handleSuccess, handleError2);
        }

        function UpdateOrder(users, club_id){
            return $http.put('/api/v1/members/instructor_order', users).then(handleSuccess, handleError2);
        }

        function UpdateInstructor(instructor, club_id){
            return $http.put('/api/v1/members/instructor_update', instructor).then(handleSuccess, handleError2);
        }

        function Create(user) {
            return $http.post('/api/v1/users', user).then(handleSuccess, handleError2);
        }

        function GetAvailability(user_id) {
            return $http.get('/api/v1/instructor_availability/' + user_id).then(handleSuccess, handleError2);
        }

        function SetAvailability(availability) {
            if(!availability.id){
                availability.id = 0;
            }
            return $http.put('/api/v1/instructor_availability/' + availability.id, availability).then(handleSuccess, handleError2);
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