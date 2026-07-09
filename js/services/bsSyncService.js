// ─────────────────────────────────────────────────────
// BsSyncService — BookedScheduler Sync API integration
// ─────────────────────────────────────────────────────
app.factory('BsSyncService', BsSyncService);

    BsSyncService.$inject = ['$http'];
    function BsSyncService($http) {

        var service = {};

        // ── Status / Config ──
        service.GetStatus          = GetStatus;
        service.GetConfig          = GetConfig;
        service.UpdateConfig       = UpdateConfig;

        // ── Resources ──
        service.GetResources       = GetResources;
        service.DiscoverResources  = DiscoverResources;
        service.DiscoverInstructors = DiscoverInstructors;
        service.SaveResourceMap    = SaveResourceMap;

        // ── Users ──
        service.GetUsers           = GetUsers;
        service.GetImported        = GetImported;
        service.DiscoverUsers      = DiscoverUsers;
        service.DiscoverUsersFromReservations = DiscoverUsersFromReservations;
        service.SaveUserMap        = SaveUserMap;

        // ── Setup / Import ──
        service.FullSetup          = FullSetup;
        service.ImportCSV          = ImportCSV;
        service.Purge              = Purge;

        // ── Sync ──
        service.RunSync            = RunSync;
        service.GetLogs            = GetLogs;
        service.DeleteBookings     = DeleteBookings;

        // ── Imported Users ──
        service.ConvertUser        = ConvertUser;
        service.ReconcileInvitations = ReconcileInvitations;
        service.RepairInvitation   = RepairInvitation;

        return service;

        // ── Status / Config ──────────────────────────

        function GetStatus(club_id) {
            return $http.get('/api/v1/bs_sync/status/' + club_id)
                .then(handleSuccess, handleError);
        }

        function GetConfig(club_id) {
            return $http.get('/api/v1/bs_sync/config/' + club_id)
                .then(handleSuccess, handleError);
        }

        function UpdateConfig(club_id, data) {
            return $http.put('/api/v1/bs_sync/config/' + club_id, data)
                .then(handleSuccess, handleError);
        }

        // ── Resources ────────────────────────────────

        function GetResources(club_id) {
            return $http.get('/api/v1/bs_sync/resources/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverResources(club_id) {
            return $http.post('/api/v1/bs_sync/resources/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverInstructors(club_id) {
            return $http.post('/api/v1/bs_sync/resources/' + club_id + '?type=instructors')
                .then(handleSuccess, handleError);
        }

        function SaveResourceMap(club_id, bs_resource_id, data) {
            return $http.put('/api/v1/bs_sync/resources/' + club_id + '/' + bs_resource_id, data)
                .then(handleSuccess, handleError);
        }

        // ── Users ────────────────────────────────────

        function GetUsers(club_id, unmapped) {
            var url = '/api/v1/bs_sync/users/' + club_id;
            if (unmapped) url += '?unmapped=1';
            return $http.get(url)
                .then(handleSuccess, handleError);
        }

        // Imported users awaiting conversion. Uses the dedicated endpoint that
        // keys on users.imported_user = 1 (authoritative), rather than guessing
        // from the fake bsNNNN@ login-email prefix — which missed every imported
        // user numbered >= 1000 (e.g. bs1796@).
        function GetImported(club_id) {
            return $http.get('/api/v1/bs_sync/imported/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverUsers(club_id) {
            return $http.post('/api/v1/bs_sync/users/' + club_id)
                .then(handleSuccess, handleError);
        }

        function DiscoverUsersFromReservations(club_id) {
            return $http.post('/api/v1/bs_sync/users/' + club_id + '?source=reservations')
                .then(handleSuccess, handleError);
        }

        function SaveUserMap(club_id, bs_user_id, data) {
            return $http.put('/api/v1/bs_sync/users/' + club_id + '/' + bs_user_id, data)
                .then(handleSuccess, handleError);
        }

        // ── Setup / Import (multipart) ───────────────

        function FullSetup(club_id, file, membership_id) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('membership_id', membership_id || 0);
            return $http.post('/api/v1/bs_sync/setup/' + club_id, fd, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined },
                timeout: 120000   // 2 min — this is a long-running call
            }).then(handleSuccess, handleError);
        }

        function ImportCSV(club_id, file, membership_id) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('membership_id', membership_id || 0);
            return $http.post('/api/v1/bs_sync/import-csv/' + club_id, fd, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined },
                timeout: 60000
            }).then(handleSuccess, handleError);
        }

        function Purge(club_id) {
            return $http.delete('/api/v1/bs_sync/purge/' + club_id)
                .then(handleSuccess, handleError);
        }

        // ── Sync ─────────────────────────────────────

        // Triggers a sync. The backend now runs the sync in a DETACHED background
        // process and returns immediately ({ success, started:true, async:true }) —
        // there are NO stats on this response. Callers must poll GetStatus / GetLogs
        // to observe progress and completion (see the controller's _pollSync helper).
        // Pass wait=true to use the documented `?wait=1` synchronous fallback, which
        // blocks until the sync finishes and returns the full result (debug / short
        // syncs only — risks the request timeout the async path was built to avoid).
        function RunSync(club_id, data, wait) {
            var url = '/api/v1/bs_sync/run/' + club_id;
            if (wait) url += '?wait=1';
            return $http.post(url, data)
                .then(handleSuccess, handleError);
        }

        function GetLogs(club_id, limit) {
            var url = '/api/v1/bs_sync/logs/' + club_id;
            if (limit) url += '?limit=' + limit;
            return $http.get(url)
                .then(handleSuccess, handleError);
        }

        function DeleteBookings(club_id) {
            return $http.delete('/api/v1/bs_sync/bookings/' + club_id)
                .then(handleSuccess, handleError);
        }

        // ── Imported Users ───────────────────────────

        // Convert a BS-imported placeholder into a real member.
        //   opts: { membership_id (required), term_start, membership_ends } — all
        //   YYYY-MM-DD strings except membership_id. Only set keys are sent; the
        //   backend computes membership_ends from the tier's term if omitted.
        //   If membership_id is missing/invalid the backend replies
        //   { success:false, error:"MEMBERSHIP_REQUIRED", club_memberships:[...] }.
        function ConvertUser(club_id, user_id, opts) {
            opts = opts || {};
            var body = {};
            if (opts.membership_id) body.membership_id = opts.membership_id;
            if (opts.term_start)    body.term_start = opts.term_start;
            if (opts.membership_ends) body.membership_ends = opts.membership_ends;
            // 1|0 — must the member set up payment at signup? Sent explicitly
            // from the UI checkbox; omitting it would give the backend-derived
            // default (which the checkbox mirrors anyway).
            if (opts.require_payment !== undefined && opts.require_payment !== null) body.require_payment = opts.require_payment;
            return $http.post('/api/v1/bs_sync/convert/' + club_id + '/' + user_id, body)
                .then(handleSuccess, handleError);
        }

        // Repair converted-user invitations that were sent but got stuck (pending,
        // never accepted, missing their membership-request link) so they show in the
        // member-requests list. Idempotent; does NOT re-send emails or change tokens.
        // Returns { success, examined, repaired_count, repaired:[...], needs_membership:[...] }.
        function ReconcileInvitations(club_id) {
            return $http.post('/api/v1/bs_sync/reconcile_invitations/' + club_id)
                .then(handleSuccess, handleError);
        }

        // Per-row repair for an invitation reconcile couldn't fix (no/invalid tier).
        //   opts: { membership_id (required), term_start, membership_ends } — dates
        //   YYYY-MM-DD; backend defaults them if omitted. On invalid tier the backend
        //   returns { success:false, error:"INVALID_MEMBERSHIP", club_memberships:[...] }.
        function RepairInvitation(club_id, invitation_id, opts) {
            opts = opts || {};
            var body = {};
            if (opts.membership_id) body.membership_id = opts.membership_id;
            if (opts.term_start)    body.term_start = opts.term_start;
            if (opts.membership_ends) body.membership_ends = opts.membership_ends;
            return $http.post('/api/v1/bs_sync/repair_invitation/' + club_id + '/' + invitation_id, body)
                .then(handleSuccess, handleError);
        }

        // ── Helpers ──────────────────────────────────

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(res) {
            return { success: false, message: res.data ? (res.data.message || res.data.error) : 'Request failed' };
        }
    }
