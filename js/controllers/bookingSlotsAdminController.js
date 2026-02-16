app.controller('BookingSlotsAdminController', BookingSlotsAdminController);

    BookingSlotsAdminController.$inject = ['BookingSlotsService', 'ClubService', '$rootScope', '$scope', '$state', 'ToastService'];
    function BookingSlotsAdminController(BookingSlotsService, ClubService, $rootScope, $scope, $state, ToastService) {

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;

        vm.slots = [];
        vm.loading = true;
        vm.showForm = false;
        vm.editingSlot = null;

        // Form model
        vm.form = {
            start_time: '',
            end_time: '',
            label: '',
            slot_order: 0,
            active: true
        };

        // Max future bookings
        vm.max_future_bookings = 0;
        vm.settingsLoaded = false;

        // ── Init ──
        function init() {
            loadSlots();
            loadSettings();
        }

        function loadSlots() {
            vm.loading = true;
            BookingSlotsService.GetSlotsAdmin(vm.club_id)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.slots = data.slots || [];
                    } else {
                        vm.slots = [];
                    }
                });
        }

        function loadSettings() {
            ClubService.GetById(vm.club_id)
                .then(function(data) {
                    if (data) {
                        vm.max_future_bookings = parseInt(data.max_future_bookings) || 0;
                        vm.settingsLoaded = true;
                    }
                });
        }

        // ── Seed defaults ──
        vm.seedDefaults = function() {
            BookingSlotsService.SeedDefaults(vm.club_id)
                .then(function(data) {
                    if (data.success) {
                        ToastService.success('Success', 'Default slots created');
                        loadSlots();
                    } else {
                        ToastService.error('Info', data.message || 'Could not create defaults');
                    }
                });
        };

        // ── Open add form ──
        vm.openAddForm = function() {
            vm.editingSlot = null;
            vm.form = {
                start_time: '',
                end_time: '',
                label: '',
                slot_order: vm.slots.length + 1,
                active: true
            };
            vm.showForm = true;
        };

        // ── Open edit form ──
        vm.openEditForm = function(slot) {
            vm.editingSlot = slot;
            vm.form = {
                start_time: slot.start_time.substring(0, 5), // "08:30:00" → "08:30"
                end_time: slot.end_time.substring(0, 5),
                label: slot.label || '',
                slot_order: slot.slot_order || 0,
                active: slot.active == 1
            };
            vm.showForm = true;
        };

        // ── Close form ──
        vm.closeForm = function() {
            vm.showForm = false;
            vm.editingSlot = null;
        };

        // ── Save (create or update) ──
        vm.saveSlot = function() {
            if (!vm.form.start_time || !vm.form.end_time) {
                ToastService.error('Error', 'Start time and end time are required');
                return;
            }

            var data = {
                start_time: formatTimeValue(vm.form.start_time),
                end_time: formatTimeValue(vm.form.end_time),
                label: vm.form.label,
                slot_order: parseInt(vm.form.slot_order) || 0,
                active: vm.form.active ? 1 : 0
            };

            if (vm.editingSlot) {
                // Update
                BookingSlotsService.UpdateSlot(vm.editingSlot.id, data)
                    .then(function(res) {
                        if (res.success) {
                            ToastService.success('Updated', 'Slot updated successfully');
                            vm.closeForm();
                            loadSlots();
                        } else {
                            ToastService.error('Error', res.message || 'Update failed');
                        }
                    });
            } else {
                // Create
                data.club_id = vm.club_id;
                BookingSlotsService.CreateSlot(data)
                    .then(function(res) {
                        if (res.success) {
                            ToastService.success('Created', 'Slot created successfully');
                            vm.closeForm();
                            loadSlots();
                        } else {
                            ToastService.error('Error', res.message || 'Create failed');
                        }
                    });
            }
        };

        // ── Toggle active ──
        vm.toggleActive = function(slot) {
            var newActive = slot.active == 1 ? 0 : 1;
            BookingSlotsService.UpdateSlot(slot.id, { active: newActive })
                .then(function(res) {
                    if (res.success) {
                        slot.active = newActive;
                        ToastService.success('Updated', newActive ? 'Slot activated' : 'Slot deactivated');
                    }
                });
        };

        // ── Delete ──
        vm.deleteSlot = function(slot) {
            if (!confirm('Delete the "' + (slot.label || 'Unnamed') + '" slot? This cannot be undone.')) return;
            BookingSlotsService.DeleteSlot(slot.id)
                .then(function(res) {
                    if (res.success) {
                        ToastService.success('Deleted', 'Slot removed');
                        loadSlots();
                    } else {
                        ToastService.error('Error', res.message || 'Delete failed');
                    }
                });
        };

        // ── Save max future bookings ──
        vm.saveMaxFutureBookings = function() {
            var val = parseInt(vm.max_future_bookings) || 0;
            ClubService.Update({ id: vm.club_id, max_future_bookings: val })
                .then(function(res) {
                    ToastService.success('Saved', 'Max future bookings updated');
                });
        };

        // ── Format time for display ──
        vm.formatTime = function(timeStr) {
            if (!timeStr) return '';
            return timeStr.substring(0, 5);
        };

        // ── Normalise a time value (Date object or string) to "HH:mm:ss" ──
        function formatTimeValue(val) {
            if (!val) return '00:00:00';
            // If it's a Date object (from <input type="time">), extract hours/minutes
            if (val instanceof Date) {
                var h = ('0' + val.getHours()).slice(-2);
                var m = ('0' + val.getMinutes()).slice(-2);
                var s = ('0' + val.getSeconds()).slice(-2);
                return h + ':' + m + ':' + s;
            }
            // Already a string — ensure HH:mm:ss format
            var str = String(val);
            if (/^\d{2}:\d{2}$/.test(str)) return str + ':00';
            if (/^\d{2}:\d{2}:\d{2}$/.test(str)) return str;
            return str;
        }

        // ── Back ──
        vm.goBack = function() {
            $state.go('dashboard.manage_club');
        };

        init();
    }
