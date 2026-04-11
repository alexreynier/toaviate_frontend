    app.controller('BookingAuditTrailController', BookingAuditTrailController);

    BookingAuditTrailController.$inject = ['BookingAuditTrailService', 'ToastService', '$rootScope', '$scope', '$stateParams', '$state'];
    function BookingAuditTrailController(BookingAuditTrailService, ToastService, $rootScope, $scope, $stateParams, $state) {

        var vm = this;

        // ── State ──
        vm.user = $rootScope.globals.currentUser;
        vm.bookingId = $stateParams.booking_id ? parseInt($stateParams.booking_id) : null;
        vm.auditTrail = [];
        vm.loading = true;
        vm.error = false;
        vm.accessDenied = false;
        vm.bookingInfo = null; // populated from first audit entry
        vm.expandedEntryId = null;

        // ── Public methods ──
        vm.goBack = goBack;
        vm.loadAuditTrail = loadAuditTrail;
        vm.toggleExpand = toggleExpand;
        vm.getActionLabel = getActionLabel;
        vm.getActionBadgeClass = getActionBadgeClass;
        vm.getActionIcon = getActionIcon;
        vm.formatDate = formatDate;
        vm.formatTime = formatTime;
        vm.getChanges = getChanges;
        vm.friendlyFieldName = friendlyFieldName;

        // ── Init ──
        activate();

        // ────────────────────────────────────────────
        function activate() {
            if (!vm.bookingId) {
                vm.loading = false;
                vm.error = true;
                return;
            }

            // Permission check: determine if user can view this audit trail
            // The backend enforces this too, but we do a client-side check for UX
            loadAuditTrail();
        }

        function loadAuditTrail() {
            vm.loading = true;
            vm.error = false;
            vm.accessDenied = false;

            BookingAuditTrailService.GetBookingAuditTrail(vm.bookingId)
                .then(function(data) {
                    vm.loading = false;

                    if (!data.success) {
                        if (data.status === 403) {
                            vm.accessDenied = true;
                        } else {
                            vm.error = true;
                            ToastService.error(data.message || 'Failed to load audit trail');
                        }
                        return;
                    }

                    vm.auditTrail = data.audit_trail || [];

                    // Check permission client-side
                    if (!canViewAuditTrail()) {
                        vm.accessDenied = true;
                        vm.auditTrail = [];
                        return;
                    }

                    // Extract booking info from the most recent entry with snapshot data
                    extractBookingInfo();
                })
                .catch(function() {
                    vm.loading = false;
                    vm.error = true;
                    ToastService.error('Failed to load booking history. Please try again.');
                });
        }

        function canViewAuditTrail() {
            if (!vm.auditTrail || vm.auditTrail.length === 0) return true; // empty is fine, nothing to protect

            // Get club_id and booking user info from the audit data
            var entry = vm.auditTrail[0];
            var clubId = parseInt(entry.club_id);

            // Super-admin: always allowed
            if (vm.user.access.super_admin && vm.user.access.super_admin.indexOf(clubId) > -1) {
                return true;
            }

            // Manager/admin: allowed
            if (vm.user.access.manager && vm.user.access.manager.indexOf(clubId) > -1) {
                return true;
            }

            // Instructor for this club: allowed
            if (vm.user.access.instructor && vm.user.access.instructor.indexOf(clubId) > -1) {
                return true;
            }

            // Check if user is on the booking (check all snapshots for user fields)
            var userId = parseInt(vm.user.id);
            for (var i = 0; i < vm.auditTrail.length; i++) {
                var e = vm.auditTrail[i];
                if (parseInt(e.actor_user_id) === userId) return true;

                // Check snapshot_before fields
                if (e.snapshot_before) {
                    if (parseInt(e.snapshot_before.user_id) === userId) return true;
                    if (parseInt(e.snapshot_before.pic_id) === userId) return true;
                    if (parseInt(e.snapshot_before.put_id) === userId) return true;
                    if (parseInt(e.snapshot_before.payer_id) === userId) return true;
                }

                // Check snapshot_after fields
                if (e.snapshot_after) {
                    if (parseInt(e.snapshot_after.user_id) === userId) return true;
                    if (parseInt(e.snapshot_after.pic_id) === userId) return true;
                    if (parseInt(e.snapshot_after.put_id) === userId) return true;
                    if (parseInt(e.snapshot_after.payer_id) === userId) return true;
                }
            }

            // Not on booking and not admin/instructor → deny
            return false;
        }

        function extractBookingInfo() {
            if (!vm.auditTrail.length) return;

            // Find the latest snapshot_after or snapshot_before
            for (var i = 0; i < vm.auditTrail.length; i++) {
                var entry = vm.auditTrail[i];
                if (entry.snapshot_after) {
                    vm.bookingInfo = entry.snapshot_after;
                    break;
                }
                if (entry.snapshot_before) {
                    vm.bookingInfo = entry.snapshot_before;
                    break;
                }
            }
        }

        function goBack() {
            window.history.back();
        }

        function toggleExpand(entryId) {
            if (vm.expandedEntryId === entryId) {
                vm.expandedEntryId = null;
            } else {
                vm.expandedEntryId = entryId;
            }
        }

        function getActionLabel(action) {
            var labels = {
                'created': 'Created',
                'updated': 'Updated',
                'deleted': 'Deleted',
                'approved': 'Approved',
                'declined': 'Declined',
                'extended': 'Extended',
                'briefed': 'Briefed'
            };
            return labels[action] || action;
        }

        function getActionBadgeClass(action) {
            var classes = {
                'created': 'bat-badge--created',
                'updated': 'bat-badge--updated',
                'deleted': 'bat-badge--deleted',
                'approved': 'bat-badge--approved',
                'declined': 'bat-badge--declined',
                'extended': 'bat-badge--extended',
                'briefed': 'bat-badge--briefed'
            };
            return classes[action] || '';
        }

        function getActionIcon(action) {
            var icons = {
                'created': 'fa-plus-circle',
                'updated': 'fa-pencil-alt',
                'deleted': 'fa-trash-alt',
                'approved': 'fa-check-circle',
                'declined': 'fa-ban',
                'extended': 'fa-arrows-alt-h',
                'briefed': 'fa-clipboard-check'
            };
            return icons[action] || 'fa-info-circle';
        }

        function formatDate(dateString) {
            if (!dateString) return '';
            var d = new Date(dateString);
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
        }

        function formatTime(dateString) {
            if (!dateString) return '';
            var d = new Date(dateString);
            var h = d.getHours().toString();
            var m = d.getMinutes().toString();
            if (h.length < 2) h = '0' + h;
            if (m.length < 2) m = '0' + m;
            return h + ':' + m;
        }

        function getChanges(before, after) {
            if (!before || !after) return [];
            var changes = [];
            var allKeys = {};
            var key;
            for (key in before) { if (before.hasOwnProperty(key)) allKeys[key] = true; }
            for (key in after) { if (after.hasOwnProperty(key)) allKeys[key] = true; }

            for (key in allKeys) {
                if (!allKeys.hasOwnProperty(key)) continue;
                var oldVal = before[key];
                var newVal = after[key];
                if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                    changes.push({
                        field: key,
                        from: oldVal != null ? oldVal : '(empty)',
                        to: newVal != null ? newVal : '(empty)'
                    });
                }
            }
            return changes;
        }

        function friendlyFieldName(field) {
            var names = {
                'plane_id': 'Aircraft',
                'instructor_id': 'Instructor',
                'user_id': 'Pilot',
                'club_id': 'Club',
                'start': 'Start Time',
                'end': 'End Time',
                'description': 'Description',
                'free_seats': 'Free Seats',
                'waiting_list': 'Waiting List',
                'maintenance_flight': 'Maintenance Flight',
                'tuition_id': 'Tuition Type',
                'course_id': 'Course',
                'lesson_id': 'Lesson',
                'voucher_id': 'Voucher',
                'booking_approved': 'Approved',
                'booking_status': 'Status',
                'requires_approval': 'Requires Approval',
                'pic_id': 'PIC',
                'put_id': 'PUT',
                'payer_id': 'Payer'
            };
            return names[field] || field.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        }
    }
