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
            offeredType:       '=',   // the mandatory role-matched type to complete (or null)
            customTypes:       '=',   // the club's role:'custom' types ("add another check")
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

                                // The required check to complete (role-matched), shown prominently.
                                '<div class="dr-field" ng-if="offeredType">' +
                                    '<label class="dr-label">Required check</label>' +
                                    '<div class="ac-single-type">{{ offeredType.name }}</div>' +
                                '</div>' +

                                // Optional: complete a different (custom) check instead.
                                '<div class="dr-field" ng-if="allOptions().length > 1">' +
                                    '<label class="dr-label">' +
                                        '<span ng-if="offeredType">Or record a different check</span>' +
                                        '<span ng-if="!offeredType">Check type</span>' +
                                    '</label>' +
                                    '<select class="dr-input" ng-model="form.check_type_obj" ng-options="ct as ct.name for ct in allOptions()"></select>' +
                                '</div>' +

                                // Only one option and no offered mandatory type — show it plainly.
                                '<div class="dr-field" ng-if="!offeredType && allOptions().length === 1">' +
                                    '<label class="dr-label">Check type</label>' +
                                    '<div class="ac-single-type">{{ allOptions()[0].name }}</div>' +
                                '</div>' +

                                // No check types available for this club at all.
                                '<div class="dr-field" ng-if="!offeredType && allOptions().length === 0">' +
                                    '<div class="ac-no-types"><i class="fa fa-exclamation-circle"></i> ' +
                                        'No check types are set up for this club yet. A club administrator ' +
                                        'needs to add one (Manage Club → Settings → Aircraft Check Types).</div>' +
                                '</div>' +

                                '<p class="ac-type-desc" ng-if="selectedTypeDesc()">{{ selectedTypeDesc() }}</p>' +
                                '<div class="dr-field" id="field-check-time">' +
                                    '<label class="dr-label">Checked at</label>' +
                                    '<input type="datetime-local" step="60" class="dr-input" ng-model="form.checked_at" />' +
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

            // All selectable types = the offered mandatory type (if any) + the custom
            // types, deduped by id. The offered one is the default.
            scope.allOptions = function () {
                var opts = [];
                var seen = {};
                if (scope.offeredType) { opts.push(scope.offeredType); seen[scope.offeredType.id] = true; }
                (scope.customTypes || []).forEach(function (t) {
                    if (!seen[t.id]) { opts.push(t); seen[t.id] = true; }
                });
                return opts;
            };

            function pickDefaultType() {
                if (scope.offeredType) { return scope.offeredType; }
                var opts = scope.allOptions();
                return opts.length ? opts[0] : null;
            }

            // "now" with seconds/ms zeroed so the datetime-local picker shows
            // minute precision only.
            function nowToMinute() {
                var d = new Date();
                d.setSeconds(0, 0);
                return d;
            }

            function defaultForm() {
                return {
                    // Bind the whole check-type object so we can send its code
                    // (check_type) and id (check_type_id) at submit.
                    check_type_obj: pickDefaultType(),
                    // datetime-local binds a Date object in AngularJS 1.x — NOT a
                    // string (a string throws [ngModel:datefmt]). Convert to the
                    // 'yyyy-MM-ddTHH:mm' string the API wants only at submit time.
                    // Zero seconds/ms so the picker shows minute precision only
                    // (paired with step="60" on the input).
                    checked_at: nowToMinute(),
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

            // If the offered type / custom types arrive after open, set the default.
            scope.$watch('offeredType', function () {
                if (!scope.form.check_type_obj) { scope.form.check_type_obj = pickDefaultType(); }
            });
            scope.$watch('customTypes', function () {
                if (!scope.form.check_type_obj) { scope.form.check_type_obj = pickDefaultType(); }
            });

            scope.selectedTypeDesc = function () {
                return (scope.form.check_type_obj && scope.form.check_type_obj.description) || '';
            };

            // Fuel & oil quantities are REQUIRED (daily inspection), matching bookout.
            scope.canSubmit = function () {
                if (!scope.form.check_type_obj) { return false; }
                if (!scope.form.checked_at) { return false; }
                if (!(scope.form.fuel_us_gallons > 0)) { return false; }
                if (!(scope.form.oil_quarts > 0)) { return false; }
                return true;
            };

            scope.submit = function () {
                if (!scope.canSubmit() || scope.submitting) { return; }
                scope.submitting = true;

                var ct = scope.form.check_type_obj;

                // checked_at is a Date object (datetime-local) — format to the
                // 'yyyy-MM-ddTHH:mm' string the API/bookout flow uses.
                var checkedAtStr = (scope.form.checked_at instanceof Date)
                    ? $filter('date')(scope.form.checked_at, 'yyyy-MM-ddTHH:mm')
                    : scope.form.checked_at;

                // Role-based model: every option is a real active check-type row, so
                // send its code (check_type) AND id (check_type_id). The backend keys
                // the requirement off the type's role, not the code.
                var checkData = {
                    check_type: ct.code,
                    check_type_id: ct.id,
                    check_type_label: ct.name,
                    checked_at: checkedAtStr,
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
