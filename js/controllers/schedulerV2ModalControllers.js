// ─────────────────────────────────────────────────────────────────────────
// Scheduler v2 modals ($uibModal, opened by SchedulerV2Controller):
//   SchedulerBookingCardController  — views/modals/scheduler_booking_card.html
//   SchedulerConflictController     — views/modals/scheduler_conflict.html (v1's booking_errors dialog, restyled)
//   WaitingRequestFormController    — views/modals/waiting_request_form.html (member)
//   WaitingRequestsPanelController  — views/modals/waiting_requests_panel.html (staff: first-come-first-served queue, one day / everyone; status per date)
// Contract: backend FRONTEND_SCHEDULER_V2_GUIDE.md §1 / §2 / §5.
// ─────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════
// Booking card
// ═══════════════════════════════════════════════════════════════════════
app.controller('SchedulerBookingCardController', SchedulerBookingCardController);
SchedulerBookingCardController.$inject = ['$scope', '$uibModalInstance', 'SchedulerV2Service', 'BookingService', 'CancellationFeesService', 'ToastService', 'bookingId', 'ctx'];
function SchedulerBookingCardController($scope, $uibModalInstance, SchedulerV2Service, BookingService, CancellationFeesService, ToastService, bookingId, ctx) {
    var vm = this;
    vm.ctx = ctx || {};
    vm.loading = true;
    vm.error = null;
    vm.b = null;
    vm.step = 'card';            // 'card' | 'cancel'
    vm.cancelling = false;

    // The reasons + the club's cancellation fees come from <cancel-reason-fields> (CancellationFeesService.Policy):
    // v1's reasons verbatim, plus "Late cancellation" / "No-show" for club staff.
    vm.cancel = { reason: '', notes: '' };
    vm.cancelPreset = null;
    vm.noShow = false;

    // What the chip already told us keeps the header meaningful while the detail loads.
    var summary = vm.ctx.summary || {};
    vm.kind = summary.kind || 'dual';
    load();

    function load() {
        SchedulerV2Service.GetBooking(bookingId).then(function (data) {
            vm.loading = false;
            if (!data || !data.success) {
                vm.error = (data && data.error === 'NOT_FOUND') ? 'This booking is no longer on the schedule.' : (textOf(data && data.message) || 'The booking could not be loaded.');
                return;
            }
            vm.b = data.booking || data;
            decorate(vm.b);
        });
    }

    function decorate(b) {
        b.aircraft = b.aircraft || {};
        b.instructor = b.instructor || null;
        b.pilot = b.pilot || {};
        vm.kind = b.kind || 'dual';
        vm.kindLabel = SchedulerV2Service.kindLabel(vm.kind);
        vm.kindColour = SchedulerV2Service.kindColour(vm.kind);
        vm.acColour = b.aircraft.colour || '#94a3b8';
        vm.dateText = SchedulerV2Service.fmtLongDate(b.start);
        vm.rangeText = SchedulerV2Service.fmtRange(b.start, b.end);
        vm.durationText = SchedulerV2Service.fmtDuration(b.start, b.end);
        vm.isMaint = vm.kind === 'maint';
        // "Booked" placeholder: the club's booking_name_visibility hides this pilot from the viewer
        // (guide §1 matrix) — neutral avatar, no sub-line, and the backend has already blanked the
        // notes / passengers / contact / course, so none of those boxes render.
        vm.hiddenPilot = !vm.isMaint && !(parseInt(b.pilot.id, 10) > 0);
        vm.pilotName = vm.hiddenPilot ? (b.pilot.name || 'Booked') : (b.pilot.full_name || b.pilot.name);
        vm.pilotInitials = vm.hiddenPilot ? '' : (b.pilot.initials || SchedulerV2Service.initials(b.pilot.full_name || b.pilot.name));
        vm.instructorInitials = b.instructor ? (b.instructor.code || SchedulerV2Service.initials(b.instructor.name)) : '';
        vm.instructorColour = (b.instructor && b.instructor.colour) || '#94a3b8';
        vm.pilotSub = vm.hiddenPilot ? '' : (vm.kind === 'dual' || vm.kind === 'solo' ? (b.course || 'Student') : (vm.kind === 'trial' ? 'Trial lesson' : (vm.kind === 'hire' ? 'Self-fly hire' : '')));
        vm.noInstructorSub = vm.kind === 'solo' ? 'Potential solo' : (vm.kind === 'hire' ? 'Self-fly hire' : (vm.kind === 'trial' ? 'To be assigned' : ''));
        // Potential solo (bookings.solo OR the lesson's solo flag — guide §1): why it is one
        vm.soloTip = !b.solo ? '' : (b.solo_source === 'lesson' ? 'The lesson is a solo lesson' : 'Flagged as a potential solo by club staff');
        vm.notes = b.description || b.notes || '';
        vm.passengers = angular.isArray(b.passengers) ? b.passengers : [];
        vm.rentalItems = angular.isArray(b.rental_items) ? b.rental_items : [];
        // contact comes ONLY from the endpoint (club staff of the booking's club) — never inferred from a role
        vm.contact = (b.contact && (b.contact.phone || b.contact.email)) ? b.contact : null;
        vm.telHref = vm.contact && vm.contact.phone ? 'tel:' + String(vm.contact.phone).replace(/[^+\d]/g, '') : '';
        vm.mailHref = vm.contact && vm.contact.email ? 'mailto:' + vm.contact.email : '';
        var bookedParts = [];
        if (b.created_at) { bookedParts.push(SchedulerV2Service.fmtShortDate(b.created_at)); }
        if (b.booked_by) { bookedParts.push('by ' + b.booked_by); }
        vm.bookedText = bookedParts.join(' · ');
        // Every action is an endpoint flag (owner / booking's instructor / manager / super-admin
        // for edit + cancel; staff-only for the records link; staff + participants for history).
        vm.canEdit = !!b.can_edit;
        vm.canCancel = !!b.can_cancel;
        vm.canBookOut = !!b.can_book_out;
        vm.canBookIn = !!b.can_book_in;
        vm.canViewRecords = !!b.can_view_records;
        vm.canViewHistory = !!b.can_view_history;
        vm.canMarkNoShow = !!b.can_mark_no_show;   // staff, booking started, never booked out
        vm.statusLabel = SchedulerV2Service.statusLabel(b.status);
        vm.waiting = parseInt(b.waiting_list, 10) > 0;
        vm.inProgress = !!b.booked_out && !b.complete;
        vm.done = !!b.complete;
    }

    // ── actions (the page controller acts on the result) ──
    vm.edit = function () { $uibModalInstance.close({ action: 'edit', booking: vm.b }); };
    vm.bookOut = function () { $uibModalInstance.close({ action: 'bookout', booking: vm.b }); };
    vm.bookIn = function () { $uibModalInstance.close({ action: 'bookin', booking: vm.b }); };
    // Student records (staff) / booking history (staff + participants): the page controller
    // navigates once the modal has closed, so BACK on those pages returns to the scheduler.
    vm.trainingRecord = function () { $uibModalInstance.close({ action: 'records', booking: vm.b }); };
    vm.history = function () { $uibModalInstance.close({ action: 'history', booking: vm.b }); };
    vm.close = function () { $uibModalInstance.dismiss('cancel'); };

    vm.startCancel = function () { vm.cancel = { reason: '', notes: '' }; vm.cancelPreset = null; vm.noShow = false; vm.step = 'cancel'; };
    vm.startNoShow = function () { vm.cancel = { reason: '', key: 'no_show', notes: '' }; vm.cancelPreset = 'no_show'; vm.noShow = true; vm.step = 'cancel'; };
    vm.backToCard = function () { vm.step = 'card'; };
    vm.clearErr = ToastService.clearFieldError;
    vm.confirmLabel = function () {
        if (vm.cancel.claim && vm.cancel.fee > 0) { return (vm.noShow ? 'Mark no-show' : 'Cancel') + ' & charge ' + CancellationFeesService.money(vm.cancel.fee, vm.cancel.currency); }
        return vm.noShow ? 'Mark as no-show' : 'Yes, cancel it';
    };
    vm.confirmCancel = function () {
        if (!vm.cancel.reason) {
            ToastService.warning('Pick a reason', 'Choose why this booking is being cancelled.');
            return;
        }
        if (vm.cancel.key === 'other' && !String(vm.cancel.notes || '').trim()) {
            ToastService.warning('Please specify', 'Add a short note explaining the cancellation.');
            ToastService.highlightField('sbk-cancel-notes');
            return;
        }
        vm.cancelling = true;
        // DELETE bookings/{id}?user_id=&reason=&notes= (the reason lands on the audit trail's "Deleted" entry and the
        // cancelled_bookings archive row), then — switch on + a fee for the reason — POST cancellations/{id}/claim.
        CancellationFeesService.CancelBooking(vm.ctx.userId, vm.b.id, vm.cancel).then(function (res) {
            vm.cancelling = false;
            if (!res.success) {
                ToastService.error('Error', res.message || 'An error occurred');
                return;
            }
            var title = vm.cancel.key === 'no_show' ? 'Marked as a no-show' : 'Booking Cancelled';
            if (res.claim && res.claim.success) {
                ToastService.success(title, CancellationFeesService.outcomeText(res.claim, vm.cancel.currency), { confetti: false });
            } else if (res.claim) {
                ToastService.warning(title + ', fee not added', CancellationFeesService.outcomeText(res.claim) + ' You can claim it from Cancellations.');
            } else {
                ToastService.success(title, vm.cancel.key === 'no_show' ? 'The booking has been recorded as a no-show.' : 'The booking has been cancelled', { confetti: false });
            }
            $uibModalInstance.close({ action: 'cancelled', booking: vm.b, reason: vm.cancel.reason, notes: vm.cancel.notes, fee: res.claim });
        });
    };

    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }
    // passengers: the backend's invitation status in the panel's words
    vm.paxLabel = function (p) {
        var st = p && p.status;
        if (st === 'accepted' || st === 'member') { return 'Ready to fly'; }
        if (st === 'declined') { return 'Declined'; }
        return 'Invited';
    };
    vm.paxTone = function (p) {
        var st = p && p.status;
        if (st === 'accepted' || st === 'member') { return 'ok'; }
        if (st === 'declined') { return 'no'; }
        return 'wait';
    };
}

