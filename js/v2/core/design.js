/* ═══════════════════════════════════════════════════════════════════════════
   v2 DESIGNS BESIDE v1 (owner, 8 Nov 2026) — the one switch for the whole app.

   • The switch: localStorage `toaviate_design_v2 = '1'` (per browser), shown as the "Try our v2 designs"
     tag in the main menu (<design-switch>). Every v2 page offers "Back to classic designs".
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
            v2For: function (name) { return toV2[name] || null; },
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
        var target = on ? DesignRoutes.v2For(toState.name) : DesignRoutes.v1For(toState.name);
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
    });
}]);

// The "Try our v2 designs" tag in the main menu (desktop header and the phone menu).
app.directive('designSwitch', ['DesignService', '$rootScope', function (DesignService, $rootScope) {
    return {
        restrict: 'E',
        scope: { onDone: '&' },
        template: '<a class="v2-switch" ng-class="{\'v2-switch--on\': on()}" ng-click="flip()" no-busy-guard role="button" tabindex="0"' +
            ' title="{{ on() ? \'You are trying the v2 designs. Go back to the classic designs.\' : \'Try the new designs. You can switch back at any time.\' }}">' +
            '<i class="fas" ng-class="on() ? \'fa-undo\' : \'fa-magic\'"></i>' +
            '<span ng-if="!on()">Try our v2 designs</span><span ng-if="on()">v2 designs · back to classic</span></a>',
        link: function (scope) {
            scope.on = function () { return !!$rootScope.designV2; };
            scope.flip = function () { DesignService.toggle(); scope.onDone(); };
        }
    };
}]);

// "Back to classic designs" — put <design-back></design-back> in every v2 page bar or hero.
app.directive('designBack', ['DesignService', function (DesignService) {
    return {
        restrict: 'E',
        scope: {},   // its own scope: a host page's back() must not be overwritten (or overwrite this)
        template: '<a class="v2-back" ng-click="back()" no-busy-guard role="button" tabindex="0"><i class="fas fa-history"></i>Back to classic designs</a>',
        link: function (scope) { scope.back = function () { DesignService.set(false); }; }
    };
}]);

// The scheduler (built 5 Nov) joins the global switch: the classic list and the classic add-booking page open
// scheduler v2 while the switch is on; scheduler v2 sends you back to the classic list while it is off.
app.config(['DesignRoutesProvider', function (DesignRoutesProvider) {
    DesignRoutesProvider.map('dashboard.bookings', 'dashboard.scheduler_v2');
    DesignRoutesProvider.map('dashboard.add_booking', 'dashboard.scheduler_v2');
    // old "edit booking" links (v1 My bookings, e-mails) open the v2 panel over the scheduler; same :booking_id
    DesignRoutesProvider.map('dashboard.edit_booking', 'dashboard.scheduler_v2.edit');
}]);
