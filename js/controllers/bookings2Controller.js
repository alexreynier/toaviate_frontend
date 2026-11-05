 app.controller('Bookings2Controller', Bookings2Controller);

    Bookings2Controller.$inject = ['UserService', 'BookoutService',  'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'InstructorCharges', 'CourseService', 'ToastService', '$interval', 'StudentSnapshotService', 'SchedulerV2Service', 'WaitingRequestsService', 'CancellationFeesService'];
    function Bookings2Controller(UserService, BookoutService,  MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, InstructorCharges, CourseService, ToastService, $interval, StudentSnapshotService, SchedulerV2Service, WaitingRequestsService, CancellationFeesService) {
        
        var vm = this;
        var defaultStartTime = 480;
        var defaultEndTime = 1080;

        $scope.va1 = '123';
        
        //alert("boo");
        vm.user = $rootScope.globals.currentUser;

        vm.allUsers = [];
        vm.club = {};
        vm.page_title = "";
        vm.club.member = {};
        
        vm.imported_new_headers = [];
        vm.see_booking = {};

        vm.is_current = false;
        vm.currency_type = "";
        vm.currency_days = "";

        vm.booking_self = true;

        vm.times_clean_type = "start_times";

        $scope.club_timezone = "Europe/London";
        vm.club_timezone = "Europe/London";

        vm.is_edit_show_all = false;
        // vm.club.member.membership_id = {};

        // ── Schedule auto-refresh polling (mirrors TV schedule display) ──
        var _scheduleVersion = -1;        // current known schedule version
        var _pollTimer = null;            // $interval handle
        var _pollIntervalMs = 30000;      // 30 seconds between version checks
        var _lastViewStart = null;        // calendar view range for refresh
        var _lastViewEnd = null;
        vm.action = $state.current.data.action;
        vm.return_to = $state.current.data.return_to;
        //vm.club_id = 0;

        // ── Scheduler v2 booking panel (CLAUDE.md "Scheduler v2 booking panel") ──
        // The dashboard.scheduler_v2.add / .edit states (data.v2) run this same
        // controller as a slide-out over the scheduler: there is no embedded
        // FullCalendar (every $('#calendar') call below is a no-op on an empty set),
        // the slot is pre-selected from the URL params, and every exit goes back to
        // the parent state with an 'sv2:refresh' broadcast carrying the booking's date.
        vm.is_v2 = !!($state.current.data && $state.current.data.v2);
        vm.preselect_plane_id = (vm.is_v2 && $stateParams.plane_id) ? parseInt($stateParams.plane_id, 10) : 0;
        // "Book" from the waiting-list panel (?request_id&request_date): the form pre-fills from that request and
        // the save PUTs its day fulfilled (CLAUDE.md "Scheduler v2" → Waiting list → Book). Loaded in the v2 init block.
        vm.bkf_wrq = null;                    // { request, date, still_wants, name, pref_label, others }
        vm.bkf_wrq_loading = false;
        vm.bkf_wrq_type = '';                 // the request's aircraft type → that type's aircraft first, the first free one pre-selected
        vm.bkf_wrq_plane_id = 0;
        var bkf_wrq_plane_done = false;

        // <ta-date-picker> holds a YYYY-MM-DD string; the form logic keeps Dates in
        // vm.new_booking.start_date / end_date — bridge both ways in LOCAL time
        // (wall-clock club time, never toISOString()).
        vm.bkf = { start_date: '', end_date: '' };
        vm.bkf_picker_options = { allowPast: (vm.action == 'edit'), weekStart: 1, dots: false };
        // The TO date follows the FROM date until the user picks a TO date of their own
        // (a multi-day booking); it never follows backwards past a deliberate choice, and it
        // can never end before it starts (update_dateTime's own rule).
        vm.bkf_end_explicit = false;
        var bkf_dates_seen = false;
        vm.bkf_date_picked = function(which){
            var str = vm.bkf[which + '_date'];
            if(!str){ return; }
            vm.new_booking[which + '_date'] = moment(str, 'YYYY-MM-DD').toDate();
            if(which === 'start' && !vm.bkf_end_explicit){
                vm.new_booking.end_date = moment(str, 'YYYY-MM-DD').toDate();
            }
            if(which === 'end'){
                vm.bkf_end_explicit = !!(vm.bkf.start_date && str !== vm.bkf.start_date);
            }
            $scope.update_dateTime(which + '_date');
        };
        // Soft note when the slot is outside the club's OPENING HOURS (settings.clubs[].opening_hours of
        // the last day response, cached as SchedulerV2Service.lastSettings — the club is the chosen
        // aircraft's, else an edited booking's, else the v2 club filter's), judged per weekday of the FROM
        // date (start) and the TO date (end). A club with no hours configured falls back to the hours the
        // scheduler shows (settings.day_start / day_end — the defaults widened by the club's booking slots).
        // Never blocks: the backend has no opening-hours rule either.
        function bkf_hhmm_to_min(t){ if(!t){ return null; } var p = String(t).split(':'); var h = parseInt(p[0], 10), m = parseInt(p[1] || '0', 10); return (isNaN(h) || isNaN(m)) ? null : h * 60 + m; }
        // display only: v1 keeps "6:00" strings in the time lists; the panel shows "06:00"
        vm.bkf_pad_time = function(t){ if(!t){ return ''; } var p = String(t).split(':'); return (p[0].length < 2 ? '0' + p[0] : p[0]) + ':' + (p[1] || '00'); };
        // the club whose hours the panel judges: the chosen aircraft's → an edited booking's → the v2 club filter's
        vm.bkf_hours_club = function(){
            var nb = vm.new_booking || {};
            return parseInt((nb.plane && nb.plane.club_id) || nb.club_id || vm.bkf_club_filter || vm.bkf_club || 0, 10) || 0;
        };
        var BKF_STILL_BOOK = ' You can still book — just check with the club.';
        function bkf_dayname(d){ return moment(d).format('dddd') + 's'; }
        vm.bkf_hours_note = function(){
            var st = SchedulerV2Service.lastSettings;
            if(!vm.is_v2 || !st || !st.day_start || !st.day_end || !vm.new_booking){ return ''; }
            var a = vm.new_booking.start_time ? bkf_hhmm_to_min(vm.new_booking.start_time.time) : null;
            var b = vm.new_booking.end_time ? bkf_hhmm_to_min(vm.new_booking.end_time.time) : null;
            // ── club opening hours (per weekday) ──
            var hours = SchedulerV2Service.openingHoursFor(vm.bkf_hours_club());
            if(hours){
                var sd = vm.new_booking.start_date, ed = vm.new_booking.end_date || sd;
                if(!sd){ return ''; }
                var hs = SchedulerV2Service.openingHoursOn(hours, sd), he = SchedulerV2Service.openingHoursOn(hours, ed);
                var sameDay = moment(sd).isSame(moment(ed), 'day');
                var parts = [];
                if(hs.state === 'closed'){ parts.push('The club is closed on ' + bkf_dayname(sd) + '.'); }
                if(he.state === 'closed' && !(sameDay && hs.state === 'closed')){ parts.push('The club is closed on ' + bkf_dayname(ed) + '.'); }
                var opensLate = hs.state === 'open' && a !== null && a < hs.openMin;      // starts before the club opens
                var closesEarly = he.state === 'open' && b !== null && b > he.closeMin;   // ends after it closes
                if(opensLate && closesEarly && sameDay){ parts.push('Starts before the club opens on ' + bkf_dayname(sd) + ' (' + hs.open + ') and ends after it closes (' + he.close + ').'); }
                else {
                    if(opensLate){ parts.push('Starts before the club opens on ' + bkf_dayname(sd) + ' (' + hs.open + ').'); }
                    if(closesEarly){ parts.push('Ends after the club closes on ' + bkf_dayname(ed) + ' (' + he.close + ').'); }
                }
                return parts.length ? parts.join(' ') + BKF_STILL_BOOK : '';
            }
            // ── fallback: the hours the scheduler shows ──
            var ds = bkf_hhmm_to_min(st.day_start), de = bkf_hhmm_to_min(st.day_end);
            var early = (a !== null && a < ds), late = (b !== null && b > de);
            if(!early && !late){ return ''; }
            var hours = String(st.day_start).slice(0, 5) + '–' + String(st.day_end).slice(0, 5);
            return (early && late ? 'Starts before and ends after' : (early ? 'Starts before' : 'Ends after')) + ' the hours the scheduler shows for the club (' + hours + '). You can still book — just check the club will be open.';
        };
        $scope.$watch(function(){
            var s = vm.new_booking ? vm.new_booking.start_date : null;
            var e = vm.new_booking ? vm.new_booking.end_date : null;
            return (s ? moment(s).format('YYYY-MM-DD') : '') + '|' + (e ? moment(e).format('YYYY-MM-DD') : '');
        }, function(v){
            var p = v.split('|');
            vm.bkf.start_date = p[0];
            vm.bkf.end_date = p[1];
            // an edited booking that already spans days keeps its own TO date
            if(!bkf_dates_seen && p[0] && p[1] && (vm.action !== 'edit' || (vm.new_booking && vm.new_booking.id))){ bkf_dates_seen = true; if(p[0] !== p[1]){ vm.bkf_end_explicit = true; } }
        });

        // Back to the scheduler behind the panel. Contract: broadcast
        // 'sv2:refresh' { date: 'YYYY-MM-DD', changed: bool, booking_id } — the
        // booking's date (falls back to ?date, then today) — then return to the
        // parent state keeping its ?date&days.
        vm.v2_close = function(changed, when){
            var d = when ? moment(when) : null;
            if(!(d && d.isValid()) && vm.new_booking && vm.new_booking.start_date){ d = moment(vm.new_booking.start_date); }
            var date = (d && d.isValid()) ? d.format('YYYY-MM-DD') : ($stateParams.date || moment().format('YYYY-MM-DD'));
            $rootScope.$broadcast('sv2:refresh', { date: date, changed: !!changed, booking_id: (vm.new_booking && vm.new_booking.id) ? vm.new_booking.id : null });
            $state.go('dashboard.scheduler_v2', {}, { inherit: true });
        };
        vm.go_back = function(){
            if(vm.is_v2){ vm.v2_close(false); }
        };

        // ── Lesson picker (v2 panel only) — bookings.lesson_id, "which lesson will be flown" ──
        // Shown once the booking has a course AND a student (the Member, or the user when
        // booking for themselves). The list is the course's lessons (lessons/course/{id}),
        // pre-selected with the backend's suggested next lesson for that student
        // (bookings/next_lesson/{user_id}/{course_id} — the briefing / debrief rule). An
        // edit's saved lesson (lesson_id on the edit shape) wins over the suggestion.
        vm.bkf_lessons = [];
        vm.bkf_lesson_loading = false;
        vm.bkf_lesson_suggested_id = 0;
        var bkf_lesson_seq = 0;
        vm.bkf_student_id = function(){
            if(!vm.new_booking){ return 0; }
            if(vm.booking_self){ return parseInt(vm.user.id, 10) || 0; }
            var u = vm.new_booking.user;
            return (u && typeof u === 'object') ? (parseInt(u.user_id || u.id, 10) || 0) : 0;
        };
        vm.bkf_lesson_visible = function(){
            return !!(vm.is_v2 && vm.new_booking && vm.new_booking.tuition_required && vm.new_booking.tuition_required.id > 0 && vm.bkf_student_id() > 0);
        };
        // Same wording as the debrief page: "Lesson N: Title" (N = organise + 1)
        vm.bkf_lesson_label = function(lesson){
            if(!lesson || !lesson.id){ return ''; }
            var n = (lesson.organise === null || lesson.organise === undefined || lesson.organise === '') ? null : (parseInt(lesson.organise, 10) + 1);
            return (n ? 'Lesson ' + n + ': ' : '') + lesson.title;
        };
        vm.bkf_lesson_is_suggested = function(){
            return !!(vm.bkf_lesson_suggested_id && vm.new_booking && vm.new_booking.lesson && parseInt(vm.new_booking.lesson.id, 10) === vm.bkf_lesson_suggested_id);
        };
        function bkf_find_lesson(id){
            id = parseInt(id, 10);
            if(!(id > 0)){ return null; }
            return vm.bkf_lessons.find(function(l){ return parseInt(l.id, 10) === id; }) || null;
        }
        function bkf_sync_lesson(){
            if(!vm.is_v2){ return; }
            var course_id = (vm.new_booking && vm.new_booking.tuition_required) ? parseInt(vm.new_booking.tuition_required.id, 10) : 0;
            var student_id = vm.bkf_student_id();
            var seq = ++bkf_lesson_seq;
            vm.bkf_lesson_suggested_id = 0;
            if(!(course_id > 0) || !(student_id > 0)){
                vm.bkf_lessons = [];
                vm.bkf_lesson_loading = false;
                if(vm.new_booking){ vm.new_booking.lesson = undefined; }
                return;
            }
            vm.bkf_lesson_loading = true;
            CourseService.GetLessonsByCourseId(course_id).then(function(data){
                if(seq !== bkf_lesson_seq){ return; }
                vm.bkf_lessons = (data && data.items) ? data.items : [];
                var saved = bkf_find_lesson((vm.new_booking.lesson && vm.new_booking.lesson.id) ? vm.new_booking.lesson.id : vm.new_booking.lesson_id);
                if(saved){
                    vm.new_booking.lesson = saved;
                    vm.bkf_lesson_loading = false;
                    return;
                }
                BookingService.GetNextLesson(student_id, course_id).then(function(res){
                    if(seq !== bkf_lesson_seq){ return; }
                    vm.bkf_lesson_loading = false;
                    var sug = (res && res.success && res.lesson) ? bkf_find_lesson(res.lesson.id) : null;
                    vm.new_booking.lesson = sug || undefined;
                    vm.bkf_lesson_suggested_id = sug ? parseInt(sug.id, 10) : 0;
                });
            });
        }
        if(vm.is_v2){
            $scope.$watch(function(){
                var t = (vm.new_booking && vm.new_booking.tuition_required) ? vm.new_booking.tuition_required.id : 0;
                return (t || 0) + '|' + vm.bkf_student_id();
            }, function(nv, ov){
                if(nv !== ov && vm.new_booking){
                    var n = nv.split('|'), o = ov.split('|');
                    if(o[0] !== '0' && n[0] !== o[0]){
                        // Another course: the lesson cannot belong to it — drop pick + saved id.
                        // (The edit's async course fill goes 0 → id and keeps lesson_id.)
                        vm.new_booking.lesson = undefined;
                        vm.new_booking.lesson_id = undefined;
                    } else if(n[1] !== o[1] && vm.bkf_lesson_is_suggested()){
                        // Another student: a SUGGESTED pick was theirs — re-suggest. A saved
                        // or hand-picked lesson stays (the edit's self → member fill lands here).
                        vm.new_booking.lesson = undefined;
                    }
                }
                bkf_sync_lesson();
            });
        }

        // bookings.lesson_id on the create / update payload. v2 panel: the picked lesson
        // (null clears it; a hidden field keeps the saved value while the course stays).
        // v1 pages: the key is never sent — the backend leaves the column alone.
        function bkf_lesson_payload(booking){
            delete booking.lesson;
            if(!vm.is_v2){
                delete booking.lesson_id;
                return;
            }
            var has_course = !!(vm.new_booking.tuition_required && vm.new_booking.tuition_required.id > 0);
            var keep = (has_course && parseInt(vm.new_booking.lesson_id, 10) > 0) ? parseInt(vm.new_booking.lesson_id, 10) : null;
            if(vm.bkf_lesson_visible()){
                booking.lesson_id = (vm.new_booking.lesson && parseInt(vm.new_booking.lesson.id, 10) > 0) ? parseInt(vm.new_booking.lesson.id, 10) : null;
            } else {
                booking.lesson_id = keep;
            }
        }

        // ── Potential solo (v2 panel, CLUB STAFF only) — bookings.solo ──
        // Prefilled from the chosen lesson (lessons.solo): a solo lesson turns it on, a non-solo
        // lesson (or clearing the lesson) turns it off — until the staff member touches the toggle;
        // from then on that explicit choice stays whatever the lesson does. An edit shows the saved
        // value and treats it as explicit. Members never see the toggle and the key is never sent
        // for them (the backend ignores it from anyone but club staff). Solo colour on the
        // scheduler (SchedulerV2::kind); the book-out pre-sets the student-solo intent from it.
        vm.bkf_solo_explicit = false;
        vm.bkf_is_staff = function(){
            var club = parseInt(vm.club_id || (vm.new_booking && vm.new_booking.plane && vm.new_booking.plane.club_id) || 0, 10);
            if(!(club > 0) || !vm.user || !vm.user.access){ return false; }
            var a = vm.user.access;
            return [a.instructor, a.manager, a.super_admin].some(function(list){ return angular.isArray(list) && list.indexOf(club) > -1; });
        };
        vm.bkf_solo_visible = function(){
            return !!(vm.is_v2 && vm.new_booking && !vm.new_booking.maintenance_flight && vm.bkf_is_staff());
        };
        vm.bkf_solo_on = function(){ return !!(vm.new_booking && parseInt(vm.new_booking.solo, 10) === 1); };
        vm.bkf_solo_from_lesson = function(){
            return !!(vm.new_booking && vm.new_booking.lesson && parseInt(vm.new_booking.lesson.solo, 10) === 1);
        };
        vm.bkf_solo_touched = function(){ vm.bkf_solo_explicit = true; };
        if(vm.is_v2){
            $scope.$watch(function(){
                return (vm.new_booking && vm.new_booking.lesson && vm.new_booking.lesson.id) ? parseInt(vm.new_booking.lesson.id, 10) : 0;
            }, function(nv, ov){
                if(nv === ov || !vm.new_booking || vm.bkf_solo_explicit){ return; }
                vm.new_booking.solo = vm.bkf_solo_from_lesson() ? 1 : 0;
            });
        }
        // bookings.solo on the create / update payload: v2 panel + staff → 0|1; otherwise the key
        // is never sent (absent = leave alone, so v1 and member saves are unaffected).
        function bkf_solo_payload(booking){
            if(!vm.is_v2 || !vm.bkf_is_staff()){ delete booking.solo; return; }
            booking.solo = vm.bkf_solo_on() ? 1 : 0;
        }

        // ── "Booking for" — Myself / Another member (v2 panel only) ──
        // vm.booking_self stays the single source of truth (members load, instructor list
        // show_all, payload user_id all read it). Staff of ANY club get the choice from the
        // moment the panel opens (v1 only showed its checkbox once an aircraft was in), with
        // v1's default for staff — "for someone else". Once the user has chosen explicitly the
        // aircraft-driven flips below (bkf_default_self) leave that choice alone; a club where
        // the user is NOT staff always means "myself" (that flip is never blocked).
        vm.bkf_self_explicit = false;
        vm.bkf_club_filter = 0;          // localStorage toaviate_sv2_club (0 = every club)
        vm.bkf_members_club = 0;         // club the current vm.members list belongs to
        var bkf_members_seq = 0;
        vm.bkf_is_staff_at = function(club){
            club = parseInt(club, 10);
            if(!(club > 0) || !vm.user || !vm.user.access){ return false; }
            var a = vm.user.access;
            return [a.instructor, a.manager, a.super_admin].some(function(list){ return angular.isArray(list) && list.indexOf(club) > -1; });
        };
        vm.bkf_can_book_others = function(){
            if(!vm.is_v2 || !vm.user || !vm.user.access){ return false; }
            var a = vm.user.access;
            return [a.instructor, a.manager, a.super_admin].some(function(list){ return angular.isArray(list) && list.length > 0; });
        };
        vm.bkf_show_booking_for = function(){
            return !!(vm.bkf_can_book_others() && vm.show_self_option && !(vm.is_restricted_member && vm.action != 'edit'));
        };
        // "Another member" needs staff rights at the booking's club (the aircraft's once chosen)
        vm.bkf_others_allowed = function(){
            var club = parseInt((vm.new_booking && vm.new_booking.plane && vm.new_booking.plane.club_id) || 0, 10);
            return (club > 0) ? vm.bkf_is_staff_at(club) : vm.bkf_can_book_others();
        };
        vm.bkf_set_self = function(flag){
            flag = !!flag;
            if(!flag && !vm.bkf_others_allowed()){ return; }
            vm.bkf_self_explicit = true;
            vm.booking_self = flag;
            if(!flag){ bkf_load_members(); }
        };
        // An instructor (not a manager) booking for a member becomes the instructor (make_booking)
        // An instructor who is NOT a manager of the club booking for a member IS the instructor on it
        // (make_booking sets instructor_id = self) — Who comes before What, so this no longer waits for an aircraft.
        vm.bkf_auto_instructor = function(){
            if(!vm.is_v2 || vm.booking_self || !vm.new_booking){ return false; }
            var club = vm.bkf_who_club();
            return !!(club > 0 && !vm.bkf_is_manager_at(club) && vm.bkf_is_staff_at(club));
        };
        // Default club for the members list before an aircraft is chosen: the v2 club filter →
        // the selected admin club → the default instructor club → the first staff club.
        function bkf_staff_club(id){ id = parseInt(id, 10); return (id > 0 && vm.bkf_is_staff_at(id)) ? id : 0; }
        vm.bkf_default_club = function(){
            if(vm.new_booking && vm.new_booking.plane && parseInt(vm.new_booking.plane.club_id, 10) > 0){ return parseInt(vm.new_booking.plane.club_id, 10); }
            var a = (vm.user && vm.user.access) || {};
            return bkf_staff_club(vm.bkf_club)
                || bkf_staff_club(vm.bkf_club_filter)
                || bkf_staff_club(vm.user.current_club_admin && vm.user.current_club_admin.id)
                || bkf_staff_club(vm.user.current_club_instructor)
                || (angular.isArray(a.manager) && a.manager.length ? parseInt(a.manager[0], 10) : 0)
                || (angular.isArray(a.instructor) && a.instructor.length ? parseInt(a.instructor[0], 10) : 0)
                || (angular.isArray(a.super_admin) && a.super_admin.length ? parseInt(a.super_admin[0], 10) : 0)
                || 0;
        };
        function bkf_members_end(){
            if(vm.new_booking && vm.new_booking.end_datetime){ return moment(new Date(vm.new_booking.end_datetime)).format("YYYY-MM-DDTHH:mm:ss"); }
            if(vm.new_booking && vm.new_booking.end_date){
                var d = moment(vm.new_booking.end_date);
                if(vm.new_booking.end_time && vm.new_booking.end_time.time){
                    var hm = vm.new_booking.end_time.time.split(':');
                    d.hour(parseInt(hm[0], 10) || 0).minute(parseInt(hm[1], 10) || 0).second(0);
                }
                return d.format("YYYY-MM-DDTHH:mm:ss");
            }
            return moment().add(1, 'day').format("YYYY-MM-DDTHH:mm:ss");
        }
        // Current members of the club the booking is for (members/active_club/{club}/{end}):
        // at open for staff, when "Another member" is picked, and when the aircraft's club changes.
        function bkf_load_members(force){
            if(!vm.is_v2){ return; }
            var club = vm.bkf_default_club();
            if(!(club > 0)){ return; }
            if(!force && club === vm.bkf_members_club){ return; }
            vm.bkf_members_club = club;
            if(!(parseInt(vm.club_id, 10) > 0)){ vm.club_id = club; }
            bkf_search_members('');
        }
        // members/search/{club}?q= — every CURRENT member (the old active_club list only held members with a paid
        // tier: 35 of 1,912 at club 3). '' = the first 25 alphabetically; the ui-select's refresh= re-queries as you type.
        function bkf_search_members(q){
            var club = vm.bkf_members_club || vm.bkf_default_club();
            if(!(club > 0)){ return; }
            var seq = ++bkf_members_seq;
            MemberService.SearchClubMembers(club, q || '', 25).then(function(data){
                if(seq !== bkf_members_seq){ return; }
                var list = (data && angular.isArray(data.members)) ? data.members : [];
                for(var j = 0; j < list.length; j++){ list[j].is_member = true; }
                vm.bkf_members_more = !!(data && data.more);
                vm.members = list;
            });
        }
        vm.bkf_search_members = function(q){ if(vm.is_v2){ bkf_search_members(q); } };

        // ── Passengers (v2, 2026-11-05) ──────────────────────────────────────────────────────────────
        // The passenger picker has its OWN list (vm.bkf_pax_members — the Member picker keeps vm.members): current
        // members of the booking's club, minus the pilot, the instructor and anyone already on the booking. The
        // typed text is remembered (ui-select single mode never turns free text into a value), so "Invite passenger"
        // with nothing picked opens the form pre-filled: an email → email, "First Last" → names, one word → first name.
        // Chips come from the backend's preview (bookings/passenger_preview) — "Ready to fly" before save means the
        // save will accept them, never a guess from the picker.
        vm.bkf_pax_members = [];
        vm.bkf_pax_search = '';
        vm.bkf_pax_from_text = false;
        vm.bkf_pax_removed = [];
        var bkf_pax_seq = 0, bkf_preview_seq = 0;
        function bkf_lc(v){ return String(v || '').trim().toLowerCase(); }
        function bkf_pilot_id(){
            if(vm.booking_self){ return parseInt(vm.user.id, 10) || 0; }
            var u = vm.new_booking && vm.new_booking.user;
            return u ? (parseInt(u.user_id || u.id, 10) || 0) : 0;
        }
        function bkf_pilot_email(){
            if(vm.booking_self){ return bkf_lc(vm.user.email); }
            return bkf_lc(vm.new_booking && vm.new_booking.user && vm.new_booking.user.email);
        }
        function bkf_instructor_id(){
            var i = vm.new_booking && vm.new_booking.instructor;
            return i ? (parseInt(i.user_id || i.id, 10) || 0) : 0;
        }
        function bkf_pax_excluded(m){
            var uid = parseInt(m.user_id || m.id, 10) || 0, em = bkf_lc(m.email);
            if(uid && (uid === bkf_pilot_id() || uid === bkf_instructor_id())){ return true; }
            if(em && em === bkf_pilot_email()){ return true; }
            return (vm.new_booking.passengers || []).some(function(px){
                return (uid && parseInt(px.user_id, 10) === uid) || (em && bkf_lc(px.email) === em);
            });
        }
        vm.bkf_pax_search_members = function(q){
            vm.bkf_pax_search = String(q || '');
            // members/search is staff-only (it lists names + emails); a member types their passenger's email instead
            if(!vm.bkf_is_staff()){ vm.bkf_pax_members = []; return; }
            var club = parseInt(vm.club_id, 10) || vm.bkf_members_club || vm.bkf_default_club();
            if(!(club > 0)){ return; }
            var seq = ++bkf_pax_seq;
            MemberService.SearchClubMembers(club, q || '', 25).then(function(data){
                if(seq !== bkf_pax_seq){ return; }
                var list = (data && angular.isArray(data.members)) ? data.members : [];
                vm.bkf_pax_members = list.filter(function(m){ return !bkf_pax_excluded(m); }).map(function(m){ m.is_member = true; return m; });
            });
        };
        // "james@james.com" → email; "james smith" → James / Smith; "James" → first name
        function bkf_cap(w){ return (w && w === w.toLowerCase()) ? w.charAt(0).toUpperCase() + w.slice(1) : w; }
        function bkf_pax_prefill(text){
            var pax = { id: 0, email: "", first_name: "", last_name: "", is_member: false, status: "", not_found: true };
            var t = String(text || '').trim();
            if(!t){ return pax; }
            if(t.indexOf('@') > -1){ pax.email = t.replace(/\s+/g, '').toLowerCase(); return pax; }
            var w = t.split(/\s+/);
            pax.first_name = bkf_cap(w[0]);
            if(w.length > 1){ pax.last_name = w.slice(1).map(bkf_cap).join(' '); }
            return pax;
        }
        // the picker's text RIGHT NOW (the refresh callback that sets vm.bkf_pax_search runs 250 ms late, so a fast
        // "type, then click Invite passenger" would lose the last characters)
        function bkf_pax_select(){
            var el = document.querySelector('#row-add-pax .ui-select-container') ||
                     Array.prototype.slice.call(document.querySelectorAll('body > .ui-select-container')).filter(function(e){ return e.getAttribute('title') === 'Add a passenger'; })[0];
            if(!el){ return null; }
            try { return angular.element(el).controller('uiSelect') || (angular.element(el).scope() || {}).$select || null; } catch(e){ return null; }
        }
        function bkf_pax_live_search(){
            var sel = bkf_pax_select();
            var live = sel && typeof sel.search === 'string' ? sel.search : '';
            return live || vm.bkf_pax_search || '';
        }
        // clear the picker's typed text (the ui-select keeps it: reset-search-input="0")
        function bkf_pax_clear_search(){
            vm.bkf_pax_search = ''; vm.bkf_pax_from_text = false;
            var sel = bkf_pax_select();
            if(sel){ sel.search = ''; }
        }
        function bkf_pax_after_add(){ bkf_pax_clear_search(); vm.bkf_pax_members = []; vm.bkf_pax_preview(); }
        // what saving will do for the rows not saved yet (a picked member, a typed email)
        vm.bkf_pax_preview = function(){
            if(!vm.is_v2){ return; }
            var rows = (vm.new_booking.passengers || []).filter(function(r){ return !r.booking_id; });
            if(!rows.length){ return; }
            var club = parseInt(vm.club_id, 10) || (vm.new_booking.plane && parseInt(vm.new_booking.plane.club_id, 10)) || vm.bkf_default_club();
            var end = vm.new_booking.end_datetime ? moment(vm.new_booking.end_datetime).format('YYYY-MM-DDTHH:mm:ss') : '';
            rows.forEach(function(r){ r.preview_pending = true; });
            var seq = ++bkf_preview_seq;
            BookingService.PassengerPreview(club, end, rows.map(function(r){ return { user_id: parseInt(r.user_id, 10) || 0, email: r.email || '' }; }), vm.new_booking.id)
                .then(function(data){
                    if(seq !== bkf_preview_seq){ return; }
                    var out = (data && data.success && data.passengers) || [];
                    rows.forEach(function(r){
                        r.preview_pending = false;
                        var uid = parseInt(r.user_id, 10) || 0, em = bkf_lc(r.email);
                        var p = null;
                        for(var k = 0; k < out.length && !p; k++){
                            if((uid && parseInt(out[k].user_id, 10) === uid) || (em && bkf_lc(out[k].email) === em)){ p = out[k]; }
                        }
                        if(p){
                            r.preview_status = p.status_after_save;
                            if(!r.first_name && p.name){ var parts = String(p.name).split(' '); r.first_name = parts[0]; r.last_name = parts.slice(1).join(' '); }
                            if(!r.email && p.email){ r.email = p.email; }
                        }
                    });
                });
        };
        // one chip per passenger: {tone: ok|wait|no|muted, icon, text, tip}
        vm.bkf_pax_chip = function(p){
            if(!p){ return { tone: 'muted', icon: 'fa-user', text: '', tip: '' }; }
            if(p.status === 'declined'){ return { tone: 'no', icon: 'fa-times', text: 'Declined', tip: "They said they can't make it. Resend to invite them again." }; }
            if(p.status === 'accepted' || p.status === 'member'){ return { tone: 'ok', icon: 'fa-check', text: 'Ready to fly', tip: 'Confirmed for this flight.' }; }
            if(p.status === 'invited' || p.status === 'pending'){ return { tone: 'wait', icon: 'fa-envelope-open-text', text: 'Invited — awaiting reply', tip: 'They have the email with their code but have not finished yet.' }; }
            // not saved yet
            if(p.preview_pending){ return { tone: 'muted', icon: 'fa-circle-notch fa-spin', text: 'Checking…', tip: '' }; }
            if(p.preview_status === 'accepted'){ return { tone: 'ok', icon: 'fa-check', text: 'Ready to fly', tip: 'A current member of the club — no invitation needed. They get a short note when you save.' }; }
            if(p.preview_status === 'invited' || p.status === 'to_invite' || !p.is_member){ return { tone: 'wait', icon: 'fa-envelope', text: 'Invitation on save', tip: "They'll get an email with a code to add their details when you save." }; }
            return { tone: 'muted', icon: 'fa-user', text: 'Member', tip: '' };
        };
        // v1 flips booking_self from the aircraft's club; in v2 an explicit "Myself" wins over the
        // staff default (false). A flip TO myself (not staff at that club) is never blocked.
        function bkf_default_self(val){
            if(vm.is_v2 && vm.bkf_self_explicit && val === false){ return; }
            vm.booking_self = val;
        }
        // Aircraft list order (2026-11-04): real aircraft first in the endpoint's (club settings) order, then EVERY
        // waiting-list pseudo-row ("{id}w", waiting == 1) under its own "Waiting lists" header; with the club filter
        // set that club comes first in each half ("Other clubs" / "Other clubs — waiting lists"). ui-select group-by
        // shows groups in first-seen order, so the array is sorted to match; an empty group name is hidden by CSS.
        function bkf_plane_other(plane){ return (vm.bkf_club_filter > 0) && parseInt(plane.club_id, 10) !== vm.bkf_club_filter; }
        vm.bkf_plane_group = function(plane){
            if(plane.waiting != 1 && !bkf_plane_other(plane) && bkf_wrq_type_match(plane)){ return 'Requested: ' + vm.bkf_wrq_type; }
            if(!plane){ return ''; }
            if(plane.waiting == 1){ return bkf_plane_other(plane) ? 'Other clubs — waiting lists' : 'Waiting lists'; }
            return bkf_plane_other(plane) ? 'Other clubs' : '';
        };
        function bkf_sort_planes(list){
            if(!vm.is_v2 || !angular.isArray(list)){ return list; }
            var b = [[], [], [], []];
            list.forEach(function(p){ b[(p.waiting == 1 ? 2 : 0) + (bkf_plane_other(p) ? 1 : 0)].push(p); });
            // booking from a waiting-list request that names a type: that type's aircraft first (stable), grouped "Requested"
            if(vm.bkf_wrq_type){
                var typeFirst = function(arr){ var yes = [], no = []; arr.forEach(function(p){ (bkf_wrq_type_match(p) ? yes : no).push(p); }); return yes.concat(no); };
                b[0] = typeFirst(b[0]); b[1] = typeFirst(b[1]);
            }
            return b[0].concat(b[1], b[2], b[3]);
        }
        function bkf_wrq_type_match(p){ return !!(vm.bkf_wrq_type && p && String(p.plane_type || '').toUpperCase() === vm.bkf_wrq_type); }
        vm.bkf_wrq_type_match = bkf_wrq_type_match;
        // the request's own aircraft, else the FIRST free aircraft of its type (a waiting-list pseudo-row is a taken slot);
        // nothing of that type free → leave the dropdown open with that type grouped first
        function bkf_wrq_pick_plane(){
            if(!vm.is_v2 || !vm.bkf_wrq || bkf_wrq_plane_done || !angular.isArray(vm.planes) || !vm.planes.length){ return; }
            bkf_wrq_plane_done = true;
            if(vm.new_booking.plane){ return; }
            var pre = null;
            if(vm.bkf_wrq_plane_id){ pre = vm.planes.find(function(x){ return parseInt(x.id, 10) === vm.bkf_wrq_plane_id && x.waiting != 1; }) || null; }
            if(!pre && vm.bkf_wrq_type){ pre = vm.planes.find(function(x){ return bkf_wrq_type_match(x) && x.waiting != 1; }) || null; }
            if(pre){
                vm.new_booking.plane = pre;
                $scope.getPlaneInstructors();
            }
        }
        // Instructor row note from bookings/plane_instructors' additive annotation
        // (available / reason / busy_with); the v1 keys (holidays, availability) are the fallback.
        // Memoised on the row object (_underscore = transient): the template watches the result in ng-if /
        // ng-class, and a fresh object per call never settles the digest ($rootScope:infdig on a 24-row list).
        vm.bkf_ins_note = function(ins){
            if(!ins){ return null; }
            if(ins._bkf_note !== undefined){ return ins._bkf_note; }
            return (ins._bkf_note = bkf_ins_note_build(ins));
        };
        function bkf_ins_note_build(ins){
            var hm = function(str){ str = (str || '').toString(); return (str.length >= 16) ? str.substr(11, 5) : str; };
            if(ins.reason === 'booked' && ins.busy_with){
                var w = ins.busy_with;
                return { kind: 'danger', text: 'Already booked: ' + [w.name, w.registration].filter(Boolean).join(' · ') + ' ' + hm(w.start) + '–' + hm(w.end) };
            }
            if(ins.reason === 'booked'){ return { kind: 'danger', text: 'Already booked' }; }
            if(ins.reason === 'holiday' || ins.holidays == 1){ return { kind: 'warn', text: 'On holiday' }; }
            if(ins.reason === 'not_working'){ return { kind: 'warn', text: 'Not working that day' }; }
            if(ins.available === true || (ins.availability && ins.availability.available == 1)){ return { kind: 'ok', text: 'Available' }; }
            if(ins.availability && ins.availability.available == 0 && ins.availability.reason){ return { kind: 'warn', text: ins.availability.reason }; }
            return null;
        };
        vm.bkf_initials = function(o){
            if(!o){ return '?'; }
            var f = (o.first_name || '').toString().trim(), l = (o.last_name || '').toString().trim();
            if(!f && o.name){ var parts = o.name.toString().trim().split(/\s+/); f = parts[0] || ''; l = parts.length > 1 ? parts[parts.length - 1] : ''; }
            if(!f && o.email){ f = o.email.toString(); }
            return ((f.charAt(0) || '') + (l.charAt(0) || '')).toUpperCase() || '?';
        };

        // ── Who BEFORE What (2026-11-04) ──
        // The instructor list is CLUB-level for the slot: bookings/club_instructors/{user}/{club}/{from}/{to}
        // (the plane_instructors row shape + available / reason / busy_with, plus course_ids / courses_restricted /
        // plane_ids). The club = the chosen aircraft's → an edited booking's → vm.bkf_club (the v2 club filter →
        // the user's staff club → their first club; a chooser shows only with several clubs). Picking an instructor
        // narrows the AIRCRAFT list (their plane_ids, else bookings/instructor_planes — the instructor-first flow's
        // endpoint) and the COURSE / tuition list (course_ids); a club manager / super-admin lifts either with
        // "Show all". Nothing is cleared silently: an aircraft or course off the list stays picked, with a note.
        vm.bkf_show_slot_card = false;        // the "Your slot" summary is hidden for now (markup kept behind it)
        vm.bkf_club = 0;                      // Who-card club before an aircraft is chosen
        vm.bkf_clubs = [];                    // [{id, title}] for the club chooser
        vm.bkf_ins_loading = false;
        vm.bkf_show_all_planes = false;       // admin override of the instructor → aircraft narrowing
        vm.bkf_show_all_courses = false;      // admin override of the instructor → tuition narrowing
        vm.bkf_from_instructor_row = false;   // opened from an instructor row (?instructor_id)
        vm.bkf_preselect_instructor_id = 0;
        vm.bkf_ins_plane_ids = null;          // {plane_id: true} the chosen instructor may instruct on; null = unknown / none
        vm.bkf_planes_list = [];              // what the Aircraft ui-select lists (sorted, maybe narrowed)
        vm.bkf_courses_list = [];             // what the Course / tuition ui-select lists
        var bkf_who_key = '', bkf_ins_seq = 0, bkf_courses_club = 0, bkf_ins_planes_seq = 0, bkf_ins_planes_key_done = '';

        vm.bkf_who_club = function(){
            var nb = vm.new_booking || {};
            return parseInt((nb.plane && nb.plane.club_id) || (vm.action == 'edit' && nb.club_id) || vm.bkf_club || 0, 10) || 0;
        };
        vm.bkf_is_manager_at = function(club){
            club = parseInt(club, 10);
            var a = vm.user && vm.user.access;
            return !!(club > 0 && a && [a.manager, a.super_admin].some(function(l){ return angular.isArray(l) && l.indexOf(club) > -1; }));
        };
        vm.bkf_admin_here = function(){ return vm.bkf_is_manager_at(vm.bkf_who_club()); };
        vm.bkf_can_override = function(){ return !!(vm.is_v2 && vm.bkf_admin_here()); };
        vm.bkf_club_title = function(id){
            id = parseInt(id, 10);
            var c = vm.bkf_clubs.find(function(x){ return x.id === id; });
            return c ? c.title : '';
        };
        vm.bkf_show_club_chooser = function(){
            return !!(vm.is_v2 && vm.action != 'edit' && vm.bkf_clubs.length > 1 && !(vm.new_booking && vm.new_booking.plane));
        };
        function bkf_build_clubs(){
            var list = [], seen = {};
            var add = function(id, title){ id = parseInt(id, 10); if(id > 0 && !seen[id]){ seen[id] = true; list.push({ id: id, title: title || ('Club ' + id) }); } };
            var st = SchedulerV2Service.lastSettings;
            (st && angular.isArray(st.clubs) ? st.clubs : []).forEach(function(c){ add(c.id, c.title); });
            (angular.isArray(vm.planes) ? vm.planes : []).forEach(function(p){ add(p.club_id, p.club_title); });
            vm.bkf_clubs = list;
            if(!(vm.bkf_club > 0) || (list.length && !seen[vm.bkf_club])){ vm.bkf_set_club(bkf_initial_club(list)); }
        }
        function bkf_initial_club(list){
            var ids = list.map(function(c){ return c.id; });
            var has = function(id){ id = parseInt(id, 10); return (id > 0 && (!ids.length || ids.indexOf(id) > -1)) ? id : 0; };
            return has(vm.bkf_club_filter) || has(vm.bkf_default_club())
                || has(vm.user.current_club_admin && vm.user.current_club_admin.id) || has(vm.user.current_club_instructor) || ids[0] || 0;
        }
        vm.bkf_club_pick = 0;                 // the chooser's own model (ng-change hands it to bkf_set_club)
        vm.bkf_set_club = function(id){
            id = parseInt(id, 10) || 0;
            vm.bkf_club_pick = id;
            if(id === vm.bkf_club){ return; }
            vm.bkf_club = id;
            if(id > 0 && !(vm.new_booking && vm.new_booking.plane) && vm.action != 'edit'){ vm.club_id = id; }
            if(vm.action != 'edit'){ bkf_load_members(); }      // an edit's members come from prepare_add_edit (the booking's club)
        };
        // the ONE instructor fetch of the panel (replaces plane_instructors / plane_instructors2 here)
        function bkf_sync_who(force){
            if(!vm.is_v2 || !vm.new_booking){ return; }
            var club = vm.bkf_who_club(), from = vm.new_booking.start_datetime, to = vm.new_booking.end_datetime;
            if(!(club > 0) || !from || !to){ return; }
            var key = club + '|' + from + '|' + to + '|' + ((vm.action == 'edit' && vm.new_booking.id) ? vm.new_booking.id : '');
            if(!force && key === bkf_who_key){ return; }
            bkf_who_key = key;
            if(!vm.new_booking.plane && vm.action != 'edit'){ vm.club_id = club; }
            bkf_load_instructors(club, from, to);
            bkf_load_courses(club);
        }
        function bkf_load_instructors(club, from, to){
            var seq = ++bkf_ins_seq;
            // v1's rule (show_all = edit || booking for someone else), and club staff always see every row annotated
            var show_all = (vm.is_edit_show_all || !vm.booking_self || vm.bkf_is_staff_at(club)) ? 1 : 0;
            vm.bkf_ins_loading = true;
            BookingService.GetClubInstructors(vm.user.id, club, from, to, show_all, (vm.action == 'edit' && vm.new_booking.id) ? vm.new_booking.id : 0)
            .then(function(data){
                if(seq !== bkf_ins_seq){ return; }
                vm.bkf_ins_loading = false;
                vm.instructors = angular.isArray(data) ? data : [];
                var cur = vm.new_booking.instructor;
                var want = parseInt(vm.bkf_preselect_instructor_id || (cur && (cur.id || cur.user_id)) || 0, 10);
                if(want > 0){
                    var row = vm.instructors.find(function(i){ return parseInt(i.id, 10) === want || parseInt(i.user_id, 10) === want; });
                    if(row){
                        vm.new_booking.instructor = row;                       // the fresh, annotated row
                        if(vm.bkf_preselect_instructor_id){ vm.bkf_preselect_instructor_id = 0; $scope.select_plane(row); }
                    } else if(vm.bkf_preselect_instructor_id){
                        vm.bkf_preselect_instructor_id = 0;
                        ToastService.warning("Instructor not found", "Pick the instructor on the form instead.");
                    } else if(cur){
                        // not an instructor of this club (v1 clears too) — but never silently
                        delete vm.new_booking.instructor;
                        if(vm.action != 'edit' || bkf_who_key.indexOf('|') > 0){
                            var cname = ((cur.first_name || '') + ' ' + (cur.last_name || '')).trim() || 'The instructor';
                            ToastService.warning("Instructor cleared", cname + " is not an instructor at " + (vm.bkf_club_title(club) || "this club") + ", so the instructor was cleared.");
                        }
                    }
                }
                if(vm.new_booking.plane){ free_places(); }
                bkf_refresh_views();
            });
        }
        function bkf_load_courses(club){
            if(!(club > 0) || club === bkf_courses_club){ return; }
            bkf_courses_club = club;
            CourseService.GetCoursesByClubId(club).then(function(data){
                if(club !== bkf_courses_club){ return; }
                vm.courses = CourseService.sortByDisplayOrder((data && data.items) ? data.items : []);
                var want = (vm.new_booking.tuition_required && vm.new_booking.tuition_required.id) || vm.new_booking.course_id;
                if(want){
                    var found = vm.courses.find(function(c){ return parseInt(c.id, 10) === parseInt(want, 10); });
                    if(found){ vm.new_booking.tuition_required = found; }
                }
                bkf_refresh_views();
            });
        }
        // the instructor the cascade narrows for: the picked one, else the user when they will be the instructor
        vm.bkf_effective_instructor = function(){
            var ins = vm.new_booking && vm.new_booking.instructor;
            if(ins && parseInt(ins.id, 10) > 0){ return ins; }
            if(vm.bkf_auto_instructor()){
                return (vm.instructors || []).find(function(i){ return parseInt(i.id, 10) === parseInt(vm.user.id, 10); }) || { id: vm.user.id, first_name: vm.user.first_name, last_name: vm.user.last_name };
            }
            return null;
        };
        // keyed on the instructor id, whether their row carries plane_ids yet (the bare ?instructor_id object and the
        // "myself" placeholder are swapped for the annotated row once the club list lands) and the slot
        function bkf_ins_planes_key(){
            var ins = vm.bkf_effective_instructor();
            var id = ins ? (parseInt(ins.id, 10) || 0) : 0;
            var nb = vm.new_booking || {};
            return id + '|' + ((ins && angular.isArray(ins.plane_ids) && ins.plane_ids.length) ? 'p' : 'n') + '|' + (nb.start_datetime || '') + '|' + (nb.end_datetime || '');
        }
        function bkf_sync_instructor_planes(){
            var ins = vm.bkf_effective_instructor();
            var id = ins ? (parseInt(ins.id, 10) || 0) : 0;
            var key = bkf_ins_planes_key();
            if(key === bkf_ins_planes_key_done){ return; }
            bkf_ins_planes_key_done = key;
            var seq = ++bkf_ins_planes_seq;
            vm.bkf_ins_plane_ids = null;
            if(id > 0 && angular.isArray(ins.plane_ids) && ins.plane_ids.length){
                var set = {};
                ins.plane_ids.forEach(function(p){ set[parseInt(p, 10)] = true; });
                vm.bkf_ins_plane_ids = set;
            } else if(id > 0 && vm.new_booking.start_datetime && vm.new_booking.end_datetime){
                // nothing configured on the row → the aircraft of the clubs they instruct at (the instructor-first endpoint)
                BookingService.GetInstructorPlanes(vm.user.id, id, vm.new_booking.start_datetime, vm.new_booking.end_datetime)
                .then(function(data){
                    if(seq !== bkf_ins_planes_seq || !angular.isArray(data)){ return; }
                    var set2 = {};
                    data.forEach(function(p){ set2[parseInt(p.id, 10)] = true; });
                    vm.bkf_ins_plane_ids = set2;
                    bkf_refresh_views();
                });
            }
            bkf_refresh_views();
        }
        function bkf_plane_real_id(p){ return parseInt((p && p.waiting == 1 && p.parentId) ? p.parentId : (p && p.id), 10) || 0; }
        vm.bkf_plane_off = function(p){ return !!(p && vm.bkf_ins_plane_ids && !vm.bkf_ins_plane_ids[bkf_plane_real_id(p)]); };
        vm.bkf_course_off = function(c){
            var ins = vm.bkf_effective_instructor();
            if(!ins || !c || !ins.courses_restricted || !angular.isArray(ins.course_ids)){ return false; }
            return ins.course_ids.map(Number).indexOf(parseInt(c.id, 10)) < 0;
        };
        vm.bkf_planes_narrowed = function(){ return !!(vm.bkf_ins_plane_ids && !vm.bkf_show_all_planes); };
        vm.bkf_courses_narrowed = function(){
            var ins = vm.bkf_effective_instructor();
            return !!(ins && ins.courses_restricted && angular.isArray(ins.course_ids) && !vm.bkf_show_all_courses);
        };
        vm.bkf_ins_name = function(){
            var i = vm.bkf_effective_instructor();
            var n = i ? ((i.first_name || '') + ' ' + (i.last_name || '')).trim() : '';
            return n || 'this instructor';
        };
        function bkf_refresh_views(){
            if(!vm.is_v2){ return; }
            var planes = bkf_sort_planes(angular.isArray(vm.planes) ? vm.planes : []);
            vm.bkf_planes_list = vm.bkf_planes_narrowed() ? planes.filter(function(p){ return !vm.bkf_plane_off(p); }) : planes;
            var courses = angular.isArray(vm.courses) ? vm.courses : [];
            vm.bkf_courses_list = vm.bkf_courses_narrowed() ? courses.filter(function(c){ return !vm.bkf_course_off(c); }) : courses;
        }
        vm.bkf_toggle_all_planes = function(){ vm.bkf_show_all_planes = !vm.bkf_show_all_planes; bkf_refresh_views(); };
        vm.bkf_toggle_all_courses = function(){ vm.bkf_show_all_courses = !vm.bkf_show_all_courses; bkf_refresh_views(); };
        // "( 11 hours 30 minutes )" → "11h30" · "( 1 hour )" → "1h" · "( 30 minutes )" → "30m" · "( 1 day 2 hours )" → "1d 2h"
        // (the closed End-time field; the model keeps v1's long strings)
        vm.bkf_short_duration = function(d){
            if(!d){ return ''; }
            var str = String(d), g = function(re){ var m = str.match(re); return m ? parseInt(m[1], 10) : 0; };
            var days = g(/(\d+)\s*day/), hours = g(/(\d+)\s*hour/), mins = g(/(\d+)\s*min/);
            var out = [];
            if(days){ out.push(days + 'd'); }
            if(hours){ out.push(hours + 'h' + (mins ? (mins < 10 ? '0' + mins : mins) : '')); }
            else if(mins){ out.push(mins + 'm'); }
            return out.join(' ');
        };
        if(vm.is_v2){
            $scope.$watch(function(){
                var nb = vm.new_booking || {};
                return vm.bkf_who_club() + '|' + (nb.start_datetime || '') + '|' + (nb.end_datetime || '') + '|' + (vm.action == 'edit' ? (nb.id || '') : '');
            }, function(){ bkf_sync_who(); });
            $scope.$watch(bkf_ins_planes_key, function(){ bkf_sync_instructor_planes(); });
            $scope.$watchCollection('vm.planes', function(){ bkf_build_clubs(); bkf_refresh_views(); });
            $scope.$watchCollection('vm.courses', function(){ bkf_refresh_views(); });
        }

        // ── Edit window helper: mirrors backend is_within_edit_window logic ──
        function isWithinEditWindow(bookingEnd) {
            var endMoment = moment(Date.parse(bookingEnd));
            // Future bookings are always editable
            if (endMoment.isAfter(moment())) { return true; }

            var club = vm.user.current_club_admin;
            if (!club) { return false; }

            // Super-admins are always exempt
            if (vm.user.access.super_admin && vm.user.access.super_admin.indexOf(parseInt(club.id)) > -1) {
                return true;
            }

            var windowMinutes;
            if (vm.user.access.manager.indexOf(parseInt(club.id)) > -1) {
                windowMinutes = parseInt(club.edit_window_admin_minutes) || 0;
            } else if (vm.user.access.instructor.indexOf(parseInt(club.id)) > -1) {
                windowMinutes = parseInt(club.edit_window_instructor_minutes) || 0;
            } else {
                windowMinutes = parseInt(club.edit_window_member_minutes);
                if (isNaN(windowMinutes)) { windowMinutes = 60; }
            }

            // 0 means unlimited
            if (windowMinutes === 0) { return true; }

            return moment().isSameOrBefore(endMoment.clone().add(windowMinutes, 'minutes'));
        }

        // Sliding booking panel state
        vm.bookingPanelOpen = false;
        vm.toggleBookingPanel = function() {
            if (vm.is_restricted_member) return; // Read-only mode — no booking panel
            vm.bookingPanelOpen = !vm.bookingPanelOpen;
        };

        // Book with a specific instructor from the event popup
        vm.bookWithInstructor = function(booking) {
            // Close the event detail popup
            vm.see_booking.visible = 0;

            // Pre-fill the booking form with the time from the clicked event
            var now = new Date();
            var startDate = new Date(now);
            startDate.setMinutes(0);
            startDate.setSeconds(0);
            var endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);

            vm.new_booking.start_date = startDate;
            vm.new_booking.end_date = endDate;
            vm.new_booking.start_time = {time: moment(startDate).format("HH:mm")};
            vm.new_booking.end_time = {time: moment(endDate).format("HH:mm")};

            // Pre-select the instructor
            vm.new_booking.instructor = booking.instructor;

            // Set booking permissions for instructor/admin view
            vm.booking_self = false;
            vm.show_self_option = true;

            // Generate datetimes then fetch planes this instructor can teach on
            $scope.update_dateTime("edit2");

            // Fetch all available planes, then filter to ones this instructor teaches on
            var start_iso = moment(startDate).format("YYYY-MM-DDTHH:mm:ss");
            var end_iso = moment(endDate).format("YYYY-MM-DDTHH:mm:ss");

            BookingService.GetAllPlanes(vm.user.id, start_iso, end_iso, 0, 0)
            .then(function(data){
                var allPlanes = data;
                var instructor_id = booking.instructor.id;

                // Check each plane to see if this instructor is available for it
                var planePromises = [];
                var matchedPlanes = [];

                allPlanes.forEach(function(plane) {
                    var promise = BookingService.GetPlaneInstructors(vm.user.id, plane.id, start_iso, end_iso, 1)
                    .then(function(instructors) {
                        var found = instructors.find(function(inst) {
                            return parseInt(inst.id) === parseInt(instructor_id);
                        });
                        if (found) {
                            matchedPlanes.push(plane);
                        }
                    });
                    planePromises.push(promise);
                });

                // Wait for all plane checks, then set filtered planes list
                // Use a simple counter since we're in AngularJS 1.4 without Promise.all on $http
                var completed = 0;
                var total = planePromises.length;
                planePromises.forEach(function(p) {
                    p.finally(function() {
                        completed++;
                        if (completed === total) {
                            vm.planes = matchedPlanes.length > 0 ? matchedPlanes : allPlanes;
                            vm.instructors = [booking.instructor];
                        }
                    });
                });
            });

            // Open the booking panel
            vm.bookingPanelOpen = true;
        };

        //just in case i missed a changed value...
        vm.user_id = vm.user.id;

        // True until the first schedule fetch lands (and again while the user
        // navigates to a different date range). Drives the calendar's loading
        // overlay + fade in the view.
        $scope.calendar_loading = true;

        vm.no_show_cols = ["membership_start", "membership_id", "selected"];

        var newDate = new Date();
        
        var h_start = Math.floor( defaultStartTime / 60 );          
        var i_start = defaultStartTime % 60;
        var h_end = Math.floor( defaultEndTime / 60 );          
        var i_end = defaultEndTime % 60;

        var defaultStart = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_start, i_start, 0);
        var defaultEnd = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), h_end, i_end, 0);
        vm.default_date =  new Date();

        vm.datepickerOptions = {
            customClass: getDayClass,
            format: 'dd/MM/yyyy',
            showWeeks: false,
            startingDay: 1
        }

        vm.dateTimeRangePickerOptions = {
            hour_step: 1,
            minute_step: 30,
            min_date: today,
            datepicker:{
                customClass: getDayClass,
                format: 'dd/MM/yyyy',
                showWeeks: false,
                minDate: today
            }
            ,
            // v1: the time pickers are clipped to a hard-coded 09:00–22:30 window. v2 offers the whole
            // day and shows a soft note when the slot is outside the club's opening hours (or, for a club
            // without hours, the hours the scheduler displays) — vm.bkf_hours_note. Nothing is blocked.
            business_hours: vm.is_v2 ? null : {
                from: "09:00",
                to: "22:30"
            }
        };

        $scope.whole_day_booking = false;


        // BookingService.GetAll(vm.user.id, moment().format("Y-M-D"), "")
        //     .then(function(data){
        //         $scope.all_events = data.events;
        //         $scope.all_resources = data.resources;
        //     });


        vm.instructor_charges = [];




        vm.cancellation = { 
                            reasons: [
                                "Pilot Unwell",
                                "Pilot Unavailable",
                                "Weather at home base",
                                "Weather at destination",
                                "Plane Unavailable",
                                "Plane Unserviceable",
                                "Plane Returned Too Late by previous booking",
                                "Instructor Not Available",
                                "Airfield Closed",
                                "Airspace Closed",
                                "Other - please specify"
                            ],
                            notes: ""
                        };



        var today = new Date();
        today.setMinutes(0);
        today.setSeconds(0);
        // var end = moment(today);
        // end.add(2, "hours");
        // end = new Date(end);
        // end.setSeconds(0);

        var end = new Date();
        end.setHours(end.getHours() + 2);
        end.setSeconds(0);


        var datepicker_today = new Date().format("d/M/yyyy");


        vm.start_times = [];
        vm.end_times = [];

        vm.new_booking = {
            start_date: today,
            end_date: today,
            free_seats: [],
            passengers: [],
            options: vm.dateTimeRangePickerOptions
        };

        $scope.toggle = true;
        $scope.whentimechangedata = {};
        $scope.overridePicker = true;

        var date = Date();
        vm.planes = [];
        init_times();

      $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
      $scope.format = $scope.formats[0];
        //prepare_add_edit();


       


        switch(vm.action){
            case "add":
                // //console.log("adding a new member please");
                vm.page_title = "Add a Booking";

                //update_bookings();

                vm.new_booking = {
                                    start_date: today,
                                    end_date: today,
                                    free_seats: [],
                                    passengers: [],
                                    options: vm.dateTimeRangePickerOptions
                };
                figure_out_steps();





            break;
            case "edit":
                vm.page_title = "Edit a Booking";

                vm.see_booking.visible = 0;
                vm.bookingPanelOpen = true;

                // vm.default_date = new Date("2016-10-11");
                vm.new_booking = {
                                    start_date: today,
                                    end_date: today,
                                    free_seats: [],
                                    passengers: [],
                                    options: vm.dateTimeRangePickerOptions
                };
                figure_out_steps();
                //vm.new_booking.
                //get a single events
                
                update_bookings();

                    //SSCROLL TOOOOO scroll to --> fc-now-indicator fc-now-indicator-line



                if($stateParams.booking_id){


                     




                     BookingService.GetEdit(vm.user.id, $stateParams.booking_id)
                        .then(function(data){
                            // //console.log("GETTING CONTENT FROM EDIT : ", data);

                            if(data.success){



                                // //console.log("EDIT THIS CONTENT HERE", data);
                                // //console.log("CHECK CONTENT FROM RETURN", data.booking.instructor);

                                vm.new_booking = data.booking;
                                // bookings.solo (potential solo) — the saved value is the explicit choice on an edit
                                vm.new_booking.solo = (parseInt(data.booking.solo, 10) === 1) ? 1 : 0;
                                if(vm.is_v2){ vm.bkf_solo_explicit = true; }

                                // Set vm.club_id immediately from the booking data so all
                                // downstream calls (getPlaneInstructors, prepare_add_edit,
                                // check_plane_availability, etc.) have it available.
                                if(data.booking.club_id){
                                    vm.club_id = parseInt(data.booking.club_id);
                                }

                                if(vm.user.access.instructor.indexOf(data.booking.club_id) > -1 || vm.user.access.manager.indexOf(data.booking.club_id) > -1){
                                    // //console.log("THIS IS AN INSTRUCTOR IN THIS CLUB...");
                                    
                                    vm.show_self_option = true;
                                }

                                if(data.booking.user_id == vm.user.id){
                                    vm.booking_self = true;
                                } else {
                                    vm.booking_self = false;
                                }

                                if(data.booking.maintenance_flight == 1){
                                    vm.new_booking.maintenance_flight = true;
                                }

                                // //console.log("MY INSTRUCTOR HERE: ", vm.new_booking.instructor);
                                vm.new_booking.options = vm.dateTimeRangePickerOptions;
                                vm.new_booking.edit_booking = 1;



                                // console.log("GET EDIT - ", vm.new_booking.start);
                                vm.new_booking.start_date = moment(vm.new_booking.start).toDate(); //new Date(vm.new_booking.start);
                                // console.log("GET EDIT - ", vm.new_booking.start_date);




                                // vm.new_booking.start_time = {time: moment(vm.new_booking.start).format("HH:mm"), disabled: 1};
                                vm.new_booking.start_time = {time: moment(vm.new_booking.start).format("HH:mm")};
                                // vm.new_booking.end_date = moment(luxon.DateTime.fromISO(vm.new_booking.end).toISO()).toDate();// new Date(vm.new_booking.end);
                                vm.new_booking.end_date = moment(vm.new_booking.end).toDate();// new Date(vm.new_booking.end);

                                vm.new_booking.end_time = {time: moment(vm.new_booking.end).format("HH:mm")};


                                vm.new_booking.after_booking_end = !isWithinEditWindow(vm.new_booking.end);

                                
                                //vm.default_date = new Date(vm.new_booking.start);

                                
                                if(vm.new_booking.instructor && vm.new_booking.instructor.id == vm.user_id){
                                    vm.booking_self = false;
                                }


                                 //this will require breaking up quite a bit... but to access the parent one...
                                $scope.$parent.vm.default_date =  vm.new_booking.start_date;
                                setTimeout(function(){

                                    if($scope.$parent.vm.see_booking){
                                        $scope.$parent.vm.see_booking.visible = 1;
                                    }
                                    



                                    //removed the go to date which was causing errors....
                                   $("#calendar").fullCalendar("gotoDate", vm.new_booking.start_date );
                                //console.log("HERE WE GO", vm.new_booking.start_date);

                                    //VERY hacky... not good - but it scrolls to the right place... maybe add a 
                                    setTimeout(function(){
                                        console.log("ID IS : ", $stateParams.booking_id);
                                            var w = parseInt($('a.fc-timeline-event.booking'+$stateParams.booking_id).css("left"));
                                        var b = parseInt($('a.fc-timeline-event.booking'+$stateParams.booking_id).width());
                                         let offsetEvent = w + (b/2) - ($('tbody .fc-time-area .fc-scroller').width()  / 2);

                                        $('tbody .fc-time-area .fc-scroller').animate({
                                            scrollLeft:  offsetEvent
                                        }, 1800);
                                    }, 1000);


                                    $scope.$apply();

                                                                //console.log("ERR BEFORE HERE?");


                                }, 800);

                                // //console.log("DEFAULT", vm.default_date);                               

                                generate_datetimes();

                                $scope.update_dateTime("edit");
                                
                                // //console.log("EDIT", vm.new_booking);
                                // //console.log("=== CHECK AT EDIT", vm.new_booking.instructor);
                                

                                // InstructorCharges.GetByClubId(vm.new_booking.club_id)
                                //     .then(function(data){

                                //         vm.instructor_charges = data.items;  
                                //         // //console.log("====> ", data); 
                                //     });

                                //vm.courses
                                // console.log("GET COURSES");
                                if(vm.is_v2){ bkf_courses_club = parseInt(vm.new_booking.club_id, 10) || 0; }   // bkf_load_courses: already covered
                                CourseService.GetCoursesByClubId(vm.new_booking.club_id)
                                .then(function(data){
                                    vm.courses = CourseService.sortByDisplayOrder(data.items);   
                                    // console.log("COURSES", vm.courses);

                                    //set new_booking.tuition-required 
                                    vm.new_booking.tuition_required = vm.courses.find(function(course, index) {
                                                                    if(course.id == vm.new_booking.course_id)
                                                                        return true;
                                                                });


                                });



                                //get all the club members by first and last name and email --> nothing else
                                //this would only include the members that are for the plane that was selected....


                                ////console.log("BEFORE GET", vm.new_booking.end_time);
                                prepare_add_edit(vm.new_booking.club_id, vm.new_booking.end);



                                if(vm.new_booking.rental_items){
                                    //then we may have shizzle to check / update
                                    for(var i=0;i<vm.new_booking.rental_items.length;i++){
                                        //first and foremost we need to check the available bits....
                                        // //console.log("NO TO BOOK: "+vm.new_booking.rental_items[i]["number_to_book"]);
                                        vm.new_booking.rental_items[i]["number_to_book"] = parseInt(vm.new_booking.rental_items[i]["number_to_book"]);
                                    }
                                }

                                if(vm.new_booking.free_seats){
                                    // //console.log("FREE", vm.new_booking.free_seats);
                                    vm.new_booking.free_seats = parseInt(vm.new_booking.free_seats);
                                }
                                console.log("here");
                                if(vm.new_booking.instructor){
                                   console.log("MY INSTRUCTOR HERE22: ", vm.new_booking.instructor);

                                }

                                // console.log("course: ", vm.new_booking.course_id);


                                if((vm.club_id == 0 || !vm.club_id) && vm.new_booking.plane && vm.new_booking.plane.id){
                                    vm.club_id = vm.new_booking.plane.club_id;
                                }
                                //vm.init_passengers();
                                free_places();
                                // console.log("HEY PAX");
                                // vm.init_passengers();
                                // //console.log("MY INSTRUCTOR HERE2244: ", vm.new_booking.instructor);

                            } else {
                                ToastService.error("Booking Error", data.message);
                                if(vm.is_v2){ vm.v2_close(false); }
                                else { $state.go('dashboard.add_booking'); }
                            }

                        });


                }
               


               
            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                // //console.log("VM", vm);
                // //console.log("VM", $stateParams);

                //alert("LIST");
                //alert(moment($stateParams.start).add(1, "hour").format("HH:mm"));

             


                vm.show_no_membership_message = false;
                vm.hide_dropdown = false; 
                vm.clubs = [];
                vm.is_restricted_member = false;

                //we need to get the memberships that the user is a member of....
                MemberService.GetUserClubs(vm.user.id)
                 .then(function(data){
                        vm.clubs = data.clubs;

                        // //console.log("CLUBS HERE : ", data);

                        if(vm.clubs && vm.clubs.length > 1){
                            vm.hide_dropdown = true;
                        } else if(vm.clubs.length == 1) {
                            vm.club_id = vm.clubs[0].id;
                            //console.log("SETTING THE CLUB ID HERE:: ", vm.club_id);
                        }

                        // Check if this member is restricted (no free booking rights)
                        // Instructors and managers bypass this check
                        if(vm.club_id) {
                            var isInstructor = vm.user.access.instructor.indexOf(vm.club_id) > -1;
                            var isManager = vm.user.access.manager.indexOf(vm.club_id) > -1;
                            if(!isInstructor && !isManager) {
                                MemberService.GetOneForUser(vm.user.id)
                                .then(function(memberData){
                                    var memberships = memberData.memberships || memberData;
                                    if(Array.isArray(memberships)) {
                                        for(var i = 0; i < memberships.length; i++) {
                                            if(parseInt(memberships[i].club_id) === parseInt(vm.club_id)) {
                                                if(memberships[i].free_booking == 0 || memberships[i].free_booking === false) {
                                                    vm.is_restricted_member = true;
                                                    // Don't redirect — let the member view the calendar as read-only
                                                }
                                                break;
                                            }
                                        }
                                    }
                                });
                            }
                        }

                        // The v2 panel has no calendar to fill (and the scheduler
                        // behind it polls for itself).
                        if(!vm.is_v2){
                            update_bookings();
                        }

                    });
                 
                 //generate_datetimes();

                //  BookingService.GetAllPlanes(vm.user.id, moment(vm.new_booking.start_datetime).format("Y-M-D HH:mm"), moment(vm.new_booking.end_datetime).format("Y-M-D HH:mm"), 0, 0)
                // .then(function(data){
                   
                //     vm.planes = data;
                //     // //console.log("PLANES NOW SET", vm.planes);
                //     if($stateParams.plane_id){
                //         // //console.log("plane_id", $stateParams.plane_id);
                //         for(var i=0;i<vm.planes.length;i++){
                //             // //console.log("I", i);
                //             // //console.log("id 1", vm.planes[i].id);
                //             // //console.log("I", i);
                //             if(parseInt(vm.planes[i].id) == $stateParams.plane_id){
                //                 vm.new_booking.plane = vm.planes[i];
                //                 // //console.log("found", vm.planes[i]);
                //             }
                //         }

                //     }

                // });

            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  



        function getAllPlaneUpdate(){
            check_times();
            //$scope.update_dateTime('edit');
             // BookingService.GetAllPlanes(vm.user.id, vm.new_booking.start_datetime, vm.new_booking.end_datetime, 0, 0)
             //    .then(function(data){
                   
             //        //this gets the events and bookings for the period checked here...
             //        // var events = data.events;
             //        vm.planes = data;
                

             //    });
        }

        
       
        $scope.back = function(){
            $rootScope.safeBack();
        }

        /* THIS SECTION IS ABOUT THE CALENDAR SHOWN ON ALL PAGES */


        /* FUNCTIONS REQUIRED FOR ALL PAGES SHOWING THE BOOKINGS ON CALENDAR */


        $scope.test = function(){
            //console.log("UPDATE");
            vm.new_booking.instructor = {
                id: 90,
                first_name: "A",
                last_name: "REYNIER"
            };
        }
    

    $scope.updateEvents = function(start, end){
        ////console.log("start", start, "end", end);

        // Track the current calendar view range for polling refresh
        _lastViewStart = start;
        _lastViewEnd = end;

        // FullCalendar calls this from outside Angular, so nudge a digest to
        // make the loading overlay appear straight away.
        $scope.calendar_loading = true;
        $scope.$applyAsync();

        BookingService.GetAll(vm.user.id, start, end)
        .then(function(data){
            // //console.log(data);

            $scope.calendar_loading = false;

            $scope.all_events = data.events;
            $scope.all_resources = data.resources;

            // Capture schedule_version if returned by backend
            if (data.schedule_version !== undefined) {
                _scheduleVersion = data.schedule_version;
            }

            // Start polling once we have our first data load
            _startSchedulePolling();

            // //console.log("hello", $scope.all_events);
            // //console.log("hello", $scope.all_resources);

            return data;

        });
    }

    // ── Schedule auto-refresh polling ──
    // Uses the same lightweight version-check pattern as the TV schedule display.
    // Polls GET /api/v1/bookings/schedule_version/:user_id every 30s.
    // Only triggers a full calendar refresh when the version number changes.

    function _startSchedulePolling() {
        if (_pollTimer) return; // already polling

        _pollTimer = $interval(function() {
            BookingService.GetScheduleVersion(vm.user.id)
                .then(function(data) {
                    if (!data || !data.success) return;

                    if (data.schedule_version !== undefined && data.schedule_version !== _scheduleVersion) {
                        // Version changed — something was added/edited/deleted
                        _scheduleVersion = data.schedule_version;
                        _refreshCalendarEvents();
                    }
                }, function() {
                    // Network error or endpoint not available — silently skip
                    // Will retry next poll cycle
                });
        }, _pollIntervalMs);
    }

    function _refreshCalendarEvents() {
        // Re-fetch events for the current calendar view range
        var start = _lastViewStart;
        var end = _lastViewEnd;

        if (!start) {
            // Fallback: use today's date
            start = moment().format("Y-MM-DD");
            end = "";
        }

        BookingService.GetAll(vm.user.id, start, end)
        .then(function(data) {
            $scope.all_events = data.events;
            $scope.all_resources = data.resources;

            if (data.schedule_version !== undefined) {
                _scheduleVersion = data.schedule_version;
            }

            // Update FullCalendar display
            $('#calendar').fullCalendar('removeEvents');
            $('#calendar').fullCalendar('addEventSource', $scope.all_events);
        });
    }

    // Cleanup polling on controller destroy (navigating away)
    $scope.$on('$destroy', function() {
        if (_pollTimer) {
            $interval.cancel(_pollTimer);
            _pollTimer = null;
        }
    });



    /* Render Tooltip */
    $scope.eventRender = function( event, element, view ) {
        element.attr({'tooltip': event.title,
                      'tooltip-append-to-body': true});
        $compile(element)($scope);
    };

    
    $scope.alertOnClicked = function(calEvent, jsEvent, view){

            // Auto-open the booking panel when an event is clicked (skip for read-only members)
            if (!vm.is_restricted_member) {
                vm.bookingPanelOpen = true;
            }

            vm.see_booking = calEvent;    

            vm.see_booking.start_date = moment(vm.see_booking.start).format("DD/MM/YYYY");
            vm.see_booking.end_date = moment(vm.see_booking.end).format("DD/MM/YYYY");
            vm.see_booking.start_time = moment(vm.see_booking.start).format("HH:mm");
            vm.see_booking.end_time = moment(vm.see_booking.end).format("HH:mm");

            vm.see_booking.start_datetime = new Date(vm.see_booking.start);
            vm.see_booking.end_datetime = new Date(vm.see_booking.end);
            vm.see_booking.visible = 1;

            vm.see_booking.after_booking_end = !isWithinEditWindow(vm.see_booking.end);

            $scope.$apply();
    };


    $scope.close_details = function(){
            vm.see_booking.visible = 0;
    }

    // "Student snapshot" on the booking popup: an instructional booking (not a
    // maintenance flight) and the viewer is staff of that booking's club. The
    // backend re-checks, so this only decides whether the button is worth showing.
    vm.canSeeSnapshot = function(booking) {
        if (!booking || !booking.id || !booking.user_id) { return false; }
        if (!booking.instructor || typeof booking.instructor !== 'object' || !(booking.instructor.id > 0)) { return false; }
        if (booking.maintenance_flight == 1) { return false; }
        var access = vm.user && vm.user.access;
        if (!access) { return false; }
        var club_id = parseInt(booking.club_id, 10);
        var lists = [access.instructor, access.manager, access.super_admin];
        for (var i = 0; i < lists.length; i++) {
            if (angular.isArray(lists[i]) && (lists[i].indexOf(club_id) > -1 || lists[i].indexOf(String(club_id)) > -1)) { return true; }
        }
        return false;
    };

    vm.openStudentSnapshot = function(booking) {
        if (!vm.canSeeSnapshot(booking)) { return; }
        StudentSnapshotService.open(booking.user_id, { booking_id: booking.id });
    };


    $scope.changeLang = function() {
    
        $scope.uiConfig.calendar.dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        $scope.uiConfig.calendar.dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
    };

    $scope.changed = function () {
        // $log.log('Time changed to: ' + $scope.mytime);
        $scope.check_plane_availability();
    };

    function j_changed() {
        // $log.log('Time changed to: ' + $scope.mytime);
        $scope.check_plane_availability();
    };

    $scope.check_plane_availability = function(){
       
        generate_datetimes();

        //getALL?
        var getA = (vm.new_booking.edit_booking == 1)? 1 : 0;
        var plane_id = (vm.new_booking.plane_id > 0)? vm.new_booking.plane_id : 0;
        if(vm.new_booking.plane && vm.new_booking.plane.id){
            plane_id = vm.new_booking.plane.id;
        }

        console.log("START BOOKINGS 2", vm.new_booking.start_datetime);
        // //console.log("START", moment(vm.new_booking.start_datetime).format("Y-M-D HH:mm"));
        // //console.log("END", vm.new_booking.end_datetime);
        console.log(vm.new_booking.start_datetime);
        console.log(vm.new_booking.end_datetime);

        console.log("START BOOKINGS 2", vm.new_booking.start_datetime);

        var start_dt = vm.new_booking.start_datetime;
        var end_dt = vm.new_booking.end_datetime;
        var show_all = (vm.is_edit_show_all) ? 1 : 0;
        BookingService.GetAllPlanes(vm.user.id, start_dt, end_dt, show_all, plane_id)
        .then(function(data){
           
            //this gets the events and bookings for the period checked here...
            // var events = data.events;
            vm.planes = bkf_sort_planes(data);
            

            if(getA == 1){
                //then I just want to iterate through these and return the plane already selected as "available..."

                ////console.log("PLANE", vm.new_booking.plane);

                for(var i = 0; i<vm.planes.length; i++){
                    if(vm.planes[i].id == vm.new_booking.plane.id){
                        reset_chosen = 0;
                        vm.new_booking.plane = vm.planes[i];
                        //chosen is still available WOOOO
                        $scope.check_rental_items();
                    }
                }



            } else {

                 //check if anything was already selected...
                var reset_chosen = 1;
                if(vm.new_booking.plane){
                    for(var i = 0; i<vm.planes.length; i++){
                        if(vm.planes[i].id == vm.new_booking.plane.id){
                            reset_chosen = 0;
                            //chosen is still available WOOOO
                            $scope.check_rental_items();
                        }
                    }
                    if(reset_chosen == 1){
                        //then we just need to clear currently selected plane
                        vm.new_booking.plane = {};
                        delete(vm.new_booking.plane);
                    }
                    //otherwise we can leave that we've already done! :)
                }

                // Scheduler v2 hand-off (?plane_id): select the aircraft the slot was
                // clicked on once the list for that time range is in — the 500 ms
                // 'edit2' timeout below raced this request.
                if(vm.preselect_plane_id && !vm.new_booking.plane){
                    var pre = vm.planes.find(function(x){ return parseInt(x.id) === vm.preselect_plane_id; });
                    if(pre){
                        vm.new_booking.plane = pre;
                        $scope.getPlaneInstructors();
                    }
                    vm.preselect_plane_id = 0;
                }
                // waiting-list Book: the request's aircraft (or the first free one of its type) once the list is in
                bkf_wrq_pick_plane();


            }

        });

    }

    $scope.events = [];

    function getDayClass(data) {
        var date = data.date,
          mode = data.mode;
        if (mode === 'day') {
          var dayToCheck = new Date(date).setHours(0,0,0,0);

          for (var i = 0; i < $scope.events.length; i++) {
            var currentDay = new Date($scope.events[i].date).setHours(0,0,0,0);

            if (dayToCheck === currentDay) {
              return $scope.events[i].status;
            }
          }
        }

        return '';
      }


    $scope.addOne = function(start=null, plane_id=null, end=null, resourceObj=null){
        // Block booking for read-only (restricted) members
        if (vm.is_restricted_member) {
            ToastService.warning('Read-Only Calendar', 'Your membership requires slot-based booking. Use the slot finder to book.');
            return;
        }
        // //console.log("ADDING HERE --> with ", start);

        if(start && !end){    
            // var end = new Date(start);
            // end.setHours(end.getHours() + 1); 
            // console.log("END::: ", end);            
            end = moment(start).add(1, "hour").format();
        }

        // console.log("ADD ONE : ", plane_id);
        // console.log("ADD ONE : ", start);
        // console.log("ADD ONE : ", end);

        

        if(vm.action == "list" || vm.action == "add"){
            console.log("add it yeah");
            vm.add_booking_event({"start": start, "plane_id": plane_id, "end": end, "resourceObj": resourceObj});
        } else if (vm.action == "edit") {
            $state.go('dashboard.add_booking', {"start": start, "plane_id": plane_id, "end": end});
        } else {

        }
        //IF ALREADY ON HERE --> 

        //OTHERWISE BELOW
            //alert(end);
        // $state.go('dashboard.add_booking', {"start": start, "plane_id": plane_id, "end": end});



    }

    $scope.cancel_changes = function(){
        $state.go('dashboard.add_booking');
    }

    $scope.check_rental_items = function(){
        generate_datetimes();

        vm.rental_items = [];

        if(vm.new_booking.plane){

            var club_id = (vm.new_booking.edit_booking == 1) ? vm.new_booking.club_id : vm.new_booking.plane.club_id;
            // var start_datetime = luxon.DateTime.fromISO( new Date(vm.new_booking.start_datetime) ).toISO();
            // var end_datetime = luxon.DateTime.fromISO( new Date(vm.new_booking.end_datetime) ).toISO();

            var start_datetime = vm.new_booking.start_datetime;
            var end_datetime = vm.new_booking.end_datetime;

            BookingService.GetRentalItems(club_id, start_datetime, end_datetime, 0)
            .then(function(data){
           
                vm.rental_items = data;

                if(vm.new_booking.rental_items){
                    //then we may have shizzle to check / update
                    for(var i=0;i<vm.new_booking.rental_items.length;i++){
                        //first and foremost we need to check the available bits....
                        var found = 0;
                        for(var j=0;j<vm.rental_items.length;j++){
                            if(vm.rental_items[j]["id"] == vm.new_booking.rental_items[i]["id"]){
                                //then we need to check that the current numbers available are still the same as before...
                                if(parseInt(vm.new_booking.rental_items[i]["number_to_book"]) > parseInt(vm.rental_items[j]["number_available"])){
                                    vm.new_booking.rental_items[i]["number_to_book"] = parseInt(vm.rental_items[j]["number_available"]);
                                }
                                vm.new_booking.rental_items[i]["number_available"] = parseInt(vm.rental_items[j]["number_available"]);
                                found = 1;
                                break;
                            }
                        }
                        if(found == 0){
                            //then we need to remove it...
                            delete vm.new_booking.rental_items[i];
                        }

                    }

                }


                for(var k=0; k<vm.rental_items.length;k++){
                    vm.rental_items[k].number = 0;
                }

                //if there is one already selected?
                //check if anything was already selected...
                if(vm.new_booking.rental_items){
                    for(var j=0; j<vm.new_booking.rental_items.length; j++){
                        var reset_chosen = 1;
                        for(var i = 0; i<vm.rental_items.length; i++){
                            if(vm.rental_items[i].id == vm.new_booking.rental_items[j].id){
                                reset_chosen = 0;
                                //chosen is still available WOOOO
                            }
                        }
                        if(reset_chosen == 1){
                            //then we just need to clear currently selected plane
                            delete vm.new_booking.rental_items[j];
                        }
                    }
                    //otherwise we can leave that we've already done! :)
                }




            });

        }
    }

    function check_times(clean_type = null){

            var c = new Date();
            var a = (vm.new_booking.start_time) ? vm.new_booking.start_time.time.split(":") : [c.getHours(), c.getMinutes()];
            var b = new Date(vm.new_booking.start_date);
            b.setHours(a[0]);
            b.setMinutes(a[1]);
            b.setSeconds(0);
            var future = moment(b).add(1, "hour").format();

            //check if the end_time is set && if the end time is > start time...
            if(start_after_end() || !vm.new_booking.end_time){

                clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);

                var id;
                // vm.end_times.forEach(function(time, i){ 
                //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                // });
                vm.end_times.some(function(time, i){ 
                  if(time.time == moment(future).format("H:mm")){ id = i; return true;};  
                });

                vm.new_booking.end_time = {};
                vm.new_booking.end_time = vm.end_times[id];

            } else {
                if(!clean_type){
                    clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);
                } 
            }


             //need to update the selection of the end time if this has been set
            if(vm.new_booking.end_time && vm.new_booking.end_time.disabled == 1){

                var id;
                //used to use a forEach loop but decided to run a some loop instead due to the benefit of not going through all elements
                // vm.end_times.forEach(function(time, i){ 
                //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                // });
                vm.end_times.some(function(time, i){ 
                  if(time.time == moment(future).format("H:mm")){ id = i; return true;};  
                });

                vm.new_booking.end_time = {};
                vm.new_booking.end_time = vm.end_times[id];

            }

            if(vm.new_booking.start_time && vm.new_booking.start_time.disabled == 1){
                if(!clean_type){
               
                var id;
                vm.start_times.some(function(time, i){ 
                  if(time.disabled == 0){ id = i; return i;}; 
                });

                vm.new_booking.start_time = {};
                vm.new_booking.start_time = vm.start_times[id];
                 } 

                calculate_duration();
            }
    }

    $scope.update_dateTime = function(which_update, params=null){

        ////console.log("UPDATE TIME HERE", which_update);

        switch(which_update){

            case 'start_date':

                booking_today();

                if(vm.new_booking.start_date > vm.new_booking.end_date){
                    vm.new_booking.end_date = vm.new_booking.start_date;
                }

                clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');

                check_times();

                if(start_after_end()){
                    add_hour_to_end();
                }

            break;

            case 'end_date':

                 booking_today();
                
                check_times();

                if(vm.new_booking.end_date < vm.new_booking.start_date){
                    vm.new_booking.start_date = vm.new_booking.end_date;
                    clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                } else {
                    clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                    clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times');
                }

                if(start_after_end()){
                    add_hour_to_end();
                }


            break;

            case 'start_time':

                // alert("start_time");
                //do we need to clean the times? if so.. 
                booking_today();

                check_times();

                //we need to calculate the time in between the start and the end!
                calculate_duration();
                

            break;

            case 'end_time':
                // vm.times_clean_type = "start_times";
                // if(moment(vm.new_booking.start).unix() < moment().unix()){
                //     vm.times_clean_type = "past";
                // }
                if(vm.times_clean_type == "past"){
                    //alert("end_time");
                    check_times("edit");
                } else {
                    check_times();
                }


            break;

            case 'edit':
                //alert("edit - 1");

                // //this is the edit function that needs to be setup.
                // booking_today();

                // //number 1 = we have set start and end of the current date....
                // // setTimeout(function(){
                // //     check_times();
                // //     // calculate_duration();
                // // }, 5000);
                // //console.log("ASD ",vm.new_booking.start_date);
                // // clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                // check_times();
                // calculate_duration();
                //alert("EDIT 1");

                vm.is_edit_show_all = true;
 //start_times
                vm.times_clean_type = "start_times";
                if(moment(vm.new_booking.start).unix() < moment().unix()){
                    vm.times_clean_type = "past";
                    //clean_times(check_relative_date(vm.new_booking.start_date), "end_times");
                                


                } else {
                                check_times();
                    booking_today();
                }
                calculate_duration();

                setTimeout(function(){
                    //do we need to clean the times? if so.. 
                    // pre_select_value_id("start_times", vm.new_booking.start_time);
                    pre_select_value_id();
                    //we need to calculate the time in between the start and the end!
                }, 500);




                //we need to set the previously selected plane here...


            break;

            case 'edit2':
                //alert("edit2");
                // //this is the edit function that needs to be setup.
                // booking_today();

                // //number 1 = we have set start and end of the current date....
                // // setTimeout(function(){
                // //     check_times();
                // //     // calculate_duration();
                // // }, 5000);
                // //console.log("ASD ",vm.new_booking.start_date);
                // // clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                // check_times();
                // calculate_duration();

                booking_today();

                clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');

                check_times();

                calculate_duration();

                setTimeout(function(){
                    //do we need to clean the times? if so.. 
                    // pre_select_value_id("start_times", vm.new_booking.start_time);
                    pre_select_value_id();
                    //we need to calculate the time in between the start and the end!

                     // (instructor-first bookings pick their aircraft through
                     // vm.onInstructorPlaneSelected — the v2 ?instructor_id hand-off)
                     if(params && !vm.instructor_first_booking){
                        // alert("plane");
                        // alert(params);
                        // //console.log("SELECT ME ", vm.planes);
                                for(var i=0;i<vm.planes.length;i++){
                                    // //console.log("I", i);
                                    // //console.log("id 1", vm.planes[i].id);
                                    // //console.log("I", i);
                                    if(parseInt(vm.planes[i].id) == params){
                                        vm.new_booking.plane = vm.planes[i];
                                        $scope.getPlaneInstructors(vm.new_booking.plane.id);
                                         ////console.log("found", vm.new_booking);
                                         $scope.$apply();
                                    }
                                }
                    }
                    
                }, 500);




                //we need to set the previously selected plane here...


            break;


        }


        //an update on the form would require an update of the plane / waiting lists available
        // Skip plane availability check in instructor-first flow — planes are already filtered by instructor
        if(!vm.instructor_first_booking){
            $scope.check_plane_availability();
        }

        if(vm.new_booking.plane){
            //then we check what is available for these guys!
            $scope.check_rental_items();
        }

        //if the plane was already selected - then we can also update the instructors so as to not require
        //the user to have to re-select the plane
        if(vm.new_booking.plane && !vm.instructor_first_booking){
            $scope.getPlaneInstructors();
        }




        if(vm.new_booking.plane){
            //let's update the visual representation of the booking on the right hand side
            var booking_start = vm.new_booking.start_date;
            var s_date = moment(vm.new_booking.start_date).format("Y-MM-DD");
            var s_time = vm.new_booking.start_time.time;
            // //console.log("HERE : ", s_date);
            // //console.log("HERE : ", s_time);
            var n_start = moment(s_date + " " + s_time);

            var e_date = moment(vm.new_booking.end_date).format("Y-MM-DD");
            var e_time = vm.new_booking.end_time.time;
            var n_end = moment(e_date + " " + e_time);

            // //console.log("HERE : ", n_start);
            // //console.log("START HERE + ", vm.new_booking.start_date);
            // //console.log("END HERE + ", vm.new_booking.end_date);
            var new_event = {
                                 "id":"TEMP",
                                 "title":"TEMPORARY",
                                 "resourceId": parseInt(vm.new_booking.plane.id),
                                 "start":n_start,
                                 "end":n_end,
                                 "editable":false,
                                 "color":"rgb(255, 110, 110)",
                                 "opacity":"1"
                              };
                       

            if(vm.already_added_temp){

                    $('#calendar').fullCalendar("removeEvents", "TEMP")
                    setTimeout(function(){
                        $('#calendar').fullCalendar('renderEvent', new_event);
                    }, 150);


            } else {


               
                $('#calendar').fullCalendar('renderEvent', new_event);
                vm.already_added_temp = true;
                                            


            }
        }















    }




    function pre_select_value_id(){

        vm.start_times.forEach(function(times, i){
            // //console.log(times.time+" == "+vm.new_booking.start_time.time);
            if(times.time == vm.new_booking.start_time.time){
                // //console.log("THIS I ", i);
                vm.new_booking.start_time = vm.start_times[i];
            }

        });
        // //console.log("END", vm.end_times);

         vm.end_times.forEach(function(times, i){

            if(times.time == vm.new_booking.end_time.time){
                // //console.log("THIS I ", i);
                vm.new_booking.end_time = vm.end_times[i];
            }

        });

        $scope.$apply();

    }

    vm.decline_new_booking_error = function(){
        vm.new_booking_errors = {};
        if(vm.is_v2){ return; }   // no embedded calendar (nor its `all_events` global) on the v2 panel
        $('#calendar').fullCalendar('removeEvents');
        $('#calendar').fullCalendar('addEventSource', all_events);
    }

    vm.override_new_booking_errors = function(){
        vm.new_booking.admin_override = true;
        vm.new_booking.override_overbooking = 1;   // the member-already-booked check reads this (admin_override is honoured too)
        vm.new_booking.override = 1;
        vm.new_booking_errors = {};
        $scope.make_booking(true);
    }

    // Force a NEW booking through a hard regulatory/safety block (grounded
    // aircraft, lapsed insurance, expired ARC/CofA). force_override is honoured
    // only for managers/super-admins on a hard_block — safe to always send.
    vm.force_new_booking_errors = function(){
        vm.new_booking.admin_override = true;
        vm.new_booking.force_override = true;
        vm.new_booking.override = 1;
        vm.new_booking_errors = {};
        $scope.make_booking(true);
    }





    $scope.update_booking = function(valid){


        //alert("UPDATE");

        generate_datetimes();

        if(valid){

                // //console.log("VALID SUBMISSION");
                // //console.log("START", vm.new_booking.start_datetime);
                // //console.log("END", vm.new_booking.end_datetime);

                var booking = {};
                var booking = jQuery.extend(true, {}, vm.new_booking); 
                // //console.log(booking);
                delete booking.options;
                delete booking.instructor;
                delete booking.plane;
                delete booking.start_date;
                delete booking.start_time;
                delete booking.end_date;
                delete booking.end_time;
                delete booking.start_datetime;
                delete booking.end_datetime;
                delete booking.tuition_required;
                delete booking.after_booking_end;
                // //console.log(booking);
                // //console.log(vm.new_booking);
                booking.free_seats = (vm.new_booking.free_seats && vm.new_booking.free_seats.constructor === Array) ? 0 : (vm.new_booking.free_seats || 0);
                booking.start = vm.new_booking.start_datetime;
                booking.end = vm.new_booking.end_datetime;

                if(vm.new_booking.tuition_required && vm.new_booking.tuition_required.id > 0){
                    booking.course_id = vm.new_booking.tuition_required.id;
                }

                bkf_lesson_payload(booking);
                bkf_solo_payload(booking);

                booking.maintenance_flight = vm.new_booking.maintenance_flight;


// Date.parse(vm.new_booking.start_datetime)

                if(!isWithinEditWindow(vm.new_booking.end_datetime)){
                    ToastService.error("Cannot Amend", "The edit window for this booking has passed — you can no longer amend it.");
                    return false;
                }
                //30 mintues leeway in case of booking starting within the 15 minute period or similar
                // if(moment(vm.new_booking.start_datetime).add(30, "minutes") < moment()){
                //     alert("This booking starts in the past - you cannot create a booking in the past.");
                //     return false;
                // }


                // //console.log("START", booking.start);
                // //console.log("END", booking.end);

                ////console.log("PLANE", vm.new_booking.plane);
                booking.resourceId = vm.new_booking.plane.id;

                if(vm.new_booking.plane.id.toString().indexOf("w") > -1){
                    booking.changed_to_waiting_list = true;
                    booking.resourceId = vm.new_booking.plane.id.slice(0, -1);
                }

                if(!vm.booking_self){
                    booking.user_id = vm.new_booking.user.user_id || vm.new_booking.user.id;
                    booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;
                } else {
                    booking.user_id = vm.user.id;
                    booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;
                }
                
                console.log("vm.new_booking.plane", vm.new_booking);

                booking.plane_id = vm.new_booking.plane.id;
                booking.override = (vm.new_booking.override) ? vm.new_booking.override : 0;
                booking.club_id = vm.new_booking.club_id;

                // //console.log("====> booking to be sent = ", booking);

                check_before_changing_event(booking);

        }

    }

    $scope.update_club = function(){
            console.log("we changed club here");
            vm.club_id = vm.change_club.id;
                // //console.log("CLUB ID IS :", vm.club_id);
                if(vm.user.access.instructor.indexOf(vm.club_id) > -1 || vm.user.access.manager.indexOf(vm.club_id) > -1){
                    // //console.log("THIS IS AN INSTRUCTOR/MANAGER IN THIS CLUB...");
                    vm.booking_self = false;
                    vm.is_restricted_member = false; // instructors/managers always have full access
                } else {
                    vm.booking_self = true;
                    // Re-check free booking rights for the newly selected club
                    vm.is_restricted_member = false;
                    MemberService.GetOneForUser(vm.user.id)
                    .then(function(memberData){
                        var memberships = memberData.memberships || memberData;
                        if(Array.isArray(memberships)) {
                            for(var i = 0; i < memberships.length; i++) {
                                if(parseInt(memberships[i].club_id) === parseInt(vm.club_id)) {
                                    if(memberships[i].free_booking == 0 || memberships[i].free_booking === false) {
                                        vm.is_restricted_member = true;
                                        vm.bookingPanelOpen = false;
                                    }
                                    break;
                                }
                            }
                        }
                    });
                }
            //now we need to update the planes the user can see on the calendar! 
            update_bookings();

    }

    function update_bookings(){


         // BookingService.GetAllUserClub(vm.user.id,vm.club_id, moment().format("Y-M-D"), "")
         //        .then(function(data){
                   
         //            $scope.all_events = data.events;
         //            $scope.all_resources = data.resources;

         //        });

         // //console.log("UPDATE BOOKINGS ");
         $scope.calendar_loading = true;

         BookingService.GetAll(vm.user.id, moment().format("Y-MM-DD"), "")
        .then(function(data){
            // //console.log(data);

            $scope.calendar_loading = false;

            $scope.all_events = data.events;
            $scope.all_resources = data.resources;

            // Capture schedule_version if returned by backend
            if (data.schedule_version !== undefined) {
                _scheduleVersion = data.schedule_version;
            }

            // Start polling once we have initial data
            _startSchedulePolling();

            // //console.log("hello", $scope.all_events);
            // //console.log("hello", $scope.all_resources);

            return data;

        });

    }

    /* alert on eventClick */
    $scope.alertOnEventClick = function( date, jsEvent, view){
        //alert("cliekd ");
        $scope.alertMessage = (date.title + ' was clicked ');
        // //console.log("HELLO BOOBIES");
        // //console.log(event);
        //show event details

    };

    /* alert on Drop */
     $scope.alertOnDrop = function(event, delta, revertFunc, jsEvent, ui, view){

        // Block drag for read-only (restricted) members
        if (vm.is_restricted_member) { revertFunc(); return; }

        if(event.resourceId){
            if(event.resourceId.toString().indexOf("w") > -1){
                event.changed_to_waiting_list = true;
                event.resourceId = event.resourceId.slice(0, -1);
            }
        } else if(event.resourceIds){
            for(var i=0;i<event.resourceIds.length;i++){
                if(event.resourceIds[i].toString().indexOf("w") > -1){
                    event.changed_to_waiting_list = true;
                    event.resourceIds[i] = event.resourceIds[i].slice(0, -1); //remove the w and set as w?
                }
            }

        }

        // Update the event's plane data to match the new aircraft resource
        // so that badges (registration on instructor rows) reflect the change immediately
        var newPlaneId = null;
        if (event.resourceId && event.resourceId.toString().indexOf('fi_') === -1) {
            newPlaneId = event.resourceId;
        } else if (event.resourceIds) {
            for (var j = 0; j < event.resourceIds.length; j++) {
                if (event.resourceIds[j].toString().indexOf('fi_') === -1) {
                    newPlaneId = event.resourceIds[j];
                    break;
                }
            }
        }
        if (newPlaneId && $scope.all_resources) {
            for (var k = 0; k < $scope.all_resources.length; k++) {
                if ($scope.all_resources[k].id && $scope.all_resources[k].id.toString() === newPlaneId.toString()) {
                    if (!event.plane) event.plane = {};
                    event.plane.id = newPlaneId;
                    event.plane.registration = $scope.all_resources[k].title || $scope.all_resources[k].registration || '';
                    break;
                }
            }
        }

        // //console.log("HELLO BOOBIES", event);


        check_before_changing_event(event);
       
    };


    /* alert on Resize */
    $scope.alertOnResize = function(event, delta, revertFunc, jsEvent, ui, view ){

        // Block resize for read-only (restricted) members
        if (vm.is_restricted_member) { revertFunc(); return; }

        check_before_changing_event(event);

    };



    $scope.override_booking_change = function(override){

        vm.error_event[override] = true;
        vm.error_event.override = 1;

        check_before_changing_event(vm.error_event, true);


    }

    $scope.override_booking_change2 = function(override){

        vm.error_event.admin_override = true;
        vm.error_event.override = 1;
        if(override){
            vm.error_event[override] = true;
        }

        check_before_changing_event(vm.error_event, true);


    }

    // Force override — pushes through a HARD regulatory/safety block (grounded
    // aircraft, lapsed insurance, expired ARC/CofA). Sends force_override:true on
    // top of admin_override. The backend only honours force_override for
    // managers/super-admins on a hard_block conflict; ignored otherwise, so it's
    // safe to always include it here.
    $scope.force_booking_change = function(override){

        vm.error_event.admin_override = true;
        vm.error_event.force_override = true;
        vm.error_event.override = 1;
        if(override){
            vm.error_event[override] = true;
        }

        check_before_changing_event(vm.error_event, true);

    }

    // Map an airworthiness_warning reason code to a friendly label.
    function airworthinessLabel(reason){
        switch(reason){
            case 'aircraft_grounded':     return "grounded / out of service";
            case 'aircraft_unavailable':  return "unavailable for booking";
            case 'insurance_expired':     return "insurance lapsed";
            case 'arc_expired':           return "ARC expired";
            case 'airworthiness_expired': return "certificate of airworthiness expired";
            default:                      return reason;
        }
    }

    // Under the "warn" club policy the booking responses (create/edit, on both
    // success and conflict) may carry airworthiness_warning:"<reason>". Show a
    // non-blocking notice — it does NOT prevent the booking proceeding.
    function showAirworthinessWarning(data){
        if(!data || !data.airworthiness_warning) return;
        ToastService.warning(
            'Airworthiness / Insurance Notice',
            'This aircraft currently has an issue (' + airworthinessLabel(data.airworthiness_warning) + ') which may be resolved before your booking.'
        );
    }
    vm.showAirworthinessWarning = showAirworthinessWarning;

    $scope.decline_booking_change = function(){

        vm.booking_errors = {};
        vm.error_event = {};
        if(vm.is_v2){ return; }   // no embedded calendar (nor its `all_events` global) on the v2 panel
        $('#calendar').fullCalendar('removeEvents');
        $('#calendar').fullCalendar('addEventSource', all_events);

    }


    function check_before_changing_event(event, err=null){
        //the important bit is the eventID 

       if(err){
         vm.booking_errors = {};
            vm.error_event = {};
       }

        var evnt = jQuery.extend({}, event);

        // evnt.start = moment(evnt.start).format("YYYY-MM-DD HH:mm");
        // evnt.end = moment(evnt.end).format("YYYY-MM-DD HH:mm");
        
        // console.log("here");

        //this covers the change of plane for the booking...
        if(event.resourceId && event.resourceId !== ""){
            evnt.plane_id = event.resourceId;
        } else if(event.resourceIds && event.resourceIds.length > 0){
            for(var i=0;i<event.resourceIds.length;i++){
                if(event.resourceIds[i].indexOf("fi") == -1){
                    evnt.plane_id = event.resourceIds[i];
                }
            }
        } else {
            console.log("EVENT HAS AN ISSUE WITH RESORUCE ID...");
        }
        
        if(event.instructor_id !== ""){
            evnt.instructor_id = event.instructor_id;
        } else {
            evnt.instructor_id = "0";
        }
        //updatable bits:

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
        delete evnt.resourceId;
        delete evnt.resourceIds;
        evnt.update_rental_items = true;

        // //console.log("EVENT CHANGE", evnt);

        var original_event;
        for(var i=0; i<$scope.all_events.length;i++){
            if($scope.all_events[i].id == evnt.id){
                original_event = $scope.all_events[i];
                // //console.log("original EVENT", original_event);
            }
        }


        // //console.log("original end: ", moment(original_event.end).unix());
        // //console.log("new end is : ", evnt.end.unix());

        // //console.log("1original start: ", original_event.start);
        // //console.log("1new start is : ", evnt.start);

        // //console.log("2original start: ", moment(original_event.start).unix());
        // //console.log("2new start is : ", evnt.start.unix());

        // //console.log("1original start again: ", original_event.start);


        //event in the past cannot be amended AFTER the booking - but the booking can be exte

        // //console.log("all_events", $scope.all_events);

        if(!isWithinEditWindow(evnt.end)){
            ToastService.error("Cannot Amend", "The edit window for this booking has passed — you can no longer amend it.");
            return false;
        }
        // 30 mintues leeway in case of booking starting within the 15 minute period or similar
        if(moment(evnt.start).add(30, "minutes") < moment()){
                // //console.log("start is older than 30 minutes ago");
                // //console.log("1original start again: ", original_event.start);

            if(moment(original_event.end) !== evnt.end){
                // //console.log("end is not the same end");
                // //console.log("original end: ", moment(original_event.end).unix());
                // //console.log("new end is : ", evnt.end.unix());

                var p = confirm("This booking starts in the past - you cannot amend the start date or time of a booking in the past, would you like to amend the end time along with any other changes you have made?");
                if(p){  
                    // //console.log("START UPDATE = ",evnt.start );
                    evnt.start = original_event.start;
                    // //console.log("START UPDATE = ",evnt.start );
                } else {
                    return false;
                }

            }




            //let's reset the booking'start time

           




           // return false;
        }

        // //console.log("UPDATE CONTENT BEFORE", evnt);

        BookingService.updateBooking(evnt, vm.user.id)
        .then(function(data){
            // //console.log(data);

            if(data.success == true){
                // //console.log("the booking did not need to be altered and has been updated successfully.", evnt);

                //only if the edition is being made from the "edit" otherwise the changes are already reflected appropriately.
                if(evnt.edit_booking == 1){
                    //$scope.$parent.updateEvents(evnt.start, evnt.end);
                }
                
                ToastService.success("Changes Saved", "Your changes were saved successfully.");
                showAirworthinessWarning(data);

                if(vm.return_to == "bookout") {
                    // //console.log("WE ARE AT THE BOOKOUT BIT - SO RETURN THERE!!!");
                    $state.go('dashboard.my_account.bookout_with_booking', { "booking_id": event.id });
                } else if(evnt.edit_booking == 1 && vm.is_v2) {
                    // Scheduler v2 panel — back to the scheduler on the booking's day
                    vm.v2_close(true, evnt.start);
                } else if(evnt.edit_booking == 1) {
                    // Form-based edit — navigate back to the booking view
                    $state.go('dashboard.add_booking');
                } else {
                    // Drag/drop or resize on the calendar — update local events from server
                    // so the calendar reflects the saved position without a full controller reload
                    var fetchStart = moment(evnt.start).format("Y-MM-DD");
                    BookingService.GetAll(vm.user.id, fetchStart, "")
                        .then(function(freshData){
                            $scope.all_events = freshData.events;
                            $scope.all_resources = freshData.resources;

                            $('#calendar').fullCalendar('removeEvents');
                            $('#calendar').fullCalendar('addEventSource', $scope.all_events);
                        });
                }



            } else {
                if(vm.is_v2 && data.error === 'DOUBLE_BOOKING_NOT_ALLOWED'){
                    bkf_double_booking_toast(data);
                    return;
                }
                //display the error
                //console.log("The booking cannot remain the same due to : "+data.message);

                //hollow :::     $("#calendar").fullCalendar('refetchEvents');


                //I have decided to do this as a sequential check / accept / decline as opposed to combined
                //this can be altered at a later date to be combined, with accept / decline on each error
                //but this is more work than i can do right now!

                // Build one error per failed check. Each check is INDEPENDENT — a
                // field is only a failure when the backend actually returned it AND
                // it isn't `true`. (Previously rental_items was chained as an
                // `else if` off check_user and wasn't presence-guarded, so a
                // response like { instructor:"is not available", check_user:true }
                // — with no rental_items key — wrongly showed "rental items not
                // available". Each failure now maps to exactly what the API sent.)
                var errors = [];
                var failed = function(v){ return v !== undefined && v !== null && v !== true; };

                // Three override tiers, driven by the backend's top-level flags
                // (can_override / hard_block / can_force_override):
                //   1. Soft conflict  → can_override:true  → normal Override (admin_override).
                //      Overridable by managers, super-admins and instructors.
                //   2. Hard block     → can_override:false + can_force_override:true →
                //      a regulatory/safety block (grounded, lapsed insurance, expired
                //      ARC/CofA). Hide normal override; show a stronger warning naming
                //      the reason + a Force button for managers/super-admins only
                //      (force_override).
                //   3. No path        → can_override:false, no can_force_override →
                //      hide both (non-privileged users on a hard block, or
                //      non-overridable failures like edit-window/permission).
                // (Currency/account issues keep their own gating further below.)
                var acc = (vm.user && vm.user.access) || {};
                // Use the club of the booking being edited (falls back to the current
                // club context). Access arrays may hold IDs as numbers OR strings (the
                // codebase is inconsistent) and the club id can be either too, so match
                // on the string form of both sides — a type mismatch here would hide
                // the override/force buttons from a genuine admin.
                var ovClubId = (evnt && evnt.club_id) || (event && event.club_id) || vm.club_id;
                var inArr = function(a){
                    if(!a) return false;
                    var want = String(ovClubId);
                    for(var i=0;i<a.length;i++){ if(String(a[i]) === want) return true; }
                    return false;
                };
                var isManager    = inArr(acc.manager);
                var isSuperAdmin = inArr(acc.super_admin);
                var isInstructor = inArr(acc.instructor);

                // Soft override: backend allowed it and the user is privileged enough.
                var canOverride = (data.can_override === true) && (isManager || isSuperAdmin || isInstructor);
                // Force: hard block, backend allows forcing, and the user is a
                // manager/super-admin (instructors can never force).
                var canForce = (data.can_override === false) && (data.can_force_override === true) && (isManager || isSuperAdmin);

                var hardBlockMessage = function(){
                    switch(data.hard_block){
                        case 'aircraft_grounded':     return "This aircraft is currently grounded and must not be flown.";
                        case 'aircraft_unavailable':  return "This aircraft is marked unavailable and cannot be booked.";
                        case 'insurance_expired':     return "This aircraft's insurance has expired.";
                        case 'arc_expired':           return "This aircraft's Airworthiness Review Certificate (ARC) has expired.";
                        case 'airworthiness_expired': return "This aircraft's airworthiness / Certificate of Airworthiness has lapsed.";
                        default:                      return "This aircraft cannot be booked due to a safety or regulatory restriction.";
                    }
                };

                // Common override metadata applied to availability conflicts.
                function overrideMeta(){
                    return {
                        can_override: canOverride,
                        is_hard_block: !!data.hard_block,
                        hard_block: data.hard_block || null,
                        can_force: canForce
                    };
                }

                if(failed(data.instructor)){
                    errors.push(angular.extend({
                        type: "instructor",
                        message: data.hard_block ? hardBlockMessage() : "The instructor is not available for the updated date and time.",
                        api: data.instructor,
                        override: "instructor_override",
                        button: canOverride ? "OVERRIDE INSTRUCTOR AVAILABILITY" : "",
                        force_button: "FORCE BOOKING ANYWAY"
                    }, overrideMeta()));
                }

                if(failed(data.plane)){
                    errors.push(angular.extend({
                        type: "plane",
                        message: data.hard_block ? hardBlockMessage() : "The aircraft is not available for the updated date and time.",
                        api: data.plane,
                        override: "plane_override",
                        button: canOverride ? "OVERRIDE AIRCRAFT AVAILABILITY" : "",
                        force_button: "FORCE BOOKING ANYWAY"
                    }, overrideMeta()));
                }

                if(failed(data.check_user)){
                    // check_user is a message string from the backend; self-certify
                    // currency issues can be overridden, others cannot.
                    var checkStr = (typeof data.check_user === 'string') ? data.check_user : '';
                    if(checkStr.indexOf("self-certify") > -1){
                        errors.push({
                            type: "check_user",
                            message: "It would appear that you are not within the currency requirements to book this aircraft for this flight.",
                            api: data.check_user,
                            override: "currency_override",
                            can_override: data.can_override,
                            button: "I am Current"
                        });
                    } else {
                        errors.push({
                            type: "check_user",
                            message: "Your user account does not allow this booking.",
                            api: data.check_user,
                            override: "currency_override",
                            can_override: data.can_override,
                            button: ""
                        });
                    }
                }

                if(failed(data.rental_items)){
                    errors.push({
                        type: "rental_items",
                        message: "Some of the rental items are not available.",
                        api: data.rental_items,
                        override: "update_rental_items",
                        can_override: data.can_override,
                        button: "Confirm Changes"
                    });
                }


                //show the errors:::

                // If the backend returned a simple message (e.g. edit window expired), show it directly
                if (errors.length === 0 && data.message) {
                    ToastService.error('Cannot Edit Booking', data.message);
                }

                // Non-blocking airworthiness/insurance notice (warn policy) — shown
                // alongside any conflict errors.
                showAirworthinessWarning(data);

                vm.booking_errors = errors;
                // Name the outcome ourselves: the write-guard would otherwise add a generic
                // "Not saved" toast next to the conflict popup (success:false, no handled code).
                if (errors.length > 0) {
                    ToastService.warning('Booking Conflict', 'Nothing saved yet - see the options below.');
                }
                //console.log("ERRORS ARE : ", vm.booking_errors);
                vm.error_event = evnt;

                //on GO--> check_before_changing_event(evnt)    


                //if CANCEL?
                //this would reset the change... do we want this?
                //$("#calendar").fullCalendar('refetchEvents');



            }

            return data;

        });

    }

    $scope.wholeDay = function(){

       if($scope.whole_day_booking == true){
            $scope.whole_day_booking = false;
            $scope.myDatetimeRange.time.from = defaultStartTime;
            $scope.myDatetimeRange.time.to = defaultEndTime;
       } else {
            $scope.whole_day_booking = true;
            $scope.myDatetimeRange.time.from = 0;
            $scope.myDatetimeRange.time.to = 1440;
       }
       

    }

    //Changing the view of the calendar
    $scope.changeView = function(view,calendar) {
      uiCalendarConfig.calendars[calendar].fullCalendar('changeView',view);
    };

    /* Change View */
    $scope.renderCalender = function(calendar) {
      $timeout(function() {
        if(uiCalendarConfig.calendars[calendar]){
          uiCalendarConfig.calendars[calendar].fullCalendar('render');
        }
      });
    };

























    /* THIS SECTION IS ABOUT THE ADD / EDIT OF THE CALENDAR EVENTS VIA THE EDIT / ADD NEW BOOKING */

    /* ADD OR EDIT THE BOOKING */

    function figure_out_steps(){
        // //console.log("OPTIONS", vm.dateTimeRangePickerOptions);
        vm.new_booking.options = vm.dateTimeRangePickerOptions;
         for(var i=0;i<24;i+=vm.new_booking.options.hour_step){

            if(vm.new_booking.options.minute_step && vm.new_booking.options.minute_step > 0){
                for(var j=0; j<(60/vm.new_booking.options.minute_step); j++){
                    var k = vm.new_booking.options.minute_step * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                    vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                }
            } else {
                vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
            }

        }
    }

    function init_times(){
       for(var i=0;i<24;i+=vm.new_booking.options.hour_step){

            if(vm.new_booking.options.minute_step && vm.new_booking.options.minute_step > 0){
                for(var j=0; j<(60/vm.new_booking.options.minute_step); j++){
                    var k = vm.new_booking.options.minute_step * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                    vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                }
            } else {
                vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
            }

        } 
    }
    

    $scope.add_rental_item = function(){
        if(vm.rental_item && vm.new_booking.rental_items && vm.rental_item.id){
            var add_to_list = 1;
            var delete_this = 0;
            for(var j=0; j<vm.new_booking.rental_items.length; j++){
                if(vm.new_booking.rental_items[j].id == vm.rental_item.id){
                    add_to_list = 0;
                    delete_this = vm.new_booking.rental_items[j];
                    // //console.log("item was already found there...");
                }
            }
            if(add_to_list == 1){
                //then its not already in teh list!
                vm.new_booking.rental_items.push(vm.rental_item);
                delete vm.rental_item;

            }

        } else {
            if(vm.rental_item){
                // //console.log("rental_item is: ", vm.rental_item);
                if(!vm.new_booking.rental_items){
                    //init here if its the first item...
                    vm.new_booking.rental_items = [];
                }
                vm.new_booking.rental_items.push(vm.rental_item);
                delete vm.rental_item;
            }
               
        }

    }


    $scope.rental_item_remove = function(id){
        //as this is before we actually do the shizzle!
        vm.new_booking.rental_items = $.grep(vm.new_booking.rental_items, function(e){ 
                return e.id != id; 
        });
    }



    $scope.getPlaneInstructors = function(){


        // //console.log("CHANGE OF PLANE HERE");

        // Determine the club from the selected plane (most reliable source)
        var booking_club_id = parseInt(vm.new_booking.plane.club_id) || vm.club_id;
        vm.club_id = booking_club_id;

        if(vm.is_v2 && vm.action != 'edit' && vm.bkf_members_club > 0 && vm.bkf_members_club !== booking_club_id && !vm.booking_self && vm.new_booking.user){
            // another club's aircraft: the picked member belongs to the previous club
            delete vm.new_booking.user;
        }
        if((vm.user.access.instructor.indexOf(booking_club_id) > -1) || (vm.user.access.manager.indexOf(booking_club_id) > -1) ){
            // //console.log("NOT BOOKING FOR SELF?");
            bkf_default_self(false);
            prepare_add_edit();
        } else {
            bkf_default_self(true);
        }

        if( vm.user.access.manager.indexOf(booking_club_id) > -1 ){
            vm.booking_admin = true;
        } else {
            vm.booking_admin = false;
        }

        // vm.init_passengers();
        $scope.check_rental_items();

         //FROM TO
        // var from = moment.utc( vm.new_booking.start_datetime ).toISOString();//luxon.DateTime.fromISO(moment(vm.new_booking.start_datetime).toISOString()).setZone("Europe/London").toFormat("YYYY-MM-DDThh:mm:ssZ");
        // var to = moment.utc( vm.new_booking.end_datetime ).toISOString();//luxon.DateTime.fromISO(moment(vm.new_booking.start_datetime).toISOString()).setZone("Europe/London").toFormat("YYYY-MM-DDThh:mm:ssZ");
        //var to = luxon.DateTime.fromISO(vm.new_booking.end_datetime).setZone("Europe/London").toFormat("YYYY-MM-DDThh:mm:ssZ");
        // console.log("FROM : ", from);
        // console.log("TO : ", to);

        var from = vm.new_booking.start_datetime;//moment.utc( vm.new_booking.start_datetime ).toISOString();//luxon.DateTime.fromISO(moment(vm.new_booking.start_datetime).toISOString()).setZone("Europe/London").toFormat("YYYY-MM-DDThh:mm:ssZ");
        var to = vm.new_booking.end_datetime;// moment.utc( vm.new_booking.end_datetime ).toISOString();//luxon.DateTime.fromISO(moment(vm.new_booking.start_datetime).toISOString()).setZone("Europe/London").toFormat("YYYY-MM-DDThh:mm:ssZ");
        

        if(vm.is_v2){
            // Who before What: the instructor list is the club's (bookings/club_instructors), keyed on the
            // aircraft's club + slot — bkf_sync_who fetches it (and the club's courses) when that key changes
            bkf_sync_who();

        } else if(vm.action == "add" || vm.action == "list"){

          
           
            var show_all = (vm.is_edit_show_all) ? 1 : ( (vm.booking_self)? 0 : 1 );
            // v2 panel: club staff always get the full list, each row annotated (available / reason / busy_with)
            if(vm.is_v2 && vm.bkf_is_staff()){ show_all = 1; }

            BookingService.GetPlaneInstructors(vm.user.id, vm.new_booking.plane.id, from, to, show_all)
            .then(function(data){
                // //console.log(data);
                // //console.log("NEW INSTRUCTORS ARE : ", data);
                vm.instructors = data;

                var reset_chosen = 1;
                if(vm.new_booking.instructor){
                    for(var i = 0; i<vm.instructors.length; i++){
                        // Match on id or user_id to handle instructor-first bookings
                        if(vm.instructors[i].id == vm.new_booking.instructor.id || vm.instructors[i].user_id == vm.new_booking.instructor.user_id){
                            reset_chosen = 0;
                            // Update the instructor reference to the full API object
                            vm.new_booking.instructor = vm.instructors[i];
                        }
                    }
                    if(reset_chosen == 1){
                        //then we just need to clear currently selected plane
                        vm.new_booking.instructor = {};
                        delete(vm.new_booking.instructor);
                    }
                    //otherwise we can leave that we've already done! :)
                }

                free_places();
            });


        } else {
            //must be edit... sooooooo
            var show_all = (vm.is_edit_show_all) ? 1 : ( (vm.booking_self)? 0 : 1 );
            //(vm.booking_self)? 0 : 1
            if(vm.is_v2 && vm.bkf_is_staff()){ show_all = 1; }
            BookingService.GetPlaneInstructorsEdit(vm.user.id, vm.new_booking.plane.id, from,  to, show_all, vm.new_booking.id)
            .then(function(data){
                // //console.log(data);
                // //console.log("NEW INSTRUCTORS ARE : ", data);


                vm.instructors = data;

                var reset_chosen = 1;
                if(vm.new_booking.instructor){
                    for(var i = 0; i<vm.instructors.length; i++){
                        if(vm.instructors[i].id == vm.new_booking.instructor.id){
                            reset_chosen = 0;
                        }
                    }
                    if(reset_chosen == 1){
                        //then we just need to clear currently selected plane
                        vm.new_booking.instructor = {};
                        delete(vm.new_booking.instructor);
                    }
                    //otherwise we can leave that we've already done! :)
                }
                free_places();
            });

        }


        // InstructorCharges.GetByClubId(vm.new_booking.plane.club_id)
        //         .then(function(data){
        //             vm.instructor_charges = data.items;  
        //             ////console.log("====> ", data); 
        //         });

         if(!vm.is_v2) CourseService.GetCoursesByClubId(vm.new_booking.plane.club_id || vm.club_id)
                    .then(function(data){
                        vm.courses = CourseService.sortByDisplayOrder(data.items);

                        // Re-select tuition_required from the new courses array
                        // so the ui-select object reference matches
                        if(vm.new_booking.course_id){
                            var found = vm.courses.find(function(course) {
                                return course.id == vm.new_booking.course_id;
                            });
                            if(found){
                                vm.new_booking.tuition_required = found;
                            }
                        } else if(vm.new_booking.tuition_required && vm.new_booking.tuition_required.id){
                            var found = vm.courses.find(function(course) {
                                return course.id == vm.new_booking.tuition_required.id;
                            });
                            if(found){
                                vm.new_booking.tuition_required = found;
                            }
                        }
                    });


        // //console.log("vm.new_booking.plane.club_id", vm.new_booking.plane.club_id);
        // //console.log("vm.new_booking.plane.club_id", vm.user.access.instructor);
        // //console.log("INDEX :: ", vm.user.access.instructor.indexOf(parseInt(vm.new_booking.plane.club_id)));
        
        // if(vm.user.access.instructor.indexOf(parseInt(vm.new_booking.plane.club_id)) > -1){
        //     //console.log("THIS IS AN INSTRUCTOR IN THIS CLUB...");
        //     vm.booking_self = false;
        // }



        var end_dt = new Date(vm.new_booking.end_datetime);
        

        //if is_current getPlaneInstructors
        BookingService.GetIfCurrent(vm.user_id, vm.new_booking.plane.id, moment(end_dt).format("YYYY-MM-DDTHH:mm:ss"))
        .then(function (data) {
            ////console.log(data);
            if(data.success){
                //use GB airfields first...
                vm.is_current = data.is_current;
                // //console.log("CURRENCY ", vm.is_current);

                vm.currency_type = data.requirements.currency_type;
                vm.currency_days = data.requirements.currency_days;
            } else {
            }
        });
        

        

    }


    function free_places(){
        // //console.log("UPDATE FREE PLACES...", vm.new_booking.passengers.length);
        // //console.log("UPDATE FREE PLACES...", vm.new_booking.instructor);

        vm.free_seats = [];
        console.log("NEW_BOOKING - PLANE: ", vm.new_booking.plane);
        // no aircraft yet (the v2 panel picks the instructor BEFORE the aircraft): nothing to count
        if(!vm.new_booking.plane){ return; }
        var seats = parseInt(vm.new_booking.plane.seats) - 1;

        if(vm.new_booking.instructor){
            if(vm.new_booking.instructor.id > 0){
                // //console.log("the instructor was selected for this flight...");
                seats--;
            }
        }

        if(vm.new_booking.passengers.length > 0){
            for(var i=0;i<vm.new_booking.passengers.length;i++){
                if(vm.new_booking.passengers[i] && vm.new_booking.passengers[i]["email"] !== ""){
                    seats--;
                }
            }
        }

        vm.free_seats = [];
        for(var i=0; i<seats;i++){
            vm.free_seats.push(i);
        }

        // //console.log("free seats now...", vm.free_seats);

        // $scope.$apply();

    }


    $scope.clear_booking = function(){
        vm.new_booking = {
            start_date: today,
            end_date: today,
            free_seats: [],
            passengers: [],
            instructor: undefined,
            options: vm.dateTimeRangePickerOptions
        };
        vm.instructor_first_booking = false;
        $scope.submitted = false;
    }

    function calculate_duration(){
        if(vm.new_booking.start_date && vm.new_booking.start_time){
            var start_datetime = new Date(vm.new_booking.start_date);
            var start_time = vm.new_booking.start_time.time.split(":");
            start_datetime.setHours(start_time[0]);
            start_datetime.setMinutes(start_time[1]);
            start_datetime.setSeconds(0);
            // //console.log("START DATETIME", start_datetime);  

            vm.end_times.forEach(function(time, i){ 
                //no need to go through each element if its not required to be shown!
                if(time.disabled == 0){

                    var end_datetime = new Date(vm.new_booking.end_date);
                    var end_time = time.time.split(":");
                    end_datetime.setHours(end_time[0]);
                    end_datetime.setMinutes(end_time[1]);  
                    end_datetime.setSeconds(0);
                    // //console.log("END DATETIME", end_datetime);  

                    var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                    //now we need to calculate the difference in datetime
                    // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                    var human_str = get_duration_str(difference);
                    // //console.log("human string", human_str);
                    if(human_str == ""){
                        vm.end_times[i].disabled = 1;
                    } else {
                        vm.end_times[i].duration = "( "+human_str+" )";
                    }


                } else {
                    vm.end_times[i].duration = "";
                }
              //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
            });
        }
    }

    vm.seats_in_plane = function(){
            free_places();

            //base
            var no_seats = vm.new_booking.plane.seats;

            //check if instructor aboard?
            if(vm.new_booking.instructor){   
                no_seats--;
            }

            //include self
            no_seats--;

            // //console.log("seats left", no_seats);


            //return final number
            return no_seats;
        }

        // vm.adding_a_member = function(){
        //     // //console.log("ADDING ONE?");
        //     //vm.init_passengers();
        //     vm.new_booking.passengers.push({
        //             first_name: "",
        //             last_name: "",
        //             email: "",
        //             status: ""
        //         });
        // }

        // vm.init_passengers = function(){
        //     var no_of_seats = vm.seats_in_plane();
        //     // var already_filled = 0;
        //     // for(var i=0;i<vm.new_booking.passengers.length;i++){
        //     //         if(vm.new_booking.passengers[i] && vm.new_booking.passengers[i]["email"] !== ""){
        //     //             already_filled++;
        //     //         }          
        //     // };
        //     // var cc = no_of_seats - already_filled;
        //     // // //console.log("CCCC seats -> ",no_of_seats);
        //     // // //console.log("CCCC already_filled -> ",already_filled);
        //     // // //console.log("CCCC -> ",cc);
        //     // if(cc > 0){
        //     if(vm.new_booking.passengers.length == 0){
        //         // console.log("original push");
        //         vm.new_booking.passengers.push({
        //             first_name: "",
        //             last_name: "",
        //             email: "",
        //             status: ""
        //         });
        //     } else {
        //         // console.log("new push");
        //         for(var i=0;i<=vm.new_booking.passengers.length;i++){
        //             // console.log("pax forloop");
        //             if(vm.new_booking.passengers[i] && vm.new_booking.passengers[i].email == '' && vm.new_booking.passengers[i].status == ''){
        //                 //all good
        //                 // console.log('we have an empty one');

        //             } else {
        //                 if(vm.new_booking.passengers.length == i){
        //                     // console.log('add new blank');
        //                     vm.new_booking.passengers.push({
        //                         first_name: "",
        //                         last_name: "",
        //                         email: "",
        //                         status: ""
        //                     });
        //                     break;
        //                 } else {
        //                     // console.log("no need?");
        //                 }
        //             }
        //         }
        //     }
            
        // }

        var setting_new_member;


        vm.invite_new_passenger = function(index){

            // //console.log("HERE");
            // //console.log(vm.new_pax);

             if(vm.new_pax && vm.new_pax.email !== "" && vm.new_pax.is_member == false){


                 //send a single invitation to join the gang....
                 vm.new_pax.invited_by = vm.user.id;


                 BookoutService.AddPassenger(vm.new_pax, $stateParams.booking_id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                       ToastService.success("Invitation Sent", "The passenger invitation has been sent.");
                        vm.update_passenger_list();
                        vm.show_new_passenger_invitation = false;
                    }
                });






             } else {
                 ToastService.error("Invalid Email", "Please enter a valid email address to send the invitation to.");
             }
           


        }





        function reset_new_pax(){
            vm.new_pax = { id: 0, email: "", first_name: "", last_name: "", is_member: false, status: "", not_found: true };
        }
        vm.add_new_passenger = function(index){

            console.log("ADD NEW PAX");
            console.log(vm.new_pax);

            if(vm.new_pax.is_member){
                // already on the booking (same account or email)? don't add twice
                var dupe = (vm.new_booking.passengers || []).some(function(px){
                    return (px.user_id && vm.new_pax.user_id && String(px.user_id) === String(vm.new_pax.user_id)) ||
                           (px.id && vm.new_pax.id && String(px.id) === String(vm.new_pax.id)) ||
                           (px.email && vm.new_pax.email && String(px.email).toLowerCase() === String(vm.new_pax.email).toLowerCase());
                });
                if(dupe){
                    ToastService.warning('Already a passenger', (vm.new_pax.first_name + ' ' + vm.new_pax.last_name).trim() + ' is already on this booking.');
                    reset_new_pax();
                    return;
                }


                //then we already have everything we need and we just invite them separately
                // var to_send = {
                //     booking_id: $stateParams.booking_id,
                //     club_id: vm.club_id
                // }
                vm.new_pax.club_id = vm.club_id;
                vm.new_pax.invited_by = vm.user.id;


                vm.new_booking.passengers.push(vm.new_pax);
                reset_new_pax();   // clear the picker so the next passenger starts from an empty field
                if(vm.is_v2){ bkf_pax_after_add(); }

                // //add passenger to booking
                // BookoutService.AddPassenger(vm.new_pax, $stateParams.booking_id)
                // .then(function (data) {
                //     // //console.log(data);
                //     if(data.success){
                       


                //         //let's call the update on the passengers
                //         vm.update_passenger_list();




                //     }
                // });




            } else {
                if(vm.is_v2){
                    var typed = bkf_pax_live_search();
                    vm.new_pax = bkf_pax_prefill(typed); vm.bkf_pax_from_text = !!String(typed || '').trim();
                }
                vm.show_new_passenger_invitation = true;
            }

           


        }


        vm.new_pax = {
                        id: 0,
                        email: "",
                        first_name: "",
                        last_name: "",
                        is_member: false,
                        status: "",
                        not_found: true
                    };



        var set_new_member = function(email, index){
            // //console.log("SET MEMBER NOW 123");
            vm.new_booking.passengers[index] = {
                                id: 0,
                                email: email,
                                first_name: "",
                                last_name: "",
                                is_member: false,
                                status: "to_invite"
                            };
            // //console.log("HELLO");
            //vm.init_passengers();
            free_places();
        }

        vm.get_pax_class = function(status, is_member){
            console.log("STATUS:: ", status);
            /*
              <i class="fa fa-envelope fastatus" ng-if="vm.new_booking.passengers[$index].status == 'to_invite'"></i>
              <i class="fa fa-envelope-open-text fastatus" ng-if="vm.new_booking.passengers[$index].status == 'invited'"></i>
              <i class="fa fa-check-square fastatus ok" ng-if="vm.new_booking.passengers[$index].status == 'member'"></i>
              <i class="fa fa-check-square fastatus ok" ng-if="vm.new_booking.passengers[$index].status == 'accepted'"></i>
              <i class="fa fa-check-square fastatus ok" ng-if="vm.new_booking.passengers[$index].is_member"></i>
              <i class="fa fa-times fastatus" ng-if="vm.new_booking.passengers[$index].status == 'declined'"></i>
    .success_pax_invitation{
    background: rgba(80, 175, 70, 0.7);
    border-radius: 10px;
    padding: 10px;
    margin: 10px 0;
}

.waiting_pax_invitation{
    background: rgba(255, 230, 108, 0.7);
    border-radius: 10px;
    padding: 10px;
    margin: 10px 0;
}

.declined_pax_invitation{
    background: rgba(217, 83, 79, 0.7);
    border-radius: 10px;
    padding: 10px;
    margin: 10px 0;
}


            */
            if(status == 'to_invite'){
                return 'waiting_pax_invitation';
            } else if(status == 'invited'){
                return 'waiting_pax_invitation';
            } else if(status == 'member'){
                return 'success_pax_invitation';
            } else if(status == 'accepted'){
                return 'success_pax_invitation';
            } else if(status == 'is_member'){
                return 'success_pax_invitation';
            } else if(status == 'declined'){
                return 'declined_pax_invitation';
            }

            if(!status && is_member){
                return 'success_pax_invitation';
            }


            return 'new_pax_invitation';
        }

        vm.new_passenger_invite_ready = function(index){

            //let's check the email address -->
             // 
            var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            
            //vm.new_pax ??
            //then add vm.new_pax to the passengers?

            if(email_regex.test(vm.new_pax.email)){

                var em = String(vm.new_pax.email).trim().toLowerCase();
                vm.new_pax.email = em;
                var already = (vm.new_booking.passengers || []).some(function(px){ return px.email && String(px.email).toLowerCase() === em; });
                if(already){
                    ToastService.warning('Already a passenger', em + ' is already on this booking.');
                    return false;
                }
                if(em === bkf_pilot_email()){
                    ToastService.warning("That's the pilot", em + ' is flying this booking, so they are not a passenger.');
                    return false;
                }
                // //console.log("SET MEMBER NOW 123");
                vm.new_pax.is_member = false;
                vm.new_pax.status = "to_invite";

                vm.new_booking.passengers.push(vm.new_pax);


                vm.new_pax = {
                    id: 0,
                    email: "",
                    first_name: "",
                    last_name: "",
                    is_member: false,
                    status: "",
                    not_found: true
                };

                // //console.log("HELLO");
                //vm.init_passengers();
               // free_places();
                vm.show_new_passenger_invitation = false;
                if(vm.is_v2){ bkf_pax_after_add(); }
            } else {
                ToastService.error("Invalid Email", "The email address appears to be incorrect — please double check the email address entered.");
                return false;
            }
        }

        vm.remove_passenger = function(index){
            var gone = vm.new_booking.passengers[index];
            vm.new_booking.passengers.splice(index, 1);
            if(vm.is_v2 && gone && gone.email){ vm.bkf_pax_removed.push(String(gone.email).toLowerCase()); }

        }


        // Cancel-confirmation popup state (replaces the old native prompt("type YES")).
        vm.cancel_confirm = { visible: false, booking: null, working: false };

        // Open the styled confirmation popup for a booking. `booking` is the
        // vm.see_booking object so we can show its details in the confirm dialog.
        $scope.confirm_cancel_booking = function(booking){
            // Block cancellation for read-only (restricted) members
            if (vm.is_restricted_member) {
                ToastService.warning('Read-Only Calendar', 'Your membership does not allow direct booking changes from the calendar.');
                return;
            }
            vm.cancel_confirm.booking = booking;
            vm.cancel_confirm.working = false;
            // v2 panel: the reason + the club's cancellation fee (<cancel-reason-fields> writes into this)
            vm.cancel_confirm.state = { reason: '', notes: '' };
            vm.cancel_confirm.visible = true;
        };
        vm.confirm_cancel_booking = $scope.confirm_cancel_booking;

        // Dismiss the confirmation without cancelling the booking.
        $scope.close_cancel_confirm = function(){
            if (vm.cancel_confirm.working) return; // don't close mid-request
            vm.cancel_confirm.visible = false;
            vm.cancel_confirm.booking = null;
        };
        vm.close_cancel_confirm = $scope.close_cancel_confirm;

        // Actually cancel the booking (the confirm button's action).
        $scope.do_cancel_booking = function(){
            var booking = vm.cancel_confirm.booking;
            if (!booking || !booking.id) { $scope.close_cancel_confirm(); return; }
            var booking_id = booking.id;
            var cx = vm.cancel_confirm.state || {};

            // v2 panel: a reason is required (it lands on the audit trail + the archive row, and decides the fee)
            if(vm.is_v2){
                if(!cx.reason){
                    ToastService.warning('Pick a reason', 'Choose why this booking is being cancelled.');
                    return;
                }
                if(cx.key === 'other' && !String(cx.notes || '').trim()){
                    ToastService.warning('Please specify', 'Add a short note explaining the cancellation.');
                    ToastService.highlightField('bkf-cancel-notes');
                    return;
                }
            }

            vm.cancel_confirm.working = true;
            // v2: DELETE with the reason, then claim the fee when the switch is on (CancellationFeesService)
            (vm.is_v2 ? CancellationFeesService.CancelBooking(vm.user.id, booking_id, cx) : BookingService.DeleteBooking(vm.user.id, booking_id))
            .then(function(data){
                vm.cancel_confirm.working = false;

                if(data.success){
                    vm.cancel_confirm.visible = false;
                    vm.cancel_confirm.booking = null;
                    $scope.close_details && $scope.close_details();
                    if(vm.is_v2 && data.claim && data.claim.success){
                        ToastService.success(cx.key === 'no_show' ? "Marked as a no-show" : "Booking Cancelled", CancellationFeesService.outcomeText(data.claim, cx.currency), { confetti: false });
                    } else if(vm.is_v2 && data.claim){
                        ToastService.warning("Booking cancelled, fee not added", CancellationFeesService.outcomeText(data.claim) + " You can claim it from Cancellations.");
                    } else {
                        ToastService.success("Booking Cancelled", "The booking has been cancelled.");
                    }

                    // Scheduler v2 panel: the booking being edited is gone — back to
                    // the scheduler on its day (nothing to redraw here).
                    if(vm.is_v2 && vm.action == 'edit'){
                        vm.v2_close(true, vm.new_booking.start_date);
                        return;
                    }

                    $scope.all_events = $.grep($scope.all_events, function(e){
                        return e.id != booking_id;
                    });

                    $('#calendar').fullCalendar('refetchEvents');
                    $('#calendar').fullCalendar('removeEvents');
                    $('#calendar').fullCalendar('addEventSource', $scope.all_events);

                } else {
                    ToastService.error("Error", data.message || "An error occurred while cancelling the booking.");
                }
            }, function(){
                vm.cancel_confirm.working = false;
                ToastService.error("Error", "Could not connect to the server.");
            });
        };
        vm.do_cancel_booking = $scope.do_cancel_booking;

        // Kept for backwards-compatibility (any other caller) — now routes through
        // the styled confirm popup instead of the native prompt.
        $scope.cancel_booking = function(booking_id){
            $scope.confirm_cancel_booking(vm.see_booking && vm.see_booking.id == booking_id ? vm.see_booking : { id: booking_id });
        };

        var get_all_members = function(){
            console.log("hello", vm.club_id);

                 MemberService.GetAllByClub(vm.club_id)
                .then(function (data) {
                    ////console.log(data);
                        //use GB airfields first...
                        vm.members = data;
                        for(var i=0;i<vm.members.length;i++){
                            vm.members[i].is_member = true;
                        }

                        vm.all_members = data;
                        for(var i=0;i<vm.all_members.length;i++){
                            vm.all_members[i].is_member = true;
                        }
                        console.log(vm.all_members);
                
                });

            
        }

        // Only fire the eager member preload when we already know the club
        // (i.e. the "list" / calendar view where vm.club_id is set
        // synchronously from GetUserClubs before this point).
        // In the "edit" case vm.club_id is set asynchronously inside
        // BookingService.GetEdit().then(), so this timeout would race
        // and hit /members/club/undefined.  prepare_add_edit() already
        // loads the members once the edit data arrives.
        // v2 panel: bkf_load_members() owns the members list (the club's CURRENT members, re-fetched
        // when the aircraft's club changes) — the eager preload would race it with every member.
        if(vm.action !== 'edit' && !vm.is_v2){
            setTimeout(function(){
                get_all_members();
            }, 200);
        }


        vm.invite_passenger = function(email, i){
            ////console.log("SEND INVITE", vm.bookout.passengers[i]);

            var passenger_membership_id = 9;
            //interesting - this may not be required?

            vm.new_booking.passengers.push(vm.new_pax);


            // UserService.InvitePassenger(vm.new_booking.passengers[i].email, vm.user_id, vm.club_id, passenger_membership_id, vm.new_booking.booking_id)
            //     .then(function (data) {
            //             //use GB airfields first...
            //             ////console.log("INVITE IS ", data);
            //             vm.new_booking.passengers[i].status = data.invite.status;
            //             vm.new_booking.passengers[i].invitation_token = data.invite.invitation_token;
                
            //     });


        }

        vm.refresh_passenger = function(member, i){
            ////console.log("SEND REFRESH");
            UserService.GetInvite(vm.new_booking.passengers[i].invitation_token)
                .then(function (data) {
                        //use GB airfields first...
                        // //console.log("INVITED IS ", data);
                        vm.new_booking.passengers[i].status = data.status;
                        vm.new_booking.passengers[i].user_id = data.user_id;
                        vm.new_booking.passengers[i].first_name = data.first_name;
                        vm.new_booking.passengers[i].last_name = data.last_name;
                });
            //vm.bookout.passengers[i].status = "accepted";
        }

        vm.update_passenger_list = function(){

            //let's get ALL the ones required
             BookoutService.GetPassengers($stateParams.booking_id)
                .then(function (data) {
                    ////console.log(data);
                    if(data.success){
                       //alert("GET");
                       ////console.log("PAX", data.passengers);
                       if(vm.is_v2){
                           var removed = vm.bkf_pax_removed || [];
                           var server = (data.passengers || []).filter(function(r){ return !(parseInt(r.removed, 10) === 1) && removed.indexOf(String(r.email || '').toLowerCase()) < 0; });
                           var seen = {}; server.forEach(function(r){ if(r.email){ seen[String(r.email).toLowerCase()] = true; } });
                           var unsaved = (vm.new_booking.passengers || []).filter(function(r){ return !r.booking_id && !(r.email && seen[String(r.email).toLowerCase()]); });
                           vm.new_booking.passengers = server.concat(unsaved);
                       } else {
                           vm.new_booking.passengers = data.passengers;
                       }

                       vm.new_pax = {
                            id: 0,
                            email: "",
                            first_name: "",
                            last_name: "",
                            is_member: false,
                            status: "",
                            not_found: true
                        };

                    }
                });

        }

        vm.refresh_all_passenger = function(){
            var i = 0;
             function next() {
                i++;
                if(i < vm.new_booking.passengers.length) {
                    // //console.log("SEND REFRESH EVERYTHING");
                    if(vm.new_booking.passengers[i] && vm.new_booking.passengers[i].status == "invited" && vm.new_booking.passengers[i].invitation_token !== ""){

                         UserService.GetInvite(vm.new_booking.passengers[i].invitation_token)
                            .then(function (data) {
                                    // //console.log("INVITED IS ", data);
                                    // //console.log("INVITED IS ", vm.bookout.passengers[i]);
                                    vm.new_booking.passengers[i].status = data.status;
                                    vm.new_booking.passengers[i].user_id = data.user_id;
                                    vm.new_booking.passengers[i].first_name = data.first_name;
                                    vm.new_booking.passengers[i].last_name = data.last_name;
                            });
                    }
                } else {
                   /// nothing
                }
            }
            next();
         
            //vm.bookout.passengers[i].status = "accepted";
        }


       
                         ////console.log("ACCESS : ", vm.user.access);
        // const delay = (delayInms) => {
        //   return new Promise(resolve => setTimeout(resolve, delayInms));
        // };

        function prepare_add_edit(club_id=null, after_booking_end=null){

            var cid = (club_id) ? parseInt(club_id) : vm.club_id;
            // Also ensure vm.club_id is set if we received a valid cid
            if(cid > 0 && !vm.club_id){
                vm.club_id = cid;
            }
            var bed = (after_booking_end) ? after_booking_end : vm.new_booking.end_datetime;

            if(cid > 0 && bed){

                    var bed2 = moment(new Date(bed)).format("YYYY-MM-DDTHH:mm:ss");

                 if(vm.is_v2){ vm.bkf_members_club = cid; }
                 MemberService.GetAllActiveByClub(cid, bed2)
                    .then(function (data) {

                        if(vm.user.access.instructor.indexOf(cid) > -1 || vm.user.access.manager.indexOf(cid) > -1){
                            bkf_default_self(false);
                            vm.show_self_option = true;
                        }

                        //use GB airfields first...
                        vm.members = data.members || data;
                        if(vm.members && vm.members.length > 0){
                            for(var j=0;j<vm.members.length;j++){
                                vm.members[j].is_member = true;
                            }
                        }

                        if(vm.new_booking.instructor && vm.new_booking.instructor.id == vm.user.id){
                            vm.show_self_option = true;
                            bkf_default_self(false);
                        }

                        // Always try to populate the member/user from user_id
                        // Check that .user is a proper member object (has first_name);
                        // the API may return .user as a string name or number.
                        var hasValidUser = vm.new_booking.user && typeof vm.new_booking.user === 'object' && vm.new_booking.user.first_name;
                        if(!hasValidUser && vm.new_booking.user_id){

                            // First try matching from the active members we already loaded
                            var uid = vm.new_booking.user_id;
                            var foundInActive = vm.members ? vm.members.find(function(member) {
                                return member.user_id == uid;
                            }) : null;

                            if(foundInActive){
                                vm.new_booking.user = foundInActive;
                            } else if(!vm.all_members){
                                 MemberService.GetAllByClub(cid)
                                    .then(function (data) {

                                            vm.all_members = data;
                                            for(var i=0;i<vm.all_members.length;i++){
                                                vm.all_members[i].is_member = true;
                                            }

                                             vm.new_booking.user = vm.all_members.find(function(member) {
                                                                    return member.user_id == uid;
                                                                });

                                    });


                            } else {
                                vm.new_booking.user = vm.all_members.find(function(member) {
                                                                    return member.user_id == uid;
                                                                });
                            }

                        }


                        if(vm.members && vm.members.length > 0){
                            for(var i=0;i<vm.members.length;i++){
                                vm.members[i].is_member = true;
                            }
                        }
                       
                        // //console.log(vm.members);
                    
                    });

            }

           
        }



        vm.remove_invite = function(i){


                vm.new_booking.passengers.splice(i, 1);
                vm.init_passengers();


        }


        // vm.remove_passenger = function(i){


        //     var to_remove = vm.new_booking.passengers[i];
        //     if( vm.pax_invited(to_remove) ){

        //         //full removal from the backend
        //         BookingService.DeleteInvitation(to_remove, to_remove.id)
        //         .then(function(data){
        //             // //console.log(data);
        //             if(data.success == true){
        //                 //alert(data.message);
        //                 vm.new_booking.passengers.splice(i, 1);
        //                 vm.init_passengers();
        //             } else {
        //                 alert(data.message);
        //             }

        //         });




        //     } else {

        //         //this pax was not YET saved - hence just remove from list

        //         vm.new_booking.passengers.splice(i, 1);
        //         vm.init_passengers();

        //     }

        //         //below YES --> but needs to remove the invitation as well.

        //         // vm.new_booking.passengers.splice(i, 1);
        //         // vm.init_passengers();

        // }

        // v1 templates pass the ROW (new_add/new_edit list) or the INDEX (new_edit table); v2 passes the row.
        // A declined passenger is re-invited too (the backend re-applies the member rule: a current member
        // comes back as accepted, anyone else as invited with a fresh code).
        vm.resend_invitation = function(p){
            var to_resend = (typeof p === 'number') ? vm.new_booking.passengers[p] : p;
            if(!to_resend || !to_resend.id){ return; }
            BookingService.ResendInvitation({}, to_resend.id)
                .then(function(data){
                    if(data && data.success == true){
                        if(data.invite && data.invite.status){ to_resend.status = data.invite.status; }
                        var who = ((to_resend.first_name || '') + ' ' + (to_resend.last_name || '')).trim() || to_resend.email;
                        ToastService.success(to_resend.status === 'accepted' ? "Back on the flight" : "Invitation resent",
                            to_resend.status === 'accepted' ? who + " is a member — ready to fly." : "We've emailed " + who + " a fresh code.");
                    } else {
                        var m = data && data.message; if(m && typeof m === 'object'){ m = m.message || m.error; }
                        ToastService.error("Resend failed", m || (data && data.error) || "The invitation could not be resent.");
                    }
                });
        }

        vm.pax_invited = function(pax){
            if(pax.status == "" || pax.status == "to_invite"){
                return false;
            }
            return true;
        }

        vm.get_passenger_status = function(member){
            // //console.log("MEMBER", member);
            if(member){

                if(member.is_member){
                    // //console.log("this one is true");
                    return "This passenger is already club member and hence is ready for flight";
                } else {

                    if(member.status == "accepted"){
                        return "This passenger has accepted the terms and is ready for flight";
                    } else if(member.status == "declined"){
                        return "This passenger has declined the terms";
                    } else if(member.status == "to_invite"){
                        return "Invitation will be sent once the booking is saved.";
                    } else if(member.status == "invited"){
                        return "This passenger has been invited but has not yet responded.";
                    } else {
                        return "";
                    }
                }

                return "";
            }

        }

        vm.get_passenger_status_edit = function(member){
            // //console.log("MEMBER", member);
            if(member){

                if(member.is_member){
                    // //console.log("this one is true");
                    return "This passenger is already club member and hence is ready for flight";
                } else {

                    if(member.status == "accepted"){
                        return "This passenger has accepted the terms and is ready for flight";
                    } else if(member.status == "declined"){
                        return "This passenger has declined the terms";
                    } else if(member.status == "to_invite"){
                        return "Invitation will be sent once the booking is saved.";
                    } else if(member.status == "member"){
                        return "This passenger is a member";
                    } else if(member.status == "invited"){
                        return "This passenger has been invited but has not yet accepted.";
                    }else {
                        return "";
                    }
                }

                return "";
            }

        }

        vm.invite_new_passenger = function(index){

            // //console.log("HERE");
            // //console.log(vm.new_booking.passengers[index]);

            vm.show_new_passenger_invitation = true;
            vm.new_pax = index;

            vm.new_booking.passengers.push({
                    first_name: "",
                    last_name: "",
                    email: "",
                    status: ""
                });


        }

        vm.close_passenger_invitation = function(){
            reset_new_pax();
            vm.show_new_passenger_invitation = false;
        }


        vm.get_members = function(name, i){


            // console.log("GET MEMBER", name);
            // console.log("GET vm.club_id : ", vm.club_id);
            // console.log("GET vm.new_booking : ", vm.new_booking.club_id);
            // console.log("GET vm.new_booking.plane.club_id : ", vm.new_booking.plane.club_id);
            ////console.log("get members", name);
            if((vm.club_id == 0 || !vm.club_id) && vm.new_booking.plane && vm.new_booking.plane.id){
                vm.club_id = vm.new_booking.plane.club_id;
            }

            if((vm.club_id == 0 || !vm.club_id) && vm.new_booking && vm.new_booking.club_id && vm.new_booking.club_id > 0){
                vm.club_id = vm.new_booking.club_id;
            }
            console.log("GET vm.club_id : ", vm.club_id);

            if(name && name.length > 2){

                 MemberService.GetAllByClubAndName(vm.club_id, name)
                .then(function (data) {
                    ////console.log(data);
                    if(data.success){
                        //use GB airfields first...

                        //filter the ones that are already there....
                        // myArray.filter( el => !toRemove.includes( el ) );
                        // var myArray = data.members.filter( el => !vm.bookout.passengers.includes( el ) ); //filter( ( el ) => !vm.bookout.passengers.includes( el ) );


                        var filtered_array = data.members.filter(ar => !vm.new_booking.passengers.find(rm => (rm.email === ar.email) ));
                        //vm.members = data.members;
                        vm.members = filtered_array;
                        ////console.log("CHECK JANES", myArray);


                        if(vm.members.length < 1){
                            // //console.log("not found in members");
                            // vm.new_pax.not_found = true;
                            // vm.new_pax.email = "";
                            // vm.new_pax.status = "";
                            // vm.new_pax.first_name = "";
                            // vm.new_pax.last_name = "";

                            vm.new_pax = {
                                id: 0,
                                email: "",
                                first_name: "",
                                last_name: "",
                                is_member: false,
                                status: "",
                                not_found: true
                            };

                            
                           // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

                            var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            if(email_regex.test(name)){

                                vm.new_pax.email = name;

                            } else {
                                if(name.indexOf(" ") > -1){
                                    var splits = name.split(" ");
                                    vm.new_pax.first_name = splits[0];
                                    vm.new_pax.last_name = splits[1];
                                } else {
                                    vm.new_pax.first_name = name;
                                }
                            }


                        }

                        return true;

                    } else {
                        //clear original vals
                            vm.new_pax.status = "";
                            vm.new_pax.email = "";
                            vm.new_pax.first_name = "";
                            vm.new_pax.last_name = "";
                        //if email add the email here

                             var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            
                                       // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

                            if(email_regex.test(name)){
                                ////console.log("here we match?  it is an email?");
                                vm.new_pax.email = name;
                                vm.new_pax.not_found = true;

                            } else {
                                ////console.log("user not found?");
                            }


                        // var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                        // if(email_regex.test(name)){

                        //         clearTimeout(setting_new_member);
                        //         setting_new_member = undefined;

                        //         setting_new_member = setTimeout(set_new_member, 900, name, index);

                        // } else {
                        //     //console.log("WOOOPSIES...");
                        //     //this should be very very rare...
                        // }
                        

                       return false;
                    }

                });


            }
        }


        // $scope.get_members = function(name, index){


        //     ////console.log("get members", name);
        //     if((vm.club_id == 0 || !vm.club_id) && vm.new_booking.plane && vm.new_booking.plane.id){
        //         vm.club_id = vm.new_booking.plane.club_id;
        //     }

        //     if(name.length > 2){

        //          MemberService.GetAllByClubAndName(vm.club_id, name)
        //         .then(function (data) {
        //             // //console.log(data);
        //             if(data.success){
        //                 //use GB airfields first...
        //                 vm.members = data.members;

        //                 if(vm.members.length < 1){
        //                     ////console.log("not found in members");
        //                     vm.new_booking.passengers[index].not_found = true;
        //                     vm.new_booking.passengers[index].email = "";
        //                     vm.new_booking.passengers[index].status = "";
        //                     vm.new_booking.passengers[index].first_name = "";
        //                     vm.new_booking.passengers[index].last_name = "";

                            
        //                    // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

        //                     var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        //                     if(email_regex.test(name)){

        //                         vm.new_booking.passengers[index].email = name;

        //                     } else {
        //                         if(name.indexOf(" ") > -1){
        //                             var splits = name.split(" ");
        //                             vm.new_booking.passengers[index].first_name = splits[0];
        //                             vm.new_booking.passengers[index].last_name = splits[1];
        //                         } else {
        //                             vm.new_booking.passengers[index].first_name = name;
        //                         }
        //                     }


        //                 }

        //             } else {
        //                 //clear original vals
        //                     vm.new_booking.passengers[index].status = "";
        //                     vm.new_booking.passengers[index].email = "";
        //                     vm.new_booking.passengers[index].first_name = "";
        //                     vm.new_booking.passengers[index].last_name = "";
        //                 //if email add the email here

        //                      var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            
        //                                // var email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

        //                     if(email_regex.test(name)){
        //                         ////console.log("here we match?  it is an email?");
        //                         vm.new_booking.passengers[index].email = name;
        //                         vm.new_booking.passengers[index].not_found = true;

        //                     } else {
        //                         ////console.log("user not found?");
        //                     }


        //                 // var email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        //                 // if(email_regex.test(name)){

        //                 //         clearTimeout(setting_new_member);
        //                 //         setting_new_member = undefined;

        //                 //         setting_new_member = setTimeout(set_new_member, 900, name, index);

        //                 // } else {
        //                 //     //console.log("WOOOPSIES...");
        //                 //     //this should be very very rare...
        //                 // }
                        

                   
        //             }

        //         });


        //     }
        // }

        $scope.save = function(){
            if(vm.action == "add"){
                ////console.log("CREATE click");
                $scope.create();
            } else {
                ////console.log("EDIT click");
                ////console.log(vm.club.membership);
                generate_datetimes();
                $scope.update();
            }
        }

        $scope.update = function() {
            var d = new Date();
            d.setHours( 14 );
            d.setMinutes( 0 );
            $scope.mytime = d;
        };

        vm.show_self_option = false;

        $scope.select_plane = function(val){
            $scope.check_rental_items();
            free_places();

            ////console.log("AIRCRAFT SELECTED");
            if( (vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ){
                vm.show_self_option = true;
            } else {
                vm.show_self_option = false;
            }


            if(vm.user.access.instructor.indexOf(vm.club_id) > -1){
                // //console.log("THIS IS AN INSTRUCTOR IN THIS CLUB...");
                bkf_default_self(false);
            }

            
        }

        // Handler for when an aircraft is selected in the INSTRUCTOR-FIRST flow
        // Derives club from plane, loads members + courses, refreshes instructors for that plane
        vm.onInstructorPlaneSelected = function(){
            if(!vm.new_booking.plane) return;

            var booking_club_id = parseInt(vm.new_booking.plane.club_id);
            vm.club_id = booking_club_id;

            // Set permissions based on club role
            if((vm.user.access.instructor.indexOf(booking_club_id) > -1) || (vm.user.access.manager.indexOf(booking_club_id) > -1)){
                bkf_default_self(false);
                vm.show_self_option = true;
            }
            if(vm.user.access.manager.indexOf(booking_club_id) > -1){
                vm.booking_admin = true;
            }
            if(vm.is_v2){ vm.bkf_members_club = booking_club_id; }

            // Generate datetimes for the API calls
            generate_datetimes();

            var from = vm.new_booking.start_datetime;
            var to = vm.new_booking.end_datetime;
            var savedInstructor = vm.new_booking.instructor;

            // Load members for this club
            var bed = vm.new_booking.end_datetime;
            MemberService.GetAllActiveByClub(booking_club_id, bed)
            .then(function(data){
                vm.members = data.members || data;
                if(vm.members && vm.members.length > 0){
                    for(var j = 0; j < vm.members.length; j++){
                        vm.members[j].is_member = true;
                    }
                }
            });

            // Load courses for this club
            CourseService.GetCoursesByClubId(booking_club_id)
            .then(function(data){
                vm.courses = CourseService.sortByDisplayOrder(data.items);
            });

            // Refresh instructors for this specific plane, but preserve our pre-selected instructor
            var show_all = 1;
            BookingService.GetPlaneInstructors(vm.user.id, vm.new_booking.plane.id, from, to, show_all)
            .then(function(data){
                vm.instructors = data;

                // Try to match our pre-selected instructor in the updated list
                if(savedInstructor){
                    var found = false;
                    for(var i = 0; i < vm.instructors.length; i++){
                        if(vm.instructors[i].id == savedInstructor.id || vm.instructors[i].user_id == savedInstructor.user_id){
                            // Update to the full API instructor object
                            vm.new_booking.instructor = vm.instructors[i];
                            found = true;
                            break;
                        }
                    }
                    if(!found){
                        // Instructor not available for this plane - keep them but warn
                        // Add them to the list so the dropdown still shows them
                        vm.instructors.push(savedInstructor);
                    }
                }

                free_places();
            });

            // Check rental items
            $scope.check_rental_items();
        };

        function generate_datetimes(){
            var start = new Date(vm.new_booking.start_date);
            var c = new Date();
            var start_split = (vm.new_booking.start_time) ? vm.new_booking.start_time.time.split(":") : [c.getHours(), c.getMinutes()];
            // var start_split = vm.new_booking.start_time.time.split(":");

            start.setHours(start_split[0]);
            start.setMinutes(start_split[1]);
            start.setSeconds(0);

            var end = new Date(vm.new_booking.end_date);
            //var end_split = vm.new_booking.end_time.time.split(":");
            var end_split = (vm.new_booking.end_time) ? vm.new_booking.end_time.time.split(":") : [c.getHours(), c.getMinutes()];

            end.setHours(end_split[0]);
            end.setMinutes(end_split[1]);
            end.setSeconds(0);

            vm.new_booking.start_datetime = moment(start).format("YYYY-MM-DDTHH:mm:ss");
            vm.new_booking.end_datetime = moment(end).format("YYYY-MM-DDTHH:mm:ss");
            // console.log("GENERATE DATETIME ==> ", vm.new_booking.start_datetime);
            // console.log("GENERATE DATETIME ==> ", vm.new_booking.end_datetime);
        }

        function get_times(data, tofrom){
            var date = $scope.myDatetimeRange.date[tofrom];
            var d = date.getDate();
            var m = date.getMonth();
            var y = date.getFullYear();
            
            //need to combuine both
            var a = data[tofrom];
            var h = a.slice(0,2);
            var i = a.slice(3,5);
            // i = (i == 00)? 0 : i;
            i = (i.toString() == "00")? 0 : i;

            // $scope.myDatetimeRange.date.from = new Date(y, m, d, h, m, 0);
            // //console.log("vars are: "+y+", "+m+", "+d+", "+h+", "+i+", "+0+" soooo");
            var date = new Date(y, m, d, h, i, 0);
            return date;
        }

        function check_business_hours(i, k = null, start = 0){
            //i is hours
            //k is minutes
            k = parseInt(k);
            i = parseInt(i);

            var this_step_disabled = 0; 
            if(vm.new_booking.options.business_hours){
                var split = vm.new_booking.options.business_hours.from.split(":");
                var split2 = vm.new_booking.options.business_hours.to.split(":");

                if(start == 0){
                    //adjust to match times / end min 1 hour slots
                   // split2[0] = parseInt(split2[0]) + 1;
                } else {
                    split2[0] = parseInt(split2[0]) - 1;
                }

                if(k || k == 0){
                    
                    if(i < parseInt(split[0]) ){
                        // //console.log("we disable because "+i+":"+k+" is before "+split.join(":") );
                        this_step_disabled = 1;
                    } else if(i == parseInt(split[0]) && k < parseInt(split[1])){
                         // //console.log("we disable because "+i+":"+k+" is before "+split.join(":") );
                        this_step_disabled = 1;
                    }

                    // if(i >= parseInt(split2[0]) && k >= parseInt(split2[1]) ){
                    //     // //console.log("we disable because "+i+":"+k+" is after "+split2.join(":") );
                    //     this_step_disabled = 1;
                    // } 


                    if(i > parseInt(split2[0])){
                        this_step_disabled = 1; 
                    } else if( i == parseInt(split2[0]) && k > parseInt(split2[1])){
                        this_step_disabled = 1;
                    }


                } else {
                    if(parseInt(split[0]) < i){
                        this_step_disabled = 1;
                    } 
                    if(parseInt(split2[0]) > i){
                        this_step_disabled = 1;
                    } 
                }
            }

            return this_step_disabled;
        }


   

    function clean_times(which, start_end, compared_to = null){

        var compare_date;

        switch(which){
            case 'today':
                compare_date = new Date();
            break;
            case 'past':
                //we need to consider the back-dating as possible issue...
                compare_date = new Date("1990-07-26");
            break;
            case 'future':
                compare_date = new Date("1990-07-26");
            break;
            case 'after':
            //differentiate here
                compare_date = new Date(compared_to);
            break;
            case 'before':
            //differentiate here
                compare_date = new Date(compared_to);
            break;
        }

            var this_date = new Date(vm.new_booking.start_date);

            // //console.log("HERE WE GO this_date!", this_date);
            // //console.log("HERE WE GO start_end!", start_end);
            // //console.log("HERE WE GO vm[start_end]!", vm[start_end]);

            vm[start_end].forEach(function(time, i){

                //this may very well be the case function here to change when the re-do the times            
                var split_time = time.time.split(":");
                this_date.setHours(split_time[0]);
                this_date.setMinutes(split_time[1]);
                this_date.setSeconds(0);


                if( moment(this_date).isAfter(moment(compare_date)) ){
                    //vm[start_end][i].disabled = 0;
                    vm[start_end][i].disabled = check_business_hours(parseInt(split_time[0]), parseInt(split_time[1]), (start_end == "start_times")? 1 : 0);
                } else {
                    vm[start_end][i].disabled = 1;
                }
            });

        //by definition as we are changing something to cause this function from being called - we need to recalculate the times:
        calculate_duration();

    }

    function get_duration_str(seconds){
        //var seconds = Math.floor(seconds);
        // //console.log(seconds);
        // //console.log(moment.duration(seconds));
        // //console.log("days: "+moment.duration(seconds).days());
        // //console.log("hours: "+moment.duration(seconds).hours());
        // //console.log("minutes: "+moment.duration(seconds).minutes());

        var days = moment.duration(seconds).days();
        var hours = moment.duration(seconds).hours();
        var minutes = moment.duration(seconds).minutes();

        //occasional issue showing 59 minutes - unsure where but this is a fix for it... think moment() has a bug
        if(minutes == 59){
            hours++;
            minutes = 0;
        }


        var string = "";
        if(days > 0){
            string = string+" "+days+" day";
            string = (days > 1)? string+"s" : string;
        }
        if(hours > 0){
            string = string+" "+hours+" hour";
            string = (hours > 1)? string+"s" : string;
        }
        if(minutes > 0){
            string = string+" "+minutes+" minute";
            string = (minutes > 1)? string+"s" : string;
        }

         // //console.log("STR : "+string);

        return string;

    }

    function add_hour_to_end(){
        var a = vm.new_booking.start_time.time.split(":");
        //var b = new Date();
        var b = new Date(vm.new_booking.start_date);
        b.setHours(a[0]);
        b.setMinutes(a[1]);
        b.setSeconds(0);
        var future = moment(b).add(1, "hour").format();
       // clean_times('after', 'end_times', future);
       //

         //clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', future);



        if(parseInt(a[0]) >= 23){
            if(moment(vm.new_booking.start_date).isSame(moment(vm.new_booking.end_date))){
                 // //console.log("THIS ADD DAY");
                // //console.log("start", vm.new_booking.start_date);
                // //console.log("end", vm.new_booking.end_date);
                 // //console.log("after or = 11pm - then we need to change the date that follows the same pattern");
                vm.new_booking.end_date = new Date(moment(vm.new_booking.end_date).add(1, "day").format());
                clean_times('future', 'end_times');

                //set it to 00:00 hours probably a wise thing...
                vm.new_booking.end_time = vm.end_times[0];


            } 
        } else {
            clean_times('after', 'end_times', b);
        }

    }


    function start_after_end(){
            var start_after_end = false;
            if(vm.new_booking.end_time){
                // //console.log("START AFTER END LOOP");
                var start_datetime = new Date(vm.new_booking.start_date);
                var start_time = vm.new_booking.start_time.time.split(":");
                start_datetime.setHours(start_time[0]);
                start_datetime.setMinutes(start_time[1]);
                start_datetime.setSeconds(0);

                var end_datetime = new Date(vm.new_booking.end_date);
                var end_time = vm.new_booking.end_time.time.split(":");
                end_datetime.setHours(end_time[0]);
                end_datetime.setMinutes(end_time[1]);
                end_datetime.setSeconds(0);

                if(moment(start_datetime).isAfter(moment(end_datetime)) || moment(start_datetime).isSame(end_datetime) || end_datetime == start_datetime){
                    start_after_end = true;
                }


            }
            return start_after_end;
    }


    function booking_today(){
        if(moment(vm.new_booking.start_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
            // //console.log("WE ARE TODAY?");
            clean_times('today', 'start_times');

        } else {
            // //console.log("should get full day");
            if(moment(vm.new_booking.start_date).isAfter(moment()) ){
                clean_times('future', 'start_times');
            }
        }

        if(moment(vm.new_booking.end_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
            if(vm.new_booking.start_time){
               // //console.log("START TIME", vm.new_booking.start_time);
                add_hour_to_end(); 
            }
            clean_times(check_relative_date(vm.new_booking.start_date), 'end_times');
        }


        if(vm.new_booking.end_date == vm.new_booking.start_date){
                // //console.log("booking today where end = start");
                if(vm.new_booking.start_time){
                    var a = vm.new_booking.start_time.time.split(":");
                    var b = new Date(vm.new_booking.start_date);
                    b.setHours(a[0]);
                    b.setMinutes(a[1]);
                    b.setSeconds(0);

                    //we need to check the times give
                    if(start_after_end()){
                        clean_times(check_relative_date(vm.new_booking.start_date), 'start_times');
                        // //console.log("UPDATE END BITS IF START > END required?");
                        clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);
                        add_hour_to_end();
                    } else {
                        // //console.log("UPDATE END BITS IF START > END 2", check_relative_date(vm.new_booking.start_date, "end"));
                        clean_times(check_relative_date(vm.new_booking.end_date, "end"), 'end_times', b);
                    }


                }
        }

    }

    // clean_times('today', 'start_times');
    booking_today();


    function check_relative_date(date, start_end = "start"){
        var relative = "today";
        // //console.log("RELATIVE TIME CHECK", date);
        if(moment(moment(date).format("YYYY/MM/DD")).isAfter(moment().format("YYYY/MM/DD"))){
            relative = "future";

            //then is after today
            // the catch is that if date == start / end date --> THEN we need to present that it is today even though it isnt - this is premise
            // that is valid only for the "END" cases (so that we return AFTER rather than today) --> otherwise the end_times available won't reflect
            //the fact that the start_times have been selected allowing the user to select an end time before start time (which is silly really...)

            if(vm.new_booking.start_date && vm.new_booking.end_date && start_end == "end"){
                if(moment(vm.new_booking.start_date).isSame(moment(vm.new_booking.end_date))){
                    relative = "after"; // because we need to act as though it is after in the clean_times (to not be able to select end < start times)
                }
            }
            
        } else if(moment(date).format("YYYY/MM/DD") == moment().format("YYYY/MM/DD")){
            //then today
            relative = (start_end == "start") ? "today" : "after";
        } else {
            //must be in the past...
            relative = "past";
        }

        
        // //console.log("relative is ", relative);
        return relative;
    }


      if($stateParams.start){
                    //alert("add");
                    vm.new_booking.start_date = new Date($stateParams.start);
                    vm.new_booking.end_date = new Date($stateParams.start);
                    vm.new_booking.start_time = {time: moment($stateParams.start).format("HH:mm")};
                    // Scheduler v2 passes the dragged length as ?duration (minutes); v1 never does.
                    var pre_duration = (vm.is_v2 && parseInt($stateParams.duration, 10) > 0) ? parseInt($stateParams.duration, 10) : 30;
                    vm.new_booking.end_time = {time: moment($stateParams.start).add(pre_duration, "minutes").format("HH:mm") };
                    var default_end = moment($stateParams.start).add(pre_duration, "minutes");

                    vm.default_date = vm.new_booking.start_date;

                    $("#calendar").fullCalendar("gotoDate", vm.new_booking.start_date );


                    setTimeout(function(){




                        var new_event = [{
                                         "id":"TEMP",
                                         "title":"TEMPORARY",
                                         "resourceId": 7,
                                         "start":$stateParams.start,
                                         "end":default_end,
                                         "editable":false,
                                         "color":"rgb(255, 110, 110)",
                                         "opacity":"1"
                                      }];
                    

                                        $('#calendar').fullCalendar('addEventSource', new_event);
                                                    setTimeout(function(){



                                                        //scrolling?


                                                    }, 500);

                        $scope.update_dateTime("edit2", $stateParams.plane_id);



                    }, 500);

                    


      

                }

                vm.already_added_temp = false;

    // Scheduler v2 hand-off from an INSTRUCTOR row (?instructor_id). Who comes before What (2026-11-04):
    // no locked "instructor first" form any more — the instructor is picked on the club list once it loads
    // (bkf_load_instructors) and the aircraft / tuition lists narrow from there; the v1 diary click
    // (vm.add_booking_event, instructor_first_booking) is untouched.
    // (also used by the waiting-list Book flow when the request names an instructor)
    function bkf_preselect_instructor(pre_instructor_id){
        pre_instructor_id = parseInt(pre_instructor_id, 10);
        if(!(pre_instructor_id > 0)){ return; }
        vm.bkf_from_instructor_row = true;
        vm.bkf_preselect_instructor_id = pre_instructor_id;

        BookingService.GetInstructorByUser(pre_instructor_id)
        .then(function(instructorData){
            if(!instructorData || instructorData.success === false || !(parseInt(instructorData.id) > 0)){
                // not an instructor any more — a plain form
                vm.bkf_preselect_instructor_id = 0;
                vm.bkf_from_instructor_row = false;
                ToastService.warning("Instructor not found", "Pick the instructor on the form instead.");
                return;
            }
            // the row's club: the club filter when they teach there, else the Who club, else their first club
            var clubs = (instructorData.clubs || []).map(function(c){ return parseInt(c.id, 10); }).filter(function(id){ return id > 0; });
            var club = (clubs.indexOf(vm.bkf_club_filter) > -1) ? vm.bkf_club_filter : ((clubs.indexOf(vm.bkf_club) > -1) ? vm.bkf_club : (clubs[0] || 0));
            if(club > 0){ vm.bkf_set_club(club); }
            vm.new_booking.instructor = instructorData;     // shown at once; swapped for the annotated row when the list lands
            bkf_sync_who(true);
        });
    }
    if(vm.is_v2 && $stateParams.instructor_id && (vm.action == "list" || vm.action == "add")){
        bkf_preselect_instructor($stateParams.instructor_id);
    }


    // vm.add_booking_event = function(obj){

    //     vm.new_booking.start_date = new Date(obj.start);
    //     vm.new_booking.end_date = new Date(obj.start);
    //     vm.new_booking.start_time = {time: moment(obj.start).format("HH:mm")};
    //     //console.log("PLANE => ", vm.planes.find(x => parseInt(x.id) === parseInt(obj.plane_id) ));
    //     alert("HI");
    //     vm.new_booking.plane = vm.planes.find(x => parseInt(x.id) === parseInt(obj.plane_id) );

    //     vm.new_booking.end_time = {time: moment(obj.start).add(30, "minutes").format("HH:mm") };
    //     var default_end = moment(obj.start).add(30, "minutes");

    //     vm.default_date = vm.new_booking.start_date;

    //       var new_event = {
    //                          "id":"TEMP",
    //                          "title":"TEMPORARY",
    //                          "resourceId": 7,
    //                          "start":obj.start,
    //                          "end":default_end,
    //                          "editable":false,
    //                          "color":"rgb(255, 110, 110)",
    //                          "opacity":"1"
    //                       };
                   

    //     if(vm.already_added_temp){

    //             $('#calendar').fullCalendar("removeEvents", "TEMP")
           

    //                 setTimeout(function(){

    //                     $scope.update_dateTime("edit");


    //                     $('#calendar').fullCalendar('renderEvent', new_event);
    //                 }, 100);


    //     } else {

    //         setTimeout(function(){

           
        

    //                         $('#calendar').fullCalendar('renderEvent', new_event);
    //                         vm.already_added_temp = true;
    //                                     setTimeout(function(){

    //                                         //console.log("new_even", new_event);

    //                                         //scrolling?


    //                                     }, 500);

    //         $scope.update_dateTime("edit2", obj.plane_id);



    //     }, 500);

    //     }

        

        

    // }




    vm.add_booking_event = function(obj){

        // Auto-open the booking panel when a diary slot is clicked
        vm.bookingPanelOpen = true;

        vm.new_booking.start_date = new Date(obj.start);
        vm.new_booking.end_date = new Date(obj.end);
        vm.new_booking.start_time = {time: moment(obj.start).format("HH:mm")};


        vm.new_booking.end_time = {time: moment(obj.start).add(60, "minutes").format("HH:mm") };
        // var default_end = new Date(new Date(obj.start).getTime() + 30*60000); //moment(obj.start).add(30, "minutes");
        // var default_end = luxon.DateTime.fromMillis(obj.start).plus({minutes: 30}).toFormat("HH:mm");
        // var default_end2 = luxon.DateTime.fromMillis(obj.start).plus({minutes: 30}).toISO();
        // var default_end3 = luxon.DateTime.fromMillis(obj.start).plus({minutes: 30}).toFormat("yyyy-MM-DD HH:mm:ss");

        // console.log("ADD BOOKING EVENT : ", default_end);
        // console.log("ADD BOOKING EVENT : ", obj.start);
        // console.log("ADD BOOKING EVENT : ", luxon.DateTime.fromMillis(obj.start));
        // console.log("ADD BOOKING EVENT : ", luxon.DateTime.fromMillis(obj.start).toFormat("HH:mm"));
        // console.log("ADD BOOKING EVENT 2: ", default_end2);
        // console.log("ADD BOOKING EVENT 3: ", default_end3);

        // console.log("ADD BOOKING EVENT s: ", vm.new_booking.start_date);
        // console.log("ADD BOOKING EVENT e: ", vm.new_booking.end_date);

        //luxon.DateTime.fromString(obj.start).toFormat("HH:mm");
        // console.log("CHECK START DATE HERE???");
        // console.log(vm.new_booking.start_date);
        // console.log(vm.new_booking.start_date.toISOString());

         // Pass the clicked plane_id as rented_id so the backend always includes it
         // in the results even if it's near another booking's time window
         var clicked_plane_id = (obj.plane_id && String(obj.plane_id).indexOf("fi_") !== 0) ? parseInt(obj.plane_id) : 0;

         BookingService.GetAllPlanes(vm.user.id, moment(vm.new_booking.start_date).format("YYYY-MM-DDTHH:mm:ss"), moment(vm.new_booking.end_date).format("YYYY-MM-DDTHH:mm:ss"), 0, clicked_plane_id)
            .then(function(data){
               
                //this gets the events and bookings for the period checked here...
                // var events = data.events;
                vm.planes = data;

                // Instructor resource IDs start with "fi_" followed by the user_id
                var resourceId = String(obj.plane_id);
                var isInstructorRow = resourceId.indexOf("fi_") === 0;

                console.log("[DIARY CLICK] resourceId:", resourceId);
                console.log("[DIARY CLICK] isInstructorRow:", isInstructorRow);
                console.log("[DIARY CLICK] resourceObj:", obj.resourceObj);
                console.log("[DIARY CLICK] planes loaded:", vm.planes.length);

                if(isInstructorRow){
                    // Strip "fi_" prefix to get the instructor's user_id
                    var instructorUserId = parseInt(resourceId.replace("fi_", ""));
                    console.log("[DIARY CLICK] Instructor user_id extracted:", instructorUserId);

                    // Set the instructor-first booking flag
                    vm.instructor_first_booking = true;

                    // Set booking permissions so instructor/member fields are visible
                    vm.booking_self = false;
                    vm.booking_admin = true;
                    vm.show_self_option = true;

                    var start_iso = moment(vm.new_booking.start_date).format("YYYY-MM-DDTHH:mm:ss");
                    var end_iso = moment(vm.new_booking.end_date).format("YYYY-MM-DDTHH:mm:ss");

                    // Fetch the full instructor object via new endpoint
                    BookingService.GetInstructorByUser(instructorUserId)
                    .then(function(instructorData){
                        console.log("[DIARY CLICK] GetInstructorByUser response:", instructorData);

                        vm.new_booking.instructor = instructorData;
                        vm.instructors = [instructorData];

                        // Now fetch planes this instructor can teach on via new endpoint
                        return BookingService.GetInstructorPlanes(vm.user.id, instructorUserId, start_iso, end_iso);
                    })
                    .then(function(planesData){
                        console.log("[DIARY CLICK] GetInstructorPlanes response:", planesData);

                        vm.planes = planesData;
                        console.log("[DIARY CLICK] Instructor planes loaded:", vm.planes.length);

                        $scope.update_dateTime("edit2");
                    });
                } else {
                    // Clicked on a plane row — aircraft-first flow
                    vm.instructor_first_booking = false;
                    vm.new_booking.plane = vm.planes.find(x => parseInt(x.id) === parseInt(obj.plane_id) );
                    $scope.update_dateTime("edit2");
                }

            });
       


    }


    $scope.calendarOptions = {
        initialView: 'dayGridMonth'
    };

    $scope.calendarEvents = [
        { title: 'Event 1', start: '2024-02-17' },
        { title: 'Event 2', start: '2024-02-18' }
    ];


    // ── Field validation helper ──
    // Returns the first missing field name, highlights + scrolls to it, or null if all ok
    function validateBookingFields() {
        // Clear previous error markers
        var prev = document.querySelectorAll('.make_booking_table tr.field-error, .bkf-field.field-error');
        for (var i = 0; i < prev.length; i++) { prev[i].classList.remove('field-error'); }

        var checks = [
            { ok: vm.new_booking.start_time,  id: 'field-start-time',  label: 'Start Time' },
            { ok: vm.new_booking.end_time,    id: 'field-end-time',    label: 'End Time' },
            { ok: vm.new_booking.plane,       id: 'field-aircraft',    label: 'Aircraft' }
        ];

        // Member is required when booking for someone else
        if (!vm.booking_self) {
            checks.push({ ok: vm.new_booking.user, id: 'field-member', label: 'Member' });
        }

        for (var j = 0; j < checks.length; j++) {
            if (!checks[j].ok) {
                var row = document.getElementById(checks[j].id);
                if (row) {
                    row.classList.add('field-error');
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                ToastService.error('Missing: ' + checks[j].label, 'Please fill in the highlighted field before submitting.');
                return checks[j].label;
            }
        }
        return null;
    }

    $scope.make_booking = function(isValid){

       // Block booking for read-only (restricted) members
       if (vm.is_restricted_member) {
           ToastService.warning('Read-Only Calendar', 'Your membership requires slot-based booking. Use the slot finder to book.');
           return false;
       }

       //console.log("make booking", isValid);
            $scope.submitted = true;

            // Validate required fields first — catch missing member etc. before they crash
            var missingField = validateBookingFields();
            if (missingField) { return false; }

            // check to make sure the form is completely valid
            if(isValid) {
                // //console.log('our form is working');
                //then we send the booking request to the server woooohooooo!

                //clean and prepare the bits that we require
                var booking = {};
                var booking = jQuery.extend(true, {}, vm.new_booking); 
                // //console.log(booking);
                delete booking.options;
                delete booking.instructor;
                delete booking.plane;
                delete booking.start_date;
                delete booking.start_time;
                delete booking.end_date;
                delete booking.end_time;
                delete booking.start_datetime;
                delete booking.end_datetime;
                delete booking.tuition_required;
                delete booking.user;
                // //console.log(booking);
                // //console.log(vm.new_booking);

                //generate_datetimes();

                // //console.log("START DATE1 : ", vm.new_booking.start_datetime );

                // //console.log("START DATE2 : ", moment(vm.new_booking.start_datetime).isAfter() );
                // //console.log("START DATE3 : ", moment(vm.new_booking.start_datetime).isBefore() );

                // //console.log("START DATE4 : ", moment(Date.parse(vm.new_booking.start_datetime)) );
                // //console.log("END DATE : ", moment(vm.new_booking.end_datetime) );
                // //console.log("NOW : ", moment());

                //console.log(vm.new_booking.start_datetime);

                if(moment(Date.parse(vm.new_booking.end_datetime)).add(60, "minutes").isBefore()){
                    ToastService.error("Booking in the past", "This booking ends in the past — you cannot create a booking in the past.");
                    return false;
                }
                //60 mintues leeway in case of booking starting within the 15 minute period or similar
                if(moment(Date.parse(vm.new_booking.start_datetime)).add(60, "minutes").isBefore()){
                    ToastService.error("Booking in the past", "This booking starts in the past — you cannot create a booking in the past.");
                    return false;
                }





                booking.override = (vm.new_booking.override) ? vm.new_booking.override : 0;

                if(vm.booking_self){
                    // //console.log("SELF");
                    booking.user_id = vm.user.id;
                    booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;
                    // //console.log("USER IS ", booking.user_id);
                } else {
                    // //console.log("NON SELF");

                    booking.user_id = vm.new_booking.user.user_id || vm.new_booking.user.id;
                    if(vm.user.access.manager.indexOf(vm.club_id) > -1){
                        //admin does not automatically become the instructor...
                        booking.instructor_id = (vm.new_booking.instructor) ? vm.new_booking.instructor.id : 0;                
                    } else {
                        //then its an instructor - so likely booking for student not just member
                        booking.instructor_id = vm.user.id;                
                    }
                    booking.booked_by_admin_instructor = 1;
                    booking.override = 1;

                }
               




                booking.free_seats = (vm.new_booking.free_seats && vm.new_booking.free_seats.constructor === Array) ? 0 : (vm.new_booking.free_seats || 0);
                booking.start = vm.new_booking.start_datetime;
                booking.end = vm.new_booking.end_datetime;               
                booking.plane_id = vm.new_booking.plane.id;
                booking.club_id = vm.new_booking.plane.club_id;
                booking.booked_by = vm.user.id;
                booking.course_id = (vm.new_booking.tuition_required) ? vm.new_booking.tuition_required.id : 0;

                bkf_lesson_payload(booking);
                bkf_solo_payload(booking);

                booking.maintenance_flight = vm.new_booking.maintenance_flight;
                // //console.log("UUID ",booking.user_id);

                // return false;

                // //console.log("new booking obj to be sent... ",booking);

                //make booking call with new_booking as items to send! :D wooohoooooooo :P
                BookingService.Create(vm.user.id, booking)
                .then(function(data){

                    if(data.success == true){
                        // //console.log("WAS SENT HERE! ");
                        // Non-blocking airworthiness/insurance notice (warn policy).
                        // Captured from the create response before the nested refetch
                        // below shadows `data`.
                        showAirworthinessWarning(data);
                        $scope.clear_booking();
                        vm.bookingPanelOpen = false;

                        // Scheduler v2 panel: nothing to redraw here — back to the
                        // scheduler on the booking's day (it refetches on 'sv2:refresh').
                        if(vm.is_v2){
                            // booked from the waiting list: mark the request's day fulfilled (and the other days
                            // "booked elsewhere" unless the member still wants them) before going back
                            if(vm.bkf_wrq){ bkf_wrq_fulfil(data, booking.start); return; }
                            ToastService.success("Booking Created", "Your booking has been created successfully.");
                            vm.v2_close(true, booking.start);
                            return;
                        }

                        //console.log("START IS", booking.start);
                        // var split = booking.start.split("-");
                        // var month = (parseInt(split[1]) > 9) ? split[1] : "0"+split[1];
                        // var day_split = split[2].split(" ");
                        // var day = (parseInt(day_split[0]) > 9) ? day_split[0] : "0"+day_split[0];
                        // var rebuild = split[0]+"-"+month+"-"+day+"T"+day_split[1]+":00";

                        // //var split = booking.start.replace(" ", "T")+":00";


                        // console.log("START TO: ", rebuild);
                        // console.log("START TO", moment(rebuild).format("Y-MM-DD"));

                        // console.log("START IS", moment(booking.start).format("Y-MM-D"));

                        BookingService.GetAll(vm.user.id, moment(booking.start).format("Y-MM-DD"), "")
                            .then(function(data){
                                       //console.log(data);        

                                ToastService.success("Booking Created", "Your booking has been created successfully.");

                                $scope.all_events = data.events;
                                $scope.all_resources = data.resources;

                                $('#calendar').fullCalendar('refetchEvents');
                                $('#calendar').fullCalendar('removeEvents');
                                $('#calendar').fullCalendar('addEventSource', $scope.all_events);
                            });

                        

                        //$("#calendar").fullCalendar("refetchEvents");
                        //must have some sort of feedback saying booking was made successfully!
                        $state.go('dashboard.add_booking');
                    } else {

                        if(vm.is_v2 && data.error === 'DOUBLE_BOOKING_NOT_ALLOWED'){
                            // clubs.double_booking_by: a second booking on a taken slot (the waiting list) is
                            // not allowed for this user here — never overridable, one clear toast.
                            bkf_double_booking_toast(data);
                            return;
                        }

                        // //console.log("clearly something went wrong here... :'-( ", data.message);
                        //if it is something about currency - perhaps return the possibility of self-certify or book instructor for this purpose!
                        
                        if(data.more && data.more.length > 0){
                            console.log("MORE", data);
                            var addon = "";

                            for(var i=0;i<data.more.length;i++){
                                if(data.more[i]["name"] == "differences_verified"){
                                    addon += "\n - Your differences training sign-offs need to be verified by a member of staff. \n";
                                }
                                if(data.more[i]["name"] == "licence_verified"){
                                    addon += "\n - Your licence needs to be verified by a member of staff. \n";
                                }
                                if(data.more[i]["name"] == "medical_verified"){
                                    addon += "\n - Your medical needs to be verified by a member of staff. \n";
                                }
                                if(data.more[i]["name"] == "medical"){
                                    addon += "\n - You need to upload a copy of your medical. \n";
                                }
                                if(data.more[i]["name"] == "licence"){
                                    addon += "\n - You need to upload a copy of your licence. \n";
                                }
                                if(data.more[i]["name"] == "differences"){
                                    addon += "\n - You need to upload a copy of your differences training signed off. \n";
                                }
                                // addon += "You need to add your "+data.more[i][0]+" to book solo";
                            }
                            // //console.log("MORE:: ", addon);

                            data.message = data.message + addon;
                        }
                        
                        //console.log("NO MORE", data);

                        // Override tiers for a NEW booking (mirrors the edit path):
                        //  - soft conflict (allow_override / can_override) → normal override
                        //  - hard block (can_force_override) → Force button (managers/super-admins)
                        var ncAcc = (vm.user && vm.user.access) || {};
                        // String-compare both sides (IDs may be numbers or strings).
                        var ncIn = function(a){
                            if(!a) return false;
                            var want = String(vm.club_id);
                            for(var i=0;i<a.length;i++){ if(String(a[i]) === want) return true; }
                            return false;
                        };
                        var ncIsManager = ncIn(ncAcc.manager) || ncIn(ncAcc.super_admin);
                        var ncCanForce = (data.can_force_override === true) && ncIsManager;

                        if((data.allow_override || data.can_override === true || ncCanForce) && ncIsManager){

                            {

                                var ncHardMsg = function(){
                                    switch(data.hard_block){
                                        case 'aircraft_grounded':     return "This aircraft is currently grounded and must not be flown.";
                                        case 'aircraft_unavailable':  return "This aircraft is marked unavailable and cannot be booked.";
                                        case 'insurance_expired':     return "This aircraft's insurance has expired.";
                                        case 'arc_expired':           return "This aircraft's Airworthiness Review Certificate (ARC) has expired.";
                                        case 'airworthiness_expired': return "This aircraft's airworthiness / Certificate of Airworthiness has lapsed.";
                                        default:                      return "This aircraft cannot be booked due to a safety or regulatory restriction.";
                                    }
                                };
                                var ncMeta = function(){
                                    return { is_hard_block: !!data.hard_block, hard_block: data.hard_block || null, can_force: ncCanForce };
                                };

                                var errors = [];
                                if(data.reason == "instructor" || (data.hard_block && data.reason == "plane")){
                                    errors.push(angular.extend({
                                        type: data.reason == "plane" ? "plane" : "instructor",
                                        message: data.hard_block ? ncHardMsg() : "It looks like the instructor is not available for this booking",
                                        api: data.reason == "plane" ? data.plane : data.instructor,
                                        override: data.reason == "plane" ? "plane_override" : "instructor_override",
                                        button: (!data.hard_block) ? (data.reason == "plane" ? "OVERRIDE AIRCRAFT AVAILABILITY" : "OVERRIDE INSTRUCTOR AVAILABILITY") : "",
                                        force_button: "FORCE BOOKING ANYWAY"
                                    }, ncMeta()));
                                } else if(data.hard_block){
                                    // Hard block reported without a specific instructor/plane reason.
                                    errors.push(angular.extend({
                                        type: "plane",
                                        message: ncHardMsg(),
                                        api: data.plane,
                                        override: "plane_override",
                                        button: "",
                                        force_button: "FORCE BOOKING ANYWAY"
                                    }, ncMeta()));
                                }
                                if(data.reason == "overbooked"){
                                    errors.push({
                                        type: "overbooked",
                                        message: data.message || "It appears that a booking overlaps this time period.",
                                        api: (data.allow_override || data.can_override) ? "This member already has a booking in this window. As a manager you can book it anyway." : "This member already has a booking in this window.",
                                        override: "admin_override",
                                        button: "OVERRIDE OVERBOOKING"
                                    });
                                }
                                if(data.check_user && data.check_user !== true){
                                    errors.push({
                                        type: "check_user",
                                        message: "It looks like the user account does not allow this booking",
                                        api: data.check_user,
                                        override: "currency_override",
                                        button: ""
                                    });
                                }
                                if(data.rental_items && data.rental_items !== true){
                                    errors.push({
                                        type: "rental_items",
                                        message: "It looks like some of the rental items are not available",
                                        api: data.rental_items,
                                        override: "update_rental_items",
                                        button: "Confirm Changes"
                                    });
                                }

                                vm.new_booking_errors = errors;
                                if (errors.length > 0) {
                                    // a conflict popup IS the feedback — pre-empt the write guard's generic "Not saved" toast
                                    ToastService.warning('Booking Conflict', 'Nothing saved yet - see the options below.');
                                }

                            }


                        }

                        // Only show the toast if we're not showing the override popup
                        if (!vm.new_booking_errors || !vm.new_booking_errors.length) {
                            ToastService.error("Booking Error", data.message);
                        }

                        // Non-blocking airworthiness/insurance notice (warn policy) —
                        // shown alongside any conflict on the create response.
                        showAirworthinessWarning(data);
                    }

                });


            } else {
                //console.log("NOT SENT - please fix errors");
            }

    }






















        
        

      












        // MODALS FOR ALL THE POPUPS TO BE CHANGED INTO --> SAMPLE HERE

        // var warning_msg = "By deleting this membership, you will also cancel all reservations that this membership currently has."

        $scope.popup2 = {
          opened: false
        };

        $scope.popup3 = {
          opened: false
        };

        $scope.popup4 = {
          opened: false
        };
          
        $scope.open2 = function() {
          $scope.popup2.opened = true;
        };

          $scope.open3 = function() {
          $scope.popup3.opened = true;
        };

          $scope.open4 = function() {
          $scope.popup4.opened = true;
        };


        $scope.open = function (member_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return member_id;
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (member_id) {
              $log.info('PRESSED GO: '+member_id);
              MemberService.Delete(member_id)
              .then(function(){
                ////console.log("HELLO DELETE");
                //update view?
                 vm.club.members = $.grep(vm.club.members, function(e){ 
                    return e.id != member_id; 
                });
              })
            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
          };

        function bkf_double_booking_toast(data){
            var who = (data && data.double_booking_by === 'admins') ? 'admins' : 'instructors and admins';
            ToastService.error('Slot already taken', 'This club only lets ' + who + ' add a second booking on a taken slot (the waiting list).');
        }

        // ── waiting-list Book flow (?request_id&request_date) ──
        // GET waiting_requests/{id} → Booking for = that member (members/search?user_id=), the request's instructor
        // (dual, when named — via the same pre-select as ?instructor_id), its aircraft type (first free one of the type,
        // else that type grouped first), the day (?request_date rides as ?start / ?duration from the scheduler) and
        // "Waiting list: <notes>". Save → PUT {status:'fulfilled', date, fulfilled_booking_id, complete_request}.
        function bkf_load_wrq(){
            var id = parseInt($stateParams.request_id, 10);
            if(!(id > 0)){ return; }
            vm.bkf_wrq_loading = true;
            var want_date = /^\d{4}-\d{2}-\d{2}$/.test(String($stateParams.request_date || '')) ? $stateParams.request_date : null;
            WaitingRequestsService.Get(id, want_date).then(function(data){
                vm.bkf_wrq_loading = false;
                var r = data && data.success && data.request;
                if(!r){
                    ToastService.warning("Waiting-list request not found", "The booking form is open as usual — nothing was pre-filled.");
                    return;
                }
                var date = /^\d{4}-\d{2}-\d{2}$/.test(String($stateParams.request_date || '')) ? $stateParams.request_date : (r.first_date || '');
                var day = WaitingRequestsService.dayOf(r, date) || (r.dates && r.dates[0]) || null;
                if(!date && day){ date = String(day.date).substr(0, 10); }
                var others = WaitingRequestsService.liveDays(r) - ((day && WaitingRequestsService.isLiveStatus(day.status)) ? 1 : 0);
                vm.bkf_wrq = {
                    request: r, date: date, day: day,
                    still_wants: false,                                 // off by default: booking closes the whole request
                    others: others > 0 ? others : 0,
                    name: (r.user && r.user.name) || 'the member',
                    first_name: String((r.user && r.user.name) || 'The member').trim().split(/\s+/)[0],
                    pref_label: WaitingRequestsService.preferenceLabel((day && day.preference) || 'any'),
                    date_label: date ? moment(date).format('ddd D MMM') : ''
                };
                // the club: the request's
                var club = parseInt(r.club_id, 10) || 0;
                if(club > 0 && vm.bkf_is_staff_at(club)){ vm.bkf_set_club(club); }
                // Booking for = Another member → the request's member (resolved through the member search by user id)
                if(vm.bkf_can_book_others() && vm.action != 'edit'){
                    vm.show_self_option = true;
                    vm.bkf_self_explicit = true;
                    vm.booking_self = false;
                    bkf_load_members();
                    MemberService.SearchClubMembers(club || vm.bkf_default_club(), '', 1, false, r.user_id).then(function(md){
                        var row = (md && md.success && angular.isArray(md.members) && md.members.length) ? md.members[0] : null;
                        if(!row){
                            // not a current member any more → the name from the request, so the form still shows who it is for
                            var parts = String((r.user && r.user.name) || '').trim().split(/\s+/);
                            row = { id: r.user_id, user_id: r.user_id, first_name: parts.shift() || '', last_name: parts.join(' '), email: (r.user && r.user.email) || '', is_member: true };
                            ToastService.warning("Not a current member", vm.bkf_wrq.name + " is on the waiting list but is not a current member of the club — check before booking.");
                        }
                        row.is_member = true;
                        vm.new_booking.user = row;
                        if(angular.isArray(vm.members) && !vm.members.some(function(m){ return parseInt(m.user_id, 10) === parseInt(row.user_id, 10); })){ vm.members.unshift(row); }
                    });
                }
                // instructor: the request's (dual) unless the scheduler already passed ?instructor_id
                if(r.kind === 'dual' && parseInt(r.instructor_id, 10) > 0 && !$stateParams.instructor_id){ bkf_preselect_instructor(r.instructor_id); }
                // aircraft: the request's type / aircraft, once the list for the slot is in
                vm.bkf_wrq_type = String(r.plane_type || '').toUpperCase();
                vm.bkf_wrq_plane_id = parseInt(r.plane_id, 10) || 0;
                bkf_wrq_plane_done = false;
                bkf_refresh_views();
                bkf_wrq_pick_plane();
                // notes
                var note = String(r.notes || '').trim();
                vm.new_booking.description = 'Waiting list: ' + (note || ((r.kind_label || WaitingRequestsService.kindLabel(r.kind)) + ' request'));
            });
        }
        // after the booking is saved: the request's day → fulfilled with the booking id; the other live days →
        // fulfilled + "booked elsewhere" unless the member still wants them. Then back to the scheduler as usual.
        function bkf_wrq_fulfil(created, start){
            var w = vm.bkf_wrq;
            var booking_id = parseInt((created && created.content && created.content.id) || (created && created.booking_id) || 0, 10) || 0;
            var body = { status: 'fulfilled', date: w.date, complete_request: !w.still_wants };
            if(booking_id > 0){ body.fulfilled_booking_id = booking_id; }
            WaitingRequestsService.Update(w.request.id, body).then(function(res){
                if(res && res.success){
                    var tail = w.still_wants && w.others > 0 ? ' Still on the list for ' + w.others + ' other day' + (w.others === 1 ? '' : 's') + '.' : '';
                    ToastService.success("Booked", w.first_name + " is off the waiting list for " + w.date_label + "." + tail);
                } else {
                    ToastService.warning("Booked — waiting list not updated", "The booking was created, but " + w.name + "'s request could not be marked as booked. Mark it from the waiting list.");
                }
                vm.bkf_wrq = null;
                vm.v2_close(true, start);
            });
        }
        // "Cancel — back to the waiting list": close the panel, then the scheduler reopens the list on that day
        vm.bkf_wrq_cancel = function(){
            var date = vm.bkf_wrq ? vm.bkf_wrq.date : $stateParams.request_date;
            vm.bkf_wrq = null;
            vm.v2_close(false);
            $rootScope.$broadcast('sv2:waiting', { date: date });
        };

        // ── v2 panel init — must stay at the very end (vm.show_self_option = false is set mid-file) ──
        if(vm.is_v2){
            if($stateParams.request_id && vm.action != 'edit'){ $timeout(bkf_load_wrq, 0); }   // after the init below has run
            // the Member picker searches by NAME through members/search; the passenger picker (called with an
            // index) keeps v1's email search
            var bkf_v1_get_members = vm.get_members;
            vm.get_members = function(name, i){
                if(i === undefined){ bkf_search_members(name); return; }
                return bkf_v1_get_members.apply(this, arguments);
            };
            try { vm.bkf_club_filter = parseInt($window.localStorage.getItem('toaviate_sv2_club'), 10) || 0; } catch(e){ vm.bkf_club_filter = 0; }
            if(vm.bkf_can_book_others() && vm.action != 'edit'){
                vm.show_self_option = true;
                vm.booking_self = false;        // v1's default for staff: booking for someone else
            }
            bkf_build_clubs();                  // → vm.bkf_set_club → members for that club
            if(!(vm.bkf_club > 0) && vm.bkf_can_book_others() && vm.action != 'edit'){ bkf_load_members(); }

            // The action bar is fixed to the panel's bottom edge; its measured height → --bkf-bar-h on the
            // panel (body padding + scroll-padding clear it, phones wrap the bar to two rows). The form is an
            // ng-include, so poll briefly until it is in the DOM.
            var bkf_ro = null, bkf_ro_tries = 0;
            var bkf_measure_bar = function(){
                var panels = document.querySelectorAll('.bkf-panel');          // the entering panel is the last one (a leaving one may linger 0.22 s)
                var panel = panels.length ? panels[panels.length - 1] : null, bar = panel && panel.querySelector('.bkf-actions');
                if(!panel || !bar){ if(++bkf_ro_tries < 30){ $timeout(bkf_measure_bar, 150, false); } return; }
                var set = function(){ panel.style.setProperty('--bkf-bar-h', Math.ceil(bar.getBoundingClientRect().height) + 'px'); };
                set();
                if($window.ResizeObserver){ bkf_ro = new $window.ResizeObserver(set); bkf_ro.observe(bar); }
            };
            $timeout(bkf_measure_bar, 50, false);
            $scope.$on('$destroy', function(){ if(bkf_ro){ bkf_ro.disconnect(); bkf_ro = null; } });
        }

    }