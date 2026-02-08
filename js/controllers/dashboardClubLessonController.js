 app.controller('DashboardClubLessonController', DashboardClubLessonController);

    DashboardClubLessonController.$inject = ['UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService'];
    function DashboardClubLessonController(UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService) {
        var vm = this;

           //    /* PLEASE DO NOT COPY AND PASTE THIS CODE. */(function(){var w=window,C='___grecaptcha_cfg',cfg=w[C]=w[C]||{},N='grecaptcha';var gr=w[N]=w[N]||{};gr.ready=gr.ready||function(f){(cfg['fns']=cfg['fns']||[]).push(f);};(cfg['render']=cfg['render']||[]).push('explicit');(cfg['onload']=cfg['onload']||[]).push('initRecaptcha');w['__google_recaptcha_client']=true;var d=document,po=d.createElement('script');po.type='text/javascript';po.async=true;po.src='https://www.gstatic.com/recaptcha/releases/JPZ52lNx97aD96bjM7KaA0bo/recaptcha__en.js';var e=d.querySelector('script[nonce]'),n=e&&(e['nonce']||e.getAttribute('nonce'));if(n){po.setAttribute('nonce',n);}var s=d.getElementsByTagName('script')[0];s.parentNode.insertBefore(po, s);})();

           // var initRecaptcha = function () { 
           //     // document.getElementById("SearchModule").scope().vm.parent.isGrecaptchaLoaded = !0, 
           //     // document.getElementById("SearchModule").scope().vm.showRecaptcha();
           //     vm.showRecaptcha();
           // };
              




        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            lesson: {
                
            }
        };

        vm.page_title = "";
        
        vm.lesson_document = {};
        vm.lesson_documents = [];

        var update_this_file = [];
        
       

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;
        // //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;


        vm.lesson_certificate = {};
        vm.lesson_noise = {};
        vm.lesson_radio = {};
        vm.lesson_maintenance = {};
        vm.lesson_insurance = {};

        vm.club.lessons = [];
        vm.club.lesson = {};


        vm.new_tem = {
            threat: "",
            consequence: "",
            mitigation: ""
        }

        vm.new = {
            preflight: {
                title: "",
                bullet_format: "0"
            },
            airex: {
                title: "",
                bullet_format: "0"
            },
            debrief: {
                title: "",
                bullet_format: "0"
            }
        }


        // //console.log(vm.action);
        // //console.log($stateParams);
        // //console.log($stateParams.id);


        vm.editing = false;
        
        switch(vm.action){
            case "add":
                //console.log("adding a new lesson please");
                vm.page_title = "Add a New Course";
            break;
            case "edit":
                vm.editing = true;
                //console.log("edit an existing lesson");


                CourseService.GetLessonById($stateParams.lesson_id)
                    .then(function(data){
                        vm.club.lesson = data.item;   
            
                    });

                
                refresh_tem();

                refresh_bullets();

                refresh_items();

               
                    // CourseService.GetLessonsByCourseId($stateParams.lesson_id)
                    // .then(function(data){
                    //     vm.club.lessons = data.items;   
           
                    // });



            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                // CourseService.GetLessonsByCourseId(vm.club_id)
                //     .then(function(data){
                //         vm.club.lessons = data.items;   
                //         //console.log(vm.club.lessons);
                //     });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage
       

        function refresh_bullets(){
             CourseService.GetBulletsByLessonId($stateParams.lesson_id)
                    .then(function(data){

                        vm.bullets = data.bullets;
            
                    });
        }

        function refresh_tem(){
            CourseService.GetTemByLessonId($stateParams.lesson_id)
                .then(function(data){
                    //console.log(data);

                    vm.tem = data.items;

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }

        vm.add_tem = function(){

            vm.new_tem.lesson_id = $stateParams.lesson_id; 
            vm.new_tem.organise = (vm.tem && vm.tem.length > 0) ? vm.tem.length : 0;

            CourseService.CreateTem(vm.new_tem)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.tem.push(data.item);

                        vm.new_tem = {
                            threat: "",
                            consequence: "",
                            mitigation: ""
                        }
                    } else {
                        alert("An error occurred...");
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }

        vm.update_tem = function(tem, index){

            delete(tem.edit_me);

            CourseService.UpdateTem(tem)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.tem[index].edit_me = false;

                    } else {
                        alert("An error occurred...");
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel = function(index){
            refresh_tem();
        }

        vm.edit_tem = function(index){

            vm.tem[index].edit_me = true;

        }

        vm.delete_tem = function(tem, index){

            CourseService.DeleteTem(tem.id)
                .then(function(data){
                    //console.log(data);
                    if(data.success){
                        vm.tem.splice(index, 1);
                    } else {
                        alert("An error occurred...");
                    }
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }







        vm.add_bullet = function(type){

            var no = (vm.bullets[type] && vm.bullets[type].length > 0) ? vm.bullets[type].length : 0;

            var send_me = {
                title: vm.new[type].title,
                bullet_format: vm.new[type].bullet_format,
                lesson_id: $stateParams.lesson_id,
                bullet_type: type,
                organise: no
            }

            //vm.new_tem.lesson_id = $stateParams.lesson_id; 

            CourseService.CreateBullet(send_me)
                .then(function(data){
                    //console.log(data);
                    if(data.success){
                        if(vm.bullets[type]){
                            vm.bullets[type].push(data.item);
                        } else {
                            vm.bullets[type] = Array(data.item);
                        }

                        vm.new[type].title = "";
                        vm.new[type].bullet_format = "0";
                        
                    } else {
                        alert("An error occurred...");
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }

        vm.update_bullet = function(type, bullet, index){

            delete(bullet.edit_me);

            CourseService.UpdateBullet(bullet)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.bullets[type][index].edit_me = false;

                    } else {
                        alert("An error occurred...");
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel_bullet = function(index){
            refresh_bullets();
        }

        vm.edit_bullet = function(type, index){

            vm.bullets[type][index].edit_me = true;

        }

        vm.delete_bullet = function(type, bullet, index){

            CourseService.DeleteBullet(bullet.id)
                .then(function(data){
                    //console.log(data);
                    if(data.success){
                        vm.bullets[type].splice(index, 1);
                    } else {
                        alert("An error occurred...");
                    }
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }





  

        $scope.save_bullet_order = function(type){
            ////console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.bullets[type].length;i++){
                var me = {
                    id: vm.bullets[type][i].id,
                    organise: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);

            CourseService.UpdateBulletOrder({"order": update_order})
                .then(function(data){
                   // //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });

        }


        $scope.save_items_order = function(){
            // //console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.items.length;i++){
                var me = {
                    id: vm.items[i].id,
                    organise: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);

            CourseService.UpdateItemsOrder({"order": update_order})
                .then(function(data){
                    //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });

        }

        $scope.save_tem_order = function(){
            // //console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.tem.length;i++){
                var me = {
                    id: vm.tem[i].id,
                    organise: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);

            CourseService.UpdateTemOrder({"order": update_order})
                .then(function(data){
                    //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });

        }




        function refresh_items(){
            CourseService.GetItemsByLessonId($stateParams.lesson_id)
                .then(function(data){
                    //console.log(data);

                    vm.items = data.items;

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }

        vm.add_item = function(){

            vm.new_item.lesson_id = $stateParams.lesson_id; 

            vm.new_item.organise = (vm.items && vm.items.length > 0) ? vm.items.length : 0;

            CourseService.CreateItem(vm.new_item)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.items.push(data.item);

                        vm.new_item = {
                            title: ""
                        }
                    } else {
                        alert("An error occurred...");
                    }

                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });
        }

        vm.update_item = function(item, index){

            delete(item.edit_me);

            CourseService.UpdateItem(item)
                .then(function(data){
                    //console.log(data);
                    if(data.success){

                        vm.items[index].edit_me = false;

                    } else {
                        alert("An error occurred...");
                    }
                    //refresh_tem();
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

        vm.update_cancel_item = function(index){
            refresh_items();
        }

        vm.edit_item = function(index){

            vm.items[index].edit_me = true;

        }

        vm.delete_item = function(item, index){

            CourseService.DeleteItem(item.id)
                .then(function(data){
                    //console.log(data);
                    if(data.success){
                        vm.items.splice(index, 1);
                    } else {
                        alert("An error occurred...");
                    }
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});
                });
        }

















        $scope.back = function(){
            $window.history.back();
        }



        $scope.save = function(){
          
                //console.log("EDIT click");
                //console.log(vm.club.lesson);
                $scope.update();
            
        }


        $scope.create = function(){
            ////console.log("CREATE ME NOW");
         
            //return false;
            //return false;
            vm.club.lesson.course_id = $stateParams.course_id;

            CourseService.CreateLesson(vm.club.lesson)
                .then(function(data){
                    ////console.log(data);
                    $state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });


        }

        $scope.delete = function(){
            //console.log("CLICK");
            alert("Are you sure you would like to delete this lesson?");
            CourseService.DeleteLesson(vm.club.lesson.id)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.lesson_documents);

                for(var k=0;k<vm.club.lesson.lesson_documents.length;k++){
                    //console.log("comparing to : ", vm.club.lesson.lesson_documents[k].id);
                    if(vm.club.lesson.lesson_documents[k].id == id){
                        documents.push(vm.club.lesson.lesson_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
         

            CourseService.UpdateLesson(vm.club.lesson)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.edit_course', {course_id: vm.club.lesson.course_id, reload: true});
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
                        if(containsObject(add_licence, vm.club.lesson.requirements.licence, new Array("licence_id", "rating_id")) == false){
                            vm.club.lesson.requirements.licence.push(add_licence);
                        }

                        delete vm.temporary.licence;
                        delete vm.temporary.rating;

                    } else {
                        alert("Please select a licence and rating that is required to book the lesson solo!");
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
                        if(containsObject(add_medical, vm.club.lesson.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
                            vm.club.lesson.requirements.medical.push(add_medical);
                        }

                        delete vm.temporary.medical_authority;
                        delete vm.temporary.medical_component;

                    } else {
                        alert("Please select a medical that is required to book the lesson solo!");
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
                        if(containsObject(add_difference, vm.club.lesson.requirements.differences, new Array("difference_id", "difference_title")) == false){
                            vm.club.lesson.requirements.differences.push(add_difference);
                        }

                        delete vm.temporary.difference;

                    } else {
                        alert("Please select a difference that is required to book the lesson solo!");
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

                vm.club.lesson.lesson_documents = $.grep(vm.club.lesson.lesson_documents, function(e){ 
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
                        vm.lesson_documents = [];
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
                        vm.lesson_documents = [];
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
                    vm.lesson_documents.push(files[i].file);
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