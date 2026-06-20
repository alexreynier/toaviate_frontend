// ─────────────────────────────────────────────────────
// GoogleMapsLoader — lazily injects the Google Maps JS API exactly once, on
// demand (so it isn't fetched on every page of the app). Returns a promise that
// resolves with the `google.maps` namespace. The key comes from EnvConfig
// (per-environment, restrict by HTTP referrer in the Google Cloud console).
// ─────────────────────────────────────────────────────
app.factory('GoogleMapsLoader', GoogleMapsLoader);

    GoogleMapsLoader.$inject = ['$q', '$window', '$document', 'EnvConfig'];
    function GoogleMapsLoader($q, $window, $document, EnvConfig) {

        var loadPromise = null;

        return { load: load };

        function load() {
            if (loadPromise) return loadPromise;

            var deferred = $q.defer();

            // Already present (e.g. another loader added it) — resolve now.
            if ($window.google && $window.google.maps) {
                deferred.resolve($window.google.maps);
                loadPromise = deferred.promise;
                return loadPromise;
            }

            var key = EnvConfig.getGoogleMapsKey();
            if (!key || key === 'REPLACE_WITH_GOOGLE_MAPS_KEY') {
                // No key configured — fail gracefully so the page can show a
                // map-unavailable fallback rather than throwing.
                deferred.reject({ reason: 'no_key' });
                loadPromise = deferred.promise;
                return loadPromise;
            }

            // Global callback name the Maps loader will invoke when ready.
            var cbName = '__toaviateMapsReady';
            $window[cbName] = function() {
                deferred.resolve($window.google.maps);
                try { delete $window[cbName]; } catch (e) { $window[cbName] = undefined; }
            };

            var script = $document[0].createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=' +
                encodeURIComponent(key) + '&libraries=geometry&callback=' + cbName;
            script.async = true;
            script.defer = true;
            script.onerror = function() {
                deferred.reject({ reason: 'load_error' });
                loadPromise = null;   // allow a later retry
            };
            $document[0].body.appendChild(script);

            loadPromise = deferred.promise;
            return loadPromise;
        }
    }
