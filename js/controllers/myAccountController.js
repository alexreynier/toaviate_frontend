 app.controller('MyAccountController', MyAccountController);

    MyAccountController.$inject = ['UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$timeout', 'uiCalendarConfig', 'BookingService', 'VoucherService', 'BookoutService', 'ToastService', 'CourseAssignmentService', 'PaymentModeService', 'PaymentService', 'CourseService', 'ExamSalesService', 'CaaFormsService'];
    function MyAccountController(UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $timeout, uiCalendarConfig, BookingService, VoucherService, BookoutService, ToastService, CourseAssignmentService, PaymentModeService, PaymentService, CourseService, ExamSalesService, CaaFormsService) {

        var vm = this;


        vm.user = $rootScope.globals.currentUser;

        // Outstanding "assigned to me" count for the dashboard tile badge.
        vm.assignedCount = 0;
        CourseAssignmentService.MineCount().then(function(data) {
            vm.assignedCount = (data && typeof data.count === 'number') ? data.count : 0;
        });

        // ── TRAINING tile ──
        // A live club role (pilot / instructor / manager membership — the
        // access arrays only hold live memberships) opens the full hub at the
        // Syllabus. Read live, so Rehydrate() updating access re-gates it.
        vm.hasClubRole = function() {
            var a = vm.user && vm.user.access;
            return !!(a && ((a.pilot && a.pilot.length) || (a.instructor && a.instructor.length) || (a.manager && a.manager.length)));
        };

        // A student with NO live membership (lapsed, or left the club) keeps
        // read access to their own training records and exam results
        // (BACKEND_CLUB_CONTENT_ACCESS_GUIDE.md §5), so they get the tile too —
        // straight to Training Records (or My Exams if exams are all they
        // have): the syllabus is for current members. Probed only when the
        // role gate is false, so members pay nothing; at most three cheap GETs
        // on the caller's own id, the same ones those pages make anyway. CAA
        // forms about them (a club they left included) open My Account → CAA
        // Forms read-only (FRONTEND_CAA_FORMS_GUIDE.md "Former members").
        vm.pastTraining = null;   // { state } once something of theirs is found
        if (!vm.hasClubRole() && vm.user && vm.user.id) {
            probePastTraining();
        }

        function probePastTraining() {
            CourseService.GetCoursesByUserId(vm.user.id).then(function(data) {
                var clubs = (data && data.success !== false && angular.isArray(data.items)) ? data.items : [];
                // has_records = a live training_records / exam_records row of theirs on the course
                var hasRecords = clubs.some(function(club) {
                    return (club.courses || []).some(function(c) { return Number(c.has_records) === 1; });
                });
                if (hasRecords) {
                    vm.pastTraining = { state: 'dashboard.my_account.training_records' };
                    return;
                }
                // exams = ground exams a club sold them (any status), a club they left included
                ExamSalesService.GetUserClubs(vm.user.id).then(function(res) {
                    var exClubs = (res && res.success === true && angular.isArray(res.items)) ? res.items : [];
                    var hasExams = exClubs.some(function(c) { return Number(c.exams) > 0; });
                    if (hasExams) {
                        vm.pastTraining = { state: 'dashboard.my_account.my_exams' };
                        return;
                    }
                    // CAA forms about them (caa_forms/mine): read-only in a club they left
                    CaaFormsService.Mine().then(function(caa) {
                        if (caa && caa.success === true && angular.isArray(caa.forms) && caa.forms.length) {
                            vm.pastTraining = { state: 'dashboard.my_account.caa_forms' };
                        }
                    });
                });
            });
        }

        vm.openPastTraining = function() {
            if (vm.pastTraining) { $state.go(vm.pastTraining.state); }
        };
        //console.log("USER HERE IS : ", vm.user);

        // Bookings / bookouts / to-pay data for the dashboard home view
        vm.bookings = [];
        vm.bookouts = [];
        vm.to_pay = [];
        vm.to_complete_split = [];

        vm.force_show_admins = false;
        if (vm.user && vm.user.access && vm.user.access.manager) {
            vm.force_show_admins = true;
        } else if (vm.user && vm.user.access && vm.user.access.instructor) {
            vm.force_show_admins = true;
        }

        load_bookings();

        // ── Payment-mode-switch banner ──────────────────────────────────────────
        // If a club the member belongs to recently switched payment mode AND the
        // member has no payment method set up in the new mode, prompt them to re-add
        // their details (their old card/mandate vanished with the switch).
        vm.payment_switch_banner = null;   // { club_id, club_name, mode, target_mode, switched_at }

        var PM_SWITCH_RECENT_DAYS = 30;

        load_payment_switch_banner();

        function load_payment_switch_banner() {
            MemberService.GetUserMemberships(vm.user.id).then(function(data) {
                if (!data || !data.success || !data.memberships) { return; }
                // Evaluate each club the member belongs to; first match wins.
                data.memberships.forEach(function(m) {
                    if (vm.payment_switch_banner || !m.club_id) { return; }
                    evaluate_club_switch(m);
                });
            });
        }

        function evaluate_club_switch(membership) {
            PaymentModeService.GetStatus(membership.club_id).then(function(status) {
                if (vm.payment_switch_banner) { return; }
                if (!status || !status.success || !status.payment_mode_switched_at) { return; }

                // Only banner if the switch was recent.
                var switched = moment(status.payment_mode_switched_at);
                if (!switched.isValid()) { return; }
                if (moment().diff(switched, 'days') > PM_SWITCH_RECENT_DAYS) { return; }

                // Skip if already dismissed for this exact switch event.
                if (banner_dismissed(membership.club_id, status.payment_mode_switched_at)) { return; }

                // Direct debit known from the membership row (has_direct_debit — the mandate itself
                // never leaves the server); cards need a lookup.
                var has_dd = !!membership.has_direct_debit;
                if (has_dd) { return; }

                PaymentService.GetMemberCards({ user_id: vm.user.id, club_id: membership.club_id })
                    .then(function(cardData) {
                        var has_card = !!(cardData && cardData.cards && cardData.cards.length > 0);
                        if (has_card || vm.payment_switch_banner) { return; }

                        vm.payment_switch_banner = {
                            club_id: membership.club_id,
                            club_name: membership.club_name || 'your club',
                            mode: status.payment_mode,
                            target_mode: status.payment_mode,   // current mode after the switch
                            switched_at: status.payment_mode_switched_at,
                            is_live: status.payment_mode === 'live'
                        };
                    });
            });
        }

        function banner_key(club_id, switched_at) {
            return 'pm_banner_dismissed_' + vm.user.id + '_' + club_id + '_' + switched_at;
        }

        function banner_dismissed(club_id, switched_at) {
            try { return window.localStorage.getItem(banner_key(club_id, switched_at)) === '1'; }
            catch (e) { return false; }
        }

        vm.dismiss_payment_switch_banner = function() {
            if (!vm.payment_switch_banner) { return; }
            // Persist dismissal per member+switch event so it doesn't nag — but it will
            // re-show on a new switch event (different switched_at), and the member is only
            // shown it while they still have no payment method anyway.
            try {
                window.localStorage.setItem(
                    banner_key(vm.payment_switch_banner.club_id, vm.payment_switch_banner.switched_at), '1');
            } catch (e) { /* ignore */ }
            vm.payment_switch_banner = null;
        };

        function load_bookings() {
            BookingService.GetTodayBookingsUser(vm.user.id)
                .then(function(data) {
                    vm.bookings = data.bookings;
                    vm.to_pay = data.to_pay;
                    vm.to_complete_split = data.to_complete_split;
                });

            BookoutService.GetBookoutsToComplete(vm.user.id)
                .then(function(data) {
                    vm.bookouts = data.bookouts;
                });
        }

        vm.cancel_bookout = function(id) {
            var a = confirm("Are you sure you wish to cancel the bookout?");
            if (a) {
                BookoutService.CancelBookout(id)
                    .then(function(data) {
                        if (data.success) {
                            load_bookings();
                        } else {
                            ToastService.error('Error', data.message);
                        }
                    });
            }
        };

        vm.cancel_booking = function(id) {
            var a = confirm("Are you sure you wish to cancel the booking?");
            if (a) {
                BookoutService.DeleteBooking(vm.user.id, id)
                    .then(function(data) {
                        if (data.success) {
                            load_bookings();
                        } else {
                            ToastService.error('Error', data.message);
                        }
                    });
            }
        };

        // Check if user has any vouchers (single lightweight call). A failed
        // probe used to hide the MY VOUCHERS tile permanently for that visit —
        // retry once after a short pause so a transient blip doesn't hide a
        // real voucher.
        vm.hasVouchers = false;

        probeVouchers(true);

        function probeVouchers(retry) {
            VoucherService.HasVouchers()
                .then(function(data) {
                    if (data && data.success && data.has_vouchers) {
                        vm.hasVouchers = true;
                    } else if (retry && (!data || data.success === false)) {
                        $timeout(function() { probeVouchers(false); }, 3000);
                    }
                })
                .catch(function() {
                    if (retry) { $timeout(function() { probeVouchers(false); }, 3000); }
                });
        }


    }