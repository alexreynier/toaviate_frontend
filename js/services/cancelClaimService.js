app.factory('CancelClaimService', CancelClaimService);

    CancelClaimService.$inject = ['$http', '$location'];
    function CancelClaimService($http, $location) {

        var service = {};

        service.PreviewCancelClaim = PreviewCancelClaim;
        service.CancelClaim = CancelClaim;
        service.GetCancellation = GetCancellation;
        service.GetCancellationsByClub = GetCancellationsByClub;

        return service;

        // ── Preview cancellation impact (read-only, no mutations) ──
        function PreviewCancelClaim(plsId) {
            return $http.post('/api/v1/flight_edits/preview_cancel_claim', {
                plane_log_sheet_id: plsId
            }).then(handleSuccess, handleError2);
        }

        // ── Execute the cancellation ──
        function CancelClaim(data) {
            return $http.post('/api/v1/flight_edits/cancel_claim', data)
                .then(handleSuccess, handleError2);
        }

        // ── Get detail for one cancellation ──
        function GetCancellation(cancellationId) {
            return $http.get('/api/v1/flight_edits/claim_cancellation/' + cancellationId)
                .then(handleSuccess, handleError2);
        }

        // ── Club-wide cancellation history (paginated) ──
        function GetCancellationsByClub(clubId, page, perPage) {
            page = page || 1;
            perPage = perPage || 20;
            return $http.get('/api/v1/flight_edits/claim_cancellations_by_club/' + clubId + '?page=' + page + '&per_page=' + perPage)
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
