 app.controller('DashboardStudentRecordsController', DashboardStudentRecordsController);

    DashboardStudentRecordsController.$inject = ['ClubService', 'UserService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'CourseService', 'BookingService', 'MemberService', '$sce', 'ToastService', 'SoloRequirementsService', 'ExamSalesService', 'CaaFormsService'];
    function DashboardStudentRecordsController(ClubService, UserService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, CourseService, BookingService, MemberService, $sce, ToastService, SoloRequirementsService, ExamSalesService, CaaFormsService) {
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

        vm.user_id = vm.user.id;
        vm.club_id = null;
        vm.instructor_clubs = [];
        vm.selected_club = null;

        vm.exams = [];

        
        switch(vm.action){
            
            case "student_records":

                // Deep-link restore: ?club_id&student_id&course_id in the URL
                // re-select the club, student and course after a refresh, back
                // button or a shared link. Consumed once the lists have loaded.
                vm.link_student_id = $stateParams.student_id || null;
                vm.link_course_id = $stateParams.course_id || null;

                // Load the clubs this instructor belongs to. GetStaffClubs =
                // instructor OR manager clubs — GetAdminClubs alone is
                // is_manager=1 only, which locked out non-manager instructors.
                UserService.GetStaffClubs(vm.user_id)
                    .then(function(data) {
                        if (data.success && data.clubs && data.clubs.length > 0) {
                            vm.instructor_clubs = data.clubs;

                            // The URL's club wins over the localStorage one so a
                            // shared link opens on the right club.
                            var savedClubId = $stateParams.club_id || null;
                            try {
                                var stored = localStorage.getItem('toaviate_instructor_selected_club_id');
                                if (savedClubId === null && stored !== null) {
                                    savedClubId = stored;
                                }
                            } catch(e) {}

                            var selectedClub = null;
                            if (savedClubId !== null) {
                                for (var i = 0; i < vm.instructor_clubs.length; i++) {
                                    if (String(vm.instructor_clubs[i].id) === String(savedClubId)) {
                                        selectedClub = vm.instructor_clubs[i];
                                        break;
                                    }
                                }
                            }

                            if (!selectedClub) {
                                selectedClub = vm.instructor_clubs[0];
                            }

                            vm.selected_club = selectedClub;
                            vm.club_id = selectedClub.id;
                            load_students_for_club(vm.club_id);
                        } else {
                            ToastService.error('Access Error', 'You do not appear to be an instructor at any club.');
                        }
                    });

               


            break;
            case "student_record":
                console.log("view list of existing courses", vm.user_id);

                vm.student_id = vm.user_id;

                


                    //get clubs
                    ClubService.GetAllForUser(vm.user_id).then(function(data){

                        vm.clubs = data.clubs;
                        if(vm.clubs.length == 1){
                            vm.club_id = vm.clubs[0].id;
                            vm.selected_club = vm.clubs[0];
                            vm.update_club_selector();
                        } else if(vm.clubs.length > 1){
                            // Multiple clubs — user must pick one
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

        // Instructor club selector — called when dropdown changes
        vm.onInstructorClubSelected = function(club) {
            vm.selected_club = club;
            vm.club_id = club.id;

            // Persist selection
            try {
                localStorage.setItem('toaviate_instructor_selected_club_id', String(club.id));
            } catch(e) {}

            // Reset current selections
            vm.member = null;
            vm.course = null;
            vm.show_record = false;
            vm._initialMembers = [];

            // A club switch invalidates any student/course in the URL.
            sync_url(true);

            load_students_for_club(vm.club_id);
        };

        function load_students_for_club(club_id) {
            vm.members = [];
            vm.courses = [];
            vm._initialMembers = [];

            MemberService.GetAllByClubStudents(club_id)
                .then(function(data) {
                    vm.courses = data.courses;
                    vm.members = data.members || [];
                    vm._initialMembers = vm.members.slice();
                    restore_link_selection();
                });
        }

        // Re-select the student + course a deep link (?student_id&course_id)
        // points at, then load their records. Runs once, after the club's
        // member/course lists are in.
        function restore_link_selection() {
            if (!vm.link_student_id || !vm.link_course_id) { return; }
            var sid = String(vm.link_student_id);
            var cid = String(vm.link_course_id);
            vm.link_student_id = null;
            vm.link_course_id = null;

            for (var i = 0; i < (vm.members || []).length; i++) {
                if (String(vm.members[i].user_id || vm.members[i].id) === sid) {
                    vm.member = vm.members[i];
                    break;
                }
            }
            for (var j = 0; j < (vm.courses || []).length; j++) {
                if (String(vm.courses[j].id) === cid) {
                    vm.course = vm.courses[j];
                    break;
                }
            }

            vm.student_id = sid;
            vm.course_id = cid;
            fetch_student_records();
        }

        // Mirror the current selection into the URL's query params without
        // re-instantiating the controller (notify:false), so refresh / back /
        // copy-link all land straight back on this student + course.
        function sync_url(replace) {
            var options = { notify: false };
            if (replace) { options.location = 'replace'; }
            $state.go('dashboard.manage_user.student_records', {
                club_id: vm.club_id,
                student_id: vm.show_record ? vm.student_id : null,
                course_id: vm.show_record ? vm.course_id : null
            }, options);
        }

        /**
         * Called by the ui-select refresh attribute when the user types
         * in the Member dropdown. Fires an HTTP search when the local
         * client-side filter would otherwise show zero results.
         */
        vm.refreshStudentMembers = function(search) {
            if (!search || search.length < 2) {
                // Restore the initial list when the search field is cleared
                if (vm._initialMembers && vm._initialMembers.length) {
                    vm.members = vm._initialMembers.slice();
                }
                return;
            }

            MemberService.GetAllByClubAndName(vm.club_id, search)
                .then(function(data) {
                    if (data.success && data.members) {
                        // Merge server results with any existing members so we
                        // don't lose the current selection from the list.
                        var existing = vm.members || [];
                        var merged   = existing.slice();
                        var ids      = {};
                        for (var i = 0; i < merged.length; i++) {
                            ids[merged[i].user_id || merged[i].id] = true;
                        }
                        for (var j = 0; j < data.members.length; j++) {
                            var key = data.members[j].user_id || data.members[j].id;
                            if (!ids[key]) {
                                merged.push(data.members[j]);
                            }
                        }
                        vm.members = merged;
                    }
                });
        };

        vm.update_club_selector = function(){

            // Set club_id from the selected club dropdown before fetching courses
            if (vm.selected_club && vm.selected_club.id) {
                vm.club_id = vm.selected_club.id;
            }

            CourseService.GetCoursesByClubId(vm.club_id)
                    .then(function(data){

                        vm.courses = data.items;

                    });
        }

        // Called when a club is selected from the ui-select dropdown
        vm.onClubSelected = function(club) {
            vm.selected_club = club;
            vm.club_id = club.id;
            vm.course = null;
            vm.show_record = false;
            vm.update_club_selector();
        };

        // Called when a course is selected from the ui-select dropdown
        vm.onCourseSelected = function(course) {
            vm.course = course;
            vm.load_records_user();
        };

        vm.load_records = function(){
            if(!vm.member || !vm.course){
                ToastService.warning('Selection Required', 'You need to select a member and a course to see their training records');
            } else {
                vm.student_id = vm.member.user_id;
                vm.course_id = vm.course.id;
                fetch_student_records();
            }
        }

        // The actual records fetch for the instructor screen — called both by
        // the "See records" button and the deep-link restore.
        // "My documents" — the student's CAA forms at this club (completed =
        // downloadable). FRONTEND_SEP_REVALIDATION_GUIDE.md §Forms history.
        vm.caa_documents = [];
        vm.caa_pdf_busy = null;
        function load_caa_documents(){
            vm.caa_documents = [];
            CaaFormsService.List(vm.club_id, { subject_user_id: vm.student_id }).then(function(data){
                if (data && data.success === false) { return; }   // not fatal to the record screen
                var forms = (data && (data.forms || data.items)) || (angular.isArray(data) ? data : []);
                vm.caa_documents = forms.filter(function(f){ return f.status === 'completed'; });
            });
        }
        vm.openCaaForm = function(f){ $state.go('dashboard.caa_form', { id: f.id }); };
        vm.downloadCaaPdf = function(f){
            vm.caa_pdf_busy = f.id;
            CaaFormsService.GetPdf(f.id, (f.form_type || 'caa_form') + '.pdf').then(function(res){
                vm.caa_pdf_busy = null;
                if (res.success === false) {
                    ToastService.error('PDF Unavailable', res.message || 'The PDF could not be generated.');
                    return;
                }
                var url = URL.createObjectURL(res.blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = res.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function(){ URL.revokeObjectURL(url); }, 250);
            });
        };
        vm.caaTypeTitle = CaaFormsService.typeTitle;

        function fetch_student_records(){
            CourseService.GetStudentTrainingRecords(vm.student_id, vm.course_id)
                .then(function(data){
                    vm.show_record = true;
                    load_caa_documents();
                    vm.all_items = data.all_items;
                    vm.student = data.student;
                    vm.training_records = data.training_records;
                    vm.exams = data.exams;
                    vm.exam_records = data.exam_records;
                    vm.course_totals = data.course_hours;
                    vm.log_sheets = data.log_sheets;
                    // Same lesson accordions the member-facing screen uses.
                    vm.lessons = group_items_by_lesson(vm.all_items);
                    vm.grade_legend = build_grade_legend(vm.all_items);
                    vm.loadSoloReadiness();
                    // The course's lessons back the record-edit lesson pickers.
                    load_course_lessons();
                    // Deep-link where the student wasn't in the initial member
                    // list (it's search-backed) — surface them in the picker
                    // from the record itself.
                    if(!vm.member && data.student){
                        vm.member = {
                            user_id: data.student.id,
                            first_name: data.student.first_name,
                            last_name: data.student.last_name
                        };
                    }
                    sync_url();
                });
        }

        // The course's full lesson list — backs both lesson pickers in the record
        // edit form (this record's lesson, and the student's next lesson).
        vm.all_lessons = [];
        function load_course_lessons(){
            if(!vm.course_id){ return; }
            CourseService.GetLessonsByCourseId(vm.course_id)
                .then(function(data){
                    vm.all_lessons = data.items || [];
                });
        }

        // Short label for a flight row's lesson column. course_reference is
        // optional club data (blank on most lessons), so fall back to the
        // lesson number, then the title — a stored lesson must never render
        // as an empty cell.
        vm.lesson_ref = function(log){
            if(!log || !log.lesson_id){ return ''; }
            var num = log.lesson_number;
            var ref = log.lesson_reference;
            if(num && ref){ return 'Lesson ' + num + ': ' + ref; }
            if(ref){ return ref; }
            if(num){ return 'Lesson ' + num; }
            return log.lesson_title || '';
        };

        // A lesson's display label, e.g. "Lesson 4 — Straight and Level Part 1".
        vm.lesson_label = function(lesson){
            if(!lesson || !lesson.id){ return ''; }
            var num = lesson.organise || lesson.lesson_number;
            return (num ? 'Lesson ' + num + ' — ' : '') + lesson.title;
        };

        // The distinct grades actually used in this course's records, so the
        // legend only ever shows grades the club has configured.
        function build_grade_legend(items){
            var seen = {};
            var legend = [];
            (items || []).forEach(function(it){
                var e = it.last_entry;
                if(e && e.grade_name && !seen[e.grade_name]){
                    seen[e.grade_name] = true;
                    legend.push({ name: e.grade_name, colour: e.grade_colour, icon: e.grade_icon });
                }
            });
            return legend;
        }

        // ── Student solo readiness (pilot checks / pre-solo requirements) ──
        // Per-student checklist against the club's pre-solo requirements,
        // scoped to the course being viewed (all-courses items + this course).
        // Instructors/managers sign manual items off here; auto items
        // (medical / questionnaire / exam) are system-verified and cannot be
        // signed off by hand. Each row carries a `state` + ready-to-display
        // `detail` (BACKEND_PRE_SOLO_COURSE_REQUIREMENTS_GUIDE.md §4.3).
        vm.solo = { loading: false, status: null, busy: {}, signing: null, form: {} };

        vm.loadSoloReadiness = function(){
            if (!vm.club_id || !vm.student_id) { return; }
            vm.solo.loading = true;
            vm.solo.signing = null;
            SoloRequirementsService.GetStatus(vm.club_id, vm.student_id, vm.course_id).then(function(data){
                vm.solo.loading = false;
                // No requirements configured (or no access) → hide the panel.
                vm.solo.status = (data && data.success && data.requirements && data.requirements.length) ? data : null;
            });
        };

        // Status chip per state: green tick, amber "review now", red failure,
        // grey outstanding. Unknown/legacy states fall back on `satisfied`.
        vm.soloStateKind = function(req){
            if (req.satisfied) { return 'ok'; }
            if (req.state === 'pending_review' || req.state === 'in_progress') { return 'review'; }
            if (req.state === 'medical_expired' || req.state === 'medical_class_not_accepted' ||
                req.state === 'below_min_score' || req.state === 'not_passed' || req.state === 'no_medical') { return 'fail'; }
            return 'todo';
        };

        // The questionnaire attempt awaiting review — deep-link straight into
        // the marking screen so it can be reviewed with the student.
        vm.soloReviewAttempt = function(req){
            if (!req.evidence || !req.evidence.id) { return; }
            $state.go('dashboard.manage_club.questionnaire_review', { attempt_id: req.evidence.id });
        };

        vm.soloStartSignOff = function(req){
            vm.solo.signing = req.id;
            vm.solo.form = { expires_at: null, notes: '' };
        };

        vm.soloCancelSignOff = function(){
            vm.solo.signing = null;
        };

        vm.soloSignOff = function(req){
            if (vm.solo.busy[req.id]) { return; }
            vm.solo.busy[req.id] = true;
            var payload = { club_id: vm.club_id, user_id: vm.student_id, requirement_id: req.id };
            if (vm.solo.form.expires_at) { payload.expires_at = moment(vm.solo.form.expires_at).format('YYYY-MM-DD'); }
            if (vm.solo.form.notes && vm.solo.form.notes.trim()) { payload.notes = vm.solo.form.notes.trim(); }
            SoloRequirementsService.SignOff(payload).then(function(data){
                vm.solo.busy[req.id] = false;
                if (data && data.success){
                    ToastService.success('Signed Off', '"' + req.name + '" signed off for ' + vm.student.first_name + '.');
                    vm.loadSoloReadiness();
                } else {
                    ToastService.error('Not Signed Off', (data && data.message) || 'Could not record the sign-off — please try again.');
                }
            });
        };

        // Two-step inline revoke (no browser confirm); history is kept server-side.
        vm.soloAskRevoke = function(req){ req._confirmRevoke = true; };
        vm.soloCancelRevoke = function(req){ req._confirmRevoke = false; };
        vm.soloRevoke = function(req){
            if (vm.solo.busy[req.id] || !req.sign_off) { return; }
            vm.solo.busy[req.id] = true;
            SoloRequirementsService.RevokeSignOff(req.sign_off.id).then(function(data){
                vm.solo.busy[req.id] = false;
                req._confirmRevoke = false;
                if (data && data.success){
                    ToastService.success('Revoked', '"' + req.name + '" sign-off revoked for ' + vm.student.first_name + '.');
                    vm.loadSoloReadiness();
                } else {
                    ToastService.error('Not Revoked', (data && data.message) || 'Could not revoke the sign-off — please try again.');
                }
            });
        };

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
                return roundTimeToMinute(time);
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
                        // Completed questionnaires for this course (added to the records
                        // endpoint). Empty/absent until the backend returns it — the
                        // section then renders without any further frontend change.
                        vm.questionnaires = data.questionnaires || [];
                        // Group the flat objective list into lessons for the accordion view.
                        vm.lessons = group_items_by_lesson(vm.all_items);
                        vm.grade_legend = build_grade_legend(vm.all_items);
                    });

            }
        }

        // Group the flat all_items (objectives, already ordered by lesson then item)
        // into per-lesson buckets for the collapsible lesson view. Each objective
        // carries lesson_id / lesson_title / lesson_number, so no backend change is
        // needed for the grouping itself.
        function group_items_by_lesson(items){
            var byId = {};
            var order = [];
            (items || []).forEach(function(it){
                var lid = it.lesson_id;
                if(!byId[lid]){
                    byId[lid] = {
                        lesson_id: lid,
                        lesson_title: it.lesson_title,
                        lesson_number: it.lesson_number,
                        items: [],
                        collapsed: true   // accordions start closed
                    };
                    order.push(lid);
                }
                byId[lid].items.push(it);
            });
            return order.map(function(lid){
                var lesson = byId[lid];
                // Progress: how many objectives have been graded by an instructor.
                lesson.graded_count = lesson.items.filter(function(i){ return !!i.last_entry; }).length;
                lesson.total_count = lesson.items.length;
                // "Lesson complete" = the instructor's stored sign-off (training_records.
                // completed). The backend exposes it on each objective's last_entry once
                // added; a lesson counts complete when its latest entries are flagged.
                // Until the flag is present the tick simply doesn't show (no false ticks).
                var withEntries = lesson.items.filter(function(i){ return !!i.last_entry; });
                lesson.is_completed = withEntries.length > 0 && withEntries.every(function(i){
                    return Number(i.last_entry.completed) === 1;
                });
                return lesson;
            });
        }
        vm.toggle_lesson = function(lesson){ lesson.collapsed = !lesson.collapsed; };

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

        // ── Exam result actions (edit / history / delete — audited) ──
        // Shares the exam_result/audit modals with the shop + exam-results
        // screens. Delete is manager-only and soft; a purchased exam's result
        // returns to the outstanding-results list. BACKEND_EXAM_SALES_GUIDE.md §5.4.
        // Live check — the page's club selector can change vm.club_id.
        vm.is_manager = function(){
            return (vm.user.access.manager || []).indexOf(vm.club_id) > -1 ||
                   (vm.user.access.super_admin || []).length > 0;
        };

        vm.exam_edit = function(exam){
            var record = vm.get_exam(exam.id);
            if (!record || !record.id) { return; }
            $uibModal.open({
                templateUrl: 'views/modals/exam_result_modal.html',
                controller: 'ExamResultModalController',
                controllerAs: 'vm',
                backdrop: 'static',
                resolve: { context: function(){ return {
                    mode: 'edit',
                    record: record,
                    exam_title: exam.title,
                    course_title: vm.course ? vm.course.title : '',
                    student_name: vm.student ? (vm.student.first_name + ' ' + vm.student.last_name) : '',
                    is_manager: vm.is_manager()
                }; } }
            }).result.then(function(res){
                if (res && res.saved) { vm.load_records(); }
            }, function(){});
        };

        vm.exam_history = function(exam){
            var record = vm.get_exam(exam.id);
            if (!record || !record.id) { return; }
            $uibModal.open({
                templateUrl: 'views/modals/exam_audit_modal.html',
                controller: 'ExamAuditModalController',
                controllerAs: 'vm',
                size: 'lg',
                resolve: { context: function(){ return {
                    exam_record_id: record.id,
                    heading: exam.title + (vm.student ? ' — ' + vm.student.first_name + ' ' + vm.student.last_name : '')
                }; } }
            });
        };

        vm.exam_ask_delete = function(exam){
            var record = vm.get_exam(exam.id);
            if (record) { record._confirmDelete = true; }
        };
        vm.exam_cancel_delete = function(exam){
            var record = vm.get_exam(exam.id);
            if (record) { record._confirmDelete = false; }
        };
        vm.exam_delete = function(exam){
            var record = vm.get_exam(exam.id);
            if (!record || !record.id || record._busy) { return; }
            record._busy = true;
            ExamSalesService.DeleteRecord(record.id).then(function(data){
                record._busy = false;
                record._confirmDelete = false;
                if (data && data.success){
                    ToastService.success('Result Deleted', '"' + exam.title + '" removed from ' + vm.student.first_name + '\'s records.');
                    vm.load_records();
                } else {
                    ToastService.error('Not Deleted', (data && data.message) || 'The exam result could not be deleted.');
                }
            });
        };

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

        // ── Grade chips ──
        // The grade colour is club-configured, so it can only come through as an
        // inline style. These build the chip's style/icon from an entry rather
        // than hand-rolling an HTML string through $sce like get_competence2 did.
        vm.grade_style = function(entry){
            if(!entry || !entry.grade_colour){ return {}; }
            return { color: entry.grade_colour, 'border-color': entry.grade_colour };
        };
        vm.grade_icon_class = function(entry){
            return (entry && entry.grade_icon) ? ('fa fa-' + entry.grade_icon) : '';
        };
        vm.has_grade = function(entry){
            return !!(entry && entry.grade_name);
        };

        // The grade options in the edit form come from /training_records' `competences`,
        // which only guarantees id + title — colour/icon may or may not be there. Read
        // them defensively so the picker shows a coloured icon when the club has
        // configured one, and a readable text pill when it hasn't.
        function competence_colour(competence){
            return competence ? (competence.colour || competence.grade_colour) : null;
        }
        vm.competence_icon = function(competence){
            var icon = competence ? (competence.icon || competence.grade_icon) : null;
            return icon ? ('fa fa-' + icon) : '';
        };
        // A selected segment fills SOLID in the grade's colour so a graded row is
        // unmistakable. Unselected segments stay plain (styled by CSS).
        vm.competence_style = function(competence, entry){
            var colour = competence_colour(competence);
            if(!vm.is_graded_as(entry, competence) || !colour){ return {}; }
            return { 'background-color': colour, 'border-color': colour, color: '#fff' };
        };

        vm.is_graded_as = function(entry, competence){
            return !!(entry && competence && String(entry.result) === String(competence.id));
        };

        // "Has this objective been graded at all?" — result 0/null/'' means no.
        vm.is_graded = function(entry){
            return !!(entry && entry.result !== null && entry.result !== undefined &&
                      entry.result !== '' && Number(entry.result) > 0);
        };

        // Drives the "x of y graded" banner over the objectives table. Counts the
        // entries the instructor is actually editing in the drawer.
        vm.graded_count = function(rows){
            var n = 0;
            (rows || []).forEach(function(r){ if(vm.is_graded(r.this_entry)) { n++; } });
            return n;
        };
        vm.grade_percent = function(rows){
            if(!rows || !rows.length){ return 0; }
            return Math.round((vm.graded_count(rows) / rows.length) * 100);
        };

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

        // ── Course questionnaires (completed by this student, with results) ──
        // Mirrors the Exams section. Each item is a questionnaire attempt for this
        // course (latest attempt per questionnaire, scored once released).
        vm.questionnaire_status_text = function(q){
            if(q.status === 'reviewed' || q.score_released) return 'Reviewed';
            if(q.status === 'submitted') return 'Submitted';
            if(q.status === 'opened' || q.status === 'in_progress') return 'In progress';
            return 'Not started';
        };
        // Show the score only once released (matches the student-facing gating).
        vm.questionnaire_has_score = function(q){
            return !!(q && q.score_released && q.max_score);
        };
        // Open the released result page for this attempt (same route the logbook /
        // questionnaire hub use). Only meaningful for a submitted/reviewed attempt.
        vm.open_questionnaire_result = function(q){
            if(!q || !q.attempt_id) return;
            $state.go('dashboard.my_account.questionnaire_result', { attempt_id: q.attempt_id });
        };

        // Open the flight replay/debrief for a student's logged flight. Shown
        // only when the row carries has_track (a recorded device track). log.id
        // is the plane_log_sheets.id the replay endpoints key on.
        vm.canReplay = function(log){
            return !!(log && log.has_track && log.id);
        };
        vm.viewReplay = function(log){
            if(!vm.canReplay(log)) return;
            $state.go('dashboard.flight_replay', { flight_id: log.id });
        };

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

            // Don't carry an edit's lesson choice / reason into the next record.
            vm.lesson_choice = null;
            vm.next_lesson = null;
            vm.original_lesson_id = null;
            vm.edit_reason = "";
            vm.edit_reason_error = false;
            vm.my_search4 = "";

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
            $rootScope.safeBack();
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

            // Seed the tag editor from THIS RECORD's tags, not the log sheet's.
            // Tags are scoped by student_record_id — on a shared flight the log
            // sheet carries every student's tags, so seeding from
            // plane_log_sheet.flight_tags loaded the wrong set, and because the save
            // is replace-all it then overwrote this record's real tags with them.
            // The backend now returns the correct set on this_entry.flight_tags.
            //
            // Times: the record returns tag_minutes (minutes) alongside tag_time
            // (hours as stored); the write payload speaks minutes (logging_time).
            // Prefer tag_minutes and fall back to converting tag_time for any
            // response that predates it.
            var record_tags = (vm.this_entry && vm.this_entry.flight_tags) || [];
            vm.selected_flight_tags = record_tags.map(function(tag){
                var mins = (tag.tag_minutes !== undefined && tag.tag_minutes !== null)
                    ? Number(tag.tag_minutes)
                    : Math.round((Number(tag.tag_time) * 60) / 5) * 5;
                // Copy — never mutate the fetched record in place.
                return angular.extend({}, tag, { logging_time: mins });
            });


            CourseService.GetExamsByCourseId(vm.course_id)
                                .then(function(data){
                                    vm.course.exams = data.items;

                                });

            // The lesson pickers repeat over vm.all_lessons. Load them if the
            // records fetch hasn't already, then seed both selections from the
            // record being edited.
            if(vm.all_lessons.length){
                seed_lesson_pickers();
            } else {
                CourseService.GetLessonsByCourseId(vm.course_id)
                    .then(function(data){
                        vm.all_lessons = data.items || [];
                        seed_lesson_pickers();
                    });
            }

            // The save reads vm.lesson_completed — keep the flag it binds to and
            // the flag it saves as one and the same.
            vm.lesson_completed = (vm.this_entry.completed == 1);
            vm.edit_reason = "";

        }

        // Point both lesson dropdowns at the record's current lesson / next lesson.
        // vm.original_lesson_id is what the change-warning compares against.
        function seed_lesson_pickers(){
            vm.lesson_choice = find_lesson(vm.this_entry.lesson_id);
            vm.next_lesson   = find_lesson(vm.this_entry.next_lesson_id);
            vm.original_lesson_id = vm.this_entry.lesson_id;
        }

        function find_lesson(lesson_id){
            if(!lesson_id){ return null; }
            for(var i=0;i<vm.all_lessons.length;i++){
                if(String(vm.all_lessons[i].id) === String(lesson_id)){
                    return vm.all_lessons[i];
                }
            }
            return null;
        }

        // True once the instructor picks a different lesson for this record. The
        // view shows an amber warning and makes the edit reason mandatory, because
        // objectives already graded here belong to the lesson it's moving off.
        vm.lesson_was_changed = function(){
            return !!(vm.lesson_choice && vm.original_lesson_id &&
                      String(vm.lesson_choice.id) !== String(vm.original_lesson_id));
        };

        vm.original_lesson_label = function(){
            return vm.lesson_label(find_lesson(vm.original_lesson_id));
        };

        vm.tag_flight_time = 0;

        vm.add_tag = function(){
            //CHECK IF ADD DOES ALREADY EXIST!!!
            if(vm.selected_flight_tags.find(tag => tag.flight_tag_id === vm.flight_tag.id)){
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
            // vm.all_tags, so mutating it would stamp flight_tag_id/logging_time
            // onto the master tag list itself.
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

            // Send EVERY objective on the record, not just the ones that look
            // "changed". The old guard dropped any item with no grade and no
            // remarks (and also any grade whose id is 0, since 0 is falsy). If the
            // backend rebuilds the record's item set from this array, a dropped
            // objective is lost from the record — which is how an edit could gut a
            // record. Sending the full set makes the payload a faithful snapshot.
            //
            // `remarks` must always be a STRING: JSON.stringify silently omits
            // undefined properties, so an untouched remark used to vanish from the
            // payload entirely rather than round-tripping as "".
            var compiled_items = [];
            for(var i=0;i<vm.selected_record.length;i++){
                var this_entry = vm.selected_record[i].this_entry || {};
                var result = this_entry.result;
                compiled_items.push({
                    lesson_item_id: vm.selected_record[i].id,
                    // null (not undefined) so an ungraded objective is explicit on the wire
                    result: (result === undefined || result === null || result === '') ? null : result,
                    remarks: this_entry.remarks || ''
                });
            }

            console.log("COMPILED ITEMS: ", compiled_items);

            // Has the instructor actually recorded anything? (Distinct from what we
            // SEND — we send every objective, but we still won't save an empty record.)
            var has_any_grade = compiled_items.some(function(it){
                return (it.result !== null && Number(it.result) > 0) || it.remarks !== '';
            });

            if(!has_any_grade && (!vm.this_entry.general_remarks || vm.this_entry.general_remarks == "")){
                ToastService.warning('Validation', 'To save student records, you need to grade at least one objective OR add a general remark');
                return false;
            }

            // Safety net: a tag that was picked from the dropdown but never committed
            // with "Add …" is NOT in selected_flight_tags, so it would be silently
            // dropped. Catch it rather than lose the instructor's intent.
            if(vm.flight_tag && vm.flight_tag.id){
                var pending = vm.flight_tag;
                vm.confirm_dialog = {
                    kind: 'pending_tag',
                    message: '"' + String(pending.title).toUpperCase() + '" was selected but never added to the flight. ' +
                             'Add it before saving, or discard it?',
                    changes: [],
                    confirmLabel: 'Add it and save',
                    cancelLabel: 'Discard it and save',
                    onConfirm: function(){
                        vm.confirm_dialog = null;
                        vm.add_tag();          // commits the pending tag
                        vm.save_edit_record(); // re-run; flight_tag is cleared so this won't loop
                    },
                    onCancel: function(){
                        vm.confirm_dialog = null;
                        vm.flight_tag = "";    // discard, then save without it
                        vm.save_edit_record();
                    }
                };
                return false;
            }

            // Re-filing a record under a different lesson is a real data change —
            // the objectives graded on it were graded against the old lesson. Make
            // the instructor say why.
            vm.edit_reason_error = false;
            if(vm.lesson_was_changed() && (!vm.edit_reason || vm.edit_reason.trim() === "")){
                vm.edit_reason_error = true;
                ToastService.warning('Reason Required', 'You have changed this record\'s lesson — please give a reason for the edit.');
                return false;
            }

            // The lesson this record is filed under (the headline). Falls back to
            // whatever it already was if the picker never loaded.
            var lesson_id = (vm.lesson_choice && vm.lesson_choice.id) ? vm.lesson_choice.id : vm.this_entry.lesson_id;

            var next_lesson = vm.this_entry.next_lesson_id;

            if(vm.lesson_completed && vm.next_lesson && vm.next_lesson.id > 0){
                next_lesson = vm.next_lesson.id;
            }

            // ── The payload is now an OVERRIDE, not a snapshot ──
            // PUT /training_records/{id} treats the STORED record as the base: any
            // field we omit is inherited, not blanked. So we send only what the
            // instructor actually changed, plus edited_by (required).
            //
            // We deliberately do NOT echo back user_id / instructor_id / club_id /
            // course_id / plane_log_sheet_id. Echoing them is what broke record 6162:
            // `user_id: vm.this_entry.user_id` was sending the INSTRUCTOR's id, which
            // re-filed the record under the instructor and made it vanish from the
            // student's list. Omitting them means they simply can't be corrupted.
            // (BACKEND_TRAINING_RECORD_EDIT_GUIDE.md)
            vm.compiled_save = {
                update_record_id: vm.this_entry.id,
                edited_by: vm.user.id,
                items: compiled_items,
                general_remarks: vm.this_entry.general_remarks,
                lesson_id: lesson_id,
                next_lesson_id: next_lesson,
                completed: (vm.lesson_completed) ? 1 : 0,
                flight_tags: vm.selected_flight_tags,
                edit_reason: vm.edit_reason
            };

            console.log("COMPILED SAVE");
            console.log(vm.compiled_save);

            send_record_update(vm.compiled_save);
        }

        // Submits the edit, handling the backend's confirmation flows. A
        // CONFIRM_REQUIRED response is HTTP 200 + success:false and writes NOTHING,
        // so it's safe to ask the user and retry the same payload with the matching
        // confirm flag set.
        function send_record_update(payload){

            vm.saving_record = true;

            CourseService.UpdateTrainingRecord(payload, vm.this_entry.id)
                .then(function(data){
                    vm.saving_record = false;

                    if(data && data.success){
                        ToastService.success('Records Saved', 'Thank you!');
                        reload_after_save();
                        return;
                    }

                    if(data && data.error === 'CONFIRM_REQUIRED'){
                        confirm_and_retry(payload, data);
                        return;
                    }

                    // A stale tab edited a version that has since been superseded.
                    if(data && data.error === 'ALREADY_SUPERSEDED'){
                        ToastService.error('Record Out Of Date',
                            'This record has been edited elsewhere since you opened it. Please reload and try again.');
                        return;
                    }

                    ToastService.error('Save Failed',
                        (data && data.message) || 'We could not save your training records...');
                });
        }

        // The two confirmations the backend can ask for. Both are destructive-ish
        // and genuinely intentional in some cases, so we ask rather than block.
        function confirm_and_retry(payload, data){

            if(data.confirm === 'identity_change'){
                vm.confirm_dialog = {
                    kind: 'identity_change',
                    // Backend sends a human-readable sentence naming both people.
                    message: data.message || 'This will move the record to a different student or flight.',
                    changes: data.changes || [],
                    onConfirm: function(){
                        vm.confirm_dialog = null;
                        payload.confirm_identity_change = true;
                        send_record_update(payload);
                    }
                };
                return;
            }

            if(data.confirm === 'item_removal'){
                var n = (data.removed_lesson_item_ids || []).length;
                vm.confirm_dialog = {
                    kind: 'item_removal',
                    message: data.message || (n + ' already-graded objective(s) would be removed from this record.'),
                    changes: [],
                    onConfirm: function(){
                        vm.confirm_dialog = null;
                        payload.confirm_item_removal = true;
                        send_record_update(payload);
                    }
                };
                return;
            }

            ToastService.error('Save Failed', data.message || 'This edit needs confirmation, but we did not understand the request.');
        }

        vm.confirm_dialog = null;
        // Some dialogs (the pending-tag one) need Cancel to DO something — discard the
        // tag and carry on saving — rather than just close.
        vm.cancel_confirm_dialog = function(){
            var dialog = vm.confirm_dialog;
            vm.confirm_dialog = null;
            if(dialog && dialog.onCancel){ dialog.onCancel(); }
        };

        function reload_after_save(){
            // Editing always creates a NEW record version (regulatory audit trail),
            // so never re-key off the old id — just refetch the student's records.
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
                    vm.questionnaires = data.questionnaires || [];
                    vm.lessons = group_items_by_lesson(vm.all_items);
                    vm.grade_legend = build_grade_legend(vm.all_items);
                });

            vm.show_edit_training_record = false;
            vm.close_popup();

            vm.lesson = {};
            vm.plane_log_sheet = {};
            vm.compiled_save = {};
            vm.this_entry = {};


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

        // Export Course Record as PDF
        vm.exporting_pdf = false;
        vm.exportCourseRecord = function() {
            if (!vm.course_id || !vm.student_id) {
                ToastService.warning('Export Error', 'Please load a course record first.');
                return;
            }

            vm.exporting_pdf = true;

            CourseService.ExportCourseRecord(vm.course_id, vm.student_id)
                .then(function(response) {
                    vm.exporting_pdf = false;

                    if (response && response.data) {
                        var blob = new Blob([response.data], { type: 'application/pdf' });
                        var downloadUrl = URL.createObjectURL(blob);
                        var link = document.createElement('a');
                        link.href = downloadUrl;

                        var studentName = '';
                        if (vm.student && vm.student.first_name) {
                            studentName = vm.student.first_name + '_' + vm.student.last_name + '_';
                        }
                        var courseName = '';
                        if (vm.course && vm.course.title) {
                            courseName = vm.course.title.replace(/[^a-zA-Z0-9]/g, '_') + '_';
                        }
                        link.download = 'Course_Record_' + courseName + studentName + vm.course_id + '.pdf';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(downloadUrl);

                        ToastService.success('Export Complete', 'Your course record PDF has been downloaded.');
                    } else {
                        ToastService.error('Export Failed', 'Could not generate the course record PDF.');
                    }
                })
                .catch(function(err) {
                    vm.exporting_pdf = false;
                    console.error('Course record export failed:', err);
                    ToastService.error('Export Failed', 'An error occurred while generating the PDF. Please try again.');
                });
        };


    }