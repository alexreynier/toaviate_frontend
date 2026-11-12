/* ═══════════════════════════════════════════════════════════════════════════
   v2 DESIGNS BESIDE v1 (owner, 8 Nov 2026) — the one switch for the whole app.

   • The switch: localStorage `toaviate_design_v2 = '1'` (per browser), shown as the "Try our v2 designs"
     pill in the bottom-right corner of every page (<design-switch>). Every v2 page offers "Back to classic designs".
   • Routing: every v2 screen registers its states under `dashboard.v2.*` (URL /dashboard/v2/…) in its own
     file (js/v2/<screen>/<screen>.js) and maps each v1 state it replaces:
         app.config(['DesignRoutesProvider', function (DesignRoutesProvider) {
             DesignRoutesProvider.map('dashboard.my_account.invoices', 'dashboard.v2.invoices');
         }]);
     While the switch is on, entering a mapped v1 state moves to its v2 state with the same params (so links in
     emails and bookmarks work in both designs); while it is off, a v2 state moves back to its v1 state.
     Use the same param names in the v2 state as in the v1 state.
   • Cut-over (later release): the v2 states take the v1 URLs, the switch and the v1 files are deleted.
   • Shell: `dashboard.v2` is abstract; its template is a plain host. Pages are `<main class="ta-page">`
     (css/ta-base.css + ta-night.css); body gets `.ta-v2` while a v2 state is showing (the grey page ground).
   ═══════════════════════════════════════════════════════════════════════════ */

app.provider('DesignRoutes', function DesignRoutesProvider() {
    var toV2 = {};
    var toV1 = {};
    this.map = function (v1State, v2State) {
        toV2[v1State] = v2State;
        if (!toV1[v2State]) { toV1[v2State] = v1State; }
        return this;
    };
    // a v2-only page (no v1 twin) still has a sensible classic page to go back to: "Back to classic designs" and the
    // switch-off redirect use it; nothing maps INTO the v2 page (e.g. classic('dashboard.v2.voucher_book', 'dashboard.my_account.my_vouchers'))
    this.classic = function (v2State, v1State) {
        if (!toV1[v2State]) { toV1[v2State] = v1State; }
        return this;
    };
    this.$get = function () {
        return {
            // v2 has no landing page: the classic /dashboard screen (the CLUB / INSTRUCTOR / PILOT tiles) opens My Account
            // instead (owner, 11 Nov 2026 — everyone who can sign in has one; the header menu carries the other areas).
            // One-way on purpose: switching v2 off on My Account goes to classic My Account, not back to the tiles.
            v2For: function (name) { return toV2[name] || (name === 'dashboard' ? toV2['dashboard.my_account'] : null) || null; },
            // a v2 child state with no mapping of its own (e.g. scheduler_v2.add, the booking panel) goes back with its
            // parent's classic page; v1 → v2 never walks up (a v1 child without a v2 stays v1)
            v1For: function (name) {
                var n = name || '';
                while (n && n !== 'dashboard') {
                    if (toV1[n]) { return toV1[n]; }
                    n = n.lastIndexOf('.') > -1 ? n.slice(0, n.lastIndexOf('.')) : '';
                }
                return null;
            },
            hasV2: function (name) { return !!toV2[name]; }
        };
    };
});

app.factory('DesignService', DesignService);
DesignService.$inject = ['$state', '$rootScope', 'DesignRoutes'];
function DesignService($state, $rootScope, DesignRoutes) {
    var FLAG = 'toaviate_design_v2';
    var service = {};
    service.FLAG = FLAG;
    service.isV2 = isV2;
    service.set = set;
    service.toggle = toggle;
    service.intentFor = intentFor;
    service.write = write;
    service.clearIntent = function () { intent = null; };
    var intent = null;   // the page change the last switch press asked for: {name, on}
    return service;

    function isV2() {
        try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
    }

    // Turns the switch on / off and moves the current page to its other design when it has one.
    function write(on) {
        try {
            if (on) { localStorage.setItem(FLAG, '1'); } else { localStorage.removeItem(FLAG); }
        } catch (e) {}
        $rootScope.designV2 = !!on;
    }
    function set(on) {
        var before = isV2();
        write(on);
        var cur = $state.current, target = on ? DesignRoutes.v2For(cur.name) : DesignRoutes.v1For(cur.name), move = null;
        if (!target && !on && cur.name.indexOf('dashboard.v2') === 0) { target = 'dashboard.my_account'; }
        if (!target) { intent = null; return; }
        intent = { name: target, on: !!on };
        move = $state.go(target, $state.params, { location: 'replace' });
        // A page's leave guard ("Discard your changes?") can cancel the move. "Keep editing": the switch goes back to
        // what it was, so the menu tag and the page agree. "Discard": the guard re-issues the move to the same state,
        // and the $stateChangeStart hook sees the intent, applies the switch again and lets it through (no redirect back).
        if (move && move.catch) { move.catch(function () { if ($state.current.name === cur.name) { write(before); } }); }
    }
    // the remembered switch intent for a state the router is about to enter (null when there's none)
    function intentFor(name) { return intent && intent.name === name ? intent : null; }

    function toggle() { set(!isV2()); }
}

