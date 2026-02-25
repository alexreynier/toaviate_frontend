// ─────────────────────────────────────────────────────
// BsSyncService — BookedScheduler Sync API integration
// ─────────────────────────────────────────────────────
app.factory('BsSyncService', BsSyncService);

    BsSyncService.$inject = ['$http'];
    function BsSyncService($http) {

        var service = {};

        // ── Status / Config ──
        service.GetStatus          = GetStatus;
        service.GetConfig          = GetConfig;
        service.UpdateConfig       = UpdateConfig;

        // ── Resources ──
        service.GetResources       = GetResources;
        service.DiscoverResources  = DiscoverResources;
        service.DiscoverInstructors = DiscoverInstructors;
        service.SaveResourceMap    = SaveResourceMap;

        // ── Users ──
        service.GetUsers           = GetUsers;
        service.DiscoverUsers      = DiscoverUsers;
        service.DiscoverUsersFromReservations = DiscoverUsersFromReservations;
        service.SaveUserMap        = SaveUserMap;

        // ── Setup / Import ──
        service.FullSetup          = FullSetup;
        service.ImportCSV          = ImportCSV;
        service.Purge              = Purge;

        // ── Sync ──
        service.RunSync            = RunSync;
        service.GetLogs            = GetLogs;
        service.DeleteBookings     = DeleteBookings;

        // ── Imported Users ──
        service.ConvertUser        = ConvertUser;

        return service;

        // ── Status / Config ──────────────────────────

        function GetStatus(club_id) {
            return $http.get('/api/v1/bs_sync/status/' + club_id)
                .then(handleSuccess, handleError);
        }

        function GetConfig(club_id) {
            return $http.get('/api/v1/bs_sync/config/' + club_id)
                .then(handleSuccess, handleError);
        }

        function UpdateConfig(club_id, data) {
            return $http.put('/api/v1/bs_sync/config/' + club_id, data)
                .then(handleSuccess, handleError);
        }

        // ── Resources ────────────────────────────────

        function GetResources(club_id) {
            return $http.get('/api/v1/bs_sync/resources/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverResources(club_id) {
            return $http.post('/api/v1/bs_sync/resources/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverInstructors(club_id) {
            return $http.post('/api/v1/bs_sync/resources/' + club_id + '?type=instructors')
                .then(handleSuccess, handleError);
        }

        function SaveResourceMap(club_id, bs_resource_id, data) {
            return $http.put('/api/v1/bs_sync/resources/' + club_id + '/' + bs_resource_id, data)
                .then(handleSuccess, handleError);
        }

        // ── Users ────────────────────────────────────

        function GetUsers(club_id, unmapped) {
            var url = '/api/v1/bs_sync/users/' + club_id;
            if (unmapped) url += '?unmapped=1';
            return $http.get(url)
                .then(handleSuccess, handleError);
        }

        function DiscoverUsers(club_id) {
            return $http.post('/api/v1/bs_sync/users/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverUsersFromReservations(club_id) {
            return $http.post('/api/v1/bs_sync/users/' + club_id + '?source=reservations')
                .then(handleSuccess, handleError);
        }

        function SaveUserMap(club_id, bs_user_id, data) {
            return $http.put('/api/v1/bs_sync/users/' + club_id + '/' + bs_user_id, data)
                .then(handleSuccess, handleError);
        }

        // ── Setup / Import (multipart) ───────────────

        function FullSetup(club_id, file, membership_id) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('membership_id', membership_id || 0);
            return $http.post('/api/v1/bs_sync/setup/' + club_id, fd, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined },
                timeout: 120000   // 2 min — this is a long-running call
            }).then(handleSuccess, handleError);
        }

        function ImportCSV(club_id, file, membership_id) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('membership_id', membership_id || 0);
            return $http.post('/api/v1/bs_sync/import-csv/' + club_id, fd, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined },
                timeout: 60000
            }).then(handleSuccess, handleError);
        }

        function Purge(club_id) {
            return $http.delete('/api/v1/bs_sync/purge/' + club_id)
                .then(handleSuccess, handleError);
        }

        // ── Sync ─────────────────────────────────────

        function RunSync(club_id, data) {
            return $http.post('/api/v1/bs_sync/run/' + club_id, data)
                .then(handleSuccess, handleError);
        }

        function GetLogs(club_id, limit) {
            var url = '/api/v1/bs_sync/logs/' + club_id;
            if (limit) url += '?limit=' + limit;
            return $http.get(url)
                .then(handleSuccess, handleError);
        }

        function DeleteBookings(club_id) {
            return $http.delete('/api/v1/bs_sync/bookings/' + club_id)
                .then(handleSuccess, handleError);
        }

        // ── Imported Users ───────────────────────────

        function ConvertUser(club_id, user_id) {
            return $http.post('/api/v1/bs_sync/convert/' + club_id + '/' + user_id)
                .then(handleSuccess, handleError);
        }

        // ── Helpers ──────────────────────────────────

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(res) {
            return { success: false, message: res.data ? (res.data.message || res.data.error) : 'Request failed' };
        }
    }
