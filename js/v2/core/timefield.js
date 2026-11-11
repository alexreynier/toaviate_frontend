'use strict';
/*
 * <ta-time ng-model="vm.bk.t.off" ng-change="vm.bk_time_changed('off')" input-id="bki-t-off" label="Brakes off"
 *          near="vm.bk_time_near('off')" min="vm.bk.t.off"></ta-time>
 *
 * A time of day in 5-MINUTE steps that can be TYPED or PICKED (owner, 11 Nov 2026 — the book-in times were four long
 * native selects; v1 had typeable dropdowns). One text field + a list under it:
 *   • type it: "1050", "10:50", "10.50", "950", "9" — committed on Enter / Tab / leaving the field, shown as HH:MM and
 *     rounded to the nearest 5 minutes ("10:52" -> 10:50). Phones get the number pad (no colon needed).
 *   • or pick it: the list opens on a click / tap (or an arrow key), scrolled to the current value, else to `near` (a sensible place to start —
 *     e.g. the time before it), and narrows as you type ("11" -> 11:00 … 11:55). ↑ / ↓ move, Enter picks, Esc puts the
 *     old value back. Times earlier than `min` are greyed (still pickable: the page's own rules judge them).
 *   • empty the field to clear it (optional times).
 * The model is v1's 'H:mm' string ('9:05', '10:50') or '' — what the selects wrote, so every calculation reads it
 * unchanged. Text something that isn't a time and the old value comes back. Styles: .ta-time* in css/ta-base.css.
 *
 * Options (all optional):
 *   step="1"        keep the typed MINUTE (tracker / logbook times: "10:52" stays 10:52). The list still offers the
 *                   5-minute times as shortcuts, plus the exact one you are typing. Default "5".
 *   format="HH:mm"  the model is zero-padded ("09:05") — the logbook's format. format="date" = a Date on 1 Jan 1970
 *                   local time, or null when empty — what <input type="time"> gave AngularJS (Claim a Flight's amend
 *                   dialog). Default "H:mm". A model in any of the three shapes is read.
 *   ng-disabled     greys the field and its button.
 *   early="8"       the 24-hour-clock check (owner, 11 Nov 2026): when someone ENTERS a time before this hour (default 8;
 *                   "0" turns it off) the field asks under itself "01:05 is in the middle of the night. Did you mean
 *                   13:05?" with "Use 13:05" (one press) and "Keep 01:05". Only for a time typed or picked here — a
 *                   time that was already on the record (a tracker's, an import's) never asks.
 * `near` and `min` take a time in any of those shapes too.
 * A value that is off the step (a tracker's 09:58 in a 5-minute field) is shown as it is and only rounded when a new
 * time is typed over it.
 * Owner's rule (11 Nov 2026): BRAKES off / on and logbook OFF / ON BLOCKS in 5-minute steps; TAKE-OFF and LANDING to the
 * minute. Used by: v2 book-in (all four 5 minutes — club times), the amend-times dialog (brakes 5, take-off / landing 1),
 * the logbook entry and the SkyDemon import cards (blocks, 5).
 */