// ═══════════════════════════════════════════════════════════════════════
// Conflict / override dialog (v1 "Booking Error" popup, one modal)
// ═══════════════════════════════════════════════════════════════════════
app.controller('SchedulerConflictController', SchedulerConflictController);
SchedulerConflictController.$inject = ['$uibModalInstance', 'dialog'];
function SchedulerConflictController($uibModalInstance, dialog) {
    var vm = this;
    vm.d = dialog || {};
    vm.mode = vm.d.mode || 'conflict';                  // 'conflict' | 'question'
    vm.errors = vm.d.errors || [];
    vm.response = vm.d.response || {};
    vm.buttons = vm.d.buttons || [];
    vm.isArray = angular.isArray;
    // overrides already granted on earlier rounds (cumulative — see putWithOverrides)
    vm.granted = vm.d.granted || [];
    var FLAG_LABELS = { instructor_override: 'instructor availability', currency_override: 'currency', update_rental_items: 'rental items' };
    vm.grantedLabels = vm.granted.map(function (f) { return FLAG_LABELS[f] || f; }).join(', ');
    vm.hasOverride = false;
    for (var i = 0; i < vm.errors.length; i++) {
        if (vm.errors[i].button) { vm.hasOverride = true; }
        // the rental-items error carries an array; the others a string (ng-repeat over a string = dupes)
        vm.errors[i].rentals = (vm.errors[i].type === 'rental_items' && angular.isArray(vm.errors[i].api)) ? vm.errors[i].api : [];
    }
    // The API's detail is shown only when it adds something: v1's message already says
    // "is not available", so a bare "is not available" from the backend is noise.
    vm.detail = function (err) {
        if (!err || typeof err.api !== 'string') { return ''; }
        var api = err.api.trim(), msg = (err.message || '').toLowerCase();
        if (api.length < 25 && msg.indexOf(api.toLowerCase()) > -1) { return ''; }
        return api;
    };

    vm.override = function (flag) { $uibModalInstance.close(flag); };   // → evnt[flag] = true; re-PUT
    vm.answer = function (value) { $uibModalInstance.close(value); };
    vm.decline = function () { $uibModalInstance.dismiss('cancel'); };  // v1 decline_booking_change: revert
}

