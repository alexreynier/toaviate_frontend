// Maintenance-organisation tracker portal (guide §C2). Child of
// dashboard.maintenance — org context is resolved by the parent
// DashboardMaintenanceController and read off the parent vm.
app.controller('TrackerMaintenanceController', TrackerMaintenanceController);
    TrackerMaintenanceController.$inject = ['TrackerCommerceService', 'ToastService', '$scope', '$state'];
    function TrackerMaintenanceController(TrackerCommerceService, ToastService, $scope, $state) {
        var vm = this;

        function parentCtx() {
            var p = $scope.$parent;
            while (p && !p.vm) { p = p.$parent; }
            return p && p.vm ? p.vm : {};
        }
        var ctx = parentCtx();
        vm.org_id   = ctx.org_id;
        vm.org      = ctx.org;
        vm.is_admin = !!ctx.is_admin;
        vm.search = '';
        vm.loading = false;
        vm.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };

        if (!vm.org_id) {
            // Parent still resolving (or user has no org) — bounce to the workspace home
            $state.go('dashboard.maintenance');
            return;
        }

        // A tracker invite accepted mid-session may have landed the user here
        // before the parent reloaded; always load fresh.
        load();
        function load() {
            vm.loading = true;
            TrackerCommerceService.GetOrgUnits(vm.org_id).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) {
                    ToastService.error('Could not load trackers', data.message || 'Please try again.');
                    return;
                }
                vm.units = (data && data.units) || [];
                vm.clubs = groupByClub(vm.units);
            });
        }

        function groupByClub(units) {
            var map = {};
            var clubs = [];
            units.forEach(function(u) {
                var key = u.club_title || 'Unknown club';
                if (!map[key]) {
                    map[key] = { club_title: key, units: [] };
                    clubs.push(map[key]);
                }
                map[key].units.push(u);
            });
            return clubs;
        }

        vm.matches = function(u) {
            if (!vm.search) { return true; }
            var q = vm.search.toLowerCase();
            return ['serial', 'version_name', 'version_code', 'club_title'].some(function(f) {
                return u[f] && String(u[f]).toLowerCase().indexOf(q) > -1;
            });
        };
        vm.clubHasMatches = function(club) {
            return club.units.some(vm.matches);
        };

        vm.downloadFittingPdf = function(u) {
            u.downloading = true;
            TrackerCommerceService.DownloadUnitFittingPdf(u.tracker_unit_id, 'fitting-' + (u.serial || u.tracker_unit_id) + '.pdf').then(function(res) {
                u.downloading = false;
                if (res && res.success === false) {
                    ToastService.error('Download failed', res.message || 'No fitting PDF is available for this unit.');
                }
            });
        };
    }
