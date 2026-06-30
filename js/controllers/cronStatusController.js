app.controller('CronStatusController', CronStatusController);

CronStatusController.$inject = ['CronStatusService', '$rootScope', '$scope', '$state', '$interval', '$timeout'];
function CronStatusController(CronStatusService, $rootScope, $scope, $state, $interval, $timeout) {
    var vm = this;

    // ─── User & access guard ───────────────────────────────────────
    // Lives in the ToAviate Admin hub — gate on the same shared
    // $rootScope.isToAviateStaff helper as the tab. vm.is_super_admin is kept as
    // the view's allow/deny flag name.
    vm.user           = $rootScope.globals.currentUser;
    vm.is_super_admin = $rootScope.isToAviateStaff();

    // ─── Summary state ────────────────────────────────────────────
    vm.loading        = true;
    vm.error          = null;
    vm.endpoints      = [];
    vm.generated_at   = null;
    vm.last_refreshed = null;     // JS Date shown in header
    vm.refreshing     = false;    // spinning icon flag

    // ─── Summary stats (computed) ─────────────────────────────────
    vm.stats = { total: 0, healthy: 0, degraded: 0, overdue_or_error: 0, errors_24h: 0 };

    // ─── Auto-refresh ─────────────────────────────────────────────
    vm.auto_refresh       = true;
    var AUTO_REFRESH_MS   = 60000;
    var autoRefreshTimer  = null;

    // ─── Drill-down panel ─────────────────────────────────────────
    vm.drill = {
        open:      false,
        endpoint:  null,    // canonical name
        slug:      null,
        loading:   false,
        error:     null,
        rows:      []
    };

    // ─── Init ────────────────────────────────────────────────────
    if (vm.is_super_admin) {
        loadSummary();
        scheduleAutoRefresh();
    }

    // ═══════════════════════════════════════════════════════════════
    //  SUMMARY LOAD
    // ═══════════════════════════════════════════════════════════════

    function loadSummary(isRefresh) {
        if (isRefresh) {
            vm.refreshing = true;
        } else {
            vm.loading = true;
        }
        vm.error = null;

        CronStatusService.GetSummary().then(function(data) {
            if (data && data.success) {
                vm.endpoints    = sortEndpoints(data.endpoints || []);
                vm.generated_at = data.generated_at;
                vm.last_refreshed = new Date();
                computeStats();
            } else {
                vm.error = (data && data.message) || 'Failed to load cron summary.';
            }
        }).catch(function() {
            vm.error = 'An unexpected error occurred loading cron status.';
        }).finally(function() {
            vm.loading    = false;
            vm.refreshing = false;
        });
    }

    // Sort: overdue/erroring first, then alphabetical
    function sortEndpoints(list) {
        return list.slice().sort(function(a, b) {
            var aUrgent = a.overdue || isErroring(a) ? 0 : 1;
            var bUrgent = b.overdue || isErroring(b) ? 0 : 1;
            if (aUrgent !== bUrgent) return aUrgent - bUrgent;
            return a.endpoint.localeCompare(b.endpoint);
        });
    }

    function computeStats() {
        var s = { total: vm.endpoints.length, healthy: 0, degraded: 0, overdue_or_error: 0, errors_24h: 0 };
        vm.endpoints.forEach(function(ep) {
            var pill = getPillClass(ep);
            if (pill === 'healthy')         s.healthy++;
            else if (pill === 'degraded')   s.degraded++;
            else if (pill !== 'not-run')    s.overdue_or_error++;
            s.errors_24h += (ep.errors_24h || 0);
        });
        vm.stats = s;
    }

    // ═══════════════════════════════════════════════════════════════
    //  AUTO-REFRESH
    // ═══════════════════════════════════════════════════════════════

    function scheduleAutoRefresh() {
        cancelAutoRefresh();
        if (vm.auto_refresh) {
            autoRefreshTimer = $interval(function() {
                loadSummary(true);
            }, AUTO_REFRESH_MS);
        }
    }

    function cancelAutoRefresh() {
        if (autoRefreshTimer) {
            $interval.cancel(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    }

    $scope.onAutoRefreshToggle = function() {
        scheduleAutoRefresh();
    };

    $scope.manualRefresh = function() {
        loadSummary(true);
        // Reset timer so it doesn't fire immediately after a manual refresh
        scheduleAutoRefresh();
    };

    // Cancel timer when controller is destroyed
    $scope.$on('$destroy', function() {
        cancelAutoRefresh();
    });

    // ═══════════════════════════════════════════════════════════════
    //  DRILL-DOWN
    // ═══════════════════════════════════════════════════════════════

    $scope.openDrill = function(endpoint) {
        vm.drill.open     = true;
        vm.drill.endpoint = endpoint.endpoint;
        vm.drill.slug     = toSlug(endpoint.endpoint);
        vm.drill.loading  = true;
        vm.drill.error    = null;
        vm.drill.rows     = [];

        CronStatusService.GetRecent(vm.drill.slug, 50).then(function(data) {
            if (data && data.success) {
                vm.drill.rows = data.rows || [];
            } else {
                vm.drill.error = (data && data.message) || 'Failed to load drill-down data.';
            }
        }).catch(function() {
            vm.drill.error = 'An unexpected error occurred.';
        }).finally(function() {
            vm.drill.loading = false;
        });
    };

    $scope.closeDrill = function() {
        vm.drill.open = false;
    };

    // Close on overlay click
    $scope.onOverlayClick = function($event) {
        if ($event.target === $event.currentTarget) {
            $scope.closeDrill();
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  PILL LOGIC  (exposed to template via vm)
    // ═══════════════════════════════════════════════════════════════

    vm.getPillClass  = getPillClass;
    vm.getPillLabel  = getPillLabel;
    vm.isErroring    = isErroring;

    function getPillClass(ep) {
        if (!ep.last_run_at)                                  return 'not-run';
        if (ep.last_run_at === ep.last_error_at)              return 'erroring';
        if (ep.overdue)                                       return 'overdue';
        if (!ep.overdue && ep.errors_24h > 0 && ep.last_ok_at) return 'degraded';
        return 'healthy';
    }

    function getPillLabel(ep) {
        switch (getPillClass(ep)) {
            case 'healthy':  return 'Healthy';
            case 'degraded': return 'Degraded';
            case 'overdue':  return 'Overdue';
            case 'erroring': return 'Erroring';
            case 'not-run':  return 'Not yet run';
        }
    }

    function isErroring(ep) {
        return ep.last_run_at && ep.last_run_at === ep.last_error_at;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ROW CLASS for table row colouring
    // ═══════════════════════════════════════════════════════════════

    vm.getRowClass = function(ep) {
        var pill = getPillClass(ep);
        if (pill === 'overdue' || pill === 'not-run') return 'cron-row--overdue';
        if (pill === 'erroring')                      return 'cron-row--erroring';
        return '';
    };

    // ═══════════════════════════════════════════════════════════════
    //  DRILL-DOWN ROW CLASS
    // ═══════════════════════════════════════════════════════════════

    vm.getDrillRowClass = function(row) {
        if (row.outcome === 'ok')      return 'drill-row--ok';
        if (row.outcome === 'error')   return 'drill-row--error';
        if (row.outcome === 'started') return 'drill-row--started';
        return '';
    };

    vm.getDrillOutcomeBadge = function(row) {
        if (row.outcome === 'ok')      return 'cron-outcome-badge--ok';
        if (row.outcome === 'error')   return 'cron-outcome-badge--error';
        return 'cron-outcome-badge--started';
    };

    vm.getHttpClass = function(row) {
        if (!row.http_status)          return 'cron-http--grey';
        if (row.http_status < 400)     return 'cron-http--ok';
        return 'cron-http--error';
    };

    // ═══════════════════════════════════════════════════════════════
    //  DATE / TIME HELPERS  (exposed as $scope functions for template)
    // ═══════════════════════════════════════════════════════════════

    $scope.relativeTime = relativeTime;
    $scope.localDateTime = localDateTime;
    $scope.formatMs = formatMs;
    $scope.formatLastRefreshed = formatLastRefreshed;
    $scope.formatCadence = formatCadence;

    function relativeTime(utcStr) {
        if (!utcStr) return null;
        var d = new Date(utcStr.indexOf('Z') > -1 ? utcStr : utcStr + 'Z');
        var diff = (Date.now() - d.getTime()) / 1000; // seconds
        if (diff < 60)           return 'just now';
        if (diff < 3600)         return Math.floor(diff / 60) + ' min ago';
        if (diff < 86400)        return Math.floor(diff / 3600) + ' hr ago';
        if (diff < 86400 * 2)    return 'yesterday';
        return Math.floor(diff / 86400) + ' days ago';
    }

    function localDateTime(utcStr) {
        if (!utcStr) return '—';
        var d = new Date(utcStr.indexOf('Z') > -1 ? utcStr : utcStr + 'Z');
        return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    }

    function formatMs(ms) {
        if (ms === null || ms === undefined) return '—';
        if (ms < 1000)  return ms + ' ms';
        if (ms < 60000) return (ms / 1000).toFixed(1) + ' s';
        return (ms / 60000).toFixed(1) + ' min';
    }

    function formatLastRefreshed(dt) {
        if (!dt) return '—';
        return dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function formatCadence(minutes) {
        if (!minutes) return '—';
        if (minutes < 60)      return 'every ' + minutes + 'm';
        if (minutes === 60)    return 'hourly';
        if (minutes === 1440)  return 'daily';
        return 'every ' + (minutes / 60).toFixed(0) + 'h';
    }

    // ═══════════════════════════════════════════════════════════════
    //  OVERDUE TOOLTIP
    // ═══════════════════════════════════════════════════════════════

    vm.overdueTooltip = function(ep) {
        if (!ep.last_ok_at) {
            return 'This cron has never run successfully. Check cPanel cron list.';
        }
        var d = new Date((ep.last_ok_at.indexOf('Z') > -1 ? ep.last_ok_at : ep.last_ok_at + 'Z'));
        var days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days > 1) {
            return 'Cron has not run successfully in ' + days + ' days. Check cPanel cron list and ~/logs/api.toaviate.com.error.log.';
        }
        return 'Last successful run was ' + relativeTime(ep.last_ok_at) + '. Expected every ' + formatCadence(ep.cadence_minutes) + '.';
    };

    // ═══════════════════════════════════════════════════════════════
    //  UTILITY
    // ═══════════════════════════════════════════════════════════════

    function toSlug(endpoint) {
        // Replace / with - to build the URL slug per spec
        return endpoint.replace(/\//g, '-');
    }
}
