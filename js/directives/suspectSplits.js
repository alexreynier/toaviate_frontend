// ─────────────────────────────────────────────────────────────────────────
// suspectSplits — "Split flights to review" list (FRONTEND_TRACK_DATA_GUIDE.md
// §4.2). One shared component, mounted on the club flights area
// (dashboard.manage_club.split_review) and the ToAviate-admin track tools:
//
//   <suspect-splits club-id="vm.club_id" admin="false"></suspect-splits>
//   <suspect-splits admin="true"></suspect-splits>     (admins: every club when
//                                                       no club-id is given)
//
// Fetches FoxTrackService.SplitsSuspect on mount and whenever club-id changes;
// "show kept" re-fetches with include_dismissed=1. FORBIDDEN on the list →
// renders nothing (ss.hidden; the host element gets .ssp-host--hidden).
//
// Per row: Undo the split (detail fetch → before/after preview → inline
// confirm → SplitsUnsplit {confirm:1, note}) and Keep it (SplitsDismiss with
// an optional note, inline confirm). After either write the list is re-fetched
// and 'suspectSplits:changed' is emitted so a host page can refresh its own
// flight list. Undo results are kept in ss.results (above the list) because the
// merged pair disappears from the list itself.
//
// All times from the API are UTC 'HH:MM:SS' / 'Y-m-d H:i:s' — shown as HH:MM
// (boundary times keep their seconds), never timezone-shifted. Row state uses
// the _underscore convention so it is never sent back.
// ─────────────────────────────────────────────────────────────────────────
app.directive('suspectSplits', ['FoxTrackService', 'ToastService', function (FoxTrackService, ToastService) {
    return {
        restrict: 'E',
        scope: {
            clubId: '=?',
            admin:  '@?'
        },
        templateUrl: 'views/directives/suspect_splits.html',
        controllerAs: 'ss',
        bindToController: true,
        controller: ['$scope', '$element', function ($scope, $element) {
            var ss = this;

            // Invoice statuses the backend treats as unpaid (anything else is "paid")
            var UNPAID = ['draft', 'issued', 'overdue', 'unpaid', 'pending', 'sent'];

            ss.isAdmin = (ss.admin === 'true' || ss.admin === true);

            ss.hidden = false;          // FORBIDDEN on the list → render nothing
            ss.actionsHidden = false;   // FORBIDDEN on a write → keep the list, drop the buttons
            ss.loading = false;
            ss.loaded = false;
            ss.error = null;
            ss.rows = [];
            ss.count = 0;
            ss.scanned = 0;
            ss.includeDismissed = false;
            ss.results = [];            // undo result panels (newest first)

            ss.verdictLabel = FoxTrackService.verdictLabel;
            ss.blockerLabel = FoxTrackService.blockerLabel;

            ss.load = load;
            ss.hm = hm;
            ss.hms = hms;
            ss.dateLabel = dateLabel;
            ss.money = money;
            ss.invoiceLine = invoiceLine;
            ss.changeLabel = changeLabel;
            ss.changeValue = changeValue;

            ss.startUndo = startUndo;
            ss.cancelUndo = cancelUndo;
            ss.askUndo = askUndo;
            ss.doUndo = doUndo;
            ss.startKeep = startKeep;
            ss.cancelKeep = cancelKeep;
            ss.doKeep = doKeep;
            ss.closeResult = closeResult;

            $scope.$watch('ss.clubId', function () { load(); });

            $scope.$watch('ss.hidden', function (h) {
                $element.toggleClass('ssp-host--hidden', !!h);
            });

            // ── Load ──────────────────────────────────────────────────────

            function load() {
                // Re-read the attribute here: bindings are pre-assigned on this Angular, but
                // reading them at call time keeps the directive safe on a later upgrade.
                ss.isAdmin = (ss.admin === 'true' || ss.admin === true);
                var params = {};
                if (ss.clubId) {
                    params.club_id = ss.clubId;
                } else if (!ss.isAdmin) {
                    // A manager mount without a club can never succeed — show nothing.
                    ss.hidden = true;
                    ss.rows = [];
                    return;
                }
                if (ss.includeDismissed) { params.include_dismissed = 1; }

                ss.loading = true;
                ss.error = null;
                FoxTrackService.SplitsSuspect(params).then(function (data) {
                    ss.loading = false;
                    ss.loaded = true;
                    if (!data || data.success === false) {
                        if (data && data.error === 'FORBIDDEN') {
                            ss.hidden = true;
                            ss.rows = [];
                            return;
                        }
                        ss.error = (data && data.message) || 'The split review list could not be loaded.';
                        return;
                    }
                    ss.hidden = false;
                    ss.rows = (data.suspects || []).map(shapeRow);
                    ss.count = ss.rows.length;
                    ss.scanned = data.scanned || 0;
                });
            }

            // ── Row shaping (once per fetch — ng-repeat compares by reference) ──

            function shapeRow(row) {
                row._leg1 = legView(row.leg1);
                row._leg2 = legView(row.leg2);
                row._sameDate = !!(row.leg1 && row.leg2 && row.leg1.flight_date === row.leg2.flight_date);
                row._boundary = boundaryView(row.boundary);
                row._review = reviewView(row.review);
                row._blockers = (row.blockers || []).map(FoxTrackService.blockerLabel);
                row._undo = { open: false };
                row._keep = { open: false };
                return row;
            }

            function legView(leg) {
                leg = leg || {};
                var chips = [];
                if (+leg.booked_in === 1) {
                    chips.push({ cls: 'ssp-chip--green', icon: 'fa-check', text: 'booked in' });
                } else if (+leg.booked_out === 1) {
                    chips.push({ cls: 'ssp-chip--amber', icon: 'fa-plane-departure', text: 'open bookout' });
                } else {
                    chips.push({ cls: 'ssp-chip--grey', icon: 'fa-minus', text: 'not booked out' });
                }
                (leg.invoices || []).forEach(function (inv) {
                    var paid = UNPAID.indexOf(String(inv.status || '').toLowerCase()) === -1;
                    chips.push({
                        cls: paid ? 'ssp-chip--green' : 'ssp-chip--blue',
                        icon: 'fa-file-invoice',
                        text: 'invoice ' + inv.id + ' ' + String(inv.status || '').replace(/_/g, ' ')
                    });
                });
                var tr = +leg.training_records || 0;
                if (tr > 0) {
                    chips.push({ cls: 'ssp-chip--purple', icon: 'fa-graduation-cap', text: tr + (tr === 1 ? ' record' : ' records') });
                }
                var crew = [];
                if (+leg.pic_id > 0) { crew.push('PIC #' + leg.pic_id); }
                if (+leg.put_id > 0) { crew.push('P/UT #' + leg.put_id); }
                if (+leg.instructor_id > 0) { crew.push('instructor #' + leg.instructor_id); }
                return {
                    chips: chips,
                    crew: crew.join(' · '),
                    hasAirborne: !!(leg.takeoff_time && leg.landing_time)
                };
            }

            function boundaryView(b) {
                if (!b) { return null; }
                var stats = [];
                if (b.min_agl_ft !== null && b.min_agl_ft !== undefined) { stats.push(fmtNum(b.min_agl_ft) + ' ft AGL min'); }
                if (b.max_speed_kt !== null && b.max_speed_kt !== undefined) { stats.push(fmtNum(b.max_speed_kt) + ' kt max'); }
                return {
                    label: FoxTrackService.verdictLabel(b.verdict),
                    duration: (b.duration_s !== null && b.duration_s !== undefined) ? b.duration_s + ' s' : '',
                    stats: stats.join(' · ')
                };
            }

            function reviewView(r) {
                if (!r) { return null; }
                var v = { action: r.action, note: r.note || '', when: r.created_at || '', user: r.user_id, cls: 'ssp-review--info', icon: 'fa-info-circle', text: '' };
                if (r.action === 'flagged') {
                    v.cls = 'ssp-review--warn'; v.icon = 'fa-flag';
                    v.text = 'Flagged at book-in — the pilot forced this split past the tracker\'s warning';
                } else if (r.action === 'dismissed') {
                    v.cls = 'ssp-review--muted'; v.icon = 'fa-bookmark';
                    v.text = 'Kept as two flights' + (r.user_id ? ' by user #' + r.user_id : '');
                } else if (r.action === 'unsplit') {
                    v.cls = 'ssp-review--ok'; v.icon = 'fa-undo';
                    v.text = 'Split undone' + (r.merge_id ? ' (merge #' + r.merge_id + ')' : '');
                } else {
                    v.text = r.action || 'reviewed';
                }
                return v;
            }

            // ── Undo the split ────────────────────────────────────────────

            function startUndo(row) {
                if (row._undo.loading || row._undo.busy) { return; }
                row._keep.open = false;
                row._undo = { open: true, loading: true, note: '', confirming: false, busy: false, error: null, blockers: null, preview: null, changes: [], retried: false };
                FoxTrackService.SplitsSuspectDetail(row.leg1.id).then(function (data) {
                    row._undo.loading = false;
                    if (!data || data.success === false) {
                        applyError(row, data, 'The preview could not be loaded.');
                        return;
                    }
                    // The detail is authoritative for the blockers right now
                    if (data.blockers) {
                        row.blockers = data.blockers;
                        row.can_unsplit = !!data.can_unsplit;
                        row._blockers = data.blockers.map(FoxTrackService.blockerLabel);
                        if (!row.can_unsplit) { row._undo.blockers = row._blockers; }
                    }
                    var p = data.preview || {};
                    row._undo.preview = p;
                    row._undo.changes = Object.keys(p.changes || {}).map(function (col) {
                        return {
                            col: col,
                            label: changeLabel(col),
                            before: changeValue(col, p.changes[col].before),
                            after: changeValue(col, p.changes[col].after)
                        };
                    });
                    row._undo.invoices = p.invoices_to_recalculate || [];
                    row._undo.warnings = p.warnings || [];
                });
            }

            function cancelUndo(row) {
                if (row._undo.busy) { return; }
                row._undo.open = false;
                row._undo.confirming = false;
            }

            function askUndo(row) {
                if (!row.can_unsplit || row._undo.busy) { return; }
                row._undo.confirming = true;
            }

            function doUndo(row) {
                if (!row.can_unsplit || row._undo.busy) { return; }
                row._undo.busy = true;
                row._undo.error = null;
                var body = { confirm: 1 };
                if (row._undo.note && row._undo.note.trim()) { body.note = row._undo.note.trim(); }
                FoxTrackService.SplitsUnsplit(row.leg1.id, body).then(function (data) {
                    if (data && data.success === false && data.error === 'CONFIRM_REQUIRED' && !row._undo.retried) {
                        // Should never happen (confirm:1 is always sent) — one retry, then give up
                        row._undo.retried = true;
                        row._undo.busy = false;
                        doUndo(row);
                        return;
                    }
                    row._undo.busy = false;
                    if (!data || data.success === false) {
                        applyError(row, data, 'The split could not be undone.');
                        return;
                    }
                    ss.results.unshift(shapeResult(data, row));
                    row._undo.open = false;
                    ToastService.success('Split undone', 'Sheet ' + data.leg1.id + ' now covers the whole flight');
                    $scope.$emit('suspectSplits:changed', { action: 'unsplit', leg1_id: data.leg1.id, leg2_superseded_id: data.leg2_superseded_id, merge_id: data.merge_id });
                    load();
                });
            }

            function shapeResult(data, row) {
                var leg = data.leg1 || {};
                var invoices = (data.invoices_recalculated || []).map(function (r) {
                    return { id: r.invoice_id || r.id, line: invoiceLine(r), cls: invoiceCls(r) };
                });
                return {
                    id: leg.id,
                    leg2_superseded_id: data.leg2_superseded_id,
                    merge_id: data.merge_id,
                    date: leg.flight_date,
                    off: hm(leg.brakes_off), on: hm(leg.brakes_on),
                    tko: hm(leg.takeoff_time), ldg: hm(leg.landing_time),
                    flight_time: leg.flight_time,
                    airborne_time: leg.airborne_time,
                    full_stop: leg.full_stop_landings,
                    tng: leg.touch_and_go,
                    invoices: invoices,
                    warnings: data.warnings || [],
                    leg2_id_before: row && row.leg2 ? row.leg2.id : null
                };
            }

            function closeResult(res) {
                var i = ss.results.indexOf(res);
                if (i > -1) { ss.results.splice(i, 1); }
            }

            // ── Keep it (dismiss) ─────────────────────────────────────────

            function startKeep(row) {
                if (row._keep.busy) { return; }
                row._undo.open = false;
                row._keep = { open: true, note: '', busy: false, error: null };
            }

            function cancelKeep(row) {
                if (row._keep.busy) { return; }
                row._keep.open = false;
            }

            function doKeep(row) {
                if (row._keep.busy) { return; }
                row._keep.busy = true;
                row._keep.error = null;
                var body = {};
                if (row._keep.note && row._keep.note.trim()) { body.note = row._keep.note.trim(); }
                FoxTrackService.SplitsDismiss(row.leg1.id, body).then(function (data) {
                    row._keep.busy = false;
                    if (!data || data.success === false) {
                        var msg = errorMessage(data, 'The pair could not be marked as kept.');
                        if (data && data.error === 'FORBIDDEN') { ss.actionsHidden = true; }
                        row._keep.error = msg;
                        ToastService.error('Not saved', msg);
                        return;
                    }
                    row._keep.open = false;
                    ToastService.success('Kept as two flights', 'Sheets ' + row.leg1.id + ' and ' + row.leg2.id + ' stay separate');
                    $scope.$emit('suspectSplits:changed', { action: 'dismissed', leg1_id: row.leg1.id, leg2_id: row.leg2.id });
                    load();
                });
            }

            // ── Errors (§4.2) ─────────────────────────────────────────────

            function errorMessage(data, fallback) {
                var code = data && data.error;
                switch (code) {
                    case 'BLOCKED':      return 'This split cannot be undone automatically.';
                    case 'NOT_SUSPECT':  return 'This pair is not on a phantom boundary — genuine splits are not undone here.';
                    case 'NOT_A_SPLIT':  return 'These sheets are no longer a split pair.';
                    case 'FORBIDDEN':    return 'You do not have permission to review splits for this club.';
                    case 'EXCEPTION':    return 'The undo failed — nothing was changed.';
                    case 'NO_ENTRY':     return 'The tracker entry behind this split no longer exists.';
                    case 'UNAVAILABLE':
                    case 'SPLIT_REVIEW_UNAVAILABLE': return 'Split review is not available on this server.';
                }
                return (data && data.message) || fallback;
            }

            function applyError(row, data, fallback) {
                var code = data && data.error;
                var msg = errorMessage(data, fallback);
                row._undo.confirming = false;
                row._undo.error = msg;
                if (code === 'BLOCKED') {
                    row.blockers = data.blockers || [];
                    row.can_unsplit = false;
                    row._blockers = row.blockers.map(FoxTrackService.blockerLabel);
                    row._undo.blockers = row._blockers;
                } else if (code === 'FORBIDDEN') {
                    ss.actionsHidden = true;
                    row._undo.open = false;
                } else if (code === 'NOT_A_SPLIT' || code === 'NO_ENTRY') {
                    row._undo.open = false;
                    load();
                } else if (code === 'EXCEPTION' && data && data.message) {
                    row._undo.error = msg + ' ' + data.message;
                }
                ToastService.error('Not saved', msg);
            }

            // ── Formatting ────────────────────────────────────────────────

            // 'HH:MM:SS' or 'Y-m-d H:i:s' → 'HH:MM' ('—' when empty / 00:00:00)
            function hm(t) {
                if (!t) { return '—'; }
                var s = String(t);
                var part = s.length >= 8 ? s.slice(-8) : s;
                if (part === '00:00:00') { return '—'; }
                return part.slice(0, 5);
            }
            // keeps the seconds (boundary timestamps)
            function hms(t) {
                if (!t) { return '—'; }
                var s = String(t);
                return s.length >= 8 ? s.slice(-8) : s;
            }
            function dateLabel(d) {
                if (!d) { return ''; }
                var m = moment(d, 'YYYY-MM-DD');
                return m.isValid() ? m.format('ddd D MMM YYYY') : d;
            }
            function fmtNum(n) {
                var v = Math.round(parseFloat(n));
                if (isNaN(v)) { return String(n); }
                return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }
            // signed GBP: +£58.33 / −£12.00 / £0.00
            function money(n) {
                var v = parseFloat(n) || 0;
                var sign = v > 0.004 ? '+' : (v < -0.004 ? '−' : '');
                return sign + '£' + Math.abs(v).toFixed(2);
            }
            function invoiceLine(r) {
                var id = r.invoice_id || r.id;
                var d = parseFloat(r.difference) || 0;
                if (d > 0.004)  { return money(d) + ' added to invoice ' + id; }
                if (d < -0.004) { return money(d) + ' taken off invoice ' + id; }
                return 'invoice ' + id + ' recalculated — no change';
            }
            function invoiceCls(r) {
                var d = parseFloat(r.difference) || 0;
                if (d > 0.004)  { return 'ssp-invoice--up'; }
                if (d < -0.004) { return 'ssp-invoice--down'; }
                return 'ssp-invoice--same';
            }
            function changeLabel(col) {
                return ({
                    brakes_off:          'Brakes off',
                    takeoff_time:        'Take-off',
                    landing_time:        'Landing',
                    brakes_on:           'Brakes on',
                    brakes_off_rounded:  'Brakes off (rounded)',
                    takeoff_rounded:     'Take-off (rounded)',
                    landing_rounded:     'Landing (rounded)',
                    brakes_on_rounded:   'Brakes on (rounded)',
                    airborne_time:       'Airborne time',
                    flight_time:         'Flight time',
                    full_stop_landings:  'Full-stop landings',
                    touch_and_go:        'Touch-and-gos',
                    is_split_flight:     'Split flight',
                    tpc_split_leg:       'Split leg',
                    tpc_split_mode:      'Split mode',
                    tpc_prev_leg_id:     'Previous leg',
                    flight_data_file_id: 'Track segment file'
                })[col] || String(col).replace(/_/g, ' ');
            }
            function changeValue(col, v) {
                if (v === null || v === undefined || v === '') { return '—'; }
                if (col === 'is_split_flight') { return (+v === 1) ? 'yes' : 'no'; }
                if (col === 'flight_data_file_id') { return '#' + v; }
                if (/_time$|_rounded$|^brakes_/.test(col) && /^\d\d:\d\d:\d\d$/.test(String(v))) { return String(v).slice(0, 5); }
                return String(v);
            }
        }]
    };
}]);
