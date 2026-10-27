// ─────────────────────────────────────────────────────────────────────────
// trackReconciliation — tracker · track file · log sheet reconciliation panel
// (FRONTEND_TRACK_DATA_GUIDE.md §2, §2.1, §2.2, §6). One shared component,
// mounted on the instructor debrief page and the club flight-edit modal:
//
//   <track-reconciliation pls-id="vm.plane_log_sheet.id"
//                         club-id="vm.club_id"                 (gates the Apply button)
//                         empty-text="No tracker recording…">  (optional — shown instead
//                                                               of nothing on NO_TRACK)
//
// `pls-id` is always a plane_log_sheets.id. Fetches FoxTrackService.GetPls on
// mount and whenever the id changes. NO_TRACK / FORBIDDEN → renders nothing
// (rc.hidden; the host element gets .trc-host--hidden so it takes no space).
//
// Apply (club manager / instructor of club-id only): writes the two landing
// counts from the recommendation onto the sheet, then emits
// 'trackCounts:applied' with the fresh sheet block so the host page can update
// its own copy of the counts. The app-wide busy guard covers the click.
//
// All datetimes from the API are UTC — rendered as H:i, never timezone-shifted.
// ─────────────────────────────────────────────────────────────────────────
app.directive('trackReconciliation', ['FoxTrackService', 'ToastService', '$rootScope', function (FoxTrackService, ToastService, $rootScope) {
    return {
        restrict: 'E',
        scope: {
            plsId:     '=',
            clubId:    '=?',
            emptyText: '@?',
            startOpen: '@?'     // "true" → expanded from the first render (the admin analysis page)
        },
        templateUrl: 'views/directives/track_reconciliation.html',
        controllerAs: 'rc',
        bindToController: true,
        controller: ['$scope', '$element', function ($scope, $element) {
            var rc = this;

            rc.hidden = true;        // NO_TRACK / FORBIDDEN / no id → render nothing
            rc.resolved = false;     // first fetch answered (gates the optional empty-text line)
            rc.loading = false;
            rc.error = null;
            rc.data = null;

            rc.rows = [];
            rc.flags = [];
            rc.warnFlags = [];
            rc.notes = [];
            rc.pending = false;      // track file not analysed yet
            rc.lowConfidence = false;
            rc.mismatch = false;     // TRACKER_PAIRS_OUTSIDE_TRACK
            rc.reviewNeeded = false;
            rc.chip = null;
            rc.truncated = false;    // SEGMENT_TRUNCATED — the leg's track is cut inside a short ground gap (§2, §6)
            rc.truncatedPhrases = ''; // recommended.segment_truncated joined: 'ends in flight' / 'starts in flight'

            // Collapsed by default: everyone gets a one-line verdict; the full
            // tracker · track · sheet table is a click away. Auto-opens only when
            // the viewer can Apply AND something differs (there is something to do).
            rc.expanded = String(rc.startOpen) === 'true';
            rc.userToggled = rc.expanded;
            rc.summary = '';
            rc.summaryTone = 'ok';   // ok | warn | info
            rc.toggle = function () { rc.expanded = !rc.expanded; rc.userToggled = true; };

            // the sheet's maintenance airborne time + source (plane_log_sheets.airborne_source)
            var AIRBORNE_SOURCE_LABELS = {
                track_file: 'from the track file', tracker: 'from the tracker', clock: 'from the take-off / landing times',
                brakes_allowance: 'brakes off → on minus 10 min', manual: 'set by hand', legacy: 'stored value (no source could reproduce it)'
            };
            rc.airborneSourceLabel = function (src) { return AIRBORNE_SOURCE_LABELS[src] || src || ''; };
            rc.fmtHours = function (hours) {
                var h = parseFloat(hours);
                if (isNaN(h)) { return '—'; }
                var mins = Math.round(h * 60);
                return Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2) + ' (' + h.toFixed(2) + ' h)';
            };

            rc.staff = false;        // viewer may Apply
            rc.canApply = false;
            rc.alreadyMatches = false;
            rc.truncatedRefused = false; // NOTHING_TO_APPLY + reason SEGMENT_TRUNCATED → Apply stays disabled
            rc.refusedLines = [];    // "Not lowered from the cut track: …" lines from response.refused
            rc.result = null;        // last successful Apply, shown under the button
            rc.confirming = false;
            rc.applying = false;
            rc.note = '';
            rc.diffLine = '';

            rc.load = load;
            rc.startApply = startApply;
            rc.cancelApply = cancelApply;
            rc.confirmApply = confirmApply;

            $scope.$watch('rc.plsId', function (id) {
                rc.result = null;
                rc.refusedLines = [];
                rc.truncatedRefused = false;
                if (id) { load(); }
                else { rc.hidden = true; rc.data = null; }
            });

            $scope.$watch('rc.hidden', function (h) {
                $element.toggleClass('trc-host--hidden', !!h && !rc.emptyText);
            });

            // ── Load ──

            function load() {
                if (!rc.plsId) { return; }
                rc.loading = true;
                rc.error = null;
                FoxTrackService.GetPls(rc.plsId).then(function (data) {
                    rc.loading = false;
                    rc.resolved = true;
                    if (!data || data.success === false) {
                        var code = data && data.error;
                        if (code === 'NO_TRACK' || code === 'FORBIDDEN' || code === 'NOT_FOUND') {
                            rc.hidden = true;
                            rc.data = null;
                            return;
                        }
                        rc.hidden = false;
                        rc.error = (data && data.message) || 'Could not load the track data.';
                        return;
                    }
                    rc.hidden = false;
                    rc.data = data;
                    build(data);
                });
            }

            // ── Formatting helpers ──

            function hm(s) {                                  // 'Y-m-d H:i:s' | 'H:i:s' → 'H:i' (nearest minute)
                if (!s) { return '—'; }
                var str = String(s);
                var t = str.length > 8 ? str.substr(11, 8) : str;
                if (typeof roundTimeToMinute === 'function') {
                    var r = roundTimeToMinute(t);
                    if (r) { return String(r).substr(0, 5); }
                }
                return t.substr(0, 5);
            }

            function mins(sec) {                              // seconds → '36 min' | '1 h 02 min'
                if (sec === null || sec === undefined || sec === '') { return '—'; }
                var m = Math.round(Number(sec) / 60);
                if (isNaN(m)) { return '—'; }
                if (m < 60) { return m + ' min'; }
                var h = Math.floor(m / 60), mm = m % 60;
                return h + ' h ' + (mm < 10 ? '0' : '') + mm + ' min';
            }

            function num(v) {
                if (v === null || v === undefined || v === '') { return '—'; }
                return String(v);
            }

            function val(obj, key) { return obj ? obj[key] : undefined; }

            // ── Model building ──

            function build(data) {
                var tracker = data.tracker || {};
                var track = data.track || null;
                var ts = track ? (track.summary || track) : null;   // summary may be nested or flat
                var rec = data.recommended || {};
                var sheet = data.sheet || {};
                var svr = data.sheet_vs_recommended || {};
                var cmp = data.comparison || {};
                var flags = rec.flags || [];

                rc.pending = !ts || track.available === false;
                rc.lowConfidence = !!(ts && ts.confidence !== undefined && ts.confidence !== null && Number(ts.confidence) < 0.5);
                rc.mismatch = flags.indexOf('TRACKER_PAIRS_OUTSIDE_TRACK') > -1;
                rc.reviewNeeded = !!svr.any_difference;
                rc.chip = FoxTrackService.countsSourceChip(sheet.track_counts_source);
                rc.sheetUpdatedAt = sheet.track_counts_updated_at || null;

                // SEGMENT_TRUNCATED (§2, §6): the leg's track ends / starts in flight, so it
                // cannot have seen every landing — the track column's counts are incomplete
                // and the tracker-sourced recommendation is the authority.
                var truncPhrases = angular.isArray(rec.segment_truncated) ? rec.segment_truncated : [];
                rc.truncated = flags.indexOf('SEGMENT_TRUNCATED') > -1 || truncPhrases.length > 0;
                rc.truncatedPhrases = truncPhrases.join(' and ');
                if (!rc.truncated) { rc.truncatedRefused = false; }
                var truncCountKeys = ['landings', 'full_stop_landings', 'stop_and_gos', 'touch_and_gos', 'go_arounds'];
                var truncEnds = /end/i.test(rc.truncatedPhrases), truncStarts = /start/i.test(rc.truncatedPhrases);
                function isTruncatedRow(key, source) {
                    if (!rc.truncated) { return false; }
                    if (truncCountKeys.indexOf(key) > -1) { return true; }
                    if (key === 'landing_time') { return truncEnds || (!truncStarts && source === 'tracker'); }
                    if (key === 'takeoff_time') { return truncStarts || (!truncEnds && source === 'tracker'); }
                    return false;
                }

                var pairs = tracker.pairs || [];
                var firstPair = pairs.length ? pairs[0] : null;
                var lastPair = pairs.length ? pairs[pairs.length - 1] : null;
                var sheetTotal = (sheet.full_stop_landings === undefined && sheet.touch_and_go === undefined)
                    ? undefined
                    : (parseInt(sheet.full_stop_landings, 10) || 0) + (parseInt(sheet.touch_and_go, 10) || 0);

                function r(label, key, kind, trackerV, trackV, sheetV, svrKey, sheetHint) {
                    var R = rec[key] || {};
                    var fmt = kind === 'time' ? hm : (kind === 'duration' ? mins : num);
                    var d = svrKey ? (svr[svrKey] || null) : null;
                    var row = {
                        key: key,
                        label: label,
                        tracker: fmt(trackerV),
                        track: rc.pending ? 'pending' : fmt(trackV),
                        sheet: fmt(sheetV),
                        sheetHint: sheetHint || '',
                        rec: fmt(R.value),
                        source: R.source || '',
                        reason: R.reason || '',
                        differs: !!(d && d.differs),
                        sheetRecommended: d ? fmt(d.recommended) : '',
                        sheetNote: d ? (d.note || ('Recommended: ' + fmt(d.recommended))) : '',
                        truncated: isTruncatedRow(key, R.source || '')
                    };
                    if (kind === 'time' && R.dt_s !== undefined && R.dt_s !== null && row.reason) {
                        row.reason += ' (' + (R.dt_s > 0 ? '+' : '') + R.dt_s + ' s)';
                    }
                    return row;
                }

                rc.rows = [
                    r('Take-off time', 'takeoff_time', 'time',
                        firstPair ? firstPair.start : null, val(ts, 'first_takeoff_at'), sheet.takeoff_time, 'takeoff_time'),
                    r('Landing time', 'landing_time', 'time',
                        lastPair ? lastPair.end : null, val(ts, 'last_landing_at'), sheet.landing_time, 'landing_time'),
                    r('Landings', 'landings', 'count',
                        tracker.number_landings, val(ts, 'landings'), sheetTotal, 'landings_total',
                        'Sheet total = full-stop landings + touch-and-gos'),
                    r('Full stops', 'full_stop_landings', 'count',
                        tracker.legacy_full_stop_landings, val(ts, 'full_stop_landings'), sheet.full_stop_landings, 'full_stop_landings',
                        'The sheet counts stop-and-gos with full stops'),
                    r('Stop-and-gos', 'stop_and_gos', 'count',
                        null, val(ts, 'stop_and_gos'), null, null,
                        'Counted with full stops on the sheet'),
                    r('Touch-and-gos', 'touch_and_gos', 'count',
                        tracker.legacy_touch_and_go, val(ts, 'touch_and_gos'), sheet.touch_and_go, 'touch_and_go'),
                    r('Go-arounds', 'go_arounds', 'count',
                        null, val(ts, 'go_arounds'), null, null,
                        'Not recorded on the sheet'),
                    r('Airborne time', 'airborne_seconds', 'duration',
                        tracker.airborne_seconds, val(ts, 'airborne_seconds'), null, null,
                        'Not recorded on the sheet')
                ];

                // Flags → warnings. Explained corrections are informational, not conflicts.
                var policy = rec.policy || {};
                var policyKey = {
                    TIME_DISAGREEMENT: 'times',
                    LANDING_COUNT_DISAGREEMENT: 'landings', LOW_AGREEMENT: 'landings',
                    TRACKER_MISSING_TAKEOFF: 'landings', TRACKER_MISSING_LANDING: 'landings',
                    TRACKER_PHANTOM_PAIRS: 'landings', TRACK_ONLY_TOUCH_AND_GOS: 'landings',
                    TRACKER_PAIRS_OUTSIDE_TRACK: 'landings',
                    KINDS_FROM_FEWER_LANDINGS: 'kinds',
                    AIRBORNE_SECONDS_DISAGREEMENT: 'airborne',
                    SEGMENT_TRUNCATED: 'truncated'
                };
                var allPolicy = [];
                angular.forEach(['times', 'landings', 'kinds', 'go_arounds', 'airborne', 'truncated'], function (k) {
                    if (policy[k]) { allPolicy.push(policy[k]); }
                });
                rc.flags = [];
                rc.warnFlags = [];
                angular.forEach(flags, function (f) {
                    var tone = 'warn', icon = 'fa-exclamation-triangle';
                    if (f === 'TRACKER_PHANTOM_PAIRS' || f === 'TRACK_ONLY_TOUCH_AND_GOS') { tone = 'info'; icon = 'fa-info-circle'; }
                    else if (f === 'SEGMENT_TRUNCATED') { tone = 'info'; icon = 'fa-cut'; }
                    else if (f === 'TRACKER_PAIRS_OUTSIDE_TRACK') { tone = 'danger'; icon = 'fa-unlink'; }
                    var item = {
                        code: f,
                        tone: tone,
                        icon: icon,
                        label: (tone === 'danger' ? 'Recording mismatch — ' : '') + FoxTrackService.flagLabel(f),
                        policy: policy[policyKey[f]] || allPolicy.join(' ')
                    };
                    rc.flags.push(item);
                    if (tone !== 'info') { rc.warnFlags.push(item); }
                });

                // Tracker-only / track-only lines
                rc.notes = [];
                angular.forEach(cmp.tracker_only || [], function (p) {
                    var explained = p.verdict && p.verdict !== 'unexplained';
                    rc.notes.push({
                        tone: p.verdict === 'outside_file' ? 'danger' : (explained ? 'info' : 'warn'),
                        icon: p.verdict === 'outside_file' ? 'fa-unlink' : (explained ? 'fa-check-circle' : 'fa-question-circle'),
                        text: 'Tracker flight ' + (p.index !== undefined ? '#' + (Number(p.index) + 1) + ' ' : '') +
                              hm(p.start) + '–' + hm(p.end) +
                              (p.duration_s !== undefined ? ' (' + p.duration_s + ' s)' : '') +
                              ': ' + FoxTrackService.verdictLabel(p.verdict)
                    });
                });
                angular.forEach(cmp.track_only || [], function (e) {
                    var ev = e.landing || e;
                    var kind = ev.landing_kind ? FoxTrackService.landingKindLabel(ev.landing_kind) : 'landing';
                    var method = ev.method ? FoxTrackService.methodLabel(ev.method) : '';
                    rc.notes.push({
                        tone: 'info',
                        icon: 'fa-plus-circle',
                        text: 'The track shows a ' + kind + (ev.at ? ' at ' + hm(ev.at) : '') + ' the tracker missed' +
                              (method ? ' (' + method + ')' : '')
                    });
                });
                if (cmp.notes && cmp.notes.length) {
                    angular.forEach(cmp.notes, function (n) {
                        if (n) { rc.notes.push({ tone: 'info', icon: 'fa-info-circle', text: String(n) }); }
                    });
                }

                // Apply gate (§2.2): club staff only, and only when a count differs
                rc.staff = isStaff(rc.clubId || sheet.club_id);
                buildSummary(svr);
                var fs = svr.full_stop_landings || {}, tg = svr.touch_and_go || {};
                rc.canApply = !!(fs.differs || tg.differs) && !rc.truncatedRefused;
                rc.alreadyMatches = !rc.canApply && !rc.truncatedRefused;
                rc.confirming = false;
                rc.diffLine = buildDiff(fs, tg);
            }

            function buildDiff(fs, tg) {
                var parts = [];
                if (fs.differs) { parts.push('Full-stop landings ' + num(fs.sheet) + ' → ' + num(fs.recommended)); }
                if (tg.differs) { parts.push('touch-and-gos ' + num(tg.sheet) + ' → ' + num(tg.recommended)); }
                return parts.join(', ');
            }

            // response.refused (§2.2) → "Not lowered from the cut track: full-stop landings kept at 2 (track suggested 1, tracker 1)"
            function buildRefused(refused) {
                var names = { full_stop_landings: 'full-stop landings', touch_and_go: 'touch-and-gos' };
                var lines = [];
                if (!refused || angular.isArray(refused)) { return lines; }   // {} may arrive as [] from PHP
                angular.forEach(refused, function (r, field) {
                    if (!r) { return; }
                    lines.push('Not lowered from the cut track: ' + (names[field] || field.replace(/_/g, ' ')) +
                               ' kept at ' + num(r.before) +
                               ' (track suggested ' + num(r.recommended) + ', tracker ' + num(r.tracker) + ')');
                });
                return lines;
            }

            // response.applied → "Full-stop landings 1 → 6, touch-and-gos 4 → 1" (only the fields that changed)
            function appliedLine(applied) {
                if (!applied || angular.isArray(applied)) { return ''; }
                var names = { full_stop_landings: 'Full-stop landings', touch_and_go: 'touch-and-gos' };
                var parts = [];
                angular.forEach(applied, function (a, field) {
                    if (a) { parts.push((names[field] || field.replace(/_/g, ' ')) + ' ' + num(a.before) + ' → ' + num(a.after)); }
                });
                return parts.join(', ');
            }

            // One-line verdict for the collapsed header.
            function buildSummary(svr) {
                var lt = svr.landings_total || {}, fs = svr.full_stop_landings || {}, tg = svr.touch_and_go || {};
                if (rc.mismatch) {
                    rc.summary = 'Recording mismatch — the track file may belong to another flight';
                    rc.summaryTone = 'warn';
                } else if (rc.pending) {
                    rc.summary = 'Track analysis pending — tracker values in use';
                    rc.summaryTone = 'info';
                } else if (rc.truncated) {
                    rc.summary = 'Track cut at the split — tracker counts in use';
                    rc.summaryTone = 'info';
                } else if (rc.lowConfidence) {
                    rc.summary = 'Low confidence in the track analysis — tracker counts are the reference';
                    rc.summaryTone = 'warn';
                } else if (rc.reviewNeeded) {
                    var parts = [];
                    if (fs.recommended !== undefined && fs.recommended !== null) { parts.push(fs.recommended + ' full stop' + (Number(fs.recommended) === 1 ? '' : 's')); }
                    if (tg.recommended !== undefined && tg.recommended !== null) { parts.push(tg.recommended + ' touch-and-go' + (Number(tg.recommended) === 1 ? '' : 's')); }
                    rc.summary = 'Track shows ' + (lt.recommended !== undefined && lt.recommended !== null ? lt.recommended + ' landings' : 'different landings')
                        + (parts.length ? ' (' + parts.join(', ') + ')' : '')
                        + (lt.sheet !== undefined && lt.sheet !== null ? ' — the sheet has ' + lt.sheet : '');
                    rc.summaryTone = 'warn';
                } else {
                    rc.summary = 'Sheet agrees with the track' + (lt.sheet !== undefined && lt.sheet !== null ? ' (' + lt.sheet + ' landing' + (Number(lt.sheet) === 1 ? '' : 's') + ')' : '');
                    rc.summaryTone = 'ok';
                }
                if (!rc.userToggled) { rc.expanded = !!(rc.staff && rc.canApply && (rc.reviewNeeded || rc.mismatch)); }
            }

            function isStaff(clubId) {
                if ($rootScope.isToAviateStaff && $rootScope.isToAviateStaff()) { return true; }   // the backend still decides
                var g = $rootScope.globals, u = g && g.currentUser, acc = u && u.access;
                if (!acc || !clubId) { return false; }
                var id = String(clubId);
                function has(list) {
                    if (!angular.isArray(list)) { return false; }
                    for (var i = 0; i < list.length; i++) { if (String(list[i]) === id) { return true; } }
                    return false;
                }
                return has(acc.manager) || has(acc.instructor);
            }

            // ── Apply (§2.2) ──

            function startApply() {
                if (!rc.canApply || rc.alreadyMatches || rc.truncatedRefused) { return; }
                rc.note = '';
                rc.result = null;
                rc.refusedLines = [];
                rc.confirming = true;
            }

            function cancelApply() {
                rc.confirming = false;
            }

            function confirmApply() {
                if (rc.applying || !rc.data) { return; }
                var svr = rc.data.sheet_vs_recommended || {};
                var fields = [];
                if (svr.full_stop_landings && svr.full_stop_landings.differs) { fields.push('full_stop_landings'); }
                if (svr.touch_and_go && svr.touch_and_go.differs) { fields.push('touch_and_go'); }
                if (!fields.length) { rc.alreadyMatches = true; rc.confirming = false; return; }

                var body = { fields: fields };
                var note = (rc.note || '').trim();
                if (note) { body.note = note.substr(0, 255); }

                rc.applying = true;
                var id = rc.plsId;
                FoxTrackService.Apply(id, body).then(function (res) {
                    rc.applying = false;
                    if (!res || res.success === false) {
                        var code = res && res.error;
                        if (code === 'NOTHING_TO_APPLY') {
                            rc.canApply = false;
                            rc.confirming = false;
                            if (res.reason === 'SEGMENT_TRUNCATED') {
                                // The backend never lowers a count from a track that ends / starts in flight (§2.2)
                                rc.truncatedRefused = true;
                                rc.alreadyMatches = false;
                                rc.refusedLines = buildRefused(res.refused);
                                ToastService.warning('Not applied', 'The track of this leg is cut at the split — counts are not lowered from it.');
                                return;
                            }
                            rc.alreadyMatches = true;
                            ToastService.warning('Nothing to apply', 'The sheet already matches the track.');
                            return;
                        }
                        if (code === 'FORBIDDEN') {
                            rc.staff = false;
                            rc.confirming = false;
                            return;
                        }
                        ToastService.error('Not applied', (res && res.message) || 'The counts could not be applied.');
                        return;
                    }
                    rc.confirming = false;
                    if (res.sheet) {
                        rc.data.sheet = res.sheet;
                    }
                    rc.refusedLines = buildRefused(res.refused);
                    rc.result = { text: appliedLine(res.applied) || rc.diffLine || 'The log sheet now matches the track.' };
                    ToastService.success('Counts applied', rc.diffLine || 'The log sheet now matches the track.');
                    $scope.$emit('trackCounts:applied', res.sheet || null, res);
                    load();                                   // any_difference on the counts becomes false
                });
            }
        }]
    };
}]);
