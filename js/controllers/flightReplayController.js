// ─────────────────────────────────────────────────────
// FlightReplayController — per-flight replay / debrief view.
// One id drives everything: $stateParams.flight_id is a plane_log_sheets.id.
// Loads the replay payload, owns a single shared scrub position (currentIndex /
// currentTs) that the map marker, six-pack and height profile all follow, and
// supports play/pause with rAF interpolation between fixes for smoothness.
// Photos use the app's flow.js two-step staging (temp_path → AddPhoto).
// All derived series are backend-computed — we only render (see guide §2).
// ─────────────────────────────────────────────────────
app.controller('FlightReplayController', FlightReplayController);

    FlightReplayController.$inject = ['$scope', '$rootScope', '$state', '$stateParams', '$timeout', '$window', '$log',
        'FlightReplayService', 'FlightMapAdapter', 'ToastService'];
    function FlightReplayController($scope, $rootScope, $state, $stateParams, $timeout, $window, $log,
        FlightReplayService, FlightMapAdapter, ToastService) {

        var vm = this;

        vm.flight_id = $stateParams.flight_id;
        // ?src=sd → SkyDemon track behind a personal-logbook manual entry:
        // GPS-only (no instruments/G/temp/baro), no photos/notes/weather/airspace,
        // and flight_id is the manual entry id fed to the SD track endpoint.
        vm.isSD = ($stateParams.src === 'sd');
        vm.user = $rootScope.globals.currentUser;
        vm.loading = true;
        vm.error = null;            // 'forbidden' | 'notfound' | 'generic'
        vm.hasTrack = false;
        vm.trackNote = null;

        vm.flight = null;
        vm.summary = null;
        vm.baro = null;
        vm.track = [];
        vm.photos = [];
        vm.annotations = [];

        // ── Shared scrub state ──
        vm.currentIndex = 0;
        vm.currentPoint = null;     // bound into <flight-six-pack point="vm.currentPoint">
        vm.playing = false;
        vm.playbackRate = 8;        // replay speed multiplier (8×, 16×, 32×)
        vm.scrubMax = 0;            // = track.length - 1
        vm.mapAvailable = true;     // false → show graceful fallback
        vm.mapFullWidth = false;    // false = fit to page, true = fullscreen overlay
        vm.fsInstrumentsOpen = true; // fullscreen: instruments panel slid in (right)

        // ── Photo upload state (flow.js staging) ──
        vm.uploadingPhoto = false;
        vm.newPhotoCaption = '';

        // ── Add-note state ──
        vm.newNote = { body: '', kind: 'comment', pinHere: true };

        // ── Airspace overlay state ──
        vm.airspaceOn = false;          // layer DRAWN on the map?
        vm.airspacePanelOpen = false;   // legend PANEL visible? (independent of the layer)
        vm.airspaceLoading = false;
        vm.airspaceLoaded = false;      // GeoJSON fetched for this flight?
        vm.airspaceError = false;
        vm.airspaceMeta = null;         // { airac, effective_date, approximate }
        vm.airspaceCount = 0;
        vm.airspaceTip = null;          // hovered/clicked feature props for the popup
        vm.activeNote = null;           // the debrief note shown in the over-map card
        // Category legend (label + enabled). Keys match backend `category`.
        vm.airspaceCats = [
            { key: 'controlled', label: 'CTR / TMA / CTA', on: true },
            { key: 'atz',        label: 'ATZ / RMZ',       on: true },
            { key: 'danger',     label: 'Danger',          on: true },
            { key: 'restricted', label: 'Restricted',      on: true },
            { key: 'prohibited', label: 'Prohibited',      on: true },
            { key: 'other',      label: 'Other',           on: true }
        ];
        vm.airspaceColour = FlightMapAdapter.airspaceColour;

        var mapAdapter = null;     // provider-agnostic map (Google or MapLibre)
        var rafId = null, lastFrameTs = null;

        load();

        // ════════════════════════════════════════════════
        // LOAD
        // ════════════════════════════════════════════════
        function load() {
            vm.loading = true;
            var loadPromise = vm.isSD
                ? FlightReplayService.GetSkydemonReplay(vm.flight_id)
                : FlightReplayService.GetReplay(vm.flight_id);
            loadPromise.then(function (data) {
                vm.loading = false;
                if (!data || data.success === false) {
                    vm.error = (data && data.error === 'FORBIDDEN') ? 'forbidden' : 'generic';
                    return;
                }
                vm.flight = data.flight || null;
                vm.summary = data.summary || null;
                vm.baro = data.baro || null;
                vm.hasTrack = !!data.has_track;
                vm.trackNote = data.track_note || null;
                vm.track = data.track || [];
                vm.photos = data.photos || [];
                vm.annotations = data.annotations || [];

                vm.scrubMax = Math.max(0, vm.track.length - 1);
                vm.currentIndex = 0;
                vm.currentPoint = vm.track.length ? angular.copy(vm.track[0]) : null;

                groupAnnotations();

                if (vm.hasTrack && vm.track.length) {
                    // Defer until after this digest renders the ng-if blocks, so
                    // the #fr-map element exists in the DOM before we build on it.
                    $timeout(initMap);
                }
            });
        }

        // ════════════════════════════════════════════════
        // SCRUBBING
        // ════════════════════════════════════════════════
        // Set the current position to an exact track index (no interpolation).
        vm.seekToIndex = function (i) {
            i = Math.max(0, Math.min(vm.scrubMax, parseInt(i, 10) || 0));
            vm.currentIndex = i;
            vm.currentPoint = angular.copy(vm.track[i]);
            updateMarker(vm.currentPoint);
        };

        // Called by the range <input> (string value).
        vm.onScrub = function () {
            vm.pause();
            vm.seekToIndex(vm.currentIndex);
        };

        // Jump to the moment a max value occurred. metric ∈ 'alt' | 'gs' | 'g'.
        // Finds the track index that maximises the matching per-point field, then
        // seeks + pauses + centres the map there.
        vm.seekToExtreme = function (metric) {
            if (!vm.track.length) return;
            var valueAt = function (p) {
                if (metric === 'gs') return p.speed_kt;
                if (metric === 'g') return p.g;
                // altitude — match what the altimeter/profile show (recommended).
                return (p.alt_recommended_ft != null) ? p.alt_recommended_ft : p.alt_ft;
            };
            var best = 0, bestVal = -Infinity;
            for (var i = 0; i < vm.track.length; i++) {
                var v = valueAt(vm.track[i]);
                if (v != null && v > bestVal) { bestVal = v; best = i; }
            }
            vm.pause();
            vm.seekToIndex(best);
            if (mapAdapter && vm.currentPoint) mapAdapter.panTo(vm.currentPoint);
        };

        // Seek to the nearest fix at/just before a unix timestamp (used when a
        // photo or timeline note is clicked).
        vm.seekToTs = function (ts) {
            if (!ts || !vm.track.length) return;
            var best = 0;
            for (var i = 0; i < vm.track.length; i++) {
                if (vm.track[i].ts && vm.track[i].ts <= ts) best = i; else break;
            }
            vm.pause();
            vm.seekToIndex(best);
            if (mapAdapter && vm.currentPoint) mapAdapter.panTo(vm.currentPoint);
        };

        // Seek to a timeline annotation's pinned moment AND surface the note in a
        // dismissible card over the map so the reader sees what it says.
        vm.seekToAnnotation = function (an) {
            if (an && an.at_time) vm.seekToTs(toTs(an.at_time));
            vm.showNote(an);
        };

        // Show / hide the over-map note card.
        vm.showNote = function (an) { vm.activeNote = an || null; };
        vm.closeNote = function () { vm.activeNote = null; };

        // ════════════════════════════════════════════════
        // PLAYBACK (rAF interpolation between ~10s fixes)
        // ════════════════════════════════════════════════
        vm.togglePlay = function () { vm.playing ? vm.pause() : vm.play(); };

        vm.play = function () {
            if (!vm.track.length) return;
            if (vm.currentIndex >= vm.scrubMax) vm.currentIndex = 0;   // restart from the top
            vm.playing = true;
            lastFrameTs = null;
            rafId = $window.requestAnimationFrame(step);
        };

        vm.pause = function () {
            vm.playing = false;
            if (rafId) { $window.cancelAnimationFrame(rafId); rafId = null; }
        };

        vm.setRate = function (r) { vm.playbackRate = r; };

        // A fractional cursor along the track (so we can interpolate between fixes).
        var cursor = 0;   // float index

        function step(frameTs) {
            if (!vm.playing) return;
            if (lastFrameTs == null) { lastFrameTs = frameTs; cursor = vm.currentIndex; }
            var dtMs = frameTs - lastFrameTs;
            lastFrameTs = frameTs;

            // Advance the cursor using real elapsed time between fixes × rate.
            var i = Math.floor(cursor);
            var next = Math.min(vm.scrubMax, i + 1);
            var segSec = segmentSeconds(i, next);
            if (segSec <= 0) segSec = 10;   // fallback if timestamps missing
            var fracPerMs = (vm.playbackRate / 1000) / segSec;
            cursor += dtMs * fracPerMs;

            if (cursor >= vm.scrubMax) {
                cursor = vm.scrubMax;
                applyCursor();
                vm.pause();
                $scope.$applyAsync();
                return;
            }

            applyCursor();
            // Push scope updates ~ each frame; AngularJS digests are cheap here.
            $scope.$applyAsync();
            rafId = $window.requestAnimationFrame(step);
        }

        function segmentSeconds(i, j) {
            var a = vm.track[i], b = vm.track[j];
            if (a && b && a.ts && b.ts) return Math.max(0.1, b.ts - a.ts);
            if (a && b && a.elapsed_s != null && b.elapsed_s != null) return Math.max(0.1, b.elapsed_s - a.elapsed_s);
            return 10;
        }

        // Interpolate lat/lon/heading and all numeric fields at the float cursor.
        function applyCursor() {
            var i = Math.floor(cursor);
            var frac = cursor - i;
            var a = vm.track[i];
            var b = vm.track[Math.min(vm.scrubMax, i + 1)];
            vm.currentIndex = Math.round(cursor);
            vm.currentPoint = interpolate(a, b, frac);
            updateMarker(vm.currentPoint);
        }

        function lerp(a, b, f) { return a + (b - a) * f; }

        function interpolate(a, b, f) {
            if (!a) return null;
            if (!b || a === b) return angular.copy(a);
            var p = angular.copy(a);
            ['lat', 'lon', 'alt_ft', 'alt_recommended_ft', 'speed_kt', 'vspeed_fpm',
             'turn_rate_dps', 'bank_est_deg', 'pitch_est_deg', 'g', 'temp_c', 'dist_nm'
            ].forEach(function (k) {
                if (typeof a[k] === 'number' && typeof b[k] === 'number') p[k] = lerp(a[k], b[k], f);
            });
            // Heading: shortest-arc interpolation across the 0/360 wrap.
            if (typeof a.heading === 'number' && typeof b.heading === 'number') {
                var d = ((b.heading - a.heading + 540) % 360) - 180;
                p.heading = (a.heading + d * f + 360) % 360;
            }
            return p;
        }

        // ════════════════════════════════════════════════
        // MAP  (provider-agnostic via FlightMapAdapter — Google or MapLibre)
        // ════════════════════════════════════════════════
        function initMap() {
            var el = document.getElementById('fr-map');
            if (!el) { vm.mapAvailable = false; return; }

            var path = trackPath();
            if (!path.length) { vm.mapAvailable = false; return; }

            FlightMapAdapter.create().then(function (adapter) {
                mapAdapter = adapter;
                try {
                    adapter.init(el, { center: path[Math.floor(path.length / 2)], points: path });
                    adapter.drawRoute(path, segmentColour);
                    adapter.fitToTrack(path);

                    // Rotating, draggable aircraft marker. Drag → nearest fix.
                    adapter.addAircraftMarker(path[0], function (latlon) {
                        var idx = nearestIndexTo(latlon.lat, latlon.lon);
                        $scope.$applyAsync(function () { vm.pause(); vm.seekToIndex(idx); });
                    });

                    refreshPins();

                    // Re-apply airspace if it was already fetched (e.g. toggled on
                    // before the map finished initialising).
                    if (vm.airspaceLoaded && _airspaceGeojson) applyAirspace();

                    // Place the marker at the current scrub position.
                    if (vm.currentPoint) adapter.updateAircraftMarker(vm.currentPoint);

                    vm.mapAvailable = true;
                } catch (e) {
                    $log.error('Flight replay: map init failed', e);
                    mapAdapter = null;
                    vm.mapAvailable = false;
                }
            }, function (err) {
                // No provider available (e.g. Google chosen but no key, or the
                // map library CDN was blocked) — show the fallback panel; the
                // gauges + height profile still work.
                $log.warn('Flight replay: map provider unavailable', err);
                vm.mapAvailable = false;
            });
        }

        // Toggle the map between page-fit and full-viewport-width. After the CSS
        // changes the container size, tell the map to re-measure + re-fit (next
        // tick, once the DOM has reflowed).
        vm.toggleMapWidth = function () {
            vm.mapFullWidth = !vm.mapFullWidth;
            setBodyScrollLock(vm.mapFullWidth);
            $timeout(function () {
                if (mapAdapter && mapAdapter.resize) mapAdapter.resize(trackPath());
            }, 60);
            // Tell the height-profile chart to re-measure its (now resized) container.
            $scope.$broadcast('fr-profile-resize');
        };

        // Fullscreen: slide the instruments panel in/out from the right.
        vm.toggleInstruments = function () {
            vm.fsInstrumentsOpen = !vm.fsInstrumentsOpen;
        };

        // Lock/unlock background page scroll while the map is fullscreen.
        function setBodyScrollLock(locked) {
            var body = $window.document && $window.document.body;
            if (!body) return;
            if (locked) body.classList.add('fr-no-scroll');
            else body.classList.remove('fr-no-scroll');
        }

        // The dashboard ui-view wrapper (#dashboard_bit.centre_align_boxes2) caps
        // width (~1150px) for the tile menus. Flag it while this page is shown so
        // CSS can let the replay use the full width; removed on $destroy.
        function setWrapperWide(on) {
            var doc = $window.document;
            var wrap = doc && doc.getElementById('dashboard_bit');
            if (!wrap) return;
            if (on) wrap.classList.add('fr-wide-host');
            else wrap.classList.remove('fr-wide-host');
        }
        setWrapperWide(true);

        // Track reduced to {lat, lon, heading} points with valid coords.
        function trackPath() {
            return vm.track
                .filter(function (p) { return p.lat != null && p.lon != null; })
                .map(function (p) { return { lat: p.lat, lon: p.lon, heading: p.heading }; });
        }

        // Colour for the route segment starting at track index i, graded by the
        // recommended altitude across the whole flight.
        var _altLo = null, _altHi = null;
        function segmentColour(i) {
            if (_altLo === null) {
                var alts = vm.track.map(function (p) {
                    var a = p.alt_recommended_ft; if (a == null) a = p.alt_ft; return a || 0;
                });
                _altLo = Math.min.apply(null, alts);
                _altHi = Math.max.apply(null, alts);
            }
            var span = (_altHi - _altLo) || 1;
            var a = vm.track[i] ? (vm.track[i].alt_recommended_ft != null ? vm.track[i].alt_recommended_ft : vm.track[i].alt_ft) : 0;
            return altColour(((a || 0) - _altLo) / span);
        }

        // Blue (low) → cyan → green → amber → red (high).
        function altColour(f) {
            f = Math.max(0, Math.min(1, f));
            var stops = ['#2563eb', '#06b6d4', '#16a34a', '#f59e0b', '#dc2626'];
            var seg = f * (stops.length - 1);
            var i = Math.floor(seg);
            if (i >= stops.length - 1) return stops[stops.length - 1];
            return mix(stops[i], stops[i + 1], seg - i);
        }
        function mix(c1, c2, f) {
            var a = hex(c1), b = hex(c2);
            return 'rgb(' + Math.round(lerp(a[0], b[0], f)) + ',' +
                Math.round(lerp(a[1], b[1], f)) + ',' + Math.round(lerp(a[2], b[2], f)) + ')';
        }
        function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }

        // Move/rotate the aircraft marker to a scrubbed point (delegates to the
        // adapter, which handles provider-specific rotation).
        function updateMarker(p) {
            if (mapAdapter && p && p.lat != null) mapAdapter.updateAircraftMarker(p);
        }

        function nearestIndexTo(lat, lon) {
            var best = 0, bestD = Infinity;
            for (var i = 0; i < vm.track.length; i++) {
                var t = vm.track[i];
                if (t.lat == null) continue;
                var d = (t.lat - lat) * (t.lat - lat) + (t.lon - lon) * (t.lon - lon);
                if (d < bestD) { bestD = d; best = i; }
            }
            return best;
        }

        // Rebuild photo + annotation pins from current vm state. Provider-agnostic:
        // the adapter renders them. Photo pins seek to the photo; note pins seek to
        // the note's moment.
        function refreshPins() {
            if (!mapAdapter) return;
            var pins = [];

            (vm.photos || []).forEach(function (ph) {
                if (ph.latitude == null || ph.longitude == null) return;
                pins.push({
                    lat: ph.latitude, lon: ph.longitude, colour: '#2d5a8e',
                    title: ph.caption || ph.file_name,
                    onClick: function () { $scope.$applyAsync(function () { vm.openPhoto(ph); }); }
                });
            });

            (vm.annotations || []).forEach(function (an) {
                if (an.latitude == null || an.longitude == null) return;
                pins.push({
                    lat: an.latitude, lon: an.longitude,
                    colour: an.is_instructor_note ? '#16a34a' : '#f59e0b',
                    title: an.body,
                    onClick: function () { $scope.$applyAsync(function () {
                        if (an.at_time) vm.seekToTs(toTs(an.at_time));
                        vm.showNote(an);
                    }); }
                });
            });

            mapAdapter.setPins(pins, function (pin) { if (pin.onClick) pin.onClick(); });
        }

        // ════════════════════════════════════════════════
        // AIRSPACE OVERLAY (openAIP, AIRAC-locked to the flight date)
        // ════════════════════════════════════════════════
        var _airspaceGeojson = null;

        // The "Airspace" button toggles the legend PANEL open/closed. Opening it
        // also turns the layer on (lazy-loading the GeoJSON the first time);
        // collapsing the panel leaves the layer exactly as it is, so you can hide
        // the menu without hiding the airspace.
        vm.toggleAirspacePanel = function () {
            vm.airspacePanelOpen = !vm.airspacePanelOpen;
            if (vm.airspacePanelOpen) {
                if (!vm.airspaceOn) { vm.airspaceOn = true; if (mapAdapter) mapAdapter.setAirspaceVisibility(true); }
                if (!vm.airspaceLoaded) loadAirspace();
            }
        };

        // The eye toggle (inside the panel) shows/hides the drawn layer WITHOUT
        // closing the panel.
        vm.toggleAirspaceLayer = function () {
            vm.airspaceOn = !vm.airspaceOn;
            if (vm.airspaceOn && !vm.airspaceLoaded) loadAirspace();
            else if (mapAdapter) mapAdapter.setAirspaceVisibility(vm.airspaceOn);
        };

        function loadAirspace() {
            // Note: do NOT set vm.airspaceOn = false on error — that would snap the
            // panel shut before the user can see the error / retry. Leave the panel
            // open; show the error state inside it instead.
            if (!vm.flight || !vm.track.length) { vm.airspaceError = true; return; }
            var bbox = trackBbox();
            if (!bbox) { vm.airspaceError = true; return; }

            vm.airspaceLoading = true;
            vm.airspaceError = false;
            FlightReplayService.GetAirspace(vm.flight.flight_date, bbox).then(function (data) {
                vm.airspaceLoading = false;
                if (!data || data.success === false || !data.features) {
                    vm.airspaceError = true;
                    return;
                }
                _airspaceGeojson = { type: 'FeatureCollection', features: data.features };
                vm.airspaceCount = data.features.length;
                vm.airspaceMeta = {
                    airac: data.airac || null,
                    effective_date: data.effective_date || null,
                    approximate: !!data.approximate
                };
                vm.airspaceLoaded = true;
                applyAirspace();
            }, function () {
                vm.airspaceLoading = false;
                vm.airspaceError = true;
            });
        }

        // Retry after a failed load (from the error panel).
        vm.retryAirspace = function () {
            vm.airspaceError = false;
            loadAirspace();
        };

        // Push the GeoJSON + current category filter + visibility to the adapter.
        function applyAirspace() {
            if (!mapAdapter || !_airspaceGeojson) return;
            mapAdapter.setAirspace(_airspaceGeojson, {
                categories: categoryMap(),
                onClick: function (props) {
                    $scope.$applyAsync(function () { vm.airspaceTip = props; });
                },
                onBackgroundClick: function () {
                    $scope.$applyAsync(function () { vm.airspaceTip = null; });
                }
            });
            mapAdapter.setAirspaceVisibility(vm.airspaceOn);
        }

        // Legend array → { category: bool } map for the adapter filter.
        function categoryMap() {
            var m = {};
            vm.airspaceCats.forEach(function (c) { m[c.key] = !!c.on; });
            return m;
        }

        // Called when a legend category checkbox flips.
        vm.onAirspaceCategoryChange = function () {
            if (mapAdapter && vm.airspaceLoaded) mapAdapter.setAirspaceCategories(categoryMap());
        };

        vm.closeAirspaceTip = function () { vm.airspaceTip = null; };

        // Padded bounding box of the track for the airspace query.
        function trackBbox() {
            var pts = vm.track.filter(function (p) { return p.lat != null && p.lon != null; });
            if (!pts.length) return null;
            var minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
            pts.forEach(function (p) {
                if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
                if (p.lon < minLon) minLon = p.lon; if (p.lon > maxLon) maxLon = p.lon;
            });
            var pad = 0.2;   // ~12 nm of margin so nearby airspace is included
            return { minLon: minLon - pad, minLat: minLat - pad, maxLon: maxLon + pad, maxLat: maxLat + pad };
        }

        // ════════════════════════════════════════════════
        // PHOTOS
        // ════════════════════════════════════════════════
        vm.photoSrc = function (ph) { return FlightReplayService.PhotoUrl(ph.url); };

        // Photo `url`s are signed + expire after ~1h. When an <img> 403s (stale
        // signature), re-fetch the replay to mint fresh URLs. De-bounced so a grid
        // of expired thumbnails triggers a SINGLE refresh, not one per image.
        var _photoRefreshing = false;
        vm.onPhotoUrlExpired = function () {
            if (_photoRefreshing) return;
            _photoRefreshing = true;
            FlightReplayService.GetReplay(vm.flight_id).then(function (data) {
                _photoRefreshing = false;
                if (!data || data.success === false) return;
                vm.photos = data.photos || [];
                vm.annotations = data.annotations || [];
                groupAnnotations();
                refreshPins();
                // If the lightbox is open, swap in the refreshed copy of that photo.
                if (vm.selectedPhoto) {
                    var match = vm.photos.filter(function (p) { return p.id === vm.selectedPhoto.id; })[0];
                    vm.selectedPhoto = match || null;
                }
            }, function () { _photoRefreshing = false; });
        };

        vm.selectedPhoto = null;
        vm.openPhoto = function (ph) {
            vm.selectedPhoto = ph;
            if (ph.taken_at) vm.seekToTs(toTs(ph.taken_at));
        };
        vm.closePhoto = function () { vm.selectedPhoto = null; };

        // flow.js callbacks (wired in the view, same pattern as plane documents).
        // Stage to temp/, then register the photo against the flight.
        vm.onPhotoStaged = function (flowFiles) {
            if (!flowFiles || !flowFiles.length) return;
            var f = flowFiles[flowFiles.length - 1];
            var parsed;
            try { parsed = JSON.parse(f.file_return); } catch (e) { parsed = null; }
            if (!parsed || !parsed.saved_url) {
                ToastService.error('Upload failed', 'The photo could not be staged.');
                return;
            }
            var payload = {
                temp_path: parsed.saved_url,
                file_name: f.name,
                caption: vm.newPhotoCaption || ''
            };
            // If we're scrubbed to a point, pin the photo there by time + position.
            if (vm.currentPoint) {
                if (vm.currentPoint.t) payload.taken_at = vm.currentPoint.t;
                payload.latitude = vm.currentPoint.lat;
                payload.longitude = vm.currentPoint.lon;
            }
            vm.uploadingPhoto = true;
            FlightReplayService.AddPhoto(vm.flight_id, payload).then(function (res) {
                vm.uploadingPhoto = false;
                if (res && res.success) {
                    ToastService.success('Photo added', 'Your photo has been pinned to the flight.');
                    vm.newPhotoCaption = '';
                    reloadOverlays();
                } else {
                    ToastService.error('Upload failed', (res && res.message) || 'Please try again.');
                }
            });
        };

        vm.deletePhoto = function (ph) {
            FlightReplayService.DeletePhoto(vm.flight_id, ph.id).then(function (res) {
                if (res && res.success) {
                    ToastService.success('Photo removed', '');
                    if (vm.selectedPhoto && vm.selectedPhoto.id === ph.id) vm.selectedPhoto = null;
                    reloadOverlays();
                } else {
                    ToastService.error('Could not remove', (res && res.message) || '');
                }
            });
        };

        vm.canDeletePhoto = function (ph) {
            return ph && (ph.uploaded_by === vm.user.id || isManagerOrInstructor());
        };

        // ════════════════════════════════════════════════
        // ANNOTATIONS
        // ════════════════════════════════════════════════
        vm.flightNotes = [];      // whole-flight (no at_time)
        vm.timelineNotes = [];    // with at_time, sorted

        function groupAnnotations() {
            vm.flightNotes = [];
            vm.timelineNotes = [];
            (vm.annotations || []).forEach(function (a) {
                if (a.at_time) vm.timelineNotes.push(a); else vm.flightNotes.push(a);
            });
            vm.timelineNotes.sort(function (x, y) { return toTs(x.at_time) - toTs(y.at_time); });
        }

        vm.addNote = function () {
            var body = (vm.newNote.body || '').trim();
            if (!body) { ToastService.warning('Empty note', 'Type something first.'); return; }
            var payload = { body: body, kind: vm.newNote.kind || 'comment' };
            // Pin to the current scrub moment if requested and we have a track.
            if (vm.newNote.pinHere && vm.currentPoint) {
                if (vm.currentPoint.t) payload.at_time = vm.currentPoint.t;
                payload.latitude = vm.currentPoint.lat;
                payload.longitude = vm.currentPoint.lon;
            }
            vm.savingNote = true;
            FlightReplayService.AddAnnotation(vm.flight_id, payload).then(function (res) {
                vm.savingNote = false;
                if (res && res.success) {
                    ToastService.success('Note added', '');
                    vm.newNote.body = '';
                    reloadOverlays();
                } else {
                    ToastService.error('Could not add note', (res && res.message) || '');
                }
            });
        };

        vm.deleteNote = function (an) {
            FlightReplayService.DeleteAnnotation(vm.flight_id, an.id).then(function (res) {
                if (res && res.success) { reloadOverlays(); }
                else ToastService.error('Could not delete', (res && res.message) || '');
            });
        };

        vm.canDeleteNote = function (an) {
            return an && (an.author_id === vm.user.id || isManagerOrInstructor());
        };

        // Re-fetch just the overlays (photos + annotations) after a mutation, so
        // backend-derived positions / instructor flags come back authoritative.
        function reloadOverlays() {
            FlightReplayService.GetReplay(vm.flight_id).then(function (data) {
                if (!data || data.success === false) return;
                vm.photos = data.photos || [];
                vm.annotations = data.annotations || [];
                groupAnnotations();
                refreshPins();
            });
        }

        // ════════════════════════════════════════════════
        // HELPERS
        // ════════════════════════════════════════════════
        function isManagerOrInstructor() {
            if (!vm.flight || !vm.user || !vm.user.access) return false;
            var cid = vm.flight.club_id;
            var mgr = vm.user.access.manager || [];
            var inst = vm.user.access.instructor || [];
            return mgr.indexOf(cid) > -1 || inst.indexOf(cid) > -1;
        }

        function toTs(str) {
            if (!str) return 0;
            // "YYYY-MM-DD HH:MM:SS" UTC → unix seconds.
            var iso = str.replace(' ', 'T') + 'Z';
            var t = Date.parse(iso);
            return isNaN(t) ? 0 : Math.floor(t / 1000);
        }

        // Elapsed seconds → "M:SS" for the scrubber readout.
        vm.fmtElapsed = function () {
            var p = vm.currentPoint;
            var s = p && p.elapsed_s != null ? p.elapsed_s : 0;
            var m = Math.floor(s / 60), sec = Math.round(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        };

        vm.altSourceLabel = function () {
            if (!vm.baro) return vm.isSD ? 'GPS (SkyDemon)' : '';
            if (vm.baro.working) {
                return 'Baro' + (vm.baro.datum_ft != null ? ' (cal. ' + Math.round(vm.baro.datum_ft) + ' ft)' : '');
            }
            return 'GPS altitude';
        };

        vm.back = function () {
            if ($rootScope.safeBack) $rootScope.safeBack();
            else $state.go('dashboard.my_account.logbook');
        };

        // Stop playback and tear down the map when leaving the view.
        $scope.$on('$destroy', function () {
            vm.pause();
            setBodyScrollLock(false);   // never leave the page scroll-locked
            setWrapperWide(false);      // restore the dashboard wrapper width cap
            if (mapAdapter && mapAdapter.destroy) { mapAdapter.destroy(); mapAdapter = null; }
        });
    }
