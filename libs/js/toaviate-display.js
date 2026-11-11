/*!
 * ToAviateDisplay — framework-free renderer for the clubhouse TV (schedule display v2). Plain ES5, no dependencies
 * (icons are Font Awesome 5 class names, which the app already ships).
 *
 * Contract: backend/FRONTEND_SCHEDULE_DISPLAY_V2_GUIDE.md (the day read). Visual source of truth:
 * mockups/schedule-display/tv.html (approved by the owner, 11 Nov 2026) — this is its tvFrame() code, ported to ES5 and
 * to the real day payload. Styles: libs/css/toaviate-display.css (.tad, tad-*).
 *
 * Usage:
 *   var tv = ToAviateDisplay.create(el);                 // el = a box the full height of the screen
 *   tv.render(day, settings, view);                      // day = GET schedule_display/{token}/day; settings = the club's
 *                                                        // options (ToAviateDisplay.settings() coerces a partial);
 *                                                        // view = { mode: 'today' | 'tomorrow' | 'day',
 *                                                        //          now: minutes after the day's midnight (today only),
 *                                                        //          clock: 'HH:MM', offline: null | 'HH:MM' (last update),
 *                                                        //          updated: 'HH:MM:SS' (last successful read; the credit line) }
 *   tv.info();                                           // { page, pages, rows, layout } (tests)
 *   tv.destroy();
 *
 * The host makes 1rem = screen height / 54. The library fits the rows to the height it is given, turns pages every
 * settings.pageturn seconds (never scrolls) and narrows booking chips by measuring them (no container queries: TV
 * browsers run old engines). It re-fits itself on window resize. `who` on a booking is shown as sent: the server has
 * already applied the display's name rule, and the TV never looks a name up.
 */
