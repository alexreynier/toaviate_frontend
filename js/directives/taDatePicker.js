// ─────────────────────────────────────────────────────────────────────────
// taDatePicker — thin AngularJS wrapper around libs/js/toaviate-datepicker.js
// (global ToAviateDatePicker; CSS libs/css/toaviate-datepicker.css).
//
//   <ta-date-picker ng-model="vm.date"              YYYY-MM-DD string, two-way
//                   options="vm.pickerOptions"       any §4 option (weekStart, dots, allowPast, min, max …)
//                   get-busy="vm.busy(date)"         synchronous 0..3 for the dots; call vm.refreshPicker() / change
//                                                    `options.busyVersion` when data arrives
//                   inline="false"                   "true" renders the calendar itself instead of a button
//                   label="Date"                     optional small label above the button
//                   placeholder="Pick a date"        button text while the model is empty
//                   block="true"                     full-width button (forms)
//                   format="short"                   button text "Tue 3 Nov 2026" instead of "Tuesday 3 November 2026"
//                   on-month-change="vm.load(month)" 'YYYY-MM' when the visible month changes (fetch busy counts)>
//   </ta-date-picker>
//
// Button mode opens the library popover (bottom sheet under 480px). The
// model is only written on a pick; the picker follows the model on $render.
// No ng-if on this element (Angular 1.4.7 trap, see CLAUDE.md) — it is safe
// inside ng-repeat; everything is torn down on $destroy.
// ─────────────────────────────────────────────────────────────────────────
app.directive('taDatePicker', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {
            options:       '=?',
            getBusy:       '&',
            onMonthChange: '&',
            label:         '@',
            placeholder:   '@',
            inline:        '@',
            block:         '@',
            format:        '@'
        },
        template:
            '<span class="tadp-field" ng-class="{\'tadp-field--block\': isBlock}" ng-show="!isInline">' +
                '<span class="tadp-field__label" ng-show="label">{{ label }}</span>' +
                '<button type="button" class="tadp-btn" no-busy-guard ng-attr-aria-label="{{ ariaLabel }}">' +
                    '<span class="tadp-btn__icon" aria-hidden="true">' +
                        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="4" width="15" height="13.5" rx="2.5"/><path d="M2.5 8.5h15M6.5 2v4M13.5 2v4"/></svg>' +
                    '</span>' +
                    '<span class="tadp-btn__text" ng-class="{\'tadp-btn__text--empty\': !display}">{{ display || placeholder || \'Pick a date\' }}</span>' +
                    '<span class="tadp-btn__caret" aria-hidden="true">▾</span>' +
                '</button>' +
            '</span>' +
            '<span class="tadp-inline" ng-show="isInline"></span>',
        link: function (scope, element, attrs, ngModel) {
            function fmtDisplay(v) { return (scope.format === 'short' && ToAviateDatePicker.shortDate) ? ToAviateDatePicker.shortDate(v) : ToAviateDatePicker.longDate(v); }
            if (typeof ToAviateDatePicker === 'undefined') {
                console.log('taDatePicker: ToAviateDatePicker library missing');
                return;
            }

            var btn = element[0].querySelector('.tadp-btn');
            var inlineHost = element[0].querySelector('.tadp-inline');
            var picker = null;      // the library picker (both modes)
            var attached = null;    // attach() handle (button mode)
            var hasBusy = !!attrs.getBusy;
            var hasMonthChange = !!attrs.onMonthChange;

            scope.isInline = scope.inline === 'true';
            scope.isBlock = scope.block === 'true';
            scope.display = '';
            scope.ariaLabel = scope.label ? scope.label : null;

            function buildOptions() {
                var o = angular.extend({}, scope.options || {});
                delete o.value; delete o.onPick; delete o.getBusy; delete o.onMonthChange; delete o.onEscape; delete o.inline;
                o.value = ngModel.$viewValue || null;
                if (hasBusy) {
                    o.getBusy = function (dateStr) { return scope.getBusy({ date: dateStr }); };
                }
                o.onMonthChange = function (yyyyMm) {
                    if (!hasMonthChange) { return; }
                    scope.$evalAsync(function () { scope.onMonthChange({ month: yyyyMm }); });
                };
                o.onPick = function (dateStr) {
                    scope.$evalAsync(function () {
                        ngModel.$setViewValue(dateStr);
                        scope.display = fmtDisplay(dateStr);
                        scope.ariaLabel = (scope.label ? scope.label + ', ' : '') + scope.display;
                    });
                };
                return o;
            }

            function init() {
                var o = buildOptions();
                if (scope.isInline) {
                    o.inline = true;
                    picker = ToAviateDatePicker.create(inlineHost, o);
                } else {
                    attached = ToAviateDatePicker.attach(btn, o);
                    picker = attached.picker;
                }
            }

            ngModel.$render = function () {
                var v = ngModel.$viewValue;
                scope.display = v ? fmtDisplay(v) : '';
                scope.ariaLabel = (scope.label ? scope.label + ', ' : '') + (scope.display || 'no date');
                if (picker && v) { picker.setValue(v); }
                else if (picker) { picker.refresh(); }
            };

            // Any change in `options` (deep) is pushed to the picker in one re-render.
            // Hosts bump a harmless key (e.g. options.busyVersion) to redraw the dots.
            scope.$watch('options', function (n, old) {
                if (!picker || n === old) { return; }
                var o = angular.extend({}, n || {});
                delete o.value; delete o.onPick; delete o.getBusy; delete o.onMonthChange; delete o.onEscape; delete o.inline;
                picker.setOptions(o);
            }, true);

            // Public refresh hook for the parent: options.refresh = fn is populated by us
            // so a controller can call vm.pickerOptions.refresh() after its month fetch.
            scope.$watch('options', function (n) {
                if (n && typeof n === 'object' && typeof n.refresh !== 'function') {
                    Object.defineProperty(n, 'refresh', { value: function () { if (picker) { picker.refresh(); } }, enumerable: false, configurable: true, writable: true });
                }
            });

            init();
            // the model may already hold a value before the first $render
            if (ngModel.$viewValue) { ngModel.$render(); }

            scope.$on('$destroy', function () {
                if (attached) { attached.destroy(); attached = null; }
                else if (picker) { picker.destroy(); }
                picker = null;
            });
        }
    };
}]);
