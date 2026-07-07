 app.controller('DashboardInstructorBriefController', DashboardInstructorBriefController);

    DashboardInstructorBriefController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'BookingService', 'ToastService', 'QuestionnaireService'];
    function DashboardInstructorBriefController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, BookingService, ToastService, QuestionnaireService) {
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

        vm.save_progress = function(){

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

            //vm.selected_flight_tags.push(vm.flight_tag);

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

            vm.flight_tag.logging_time = vm.tag_flight_time;
            // if(!vm.tag_full_flight){
            //     vm.flight_tag.logging_time = Math.round(vm.tag_flight_time / 5) * 5;
            // } else {
            //     vm.flight_tag.logging_time = (vm.plane_log_sheet.brakes_times_rounded * 60);
            //     vm.tag_flight_time = Math.round(vm.tag_flight_time / 5) * 5;
            // }

            vm.selected_flight_tags.push(vm.flight_tag);
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