(function (global) {
    'use strict';

    var VERSION = '1.0.0';

    // ───────────────────────────── the club's options (backend Models\ScheduleDisplaySettings) ─────────────────────────────
    var DEFAULTS = {
        layout: 'timeline', rows: 'packed', insrows: 'booked', idle: 'strip', window: 'day', pageturn: 15, names: 'initial',
        reg: 'circle', regpos: 'right', times: 'off', notices: 'on', weather: 'off', theme: 'light', badge: 'initials',
        day_switch: 'close', show_date: null   // which day the TV shows (owner, 11 Nov): the rule, and a manager's day on demand
    };
    var OPTIONS = {
        layout: ['timeline', 'split', 'board'], rows: ['packed', 'instructors', 'aircraft'], insrows: ['booked', 'working'],
        idle: ['strip', 'rows'], window: ['day', 'rest'], names: ['initial', 'short', 'full', 'hidden'],
        reg: ['circle', 'tile', 'auto', 'short', 'full'], regpos: ['right', 'under'], times: ['off', 'on'],
        notices: ['on', 'off'], weather: ['off', 'on'], theme: ['light', 'dark'], badge: ['initials', 'logo'],
        day_switch: ['close', 'last_booking', 'midnight']
    };
    var PAGE_MIN = 5;
    var PAGE_MAX = 60;
    var ON_OFF = { times: true, notices: true, weather: true };

    var KIND = {
        dual: { ic: 'fa-user-friends', label: 'dual lesson' }, solo: { ic: 'fa-user', label: 'solo' },
        hire: { ic: 'fa-key', label: 'self-fly hire' }, trial: { ic: 'fa-star', label: 'trial lesson' },
        maint: { ic: 'fa-wrench', label: 'maintenance' }
    };
    // the ToAviate logo (the app's own images/main_logo.png: the wing mark + the wordmark) — opts.logo overrides the path
    var TOAVIATE_LOGO = 'images/main_logo.png';
    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ───────────────────────────── helpers ─────────────────────────────
    function esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function hhmm(m) { m = Math.round(m); var h = Math.floor(m / 60) % 24; if (h < 0) { h += 24; } return pad2(h) + ':' + pad2(((m % 60) + 60) % 60); }
    function toMin(t) { var p = String(t || '').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
    function ymd(s) { var p = String(s || '').split('-'); return [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)]; }
    function dayNo(s) { var p = ymd(s); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
    function utcDate(s) { var p = ymd(s); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
    // 'Y-m-d H:i' as minutes after the given day's midnight (negative = the day before, over 1440 = the day after)
    function minsOn(dt, day) { var p = String(dt || '').split(' '); return (dayNo(p[0]) - dayNo(day)) * 1440 + toMin(p[1]); }
    function longDate(s) { var d = utcDate(s); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
    function shortDate(s) { var d = utcDate(s); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
    function inTime(m) { if (m < 60) { return 'in ' + m + ' min'; } var h = Math.floor(m / 60), r = m % 60; return 'in ' + h + ' h' + (r ? ' ' + r + ' min' : ''); }
    // a colour that is safe inside style="" (hex, rgb() / rgba(), hsl() / hsla()), else the fallback
    function colour(c, fallback) {
        if (typeof c !== 'string') { return fallback; }
        c = c.replace(/^\s+|\s+$/g, '');
        return /^#[0-9a-fA-F]{3,8}$/.test(c) || /^(rgb|hsl)a?\([0-9.,%\s\/]+\)$/i.test(c) ? c : fallback;
    }
    // relative luminance (0 black … 1 white) of a hex / rgb(a) colour, alpha laid over white; null when unknown (hsl)
    function luminance(c) {
        var r, g, b, a = 1, m;
        if ((m = /^#([0-9a-f]{3,8})$/i.exec(c))) {
            var h = m[1];
            if (h.length === 3 || h.length === 4) { h = h.replace(/(.)/g, '$1$1'); }
            r = parseInt(h.substr(0, 2), 16); g = parseInt(h.substr(2, 2), 16); b = parseInt(h.substr(4, 2), 16);
            if (h.length === 8) { a = parseInt(h.substr(6, 2), 16) / 255; }
        } else if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,\/]+([\d.]+%?))?/i.exec(c))) {
            r = +m[1]; g = +m[2]; b = +m[3];
            if (m[4]) { a = m[4].indexOf('%') > -1 ? parseFloat(m[4]) / 100 : +m[4]; }
        } else { return null; }
        function ch(v) { v = (v * a + 255 * (1 - a)) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    }
    /* The style="" custom properties for an aircraft (--ac) or instructor (--av) colour. A light colour (a white
       aircraft is common) gets dark text on its mark (--ac-ink / --av-ink); a near-white one also gets a visible edge
       (--ac-edge / --av-edge), or it would vanish on white paper. Saturated colours: just the colour, as the mockup. */
    function cvars(k, c) {
        var l = luminance(c), out = '--' + k + ':' + c;
        if (l !== null && l > 0.5) { out += ';--' + k + '-ink:var(--tad-on-light)'; }
        if (l !== null && l > 0.8) { out += ';--' + k + '-edge:var(--tad-edge-light)'; }
        return out;
    }
    // a club logo the TV may draw: a data:image URI (as the day read sends it) or an http(s) URL
    function logoSrc(v) {
        if (typeof v !== 'string') { return null; }
        return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+\/=\s]+$/.test(v) || /^https?:\/\/[^\s"'<>]+$/.test(v) ? v : null;
    }
    function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function each(list, fn) { for (var i = 0; i < list.length; i++) { fn(list[i], i); } }
    function remPx() { return parseFloat(global.getComputedStyle(document.documentElement).fontSize) || 16; }
    function nowMs() { return new Date().getTime(); }
    function byStart(a, b) { return a.s - b.s; }

    /**
     * The club's options, every key present, from `base` (default: the defaults) overlaid with `over`. Every value may
     * arrive as a string (a URL's ?set=): pageturn is parsed and clamped to 5–60 s, on / off keys take true / false /
     * 1 / 0 too, theme takes 'night' for 'dark'; an unknown key or a value outside its options is ignored.
     */
    function normaliseSettings(over, base) {
        var out = {}, k, v;
        base = base || DEFAULTS;
        for (k in DEFAULTS) { if (hasOwn(DEFAULTS, k)) { out[k] = hasOwn(base, k) ? base[k] : DEFAULTS[k]; } }
        out = clean(out, DEFAULTS);
        if (!over || typeof over !== 'object') { return out; }
        return clean(over, out);

        function clean(src, into) {
            var res = {};
            for (k in into) { if (hasOwn(into, k)) { res[k] = into[k]; } }
            for (k in src) {
                if (!hasOwn(src, k) || !hasOwn(DEFAULTS, k)) { continue; }
                v = src[k];
                if (k === 'show_date') {   // null / '' = follow the rule; else a 'YYYY-MM-DD'
                    v = v === null || v === undefined ? '' : String(v).replace(/^\s+|\s+$/g, '');
                    if (v === '' || v === 'null') { res[k] = null; } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { res[k] = v; }
                    continue;
                }
                if (k === 'pageturn') {
                    v = parseInt(String(v), 10);
                    if (!isNaN(v)) { res[k] = Math.min(PAGE_MAX, Math.max(PAGE_MIN, v)); }
                    continue;
                }
                if (ON_OFF[k] && (v === true || v === 1)) { v = 'on'; }
                if (ON_OFF[k] && (v === false || v === 0)) { v = 'off'; }
                v = String(v === null || v === undefined ? '' : v).replace(/^\s+|\s+$/g, '').toLowerCase();
                if (ON_OFF[k] && (v === 'true' || v === '1')) { v = 'on'; }
                if (ON_OFF[k] && (v === 'false' || v === '0')) { v = 'off'; }
                if (k === 'theme' && v === 'night') { v = 'dark'; }
                if (OPTIONS[k].indexOf(v) > -1) { res[k] = v; }
            }
            return res;
        }
    }

    // ───────────────────────────── the day, in the renderer's terms ─────────────────────────────
    function buildModel(day, st, view) {
        var m = {
            date: day.date, mode: view.mode || 'today', now: (view.mode || 'today') === 'today' && typeof view.now === 'number' ? view.now : null,
            clock: view.clock || '', offline: view.offline || null, club: day.club || {}, fleet: [], ins: [], bookings: [],
            notices: day.notices || [], wx: day.weather || null
        };
        var byPlane = {}, byIns = {};
        each(day.fleet || [], function (f) {
            var a = { id: f.id, reg: String(f.registration || ''), type: String(f.type || ''), c: colour(f.colour, '#64748b') };
            a.vars = cvars('ac', a.c);
            byPlane[f.id] = a; m.fleet.push(a);
        });
        each(day.instructors || [], function (i) {
            var x = { id: i.id, name: String(i.name || ''), short: String(i.short || i.name || ''), code: String(i.code || ''),
                c: colour(i.colour, '#4285f4'), working: !!i.working, from: i.from || null, to: i.to || null };
            x.vars = cvars('av', x.c); x.rowVars = cvars('ac', x.c);
            byIns[i.id] = x; m.ins.push(x);
        });
        each(day.bookings || [], function (b) {
            var a = byPlane[b.plane_id];
            if (!a) { return; }
            var ins = b.instructor_id !== null && b.instructor_id !== undefined ? (byIns[b.instructor_id] || null) : null;
            var kind = KIND[b.kind] ? b.kind : (ins ? 'dual' : 'hire');
            var who = kind === 'maint' ? 'Maintenance' : (st.names === 'hidden' ? 'Booked' : String(b.who || 'Booked'));
            m.bookings.push({
                id: b.id, ac: a, ins: ins, kind: kind, who: who, s: minsOn(b.start, day.date), e: minsOn(b.end, day.date),
                start: String(b.start || '').substr(11, 5), end: String(b.end || '').substr(11, 5)
            });
        });
        m.dayWord = m.mode === 'tomorrow' ? 'tomorrow' : (m.mode === 'day' ? 'on ' + shortDate(m.date) : 'today');
        return m;
    }

    function shortReg(reg, fleet) {
        var n = 2;
        function clash(f) { return f.reg !== reg && f.reg.slice(-n) === reg.slice(-n); }
        while (n < 4 && fleet.some(clash)) { n++; }
        return reg.slice(-n);
    }
    function windowOf(m, st) {
        var now = m.now, first = toMin(m.club.open || '08:00'), last = m.club.close ? toMin(m.club.close) : 1200;
        each(m.bookings, function (b) { first = Math.min(first, Math.max(0, b.s)); last = Math.max(last, Math.min(1440, b.e)); });
        var s, e = Math.ceil(last / 60) * 60;
        if (now === null || st.window === 'day') { s = Math.floor(first / 60) * 60; }
        else { s = Math.max(Math.floor((now - 60) / 60) * 60, Math.floor(Math.min(first, now) / 60) * 60); }
        if (e - s < 360) { e = s + 360; }
        if (e > 1440) { e = 1440; s = Math.min(s, 1440 - 360); }
        return { s: s, e: e, now: now };
    }
    function pct(x, w) { return ((x - w.s) / (w.e - w.s) * 100).toFixed(3) + '%'; }
    function inWin(b, w) { return b.e > w.s && b.s < w.e; }

    /* Timeline rows, three ways (settings.rows):
       aircraft    — one row per aircraft, instructors as initials on the bookings;
       instructors — a row per instructor booked in the hours shown (their bookings, the aircraft as a tag), then a row per
                     aircraft only for the bookings WITHOUT an instructor (hire, maintenance, a trial with nobody);
       packed      — the instructor rows, then every booking without an instructor packed into as few shared lines as fit.
       A supervised solo (an instructor is on the booking) is the instructor's; it gets a second lane on their row when it
       overlaps their own flying. Aircraft with nothing booked stay in the green Free block. No booking is drawn twice. */
    function laneRow(row, bs) {
        var ends = [];
        row.bs = bs.slice().sort(byStart).map(function (b) {
            var i = 0;
            while (i < ends.length && b.s < ends[i]) { i++; }
            ends[i] = b.e;
            return { b: b, lane: i };
        });
        row.lanes = Math.max(1, ends.length);
        return row;
    }
    function buildRows(m, st, w) {
        var inw = m.bookings.filter(function (b) { return inWin(b, w); }), used = {}, items = [];
        each(inw, function (b) { used[b.ac.id] = true; });
        var mode = st.rows;
        if (mode === 'aircraft') {
            var idle = [];
            each(m.fleet, function (a) {
                var bs = inw.filter(function (b) { return b.ac === a; });
                if (!bs.length && st.idle === 'strip') { idle.push(a); } else { items.push(laneRow({ type: 'ac', ac: a }, bs)); }
            });
            return { items: items, free: idle, rows: items.length, heads: 0 };
        }
        var free = m.fleet.filter(function (a) { return !used[a.id]; });
        var insRows = [];
        each(m.ins, function (i) {
            var bs = inw.filter(function (b) { return b.ins === i; });
            if (bs.length || (st.insrows === 'working' && i.working)) { insRows.push(laneRow({ type: 'ins', ins: i }, bs)); }
        });
        var own = inw.filter(function (b) { return !b.ins; }), acRows = [];
        if (mode === 'instructors') {
            each(m.fleet, function (a) {
                var bs = own.filter(function (b) { return b.ac === a; });
                if (bs.length) { acRows.push(laneRow({ type: 'ac', ac: a }, bs)); }
            });
        } else {
            var lines = [];   // first fit by start time, 10 minutes clear between two bookings on a line
            own.slice().sort(byStart).forEach(function (b) {
                var s = Math.max(b.s, w.s), i = 0;
                while (i < lines.length && s < lines[i].end + 10) { i++; }
                if (!lines[i]) { lines[i] = { bs: [], end: 0 }; }
                lines[i].bs.push({ b: b, lane: 0 }); lines[i].end = b.e;
            });
            each(lines, function (l, i) { acRows.push({ type: 'line', first: i === 0, bs: l.bs, lanes: 1 }); });
        }
        if (insRows.length) {
            items.push({ grp: 'Instructors', ic: 'fa-chalkboard-teacher', sub: '· ' + insRows.length + (st.insrows === 'working' ? ' working ' : ' with bookings ') + m.dayWord });
            items = items.concat(insRows);
        }
        if (acRows.length) {
            items.push(mode === 'instructors'
                ? { grp: 'Aircraft', ic: 'fa-plane', sub: '· bookings without an instructor: hire, solo, maintenance' }
                : { grp: 'Hire, solo & maintenance', ic: 'fa-key', sub: '· every booking without an instructor, ' + own.length + ' on ' + acRows.length + (acRows.length === 1 ? ' line' : ' lines') });
            items = items.concat(acRows);
        }
        return { items: items, free: free, rows: insRows.length + acRows.length, heads: (insRows.length ? 1 : 0) + (acRows.length ? 1 : 0) };
    }
    function rk(r) { return r.lanes > 1 ? 1 + 0.8 * (r.lanes - 1) : 1; }   // a two-lane row is 1.8 rows tall: each lane still holds a name over its aircraft

    /* Pages: item lists that each fit `avail` px (and hold at most `maxRows` rows, to split evenly). A group heading never
       ends a page; a page that starts inside a group repeats its heading ("… (continued)"). */
    function paginate(items, avail, hOf, maxRows) {
        var pages = [], cur = [], acc = 0, rows = 0, grp = null;
        each(items, function (it, i) {
            if (it.grp) { grp = it; }
            var h = hOf(it), need = h + (it.grp && items[i + 1] ? hOf(items[i + 1]) : 0);
            if (cur.length && (acc + need > avail || (!it.grp && maxRows && rows >= maxRows))) {
                pages.push(cur); cur = []; acc = 0; rows = 0;
                if (!it.grp && grp) { var c = { grp: grp.grp + ' (continued)', ic: grp.ic, n: grp.n, sub: grp.sub }; cur.push(c); acc += hOf(c); }
            }
            cur.push(it); acc += h; if (!it.grp) { rows++; }
        });
        if (cur.length) { pages.push(cur); }
        return pages;
    }

    // ───────────────────────────── small pieces of markup ─────────────────────────────
    function av(i, lg) {
        return i ? '<span class="tad-av' + (lg ? ' tad-av--lg' : '') + '" style="' + i.vars + '" title="' + esc(i.name) + ' (instructor)">' + esc(i.code) + '</span>' : '';
    }
    function kindIc(k) { return '<span class="tad-kind tad-kind--' + k + '" title="' + KIND[k].label + '"><i class="fas ' + KIND[k].ic + '"></i></span>'; }
    function acchip(a, sm, until) {
        return '<span class="tad-acchip' + (sm ? ' tad-acchip--sm' : '') + '" style="' + a.vars + '">' + esc(a.reg) + '<small>' + esc(a.type) + '</small>' + (until ? '<em>' + until + '</em>' : '') + '</span>';
    }
    function kindLabel(b) { return KIND[b.kind].label; }

    /* A person's name is never cut (owner's standing rule for the TV). Every .tad-name — the instructor row labels, the
       names in the split panel and its sub-lines, the instructors card, the board's who / instructor columns — may wrap
       to two lines (tight leading). Still too big for two lines, its column, or its row (data-box="row")? First the
       short form when there is one (data-short: "T. Hennessey"), then smaller type, step by step. Never an ellipsis: in
       the impossible case that nothing fits, the name is let out of its box (tad-name--free) rather than clipped.
       A name that fits on one line is left exactly as drawn. */
    function fitNames(root) {
        each(Array.prototype.slice.call(root.querySelectorAll('.tad-name')), fitName);
    }
    function fitName(el) {
        var cs = global.getComputedStyle(el), base = parseFloat(cs.fontSize) || 16, short = el.getAttribute('data-short');
        var box = null;
        if (el.getAttribute('data-box') === 'row') {
            var p = el.parentNode;
            while (p && p.nodeType === 1 && !/(^|\s)tad-(row|brow)(\s|$)/.test(p.className)) { p = p.parentNode; }
            box = p && p.nodeType === 1 ? p.clientHeight : null;
        }
        function lineH() { var c = global.getComputedStyle(el); return parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.3; }
        function lines() { return Math.round(el.scrollHeight / lineH()); }
        function tight() { if (lines() > 1) { el.classList.add('tad-name--tight'); } else { el.classList.remove('tad-name--tight'); } }
        function bad() { return el.scrollWidth > el.clientWidth + 1 || lines() > 2 || (box !== null && el.offsetHeight > box + 1); }
        if (!bad() && lines() < 2) { return; }
        tight();
        // at each size the full name first, then the short form (a long surname is no shorter in "T. …")
        var full = el.textContent, sizes = [1, 0.88, 0.78, 0.68];
        for (var i = 0; i < sizes.length && bad(); i++) {
            if (i) { el.textContent = full; el.style.fontSize = (base * sizes[i]) + 'px'; tight(); }
            if (bad() && short && short !== full) { el.textContent = short; tight(); }
        }
        if (bad()) { el.classList.add('tad-name--free'); }
    }

    // ───────────────────────────── the display ─────────────────────────────
    function Display(el, opts) {
        var self = this;
        this.el = el;
        this.opts = opts || {};
        this.page = 0;
        this.pages = 1;
        this._pageStart = 0;
        this._pageTimer = null;
        this._args = null;
        this._resizeT = null;
        this._onResize = function () {
            if (self._resizeT) { clearTimeout(self._resizeT); }
            self._resizeT = setTimeout(function () { self._resizeT = null; if (self._args) { self._draw(); } }, 150);
        };
        global.addEventListener('resize', this._onResize);
    }

    Display.prototype.render = function (day, settings, view) {
        if (!day) { return; }
        this._args = { day: day, settings: normaliseSettings(settings || day.settings || {}), view: view || {} };
        this._draw();
    };

    Display.prototype.info = function () {
        return { page: this.page, pages: this.pages, rows: this.plan ? this.plan.rows : null, layout: this._args ? this._args.settings.layout : null };
    };

    Display.prototype.destroy = function () {
        if (this._pageTimer) { clearTimeout(this._pageTimer); this._pageTimer = null; }
        if (this._resizeT) { clearTimeout(this._resizeT); this._resizeT = null; }
        global.removeEventListener('resize', this._onResize);
        this._args = null;
        this._logo = null;
        this.el.innerHTML = '';
    };

    Display.prototype._draw = function () {
        var a = this._args, st = a.settings, m = buildModel(a.day, st, a.view);
        this.m = m; this.st = st;
        this.pageMs = st.pageturn * 1000;
        var lay = st.layout, showNotes = st.notices === 'on' && m.notices.length > 0 && m.mode !== 'tomorrow';
        var main = lay === 'board' ? this._board() : this._timeline();
        this.el.innerHTML = '<div class="tad' + (showNotes ? ' tad--notes' : '') + (st.theme === 'dark' ? ' tad--dark' : '') + '">' + this._header()
            + '<div class="tad-main' + (lay === 'timeline' ? '' : ' tad-main--side') + '">' + main + (lay === 'timeline' ? '' : this._side(lay === 'board')) + '</div>'
            + (showNotes ? this._notices() : '') + '</div>';
        if (!this.el.clientHeight) { this.pages = 1; this._schedulePage(); return; }   // hidden: fitted on the next resize / render
        var card = this.el.querySelector('.tad-tl, .tad-board');
        if (lay === 'board') { this._fitBoard(card); this._fillBoard(); } else { this._fitTimeline(card); this._fillTimeline(); }
        var side = this.el.querySelector('.tad-side');
        if (side) { fitNames(side); }
        this._trimSide();
        this._badgeLogo();
        this._placeCredit();
        this._schedulePage();
    };

    // pages turn every settings.pageturn seconds; a re-render (the clock, a new day) keeps the page and its timer
    Display.prototype._schedulePage = function () {
        var self = this;
        if (this._pageTimer) { clearTimeout(this._pageTimer); this._pageTimer = null; }
        if (this.pages < 2) { this._pageStart = 0; return; }
        if (!this._pageStart) { this._pageStart = nowMs(); }
        var left = Math.max(0, this.pageMs - (nowMs() - this._pageStart));
        this._pageTimer = setTimeout(function () {
            self._pageTimer = null;
            self.page = (self.page + 1) % self.pages;
            self._pageStart = nowMs();
            if (self.st.layout === 'board') { self._fillBoard(); } else { self._fillTimeline(); }
            self._placeCredit();
            self._schedulePage();
        }, left);
    };

    /* "Powered by [ToAviate logo] · Updated 15:35:02" (owner, 11 Nov): view.updated = the time of the last successful day read.
       It never costs a row: drawn after the layout, absolutely positioned, at the first spot where it touches nothing —
       the right end of the safety-notices strip, then of the free-aircraft strip (centred, then on its last / first line),
       then the page bar (left of its dots), then the empty ground under the cards, then a corner of the schedule area
       over a translucent paper backing; at each spot on one line, else stacked on two. Nowhere free: the bottom-right
       corner of the schedule area, above the bookings, translucent. */
    Display.prototype._placeCredit = function () {
        var root = this.el.querySelector('.tad'), upd = this._args && this._args.view.updated;
        each(Array.prototype.slice.call(this.el.querySelectorAll('.tad-by')), function (e) { e.parentNode.removeChild(e); });
        if (!root || !upd || !this.el.clientHeight) { return; }
        var logo = '<img class="tad-by__logo" src="' + esc(this.opts.logo || TOAVIATE_LOGO) + '" alt="ToAviate">';
        var rem = remPx(), html = '<span class="tad-by"><span class="tad-by__txt"><span class="tad-by__a">Powered by ' + logo + '</span><span class="tad-by__sep">&nbsp;·&nbsp;</span><span>Updated ' + esc(upd) + '</span></span></span>';
        function make(cls) { var d = document.createElement('div'); d.innerHTML = html; var e = d.firstChild; if (cls) { e.className += ' ' + cls; } return e; }
        function hits(r, obs) {
            for (var i = 0; i < obs.length; i++) {
                var o = obs[i].getBoundingClientRect();
                if (o.width && o.height && r.left < o.right + 3 && r.right > o.left - 3 && r.top < o.bottom + 2 && r.bottom > o.top - 2) { return true; }
            }
            return false;
        }
        function tryAt(box, obs, pos, cls) {
            var e = make(cls), k, b = box.getBoundingClientRect();
            for (k in pos) { if (hasOwn(pos, k)) { e.style[k] = pos[k]; } }
            box.appendChild(e);
            var r = e.getBoundingClientRect();
            if (r.left >= b.left && r.right <= b.right + 0.5 && r.top >= b.top && r.bottom <= b.bottom + 0.5 && !hits(r, obs)) { return true; }
            box.removeChild(e);
            return false;
        }
        function list(box, sel) { return Array.prototype.slice.call(box.querySelectorAll(sel)); }
        var mid = { right: '1rem', top: '50%', transform: 'translateY(-50%)' }, spots = [];
        var notes = root.querySelector('.tad-notes'), free = root.querySelector('.tad-free'), bar = root.querySelector('.tad-pagebar');
        if (notes) { spots.push([notes, list(notes, '.tad-notes__k, .tad-notes__i'), [mid], '']); }
        if (free) { spots.push([free, list(free, '.tad-free__k, .tad-acchip'), [mid, { right: '1rem', bottom: '0.62rem' }, { right: '1rem', top: '0.62rem' }], '']); }
        if (bar && !bar.hidden) {
            var dots = bar.querySelector('.tad-pages__dots'), gap = dots ? (bar.getBoundingClientRect().right - dots.getBoundingClientRect().left) / rem + 0.7 : 1;
            spots.push([bar, list(bar, 'span'), [{ right: gap.toFixed(2) + 'rem', top: '50%', transform: 'translateY(-50%)' }], '']);
        }
        var main = root.querySelector('.tad-main');
        if (main) { spots.push([main, list(main, '.tad-main > .tad-card, .tad-side > .tad-card'), [{ right: '0.2rem', bottom: '0.1rem' }], '']); }
        var body = root.querySelector('.tad-tl__body, .tad-board__body');
        if (body) {
            var obs = list(body, '.tad-chip, .tad-row__ac > *, .tad-brow > *, .tad-bgrp, .tad-grp, .tad-none');
            spots.push([body, obs, [{ right: '0.4rem', bottom: '0.3rem' }, { left: body.querySelector('.tad-row__ac') ? 'calc(var(--lab) + 0.4rem)' : '0.4rem', bottom: '0.3rem' }, { right: '0.4rem', top: '0.3rem' }], 'tad-by--over']);
        }
        for (var i = 0; i < spots.length; i++) {
            for (var j = 0; j < spots[i][2].length; j++) {
                if (tryAt(spots[i][0], spots[i][1], spots[i][2][j], spots[i][3])) { return; }
                if (tryAt(spots[i][0], spots[i][1], spots[i][2][j], (spots[i][3] + ' tad-by--stack').replace(/^ /, ''))) { return; }
            }
        }
        if (body) {   // nowhere free: over the schedule, translucent, bottom-right
            var e = make('tad-by--over tad-by--stack tad-by--busy');
            e.style.right = '0.4rem'; e.style.bottom = '0.3rem';
            body.appendChild(e);
        }
    };

    /* The club's logo in place of the initials tile (settings.badge 'logo' + club.logo, a data URI from the day read):
       the tile's own box height, up to three times as wide, object-fit contain; on a light plate in the dark theme. The
       tile stays until the image has loaded, and for good if it fails. The <img> is made once per logo and moved into each
       redraw (the minute's clock), so a large data URI is not decoded again. */
    Display.prototype._badgeLogo = function () {
        var slot = this.el.querySelector('.tad-badge__logo'), club = this.m.club, src = logoSrc(club.logo), self = this;
        if (!slot || !src) { return; }
        if (!this._logo || this._logo.src !== src) {
            var img = document.createElement('img'), state = { src: src, img: img, ok: null };
            img.className = 'tad-badge__img';
            img.alt = (club.name || 'Club') + ' logo';
            img.onload = function () { state.ok = true; self._badgeMark(); };
            img.onerror = function () { state.ok = false; self._badgeMark(); };
            this._logo = state;
            img.src = src;
        }
        slot.appendChild(this._logo.img);
        this._badgeMark();
    };
    Display.prototype._badgeMark = function () {
        var b = this.el.querySelector('.tad-badge'), st = this._logo;
        if (!b || !st) { return; }
        if (st.ok === true || (st.ok === null && st.img.complete && st.img.naturalWidth > 0)) { b.classList.add('tad-badge--logo'); }
        if (st.ok === false) { b.classList.remove('tad-badge--logo'); var s = b.querySelector('.tad-badge__logo'); if (s) { s.parentNode.removeChild(s); } }
    };

    // ── header ──
    Display.prototype._header = function () {
        var m = this.m, st = this.st, club = m.club;
        var live = m.offline
            ? '<span class="tad-hd__live tad-hd__live--off"><i class="tad-dot"></i>Offline · updated ' + esc(m.offline) + '</span>'
            : '<span class="tad-hd__live"><i class="tad-dot"></i>Live</span>';
        var sub = [club.icao, club.airfield].filter(function (x) { return !!x; }).join(' · ');
        var tile = '<span class="tad-mono">' + esc(club.mono || 'TA') + '</span>';
        var badge = st.badge === 'logo' && logoSrc(club.logo) ? '<span class="tad-badge">' + tile + '<span class="tad-badge__logo"></span></span>' : tile;
        return '<header class="tad-hd"><div class="tad-hd__club">' + badge + '<div><b class="tad-hd__name">' + esc(club.name || '') + '</b>'
            + (sub ? '<span class="tad-hd__sub">' + esc(sub) + '</span>' : '') + '</div></div>'
            // another day than today (owner, 11 Nov): a red TOMORROW (or the weekday + date) and no clock — the time of
            // day only makes sense on today's schedule
            + (m.mode === 'tomorrow' ? '<span class="tad-hd__mode tad-hd__mode--other"><i class="fas fa-moon"></i>TOMORROW</span>'
                : (m.mode === 'day' ? '<span class="tad-hd__mode tad-hd__mode--other"><i class="fas fa-calendar-day"></i>' + esc(longDate(m.date)).toUpperCase() + '</span>' : ''))
            + (st.weather === 'on' && m.wx ? this._wx(m.wx) : '')
            + '<div class="tad-hd__when"><div class="tad-hd__dl"><span class="tad-hd__date">' + longDate(m.date) + '</span>' + live + '</div>'
            + (m.mode === 'today' ? '<span class="tad-hd__clock">' + esc(m.clock) + '</span>' : '') + '</div></header>';
    };
    // weather in the header: the latest METAR of the club's airfield or the nearest station that reports, written out
    Display.prototype._wx = function (x) {
        var warn = x.warn || {}, dist = x.dist_nm ? ', ' + x.dist_nm + ' nm' : '';
        var hasDir = typeof x.dir === 'number', wind;
        if (!x.kt) { wind = 'Calm'; } else { wind = (hasDir ? ('00' + x.dir).slice(-3) + '°' : 'Variable') + ' ' + x.kt + ' kt' + (x.gust ? ' <em>gusting ' + x.gust + '</em>' : ''); }
        function val(v, suffix) { return v === null || v === undefined || v === '' ? '—' : esc(v) + (suffix || ''); }
        return '<div class="tad-hd__wx" title="' + esc((x.station || '') + ' ' + (x.name || '') + dist + ': ' + (x.raw || '')) + '">'
            + '<span class="tad-wx__cell tad-wx__cell--wind">' + (hasDir && x.kt ? '<svg class="tad-wx__arrow" style="--rot:' + (x.dir + 180) + 'deg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L18 20 L12 16 L6 20 Z" fill="currentColor"/></svg>' : '')
            + '<span><small>Wind · ' + esc(x.station || '') + (x.time ? ' ' + esc(x.time) : '') + '</small><b>' + wind + '</b></span></span>'
            + '<span class="tad-wx__cell' + (warn.vis ? ' tad-wx__cell--warn' : '') + '"><small>Visibility</small><b>' + val(x.vis) + '</b></span>'
            + '<span class="tad-wx__cell tad-wx__cell--cloud' + (warn.cloud ? ' tad-wx__cell--warn' : '') + '"><small>Cloud</small><b>' + val(x.cloud) + '</b></span>'
            + '<span class="tad-wx__cell"><small>QNH</small><b>' + val(x.qnh) + '</b></span>'
            + '<span class="tad-wx__cell"><small>Temp / dew</small><b>' + val(x.temp, '°') + ' / ' + val(x.dew, '°') + '</b></span></div>';
    };
    Display.prototype._notices = function () {
        return '<div class="tad-notes"><span class="tad-notes__k"><i class="fas fa-exclamation-triangle"></i>Safety notices</span>'
            + this.m.notices.map(function (n) { return '<span class="tad-notes__i">' + esc(n.title) + (n.until ? '<em>until ' + shortDate(n.until) + '</em>' : '') + '</span>'; }).join('') + '</div>';
    };
    Display.prototype._strips = function () {
        var m = this.m;
        // (no "tomorrow" sub-line: the header's Tomorrow label says it all; owner, 11 Nov)
        return (m.offline ? '<div class="tad-stale"><i class="fas fa-wifi"></i>This screen lost its connection at ' + esc(m.offline) + '. Bookings may have changed since; it updates as soon as the connection is back.</div>' : '');
    };

    // ── timeline ──
    // The bottom line: aircraft free for the rest of the day, then aircraft free NOW with the time their next booking
    // starts (longest free first) — the walk-in question, without a side panel.
    Display.prototype._freeBlock = function (free, label) {
        var m = this.m, now = m.now, idle = {}, soon = [];
        each(free, function (a) { idle[a.id] = true; });
        if (now !== null) {
            each(m.fleet, function (a) {
                if (idle[a.id]) { return; }
                var mine = m.bookings.filter(function (b) { return b.ac === a; });
                if (mine.some(function (b) { return b.s <= now && b.e > now; })) { return; }
                var nxt = mine.filter(function (b) { return b.s > now; }).sort(byStart)[0];
                if (nxt) { soon.push({ a: a, until: nxt.s, txt: nxt.start }); }
            });
            soon.sort(function (x, y) { return y.until - x.until; });
        }
        if (!free.length && !soon.length) { return ''; }
        return '<div class="tad-free">'
            + (free.length ? '<span class="tad-free__grp"><span class="tad-free__k"><i class="fas fa-check-circle"></i>' + label + '</span>' + free.map(function (a) { return acchip(a); }).join('') + '</span>' : '')
            + (soon.length ? '<span class="tad-free__grp tad-free__grp--now"><span class="tad-free__k"><i class="fas fa-clock"></i>Free now</span>' + soon.map(function (x) { return acchip(x.a, false, 'until ' + x.txt); }).join('') + '</span>' : '')
            + '</div>';
    };
    Display.prototype._timeline = function () {
        var m = this.m, st = this.st, w = windowOf(m, st), plan = buildRows(m, st, w), hours = '', lines = '';
        // hour labels step aside for the now-tag; on a long axis it needs more minutes of room
        for (var x = w.s; x <= w.e; x += 60) {
            if (x > w.s && x < w.e) { lines += '<i class="tad-hline" style="--l:' + pct(x, w) + '"></i>'; }
            if (x < w.e && !(w.now !== null && (Math.abs(x - w.now) < Math.max(25, (w.e - w.s) / 20) || (x === w.s && w.now - x < 60)))) {
                hours += '<span class="tad-tl__h' + (x === w.s ? ' tad-tl__h--first' : '') + '" style="--l:' + pct(x, w) + '">' + hhmm(x) + '</span>';
            }
        }
        var nowBits = w.now !== null && w.now > w.s && w.now < w.e;
        var label = m.mode === 'tomorrow' ? 'Free all day tomorrow' : (m.mode === 'day' ? 'Free all day' : (st.window === 'day' ? 'Free all day' : 'Free for the rest of the day'));
        var axisK = st.rows === 'aircraft' ? 'Aircraft' : (m.mode === 'tomorrow' ? 'Tomorrow' : (m.mode === 'day' ? shortDate(m.date) : 'Today'));
        this.plan = plan; this.w = w;
        return '<section class="tad-card tad-tl' + (st.rows === 'aircraft' ? '' : ' tad-tl--people') + '">'
            + '<div class="tad-tl__axis"><div class="tad-tl__axis-k">' + axisK + '</div><div class="tad-tl__hours">' + hours
            + (nowBits ? '<span class="tad-tl__nowtag" style="--l:' + pct(w.now, w) + '">' + esc(m.clock) + '</span>' : '') + '</div></div>'
            + this._strips()
            + '<div class="tad-tl__body"><div class="tad-tl__grid">' + (nowBits ? '<i class="tad-past" style="--l:' + pct(w.now, w) + '"></i>' : '') + lines
            + (nowBits ? '<i class="tad-now" style="--l:' + pct(w.now, w) + '"></i>' : '') + '</div><div class="tad-rows"></div></div>'
            + '<div class="tad-pagebar" hidden></div>'
            + this._freeBlock(plan.free, label) + '</section>';
    };
    /* One booking on the timeline. On an aircraft row the instructor rides as initials; on an instructor row or a shared
       hire line the aircraft rides as its mark (TJ on its colour) or its registration tag. */
    Display.prototype._chip = function (x, row) {
        var m = this.m, st = this.st, w = this.w, b = x.b, a = b.ac, tag = row.type !== 'ac';
        var s = Math.max(b.s, w.s), e = Math.min(b.e, w.e), past = w.now !== null && b.e <= w.now;
        var lane = row.lanes > 1 ? ';--lt:' + (x.lane / row.lanes).toFixed(4) + ';--lh:' + (1 / row.lanes).toFixed(4) + ';--lg:0.14rem' : '';
        var time = st.times === 'on' ? '<span class="tad-chip__time">' + b.start + '–' + b.end + '</span>' : '';
        var regEnd = tag && st.regpos === 'right';   // the registration at the right end of the booking, the name alone on its line
        var sr = esc(shortReg(a.reg, m.fleet));
        var reg = st.reg === 'circle' || st.reg === 'tile'
            ? '<span class="tad-acbadge' + (st.reg === 'tile' ? ' tad-acbadge--tile' : '') + (regEnd ? ' tad-acbadge--end' : '') + '" style="' + a.vars + '" title="' + esc(a.reg) + '">' + sr + '</span>'
            : '<span class="tad-chip__reg' + (regEnd ? ' tad-chip__reg--end' : '') + '" style="' + a.vars + '"><span class="tad-reg-full">' + esc(a.reg) + '</span><span class="tad-reg-short">' + sr + '</span></span>';
        var sub = tag && !regEnd ? '<span class="tad-chip__sub">' + reg + time + '</span>' : time;
        var stub = past && b.s < w.s;
        return '<div class="tad-chip tad-chip--' + b.kind + (tag ? ' tad-chip--tag' : '') + (st.reg === 'short' ? ' tad-chip--shortreg' : '') + (past ? ' tad-chip--past' : '') + (stub ? ' tad-chip--stub' : '')
            + '" style="--l:' + pct(s, w) + ';--w:' + ((e - s) / (w.e - w.s) * 100).toFixed(3) + '%;' + a.vars + lane + '" title="' + esc(b.who) + ' · ' + esc(a.reg) + ' · ' + b.start + '–' + b.end + '">'
            + kindIc(b.kind) + '<span class="tad-chip__txt"><span class="tad-chip__who">' + esc(b.who) + '</span>' + sub + '</span>'
            + (regEnd ? reg : '') + (!tag && b.ins ? av(b.ins) : '') + '</div>';
    };
    Display.prototype._row = function (r) {
        var self = this, label;
        if (r.grp) { return '<div class="tad-grp"><i class="fas ' + r.ic + '"></i>' + r.grp + (r.sub ? ' <span>' + esc(r.sub) + '</span>' : '') + '</div>'; }
        if (r.type === 'ins') { label = '<div class="tad-row__ac tad-row__ins" style="' + r.ins.rowVars + '">' + av(r.ins) + '<span class="tad-row__name tad-name" data-box="row"' + (r.ins.short && r.ins.short !== r.ins.name ? ' data-short="' + esc(r.ins.short) + '"' : '') + ' title="' + esc(r.ins.name) + '">' + esc(r.ins.name) + '</span></div>'; }
        else if (r.type === 'line') { label = '<div class="tad-row__ac tad-row__line">' + (r.first ? '<i class="fas fa-key"></i><span>Hire &amp; solo</span>' : '') + '</div>'; }
        else { label = '<div class="tad-row__ac" style="' + r.ac.vars + '"><span class="tad-row__reg">' + esc(r.ac.reg) + '</span><span class="tad-row__type">' + esc(r.ac.type) + '</span></div>'; }
        return '<div class="tad-row' + (r.lanes > 1 ? ' tad-row--lanes' : '') + '"' + (r.lanes > 1 ? ' style="--rk:' + rk(r) + '"' : '') + '>' + label
            + '<div class="tad-row__lane">' + r.bs.map(function (x) { return self._chip(x, r); }).join('') + '</div></div>';
    };
    /* Timeline fit: the rows share the height left after the axis, the strips, the headings and the free block, between a
       readable minimum and a comfortable maximum. Too many for the minimum → even pages (the page bar takes a line). A short
       list → the card ends after its last row instead of leaving an empty grid. */
    Display.prototype._fitTimeline = function (card) {
        var rem = remPx(), body = card.querySelector('.tad-tl__body'), bar = card.querySelector('.tad-pagebar');
        var items = this.plan.items, minPx = 2.3 * rem, hdrPx = 1.7 * rem, avail = body.clientHeight;
        var hOf = function (it) { return it.grp ? hdrPx : minPx * rk(it); };
        var pages = paginate(items, avail, hOf);
        if (pages.length > 1) {
            bar.hidden = false; bar.innerHTML = '&nbsp;'; avail = body.clientHeight;
            var p = paginate(items, avail, hOf).length;
            pages = paginate(items, avail, hOf, Math.ceil(this.plan.rows / p));
        }
        if (!pages.length) { pages = [[]]; }
        this.card = card; this.pageList = pages; this.pages = pages.length; this.avail = avail;
        if (this.page >= pages.length) { this.page = 0; this._pageStart = 0; }
    };
    Display.prototype._pageBar = function (from, to, total, noun) {
        var bar = this.card && this.card.querySelector('.tad-pagebar');
        if (!bar) { return; }
        if (this.pages < 2) { bar.hidden = true; return; }
        var dots = '';
        for (var i = 0; i < this.pages; i++) { dots += '<i class="' + (i === this.page ? 'on' : '') + '"></i>'; }
        var spent = this._pageStart ? Math.min(this.pageMs, nowMs() - this._pageStart) : 0;
        bar.hidden = false;
        bar.innerHTML = '<span><b>' + noun + ' ' + from + '–' + to + '</b> of ' + total + ' · the next page shows in ' + Math.round(this.pageMs / 1000) + ' s</span><span class="tad-pages__dots">' + dots + '</span>'
            + '<i class="tad-pages__bar" style="--page-ms:' + this.pageMs + 'ms;animation-delay:-' + spent + 'ms"></i>';
    };
    Display.prototype._fillTimeline = function () {
        var self = this, card = this.card, list = card.querySelector('.tad-rows');
        var rem = remPx(), pages = this.pageList, page = pages[this.page] || [];
        var isRow = function (x) { return !x.grp; }, rows = page.filter(isRow).length, hdrs = page.length - rows;
        var units = page.filter(isRow).reduce(function (t, r) { return t + rk(r); }, 0);
        var h = Math.min(3.8 * rem, Math.floor((this.avail - hdrs * 1.7 * rem) / Math.max(1, units)));
        card.style.setProperty('--row-h', h + 'px');
        card.classList.toggle('tad-tl--fit', this.pages === 1 && units > 0 && h * units + hdrs * 1.7 * rem < this.avail - 2);
        list.innerHTML = page.length ? page.map(function (r) { return self._row(r); }).join('')
            : '<p class="tad-none"><i class="fas fa-calendar-check"></i>Nothing booked ' + this.m.dayWord + '.</p>';
        var before = 0;
        for (var i = 0; i < this.page; i++) { before += pages[i].filter(isRow).length; }
        this._pageBar(before + 1, before + rows, this.plan.rows, 'Rows');
        fitNames(list);          // the row labels first: an unfitted long name stretches its row while the chips are measured
        this._fitChips(list);
    };
    // Names and aircraft are never cut (owner, 9 Nov). A booking too narrow for everything sheds, in order: its times (when
    // shown), the instructor initials, the full registration (when "G-BMTJ, TJ when tight"), the type icon; then smaller
    // type, the smallest type, a right-aligned aircraft mark dropping under the name, the name stacked over the aircraft,
    // and last the name wrapping. Measured on screen per booking.
    Display.prototype._fitChips = function (root) {
        var rem = remPx();
        var steps = ['tad-chip--notime', 'tad-chip--noav'].concat(this.st.reg === 'auto' ? ['tad-chip--shortreg'] : [])
            .concat(['tad-chip--noicon', 'tad-chip--small', 'tad-chip--tiny', 'tad-chip--endunder', 'tad-chip--stack', 'tad-chip--wrap']);
        var chips = Array.prototype.slice.call(root.querySelectorAll('.tad-chip')).filter(function (c) { return !c.classList.contains('tad-chip--stub'); });
        // a short booking (2.1rem or less inside) puts its name and aircraft / times on one line (the mockup's container query)
        var short = chips.map(function (c) { return c.clientHeight <= 2.1 * rem + 0.01; });
        each(chips, function (c, i) { if (short[i]) { c.classList.add('tad-chip--row'); } });
        // too big = the chip overflows, or the name runs under a right-aligned aircraft mark
        function over(c) {
            if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) { return true; }
            var n = c.querySelector('.tad-chip__who'), e = c.querySelector('.tad-acbadge--end, .tad-chip__reg--end');
            if (!n || !e) { return false; }
            var a = n.getBoundingClientRect(), b = e.getBoundingClientRect();   // the two boxes intersect (side by side AND on one line)
            return a.right > b.left + 1 && b.right > a.left + 1 && a.bottom > b.top + 1 && b.bottom > a.top + 1;
        }
        each(chips, function (c) {
            for (var i = 0; i < steps.length && over(c); i++) { c.classList.add(steps[i]); }
            if (over(c) && c.classList.contains('tad-chip--past')) { c.classList.add('tad-chip--stub'); return; }
            // a name is never cut: still too big after wrapping → smaller still, and last of all shown over the grid
            var who = c.querySelector('.tad-chip__who'), base = who ? parseFloat(global.getComputedStyle(who).fontSize) : 0;
            for (var j = 0, f = [0.88, 0.78, 0.68, 0.6]; who && j < f.length && over(c); j++) { who.style.fontSize = (base * f[j]) + 'px'; }
            if (over(c)) { c.classList.add('tad-chip--free'); }
        });
    };

    // ── side panel: flying now · next up · instructors (split) / free now · instructors (board), trimmed to the height ──
    Display.prototype._nowCard = function () {
        var m = this.m, now = m.now;
        var list = m.bookings.filter(function (b) { return b.kind !== 'maint' && b.s <= now && b.e > now; }).sort(function (a, b) { return a.e - b.e; });
        var items = list.slice(0, 6).map(function (b) {
            return '<li class="tad-li">' + acchip(b.ac) + '<span class="tad-li__main"><b class="tad-name">' + esc(b.who) + '</b><span class="tad-name">' + kindLabel(b) + (b.ins ? ' · ' + esc(b.ins.short) : '') + '</span></span><span class="tad-li__end">until<b>' + b.end + '</b></span></li>';
        }).join('');
        var next = m.bookings.filter(function (b) { return b.kind !== 'maint' && b.s > now; }).sort(byStart)[0];
        var empty = '<p class="tad-empty">Nobody is flying right now.' + (next ? ' First off: <b>' + next.start + ' · ' + esc(next.ac.reg) + '</b>' : '') + '</p>';
        return '<section class="tad-card"><div class="tad-card__h"><i class="fas fa-plane-departure"></i>Flying now<span class="tad-card__meta">' + (list.length ? list.length + (list.length === 1 ? ' booking' : ' bookings') : '') + '</span></div>'
            + (list.length ? '<ul class="tad-list" data-trim="now" data-total="' + list.length + '" data-more="more on the timeline">' + items + '</ul>' : empty) + '</section>';
    };
    Display.prototype._nextCard = function (title) {
        var m = this.m, now = m.now === null ? -100000 : m.now;
        var list = m.bookings.filter(function (b) { return b.kind !== 'maint' && b.s > now; }).sort(byStart);
        var items = list.slice(0, 6).map(function (b) {
            return '<li class="tad-li"><span class="tad-li__t">' + b.start + (m.now === null ? '' : '<small>' + inTime(b.s - now) + '</small>') + '</span><span class="tad-li__main"><b class="tad-name">' + esc(b.who) + '</b><span class="tad-name">' + esc(b.ac.reg) + ' · ' + kindLabel(b) + (b.ins ? ' · ' + esc(b.ins.short) : '') + '</span></span>'
                + (b.ins ? av(b.ins) : '<span></span>') + '</li>';
        }).join('');
        return '<section class="tad-card"><div class="tad-card__h"><i class="fas fa-clock"></i>' + title + '</div>'
            + (list.length ? '<ul class="tad-list" data-trim="next" data-total="' + list.length + '" data-more="more later">' + items + '</ul>' : '<p class="tad-empty">Nothing else booked ' + this.m.dayWord + '.</p>') + '</section>';
    };
    Display.prototype._insCard = function () {
        var m = this.m, now = m.now;
        var shown = m.ins.filter(function (i) { return i.working || m.bookings.some(function (b) { return b.ins === i; }); });
        var items = shown.map(function (i) {
            var first = i.name.split(' ')[0], txt, tone = '', off = false;
            var mine = m.bookings.filter(function (b) { return b.ins === i; });
            var cur = now === null ? null : mine.filter(function (b) { return b.s <= now && b.e > now; })[0];
            var nxt = now === null ? null : mine.filter(function (b) { return b.s > now; }).sort(byStart)[0];
            if (now === null) { txt = i.working ? i.from + '–' + i.to : 'Booked ' + m.dayWord; }
            else if (cur) { txt = 'Flying until ' + cur.end; tone = 'busy'; }
            else if (!i.working) { if (nxt) { txt = 'Next ' + nxt.start; } else { txt = 'Finished for today'; tone = 'off'; off = true; } }
            else if (now < toMin(i.from)) { txt = 'From ' + i.from; }
            else if (now >= toMin(i.to)) { txt = 'Finished for today'; tone = 'off'; off = true; }
            else if (nxt) { txt = 'Free · next ' + nxt.start; tone = 'good'; }
            else { txt = 'Free until ' + i.to; tone = 'good'; }
            return '<li' + (off ? ' class="tad-ins--off"' : '') + '>' + av(i, true) + '<div class="tad-ins__txt"><b class="tad-name">' + esc(first) + '</b><span' + (tone ? ' class="tad-st--' + tone + '"' : '') + '>' + txt + '</span></div></li>';
        }).join('');
        return '<section class="tad-card"><div class="tad-card__h"><i class="fas fa-chalkboard-teacher"></i>Instructors ' + m.dayWord + '</div><ul class="tad-ins">' + items + '</ul></section>';
    };
    // board layout: which aircraft are free right now, and until when (the walk-in question)
    Display.prototype._freeNowCard = function () {
        var m = this.m, now = m.now, items = [];
        each(m.fleet, function (a) {
            var mine = m.bookings.filter(function (b) { return b.ac === a; });
            if (now === null) { if (!mine.length) { items.push({ until: 99999, html: '<li>' + acchip(a) + '<span>all day</span></li>' }); } return; }
            if (mine.some(function (b) { return b.s <= now && b.e > now; })) { return; }
            var nxt = mine.filter(function (b) { return b.s > now; }).sort(byStart)[0];
            items.push({ until: nxt ? nxt.s : 99999, html: '<li>' + acchip(a) + '<span' + (nxt ? ' class="tad-faint"' : '') + '>' + (nxt ? 'until ' + nxt.start : 'rest of the day') + '</span></li>' });
        });
        // longest free first: the aircraft you could take now and keep
        items = items.sort(function (x, y) { return y.until - x.until; }).map(function (x) { return x.html; });
        return '<section class="tad-card"><div class="tad-card__h"><i class="fas fa-check-circle"></i>' + (now === null ? (m.mode === 'tomorrow' ? 'Free all day tomorrow' : 'Free all day') : 'Free now') + '<span class="tad-card__meta">' + items.length + ' aircraft</span></div>'
            + (items.length ? '<ul class="tad-freenow" data-trim="free" data-total="' + items.length + '" data-more="more free">' + items.join('') + '</ul>' : '<p class="tad-empty">Every aircraft is booked right now.</p>') + '</section>';
    };
    Display.prototype._side = function (board) {
        var m = this.m, st = this.st, h = '';
        if (!board) { h += m.now === null ? this._nextCard(m.mode === 'tomorrow' ? 'First flights tomorrow' : 'First flights') : this._nowCard() + this._nextCard('Next up'); }
        else { h += this._freeNowCard(); }
        h += board || st.rows === 'aircraft' ? this._insCard() : '';
        return '<aside class="tad-side">' + h + '</aside>';
    };
    // Cut list items until the panel fits: next up down to 2, flying now down to 3, then both down to 1. Each cut list ends
    // with "+ N more …" so nothing silently disappears.
    Display.prototype._trimSide = function () {
        var side = this.el.querySelector('.tad-side');
        if (!side) { return; }
        var plan = [['free', 4], ['next', 2], ['now', 3], ['free', 2], ['next', 1], ['now', 1]], guard = 80;
        function list(k) { return side.querySelector('[data-trim="' + k + '"]'); }
        function lis(l) { return Array.prototype.slice.call(l.children).filter(function (c) { return c.tagName === 'LI' && !c.classList.contains('tad-li--more'); }); }
        function more(l) {
            var shown = lis(l).length, total = parseInt(l.getAttribute('data-total'), 10), mo = l.querySelector('.tad-li--more');
            if (total > shown) {
                if (!mo) { mo = document.createElement('li'); mo.className = 'tad-li tad-li--more'; l.appendChild(mo); }
                mo.textContent = '+ ' + (total - shown) + ' ' + l.getAttribute('data-more');
            }
        }
        each(['now', 'next', 'free'], function (k) { if (list(k)) { more(list(k)); } });
        for (var p = 0; p < plan.length; p++) {
            var l = list(plan[p][0]);
            while (l && side.scrollHeight > side.clientHeight + 1 && lis(l).length > plan[p][1] && guard--) {
                var items = lis(l);
                l.removeChild(items[items.length - 1]);
                more(l);
            }
        }
    };

    // ── departures board ──
    Display.prototype._boardItems = function () {
        var m = this.m, now = m.now === null ? -100000 : m.now, out = [];
        var flying = m.bookings.filter(function (b) { return b.s <= now && b.e > now; }).sort(function (a, b) { return a.e - b.e; });
        var next = m.bookings.filter(function (b) { return b.s > now; }).sort(function (a, b) { return a.s - b.s || (a.ac.reg < b.ac.reg ? -1 : 1); });
        if (flying.length) { out.push({ grp: 'Now', ic: 'fa-plane-departure', n: flying.length }); each(flying, function (b) { out.push({ b: b, st: 'fly' }); }); }
        if (next.length) {
            out.push({ grp: m.mode === 'tomorrow' ? 'Tomorrow' : (m.mode === 'day' ? shortDate(m.date) : 'Later today'), ic: 'fa-clock', n: next.length });
            each(next, function (b) { out.push({ b: b, st: m.now === null ? 'later' : (b.s - now <= 30 ? 'soon' : 'later') }); });
        }
        return out;
    };
    Display.prototype._boardRow = function (it) {
        var m = this.m;
        if (it.grp) { return '<div class="tad-bgrp"><i class="fas ' + it.ic + '"></i>' + it.grp + ' <span>· ' + it.n + '</span></div>'; }
        var b = it.b, pill;
        if (b.kind === 'maint') { pill = '<span class="tad-pill"><i class="fas fa-wrench"></i>In maintenance</span>'; }
        else if (it.st === 'fly') { pill = '<span class="tad-pill tad-pill--fly"><i class="fas fa-plane"></i>Flying · until ' + b.end + '</span>'; }
        else if (it.st === 'soon') { pill = '<span class="tad-pill tad-pill--soon">' + inTime(b.s - m.now).replace(/^in/, 'In') + '</span>'; }
        else { pill = '<span class="tad-pill">' + (m.now === null ? (m.mode === 'tomorrow' ? 'Tomorrow' : shortDate(m.date)) : inTime(b.s - m.now).replace(/^in/, 'In')) + '</span>'; }
        return '<div class="tad-brow"><span class="tad-brow__t">' + b.start + ' – ' + b.end + '</span><span>' + acchip(b.ac) + '</span><span class="tad-brow__who">' + kindIc(b.kind) + '<b class="tad-name" data-box="row">' + esc(b.who) + '</b></span>'
            + '<span class="tad-brow__ins">' + (b.ins ? av(b.ins) + '<span class="tad-brow__iname tad-name" data-box="row">' + esc(b.ins.short) + '</span>' : '<span class="tad-faint">—</span>') + '</span><span class="tad-brow__st">' + pill + '</span></div>';
    };
    Display.prototype._board = function () {
        this.items = this._boardItems();
        return '<section class="tad-card tad-board"><div class="tad-board__head"><span>Time</span><span>Aircraft</span><span>Who</span><span>Instructor</span><span class="tad-board__st">Status</span></div>'
            + this._strips() + '<div class="tad-board__body"><div class="tad-rows"></div></div><div class="tad-pagebar" hidden></div></section>';
    };
    Display.prototype._fitBoard = function (card) {
        var rem = remPx(), body = card.querySelector('.tad-board__body'), bar = card.querySelector('.tad-pagebar');
        var hOf = function (it) { return (it.grp ? 2.1 : 2.75) * rem; };
        var pages = paginate(this.items, body.clientHeight, hOf);
        if (pages.length > 1) { bar.hidden = false; bar.innerHTML = '&nbsp;'; pages = paginate(this.items, body.clientHeight, hOf); }
        if (!pages.length) { pages = [[]]; }
        this.card = card; this.pageList = pages; this.pages = pages.length;
        this.plan = { rows: this.items.filter(function (x) { return !x.grp; }).length };
        if (this.page >= pages.length) { this.page = 0; this._pageStart = 0; }
    };
    Display.prototype._fillBoard = function () {
        var self = this, pages = this.pageList, page = pages[this.page] || [], list = this.card.querySelector('.tad-rows');
        var isRow = function (x) { return !x.grp; };
        list.innerHTML = page.length ? page.map(function (it) { return self._boardRow(it); }).join('')
            : '<p class="tad-none"><i class="fas fa-calendar-check"></i>Nothing else booked ' + this.m.dayWord + '.</p>';
        var before = 0;
        for (var i = 0; i < this.page; i++) { before += pages[i].filter(isRow).length; }
        this._pageBar(before + 1, before + page.filter(isRow).length, this.plan.rows, 'Bookings');
        fitNames(list);
    };

    // ───────────────────────────── export ─────────────────────────────
    var api = {
        version: VERSION,
        create: function (el, opts) { return new Display(el, opts); },
        settings: function (over, base) { return normaliseSettings(over, base); },
        defaults: function () { return normaliseSettings({}); },
        options: OPTIONS,
        kinds: KIND,
        utils: { escapeHtml: esc, minutesOn: minsOn, longDate: longDate, shortDate: shortDate }
    };
    global.ToAviateDisplay = api;
})(typeof window !== 'undefined' ? window : this);
