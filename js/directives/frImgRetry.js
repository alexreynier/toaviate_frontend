// ─────────────────────────────────────────────────────
// frImgRetry — handles expired flight-replay photo URLs.
//
// Replay photo `url`s are self-authenticating SIGNED URLs that expire after ~1h
// and are bound to the viewing user. If a tab is left open past the hour, an
// <img> request returns 403. This directive listens for the image `error` event
// and, the first time one occurs, calls the supplied handler (which re-fetches
// the replay to mint fresh signed URLs and re-render). It de-bounces so a wall of
// stale thumbnails triggers only ONE refresh, and won't loop on genuinely broken
// images (it only retries once per element).
//
//   <img ng-src="{{ vm.photoSrc(ph) }}" fr-img-retry="vm.onPhotoUrlExpired()" />
// ─────────────────────────────────────────────────────
app.directive('frImgRetry', ['$rootScope', function ($rootScope) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var retried = false;
            element.on('error', function () {
                if (retried) return;          // only retry an element once
                retried = true;
                scope.$apply(function () { scope.$eval(attrs.frImgRetry); });
            });
            // Reset the retry guard whenever the src changes (e.g. after refresh
            // gives a fresh URL), so a later genuine expiry can retry again.
            attrs.$observe('src', function () { retried = false; });
        }
    };
}]);
