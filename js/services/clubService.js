app.factory('ClubService', ClubService);

    ClubService.$inject = ['$http', '$location'];
    function ClubService($http, $location) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.CheckLink = CheckLink;
        service.GetByUrl = GetByUrl;
        service.DownloadZip = DownloadZip;

        service.GetClubInvoices = GetClubInvoices;
        service.GetClubTotals = GetClubTotals;

        service.GetAllForUser = GetAllForUser;

        //get_all_for_user
       
        return service; 

        function GetAllForUser(user_id){
            return $http.get('/api/v1/clubs/get_all_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetAll() {
            return $http.get('/api/v1/clubs/').then(handleSuccess, handleError2);
        }

        function GetById(club_id) {
            return $http.get('/api/v1/clubs/' + club_id).then(handleSuccess, handleError2);
        }

        function GetByUrl(url){
            return $http.post('/api/v1/clubs/get_by_url', url).then(handleSuccess, handleError2);
        }

        function Create(club) {
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            var url = '/api/v1/clubs/';
            return $http.post(url, club).then(handleSuccess, handleError2);
        }

        function Update(club) {
            return $http.put('/api/v1/clubs/' + club.id, club).then(handleSuccess, handleError2);
        }

        function Delete(club_id) {
            //this should be a disabled function only available for people working for the software
            return $http.delete('/api/v1/clubs/' + club_id).then(handleSuccess, handleError2);
        }

        function CheckLink(link){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/clubs/check_link', {gallery_link: link}).then(handleSuccess, handleError2);
        }
        //download_zip
        function DownloadZip(zip){
            $http.defaults.headers.common['Api-Key'] = "eW91a25vd25vdGhpbmdqb25zbm93";
            return $http.post('/api/v1/clubs/download_zip', zip).then(handleSuccess, handleError2);
        }

        function GetClubInvoices(club_id, from_date, to_date){
            
            return $http.post('/api/v1/invoices/get_all_for_club/' + club_id, {from_date: from_date, to_date: to_date}).then(handleSuccess, handleError2);

        }

        function GetClubTotals(club_id, from_date, to_date){
            
            return $http.post('/api/v1/invoices/get_totals_for_club/' + club_id, {from: from_date, to: to_date}).then(handleSuccess, handleError2);

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