app.config(['$stateProvider', function ($stateProvider) {
    $stateProvider.state('dashboard.v2', {
        abstract: true,
        url: '/v2',
        template: '<div class="v2-host" ui-view></div>'
    });
}]);

app.run(['$rootScope', '$state', '$location', 'DesignService', 'DesignRoutes', function ($rootScope, $state, $location, DesignService, DesignRoutes) {
    $rootScope.designV2 = DesignService.isV2();
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {
        if (event.defaultPrevented) { return; }
        // the page the switch asked for (also when a leave guard re-issues it after "Discard"): no redirect
        var intent = DesignService.intentFor(toState.name);
        if (intent) { if (DesignService.isV2() !== intent.on) { DesignService.write(intent.on); } return; }
        var on = DesignService.isV2();
        // a link to something only v2 has (e.g. a Suggest-a-time offer from an e-mail: data.keepV2With = 'offer') stays on
        // v2 with the switch off — the classic page could not show it
        var keep = toState.data && toState.data.keepV2With;
        if (!on && keep && toParams && toParams[keep]) { return; }
        var target = on ? DesignRoutes.v2For(toState.name) : DesignRoutes.v1For(toState.name);
        // a signed-in user landing on /login (an unknown URL falls back there) is bounced straight to the dashboard by
        // LoginController — sending them through the v2 sign-in first only adds a hop (10 Nov: it tripped $rootScope:infdig)
        if (target && toState.name === 'login') { var cu = $rootScope.globals && $rootScope.globals.currentUser; if (cu && cu.id) { return; } }
        if (target) {
            event.preventDefault();
            // URL-driven (typed URL, e-mail link, refresh, browser Back): the browser already shows the other design's
            // URL, so REPLACE it. In-app ($state.go / ui-sref to a v1 name): the URL is still the page we're leaving,
            // so PUSH — replacing would overwrite that page in history and Back would skip it. (This ui-router build
            // passes no transition options to $stateChangeStart, so compare the location with the target's href.)
            var href = ($state.href(toState, toParams) || '').split('?')[0].replace(/^#/, '');
            var urlDriven = !!href && $location.path() === href;
            $state.go(target, toParams, { location: urlDriven ? 'replace' : true });
        }
    });
    $rootScope.$on('$stateChangeSuccess', function (event, toState) {
        DesignService.clearIntent();
        var v2 = toState.name.indexOf('dashboard.v2') === 0 || !!(toState.data && toState.data.v2Design);
        document.body.classList.toggle('ta-v2', v2);
        // views/dashboard.html swaps its two .centre_align_boxes2 wrappers for .v2-shell while a v2 page shows
        $rootScope.v2Page = v2;
        applyZone();
    });
    // the switch can flip without a page change (a page with no other design), so follow it too
    $rootScope.$watch('designV2', applyZone);

    // Which area the page belongs to, for the zone strip under the header (css/v2/core.css, tokens in ta-base.css):
    // My Account (v1 + v2 pages) = 'account', the Instructor Dashboard = 'instructor'. Only while the v2 switch is on.
    function zoneOf(name) {
        if (/^dashboard\.v2\.instructor_/.test(name)) { return 'instructor'; }   // Instructor Dashboard v2 (before the dashboard.v2.* catch-all)
        // the scheduler v2 (/dashboard/bookings_v2) is a My Account page too (owner, 11 Nov 2026)
        if (/^dashboard\.(my_account|v2\.|questions_link|scheduler_v2(\.|$))/.test(name)) { return 'account'; }   // the booking panel (scheduler_v2.add / .edit) keeps the strip
        if (/^dashboard\.manage_user(\.|$)/.test(name)) { return 'instructor'; }
        return '';
    }
    // Which header menu item the page belongs to, for the lit menu link (css/v2/core.css body[data-nav]) — owner, 11 Nov
    // 2026: the link of the page you are ON is lit (Scheduler on the scheduler), while the strip still says the area.
    // Order matters: the specific items before the My Account catch-all (dashboard.v2.*).
    function navOf(name) {
        if (/^dashboard\.(add_booking|scheduler_v2)(\.|$)/.test(name)) { return 'scheduler'; }
        if (/^dashboard\.(slot_search|v2\.find_a_slot)(\.|$)/.test(name)) { return 'find_slot'; }
        if (/^dashboard\.(manage_user(\.|$)|v2\.instructor_)/.test(name)) { return 'instructor'; }
        if (/^dashboard\.(manage_club|manage_instructor_bookings)(\.|$)/.test(name)) { return 'manage_club'; }
        if (/^dashboard\.super_admin(\.|$)/.test(name)) { return 'admin'; }
        if (/^dashboard\.(my_account|v2\.|questions_link)/.test(name)) { return 'account'; }
        return '';
    }
    function applyZone() {
        var name = $state.current.name || '';
        var zone = DesignService.isV2() ? zoneOf(name) : '';
        if (zone) { document.body.setAttribute('data-zone', zone); } else { document.body.removeAttribute('data-zone'); }
        var nav = DesignService.isV2() ? navOf(name) : '';
        if (nav) { document.body.setAttribute('data-nav', nav); } else { document.body.removeAttribute('data-nav'); }
        // the v2 switch itself (every page, v1 or v2): the app header takes the v2 typography (css/v2/core.css)
        document.body.classList.toggle('design-v2', DesignService.isV2());
    }
}]);

