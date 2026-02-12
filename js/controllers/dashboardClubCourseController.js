 app.controller('DashboardClubCourseController', DashboardClubCourseController);

    DashboardClubCourseController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'ToastService'];
    function DashboardClubCourseController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, ToastService) {
        var vm = this;

           //    /* PLEASE DO NOT COPY AND PASTE THIS CODE. */(function(){var w=window,C='___grecaptcha_cfg',cfg=w[C]=w[C]||{},N='grecaptcha';var gr=w[N]=w[N]||{};gr.ready=gr.ready||function(f){(cfg['fns']=cfg['fns']||[]).push(f);};(cfg['render']=cfg['render']||[]).push('explicit');(cfg['onload']=cfg['onload']||[]).push('initRecaptcha');w['__google_recaptcha_client']=true;var d=document,po=d.createElement('script');po.type='text/javascript';po.async=true;po.src='https://www.gstatic.com/recaptcha/releases/JPZ52lNx97aD96bjM7KaA0bo/recaptcha__en.js';var e=d.querySelector('script[nonce]'),n=e&&(e['nonce']||e.getAttribute('nonce'));if(n){po.setAttribute('nonce',n);}var s=d.getElementsByTagName('script')[0];s.parentNode.insertBefore(po, s);})();

           // var initRecaptcha = function () { 
           //     // document.getElementById("SearchModule").scope().vm.parent.isGrecaptchaLoaded = !0, 
           //     // document.getElementById("SearchModule").scope().vm.showRecaptcha();
           //     vm.showRecaptcha();
           // };
              


        vm.charge_type = ["brakes", "session", "plane", "brakes_rounded"];

        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            course: {
                
            }
        };

        vm.page_title = "";
        
        vm.course_document = {};
        vm.course_documents = [];

        var update_this_file = [];
        
       

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;
        // //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;


        vm.course_certificate = {};
        vm.course_noise = {};
        vm.course_radio = {};
        vm.course_maintenance = {};
        vm.course_insurance = {};

        vm.club.lessons = [];
        vm.exams = [];
        vm.tags = [];
        vm.instructor_charges = [];

        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);


        vm.editing = false;
        vm.edit_course = false;

        switch(vm.action){
            case "add":
                //console.log("adding a new course please");
                vm.page_title = "Add a New Course";
            break;
            case "edit":
                vm.editing = true;
                vm.edit_course = true;
                //console.log("edit an existing course");


                CourseService.GetCourseById($stateParams.course_id)
                    .then(function(data){
                        vm.club.course = data.item;   
            
                        vm.page_title = "Edit a Course - "+vm.club.course.title;
                    });
 
                    CourseService.GetLessonsByCourseId($stateParams.course_id)
                    .then(function(data){
                        vm.club.lessons = data.items;   
            


                    });

                      refresh_exams();
                      refresh_tags();
                      refresh_charges();



            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                CourseService.GetCoursesByClubId(vm.club_id)
                    .then(function(data){
                        vm.club.courses = data.items;   
                        //console.log(vm.club.courses);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        function refresh_exams(){
             CourseService.GetExamsByCourseId($stateParams.course_id)
                    .then(function(data){
                        vm.exams = data.items;   
                


                    });
        }

        function refresh_tags(){
             CourseService.GetTagsByCourseId($stateParams.course_id)
                    .then(function(data){
                        vm.tags = data.items;   
                


                    });
        }

        function refresh_charges(){

                 CourseService.GetChargesByCourseId($stateParams.course_id)
                    .then(function(data){
                        vm.instructor_charges = data.items;   
                


                    });
        }

        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $window.history.back();
        }



        vm.clearFieldError = function(event) { ToastService.clearFieldError(event); };

        $scope.save = function(){
            var checks = [
                { ok: vm.club.course.title, field: 'title', label: 'Course Title' }
            ];
            if (!ToastService.validateForm(checks)) return;

            if(vm.action == "add"){
                $scope.create();
            } else {
                $scope.update();
            }
        }

        
        $scope.save_lesson_order = function(){
            // //console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.club.lessons.length;i++){
                var me = {
                    id: vm.club.lessons[i].id,
                    organise: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);

            CourseService.UpdateLessonOrder({"order": update_order})
                .then(function(data){
                    //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });

        }

        vm.delete_lesson = function(id, index){

            if(confirm("Are you sure you wish to delete this lesson? This is irreversible.")){
                CourseService.DeleteLesson(id)
                .then(function(data){
                    //console.log(data);
                    if(data.success){
                        vm.club.lessons.splice(index, 1);
                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
            }

            
        }

        vm.update_exam = function(exam, index){

            delete(exam.edit_me);

            CourseService.UpdateExam(exam)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.exams[index].edit_me = false;

                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel = function(index){
            refresh_exams();
        }

        vm.edit_exam = function(index){

            vm.exams[index].edit_me = true;

        }

        vm.delete_exam = function(exam, index){
            // //console.log("EXAM", exam);
            if(confirm("Are you sure you wish to delete this exam? This is irreversible.")){

                CourseService.DeleteExam(exam.id)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){
                            vm.exams.splice(index, 1);
                        } else {
                            ToastService.error('Error', 'An error occurred');
                        }
                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                    });
            }
        }

       
        
        vm.add_exam = function(){

            vm.new_exam.course_id = $stateParams.course_id; 
            vm.new_exam.club_id = vm.club_id; 

            CourseService.CreateExam(vm.new_exam)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.exams.push(data.item);

                        vm.new_exam = {
                            title: "",
                            description: ""
                        }

                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }






        vm.update_tag = function(tag, index){

            ToastService.warning('Tag Removal', 'This tag being removed will not remove the tag from previous flights where this tag was already applied.');

            delete(tag.edit_me);

            CourseService.UpdateTags(tag)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.tags[index].edit_me = false;

                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel_tag = function(index){
            refresh_tags();
        }

        vm.edit_tag = function(index){

            vm.tags[index].edit_me = true;

        }

        vm.delete_tag = function(tag, index){
            // //console.log("EXAM", exam);
            if(confirm("Are you sure you wish to delete this tag? If this tag has already been assigned to particular flight(s) this will not remove these from existing flights.")){

                CourseService.DeleteTags(tag.id)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){
                            vm.tags.splice(index, 1);
                        } else {
                            ToastService.error('Error', 'An error occurred');
                        }
                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                    });
            }
        }

       
        
        vm.add_tag = function(){

            vm.new_tag.course_id = $stateParams.course_id; 
            vm.new_tag.club_id = vm.club_id; 

            CourseService.CreateTags(vm.new_tag)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.tags.push(data.item);

                        vm.new_tag = {
                            title: ""
                        }

                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }














        vm.update_charge = function(charge, index){

            delete(charge.edit_me);

            CourseService.UpdateCharge(charge)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.instructor_charges[index].edit_me = false;

                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel_charge = function(index){
            refresh_charges();
        }

        vm.edit_charge = function(index){

            vm.instructor_charges[index].edit_me = true;

        }

        vm.delete_charge = function(charge, index){
            // //console.log("EXAM", exam);
            if(confirm("Are you sure you wish to delete this instructor charge? This is irreversible.")){

                CourseService.DeleteCharge(charge.id)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){
                            vm.instructor_charges.splice(index, 1);
                        } else {
                            ToastService.error('Error', 'An error occurred');
                        }
                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                    });
            }
        }

       
        
        vm.add_charge = function(){

            vm.new_charge.course_id = $stateParams.course_id; 
            vm.new_charge.club_id = vm.club_id; 

            CourseService.CreateCharge(vm.new_charge)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.instructor_charges.push(data.item);

                        vm.new_charge = {
                            title: "",
                            charge_type: "",
                            price: ""
                        }

                    } else {
                        ToastService.error('Error', 'An error occurred');
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }
















         vm.delete_course = function(id, index){
            if(confirm("Are you sure you wish to delete this course? This is irreversible.")){

                CourseService.DeleteCourse(id)
                    .then(function(data){
                        //console.log(data);
                        if(data.success){
                            vm.club.courses.splice(index, 1);
                        } else {
                            ToastService.error('Error', 'An error occurred');
                        }
                        //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                    });
            } 
        }

        $scope.create = function(){
            ////console.log("CREATE ME NOW");
         
            //return false;
            //return false;
            vm.club.course.club_id = vm.club_id;

            CourseService.CreateCourse(vm.club.course)
                .then(function(data){
                    ////console.log(data);
                    if(data.success){
                        $state.go('dashboard.manage_club.edit_course', {course_id: data.id, reload: true});
                    }

                });


        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Delete Course', 'Are you sure you would like to delete this course?');
            CourseService.DeleteCourse(vm.club.course.id)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.course_documents);

                for(var k=0;k<vm.club.course.course_documents.length;k++){
                    //console.log("comparing to : ", vm.club.course.course_documents[k].id);
                    if(vm.club.course.course_documents[k].id == id){
                        documents.push(vm.club.course.course_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
         

            CourseService.UpdateCourse(vm.club.course)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.courses');
                });
        }


        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }


       

        $scope.add_item = function(type){
            //console.log("ADD");
            switch(type){
                case "licence":
                    //console.log("licence");
                    if(vm.temporary.licence && vm.temporary.licence !== "" && vm.temporary.rating && vm.temporary.rating !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_licence = {
                            licence_id: vm.temporary.licence.id,
                            licence_title: vm.temporary.licence.abbreviation,
                            rating_title: vm.temporary.rating.abbreviation,
                            rating_id: vm.temporary.rating.id
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_licence, vm.club.course.requirements.licence, new Array("licence_id", "rating_id")) == false){
                            vm.club.course.requirements.licence.push(add_licence);
                        }

                        delete vm.temporary.licence;
                        delete vm.temporary.rating;

                    } else {
                        ToastService.warning('Selection Required', 'Please select a licence and rating that is required to book the course solo!');
                    }

                break;


                case "medical":
                    //console.log("medical");
                    if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_medical = {
                            authority_id: vm.temporary.medical_authority.id,
                            authority_title: vm.temporary.medical_authority.abbreviation,
                            medical_component_id: vm.temporary.medical_component.id,
                            medical_component_title: vm.temporary.medical_component.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_medical, vm.club.course.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
                            vm.club.course.requirements.medical.push(add_medical);
                        }

                        delete vm.temporary.medical_authority;
                        delete vm.temporary.medical_component;

                    } else {
                        ToastService.warning('Selection Required', 'Please select a medical that is required to book the course solo!');
                    }

                break;


                case "differences":
                    //console.log("difference");
                    if(vm.temporary.difference && vm.temporary.difference !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_difference = {
                            difference_id: vm.temporary.difference.id,
                            difference_title: vm.temporary.difference.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_difference, vm.club.course.requirements.differences, new Array("difference_id", "difference_title")) == false){
                            vm.club.course.requirements.differences.push(add_difference);
                        }

                        delete vm.temporary.difference;

                    } else {
                        ToastService.warning('Selection Required', 'Please select a difference that is required to book the course solo!');
                    }

                break;


            }



        }













        $scope.update_this_file = function(file){
            //console.log("==== update is : ", file.id);
            if(update_this_file.indexOf(file.id) === -1){
                update_this_file.push(file.id)
            } else {
               ////console.log("This item already exists"); 
            } 
        }


         $scope.remove_real_file = function(file){

                //remove_file

                vm.club.course.course_documents = $.grep(vm.club.course.course_documents, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                PlaneDocumentService.Delete(vm.user_id, file.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.course_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }


        vm.files = {
            radio: [],
            cert: [],
            insurance: [],
            noise: []
        }


           $scope.processFile = function(files, location){
                 //console.log("files", files[0].file_return);

                     // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[0].file_return);
                     ////console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    files[0].file.temp_path = j.saved_url;
                    files[0].file.save_name = j.files.file.name;

                    var ft = j.files.file.name;
                    //console.log("ft", ft);
                    var fft = ft.split('.').pop();
                    files[0].file.extension = fft;
                    //console.log("FILE is : ", files[0]);

                    // //console.log("file", files[i].file);
                    vm.files[location].push(files[0].file);


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            PoidService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.course_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

          // $scope.$on('flow::fileAdded', function (event, $flow, flowFile) {
          //     event.preventDefault();//prevent file from uploading
          //     //console.log("FILE ADDED");
          //     //console.log($flow);
          //   });

            $scope.processFiles = function(files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    //console.log("J is : ",j);
                    //console.log("name is : ", j.files.file.name);

                    files[i].file.temp_path = j.saved_url;
                    files[i].file.save_name = j.files.file.name;
                    var ft = j.files.file.name;
                    ft = ft.split('.').pop();
                    files[i].file.extension = ft;

                    // //console.log("file", files[i].file);
                    vm.course_documents.push(files[i].file);
                }


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }

            $scope.get_icon = function(file){

                var ft = file.name;
                ft = ft.split('.').pop();
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }


            $scope.get_icon2 = function(file){

                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }





        initController();

        function initController() {
           //console.log("check if access is okay");
        }


       


    }