// ─────────────────────────────────────────────────────
// StudentQuestionnaireController — the student's questionnaire experience.
//   mine   — list of the student's attempts (start / continue / view)
//   take   — open/resume, answer, auto-save with a timer, submit
//   result — a reviewed attempt's released score + instructor notes
// Designed to be effortless: auto-saving, resumable, forgiving.
// ─────────────────────────────────────────────────────
app.controller('StudentQuestionnaireController', StudentQuestionnaireController);

    StudentQuestionnaireController.$inject = ['QuestionnaireService', 'CourseMaterialService', 'CourseAssignmentService', 'CourseService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$interval', '$timeout', '$sce'];
    function StudentQuestionnaireController(QuestionnaireService, CourseMaterialService, CourseAssignmentService, CourseService, ToastService, $rootScope, $scope, $state, $stateParams, $interval, $timeout, $sce) {
        var vm = this;

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        vm.loading = false;

        vm.pretty = function(s) { return s ? String(s).replace(/_/g, ' ') : ''; };
        vm.back = function() {
            // Hub → My Account; a sub-screen → the hub.
            if (vm.screen === 'mine') {
                $state.go('dashboard.my_account');
            } else {
                $state.go('dashboard.my_account.questionnaires');
            }
        };

        switch (vm.screen) {
            case 'mine':     initMine(); break;
            case 'take':     initTake(); break;
            case 'result':   initResult(); break;
            case 'material': initMaterial(); break;
        }

        // ════════════════════════════════════════════
        // ASSIGNED TO ME — items an instructor shared with the student.
        // (Rendered as a section at the top of the "mine" hub.)
        // ════════════════════════════════════════════
        // A questionnaire assignment is only truly "done" (result viewable) once the
        // instructor has REVIEWED/RELEASED it. A submitted-but-unreleased attempt is
        // "Submitted — awaiting review": the student can't see a marked result yet,
        // and (e.g. after a re-assign) it must NOT read as Completed. Material has no
        // review step, so completed = done.
        function isQuestionnaire(a) { return a.item_type !== 'material'; }
        function isReleased(a) {
            return !!(a.score_released || a.attempt_status === 'reviewed' || a.reviewed);
        }
        // "Off the student's plate" — they've completed their part (submitted /
        // viewed material). Drives sorting + the outstanding-to-do count, so an
        // awaiting-review questionnaire isn't nagged as still-to-do.
        vm.assignDone = function(a) {
            return a.status === 'completed';
        };
        // Submitted by the student but not yet reviewed/released by the instructor.
        // It's "done" for the student, but must NOT read as "Completed / View result"
        // — there's no released, marked result to view yet.
        function isAwaitingReview(a) {
            return a.status === 'completed' && isQuestionnaire(a) && !isReleased(a);
        }
        // Fully finished AND result available to view.
        function isReleasedComplete(a) {
            return a.status === 'completed' && (!isQuestionnaire(a) || isReleased(a));
        }

        vm.assignBadge = function(a) {
            // (a may be passed as the object; tolerate a raw status string too)
            var obj = (a && typeof a === 'object') ? a : { status: a };
            if (isAwaitingReview(obj)) return 'cc-badge--blue';   // submitted, pending review
            switch (obj.status) {
                case 'completed': return 'cc-badge--green';
                case 'viewed': return 'cc-badge--amber';
                default: return 'cc-badge--blue';   // assigned
            }
        };
        vm.assignStatusText = function(a) {
            if (isAwaitingReview(a)) return 'Submitted · awaiting review';
            switch (a.status) {
                case 'completed': return 'Completed';
                case 'viewed': return 'In progress';
                default: return 'To do';
            }
        };
        vm.assignActionLabel = function(a) {
            if (a.status === 'completed') {
                if (a.item_type === 'material') return 'View again';
                return isReleased(a) ? 'View result' : 'View submission';
            }
            if (a.status === 'viewed') return 'Continue';
            return (a.item_type === 'material') ? 'Open' : 'Start';
        };
        // Is the due date today or in the past (and not done)?
        vm.assignOverdue = function(a) {
            if (a._done || !a.due_date) return false;
            return a.due_date < todayYMD();
        };
        function todayYMD() {
            var d = new Date();
            return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        }
        vm.openAssignment = function(a) {
            // Mark viewed (best-effort) then follow the item's deep link.
            CourseAssignmentService.MarkViewed(a.id);
            if (a.item_type === 'material') {
                $state.go('dashboard.my_account.material_view', { material_id: a.item_id });
            } else {
                // Questionnaire: route to take (or to result if already completed).
                if (a.status === 'completed' && a.attempt_id) {
                    $state.go('dashboard.my_account.questionnaire_result', { attempt_id: a.attempt_id });
                } else {
                    $state.go('dashboard.my_account.questionnaire_take', {
                        questionnaire_id: a.item_id,
                        attach_type: a.attach_type,
                        attach_id: a.attach_id,
                        timing: a.timing,
                        sitting: a.course_sitting_id
                    });
                }
            }
        };

        // ════════════════════════════════════════════
        // MATERIAL — read a post-lesson/course PDF or watch a video
        // (engagement tracked; videos are streamed as a blob through $http auth)
        // ════════════════════════════════════════════
        var matTimer = null, matSeconds = 0, videoUrlRevoke = null;
        function initMaterial() {
            vm.materialId = $stateParams.material_id;
            vm.loading = true;
            vm.materialKind = null;       // 'pdf' | 'video'
            vm.videoProcessing = false;
            // Learn what kind of material this is first.
            CourseMaterialService.Get(vm.materialId).then(function(meta) {
                var m = (meta && meta.item) ? meta.item : meta;
                if (!m || meta.success === false) { vm.loading = false; ToastService.error('Could not open', (meta && meta.message) || ''); return; }
                vm.material = m;
                vm.materialKind = (m.file_type === 'video') ? 'video' : 'pdf';
                if (vm.materialKind === 'video') loadVideo(m);
                else loadPdf();
            });
        }

        function startHeartbeat() {
            // Heartbeat engagement time every 15s.
            matTimer = $interval(function() {
                matSeconds += 15;
                CourseMaterialService.Track(vm.materialId, { add_seconds: 15 });
            }, 15000);
        }

        function loadPdf() {
            CourseMaterialService.GetFile(vm.materialId).then(function(data) {
                vm.loading = false;
                if (!data || data.success === false) { ToastService.error('Could not open', (data && data.message) || ''); return; }
                vm.material = angular.extend(vm.material || {}, data);
                vm.pdfUri = $sce.trustAsResourceUrl(data.data_uri);
                startHeartbeat();
            });
        }

        function loadVideo(meta) {
            // If still processing, poll the status until ready.
            if (meta.processing_status && meta.processing_status !== 'ready') {
                vm.loading = false;
                vm.videoProcessing = (meta.processing_status !== 'failed');
                vm.videoFailed = (meta.processing_status === 'failed');
                if (vm.videoFailed) return;
                $timeout(function() {
                    CourseMaterialService.GetStatus(vm.materialId).then(function(st) {
                        meta.processing_status = (st && st.processing_status) || meta.processing_status;
                        loadVideo(meta);
                    });
                }, 5000);
                return;
            }
            // Ready — fetch the decrypted MP4 as a blob (carries auth headers).
            CourseMaterialService.GetVideoObjectUrl(vm.materialId).then(function(res) {
                vm.loading = false;
                vm.videoProcessing = false;
                if (!res || !res.success) { ToastService.error('Could not load video', (res && res.message) || ''); return; }
                vm.videoUrl = $sce.trustAsResourceUrl(res.url);
                videoUrlRevoke = res.revoke;
                startHeartbeat();
            });
        }

        vm.markMaterialDone = function() {
            CourseMaterialService.Track(vm.materialId, { add_seconds: matSeconds % 15, completed: true }).then(function() {
                ToastService.success('Marked as done', 'Nice work.');
                vm.materialDone = true;
            });
        };
        $scope.$on('$destroy', function() {
            if (matTimer) $interval.cancel(matTimer);
            if (videoUrlRevoke) videoUrlRevoke();
        });

        vm.statusLabel = function(s) {
            switch (s) {
                case 'opened': case 'in_progress': return 'Continue';
                case 'submitted': return 'Submitted';
                case 'reviewed': return 'View result';
                default: return 'Start';
            }
        };
        vm.statusBadge = function(s) {
            switch (s) {
                case 'reviewed': return 'cc-badge--green';
                case 'submitted': return 'cc-badge--blue';
                case 'in_progress': case 'opened': return 'cc-badge--amber';
                default: return 'cc-badge--grey';
            }
        };

        // ════════════════════════════════════════════
        // MINE — ONE unified list, grouped into three NON-OVERLAPPING states:
        //   to_do          — assigned but not yet submitted (not started / in progress)
        //   awaiting_review — submitted, instructor hasn't reviewed/released yet
        //   reviewed       — marked & released by the instructor
        // Each questionnaire appears in exactly one group. We merge the two sources
        // (assignments = what the instructor set; attempts = the student's actual
        // tries) keyed by questionnaire id, always preferring the real attempt for
        // links so "View"/"Continue" open the right thing.
        // ════════════════════════════════════════════
        function initMine() {
            vm.loading = true;
            var gotAssign = false, gotAttempts = false;
            var assignments = [], attempts = [];
            var done = function() { if (gotAssign && gotAttempts) { mergeMine(assignments, attempts); vm.loading = false; } };

            CourseAssignmentService.Mine().then(function(data) {
                gotAssign = true;
                var items = (data && data.items) ? data.items : (angular.isArray(data) ? data : []);
                assignments = items.filter(function(a) { return a.status !== 'revoked' && !a.revoked; });
                done();
            }, function() { gotAssign = true; done(); });

            QuestionnaireService.Mine().then(function(data) {
                gotAttempts = true;
                attempts = (data && data.items) ? data.items : [];
                done();
            }, function() { gotAttempts = true; done(); });
        }

        // Normalise an attempt's status into one of the three group keys.
        // Key off the attempt's OWN status (attempt_status/status) + score_released —
        // never the assignment's coarse status. A fresh retake's open attempt reads
        // opened/in_progress (score not released) → to_do, even though the assignment
        // may still say 'viewed' or 'assigned'.
        function attemptGroup(at) {
            var s = at.attempt_status || at.status;
            if (s === 'reviewed' || at.score_released) return 'reviewed';
            if (s === 'submitted') return 'awaiting_review';
            return 'to_do';   // opened / in_progress / not started
        }
        // Order attempts so the LATEST one wins (highest id / most-recent start).
        // For a re-assigned questionnaire there are several attempts; the newest is
        // the live one — a fresh retake must surface as to_do, NOT stay parked under
        // the old reviewed attempt. So we pick by recency, not by most-advanced state.
        function attemptOrder(at) {
            return Number(at.id) || 0;
        }

        function mergeMine(assignments, attempts) {
            var byQ = {};   // questionnaire_id -> unified row

            // ── Split CURRENT vs PAST attempts (per questionnaire) ──
            // The hub is questionnaire-centric: ONE live row per questionnaire, showing
            // the current (= LATEST, not best-scoring) attempt. Every OTHER attempt for
            // that same questionnaire — earlier retakes, a stray unsubmitted duplicate,
            // anything not the winner — is that test's history. It's kept with its own
            // row (row.history) and shown via an inline "Previous attempts" expander, so
            // nothing is ever silently dropped. (We don't rely on supersedes_attempt_id:
            // orphan/unlinked extras must show too — this matches the instructor view,
            // which lists every attempt.)
            attempts = attempts || [];
            var currentByQ = {};   // questionnaire_id -> winning (latest) attempt
            attempts.forEach(function(at) {
                var qid = at.questionnaire_id;
                var cur = currentByQ[qid];
                if (!cur || attemptOrder(at) >= attemptOrder(cur)) currentByQ[qid] = at;
            });
            var currentIds = {};
            Object.keys(currentByQ).forEach(function(qid) { currentIds[currentByQ[qid].id] = true; });
            // Past attempts grouped by questionnaire (newest first), attached to the row below.
            var historyByQ = {};   // questionnaire_id -> [past attempts]
            attempts.filter(function(at) { return !currentIds[at.id]; }).forEach(function(at) {
                (historyByQ[at.questionnaire_id] || (historyByQ[at.questionnaire_id] = [])).push(at);
            });
            Object.keys(historyByQ).forEach(function(qid) {
                historyByQ[qid].sort(function(x, y) { return attemptOrder(y) - attemptOrder(x); });
            });
            // Only the current attempt per questionnaire feeds the live 3-state merge.
            attempts = attempts.filter(function(at) { return currentIds[at.id]; });

            // Seed from assignments (questionnaires only; material handled separately below).
            assignments.forEach(function(a) {
                if (a.item_type === 'material') return;   // material isn't part of the 3-state quiz flow
                var qid = a.item_id;
                byQ[qid] = {
                    questionnaire_id: qid,
                    title: a.item_title,
                    message: a.message || null,
                    due_date: a.due_date || null,
                    attach_type: a.attach_type, attach_id: a.attach_id, timing: a.timing,
                    course_sitting_id: a.course_sitting_id,
                    assignment_id: a.id,
                    attempt: null,
                    group: 'to_do'
                };
            });

            // Overlay attempts — the authoritative state + the real link target.
            // The newest attempt per questionnaire wins (see attemptOrder).
            attempts.forEach(function(at) {
                var qid = at.questionnaire_id;
                var row = byQ[qid] || (byQ[qid] = {
                    questionnaire_id: qid,
                    title: at.questionnaire_title || at.title,
                    message: null, due_date: null,
                    attach_type: null, attach_id: null, timing: null,
                    assignment_id: null, attempt: null, group: 'to_do'
                });
                var g = attemptGroup(at);
                // The LATEST attempt is authoritative — a fresh retake (newer attempt,
                // not yet submitted) must override an older reviewed/submitted one and
                // pull the row back to to_do.
                if (!row.attempt || attemptOrder(at) >= attemptOrder(row.attempt)) {
                    row.attempt = at;
                    row.group = g;
                    row.title = row.title || at.questionnaire_title || at.title;
                    row.target_title = at.target_title;
                    row.course_reference = at.course_reference;
                    row.auto_score = at.auto_score; row.max_score = at.max_score;
                    row.score_released = at.score_released;
                }
            });

            var rows = Object.keys(byQ).map(function(k) { return byQ[k]; });
            // Attach each questionnaire's earlier attempts to its row (inline expander).
            rows.forEach(function(r) {
                r.history = historyByQ[r.questionnaire_id] || [];
                r.showHistory = false;
            });
            vm.toDo = rows.filter(function(r) { return r.group === 'to_do'; });
            vm.awaiting = rows.filter(function(r) { return r.group === 'awaiting_review'; });
            vm.reviewed = rows.filter(function(r) { return r.group === 'reviewed'; });

            // Material assignments still surface in their own simple list.
            vm.materials = assignments.filter(function(a) { return a.item_type === 'material'; });

            // Sort: to-do by due date; reviewed newest first.
            vm.toDo.sort(function(x, y) { return (x.due_date || '9999') < (y.due_date || '9999') ? -1 : 1; });
            vm.outstandingCount = vm.toDo.length + vm.materials.filter(function(a){ return a.status !== 'completed'; }).length;
        }

        // ── Past-attempt (history) helpers ──
        // A "past" attempt is any attempt that isn't the current one for its
        // questionnaire — an earlier retake, or a stray unsubmitted duplicate. Most are
        // finished (submitted/reviewed); an unsubmitted one is shown for completeness
        // but has no result page to open. They live on each row (r.history) and are
        // revealed by a per-row "Previous attempts" expander.
        vm.toggleHistory = function(r, $event) {
            if ($event) $event.stopPropagation();
            r.showHistory = !r.showHistory;
        };
        function pastSubmitted(at) {
            return at.status === 'submitted' || at.status === 'reviewed' || !!at.submitted_at;
        }
        vm.pastStatusText = function(at) {
            if (at.status === 'reviewed' || at.score_released) return 'Reviewed';
            if (at.status === 'submitted') return 'Submitted';
            if (at.status === 'opened' || at.status === 'in_progress') return 'Not submitted';
            return vm.pretty(at.status);
        };
        vm.pastBadgeClass = function(at) {
            if (at.status === 'reviewed' || at.score_released) return 'cc-badge--green';
            if (at.status === 'submitted') return 'cc-badge--blue';
            return 'cc-badge--grey';
        };
        vm.hasPastScore = function(at) {
            return at.score_released && at.max_score != null;
        };
        // Only a submitted/reviewed past attempt has a result page worth opening.
        vm.pastViewable = function(at) { return pastSubmitted(at); };
        vm.openPastAttempt = function(at) {
            if (!pastSubmitted(at)) return;   // nothing to show for an unsubmitted attempt
            // The result page tolerates a non-current attempt (owner-scoped, not current-gated).
            $state.go('dashboard.my_account.questionnaire_result', { attempt_id: at.id });
        };

        // ── Unified row helpers (one questionnaire, one state) ──
        vm.rowBadgeClass = function(r) {
            switch (r.group) {
                case 'reviewed': return 'cc-badge--green';
                case 'awaiting_review': return 'cc-badge--blue';
                default: return 'cc-badge--amber';
            }
        };
        vm.rowStatusText = function(r) {
            if (r.group === 'reviewed') return 'Reviewed';
            if (r.group === 'awaiting_review') return 'Submitted · awaiting review';
            // to_do — distinguish not-started from in-progress
            return (r.attempt && (r.attempt.status === 'opened' || r.attempt.status === 'in_progress')) ? 'In progress' : 'To do';
        };
        vm.rowActionLabel = function(r) {
            if (r.group === 'reviewed') return 'View result';
            if (r.group === 'awaiting_review') return 'View submission';
            return (r.attempt && (r.attempt.status === 'opened' || r.attempt.status === 'in_progress')) ? 'Continue' : 'Start';
        };
        // Material assignment → open the material viewer.
        vm.openMaterial = function(a) {
            if (a.id) CourseAssignmentService.MarkViewed(a.id);
            $state.go('dashboard.my_account.material_view', { material_id: a.item_id });
        };

        // Always open via the real attempt when one exists (fixes the empty/blank
        // "view submission"); only fall back to "take" when nothing's been started.
        vm.openRow = function(r) {
            if (r.assignment_id) CourseAssignmentService.MarkViewed(r.assignment_id);
            if (r.attempt && r.attempt.id) {
                if (r.group === 'to_do') {
                    // resume the in-progress attempt
                    $state.go('dashboard.my_account.questionnaire_take', { questionnaire_id: r.questionnaire_id });
                } else {
                    $state.go('dashboard.my_account.questionnaire_result', { attempt_id: r.attempt.id });
                }
            } else {
                $state.go('dashboard.my_account.questionnaire_take', {
                    questionnaire_id: r.questionnaire_id,
                    attach_type: r.attach_type, attach_id: r.attach_id,
                    timing: r.timing, sitting: r.course_sitting_id
                });
            }
        };

        // ════════════════════════════════════════════
        // TAKE — open/resume → answer → save/submit
        // ════════════════════════════════════════════
        var timer = null, secondsSinceSave = 0;

        function initTake() {
            vm.qid = $stateParams.questionnaire_id;
            vm.answers = {};            // question_id -> { selected:[], text:'' }
            vm.submitted = false;
            vm.loading = true;

            var ctx = {};
            if ($stateParams.attach_type) ctx.attach_type = $stateParams.attach_type;
            if ($stateParams.attach_id) ctx.attach_id = $stateParams.attach_id;
            if ($stateParams.timing) ctx.timing = $stateParams.timing;   // pre/post is part of attempt identity
            if ($stateParams.sitting) ctx.course_sitting_id = $stateParams.sitting;   // target a specific run (else backend auto-resolves the open one)

            QuestionnaireService.Open(vm.qid, ctx).then(function(data) {
                vm.loading = false;
                if (!data || data.success === false) { ToastService.error('Could not open', (data && data.message) || ''); return; }
                vm.attempt = data.attempt;
                vm.q = data.questionnaire;
                vm.questions = (data.questionnaire && data.questionnaire.questions) || [];
                // Seed answers from any saved progress.
                (data.answers || []).forEach(function(a) {
                    vm.answers[a.question_id] = {
                        selected: a.selected_option_ids ? String(a.selected_option_ids).split(',').map(Number) : [],
                        text: a.free_text_answer || ''
                    };
                });
                vm.questions.forEach(function(qq) { if (!vm.answers[qq.id]) vm.answers[qq.id] = { selected: [], text: '' }; });
                loadQuestionImages();
                startTimer();
            });
        }

        // Fetch any question images (encrypted lesson_content_files) and embed inline.
        function loadQuestionImages() {
            vm.questions.forEach(function(qq) {
                if (qq.image_file_id) {
                    CourseService.GetLessonContentFileData(qq.image_file_id).then(function(d) {
                        if (d && d.data_uri) qq._imageUri = d.data_uri;
                    });
                }
            });
        }

        function startTimer() {
            secondsSinceSave = 0;
            timer = $interval(function() {
                secondsSinceSave++;
                // Auto-save active time roughly every 30s.
                if (secondsSinceSave >= 30) { autosave(); }
            }, 1000);
        }
        function stopTimer() { if (timer) { $interval.cancel(timer); timer = null; } }
        $scope.$on('$destroy', function() { stopTimer(); });

        // Build the answers payload from vm.answers.
        function answerPayload() {
            return vm.questions.map(function(qq) {
                var a = vm.answers[qq.id] || {};
                if (qq.type === 'multiple_choice') {
                    return { question_id: qq.id, selected_option_ids: (a.selected || []) };
                }
                return { question_id: qq.id, free_text_answer: a.text || '' };
            });
        }

        function autosave() {
            if (!vm.attempt || vm.submitted) return;
            var add = secondsSinceSave; secondsSinceSave = 0;
            QuestionnaireService.SaveAttempt(vm.attempt.id, { answers: answerPayload(), add_seconds: add });
        }
        vm.saveNow = function() {
            autosave();
            ToastService.success('Saved', 'Your progress is saved — you can come back anytime.');
        };

        // MC selection (radio for single, checkbox for multi).
        vm.toggleOption = function(qq, opt) {
            var a = vm.answers[qq.id];
            if (qq.multi_select) {
                var i = a.selected.indexOf(opt.id);
                if (i > -1) a.selected.splice(i, 1); else a.selected.push(opt.id);
            } else {
                a.selected = [opt.id];
            }
        };
        vm.isChosen = function(qq, opt) {
            var a = vm.answers[qq.id];
            return a && a.selected.indexOf(opt.id) > -1;
        };

        vm.unansweredRequired = function() {
            return vm.questions.filter(function(qq) {
                if (!qq.required) return false;
                var a = vm.answers[qq.id] || {};
                if (qq.type === 'multiple_choice') return !a.selected || a.selected.length === 0;
                return !a.text || !a.text.trim();
            });
        };

        vm.submit = function() {
            var missing = vm.unansweredRequired();
            if (missing.length) {
                ToastService.warning('Almost there', missing.length + ' required question' + (missing.length === 1 ? '' : 's') + ' still to answer.');
                return;
            }
            stopTimer();
            vm.submitting = true;
            QuestionnaireService.Submit(vm.attempt.id, { answers: answerPayload(), add_seconds: secondsSinceSave }).then(function(data) {
                vm.submitting = false;
                if (!data || !data.success) { ToastService.error('Could not submit', (data && data.message) || ''); startTimer(); return; }
                vm.submitted = true;
                vm.attempt = data.attempt || vm.attempt;
                // Instant score if the questionnaire opted in and score came back.
                if (vm.attempt && vm.attempt.auto_score !== null && vm.attempt.auto_score !== undefined && vm.attempt.max_score) {
                    vm.instantScore = { auto: vm.attempt.auto_score, max: vm.attempt.max_score };
                    ToastService.success('Submitted', 'Scored ' + vm.attempt.auto_score + ' / ' + vm.attempt.max_score);
                } else {
                    ToastService.success('Submitted', 'Your instructor will review this with you.');
                }
            });
        };

        // ════════════════════════════════════════════
        // RESULT — released score + instructor notes
        // ════════════════════════════════════════════
        function initResult() {
            vm.attemptId = $stateParams.attempt_id;
            vm.loading = true;
            vm.rows = [];   // per-question rows for the review list
            QuestionnaireService.GetAttempt(vm.attemptId).then(function(data) {
                if (!data || data.success === false) { vm.loading = false; ToastService.error('Could not load', (data && data.message) || ''); return; }
                vm.attempt = data.attempt || data;
                vm.q = data.questionnaire || null;
                vm.answers = data.answers || [];
                vm.released = vm.attempt && (vm.attempt.score_released || vm.attempt.status === 'reviewed');

                // The attempt response carries the answers (with prompt + is_correct)
                // but NOT the option labels. Fetch the definition for labels (and the
                // answer key, if the backend exposes it to this user).
                var qid = vm.attempt.questionnaire_id || (vm.q && vm.q.id);
                if (qid) {
                    QuestionnaireService.Get(qid).then(function(def) {
                        var item = def && def.item;
                        var qById = {};
                        if (item && item.questions) item.questions.forEach(function(q) { qById[q.id] = q; });
                        buildRows(qById);
                        vm.loading = false;
                    }, function() { buildRows({}); vm.loading = false; });
                } else {
                    buildRows({}); vm.loading = false;
                }
            });
        }

        // Build display rows from the answers + (optional) definition for labels/key.
        function buildRows(qById) {
            vm.rows = (vm.answers || []).map(function(a) {
                var def = qById[a.question_id] || {};
                var rawOpts = def.options || [];
                var type = a.type || def.type;
                var isMC = type === 'multiple_choice';
                var selIds = a.selected_option_ids ? String(a.selected_option_ids).split(',').map(String) : [];

                // Per-option flags so the view can render the full MC list with
                // chosen / correct highlighting.
                var keyKnown = rawOpts.some(function(o) { return o.is_correct == 1; });
                var options = rawOpts.map(function(o) {
                    return {
                        label: o.label,
                        chosen: selIds.indexOf(String(o.id)) > -1,
                        correct: o.is_correct == 1
                    };
                });
                var chosen = options.filter(function(o) { return o.chosen; }).map(function(o) { return o.label; });
                var correct = options.filter(function(o) { return o.correct; }).map(function(o) { return o.label; });

                return {
                    prompt: a.prompt || def.prompt,
                    type: type,
                    isMC: isMC,
                    isCorrect: (a.is_correct === 1 || a.is_correct === '1'),
                    awarded: a.awarded_points,
                    points: def.points,
                    options: options,        // full list (when labels available)
                    keyKnown: keyKnown,      // whether the correct answer is revealed
                    yourAnswer: (type === 'free_text')
                        ? (a.free_text_answer || '—')
                        : (chosen.length ? chosen.join(', ') : null),
                    answered: selIds.length > 0 || !!a.free_text_answer,
                    correctAnswer: correct.length ? correct.join(', ') : null,
                    comment: a.instructor_comment || null   // per-answer coaching (shown once released)
                };
            });

            // ── Score summary ──
            var maxScore = parseFloat(vm.attempt.max_score) || 0;
            var autoScore = parseFloat(vm.attempt.auto_score) || 0;
            vm.hasScore = maxScore > 0;
            vm.scorePct = vm.hasScore ? Math.round((autoScore / maxScore) * 100) : null;
            // Count MC questions right/wrong for the headline.
            var mc = vm.rows.filter(function(r) { return r.isMC; });
            vm.mcTotal = mc.length;
            vm.mcCorrect = mc.filter(function(r) { return r.isCorrect; }).length;
            // Tone for the score hero by percentage.
            vm.scoreTone = (vm.scorePct === null) ? 'pending'
                : (vm.scorePct >= 80 ? 'pass' : (vm.scorePct >= 50 ? 'ok' : 'low'));
        }
    }
