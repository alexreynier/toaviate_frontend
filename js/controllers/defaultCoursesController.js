// ═══════════════════════════════════════════════════════════════════
//  DefaultCoursesController — the ToAviate base-syllabus library
//  (FRONTEND_DEFAULT_COURSES_GUIDE.md). Platform staff author default
//  courses in club 0 (the reserved template space) with the normal course
//  screens via the dashboard.super_admin.default_course_* alias states,
//  then deep-copy them onto clubs from here. The backend is authoritative
//  (ToAviate-admin gated; 403 otherwise).
// ═══════════════════════════════════════════════════════════════════

app.controller('DefaultCoursesController', DefaultCoursesController);

    DefaultCoursesController.$inject = ['DefaultCoursesService', 'ToastService', '$rootScope', '$state', '$uibModal'];
    function DefaultCoursesController(DefaultCoursesService, ToastService, $rootScope, $state, $uibModal) {
        var vm = this;

        vm.is_staff = $rootScope.isToAviateStaff();
        vm.loading = false;
        vm.items = [];

        // Inline "+ New default" form.
        vm.creating = false;
        vm.createBusy = false;
        vm.newCourse = { title: '', description: '' };

        if (vm.is_staff) { load(); }

        function load() {
            vm.loading = true;
            DefaultCoursesService.List().then(function(data) {
                vm.loading = false;
                if (data && data.success === false) {
                    // 403 = not a ToAviate admin server-side — mirror the gate.
                    if (data.status === 403) { vm.is_staff = false; return; }
                    ToastService.error('Could Not Load', data.message || 'The default-course library could not be loaded.');
                    return;
                }
                vm.items = (data && data.items) || [];
            });
        }
        vm.reload = load;

        vm.startCreate = function() { vm.creating = true; vm.newCourse = { title: '', description: '' }; };
        vm.cancelCreate = function() { vm.creating = false; };
        vm.create = function() {
            if (!(vm.newCourse.title || '').trim()) {
                ToastService.highlightField('dc-new-title');
                ToastService.warning('Title Required', 'Give the default course a name (e.g. "PPL(A) Base Syllabus").');
                return;
            }
            vm.createBusy = true;
            DefaultCoursesService.Create({
                title: vm.newCourse.title.trim(),
                description: (vm.newCourse.description || '').trim()
            }).then(function(data) {
                vm.createBusy = false;
                if (!data || data.success === false || !data.id) {
                    ToastService.error('Could Not Create', (data && data.message) || 'Please try again.');
                    return;
                }
                ToastService.success('Default Created', 'Now author its lessons, questionnaires and materials.');
                // Straight into the normal course editor, pointed at club 0.
                $state.go('dashboard.super_admin.default_course_edit', { course_id: data.id });
            });
        };

        vm.open = function(it) {
            $state.go('dashboard.super_admin.default_course_edit', { course_id: it.id });
        };

        vm.copy = function(it) {
            $uibModal.open({
                templateUrl: 'views/modals/default_course_copy.html',
                controller: 'DefaultCourseCopyModalCtrl',
                controllerAs: 'vm',
                size: 'lg',
                backdrop: 'static',
                windowClass: 'sec-modal-window',
                resolve: { course: function() { return it; } }
            }).result.then(function(copied) {
                if (copied) { load(); }   // refresh the "Copied to …" lines
            }, function() {});
        };

        // "Copied to: The Pilot Centre (12 Aug), …" line.
        vm.copiesLabel = function(it) {
            var copies = it.copies || [];
            if (!copies.length) { return 'Never copied'; }
            return 'Copied to: ' + copies.map(function(c) {
                var when = c.created_at ? (' (' + String(c.created_at).substring(0, 10) + ')') : '';
                return (c.club_title || ('club ' + c.club_id)) + when;
            }).join(', ');
        };
    }

// ── "Copy to club…" modal: search club → preview → copy ──────────────
app.controller('DefaultCourseCopyModalCtrl', DefaultCourseCopyModalCtrl);

    DefaultCourseCopyModalCtrl.$inject = ['$uibModalInstance', 'DefaultCoursesService', 'ToastService', '$timeout', 'course'];
    function DefaultCourseCopyModalCtrl($uibModalInstance, DefaultCoursesService, ToastService, $timeout, course) {
        var vm = this;

        vm.course = course;
        vm.stage = 'pick';       // pick | preview | confirm_force | copying | done | busy
        vm.busy = false;
        vm.q = '';
        vm.results = [];
        vm.searching = false;
        vm.club = null;          // chosen target
        vm.preview = null;
        vm.result = null;        // copy response
        vm.message = '';

        // Human labels for the will_create/result counter keys.
        vm.countLabels = {
            lessons: 'lessons', lesson_items: 'marking items', lesson_bullets: 'briefing bullets',
            lesson_tem: 'TEM entries', lesson_content_files: 'content files', exams: 'ground exams',
            questionnaires: 'questionnaires', questionnaire_questions: 'questionnaire questions',
            questionnaire_links: 'questionnaire links', course_materials: 'course materials',
            solo_requirements: 'pre-solo requirements'
        };
        vm.countKeys = Object.keys(vm.countLabels);

        // Debounced club search (same q=/≤20 pattern as the tpc people picker).
        var debounce = null;
        vm.search = function() {
            if (debounce) { $timeout.cancel(debounce); }
            debounce = $timeout(function() {
                vm.searching = true;
                DefaultCoursesService.Clubs(vm.q).then(function(data) {
                    vm.searching = false;
                    vm.results = (data && data.items) || [];
                });
            }, 300);
        };
        vm.search();   // initial (empty q) list

        vm.pick = function(club) {
            vm.club = club;
            vm.preview = null;
            vm.stage = 'preview';
            vm.busy = true;
            DefaultCoursesService.CopyPreview(vm.course.id, club.id).then(function(data) {
                vm.busy = false;
                if (!data || data.success === false) {
                    vm.stage = 'pick';
                    ToastService.error('Preview Failed', (data && data.message) || 'The copy preview could not be loaded.');
                    return;
                }
                vm.preview = data;
            });
        };
        vm.backToPick = function() { if (!vm.busy) { vm.stage = 'pick'; vm.club = null; vm.preview = null; } };

        vm.doCopy = function(force) {
            vm.stage = 'copying';
            vm.busy = true;
            DefaultCoursesService.Copy(vm.course.id, vm.club.id, !!force).then(function(data) {
                vm.busy = false;
                if (data && data.success !== false) {
                    vm.stage = 'done';
                    vm.result = data;
                    return;
                }
                var err = data && data.error;
                if (err === 'ALREADY_COPIED') {
                    // Confirm, then re-POST with force:true.
                    vm.stage = 'confirm_force';
                    vm.existingCopies = data.existing_copies || (vm.preview && vm.preview.existing_copies) || [];
                } else if (err === 'COPY_BUSY') {
                    // Never auto-retry a held-lock copy.
                    vm.stage = 'busy';
                    vm.message = data.message || 'A copy of this course to this club is already running.';
                } else {
                    vm.stage = 'preview';
                    ToastService.error('Copy Failed', (data && data.message) || 'The course could not be copied.');
                }
            });
        };

        vm.close = function(copied) { $uibModalInstance.close(!!copied); };
        vm.dismiss = function() { $uibModalInstance.dismiss('cancel'); };
    }
