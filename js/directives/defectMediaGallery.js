// Directive: defectMediaGallery
// Displays and manages photos & videos attached to a plane defect.
// Usage: <defect-media-gallery defect-id="defect.id" club-id="club.id" media-count="defect.media_count"></defect-media-gallery>

app.directive('defectMediaGallery', ['DefectMediaService', 'ToastService', '$timeout', '$rootScope', function (DefectMediaService, ToastService, $timeout, $rootScope) {
    return {
        restrict: 'E',
        scope: {
            defectId: '=',
            clubId: '=',
            mediaCount: '=?',
            readOnly: '=?'
        },
        template:
            '<div class="defect-media-gallery">' +

                // ── Upload area ──
                '<div class="dm-upload-area" ng-if="!readOnly">' +
                    '<div class="dm-upload-dropzone" ' +
                        'ng-class="{\'dm-drag-over\': dragOver}" ' +
                        'dm-drop-zone on-files-dropped="onFilesSelected(files)">' +
                        '<div class="dm-upload-content">' +
                            '<i class="fa fa-cloud-upload dm-upload-icon"></i>' +
                            '<div class="dm-upload-text">Drop photos or video here</div>' +
                            '<div class="dm-upload-or">or</div>' +
                            '<label class="btn btn-primary btn-sm dm-upload-btn">' +
                                '<i class="fa fa-camera"></i> Choose Files' +
                                '<input type="file" multiple accept="image/*,video/*" ' +
                                    'class="dm-file-input" dm-file-select on-files-selected="onFilesSelected(files)" />' +
                            '</label>' +
                            '<div class="dm-upload-hint">' +
                                'Up to 10 photos &amp; 1 video per defect' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    // upload progress
                    '<div class="dm-upload-progress" ng-if="uploading">' +
                        '<div class="dm-progress-item" ng-repeat="u in uploadQueue">' +
                            '<span class="dm-progress-name">{{ u.name }}</span>' +
                            '<span class="dm-progress-status">' +
                                '<i class="fa fa-spinner fa-spin" ng-if="u.status === \'uploading\'"></i>' +
                                '<i class="fa fa-check text-success" ng-if="u.status === \'done\'"></i>' +
                                '<i class="fa fa-times text-danger" ng-if="u.status === \'error\'"></i>' +
                                '<span ng-if="u.status === \'error\'"> {{ u.error }}</span>' +
                            '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +

                // ── Gallery grid ──
                '<div class="dm-gallery" ng-if="media.length > 0">' +
                    '<div class="dm-gallery-item" ng-repeat="item in media | orderBy:\'sort_order\'" ' +
                        'ng-class="{\'dm-video\': item.media_type === \'video\'}">' +
                        // Thumbnail / preview
                        '<div class="dm-thumb-wrap" ng-click="openLightbox(item)">' +
                            '<img ng-if="item.media_type === \'image\'" ng-src="{{ item._thumbUrl }}" ' +
                                'alt="{{ item.original_name }}" class="dm-thumb" />' +
                            '<div ng-if="item.media_type === \'video\'" class="dm-video-thumb">' +
                                '<i class="fa fa-play-circle"></i>' +
                                '<span class="dm-video-label">Video</span>' +
                            '</div>' +
                            // conversion spinner
                            '<div class="dm-conversion-badge" ng-if="item.conversion_status === \'pending\' || item.conversion_status === \'processing\'">' +
                                '<i class="fa fa-spinner fa-spin"></i> Converting...' +
                            '</div>' +
                            '<div class="dm-conversion-badge dm-conversion-failed" ng-if="item.conversion_status === \'failed\'">' +
                                '<i class="fa fa-exclamation-triangle"></i> Failed' +
                            '</div>' +
                        '</div>' +
                        // Delete button (only for club admins or the uploader)
                        '<button class="dm-delete-btn" ng-if="item.can_delete" ng-click="deleteMedia(item, $event)" ' +
                            'title="Remove">' +
                            '<i class="fa fa-trash"></i>' +
                        '</button>' +
                        // File info
                        '<div class="dm-item-info">' +
                            '<span class="dm-item-name" title="{{ item.original_name }}">{{ item.original_name | limitTo:20 }}{{ item.original_name.length > 20 ? "..." : "" }}</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +

                // ── No media message ──
                '<div class="dm-empty" ng-if="media.length === 0 && !uploading && loaded">' +
                    '<i class="fa fa-camera dm-empty-icon"></i>' +
                    '<span>No photos or videos attached</span>' +
                '</div>' +

                // ── Lightbox overlay ──
                '<div class="dm-lightbox" ng-if="lightbox.show" ng-click="closeLightbox()">' +
                    '<div class="dm-lightbox-content" ng-click="$event.stopPropagation()">' +
                        '<button class="dm-lightbox-close" ng-click="closeLightbox()">' +
                            '<i class="fa fa-times"></i>' +
                        '</button>' +
                        // Nav arrows
                        '<button class="dm-lightbox-nav dm-lightbox-prev" ng-if="lightbox.hasPrev" ng-click="lightboxPrev($event)">' +
                            '<i class="fa fa-chevron-left"></i>' +
                        '</button>' +
                        '<button class="dm-lightbox-nav dm-lightbox-next" ng-if="lightbox.hasNext" ng-click="lightboxNext($event)">' +
                            '<i class="fa fa-chevron-right"></i>' +
                        '</button>' +
                        // Image
                        '<img ng-if="lightbox.item.media_type === \'image\'" ng-src="{{ lightbox.item._fileUrl }}" ' +
                            'class="dm-lightbox-img" />' +
                        // Video
                        '<video ng-if="lightbox.item.media_type === \'video\'" controls autoplay ' +
                            'class="dm-lightbox-video" ng-src="{{ lightbox.item._fileUrl }}">' +
                        '</video>' +
                        // Info bar
                        '<div class="dm-lightbox-info">' +
                            '<span>{{ lightbox.item.original_name }}</span>' +
                            '<span class="dm-lightbox-uploader" ng-if="lightbox.item.first_name">' +
                                'Uploaded by {{ lightbox.item.first_name }} {{ lightbox.item.last_name }}' +
                            '</span>' +
                            '<span class="dm-lightbox-size">{{ formatFileSize(lightbox.item.file_size) }}</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +

            '</div>',

        link: function (scope, element) {
            scope.media = [];
            scope.uploading = false;
            scope.uploadQueue = [];
            scope.loaded = false;
            scope.dragOver = false;
            scope.lightbox = { show: false, item: null, hasPrev: false, hasNext: false };

            var IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'webp'];
            var VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', '3gp'];
            var MAX_IMAGE_SIZE = 20 * 1024 * 1024;   // 20 MB
            var MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB

            // ── Load media on init ──
            scope.$watch('defectId', function (newVal) {
                if (newVal) {
                    loadMedia();
                }
            });

            function loadMedia() {
                DefectMediaService.GetForDefect(scope.defectId).then(function (data) {
                    if (data && data.success !== false) {
                        scope.media = data.media || [];
                        scope.mediaCount = scope.media.length;
                        // Load thumbnails
                        scope.media.forEach(function (item) {
                            loadItemUrls(item);
                        });
                    }
                    scope.loaded = true;
                });
            }

            function loadItemUrls(item) {
                if (item.media_type === 'image' && item.stored_name) {
                    DefectMediaService.LoadThumbnailUrl(item.stored_name).then(function (url) {
                        item._thumbUrl = url;
                    });
                }
            }

            // ── File selection handler ──
            scope.onFilesSelected = function (files) {
                if (!files || files.length === 0) return;

                var filesToUpload = [];
                var currentImages = scope.media.filter(function (m) { return m.media_type === 'image'; }).length;
                var currentVideos = scope.media.filter(function (m) { return m.media_type === 'video'; }).length;

                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    var ext = (file.name.split('.').pop() || '').toLowerCase();
                    var isImage = IMAGE_EXTENSIONS.indexOf(ext) > -1 || file.type.indexOf('image/') === 0;
                    var isVideo = VIDEO_EXTENSIONS.indexOf(ext) > -1 || file.type.indexOf('video/') === 0;

                    if (!isImage && !isVideo) {
                        ToastService.error('Unsupported File', file.name + ' is not a supported format.');
                        continue;
                    }

                    if (isImage && file.size > MAX_IMAGE_SIZE) {
                        ToastService.error('File Too Large', file.name + ' exceeds the 20 MB image limit.');
                        continue;
                    }

                    if (isVideo && file.size > MAX_VIDEO_SIZE) {
                        ToastService.error('File Too Large', file.name + ' exceeds the 100 MB video limit.');
                        continue;
                    }

                    if (isImage && currentImages >= 10) {
                        ToastService.error('Limit Reached', 'Maximum of 10 images per defect.');
                        continue;
                    }

                    if (isVideo && currentVideos >= 1) {
                        ToastService.error('Limit Reached', 'Maximum of 1 video per defect. Delete the existing video first.');
                        continue;
                    }

                    if (isImage) currentImages++;
                    if (isVideo) currentVideos++;

                    filesToUpload.push(file);
                }

                if (filesToUpload.length > 0) {
                    uploadFiles(filesToUpload);
                }
            };

            function uploadFiles(files) {
                scope.uploading = true;
                scope.uploadQueue = files.map(function (f) {
                    return { name: f.name, status: 'uploading', error: '' };
                });

                var sortStart = scope.media.length;
                var chain = Promise.resolve();

                files.forEach(function (file, idx) {
                    chain = chain.then(function () {
                        var currentUserId = ($rootScope.globals && $rootScope.globals.currentUser) ? $rootScope.globals.currentUser.id : null;
                        return DefectMediaService.UploadAndAttach(file, scope.defectId, scope.clubId, sortStart + idx, currentUserId)
                            .then(function (result) {
                                $timeout(function () {
                                    if (result && result.success) {
                                        scope.uploadQueue[idx].status = 'done';
                                        var newItem = result.media;
                                        newItem.can_delete = true; // uploader can always delete their own
                                        loadItemUrls(newItem);
                                        scope.media.push(newItem);
                                        scope.mediaCount = scope.media.length;
                                    } else {
                                        scope.uploadQueue[idx].status = 'error';
                                        scope.uploadQueue[idx].error = (result && result.message) || 'Upload failed';
                                    }
                                });
                            })
                            .catch(function (err) {
                                $timeout(function () {
                                    scope.uploadQueue[idx].status = 'error';
                                    scope.uploadQueue[idx].error = err.message || 'Upload failed';
                                });
                            });
                    });
                });

                chain.then(function () {
                    $timeout(function () {
                        scope.uploading = false;
                        scope.uploadQueue = [];
                    }, 2000);
                });
            }

            // ── Delete media ──
            scope.deleteMedia = function (item, $event) {
                $event.stopPropagation();
                if (!confirm('Delete this ' + item.media_type + '?')) return;

                DefectMediaService.Delete(item.id).then(function (result) {
                    if (result && result.success) {
                        // Revoke blob URLs
                        if (item._thumbUrl) URL.revokeObjectURL(item._thumbUrl);
                        if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);

                        var idx = scope.media.indexOf(item);
                        if (idx > -1) scope.media.splice(idx, 1);
                        scope.mediaCount = scope.media.length;
                        ToastService.success('Deleted', item.media_type.charAt(0).toUpperCase() + item.media_type.slice(1) + ' removed.');
                    } else {
                        ToastService.error('Error', (result && result.message) || 'Could not delete media.');
                    }
                });
            };

            // ── Lightbox ──
            scope.openLightbox = function (item) {
                // Load full file URL if not already loaded
                if (!item._fileUrl) {
                    DefectMediaService.LoadFileUrl(item.stored_name).then(function (url) {
                        item._fileUrl = url;
                        showLightbox(item);
                    });
                } else {
                    showLightbox(item);
                }
            };

            function showLightbox(item) {
                var images = scope.media.filter(function (m) { return m.media_type === 'image'; });
                var idx = images.indexOf(item);
                scope.lightbox = {
                    show: true,
                    item: item,
                    hasPrev: item.media_type === 'image' && idx > 0,
                    hasNext: item.media_type === 'image' && idx < images.length - 1
                };
            }

            scope.closeLightbox = function () {
                scope.lightbox = { show: false, item: null, hasPrev: false, hasNext: false };
            };

            scope.lightboxPrev = function ($event) {
                $event.stopPropagation();
                navigateLightbox(-1);
            };

            scope.lightboxNext = function ($event) {
                $event.stopPropagation();
                navigateLightbox(1);
            };

            function navigateLightbox(direction) {
                var images = scope.media.filter(function (m) { return m.media_type === 'image'; });
                var idx = images.indexOf(scope.lightbox.item);
                var newIdx = idx + direction;
                if (newIdx >= 0 && newIdx < images.length) {
                    var target = images[newIdx];
                    if (!target._fileUrl) {
                        DefectMediaService.LoadFileUrl(target.stored_name).then(function (url) {
                            target._fileUrl = url;
                            showLightbox(target);
                        });
                    } else {
                        showLightbox(target);
                    }
                }
            }

            // ── Keyboard navigation for lightbox ──
            function onKeydown(e) {
                if (!scope.lightbox.show) return;
                scope.$apply(function () {
                    if (e.keyCode === 27) scope.closeLightbox();        // Escape
                    if (e.keyCode === 37) navigateLightbox(-1);          // Left
                    if (e.keyCode === 39) navigateLightbox(1);           // Right
                });
            }
            document.addEventListener('keydown', onKeydown);

            // ── Utility ──
            scope.formatFileSize = function (bytes) {
                if (!bytes) return '';
                if (bytes < 1024) return bytes + ' B';
                if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / 1048576).toFixed(1) + ' MB';
            };

            // ── Cleanup ──
            scope.$on('$destroy', function () {
                document.removeEventListener('keydown', onKeydown);
                // Revoke all blob URLs
                scope.media.forEach(function (item) {
                    if (item._thumbUrl) URL.revokeObjectURL(item._thumbUrl);
                    if (item._fileUrl) URL.revokeObjectURL(item._fileUrl);
                });
            });
        }
    };
}]);