// ═══════════════════════════════════════════════════════════════════════
// Member: new waiting request + my requests
// ═══════════════════════════════════════════════════════════════════════
app.controller('WaitingRequestFormController', WaitingRequestFormController);
WaitingRequestFormController.$inject = ['$scope', '$uibModalInstance', '$timeout', 'WaitingRequestsService', 'MemberService', 'ToastService', 'ctx'];
function WaitingRequestFormController($scope, $uibModalInstance, $timeout, WaitingRequestsService, MemberService, ToastService, ctx) {
    var vm = this;
    vm.ctx = ctx || {};
    vm.enums = WaitingRequestsService.enums;
    vm.clubs = vm.ctx.clubs || [];
    // Staff mode (opened from the waiting-list panel): the request is for a MEMBER the
    // instructor / admin picks — the backend takes `user_id` from club staff only.
    vm.staff = !!vm.ctx.staff;
    vm.member = null;               // {user_id, first_name, last_name}
    vm.memberSearch = '';
    vm.members = [];
    vm.membersLoading = false;
    vm.tab = 'new';                 // 'new' | 'mine'
    vm.saving = false;
    vm.loadingMine = false;
    vm.mine = [];
    vm.changed = false;
    vm.labelOf = { kind: WaitingRequestsService.kindLabel, notice: WaitingRequestsService.noticeLabel, pref: WaitingRequestsService.preferenceLabel, status: WaitingRequestsService.statusLabel, tone: WaitingRequestsService.statusTone,
        dateTone: WaitingRequestsService.dateTone, dateStatus: WaitingRequestsService.dateLabel };
    // status lives per date (2026-11-05): "My requests" shows each day with its own state + the request's derived summary
    vm.liveDays = WaitingRequestsService.liveDays;
    vm.settledDays = function (r) { return ((r && r.dates) || []).length - WaitingRequestsService.liveDays(r); };

    vm.form = {
        club_id: vm.ctx.club_id || (vm.clubs.length ? parseInt(vm.clubs[0].id, 10) : null),
        kind: 'dual',
        plane_type: '',            // '' = any type
        instructor_id: '',         // '' = any instructor
        notice: '60',
        notes: '',
        dates: []                  // [{date, preference}]
    };
    vm.fleetFor = function () {
        var out = [];
        angular.forEach(vm.ctx.fleet || [], function (f) { if (!vm.form.club_id || !f.club_id || String(f.club_id) === String(vm.form.club_id)) { out.push(f); } });
        return out;
    };
    vm.instructorsFor = function () {
        var out = [];
        angular.forEach(vm.ctx.instructors || [], function (i) { if (!vm.form.club_id || !i.club_id || String(i.club_id) === String(vm.form.club_id)) { out.push(i); } });
        return out;
    };
    vm.setKind = function (k) { vm.form.kind = k; if (k !== 'dual') { vm.form.instructor_id = ''; vm.instructor = null; vm.instructorSearch = ''; } };

    // ── staff: member picker — every CURRENT member of the chosen club, searched on the server as you type
    //    (members/search/{club}?q=; the old active_club list only held members with a paid tier) ──
    var searchSeq = 0, searchTimer = null, lastQ = null;
    vm.memberResults = [];
    function searchMembers(q) {
        var cid = parseInt(vm.form.club_id, 10) || 0;
        q = String(q || '').trim();
        if (!vm.staff || !cid) { return; }
        if (q.length < 2) { vm.memberResults = []; vm.membersLoading = false; lastQ = null; return; }
        if (q === lastQ) { return; }
        lastQ = q; vm.membersLoading = true;
        var seq = ++searchSeq;
        MemberService.SearchClubMembers(cid, q, 25).then(function (data) {
            if (seq !== searchSeq) { return; }
            vm.membersLoading = false;
            vm.memberResults = ((data && data.members) || []).filter(function (m) { return parseInt(m.user_id, 10) !== parseInt(vm.ctx.userId, 10); });
            vm.memberMore = !!(data && data.more);
        });
    }
    $scope.$watch('vm.memberSearch', function (q) {
        if (searchTimer) { $timeout.cancel(searchTimer); }
        if (vm.member) { return; }
        searchTimer = $timeout(function () { searchMembers(q); }, 250);
    });
    vm.memberMatches = function () { return (vm.member || String(vm.memberSearch || '').trim().length < 2) ? [] : vm.memberResults; };
    if (vm.staff) {
        $scope.$watch('vm.form.club_id', function (n, o) { if (n !== o) { vm.member = null; vm.memberResults = []; lastQ = null; } });
    }
    // ── instructor picker (dual requests): every CURRENT instructor of the club, whatever their availability —
    //    the request is about future dates, so the scheduler's "working today" rows are the wrong source ──
    vm.instructors = [];            // {user_id, first_name, last_name, name}
    vm.instructor = null;           // picked, or null = any instructor
    vm.instructorSearch = '';
    vm.instructorsLoading = false;
    var instructorsFor = null;
    function loadInstructors() {
        var cid = parseInt(vm.form.club_id, 10) || 0;
        if (!cid || instructorsFor === cid) { return; }
        instructorsFor = cid; vm.instructorsLoading = true; vm.instructors = [];
        MemberService.SearchClubMembers(cid, '', 50, true).then(function (data) {
            vm.instructorsLoading = false;
            var list = (data && data.success && data.members) || [];
            if (!list.length) {   // fallback: whoever the scheduler listed for the club
                angular.forEach(vm.ctx.instructors || [], function (i) { if (!i.club_id || String(i.club_id) === String(cid)) { list.push({ user_id: parseInt(i.id, 10), first_name: '', last_name: '', name: i.name }); } });
            }
            vm.instructors = list;
            // an instructor_id already on the form (e.g. re-opened) → resolve to the row
            if (vm.form.instructor_id) { for (var k = 0; k < list.length; k++) { if (String(list[k].user_id) === String(vm.form.instructor_id)) { vm.instructor = list[k]; } } }
        });
    }
    vm.instructorMatches = function () {
        var q = String(vm.instructorSearch || '').trim().toLowerCase();
        if (vm.instructor) { return []; }
        return vm.instructors.filter(function (i) { return !q || (i.name || (i.first_name + ' ' + i.last_name)).toLowerCase().indexOf(q) > -1; });
    };
    vm.pickInstructor = function (i) { vm.instructor = i; vm.form.instructor_id = i ? String(i.user_id) : ''; vm.instructorSearch = ''; };
    vm.clearInstructor = function () { vm.instructor = null; vm.form.instructor_id = ''; vm.instructorSearch = ''; };
    vm.instructorInitials = function (i) { var n = (i && (i.name || (i.first_name + ' ' + i.last_name))) || ''; return n.split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase(); };
    loadInstructors();
    $scope.$watch('vm.form.club_id', function (n, o) { if (n !== o) { vm.clearInstructor(); instructorsFor = null; loadInstructors(); } });

    vm.pickMember = function (m) { vm.member = m; vm.memberSearch = ''; };
    vm.clearMember = function () { vm.member = null; vm.memberSearch = ''; $timeout(function () { var el = document.getElementById('wrq-member'); if (el) { el.focus(); } }, 0); };
    vm.memberName = function (m) { return m ? (m.first_name + ' ' + m.last_name).trim() : ''; };

    // ── dates: the library date picker on the "Add a date" button ──
    var attached = null;
    vm.pickerReady = (typeof window.ToAviateDatePicker !== 'undefined');
    vm.nativeDate = '';
    $timeout(function () {
        var btn = document.getElementById('wrq-add-date');
        if (!vm.pickerReady || !btn) { return; }
        attached = window.ToAviateDatePicker.attach(btn, {
            value: vm.ctx.date || null,
            allowPast: false,
            dots: false,
            shortcuts: true,
            onPick: function (dateStr) { $scope.$evalAsync(function () { vm.addDate(dateStr); }); }
        });
    }, 0);
    vm.addDate = function (dateStr) {
        if (!dateStr) { return; }
        dateStr = String(dateStr).substr(0, 10);
        if (moment(dateStr).isBefore(moment(), 'day')) { ToastService.warning('Past date', 'Pick today or a later date.'); return; }
        for (var i = 0; i < vm.form.dates.length; i++) { if (vm.form.dates[i].date === dateStr) { return; } }
        if (vm.form.dates.length >= 10) { ToastService.warning('That is plenty', 'Up to 10 dates per request.'); return; }
        vm.form.dates.push({ date: dateStr, preference: 'any' });
        vm.form.dates.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
        vm.nativeDate = '';
    };
    vm.addNativeDate = function () { if (vm.nativeDate) { vm.addDate(moment(vm.nativeDate).format('YYYY-MM-DD')); } };
    vm.removeDate = function (d) { var i = vm.form.dates.indexOf(d); if (i > -1) { vm.form.dates.splice(i, 1); } };
    vm.setPref = function (d, p) { d.preference = p; };
    vm.dateLabel = function (d) { return moment(d).format('ddd D MMM'); };

    // ── submit ──
    vm.submit = function () {
        var f = vm.form;
        if (!f.club_id) { ToastService.warning('Pick a club', 'Which club is this request for?'); return; }
        if (vm.staff && !vm.member) { ToastService.warning('Who is it for?', 'Pick the member this request is for.'); ToastService.highlightField('wrq-member'); return; }
        if (!f.dates.length) { ToastService.warning('Add a date', 'Pick at least one day you could fly.'); ToastService.highlightField('wrq-add-date'); return; }
        if (!f.notice) { ToastService.warning('Notice needed', 'How much notice do you need to get to the airfield?'); return; }
        var body = {
            club_id: parseInt(f.club_id, 10),
            kind: f.kind,
            plane_type: f.plane_type || null,
            plane_id: null,
            instructor_id: (f.kind === 'dual' && f.instructor_id) ? parseInt(f.instructor_id, 10) : null,
            notice: f.notice,
            notes: String(f.notes || '').trim(),
            dates: f.dates.map(function (d) { return { date: d.date, preference: d.preference }; })
        };
        if (vm.staff) { body.user_id = vm.member.user_id; }
        vm.saving = true;
        WaitingRequestsService.Create(body).then(function (data) {
            vm.saving = false;
            if (data && data.success) {
                vm.changed = true;
                if (vm.staff) {
                    // back to the panel, which reloads its list
                    ToastService.success('Added to the waiting list', vm.memberName(vm.member) + ' will get a confirmation email.', { confetti: false });
                    $uibModalInstance.close({ changed: true, request: data.request || null });
                    return;
                }
                ToastService.success('On the waiting list', "We'll call you if a matching slot comes up.", { confetti: false });
                vm.form.dates = []; vm.form.notes = '';
                vm.showMine();
            } else {
                ToastService.error('Not saved', textOf(data && data.message) || 'The request could not be saved.');
            }
        });
    };

    // ── my requests ──
    vm.showMine = function () { vm.tab = 'mine'; loadMine(); };
    vm.showNew = function () { vm.tab = 'new'; };
    function loadMine() {
        var clubs = vm.clubs.length ? vm.clubs : (vm.form.club_id ? [{ id: vm.form.club_id }] : []);
        vm.loadingMine = true;
        vm.mine = [];
        var pending = clubs.length;
        if (!pending) { vm.loadingMine = false; return; }
        angular.forEach(clubs, function (c) {
            WaitingRequestsService.List({ club_id: c.id, status: 'live' }).then(function (data) {
                if (data && data.success) { vm.mine = vm.mine.concat(data.requests || []); }
                if (--pending === 0) {
                    vm.loadingMine = false;
                    vm.mine.sort(function (a, b) { return String(a.first_date) < String(b.first_date) ? -1 : 1; });
                }
            });
        });
    }
    vm.cancelRequest = function (r) {
        r._busy = true;
        WaitingRequestsService.Update(r.id, { status: 'cancelled' }).then(function (data) {
            r._busy = false;
            if (data && data.success) {
                vm.changed = true;
                ToastService.success('Request cancelled', 'You are off the waiting list for those dates.', { confetti: false });
                loadMine();
            } else {
                ToastService.error('Not cancelled', textOf(data && data.message) || 'The request could not be cancelled.');
            }
        });
    };

    vm.close = function () { if (vm.changed) { $uibModalInstance.close({ changed: true }); } else { $uibModalInstance.dismiss('cancel'); } };
    $scope.$on('$destroy', function () { if (attached) { try { attached.destroy(); } catch (e) {} attached = null; } });

    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }
}

