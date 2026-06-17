// ─────────────────────────────────────────────────────
// ItemSharesModalController — instructor follow-up: shows everyone an item has
// been shared with and each student's live status (assigned → viewed →
// completed), with the ability to revoke an assignment. Used via $uibModal.
// Resolves: item ({type, id, title}).
// ─────────────────────────────────────────────────────
app.controller('ItemSharesModalController', ItemSharesModalController);

    ItemSharesModalController.$inject = ['$uibModalInstance', 'CourseAssignmentService', 'ToastService', 'item'];
    function ItemSharesModalController($uibModalInstance, CourseAssignmentService, ToastService, item) {
        var m = this;
        m.item = item;                 // { type, id, title }
        m.loading = true;
        m.rows = [];

        function load() {
            m.loading = true;
            CourseAssignmentService.ForItem(m.item.type, m.item.id).then(function(data) {
                m.loading = false;
                var list = (data && data.assignments) ? data.assignments
                    : (data && data.items) ? data.items
                    : (angular.isArray(data) ? data : []);
                // Backend keeps revoked rows for its audit trail — don't surface them.
                m.rows = list.filter(function(a) {
                    return a.status !== 'revoked' && !a.revoked && !a.revoked_at;
                }).map(decorate);
                m.outstanding = m.rows.filter(function(r) { return !r._done; }).length;
            });
        }

        function decorate(a) {
            a._done = (a.status === 'completed');
            a._name = a.student_name
                || (((a.first_name || '') + ' ' + (a.last_name || '')).trim())
                || a.email || ('Student #' + (a.student_id || a.user_id || '?'));
            return a;
        }

        m.badge = function(status) {
            switch (status) {
                case 'completed': return 'cc-badge--green';
                case 'viewed': return 'cc-badge--amber';
                default: return 'cc-badge--blue';
            }
        };
        m.statusText = function(status) {
            switch (status) {
                case 'completed': return 'Completed';
                case 'viewed': return 'In progress';
                default: return 'Not started';
            }
        };
        m.overdue = function(a) {
            if (a._done || !a.due_date) return false;
            return a.due_date < todayYMD();
        };

        m.revoke = function(a) {
            if (a._revoking) return;
            a._revoking = true;
            CourseAssignmentService.Revoke(a.id).then(function(data) {
                a._revoking = false;
                if (!data || data.success === false) { ToastService.error('Could not revoke', (data && data.message) || ''); return; }
                m.rows = m.rows.filter(function(r) { return r.id !== a.id; });
                m.outstanding = m.rows.filter(function(r) { return !r._done; }).length;
                ToastService.success('Removed', 'Unassigned from ' + a._name + '.');
            });
        };

        m.close = function() { $uibModalInstance.dismiss('close'); };

        function todayYMD() {
            var d = new Date();
            return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        }

        load();
    }
