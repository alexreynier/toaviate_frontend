// Directive: fuelUpliftPanel
// Slide-in panel for recording a fuel/oil uplift OUTSIDE of a flight, from the
// Aircraft Status page. Mirrors defectReportPanel's chrome (dr-* classes).
//
// Usage:
//   <fuel-uplift-panel
//       is-open="vm.showFuelPanel"
//       plane-registration="vm._fuelPlane.registration"
//       currencies="vm.currenciesByClub[vm._fuelClubId]"
//       on-submit="vm.submitFuelUplift(receiptData, pendingFile)"
//       on-close="vm.closeFuelPanel()">
//   </fuel-uplift-panel>
//
// on-submit receives:
//   receiptData  — { item: 'Fuel'|'Oil', quantity, currency (currency obj), price, reimbursement }
//   pendingFile  — the selected receipt image File, or null
// The parent uploads the image (if any) and calls PlaneService.AddReceipt.

app.directive('fuelUpliftPanel', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        scope: {
            isOpen:            '=',
            planeRegistration: '=',
            currencies:        '=',
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
                            '<div class="dr-header-icon"><i class="fa fa-gas-pump"></i></div>' +
                            '<div>' +
                                '<h3 class="dr-header-title">Add Fuel / Oil Uplift</h3>' +
                                '<p class="dr-header-sub" ng-if="planeRegistration">for <strong>{{ planeRegistration }}</strong></p>' +
                            '</div>' +
                        '</div>' +
                        '<button class="dr-close" ng-click="close()" aria-label="Close"><i class="fa fa-times"></i></button>' +
                    '</div>' +

                    // Body
                    '<div class="dr-body">' +

                        // Type
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">1</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">What was added?</h4>' +
                                '<div class="dr-field">' +
                                    '<label class="dr-label">Type</label>' +
                                    '<div class="fu-type-grid">' +
                                        '<button type="button" class="fu-type-btn" ng-class="{\'fu-type-btn--active\': form.item === \'Fuel\'}" ng-click="setItem(\'Fuel\')">' +
                                            '<i class="fa fa-gas-pump"></i><span>Fuel</span>' +
                                        '</button>' +
                                        '<button type="button" class="fu-type-btn" ng-class="{\'fu-type-btn--active\': form.item === \'Oil\'}" ng-click="setItem(\'Oil\')">' +
                                            '<i class="fa fa-oil-can"></i><span>Oil</span>' +
                                        '</button>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="dr-field" id="field-uplift-qty">' +
                                    '<label class="dr-label">Quantity ({{ form.item === \'Oil\' ? \'quarts\' : \'litres\' }})</label>' +
                                    '<input type="number" step="0.01" min="0" class="dr-input" ng-model="form.quantity" placeholder="0.00" />' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Cost
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">2</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">Cost</h4>' +
                                '<div class="fu-row">' +
                                    '<div class="dr-field fu-col">' +
                                        '<label class="dr-label">Currency</label>' +
                                        '<select class="dr-input" ng-model="form.currency" ng-options="c.iso_code for c in currencies track by c.iso_code"></select>' +
                                    '</div>' +
                                    '<div class="dr-field fu-col" id="field-uplift-price">' +
                                        '<label class="dr-label">Price</label>' +
                                        '<input type="number" step="0.01" min="0" class="dr-input" ng-model="form.price" placeholder="0.00" />' +
                                    '</div>' +
                                '</div>' +
                                '<div class="dr-field fu-check-row">' +
                                    '<label class="fu-checkbox">' +
                                        '<input type="checkbox" ng-model="form.reimbursement" />' +
                                        '<span>I am requesting reimbursement</span>' +
                                    '</label>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Receipt image
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">3</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">Receipt photo ' +
                                    '<span class="dr-optional" ng-if="!form.reimbursement">(optional)</span>' +
                                    '<span class="fu-required" ng-if="form.reimbursement">(required for reimbursement)</span>' +
                                '</h4>' +
                                '<div class="dr-dropzone" ng-class="{\'dr-dropzone--has-files\': !!pendingFile}">' +
                                    '<div class="dr-dropzone-content" ng-if="!pendingFile">' +
                                        '<i class="fa fa-cloud-upload-alt dr-dropzone-icon"></i>' +
                                        '<span class="dr-dropzone-text">Add a photo of the receipt</span>' +
                                        '<label class="dr-file-btn">' +
                                            '<i class="fa fa-camera"></i> Browse' +
                                            '<input type="file" accept="image/*" class="dr-file-input" fu-file-select on-file-selected="onFileSelected(file)" />' +
                                        '</label>' +
                                    '</div>' +
                                    '<div class="dr-file-list" ng-if="pendingFile">' +
                                        '<div class="dr-file-item">' +
                                            '<div class="dr-file-thumb">' +
                                                '<img ng-if="filePreview" ng-src="{{ filePreview }}" />' +
                                                '<i ng-if="!filePreview" class="fa fa-file-image dr-file-thumb-icon"></i>' +
                                            '</div>' +
                                            '<div class="dr-file-info">' +
                                                '<span class="dr-file-name">{{ pendingFile.name | limitTo:30 }}{{ pendingFile.name.length > 30 ? "…" : "" }}</span>' +
                                                '<span class="dr-file-size">{{ formatSize(pendingFile.size) }}</span>' +
                                            '</div>' +
                                            '<button class="dr-file-remove" ng-click="removeFile($event)" title="Remove"><i class="fa fa-times"></i></button>' +
                                        '</div>' +
                                    '</div>' +
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
                            ' {{ submitting ? "Saving…" : "Add Uplift" }}' +
                        '</button>' +
                    '</div>' +

                '</div>' +
            '</div>',

        link: function (scope) {
            var IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'webp'];
            var MAX_IMAGE_SIZE = 20 * 1024 * 1024;

            function defaultForm() {
                return {
                    item: 'Fuel',
                    quantity: null,
                    currency: (scope.currencies && scope.currencies.length) ? scope.currencies[0] : null,
                    price: null,
                    reimbursement: false
                };
            }

            scope.form = defaultForm();
            scope.pendingFile = null;
            scope.filePreview = null;
            scope.submitting = false;

            scope.$watch('isOpen', function (val) {
                if (val) {
                    scope.form = defaultForm();
                    scope.pendingFile = null;
                    scope.filePreview = null;
                    scope.submitting = false;
                    document.body.classList.add('dr-body-no-scroll');
                } else {
                    document.body.classList.remove('dr-body-no-scroll');
                }
            });

            // If currencies arrive after open, default the selection.
            scope.$watch('currencies', function (list) {
                if (list && list.length && !scope.form.currency) {
                    scope.form.currency = list[0];
                }
            });

            scope.setItem = function (item) { scope.form.item = item; };

            scope.onFileSelected = function (file) {
                if (!file) { return; }
                var ext = (file.name.split('.').pop() || '').toLowerCase();
                var isImage = IMAGE_EXTENSIONS.indexOf(ext) > -1 || file.type.indexOf('image/') === 0;
                if (!isImage || file.size > MAX_IMAGE_SIZE) { return; }
                scope.pendingFile = file;
                var reader = new FileReader();
                reader.onload = function (e) { $timeout(function () { scope.filePreview = e.target.result; }); };
                reader.readAsDataURL(file);
            };

            scope.removeFile = function ($event) {
                if ($event) { $event.stopPropagation(); }
                scope.pendingFile = null;
                scope.filePreview = null;
            };

            scope.formatSize = function (bytes) {
                if (!bytes) { return ''; }
                if (bytes < 1024) { return bytes + ' B'; }
                if (bytes < 1048576) { return (bytes / 1024).toFixed(1) + ' KB'; }
                return (bytes / 1048576).toFixed(1) + ' MB';
            };

            scope.canSubmit = function () {
                if (!scope.form.item) { return false; }
                if (!(scope.form.quantity > 0)) { return false; }
                if (!(scope.form.price >= 0) || scope.form.price === null) { return false; }
                if (!scope.form.currency) { return false; }
                // Image is required when claiming reimbursement.
                if (scope.form.reimbursement && !scope.pendingFile) { return false; }
                return true;
            };

            scope.submit = function () {
                if (!scope.canSubmit() || scope.submitting) { return; }
                scope.submitting = true;
                var receiptData = {
                    item: scope.form.item,
                    quantity: scope.form.quantity,
                    currency: scope.form.currency,
                    price: scope.form.price,
                    reimbursement: scope.form.reimbursement
                };
                scope.onSubmit({ receiptData: receiptData, pendingFile: scope.pendingFile || null });
            };

            scope.close = function () {
                scope.isOpen = false;
                scope.onClose();
            };

            // Parent re-enables the form if the save failed and the panel stays open.
            scope.$on('fuelPanelReset', function () { scope.submitting = false; });

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

// Lightweight file-select helper (single file) — the defect panel's dm-file-select
// is multi-file; this one emits a single File via on-file-selected.
app.directive('fuFileSelect', function () {
    return {
        restrict: 'A',
        scope: { onFileSelected: '&' },
        link: function (scope, element) {
            element.on('change', function (e) {
                var files = e.target.files;
                if (files && files.length) {
                    scope.$apply(function () { scope.onFileSelected({ file: files[0] }); });
                    element.val(''); // allow re-selecting same file
                }
            });
        }
    };
});
