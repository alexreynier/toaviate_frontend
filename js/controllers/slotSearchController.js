app.controller('SlotSearchController', SlotSearchController);

    SlotSearchController.$inject = ['BookingSlotsService', 'BookingService', 'MemberService', 'CourseService', 'InstructorCharges', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$timeout', '$window', 'ToastService'];
    function SlotSearchController(BookingSlotsService, BookingService, MemberService, CourseService, InstructorCharges, $rootScope, $location, $scope, $state, $stateParams, $timeout, $window, ToastService) {
        
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;
        vm.club_id = 0;
        vm.member = null;
        vm.is_restricted = false;

        // Search state
        vm.dateFrom = new Date();
        vm.numDays = 14;
        vm.planeType = '';
        vm.instructorId = 0;
        vm.doubleSlot = false;
        vm.courseId = 0;
        vm.tuitionId = 0;

        // Results
        vm.availableSlots = [];
        vm.groupedSlots = {};
        vm.groupedDates = [];
        vm.planeTypes = [];
        vm.instructors = [];
        vm.slotsConfig = [];
        vm.courses = [];
        vm.tuitionTypes = [];
        vm.searchPerformed = false;
        vm.searching = false;
        vm.errorMessage = '';

        // Booking state
        vm.selectedSlot = null;
        vm.selectedPlane = null;
        vm.selectedInstructor = null;
        vm.showBookingModal = false;
        vm.bookingInProgress = false;

        // Clubs for selector
        vm.clubs = [];
        vm.selectedClub = null;
        vm.showClubSelector = false;

        // Debounce timer
        var searchTimer = null;

        // Helper: format a Date to YYYY-MM-DD string (local, no timezone shift)
        function toDateStr(d) {
            var yyyy = d.getFullYear();
            var mm = ('0' + (d.getMonth() + 1)).slice(-2);
            var dd = ('0' + d.getDate()).slice(-2);
            return yyyy + '-' + mm + '-' + dd;
        }

        // ── Initialise ──
        function init() {
            // Load clubs via MemberService (same pattern as bookings controllers)
            MemberService.GetUserClubs(vm.user.id)
                .then(function(data) {
                    vm.clubs = data.clubs || [];

                    if (vm.clubs.length > 1) {
                        vm.showClubSelector = true;
                    }

                    if (vm.clubs.length > 0) {
                        vm.selectedClub = vm.clubs[0];
                        vm.club_id = vm.clubs[0].id;

                        // Load member info for restriction check
                        loadMemberInfo();
                    }
                });
        }

        function loadMemberInfo() {
            MemberService.GetAllByClub(vm.club_id)
                .then(function(data) {
                    if (data.members) {
                        // Find this user's member record
                        for (var i = 0; i < data.members.length; i++) {
                            if (data.members[i].user_id == vm.user_id) {
                                vm.member = data.members[i];
                                break;
                            }
                        }
                    }
                    
                    if (vm.member) {
                        vm.is_restricted = (
                            vm.member.free_booking === 0 &&
                            vm.member.instructor === 0 &&
                            (vm.member.is_manager === 0 || vm.member.is_manager === '0')
                        );
                    }

                    // Load course & tuition dropdowns
                    loadCourseAndTuitionOptions();
                    
                    // Auto-search on load
                    vm.searchSlots();
                });
        }

        function loadCourseAndTuitionOptions() {
            CourseService.GetCoursesByClubId(vm.club_id)
                .then(function(data) {
                    vm.courses = (data && data.items) ? data.items : (Array.isArray(data) ? data : []);
                });
            InstructorCharges.GetByClubId(vm.club_id)
                .then(function(data) {
                    vm.tuitionTypes = (data && data.items) ? data.items : (Array.isArray(data) ? data : []);
                });
        }

        // ── Club change ──
        vm.onClubChange = function() {
            if (vm.selectedClub) {
                vm.club_id = vm.selectedClub.id;
                vm.availableSlots = [];
                vm.groupedSlots = {};
                vm.groupedDates = [];
                vm.searchPerformed = false;
                loadMemberInfo();
            }
        };

        // ── Search ──
        vm.searchSlots = function() {
            if (!vm.club_id) return;

            vm.searching = true;
            vm.errorMessage = '';
            vm.selectedSlot = null;
            vm.showBookingModal = false;

            var params = {
                plane_type: vm.planeType || null,
                instructor_id: vm.instructorId || 0,
                double_slot: vm.doubleSlot ? 1 : 0,
                user_id: vm.user_id,
                course_id: vm.courseId || 0,
                tuition_id: vm.tuitionId || 0
            };

            BookingSlotsService.SearchAvailableSlots(vm.club_id, toDateStr(vm.dateFrom), vm.numDays, params)
                .then(function(data) {
                    vm.searching = false;

                    if (!data.success) {
                        var msg = data.message || 'Search failed. Please try again.';
                        if (msg.toLowerCase().indexOf('no instructors are qualified') > -1) {
                            msg = 'No instructors are qualified for the selected course/tuition type. Please ask your club administrator to update instructor qualifications.';
                        }
                        vm.errorMessage = msg;
                        vm.availableSlots = [];
                        vm.groupedSlots = {};
                        vm.groupedDates = [];
                        vm.searchPerformed = true;
                        return;
                    }

                    vm.availableSlots = data.available_slots || [];
                    vm.planeTypes = data.plane_types || [];
                    vm.instructors = data.instructors || [];
                    vm.slotsConfig = data.slots_config || [];
                    vm.searchPerformed = true;

                    // Group by date
                    groupSlotsByDate();

                    // Populate dropdowns (preserve selections)
                    populateFilters();
                });
        };

        // ── Debounced search ──
        vm.debouncedSearch = function() {
            if (searchTimer) $timeout.cancel(searchTimer);
            searchTimer = $timeout(function() {
                vm.searchSlots();
            }, 400);
        };

        // ── Group slots by date ──
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

        function populateFilters() {
            // Filters are populated from response data via vm.planeTypes and vm.instructors
            // No DOM manipulation needed — AngularJS handles it
        }

        // ── Format helpers ──
        vm.formatDate = function(dateStr) {
            if (!dateStr) return '';
            var parts = dateStr.split('-');
            var d = new Date(parts[0], parts[1] - 1, parts[2]);
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
        };

        vm.formatDay = function(day) {
            if (!day) return '';
            return day.charAt(0).toUpperCase() + day.slice(1);
        };

        vm.formatTime = function(timeStr) {
            if (!timeStr) return '';
            return timeStr.substring(0, 5); // "08:30:00" → "08:30"
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

        // ── Select slot for booking ──
        vm.selectSlot = function(slot) {
            vm.selectedSlot = slot;
            vm.selectedPlane = slot.available_planes.length === 1 ? slot.available_planes[0] : null;
            vm.selectedInstructor = slot.available_instructors.length === 1 ? slot.available_instructors[0] : null;
            vm.showBookingModal = true;
        };

        vm.closeBookingModal = function() {
            vm.showBookingModal = false;
            vm.selectedSlot = null;
            vm.selectedPlane = null;
            vm.selectedInstructor = null;
        };

        // ── Check if selected instructor requires approval ──
        vm.selectedInstructorRequiresApproval = function() {
            if (!vm.selectedInstructor) return false;
            var mode = vm.selectedInstructor.booking_mode;
            return (mode === 'admin_approval' || mode === 'instructor_approval');
        };

        // ── Create booking ──
        vm.confirmBooking = function() {
            if (!vm.selectedSlot || !vm.selectedPlane) {
                ToastService.error('Error', 'Please select an aircraft.');
                return;
            }

            vm.bookingInProgress = true;

            var booking = {
                club_id: vm.club_id,
                user_id: vm.user_id,
                plane_id: vm.selectedPlane.id,
                instructor_id: vm.selectedInstructor ? vm.selectedInstructor.id : 0,
                start: vm.selectedSlot.slot_start,
                end: vm.selectedSlot.slot_end,
                booked_by: vm.user_id,
                override: 0
            };

            BookingService.Create(vm.user_id, booking)
                .then(function(data) {
                    vm.bookingInProgress = false;

                    if (data.success) {
                        // Check if the booking requires approval
                        if (data.requires_approval || data.booking_status === 'pending_admin' || data.booking_status === 'pending_instructor') {
                            var approverLabel = data.booking_status === 'pending_admin'
                                ? 'a club administrator'
                                : 'the instructor';
                            ToastService.success(
                                'Request Submitted',
                                'Your booking request has been submitted and is awaiting approval from ' + approverLabel + '. You\'ll receive an email once a decision is made.'
                            );
                        } else {
                            ToastService.success('Booked!', 'Your booking has been confirmed.');
                        }
                        vm.closeBookingModal();
                        // Refresh results
                        vm.searchSlots();
                    } else {
                        if (data.reason === 'max_future_bookings') {
                            vm.errorMessage = data.message;
                            vm.closeBookingModal();
                            ToastService.error('Limit Reached', data.message);
                        } else {
                            ToastService.error('Booking Failed', data.message || 'Something went wrong. Please try again.');
                        }
                    }
                });
        };

        // ── Navigate to calendar bookings ──
        vm.goToCalendar = function() {
            $state.go('dashboard.add_booking');
        };

        // ── Back ──
        vm.goBack = function() {
            $rootScope.safeBack();
        };

        // ── Date navigation helpers ──
        vm.goToNextWeek = function() {
            var d = new Date(vm.dateFrom);
            d.setDate(d.getDate() + 7);
            vm.dateFrom = d;
            vm.searchSlots();
        };

        vm.goToPrevWeek = function() {
            var d = new Date(vm.dateFrom);
            d.setDate(d.getDate() - 7);
            var today = new Date();
            today.setHours(0,0,0,0);
            if (d < today) {
                vm.dateFrom = today;
            } else {
                vm.dateFrom = d;
            }
            vm.searchSlots();
        };

        vm.goToToday = function() {
            vm.dateFrom = new Date();
            vm.searchSlots();
        };

        // Kick off
        init();
    }
