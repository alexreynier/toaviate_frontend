app.factory('FlightMergeService', FlightMergeService);

    FlightMergeService.$inject = ['$http', '$location'];
    function FlightMergeService($http, $location) {

        var service = {};

        service.GetCandidatesByPlane = GetCandidatesByPlane;
        service.GetCandidatesByClub = GetCandidatesByClub;
        service.Preview = Preview;
        service.Apply = Apply;
        service.GetHistory = GetHistory;
        service.GetDetail = GetDetail;

        return service;

        // ── Merge candidates for one aircraft ──
        function GetCandidatesByPlane(planeId) {
            return $http.get('/api/v1/flight_merge/candidates/' + planeId)
                .then(handleSuccess, handleError2);
        }

        // ── Merge candidates for all club aircraft ──
        function GetCandidatesByClub(clubId) {
            return $http.get('/api/v1/flight_merge/candidates_by_club/' + clubId)
                .then(handleSuccess, handleError2);
        }

        // ── Side-by-side preview (no mutations) ──
        function Preview(data) {
            return $http.post('/api/v1/flight_merge/preview', data)
                .then(handleSuccess, handleError2);
        }

        // ── Execute the merge ──
        function Apply(data) {
            return $http.post('/api/v1/flight_merge/apply', data)
                .then(handleSuccess, handleError2);
        }

        // ── Club-wide merge history (paginated) ──
        function GetHistory(clubId, page, perPage) {
            page = page || 1;
            perPage = perPage || 20;
            return $http.get('/api/v1/flight_merge/history/' + clubId + '?page=' + page + '&per_page=' + perPage)
                .then(handleSuccess, handleError2);
        }

        // ── Full audit detail for one merge ──
        function GetDetail(mergeId) {
            return $http.get('/api/v1/flight_merge/detail/' + mergeId)
                .then(handleSuccess, handleError2);
        }

        // ── Private helpers ──
        function handleSuccess(res) {
            return res.data;
        }

        function handleError2(res) {
            console.log("ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
