// ─────────────────────────────────────────────────────
// Exam sales modals — one component, used everywhere:
//   ExamResultModalController      enter/edit a result (manual pass/fail,
//                                  score %, CAA certificate upload)
//   ExamAuditModalController       per-record audit history timeline
//   ExamCertificateModalController view a decrypted certificate (img/PDF)
// Opened from the shop Exams tab, the exam-results admin screen, the
// student-records page and the student's own exams page.
// Contract: BACKEND_EXAM_SALES_GUIDE.md.
// ─────────────────────────────────────────────────────

app.controller('ExamResultModalController', ExamResultModalController);

    ExamResultModalController.$inject = ['$uibModalInstance', '$uibModal', '$timeout', 'ExamSalesService', 'ToastService', 'context'];
    function ExamResultModalController($uibModalInstance, $uibModal, $timeout, ExamSalesService, ToastService, context) {

        var vm = this;

        vm.mode = context.mode;                    // 'enter' | 'edit'
        vm.purchase = context.purchase || null;    // enter mode
        vm.record = context.record || null;        // edit mode
        vm.is_manager = context.is_manager === true;
        vm.exam_title = context.exam_title || (vm.purchase && vm.purchase.exam_title) || '';
        vm.course_title = context.course_title || (vm.purchase && vm.purchase.course_title) || '';
        vm.student_name = context.student_name || (vm.purchase ? ((vm.purchase.student_first_name || '') + ' ' + (vm.purchase.student_last_name || '')).trim() : '');

        vm.saving = false;
        vm.drag_over = false;

        // Pass/fail is the admin's MANUAL assertion — never derived from the
        // score, never pre-selected.
        vm.form = {
            date: new Date(),
            result: null,
            pass_fail: null,          // 0 | 1, required
            sitting: '',
            set_no: '',
            examiner: '',
            notes: '',
            reason: ''                // edit mode only — lands in the audit trail
        };

        if (vm.mode === 'edit' && vm.record) {
            vm.form.date = vm.record.date ? new Date(String(vm.record.date).replace(' ', 'T')) : new Date();
            vm.form.result = (vm.record.result !== null && vm.record.result !== undefined && vm.record.result !== '') ? parseFloat(vm.record.result) : null;
            vm.form.pass_fail = (vm.record.pass_fail === null || vm.record.pass_fail === undefined) ? null : parseInt(vm.record.pass_fail, 10);
            vm.form.sitting = vm.record.sitting || '';
            vm.form.set_no = vm.record.set_no || '';
            vm.form.examiner = vm.record.examiner || '';
            vm.form.notes = vm.record.notes || '';
        }

        vm.setPassFail = function(val) {
            vm.form.pass_fail = (vm.form.pass_fail === val) ? null : val;
        };

        // ── Certificates ──
        vm.files = { existing: [], queued: [], loading: false, busy: {} };

        function loadExisting() {
            if (vm.mode !== 'edit' || !vm.record) { return; }
            vm.files.loading = true;
            ExamSalesService.GetFilesForRecord(vm.record.id).then(function(data) {
                vm.files.loading = false;
                vm.files.existing = (data && (data.files || data.items)) || (angular.isArray(data) ? data : []);
            });
        }
        loadExisting();

        var ACCEPTED = { 'image/png': 'image', 'image/jpeg': 'image', 'application/pdf': 'pdf' };
        var MAX_BYTES = 20 * 1024 * 1024;

        vm.setDragState = function(isDragging) { vm.drag_over = isDragging; };

        vm.addFiles = function(files) {
            angular.forEach(files, function(file) {
                var kind = ACCEPTED[file.type];
                if (!kind) {
                    ToastService.warning('Not Added', '"' + file.name + '" — only PNG, JPG or PDF certificates can be uploaded.');
                    return;
                }
                if (file.size > MAX_BYTES) {
                    ToastService.warning('Too Large', '"' + file.name + '" is over the 20 MB limit.');
                    return;
                }
                var entry = { file: file, name: file.name, size: file.size, kind: kind, preview: null };
                if (kind === 'image') {
                    try { entry.preview = URL.createObjectURL(file); } catch (e) {}
                }
                vm.files.queued.push(entry);
            });
        };

        vm.removeQueued = function(index) {
            var entry = vm.files.queued[index];
            if (entry && entry.preview) { try { URL.revokeObjectURL(entry.preview); } catch (e) {} }
            vm.files.queued.splice(index, 1);
        };

        vm.viewExisting = function(f) {
            $uibModal.open({
                templateUrl: 'views/modals/exam_certificate_modal.html',
                controller: 'ExamCertificateModalController',
                controllerAs: 'vm',
                size: 'lg',
                resolve: { context: function() { return { file_id: f.id, title: f.original_name }; } }
            });
        };

        // Manager-only, two-step inline confirm (no browser confirm).
        vm.askDeleteExisting = function(f) { f._confirmDelete = true; };
        vm.cancelDeleteExisting = function(f) { f._confirmDelete = false; };
        vm.deleteExisting = function(f) {
            if (vm.files.busy[f.id]) { return; }
            vm.files.busy[f.id] = true;
            ExamSalesService.DeleteFile(f.id).then(function(data) {
                vm.files.busy[f.id] = false;
                if (data && data.success) {
                    ToastService.success('Certificate Removed', '"' + f.original_name + '" deleted.');
                    loadExisting();
                } else {
                    ToastService.error('Not Removed', (data && data.message) || 'Could not delete the certificate.');
                }
            });
        };

        // Upload the queue one-by-one against the record id; resolves when done.
        function uploadQueued(exam_record_id) {
            var queue = vm.files.queued.slice();
            var failed = [];
            function next(i) {
                if (i >= queue.length) {
                    if (failed.length) {
                        ToastService.warning('Some Certificates Failed', failed.join(', ') + ' could not be uploaded — try again from the result.');
                    }
                    return Promise.resolve();
                }
                queue[i]._uploading = true;
                return ExamSalesService.UploadFile(queue[i].file, exam_record_id).then(function(data) {
                    queue[i]._uploading = false;
                    if (!data || !data.success) { failed.push('"' + queue[i].name + '"'); }
                    return next(i + 1);
                });
            }
            return next(0);
        }

        // ── Save ──
        vm.save = function() {
            if (vm.saving) { return; }
            if (vm.form.pass_fail !== 0 && vm.form.pass_fail !== 1) {
                ToastService.warning('Pass or Fail?', 'Confirm whether the student passed — this is your assertion, it is never inferred from the score.');
                return;
            }
            var result = (vm.form.result === null || vm.form.result === undefined || vm.form.result === '') ? null : parseFloat(vm.form.result);
            if (result !== null && (isNaN(result) || result < 0 || result > 100)) {
                ToastService.warning('Score Invalid', 'The score must be between 0 and 100%.');
                return;
            }
            if (!vm.form.date) {
                ToastService.warning('Date Required', 'When was the exam sat?');
                return;
            }

            var body = {
                date: moment(vm.form.date).format('YYYY-MM-DD'),
                pass_fail: vm.form.pass_fail,
                sitting: vm.form.sitting || '',
                set_no: vm.form.set_no || '',
                examiner: vm.form.examiner || '',
                notes: vm.form.notes || ''
            };
            if (result !== null) { body.result = result; }

            vm.saving = true;

            if (vm.mode === 'enter') {
                ExamSalesService.EnterResult(vm.purchase.id, body).then(function(data) {
                    if (data && data.success) {
                        uploadQueued(data.exam_record_id).then(function() {
                            $timeout(function() {
                                vm.saving = false;
                                ToastService.success('Result Recorded', vm.exam_title + ' — ' + (body.pass_fail == 1 ? 'PASS' : 'FAIL') + (result !== null ? ' at ' + result + '%' : '') + '.');
                                $uibModalInstance.close({ saved: true, exam_record_id: data.exam_record_id });
                            });
                        });
                    } else {
                        vm.saving = false;
                        ToastService.error('Not Saved', (data && data.message) || 'Could not record the result.');
                    }
                });
            } else {
                if (vm.form.reason && vm.form.reason.trim()) { body.reason = vm.form.reason.trim(); }
                ExamSalesService.UpdateRecord(vm.record.id, body).then(function(data) {
                    if (data && data.success) {
                        uploadQueued(vm.record.id).then(function() {
                            $timeout(function() {
                                vm.saving = false;
                                ToastService.success('Result Updated', vm.exam_title + ' updated.');
                                $uibModalInstance.close({ saved: true, exam_record_id: vm.record.id });
                            });
                        });
                    } else {
                        vm.saving = false;
                        ToastService.error('Not Saved', (data && data.message) || 'Could not update the result.');
                    }
                });
            }
        };

        vm.cancel = function() {
            angular.forEach(vm.files.queued, function(entry) {
                if (entry.preview) { try { URL.revokeObjectURL(entry.preview); } catch (e) {} }
            });
            $uibModalInstance.dismiss('cancel');
        };
    }


