app.factory('RemindersService', RemindersService);

    RemindersService.$inject = ['$http', '$location'];
    function RemindersService($http, $location) {

        // Unified expiry-reminder system — see FRONTEND_REMINDERS_GUIDE.md.
        // Individual preferences (medical, licence, …) + club/aircraft
        // reminders (ARC, maintenance, hours, …) with per-person recipients.

        var service = {};

        service.GetTypes = GetTypes;
        service.GetPreferences = GetPreferences;
        service.SavePreferences = SavePreferences;
        service.GetHistory = GetHistory;

        service.GetClubSettings = GetClubSettings;
        service.SaveClubSettings = SaveClubSettings;
        service.AddRecipient = AddRecipient;
        service.UpdateRecipient = UpdateRecipient;
        service.DeleteRecipient = DeleteRecipient;
        service.GetClubHistory = GetClubHistory;
        service.RunOrgPreview = RunOrgPreview;

        return service;

        // ── Individual (account settings) ──

        function GetTypes() {
            return $http.get('/api/v1/reminders/types').then(handleSuccess, handleError2);
        }

        function GetPreferences() {
            return $http.get('/api/v1/reminders/preferences').then(handleSuccess, handleError2);
        }

        // preferences = [{reminder_type, enabled?, offsets_days?}, …] — partial;
        // omitting offsets_days resets that type to its defaults.
        function SavePreferences(preferences) {
            return $http.put('/api/v1/reminders/preferences', { preferences: preferences }).then(handleSuccess, handleError2);
        }

        function GetHistory(limit) {
            return $http.get('/api/v1/reminders/history?limit=' + (limit || 50)).then(handleSuccess, handleError2);
        }

        // NB: GET reminders/my_subscriptions exists server-side (recipient
        // self-service), but by product decision (2026-07) club reminders
        // are managed by club admins only — members who want to stop
        // receiving them ask their admin. Intentionally not wired up here.

        // ── Club / organisation (manager) ──

        function GetClubSettings(club_id) {
            return $http.get('/api/v1/reminders/club_settings/' + club_id).then(handleSuccess, handleError2);
        }

        // settings = [{reminder_type, enabled?, offsets?}, …] — partial.
        function SaveClubSettings(club_id, settings) {
            return $http.put('/api/v1/reminders/club_settings/' + club_id, { settings: settings }).then(handleSuccess, handleError2);
        }

        // reminder_types = ['aircraft_arc', …] or the string 'all'.
        function AddRecipient(club_id, user_id, reminder_types) {
            return $http.post('/api/v1/reminders/recipients/' + club_id, { user_id: user_id, reminder_types: reminder_types }).then(handleSuccess, handleError2);
        }

        // changes = {enabled} | {offsets_override: [..] | null}.
        function UpdateRecipient(club_id, row_id, changes) {
            return $http.put('/api/v1/reminders/recipients/' + club_id + '/' + row_id, changes).then(handleSuccess, handleError2);
        }

        function DeleteRecipient(club_id, row_id) {
            return $http.delete('/api/v1/reminders/recipients/' + club_id + '/' + row_id).then(handleSuccess, handleError2);
        }

        function GetClubHistory(club_id, limit) {
            return $http.get('/api/v1/reminders/club_history/' + club_id + '?limit=' + (limit || 100)).then(handleSuccess, handleError2);
        }

        // Dry run only — never expose dry_run=0 from the UI.
        function RunOrgPreview(club_id) {
            return $http.get('/api/v1/reminders/run_org/' + club_id + '?dry_run=1').then(handleSuccess, handleError2);
        }

        function handleSuccess(res) { return res.data; }

        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            return { success: false, message: res.data, status: res.status };
        }
    }
