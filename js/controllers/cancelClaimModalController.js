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

        // Split-flight recombine (BACKEND_CANCEL_CLAIM_SPLIT_GUIDE.md) — all null/empty for an ordinary flight
        $scope.split = null;                 // preview.split
        $scope.splitLegs = [];               // [{ key:'leg1', label:'Leg 1', data:{…} }, …] for the leg cards
        $scope.blockers = [];                // split.blockers from the preview, or blockers from a BLOCKED execute
        $scope.ackRequiredByServer = false;  // execute answered OTHER_LEG_ACKNOWLEDGEMENT_REQUIRED

        // Confirm form
        $scope.form = {
            reason: '',
            financialAction: 'no_refund',
            refundAmount: null,
            acknowledgeOtherLeg: false       // → acknowledge_other_leg: 1
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

                    applySplit(data);

                    // Set default refund amount to total paid (combined across both legs for a split pair)
                    var paidTotal = $scope.getPaidTotal();
                    if (paidTotal > 0) {
                        $scope.form.refundAmount = paidTotal;
                    }

                    // Set default financial action based on available_actions
                    var actions = $scope.getAvailableActions();
                    if (actions.length > 0) {
                        if (actions.indexOf('stripe_refund') > -1) {
                            $scope.form.financialAction = 'stripe_refund';
                        } else if (actions.indexOf('credit_account') > -1) {
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


        // Read preview.split (absent/null for an ordinary flight → nothing changes)
        function applySplit(data) {
            var split = data.split || null;
            $scope.split = split;
            $scope.splitLegs = [];
            $scope.blockers = [];
            $scope.ackRequiredByServer = false;
            $scope.form.acknowledgeOtherLeg = false;
            if (!split) return;

            $scope.splitLegs = [
                { key: 'leg1', label: 'Leg 1', data: split.leg1 || {} },
                { key: 'leg2', label: 'Leg 2', data: split.leg2 || {} }
            ];
            $scope.blockers = angular.isArray(split.blockers) ? split.blockers.slice() : [];

            // Merge split.warnings into the existing warnings list. The split block uses
            // info|warning|danger; the existing card styles info|high|critical.
            if (angular.isArray(split.warnings) && split.warnings.length) {
                if (!angular.isArray(data.warnings)) data.warnings = [];
                angular.forEach(split.warnings, function(w) {
                    if (!w) return;
                    data.warnings.push({
                        level: normaliseWarningLevel(w.level),
                        message: w.message
                    });
                });
            }
        }

        function normaliseWarningLevel(level) {
            switch (level) {
                case 'danger':   return 'critical';
                case 'warning':  return 'high';
                case 'critical':
                case 'high':
                case 'info':     return level;
                default:         return 'info';
            }
        }


        // ═══════════════════════════════════════════════
        // SPLIT-FLIGHT HELPERS
        // ═══════════════════════════════════════════════
        $scope.isOn = function(v) {
            return v === true || v == 1;
        };

        $scope.getLegNumber = function() {
            return ($scope.split && $scope.split.role === 'leg2') ? 2 : 1;
        };

        $scope.getLegClaimant = function(leg) {
            if (!leg || !leg.claiming_user) return '';
            return ((leg.claiming_user.first_name || '') + ' ' + (leg.claiming_user.last_name || '')).trim();
        };

        $scope.getLegBookedState = function(leg) {
            if (!leg) return '';
            if ($scope.isOn(leg.booked_in)) return 'Booked in';
            if ($scope.isOn(leg.booked_out)) return 'Booked out — not yet booked in';
            return 'Not booked out';
        };

        $scope.getLegPaid = function(leg) {
            if (!leg || !leg.financial || leg.financial.total_paid == null) return 0;
            var n = parseFloat(leg.financial.total_paid);
            return isNaN(n) ? 0 : n;
        };

        $scope.getLegStripeRefundable = function(leg) {
            if (!leg || !leg.financial || !leg.financial.has_stripe_payment) return 0;
            var n = parseFloat(leg.financial.stripe_refundable_amount);
            return isNaN(n) ? 0 : n;
        };

        $scope.getOtherLeg = function() {
            if (!$scope.split) return null;
            return $scope.split.role === 'leg2' ? $scope.split.leg1 : $scope.split.leg2;
        };

        $scope.getOtherLegName = function() {
            return $scope.getLegClaimant($scope.getOtherLeg()) || 'the other member';
        };

        $scope.getRecombinedLandings = function() {
            var rp = $scope.split && $scope.split.recombined_preview;
            if (!rp || rp.landings == null) return null;
            var n = parseInt(rp.landings, 10);
            return isNaN(n) ? null : n;
        };

        // Paid total the financial action applies to: both legs combined for a split pair
        $scope.getPaidTotal = function() {
            if ($scope.split) {
                return $scope.getLegPaid($scope.split.leg1) + $scope.getLegPaid($scope.split.leg2);
            }
            if (!$scope.preview || !$scope.preview.financial || $scope.preview.financial.total_paid == null) return 0;
            var n = parseFloat($scope.preview.financial.total_paid);
            return isNaN(n) ? 0 : n;
        };

        $scope.getStripeRefundable = function() {
            if ($scope.split) {
                return $scope.getLegStripeRefundable($scope.split.leg1) + $scope.getLegStripeRefundable($scope.split.leg2);
            }
            if (!$scope.preview || !$scope.preview.financial) return 0;
            var n = parseFloat($scope.preview.financial.stripe_refundable_amount);
            return isNaN(n) ? 0 : n;
        };

        $scope.getAvailableActions = function() {
            if ($scope.split && angular.isArray($scope.split.available_actions) && $scope.split.available_actions.length) {
                return $scope.split.available_actions;
            }
            if ($scope.preview && angular.isArray($scope.preview.available_actions)) {
                return $scope.preview.available_actions;
            }
            return [];
        };

        $scope.needsAcknowledgement = function() {
            return $scope.ackRequiredByServer ||
                   !!($scope.split && $scope.split.other_leg_claimed_by_other_user);
        };

        $scope.isBlocked = function() {
            return $scope.blockers.length > 0;
        };

        $scope.getBlockerLabel = function(code) {
            switch (code) {
                case 'other_leg_already_superseded':
                    return 'The other leg has already been merged away — nothing to recombine.';
                case 'tpc_import_pair':
                    return 'Both legs came from the training-records import — use that import\'s revert instead.';
                default:
                    return code;
            }
        };

        // Gates: Continue (preview) and Cancel Claim (confirm)
        $scope.canProceed = function() {
            if ($scope.isBlocked()) return false;
            if ($scope.needsAcknowledgement() && !$scope.form.acknowledgeOtherLeg) return false;
            return true;
        };


        // ═══════════════════════════════════════════════
        // NAVIGATION
        // ═══════════════════════════════════════════════
        $scope.goToConfirm = function() {
            if (!$scope.canProceed()) return;
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
            return $scope.getAvailableActions().indexOf(action) > -1;
        };

        $scope.hasOnlyNoRefund = function() {
            var actions = $scope.getAvailableActions();
            if (!actions.length) return true;
            return actions.length === 1 && actions[0] === 'no_refund';
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
                case 'critical':
                case 'danger':   return 'fa-exclamation';
                case 'high':
                case 'warning':  return 'fa-exclamation-triangle';
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
                var maxAmount = $scope.getPaidTotal();
                if ($scope.form.refundAmount > maxAmount) {
                    $scope.formErrors.refundAmount = 'Cannot exceed ' + $scope.formatCurrency(maxAmount);
                    valid = false;
                }
                if ($scope.form.refundAmount < 0) {
                    $scope.formErrors.refundAmount = 'Amount cannot be negative.';
                    valid = false;
                }
            }

            if ($scope.needsAcknowledgement() && !$scope.form.acknowledgeOtherLeg) {
                $scope.formErrors.acknowledge = 'Please confirm you understand the other leg\'s claim is released too.';
                valid = false;
            }

            return valid;
        };

        $scope.confirmCancellation = function() {
            if ($scope.isBlocked()) return;
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

            // Only include refund_amount if it differs from the default (total_paid, combined for a split pair)
            if ($scope.form.refundAmount != null &&
                $scope.preview && $scope.preview.financial &&
                parseFloat($scope.form.refundAmount) !== $scope.getPaidTotal()) {
                payload.refund_amount = parseFloat($scope.form.refundAmount);
            }

            // Split pair: releasing another member's leg must be a conscious act
            if ($scope.form.acknowledgeOtherLeg) {
                payload.acknowledge_other_leg = 1;
            }

            CancelClaimService.CancelClaim(payload).then(function(data) {
                $scope.submitting = false;

                if (data.success) {
                    if (data.split) { data.split.warnings = normaliseSplitWarnings(data.split.warnings); }
                    $scope.result = data;
                    $scope.step = 3;
                } else if (data.error === 'OTHER_LEG_ACKNOWLEDGEMENT_REQUIRED') {
                    $scope.ackRequiredByServer = true;
                    $scope.form.acknowledgeOtherLeg = false;
                    $scope.formErrors.acknowledge = 'The other leg of this split flight is claimed by ' + $scope.getOtherLegName() +
                        '. Tick the box to confirm their claim is released too, then try again.';
                    ToastService.warning('Acknowledgement Required', 'Confirm the other leg\'s claim is released too.');
                } else if (data.error === 'BLOCKED') {
                    $scope.blockers = angular.isArray(data.blockers) && data.blockers.length ? data.blockers : ['BLOCKED'];
                    ToastService.error('Cannot Recombine', 'This split flight cannot be recombined — see the reasons listed.');
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
    
        // Execute-response split.warnings are plain strings (BACKEND_CANCEL_CLAIM_SPLIT_GUIDE.md §3);
        // the preview's split.warnings are {level, message}. Accept both everywhere.
        function normaliseSplitWarnings(list) {
            return (angular.isArray(list) ? list : []).map(function (w) {
                return (w && typeof w === 'object') ? w : { level: 'info', message: String(w) };
            });
        }
}
