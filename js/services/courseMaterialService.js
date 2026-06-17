// ─────────────────────────────────────────────────────
// CourseMaterialService — post-course/lesson material (encrypted PDFs).
// Upload (instructor/admin), serve (decrypt→base64), per-student engagement.
// ─────────────────────────────────────────────────────
app.factory('CourseMaterialService', CourseMaterialService);

    CourseMaterialService.$inject = ['$http', '$location'];
    function CourseMaterialService($http, $location) {

        var base = '/api/v1/course_materials';
        var s = {};

        s.ListForTarget = function(type, id, timing) {
            return $http.get(base + '/target/' + type + '/' + id + (timing ? ('?timing=' + timing) : '')).then(ok, err);
        };
        s.Get           = function(id) { return $http.get(base + '/' + id).then(ok, err); };
        s.GetFile       = function(id) { return $http.get(base + '/file/' + id).then(ok, err); };   // PDF: { file(base64), data_uri, ... }
        s.GetStatus     = function(id) { return $http.get(base + '/' + id + '/status').then(ok, err); }; // video processing poll
        s.AccessReport  = function(id) { return $http.get(base + '/' + id + '/access').then(ok, err); };
        s.Update        = function(id, data) { return $http.put(base + '/' + id, data).then(ok, err); };
        s.Delete        = function(id) { return $http.delete(base + '/' + id).then(ok, err); };
        s.Track         = function(id, body) { return $http.post(base + '/' + id + '/track', body).then(ok, err); };

        // Video playback.
        // The stream endpoint authenticates via the Api-Key/Session HTTP headers
        // (this app keeps auth in $http default headers, NOT cookies), so a raw
        // <video src="…/stream/id"> can't authenticate. We therefore fetch the
        // decrypted MP4 through $http (headers attached) as a blob and play it from
        // an object URL. Returns a promise of { url, revoke() }.
        // (Trade-off: no HTTP range-seek — the clip loads as one blob. Fine for the
        // transcoded ≤720p lesson clips; revisit if very large videos are needed.)
        s.GetVideoObjectUrl = function(id) {
            return $http.get(base + '/stream/' + id, { responseType: 'blob' }).then(function(resp) {
                var type = resp.headers('Content-Type') || 'video/mp4';
                // A not-ready stream returns JSON (409) rather than video bytes.
                if (type.indexOf('application/json') > -1) {
                    return { success: false, message: 'This video is still processing.' };
                }
                var url = URL.createObjectURL(new Blob([resp.data], { type: type }));
                return { success: true, url: url, revoke: function() { try { URL.revokeObjectURL(url); } catch (e) {} } };
            }, function() {
                return { success: false, message: 'Could not load the video.' };
            });
        };

        // Multipart upload (like lesson_content_files): a `file` part + text fields.
        s.Upload = function(file, fields) {
            var fd = new FormData();
            fd.append('file', file);
            angular.forEach(fields || {}, function(v, k) { fd.append(k, v); });
            return $http.post(base, fd, {
                headers: { 'Content-Type': undefined },
                transformRequest: angular.identity,
                timeout: 120000   // large PDFs
            }).then(ok, err);
        };

        return s;

        function ok(r) { return r.data; }
        function err(r) {
            if (r && r.status == 401) { $location.path('/login'); }
            var d = r && r.data;
            return { success: false, code: d ? d.code : (r ? r.status : 0), message: d ? (d.message || d.error) : 'Request failed' };
        }
    }
