/*!
 * ToAviateDatePicker — framework-agnostic date picker for the ToAviate app.
 *
 * Ported from mockups/scheduler-date-picker.html (the agreed design):
 * month-name button zooms days -> months -> years, busy dots, today ring,
 * gradient selected day, dimmed-but-pickable past, weekend tint, club options,
 * keyboard (arrows / Home / End / PageUp / PageDown / Enter / Escape), light +
 * night themes (CSS custom properties on .tadp, body.night-mode overrides).
 *
 * Contract: backend/FRONTEND_SCHEDULER_V2_GUIDE.md section 4.
 *
 *   var p = ToAviateDatePicker.create(hostEl, opts);     // inline / in your own container
 *   var a = ToAviateDatePicker.attach(buttonEl, opts);   // popover under a button (bottom sheet < 480px)
 *
 * Dates are strings 'YYYY-MM-DD' (local time) at every API boundary — no Date
 * objects leak in or out. No dependencies. ES5 only (babel + uglify downstream).
 * CSS: libs/css/toaviate-datepicker.css
 */
(function (window, document) {
    'use strict';

    var VERSION = '1.0.0';

    // ─────────────────────────────────────────────────────────────────────
    // Defaults (every string the picker renders is in `locale`, escapable)
    // ─────────────────────────────────────────────────────────────────────
    var DEFAULT_LOCALE = {
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        weekdaysShort: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
        week: 'wk',
        today: 'Today',
        tomorrow: 'Tomorrow',
        thisSaturday: 'This Saturday',
        nextWeek: 'Next week',
        done: 'Done',
        previous: 'Previous',
        next: 'Next',
        changeMonth: 'Change month or year',
        pickADate: 'Pick a date',
        close: 'Close'
    };

    var DEFAULTS = {
        value: null,          // 'YYYY-MM-DD' (default: today)
        weekStart: 1,         // 1 = Monday, 0 = Sunday
        weekNumbers: false,   // ISO week column
        dots: true,           // busy dots from getBusy()
        otherDays: true,      // show the grey padding days of adjacent months
        weekends: true,       // tint Sat / Sun
        allowPast: true,      // false disables days before today
        shortcuts: true,      // Today · Tomorrow · This Saturday · Next week
        doneButton: false,    // picking only highlights; Done confirms (onPick(d, true))
        inline: false,        // borderless, full-width, 1fr cells
        min: null,            // 'YYYY-MM-DD' inclusive
        max: null,            // 'YYYY-MM-DD' inclusive
        today: null,          // 'YYYY-MM-DD' override (tests / fixed-clock harnesses)
        locale: null,         // partial override of DEFAULT_LOCALE
        getBusy: null,        // function (dateStr) -> 0..3, synchronous (call refresh() when data arrives)
        onPick: null,         // function (dateStr, done)
        onMonthChange: null,  // function ('YYYY-MM')  — on create and whenever the visible month changes
        onEscape: null        // function ()           — Escape pressed in the days view (attach() closes)
    };

    var ATTACH_DEFAULTS = {
        sheet: 'auto',        // 'auto' (below sheetBreakpoint) | true | false
        sheetBreakpoint: 480, // px — viewport (or container) width under which the popover becomes a bottom sheet
        container: null,      // element to position within (default: document.body, fixed to the viewport)
        placement: 'auto',    // 'auto' | 'below' | 'above'
        offset: 10,           // px gap between the button and the popover
        closeOnPick: null,    // default: true unless doneButton (then only Done closes)
        onOpen: null,
        onClose: null
    };

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────
    function extend(target) {
        for (var i = 1; i < arguments.length; i++) {
            var src = arguments[i];
            if (!src) { continue; }
            for (var k in src) { if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) { target[k] = src[k]; } }
        }
        return target;
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function D(y, m, d) { return new Date(y, m, d); }

    function fmt(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

    function fmtMonth(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

    function parse(s) {
        if (s instanceof Date) { return isNaN(s.getTime()) ? null : D(s.getFullYear(), s.getMonth(), s.getDate()); }
        if (typeof s !== 'string') { return null; }
        var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s.trim());
        if (!m) { return null; }
        var d = D(+m[1], +m[2] - 1, +m[3]);
        return isNaN(d.getTime()) ? null : d;
    }

    function same(a, b) { return !!(a && b) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    function addDays(d, n) { var x = D(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }

    function isoWeek(d) {
        var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        var day = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - day);
        var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        return Math.ceil(((t - y0) / 86400000 + 1) / 7);
    }

    function longDate(d, loc) {
        loc = loc || DEFAULT_LOCALE;
        return loc.weekdays[d.getDay()] + ' ' + d.getDate() + ' ' + loc.months[d.getMonth()] + ' ' + d.getFullYear();
    }
    // "Tue 3 Nov 2026" — for forms where two dates share a row
    function shortDate(d, loc) {
        loc = loc || DEFAULT_LOCALE;
        var wd = loc.weekdaysMid ? loc.weekdaysMid[d.getDay()] : loc.weekdays[d.getDay()].slice(0, 3);
        return wd + ' ' + d.getDate() + ' ' + loc.monthsShort[d.getMonth()] + ' ' + d.getFullYear();
    }

    function todayDate(o) { var t = o.today ? parse(o.today) : null; if (!t) { var n = new Date(); t = D(n.getFullYear(), n.getMonth(), n.getDate()); } return t; }

    function matches(el, sel) {
        var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
        return fn ? fn.call(el, sel) : false;
    }

    function closest(el, sel, stopAt) {
        while (el && el.nodeType === 1) {
            if (matches(el, sel)) { return el; }
            if (el === stopAt) { return null; }
            el = el.parentNode;
        }
        return null;
    }

    function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts || false); return function () { el.removeEventListener(ev, fn, opts || false); }; }

    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function svgChevron(dir) {
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
            (dir < 0 ? 'M10 3.5 5.5 8 10 12.5' : 'M6 3.5 10.5 8 6 12.5') + '"/></svg>';
    }

    // ─────────────────────────────────────────────────────────────────────
    // The picker
    // ─────────────────────────────────────────────────────────────────────
    function create(host, opts) {
        if (!host || host.nodeType !== 1) { throw new Error('ToAviateDatePicker.create: host element required'); }
        var o = extend({}, DEFAULTS, opts);
        var loc = extend({}, DEFAULT_LOCALE, o.locale);
        var sel = parse(o.value) || todayDate(o);
        var view = 'days';
        var cur = D(sel.getFullYear(), sel.getMonth(), 1);
        var anim = '';
        var lastMonthNotified = null;
        var destroyed = false;
        var unbind = [];

        var el = document.createElement('div');
        el.className = 'tadp';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', loc.pickADate);
        host.appendChild(el);

        function cb(name) {
            var fn = o[name];
            if (typeof fn !== 'function') { return; }
            var args = Array.prototype.slice.call(arguments, 1);
            try { fn.apply(null, args); } catch (e) { if (window.console && console.error) { console.error('ToAviateDatePicker ' + name, e); } }
        }

        function busyFor(d) {
            if (typeof o.getBusy !== 'function') { return 0; }
            var n;
            try { n = o.getBusy(fmt(d)); } catch (e) { n = 0; }
            n = Number(n);
            if (!isFinite(n) || n <= 0) { return 0; }
            return Math.min(3, Math.floor(n));
        }

        function isOff(ds, past) {
            if (past && !o.allowPast) { return true; }
            if (o.min && ds < o.min) { return true; }
            if (o.max && ds > o.max) { return true; }
            return false;
        }

        function yearPage() { return Math.floor(cur.getFullYear() / 12) * 12; }

        // ── render ──────────────────────────────────────────────────────
        function render(focusSel) {
            if (destroyed) { return; }
            var TODAY = todayDate(o);
            var hadFocus = el.contains(document.activeElement);
            el.className = 'tadp' + (o.weekNumbers ? ' tadp--weeknums' : '') + (o.inline ? ' tadp--inline' : '') + ' tadp--' + view;

            var title;
            if (view === 'days') {
                title = esc(loc.months[cur.getMonth()]) + ' <span class="tadp__yr">' + cur.getFullYear() + '</span>';
            } else if (view === 'months') {
                title = String(cur.getFullYear());
            } else {
                title = yearPage() + ' – ' + (yearPage() + 11);
            }

            var prevOff = false, nextOff = false;
            if (view === 'days') {
                if (o.min) { prevOff = fmt(D(cur.getFullYear(), cur.getMonth(), 0)) < o.min; }
                if (o.max) { nextOff = fmt(D(cur.getFullYear(), cur.getMonth() + 1, 1)) > o.max; }
            }

            var html = '<div class="tadp__hd">' +
                '<button type="button" class="tadp__nav" data-nav="-1" aria-label="' + esc(loc.previous) + '"' + (prevOff ? ' disabled' : '') + '>' + svgChevron(-1) + '</button>' +
                '<button type="button" class="tadp__title" data-zoom aria-label="' + esc(loc.changeMonth) + '">' + title + ' <span class="tadp__caret" aria-hidden="true">▾</span></button>' +
                '<button type="button" class="tadp__nav" data-nav="1" aria-label="' + esc(loc.next) + '"' + (nextOff ? ' disabled' : '') + '>' + svgChevron(1) + '</button>' +
                '</div>';

            if (view === 'days') {
                html += '<div class="tadp__wd" aria-hidden="true">' + (o.weekNumbers ? '<span class="tadp__wk">' + esc(loc.week) + '</span>' : '');
                for (var i = 0; i < 7; i++) {
                    var wd = (o.weekStart + i) % 7;
                    html += '<span' + (o.weekends && (wd === 0 || wd === 6) ? ' class="tadp__we"' : '') + '>' + esc(loc.weekdaysShort[wd]).toUpperCase() + '</span>';
                }
                html += '</div><div class="tadp__view ' + anim + '"><div class="tadp__days" role="grid">';

                var first = D(cur.getFullYear(), cur.getMonth(), 1);
                var offset = (first.getDay() - o.weekStart + 7) % 7;
                var start = addDays(first, -offset);

                // roving tabindex: the selected day if visible, else today, else the 1st
                var tabTarget = null;
                var selVisible = sel.getMonth() === cur.getMonth() && sel.getFullYear() === cur.getFullYear();
                var todayVisible = TODAY.getMonth() === cur.getMonth() && TODAY.getFullYear() === cur.getFullYear();
                if (selVisible && !isOff(fmt(sel), sel < TODAY && !same(sel, TODAY))) { tabTarget = fmt(sel); }
                else if (todayVisible && !isOff(fmt(TODAY), false)) { tabTarget = fmt(TODAY); }
                else {
                    for (var dd = 1; dd <= 31 && !tabTarget; dd++) {
                        var cand = D(cur.getFullYear(), cur.getMonth(), dd);
                        if (cand.getMonth() !== cur.getMonth()) { break; }
                        if (!isOff(fmt(cand), cand < TODAY && !same(cand, TODAY))) { tabTarget = fmt(cand); }
                    }
                }

                for (var r = 0; r < 6; r++) {
                    if (o.weekNumbers) {
                        html += '<span class="tadp__wkn" aria-hidden="true">' + isoWeek(addDays(start, r * 7 + (o.weekStart === 1 ? 0 : 1))) + '</span>';
                    }
                    for (var c = 0; c < 7; c++) {
                        var d = addDays(start, r * 7 + c);
                        var ds = fmt(d);
                        var other = d.getMonth() !== cur.getMonth();
                        var isToday = same(d, TODAY);
                        var past = d < TODAY && !isToday;
                        var off = isOff(ds, past);
                        var isSel = same(d, sel);
                        var n = (o.dots && !other) ? busyFor(d) : 0;
                        var dots = '';
                        for (var k = 0; k < n; k++) { dots += '<i></i>'; }
                        var cls = 'tadp__d' +
                            (other ? ' tadp__d--other' + (o.otherDays ? '' : ' tadp__d--hide') : '') +
                            (isToday ? ' tadp__d--today' : '') +
                            (isSel ? ' tadp__d--sel' : '') +
                            (past ? ' tadp__d--past' : '') +
                            (off ? ' tadp__d--off' : '') +
                            (o.weekends && (d.getDay() === 0 || d.getDay() === 6) ? ' tadp__d--we' : '') +
                            (n ? ' tadp__d--busy' + n : '');
                        html += '<button type="button" class="' + cls + '" data-d="' + ds + '"' +
                            (off || (other && !o.otherDays) ? ' disabled' : '') +
                            ' tabindex="' + (ds === tabTarget ? '0' : '-1') + '"' +
                            (isSel ? ' aria-current="date" aria-selected="true"' : '') +
                            ' aria-label="' + esc(longDate(d, loc)) + (n ? ', ' + n + (n === 1 ? ' dot' : ' dots') : '') + '">' +
                            '<span>' + d.getDate() + '</span><span class="tadp__dots" aria-hidden="true">' + dots + '</span></button>';
                    }
                }
                html += '</div></div>';
            } else if (view === 'months') {
                html += '<div class="tadp__view ' + anim + '"><div class="tadp__months" role="grid">';
                for (var m = 0; m < 12; m++) {
                    var mPast = cur.getFullYear() < TODAY.getFullYear() || (cur.getFullYear() === TODAY.getFullYear() && m < TODAY.getMonth());
                    var mSel = sel.getFullYear() === cur.getFullYear() && sel.getMonth() === m;
                    var mNow = cur.getFullYear() === TODAY.getFullYear() && m === TODAY.getMonth();
                    html += '<button type="button" class="tadp__m' + (mNow ? ' tadp__m--now' : '') + (mSel ? ' tadp__m--sel' : '') + (mPast ? ' tadp__m--past' : '') + '"' +
                        ' data-m="' + m + '" tabindex="' + (mSel || (!selVisibleYear() && mNow) || (!selVisibleYear() && !hasNowYear() && m === 0) ? '0' : '-1') + '"' +
                        ' aria-label="' + esc(loc.months[m]) + ' ' + cur.getFullYear() + '">' + esc(loc.monthsShort[m]) + '</button>';
                }
                html += '</div></div>';
            } else {
                var y0 = yearPage();
                var selInPage = sel.getFullYear() >= y0 && sel.getFullYear() < y0 + 12;
                var nowInPage = TODAY.getFullYear() >= y0 && TODAY.getFullYear() < y0 + 12;
                html += '<div class="tadp__view ' + anim + '"><div class="tadp__years" role="grid">';
                for (var y = y0; y < y0 + 12; y++) {
                    var tab = selInPage ? y === sel.getFullYear() : nowInPage ? y === TODAY.getFullYear() : y === y0;
                    html += '<button type="button" class="tadp__y' + (y === TODAY.getFullYear() ? ' tadp__y--now' : '') + (y === sel.getFullYear() ? ' tadp__y--sel' : '') + (y < TODAY.getFullYear() ? ' tadp__y--past' : '') + '"' +
                        ' data-y="' + y + '" tabindex="' + (tab ? '0' : '-1') + '">' + y + '</button>';
                }
                html += '</div></div>';
            }

            if (o.shortcuts || o.doneButton) {
                html += '<div class="tadp__ft">';
                if (o.shortcuts) {
                    var sat = TODAY; while (sat.getDay() !== 6) { sat = addDays(sat, 1); }
                    html += shortcutBtn('0', TODAY, loc.today, TODAY) + shortcutBtn('1', addDays(TODAY, 1), loc.tomorrow, TODAY) +
                        shortcutBtn('sat', sat, loc.thisSaturday, TODAY) + shortcutBtn('7', addDays(TODAY, 7), loc.nextWeek, TODAY);
                }
                if (o.doneButton) { html += '<span class="tadp__sp"></span><button type="button" class="tadp__done" data-done>' + esc(loc.done) + '</button>'; }
                html += '</div>';
            }

            el.innerHTML = html;
            anim = '';

            // keep focus inside after a re-render (the popover's focus trap depends on it)
            if (focusSel || hadFocus) {
                var f = (focusSel && el.querySelector(focusSel)) || el.querySelector('[tabindex="0"]') || el.querySelector('.tadp__title');
                if (f && !f.disabled) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
            }

            if (view === 'days') {
                var ym = fmtMonth(cur);
                if (ym !== lastMonthNotified) { lastMonthNotified = ym; cb('onMonthChange', ym); }
            }
        }

        function selVisibleYear() { return sel.getFullYear() === cur.getFullYear(); }
        function hasNowYear() { return todayDate(o).getFullYear() === cur.getFullYear(); }

        function shortcutBtn(jump, d, label, TODAY) {
            var off = isOff(fmt(d), d < TODAY && !same(d, TODAY));
            return '<button type="button" class="tadp__sc" data-jump="' + jump + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(label) + ', ' + esc(longDate(d, loc)) + '">' + esc(label) + '</button>';
        }

        function pick(d, fromDone) {
            sel = d;
            cur = D(d.getFullYear(), d.getMonth(), 1);
            view = 'days';
            render('[data-d="' + fmt(d) + '"]');
            cb('onPick', fmt(d), !!fromDone);
        }

        // ── events (delegated) ─────────────────────────────────────────
        unbind.push(on(el, 'click', function (e) {
            var t;
            if ((t = closest(e.target, '[data-nav]', el))) {
                if (t.disabled) { return; }
                var n = +t.getAttribute('data-nav');
                anim = n > 0 ? 'tadp__view--slide-l' : 'tadp__view--slide-r';
                if (view === 'days') { cur = D(cur.getFullYear(), cur.getMonth() + n, 1); }
                else if (view === 'months') { cur = D(cur.getFullYear() + n, cur.getMonth(), 1); }
                else { cur = D(cur.getFullYear() + n * 12, cur.getMonth(), 1); }
                render('[data-nav="' + n + '"]');
                return;
            }
            if ((t = closest(e.target, '[data-zoom]', el))) {
                view = view === 'days' ? 'months' : view === 'months' ? 'years' : 'days';
                anim = 'tadp__view--zoom';
                render('[data-zoom]');
                return;
            }
            if ((t = closest(e.target, '.tadp__d', el))) {
                if (t.disabled) { return; }
                var dd = parse(t.getAttribute('data-d'));
                if (dd) { pick(dd); }
                return;
            }
            if ((t = closest(e.target, '.tadp__m', el))) {
                cur = D(cur.getFullYear(), +t.getAttribute('data-m'), 1); view = 'days'; anim = 'tadp__view--zoom'; render('[tabindex="0"]'); return;
            }
            if ((t = closest(e.target, '.tadp__y', el))) {
                cur = D(+t.getAttribute('data-y'), cur.getMonth(), 1); view = 'months'; anim = 'tadp__view--zoom'; render('[tabindex="0"]'); return;
            }
            if ((t = closest(e.target, '[data-jump]', el))) {
                if (t.disabled) { return; }
                var TODAY = todayDate(o), j = t.getAttribute('data-jump'), jd = TODAY;
                if (j === 'sat') { while (jd.getDay() !== 6) { jd = addDays(jd, 1); } } else { jd = addDays(TODAY, +j); }
                pick(jd);
                return;
            }
            if (closest(e.target, '[data-done]', el)) { cb('onPick', fmt(sel), true); }
        }));

        unbind.push(on(el, 'keydown', function (e) {
            var key = e.key, f = document.activeElement, step;
            if (key === 'Escape' || key === 'Esc') {
                if (view !== 'days') { e.preventDefault(); e.stopPropagation(); view = 'days'; anim = 'tadp__view--zoom'; render('[data-zoom]'); return; }
                if (typeof o.onEscape === 'function') { e.preventDefault(); e.stopPropagation(); cb('onEscape'); }
                return;
            }
            if (key === 'PageUp' || key === 'PageDown') {
                e.preventDefault();
                var dir = key === 'PageUp' ? -1 : 1;
                anim = dir < 0 ? 'tadp__view--slide-r' : 'tadp__view--slide-l';
                if (view === 'days') { cur = e.shiftKey ? D(cur.getFullYear() + dir, cur.getMonth(), 1) : D(cur.getFullYear(), cur.getMonth() + dir, 1); }
                else if (view === 'months') { cur = D(cur.getFullYear() + dir, cur.getMonth(), 1); }
                else { cur = D(cur.getFullYear() + dir * 12, cur.getMonth(), 1); }
                render(f && f.getAttribute('data-d') ? '[tabindex="0"]' : null);
                return;
            }
            if (view === 'days') {
                if (!f || !f.classList.contains('tadp__d')) { return; }
                step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
                var from = parse(f.getAttribute('data-d'));
                if (!from) { return; }
                var target = null;
                if (step) { target = addDays(from, step); }
                else if (key === 'Home') { target = D(from.getFullYear(), from.getMonth(), 1); }
                else if (key === 'End') { target = D(from.getFullYear(), from.getMonth() + 1, 0); }
                if (!target) { return; }
                e.preventDefault();
                if (target.getMonth() !== cur.getMonth() || target.getFullYear() !== cur.getFullYear()) {
                    anim = target < cur ? 'tadp__view--slide-r' : 'tadp__view--slide-l';
                    cur = D(target.getFullYear(), target.getMonth(), 1);
                    render();
                }
                var q = el.querySelector('[data-d="' + fmt(target) + '"]');
                if (q && !q.disabled) {
                    // move the roving tabindex with the focus
                    var old = el.querySelector('.tadp__d[tabindex="0"]');
                    if (old) { old.setAttribute('tabindex', '-1'); }
                    q.setAttribute('tabindex', '0');
                    q.focus();
                }
                return;
            }
            // months / years: a 3-column grid
            var cellSel = view === 'months' ? '.tadp__m' : '.tadp__y';
            if (!f || !matches(f, cellSel)) { return; }
            step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[key];
            if (!step) { return; }
            e.preventDefault();
            var cells = el.querySelectorAll(cellSel), idx = -1;
            for (var i = 0; i < cells.length; i++) { if (cells[i] === f) { idx = i; break; } }
            var ni = idx + step;
            if (ni < 0 || ni >= cells.length) {
                anim = step < 0 ? 'tadp__view--slide-r' : 'tadp__view--slide-l';
                cur = view === 'months' ? D(cur.getFullYear() + (step < 0 ? -1 : 1), cur.getMonth(), 1) : D(cur.getFullYear() + (step < 0 ? -12 : 12), cur.getMonth(), 1);
                render();
                cells = el.querySelectorAll(cellSel);
                ni = (ni + cells.length) % cells.length;
            }
            for (var j2 = 0; j2 < cells.length; j2++) { cells[j2].setAttribute('tabindex', j2 === ni ? '0' : '-1'); }
            cells[ni].focus();
        }));

        render();

        // ── public ──────────────────────────────────────────────────────
        var api = {
            el: el,
            getValue: function () { return fmt(sel); },
            setValue: function (v) {           // never fires onPick — this is the host telling the picker
                var d = parse(v);
                if (!d) { return api; }
                sel = d; cur = D(d.getFullYear(), d.getMonth(), 1); view = 'days';
                render();
                return api;
            },
            set: function (k, v) { o[k] = v; if (k === 'locale') { loc = extend({}, DEFAULT_LOCALE, v); } render(); return api; },
            setOptions: function (obj) { extend(o, obj); if (obj && obj.locale) { loc = extend({}, DEFAULT_LOCALE, obj.locale); } render(); return api; },
            getOption: function (k) { return o[k]; },
            refresh: function () { render(); return api; },
            getView: function () { return view; },
            setView: function (v) { if (v === 'days' || v === 'months' || v === 'years') { view = v; anim = 'tadp__view--zoom'; render(); } return api; },
            getMonth: function () { return fmtMonth(cur); },
            showMonth: function (ym) {
                var m = /^(\d{4})-(\d{1,2})/.exec(String(ym || ''));
                if (m) { cur = D(+m[1], +m[2] - 1, 1); view = 'days'; render(); }
                return api;
            },
            focus: function () { var f = el.querySelector('.tadp__d[tabindex="0"]') || el.querySelector('[tabindex="0"]') || el.querySelector('.tadp__title'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } } return api; },
            destroy: function () {
                if (destroyed) { return; }
                destroyed = true;
                for (var i = 0; i < unbind.length; i++) { unbind[i](); }
                unbind = [];
                if (el.parentNode) { el.parentNode.removeChild(el); }
            }
        };
        return api;
    }

    // ─────────────────────────────────────────────────────────────────────
    // attach(buttonEl, opts) — popover under a button / bottom sheet
    // ─────────────────────────────────────────────────────────────────────
    function attach(button, opts) {
        if (!button || button.nodeType !== 1) { throw new Error('ToAviateDatePicker.attach: button element required'); }
        var ao = extend({}, ATTACH_DEFAULTS);
        var po = {};
        var k;
        for (k in opts || {}) {
            if (!Object.prototype.hasOwnProperty.call(opts, k)) { continue; }
            if (Object.prototype.hasOwnProperty.call(ATTACH_DEFAULTS, k)) { ao[k] = opts[k]; } else { po[k] = opts[k]; }
        }
        var userPick = po.onPick;
        var userEscape = po.onEscape;
        var isOpen = false, destroyed = false, sheetMode = false;
        var unbindOpen = [];
        var container = ao.container || null;
        var parent = container || document.body;
        var restoreTo = null;

        // DOM: backdrop + popover (arrow + sheet handle + picker)
        var backdrop = document.createElement('div');
        backdrop.className = 'tadp-backdrop';
        var pop = document.createElement('div');
        pop.className = 'tadp-pop';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'true');
        pop.setAttribute('aria-label', (po.locale && po.locale.pickADate) || DEFAULT_LOCALE.pickADate);
        pop.hidden = true;
        backdrop.hidden = true;
        var arrow = document.createElement('div'); arrow.className = 'tadp-pop__arrow';
        var handle = document.createElement('div'); handle.className = 'tadp-pop__handle'; handle.setAttribute('aria-hidden', 'true');
        var body = document.createElement('div'); body.className = 'tadp-pop__body';
        pop.appendChild(arrow); pop.appendChild(handle); pop.appendChild(body);
        if (container) { pop.className += ' tadp-pop--contained'; backdrop.className += ' tadp-backdrop--contained'; }
        parent.appendChild(backdrop);
        parent.appendChild(pop);

        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');

        po.onPick = function (dateStr, done) {
            if (typeof userPick === 'function') { userPick(dateStr, done); }
            var closeOnPick = ao.closeOnPick === null || ao.closeOnPick === undefined ? !picker.getOption('doneButton') : !!ao.closeOnPick;
            if (done || closeOnPick) { close(); }
        };
        po.onEscape = function () { if (typeof userEscape === 'function') { userEscape(); } close(); };
        var picker = create(body, po);

        function viewportWidth() { return container ? container.clientWidth : (window.innerWidth || document.documentElement.clientWidth); }
        function wantSheet() { return ao.sheet === true || (ao.sheet === 'auto' && viewportWidth() < ao.sheetBreakpoint); }

        function reposition() {
            if (!isOpen) { return; }
            var nowSheet = wantSheet();
            if (nowSheet !== sheetMode) {
                sheetMode = nowSheet;
                pop.classList.toggle('tadp-pop--sheet', sheetMode);
                backdrop.classList.toggle('tadp-backdrop--dim', sheetMode);
                picker.set('inline', sheetMode || !!po.inline);
            }
            pop.classList.remove('tadp-pop--above');
            if (sheetMode) { pop.style.top = ''; pop.style.left = ''; arrow.style.left = ''; return; }

            var br = button.getBoundingClientRect();
            var cr = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: viewportWidth(), height: window.innerHeight || document.documentElement.clientHeight };
            var sx = container ? container.scrollLeft : 0, sy = container ? container.scrollTop : 0;
            var w = pop.offsetWidth, h = pop.offsetHeight, gap = ao.offset, pad = 8;
            var vw = cr.width, vh = cr.height;
            var bx = br.left - cr.left, by = br.top - cr.top;          // button in container coords

            var below = by + br.height + gap, above = by - gap - h;
            var placeAbove = ao.placement === 'above' || (ao.placement === 'auto' && below + h > vh - pad && above >= pad);
            var top = placeAbove ? above : below;
            var left = clamp(bx + br.width / 2 - w / 2, pad, Math.max(pad, vw - w - pad));
            pop.classList.toggle('tadp-pop--above', placeAbove);
            pop.style.top = (top + sy) + 'px';
            pop.style.left = (left + sx) + 'px';
            arrow.style.left = clamp(bx + br.width / 2 - left, 16, w - 16) + 'px';
        }

        function focusables() {
            var all = pop.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
            var out = [];
            for (var i = 0; i < all.length; i++) { if (all[i].getAttribute('tabindex') !== '-1' && all[i].offsetParent !== null) { out.push(all[i]); } }
            return out;
        }

        function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                // the picker swallows Escape while zoomed out; otherwise close
                if (!pop.contains(e.target) || picker.getView() === 'days') { e.preventDefault(); close(); }
                return;
            }
            if (e.key !== 'Tab') { return; }
            var f = focusables();
            if (!f.length) { e.preventDefault(); return; }
            var first = f[0], last = f[f.length - 1], a = document.activeElement;
            if (!pop.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
            if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
        }

        function onDocFocus(e) {
            // focus trap for anything that isn't Tab (e.g. a screen reader jumping out)
            if (!isOpen || pop.contains(e.target) || e.target === document.body || e.target === document) { return; }
            picker.focus();
        }

        function open() {
            if (isOpen || destroyed) { return; }
            isOpen = true;
            restoreTo = document.activeElement;
            sheetMode = wantSheet();
            pop.classList.toggle('tadp-pop--sheet', sheetMode);
            backdrop.classList.toggle('tadp-backdrop--dim', sheetMode);
            picker.set('inline', sheetMode || !!po.inline);
            pop.hidden = false; backdrop.hidden = false;
            pop.classList.add('tadp-pop--open'); backdrop.classList.add('tadp-backdrop--open');
            button.setAttribute('aria-expanded', 'true');
            picker.showMonth(picker.getValue().slice(0, 7));   // land on the selected day's month, days view
            reposition();
            unbindOpen.push(on(backdrop, 'click', function (e) { e.preventDefault(); close(); }));
            unbindOpen.push(on(pop, 'keydown', onKey));
            unbindOpen.push(on(document, 'keydown', function (e) { if ((e.key === 'Escape' || e.key === 'Esc') && !pop.contains(e.target)) { close(); } }));
            unbindOpen.push(on(document, 'focusin', onDocFocus));
            unbindOpen.push(on(window, 'resize', reposition));
            unbindOpen.push(on(window, 'scroll', reposition, true));
            if (container) { unbindOpen.push(on(container, 'scroll', reposition)); }
            // the mouse / touch that opened us is still settling — focus next frame
            window.setTimeout(function () { if (isOpen) { picker.focus(); } }, 0);
            if (typeof ao.onOpen === 'function') { ao.onOpen(); }
        }

        function close() {
            if (!isOpen) { return; }
            isOpen = false;
            for (var i = 0; i < unbindOpen.length; i++) { unbindOpen[i](); }
            unbindOpen = [];
            pop.classList.remove('tadp-pop--open'); backdrop.classList.remove('tadp-backdrop--open');
            pop.hidden = true; backdrop.hidden = true;
            button.setAttribute('aria-expanded', 'false');
            var r = restoreTo && restoreTo.focus && document.body.contains(restoreTo) ? restoreTo : button;
            try { r.focus({ preventScroll: true }); } catch (e) { r.focus(); }
            restoreTo = null;
            if (typeof ao.onClose === 'function') { ao.onClose(); }
        }

        function toggle() { if (isOpen) { close(); } else { open(); } }

        var unbindBtn = on(button, 'click', function (e) { e.preventDefault(); toggle(); });

        return {
            el: pop,
            picker: picker,
            open: open,
            close: close,
            toggle: toggle,
            isOpen: function () { return isOpen; },
            reposition: reposition,
            destroy: function () {
                if (destroyed) { return; }
                close();
                destroyed = true;
                unbindBtn();
                picker.destroy();
                if (pop.parentNode) { pop.parentNode.removeChild(pop); }
                if (backdrop.parentNode) { backdrop.parentNode.removeChild(backdrop); }
                button.removeAttribute('aria-expanded');
            }
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Export
    // ─────────────────────────────────────────────────────────────────────
    window.ToAviateDatePicker = {
        version: VERSION,
        create: create,
        attach: attach,
        defaults: DEFAULTS,
        locale: DEFAULT_LOCALE,
        format: function (d) { var x = parse(d); return x ? fmt(x) : ''; },
        parse: parse,
        today: function () { var n = new Date(); return fmt(n); },
        longDate: function (s, locale) { var d = parse(s); return d ? longDate(d, extend({}, DEFAULT_LOCALE, locale)) : ''; },
        shortDate: function (s, locale) { var d = parse(s); return d ? shortDate(d, extend({}, DEFAULT_LOCALE, locale)) : ''; },
        addDays: function (s, n) { var d = parse(s); return d ? fmt(addDays(d, n)) : ''; },
        reducedMotion: reducedMotion
    };
})(window, document);
