// ═══════════════════════════════════════════════════════════════════════
//  <flight-times> — renders a flight's times the way the CLUB has chosen
//  (TimeDisplayService), with a tooltip listing every recorded time.
//
//    <flight-times row="log" ctx="vm.td"></flight-times>              11:35 → 12:45  1:10
//    <flight-times row="log" ctx="vm.td" part="from"></flight-times>  11:35
//    <flight-times row="log" part="to" club-id="club.id"></flight-times>
//    <flight-times row="log" part="duration" window="block"></flight-times>
//
//  attrs:  row       the flight / log-sheet / fox-entry object (any endpoint shape)
//          ctx       page context from TimeDisplayService.context() (optional)
//          club-id   club to resolve the mode for when there's no ctx (optional;
//                    falls back to row.club_id, then the app default)
//          window    'block' | 'airborne' — pin the window, follow the rounding
//          part      'full' (default) | 'window' | 'from' | 'to' | 'duration'
//          mode      force a specific mode (rare — previews in settings)
//          plain     attribute: no tooltip
//
//  The aircraft override is honoured when the row carries it
//  (row.aircraft.time_display / row.plane_time_display / row.time_display).
//
//  <time-display-switch ctx="vm.td"> — the "switch times to…" pill for toolbars.
// ═══════════════════════════════════════════════════════════════════════
app.directive('flightTimes', ['TimeDisplayService', function(TimeDisplayService) {

    var TEMPLATES = {
        full:
            '<span class="ft" ng-class="{\'ft--fallback\': v.fallback, \'ft--missing\': v.missing, \'ft--exact\': !v.rounded}" uib-tooltip="{{ tip }}" tooltip-append-to-body="true">' +
              '<span class="ft__t">{{ v.from }}</span>' +
              '<i class="fa fa-long-arrow-alt-right ft__arrow"></i>' +
              '<span class="ft__t">{{ v.to }}</span>' +
              '<span class="ft__dur" ng-if="v.durationHM">{{ v.durationHM }}</span>' +
            '</span>',
        window:
            '<span class="ft" ng-class="{\'ft--fallback\': v.fallback, \'ft--missing\': v.missing, \'ft--exact\': !v.rounded}" uib-tooltip="{{ tip }}" tooltip-append-to-body="true">' +
              '<span class="ft__t">{{ v.from }}</span>' +
              '<i class="fa fa-long-arrow-alt-right ft__arrow"></i>' +
              '<span class="ft__t">{{ v.to }}</span>' +
            '</span>',
        from:
            '<span class="ft ft--single" ng-class="{\'ft--fallback\': v.fallback, \'ft--missing\': v.missing}" uib-tooltip="{{ tip }}" tooltip-append-to-body="true">{{ v.from }}</span>',
        to:
            '<span class="ft ft--single" ng-class="{\'ft--fallback\': v.fallback, \'ft--missing\': v.missing}" uib-tooltip="{{ tip }}" tooltip-append-to-body="true">{{ v.to }}</span>',
        duration:
            '<span class="ft ft--single ft--duration" ng-class="{\'ft--fallback\': v.fallback, \'ft--missing\': v.missing}" uib-tooltip="{{ tip }}" tooltip-append-to-body="true">{{ v.durationHM || \'—\' }}</span>'
    };

    function planeModeOf(row) {
        if (!row) { return null; }
        if (row.aircraft && row.aircraft.time_display) { return row.aircraft.time_display; }
        if (row.plane && row.plane.time_display) { return row.plane.time_display; }
        return row.plane_time_display || row.time_display || null;
    }

    return {
        restrict: 'E',
        scope: { row: '=', ctx: '=?', clubId: '=?', mode: '@?', window: '@?', part: '@?' },
        template: function(el, attrs) {
            return TEMPLATES[attrs.part] || TEMPLATES.full;
        },
        link: function(scope, el, attrs) {
            var plain = attrs.plain !== undefined;

            function render() {
                var row = scope.row;
                var mode;
                if (scope.mode && TimeDisplayService.isValid(scope.mode)) {
                    mode = scope.mode;
                } else {
                    var clubId = scope.clubId || (scope.ctx && scope.ctx.club_id) || (row && (row.club_id || row.clubId)) || null;
                    // row-level aircraft override first; else the page's aircraft (journey log)
                    mode = TimeDisplayService.resolve(clubId, planeModeOf(row) || (scope.ctx && scope.ctx.planeMode) || null);
                }
                var windowName = scope.window || (scope.ctx && scope.ctx.window) || null;
                scope.v = TimeDisplayService.pick(row, mode, { window: windowName });
                scope.tip = plain ? '' : scope.v.tooltip;
            }

            // Rows are plain data; watch the handful of fields that matter instead of a deep watch.
            scope.$watchGroup([
                'row', 'row.brakes_off', 'row.brakes_on', 'row.takeoff_time', 'row.landing_time',
                'row.brakes_off_rounded', 'row.brakes_on_rounded', 'row.brakes_times_rounded',
                'mode', 'window', 'clubId', 'ctx.mode', 'ctx.planeMode'
            ], render);
            var off = scope.$on(TimeDisplayService.EVENT, render);
            scope.$on('$destroy', off);
        }
    };
}]);

