// ─────────────────────────────────────────────────────
// Fox track-data tools (ToAviate management).
//   FoxTrackToolsController — one screen for the admin half of
//   FRONTEND_TRACK_DATA_GUIDE.md §4 / §4.1:
//     • analysis backfill (looped until `remaining` is 0) + re-analyse a file
//     • segments dry run / build / rebuild one split
//     • inspect a file (tracker · track · comparison, read-only)
//     • mis-linked recordings: scan → repair (looped until `changed` is 0),
//       undo a batch, report, and the per-file "resolve an ambiguous link"
//       decision for `skip` candidates carrying `candidate_entries`.
// Gate: $rootScope.isToAviateStaff(), same as the other fox_* screens.
// ?imei= prefills the scan filter (the health board's flight-counter-reset
// badge links here).
// ─────────────────────────────────────────────────────

app.controller('FoxTrackToolsController', FoxTrackToolsController);

    FoxTrackToolsController.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$timeout', 'FoxTrackService', 'ToastService', 'PlaneService'];
    function FoxTrackToolsController($rootScope, $scope, $state, $stateParams, $timeout, FoxTrackService, ToastService, PlaneService) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.authorised = $rootScope.isToAviateStaff();
        if (!vm.authorised) return;

        // Loop guards — a backfill / repair that never reports progress must
        // not spin forever against the API.
        var MAX_LOOPS = 500;
        var STALL_LOOPS = 3;

        var today = moment().format('YYYY-MM-DD');

        // Shared copy helpers
        vm.verdictLabel = FoxTrackService.verdictLabel;
        vm.flagLabel = FoxTrackService.flagLabel;
        vm.methodLabel = FoxTrackService.methodLabel;
        vm.landingKindLabel = FoxTrackService.landingKindLabel;

        // ═══════════════════════════════════════════════════════
        // 1. Analysis backfill
        // ═══════════════════════════════════════════════════════
        vm.bf = freshBackfill();
        function freshBackfill() {
            return { running: false, stop: false, loops: 0, done: 0, remaining: null, last: null, error: null, finished: false, stalled: false };
        }

        vm.runBackfill = function() {
            if (vm.bf.running) { return; }
            vm.bf = freshBackfill();
            vm.bf.running = true;
            backfillLoop(null, 0);
        };

        vm.stopBackfill = function() { vm.bf.stop = true; };

        vm.bfPct = function() {
            var bf = vm.bf;
            var total = bf.done + (bf.remaining || 0);
            if (bf.remaining === null || total <= 0) { return 0; }
            return Math.round(bf.done / total * 100);
        };

        function backfillLoop(prev_remaining, stalls) {
            var bf = vm.bf;
            FoxTrackService.Backfill(200).then(function(data) {
                if (!data.success) {
                    bf.running = false;
                    bf.error = errorText(data, 'The backfill request failed.');
                    ToastService.error('Backfill Failed', bf.error);
                    return;
                }
                bf.loops++;
                bf.last = data;
                var processed = countOf(data, ['analysed', 'done', 'processed', 'updated', 'count']);
                bf.done += processed;
                bf.remaining = (data.remaining === undefined || data.remaining === null) ? null : parseInt(data.remaining, 10);

                var same = (prev_remaining !== null && bf.remaining !== null && bf.remaining >= prev_remaining) || (bf.remaining === null && processed === 0);
                stalls = same ? stalls + 1 : 0;

                if (bf.remaining === 0 || (bf.remaining === null && processed === 0)) {
                    finishBackfill(false);
                } else if (bf.stop) {
                    finishBackfill(false);
                } else if (stalls >= STALL_LOOPS || bf.loops >= MAX_LOOPS) {
                    finishBackfill(true);
                } else {
                    backfillLoop(bf.remaining, stalls);
                }
            });
        }

        function finishBackfill(stalled) {
            var bf = vm.bf;
            bf.running = false;
            bf.finished = true;
            bf.stalled = stalled;
            if (stalled) {
                ToastService.warning('Backfill Paused', 'No progress over the last ' + STALL_LOOPS + ' loops — ' + (bf.remaining === null ? 'the response carries no "remaining" count' : bf.remaining + ' still remaining') + '. Check the API log before re-running.');
            } else if (bf.stop && bf.remaining > 0) {
                ToastService.success('Backfill Stopped', bf.done + ' file(s) analysed over ' + bf.loops + ' loop(s); ' + bf.remaining + ' remaining.');
            } else {
                ToastService.success('Backfill Complete', bf.done + ' file(s) analysed over ' + bf.loops + ' loop(s).');
            }
        }

        // ── Re-analyse a file ──
        vm.analyse = { file_id: '', force: true, busy: false, result: null, error: null };

        vm.runAnalyse = function() {
            var a = vm.analyse;
            var id = parseInt(a.file_id, 10);
            if (!id) { a.error = 'Enter a file id.'; return; }
            a.busy = true;
            a.error = null;
            a.result = null;
            FoxTrackService.Analyse(id, a.force).then(function(data) {
                a.busy = false;
                if (!data.success) {
                    a.error = errorText(data, 'The file could not be analysed.');
                    ToastService.error('Analyse Failed', a.error);
                    return;
                }
                a.result = { file_id: id, scalars: scalarsOf(data, ['success']), summary: scalarsOf(data.summary || (data.track_events && data.track_events.summary) || null) };
                ToastService.success('File Analysed', 'File #' + id + (a.force ? ' re-analysed.' : ' analysed.'));
            });
        };

        // ═══════════════════════════════════════════════════════
        // 2. Segments
        // ═══════════════════════════════════════════════════════
        vm.seg = {
            results: [],             // [build?, dry?] — rebuilt when either lands (ng-repeat compares by reference)
            dry: null, dry_busy: false, dry_error: null,
            build_confirm: false, build_busy: false, build: null, build_error: null,
            rebuild_id: '', rebuild_busy: false, rebuild: null, rebuild_error: null
        };

        vm.segDryRun = function() {
            var s = vm.seg;
            s.dry_busy = true;
            s.dry_error = null;
            FoxTrackService.SegmentsBackfill({ dry_run: 1, limit: 50 }).then(function(data) {
                s.dry_busy = false;
                if (!data.success) {
                    s.dry_error = errorText(data, 'The dry run failed.');
                    ToastService.error('Dry Run Failed', s.dry_error);
                    return;
                }
                s.dry = {
                    title: 'Dry run',
                    candidates: (data.candidates || []).map(segRow),
                    skipped: (data.skipped || []).map(segRow),
                    scalars: scalarsOf(data, ['success', 'candidates', 'skipped'])
                };
                segResults();
            });
        };

        function segResults() {
            vm.seg.results = [vm.seg.build, vm.seg.dry].filter(function(r) { return !!r; });
        }

        // A candidate / skipped row: show the sheet id up front and every other
        // scalar as a "key: value" chip (the exact keys aren't in the contract).
        function segRow(row) {
            if (!row || typeof row !== 'object') { return { id: row, reason: null, kv: [] }; }
            return {
                id: row.pls_id || row.plane_log_sheet_id || row.id || null,
                reason: row.reason || null,
                kv: scalarsOf(row, ['pls_id', 'plane_log_sheet_id', 'id', 'reason'])
            };
        }

        vm.segAskBuild = function() { vm.seg.build_confirm = true; vm.seg.build = null; };
        vm.segCancelBuild = function() { vm.seg.build_confirm = false; };

        vm.segBuild = function() {
            var s = vm.seg;
            if (s.build_busy) { return; }
            s.build_busy = true;
            s.build_error = null;
            FoxTrackService.SegmentsBackfill({ dry_run: 0, limit: 50 }).then(function(data) {
                s.build_busy = false;
                s.build_confirm = false;
                if (!data.success) {
                    s.build_error = errorText(data, 'The segments build failed.');
                    ToastService.error('Build Failed', s.build_error);
                    return;
                }
                s.build = {
                    title: 'Build result',
                    candidates: (data.candidates || data.built || []).map(segRow),
                    skipped: (data.skipped || []).map(segRow),
                    scalars: scalarsOf(data, ['success', 'candidates', 'built', 'skipped'])
                };
                segResults();
                ToastService.success('Segments Built', s.build.candidates.length + ' split(s) processed, ' + s.build.skipped.length + ' skipped.');
            });
        };

        vm.segRebuild = function() {
            var s = vm.seg;
            var id = parseInt(s.rebuild_id, 10);
            if (!id) { s.rebuild_error = 'Enter a log sheet id (either leg).'; return; }
            s.rebuild_busy = true;
            s.rebuild_error = null;
            s.rebuild = null;
            FoxTrackService.SegmentsRebuild(id).then(function(data) {
                s.rebuild_busy = false;
                if (!data.success) {
                    s.rebuild_error = errorText(data, 'The split could not be rebuilt.');
                    ToastService.error('Rebuild Failed', s.rebuild_error);
                    return;
                }
                s.rebuild = { pls_id: id, scalars: scalarsOf(data, ['success']), rows: data.rows ? scalarsOf(data.rows) : [] };
                ToastService.success('Split Rebuilt', 'Per-leg tracks rebuilt for sheet #' + id + '.');
            });
        };

        // ═══════════════════════════════════════════════════════
        // 3. Inspect a file
        // ═══════════════════════════════════════════════════════
        vm.inspect = { file_id: '', busy: false, data: null, error: null };

        // ── Flight analysis: the tracker · track file · sheet reconciliation for
        //    ONE log sheet (<track-reconciliation>). This is the only place it is
        //    shown — the debrief / flight-edit screens link here for ToAviate staff.
        vm.flight = { pls_id: (parseInt($stateParams.pls, 10) > 0) ? parseInt($stateParams.pls, 10) : null, shown_id: null };   // a Number: input[type=number] rejects strings (numfmt)
        vm.runFlight = function() {
            var id = parseInt(vm.flight.pls_id, 10);
            if (!(id > 0)) { ToastService.warning('Flight analysis', 'Enter a log sheet id.'); return; }
            vm.flight.shown_id = id;
            $state.go('.', { pls: id }, { notify: false, location: 'replace' });
        };
        if (vm.flight.pls_id) { $timeout(function() { vm.runFlight(); vm.jump('flight'); }, 300); }

        vm.runInspect = function() {
            var ins = vm.inspect;
            var id = parseInt(ins.file_id, 10);
            if (!id) { ins.error = 'Enter a file id.'; return; }
            ins.busy = true;
            ins.error = null;
            ins.data = null;
            FoxTrackService.GetFile(id).then(function(data) {
                ins.busy = false;
                if (!data.success && data.error) {
                    ins.error = errorText(data, 'The file could not be loaded.');
                    return;
                }
                ins.data = shapeInspect(id, data);
            });
        };

        // The guide gives the pls/{id} shape minus the sheet blocks; `track`
        // is "summary_for_file as in §1" — accept it either as the summary
        // itself or wrapped as { summary, events }.
        function shapeInspect(id, d) {
            var tracker = d.tracker || null;
            var trackRaw = d.track || d.track_events || null;
            var summary = trackRaw ? (trackRaw.summary || trackRaw) : null;
            var events = trackRaw && angular.isArray(trackRaw.events) ? trackRaw.events : [];
            var comparison = d.comparison || null;
            var recommended = d.recommended || null;
            var recRows = [];
            if (recommended) {
                angular.forEach(['takeoff_time', 'landing_time', 'landings', 'full_stop_landings', 'stop_and_gos', 'touch_and_gos', 'go_arounds', 'airborne_seconds'], function(k) {
                    if (recommended[k] && typeof recommended[k] === 'object') {
                        recRows.push({ field: k, value: recommended[k].value, source: recommended[k].source, reason: recommended[k].reason });
                    }
                });
            }
            return {
                file_id: id,
                file: d.file || null,
                tracker: tracker,
                tracker_pairs: tracker && angular.isArray(tracker.pairs) ? tracker.pairs : [],
                tracker_scalars: tracker ? scalarsOf(tracker, ['pairs', 'available']) : [],
                summary: summary,
                summary_scalars: summary ? scalarsOf(summary, ['tracker_pair_checks', 'available']) : [],
                pair_checks: summary && angular.isArray(summary.tracker_pair_checks) ? summary.tracker_pair_checks : [],
                events: events,
                comparison: comparison,
                matched: comparison && angular.isArray(comparison.matched) ? comparison.matched : [],
                tracker_only: comparison && angular.isArray(comparison.tracker_only) ? comparison.tracker_only : [],
                track_only: comparison && angular.isArray(comparison.track_only) ? comparison.track_only : [],
                notes: comparison && angular.isArray(comparison.notes) ? comparison.notes : [],
                recommended: recRows,
                flags: recommended && angular.isArray(recommended.flags) ? recommended.flags : [],
                policy: recommended && recommended.policy ? recommended.policy : null,
                available: !!(trackRaw && (trackRaw.available !== false))
            };
        }

        vm.sourceCls = function(src) {
            return ({ agreed: 'ftt-chip--green', track: 'ftt-chip--blue', tracker: 'ftt-chip--grey' })[src] || 'ftt-chip--grey';
        };

        // ═══════════════════════════════════════════════════════
        // 4. Mis-linked recordings
        // ═══════════════════════════════════════════════════════
        vm.links = {
            imei: ($stateParams.imei || '').trim(),
            limit: 100,
            batch: 'v1-' + today + '-manual',   // one label per session: repair + every manual resolve
            scan_busy: false,
            scan: null,              // last scan response (shaped)
            candidates: [],
            skip_count: 0,
            scan_error: null
        };

        vm.runScan = function() {
            var l = vm.links;
            l.scan_busy = true;
            l.scan_error = null;
            var params = {};
            if ((l.imei || '').trim()) { params.imei = l.imei.trim(); }
            if (parseInt(l.limit, 10) > 0) { params.limit = parseInt(l.limit, 10); }
            FoxTrackService.LinksScan(params).then(function(data) {
                l.scan_busy = false;
                if (!data.success && data.error) {
                    l.scan_error = errorText(data, 'The scan failed.');
                    ToastService.error('Scan Failed', l.scan_error);
                    return;
                }
                var rows = data.candidates || [];
                rows.forEach(prepCandidate);
                l.candidates = rows;
                l.skip_count = rows.filter(vm.resolvable).length;
                l.scan = { scalars: scalarsOf(data, ['success', 'candidates']), ran_at: new Date() };
            });
        };

        // Per-row transient state (underscore convention). Resolvable rows
        // preselect the entry with sheets / a claim — the guide's preference.
        function prepCandidate(c) {
            c._open = false;
            c._busy = false;
            c._error = null;
            c._pick = null;
            if (vm.resolvable(c)) {
                var best = null;
                c.candidate_entries.forEach(function(e) {
                    var score = (parseInt(e.sheets, 10) || 0) * 10 + (e.claimed ? 1 : 0);
                    if (score > 0 && (!best || score > best.score)) { best = { id: e.id, score: score }; }
                });
                if (best) { c._pick = 'e' + best.id; }
            }
        }

        vm.resolvable = function(c) {
            return c.action === 'skip' && angular.isArray(c.candidate_entries) && c.candidate_entries.length > 0;
        };

        vm.toggleCandidate = function(c) {
            if (!vm.resolvable(c)) { return; }
            c._open = !c._open;
        };

        var ACTIONS = {
            relink:       { label: 'relink',       cls: 'ftt-chip--blue',  icon: 'fa-link' },
            create_entry: { label: 'create entry', cls: 'ftt-chip--green', icon: 'fa-plus' },
            unlink:       { label: 'unlink',       cls: 'ftt-chip--amber', icon: 'fa-unlink' },
            skip:         { label: 'skip',         cls: 'ftt-chip--grey',  icon: 'fa-hand-paper' }
        };
        vm.actionMeta = function(action) {
            return ACTIONS[action] || { label: action || '—', cls: 'ftt-chip--grey', icon: 'fa-circle' };
        };

        var REASONS = {
            ambiguous:               'several entries cover this recording — a person decides',
            covering_entry_has_file: 'the covering entry already has its own recording',
            no_covering_entry:       'no entry covers this time range',
            file_mismatch:           'the linked entry does not cover the recording'
        };
        vm.reasonText = function(reason) { return REASONS[reason] || (reason ? String(reason).replace(/_/g, ' ') : ''); };

        // ── Repair (looped) ──
        vm.repair = freshRepair();
        function freshRepair() {
            return { confirm: false, running: false, stop: false, loops: 0, changed_total: 0, last: null, error: null, finished: false, stalled: false, limit: 50 };
        }

        vm.repairAsk = function() { vm.repair.confirm = true; };
        vm.repairCancel = function() { vm.repair.confirm = false; };
        vm.stopRepair = function() { vm.repair.stop = true; };

        vm.runRepair = function() {
            if (vm.repair.running) { return; }
            var limit = parseInt(vm.repair.limit, 10) || 50;
            vm.repair = freshRepair();
            vm.repair.limit = limit;
            vm.repair.running = true;
            repairLoop(0);
        };

        function repairLoop(stalls) {
            var r = vm.repair;
            var body = { batch: (vm.links.batch || '').trim() || undefined, limit: r.limit };
            if ((vm.links.imei || '').trim()) { body.imei = vm.links.imei.trim(); }
            FoxTrackService.LinksRepair(body).then(function(data) {
                if (!data.success) {
                    r.running = false;
                    r.error = errorText(data, 'The repair request failed.');
                    ToastService.error('Repair Failed', r.error);
                    return;
                }
                r.loops++;
                r.last = { scalars: scalarsOf(data, ['success', 'rows', 'results']), changed: parseInt(data.changed, 10) || 0 };
                r.changed_total += r.last.changed;
                stalls = r.last.changed === 0 ? stalls + 1 : 0;

                if (r.last.changed === 0 || r.stop) {
                    finishRepair(false);
                } else if (r.loops >= MAX_LOOPS) {
                    finishRepair(true);
                } else {
                    repairLoop(stalls);
                }
            });
        }

        function finishRepair(stalled) {
            var r = vm.repair;
            r.running = false;
            r.finished = true;
            r.stalled = stalled;
            if (stalled) {
                ToastService.warning('Repair Paused', 'Stopped after ' + r.loops + ' loops with files still changing — re-run to continue.');
            } else {
                ToastService.success(r.stop ? 'Repair Stopped' : 'Repair Complete', r.changed_total + ' recording(s) re-pointed in batch ' + vm.links.batch + '.');
            }
            // The scan is now stale — refresh it so the table reflects the repair.
            vm.runScan();
        }

        // ── Undo a batch ──
        vm.undo = { batch: vm.links.batch, confirm: false, busy: false, result: null, error: null };

        vm.undoAsk = function() {
            if (!(vm.undo.batch || '').trim()) { vm.undo.error = 'Enter the batch label to undo.'; return; }
            vm.undo.error = null;
            vm.undo.confirm = true;
        };
        vm.undoCancel = function() { vm.undo.confirm = false; };

        vm.runUndo = function() {
            var u = vm.undo;
            if (u.busy) { return; }
            u.busy = true;
            u.error = null;
            FoxTrackService.LinksUndo((u.batch || '').trim()).then(function(data) {
                u.busy = false;
                u.confirm = false;
                if (!data.success) {
                    u.error = errorText(data, 'The batch could not be undone.');
                    ToastService.error('Undo Failed', u.error);
                    return;
                }
                var left = data.entries_left;
                u.result = {
                    batch: u.batch,
                    scalars: scalarsOf(data, ['success', 'entries_left']),
                    entries_left: angular.isArray(left) ? left : (left === undefined || left === null ? [] : [left]),
                    entries_left_count: angular.isArray(left) ? left.length : (parseInt(left, 10) || 0)
                };
                ToastService.success('Batch Undone', 'Pointers restored for batch ' + u.batch + (u.result.entries_left_count ? '; ' + u.result.entries_left_count + ' created entr' + (u.result.entries_left_count === 1 ? 'y stays.' : 'ies stay.') : '.'));
                vm.runScan();
            });
        };

        // ── Report ──
        vm.report = { batch: '', busy: false, rows: [], cols: [], batches: [], scalars: [], error: null, loaded: false };

        vm.runReport = function() {
            var rp = vm.report;
            rp.busy = true;
            rp.error = null;
            FoxTrackService.LinksReport((rp.batch || '').trim()).then(function(data) {
                rp.busy = false;
                if (!data.success && data.error) {
                    rp.error = errorText(data, 'The report could not be loaded.');
                    ToastService.error('Report Failed', rp.error);
                    return;
                }
                rp.loaded = true;
                var rows = firstArray(data, ['rows', 'repairs', 'items', 'log', 'entries']);
                var batches = angular.isArray(data.batches) ? data.batches : [];
                rp.rows = rows;
                rp.cols = columnsOf(rows, ['id', 'batch', 'file_id', 'old_entry_id', 'new_entry_id', 'action', 'reason', 'created_at', 'undone_at']);
                rp.batches = batches;
                rp.batch_cols = columnsOf(batches, ['batch', 'rows', 'count', 'files', 'relinked', 'created', 'unlinked', 'undone', 'first_at', 'last_at']);
                rp.scalars = scalarsOf(data, ['success', 'rows', 'repairs', 'items', 'log', 'entries', 'batches']);
            });
        };

        vm.reportBatch = function(batch) {
            if (!batch) { return; }
            vm.report.batch = batch;
            vm.runReport();
        };

        // ── Resolve an ambiguous link (§4.1) ──
        var RESOLVE_ERRORS = {
            BAD_DECISION:        'Pick an entry, "create a new entry" or "unlink".',
            NOT_FOUND:           'That recording is no longer a candidate — re-run the scan.',
            ENTRY_REQUIRED:      'Choose which entry this recording belongs to.',
            ENTRY_NOT_FOUND:     'That entry no longer exists — re-run the scan.',
            ENTRY_IMEI_MISMATCH: 'That entry belongs to a different tracker.',
            ALREADY_LINKED:      'This recording is already linked to that entry.',
            ALREADY_UNLINKED:    'This recording is already unlinked.',
            FILE_MISSING:        'The recording file is missing on disk — nothing to link.',
            APPLY_FAILED:        'The change could not be applied — nothing was changed.',
            FORBIDDEN:           'You do not have access to resolve recordings.'
        };

        vm.last_resolve = null;   // persists above the table across the re-scan

        vm.resolve = function(c) {
            if (c._busy) { return; }
            if (!c._pick) { c._error = RESOLVE_ERRORS.ENTRY_REQUIRED; return; }
            var body = { file_id: c.file_id, batch: (vm.links.batch || '').trim() || undefined };
            if (c._pick === 'create') {
                body.decision = 'create';
            } else if (c._pick === 'unlink') {
                body.decision = 'unlink';
            } else {
                body.decision = 'entry';
                body.entry_id = parseInt(String(c._pick).slice(1), 10);
            }
            c._busy = true;
            c._error = null;
            FoxTrackService.LinksResolve(body).then(function(data) {
                c._busy = false;
                if (!data.success) {
                    c._error = RESOLVE_ERRORS[data.error] || errorText(data, 'The recording could not be resolved.');
                    ToastService.error('Not Resolved', c._error);
                    return;
                }
                vm.last_resolve = {
                    file_id: data.file_id || c.file_id,
                    decision: body.decision,
                    action: data.action,
                    old_entry_id: data.old_entry_id,
                    new_entry_id: data.new_entry_id,
                    entry_created: !!data.entry_created,
                    batch: data.batch || body.batch,
                    note: data.note || null,
                    existing: data.target_entry_existing_file || null
                };
                var what = body.decision === 'unlink' ? 'unlinked' : (body.decision === 'create' ? 'moved to new entry #' + data.new_entry_id : 'linked to entry #' + data.new_entry_id);
                ToastService.success('Recording Resolved', 'File #' + vm.last_resolve.file_id + ' ' + what + '.' + (data.note ? ' ' + data.note : ''));
                // Drop the row, then refresh the scan so a now-visible file
                // (entry_covers_it:false) comes back for its own decision.
                c._resolved = true;
                $timeout(function() {
                    var idx = vm.links.candidates.indexOf(c);
                    if (idx > -1) { vm.links.candidates.splice(idx, 1); }
                    vm.links.skip_count = vm.links.candidates.filter(vm.resolvable).length;
                    vm.runScan();
                }, 350);
            });
        };

        // ═══════════════════════════════════════════════════════
        // Display helpers
        // ═══════════════════════════════════════════════════════
        vm.ts = function(s) {
            if (!s) { return '—'; }
            s = String(s);
            return s.length >= 16 ? s.slice(0, 16) : s;
        };

        // "2026-04-02 09:58 → 10:41" when same-day, both stamps otherwise.
        vm.window = function(a, b) {
            a = a ? String(a) : '';
            b = b ? String(b) : '';
            if (!a && !b) { return '—'; }
            if (!a) { return '… → ' + vm.ts(b); }
            if (!b) { return vm.ts(a) + ' → …'; }
            if (a.slice(0, 10) === b.slice(0, 10)) { return a.slice(0, 16) + ' → ' + b.slice(11, 16); }
            return a.slice(0, 16) + ' → ' + b.slice(0, 16);
        };

        vm.basename = function(path) {
            if (!path) { return ''; }
            var parts = String(path).split('/');
            return parts[parts.length - 1];
        };

        vm.duration = function(seconds) {
            if (seconds === null || seconds === undefined || seconds === '') { return '—'; }
            seconds = parseInt(seconds, 10) || 0;
            var h = Math.floor(seconds / 3600);
            var m = Math.round((seconds % 3600) / 60);
            if (h > 0) { return h + ' h ' + m + ' m'; }
            return m + ' m';
        };

        vm.ago = function(ts) {
            if (!ts) { return '—'; }
            var m = ts instanceof Date ? moment(ts) : moment(String(ts).replace(' ', 'T'));
            return m.isValid() ? m.fromNow() : String(ts);
        };

        vm.pct = function(x) {
            if (x === null || x === undefined || x === '') { return '—'; }
            return Math.round(parseFloat(x) * 100) + '%';
        };

        vm.label = function(k) { return String(k || '').replace(/_/g, ' '); };

        vm.fmt = function(v) {
            if (v === null || v === undefined) { return '—'; }
            if (v === true) { return 'yes'; }
            if (v === false) { return 'no'; }
            return String(v);
        };

        vm.copy = function(text) {
            if (!text) { return; }
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text);
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                ToastService.success('Copied', text);
            } catch (e) {}
        };

        // ═══════════════════════════════════════════════════════
        // 6. Airborne time (maintenance hours) — the supervised recompute
        //    over the history (dry run → review → apply, chunked through
        //    planes/fix_times) and "explain one sheet" (planes/airborne_explain).
        //    BACKEND_AIRBORNE_SOURCE_GUIDE.md §5 / §6.
        // ═══════════════════════════════════════════════════════
        var AIR_SRC = {
            track_file: 'track file', tracker: 'tracker', clock: 'take-off / landing clock',
            brakes_allowance: 'brakes − 10 min', manual: 'set by hand', legacy: 'stored (legacy)'
        };
        vm.air = {
            days: '', plane_id: '', busy: false, mode: null, report: null, error: null, confirm: false, progress: null,
            explain_id: vm.flight.pls_id || '', explain: null, explain_busy: false, explain_error: null, reset_confirm: false, reset_busy: false,
            redo: false, redo_word: ''   // deliberate redo of the one-off (deployment window only)
        };
        vm.airSourceLabel = function(src) { return AIR_SRC[src] || src || '—'; };
        vm.airHm = function(hours) {
            var h = parseFloat(hours);
            if (isNaN(h)) { return '—'; }
            var mins = Math.round(h * 60);
            return Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2);
        };
        // {k: v} → [{k, v}] for ng-repeat. Cached per object: a fresh array on
        // every digest makes ng-repeat re-render forever ($rootScope:infdig).
        var airPairsCache = [];
        vm.airPairs = function(obj) {
            if (!obj) { return []; }
            for (var i = 0; i < airPairsCache.length; i++) { if (airPairsCache[i].obj === obj) { return airPairsCache[i].out; } }
            var out = [];
            angular.forEach(obj, function(v, k) { out.push({ k: k, v: v }); });
            if (airPairsCache.length > 200) { airPairsCache.shift(); }
            airPairsCache.push({ obj: obj, out: out });
            return out;
        };

        // chunk reports → one report (sums, merged maps, top-20 moves)
        function airMerge(acc, d) {
            if (!acc) {
                acc = { run_id: d.run_id, mode: d.mode, dry_run: d.dry_run, days: d.days, scope: d.scope, scope_note: d.scope_note, checked: 0, updated: 0, hours_changed: 0, source_changed: 0, settled: 0, left_provisional: 0,
                        total_delta_hours: 0, by_source: {}, by_transition: {}, flags: {}, provisional_reasons: {}, biggest_moves: [], planes: {}, rebuilt: {}, chunks: 0 };
            }
            acc.chunks++;
            angular.forEach(['checked', 'updated', 'hours_changed', 'source_changed', 'settled', 'left_provisional', 'total_delta_hours'], function(k) { acc[k] += Number(d[k] || 0); });
            angular.forEach(d.by_source || {}, function(v, k) { acc.by_source[k] = (acc.by_source[k] || 0) + v; });
            angular.forEach(d.by_transition || {}, function(v, k) { acc.by_transition[k] = (acc.by_transition[k] || 0) + v; });
            angular.forEach(d.provisional_reasons || {}, function(v, k) { acc.provisional_reasons[k] = (acc.provisional_reasons[k] || 0) + v; });
            angular.forEach(d.flags || {}, function(v, k) {
                if (!acc.flags[k]) { acc.flags[k] = { count: 0, sample_ids: [] }; }
                acc.flags[k].count += v.count || 0;
                acc.flags[k].sample_ids = acc.flags[k].sample_ids.concat(v.sample_ids || []).slice(0, 25);
            });
            angular.forEach(d.planes || {}, function(v, k) { if (!acc.planes[k] || v < acc.planes[k]) { acc.planes[k] = v; } });
            acc.biggest_moves = acc.biggest_moves.concat(d.biggest_moves || []);
            acc.biggest_moves.sort(function(a, b) { return Math.abs(b.delta_hours) - Math.abs(a.delta_hours); });
            acc.biggest_moves = acc.biggest_moves.slice(0, 20);
            if (d.rebuilt && Object.keys(d.rebuilt).length) { acc.rebuilt = d.rebuilt; }
            acc.total_delta_hours = Math.round(acc.total_delta_hours * 10000) / 10000;
            acc.plane_count = Object.keys(acc.planes).length;
            return acc;
        }

        // A run is a chain of chunked requests. If one fails (server wall, network),
        // nothing already written is lost: the state is kept in a.resume and the
        // Resume button continues from the last cursor with the same run id.
        vm.airRun = function(apply, resume) {
            var a = vm.air;
            if (a.busy) { return; }
            if (apply && !a.confirm && !resume) { a.confirm = true; return; }
            a.confirm = false;
            var st = (resume && a.resume) ? a.resume : { apply: apply, after_id: 0, run_id: null, acc: null,
                redo: (a.redo && a.redo_word === 'REDO'), days: parseInt(a.days, 10) > 0 ? parseInt(a.days, 10) : null,
                plane_id: parseInt(a.plane_id, 10) > 0 ? parseInt(a.plane_id, 10) : null };
            a.resume = null;
            a.busy = true; a.error = null; a.report = null; a.progress = { checked: st.acc ? st.acc.checked : 0 }; a.mode = st.apply ? 'apply' : 'dry';
            function fail(msg) {
                a.busy = false;
                a.error = msg;
                a.resume = st;   // Resume picks up here
                ToastService.error('Recompute Stopped', msg);
            }
            function step(after_id) {
                st.after_id = after_id || 0;
                var params = { apply: st.apply ? 1 : 0, after_id: st.after_id, budget_s: 12 };
                if (st.redo) { params.redo_one_off = 1; params.confirm = 'REDO'; }
                if (st.days) { params.days = st.days; }
                if (st.plane_id) { params.plane_id = st.plane_id; }
                if (st.run_id) { params.run_id = st.run_id; }
                PlaneService.AirborneRecompute(params).then(function(data) {
                    if (!data || !data.success) {
                        // a CHUNK_FAILED answer carries the cursor; an HTTP failure keeps the last one
                        if (data && data.next_after_id) { st.after_id = data.next_after_id; }
                        if (data && data.run_id) { st.run_id = data.run_id; }
                        fail(errorText(data, 'The airborne-time recompute failed.'));
                        return;
                    }
                    st.run_id = data.run_id;
                    st.acc = airMerge(st.acc, data);
                    a.progress = { checked: st.acc.checked, chunks: st.acc.chunks };
                    if (data.done === false && data.next_after_id) { step(data.next_after_id); return; }
                    a.busy = false;
                    a.report = st.acc;
                    if (st.apply) { vm.airRuns(); }
                    ToastService.success(st.apply ? 'Airborne Times Applied' : 'Dry Run Complete',
                        st.acc.checked + ' sheet(s) checked, ' + st.acc.updated + (st.apply ? ' written' : ' would change') + ' (' + st.acc.hours_changed + ' with different hours).');
                    // the logbooks: queued for the background worker — watch the batch
                    if (st.apply && data.rebuild_batch) { ToastService.success('Logbook Rebuild Queued', (data.rebuild_pending || []).length + ' aircraft queued; you will be emailed when it is done.'); airWatchBatch(data.rebuild_batch); }
                }, function() {
                    fail('The request failed — press Resume to continue from where it stopped.');
                });
            }
            step(st.after_id);
        };

        // Logbook rebuild runs in the BACKGROUND: the server queues one job per
        // logbook, the planes/airborne_worker cron works them off every minute,
        // and the requester gets an email when the batch is done. The page just
        // polls the batch status while it is open — it can be closed any time.
        vm.airRebuildStatus = function(batch) {
            var a = vm.air;
            PlaneService.AirborneRebuildStatus(batch || null).then(function(data) {
                if (!data || !data.success) { a.rebuild_status_error = errorText(data, 'The rebuild status could not be loaded.'); return; }
                a.rebuild_status_error = null;
                a.rebuild_status = data;
                var b = batch ? (data.batches || []).filter(function(x) { return x.batch_id === batch; })[0] : (data.batches || [])[0];
                a.rebuild_batch_info = b || null;
                if (b && !b.complete && !a.rebuild_poll) {
                    a.rebuild_poll = $timeout(function() { a.rebuild_poll = null; vm.airRebuildStatus(batch); }, 5000);
                }
                if (b && b.complete && a.rebuild_watching === b.batch_id) {
                    a.rebuild_watching = null;
                    (b.failed ? ToastService.warning : ToastService.success)('Logbook Rebuild Finished', b.done + ' of ' + b.total + ' logbook(s) rebuilt across ' + b.planes + ' aircraft' + (b.failed ? ', ' + b.failed + ' failed.' : '.'));
                    vm.airRuns();
                }
            });
        };
        function airWatchBatch(batch) {
            var a = vm.air;
            a.rebuild_batch = batch;
            a.rebuild_watching = batch;
            if (a.rebuild_poll) { $timeout.cancel(a.rebuild_poll); a.rebuild_poll = null; }
            vm.airRebuildStatus(batch);
        }
        $scope.$on('$destroy', function() { if (vm.air.rebuild_poll) { $timeout.cancel(vm.air.rebuild_poll); } });

        // manual fallback: run the worker for ~15 s from here (it also re-kicks the chain)
        vm.airRebuildNudge = function() {
            var a = vm.air;
            if (a.nudge_busy) { return; }
            a.nudge_busy = true;
            PlaneService.AirborneRebuildNudge().then(function(data) {
                a.nudge_busy = false;
                if (!data || !data.success) { ToastService.error('Nudge Failed', errorText(data, 'The worker could not be run.')); return; }
                ToastService.success('Worker Ran', (data.ran || []).length + ' job(s) done this nudge, ' + data.queued_left + ' left' + (data.chained ? ' — chain re-kicked.' : '.'));
                vm.airRebuildStatus(a.rebuild_batch || null);
            });
        };

        vm.airRebuildTouched = function() {
            var a = vm.air;
            if (a.rebuild_busy) { return; }
            if (!a.rebuild_confirm) { a.rebuild_confirm = true; return; }
            a.rebuild_confirm = false; a.rebuild_busy = true;
            PlaneService.AirborneRebuildTouched().then(function(data) {
                a.rebuild_busy = false;
                if (!data || !data.success) { ToastService.error('Rebuild Failed', errorText(data, 'The rebuild could not be queued.')); return; }
                if (!data.rebuild_batch) { ToastService.success('Nothing To Rebuild', 'No applied run has changed any flight.'); return; }
                ToastService.success('Logbook Rebuild Queued', data.message);
                airWatchBatch(data.rebuild_batch);
            });
        };
        vm.airRebuildStatus(null);

        // previous runs — survives a lost page (logout / closed tab)
        vm.airRuns = function() {
            var a = vm.air;
            a.runs_busy = true; a.runs_error = null;
            PlaneService.AirborneRuns(20).then(function(data) {
                a.runs_busy = false;
                if (!data || !data.success) { a.runs_error = errorText(data, 'The runs could not be loaded.'); return; }
                a.runs = data;
            });
        };
        vm.airRuns();

        vm.airExplain = function() {
            var a = vm.air;
            var id = parseInt(a.explain_id, 10);
            if (!id) { a.explain_error = 'Enter a log sheet id.'; return; }
            a.explain_busy = true; a.explain_error = null; a.explain = null; a.reset_confirm = false;
            PlaneService.AirborneExplain(id).then(function(data) {
                a.explain_busy = false;
                if (!data || !data.success) { a.explain_error = errorText(data, 'The sheet could not be explained.'); return; }
                a.explain = data;
            });
        };

        vm.airReset = function() {
            var a = vm.air;
            if (!a.explain || a.reset_busy) { return; }
            if (!a.reset_confirm) { a.reset_confirm = true; return; }
            a.reset_confirm = false; a.reset_busy = true;
            PlaneService.AirborneReset(a.explain.sheet.id, 'Track tools').then(function(data) {
                a.reset_busy = false;
                if (!data || !data.success) { ToastService.error('Re-evaluate Failed', errorText(data, 'The sheet could not be re-evaluated.')); return; }
                ToastService.success('Sheet Re-evaluated', 'Airborne ' + vm.airHm(data.airborne_time) + ' · ' + vm.airSourceLabel(data.airborne_source) + (data.hours_changed ? ' — logbooks rebuilt.' : ' — no change in hours.'));
                vm.airExplain();
            });
        };

        vm.jump = function(id) {
            var el = document.getElementById('ftt-' + id);
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
        };

        // Prefill the inspect box from a scan row.
        vm.inspectFile = function(file_id) {
            vm.inspect.file_id = file_id;
            vm.runInspect();
            vm.jump('inspect');
        };

        // ── Response shaping (computed once per response — ng-repeat compares
        //    by reference, so these must never be built per digest) ──
        function scalarsOf(obj, skip) {
            var out = [];
            if (!obj || typeof obj !== 'object') { return out; }
            skip = skip || [];
            Object.keys(obj).forEach(function(k) {
                if (skip.indexOf(k) > -1) { return; }
                var v = obj[k];
                if (v === null || typeof v !== 'object') { out.push({ k: k, label: k.replace(/_/g, ' '), v: v }); }
            });
            return out;
        }

        function countOf(obj, keys) {
            for (var i = 0; i < keys.length; i++) {
                if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && !isNaN(parseInt(obj[keys[i]], 10))) { return parseInt(obj[keys[i]], 10); }
            }
            return 0;
        }

        function firstArray(obj, keys) {
            for (var i = 0; i < keys.length; i++) {
                if (angular.isArray(obj[keys[i]])) { return obj[keys[i]]; }
            }
            return [];
        }

        // Union of the rows' scalar keys, preferred order first.
        function columnsOf(rows, preferred) {
            var seen = {};
            var cols = [];
            (rows || []).forEach(function(row) {
                if (!row || typeof row !== 'object') { return; }
                Object.keys(row).forEach(function(k) {
                    var v = row[k];
                    if (!seen[k] && (v === null || typeof v !== 'object')) { seen[k] = true; cols.push(k); }
                });
            });
            cols.sort(function(a, b) {
                var ia = preferred.indexOf(a), ib = preferred.indexOf(b);
                if (ia === -1) { ia = 999; }
                if (ib === -1) { ib = 999; }
                return ia - ib || (a < b ? -1 : a > b ? 1 : 0);
            });
            return cols.map(function(k) { return { k: k, label: k.replace(/_/g, ' ') }; });
        }

        function errorText(data, fallback) {
            if (!data) { return fallback; }
            if (data.message && typeof data.message === 'string') { return data.message; }
            if (data.error) { return String(data.error).replace(/_/g, ' ').toLowerCase(); }
            return fallback;
        }

        // Deep-linked from the health board — run the scan straight away.
        if (vm.links.imei) {
            vm.runScan();
            $timeout(function() { vm.jump('links'); }, 400);
        }
    }
