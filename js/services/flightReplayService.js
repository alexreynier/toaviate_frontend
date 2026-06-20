// ─────────────────────────────────────────────────────
// FlightReplayService — per-flight replay / debrief data.
// Every endpoint is keyed by a plane_log_sheets.id ("flight_id") and is
// access-controlled server-side (caller must have been aboard or be a club
// manager/instructor). On denial the payload is { success:false, error:'FORBIDDEN' }.
// See FRONTEND_FLIGHT_REPLAY_GUIDE.md for the full contract.
// Matches the app convention: app.factory + .then(handleSuccess, handleError2).
// ─────────────────────────────────────────────────────
app.factory('FlightReplayService', FlightReplayService);

    FlightReplayService.$inject = ['$http', '$location', 'EnvConfig'];
    function FlightReplayService($http, $location, EnvConfig) {

        var base = '/api/v1/flight_replay';
        var service = {};

        // Full replay payload: flight header, summary, baro quality, track[],
        // photos[], annotations[].
        service.GetReplay = function(flight_id) {
            return $http.get(base + '/' + flight_id).then(handleSuccess, handleError2);
        };

        // Lightweight header + has_track (no CSV parse) — for list hovers.
        service.GetMeta = function(flight_id) {
            return $http.get(base + '/' + flight_id + '/meta').then(handleSuccess, handleError2);
        };

        // ── Photos ──
        service.AddPhoto = function(flight_id, payload) {
            return $http.post(base + '/' + flight_id + '/photo', payload).then(handleSuccess, handleError2);
        };
        service.UpdatePhoto = function(flight_id, photo_id, payload) {
            return $http.put(base + '/' + flight_id + '/photo/' + photo_id, payload).then(handleSuccess, handleError2);
        };
        service.DeletePhoto = function(flight_id, photo_id) {
            return $http.delete(base + '/' + flight_id + '/photo/' + photo_id).then(handleSuccess, handleError2);
        };

        // ── Annotations (comments / coaching notes) ──
        service.AddAnnotation = function(flight_id, payload) {
            return $http.post(base + '/' + flight_id + '/annotation', payload).then(handleSuccess, handleError2);
        };
        service.UpdateAnnotation = function(flight_id, id, payload) {
            return $http.put(base + '/' + flight_id + '/annotation/' + id, payload).then(handleSuccess, handleError2);
        };
        service.DeleteAnnotation = function(flight_id, id) {
            return $http.delete(base + '/' + flight_id + '/annotation/' + id).then(handleSuccess, handleError2);
        };

        // Airspace overlay (openAIP, AIRAC-versioned). Returns a GeoJSON
        // FeatureCollection of airspace volumes in force on `date` within `bbox`.
        // date: 'YYYY-MM-DD' (the flight date — locks the airspace version).
        // bbox: { minLon, minLat, maxLon, maxLat }. See BACKEND_ENDPOINT_SPEC_AIRSPACE.md.
        service.GetAirspace = function(date, bbox) {
            var qs = '?date=' + encodeURIComponent(date) +
                '&bbox=' + [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].join(',');
            return $http.get('/api/v1/airspace' + qs).then(function(res) {
                return normaliseAirspace(res.data);
            }, handleError2);
        };

        // The backend returns its own shape:
        //   { success, date, airac_cycle, effective:{from,to}, count, volumes:[ {
        //       name, airspace_class, type_code, lower_limit_ft, lower_ref,
        //       upper_limit_ft, upper_ref, geometry, ... } ] }
        // The controller + map adapter expect a GeoJSON-ish payload:
        //   { success, airac, effective_date, approximate, features:[ {
        //       type:'Feature', geometry, properties:{ name, category, type,
        //       icao_class, lower_label, upper_label, ... } } ] }
        // Adapt here so the rest of the app stays unchanged.
        function normaliseAirspace(data) {
            if (!data || data.success === false) {
                return { success: false, message: (data && data.message) || 'Could not load airspace.' };
            }
            var volumes = data.volumes || [];
            var features = volumes.map(function(v) {
                return {
                    type: 'Feature',
                    geometry: v.geometry,
                    properties: {
                        id: v.id,
                        name: v.name,
                        category: airspaceCategory(v.type_code),
                        type: v.type_code,
                        icao_class: v.airspace_class || null,
                        lower_label: vertLabel(v.lower_limit_ft, v.lower_ref),
                        upper_label: vertLabel(v.upper_limit_ft, v.upper_ref),
                        lower_ft: v.lower_limit_ft,
                        upper_ft: v.upper_limit_ft,
                        country: v.country_code
                    }
                };
            });
            return {
                success: true,
                type: 'FeatureCollection',
                features: features,
                airac: data.airac_cycle || null,
                effective_date: (data.effective && data.effective.from) || null,
                approximate: !!data.approximate
            };
        }

        // Map the backend type_code → the frontend's 6 legend categories.
        function airspaceCategory(typeCode) {
            switch ((typeCode || '').toUpperCase()) {
                case 'CTR': case 'CTA': case 'TMA': case 'TMZ': return 'controlled';
                case 'ATZ': case 'RMZ': return 'atz';
                case 'D': case 'DANGER': return 'danger';
                case 'R': case 'RESTRICTED': return 'restricted';
                case 'P': case 'PROHIBITED': return 'prohibited';
                default: return 'other';
            }
        }

        // Build a human vertical-limit label from feet + reference.
        //   SFC/GND → "SFC"; FL → "FL085"; AMSL/MSL → "2080 ft"; UNL → "UNL".
        function vertLabel(ft, ref) {
            ref = (ref || '').toUpperCase();
            if (ref === 'SFC' || ref === 'GND') return 'SFC';
            if (ref === 'UNL') return 'UNL';
            if (ref === 'FL' || ref === 'STD') {
                var fl = Math.round((ft || 0) / 100);
                return 'FL' + (fl < 100 ? ('0' + fl).slice(-3) : fl);
            }
            if (ft === 0) return 'SFC';
            return (ft != null ? ft : '—') + ' ft';
        }

        // Absolute URL for a photo's binary (payload gives a relative `url` like
        // "flight_replay/photo/7"). Prepend the per-env API base so it works as
        // an <img src> regardless of the active environment.
        service.PhotoUrl = function(relativeUrl) {
            if (!relativeUrl) return '';
            if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
            var clean = relativeUrl.charAt(0) === '/' ? relativeUrl : '/' + relativeUrl;
            // The replay payload uses paths like "flight_replay/photo/7" (no
            // /api/v1 prefix), so add it if it isn't already there.
            if (clean.indexOf('/api/') !== 0) clean = '/api/v1' + clean;
            return EnvConfig.getApiBaseUrl() + clean;
        };

        return service;

        function handleSuccess(res) { return res.data; }
        function handleError2(res) {
            if (res && res.status == 401) { $location.path('/login'); }
            var data = res && res.data;
            return {
                success: false,
                error: data ? data.error : null,
                message: data ? (data.message || data.error) : 'Request failed',
                status: res ? res.status : 0
            };
        }
    }
