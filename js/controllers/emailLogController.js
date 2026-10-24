app.controller('EmailLogController', EmailLogController);

    EmailLogController.$inject = ['EmailLogService', 'ClubService', '$rootScope', '$scope', '$state', '$uibModal', '$timeout', 'ToastService'];
    function EmailLogController(EmailLogService, ClubService, $rootScope, $scope, $state, $uibModal, $timeout, ToastService) {

        // Email log — one controller for both scopes
        // (FRONTEND_EMAIL_LOG_AND_PREFERENCES_GUIDE.md §3):
        //   platform  (dashboard.super_admin.emails)     ToAviate staff, every club
        //   club      (dashboard.manage_club.email_log)  managers, scoped to their club
        // The backend is authoritative — a non-permitted caller gets success:false.

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.scope = ($state.current.data && $state.current.data.scope) || 'platform';
        vm.is_platform = vm.scope === 'platform';
        vm.club_id = vm.is_platform ? null : (vm.user.current_club_admin && vm.user.current_club_admin.id);
        vm.club_title = vm.is_platform ? '' : (vm.user.current_club_admin && vm.user.current_club_admin.title);

        vm.allowed = vm.is_platform
            ? $rootScope.isToAviateStaff()
            : !!(vm.club_id && vm.user.access && vm.user.access.manager && vm.user.access.manager.indexOf(vm.club_id) > -1);

        var logScope = vm.is_platform ? null : { club_id: vm.club_id };

        // ── Filters / paging ──
        vm.filters = { q: '', status: '', category: '', source: '', club_id: '', is_cron: '', from: '', to: '' };
        vm.page = 1;
        vm.per_page = 50;
        vm.total = 0;
        vm.pages = 0;
        vm.rows = [];
        vm.loading = true;
        vm.load_failed = false;
        vm.load_failed_message = '';

        vm.sources = [];
        vm.categories = ['reminder', 'notification', 'transactional', 'system'];
        vm.statuses = ['sent', 'suppressed', 'failed', 'logged'];
        vm.clubs = [];

        // ── Stats ──
        vm.stats_days = 30;
        vm.stats = null;
        vm.stats_loading = true;
        vm.by_day = [];        // [{day, sent, suppressed, failed, logged, total}]
        vm.by_day_max = 0;
        vm.by_source = [];     // [{source, sent, suppressed, failed, logged, total}]
        vm.hover_day = null;

        // ── Cron previews (dry runs) ──
        vm.dry_runs = EmailLogService.DRY_RUNS;
        vm.preview = { open: false, loading: false, run: null, result: null, club_id: null };

        vm.load = load;
        vm.applyFilters = applyFilters;
        vm.clearFilters = clearFilters;
        vm.setQuick = setQuick;
        vm.goPage = goPage;
        vm.openDetail = openDetail;
        vm.loadStats = loadStats;
        vm.setStatsDays = setStatsDays;
        vm.runPreview = runPreview;
        vm.closePreview = closePreview;
        vm.statusIcon = statusIcon;
        vm.statusLabel = statusLabel;
        vm.triggeredBy = triggeredBy;
        vm.recipientName = recipientName;
        vm.shortSource = shortSource;
        vm.reasonLabel = reasonLabel;
        vm.decisionClass = decisionClass;
        vm.decisionLabel = decisionLabel;
        vm.barHeight = barHeight;
        vm.dayLabel = dayLabel;
        vm.hasActiveFilters = hasActiveFilters;

        // Declared before activate() runs: a hoisted-but-unassigned counter would
        // make the first response look stale and get dropped.
        var loadSeq = 0;
        var searchTimer = null;

        if (vm.allowed) {
            activate();
        } else {
            vm.loading = false;
            vm.stats_loading = false;
        }

        function activate() {
            EmailLogService.Sources().then(function(data) {
                if (data && data.success) {
                    vm.sources = data.sources || [];
                    if (data.categories && data.categories.length) { vm.categories = data.categories; }
                    if (data.statuses && data.statuses.length) { vm.statuses = data.statuses; }
                }
            });
            if (vm.is_platform) {
                ClubService.GetAll().then(function(data) {
                    if (data && data.success === false) { return; }
                    vm.clubs = (data && data.clubs) || (angular.isArray(data) ? data : []);
                });
            }
            load();
            loadStats();
        }

        // ── List ──

        function load() {
            var seq = ++loadSeq;
            vm.loading = true;
            vm.load_failed = false;
            var params = angular.extend({ page: vm.page, per_page: vm.per_page }, vm.filters);
            if (!vm.is_platform) { delete params.club_id; }
            EmailLogService.List(logScope, params).then(function(data) {
                if (seq !== loadSeq) { return; }   // a newer request superseded this one
                vm.loading = false;
                if (data && data.success) {
                    vm.rows = data.rows || [];
                    vm.total = data.total || 0;
                    vm.pages = data.pages || 0;
                    vm.page = data.page || vm.page;
                } else {
                    vm.rows = [];
                    vm.load_failed = true;
                    vm.load_failed_message = (data && data.message) || 'We could not load the email log.';
                }
            });
        }

        function applyFilters(debounced) {
            vm.page = 1;
            if (debounced) {
                if (searchTimer) { $timeout.cancel(searchTimer); }
                searchTimer = $timeout(load, 350);
            } else {
                load();
            }
        }

        function clearFilters() {
            vm.filters = { q: '', status: '', category: '', source: '', club_id: '', is_cron: '', from: '', to: '' };
            applyFilters(false);
        }

        // Quick chips on the stat tiles: click "Suppressed" → filter the list to it.
        function setQuick(status) {
            vm.filters.status = (vm.filters.status === status) ? '' : status;
            applyFilters(false);
        }

        function goPage(p) {
            if (p < 1 || (vm.pages && p > vm.pages) || p === vm.page) { return; }
            vm.page = p;
            load();
        }

        function hasActiveFilters() {
            var f = vm.filters;
            return !!(f.q || f.status || f.category || f.source || f.club_id || f.is_cron !== '' || f.from || f.to);
        }

        // ── Detail modal ──

        function openDetail(row) {
            $uibModal.open({
                animation: true, size: 'lg', windowClass: 'eml-modal',
                templateUrl: 'views/modals/email_log_detail.html',
                controller: 'EmailLogDetailModalController', controllerAs: 'm',
                resolve: {
                    scope: function() { return logScope; },
                    row: function() { return row; }
                }
            });
        }

        // ── Stats ──

        function loadStats() {
            vm.stats_loading = true;
            EmailLogService.Stats(logScope, vm.stats_days).then(function(data) {
                vm.stats_loading = false;
                if (!(data && data.success)) { vm.stats = null; return; }
                vm.stats = data;
                vm.stats.by_status = data.by_status || {};
                vm.stats.by_category = data.by_category || {};
                vm.by_day = pivot(data.by_day || [], 'day', true);
                vm.by_day_max = 0;
                for (var i = 0; i < vm.by_day.length; i++) {
                    if (vm.by_day[i].total > vm.by_day_max) { vm.by_day_max = vm.by_day[i].total; }
                }
                vm.by_source = pivot(data.by_source || [], 'source', false).sort(function(a, b) { return b.total - a.total; });
            });
        }

        function setStatsDays(days) {
            vm.stats_days = days;
            loadStats();
        }

        // [{key, status, c}] → [{key, sent, suppressed, failed, logged, total}]
        function pivot(rows, keyName, fillDays) {
            var map = {}, order = [];
            for (var i = 0; i < rows.length; i++) {
                var k = rows[i][keyName];
                if (!map[k]) {
                    map[k] = { sent: 0, suppressed: 0, failed: 0, logged: 0, total: 0 };
                    map[k][keyName] = k;
                    order.push(k);
                }
                var c = parseInt(rows[i].c, 10) || 0;
                var s = rows[i].status;
                if (map[k][s] === undefined) { map[k][s] = 0; }
                map[k][s] += c;
                map[k].total += c;
            }
            if (fillDays) {
                // Every day in the window gets a column, even when nothing was sent.
                var days = vm.stats_days;
                var out = [];
                var d = new Date(); d.setHours(0, 0, 0, 0);
                for (var j = days - 1; j >= 0; j--) {
                    var dt = new Date(d.getTime() - j * 86400000);
                    var key = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
                    out.push(map[key] || { day: key, sent: 0, suppressed: 0, failed: 0, logged: 0, total: 0 });
                }
                return out;
            }
            var list = [];
            for (var n = 0; n < order.length; n++) { list.push(map[order[n]]); }
            return list;
        }

        function barHeight(day, status) {
            if (!vm.by_day_max) { return 0; }
            return Math.round((day[status] / vm.by_day_max) * 100);
        }

        function dayLabel(day) {
            var m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? (parseInt(m[3], 10) + '/' + parseInt(m[2], 10)) : day;
        }

        // ── Cron previews ──

        function runPreview(run) {
            var club = vm.is_platform ? vm.preview.club_id : vm.club_id;
            if (!club) {
                ToastService.warning('Choose a club', 'Pick a club to preview its reminder run.');
                return;
            }
            vm.preview.open = true;
            vm.preview.loading = true;
            vm.preview.run = run;
            vm.preview.result = null;
            EmailLogService.DryRun(run.endpoint, club).then(function(data) {
                vm.preview.loading = false;
                if (data && data.success) {
                    vm.preview.result = data;
                } else {
                    vm.preview.open = false;
                    ToastService.error('Preview failed', (data && data.message) || 'The dry run could not be started.');
                }
            });
        }

        function closePreview() {
            vm.preview.open = false;
            vm.preview.result = null;
        }

        // ── Presentation ──

        function statusIcon(status) {
            switch (status) {
                case 'sent':       return 'fa-check-circle';
                case 'suppressed': return 'fa-bell-slash';
                case 'failed':     return 'fa-exclamation-circle';
                default:           return 'fa-file-alt';
            }
        }

        function statusLabel(status) {
            return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
        }

        function triggeredBy(row) {
            if (!row) { return ''; }
            if (row.is_cron == 1) { return 'cron'; }
            if (row.triggered_by_first_name || row.triggered_by_last_name) {
                return ((row.triggered_by_first_name || '') + ' ' + (row.triggered_by_last_name || '')).trim();
            }
            return row.triggered_by_user_id ? 'user #' + row.triggered_by_user_id : '—';
        }

        function recipientName(row) {
            if (!row) { return ''; }
            var n = ((row.recipient_first_name || '') + ' ' + (row.recipient_last_name || '')).trim();
            return n || row.intended_to || '—';
        }

        function shortSource(source) {
            if (!source) { return '—'; }
            var parts = String(source).split('.');
            return parts.length > 1 ? parts.slice(1).join('.') : source;
        }

        // Backend reason codes → words a club manager understands.
        var REASONS = {
            user_muted_all_notifications: 'Member has muted all notifications',
            muted_all_notifications: 'Member has muted all notifications',
            muted_booking_reminders: 'Booking reminders turned off',
            muted_booking_emails: 'Booking notifications turned off',
            muted_assignment_emails: 'Course material emails turned off',
            summary_disabled: 'Daily summary turned off',
            already_sent_today: 'Already sent today',
            no_instructor_membership: 'No instructor membership',
            reminder_type_disabled: 'This reminder type is turned off',
            no_email: 'No email address on file'
        };
        function reasonLabel(code) {
            if (!code) { return ''; }
            return REASONS[code] || String(code).replace(/_/g, ' ');
        }

        function decisionClass(decision) {
            if (decision === 'send') { return 'eml-decision--send'; }
            if (decision === 'already_sent_today' || decision === 'no_instructor_membership') { return 'eml-decision--grey'; }
            return 'eml-decision--muted';
        }

        function decisionLabel(decision) {
            return decision === 'send' ? 'Will send' : reasonLabel(decision);
        }
    }


