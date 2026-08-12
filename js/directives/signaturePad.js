// ═══════════════════════════════════════════════════════════════════
//  <sig-pad ng-model="vm.signature"></sig-pad>
//  Canvas signature pad (libs/js/signature_pad.js — global SignaturePad).
//  The model holds '' when empty, or a 'data:image/png;base64,…' data
//  URL after each stroke (the only format the backend accepts). Retina
//  scaling is capped at 2× per the backend's ~300 KB payload limit.
//  Used by: instructor sign modals, the pilot external-endorsement
//  form, and the public endorsement-confirmation page.
// ═══════════════════════════════════════════════════════════════════

app.directive('sigPad', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {},
        template:
            '<div class="sigpad">' +
            '  <canvas class="sigpad__canvas"></canvas>' +
            '  <div class="sigpad__hint" ng-show="empty"><i class="fas fa-pen-nib"></i> Sign here</div>' +
            '  <button type="button" class="sigpad__clear" ng-click="clear()" ng-show="!empty">' +
            '    <i class="fas fa-eraser"></i> Clear' +
            '  </button>' +
            '</div>',
        link: function (scope, element, attrs, ngModel) {

            var canvas = element[0].querySelector('canvas');
            var pad = null;
            var lastValue = '';                    // survives resizes (soft keyboards!)
            scope.empty = true;

            function resize() {
                // Cap at 2× — retina-sharp without ballooning the PNG payload.
                var ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
                var w = canvas.offsetWidth;
                var h = canvas.offsetHeight;
                if (!w || !h) { return; }          // hidden (e.g. modal not shown yet)
                canvas.width = w * ratio;
                canvas.height = h * ratio;
                canvas.getContext('2d').scale(ratio, ratio);
                // Resizing blanks the canvas — restore the drawn signature
                // rather than losing it (mobile keyboards fire resize!).
                if (pad) {
                    pad.clear();
                    if (lastValue) { pad.fromDataURL(lastValue, { width: w, height: h }); }
                }
            }

            function setModel(value) {
                lastValue = value;
                scope.empty = !value;
                ngModel.$setViewValue(value);
            }

            function init() {
                if (typeof SignaturePad === 'undefined') {
                    console.log('sigPad: SignaturePad library missing');
                    return;
                }
                resize();
                pad = new SignaturePad(canvas, {
                    penColor: '#1e3a5f',
                    minWidth: 0.8,
                    maxWidth: 2.2
                });
                pad.addEventListener('endStroke', function () {
                    scope.$applyAsync(function () {
                        setModel(pad.isEmpty() ? '' : pad.toDataURL('image/png'));
                    });
                });
            }

            scope.clear = function () {
                if (pad) { pad.clear(); }
                setModel('');
            };

            // Modals render off-DOM first — wait a tick so the canvas has size.
            $timeout(init, 100);

            function onResize() {
                scope.$applyAsync(resize);
            }
            window.addEventListener('resize', onResize);
            scope.$on('$destroy', function () {
                window.removeEventListener('resize', onResize);
                if (pad) { pad.off(); }
            });
        }
    };
}]);
