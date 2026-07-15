// Directive: defectReportPanel
// Slide-in panel for reporting a defect with optional photo/video uploads.
//
// Usage:
//   <defect-report-panel
//       is-open="vm.showDefectPanel"
//       plane-registration="plane.registration"
//       on-submit="vm.submitDefect(defectData, pendingFiles)"
//       on-close="vm.closeDefectPanel()">
//   </defect-report-panel>
//
// The parent controller supplies on-submit which receives:
//   defectData  — { defect, severity }
//   pendingFiles — array of File objects selected for upload
//
// After the defect is created (and the defect ID is known), the parent
// controller calls DefectMediaService.UploadAndAttach for each file.

app.directive('defectReportPanel', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        scope: {
            isOpen:             '=',
            planeRegistration:  '=',
            onSubmit:           '&',
            onClose:            '&'
        },
        template:
            // ── Backdrop ──
            '<div class="dr-backdrop" ng-class="{\'active\': isOpen}" ng-click="close()"></div>' +

            // ── Panel ──
            '<div class="dr-panel" ng-class="{\'open\': isOpen}">' +
                '<div class="dr-panel-inner">' +

                    // ── Header ──
                    '<div class="dr-header">' +
                        '<div class="dr-header-left">' +
                            '<div class="dr-header-icon"><i class="fa fa-exclamation-triangle"></i></div>' +
                            '<div>' +
                                '<h3 class="dr-header-title">Report A Defect</h3>' +
                                '<p class="dr-header-sub" ng-if="planeRegistration">for <strong>{{ planeRegistration }}</strong></p>' +
                            '</div>' +
                        '</div>' +
                        '<button class="dr-close" ng-click="close()" aria-label="Close">' +
                            '<i class="fa fa-times"></i>' +
                        '</button>' +
                    '</div>' +

                    // ── Scrollable body ──
                    '<div class="dr-body">' +

                        // Step 1: Defect info
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">1</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">What\'s the problem?</h4>' +
                                '<div class="dr-field">' +
                                    '<label class="dr-label">Describe the defect</label>' +
                                    '<textarea class="dr-textarea" ng-model="form.defect" ' +
                                        'placeholder="e.g. Oil leak observed near the nose gear…" ' +
                                        'rows="3"></textarea>' +
                                '</div>' +
                                '<div class="dr-field">' +
                                    '<label class="dr-label">Severity</label>' +
                                    '<div class="dr-severity-grid">' +
                                        '<button class="dr-severity-btn" ' +
                                            'ng-repeat="s in severities" ' +
                                            'ng-class="{\'dr-severity-btn--active\': form.severity === s, \'dr-sev-nofly\': s.level === \'nofly\', \'dr-sev-maint\': s.level === \'maint\', \'dr-sev-note\': s.level === \'note\', \'dr-sev-unsure\': s.level === \'unsure\'}" ' +
                                            'ng-click="selectSeverity(s)">' +
                                            '<i class="fa" ng-class="s.icon"></i>' +
                                            '<span class="dr-severity-label">{{ s.short }}</span>' +
                                            '<span class="dr-severity-desc">{{ s.desc }}</span>' +
                                        '</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                        // Step 2: Photos & video
                        '<div class="dr-section">' +
                            '<div class="dr-section-num">2</div>' +
                            '<div class="dr-section-content">' +
                                '<h4 class="dr-section-title">Add photos or video <span class="dr-optional">(optional)</span></h4>' +
                                '<p class="dr-hint">Photos help engineers understand the issue. You can also add more after submitting.</p>' +

                                // Drop zone
                                '<div class="dr-dropzone" ' +
                                    'ng-class="{\'dr-dropzone--has-files\': pendingFiles.length > 0, \'dr-dropzone--drag-over\': dragOver}" ' +
                                    'dm-drop-zone on-files-dropped="onFilesDropped(files)">' +
                                    '<div class="dr-dropzone-content" ng-if="pendingFiles.length === 0">' +
                                        '<i class="fa fa-cloud-upload-alt dr-dropzone-icon"></i>' +
                                        '<span class="dr-dropzone-text">Drop files here</span>' +
                                        '<span class="dr-dropzone-or">or</span>' +
                                        '<label class="dr-file-btn">' +
                                            '<i class="fa fa-camera"></i> Browse' +
                                            '<input type="file" multiple accept="image/*,video/*" ' +
                                                'class="dr-file-input" dm-file-select on-files-selected="onFilesDropped(files)" />' +
                                        '</label>' +
                                    '</div>' +

                                    // File preview list
                                    '<div class="dr-file-list" ng-if="pendingFiles.length > 0">' +
                                        '<div class="dr-file-item" ng-repeat="f in pendingFiles">' +
                                            '<div class="dr-file-thumb">' +
                                                '<img ng-if="f._preview" ng-src="{{ f._preview }}" />' +
                                                '<i ng-if="!f._preview" class="fa fa-file-video dr-file-thumb-icon"></i>' +
                                            '</div>' +
                                            '<div class="dr-file-info">' +
                                                '<span class="dr-file-name">{{ f.name | limitTo:30 }}{{ f.name.length > 30 ? "…" : "" }}</span>' +
                                                '<span class="dr-file-size">{{ formatSize(f.size) }}</span>' +
                                            '</div>' +
                                            '<button class="dr-file-remove" ng-click="removeFile($index, $event)" title="Remove">' +
                                                '<i class="fa fa-times"></i>' +
                                            '</button>' +
                                        '</div>' +
                                        '<label class="dr-file-add-more">' +
                                            '<i class="fa fa-plus"></i> Add more' +
                                            '<input type="file" multiple accept="image/*,video/*" ' +
                                                'class="dr-file-input" dm-file-select on-files-selected="onFilesDropped(files)" />' +
                                        '</label>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="dr-file-limits">' +
                                    '<span><i class="fa fa-info-circle"></i> Max 10 photos &amp; 1 video per defect. Images up to 20 MB, video up to 100 MB.</span>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +

                    // ── Footer ──
                    '<div class="dr-footer">' +
                        '<button class="dr-btn dr-btn--cancel" ng-click="close()">' +
                            '<i class="fa fa-times"></i> Cancel' +
                        '</button>' +
                        '<button class="dr-btn dr-btn--submit" ng-click="submit()" ' +
                            'ng-disabled="submitting || !form.defect || !form.severity">' +
                            '<i class="fa fa-spinner fa-spin" ng-if="submitting"></i>' +
                            '<i class="fa fa-paper-plane" ng-if="!submitting"></i>' +
                            ' {{ submitting ? "Submitting…" : "Report Defect" }}' +
                        '</button>' +
                    '</div>' +

                '</div>' +
            '</div>',

        link: function (scope, element) {
            var IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'webp'];
            var VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', '3gp'];
            var MAX_IMAGE_SIZE = 20 * 1024 * 1024;
            var MAX_VIDEO_SIZE = 100 * 1024 * 1024;

            // ── Severity options ──
            scope.severities = [
                { title: 'No Fly Item - Ground the plane',                    short: 'No Fly',    desc: 'Ground the plane',                          level: 'nofly',  icon: 'fa-ban'              },
                { title: 'Flyable - needs to be checked at next maintenance', short: 'Flyable',   desc: 'Needs checking at next maintenance',        level: 'maint',  icon: 'fa-wrench'           },
                { title: 'Not urgent - but needs noting',                     short: 'Not Urgent',desc: 'Needs noting',                               level: 'note',   icon: 'fa-sticky-note'    },
                { title: 'Unsure of severity',                                short: 'Unsure',    desc: 'Not sure how severe',                       level: 'unsure', icon: 'fa-question-circle'  }
            ];

            // ── Form state ──
            scope.form = { defect: '', severity: null };
            scope.pendingFiles = [];
            scope.submitting = false;
            scope.dragOver = false;

            // Reset form when panel opens
            scope.$watch('isOpen', function (val) {
                if (val) {
                    scope.form = { defect: '', severity: null };
                    scope.pendingFiles = [];
                    scope.submitting = false;
                    // Prevent body scroll
                    document.body.classList.add('dr-body-no-scroll');
                } else {
                    document.body.classList.remove('dr-body-no-scroll');
                }
            });

            scope.selectSeverity = function (s) {
                scope.form.severity = s;
            };

            // ── File handling ──
            scope.onFilesDropped = function (files) {
                if (!files || files.length === 0) return;

                var currentImages = scope.pendingFiles.filter(function (f) { return f._mediaType === 'image'; }).length;
                var currentVideos = scope.pendingFiles.filter(function (f) { return f._mediaType === 'video'; }).length;

                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    var ext = (file.name.split('.').pop() || '').toLowerCase();
                    var isImage = IMAGE_EXTENSIONS.indexOf(ext) > -1 || file.type.indexOf('image/') === 0;
                    var isVideo = VIDEO_EXTENSIONS.indexOf(ext) > -1 || file.type.indexOf('video/') === 0;

                    if (!isImage && !isVideo) continue;
                    if (isImage && file.size > MAX_IMAGE_SIZE) continue;
                    if (isVideo && file.size > MAX_VIDEO_SIZE) continue;
                    if (isImage && currentImages >= 10) continue;
                    if (isVideo && currentVideos >= 1) continue;

                    file._mediaType = isImage ? 'image' : 'video';

                    // Generate thumbnail preview for images
                    if (isImage) {
                        (function (f) {
                            var reader = new FileReader();
                            reader.onload = function (e) {
                                $timeout(function () { f._preview = e.target.result; });
                            };
                            reader.readAsDataURL(f);
                        })(file);
                    }

                    scope.pendingFiles.push(file);
                    if (isImage) currentImages++;
                    if (isVideo) currentVideos++;
                }
            };

            scope.removeFile = function (index, $event) {
                $event.stopPropagation();
                if (scope.pendingFiles[index]._preview) {
                    // No URL.revokeObjectURL needed — it's a data URL from FileReader
                }
                scope.pendingFiles.splice(index, 1);
            };

            scope.formatSize = function (bytes) {
                if (!bytes) return '';
                if (bytes < 1024) return bytes + ' B';
                if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / 1048576).toFixed(1) + ' MB';
            };

            // ── Submit ──
            scope.submit = function () {
                if (!scope.form.defect || !scope.form.severity) return;
                scope.submitting = true;

                var defectData = {
                    defect: scope.form.defect,
                    severity: scope.form.severity.title
                };
                var files = scope.pendingFiles.slice(); // copy array

                // Call parent's onSubmit — parent handles the API call and media uploads
                scope.onSubmit({ defectData: defectData, pendingFiles: files });
            };

            // Called by parent after successful submission to close the panel
            scope.$watch('isOpen', function (newVal, oldVal) {
                if (oldVal && !newVal) {
                    // Cleanup when closing
                    scope.form = { defect: '', severity: null };
                    scope.pendingFiles = [];
                    scope.submitting = false;
                }
            });

            // ── Close ──
            scope.close = function () {
                scope.isOpen = false;
                scope.onClose();
            };

            // ── Keyboard: Escape to close ──
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