// "Times: [Club default · Block · 5 min ▾]" — lets a viewer see another convention.
// The choice is per viewer (localStorage), shown as an override until reset.
app.directive('timeDisplaySwitch', ['TimeDisplayService', function(TimeDisplayService) {
    return {
        restrict: 'E',
        scope: { ctx: '=?', clubId: '=?' },
        template:
            '<div class="tds" ng-class="{\'tds--override\': state.override}">' +
              '<label class="tds__label" for="{{ uid }}" uib-tooltip="How flight times are shown on this page. Pick another to compare; the club default is set in Club Settings." tooltip-append-to-body="true">' +
                '<i class="fa fa-stopwatch"></i><span class="tds__text">Times</span>' +
              '</label>' +
              '<div class="tds__select-wrap">' +
                '<select class="tds__select" id="{{ uid }}" ng-model="sel.value" ng-change="apply()" no-busy-guard>' +
                  '<option value="">Club default · {{ state.clubDef.short }}</option>' +
                  '<option ng-repeat="m in modes" value="{{ m.value }}">{{ m.title }} · {{ m.sub }}</option>' +
                '</select>' +
                '<i class="fa fa-chevron-down tds__caret"></i>' +
              '</div>' +
              '<button type="button" class="tds__reset" ng-if="state.override" ng-click="reset()" no-busy-guard uib-tooltip="Back to the club default" tooltip-append-to-body="true">' +
                '<i class="fa fa-undo"></i>' +
              '</button>' +
            '</div>',
        link: function(scope) {
            scope.uid = 'tds_' + Math.random().toString(36).slice(2, 8);
            scope.modes = TimeDisplayService.MODES;
            scope.sel = { value: TimeDisplayService.getViewerOverride() || '' };
            scope.state = { override: null, clubDef: TimeDisplayService.def(TimeDisplayService.DEFAULT_MODE) };

            function sync() {
                var override = TimeDisplayService.getViewerOverride();
                var clubMode = scope.ctx ? scope.ctx.clubMode
                             : (TimeDisplayService.clubModeSync(scope.clubId) || TimeDisplayService.DEFAULT_MODE);
                scope.state.override = override;
                scope.state.clubDef = TimeDisplayService.def(clubMode);
                scope.sel.value = override || '';
            }

            scope.apply = function() { TimeDisplayService.setViewerOverride(scope.sel.value || null); };
            scope.reset = function() { TimeDisplayService.setViewerOverride(null); };

            scope.$watchGroup(['ctx.clubMode', 'ctx.override', 'clubId'], sync);
            var off = scope.$on(TimeDisplayService.EVENT, sync);
            scope.$on('$destroy', off);
            sync();
        }
    };
}]);

// Column-header labels for pages that span several clubs (no single ctx):
//   {{ club.id | tdLabel : 'from' }}   → "Brakes Off" / "Takeoff"
//   {{ club.id | tdLabel : 'duration' : 'block' }}  (pinned window)
app.filter('tdLabel', ['TimeDisplayService', function(TimeDisplayService) {
    function tdLabel(club_id, part, windowName) {
        var mode = TimeDisplayService.resolve(club_id, null);
        var d = TimeDisplayService.variant(mode, windowName || null);
        return TimeDisplayService.labelsFor(d)[part || 'from'];
    }
    // The result depends on the viewer switch / club load, not only on the inputs,
    // so Angular must not memoise it as a pure filter.
    tdLabel.$stateful = true;
    return tdLabel;
}]);
