    app.controller('UpcomingBookingsController', UpcomingBookingsController);

    UpcomingBookingsController.$inject = ['BookingService', 'ToastService', '$rootScope', '$scope', '$state', '$timeout'];
    function UpcomingBookingsController(BookingService, ToastService, $rootScope, $scope, $state, $timeout) {

        var vm = this;

        // ── State ──
        vm.user = $rootScope.globals.currentUser;
        vm.bookings = [];
        vm.filteredBookings = [];
        vm.groupedBookings = [];
        vm.clubs = [];          // unique clubs from results
        vm.selectedClubId = ''; // '' = all clubs
        vm.searchText = '';
        vm.loading = true;
        vm.loadingMore = false;
        vm.showDetail = false;
        vm.selectedBooking = null;
        vm.nextBooking = null;
        vm.clubCount = 0;

        vm.pagination = {
            page: 1,
            per_page: 20,
            total: 0,
            total_pages: 0,
            has_more: false
        };

        // ── Public methods ──
        vm.loadMore = loadMore;
        vm.filterByClub = filterByClub;
        vm.filterBookings = filterBookings;
        vm.viewBooking = viewBooking;
        vm.viewOnScheduler = viewOnScheduler;
        vm.closeDetail = closeDetail;

        // ── Init ──
        activate();

        // ────────────────────────────────────────────
        function activate() {
            loadBookings(false);
        }

        function loadBookings(append) {
            if (append) {
                vm.loadingMore = true;
            } else {
                vm.loading = true;
            }

            var clubId = vm.selectedClubId ? parseInt(vm.selectedClubId) : null;

            BookingService.GetUpcoming(vm.user.id, vm.pagination.page, vm.pagination.per_page, clubId)
                .then(function(data) {
                    vm.loading = false;
                    vm.loadingMore = false;

                    if (!data.success) {
                        ToastService.error(data.message || 'Failed to load bookings');
                        return;
                    }

                    if (append) {
                        vm.bookings = vm.bookings.concat(data.bookings);
                    } else {
                        vm.bookings = data.bookings || [];
                    }

                    vm.pagination = data.pagination || vm.pagination;

                    // Derive clubs list from all loaded bookings
                    buildClubsList();

                    // Set summary info
                    if (vm.bookings.length > 0) {
                        vm.nextBooking = vm.bookings[0];
                    }

                    // Apply search filter
                    filterBookings();
                })
                .catch(function() {
                    vm.loading = false;
                    vm.loadingMore = false;
                    ToastService.error('Failed to load bookings. Please try again.');
                });
        }

        function loadMore() {
            if (vm.loadingMore || !vm.pagination.has_more) return;
            vm.pagination.page++;
            loadBookings(true);
        }

        function filterByClub() {
            vm.bookings = [];
            vm.pagination.page = 1;
            loadBookings(false);
        }

        function filterBookings() {
            var search = (vm.searchText || '').toLowerCase();

            if (!search) {
                vm.filteredBookings = vm.bookings;
            } else {
                vm.filteredBookings = vm.bookings.filter(function(b) {
                    return (
                        (b.plane_registration && b.plane_registration.toLowerCase().indexOf(search) !== -1) ||
                        (b.plane_type && b.plane_type.toLowerCase().indexOf(search) !== -1) ||
                        (b.instructor_name && b.instructor_name.toLowerCase().indexOf(search) !== -1) ||
                        (b.student_name && b.student_name.toLowerCase().indexOf(search) !== -1) ||
                        (b.club_name && b.club_name.toLowerCase().indexOf(search) !== -1) ||
                        (b.description && b.description.toLowerCase().indexOf(search) !== -1)
                    );
                });
            }

            groupByDate();
        }

        function groupByDate() {
            var groups = {};
            var order = [];

            vm.filteredBookings.forEach(function(b) {
                if (!groups[b.date]) {
                    groups[b.date] = {
                        date: b.date,
                        day: b.day,
                        dateFormatted: formatDateNice(b.date),
                        bookings: []
                    };
                    order.push(b.date);
                }
                groups[b.date].bookings.push(b);
            });

            vm.groupedBookings = order.map(function(d) { return groups[d]; });
        }

        function buildClubsList() {
            var seen = {};
            var clubs = [];
            vm.bookings.forEach(function(b) {
                if (b.club_id && !seen[b.club_id]) {
                    seen[b.club_id] = true;
                    clubs.push({ id: b.club_id, name: b.club_name });
                }
            });
            // Only update clubs list if we got new clubs (don't lose clubs on filter)
            if (clubs.length > 0) {
                vm.clubs = clubs;
            }
            vm.clubCount = vm.clubs.length;
        }

        function viewBooking(booking) {
            vm.selectedBooking = booking;
            vm.showDetail = true;
        }

        function closeDetail() {
            vm.showDetail = false;
            vm.selectedBooking = null;
        }

        function viewOnScheduler(booking) {
            // Navigate to the scheduler/edit booking route
            $state.go('dashboard.edit_booking', { booking_id: booking.id });
        }

        function formatDateNice(dateStr) {
            // dateStr is YYYY-MM-DD
            if (!dateStr) return '';
            var parts = dateStr.split('-');
            var d = new Date(parts[0], parts[1] - 1, parts[2]);
            var months = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (d.getTime() === today.getTime()) {
                return 'Today, ' + d.getDate() + ' ' + months[d.getMonth()];
            } else if (d.getTime() === tomorrow.getTime()) {
                return 'Tomorrow, ' + d.getDate() + ' ' + months[d.getMonth()];
            }
            return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
        }

    }
