// ═══════════════════════════════════════════════════════════════════
//  TrainingRecordReassignController — bulk "this belongs to another
//  course" repair for training records.
//  Contract: BACKEND_TRAINING_RECORD_COURSE_GUIDE.md (Part B).
//
//  Why it exists: the workbook importer resolves a record's course from
//  the free-text exercise cell and falls back to the club's default (PPL)
//  course when it can't tell — so IMC / night / type / check flights get
//  filed under PPL. This finds them and moves them, optionally setting a
//  lesson (otherwise the instructor sets it on the record as usual).
//  Embedded in Settings → Data Import. Club managers only.
// ═══════════════════════════════════════════════════════════════════

app.controller('TrainingRecordReassignController', TrainingRecordReassignController);

    TrainingRecordReassignController.$inject = ['TpcImportService', 'MemberService', 'PlaneService', 'ToastService', '$rootScope', '$timeout'];
    function TrainingRecordReassignController(TpcImportService, MemberService, PlaneService, ToastService, $rootScope, $timeout) {

        var vm = this;
        var PER_PAGE = 50;
        var MOVE_BATCH = 500;   // backend caps record_ids per call

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin && vm.user.current_club_admin.id;
        vm.is_manager = (vm.user.access.manager || []).indexOf(vm.club_id) > -1 ||
                        (vm.user.access.super_admin || []).length > 0;
        if (!vm.is_manager) { return; }

        vm.open = false;          // the whole tool is collapsed until asked for
        vm.courses = [];
        vm.students = [];
        vm.planes = [];
        // ui-select binds objects; the filters below carry the plain values.
        vm.pick = { student: null, plane: null };
        vm.loading = false;
        vm.moving = false;
        vm.searched = false;
        vm.rows = [];
        vm.total = 0;
        vm.page = 1;

        // Search filters. imported_only defaults ON — this is a repair tool
        // for importer mistakes, and it keeps hand-made records out of the way.
        vm.f = {
            course_id: null, student_user_id: null, lesson_id: null,
            from: null, to: null, registration: '', q: '', imported_only: 1
        };

        // Move target.
        vm.target = { course_id: null, lesson_id: null };

        vm.sel = {};              // id → true
        vm.lastResult = null;

        vm.toggleOpen = function() {
            vm.open = !vm.open;
            if (vm.open && !vm.courses.length) { loadPickers(); }
        };

        function loadPickers() {
            TpcImportService.CoursesForClub(vm.club_id).then(function(data) {
                vm.courses = (data && data.courses) || [];
            });
            MemberService.GetAllByClub(vm.club_id).then(function(data) {
                var list = angular.isArray(data) ? data : (data && data.members) || [];
                vm.students = list.map(function(m) {
                    return {
                        id: m.user_id || m.id,
                        name: ((m.first_name || '') + ' ' + (m.last_name || '')).trim()
                    };
                }).filter(function(s) { return s.id && s.name; });
            });
            PlaneService.GetAllByClub(vm.club_id).then(function(data) {
                var list = angular.isArray(data) ? data : (data && data.planes) || [];
                vm.planes = list.map(function(p) {
                    return {
                        registration: p.registration,
                        label: p.registration + (p.plane_type ? ' · ' + p.plane_type : '')
                    };
                }).filter(function(p) { return p.registration; });
            });
        }

        // ui-select → filter value (clearing the pick clears the filter).
        vm.onStudentPick = function(item) {
            vm.f.student_user_id = item ? item.id : null;
            vm.search(1);
        };
        vm.onPlanePick = function(item) {
            vm.f.registration = item ? item.registration : '';
            vm.search(1);
        };

        vm.lessonsFor = function(course_id) {
            for (var i = 0; i < vm.courses.length; i++) {
                if (String(vm.courses[i].id) === String(course_id)) { return vm.courses[i].lessons || []; }
            }
            return [];
        };
        vm.onTargetCourseChange = function() {
            var ok = false;
            vm.lessonsFor(vm.target.course_id).forEach(function(l) {
                if (String(l.id) === String(vm.target.lesson_id)) { ok = true; }
            });
            if (!ok) { vm.target.lesson_id = null; }
        };
        vm.courseTitle = function(id) {
            for (var i = 0; i < vm.courses.length; i++) {
                if (String(vm.courses[i].id) === String(id)) { return vm.courses[i].title; }
            }
            return '';
        };

        // Debounced free-text search so typing doesn't hammer the endpoint.
        var debounce = null;
        vm.searchSoon = function() {
            if (debounce) { $timeout.cancel(debounce); }
            debounce = $timeout(function() { vm.search(1); }, 350);
        };

        vm.search = function(page) {
            vm.page = page || 1;
            vm.loading = true;
            vm.searched = true;
            var params = angular.extend({}, vm.f, {
                club_id: vm.club_id,
                page: vm.page,
                per_page: PER_PAGE
            });
            TpcImportService.SearchRecords(params).then(function(data) {
                vm.loading = false;
                if (!data || data.success === false) {
                    ToastService.error('Search Failed', (data && data.message) || 'The records could not be searched.');
                    vm.rows = []; vm.total = 0;
                    return;
                }
                vm.rows = data.items || [];
                vm.total = data.total || 0;
                vm.sel = {};   // selection never survives a new search
            });
        };

        vm.pages = function() { return Math.max(1, Math.ceil(vm.total / PER_PAGE)); };
        vm.goPage = function(p) {
            if (p < 1 || p > vm.pages() || vm.loading) { return; }
            vm.search(p);
        };

        // ── Selection ──
        vm.selCount = function() { return vm.selIds().length; };
        vm.selIds = function() {
            return Object.keys(vm.sel).filter(function(k) { return vm.sel[k]; }).map(Number);
        };
        vm.allOnPage = function() {
            if (!vm.rows.length) { return false; }
            for (var i = 0; i < vm.rows.length; i++) { if (!vm.sel[vm.rows[i].id]) { return false; } }
            return true;
        };
        vm.toggleAll = function() {
            var on = !vm.allOnPage();
            vm.rows.forEach(function(r) { vm.sel[r.id] = on; });
        };

        // ── Move ──
        vm.canMove = function() {
            return !vm.moving && vm.selCount() > 0 && !!vm.target.course_id;
        };
        vm.move = function() {
            if (!vm.canMove()) { return; }
            var ids = vm.selIds();
            vm.moving = true;
            vm.lastResult = null;
            var moved = 0, skipped = 0, i = 0;

            (function nextBatch() {
                if (i >= ids.length) {
                    vm.moving = false;
                    vm.lastResult = { moved: moved, skipped: skipped, course: vm.courseTitle(vm.target.course_id) };
                    ToastService.success('Records Moved',
                        moved + ' record(s) moved to ' + vm.lastResult.course +
                        (skipped ? ' · ' + skipped + ' skipped' : '') + '.');
                    vm.search(vm.page);   // refresh — moved rows may drop out of the filter
                    return;
                }
                var batch = ids.slice(i, i + MOVE_BATCH);
                i += MOVE_BATCH;
                TpcImportService.ReassignRecords(vm.club_id, batch, vm.target.course_id, vm.target.lesson_id)
                    .then(function(data) {
                        if (!data || data.success === false) {
                            vm.moving = false;
                            ToastService.error('Move Failed', (data && data.message) || 'The records could not be moved.');
                            return;
                        }
                        var r = data.result || {};
                        moved += r.moved || 0;
                        skipped += r.skipped || 0;
                        nextBatch();
                    });
            })();
        };
    }
