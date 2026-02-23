/**
 * contenteditable directive — bridges contentEditable div with ng-model.
 * Usage: <div contenteditable="true" ng-model="vm.myHtml"></div>
 */
app.directive('contenteditable', ['$timeout', function($timeout) {
    return {
        restrict: 'A',
        require: '?ngModel',
        link: function(scope, element, attrs, ngModel) {
            if (!ngModel) return;

            var pendingRead = null;
            var isRendering = false;

            // Write model → view
            // Only update the DOM if the model value actually differs from
            // what the editor currently contains. This prevents $render from
            // blowing away live DOM changes made by document.execCommand.
            ngModel.$render = function() {
                var modelHtml = ngModel.$viewValue || '';
                if (element.html() !== modelHtml) {
                    isRendering = true;
                    element.html(modelHtml);
                    isRendering = false;
                }
            };

            // Read view → model
            function read() {
                var html = element.html();
                // Normalise empty-ish content
                if (html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') {
                    html = '';
                }
                ngModel.$setViewValue(html);
            }

            // Use $timeout instead of $apply to avoid $digest collisions
            // when execCommand triggers input/keyup events mid-cycle
            element.on('blur keyup paste input', function() {
                if (isRendering) return;
                if (pendingRead) { $timeout.cancel(pendingRead); }
                pendingRead = $timeout(read, 0, true);
            });

            // Handle paste — strip non-HTML formatting
            element.on('paste', function(e) {
                e.preventDefault();
                var text = '';
                if (e.originalEvent && e.originalEvent.clipboardData) {
                    text = e.originalEvent.clipboardData.getData('text/html') ||
                           e.originalEvent.clipboardData.getData('text/plain');
                } else if (e.clipboardData) {
                    text = e.clipboardData.getData('text/html') ||
                           e.clipboardData.getData('text/plain');
                } else if (window.clipboardData) {
                    text = window.clipboardData.getData('Text');
                }
                document.execCommand('insertHTML', false, text);
            });
        }
    };
}]);
