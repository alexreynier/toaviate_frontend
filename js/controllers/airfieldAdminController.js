// ═══════════════════════════════════════════════════════════════════
//  AirfieldAdminController
//  ToAviate super-admin — global airfield database management.
//  One controller for all three screens, dispatched on
//  $state.current.data.screen:
//     'overview'  → coverage + import (fetch a country / map area)
//     'review'    → the review queue (location_dup + auto_import)
//     'manage'    → search / add / edit / delete individual airfields
// ═══════════════════════════════════════════════════════════════════

app.controller('AirfieldAdminController', AirfieldAdminController);

AirfieldAdminController.$inject = ['AirfieldAdminService', 'ToastService', '$rootScope',
                                   '$state', '$scope', '$timeout', '$filter'];
function AirfieldAdminController(AirfieldAdminService, ToastService, $rootScope,
                                 $state, $scope, $timeout, $filter) {
    var vm = this;

    // ── Access gate — ToAviate platform staff only (backend is authoritative) ──
    vm.user            = $rootScope.globals.currentUser;
    vm.is_staff        = $rootScope.isToAviateStaff();

    vm.screen          = ($state.current.data && $state.current.data.screen) || 'overview';

    // Reference data
    vm.countries       = AirfieldAdminService.countries;
    vm.af_types        = AirfieldAdminService.af_types;

    // Shared
    vm.loading         = true;
    vm.error           = null;
    vm.pending_review  = 0;

    // ── Exposed API ──
    vm.countryName     = countryName;
    vm.countryFlag     = countryFlag;
    vm.typeLabel       = typeLabel;
    vm.typeIcon        = typeIcon;
    vm.num             = num;             // MySQL returns numerics as strings
    vm.pct             = pct;

    if (!vm.is_staff) {
        vm.loading = false;
        return;
    }

    if (vm.screen === 'overview')    { initOverview(); }
    else if (vm.screen === 'review') { initReview(); }
    else if (vm.screen === 'manage') { initManage(); }


    // ═══════════════════════════════════════════════════════════════
    //  SCREEN 1 — OVERVIEW / FETCH
    // ═══════════════════════════════════════════════════════════════

    function initOverview() {
        vm.totals       = { total: 0, from_import: 0, manual: 0, awaiting_verify: 0 };
        vm.by_country   = [];
        vm.recent_runs  = [];
        vm.gaps         = [];
        vm.gaps_pending = 0;

        // Coverage table controls
        vm.coverage_search = '';
        vm.coverage_sort   = '-n';
        vm.coverage_limit  = 12;

        // Import panel
        vm.import_mode     = 'country';       // 'country' | 'area'
        vm.import_running  = false;
        vm.import_result   = null;            // last run summary, shown as a result card
        vm.country_pick    = '';
        vm.area            = { lat: null, lon: null, box: 2.0 };

        // ── Elevation health ──
        // A blank elevation silently degrades flight replay (it falls back to
        // raw GPS altitude), so this is a real data-quality problem, not cosmetic.
        vm.elevation      = null;
        vm.elev_running   = false;
        vm.elev_result    = null;

        vm.loadStatus       = loadStatus;
        vm.setImportMode    = setImportMode;
        vm.runCountryImport = runCountryImport;
        vm.runAreaImport    = runAreaImport;
        vm.showMoreCoverage = showMoreCoverage;
        vm.setCoverageSort  = setCoverageSort;
        vm.dismissResult    = function () { vm.import_result = null; };
        vm.dismissElevResult = function () { vm.elev_result = null; };
        vm.runStatusClass   = runStatusClass;
        vm.scopeLabel       = scopeLabel;
        vm.fillElevations   = fillElevations;

        loadStatus();
    }

    // ── Elevation fill ──
    // `used_by_flights` scopes the run to airfields that flights actually
    // depart from / land at — the ones whose replay is currently degraded.
    // The long tail (~17.8k nobody flies from) is left to the background cron.
    function fillElevations(usedByFlights) {
        if (vm.elev_running) { return; }

        vm.elev_running = true;
        vm.elev_result  = null;

        AirfieldAdminService.FillElevations(300, usedByFlights).then(function (data) {
            vm.elev_running = false;

            if (!data || data.success === false) {
                ToastService.error('Could not fill elevations',
                    messageOf(data, 'The elevation lookup did not complete.'));
                return;
            }

            var surveyed  = num(data.from_ourairports);
            var estimated = num(data.from_terrain);
            var noData    = num(data.no_data);
            var remaining = num(data.remaining);
            var filled    = surveyed + estimated;

            vm.elev_result = {
                surveyed:  surveyed,
                estimated: estimated,
                no_data:   noData,
                remaining: remaining,
                filled:    filled,
                scoped:    !!usedByFlights
            };

            // Report honestly — including the case where nothing was filled.
            if (filled === 0) {
                ToastService.warning('Nothing filled',
                    remaining > 0
                        ? remaining + ' still missing — the terrain service returned no data for these.'
                        : 'There was nothing left to fill.');
            } else {
                var bits = [];
                if (surveyed > 0)  { bits.push(surveyed + ' surveyed'); }
                if (estimated > 0) { bits.push(estimated + ' estimated'); }
                ToastService.success(
                    'Filled ' + filled + ' elevation' + (filled === 1 ? '' : 's'),
                    bits.join(', ') + ' · ' + remaining + ' remaining');
            }

            loadStatus(true);
        });
    }

    function loadStatus(isRefresh) {
        if (isRefresh) { vm.refreshing = true; } else { vm.loading = true; }
        vm.error = null;

        AirfieldAdminService.GetStatus().then(function (data) {
            vm.loading    = false;
            vm.refreshing = false;

            if (!data || data.success === false) {
                vm.error = messageOf(data, 'Could not load the airfield dashboard.');
                return;
            }

            var t = data.totals || {};
            vm.totals = {
                total:           num(t.total),
                from_import:     num(t.from_import),
                manual:          num(t.manual),
                awaiting_verify: num(t.awaiting_verify)
            };

            vm.by_country = (data.by_country || []).map(function (c) {
                var n = num(c.n), active = num(c.active_n);
                return {
                    country_code: c.country_code,
                    name:         countryName(c.country_code),
                    flag:         countryFlag(c.country_code),
                    n:            n,
                    active_n:     active,
                    inactive_n:   Math.max(0, n - active),
                    active_pct:   n > 0 ? Math.round((active / n) * 100) : 0
                };
            });

            vm.recent_runs = (data.recent_runs || []).map(function (r) {
                return {
                    id:               r.id,
                    source:           r.source,
                    scope:            r.scope,
                    scope_value:      r.scope_value,
                    triggered_by:     r.triggered_by,
                    status:           r.status,
                    message:          r.message,
                    source_rows:      num(r.source_rows),
                    added:            num(r.added),
                    skipped_existing: num(r.skipped_existing),
                    flagged_review:   num(r.flagged_review),
                    created_at:       r.created_at,
                    finished_at:      r.finished_at
                };
            });

            vm.pending_review = num(data.pending_review);

            // Elevation health. Everything here arrives as a MySQL string except
            // missing_used_by_flights, which the backend already casts to int.
            var e = data.elevation || {};
            var surveyed  = num(e.from_ourairports);
            var estimated = num(e.from_terrain);
            var manual    = num(e.from_manual);
            var have      = surveyed + estimated + manual;

            vm.elevation = {
                total:      num(e.total),
                missing:    num(e.missing),
                surveyed:   surveyed,
                estimated:  estimated,
                manual:     manual,
                have:       have,
                // The number that matters: airfields flights actually use that
                // still have no elevation → their replay is degraded right now.
                at_risk:    num(e.missing_used_by_flights),
                // Share of the rows that HAVE an elevation which are only DEM
                // estimates — context for how much is surveyed vs guessed.
                est_pct:    have > 0 ? Math.round((estimated / have) * 100) : 0
            };

            vm.gaps = data.gaps || [];
            vm.gaps_pending = 0;
            for (var i = 0; i < vm.gaps.length; i++) {
                if (vm.gaps[i].status === 'pending') { vm.gaps_pending = num(vm.gaps[i].n); }
            }
        });
    }

    function setImportMode(mode) {
        vm.import_mode = mode;
    }

    function runCountryImport() {
        if (vm.import_running) { return; }
        if (!vm.country_pick) {
            ToastService.error('No country selected', 'Pick the country you want to import.');
            return;
        }

        var iso   = vm.country_pick;
        var label = countryName(iso);

        vm.import_running = true;
        vm.import_result  = null;

        AirfieldAdminService.ImportCountry(iso).then(function (data) {
            vm.import_running = false;
            if (!data || data.success === false) {
                ToastService.error('Import failed', messageOf(data, 'Could not import ' + label + '.'));
                return;
            }
            showRunResult(data, label);
            loadStatus(true);
        });
    }

    function runAreaImport() {
        if (vm.import_running) { return; }

        var lat = parseFloat(vm.area.lat);
        var lon = parseFloat(vm.area.lon);
        var box = parseFloat(vm.area.box);

        var ok = ToastService.validateForm([
            { ok: !isNaN(lat) && lat >= -90  && lat <= 90,  field: 'field-area-lat', label: 'Latitude (-90 to 90)' },
            { ok: !isNaN(lon) && lon >= -180 && lon <= 180, field: 'field-area-lon', label: 'Longitude (-180 to 180)' },
            { ok: !isNaN(box) && box >= 0.1  && box <= 10,  field: 'field-area-box', label: 'Box size (0.1 to 10 degrees)' }
        ]);
        if (!ok) { return; }

        vm.import_running = true;
        vm.import_result  = null;

        AirfieldAdminService.ImportArea(lat, lon, box).then(function (data) {
            vm.import_running = false;
            if (!data || data.success === false) {
                ToastService.error('Import failed', messageOf(data, 'Could not import that map area.'));
                return;
            }
            showRunResult(data, lat.toFixed(2) + ', ' + lon.toFixed(2) + ' (±' + box + '°)');
            loadStatus(true);
        });
    }

    // Success toast + the persistent result card under the import panel.
    function showRunResult(data, label) {
        var added     = num(data.added);
        var skipped   = num(data.skipped_existing);
        var review    = num(data.flagged_review);
        var rematched = num(data.rematched_flight_phases);

        vm.import_result = {
            label:       label,
            source_rows: num(data.source_rows),
            added:       added,
            skipped:     skipped,
            review:      review,
            rematched:   rematched
        };

        var bits = [added + ' added'];
        if (rematched > 0) { bits.push('fixed ' + rematched + ' past flight' + (rematched === 1 ? '' : 's')); }
        if (review > 0)    { bits.push(review + ' to review'); }
        if (skipped > 0)   { bits.push(skipped + ' already had'); }

        ToastService.success('Imported ' + label, bits.join(' · '));
    }

    function showMoreCoverage() {
        vm.coverage_limit += 25;
    }

    function setCoverageSort(field) {
        // Toggle direction when re-clicking the active column.
        vm.coverage_sort = (vm.coverage_sort === field) ? '-' + field : field;
    }

    function runStatusClass(status) {
        if (status === 'done')    { return 'af-run--done'; }
        if (status === 'failed')  { return 'af-run--failed'; }
        if (status === 'running') { return 'af-run--running'; }
        return 'af-run--pending';
    }

    function scopeLabel(run) {
        if (run.scope === 'country') { return countryName(run.scope_value); }
        return run.scope_value || 'map area';
    }


    // ═══════════════════════════════════════════════════════════════
    //  SCREEN 2 — REVIEW QUEUE
    // ═══════════════════════════════════════════════════════════════

    function initReview() {
        vm.review_status = 'pending';     // pending | approved | dismissed
        vm.items         = [];
        vm.acting        = {};            // id → true while its request is in flight
        vm.leaving       = {};            // id → true while the card animates out

        vm.merge_fields  = AirfieldAdminService.merge_fields;

        vm.loadReview       = loadReview;
        vm.setReviewStatus  = setReviewStatus;
        vm.approveItem      = approveItem;
        vm.dismissItem      = dismissItem;
        vm.mergeItem        = mergeItem;
        vm.toggleMerge      = toggleMerge;
        vm.tickAllGaps      = tickAllGaps;
        vm.tickNone         = tickNone;
        vm.selectedCount    = selectedCount;
        vm.fmtValue         = fmtValue;
        vm.mapLink          = mapLink;
        vm.itemLat          = itemLat;
        vm.itemLon          = itemLon;

        loadReview();
    }

    // ── The merge comparison ────────────────────────────────────────
    // The review payload carries the whole existing row nested under
    // `nearest_airfield`. Diff it against the candidate, field by field.
    function loadComparison(item) {
        if (item.reason !== 'location_dup' || !item.nearest_airfield_id) { return; }

        if (!item.nearest_airfield) {
            // Without the existing row we can't offer a safe merge — the card
            // falls back to plain approve/dismiss.
            item.cmp_error = true;
            return;
        }

        item.existing = item.nearest_airfield;
        buildRows(item);
    }

    function buildRows(item) {
        var cand = item.payload_decoded || {};
        var cur  = item.existing || {};

        item.rows = [];
        item.gap_count      = 0;   // fields the existing row is missing
        item.conflict_count = 0;   // fields where both differ

        for (var i = 0; i < vm.merge_fields.length; i++) {
            var f    = vm.merge_fields[i];
            var newV = cand[f.key];
            var oldV = cur[f.key];

            // Nothing to contribute — skip the row entirely.
            if (isBlank(newV)) { continue; }

            var missing  = isBlank(oldV);
            var conflict = !missing && !sameValue(oldV, newV, f);

            // Identical values are noise; don't show them.
            if (!missing && !conflict) { continue; }

            if (missing)  { item.gap_count++; }
            if (conflict) { item.conflict_count++; }

            item.rows.push({
                field:    f,
                old:      oldV,
                'new':    newV,
                missing:  missing,
                conflict: conflict,
                // Back-fills are pre-ticked (pure gain, no data lost).
                // Overwrites must be opted into deliberately.
                checked:  missing
            });
        }
    }

    function isBlank(v) {
        return v === null || v === undefined || v === '' ||
               (typeof v === 'string' && v.trim() === '');
    }

    // Coordinates and elevations arrive as strings of differing precision
    // ("45.28" vs "45.2800000") — compare them numerically so we don't flag a
    // conflict where there is none.
    function sameValue(a, b, f) {
        if (f.kind === 'coord' || f.kind === 'number') {
            var na = parseFloat(a), nb = parseFloat(b);
            if (!isNaN(na) && !isNaN(nb)) {
                // Coords: 0.0005° ≈ 55 m. Two sources rounding the same
                // threshold differently (-74.8502 vs -74.8500) is noise, not a
                // disagreement — flagging it trains the admin to ignore the
                // "differs" badge. A real position error is far larger than this.
                // Elevation: to the foot.
                var tol = (f.kind === 'coord') ? 0.0005 : 0.5;
                return Math.abs(na - nb) < tol;
            }
        }
        return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    }

    function toggleMerge(row) {
        row.checked = !row.checked;
    }

    function tickAllGaps(item) {
        item.rows.forEach(function (r) { r.checked = r.missing; });
    }

    function tickNone(item) {
        item.rows.forEach(function (r) { r.checked = false; });
    }

    function selectedCount(item) {
        if (!item.rows) { return 0; }
        return item.rows.filter(function (r) { return r.checked; }).length;
    }

    function fmtValue(row, which) {
        var v = (which === 'new') ? row['new'] : row.old;
        if (isBlank(v)) { return null; }
        var f = row.field;
        if (f.kind === 'type')   { return typeLabel(v); }
        if (f.kind === 'number') { return v + (f.suffix || ''); }
        return v;
    }

    // Write the ticked fields onto the EXISTING row (same id → every flight and
    // booking that references it stays intact), then settle the queue item.
    function mergeItem(item) {
        if (vm.acting[item.id]) { return; }

        var picked = item.rows.filter(function (r) { return r.checked; });
        if (!picked.length) {
            ToastService.warning('Nothing selected',
                'Tick at least one field to copy across, or choose another action.');
            return;
        }

        var patch = {};
        picked.forEach(function (r) { patch[r.field.key] = r['new']; });

        vm.acting[item.id] = true;

        AirfieldAdminService.MergeIntoExisting(item.id, patch).then(function (data) {
            vm.acting[item.id] = false;

            if (!data || data.success === false) {
                // e.g. the ticked code collides with another airfield — the
                // server names it, so show that rather than a generic failure.
                ToastService.error('Could not merge',
                    messageOf(data, 'The existing airfield was not updated.'));
                return;
            }

            // Trust the server's count over our own — it applies the whitelist.
            var n = (data.updated !== undefined && data.updated !== null)
                ? num(data.updated) : picked.length;

            ToastService.success('Merged into ' + item.nearest_code,
                n + ' field' + (n === 1 ? '' : 's') + ' back-filled · no duplicate created');
            removeCard(item);
        });
    }

    function loadReview() {
        vm.loading = true;
        vm.error   = null;

        AirfieldAdminService.GetReview(vm.review_status).then(function (data) {
            vm.loading = false;

            if (!data || data.success === false) {
                vm.error = messageOf(data, 'Could not load the review queue.');
                vm.items = [];
                return;
            }

            vm.items = (data.items || []).map(function (it) {
                it.distance_km = it.distance_km !== null && it.distance_km !== undefined
                    ? parseFloat(it.distance_km) : null;
                return it;
            });

            if (vm.review_status === 'pending') {
                vm.pending_review = vm.items.length;
                // Pull each duplicate's existing record so the admin can see
                // both sides in full and back-fill what's missing.
                vm.items.forEach(loadComparison);
            }
        });
    }

    function setReviewStatus(status) {
        if (vm.review_status === status) { return; }
        vm.review_status = status;
        vm.items = [];
        loadReview();
    }

    function approveItem(item) {
        if (vm.acting[item.id]) { return; }
        vm.acting[item.id] = true;

        AirfieldAdminService.ApproveReview(item.id).then(function (data) {
            vm.acting[item.id] = false;
            if (!data || data.success === false) {
                ToastService.error('Could not approve', messageOf(data, 'The airfield was not approved.'));
                return;
            }
            var name = item.reason === 'location_dup'
                ? (item.payload_decoded && item.payload_decoded.title)
                : item.airfield_title;
            ToastService.success('Approved', (name || 'Airfield') + (item.reason === 'location_dup'
                ? ' has been added to the database.'
                : ' is confirmed.'));
            removeCard(item);
        });
    }

    function dismissItem(item) {
        if (vm.acting[item.id]) { return; }
        vm.acting[item.id] = true;

        AirfieldAdminService.DismissReview(item.id).then(function (data) {
            vm.acting[item.id] = false;
            if (!data || data.success === false) {
                ToastService.error('Could not dismiss', messageOf(data, 'The item was not dismissed.'));
                return;
            }
            ToastService.success('Dismissed', item.reason === 'location_dup'
                ? 'The duplicate candidate was discarded.'
                : 'The auto-imported airfield was deleted.');
            removeCard(item);
        });
    }

    // Let the card play its exit animation, then drop it from the list.
    function removeCard(item) {
        vm.leaving[item.id] = true;
        $timeout(function () {
            var idx = vm.items.indexOf(item);
            if (idx > -1) { vm.items.splice(idx, 1); }
            delete vm.leaving[item.id];
            if (vm.review_status === 'pending') {
                vm.pending_review = vm.items.length;
            }
        }, 320);
    }

    function itemLat(item) {
        if (item.reason === 'location_dup' && item.payload_decoded) { return item.payload_decoded.wgs_n; }
        return item.wgs_n || (item.airfield && item.airfield.wgs_n);
    }

    function itemLon(item) {
        if (item.reason === 'location_dup' && item.payload_decoded) { return item.payload_decoded.wgs_e; }
        return item.wgs_e || (item.airfield && item.airfield.wgs_e);
    }

    function mapLink(lat, lon) {
        if (lat === null || lat === undefined || lon === null || lon === undefined) { return null; }
        return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
    }


    // ═══════════════════════════════════════════════════════════════
    //  SCREEN 3 — MANAGE (search / add / edit / delete)
    // ═══════════════════════════════════════════════════════════════

    function initManage() {
        vm.loading    = false;
        vm.query      = '';
        vm.results    = [];
        vm.searched   = false;
        vm.searching  = false;
        vm.saving     = false;
        vm.deleting   = false;

        vm.form       = null;     // the airfield being added/edited (null = form closed)
        vm.form_mode  = null;     // 'add' | 'edit'
        vm.confirm    = null;     // airfield pending delete confirmation
        vm.delete_blocked = null; // backend refusal message when a field is referenced

        vm.search        = search;
        vm.clearSearch   = clearSearch;
        vm.openAdd       = openAdd;
        vm.openEdit      = openEdit;
        vm.closeForm     = closeForm;
        vm.saveAirfield  = saveAirfield;
        vm.askDelete     = askDelete;
        vm.cancelDelete  = cancelDelete;
        vm.confirmDelete = confirmDelete;
        vm.setInactive   = setInactive;
        vm.sourceLabel   = sourceLabel;
        vm.sourceClass   = sourceClass;
        vm.isActive      = isActive;
        vm.elevSource    = elevSource;
    }

    // ── Elevation provenance ──
    // A `terrain` figure is the ground height at the coordinate from a 30 m DEM
    // (~±5 ft), NOT a surveyed field elevation. It's a fine replay datum but must
    // never be shown to a pilot as authoritative — hence the explicit "estimated"
    // pill. `manual` is the highest authority: the auto-filler won't overwrite it.
    function elevSource(af) {
        var s = af && af.elevation_source;
        if (s === 'terrain')     { return { label: 'estimated', cls: 'af-elev--estimated', show: true }; }
        if (s === 'manual')      { return { label: 'manual',    cls: 'af-elev--manual',    show: true }; }
        if (s === 'ourairports') { return { label: 'surveyed',  cls: 'af-elev--surveyed',  show: true }; }
        return { show: false };   // legacy / unknown origin — no pill
    }

    var searchTimer = null;
    function search() {
        var q = (vm.query || '').trim();

        if (searchTimer) { $timeout.cancel(searchTimer); }
        if (q.length < 2) {
            vm.results  = [];
            vm.searched = false;
            return;
        }

        // Debounce — this is a live-as-you-type search over up to 100 rows.
        searchTimer = $timeout(function () {
            vm.searching = true;
            AirfieldAdminService.SearchAirfields(q).then(function (data) {
                vm.searching = false;
                vm.searched  = true;

                if (!data || data.success === false) {
                    vm.results = [];
                    vm.error = messageOf(data, 'Search failed.');
                    return;
                }
                vm.error = null;
                // The endpoint may return the array directly or wrapped.
                vm.results = angular.isArray(data) ? data : (data.airfields || data.data || []);
            });
        }, 300);
    }

    function clearSearch() {
        vm.query    = '';
        vm.results  = [];
        vm.searched = false;
    }

    function openAdd() {
        vm.form_mode = 'add';
        vm.form = {
            title: '', code: '', wgs_n: null, wgs_e: null,
            country: '', country_code: '', elevation: null,
            af_type: 'small_airport', iata_code: '', municipality: '', active: 1
        };
        vm.delete_blocked = null;
        scrollToForm();
    }

    function openEdit(af) {
        vm.form_mode = 'edit';
        vm.form = {
            id:           af.id,
            title:        af.title,
            code:         af.code,
            wgs_n:        af.wgs_n !== null && af.wgs_n !== undefined ? parseFloat(af.wgs_n) : null,
            wgs_e:        af.wgs_e !== null && af.wgs_e !== undefined ? parseFloat(af.wgs_e) : null,
            country:      af.country || '',
            country_code: af.country_code || '',
            elevation:    af.elevation !== null && af.elevation !== undefined ? num(af.elevation) : null,
            af_type:      af.af_type || '',
            iata_code:    af.iata_code || '',
            municipality: af.municipality || '',
            active:       isActive(af) ? 1 : 0,
            source:       af.source,
            to_be_verified: af.to_be_verified,
            // Read-only — shown as a provenance pill. The backend re-stamps this
            // to 'manual' whenever an admin PUTs an elevation, so we never send it.
            elevation_source: af.elevation_source
        };
        vm.delete_blocked = null;
        scrollToForm();
    }

    function closeForm() {
        vm.form      = null;
        vm.form_mode = null;
    }

    function scrollToForm() {
        $timeout(function () {
            var el = document.getElementById('airfield-form-card');
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }, 60);
    }

    // Keep the country name and ISO code in step when the picker changes.
    vm.onCountryPicked = function () {
        if (!vm.form) { return; }
        vm.form.country = countryName(vm.form.country_code);
    };

    function saveAirfield() {
        if (vm.saving || !vm.form) { return; }

        var ok = ToastService.validateForm([
            { ok: !!(vm.form.title && vm.form.title.trim()), field: 'field-af-title', label: 'Airfield name' },
            { ok: !!(vm.form.code  && vm.form.code.trim()),  field: 'field-af-code',  label: 'Code' }
        ]);
        if (!ok) { return; }

        var payload = {
            title:        vm.form.title.trim(),
            code:         vm.form.code.trim().toUpperCase(),
            wgs_n:        vm.form.wgs_n,
            wgs_e:        vm.form.wgs_e,
            country:      vm.form.country,
            country_code: vm.form.country_code,
            elevation:    vm.form.elevation,
            af_type:      vm.form.af_type,
            iata_code:    vm.form.iata_code,
            municipality: vm.form.municipality,
            active:       vm.form.active ? 1 : 0
        };

        vm.saving = true;

        var request = vm.form_mode === 'add'
            ? AirfieldAdminService.CreateAirfield(payload)
            : AirfieldAdminService.UpdateAirfield(vm.form.id, payload);

        request.then(function (data) {
            vm.saving = false;

            if (!data || data.success === false) {
                ToastService.error(
                    vm.form_mode === 'add' ? 'Could not add airfield' : 'Could not save changes',
                    messageOf(data, 'The airfield was not saved.'));
                return;
            }

            ToastService.success(
                vm.form_mode === 'add' ? 'Airfield added' : 'Airfield updated',
                payload.code + ' — ' + payload.title);

            closeForm();
            if (vm.query && vm.query.trim().length >= 2) { search(); }
        });
    }

    function askDelete(af) {
        vm.confirm        = af;
        vm.delete_blocked = null;
    }

    function cancelDelete() {
        vm.confirm        = null;
        vm.delete_blocked = null;
    }

    function confirmDelete() {
        if (vm.deleting || !vm.confirm) { return; }
        var af = vm.confirm;
        vm.deleting = true;

        AirfieldAdminService.DeleteAirfield(af.id).then(function (data) {
            vm.deleting = false;

            if (!data || data.success === false) {
                // Most likely: flights/bookings still reference it. Keep the
                // dialog open and offer "set inactive" instead.
                vm.delete_blocked = messageOf(data, 'This airfield could not be deleted.');
                return;
            }

            ToastService.success('Airfield deleted', af.code + ' — ' + af.title);
            var idx = vm.results.indexOf(af);
            if (idx > -1) { vm.results.splice(idx, 1); }
            vm.confirm = null;
            if (vm.form && vm.form.id === af.id) { closeForm(); }
        });
    }

    // Fallback when a delete is refused: PUT active: 0.
    function setInactive() {
        if (vm.deleting || !vm.confirm) { return; }
        var af = vm.confirm;
        vm.deleting = true;

        AirfieldAdminService.UpdateAirfield(af.id, { active: 0 }).then(function (data) {
            vm.deleting = false;

            if (!data || data.success === false) {
                ToastService.error('Could not update', messageOf(data, 'The airfield was not changed.'));
                return;
            }

            ToastService.success('Set inactive', af.code + ' will no longer be offered for selection.');
            af.active = 0;
            vm.confirm        = null;
            vm.delete_blocked = null;
        });
    }

    function isActive(af) {
        return num(af.active) === 1;
    }

    function sourceLabel(af) {
        if (!af.source) { return 'legacy'; }
        return af.source === 'ourairports' ? 'OurAirports' : af.source;
    }

    function sourceClass(af) {
        if (!af.source)                    { return 'af-badge--legacy'; }
        if (af.source === 'ourairports')   { return 'af-badge--import'; }
        if (af.source === 'manual')        { return 'af-badge--manual'; }
        return 'af-badge--legacy';
    }


    // ═══════════════════════════════════════════════════════════════
    //  SHARED HELPERS
    // ═══════════════════════════════════════════════════════════════

    // MySQL hands numeric columns back as strings — coerce before maths.
    function num(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    function pct(part, whole) {
        var p = num(part), w = num(whole);
        return w > 0 ? Math.round((p / w) * 100) : 0;
    }

    function countryName(code) {
        return AirfieldAdminService.countryName(code);
    }

    function countryFlag(code) {
        if (!code) { return '🌐'; }
        var list = AirfieldAdminService.countries;
        for (var i = 0; i < list.length; i++) {
            if (list[i].code === String(code).toUpperCase()) { return list[i].flag; }
        }
        return '🌐';
    }

    function typeLabel(type) {
        if (!type) { return 'Legacy'; }
        for (var i = 0; i < vm.af_types.length; i++) {
            if (vm.af_types[i].value === type) { return vm.af_types[i].label; }
        }
        return type;
    }

    function typeIcon(type) {
        for (var i = 0; i < vm.af_types.length; i++) {
            if (vm.af_types[i].value === type) { return vm.af_types[i].icon; }
        }
        return 'fa-map-marker-alt';
    }

    // Services resolve with { success:false, message } where message may itself
    // be an object from the API — dig out something printable.
    function messageOf(data, fallback) {
        if (!data) { return fallback; }
        if (data.error === 'FORBIDDEN') { return 'You do not have permission to do that.'; }
        var m = data.message;
        if (!m) { return fallback; }
        if (typeof m === 'string') { return m; }
        if (m.message && typeof m.message === 'string') { return m.message; }
        return fallback;
    }
}
