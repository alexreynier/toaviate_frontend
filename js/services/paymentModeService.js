app.factory('PaymentModeService', PaymentModeService);

    PaymentModeService.$inject = ['$http', '$location'];
    function PaymentModeService($http, $location) {
        var service = {};

        service.GetStatus = GetStatus;
        service.GetConfig = GetConfig;
        service.GetLog = GetLog;
        service.Switch = Switch;

        return service;

        // GET payment_mode/{club_id} — current mode + switch-impact counts
        function GetStatus(club_id) {
            return $http.get('/api/v1/payment_mode/' + club_id).then(handleSuccess, handleError2);
        }

        // GET payment_mode/{club_id}/config — per-club Stripe publishable key
        function GetConfig(club_id) {
            return $http.get('/api/v1/payment_mode/' + club_id + '/config').then(handleSuccess, handleError2);
        }

        // GET payment_mode/{club_id}/log — audit history
        function GetLog(club_id) {
            return $http.get('/api/v1/payment_mode/' + club_id + '/log').then(handleSuccess, handleError2);
        }

        // PUT payment_mode/{club_id} — perform the switch (super-admin only)
        // body = { to_mode: 'live'|'sandbox', confirm: true, note: '...' }
        function Switch(club_id, body) {
            return $http.put('/api/v1/payment_mode/' + club_id, body).then(handleSuccess, handleError2);
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
    }
