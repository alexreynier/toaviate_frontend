 app.controller('DashboardInstructorBriefController', DashboardInstructorBriefController);

    DashboardInstructorBriefController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'BookingService'];
    function DashboardInstructorBriefController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, BookingService) {
        var vm = this;

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

                //console.log("view an existing lesson");
                load_lesson();


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

                    //if we claim without a bookout....ugh...
                    //for_debrief_pls
                    //get progress for course
                    BookingService.GetForForDebriefPls(vm.plane_log_sheet_id)
                        .then(function(data){
                            if(data.success){
                                vm.competences = data.competences;   
                                vm.course_id = data.course_id;   
                                vm.record_club_id = data.club_id;
                                vm.lesson = data.lesson;   
                                vm.all_items = data.all_items;   
                                vm.my_search = vm.lesson.id;
                                vm.student = data.student;
                                vm.instructor = data.instructor;
                                vm.plane_log_sheet = data.log_sheet;



                                CourseService.GetLessonsByCourseId(vm.course_id)
                                .then(function(data){
                                    vm.all_lessons = data.items;   
                                });

                                CourseService.GetTagsByCourseId(vm.course_id)
                                .then(function(data){
                                    vm.all_tags = data.items;   
                                    vm.selected_flight_tags = [];
                                });

                            } else {
                                alert("We could not obtain the debriefing information for you...");
                            }
                            
                        });



                } else {
                    //get progress for course
                    BookingService.GetForForDebrief(vm.booking_id)
                        .then(function(data){
                            if(data.success){
                                vm.competences = data.competences;   
                                vm.course_id = data.course_id;   
                                vm.record_club_id = data.club_id;
                                vm.lesson = data.lesson;   
                                vm.all_items = data.all_items;   
                                vm.my_search = vm.lesson.id;
                                vm.student = data.student;
                                vm.instructor = data.instructor;
                                vm.plane_log_sheet = data.log_sheet;



                                CourseService.GetLessonsByCourseId(vm.course_id)
                                .then(function(data){
                                    vm.all_lessons = data.items;   
                                });

                                CourseService.GetTagsByCourseId(vm.course_id)
                                .then(function(data){
                                    vm.all_tags = data.items;   
                                    vm.selected_flight_tags = [];
                                });

                            } else {
                                alert("We could not obtain the debriefing information for you...");
                            }
                            
                        });
                }

                vm.show_whole_lesson = true;



                

            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        vm.show_all_lessons = false;
        vm.tag_full_flight = true;

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
                alert("To save student records, you need to tick at least one student progress record item OR add a general remark");
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

                        alert("THANK YOU!");
                        if(vm.show_split && vm.split_next_id && vm.split_next_id > 0){
                            $state.go('dashboard.my_account.book_in', {id: vm.split_next_id});
                            //dashboard.my_account.book_in({id: log.plane_log_sheet_id})
                        } else {
                            $state.go('dashboard.manage_user', {reload: true});
                        }



                    } else {
                        alert("We could not save your training records...");
                    }
        
                });




        }
        
        vm.tag_flight_time = 0;

        vm.add_tag = function(){
            //CHECK IF ADD DOES ALREADY EXIST!!!
            if(vm.selected_flight_tags.find(tag => tag.id === vm.flight_tag.id)){
                alert("You already have this tag on this flight!");
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
                alert("To save student records, you need to tick at least one student progress record item OR add a general remark");
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
        vm.show_dropdown = false;

        vm.change_lesson = function(){
            // console.log("CHANGE LESSON TO", vm.selected_lesson);
            load_lesson();
            vm.show_dropdown = false;

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
                        }

                      


                    });


           

        }

        vm.go_book_out = function(){

            var set_briefed = {booking_id: vm.booking_id, briefed: 1};
            BookingService.SetBookingToBriefed(vm.booking_id)
                    .then(function(data){

                        if(data.success){

                            $state.go('dashboard.my_account.bookout_with_booking', {booking_id: vm.booking_id});

                        } else {

                            alert("Could not complete the briefing!");

                        }
                        
                    });
        }

       
        $scope.back = function(){
            $window.history.back();
        }



        initController();

        function initController() {
           //console.log("check if access is okay");
        }


       


    }