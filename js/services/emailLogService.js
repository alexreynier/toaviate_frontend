app.factory('EmailLogService', EmailLogService);

    EmailLogService.$inject = ['$http', '$location'];
    function EmailLogService($http, $location) {

        // Email log, master mute and manage-member email preferences.
        // Contract: FRONTEND_EMAIL_LOG_AND_PREFERENCES_GUIDE.md
        //   §1 self preferences        GET/PUT email_preferences
        //   §2 member preferences      GET/PUT email_preferences/member/{member_id}
        //   §3 platform / club log     GET email_log[...], email_log/club/{club_id}[...]
        //   §4 cron dry runs           GET bookings/process_*?dry_run=1&club_id=
        // Every call resolves (never rejects) — branch on data.success.

        var service = {};

        service.GetPreferences = GetPreferences;
        service.SavePreferences = SavePreferences;
        service.GetMemberPreferences = GetMemberPreferences;
        service.SaveMemberPreferences = SaveMemberPreferences;

        service.List = List;
        service.Get = Get;
        service.Stats = Stats;
        service.Sources = Sources;
        service.ListForUser = ListForUser;

        service.DryRun = DryRun;
        service.DRY_RUNS = [
            { key: 'today',    endpoint: 'bookings/process_reminders',                label: "Today's booking reminders",     icon: 'fa-calendar-day',  who: 'pilot' },
            { key: 'tomorrow', endpoint: 'bookings/process_day_ahead_reminders',      label: "Tomorrow's booking reminders",  icon: 'fa-calendar-alt',  who: 'pilot' },
            { key: 'summary',  endpoint: 'bookings/process_instructor_daily_summary', label: "Tonight's instructor summary",  icon: 'fa-chalkboard-teacher', who: 'instructor' }
        ];

        return service;

        // ── Preferences ──

        function GetPreferences() {
            return $http.get('/api/v1/email_preferences').then(handleSuccess, handleError2);
        }

        // body = { mute_all_notifications, note } (partial)
        function SavePreferences(body) {
            return $http.put('/api/v1/email_preferences', body).then(handleSuccess, handleError2);
        }

        function GetMemberPreferences(member_id) {
            return $http.get('/api/v1/email_preferences/member/' + member_id).then(handleSuccess, handleError2);
        }

        // body = only the fields that were touched (+ note, reminder_preferences)
        function SaveMemberPreferences(member_id, body) {
            return $http.put('/api/v1/email_preferences/member/' + member_id, body).then(handleSuccess, handleError2);
        }

        // ── Log ──
        // scope: { club_id } → club-scoped routes; otherwise platform (super admin).

        function base(scope) {
            return (scope && scope.club_id) ? '/api/v1/email_log/club/' + scope.club_id : '/api/v1/email_log';
        }

        function query(params) {
            var parts = [];
            angular.forEach(params || {}, function(v, k) {
                if (v === undefined || v === null || v === '') { return; }
                parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
            });
            return parts.length ? '?' + parts.join('&') : '';
        }

        function List(scope, params) {
            return $http.get(base(scope) + query(params)).then(handleSuccess, handleError2);
        }

        function Get(scope, id) {
            return $http.get(base(scope) + '/' + id).then(handleSuccess, handleError2);
        }

        function Stats(scope, days) {
            return $http.get(base(scope) + '/stats' + query({ days: days || 30 })).then(handleSuccess, handleError2);
        }

        function Sources() {
            return $http.get('/api/v1/email_log/sources').then(handleSuccess, handleError2);
        }

        function ListForUser(user_id, params) {
            return $http.get('/api/v1/email_log/user/' + user_id + query(params)).then(handleSuccess, handleError2);
        }

        // ── Cron previews — dry runs only; never send dry_run=0 from the UI ──

        function DryRun(endpoint, club_id) {
            return $http.get('/api/v1/' + endpoint + query({ dry_run: 1, club_id: club_id })).then(handleSuccess, handleError2);
        }

        function handleSuccess(res) { return res.data; }

        function handleError2(res) {
            if (res.status == 401) { $location.path('/login'); }
            var msg = (res.data && res.data.message) || res.data;
            return { success: false, message: msg, status: res.status };
        }
    }
