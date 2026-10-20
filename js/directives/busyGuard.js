// ═══════════════════════════════════════════════════════════════════
//  busyGuard — companion directives for ng-click / ng-submit / ng-change
//  (discrete controls only) / ng-keydown|keypress|keyup (swallow-only).
//  Registered under the SAME names as the stock directives (Angular
//  applies every directive registered for a name), at priority -1 so
//  the post-link — and therefore the event listener — runs before the
//  real handler's. On every press it asks WriteGuard whether the press
//  started a write request one tick later; if it did, the element is
//  locked (disabled attribute + .wg-busy + .wg-busy--spinner) until
//  that write — and any write chained off its response — settles.
//  A second press while locked is swallowed, so a double-tap on Save /
//  Delete / Pay can never fire twice. Nothing is locked for presses
//  that only validate, navigate or open a modal.
//
//  - Works for mouse, keyboard (Enter/Space dispatch click) and ngTouch
//    taps (its triggerHandler('click') runs our listener too; the lock's
//    pointer-events:none blocks the next tap before ngTouch sees it).
//  - A click that bubbles up from an INNER element with its own ng-click
//    is left to that element, so wrappers never lock their whole subtree.
//  - ng-disabled keeps the final say: on unlock the disabled attribute is
//    only cleared if the element's own ng-disabled expression is falsy.
//  - Buttons that already show their own spinner (.fa-spin inside) don't
//    get a second one. Opt out entirely with `no-busy-guard`.
//  - Flows whose write starts AFTER an external step (Stripe.js, a GET,
//    $timeout) are not seen by this guard and need their own flag —
//    see the Stripe-first controllers.
// ═══════════════════════════════════════════════════════════════════

