/* ═══════════════════════════════════════════════════════════════════════════
   v2 LOGBOOK — design: mockups/my-account/logbook.html (approved). My logbook (table + totals), Add / Edit a
   flight, Statistics, Import (spreadsheet CSV) and SkyDemon logs, beside the v1 screens
   (views/my_account/logbook/*, PersonalLogbookController) behind the global v2 switch (js/v2/core/design.js).
   Same server calls as v1: PersonalLogbookService, LogbookEndorsementsService, InstructorService.
   Views: views/v2/logbook/*.html · styles: css/v2/logbook.css (.lgb-*, on css/ta-base.css).

   Also here, shared with js/v2/claim/claim.js (both files load on every page):
     • TaComboMatch — the smart-search matching (end of the registration first, dashes ignored, words).
     • LgbFmt       — date / hours formatting in the mockups' words ("Wed 4 Nov", "1:05").
     • <ta-combo>   — picker B (.ta-combo in ta-base.css): a search field you type into, matches under it;
                      a dropdown on desktop, full screen with Cancel on phones. ↑ ↓ Enter Esc Tab.
   Add a flight's registration is the C7 aircraft search (be-alex-3e.md, landed 19:55): your logbook, the ToAviate club
   fleets and the aircraft register (LogbookV2Data); the v1 GET personal_logbook/aircraft/{reg} is only the fallback.
   Currency (backend C8, personal_logbook/v2/currency): the band under the totals, the Currency card on Statistics and the
   "Choose your checks" dialog. While that GET fails (not deployed yet) the band hides and Statistics shows Last 90 days only.
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    function st(name, url, tpl, screen) {
        $stateProvider.state('dashboard.v2.' + name, {
            url: url,
            templateUrl: 'views/v2/logbook/' + tpl + '.html',
            controller: 'LogbookV2Controller', controllerAs: 'vm',
            data: { screen: screen }
        });
    }
    st('logbook', '/my_account/logbook', 'logbook', 'list');
    st('logbook_add', '/my_account/logbook/add', 'entry', 'add');
    st('logbook_edit', '/my_account/logbook/edit/:entry_id', 'entry', 'edit');
    st('logbook_stats', '/my_account/logbook/stats', 'stats', 'stats');
    st('logbook_import', '/my_account/logbook/import', 'import', 'import');
    st('logbook_skydemon', '/my_account/logbook/skydemon', 'skydemon', 'skydemon');
    DesignRoutesProvider
        .map('dashboard.my_account.logbook', 'dashboard.v2.logbook')
        .map('dashboard.my_account.logbook_add', 'dashboard.v2.logbook_add')
        .map('dashboard.my_account.logbook_edit', 'dashboard.v2.logbook_edit')
        .map('dashboard.my_account.logbook_stats', 'dashboard.v2.logbook_stats')
        .map('dashboard.my_account.logbook_import', 'dashboard.v2.logbook_import')
        .map('dashboard.my_account.logbook_skydemon', 'dashboard.v2.logbook_skydemon');
}]);

/* ── smart-search matching (logbook aircraft filter, Add a flight registration, Claim a flight) ── */
app.factory('TaComboMatch', function () {
    function norm(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
    function toks(q) { return String(q || '').trim().split(/\s+/).map(norm).filter(Boolean); }
    /* pilots call an aircraft by its last letters, so the end of the registration wins: TJ finds G-BMTJ first */
    function regScore(reg, t) {
        var full = norm(reg), body = norm(String(reg || '').split('-').pop());
        if (!t || !full) { return 0; }
        if (full === t || body === t) { return 100; }
        if (body.slice(-t.length) === t) { return 90; }
        if (body.indexOf(t) === 0) { return 80; }
        return full.indexOf(t) > -1 ? 70 : 0;
    }
    /* words match from their start, so CES finds Cessna but TR doesn't find The Pilot Cen-tr-e */
    function wordHit(text, t) { return String(text || '').toUpperCase().split(/[\s-]+/).some(function (w) { return norm(w).indexOf(t) === 0; }); }
    /* every word typed must hit the registration or one of the words */
    function score(reg, hay, q) {
        var list = toks(q), total = 0;
        for (var i = 0; i < list.length; i++) {
            var s = regScore(reg, list[i]) || (wordHit(hay, list[i]) ? 40 : 0);
            if (!s) { return 0; }
            total += s;
        }
        return total;
    }
    /* one or two letters are nearly always the end of a registration, so a registration match beats a type or
       club match outright; from three letters everything counts. item → { reg, hay } via the getter */
    function matches(list, q, get, sorted) {
        var scored = list.map(function (it) { var g = get(it); return { it: it, s: score(g.reg, g.hay, q) }; }).filter(function (x) { return x.s > 0; });
        var regs = scored.filter(function (x) { return x.s >= 70; });
        var out = (norm(q).length < 3 && regs.length) ? regs : scored;
        if (sorted) { out.sort(function (a, b) { return b.s - a.s; }); }
        return out.map(function (x) { return x.it; });
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    /* underline what matched (G-SH matches GSH too); escapes every piece */
    function hl(text, q) {
        var list = toks(q), s = String(text == null ? '' : text);
        if (!list.length) { return esc(s); }
        var re = new RegExp('(' + list.map(function (t) { return t.split('').join('[\\s-]?'); }).join('|') + ')', 'ig');
        return s.split(re).map(function (part, i) { return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); }).join('');
    }
    return { norm: norm, toks: toks, regScore: regScore, wordHit: wordHit, score: score, matches: matches, esc: esc, hl: hl };
});

/* ── formatting in the mockups' words ── */
app.factory('LgbFmt', function () {
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    /* 'YYYY-MM-DD[ HH:MM[:SS]]' → a local Date (never shifted by the device's timezone) */
    function pd(s) {
        if (s instanceof Date) { return s; }
        var p = String(s || '').split(/[ T]/), d = (p[0] || '').split('-').map(Number), t = (p[1] || '00:00').split(':').map(Number);
        return new Date(d[0] || 1970, (d[1] || 1) - 1, d[2] || 1, t[0] || 0, t[1] || 0);
    }
    function today() { return ymd(new Date()); }
    function addDays(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return ymd(d); }
    function addMonths(s, n) { var d = pd(s); d.setMonth(d.getMonth() + n); return ymd(d); }
    function daysBetween(a, b) { return Math.round((pd(b) - pd(a)) / 86400000); }
    function fDate(s) { if (!s) { return ''; } var d = pd(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
    function fDay(s) { if (!s) { return ''; } var d = pd(s); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
    function fDayLong(s) { if (!s) { return ''; } var d = pd(s); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
    function fTime(s) { return (String(s || '').split(/[ T]/)[1] || '').slice(0, 5); }
    function monthLabel(s) { var d = pd(s); return MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
    /* decimal hours → h:mm (nearest minute) */
    function hm(h) { var m = Math.round((+h || 0) * 60); var sign = m < 0 ? '-' : ''; m = Math.abs(m); return sign + Math.floor(m / 60) + ':' + p2(m % 60); }
    /* 'h:mm' or decimal text → decimal hours; '' → null; anything else → NaN */
    function parseHM(s) {
        s = String(s == null ? '' : s).trim();
        if (!s) { return null; }
        var m = /^(\d{1,3}):([0-5]\d)$/.exec(s);
        if (m) { return +m[1] + (+m[2]) / 60; }
        if (/^\d+([.,]\d+)?$/.test(s)) { return parseFloat(s.replace(',', '.')); }
        return NaN;
    }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    return { MON: MON, MONTH: MONTH, DOW: DOW, p2: p2, ymd: ymd, pd: pd, today: today, addDays: addDays, addMonths: addMonths,
        daysBetween: daysBetween, fDate: fDate, fDay: fDay, fDayLong: fDayLong, fTime: fTime, monthLabel: monthLabel, hm: hm,
        parseHM: parseHM, plural: plural };
});

/* ═══════════════════════════════════════════════════════════════════════════
   <ta-combo> — picker B (DESIGN_GUIDELINES §4.15, .ta-combo in ta-base.css).

     <ta-combo cb-id="ac" label="Filter by aircraft" placeholder="All aircraft" placeholder-open="Registration, type or make"
               placeholder-picked="Type to change"        optional: the hint while a value is shown (default none)
               caps="true" query="vm.q"                   two-way: the letters typed (optional)
               source="vm.acGroups(q)"                    → { groups: [{ label, right, rows: [row], chips: [chip] }],
                                                              empty: { t, s }, busy: 'Searching…', foot: '' }
               on-pick="vm.acPick(key, row)"              a row or chip was chosen (Enter, click)
               on-leave="vm.regLeave(q)"                  optional: leaving with letters typed (Tab, click away)
               on-type="vm.typed(q)"                      optional: after every keystroke
               on-clear="vm.acClear()"                    the × button
               value="vm.acValue"                         shown when closed: { ac: { reg, type, colour } } | { tag } | null
               summary="vm.acSummary"                     { pre, b, post } on the right when closed (desktop): any of the three;
                                                          b is bold, so { b: '6 bookings', post: ' · next Tue 10:00' } bolds the start
               clearable="vm.f.ac !== 'all'"  version="vm.cbVer"> (bump version to re-read the source while open)
               hl-sub="false"                             optional: underline matches in the main line only (not the sub-line)
               foot-keys="true"                           optional: keep the ↑ ↓ / Enter / Esc row under a group's foot (default: the foot replaces it)
               enter-word="open"                          optional: the Enter hint's word (default "choose"; "open" for search-to-open)

     a row:  { key, t, s, r, rs, lead: 'fa-plane', ac: '#colour', on, quiet, noHl, noHlSub, av }
             { hint: true, t: 'Type 2+ letters to search the club's members' } = an info line under the group's rows:
             not selectable, skipped by the arrow keys (a group may also carry hint: '…' itself)
             av: { code: 'AR', colour: '#2563eb', title } = an INSTRUCTOR's initials circle;
                 { member: true, title } = a member / student (the grey person icon) — the app-wide rule: initials = instructor
     value:  { ac } | { tag } | { av: {…as above}, name: 'S. Carter' } (a person picked; the avatar is 24px, av.size: 'md' = 32px)
     a chip: { key, label, n, on, title } or { sep: true }
   source() is called only on open / typing / version — never per digest — so it may build new objects.
   value / summary must be stable objects (set them when the page's state changes, not from a function).
   ═══════════════════════════════════════════════════════════════════════════ */
app.directive('taCombo', ['$document', '$timeout', '$sce', '$window', 'TaComboMatch', function ($document, $timeout, $sce, $window, TaComboMatch) {
    return {
        restrict: 'E',
        scope: {
            cbId: '@', label: '@', placeholder: '@', placeholderOpen: '@', placeholderPicked: '@', caps: '@',
            query: '=?', source: '&', onPick: '&', onLeave: '&?', onType: '&?', onClear: '&?',
            value: '=?', summary: '=?', clearable: '=?', version: '=?', hlSub: '@', footKeys: '@', enterWord: '@'
        },
        template:
            '<div class="ta-combo" ng-class="{\'ta-combo--open\': open}">' +
              '<label class="ta-combo__box" for="cb-{{ cbId }}">' +
                '<i class="fas fa-search ta-combo__ic" aria-hidden="true"></i>' +
                '<span class="ta-combo__val" ng-if="value && !open">' +
                  '<span class="ta-ac" ng-if="value.ac" ng-attr-style="{{ value.ac.colour ? \'--ac:\' + value.ac.colour : undefined }}" title="{{ value.ac.title }}">{{ value.ac.reg }}<span ng-if="value.ac.type">{{ value.ac.type }}</span></span>' +
                  '<span class="ta-tag" ng-if="value.tag">{{ value.tag }}</span>' +
                  '<span class="ta-combo__pv" ng-if="value.av">' +
                    '<span class="ta-av" ng-class="{\'ta-av--sm\': value.av.size !== \'md\'}" ng-if="!value.av.member" ng-attr-style="{{ value.av.colour ? \'--av:\' + value.av.colour : undefined }}" title="{{ value.av.title }}">{{ value.av.code }}</span>' +
                    '<span class="ta-av ta-av--member" ng-class="{\'ta-av--sm\': value.av.size !== \'md\'}" ng-if="value.av.member" title="{{ value.av.title }}"><i class="fas fa-user" aria-hidden="true"></i></span>' +
                    '<span class="ta-combo__pvn">{{ value.name }}</span>' +
                  '</span>' +
                '</span>' +
                '<input class="ta-combo__in" id="cb-{{ cbId }}" type="text" role="combobox" aria-autocomplete="list" aria-haspopup="listbox"' +
                  ' aria-expanded="{{ open ? \'true\' : \'false\' }}" aria-controls="cb-{{ cbId }}-list" ng-attr-aria-activedescendant="{{ open && flat.length ? \'cb-\' + cbId + \'-o\' + active : undefined }}"' +
                  ' aria-label="{{ label }}" autocomplete="off" autocorrect="off" spellcheck="false" ng-attr-autocapitalize="{{ caps ? \'characters\' : undefined }}"' +
                  ' ng-model="s.q" ng-change="typed()" ng-focus="focus()" placeholder="{{ open ? (placeholderOpen || placeholder) : (value ? (placeholderPicked || \'\') : placeholder) }}">' +
                '<span class="ta-combo__sum" ng-if="summary && !open">{{ summary.pre }}<b ng-if="summary.b">{{ summary.b }}</b>{{ summary.post }}</span>' +
                '<button type="button" class="ta-combo__x" ng-if="clearable" ng-click="clear($event)" no-busy-guard aria-label="Clear {{ label | lowercase }}"><i class="fas fa-times" aria-hidden="true"></i></button>' +
                '<i class="fas fa-chevron-down ta-combo__chev" aria-hidden="true" ng-if="!clearable"></i>' +
              '</label>' +
              '<button type="button" class="ta-combo__cancel" ng-if="open" ng-click="cancel()" no-busy-guard>Cancel</button>' +
              '<div class="ta-combo__menu ta-combo__menu--in" role="listbox" id="cb-{{ cbId }}-list" aria-label="{{ label }}" ng-if="open">' +
                '<div ng-repeat="g in res.groups">' +
                  '<div class="ta-combo__grp" role="presentation" ng-if="g.label"><span>{{ g.label }}</span><span ng-if="g.right">{{ g.right }}</span></div>' +
                  '<div class="ta-combo__chips" ng-if="g.chips.length"><div class="ta-chips">' +
                    '<span ng-repeat="c in g.chips" class="lgb-chipw">' +
                      '<span class="lgb-vr" ng-if="c.sep"></span>' +
                      '<button type="button" class="ta-chip" ng-if="!c.sep" ng-class="{\'ta-chip--on\': c.on}" ng-click="pick(c)" no-busy-guard title="{{ c.title }}">{{ c.label }}<span class="ta-chip__n">{{ c.n }}</span></button>' +
                    '</span>' +
                  '</div></div>' +
                  '<div class="ta-combo__hint" role="note" ng-repeat="h in g._hints"><i class="fas fa-info-circle" aria-hidden="true"></i><span>{{ h }}</span></div>' +
                  '<button type="button" ng-repeat="r in g.rows" class="ta-combo__opt" ng-class="{\'ta-combo__opt--hi\': r._i === active, \'ta-combo__opt--quiet\': r.quiet, \'ta-combo__opt--ac\': r.ac}"' +
                    ' id="cb-{{ cbId }}-o{{ r._i }}" role="option" aria-selected="{{ r.on ? \'true\' : \'false\' }}" ng-attr-style="{{ r.ac ? \'--ac:\' + r.ac : undefined }}" ng-click="pick(r)" no-busy-guard>' +
                    '<span class="ta-combo__lead" ng-if="r.lead && !r.av"><i class="fas {{ r.lead }}" aria-hidden="true"></i></span>' +
                    '<span class="ta-av ta-combo__av" ng-if="r.av && !r.av.member" ng-attr-style="{{ r.av.colour ? \'--av:\' + r.av.colour : undefined }}" title="{{ r.av.title }}">{{ r.av.code }}</span>' +
                    '<span class="ta-av ta-av--member ta-combo__av" ng-if="r.av.member" title="{{ r.av.title }}"><i class="fas fa-user" aria-hidden="true"></i></span>' +
                    '<span class="ta-combo__txt"><span class="ta-combo__t" ng-bind-html="r._t"></span><span class="ta-combo__s" ng-if="r.s" ng-bind-html="r._s"></span></span>' +
                    '<span class="ta-combo__r" ng-if="r.r">{{ r.r }}<small ng-if="r.rs">{{ r.rs }}</small></span>' +
                    '<i class="fas fa-check ta-combo__on" aria-hidden="true" ng-if="r.on"></i>' +
                  '</button>' +
                '</div>' +
                '<div class="ta-combo__busy" ng-if="res.busy"><span class="ta-spin ta-spin--dark"></span>{{ res.busy }}</div>' +
                '<div class="ta-combo__none" ng-if="!flat.length && !chips && !hints && !res.busy && res.empty"><b>{{ res.empty.t }}</b>{{ res.empty.s }}</div>' +
                '<div class="ta-combo__foot" ng-if="res.foot">{{ res.foot }}</div>' +
                '<div class="ta-combo__foot ta-combo__foot--keys" ng-if="flat.length && (!res.foot || footKeys === \'true\')"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> {{ enterWord || \'choose\' }}</span><span><kbd>Esc</kbd> close</span></div>' +
              '</div>' +
            '</div>',
        link: function (scope, element) {
            var input = null, phone = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
            scope.s = { q: scope.query || '' };
            scope.open = false;
            scope.res = { groups: [] };
            scope.flat = [];
            scope.chips = false;
            scope.active = 0;

            function lock(on) { document.body.classList.toggle('ta-combo-lock', !!on && !!(phone && phone.matches)); }
            function refresh(keepActive) {
                var res = scope.source({ q: scope.s.q || '' }) || {};
                var flat = [], chips = false, hints = false, q = scope.s.q || '', hlSub = scope.hlSub !== 'false';
                (res.groups || []).forEach(function (g) {
                    var rows = g.rows || [];
                    g._hints = rows.filter(function (r) { return r.hint; }).map(function (r) { return r.t; }).concat(g.hint ? [g.hint] : []);
                    g.rows = rows.filter(function (r) { return !r.hint; });
                    if (g._hints.length) { hints = true; }
                });
                res.groups = (res.groups || []).filter(function (g) { return (g.rows && g.rows.length) || (g.chips && g.chips.length) || g._hints.length; });
                res.groups.forEach(function (g) {
                    if (g.chips && g.chips.length) { chips = true; }
                    (g.rows || []).forEach(function (r) {
                        r._i = flat.length;
                        r._t = $sce.trustAsHtml(r.noHl ? TaComboMatch.esc(r.t) : TaComboMatch.hl(r.t, q));
                        r._s = $sce.trustAsHtml(r.noHl || r.noHlSub || !hlSub ? TaComboMatch.esc(r.s) : TaComboMatch.hl(r.s, q));
                        flat.push(r);
                    });
                });
                scope.res = res; scope.flat = flat; scope.chips = chips; scope.hints = hints;
                if (!keepActive) {
                    scope.active = 0;
                    if (!q) { flat.forEach(function (r, i) { if (r.on) { scope.active = i; } }); }
                }
                if (scope.active >= flat.length) { scope.active = 0; }
            }
            function show() {
                if (scope.open) { return; }
                scope.open = true;
                refresh(false);
                lock(true);
                $document.on('click', outside);
                $timeout(function () {
                    var menu = element[0].querySelector('.ta-combo__menu');
                    if (menu && !(phone && phone.matches) && menu.scrollIntoView) { menu.scrollIntoView({ block: 'nearest' }); }
                    seeActive();
                }, 0, false);
            }
            function hide(blur) {
                if (!scope.open) { return; }
                scope.open = false;
                scope.active = 0;
                lock(false);
                $document.off('click', outside);
                if (blur && input && document.activeElement === input) { input.blur(); }
            }
            function seeActive() {
                var on = element[0].querySelector('.ta-combo__opt--hi');
                if (on && on.scrollIntoView) { on.scrollIntoView({ block: 'nearest' }); }
            }
            function leave() {
                var q = scope.s.q || '';
                if (scope.onLeave && q.trim()) { scope.onLeave({ q: q }); }
                else if (!scope.onLeave) { scope.s.q = ''; scope.query = ''; }
            }
            /* a click away keeps what was typed for a filter (so rows don't jump under the click), and lets the
               host look a typed registration up; a click on a node that has just been removed is ignored */
            function outside(ev) {
                if (!document.documentElement.contains(ev.target) || element[0].contains(ev.target)) { return; }
                scope.$apply(function () { leave(); hide(false); });
            }

            scope.focus = function () { show(); };
            scope.typed = function () {
                scope.query = scope.s.q;
                if (scope.onType) { scope.onType({ q: scope.s.q || '' }); }
                if (!scope.open) { show(); } else { refresh(false); dropIn(); }
                $timeout(seeActive, 0, false);
            };
            scope.pick = function (r) {
                if (!r || r.sep) { return; }
                var keep = scope.onPick({ key: r.key, row: r });
                if (keep === true) { refresh(true); return; }
                scope.s.q = ''; scope.query = '';
                hide(true);
            };
            scope.cancel = function () { scope.s.q = ''; scope.query = ''; hide(true); };
            scope.clear = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                scope.s.q = ''; scope.query = '';
                hide(false);
                if (scope.onClear) { scope.onClear(); }
            };

            /* the menu's opening animation (--in) runs once per open, as in the mockup, whose re-rendered menu drops the class while typing */
            function dropIn() { var m = element[0].querySelector('.ta-combo__menu--in'); if (m) { m.classList.remove('ta-combo__menu--in'); } }
            element.on('animationend', function (ev) {
                if (ev.target && ev.target.classList && ev.target.classList.contains('ta-combo__menu--in')) { ev.target.classList.remove('ta-combo__menu--in'); }
            });

            $timeout(function () {
                input = element[0].querySelector('.ta-combo__in');
                if (!input) { return; }
                angular.element(input).on('click', function () { if (!scope.open) { scope.$apply(show); } });
                angular.element(input).on('keydown', function (ev) {
                    var k = ev.key;
                    if (k === 'Tab') { if (scope.open) { scope.$apply(function () { leave(); hide(false); }); } return; }
                    if (k === 'Escape' || k === 'Esc') {
                        if (scope.open || scope.s.q) { ev.preventDefault(); ev.stopPropagation(); scope.$apply(function () { scope.s.q = ''; scope.query = ''; hide(true); }); }
                        return;
                    }
                    if (!scope.open) { if (k === 'ArrowDown') { ev.preventDefault(); scope.$apply(show); } return; }
                    if (k === 'ArrowDown' || k === 'ArrowUp') {
                        ev.preventDefault();
                        scope.$apply(function () {
                            var n = scope.flat.length; if (!n) { return; }
                            scope.active = (scope.active + (k === 'ArrowDown' ? 1 : n - 1)) % n;
                        });
                        seeActive();
                    }
                    if (k === 'Enter') {
                        ev.preventDefault();
                        scope.$apply(function () { var r = scope.flat[scope.active]; if (r) { scope.pick(r); } else { leave(); hide(true); } });
                    }
                });
            }, 0, false);

            scope.$watch('query', function (v) { if ((v || '') !== (scope.s.q || '')) { scope.s.q = v || ''; } });
            /* results that arrive later (a search) can make the menu taller: keep it in view on desktop */
            scope.$watch('version', function (v, old) {
                if (v === old || !scope.open) { return; }
                refresh(true);
                $timeout(function () {
                    var menu = element[0].querySelector('.ta-combo__menu');
                    if (menu && !(phone && phone.matches) && menu.scrollIntoView) { menu.scrollIntoView({ block: 'nearest' }); }
                }, 0, false);
            });
            scope.$on('$destroy', function () { $document.off('click', outside); if (scope.open) { lock(false); } if (input) { angular.element(input).off('click keydown'); } });
        }
    };
}]);

/* the wide logbook / import tables: fade the edge that has more to scroll to */
/* lgb-plain-class: ngAnimate off for this element, so ng-class changes land at once. Under reduced motion, the totals band
   entering (tot5 on) and the currency answer arriving a moment later (tot5 off) left .lgb-tot5 stuck on phones */
app.directive('lgbPlainClass', ['$animate', function ($animate) {
    return { restrict: 'A', link: function (scope, element) { $animate.enabled(element, false); } };
}]);

app.directive('lgbScrollEdges', function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            var el = element[0], wrap = el.parentElement, raf = null;
            function mark() {
                raf = null;
                if (!wrap) { return; }
                wrap.classList.toggle('lgb-scw--end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
                wrap.classList.toggle('lgb-scw--start', el.scrollLeft > 2);
            }
            function soon() { if (!raf) { raf = window.requestAnimationFrame(mark); } }
            el.addEventListener('scroll', soon, { passive: true });
            window.addEventListener('resize', soon);
            var obs = window.MutationObserver ? new MutationObserver(soon) : null;
            if (obs) { obs.observe(el, { childList: true, subtree: true }); }
            setTimeout(mark, 60);
            scope.$on('$destroy', function () { el.removeEventListener('scroll', soon); window.removeEventListener('resize', soon); if (obs) { obs.disconnect(); } });
        }
    };
});

/* ── backend C7 (be-alex-3e.md): the logbook aircraft search — your logbook, the club fleets and the register ──
   GET personal_logbook/v2/aircraft/search?q=&limit=  → { groups: [{ source: log|fleet|register, label, total, rows }], exact }
   GET personal_logbook/v2/aircraft/lookup/{reg}      → { aircraft: row | null }  (Tab after a full registration)
   GET / PUT personal_logbook/v2/currency            → { profile, defaults_used, library, own, chosen, results }  (C8)
   row = { reg, make, model, type, class ('' when unsure), engines, via, flights, last, colour } */
app.factory('LogbookV2Data', LogbookV2Data);
LogbookV2Data.$inject = ['$http', '$location'];
function LogbookV2Data($http, $location) {
    var base = '/api/v1/personal_logbook/v2/aircraft';
    var service = {};
    service.SearchAircraft = function (q, limit) { return $http.get(base + '/search?q=' + encodeURIComponent(q || '') + '&limit=' + (limit || 8)).then(handleSuccess, handleError2); };
    service.LookupAircraft = function (reg) { return $http.get(base + '/lookup/' + encodeURIComponent(reg)).then(handleSuccess, handleError2); };
    // backend C8: the currency checks, worked out from the logbook; PUT saves the pilot's choice and returns the same shape
    service.GetCurrency = function () { return $http.get('/api/v1/personal_logbook/v2/currency').then(handleSuccess, handleError2); };
    service.SaveCurrency = function (body) { return $http.put('/api/v1/personal_logbook/v2/currency', body).then(handleSuccess, handleError2); };
    return service;
    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res && res.status == 401) { $location.path('/login'); }
        // the response object (its .error / .fields are read), never an HTML error page (UX pass 2: it reached a toast)
        return { success: false, message: res && res.data && typeof res.data === 'object' ? res.data : undefined, status: res && res.status };
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LogbookV2Controller — one controller for the five screens (by data.screen), like v1.
     list     My logbook: totals tiles, date scope, source / signed chips, aircraft search, the grouped table
              (desktop) or a row per flight (phone), opened flight (facts, signatures, weather, replay, edit,
              delete), signatures dialogs (request, external), export, display options.
     add/edit Add / Edit a flight (manual entries only — club lines are kept by the club).
     stats    Statistics (from the same logbook lines) + the SEP card (GET personal_logbook/stats).
     import   Spreadsheet (CSV): upload → check & match → added.
     skydemon SkyDemon .flightlog files: upload → check → added (GPS tracks kept for replay).
   Transient row state uses the _underscore convention (never sent to the API).
   ═══════════════════════════════════════════════════════════════════════════ */
app.controller('LogbookV2Controller', LogbookV2Controller);

LogbookV2Controller.$inject = ['PersonalLogbookService', 'LogbookEndorsementsService', 'InstructorService', 'ToastService', 'TaComboMatch', 'LgbFmt', 'LogbookV2Data', 'DesignService',
    '$rootScope', '$scope', '$state', '$stateParams', '$timeout', '$q', '$window', '$document'];
function LogbookV2Controller(PersonalLogbookService, LogbookEndorsementsService, InstructorService, ToastService, TaComboMatch, LgbFmt, LogbookV2Data, DesignService,
    $rootScope, $scope, $state, $stateParams, $timeout, $q, $window, $document) {
    var vm = this, F = LgbFmt, M = TaComboMatch;

    vm.Fmt = F;
    vm.screen = ($state.current.data && $state.current.data.screen) || 'list';
    vm.user = $rootScope.globals.currentUser;
    vm.T = F.today();
    vm.tab = vm.screen === 'list' ? 'logbook' : vm.screen === 'stats' ? 'stats' : (vm.screen === 'import' || vm.screen === 'skydemon') ? 'import' : 'entry';
    vm.loading = false;
    vm.loadError = false;
    vm.entries = null;

    // ── one helper per vocabulary: raw enums never reach the screen ──
    var CAP = {
        P1: { label: 'PIC', long: 'Pilot in command', ic: 'fa-user', f: 'pic_time' },
        PUT: { label: 'Dual', long: 'Student with an instructor', ic: 'fa-user-friends', f: 'dual_time' },
        PICUS: { label: 'PICUS', long: 'PIC under supervision', ic: 'fa-user-check', f: 'picus_time' },
        P2: { label: 'Co-pilot', long: 'Co-pilot', ic: 'fa-users', f: 'copilot_time' },
        INSTRUCTOR: { label: 'Instructor', long: 'Instructor', ic: 'fa-chalkboard-teacher', f: 'instructor_time' }
    };
    vm.CAPS = ['P1', 'PUT', 'PICUS', 'P2', 'INSTRUCTOR'];
    vm.capInfo = function (c) { return CAP[c] || { label: 'Not set', long: 'Role not recorded', ic: 'fa-question' }; };
    function endStatus(r) {
        switch (r && r.status) {
            case 'pending_instructor': return { tone: 'pend', label: 'Awaiting instructor', short: 'Pending', ic: 'fa-hourglass-half' };
            case 'signed': return { tone: 'good', label: 'Signed', short: 'Signed', ic: 'fa-check' };
            case 'pending_email_confirm': return { tone: 'pend', label: r.has_signature_image ? 'Signed — awaiting email confirmation' : 'Awaiting confirmation', short: 'Pending', ic: 'fa-envelope' };
            case 'confirmed': return { tone: 'good', label: 'Confirmed', short: 'Confirmed', ic: 'fa-check-double' };
            case 'declined': return { tone: 'bad', label: 'Declined', short: 'Declined', ic: 'fa-times-circle' };
            default: return { tone: 'muted', label: 'Withdrawn', short: 'Withdrawn', ic: 'fa-minus-circle' };
        }
    }
    vm.endStatus = endStatus;
    var AUDIT = { created: 'Recorded', requested: 'Requested', signed: 'Signed', confirmed: 'Confirmed', declined: 'Declined', revoked: 'Withdrawn', email_sent: 'Email sent', resent: 'Email sent again' };
    vm.auditLabel = function (a) { return AUDIT[a] || 'Updated'; };
    var CLASSES = ['SEP (land)', 'SEP (sea)', 'SET (land)', 'SET (sea)', 'MEP (land)', 'MEP (sea)', 'ME', 'Microlight', 'Helicopter', 'Glider', 'Other'];
    function clsShort(c) { return String(c || '').replace(' (land)', ''); }
    vm.clsShort = clsShort;

    // ── display options, remembered on this device (the v1 keys, so the choice carries across designs) ──
    var LS = { fmt: 'toaviate_lb_timefmt', place: 'toaviate_lb_placefmt', sort: 'toaviate_lb2_sort', cols: 'toaviate_lb2_allcols' };
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    vm.disp = {
        fmt: lsGet(LS.fmt) === 'decimal' ? 'dec' : 'hm',
        place: lsGet(LS.place) === 'name' ? 'name' : 'icao',
        sort: lsGet(LS.sort) === 'asc' ? 'asc' : 'desc',
        allCols: lsGet(LS.cols) === '1'
    };
    vm.setDisp = function (k, v) {
        vm.disp[k] = v;
        if (k === 'fmt') { lsSet(LS.fmt, v === 'dec' ? 'decimal' : 'hms'); }
        if (k === 'place') { lsSet(LS.place, v); }
        if (k === 'sort') { lsSet(LS.sort, v); }
        if (k === 'allCols') { lsSet(LS.cols, v ? '1' : '0'); }
        if (vm.screen === 'list' && vm.entries) { recompute(); if (vm.open) { buildDetail(findKey(vm.open)); } }
        if (vm.screen === 'stats' && vm.entries) { buildStats(); }
    };
    function fmtH(n) { n = +n || 0; return vm.disp.fmt === 'dec' ? String(Math.round(n * 100) / 100) : F.hm(n); }
    vm.fmtH = fmtH;

    // ── navigation (v1 state names: the router moves them to v2 while the switch is on) ──
    var GO = { logbook: 'dashboard.my_account.logbook', stats: 'dashboard.my_account.logbook_stats', import: 'dashboard.my_account.logbook_import',
        skydemon: 'dashboard.my_account.logbook_skydemon', entry: 'dashboard.my_account.logbook_add', account: 'dashboard.my_account' };
    vm.go = function (where) { vm.menu = null; $state.go(GO[where] || GO.logbook); };
    /* the drop zones are buttons (as drawn); they open their hidden file input */
    vm.pickFile = function (id) { var i = document.getElementById(id); if (i) { i.click(); } };
    vm.flowStep = function () { return vm.screen === 'import' ? (vm.imp && vm.imp.step) : (vm.sd && vm.sd.step); };

    // ── phone or desktop: render one layout, not both ──
    var mq = $window.matchMedia ? $window.matchMedia('(max-width: 768px)') : null;
    vm.phone = !!(mq && mq.matches);
    function onMq() { $scope.$applyAsync(function () { vm.phone = !!mq.matches; }); }
    if (mq) { if (mq.addEventListener) { mq.addEventListener('change', onMq); } else if (mq.addListener) { mq.addListener(onMq); } }

    // ── Esc closes a dialog (unless it is saving) or a menu ──
    function onKey(ev) {
        if ((ev.key !== 'Escape' && ev.key !== 'Esc') || ev.defaultPrevented) { return; }
        if (!vm.dlg && !vm.menu) { return; }
        $scope.$apply(function () { if (vm.dlg) { if (vm.dlg.ask) { vm.dlgKeep(); } else if (!vm.dlgBusy) { vm.closeDlg(); } } else { vm.menu = null; } });
    }
    $document.on('keydown', onKey);
    $scope.$on('$destroy', function () {
        $document.off('keydown', onKey);
        if (mq) { if (mq.removeEventListener) { mq.removeEventListener('change', onMq); } else if (mq.removeListener) { mq.removeListener(onMq); } }
    });

    // ════════════════════════════════════════════
    // shared: logbook lines
    // ════════════════════════════════════════════
    var NUM = ['total_time', 'pic_time', 'picus_time', 'copilot_time', 'dual_time', 'instructor_time', 'night_time', 'ifr_time', 'cross_country_time', 'day_landings', 'night_landings'];
    function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
    function round2(n) { return Math.round((+n || 0) * 100) / 100; }
    function code(e, w) { return e[w + '_airport_code'] || e[w + '_place'] || ''; }
    function cleanModel(m) { return m && m !== '-' ? m : ''; }
    /* make + model, without the make twice when the model already starts with it ("Piper" + "Piper PA-28 Warrior") */
    function makeModel(make, model) {
        make = String(make || '').trim(); model = String(model || '').trim();
        if (make && (model.toLowerCase() + ' ').indexOf(make.toLowerCase() + ' ') === 0) { make = ''; }
        return [make, model].join(' ').trim();
    }
    /* an endorsement's instructor: GET logbook_endorsements sends instructor_name only once a request is signed, so a pending
       or declined request is named from the club's instructor list (insNames, user_id → name; filled by ensureInsNames and the
       request dialog). '' when still unknown: the page then says "your instructor". */
    var insNames = {}, insClubsAsked = {};
    function endName(r) { return (r && (r.instructor_name || insNames[r.instructor_user_id])) || ''; }
    vm.endName = endName;
    function rememberIns(results) {
        results.forEach(function (data) {
            ((data && data.instructors) || []).forEach(function (i) {
                var uid = i.user_id || i.id, name = ((i.first_name || '') + ' ' + (i.last_name || '')).trim();
                if (uid && name) { insNames[uid] = name; }
            });
        });
    }
    function ensureInsNames(e) {
        var need = (e.endorsements || []).some(function (r) { return !r.instructor_name && r.instructor_user_id && !insNames[r.instructor_user_id]; });
        if (!need) { return; }
        var clubIds = (e.club_id ? [e.club_id] : ((vm.user.access && vm.user.access.pilot) || [])).filter(function (id, i, a) { return a.indexOf(id) === i && !insClubsAsked[id]; });
        if (!clubIds.length) { return; }
        clubIds.forEach(function (id) { insClubsAsked[id] = true; });
        $q.all(clubIds.map(function (id) { return InstructorService.GetAllByClub(id, vm.user.id); })).then(function (results) {
            rememberIns(results);
            if (vm.open === e._k) { buildDetail(e); }
        });
    }
    function initials(n) { return String(n || '').replace(/\(.*\)/, '').trim().split(/[\s.]+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
    vm.initials = initials;
    function stampOf(rows) {
        var ok = 0, pend = 0, n = 0;
        (rows || []).forEach(function (r) {
            if (r.status !== 'declined') { n++; }
            if (r.status === 'signed' || r.status === 'confirmed') { ok++; } else if (r.status === 'pending_instructor' || r.status === 'pending_email_confirm') { pend++; }
        });
        return { st: ok ? 'good' : pend ? 'pend' : null, n: n };
    }
    function srcInfo(e) {
        if (e.kind === 'club') { return { cls: 'club', ic: 'fa-check-circle', label: 'Club', long: (e.source || 'Your club') + ' — verified club flight' }; }
        if (e.track_source === 'SD' || e.source === 'SkyDemon') { return { cls: 'sd', ic: 'fa-location-arrow', label: 'SkyDemon', long: 'SkyDemon log you added — GPS track kept' }; }
        return { cls: 'manual', ic: 'fa-pen', label: 'Manual', long: (e.source && e.source !== 'Manual entry' ? e.source + ' — added by you' : 'Added by you') + ', not verified by a club' };
    }
    function routeText(e) { var d = e._dep, a = e._arr; return d && d === a ? d + ' local' : (d || '?') + ' → ' + (a || '?'); }
    function roleLine(e) {
        if (e.capacity === 'PUT') { return 'Dual' + (e.instructor_name ? ' with ' + e.instructor_name : ''); }
        if (e.capacity === 'P1') { return e._solo ? 'PIC · solo' : 'PIC'; }
        if (e.capacity === 'PICUS') { return 'PICUS' + (e.instructor_name ? ' with ' + e.instructor_name : ''); }
        return vm.capInfo(e.capacity).label;
    }
    function refreshStamp(e) {
        var s = stampOf(e.endorsements);
        e._stamp = s.st; e._stampN = s.n;
        e._stampT = s.st === 'good' ? 'Signed — open the signatures' : 'Signature on its way — open the signatures';
    }
    function prep(e) {
        NUM.forEach(function (f) { e[f] = num(e[f]); });
        e.day_landings = Math.round(e.day_landings); e.night_landings = Math.round(e.night_landings);
        e.flight_date = String(e.flight_date || '').slice(0, 10);
        e._k = e.kind + '-' + e.ref_id;
        e._src = e.kind === 'club' ? 'club' : (e.track_source === 'SD' || e.source === 'SkyDemon') ? 'sd' : 'manual';
        e._srcInfo = srcInfo(e);
        e._dep = code(e, 'departure'); e._arr = code(e, 'arrival');
        e._model = cleanModel(e.aircraft_model);
        e._acName = makeModel(e.aircraft_make_tidy || e.aircraft_make, e._model) || e.aircraft_type || '';   // C16 tidy make (the edit form keeps the raw make)
        e._acC = e.aircraft_colour || null; e._insC = e.instructor_colour || null;   // C16: the club colours, null when the club set none
        e._solo = e.capacity === 'P1' && !!e.instructor_name && !e.instructor_time;
        e._self = e.capacity === 'P1' || e.capacity === 'INSTRUCTOR';
        e._ins = initials(e.instructor_name);
        e._role = roleLine(e);
        e._canReplay = !!(e.has_track && e.ref_id);
        refreshStamp(e);
        return e;
    }
    function sum(list) {
        var t = { flights: list.length };
        NUM.forEach(function (f) { t[f] = 0; });
        list.forEach(function (e) { NUM.forEach(function (f) { t[f] += e[f] || 0; }); });
        return t;
    }
    function findKey(k) { return (vm.entries || []).filter(function (e) { return e._k === k; })[0] || null; }
    function acName(a) { return makeModel(a.make, a.model) || a.type || ''; }
    function shortDate(s) { var d = F.pd(s); return d.getDate() + ' ' + F.MON[d.getMonth()]; }
    /* the aircraft in this logbook, newest first; base = the flights to count */
    function flownAc(base) {
        var m = {};
        (vm.entries || []).forEach(function (e) {
            var r = e.registration; if (!r || r === '—') { return; }
            var a = m[r] || (m[r] = { reg: r, last: '', n: 0, h: 0 });
            if (e.flight_date >= a.last) { a.last = e.flight_date; a.make = e.aircraft_make_tidy || e.aircraft_make || ''; a.model = e._model; a.type = e.aircraft_type || ''; a.cls = e.aircraft_class || ''; a.engine = e.engine_type || ''; }
            if (e.aircraft_colour && !a.colour) { a.colour = e.aircraft_colour; }
        });
        (base || vm.entries || []).forEach(function (e) { var a = m[e.registration]; if (a) { a.n++; a.h += e.total_time; } });
        return Object.keys(m).map(function (r) { return m[r]; }).sort(function (a, b) { return b.last.localeCompare(a.last) || a.reg.localeCompare(b.reg); });
    }
    function acHay(a) { return { reg: a.reg, hay: [a.make, a.model, a.type, a.cls].join(' ') }; }

    switch (vm.screen) {
        case 'list': initList(); break;
        case 'stats': initStats(); break;
        case 'import': initImport(); break;
        case 'skydemon': initSkydemon(); break;
        default: initForm(); break;
    }

    // ════════════════════════════════════════════
    // LIST
    // ════════════════════════════════════════════
    function initList() {
        vm.RANGES = [['all', 'All time'], ['90', 'Last 90 days'], ['12m', 'Last 12 months'], ['year', 'This year'], ['custom', 'Choose dates']];
        vm.f = { range: 'all', from: F.addMonths(vm.T, -3), to: '', src: 'all', ac: 'all', signed: false };
        restoreFilters();   // the list filters last for the visit: Add / Edit → Cancel or Back finds them as they were
        vm.dateOpts = { max: vm.T, shortcuts: false, dots: false };
        vm.open = null; vm.del = null; vm.menu = null; vm.dlg = null; vm.dlgBusy = false;
        vm.limit = 400;
        vm.acQ = ''; vm.cbVer = 0;
        try { vm.hl = sessionStorage.getItem('toaviate_lb2_hl') || null; sessionStorage.removeItem('toaviate_lb2_hl'); } catch (e) { vm.hl = null; }
        loadBook();
        loadCurrency();
    }
    function loadBook() {
        vm.loading = true; vm.loadError = false;
        return PersonalLogbookService.GetLogbook({}).then(function (data) {
            vm.loading = false;
            if (!data || data.success === false) {
                vm.loadError = true; vm.entries = [];
                ToastService.error('Could not load your logbook', (data && data.message) || 'Please try again.');
                return;
            }
            vm.entries = (data.entries || []).map(prep);
            if (vm.f.ac !== 'all' && !vm.entries.some(function (e) { return acTest(vm.f.ac, e); })) { vm.f.ac = 'all'; }   // a remembered aircraft that's gone
            recompute();
            if (vm.hl) {
                $timeout(function () {
                    var row = document.querySelector('.lgb-tr--new, .lgb-card--new');
                    if (row && row.scrollIntoView) { row.scrollIntoView({ block: 'center' }); }
                }, 300);
            }
        });
    }
    vm.retry = function () { loadBook(); };
    function rangeStart() {
        var r = vm.f.range;
        if (r === '90') { return F.addDays(vm.T, -90); }
        if (r === '12m') { return F.addDays(F.addMonths(vm.T, -12), 1); }
        if (r === 'year') { return vm.T.slice(0, 4) + '-01-01'; }
        if (r === 'custom') { return vm.f.from || null; }
        return null;
    }
    function rangeLabel() {
        if (vm.f.range === 'custom') { return (vm.f.from ? shortDate(vm.f.from) : 'start') + ' – ' + (vm.f.to ? shortDate(vm.f.to) : 'today'); }
        return ((vm.RANGES.filter(function (r) { return r[0] === vm.f.range; })[0] || vm.RANGES[0])[1]).toLowerCase();
    }
    vm.rangeLabel = rangeLabel;
    function inRange(e) {
        var s = rangeStart(), d = e.flight_date;
        if (s && d < s) { return false; }
        if (vm.f.range === 'custom' && vm.f.to && d > vm.f.to) { return false; }
        return true;
    }
    function acTest(v, e) {
        if (v === 'all') { return true; }
        if (v.indexOf('type:') === 0) { return (e.aircraft_type || '') === v.slice(5); }
        if (v.indexOf('class:') === 0) { return (e.aircraft_class || '') === v.slice(6); }
        return e.registration === v;
    }
    function sorter(a, b) {
        var c = (a.flight_date + (a.departure_time || '')).localeCompare(b.flight_date + (b.departure_time || ''));
        return vm.disp.sort === 'asc' ? c : -c;
    }
    var SRC_TITLE = { all: 'Every flight', club: 'Flights recorded by your clubs — verified', manual: 'Flights you typed or imported from a spreadsheet', sd: 'Flights from your SkyDemon logs' };
    var COLS = [
        { k: 'date', g: '' },
        { k: 'dep', g: 'Flight', label: 'Departure' }, { k: 'arr', g: 'Flight', label: 'Arrival' },
        { k: 'ac', g: '', label: 'Aircraft' },
        { k: 'total', g: '', label: 'Total', f: 'total_time' },
        { k: 'pic', g: 'Pilot function', label: 'PIC', f: 'pic_time' }, { k: 'picus', g: 'Pilot function', label: 'PICUS', f: 'picus_time', opt: 1 },
        { k: 'p2', g: 'Pilot function', label: 'Co-pilot', f: 'copilot_time', opt: 1 }, { k: 'dual', g: 'Pilot function', label: 'Dual', f: 'dual_time' },
        { k: 'fi', g: 'Pilot function', label: 'Instructor', f: 'instructor_time', opt: 1 },
        { k: 'night', g: 'Conditions', label: 'Night', solo: 'Night time', f: 'night_time' }, { k: 'ifr', g: 'Conditions', label: 'IFR', f: 'ifr_time', opt: 1 },
        { k: 'xc', g: 'Conditions', label: 'XC', f: 'cross_country_time', opt: 1, title: 'Cross-country' },
        { k: 'ldd', g: 'Landings', label: 'Day', f: 'day_landings', int: 1 }, { k: 'ldn', g: 'Landings', label: 'Night', f: 'night_landings', int: 1 },
        { k: 'who', g: 'Details', label: 'PIC / instructor' }, { k: 'src', g: 'Details', label: 'Source' }, { k: 'rem', g: 'Details', label: 'Remarks' }
    ];
    // (a literal, not a var: initList runs from the screen dispatch above, before a var here would be assigned)
    function restoreFilters() {
        try {
            var s = JSON.parse(sessionStorage.getItem('toaviate_lgb2_filters') || 'null'), f = vm.f;
            if (!s || typeof s !== 'object') { return; }
            if (vm.RANGES.some(function (r) { return r[0] === s.range; })) { f.range = s.range; }
            if (/^\d{4}-\d{2}-\d{2}$/.test(s.from || '')) { f.from = s.from; }
            f.to = /^\d{4}-\d{2}-\d{2}$/.test(s.to || '') ? s.to : '';
            if (['all', 'club', 'manual', 'sd'].indexOf(s.src) > -1) { f.src = s.src; }
            if (typeof s.ac === 'string' && s.ac) { f.ac = s.ac; }
            f.signed = !!s.signed;
        } catch (e) {}
    }
    function saveFilters() { try { sessionStorage.setItem('toaviate_lgb2_filters', JSON.stringify(vm.f)); } catch (e) {} }
    function recompute() {
        var all = vm.entries || [], f = vm.f;
        saveFilters();
        vm.inR = all.filter(inRange);
        vm.base = vm.inR.filter(function (e) { return (f.src === 'all' || e._src === f.src) && (!f.signed || e._stamp === 'good'); });
        vm.vis = vm.base.filter(function (e) { return acTest(f.ac, e); }).sort(sorter);
        vm.narrowed = vm.vis.length !== all.length;
        var cnt = { all: vm.inR.length, club: 0, manual: 0, sd: 0 }, signed = 0;
        vm.inR.forEach(function (e) { cnt[e._src]++; if (e._stamp === 'good') { signed++; } });
        vm.srcChips = [['all', 'All'], ['club', 'Club'], ['manual', 'Manual'], ['sd', 'SkyDemon']].filter(function (c) { return c[0] === 'all' || cnt[c[0]] || c[0] === f.src; })   // the chosen chip stays, even at 0, so it can be turned off
            .map(function (c) { return { k: c[0], label: c[1], n: cnt[c[0]], title: SRC_TITLE[c[0]] }; });
        vm.signedN = signed;
        vm.exportScope = f.range === 'all' ? 'Your whole logbook' : 'The dates you’ve chosen (' + rangeLabel() + ')';
        buildTiles(); buildCols(); buildRows(); buildFoot(); acComboState();
        vm.cbVer++;
    }
    function buildTiles() {
        if (!vm.inR) { return; }   // the logbook itself hasn't loaded (or failed): nothing to total yet
        var t = sum(vm.inR), ver = sum(vm.inR.filter(function (e) { return e.kind === 'club'; }));
        var student = !!(vm.cur && vm.cur.ok && !vm.cur.licensed), soloH = sum(vm.inR.filter(function (e) { return e._solo; })).total_time;
        var first = vm.inR.reduce(function (m, e) { return !m || e.flight_date < m ? e.flight_date : m; }, null);
        var since = vm.f.range === 'all' ? (first ? ' since ' + F.fDate(first) : '') : ', ' + rangeLabel();
        var added = t.total_time - ver.total_time;
        vm.tiles = [
            { ic: 'fa-clock', k: 'Total time', v: fmtH(t.total_time), s: !t.flights ? 'No flights' + since : F.plural(t.flights, 'flight') + since + ' · ' + (added > 0.001 ? fmtH(added) + ' added by you' : 'all verified by a club') },
            { ic: 'fa-user', k: 'PIC', v: fmtH(t.pic_time), s: student && soloH > 0 ? 'Pilot in command — your solo flights' : 'As pilot in command' },
            { ic: 'fa-user-friends', k: 'Dual', v: fmtH(t.dual_time), s: 'With an instructor' },
            { ic: 'fa-moon', k: 'Night', v: fmtH(t.night_time), s: 'Estimated from sunset on club flights' },
            { ic: 'fa-plane-arrival', k: 'Landings', v: String(t.day_landings + t.night_landings), s: t.day_landings + ' by day · ' + t.night_landings + ' at night' }
        ];
        vm.tot5 = true;
        if (vm.cur && vm.cur.ok && !vm.cur.licensed) {
            var s90 = F.addDays(vm.T, -90), l90 = (vm.entries || []).filter(function (e) { return e.flight_date >= s90; }), t90 = sum(l90);
            vm.tiles.push({ ic: 'fa-history', k: 'Last 90 days', v: fmtH(t90.total_time), cls: 'progress', s: F.plural(l90.length, 'flight') + ' · ' + F.plural(t90.day_landings + t90.night_landings, 'landing') + '. The passenger rule starts with your licence.' });
            vm.tot5 = false;
        }
        vm.alsoLogged = [['cross_country_time', 'cross-country', 'fa-route'], ['ifr_time', 'instrument (IFR / IMC)', 'fa-cloud'], ['picus_time', 'PIC under supervision', 'fa-user-check'],
            ['copilot_time', 'co-pilot', 'fa-users'], ['instructor_time', 'as instructor', 'fa-chalkboard-teacher']]
            .filter(function (m) { return t[m[0]] > 0; }).map(function (m) { return { v: fmtH(t[m[0]]), k: m[1], ic: m[2] }; });
    }
    function buildCols() {
        var all = vm.entries || [], cols, r1 = [], r2 = [], i = 0;
        vm.colOn = {};
        cols = COLS.filter(function (c) { var on = !c.opt || vm.disp.allCols || all.some(function (e) { return e[c.f] > 0; }); vm.colOn[c.k] = on; return on; });
        while (i < cols.length) {
            var c = cols[i], j = i;
            if (!c.g) { r1.push({ k: c.k, label: c.label, rs: 2, cs: 1, cls: (c.k === 'date' ? 'lgb-c-date' : 'lgb-gs') + (c.f ? ' ta-r' : '') }); i++; continue; }
            while (j < cols.length && cols[j].g === c.g) { j++; }
            if (j - i === 1) { r1.push({ k: c.k, label: c.solo || c.label, rs: 2, cs: 1, cls: 'lgb-gs' + (c.f ? ' ta-r' : ''), title: c.g }); i = j; continue; }
            r1.push({ k: 'g:' + c.g, label: c.g, rs: 1, cs: j - i, cls: 'lgb-gh lgb-gs' });
            for (var x = i; x < j; x++) { r2.push({ k: cols[x].k, label: cols[x].label, cls: (x === i ? 'lgb-gs' : '') + (cols[x].f ? ' ta-r' : ''), title: cols[x].title || '' }); }
            i = j;
        }
        vm.cols = cols; vm.head1 = r1; vm.head2 = r2;
        vm.tIdx = 4;
        vm.after = cols.slice(4).map(function (c, j) { var p = cols[j + 3]; return { k: c.k, f: c.f, int: c.int, gs: !c.g || c.g !== p.g }; });
    }
    function placeShort(e, w) {
        var c = code(e, w), n = e[w + '_airport'] || '';
        if (vm.disp.place === 'name' && n) { return { t: n, title: c, icao: false }; }
        return { t: c || n || '—', title: n, icao: true };
    }
    function view(e) {
        var v = e._v = {};
        v.date = F.fDay(e.flight_date);
        v.dep = placeShort(e, 'departure'); v.arr = placeShort(e, 'arrival');
        v.local = !!(e._dep && e._dep === e._arr);
        COLS.forEach(function (c) { if (c.f) { v[c.k] = c.int ? (e[c.f] ? String(e[c.f]) : '') : (e[c.f] ? fmtH(e[c.f]) : ''); } });
        v.nightEst = !!(e.night_time && e.night_estimated);
        v.time = fmtH(e.total_time);
        v.ldg = e.day_landings + e.night_landings;
        v.nightH = e.night_time ? fmtH(e.night_time) : '';
        v.aria = F.fDayLong(e.flight_date) + ', ' + routeText(e) + ', ' + F.hm(e.total_time);
        v.day = F.pd(e.flight_date).getDate(); v.mon = F.MON[F.pd(e.flight_date).getMonth()];
    }
    function buildRows() {
        var groups = [], cur = null, shown = 0;
        vm.vis.forEach(function (e) {
            var m = e.flight_date.slice(0, 7);
            if (!cur || cur.key !== m) { cur = { key: m, rows: [], all: [] }; groups.push(cur); }
            cur.all.push(e);
            if (shown < vm.limit) { view(e); cur.rows.push(e); shown++; }
        });
        groups.forEach(function (g) {
            var t = sum(g.all), d = F.pd(g.key + '-01');
            g.short = F.MON[d.getMonth()] + ' ' + d.getFullYear(); g.long = F.monthLabel(g.key + '-01');
            g.n = F.plural(g.all.length, 'flight'); g.tot = fmtH(t.total_time);
        });
        vm.groups = groups.filter(function (g) { return g.rows.length; });
        vm.hiddenN = vm.vis.length - shown;
    }
    vm.showAll = function () { vm.limit = 100000; buildRows(); };
    function buildFoot() {
        var all = vm.entries || [], f = vm.f, foot = [], bf = rangeStart();
        function frow(cls, label, sub, list) {
            var t = sum(list);
            return { cls: cls, label: label, sub: sub, cells: vm.after.map(function (c) { return { k: c.k, gs: c.gs, num: !!c.f, v: c.f ? (c.int ? String(t[c.f]) : fmtH(t[c.f])) : '' }; }) };
        }
        if (vm.narrowed) { foot.push(frow('', 'Shown', vm.vis.length + ' of ' + F.plural(all.length, 'flight'), vm.vis)); }
        if (bf && f.src === 'all' && f.ac === 'all' && !f.signed) { foot.push(frow('', 'Brought forward', 'before ' + F.fDate(bf), all.filter(function (e) { return e.flight_date < bf; }))); }
        foot.push(frow('lgb-foot--grand', vm.narrowed ? 'Logbook total' : 'Total', F.plural(all.length, 'flight') + ' to date', all));
        vm.foot = foot;
        function facts(x) { return { total: fmtH(x.total_time), pic: fmtH(x.pic_time), dual: fmtH(x.dual_time), night: fmtH(x.night_time), ldg: x.day_landings + ' day · ' + x.night_landings + ' night', flights: x.flights }; }
        var ta = sum(all);
        vm.ptot = { label: vm.narrowed ? 'Total of the ' + vm.vis.length + ' flights shown' : 'Logbook total', x: facts(sum(vm.vis)),
            allLabel: 'Logbook total · ' + F.plural(all.length, 'flight'), allLine: fmtH(ta.total_time) + ' total · ' + fmtH(ta.pic_time) + ' PIC · ' + fmtH(ta.dual_time) + ' dual' };
        vm.barHint = F.plural(all.length, 'flight') + ' · ' + fmtH(ta.total_time);
    }

    // ── filters ──
    vm.setRange = function (r) { vm.f.range = r; vm.open = null; recompute(); };
    vm.datesChanged = function () {
        // a From after the To read "You didn't fly between these dates" — put them in order (UX pass 2)
        if (vm.f.from && vm.f.to && vm.f.from > vm.f.to) { var x = vm.f.from; vm.f.from = vm.f.to; vm.f.to = x; }
        vm.open = null; recompute();
    };
    vm.setSrc = function (s) { vm.f.src = s; vm.open = null; recompute(); };
    vm.toggleSigned = function () { vm.f.signed = !vm.f.signed; vm.open = null; recompute(); };
    vm.clearFilters = function () { vm.f.range = 'all'; vm.f.src = 'all'; vm.f.ac = 'all'; vm.f.signed = false; vm.acQ = ''; vm.open = null; recompute(); };
    vm.toggleMenu = function (m, ev) { if (ev) { ev.stopPropagation(); } vm.menu = vm.menu === m ? null : m; };

    // ── the aircraft filter (picker B over the pilot's own aircraft, with class and type) ──
    function acSets(list, field, label) {
        var m = {}, out = [];
        list.forEach(function (a) {
            var k = a[field]; if (!k) { return; }
            var g = m[k] || (m[k] = { k: k, label: label(k), n: 0, h: 0, ac: 0, name: acName(a) });
            if (g.name !== acName(a)) { g.name = a.make || ''; }
            g.n += a.n; g.h += a.h; g.ac++;
        });
        Object.keys(m).forEach(function (k) { out.push(m[k]); });
        return out.sort(function (a, b) { return b.h - a.h; });
    }
    vm.acGroups = function (q) {
        q = (q || '').trim();
        var base = vm.base || [], list = flownAc(base), groups = [], f = vm.f;
        var hits = q ? M.matches(list, q, acHay, true) : list;
        var classes = acSets(list, 'cls', clsShort), types = acSets(list, 'type', String);
        function acWord(n) { return n + ' aircraft'; }
        if (!q) {
            groups.push({ rows: [{ key: 'all', lead: 'fa-plane', t: 'All aircraft', s: acWord(list.length) + ' in your logbook', r: F.plural(base.length, 'flight'), rs: fmtH(sum(base).total_time), on: f.ac === 'all', noHl: true }] });
            if (classes.length > 1 || types.length > 1) {
                var chips = [];
                if (classes.length > 1) { classes.forEach(function (g) { chips.push({ key: 'class:' + g.k, label: g.label, n: g.n, on: f.ac === 'class:' + g.k, title: (g.name || g.label) + ' · ' + acWord(g.ac) }); }); if (types.length > 1) { chips.push({ sep: true }); } }
                if (types.length > 1) { types.forEach(function (g) { chips.push({ key: 'type:' + g.k, label: g.label, n: g.n, on: f.ac === 'type:' + g.k, title: (g.name || g.label) + ' · ' + acWord(g.ac) }); }); }
                groups.push({ label: 'Class and type', chips: chips });
            }
        } else {
            var short = M.norm(q).length < 3 && hits.some(function (a) { return M.score(a.reg, '', q) >= 70; });
            var setHit = function (g) { return !short && M.toks(q).every(function (t) { return M.wordHit(g.label + ' ' + g.name, t); }); };
            var setRow = function (kind, g) {
                return { key: kind + ':' + g.k, lead: kind === 'type' ? 'fa-layer-group' : 'fa-certificate', t: 'All ' + g.label, s: (kind === 'type' && g.name ? g.name + ' · ' : '') + acWord(g.ac),
                    r: g.n ? F.plural(g.n, 'flight') : 'None shown', rs: g.n ? fmtH(g.h) : '', quiet: !g.n };
            };
            if (classes.length > 1) { groups.push({ label: 'By class', rows: classes.filter(setHit).map(function (g) { return setRow('class', g); }) }); }
            if (types.length > 1) { groups.push({ label: 'By type', rows: types.filter(setHit).map(function (g) { return setRow('type', g); }) }); }
        }
        groups.push({ label: 'Aircraft', right: q ? hits.length + (hits.length === 1 ? ' match' : ' matches') : acWord(list.length),
            rows: hits.map(function (a) { return { key: a.reg, ac: a.colour || null, t: a.reg, s: acName(a) + (a.cls ? ' · ' + clsShort(a.cls) : ''), r: a.n ? F.plural(a.n, 'flight') : 'None shown', rs: a.n ? 'last ' + shortDate(a.last) : '', on: !q && f.ac === a.reg, quiet: !a.n }; }) });
        return { groups: groups, empty: { t: 'No aircraft matches “' + q + '”', s: 'Try the last two letters of the registration, or a type like C152.' } };
    };
    vm.acPick = function (key) { vm.f.ac = key; vm.open = null; recompute(); };
    vm.acClear = function () { vm.f.ac = 'all'; vm.open = null; recompute(); };
    function acComboState() {
        var v = vm.f.ac, set = v !== 'all' && v.indexOf(':') > 0;
        var one = (v !== 'all' && !set) ? (vm.entries || []).filter(function (e) { return e.registration === v; })[0] : null;
        vm.acValue = one ? { ac: { reg: one.registration, type: one.aircraft_type || '', colour: one._acC, title: one.registration + ' · ' + one._acName } } : set ? { tag: 'All ' + clsShort(v.split(':').slice(1).join(':')) } : null;
        vm.acSummary = { b: F.plural(vm.vis.length, 'flight') };
    }

    // ── a flight opened in place ──
    function buildDetail(e) {
        if (!e) { return; }
        var ci = vm.capInfo(e.capacity);
        var who = (e.capacity === 'PUT' || e.capacity === 'PICUS') ? { k: 'Instructor', v: e.instructor_name || '—', av: !!e.instructor_name }
            : e._solo ? { k: 'Solo', v: 'Authorised by ' + e.instructor_name } : { k: 'PIC', v: 'Self' };
        e._d = {
            dateLong: F.fDayLong(e.flight_date),
            acLine: [e._acName, e.aircraft_class].filter(Boolean).join(', '),
            role: ci.long, roleTime: fmtH(e.total_time),
            who: who,
            night: fmtH(e.night_time), nightEst: !!(e.night_time && e.night_estimated),
            ldg: e.day_landings + ' by day · ' + e.night_landings + ' at night',
            xc: e.cross_country_time ? fmtH(e.cross_country_time) : '',
            ifr: e.ifr_time ? fmtH(e.ifr_time) : '',
            src: e._srcInfo.long,
            ends: (e.endorsements || []).map(function (r) { var s = endStatus(r); return { r: r, s: s, pill: s.tone === 'pend' ? 'Pending' : s.label, sub: (endName(r) || 'Your instructor') + (s.tone === 'pend' ? ' · ' + s.label.toLowerCase() : '') }; })
        };
        ensureInsNames(e);
    }
    vm.toggle = function (e) {
        vm.open = vm.open === e._k ? null : e._k;
        vm.del = null; vm.hl = null; vm.menu = null;
        if (vm.open) { buildDetail(e); }
    };
    vm.rowKey = function (ev, e) { if (ev.target !== ev.currentTarget) { return; } if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); vm.toggle(e); } };
    vm.stop = function (ev) { if (ev) { ev.stopPropagation(); } };
    vm.toggleWx = function (e) { e._wx = !e._wx; };
    vm.replay = function (e, ev) {
        if (ev) { ev.stopPropagation(); }
        if (!e._canReplay) { return; }
        $state.go('dashboard.flight_replay', { flight_id: e.ref_id, src: e.kind === 'manual' ? 'sd' : undefined });
    };
    vm.edit = function (e) { if (e.kind !== 'manual') { return; } $state.go('dashboard.my_account.logbook_edit', { entry_id: e.ref_id }); };
    vm.askDel = function (e) { vm.del = e._k; };
    vm.keepDel = function () { vm.del = null; };
    vm.confirmDel = function (e) {
        return PersonalLogbookService.DeleteManual(e.ref_id).then(function (data) {
            if (data && data.success) {
                ToastService.success('Flight deleted', 'It’s no longer in your logbook.');
                vm.entries = vm.entries.filter(function (x) { return x !== e; });
                vm.open = null; vm.del = null;
                recompute();
                loadCurrency();
            } else {
                ToastService.error('Could not delete the flight', (data && data.message) || 'Please try again.');
            }
        });
    };

    // ── export (the dates chosen; CSV or Excel) ──
    vm.exportAs = function (fmt) {
        vm.menu = null;
        if (vm.exporting) { return; }
        var f = {}, s = rangeStart();
        if (s) { f.from = s; }
        if (vm.f.range === 'custom' && vm.f.to) { f.to = vm.f.to; }
        vm.exporting = true;
        PersonalLogbookService.Download(fmt, f).then(function (res) {
            vm.exporting = false;
            if (res && res.success) { ToastService.success('Export ready', 'Your logbook is downloading.'); }
            else { ToastService.error('Export failed', (res && res.message) || 'Please try again.'); }
        });
    };

    // ── signatures & endorsements dialogs ──
    function lineHead(e, eyebrow, icon) {
        var s = e._stamp;
        return { eyebrow: eyebrow, icon: icon, title: F.fDayLong(e.flight_date) + ' · ' + (e.registration || '—'),
            sub: routeText(e) + ' · ' + F.hm(e.total_time) + ' ' + vm.capInfo(e.capacity).label + ' · ' + (e.source || ''),
            edge: s === 'good' ? 'var(--ta-good)' : s === 'pend' ? 'var(--ta-brand-2)' : 'var(--ta-line-2)' };
    }
    function focusDlg() { $timeout(function () { var x = document.querySelector('.ta-dlg .ta-dlg__x'); if (x) { x.focus(); } }, 60); }
    // LogbookEndorsementsService resolves an HTTP error with its raw body: an HTML error page is a string, which passed every
    // `data.success !== false` test below (UX pass 2) — anything that isn't an object is a failure
    function asObj(d) { return d && typeof d === 'object' ? d : { success: false }; }
    function loadLine(e) {
        return LogbookEndorsementsService.ForLine(e.kind, e.ref_id).then(function (data) {
            data = asObj(data);
            if (!vm.dlg || vm.dlg.e !== e) { return; }
            vm.dlg.loading = false;
            if (!data || data.success === false) {
                ToastService.error('Could not load the signatures', (data && data.message) || 'Please try again.');
                vm.dlg.rows = (e.endorsements || []).map(function (r) { return stampRow(r, e); });
                return;
            }
            var rows = data.endorsements || [];
            e.endorsements = rows;
            refreshStamp(e); buildDetail(e);
            vm.dlg.head = lineHead(e, 'Signatures & endorsements', 'fa-stamp');
            vm.dlg.rows = rows.map(function (r) { return stampRow(r, e); });
            ensureInsNames(e);
            recompute();
        });
    }
    /* a stamp row: its instructor's colour is the row's own when sent, else the line's instructor colour when it's the same person */
    function stampRow(r, e) {
        var c = r.instructor_colour || (e._insC && endName(r) && M.norm(endName(r)) === M.norm(e.instructor_name) ? e._insC : null);
        return { r: r, s: endStatus(r), c: c };
    }
    vm.openStamps = function (e, ev) {
        if (ev) { ev.stopPropagation(); }
        vm.menu = null;
        vm.dlg = { t: 'end', e: e, head: lineHead(e, 'Signatures & endorsements', 'fa-stamp'), loading: true, rows: [] };
        focusDlg();
        loadLine(e);
    };
    // closing (×, Esc, the scrim, Done, Back) never throws typed words away without asking
    function dlgDirty() {
        var d = vm.dlg; if (!d) { return false; }
        if (d.t === 'req') { return !!(d.pick || (d.note || '').trim()); }
        if (d.t === 'ext') { var x = d.x || {}; return !!((x.name || '').trim() || (x.num || '').trim() || (x.email || '').trim() || (x.text || '').trim() || x.sig); }
        if (d.t === 'checks') { return !!(vm.ck && vm.ck.form && (vm.ck.form.name || '').trim()); }
        return false;
    }
    vm.closeDlg = function (force) {
        if (!force && vm.dlg && !vm.dlgBusy && dlgDirty()) { vm.dlg.ask = 'close'; focusAsk(); return; }
        vm.dlg = null; vm.dlgBusy = false;
    };
    vm.dlgBack = function () {   // "Back" from requesting / recording to the line's signatures
        if (vm.dlg && dlgDirty()) { vm.dlg.ask = 'back'; focusAsk(); return; }
        vm.openStamps(vm.dlg.e);
    };
    vm.dlgKeep = function () { if (vm.dlg) { vm.dlg.ask = null; } };
    vm.dlgDiscard = function () { var d = vm.dlg; if (!d) { return; } if (d.ask === 'back') { vm.openStamps(d.e); } else { vm.closeDlg(true); } };
    function focusAsk() { $timeout(function () { var b = document.querySelector('.lgb-ask__keep'); if (b) { b.focus(); } }, 30); }
    vm.scrim = function (ev) { if (ev.target === ev.currentTarget && !vm.dlgBusy) { if (vm.dlg && vm.dlg.ask) { vm.dlgKeep(); } else { vm.closeDlg(); } } };
    vm.toggleAudit = function (row) {
        row._audit = !row._audit;
        if (row._audit && !row.events) {
            row.auditLoading = true;
            LogbookEndorsementsService.Audit(row.r.id).then(function (data) {
                data = asObj(data);
                row.auditLoading = false;
                if (!data || data.success === false) { ToastService.error('Could not load the history', (data && data.message) || ''); row._audit = false; return; }
                row.events = (data.events || []).map(function (ev) { return { ev: ev, label: vm.auditLabel(ev.action), when: F.fDate(ev.created_at) + ', ' + F.fTime(ev.created_at) }; });
            });
        }
    };
    vm.resend = function (row) {
        if (row.resent) { return; }
        return LogbookEndorsementsService.Resend(row.r.id).then(function (data) {
            data = asObj(data);
            if (data && data.success !== false) { row.resent = true; ToastService.success('Email sent again', 'The confirmation email was sent again.'); }
            else { ToastService.error('Could not send the email', (data && data.message) || ''); }
        });
    };
    vm.askRevoke = function (row) { vm.dlg.rows.forEach(function (x) { x.revoke = false; }); row.revoke = true; };
    vm.keepRevoke = function (row) { row.revoke = false; };
    vm.revoke = function (row) {
        var e = vm.dlg.e;
        return LogbookEndorsementsService.Revoke(row.r.id).then(function (data) {
            data = asObj(data);
            if (data && data.success !== false) { ToastService.success('Endorsement withdrawn', 'It’s no longer on this flight.'); vm.dlg.loading = true; loadLine(e); }
            else { row.revoke = false; ToastService.error('Could not withdraw it', (data && data.message) || ''); }
        });
    };
    vm.openReq = function (e) {
        if (e.kind !== 'club') { return; }
        vm.dlg = { t: 'req', e: e, head: lineHead(e, 'Request instructor signature', 'fa-user-check'), loading: true, list: [], shown: [], q: '', pick: null, note: '', err: '' };
        focusDlg();
        var clubIds = e.club_id ? [e.club_id] : ((vm.user.access && vm.user.access.pilot) || []);
        clubIds = clubIds.filter(function (id, i) { return clubIds.indexOf(id) === i; });
        if (!clubIds.length) { vm.dlg.loading = false; return; }
        var d = vm.dlg;
        $q.all(clubIds.map(function (id) { return InstructorService.GetAllByClub(id, vm.user.id); })).then(function (results) {
            if (vm.dlg !== d) { return; }
            var seen = {};
            d.loading = false;
            rememberIns(results);
            results.forEach(function (data) {
                ((data && data.instructors) || []).forEach(function (i) {
                    var uid = i.user_id || i.id;
                    if (uid && !seen[uid]) { seen[uid] = true; var name = ((i.first_name || '') + ' ' + (i.last_name || '')).trim(); d.list.push({ user_id: uid, name: name, initials: initials(name), colour: i.colour || i.instructor_colour || null }); }
                });
            });
            d.list.sort(function (a, b) { return a.name.localeCompare(b.name); });
            vm.reqFilter();
        });
    };
    vm.reqFilter = function () { var d = vm.dlg, q = (d.q || '').toLowerCase(); d.shown = d.list.filter(function (x) { return !q || x.name.toLowerCase().indexOf(q) > -1; }); };
    vm.reqPick = function (x) { vm.dlg.pick = x; vm.dlg.err = ''; };
    vm.reqClear = function () { vm.dlg.pick = null; vm.dlg.q = ''; vm.reqFilter(); $timeout(function () { var i = document.getElementById('lgb-req-q'); if (i) { i.focus(); } }); };
    vm.reqSend = function () {
        var d = vm.dlg;
        if (!d.pick) { d.err = 'Choose the instructor who should sign this flight'; return; }
        vm.dlgBusy = true;
        return LogbookEndorsementsService.Request(d.e.ref_id, d.pick.user_id, (d.note || '').trim()).then(function (data) {
            data = asObj(data);
            vm.dlgBusy = false;
            if (data && data.success !== false) {
                ToastService.success('Signature requested', d.pick.name + ' will see it in their signing queue.');
                vm.openStamps(d.e);
            } else {
                ToastService.error('Could not send the request', (data && data.message) || 'Please try again.');
            }
        });
    };
    vm.WORDINGS = LogbookEndorsementsService.wordings || [];
    vm.openExt = function (e) {
        vm.dlg = { t: 'ext', e: e, head: lineHead(e, 'Add an external endorsement', 'fa-envelope'), x: { name: '', num: '', email: '', text: '', sig: '' }, err: {}, sigOn: false };
        focusDlg();
    };
    vm.extWord = function (w) { vm.dlg.x.text = w; vm.dlg.err.text = ''; };
    vm.extSave = function () {
        var d = vm.dlg, x = d.x, er = {};
        if (!(x.name || '').trim()) { er.name = 'Enter the instructor’s or examiner’s full name'; }
        if (!(x.email || '').trim()) { er.email = 'Enter their email — they confirm the endorsement from it'; }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email.trim())) { er.email = 'That doesn’t look like an email address'; }
        if (!(x.text || '').trim()) { er.text = 'Pick a wording or type your own'; }
        d.err = er;
        if (Object.keys(er).length) { return; }
        var payload = { entity_type: d.e.kind, entity_id: d.e.ref_id, instructor_name: x.name.trim(), instructor_number: (x.num || '').trim(), instructor_email: x.email.trim(), endorsement_text: x.text.trim() };
        if (x.sig) { payload.signature_image = x.sig; }
        vm.dlgBusy = true;
        return LogbookEndorsementsService.AddExternal(payload).then(function (data) {
            data = asObj(data);
            vm.dlgBusy = false;
            if (data && data.success) { ToastService.success('Endorsement recorded', 'A confirmation email is on its way to ' + payload.instructor_name + '.'); vm.openStamps(d.e); }
            else if (data && data.id) { ToastService.warning('Saved — email not sent', 'Check the address, then use Send the email again.'); vm.openStamps(d.e); }
            else { ToastService.error('Could not save the endorsement', (data && data.message) || 'Please try again.'); }
        });
    };

    // ════════════════════════════════════════════
    // ADD / EDIT A FLIGHT
    // ════════════════════════════════════════════
    function blankForm() {
        return { date: '', dep: null, depQ: '', arr: null, arrQ: '', off: '', on: '', reg: '', make: '', model: '', type: '', cls: '', engine: 'single', multi: false, sim: false, simType: '',
            cap: 'P1', manualTotal: false, total: '', night: '', nightEst: 0, ifr: '', xc: '', ldd: 1, ldn: 0, instr: '', club: '', remarks: '', found: null, pre: {} };
    }
    function toHHMM(t) { if (!t) { return ''; } var m = String(t).match(/^(\d{1,2}):(\d{2})/); return m ? F.p2(+m[1]) + ':' + m[2] : String(t); }
    function minsOf(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); if (!m) { return null; } var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) { return null; } return h * 60 + mi; }
    function dur(off, on) { var a = minsOf(off), b = minsOf(on); if (a == null || b == null) { return 0; } var d = b - a; if (d < 0) { d += 1440; } return d / 60; }
    function classOk(c) {
        c = String(c || '').trim(); if (!c) { return ''; }
        if (CLASSES.indexOf(c) > -1) { return c; }
        var u = c.toUpperCase();
        if (u === 'SEP') { return 'SEP (land)'; } if (u === 'MEP') { return 'MEP (land)'; } if (u === 'SET') { return 'SET (land)'; }
        return '';
    }
    function initForm() {
        vm.isEdit = vm.screen === 'edit';
        vm.form = blankForm();
        if (!vm.isEdit) { vm.form.date = vm.T; }   // owner, 9 Nov: a new flight starts on today (the usual case is "I just flew")
        vm.ferr = {};
        vm.classes = CLASSES.slice();
        vm.dateOpts = { max: vm.T, shortcuts: false, dots: false };
        vm.af = { dep: { list: [], busy: false }, arr: { list: [], busy: false } };
        vm.regQ = ''; vm.cbVer = 0; vm.regBusy = false;
        vm.rs = { q: null, res: null, busy: false, seq: 0, flown: null, failed: false, rows: {} };
        regState();
        // "Flown before" (the 6 most recent) for the empty picker — backend C7
        LogbookV2Data.SearchAircraft('', 6).then(function (data) {
            if (data && data.success !== false) { vm.rs.flown = rowsOf(data, 'log'); vm.cbVer++; } else { vm.rs.failed = true; }
        });
        if (vm.isEdit) {
            vm.loading = true;
            PersonalLogbookService.GetManual($stateParams.entry_id).then(function (row) {
                vm.loading = false;
                if (!row || row.success === false || !row.id) {
                    var gone = !row || row.status === 404 || row.error === 'NOT_FOUND' || (row && row.success !== false && !row.id);
                    if (gone) { ToastService.error('Flight not found', 'It may have been deleted. Here’s your logbook.'); }
                    else { ToastService.error('That flight didn’t load', 'Check your connection, then open it again from your logbook.'); }
                    $state.go(GO.logbook);
                    return;
                }
                formFrom(row);
                snapForm();
            });
        } else { snapForm(); }
    }
    // ── leaving the form with unsaved changes asks first (Cancel, the menu, Back to classic designs…); the browser asks on reload ──
    function formSig() {
        var f = vm.form || {};
        return JSON.stringify([f.date, f.off, f.on, f.dep && (f.dep.id || f.dep.code), f.arr && (f.arr.id || f.arr.code), f.depQ, f.arrQ, f.reg, f.make, f.model, f.type, f.cls, f.engine,
            f.multi, f.sim, f.simType, f.cap, f.manualTotal, f.total, f.night, f.ifr, f.xc, f.ldd, f.ldn, f.instr, f.club, f.remarks, vm.regQ || '']);
    }
    function snapForm() { $timeout(function () { vm.formSnap = formSig(); }, 0); }
    vm.formDirty = function () { return !!(vm.formSnap && !vm.leaveOk && formSig() !== vm.formSnap); };
    // the same question on the import / SkyDemon "Check & match" review (its row fixes would be lost)
    function leaveNeeded() {
        if (vm.leaveOk) { return false; }
        if (vm.screen === 'add' || vm.screen === 'edit') { return vm.formDirty(); }
        if (vm.screen === 'import') { return !!(vm.imp && vm.imp.step === 'review'); }
        if (vm.screen === 'skydemon') { return !!(vm.sd && vm.sd.step === 'review'); }
        return false;
    }
    vm.askRestart = function (kind) {   // "Start over" on a review asks too
        if (!leaveNeeded()) { if (kind === 'sd') { vm.sdRestart(); } else { vm.impRestart(); } return; }
        vm.leaveAsk = { restart: kind };
        $timeout(function () { var b = document.querySelector('.lgb-leave__keep'); if (b) { b.focus(); } }, 30);
    };
    $scope.$on('$stateChangeStart', function (ev, to, toParams) {
        if (['add', 'edit', 'import', 'skydemon'].indexOf(vm.screen) < 0) { return; }
        if (ev.defaultPrevented || !leaveNeeded()) { return; }
        ev.preventDefault();
        vm.leaveAsk = { to: to.name, params: toParams };
        $timeout(function () { var b = document.querySelector('.lgb-leave__keep'); if (b) { b.focus(); } }, 30);
    });
    vm.leaveKeep = function () {
        vm.leaveAsk = null;
        // "Back to classic designs" switched the designs off before asking: put the switch back, we're staying here
        if (!DesignService.isV2()) { DesignService.set(true); }
    };
    vm.leaveGo = function () {
        var a = vm.leaveAsk; vm.leaveAsk = null;
        if (a && a.restart) { if (a.restart === 'sd') { vm.sdRestart(); } else { vm.impRestart(); } return; }
        vm.leaveOk = true; if (a) { $state.go(a.to, a.params); }
    };
    function onUnload(ev) { if (leaveNeeded()) { ev.preventDefault(); ev.returnValue = ''; return ''; } }
    $window.addEventListener('beforeunload', onUnload);
    $scope.$on('$destroy', function () { $window.removeEventListener('beforeunload', onUnload); });
    function formFrom(row) {
        var f = vm.form, tot = num(row.total_time);
        f.date = String(row.flight_date || '').slice(0, 10);
        f.off = toHHMM(row.departure_time); f.on = toHHMM(row.arrival_time);
        f.dep = (+row.departure_airfield_id || row.departure_place) ? { id: +row.departure_airfield_id || 0, code: row.departure_place || '', title: null } : null;
        f.arr = (+row.arrival_airfield_id || row.arrival_place) ? { id: +row.arrival_airfield_id || 0, code: row.arrival_place || '', title: null } : null;
        f.reg = row.registration || ''; f.colour = row.aircraft_colour || null; f.make = row.aircraft_make || ''; f.model = cleanModel(row.aircraft_model); f.type = row.aircraft_type || ''; f.cls = row.aircraft_class || '';
        if (f.cls && vm.classes.indexOf(f.cls) < 0) { vm.classes.push(f.cls); }
        f.engine = row.engine_type === 'multi' ? 'multi' : 'single';
        f.multi = +row.multi_pilot === 1; f.sim = +row.is_simulator === 1; f.simType = row.sim_type || '';
        f.cap = CAP[row.capacity] ? row.capacity : 'P1';
        f.manualTotal = !(minsOf(f.off) !== null && minsOf(f.on) !== null) || f.sim || Math.abs(dur(f.off, f.on) - tot) > 0.02;
        f.total = f.manualTotal && tot ? F.hm(tot) : '';
        f.night = (row.night_time !== null && row.night_time !== undefined && num(row.night_time) > 0) ? F.hm(num(row.night_time)) : '';
        f.nightEst = row.computed_night_time != null ? num(row.computed_night_time) : 0;
        f.ifr = num(row.ifr_time) ? F.hm(num(row.ifr_time)) : ''; f.xc = num(row.cross_country_time) ? F.hm(num(row.cross_country_time)) : '';
        f.ldd = parseInt(row.day_landings, 10) || 0; f.ldn = parseInt(row.night_landings, 10) || 0;
        f.instr = row.instructor_name || ''; f.club = row.external_club_name || ''; f.remarks = row.remarks || '';
        vm.isSd = row.source === 'skydemon';
        regState();
        // airfield names for the codes on file (best effort — the codes alone are fine)
        ['dep', 'arr'].forEach(function (w) {
            var a = f[w]; if (!a || !a.code) { return; }
            PersonalLogbookService.SearchAirfields(String(a.code).replace(/\s/g, '_')).then(function (data) {
                var list = (data && angular.isArray(data.airfields)) ? data.airfields : [];
                var hit = list.filter(function (x) { return (a.id && +x.id === a.id) || String(x.code || '').toUpperCase() === String(a.code).toUpperCase(); })[0];
                if (hit && f[w] === a) { a.title = hit.title || null; if (!a.id) { a.id = +hit.id || 0; } }
            });
        });
    }
    vm.total = function () {
        var f = vm.form; if (!f) { return 0; }
        if (f.manualTotal || f.sim) { var v = F.parseHM(f.total); return (v == null || isNaN(v)) ? 0 : v; }
        return dur(f.off, f.on);
    };
    vm.pastMidnight = function () { var a = minsOf(vm.form.off), b = minsOf(vm.form.on); return a !== null && b !== null && b < a; };
    vm.manTot = function () {
        var f = vm.form, t = vm.total();
        f.manualTotal = !f.manualTotal;
        f.total = f.manualTotal && t ? F.hm(t) : '';
        vm.ferr.total = '';
    };
    vm.simChanged = function () { if (vm.form.sim) { vm.form.manualTotal = true; } };
    vm.setCap = function (c) { vm.form.cap = c; };
    vm.setEngine = function (e) { vm.form.engine = e; };
    vm.stepL = function (k, d) { vm.form[k] = Math.max(0, (parseInt(vm.form[k], 10) || 0) + d); };
    vm.normTime = function (k) {
        var v = String(vm.form[k] || '').trim(), m = /^(\d{1,2})[:.h]?(\d{2})$/.exec(v);
        if (m) { vm.form[k] = F.p2(+m[1]) + ':' + m[2]; }
        if (vm.ferr[k] && minsOf(vm.form[k]) !== null) { vm.ferr[k] = ''; }
    };
    vm.clearErr = function (k) { if (vm.ferr[k]) { vm.ferr[k] = ''; } };
    vm.unpre = function (k) { if (vm.form.pre[k]) { vm.form.pre[k] = false; } };
    vm.capHint = function () { var ci = vm.capInfo(vm.form.cap); return ci.long + ' — the total goes in your ' + ci.label + ' column.'; };
    vm.countsAs = function () {
        var t = vm.total(), f = vm.form, l = (f.ldd || 0) + (f.ldn || 0);
        return t ? 'Counts as ' + F.hm(t) + ' ' + vm.capInfo(f.cap).label + (l ? ' · ' + F.plural(l, 'landing') : '') : 'Add the date and times to work out the total';
    };

    // ── airfields (shared registry search; "use as typed" for strips) ──
    var afT = {};
    vm.afType = function (w) {
        var q = vm.form[w + 'Q'] || '';
        if (afT[w]) { $timeout.cancel(afT[w]); }
        vm.af[w].list = [];
        if (q.trim().length < 2) { vm.af[w].busy = false; return; }
        vm.af[w].busy = true;
        afT[w] = $timeout(function () {
            var asked = q;
            PersonalLogbookService.SearchAirfields(q.trim().replace(/\s/g, '_')).then(function (data) {
                if (vm.form[w + 'Q'] !== asked) { return; }
                vm.af[w].busy = false;
                vm.af[w].list = (data && data.success !== false && angular.isArray(data.airfields)) ? data.airfields.slice(0, 6) : [];
            });
        }, 250);
    };
    vm.afPick = function (w, a) {
        var f = vm.form;
        f[w] = a ? { id: +a.id || 0, code: a.code || a.title || '', title: a.title || null } : { id: 0, code: (f[w + 'Q'] || '').trim().toUpperCase(), title: null };
        f[w + 'Q'] = ''; vm.af[w].list = []; vm.af[w].busy = false;
        vm.clearErr(w);
    };
    vm.afClear = function (w) { vm.form[w] = null; $timeout(function () { var i = document.getElementById('lgb-f-' + w); if (i) { i.focus(); } }); };

    // ── registration: picker B over your logbook, the ToAviate club fleets and the aircraft register (backend C7);
    //    a full registration typed and left (Tab, click away) is looked up; the v1 lookup is the fallback if that fails ──
    function regState() {
        var f = vm.form;
        vm.regValue = f && f.reg ? { ac: { reg: f.reg, type: f.type || '', colour: f.colour || null, title: f.reg } } : null;
        vm.regSummary = f && f.reg && acName(f) ? { pre: acName({ make: f.make, model: f.model, type: f.type }) } : null;
    }
    function regUnfill() { var f = vm.form; ['make', 'model', 'type', 'cls'].forEach(function (k) { if (f.pre[k]) { f[k] = ''; } }); f.pre = {}; f.colour = null; }
    /* a class from the C7 search is the owner's rule (or '' when unsure), so it is trusted even when it isn't one of the
       usual list (Motor glider, Gyroplane…); a class from the v1 lookup only when it is one of ours */
    function useClass(c, trusted) {
        c = String(c || '').trim();
        if (!c) { return ''; }
        if (trusted) { if (vm.classes.indexOf(c) < 0) { vm.classes.push(c); } return c; }
        return classOk(c);
    }
    /* picking is a clear choice, so it replaces whatever the last aircraft filled in */
    function fillAc(a, via, trusted) {
        var f = vm.form;
        regUnfill();
        f.reg = String(a.reg || '').toUpperCase(); f.found = via;
        f.make = a.make && a.make !== '-' ? a.make : ''; f.model = cleanModel(a.model); f.type = a.type && a.type !== '-' ? a.type : ''; f.cls = useClass(a.cls, trusted);
        if (a.engine === 'single' || a.engine === 'multi') { f.engine = a.engine; }
        f.colour = a.colour || null;
        f.pre = { make: !!f.make, model: !!f.model, type: !!f.type, cls: !!f.cls };
        regState();
    }
    function fromRow(r) {
        var n = parseInt(r.engines, 10);
        return { reg: r.reg, make: r.make, model: r.model, type: r.type, cls: r['class'], engine: n > 1 ? 'multi' : n === 1 ? 'single' : '', colour: r.colour || null };
    }
    function viaOf(r) { return r.via === 'fleet' ? 'fleet' : r.via === 'register' ? 'register' : 'log'; }
    function rowsOf(data, source) { var g = ((data && data.groups) || []).filter(function (x) { return x.source === source; })[0]; return (g && g.rows) || []; }
    function rowFor(r, q) {
        var key = 'pick:' + M.norm(r.reg);
        vm.rs.rows[key] = r;
        return { key: key, t: r.reg, s: acName({ make: r.make, model: cleanModel(r.model), type: r.type }) + (r['class'] ? ' · ' + clsShort(r['class']) : ''), ac: r.colour || null,
            r: r.via === 'log' && r.flights ? F.plural(+r.flights, 'flight') : '', rs: r.via === 'log' && r.last ? 'last ' + shortDate(r.last) : '' };
    }
    /* the old v1 lookup (exact registration) — only when the C7 lookup fails */
    function lookupV1(reg) {
        vm.regBusy = true;
        PersonalLogbookService.LookupAircraft(reg).then(function (data) {
            vm.regBusy = false;
            if (vm.form.reg !== reg) { return; }
            if (data && data.found) {
                fillAc({ reg: data.registration || reg, make: data.make, model: data.model, type: data.type, cls: data.class, engine: data.engine_type }, data.source === 'fleet' ? 'fleet' : 'register', false);
            } else { vm.form.found = 'typed'; }
        });
    }
    function lookupTyped(q) {
        var f = vm.form, reg = String(q || '').trim().toUpperCase();
        if (!reg) { return; }
        var res = vm.rs.res;
        if (res && vm.rs.q === String(q).trim() && res.exact) { fillAc(fromRow(res.exact), viaOf(res.exact), true); return; }
        regUnfill();
        f.reg = reg; f.found = null;
        regState();
        vm.regBusy = true;
        LogbookV2Data.LookupAircraft(reg).then(function (data) {
            vm.regBusy = false;
            if (vm.form.reg !== reg) { return; }
            if (!data || data.success === false) { lookupV1(reg); return; }
            if (data.aircraft) { fillAc(fromRow(data.aircraft), viaOf(data.aircraft), true); } else { vm.form.found = 'typed'; }
        });
    }
    var regTimer = null;
    vm.regTyped = function (q) {
        q = (q || '').trim();
        if (regTimer) { $timeout.cancel(regTimer); regTimer = null; }
        if (!q) { vm.rs.busy = false; return; }
        if (vm.rs.q === q && vm.rs.res) { vm.rs.busy = false; return; }
        vm.rs.busy = true;
        var seq = ++vm.rs.seq;
        regTimer = $timeout(function () {
            LogbookV2Data.SearchAircraft(q, 8).then(function (data) {
                if (seq !== vm.rs.seq) { return; }          // the latest answer wins
                vm.rs.busy = false;
                if (!data || data.success === false) { vm.rs.failed = true; vm.rs.q = q; vm.rs.res = null; }
                else { vm.rs.failed = false; vm.rs.q = q; vm.rs.res = data; }
                vm.cbVer++;
            });
        }, 250);
    };
    vm.regGroups = function (q) {
        q = (q || '').trim();
        var groups = [], rs = vm.rs;
        rs.rows = {};
        if (!q) {
            return { groups: [{ label: 'Flown before', rows: (rs.flown || []).map(function (r) { return rowFor(r, q); }) }],
                busy: rs.flown ? '' : (rs.failed ? '' : 'Loading the aircraft you’ve flown…'),
                empty: { t: 'Search every aircraft we know', s: 'Type the registration, or just its last letters.' } };
        }
        var fresh = rs.res && rs.q === q;
        if (fresh) {
            (rs.res.groups || []).forEach(function (g) {
                var right = g.source === 'register' ? (g.total > (g.rows || []).length ? 'First ' + g.rows.length + ' of ' + g.total : g.total + (g.total === 1 ? ' match' : ' matches')) : '';
                groups.push({ label: g.label || (g.source === 'log' ? 'Flown before' : g.source === 'fleet' ? 'ToAviate clubs' : 'Aircraft register'), right: right, rows: (g.rows || []).map(function (r) { return rowFor(r, q); }) });
            });
        } else {
            // while the search runs: the aircraft you've flown that already match, so something shows at once
            var mine = (rs.flown || []).filter(function (r) { return M.score(r.reg, [r.make, r.model, r.type].join(' '), q) > 0; });
            groups.push({ label: 'Flown before', rows: mine.map(function (r) { return rowFor(r, q); }) });
        }
        var exact = fresh && rs.res.exact;
        if (!exact && M.norm(q).length >= 2 && (fresh || rs.failed) && !rs.busy) {
            groups.push({ label: 'Not listed?', rows: [{ key: 'typed:' + q, lead: 'fa-pen', t: 'Use “' + q.toUpperCase() + '” as typed', s: 'You add the details below', noHl: true }] });
        }
        return { groups: groups, busy: rs.busy ? 'Searching the aircraft register…' : '',
            empty: M.norm(q).length < 2 ? { t: 'Keep typing', s: 'Two letters or more searches the aircraft register.' } : { t: 'No aircraft matches “' + q + '”', s: 'Check the registration, or use it as typed.' } };
    };
    vm.regPick = function (key) {
        regStop();
        if (key.indexOf('typed:') === 0) {
            var reg = key.slice(6).trim().toUpperCase();
            if (vm.rs.failed) { lookupTyped(reg); return; }     // the search is down: try the lookups before "as typed"
            regUnfill(); vm.form.reg = reg; vm.form.found = 'typed'; regState(); return;
        }
        var r = vm.rs.rows[key];
        if (r) { fillAc(fromRow(r), viaOf(r), true); }
    };
    function regStop() { if (regTimer) { $timeout.cancel(regTimer); regTimer = null; } vm.rs.seq++; vm.rs.busy = false; }
    vm.regLeave = function (q) {
        regStop();
        q = (q || '').trim();
        if (M.norm(q).length >= 2) { lookupTyped(q); }
        vm.regQ = '';
    };
    vm.regClear = function () { regUnfill(); vm.form.reg = ''; vm.form.found = null; regState(); };
    /* returns the same object for the same state (it is watched by the view) */
    var HINTS = {
        log: { ic: 'fa-check-circle', t: 'From your logbook — details filled in below' },
        fleet: { ic: 'fa-check-circle', t: 'A ToAviate club aircraft — details filled in below' },
        register: { ic: 'fa-check-circle', t: 'In the aircraft register — details filled in below' },
        typed: { ic: '', t: 'Not in our records — add the details below' }
    }, busyHint = { ic: 'fa-spinner fa-spin', t: '' };
    vm.regHint = function () {
        var f = vm.form;
        if (vm.regBusy) { busyHint.t = 'Looking up ' + f.reg + '…'; return busyHint; }
        return HINTS[f.found] || null;
    };
    vm.classHint = function () {
        var f = vm.form;
        return (!f.cls && f.reg && f.found && f.found !== 'typed') ? 'We can’t be sure of the class for this aircraft, so please choose it' : 'Your same-class currency checks use this';
    };

    // ── save ──
    vm.save = function () {
        var f = vm.form, er = {}, tot;
        if ((vm.regQ || '').trim()) {
            var typed = vm.regQ.trim(), ex = vm.rs.res && vm.rs.q === typed && vm.rs.res.exact;
            vm.regQ = '';
            if (ex) { fillAc(fromRow(ex), viaOf(ex), true); } else { regUnfill(); f.reg = typed.toUpperCase(); f.found = 'typed'; regState(); }
        }
        tot = vm.total();
        if (!f.date) { er.date = 'Pick the date of the flight'; }
        if (!f.manualTotal && !f.sim) {
            if (f.off && minsOf(f.off) == null) { er.off = 'Use 24-hour time, e.g. 09:05'; }
            if (f.on && minsOf(f.on) == null) { er.on = 'Use 24-hour time, e.g. 10:10'; }
            if (!er.off && !er.on && tot <= 0) { if (!f.off) { er.off = 'Add off blocks'; } if (!f.on) { er.on = 'Add on blocks'; } if (f.off && f.on) { er.on = 'On blocks must differ from off blocks'; } }
        } else {
            if (f.off && minsOf(f.off) == null) { er.off = 'Use 24-hour time, e.g. 09:05'; }
            if (f.on && minsOf(f.on) == null) { er.on = 'Use 24-hour time, e.g. 10:10'; }
            if (!f.sim && tot <= 0) { er.total = isNaN(F.parseHM(f.total)) ? 'Use h:mm, e.g. 1:05' : 'Add the total time, e.g. 1:05'; }
            if (f.sim && f.total && isNaN(F.parseHM(f.total))) { er.total = 'Use h:mm, e.g. 1:05'; }
        }
        ['night', 'ifr', 'xc'].forEach(function (k) {
            if (f[k]) { var v = F.parseHM(f[k]); if (isNaN(v)) { er[k] = 'Use h:mm, e.g. 0:30'; } else if (v > tot + 1e-6) { er[k] = 'Can’t be more than the total (' + F.hm(tot) + ')'; } }
        });
        vm.ferr = er;
        if (Object.keys(er).length) {
            ToastService.warning('Check the highlighted fields', 'Something needs fixing before the flight can be saved.');
            $timeout(function () { var el = document.querySelector('.lgb-entry .ta-field--error'); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30);
            return;
        }
        var capField = CAP[f.cap].f, p = {
            flight_date: f.date,
            departure_airfield_id: f.dep && f.dep.id > 0 ? f.dep.id : null, departure_place: f.dep ? f.dep.code : '',
            arrival_airfield_id: f.arr && f.arr.id > 0 ? f.arr.id : null, arrival_place: f.arr ? f.arr.code : '',
            departure_time: minsOf(f.off) !== null ? f.off : null, arrival_time: minsOf(f.on) !== null ? f.on : null,
            registration: String(f.reg || '').toUpperCase(), aircraft_make: f.make || '', aircraft_model: f.model || '', aircraft_type: f.type || '', aircraft_class: f.cls || '',
            engine_type: f.engine, multi_pilot: f.multi ? 1 : 0, is_simulator: f.sim ? 1 : 0, sim_type: f.sim ? (f.simType || '') : '',
            capacity: f.cap, total_time: round2(tot), pic_time: 0, picus_time: 0, copilot_time: 0, dual_time: 0, instructor_time: 0,
            night_time: f.night ? round2(F.parseHM(f.night)) : null, ifr_time: f.ifr ? round2(F.parseHM(f.ifr)) : 0, cross_country_time: f.xc ? round2(F.parseHM(f.xc)) : 0,
            day_landings: parseInt(f.ldd, 10) || 0, night_landings: parseInt(f.ldn, 10) || 0,
            instructor_name: f.instr || '', remarks: f.remarks || '', external_club_name: f.club || ''
        };
        p[capField] = round2(tot);
        vm.saving = true;
        var call = vm.isEdit ? PersonalLogbookService.UpdateManual($stateParams.entry_id, p) : PersonalLogbookService.AddManual(p);
        return call.then(function (data) {
            vm.saving = false;
            if (data && data.success) {
                try { sessionStorage.setItem('toaviate_lb2_hl', 'manual-' + (vm.isEdit ? $stateParams.entry_id : data.id)); } catch (e) {}
                if (vm.isEdit) { ToastService.success('Flight updated', 'It stays an unverified entry in your logbook.'); }
                else { ToastService.success('Flight added', F.hm(tot) + ' ' + vm.capInfo(f.cap).label + ' on ' + F.fDate(f.date)); }
                vm.leaveOk = true;
                $state.go(GO.logbook);
            } else {
                ToastService.error('Could not save the flight', (data && data.message) || 'Check the fields and try again.');
            }
        });
    };

    // ════════════════════════════════════════════
    // STATISTICS
    // ════════════════════════════════════════════
    function initStats() {
        vm.PERIODS = [['1m', '1 month'], ['6m', '6 months'], ['12m', '12 months'], ['24m', '24 months'], ['all', 'All time']];
        vm.period = 'all'; vm.monthTable = false;
        vm.loading = true;
        $q.all([PersonalLogbookService.GetLogbook({}), PersonalLogbookService.GetStats()]).then(function (r) {
            vm.loading = false;
            var a = r[0], b = r[1];
            if (!a || a.success === false) { vm.loadError = true; vm.entries = []; ToastService.error('Could not load your statistics', (a && a.message) || 'Please try again.'); return; }
            vm.entries = (a.entries || []).map(prep);
            vm.sep = (b && b.success !== false && b.sep_currency) ? b.sep_currency : { has_sep: false };
            buildStats();
        });
        loadCurrency();
    }
    vm.retryStats = function () { vm.loadError = false; initStats(); };
    vm.setPeriod = function (p) { vm.period = p; buildStats(); };
    function periodFrom(p) { return { '1m': F.addMonths(vm.T, -1), '6m': F.addMonths(vm.T, -6), '12m': F.addMonths(vm.T, -12), '24m': F.addMonths(vm.T, -24) }[p] || null; }
    function lastMonths(n) { var d = F.pd(vm.T), out = []; for (var i = n - 1; i >= 0; i--) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + F.p2(x.getMonth() + 1)); } return out; }
    function series(all, list, p) {
        var keys, yearly = false;
        if (p === 'all') {
            var first = all.reduce(function (m, e) { return e.flight_date < m ? e.flight_date : m; }, vm.T), fd = F.pd(first), td = F.pd(vm.T);
            var n = (td.getFullYear() - fd.getFullYear()) * 12 + td.getMonth() - fd.getMonth() + 1;
            if (n > 24) { yearly = true; keys = []; for (var y = fd.getFullYear(); y <= td.getFullYear(); y++) { keys.push(String(y)); } } else { keys = lastMonths(Math.max(n, 6)); }
        } else { keys = lastMonths(p === '12m' ? 12 : p === '24m' ? 24 : 6); }
        return keys.map(function (k) {
            var rows = list.filter(function (e) { return e.flight_date.slice(0, k.length) === k; }), t = sum(rows), mo = yearly ? null : +k.slice(5, 7) - 1;
            return { k: k, lab: yearly ? k : F.MON[mo], s: yearly ? k.slice(2) : F.MON[mo][0], long: yearly ? k : F.MONTH[mo] + ' ' + k.slice(0, 4), total: t.total_time, pic: t.pic_time, flights: rows.length };
        });
    }
    function classify(e) { var c = String(e.aircraft_class || '').toUpperCase(); if (c.indexOf('SEP') > -1) { return 'SEP'; } if (c.indexOf('MEP') > -1) { return 'MEP'; } return e.engine_type === 'single' ? 'SEP' : e.engine_type === 'multi' ? 'MEP' : 'Other'; }
    function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
    function buildStats() {
        var all = vm.entries || [], from = periodFrom(vm.period), list = all.filter(function (e) { return !from || e.flight_date >= from; }), t = sum(list);
        var pl = from ? 'since ' + F.fDate(from) : 'all time';
        vm.stTiles = [
            { ic: 'fa-clock', k: 'Total time', v: fmtH(t.total_time), s: F.plural(t.flights, 'flight') + ', ' + pl },
            { ic: 'fa-user', k: 'PIC', v: fmtH(t.pic_time), s: 'As pilot in command' },
            { ic: 'fa-user-friends', k: 'Dual', v: fmtH(t.dual_time), s: 'With an instructor' },
            { ic: 'fa-moon', k: 'Night', v: fmtH(t.night_time), s: 'Estimated for club flights' },
            { ic: 'fa-route', k: 'Cross-country', v: fmtH(t.cross_country_time), s: 'Logged as cross-country' },
            { ic: 'fa-cloud', k: 'Instrument', v: fmtH(t.ifr_time), s: 'IFR or IMC' }
        ];
        // hours per month (or per year), to scale
        var sr = series(all, list, vm.period), max = Math.max.apply(null, sr.map(function (b) { return b.total; }).concat([0]));
        var st = [0.5, 1, 2, 5, 10, 20, 50, 100, 200].filter(function (s) { return s * 4 >= max; })[0] || 500, ym = st * 4, maxI = -1, lastI = -1;
        sr.forEach(function (b, i) { if (b.total && (maxI < 0 || b.total > sr[maxI].total)) { maxI = i; } if (b.total) { lastI = i; } });
        vm.chart = {
            yearly: sr.length && sr[0].k.length === 4, dense: sr.length > 8,
            both: list.some(function (e) { return e.pic_time > 0; }) && list.some(function (e) { return e.total_time - e.pic_time > 0.001; }),
            yl: [0, 1, 2, 3, 4].map(function (i) { return { y: i * 25, t: (st * i) + ' h' }; }), grid: [25, 50, 75, 100],
            bars: sr.map(function (b, i) {
                var rest = Math.max(0, b.total - b.pic);
                return { k: b.k, lab: b.lab, s: b.s, long: b.long, v: (b.total / ym * 100).toFixed(2), pic: b.pic, picG: b.pic.toFixed(3), rest: rest > 0.001 ? rest.toFixed(3) : 0,
                    label: (i === maxI || i === lastI) && b.total ? F.hm(b.total) : '', tipR: i >= sr.length / 2, total: b.total,
                    tip: b.long + ' · ' + F.hm(b.total) + (b.total ? ' (' + F.hm(b.pic) + ' PIC) · ' + F.plural(b.flights, 'flight') : ''),
                    aria: b.long + ': ' + F.hm(b.total) + ', ' + F.hm(b.pic) + ' as PIC, ' + F.plural(b.flights, 'flight'),
                    row: { long: b.long, flights: b.flights, total: F.hm(b.total), pic: F.hm(b.pic) } };
            })
        };
        vm.chart.rows = vm.chart.bars.slice().reverse().map(function (b) { return b.row; });
        // by role
        var tt = t.total_time || 1;
        vm.roles = ['P1', 'PUT', 'PICUS', 'P2', 'INSTRUCTOR', 'other'].map(function (c) {
            var h = list.filter(function (e) { return c === 'other' ? !CAP[e.capacity] : e.capacity === c; }).reduce(function (s, e) { return s + e.total_time; }, 0);
            var ci = vm.capInfo(c === 'other' ? null : c);
            return { k: ci.label, s: ci.long, h: h, v: (h / tt * 100).toFixed(2), val: fmtH(h), small: pct(h, tt) + '%' };
        }).filter(function (x) { return x.h > 0; });
        // by aircraft type
        var types = {};
        list.forEach(function (e) { var k = e.aircraft_type || 'Unknown'; types[k] = types[k] || { h: 0, n: 0, model: e._acName }; types[k].h += e.total_time; types[k].n++; });
        var tk = Object.keys(types).sort(function (a, b) { return types[b].h - types[a].h; }), tmax = tk.length ? (types[tk[0]].h || 1) : 1;
        vm.types = tk.map(function (k) { return { k: k, s: types[k].model, v: (types[k].h / tmax * 100).toFixed(2), val: fmtH(types[k].h), small: '· ' + types[k].n + ' flt' }; });
        // by class
        var cls = { SEP: 0, MEP: 0, Other: 0 };
        list.forEach(function (e) { cls[classify(e)] += e.total_time; });
        vm.classBars = Object.keys(cls).filter(function (k) { return cls[k] > 0; }).map(function (k) {
            return { k: k, s: k === 'SEP' ? 'Single-engine piston' : k === 'MEP' ? 'Multi-engine piston' : 'Not classified', v: (cls[k] / tt * 100).toFixed(2), val: fmtH(cls[k]), small: pct(cls[k], tt) + '%' };
        });
        // the two splits
        var ver = sum(list.filter(function (e) { return e.kind === 'club'; })).total_time;
        function split(a, b) { var tot = a.v + b.v; return { tot: tot, a: { k: a.k, v: a.v, g: a.v.toFixed(3), h: fmtH(a.v), pc: pct(a.v, tot) }, b: { k: b.k, v: b.v, g: b.v.toFixed(3), h: fmtH(b.v), pc: pct(b.v, tot) }, aria: a.k + ' ' + F.hm(a.v) + ', ' + b.k + ' ' + F.hm(b.v) }; }
        vm.splitDN = split({ k: 'Day', v: Math.max(0, t.total_time - t.night_time) }, { k: 'Night', v: t.night_time });
        vm.splitVA = split({ k: 'Verified by a club', v: ver }, { k: 'Added by you', v: Math.max(0, t.total_time - ver) });
        vm.splits = [{ k: 'Day vs night', s: vm.splitDN }, { k: 'Where the hours come from', s: vm.splitVA }];
        // last 90 days (the currency checks themselves wait for the backend)
        var s90 = F.addDays(vm.T, -90), l90 = all.filter(function (e) { return e.flight_date >= s90; }), t90 = sum(l90);
        vm.r90 = { since: F.fDate(s90), flown: fmtH(t90.total_time), flights: l90.length, ldg: t90.day_landings + t90.night_landings };
        // SEP rating (GET personal_logbook/stats → sep_currency)
        vm.sepv = null;
        if (vm.sep && vm.sep.has_sep) {
            var sp = vm.sep, days = parseInt(sp.days_to_expiry, 10), w = sp.revalidation_window || {};
            var meter = function (k, have, need, fmt) { have = num(have); var ok = have >= need; return { k: k, have: fmt(have), need: fmt(need), ok: ok, v: Math.min(100, have / need * 100).toFixed(1) }; };
            vm.sepv = {
                rating: sp.rating, expiry: F.fDate(sp.expiry_date), days: isNaN(days) ? '—' : days,
                tone: days < 0 ? 'bad' : days < 90 ? 'warn' : 'good',
                pill: days < 0 ? 'Expired' : days < 90 ? 'Expires in ' + F.plural(days, 'day') : 'Valid',
                met: !!sp.experience_hours_landings_met,
                win: (w.from ? F.fDate(w.from) : '') + ' to ' + F.fDate(w.to || sp.expiry_date),
                meters: [meter('PIC + dual hours', w.pic_put_hours, 12, F.hm), meter('PIC hours', w.pic_hours, 6, F.hm), meter('Take-offs and landings', w.landings, 12, function (x) { return String(Math.round(x)); })],
                line: 'PIC + dual: ' + F.hm(num(sp.pic_put_24mo_to_expiry)) + ' in the 24 months to expiry · ' + F.hm(num(sp.pic_put_rolling_12mo)) + ' in the last 12 months.',
                note: sp.note || 'Informational only. Not legal advice.'
            };
        }
    }

    // ════════════════════════════════════════════
    // CURRENCY (backend C8) — the band, the Statistics card and "Choose your checks"
    // Rules, results and the pilot's choice come from the server; the words follow the mockup.
    // ════════════════════════════════════════════
    var GROUPS = { uk: 'UK and EASA' };
    function tol(r, n) { return n + (r.night ? ' night' : '') + (n === 1 ? ' take-off and landing' : ' take-offs and landings'); }
    function scopeWords(r) { return r.scope === 'class' ? 'same class or type' : r.scope === 'type' ? 'same type' : 'any aircraft'; }
    function ruleLine(r) { return tol(r, +r.n || 0) + ' in ' + r.days + ' days, ' + scopeWords(r) + '.' + (r.waive ? ' Not needed with a valid IR.' : ''); }
    function ordinal(n) { return n === 2 ? 'second' : n === 3 ? 'third' : n + 'th'; }
    function shortD(s) { return s ? shortDate(s) : ''; }
    function loadCurrency() {
        return LogbookV2Data.GetCurrency().then(function (data) {
            if (!data || data.success === false) { vm.cur = { ok: false }; }
            else { buildCurrency(data); }
            if (vm.screen === 'list' && vm.entries) { buildTiles(); }
        });
    }
    function buildCurrency(data) {
        var rules = {}, prof = data.profile || {};
        (data.library || []).forEach(function (r) { rules[r.id] = r; });
        (data.own || []).forEach(function (r) { rules[r.id] = r; });
        vm.cur = { ok: true, data: data, licensed: !!prof.licensed, ir: prof.ir || { state: 'none' }, defaults: !!data.defaults_used, chosen: (data.chosen || []).slice(),
            library: data.library || [], own: data.own || [] };
        vm.cur.items = (data.results || []).map(function (x) {
            var r = rules[x.rule_id] || { n: 0, days: 0, night: false }, sc = x.scopes || [], m = sc[0] || null;
            var nm = x.tile || x.name, lead = m && m.key !== 'all' && m.label ? m.label + ': ' : '', pax = /passeng/i.test(x.name || '');
            var others = sc.slice(1).map(function (c) { return ' ' + c.label + ': ' + (c.state === 'lapsed' ? 'lapsed ' + shortD(c.until) : c.state === 'none' ? 'not yet' : 'until ' + shortD(c.until)) + '.'; }).join('');
            var t;
            if (x.waived) { t = { cls: 'good', ic: 'fa-check-circle', v: 'Not needed', s: 'You hold a valid IR' + (vm.cur.ir.expiry ? ', until ' + F.fDate(vm.cur.ir.expiry) : '') }; }
            else if (!m || m.state === 'none') { t = { cls: '', ic: 'fa-history', v: 'Not yet', s: lead + 'needs ' + tol(r, +r.n) + ' in ' + r.days + ' days.' + others }; }
            else if (m.state === 'lapsed') { var need = Math.max(1, (+m.need || +r.n) - (+m.have || 0)); t = { cls: 'bad', ic: 'fa-exclamation-circle', v: 'Lapsed ' + shortD(m.until), s: lead + (m.have || 0) + ' of ' + (m.need || r.n) + ' in the last ' + r.days + ' days. Fly ' + need + ' more' + (pax ? ' with no passengers on board.' : '.') + others }; }
            else if (m.state === 'soon') { t = { cls: 'attn', ic: 'fa-exclamation-circle', v: 'Until ' + shortD(m.until), s: lead + (m.left ? 'ends in ' + F.plural(+m.left, 'day') : 'ends today') + '. Fly ' + (m.more || 1) + ' more before ' + F.fDay(m.until) + ' to stay current.' + others }; }
            else { t = { cls: 'good', ic: 'fa-check-circle', v: 'Until ' + shortD(m.until), s: lead + tol(r, +r.n) + ' in the last ' + r.days + ' days.' + others }; }
            t.k = nm;
            var pill;
            if (x.waived) { pill = { tone: 'good', label: 'Not needed', ic: 'fa-check' }; }
            else if (!m || m.state === 'none') { pill = { tone: 'muted', label: 'Not yet', ic: '' }; }
            else if (m.state === 'ok') { pill = { tone: 'good', label: 'Current', ic: 'fa-check' }; }
            else if (m.state === 'soon') { pill = { tone: 'warn', label: 'Ends in ' + F.plural(+m.left || 0, 'day'), ic: 'fa-exclamation-circle' }; }
            else { pill = { tone: 'bad', label: 'Lapsed', ic: 'fa-exclamation-circle' }; }
            var meters = sc.map(function (c) {
                var line = c.state === 'none' ? 'Nothing logged in the last ' + r.days + ' days counts yet.'
                    : (c.state === 'lapsed' ? 'Lapsed ' + F.fDay(c.until) + '. ' : 'Until ' + F.fDay(c.until) + '. ') + 'Your ' + (+r.n === 1 ? '' : ordinal(+r.n) + ' ') + 'most recent ' + (r.night ? 'night ' : '') + 'landing was on ' + F.fDate(c.at) + '.';
                return { k: c.label, have: c.have || 0, need: c.need || r.n, days: r.days, ok: c.state === 'ok', v: Math.min(100, (c.have || 0) / ((c.need || r.n) || 1) * 100).toFixed(1), line: line };
            });
            var hints = [];
            if (x.waived) { hints.push('You hold a valid IR' + (vm.cur.ir.expiry ? ', until ' + F.fDate(vm.cur.ir.expiry) : '') + ' — from Licences & medical.'); }
            else if (!sc.length) { hints.push('No flights with landings yet.'); }
            (x.notes || []).forEach(function (n) { hints.push(n); });
            if (!x.waived && +x.blank) { hints.push(F.plural(+x.blank, 'flight') + ' in this window can’t be counted because the aircraft has no class or type.'); }
            return { id: x.rule_id, tile: t, name: x.name, ref: x.ref, line: x.line || ruleLine(r), pill: pill, meters: x.waived ? [] : meters, hints: hints };
        });
        if (vm.dlg && vm.dlg.t === 'checks') { buildChecks(); }
    }

    // ── "Choose your checks" (a record dialog; each change is saved at once) ──
    function buildChecks() {
        var on = vm.cur.chosen, groups = {}, order = [];
        vm.cur.library.forEach(function (r) {
            var g = r.group || 'uk';
            if (!groups[g]) { groups[g] = { label: GROUPS[g] || String(g).toUpperCase(), rows: [] }; order.push(g); }
            groups[g].rows.push({ id: r.id, name: r.name, line: r.line || ruleLine(r), ref: r.ref, on: on.indexOf(r.id) > -1 });
        });
        var ck = vm.ck || {};
        vm.ck = { groups: order.map(function (g) { return groups[g]; }), own: vm.cur.own.map(function (r) { return { id: r.id, name: r.name, line: r.line || ruleLine(r), on: on.indexOf(r.id) > -1, raw: r }; }),
            form: ck.form || null, del: null };
    }
    vm.openChecks = function () {
        if (!vm.cur || !vm.cur.ok) { return; }
        vm.menu = null; vm.ck = null;
        buildChecks();
        vm.dlg = { t: 'checks', head: { eyebrow: 'Currency', icon: 'fa-history', title: 'Choose your checks', sub: 'Pick the rules you fly under. We work them out from your logbook.', edge: 'var(--ta-brand-2)' } };
        focusDlg();
    };
    function ownBody(r) { var o = { name: r.name, n: +r.n, night: !!r.night, days: +r.days, scope: r.scope, waive: r.waive ? 'IR' : null }; if (r.id) { o.id = r.id; } return o; }
    function saveChecks(chosen, own, done) {
        return LogbookV2Data.SaveCurrency({ chosen: chosen, own: own.map(ownBody) }).then(function (data) {
            if (data && data.success !== false) { buildCurrency(data); if (vm.screen === 'list' && vm.entries) { buildTiles(); } if (done) { done(data); } return; }
            var err = data && (data.error || (data.message && data.message.error));
            if (err === 'NOT_READY' || (data.message && data.message.error === 'NOT_READY')) { ToastService.warning('Your checks can’t be saved yet', 'The defaults are shown until saving is switched on. Try again later.'); }
            else if (err === 'VALIDATION_ERROR' && vm.ck && vm.ck.form) {
                var f = (data.fields || (data.message && data.message.fields)) || {};
                vm.ck.form.err = { name: f.name ? 'Give the check a name' : '', days: f.days ? 'Between 1 and 365 days' : '', n: f.n ? 'Between 1 and 20' : '' };
                ToastService.warning('Check the highlighted fields', 'Your own check wasn’t added.');
            } else { ToastService.error('Your checks weren’t saved', (data && typeof data.message === 'string' && data.message) || 'Please try again.'); }
            buildChecks();
        });
    }
    vm.ckToggle = function (row) {
        var chosen = vm.cur.chosen.filter(function (id) { return id !== row.id; });
        if (row.on) { chosen.push(row.id); }
        return saveChecks(chosen, vm.cur.own);
    };
    vm.ckNew = function () { vm.ck.form = { name: '', n: 3, night: false, days: '90', scope: 'class', waive: false, err: {} }; $timeout(function () { var i = document.getElementById('lgb-own-name'); if (i) { i.focus(); } }); };
    vm.ckCancel = function () { vm.ck.form = null; };
    vm.ckStep = function (d) { var f = vm.ck.form; f.n = Math.max(1, Math.min(20, (+f.n || 1) + d)); };
    vm.ckLine = function () { var f = vm.ck && vm.ck.form; if (!f) { return ''; } var days = parseInt(f.days, 10); return days > 0 ? ruleLine({ n: f.n, night: f.night, days: days, scope: f.scope, waive: f.waive }) : ''; };
    vm.ckAdd = function () {
        var f = vm.ck.form, er = {}, days = parseInt(f.days, 10);
        if (!(f.name || '').trim()) { er.name = 'Give the check a name'; }
        if (!(days >= 1 && days <= 365) || String(days) !== String(f.days).trim()) { er.days = 'Between 1 and 365 days'; }
        f.err = er;
        if (Object.keys(er).length) { return; }
        var id = 'own_' + Date.now().toString(36), name = f.name.trim();
        var own = vm.cur.own.concat([{ id: id, name: name, n: f.n, night: f.night, days: days, scope: f.scope, waive: f.waive ? 'IR' : null }]);
        return saveChecks(vm.cur.chosen.concat([id]), own, function (data) {
            vm.ck.form = null;
            // the server may give the new check its own id: make sure it is switched on
            var mine = (data.own || []).filter(function (r) { return r.name === name; }).pop();
            if (mine && (data.chosen || []).indexOf(mine.id) < 0) { saveChecks((data.chosen || []).concat([mine.id]), data.own || []); }
            ToastService.success('Check added', '“' + name + '” is worked out from your logbook.');
        });
    };
    vm.ckAskDel = function (r) { vm.ck.del = r.id; };
    vm.ckKeep = function () { vm.ck.del = null; };
    vm.ckDel = function (r) {
        return saveChecks(vm.cur.chosen.filter(function (id) { return id !== r.id; }), vm.cur.own.filter(function (x) { return x.id !== r.id; }));
    };

    // ════════════════════════════════════════════
    // IMPORT — spreadsheet (CSV): upload → check & match → added
    // ════════════════════════════════════════════
    function initImport() { vm.imp = { step: 'pick', file: '', rows: [], filter: 'all', open: null, busy: false, drag: false, result: null }; vm.dateOpts = { max: vm.T, shortcuts: false, dots: false }; }
    vm.COLNAMES = ['Date', 'From / Departure', 'To / Arrival', 'Off blocks', 'On blocks', 'Registration', 'Type', 'Total', 'PIC', 'PICUS', 'Co-pilot', 'Dual', 'Instructor', 'Night', 'IFR', 'XC', 'Day landings', 'Night landings', 'Capacity', 'Remarks'];
    function matchNote(notes, word) {
        var re = new RegExp('^' + word + " '.*' → (\\S+) \\((.*)\\)$");
        for (var i = 0; i < (notes || []).length; i++) { var m = re.exec(notes[i]); if (m) { return { code: m[1], title: m[2] }; } }
        return null;
    }
    vm.onCsvFiles = function (files) {
        var file = files && files[0];
        if (!file || vm.imp.busy) { return; }
        if (!/\.csv$/i.test(file.name)) { ToastService.error('CSV files only', 'Export your logbook as a .csv file and upload that.'); return; }
        vm.imp.file = file.name; vm.imp.busy = true;
        PersonalLogbookService.ImportPreview(file).then(function (data) {
            vm.imp.busy = false;
            if (!data || data.success === false) { ToastService.error('Could not read that file', (data && data.message) || 'Please check it’s a CSV export of your logbook.'); return; }
            vm.imp.rows = (data.rows || []).map(function (r, i) {
                var en = r.entry || null;
                r._i = i;
                r._include = r.status !== 'error';
                r._dep = matchNote(r.notes, 'Departure') || (en && en.departure_place ? { code: en.departure_place, title: null } : null);
                r._arr = matchNote(r.notes, 'Arrival') || (en && en.arrival_place ? { code: en.arrival_place, title: null } : null);
                if (en) { en.flight_date = en.flight_date ? String(en.flight_date).slice(0, 10) : ''; en.total_time = num(en.total_time); }
                r._total = en && en.total_time ? F.hm(en.total_time) : '';
                r._st = impStatus(r.status);
                r._notes = (r.notes || []).map(function (n) { return { t: n, ic: r.status === 'error' ? 'fa-times-circle' : /not found|kept as typed|isn’t/i.test(n) ? 'fa-question-circle' : 'fa-check' }; });
                return r;
            });
            vm.imp.step = 'review'; vm.imp.filter = 'all'; vm.imp.open = null;
            impCount();
        });
    };
    function impStatus(s) { return s === 'ready' ? { tone: 'good', label: 'Ready', ic: 'fa-check' } : s === 'review' ? { tone: 'warn', label: 'Check details', ic: 'fa-exclamation-circle' } : { tone: 'bad', label: 'Can’t import', ic: 'fa-times-circle' }; }
    function impCount() {
        var sm = { total: vm.imp.rows.length, ready: 0, review: 0, error: 0 };
        vm.imp.rows.forEach(function (r) { sm[r.status] = (sm[r.status] || 0) + 1; });
        vm.imp.sm = sm;
        vm.imp.inc = vm.imp.rows.filter(function (r) { return r._include && r.status !== 'error'; }).length;
        vm.imp.chips = [['all', 'All', sm.total], ['ready', 'Ready', sm.ready], ['review', 'Check details', sm.review], ['error', 'Can’t import', sm.error]].filter(function (c) { return c[0] === 'all' || c[2]; });
        vm.imp.shown = vm.imp.rows.filter(function (r) { return vm.imp.filter === 'all' || r.status === vm.imp.filter; });
    }
    vm.impFilter = function (k) { vm.imp.filter = k; vm.imp.open = null; impCount(); };
    vm.impOpen = function (r) { vm.imp.open = vm.imp.open === r._i ? null : r._i; };
    vm.impInc = function () { impCount(); };
    vm.impReg = function (r) { if (r.entry && r.entry.registration) { r.entry.registration = r.entry.registration.toUpperCase(); } };
    vm.impTotal = function (r) {
        var v = F.parseHM(r._total), en = r.entry;
        r._err = '';
        if (v == null || isNaN(v) || v <= 0) { r._err = 'Use h:mm, e.g. 1:05'; return; }
        var old = en.total_time;
        en.total_time = round2(v);
        ['pic_time', 'picus_time', 'copilot_time', 'dual_time', 'instructor_time'].forEach(function (k) { if (en[k] !== undefined && Math.abs(num(en[k]) - old) < 0.01) { en[k] = en.total_time; } });
    };
    vm.impRestart = function () { initImport(); };
    vm.impConfirm = function () {
        var bad = vm.imp.rows.filter(function (r) { return r._include && r.status !== 'error' && (r._err || !(num(r.entry.total_time) > 0) || !r.entry.flight_date); })[0];
        if (bad) { vm.imp.filter = 'all'; impCount(); vm.imp.open = bad._i; ToastService.warning('Check line ' + bad.line, 'It needs a date and a total time before it can be imported.'); return; }
        var rows = vm.imp.rows.filter(function (r) { return r._include && r.status !== 'error'; }).map(function (r) { return r.entry; });
        if (!rows.length) { ToastService.warning('Nothing to import', 'Switch on at least one line.'); return; }
        return PersonalLogbookService.ImportConfirm(rows).then(function (data) {
            if (!data || data.success === false) { ToastService.error('Import failed', (data && data.message) || 'Please try again.'); return; }
            var skipped = vm.imp.rows.length - (data.imported || 0);
            vm.imp.result = { imported: data.imported || 0, failed: data.failed || 0, skipped: skipped };
            vm.imp.step = 'done';
            ToastService.success('Flights imported', F.plural(data.imported || 0, 'flight') + ' added to your logbook.');
        });
    };

    // ════════════════════════════════════════════
    // SKYDEMON — .flightlog files: upload → check → added (the GPS track stays for replay)
    // ════════════════════════════════════════════
    var SD_MAX_FILES = 20, SD_MAX_BYTES = 20 * 1024 * 1024;
    function initSkydemon() { vm.sd = { step: 'pick', cards: [], busy: false, drag: false, result: 0 }; vm.dateOpts = { max: vm.T, shortcuts: false, dots: false }; }
    vm.onSdFiles = function (files) {
        if (!files || !files.length || vm.sd.busy) { return; }
        if (files.length > SD_MAX_FILES) { ToastService.warning('Too many files', 'Upload at most ' + SD_MAX_FILES + ' log files at a time.'); return; }
        var list = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].size > SD_MAX_BYTES) { ToastService.error('File too large', files[i].name + ' is over 20 MB.'); return; }
            list.push(files[i]);
        }
        vm.sd.busy = true;
        PersonalLogbookService.SkydemonPreview(list).then(function (data) {
            vm.sd.busy = false;
            if (!data || data.success === false) { ToastService.error('Upload failed', (data && data.message) || 'Could not read those files.'); return; }
            vm.sd.cards = (data.files || []).map(buildSdCard);
            vm.sd.step = 'review';
            sdCount();
            sdAircraft();
        });
    };
    /* the aircraft chip on each card shows the type (and the club colour) as drawn — one C7 lookup per registration; nothing shows if it fails */
    function sdAircraft() {
        var seen = {};
        (vm.sd.cards || []).forEach(function (c) {
            var reg = c.success && ((c.parsed && c.parsed.registration) || (c.entry && c.entry.registration));
            if (!reg) { return; }
            reg = String(reg).toUpperCase();
            (seen[reg] || (seen[reg] = [])).push(c);
        });
        Object.keys(seen).forEach(function (reg) {
            LogbookV2Data.LookupAircraft(reg).then(function (data) {
                var a = data && data.success !== false && data.aircraft;
                if (!a) { return; }
                seen[reg].forEach(function (c) { c._ac = { type: a.type || '', colour: a.colour || null }; });
            });
        });
    }
    function pickSd(cands, id) {
        if (!cands || !cands.length) { return null; }
        if (id) { for (var i = 0; i < cands.length; i++) { if (cands[i].id == id) { return cands[i]; } } }
        return cands[0];
    }
    function buildSdCard(f) {
        if (!f.success) { return { success: false, file_name: f.file_name, message: f.message, _include: false }; }
        var c = f, e = c.entry || (c.entry = {});
        c._include = true; c._error = null;
        e.flight_date = e.flight_date ? String(e.flight_date).slice(0, 10) : '';
        e.departure_time = toHHMM(e.departure_time); e.arrival_time = toHHMM(e.arrival_time);
        e.capacity = CAP[e.capacity] ? e.capacity : 'P1';
        c._dep = pickSd(c.departure_candidates, e.departure_airfield_id);
        c._arr = pickSd(c.arrival_candidates, e.arrival_airfield_id);
        c._total = num(e.total_time) ? F.hm(num(e.total_time)) : '';
        c._night = (e.night_time !== null && e.night_time !== undefined && e.night_time !== '' && num(e.night_time) > 0) ? F.hm(num(e.night_time)) : '';
        c._nightEst = (c.night_estimate !== null && c.night_estimate !== undefined) ? F.hm(num(c.night_estimate)) : '';
        c._nightTag = num(c.night_estimate) > 0;                  // the "night ≈" fact only when there is some
        c._issues = (c.issues || []).join(' · ');
        c._ldg = parseInt((c.parsed && c.parsed.total_landings) || 0, 10) || 0;
        c._dup = !!(c.duplicate && (c.duplicate.manual_entry_id || c.duplicate.club_flight_id));
        sdPlaces(c);
        c._dupClub = !!(c.duplicate && c.duplicate.club_flight_id);
        if (c._dupClub) { c._include = false; }   // owner, 9 Nov: a likely club flight starts unticked so its hours aren't counted twice
        e.day_landings = parseInt(e.day_landings, 10) || 0; e.night_landings = parseInt(e.night_landings, 10) || 0;
        return c;
    }
    function sdCount() {
        var ok = vm.sd.cards.filter(function (c) { return c.success; });
        vm.sd.sm = { files: vm.sd.cards.length, ok: ok.length, ready: ok.filter(function (c) { return c.status === 'ready'; }).length, review: ok.filter(function (c) { return c.status !== 'ready'; }).length, error: vm.sd.cards.length - ok.length };
        vm.sd.inc = ok.filter(function (c) { return c._include; }).length;
    }
    vm.sdInc = function () { sdCount(); };
    vm.sdStatus = function (c) { return c._imported ? { tone: 'good', label: 'Added', ic: 'fa-check' } : c.status === 'ready' ? { tone: 'good', label: 'Ready', ic: 'fa-check' } : { tone: 'warn', label: 'Check details', ic: 'fa-exclamation-circle' }; };
    /* the route shown on a card, refreshed when the From / To select changes (stable objects for the view) */
    function sdPlaces(c) {
        ['dep', 'arr'].forEach(function (w) {
            var a = c[w === 'dep' ? '_dep' : '_arr'], p = c.entry[w === 'dep' ? 'departure_place' : 'arrival_place'];
            c['_' + w + 'P'] = a ? { code: a.code, title: a.title } : p ? { code: p, title: '' } : null;
        });
    }
    vm.sdPlaces = sdPlaces;
    vm.sdRestart = function () { initSkydemon(); };
    function buildSdEntry(c) {
        var e = c.entry, total = round2(F.parseHM(c._total) || 0);
        var entry = { flight_date: e.flight_date, departure_time: e.departure_time || null, arrival_time: e.arrival_time || null, registration: String(e.registration || '').toUpperCase(),
            aircraft_make: e.aircraft_make || '', aircraft_model: e.aircraft_model || '', aircraft_type: e.aircraft_type || '', aircraft_class: e.aircraft_class || '', engine_type: e.engine_type || 'single',
            capacity: e.capacity || 'P1', total_time: total, day_landings: parseInt(e.day_landings, 10) || 0, night_landings: parseInt(e.night_landings, 10) || 0, remarks: e.remarks || '' };
        entry[CAP[entry.capacity].f] = total;
        if (c._night) { entry.night_time = round2(F.parseHM(c._night)); }
        if (c._dep) { entry.departure_airfield_id = c._dep.id; entry.departure_place = c._dep.code; } else if (e.departure_place) { entry.departure_place = e.departure_place; }
        if (c._arr) { entry.arrival_airfield_id = c._arr.id; entry.arrival_place = c._arr.code; } else if (e.arrival_place) { entry.arrival_place = e.arrival_place; }
        return entry;
    }
    vm.sdConfirm = function () {
        var rows = [], bad = null;
        vm.sd.cards.forEach(function (c) {
            if (!c.success || !c._include) { return; }
            c._error = null;
            var t = F.parseHM(c._total);
            if (t == null || isNaN(t) || t <= 0) { c._error = 'Add the total time as h:mm, e.g. 1:05.'; }
            else if ((c.entry.departure_time && minsOf(c.entry.departure_time) == null) || (c.entry.arrival_time && minsOf(c.entry.arrival_time) == null)) { c._error = 'Use 24-hour times, e.g. 09:05.'; }
            else if (c._night && isNaN(F.parseHM(c._night))) { c._error = 'Night time as h:mm, e.g. 0:20 — or leave it blank for the estimate.'; }
            else if (!c.entry.flight_date) { c._error = 'Pick the date of the flight.'; }
            if (c._error) { bad = bad || c; return; }
            rows.push({ upload_token: c.upload_token, entry: buildSdEntry(c) });
        });
        if (bad) { ToastService.warning('Check the highlighted flight', bad._error); return; }
        if (!rows.length) { ToastService.warning('Nothing selected', 'Switch on at least one flight to add.'); return; }
        return PersonalLogbookService.SkydemonConfirm(rows).then(function (data) {
            if (!data || data.success === false) { ToastService.error('Could not add the flights', (data && data.message) || 'Please try again.'); return; }
            var byToken = {};
            (data.results || []).forEach(function (r) { byToken[r.upload_token] = r; });
            vm.sd.cards.forEach(function (c) {
                var r = c.upload_token ? byToken[c.upload_token] : null; if (!r) { return; }
                if (r.success) { c._imported = true; c._include = false; c._error = null; } else { c._error = r.message || 'Could not save this flight.'; }
            });
            if (data.failed > 0) {
                vm.sd.cards = vm.sd.cards.filter(function (c) { return !c._imported; });
                sdCount();
                ToastService.warning((data.imported || 0) + ' added, ' + data.failed + ' to fix', 'Correct the highlighted flight and add again.');
            } else {
                vm.sd.result = data.imported || 0;
                vm.sd.step = 'done';
                ToastService.success('Flights added', F.plural(data.imported || 0, 'flight') + ' with GPS tracks are now in your logbook.');
            }
        });
    };
}
