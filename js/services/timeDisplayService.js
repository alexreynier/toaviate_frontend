// ═══════════════════════════════════════════════════════════════════════
//  TimeDisplayService — one club-wide convention for how flight times
//  are SHOWN (never how they are charged — that stays on charge_type /
//  charge_basis and the invoice directive).
//
//  A club picks one of four modes (clubs.time_display, see
//  BACKEND_TIME_DISPLAY_GUIDE.md), an aircraft may override it
//  (planes.time_display, blank = club default), and a viewer may
//  temporarily "switch times to …" from a page toolbar (localStorage).
//
//      viewer override  >  aircraft override  >  club setting  >  default
//
//  Rendering goes through the <flight-times> directive (flightTimes.js)
//  which calls pick(row, mode) below. Rows come from many endpoints with
//  slightly different field names, so pick() normalises them.
// ═══════════════════════════════════════════════════════════════════════
app.factory('TimeDisplayService', TimeDisplayService);

TimeDisplayService.$inject = ['$rootScope', '$q', 'ClubService'];
function TimeDisplayService($rootScope, $q, ClubService) {

    var DEFAULT_MODE = 'block_rounded';
    var STORAGE_KEY = 'toaviate_time_display_override';
    var EVENT = 'timeDisplay:changed';

    var MODES = [
        {
            value: 'block_rounded', window: 'block', rounded: true,
            title: 'Brakes off → brakes on',
            sub: 'Rounded to the nearest 5 minutes',
            short: 'Block · 5 min',
            badge: 'EASA block time',
            icon: 'fa-clock',
            description: 'The logbook convention: first movement to final stop, each time rounded to the nearest five minutes.'
        },
        {
            value: 'block_exact', window: 'block', rounded: false,
            title: 'Brakes off → brakes on',
            sub: 'Exact, to the minute',
            short: 'Block · exact',
            badge: '',
            icon: 'fa-stopwatch',
            description: 'First movement to final stop exactly as recorded, rounded only to the nearest minute.'
        },
        {
            value: 'airborne_rounded', window: 'airborne', rounded: true,
            title: 'First takeoff → last landing',
            sub: 'Rounded to the nearest 5 minutes',
            short: 'Airborne · 5 min',
            badge: '',
            icon: 'fa-plane-departure',
            description: 'Wheels up to wheels down, each time rounded to the nearest five minutes. Taxi time is not shown.'
        },
        {
            value: 'airborne_exact', window: 'airborne', rounded: false,
            title: 'First takeoff → last landing',
            sub: 'Exact, to the minute',
            short: 'Airborne · exact',
            badge: '',
            icon: 'fa-plane',
            description: 'Wheels up to wheels down exactly as recorded by the tracker, rounded only to the nearest minute.'
        }
    ];

    var LABELS = {
        block:    { from: 'Brakes Off', to: 'Brakes On', duration: 'Block Time', window: 'Brakes off → on', durationShort: 'Block' },
        airborne: { from: 'Takeoff',    to: 'Landing',   duration: 'Airborne Time', window: 'Takeoff → landing', durationShort: 'Airborne' }
    };

    var clubModes = {};   // club_id → mode string (loaded or set)
    var clubLoads = {};   // club_id → promise while a GET /clubs/{id} is in flight
    var contexts  = [];   // live context objects handed to controllers
    var viewerOverride = readOverride();

    var service = {
        MODES: MODES,
        DEFAULT_MODE: DEFAULT_MODE,
        EVENT: EVENT,
        def: def,
        isValid: isValid,
        labelsFor: labelsFor,
        variant: variant,
        getViewerOverride: getViewerOverride,
        setViewerOverride: setViewerOverride,
        setClubMode: setClubMode,
        loadClubMode: loadClubMode,
        clubModeSync: clubModeSync,
        resolve: resolve,
        context: context,
        pick: pick,
        roundToFive: roundToFive,
        hm: hm
    };
    return service;

    // ── Mode helpers ───────────────────────────────────────────────────

    function isValid(mode) {
        for (var i = 0; i < MODES.length; i++) {
            if (MODES[i].value === mode) { return true; }
        }
        return false;
    }

    function def(mode) {
        for (var i = 0; i < MODES.length; i++) {
            if (MODES[i].value === mode) { return MODES[i]; }
        }
        return def(DEFAULT_MODE);
    }

    // Same rounding, different window — used when a screen pins the window
    // (training records are always brakes-to-brakes) but follows the rounding.
    function variant(mode, windowName) {
        var d = def(mode);
        if (!windowName || d.window === windowName) { return d; }
        for (var i = 0; i < MODES.length; i++) {
            if (MODES[i].window === windowName && MODES[i].rounded === d.rounded) { return MODES[i]; }
        }
        return d;
    }

    function labelsFor(modeOrDef) {
        var d = (typeof modeOrDef === 'string') ? def(modeOrDef) : (modeOrDef || def(DEFAULT_MODE));
        return LABELS[d.window];
    }

    // ── Viewer override (per browser, per user) ────────────────────────

    function storageKey() {
        var cu = $rootScope.globals && $rootScope.globals.currentUser;
        return STORAGE_KEY + (cu && cu.id ? '_' + cu.id : '');
    }

    function readOverride() {
        try {
            var v = localStorage.getItem(storageKey());
            return isValid(v) ? v : null;
        } catch (e) { return null; }
    }

    function getViewerOverride() {
        // Re-read lazily: the user may have logged in after the service was built.
        viewerOverride = readOverride();
        return viewerOverride;
    }

    function setViewerOverride(mode) {
        viewerOverride = isValid(mode) ? mode : null;
        try {
            if (viewerOverride) { localStorage.setItem(storageKey(), viewerOverride); }
            else { localStorage.removeItem(storageKey()); }
        } catch (e) {}
        notify();
    }

    // ── Club mode (cached per club for the session) ────────────────────

    function normaliseClubMode(club) {
        var m = club && club.time_display;
        return isValid(m) ? m : DEFAULT_MODE;
    }

    function setClubMode(club_id, mode) {
        if (!club_id) { return; }
        clubModes[String(club_id)] = isValid(mode) ? mode : DEFAULT_MODE;
        notify();
    }

    function loadClubMode(club_id) {
        if (!club_id) { return $q.when(DEFAULT_MODE); }
        var key = String(club_id);
        if (clubModes[key]) { return $q.when(clubModes[key]); }
        if (clubLoads[key]) { return clubLoads[key]; }
        clubLoads[key] = ClubService.GetById(club_id).then(function(data) {
            delete clubLoads[key];
            var mode = (data && data.success !== false) ? normaliseClubMode(data) : DEFAULT_MODE;
            clubModes[key] = mode;
            notify();
            return mode;
        }, function() {
            delete clubLoads[key];
            return DEFAULT_MODE;
        });
        return clubLoads[key];
    }

    // Synchronous read for filters/directives: returns the cached club mode,
    // kicking off the load (and a later re-render) when it isn't known yet.
    function clubModeSync(club_id) {
        if (!club_id) { return null; }
        var key = String(club_id);
        if (clubModes[key]) { return clubModes[key]; }
        loadClubMode(club_id);
        return null;
    }

    function resolve(club_id, planeMode) {
        var v = getViewerOverride();
        if (v) { return v; }
        if (isValid(planeMode)) { return planeMode; }
        return clubModeSync(club_id) || DEFAULT_MODE;
    }

    // ── Live context for a page (headers, switcher) ────────────────────
    //   vm.td = TimeDisplayService.context(club_id);
    //   {{ vm.td.labels.from }} … <time-display-switch ctx="vm.td">
    function context(club_id, options) {
        var ctx = {
            club_id: club_id || null,
            window: (options && options.window) || null,   // pin the window (training records)
            planeMode: null,                                // aircraft override when the page is one aircraft
            mode: DEFAULT_MODE, def: def(DEFAULT_MODE), labels: LABELS.block,
            clubMode: DEFAULT_MODE, clubDef: def(DEFAULT_MODE),
            override: null,
            loaded: false,
            setClub: function(id) { ctx.club_id = id || null; ctx.loaded = false; refreshContext(ctx); },
            // Headers follow the aircraft override when every row on the page shares it
            // (journey log, flights list filtered to / containing one aircraft).
            setPlane: function(mode) { ctx.planeMode = isValid(mode) ? mode : null; refreshContext(ctx); },
            refresh: function() { refreshContext(ctx); }
        };
        contexts.push(ctx);
        refreshContext(ctx);
        return ctx;
    }

    function refreshContext(ctx) {
        var clubMode = ctx.club_id ? clubModeSync(ctx.club_id) : DEFAULT_MODE;
        ctx.loaded = !!clubMode || !ctx.club_id;
        ctx.clubMode = clubMode || DEFAULT_MODE;
        ctx.clubDef = def(ctx.clubMode);
        ctx.override = getViewerOverride();
        var effective = ctx.override || ctx.planeMode || ctx.clubMode;
        ctx.def = variant(effective, ctx.window);
        ctx.mode = ctx.def.value;
        ctx.labels = LABELS[ctx.def.window];
    }

    function notify() {
        for (var i = 0; i < contexts.length; i++) { refreshContext(contexts[i]); }
        $rootScope.$broadcast(EVENT);
    }

    // ── Time maths ─────────────────────────────────────────────────────

    function clean(v) {
        if (v && typeof v === 'object' && v.time !== undefined) { v = v.time; }   // book-in's {time:…} shape
        if (!v) { return null; }
        v = String(v);
        if (v === '00:00:00' || v === '00:00' || v === '0000-00-00 00:00:00') { return null; }
        var m = v.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!m) { return null; }
        return ('0' + m[1]).slice(-2) + ':' + m[2] + ':' + (m[3] || '00');
    }

    // Nearest-minute first, then nearest 5 (x.5 rounds up) — mirrors the backend's
    // *_rounded derivation so a client-side fallback can never disagree with it.
    function roundToFive(input) {
        var t = roundTimeToMinute(input);   // datetime.js global
        if (!t) { return t; }
        var m = String(t).match(/^(\d{1,2}):(\d{2})$/);
        if (!m) { return t; }
        var h = parseInt(m[1], 10);
        var min = parseInt(m[2], 10);
        var r = (min % 5) >= 2.5 ? Math.floor(min / 5) * 5 + 5 : Math.floor(min / 5) * 5;
        if (r === 60) { r = 0; h = (h + 1) % 24; }
        return ('0' + h).slice(-2) + ':' + ('0' + r).slice(-2);
    }

    function hm(mins) {
        if (mins === null || mins === undefined || isNaN(mins)) { return ''; }
        return Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2);
    }

    function decimalToMinutes(dec) {
        var h = parseFloat(dec);
        if (isNaN(h) || h <= 0) { return null; }
        return Math.round(h * 60);
    }

    function first(row, keys) {
        for (var i = 0; i < keys.length; i++) {
            var v = clean(row[keys[i]]);
            if (v) { return v; }
        }
        return null;
    }

    // Normalise one flight row → the four recorded times + backend-rounded values.
    function recorded(row) {
        return {
            brakes_off:   first(row, ['brakes_off']),
            brakes_on:    first(row, ['brakes_on']),
            takeoff_time: first(row, ['takeoff_time', 'takeoff', 'first_takeoff', 'first_takeoff_time']),
            landing_time: first(row, ['landing_time', 'landing', 'last_landing', 'last_landing_time']),
            brakes_off_rounded: first(row, ['brakes_off_rounded']),
            brakes_on_rounded:  first(row, ['brakes_on_rounded']),
            takeoff_rounded:    first(row, ['takeoff_rounded', 'first_takeoff_rounded']),
            landing_rounded:    first(row, ['landing_rounded', 'last_landing_rounded'])
        };
    }

    function recordedList(r) {
        var fields = [['brakes off', r.brakes_off], ['takeoff', r.takeoff_time], ['landing', r.landing_time], ['brakes on', r.brakes_on]];
        var out = [];
        for (var i = 0; i < fields.length; i++) {
            if (!fields[i][1]) { continue; }
            if (out.length && out[out.length - 1].time === fields[i][1]) {
                out[out.length - 1].label += ' & ' + fields[i][0];
            } else {
                out.push({ label: fields[i][0], time: fields[i][1] });
            }
        }
        var parts = [];
        for (var j = 0; j < out.length; j++) { parts.push(out[j].label + ' ' + out[j].time); }
        return parts.join(', ');
    }

    // Build the view-model for one row in one mode.
    //   { from, to, durationMins, durationHM, def, window, fallback, missing, tooltip }
    function pick(row, mode, opts) {
        opts = opts || {};
        var d = variant(mode, opts.window);
        var r = recorded(row || {});
        var out = { def: d, window: d.window, rounded: d.rounded, fallback: false, missing: false,
                    from: '—', to: '—', durationMins: null, durationHM: '', tooltip: d.title + ' · ' + d.sub };

        if (!row) { out.missing = true; return out; }

        var win = d.window;
        var rawFrom = (win === 'block') ? r.brakes_off : r.takeoff_time;
        var rawTo   = (win === 'block') ? r.brakes_on  : r.landing_time;

        // The requested window isn't recorded on this flight (e.g. a Fox entry with no
        // takeoff/landing, or a manually typed flight) — fall back to the other one
        // rather than showing dashes, and say so in the tooltip.
        if (!rawFrom && !rawTo) {
            var other = (win === 'block') ? 'airborne' : 'block';
            var oFrom = (other === 'block') ? r.brakes_off : r.takeoff_time;
            var oTo   = (other === 'block') ? r.brakes_on  : r.landing_time;
            if (oFrom || oTo) {
                out.fallback = true;
                win = other;
                rawFrom = oFrom; rawTo = oTo;
            }
        }
        out.window = win;

        if (!rawFrom && !rawTo) {
            out.missing = true;
            out.tooltip = 'No times recorded for this flight';
            return out;
        }

        var shownFrom, shownTo;
        if (d.rounded) {
            // Prefer the backend's nearest-5 values (they're what totals/invoices use);
            // derive the same way when an endpoint doesn't send them.
            var bFrom = (win === 'block') ? r.brakes_off_rounded : r.takeoff_rounded;
            var bTo   = (win === 'block') ? r.brakes_on_rounded  : r.landing_rounded;
            shownFrom = rawFrom ? (bFrom ? roundTimeToMinute(bFrom) : roundToFive(rawFrom)) : null;
            shownTo   = rawTo   ? (bTo   ? roundTimeToMinute(bTo)   : roundToFive(rawTo))   : null;
        } else {
            shownFrom = rawFrom ? roundTimeToMinute(rawFrom) : null;
            shownTo   = rawTo   ? roundTimeToMinute(rawTo)   : null;
        }
        out.from = shownFrom || '—';
        out.to   = shownTo   || '—';
        out.fromRaw = rawFrom;
        out.toRaw = rawTo;

        // Duration: the backend's rounded block figure when that's exactly what is on
        // screen (keeps parity with training-record totals), else the shown window.
        var mins = null;
        if (win === 'block' && d.rounded && !out.fallback) {
            mins = decimalToMinutes(row.brakes_times_rounded);
        }
        if (mins === null && shownFrom && shownTo) {
            mins = minutesBetween(shownFrom, shownTo);   // datetime.js global, wraps midnight
        }
        out.durationMins = mins;
        out.durationHM = (mins !== null) ? hm(mins) : '';

        // Tooltip: what convention is on screen + every recorded time, exact.
        var winDef = (win === d.window) ? d : variant(d.value, win);
        var lines = [winDef.title + ' · ' + winDef.sub.toLowerCase()];
        if (out.fallback) {
            lines[0] += ' (' + (d.window === 'block' ? 'brakes' : 'takeoff/landing') + ' times not recorded for this flight)';
        }
        var rec = recordedList(r);
        if (rec) { lines.push('Recorded: ' + rec); }
        out.tooltip = lines.join('. ');
        return out;
    }
}
