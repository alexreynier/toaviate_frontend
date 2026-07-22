 app.controller('DashboardInstructorBriefController', DashboardInstructorBriefController);

    DashboardInstructorBriefController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'BookingService', 'ToastService', 'QuestionnaireService', 'MissingStudentsService'];
    function DashboardInstructorBriefController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, BookingService, ToastService, QuestionnaireService, MissingStudentsService) {
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

                    var haveLesson = !!(vm.lesson && vm.lesson.id);
                    vm.no_lesson_selected = !haveLesson;   // drives the picker in the view

                    if (haveLesson) {
                        vm.my_search = vm.lesson.id;
                        load_content_files(vm.lesson.id);
                    }

                    // Load the lessons for the (book-in-selected) course so the
                    // instructor can pick which lesson they taught — this list also
                    // powers the existing "taught a different lesson?" switcher.
                    if (vm.course_id) {
                        CourseService.GetLessonsByCourseId(vm.course_id)
                        .then(function(lessonData){
                            vm.all_lessons = lessonData.items || [];
                            if (haveLesson) {
                                for (var i = 0; i < vm.all_lessons.length; i++) {
                                    if (String(vm.all_lessons[i].id) === String(vm.lesson.id)) {
                                        vm.selected_debrief_lesson_obj = vm.all_lessons[i];
                                        break;
                                    }
                                }
                            }
                        });

                        CourseService.GetTagsByCourseId(vm.course_id)
                        .then(function(tagData){
                            vm.all_tags = tagData.items;
                            vm.selected_flight_tags = [];
                        });
                    } else {
                        // No course on the flight (e.g. an older claimed flight saved
                        // before course_id was persisted). Let the instructor pick the
                        // course too — load the club's courses for the picker.
                        vm.need_course_pick = true;
                        if (vm.record_club_id) {
                            CourseService.GetCoursesByClubId(vm.record_club_id)
                            .then(function(courseData){
                                vm.debrief_courses = courseData.items || [];
                            });
                        }
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
            return vm.all_items || [];
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

            if(compiled_items.length < 1 && (!vm.general_remarks || vm.general_remarks == "")){
                ToastService.warning('Validation', 'To save student records, you need to tick at least one student progress record item OR add a general remark');
                return false;
            }

            // Imported log-sheet flights can arrive with no student attached —
            // the record has nobody to belong to, so it must be resolved on the
            // Missing Students queue before it can be debriefed.
            if(!vm.student || !vm.student.id){
                ToastService.error('No Student', 'This flight has no student attached yet — resolve the student first (Missing Students).');
                return false;
            }

            var next_lesson = vm.lesson.id;

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
                booking_id: vm.booking_id,
                flight_tags: vm.selected_flight_tags
            };

            // console.log(vm.compiled_save);
            // return false;

            //IF EDIT?? NEED TO CHANGE THIS CALL SURELY?

            CourseService.CreateTrainingRecord(vm.compiled_save)
                .then(function(data){
                    if(data.success){

                        ToastService.success('Records Saved', 'Thank you!');
                        if(vm.show_split && vm.split_next_id && vm.split_next_id > 0){
                            $state.go('dashboard.my_account.book_in', {id: vm.split_next_id});
                            //dashboard.my_account.book_in({id: log.plane_log_sheet_id})
                        } else {
                            $state.go('dashboard.manage_user', {reload: true});
                        }



                    } else {
                        ToastService.error('Save Failed', 'We could not save your training records...');
                    }
        
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
        vm.pending_debrief_lesson_obj = null;
        vm.show_lesson_switcher = false;
        vm.no_lesson_selected = false;   // true on a claimed flight with no booked lesson
        vm.pick_lesson_obj = null;       // ui-select model for the no-lesson picker
        vm.need_course_pick = false;     // true when the flight has no course_id at all
        vm.debrief_courses = [];         // club courses for the fallback course picker
        vm.pick_course_obj = null;       // ui-select model for the course picker
        vm.contentFiles = [];
        vm.contentFilesLoading = true;
        vm.activeContentFile = null;

        vm.change_lesson = function(){
            if (vm.selected_lesson_obj) {
                vm.selected_lesson = vm.selected_lesson_obj.id;
                load_lesson();
            }
        }

        vm.confirm_debrief_lesson_change = function(){
            if (vm.pending_debrief_lesson_obj) {
                vm.selected_debrief_lesson_obj = vm.pending_debrief_lesson_obj;
                vm.pending_debrief_lesson_obj = null;
                vm.show_lesson_switcher = false;
                vm.change_debrief_lesson();
            }
        }

        vm.cancel_debrief_lesson_change = function(){
            vm.pending_debrief_lesson_obj = null;
            vm.show_lesson_switcher = false;
        }

        vm.change_debrief_lesson = function(){
            if (vm.selected_debrief_lesson_obj) {
                var lesson_id = vm.selected_debrief_lesson_obj.id;

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

        // Fallback: the flight has no course at all (older claimed flights saved
        // before course_id was persisted). Instructor picks the course, then its
        // lessons load into all_lessons and the lesson picker takes over.
        vm.pick_debrief_course = function(){
            if (!vm.pick_course_obj || !vm.pick_course_obj.id) {
                ToastService.warning('Select a Course', 'Please choose the course this flight was part of.');
                return;
            }
            vm.course_id = vm.pick_course_obj.id;
            vm.need_course_pick = false;
            CourseService.GetLessonsByCourseId(vm.course_id)
                .then(function(lessonData){
                    vm.all_lessons = lessonData.items || [];
                });
            CourseService.GetTagsByCourseId(vm.course_id)
                .then(function(tagData){
                    vm.all_tags = tagData.items;
                    vm.selected_flight_tags = [];
                });
        };

        // Claimed-flight case: no lesson was booked out. The instructor picks the
        // lesson they taught (from the course already selected on the book-in form,
        // i.e. vm.all_lessons for vm.course_id). Selecting it loads the full lesson
        // inline via change_debrief_lesson so the student record can be filled in.
        vm.pick_debrief_lesson = function(){
            if (!vm.pick_lesson_obj || !vm.pick_lesson_obj.id) {
                ToastService.warning('Select a Lesson', 'Please choose the lesson you taught on this flight.');
                return;
            }
            vm.selected_debrief_lesson_obj = vm.pick_lesson_obj;
            vm.no_lesson_selected = false;
            vm.change_debrief_lesson();
        };

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