// ── Helper directive: dm-file-select ──
// Wraps a file <input> to pass selected files to a callback
app.directive('dmFileSelect', function () {
    return {
        restrict: 'A',
        scope: {
            onFilesSelected: '&'
        },
        link: function (scope, element) {
            element.on('change', function (e) {
                var files = e.target.files;
                if (files && files.length > 0) {
                    scope.$apply(function () {
                        scope.onFilesSelected({ files: Array.prototype.slice.call(files) });
                    });
                    // Reset so the same file can be selected again
                    element.val('');
                }
            });
        }
    };
});


// ── Helper directive: dm-drop-zone ──
// Provides drag-and-drop support for the upload area
app.directive('dmDropZone', function () {
    return {
        restrict: 'A',
        scope: {
            onFilesDropped: '&'
        },
        link: function (scope, element) {
            var dragCounter = 0;

            element.on('dragenter', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter++;
                if (dragCounter === 1) {
                    element.addClass('dm-drag-over');
                    scope.$apply(function () { scope.$parent.dragOver = true; });
                }
            });

            element.on('dragover', function (e) {
                e.preventDefault();
                e.stopPropagation();
            });

            element.on('dragleave', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter--;
                if (dragCounter === 0) {
                    element.removeClass('dm-drag-over');
                    scope.$apply(function () { scope.$parent.dragOver = false; });
                }
            });

            element.on('drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter = 0;
                element.removeClass('dm-drag-over');
                scope.$apply(function () { scope.$parent.dragOver = false; });

                var dt = e.dataTransfer || (e.originalEvent && e.originalEvent.dataTransfer);
                if (dt && dt.files && dt.files.length > 0) {
                    scope.$apply(function () {
                        scope.onFilesDropped({ files: Array.prototype.slice.call(dt.files) });
                    });
                }
            });
        }
    };
});
