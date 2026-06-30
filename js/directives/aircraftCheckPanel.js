// Directive: aircraftCheckPanel
// Slide-in panel for completing an aircraft check (Check A / daily inspection)
// OUTSIDE of a flight, from the Aircraft Status page. Mirrors defectReportPanel's
// chrome (dr-* classes). Matches the bookout check fields — fuel & oil quantities
// are REQUIRED, as they're part of the daily inspection.
//
// Usage:
//   <aircraft-check-panel
//       is-open="vm.showCheckPanel"
//       plane-registration="vm._checkPlane.registration"
//       check-types="vm.checkTypesByClub[vm._checkClubId]"
//       on-submit="vm.submitAircraftCheck(checkData)"
//       on-close="vm.closeCheckPanel()">
//   </aircraft-check-panel>
//
// on-submit receives:
//   checkData — { check_type, check_type_label, checked_at, fuel_us_gallons, oil_quarts, notes }
// check_type is the type CODE (e.g. 'check_a'). The parent builds the API payload
// (booking_id: null for standalone) and calls AircraftChecksService.CreateCheck.

app.directive('aircraftCheckPanel', ['$filter', function ($filter) {
    return {
        restrict: 'E',
        scope: {
            isOpen:            '=',
            planeRegistration: '=',
            checkTypes:        '=',
            onSubmit:          '&',
            onClose:           '&'
        },
        template:
            '<div class="dr-backdrop" ng-class="{\'active\': isOpen}" ng-click="close()"></div>' +
            '<div class="dr-panel" ng-class="{\'open\': isOpen}">' +
                '<div class="dr-panel-inner">' +

                    // Header
                    '<div class="dr-header">' +
                        '<div class="dr-header-left">' +
                            '<div class="dr-header-icon"><i class="fa fa-clipboard-check"></i></div>' +
                            '<div>' +
                                '<h3 class="dr-header-title">Complete a Check</h3>' +
                                '<p class="dr-header-sub" ng-if="planeRegistration">for <strong>{{ planeRegistration }}</strong></p>' +
                            '</div>' +
                        '</div>' +
                        '<button class="dr-close" ng-click="close()" aria-label="Close"><i class="fa fa-times"></i></button>' +
                    '</div>' +

                    // Body
                    '<div class="dr-body">' +

                        // Check type + time
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">1</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">Check details</h4>' +
                                '<div class="dr-field" ng-if="checkTypes.length > 1">' +
                                    '<label class="dr-label">Check type</label>' +
                                    '<select class="dr-input" ng-model="form.check_type" ng-options="ct.code as ct.name for ct in checkTypes"></select>' +
                                '</div>' +
                                '<div class="dr-field" ng-if="checkTypes.length === 1">' +
                                    '<label class="dr-label">Check type</label>' +
                                    '<div class="ac-single-type">{{ checkTypes[0].name }}</div>' +
                                '</div>' +
                                '<p class="ac-type-desc" ng-if="selectedTypeDesc()">{{ selectedTypeDesc() }}</p>' +
                                '<div class="dr-field" id="field-check-time">' +
                                    '<label class="dr-label">Checked at</label>' +
                                    '<input type="datetime-local" class="dr-input" ng-model="form.checked_at" />' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Fuel & oil (required — part of the daily inspection)
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">2</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">Fuel &amp; oil on board</h4>' +
                                '<p class="dr-hint">Required as part of the daily (A) inspection — re-checked again before flight.</p>' +
                                '<div class="fu-row">' +
                                    '<div class="dr-field fu-col" id="field-check-fuel">' +
                                        '<label class="dr-label">Fuel (US gallons)</label>' +
                                        '<input type="number" step="0.01" min="0" class="dr-input" ng-model="form.fuel_us_gallons" placeholder="0.00" />' +
                                    '</div>' +
                                    '<div class="dr-field fu-col" id="field-check-oil">' +
                                        '<label class="dr-label">Oil (quarts)</label>' +
                                        '<input type="number" step="0.01" min="0" class="dr-input" ng-model="form.oil_quarts" placeholder="0.00" />' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Notes
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">3</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">Notes <span class="dr-optional">(optional)</span></h4>' +
                                '<div class="dr-field">' +
                                    '<textarea class="dr-textarea" ng-model="form.notes" rows="3" placeholder="Anything to note from the inspection…"></textarea>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +

                    // Footer
                    '<div class="dr-footer">' +
                        '<button class="dr-btn dr-btn--cancel" ng-click="close()"><i class="fa fa-times"></i> Cancel</button>' +
                        '<button class="dr-btn dr-btn--submit" ng-click="submit()" ng-disabled="submitting || !canSubmit()">' +
                            '<i class="fa fa-spinner fa-spin" ng-if="submitting"></i>' +
                            '<i class="fa fa-check" ng-if="!submitting"></i>' +
                            ' {{ submitting ? "Submitting…" : "Submit Check" }}' +
                        '</button>' +
                    '</div>' +

                '</div>' +
            '</div>',

        link: function (scope) {

            function pickDefaultType() {
                if (!scope.checkTypes || !scope.checkTypes.length) { return null; }
                // Prefer Check A (code 'check_a'); else the first active type.
                for (var i = 0; i < scope.checkTypes.length; i++) {
                    if (scope.checkTypes[i].code === 'check_a') { return scope.checkTypes[i].code; }
                }
                return scope.checkTypes[0].code;
            }

            function nowLocal() {
                return $filter('date')(new Date(), 'yyyy-MM-ddTHH:mm');
            }

            function defaultForm() {
                return {
                    check_type: pickDefaultType(),
                    checked_at: nowLocal(),
                    fuel_us_gallons: null,
                    oil_quarts: null,
                    notes: ''
                };
            }

            scope.form = defaultForm();
            scope.submitting = false;

            scope.$watch('isOpen', function (val) {
                if (val) {
                    scope.form = defaultForm();
                    scope.submitting = false;
                    document.body.classList.add('dr-body-no-scroll');
                } else {
                    document.body.classList.remove('dr-body-no-scroll');
                }
            });

            // If check types arrive after open, set a sensible default.
            scope.$watch('checkTypes', function (list) {
                if (list && list.length && !scope.form.check_type) {
                    scope.form.check_type = pickDefaultType();
                }
            });

            scope.selectedTypeDesc = function () {
                if (!scope.checkTypes) { return ''; }
                for (var i = 0; i < scope.checkTypes.length; i++) {
                    if (scope.checkTypes[i].code === scope.form.check_type) {
                        return scope.checkTypes[i].description || '';
                    }
                }
                return '';
            };

            // Fuel & oil quantities are REQUIRED (daily inspection), matching bookout.
            scope.canSubmit = function () {
                if (!scope.form.check_type) { return false; }
                if (!scope.form.checked_at) { return false; }
                if (!(scope.form.fuel_us_gallons > 0)) { return false; }
                if (!(scope.form.oil_quarts > 0)) { return false; }
                return true;
            };

            scope.submit = function () {
                if (!scope.canSubmit() || scope.submitting) { return; }
                scope.submitting = true;
                var label = '';
                for (var i = 0; i < (scope.checkTypes || []).length; i++) {
                    if (scope.checkTypes[i].code === scope.form.check_type) { label = scope.checkTypes[i].name; break; }
                }
                var checkData = {
                    check_type: scope.form.check_type,
                    check_type_label: label,
                    checked_at: scope.form.checked_at,
                    fuel_us_gallons: scope.form.fuel_us_gallons,
                    oil_quarts: scope.form.oil_quarts,
                    notes: scope.form.notes || ''
                };
                scope.onSubmit({ checkData: checkData });
            };

            scope.close = function () {
                scope.isOpen = false;
                scope.onClose();
            };

            // Parent re-enables the form if the submit failed and the panel stays open.
            scope.$on('checkPanelReset', function () { scope.submitting = false; });

            function onKeydown(e) {
                if (e.keyCode === 27 && scope.isOpen) {
                    scope.$apply(function () { scope.close(); });
                }
            }
            document.addEventListener('keydown', onKeydown);
            scope.$on('$destroy', function () {
                document.removeEventListener('keydown', onKeydown);
                document.body.classList.remove('dr-body-no-scroll');
            });
        }
    };
}]);