app.directive('taTime', ['$timeout', function ($timeout) {
    var GRID = 5;      // the list is always the 5-minute times; `step` decides what a typed time is rounded to
    function pad(n) { return ('0' + n).slice(-2); }
    function optOf(m) { return { m: m, v: Math.floor(m / 60) + ':' + pad(m % 60), label: pad(Math.floor(m / 60)) + ':' + pad(m % 60), hh: pad(Math.floor(m / 60)), mm: pad(m % 60) }; }
    var OPTIONS = [];
    for (var i = 0; i < 1440; i += GRID) { OPTIONS.push(optOf(i)); }
    // minutes of a time in any shape the app holds one: 'H:mm' / 'HH:mm[:ss]' text, or a Date (its local clock time)
    function toMin(v) {
        if (v instanceof Date) { return isNaN(v.getTime()) ? null : v.getHours() * 60 + v.getMinutes(); }
        var x = /^(\d{1,2}):(\d{2})/.exec(String(v === null || v === undefined ? '' : v));
        if (!x) { return null; }
        var h = parseInt(x[1], 10), m = parseInt(x[2], 10);
        return (h <= 23 && m <= 59) ? h * 60 + m : null;
    }
    function snapTo(m, step) { m = Math.round(m / step) * step; return m >= 1440 ? 1440 - step : m; }
    function withExtra(list, m) {   // the 5-minute list plus one off-grid time, in order
        if (m === null || list.some(function (o) { return o.m === m; })) { return list; }
        return list.concat([optOf(m)]).sort(function (a, b) { return a.m - b.m; });
    }
    function norm(text) { return String(text === null || text === undefined ? '' : text).trim().toLowerCase().replace(/[.\s,;h\-]+/g, ':').replace(/:+/g, ':'); }
    // the minutes a typed text means, or null: "1050" / "10:50" / "10.5" (10:50) / "950" / "9" / "95" (9:50)
    function parse(text) {
        var t = norm(text), h, m;
        if (!t || !/^[\d:]+$/.test(t)) { return null; }
        if (t.indexOf(':') > -1) {
            var p = t.split(':');
            if (p.length > 2 || !/^\d{1,2}$/.test(p[0]) || !/^\d{0,2}$/.test(p[1])) { return null; }
            h = parseInt(p[0], 10); m = p[1] === '' ? 0 : (p[1].length === 1 ? parseInt(p[1], 10) * 10 : parseInt(p[1], 10));
        } else if (t.length <= 2) {
            h = parseInt(t, 10); m = 0;
            if (h > 23 && t.length === 2) { h = parseInt(t.charAt(0), 10); m = parseInt(t.charAt(1), 10) * 10; }   // "95" = 9:50
        } else if (t.length === 3) {
            h = parseInt(t.charAt(0), 10); m = parseInt(t.slice(1), 10);                                             // "950" = 9:50
            if (m > 59) { h = parseInt(t.slice(0, 2), 10); m = parseInt(t.charAt(2), 10) * 10; }                     // "196" can only be 19:60 -> no
        } else if (t.length === 4) {
            h = parseInt(t.slice(0, 2), 10); m = parseInt(t.slice(2), 10);
        } else { return null; }
        return (h >= 0 && h <= 23 && m >= 0 && m <= 59) ? h * 60 + m : null;
    }
    // the list while typing: every 5-minute time the text could still become, plus the one it means right now
    function matches(text, step) {
        var t = norm(text);
        if (!t) { return OPTIONS; }
        if (!/^[\d:]+$/.test(t)) { return []; }
        var out, exact = parse(text);
        if (t.indexOf(':') > -1) {
            var p = t.split(':'), hh = parseInt(p[0], 10);
            out = OPTIONS.filter(function (o) { return parseInt(o.hh, 10) === hh && o.mm.indexOf(p[1] || '') === 0; });
        } else {
            out = OPTIONS.filter(function (o) { return (o.hh + o.mm).indexOf(t) === 0 || (o.hh.charAt(0) === '0' && (o.hh.charAt(1) + o.mm).indexOf(t) === 0); });
        }
        return exact !== null ? withExtra(out, snapTo(exact, step)) : out;
    }
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: { inputId: '@', label: '@', near: '&', min: '&', step: '@', format: '@', early: '@', dis: '=?ngDisabled' },
        template:
            '<div class="ta-time" ng-class="{\'ta-time--open\': open}">' +
            '  <div class="ta-time__box">' +   // the field, its button and its list: the question below must not move them
            '  <input class="ta-input ta-time__in" type="text" inputmode="numeric" id="{{ inputId }}" data-e2e="{{ inputId }}" ng-model="s.text" ng-change="typed()" ng-disabled="dis" placeholder="HH:MM" maxlength="5"' +
            '    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="{{ open ? \'true\' : \'false\' }}" aria-controls="{{ inputId }}-list" aria-label="{{ label }}">' +
            '  <button type="button" class="ta-time__btn" tabindex="-1" aria-label="Show the times" ng-disabled="dis" no-busy-guard><i class="fas fa-clock" aria-hidden="true"></i></button>' +
            '  <div class="ta-time__menu" role="listbox" id="{{ inputId }}-list" aria-label="{{ label }}" ng-if="open">' +
            '    <button type="button" class="ta-time__opt" role="option" tabindex="-1" ng-repeat="o in items track by o.m" data-m="{{ o.m }}" aria-selected="{{ o.m === cur ? \'true\' : \'false\' }}"' +
            '      ng-class="{\'ta-time__opt--hi\': $index === s.hi, \'ta-time__opt--on\': o.m === cur, \'ta-time__opt--before\': floor !== null && o.m < floor}">{{ o.label }}</button>' +
            '    <div class="ta-time__none" ng-if="!items.length">Type a time like 10:50</div>' +
            '  </div>' +
            '  </div>' +
            '  <div class="ta-time__ask" ng-if="s.ask && !open && !dis" role="status" data-e2e="{{ inputId }}-ask">' +
            '    <span><i class="fas fa-moon" aria-hidden="true"></i>{{ s.ask.label }} is {{ s.ask.words }}. Did you mean {{ s.ask.alt }}?</span>' +
            '    <span class="ta-time__askbtns"><button type="button" class="ta-time__askbtn" ng-click="useAlt()" no-busy-guard>Use {{ s.ask.alt }}</button>' +
            '    <button type="button" class="ta-time__askbtn ta-time__askbtn--quiet" ng-click="keepEarly()" no-busy-guard>Keep {{ s.ask.label }}</button></span>' +
            '  </div>' +
            '</div>',
        link: function (scope, el, attrs, ngModel) {
            var s = scope.s = { text: '', hi: -1, nav: false, ask: null };   // nav: the arrows moved the highlight since the last keystroke; ask: the early-hours question
            var root = el[0];
            scope.open = false; scope.items = OPTIONS; scope.cur = null; scope.floor = null;
            function input() { return root.querySelector('.ta-time__in'); }
            function labelOf(v) { var m = toMin(v); return m === null ? '' : optOf(m).label; }
            function stepOf() { var n = parseInt(scope.step, 10); return n >= 1 && n <= 60 ? n : GRID; }
            function snap(m) { return snapTo(m, stepOf()); }

            // inside, the value is always 'H:mm' text ('' = none); `format` decides what the model holds
            ngModel.$formatters.push(function (model) { var m = toMin(model); return m === null ? '' : optOf(m).v; });
            ngModel.$parsers.push(function (view) {
                var m = toMin(view);
                if (scope.format === 'date') { return m === null ? null : new Date(1970, 0, 1, Math.floor(m / 60), m % 60, 0, 0); }
                if (m === null) { return ''; }
                return scope.format === 'HH:mm' ? optOf(m).label : optOf(m).v;
            });
            ngModel.$isEmpty = function (v) { return toMin(v) === null; };
            ngModel.$render = function () { s.text = labelOf(ngModel.$viewValue); scope.cur = toMin(ngModel.$viewValue); if (!held) { s.ask = null; } };
            // set() is only ever a PERSON's entry (typed and committed, or picked): the place to ask about the small hours.
            // A 12-hour-clock slip ("105" for five past one in the afternoon, "730" for half past seven in the evening)
            // lands before 08:00, and twelve hours later is the time that was meant.
            var held = false;      // our own write is in flight: its $render must not clear the question we just asked
            function earlyLimit() { var n = scope.early === undefined || scope.early === '' ? 8 : parseInt(scope.early, 10); return n > 0 && n <= 12 ? n * 60 : 0; }
            function set(v) {
                var before = ngModel.$viewValue || '';
                held = true;
                if (before !== v) { ngModel.$setViewValue(v); }
                s.text = labelOf(v); scope.cur = toMin(v);
                held = false;
                if (before === v) { return; }
                var m = toMin(v);
                s.ask = (m !== null && m < earlyLimit()) ? { label: optOf(m).label, alt: optOf(m + 720).label, altV: optOf(m + 720).v, words: m < 300 ? 'in the middle of the night' : 'early in the morning' } : null;
            }
            scope.useAlt = function () { if (s.ask) { set(s.ask.altV); s.ask = null; } };
            scope.keepEarly = function () { s.ask = null; };
            // put the highlighted row in view (centred when the list has just opened)
            // The list must be wholly visible where it opens: it is clipped by the window and by any scrolling ancestor
            // (a dialog's .ta-dlg scrolls). Room under the field -> it opens down, as tall as fits (262px at most);
            // too little room (under 150px) -> it opens upward instead.
            function place(menu) {
                var fr = input().getBoundingClientRect(), top = 0, bottom = window.innerHeight, n = root.parentNode;
                while (n && n.nodeType === 1 && n !== document.documentElement) {
                    var oy = window.getComputedStyle(n).overflowY;
                    if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') { var r = n.getBoundingClientRect(); top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
                    n = n.parentNode;
                }
                var below = bottom - fr.bottom - 14, above = fr.top - top - 14, up = below < 150 && above > below;
                menu.style.maxHeight = Math.max(120, Math.min(262, up ? above : below)) + 'px';
                if (up) { menu.classList.add('ta-time__menu--up'); } else { menu.classList.remove('ta-time__menu--up'); }
            }
            function reveal(centre) {
                $timeout(function () {
                    var menu = root.querySelector('.ta-time__menu'), row = menu && menu.querySelector('.ta-time__opt--hi');
                    if (menu) { place(menu); }
                    if (!menu || !row) { return; }
                    if (centre) { menu.scrollTop = Math.max(0, row.offsetTop - (menu.clientHeight - row.offsetHeight) / 2); }
                    else if (row.offsetTop < menu.scrollTop) { menu.scrollTop = row.offsetTop - 6; }
                    else if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight) { menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight + 6; }
                }, 0, false);
            }
            function indexNear(items, m) {
                if (m === null || !items.length) { return items.length ? 0 : -1; }
                var best = 0;
                for (var k = 0; k < items.length; k++) { if (Math.abs(items[k].m - m) < Math.abs(items[best].m - m)) { best = k; } }
                return best;
            }
            // the whole list, opened at the current value, else at `near`, else at 09:00
            function openAll() {
                if (scope.dis) { return; }
                scope.items = withExtra(OPTIONS, scope.cur);   // a to-the-minute value (10:52) is in the list too
                scope.floor = toMin(scope.min());
                var at = scope.cur !== null ? scope.cur : toMin(scope.near());
                s.hi = indexNear(scope.items, at !== null ? at : 540);
                s.nav = false;
                scope.open = true;
                reveal(true);
            }
            function close() { scope.open = false; s.hi = -1; }
            scope.typed = function () {
                s.nav = false;
                scope.items = matches(s.text, stepOf());
                scope.floor = toMin(scope.min());
                var p = parse(s.text);
                s.hi = norm(s.text) === '' ? indexNear(scope.items, scope.cur !== null ? scope.cur : toMin(scope.near())) : indexNear(scope.items, p !== null ? snap(p) : null);
                scope.open = true;
                reveal(true);
            };
            // what the field holds becomes the value: empty clears, a time is rounded to the step, anything else is undone
            function commit() {
                var t = norm(s.text);
                // untouched: a value that is off the step (the tracker's 09:58 in a 5-minute field) is only rounded when
                // someone types a new time — looking at a field must never change it
                if (s.text === labelOf(ngModel.$viewValue)) { return; }
                if (t === '') { set(''); return; }
                var p = parse(s.text);
                if (p === null) { ngModel.$render(); return; }
                set(optOf(snap(p)).v);
            }
            function pick(o) { set(o.v); close(); }

            var inp = angular.element(input());
            // The list opens when you ASK for it — a click / tap on the field, typing, or an arrow key — never on focus
            // alone: tabbing through a form, or a page that focuses the field with an error, must not drop a list over
            // the next field or the Save button. Focus only selects the text, so typing replaces it.
            inp.on('focus', function () { $timeout(function () { try { input().select(); } catch (e) {} }, 0, false); });
            inp.on('click', function () { scope.$evalAsync(function () { if (!scope.open) { openAll(); } }); });
            inp.on('blur', function () { scope.$evalAsync(function () { commit(); close(); }); });
            inp.on('keydown', function (e) {
                var k = e.key || '', code = e.keyCode;
                if (k === 'ArrowDown' || code === 40 || k === 'ArrowUp' || code === 38) {
                    e.preventDefault();
                    var d = (k === 'ArrowDown' || code === 40) ? 1 : -1;
                    scope.$evalAsync(function () {
                        if (!scope.open) { openAll(); return; }
                        if (!scope.items.length) { return; }
                        s.hi = Math.max(0, Math.min(scope.items.length - 1, s.hi + d));
                        s.nav = true;
                        reveal(false);
                    });
                } else if (k === 'Enter' || code === 13) {
                    if (!scope.open) { return; }
                    e.preventDefault(); e.stopPropagation();
                    // the highlighted row when there is one to take (typed towards it, or reached with the arrows); an
                    // emptied field with nothing chosen clears the time
                    scope.$evalAsync(function () {
                        if (scope.items[s.hi] && (s.nav || norm(s.text) !== '')) { pick(scope.items[s.hi]); } else { commit(); close(); }
                    });
                } else if (k === 'Escape' || k === 'Esc' || code === 27) {
                    if (!scope.open) { return; }
                    e.preventDefault(); e.stopPropagation();
                    scope.$evalAsync(function () { ngModel.$render(); close(); });
                }
            });
            // the list and the clock button: mousedown, so the field keeps its focus (a blur would commit the text first)
            el.on('mousedown touchstart', function (e) {
                var t = e.target, row = null, btn = null;
                while (t && t !== root) {
                    if (t.classList && t.classList.contains('ta-time__opt')) { row = t; }
                    if (t.classList && t.classList.contains('ta-time__btn')) { btn = t; }
                    t = t.parentNode;
                }
                if (btn) {
                    e.preventDefault();
                    scope.$evalAsync(function () { if (scope.open) { commit(); close(); } else { openAll(); } });
                    if (root.ownerDocument.activeElement !== input()) { input().focus(); }
                } else if (row && e.type === 'mousedown') {
                    e.preventDefault();
                    var m = parseInt(row.getAttribute('data-m'), 10);
                    scope.$evalAsync(function () { pick(optOf(m)); });
                }
            });
            // a touch scrolls the list; the tap itself arrives as a click
            el.on('click', function (e) {
                var t = e.target;
                while (t && t !== root) {
                    if (t.classList && t.classList.contains('ta-time__opt')) {
                        var m = parseInt(t.getAttribute('data-m'), 10);
                        scope.$evalAsync(function () { if (scope.open) { pick(optOf(m)); } });
                        return;
                    }
                    t = t.parentNode;
                }
            });
            scope.$on('$destroy', function () { inp.off(); el.off(); });
        }
    };
}]);
