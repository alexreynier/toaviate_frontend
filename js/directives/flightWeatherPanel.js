// ─────────────────────────────────────────────────────────────────────────
// flightWeatherPanel — stored METAR/TAF snapshots for a completed flight
// (FRONTEND_FLIGHT_WEATHER_GUIDE.md). One shared component, mounted from the
// personal logbook, journey logbooks, flight replay and the training-record
// flight popup:
//
//   <flight-weather-panel flight-id="e.ref_id"
//                         dep-name="vm.flight.departure_airport"    (optional)
//                         arr-name="vm.flight.destination_airport"> (optional)
//
// `flight-id` is always a plane_log_sheets.id. The directive fetches via
// FlightWeatherService (cached per flight — rows are immutable once stored),
// so it is lazy by construction: mount it behind an ng-if and the request
// only fires when the drawer/popup opens. All datetimes from the API are UTC
// strings — rendered with a Z suffix, never timezone-shifted.
//
// Companion: <wx-chip row="row"> — tiny category pill + wind summary reusing
// the same row shape (logbook rows / booking lists).
// ─────────────────────────────────────────────────────────────────────────
app.directive('flightWeatherPanel', ['FlightWeatherService', 'ToastService', '$timeout', function (FlightWeatherService, ToastService, $timeout) {
    return {
        restrict: 'E',
        scope: {
            flightId: '=',
            depName:  '=?',   // display name for the departure airfield (else the ICAO code)
            arrName:  '=?'    // display name for the arrival airfield
        },
        templateUrl: 'js/directives/flightWeatherPanel.html',
        link: function (scope) {

            scope.state = 'loading';   // loading | error | empty | ready
            scope.phases = [];

            var reducedMotion = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // ── UTC string helpers ("YYYY-MM-DD HH:MM:SS", never shifted) ──

            function parseUTC(s) {
                if (!s) { return null; }
                var m = String(s).split(/[^0-9]/);
                if (m.length < 5) { return null; }
                return Date.UTC(+m[0], +m[1] - 1, +m[2], +m[3], +m[4], +(m[5] || 0));
            }

            scope.fmtZ = function (s) {                       // "12:23Z"
                return s ? String(s).substr(11, 5) + 'Z' : '';
            };

            scope.fmtDayZ = function (s) {                    // "11/12Z"
                return s ? String(s).substr(8, 2) + '/' + String(s).substr(11, 2) + 'Z' : '';
            };

            function fmtUnixDayZ(sec) {                       // unix seconds → "11/12Z"
                if (!sec) { return ''; }
                var d = new Date(sec * 1000);
                return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCHours()) + 'Z';
            }

            function pad2(n) { return (n < 10 ? '0' : '') + n; }

            // ── Load ──

            scope.load = function (force) {
                if (!scope.flightId) { return; }
                scope.state = 'loading';
                FlightWeatherService.GetForFlight(scope.flightId, force).then(function (data) {
                    if (!data || data.success === false) {
                        scope.state = 'error';
                        return;
                    }
                    buildPhases(data);
                });
            };

            scope.$watch('flightId', function (id) {
                if (id) { scope.load(false); }
            });

            // ── Model building ──

            function buildPhases(data) {
                var phases = [];
                addPhase(phases, 'takeoff', 'Departure', 'takeoff', data.takeoff, scope.depName);
                addPhase(phases, 'landing', 'Arrival', 'landing', data.landing, scope.arrName);

                if (!phases.length) {
                    scope.state = 'empty';
                    return;
                }
                scope.phases = phases;
                scope.state = 'ready';

                // Wind needles: start at north, then swing to the true direction
                // once the entry animation has landed (CSS transition tweens it).
                $timeout(function () {
                    angular.forEach(phases, function (phase) {
                        angular.forEach(phase.okRows, function (row) {
                            row._angle = windAngle(row);
                        });
                    });
                }, reducedMotion ? 0 : 350);
            }

            // An empty phase array = no usable time for that phase → hide it.
            function addPhase(phases, key, label, word, rows, givenName) {
                rows = rows || [];
                if (!rows.length) { return; }

                rows.sort(function (a, b) { return (a.station_rank || 0) - (b.station_rank || 0); });
                var okRows = rows.filter(function (r) { return r.status === 'ok'; });
                var first = rows[0];
                var code = first.airfield_code || '';

                var phase = {
                    key: key,
                    label: label,
                    word: word,
                    // Header shows "Name (CODE)" when a display name was passed
                    // in, else just the code.
                    placeName: givenName || code || 'Unknown airfield',
                    codeSuffix: (givenName && code && givenName !== code) ? code : '',
                    placeShort: givenName || code || 'the airfield',
                    timeZ: scope.fmtZ(first.requested_time),
                    rows: rows,
                    okRows: okRows,
                    active: 0,
                    activeRow: okRows.length ? [okRows[0]] : [],
                    emptyMsg: ''
                };

                if (!okRows.length) {
                    phase.emptyMsg = first.status === 'no_station'
                        ? 'No weather station near ' + phase.placeShort
                        : 'No weather report available near this time';
                }

                angular.forEach(okRows, function (row) {
                    row._raw = false;
                    row._angle = reducedMotion ? windAngle(row) : 0;
                    row._taf = buildTaf(row);
                    buildClouds(row);
                });

                phases.push(phase);
            }

            // ── Station toggle (recreates the report node → CSS cross-fade) ──

            scope.setStation = function (phase, idx) {
                if (phase.active === idx) { return; }
                phase.active = idx;
                phase.activeRow = [phase.okRows[idx]];
            };

            scope.stationLabel = function (row, phase) {
                if (row.is_exact_station) { return phase.placeName + (phase.codeSuffix ? ' (' + phase.codeSuffix + ')' : ''); }
                return row.station_icao;
            };

            // "observed 12:20Z — 3 min before takeoff"
            scope.deltaLabel = function (row, phase) {
                var req = parseUTC(row.requested_time);
                var obs = parseUTC(row.obs_time);
                if (req == null || obs == null) { return ''; }
                var mins = Math.round((req - obs) / 60000);
                if (mins === 0) { return 'at ' + phase.word; }
                return Math.abs(mins) + ' min ' + (mins > 0 ? 'before ' : 'after ') + phase.word;
            };

            // ── Decoded grid helpers (convenience columns only — no METAR parsing) ──

            scope.catClass = function (row) {
                var cat = (row.flight_category || '').toLowerCase();
                return { vfr: 'fw-cat--vfr', mvfr: 'fw-cat--mvfr', ifr: 'fw-cat--ifr', lifr: 'fw-cat--lifr' }[cat] || 'fw-cat--na';
            };

            scope.hasWind = function (row) {
                return row.wind_speed != null && row.wind_speed !== 0;
            };

            scope.windDirLabel = function (row) {
                if (row.wind_dir === 'VRB') { return 'VRB'; }
                return row.wind_dir != null ? row.wind_dir + '°' : '';
            };

            function windAngle(row) {
                var v = parseFloat(row.wind_dir);
                return isNaN(v) ? 0 : v;
            }

            scope.needleStyle = function (row) {
                return {
                    transform: 'rotate(' + (row._angle || 0) + 'deg)',
                    '-webkit-transform': 'rotate(' + (row._angle || 0) + 'deg)'
                };
            };

            // ── Cloud base (UK term; "ceiling" in the API) ──
            // Every reported layer from metar_json.clouds[] with the amount
            // spelled out (Few / Scattered / Broken / Overcast…), lowest first;
            // the layer that constitutes the cloud base (lowest BKN/OVC/VV) is
            // emphasised. Falls back to the flattened ceiling_ft column when
            // the JSON carries no layers.

            var COVER_LABELS = {
                FEW: 'Few', SCT: 'Scattered', BKN: 'Broken', OVC: 'Overcast',
                VV: 'Sky obscured', NSC: 'No significant cloud',
                NCD: 'No cloud detected', SKC: 'Sky clear', CLR: 'Sky clear',
                CAVOK: 'CAVOK'
            };

            function coverLabel(cover) {
                cover = String(cover || '').toUpperCase();
                return COVER_LABELS[cover] || cover;
            }

            function groupNum(n) {
                return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }

            function buildClouds(row) {
                var layers = [];
                angular.forEach((row.metar_json && row.metar_json.clouds) || [], function (c) {
                    if (!c || !c.cover) { return; }
                    var cover = String(c.cover).toUpperCase();
                    var base = (c.base != null && isFinite(c.base)) ? Number(c.base) : null;
                    layers.push({
                        code: cover,
                        label: coverLabel(cover),
                        base: base,
                        baseLabel: base != null ? groupNum(base) : '',
                        isCeiling: false
                    });
                });
                layers.sort(function (a, b) {
                    if (a.base == null) { return 1; }
                    if (b.base == null) { return -1; }
                    return a.base - b.base;
                });
                // the cloud base = lowest broken/overcast/obscured layer
                for (var i = 0; i < layers.length; i++) {
                    if (/^(BKN|OVC|VV)$/.test(layers[i].code) && layers[i].base != null) {
                        layers[i].isCeiling = true;
                        break;
                    }
                }

                var note = '';
                if (!layers.length) {
                    if (row.ceiling_ft) {
                        layers.push({ code: '', label: 'Cloud base', base: Number(row.ceiling_ft),
                                      baseLabel: groupNum(row.ceiling_ft), isCeiling: true });
                    } else if (/CAVOK/i.test(row.raw_metar || '') || /CAVOK/i.test(row.visibility || '')) {
                        note = 'CAVOK';
                    } else {
                        note = 'No cloud reported';
                    }
                }
                row._clouds = layers;
                row._cloudsNote = note;
            }

            // Visibility is reported verbatim ("6+", "9999", "CAVOK", "1 1/2SM").
            // Only append a unit when the value is bare digits: NOAA reports
            // statute miles, archive (iem) rows metres.
            scope.visLabel = function (row) {
                var v = row.visibility;
                if (v == null || v === '') { return '–'; }
                v = String(v);
                if (/[a-zA-Z]/.test(v)) { return v; }
                return v + (row.source === 'iem' ? ' m' : ' SM');
            };

            // ── Raw text copy ──

            scope.copyRaw = function (text) {
                if (!text) { return; }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        ToastService.success('Copied', 'Raw report copied to clipboard');
                    });
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    ToastService.success('Copied', 'Raw report copied to clipboard');
                }
            };

            // ── TAF timeline ──
            // taf_json.fcsts[] = decoded periods (timeFrom/timeTo unix seconds,
            // fcstChange = FM/BECMG/TEMPO/PROB…). Base periods form the lane;
            // TEMPO/PROB/INTER render as an overlay stripe on top.

            function buildTaf(row) {
                var json = row.taf_json;
                var fcsts = json && json.fcsts;
                if (!row.raw_taf || !fcsts || !fcsts.length) { return null; }

                var from = parseUTC(row.taf_valid_from);
                var to = parseUTC(row.taf_valid_to);
                angular.forEach(fcsts, function (f) {
                    if (f.timeFrom) { from = Math.min(from == null ? f.timeFrom * 1000 : from, f.timeFrom * 1000); }
                    if (f.timeTo)   { to   = Math.max(to   == null ? f.timeTo   * 1000 : to,   f.timeTo   * 1000); }
                });
                if (from == null || to == null || to <= from) { return null; }

                var req = parseUTC(row.requested_time);
                var span = to - from;
                var pct = function (ms) { return Math.max(0, Math.min(100, (ms - from) / span * 100)); };

                var segments = [];
                var activeSeg = null;
                angular.forEach(fcsts, function (f, idx) {
                    var f0 = f.timeFrom ? f.timeFrom * 1000 : from;
                    var f1 = f.timeTo ? f.timeTo * 1000 : to;
                    if (f1 <= f0) { return; }
                    var change = (f.fcstChange || '').toUpperCase();
                    var tempo = /TEMPO|PROB|INTER/.test(change);
                    var seg = {
                        left: pct(f0),
                        width: Math.max(1.5, pct(f1) - pct(f0)),
                        label: change || (idx === 0 ? 'BASE' : 'FM'),
                        tempo: tempo,
                        timeLabel: fmtUnixDayZ(f0 / 1000) + ' → ' + fmtUnixDayZ(f1 / 1000),
                        active: false,
                        parts: describePeriod(f)
                    };
                    // The (base) period in force at the flight time gets the
                    // category highlight + is pre-selected.
                    if (!tempo && req != null && req >= f0 && req < f1) {
                        seg.active = true;
                        activeSeg = seg;
                    }
                    segments.push(seg);
                });
                if (!segments.length) { return null; }

                return {
                    segments: segments,
                    selected: activeSeg,
                    pinLeft: req != null ? pct(req) : 0
                };
            }

            // Human summary chips for one decoded TAF period. Field names follow
            // NOAA's parsed element (the iem parser emits the same subset) —
            // everything is optional, render only what's there.
            function describePeriod(f) {
                var parts = [];
                if (f.probability) { parts.push('PROB' + f.probability); }
                if (f.wdir != null || f.wspd != null) {
                    var w = (f.wdir === 'VRB' ? 'VRB' : (f.wdir != null ? f.wdir + '°' : '')) +
                            (f.wspd != null ? ' ' + f.wspd + ' kt' : '') +
                            (f.wgst ? ' G ' + f.wgst : '');
                    if (w.trim()) { parts.push('Wind ' + w.trim()); }
                }
                if (f.visib != null && f.visib !== '') { parts.push('Vis ' + f.visib); }
                if (f.wxString) { parts.push(f.wxString); }
                angular.forEach(f.clouds || [], function (c) {
                    if (!c || !c.cover) { return; }
                    parts.push(coverLabel(c.cover) + (c.base != null ? ' ' + groupNum(c.base) + ' ft' : ''));
                });
                return parts;
            }

            scope.selectSeg = function (row, seg) {
                row._taf.selected = (row._taf.selected === seg) ? null : seg;
            };
        }
    };
}]);

