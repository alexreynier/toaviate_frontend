app.factory('CrsService', ['$http', 'EnvConfig', function ($http, EnvConfig) {

    var baseUrl = EnvConfig.getApiBaseUrl() + '/api/v1';

    return {

        // Get all CRS records for a plane
        GetAll: function (planeId) {
            return $http.get(baseUrl + '/plane_crs/all/' + planeId)
                .then(function (res) { return res.data; });
        },

        // Get single CRS by ID
        GetById: function (id) {
            return $http.get(baseUrl + '/plane_crs/' + id)
                .then(function (res) { return res.data; });
        },

        // Create a new CRS (auto-archives previous)
        Create: function (data) {
            return $http.post(baseUrl + '/plane_crs', data)
                .then(function (res) { return res.data; });
        },

        // Delete (archive) a CRS
        Delete: function (id) {
            return $http.delete(baseUrl + '/plane_crs/' + id)
                .then(function (res) { return res.data; });
        },

        // Download as binary (triggers browser download)
        DownloadFile: function (filename) {
            return baseUrl + '/plane_crs/show_file/' + filename;
        },

        // Download as base64 (for in-app preview)
        GetFileBase64: function (filename) {
            return $http.get(baseUrl + '/plane_crs/show_file2/' + filename)
                .then(function (res) { return res.data; });
        }

    };

}]);