(function () {
    var SAFETY_MS = 30000; // never leave a control locked longer than this
    var DISABLEABLE = { BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1 }; // get the disabled attribute; everything else gets pointer-events:none only

    function stopNow(e) {
        if (e.preventDefault) { e.preventDefault(); }
        if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); }
        else if (e.stopPropagation) { e.stopPropagation(); }
    }

    function hasOwnClick(el) {
        return !!(el.getAttribute && (el.hasAttribute('ng-click') || el.hasAttribute('data-ng-click')));
    }

    // Did this click originate inside a descendant that carries its own ng-click?
    function innerHandlerOwnsIt(e, node) {
        var t = e.target;
        while (t && t !== node) {
            if (hasOwnClick(t)) { return true; }
            t = t.parentNode;
        }
        return false;
    }

    function wantsSpinner(node) {
        var tag = node.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { return false; }
        var buttonLike = tag === 'BUTTON' || /btn/i.test(node.className || '');
        if (!buttonLike) { return false; }
        return !(node.querySelector && node.querySelector('.fa-spin, .fa-spinner, .wg-busy--spinner'));
    }

    function createLock(scope, getTargets, WriteGuard) {
        var locked = false, applied = [], safety = null;

        function lock(ids) {
            if (locked) { return; }
            locked = true;
            var targets = getTargets();
            for (var i = 0; i < targets.length; i++) {
                var node = targets[i];
                var rec = { node: node, disabled: false };
                var el = angular.element(node);
                el.addClass('wg-busy');
                if (DISABLEABLE[node.tagName] && !node.disabled) {
                    node.disabled = true;
                    rec.disabled = true;
                }
                if (wantsSpinner(node)) { el.addClass('wg-busy--spinner'); }
                applied.push(rec);
            }
            safety = setTimeout(unlock, SAFETY_MS);
            follow(ids);
        }

        // Wait for these writes; when they settle, look one tick later for
        // writes chained off the response (save → then update children →
        // then redirect) and keep the lock through those too. The mark is
        // taken AT settle time: a chained write starts inside the response
        // digest, i.e. before the next macrotask, so only writes begun in
        // that window count. Unrelated writes elsewhere in the app (polling,
        // autosave) that started while we were locked are below the mark and
        // never extend the lock.
        function follow(ids) {
            WriteGuard.whenSettled(ids, function () {
                var mark = WriteGuard.seq();
                setTimeout(function () {
                    if (!locked) { return; }
                    var more = WriteGuard.startedSince(mark);
                    if (more.length) { follow(more); } else { unlock(); }
                }, 0);
            });
        }

        function ngDisabledWants(node) {
            var expr = node.getAttribute && (node.getAttribute('ng-disabled') || node.getAttribute('data-ng-disabled'));
            if (!expr) { return false; }
            try { return !!scope.$eval(expr); } catch (err) { return false; }
        }

        function unlock() {
            if (!locked) { return; }
            locked = false;
            clearTimeout(safety);
            for (var i = 0; i < applied.length; i++) {
                var rec = applied[i];
                angular.element(rec.node).removeClass('wg-busy wg-busy--spinner');
                if (rec.disabled && !ngDisabledWants(rec.node)) { rec.node.disabled = false; }
            }
            applied = [];
        }

        scope.$on('$destroy', function () { clearTimeout(safety); });

        return {
            isLocked: function () { return locked; },
            lock: lock
        };
    }

    // Shared press handler: swallow while locked, else check for writes next tick.
    function armed(lock, WriteGuard, el, eventName, skip) {
        el.on(eventName, function (e) {
            if (lock.isLocked()) { stopNow(e); return; }
            if (skip && skip(e)) { return; }
            var mark = WriteGuard.markFor(e);
            setTimeout(function () {
                var ids = WriteGuard.startedSince(mark);
                if (ids.length) { lock.lock(ids); }
            }, 0);
        });
    }

    app.directive('ngClick', ['WriteGuard', function (WriteGuard) {
        return {
            restrict: 'A',
            priority: -1,
            link: function (scope, el, attrs) {
                if ('noBusyGuard' in attrs) { return; }
                var node = el[0];
                var lock = createLock(scope, function () { return [node]; }, WriteGuard);
                armed(lock, WriteGuard, el, 'click', function (e) { return innerHandlerOwnsIt(e, node); });
            }
        };
    }]);

    // ng-change on DISCRETE controls (toggles, checkboxes, radios, selects,
    // and non-input widgets such as ui-select). Text-like inputs are left
    // alone on purpose: disabling one mid-typing would drop focus and eat
    // keystrokes, and an autosave-per-keystroke is not a double-press.
    var TEXT_TYPES = { text: 1, number: 1, email: 1, password: 1, search: 1, tel: 1, url: 1,
                       date: 1, time: 1, 'datetime-local': 1, month: 1, week: 1, color: 1, hidden: 1 };
    function isDiscreteControl(node) {
        var tag = node.tagName;
        if (tag === 'TEXTAREA') { return false; }
        if (tag === 'INPUT') { return !TEXT_TYPES[(node.getAttribute('type') || 'text').toLowerCase()]; }
        return true; // SELECT and custom widgets
    }

    app.directive('ngChange', ['WriteGuard', function (WriteGuard) {
        return {
            restrict: 'A',
            priority: -1,
            require: '?ngModel',
            link: function (scope, el, attrs, ngModel) {
                if ('noBusyGuard' in attrs || !ngModel) { return; }
                var node = el[0];
                if (!isDiscreteControl(node)) { return; }
                var lock = createLock(scope, function () {
                    var targets = [node];
                    // A toggle's visible part is usually the wrapping <label>
                    // (the checkbox itself is opacity:0) — lock that too so the
                    // cursor/opacity feedback lands where the user is looking.
                    var type = (node.getAttribute('type') || '').toLowerCase();
                    if (type === 'checkbox' || type === 'radio') {
                        var label = node.parentNode;
                        while (label && label !== document.body && label.tagName !== 'LABEL') { label = label.parentNode; }
                        if (label && label.tagName === 'LABEL') { targets.push(label); }
                    }
                    return targets;
                }, WriteGuard);
                // Belt and braces: while locked, a change event never reaches
                // Angular's own listener (ours is registered first).
                el.on('change', function (e) { if (lock.isLocked()) { stopNow(e); } });
                // Runs BEFORE ng-change's own listener (ours was pushed first):
                // take the mark, then check for writes one tick later.
                ngModel.$viewChangeListeners.push(function () {
                    if (lock.isLocked()) { return; }
                    var mark = WriteGuard.seq();
                    setTimeout(function () {
                        var ids = WriteGuard.startedSince(mark);
                        if (ids.length) { lock.lock(ids); }
                    }, 0);
                });
            }
        };
    }]);

    // Enter-to-save handlers (ng-keydown / ng-keypress / ng-keyup). The input
    // must stay usable, so nothing is disabled or styled; while the write that
    // a key press started is in flight, further key events on that element
    // are swallowed so a held or repeated Enter can't fire twice.
    angular.forEach(['ngKeydown', 'ngKeypress', 'ngKeyup'], function (name) {
        var eventName = name.slice(2).toLowerCase();
        app.directive(name, ['WriteGuard', function (WriteGuard) {
            return {
                restrict: 'A',
                priority: -1,
                link: function (scope, el, attrs) {
                    if ('noBusyGuard' in attrs) { return; }
                    var lock = createLock(scope, function () { return []; }, WriteGuard);
                    var lockKey = null; // only a repeat of THE key that fired the write is swallowed — typing continues
                    el.on(eventName, function (e) {
                        var key = e.keyCode || e.which || e.key;
                        if (lock.isLocked()) { if (key === lockKey) { stopNow(e); } return; }
                        var mark = WriteGuard.markFor(e);
                        setTimeout(function () {
                            var ids = WriteGuard.startedSince(mark);
                            if (ids.length) { lockKey = key; lock.lock(ids); }
                        }, 0);
                    });
                }
            };
        }]);
    });

    app.directive('ngSubmit', ['WriteGuard', function (WriteGuard) {
        return {
            restrict: 'A',
            priority: -1,
            link: function (scope, el, attrs) {
                if ('noBusyGuard' in attrs) { return; }
                var form = el[0];
                var lock = createLock(scope, function () {
                    var found = form.querySelectorAll('button:not([type="button"]):not([type="reset"]), input[type="submit"]');
                    var list = [];
                    for (var i = 0; i < found.length; i++) { list.push(found[i]); }
                    return list.length ? list : [form];
                }, WriteGuard);
                armed(lock, WriteGuard, el, 'submit', null);
            }
        };
    }]);
})();
