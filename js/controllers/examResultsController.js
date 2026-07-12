app.controller('ExamResultsController', ExamResultsController);

    ExamResultsController.$inject = ['ExamSalesService', 'ClubService', 'ToastService', '$rootScope', '$scope', '$state', '$stateParams', '$uibModal', 'PaymentService', 'MemberService', '$sce'];
    function ExamResultsController(ExamSalesService, ClubService, ToastService, $rootScope, $scope, $state, $stateParams, $uibModal, PaymentService, MemberService, $sce) {

        // Exam results admin screen — four tabs:
        //   outstanding  purchases awaiting a result (oldest first, amber > 7 days)
        //   purchases    every sale with status filter, cancel, edit/delete/history
        //   activity     club-wide exam-record audit trail, paginated
        //   pricing      per-course default price + VAT + per-exam overrides
        // Result entry/edit/history use the shared exam_result/audit modals.
        // Contract: BACKEND_EXAM_SALES_GUIDE.md §5.2–§5.4.

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin.id;
        vm.is_manager = (vm.user.access.manager || []).indexOf(vm.club_id) > -1 ||
                        (vm.user.access.super_admin || []).length > 0;
        vm.currency = '£';

        ClubService.GetById(vm.club_id).then(function(data) {
            if (data && data.account_currency) { vm.currency = data.account_currency; }
        });

        // ── Tabs ──
        vm.tab = $stateParams.tab || 'outstanding';
        vm.setTab = function(tab) {
            vm.tab = tab;
            $state.go('.', { tab: tab }, { notify: false });
            loadTab(tab);
        };

        function loadTab(tab) {
            if (tab === 'outstanding' && !vm.pending.loaded) { vm.loadPending(); }
            if (tab === 'purchases' && !vm.purch.loaded) { vm.loadPurchases(); }
            if (tab === 'activity' && !vm.audit.loaded) { vm.loadAudit(1); }
            if (tab === 'pricing' && !vm.pricing.loaded) { vm.loadPricing(); }
        }

        // ── Outstanding results ──
        vm.pending = { loading: false, loaded: false, items: [] };

        vm.loadPending = function() {
            vm.pending.loading = true;
            ExamSalesService.GetPending(vm.club_id).then(function(data) {
                vm.pending.loading = false;
                vm.pending.loaded = true;
                vm.pending.items = (data && (data.purchases || data.items)) || [];
            });
        };

        vm.waitingDays = function(purchase) {
            if (!purchase.created_at) { return 0; }
            return moment().diff(moment(String(purchase.created_at).replace(' ', 'T')), 'days');
        };

        // ── All purchases ──
        vm.purch = { loading: false, loaded: false, items: [], status: '' };

        vm.loadPurchases = function() {
            vm.purch.loading = true;
            ExamSalesService.GetByClub(vm.club_id, vm.purch.status || null).then(function(data) {
                vm.purch.loading = false;
                vm.purch.loaded = true;
                vm.purch.items = (data && (data.purchases || data.items)) || [];
            });
        };

        vm.setStatus = function(status) {
            vm.purch.status = status;
            vm.loadPurchases();
        };

        function refreshAll() {
            vm.loadPending();
            if (vm.purch.loaded) { vm.loadPurchases(); }
            if (vm.audit.loaded) { vm.loadAudit(vm.audit.page); }
        }

        // ── Result entry / edit / history / delete (shared modals) ──
        vm.enterResult = function(purchase) {
            $uibModal.open({
                templateUrl: 'views/modals/exam_result_modal.html',
                controller: 'ExamResultModalController',
                controllerAs: 'vm',
                backdrop: 'static',
                resolve: { context: function() { return { mode: 'enter', purchase: purchase, is_manager: vm.is_manager }; } }
            }).result.then(function(res) {
                if (res && res.saved) { refreshAll(); }
            }, function() {});
        };

        vm.editResult = function(purchase) {
            if (!purchase.exam_record_id) { return; }
            ExamSalesService.GetRecord(purchase.exam_record_id).then(function(data) {
                var record = (data && (data.item || data.record)) || (data && data.id ? data : null);
                if (!record) {
                    ToastService.error('Not Found', (data && data.message) || 'The exam record could not be loaded.');
                    return;
                }
                $uibModal.open({
                    templateUrl: 'views/modals/exam_result_modal.html',
                    controller: 'ExamResultModalController',
                    controllerAs: 'vm',
                    backdrop: 'static',
                    resolve: { context: function() { return {
                        mode: 'edit',
                        record: record,
                        exam_title: purchase.exam_title,
                        course_title: purchase.course_title,
                        student_name: ((purchase.student_first_name || '') + ' ' + (purchase.student_last_name || '')).trim(),
                        is_manager: vm.is_manager
                    }; } }
                }).result.then(function(res) {
                    if (res && res.saved) { refreshAll(); }
                }, function() {});
            });
        };

        vm.history = function(purchase) {
            if (!purchase.exam_record_id) { return; }
            $uibModal.open({
                templateUrl: 'views/modals/exam_audit_modal.html',
                controller: 'ExamAuditModalController',
                controllerAs: 'vm',
                size: 'lg',
                resolve: { context: function() { return {
                    exam_record_id: purchase.exam_record_id,
                    heading: purchase.exam_title + ' — ' + ((purchase.student_first_name || '') + ' ' + (purchase.student_last_name || '')).trim()
                }; } }
            });
        };

        // Cancel a purchase (manager) — two-step inline with an optional reason.
        // Cancel ≠ refund: money moves through the normal invoice tools.
        vm.askCancel = function(purchase) { purchase._confirmCancel = true; purchase._cancelReason = ''; };
        vm.cancelCancel = function(purchase) { purchase._confirmCancel = false; };
        vm.doCancel = function(purchase) {
            if (purchase._busy) { return; }
            purchase._busy = true;
            ExamSalesService.CancelPurchase(purchase.id, purchase._cancelReason).then(function(data) {
                purchase._busy = false;
                purchase._confirmCancel = false;
                if (data && data.success) {
                    ToastService.success('Purchase Cancelled', purchase.exam_title + ' cancelled. Any refund is handled through the invoice as usual.');
                    refreshAll();
                } else {
                    ToastService.error('Not Cancelled', (data && data.message) || 'The purchase could not be cancelled.');
                }
            });
        };

        // Delete a result (manager) — soft delete; a linked purchase re-opens.
        vm.askDelete = function(purchase) { purchase._confirmDelete = true; purchase._deleteReason = ''; };
        vm.cancelDelete = function(purchase) { purchase._confirmDelete = false; };
        vm.doDelete = function(purchase) {
            if (purchase._busy || !purchase.exam_record_id) { return; }
            purchase._busy = true;
            ExamSalesService.DeleteRecord(purchase.exam_record_id, purchase._deleteReason).then(function(data) {
                purchase._busy = false;
                purchase._confirmDelete = false;
                if (data && data.success) {
                    ToastService.success('Result Deleted', 'Removed from the student\'s records — the purchase is back on the outstanding list.');
                    refreshAll();
                } else {
                    ToastService.error('Not Deleted', (data && data.message) || 'The result could not be deleted.');
                }
            });
        };

        // ── Invoice payment (take / re-take payment for a purchase) ──
        // A purchase's invoice can be paid any time after the sale — the
        // payment window closing unpaid must never strand it. Rows show a
        // paid/unpaid chip from invoice_status (joined by the backend) and
        // unpaid ones get a "Take payment" that opens the same payment
        // accordion used by the shop / invoices pages.
        vm.payKind = function(purchase) {
            return ExamSalesService.InvoiceStatusKind(purchase.invoice_status);
        };

        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';

        vm.methods = [
            { id: 'direct-debit', title: 'Direct Debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
            { id: 'card-machine', title: 'Card Machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
        ];
        vm.savedCards = [];
        vm.default_payment = 'new-card';
        vm.show_pay_now = false;
        vm.pay_loading = false;

        vm.takePayment = function(purchase) {
            if (!purchase.invoice_id || vm.pay_loading) {
                if (!purchase.invoice_id) { ToastService.warning('No Invoice', 'This purchase has no invoice attached — check the invoices screen.'); }
                return;
            }
            vm.pay_loading = true;
            vm._paying = purchase;
            vm.send = { club_id: vm.club_id, user_id: purchase.user_id, invoice_id: purchase.invoice_id };
            MemberService.GetMandate(purchase.user_id, vm.club_id).then(function(data) {
                vm.pay_loading = false;
                if (data.success) {
                    vm.info = data.info;
                    vm.savedCards = data.cards || [];
                    vm.methods[1].visible = vm.savedCards.length > 0;
                    vm.methods[0].visible = vm.info != null;
                    vm.machine = data.machine;
                    vm.methods[3].visible = !!(vm.machine && vm.machine.success);
                    vm.show_pay_now = true;
                } else {
                    ToastService.error('Payment Unavailable', (data && data.message) || 'Could not load the payment options for this member.');
                }
            });
        };

        vm.close_pay_now = function() {
            vm.show_pay_now = false;
            vm.pay_loading = false;
        };

        vm.donConfirm = function(methodLabel, paymentIntent) {
            var purchase = vm._paying;
            if (!purchase) { return; }
            PaymentService.CompleteCustom({
                user_id: purchase.user_id,
                club_id: vm.club_id,
                user: { user_id: purchase.user_id, id: purchase.user_id, first_name: purchase.student_first_name, last_name: purchase.student_last_name },
                invoice_id: purchase.invoice_id,
                method: methodLabel,
                paymentIntent: paymentIntent
            }).then(function(data) {
                if (data && data.success) {
                    vm.show_pay_now = false;
                    ToastService.success('Payment Complete', 'Invoice #' + purchase.invoice_id + ' paid — thank you!');
                    refreshAll();
                } else {
                    ToastService.error('Payment Problem', (data && data.message) || 'The payment could not be completed — try again or use the invoices screen.');
                }
            });
        };

        // ── Club-wide activity (audit trail) ──
        vm.audit = { loading: false, loaded: false, trail: [], total: 0, page: 1, per_page: 50, action_filter: '' };
        vm.audit_actions = ['purchased', 'purchase_cancelled', 'created', 'result_entered', 'updated', 'deleted', 'file_uploaded', 'file_deleted'];

        vm.loadAudit = function(page) {
            vm.audit.loading = true;
            ExamSalesService.GetClubAudit(vm.club_id, page, vm.audit.per_page).then(function(data) {
                vm.audit.loading = false;
                vm.audit.loaded = true;
                vm.audit.trail = (data && (data.trail || data.items)) || [];
                vm.audit.total = (data && data.total) || vm.audit.trail.length;
                vm.audit.page = (data && data.page) || page || 1;
            });
        };

        vm.auditPages = function() {
            return Math.max(1, Math.ceil(vm.audit.total / vm.audit.per_page));
        };

        vm.setAuditFilter = function(action) {
            vm.audit.action_filter = (vm.audit.action_filter === action) ? '' : action;
        };

        vm.auditVisible = function(entry) {
            return !vm.audit.action_filter || entry.action === vm.audit.action_filter;
        };

        vm.ago = function(ts) {
            return ts ? moment(String(ts).replace(' ', 'T')).fromNow() : '';
        };

        vm.actionLabel = function(action) {
            return String(action || '').replace(/_/g, ' ');
        };

        vm.changeChips = function(entry) {
            if (!entry.changes_summary) { return []; }
            return String(entry.changes_summary).split(';').map(function(s) { return s.trim(); }).filter(Boolean);
        };

        vm.toggleRaw = function(entry) { entry._showRaw = !entry._showRaw; };

        // ── Pricing editor ──
        // One PUT per course: default + VAT + the full overrides list
        // (price null clears an override back to the default).
        vm.pricing = { loading: false, loaded: false, courses: [], busy: {} };

        vm.loadPricing = function() {
            vm.pricing.loading = true;
            ExamSalesService.GetCatalog(vm.club_id).then(function(data) {
                vm.pricing.loading = false;
                vm.pricing.loaded = true;
                var courses = (data && data.courses) || [];
                angular.forEach(courses, function(course) {
                    course._default = (course.exam_default_price === null || course.exam_default_price === undefined) ? null : parseFloat(course.exam_default_price);
                    course._vat = (course.exam_vat_rate === null || course.exam_vat_rate === undefined) ? null : parseFloat(course.exam_vat_rate);
                    angular.forEach(course.exams, function(exam) {
                        exam._override = exam.has_override === true || exam.has_override === 1;
                        exam._price = exam._override && exam.price !== null ? parseFloat(exam.price) : null;
                    });
                });
                vm.pricing.courses = courses;
            });
        };

        vm.toggleOverride = function(exam) {
            exam._override = !exam._override;
            if (!exam._override) { exam._price = null; }
        };

        vm.savePricing = function(course) {
            if (vm.pricing.busy[course.course_id]) { return; }
            var overrides = [];
            var bad = null;
            angular.forEach(course.exams, function(exam) {
                if (exam._override) {
                    var p = parseFloat(exam._price);
                    if (isNaN(p) || p < 0) { bad = exam.title; }
                    overrides.push({ exam_id: exam.id, price: p });
                } else {
                    overrides.push({ exam_id: exam.id, price: null });   // clears any old override
                }
            });
            if (bad) {
                ToastService.warning('Price Missing', 'Set an override price for "' + bad + '" (or turn its override off).');
                return;
            }
            var def = (course._default === null || course._default === undefined || course._default === '') ? null : parseFloat(course._default);
            if (def !== null && (isNaN(def) || def < 0)) {
                ToastService.warning('Default Invalid', 'The default price per exam must be a positive amount.');
                return;
            }
            var vat = (course._vat === null || course._vat === undefined || course._vat === '') ? null : parseFloat(course._vat);
            if (vat !== null && (isNaN(vat) || vat < 0 || vat > 100)) {
                ToastService.warning('VAT Invalid', 'The VAT rate must be between 0 and 100%.');
                return;
            }

            vm.pricing.busy[course.course_id] = true;
            ExamSalesService.SavePricing(course.course_id, {
                exam_default_price: def,
                exam_vat_rate: vat,
                overrides: overrides
            }).then(function(data) {
                vm.pricing.busy[course.course_id] = false;
                if (data && data.success) {
                    ToastService.success('Pricing Saved', course.course_title + ' exam pricing updated.');
                    vm.loadPricing();
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'The pricing could not be saved.');
                }
            });
        };

        // Kick off the tab from the URL.
        loadTab(vm.tab);
    }