// ── fwDrawerFit — size a weather drawer to its horizontal scrollport ──
// Used on the .fw-drawer wrapper when the panel lives inside a full-width
// <td colspan> of a horizontally-scrolling logbook table. A viewport-based
// max-width can exceed the scrollport, and then `position: sticky` runs out
// of travel and the drawer clips off-screen. This measures the real
// scrollport, caps the drawer to it, and scrolls the table back to the left
// so the drawer opens fully in view.
app.directive('fwDrawerFit', ['$timeout', function ($timeout) {
    return {
        restrict: 'A',
        link: function (scope, element) {
            var el = element[0];

            function scroller() {
                var node = el.parentElement;
                while (node && node !== document.body) {
                    var ox = window.getComputedStyle(node).overflowX;
                    if (ox === 'auto' || ox === 'scroll') { return node; }
                    node = node.parentElement;
                }
                return null;
            }

            function fit() {
                var sc = scroller();
                if (!sc) { return; }
                el.style.maxWidth = sc.clientWidth + 'px';
            }

            $timeout(function () {
                fit();
                var sc = scroller();
                if (sc && sc.scrollLeft > 0) {
                    if (sc.scrollTo) { sc.scrollTo({ left: 0, behavior: 'smooth' }); }
                    else { sc.scrollLeft = 0; }
                }
            });

            window.addEventListener('resize', fit);
            scope.$on('$destroy', function () {
                window.removeEventListener('resize', fit);
            });
        }
    };
}]);

