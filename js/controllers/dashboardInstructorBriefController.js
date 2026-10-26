 app.controller('DashboardInstructorBriefController', DashboardInstructorBriefController);

    DashboardInstructorBriefController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'BookingService', 'ToastService', 'QuestionnaireService', 'MissingStudentsService', 'PlaneService', 'TimeDisplayService'];
    function DashboardInstructorBriefController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, BookingService, ToastService, QuestionnaireService, MissingStudentsService, PlaneService, TimeDisplayService) {
        var vm = this;

        // ── Pre-lesson questionnaire flag (shown on the briefing screen) ──
        // When the student + lesson are known, fetch the student's attempts for
        // this lesson so we can show a "completed" chip + a Review link.
        vm.preLessonQuestionnaires = [];
        var _preQLoaded = '';
        $scope.$watch(function() {
            return (vm.student && vm.student.id ? vm.student.id : '') + ':' +
                   (vm.lesson && vm.lesson.id ? vm.lesson.id : '');
        }, function(key) {
            if (!vm.student || !vm.student.id || !vm.lesson || !vm.lesson.id) return;
            if (key === _preQLoaded) return;
            _preQLoaded = key;
            var club = vm.briefing_club_id || vm.club_id;
            QuestionnaireService.StudentAttemptsForTarget(club, vm.student.id, 'lesson', vm.lesson.id, 'pre')
                .then(function(data) {
                    vm.preLessonQuestionnaires = (data && data.items) ? data.items : [];
                });
        });
        vm.reviewPreLesson = function(a) {
            $state.go('dashboard.manage_club.questionnaire_review', { attempt_id: a.id });
        };
        vm.preLessonDone = function(a) { return a.status === 'submitted' || a.status === 'reviewed'; };
        vm.fmtPreLessonTime = function(seconds) {
            seconds = parseInt(seconds, 10) || 0;
            var m = Math.floor(seconds / 60), s = seconds % 60;
            return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
        };

           //    /* PLEASE DO NOT COPY AND PASTE THIS CODE. */(function(){var w=window,C='___grecaptcha_cfg',cfg=w[C]=w[C]||{},N='grecaptcha';var gr=w[N]=w[N]||{};gr.ready=gr.ready||function(f){(cfg['fns']=cfg['fns']||[]).push(f);};(cfg['render']=cfg['render']||[]).push('explicit');(cfg['onload']=cfg['onload']||[]).push('initRecaptcha');w['__google_recaptcha_client']=true;var d=document,po=d.createElement('script');po.type='text/javascript';po.async=true;po.src='https://www.gstatic.com/recaptcha/releases/JPZ52lNx97aD96bjM7KaA0bo/recaptcha__en.js';var e=d.querySelector('script[nonce]'),n=e&&(e['nonce']||e.getAttribute('nonce'));if(n){po.setAttribute('nonce',n);}var s=d.getElementsByTagName('script')[0];s.parentNode.insertBefore(po, s);})();

           // var initRecaptcha = function () { 
           //     // document.getElementById("SearchModule").scope().vm.parent.isGrecaptchaLoaded = !0, 
           //     // document.getElementById("SearchModule").scope().vm.showRecaptcha();
           //     vm.showRecaptcha();
           // };
              




        vm.user = null;
        vm.allUsers = [];
      

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;
         ////console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);

        vm.club_id = $rootScope.globals.currentUser.current_club_instructor;
        vm.user_id = vm.user.id;

        // Debrief times are training-record times: brakes off → on, club rounding.
        vm.td = TimeDisplayService.context(vm.club_id, { window: 'block' });

        vm.exams = [];

        
        switch(vm.action){
            case "add":
                //console.log("adding a new course please");
                vm.page_title = "Add a New Course";
            break;
            case "view":

                //console.log("view an existing course");
                load_course();


            break;
            case "view_lesson":
                vm.selected_lesson = $stateParams.lesson_id;

                // If no lesson_id provided (no course on booking), show course picker
                if (!vm.selected_lesson || vm.selected_lesson == '0' || vm.selected_lesson == 'undefined') {
                    vm.course_picker_loading = true;
                    vm.course_picker_courses = [];
                    vm.course_picker_lessons = [];
                    vm.course_picker_selected_course = null;

                    // First, check the booking to see if it already has a course_id
                    BookingService.GetForBookout(vm.user_id, $stateParams.booking_id)
                        .then(function(data) {
                            var booking = (data.success && data.booking) ? data.booking : null;
                            vm.briefing_club_id = (booking && booking.club_id)
                                ? booking.club_id
                                : ($stateParams.club_id || vm.club_id);

                            // If booking already has a course, skip the course picker
                            // and go straight to lesson selection for that course
                            if (booking && booking.course_id && booking.course_id > 0) {
                                vm.no_course_selected = true;
                                vm.course_picker_loading = false;

                                // Auto-select the booking's course and show its lessons
                                CourseService.GetCoursesByClubId(vm.briefing_club_id)
                                    .then(function(courseData) {
                                        vm.course_picker_courses = courseData.items || [];
                                        // Find the matching course
                                        var matchedCourse = null;
                                        for (var i = 0; i < vm.course_picker_courses.length; i++) {
                                            if (vm.course_picker_courses[i].id == booking.course_id) {
                                                matchedCourse = vm.course_picker_courses[i];
                                                break;
                                            }
                                        }
                                        if (matchedCourse) {
                                            vm.select_briefing_course(matchedCourse);
                                        } else {
                                            // Course not found in club list — fall back to course picker
                                            loadCoursesForBriefing();
                                        }
                                    })
                                    .catch(function() {
                                        loadCoursesForBriefing();
                                    });
                            } else {
                                // No course on booking — show the full course picker
                                vm.no_course_selected = true;
                                loadCoursesForBriefing();
                            }
                        })
                        .catch(function() {
                            vm.briefing_club_id = $stateParams.club_id || vm.club_id;
                            vm.no_course_selected = true;
                            loadCoursesForBriefing();
                        });
                } else {
                    vm.no_course_selected = false;
                    vm.briefing_club_id = $stateParams.club_id || vm.club_id;
                    load_lesson();
                }


            break;
            case "list":
                //console.log("view list of existing courses");
                
                BookingService.GetBookingsToBrief(vm.user.id)
                    .then(function(data){

                        vm.briefings = data.briefings;   
                        
                    });


            break;
            case "debrief_list":
                //console.log("view list of existing courses");

                BookingService.GetBookingsToDebrief(vm.user.id)
                    .then(function(data){

                        vm.briefings = data.briefings;
                        // Imported / tracker-claimed flights with no booking that
                        // still need a student record (see
                        // FRONTEND_MISSING_STUDENT_RECORDS_GUIDE.md). Sorted
                        // newest-first by the API; can be long after an import.
                        vm.flight_debriefs = data.flight_debriefs || [];

                    });


            break;
            case "debrief":
                //console.log("plane_log_sheet", $stateParams.plane_log_sheet_id);
                //console.log("booking_id", $stateParams.booking_id);
                vm.plane_log_sheet_id = $stateParams.plane_log_sheet_id;
                vm.booking_id = $stateParams.booking_id;
                
                console.log("STATEPARAMS: ", $stateParams);

                vm.show_split = 0;
                if($stateParams.split_next_id && $stateParams.split_next_id > 0){
                    vm.split_next_id = $stateParams.split_next_id;
                    vm.show_split = 1;
                    console.log("SPLIT NEXT ID!!", vm.split_next_id);
                }
                if($stateParams.split_booking_id && $stateParams.split_booking_id > 0){
                    vm.split_booking_id = $stateParams.split_booking_id;
                    vm.show_split = 1;
                }

                //vm.pls_id = $stateParams.plane_log_sheet_id;

                // ── Split flights (FRONTEND_SPLIT_FLIGHT_SECOND_LEG_GUIDE.md) ──
                // The API also reports the open second leg, so the hand-off works
                // when this screen is reached from the debrief list later on, not
                // only straight after the book-in that created the split.
                vm.pending_split_leg = null;
                vm.sheet_needs_book_in = false;
                vm.book_in_split_leg = function(){
                    if(vm.split_next_id > 0){ $state.go('dashboard.my_account.book_in', {id: vm.split_next_id}); }
                };
                vm.book_in_this_sheet = function(){
                    if(vm.plane_log_sheet && vm.plane_log_sheet.id > 0){ $state.go('dashboard.my_account.book_in', {id: vm.plane_log_sheet.id}); }
                };
                vm.split_leg_later = function(){
                    vm.show_split = 0;
                    ToastService.success('Noted', 'Part 2 stays under your flights to book in and on Claim a Flight.');
                };
                vm.split_leg_resume = function(){
                    if(vm.split_next_id > 0){ vm.show_split = 1; }
                };

                if(vm.plane_log_sheet_id > 0){
                    //if we claim without a bookout....ugh... (for_debrief_pls)
                    BookingService.GetForForDebriefPls(vm.plane_log_sheet_id)
                        .then(function(data){ handleDebriefData(data); });
                } else {
                    BookingService.GetForForDebrief(vm.booking_id)
                        .then(function(data){ handleDebriefData(data); });
                }

                // Shared handling for both debrief entry points. Crucially, a
                // CLAIMED flight can arrive with NO lesson (nothing was booked out),
                // so we must not assume vm.lesson exists — instead we surface a
                // lesson picker scoped to the course that was chosen on the book-in
                // form (already returned here as data.course_id).
                function handleDebriefData(data){
                    if(!data || !data.success){
                        ToastService.error('Load Failed', 'We could not obtain the debriefing information for you...');
                        return;
                    }

                    vm.competences = data.competences;
                    vm.course_id = data.course_id;
                    vm.record_club_id = data.club_id;
                    vm.lesson = data.lesson;
                    vm.all_items = data.all_items || [];
                    vm.student = data.student;
                    vm.instructor = data.instructor;
                    vm.plane_log_sheet = data.log_sheet;
                    vm.sheet_needs_book_in = !!(data.log_sheet && data.log_sheet.needs_book_in == 1);
                    vm.pending_split_leg = data.pending_split_leg || null;
                    if(vm.pending_split_leg && vm.pending_split_leg.id > 0 && !(vm.split_next_id > 0)){
                        vm.split_next_id = vm.pending_split_leg.id;
                        vm.split_booking_id = vm.pending_split_leg.booking_id;
                        vm.show_split = 1;
                    }
                    // Log-sheet rows link here with booking_id 0; the API now tells
                    // us the booking the flight belongs to, so the record can flag
                    // it debriefed and it can't be debriefed twice.
                    if((!vm.booking_id || Number(vm.booking_id) < 1) && data.booking_id && Number(data.booking_id) > 0){
                        vm.booking_id = Number(data.booking_id);
                    }
                    if(!vm.plane_log_sheet || !vm.plane_log_sheet.id){
                        ToastService.warning('No Flight Yet', 'This booking has not been booked in — book the flight in first, then debrief it.');
                    }

                    var haveLesson = !!(vm.lesson && vm.lesson.id);
                    vm.no_lesson_selected = !haveLesson;   // drives the picker in the view
                    // Until the student's records say otherwise, the lesson is just
                    // the API's guess (next after the latest record, else lesson 1).
                    vm.suggestion = haveLesson ? { source: 'backend' } : null;

                    if (haveLesson) {
                        vm.my_search = vm.lesson.id;
                        load_content_files(vm.lesson.id);
                    }

                    load_flight_aircraft();

                    // The club's courses always load — the course picker is how an
                    // instructor moves a flight to the other course a student is on.
                    if (vm.record_club_id) {
                        CourseService.GetCoursesByClubId(vm.record_club_id)
                        .then(function(courseData){
                            vm.debrief_courses = courseData.items || [];
                            vm.course_obj = find_by_id(vm.debrief_courses, vm.course_id);
                        });
                    }

                    if (vm.course_id) {
                        load_course_context(vm.course_id);
                    } else {
                        // No course on the flight (claimed without a course on the
                        // book-in form). The instructor picks the course first.
                        vm.need_course_pick = true;
                    }
                }

                vm.show_whole_lesson = true;



                

            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        // ── Imported / unlogged flight debriefs (debrief_list screen) ──
        // Rows are plane_log_sheet flights with no booking. missing_student:1
        // rows can't be debriefed yet — the student must be resolved first
        // (inline dismiss here; assign/create lives on the admin queue page).
        vm.flight_debriefs = [];
        vm.fd_limit = 25;   // client-side pagination — the list can be hundreds of rows
        vm.fd_show_more = function(){ vm.fd_limit += 50; };

        // The name the paper sheet had for an unidentified student
        // ("Ben ANDERSON" — may be surname-only, or nothing at all).
        vm.fd_sheet_name = function(log){
            if(!log || !log.suggested_student){ return null; }
            return ((log.suggested_student.first_name || '') + ' ' +
                    (log.suggested_student.last_name || '')).trim() || null;
        };

        // "Resolve student…" — inline modal for THIS flight: quick-pick/search a
        // member or create a temporary one, then (in its confirmation step)
        // optionally fix the other unknown flights carrying the same sheet name.
        vm.fd_resolve = function(log){
            var modal = $uibModal.open({
                templateUrl: 'views/modals/missing_student_resolve.html',
                controller: 'MissingStudentResolveModalController',
                controllerAs: 'vm',
                size: 'md',
                backdrop: 'static',
                windowClass: 'msq-modal-window',   // clears the fixed top nav
                resolve: {
                    log: function(){ return log; },
                    club_id: function(){ return log.club_id; }
                }
            });
            modal.result.then(function(res){
                if(res && res.fixed){
                    // The student is now attached (possibly to sibling rows too) —
                    // reload so every fixed row flips to debrief-able.
                    BookingService.GetBookingsToDebrief(vm.user.id)
                        .then(function(data){
                            vm.briefings = data.briefings;
                            vm.flight_debriefs = data.flight_debriefs || [];
                        });
                }
            }, function(){});
        };

        // "No record needed" — e.g. a corporate/junk row. Kept on screen with an
        // Undo so a mis-tap is recoverable without reloading.
        vm.fd_dismiss = function(log){
            log._busy = true;
            MissingStudentsService.Dismiss(log.club_id, { plane_log_sheet_ids: [log.plane_log_sheet_id] })
                .then(function(data){
                    log._busy = false;
                    if(data.success){
                        log._dismissed = true;
                    } else {
                        ToastService.error('Not Dismissed', data.message || 'The flight could not be dismissed.');
                    }
                });
        };

        vm.fd_restore = function(log){
            log._busy = true;
            MissingStudentsService.Dismiss(log.club_id, { plane_log_sheet_ids: [log.plane_log_sheet_id], restore: true })
                .then(function(data){
                    log._busy = false;
                    if(data.success){
                        log._dismissed = false;
                    } else {
                        ToastService.error('Not Restored', data.message || 'The flight could not be restored.');
                    }
                });
        };

        vm.show_all_lessons = false;
        vm.tag_full_flight = true;

        // ═══════════════════════════════════════════════
        // DEBRIEF: course + lesson picker, suggestion, history
        // ═══════════════════════════════════════════════
        vm.debrief_courses = [];     // club courses for the course picker
        vm.course_obj = null;        // ui-select model (course)
        vm.lesson_obj = null;        // ui-select model (lesson)
        vm.all_lessons = [];
        vm.recent_records = [];      // latest lessoned records on the current course, newest first
        vm.records_total = 0;
        vm.records_loading = false;
        vm.suggestion = null;        // { source: 'backend'|'course_start'|'history'|'chosen', from_title, from_completed }
        vm.pending_switch = null;    // { type: 'course'|'lesson', obj } awaiting confirmation
        vm.flight_aircraft = {};
        // Lesson-brief sections start open on a desktop, closed on a phone so
        // the grading is reachable without scrolling past a full-height PDF.
        var wide = !!($window.innerWidth && $window.innerWidth > 768);
        vm.acc = { files: wide, tem: false, preflight: false, airex: false, debrief: false };

        function find_by_id(list, id){
            for (var i = 0; i < (list || []).length; i++) {
                if (String(list[i].id) === String(id)) { return list[i]; }
            }
            return null;
        }
        function organise_of(l){ return (l && l.organise !== null && l.organise !== undefined) ? Number(l.organise) : 0; }
        function first_lesson(){
            var first = null;
            (vm.all_lessons || []).forEach(function(l){ if (!first || organise_of(l) < organise_of(first)) { first = l; } });
            return first;
        }
        function lesson_after(l){
            var next = null;
            (vm.all_lessons || []).forEach(function(c){
                if (organise_of(c) > organise_of(l) && (!next || organise_of(c) < organise_of(next))) { next = c; }
            });
            return next;
        }

        // Lessons + tags for a course, then the student's records on it (which
        // may improve the suggested lesson). Shared by first load and course switch.
        function load_course_context(course_id){
            vm.all_lessons = [];
            vm.recent_records = [];
            vm.records_total = 0;
            CourseService.GetLessonsByCourseId(course_id)
                .then(function(lessonData){
                    if (String(course_id) !== String(vm.course_id)) { return; } // switched again meanwhile
                    vm.all_lessons = lessonData.items || [];
                    if (vm.lesson && vm.lesson.id) {
                        vm.lesson_obj = find_by_id(vm.all_lessons, vm.lesson.id);
                        vm.selected_debrief_lesson_obj = vm.lesson_obj;
                    }
                    load_student_records(course_id);
                });
            CourseService.GetTagsByCourseId(course_id)
                .then(function(tagData){
                    if (String(course_id) !== String(vm.course_id)) { return; }
                    vm.all_tags = tagData.items || [];
                    vm.selected_flight_tags = [];
                });
        }

        // The student's records on this course drive two things: the "recent
        // records" strip, and a better default lesson. The API's suggestion
        // falls back to lesson 1 whenever the student's latest record carries
        // no lesson (imported history does that), which is how a student on
        // A27 gets offered A1. If their records show later lessons, propose
        // the one after their latest lessoned record instead, and say why.
        function load_student_records(course_id){
            if (!vm.student || !vm.student.id) { return; }
            vm.records_loading = true;
            CourseService.GetStudentTrainingRecords(vm.student.id, course_id)
                .then(function(data){
                    if (String(course_id) !== String(vm.course_id)) { return; }
                    vm.records_loading = false;
                    var records = (data && data.success !== false && data.training_records) ? data.training_records : [];
                    // Newest first (the API sorts oldest-first by flight date)
                    var lessoned = [];
                    for (var i = records.length - 1; i >= 0; i--) {
                        var r = records[i];
                        if (!r.lesson_id || Number(r.lesson_id) <= 0) { continue; }
                        var l = find_by_id(vm.all_lessons, r.lesson_id);
                        lessoned.push({
                            lesson: l,
                            title: l ? l.title : ('Lesson #' + r.lesson_id),
                            number: l ? (organise_of(l) + 1) : null,
                            completed: Number(r.completed) === 1,
                            when: r.flight_date || null
                        });
                    }
                    vm.records_total = lessoned.length;
                    vm.recent_records = lessoned.slice(0, 5);
                    apply_suggestion(lessoned[0] || null);
                }, function(){ vm.records_loading = false; });
        }

        function apply_suggestion(latest){
            // Only ever override the API's guess, never a lesson the instructor chose.
            if (vm.suggestion && vm.suggestion.source === 'chosen') { return; }
            var current = (vm.lesson && vm.lesson.id) ? vm.lesson : null;
            var first = first_lesson();
            var api_defaulted = !current || (first && String(current.id) === String(first.id));
            if (!latest || !latest.lesson) {
                if (current) { vm.suggestion = { source: api_defaulted ? 'course_start' : 'backend' }; }
                return;
            }
            if (!api_defaulted) {
                // the API already derived this from a real record — keep it, explain it
                vm.suggestion = { source: 'history', from_title: latest.title, from_completed: latest.completed };
                return;
            }
            var proposed = latest.completed ? (lesson_after(latest.lesson) || latest.lesson) : latest.lesson;
            vm.suggestion = { source: 'history', from_title: latest.title, from_completed: latest.completed };
            if (!current || String(proposed.id) !== String(current.id)) {
                vm.lesson_obj = proposed;
                vm.selected_debrief_lesson_obj = proposed;
                vm.no_lesson_selected = false;
                vm.change_debrief_lesson();
            }
        }

        function load_flight_aircraft(){
            vm.flight_aircraft = {};
            var sheet = vm.plane_log_sheet;
            if (!sheet || !sheet.plane_id) { return; }
            PlaneService.GetById(sheet.plane_id, sheet.club_id || vm.record_club_id)
                .then(function(data){
                    if (data && data.success !== false && data.registration) { vm.flight_aircraft = data; }
                });
        }

        vm.flight_minutes = function(){
            var s = vm.plane_log_sheet;
            if (!s) { return 0; }
            var hrs = parseFloat(s.brakes_times_rounded || s.brakes_time || s.flight_time || 0);
            return isNaN(hrs) ? 0 : Math.round(hrs * 60);
        };
        vm.flight_minutes_label = function(){
            var m = vm.flight_minutes();
            return Math.floor(m / 60) + 'h ' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm';
        };

        // Anything typed or graded that a switch would throw away
        vm.has_entries = function(){
            return vm.graded_count() > 0 ||
                   !!(vm.general_remarks && String(vm.general_remarks).trim()) ||
                   (vm.selected_flight_tags && vm.selected_flight_tags.length > 0);
        };

        vm.on_course_pick = function(course){
            if (!course || String(course.id) === String(vm.course_id)) { return; }
            if (vm.has_entries()) {
                vm.pending_switch = { type: 'course', obj: course };
                vm.course_obj = find_by_id(vm.debrief_courses, vm.course_id); // snap back until confirmed
                return;
            }
            do_switch_course(course);
        };
        vm.on_lesson_pick = function(lesson){
            if (!lesson || (vm.lesson && String(lesson.id) === String(vm.lesson.id))) { return; }
            if (vm.has_entries()) {
                vm.pending_switch = { type: 'lesson', obj: lesson };
                vm.lesson_obj = find_by_id(vm.all_lessons, vm.lesson && vm.lesson.id);
                return;
            }
            do_switch_lesson(lesson);
        };
        vm.confirm_switch = function(){
            var p = vm.pending_switch;
            vm.pending_switch = null;
            if (!p) { return; }
            if (p.type === 'course') { do_switch_course(p.obj); } else { do_switch_lesson(p.obj); }
        };
        vm.cancel_switch = function(){ vm.pending_switch = null; };

        function reset_entries(){
            vm.clear_grades();
            vm.general_remarks = '';
            vm.selected_flight_tags = [];
            vm.flight_tag = '';
            vm.lesson_completed = false;
            vm.next_lesson = null;
        }

        function do_switch_course(course){
            vm.course_id = course.id;
            vm.course_obj = course;
            vm.need_course_pick = false;
            reset_entries();
            vm.lesson = {};
            vm.lesson_obj = null;
            vm.selected_debrief_lesson_obj = null;
            vm.no_lesson_selected = true;
            vm.suggestion = null;
            vm.all_items = [];
            vm.contentFiles = [];
            vm.activeContentFile = null;
            load_course_context(course.id);
        }

        function do_switch_lesson(lesson){
            reset_entries();
            vm.lesson_obj = lesson;
            vm.selected_debrief_lesson_obj = lesson;
            vm.no_lesson_selected = false;
            vm.suggestion = { source: 'chosen' };
            vm.change_debrief_lesson();
        }

        // ═══════════════════════════════════════════════
        // COURSE PICKER (when no course set on booking)
        // ═══════════════════════════════════════════════
        vm.select_briefing_course = function(course) {
            vm.course_picker_selected_course = course;
            vm.course_picker_lessons_loading = true;
            vm.course_picker_lessons = [];

            CourseService.GetLessonsByCourseId(course.id)
                .then(function(data) {
                    vm.course_picker_lessons = data.items || [];
                    vm.course_picker_lessons_loading = false;
                })
                .catch(function() {
                    vm.course_picker_lessons_loading = false;
                    ToastService.error('Load Failed', 'Could not load lessons for this course.');
                });
        };

        vm.select_briefing_lesson = function(lesson) {
            vm.selected_lesson = lesson.id;
            vm.no_course_selected = false;
            load_lesson();
        };

        vm.back_to_course_list = function() {
            vm.course_picker_selected_course = null;
            vm.course_picker_lessons = [];
        };

        vm.update_flight_tag = function(){
            console.log(vm.plane_log_sheet);

            vm.tag_full_flight = true;
        }

        vm.update_flight_full_flight = function(){

            if((Math.round(vm.tag_flight_time / 5) * 5) > (vm.plane_log_sheet.brakes_times_rounded * 60)){
                vm.tag_flight_time = (vm.plane_log_sheet.brakes_times_rounded * 60);
                vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            }

            if((Math.round(vm.tag_flight_time / 5) * 5) == 0){
                vm.tag_flight_time = 5;
            }

            if(vm.tag_full_flight){
                vm.tag_flight_time = (vm.plane_log_sheet.brakes_times_rounded * 60);
                vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            } else {
                console.log("tag full flight");
                console.log(vm.plane_log_sheet);
            }
            
        }

        vm.show_whole_course = function(){
            vm.show_all_lessons = !vm.show_all_lessons;
            if(vm.show_all_lessons){
                vm.my_search = "";
                vm.my_search2 = "";
            } else {
                vm.my_search = vm.lesson.id;
                vm.my_search2 = "";
            }
        }

        vm.set_updated_search = function(){

            if(vm.show_all_lessons){
                vm.my_search = vm.my_search2;
            } else {
                    if(vm.my_search2.length > 1){
                        vm.my_search = vm.my_search2;
                    } else {
                        vm.my_search = vm.lesson.id;
                    }
            }
            
        }

        // ── Grading control (segmented bar) ──
        // On this screen the grade lives flat on the item (item.result), unlike the
        // records edit form where it sits under item.this_entry. Same visual control,
        // different binding — these helpers read the flat shape.
        function competence_colour(competence){
            return competence ? (competence.colour || competence.grade_colour) : null;
        }
        vm.competence_icon = function(competence){
            var icon = competence ? (competence.icon || competence.grade_icon) : null;
            return icon ? ('fa fa-' + icon) : '';
        };
        vm.is_graded_as = function(item, competence){
            return !!(item && competence && String(item.result) === String(competence.id));
        };
        // A selected segment fills SOLID in the club's configured grade colour.
        vm.competence_style = function(competence, item){
            var colour = competence_colour(competence);
            if(!vm.is_graded_as(item, competence) || !colour){ return {}; }
            return { 'background-color': colour, 'border-color': colour, color: '#fff' };
        };
        vm.is_graded = function(item){
            return !!(item && item.result !== null && item.result !== undefined &&
                      item.result !== '' && Number(item.result) > 0);
        };

        // Only the objectives currently on screen count toward the "x of y graded"
        // banner — when the whole course is shown, that's every item.
        vm.gradable_items = function(){
            if(vm.show_all_lessons || !vm.lesson || !vm.lesson.id){ return vm.all_items || []; }
            return vm.lesson_items();
        };
        // Objectives belonging to the lesson being debriefed (exact match — the
        // old substring filter also matched lessons 112, 120… when on lesson 12).
        vm.lesson_items = function(){
            var out = [];
            if(!vm.lesson || !vm.lesson.id){ return out; }
            (vm.all_items || []).forEach(function(i){
                if(String(i.lesson_id) === String(vm.lesson.id)){ out.push(i); }
            });
            return out;
        };
        // Rows on screen: this lesson only, or (whole course / search) a title match.
        vm.visible_items = function(){
            if(!vm.show_all_lessons){ return vm.lesson_items(); }
            var q = (vm.my_search2 || '').toString().toLowerCase().trim();
            if(q === ''){ return vm.all_items || []; }
            return (vm.all_items || []).filter(function(i){
                return (i.title || '').toLowerCase().indexOf(q) !== -1 || (i.lesson_title || '').toLowerCase().indexOf(q) !== -1;
            });
        };
        vm.clear_grades = function(){
            (vm.all_items || []).forEach(function(i){ i.result = null; i.remarks = ''; });
        };
        vm.graded_count = function(){
            var n = 0;
            vm.gradable_items().forEach(function(i){ if(vm.is_graded(i)) { n++; } });
            return n;
        };
        vm.grade_percent = function(){
            var rows = vm.gradable_items();
            if(!rows.length){ return 0; }
            return Math.round((vm.graded_count() / rows.length) * 100);
        };

        vm.save_progress = function(){

            // Safety net: a tag picked from the dropdown but never committed with
            // "Add …" isn't in selected_flight_tags and would be silently dropped.
            // Stop and make the instructor decide rather than lose it.
            if(vm.flight_tag && vm.flight_tag.id){
                ToastService.warning('Tag Not Added',
                    '"' + String(vm.flight_tag.title).toUpperCase() + '" is selected but has not been added yet — ' +
                    'press "Add ' + String(vm.flight_tag.title).toUpperCase() + ' to this flight", or clear the tag, then save.');
                return false;
            }

            var compiled_items = [];
            for(var i=0;i<vm.all_items.length;i++){
                if( (vm.all_items[i].result && vm.all_items[i].result > 0) || (vm.all_items[i].remarks && vm.all_items[i].result !== "") ){
                    compiled_items.push(vm.all_items[i]);
                }
            }



            //some rough checks:::

            // //console.log("PROGRESS: ", vm.general_remarks);
            // //console.log("PROGRESS: ", compiled_items.length);

            if(vm.saving){ return false; }
            if(!vm.lesson || !vm.lesson.id){
                ToastService.warning('No Lesson', 'Pick the lesson you taught before saving the record.');
                return false;
            }
            if(!vm.plane_log_sheet || !vm.plane_log_sheet.id){
                ToastService.error('No Flight', 'This booking has not been booked in yet, so there is no flight to attach the record to.');
                return false;
            }

            // A lesson with no marking items (e.g. Air Experience) can be signed
            // off as completed with no remark — the API accepts that too.
            var lesson_has_items = vm.lesson_items().length > 0;
            var has_remark = !!(vm.general_remarks && String(vm.general_remarks).trim() !== "");
            if(compiled_items.length < 1 && !has_remark && !(!lesson_has_items && vm.lesson_completed)){
                ToastService.warning('Validation', lesson_has_items
                    ? 'To save student records, grade at least one objective OR add a general remark'
                    : 'This lesson has no objectives — tick "completed" or add a general remark to save it');
                return false;
            }

            // Imported log-sheet flights can arrive with no student attached —
            // the record has nobody to belong to, so it must be resolved on the
            // Missing Students queue before it can be debriefed.
            if(!vm.student || !vm.student.id){
                ToastService.error('No Student', 'This flight has no student attached yet — resolve the student first (Missing Students).');
                return false;
            }

            // Only an explicitly chosen next lesson is sent; otherwise the API
            // works it out from course order (sending the same lesson back made
            // the next debrief suggest the lesson just completed).
            var next_lesson = null;
            if(vm.lesson_completed == 1 && vm.next_lesson && vm.next_lesson.id > 0){
                next_lesson = vm.next_lesson.id;
            }

            //vm.selected_flight_tags.push(vm.flight_tag);

            vm.compiled_save = {
                club_id: vm.record_club_id,
                items: compiled_items,
                general_remarks: vm.general_remarks,
                lesson_id: vm.lesson.id,
                course_id: vm.course_id,
                user_id: vm.student.id,
                // Imported flights may have no instructor on the sheet — the
                // person completing the debrief is the instructor of record.
                instructor_id: (vm.instructor && vm.instructor.id) ? vm.instructor.id : vm.user.id,
                completed_by: vm.user.id,
                plane_log_sheet_id: vm.plane_log_sheet.id,
                next_lesson_id: next_lesson,
                completed: (vm.lesson_completed) ? 1 : 0,
                booking_id: (vm.booking_id && Number(vm.booking_id) > 0) ? Number(vm.booking_id)
                            : ((vm.plane_log_sheet.booking_id && Number(vm.plane_log_sheet.booking_id) > 0) ? Number(vm.plane_log_sheet.booking_id) : 0),
                flight_tags: vm.selected_flight_tags
            };

            // console.log(vm.compiled_save);
            // return false;

            //IF EDIT?? NEED TO CHANGE THIS CALL SURELY?

            vm.saving = true;
            CourseService.CreateTrainingRecord(vm.compiled_save)
                .then(function(data){
                    vm.saving = false;
                    if(data && data.success){

                        ToastService.success('Records Saved', 'Thank you!');
                        if(vm.show_split && vm.split_next_id && vm.split_next_id > 0){
                            $state.go('dashboard.my_account.book_in', {id: vm.split_next_id});
                            //dashboard.my_account.book_in({id: log.plane_log_sheet_id})
                        } else {
                            $state.go('dashboard.manage_user', {reload: true});
                        }



                    } else {
                        // VALIDATION_ERROR / SAVE_FAILED / DUPLICATE carry the reason
                        var why = (data && data.message) ? (typeof data.message === 'string' ? data.message : (data.message.message || '')) : '';
                        ToastService.error('Save Failed', why || 'We could not save your training records...');
                    }
                }, function(){
                    vm.saving = false;
                    ToastService.error('Save Failed', 'We could not reach the server — the flight stays in your debrief list.');
                });




        }
        
        vm.tag_flight_time = 0;

        vm.add_tag = function(){
            //CHECK IF ADD DOES ALREADY EXIST!!!
            if(vm.selected_flight_tags.find(tag => tag.id === vm.flight_tag.id)){
                ToastService.warning('Duplicate Tag', 'You already have this tag on this flight!');
                return false;
            }

            if((Math.round(vm.tag_flight_time / 5) * 5) > (vm.plane_log_sheet.brakes_times_rounded * 60)){
                vm.tag_flight_time = (vm.plane_log_sheet.brakes_times_rounded * 60);
                vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            }

            if((Math.round(vm.tag_flight_time / 5) * 5) == 0){
                vm.tag_flight_time = 5;
            }

            if(vm.tag_full_flight){
                vm.tag_flight_time = (vm.plane_log_sheet.brakes_times_rounded * 60);
                vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            }

            // Push a COPY. vm.flight_tag is the object ui-select picked out of
            // vm.all_tags, so mutating it would stamp logging_time onto the master
            // tag list itself.
            vm.selected_flight_tags.push(angular.extend({}, vm.flight_tag, {
                flight_tag_id: vm.flight_tag.id,
                logging_time: vm.tag_flight_time
            }));

            vm.flight_tag = "";
            vm.tag_flight_time = (vm.plane_log_sheet.brakes_times_rounded * 60);
            vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            vm.tag_full_flight = true;
        }

        vm.delete_tag = function(tag, index){
            vm.selected_flight_tags.splice(index, 1);

        }

        vm.tag_time_to_five = function(){
            if(vm.tag_flight_time % 5 !== 0){
                vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            }            
        }

        vm.save_edit_record = function(){
            console.log("SAVE THE UPDATE NOW!! WHOOP WHOOP!!");

            console.log("FLIGHT TAGS : ", vm.selected_flight_tags);

            var compiled_items = [];
            for(var i=0;i<vm.all_items.length;i++){
                if( (vm.all_items[i].result && vm.all_items[i].result > 0) || (vm.all_items[i].remarks && vm.all_items[i].result !== "") ){
                    compiled_items.push(vm.all_items[i]);
                }
            }

            //some rough checks:::

            // //console.log("PROGRESS: ", vm.general_remarks);
            // //console.log("PROGRESS: ", compiled_items.length);

            if(compiled_items.length < 1 && (!vm.general_remarks || vm.general_remarks == "")){
                ToastService.warning('Validation', 'To save student records, you need to tick at least one student progress record item OR add a general remark');
                return false;
            }

            var next_lesson = vm.lesson.id;

            if(vm.lesson_completed == 1 && vm.next_lesson && vm.next_lesson.id > 0){
                next_lesson = vm.next_lesson.id;
            }


            vm.compiled_save = {
                club_id: vm.record_club_id,
                items: compiled_items,
                general_remarks: vm.general_remarks,
                lesson_id: vm.lesson.id,
                course_id: vm.course_id,
                user_id: vm.student.id,
                instructor_id: vm.instructor.id,
                completed_by: vm.user.id,
                plane_log_sheet_id: vm.plane_log_sheet.id,
                next_lesson_id: next_lesson,
                completed: (vm.lesson_completed) ? 1 : 0,
                booking_id: vm.booking_id,
                flight_tags: vm.selected_flight_tags
            };
            console.log("COMPILED SAVE");
            console.log(vm.compiled_save);
            console.log("COMPILED SAVE");

        }

        function load_course(){


             //console.log("PARAMS", $state);
            CourseService.GetCourseById($stateParams.course_id)
                    .then(function(data){
                        vm.course = data.item;   

                        CourseService.GetExamsByCourseId($stateParams.course_id)
                                .then(function(data){
                                    vm.course.exams = data.items;   
                            
                                });

                        CourseService.GetLessonsByCourseId($stateParams.course_id)
                                .then(function(data){
                                    vm.course.lessons = data.items;   
                                });

                        CourseService.GetTagsByCourseId($stateParams.course_id)
                        .then(function(data){
                            vm.all_tags = data.items;   

                        });
            
                    });
             
            



        }

        vm.lesson = {};
        vm.selected_lesson_obj = null;
        vm.selected_debrief_lesson_obj = null;
        vm.no_lesson_selected = false;   // true on a claimed flight with no booked lesson
        vm.need_course_pick = false;     // true when the flight has no course_id at all
        vm.contentFiles = [];
        vm.contentFilesLoading = true;
        vm.activeContentFile = null;

        vm.change_lesson = function(){
            if (vm.selected_lesson_obj) {
                vm.selected_lesson = vm.selected_lesson_obj.id;
                load_lesson();
            }
        }

        // Loads the full lesson (details, bullets, TEM, objectives, content
        // files) for vm.selected_debrief_lesson_obj and makes it the lesson
        // being debriefed. Grades are cleared — they belong to the old lesson.
        vm.change_debrief_lesson = function(){
            if (vm.selected_debrief_lesson_obj) {
                var lesson_id = vm.selected_debrief_lesson_obj.id;
                vm.lesson_obj = find_by_id(vm.all_lessons, lesson_id) || vm.selected_debrief_lesson_obj;
                vm.clear_grades();
                vm.lesson_completed = false;
                vm.next_lesson = null;

                CourseService.GetLessonById(lesson_id)
                    .then(function(data){
                        if(data.success){
                            vm.lesson = data.item;
                            vm.my_search = vm.lesson.id;

                            CourseService.GetBulletsByLessonId(lesson_id)
                                .then(function(data){
                                    vm.lesson.bullets = data.bullets;
                                });

                            CourseService.GetTemByLessonId(lesson_id)
                                .then(function(data){
                                    vm.lesson.tem = data.items;
                                });

                            CourseService.GetItemsByLessonId(lesson_id)
                                .then(function(data){
                                    vm.lesson.items = data.items;

                                    // Rebuild all_items to include the new lesson's items for progress tracking
                                    if (data.items && data.items.length > 0) {
                                        // Merge new lesson items into all_items if not already present
                                        angular.forEach(data.items, function(newItem) {
                                            var exists = vm.all_items.some(function(existing) {
                                                return String(existing.id) === String(newItem.id);
                                            });
                                            if (!exists) {
                                                vm.all_items.push(newItem);
                                            }
                                        });
                                    }
                                });

                            load_content_files(lesson_id);
                        }
                    });
            }
        }

        // Load courses for the course picker using the resolved briefing_club_id
        function loadCoursesForBriefing() {
            CourseService.GetCoursesByClubId(vm.briefing_club_id)
                .then(function(data) {
                    vm.course_picker_courses = data.items || [];
                    vm.course_picker_loading = false;
                })
                .catch(function() {
                    vm.course_picker_loading = false;
                    ToastService.error('Load Failed', 'Could not load courses for this club.');
                });
        }

        function load_lesson(){

            vm.booking_id = $stateParams.booking_id;

            CourseService.GetLessonById(vm.selected_lesson)
                    .then(function(data){

                        if(data.success){



                             vm.lesson = data.item;   


                             CourseService.GetLessonsByCourseId(data.item.course_id)
                              .then(function(data){

                                        vm.all_lessons = data.items;

                                        // Set the selected lesson object for ui-select
                                        for (var i = 0; i < vm.all_lessons.length; i++) {
                                            if (String(vm.all_lessons[i].id) === String(vm.selected_lesson)) {
                                                vm.selected_lesson_obj = vm.all_lessons[i];
                                                break;
                                            }
                                        }
                            
                                    });
            
                             CourseService.GetBulletsByLessonId(vm.selected_lesson)
                                    .then(function(data){

                                        vm.lesson.bullets = data.bullets;
                            
                                    });

                            CourseService.GetTemByLessonId(vm.selected_lesson)
                                .then(function(data){
                                    //console.log(data);

                                    vm.lesson.tem = data.items;

                                });

                            CourseService.GetItemsByLessonId(vm.selected_lesson)
                                .then(function(data){
                                    //console.log(data);

                                    vm.lesson.items = data.items;

                                });

                            // Load content files (images / PDFs)
                            load_content_files(vm.selected_lesson);
                        }

                      


                    });


           

        }

        vm.go_book_out = function(){

            var set_briefed = {booking_id: vm.booking_id, briefed: 1};

            // Send the selected course + lesson so the booking is updated
            var briefData = {};
            if(vm.lesson && vm.lesson.course_id){
                briefData.course_id = vm.lesson.course_id;
            } else if(vm.course_picker_selected_course && vm.course_picker_selected_course.id){
                briefData.course_id = vm.course_picker_selected_course.id;
            } else if(vm.course_id){
                briefData.course_id = vm.course_id;
            }
            if(vm.selected_lesson){
                briefData.lesson_id = vm.selected_lesson;
            }

            BookingService.SetBookingToBriefed(vm.booking_id, briefData)
                    .then(function(data){

                        if(data.success){

                            $state.go('dashboard.my_account.bookout_with_booking', {booking_id: vm.booking_id, lesson_id: vm.selected_lesson});

                        } else {

                            ToastService.error('Briefing Error', 'Could not complete the briefing!');

                        }
                        
                    });
        }

       
        $scope.back = function(){
            $rootScope.safeBack();
        }



        initController();

        function initController() {
           //console.log("check if access is okay");
        }


        // ═══════════════════════════════════════════════
        // LESSON CONTENT FILES VIEWER
        // ═══════════════════════════════════════════════
        function load_content_files(lesson_id) {
            vm.contentFilesLoading = true;
            vm.contentFiles = [];
            vm.activeContentFile = null;

            CourseService.GetLessonContentFiles(lesson_id)
                .then(function(data) {
                    if (data && data.items && data.items.length > 0) {
                        vm.contentFiles = data.items;
                        angular.forEach(vm.contentFiles, function(file) {
                            file._loading = true;
                            file.data_uri = null;
                            CourseService.GetLessonContentFileData(file.id)
                                .then(function(res) {
                                    if (res && res.success) {
                                        file.data_uri = res.data_uri;
                                        file.file_base64 = res.file;
                                    }
                                    file._loading = false;
                                    if (!vm.activeContentFile && file.data_uri) {
                                        vm.activeContentFile = file;
                                    }
                                })
                                .catch(function() {
                                    file._loading = false;
                                    file._loadError = true;
                                });
                        });
                    } else {
                        vm.contentFiles = [];
                    }
                    vm.contentFilesLoading = false;
                })
                .catch(function() {
                    vm.contentFiles = [];
                    vm.contentFilesLoading = false;
                });
        }

        vm.selectContentFile = function(file) {
            if (file && file.data_uri) {
                vm.activeContentFile = file;
            }
        };

        vm.hasContentFiles = function() {
            return vm.contentFiles && vm.contentFiles.length > 0;
        };

        vm.hasSectionContent = function(section) {
            if (!vm.lesson) return false;
            switch(section) {
                case 'tem':
                    return vm.lesson.tem && vm.lesson.tem.length > 0;
                case 'preflight':
                    return vm.lesson.bullets && vm.lesson.bullets.preflight && vm.lesson.bullets.preflight.length > 0;
                case 'airex':
                    return vm.lesson.bullets && vm.lesson.bullets.airex && vm.lesson.bullets.airex.length > 0;
                case 'debrief':
                    return vm.lesson.bullets && vm.lesson.bullets.debrief && vm.lesson.bullets.debrief.length > 0;
                case 'items':
                    return vm.lesson.items && vm.lesson.items.length > 0;
                default:
                    return false;
            }
        };


       


    }