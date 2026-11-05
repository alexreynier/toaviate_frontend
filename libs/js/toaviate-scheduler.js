/*!
 * ToAviateScheduler — framework-agnostic scheduler (timeline + phone day list)
 * for the ToAviate flying-club app. Plain ES5, no dependencies.
 *
 * Contract: backend/FRONTEND_SCHEDULER_V2_GUIDE.md §3. Visual source of truth:
 * mockups/scheduler-redesign.html (chip layout "B · badge corner") and
 * mockups/scheduler-phone-day-view.html (card style "E · desktop match",
 * header style "B · big date").
 *
 * Usage: var s = ToAviateScheduler.create(el, options); s.setData(dayResponse);
 * Dates at the API boundary are strings: 'YYYY-MM-DD' and 'YYYY-MM-DD HH:MM:SS' (local time).
 *
 * 1.2.0 (2026-11-03): slot-aware waiting-list drops. An aircraft row honours `ac.can_wait === false`
 * (no drop zone, its waiting sub-row refuses drops); a move onto an aircraft row checks the proposed
 * range against that aircraft's non-waiting bookings — FREE → a normal move even inside the zone,
 * TAKEN + can_wait → an automatic waiting-list drop, TAKEN without it → `tas-ghost--blocked` and the
 * drop reverts without calling the host.
 *
 * 1.3.0 (2026-11-04): club opening hours. `settings.clubs[].opening_hours` ({"1"(Mon)…"7"(Sun): {open, close} | null =
 * closed all day; a missing weekday = not set; the whole value null = no hours configured}) shades the parts of each day
 * outside the row's club hours on the TIMELINE (`.tas__closed` segments per row per day, like `.tas__past`: absolute,
 * pointer-events none — drag / drop / chips are unaffected; a closed day = one whole-day `--day` segment and the row
 * label's tooltip says "Closed on Sundays"). Rows of clubs without hours get nothing; the legend gains "Outside opening
 * hours" only when a row's club has hours. The phone list shows no shading, only a "Club closed" line in the header on a
 * closed day. Purely informative — the host's booking rules decide what can be booked.
 */
