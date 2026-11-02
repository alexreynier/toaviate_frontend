app.controller('StudentSnapshotModalController', StudentSnapshotModalController);

    // The "Student snapshot" modal (views/directives/student_snapshot.html),
    // opened by StudentSnapshotService.open() from the Scheduler's booking popup
    // and the instructor Briefing list. Read-only: loads one GET and formats it.
    StudentSnapshotModalController.$inject = ['$uibModalInstance', '$state', 'StudentSnapshotService', 'ToastService', 'student_id', 'booking_id', 'club_id'];
    function StudentSnapshotModalController($uibModalInstance, $state, StudentSnapshotService, ToastService, student_id, booking_id, club_id) {
        var vm = this;

        vm.student_id = student_id;
        vm.booking_id = booking_id;
        vm.loading = true;
        vm.error = null;          // { error, message } when the load failed
        vm.data = null;
        vm.focus_course = null;   // the booked / only course, shown prominently
        vm.other_courses = [];    // every other course with records, newest flight first
        vm.expanded = {};         // record id → remarks expanded

        vm.close = close;
        vm.hours = hours;
        vm.toggleRemarks = toggleRemarks;
        vm.openRecord = openRecord;
        vm.recordLesson = recordLesson;
        vm.lessonNumber = lessonNumber;
        vm.telHref = telHref;

        load();

        function load() {
            vm.loading = true;
            var params = booking_id ? { booking_id: booking_id } : { club_id: club_id };
            StudentSnapshotService.Get(student_id, params)
                .then(function(data) {
                    vm.loading = false;
                    if (!data || data.success === false) {
                        vm.error = {
                            error: data && data.error,
                            message: (data && data.message) || 'Could not load the student snapshot.'
                        };
                        if (vm.error.error !== 'FORBIDDEN') {
                            ToastService.error('Load Failed', vm.error.message);
                        }
                        return;
                    }
                    vm.data = data;
                    splitCourses(data);
                });
        }

        // The focus course (booked for, or their only one) goes first and gets
        // the big card; the rest are listed underneath.
        function splitCourses(data) {
            vm.focus_course = null;
            vm.other_courses = [];
            var focus_id = parseInt(data.focus_course_id, 10) || 0;
            angular.forEach(data.courses || [], function(c) {
                if (focus_id > 0 && parseInt(c.id, 10) === focus_id) {
                    vm.focus_course = c;
                } else {
                    vm.other_courses.push(c);
                }
            });
        }

        // Decimal hours → "22:15" (same maths as the student record page's
        // get_hours_from_decimal; 0 shows as "0:00" rather than blank).
        function hours(dec) {
            var h = parseFloat(dec);
            if (isNaN(h)) { return '0:00'; }
            var sign = h < 0 ? '-' : '';
            var hour = Math.floor(Math.abs(h));
            var min = Math.round((Math.abs(h) * 60) % 60);
            if (min === 60) { hour++; min = 0; }
            return sign + hour + ':' + (min < 10 ? '0' : '') + min;
        }

        // "Lesson 3" from a 0-based organise, as the Briefing list does
        function lessonNumber(lesson) {
            if (!lesson || lesson.organise === undefined || lesson.organise === null) { return ''; }
            return 'Lesson ' + (parseInt(lesson.organise, 10) + 1);
        }

        // "Ex 4 · Effects of controls", or "Import note only" for a TPC placeholder
        function recordLesson(r) {
            if (!r) { return ''; }
            if (parseInt(r.import_note_only, 10) === 1 && !r.lesson_title) { return 'Import note only'; }
            var parts = [];
            if (r.lesson_reference) { parts.push(r.lesson_reference); }
            if (r.lesson_title) { parts.push(r.lesson_title); }
            return parts.length ? parts.join(' · ') : 'No lesson recorded';
        }

        function toggleRemarks(r) {
            vm.expanded[r.id] = !vm.expanded[r.id];
        }

        // Phone numbers come in as typed ("07700 900 123"); tel: wants digits/+
        function telHref(phone) {
            if (!phone) { return ''; }
            return 'tel:' + String(phone).replace(/[^\d+]/g, '');
        }

        // "Open full student record" — leaves the Scheduler / Briefing page, so
        // close the modal first or it would sit over the new page.
        function openRecord(course_id) {
            if (!vm.data) { return; }
            var params = {
                club_id: vm.data.club_id,
                student_id: vm.data.student.id,
                course_id: course_id || null
            };
            $uibModalInstance.close('record');
            $state.go('dashboard.manage_user.student_records', params);
        }

        function close() {
            $uibModalInstance.dismiss('close');
        }
    }
