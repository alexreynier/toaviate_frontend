// ─────────────────────────────────────────────────────
// "The Pilot Centre style import" — training-records workbook import.
//   TpcImportController    — import home (dropzone + previous runs),
//                            embedded in Settings → Data Import.
//   TpcImportRunController — run review dashboard: summary tiles that
//                            filter, paged row table, bulk actions,
//                            apply-all / revert, and the row drawer
//                            (compare/edit/match/people, keyboard-first).
// Contract: FRONTEND_TPC_IMPORT_GUIDE.md.
// ─────────────────────────────────────────────────────

app.controller('TpcImportController', TpcImportController);

    TpcImportController.$inject = ['TpcImportService', 'ToastService', '$rootScope', '$scope', '$state'];
    function TpcImportController(TpcImportService, ToastService, $rootScope, $scope, $state) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin.id;
        vm.is_manager = (vm.user.access.manager || []).indexOf(vm.club_id) > -1 ||
                        (vm.user.access.super_admin || []).length > 0;
        if (!vm.is_manager) { return; }

        vm.runs = [];
        vm.loading = false;
        vm.uploading = false;
        vm.drag_over = false;
        vm.confirm = null;   // { type: 'delete'|'reprocess', run }

        vm.load = function() {
            vm.loading = true;
            TpcImportService.GetRuns(vm.club_id).then(function(data) {
                vm.loading = false;
                vm.runs = (data && (data.runs || data.items)) || [];
            });
        };
        vm.load();

        vm.setDragState = function(isDragging) { vm.drag_over = isDragging; };

        vm.onFiles = function(files) {
            if (!files || !files.length || vm.uploading) { return; }
            var file = files[0];
            if (!/\.xlsx$/i.test(file.name)) {
                ToastService.warning('Not An Excel Workbook', 'Save the workbook as .xlsx and try again.');
                return;
            }
            if (file.size > 100 * 1024 * 1024) {
                ToastService.warning('Too Large', 'The workbook is over the 100 MB limit.');
                return;
            }
            vm.uploading = true;
            TpcImportService.Upload(vm.club_id, file).then(function(data) {
                vm.uploading = false;
                if (data && data.success) {
                    ToastService.success('Workbook Uploaded', 'Processing has started — matching flights & people.');
                    $state.go('dashboard.manage_club.tpc_import_run', { run_id: data.run_id });
                } else if (data && data.error === 'NOT_XLSX') {
                    ToastService.warning('Not An Excel Workbook', 'Save the workbook as .xlsx and try again.');
                } else if (data && data.error === 'TOO_LARGE') {
                    ToastService.warning('Too Large', 'The workbook is over the 100 MB limit.');
                } else {
                    ToastService.error('Upload Failed', (data && data.message) || 'The workbook could not be uploaded.');
                }
            });
        };

        vm.review = function(run) {
            $state.go('dashboard.manage_club.tpc_import_run', { run_id: run.id });
        };

        vm.statusMeta = function(run) {
            switch (run.status) {
                case 'ready':      return { cls: 'ok',    label: 'Ready',      icon: 'fa-check-circle' };
                case 'processing': return { cls: 'busy',  label: 'Processing', icon: 'fa-sync fa-spin' };
                case 'applying':   return { cls: 'busy',  label: 'Applying',   icon: 'fa-sync fa-spin' };
                case 'failed':     return { cls: 'bad',   label: 'Failed',     icon: 'fa-times-circle' };
                default:           return { cls: 'muted', label: run.status,   icon: 'fa-circle' };
            }
        };

        vm.askConfirm = function(type, run) { vm.confirm = { type: type, run: run, busy: false }; };
        vm.closeConfirm = function() { vm.confirm = null; };

        vm.doConfirm = function() {
            var c = vm.confirm;
            if (!c || c.busy) { return; }
            c.busy = true;
            if (c.type === 'delete') {
                TpcImportService.DeleteRun(c.run.id).then(function(data) {
                    vm.confirm = null;
                    if (data && data.success) {
                        ToastService.success('Run Deleted', '"' + c.run.file_name + '" removed.');
                        vm.load();
                    } else if (data && data.error === 'HAS_APPLIED_ROWS') {
                        ToastService.warning('Has Applied Rows', 'This run has applied rows — revert the import first (from its review page), then delete.');
                    } else {
                        ToastService.error('Not Deleted', (data && data.message) || 'The run could not be deleted.');
                    }
                });
            } else {
                TpcImportService.Process(c.run.id).then(function(data) {
                    vm.confirm = null;
                    if (data && data.success) {
                        ToastService.success('Re-processing', 'Staged rows are being rebuilt from the workbook.');
                        $state.go('dashboard.manage_club.tpc_import_run', { run_id: c.run.id });
                    } else if (data && data.error === 'RUN_BUSY') {
                        // Already working — don't re-POST; the run page polls it.
                        ToastService.warning('Run Busy', data.message || 'This run is already working.');
                        $state.go('dashboard.manage_club.tpc_import_run', { run_id: c.run.id });
                    } else {
                        ToastService.error('Not Started', (data && data.message) || 'Re-processing could not be started.');
                    }
                });
            }
        };

        // ── Duplicate-flights cleanup (one-off recovery) ──────────────────
        // GET = read-only scan (counts + sample + confirm_token) → explicit
        // confirm → POST loop in ≤500-row batches until `remaining` is 0,
        // re-GETting a fresh token between batches. STATE_CHANGED re-scans
        // silently; RUN_BUSY / CLEANUP_BUSY stops the loop (manual resume).
        var CLEANUP_BATCH = 500;
        var CLEANUP_MAX_BATCHES = 200;   // runaway backstop
        var clBatches = 0;

        vm.cl = {
            stage: 'idle',   // idle | scanning | clean | review | running | stopped | done
            busy: false,
            preview: null,   // last GET payload
            initial: 0,      // duplicate_flights at confirm time (progress base)
            remaining: 0,
            message: '',
            totals: null     // accumulated result counters
        };

        vm.clScan = function() {
            vm.cl.busy = true;
            vm.cl.stage = 'scanning';
            vm.cl.message = '';
            TpcImportService.CleanupPreview(vm.club_id).then(function(data) {
                vm.cl.busy = false;
                if (!data || data.success === false) {
                    vm.cl.stage = 'idle';
                    if (data && (data.error === 'RUN_BUSY' || data.error === 'CLEANUP_BUSY')) {
                        ToastService.warning('Busy', data.message || 'A run or cleanup is already working — try again shortly.');
                    } else {
                        ToastService.error('Scan Failed', (data && data.message) || 'The duplicate scan could not run.');
                    }
                    return;
                }
                vm.cl.preview = data;
                vm.cl.stage = (data.duplicate_flights > 0 || data.kept_for_review > 0) ? 'review' : 'clean';
            });
        };

        vm.clConfirm = function() {
            if (!vm.cl.preview || vm.cl.busy) { return; }
            vm.cl.stage = 'running';
            vm.cl.initial = vm.cl.preview.duplicate_flights || 0;
            vm.cl.remaining = vm.cl.initial;
            vm.cl.totals = { deleted_flights: 0, deleted_training_records: 0, repointed_split_legs: 0, repointed_staging_rows: 0 };
            clBatches = 0;
            clPost(vm.cl.preview.confirm_token);
        };

        // Manual resume after a busy stop — restarts from a fresh scan.
        vm.clResume = function() { clRescan(); };
        vm.clReset = function() { if (!vm.cl.busy) { vm.cl.stage = 'idle'; vm.cl.preview = null; vm.cl.message = ''; } };

        function clPost(token) {
            if (++clBatches > CLEANUP_MAX_BATCHES) {
                clStop('Stopped after ' + CLEANUP_MAX_BATCHES + ' batches — re-run the scan to continue.');
                return;
            }
            vm.cl.busy = true;
            TpcImportService.CleanupRun(vm.club_id, token, CLEANUP_BATCH).then(function(data) {
                if (data && data.success !== false && data.result) {
                    var r = data.result, t = vm.cl.totals;
                    t.deleted_flights          += r.deleted_flights || 0;
                    t.deleted_training_records += r.deleted_training_records || 0;
                    t.repointed_split_legs     += r.repointed_split_legs || 0;
                    t.repointed_staging_rows   += r.repointed_staging_rows || 0;
                    vm.cl.remaining = data.remaining || 0;
                    if (vm.cl.remaining > 0) { clRescan(); } else { clFinish(); }
                    return;
                }
                var err = data && data.error;
                if (err === 'STATE_CHANGED') {
                    clRescan();   // token stale — silently re-scan and continue
                } else if (err === 'RUN_BUSY' || err === 'CLEANUP_BUSY') {
                    clStop((data && data.message) || 'Another run or cleanup is working — resume when it finishes.');
                } else if (err === 'TOKEN_REQUIRED') {
                    clStop('Internal error: the confirm token went missing — please report this.');
                } else {
                    clStop((data && data.message) || 'The cleanup batch failed.');
                }
            });
        }

        function clRescan() {
            vm.cl.busy = true;
            vm.cl.stage = 'running';
            TpcImportService.CleanupPreview(vm.club_id).then(function(data) {
                if (!data || data.success === false) {
                    var err = data && data.error;
                    if (err === 'RUN_BUSY' || err === 'CLEANUP_BUSY') {
                        clStop((data && data.message) || 'Another run or cleanup is working — resume when it finishes.');
                    } else {
                        clStop((data && data.message) || 'The re-scan between batches failed.');
                    }
                    return;
                }
                vm.cl.preview = data;
                if ((data.duplicate_flights || 0) > 0 && data.confirm_token) {
                    vm.cl.remaining = data.duplicate_flights;
                    clPost(data.confirm_token);
                } else {
                    clFinish();
                }
            });
        }

        function clStop(message) {
            vm.cl.busy = false;
            vm.cl.stage = 'stopped';
            vm.cl.message = message;
        }

        function clFinish() {
            vm.cl.busy = false;
            vm.cl.remaining = 0;
            vm.cl.stage = 'done';
            var t = vm.cl.totals || {};
            ToastService.success('Cleanup Finished', (t.deleted_flights || 0) + ' duplicate flights removed.');
        }

        vm.clProgress = function() {
            if (!vm.cl.initial) { return 0; }
            var done = (vm.cl.totals && vm.cl.totals.deleted_flights) || 0;
            return Math.min(100, Math.round(100 * done / vm.cl.initial));
        };
        vm.clKeptReason = function(reason) {
            return { no_twin: 'No surviving twin flight to keep', blocked_tr: 'A training record could not be re-pointed' }[reason] || reason;
        };
    }


