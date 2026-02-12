// Directive: lcfDropzone
// Provides drag-and-drop file handling for the lesson content file upload zone.
// Usage: <div lcf-dropzone lcf-on-drop="vm.handleSelectedFiles(files)" lcf-on-drag-state="vm.dragOver = isDragging">

app.directive('lcfDropzone', function() {
    return {
        restrict: 'A',
        scope: {
            lcfOnDrop: '&',
            lcfOnDragState: '&'
        },
        link: function(scope, element) {
            var dragCounter = 0;

            function setDragState(isDragging) {
                scope.$apply(function() {
                    scope.lcfOnDragState({ isDragging: isDragging });
                });
            }

            element.on('dragenter', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter++;
                if (dragCounter === 1) {
                    setDragState(true);
                }
            });

            element.on('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
            });

            element.on('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter--;
                if (dragCounter === 0) {
                    setDragState(false);
                }
            });

            element.on('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dragCounter = 0;
                setDragState(false);

                var dt = e.dataTransfer || (e.originalEvent && e.originalEvent.dataTransfer);
                if (dt && dt.files && dt.files.length > 0) {
                    scope.$apply(function() {
                        scope.lcfOnDrop({ files: dt.files });
                    });
                }
            });

            scope.$on('$destroy', function() {
                element.off('dragenter dragover dragleave drop');
            });
        }
    };
});


// Directive: lcfFileSelect
// Wraps a native file input to bind selected files into Angular scope.
// Usage: <input type="file" lcf-file-select="vm.onFileInputChange(files)" />

app.directive('lcfFileSelect', function() {
    return {
        restrict: 'A',
        scope: {
            lcfFileSelect: '&'
        },
        link: function(scope, element) {
            element.on('change', function() {
                var files = element[0].files;
                if (files && files.length > 0) {
                    scope.$apply(function() {
                        scope.lcfFileSelect({ files: files });
                    });
                }
                // Reset so same file can be re-selected
                element[0].value = '';
            });

            scope.$on('$destroy', function() {
                element.off('change');
            });
        }
    };
});
