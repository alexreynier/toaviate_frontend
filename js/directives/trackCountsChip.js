// ─────────────────────────────────────────────────────────────────────────
// trackCountsChip — who last set a log sheet's two landing counts
// (FRONTEND_TRACK_DATA_GUIDE.md §2.1, `plane_log_sheets.track_counts_source`).
//
//   <track-counts-chip source="row.track_counts_source"
//                      updated-at="row.track_counts_updated_at"></track-counts-chip>
//
// Renders nothing for null / unknown sources. Copy and classes come from
// FoxTrackService.countsSourceChip so every screen names a source the same way.
// ─────────────────────────────────────────────────────────────────────────
app.directive('trackCountsChip', ['FoxTrackService', function (FoxTrackService) {
    return {
        restrict: 'E',
        scope: {
            source:    '=',
            updatedAt: '=?'
        },
        template:
            '<span class="tcs-chip" ng-if="chip" ng-class="chip.cls" uib-tooltip="{{ tip }}" tooltip-append-to-body="true">' +
                '<i class="fas" ng-class="chip.icon"></i> {{ chip.label }}' +
            '</span>',
        link: function (scope) {
            var icons = {
                'tcs-chip--tracker':    'fa-satellite-dish',
                'tcs-chip--calculated': 'fa-route',
                'tcs-chip--manual':     'fa-pen',
                'tcs-chip--applied':    'fa-check'
            };

            function fmtUpdated(s) {                         // 'Y-m-d H:i:s' UTC → '28 Oct 09:12Z'
                if (!s) { return ''; }
                var str = String(s);
                var m = str.split(/[^0-9]/);
                if (m.length < 5) { return str; }
                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return Number(m[2]) + ' ' + (months[Number(m[1]) - 1] || '') + ' ' + m[3] + ':' + m[4] + 'Z';
            }

            function refresh() {
                var c = FoxTrackService.countsSourceChip(scope.source);
                if (!c) { scope.chip = null; scope.tip = ''; return; }
                scope.chip = { label: c.label, cls: c.cls, icon: icons[c.cls] || 'fa-info-circle' };
                var when = fmtUpdated(scope.updatedAt);
                scope.tip = (c.hint || '') + (when ? ' Updated ' + when + '.' : '');
            }

            scope.$watch('source', refresh);
            scope.$watch('updatedAt', refresh);
        }
    };
}]);