app.controller('ExamAuditModalController', ExamAuditModalController);

    ExamAuditModalController.$inject = ['$uibModalInstance', 'ExamSalesService', 'context'];
    function ExamAuditModalController($uibModalInstance, ExamSalesService, context) {

        var vm = this;

        vm.heading = context.heading || 'Result history';
        vm.loading = true;
        vm.trail = [];

        ExamSalesService.GetRecordAudit(context.exam_record_id).then(function(data) {
            vm.loading = false;
            vm.trail = (data && (data.trail || data.items)) || (angular.isArray(data) ? data : []);
        });

        // fromNow needs moment — expose it to the template.
        vm.ago = function(ts) {
            return ts ? moment(String(ts).replace(' ', 'T')).fromNow() : '';
        };

        vm.actionLabel = function(action) {
            return String(action || '').replace(/_/g, ' ');
        };

        // "Score %: 88 → 92; Pass/fail: …" → one chip per change.
        vm.changeChips = function(entry) {
            if (!entry.changes_summary) { return []; }
            return String(entry.changes_summary).split(';').map(function(s) { return s.trim(); }).filter(Boolean);
        };

        vm.toggleRaw = function(entry) { entry._showRaw = !entry._showRaw; };

        vm.close = function() { $uibModalInstance.dismiss('cancel'); };
    }


app.controller('ExamCertificateModalController', ExamCertificateModalController);

    ExamCertificateModalController.$inject = ['$uibModalInstance', '$sce', 'ExamSalesService', 'context'];
    function ExamCertificateModalController($uibModalInstance, $sce, ExamSalesService, context) {

        var vm = this;

        vm.title = context.title || 'Certificate';
        vm.loading = true;
        vm.file = null;
        vm.src = null;

        ExamSalesService.GetFile(context.file_id).then(function(data) {
            vm.loading = false;
            if (data && (data.data_uri || data.file)) {
                vm.file = data;
                var uri = data.data_uri || ('data:' + data.mime_type + ';base64,' + data.file);
                vm.src = $sce.trustAsResourceUrl(uri);
            } else {
                vm.error = (data && data.message) || 'The certificate could not be loaded.';
            }
        });

        vm.close = function() { $uibModalInstance.dismiss('cancel'); };
    }