// ═══════════════════════════════════════════════════════════════════════
// Staff: waiting requests panel — a FIRST-COME-FIRST-SERVED queue
//
// Two views (vm.view):
//   'day'      the requests that include vm.day, oldest first, each with THAT
//              day's state (`r.day`) and `queue_position` (#1 = waiting longest).
//              Filter: Waiting · Contacted · Booked · Couldn't take it · All =
//              that day's status (backend `date=` + `status=`).
//   'everyone' every live request of the club (open / contacted on at least one
//              day), oldest first, all day chips shown; click a chip to pick the
//              day the buttons act on (`r._pick`).
// Actions per row act on ONE day (PUT {status, date}): Contacted (stamps who /
// when, the member stays in the queue), Book (closes the panel → the scheduler
// opens the booking form pre-filled from the request; the save PUTs fulfilled),
// Couldn't take it (= declined). A settled day shows its state + Undo (→ open).
// Every PUT updates the row IN PLACE from the response; a row that no longer
// fits the filter slides out — no reload needed.
// Matches for a freed slot render as the top block of the day view, in queue order.
// ═══════════════════════════════════════════════════════════════════════
app.controller('WaitingRequestsPanelController', WaitingRequestsPanelController);
WaitingRequestsPanelController.$inject = ['$scope', '$uibModalInstance', '$uibModal', '$timeout', 'WaitingRequestsService', 'SchedulerV2Service', 'ToastService', 'ctx'];
function WaitingRequestsPanelController($scope, $uibModalInstance, $uibModal, $timeout, WaitingRequestsService, SchedulerV2Service, ToastService, ctx) {
    var vm = this;
    var WRS = WaitingRequestsService;
    vm.ctx = ctx || {};
    vm.clubs = vm.ctx.clubs || [];
    vm.club_id = vm.ctx.club_id || (vm.clubs.length ? parseInt(vm.clubs[0].id, 10) : null);
    vm.today = moment().format('YYYY-MM-DD');
    // the day shown: the slot's day when opened for a freed slot, else the scheduler's current date
    vm.day = (vm.ctx.slot && vm.ctx.slot.start) ? String(SchedulerV2Service.toWallClock(vm.ctx.slot.start)).substr(0, 10)
        : (vm.ctx.date || vm.ctx.from || vm.today);
    vm.view = (vm.ctx.view === 'everyone') ? 'everyone' : 'day';
    vm.status = 'open';             // 'open' | 'contacted' | 'fulfilled' | 'declined' | 'all' — THAT day's status
    vm.filters = [
        { id: 'open',      label: 'Waiting' },
        { id: 'contacted', label: 'Contacted' },
        { id: 'fulfilled', label: 'Booked' },
        { id: 'declined',  label: "Couldn't take it" },
        { id: 'all',       label: 'All' }
    ];
    vm.loading = false;
    vm.requests = [];               // the day view
    vm.everyone = [];               // the "everyone waiting" view
    vm.loadingEveryone = false;
    vm.matches = null;              // when opened for a freed slot
    vm.slot = vm.ctx.slot || null;
    vm.changed = false;
    vm.pickerOptions = { allowPast: true, dots: false, shortcuts: true };
    vm.bookingIds = vm.ctx.bookingIds || {};   // {id: true} — the bookings on the scheduler's current day (a Booked pill links to those)
    vm.labelOf = { kind: WRS.kindLabel, notice: WRS.noticeLabel, pref: WRS.preferenceLabel,
        status: WRS.statusLabel, tone: WRS.statusTone, dateTone: WRS.dateTone, dateStatus: WRS.dateLabel };
    vm.fmtShort = SchedulerV2Service.fmtShortDate;
    vm.fmtRange = SchedulerV2Service.fmtRange;
    vm.addedAgo = function (r) { return WRS.addedAgo(r && r.created_at); };

    vm.telHref = function (p) { return p ? 'tel:' + String(p).replace(/[^+\d]/g, '') : ''; };
    vm.mailHref = function (e) { return e ? 'mailto:' + e : ''; };
    vm.dateLabel = function (d) { return moment(d).format('ddd D MMM'); };
    vm.dayTitle = function () {
        var m = moment(vm.day);
        if (vm.day === vm.today) { return 'Today · ' + m.format('ddd D MMM'); }
        if (m.isSame(moment().add(1, 'day'), 'day')) { return 'Tomorrow · ' + m.format('ddd D MMM'); }
        return m.format('dddd D MMMM');
    };
    vm.isToday = function () { return vm.day === vm.today; };
    vm.isPast = function () { return vm.day < vm.today; };
    vm.isLive = function (r) { return r && r.status !== 'cancelled' && r.status !== 'expired'; };
    vm.isDay = function (d) { return d && String(d.date).substr(0, 10) === vm.day; };
    vm.firstName = function (name) { return String(name || '').trim().split(/\s+/)[0] || 'The member'; };

    // ── the day a row's buttons act on ──
    // day view: the day shown (backend `day`, else found in dates[]); everyone view: the picked chip (default: the first live day)
    vm.dayOf = function (r) { return (r && r.day && String(r.day.date).substr(0, 10) === vm.day) ? r.day : WRS.dayOf(r, vm.day); };
    vm.rowDay = function (r) {
        if (!r) { return null; }
        if (vm.view === 'everyone' || r._everyone) {
            if (r._pick) { var cur = WRS.dayOf(r, r._pick); if (cur) { return cur; } }
            var live = (r.dates || []).filter(function (d) { return WRS.isLiveStatus(d.status); });
            return live[0] || (r.dates && r.dates[0]) || null;
        }
        return vm.dayOf(r);
    };
    vm.isPicked = function (r, d) { var cur = vm.rowDay(r); return !!(cur && d && String(cur.date).substr(0, 10) === String(d.date).substr(0, 10)); };
    vm.pickDay = function (r, d) { if (r && d) { r._pick = String(d.date).substr(0, 10); } };
    vm.dayStatus = function (r) { var d = vm.rowDay(r); return (d && d.status) || 'open'; };
    vm.isSettled = function (r) { var st = vm.dayStatus(r); return st === 'fulfilled' || st === 'declined'; };
    vm.isContacted = function (r) { return vm.dayStatus(r) === 'contacted'; };
    // the day's pill — always a label (never blank): the row's state through the shared copy helpers
    vm.dayPill = function (r) { var d = vm.rowDay(r); return d ? WRS.dateLabel(d) : WRS.dateLabel('open'); };
    vm.dayTone = function (r) { var d = vm.rowDay(r); return d ? WRS.dateTone(d) : 'open'; };
    vm.isElsewhere = function (d) { return !!(d && d.status === 'fulfilled' && parseInt(d.fulfilled_elsewhere, 10) === 1); };
    // "Contacted · 10:32 by Alex"
    vm.stamp = function (d) {
        if (!d || !d.status_at) { return ''; }
        var m = moment(String(d.status_at).replace(' ', 'T'));
        var when = m.isValid() ? (m.isSame(moment(), 'day') ? m.format('HH:mm') : m.format('D MMM HH:mm')) : '';
        var who = d.status_by_user && d.status_by_user.name ? vm.firstName(d.status_by_user.name) : '';
        return (when ? ' · ' + when : '') + (who ? ' by ' + who : '');
    };
    // "Booked · G-BMTJ 09:00" — the booking that satisfied the day (links to the card when it is on the scheduler's day)
    vm.bookedLabel = function (d) {
        if (!d) { return ''; }
        var b = d.booking;
        var base = vm.isElsewhere(d) ? WRS.enums.elsewhereLabel : WRS.dateLabel('fulfilled');
        if (!b) { return base; }
        var t = b.start ? moment(String(b.start).replace(' ', 'T')) : null;
        return base + ' · ' + (b.registration || ('#' + b.id)) + (t && t.isValid() ? ' ' + t.format('HH:mm') : '');
    };
    vm.bookingVisible = function (d) { return !!(d && d.booking && vm.bookingIds[d.booking.id]); };
    vm.openBooking = function (d) {
        if (!vm.bookingVisible(d)) { return; }
        $uibModalInstance.close({ changed: vm.changed, action: 'open_booking', booking_id: d.booking.id });
    };
    vm.otherLive = function (r) {
        var cur = vm.rowDay(r), n = 0;
        angular.forEach((r && r.dates) || [], function (d) { if ((!cur || d.date !== cur.date) && WRS.isLiveStatus(d.status)) { n++; } });
        return n;
    };
    vm.liveDays = WRS.liveDays;

    var loadSeq = 0, everyoneSeq = 0;      // declared BEFORE the first load() — `var` hoists the name, not the value
    load();
    if (vm.slot) { loadMatches(); }
    if (vm.view === 'everyone') { loadEveryone(); }

    function load() {
        if (!vm.club_id || !vm.day) { return; }
        vm.loading = true;
        var seq = ++loadSeq;
        WRS.List({ club_id: vm.club_id, date: vm.day, status: vm.status }).then(function (data) {
            if (seq !== loadSeq) { return; }   // a newer day / filter has been asked for
            vm.loading = false;
            if (data && data.success) { vm.requests = data.requests || []; vm.error = null; }
            else { vm.requests = []; vm.error = (data && data.error === 'FORBIDDEN') ? "You don't have access to this club's waiting list." : (textOf(data && data.message) || 'The waiting list could not be loaded.'); }
        });
    }
    // every live request of the club (open or contacted on at least one day), oldest first
    function loadEveryone() {
        if (!vm.club_id) { return; }
        vm.loadingEveryone = true;
        var seq = ++everyoneSeq;
        WRS.List({ club_id: vm.club_id, status: 'live' }).then(function (data) {
            if (seq !== everyoneSeq) { return; }
            vm.loadingEveryone = false;
            if (data && data.success) {
                vm.everyone = (data.requests || []).map(function (r) { r._everyone = true; return r; });
                vm.errorEveryone = null;
            } else { vm.everyone = []; vm.errorEveryone = (data && data.error === 'FORBIDDEN') ? "You don't have access to this club's waiting list." : (textOf(data && data.message) || 'The waiting list could not be loaded.'); }
        });
    }
    function loadMatches() {
        var s = vm.slot;
        vm.loadingMatches = true;
        WRS.Matches({ club_id: s.club_id || vm.club_id, start: s.start, end: s.end, plane_id: s.plane_id, instructor_id: s.instructor_id || 0 }).then(function (data) {
            vm.loadingMatches = false;
            if (data && data.success) {
                vm.matches = data.matches || [];
                vm.slotSummary = data.slot_summary || null;
                // a match acts on the matched day (backend `day`; fallback: the first matched date / the slot's day)
                angular.forEach(vm.matches, function (r) { if (!r.day) { r.day = (r.matched_dates && r.matched_dates[0]) || WRS.dayOf(r, vm.slotSummary && vm.slotSummary.date) || null; } });
                // first come first served, like everything else in the panel (the score stays as a chip)
                vm.matches.sort(function (a, b) { var c = String(a.created_at || '').localeCompare(String(b.created_at || '')); return c !== 0 ? c : (a.id - b.id); });
            } else { vm.matches = []; }
        });
    }
    vm.reload = function () { load(); if (vm.view === 'everyone') { loadEveryone(); } if (vm.slot) { loadMatches(); } };
    vm.setStatus = function (s) { if (s === vm.status) { return; } vm.status = s; load(); };
    vm.setView = function (v) {
        if (v === vm.view) { return; }
        vm.view = v;
        if (v === 'everyone') { loadEveryone(); }
    };
    vm.setClub = function () { load(); if (vm.view === 'everyone' || vm.everyone.length) { loadEveryone(); } if (vm.slot) { loadMatches(); } };
    vm.setDay = function (d) { if (d && d !== vm.day) { vm.day = String(d).substr(0, 10); } };
    vm.prevDay = function () { vm.setDay(moment(vm.day).subtract(1, 'day').format('YYYY-MM-DD')); };
    vm.nextDay = function () { vm.setDay(moment(vm.day).add(1, 'day').format('YYYY-MM-DD')); };
    vm.goToday = function () { vm.setDay(vm.today); };
    // jump the day view to a chip's day (from the everyone view)
    vm.showDay = function (d) { if (!d) { return; } vm.view = 'day'; vm.status = 'all'; vm.setDay(String(d.date).substr(0, 10)); if (vm.day === String(d.date).substr(0, 10)) { load(); } };
    $scope.$watch('vm.day', function (n, o) { if (n !== o) { load(); } });
    vm.clearSlot = function () { vm.slot = null; vm.matches = null; };
    vm.filterLabel = function () { for (var i = 0; i < vm.filters.length; i++) { if (vm.filters[i].id === vm.status) { return vm.filters[i].label; } } return ''; };
    vm.countLine = function () {
        var n = vm.requests.length, what = (vm.status === 'all') ? 'request' : vm.filterLabel().toLowerCase();
        if (vm.status === 'open') { return n + ' waiting for this day'; }
        if (vm.status === 'all') { return n + ' request' + (n === 1 ? '' : 's') + ' include this day'; }
        return n + ' ' + what + ' for this day';
    };
    vm.emptyLine = function () {
        var day = vm.dateLabel(vm.day);
        return { open: 'Nobody is waiting for ' + day + '.', contacted: 'Nobody has been contacted about ' + day + ' yet.',
            fulfilled: 'Nobody has been booked from the list for ' + day + '.', declined: "Nobody said they couldn't take " + day + '.',
            all: 'No requests include ' + day + '.' }[vm.status] || 'Nothing here.';
    };

    // Add a request on a member's behalf (instructor / admin) — the member form in staff mode, stacked over the panel
    vm.addRequest = function () {
        $uibModal.open({
            templateUrl: 'views/modals/waiting_request_form.html',
            controller: 'WaitingRequestFormController',
            controllerAs: 'vm',
            windowClass: 'sv2-modal-window sv2-stacked-window',
            resolve: { ctx: function () { return {
                staff: true, userId: vm.ctx.userId, clubs: vm.clubs, club_id: vm.club_id,
                fleet: vm.ctx.fleet || [], instructors: vm.ctx.instructors || [], date: vm.day || vm.ctx.date
            }; } }
        }).result.then(function (res) {
            if (!res || !res.changed) { return; }
            vm.changed = true;
            if (vm.status !== 'open' && vm.status !== 'all') { vm.status = 'open'; }
            // Show what was just added: jump the panel to the first of the new request's days
            // (the $watch on vm.day reloads; same day → reload here).
            var r = res.request, first = (r && r.dates && r.dates.length) ? String(r.dates[0].date).substr(0, 10) : null;
            vm.view = 'day';
            if (first && first !== vm.day) { vm.day = first; } else { load(); }
            if (vm.everyone.length) { loadEveryone(); }
            if (vm.slot) { loadMatches(); }
        }, function () {});
    };

    // ── in-place update ──
    // Replace the row from the PUT response (dates / day / status / counts), keep the row's transient state,
    // then let it leave the list if it no longer fits (the filter, or — everyone view — no live day left).
    function apply(r, fresh, date) {
        if (!fresh) { return; }
        var keep = { _pick: r._pick, _everyone: r._everyone, _busy: false };
        angular.extend(r, fresh, keep);
        r.day = WRS.dayOf(r, date) || r.day || null;
        // the same request may sit in the other view's list too — keep both in step
        angular.forEach([vm.requests, vm.everyone, vm.matches || []], function (list) {
            angular.forEach(list, function (x) { if (x !== r && x && x.id === r.id) { angular.extend(x, fresh, { _pick: x._pick, _everyone: x._everyone, _busy: false }); x.day = WRS.dayOf(x, x._everyone ? (x._pick || date) : vm.day) || x.day || null; } });
        });
    }
    function fits(r, list) {
        if (list === vm.everyone) { return vm.isLive(r) && WRS.liveDays(r) > 0; }
        if (list === vm.matches) { var d = r.day; return !!(d && WRS.isLiveStatus(d.status)); }
        if (vm.status === 'all') { return true; }
        return vm.isLive(r) && vm.dayStatus(r) === vm.status;
    }
    function settle(r) {
        angular.forEach([vm.requests, vm.everyone, vm.matches || []], function (list) {
            angular.forEach(list.slice(), function (x) {
                if (x.id !== r.id || fits(x, list)) { return; }
                x._out = true;                                   // .wrp__req--out slides it away
                $timeout(function () { var i = list.indexOf(x); if (i > -1) { list.splice(i, 1); } x._out = false; }, 320);
            });
        });
    }

    // Mark contacted / couldn't take it (declined) / back to waiting (open) — on the row's day (a match: its matched day)
    vm.mark = function (r, status, dayRow) {
        var d = dayRow || vm.rowDay(r);
        var date = d ? String(d.date).substr(0, 10) : vm.day;
        var who = (r.user && r.user.name) || 'The member';
        r._busy = true;
        WRS.Update(r.id, { status: status, date: date }).then(function (data) {
            r._busy = false;
            if (!(data && data.success)) { ToastService.error('Not updated', textOf(data && data.message) || 'The request could not be updated.'); return; }
            vm.changed = true;
            apply(r, data.request, date);
            var others = vm.otherLive(r), when = moment(date).format('ddd D MMM');
            var tail = others > 0 ? ' Still waiting on ' + others + ' other day' + (others === 1 ? '' : 's') + '.' : '';
            if (status === 'contacted') { ToastService.success('Contacted', vm.firstName(who) + ' knows about ' + when + ' — still in the queue.', { confetti: false }); }
            else if (status === 'declined') { ToastService.success("Couldn't take it", who + ' · ' + when + '.' + (tail || (r.status === 'declined' ? ' No days left — the request is closed.' : '')), { confetti: false }); }
            else if (status === 'open') { ToastService.success('Back in the queue', who + ' is waiting again for ' + when + '.', { confetti: false }); }
            else { ToastService.success(WRS.statusLabel(status), who + ' · ' + when + ' is now ' + WRS.statusLabel(status).toLowerCase() + '.' + tail, { confetti: false }); }
            settle(r);
        });
    };
    vm.undo = function (r, dayRow) { vm.mark(r, 'open', dayRow); };
    vm.decline = function (r, dayRow) { vm.mark(r, 'declined', dayRow); };
    vm.contact = function (r, dayRow) { vm.mark(r, 'contacted', dayRow); };
    // Book: the scheduler opens the booking form pre-filled from this request for that day; the save marks it Booked
    vm.book = function (r, dayRow) {
        var d = dayRow || vm.rowDay(r);
        var date = d ? String(d.date).substr(0, 10) : vm.day;
        $uibModalInstance.close({ changed: vm.changed, action: 'book', request: r, date: date, day: d || null });
    };

    vm.close = function () { if (vm.changed) { $uibModalInstance.close({ changed: true }); } else { $uibModalInstance.dismiss('cancel'); } };

    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }
}