// ── fwTicker — count a number up from 0 on first reveal (~400 ms) ──
// <span fw-ticker="row.wind_speed"></span>            → "11"
// <span fw-ticker="row.ceiling_ft" fw-ticker-group="true"></span> → "4,300"
// Values may be numeric strings ("29.0"); rendered rounded to integers like
// the rest of the grid. Respects prefers-reduced-motion (renders instantly).
app.directive('fwTicker', [function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var reducedMotion = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var group = attrs.fwTickerGroup === 'true';

            function fmt(v) {
                var n = Math.round(v);
                if (!group) { return String(n); }
                return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }

            scope.$watch(attrs.fwTicker, function (val) {
                var target = parseFloat(val);
                if (isNaN(target)) { element.text('–'); return; }
                if (reducedMotion || !window.requestAnimationFrame) {
                    element.text(fmt(target));
                    return;
                }
                var start = null;
                var DURATION = 400;
                function step(ts) {
                    if (start === null) { start = ts; }
                    var t = Math.min(1, (ts - start) / DURATION);
                    var eased = 1 - Math.pow(1 - t, 3);   // ease-out cubic
                    element.text(fmt(target * eased));
                    if (t < 1) { window.requestAnimationFrame(step); }
                }
                window.requestAnimationFrame(step);
            });
        }
    };
}]);