app.controller('TpcImportRunController', TpcImportRunController);

    TpcImportRunController.$inject = ['TpcImportService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$interval', '$timeout', '$document', '$q'];
    function TpcImportRunController(TpcImportService, ToastService, $rootScope, $scope, $state, $stateParams, $interval, $timeout, $document, $q) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin.id;
        vm.is_manager = (vm.user.access.manager || []).indexOf(vm.club_id) > -1 ||
                        (vm.user.access.super_admin || []).length > 0;
        vm.run_id = parseInt($stateParams.run_id, 10);

        vm.run = null;
        vm.summary = null;
        vm.rows = [];
        vm.total = 0;
        vm.per_page = 50;
        vm.loadingRows = false;
        vm.sel = {};                 // row id → true (bulk)
        vm.menuOpen = false;
        vm.overlay = null;           // 'apply_all' | 'revert' | 'reprocess' | 'delete'
        vm.revert_word = '';
        vm.group_mode = false;       // fix-it queue grouping
        vm.drawer = null;

        // ── Filters (URL-persisted so queues are shareable) ──
        vm.filters = {
            status: $stateParams.status || '',
            action: $stateParams.action || '',
            issue:  $stateParams.issue  || '',
            q:      $stateParams.q      || '',
            edited: $stateParams.edited || '',
            page:   parseInt($stateParams.page, 10) || 1
        };

        function syncUrl() {
            $state.go('.', {
                status: vm.filters.status || null,
                action: vm.filters.action || null,
                issue: vm.filters.issue || null,
                q: vm.filters.q || null,
                edited: vm.filters.edited || null,
                page: vm.filters.page > 1 ? vm.filters.page : null
            }, { notify: false });
        }

        // ── Run + summary polling ──
        // 2 s while processing/applying, backing off to 10 s after 2 minutes.
        var poll = null, pollCount = 0;

        function schedulePoll() {
            stopPoll();
            pollCount = 0;
            poll = $interval(tick, 2000);
        }
        function stopPoll() {
            if (poll) { $interval.cancel(poll); poll = null; }
        }
        // Backend rejects concurrent apply/process (RUN_BUSY) — grey out the
        // Apply / Re-process controls whenever the polled status says busy.
        vm.runBusy = function() {
            return !!(vm.run && (vm.run.status === 'processing' || vm.run.status === 'applying'));
        };
        function tick() {
            pollCount++;
            if (pollCount === 60) {   // 2 min at 2 s → back off
                stopPoll();
                poll = $interval(tick, 10000);
            }
            vm.loadRun(true);
        }
        $scope.$on('$destroy', function() { stopPoll(); unbindKeys(); });

        vm.loadRun = function(quiet) {
            TpcImportService.GetRun(vm.run_id).then(function(data) {
                if (!data || !data.success) {
                    if (!quiet) { ToastService.error('Load Failed', (data && data.message) || 'Run not found.'); }
                    return;
                }
                var was = vm.run && vm.run.status;
                vm.run = data.run;
                vm.summary = data.run.summary || vm.summary;
                rebuildTiles();
                var busy = vm.run.status === 'processing' || vm.run.status === 'applying';
                if (busy && !poll) { schedulePoll(); }
                if (!busy && poll) { stopPoll(); }
                if (!busy && (was === 'processing' || was === 'applying')) {
                    // Just finished — refresh the table with the outcome.
                    vm.loadRows();
                    if (was === 'applying') {
                        var st = (vm.summary && vm.summary.by_status) || {};
                        ToastService.success('Apply Finished', (st.applied || 0) + ' rows applied' + (st.failed ? ' · ' + st.failed + ' failed (filter: Failed)' : '') + '.');
                    }
                }
            });
        };

        vm.progressPct = function() {
            if (!vm.run || !vm.run.progress_total) { return 0; }
            return Math.min(100, Math.round(100 * vm.run.progress_done / vm.run.progress_total));
        };

        // ── Summary tiles (double as filters) ──
        // Precomputed (not a function) — ng-repeat over a fresh array every
        // digest would loop the digest cycle.
        vm.tileList = [];
        function rebuildTiles() {
            var s = vm.summary || {};
            var a = s.by_action || {}, st = s.by_status || {}, iss = s.issues || {};
            vm.tileList = [
                { key: 'update',   label: 'Matched flights', count: a.update || 0, cls: 'blue',  f: { action: 'update', status: 'pending', issue: '' } },
                { key: 'insert',   label: 'New flights',     count: a.insert || 0, cls: 'green', f: { action: 'insert', status: 'pending', issue: '' } },
                { key: 'time',     label: 'Time review',     count: iss.time_review || 0, cls: 'amber', f: { issue: 'time_review', status: 'pending', action: '' } },
                { key: 'people',   label: 'People to fix',   count: (iss.student_unresolved || 0) + (iss.instructor_unresolved || 0), cls: 'amber', f: { issue: 'student_unresolved', status: 'pending', action: '' } },
                { key: 'aircraft', label: 'Unknown aircraft', count: iss.unknown_aircraft || 0, cls: 'amber', f: { issue: 'unknown_aircraft', status: 'pending', action: '' } },
                { key: 'applied',  label: 'Applied',         count: st.applied || 0, cls: 'done', f: { status: 'applied', action: '', issue: '' } }
            ];
        }

        vm.tileActive = function(t) {
            return (t.f.action || '') === vm.filters.action &&
                   (t.f.issue || '') === vm.filters.issue &&
                   (t.f.status || '') === vm.filters.status;
        };

        vm.clickTile = function(t) {
            if (vm.tileActive(t)) {
                vm.filters.action = ''; vm.filters.issue = ''; vm.filters.status = '';
            } else {
                vm.filters.action = t.f.action; vm.filters.issue = t.f.issue; vm.filters.status = t.f.status;
            }
            vm.filters.page = 1;
            vm.group_mode = false;
            vm.loadRows();
        };

        // ── Rows ──
        var searchDebounce = null;
        vm.onSearch = function() {
            if (searchDebounce) { $timeout.cancel(searchDebounce); }
            searchDebounce = $timeout(function() { vm.filters.page = 1; vm.loadRows(); }, 350);
        };

        vm.loadRows = function() {
            vm.loadingRows = true;
            vm.sel = {};
            syncUrl();
            TpcImportService.GetRows(vm.run_id, {
                status: vm.filters.status, action: vm.filters.action, issue: vm.filters.issue,
                q: vm.filters.q, edited: vm.filters.edited,
                page: vm.filters.page, per_page: vm.per_page
            }).then(function(data) {
                vm.loadingRows = false;
                if (!data || !data.success) { return; }
                vm.rows = data.rows || [];
                vm.total = data.total || 0;
                rebuildDisplay();
                vm.per_page = data.per_page || vm.per_page;
                vm.rebuildGroups();
            });
        };

        vm.pages = function() { return Math.max(1, Math.ceil(vm.total / vm.per_page)); };
        vm.goPage = function(p) {
            p = Math.min(Math.max(1, p), vm.pages());
            if (p === vm.filters.page) { return; }
            vm.filters.page = p;
            vm.loadRows();
        };

        function replaceRow(row) {
            var found = false;
            for (var i = 0; i < vm.rows.length; i++) {
                if (vm.rows[i].id === row.id) { vm.rows[i] = row; found = true; break; }
            }
            if (partnerCache[row.id]) { partnerCache[row.id] = row; }
            rebuildDisplay();
            return row;
        }

        // ── List display: group dual→solo split pairs into one "tracked flight" card ──
        // vm.display = [{kind:'row', key, row} | {kind:'split', key, legs:[leg1, leg2], …}].
        // A leg outside the current page/filter is fetched once and shown as a ghost
        // (partnerCache) so the pair always reads as one flight.
        var partnerCache = {};
        vm.display = [];
        function rebuildDisplay() {
            var byId = {};
            angular.forEach(vm.rows, function(r) { byId[r.id] = r; });
            var seen = {};
            var out = [];
            angular.forEach(vm.rows, function(r) {
                var sp = r.split && r.split.mode ? r.split : null;
                if (!sp || !sp.partner_row_id) { out.push({ kind: 'row', key: 'r' + r.id, row: r, rows: [r] }); return; }
                var key = 's' + Math.min(r.id, sp.partner_row_id);
                if (seen[key]) { return; }
                seen[key] = true;
                var partner = byId[sp.partner_row_id] || partnerCache[sp.partner_row_id] || null;
                var item = { kind: 'split', key: key, legs: [], pendingIds: [], busy: false, loadingPartner: false, ghostLeg: null };
                if (partner && !byId[partner.id]) { partner._ghost = true; item.ghostLeg = partner.split && partner.split.leg; }
                var legs = partner ? [r, partner] : [r];
                legs.sort(function(a, b) { return ((a.split && a.split.leg) || 0) - ((b.split && b.split.leg) || 0); });
                item.legs = legs;
                item.rows = legs;
                var leg1 = legs[0] && legs[0].split && legs[0].split.leg === 1 ? legs[0] : null;
                item.pls_id = (leg1 && leg1.match && leg1.match.pls_id) || null;
                item.tracker = (leg1 && leg1.old_times) || null;
                item.date = r.flight_date;
                item.registration = r.registration;
                item.student = ((r.first_name || '') + ' ' + (r.last_name || '')).trim();
                angular.forEach(legs, function(l) { if (l.status === 'pending') { item.pendingIds.push(l.id); } });
                item.adjust = runningChangeAdjust(legs);
                item.anyApplied = legs.some(function(l) { return l.status === 'applied'; });
                item.allApplied = legs.length === 2 && legs.every(function(l) { return l.status === 'applied'; });
                if (!partner) {
                    item.loadingPartner = true;
                    TpcImportService.GetRow(sp.partner_row_id).then(function(data) {
                        if (data && data.success) { partnerCache[sp.partner_row_id] = data.row || data; }
                        rebuildDisplay();
                    });
                }
                out.push(item);
            });
            vm.display = out;
        }

        // ── Running change: no gap, no overlap ──
        // The solo leg's start IS the handover, so the dual leg must end at exactly
        // that time (the workbook often rounds each leg independently — 13:45→14:25
        // then 14:20→14:40). We honour the solo's start: set the dual leg's brakes-on
        // to it and recompute its hours from the new span, before anything is applied.
        function hhmmToMin(t) { var p = String(t || '').split(':'); return p.length === 2 ? (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) : null; }
        function spanHours(from, to) {
            var a = hhmmToMin(from), b = hhmmToMin(to);
            if (a === null || b === null) { return null; }
            var d = b - a; if (d < 0) { d += 1440; }
            return Math.round((d / 60) * 10000) / 10000;
        }
        function legTimes(l) { return (l && l.new_times) || { brakes_off: l && l.brakes_off, brakes_on: l && l.brakes_on }; }
        function runningChangeAdjust(legs) {
            var leg1 = null, leg2 = null;
            angular.forEach(legs, function(l) { if (l.split && l.split.leg === 1) { leg1 = l; } if (l.split && l.split.leg === 2) { leg2 = l; } });
            if (!leg1 || !leg2 || leg1.status !== 'pending') { return null; }
            var handover = legTimes(leg2).brakes_off;
            var end1 = legTimes(leg1).brakes_on;
            if (!handover || !end1 || handover === end1) { return null; }
            return { leg1_id: leg1.id, leg2_id: leg2.id, from: end1, to: handover, hours: spanHours(legTimes(leg1).brakes_off, handover),
                     overlap: hhmmToMin(end1) > hhmmToMin(handover) };
        }
        vm.runningChangeAdjust = function(legs) { return runningChangeAdjust(legs); };

        // Returns a promise that resolves once the dual leg ends at the handover time.
        function ensureRunningChange(legs) {
            var adj = runningChangeAdjust(legs);
            if (!adj) { return $q.when(null); }
            var body = { brakes_on: adj.to };
            if (adj.hours !== null) { body.flight_time_hours = adj.hours; }
            return TpcImportService.EditRow(adj.leg1_id, body).then(function(data) {
                if (!(data && data.success)) {
                    ToastService.error('Handover not set', (data && data.message) || 'Could not set the dual leg to end at ' + adj.to + '.');
                    return $q.reject(data);
                }
                var row = data.row || data;
                var keep = row.split && row.split.partner_row_id === adj.leg2_id;
                if (row.id) { replaceRow(row); }
                // the time edit triggers a rematch; re-pair if that dropped the split
                if (!keep) {
                    return TpcImportService.RowAction(adj.leg1_id, { action: 'split', partner_row_id: adj.leg2_id }).then(function(d2) {
                        if (d2 && d2.success && d2.row) { replaceRow(d2.row); }
                        return adj;
                    });
                }
                return adj;
            });
        }
        vm.ensureRunningChange = ensureRunningChange;

        // Bulk paths ("Apply selected" / "Apply all") bypass the cards, so normalise
        // every pending pair they could touch first. onlyIds = null → every pending
        // pair in the run; otherwise only pairs with a leg in that id list.
        function fixAllHandovers(onlyIds) {
            return TpcImportService.GetRows(vm.run_id, { issue: 'split', status: 'pending', per_page: 500, page: 1 }).then(function(data) {
                var rows = (data && (data.rows || data.items)) || [];
                var byId = {};
                angular.forEach(rows, function(r) { byId[r.id] = r; });
                var pairs = [], seen = {};
                angular.forEach(rows, function(r) {
                    var sp = r.split && r.split.mode ? r.split : null;
                    if (!sp || !sp.partner_row_id || !byId[sp.partner_row_id]) { return; }
                    var key = Math.min(r.id, sp.partner_row_id);
                    if (seen[key]) { return; }
                    seen[key] = true;
                    if (onlyIds && onlyIds.indexOf(r.id) === -1 && onlyIds.indexOf(sp.partner_row_id) === -1) { return; }
                    pairs.push([r, byId[sp.partner_row_id]]);
                });
                var chain = $q.when(0);
                var fixed = 0;
                angular.forEach(pairs, function(legs) {
                    chain = chain.then(function() {
                        return ensureRunningChange(legs).then(function(adj) { if (adj) { fixed++; } });
                    });
                });
                return chain.then(function() { return fixed; });
            });
        }
        vm.fixAllHandovers = fixAllHandovers;

        // Apply a pair from the list (dual leg first; the backend also enforces that).
        vm.applyPair = function(item) {
            if (!item || item.busy || !item.pendingIds.length) { return; }
            var ordered = item.legs.filter(function(l) { return l.status === 'pending'; }).map(function(l) { return l.id; });
            item.busy = true;
            ensureRunningChange(item.legs).then(function() {
                return TpcImportService.Apply(vm.run_id, { row_ids: ordered });
            }, function() { item.busy = false; return $q.reject(); }).then(function(data) {
                item.busy = false;
                if (data && data.success) {
                    ToastService.success('Split applied', ordered.length === 2 ? 'Dual leg updated the tracker flight; the solo leg was created as its second leg.' : 'The remaining leg was applied.');
                    vm.loadRun(true);
                    vm.loadRows();
                    if (vm.drawer) { vm.refreshRow(); }
                } else {
                    ToastService.error('Not applied', (data && data.message) || 'The split could not be applied.');
                }
            });
        };

        // ── Display helpers ──
        vm.badge = function(row) {
            if (row.status === 'applied')  return { cls: 'done',  label: 'APPLIED' };
            if (row.status === 'rejected') return { cls: 'muted', label: 'REJECTED' };
            if (row.status === 'failed')   return { cls: 'bad',   label: 'FAILED' };
            if (row.proposed_action === 'update') return { cls: 'blue',  label: 'UPDATE' };
            if (row.proposed_action === 'insert') return { cls: 'green', label: 'INSERT' };
            if ((row.issues || []).indexOf('time_review') > -1) return { cls: 'amber', label: 'REVIEW' };
            return { cls: 'amber', label: 'SKIP' };
        };

        vm.capacityLabel = function(c) {
            return { PUT: 'Pu/t', P1: 'P1', P1S: 'P1/S' }[c] || c || '—';
        };
        // A P1 row with a resolved instructor is applied as an AUTHORISED STUDENT SOLO
        // (first solo, solo circuits, QXC): the instructor is the authoriser, not a pilot
        // on board, and the student gets a training record. Plain P1 = private hire.
        vm.isSupervisedSolo = function(row) {
            return !!(row && row.capacity === 'P1' && row.student_user_id && row.instructor_user_id);
        };
        vm.capacityHint = function(row) {
            if (!row) { return ''; }
            if (vm.isSupervisedSolo(row)) { return 'student solo · supervised'; }
            if (row.capacity === 'P1') { return 'self-hire'; }
            if (row.capacity === 'P1S') { return 'P1 supervised'; }
            if (row.capacity === 'PUT') { return 'dual training'; }
            return '';
        };

        // ── Dual → solo splits ──
        // The backend pairs a Pu/t row with the P1 row that follows it for the same
        // student / aircraft / day when ONE tracker flight spans both (leg 1 updates
        // the tracker flight, leg 2 is inserted as the solo with tpc_prev_leg_id).
        // Applying leg 2 applies leg 1 first. We surface the pair, let the admin
        // open the other leg, apply both, unpair, or pair manually.
        vm.splitOf = function(row) {
            if (!row) { return null; }
            if (row.split && row.split.mode) { return row.split; }
            return null;
        };
        vm.isSplitRow = function(row) {
            return !!(vm.splitOf(row) || (row && (row.issues || []).indexOf('split') > -1));
        };
        vm.splitLegLabel = function(row) {
            var sp = vm.splitOf(row);
            if (!sp) { return 'split'; }
            return sp.leg === 1 ? 'leg 1 · dual' : 'leg 2 · solo';
        };

        vm.detectSplits = function() {
            if (vm.detectingSplits) { return; }
            vm.detectingSplits = true;
            TpcImportService.DetectSplits(vm.run_id).then(function(data) {
                vm.detectingSplits = false;
                if (data && data.success) {
                    var n = (data.pairs || 0) + (data.prior_solo_pairs || 0);
                    ToastService.success('Split scan complete', n ? n + ' dual → solo pair' + (n === 1 ? '' : 's') + ' found.' : 'No new dual → solo pairs found.');
                    vm.loadRun(true);
                    vm.loadRows();
                } else {
                    ToastService.error('Scan failed', (data && data.message) || 'Could not scan for splits.');
                }
            });
        };

        function loadSplitPartner() {
            var d = vm.drawer;
            if (!d) { return; }
            var sp = vm.splitOf(d.row);
            d.partner = null;
            if (!sp || !sp.partner_row_id) { return; }
            TpcImportService.GetRow(sp.partner_row_id).then(function(data) {
                if (!vm.drawer || vm.drawer !== d) { return; }
                if (data && data.success) { d.partner = replaceRow(data.row || data); }
            });
        }

        vm.openPartner = function() {
            var d = vm.drawer;
            if (!d || !d.partner) { return; }
            vm.openDrawer(d.partner);
        };

        // Apply the pair in order (dual first — leg 2 carries tpc_prev_leg_id).
        vm.applySplitPair = function() {
            var d = vm.drawer;
            var sp = d && vm.splitOf(d.row);
            if (!sp) { return; }
            var ids = sp.leg === 1 ? [d.row.id, sp.partner_row_id] : [sp.partner_row_id, d.row.id];
            ids = ids.filter(function(id) { return !!id; });
            var legs = d.partner ? [d.row, d.partner] : [d.row];
            ensureRunningChange(legs).then(function() {
                return TpcImportService.Apply(vm.run_id, { row_ids: ids });
            }).then(function(data) {
                if (data && data.success) {
                    var res = data.result || {};
                    ToastService.success('Split applied', 'Dual leg updated the tracker flight; the solo leg was created as its second leg.' + (res.failed ? ' (' + res.failed + ' failed)' : ''));
                    vm.refreshRow();
                    vm.loadRun(true);
                    vm.loadRows();
                } else {
                    ToastService.error('Not applied', (data && data.message) || 'The split could not be applied.');
                }
            });
        };

        vm.unsplitRow = function() {
            rowAction({ action: 'unsplit' }, 'Rows unpaired — each will be imported on its own again.');
            if (vm.drawer) { vm.drawer.partner = null; vm.drawer.splitPicker = null; }
        };

        // Manual pairing: list this run's pending rows for the same student, day and
        // aircraft with the opposite capacity.
        vm.openSplitPicker = function() {
            var d = vm.drawer;
            if (!d) { return; }
            d.splitPicker = { loading: true, cands: [] };
            var want = d.row.capacity === 'PUT' ? 'P1' : 'PUT';
            TpcImportService.GetRows(vm.run_id, { q: d.row.last_name || '', date_from: d.row.flight_date, date_to: d.row.flight_date, per_page: 100, page: 1 }).then(function(data) {
                if (!vm.drawer || vm.drawer !== d || !d.splitPicker) { return; }
                d.splitPicker.loading = false;
                var rows = (data && (data.rows || data.items)) || [];
                d.splitPicker.cands = rows.filter(function(r) {
                    return r.id !== d.row.id && r.capacity === want && r.status === 'pending' &&
                           String(r.registration) === String(d.row.registration) &&
                           String(r.student_user_id) === String(d.row.student_user_id) && !vm.isSplitRow(r);
                });
            });
        };
        vm.closeSplitPicker = function() { if (vm.drawer) { vm.drawer.splitPicker = null; } };
        vm.pairWith = function(c) {
            var d = vm.drawer;
            if (!d) { return; }
            TpcImportService.RowAction(d.row.id, { action: 'split', partner_row_id: c.id }).then(function(data) {
                if (data && data.success) {
                    d.splitPicker = null;
                    if (data.row) { d.row = replaceRow(data.row); d.edit = editBuffer(d.row); }
                    ToastService.success('Paired', 'Dual → solo split: the dual leg updates the tracker flight, the solo leg becomes its second leg.');
                    loadSplitPartner();
                    vm.loadRun(true);
                    vm.loadRows();
                } else if (data && data.error === 'NO_SPANNING_FLIGHT') {
                    ToastService.warning('No spanning flight', 'No single tracker flight covers both rows, so there is nothing to split — match or insert each row on its own.');
                } else {
                    ToastService.error('Not paired', (data && data.message) || 'Those two rows cannot be paired.');
                }
            });
        };

        var ISSUE_META = {
            time_review:          { icon: 'fa-exclamation-triangle', label: 'time review' },
            unknown_aircraft:     { icon: 'fa-plane-slash',          label: 'unknown aircraft' },
            student_unresolved:   { icon: 'fa-user-slash',           label: 'student?' },
            instructor_unresolved:{ icon: 'fa-user-slash',           label: 'instructor?' },
            dup_in_sheet:         { icon: 'fa-clone',                label: 'duplicate' },
            time_discrepancy:     { icon: 'fa-clock',                label: 'Δ time' },
            source_reject:        { icon: 'fa-ban',                  label: 'source problem' },
            already_imported:     { icon: 'fa-history',              label: 'already imported' },
            split:                { icon: 'fa-code-branch',          label: 'dual → solo split (two workbook rows, one tracker flight)' }
        };
        vm.issueMeta = function(issue) { return ISSUE_META[issue] || { icon: 'fa-circle', label: issue.replace(/_/g, ' ') }; };

        vm.offsetChip = function(row) {
            var off = row.match && row.match.offset_min;
            if (!off) { return null; }
            return 'UTC' + (off > 0 ? '+' : '−') + Math.abs(off / 60) + 'h';
        };

        // ── Selection + bulk ──
        vm.selCount = function() {
            var n = 0;
            angular.forEach(vm.sel, function(v) { if (v) n++; });
            return n;
        };
        vm.selIds = function() {
            var ids = [];
            angular.forEach(vm.sel, function(v, k) { if (v) ids.push(parseInt(k, 10)); });
            return ids;
        };
        vm.toggleAllSel = function(on) {
            vm.rows.forEach(function(r) { if (r.status === 'pending') vm.sel[r.id] = on; });
        };

        vm.applySelected = function() {
            var ids = vm.selIds();
            if (!ids.length) { return; }
            vm.bulkBusy = true;
            fixAllHandovers(ids).then(function() {
                return TpcImportService.Apply(vm.run_id, { row_ids: ids });
            }, function() { return TpcImportService.Apply(vm.run_id, { row_ids: ids }); }).then(function(data) {
                vm.bulkBusy = false;
                if (data && data.success) {
                    var r = data.result || {};
                    ToastService.success('Applied', (r.applied || 0) + ' applied' + (r.failed ? ' · ' + r.failed + ' failed' : '') + (r.skipped ? ' · ' + r.skipped + ' skipped' : '') + '.');
                    vm.loadRows(); vm.loadRun(true);
                } else if (data && data.error === 'RUN_BUSY') {
                    // Already processing/applying (double-click / retry) —
                    // never re-POST, just watch it finish.
                    ToastService.warning('Run Busy', data.message || 'This run is already working — progress below.');
                    vm.loadRun(true); schedulePoll();
                } else {
                    ToastService.error('Apply Failed', (data && data.message) || 'The rows could not be applied.');
                }
            });
        };

        vm.bulkAction = function(action) {
            var ids = vm.selIds();
            if (!ids.length) { return; }
            vm.bulkBusy = true;
            var i = 0, done = 0;
            (function next() {
                if (i >= ids.length) {
                    vm.bulkBusy = false;
                    ToastService.success('Done', done + ' row(s) ' + (action === 'skip' ? 'skipped' : 'rejected') + '.');
                    vm.loadRows(); vm.loadRun(true);
                    return;
                }
                TpcImportService.RowAction(ids[i++], { action: action }).then(function(data) {
                    if (data && data.success) { done++; }
                    next();
                });
            })();
        };

        // ── Apply all / revert / run menu ──
        vm.openOverlay = function(kind) { vm.overlay = kind; vm.revert_word = ''; vm.menuOpen = false; };
        vm.closeOverlay = function() { vm.overlay = null; };

        vm.applyAll = function() {
            if (vm._applyAllNormalised !== true) {
                // normalise every pending dual→solo pair first, then run the real apply-all
                vm.applyAllBusy = true;
                return fixAllHandovers(null).then(function(fixed) {
                    if (fixed) { ToastService.success('Handovers set', fixed + ' dual → solo pair' + (fixed === 1 ? '' : 's') + ' now meet at the solo start time.'); }
                }, function() {}).then(function() {
                    vm.applyAllBusy = false;
                    vm._applyAllNormalised = true;
                    vm.applyAll();
                    vm._applyAllNormalised = false;
                });
            }
            vm.overlay = null;
            TpcImportService.Apply(vm.run_id, { all: true }).then(function(data) {
                if (data && data.success) {
                    ToastService.success('Applying', 'Applying every pending row — progress below.');
                    vm.loadRun(true);
                    schedulePoll();
                } else if (data && data.error === 'RUN_BUSY') {
                    ToastService.warning('Run Busy', data.message || 'This run is already working — progress below.');
                    vm.loadRun(true); schedulePoll();
                } else {
                    ToastService.error('Not Started', (data && data.message) || 'The apply could not be started.');
                }
            });
        };

        vm.revert = function() {
            if (vm.revert_word !== 'REVERT') { return; }
            vm.overlay = null;
            vm.reverting = true;
            TpcImportService.Revert(vm.run_id).then(function(data) {
                vm.reverting = false;
                if (data && data.success) {
                    var r = data.result || {};
                    ToastService.success('Import Reverted', (r.restored || 0) + ' flights restored · ' + (r.deleted_pls || 0) + ' created flights removed. Rows are back to pending.');
                    vm.loadRun(true); vm.loadRows();
                } else {
                    ToastService.error('Revert Failed', (data && data.message) || 'The import could not be reverted.');
                }
            });
        };

        vm.reprocess = function() {
            vm.overlay = null;
            TpcImportService.Process(vm.run_id).then(function(data) {
                if (data && data.success) {
                    ToastService.success('Re-processing', 'Staged rows are being rebuilt — all staged edits were cleared.');
                    vm.loadRun(true); schedulePoll();
                } else if (data && data.error === 'RUN_BUSY') {
                    ToastService.warning('Run Busy', data.message || 'This run is already working — progress below.');
                    vm.loadRun(true); schedulePoll();
                } else {
                    ToastService.error('Not Started', (data && data.message) || 'Re-processing could not be started.');
                }
            });
        };

        vm.deleteRun = function() {
            vm.overlay = null;
            TpcImportService.DeleteRun(vm.run_id).then(function(data) {
                if (data && data.success) {
                    ToastService.success('Run Deleted', 'The import run was removed.');
                    $state.go('dashboard.manage_club.settings');
                } else if (data && data.error === 'HAS_APPLIED_ROWS') {
                    ToastService.warning('Has Applied Rows', 'Revert the import first, then delete the run.');
                } else {
                    ToastService.error('Not Deleted', (data && data.message) || 'The run could not be deleted.');
                }
            });
        };

        // ── Fix-it grouping (client-side, over the fetched page) ──
        vm.groupable = function() {
            return ['student_unresolved', 'instructor_unresolved', 'unknown_aircraft'].indexOf(vm.filters.issue) > -1;
        };
        vm.groupList = [];
        vm.rebuildGroups = function() {
            var byKey = {};
            var isAircraft = vm.filters.issue === 'unknown_aircraft';
            var isInstructor = vm.filters.issue === 'instructor_unresolved';
            vm.rows.forEach(function(r) {
                var key = isAircraft ? (r.registration || '—')
                        : isInstructor ? (r.instructor_name || '—')
                        : (((r.first_name || '') + ' ' + (r.last_name || '')).trim() || '—');
                (byKey[key] = byKey[key] || { key: key, rows: [] }).rows.push(r);
            });
            vm.groupList = Object.keys(byKey).map(function(k) { return byKey[k]; })
                .sort(function(a, b) { return b.rows.length - a.rows.length; });
        };
        vm.fixGroup = function(g) {
            vm.openDrawer(g.rows[0]);
            if (vm.filters.issue !== 'unknown_aircraft') {
                vm.ppOpen(vm.filters.issue === 'instructor_unresolved' ? 'instructor' : 'student');
            }
        };
        vm.rematchGroup = function(g) {
            var i = 0;
            g._busy = true;
            (function next() {
                if (i >= g.rows.length) { g._busy = false; ToastService.success('Rematched', g.rows.length + ' row(s) re-matched.'); vm.loadRows(); vm.loadRun(true); return; }
                TpcImportService.RowAction(g.rows[i++].id, { action: 'rematch' }).then(next);
            })();
        };

        // ══════════════════════════════════════════════
        // ROW DRAWER — compare / edit / match / people
        // ══════════════════════════════════════════════

        vm.openDrawer = function(row) {
            vm.drawer = { row: row, loading: true, detail: null, edit: null, pickerOpen: false, pp: null, saving: false };
            bindKeys();
            TpcImportService.GetRow(row.id).then(function(data) {
                if (!vm.drawer) { return; }
                vm.drawer.loading = false;
                if (data && data.success) {
                    var r = data.row || data;
                    vm.drawer.row = replaceRow(angular.extend({}, row, r));
                    vm.drawer.detail = r;
                    vm.drawer.edit = editBuffer(vm.drawer.row);
                    buildDrawerExtras();
                    loadSplitPartner();
                }
            });
        };
        vm.closeDrawer = function() { vm.drawer = null; unbindKeys(); };

        function editBuffer(r) {
            var nt = r.new_times || {};
            return {
                flight_date: r.flight_date,
                registration: r.registration,
                brakes_off: nt.brakes_off,
                brakes_on: nt.brakes_on,
                flight_time_hours: nt.flight_time_hours,
                landings: r.landings,
                capacity: r.capacity,
                exercise: r.exercise,
                remarks: r.remarks,
                // Course/lesson the training record will be filed under.
                // Falls back to the importer's resolution until the reviewer
                // overrides it (BACKEND_TRAINING_RECORD_COURSE_GUIDE.md).
                course_id: r.course_id || r.course_resolved || null,
                lesson_id: r.lesson_id || r.lesson_resolved || null,
                first_name: r.first_name,
                last_name: r.last_name,
                instructor_name: r.instructor_name
            };
        }

        vm.dirtyFields = function() {
            var d = vm.drawer;
            if (!d || !d.edit) { return []; }
            var base = editBuffer(d.row);
            var changed = [];
            angular.forEach(d.edit, function(v, k) {
                if (String(v === undefined || v === null ? '' : v) !== String(base[k] === undefined || base[k] === null ? '' : base[k])) { changed.push(k); }
            });
            return changed;
        };

        // You fixed the brakes times but left the billed hours untouched —
        // the workbook's flight time is what gets written, so nudge AND offer
        // the recomputed span one tap away. Never auto-overwrite: billed hours
        // legitimately may differ from the brakes span (e.g. a trial billed
        // at 1.0 h), so the admin decides.
        vm.hoursStale = function() {
            var f = vm.dirtyFields();
            return (f.indexOf('brakes_off') > -1 || f.indexOf('brakes_on') > -1) && f.indexOf('flight_time_hours') === -1;
        };

        // Decimal hours from the CURRENTLY EDITED times (null when not computable).
        vm.editSpanHours = function() {
            var e = vm.drawer && vm.drawer.edit;
            if (!e) { return null; }
            var mins = toMin(e.brakes_on) - toMin(e.brakes_off);
            if (isNaN(mins) || mins <= 0 || mins > 24 * 60) { return null; }
            return Math.round((mins / 60) * 10000) / 10000;
        };

        vm.useSpanHours = function() {
            var h = vm.editSpanHours();
            if (h !== null) { vm.drawer.edit.flight_time_hours = h; }
        };

        // ── Course / lesson pickers ──────────────────────────────────
        // The importer guesses the course from the free-text exercise cell
        // and falls back to PPL when it can't tell — which is how IMC/night/
        // type flights end up on the PPL course. Show the guess, its source,
        // and let the reviewer correct it before applying.
        vm.courses = [];
        TpcImportService.CoursesForClub(vm.club_id).then(function(data) {
            vm.courses = (data && data.courses) || [];
        });

        vm.lessonsFor = function(course_id) {
            for (var i = 0; i < vm.courses.length; i++) {
                if (String(vm.courses[i].id) === String(course_id)) { return vm.courses[i].lessons || []; }
            }
            return [];
        };
        // Changing course invalidates a lesson from the old one.
        vm.onCourseChange = function() {
            var e = vm.drawer && vm.drawer.edit;
            if (!e) { return; }
            var ok = false;
            vm.lessonsFor(e.course_id).forEach(function(l) {
                if (String(l.id) === String(e.lesson_id)) { ok = true; }
            });
            if (!ok) { e.lesson_id = null; }
        };
        vm.courseSourceLabel = function(src) {
            return {
                exercise_number:  'from the exercise number',
                exercise_keyword: 'from the exercise wording',
                student_majority: "from this student's other flights",
                'default':        'defaulted — please check',
                manual:           'set by you'
            }[src] || '';
        };
        // The default fallback is the case that silently mis-files flights.
        vm.courseNeedsReview = function() {
            var r = vm.drawer && vm.drawer.row;
            if (!r || r.course_id) { return false; }   // reviewer already set it
            return r.course_source === 'default' || r.course_source === 'student_majority';
        };

        vm.saveEdit = function() {
            var d = vm.drawer;
            var fields = vm.dirtyFields();
            if (!d || !fields.length || d.saving) { return; }
            var body = {};
            fields.forEach(function(k) { body[k] = d.edit[k]; });
            d.saving = true;
            TpcImportService.EditRow(d.row.id, body).then(function(data) {
                d.saving = false;
                if (data && data.success) {
                    d.row = replaceRow(data.row);
                    d.edit = editBuffer(d.row);
                    // Date/reg/time edits clear + rematch server-side — refresh candidates.
                    TpcImportService.GetRow(d.row.id).then(function(dd) {
                        if (dd && dd.success && vm.drawer) { vm.drawer.detail = dd.row || dd; buildDrawerExtras(); }
                    });
                    ToastService.success('Saved', 'Row updated' + (body.flight_date || body.registration || body.brakes_off || body.brakes_on ? ' — match recomputed.' : '.'));
                } else if (data && data.error === 'ALREADY_APPLIED') {
                    ToastService.warning('Already Applied', 'This row was already applied — revert the run to change it.');
                    vm.refreshRow();
                } else {
                    var msgs = { BAD_TIME: 'Times must be HH:MM.', BAD_DATE: 'That date is not valid.', BAD_CAPACITY: 'Capacity must be Pu/t, P1 or P1/S.' };
                    ToastService.warning('Not Saved', msgs[data && data.error] || (data && data.message) || 'The row could not be saved.');
                }
            });
        };

        vm.refreshRow = function() {
            var d = vm.drawer;
            if (!d) { return; }
            TpcImportService.GetRow(d.row.id).then(function(data) {
                if (data && data.success && vm.drawer) {
                    vm.drawer.row = replaceRow(data.row || data);
                    vm.drawer.detail = data.row || data;
                    vm.drawer.edit = editBuffer(vm.drawer.row);
                    buildDrawerExtras();
                    loadSplitPartner();
                }
            });
        };

        // ── Row actions ──
        function rowAction(body, okMsg) {
            var d = vm.drawer;
            if (!d) { return; }
            TpcImportService.RowAction(d.row.id, body).then(function(data) {
                if (data && data.success) {
                    if (data.row) { d.row = replaceRow(data.row); d.edit = editBuffer(d.row); }
                    if (okMsg) { ToastService.success('Done', okMsg); }
                    if (body.action === 'match' || body.action === 'insert' || body.action === 'rematch') { vm.refreshRow(); }
                    vm.loadRun(true);
                } else if (data && data.error === 'FLIGHT_TAKEN') {
                    ToastService.warning('Flight Taken', 'Another row (or a previous import) already owns that flight.');
                    vm.refreshRow();
                } else {
                    ToastService.error('Failed', (data && data.message) || 'The action failed.');
                }
            });
        }

        vm.matchTo = function(candidate) {
            if (candidate.assigned || candidate.already_overridden) {
                ToastService.warning('Already Assigned', 'Flight #' + candidate.pls_id + ' is already assigned to another workbook row — pick an un-assigned flight or create a new one.');
                return;
            }
            vm.drawer.pickerOpen = false;
            rowAction({ action: 'match', pls_id: candidate.pls_id }, 'Matched to flight #' + candidate.pls_id + ' — workbook times will override it.');
        };
        vm.forceInsert = function() { vm.drawer.pickerOpen = false; rowAction({ action: 'insert' }, 'Will be created as a new flight.'); };
        vm.skipRow = function() { rowAction({ action: 'skip' }, 'Row skipped — it will not be imported.'); };
        vm.rejectRow = function() { rowAction({ action: 'reject' }, 'Row rejected.'); };
        vm.restoreRow = function() { rowAction({ action: 'restore' }, 'Row restored to pending.'); };
        vm.rematchRow = function() { rowAction({ action: 'rematch' }, 'Match recomputed.'); };

        vm.applyRow = function() {
            var d = vm.drawer;
            if (!d || d.row.status !== 'pending') { return; }
            // a split leg applied on its own still honours the handover time
            var legs = (vm.splitOf(d.row) && d.partner) ? [d.row, d.partner] : [];
            ensureRunningChange(legs).then(function() {
                return TpcImportService.Apply(vm.run_id, { row_ids: [d.row.id] });
            }).then(function(data) {
                if (data && data.success && data.result && data.result.applied) {
                    ToastService.success('Applied', 'Row ' + d.row.import_key + ' applied.');
                    vm.refreshRow(); vm.loadRun(true);
                    vm.nextRow();
                } else {
                    ToastService.error('Not Applied', (data && data.message) || 'The row could not be applied — check its issues.');
                    vm.refreshRow();
                }
            });
        };

        // Candidate Δ vs the workbook row, in minutes.
        vm.candDelta = function(c) {
            var d = vm.drawer;
            var nt = d && d.row.new_times;
            if (!nt || !nt.brakes_off || !c.brakes_off) { return null; }
            return Math.abs(toMin(nt.brakes_off) - toMin(c.brakes_off));
        };

        function toMin(hhmm) {
            if (!hhmm) { return null; }
            var p = String(hhmm).split(':');
            return (+p[0]) * 60 + (+p[1] || 0);
        }
        function fmtSpan(mins) {
            if (mins === null || isNaN(mins) || mins < 0) { return null; }
            var h = Math.floor(mins / 60), m = Math.round(mins % 60);
            return h > 0 ? h + ' h ' + (m < 10 ? '0' : '') + m + ' m' : m + ' m';
        }

        // Flight time with a brakes-span fallback: tracker-created flights
        // often carry 0 h until they're claimed — show the computed span
        // (marked ~) rather than a misleading "0.00 h".
        vm.flightHours = function(obj) {
            if (!obj) { return '—'; }
            var h = parseFloat(obj.flight_time_hours);
            if (h > 0) { return (Math.round(h * 100) / 100) + ' h'; }
            var span = fmtSpan(toMin(obj.brakes_on) - toMin(obj.brakes_off));
            return span ? '~' + span : '—';
        };
        vm.flightHoursComputed = function(obj) {
            return !(obj && parseFloat(obj.flight_time_hours) > 0);
        };

        // ── Drawer extras: sorted candidates + the times timeline ──
        // Built once per detail load (never in a binding — fresh arrays every
        // digest would loop the digest cycle).
        function buildDrawerExtras() {
            var d = vm.drawer;
            if (!d || !d.detail) { return; }
            var cands = (d.detail.candidates || []).slice().map(function(c) {
                c.assigned = !!c.already_overridden;
                return c;
            }).sort(function(a, b) { return (a.assigned ? 1 : 0) - (b.assigned ? 1 : 0); });
            d.cands = cands;

            // Shared time axis over the workbook window + every candidate.
            var nt = d.row.new_times || {};
            var spans = [];
            if (nt.brakes_off && nt.brakes_on) { spans.push({ key: 'wb', label: 'Workbook', off: toMin(nt.brakes_off), on: toMin(nt.brakes_on), kind: 'wb', text: nt.brakes_off + '→' + nt.brakes_on }); }
            var ot = d.row.old_times;
            if (ot && ot.brakes_off && ot.brakes_on) { spans.push({ key: 'match', label: 'Matched #' + ot.pls_id, off: toMin(ot.brakes_off), on: toMin(ot.brakes_on), kind: 'match', text: ot.brakes_off + '→' + ot.brakes_on }); }
            cands.forEach(function(c) {
                if (c.brakes_off && c.brakes_on && (!ot || c.pls_id !== ot.pls_id)) {
                    spans.push({ key: 'c' + c.pls_id, label: '#' + c.pls_id, off: toMin(c.brakes_off), on: toMin(c.brakes_on), kind: c.assigned ? 'assigned' : 'cand', text: c.brakes_off + '→' + c.brakes_on });
                }
            });
            if (spans.length < 2) { d.timeline = null; return; }
            var lo = Math.min.apply(null, spans.map(function(x) { return x.off; })) - 20;
            var hi = Math.max.apply(null, spans.map(function(x) { return x.on; })) + 20;
            var range = Math.max(hi - lo, 30);
            spans.forEach(function(x) {
                x.left = Math.max(0, 100 * (x.off - lo) / range);
                x.width = Math.max(2, 100 * (x.on - x.off) / range);
            });
            d.timeline = {
                spans: spans,
                startLabel: fmtHHMM(lo),
                endLabel: fmtHHMM(hi)
            };
        }
        function fmtHHMM(mins) {
            mins = Math.max(0, Math.round(mins));
            var h = Math.floor(mins / 60) % 24, m = mins % 60;
            return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        }

        // ── Person picker ──
        var ppDebounce = null;
        vm.ppOpen = function(target) {
            vm.drawer.pp = { target: target, q: '', results: [], searching: false, applyAll: true, created: false };
        };
        vm.ppClose = function() { if (vm.drawer) { vm.drawer.pp = null; } };
        vm.ppSearch = function() {
            var pp = vm.drawer && vm.drawer.pp;
            if (!pp) { return; }
            if (ppDebounce) { $timeout.cancel(ppDebounce); }
            ppDebounce = $timeout(function() {
                pp.searching = true;
                TpcImportService.People(vm.club_id, pp.q).then(function(data) {
                    pp.searching = false;
                    pp.results = (data && data.people) || [];
                });
            }, 250);
        };
        vm.ppChoose = function(person) {
            var d = vm.drawer, pp = d.pp;
            TpcImportService.RowAction(d.row.id, {
                action: 'assign_person', target: pp.target, user_id: person.id,
                apply_to_same_name: pp.applyAll
            }).then(function(data) {
                if (data && data.success) {
                    var n = data.rows_affected || 1;
                    ToastService.success('Person Linked', pp.applyAll && n > 1
                        ? 'Fixed ' + n + ' rows for ' + person.first_name + ' ' + person.last_name + '.'
                        : person.first_name + ' ' + person.last_name + ' linked.');
                    vm.ppClose();
                    vm.refreshRow(); vm.loadRows(); vm.loadRun(true);
                } else {
                    ToastService.error('Not Linked', (data && data.message) || 'The person could not be assigned.');
                }
            });
        };
        vm.ppCreate = function() {
            var d = vm.drawer, pp = d.pp;
            TpcImportService.RowAction(d.row.id, { action: 'create_person', target: pp.target }).then(function(data) {
                if (data && data.success) {
                    ToastService.success('Member Created', 'Imported member created and linked to ' + (data.rows_affected || 1) + ' row(s). You can send them a signup invitation from Imported Users (BookedScheduler sync).');
                    vm.ppClose();
                    vm.refreshRow(); vm.loadRows(); vm.loadRun(true);
                } else if (data && data.error === 'NAME_REQUIRED') {
                    ToastService.warning('Name Required', 'Add a first name to the row (edit it), or pick the right member from the list.');
                } else {
                    ToastService.error('Not Created', (data && data.message) || 'The member could not be created.');
                }
            });
        };

        // ── Exercise → lesson preview ──
        var _exCache = { input: null, out: null };
        vm.exercisePreview = function(text) {
            if (!text) { return { }; }
            if (_exCache.input === text) { return _exCache.out; }
            var tokens = String(text).split(/[,\s]+/).filter(Boolean);
            var lessons = tokens.filter(function(t) { return /^\d+[a-z]?\d*$/i.test(t); });
            _exCache.input = text;
            _exCache.out = lessons.length ? { lessons: lessons.map(function(t) { return 'Exercise ' + t; }) } : { notesOnly: true };
            return _exCache.out;
        };

        // ── prev/next through the current filtered queue ──
        vm.rowIndex = function() {
            if (!vm.drawer) { return -1; }
            for (var i = 0; i < vm.rows.length; i++) { if (vm.rows[i].id === vm.drawer.row.id) return i; }
            return -1;
        };
        vm.nextRow = function() {
            var i = vm.rowIndex();
            if (i > -1 && i < vm.rows.length - 1) { vm.openDrawer(vm.rows[i + 1]); }
            else if (vm.filters.page < vm.pages()) {
                vm.filters.page++;
                vm.loadRows();
                $timeout(function() { if (vm.rows.length) { vm.openDrawer(vm.rows[0]); } }, 600);
            }
        };
        vm.prevRow = function() {
            var i = vm.rowIndex();
            if (i > 0) { vm.openDrawer(vm.rows[i - 1]); }
        };

        // Keyboard: j/k navigate, a apply, s skip, r reject — never while typing.
        function onKey(e) {
            if (!vm.drawer) { return; }
            var tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') { return; }
            var map = { j: vm.nextRow, k: vm.prevRow, a: vm.applyRow, s: vm.skipRow, r: vm.rejectRow };
            var fn = map[e.key];
            if (fn) { $scope.$applyAsync(fn); e.preventDefault(); }
            if (e.key === 'Escape') { $scope.$applyAsync(vm.closeDrawer); }
        }
        var keysBound = false;
        function bindKeys() { if (!keysBound) { $document.on('keydown', onKey); keysBound = true; } }
        function unbindKeys() { if (keysBound) { $document.off('keydown', onKey); keysBound = false; } }

        // ── Init ──
        vm.loadRun();
        vm.loadRows();
    }