// ═══════════════════════════════════════════════════════════════════════
// Cancellations (staff) — views/modals/cancellations_panel.html
// Recent cancellations for one club with the fee decision on each: charge the club's fee for the
// reason (an invoice for the pilot), waive it, or — admins — reverse a charge that hasn't been
// collected yet. Contract: CancellationFeesService (backend models/cancellation_fees.model.php).
// ═══════════════════════════════════════════════════════════════════════
app.controller('CancellationsPanelController', CancellationsPanelController);
CancellationsPanelController.$inject = ['$uibModalInstance', 'CancellationFeesService', 'ToastService', 'ctx'];
function CancellationsPanelController($uibModalInstance, CancellationFeesService, ToastService, ctx) {
    var vm = this;
    ctx = ctx || {};
    vm.clubs = (ctx.clubs || []).map(function (c) { return { id: parseInt(c.id, 10), title: String(c.title || '').trim() }; });
    vm.club_id = parseInt(ctx.club_id, 10) || (vm.clubs.length ? vm.clubs[0].id : 0);
    vm.status = 'due';
    vm.range = '30';
    vm.ranges = [{ id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' }, { id: '365', label: 'Last 12 months' }];
    vm.tabs = [{ id: 'due', label: 'Fees to decide' }, { id: 'claimed', label: 'Charged' }, { id: 'waived', label: 'Waived' }, { id: 'all', label: 'All cancellations' }];
    vm.rows = [];
    vm.loading = true;
    vm.error = null;
    vm.anyFees = true;
    vm.confirmReverse = null;     // row id awaiting the second "Reverse" press

    vm.money = function (n) { return CancellationFeesService.money(n, vm.currency); };
    vm.statusLabel = CancellationFeesService.statusLabel;
    vm.tone = function (r) {
        var s = r.fee && r.fee.status;
        if (s === 'claimed') { return 'claimed'; }
        if (s === 'waived' || s === 'reversed') { return 'quiet'; }
        return (r.fee && r.fee.due > 0) ? 'due' : 'none';
    };
    vm.when = function (r) {
        var s = moment(r.start, 'YYYY-MM-DD HH:mm:ss'), e = moment(r.end, 'YYYY-MM-DD HH:mm:ss');
        return s.isValid() ? s.format('ddd D MMM') + ' · ' + s.format('HH:mm') + (e.isValid() ? '–' + e.format('HH:mm') : '') : '';
    };
    vm.cancelledText = function (r) {
        var m = moment(r.cancelled_at, 'YYYY-MM-DD HH:mm:ss');
        var who = (r.cancelled_by && r.cancelled_by.name) ? ' by ' + r.cancelled_by.name : '';
        return 'Cancelled ' + (m.isValid() ? m.format('D MMM HH:mm') : '') + who;
    };
    vm.feeText = function (r) {
        var f = r.fee || {};
        if (f.status === 'claimed') {
            var how = f.invoice && f.invoice.status === 'direct_debit' ? 'by direct debit' : (f.invoice && f.invoice.status === 'paid' ? 'paid' : 'on account');
            return vm.money(f.amount) + ' charged' + (f.invoice ? ' · ' + f.invoice.number + ' · ' + how : '') + (f.by ? ' · ' + f.by : '');
        }
        if (f.status === 'waived') { return 'Waived' + (f.by ? ' by ' + f.by : ''); }
        if (f.status === 'reversed') { return 'Charge reversed' + (f.by ? ' by ' + f.by : '') + (f.invoice ? ' · ' + f.invoice.number + ' voided' : ''); }
        if (f.due > 0) { return 'The club\'s fee for this reason is ' + vm.money(f.due); }
        return 'No fee for this reason';
    };

    vm.setStatus = function (s) { if (vm.status !== s) { vm.status = s; load(); } };
    vm.reload = load;
    vm.close = function () { $uibModalInstance.dismiss('close'); };

    vm.claim = function (r) {
        vm.confirmReverse = null;
        return CancellationFeesService.Claim(r.id).then(function (res) {
            if (res && res.success) {
                ToastService.success('Fee charged', (r.pilot.name ? r.pilot.name + ': ' : '') + CancellationFeesService.outcomeText(res, vm.currency), { confetti: false });
                load();
            } else {
                ToastService.error('Fee not charged', textOf(res && res.message) || 'The fee could not be charged.');
            }
        });
    };
    vm.waive = function (r) {
        vm.confirmReverse = null;
        return CancellationFeesService.Waive(r.id).then(function (res) {
            if (res && res.success) { ToastService.success('Fee waived', 'No fee for ' + (r.pilot.name || 'this cancellation') + '.', { confetti: false }); load(); }
            else { ToastService.error('Not waived', textOf(res && res.message) || 'The fee could not be waived.'); }
        });
    };
    vm.reverse = function (r) {
        if (vm.confirmReverse !== r.id) { vm.confirmReverse = r.id; return; }
        vm.confirmReverse = null;
        return CancellationFeesService.Reverse(r.id).then(function (res) {
            if (res && res.success) { ToastService.success('Charge reversed', 'Invoice ' + ((r.fee.invoice && r.fee.invoice.number) || '') + ' has been voided.', { confetti: false }); load(); }
            else { ToastService.error('Not reversed', textOf(res && res.message) || 'The charge could not be reversed.'); }
        });
    };

    function load() {
        if (!vm.club_id) { vm.loading = false; vm.error = 'Pick a club.'; return; }
        vm.loading = true;
        vm.error = null;
        var from = moment().subtract(parseInt(vm.range, 10) || 30, 'days').format('YYYY-MM-DD');
        var to = moment().format('YYYY-MM-DD');
        CancellationFeesService.Policy(vm.club_id).then(function (p) {
            vm.anyFees = !!(p && p.success && (p.reasons || []).some(function (r) { return parseFloat(r.fee) > 0; }));
        });
        CancellationFeesService.List({ club_id: vm.club_id, from: from, to: to, status: vm.status }).then(function (data) {
            vm.loading = false;
            if (!data || !data.success) {
                vm.rows = [];
                vm.error = (data && data.error === 'FORBIDDEN') ? 'Only club staff can see cancellations for this club.' : (textOf(data && data.message) || 'The cancellations could not be loaded.');
                return;
            }
            vm.currency = data.currency;
            vm.canClaim = !!data.can_claim;
            vm.isAdmin = !!data.is_admin;
            vm.rows = data.cancellations || [];
        });
    }
    vm.changeClub = function () { vm.confirmReverse = null; load(); };
    vm.changeRange = function () { vm.confirmReverse = null; load(); };
    load();

    function textOf(m) { if (!m) { return ''; } if (typeof m === 'string') { return m; } return m.message || m.error || ''; }
}