// ngAnimate off INSIDE every v2 page (<main class="ta-page">). An element with a CSS animation that ng-if / ng-repeat
// removes otherwise lingers for the animation's length (the trap lgbPlainClass and instructor_core's ins-plain solved per
// page; those stay harmless). Entering elements still play their own CSS animations, and the page's ui-view clone is
// outside <main>, so the route fade (snazzy-pages.css [ui-view].ng-enter) still runs.
app.directive('taPage', ['$animate', function ($animate) {
    return { restrict: 'C', link: function (scope, element) { $animate.enabled(element, false); } };
}]);

// The "Try our v2 designs" pill: fixed in the bottom-right corner of the page (owner, 10 Nov 2026; css/v2/core.css
// .v2-switch). Mounted once in views/dashboard.html (every signed-in page) and on each public sign-in page.
// It is the ONLY way back to the classic designs (owner, 12 Nov 2026: the pages' own "Back to classic designs" links are
// gone). `foot` (the dashboard.html mount): on a PHONE, on a v2 page, the pill does not float — it is a quiet button at
// the end of the page. A v2 page keeps room at its bottom (.ta-page padding; more when a fixed action bar covers it), so
// the button is pulled up to the top of that room (--v2-foot-pull = that padding) and the room follows it: the button
// sits right under the content and above any bottom bar, on every page, with nothing for a page to do.
app.directive('designSwitch', ['DesignService', '$rootScope', '$window', function (DesignService, $rootScope, $window) {
    return {
        restrict: 'E',
        scope: { onDone: '&' },
        template: '<button type="button" class="v2-switch" ng-class="{\'v2-switch--on\': on()}" ng-click="flip()" no-busy-guard' +
            ' title="{{ on() ? \'You are trying the v2 designs. Go back to the classic designs.\' : \'Try the new designs. You can switch back at any time.\' }}">' +
            '<i class="fas" ng-class="on() ? \'fa-undo\' : \'fa-magic\'"></i>' +
            '<span ng-if="!on()">Try our v2 designs</span><span ng-if="on()" class="v2-switch__pill">v2 designs · back to classic</span>' +
            '<span ng-if="on()" class="v2-switch__foot">Back to classic designs</span><small ng-if="!on()">· new</small></button>',
        link: function (scope, element, attrs) {
            scope.on = function () { return !!$rootScope.designV2; };
            scope.flip = function () { DesignService.toggle(); scope.onDone(); };
            if (attrs.foot === undefined) { return; }

            var queued = false, last = null;
            function fit() {
                queued = false;
                var pull = 0;
                if ($rootScope.v2Page && $window.matchMedia && $window.matchMedia('(max-width: 768px)').matches) {
                    var host = document.getElementById('dashboard_bit');
                    var pages = host ? host.querySelectorAll('.ta-page, .bo') : [], page = null;   // .bo = the book-out page's root
                    for (var i = pages.length - 1; i >= 0; i--) { if (pages[i].offsetParent !== null) { page = pages[i]; break; } }
                    // only when the page's room really is the last thing above the button (nothing drawn after it)
                    if (page && Math.abs(page.getBoundingClientRect().bottom - host.getBoundingClientRect().bottom) < 2) {
                        pull = parseFloat($window.getComputedStyle(page).paddingBottom) || 0;
                    }
                }
                if (pull !== last) { last = pull; element[0].style.setProperty('--v2-foot-pull', pull + 'px'); }
            }
            function queue() { if (!queued) { queued = true; $window.requestAnimationFrame(fit); } }
            var stop = $rootScope.$watch(queue);   // once a frame at most: a page swaps its states / bars in a digest
            $window.addEventListener('resize', queue);
            scope.$on('$destroy', function () { stop(); $window.removeEventListener('resize', queue); });
        }
    };
}]);

