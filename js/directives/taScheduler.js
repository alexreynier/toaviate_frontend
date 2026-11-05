// ─────────────────────────────────────────────────────────────────────────
// taScheduler — thin AngularJS wrapper around libs/js/toaviate-scheduler.js
// (global ToAviateScheduler, CSS libs/css/toaviate-scheduler.css). The library
// is framework-agnostic; this directive only moves data in and callbacks out.
//
//   <ta-scheduler data="vm.day"                     the §1 GET scheduler/v2/day response, verbatim
//                 date="vm.date" days="vm.days"     'YYYY-MM-DD' / 1|3|7 (host state, pushed to the lib)
//                 hide-on="vm.hideUnavailable"      "hide instructors not working today" switch state (host-owned, lib option hideToggle:{on})
//                 show-all="vm.showAll"             (older lib builds) the same switch, inverted
//                 mode="auto"                       'timeline' | 'list' | 'auto' (list under 700px — the phone day view)
//                 api="vm.scheduler"                receives { highlight(id), scrollToNow(), getState(), setNow(), instance }
//                 get-busy="vm.busyFor(date)"       synchronous 0..3 for the phone strip's dots (optional)
//                 on-date-change="vm.onDateChange(date)"
//                 on-days-change="vm.onDaysChange(days)"
//                 on-open-booking="vm.openBooking(booking)"
//                 on-create="vm.create(draft)"
//                 on-move="vm.move(change)"          MUST return a promise — rejection reverts the chip
//                 on-resize="vm.resize(change)"      same rule
//                 on-hide-toggle="vm.toggleHide(on)"  the lib's hideToggle callback (older builds emit showAllToggle — wired to the same choice)
//                 on-show-all-toggle="vm.toggleShowAll(on)"
//                 on-pick-date="vm.pickDate(anchor)" host opens the date picker popover on `anchor.el`
//                                                   (wrapped: $parse refuses a bare DOM node — isecdom)
//                 on-group-toggle="vm.groupToggle(group, open)">
//   </ta-scheduler>
//
// The instance is created on the FIRST data (its settings seed dayStart /
// dayEnd / slotMinutes / canCreate / isStaff / currentUserId); later data is
// setData(). Callbacks run inside a digest; move/resize hand the library a
// native Promise mirroring the host's $q promise. Everything is destroyed on
// $destroy. When the library is missing the host shows an explanatory notice
// instead of a blank page. Contract: FRONTEND_SCHEDULER_V2_GUIDE.md §3 / §5.
// ─────────────────────────────────────────────────────────────────────────
app.directive('taScheduler', ['$q', '$timeout', function ($q, $timeout) {
    return {
        restrict: 'E',
        scope: {
            data:            '=',
            date:            '=',
            days:            '=',
            showAll:         '=?',
            hideOn:          '=?',
            mode:            '@',
            api:             '=?',
            getBusy:         '&?',
            onDateChange:    '&',
            onDaysChange:    '&',
            onOpenBooking:   '&',
            onCreate:        '&',
            onMove:          '&',
            onResize:        '&',
            onShowAllToggle: '&',
            onHideToggle:    '&',
            onPickDate:      '&',
            onGroupToggle:   '&'
        },
        template:
            '<div class="tas-host"></div>' +
            '<div class="tas-missing" ng-show="missing">' +
                '<i class="fas fa-puzzle-piece"></i>' +
                '<div><strong>The scheduler component is not loaded.</strong>' +
                '<div class="tas-missing__sub">libs/js/toaviate-scheduler.js is missing or failed to load — the page, the waiting list and the booking card still work; the timeline needs the library.</div></div>' +
            '</div>',
        link: function (scope, element, attrs) {
            var host = element[0].querySelector('.tas-host');
            var hasBusy = !!attrs.getBusy;
            var instance = null;
            var destroyed = false;

            scope.missing = (typeof window.ToAviateScheduler === 'undefined');

            // Run a host callback inside a digest whether or not one is already running.
            function inDigest(fn) {
                var out;
                if (scope.$root.$$phase) { out = fn(); }
                else { scope.$apply(function () { out = fn(); }); }
                return out;
            }

            // The library wants a Promise back from move / resize: wrap the host's
            // $q promise in a native one (always thenable, instanceof Promise too).
            function asNativePromise(p) {
                var q = $q.when(p);
                if (typeof window.Promise === 'function') {
                    return new window.Promise(function (resolve, reject) { q.then(resolve, reject); });
                }
                return q;
            }

            function build(day) {
                if (scope.missing || instance || destroyed) { return; }
                var s = (day && day.settings) || {};
                var opts = {
                    date: scope.date || day.date,
                    days: parseInt(scope.days || day.days || 1, 10),
                    mode: scope.mode || 'auto',
                    dayStart: s.day_start || '07:00',
                    dayEnd: s.day_end || '22:00',
                    slotMinutes: parseInt(s.slot_minutes || 30, 10),
                    currentUserId: s.user_id,
                    canCreate: !!s.can_create,
                    isStaff: !!s.is_staff,
                    showAllInstructors: !hideOn(),
                    hideToggle: { on: hideOn() },
                    now: day.now || null,
                    hourWidth: { 1: 112, 3: 60, 7: 40 },   // the day view needs room for "08:00 – 10:00" beside the registration
                    getBusy: hasBusy ? function (dateStr) { return scope.getBusy({ date: dateStr }); } : null,
                    on: {
                        dateChange: function (dateStr) { inDigest(function () { scope.onDateChange({ date: dateStr }); }); },
                        daysChange: function (days) { inDigest(function () { scope.onDaysChange({ days: days }); }); },
                        openBooking: function (booking) { inDigest(function () { scope.onOpenBooking({ booking: booking }); }); },
                        create: function (draft) { inDigest(function () { scope.onCreate({ draft: draft }); }); },
                        move: function (change) { return asNativePromise(inDigest(function () { return scope.onMove({ change: change }); })); },
                        resize: function (change) { return asNativePromise(inDigest(function () { return scope.onResize({ change: change }); })); },
                        hideToggle: function (on) { inDigest(function () { scope.onHideToggle({ on: !!on }); }); },
                        showAllToggle: function (on) { inDigest(function () { scope.onShowAllToggle({ on: on }); }); },
                        pickDate: function (anchorEl) { inDigest(function () { scope.onPickDate({ anchor: { el: anchorEl } }); }); },
                        groupToggle: function (group, open) { inDigest(function () { scope.onGroupToggle({ group: group, open: open }); }); }
                    }
                };
                instance = window.ToAviateScheduler.create(host, opts);
                scope.api = {
                    instance: instance,
                    highlight: function (id) { if (instance && instance.highlight) { instance.highlight(id); } },
                    scrollToNow: function () { if (instance && instance.scrollToNow) { instance.scrollToNow(); } },
                    getState: function () { return instance && instance.getState ? instance.getState() : null; },
                    setNow: function (now) { if (instance && instance.setNow) { instance.setNow(now); } }
                };
            }

            scope.$watch('data', function (day) {
                if (!day || !day.success) { return; }
                if (!instance) { build(day); }
                if (instance) {
                    // The host may have already moved the date / day count while the
                    // fetch was in flight — the response is the truth for what is drawn.
                    if (day.date && instance.setDate && stateOf('date') !== day.date) { instance.setDate(day.date); }
                    if (day.days && instance.setDays && stateOf('days') !== parseInt(day.days, 10)) { instance.setDays(parseInt(day.days, 10)); }
                    instance.setData(day);
                }
            });

            // Host-driven changes (URL, picker, toolbar re-entry) — only when they differ.
            scope.$watch('date', function (d) { if (instance && d && instance.setDate && stateOf('date') !== d) { instance.setDate(d); } });
            scope.$watch('days', function (n) { if (instance && n && instance.setDays && stateOf('days') !== parseInt(n, 10)) { instance.setDays(parseInt(n, 10)); } });
            scope.$watch('showAll', function (on, old) { if (instance && on !== old && instance.setShowAll) { instance.setShowAll(!!on); } });
            scope.$watch('hideOn', function (on, old) { if (instance && on !== old && instance.setHideToggle) { instance.setHideToggle(!!on); } });
            scope.$watch('mode', function (m, old) { if (instance && m && m !== old && instance.setMode) { instance.setMode(m); } });

            // the switch state the host owns: hide-on when bound, else the inverse of show-all
            function hideOn() { return typeof scope.hideOn === 'boolean' ? scope.hideOn : !scope.showAll; }

            function stateOf(key) {
                try { var st = instance.getState ? instance.getState() : null; return st ? st[key] : undefined; } catch (e) { return undefined; }
            }

            scope.$on('$destroy', function () {
                destroyed = true;
                if (instance && instance.destroy) { try { instance.destroy(); } catch (e) {} }
                instance = null;
                scope.api = null;
            });
        }
    };
}]);
