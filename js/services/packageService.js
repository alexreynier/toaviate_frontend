app.factory('PackageService', PackageService);

    PackageService.$inject = ['$http', '$location'];
    function PackageService($http, $location) {
        var service = {};
        
        service.GetPackageById = GetPackageById;
        service.GetPackagesByClubId = GetPackagesByClubId;
        service.CreatePackage = CreatePackage;
        service.UpdatePackage = UpdatePackage;
        service.DeletePackage = DeletePackage;

        service.GetPackagePlanesById = GetPackagePlanesById;
        service.GetPackagePlanesByPackageId = GetPackagePlanesByPackageId;
        service.CreatePackagePlane = CreatePackagePlane;
        service.UpdatePackagePlane = UpdatePackagePlane;
        service.DeletePackagePlane = DeletePackagePlane;

        service.GetPackagesByUserId = GetPackagesByUserId;
        service.GetPackagesForBookout = GetPackagesForBookout;
        service.GetPackagesByUserIdAndClubId = GetPackagesByUserIdAndClubId;

        service.SwapPackageHours = SwapPackageHours;
        service.RefundPackageToAccount = RefundPackageToAccount;

        return service; 

        //packages 

        function GetPackageById(id) {
            return $http.get('/api/v1/packages/' + id).then(handleSuccess, handleError2);
        }

        function GetPackagesByClubId(club_id) {
            return $http.get('/api/v1/packages/club/'+club_id).then(handleSuccess, handleError2);
        }

        function CreatePackage(nok) {
            return $http.post('/api/v1/packages', nok).then(handleSuccess, handleError2);
        }

        function UpdatePackage(nok) {
            return $http.put('/api/v1/packages/' + nok.id, nok).then(handleSuccess, handleError2);
        }

        function DeletePackage(id) {
            return $http.delete('/api/v1/packages/' + id).then(handleSuccess, handleError2);
        }


         //package_planes

        function GetPackagePlanesById(id) {
            return $http.get('/api/v1/package_planes/' + id).then(handleSuccess, handleError2);
        }

        function GetPackagePlanesByPackageId(package_id) {
            return $http.get('/api/v1/package_planes/package/'+package_id).then(handleSuccess, handleError2);
        }

        function CreatePackagePlane(nok) {
            return $http.post('/api/v1/package_planes', nok).then(handleSuccess, handleError2);
        }

        function UpdatePackagePlane(nok) {
            return $http.put('/api/v1/package_planes/' + nok.id, nok).then(handleSuccess, handleError2);
        }

        function DeletePackagePlane(id) {
            return $http.delete('/api/v1/package_planes/' + id).then(handleSuccess, handleError2);
        }


        //PACKAGE AND PACKAGE USE

        function GetPackagesByUserId(user_id) {
            return $http.get('/api/v1/member_packages/user/'+user_id).then(handleSuccess, handleError2);
        }

        function GetPackagesForBookout(plane_log_sheet_id) {
            return $http.get('/api/v1/member_packages/bookout/'+plane_log_sheet_id).then(handleSuccess, handleError2);
        }

        function SwapPackageHours(id, content){
            return $http.post('/api/v1/member_packages/swap_hours_packages/'+id, content).then(handleSuccess, handleError2);
        }

        function RefundPackageToAccount(id){
            return $http.post('/api/v1/member_packages/refund_package_to_account/'+id).then(handleSuccess, handleError2);
        }
        
        //refund_package_to_account

        function GetPackagesByUserIdAndClubId(user_id, club_id){
            return $http.get('/api/v1/member_packages/member/'+user_id+'/'+club_id).then(handleSuccess, handleError2);
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