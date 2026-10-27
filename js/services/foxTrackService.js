// FoxTrackService — track-data endpoints (FRONTEND_TRACK_DATA_GUIDE.md):
// per-leg replay segments, track-derived events, tracker-vs-track-vs-sheet
// reconciliation (+ Apply), split points for the book-in picker, and the
// ToAviate-admin tools (analysis/segments backfill, mis-linked recording
// scan / repair / undo / resolve / report).
//
// Resolves, never rejects: errors come back as { success:false, error, message }
// (the backend answers 200 with that shape for NO_TRACK / FORBIDDEN / etc.).
// Shared label helpers live here so every screen names a verdict, a detection
// method or a counts source the same way.
app.factory('FoxTrackService', FoxTrackService);
FoxTrackService.$inject = ['$http', '$location'];
function FoxTrackService($http, $location) {
    var base = '/api/v1/fox_track';
    var service = {};

    // Per log sheet
    service.GetPls          = GetPls;           // GET  pls/{id}            → reconciliation (tracker · track · sheet · recommended)
    service.Apply           = Apply;            // POST pls/{id}/apply      { fields?, note? } → counts written to the sheet (club staff)
    service.GetSplitPoints  = GetSplitPoints;   // GET  pls/{id}/split_points → every real ground stop, both sources
    service.GetSegments     = GetSegments;      // GET  pls/{id}/segments   → { track_scope, file, original, siblings }
    service.GetEvents       = GetEvents;        // GET  pls/{id}/events     → { track:{…summary_for_file…} } (events only, no sheet blocks)

    // Files / admin tools (club super admin, same gate as fox_trackers/*)
    service.Analyse          = Analyse;          // POST analyse/{file_id} { force }
    service.Backfill         = Backfill;         // POST backfill { limit }              → repeat until remaining = 0
    service.SegmentsBackfill = SegmentsBackfill; // POST segments/backfill { dry_run, limit }
    service.SegmentsRebuild  = SegmentsRebuild;  // POST segments/rebuild/{pls_id}
    service.GetFile          = GetFile;          // GET  file/{file_id}
    service.LinksScan        = LinksScan;        // GET  links/scan?imei=&limit=
    service.LinksRepair      = LinksRepair;      // POST links/repair { batch?, limit?, imei? }
    service.LinksUndo        = LinksUndo;        // POST links/undo { batch }
    service.LinksResolve     = LinksResolve;     // POST links/resolve { file_id, decision, entry_id?, batch? }
    service.LinksReport      = LinksReport;      // GET  links/report?batch=

    // Suspect splits (§4.2) — club manager of the club / ToAviate admin
    service.SplitsSuspect       = SplitsSuspect;       // GET  splits/suspect?club_id=&include_dismissed=
    service.SplitsSuspectDetail = SplitsSuspectDetail; // GET  splits/suspect/{leg1_id} → row + preview
    service.SplitsUnsplit       = SplitsUnsplit;       // POST splits/unsplit/{leg1_id} { confirm:1, note? }
    service.SplitsDismiss       = SplitsDismiss;       // POST splits/dismiss/{leg1_id} { note? }

    // Shared copy
    service.verdictLabel     = verdictLabel;
    service.methodLabel      = methodLabel;
    service.countsSourceChip = countsSourceChip;
    service.landingKindLabel = landingKindLabel;
    service.flagLabel        = flagLabel;
    service.blockerLabel     = blockerLabel;   // §4.2 unsplit blockers
    return service;

    function GetPls(pls_id)               { return $http.get(base + '/pls/' + pls_id).then(handleSuccess, handleError); }
    function Apply(pls_id, body)          { return $http.post(base + '/pls/' + pls_id + '/apply', body || {}).then(handleSuccess, handleError); }
    function GetSplitPoints(pls_id)       { return $http.get(base + '/pls/' + pls_id + '/split_points').then(handleSuccess, handleError); }
    function GetSegments(pls_id)          { return $http.get(base + '/pls/' + pls_id + '/segments').then(handleSuccess, handleError); }
    function GetEvents(pls_id)            { return $http.get(base + '/pls/' + pls_id + '/events').then(handleSuccess, handleError); }

    function Analyse(file_id, force)      { return $http.post(base + '/analyse/' + file_id, { force: force ? 1 : 0 }).then(handleSuccess, handleError); }
    function Backfill(limit)              { return $http.post(base + '/backfill', { limit: limit || 200 }).then(handleSuccess, handleError); }
    function SegmentsBackfill(body)       { return $http.post(base + '/segments/backfill', body || { dry_run: 1, limit: 50 }).then(handleSuccess, handleError); }
    function SegmentsRebuild(pls_id)      { return $http.post(base + '/segments/rebuild/' + pls_id, {}).then(handleSuccess, handleError); }
    function GetFile(file_id)             { return $http.get(base + '/file/' + file_id).then(handleSuccess, handleError); }
    function LinksScan(params)            { return $http.get(base + '/links/scan', { params: params || {} }).then(handleSuccess, handleError); }
    function LinksRepair(body)            { return $http.post(base + '/links/repair', body || {}).then(handleSuccess, handleError); }
    function LinksUndo(batch)             { return $http.post(base + '/links/undo', { batch: batch }).then(handleSuccess, handleError); }
    function LinksResolve(body)           { return $http.post(base + '/links/resolve', body || {}).then(handleSuccess, handleError); }
    function SplitsSuspect(params)        { return $http.get(base + '/splits/suspect', { params: params || {} }).then(handleSuccess, handleError); }
    function SplitsSuspectDetail(leg1_id) { return $http.get(base + '/splits/suspect/' + leg1_id).then(handleSuccess, handleError); }
    function SplitsUnsplit(leg1_id, body) { return $http.post(base + '/splits/unsplit/' + leg1_id, body || { confirm: 1 }).then(handleSuccess, handleError); }
    function SplitsDismiss(leg1_id, body) { return $http.post(base + '/splits/dismiss/' + leg1_id, body || {}).then(handleSuccess, handleError); }
    function LinksReport(batch)           { return $http.get(base + '/links/report', { params: batch ? { batch: batch } : {} }).then(handleSuccess, handleError); }

    // ── Copy ──────────────────────────────────────────────────────────────
    // comparison.tracker_only[].verdict — a tracker "flight" the track disproves
    function verdictLabel(v) {
        return ({
            phantom_taxi:     'fast taxi, not a flight',
            phantom_airborne: 'GPS speed glitch in the air, not a landing',
            outside_file:     'this file does not cover that time (mis-linked recording)',
            hop_emitted:      'ground excursion the tracker counted as a flight',
            unexplained:      'not seen in the track file'
        })[v] || (v || '');
    }
    // track_events.events[].method
    function methodLabel(m) {
        return ({
            low_pass_touch:             'touch-and-go at speed (not seen by the tracker)',
            hop:                        'ground excursion the tracker counted as a flight',
            go_around_unreliable_datum: 'low point, height reference unreliable',
            speed:                      'from ground speed',
            speed_agl:                  'from ground speed and height',
            go_around:                  'climb-out without a touchdown'
        })[m] || (m || '');
    }
    function landingKindLabel(k) {
        return ({ full_stop: 'full stop', stop_and_go: 'stop-and-go', touch_and_go: 'touch-and-go' })[k] || (k || 'landing');
    }
    // sheet.track_counts_source (§2.1) → { label, cls } — null/undefined → null (show nothing)
    function countsSourceChip(source) {
        return ({
            tracker:    { label: 'tracker estimate',   cls: 'tcs-chip--tracker',    hint: 'The tracker\'s guess: one full stop, the rest touch-and-gos.' },
            calculated: { label: 'from track',         cls: 'tcs-chip--calculated', hint: 'Counts derived from the recorded track before anyone booked the flight in.' },
            manual:     { label: 'edited',             cls: 'tcs-chip--manual',     hint: 'A person set these counts; the system never overwrites them.' },
            applied:    { label: 'applied from track', cls: 'tcs-chip--applied',    hint: 'Club staff applied the track-derived counts.' }
        })[source] || null;
    }
    // recommended.flags[] → short warning text
    function flagLabel(f) {
        return ({
            TIME_DISAGREEMENT:             'Tracker and track disagree on the times',
            LANDING_COUNT_DISAGREEMENT:    'Landing counts disagree and the difference is unexplained',
            LOW_TRACK_CONFIDENCE:          'Low confidence in the track analysis',
            NO_TRACK_EVENTS:               'No events could be detected in the track',
            KINDS_FROM_FEWER_LANDINGS:     'Landing kinds come from fewer landings than were counted',
            AIRBORNE_SECONDS_DISAGREEMENT: 'Airborne time disagrees between tracker and track',
            TRACKER_MISSING_TAKEOFF:       'The tracker missed a take-off the track shows',
            TRACKER_MISSING_LANDING:       'The tracker missed a landing the track shows',
            LOW_AGREEMENT:                 'Tracker and track agree on few of the flights',
            TRACKER_PHANTOM_PAIRS:         'Tracker "flights" that were fast taxis or mid-air glitches (explained)',
            TRACK_ONLY_TOUCH_AND_GOS:      'Touch-and-gos at speed the tracker cannot see (explained)',
            TRACKER_PAIRS_OUTSIDE_TRACK:   'Tracker flights outside the recording — mis-linked file',
            SEGMENT_TRUNCATED:             'Track cut at the split — landings for this leg come from the tracker'
        })[f] || f;
    }

    // suspect-split blockers[] → copy (§4.2)
    function blockerLabel(b) {
        return ({
            leg2_booked_in:             'the second leg has been booked in',
            leg2_invoiced:              'the second leg has an invoice',
            leg2_has_training_record:   'the second leg has a training record',
            leg1_invoice_paid:          'the first leg\'s invoice has been paid — needs a manual flight edit / credit note',
            leg2_claimed_by_other_user: 'the second leg was claimed by somebody else'
        })[b] || b;
    }

    function handleSuccess(res) { return res.data; }
    function handleError(res) {
        if (res.status == 401) { $location.path('/login'); }
        var d = res.data;
        if (d && typeof d === 'object' && d.error) { d.success = false; return d; }
        return { success: false, status: res.status, message: (d && d.message) || d || 'Request failed' };
    }
}
