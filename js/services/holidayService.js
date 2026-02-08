app.factory('HolidayService', HolidayService);

    HolidayService.$inject = ['$http', '$location'];
    function HolidayService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
       
        return service; 

        function GetAll(user_id) {
            return $http.get('/api/v1/instructor_holiday/'+user_id).then(handleSuccess, handleError2);
        }

        function Create(user_id, holiday) {
            holiday.user_id = user_id;
            var send = {
                user_id: user_id,
                title: holiday.title,
                from_date: holiday.start,
                to_date: holiday.end,
                allDay: holiday.allDay
            }
            var url = '/api/v1/instructor_holiday/';
            return $http.post(url, send).then(handleSuccess, handleError2);
        }

        function Update(user_id, holiday) {
            //maybe some sanitation required here? especially for the user_id bit...
             var send = {
                id: holiday.id,
                user_id: user_id,
                title: holiday.title,
                from_date: holiday.start,
                to_date: holiday.end,
                allDay: holiday.allDay
            }
            return $http.put('/api/v1/instructor_holiday/' + holiday.id, send).then(handleSuccess, handleError2);
        }

        function Delete(user_id, delete_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/instructor_holiday/' + delete_id).then(handleSuccess, handleError2);
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