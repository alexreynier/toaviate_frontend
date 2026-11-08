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

        // Automatic membership renewals — the per-club pause (ToAviate staff only; backend refuses anyone else).
        // BACKEND_MEMBERSHIP_RENEWALS_GUIDE.md §7
        service.GetRenewalsPaused = GetRenewalsPaused;
        service.SetRenewalsPaused = SetRenewalsPaused;
        service.SetDdCollectionPaused = SetDdCollectionPaused;
        service.GetDdHolds = GetDdHolds;
        service.ResolveDdHold = ResolveDdHold;

        //get_all_for_user
       
        return service; 

        function GetAllForUser(user_id){
            return $http.get('/api/v1/clubs/get_all_for_user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetAll() {
            return $http.get('/api/v1/clubs/').then(handleSuccess, handleError2);
        }

        // {success, migrated, disabled (the global kill switch), clubs: [{id, title, payment_mode, has_gocardless, has_stripe,
        //  renewal_reminder_days, renewals_paused, renewals_paused_at, renewals_paused_by_name, auto_renew_paid, due_30}]}
        function GetRenewalsPaused() {
            return $http.get('/api/v1/clubs/renewals_paused').then(handleSuccess, handleError2);
        }

        // pause (true) / resume (false) a club's automatic renewals → {success, changed, ...the club's row as above}
        function SetRenewalsPaused(club_id, paused) {
            return $http.put('/api/v1/clubs/' + club_id + '/renewals_paused', {paused: paused ? 1 : 0}).then(handleSuccess, handleError2);
        }

        // pause (true) / resume (false) a club's Direct Debit collection — ToAviate staff only
        // (backend BACKEND_DD_COLLECTION_GUIDE.md §7) → {success, changed, ...the club's row as GetRenewalsPaused}
        function SetDdCollectionPaused(club_id, paused) {
            return $http.put('/api/v1/clubs/' + club_id + '/dd_collection_paused', {paused: paused ? 1 : 0}).then(handleSuccess, handleError2);
        }

        // invoices the Direct Debit collection held as possible duplicates (club admins) → {success, holds: [...]}
        function GetDdHolds(club_id) {
            return $http.get('/api/v1/invoices/dd_holds/' + club_id).then(handleSuccess, handleError2);
        }

        // settle a held invoice: action 'link' (it is that GoCardless payment's) | 'release' (collect it) | 'void'
        function ResolveDdHold(invoice_id, action, payment_id) {
            return $http.put('/api/v1/invoices/' + invoice_id + '/dd_hold', {action: action, payment_id: payment_id || 0}).then(handleSuccess, handleError2);
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