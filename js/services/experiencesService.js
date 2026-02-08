app.factory('ExperiencesService', ExperiencesService);

    ExperiencesService.$inject = ['$http', '$location'];
    function ExperiencesService($http, $location) {
        var service = {};
        
        service.GetByClubId = GetByClubId;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.GetDiscountsByClubId = GetDiscountsByClubId;
        service.GetDiscountById = GetDiscountById;
        service.CreateDiscount = CreateDiscount;
        service.UpdateDiscount = UpdateDiscount;
        service.DeleteDiscount = DeleteDiscount;
        service.GetDiscountsByClubIdAndExperienceId = GetDiscountsByClubIdAndExperienceId;
        // service.GetUpdatedCharges = GetUpdatedCharges;

        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        // function GetUpdatedCharges(id){
        //     return $http.get('/api/v1/plane_log_sheets/update_tuition_book_in/' + id).then(handleSuccess, handleError2);
        // }
       

        //function for discounts

        function GetDiscountsByClubId(club_id) {
            return $http.get('/api/v1/experience_discounts/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetDiscountsByClubIdAndExperienceId(club_id, experience_id) {
            return $http.get('/api/v1/experience_discounts/club_experience/'+ club_id+'/'+experience_id).then(handleSuccess, handleError2);
        }

        function GetDiscountById(id) {
            return $http.get('/api/v1/experience_discounts/' + id).then(handleSuccess, handleError2);
        }

        function CreateDiscount(item) {
            return $http.post('/api/v1/experience_discounts', item).then(handleSuccess, handleError2);
        }

        function UpdateDiscount(item, user_id) {
            return $http.put('/api/v1/experience_discounts/' + item.id +'?user_id='+user_id, item).then(handleSuccess, handleError2);
        }

        function DeleteDiscount(user_id, id) {
            return $http.delete('/api/v1/experience_discounts/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
        }




        function GetByClubId(club_id) {
            return $http.get('/api/v1/experiences/club/' + club_id).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/experiences/' + id).then(handleSuccess, handleError2);
        }

        function Create(item) {
            return $http.post('/api/v1/experiences', item).then(handleSuccess, handleError2);
        }

        function Update(item, user_id) {
            return $http.put('/api/v1/experiences/' + item.id +'?user_id='+user_id, item).then(handleSuccess, handleError2);
        }

        function Delete(user_id, id) {
            return $http.delete('/api/v1/experiences/' + id+'?user_id='+user_id).then(handleSuccess, handleError2);
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