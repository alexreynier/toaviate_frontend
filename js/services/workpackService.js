    app.factory('WorkpackService', WorkpackService);

    WorkpackService.$inject = ['$http', '$location'];
    function WorkpackService($http, $location) {

        var service = {};

        // CRUD
        service.Create = Create;
        service.GetById = GetById;
        service.GetByPlane = GetByPlane;
        service.GetByClub = GetByClub;
        service.GetOpenByPlane = GetOpenByPlane;
        service.Update = Update;
        service.Delete = Delete;

        // Linking defects
        service.LinkDefect = LinkDefect;
        service.UnlinkDefect = UnlinkDefect;

        // Linking maintenance events
        service.LinkMaintenance = LinkMaintenance;
        service.UnlinkMaintenance = UnlinkMaintenance;

        // Standalone defect workpack info
        service.UpdateDefectWorkpack = UpdateDefectWorkpack;

        // Document download
        service.DownloadDocument = DownloadDocument;

        return service;

        // ── CRUD ──

        function Create(workpack) {
            return $http.post('/api/v1/maintenance_workpacks', workpack).then(handleSuccess, handleError);
        }

        function GetById(id) {
            return $http.get('/api/v1/maintenance_workpacks/' + id).then(handleSuccess, handleError);
        }

        function GetByPlane(plane_id) {
            return $http.get('/api/v1/maintenance_workpacks/plane/' + plane_id).then(handleSuccess, handleError);
        }

        function GetByClub(club_id) {
            return $http.get('/api/v1/maintenance_workpacks/club/' + club_id).then(handleSuccess, handleError);
        }

        function GetOpenByPlane(plane_id) {
            return $http.get('/api/v1/maintenance_workpacks/open/' + plane_id).then(handleSuccess, handleError);
        }

        function Update(id, workpack) {
            return $http.put('/api/v1/maintenance_workpacks/' + id, workpack).then(handleSuccess, handleError);
        }

        function Delete(id) {
            return $http.delete('/api/v1/maintenance_workpacks/' + id).then(handleSuccess, handleError);
        }

        // ── Linking ──

        function LinkDefect(workpack_id, defect_id) {
            return $http.put('/api/v1/maintenance_workpacks/link_defect/' + workpack_id, { defect_id: defect_id }).then(handleSuccess, handleError);
        }

        function UnlinkDefect(defect_id) {
            return $http.put('/api/v1/maintenance_workpacks/unlink_defect/' + defect_id).then(handleSuccess, handleError);
        }

        function LinkMaintenance(workpack_id, maintenance_check_id) {
            return $http.put('/api/v1/maintenance_workpacks/link_maintenance/' + workpack_id, { maintenance_check_id: maintenance_check_id }).then(handleSuccess, handleError);
        }

        function UnlinkMaintenance(maintenance_check_id) {
            return $http.put('/api/v1/maintenance_workpacks/unlink_maintenance/' + maintenance_check_id).then(handleSuccess, handleError);
        }

        // ── Standalone defect workpack ──

        function UpdateDefectWorkpack(defect_id, data) {
            return $http.put('/api/v1/maintenance_workpacks/defect_workpack/' + defect_id, data).then(handleSuccess, handleError);
        }

        // ── Document download ──

        function DownloadDocument(filename) {
            return $http.get('/api/v1/maintenance_workpacks/file/' + filename, {
                responseType: 'arraybuffer'
            }).then(handleSuccess, handleError);
        }

        // ── Handlers ──

        function handleError(res) {
            console.log("WorkpackService ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }

        function handleSuccess(res) {
            return res.data;
        }
    }
