 app.controller('DashboardCourseSyllabusViewController', DashboardCourseSyllabusViewController);

    DashboardCourseSyllabusViewController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'QuestionnaireService', 'CourseMaterialService'];
    function DashboardCourseSyllabusViewController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, QuestionnaireService, CourseMaterialService) {
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
        // //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);

        vm.club_id =( $rootScope.globals.currentUser && $rootScope.globals.currentUser.current_club_admin && $rootScope.globals.currentUser.current_club_admin.id) ? $rootScope.globals.currentUser.current_club_admin.id : 0;
        vm.user_id = vm.user.id;

        vm.exams = [];

        vm.course = {
            exams: [],
            lessons: []
        };

        vm.lesson = {
            tem: [],
            bullets: {},
            items: []
        }

        vm.contentFiles = [];
        vm.contentFilesLoading = true;
        vm.activeContentFile = null;
        
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

                //console.log("view an existing lesson");
                load_lesson();


            break;
            case "list":
                //console.log("view list of existing courses");
                CourseService.GetCoursesByClubId(vm.club_id)
                    .then(function(data){
                        vm.courses = data.items;   
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  


        function load_course(){


            vm.course_id = $stateParams.course_id;

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


                    });

            // Attached questionnaires + post-material for the course (pre/post).
            loadAttachedContent('course', $stateParams.course_id);
             
          


        }


        function load_lesson(){

            vm.course_id = $stateParams.course_id;

            CourseService.GetLessonById($stateParams.lesson_id)
                    .then(function(data){
                        vm.lesson = data.item;   

                        CourseService.GetBulletsByLessonId($stateParams.lesson_id)
                            .then(function(data){

                                    vm.lesson.bullets = data.bullets;
                        
                                });

                        CourseService.GetTemByLessonId($stateParams.lesson_id)
                            .then(function(data){
                                //console.log(data);

                                vm.lesson.tem = data.items;

                            });

                        CourseService.GetItemsByLessonId($stateParams.lesson_id)
                            .then(function(data){
                                //console.log(data);

                                vm.lesson.items = data.items;

                            });

                        // Load content files (images / PDFs)
                        load_content_files($stateParams.lesson_id);

                    });

            // Attached questionnaires + post-material for the lesson (pre/post).
            loadAttachedContent('lesson', $stateParams.lesson_id);

        }

        // ═══════════════════════════════════════════════
        // ATTACHED QUESTIONNAIRES + MATERIAL (the student's "to do")
        // Groups by pre/post; merges the student's attempt status so each
        // questionnaire shows Start / Continue / View result.
        // ═══════════════════════════════════════════════
        vm.qPre = []; vm.qPost = [];
        vm.matPre = []; vm.matPost = [];
        vm.pretty = function(s) { return s ? String(s).replace(/_/g, ' ') : ''; };

        function loadAttachedContent(type, id) {
            vm.contentScope = type;
            vm.contentAttachId = id;

            // The student's attempts (to derive per-questionnaire status).
            QuestionnaireService.Mine().then(function(mineData) {
                var attempts = (mineData && mineData.items) ? mineData.items : [];

                QuestionnaireService.GetForTarget(type, id).then(function(data) {
                    var items = (data && data.items) ? data.items : [];
                    // Students only see published questionnaires.
                    items = items.filter(function(q) { return q.is_published; });
                    items.forEach(function(q) {
                        q._qid = q.questionnaire_id || q.id;
                        // Match an attempt for THIS questionnaire + timing (+ this target).
                        var a = attempts.filter(function(at) {
                            return String(at.questionnaire_id) === String(q._qid) &&
                                   (at.timing || 'pre') === (q.timing || 'pre');
                        })[0];
                        q._attempt = a || null;
                        q._status = a ? a.status : 'not_started';
                    });
                    vm.qPre = items.filter(function(q) { return q.timing !== 'post'; });
                    vm.qPost = items.filter(function(q) { return q.timing === 'post'; });
                });
            });

            CourseMaterialService.ListForTarget(type, id).then(function(data) {
                var mats = (data && data.items) ? data.items : [];
                // Students: list is already published+ready; split by timing.
                vm.matPre = mats.filter(function(m) { return m.timing === 'pre'; });
                vm.matPost = mats.filter(function(m) { return m.timing !== 'pre'; });
            });
        }

        vm.qActionLabel = function(q) {
            switch (q._status) {
                case 'opened': case 'in_progress': return 'Continue';
                case 'submitted': case 'reviewed': return 'View result';
                default: return 'Start';
            }
        };
        vm.qBadge = function(q) {
            switch (q._status) {
                case 'reviewed': return 'cc-badge--green';
                case 'submitted': return 'cc-badge--blue';
                case 'opened': case 'in_progress': return 'cc-badge--amber';
                default: return 'cc-badge--grey';
            }
        };
        vm.qStatusText = function(q) {
            switch (q._status) {
                case 'opened': case 'in_progress': return 'In progress';
                case 'submitted': return 'Submitted';
                case 'reviewed': return 'Reviewed';
                default: return 'Not started';
            }
        };
        vm.openQuestionnaire = function(q) {
            if (q._attempt && (q._status === 'submitted' || q._status === 'reviewed')) {
                $state.go('dashboard.my_account.questionnaire_result', { attempt_id: q._attempt.id });
            } else {
                $state.go('dashboard.my_account.questionnaire_take', {
                    questionnaire_id: q._qid,
                    attach_type: vm.contentScope,
                    attach_id: vm.contentAttachId,
                    timing: q.timing || 'pre'
                });
            }
        };
        vm.openMaterial = function(m) {
            $state.go('dashboard.my_account.material_view', { material_id: m.id });
        };

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
                        // Fetch decrypted file data for each file
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
                                    // Auto-select the first file when it finishes loading
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

       
        $scope.back = function(){
            $rootScope.safeBack();
        }



        initController();

        function initController() {
           //console.log("check if access is okay");
        }


       


    }