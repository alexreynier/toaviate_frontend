// ─────────────────────────────────────────────────────
// SmsAccessService — resolves the current user's SMS role.
// The backend is authoritative (a FORBIDDEN response = no access), but the UI
// needs to decide what controls to show up-front. We combine:
//   - the club role already on $rootScope.globals (manager / super_admin), and
//   - the SMS post assignments from GET /sms/settings/{club}.
//
// Roles:
//   member         — any club member: report, dashboard, read bulletins, sign acks
//   admin          — club manager/super-admin OR an assigned SMS post
//   safetyManager  — additionally verify/close findings (safety/compliance mgr)
// ─────────────────────────────────────────────────────
app.factory('SmsAccessService', SmsAccessService);

    SmsAccessService.$inject = ['SmsService', '$rootScope', '$q'];
    function SmsAccessService(SmsService, $rootScope, $q) {

        var service = {};
        var _cache = {};   // club_id -> resolved access object

        service.resolve = resolve;
        service.fromSettings = fromSettings;
        service.isCached = isCached;
        return service;

        // True when resolve(club_id) will answer from the cache (no request).
        function isCached(club_id) { return !!_cache[club_id]; }

        // Returns a promise of the access object for a club. Cached per club_id.
        function resolve(club_id) {
            if (_cache[club_id]) return $q.when(_cache[club_id]);
            return SmsService.GetSettings(club_id).then(function(settings) {
                // A FORBIDDEN/failed settings call still yields member-level access.
                var acc = fromSettings(club_id, (settings && settings.success === false) ? null : settings);
                _cache[club_id] = acc;
                return acc;
            });
        }

        // Pure computation (also usable when a screen already has settings loaded).
        function fromSettings(club_id, settings) {
            var user = $rootScope.globals.currentUser || {};
            var uid = user.id;
            var access = user.access || {};
            // ids compared as strings — club_id may come from the Manage Club club
            // (current_club_admin) or a post holder's access.sms_post
            function inList(list) { return angular.isArray(list) && list.map(String).indexOf(String(club_id)) > -1; }
            var isClubManager = inList(access.manager);
            var isSuperAdmin  = inList(access.super_admin);

            settings = settings || {};
            function isPost(field) { return settings[field] && String(settings[field]) === String(uid); }

            var isSafetyManager = isPost('safety_manager_id') || isPost('compliance_manager_id') || isSuperAdmin;
            var isAdmin = isClubManager || isSuperAdmin ||
                isPost('accountable_manager_id') || isPost('safety_manager_id') ||
                isPost('compliance_manager_id')  || isPost('head_of_training_id') || isPost('cfi_id');

            return {
                club_id: club_id,
                userId: uid,
                isMember: true,
                isAdmin: isAdmin,
                isSafetyManager: isSafetyManager,
                isClubManager: isClubManager,
                isSuperAdmin: isSuperAdmin,
                settings: settings
            };
        }
    }
