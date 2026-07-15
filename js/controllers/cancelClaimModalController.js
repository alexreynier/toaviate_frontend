app.controller('CancelClaimModalController', CancelClaimModalController);

    CancelClaimModalController.$inject = [
        '$scope', '$uibModalInstance', 'CancelClaimService', 'ToastService',
        'plsId', 'clubId', 'flightInfo'
    ];
    function CancelClaimModalController(
        $scope, $uibModalInstance, CancelClaimService, ToastService,
        plsId, clubId, flightInfo
    ) {

        // ═══════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════
        $scope.step = 0;              // 0 = loading, 1 = preview, 2 = confirm, 3 = result
        $scope.loading = false;
        $scope.submitting = false;
        $scope.plsId = plsId;
        $scope.clubId = clubId;
        $scope.flightInfo = flightInfo || {};

        // Preview data
        $scope.preview = null;
        $scope.errorMessage = null;

        // Confirm form
        $scope.form = {
            reason: '',
            financialAction: 'no_refund',
            refundAmount: null
        };
        $scope.formErrors = {};

        // Result
        $scope.result = null;

        // History tab
        $scope.activeTab = 'cancel';   // cancel | history
        $scope.historyData = null;
        $scope.historyPage = 1;
        $scope.historyLoading = false;
        $scope.historyPagination = null;

        // Confirm dialog
        $scope.showConfirmDialog = false;


        // ═══════════════════════════════════════════════
        // INIT — Load preview immediately
        // ═══════════════════════════════════════════════
        loadPreview();

        function loadPreview() {
            $scope.step = 0;
            $scope.loading = true;
            $scope.errorMessage = null;

            CancelClaimService.PreviewCancelClaim(plsId).then(function(data) {
                $scope.loading = false;

                if (data.success) {
                    $scope.preview = data;
                    $scope.step = 1;

                    // Set default refund amount to total paid
                    if (data.financial && data.financial.total_paid > 0) {
                        $scope.form.refundAmount = data.financial.total_paid;
                    }

                    // Set default financial action based on available_actions
                    if (data.available_actions && data.available_actions.length > 0) {
                        if (data.available_actions.indexOf('stripe_refund') > -1) {
                            $scope.form.financialAction = 'stripe_refund';
                        } else if (data.available_actions.indexOf('credit_account') > -1) {
                            $scope.form.financialAction = 'credit_account';
                        } else {
                            $scope.form.financialAction = 'no_refund';
                        }
                    }
                } else {
                    $scope.errorMessage = data.message || 'Failed to load cancellation preview.';
                    $scope.step = -1; // error state
                }
            });
        }


        // ═══════════════════════════════════════════════
        // NAVIGATION
        // ═══════════════════════════════════════════════
        $scope.goToConfirm = function() {
            $scope.step = 2;
        };

        $scope.goBackToPreview = function() {
            $scope.step = 1;
            $scope.formErrors = {};
        };

        $scope.setTab = function(tab) {
            $scope.activeTab = tab;
            if (tab === 'history' && !$scope.historyData) {
                $scope.loadHistory(1);
            }
        };

        $scope.close = function() {
            $uibModalInstance.close({
                success: $scope.result ? true : false,
                cancelled: !!$scope.result
            });
        };

        $scope.dismiss = function() {
            $uibModalInstance.dismiss('cancel');
        };


        // ═══════════════════════════════════════════════
        // FINANCIAL ACTION
        // ═══════════════════════════════════════════════
        $scope.setFinancialAction = function(action) {
            $scope.form.financialAction = action;
        };

        $scope.isActionAvailable = function(action) {
            if (!$scope.preview || !$scope.preview.available_actions) return false;
            return $scope.preview.available_actions.indexOf(action) > -1;
        };

        $scope.hasOnlyNoRefund = function() {
            if (!$scope.preview || !$scope.preview.available_actions) return true;
            return $scope.preview.available_actions.length === 1 &&
                   $scope.preview.available_actions[0] === 'no_refund';
        };


        // ═══════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════
        $scope.formatCurrency = function(amount) {
            if (amount == null || isNaN(amount)) return '—';
            var symbol = ($scope.preview && $scope.preview.financial && $scope.preview.financial.currency_symbol) || '£';
            return symbol + parseFloat(amount).toFixed(2);
        };

        $scope.getWarningIcon = function(level) {
            switch (level) {
                case 'critical': return 'fa-exclamation';
                case 'high':     return 'fa-exclamation-triangle';
                case 'info':     return 'fa-info';
                default:         return 'fa-info';
            }
        };

        $scope.getEntityIcon = function(type) {
            switch (type) {
                case 'credit_note':      return 'fa-file-alt';
                case 'payment':          return 'fa-credit-card';
                case 'invoice':          return 'fa-file-alt';
                case 'training_record':  return 'fa-graduation-cap';
                case 'voucher':          return 'fa-ticket-alt';
                case 'booking':          return 'fa-calendar';
                case 'plane_log_sheet':  return 'fa-plane';
                default:                 return 'fa-circle';
            }
        };

        $scope.getEntityActionLabel = function(action) {
            switch (action) {
                case 'created':          return 'Created';
                case 'refunded':         return 'Refunded';
                case 'voided':           return 'Voided';
                case 'archived':         return 'Archived';
                case 'restored':         return 'Restored';
                case 'cancelled':        return 'Cancelled';
                case 'claim_cancelled':  return 'Unclaimed';
                default:                 return action;
            }
        };

        $scope.getFinanceMethodLabel = function() {
            if (!$scope.preview || !$scope.preview.financial) return '';
            var f = $scope.preview.financial;
            if (f.has_stripe_payment)    return 'Stripe';
            if (f.has_gocardless_payment) return 'GoCardless';
            if (f.has_account_payment)   return 'Account';
            return '';
        };

        $scope.getFinanceMethodClass = function() {
            if (!$scope.preview || !$scope.preview.financial) return '';
            var f = $scope.preview.financial;
            if (f.has_stripe_payment)    return 'cc-finance-method--stripe';
            if (f.has_gocardless_payment) return 'cc-finance-method--gocardless';
            if (f.has_account_payment)   return 'cc-finance-method--account';
            return '';
        };

        $scope.getPaymentStatusBadge = function() {
            if (!$scope.preview || !$scope.preview.financial) return '';
            var f = $scope.preview.financial;
            if (f.total_paid > 0 && f.total_unpaid === 0) return 'paid';
            if (f.total_paid > 0 && f.total_unpaid > 0) return 'partial';
            return 'unpaid';
        };

        $scope.getPaymentStatusLabel = function() {
            var status = $scope.getPaymentStatusBadge();
            switch (status) {
                case 'paid':    return 'Fully Paid';
                case 'partial': return 'Partially Paid';
                case 'unpaid':  return 'Unpaid';
                default:        return '';
            }
        };


        // ═══════════════════════════════════════════════
        // EXECUTE CANCELLATION
        // ═══════════════════════════════════════════════
        $scope.validateForm = function() {
            $scope.formErrors = {};
            var valid = true;

            if (!$scope.form.reason || !$scope.form.reason.trim()) {
                $scope.formErrors.reason = 'A reason for cancellation is required.';
                valid = false;
            }

            if ($scope.form.refundAmount != null && $scope.preview && $scope.preview.financial) {
                var maxAmount = $scope.preview.financial.total_paid || 0;
                if ($scope.form.refundAmount > maxAmount) {
                    $scope.formErrors.refundAmount = 'Cannot exceed ' + $scope.formatCurrency(maxAmount);
                    valid = false;
                }
                if ($scope.form.refundAmount < 0) {
                    $scope.formErrors.refundAmount = 'Amount cannot be negative.';
                    valid = false;
                }
            }

            return valid;
        };

        $scope.confirmCancellation = function() {
            if (!$scope.validateForm()) return;
            $scope.showConfirmDialog = true;
        };

        $scope.cancelConfirmDialog = function() {
            $scope.showConfirmDialog = false;
        };

        $scope.executeCancellation = function() {
            $scope.showConfirmDialog = false;
            $scope.submitting = true;

            var payload = {
                plane_log_sheet_id: plsId,
                reason: $scope.form.reason.trim(),
                financial_action: $scope.form.financialAction
            };

            // Only include refund_amount if it differs from the default (total_paid)
            if ($scope.form.refundAmount != null &&
                $scope.preview && $scope.preview.financial &&
                $scope.form.refundAmount !== $scope.preview.financial.total_paid) {
                payload.refund_amount = parseFloat($scope.form.refundAmount);
            }

            CancelClaimService.CancelClaim(payload).then(function(data) {
                $scope.submitting = false;

                if (data.success) {
                    $scope.result = data;
                    $scope.step = 3;
                } else {
                    ToastService.error('Cancellation Failed', data.message || 'An error occurred while cancelling the claim.');
                }
            });
        };


        // ═══════════════════════════════════════════════
        // CANCELLATION HISTORY
        // ═══════════════════════════════════════════════
        $scope.loadHistory = function(page) {
            $scope.historyPage = page || 1;
            $scope.historyLoading = true;

            CancelClaimService.GetCancellationsByClub(clubId, $scope.historyPage, 20).then(function(data) {
                $scope.historyLoading = false;

                if (data.success) {
                    $scope.historyData = data.cancellations || [];
                    $scope.historyPagination = data.pagination || null;
                } else {
                    $scope.historyData = [];
                    ToastService.error('Error', data.message || 'Failed to load cancellation history.');
                }
            });
        };

        $scope.getFinancialActionLabel = function(action) {
            switch (action) {
                case 'credit_account': return 'Account Credit';
                case 'stripe_refund':  return 'Stripe Refund';
                case 'no_refund':      return 'No Refund';
                case 'not_paid':       return 'Not Paid';
                default:               return action;
            }
        };

        $scope.getFinancialActionClass = function(action) {
            switch (action) {
                case 'credit_account': return 'cc-history-badge--credit';
                case 'stripe_refund':  return 'cc-history-badge--stripe';
                default:               return 'cc-history-badge--none';
            }
        };
    }
