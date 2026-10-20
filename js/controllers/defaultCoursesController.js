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

        // ── Import / export (.tacourse.json packages) ────────────────────
        // Import: pick a file → parse client-side → POST. IMPORT_EXISTS gets an
        // inline confirm (no browser dialogs) and a re-POST with force.
        vm.importBusy = false;
        vm.importPending = null;      // { pkg, title } while a same-title import awaits confirmation
        vm.pickImportFile = function() {
            var input = document.getElementById('dc-import-file');
            if (input) { input.value = ''; input.click(); }
        };
        vm.importFileChosen = function(input) {
            var file = input && input.files && input.files[0];
            if (!file) { return; }
            var reader = new FileReader();
            reader.onload = function(e) {
                var pkg = null;
                try { pkg = JSON.parse(e.target.result); } catch (err) { pkg = null; }
                $rootScope.$applyAsync(function() {
                    if (!pkg || pkg.format !== 'toaviate-course') {
                        ToastService.error('Not a Course Package', 'Choose a .tacourse.json file exported from the default-course library.');
                        return;
                    }
                    sendImport(pkg, false);
                });
            };
            reader.readAsText(file);
        };
        function sendImport(pkg, force) {
            vm.importBusy = true;
            DefaultCoursesService.Import(pkg, force).then(function(data) {
                vm.importBusy = false;
                if (data && data.success) {
                    vm.importPending = null;
                    var r = data.result || {};
                    ToastService.success('Course Imported', (pkg.course && pkg.course.title ? pkg.course.title + ': ' : '') +
                        (r.lessons || 0) + ' lessons, ' + (r.lesson_items || 0) + ' marking items, ' + (r.lesson_tem || 0) + ' TEM rows.');
                    if (data.not_included && data.not_included.length) {
                        ToastService.warning('Files Not Included', 'Binary content (lesson files, materials, question images) is not packaged — re-upload it on this server.');
                    }
                    load();
                    return;
                }
                if (data && data.error === 'IMPORT_EXISTS') {
                    vm.importPending = { pkg: pkg, title: (pkg.course && pkg.course.title) || 'this course' };
                    return;
                }
                ToastService.error('Import Failed', (data && data.message) || 'The package could not be imported.');
            });
        }
        vm.confirmImport = function() { if (vm.importPending) { sendImport(vm.importPending.pkg, true); } };
        vm.cancelImport = function() { vm.importPending = null; };

        // Export: download <title>.tacourse.json.
        vm.exportCourse = function(it) {
            it._exporting = true;
            DefaultCoursesService.Export(it.id).then(function(data) {
                it._exporting = false;
                if (!data || !data.success || !data.package) {
                    ToastService.error('Export Failed', (data && data.message) || 'The package could not be built.');
                    return;
                }
                var name = String(it.title || 'course').replace(/[^A-Za-z0-9 _()-]+/g, '').trim().replace(/\s+/g, '_') + '.tacourse.json';
                var blob = new Blob([JSON.stringify(data.package, null, 2)], { type: 'application/json' });
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = name;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                window.setTimeout(function() { window.URL.revokeObjectURL(url); }, 1000);
            });
        };

        // ── Delete from the library (inline confirm; copies on clubs unaffected) ──
        vm.deletePending = null;
        vm.deleteBusy = false;
        vm.askDelete = function(it) { vm.deletePending = it; };
        vm.cancelDelete = function() { vm.deletePending = null; };
        vm.confirmDelete = function() {
            if (!vm.deletePending) { return; }
            vm.deleteBusy = true;
            DefaultCoursesService.Delete(vm.deletePending.id).then(function(data) {
                vm.deleteBusy = false;
                if (!data || !data.success) {
                    ToastService.error('Could Not Delete', (data && data.message) || 'Please try again.');
                    return;
                }
                ToastService.success('Default Course Deleted', data.message || 'Removed from the library.');
                vm.deletePending = null;
                load();
            });
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