(function (global) {
    'use strict';

    var VERSION = '1.3.0';
    var ROOT = 'tas';
    var STORAGE_KEY = 'tas.groups';
    var LIST_BREAKPOINT = 700;
    var ROW_H = 78;
    var WAIT_ROW_H = 40;
    var LONG_PRESS_MS = 250;
    var MOUSE_SLOP = 4;
    var TOUCH_SLOP = 8;
    var AUTOSCROLL_EDGE = 44;
    var AUTOSCROLL_SPEED = 14;
    var HIGHLIGHT_MS = 2600;
    var REVERT_MS = 260;
    var RESIZE_ZONE = 10;          // px at either end of a chip that act as resize handles
    var WZONE_H = 24;              // px: the "Waiting list" drop zone along the bottom of an aircraft row during a move drag

    // ───────────────────────────── icons (16px line icons, one per booking kind) ─────────────────────────────
    var SVG_OPEN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    var ICONS = {
        dual: SVG_OPEN + '<circle cx="5.5" cy="5" r="2.3"/><circle cx="11" cy="6" r="1.9"/><path d="M1.5 13.5c0-2.4 1.8-4 4-4s4 1.6 4 4M9.5 13.5c0-1.9 1-3.2 2.5-3.4 1.6 0 2.8 1.3 2.8 3.4"/></svg>',
        solo: SVG_OPEN + '<circle cx="8" cy="5" r="2.6"/><path d="M3 14c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6"/></svg>',
        hire: SVG_OPEN + '<circle cx="5.5" cy="10.5" r="3"/><path d="M7.8 8.2 13.5 2.5M11 5l2 2M12.5 3.5l1.5 1.5"/></svg>',
        trial: SVG_OPEN + '<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>',
        maint: SVG_OPEN + '<path d="M9.6 2.4a3.4 3.4 0 0 0 3.9 4.5l-6.2 6.2a1.6 1.6 0 0 1-2.3-2.3l6.2-6.2a3.4 3.4 0 0 0-1.6-2.2z"/></svg>'
    };
    var ICON_CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';
    var ICON_CALENDAR = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2.5" y="4" width="15" height="13.5" rx="2.5"/><path d="M2.5 8.5h15M6.5 2v4M13.5 2v4"/></svg>';
    var ICON_CALENDAR_SM = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/></svg>';
    var ICON_TODAY = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/></svg>';
    var KINDS = ['dual', 'solo', 'hire', 'trial', 'maint'];

    // ───────────────────────────── locale (every string the library renders) ─────────────────────────────
    var DEFAULT_LOCALE = {
        title: 'Scheduler',
        today: 'Today',
        prev: 'Previous',
        next: 'Next',
        day: 'Day',
        days3: '3 days',
        days7: '7 days',
        newBooking: '+ New booking',
        newBookingShort: 'New booking',
        pickDate: 'Pick a date',
        jumpToday: 'Jump to today',
        backToday: 'Back to today',
        instructors: 'Instructors',
        aircraft: 'Aircraft',
        workingToday: '{n} working today',
        hiddenHint: '{n} hidden by "Hide instructors not working today"',
        collapse: 'Collapse',
        expand: 'Expand',
        collapseTip: 'Collapse the {g} rows',
        expandTip: 'Show the {g} rows',
        hideChip: 'Hide instructors not working today',
        hideChipOnTip: 'Instructors with no availability today are hidden. Click to show everyone.',
        hideChipOffTip: 'Showing every instructor. Click to hide the ones not working today.',
        hiddenCount: '{n} hidden',
        waitingList: 'Waiting list',
        waitingListTip: 'Bookings waiting for this aircraft; they move up when a slot frees',
        waitingPill: '{n} waiting',
        waitingPillOne: '1 waiting',
        waitingDrop: 'Waiting list',
        waitingAuto: 'Waiting list · {reg}',
        slotTaken: 'Slot taken',
        waitingNotAllowed: 'Waiting list not allowed',
        moveTo: '→ {name}',
        outsideHours: 'Outside opening hours',
        outsideHoursTip: 'Shaded: the club is closed at these times. You can still book — just check with the club.',
        closedOn: 'Closed on {days}',
        closedDaysJoin: ' and ',
        clubClosed: 'Club closed',
        clubClosedNamed: '{name} closed',
        kinds: { dual: 'Dual lesson', solo: 'Solo', hire: 'Self-fly hire', trial: 'Trial flight', maint: 'Maintenance' },
        kindTips: {
            dual: 'A lesson with an instructor',
            solo: 'Student flying alone, authorised by an instructor',
            hire: 'A licensed pilot hiring the aircraft',
            trial: 'A trial flight or experience voucher',
            maint: 'Aircraft out of service'
        },
        pending: 'Awaiting confirmation',
        pendingTip: 'The instructor has not confirmed this booking yet',
        rowColours: 'Row colours',
        rowColoursTip: 'The stripe on each row is that instructor\'s or aircraft\'s own colour; it rides along on every chip',
        you: 'you',
        instructor: 'Instructor',
        instructorTip: 'Instructor: {name}',
        aircraftTip: '{reg} · {type} (the coloured edge is this aircraft)',
        notWorking: 'Not working today',
        noColour: '{name} · no colour set',
        theirColour: '{name} · their colour on the calendar',
        icaoTip: 'ICAO type {t}',
        navBadge: 'NAV',
        dualBadge: 'DUAL',
        navTip: 'Navigation-equipped: bookable for cross-country and nav exercises',
        dualTip: 'Dual controls only: must be flown with an instructor',
        byAircraft: 'By aircraft',
        byInstructor: 'By instructor',
        justMine: 'Just mine',
        free: 'Free',
        book: 'Book',
        nothingBooked: 'Nothing booked',
        bookingCount: '{n} bookings',
        bookingCountOne: '1 booking',
        soloHire: 'Solo & hire',
        noneMine: 'You have nothing booked on {date}. Tap a free gap on another day, or New booking.',
        loading: 'Loading…',
        withInstructor: 'with {name}',
        noInstructor: 'no instructor',
        onWaitingList: 'On the waiting list',
        locked: 'You can\'t move this booking',
        dragHint: 'Drag to move · drag the ends to change the time',
        createHint: 'Drag across the empty cells to make a booking',
        createHintIns: 'Drag across the empty cells to book this instructor',
        hourShort: 'h',
        minuteShort: 'min',
        weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        am: 'AM',
        pm: 'PM'
    };

    // ───────────────────────────── small utilities ─────────────────────────────
    function esc(s) {
        if (s === null || s === undefined) { return ''; }
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    // A colour that is safe to put inside a style="" attribute (hex, rgb(), hsl() or a CSS keyword).
    function safeColour(c, fallback) {
        if (typeof c !== 'string') { return fallback; }
        c = c.trim();
        if (/^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl)a?\([0-9.,%\s\/]+\)$/i.test(c) || /^[a-z]{3,20}$/i.test(c)) { return c; }
        return fallback;
    }
    function fmt(tpl, map) {
        return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return map && map[k] !== undefined ? map[k] : m; });
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function merge(base, over) {
        var out = {}, k;
        for (k in base) { if (base.hasOwnProperty(k)) { out[k] = base[k]; } }
        if (over) {
            for (k in over) {
                if (over.hasOwnProperty(k) && over[k] !== undefined) {
                    if (base[k] && typeof base[k] === 'object' && !isArray(base[k]) && over[k] && typeof over[k] === 'object' && !isArray(over[k])) {
                        out[k] = merge(base[k], over[k]);
                    } else { out[k] = over[k]; }
                }
            }
        }
        return out;
    }
    function isArray(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    function closest(el, sel) {
        while (el && el.nodeType === 1) {
            if (matches(el, sel)) { return el; }
            el = el.parentNode;
        }
        return null;
    }
    function matches(el, sel) {
        var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
        return fn ? fn.call(el, sel) : false;
    }
    function toArray(list) { return Array.prototype.slice.call(list || []); }
    function hasClass(el, c) { return el && el.classList && el.classList.contains(c); }

    // ── dates: strings at the boundary, native Date inside (local time) ──
    function parseDate(s) {           // 'YYYY-MM-DD' → Date at 00:00 local
        if (s instanceof Date) { return new Date(s.getFullYear(), s.getMonth(), s.getDate()); }
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
        if (!m) { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
        return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    function parseDateTime(s) {       // 'YYYY-MM-DD HH:MM:SS' (or 'YYYY-MM-DDTHH:MM') → Date local
        if (s instanceof Date) { return s; }
        var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ''));
        if (!m) { return parseDate(s); }
        return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
    }
    function fmtDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function fmtDateTime(d) { return fmtDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
    function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
    function dayDiff(a, b) {          // whole calendar days from a (00:00) to b's day
        var a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()), b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.round((b0 - a0) / 86400000);
    }
    function minutesOfDay(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
    function hhmmToMin(s, fallback) {
        var m = /^(\d{1,2}):(\d{2})/.exec(String(s || ''));
        return m ? (+m[1]) * 60 + (+m[2]) : fallback;
    }
    function hm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
    function hmFromMin(m) { m = Math.round(m); var h = Math.floor(m / 60) % 24; return pad2(h) + ':' + pad2(m % 60); }
    function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
    function durationLabel(mins, L) {
        var h = Math.floor(mins / 60), m = Math.round(mins % 60);
        if (!h) { return m + ' ' + L.minuteShort; }
        return h + ' ' + L.hourShort + (m ? ' ' + pad2(m) : '');
    }

    function loadGroups() {
        var g = { instructors: true, aircraft: true };
        try {
            var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
            if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') { if (p.instructors === false) { g.instructors = false; } if (p.aircraft === false) { g.aircraft = false; } } }
        } catch (e) { /* storage unavailable: defaults */ }
        return g;
    }
    function saveGroups(g) {
        try { global.localStorage && global.localStorage.setItem(STORAGE_KEY, JSON.stringify(g)); } catch (e) { /* ignore */ }
    }
    function reducedMotion() {
        try { return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    var supportsPassive = false;
    try {
        var optsTest = Object.defineProperty({}, 'passive', { get: function () { supportsPassive = true; return true; } });
        global.addEventListener('tas-test', null, optsTest); global.removeEventListener('tas-test', null, optsTest);
    } catch (e) { supportsPassive = false; }

    function initialsOf(name) {
        var parts = String(name || '').trim().split(/[\s\-]+/), out = '';
        for (var i = 0; i < parts.length && out.length < 3; i++) { if (parts[i]) { out += parts[i].charAt(0).toUpperCase(); } }
        return out || '?';
    }

    // ───────────────────────────── the scheduler ─────────────────────────────
    function Scheduler(el, opts) {
        if (!el || el.nodeType !== 1) { throw new Error('ToAviateScheduler.create: a host element is required'); }
        opts = opts || {};
        this.el = el;
        this.o = {
            days: [1, 3, 7].indexOf(+opts.days) > -1 ? +opts.days : 1,
            mode: opts.mode === 'timeline' || opts.mode === 'list' ? opts.mode : 'auto',
            dayStart: opts.dayStart || '07:00',
            dayEnd: opts.dayEnd || '22:00',
            slotMinutes: +opts.slotMinutes > 0 ? +opts.slotMinutes : 30,
            currentUserId: +opts.currentUserId || 0,
            canCreate: opts.canCreate !== false,
            isStaff: !!opts.isStaff,
            hourWidth: opts.hourWidth || { 1: 90, 3: 56, 7: 38 },
            getBusy: typeof opts.getBusy === 'function' ? opts.getBusy : null,
            stripPast: +opts.stripPastDays || 56,
            stripFuture: +opts.stripFutureDays || 182
        };
        this.L = merge(DEFAULT_LOCALE, opts.locale || {});
        this.on = opts.on || {};
        this.state = {
            date: fmtDate(parseDate(opts.date || new Date())),
            days: this.o.days,
            mode: this.o.mode === 'auto' ? null : this.o.mode,
            // the "Hide instructors not working today" switch: hideToggle.on wins, then the legacy showAllInstructors (inverted), else off
            hide: opts.hideToggle && typeof opts.hideToggle === 'object' ? !!opts.hideToggle.on : (opts.showAllInstructors !== undefined ? !opts.showAllInstructors : false)
        };
        this.data = null;
        this.now = opts.now ? parseDateTime(opts.now) : null;
        this.groups = loadGroups();
        this.list = { groupBy: 'aircraft', mine: false, collapsed: {} };
        this.index = null;
        this.drag = null;
        this.twins = [];
        this.highlightId = null;
        this.pendingRender = false;
        this.destroyed = false;
        this.scrolledToNow = false;
        this._bound = {};
        this.el.classList.add(ROOT);
        this.el.setAttribute('data-tas-version', VERSION);
        this._computeScale();
        this._bind();
        this._resolveMode();
        this._build();
        this.render();
    }

    // ── public API ──
    Scheduler.prototype.setData = function (resp) {
        this.data = resp || null;
        if (resp && resp.settings) {
            var st = resp.settings;
            if (st.day_start) { this.o.dayStart = st.day_start; }
            if (st.day_end) { this.o.dayEnd = st.day_end; }
            if (+st.slot_minutes > 0) { this.o.slotMinutes = +st.slot_minutes; }
            if (st.can_create !== undefined) { this.o.canCreate = !!st.can_create; }
            if (st.is_staff !== undefined) { this.o.isStaff = !!st.is_staff; }
            if (st.user_id) { this.o.currentUserId = +st.user_id; }
            // settings.show_all_instructors / hide_unavailable_instructors are NOT read: the hide switch is the host's (hideToggle / setHideToggle)
        }
        this._readHours(resp && resp.settings);
        if (resp && resp.date) { this.state.date = fmtDate(parseDate(resp.date)); }
        if (resp && [1, 3, 7].indexOf(+resp.days) > -1) { this.state.days = +resp.days; }
        if (resp && resp.now) { this.now = parseDateTime(resp.now); }
        this._computeScale();
        this._reindex();
        this.render();
        return this;
    };
    Scheduler.prototype.setDate = function (dateStr) { this.state.date = fmtDate(parseDate(dateStr)); this._computeScale(); this.render(); return this; };
    Scheduler.prototype.setDays = function (days) { if ([1, 3, 7].indexOf(+days) > -1) { this.state.days = +days; this._computeScale(); this.scrolledToNow = false; this._resetScroll(); this.render(); } return this; };
    Scheduler.prototype._resetScroll = function () { var sc = this.el.querySelector('.tas__scroll'); if (sc) { sc.scrollLeft = 0; } };
    Scheduler.prototype.setMode = function (mode) {
        this.o.mode = mode === 'timeline' || mode === 'list' ? mode : 'auto';
        this._resolveMode(true);
        return this;
    };
    Scheduler.prototype.setNow = function (nowStr) { this.now = nowStr ? parseDateTime(nowStr) : null; this.render(); return this; };
    Scheduler.prototype.setHideToggle = function (bool) { this.state.hide = !!bool; this.render(); return this; };
    Scheduler.prototype.setShowAll = function (bool) { return this.setHideToggle(!bool); };   // deprecated alias (inverted meaning)
    Scheduler.prototype.highlight = function (bookingId) {
        var self = this;
        this.highlightId = bookingId;
        if (this._hlTimer) { clearTimeout(this._hlTimer); }
        this._applyHighlight(true);
        this._hlTimer = setTimeout(function () { self.highlightId = null; self._applyHighlight(false); }, HIGHLIGHT_MS);
        return this;
    };
    // Scrolls the timeline so "now" sits about a third of the way in. Returns true when it could
    // actually measure the grid; false while the element has no layout yet (hidden tab, a route
    // transition still fading in, first render before the host is attached) so render() can retry.
    Scheduler.prototype.scrollToNow = function () {
        if (this.state.mode !== 'timeline' || !this.now) { return true; }
        var sc = this.el.querySelector('.tas__scroll'), row = this.el.querySelector('.tas-row');
        if (!sc || !row) { return false; }
        if (!sc.clientWidth || !row.offsetWidth) { return false; }
        var x = this._xMin(this.now);
        if (x <= 0 || x >= this.geo.total) { return true; }
        var px = row.offsetLeft + row.offsetWidth * (x / this.geo.total);
        var target = px - Math.max(200, sc.clientWidth * 0.33);
        sc.scrollLeft = Math.max(0, target);
        return true;
    };
    // First-render helper: scroll to now once per date/range, retrying on the next frames until the grid has a width.
    Scheduler.prototype._scrollToNowOnce = function () {
        var self = this;
        if (this.scrolledToNow || !this.now || this.state.mode !== 'timeline') { return; }
        if (dayDiff(this.geo.date0, this.now) < 0 || dayDiff(this.geo.date0, this.now) >= this.geo.days) { return; }
        if (this.scrollToNow()) { this.scrolledToNow = true; return; }
        if (this._nowRetry) { return; }
        var tries = 0;
        this._nowRetry = function tick() {
            if (self.destroyed || self.scrolledToNow) { self._nowRetry = null; return; }
            if (self.scrollToNow() || ++tries > 60) { self.scrolledToNow = self.scrolledToNow || tries <= 60; self._nowRetry = null; return; }
            (window.requestAnimationFrame || function (f) { setTimeout(f, 32); })(tick);
        };
        (window.requestAnimationFrame || function (f) { setTimeout(f, 32); })(this._nowRetry);
    };
    Scheduler.prototype.getState = function () { return { date: this.state.date, days: this.state.days, mode: this.state.mode }; };
    Scheduler.prototype.destroy = function () {
        this._cancelDrag();
        this._unbind();
        if (this._hlTimer) { clearTimeout(this._hlTimer); }
        this.el.innerHTML = '';
        this.el.classList.remove(ROOT, ROOT + '--timeline', ROOT + '--list', 'is-dragging', 'is-stale');
        this.el.removeAttribute('data-tas-version');
        this.destroyed = true;
    };

    // ── scale / geometry ──
    Scheduler.prototype._computeScale = function () {
        var ds = hhmmToMin(this.o.dayStart, 420), de = hhmmToMin(this.o.dayEnd, 1320);
        if (de <= ds) { de = ds + 60; }
        var days = this.state.days;
        this.geo = { date0: parseDate(this.state.date), days: days, dayStart: ds, dayEnd: de, dayLen: de - ds, total: days * (de - ds), slot: this.o.slotMinutes };
    };
    // minutes from the range origin in collapsed timeline coordinates (hours outside dayStart..dayEnd collapse)
    Scheduler.prototype._xMin = function (dt) {
        var g = this.geo, di = dayDiff(g.date0, dt);
        if (di < 0) { return 0; }
        if (di >= g.days) { return g.total; }
        return di * g.dayLen + clamp(minutesOfDay(dt) - g.dayStart, 0, g.dayLen);
    };
    Scheduler.prototype._minToDate = function (m) {
        var g = this.geo;
        m = clamp(m, 0, g.total);
        var di = Math.floor(m / g.dayLen);
        if (di >= g.days) { di = g.days - 1; }
        var mod = m - di * g.dayLen;
        var d = addDays(g.date0, di);
        d.setMinutes(g.dayStart + Math.round(mod));
        return d;
    };
    Scheduler.prototype._pct = function (m) { return (m / this.geo.total * 100).toFixed(4); };
    Scheduler.prototype._snap = function (m) { var s = this.geo.slot; return Math.round(m / s) * s; };

    // ── club opening hours (1.3.0) ──
    // settings.clubs[] → this.hours = { club_id: { '1'..'7': {open, close} | null } | null }, this.clubTitles = { club_id: title }
    Scheduler.prototype._readHours = function (st) {
        var hours = {}, titles = {}, clubs = st && isArray(st.clubs) ? st.clubs : [], i, c, k, h, v, out, any;
        for (i = 0; i < clubs.length; i++) {
            c = clubs[i] || {};
            if (!(+c.id > 0)) { continue; }
            titles[+c.id] = c.title || '';
            h = c.opening_hours; out = null; any = false;
            if (h && typeof h === 'object') {
                out = {};
                for (k = 1; k <= 7; k++) {
                    if (!h.hasOwnProperty(String(k))) { continue; }
                    v = h[String(k)];
                    if (v === null || v === false) { out[String(k)] = null; any = true; continue; }
                    if (!v || typeof v !== 'object') { continue; }
                    var o = hhmmToMin(v.open, null), cl = hhmmToMin(v.close, null);
                    if (o === null || cl === null) { continue; }
                    if (cl === 0) { cl = 1440; }                       // "00:00" close = midnight (end of day)
                    if (cl <= o) { continue; }
                    out[String(k)] = { open: o, close: cl, openStr: pad2(Math.floor(o / 60)) + ':' + pad2(o % 60), closeStr: pad2(Math.floor(cl / 60) % 24) + ':' + pad2(cl % 60) };
                    any = true;
                }
            }
            hours[+c.id] = any ? out : null;
        }
        this.hours = hours;
        this.clubTitles = titles;
    };
    Scheduler.prototype._hoursFor = function (clubId) { return (this.hours && +clubId > 0 && this.hours[+clubId]) ? this.hours[+clubId] : null; };
    // the hours entry for a club on a date: undefined = not set / no hours, null = closed all day, {open, close} in minutes
    Scheduler.prototype._hoursOn = function (clubId, date) {
        var h = this._hoursFor(clubId);
        if (!h) { return undefined; }
        var key = String(((date.getDay() + 6) % 7) + 1);
        return h.hasOwnProperty(key) ? h[key] : undefined;
    };
    // does any row in the current data belong to a club with hours? (legend only when it means something)
    Scheduler.prototype._anyHours = function () {
        var d = this.data, res = d && d.resources || {}, lists = [res.instructors || [], res.aircraft || []], i, j;
        for (i = 0; i < lists.length; i++) { for (j = 0; j < lists[i].length; j++) { if (this._hoursFor(lists[i][j].club_id)) { return true; } } }
        return false;
    };
    // the shaded "outside opening hours" segments of one row (every day of the range), '' when the club has no hours
    Scheduler.prototype._closedHtml = function (clubId) {
        if (!this._hoursFor(clubId)) { return ''; }
        var g = this.geo, html = '', di, e, a, b;
        for (di = 0; di < g.days; di++) {
            e = this._hoursOn(clubId, addDays(g.date0, di));
            if (e === undefined) { continue; }
            if (e === null) { html += '<div class="tas__closed tas__closed--day" style="left:' + this._pct(di * g.dayLen) + '%;width:' + this._pct(g.dayLen) + '%"></div>'; continue; }
            a = clamp(e.open - g.dayStart, 0, g.dayLen);              // before the club opens
            if (a > 0) { html += '<div class="tas__closed" style="left:' + this._pct(di * g.dayLen) + '%;width:' + this._pct(a) + '%"></div>'; }
            b = clamp(e.close - g.dayStart, 0, g.dayLen);             // after it closes
            if (b < g.dayLen) { html += '<div class="tas__closed" style="left:' + this._pct(di * g.dayLen + b) + '%;width:' + this._pct(g.dayLen - b) + '%"></div>'; }
        }
        return html;
    };
    // "Closed on Sundays" / "Closed on Saturdays and Sundays" for the closed days of the range, '' when none
    Scheduler.prototype._closedTip = function (clubId) {
        if (!this._hoursFor(clubId)) { return ''; }
        var L = this.L, g = this.geo, names = [], seen = {}, di, d;
        for (di = 0; di < g.days; di++) {
            d = addDays(g.date0, di);
            if (this._hoursOn(clubId, d) === null && !seen[d.getDay()]) { seen[d.getDay()] = true; names.push(L.weekdays[d.getDay()] + 's'); }
        }
        if (!names.length) { return ''; }
        var days = names.length > 1 ? names.slice(0, -1).join(', ') + L.closedDaysJoin + names[names.length - 1] : names[0];
        return fmt(L.closedOn, { days: days });
    };

    // ── data index ──
    Scheduler.prototype._reindex = function () {
        var d = this.data, idx = { byId: {}, byIns: {}, byPlane: {}, byWait: {}, ins: {}, planes: {}, list: [] };
        if (d) {
            var res = d.resources || {}, i, b;
            var ins = res.instructors || [], ac = res.aircraft || [];
            for (i = 0; i < ins.length; i++) { idx.ins[ins[i].id] = ins[i]; }
            for (i = 0; i < ac.length; i++) { idx.planes[ac[i].id] = ac[i]; }
            var bks = d.bookings || [];
            for (i = 0; i < bks.length; i++) {
                b = bks[i];
                if (!b || b.id === undefined) { continue; }
                b._s = parseDateTime(b.start); b._e = parseDateTime(b.end);
                if (!(b._e > b._s)) { b._e = new Date(b._s.getTime() + this.geo.slot * 60000); }
                idx.byId[b.id] = b; idx.list.push(b);
                if (+b.waiting_list > 0) { (idx.byWait[b.plane_id] = idx.byWait[b.plane_id] || []).push(b); }
                else { (idx.byPlane[b.plane_id] = idx.byPlane[b.plane_id] || []).push(b); }
                if (+b.instructor_id > 0) { (idx.byIns[b.instructor_id] = idx.byIns[b.instructor_id] || []).push(b); }
            }
            var byStart = function (a, c) { return a._s - c._s || a._e - c._e; };
            var k;
            for (k in idx.byPlane) { if (idx.byPlane.hasOwnProperty(k)) { idx.byPlane[k].sort(byStart); } }
            for (k in idx.byWait) { if (idx.byWait.hasOwnProperty(k)) { idx.byWait[k].sort(byStart); } }
            for (k in idx.byIns) { if (idx.byIns.hasOwnProperty(k)) { idx.byIns[k].sort(byStart); } }
            idx.list.sort(byStart);
        }
        this.index = idx;
    };
    Scheduler.prototype._isStale = function () {
        if (!this.data) { return true; }
        var from = parseDate(this.data.from || this.data.date), days = +this.data.days || 1;
        var d0 = parseDate(this.state.date);
        if (this.state.mode === 'list') { var di = dayDiff(from, d0); return di < 0 || di >= days; }
        return fmtDate(from) !== this.state.date || days !== this.state.days;
    };
    Scheduler.prototype._isMine = function (b) {
        return !!b.mine || (this.o.currentUserId && b.pilot && +b.pilot.id === this.o.currentUserId);
    };

    // ── mode ──
    Scheduler.prototype._resolveMode = function (rebuild) {
        var want = this.o.mode === 'auto' ? (this.el.clientWidth > 0 && this.el.clientWidth < LIST_BREAKPOINT ? 'list' : 'timeline') : this.o.mode;
        if (want !== this.state.mode) {
            this.state.mode = want;
            this._cancelDrag();
            if (rebuild !== false && this._built) { this._build(); this.render(); }
        } else if (rebuild === true) { this.render(); }
    };

    // ── skeleton: sections whose innerHTML is replaced on render ──
    Scheduler.prototype._build = function () {
        var html;
        this.el.classList.remove(ROOT + '--timeline', ROOT + '--list');
        this.el.classList.add(ROOT + '--' + this.state.mode);
        if (this.state.mode === 'timeline') {
            html = '<div class="tas__toolbar"></div><div class="tas__subbar"></div><div class="tas__scroll"><div class="tas__grid" role="grid"></div></div>';
        } else {
            html = '<div class="tas-ph__hdr"></div><div class="tas-ph__tools"></div><div class="tas-ph__lgd"></div><div class="tas-ph__list"></div><div class="tas-ph__fabwrap"></div>';
        }
        html += '<div class="tas__tip" role="tooltip" hidden></div>';
        this.el.innerHTML = html;
        this._built = true;
        this.scrolledToNow = false;
    };

    Scheduler.prototype.render = function () {
        if (this.destroyed) { return; }
        if (this.drag && this.drag.started) { this.pendingRender = true; return; }
        this.el.classList.toggle('is-stale', this._isStale());
        if (this.state.mode === 'timeline') {
            this._renderToolbar(); this._renderSubbar(); this._renderGrid();
            this._scrollToNowOnce();
        } else {
            this._renderPhoneHeader(); this._renderPhoneTools(); this._renderPhoneLegend(); this._renderPhoneList(); this._renderFab();
        }
        this._applyHighlight(!!this.highlightId);
    };

    // ───────────────────────────── timeline: toolbar + sub-bar ─────────────────────────────
    Scheduler.prototype._dateTitle = function () {
        var L = this.L, d0 = this.geo.date0, n = this.geo.days;
        if (n === 1) { return L.weekdays[d0.getDay()] + ' ' + d0.getDate() + ' ' + L.months[d0.getMonth()] + ' ' + d0.getFullYear(); }
        var d1 = addDays(d0, n - 1);
        if (d0.getMonth() === d1.getMonth()) { return d0.getDate() + ' – ' + d1.getDate() + ' ' + L.months[d0.getMonth()] + ' ' + d1.getFullYear(); }
        return d0.getDate() + ' ' + L.monthsShort[d0.getMonth()] + ' – ' + d1.getDate() + ' ' + L.monthsShort[d1.getMonth()] + ' ' + d1.getFullYear();
    };
    Scheduler.prototype._renderToolbar = function () {
        var L = this.L, n = this.state.days;
        var html = '<div class="tas__tb-left">' +
            '<button type="button" class="tas-btn" data-act="today">' + esc(L.today) + '</button>' +
            '<button type="button" class="tas-btn tas-btn--icon" data-act="prev" aria-label="' + esc(L.prev) + '" data-tip="' + esc(L.prev) + '">‹</button>' +
            '<button type="button" class="tas-btn tas-btn--icon" data-act="next" aria-label="' + esc(L.next) + '" data-tip="' + esc(L.next) + '">›</button></div>' +
            '<button type="button" class="tas__date-btn" data-act="pick" aria-haspopup="dialog" data-tip="' + esc(L.pickDate) + '">' + ICON_CALENDAR + '<span class="tas__date-text">' + esc(this._dateTitle()) + '</span><span class="tas__caret">▾</span></button>' +
            '<div class="tas__tb-right"><div class="tas__views" role="group">' +
            '<button type="button" data-act="days" data-days="1" class="' + (n === 1 ? 'is-on' : '') + '">' + esc(L.day) + '</button>' +
            '<button type="button" data-act="days" data-days="3" class="' + (n === 3 ? 'is-on' : '') + '">' + esc(L.days3) + '</button>' +
            '<button type="button" data-act="days" data-days="7" class="' + (n === 7 ? 'is-on' : '') + '">' + esc(L.days7) + '</button></div>' +
            (this.o.canCreate ? '<button type="button" class="tas-btn tas-btn--primary" data-act="new">' + esc(L.newBooking) + '</button>' : '') +
            '</div><div class="tas__progress" aria-hidden="true"></div>';
        this.el.querySelector('.tas__toolbar').innerHTML = html;
    };
    Scheduler.prototype._legendHtml = function (cls) {
        var L = this.L, html = '', i, k;
        for (i = 0; i < KINDS.length; i++) {
            k = KINDS[i];
            html += '<span data-tip="' + esc(L.kindTips[k]) + '"><span class="tas-ico tas-ico--' + k + '">' + ICONS[k] + '</span>' + esc(L.kinds[k]) + '</span>';
        }
        html += '<span data-tip="' + esc(L.pendingTip) + '"><i class="tas-lg tas-lg--pending"></i>' + esc(L.pending) + '</span>';
        if (cls !== 'phone') { html += '<span data-tip="' + esc(L.rowColoursTip) + '"><i class="tas-lg tas-lg--rowcolour"></i>' + esc(L.rowColours) + '</span>'; }
        // "Outside opening hours" only on the timeline (the list shades nothing) and only when a row's club has hours
        if (cls !== 'phone' && this._anyHours()) { html += '<span data-tip="' + esc(L.outsideHoursTip) + '"><i class="tas-lg tas-lg--closed"></i>' + esc(L.outsideHours) + '</span>'; }
        return html;
    };
    Scheduler.prototype._renderSubbar = function () {
        this.el.querySelector('.tas__subbar').innerHTML = '<div class="tas__legend">' + this._legendHtml() + '</div>' + this._hideToggleHtml();
    };
    // The "Hide instructors not working today" switch — always rendered (timeline sub-bar + phone tools). The host decides
    // what the data contains; the lib shows the switch state it was given plus "· N hidden" from instructor_filter.hidden.
    Scheduler.prototype._hideToggleHtml = function () {
        var L = this.L, d = this.data, hiding = !!this.state.hide, hidden = this._hiddenCount();
        return '<button type="button" class="tas__chip-toggle' + (hiding ? ' is-on' : '') + '" data-act="hidetoggle" role="switch" aria-checked="' + hiding + '" data-tip="' + esc(hiding ? L.hideChipOnTip : L.hideChipOffTip) + '">' +
            '<span class="tas__sw" aria-hidden="true"></span><span class="tas__chip-txt">' + esc(L.hideChip) + '</span>' + (hiding && hidden ? ' <span class="tas__chip-n">· ' + esc(fmt(L.hiddenCount, { n: hidden })) + '</span>' : '') + '</button>';
    };
    Scheduler.prototype._hiddenCount = function () {
        var d = this.data;
        return d && d.instructor_filter && +d.instructor_filter.hidden > 0 ? +d.instructor_filter.hidden : 0;
    };

    // ───────────────────────────── timeline: grid ─────────────────────────────
    Scheduler.prototype._renderGrid = function () {
        var L = this.L, g = this.geo, d = this.data, idx = this.index || { byId: {}, byIns: {}, byPlane: {}, byWait: {} };
        var res = d && d.resources || {}, ins = res.instructors || [], ac = res.aircraft || [];
        var hours = g.dayLen / 60, hourW = this.o.hourWidth[g.days] || 60;
        var timeMin = Math.round(g.total / 60 * hourW);
        var grid = this.el.querySelector('.tas__grid');
        // the time column is minmax(timeMin, 1fr): its real width decides which chip layout fits
        var scroller = this.el.querySelector('.tas__scroll'), corner = grid.querySelector('.tas__corner');
        var labelW = corner ? corner.offsetWidth : 290, timeW = Math.max(timeMin, (scroller ? scroller.clientWidth : 0) - labelW);
        this._pxPerMin = timeW / g.total;
        grid.style.setProperty('--tas-time-min', timeMin + 'px');
        grid.style.setProperty('--tas-cols', String(Math.round(g.total / 60)));
        grid.style.setProperty('--tas-days', String(g.days));
        var multi = g.days > 1;
        grid.classList.toggle('tas__grid--multi', multi);
        grid.classList.toggle('tas__grid--collapsed-ins', !this.groups.instructors);
        grid.classList.toggle('tas__grid--collapsed-ac', !this.groups.aircraft);

        // axis
        var html = '<div class="tas__corner"></div><div class="tas__axis' + (multi ? ' tas__axis--multi' : '') + '">';
        var labelEvery = hourW >= 70 ? 1 : (hourW >= 46 ? 2 : 3);
        var dayI, h, startH = Math.floor(g.dayStart / 60), endH = Math.ceil(g.dayEnd / 60);
        if (multi) {
            html += '<div class="tas__axis-days">';
            for (dayI = 0; dayI < g.days; dayI++) {
                var dd = addDays(g.date0, dayI), isTodayD = this.now && sameDay(dd, this.now);
                html += '<span class="tas__axis-day' + (isTodayD ? ' is-today' : '') + '"><span class="tas__axis-daytxt">' + esc(L.weekdaysShort[dd.getDay()] + ' ' + dd.getDate() + ' ' + L.monthsShort[dd.getMonth()]) + '</span></span>';
            }
            html += '</div>';
        }
        html += '<div class="tas__axis-hours">';
        for (dayI = 0; dayI < g.days; dayI++) {
            for (h = startH; h < endH; h++) {
                var show = ((h - startH) % labelEvery) === 0;
                html += '<span' + ((h === startH && dayI > 0) ? ' class="tas__axis-h is-dayedge"' : ' class="tas__axis-h"') + '>' + (show ? esc(this._axisLabel(h)) : '') + '</span>';
            }
        }
        html += '</div></div>';

        // now + past (same markup in every row)
        var nowHtml = '';
        if (this.now) {
            var xn = this._xMin(this.now), dn = dayDiff(g.date0, this.now);
            if (dn >= 0 && dn < g.days) {
                var pn = this._pct(xn);
                nowHtml = '<div class="tas__past" style="width:' + pn + '%"></div>' + (minutesOfDay(this.now) >= g.dayStart && minutesOfDay(this.now) <= g.dayEnd ? '<div class="tas__now" style="left:' + pn + '%"></div>' : '');
            } else if (dn >= g.days) { nowHtml = '<div class="tas__past" style="width:100%"></div>'; }
        }
        this._nowHtml = nowHtml;

        // instructors
        var working = 0, i;
        for (i = 0; i < ins.length; i++) { if (ins[i].working !== false && ins[i].working !== 0) { working++; } }
        var hidden = this.state.hide ? this._hiddenCount() : 0;
        html += this._groupHead('instructors', L.instructors, fmt(L.workingToday, { n: working }), hidden ? fmt(L.hiddenHint, { n: hidden }) : '', this.groups.instructors);
        for (i = 0; i < ins.length; i++) { html += this._insRow(ins[i], idx.byIns[ins[i].id] || []); }
        if (!ins.length) { html += '<div class="tas__empty-row tas__row-ins">' + esc(d ? L.nothingBooked : L.loading) + '</div>'; }

        // aircraft
        html += this._groupHead('aircraft', L.aircraft, '· ' + ac.length, '', this.groups.aircraft);
        for (i = 0; i < ac.length; i++) {
            // the waiting-list sub-row is drawn ONLY when something is on it (waiting bookings in range, or the backend's waiting_count)
            var waiting = idx.byWait[ac[i].id] || [], waitN = Math.max(waiting.length, +ac[i].waiting_count > 0 ? +ac[i].waiting_count : 0);
            html += this._acRow(ac[i], idx.byPlane[ac[i].id] || [], waitN);
            if (waitN > 0) { html += this._waitRow(ac[i], waiting); }
        }
        if (!ac.length) { html += '<div class="tas__empty-row tas__row-ac">' + esc(d ? L.nothingBooked : L.loading) + '</div>'; }
        grid.innerHTML = html;
    };
    Scheduler.prototype._axisLabel = function (h) {
        var L = this.L, h12 = h % 12 === 0 ? 12 : h % 12;
        return h12 + (h % 24 >= 12 ? L.pm : L.am);
    };
    Scheduler.prototype._groupHead = function (key, title, count, hint, open) {
        var L = this.L, gname = key === 'instructors' ? L.instructors.toLowerCase() : L.aircraft.toLowerCase();
        // the header spans the whole (possibly 4000px-wide) grid, so its content sits in a sticky inner span
        return '<div class="tas__ghead' + (open ? '' : ' is-closed') + '" data-group="' + key + '" role="button" tabindex="0" aria-expanded="' + open + '" data-tip="' + esc(fmt(open ? L.collapseTip : L.expandTip, { g: gname })) + '">' +
            '<span class="tas__gsticky"><span class="tas__chev">' + ICON_CHEVRON + '</span><span class="tas__gtitle">' + esc(title) + '</span>' +
            (count ? '<span class="tas__gcount">' + esc(count.charAt(0) === '·' ? count : '· ' + count) + '</span>' : '') +
            '<span class="tas__gact">' + esc(open ? L.collapse : L.expand) + '</span></span>' +
            (hint ? '<span class="tas__ghint">' + esc(hint) + '</span>' : '') + '</div>';
    };
    Scheduler.prototype._insRow = function (ins, bookings) {
        var L = this.L, col = safeColour(ins.colour, ''), working = ins.working !== false && ins.working !== 0;
        var code = ins.code || initialsOf(ins.name);
        var closedTip = this._closedTip(ins.club_id);
        var label = '<div class="tas__label tas__row-ins' + (working ? '' : ' is-off') + '"' + (col ? ' style="--tas-ic:' + col + '"' : '') + ' data-res="i:' + esc(ins.id) + '"' + (closedTip ? ' data-tip="' + esc(closedTip) + '"' : '') + '>' +
            '<span class="tas-av' + (col ? '' : ' tas-av--plain') + '" data-tip="' + esc(fmt(col ? L.theirColour : L.noColour, { name: ins.name })) + '">' + esc(code) + '</span>' +
            '<span class="tas__nm">' + esc(ins.name) + '<span class="tas__sub">' + esc(working ? L.instructor : L.notWorking) + '</span></span></div>';
        // drag-select is allowed on every instructor row (not-working ones too — the host decides what to do with the draft)
        return label + '<div class="tas-row tas-row--ins tas__row-ins' + (this.o.canCreate ? ' can-create' : '') + '" data-res="i:' + esc(ins.id) + '" data-kind="i" data-id-res="' + esc(ins.id) + '"' + (this.o.canCreate ? ' data-tip="' + esc(L.createHintIns) + '"' : '') + '>' + this._nowHtml + this._closedHtml(ins.club_id) + this._chips(bookings, 'ins', false) + '</div>';
    };
    Scheduler.prototype._acRow = function (ac, bookings, waitN) {
        var L = this.L, col = safeColour(ac.colour, '');
        var badges = '';
        if (+ac.nav_only) { badges += '<span class="tas__ac-badge tas__ac-badge--nav" data-tip="' + esc(L.navTip) + '">' + esc(L.navBadge) + '</span>'; }
        if (+ac.dual_only) { badges += '<span class="tas__ac-badge tas__ac-badge--dual" data-tip="' + esc(L.dualTip) + '">' + esc(L.dualBadge) + '</span>'; }
        var pill = waitN > 0 ? '<span class="tas__wait-pill" data-tip="' + esc(L.waitingListTip) + '">' + esc(waitN === 1 ? L.waitingPillOne : fmt(L.waitingPill, { n: waitN })) + '</span>' : '';
        var closedTip = this._closedTip(ac.club_id);     // "Closed on Sundays" when a day of the range is closed at this aircraft's club
        var label = '<div class="tas__label tas__row-ac"' + (col ? ' style="--tas-ic:' + col + '"' : '') + ' data-res="a:' + esc(ac.id) + '"' + (closedTip ? ' data-tip="' + esc(closedTip) + '"' : '') + '>' +
            '<span class="tas__nm">' + esc(ac.reg) + (ac.model ? '<span class="tas__sub">' + esc(ac.model) + '</span>' : '') + '</span>' +
            '<span class="tas__right">' + pill + badges + (ac.type ? '<span class="tas__ac-tag" data-tip="' + esc(fmt(L.icaoTip, { t: ac.type })) + '">' + esc(ac.type) + '</span>' : '') + '</span></div>';
        // has-wzone: no visible sub-row, so a move drag gets a slim "Waiting list" drop zone along the row's bottom (CSS ::after, drag only).
        // `can_wait === false` (this viewer may not double book on this aircraft) → no zone at all.
        var canWait = ac.can_wait !== false;
        return label + '<div class="tas-row tas-row--ac tas__row-ac' + (this.o.canCreate ? ' can-create' : '') + (waitN > 0 || !canWait ? '' : ' has-wzone') + (canWait ? '' : ' no-wait') + '" data-res="a:' + esc(ac.id) + '" data-kind="a" data-id-res="' + esc(ac.id) + '" data-wlabel="' + esc(L.waitingDrop) + '"' + (this.o.canCreate ? ' data-tip="' + esc(L.createHint) + '"' : '') + '>' + this._nowHtml + this._closedHtml(ac.club_id) + this._chips(bookings, 'ac', false) + '</div>';
    };
    Scheduler.prototype._waitRow = function (ac, bookings) {
        var L = this.L, col = safeColour(ac.colour, '');
        var label = '<div class="tas__label tas__label--wait tas__row-ac"' + (col ? ' style="--tas-ic:' + col + '"' : '') + ' data-res="w:' + esc(ac.id) + '"><span class="tas__nm tas__nm--wait" data-tip="' + esc(L.waitingListTip) + '">' + esc(L.waitingList) + '</span></div>';
        // no-wait: the sub-row still shows what is waiting, but a move drag onto it is refused (see _updateDrag)
        return label + '<div class="tas-row tas-row--wait tas__row-ac' + (ac.can_wait === false ? ' no-wait' : '') + '" data-res="w:' + esc(ac.id) + '" data-kind="w" data-id-res="' + esc(ac.id) + '">' + this._nowHtml + this._closedHtml(ac.club_id) + this._chips(bookings, 'ac', true) + '</div>';
    };

    // lane packing for overlapping chips on one row
    function assignLanes(list) {
        var lanes = [], out = [], i, j, placed;
        for (i = 0; i < list.length; i++) {
            placed = -1;
            for (j = 0; j < lanes.length; j++) { if (lanes[j] <= list[i]._s) { lanes[j] = list[i]._e; placed = j; break; } }
            if (placed < 0) { lanes.push(list[i]._e); placed = lanes.length - 1; }
            out.push(placed);
        }
        return { lanes: out, count: lanes.length };
    }
    Scheduler.prototype._chips = function (bookings, rowKind, compact) {
        if (!bookings.length) { return ''; }
        var html = '', lanes = assignLanes(bookings), i;
        var rowH = compact ? WAIT_ROW_H : ROW_H, pad = compact ? 5 : 7, inner = rowH - pad * 2;
        for (i = 0; i < bookings.length; i++) {
            var laneStyle = '';
            if (lanes.count > 1) {
                var hgt = inner / lanes.count;
                laneStyle = 'top:' + (pad + lanes.lanes[i] * hgt).toFixed(1) + 'px;height:' + (hgt - 3).toFixed(1) + 'px;';
            }
            html += this._chip(bookings[i], rowKind, compact || lanes.count > 1, laneStyle);
        }
        return html;
    };
    Scheduler.prototype._kindOf = function (b) { return KINDS.indexOf(b.kind) > -1 ? b.kind : (+b.instructor_id > 0 ? 'dual' : 'hire'); };
    Scheduler.prototype._chipName = function (b, kind) {
        if (kind === 'maint') { return b.notes || b.lesson || this.L.kinds.maint; }
        return b.pilot && b.pilot.name ? b.pilot.name : '';
    };
    Scheduler.prototype._chipTip = function (b, kind) {
        var L = this.L, parts = [L.kinds[kind]], ac = this.index.planes[b.plane_id], ins = this.index.ins[b.instructor_id];
        var name = this._chipName(b, kind);
        if (name && kind !== 'maint') { parts.push(name); }
        parts.push(hm(b._s) + ' – ' + hm(b._e) + ' · ' + durationLabel((b._e - b._s) / 60000, L));
        if (ac) { parts.push(ac.reg + (ac.type ? ' ' + ac.type : '')); }
        if (ins) { parts.push(fmt(L.withInstructor, { name: ins.name })); } else if (kind !== 'maint') { parts.push(L.noInstructor); }
        if (b.lesson) { parts.push(b.lesson); }
        if (kind === 'maint' && b.notes) { parts.push(b.notes); }
        if (b.status === 'pending') { parts.push(L.pending); }
        if (+b.waiting_list > 0) { parts.push(L.onWaitingList); }
        if (b.editable === false) { parts.push(L.locked); }
        return parts.join(' · ');
    };
    Scheduler.prototype._chip = function (b, rowKind, thin, laneStyle) {
        var L = this.L, kind = this._kindOf(b);
        var l = this._xMin(b._s), r = this._xMin(b._e);
        if (r <= l) { return ''; }
        var ac = this.index.planes[b.plane_id], ins = this.index.ins[b.instructor_id];
        var acCol = ac ? safeColour(ac.colour, '') : '';
        var done = this.now && b._e <= this.now, mine = this._isMine(b), pending = b.status === 'pending', locked = b.editable === false;
        var px = (r - l) * (this._pxPerMin || 1), fit = px < 44 ? ' tas-chip--dot' : (px < 80 ? ' tas-chip--tiny' : (px < 150 ? ' tas-chip--narrow' : ''));
        var cls = 'tas-chip tas-chip--' + kind + fit + (pending ? ' is-pending' : '') + (mine ? ' is-mine' : '') + (done ? ' is-done' : '') + (locked ? ' is-locked' : '') + (thin ? ' tas-chip--thin' : '') + (b.complete ? ' is-complete' : '') + (b.booked_out ? ' is-out' : '');
        var badge = '';
        if (kind !== 'maint') {
            if (rowKind === 'ins') {
                if (ac) { badge = '<span class="tas-chip__badge tas-chip__badge--quiet" data-tip="' + esc(fmt(L.aircraftTip, { reg: ac.reg, type: ac.type || '' })) + '">' + esc(ac.reg) + '</span>'; }
            } else if (ins) {
                var ic = safeColour(ins.colour, '');
                badge = '<span class="tas-chip__badge"' + (ic ? ' style="--tas-c:' + ic + '"' : '') + ' data-tip="' + esc(fmt(L.instructorTip, { name: ins.name })) + '"><b class="tas-av tas-av--sm">' + esc(ins.code || initialsOf(ins.name)) + '</b></span>';
            }
        }
        var name = this._chipName(b, kind);
        var style = 'left:' + this._pct(l) + '%;width:calc(' + this._pct(r - l) + '% - 3px);' + laneStyle + (acCol ? '--tas-ac:' + acCol + ';' : '');
        // glyphs are CSS masks (see .tas-chip__ico in the stylesheet) so 800 chips don't carry 800 inline SVGs
        return '<button type="button" class="' + cls + '" style="' + style + '" data-id="' + esc(b.id) + '" data-tip="' + esc(this._chipTip(b, kind)) + '">' +
            '<span class="tas-chip__ico" data-tip="' + esc(L.kinds[kind] + (pending ? ' · ' + L.pending : '')) + '"></span>' +
            '<span class="tas-chip__nm">' + esc(name) + (mine ? '<span class="tas-chip__you">' + esc(L.you) + '</span>' : '') + '</span>' +
            '<span class="tas-chip__tm">' + hm(b._s) + ' – ' + hm(b._e) + '</span>' + badge +
            '</button>';
    };

    // ───────────────────────────── phone list ─────────────────────────────
    Scheduler.prototype._renderPhoneHeader = function () {
        var L = this.L, d0 = parseDate(this.state.date), isToday = this.now ? sameDay(d0, this.now) : sameDay(d0, new Date());
        var html = '<div class="tas-ph__top"><div class="tas-ph__title">' + esc(L.title) + '</div><div class="tas-ph__icons">' +
            '<button type="button" class="tas-ph__icon-btn" data-act="pick" aria-label="' + esc(L.pickDate) + '">' + ICON_CALENDAR_SM + '</button>' +
            '<button type="button" class="tas-ph__icon-btn" data-act="today" aria-label="' + esc(L.jumpToday) + '">' + ICON_TODAY + '</button></div></div>' +
            '<div class="tas-ph__nav"><button type="button" class="tas-ph__date" data-act="pick" aria-label="' + esc(L.pickDate) + '">' +
            '<span class="tas-ph__big">' + esc(L.weekdays[d0.getDay()] + ' ' + d0.getDate()) + '</span>' +
            '<span class="tas-ph__month">' + esc(L.months[d0.getMonth()] + ' ' + d0.getFullYear()) + '</span></button></div>' +
            '<div class="tas-ph__strip" role="tablist" aria-label="' + esc(L.pickDate) + '">' + this._stripHtml(d0) + '</div>' +
            (isToday ? '' : '<button type="button" class="tas-ph__back-today" data-act="today">' + esc(L.backToday) + '</button>') +
            this._phoneClosedHtml(d0) +
            '<div class="tas__progress" aria-hidden="true"></div>';
        this.el.querySelector('.tas-ph__hdr').innerHTML = html;
        this._scrollStrip(false);
    };
    // "Club closed" on the phone header when the viewed day is a closed day at a club with rows on the page
    // (one club in the data → "Club closed"; several → each closed club by name)
    Scheduler.prototype._phoneClosedHtml = function (d0) {
        var L = this.L, d = this.data, res = d && d.resources || {}, lists = [res.instructors || [], res.aircraft || []], clubs = {}, closed = [], i, j, cid, n = 0;
        for (i = 0; i < lists.length; i++) { for (j = 0; j < lists[i].length; j++) { cid = +lists[i][j].club_id; if (cid > 0 && !clubs[cid]) { clubs[cid] = true; n++; if (this._hoursOn(cid, d0) === null) { closed.push(cid); } } } }
        if (!closed.length) { return ''; }
        var self = this;
        var txt = n === 1 ? L.clubClosed : closed.map(function (c) { return fmt(L.clubClosedNamed, { name: (self.clubTitles && self.clubTitles[c]) || L.clubClosed }); }).join(' · ');
        return '<div class="tas-ph__closed">' + esc(txt) + '</div>';
    };
    Scheduler.prototype._stripHtml = function (sel) {
        var L = this.L, today = this.now ? parseDate(fmtDate(this.now)) : parseDate(fmtDate(new Date()));
        var start = mondayOf(addDays(today, -this.o.stripPast)), end = addDays(mondayOf(addDays(today, this.o.stripFuture)), 6);
        if (sel < start) { start = mondayOf(sel); }
        if (sel > end) { end = addDays(mondayOf(sel), 6); }
        var n = dayDiff(start, end) + 1, html = '', i, counts = this._dayCounts();
        for (i = 0; i < n; i++) {
            var d = addDays(start, i), key = fmtDate(d), busy = this._busy(key, counts), dots = '', j;
            for (j = 0; j < busy; j++) { dots += '<i></i>'; }
            html += '<button type="button" role="tab" class="tas-ph__day' + (sameDay(d, today) ? ' is-today' : '') + (sameDay(d, sel) ? ' is-on' : '') + (d.getDate() === 1 ? ' is-first' : '') + '" data-act="date" data-date="' + key + '" aria-selected="' + sameDay(d, sel) + '">' +
                '<span class="tas-ph__mo">' + esc(L.monthsShort[d.getMonth()].toUpperCase()) + '</span><small>' + esc(L.weekdaysShort[d.getDay()]) + '</small><b>' + d.getDate() + '</b><span class="tas-ph__dots">' + dots + '</span></button>';
        }
        return html;
    };
    Scheduler.prototype._dayCounts = function () {
        var counts = {}, list = this.index ? this.index.list : [], i;
        for (i = 0; i < list.length; i++) { if (!(+list[i].waiting_list > 0)) { var k = fmtDate(list[i]._s); counts[k] = (counts[k] || 0) + 1; } }
        return counts;
    };
    Scheduler.prototype._busy = function (key, counts) {
        var v = 0;
        if (this.o.getBusy) { try { v = +this.o.getBusy(key) || 0; } catch (e) { v = 0; } }
        if (!v && counts[key]) { v = Math.min(3, Math.ceil(counts[key] / 5)); }
        return clamp(Math.round(v), 0, 3);
    };
    Scheduler.prototype._scrollStrip = function (smooth) {
        var strip = this.el.querySelector('.tas-ph__strip');
        if (!strip) { return; }
        var sel = parseDate(this.state.date), weekStart = strip.querySelector('[data-date="' + fmtDate(mondayOf(sel)) + '"]') || strip.querySelector('.is-on');
        if (!weekStart) { return; }
        var left = weekStart.offsetLeft - strip.offsetLeft;
        if (smooth && !reducedMotion() && strip.scrollTo) { try { strip.scrollTo({ left: left, behavior: 'smooth' }); return; } catch (e) { /* fall through */ } }
        strip.scrollLeft = left;
    };
    Scheduler.prototype._renderPhoneTools = function () {
        var L = this.L, gb = this.list.groupBy;
        this.el.querySelector('.tas-ph__tools').innerHTML = '<div class="tas__seg" role="group">' +
            '<button type="button" data-act="groupby" data-groupby="aircraft" class="' + (gb === 'aircraft' ? 'is-on' : '') + '">' + esc(L.byAircraft) + '</button>' +
            '<button type="button" data-act="groupby" data-groupby="instructor" class="' + (gb === 'instructor' ? 'is-on' : '') + '">' + esc(L.byInstructor) + '</button></div>' +
            '<button type="button" class="tas__chip-btn' + (this.list.mine ? ' is-on' : '') + '" data-act="mine" aria-pressed="' + this.list.mine + '">' + esc(L.justMine) + '</button>' +
            this._hideToggleHtml();
    };
    Scheduler.prototype._renderPhoneLegend = function () { this.el.querySelector('.tas-ph__lgd').innerHTML = this._legendHtml('phone'); };
    Scheduler.prototype._renderFab = function () {
        this.el.querySelector('.tas-ph__fabwrap').innerHTML = this.o.canCreate ? '<button type="button" class="tas-ph__fab" data-act="new">' + esc(this.L.newBookingShort) + '</button>' : '';
    };
    Scheduler.prototype._renderPhoneList = function () {
        var L = this.L, d = this.data, idx = this.index, el = this.el.querySelector('.tas-ph__list');
        if (!d || !idx || this._isStale()) { el.innerHTML = '<div class="tas-ph__empty tas-ph__loading">' + esc(L.loading) + '</div>'; return; }
        var d0 = parseDate(this.state.date), d1 = addDays(d0, 1), self = this;
        var dayList = idx.list.filter(function (b) { return b._e > d0 && b._s < d1; });
        var list = this.list.mine ? dayList.filter(function (b) { return self._isMine(b); }) : dayList;
        var res = d.resources || {}, ins = res.instructors || [], ac = res.aircraft || [], html = '', i;
        if (this.list.groupBy === 'aircraft') {
            for (i = 0; i < ac.length; i++) {
                var a = ac[i], items = list.filter(function (b) { return +b.plane_id === +a.id; });
                if (this.list.mine && !items.length) { continue; }
                html += this._phoneGroup('a:' + a.id, a.reg, a.type, safeColour(a.colour, ''), items, a, !this.list.mine && this.o.canCreate, 'aircraft');
            }
        } else {
            for (i = 0; i < ins.length; i++) {
                var n = ins[i], items2 = list.filter(function (b) { return +b.instructor_id === +n.id; });
                var working = n.working !== false && n.working !== 0;
                if (this.list.mine && !items2.length) { continue; }
                if (!working && !items2.length) {
                    html += '<div class="tas-ph__group"><div class="tas-ph__ghead is-off"><h3>' + esc(n.name) + '</h3><span class="tas-ph__count">' + esc(L.notWorking) + '</span></div></div>';
                    continue;
                }
                html += this._phoneGroup('i:' + n.id, n.name, '', safeColour(n.colour, ''), items2, null, false, 'instructor');
            }
            var loose = list.filter(function (b) { return !(+b.instructor_id > 0) && b.kind !== 'maint'; });
            if (loose.length) { html += this._phoneGroup('solo', L.soloHire, '', '', loose, null, false, 'instructor'); }
        }
        if (this.list.mine && !list.length) {
            html = '<div class="tas-ph__empty">' + esc(fmt(L.noneMine, { date: L.weekdaysShort[d0.getDay()] + ' ' + d0.getDate() + ' ' + L.monthsShort[d0.getMonth()] })) + '</div>';
        } else if (!html) { html = '<div class="tas-ph__empty">' + esc(L.nothingBooked) + '</div>'; }
        el.innerHTML = html;
    };
    Scheduler.prototype._phoneGroup = function (key, title, tag, colour, items, plane, showGaps, groupBy) {
        var L = this.L, g = this.geo, collapsed = !!this.list.collapsed[key], html, i;
        items = items.slice().sort(function (a, b) { return a._s - b._s; });
        var count = items.length === 1 ? L.bookingCountOne : fmt(L.bookingCount, { n: items.length });
        html = '<div class="tas-ph__ghead' + (collapsed ? ' is-closed' : '') + '"' + (colour ? ' style="--tas-gc:' + colour + '"' : '') + ' data-act="pgroup" data-group="' + esc(key) + '" role="button" tabindex="0" aria-expanded="' + !collapsed + '">' +
            '<h3>' + esc(title) + (tag ? ' <span class="tas__ac-tag">' + esc(tag) + '</span>' : '') + '</h3><span class="tas-ph__count">' + esc(count) + '</span><span class="tas__chev">' + ICON_CHEVRON + '</span></div>';
        if (!collapsed) {
            var d0 = parseDate(this.state.date), dayStart = new Date(d0.getTime() + g.dayStart * 60000), dayEnd = new Date(d0.getTime() + g.dayEnd * 60000);
            var cursor = dayStart;
            if (!items.length) { html += showGaps ? this._gap(plane, dayStart, dayEnd) : '<div class="tas-ph__none">' + esc(L.nothingBooked) + '</div>'; }
            for (i = 0; i < items.length; i++) {
                var b = items[i], onWait = +b.waiting_list > 0;
                if (showGaps && !onWait && b._s > cursor) { html += this._gap(plane, cursor, b._s); }
                html += this._card(b, groupBy);
                if (!onWait && b._e > cursor) { cursor = b._e; }
            }
            if (items.length && showGaps && cursor < dayEnd) { html += this._gap(plane, cursor, dayEnd); }
        }
        return '<div class="tas-ph__group">' + html + '</div>';
    };
    Scheduler.prototype._gap = function (plane, s, e) {
        var L = this.L, mins = (e - s) / 60000;
        if (mins < 60 || !plane) { return ''; }
        return '<button type="button" class="tas-ph__gap" data-act="gap" data-plane="' + esc(plane.id) + '" data-start="' + fmtDateTime(s) + '" data-end="' + fmtDateTime(e) + '">' +
            '<span>' + esc(L.free) + ' <b>' + hm(s) + ' – ' + hm(e) + '</b> · ' + esc(durationLabel(mins, L)) + '</span><span class="tas-ph__book">' + esc(L.book) + '</span></button>';
    };
    Scheduler.prototype._card = function (b, groupBy) {
        var L = this.L, kind = this._kindOf(b), ac = this.index.planes[b.plane_id], ins = this.index.ins[b.instructor_id];
        var done = this.now && b._e <= this.now, mine = this._isMine(b), pending = b.status === 'pending';
        var cls = 'tas-card tas-card--' + kind + (pending ? ' is-pending' : '') + (mine ? ' is-mine' : '') + (done ? ' is-done' : '');
        var side = '';
        if (kind !== 'maint') {
            if (groupBy === 'aircraft') {
                if (ins) { var ic = safeColour(ins.colour, ''); side = '<span class="tas-card__side"' + (ic ? ' style="--tas-c:' + ic + '"' : '') + '><b class="tas-av tas-av--sm" title="' + esc(ins.name) + '">' + esc(ins.code || initialsOf(ins.name)) + '</b></span>'; }
            } else if (ac) { side = '<span class="tas-card__side tas-card__side--quiet">' + esc(ac.reg) + '</span>'; }
        }
        var name = this._chipName(b, kind), acCol = ac ? safeColour(ac.colour, '') : '';
        return '<button type="button" class="' + cls + '"' + (acCol ? ' style="--tas-ac:' + acCol + '"' : '') + ' data-id="' + esc(b.id) + '" aria-label="' + esc(L.kinds[kind] + (name ? ' ' + name : '') + ' ' + hm(b._s) + ' – ' + hm(b._e)) + '">' +
            '<span class="tas-card__ico"></span><span class="tas-card__nm">' + esc(name) + (mine ? '<span class="tas-chip__you">' + esc(L.you) + '</span>' : '') + '</span>' +
            '<span class="tas-card__tm">' + hm(b._s) + ' – ' + hm(b._e) + (+b.waiting_list > 0 ? ' · ' + esc(L.waitingList) : '') + (b.lesson && kind !== 'maint' ? ' · ' + esc(b.lesson) : '') + '</span>' + side + '</button>';
    };

    // ───────────────────────────── highlight ─────────────────────────────
    Scheduler.prototype._applyHighlight = function (on) {
        var els = toArray(this.el.querySelectorAll('.is-highlight')), i;
        for (i = 0; i < els.length; i++) { els[i].classList.remove('is-highlight'); }
        if (!on || this.highlightId === null || this.highlightId === undefined) { return; }
        var hits = toArray(this.el.querySelectorAll('[data-id="' + String(this.highlightId).replace(/"/g, '') + '"]'));
        for (i = 0; i < hits.length; i++) { hits[i].classList.add('is-highlight'); }
        if (hits.length && hits[0].scrollIntoView && !this._hlScrolled) {
            this._hlScrolled = true;
            try { hits[0].scrollIntoView({ block: 'center', inline: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { hits[0].scrollIntoView(); }
            var self = this; setTimeout(function () { self._hlScrolled = false; }, HIGHLIGHT_MS);
        }
    };

    // ───────────────────────────── events (all delegated) ─────────────────────────────
    Scheduler.prototype._bind = function () {
        var self = this, b = this._bound;
        b.click = function (e) { self._onClick(e); };
        b.keydown = function (e) { self._onKeydown(e); };
        b.over = function (e) { self._onMouseOver(e); };
        b.out = function (e) { self._onMouseOut(e); };
        b.focusin = function (e) { var t = closest(e.target, '[data-tip]'); if (t && !self.drag) { self._showTip(t); } };
        b.focusout = function () { self._hideTip(); };
        b.pdown = function (e) { self._onPointerDown(e); };
        b.touchmove = function (e) { if (self.drag && self.drag.started && e.cancelable) { e.preventDefault(); } };
        b.resize = function () {
            // deferred: a mode switch rebuilds the DOM (and so the size) — never do that inside the observer callback
            if (self._rzTimer) { return; }
            self._rzTimer = setTimeout(function () { self._rzTimer = null; if (!self.destroyed && self.o.mode === 'auto') { self._resolveMode(); } }, 0);
        };
        b.scroll = function () { self._hideTip(); };
        this.el.addEventListener('click', b.click);
        this.el.addEventListener('keydown', b.keydown);
        this.el.addEventListener('mouseover', b.over);
        this.el.addEventListener('mouseout', b.out);
        this.el.addEventListener('focusin', b.focusin);
        this.el.addEventListener('focusout', b.focusout);
        this.el.addEventListener('pointerdown', b.pdown);
        this.el.addEventListener('touchmove', b.touchmove, supportsPassive ? { passive: false } : false);
        this.el.addEventListener('scroll', b.scroll, supportsPassive ? { passive: true, capture: true } : true);
        if (global.ResizeObserver) {
            this._ro = new global.ResizeObserver(function () { b.resize(); });
            this._ro.observe(this.el);
        } else { global.addEventListener('resize', b.resize); }
    };
    Scheduler.prototype._unbind = function () {
        var b = this._bound;
        this.el.removeEventListener('click', b.click);
        this.el.removeEventListener('keydown', b.keydown);
        this.el.removeEventListener('mouseover', b.over);
        this.el.removeEventListener('mouseout', b.out);
        this.el.removeEventListener('focusin', b.focusin);
        this.el.removeEventListener('focusout', b.focusout);
        this.el.removeEventListener('pointerdown', b.pdown);
        this.el.removeEventListener('touchmove', b.touchmove, supportsPassive ? { passive: false } : false);
        this.el.removeEventListener('scroll', b.scroll, supportsPassive ? { passive: true, capture: true } : true);
        if (this._ro) { this._ro.disconnect(); this._ro = null; } else { global.removeEventListener('resize', b.resize); }
    };
    Scheduler.prototype._emit = function (name) {
        var fn = this.on && this.on[name];
        if (typeof fn !== 'function') { return undefined; }
        return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    };
    Scheduler.prototype._changeDate = function (dateStr) {
        if (dateStr === this.state.date) { return; }
        this.state.date = dateStr;
        this._computeScale();
        this.scrolledToNow = false;
        this._resetScroll();
        this.render();
        if (this.state.mode === 'list') { this._scrollStrip(true); }
        this._emit('dateChange', dateStr);
    };
    Scheduler.prototype._onClick = function (e) {
        if (this.suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
        var act = closest(e.target, '[data-act]');
        if (act) {
            var a = act.getAttribute('data-act'), todayStr = fmtDate(this.now || new Date());
            switch (a) {
                case 'today': this._changeDate(todayStr); return;
                case 'prev': this._changeDate(fmtDate(addDays(this.geo.date0, -this.state.days))); return;
                case 'next': this._changeDate(fmtDate(addDays(this.geo.date0, this.state.days))); return;
                case 'date': this._changeDate(act.getAttribute('data-date')); return;
                case 'pick': this._emit('pickDate', act); return;
                case 'days':
                    var n = +act.getAttribute('data-days');
                    if (n !== this.state.days) { this.state.days = n; this._computeScale(); this.scrolledToNow = false; this._resetScroll(); this.render(); this._emit('daysChange', n); }
                    return;
                case 'new':
                    var s = new Date(this.geo.date0.getTime() + this.geo.dayStart * 60000);
                    this._emit('create', { plane_id: 0, instructor_id: 0, start: fmtDateTime(s), end: fmtDateTime(new Date(s.getTime() + this.geo.slot * 60000)), source: 'button' });
                    return;
                case 'hidetoggle':
                case 'showall':
                    this.state.hide = !this.state.hide; this.render();
                    // on.hideToggle(hide) is the API; on.showAllToggle(!hide) is the deprecated alias (its original "show all" meaning)
                    if (typeof this.on.hideToggle === 'function') { this._emit('hideToggle', this.state.hide); }
                    else { this._emit('showAllToggle', !this.state.hide); }
                    return;
                case 'groupby':
                    this.list.groupBy = act.getAttribute('data-groupby') === 'instructor' ? 'instructor' : 'aircraft'; this._renderPhoneTools(); this._renderPhoneList(); return;
                case 'mine':
                    this.list.mine = !this.list.mine; this._renderPhoneTools(); this._renderPhoneList(); return;
                case 'pgroup':
                    var k = act.getAttribute('data-group'); this.list.collapsed[k] = !this.list.collapsed[k]; this._renderPhoneList(); return;
                case 'gap':
                    this._emit('create', { plane_id: +act.getAttribute('data-plane'), instructor_id: 0, start: act.getAttribute('data-start'), end: act.getAttribute('data-end'), source: 'gap' });
                    return;
                default: break;
            }
        }
        var gh = closest(e.target, '.tas__ghead');
        if (gh) { this._toggleGroup(gh.getAttribute('data-group')); return; }
        var chip = closest(e.target, '.tas-chip, .tas-card');
        if (chip) {
            var b = this.index && this.index.byId[chip.getAttribute('data-id')];
            if (b) { this._hideTip(); this._emit('openBooking', b); }
        }
    };
    Scheduler.prototype._toggleGroup = function (key) {
        if (key !== 'instructors' && key !== 'aircraft') { return; }
        this.groups[key] = !this.groups[key];
        saveGroups(this.groups);
        this._renderGrid();
        this._emit('groupToggle', key, this.groups[key]);
    };
    Scheduler.prototype._onKeydown = function (e) {
        var key = e.key || e.keyCode;
        if (key === 'Escape' || key === 'Esc' || key === 27) { if (this.drag) { this._cancelDrag(); e.preventDefault(); } this._hideTip(); return; }
        var gh = closest(e.target, '.tas__ghead, .tas-ph__ghead');
        if (gh && (key === 'Enter' || key === ' ' || key === 13 || key === 32)) {
            e.preventDefault();
            if (hasClass(gh, 'tas__ghead')) { this._toggleGroup(gh.getAttribute('data-group')); }
            else { var k = gh.getAttribute('data-group'); this.list.collapsed[k] = !this.list.collapsed[k]; this._renderPhoneList(); }
        }
        // chips and cards are <button>s: Enter/Space fire click → openBooking
    };

    // ── tooltips + twin highlight ──
    Scheduler.prototype._onMouseOver = function (e) {
        if (this.drag) { return; }
        var t = closest(e.target, '[data-tip]');
        if (t && this.el.contains(t)) { this._showTip(t); } else { this._hideTip(); }
        var chip = closest(e.target, '.tas-chip');
        this._setTwins(chip ? chip.getAttribute('data-id') : null);
    };
    Scheduler.prototype._onMouseOut = function (e) {
        var to = e.relatedTarget;
        if (!to || !this.el.contains(to)) { this._hideTip(); this._setTwins(null); }
    };
    Scheduler.prototype._setTwins = function (id) {
        var i;
        if (this._twinId === id) { return; }
        for (i = 0; i < this.twins.length; i++) { this.twins[i].classList.remove('is-twin'); }
        this.twins = [];
        this._twinId = id;
        if (id === null || id === undefined) { return; }
        this.twins = toArray(this.el.querySelectorAll('.tas-chip[data-id="' + String(id).replace(/"/g, '') + '"]'));
        for (i = 0; i < this.twins.length; i++) { this.twins[i].classList.add('is-twin'); }
    };
    Scheduler.prototype._showTip = function (el) {
        var tip = this.el.querySelector('.tas__tip'), text = el.getAttribute('data-tip');
        if (!tip || !text) { return; }
        tip.textContent = text;
        tip.hidden = false;
        var r = el.getBoundingClientRect(), w = this.el.getBoundingClientRect();
        var x = r.left - w.left + r.width / 2, y = r.top - w.top - 8;
        // keep inside the root horizontally
        var half = Math.min(150, w.width / 2 - 8);
        x = clamp(x, half + 4, w.width - half - 4);
        tip.classList.toggle('is-below', y < 36);
        if (y < 36) { y = r.bottom - w.top + 8; }
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    Scheduler.prototype._hideTip = function () { var tip = this.el.querySelector('.tas__tip'); if (tip) { tip.hidden = true; } };

    // ───────────────────────────── drag / resize / drag-select ─────────────────────────────
    Scheduler.prototype._onPointerDown = function (e) {
        if (this.state.mode !== 'timeline' || this.drag) { return; }
        if (e.pointerType === 'mouse' && e.button !== 0) { return; }
        var row = closest(e.target, '.tas-row');
        if (!row || !this.index) { return; }
        var chip = closest(e.target, '.tas-chip'), type, booking = null;
        if (chip) {
            if (hasClass(chip, 'is-locked') || hasClass(chip, 'is-busy')) { return; }
            booking = this.index.byId[chip.getAttribute('data-id')];
            if (!booking) { return; }
            var cr = chip.getBoundingClientRect(), ox = e.clientX - cr.left;
            type = cr.width >= 36 && ox <= RESIZE_ZONE ? 'resize-l' : (cr.width >= 36 && ox >= cr.width - RESIZE_ZONE ? 'resize-r' : 'move');
        } else {
            // drag-select on the empty cells of an aircraft OR an instructor row
            var rk = row.getAttribute('data-kind');
            if ((rk !== 'a' && rk !== 'i') || !this.o.canCreate) { return; }
            type = 'select';
        }
        var self = this;
        this.drag = {
            type: type, chip: chip, booking: booking, row: row, started: false,
            pointerId: e.pointerId, touch: e.pointerType === 'touch', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
            timer: null, ghost: null, conflicts: [], targetRow: row, raf: null,
            srcKind: row.getAttribute('data-kind'), srcRes: +row.getAttribute('data-id-res'),
            tKind: row.getAttribute('data-kind'), tRes: +row.getAttribute('data-id-res'), inZone: false, marked: [],
            // slot-aware move state: inStrip = pointer physically in the drop zone; taken = the proposed range overlaps
            // another non-waiting booking on the target aircraft; autoWait = taken + allowed → waiting-list drop;
            // blocked = the drop would be refused (reverts without calling the host), blockedLabel = why
            inStrip: false, taken: false, autoWait: false, blocked: false, blockedLabel: ''
        };
        if (this.drag.touch) { this.drag.timer = setTimeout(function () { if (self.drag && !self.drag.started) { self._startDrag(); } }, LONG_PRESS_MS); }
        var d = this._bound;
        d.pmove = function (ev) { self._onPointerMove(ev); };
        d.pup = function (ev) { self._onPointerUp(ev); };
        d.pcancel = function () { self._cancelDrag(); };
        d.dockey = function (ev) { var k = ev.key || ev.keyCode; if (k === 'Escape' || k === 'Esc' || k === 27) { self._cancelDrag(); ev.preventDefault(); } };
        document.addEventListener('pointermove', d.pmove);
        document.addEventListener('pointerup', d.pup);
        document.addEventListener('pointercancel', d.pcancel);
        document.addEventListener('keydown', d.dockey);
    };
    Scheduler.prototype._onPointerMove = function (e) {
        var dr = this.drag;
        if (!dr || (dr.pointerId !== undefined && e.pointerId !== dr.pointerId)) { return; }
        dr.x = e.clientX; dr.y = e.clientY;
        if (!dr.started) {
            var dist = Math.max(Math.abs(e.clientX - dr.x0), Math.abs(e.clientY - dr.y0));
            if (dr.touch) { if (dist > TOUCH_SLOP) { this._cancelDrag(); } return; }   // the finger is scrolling, not dragging
            if (dist > MOUSE_SLOP) { this._startDrag(); } else { return; }
        }
        if (e.cancelable) { e.preventDefault(); }
        this._updateDrag();
    };
    Scheduler.prototype._startDrag = function () {
        var dr = this.drag, g = this.geo;
        if (!dr || dr.started) { return; }
        if (dr.timer) { clearTimeout(dr.timer); dr.timer = null; }
        dr.started = true;
        this._hideTip(); this._setTwins(null);
        this.el.classList.add('is-dragging');
        this.el.classList.add('is-dragging--' + (dr.type === 'select' ? 'select' : (dr.type === 'move' ? 'move' : 'resize')));
        var rowRect = dr.row.getBoundingClientRect();
        dr.pxPerMin = rowRect.width / g.total;
        dr.rowLeft = rowRect.left;
        dr.scroller = this.el.querySelector('.tas__scroll');
        var firstLabel = this.el.querySelector('.tas__label');
        dr.labelW = firstLabel ? firstLabel.offsetWidth : 0;
        dr.rows = [];
        var rows = toArray(this.el.querySelectorAll('.tas-row')), i;
        for (i = 0; i < rows.length; i++) { dr.rows.push({ el: rows[i], kind: rows[i].getAttribute('data-kind'), resId: +rows[i].getAttribute('data-id-res') }); }
        dr.ghost = document.createElement('div');
        if (dr.type === 'select') {
            dr.anchorMin = this._snapFloor(this._minAt(dr.x0));
            dr.ghost.className = 'tas-ghost tas-ghost--select';
        } else {
            var b = dr.booking;
            dr.s0 = this._xMin(b._s); dr.e0 = this._xMin(b._e);
            dr.grabOffset = this._minAt(dr.x0) - dr.s0;
            dr.durMs = b._e - b._s;
            dr.ghost.className = 'tas-ghost tas-ghost--' + this._kindOf(b) + (dr.type === 'move' ? ' tas-ghost--move' : ' tas-ghost--resize');
            var acCol = this.index.planes[b.plane_id] ? safeColour(this.index.planes[b.plane_id].colour, '') : '';
            if (acCol) { dr.ghost.style.setProperty('--tas-ac', acCol); }
            dr.chip.classList.add('is-dragging');
            if (dr.type !== 'move') { dr.chip.classList.add('is-resizing'); }
            dr.ghost.setAttribute('data-id', b.id);
        }
        dr.ghost.innerHTML = '<span class="tas-ghost__tm"></span><span class="tas-ghost__to"></span>';
        dr.row.appendChild(dr.ghost);
        this._updateDrag();
        this._autoScrollLoop();
    };
    Scheduler.prototype._minAt = function (clientX) {
        var dr = this.drag, rect = dr.row.getBoundingClientRect();
        return clamp((clientX - rect.left) / rect.width * this.geo.total, 0, this.geo.total);
    };
    Scheduler.prototype._snapFloor = function (m) { var s = this.geo.slot; return Math.floor(m / s + 1e-6) * s; };
    Scheduler.prototype._snapCeil = function (m) { var s = this.geo.slot; return Math.ceil(m / s - 1e-6) * s; };
    Scheduler.prototype._rowAt = function (clientY, allowed) {
        var dr = this.drag, i, r, rect;
        for (i = 0; i < dr.rows.length; i++) {
            r = dr.rows[i];
            if (allowed.indexOf(r.kind) < 0) { continue; }
            rect = r.el.getBoundingClientRect();
            if (clientY >= rect.top && clientY < rect.bottom) { r.rect = rect; return r; }
        }
        return null;
    };
    // The row (and its sticky label) a move would land on: tinted while it differs from the source row; the aircraft row
    // under the pointer also shows its slim "Waiting list" drop zone (has-wzone rows only) and lights it when targeted.
    Scheduler.prototype._markTarget = function (hit) {
        var dr = this.drag, i, next = [];
        if (hit) {
            var changed = hit.el !== dr.row, label = this.el.querySelector('.tas__label[data-res="' + hit.el.getAttribute('data-res') + '"]');
            if (changed) { next.push([hit.el, 'is-drop-target']); if (label) { next.push([label, 'is-drop-target']); } }
            // the "Waiting list" strip is only OFFERED when the proposed range is taken (a free range is a plain move)
            if (hit.kind === 'a' && dr.taken && !dr.blocked) { next.push([hit.el, 'is-drop-hover']); if (dr.inZone) { next.push([hit.el, 'is-drop-wait']); } }
            if (dr.blocked) { next.push([hit.el, 'is-drop-blocked']); }
        }
        for (i = 0; i < dr.marked.length; i++) { dr.marked[i][0].classList.remove(dr.marked[i][1]); }
        for (i = 0; i < next.length; i++) { next[i][0].classList.add(next[i][1]); }
        dr.marked = next;
    };
    Scheduler.prototype._targetName = function () {
        var dr = this.drag, L = this.L;
        if (dr.blocked) { return dr.blockedLabel || L.slotTaken; }
        if (dr.tKind === dr.srcKind && dr.tRes === dr.srcRes && !dr.autoWait) { return ''; }
        if (dr.tKind === 'i') { var ins = this.index.ins[dr.tRes]; return ins ? ins.name : ''; }
        var ac = this.index.planes[dr.tRes], reg = ac ? ac.reg : '';
        // inside the drop zone the strip itself says "Waiting list", so the (slim) ghost only needs the registration;
        // an automatic waiting-list drop (taken slot, pointer mid-row) and the explicit sub-row spell it out
        if (dr.tKind === 'w') { return dr.inStrip ? reg : (reg ? fmt(L.waitingAuto, { reg: reg }) : L.waitingList); }
        return reg;
    };
    Scheduler.prototype._updateDrag = function () {
        var dr = this.drag, g = this.geo;
        if (!dr || !dr.started) { return; }
        var m = this._minAt(dr.x), sMin, eMin, target = dr.targetRow;
        if (dr.type === 'select') {
            var cur = m, a = dr.anchorMin, lo, hi;
            if (cur >= a) { lo = a; hi = Math.max(this._snapCeil(cur), a + g.slot); } else { lo = Math.min(this._snapFloor(cur), a - g.slot); hi = a; }
            sMin = clamp(lo, 0, g.total); eMin = clamp(hi, 0, g.total);
            if (eMin - sMin < g.slot) { if (sMin + g.slot <= g.total) { eMin = sMin + g.slot; } else { sMin = eMin - g.slot; } }
            dr.resStart = this._minToDate(sMin); dr.resEnd = this._minToDate(eMin);
        } else if (dr.type === 'move') {
            var durC = dr.e0 - dr.s0;
            sMin = clamp(this._snap(m - dr.grabOffset), 0, g.total - durC);
            eMin = sMin + durC;
            dr.resStart = this._minToDate(sMin);
            dr.resEnd = new Date(dr.resStart.getTime() + dr.durMs);
            // any row is a target: an instructor row re-assigns the instructor (plane kept), an aircraft row re-assigns the
            // plane (instructor kept), the waiting-list sub-row / the drop zone along an aircraft row's bottom → waiting list
            var hit = this._rowAt(dr.y, ['i', 'a', 'w']);
            if (hit) {
                target = hit.el;
                var hitAc = hit.kind === 'i' ? null : this.index.planes[hit.resId];
                var canWait = !hitAc || hitAc.can_wait !== false;   // may THIS viewer put a booking on that aircraft's waiting list?
                dr.inZone = false; dr.inStrip = false; dr.taken = false; dr.autoWait = false; dr.blocked = false; dr.blockedLabel = '';
                if (hit.kind === 'a') {
                    // slot-aware: the waiting list is only offered when the proposed range is TAKEN by another (non-waiting)
                    // booking on that aircraft — a FREE range is a plain move even inside the strip; TAKEN + can_wait →
                    // an automatic waiting-list drop; TAKEN without it → refused (reverts, the host is never called)
                    dr.taken = this._slotTaken(hit.resId, dr.resStart, dr.resEnd, dr.booking.id);
                    dr.inStrip = hasClass(hit.el, 'has-wzone') && dr.y >= hit.rect.bottom - WZONE_H;
                    if (dr.taken && canWait) { dr.inZone = true; dr.autoWait = !dr.inStrip; dr.tKind = 'w'; }
                    else { dr.tKind = 'a'; if (dr.taken) { dr.blocked = true; dr.blockedLabel = this.L.slotTaken; } }
                } else if (hit.kind === 'w') {
                    dr.tKind = 'w';
                    if (!canWait) { dr.blocked = true; dr.blockedLabel = this.L.waitingNotAllowed; }
                } else { dr.tKind = 'i'; }
                dr.tRes = hit.resId;
            }
            this._markTarget(hit || { el: target, kind: target.getAttribute('data-kind') });
            dr.ghost.classList.toggle('tas-ghost--inzone', !!dr.inZone);
            dr.ghost.classList.toggle('tas-ghost--blocked', !!dr.blocked);
            dr.ghost.lastChild.textContent = this._targetName();
        } else {
            if (dr.type === 'resize-r') {
                sMin = dr.s0; eMin = clamp(this._snap(m), dr.s0 + g.slot, g.total);
                dr.resStart = dr.booking._s; dr.resEnd = this._minToDate(eMin);
            } else {
                eMin = dr.e0; sMin = clamp(this._snap(m), 0, dr.e0 - g.slot);
                dr.resStart = this._minToDate(sMin); dr.resEnd = dr.booking._e;
            }
            // a resize keeps the booking's waiting_list, so resizing a WAITING booking is a new double booking:
            // refused on an aircraft where this viewer may not double book (the backend applies the same rule)
            var rAc = this.index.planes[dr.booking.plane_id];
            dr.blocked = +dr.booking.waiting_list > 0 && !!rAc && rAc.can_wait === false;
            dr.blockedLabel = dr.blocked ? this.L.waitingNotAllowed : '';
            dr.ghost.classList.toggle('tas-ghost--blocked', dr.blocked);
            dr.ghost.lastChild.textContent = dr.blockedLabel;
        }
        if (target !== dr.targetRow || dr.ghost.parentNode !== target) {
            dr.targetRow = target;
            target.appendChild(dr.ghost);
        }
        dr.sMin = sMin; dr.eMin = eMin;
        dr.ghost.style.left = this._pct(sMin) + '%';
        dr.ghost.style.width = 'calc(' + this._pct(eMin - sMin) + '% - 3px)';
        dr.ghost.firstChild.textContent = hm(dr.resStart) + ' – ' + hm(dr.resEnd);
        this._markConflicts();
    };
    Scheduler.prototype._markConflicts = function () {
        var dr = this.drag, i, next = [], chips = dr.inZone ? [] : toArray(dr.targetRow.querySelectorAll('.tas-chip')), own = dr.booking ? String(dr.booking.id) : null;
        for (i = 0; i < chips.length; i++) {
            var id = chips[i].getAttribute('data-id'), b = this.index.byId[id];
            if (!b || id === own) { continue; }
            if (b._s < dr.resEnd && b._e > dr.resStart) { next.push(chips[i]); }
        }
        for (i = 0; i < dr.conflicts.length; i++) { if (next.indexOf(dr.conflicts[i]) < 0) { dr.conflicts[i].classList.remove('is-conflict'); } }
        for (i = 0; i < next.length; i++) { next[i].classList.add('is-conflict'); }
        dr.conflicts = next;
        if (dr.ghost) { dr.ghost.classList.toggle('has-conflict', next.length > 0); }
    };
    Scheduler.prototype._autoScrollLoop = function () {
        var self = this;
        function step() {
            var dr = self.drag;
            if (!dr || !dr.started) { return; }
            var moved = false, sc = dr.scroller;
            if (sc) {
                var r = sc.getBoundingClientRect();
                var labelW = dr.labelW || 0, leftEdge = r.left + labelW;
                if (dr.x < leftEdge + AUTOSCROLL_EDGE && sc.scrollLeft > 0) { sc.scrollLeft -= AUTOSCROLL_SPEED; moved = true; }
                else if (dr.x > r.right - AUTOSCROLL_EDGE && sc.scrollLeft < sc.scrollWidth - sc.clientWidth) { sc.scrollLeft += AUTOSCROLL_SPEED; moved = true; }
            }
            var vh = global.innerHeight || document.documentElement.clientHeight;
            if (dr.y < AUTOSCROLL_EDGE + 60) { global.scrollBy(0, -AUTOSCROLL_SPEED); moved = true; }
            else if (dr.y > vh - AUTOSCROLL_EDGE) { global.scrollBy(0, AUTOSCROLL_SPEED); moved = true; }
            if (moved) { self._updateDrag(); }
            dr.raf = global.requestAnimationFrame(step);
        }
        this.drag.raf = global.requestAnimationFrame(step);
    };
    Scheduler.prototype._onPointerUp = function (e) {
        var dr = this.drag;
        if (!dr || (dr.pointerId !== undefined && e.pointerId !== dr.pointerId)) { return; }
        if (!dr.started) { this._cancelDrag(); return; }   // a plain tap / click: the click event does its normal thing
        var self = this;
        this.suppressClick = true;
        setTimeout(function () { self.suppressClick = false; }, 0);
        if (dr.type === 'select') {
            // aircraft row → { plane_id, instructor_id: 0 }; instructor row → { plane_id: 0, instructor_id }
            var onIns = dr.srcKind === 'i';
            var draft = { plane_id: onIns ? 0 : dr.srcRes, instructor_id: onIns ? dr.srcRes : 0, start: fmtDateTime(dr.resStart), end: fmtDateTime(dr.resEnd), source: 'drag' };
            this._cancelDrag();
            this._emit('create', draft);
            return;
        }
        if (dr.blocked) { this._abortDrag(); return; }   // refused drop (slot taken, no waiting list here): revert, the host is never called
        var b = dr.booking, tKind = dr.tKind, tRes = dr.tRes;
        var newStart = fmtDateTime(dr.resStart), newEnd = fmtDateTime(dr.resEnd);
        var curIns = +b.instructor_id || 0, curPlane = +b.plane_id || 0, curWait = +b.waiting_list || 0;
        var change, cbName;
        if (dr.type === 'move') {
            var plane = tKind === 'i' ? curPlane : tRes;
            var instr = tKind === 'i' ? tRes : curIns;
            var wait = tKind === 'w' ? (curWait > 0 ? curWait : 1) : (tKind === 'a' ? 0 : curWait);
            var same = newStart === fmtDateTime(b._s) && newEnd === fmtDateTime(b._e) && plane === curPlane && instr === curIns && wait === curWait;
            if (same) { this._cancelDrag(); return; }
            change = { booking: b, start: newStart, end: newEnd, plane_id: plane, instructor_id: instr, waiting_list: wait };
            cbName = 'move';
        } else {
            if (newStart === fmtDateTime(b._s) && newEnd === fmtDateTime(b._e)) { this._cancelDrag(); return; }
            change = { booking: b, start: newStart, end: newEnd, plane_id: curPlane, instructor_id: curIns, waiting_list: curWait };
            cbName = 'resize';
        }
        this._commit(cbName, change);
    };
    // Hand the change to the host; keep the ghost in place (busy) until the Promise settles.
    Scheduler.prototype._commit = function (cbName, change) {
        var self = this, dr = this.drag, ghost = dr.ghost, chip = dr.chip, b = dr.booking;
        var i;
        for (i = 0; i < dr.conflicts.length; i++) { dr.conflicts[i].classList.remove('is-conflict'); }
        dr.conflicts = [];
        this._markTarget(null);
        if (dr.raf) { global.cancelAnimationFrame(dr.raf); }
        this._detachDocListeners();
        this.el.classList.remove('is-dragging', 'is-dragging--move', 'is-dragging--resize', 'is-dragging--select');
        ghost.classList.remove('has-conflict');
        ghost.classList.add('is-busy');
        chip.classList.add('is-busy');
        this.drag = null;
        var p;
        try { p = this._emit(cbName, change); } catch (err) { p = null; }
        var settled = false;
        function ok() {
            if (settled) { return; } settled = true;
            b.start = change.start; b.end = change.end; b._s = parseDateTime(b.start); b._e = parseDateTime(b.end);
            if (cbName === 'move') { b.plane_id = change.plane_id; b.instructor_id = change.instructor_id; b.waiting_list = change.waiting_list; }
            if (ghost.parentNode) { ghost.parentNode.removeChild(ghost); }
            chip.classList.remove('is-busy', 'is-dragging', 'is-resizing');
            self._reindex();
            self.render();
        }
        function fail() {
            if (settled) { return; } settled = true;
            chip.classList.remove('is-busy');
            self._revertGhost(ghost, chip, function () {
                chip.classList.remove('is-dragging', 'is-resizing');
                if (self.pendingRender) { self.pendingRender = false; self.render(); }
            });
        }
        if (p && typeof p.then === 'function') {
            p.then(function (res) { if (res && res.ok === false) { fail(); } else { ok(); } }, fail);
        } else if (p === false) { fail(); } else { ok(); }
    };
    // Does [s, e) overlap a NON-waiting booking on this aircraft other than the dragged one? (waiting bookings never block)
    Scheduler.prototype._slotTaken = function (planeId, s, e, ownId) {
        var list = (this.index && this.index.byPlane[planeId]) || [], i;
        for (i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(ownId)) { continue; }
            if (list[i]._s < e && list[i]._e > s) { return true; }
        }
        return false;
    };
    // A refused drop: the same teardown as _commit, then the revert animation — the host's on.move / on.resize is not called.
    Scheduler.prototype._abortDrag = function () {
        var self = this, dr = this.drag, ghost = dr.ghost, chip = dr.chip, i;
        for (i = 0; i < dr.conflicts.length; i++) { dr.conflicts[i].classList.remove('is-conflict'); }
        dr.conflicts = [];
        this._markTarget(null);
        if (dr.raf) { global.cancelAnimationFrame(dr.raf); }
        this._detachDocListeners();
        this.el.classList.remove('is-dragging', 'is-dragging--move', 'is-dragging--resize', 'is-dragging--select');
        this.drag = null;
        this._emit('refused', { booking: dr.booking, reason: dr.blockedLabel });
        this._revertGhost(ghost, chip, function () {
            chip.classList.remove('is-dragging', 'is-resizing');
            if (self.pendingRender) { self.pendingRender = false; self.render(); }
        });
    };
    Scheduler.prototype._revertGhost = function (ghost, chip, done) {
        if (!ghost.parentNode) { done(); return; }
        if (reducedMotion()) { ghost.parentNode.removeChild(ghost); done(); return; }
        var gr = ghost.getBoundingClientRect(), cr = chip.getBoundingClientRect();
        ghost.classList.add('is-reverting');
        ghost.style.transform = 'translate(' + (cr.left - gr.left) + 'px,' + (cr.top - gr.top) + 'px)';
        ghost.style.width = cr.width + 'px';
        setTimeout(function () { if (ghost.parentNode) { ghost.parentNode.removeChild(ghost); } done(); }, REVERT_MS);
    };
    Scheduler.prototype._detachDocListeners = function () {
        var d = this._bound;
        if (d.pmove) { document.removeEventListener('pointermove', d.pmove); document.removeEventListener('pointerup', d.pup); document.removeEventListener('pointercancel', d.pcancel); document.removeEventListener('keydown', d.dockey); }
        d.pmove = d.pup = d.pcancel = d.dockey = null;
    };
    Scheduler.prototype._cancelDrag = function () {
        var dr = this.drag, i;
        this._detachDocListeners();
        if (!dr) { return; }
        if (dr.timer) { clearTimeout(dr.timer); }
        if (dr.raf) { global.cancelAnimationFrame(dr.raf); }
        if (dr.ghost && dr.ghost.parentNode) { dr.ghost.parentNode.removeChild(dr.ghost); }
        if (dr.chip) { dr.chip.classList.remove('is-dragging', 'is-resizing'); }
        for (i = 0; i < dr.conflicts.length; i++) { dr.conflicts[i].classList.remove('is-conflict'); }
        for (i = 0; i < dr.marked.length; i++) { dr.marked[i][0].classList.remove(dr.marked[i][1]); }
        this.el.classList.remove('is-dragging', 'is-dragging--move', 'is-dragging--resize', 'is-dragging--select');
        this.drag = null;
        if (this.pendingRender) { this.pendingRender = false; this.render(); }
    };

    // ───────────────────────────── export ─────────────────────────────
    var api = {
        version: VERSION,
        create: function (el, opts) { return new Scheduler(el, opts); },
        icons: ICONS,
        kinds: KINDS.slice(),
        defaultLocale: DEFAULT_LOCALE,
        utils: { escapeHtml: esc, parseDate: parseDate, parseDateTime: parseDateTime, formatDate: fmtDate, formatDateTime: fmtDateTime, initials: initialsOf }
    };
    global.ToAviateScheduler = api;
})(typeof window !== 'undefined' ? window : this);
