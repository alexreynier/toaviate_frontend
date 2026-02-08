 app.controller('DashboardCourseSyllabusViewController', DashboardCourseSyllabusViewController);

    DashboardCourseSyllabusViewController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService'];
    function DashboardCourseSyllabusViewController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService) {
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