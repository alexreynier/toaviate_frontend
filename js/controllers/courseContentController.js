// ─────────────────────────────────────────────────────
// CourseContentController — instructor/admin authoring + review for
// course/lesson questionnaires and post-material. One controller, screen
// chosen by route data.screen:
//   manage   — a course/lesson's questionnaires + materials (+ upload, attach)
//   builder  — author a questionnaire's questions/options
//   attempts — review queue for a questionnaire
//   review   — mark a single attempt (notes + release)
//   access   — a material's per-student engagement report
// ─────────────────────────────────────────────────────
app.controller('CourseContentController', CourseContentController);

    CourseContentController.$inject = ['QuestionnaireService', 'CourseMaterialService', 'CourseSittingService', 'CourseAssignmentService', 'CourseService', 'MemberService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$sce', '$timeout', '$q', '$uibModal'];
    function CourseContentController(QuestionnaireService, CourseMaterialService, CourseSittingService, CourseAssignmentService, CourseService, MemberService, ToastService, $rootScope, $scope, $state, $stateParams, $sce, $timeout, $q, $uibModal) {
        var vm = this;

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        // Club-0 alias: the ToAviate default-course library reuses the manage
        // + builder screens (dashboard.super_admin.default_course_*) with
        // data.club0 — club 0 is the template space, and questionnaire
        // create REQUIRES an explicit club_id of 0 there
        // (FRONTEND_DEFAULT_COURSES_GUIDE.md). NB the || chain below would
        // swallow a 0, hence the explicit branch.
        vm.club0 = !!($state.current.data && $state.current.data.club0);
        // Admin context first; fall back to the instructor's club (this controller
        // also powers the instructor-facing "student questionnaires" page).
        var _access = vm.user.access || {};
        vm.club_id = vm.club0 ? 0 :
                     ((vm.user.current_club_admin && vm.user.current_club_admin.id) ||
                     vm.user.current_club_instructor ||
                     (_access.instructor && _access.instructor[0]) ||
                     (_access.manager && _access.manager[0]) || null);
        // Builder navigation stays inside whichever family we're in.
        var builderState = vm.club0 ? 'dashboard.super_admin.default_course_questionnaire_builder'
                                    : 'dashboard.manage_club.questionnaire_builder';
        vm.loading = false;
        vm.saving = false;

        // Context (course/lesson) for the manage screen.
        vm.attachType = $stateParams.attach_type;   // 'course' | 'lesson'
        vm.attachId = $stateParams.attach_id;
        vm.contextTitle = $stateParams.title || '';

        vm.pretty = function(s) { return s ? String(s).replace(/_/g, ' ') : ''; };
        vm.back = function() { window.history.back(); };

        // ── Share (instructor → student assignment) ──
        function openShare(itemType, id, title, ctx) {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'cc-drawer', backdropClass: 'cc-drawer-backdrop',
                templateUrl: 'views/manageclub/course_content/modals/share.html',
                controller: 'ShareAssignmentModalController', controllerAs: 'm',
                resolve: {
                    clubId: function() { return vm.club_id; },
                    item: function() { return { type: itemType, id: id, title: title }; },
                    context: function() { return ctx || {}; }
                }
            });
        }
        vm.shareQuestionnaire = function(q) {
            openShare('questionnaire', q._qid || q.id, q.title, {
                attach_type: vm.attachType, attach_id: vm.attachId, timing: q.timing || 'pre',
                course_id: (vm.attachType === 'course') ? vm.attachId : null
            });
        };
        vm.shareMaterial = function(mat) {
            openShare('material', mat.id, mat.title, {
                attach_type: vm.attachType, attach_id: vm.attachId, timing: mat.timing,
                course_id: (vm.attachType === 'course') ? vm.attachId : null
            });
        };

        // Instructor follow-up: see who an item is shared with + each student's status.
        function viewShares(itemType, id, title) {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'cc-drawer', backdropClass: 'cc-drawer-backdrop',
                templateUrl: 'views/manageclub/course_content/modals/shares.html',
                controller: 'ItemSharesModalController', controllerAs: 'm',
                resolve: {
                    item: function() { return { type: itemType, id: id, title: title }; }
                }
            });
        }
        vm.viewQuestionnaireShares = function(q) { viewShares('questionnaire', q._qid || q.id, q.title); };
        vm.viewMaterialShares = function(mat) { viewShares('material', mat.id, mat.title); };

        switch (vm.screen) {
            case 'manage':   initManage(); break;
            case 'builder':  initBuilder(); break;
            case 'attempts': initAttempts(); break;
            case 'review':   initReview(); break;
            case 'access':   initAccess(); break;
            case 'student':  initStudent(); break;
        }

        // ════════════════════════════════════════════
        // STUDENT — search a student, see all their questionnaire attempts
        // ════════════════════════════════════════════
        function initStudent() {
            vm.studentPick = null;       // ui-select model
            vm.selectedStudent = null;
            vm.studentAttempts = null;   // null = nothing searched yet
            vm.studentFilter = 'all';    // 'all' | 'pending' | 'reviewed'
            vm.loadingStudents = true;
            (MemberService.GetAllByClub ? MemberService.GetAllByClub(vm.club_id) : $q.when([])).then(function(data) {
                vm.loadingStudents = false;
                var members = (data && data.members) ? data.members : (angular.isArray(data) ? data : []);
                vm.students = members.map(function(m) {
                    return {
                        id: m.user_id || m.id,
                        name: ((m.first_name || '') + ' ' + (m.last_name || '')).trim(),
                        email: m.email || ''
                    };
                }).filter(function(s) { return s.id; });
            });

            // Deep-link support: ?student_id=N preselects + loads.
            if ($stateParams.student_id) {
                // student name resolves once members load; load attempts immediately.
                loadStudentAttempts({ id: $stateParams.student_id, name: '' });
            }
        }

        vm.pickStudent = function(s) {
            if (!s) return;
            vm.selectedStudent = s;
            loadStudentAttempts(s);
        };
        function loadStudentAttempts(s) {
            vm.selectedStudent = s;
            vm.loadingAttempts = true;
            QuestionnaireService.StudentAttempts(vm.club_id, s.id).then(function(data) {
                vm.loadingAttempts = false;
                if (data && data.success === false) { ToastService.error('Could not load', data.message || ''); vm.studentAttempts = []; return; }
                vm.studentAttempts = (data && data.items) ? data.items : [];
                // resolve the name from the first attempt if we deep-linked.
                if ((!s.name || !s.name.trim()) && vm.studentAttempts.length) {
                    vm.selectedStudent.name = vm.studentAttempts[0].student_name || ('User ' + s.id);
                }
            });
            loadStudentAssignments(s);
        }
        vm.clearStudent = function() { vm.selectedStudent = null; vm.studentAttempts = null; vm.studentAssignments = null; };

        // ── OUTSTANDING assignments for the selected student (ForStudent) ──
        // This card tracks what the instructor has DELIBERATELY set this student
        // (course_assignments) and is purely a to-do list: only items they haven't
        // finished yet. Completed assignments drop off — their result already shows in
        // the Questionnaires table below, so listing them here (as "Assigned · Completed"
        // with a Remove button) was both contradictory and offered a pointless un-assign.
        // Note: most course/lesson-linked questionnaires are taken self-serve and have
        // NO assignment row at all, so they never appear here — only explicit assignments do.
        function loadStudentAssignments(s) {
            vm.loadingAssignments = true;
            CourseAssignmentService.ForStudent(vm.club_id, s.id).then(function(data) {
                vm.loadingAssignments = false;
                var list = (data && data.assignments) ? data.assignments
                    : (data && data.items) ? data.items
                    : (angular.isArray(data) ? data : []);
                vm.studentAssignments = list.filter(function(a) {
                    if (a.status === 'revoked' || a.revoked || a.revoked_at) return false;
                    return a.status !== 'completed';   // outstanding only
                });
            });
        }
        vm.assignmentBadge = function(status) {
            switch (status) {
                case 'completed': return 'cc-badge--green';
                case 'viewed': return 'cc-badge--amber';
                default: return 'cc-badge--blue';
            }
        };
        vm.assignmentStatusText = function(status) {
            switch (status) {
                case 'completed': return 'Completed';
                case 'viewed': return 'In progress';
                default: return 'Not started';
            }
        };
        vm.removeAssignment = function(a) {
            if (a._revoking) return;
            a._revoking = true;
            CourseAssignmentService.Revoke(a.id).then(function(data) {
                a._revoking = false;
                if (!data || data.success === false) { ToastService.error('Could not remove', (data && data.message) || ''); return; }
                vm.studentAssignments = vm.studentAssignments.filter(function(x) { return x.id !== a.id; });
                ToastService.success('Removed', 'Unassigned from ' + (vm.selectedStudent.name || 'student') + '.');
            });
        };

        // Open the student-first assign modal, then refresh their list on success.
        vm.assignToStudent = function() {
            if (!vm.selectedStudent) return;
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'cc-drawer', backdropClass: 'cc-drawer-backdrop',
                templateUrl: 'views/manageclub/course_content/modals/assign.html',
                controller: 'AssignToStudentModalController', controllerAs: 'm',
                resolve: {
                    clubId: function() { return vm.club_id; },
                    student: function() { return { id: vm.selectedStudent.id, name: vm.selectedStudent.name }; }
                }
            }).result.then(function() {
                loadStudentAssignments(vm.selectedStudent);
            }, function() { /* dismissed */ });
        };

        // Reviewed-vs-pending split for the filter chips/counts.
        vm.isReviewed = function(a) { return a.status === 'reviewed'; };
        vm.isPending = function(a) { return a.status === 'submitted'; };
        vm.attemptMatchesFilter = function(a) {
            if (vm.studentFilter === 'reviewed') return a.status === 'reviewed';
            if (vm.studentFilter === 'pending') return a.status === 'submitted';
            return true;
        };
        vm.studentBadge = function(status) {
            switch (status) {
                case 'reviewed': return 'cc-badge--green';
                case 'submitted': return 'cc-badge--blue';
                case 'opened': case 'in_progress': return 'cc-badge--amber';
                default: return 'cc-badge--grey';
            }
        };
        vm.attemptStatusText = function(a) {
            switch (a.status) {
                case 'reviewed': return 'Reviewed';
                case 'submitted': return 'Awaiting review';
                case 'in_progress': case 'opened': return 'In progress';
                default: return vm.pretty(a.status);
            }
        };
        vm.reviewAttempt = function(a) {
            $state.go('dashboard.manage_club.questionnaire_review', { attempt_id: a.id });
        };

        // ════════════════════════════════════════════
        // MANAGE — questionnaires + materials for a course/lesson
        // ════════════════════════════════════════════
        function initManage() {
            vm.tab = 'questionnaires';
            vm.setTab = function(t) { vm.tab = t; };
            // Which timing the "new questionnaire" / "upload" forms target.
            vm.newQTiming = 'pre';
            vm.newMatTiming = 'post';
            vm.timingLabel = function(t) { return t === 'post' ? 'After' : 'Before'; };
            // Sittings are a COURSE concept (a run of the whole course).
            vm.isCourse = (vm.attachType === 'course');
            loadManage();
            if (vm.isCourse) initSittings();
        }

        // ── Recurring runs (sittings) — course scope only ──
        function initSittings() {
            vm.newSitting = { user: null, due_in_months: 6, notes: '' };
            // Members for the "start a run for…" picker.
            (MemberService.GetAllByClub ? MemberService.GetAllByClub(vm.club_id) : $q.when([])).then(function(data) {
                var members = (data && data.members) ? data.members : (angular.isArray(data) ? data : []);
                vm.sittingMembers = members.map(function(m) {
                    return { id: m.user_id || m.id, name: (m.first_name || '') + ' ' + (m.last_name || '') };
                });
            });
            loadSittings();
        }
        function loadSittings() {
            CourseSittingService.ForCourse(vm.attachId).then(function(data) {
                var items = (data && data.items) ? data.items : [];
                // Group runs by student for the roster view.
                var byStudent = {}, order = [];
                items.forEach(function(s) {
                    var k = s.user_id;
                    if (!byStudent[k]) { byStudent[k] = { user_id: k, name: s.student_name || ('User ' + k), runs: [] }; order.push(byStudent[k]); }
                    byStudent[k].runs.push(s);
                });
                order.forEach(function(g) { g.runs.sort(function(a, b) { return (b.sitting_number || 0) - (a.sitting_number || 0); }); });
                vm.sittingGroups = order;
            });
        }
        vm.sittingBadge = function(status) {
            switch (status) {
                case 'open': return 'cc-badge--blue';
                case 'completed': return 'cc-badge--green';
                case 'cancelled': return 'cc-badge--draft';
                default: return 'cc-badge--grey';
            }
        };
        // UI rule: one open run at a time. The backend allows multiple open runs
        // (admin escape hatch), but the UI won't let you start a second while one
        // is still open — complete or cancel the current run first.
        vm.openRunFor = function(user_id) {
            if (!user_id || !vm.sittingGroups) return null;
            var g = vm.sittingGroups.filter(function(x) { return String(x.user_id) === String(user_id); })[0];
            if (!g) return null;
            return g.runs.filter(function(r) { return r.status === 'open'; })[0] || null;
        };
        vm.selectedHasOpenRun = function() {
            return vm.newSitting && vm.newSitting.user && !!vm.openRunFor(vm.newSitting.user.id);
        };

        vm.startSitting = function() {
            if (!vm.newSitting.user) { ToastService.warning('Pick a student', 'Choose who this run is for.'); return; }
            var existing = vm.openRunFor(vm.newSitting.user.id);
            if (existing) {
                ToastService.warning('Run already open',
                    vm.newSitting.user.name + ' already has run #' + existing.sitting_number + ' open. Complete or cancel it before starting a new one.');
                return;
            }
            vm.savingSitting = true;
            CourseSittingService.Start({
                course_id: vm.attachId,
                user_id: vm.newSitting.user.id,
                due_in_months: vm.newSitting.due_in_months || null,
                notes: vm.newSitting.notes || ''
            }).then(function(data) {
                vm.savingSitting = false;
                if (data && data.success !== false) {
                    ToastService.success('Run started', 'A fresh set of questionnaires is ready for this run.');
                    vm.newSitting = { user: null, due_in_months: 6, notes: '' };
                    loadSittings();
                } else {
                    ToastService.error('Could not start run', (data && data.message) || '');
                }
            });
        };
        vm.completeSitting = function(s) {
            CourseSittingService.Complete(s.id).then(function(data) {
                if (data && data.success !== false) { ToastService.success('Run completed', ''); loadSittings(); }
                else { ToastService.error('Could not update', (data && data.message) || ''); }
            });
        };
        vm.cancelSitting = function(s) {
            CourseSittingService.Cancel(s.id).then(function(data) {
                if (data && data.success !== false) { ToastService.success('Run cancelled', ''); loadSittings(); }
                else { ToastService.error('Could not update', (data && data.message) || ''); }
            });
        };
        function loadManage() {
            vm.loading = true;
            // One row per link; each row carries questionnaire_id, link_id, timing.
            QuestionnaireService.GetForTarget(vm.attachType, vm.attachId).then(function(data) {
                var items = (data && data.items) ? data.items : [];
                items.forEach(function(q) { q._qid = q.questionnaire_id || q.id; });
                vm.qPre = items.filter(function(q) { return q.timing !== 'post'; });
                vm.qPost = items.filter(function(q) { return q.timing === 'post'; });
            });
            CourseMaterialService.ListForTarget(vm.attachType, vm.attachId).then(function(data) {
                vm.loading = false;
                var mats = (data && data.items) ? data.items : [];
                vm.matPre = mats.filter(function(m) { return m.timing === 'pre'; });
                vm.matPost = mats.filter(function(m) { return m.timing !== 'pre'; });
                vm.materials = mats;   // kept for the video poll
                pollProcessingVideos();
            });
        }

        // Create a new questionnaire and attach it to this context (pre or post), then build it.
        vm.newQuestionnaire = function() {
            if (!vm.newQ || !vm.newQ.title) { ToastService.warning('Title needed', 'Give the questionnaire a title.'); return; }
            var timing = vm.newQTiming || 'pre';
            vm.saving = true;
            var payload = {
                club_id: vm.club_id,
                title: vm.newQ.title,
                description: vm.newQ.description || '',
                kind: timing + '_' + vm.attachType,   // legacy hint, e.g. pre_lesson / post_course
                instant_mc_score: vm.newQ.instant_mc_score ? 1 : 0,
                is_published: 0
            };
            QuestionnaireService.Create(payload).then(function(data) {
                if (!data || !data.success) { vm.saving = false; ToastService.error('Could not create', (data && data.message) || ''); return; }
                var qid = data.item.id;
                QuestionnaireService.AddLink(qid, vm.attachType, vm.attachId, timing).then(function() {
                    vm.saving = false;
                    $state.go(builderState, { questionnaire_id: qid });
                });
            });
        };
        vm.editQuestionnaire = function(q) {
            $state.go(builderState, { questionnaire_id: q._qid || q.id });
        };
        vm.viewAttempts = function(q) {
            $state.go('dashboard.manage_club.questionnaire_attempts', { questionnaire_id: q._qid || q.id });
        };
        vm.togglePublish = function(q) {
            QuestionnaireService.Update(q._qid || q.id, { is_published: q.is_published ? 0 : 1 }).then(function(data) {
                if (data && data.success) { q.is_published = q.is_published ? 0 : 1; ToastService.success('Saved', q.is_published ? 'Published' : 'Unpublished'); }
                else { ToastService.error('Could not update', (data && data.message) || ''); }
            });
        };
        vm.detachQuestionnaire = function(q) {
            // q.link_id is the link for THIS target (provided by GetForTarget).
            if (!q.link_id) return;
            QuestionnaireService.RemoveLink(q.link_id).then(function(data) {
                if (data && data.success) { ToastService.success('Detached', ''); loadManage(); }
                else { ToastService.error('Could not detach', (data && data.message) || ''); }
            });
        };

        // ── Material upload (PDF or video) ──
        var ACCEPTED = /\.(pdf|mp4|mov|mkv|webm|avi|m4v)$/i;
        vm.onMaterialFile = function(files) {
            $scope.$apply(function() {
                var file = files && files[0];
                if (!file) return;
                if (!ACCEPTED.test(file.name)) { ToastService.error('Unsupported file', 'Upload a PDF or a video (mp4, mov, mkv, webm…).'); return; }
                vm._materialFile = file;
                vm.materialFileName = file.name;
                vm._isVideo = !/\.pdf$/i.test(file.name);
                if (!vm.newMat) vm.newMat = {};
                if (!vm.newMat.title) vm.newMat.title = file.name.replace(ACCEPTED, '');
            });
        };
        vm.uploadMaterial = function() {
            if (!vm._materialFile) { ToastService.warning('Choose a file', 'Pick a PDF or video to upload.'); return; }
            if (!vm.newMat || !vm.newMat.title) { ToastService.warning('Title needed', ''); return; }
            vm.uploading = true;
            var timing = vm.newMatTiming || 'post';
            CourseMaterialService.Upload(vm._materialFile, {
                attach_type: vm.attachType,
                attach_id: vm.attachId,
                title: vm.newMat.title,
                description: vm.newMat.description || '',
                timing: timing,
                kind: timing + '_' + vm.attachType,   // legacy hint
                is_published: vm.newMat.is_published ? 1 : 0
                // file_type is auto-detected by the backend from the file.
            }).then(function(data) {
                vm.uploading = false;
                if (data && data.success) {
                    var item = data.item || data;
                    if (item && (item.file_type === 'video' || item.processing_status === 'queued')) {
                        ToastService.success('Uploaded', 'Video is processing — it’ll be ready to play shortly.');
                    } else {
                        ToastService.success('Uploaded', 'Material added.');
                    }
                    vm._materialFile = null; vm.materialFileName = ''; vm.newMat = {}; vm._isVideo = false;
                    loadManage();
                } else {
                    ToastService.error('Upload failed', (data && data.message) || '');
                }
            });
        };

        // ── Video processing state (instructor view) ──
        // After load, poll any still-processing videos until ready/failed.
        var pollTimer = null;
        function pollProcessingVideos() {
            if (pollTimer) { $timeout.cancel(pollTimer); pollTimer = null; }
            var pending = (vm.materials || []).filter(function(m) {
                return m.file_type === 'video' && (m.processing_status === 'queued' || m.processing_status === 'processing');
            });
            if (!pending.length) return;
            pollTimer = $timeout(function() {
                var checks = pending.map(function(m) {
                    return CourseMaterialService.GetStatus(m.id).then(function(st) {
                        if (st && st.processing_status) {
                            m.processing_status = st.processing_status;
                            m.duration_seconds = st.duration_seconds || m.duration_seconds;
                            m.processing_error = st.processing_error || m.processing_error;
                        }
                    });
                });
                $q.all(checks).then(pollProcessingVideos);   // keep polling while any remain
            }, 5000);
        }
        vm.materialProcessing = function(m) { return m.file_type === 'video' && (m.processing_status === 'queued' || m.processing_status === 'processing'); };
        vm.materialFailed = function(m) { return m.file_type === 'video' && m.processing_status === 'failed'; };
        vm.materialReady = function(m) { return m.file_type !== 'video' || m.processing_status === 'ready' || !m.processing_status; };
        $scope.$on('$destroy', function() { if (pollTimer) $timeout.cancel(pollTimer); });
        vm.toggleMaterialPublish = function(m) {
            CourseMaterialService.Update(m.id, { is_published: m.is_published ? 0 : 1 }).then(function(data) {
                if (data && data.success) { m.is_published = m.is_published ? 0 : 1; ToastService.success('Saved', ''); }
                else { ToastService.error('Could not update', (data && data.message) || ''); }
            });
        };
        vm.deleteMaterial = function(m) {
            m._confirm = false;
            CourseMaterialService.Delete(m.id).then(function(data) {
                if (data && data.success) { ToastService.success('Deleted', ''); loadManage(); }
                else { ToastService.error('Could not delete', (data && data.message) || ''); }
            });
        };
        vm.viewMaterialAccess = function(m) {
            $state.go('dashboard.manage_club.material_access', { material_id: m.id });
        };

        // ════════════════════════════════════════════
        // BUILDER — author questions + options
        // ════════════════════════════════════════════
        function initBuilder() {
            vm.qid = $stateParams.questionnaire_id;
            vm.newQuestionType = 'multiple_choice';
            loadBuilder();
        }
        function loadBuilder() {
            vm.loading = true;
            QuestionnaireService.Get(vm.qid).then(function(data) {
                vm.loading = false;
                vm.q = (data && data.item) ? data.item : null;
                // Normalise option editing state.
                if (vm.q && vm.q.questions) {
                    vm.q.questions.forEach(function(qq) {
                        qq.options = qq.options || [];
                    });
                }
            });
        }
        vm.saveMeta = function() {
            QuestionnaireService.Update(vm.qid, {
                title: vm.q.title, description: vm.q.description,
                instant_mc_score: vm.q.instant_mc_score ? 1 : 0,
                time_limit_minutes: vm.q.time_limit_minutes || null,
                is_published: vm.q.is_published ? 1 : 0
            }).then(function(data) {
                if (data && data.success) ToastService.success('Saved', 'Questionnaire updated.');
                else ToastService.error('Could not save', (data && data.message) || '');
            });
        };
        vm.startAddQuestion = function() {
            vm.draft = { type: 'multiple_choice', prompt: '', help_text: '', external_url: '', multi_select: 0, points: 1, required: 1,
                         options: [{ label: '', is_correct: 1 }, { label: '', is_correct: 0 }] };
            vm.addingQuestion = true;
        };
        vm.cancelAddQuestion = function() { vm.addingQuestion = false; vm.draft = null; };
        vm.addDraftOption = function() { vm.draft.options.push({ label: '', is_correct: 0 }); };
        vm.removeDraftOption = function(i) { vm.draft.options.splice(i, 1); };
        vm.pickCorrect = function(opt) {
            // Single-correct unless multi_select: clear others.
            if (!vm.draft.multi_select) { vm.draft.options.forEach(function(o) { o.is_correct = 0; }); }
            opt.is_correct = opt.is_correct ? 0 : 1;
        };
        vm.saveQuestion = function() {
            var d = vm.draft;
            if (!d.prompt) { ToastService.warning('Prompt needed', 'Type the question.'); return; }
            var body = {
                type: d.type, prompt: d.prompt, help_text: d.help_text || null,
                external_url: d.external_url || null, required: d.required ? 1 : 0,
                points: d.points || 1
            };
            if (d.type === 'multiple_choice') {
                body.multi_select = d.multi_select ? 1 : 0;
                body.options = d.options.filter(function(o) { return o.label; }).map(function(o) { return { label: o.label, is_correct: o.is_correct ? 1 : 0 }; });
                if (body.options.length < 2) { ToastService.warning('Need options', 'Add at least two answer options.'); return; }
                if (!body.options.some(function(o) { return o.is_correct; })) { ToastService.warning('Mark a correct answer', ''); return; }
            }
            vm.saving = true;
            QuestionnaireService.AddQuestion(vm.qid, body).then(function(data) {
                vm.saving = false;
                if (data && data.success) { ToastService.success('Added', 'Question added.'); vm.addingQuestion = false; vm.draft = null; loadBuilder(); }
                else ToastService.error('Could not add', (data && data.message) || '');
            });
        };
        vm.deleteQuestion = function(qq) {
            QuestionnaireService.DeleteQuestion(qq.id).then(function(data) {
                if (data && data.success) { ToastService.success('Removed', ''); loadBuilder(); }
                else ToastService.error('Could not remove', (data && data.message) || '');
            });
        };

        // ════════════════════════════════════════════
        // ATTEMPTS — review queue
        // ════════════════════════════════════════════
        function initAttempts() {
            vm.qid = $stateParams.questionnaire_id;
            vm.loading = true;
            QuestionnaireService.AttemptsFor(vm.qid).then(function(data) {
                vm.loading = false;
                vm.attempts = (data && data.items) ? data.items : [];
            });
        }
        vm.openReview = function(a) { $state.go('dashboard.manage_club.questionnaire_review', { attempt_id: a.id }); };
        vm.statusBadge = function(status) {
            switch (status) {
                case 'reviewed': return 'cc-badge--green';
                case 'submitted': return 'cc-badge--blue';
                case 'in_progress': return 'cc-badge--amber';
                default: return 'cc-badge--grey';
            }
        };
        vm.fmtMins = function(seconds) {
            seconds = parseInt(seconds, 10) || 0;
            var m = Math.floor(seconds / 60), s = seconds % 60;
            return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
        };

        // ════════════════════════════════════════════
        // REVIEW — mark one attempt
        // ════════════════════════════════════════════
        function initReview() {
            vm.attemptId = $stateParams.attempt_id;
            loadReview();
        }
        function loadReview() {
            vm.loading = true;
            QuestionnaireService.Review(vm.attemptId).then(function(data) {
                vm.loading = false;
                if (!data || data.success === false) { ToastService.error('Could not load', (data && data.message) || ''); return; }
                vm.attempt = data.attempt;
                vm.student = data.student;
                vm.q = data.questionnaire;
                vm.questions = data.questions || [];
                vm.answers = data.answers || [];
                vm.reviewNotes = vm.attempt.instructor_notes || '';
                vm.releaseToggle = !!vm.attempt.score_released;
                // index answers by question
                vm.answerByQ = {};
                vm.answers.forEach(function(a) { vm.answerByQ[a.question_id] = a; });
            });
        }
        vm.answerFor = function(q) { return vm.answerByQ ? vm.answerByQ[q.id] : null; };
        vm.optionChosen = function(q, opt) {
            var a = vm.answerFor(q);
            if (!a || !a.selected_option_ids) return false;
            return String(a.selected_option_ids).split(',').indexOf(String(opt.id)) > -1;
        };
        vm.markAnswer = function(q, isCorrect) {
            var a = vm.answerFor(q);
            if (!a) return;
            // Preserve any coaching comment already typed when (re)marking.
            QuestionnaireService.MarkAnswer(a.id, {
                is_correct: isCorrect ? 1 : 0,
                awarded_points: isCorrect ? (q.points || 1) : 0,
                instructor_comment: a.instructor_comment || ''
            }).then(function(data) {
                if (data && data.success) {
                    var upd = data.answer || {};
                    a.is_correct = isCorrect ? 1 : 0;
                    a.awarded_points = isCorrect ? (q.points || 1) : 0;
                    ToastService.success('Marked', '');
                } else { ToastService.error('Could not mark', (data && data.message) || ''); }
            });
        };
        // Save just the per-answer coaching comment (keeps current marking).
        vm.saveComment = function(q) {
            var a = vm.answerFor(q);
            if (!a) return;
            a._savingComment = true;
            QuestionnaireService.MarkAnswer(a.id, {
                instructor_comment: a.instructor_comment || '',
                is_correct: (a.is_correct === null || a.is_correct === undefined) ? null : (a.is_correct ? 1 : 0),
                awarded_points: a.awarded_points
            }).then(function(data) {
                a._savingComment = false;
                if (data && data.success) { ToastService.success('Comment saved', vm.attempt.score_released ? 'The student can see it now.' : 'Shared when you release the score.'); }
                else { ToastService.error('Could not save comment', (data && data.message) || ''); }
            });
        };
        // Is this answer a wrong/incorrect MC answer (where a comment helps most)?
        vm.answerIsWrong = function(q) {
            var a = vm.answerFor(q);
            return a && (a.is_correct === 0 || a.is_correct === '0');
        };
        vm.saveReview = function(release) {
            vm.saving = true;
            QuestionnaireService.SaveReview(vm.attemptId, { instructor_notes: vm.reviewNotes, release: release ? true : false }).then(function(data) {
                vm.saving = false;
                if (data && data.success) {
                    ToastService.success(release ? 'Released to student' : 'Saved', release ? 'The student can now see their score & notes.' : 'Notes saved.');
                    vm.attempt = data.attempt || vm.attempt;
                } else {
                    ToastService.error('Could not save', (data && data.message) || '');
                }
            });
        };

        // ════════════════════════════════════════════
        // ACCESS — material engagement report
        // ════════════════════════════════════════════
        function initAccess() {
            vm.materialId = $stateParams.material_id;
            vm.loading = true;
            CourseMaterialService.Get(vm.materialId).then(function(data) { vm.material = (data && data.item) ? data.item : data; });
            CourseMaterialService.AccessReport(vm.materialId).then(function(data) {
                vm.loading = false;
                vm.access = (data && data.items) ? data.items : [];
            });
        }
    }
