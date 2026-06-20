// ─────────────────────────────────────────────────────
// MapLibreLoader — lazily injects MapLibre GL JS + CSS exactly once, on demand
// (so it isn't fetched on every page). Free, no API key. Resolves with the
// global `maplibregl` namespace. Used by the flight-replay map adapter when the
// configured provider is 'maplibre'.
// ─────────────────────────────────────────────────────
app.factory('MapLibreLoader', MapLibreLoader);

    MapLibreLoader.$inject = ['$q', '$window', '$document'];
    function MapLibreLoader($q, $window, $document) {

        // Pinned CDN build (MapLibre GL JS v4). Swap the version here if needed.
        var JS_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
        var CSS_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';

        var loadPromise = null;

        return { load: load };

        function load() {
            if (loadPromise) return loadPromise;

            var deferred = $q.defer();

            if ($window.maplibregl) {
                deferred.resolve($window.maplibregl);
                loadPromise = deferred.promise;
                return loadPromise;
            }

            // Stylesheet (once).
            if (!$document[0].getElementById('maplibre-gl-css')) {
                var link = $document[0].createElement('link');
                link.id = 'maplibre-gl-css';
                link.rel = 'stylesheet';
                link.href = CSS_URL;
                $document[0].head.appendChild(link);
            }

            var script = $document[0].createElement('script');
            script.src = JS_URL;
            script.async = true;
            script.onload = function () {
                if ($window.maplibregl) deferred.resolve($window.maplibregl);
                else { deferred.reject({ reason: 'load_error' }); loadPromise = null; }
            };
            script.onerror = function () {
                deferred.reject({ reason: 'load_error' });
                loadPromise = null;   // allow a later retry
            };
            $document[0].body.appendChild(script);

            loadPromise = deferred.promise;
            return loadPromise;
        }
    }
