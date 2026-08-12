app.controller('MyVouchersController', MyVouchersController);

    MyVouchersController.$inject = ['VoucherService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$timeout', '$window', 'ToastService'];
    function MyVouchersController(VoucherService, $rootScope, $location, $scope, $state, $stateParams, $timeout, $window, ToastService) {

        var vm = this;

        // ── User ──
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        // ── View states ──
        // 'list'        — showing voucher cards
        // 'slot_search'  — searching for slots for a voucher
        vm.viewState = 'list';

        // ── Voucher lists (split by status) ──
        vm.unredeemedVouchers = [];   // not redeemed — ready to book
        vm.bookedVouchers = [];       // redeemed, has booking, not yet flown
        vm.completedVouchers = [];    // flight completed
        vm.loading = true;
        vm.errorMessage = '';

        // ── Active voucher (for slot search / booking detail) ──
        vm.activeVoucher = null;

        // ── Slot search state ──
        vm.dateFrom = null;
        vm.numDays = '14';   // string — matches the <option value="14"> model type
        vm.instructorId = 0;
        vm.currentPage = 1;
        vm.perPage = 8;

        vm.availableSlots = [];
        vm.groupedSlots = {};
        vm.groupedDates = [];
        vm.instructors = [];
        vm.slotsConfig = [];
        vm.pagination = {};
        vm.searchPerformed = false;
        vm.searching = false;
        vm.searchError = '';

        // Experience / planes info from slot search response
        vm.experience = null;
        vm.experiencePlanes = [];

        // ── Booking modal ──
        vm.selectedSlot = null;
        vm.selectedPlane = null;
        vm.selectedInstructor = null;
        vm.showBookingModal = false;
        vm.bookingInProgress = false;

        // ── Cancel state ──
        vm.cancelInProgress = false;

        // Debounce
        var searchTimer = null;


        // ─────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────

        function toDateStr(d) {
            var yyyy = d.getFullYear();
            var mm = ('0' + (d.getMonth() + 1)).slice(-2);
            var dd = ('0' + d.getDate()).slice(-2);
            return yyyy + '-' + mm + '-' + dd;
        }

        function tomorrowStr() {
            var d = new Date();
            d.setDate(d.getDate() + 1);
            return toDateStr(d);
        }


        // ─────────────────────────────────────
        // Init
        // ─────────────────────────────────────

        function init() {
            // Set default search start to tomorrow
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            vm.dateFrom = tomorrow;

            loadAllVouchers();
        }


        // ─────────────────────────────────────
        // Load all vouchers (single API call)
        // ─────────────────────────────────────

        function loadAllVouchers() {
            vm.loading = true;
            vm.errorMessage = '';
            vm.unredeemedVouchers = [];
            vm.bookedVouchers = [];
            vm.completedVouchers = [];

            VoucherService.GetMyVouchersAll()
                .then(function(data) {
                    if (data.success === false) {
                        vm.loading = false;
                        vm.errorMessage = data.message || 'Failed to load vouchers.';
                        return;
                    }

                    var allVouchers = data.vouchers || [];

                    // Split into 3 groups:
                    // 1. Completed flights (flight_completed = 1)
                    // 2. Booked / upcoming (redeemed with active booking, not yet flown)
                    // 3. Ready to book (unredeemed, no booking)
                    allVouchers.forEach(function(v) {
                        if (v.flight_completed) {
                            vm.completedVouchers.push(v);
                        } else if (v.booking) {
                            vm.bookedVouchers.push(v);
                        } else {
                            vm.unredeemedVouchers.push(v);
                        }
                    });

                    vm.loading = false;
                })
                .catch(function() {
                    vm.loading = false;
                    vm.errorMessage = 'Failed to load vouchers. Please try again.';
                });
        }

        vm.refreshVouchers = function() {
            vm.viewState = 'list';
            vm.activeVoucher = null;
            loadAllVouchers();
        };


        // ─────────────────────────────────────
        // Slot search
        // ─────────────────────────────────────

        vm.startSlotSearch = function(voucher) {
            vm.activeVoucher = voucher;
            vm.viewState = 'slot_search';
            vm.availableSlots = [];
            vm.groupedSlots = {};
            vm.groupedDates = [];
            vm.searchPerformed = false;
            vm.searchError = '';
            vm.currentPage = 1;
            vm.instructorId = 0;

            // Reset date to tomorrow
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            vm.dateFrom = tomorrow;

            vm.searchSlots();
        };

        vm.searchSlots = function() {
            if (!vm.activeVoucher) return;

            vm.searching = true;
            vm.searchError = '';
            vm.selectedSlot = null;
            vm.showBookingModal = false;
            vm.currentPage = 1;

            var params = {
                instructor_id: vm.instructorId || 0,
                page: vm.currentPage,
                per_page: vm.perPage
            };

            VoucherService.GetVoucherSlots(vm.activeVoucher.id, toDateStr(vm.dateFrom), vm.numDays, params)
                .then(function(data) {
                    vm.searching = false;

                    if (data.success === false) {
                        // Provide user-friendly message for qualification errors.
                        // handleError2 can put an OBJECT in message — stringify safely.
                        var msg = (typeof data.message === 'string' && data.message) || 'Search failed. Please try again.';
                        if (msg.toLowerCase().indexOf('no instructors are qualified') > -1) {
                            msg = 'No instructors are currently available for this experience. Please contact the club to arrange a booking.';
                        }
                        vm.searchError = msg;
                        vm.availableSlots = [];
                        vm.groupedSlots = {};
                        vm.groupedDates = [];
                        vm.searchPerformed = true;
                        return;
                    }

                    vm.availableSlots = data.available_slots || [];
                    vm.instructors = data.instructors || [];
                    vm.slotsConfig = data.slots_config || [];
                    vm.pagination = data.pagination || {};
                    vm.experience = data.experience || null;
                    vm.experiencePlanes = data.planes || [];
                    vm.searchPerformed = true;

                    groupSlotsByDate();
                })
                .catch(function() {
                    vm.searching = false;
                    vm.searchError = 'Search failed. Please try again.';
                    vm.searchPerformed = true;
                });
        };

        vm.loadMoreSlots = function() {
            if (!vm.pagination.has_more) return;

            vm.searching = true;
            var nextPage = vm.pagination.page + 1;

            var params = {
                instructor_id: vm.instructorId || 0,
                page: nextPage,
                per_page: vm.perPage
            };

            VoucherService.GetVoucherSlots(vm.activeVoucher.id, toDateStr(vm.dateFrom), vm.numDays, params)
                .then(function(data) {
                    vm.searching = false;

                    if (data.success === false) {
                        ToastService.error('Error', data.message || 'Failed to load more slots.');
                        return;
                    }

                    var newSlots = data.available_slots || [];
                    vm.availableSlots = vm.availableSlots.concat(newSlots);
                    vm.pagination = data.pagination || {};

                    groupSlotsByDate();
                })
                .catch(function() {
                    vm.searching = false;
                });
        };

        vm.debouncedSearch = function() {
            if (searchTimer) $timeout.cancel(searchTimer);
            searchTimer = $timeout(function() {
                vm.searchSlots();
            }, 400);
        };

        function groupSlotsByDate() {
            vm.groupedSlots = {};
            vm.groupedDates = [];

            vm.availableSlots.forEach(function(slot) {
                if (!vm.groupedSlots[slot.date]) {
                    vm.groupedSlots[slot.date] = {
                        date: slot.date,
                        day: slot.day,
                        slots: []
                    };
                    vm.groupedDates.push(slot.date);
                }
                vm.groupedSlots[slot.date].slots.push(slot);
            });
        }


        // ─────────────────────────────────────
        // Date navigation
        // ─────────────────────────────────────

        vm.goToNextWeek = function() {
            var d = new Date(vm.dateFrom);
            d.setDate(d.getDate() + 7);
            vm.dateFrom = d;
            vm.searchSlots();
        };

        vm.goToPrevWeek = function() {
            var d = new Date(vm.dateFrom);
            d.setDate(d.getDate() - 7);
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0,0,0,0);
            if (d < tomorrow) {
                vm.dateFrom = tomorrow;
            } else {
                vm.dateFrom = d;
            }
            vm.searchSlots();
        };

        vm.goToToday = function() {
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            vm.dateFrom = tomorrow;
            vm.searchSlots();
        };


        // ─────────────────────────────────────
        // Booking modal
        // ─────────────────────────────────────

        vm.selectSlot = function(slot) {
            // Auto-select first available aircraft and instructor (hidden from
            // user). Guard the arrays — a slot with neither can't be booked, so
            // don't open a confirm modal that would only dead-end.
            var plane = (slot.available_planes && slot.available_planes.length) ? slot.available_planes[0] : null;
            var instructor = (slot.available_instructors && slot.available_instructors.length) ? slot.available_instructors[0] : null;
            if (!plane || !instructor) {
                ToastService.warning('Slot Unavailable',
                    'That slot has just become unavailable — please pick another, or refresh the search.');
                return;
            }
            vm.selectedSlot = slot;
            vm.selectedPlane = plane;
            vm.selectedInstructor = instructor;
            vm.showBookingModal = true;
        };

        vm.closeBookingModal = function() {
            vm.showBookingModal = false;
            vm.selectedSlot = null;
            vm.selectedPlane = null;
            vm.selectedInstructor = null;
        };

        vm.confirmBooking = function() {
            if (!vm.selectedSlot || !vm.selectedPlane || !vm.selectedInstructor) {
                ToastService.error('Error', 'Please select a time slot.');
                vm.closeBookingModal();
                return;
            }

            vm.bookingInProgress = true;

            var bookingData = {
                voucher_id: vm.activeVoucher.id,
                plane_id: vm.selectedPlane.id,
                instructor_id: vm.selectedInstructor.id,
                start: vm.selectedSlot.slot_start,
                end: vm.selectedSlot.slot_end,
                experience_title: vm.activeVoucher.experience_title || ''
            };

            VoucherService.BookVoucher(bookingData)
                .then(function(data) {
                    vm.bookingInProgress = false;

                    if (data.success) {
                        ToastService.success('Booked!', 'Your voucher flight has been booked successfully!');
                        vm.closeBookingModal();
                        // Go back to voucher list and refresh
                        vm.refreshVouchers();
                    } else {
                        ToastService.error('Booking Failed', data.message || 'Something went wrong. Please try again.');
                    }
                })
                .catch(function() {
                    vm.bookingInProgress = false;
                    ToastService.error('Booking Failed', 'Something went wrong. Please try again.');
                });
        };


        // ─────────────────────────────────────
        // Cancel booking — inline confirm on the card (no native confirm())
        // ─────────────────────────────────────

        vm.askCancelBooking = function(voucher) {
            if (!voucher.can_cancel) {
                ToastService.warning('Cannot Cancel', voucher.cancel_message || 'This booking cannot be cancelled online.');
                return;
            }
            voucher._confirmCancel = true;
        };
        vm.dismissCancelBooking = function(voucher) {
            voucher._confirmCancel = false;
        };

        vm.cancelBooking = function(voucher) {
            if (!voucher.can_cancel) {
                ToastService.warning('Cannot Cancel', voucher.cancel_message || 'This booking cannot be cancelled online.');
                return;
            }

            vm.cancelInProgress = true;

            VoucherService.CancelVoucherBooking(voucher.id)
                .then(function(data) {
                    vm.cancelInProgress = false;

                    if (data.success) {
                        ToastService.success('Cancelled', data.message || 'Voucher booking cancelled. You can now book a new slot.');
                        vm.refreshVouchers();
                    } else {
                        ToastService.error('Cancel Failed', data.message || 'Something went wrong. Please try again.');
                    }
                })
                .catch(function() {
                    vm.cancelInProgress = false;
                    ToastService.error('Cancel Failed', 'Something went wrong. Please try again.');
                });
        };


        // ─────────────────────────────────────
        // Format helpers
        // ─────────────────────────────────────

        vm.formatDate = function(dateStr) {
            if (!dateStr) return '';
            var parts = dateStr.split('-');
            var d = new Date(parts[0], parts[1] - 1, parts[2]);
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
        };

        vm.formatDateTime = function(datetimeStr) {
            if (!datetimeStr) return '';
            // "2026-03-02 08:30:00" → "2 Mar 2026 at 08:30"
            var parts = datetimeStr.split(' ');
            var datePart = parts[0];
            var timePart = parts[1] || '';
            return vm.formatDate(datePart) + ' at ' + vm.formatTime(timePart);
        };

        vm.formatDay = function(day) {
            if (!day) return '';
            return day.charAt(0).toUpperCase() + day.slice(1);
        };

        vm.formatTime = function(timeStr) {
            if (!timeStr) return '';
            return timeStr.substring(0, 5);
        };

        vm.formatExpiryDate = function(dateStr) {
            if (!dateStr) return '';
            return vm.formatDate(dateStr);
        };

        // Defensive display-side expiry check — the backend re-validates on
        // booking; this just stops an expired card presenting a Book button.
        vm.isExpired = function(voucher) {
            if (!voucher || !voucher.expiry_date) return false;
            return voucher.expiry_date < toDateStr(new Date());
        };

        vm.isToday = function(dateStr) {
            return dateStr === toDateStr(new Date());
        };

        vm.isTomorrow = function(dateStr) {
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return dateStr === toDateStr(tomorrow);
        };

        vm.getDayLabel = function(dateStr) {
            if (vm.isToday(dateStr)) return 'Today';
            if (vm.isTomorrow(dateStr)) return 'Tomorrow';
            return '';
        };

        vm.formatFlightDuration = function(minutes) {
            if (!minutes) return '';
            if (minutes < 60) return minutes + ' min';
            var h = Math.floor(minutes / 60);
            var m = minutes % 60;
            return h + 'h ' + (m > 0 ? m + 'min' : '');
        };

        vm.goBack = function() {
            if (vm.viewState === 'slot_search') {
                vm.viewState = 'list';
                vm.activeVoucher = null;
                // Reload vouchers in case something changed
                loadAllVouchers();
            } else {
                // Navigate to my account dashboard instead of history.back()
                // to avoid going back to the login screen after a redirect
                $state.go('dashboard.my_account');
            }
        };


        // Kick off
        init();
    }
