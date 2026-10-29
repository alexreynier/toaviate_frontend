// ─────────────────────────────────────────────────────
// RecordsToFileController
// Club admin "Records to file" page (Members hub tab). Every completed
// instructional flight of the selected admin club that still has no student
// training record, plus the records an admin entered on an instructor's
// behalf that the instructor has not confirmed yet.
//
// "File record" opens the normal instructor debrief form for the flight with
// from=records_to_file, so a save comes straight back here (and the page
// reloads — the controller re-initialises on entry). The view, instructor
// and date filters survive that round trip via sessionStorage.
//
// Backend contract: BACKEND_ADMIN_STUDENT_RECORDS_GUIDE.md
//   GET training_records/to_file/{club_id}      (RecordsToFileService.Queue)
//   GET training_records/unconfirmed/{club_id}  (RecordsToFileService.Unconfirmed)
// ─────────────────────────────────────────────────────
app.controller('RecordsToFileController', RecordsToFileController);

    RecordsToFileController.$inject = ['RecordsToFileService', 'ToastService', 'TimeDisplayService', '$rootScope', '$scope', '$state', '$stateParams', '$uibModal'];
    function RecordsToFileController(RecordsToFileService, ToastService, TimeDisplayService, $rootScope, $scope, $state, $stateParams, $uibModal) {
        var vm = this;

        var STORE_KEY = 'toaviate_records_to_file_filters';
        var PER_PAGE = 50;

        var cu = $rootScope.globals.currentUser;
        vm.club_id = (cu.current_club_admin && cu.current_club_admin.id) || null;

        // Training-record times: brakes off → on, the club's rounding.
        vm.td = TimeDisplayService.context(vm.club_id, { window: 'block' });

        vm.tab = ($stateParams.tab === 'awaiting') ? 'awaiting' : 'to_file';

        // ── To-file list state ──
        vm.view = 'ready';                 // 'ready' (has a student) | 'needs_student' | 'all'
        vm.filters = { instructor: '', date_from: null, date_to: null };
        vm.flights = [];
        vm.total = 0;
        vm.page = 1;
        vm.loading = false;
        vm.loading_more = false;
        vm.loaded = false;
        vm.forbidden = false;
        vm.summary = null;
        vm.instructor_choices = [{ value: '', label: 'All instructors' }];

        // ── Awaiting-confirmation list state ──
        vm.awaiting = [];
        vm.awaiting_loading = false;
        vm.awaiting_loaded = false;
        vm.awaiting_filter = '';           // instructor id (client-side filter)
        vm.awaiting_instructors = [];

        var seq = 0;                       // drops stale responses when filters change quickly

        // ── Filter persistence (per viewer, per tab session) ──
        function ymd(d) {
            if (!d || !(d instanceof Date) || isNaN(d.getTime())) { return null; }
            var m = d.getMonth() + 1, day = d.getDate();
            return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
        }
        function fromYmd(s) {
            if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) { return null; }
            var p = s.split('-');
            return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        }
        function saveFilters() {
            try {
                sessionStorage.setItem(STORE_KEY, JSON.stringify({
                    club_id: vm.club_id,
                    view: vm.view,
                    instructor: vm.filters.instructor || '',
                    date_from: ymd(vm.filters.date_from),
                    date_to: ymd(vm.filters.date_to)
                }));
            } catch (e) {}
        }
        function restoreFilters() {
            try {
                var raw = sessionStorage.getItem(STORE_KEY);
                if (!raw) { return; }
                var s = JSON.parse(raw);
                // Filters belong to one club — a club switch starts clean.
                if (!s || String(s.club_id) !== String(vm.club_id)) { return; }
                if (s.view === 'ready' || s.view === 'needs_student' || s.view === 'all') { vm.view = s.view; }
                vm.filters.instructor = s.instructor || '';
                vm.filters.date_from = fromYmd(s.date_from);
                vm.filters.date_to = fromYmd(s.date_to);
            } catch (e) {}
        }

        // ── Display helpers ──
        vm.personName = function(p) {
            if (!p) { return ''; }
            return ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
        };
        vm.sheetName = function(f) {
            return (f && f.suggested_student) ? vm.personName(f.suggested_student) : '';
        };
        vm.kindLabel = function(kind) {
            if (kind === 'dual') { return 'Dual'; }
            if (kind === 'supervised_solo') { return 'Supervised solo'; }
            return 'Instructional';
        };
        vm.readyCount = function() {
            if (!vm.summary) { return 0; }
            return Math.max(0, (vm.summary.open || 0) - (vm.summary.no_student || 0));
        };
        vm.hasFilters = function() {
            return !!(vm.filters.instructor || vm.filters.date_from || vm.filters.date_to);
        };
        vm.canLoadMore = function() {
            return vm.flights.length < vm.total;
        };

        // Instructor picker options come from the whole-club summary.
        function buildInstructorChoices() {
            var s = vm.summary || {};
            var out = [{ value: '', label: 'All instructors' }];
            (s.by_instructor || []).forEach(function(row) {
                var ins = row.instructor || {};
                var name = vm.personName(ins) || ('Instructor #' + ins.id);
                // "Ready to file" counts only flights that already have a student
                var n = (vm.view === 'ready' && row.ready !== undefined) ? row.ready : row.count;
                out.push({ value: String(ins.id), label: name + ' (' + (n || 0) + ')' });
            });
            if (s.no_instructor > 0) {
                out.push({ value: 'none', label: 'No instructor named (' + s.no_instructor + ')' });
            }
            // A remembered instructor who no longer has open flights still shows,
            // so the select never silently disagrees with the list.
            if (vm.filters.instructor && !out.some(function(o) { return o.value === vm.filters.instructor; })) {
                out.push({ value: vm.filters.instructor, label: vm.filters.instructor === 'none' ? 'No instructor named (0)' : 'Selected instructor (0)' });
            }
            vm.instructor_choices = out;
        }

        function queryParams(page) {
            var p = { page: page, per_page: PER_PAGE };
            if (vm.view === 'ready') { p.has_student = 1; }
            if (vm.view === 'needs_student') { p.no_student = 1; }
            if (vm.filters.instructor === 'none') {
                p.no_instructor = 1;
            } else if (vm.filters.instructor) {
                p.instructor_id = vm.filters.instructor;
            }
            p.date_from = ymd(vm.filters.date_from);
            p.date_to = ymd(vm.filters.date_to);
            return p;
        }

        function handleForbidden(data) {
            var forbidden = data && (data.error === 'FORBIDDEN' || data.status === 403);
            if (forbidden && !vm.forbidden) {
                vm.forbidden = true;
                ToastService.error('No Access', 'Only club managers and super-admins of this club can file records on an instructor\'s behalf.');
            }
            return forbidden;
        }

        // ── To-file list ──
        vm.load = function() {
            if (!vm.club_id) { return; }
            var mine = ++seq;
            vm.loading = true;
            vm.page = 1;
            saveFilters();
            RecordsToFileService.Queue(vm.club_id, queryParams(1)).then(function(data) {
                if (mine !== seq) { return; }
                vm.loading = false;
                vm.loaded = true;
                if (data && data.success) {
                    vm.flights = data.flights || [];
                    vm.total = data.total || 0;
                    vm.summary = data.summary || vm.summary;
                    buildInstructorChoices();
                } else {
                    vm.flights = [];
                    vm.total = 0;
                    if (!handleForbidden(data)) {
                        ToastService.error('Load Failed', (data && data.message) || 'Could not load the flights that need a record.');
                    }
                }
            });
        };

        vm.loadMore = function() {
            if (vm.loading_more || !vm.canLoadMore()) { return; }
            var mine = seq;
            vm.loading_more = true;
            RecordsToFileService.Queue(vm.club_id, queryParams(vm.page + 1)).then(function(data) {
                if (mine !== seq) { return; }   // filters changed meanwhile — the new list wins
                vm.loading_more = false;
                if (data && data.success) {
                    vm.page = data.page || (vm.page + 1);
                    vm.total = data.total || vm.total;
                    // A record filed elsewhere meanwhile shifts the pages — skip repeats.
                    var seen = {};
                    vm.flights.forEach(function(f) { seen[f.plane_log_sheet_id] = true; });
                    (data.flights || []).forEach(function(f) {
                        if (!seen[f.plane_log_sheet_id]) { vm.flights.push(f); }
                    });
                } else {
                    ToastService.error('Load Failed', (data && data.message) || 'Could not load more flights.');
                }
            });
        };

        vm.setView = function(view) {
            if (vm.view === view && vm.tab === 'to_file') { return; }
            vm.view = view;
            vm.setTab('to_file');
            vm.load();
        };

        vm.onInstructorChange = function() { vm.load(); };
        vm.applyDates = function() {
            if (vm.filters.date_from && vm.filters.date_to && vm.filters.date_from > vm.filters.date_to) {
                ToastService.warning('Check The Dates', 'The "from" date is after the "to" date.');
                return;
            }
            vm.load();
        };
        vm.clearFilters = function() {
            vm.filters.instructor = '';
            vm.filters.date_from = null;
            vm.filters.date_to = null;
            vm.load();
        };

        // ── Actions on a flight ──
        // The normal instructor debrief form. booking_id 0 for a log-sheet-only
        // flight (the form looks the booking up from the sheet either way);
        // plane_log_sheet_id > 0 makes it load via for_debrief_pls.
        vm.fileRecord = function(f) {
            if (!f || f.needs_book_in == 1 || !f.student) { return; }
            $state.go('dashboard.manage_user.debriefing', {
                booking_id: (f.booking_id && Number(f.booking_id) > 0) ? Number(f.booking_id) : 0,
                plane_log_sheet_id: f.plane_log_sheet_id,
                split_next_id: null,
                split_booking_id: null,
                from: 'records_to_file'
            });
        };

        // "Resolve student…" — the same inline modal the instructor debrief list
        // uses (assign an existing member / create a temporary one for this
        // flight, optionally the other flights carrying the same sheet name).
        vm.resolveStudent = function(f) {
            var modal = $uibModal.open({
                templateUrl: 'views/modals/missing_student_resolve.html',
                controller: 'MissingStudentResolveModalController',
                controllerAs: 'vm',
                size: 'md',
                backdrop: 'static',
                windowClass: 'msq-modal-window',
                resolve: {
                    log: function() { return f; },
                    club_id: function() { return vm.club_id; }
                }
            });
            modal.result.then(function(res) {
                if (res && res.fixed) { vm.load(); }
            }, function() {});
        };

        // ── Awaiting instructor confirmation ──
        function buildAwaitingInstructors() {
            var seen = {};
            var out = [];
            vm.awaiting.forEach(function(r) {
                var id = String(r.instructor_id || '');
                if (!id || seen[id]) { return; }
                seen[id] = true;
                out.push({ value: id, label: ((r.instructor_first_name || '') + ' ' + (r.instructor_last_name || '')).trim() || ('Instructor #' + id) });
            });
            out.sort(function(a, b) { return a.label.localeCompare(b.label); });
            vm.awaiting_instructors = [{ value: '', label: 'All instructors' }].concat(out);
            if (vm.awaiting_filter && !seen[vm.awaiting_filter]) { vm.awaiting_filter = ''; }
        }

        vm.loadAwaiting = function() {
            if (!vm.club_id) { return; }
            vm.awaiting_loading = true;
            RecordsToFileService.Unconfirmed(vm.club_id, {}).then(function(data) {
                vm.awaiting_loading = false;
                vm.awaiting_loaded = true;
                if (data && data.success) {
                    vm.awaiting = data.records || [];
                    if (vm.summary) { vm.summary.awaiting_confirmation = data.count || vm.awaiting.length; }
                    buildAwaitingInstructors();
                } else {
                    vm.awaiting = [];
                    if (!handleForbidden(data)) {
                        ToastService.error('Load Failed', (data && data.message) || 'Could not load the records awaiting confirmation.');
                    }
                }
            });
        };

        vm.awaitingFiltered = function() {
            if (!vm.awaiting_filter) { return vm.awaiting; }
            return vm.awaiting.filter(function(r) { return String(r.instructor_id) === vm.awaiting_filter; });
        };

        vm.setTab = function(tab) {
            if (tab !== 'to_file' && tab !== 'awaiting') { return; }
            if (vm.tab !== tab) {
                vm.tab = tab;
                // Keep the tab in the URL (refresh / back) without re-entering the state.
                $state.go('dashboard.manage_club.records_to_file', { tab: tab === 'awaiting' ? 'awaiting' : null }, { notify: false, location: 'replace' });
            }
            if (tab === 'awaiting' && !vm.awaiting_loaded && !vm.awaiting_loading) { vm.loadAwaiting(); }
        };

        // ── Start ──
        function start() {
            vm.td.setClub(vm.club_id);
            restoreFilters();
            vm.load();
            if (vm.tab === 'awaiting') { vm.loadAwaiting(); }
        }

        if (vm.club_id) {
            start();
        } else {
            // First visit straight to this URL: the Manage Club parent picks the
            // admin club asynchronously (DashboardController.GetAdminClubs).
            var stopWatch = $scope.$watch(function() {
                var c = $rootScope.globals.currentUser && $rootScope.globals.currentUser.current_club_admin;
                return c && c.id;
            }, function(id) {
                if (!id) { return; }
                stopWatch();
                vm.club_id = id;
                start();
            });
        }
    }
