// ─────────────────────────────────────────────────────
// FlightMapAdapter — provider-agnostic map for the flight replay.
//
// The controller never talks to Google or MapLibre directly; it asks this
// factory for an adapter (chosen by EnvConfig.getMapProvider()) and calls a
// small, stable interface. Adding/changing a provider = editing this file only.
//
//   FlightMapAdapter.create().then(function (adapter) {
//       adapter.init(el, { center, points });
//       adapter.drawRoute(points, colourFn);
//       adapter.addAircraftMarker(point, onDragIndex);   // onDragIndex(latlng)->idx handled by caller
//       adapter.updateAircraftMarker(point);
//       adapter.setPins(pins, onPinClick);
//       adapter.panTo(point);
//       adapter.fitToTrack(points);
//       adapter.destroy();
//   });
//
// Shapes:
//   point = { lat, lon, heading }
//   pins  = [{ lat, lon, colour, title, onClick }]
//   colourFn(index) -> css colour string for the segment starting at index
//
// create() rejects when the chosen provider can't load (no Google key, CDN
// failure); the controller then shows its map-unavailable fallback.
// ─────────────────────────────────────────────────────
app.factory('FlightMapAdapter', FlightMapAdapter);

    FlightMapAdapter.$inject = ['$q', '$window', 'EnvConfig', 'GoogleMapsLoader', 'MapLibreLoader'];
    function FlightMapAdapter($q, $window, EnvConfig, GoogleMapsLoader, MapLibreLoader) {

        // Shared airspace category → colour (kept in sync with the legend in the
        // view + the backend `category` field; see BACKEND_ENDPOINT_SPEC_AIRSPACE.md).
        var AIRSPACE_COLOURS = {
            controlled: '#2563eb',   // blue
            atz:        '#16a34a',   // green
            danger:     '#f59e0b',   // amber
            restricted: '#dc2626',   // red
            prohibited: '#7f1d1d',   // dark red
            other:      '#64748b'    // grey
        };
        function airspaceColour(cat) { return AIRSPACE_COLOURS[cat] || AIRSPACE_COLOURS.other; }

        // ── Aircraft marker shapes ──────────────────────────────────────────
        // SVG path strings drawn in a -18..18 box, nose pointing UP (so the map
        // rotation by heading works). Shared by both providers so the marker looks
        // identical. Default 'ga' = top-down GA aircraft (SkyDemon-ish); 'arrow'
        // is the original dart, kept as a backup; 'jet' a sleeker swept silhouette.
        var MARKER_STYLE = 'ga';   // 'ga' | 'arrow' | 'jet'
        var MARKER_PATHS = {
            // High-wing GA: nose, straight wing, fuselage, tailplane + fin.
            ga: 'M0,-17 C1.6,-17 2.2,-14.5 2.2,-11.5 L2.2,-7 L17,-2.5 L17,1 L2.2,-2 ' +
                'L2.2,7 L6,11 L6,13.5 L0,12 L-6,13.5 L-6,11 L-2.2,7 L-2.2,-2 ' +
                'L-17,1 L-17,-2.5 L-2.2,-7 L-2.2,-11.5 C-2.2,-14.5 -1.6,-17 0,-17 Z',
            // Original chunky dart (backup).
            arrow: 'M0,-18 L5,-4 L16,8 L5,5 L2,16 L0,12 L-2,16 L-5,5 L-16,8 L-5,-4 Z',
            // Sleek swept-wing jet.
            jet: 'M0,-17 L2.5,-6 L16,4 L16,7 L2.5,1.5 L2,11 L6,14 L6,16 L0,14 ' +
                 'L-6,16 L-6,14 L-2,11 L-2.5,1.5 L-16,7 L-16,4 L-2.5,-6 Z'
        };
        function markerPath(style) { return MARKER_PATHS[style] || MARKER_PATHS.ga; }

        return {
            create: create,
            providerName: function () { return resolveProvider(); },
            AIRSPACE_COLOURS: AIRSPACE_COLOURS,
            airspaceColour: airspaceColour,
            // Read/override the aircraft marker style ('ga' | 'arrow' | 'jet').
            markerStyle: function (s) { if (s) MARKER_STYLE = s; return MARKER_STYLE; }
        };

        // ── Smooth the route with a Catmull-Rom spline ──────────────────────
        // Raw GPS fixes are ~10s apart, so straight segments make turns look
        // jagged. Catmull-Rom interpolates a smooth curve that PASSES THROUGH
        // every original fix, inserting `steps` points per segment. Each emitted
        // point keeps `seg` = the index of the original segment it belongs to, so
        // per-segment altitude colouring still works.
        //   points: [{lat, lon}], steps: subdivisions per segment (e.g. 8)
        //   → [{lat, lon, seg}]
        function smoothPath(points, steps) {
            if (!points || points.length < 3) {
                return (points || []).map(function (p, i) { return { lat: p.lat, lon: p.lon, seg: i }; });
            }
            steps = steps || 8;
            var out = [];
            var n = points.length;
            for (var i = 0; i < n - 1; i++) {
                var p0 = points[i - 1] || points[i];
                var p1 = points[i];
                var p2 = points[i + 1];
                var p3 = points[i + 2] || points[i + 1];
                for (var s = 0; s < steps; s++) {
                    var t = s / steps;
                    out.push({
                        lat: catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t),
                        lon: catmullRom(p0.lon, p1.lon, p2.lon, p3.lon, t),
                        seg: i
                    });
                }
            }
            // Ensure the very last fix is included exactly.
            out.push({ lat: points[n - 1].lat, lon: points[n - 1].lon, seg: n - 2 });
            return out;
        }

        // Centripetal-ish Catmull-Rom (uniform) for one coordinate.
        function catmullRom(a, b, c, d, t) {
            var t2 = t * t, t3 = t2 * t;
            return 0.5 * ((2 * b) +
                (-a + c) * t +
                (2 * a - 5 * b + 4 * c - d) * t2 +
                (-a + 3 * b - 3 * c + d) * t3);
        }

        // Resolve the effective provider. 'google' is only honoured when a real
        // key is configured; otherwise we fall back to the free MapLibre so the
        // feature always works.
        function resolveProvider() {
            var p = EnvConfig.getMapProvider();
            if (p === 'google') {
                var key = EnvConfig.getGoogleMapsKey();
                if (!key || key === 'REPLACE_WITH_GOOGLE_MAPS_KEY') return 'maplibre';
                return 'google';
            }
            return 'maplibre';
        }

        function create() {
            var provider = resolveProvider();
            if (provider === 'google') {
                return GoogleMapsLoader.load().then(function (gmaps) { return new GoogleAdapter(gmaps); });
            }
            return MapLibreLoader.load().then(function (ml) { return new MapLibreAdapter(ml, EnvConfig); });
        }

        // ════════════════════════════════════════════════
        // GOOGLE MAPS ADAPTER
        // ════════════════════════════════════════════════
        function GoogleAdapter(gmaps) {
            var self = this;
            var map = null, marker = null, pins = [];

            var MAP_STYLE = [
                { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] }
            ];

            self.init = function (el, opts) {
                map = new gmaps.Map(el, {
                    center: { lat: opts.center.lat, lng: opts.center.lon },
                    zoom: 13,
                    mapTypeId: 'terrain',
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    styles: MAP_STYLE
                });
            };

            self.drawRoute = function (points, colourFn) {
                // Smooth the track into curves; colour each sub-segment by the
                // original segment it came from.
                var sm = smoothPath(points, 8);
                for (var i = 0; i < sm.length - 1; i++) {
                    new gmaps.Polyline({
                        map: map,
                        path: [ll(sm[i]), ll(sm[i + 1])],
                        geodesic: true,
                        strokeColor: colourFn(sm[i].seg),
                        strokeOpacity: 0.95,
                        strokeWeight: 4
                    });
                }
            };

            self.addAircraftMarker = function (point, onDrag) {
                marker = new gmaps.Marker({
                    position: ll(point), map: map, zIndex: 9999, draggable: true,
                    icon: planeIcon(point.heading || 0)
                });
                if (onDrag) {
                    marker.addListener('drag', function (e) {
                        onDrag({ lat: e.latLng.lat(), lon: e.latLng.lng() });
                    });
                }
            };

            self.updateAircraftMarker = function (point) {
                if (!marker || !point || point.lat == null) return;
                marker.setPosition(ll(point));
                var icon = marker.getIcon();
                icon.rotation = point.heading || 0;
                marker.setIcon(icon);
            };

            self.setPins = function (list, onClick) {
                pins.forEach(function (m) { m.setMap(null); });
                pins = [];
                (list || []).forEach(function (pin) {
                    if (pin.lat == null || pin.lon == null) return;
                    var m = new gmaps.Marker({
                        position: ll(pin), map: map, title: pin.title || '',
                        icon: { path: gmaps.SymbolPath.CIRCLE, fillColor: pin.colour, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 7 }
                    });
                    m.addListener('click', function () { if (onClick) onClick(pin); });
                    pins.push(m);
                });
            };

            self.panTo = function (point) { if (map) map.panTo(ll(point)); };

            self.fitToTrack = function (points) {
                var b = new gmaps.LatLngBounds();
                points.forEach(function (p) { b.extend(ll(p)); });
                map.fitBounds(b, 40);
            };

            // Re-measure after the container size changes; keep the track framed.
            self.resize = function (points) {
                if (!map) return;
                gmaps.event.trigger(map, 'resize');
                if (points && points.length) self.fitToTrack(points);
            };

            // ── Airspace overlay (Google Data layer) ──
            var airspaceLayer = null, airspaceVisible = false, airspaceCats = null,
                airspaceOnClick = null, airspaceOnBgClick = null, bgClickWired = false;

            self.setAirspace = function (geojson, opts) {
                opts = opts || {};
                airspaceOnClick = opts.onClick || null;
                airspaceOnBgClick = opts.onBackgroundClick || null;
                airspaceCats = opts.categories || null;   // null = all on
                // Clicking the base map (not a feature) dismisses the info popup.
                if (!bgClickWired && map) {
                    bgClickWired = true;
                    map.addListener('click', function () { if (airspaceOnBgClick) airspaceOnBgClick(); });
                }
                if (!airspaceLayer) {
                    airspaceLayer = new gmaps.Data({ map: null });
                    airspaceLayer.setStyle(function (feature) {
                        var cat = feature.getProperty('category') || 'other';
                        var on = !airspaceCats || airspaceCats[cat];
                        return {
                            fillColor: airspaceColour(cat),
                            fillOpacity: on ? 0.12 : 0,
                            strokeColor: airspaceColour(cat),
                            strokeWeight: on ? 1.5 : 0,
                            strokeOpacity: on ? 0.9 : 0,
                            clickable: !!on,
                            zIndex: 2
                        };
                    });
                    airspaceLayer.addListener('click', function (e) {
                        if (airspaceOnClick) airspaceOnClick(propsOf(e.feature), e.latLng);
                    });
                }
                airspaceLayer.forEach(function (f) { airspaceLayer.remove(f); });
                if (geojson) airspaceLayer.addGeoJson(geojson);
                self.setAirspaceVisibility(airspaceVisible);
            };

            self.setAirspaceVisibility = function (visible) {
                airspaceVisible = !!visible;
                if (airspaceLayer) airspaceLayer.setMap(visible ? map : null);
            };

            self.setAirspaceCategories = function (categories) {
                airspaceCats = categories || null;
                if (airspaceLayer) airspaceLayer.setStyle(airspaceLayer.getStyle()); // re-eval styler
            };

            function propsOf(feature) {
                var o = {};
                ['name', 'category', 'type', 'icao_class', 'lower_label', 'upper_label'].forEach(function (k) {
                    o[k] = feature.getProperty(k);
                });
                return o;
            }

            self.destroy = function () {
                pins.forEach(function (m) { m.setMap(null); });
                if (airspaceLayer) airspaceLayer.setMap(null);
                pins = []; marker = null; map = null; airspaceLayer = null;
            };

            function ll(p) { return { lat: p.lat, lng: p.lon }; }
            function planeIcon(heading) {
                return {
                    path: markerPath(MARKER_STYLE),
                    fillColor: '#1e3a5f', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 1.4,
                    scale: 1, rotation: heading, anchor: new gmaps.Point(0, 0)
                };
            }
        }

        // ════════════════════════════════════════════════
        // MAPLIBRE GL ADAPTER
        // ════════════════════════════════════════════════
        function MapLibreAdapter(ml, EnvConfig) {
            var self = this;
            var map = null, marker = null, markerEl = null, pinMarkers = [], ready = false;
            var pending = [];   // ops queued until the style loads

            self.init = function (el, opts) {
                map = new ml.Map({
                    container: el,
                    style: styleSpec(),
                    center: [opts.center.lon, opts.center.lat],
                    zoom: 12,
                    attributionControl: true
                });
                map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
                map.on('load', function () {
                    ready = true;
                    pending.forEach(function (fn) { fn(); });
                    pending = [];
                });
            };

            function whenReady(fn) { if (ready) fn(); else pending.push(fn); }

            self.drawRoute = function (points, colourFn) {
                whenReady(function () {
                    // Smooth the track (Catmull-Rom), then build one GeoJSON line
                    // feature per ORIGINAL segment — each a short smooth curve of
                    // interpolated points — so per-segment altitude colour holds
                    // and turns render as curves rather than straight kinks.
                    var sm = smoothPath(points, 8);
                    var features = [];
                    var curSeg = -1, coords = null;
                    for (var k = 0; k < sm.length; k++) {
                        var pt = sm[k];
                        if (pt.seg !== curSeg) {
                            // Close the previous run and start a new coloured feature.
                            // Carry the last point over so segments join seamlessly.
                            if (coords && coords.length > 1) {
                                features.push({
                                    type: 'Feature',
                                    properties: { colour: colourFn(curSeg) },
                                    geometry: { type: 'LineString', coordinates: coords }
                                });
                            }
                            curSeg = pt.seg;
                            coords = (coords && coords.length) ? [coords[coords.length - 1]] : [];
                        }
                        coords.push([pt.lon, pt.lat]);
                    }
                    if (coords && coords.length > 1) {
                        features.push({
                            type: 'Feature',
                            properties: { colour: colourFn(curSeg) },
                            geometry: { type: 'LineString', coordinates: coords }
                        });
                    }
                    var data = { type: 'FeatureCollection', features: features };
                    if (map.getSource('fr-route')) {
                        map.getSource('fr-route').setData(data);
                    } else {
                        map.addSource('fr-route', { type: 'geojson', data: data });
                        map.addLayer({
                            id: 'fr-route', type: 'line', source: 'fr-route',
                            layout: { 'line-cap': 'round', 'line-join': 'round' },
                            paint: { 'line-color': ['get', 'colour'], 'line-width': 4, 'line-opacity': 0.95 }
                        });
                    }
                });
            };

            self.addAircraftMarker = function (point, onDrag) {
                whenReady(function () {
                    markerEl = document.createElement('div');
                    markerEl.className = 'fr-ml-plane';
                    markerEl.innerHTML = planeSvg();
                    marker = new ml.Marker({ element: markerEl, draggable: !!onDrag, rotationAlignment: 'map' })
                        .setLngLat([point.lon, point.lat])
                        .addTo(map);
                    setRotation(point.heading || 0);
                    if (onDrag) {
                        marker.on('drag', function () {
                            var p = marker.getLngLat();
                            onDrag({ lat: p.lat, lon: p.lng });
                        });
                    }
                });
            };

            self.updateAircraftMarker = function (point) {
                whenReady(function () {
                    if (!marker || !point || point.lat == null) return;
                    marker.setLngLat([point.lon, point.lat]);
                    setRotation(point.heading || 0);
                });
            };

            function setRotation(deg) {
                // Rotate via the marker (kept map-aligned) for a smooth heading.
                if (marker && marker.setRotation) marker.setRotation(deg);
            }

            self.setPins = function (list, onClick) {
                whenReady(function () {
                    pinMarkers.forEach(function (m) { m.remove(); });
                    pinMarkers = [];
                    (list || []).forEach(function (pin) {
                        if (pin.lat == null || pin.lon == null) return;
                        var el = document.createElement('div');
                        el.className = 'fr-ml-pin';
                        el.style.background = pin.colour;
                        el.title = pin.title || '';
                        el.addEventListener('click', function () { if (onClick) onClick(pin); });
                        var m = new ml.Marker({ element: el }).setLngLat([pin.lon, pin.lat]).addTo(map);
                        pinMarkers.push(m);
                    });
                });
            };

            self.panTo = function (point) { whenReady(function () { map.panTo([point.lon, point.lat]); }); };

            self.fitToTrack = function (points) {
                whenReady(function () {
                    var b = new ml.LngLatBounds();
                    points.forEach(function (p) { b.extend([p.lon, p.lat]); });
                    map.fitBounds(b, { padding: 48, duration: 0 });
                });
            };

            // Re-measure after the container size changes; keep the track framed.
            self.resize = function (points) {
                whenReady(function () {
                    map.resize();
                    if (points && points.length) self.fitToTrack(points);
                });
            };

            // ── Airspace overlay (MapLibre GeoJSON source + fill/line layers) ──
            var airspaceVisible = false, airspaceCats = null, airspaceOnClick = null,
                airspaceOnBgClick = null, airspaceData = null, bgClickWired = false;

            // Build a MapLibre 'match' expression: category → colour.
            function categoryColourExpr() {
                var expr = ['match', ['get', 'category']];
                Object.keys(AIRSPACE_COLOURS).forEach(function (cat) {
                    if (cat === 'other') return;
                    expr.push(cat, AIRSPACE_COLOURS[cat]);
                });
                expr.push(AIRSPACE_COLOURS.other);   // default
                return expr;
            }

            // Filter to only the enabled categories (null = all on).
            function categoryFilter() {
                if (!airspaceCats) return ['literal', true];
                var enabled = Object.keys(airspaceCats).filter(function (k) { return airspaceCats[k]; });
                if (!enabled.length) return ['==', ['get', 'category'], '__none__'];
                return ['in', ['get', 'category'], ['literal', enabled]];
            }

            self.setAirspace = function (geojson, opts) {
                opts = opts || {};
                airspaceOnClick = opts.onClick || null;
                airspaceOnBgClick = opts.onBackgroundClick || null;
                airspaceCats = opts.categories || null;
                airspaceData = geojson || { type: 'FeatureCollection', features: [] };
                whenReady(function () {
                    if (map.getSource('fr-airspace')) {
                        map.getSource('fr-airspace').setData(airspaceData);
                    } else {
                        map.addSource('fr-airspace', { type: 'geojson', data: airspaceData });
                        // Insert below the route line so the track stays on top.
                        var before = map.getLayer('fr-route') ? 'fr-route' : undefined;
                        map.addLayer({
                            id: 'fr-airspace-fill', type: 'fill', source: 'fr-airspace',
                            paint: { 'fill-color': categoryColourExpr(), 'fill-opacity': 0.12 }
                        }, before);
                        map.addLayer({
                            id: 'fr-airspace-line', type: 'line', source: 'fr-airspace',
                            paint: { 'line-color': categoryColourExpr(), 'line-width': 1.4, 'line-opacity': 0.9 }
                        }, before);
                        map.on('click', 'fr-airspace-fill', function (e) {
                            if (airspaceOnClick && e.features && e.features[0]) {
                                airspaceOnClick(e.features[0].properties, e.lngLat);
                            }
                        });
                        map.on('mouseenter', 'fr-airspace-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
                        map.on('mouseleave', 'fr-airspace-fill', function () { map.getCanvas().style.cursor = ''; });
                    }
                    // Clicking the base map (not on an airspace polygon) dismisses
                    // the info popup. Wire once.
                    if (!bgClickWired) {
                        bgClickWired = true;
                        map.on('click', function (e) {
                            var hits = map.queryRenderedFeatures(e.point, { layers: ['fr-airspace-fill'] });
                            if ((!hits || !hits.length) && airspaceOnBgClick) airspaceOnBgClick();
                        });
                    }
                    self.setAirspaceCategories(airspaceCats);
                    self.setAirspaceVisibility(airspaceVisible);
                });
            };

            self.setAirspaceVisibility = function (visible) {
                airspaceVisible = !!visible;
                whenReady(function () {
                    var v = visible ? 'visible' : 'none';
                    if (map.getLayer('fr-airspace-fill')) map.setLayoutProperty('fr-airspace-fill', 'visibility', v);
                    if (map.getLayer('fr-airspace-line')) map.setLayoutProperty('fr-airspace-line', 'visibility', v);
                });
            };

            self.setAirspaceCategories = function (categories) {
                airspaceCats = categories || null;
                whenReady(function () {
                    var f = categoryFilter();
                    if (map.getLayer('fr-airspace-fill')) map.setFilter('fr-airspace-fill', f);
                    if (map.getLayer('fr-airspace-line')) map.setFilter('fr-airspace-line', f);
                });
            };

            self.destroy = function () {
                pinMarkers.forEach(function (m) { m.remove(); });
                pinMarkers = [];
                if (marker) marker.remove();
                marker = null;
                if (map) { map.remove(); map = null; }
                ready = false; pending = [];
            };

            // A free OSM raster style (no key). A keyed vector style can be set
            // via EnvConfig.getMapLibreStyleUrl() later with no other change.
            function styleSpec() {
                var custom = EnvConfig.getMapLibreStyleUrl();
                if (custom) return custom;
                return {
                    version: 8,
                    sources: {
                        osm: {
                            type: 'raster',
                            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            attribution: '© OpenStreetMap contributors'
                        }
                    },
                    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
                };
            }

            function planeSvg() {
                return '<svg viewBox="-19 -19 38 38" width="36" height="36">' +
                    '<path d="' + markerPath(MARKER_STYLE) + '" ' +
                    'fill="#1e3a5f" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
            }
        }
    }
