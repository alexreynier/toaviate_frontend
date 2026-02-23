// DefectMediaService — CRUD + upload for defect photos & videos
// Endpoints: POST https://local-api.toaviate.com/upload_defect_media.php (step 1), POST/GET/PUT/DELETE /api/v1/defect_media (step 2+)

app.factory('DefectMediaService', DefectMediaService);

    DefectMediaService.$inject = ['$http', '$location'];
    function DefectMediaService($http, $location) {

        var service = {};

        // Two-step upload
        service.UploadFile           = UploadFile;
        service.AttachToDefect       = AttachToDefect;

        // Combined: upload then attach
        service.UploadAndAttach      = UploadAndAttach;

        // Read
        service.GetForDefect         = GetForDefect;
        service.GetById              = GetById;

        // Serve files (returns blob URL)
        service.LoadFileUrl          = LoadFileUrl;
        service.LoadThumbnailUrl     = LoadThumbnailUrl;

        // Update
        service.UpdateSortOrder      = UpdateSortOrder;
        service.Reorder              = Reorder;

        // Delete
        service.Delete               = Delete;

        return service;

        // ── Step 1: Upload file to temp storage (on API server) ──
        function UploadFile(file) {
            var formData = new FormData();
            formData.append('file', file);

            return $http.post('https://local-api.toaviate.com/upload_defect_media.php', formData, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined }
            }).then(handleSuccess, handleError2);
        }

        // ── Step 2: Attach temp file to defect ──
        function AttachToDefect(defectId, clubId, tempPath, originalName, mediaType, sortOrder, userId) {
            return $http.post('/api/v1/defect_media', {
                defect_id:     defectId,
                club_id:       clubId,
                temp_path:     tempPath,
                original_name: originalName,
                media_type:    mediaType,
                sort_order:    sortOrder || 0,
                uploaded_by:   userId || null
            }).then(handleSuccess, handleError2);
        }

        // ── Combined: upload then attach ──
        function UploadAndAttach(file, defectId, clubId, sortOrder, userId) {
            return UploadFile(file).then(function (uploadData) {
                if (!uploadData.success) {
                    return { success: false, message: uploadData.message || 'Upload failed' };
                }
                return AttachToDefect(
                    defectId,
                    clubId,
                    uploadData.saved_url,
                    uploadData.original_name || file.name,
                    uploadData.media_type,
                    sortOrder || 0,
                    userId
                );
            });
        }

        // ── Read ──
        function GetForDefect(defectId) {
            return $http.get('/api/v1/defect_media/defect/' + defectId).then(handleSuccess, handleError2);
        }

        function GetById(id) {
            return $http.get('/api/v1/defect_media/' + id).then(handleSuccess, handleError2);
        }

        // ── Serve files as blob URLs ──
        function LoadFileUrl(storedName) {
            return $http.get('/api/v1/defect_media/file/' + storedName, {
                responseType: 'blob'
            }).then(function (res) {
                return URL.createObjectURL(res.data);
            });
        }

        function LoadThumbnailUrl(storedName) {
            return $http.get('/api/v1/defect_media/thumbnail/' + storedName, {
                responseType: 'blob'
            }).then(function (res) {
                return URL.createObjectURL(res.data);
            });
        }

        // ── Update ──
        function UpdateSortOrder(id, sortOrder) {
            return $http.put('/api/v1/defect_media/' + id, {
                sort_order: sortOrder
            }).then(handleSuccess, handleError2);
        }

        function Reorder(defectId, orderedIds) {
            return $http.put('/api/v1/defect_media/reorder/' + defectId, {
                order: orderedIds
            }).then(handleSuccess, handleError2);
        }

        // ── Delete ──
        function Delete(id) {
            return $http.delete('/api/v1/defect_media/' + id).then(handleSuccess, handleError2);
        }

        // ── Helpers ──
        function handleError2(res) {
            console.log("DefectMediaService ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }

        function handleSuccess(res) {
            return res.data;
        }
    }
