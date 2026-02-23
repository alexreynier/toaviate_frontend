// VoucherWidgetService — handles voucher widget token management,
// settings, domains, and purchase history (authenticated, manager-only).
app.factory('VoucherWidgetService', VoucherWidgetService);

    VoucherWidgetService.$inject = ['$http'];
    function VoucherWidgetService($http) {

        var service = {};

        // ── Token Management ──
        service.GenerateToken     = GenerateToken;
        service.GetToken          = GetToken;
        service.RevokeToken       = RevokeToken;

        // ── Widget Settings ──
        service.GetSettings       = GetSettings;
        service.UpdateSettings    = UpdateSettings;

        // ── Allowed Domains ──
        service.UpdateDomains     = UpdateDomains;

        // ── Purchase History ──
        service.GetPurchases      = GetPurchases;

        // ── Refunds ──
        service.RefundPurchase    = RefundPurchase;

        // ── Notification Preferences ──
        service.GetNotificationPreferences    = GetNotificationPreferences;
        service.UpdateNotificationPreferences = UpdateNotificationPreferences;

        // ── Widget Preview ──
        service.GetPreviewUrl     = GetPreviewUrl;

        return service;

        // ─────────────────────────────────────────────
        // Token Management
        // ─────────────────────────────────────────────

        function GenerateToken(club_id) {
            return $http.post('/api/v1/voucher_widget_tokens', { club_id: club_id })
                .then(handleSuccess, handleError);
        }

        function GetToken(club_id) {
            return $http.get('/api/v1/voucher_widget_tokens/' + club_id)
                .then(handleSuccess, handleError);
        }

        function RevokeToken(club_id) {
            return $http.delete('/api/v1/voucher_widget_tokens/' + club_id)
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Widget Settings (customisation)
        // ─────────────────────────────────────────────

        function GetSettings(club_id) {
            return $http.get('/api/v1/voucher_widget_tokens/settings/' + club_id)
                .then(handleSuccess, handleError);
        }

        function UpdateSettings(club_id, settings) {
            return $http.put('/api/v1/voucher_widget_tokens/settings/' + club_id, settings)
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Allowed Domains
        // ─────────────────────────────────────────────

        function UpdateDomains(club_id, domains) {
            return $http.put('/api/v1/voucher_widget_tokens/domains/' + club_id, { domains: domains })
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Purchase History
        // ─────────────────────────────────────────────

        function GetPurchases(club_id, page, per_page) {
            var params = '?page=' + (page || 1) + '&per_page=' + (per_page || 25);
            return $http.get('/api/v1/voucher_widget_tokens/purchases/' + club_id + params)
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Refunds
        // ─────────────────────────────────────────────

        function RefundPurchase(club_id, purchase_id, reason) {
            return $http.post('/api/v1/voucher_widget_tokens/purchases/' + club_id + '/refund', {
                purchase_id: purchase_id,
                reason: reason || null
            }).then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Notification Preferences
        // ─────────────────────────────────────────────

        function GetNotificationPreferences(club_id) {
            return $http.get('/api/v1/voucher_widget_tokens/notifications/' + club_id)
                .then(handleSuccess, handleError);
        }

        function UpdateNotificationPreferences(club_id, preferences) {
            return $http.put('/api/v1/voucher_widget_tokens/notifications/' + club_id, preferences)
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────
        // Widget Preview
        // ─────────────────────────────────────────────

        function GetPreviewUrl(club_id) {
            return $http.get('/api/v1/voucher_widget_tokens/preview_url/' + club_id)
                .then(handleSuccess, handleError);
        }

        // ─────────────────────────────────────────────

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(res) {
            return { success: false, message: res.data ? res.data.message : 'Request failed' };
        }
    }