// ── wxChip — tiny category pill + wind summary for table rows / lists ──
//   <wx-chip row="row"></wx-chip>
// `row` is any object with flight_category / wind_dir / wind_speed / wind_gust
// (a for_flight station row, or a flight_weather/latest condition's flattened
// fields). Renders nothing until row is set.
app.directive('wxChip', [function () {
    return {
        restrict: 'E',
        scope: { row: '=' },
        template:
            '<span class="fw-chip" ng-if="row.flight_category" ng-class="chipClass()" ' +
                  'aria-label="Flight category {{ row.flight_category }}">' +
                '<span class="fw-chip__cat">{{ row.flight_category }}</span>' +
                '<span class="fw-chip__wind" ng-if="row.wind_speed != null">' +
                    '{{ row.wind_dir === "VRB" ? "VRB" : row.wind_dir + "°" }} {{ row.wind_speed }}kt' +
                    '<span ng-if="row.wind_gust"> G{{ row.wind_gust }}</span>' +
                '</span>' +
            '</span>',
        link: function (scope) {
            scope.chipClass = function () {
                var cat = ((scope.row || {}).flight_category || '').toLowerCase();
                return { vfr: 'fw-cat--vfr', mvfr: 'fw-cat--mvfr', ifr: 'fw-cat--ifr', lifr: 'fw-cat--lifr' }[cat] || 'fw-cat--na';
            };
        }
    };
}]);
