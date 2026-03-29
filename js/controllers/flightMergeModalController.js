app.controller('FlightMergeModalController', FlightMergeModalController);

    FlightMergeModalController.$inject = ['$scope', '$uibModalInstance', 'FlightMergeService', 'ToastService', 'clubId'];
    function FlightMergeModalController($scope, $uibModalInstance, FlightMergeService, ToastService, clubId) {

        // ═══════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════

        $scope.step = 'candidates';   // candidates | preview | result | history
        $scope.clubId = clubId;

        // Candidates
        $scope.candidatesData = null;
        $scope.candidatesLoading = false;
        $scope.totalCandidates = 0;

        // Preview
        $scope.selectedCandidate = null;
        $scope.retainedSource = 'manual';
        $scope.previewData = null;
        $scope.previewLoading = false;

        // Apply
        $scope.mergeReason = '';
        $scope.financialAction = 'none';
        $scope.updateInvoice = true;
        $scope.applyLoading = false;
        $scope.applyResult = null;
        $scope.showConfirmDialog = false;

        // History
        $scope.historyData = null;
        $scope.historyPage = 1;
        $scope.historyLoading = false;
        $scope.selectedMergeDetail = null;
        $scope.mergeDetailLoading = false;

        // ═══════════════════════════════════════════════
        // INIT
        // ═══════════════════════════════════════════════

        loadCandidates();

        // ═══════════════════════════════════════════════
        // NAVIGATION
        // ═══════════════════════════════════════════════

        $scope.goToStep = function(step) {
            $scope.step = step;
            if (step === 'history' && !$scope.historyData) {
                $scope.loadHistory(1);
            }
        };

        $scope.close = function() {
            $uibModalInstance.close({ success: $scope.applyResult ? true : false, merged: !!$scope.applyResult });
        };

        $scope.dismiss = function() {
            $uibModalInstance.dismiss('cancel');
        };

        // ═══════════════════════════════════════════════
        // STEP 1 — CANDIDATES
        // ═══════════════════════════════════════════════

        function loadCandidates() {
            $scope.candidatesLoading = true;
            FlightMergeService.GetCandidatesByClub(clubId).then(function(data) {
                $scope.candidatesLoading = false;
                if (data.success) {
                    $scope.candidatesData = data;
                    $scope.totalCandidates = data.total_candidates || 0;
                } else {
                    $scope.candidatesData = null;
                    $scope.totalCandidates = 0;
                    ToastService.error('Error', data.message || 'Failed to load merge candidates.');
                }
            });
        }

        $scope.refreshCandidates = function() {
            loadCandidates();
        };

        $scope.getConfidenceClass = function(confidence) {
            switch (confidence) {
                case 'high':   return 'fm-badge--high';
                case 'medium': return 'fm-badge--medium';
                case 'low':    return 'fm-badge--low';
                default:       return '';
            }
        };

        $scope.getConfidenceIcon = function(confidence) {
            switch (confidence) {
                case 'high':   return '🟢';
                case 'medium': return '🟡';
                case 'low':    return '🟠';
                default:       return '';
            }
        };

        $scope.getConfidenceLabel = function(confidence) {
            switch (confidence) {
                case 'high':   return 'HIGH confidence — almost certainly the same flight';
                case 'medium': return 'MEDIUM confidence — likely the same flight';
                case 'low':    return 'LOW confidence — verify carefully';
                default:       return '';
            }
        };

        // ═══════════════════════════════════════════════
        // STEP 2 — PREVIEW
        // ═══════════════════════════════════════════════

        $scope.reviewCandidate = function(candidate) {
            $scope.selectedCandidate = candidate;
            $scope.retainedSource = 'manual';
            $scope.mergeReason = '';
            $scope.financialAction = 'none';
            $scope.updateInvoice = true;
            $scope.showConfirmDialog = false;
            $scope.step = 'preview';
            loadPreview();
        };

        $scope.toggleSource = function(source) {
            if ($scope.retainedSource === source) return;
            $scope.retainedSource = source;
            loadPreview();
        };

        function loadPreview() {
            if (!$scope.selectedCandidate) return;
            $scope.previewLoading = true;
            $scope.previewData = null;

            FlightMergeService.Preview({
                manual_pls_id: $scope.selectedCandidate.manual_pls.id,
                tracker_pls_id: $scope.selectedCandidate.tracker_pls.id,
                retained_source: $scope.retainedSource
            }).then(function(data) {
                $scope.previewLoading = false;
                if (data.success) {
                    $scope.previewData = data;
                } else {
                    $scope.previewData = null;
                    ToastService.error('Preview Error', data.message || 'Failed to load merge preview.');
                }
            });
        }

        $scope.getFieldDisplay = function(comparison, side) {
            if (side === 'manual') {
                return comparison.manual_display || comparison.manual_value || '—';
            }
            return comparison.tracker_display || comparison.tracker_value || '—';
        };

        $scope.isWinningValue = function(comparison, side) {
            if (!$scope.previewData) return false;
            var source = $scope.previewData.retained_source || $scope.retainedSource;
            // The winning side is the retained source, unless it's empty and the other has a value
            if (source === side) return true;
            // Gap-filling: if retained side is empty, the other side wins
            if (source === 'manual' && side === 'tracker') {
                var mv = comparison.manual_value;
                return (mv === null || mv === '' || mv === undefined);
            }
            if (source === 'tracker' && side === 'manual') {
                var tv = comparison.tracker_value;
                return (tv === null || tv === '' || tv === undefined);
            }
            return false;
        };

        // ═══════════════════════════════════════════════
        // STEP 3 — CONFIRM & APPLY
        // ═══════════════════════════════════════════════

        $scope.showConfirm = function() {
            $scope.showConfirmDialog = true;
        };

        $scope.cancelConfirm = function() {
            $scope.showConfirmDialog = false;
        };

        $scope.applyMerge = function() {
            if ($scope.applyLoading) return;
            $scope.applyLoading = true;
            $scope.showConfirmDialog = false;

            FlightMergeService.Apply({
                manual_pls_id: $scope.selectedCandidate.manual_pls.id,
                tracker_pls_id: $scope.selectedCandidate.tracker_pls.id,
                retained_source: $scope.retainedSource,
                merge_reason: $scope.mergeReason || null,
                financial_action: $scope.financialAction || 'none',
                update_invoice: $scope.updateInvoice || false
            }).then(function(data) {
                $scope.applyLoading = false;
                if (data.success) {
                    $scope.applyResult = data;
                    $scope.step = 'result';
                    // Refresh candidates in background
                    loadCandidates();
                } else {
                    ToastService.error('Merge Failed', data.message || 'Failed to apply merge.');
                }
            });
        };

        $scope.getActionLabel = function(action) {
            var labels = {
                'updated': 'Updated with merged values',
                'superseded': 'Marked as superseded (retired)',
                'linked_to_merge': 'Linked to merge record',
                'recalculated': 'Recalculated',
                'reassigned_to_surviving_pls': 'Booking reassigned to merged flight',
                'invoice_items_repointed': 'Invoice linked to merged flight',
                'invoice_updated': 'Invoice amounts recalculated'
            };
            return labels[action] || action;
        };

        $scope.getEntityIcon = function(type) {
            var icons = {
                'plane_log_sheet': 'fa-file-text-o',
                'booking': 'fa-calendar',
                'fox_entry': 'fa-wifi',
                'invoice': 'fa-file-text',
                'logbook': 'fa-book'
            };
            return icons[type] || 'fa-circle-o';
        };

        // ═══════════════════════════════════════════════
        // HISTORY
        // ═══════════════════════════════════════════════

        $scope.loadHistory = function(page) {
            $scope.historyPage = page || 1;
            $scope.historyLoading = true;

            FlightMergeService.GetHistory(clubId, $scope.historyPage, 20).then(function(data) {
                $scope.historyLoading = false;
                if (data.success) {
                    $scope.historyData = data;
                } else {
                    $scope.historyData = null;
                    ToastService.error('Error', data.message || 'Failed to load merge history.');
                }
            });
        };

        $scope.viewMergeDetail = function(mergeEntry) {
            $scope.mergeDetailLoading = true;
            $scope.selectedMergeDetail = null;

            FlightMergeService.GetDetail(mergeEntry.id).then(function(data) {
                $scope.mergeDetailLoading = false;
                if (data.success) {
                    $scope.selectedMergeDetail = data;
                } else {
                    ToastService.error('Error', data.message || 'Failed to load merge detail.');
                }
            });
        };

        $scope.closeMergeDetail = function() {
            $scope.selectedMergeDetail = null;
        };

        $scope.formatCurrency = function(amount, currency) {
            if (amount === null || amount === undefined) return '—';
            var symbols = { 'GBP': '£', 'USD': '$', 'EUR': '€' };
            var sym = symbols[currency] || currency + ' ';
            return sym + parseFloat(amount).toFixed(2);
        };

        $scope.formatDifference = function(impact) {
            if (!impact || !impact.has_impact) return '';
            var diff = parseFloat(impact.difference);
            var prefix = diff > 0 ? '+' : '';
            return prefix + $scope.formatCurrency(diff, impact.currency);
        };

        // ═══════════════════════════════════════════════
        // ERROR MAPPING
        // ═══════════════════════════════════════════════

        $scope.getUserMessage = function(serverMsg) {
            var map = {
                'Unauthorised. Club admin access required.': 'You must be a club manager to merge flights.',
                'Plane not found.': 'The aircraft was not found. It may have been removed.',
                'Manual PLS not found.': 'One of the flight records was not found. It may have already been merged.',
                'Tracker PLS not found.': 'One of the flight records was not found. It may have already been merged.',
                'Both PLS records must be for the same aircraft.': 'These records are for different aircraft and cannot be merged.',
                'One or both records have already been merged.': 'These records have already been merged. Refresh the candidates list.',
                "retained_source must be 'manual' or 'tracker'.": 'Invalid selection. Please choose Manual or Tracker.'
            };
            return map[serverMsg] || serverMsg || 'An unexpected error occurred.';
        };
    }
