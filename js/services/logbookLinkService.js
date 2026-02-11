    app.factory('LogbookLinkService', LogbookLinkService);

    LogbookLinkService.$inject = ['$http', '$location'];
    function LogbookLinkService($http, $location) {

        var service = {};

        // Get links for a maintenance check
        service.GetLinks = GetLinks;

        // Get available logbooks for a plane
        service.GetAvailableLogbooks = GetAvailableLogbooks;

        // Get maintenance checks for a specific logbook
        service.GetByLogbook = GetByLogbook;

        // Link / Unlink
        service.Link = Link;
        service.Unlink = Unlink;

        // Bulk link (replace all associations)
        service.BulkLink = BulkLink;

        // Delete a specific link by ID
        service.Delete = Delete;

        // Audit
        service.GetAudit = GetAudit;
        service.GetAuditByPlane = GetAuditByPlane;

        return service;

        // ── Methods ──

        function GetLinks(maintenance_check_id) {
            return $http.get('/api/v1/maintenance_check_logbook_links/' + maintenance_check_id).then(handleSuccess, handleError);
        }

        function GetAvailableLogbooks(plane_id) {
            return $http.get('/api/v1/maintenance_check_logbook_links/available_logbooks/' + plane_id).then(handleSuccess, handleError);
        }

        function GetByLogbook(logbook_type, logbook_entity_id) {
            return $http.get('/api/v1/maintenance_check_logbook_links/logbook/' + logbook_type + '/' + logbook_entity_id).then(handleSuccess, handleError);
        }

        function Link(maintenance_check_id, logbook_type, logbook_entity_id) {
            return $http.put('/api/v1/maintenance_check_logbook_links/link/' + maintenance_check_id, {
                logbook_type: logbook_type,
                logbook_entity_id: logbook_entity_id || null
            }).then(handleSuccess, handleError);
        }

        function Unlink(maintenance_check_id, logbook_type, logbook_entity_id) {
            return $http.put('/api/v1/maintenance_check_logbook_links/unlink/' + maintenance_check_id, {
                logbook_type: logbook_type,
                logbook_entity_id: logbook_entity_id || null
            }).then(handleSuccess, handleError);
        }

        function BulkLink(maintenance_check_id, logbooks) {
            return $http.put('/api/v1/maintenance_check_logbook_links/bulk_link/' + maintenance_check_id, {
                logbooks: logbooks
            }).then(handleSuccess, handleError);
        }

        function Delete(link_id) {
            return $http.delete('/api/v1/maintenance_check_logbook_links/' + link_id).then(handleSuccess, handleError);
        }

        function GetAudit(maintenance_check_id) {
            return $http.get('/api/v1/maintenance_check_logbook_links/audit/' + maintenance_check_id).then(handleSuccess, handleError);
        }

        function GetAuditByPlane(plane_id) {
            return $http.get('/api/v1/maintenance_check_logbook_links/audit_plane/' + plane_id).then(handleSuccess, handleError);
        }

        // ── Handlers ──

        function handleError(res) {
            console.log("LogbookLinkService ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }

        function handleSuccess(res) {
            return res.data;
        }
    }
