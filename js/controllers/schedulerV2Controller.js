// ─────────────────────────────────────────────────────────────────────────
// SchedulerV2Controller — the Scheduler v2 page (dashboard.scheduler_v2,
// /dashboard/bookings_v2?date&days). Feeds the framework-agnostic
// ToAviateScheduler (via <ta-scheduler>) with GET scheduler/v2/day, keeps the
// URL in sync (location:'replace'), polls scheduler/v2/version while the tab
// is visible, and routes every mutation through the LEGACY booking endpoints
// exactly as v1 does (see changeBooking — the payload mirrors
// bookingsController.check_before_changing_event field for field).
// Contract: backend FRONTEND_SCHEDULER_V2_GUIDE.md §5.
// ─────────────────────────────────────────────────────────────────────────
app.controller('SchedulerV2Controller', SchedulerV2Controller);

SchedulerV2Controller.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$uibModal', '$q', '$interval', '$timeout',
    'SchedulerV2Service', 'WaitingRequestsService', 'BookingService', 'MemberService', 'ToastService'];
function SchedulerV2Controller($rootScope, $scope, $state, $stateParams, $uibModal, $q, $interval, $timeout,
    SchedulerV2Service, WaitingRequestsService, BookingService, MemberService, ToastService) {

    var vm = this;
    var STATE = 'dashboard.scheduler_v2';
    var POLL_MS = 30000;
    var page_left = false;

    vm.user = $rootScope.globals.currentUser;
    vm.day = null;              // the last GET scheduler/v2/day response (verbatim, handed to the directive)
    vm.settings = {};
    vm.loading = false;
    vm.error = null;
    vm.isStaff = isStaffAnywhere();
    vm.waitingBadge = 0;
    vm.match = null;            // { count, slot } — "people on the waiting list could take this slot" banner
    vm.scheduler = null;        // directive api
    vm.libReady = (typeof window.ToAviateScheduler !== 'undefined');
    vm.pickerReady = (typeof window.ToAviateDatePicker !== 'undefined');

    // ── Which day / how many ──
    // URL params win; else the view remembered for the add-booking round trip;
    // else today + the remembered day count.
    var remembered = readJson(sessionStorage, SchedulerV2Service.VIEW_KEY) || {};
    vm.date = validDate($stateParams.date) || validDate(remembered.date) || moment().format('YYYY-MM-DD');
    vm.days = validDays($stateParams.days) || validDays(remembered.days) || validDays(readLocal(SchedulerV2Service.DAYS_KEY)) || 1;
    // "Hide instructors not working today" — the viewer's choice (localStorage), else
    // v1's "show all" override as a seed, else null = "the club setting decides" until
    // the first day response tells us what that is (settings.hide_unavailable_instructors).
    vm.hideUnavailable = readHideChoice();
    // Club filter: 0 = every club the viewer belongs to (the default), else one club id.
    // Only shown when the viewer has more than one club; remembered per browser.
    var CLUB_KEY = 'toaviate_sv2_club';
    vm.clubs = [];
    vm.clubFilter = parseInt(readLocal(CLUB_KEY), 10) || 0;
    vm.setClub = function (id) {
        id = parseInt(id, 10) || 0;
        if (id === vm.clubFilter) { return; }
        vm.clubFilter = id;
        writeLocal(CLUB_KEY, String(id));
        monthAsked = {}; monthBusy = {};          // busy dots are per club
        vm.refetch();
    };
    vm.showAll = (vm.hideUnavailable === false);     // kept for the directive's legacy `show-all` binding

    // init() runs at the very end of this function: the `var` state below
    // (fetchSeq, inFlight, poll, picker…) must be assigned before the first fetch.

    // ═══════════════════════════════════════════════════════════════════
    // Data
    // ═══════════════════════════════════════════════════════════════════
    var fetchSeq = 0;
    function fetch() {
        var seq = ++fetchSeq;
        vm.loading = true;
        vm.error = null;
        // hide_unavailable=1 applies the one availability rule whatever the club setting;
        // show_all_instructors=1 is the viewer's override of a club that hides them.
        var params = { date: vm.date, days: vm.days };
        if (vm.clubFilter) { params.club_id = vm.clubFilter; }
        if (vm.hideUnavailable === true) { params.hide_unavailable = 1; }
        else if (vm.hideUnavailable === false) { params.show_all_instructors = 1; }
        return SchedulerV2Service.GetDay(params)
            .then(function (data) {
                if (seq !== fetchSeq || page_left) { return data; }
                vm.loading = false;
                if (!data || !data.success) {
                    vm.error = textOf(data && data.message) || 'The schedule could not be loaded.';
                    return data;
                }
                vm.day = data;
                vm.settings = data.settings || {};
                vm.version = data.schedule_version;
                if (typeof vm.settings.is_staff !== 'undefined') { vm.isStaff = !!vm.settings.is_staff; }
                // no choice yet → the toggle starts where the club setting puts it
                if (vm.hideUnavailable === null) { vm.hideUnavailable = parseInt(vm.settings.hide_unavailable_instructors, 10) === 1; vm.showAll = !vm.hideUnavailable; }
                // the viewer's clubs (independent of the filter) → the club chips
                if (vm.settings.clubs && vm.settings.clubs.length) {
                    vm.clubs = vm.settings.clubs.map(function (c) { return { id: parseInt(c.id, 10), title: String(c.title || '').trim() }; });
                    if (vm.clubFilter && !vm.clubs.some(function (c) { return c.id === vm.clubFilter; })) { vm.clubFilter = 0; writeLocal(CLUB_KEY, '0'); }
                }
                // staff: the club's open requests; member: their own open ones (backend counts both)
                if (typeof data.waiting_requests_open !== 'undefined') { vm.waitingBadge = parseInt(data.waiting_requests_open, 10) || 0; }
                return data;
            });
    }

    // ── URL ↔ state (replace, never push: the page is one stop in history) ──
    function syncUrl() {
        if (page_left || $state.current.name !== STATE) { return; }
        $state.go(STATE, { date: vm.date, days: String(vm.days) }, { notify: false, location: 'replace' });
    }
    function rememberView() {
        writeJson(sessionStorage, SchedulerV2Service.VIEW_KEY, { date: vm.date, days: vm.days });
        writeLocal(SchedulerV2Service.DAYS_KEY, String(vm.days));
    }

    vm.onDateChange = function (date) {
        date = validDate(date);
        if (!date || date === vm.date) { return; }
        vm.date = date;
        rememberView(); syncUrl(); fetch();
    };
    vm.onDaysChange = function (days) {
        days = validDays(days);
        if (!days || days === vm.days) { return; }
        vm.days = days;
        rememberView(); syncUrl(); fetch();
    };
    // The library's hide toggle (hideToggle:{on} / on.hideToggle). The choice is
    // remembered per browser and the day is refetched with the matching param.
    vm.toggleHide = function (on) {
        on = !!on;
        if (on === vm.hideUnavailable) { return; }
        vm.hideUnavailable = on;
        vm.showAll = !on;
        writeLocal(SchedulerV2Service.HIDE_KEY, on ? '1' : '0');
        fetch();
    };
    // the library's older "show all" switch is the same choice, inverted
    vm.toggleShowAll = function (on) { vm.toggleHide(!on); };
    vm.groupToggle = function () { /* the library remembers its own group state */ };

    // ── Version polling (30 s, visible tab only) ──
    var poll = null;
    function startPolling() {
        poll = $interval(checkVersion, POLL_MS);
        document.addEventListener('visibilitychange', onVisibility);
    }
    function onVisibility() { if (document.visibilityState === 'visible') { checkVersion(); } }
    function checkVersion() {
        if (page_left || document.visibilityState !== 'visible' || vm.loading || !vm.day) { return; }
        SchedulerV2Service.GetVersion(vm.clubFilter || undefined).then(function (data) {
            if (page_left || !data || !data.success) { return; }
            if (typeof vm.version !== 'undefined' && String(data.schedule_version) !== String(vm.version)) {
                vm.version = data.schedule_version;
                vm.refetch();
            }
        });
    }

    $scope.$on('$destroy', function () {
        page_left = true;
        if (poll) { $interval.cancel(poll); poll = null; }
        offRefresh(); offWaiting(); offChildExit();
        document.removeEventListener('visibilitychange', onVisibility);
        if (picker) { try { picker.destroy(); } catch (e) {} picker = null; }
    });

    // ═══════════════════════════════════════════════════════════════════
    // Date picker (library popover anchored on the toolbar's date button)
    // ═══════════════════════════════════════════════════════════════════
    var picker = null, pickerAnchor = null;
    var monthBusy = {};     // 'YYYY-MM' → { 'YYYY-MM-DD': count }
    var monthAsked = {};
    // Synchronous 0..3 for a day's dots (the picker AND the phone strip ask this);
    // a month seen for the first time is fetched and the picker redrawn.
    vm.busyFor = function (dateStr) {
        if (!dateStr) { return 0; }
        var ym = String(dateStr).substr(0, 7);
        var m = monthBusy[ym];
        if (!m && !monthAsked[ym]) { loadMonth(ym); }
        return m ? SchedulerV2Service.busyLevel(m[dateStr]) : 0;
    };
    // `anchor` is { el } — the toolbar's date button (the library re-renders its
    // toolbar, so the element changes; a fresh element gets a fresh popover).
    // attach() binds its own click-toggle on the button, so once attached the
    // button's later clicks are the library's; only the first press opens here,
    // deferred past the click that is still bubbling.
    vm.pickDate = function (anchor) {
        var el = anchor && anchor.el;
        if (!vm.pickerReady || !el) { return; }
        if (picker && pickerAnchor === el) { return; }
        if (picker) { try { picker.destroy(); } catch (e) {} picker = null; }
        pickerAnchor = el;
        picker = window.ToAviateDatePicker.attach(el, {
                value: vm.date,
                weekStart: parseInt(vm.settings.week_start, 10) === 0 ? 0 : 1,
                dots: true,
                getBusy: vm.busyFor,
                onMonthChange: function (yyyyMm) { loadMonth(yyyyMm); },
                onPick: function (dateStr) { $scope.$evalAsync(function () { vm.onDateChange(dateStr); }); }
        });
        var handle = picker;
        $timeout(function () { if (handle === picker && !handle.isOpen()) { handle.open(); } }, 0, false);
    };
    function loadMonth(yyyyMm) {
        if (!/^\d{4}-\d{2}$/.test(yyyyMm) || monthAsked[yyyyMm]) { return; }
        monthAsked[yyyyMm] = true;
        // asked from library callbacks (no digest running) — $evalAsync gets $http going
        $scope.$evalAsync(function () {
            SchedulerV2Service.GetMonth(yyyyMm, vm.clubFilter || undefined).then(function (data) {
                if (page_left || !data || !data.success) { delete monthAsked[yyyyMm]; return; }
                monthBusy[yyyyMm] = data.days || {};
                if (picker) { picker.picker.refresh(); }
                if (vm.scheduler && vm.scheduler.instance && vm.scheduler.instance.render) { vm.scheduler.instance.render(); }
            });
        });
    }
    vm.refetch = function () { SchedulerV2Service.InvalidateMonths(); monthBusy = {}; monthAsked = {}; return fetch(); };

    // ═══════════════════════════════════════════════════════════════════
    // Create / edit → the booking form, a slide-out PANEL over this page
    // ═══════════════════════════════════════════════════════════════════
    // The form (Bookings2Controller, snazzy templates — owned by the form agent) lives in
    // CHILD states of this one, rendered into <ui-view name="panel"> at the end of
    // scheduler_v2.html: dashboard.scheduler_v2.add (/new?plane_id&instructor_id&start&duration)
    // and dashboard.scheduler_v2.edit (/edit/:booking_id). Entering a child is a state
    // change (not a search change), so the parent's reloadOnSearch:false does not block
    // it, and the parent controller is NOT re-instantiated (no `reload` on the transition).
    // The panel broadcasts `sv2:refresh` {date} after a save; leaving it back to the parent
    // also refetches (once — see onChildExit). Until those states are registered the
    // legacy pages are the fallback so the buttons never go dead.
    var ADD_STATE = STATE + '.add', EDIT_STATE = STATE + '.edit';
    function hasState(name) { try { return !!$state.get(name); } catch (e) { return false; } }

    // draft = { plane_id, instructor_id, start, end, source: 'button'|'gap'|'drag' } from the library:
    // a drag-select on an aircraft row carries plane_id, on an instructor row {plane_id:0, instructor_id}.
    // The "+ New booking" button means "a booking on the day I'm looking at": the current date at
    // day_start, 60 min. Times are wall-clock strings end to end (no moment() on a zoned string).
    vm.create = function (draft) {
        draft = draft || {};
        var dayStart = /^\d{2}:\d{2}/.test(vm.settings.day_start || '') ? vm.settings.day_start.substr(0, 5) : '09:00';
        var start, duration;
        if (draft.source === 'button' || !draft.start) {
            start = vm.date + 'T' + dayStart + ':00';
            duration = 60;
        } else {
            start = SchedulerV2Service.toLegacyDateTime(draft.start);
            var mins = draft.end ? moment(SchedulerV2Service.toWallClock(draft.end)).diff(moment(SchedulerV2Service.toWallClock(draft.start)), 'minutes') : 0;
            duration = mins > 0 ? Math.max(30, mins) : 60;
        }
        var planeId = parseInt(String(draft.plane_id || '').replace(/w$/, ''), 10);
        var instructorId = parseInt(draft.instructor_id, 10);
        rememberView();
        var params = {
            plane_id: planeId > 0 ? String(planeId) : null,
            instructor_id: instructorId > 0 ? String(instructorId) : null,
            start: start,
            duration: duration
        };
        if (hasState(ADD_STATE)) {
            $state.go(ADD_STATE, params);                 // date/days inherit from this state
        } else {
            console.log('SchedulerV2: ' + ADD_STATE + ' is not registered yet — falling back to dashboard.add_booking');
            $state.go('dashboard.add_booking', angular.extend(params, { from: 'v2' }));
        }
    };
    vm.edit = function (bookingId) {
        rememberView();
        if (hasState(EDIT_STATE)) { $state.go(EDIT_STATE, { booking_id: bookingId }); }
        else {
            console.log('SchedulerV2: ' + EDIT_STATE + ' is not registered yet — falling back to dashboard.edit_booking');
            $state.go('dashboard.edit_booking', { booking_id: bookingId });
        }
    };

    // The panel says "I saved something" → show that day, fresh. A child → parent
    // transition (panel closed) refetches too, unless the refresh just did.
    var lastRefreshAt = 0;
    var offRefresh = $rootScope.$on('sv2:refresh', function (e, payload) {
        if (page_left) { return; }
        payload = payload || {};
        var d = validDate(payload.date);
        if (d && d !== vm.date) { vm.date = d; rememberView(); syncUrl(); }
        lastRefreshAt = Date.now();
        vm.refetch();
    });
    var offChildExit = $rootScope.$on('$stateChangeSuccess', function (e, to, toParams, from) {
        if (page_left || !to || !from) { return; }
        var fromChild = String(from.name).indexOf(STATE + '.') === 0;
        if (fromChild && to.name === STATE && (Date.now() - lastRefreshAt) > 1500) { vm.refetch(); }
    });

    // ═══════════════════════════════════════════════════════════════════
    // Move / resize — the SAME request v1 sends from a FullCalendar drop
    // ═══════════════════════════════════════════════════════════════════
    // v1 (bookingsController.alertOnDrop/alertOnResize → check_before_changing_event
    // → BookingService.updateBooking) PUTs the whole FullCalendar event object
    // minus a handful of keys. That event is the legacy `bookings_to_events2`
    // shape — user_id, instructor {…}, passengers, free_seats, rental_items,
    // description, tuition_id, course_id, maintenance_flight … all of which the
    // backend's booking_change reads back and REWRITES. The v2 day payload is
    // slimmer, so we fetch the legacy shape for that one booking
    // (GET bookings/edit/{user}/{id} — the edit page's own fetch) and apply the
    // drop to it. Nothing is lost and the wire payload is v1's.
    var inFlight = false;
    vm.move = function (change) { return changeBooking(change, 'move'); };
    vm.resize = function (change) { return changeBooking(change, 'resize'); };

    function changeBooking(change, kind) {
        if (!change || !change.booking) { return $q.reject({ ok: false }); }
        if (inFlight) {
            ToastService.warning('One at a time', 'Another change is still saving — wait for it to finish.');
            return $q.reject({ ok: false, busy: true });
        }
        inFlight = true;
        var booking = change.booking;
        return BookingService.GetEdit(vm.user.id, booking.id).then(function (data) {
            if (!data || !data.success || !data.booking) {
                ToastService.error('Cannot change booking', textOf(data && data.message) || 'You cannot edit this booking.');
                return $q.reject({ ok: false });
            }
            var original = data.booking;
            var evnt = buildLegacyPayload(original, change, kind);
            if (!evnt.plane_id) {
                // never PUT an empty aircraft id — the backend answers "not assigned to aircraft ID ."
                ToastService.error('Cannot change booking', 'The aircraft for this booking could not be worked out — reload the page and try again.');
                return $q.reject({ ok: false });
            }

            // v1 guard 1: the role-based edit window (mirrors backend is_within_edit_window)
            if (!isWithinEditWindow(evnt.end)) {
                ToastService.warning('Past Booking', 'The edit window for this booking has passed — you can no longer amend it.');
                return $q.reject({ ok: false });
            }
            // v1 guard 2: a booking that started > 30 min ago keeps its start time
            // (v1 asked with confirm(); here it is the same question, restyled)
            var pre = $q.when(evnt);
            if (moment(SchedulerV2Service.toWallClock(change.start)).add(30, 'minutes') < moment()) {
                pre = openDialog({
                    mode: 'question',
                    title: 'This booking has already started',
                    message: 'You cannot amend the start date or time of a booking in the past. Would you like to amend the end time along with any other changes you have made?',
                    buttons: [{ label: 'Change the end time only', value: 'keep_start', primary: true }]
                }).then(function (answer) {
                    if (answer !== 'keep_start') { return $q.reject({ ok: false, cancelled: true }); }
                    evnt.start = SchedulerV2Service.toLegacyDateTime(original.start);
                    return evnt;
                });
            }
            return pre.then(function () { return putWithOverrides(evnt, original, [], booking); });
        }).finally(function () { inFlight = false; });
    }

    // Copies check_before_changing_event(event) from bookingsController.js, with two
    // things FullCalendar gave v1 for free worked out here:
    //  • the aircraft. v1 read event.resourceId (the row the chip sits on). The legacy
    //    edit shape (bookings_to_events2) has NEITHER resourceId NOR plane_id — only
    //    plane:{id}. So: the row the chip was dropped on (change.plane_id, a move) →
    //    the legacy plane.id → the v2 booking's plane_id. Never an empty string: the
    //    backend turns that into "not assigned to aircraft ID ." and the edit fails.
    //  • the instructor. A drop onto another instructor's row carries
    //    change.instructor_id; the payload then gets instructor_id AND instructor:{id}
    //    (booking_change prefers instructor->id). Unchanged → left exactly as v1 sends
    //    it (instructor_id absent from the legacy shape → omitted).
    function buildLegacyPayload(legacy, change, kind) {
        var event = angular.extend({}, legacy);           // v1: jQuery.extend({}, event)
        var booking = change.booking || {};
        var legacyPlane = (legacy.plane && legacy.plane.id) || legacy.plane_id || legacy.resourceId || '';
        var planeId = '';
        if (kind === 'move' && change.plane_id !== null && change.plane_id !== undefined && String(change.plane_id) !== '' && String(change.plane_id) !== '0') {
            planeId = String(change.plane_id);
        } else {
            planeId = String(legacyPlane || booking.plane_id || change.plane_id || '');
        }
        // the waiting-list sub-row is "{plane_id}w" → changed_to_waiting_list + strip the w
        var toWaiting = (kind === 'move') ? !!(change.waiting_list || /w$/.test(planeId)) : (parseInt(booking.waiting_list, 10) > 0);
        if (toWaiting) { event.changed_to_waiting_list = true; }
        event.resourceId = planeId.replace(/w$/, '');
        if (event.resourceId === '0') { event.resourceId = ''; }
        event.start = SchedulerV2Service.toLegacyDateTime(change.start);
        event.end = SchedulerV2Service.toLegacyDateTime(change.end);

        var evnt = angular.extend({}, event);
        evnt.plane_id = event.resourceId;
        if (event.instructor_id !== "") {                  // (undefined on the legacy shape → omitted, exactly as v1)
            evnt.instructor_id = event.instructor_id;
        } else {
            evnt.instructor_id = "0";
        }
        // instructor re-assignment (a drop onto another instructor's row)
        var currentIns = parseInt((legacy.instructor && legacy.instructor.id) || booking.instructor_id || 0, 10) || 0;
        var newIns = parseInt(change.instructor_id, 10);
        if (change.instructor_id !== null && change.instructor_id !== undefined && !isNaN(newIns) && newIns !== currentIns) {
            evnt.instructor_id = String(newIns);
            evnt.instructor = newIns > 0 ? { id: newIns } : "";
        }
        delete evnt._start;
        delete evnt._end;
        delete evnt._id;
        delete evnt.source;
        delete evnt._allDay;
        delete evnt.allDay;
        delete evnt.className;
        delete evnt.plane;
        delete evnt.title;
        delete evnt.editable;
        delete evnt.resourceIds;
        evnt.update_rental_items = true;
        return evnt;                                       // updateBooking adds person_editing
    }

    // PUT, and on a conflict re-PUT with the override the user chose (v1:
    // override_booking_change(flag) sets vm.error_event[flag] = true and resubmits).
    // Overrides are CUMULATIVE: `evnt` is the same object on every round, so every
    // flag granted so far rides along with the new one. The dialog shows only what
    // the LATEST response reports; an error whose flag was already granted (the
    // backend repeats "instructor is not available" even when it is being
    // overridden) is shown as applied, with no second button.
    // `granted` = the override flags the user has pressed so far (update_rental_items
    // is always on the payload, as v1 sends it, but only counts once confirmed).
    function putWithOverrides(evnt, original, granted, booking) {
        return BookingService.updateBooking(evnt, vm.user.id).then(function (data) {
            if (data && data.success == true) {
                ToastService.success('Changes Saved', 'Your changes were saved successfully');
                var freed = { club_id: original.club_id || booking.club_id, start: original.start || booking.start, end: original.end || booking.end,
                    plane_id: (original.plane && original.plane.id) || original.plane_id || booking.plane_id,
                    instructor_id: (original.instructor && original.instructor.id) || booking.instructor_id || 0 };
                return vm.refetch().then(function () { checkFreedSlot(freed); return { ok: true }; });
            }
            // clubs.double_booking_by: the drop would put the booking on the waiting list (a second
            // booking on a taken slot) and this club does not let this user do that. Never overridable,
            // so no conflict dialog — one friendly toast and the chip reverts. (The library already refuses
            // the drop client-side when the day payload says can_wait:false; this is the backend's word.)
            if (data && data.error === 'DOUBLE_BOOKING_NOT_ALLOWED') {
                var who = (data.double_booking_by === 'admins') ? 'admins' : 'instructors and admins';
                ToastService.error('Slot already taken', 'This club only lets ' + who + ' add a second booking on a taken slot (the waiting list).');
                return $q.reject({ ok: false });
            }
            var errors = conflictErrors(data || {}, granted);
            if (!errors.length) {
                ToastService.error('Cannot Edit Booking', textOf(data && data.message) || 'The booking could not be changed.');
                return $q.reject({ ok: false });
            }
            ToastService.warning('Booking conflict', errors[0].message);
            return openDialog({ mode: 'conflict', errors: errors, response: data, granted: granted }).then(function (override) {
                if (!override) { return $q.reject({ ok: false, cancelled: true }); }
                evnt[override] = true;                          // cumulative: every earlier flag is still on evnt
                if (granted.indexOf(override) < 0) { granted.push(override); }
                return putWithOverrides(evnt, original, granted, booking);
            });
        });
    }

    // v1's error → dialog mapping, verbatim (message, api detail, override flag, button),
    // plus the aircraft clash v1 never named. `granted` = flags already on the payload.
    function conflictErrors(data, granted) {
        granted = granted || [];
        var errors = [];
        function push(e) {
            e.granted = granted.indexOf(e.override) > -1;
            if (e.granted) { e.button = ""; }
            errors.push(e);
        }
        if (data.instructor !== true && typeof data.instructor !== 'undefined') {
            push({
                type: "instructor",
                message: "It looks like your instructor is not available on the updated date and time",
                api: data.instructor,
                override: "instructor_override",
                // v1 never offers this one from a drag; the backend now says who may
                // override (can_override) — only then is the button shown.
                button: (data.can_override === true) ? "Override & Save" : ""
            });
        }
        if (data.plane !== true && typeof data.plane !== 'undefined') {
            push({
                type: "plane",
                message: "The aircraft is not available at the new date and time",
                api: data.plane,
                override: "",
                button: ""
            });
        }
        if (data.check_user !== true && typeof data.check_user !== 'undefined') {
            if (String(data.check_user).indexOf("self-certify") > -1) {
                push({
                    type: "check_user",
                    message: "It would appear that you are not within the currency requirements to book this aircraft for this flight.",
                    api: data.check_user,
                    override: "currency_override",
                    button: "I am Current"
                });
            } else if (data.check_user_reason === "no_payment_method") {
                // no payment method in the club (2026-11-08) — an admin of the club may book it anyway
                push({
                    type: "check_user",
                    message: "No payment method is set up for this flight.",
                    api: data.check_user,
                    override: (data.can_payment_override === true) ? "payment_override" : "",
                    button: (data.can_payment_override === true) ? "Book without a payment method" : ""
                });
            } else {
                push({
                    type: "check_user",
                    message: "It looks like your user account does not allow this booking to happen",
                    api: data.check_user,
                    override: "",
                    button: ""
                });
            }
        } else if (data.rental_items !== true && typeof data.rental_items !== 'undefined') {
            push({
                type: "rental_items",
                message: "It looks like some of the rental items are not available",
                api: data.rental_items,
                override: "update_rental_items",
                button: "Confirm Changes"
            });
        }
        return errors;
    }

    function openDialog(dialog) {
        return $uibModal.open({
            templateUrl: 'views/modals/scheduler_conflict.html',
            controller: 'SchedulerConflictController',
            controllerAs: 'vm',
            windowClass: 'sv2-modal-window',
            backdrop: 'static',
            resolve: { dialog: function () { return dialog; } }
        }).result.then(function (v) { return v; }, function () { return null; });
    }

    // Mirrors bookingsController.isWithinEditWindow (backend is_within_edit_window).
    function isWithinEditWindow(bookingEnd) {
        var endMoment = moment(SchedulerV2Service.toWallClock(bookingEnd));
        if (endMoment.isAfter(moment())) { return true; }
        var club = vm.user.current_club_admin;
        if (!club) { return false; }
        if (vm.user.access.super_admin && vm.user.access.super_admin.indexOf(parseInt(club.id)) > -1) { return true; }
        var windowMinutes;
        if (vm.user.access.manager.indexOf(parseInt(club.id)) > -1) {
            windowMinutes = parseInt(club.edit_window_admin_minutes) || 0;
        } else if (vm.user.access.instructor.indexOf(parseInt(club.id)) > -1) {
            windowMinutes = parseInt(club.edit_window_instructor_minutes) || 0;
        } else {
            windowMinutes = parseInt(club.edit_window_member_minutes);
            if (isNaN(windowMinutes)) { windowMinutes = 60; }
        }
        if (windowMinutes === 0) { return true; }
        return moment().isSameOrBefore(endMoment.clone().add(windowMinutes, 'minutes'));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Booking card
    // ═══════════════════════════════════════════════════════════════════
    vm.openBooking = function (booking) {
        if (!booking || !booking.id) { return; }
        var ctx = { userId: vm.user.id, isStaff: vm.isStaff, now: vm.day && vm.day.now, summary: booking };
        $uibModal.open({
            templateUrl: 'views/modals/scheduler_booking_card.html',
            controller: 'SchedulerBookingCardController',
            controllerAs: 'vm',
            windowClass: 'sv2-modal-window sv2-sheet-window',
            resolve: { bookingId: function () { return booking.id; }, ctx: function () { return ctx; } }
        }).result.then(function (res) {
            res = res || {};
            if (res.action === 'edit') {
                vm.edit(res.booking.id);
            } else if (res.action === 'bookout') {
                $state.go('dashboard.my_account.bookout_with_booking', { booking_id: res.booking.id });
            } else if (res.action === 'bookin') {
                if (res.booking.plane_log_sheet_id) { $state.go('dashboard.my_account.book_in', { id: res.booking.plane_log_sheet_id }); }
                else { $state.go('dashboard.my_account'); }
            } else if (res.action === 'records') {
                // Student records: previousState is this state with ?date&days, so its BACK lands
                // back on the same day (CLAUDE.md "Student records — return path"). Without a course
                // the page shows its course picker.
                var rb = res.booking || {}, rp = { club_id: rb.club_id, student_id: rb.pilot && rb.pilot.id };
                if (parseInt(rb.course_id, 10) > 0) { rp.course_id = rb.course_id; }
                $state.go('dashboard.manage_user.student_records', rp);
            } else if (res.action === 'history') {
                $state.go('dashboard.my_account.booking_audit_trail', { booking_id: res.booking.id });
            } else if (res.action === 'cancelled') {
                var b = res.booking || {};
                vm.refetch().then(function () {
                    checkFreedSlot({ club_id: b.club_id, start: b.start, end: b.end, plane_id: b.plane_id, instructor_id: b.instructor_id });
                });
            } else if (res.action === 'refetch') {
                vm.refetch();
            }
        }, function () {});
    };

    // ═══════════════════════════════════════════════════════════════════
    // Waiting list
    // ═══════════════════════════════════════════════════════════════════
    // Staff: after a cancel or move, who on the waiting list could take the freed slot?
    function checkFreedSlot(slot) {
        if (!vm.isStaff || !slot || !slot.start || !slot.end) { return; }
        var params = {
            club_id: slot.club_id,
            start: SchedulerV2Service.toWallClock(slot.start),      // wall-clock strings, never shifted
            end: SchedulerV2Service.toWallClock(slot.end),
            plane_id: slot.plane_id,
            instructor_id: slot.instructor_id || 0
        };
        WaitingRequestsService.Matches(params).then(function (data) {
            if (page_left || !data || !data.success) { return; }
            var list = data.matches || [];
            if (!list.length) { return; }
            vm.match = { count: list.length, slot: params, date: String(params.start).substr(0, 10), label: SchedulerV2Service.fmtShortDate(slot.start) + ' · ' + SchedulerV2Service.fmtRange(slot.start, slot.end) };
            ToastService.success('Waiting list', list.length + (list.length === 1 ? ' person' : ' people') + ' on the waiting list could take this slot', { confetti: false });
        });
    }
    vm.dismissMatch = function () { vm.match = null; };

    // opts: { date } = open the staff panel on that day (the booking panel's "back to the waiting list" link)
    vm.openWaitingList = function (slot, opts) {
        var clubsP = loadClubs();
        var opener = vm.isStaff ? openStaffPanel : openMemberForm;
        clubsP.then(function (clubs) { opener(clubs, slot, opts || {}); });
    };
    vm.openMatches = function () { if (vm.match) { vm.openWaitingList(vm.match.slot); } };

    // Cancellations (staff): recent cancellations + the fee decision (CancellationFeesService). Only the clubs the
    // viewer is staff at; the scheduler's club filter wins when it is one of them.
    vm.openCancellations = function () {
        loadClubs().then(function (clubs) {
            var a = (vm.user && vm.user.access) || {};
            var staffIds = [].concat(a.manager || [], a.instructor || [], a.super_admin || []).map(function (x) { return parseInt(x, 10); });
            var mine = (clubs || []).filter(function (c) { return staffIds.indexOf(parseInt(c.id, 10)) > -1; });
            if (!mine.length) { mine = clubs || []; }
            var pick = (vm.clubFilter && mine.some(function (c) { return parseInt(c.id, 10) === vm.clubFilter; })) ? vm.clubFilter : defaultClubId(mine);
            if (!mine.some(function (c) { return parseInt(c.id, 10) === parseInt(pick, 10); })) { pick = mine.length ? parseInt(mine[0].id, 10) : 0; }
            $uibModal.open({
                templateUrl: 'views/modals/cancellations_panel.html',
                controller: 'CancellationsPanelController',
                controllerAs: 'vm',
                windowClass: 'sv2-modal-window sv2-wide-window',
                resolve: { ctx: function () { return { clubs: mine, club_id: pick }; } }
            }).result.then(angular.noop, angular.noop);
        });
    };

    function openStaffPanel(clubs, slot, opts) {
        opts = opts || {};
        var bookingIds = {};
        angular.forEach((vm.day && vm.day.bookings) || [], function (b) { if (b && b.id) { bookingIds[b.id] = true; } });
        $uibModal.open({
            templateUrl: 'views/modals/waiting_requests_panel.html',
            controller: 'WaitingRequestsPanelController',
            controllerAs: 'vm',
            windowClass: 'sv2-modal-window sv2-wide-window',
            resolve: { ctx: function () { return {
                userId: vm.user.id, clubs: clubs, club_id: defaultClubId(clubs), slot: slot || null,
                // the panel shows ONE day (status lives per date, 2026-11-05): the freed slot's day, else the scheduler's current date
                date: (slot && slot.start) ? String(SchedulerV2Service.toWallClock(slot.start)).substr(0, 10) : (validDate(opts.date) || vm.date),
                view: opts.view || 'day',
                bookingIds: bookingIds,                 // a "Booked · G-XXXX 09:00" pill links to the card when the booking is on this day
                fleet: fleetTypes(), instructors: instructorList()
            }; } }
        }).result.then(function (res) {
            afterPanel();
            res = res || {};
            if (res.action === 'book' && res.request) { bookFromRequest(res.request, res.date, res.day); }
            else if (res.action === 'open_booking' && res.booking_id) { vm.openBooking({ id: res.booking_id }); }
        }, afterPanel);
        // the banner is a nudge — opening the list for that slot is its job done
        function afterPanel() { if (slot) { vm.match = null; } refreshWaitingBadge(); }
    }
    // "Book" on a waiting-list row → the booking panel pre-filled from the request (CLAUDE.md "Scheduler v2" → Waiting
    // list → Book). Times from the day's preference — AM 09:00–11:00, PM 13:00–15:00, any 10:00–12:00 — clipped into
    // the club's opening hours for that weekday when it has them. The panel fetches the request itself (?request_id) for
    // the member / aircraft type / notes and PUTs the day fulfilled after the save; the instructor rides as ?instructor_id
    // so the existing instructor-first pre-select runs.
    function bookFromRequest(request, date, day) {
        date = validDate(date) || (day && validDate(day.date)) || vm.date;
        var pref = (day && day.preference) || (WaitingRequestsService.dayOf(request, date) || {}).preference || 'any';
        var startMin = { am: 9 * 60, pm: 13 * 60, any: 10 * 60 }[pref] || 10 * 60, duration = 120;
        var hours = SchedulerV2Service.openingHoursOn(SchedulerV2Service.openingHoursFor(request.club_id), date);
        if (hours && hours.state === 'open') {
            if (startMin < hours.openMin) { startMin = hours.openMin; }
            if (startMin + duration > hours.closeMin) { startMin = Math.max(hours.openMin, hours.closeMin - duration); }
            if (startMin + duration > hours.closeMin) { duration = Math.max(30, hours.closeMin - startMin); }
        }
        var hh = Math.floor(startMin / 60), mm = startMin % 60;
        var start = date + 'T' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ':00';
        var instructorId = (request.kind === 'dual' && parseInt(request.instructor_id, 10) > 0) ? String(request.instructor_id) : null;
        rememberView();
        $state.go(ADD_STATE, { plane_id: null, instructor_id: instructorId, start: start, duration: duration, request_id: String(request.id), request_date: date });
    }
    // the booking panel's "Cancel — back to the waiting list" link (Bookings2Controller broadcasts after closing)
    var offWaiting = $rootScope.$on('sv2:waiting', function (e, payload) {
        if (page_left || !vm.isStaff) { return; }
        payload = payload || {};
        $timeout(function () { vm.openWaitingList(null, { date: payload.date }); }, 50);
    });
    function openMemberForm(clubs) {
        $uibModal.open({
            templateUrl: 'views/modals/waiting_request_form.html',
            controller: 'WaitingRequestFormController',
            controllerAs: 'vm',
            windowClass: 'sv2-modal-window',
            resolve: { ctx: function () { return {
                userId: vm.user.id, clubs: clubs, club_id: defaultClubId(clubs),
                fleet: fleetTypes(), instructors: instructorList(), date: vm.date
            }; } }
        }).result.then(function () { refreshWaitingBadge(); }, function () { refreshWaitingBadge(); });
    }

    // The badge (waiting_requests_open) rides on every day response — a modal
    // closing just refetches the day so the count and the chips are both fresh.
    function refreshWaitingBadge() { if (!page_left) { fetch(); } }

    // settings.clubs comes with the day response; the legacy clubs list is the fallback.
    function loadClubs() {
        var fromDay = (vm.settings && vm.settings.clubs) || [];
        if (fromDay.length) { return $q.when(angular.copy(fromDay)); }
        return MemberService.GetUserClubs(vm.user.id).then(function (data) {
            var clubs = (data && data.clubs) || [];
            if (!clubs.length) {
                angular.forEach(resourceClubIds(), function (id) { clubs.push({ id: id, title: 'Club ' + id }); });
            }
            return clubs;
        });
    }
    function defaultClubId(clubs) {
        var ids = resourceClubIds();
        if (ids.length === 1) { return ids[0]; }
        if (vm.user.current_club_admin && vm.user.current_club_admin.id) { return parseInt(vm.user.current_club_admin.id, 10); }
        if (vm.user.current_club_instructor) { return parseInt(vm.user.current_club_instructor, 10); }
        return clubs.length ? parseInt(clubs[0].id, 10) : null;
    }
    function resourceClubIds() {
        var seen = {}, out = [];
        var r = (vm.day && vm.day.resources) || {};
        angular.forEach((r.aircraft || []).concat(r.instructors || []), function (x) {
            var id = parseInt(x.club_id, 10);
            if (id && !seen[id]) { seen[id] = 1; out.push(id); }
        });
        return out;
    }
    function fleetTypes() {
        var seen = {}, out = [];
        angular.forEach(((vm.day && vm.day.resources) || {}).aircraft || [], function (a) {
            if (a.type && !seen[a.type]) { seen[a.type] = 1; out.push({ type: a.type, label: a.type + (a.model ? ' · ' + a.model : ''), club_id: a.club_id }); }
        });
        return out;
    }
    function instructorList() {
        return angular.copy(((vm.day && vm.day.resources) || {}).instructors || []);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Back to v1
    // ═══════════════════════════════════════════════════════════════════
    vm.classic = function () {
        try { localStorage.removeItem(SchedulerV2Service.FLAG_KEY); } catch (e) {}
        $state.go('dashboard.bookings');
    };

    // ── helpers ──
    function isStaffAnywhere() {
        var a = (vm.user && vm.user.access) || {};
        return !!((a.manager && a.manager.length) || (a.instructor && a.instructor.length) || (a.super_admin && a.super_admin.length));
    }
    function validDate(d) { return (d && /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && moment(d, 'YYYY-MM-DD', true).isValid()) ? String(d) : null; }
    function validDays(n) { n = parseInt(n, 10); return (n === 1 || n === 3 || n === 7) ? n : null; }
    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }
    function readLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function readHideChoice() {
        var v = readLocal(SchedulerV2Service.HIDE_KEY);
        if (v === '1') { return true; }
        if (v === '0') { return false; }
        return readLocal(SchedulerV2Service.SHOW_ALL_KEY) === '1' ? false : null;
    }
    function writeLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function readJson(store, k) { try { return JSON.parse(store.getItem(k)); } catch (e) { return null; } }
    function writeJson(store, k, v) { try { store.setItem(k, JSON.stringify(v)); } catch (e) {} }

    // ═══════════════════════════════════════════════════════════════════
    // Init (last, so every `var` above is assigned)
    // ═══════════════════════════════════════════════════════════════════
    // Being on v2 is the opt-in: dashboard.bookings (the add-booking page's BACK
    // and every old link) now lands here until "Classic scheduler" clears it.
    writeLocal(SchedulerV2Service.FLAG_KEY, '1');
    rememberView();
    syncUrl();
    fetch();
    startPolling();
}