// ── Detail modal ──────────────────────────────────────────────────────
app.controller('EmailLogDetailModalController', EmailLogDetailModalController);

    EmailLogDetailModalController.$inject = ['EmailLogService', '$uibModalInstance', 'scope', 'row'];
    function EmailLogDetailModalController(EmailLogService, $uibModalInstance, scope, row) {
        var m = this;

        m.row = row;          // list row — shown immediately while the full entry loads
        m.entry = null;
        m.loading = true;
        m.failed = false;
        m.close = function() { $uibModalInstance.dismiss('cancel'); };

        m.statusIcon = function(status) {
            switch (status) {
                case 'sent':       return 'fa-check-circle';
                case 'suppressed': return 'fa-bell-slash';
                case 'failed':     return 'fa-exclamation-circle';
                default:           return 'fa-file-alt';
            }
        };

        m.sizeLabel = function(bytes) {
            var b = parseInt(bytes, 10);
            if (isNaN(b)) { return ''; }
            if (b < 1024) { return b + ' B'; }
            if (b < 1024 * 1024) { return (b / 1024).toFixed(1) + ' KB'; }
            return (b / (1024 * 1024)).toFixed(1) + ' MB';
        };

        EmailLogService.Get(scope, row.id).then(function(data) {
            m.loading = false;
            if (data && data.success && data.entry) {
                m.entry = data.entry;
            } else {
                m.failed = true;
                m.entry = row;   // fall back to what the list already knows
            }
        });
    }
