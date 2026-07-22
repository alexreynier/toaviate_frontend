// ─────────────────────────────────────────────────────
// MissingStudentsController
// Admin "Missing students" queue — flights imported from the TPC
// training-records workbook (or tracker-claimed) whose student could not be
// matched by name, grouped per person. Fixes: assign an existing member,
// create a temporary member (converted to a real account later on the
// Imported Users screen), or dismiss junk rows.
// Contract: FRONTEND_MISSING_STUDENT_RECORDS_GUIDE.md.
// ─────────────────────────────────────────────────────
app.controller('MissingStudentsController', MissingStudentsController);

    MissingStudentsController.$inject = ['MissingStudentsService', 'ToastService', '$rootScope', '$scope', '$timeout'];
    function MissingStudentsController(MissingStudentsService, ToastService, $rootScope, $scope, $timeout) {
        var vm = this;

        var cu = $rootScope.globals.currentUser;
        // Admins arrive from Manage Club; instructors may deep-link here from
        // the debrief list without an admin club selected — the backend allows
        // instructor membership on every missing_students endpoint.
        vm.club_id = (cu.current_club_admin && cu.current_club_admin.id) || cu.current_club_instructor;

        vm.loading = true;
        vm.groups = [];
        vm.total_flights = 0;

        // Last dismissal, so a whole-group dismiss can be undone in one click.
        vm.lastDismiss = null;   // { ids: [...], label: '...' }

        // "ANDERSON" → "Anderson" (used for display + the create-form prefill;
        // the admin can still edit before saving).
        function titleCase(s) {
            return String(s || '').toLowerCase().replace(/(^|[\s\-'])[a-z]/g, function(c) {
                return c.toUpperCase();
            });
        }

        vm.displayName = function(g) {
            var name = (titleCase(g.first_name) + ' ' + titleCase(g.last_name)).trim();
            return name || 'Unknown student';
        };

        vm.load = function() {
            vm.loading = true;
            MissingStudentsService.GetQueue(vm.club_id).then(function(data) {
                vm.loading = false;
                if (data && data.success) {
                    // Delivered biggest-first; the empty name_key ("Unknown
                    // student") group comes last. Keep the order as-is.
                    vm.groups = data.groups || [];
                    vm.total_flights = data.total_flights || 0;
                } else {
                    vm.groups = [];
                    vm.total_flights = 0;
                    if (data && data.status === 403) {
                        ToastService.error('No Access', 'You need instructor or manager access to this club to use the Missing Students queue.');
                    } else {
                        ToastService.error('Load Failed', (data && data.message) || 'Could not load the missing students queue.');
                    }
                }
            });
        };

        // ── Per-flight selection (for partial assign / dismiss) ──
        vm.selectedIds = function(g) {
            return (g.flights || []).filter(function(f) { return f._selected; })
                                    .map(function(f) { return f.plane_log_sheet_id; });
        };
        vm.selCount = function(g) { return vm.selectedIds(g).length; };
        vm.clearSelection = function(g) {
            (g.flights || []).forEach(function(f) { f._selected = false; });
        };

        // How many flights the current action will touch (selection, else all).
        vm.actionCount = function(g) {
            return vm.selCount(g) || g.flight_count;
        };

        // Assign body: the whole group by name_key (verbatim from the response —
        // never rebuilt client-side), or just the ticked flights.
        function groupBody(g) {
            var ids = vm.selectedIds(g);
            if (ids.length) { return { plane_log_sheet_ids: ids }; }
            return { name_key: g.name_key, all: true };
        }

        // ── Mode switching (one open panel per group) ──
        vm.openAssign = function(g) {
            g._mode = (g._mode === 'assign') ? null : 'assign';
            g._search = { q: '', results: [], searching: false, searched: false };
        };
        vm.openCreate = function(g) {
            g._mode = (g._mode === 'create') ? null : 'create';
            g._create = {
                first_name: titleCase(g.first_name),
                last_name: titleCase(g.last_name),
                email: ''
            };
        };
        vm.closePanel = function(g) { g._mode = null; };

        // ── 1. Assign an existing member ──
        var searchDebounce = null;
        vm.search = function(g) {
            var s = g._search;
            if (!s) { return; }
            if (searchDebounce) { $timeout.cancel(searchDebounce); }
            searchDebounce = $timeout(function() {
                s.searching = true;
                MissingStudentsService.People(vm.club_id, s.q).then(function(data) {
                    s.searching = false;
                    s.searched = true;
                    s.results = (data && data.people) || [];
                });
            }, 250);
        };

        vm.assign = function(g, person) {
            if (g._busy) { return; }
            g._busy = true;
            var body = groupBody(g);
            body.user_id = person.id;
            MissingStudentsService.Assign(vm.club_id, body).then(function(data) {
                g._busy = false;
                if (data && data.success) {
                    ToastService.success('Student Assigned',
                        (data.flights_assigned || 0) + ' flight(s) assigned to ' +
                        person.first_name + ' ' + person.last_name + '. They now appear in the instructor debrief list.');
                    vm.load();
                } else {
                    ToastService.error('Not Assigned', (data && data.message) || 'The flights could not be assigned.');
                }
            });
        };

        // ── 2. Create a temporary member ──
        // Same mechanism as BookedScheduler imports: the stub appears on the
        // Imported Users screen (BookedScheduler sync → Imported) where it is
        // later converted to a real account. Creating always fixes the whole
        // group — the name IS the group.
        vm.create = function(g) {
            var c = g._create || {};
            if (!(c.first_name || '').trim() && !(c.last_name || '').trim()) {
                ToastService.warning('Name Required', 'Enter the student\'s name before creating a temporary member.');
                return;
            }
            if (g._busy) { return; }
            g._busy = true;
            var body = {
                first_name: (c.first_name || '').trim(),
                last_name: (c.last_name || '').trim(),
                name_key: g.name_key,
                all: true
            };
            if ((c.email || '').trim()) { body.email = c.email.trim(); }
            MissingStudentsService.Create(vm.club_id, body).then(function(data) {
                g._busy = false;
                if (data && data.success) {
                    if (data.existing) {
                        ToastService.success('Existing Member Reused',
                            'A temporary member with that name already existed — ' +
                            (data.flights_assigned || 0) + ' flight(s) attached to them.');
                    } else {
                        ToastService.success('Temporary Member Created',
                            body.first_name + ' ' + body.last_name + ' created and ' +
                            (data.flights_assigned || 0) + ' flight(s) attached. Convert them to a real account from Imported Users when ready.');
                    }
                    vm.load();
                } else if (data && data.error === 'NAME_REQUIRED') {
                    ToastService.warning('Name Required', 'Enter the student\'s name before creating a temporary member.');
                } else if (data && data.error === 'INVALID_EMAIL') {
                    ToastService.warning('Invalid Email', 'That email address doesn\'t look right — please check it (or leave it blank).');
                } else {
                    ToastService.error('Not Created', (data && data.message) || 'The temporary member could not be created.');
                }
            });
        };

        // ── 3. Dismiss (per-group, or just the ticked flights) ──
        vm.dismiss = function(g) {
            if (g._busy) { return; }
            var ids = vm.selectedIds(g);
            if (!ids.length) {
                ids = (g.flights || []).map(function(f) { return f.plane_log_sheet_id; });
            }
            if (!ids.length) { return; }
            g._busy = true;
            MissingStudentsService.Dismiss(vm.club_id, { plane_log_sheet_ids: ids }).then(function(data) {
                g._busy = false;
                if (data && data.success) {
                    vm.lastDismiss = { ids: ids, label: vm.displayName(g) + ' — ' + ids.length + ' flight(s)' };
                    ToastService.success('Dismissed', ids.length + ' flight(s) dismissed — no student record will be needed.', { confetti: false });
                    vm.load();
                } else {
                    ToastService.error('Not Dismissed', (data && data.message) || 'The flights could not be dismissed.');
                }
            });
        };

        vm.undoDismiss = function() {
            if (!vm.lastDismiss) { return; }
            var ld = vm.lastDismiss;
            MissingStudentsService.Dismiss(vm.club_id, { plane_log_sheet_ids: ld.ids, restore: true }).then(function(data) {
                if (data && data.success) {
                    vm.lastDismiss = null;
                    ToastService.success('Restored', ld.ids.length + ' flight(s) restored to the queue.', { confetti: false });
                    vm.load();
                } else {
                    ToastService.error('Not Restored', (data && data.message) || 'The flights could not be restored.');
                }
            });
        };

        vm.load();
    }


// ─────────────────────────────────────────────────────
// MissingStudentResolveModalController
// Resolve ONE flight's unidentified student, inline from the instructor
// debrief list: search/quick-pick an existing member or create a temporary
// member. The confirmation step then offers to also fix the OTHER unknown
// flights carrying the same sheet name (the queue group's name_key).
// ─────────────────────────────────────────────────────
app.controller('MissingStudentResolveModalController', MissingStudentResolveModalController);

    MissingStudentResolveModalController.$inject = ['MissingStudentsService', 'ToastService', '$uibModalInstance', '$timeout', 'log', 'club_id'];
    function MissingStudentResolveModalController(MissingStudentsService, ToastService, $uibModalInstance, $timeout, log, club_id) {
        var vm = this;

        vm.log = log;
        vm.club_id = club_id;

        vm.loading = true;     // finding this flight's name-group in the queue
        vm.group = null;       // queue group for this sheet name (name_key, candidates, siblings)
        vm.othersCount = 0;    // OTHER unknown flights with the same sheet name

        vm.mode = 'pick';      // 'pick' | 'create' | 'confirm'
        vm.selected = null;    // person chosen for assignment
        vm.busy = false;

        vm.search = { q: '', results: [], searching: false, searched: false };
        vm.create_form = { first_name: '', last_name: '', email: '' };

        function titleCase(s) {
            return String(s || '').toLowerCase().replace(/(^|[\s\-'])[a-z]/g, function(c) {
                return c.toUpperCase();
            });
        }

        var sheet = log.suggested_student || {};
        vm.sheetName = ((sheet.first_name || '') + ' ' + (sheet.last_name || '')).trim() || null;

        // The queue gives us this flight's name-group: the verbatim name_key
        // (required for group-wide fixes and for create), the candidate quick
        // picks, and how many sibling flights share the name.
        MissingStudentsService.GetQueue(club_id).then(function(data) {
            vm.loading = false;
            if (data && data.success) {
                var groups = data.groups || [];
                for (var i = 0; i < groups.length && !vm.group; i++) {
                    var fl = groups[i].flights || [];
                    for (var j = 0; j < fl.length; j++) {
                        if (String(fl[j].plane_log_sheet_id) === String(log.plane_log_sheet_id)) {
                            vm.group = groups[i];
                            break;
                        }
                    }
                }
            }
            if (vm.group) {
                vm.othersCount = Math.max(0, (vm.group.flight_count || 0) - 1);
                vm.create_form.first_name = titleCase(vm.group.first_name);
                vm.create_form.last_name = titleCase(vm.group.last_name);
            } else {
                // Not found in the queue (freshly changed elsewhere) — a
                // single-flight assign still works via plane_log_sheet_ids;
                // create is hidden because it needs the group's name_key.
                vm.create_form.first_name = titleCase(sheet.first_name);
                vm.create_form.last_name = titleCase(sheet.last_name);
            }
        });

        // ── Member search ──
        var searchDebounce = null;
        vm.doSearch = function() {
            if (searchDebounce) { $timeout.cancel(searchDebounce); }
            searchDebounce = $timeout(function() {
                vm.search.searching = true;
                MissingStudentsService.People(vm.club_id, vm.search.q).then(function(data) {
                    vm.search.searching = false;
                    vm.search.searched = true;
                    vm.search.results = (data && data.people) || [];
                });
            }, 250);
        };

        // ── Step switching ──
        vm.pick = function(person) {
            vm.selected = person;
            vm.mode = 'confirm';
        };
        vm.backToPick = function() {
            vm.selected = null;
            vm.mode = 'pick';
        };
        vm.openCreate = function() { vm.mode = 'create'; };

        // ── Assign: this flight only, or the whole name-group ──
        vm.confirmAssign = function(applyAll) {
            if (vm.busy || !vm.selected) { return; }
            vm.busy = true;
            var body = (applyAll && vm.group)
                ? { user_id: vm.selected.id, name_key: vm.group.name_key, all: true }
                : { user_id: vm.selected.id, plane_log_sheet_ids: [log.plane_log_sheet_id] };
            MissingStudentsService.Assign(vm.club_id, body).then(function(data) {
                vm.busy = false;
                if (data && data.success) {
                    ToastService.success('Student Assigned',
                        (data.flights_assigned || 1) + ' flight(s) assigned to ' +
                        vm.selected.first_name + ' ' + vm.selected.last_name + '.');
                    $uibModalInstance.close({ fixed: true });
                } else {
                    ToastService.error('Not Assigned', (data && data.message) || 'The flight could not be assigned.');
                }
            });
        };

        // ── Create a temporary member ──
        // Default scope is THIS FLIGHT ONLY (plane_log_sheet_ids, mirroring
        // assign's partial shape) — the new temporary member then surfaces as a
        // candidate for the remaining unknowns, which can be attached later.
        // applyAll:true fixes the whole name-group via name_key instead.
        vm.submitCreate = function(applyAll) {
            var c = vm.create_form;
            if (!(c.first_name || '').trim() && !(c.last_name || '').trim()) {
                ToastService.warning('Name Required', 'Enter the student\'s name before creating a temporary member.');
                return;
            }
            if (vm.busy) { return; }
            vm.busy = true;
            var body = {
                first_name: (c.first_name || '').trim(),
                last_name: (c.last_name || '').trim()
            };
            if (applyAll && vm.group) {
                body.name_key = vm.group.name_key;
                body.all = true;
            } else {
                body.plane_log_sheet_ids = [log.plane_log_sheet_id];
            }
            if ((c.email || '').trim()) { body.email = c.email.trim(); }
            MissingStudentsService.Create(vm.club_id, body).then(function(data) {
                vm.busy = false;
                if (data && data.success) {
                    if (data.existing) {
                        ToastService.success('Existing Member Reused',
                            'A temporary member with that name already existed — ' +
                            (data.flights_assigned || 0) + ' flight(s) attached to them.');
                    } else {
                        ToastService.success('Temporary Member Created',
                            body.first_name + ' ' + body.last_name + ' created and ' +
                            (data.flights_assigned || 0) + ' flight(s) attached. Convert them to a real account from Imported Users when ready.');
                    }
                    $uibModalInstance.close({ fixed: true });
                } else if (data && data.error === 'NAME_REQUIRED') {
                    ToastService.warning('Name Required', 'Enter the student\'s name before creating a temporary member.');
                } else if (data && data.error === 'INVALID_EMAIL') {
                    ToastService.warning('Invalid Email', 'That email address doesn\'t look right — please check it (or leave it blank).');
                } else {
                    ToastService.error('Not Created', (data && data.message) || 'The temporary member could not be created.');
                }
            });
        };

        vm.cancel = function() { $uibModalInstance.dismiss('cancel'); };
    }