// The advert for the switch on the CLASSIC sign-in page (owner, 11 Nov 2026: "much more prominent"): a card under the
// form in place of the corner pill — headline, three feature chips, the button, and a miniature of the new design drawn
// in CSS (css/v2/core.css .v2-promo*). <design-promo></design-promo>; it draws nothing while the switch is on.
// No ul / li / p inside: styles.css's element rules (ul li colour + hover underline, p margins) would reach them.
app.directive('designPromo', ['DesignService', '$rootScope', function (DesignService, $rootScope) {
    return {
        restrict: 'E',
        scope: {},
        template: '<aside class="v2-promo" ng-if="!on()" aria-label="Try the new ToAviate designs">' +
            '<svg class="v2-promo__path" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 196 C 110 170, 250 90, 410 14"/></svg>' +
            '<i class="fas fa-plane v2-promo__plane" aria-hidden="true"></i>' +
            '<div class="v2-promo__copy">' +
                '<div class="v2-promo__eyebrow"><span class="v2-promo__new">New</span><span>v2 designs</span></div>' +
                '<h3 class="v2-promo__title">ToAviate has a new look</h3>' +
                '<div class="v2-promo__text">Cleaner pages, a faster scheduler and everything a tap away on your phone. Same account, same data.</div>' +
                '<div class="v2-promo__feats">' +
                    '<span class="v2-promo__feat"><i class="fas fa-calendar-alt" aria-hidden="true"></i>New scheduler</span>' +
                    '<span class="v2-promo__feat"><i class="fas fa-mobile-alt" aria-hidden="true"></i>Made for phones</span>' +
                    '<span class="v2-promo__feat"><i class="fas fa-moon" aria-hidden="true"></i>Night mode</span>' +
                '</div>' +
                '<div class="v2-promo__actions">' +
                    '<button type="button" class="v2-promo__cta" ng-click="go()" no-busy-guard>Try the v2 designs<i class="fas fa-arrow-right" aria-hidden="true"></i></button>' +
                    '<span class="v2-promo__note">You can switch back at any time.</span>' +
                '</div>' +
            '</div>' +
            '<div class="v2-promo__art" aria-hidden="true">' +
                '<div class="v2-promo__win">' +
                    '<div class="v2-promo__winbar"><img src="images/main_logo.png" alt=""><span></span><span></span><span class="v2-promo__winbar-on"></span></div>' +
                    '<div class="v2-promo__winbody">' +
                        '<div class="v2-promo__hero"><span class="v2-promo__ic"></span><span class="v2-promo__ln v2-promo__ln--a"></span><span class="v2-promo__ln v2-promo__ln--b"></span><span class="v2-promo__pillbtn"></span></div>' +
                        '<div class="v2-promo__tiles"><span></span><span></span><span></span><span></span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="v2-promo__phone"><div class="v2-promo__screen"><span class="v2-promo__pbar"></span><span class="v2-promo__phero"></span><span class="v2-promo__pcard"></span><span class="v2-promo__pcard"></span></div></div>' +
            '</div>' +
            '</aside>',
        link: function (scope) {
            scope.on = function () { return !!$rootScope.designV2; };
            scope.go = function () { DesignService.set(true); };
        }
    };
}]);

// <design-back> used to draw "Back to classic designs" in every v2 page bar / hero. Owner, 12 Nov 2026: two ways back
// on one page is one too many — the corner pill (a button at the end of the page on phones) is the only one. The tag
// stays in the templates until v1 goes, drawing nothing; css/v2/core.css hides it and a wrapper that held only it.
app.directive('designBack', function () {
    return { restrict: 'E', scope: {}, template: '' };
});

// The scheduler (built 5 Nov) joins the global switch: the classic list and the classic add-booking page open
// scheduler v2 while the switch is on; scheduler v2 sends you back to the classic list while it is off.
app.config(['DesignRoutesProvider', function (DesignRoutesProvider) {
    DesignRoutesProvider.map('dashboard.bookings', 'dashboard.scheduler_v2');
    DesignRoutesProvider.map('dashboard.add_booking', 'dashboard.scheduler_v2');
    // old "edit booking" links (v1 My bookings, e-mails) open the v2 panel over the scheduler; same :booking_id
    DesignRoutesProvider.map('dashboard.edit_booking', 'dashboard.scheduler_v2.edit');
}]);
