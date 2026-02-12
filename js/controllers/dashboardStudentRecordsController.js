 app.controller('DashboardStudentRecordsController', DashboardStudentRecordsController);

    DashboardStudentRecordsController.$inject = ['ClubService', 'UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'BookingService', 'MemberService', '$sce', 'ToastService'];
    function DashboardStudentRecordsController(ClubService, UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, BookingService, MemberService, $sce, ToastService) {
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

        // // vm.club_id = $rootScope.globals.currentUser.current_club_instructor;
        // if($rootScope.globals.currentUser.access){
        //     // $rootScope.globals.currentUser.manager;
        //     // $rootScope.globals.currentUser.pilot;
        //     // $rootScope.globals.currentUser.instructor;

        //     vm.combined_clubs = [].concat(
        //       $rootScope.globals.currentUser.manager || [],
        //       $rootScope.globals.currentUser.pilot || [],
        //       $rootScope.globals.currentUser.instructor || []
        //     );

        // }
        // vm.club_id = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.exams = [];

        
        switch(vm.action){
            
            case "student_records":
                // //console.log("view list of existing courses");

              

                // CourseService.GetCoursesByClubId(vm.club_id)
                //     .then(function(data){

                //         vm.courses = data.items;

                //     });

                MemberService.GetAllByClubStudents(vm.club_id)
                    .then(function(data){

                        vm.courses = data.courses;
                        vm.members = data.members;

                    });

               


            break;
            case "student_record":
                console.log("view list of existing courses", vm.user_id);

                vm.student_id = vm.user_id;

                


                    //get clubs
                    ClubService.GetAllForUser(vm.user_id).then(function(data){

                        vm.clubs = data.clubs;
                        if(vm.clubs.length < 2 && vm.clubs.length > 0){
                            vm.club_id = vm.clubs[0].id;
                            vm.update_club_selector();
                        }
                    });

                    // CourseService.GetCoursesByUserId(vm.student_id)
                    // .then(function(data){

                    //     vm.courses = data.items;

                    // });

                    // CourseService.GetCoursesByClubId(vm.club_id)
                    // .then(function(data){

                    //     vm.courses = data.items;

                    // });
                    

              

               


            break;
            default:
                // //console.log("none of the above... redirect somewhere?");
            break;
        }  

        vm.show_record = false;
        vm.show_add_exam = false;

        vm.update_club_selector = function(){

            CourseService.GetCoursesByClubId(vm.club_id)
                    .then(function(data){

                        vm.courses = data.items;

                    });
        }

        vm.load_records = function(){
            if(!vm.member || !vm.course){
                ToastService.warning('Selection Required', 'You need to select a member and a course to see their training records');
            } else {
                vm.student_id = vm.member.user_id;
                vm.course_id = vm.course.id;

                 CourseService.GetStudentTrainingRecords(vm.student_id, vm.course_id)
                    .then(function(data){
                        vm.show_record = true;
                        vm.all_items = data.all_items;   
                        vm.student = data.student;
                        vm.training_records = data.training_records;   
                        vm.exams = data.exams;
                        vm.exam_records = data.exam_records;
                        vm.course_totals = data.course_hours;
                        vm.log_sheets = data.log_sheets;
                    });

            }
        }

        vm.get_initial = function(text){
                return text.charAt(0);
            }

            vm.list_pilots = function(row){

            var p1 = "";
            var put = "";

            // if(row.instructor_first_name && row.instructor_first_name !== null){
            //     p1 = "PIC: "+row.instructor_first_name+" "+row.instructor_last_name;
            //     put = "<br />PUT: "+row.first_name+" "+row.last_name;
            // } else {
            //     if(row.first_name && row.first_name !== null){
            //         p1 = "PIC: "+row.first_name+" "+row.last_name;
            //     } else {
            //         p1 = "PIC not yet set!";
            //     }
            // }

            p1 = "PIC: "+ vm.get_pic(row);
            put = vm.get_put(row);
            if(put && put !== ""){
                put = "<br />PUT: " + put;
            }

            if(p1 && p1 == ""){
                p1 = "No PIC set yet!";
            }

            return $sce.getTrustedHtml('<div>'+p1+' '+put+'</div>');

        }

        vm.get_pic = function(log){

            var p1 = "";

            if(log.pic_first_name && log.pic_first_name !== null){
                p1 = vm.get_initial(log.pic_first_name) + ". " + log.pic_last_name;
            } else if(log.instructor_first_name && log.instructor_first_name !== ""){
                p1 = vm.get_initial(log.instructor_first_name) + ". " + log.instructor_last_name;
            } else if(log.instructor_id == 0 && log.first_name && log.first_name !== ""){
                p1 = vm.get_initial(log.first_name) + ". " + log.last_name;
            }

            return p1;

        }

        vm.get_put = function(log){

            var put = "";

            if(log.put_first_name && log.put_first_name !== null){
                put = vm.get_initial(log.put_first_name) + ". " + log.put_last_name;
            } else if(log.instructor_id > 0 && log.first_name && log.first_name !== ""){
                put = vm.get_initial(log.first_name) + ". " + log.last_name;
            } 

            return put;

        }

        vm.get_hours_from_decimal = function(time){

            if(time){
                 var sign = time < 0 ? "-" : "";
                 var hour = Math.floor(Math.abs(time));
                 var min = Math.round((Math.abs(time) * 60) % 60);
                 if(min == 60){
                     hour++;
                     min = 0;
                 }
                 return sign + (hour < 10 ? "0" : "") + hour + ":" + (min < 10 ? "0" : "") + min;
             } else {
                 return "N/A";
             }
        }

        vm.clean_times = function(time){
                return time.substring(0,5);
            }



        vm.search3 = function(row){
            //(angular.lowercase(row.first_name).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)  || (angular.lowercase(row.last_name).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)
            ////console.log("answer", (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1));
            // return ((angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || (angular.lowercase(row.flight_time).indexOf(angular.lowercase($scope.my_search2)) || '') !== -1)));
            //(angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)
           
            // if( (test_date($scope.my_search2, row.flight_date)) || (angular.lowercase(row.destination_airport).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.departure_airport).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.destination_airport_code).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) || (angular.lowercase(row.departure_airport_code).indexOf(angular.lowercase($scope.my_search2) || '') !== -1)){
            //     return true;
            // } else {
            //     return false;
            // }
            ////console.log($scope.my_search2);
            if(!vm.my_search3 || (vm.my_search3 == "")){
                return true;
            }else if(test_date(vm.my_search3, row.flight_date)){
                return true;
            } else if(test_name(row.first_name, row.last_name, vm.my_search3 )){
                return true;
            } else if(test_name(row.pic_first_name, row.pic_last_name, vm.my_search3 )){
                return true;
            } else if(test_name(row.instructor_first_name, row.instructor_last_name, vm.my_search3 )){
                return true;
            } else if(test_aircraft(row.registration, vm.my_search3 )){
                return true;
            } else if(test_airfield(vm.my_search3, row.departure_airport, row.departure_airport_code)){
                return true;
            } else if(test_airfield(vm.my_search3, row.destination_airport, row.destination_airport_code)){
                return true;
            }else {
                return false;
            }

            // we are testing for the date, the pilot, the departure and destination.

            // return (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1); // ? (angular.lowercase(row.flight_date).indexOf(angular.lowercase($scope.my_search2) || '') !== -1) : (angular.lowercase(row.flight_time).indexOf(angular.lowercase($scope.my_search2) || '') !== -1);

        };

        function test_date(search, date){


            if(search.length < 2){
                return false;
            }

            if(search && search.length <= 3){
                if(date.indexOf(search) > -1){
                    return true;
                }
            } else {
                var parsed_date = "";
                var b = moment(search);
                if(b.isValid() && b.format("YYYY") != "2001"){
                    parsed_date = b.format("YYYY-MM-DD");
                } else if(b.isValid()){
                    parsed_date = b.format("MM-DD");
                }


                var search_type = 0;

                if(parsed_date !== "" && date.indexOf(parsed_date) > -1){
                    // //console.log("found");
                    return true;
                } else {

                    //backup in case of wrong parsing data::;
                    //european method

                    if(search.length <= 5 && search.length >= 4){

                        var c = moment(search, "DDMM");
                        // //console.log("C is : ", c);
                        if(c.isValid()){
                            var c2 = c.format("MM-DD");
                            if(date.indexOf(c2) > -1){
                                return true;
                            }
                        }

                    } else if(search.length == 8 || search.length == 10){
                        
                        var c = moment(search, "DDMMYYYY");
                        // //console.log("C is : ", c);
                        if(c.isValid()){
                            var c2 = c.format("YYYY-MM-DD");
                            if(date.indexOf(c2) > -1){
                                return true;
                            }
                        }

                    }

                    // //console.log("not found");
                    return false;
                }
            }

        }


        function test_name(fname, lname, search){

            var search2 = search.toLowerCase();
            var fullname = fname+" "+lname;
            fullname = fullname.toLowerCase();    
            // //console.log("fullname: ", fullname);
            // //console.log("search: ", search2);
            // //console.log("match: ", (fullname.indexOf(search2) > -1));
            if(search.length > 2 && (fullname.indexOf(search2) > -1) ){
                return true;
            } else {
                return false;
            }

        }

        function test_aircraft(registration, search){

            var search2 = search.toLowerCase().replace("-", "");
            var fullname = registration.replace("-", "");
            fullname = fullname.toLowerCase();    
            //  //console.log("fullname: ", fullname);
            // //console.log("search: ", search2);
            // //console.log("match: ", (fullname.indexOf(search2) > -1));
            if(search.length > 2 && (fullname.indexOf(search2) > -1) ){
                return true;
            } else {
                return false;
            }

        }

        function test_airfield(search, name, code){
            var name2 = name.toLowerCase();
            var code2 = code.toLowerCase();
            var search2 = search.toLowerCase();

            if(search2.length > 2 && (name2.indexOf(search2) > -1)){
                return true;
            } else if(search2.length > 2 && (code2.indexOf(search2) > -1)){
                return true;
            } else {
                return false;
            }



        }

        vm.load_records_user = function(){
            if( !vm.course){
                ToastService.warning('Selection Required', 'You need to select a course to see your training records');
            } else {

                vm.course_id = vm.course.id;

                 CourseService.GetStudentTrainingRecords(vm.student_id, vm.course_id)
                    .then(function(data){
                        vm.show_record = true;
                        vm.all_items = data.all_items;   
                        vm.student = data.student;
                        vm.training_records = data.training_records;   
                        vm.exams = data.exams;
                        vm.exam_records = data.exam_records;
                        vm.course_totals = data.course_hours;
                        vm.log_sheets = data.log_sheets;
                    });

            }
        }

        vm.load_selected_flight = function(flight_id){


        }

        vm.add_exam_record = function(){
            //console.log("NEW EXAM", vm.new_exam);
            vm.new_exam.user_id = vm.student_id;
            vm.new_exam.course_id = vm.course_id;
            CourseService.CreateExamRecord(vm.new_exam)
                                .then(function(data){
                                    if(data.success){
                                        vm.load_records();
                                        vm.show_add_exam = false;

                                        //clear the vm.new_exam

                                    } else {
                                        ToastService.error('Exam Error', 'The exam could not be added');
                                    }
                                });
        }

        vm.get_remarks = function(item_id, record){

             var object = record.items.find(function(item){ return item.lesson_item_id === item_id; });
             

            return (object) ? object.remarks : "";

        }

        vm.get_result = function(item_id, record){

            var object = record.items.find(function(item){ return item.lesson_item_id === item_id; });

            return (object) ? object.grade_name : "";

        }

        vm.get_result3 = function(item_id){

            var object = record.items.find(function(item){ return item.lesson_item_id === item_id; });

            return (object) ? object.grade_name : "";

        }

        vm.get_competence = function(item_id, record){

            var object = record.items.find(function(item){ return item.lesson_item_id === item_id; });
            var icons = "";
            var icons2 = "";
            if(object && object.grade_colour && object.grade_name){
                icons = $sce.getTrustedHtml('<span style="color: '+object.grade_colour+'" ><i class="fa fa-'+object.grade_icon+'" style="color: '+object.grade_colour+'"></i></span>');
                
                icons2 = $sce.trustAsHtml('<span style="color: '+object.grade_colour+'" ><i class="fa fa-'+object.grade_icon+'" style="color: '+object.grade_colour+'"></i></span>');
                // console.log("COLOUR: "+object.grade_colour+" AND NAME: "+object.grade_name+" AND TITLE: "+object.grade_name);
            }



            return (object) ? icons2 : "";
            
        }

        vm.get_competence2 = function(object){

            //var object = record.items.find(function(item){ return item.lesson_item_id === item_id; });
            var icons = "";
            var icons2 = "";
            if(object && object.grade_colour && object.grade_name){
                icons = $sce.getTrustedHtml('<span style="color: '+object.grade_colour+'" ><i class="fa fa-'+object.grade_icon+'" style="color: '+object.grade_colour+'"></i></span>');
                
                icons2 = $sce.trustAsHtml('<span style="color: '+object.grade_colour+'" ><i class="fa fa-'+object.grade_icon+'" style="color: '+object.grade_colour+'"></i></span>');
                // console.log("COLOUR: "+object.grade_colour+" AND NAME: "+object.grade_name+" AND TITLE: "+object.grade_name);
            }



            return (object) ? icons2 : "";
            
        }

        vm.get_flight_date = function(item_id, record){
            var item = record.items.find(function(item){ return item.lesson_item_id === item_id; });
            return (item) ? item.flight_date : "";
        }

        vm.user_can_edit = false;

        vm.get_record_details = function(item_id, record){
            
            var item = record.items.find(function(item){ return item.lesson_item_id === item_id; });

            if(item){


                var record_details = "<h4>Training Record Details</h4><table class='inner_overlay_tble'>";

                if(item.flight_date && item.flight_date !== ""){
                    record_details += "<tr><td>Flight Date:</td><td>"+item.flight_date+"</td></tr>";
                }

                if(item.instructor_id > 0 && item.instructor_first_name !== ""){
                    record_details += "<tr><td><span class='instructor'>Instructor:</span></td><td>"+vm.get_initial(item.instructor_first_name)+" "+item.instructor_last_name+"</td></tr>";
                }

                if(item.completed_by > 0 && item.completed_by_first_name !== "" && item.completed_by !== item.instructor_id){
                    record_details += "<tr><td><span class='instructor'>Record By:</span></td><td>"+vm.get_initial(item.completed_by_first_name)+" "+item.completed_by_last_name+"</td></tr>";
                }

                if(item.remarks && item.remarks !== ""){
                    record_details += "<tr><td><span class='instructor'>Remarks:</td><td></td></tr><tr><td colspan='2'>"+item.remarks+"</td> </tr>";
                }

                if(record_details && record_details !== ""){
                    record_details += "</table>";
                }



                return $sce.getTrustedHtml(record_details);
            } else{
                return " ";
            }
        }

        vm.get_record_details2 = function(item){
            
            //var item = record.items.find(function(item){ return item.lesson_item_id === item_id; });

            if(item){


                var record_details = "<h4>Training Record Details</h4><table class='inner_overlay_tble'>";

                if(item.flight_date && item.flight_date !== ""){
                    record_details += "<tr><td>Flight Date:</td><td>"+item.flight_date+"</td></tr>";
                }

                if(item.registration && item.registration !== ""){
                    record_details += "<tr><td>Aircraft:</td><td>"+item.registration+"</td></tr>";
                    record_details += "<tr><td>Type:</td><td>"+item.plane_type+"</td></tr>";
                }



                if(item.instructor_id > 0 && item.instructor_first_name !== ""){
                    record_details += "<tr><td><span class='instructor'>Instructor:</span></td><td>"+vm.get_initial(item.instructor_first_name)+" "+item.instructor_last_name+"</td></tr>";
                }

                if(item.completed_by > 0 && item.completed_by_first_name !== "" && item.completed_by !== item.instructor_id){
                    record_details += "<tr><td><span class='instructor'>Record By:</span></td><td>"+vm.get_initial(item.completed_by_first_name)+" "+item.completed_by_last_name+"</td></tr>";
                }

                if(item.remarks && item.remarks !== ""){
                    record_details += "<tr><td><span class='instructor'>Remarks:</td><td></td></tr><tr><td colspan='2'>"+item.remarks+"</td> </tr>";
                }

                if(record_details && record_details !== ""){
                    record_details += "</table>";
                }



                return $sce.getTrustedHtml(record_details);
            } else{
                return "This objective has not yet been marked as complete by your instructor";
            }
        }

        vm.get_exam = function(exam_id){

            var object = vm.exam_records.find(function(item){ return item.exam_id === exam_id; });
            return (object) ? object : "";
        }

        vm.open_training_detail = function(pls_id, plane_log_sheet){
            vm.show_popup = true;
            show_edit_training_record = false;
            vm.show_popup_name = "see_records";
            vm.flight_detail_id = pls_id;
            vm.user_can_edit = vm.user_can_edit_record();

            vm.selected_flight = plane_log_sheet;

            //fetch the new one here?
            vm.selected_record = {};
            vm.selected_record_remarks = "";

            CourseService.GetStudentTrainingRecordsForFlight(vm.student_id, vm.course_id, vm.flight_detail_id)
                    .then(function(data){
                        
                        vm.competences = data.competences;   
                        vm.selected_record = data.all_items;
                        vm.selected_record_remarks = data.general_remarks;
                        vm.this_entry = data.this_entry;

                    });
        }

        vm.close_popup = function(){
            vm.show_popup = false;

            vm.show_edit_training_record = false;

            vm.selected_record = {};
            vm.selected_record_remarks = "";
            vm.this_entry = {};

        }


        function load_course(){


             ////console.log("PARAMS", $state);
            CourseService.GetCourseById($stateParams.course_id)
                    .then(function(data){
                        vm.course = data.item;   
            
                    });
             
            CourseService.GetExamsByCourseId($stateParams.course_id)
                    .then(function(data){
                        vm.course.exams = data.items;   
                
                    });

            CourseService.GetLessonsByCourseId($stateParams.course_id)
                    .then(function(data){
                        vm.course.lessons = data.items;   
                    });



        }


       

       
        $scope.back = function(){
            $window.history.back();
        }



        initController();

        function initController() {
           //console.log("check if access is okay");
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
        vm.all_tags = [];
        vm.show_edit_training_record = false;
        vm.show_edit_record = function(){

            //OK let's edit some records!!!
            vm.show_edit_training_record = true;
            vm.lesson = vm.selected_record;
            vm.plane_log_sheet = vm.selected_flight;//vm.lesson.log_sheets;

            console.log("PLS : ", vm.plane_log_sheet);
            console.log("TAGS : ", vm.plane_log_sheet.flight_tags);

            CourseService.GetTagsByCourseId(vm.course_id)
            .then(function(data){
                for(var i=0;i<data.items.length;i++){
                    data.items.flight_tag_id = data.items.id;
                }  
                vm.all_tags = data.items; 
            });

            //cleaning it??
            vm.selected_flight_tags = vm.plane_log_sheet.flight_tags;
            for(var i=0;i<vm.selected_flight_tags.length;i++){
                vm.selected_flight_tags[i]["logging_time"] = Math.round((vm.selected_flight_tags[i].tag_time * 60) / 5) * 5;
            }


            CourseService.GetExamsByCourseId(vm.course_id)
                                .then(function(data){
                                    vm.course.exams = data.items;   
                            
                                });

            CourseService.GetLessonsByCourseId(vm.course_id)
                    .then(function(data){
                        vm.course.lessons = data.items;   
                    });

            vm.is_lesson_completed = (vm.this_entry.completed == 1)? true : false;

        }

        vm.tag_flight_time = 0;

        vm.add_tag = function(){
            //CHECK IF ADD DOES ALREADY EXIST!!!
            if(vm.selected_flight_tags.find(tag => tag.flight_tag_id === vm.flight_tag.id)){
                ToastService.warning('Duplicate Tag', 'You already have this tag on this flight!');
                return false;
            }

            //matching the correct tag IDs
            vm.flight_tag.flight_tag_id = vm.flight_tag.id;

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


        /*
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

        */

        vm.save_edit_record = function(){

            console.log("SAVE THE UPDATE NOW!! WHOOP WHOOP!!");

            console.log("THIS ENTRY : ", vm.this_entry);
            console.log("FLIGHT TAGS : ", vm.selected_flight_tags);
            console.log("SELECTED RECORD?? : ", vm.selected_record);

            var compiled_items = [];
            for(var i=0;i<vm.selected_record.length;i++){
                if( (vm.selected_record[i].this_entry && (vm.selected_record[i].this_entry.result || vm.selected_record[i].this_entry.remarks) && (vm.selected_record[i].this_entry.result > -1 || vm.selected_record[i].this_entry.remarks !== "")) ){
                    var entry = {"remarks": vm.selected_record[i].this_entry.remarks, "result": vm.selected_record[i].this_entry.result, "lesson_item_id": vm.selected_record[i].id};
                    compiled_items.push(entry);
                }
            }
// {"id":100,"training_record_id":6,"lesson_item_id":1,"result":4,"completed_by":2,"remarks":"","updated_at":"2024-10-31 18:46:17","created_at":"2024-10-31 18:46:17","deleted":0,"deleted_at":"0000-00-00 00:00:00","grade_name":"Competent","grade_icon":"star","grade_colour":"#4CBB17","plane_log_sheet_id":138,"general_remarks":"Flew very well almost there","pic_id":2,"put_id":3,"user_id":3,"instructor_id":2,"flight_date":"2024-09-29","plane_id":13,"instructor_first_name":"Alex","instructor_last_name":"Reynier","pic_first_name":"Alex","pic_last_name":"Reynier","put_first_name":"Camilla","put_last_name":"Barber","usr_first_name":"Camilla","usr_last_name":"Barber","completed_by_first_name":"Alex","completed_by_last_name":"Reynier","registration":"G-NIXIS","plane_type":"C182","type_name":"SKYLANE"}}
            //some rough checks:::

            console.log("COMPILED ITEMS: ", compiled_items);
            // //console.log("PROGRESS: ", compiled_items.length);

            if(compiled_items.length < 1 && (!vm.general_remarks || vm.general_remarks == "")){
                ToastService.warning('Validation', 'To save student records, you need to tick at least one student progress record item OR add a general remark');
                return false;
            }

            var next_lesson = vm.this_entry.next_lesson_id;

            console.log("NEXT LESSON: ", next_lesson);

            if(vm.lesson_completed == 1 && vm.next_lesson && vm.next_lesson.id > 0){
                next_lesson = vm.next_lesson.id;
            }

            console.log("NEXT LESSON: ", next_lesson);
            console.log("vm.booking_id : ", vm.booking_id);

            vm.compiled_save = {
                update_record_id: vm.this_entry.id,
                club_id: vm.this_entry.club_id,
                items: compiled_items,
                general_remarks: vm.this_entry.general_remarks,//vm.general_remarks,
                lesson_id: vm.this_entry.lesson_id,
                course_id: vm.this_entry.course_id,
                user_id: vm.this_entry.user_id, // vm.student.id,
                instructor_id: vm.this_entry.instructor_id,
                completed_by: vm.this_entry.completed_by,
                plane_log_sheet_id: vm.selected_flight.id,
                next_lesson_id: next_lesson,
                edited_by: vm.user.id,
                completed: (vm.lesson_completed) ? 1 : 0,
                //booking_id: vm.booking_id,
                flight_tags: vm.selected_flight_tags,
                edit_reason: vm.edit_reason
            };

            console.log("COMPILED SAVE");
            console.log(vm.compiled_save);
            console.log("COMPILED SAVE");

            
            //SENT THIS COMPILED SAVE TO THE SERVER


            CourseService.UpdateTrainingRecord(vm.compiled_save, vm.this_entry.id)
                .then(function(data){
                    if(data.success){

                        ToastService.success('Records Saved', 'Thank you!');
                        //$state.go('dashboard.manage_user', {reload: true});
                        //vm.show_record = false;
                        //vm.show_edit_record = false;
                        

                        CourseService.GetStudentTrainingRecords(vm.student_id, vm.course_id)
                        .then(function(data){
                            vm.show_record = true;
                            vm.all_items = data.all_items;   
                            vm.student = data.student;
                            vm.training_records = data.training_records;   
                            vm.exams = data.exams;
                            vm.exam_records = data.exam_records;
                            vm.course_totals = data.course_hours;
                            vm.log_sheets = data.log_sheets;
                        });

                        vm.show_edit_training_record = false;
                        vm.close_popup();

                        //clearing this
                        vm.lesson = {};
                        vm.plane_log_sheet = {};
                        vm.compiled_save = {};
                        vm.this_entry = {};

                    } else {
                        ToastService.error('Save Failed', 'We could not save your training records...');
                    }
        
                });


            // CLOSE THIS VIEW

            // RELOAD THE BELOW VIEW




            
        }


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

        vm.user_can_edit_record = function(){
            // vm.training_records.club_id
            // vm.user.access.manager
            var is_manager = (vm.user.access.manager.find(function(item){ return item === vm.training_records.club_id; }))? true : false;

            if(vm.training_records.instructor_id == vm.user_id || vm.user_id == vm.training_records.completed_by || is_manager){
                console.log("should have access to edit this record");
                return true;
            }

            console.log("should NOT have access to edit this record - tempo return true though");
            //this should be false
            return true;
        }
       


    }