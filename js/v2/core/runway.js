/* ═══════════════════════════════════════════════════════════════════════════
   THE RUNWAY — v2's shared "we're working on it" piece (owner, 10 Nov 2026: "really nice to use elsewhere when the app
   might be slow"). Born on the sign-in page (mockups/login/login.html), promoted here with its styles in ta-base.css
   (.ta-runway*), so every v2 screen draws the same one.

   <ta-runway text="Opening your clubs…" steps="vm.steps" step="vm.step" flying="true"></ta-runway>
     text    one line under the strip (optional)
     steps   an array of step labels; `step` is the index of the one in progress (earlier ones tick, later ones wait);
             with steps the progress bar shows too
     flying  default true — the aircraft rolls and lifts off (one take-off; the strip stays); false = parked
     compact a shorter strip for small places (the booking sheet, a dialog)
   Skeletons stay the right thing for a LIST that is loading; the runway is for a wait where the app is DOING something
   for the person (signing in, saving, paying, searching) or when a call is slow.

   The default slow-wait indicator: RunwayWait counts the API calls in flight; when one has been pending for more than
   SLOW_MS on a v2 page, $rootScope.taSlow turns on and views/dashboard.html floats a small runway at the bottom of the
   screen ("Still working…") until every call has answered — no page has to do anything to get it. Since 11 Nov (owner) it
   covers EVERY page, classic ones too, and counts view template fetches as well as API calls. While a page shows a
   <ta-runway> of its own ($rootScope.taRunwayInline > 0) the float stays quiet.
   ═══════════════════════════════════════════════════════════════════════════ */
app.directive('taRunway', taRunway);
taRunway.$inject = ['RunwayWait'];
function taRunway(RunwayWait) {
    return {
        restrict: 'E',
        scope: { text: '@', steps: '=?', step: '=?', flying: '=?', compact: '=?', float: '@' },
        template: '<div class="ta-runway" ng-class="{\'ta-runway--flying\': flying !== false, \'ta-runway--compact\': compact}" role="status" aria-live="polite">' +
            '<div class="ta-runway__strip-wrap" aria-hidden="true">' +
            '<div class="ta-runway__lights ta-runway__lights--top"></div>' +
            '<div class="ta-runway__strip"><span class="ta-runway__line"></span>' +
            '<span class="ta-runway__keys"></span><span class="ta-runway__num">06</span><span class="ta-runway__tdz"></span><span class="ta-runway__aim"></span>' +
            '<span class="ta-runway__keys ta-runway__keys--end"></span><span class="ta-runway__num ta-runway__num--end">24</span><span class="ta-runway__tdz ta-runway__tdz--end"></span><span class="ta-runway__aim ta-runway__aim--end"></span>' +
            '</div><div class="ta-runway__lights ta-runway__lights--bot"></div>' +
            '<span class="ta-runway__plane"><i class="fas fa-plane"></i></span></div>' +
            '<div class="ta-runway__bar" ng-if="steps && steps.length"><i ng-style="{width: pct() + \'%\'}"></i></div>' +
            '<div class="ta-runway__steps" ng-if="steps && steps.length">' +
            '<div class="ta-runway__step" ng-repeat="s in steps track by $index" ng-class="{\'ta-runway__step--done\': $index < (step || 0), \'ta-runway__step--on\': $index === (step || 0)}"><i class="fas fa-check"></i>{{ s }}</div></div>' +
            '<div class="ta-runway__text" ng-if="text">{{ text }}</div></div>',
        link: function (scope) {
            // a runway on the page is enough: the slow-wait float stays quiet while one is showing (the float's own doesn't count)
            if (scope.float !== 'true') { RunwayWait.mount(); scope.$on('$destroy', RunwayWait.unmount); }
            // the bar: a step in progress is part-way along its own share, the last one fills it
            scope.pct = function () {
                var n = scope.steps ? scope.steps.length : 0, i = scope.step || 0;
                if (!n) { return 0; }
                if (i >= n - 1) { return 100; }
                return Math.round(((i + 0.6) / n) * 100);
            };
        }
    };
}

/* ── the slow-wait indicator ── */
app.factory('RunwayWait', RunwayWait);
RunwayWait.$inject = ['$rootScope', '$timeout'];
function RunwayWait($rootScope, $timeout) {
    var SLOW_MS = 1200;          // a call older than this shows the runway
    var LINGER_MS = 400;         // keep it a moment after the last answer, so it doesn't flicker between chained calls
    var pending = 0, timer = null, offTimer = null;
    var service = { begin: begin, end: end, pending: function () { return pending; }, mount: mount, unmount: unmount };
    $rootScope.taSlow = false;
    $rootScope.taRunwayInline = 0;     // <ta-runway>s showing on the page (the float waits while one is)
    return service;

    function mount() { $rootScope.taRunwayInline++; }
    function unmount() { $rootScope.taRunwayInline = Math.max(0, $rootScope.taRunwayInline - 1); }

    function begin() {
        pending++;
        if (offTimer) { $timeout.cancel(offTimer); offTimer = null; }
        if (!timer && !$rootScope.taSlow) {
            timer = $timeout(function () { timer = null; if (pending > 0) { $rootScope.taSlow = true; } }, SLOW_MS);
        }
    }
    function end() {
        pending = Math.max(0, pending - 1);
        if (pending > 0) { return; }
        if (timer) { $timeout.cancel(timer); timer = null; }
        if ($rootScope.taSlow && !offTimer) { offTimer = $timeout(function () { offTimer = null; if (pending === 0) { $rootScope.taSlow = false; } }, LINGER_MS); }
    }
}

// counts every API call (the per-environment base is added later by apiUrlInterceptor, so match the relative path)
app.factory('runwayWaitInterceptor', runwayWaitInterceptor);
runwayWaitInterceptor.$inject = ['RunwayWait', '$q'];
function runwayWaitInterceptor(RunwayWait, $q) {
    // API calls and view templates (a slow network makes a route's .html fetch the long wait, owner 11 Nov); not a cached template
    function isApi(config) { return !!(config && typeof config.url === 'string' && (config.url.indexOf('/api/v1/') > -1 || /^views\/.*\.html(\?|$)/.test(config.url))); }
    return {
        request: function (config) { if (isApi(config)) { config._runway = true; RunwayWait.begin(); } return config; },
        requestError: function (rejection) { if (rejection && rejection.config && rejection.config._runway) { RunwayWait.end(); } return $q.reject(rejection); },
        response: function (response) { if (response && response.config && response.config._runway) { RunwayWait.end(); } return response; },
        responseError: function (rejection) { if (rejection && rejection.config && rejection.config._runway) { RunwayWait.end(); } return $q.reject(rejection); }
    };
}
app.config(['$httpProvider', function ($httpProvider) { $httpProvider.interceptors.push('runwayWaitInterceptor'); }]);
