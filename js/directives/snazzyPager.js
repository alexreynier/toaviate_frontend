// ─────────────────────────────────────────────────────────────────────────
// snazzyPager — numbered pagination for long server-paged lists
// (debrief list "Flights without a student record", Records to File).
//
//   <snazzy-pager page="vm.page" total="vm.total" per-page="25" label="flights"
//                 busy="vm.loading" anchor="#rtf-list"
//                 on-change="vm.goPage(page)"></snazzy-pager>
//
// Renders nothing for a single page. on-change gets the page the user asked
// for; the controller fetches it and updates `page`. `anchor` (a selector) is
// scrolled into view after a change so the new page starts at its top — the
// pager sits under the list. Phones keep Prev / current / Next only.
// CSS: css/snazzy-pager.css (.snazzy-pager).
// ─────────────────────────────────────────────────────────────────────────
app.directive('snazzyPager', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        scope: {
            page:     '=',
            total:    '=',
            perPage:  '=',
            label:    '@',
            busy:     '=?',
            anchor:   '@',
            onChange: '&'
        },
        template:
            '<nav class="snazzy-pager" ng-if="pages > 1" aria-label="Pagination">' +
                '<span class="snazzy-pager__range">Showing <strong>{{ from }}–{{ to }}</strong> of {{ total | number }} {{ label || \'items\' }}</span>' +
                '<span class="snazzy-pager__controls">' +
                    '<button type="button" class="snazzy-pager__btn snazzy-pager__btn--nav" ng-disabled="page <= 1 || busy" ng-click="go(page - 1)" no-busy-guard aria-label="Previous page">' +
                        '<i class="fa fa-chevron-left"></i><span class="snazzy-pager__nav-text"> Prev</span>' +
                    '</button>' +
                    '<span ng-repeat="t in tokens track by $index" class="snazzy-pager__slot" ng-class="{\'snazzy-pager__slot--on\': t === page}">' +
                        '<span class="snazzy-pager__gap" ng-if="t === 0">…</span>' +
                        '<button type="button" class="snazzy-pager__btn snazzy-pager__num" ng-if="t !== 0" ng-class="{\'snazzy-pager__num--on\': t === page}"' +
                            ' ng-disabled="busy" ng-click="go(t)" no-busy-guard aria-label="Page {{ t }}" ng-attr-aria-current="{{ t === page ? \'page\' : undefined }}">{{ t }}</button>' +
                    '</span>' +
                    '<span class="snazzy-pager__of">of {{ pages }}</span>' +
                    '<button type="button" class="snazzy-pager__btn snazzy-pager__btn--nav" ng-disabled="page >= pages || busy" ng-click="go(page + 1)" no-busy-guard aria-label="Next page">' +
                        '<span class="snazzy-pager__nav-text">Next </span><i class="fa fa-chevron-right"></i>' +
                    '</button>' +
                '</span>' +
            '</nav>',
        link: function (scope) {
            // 1 … p-1 p p+1 … last  (0 = a gap). Primitive tokens, rebuilt only on
            // change, so ng-repeat never sees a fresh array every digest.
            function rebuild() {
                var per = Math.max(1, Number(scope.perPage) || 25);
                var total = Math.max(0, Number(scope.total) || 0);
                var pages = Math.max(1, Math.ceil(total / per));
                var page = Math.min(Math.max(1, Number(scope.page) || 1), pages);
                scope.pages = pages;
                scope.from = total ? (page - 1) * per + 1 : 0;
                scope.to = Math.min(total, page * per);
                var keep = {}, out = [], last = 0;
                [1, pages, page - 1, page, page + 1].forEach(function (n) { if (n >= 1 && n <= pages) { keep[n] = true; } });
                // close a one-page gap instead of showing "…" for a single number
                if (page - 2 === 2) { keep[2] = true; }
                if (page + 2 === pages - 1) { keep[pages - 1] = true; }
                Object.keys(keep).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
                    if (last && n - last > 1) { out.push(0); }
                    out.push(n);
                    last = n;
                });
                scope.tokens = out;
            }
            scope.$watchGroup(['page', 'total', 'perPage'], rebuild);

            scope.go = function (n) {
                if (scope.busy || n < 1 || n > scope.pages || n === Number(scope.page)) { return; }
                scope.onChange({ page: n });
                if (scope.anchor) {
                    $timeout(function () {
                        var el = document.querySelector(scope.anchor);
                        if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start' }); }
                    }, 0);
                }
            };
        }
    };
}]);
