// ═══════════════════════════════════════════════════════════════════
//  <address-lookup on-select="vm.applyAddress(address)"
//                  placeholder="Start typing your address…">
//  Type-as-you-go address autocomplete (Google Places via our API).
//  Debounced 300 ms, min 3 chars, one billing session per attempt
//  (reused across every suggestion call + the final details call,
//  discarded on selection). Selecting fires on-select with the
//  structured address {line1..line4, locality, city, county,
//  postcode, country, formatted}.
//
//  The lookup is an ACCELERATOR, never a gate: on LOOKUP_UNAVAILABLE
//  (no key on this environment) it hides itself entirely; on
//  LOOKUP_FAILED it shows the message briefly — the host form's
//  manual fields must always remain usable.
//  Backend contract: FRONTEND_ADDRESS_LOOKUP_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.directive('addressLookup', ['AddressLookupService', '$timeout', function (AddressLookupService, $timeout) {
    return {
        restrict: 'E',
        scope: {
            onSelect: '&',
            placeholder: '@'
        },
        template:
            '<div class="addrlk" ng-show="!unavailable">' +
            '  <div class="addrlk__inputwrap">' +
            '    <i class="fas addrlk__icon" ng-class="busy ? \'fa-circle-notch fa-spin\' : \'fa-search-location\'"></i>' +
            '    <input type="text" class="addrlk__input" ng-model="q" ng-change="changed()"' +
            '           placeholder="{{ placeholder || \'Start typing your address…\' }}"' +
            '           ng-keydown="keydown($event)" ng-focus="focus()" ng-blur="blur()"' +
            '           autocomplete="off" autocorrect="off" spellcheck="false" />' +
            '  </div>' +
            '  <div class="addrlk__list" ng-show="open && suggestions.length">' +
            '    <button type="button" class="addrlk__item" ng-repeat="s in suggestions"' +
            '            ng-class="{\'addrlk__item--hi\': $index === hi}"' +
            '            ng-mousedown="pick(s, $event)" ng-mouseenter="hi = $index">' +
            '      <i class="fas fa-map-marker-alt"></i>' +
            '      <span class="addrlk__main">{{ s.main_text || s.text }}</span>' +
            '      <span class="addrlk__secondary">{{ s.secondary_text }}</span>' +
            '    </button>' +
            '  </div>' +
            '  <div class="addrlk__error" ng-show="error">{{ error }}</div>' +
            '  <div class="addrlk__hint">Pick a suggestion to fill the fields below — or just type them in yourself.</div>' +
            '</div>',
        link: function (scope) {

            var session = null;
            var debounce = null;
            var errorTimer = null;
            var lastQuery = '';

            scope.q = '';
            scope.suggestions = [];
            scope.open = false;
            scope.busy = false;
            scope.unavailable = false;
            scope.error = '';
            scope.hi = -1;

            scope.changed = function () {
                var q = (scope.q || '').trim();
                if (!session) { session = AddressLookupService.NewSession(); }
                if (debounce) { $timeout.cancel(debounce); }
                if (q.length < 3) {                    // backend returns empty anyway
                    scope.suggestions = [];
                    scope.open = false;
                    return;
                }
                debounce = $timeout(function () { search(q); }, 300);
            };

            function search(q) {
                lastQuery = q;
                scope.busy = true;
                AddressLookupService.Autocomplete(q, session).then(function (data) {
                    if (q !== lastQuery) { return; }   // superseded by newer keystrokes
                    scope.busy = false;
                    if (data && data.error === 'LOOKUP_UNAVAILABLE') {
                        scope.unavailable = true;      // no key here — manual entry only
                        return;
                    }
                    if (data && data.success === false) {
                        showError(data.message || 'Address lookup hiccuped — you can type the address manually.');
                        return;
                    }
                    scope.suggestions = (data && (data.suggestions || data.predictions)) || [];
                    scope.open = scope.suggestions.length > 0;
                    scope.hi = scope.suggestions.length ? 0 : -1;
                });
            }

            scope.pick = function (s, $event) {
                if ($event) { $event.preventDefault(); }   // keep input focus (mousedown)
                scope.open = false;
                scope.busy = true;
                AddressLookupService.Details(s.place_id, session).then(function (data) {
                    scope.busy = false;
                    if (data && data.success && data.address) {
                        scope.q = data.address.formatted || (s.text || s.main_text);
                        scope.suggestions = [];
                        session = null;                     // next attempt → new session
                        scope.onSelect({ address: data.address });
                    } else {
                        showError((data && data.message) || 'Could not fetch that address — please type it in.');
                    }
                });
            };

            scope.keydown = function ($event) {
                if (!scope.open) { return; }
                if ($event.keyCode === 40) {              // ↓
                    $event.preventDefault();
                    scope.hi = Math.min(scope.hi + 1, scope.suggestions.length - 1);
                } else if ($event.keyCode === 38) {       // ↑
                    $event.preventDefault();
                    scope.hi = Math.max(scope.hi - 1, 0);
                } else if ($event.keyCode === 13) {       // Enter
                    $event.preventDefault();
                    if (scope.hi > -1) { scope.pick(scope.suggestions[scope.hi]); }
                } else if ($event.keyCode === 27) {       // Esc
                    scope.open = false;
                }
            };

            scope.focus = function () {
                if (scope.suggestions.length) { scope.open = true; }
            };
            scope.blur = function () {
                // Delay so a mousedown on a suggestion still lands.
                $timeout(function () { scope.open = false; }, 150);
            };

            function showError(msg) {
                scope.error = msg;
                if (errorTimer) { $timeout.cancel(errorTimer); }
                errorTimer = $timeout(function () { scope.error = ''; }, 4000);
            }
        }
    };
}]);
