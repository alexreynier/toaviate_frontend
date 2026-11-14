/* ═══════════════════════════════════════════════════════════════════════════
   v2 BOOK IN + FINISH & PAY — the approved design (mockups/my-account/book-in.html), built 8 Nov 2026 beside v1.
   v1 = dashboard.my_account.book_in (views/my_account/booking_in_form.html + js/controllers/bookinController.js) and
   dashboard.my_account.finish_and_pay (FinishAndPayController); both stay untouched. This file holds:
     • the states dashboard.v2.book_in / dashboard.v2.finish_and_pay (same :id param) + DesignRoutes.map;
     • BookinV2Controller — a COPY of BookinController (so the cut-over can delete v1) with the edits listed in
       mockups/v2-build/fe-bookin.md ("Fixed in v2"), plus the v2 view model at its end (vm.bk*, vm.quote);
     • FinishAndPayV2Controller — a copy of FinishAndPayController + its v2 view model (vm.fp*);
     • BookinV2Payment — the pay choice (the payment accordion's calls, the mockup's look).
   Money: every figure on the book-in comes from ONE function, computeQuote(inputs) (today v1's maths in the page;
   be-alex-3e C4 will move it to POST plane_log_sheets/v2/book_in/{pls}/quote). Writes stay on today's routes.
   Views: views/v2/bookin/*.html. Styles: css/v2/bookin.css (.bki-*), on the shared ta-base.css components.
   The instructor's "Finish & debrief" hands over to today's debrief (dashboard.manage_user.debriefing).
   ═══════════════════════════════════════════════════════════════════════════ */
app.config(['$stateProvider', 'DesignRoutesProvider', function ($stateProvider, DesignRoutesProvider) {
    $stateProvider
        .state('dashboard.v2.book_in', {
            url: '/my_account/book_in/:id?booking_id',   // C26: the claim page's "looks like yours" booking
            templateUrl: 'views/v2/bookin/book_in.html',
            controller: 'BookinV2Controller', controllerAs: 'vm',
            data: { action: 'add' }
        })
        .state('dashboard.v2.finish_and_pay', {
            url: '/my_account/finish_and_pay/:id',
            templateUrl: 'views/v2/bookin/finish_and_pay.html',
            controller: 'FinishAndPayV2Controller', controllerAs: 'vm',
            data: { action: 'add' }
        });
    DesignRoutesProvider
        .map('dashboard.my_account.book_in', 'dashboard.v2.book_in')
        .map('dashboard.my_account.finish_and_pay', 'dashboard.v2.finish_and_pay');
}]);

/* make + model for the hero lines ("Cessna 152"): the model alone when it already starts with the make ("Piper" + "Piper PA-28
   Warrior"), the backend's SchedulerV2::plane_model rule. Used by the book-in and the finish & pay controllers. */
function bkV2MakeModel(man, tn) {
    man = String(man || '').trim(); tn = String(tn || '').trim();
    if (man && (tn.toLowerCase() + ' ').indexOf(man.toLowerCase() + ' ') === 0) { man = ''; }
    return [man, tn].filter(Boolean).join(' ');
}

/* ═══ BookinV2Data — the v2 book-in's server maths (be-alex-3e C4): context (C4.1), quote (C4.2) and the commit (C4.3):
       the server prices, saves, THEN charges. Split flights still save on today's PUT plane_log_sheets/booking_in/{id}. ═══ */
app.factory('BookinV2Data', BookinV2Data);
BookinV2Data.$inject = ['$http', '$location'];
function BookinV2Data($http, $location) {
    var service = {};
    service.GetContext = GetContext;
    service.Quote = Quote;
    service.Commit = Commit;
    service.People = People;
    service.TrackerFlights = TrackerFlights;
    return service;

    // C27: the pickers search on the server — exactly the people the commit accepts (live members, names only), and the
    // sheet's unclaimed tracker flights by range / date / airfield / time
    function qs(o){ return Object.keys(o).filter(function(k){ return o[k] !== undefined && o[k] !== null && o[k] !== ''; }).map(function(k){ return k + '=' + encodeURIComponent(o[k]); }).join('&'); }
    function People(pls_id, q, role, limit) { return $http.get('/api/v1/plane_log_sheets/v2/book_in/' + pls_id + '/people?' + qs({ q: q, role: role, limit: limit })).then(handleSuccess, handleError2); }
    function TrackerFlights(pls_id, o) { return $http.get('/api/v1/plane_log_sheets/v2/book_in/' + pls_id + '/tracker_flights?' + qs(o || {})).then(handleSuccess, handleError2); }

    function GetContext(pls_id, booking_id) { return $http.get('/api/v1/plane_log_sheets/v2/book_in/' + pls_id + '/context' + (booking_id > 0 ? '?booking_id=' + encodeURIComponent(booking_id) : '')).then(handleSuccess, handleError2); }
    function Commit(pls_id, body) { return $http.post('/api/v1/plane_log_sheets/v2/book_in/' + pls_id, body).then(handleSuccess, handleError2); }
    function Quote(pls_id, entries) { return $http.post('/api/v1/plane_log_sheets/v2/book_in/' + pls_id + '/quote', entries).then(handleSuccess, handleError2); }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };
    }
}

// A card payment that came back from the bank by redirect (3-D Secure) lands on the v1 URL first and the v2 redirect keeps only
// the state's declared params — keep Stripe's ones here before the URL is replaced. (The book-in confirms cards with
// redirect: 'if_required' on card / wallet methods, which don't redirect — this is a guard, read by the book-in page.)
(function () {
    try {
        var q = window.location.search || '';
        if (/[?&](payment_intent|setup_intent|redirect_status)=/.test(q) && /\/(book_in|finish_and_pay)\//.test(window.location.pathname)) {
            sessionStorage.setItem('toaviate_bki_stripe_return', q);
        }
    } catch (e) {}
})();

// a picker field of the book-in (scope.pf = which one): bki-pick-field="pic|put|instr|course|tuition"
app.directive('bkiPickField', function () {
    return {
        restrict: 'A',
        scope: true,
        templateUrl: 'views/v2/bookin/_pickfield.html',
        link: function (scope, el, attrs) { scope.pf = attrs.bkiPickField; }
    };
});
 app.controller('BookinV2Controller', BookinV2Controller);

    BookinV2Controller.$inject = ['$sce', 'UserService', 'MemberService', 'FoxService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$interval', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'BookoutService', '$filter', 'PlaneService', 'InstructorCharges', 'PaymentService', 'InvoicesService', 'PackageService', 'CourseService', '$anchorScroll', 'smoothScroll', 'EnvConfig', 'ToastService', 'DefectMediaService', 'FoxTrackService', 'ClubService', 'TimeDisplayService', 'BookinV2Payment', 'BookinV2Data', 'ClaimV2Data', '$q'];
    function BookinV2Controller($sce, UserService, MemberService, FoxService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $interval, $timeout, uiCalendarConfig, BookingService, LicenceService, BookoutService, $filter, PlaneService, InstructorCharges, PaymentService, InvoicesService, PackageService, CourseService, $anchorScroll, smoothScroll, EnvConfig, ToastService, DefectMediaService, FoxTrackService, ClubService, TimeDisplayService, BookinV2Payment, BookinV2Data, ClaimV2Data, $q) {
        
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        //this club ID needs to reflect the club that has been selected....
        vm.club_id = 0;
        vm.booking = {};

        //base location to sort the airfields below
        vm.wgs_n = "51.51";
        vm.wgs_e = "0.12";

        vm.split_flight = 0;
        vm.show_takeoff_landing_times = false;

        vm.change_booking = {};
        vm.show_change_plane = false;
        //we need to get the booking ID to pull as much data as we can!

        vm.bookout = {
            start: true,
            passengers: [],
            pic: {
                id: vm.user_id
            },
            plane: {}
        };

        vm.this_pls_id_raw = 0;

        // PUT plane_log_sheets/booking_in refusals that come back before anything is
        // saved (BACKEND_BOOKOUT_PILOT_CHECKS_GUIDE.md §16.2) → toast title. FORBIDDEN is a
        // writeGuard HANDLED code, so this page must say it.
        var BOOK_IN_REFUSALS = {
            FORBIDDEN: 'Not allowed',
            ALREADY_BOOKED_IN: 'Already booked in',
            NOT_OPEN: 'Flight not open',
            NOT_FOUND: 'Flight not found',
            INVALID_TIMES: 'Check the times',
            SPLIT_SAVE_FAILED: 'Split not saved',
            // the tracker flight picked is already booked in on someone's flight
            // (BACKEND_FOX_CLAIM_ACCESS_GUIDE.md §7) — a writeGuard HANDLED code too
            ALREADY_CLAIMED: 'Already claimed'
        };

        // instructor_charges reads (club / course): the rates, or [] when refused (§16.5)
        function charges_of(data){
            if(data && data.error === 'FORBIDDEN'){
                ToastService.warning('Tuition rates not loaded', (typeof data.message === 'string' && data.message) || "You can't see this club's tuition rates.");
            }
            return (data && angular.isArray(data.items)) ? data.items : [];
        }

        vm.instructors = [];
        vm.pics = [];
        vm.instructor_charges = [];
        vm.club_courses = [];      

        vm.can_authorise = false;

        vm.dateFormat = 'date:HH:mm \'on\' dd/MM/yyyy';
        var setting_new_member;

        vm.flight_times_complete = false;
        vm.calculated_invoice = false;

        vm.show_loading = true;

        vm.reported_defects = [];

        vm.scroll = true;

        vm.previous_invoice;

        vm.defect_severity;
        vm.defect_severities = [
            { title: "No Fly Item - Ground the plane"},
            { title: "Flyable - needs to be checked at next maintenance"},
            { title: "Not urgent - but needs noting"},
            { title: "Unsure of severity"}
        ];  


        // ── Defect report panel state ──
        vm.showDefectPanel = false;
        vm.defectPanelRegistration = '';

        vm.openDefectPanel = function () {
            vm.defectPanelRegistration = vm.bookout.registration;
            vm.showDefectPanel = true;
        };

        vm.closeDefectPanel = function () {
            vm.showDefectPanel = false;
        };

        vm.submitDefect = function (defectData, pendingFiles) {
            var obj = {
                club_id:  vm.bookout.club_id,
                user_id:  vm.bookout.user_id,
                plane_id: vm.bookout.plane_id,
                defect:   defectData.defect,
                severity: defectData.severity,
                status:   'open'
            };

            PlaneService.AddDefect(obj)
                .then(function (data) {
                    data.item.can_delete = true;
                    vm.reported_defects.push(data.item);
                    ToastService.success('Defect reported', 'The defect has been submitted.');

                    if (pendingFiles && pendingFiles.length > 0) {
                        pendingFiles.forEach(function (file, idx) {
                            DefectMediaService.UploadAndAttach(file, data.item.id, vm.bookout.club_id, idx, vm.user.id)
                                .then(function (mediaResult) {
                                    if (mediaResult && mediaResult.success) {
                                        data.item.media_count = (data.item.media_count || 0) + 1;
                                    }
                                });
                        });
                    }

                    vm.showDefectPanel = false;
                    vm.defect = '';
                    vm.defect_severity = '';
                });
        };


        vm.claim_a_flight = [];
        vm.claimed_flight = {};
        vm.auto_claim = 0;
        vm.ignore_next_tuition_change = false;

        vm.get_currency = function(iso_code){


           return $.grep(vm.currencies, function(e){ 
                        return e.iso_code == iso_code; 
                    })[0];

        }

        $scope.get_airfields = function(name){

            if(name.length > 2 && name.length < 5){

                 BookoutService.GetAirfieldsByCode(name)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                       
                         if(vm.airfields.length == 0){
                            //console.log("SETTINGS HERE");
                               vm.airfields = [
                                    {
                                        id:0,
                                        title: "NOT LISTED : "+ name,
                                        code: "ZZZZ",
                                        wgs_n: "0",
                                        wgs_e: "0"
                                    }];
                        }

                    } else {


                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            }

            if(name.length > 4){
                var code = name.replace(/\s/g, "_");
                BookoutService.GetAirfields(code)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;


                        if(vm.airfields.length == 0){
                            //console.log("SETTINGS HERE");
                               vm.airfields = [
                                    {
                                        id:0,
                                        title: "NOT LISTED : "+ name,
                                        code: "ZZZZ",
                                        wgs_n: "0",
                                        wgs_e: "0"
                                    }];
                        }

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

            }
        }
        vm.original_bookout = {};
        $scope.reset_claim_my_flight = function(){
            //console.log("RESET CLAIM");
            vm.bookout = vm.original_bookout;
            vm.different_date_warning = false; 
            vm.claimed_flight = {};
            vm.calculate_invoice_for_flight();
            vm.flight_times_complete = false;
        }

        vm.different_date_warning = false;
        vm.has_used_claimed_flight = false;


        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        
        //direct-debit, saved-card, new-card, card-machine
        // ── Is this completion an instructor finishing an INSTRUCTIONAL flight? ──
        // True when the logged-in user is the instructor on a flight that has a
        // student (PUT). Works for BOTH book-in (instructor_id/pic_id loaded from
        // the booking) AND claim (where the instructor ticks "instructional" and
        // selects a student — update_put() then sets instructor_id/pic_id/put_id).
        // Used by both routing gates (donConfirm + after_success_bookin) so they
        // always agree and an instructional claim reliably reaches the student
        // record/debrief screen, matching the book-in flow.
        vm.is_instructional_completion = function(){
            var hasStudent = (vm.bookout.put_id > 0) ||
                             (vm.bookout.put && vm.bookout.put.user_id > 0) ||
                             vm.this_claim_was_instructional;
            // the PIC counts as "the instructor" only when the PIC IS an instructor: on an authorised student solo the
            // student is PIC and was sent to the instructor's debrief ("Load Failed") — owner 9 Nov
            var userIsInstructor = (vm.bookout.instructor_id > 0 && vm.user.id == vm.bookout.instructor_id) ||
                                   (vm.picIsInstructor() && ((vm.bookout.pic_id > 0 && vm.user.id == vm.bookout.pic_id) ||
                                   (vm.bookout.pic && vm.bookout.pic.user_id > 0 && vm.user.id == vm.bookout.pic.user_id)));
            return !!(hasStudent && userIsInstructor);
        };

        vm.donConfirm = function(methodLabel, paymentIntent){
            console.log("confirmation is called", methodLabel);
            console.log("paymentIntent", paymentIntent);
            //alert('Parent received D confirmation: ' + methodLabel);
            //vm.book_in_flight(methodLabel, paymentIntent);

            var where_to = "home";

            if(vm.user.id !== vm.bookout.payer_id && (vm.user.id == vm.bookout.pic_id || vm.user.id == vm.bookout.instructor_id)){
                //person booking in is the instructor - lets go to debrief:
                where_to = "debrief";
            } else if(vm.is_instructional_completion()){
                // Instructor completing an instructional flight (e.g. claimed) —
                // route to the student record/debrief even if the scalar payer/pic
                // ids didn't line up above.
                where_to = "debrief";
            } else if(vm.split_flight_confirmation == 1){
               // where_to = "split"; - i dont think we get here
            }

            // else if(vm.can_authorise){
            //    card-machine option?
            //}


            //where_to : home, next, split, debrief

            vm.book_in_flight(where_to, methodLabel, paymentIntent);
        };


        vm.default_payment = 'direct-debit';

        vm.methods = [
            { id: 'direct-debit', title: 'Direct debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
            { id: 'card-machine', title: 'Card machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
          ];

          // vm.expandedId = 'direct-debit';
          // vm.selectedId = 'direct-debit';
          vm.savedCards = [
         
          ];

        
        $scope.claim_my_flight = function(force = false){
            // console.log("CLAIM MY FLGIHT PLEASE!!");
            // console.log("CAIMING", vm.claimed_flight);

            if(vm.bookout.flight_date !== vm.claimed_flight.flight_date && force === false){
                vm.different_date_warning = true;   // v2: the warn dialog asks (vm.bk.dlg)
                return false;
            }

            // Preserve the current person / instructional state before overriding flight details
            var preserved_pic = vm.bookout.pic;
            var preserved_pic_id = vm.bookout.pic_id;
            var preserved_put = vm.bookout.put;
            var preserved_put_id = vm.bookout.put_id;
            var preserved_instructor = vm.bookout.instructor;
            var preserved_instructor_id = vm.bookout.instructor_id;
            var preserved_payer_id = vm.bookout.payer_id;
            var preserved_user_id = vm.bookout.user_id;
            var preserved_instructional = vm.this_claim_was_instructional;
            var preserved_supervised_solo = vm.this_was_supervised_solo;
            var preserved_course = vm.bookout.course;
            var preserved_course_id = vm.bookout.course_id;
            var preserved_tuition_required = vm.bookout.tuition_required;
            var preserved_tuition_id = vm.bookout.tuition_id;
            var preserved_tuition_charges = vm.bookout.tuition_charges;
            var preserved_authorised_solo = vm.bookout.authorised_solo;

            vm.this_pls_id_raw = Object.assign({}, vm.bookout);
            console.log("vm.this_pls_id_raw", vm.this_pls_id_raw);

            vm.has_used_claimed_flight = true;

            // Override flight details only
            vm.bookout.from_airfield = vm.claimed_flight.from_airport;
            vm.bookout.to_airfield = vm.claimed_flight.to_airport;

            if(vm.claimed_flight.from_airport.id == vm.claimed_flight.to_airport.id){
                if(vm.claimed_flight.touch_and_go > 2){
                    // circuits 3?
                    var selected_detail_type = vm.flight_types.find(item => item.id === 3);
                    vm.bookout.flight_type = selected_detail_type;
                } else {
                    //local flight? 1 
                    var selected_detail_type = vm.flight_types.find(item => item.id === 1);
                    vm.bookout.flight_type = selected_detail_type;
                }

            } else {
                var selected_detail_type = vm.flight_types.find(item => item.id === 2);
                vm.bookout.flight_type = selected_detail_type;
            }
            
            vm.bookout.flight_date = vm.claimed_flight.flight_date;

            vm.bookout.brakes_off_rounded =  vm.claimed_flight.brakes_off_rounded;
            vm.bookout.brakes_on_rounded = vm.claimed_flight.brakes_on_rounded;

            vm.bookout.brakes_off = {time: vm.claimed_flight.brakes_off};
            vm.bookout.brakes_on = {time: vm.claimed_flight.brakes_on};

            vm.bookout.touch_and_go = vm.claimed_flight.touch_and_go;
            vm.bookout.landings = vm.claimed_flight.full_stop_landings;
            
            vm.bookout.stops = vm.claimed_flight.stops;
            vm.bookout.track_counts_source = vm.claimed_flight.track_counts_source || null;
            vm.bookout.tng = vm.claimed_flight.touch_and_go;
            prefill_counts_from_track(vm.claimed_flight.id);
            vm.split_choices = [];
            vm.split_flight_time = null;
            reset_split_phantom();

            vm.bookout.fox_log_id = vm.claimed_flight.fox_log_id;
            vm.bookout.fox_claimed = 1;

            vm.bookout.takeoff_time = vm.claimed_flight.takeoff_time;
            vm.bookout.landing_time = vm.claimed_flight.landing_time;


            vm.bookout.takeoff_rounded = vm.claimed_flight.takeoff_rounded;
            vm.bookout.landing_rounded = vm.claimed_flight.landing_rounded;
            //console.log("TAKEOFF TIME HERE : ", vm.bookout.takeoff_time);

            //THIS IS THE KEY HERE delete this one once selected / complete
            vm.bookout.claimed_fox_plane_log_sheet_id = vm.claimed_flight.id;

            // Carry over TPC flight time from the claimed flight
            if(vm.claimed_flight.tpc_flight_time && vm.claimed_flight.tpc_flight_time > 0){
                vm.bookout.tpc_flight_time = vm.claimed_flight.tpc_flight_time;
            }
            if(vm.claimed_flight.tpc_brakes_off){
                vm.bookout.tpc_brakes_off = vm.claimed_flight.tpc_brakes_off;
            }
            if(vm.claimed_flight.tpc_brakes_on){
                vm.bookout.tpc_brakes_on = vm.claimed_flight.tpc_brakes_on;
            }

            //set the important bits for the invoice now
            vm.flight_units.brakes_to_brakes = vm.claimed_flight.brakes_time;
            vm.flight_units.airborne_times = vm.claimed_flight.airborne_time;
            vm.flight_units.flight_time = vm.claimed_flight.flight_time;
            vm.flight_units.brakes_times_rounded = vm.bookout.brakes_times_rounded;

            // Restore the preserved person / instructional state
            vm.bookout.pic = preserved_pic;
            vm.bookout.pic_id = preserved_pic_id;
            vm.bookout.put = preserved_put;
            vm.bookout.put_id = preserved_put_id;
            vm.bookout.instructor = preserved_instructor;
            vm.bookout.instructor_id = preserved_instructor_id;
            vm.bookout.payer_id = preserved_payer_id;
            vm.bookout.user_id = preserved_user_id;
            vm.this_claim_was_instructional = preserved_instructional;
            vm.this_was_supervised_solo = preserved_supervised_solo;
            vm.bookout.course = preserved_course;
            vm.bookout.course_id = preserved_course_id;
            vm.bookout.tuition_required = preserved_tuition_required;
            vm.bookout.tuition_id = preserved_tuition_id;
            vm.bookout.tuition_charges = preserved_tuition_charges;
            vm.bookout.authorised_solo = preserved_authorised_solo;
            
            //calculate the invoice yay
            vm.calculate_invoice_for_flight();
            vm.flight_times_complete = true;

            if(vm.bookout.plane_charges.charge_type == "tacho" || vm.bookout.plane_charges.charge_type == "hobbs"){
                //alert("Charges are based on tacho - please enter the final tacho number!");
                //scroll to the the correct bit?
            }

            console.log("BOOKING : ", vm.bookout.booking_id);
            console.log("PLS ID : ", vm.bookout.id);
        }


        $scope.update_pic = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);

            // if(vm.bookout.pic.user_id == vm.bookout.user_id){
            //     //user is P1
            //     var selected_pic = vm.pics.find(item => item.user_id === vm.bookout.pic.user_id);
            //     vm.bookout.pic = selected_pic;
            //     vm.bookout.pic_id = vm.bookout.pic.user_id;
            // }

            // if(vm.bookout.pic.user_id == vm.bookout.instructor_id){
            //     //instructor is P1
            //     var selected_put = vm.pics.find(item => item.user_id === vm.bookout.user_id);
            //     vm.bookout.put = selected_put;
            // }

            var selected_pic = vm.pics.find(item => item.user_id === vm.bookout.pic.user_id);
            vm.bookout.pic = selected_pic;
            vm.bookout.pic_id = vm.bookout.pic.user_id;
            // console.log("INSTRUCTION;:", vm.this_claim_was_instructional);

            if(!vm.this_claim_was_instructional || vm.this_claim_was_instructional == false){
                // console.log("yagh");
                PackageService.GetPackagesByUserId(vm.bookout.pic_id)
                .then(function (data) {
                // IF IT HAS A PACKAGE ID --> THEN WE NEED TO CHECK IT PUT THE CORRECT PAYMENT INFORMATION THERE
                    //console.log("BOOKOUT PACKAGE", data);
                    //console.log("BOOKOUT PACKAGE", data.packages);
                    vm.packages = data.items;

                    PlaneService.GetUpdatedCharges(vm.bookout.club_id, vm.bookout.plane_id, vm.bookout.pic_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                            // a refusal (FORBIDDEN, §15) keeps the charges already on the form
                            if(data && data.plane_charges){
                                vm.bookout.plane_charges = data.plane_charges;
                            } else {
                                ToastService.warning('Charges not updated', (data && data.message) || 'The charges for this pilot could not be loaded.');
                            }


                            vm.bookout.put_id = 0;
                            vm.bookout.put = {};
                            vm.bookout.instructor_id = 0;
                            if(vm.bookout.pic_id > 0){
                                vm.bookout.payer_id = vm.bookout.pic_id;
                            } else if(vm.bookout.user_id > 0) {
                                vm.bookout.payer_id = vm.bookout.user_id;
                            } else {
                                //alert("It appears that no payer ID has been set yet.");
                            }


                            vm.calculate_invoice_for_flight();
                            // console.log("calc?");
                    });

                });


                

            } else {
                console.log("before change - this was instructional");
                if(vm.bookout.pic.instructor == 1){

                } else {
                    // Student picked as PIC on an instructional flight → authorised solo
                    enter_student_solo_mode();
                    vm.calculate_invoice_for_flight();
                }
               
            }
            
            vm.complete_flight = false;

            if(vm.bookout.pic.user_id == vm.user.id){
                vm.can_authorise = false;
            }

            if(!vm.bookout.booking || vm.bookout.booking.user_id == 0 || vm.bookout.user_id == 0){
                vm.bookout.user_id = vm.bookout.pic.user_id;
            }


            if(vm.bookout.put_id == 0 && vm.bookout.instructor_id == 0){
                // console.log("TRYING HERE ==> ", vm.bookout.pic_id);
                // console.log("TRYING TWO ==> ", vm.bookout.payer_id);
                vm.bookout.payer_id = vm.bookout.pic_id;
                // console.log("TRYING THREE ==> ", vm.bookout.payer_id);
            } else {
                // console.log("TRYING PUT ID ==> ", vm.bookout.put_id);
                // console.log("INSTRUCTOR ID ==> ", vm.bookout.instructor_id);

            }

             if(vm.bookout.payer_id == 0){
                // console.log("PAYER ID = 0");
                //vm.bookout.payer_id = vm.bookout.pic_id;
            }




            if(vm.complete_flight){
                vm.complete_this_flight();
            }

            // if(vm.bookout.pic.user_id == vm.user.id && vm.bookout.instructor_id > 0){
            //     //console.log("okay... so you want the instructor to be put? interesting...");
            //     //adheres to booking

            // } else if(vm.bookout.instructor_id > 0 && vm.bookout.pic.user_id == vm.bookout.instructor_id) {
            //     //console.log("okay so you now have your booked instructor as the PIC again - nice");
            //     //adheres to booking

            // } else {
            //     //console.log("you've change instructor? what happened?");
            //     //availability has been checked hence we're OK

            // }


        }

        $scope.update_put = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);
            if(vm.bookout.put.user_id == vm.bookout.pic.user_id){
                ToastService.warning('Selection error', 'Please select a different PIC to the PUT');
                vm.bookout.put = {};
                return false;
            }

            vm.complete_flight = false;
            
            var selected_put = vm.pics.find(item => item.user_id === vm.bookout.put.user_id);
            vm.bookout.put = selected_put;

            vm.bookout.put_id = selected_put.user_id;


            if(vm.bookout.put_id > 0){
                vm.bookout.instructor_id = vm.bookout.pic_id;

                vm.bookout.instructor = vm.bookout.pic;

                console.log("FI: ", vm.bookout.instructor);
                console.log("instructor_id: ", vm.bookout.instructor_id);

                $scope.update_pic();

            }



            PackageService.GetPackagesByUserId(vm.bookout.put_id)
            .then(function (data) {
            // IF IT HAS A PACKAGE ID --> THEN WE NEED TO CHECK IT PUT THE CORRECT PAYMENT INFORMATION THERE
                //console.log("BOOKOUT PACKAGE", data);
                //console.log("BOOKOUT PACKAGE", data.packages);
                vm.packages = data.items;
                PlaneService.GetUpdatedCharges(vm.bookout.club_id, vm.bookout.plane_id, vm.bookout.put_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                            // a refusal (FORBIDDEN, §15) keeps the charges already on the form
                            if(!data || !data.plane_charges){
                                ToastService.warning('Charges not updated', (data && data.message) || 'The charges for this pilot could not be loaded.');
                                return;
                            }
                            vm.bookout.plane_charges = data.plane_charges;
                            vm.calculate_invoice_for_flight();
                    });
            });

            // if(vm.bookout.put_id > 0){
            //     vm.bookout.payer_id = vm.bookout.put_id;
            // }


            if(vm.bookout.pic_id !== 0 && vm.bookout.pic_id !== vm.bookout.instructor_id){
                vm.bookout.payer_id = vm.bookout.pic_id; //PIC is student supervised or otherwise solo
            } else if((vm.bookout.instructor_id > 0 && vm.bookout.put_id > 0) || vm.bookout.instructor_id > 0 && vm.bookout.user_id > 0){
                vm.bookout.payer_id = (vm.bookout.put_id > 0)? vm.bookout.put_id : vm.bookout.user_id; //put always pays
            } else if(vm.bookout.put_id > 0){
                vm.bookout.payer_id = vm.bookout.put_id;
            } else if(vm.bookout.put_id == 0 && vm.bookout.user_id == 0){
                vm.bookout.payer_id = vm.bookout.pic_id;
            } else {
                if(vm.bookout.instructor_id == 0){
                    vm.bookout.payer_id = vm.bookout.pic_id;
                }
                if(vm.bookout.payer_id == 0){
                    ToastService.warning('Payer required', 'Please select a student or person paying for this flight');
                }
            }


            
            if(vm.complete_flight){
                vm.complete_this_flight();
            }

            // if(vm.bookout.put.user_id == vm.bookout.user_id){
            //     //user is P1
            //     var selected_put = vm.pics.find(item => item.user_id === vm.bookout.put.user_id);
            //     vm.bookout.put = selected_put;
            // }

            // if(vm.bookout.put.user_id == vm.bookout.instructor_id){
            //     //instructor is P1
            //     var selected_put = vm.pics.find(item => item.user_id === vm.bookout.user_id);
            //     vm.bookout.put = selected_put;
            // }


            // if(vm.bookout.pic.user_id == vm.user.id && vm.bookout.instructor_id > 0){
            //     //console.log("okay... so you want the instructor to be put? interesting...");
            //     //adheres to booking

            // } else if(vm.bookout.instructor_id > 0 && vm.bookout.pic.user_id == vm.bookout.instructor_id) {
            //     //console.log("okay so you now have your booked instructor as the PIC again - nice");
            //     //adheres to booking

            // } else {
            //     //console.log("you've change instructor? what happened?");
            //     //availability has been checked hence we're OK

            // }
        }

        $scope.update_instructor = function(){
            // //console.log("--> ", vm.user.id);
            // //console.log("--> ", vm.bookout.instructor_id);
            // //console.log("--> ", vm.bookout.pic.user_id);
            
            var selected_instructor = vm.instructors.find(item => item.user_id === vm.bookout.instructor.user_id);
            
            //console.log("INSTRUCTOR UPDATE: ", selected_instructor);

            if(selected_instructor && selected_instructor.user_id > 0){
                vm.bookout.instructor = selected_instructor;
                vm.bookout.instructor_id = selected_instructor.user_id;
                if(vm.bookout.pic_id !== 0 && vm.bookout.pic_id !== vm.bookout.instructor_id){
                    vm.bookout.payer_id = vm.bookout.pic_id; //PIC is student supervised or otherwise solo
                } else if((vm.bookout.instructor_id > 0 && vm.bookout.put_id > 0) || vm.bookout.instructor_id > 0 && vm.bookout.user_id > 0){
                    vm.bookout.payer_id = (vm.bookout.put_id > 0)? vm.bookout.put_id : vm.bookout.user_id; //put always pays
                } else if(vm.bookout.put_id > 0){
                    vm.bookout.payer_id = vm.bookout.put_id;
                } else if(vm.bookout.put_id == 0 && vm.bookout.user_id == 0){
                    vm.bookout.payer_id = vm.bookout.pic_id;
                } else {
                    if(vm.bookout.instructor_id == 0){
                        vm.bookout.payer_id = vm.bookout.pic_id;
                    }
                    if(vm.bookout.payer_id == 0){
                        ToastService.warning('Payer required', 'Please select a student or person paying for this flight');
                    }
                }
                // if(vm.bookout.pic_id > 0){
                //     vm.bookout.payer_id = vm.bookout.pic_id;
                // }
            } else {
                vm.bookout.instructor = {};
                vm.bookout.instructor_id = 0;
                vm.bookout.payer_id = vm.bookout.pic_id;
            }

            if(vm.complete_flight){
                vm.complete_this_flight();
            }
            
        }


        


        // the ARRIVAL option should be automatically filled in when there was a departure prior to the flight and home airfield was
        //entered as the destination

        vm.flight_types = [
            {
                id: 1,
                title: "Local"
            }, 
            {
                id: 2,
                title: "Departure"
            },
            {
                id: 3,
                title: "Circuits"
            },
            {
                id: 4,
                title: "Other"
            }
        ];


        vm.biggin_hill = {

            routes: [
                {
                    id: 1,
                    title: "Kenley"
                },
                {
                    id: 2,
                    title: "Sevenoaks"
                },
                {
                    id: 3,
                    title: "Swanley"
                },
                {
                    id: 4,
                    title: "Other"
                }
            ],
            parking: ""

        }

        vm.flight_rules = [
            {
                id: 1,
                title: "VFR"
            },
            {
                id: 2,
                title: "IFR"
            }
        ];
        vm.split_flight_confirmation = 0;
        // who flew the second part: 'same' (continued flight — e.g. master left
        // on between two flights), 'solo' (student solo send-off), 'hire' (the
        // person under instruction carried on as an ordinary self-hire — a
        // licence holder, no instructor, no training record), 'other'
        vm.split_crew_mode = 'same';
        vm.split_crew_options = [
            { id: 'same',  title: 'Same crew',                   hint: 'the same people carried on flying (one flight, two tracker legs)' },
            { id: 'solo',  title: 'Student solo',                hint: 'the student flew part 2 alone — an authorised solo you supervised' },
            { id: 'hire',  title: 'Pilot continued as self-hire', hint: 'The person under instruction flew on alone as an ordinary hire — no instructor, no training record' },
            { id: 'other', title: 'Somebody else',               hint: 'a different pilot flew part 2 — leave it for them to claim' }
        ];
        vm.split_crew_can_solo = function(){
            return !!(vm.bookout && ((vm.bookout.put_id > 0) || (vm.bookout.put && vm.bookout.put.user_id > 0)));
        };
        // 'solo' and 'hire' both need a person under instruction on part 1
        vm.split_crew_opt_disabled = function(opt){
            return !!(opt && (opt.id == 'solo' || opt.id == 'hire') && !vm.split_crew_can_solo());
        };
        vm.split_crew_label = function(id){
            var o = vm.split_crew_options.find(function(x){ return x.id === id; });
            return o ? o.title : 'Same crew';
        };
        vm.split_crew_student_name = function(){
            var put = (vm.bookout && vm.bookout.put) || {};
            return put.first_name || 'the student';
        };
        // one line under the radios saying what the chosen mode does to part 2
        vm.split_crew_note = function(id){
            var who = vm.split_crew_student_name();
            switch(id){
                case 'solo':  return 'Part 2 is saved as an authorised student solo: ' + who + ' is pilot in command, you authorised it, and it gets its own training record.';
                case 'hire':  return 'Part 2 is saved as an ordinary self-hire for ' + who + ': pilot in command and payer, no instructor, no training record.';
                case 'other': return 'Part 2 is saved with no crew — whoever flew it claims and books it in.';
                default:      return 'Part 2 keeps the same pilot in command, student and instructor as this part.';
            }
        };
        // ── Split picker (FRONTEND_TRACK_DATA_GUIDE.md §3) ──────────────────
        // The "Split Flight At" options come from GET fox_track/pls/{id}/split_points
        // (every real ground stop, tracker + track file, in time order). The
        // tracker-only candidates the backend puts on vm.bookout.stops stay as
        // the fallback (NO_TRACK / error / no points) and are merged in when a
        // tracker gap isn't covered by a point. Each option posts exactly what
        // the old picker posted: { title: ISO …T…Z, time: 'HH:MM' }.
        vm.split_flight_time = null;
        vm.split_choices = [];                 // what the ui-select lists
        vm.split_points_status = 'idle';       // idle | loading | ok | none
        vm.split_points_note = '';
        vm.split_pairs_source = null;          // 'tracker' | 'track' (hypothetical response, §3)
        // §3.1 phantom split points: the pending "Split anyway?" confirm and
        // whether the current preview was forced past a phantom verdict
        vm.split_phantom = null;               // { warning, min_agl_ft, max_speed_kt, from_hm, to_hm, verdict, pls_id }
        vm.split_forced = false;
        var split_forced_title = null;         // the choice title the user forced (so rounding keeps force_split)
        var split_points_cache = {};           // pls_id → split_points[]

        function reset_split_phantom(){
            vm.split_phantom = null;
            vm.split_forced = false;
            split_forced_title = null;
            vm.split_pairs_source = null;
        }

        function split_pls_id(){
            var pls_id = vm.bookout.id;
            if(!pls_id || pls_id == null || pls_id == 0){
                pls_id = vm.this_pls_id_raw;
            }
            if(vm.has_used_claimed_flight && vm.claimed_flight && vm.claimed_flight.id > 0){
                pls_id = vm.claimed_flight.id;
            }
            return (pls_id && pls_id > 0) ? pls_id : 0;
        }

        // 'Y-m-d H:i:s' (UTC) → 'HH:MM'
        function hm_of(dt){
            if(!dt) { return ''; }
            var m = String(dt).match(/(\d{2}):(\d{2})(?::\d{2})?\s*Z?$/);
            return m ? (m[1] + ':' + m[2]) : String(dt);
        }
        // 'Y-m-d H:i:s' → 'Y-m-dTH:i:sZ' (what hypothetical_flight_split parses as title)
        function iso_of(dt){
            if(!dt) { return ''; }
            var str = String(dt);
            if(str.indexOf('T') > -1) { return /Z$/.test(str) ? str : str + 'Z'; }
            return str.replace(' ', 'T') + 'Z';
        }
        function ts_of(iso){
            var t = Date.parse(iso);
            return isNaN(t) ? 0 : Math.floor(t / 1000);
        }

        function tracker_stop_choice(stop){
            return {
                title: stop.title,
                time: stop.time,
                ts: ts_of(stop.title),
                source: 'tracker',
                from_hm: '', to_hm: '',
                kind_label: '',
                recommended: false,
                warning: null,
                verdict: null, verdict_label: '', selectable: true,
                floor_hm: stop.time, ceil_hm: stop.time, nearest_hm: stop.time,
                point: null
            };
        }

        function build_split_choices(points){
            var choices = [];
            var i;
            (points || []).forEach(function(pt){
                var r = pt.rounded_to_5_min || {};
                var nearest = hm_of(r.nearest || pt.midpoint);
                // §3.1: selectable:false = phantom verdict (the tracker's "landing"
                // is not in the track) — listed greyed-out, never a default
                var selectable = (pt.selectable !== false);
                choices.push({
                    title: iso_of(pt.midpoint),
                    time: nearest,
                    ts: pt.midpoint_ts || ts_of(iso_of(pt.midpoint)),
                    from_ts: pt.from_ts, to_ts: pt.to_ts,
                    source: pt.source || 'both',
                    from_hm: hm_of(pt.from), to_hm: hm_of(pt.to),
                    duration_s: pt.duration_s,
                    kind_label: pt.landing_kind ? FoxTrackService.landingKindLabel(pt.landing_kind) : '',
                    recommended: !!pt.recommended && selectable,
                    warning: pt.warning || null,
                    verdict: pt.verdict || null,
                    verdict_label: pt.verdict ? FoxTrackService.verdictLabel(pt.verdict) : '',
                    selectable: selectable,
                    floor_hm: hm_of(r.floor || pt.midpoint),
                    ceil_hm: hm_of(r.ceil || pt.midpoint),
                    nearest_hm: nearest,
                    tracker_pair_index: (pt.tracker_pair_index === undefined) ? null : pt.tracker_pair_index,
                    point: pt
                });
            });
            // merge the tracker-derived candidates that no point already covers
            // (de-duplicated by window / time)
            var stops = (vm.bookout && angular.isArray(vm.bookout.stops)) ? vm.bookout.stops : [];
            stops.forEach(function(stop){
                if(!stop || !stop.title) { return; }
                var sts = ts_of(stop.title);
                var covered = false;
                for(i = 0; i < choices.length; i++){
                    if(choices[i].time == stop.time) { covered = true; break; }
                    if(choices[i].from_ts && choices[i].to_ts && sts >= choices[i].from_ts - 60 && sts <= choices[i].to_ts + 60) { covered = true; break; }
                }
                if(!covered) { choices.push(tracker_stop_choice(stop)); }
            });
            choices.sort(function(a, b){ return (a.ts || 0) - (b.ts || 0); });
            return choices;
        }

        function use_tracker_stops_only(){
            var stops = (vm.bookout && angular.isArray(vm.bookout.stops)) ? vm.bookout.stops : [];
            vm.split_choices = stops.map(tracker_stop_choice);
            vm.split_points_status = 'none';
        }

        vm.load_split_points = function(){
            var pls_id = split_pls_id();
            if(!pls_id){ use_tracker_stops_only(); return; }
            if(split_points_cache[pls_id]){
                vm.split_choices = build_split_choices(split_points_cache[pls_id]);
                vm.split_points_status = 'ok';
                return;
            }
            use_tracker_stops_only();          // fallback shown while we fetch
            vm.split_points_status = 'loading';
            FoxTrackService.GetSplitPoints(pls_id)
                .then(function(data){
                    if(data && data.success !== false && angular.isArray(data.split_points) && data.split_points.length > 0){
                        split_points_cache[pls_id] = data.split_points;
                        vm.split_choices = build_split_choices(data.split_points);
                        vm.split_points_status = 'ok';
                        vm.split_points_note = (data.track_confidence !== null && data.track_confidence !== undefined && data.track_confidence < 0.5) ? 'Low confidence in the track analysis — treat the track-only points as unconfirmed.' : '';
                    } else {
                        // NO_TRACK / FORBIDDEN / empty → tracker candidates only, never block the form
                        console.log('split_points unavailable', data);
                        use_tracker_stops_only();
                        // the track was read but shows no ground stop ≠ the track is missing
                        if(data && data.success !== false && angular.isArray(data.split_points)){ vm.split_points_status = 'empty'; }
                    }
                }, function(){ use_tracker_stops_only(); });
        };

        // The landing counts on an unclaimed sheet are a snapshot taken when the
        // entry was analysed; the reconciliation recomputes from the track every
        // time. Most accurate wins: when the track file is analysed (and not cut
        // at a split / mis-linked / low confidence) seed the form from its
        // recommendation, otherwise keep the tracker-provided figures. Never
        // overrides counts a person set ('manual' / 'applied') or a value the
        // pilot has already changed on the form.
        function prefill_counts_from_track(pls_id){
            pls_id = parseInt(pls_id, 10);
            if(!(pls_id > 0) || !FoxTrackService || !FoxTrackService.GetPls){ return; }
            var src = vm.bookout.track_counts_source;
            if(src === 'manual' || src === 'applied'){ return; }
            var seeded_fs = vm.bookout.landings, seeded_tg = vm.bookout.tng;
            FoxTrackService.GetPls(pls_id).then(function(data){
                if(!data || data.success === false || !data.recommended){ return; }
                var track = data.track || null, ts = track ? (track.summary || track) : null;
                if(!ts || track.available === false){ return; }
                if(ts.confidence !== undefined && ts.confidence !== null && Number(ts.confidence) < 0.5){ return; }
                var rec = data.recommended, flags = rec.flags || [];
                if(flags.indexOf('SEGMENT_TRUNCATED') > -1 || flags.indexOf('TRACKER_PAIRS_OUTSIDE_TRACK') > -1 || flags.indexOf('NO_TRACK_EVENTS') > -1){ return; }
                var v = function(k){ var o = rec[k]; var n = (o && o.value !== undefined) ? parseInt(o.value, 10) : NaN; return isNaN(n) ? null : n; };
                var fs = v('full_stop_landings'), sg = v('stop_and_gos'), tg = v('touch_and_gos');
                if(fs === null || tg === null){ return; }
                fs = fs + (sg || 0);                      // the sheet counts stop-and-gos with full stops
                if(vm.bookout.landings != seeded_fs || vm.bookout.tng != seeded_tg){ return; }   // pilot already edited
                if(fs == seeded_fs && tg == seeded_tg){ return; }
                console.log("prefill counts from track", {fs: fs, tg: tg, was: [seeded_fs, seeded_tg]});
                vm.bookout.landings = fs; vm.bookout.full_stop_landings = fs;
                vm.bookout.tng = tg; vm.bookout.touch_and_go = tg;
                vm.bookout.track_counts_source = 'calculated';
                if(vm.calculate_invoice_for_flight){ vm.calculate_invoice_for_flight(); }
            });
        }

        vm.split_option_label = function(c){
            if(!c) { return ''; }
            var bits = [];
            if(c.kind_label) { bits.push(c.kind_label); }
            if(c.source === 'track') { bits.push('track file only'); }
            return c.time + (bits.length ? ' · ' + bits.join(' · ') : '');
        };

        // floor / nearest / ceil of the chosen point's midpoint on the 5-minute grid
        // Memoised per chosen point: this is called from an ng-repeat every digest,
        // and a fresh array of fresh objects each call is an infinite-digest loop.
        vm.split_round_options = function(){
            var c = vm.split_flight_time;
            if(!c || !c.point) { return []; }
            var key = [c.floor_hm, c.nearest_hm, c.ceil_hm].join('|');
            if(c._round_key === key && c._round_options) { return c._round_options; }
            var seen = {}, out = [];
            [['floor', c.floor_hm], ['nearest', c.nearest_hm], ['ceil', c.ceil_hm]].forEach(function(o){
                if(o[1] && !seen[o[1]]) { seen[o[1]] = true; out.push({ id: o[0], time: o[1] }); }
            });
            c._round_key = key;
            c._round_options = out.length > 1 ? out : [];
            return c._round_options;
        };
        vm.split_use_rounding = function(hm){
            if(!vm.split_flight_time || !hm || vm.split_flight_time.time == hm) { return; }
            vm.split_flight_time.time = hm;
            vm.update_split();
        };

        // force = true repeats the POST with force_split:1 (§3.1, after the user
        // confirmed "Split anyway?"). Left undefined, the force sticks only while
        // the same choice is selected (rounding floor/nearest/ceil re-posts).
        function post_hypothetical_split(pls_id, force){
            if(!vm.split_flight_time || !vm.split_flight_time.title){ return; }
            var forced = (force === undefined) ? (vm.split_forced && split_forced_title === vm.split_flight_time.title) : !!force;
            var split_send = {
                title: vm.split_flight_time.title,
                time: vm.split_flight_time.time,
                booking_id: vm.bookout.booking_id,
                this_pls_id: vm.bookout.id
            };
            if(forced){ split_send.force_split = 1; }
            // console.log("split_send : ", split_send);
            PlaneService.HypotheticalFlightSplit(pls_id, split_send)
             .then(function (data) {
                    console.log("data is : ", data);
                    if(data && data.error === 'PHANTOM_SPLIT_POINT'){
                        // the chosen time sits on a gap the track says was never a
                        // landing — ask inline, no browser dialog (§3.1)
                        var sp = data.split_point || {};
                        vm.split_phantom = {
                            warning: sp.warning || data.message || 'The tracker\'s landing here is not in the recorded track: splitting here would cut a flight in mid-air.',
                            min_agl_ft: (sp.min_agl_ft === undefined) ? null : sp.min_agl_ft,
                            max_speed_kt: (sp.max_speed_kt === undefined) ? null : sp.max_speed_kt,
                            from_hm: hm_of(sp.from), to_hm: hm_of(sp.to),
                            verdict: sp.verdict || null,
                            verdict_label: sp.verdict ? FoxTrackService.verdictLabel(sp.verdict) : '',
                            pls_id: pls_id
                        };
                        vm.split_forced = false;
                        split_forced_title = null;
                        vm.split_one = null;
                        vm.split_two = null;
                        return;
                    }
                    if(!data || data.success === false || !data.first_flight){
                        ToastService.warning('Split not possible', (data && data.message) || 'The selected timings dont work unfortunately.');
                        return;
                    }
                    vm.split_phantom = null;
                    vm.split_one = data.first_flight;
                    // C46: the split point the user picked (leg 1 is charged up to it, leg 2 from it) — sent on the quote
                    vm.split_at = data.split_at || (data.first_flight && data.first_flight.tpc_split_at) || null;

                    vm.split_flight = 1;
                    // vm.split_one.brakes_off = {"time": vm.split_one.brakes_off};
                    // vm.split_one.brakes_on = {"time": vm.split_one.brakes_on};
                    vm.split_two = data.second_flight;
                    vm.split_two.brakes_off = {"time": vm.split_two.brakes_off};
                    vm.split_two.brakes_on = {"time": vm.split_two.brakes_on};
                    // split_cut_utc (where the recorded track is cut) rides on
                    // second_flight and is posted back with split_two — keep it
                    if(!vm.split_two.split_cut_utc && vm.split_one && vm.split_one.split_cut_utc){
                        vm.split_two.split_cut_utc = vm.split_one.split_cut_utc;
                    }
                    // a forced split carries split_point (top level + both legs);
                    // it must reach the book-in PUT on split_two so the backend
                    // flags the pair for the manager's review
                    if(!vm.split_two.split_point && data.split_point){
                        vm.split_two.split_point = data.split_point;
                    }
                    vm.split_forced = !!(forced && vm.split_two.split_point && vm.split_two.split_point.selectable !== true);
                    split_forced_title = vm.split_forced ? vm.split_flight_time.title : null;
                    // "tracker" | "track" — track = pairs synthesised from the recording
                    vm.split_pairs_source = data.split_pairs_source || null;
                });
        }

        vm.split_phantom_confirm = function(){
            if(!vm.split_phantom){ return; }
            post_hypothetical_split(vm.split_phantom.pls_id || split_pls_id() || vm.bookout.id, true);
        };
        vm.split_phantom_cancel = function(){
            vm.split_phantom = null;
            vm.split_forced = false;
            split_forced_title = null;
            vm.split_flight_time = null;
        };

        vm.split_this_flight = function(){
            vm.split_flight = 1;
            vm.load_split_points();
            //add this pls_id to the split (only once a time has been picked)
            if(vm.split_flight_time && vm.split_flight_time.title){
                post_hypothetical_split(vm.bookout.id);
            }
        }

        vm.cancel_split = function(){
            vm.bookout = vm.original_bookout;
            vm.split_one = {};
            vm.split_two = {};
            vm.split_flight = 0;
            vm.split_flight_confirmation = 0;
            reset_split_phantom();

            process_bookout_to_bookin(vm.bookout);


        }

        vm.update_split = function(){
            // belt and braces behind ui-disable-choice: a phantom point is never a split
            if(vm.split_flight_time && vm.split_flight_time.selectable === false){
                ToastService.warning('Not a landing', vm.split_flight_time.warning || 'The tracker\'s landing here is not in the recorded track — pick another time.');
                vm.split_flight_time = null;
                return;
            }
            // a new choice drops any pending "Split anyway?" and any force on the old one
            if(vm.split_flight_time && split_forced_title !== vm.split_flight_time.title){
                vm.split_phantom = null;
                vm.split_forced = false;
                split_forced_title = null;
            }
            var pls_id = split_pls_id();
            if(!pls_id){ pls_id = vm.bookout.id; }
            //hypothetical_flight_split
            post_hypothetical_split(pls_id);
        }

        function clean_times(which, start_end, compared_to = null){

            var compare_date;

            // //console.log("CLEAN TIMES " ,which);


            var this_date = new Date();


            if(vm.bookout && vm.bookout.brakes_off){

                compare_date = new Date(compared_to);
                var split_time = vm.bookout.brakes_off.time.split(":");
                compare_date.setHours(split_time[0]);
                compare_date.setMinutes(split_time[1]);
                compare_date.setSeconds(0);

                this_date = new Date(compared_to);
                this_date.setHours(0);
                this_date.setMinutes(0);
                this_date.setSeconds(0);

            } else {
                switch(which){
                    case 'today':
                        // compare_date = new Date();
                        compare_date = new Date("1990-07-26");

                    break;
                    case 'past':
                        //we need to consider the back-dating as possible issue...
                        compare_date = new Date("1990-07-26");
                    break;
                    case 'future':
                        compare_date = new Date("1990-07-26");
                    break;
                    case 'after':
                    //differentiate here
                        compare_date = new Date(compared_to);
                        this_date = new Date(compared_to);
                    break;
                    case 'before':
                    //differentiate here
                        compare_date = new Date(compared_to);
                    break;
                }
            }

          

            //console.log("THIS DATE", this_date);
            //console.log("COMPARE DATE", compare_date);



            vm[start_end].forEach(function(time, i){

                        //this may very well be the case function here to change when the re-do the times            
                        var split_time = time.time.split(":");
                        this_date.setHours(split_time[0]);
                        this_date.setMinutes(split_time[1]);
                        this_date.setSeconds(0);


                        if( moment(this_date).isAfter(moment(compare_date)) ){
                            vm[start_end][i].disabled = 0;
                            //we should / could be checking airport opening hours...?
                            //vm[start_end][i].disabled = check_business_hours(parseInt(split_time[0]), parseInt(split_time[1]), (start_end == "start_times")? 1 : 0);
                        } else {
                            vm[start_end][i].disabled = 1;
                        }
                    });

                //by definition as we are changing something to cause this function from being called - we need to recalculate the times:
                //calculate_duration();

        }

        vm.start_times = [];
        vm.all_times = [];

        for(var i=0;i<24;i++){

                for(var j=0; j<(60/5); j++){
                    var k = 5 * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.start_times.push({time: i+":"+k, disabled: false});
                }

                for(var j=0; j<(60/10); j++){
                    var k = 10 * j;
                    k = ((k < 10) ? '0' : '') + k;
                    vm.all_times.push({time: i+":"+k, disabled: false});
                }
           

        }
        //clean_times('today', 'start_times');
        clean_times('future', 'all_times');

        // vm.bookout.pic = vm.pics[0];
        vm.currency_days = 28;


        vm.dateTimeRangePickerOptions = {
                hour_step: 1,
                minute_step: 30,
                min_date: new Date(),
                business_hours: {
                    from: "09:00",
                    to: "22:30"
                }
            };


         vm.dateTimeRangePickerOptions2 = {
                hour_step: 1,
                minute_step: 5,
                min_date: new Date(),
                business_hours: {
                    from: "00:00",
                    to: "23:55"
                }
            };

            vm.options = {
                hour_step: 1,
                minute_step: 5,
                min_date: new Date(),
                business_hours: {
                    from: "00:00",
                    to: "23:55"
                }
            };




            vm.lubricant_type = [{ title: "Fuel"}, {title: "Oil"}];
            vm.who_paid = [{ title: "Me"}, {title: "Club"}];
            vm.receipt = {
                image: "",
                quantity: 0,
                price: 0,
                reimbursement: false,
                item: {title: "Fuel"}
            };

            $scope.processFiles = function(files){

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    files[i].file.temp_path = j.saved_url;
                    // //console.log("file", files[i].file);
                    vm.receipt_image = files[i].file;
                    vm.receipt.image = vm.receipt_image.temp_path;
                    //console.log("IMAGE", vm.receipt_image);
                }
               
            }

            vm.update_course = function(){

                console.log("do we need to update tuition to be offered from this?");

                // Keep the scalar course_id in sync with the selected course object.
                // The flight save (plane_log_sheet.course_id) and the debrief page both
                // read vm.bookout.course_id, NOT the object — so without this a manually
                // selected course was never persisted (course_id stayed 0), and the
                // debrief lesson picker showed "no course available".
                vm.bookout.course_id = (vm.bookout.course && vm.bookout.course.id > 0)
                    ? vm.bookout.course.id
                    : 0;

                // IF nothing selected --> give ALL OPTIONS
                if(vm.bookout.course && vm.bookout.course.id > 0){

                    console.log("vm.bookout.course", vm.bookout.course);

                     InstructorCharges.GetByCourseId(vm.bookout.course.id)
                    .then(function(data){
                        vm.instructor_charges = charges_of(data);

                        //check if updates selected tuition received list?
                        if(vm.instructor_charges.length == 1){
                            //set this automatically?
                            vm.bookout.tuition_required = vm.instructor_charges[0];
                        }
                         //UPDATE TUITION CHARGES
                        vm.ignore_next_tuition_change = true;
                        vm.update_tuition_charges(); //>> is this right?
                    });

                } else {
                     InstructorCharges.GetByClubId(vm.bookout.club_id)
                    .then(function(data){
                        vm.instructor_charges = charges_of(data);

                        //check if updates selected tuition received list?
                        if(vm.instructor_charges.length == 1){
                            //set this automatically?
                            vm.bookout.tuition_required = vm.instructor_charges[0];
                        }
                         //UPDATE TUITION CHARGES
                        vm.ignore_next_tuition_change = true;
                        vm.update_tuition_charges(); //>> is this right?

                    });
                }
                // InstructorCharges.GetByClubId(booking.club_id)
                // .then(function(data){
                //     vm.instructor_charges = data.items;  
                // });

                // IF course is selected --> GIVE ONLY THAT COURSE OPTION


               



            }

            vm.update_tuition_charges = function(){

                if(vm.bookout.tuition_required && vm.bookout.tuition_required.id > 0){


                    InstructorCharges.GetUpdatedCharges(vm.bookout.tuition_required.id)
                    .then(function (data) {
                        //console.log("data is : ", data);
                        // refused (FORBIDDEN, §15) or not found: keep the tuition already on the form
                        if(!data || data.success === false || !data.tuition_required){
                            ToastService.warning('Tuition not updated', (data && data.message) || 'That tuition rate could not be loaded.');
                            vm.ignore_next_tuition_change = false;
                            return;
                        }

                        vm.bookout.tuition_charges = data.tuition_charges;
                        vm.bookout.tuition_required = data.tuition_required;
                        vm.bookout.tuition_id = data.tuition_required.id;
                        console.log("tuition charges: ", vm.bookout);
                        vm.calculate_invoice_for_flight();

                        if(vm.complete_flight){
                            vm.complete_this_flight();
                        }
                        vm.ignore_next_tuition_change = false;
                    });

                } else {
                    if(!vm.ignore_next_tuition_change){
                        if(vm.bookout.instructor_id > 0){
                            ToastService.warning('Tuition required', 'Please select a tuition type for this flight.');
                        }
                        vm.ignore_next_tuition_change = false;
                    }
                    
                }


            }

            vm.delete_receipt = function(id){

                 return PlaneService.DeleteReceipt(id)
                .then(function (rcpt) {

                    // FORBIDDEN (not yours / no longer pending / flight booked in — see
                    // BACKEND_MONEY_ACCESS_GUIDE.md §3) is in writeGuard's HANDLED_CODES
                    if (rcpt && rcpt.success === false) {
                        ToastService.error('Receipt not deleted', rcpt.message || 'The receipt could not be deleted.');
                        return;
                    }

                    PlaneService.GetAllSheetReceipts(vm.bookout.id)
                    .then(function (data) {
                        ////console.log("data is : ", data);
                        if (angular.isArray(data)) {
                            vm.lubricant_receipts = data;
                        }
                        vm.calculate_invoice_for_flight();

                    });

                });
            }


            vm.check_reimbursement = function(){

                if(vm.receipt.price < 0.01 || vm.receipt.currency == ""){
                    return false;
                }

                var obj = {
                    price: vm.receipt.price,
                    currency: vm.receipt.currency.iso_code,
                    club_id: vm.bookout.club_id
                }

                PlaneService.CheckReimbursement(obj)
                    .then(function (data) {
                        //console.log("conversion", data);

                        // no exchange rate (Transferwise unreachable - RATE_UNAVAILABLE): say so; saving the
                        // receipt asks again (and refuses with the same message rather than save no amount)
                        if (!data || data.success === false || !data.reimburse) {
                            vm.receipt.reimbursed_amount = null;
                            vm.receipt.reimbursed_rate = null;
                            ToastService.warning('Exchange rate unavailable', (data && typeof data.message === 'string' && data.message) || "We couldn't get today's exchange rate - please try again in a few minutes.");
                            return;
                        }

                        vm.receipt.reimbursed_amount = data.reimburse.reimbursed_amount;
                        vm.receipt.reimbursed_currency = data.reimburse.reimbursed_currency;
                        vm.receipt.reimbursed_rate = data.reimburse.rate;
                        vm.receipt.reimbursed_datetime = data.reimburse.datetime;


                    });


            }


            vm.add_receipt = function(){

                if(vm.receipt.reimbursement && !vm.receipt.image){
                    ToastService.warning('Receipt required', 'You must upload a copy of your receipt if you wish to be reimbursed.');
                    return false;
                }

                var obj = {
                    plane_id: vm.bookout.plane_id,
                    club_id: vm.bookout.club_id,
                    user_id: vm.user.id,
                    plane_log_sheet_id: vm.bookout.id,
                    reimbursement: vm.receipt.reimbursement,
                    image: vm.receipt.image,
                    currency: vm.receipt.currency.iso_code,
                    item: vm.receipt.item.title,
                    quantity: vm.receipt.quantity,
                    price: vm.receipt.price
                }

                //console.log("OBJ TO SEND: ", obj);


                return PlaneService.AddReceipt(obj)
                .then(function (rcpt) {
                            //console.log("RECEIPTS", rcpt);
                            // refused (FORBIDDEN: not a member of this club / not your own
                            // receipt — BACKEND_MONEY_ACCESS_GUIDE.md §3) or not saved
                            if (!rcpt || rcpt.success === false || !rcpt.item) {
                                ToastService.error('Receipt not saved', (rcpt && rcpt.message) || 'The receipt could not be saved. Please try again.');
                                return;
                            }
                            vm.lubricant_receipts.push(rcpt.item);


                            //clear the uploaded items...
                            vm.receipt = {
                                image: "",
                                quantity: 0,
                                price: 0,
                                reimbursement: false,
                                item: {title: "Fuel"}
                            };

                            vm.calculate_invoice_for_flight();

                });


            }

            /* ADD OR EDIT THE BOOKING */

            function check_business_hours(i, k = null, start = 0){
            //i is hours
            //k is minutes
            k = parseInt(k);
            i = parseInt(i);

            var this_step_disabled = 0; 
            if(vm.options.business_hours){
                var split = vm.options.business_hours.from.split(":");
                var split2 = vm.options.business_hours.to.split(":");

                if(start == 0){
                    //adjust to match times / end min 1 hour slots
                   // split2[0] = parseInt(split2[0]) + 1;
                } else {
                    split2[0] = parseInt(split2[0]) - 1;
                }

                if(k || k == 0){
                    
                    if(i < parseInt(split[0]) ){
                        // //console.log("we disable because "+i+":"+k+" is before "+split.join(":") );
                        this_step_disabled = 1;
                    } else if(i == parseInt(split[0]) && k < parseInt(split[1])){
                         // //console.log("we disable because "+i+":"+k+" is before "+split.join(":") );
                        this_step_disabled = 1;
                    }

                    // if(i >= parseInt(split2[0]) && k >= parseInt(split2[1]) ){
                    //     // //console.log("we disable because "+i+":"+k+" is after "+split2.join(":") );
                    //     this_step_disabled = 1;
                    // } 


                    if(i > parseInt(split2[0])){
                        this_step_disabled = 1; 
                    } else if( i == parseInt(split2[0]) && k > parseInt(split2[1])){
                        this_step_disabled = 1;
                    }


                } else {
                    if(parseInt(split[0]) < i){
                        this_step_disabled = 1;
                    } 
                    if(parseInt(split2[0]) > i){
                        this_step_disabled = 1;
                    } 
                }
            }

            return this_step_disabled;
        }

        vm.options = {};
        vm.start_times = [];
        vm.end_times = [];

        vm.takeoff_times = [];
        vm.landing_times = [];

        


            function figure_out_steps(){
                //console.log("OPTIONS", vm.dateTimeRangePickerOptions2);
                vm.options = vm.dateTimeRangePickerOptions2;
                 for(var i=0;i<24;i+=vm.options.hour_step){

                    if(vm.options.minute_step && vm.options.minute_step > 0){
                        for(var j=0; j<(60/vm.options.minute_step); j++){
                            var k = vm.options.minute_step * j;
                            k = ((k < 10) ? '0' : '') + k;
                            vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                            vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                        }
                    } else {
                        vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                        vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
                    }

                }
                // vm.takeoff_times = angular.copy(vm.start_times);
                // vm.landing_times = angular.copy(vm.end_times);
                angular.copy(vm.start_times, vm.takeoff_times);
                angular.copy(vm.end_times, vm.landing_times);
            }

            function init_times(){
               for(var i=0;i<24;i+=vm.options.hour_step){

                    if(vm.options.minute_step && vm.options.minute_step > 0){
                        for(var j=0; j<(60/vm.options.minute_step); j++){
                            var k = vm.options.minute_step * j;
                            k = ((k < 10) ? '0' : '') + k;
                            vm.start_times.push({time: i+":"+k, disabled: check_business_hours(i, k)});
                            vm.end_times.push({time: i+":"+k, disabled: check_business_hours(i, k), duration: ""});
                        }
                    } else {
                        vm.start_times.push({time: i+":00", disabled: check_business_hours(i)});
                        vm.end_times.push({time: i+":00", disabled: check_business_hours(i), duration: ""});
                    }

                } 
                // vm.takeoff_times = angular.copy(vm.start_times);
                // vm.landing_times = angular.copy(vm.end_times);
                angular.copy(vm.start_times, vm.takeoff_times);
                angular.copy(vm.end_times, vm.landing_times);
            }

            function get_duration_str(seconds){
                //var seconds = Math.floor(seconds);
                // //console.log(seconds);
                // //console.log(moment.duration(seconds));
                // //console.log("days: "+moment.duration(seconds).days());
                // //console.log("hours: "+moment.duration(seconds).hours());
                // //console.log("minutes: "+moment.duration(seconds).minutes());

                var days = moment.duration(seconds).days();
                var hours = moment.duration(seconds).hours();
                var minutes = moment.duration(seconds).minutes();

                //occasional issue showing 59 minutes - unsure where but this is a fix for it... think moment() has a bug
                if(minutes == 59){
                    hours++;
                    minutes = 0;
                }


                var string = "";
                if(days > 0){
                    string = string+" "+days+" day";
                    string = (days > 1)? string+"s" : string;
                }
                if(hours > 0){
                    string = string+" "+hours+" hour";
                    string = (hours > 1)? string+"s" : string;
                }
                if(minutes > 0){
                    string = string+" "+minutes+" minute";
                    string = (minutes > 1)? string+"s" : string;
                }

                 // //console.log("STR : "+string);

                return string;

            }

            vm.calculate_my_brakes_duration = function(){
             //   calculate_duration(); //symlink
                 if(vm.bookout.start_date && vm.bookout.brakes_off){
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.brakes_off.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);
                    // //console.log("START DATETIME", start_datetime);  

                    vm.end_times.forEach(function(time, i){ 
                        //no need to go through each element if its not required to be shown!
                        if(time.disabled == 0){

                            var end_datetime = new Date(vm.bookout.end_date);
                            var end_time = time.time.split(":");
                            end_datetime.setHours(end_time[0]);
                            end_datetime.setMinutes(end_time[1]);  
                            end_datetime.setSeconds(0);
                            // //console.log("END DATETIME", end_datetime);  

                            var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                            //now we need to calculate the difference in datetime
                            // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                            var human_str = get_duration_str(difference);

                           


                            // //console.log("human string", human_str);
                            if(human_str == ""){
                                vm.end_times[i].disabled = 1;
                                //vm.takeoff_times[i].disabled = 1;
                            } else {
                                vm.end_times[i].duration = "( "+human_str+" )";
                            }


                        } else {
                            vm.end_times[i].duration = "";
                        }
                      //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    });

                    // console.log("SELECTED HERE: vm.show_takeoff_landing_times ", vm.show_takeoff_landing_times);

                    if(vm.show_takeoff_landing_times){
                        //also set the takeoff 5mins after taxi?
                        //vm.takeoff_times = vm.end_times;
                        angular.copy(vm.end_times, vm.takeoff_times);
                        // console.log("SELECTED HERE????", vm.takeoff_times);
                    }

                }
            }    

            function calculate_duration(){
                if(vm.bookout.start_date && vm.bookout.start_time){
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.start_time.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);
                    // //console.log("START DATETIME", start_datetime);  

                    vm.end_times.forEach(function(time, i){ 
                        //no need to go through each element if its not required to be shown!
                        if(time.disabled == 0){

                            var end_datetime = new Date(vm.bookout.end_date);
                            var end_time = time.time.split(":");
                            end_datetime.setHours(end_time[0]);
                            end_datetime.setMinutes(end_time[1]);  
                            end_datetime.setSeconds(0);
                            // //console.log("END DATETIME", end_datetime);  

                            var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                            //now we need to calculate the difference in datetime
                            // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                            var human_str = get_duration_str(difference);

                           


                            // //console.log("human string", human_str);
                            if(human_str == ""){
                                vm.end_times[i].disabled = 1;
                                //vm.takeoff_times[i].disabled = 1;
                            } else {
                                vm.end_times[i].duration = "( "+human_str+" )";
                            }


                        } else {
                            vm.end_times[i].duration = "";
                        }
                      //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    });

                    //console.log("SELECTED HERE: vm.show_takeoff_landing_times ", vm.show_takeoff_landing_times);

                    if(vm.show_takeoff_landing_times){
                        //also set the takeoff 5mins after taxi?
                        //vm.takeoff_times = vm.end_times;
                        angular.copy(vm.end_times, vm.takeoff_times);
                        //console.log("SELECTED HERE????", vm.takeoff_times);
                    }

                }
            }


            vm.calculate_airborne_duration = function(){
                if(vm.bookout.takeoff_time){
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.takeoff_time.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);
                    // //console.log("START DATETIME", start_datetime);  

                    vm.landing_times.forEach(function(time, i){ 
                        //no need to go through each element if its not required to be shown!
                        if(time.disabled == 0){

                            var end_datetime = new Date(vm.bookout.end_date);
                            var end_time = time.time.split(":");
                            end_datetime.setHours(end_time[0]);
                            end_datetime.setMinutes(end_time[1]);  
                            end_datetime.setSeconds(0);
                            // //console.log("END DATETIME", end_datetime);  

                            var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                            //now we need to calculate the difference in datetime
                            // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                            var human_str = get_duration_str(difference);

                           


                            // //console.log("human string", human_str);
                            if(human_str == ""){
                                vm.landing_times[i].disabled = 1;
                            } else {
                                vm.landing_times[i].duration = "( "+human_str+" )";
                            }


                        } else {
                            vm.landing_times[i].duration = "";
                        }
                      //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    });
                }
            }


            vm.calculate_after_landing_duration = function(){

                if(vm.show_takeoff_landing_times){
                        //also set the takeoff 5mins after taxi?

                        if(vm.bookout.start_date && vm.bookout.landing_time){
                            var start_datetime = new Date(vm.bookout.start_date);
                            var start_time = vm.bookout.landing_time.time.split(":");
                            start_datetime.setHours(start_time[0]);
                            start_datetime.setMinutes(start_time[1]);
                            start_datetime.setSeconds(0);
                            // //console.log("START DATETIME", start_datetime);  

                            vm.end_times.forEach(function(time, i){ 
                                //no need to go through each element if its not required to be shown!
                                if(time.disabled == 0){

                                    var end_datetime = new Date(vm.bookout.end_date);
                                    var end_time = time.time.split(":");
                                    end_datetime.setHours(end_time[0]);
                                    end_datetime.setMinutes(end_time[1]);  
                                    end_datetime.setSeconds(0);
                                    // //console.log("END DATETIME", end_datetime);  

                                    var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));

                                    //now we need to calculate the difference in datetime
                                    // //console.log("d: "+moment.duration(difference).days()+" h: "+moment.duration(difference).hours()+" m: "+moment.duration(difference).minutes());
                                    var human_str = get_duration_str(difference);

                                   


                                    // //console.log("human string", human_str);
                                    if(human_str == ""){
                                        vm.end_times[i].disabled = 1;
                                    } else {
                                        vm.end_times[i].duration = "( "+human_str+" )";
                                    }


                                } else {
                                    vm.end_times[i].duration = "";
                                }
                              //if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                            });

                            
                        }


                }


                
            }


            vm.flight_units = 
            {
                brakes_to_brakes: 0,
                airborne_times: 0,
                flight_time: 0,
                meter_units: (vm.bookout.end_tacho - vm.bookout.start_tacho)
            };

            vm.cancel_split = function(){
                vm.bookout = vm.original_bookout;
                vm.bookout.brakes_off = vm.bookout.brakes_off.time;
                vm.bookout.brakes_on = vm.bookout.brakes_on.time;
                console.log(vm.bookout);
                console.log(vm.bookout.brakes_on);
                vm.split_flight_confirmation = 0;
                vm.split_flight = 0;
                reset_split_phantom();
                // vm.split_one = {};
                // vm.split_two = {};
                process_bookout_to_bookin(vm.bookout);
                //vm.calculate_my_airborne_duration();
            }

            vm.confirm_split = function(){
                console.log("CONFIRM SPLIT");

                vm.try_split = true;

                vm.before_split_bookout = vm.bookout;
                vm.split_flight_confirmation = 1;

                vm.original_bookout = vm.bookout;
                vm.split_one.touch_and_go = vm.bookout.touch_and_go;
                vm.split_one.tng = vm.bookout.tng;
                console.log("TNG : ", vm.split_one.touch_and_go);

                vm.split_one.full_stop_landings = vm.bookout.full_stop_landings
                vm.split_one.landings = vm.bookout.landings;
                vm.split_one.remote_landings = vm.bookout.remote_landings;
                vm.split_one.pic = vm.bookout.pic;
                vm.split_one.pic_id = vm.bookout.pic_id;
                vm.split_one.put = vm.bookout.put;
                vm.split_one.put_id = vm.bookout.put_id;
                vm.split_one.payer_id = vm.bookout.payer_id;
                vm.split_one.instructor = vm.bookout.instructor;
                vm.split_one.instructor_id = vm.bookout.instructor_id;
                vm.split_one.booking = vm.bookout.booking;
                vm.split_one.booking_id = vm.bookout.booking_id;
                if(vm.bookout.course && vm.bookout.course.id){
                    vm.split_one.course_id = vm.bookout.course.id;
                }
                vm.split_one.course = vm.bookout.course;
                vm.split_one.tuition_required = vm.bookout.tuition_required;
                //vm.split_one.tuition = vm.bookout.course;
                // vm.split_one.plane = vm.bookout.plane;
                //vm.bookout.course

                vm.split_one.authorised_solo = vm.bookout.authorised_solo;
                // vm.split_one.plane = vm.bookout.plane;
                // vm.split_one.plane = vm.bookout.plane;
                // vm.split_one.plane = vm.bookout.plane;


                //UPDATE THE FLIGHT TIME UNITS NOW
                vm.flight_units.brakes_to_brakes = vm.split_one.brakes_times;

                vm.flight_units.airborne_times = vm.split_one.airborne_time;

                vm.flight_units.flight_time = vm.split_one.flight_time;

                vm.flight_units.brakes_times_rounded = vm.split_one.brakes_times_rounded;


                console.log("OLD ONE - ", vm.split_one);

                vm.bookout = vm.split_one;

                console.log("SPLIT 1 - ", vm.split_one);
                console.log("SPLIT 2 - ", vm.split_two);
                
                process_bookout_to_bookin(vm.bookout);

                console.log("new bookout = ", vm.bookout);

                //vm.calculate_invoice_for_flight();
            }
            
            vm.calculate_my_airborne_duration = function(){

                if(vm.has_used_claimed_flight) { //and not overridden??
                    //this should never happen....

                    vm.flight_units.brakes_to_brakes = vm.claimed_flight.brakes_time;
                    vm.flight_units.airborne_times = vm.claimed_flight.airborne_time;
                    vm.flight_units.flight_time = vm.claimed_flight.flight_time;
                    vm.flight_units.brakes_times_rounded = vm.claimed_flight.brakes_times_rounded;

                    vm.calculate_invoice_for_flight();
                

                } else {


                    if((vm.bookout.takeoff_time && vm.bookout.takeoff_time.time) && (vm.bookout.landing_time && vm.bookout.landing_time.time)){

                        //console.log("BOTH SET SO", vm.bookout.brakes_off.time);
                        //console.log("BOTH SET SO", vm.bookout.brakes_on.time);
                        var start_datetime = new Date();
                        var start_time = vm.bookout.takeoff_time.time.split(":");
                        start_datetime.setHours(start_time[0]);
                        start_datetime.setMinutes(start_time[1]);
                        start_datetime.setSeconds(0);


                        var end_datetime = new Date();
                        //var end_time = time.time.split(":");
                        var end_time = vm.bookout.landing_time.time.split(":");
                        end_datetime.setHours(end_time[0]);
                        end_datetime.setMinutes(end_time[1]);  
                        end_datetime.setSeconds(0);


                        var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));
                        // var human_str = get_duration_str(difference);

                        vm.flight_units.airborne_times = moment.duration(difference).asHours();
                        //console.log("HELLO DURATION CALC", vm.flight_units.brakes_to_brakes);

                        // Compute TPC flight time (takeoff to landing + 10 mins) when no fox data
                        if(is_tpc_charging() && (!vm.bookout.fox_log_id || vm.bookout.fox_log_id == 0)){
                            var tpc_end = moment(end_datetime).add(10, 'minutes');
                            var tpc_diff = moment(tpc_end.startOf('minute')).diff(moment(start_datetime).startOf('minute'));
                            vm.bookout.tpc_flight_time = moment.duration(tpc_diff).asHours();
                            console.log("TPC flight time (manual):", vm.bookout.tpc_flight_time);
                        }

                        vm.calculate_invoice_for_flight();
                        //  //console.log("HELLO DURATION CALC2", human_str);

                    }

                    if(vm.bookout.brakes_off && vm.bookout.brakes_off.time !== "" && vm.bookout.brakes_on && vm.bookout.brakes_on.time !== ""){


                        var bstart_datetime = new Date();
                        var bstart_time = vm.bookout.brakes_off.time.split(":");
                        bstart_datetime.setHours(bstart_time[0]);
                        bstart_datetime.setMinutes(bstart_time[1]);
                        bstart_datetime.setSeconds(0);


                        var bend_datetime = new Date();
                        //var end_time = time.time.split(":");
                        if(vm.bookout.brakes_on && vm.bookout.brakes_on.time){

                            var bend_time = vm.bookout.brakes_on.time.split(":");
                            bend_datetime.setHours(bend_time[0]);
                            bend_datetime.setMinutes(bend_time[1]);  
                            bend_datetime.setSeconds(0);


                            var difference = moment(moment(bend_datetime).startOf("minute")).diff(moment(bstart_datetime).startOf("minute"));
                            // var human_str = get_duration_str(difference);

                            vm.flight_units.brakes_to_brakes = moment.duration(difference).asHours();
                            //console.log("HELLO DURATION CALC", vm.flight_units.brakes_to_brakes);

                            //console.log("FLIGHT BRAKES UNITS : ", vm.flight_units.brakes_to_brakes);

                            // Compute TPC flight time from brakes times when no fox data and no takeoff/landing times available
                            if(is_tpc_charging() && (!vm.bookout.fox_log_id || vm.bookout.fox_log_id == 0)){
                                // If takeoff/landing times are set, prefer those (already computed in calculate_my_airborne_duration)
                                if(!vm.bookout.takeoff_time || !vm.bookout.takeoff_time.time || !vm.bookout.landing_time || !vm.bookout.landing_time.time){
                                    // Fallback: use brakes off to brakes on + 10 mins
                                    var tpc_end = moment(bend_datetime).add(10, 'minutes');
                                    var tpc_diff = moment(tpc_end.startOf('minute')).diff(moment(bstart_datetime).startOf('minute'));
                                    vm.bookout.tpc_flight_time = moment.duration(tpc_diff).asHours();
                                    console.log("TPC flight time (from brakes, manual):", vm.bookout.tpc_flight_time);
                                }
                            }

                            vm.calculate_invoice_for_flight();


                        }
                        

                    }

                    

                    
                }


                vm.flight_times_complete = true;

            }



            vm.update_dateTime = function(){
                //console.log("STARTED", vm.bookout.brakes_off);
                //console.log("STARTED", vm.bookout.brakes_on);
                if(vm.has_used_claimed_flight) { //and not overridden??


                    vm.flight_units.brakes_to_brakes = vm.claimed_flight.brakes_time;
                    vm.flight_units.airborne_times = vm.claimed_flight.airborne_time;
                    vm.flight_units.flight_time = vm.claimed_flight.flight_time;

                    vm.calculate_invoice_for_flight();
                
                } else {


                    if((vm.bookout.brakes_off && vm.bookout.brakes_off.time) && (vm.bookout.brakes_on && vm.bookout.brakes_on.time)){

                        //console.log("BOTH SET SO", vm.bookout.brakes_off.time);
                        //console.log("BOTH SET SO", vm.bookout.brakes_on.time);
                        var start_datetime = new Date();
                        var start_time = vm.bookout.brakes_off.time.split(":");
                        start_datetime.setHours(start_time[0]);
                        start_datetime.setMinutes(start_time[1]);
                        start_datetime.setSeconds(0);


                        var end_datetime = new Date();
                        //var end_time = time.time.split(":");
                        var end_time = vm.bookout.brakes_on.time.split(":");
                        end_datetime.setHours(end_time[0]);
                        end_datetime.setMinutes(end_time[1]);  
                        end_datetime.setSeconds(0);


                        var difference = moment(moment(end_datetime).startOf("minute")).diff(moment(start_datetime).startOf("minute"));
                        // var human_str = get_duration_str(difference);

                        vm.flight_units.brakes_to_brakes = moment.duration(difference).asHours();
                        //console.log("HELLO DURATION CALC", vm.flight_units.brakes_to_brakes);

                        // Compute TPC flight time from brakes off/on + 10 mins when no fox data
                        if(is_tpc_charging() && (!vm.bookout.fox_log_id || vm.bookout.fox_log_id == 0)){
                            var tpc_end = moment(end_datetime).add(10, 'minutes');
                            var tpc_diff = moment(tpc_end.startOf('minute')).diff(moment(start_datetime).startOf('minute'));
                            vm.bookout.tpc_flight_time = moment.duration(tpc_diff).asHours();
                            console.log("TPC flight time (update_dateTime):", vm.bookout.tpc_flight_time);
                        }

                        vm.calculate_invoice_for_flight();
                        //  //console.log("HELLO DURATION CALC2", human_str);

                    }
                }


                vm.flight_times_complete = true;

            }


            function check_relative_date(date, start_end = "start"){
                var relative = "today";
                //console.log("RELATIVE TIME CHECK", date);
                if(moment(moment(date).format("YYYY/MM/DD")).isAfter(moment().format("YYYY/MM/DD"))){
                    relative = "future";

                    //then is after today
                    // the catch is that if date == start / end date --> THEN we need to present that it is today even though it isnt - this is premise
                    // that is valid only for the "END" cases (so that we return AFTER rather than today) --> otherwise the end_times available won't reflect
                    //the fact that the start_times have been selected allowing the user to select an end time before start time (which is silly really...)

                    if(vm.bookout.start_date && vm.bookout.end_date && start_end == "end"){
                        if(moment(vm.bookout.start_date).isSame(moment(vm.bookout.end_date))){
                            relative = "after"; // because we need to act as though it is after in the clean_times (to not be able to select end < start times)
                        }
                    }
                    
                } else if(moment(date).format("YYYY/MM/DD") == moment().format("YYYY/MM/DD")){
                    //then today
                    relative = (start_end == "start") ? "today" : "after";
                } else {
                    //must be in the past...
                    relative = "past";
                }
                
                // //console.log("relative is ", relative);
                return relative;
            }

            // function add_hour_to_end(){
            //     var a = vm.bookout.start_time.time.split(":");
            //     //var b = new Date();
            //     var b = new Date(vm.bookout.start_date);
            //     b.setHours(a[0]);
            //     b.setMinutes(a[1]);
            //     b.setSeconds(0);
            //     var future = moment(b).add(1, "hour").format();
            //    // clean_times('after', 'end_times', future);
            //    //

            //      //clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', future);



            //     if(parseInt(a[0]) >= 23){
            //         if(moment(vm.bookout.start_date).isSame(moment(vm.bookout.end_date))){
            //              // //console.log("THIS ADD DAY");
            //             // //console.log("start", vm.bookout.start_date);
            //             // //console.log("end", vm.bookout.end_date);
            //              // //console.log("after or = 11pm - then we need to change the date that follows the same pattern");
            //             vm.bookout.end_date = new Date(moment(vm.bookout.end_date).add(1, "day").format());
            //             clean_times('future', 'end_times');

            //             //set it to 00:00 hours probably a wise thing...
            //             vm.bookout.end_time = vm.end_times[0];


            //         } 
            //     } else {
            //         clean_times('after', 'end_times', b);
            //     }

            // }

        function check_times(){

                var c = new Date();
                var a = (vm.bookout.start_time) ? vm.bookout.start_time.time.split(":") : [c.getHours(), c.getMinutes()];
                var b = new Date(vm.bookout.start_date);
                b.setHours(a[0]);
                b.setMinutes(a[1]);
                b.setSeconds(0);
                var future = moment(b).add(1, "hour").format();

                //check if the end_time is set && if the end time is > start time...
                if(start_after_end() || !vm.bookout.end_time){
                    
                    clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);

                    var id;
                    // vm.end_times.forEach(function(time, i){ 
                    //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    // });
                    vm.end_times.some(function(time, i){ 
                      if(time.time == moment(future).format("H:mm")){ id = i; return i;};  
                    });

                    vm.bookout.end_time = {};
                    vm.bookout.end_time = vm.end_times[id];

                } else {
                    clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);
                }


                 //need to update the selection of the end time if this has been set
                if(vm.bookout.end_time && vm.bookout.end_time.disabled == 1){

                    var id;
                    //used to use a forEach loop but decided to run a some loop instead due to the benefit of not going through all elements
                    // vm.end_times.forEach(function(time, i){ 
                    //   if(time.time == moment(future).format("H:mm")){ id = i; return true;}; 
                    // });
                    vm.end_times.some(function(time, i){ 
                      if(time.time == moment(future).format("H:mm")){ id = i; return i;};  
                    });

                    vm.bookout.end_time = {};
                    vm.bookout.end_time = vm.end_times[id];

                }

                if(vm.bookout.start_time && vm.bookout.start_time.disabled == 1){

                    var id;
                    vm.start_times.some(function(time, i){ 
                      if(time.disabled == 0){ id = i; return i;}; 
                    });

                    vm.bookout.start_time = {};
                    vm.bookout.start_time = vm.start_times[id];

                    calculate_duration();
                }
        }




         function booking_today(){
                if(moment(vm.bookout.start_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
                    //console.log("WE ARE TODAY?");
                    clean_times('today', 'start_times');

                } else {
                    // //console.log("should get full day");
                    if(moment(vm.bookout.start_date).isAfter(moment()) ){
                        clean_times('future', 'start_times');
                    }
                }

                if(moment(vm.bookout.end_date).format("DD/MM/YYYY") == moment().format("DD/MM/YYYY")){
                    if(vm.bookout.start_time){
                       //console.log("START TIME", vm.bookout.start_time);
                        add_hour_to_end(); 
                    }
                    clean_times(check_relative_date(vm.bookout.start_date), 'end_times');
                }


                if(vm.bookout.end_date == vm.bookout.start_date){
                        // //console.log("booking today where end = start");
                        if(vm.bookout.start_time){
                            var a = vm.bookout.start_time.time.split(":");
                            var b = new Date(vm.bookout.start_date);
                            b.setHours(a[0]);
                            b.setMinutes(a[1]);
                            b.setSeconds(0);

                            //we need to check the times give
                            if(start_after_end()){
                                clean_times(check_relative_date(vm.bookout.start_date), 'start_times');
                                // //console.log("UPDATE END BITS IF START > END required?");
                                clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);
                                add_hour_to_end();
                            } else {
                                // //console.log("UPDATE END BITS IF START > END 2", check_relative_date(vm.bookout.start_date, "end"));
                                clean_times(check_relative_date(vm.bookout.end_date, "end"), 'end_times', b);
                            }


                        }
                }

            }

            // clean_times('today', 'start_times');
            booking_today();


        $scope.update_dateTime = function(which_update){

            //console.log("UPDATE TIME HERE", which_update);

            switch(which_update){

               

                case 'start_time':

                    //do we need to clean the times? if so.. 
                    booking_today();

                    check_times();

                    //we need to calculate the time in between the start and the end!
                    calculate_duration();
                    

                break;

                case 'end_time':
                    check_times();

                break;

                case 'edit':

                    // //this is the edit function that needs to be setup.
                    // booking_today();

                    // //number 1 = we have set start and end of the current date....
                    // // setTimeout(function(){
                    // //     check_times();
                    // //     // calculate_duration();
                    // // }, 5000);
                    // //console.log("ASD ",vm.bookout.start_date);
                    // // clean_times(check_relative_date(vm.bookout.start_date), 'start_times');
                    // check_times();
                    // calculate_duration();

                    booking_today();

                    clean_times(check_relative_date(vm.bookout.start_date), 'start_times');

                    check_times();

                    calculate_duration();

                    setTimeout(function(){
                        //do we need to clean the times? if so.. 
                        // pre_select_value_id("start_times", vm.bookout.start_time);
                        pre_select_value_id();
                        //we need to calculate the time in between the start and the end!
                    }, 500);




                    //we need to set the previously selected plane here...


                break;

            }


            //an update on the form would require an update of the plane / waiting lists available
          


        }



        function start_after_end(){
                var start_after_end = false;
                if(vm.bookout.end_time){
                    // //console.log("START AFTER END LOOP");
                    var start_datetime = new Date(vm.bookout.start_date);
                    var start_time = vm.bookout.start_time.time.split(":");
                    start_datetime.setHours(start_time[0]);
                    start_datetime.setMinutes(start_time[1]);
                    start_datetime.setSeconds(0);

                    var end_datetime = new Date(vm.bookout.end_date);
                    var end_time = vm.bookout.end_time.time.split(":");
                    end_datetime.setHours(end_time[0]);
                    end_datetime.setMinutes(end_time[1]);
                    end_datetime.setSeconds(0);

                    if(moment(start_datetime).isAfter(moment(end_datetime)) || moment(start_datetime).isSame(end_datetime) || end_datetime == start_datetime){
                        start_after_end = true;
                    }


                }
                return start_after_end;
        }

        figure_out_steps();
        init_times();

        switch($state.current.data.action){
            case "add":

                //console.log("bookout", $stateParams.id);
                //so now we can load the BOOKING with this ID, and therefore can sort it all out :)
                // let us preload the content required from the booking - fetch the booking
                //console.log("FETCH THE BOOKING");

                BookingService.GetForBookIn($stateParams.id)
                 .then(function (data) {
                    console.log("data is : ", data);
                    if(data.success){
                        //console.log("success");
                        

                        if(data.bookout.booked_in == 1){
                            ToastService.warning('Already booked', 'It appears that you have already booked this flight back in.');
                            $state.go('dashboard.my_account', {}, { reload: true });
                        }

                        vm.original_bookout = data.bookout;
                        vm.bookout = data.bookout;

                        vm.claim_a_flight = data.unclaimed;
                        // split flights: the other half (part 1 when booking in part 2)
                        vm.split_prev_leg = data.split_prev_leg || null;
                        vm.split_next_leg = data.split_next_leg || null;
                        // BookingService.GetUnclaimedFlights(vm.bookout.plane_id).then(function (data) {
                        //         ////console.log("data is : ", data);
                        //         if(data.success){
                        //             console.log(data);
                        //         }
                        //     });


                        // FoxService.GetFoxEntriesByPlane(vm.bookout.plane_id)
                        // .then(function (data) {
                        //     if(data.success){
                        //         console.log(data);
                        //         vm.claim_a_flight = data.to_claim;
                        //     }

                        // });

                        //temporary bits to overcome the start and end times issues...
                        vm.bookout.start_date = new Date("2100/07/26");
                        vm.bookout.end_date = new Date("2100/07/26");
                        //console.log("RAW DATA HERE : ", data);
                        // MemberService.GetAllByPics(data.bookout.club_id, vm.user.id)

                        MemberService.GetAllByPicsBookinout(vm.bookout.booking_id, vm.bookout.club_id, vm.user.id, 1)
                            .then(function (pics) {
                                    vm.pics = tagMemberSource(pics);
                                    console.log("PICS: ", vm.pics);
                                    process_bookout_to_bookin(data.bookout);
                                    preselect_split_leg_crew(data.bookout);
                            });

                       MemberService.GetAllByClubInstructor(vm.bookout.club_id, vm.user.id)
                            .then(function (instructors) {
                                    vm.instructors = tagMemberSource(instructors.instructors);
                                    //process_bookout_to_bookin(data.bookout);
                            });


                        PackageService.GetPackagesForBookout(vm.bookout.id)
                            .then(function (data) {
                            // IF IT HAS A PACKAGE ID --> THEN WE NEED TO CHECK IT PUT THE CORRECT PAYMENT INFORMATION THERE
                                //console.log("BOOKOUT PACKAGE", data);
                                //console.log("BOOKOUT PACKAGE", data.packages);
                                vm.packages = data.packages;
                            });

                            // if(vm.bookout.put_id > 0){
                            //     vm.bookout.payer_id = vm.bookout.put_id;
                            // } else {
                            //     vm.bookout.payer_id = vm.bookout.pic_id;
                            // }

                            if(vm.bookout.payer_id == 0){
                                if(vm.bookout.pic_id !== 0 && vm.bookout.pic_id !== vm.bookout.instructor_id){
                                    vm.bookout.payer_id = vm.bookout.pic_id; //PIC is student supervised or otherwise solo
                                } else if((vm.bookout.instructor_id > 0 && vm.bookout.put_id > 0) || vm.bookout.instructor_id > 0 && vm.bookout.user_id > 0){
                                    vm.bookout.payer_id = (vm.bookout.put_id > 0)? vm.bookout.put_id : vm.bookout.user_id; //put always pays
                                } else if(vm.bookout.put_id > 0){
                                    vm.bookout.payer_id = vm.bookout.put_id;
                                } else if(vm.bookout.put_id == 0 && vm.bookout.user_id == 0){
                                    vm.bookout.payer_id = vm.bookout.pic_id;
                                } else {
                                    if(vm.bookout.instructor_id == 0){
                                        vm.bookout.payer_id = vm.bookout.pic_id;
                                    }
                                    if(vm.bookout.payer_id == 0){
                                        ToastService.warning('Payer required', 'Please select a student or person paying for this flight');
                                    }
                                }
                            }




                    } else {
                        // GET plane_log_sheets/{id} refused (FORBIDDEN: not on the flight and not a
                        // current member / staff of its club — BACKEND_BOOKOUT_PILOT_CHECKS_GUIDE.md §15)
                        // or the sheet is gone (NOT_FOUND): say so and leave the empty form.
                        ToastService.warning('Flight not available', (data && data.message) || 'This flight could not be loaded.');
                        $state.go('dashboard.my_account');
                    }
                });

                
            break;
            case "edit":

            



            break;
            case "list":

             


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  
      

        vm.get_package_html = function(pack_obj){
            var used_on = "";
            for(var i=0;i<pack_obj.aircraft.length;i++){
                used_on = used_on + " " + pack_obj.aircraft[i].registration +" ("+ pack_obj.aircraft[i].plane_type +") <br />";
            }
            var text = "";
            if(pack_obj.validity == 0){
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package does not expire <br /> To be used on:<br />";
            } else {
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package expires on: "+ moment(pack_obj.created_at).add(pack_obj.validity, "days").format("D MMM Y") +" <br /> To be used on:<br />";
            }
    
            return text+used_on;

        }

        vm.this_was_a_supervised_solo = function(){
            vm.this_was_supervised_solo = !vm.this_was_supervised_solo;
            //pic probably is the payer
            if(vm.this_was_supervised_solo){
                vm.bookout.payer_id = vm.bookout.pic_id;
            } else if(vm.bookout.put_id > 0) {
                vm.bookout.payer_id = vm.bookout.put_id;
            } else if(vm.bookout.user_id > 0){
                vm.bookout.payer_id = vm.bookout.user_id;
            }

            // if(vm.complete_flight && vm.){
            //     vm.complete_this_flight();
            // }

        }

        // ── Student solo: send / stand down ─────────────────────────────
        // Activates (or closes) the provisional STUDENT SOLO airfield
        // bookout created at book-out. The gate re-runs the pre-solo checks
        // per club policy; a 'pilot_checks' block is shown inline with a
        // Force option for managers. Standing down is deliberately
        // friction-free — not going solo is completely normal.
        vm.solo_send = { working: false, failures: [], can_force: false };

        // Friendly next-step per unmet-requirement state (failures now carry
        // `state` — BACKEND_PRE_SOLO_COURSE_REQUIREMENTS_GUIDE.md §4.4).
        // be-alex-3e (10 Nov): reviewed is not passed — the instructor marks a review-required questionnaire passed
        // (pending_review = not reviewed / reviewed without an outcome; not_passed can be a questionnaire)
        vm.soloStateAction = function(state, failure){
            var isQ = !!failure && (failure.auto_type === 'questionnaire' || /reviewed/i.test(failure.message || ''));
            if (state === 'pending_review' && isQ) { return 'Mark the questionnaire as passed if it is, then send solo again'; }
            if (state === 'not_passed' && isQ) { return 'It was marked not passed — set a retake, or change the outcome after reviewing it again'; }
            switch (state) {
                case 'pending_review':              return 'Review the questionnaire with the student and mark it as passed, then send solo again';
                case 'in_progress':                 return 'The questionnaire was started but never submitted';
                case 'not_attempted':               return 'The linked questionnaire/exam has not been attempted';
                case 'below_min_score':             return 'The pass mark was not reached';
                case 'not_passed':                  return 'No passing exam result is recorded';
                case 'no_medical':                  return 'No acceptable medical on record';
                case 'medical_expired':             return 'The medical has expired';
                case 'medical_class_not_accepted':  return 'The medical held is not an accepted class for this course';
                case 'medical_limitation':          return 'The medical has a limitation (OSL) that rules out solo flight';
                case 'not_signed_off':              return 'Needs an instructor sign-off on the student record';
                default:                            return '';
            }
        };

        // A questionnaire is sat submitted-but-unreviewed — jump to the
        // student's attempts so it can be reviewed on the spot.
        vm.soloReviewStudent = function(){
            var student_id = vm.bookout.put_id || vm.bookout.pic_id;
            if (!student_id) { return; }
            $state.go('dashboard.manage_user.student_questionnaires', { student_id: student_id });
        };

        vm.send_solo = function(force){
            if (vm.solo_send.working) { return; }
            vm.solo_send.working = true;
            var opts = {};
            if (force) { opts.force_override = 1; }
            BookoutService.SendSolo(vm.bookout.id, opts).then(function(data){
                vm.solo_send.working = false;
                if (data && data.success){
                    vm.solo_send.failures = [];
                    vm.solo_send.can_force = false;
                    vm.bookout.solo_sent_at = new Date();
                    vm.bookout.authorised_by = data.authorised_by;
                    ToastService.success('Solo sent!', 'Student solo confirmed — the airfield display has been updated. Have a great flight!');
                } else if (data && data.reason === 'pilot_checks'){
                    vm.solo_send.failures = data.failures || [{ message: data.message || 'The pre-solo checks did not pass.' }];
                    vm.solo_send.can_force = data.can_force_override === true;
                    ToastService.warning('Solo blocked', data.message || 'The pre-solo checks did not pass — see the details on screen.');
                } else {
                    ToastService.error('Solo not sent', (data && data.message) || 'Could not send the solo — please try again.');
                }
            });
        };

        vm.cancel_solo = function(){
            if (vm.solo_send.working) { return; }
            vm.solo_send.working = true;
            BookoutService.CancelSolo(vm.bookout.id).then(function(data){
                vm.solo_send.working = false;
                if (data && data.success){
                    vm.solo_send.failures = [];
                    vm.bookout.solo_sent_at = null;
                    vm.bookout.solo_intent = null;
                    ToastService.success('Solo stood down', 'No problem — the planned solo has been removed from the airfield display.');
                } else {
                    ToastService.error('Not stood down', (data && data.message) || 'Could not stand the solo down — please try again.');
                }
            });
        };

        vm.picIsInstructor = function(){
            return !!(vm.bookout && vm.bookout.pic && vm.bookout.pic.instructor == 1);
        };

        // A student (non-instructor) as PIC on an instructional flight = an AUTHORISED
        // STUDENT SOLO: the student stays PIC, the chosen instructor authorised and
        // supervised it (authorised_solo / authorised_by) and gets the debrief. Defaults
        // the authoriser to the logged-in user when they instruct at this club.
        function enter_student_solo_mode(){
            vm.this_was_supervised_solo = true;
            vm.bookout.put_id = 0;
            vm.bookout.put = {};
            vm.bookout.payer_id = vm.bookout.pic_id || vm.bookout.payer_id;
            if(!(vm.bookout.instructor_id > 0) || vm.bookout.instructor_id == vm.bookout.pic_id){
                var me = (vm.instructors || []).find(function(i){ return i.user_id === vm.user.id; });
                if(me){
                    vm.bookout.instructor = me;
                    vm.bookout.instructor_id = me.user_id;
                } else {
                    vm.bookout.instructor = {};
                    vm.bookout.instructor_id = 0;
                }
            }
        }

        vm.this_was_instructional_claim = function(){
            //toggle as it worked
            vm.this_claim_was_instructional = !vm.this_claim_was_instructional;
            vm.complete_flight = false;
            if(vm.this_claim_was_instructional){

                vm.ignore_next_tuition_change = true;

                if(!vm.picIsInstructor()){
                    enter_student_solo_mode();
                } else {
                    //then PIC is the INSTRUCTOR
                    //vm.bookout.instructor_id = vm.bookout.pic.user_id;
                    vm.bookout.payer_id = vm.bookout.put_id;

                    if(vm.bookout.instructor_id == 0 && (vm.bookout.pic && vm.bookout.pic.user_id > 0)){
                        vm.bookout.instructor_id = vm.bookout.pic.user_id;
                    }
                }

                preselect_course_and_tuition();

            } else {
                vm.bookout.put_id = 0;
                vm.bookout.put = {};
                vm.bookout.instructor_id = 0;
                // off means off: an authorised solo left switched on made a plain hire demand an authorising instructor (owner 9 Nov)
                vm.this_was_supervised_solo = false;
                if(vm.bookout.pic_id > 0){
                    vm.bookout.payer_id = vm.bookout.pic_id;
                } else if(vm.bookout.user_id > 0) {
                    vm.bookout.payer_id = vm.bookout.user_id;
                } else {
                    //alert("It appears that no payer ID has been set yet.");
                }
            }

            vm.calculate_invoice_for_flight();

            // if(vm.complete_flight){
            //     vm.complete_this_flight();
            // }

        }


        // ── Part 2 of a split flight: quick crew switches ───────────────
        // The row already carries the crew chosen at the split (crew_mode);
        // these flip it on the form without re-picking everyone by hand.
        vm.split_prev_leg = null;
        vm.split_next_leg = null;
        vm.split_leg_student_id = function(){
            var prev = vm.split_prev_leg || {};
            return (prev.put_id > 0) ? prev.put_id : ((prev.authorised_solo == 1 && prev.pic_id > 0) ? prev.pic_id : 0);
        };
        vm.split_leg_use_solo = function(){
            var student_id = vm.split_leg_student_id();
            var student = (vm.pics || []).find(function(p){ return p.user_id === student_id; });
            if(!student){
                ToastService.warning('Student not found', 'The student from part 1 is not in the member list here — please pick the pilot in command by hand.');
                return;
            }
            vm.bookout.pic = student;
            vm.bookout.pic_id = student.user_id;
            vm.this_claim_was_instructional = true;
            enter_student_solo_mode();
            var prev_instr = (vm.instructors || []).find(function(i){ return i.user_id === vm.split_prev_leg.instructor_id; });
            if(prev_instr){
                vm.bookout.instructor = prev_instr;
                vm.bookout.instructor_id = prev_instr.user_id;
            }
            vm.bookout.authorised_solo = true;
            vm.bookout.payer_id = student.user_id;
            preselect_course_and_tuition();
            vm.calculate_invoice_for_flight();
        };
        vm.split_leg_use_same = function(){
            var prev = vm.split_prev_leg || {};
            var pic = (vm.pics || []).find(function(p){ return p.user_id === prev.pic_id; });
            var put = (vm.pics || []).find(function(p){ return p.user_id === prev.put_id; });
            var instr = (vm.instructors || []).find(function(i){ return i.user_id === prev.instructor_id; });
            vm.this_was_supervised_solo = false;
            vm.bookout.authorised_solo = false;
            if(pic){ vm.bookout.pic = pic; vm.bookout.pic_id = pic.user_id; }
            if(put){ vm.bookout.put = put; vm.bookout.put_id = put.user_id; } else { vm.bookout.put = {}; vm.bookout.put_id = 0; }
            if(instr){ vm.bookout.instructor = instr; vm.bookout.instructor_id = instr.user_id; } else { vm.bookout.instructor = {}; vm.bookout.instructor_id = 0; }
            vm.this_claim_was_instructional = (vm.bookout.put_id > 0 || vm.bookout.instructor_id > 0);
            vm.bookout.payer_id = (vm.bookout.put_id > 0) ? vm.bookout.put_id : (vm.bookout.pic_id || vm.bookout.payer_id);
            if(vm.this_claim_was_instructional){ preselect_course_and_tuition(); }
            vm.calculate_invoice_for_flight();
        };
        // Self-hire: the leg-1 student flew on alone as a licence holder — an
        // ordinary hire, no instructor, no training record (crew_mode 'hire').
        vm.split_leg_use_hire = function(){
            var student_id = vm.split_leg_student_id();
            var student = (vm.pics || []).find(function(p){ return p.user_id === student_id; });
            if(!student){
                ToastService.warning('Pilot not found', 'The pilot from part 1 is not in the member list here — please pick the pilot in command by hand.');
                return;
            }
            vm.bookout.pic = student;
            vm.bookout.pic_id = student.user_id;
            vm.this_claim_was_instructional = false;
            vm.this_was_supervised_solo = false;
            vm.bookout.authorised_solo = false;
            vm.bookout.put = {};
            vm.bookout.put_id = 0;
            vm.bookout.instructor = {};
            vm.bookout.instructor_id = 0;
            vm.bookout.course = {};
            vm.bookout.course_id = 0;
            vm.bookout.tuition_required = {};
            vm.bookout.tuition_id = 0;
            vm.bookout.payer_id = student.user_id;
            vm.calculate_invoice_for_flight();
        };
        // Which choice reflects the form right now (solo > hire > same > none)
        vm.split_leg_is_solo = function(){ return !!vm.this_was_supervised_solo; };
        vm.split_leg_is_hire = function(){
            var student_id = vm.split_leg_student_id();
            return !!(student_id > 0 && vm.bookout && vm.bookout.pic_id == student_id
                && !vm.this_claim_was_instructional && !vm.this_was_supervised_solo);
        };
        vm.split_leg_is_same = function(){
            var prev = vm.split_prev_leg || {};
            return !!(prev.pic_id > 0 && vm.bookout && vm.bookout.pic_id == prev.pic_id
                && !vm.this_was_supervised_solo && !vm.split_leg_is_hire());
        };
        vm.split_leg_student_name = function(){
            var prev = vm.split_prev_leg || {};
            if(prev.put_first_name){ return prev.put_first_name; }
            if(prev.authorised_solo == 1 && prev.pic_first_name){ return prev.pic_first_name; }
            return 'the student';
        };
        // On load: when the backend tells us which crew the split chose
        // (split_prev_leg.crew_mode / bookout crew_mode — tolerated when
        // absent), start from that choice rather than whatever the row carried.
        // The row itself already reflects 'solo' (authorised_solo + instructor)
        // and 'other' (no crew), so only a mismatch is acted on.
        function preselect_split_leg_crew(bookout){
            if(!vm.split_prev_leg){ return; }
            var prev = vm.split_prev_leg || {};
            var row = bookout || {};
            var mode = prev.crew_mode || row.crew_mode || row.split_crew_mode || '';
            if(!mode && row.tpc_split_mode == 'dual_to_solo'){ mode = 'solo'; }
            mode = String(mode).toLowerCase();
            if(mode == 'solo' && !vm.split_leg_is_solo() && vm.split_leg_student_id() > 0){
                vm.split_leg_use_solo();
            } else if(mode == 'hire' && !vm.split_leg_is_hire() && vm.split_leg_student_id() > 0){
                vm.split_leg_use_hire();
            } else if(mode == 'same' && !vm.split_leg_is_same()){
                vm.split_leg_use_same();
            }
            // 'other' / unknown: leave the row as the backend set it
        }

        // vm.convert_decimal_to_hours = function(decimal_time){
        //     var temp = new Array();
        //     temp = decimal_time.toString().split('.');
            
        //     var hours = temp[0];
        //     if(hours < 10){
        //         hours = "0"+hours;
        //     }
        //     if(temp[1]){
        //        var minutes = 100 / temp[1];
        //         minutes = Math.round(60 / minutes); 

        //         if(minutes < 10){
        //             minutes = "0"+minutes;
        //         }
        //     } else {
        //         minutes = "00"
        //     }

        //     return hours + ':' + minutes;
        // }



        $scope.applyFilter = function(model, filter) {
            if(filter){

                var pieces = filter.split(':');

                var filterName = pieces[0];

                var params = [model];

                if(pieces.length>1){
                    
                    // //console.log("hello", pieces.slice(1).join(":"));
                    if(filterName.toLowerCase() == "date"){
                       params.push( pieces.slice(1).join(":") );
                    }
                    //params = params.slice(1, -1);
                    // //console.log("contact it", params);

                } else {
                    params = params.concat(pieces.slice(1));
                }

                return $filter(filterName).apply(this,params);
            }else{
                return model;
            }
        }

        vm.add_defect = function(){


            var obj = {
                club_id: vm.bookout.club_id,
                user_id: vm.bookout.user_id,
                plane_id: vm.bookout.plane_id,
                defect: vm.defect,
                severity: vm.defect_severity.title,
                status: "open"
            }

            

        
            PlaneService.AddDefect(obj)
             .then(function (data) {
                    ////console.log("data is : ", data);
                    data.item.can_delete = true;

                   vm.reported_defects.push(data.item);

                   vm.defect = "";
                   vm.defect_severity = "";
                });

        }

        vm.delete_defect = function(id){
            //console.log("UNDO DEFECT ID ", id);

            PlaneService.DeleteDefect(id)
            .then(function (data) {
                    ////console.log("data is : ", data);
                   
                    PlaneService.GetOpenIssues(vm.bookout.plane_id)
                    .then(function (data) {
                            ////console.log("data is : ", data);
                           vm.reported_defects = data;
                        });


                });

        }

        vm.tacho_error_highlight = false;

        vm.check_tacho_bigger = function(){

         if(vm.bookout.start_tacho >= vm.bookout.end_tacho){
                    ToastService.warning('Tacho error', 'Please check start and end tacho. You cannot end on a smaller tacho.');
                    vm.tacho_error_highlight = true;
                } else {
                    vm.tacho_error_highlight = false;
                }

         }


        // ── Billing-unit helpers (§3 FRONTEND_CHARGE_TYPES_AND_TIMES_GUIDE.md) ──
        // Mirrors backend PlaneLogSheets::billable_units: whole minutes billed as decimal
        // hours, durations wrap past midnight, 00:00:00 / empty = unrecorded -> fallback.

        function is_tpc_charging(){
            return !!(vm.bookout && vm.bookout.plane_charges &&
                   (vm.bookout.plane_charges.tpc_aircraft_surchages ||
                    vm.bookout.plane_charges.charge_type == "airborne_plus_allowance"));
        }

        // Human-readable name for the invoice line title ("Aircraft <label> Charge") and
        // the book-in summary. "tacho" must stay verbatim — the view's tacho-fields gate
        // compares plane_charge_type == 'tacho'.
        function charge_type_label(charge_type){
            switch(charge_type){
                case "brakes_exact":            return "brakes off to brakes on (actual)";
                case "brakes":
                case "flight":
                case "brakes_rounded":          return "brakes off to brakes on (rounded)";
                case "airborne_actual":         return "airborne (recorded)";
                case "flight_exact":            return "takeoff to landing (actual)";
                case "airborne":
                case "flight_rounded":          return "takeoff to landing (rounded)";
                case "airborne_plus_allowance": return "airborne + taxi allowance";
                default:                        return charge_type; // tacho, hobbs
            }
        }

        function recorded_time(t){
            if(t && t.time !== undefined){ t = t.time; }
            if(!t || t === "00:00:00" || t === "00:00"){ return null; }
            return t;
        }

        function clock_hours(from, to){
            var mins = minutesBetween(from, to); // datetime.js global: nearest-minute ends, midnight wrap
            return (mins === null) ? null : (mins / 60);
        }

        function nearest_five(t){
            t = recorded_time(t);
            if(t === null){ return null; }
            var mins = minutesBetween("00:00", t);
            if(mins === null){ return null; }
            var rounded = ((mins % 5) >= 2.5) ? (Math.floor(mins / 5) * 5 + 5) : (Math.floor(mins / 5) * 5);
            rounded = rounded % (24 * 60);
            return ("0" + Math.floor(rounded / 60)).slice(-2) + ":" + ("0" + (rounded % 60)).slice(-2);
        }

        function billable_units(charge_type){
            var cf = (vm.claimed_flight && vm.claimed_flight !== null) ? vm.claimed_flight : {};
            var fu = vm.flight_units || {};

            var brakes_off = recorded_time(cf.brakes_off) || recorded_time(vm.bookout.brakes_off);
            var brakes_on  = recorded_time(cf.brakes_on)  || recorded_time(vm.bookout.brakes_on);
            var takeoff    = recorded_time(cf.takeoff_time) || recorded_time(vm.bookout.takeoff_time);
            var landing    = recorded_time(cf.landing_time) || recorded_time(vm.bookout.landing_time);
            var takeoff_r  = recorded_time(cf.takeoff_rounded) || recorded_time(vm.bookout.takeoff_rounded) || nearest_five(takeoff);
            var landing_r  = recorded_time(cf.landing_rounded) || recorded_time(vm.bookout.landing_rounded) || nearest_five(landing);

            var hours;

            switch(charge_type){

                case "brakes_exact":
                    hours = clock_hours(brakes_off, brakes_on);
                    if(hours === null){
                        console.log("brakes_exact: no recorded brakes times - using stored brakes hours");
                        hours = parseFloat(fu.brakes_to_brakes || cf.brakes_time || vm.bookout.brakes_times) || 0;
                    }
                    return hours;

                case "brakes":         // legacy alias
                case "flight":         // legacy alias - "flight time" = block time (EASA)
                case "brakes_rounded":
                    hours = parseFloat(fu.brakes_times_rounded || cf.brakes_times_rounded || vm.bookout.brakes_times_rounded);
                    if(isNaN(hours) || hours <= 0){
                        hours = clock_hours(nearest_five(brakes_off), nearest_five(brakes_on));
                    }
                    if(hours === null || isNaN(hours)){
                        console.log("brakes_rounded: no rounded data - falling back to exact brakes hours");
                        hours = parseFloat(fu.brakes_to_brakes) || 0;
                    }
                    return hours;

                case "airborne_actual":
                    hours = parseFloat(cf.airborne_time !== undefined ? cf.airborne_time : fu.airborne_times);
                    if(!isNaN(hours) && hours > 0){ return hours; }
                    hours = clock_hours(takeoff, landing);
                    return (hours === null) ? 0 : hours;

                case "flight_exact":
                    hours = clock_hours(takeoff, landing);
                    if(hours === null){
                        console.log("flight_exact: no recorded takeoff/landing - using stored airborne hours");
                        hours = parseFloat(cf.airborne_time || fu.airborne_times) || 0;
                    }
                    return hours;

                case "airborne":       // legacy alias
                case "flight_rounded":
                    hours = clock_hours(takeoff_r, landing_r); // NEVER the flight_time column (block time)
                    if(hours === null){
                        hours = parseFloat(cf.airborne_rounded || vm.bookout.airborne_rounded) || 0;
                    }
                    return hours;

                case "airborne_plus_allowance":
                    // normally handled via the TPC branch before this is called - kept for safety
                    return parseFloat(vm.bookout.tpc_flight_time) || 0;

                default:               // tacho, hobbs, empty/unknown - meter difference
                    return (vm.bookout.end_tacho - vm.bookout.start_tacho);
            }
        }

        vm.calculate_invoice_for_flight = function(){ schedule_quote(); };   // v2: debounced, latest answer wins (see computeQuote)

        // v1's calculate_invoice_for_flight, kept line for line as the LOCAL quote engine. It reads the inputs
        // snapshot only and returns the figures; apply_quote() puts the v1 fields (plane_charges, package_removed,
        // invoice_totals, send.amount) back on vm for compile_invoice() and the payment calls.
        // Not copied (backend-companion §4 Book-in): a negative landing count resetting to 1 (it is 0 here).
        function local_quote_v1(inp){
             console.log("RUN CALCULATION", inp.flight_units);
            //vm.flight_units where the units are stored
            // (free flights: quote_inputs() already zeroed the copies of the rates)
            var plane_charges_in = inp.plane_charges, tuition_charges_in = inp.tuition_charges;

            //vm.bookout.plane_cha
                // rges where th
                // console.lkogog, tpc_flight_time()e fees are stored
            var plane_units = 0;

            // §3 charging bases - one path for claimed and manual flights; billable_units
            // reads claimed-flight data first and falls back to the manually entered times (quote_inputs()).
            plane_units = inp.units;
            var flight_units_in = inp.flight_units;
            var packages_in = inp.packages;
            var package_removed = [];
            var package_used = false;

            console.log("plane units 2: ", plane_units);

            if(packages_in && packages_in.length > 0){

                for(var i=0;i<packages_in.length;i++){
                                
                    package_used = true;

                    if(inp.instructor_id && inp.instructor_id > 0){
                        //then its dual
                        if(packages_in[i].remaining_hours_dual && packages_in[i].remaining_hours_dual > 0){
                            if(plane_units < packages_in[i].remaining_hours_dual){

                                var rem = packages_in[i].remaining_hours_dual - plane_units;
                                package_removed.push({solo_dual: "dual", title: packages_in[i].title, member_packages_id: packages_in[i].id, hours_dual_before: packages_in[i].remaining_hours_dual, hours_dual_spent: plane_units, hours_dual_remaining_after: rem, hours_solo_remaining_after: packages_in[i].remaining_hours_solo, package_id: packages_in[i].package_id});
                                plane_units = 0;

                                break;
                            } else {

                                package_removed.push({solo_dual: "dual", title: packages_in[i].title, member_packages_id: packages_in[i].id, hours_dual_before: packages_in[i].remaining_hours_dual, hours_dual_spent: packages_in[i].remaining_hours_dual, hours_dual_remaining_after: 0, hours_solo_remaining_after: packages_in[i].remaining_hours_solo, package_id: packages_in[i].package_id});
                                plane_units = plane_units - packages_in[i].remaining_hours_dual;

                            }

                        }

                    } else {
                        //then its solo
                        if(packages_in[i].remaining_hours_solo && packages_in[i].remaining_hours_solo > 0){
                             if(plane_units < packages_in[i].remaining_hours_solo){

                                var rem = packages_in[i].remaining_hours_solo - plane_units;
                                package_removed.push({solo_dual: "solo", title: packages_in[i].title, member_packages_id: packages_in[i].id, hours_solo_before: packages_in[i].remaining_hours_solo, hours_solo_spent: plane_units, hours_solo_remaining_after: rem, hours_dual_remaining_after: packages_in[i].remaining_hours_dual, package_id: packages_in[i].package_id });
                                plane_units = 0;

                                break;
                            } else {

                                package_removed.push({solo_dual: "solo", title: packages_in[i].title, member_packages_id: packages_in[i].id, hours_solo_before: packages_in[i].remaining_hours_solo, hours_solo_spent: packages_in[i].remaining_hours_solo, hours_solo_remaining_after: 0, hours_dual_remaining_after: packages_in[i].remaining_hours_dual, package_id: packages_in[i].package_id });
                                plane_units = plane_units - packages_in[i].remaining_hours_solo;
                                
                            }

                        }

                    }

                }

            }    

            //console.log("charge rate: ", vm.bookout.plane_charges.charge_rate_unit);
            //console.log("plane_units: ", plane_units);
            var plane_total = (plane_charges_in.charge_rate_unit * plane_units);
            //console.log("plane_total", plane_total);



            //plane surchages::::
            var surcharge_units = 0;
            if(plane_charges_in.surcharge_type == "flight" || plane_charges_in.surcharge_type == "taxi"){
                //then the units relate to the entered numbers:
                surcharge_units = 1;
            } else if(plane_charges_in.surcharge_type !== "none") {
                //then the units are based on the plane units
                surcharge_units = plane_units;
            }

            var surcharge_total = (plane_charges_in.surcharge_fee * surcharge_units);


            //landings and touch and goes etc...
            var landing_units = Math.max(0, inp.landings | 0);
            var landings_total = (landing_units * plane_charges_in.landing_fee);

            var tg_units = Math.max(0, inp.tng | 0);
            var tng_total = (tg_units * plane_charges_in.touch_and_go_fee);

            var tuition_charge_type = "none";
            var tuition_price = 0;
            var tuition_total = 0;
            var tuition_units = 0;

            if(!packages_in || packages_in.length == 0 || plane_units > 0){


                //TUITION CHARGES
                
                if(inp.instructor_id > 0 && inp.tuition_id > 0 && tuition_charges_in){

                    tuition_charge_type = tuition_charges_in.charge_type;
                    tuition_price = tuition_charges_in.price;

                    if(tuition_charge_type == "brakes"){
                        tuition_units = flight_units_in.brakes_to_brakes;
                        tuition_charge_type = "brakes off to brakes on hours";
                    } else if(tuition_charge_type == "brakes_rounded"){
                        tuition_units = flight_units_in.brakes_times_rounded;
                        tuition_charge_type = "rounded brakes off to brakes on hours";
                    } else if(tuition_charge_type == "plane"){
                        tuition_units = plane_units;//(vm.bookout.end_tacho - vm.bookout.start_tacho);
                        tuition_charge_type = "plane units";
                    } else if(tuition_charge_type == "session"){
                        tuition_units = 1;
                        tuition_charge_type = "session";
                    }

                    tuition_total = (tuition_units * tuition_price);

                }


            }

            var total_to_remove = 0;
            var receipts = [];
            //need to process the reductions due to the receipts...
            if(inp.receipts && inp.receipts.length > 0){
                for(var i = 0;i<inp.receipts.length;i++){

                    if(inp.receipts[i].reimbursement == 1){
                        receipts.push(inp.receipts[i]);
                        total_to_remove = Number.parseFloat(Number.parseFloat(total_to_remove) + Number.parseFloat(inp.receipts[i].reimbursed_amount));
                    }

                } 
            }
            

            // //console.log("CALC HERE", total_to_remove);






            var total = (plane_total + surcharge_total + landings_total + tng_total + tuition_total - total_to_remove);
            // //console.log("plane_total plane_total", plane_total);
            // //console.log("plane_total surcharge_total", surcharge_total);
            // //console.log("plane_total landings_total", landings_total);
            // //console.log("plane_total tng_total", tng_total);
            // //console.log("plane_total tuition_total", tuition_total);
            // //console.log("plane_total total_to_remove", total_to_remove);

            var invoice_totals = inp.previous_total + total;

            var plane_charges = {
                plane_charge_type: charge_type_label(plane_charges_in.charge_type),
                plane_unit_price: plane_charges_in.charge_rate_unit,
                plane_units: plane_units,
                plane_total: plane_total,
                surcharge_charge_type: plane_charges_in.surcharge_type,
                surcharge_unit_price: plane_charges_in.surcharge_fee,
                surcharge_units: surcharge_units,
                surcharge_total: surcharge_total,
                landing_units: landing_units,
                landing_unit_price: plane_charges_in.landing_fee,
                landing_total: landings_total,
                tng_units: tg_units,
                tng_unit_price: plane_charges_in.touch_and_go_fee,
                tng_total: tng_total,
                tuition_charge_type: tuition_charge_type,
                tuition_unit_price: tuition_price,
                tuition_units: tuition_units,
                tuition_total: tuition_total,
                receipts: receipts,
                total: total
            };

            //vm.bookout.tuition_charges

            return { plane_charges: plane_charges, package_removed: package_removed, package_used: package_used, invoice_totals: invoice_totals, total: total };

        }

        vm.instructor_charges = []; 


        // vm.update_book_in_options = function(){
        //     vm.complete_flight = ( (vm.bookout.flight_type.title !== "Local" && vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) || vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) ? false : true;
        // }


        vm.complete_flight = false;
        vm.complete_this_flight = function(){



            if(vm.tacho_error_highlight){
                ToastService.highlightField('tacho_end');
                ToastService.error('Meter error', 'You cannot complete a flight where the last meter reading is greater than the start meter reading!');
                return false;
            }

            if(vm.this_was_supervised_solo && (!(vm.bookout.instructor_id > 0) || vm.bookout.instructor_id == vm.bookout.pic_id)){
                ToastService.highlightField('instructor_id');
                ToastService.warning('Authorising instructor', 'Please choose the instructor who authorised and supervised this solo flight.');
                return false;
            }

            if(vm.this_claim_was_instructional && (vm.bookout.instructor_id == 0 || vm.bookout.tuition_id == 0)){
                ToastService.highlightField('instructor_id');
                ToastService.warning('Missing details', 'You need to add an instructor and tuition type if this flight was instructional.');
                return false;
            }

            if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id == 0){
                ToastService.highlightField('tuition_id');
                ToastService.warning('Tuition required', 'Please select a tuition type for this flight.');
                return false;
            }

            if(isNaN(vm.invoice_totals)){
                ToastService.warning('Form incomplete', 'Please ensure you have filled in the form above - the current total for this invoice cannot be calculated without this.');
                return false;
            }


            // var getShort = {club_id: vm.bookout.booking.club_id,
            //     user_id: vm.bookout.booking.user_id};

            // //console.log("PASSING", getShort);
            // let's fetch some information about the user

            var club_id_confirmed = (vm.bookout.booking && vm.bookout.booking.club_id > 0)? vm.bookout.booking.club_id : vm.bookout.club_id;
            var user_id_confirmed = (vm.bookout.booking && vm.bookout.booking.user_id > 0)? vm.bookout.booking.user_id : vm.bookout.user_id;

            MemberService.GetMandate(vm.bookout.payer_id, club_id_confirmed)
                    .then(function (data) {
                            ////console.log("data is : ", data);

                            if(data.success){
                                vm.info = data.info;
                                // The member row comes back even when there is
                                // no BACS mandate (all mandate fields null) —
                                // only offer Direct Debit when there is
                                // actually a mandate to charge.
                                vm.methods[0].visible = !!(vm.info && vm.info.account_bank);

                                vm.machine = data.machine;
                                if(vm.machine && vm.machine.success){
                                    vm.methods[3].visible = true;
                                } else {
                                    vm.methods[3].visible = false;
                                    // machine.id set but success false = the club has
                                    // a terminal but it isn't online right now.
                                    if (vm.machine && vm.machine.id) {
                                        ToastService.warning('Card machine offline', 'The club card machine is not responding — wake it up and reopen payment to use it.');
                                    }
                                }
                            } else {
                                vm.methods[0].visible = false;
                                vm.methods[3].visible = false;
                            }

                        });

            vm.cards = [];

            //NEED TO UPDATE THIS!!!!!
           var send = {
               user_id: vm.bookout.payer_id,
               club_id: club_id_confirmed,
               membership_id: 1
           }
            PaymentService.GetMemberCards(send)
            .then(function (data) {

                //console.log(data);
                vm.cards = data.cards || [];
                vm.savedCards = data.cards || [];
                vm.methods[1].visible = vm.savedCards.length > 0;
                // vm.membership_now.cards = data.cards;
                // vm.membership_now.default_card = data.default_card;

            });



            console.log("CONFIRM BOOKING IS : ", vm.bookout.booking_id);

            vm.complete_flight = true;
        }





        var compile_invoice = function(){
            // v2: the lines are the quote's — the server's figures (C4.2) — in v1's item shape; v1's own build below is
            // only used if no complete quote exists (it never posts then: Finish waits for a complete quote)
            if(vm.quote && vm.quote.complete && angular.isArray(vm.quote.lines)){ return invoice_items_from_quote(vm.quote); }
            var items = [];
            // vm.plane_charges
            //add plane costs

            if(vm.package_used && vm.package_removed && vm.package_removed.length > 0){
                for(var i=0;i<vm.package_removed.length;i++){
                    var uuint = (vm.package_removed[i].hours_dual_spent > 0) ? vm.package_removed[i].hours_dual_spent : vm.package_removed[i].hours_solo_spent;
                    items.push({package_id: vm.package_removed[i].package_id, title: "Package: "+vm.package_removed[i].title, hours: uuint, hours_type: vm.package_removed[i].solo_dual, member_packages_id: vm.package_removed[i].member_packages_id, unit_price: 0, total: 0, organise: 0});
                    
                }
            //items.push({title: "Plane "+vm.plane_charges.plane_charge_type+" Charge", unit: vm.plane_charges.plane_units, unit_price: vm.plane_charges.plane_unit_price, total: vm.plane_charges.plane_total, organise: 0});
            }

            items.push({title: "Aircraft "+vm.plane_charges.plane_charge_type+" Charge", unit: vm.plane_charges.plane_units, unit_price: vm.plane_charges.plane_unit_price, total: vm.plane_charges.plane_total, organise: 0});
            if(vm.plane_charges.surcharge_total > 0){
                items.push({title: "Surcharge per "+vm.plane_charges.surcharge_charge_type, unit: vm.plane_charges.surcharge_units, unit_price: vm.plane_charges.surcharge_unit_price, total: vm.plane_charges.surcharge_total, organise: 1});
            }
            if(vm.plane_charges.tuition_total > 0){
                items.push({title: "Tuition Charge - "+vm.bookout.tuition_required.title, unit: vm.plane_charges.tuition_units, unit_price: vm.plane_charges.tuition_unit_price, total: vm.plane_charges.tuition_total, organise: 2});
            }
            if(vm.plane_charges.landing_total > 0){
                items.push({title: "Home Landing", unit: vm.plane_charges.landing_units, unit_price: vm.plane_charges.landing_unit_price, total: vm.plane_charges.landing_total, organise: 4});
            }
            if(vm.plane_charges.tng_total > 0){
                items.push({title: "Home Touch and Go", unit: vm.plane_charges.tng_units, unit_price: vm.plane_charges.tng_unit_price, total: vm.plane_charges.tng_total, organise: 3});
            }
           

            //RENTAL ITEMS !? --> make it free for now...

            for(var i=0;i<vm.plane_charges.receipts.length;i++){
                var org = parseInt(5 + i)
                var rc = vm.plane_charges.receipts[i], rc_amount = Number.parseFloat(rc.reimbursed_amount) || 0, rc_qty = Number.parseFloat(rc.quantity) || 0;
                items.push({title: "Reimbursement - "+rc.item, unit: rc.quantity, unit_price: (rc_qty > 0 ? (rc_amount / rc_qty) : rc_amount), total: -rc_amount, organise: org});
            }

            return items;
        }



        vm.get_package_html = function(pack_obj){
            var used_on = "";
            for(var i=0;i<pack_obj.aircraft.length;i++){
                used_on = used_on + " " + pack_obj.aircraft[i].registration +" ("+ pack_obj.aircraft[i].plane_type +") <br />";
            }
            var text = "";
            if(pack_obj.validity == 0){
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package does not expire <br /> To be used on:<br />";
            } else {
               text = "Package purchased on: "+moment(pack_obj.created_at).format("D MMM Y")+"<br /> Package expires on: "+ moment(pack_obj.created_at).add(pack_obj.validity, "days").format("D MMM Y") +" <br /> To be used on:<br />";
            }
    
            return text+used_on;

        }


        vm.convert_decimal_to_hours = function(number){
            
            var sign = (number >= 0) ? 1 : -1;

            // Set positive value of number of sign negative
            number = number * sign;

            // Separate the int from the decimal part
            var hour = Math.floor(number);
            var decpart = number - hour;

            var min = 1 / 60;
            // Round to nearest minute
            decpart = min * Math.round(decpart / min);

            var minute = Math.floor(decpart * 60) + '';

            // Add padding if need
            if (minute.length < 2) {
            minute = '0' + minute; 
            }

            // Add Sign in final result
            sign = sign == 1 ? '' : '-';

            // Concate hours and minutes
            var time = sign + hour + ':' + minute;

            return time;

        }




        //complete the booking back in
        vm.book_in_flight = function(where_to = "home", payment = "none", paymentIntent = "", v2opts = null){
            vm.show_loading = true;

            //need to make sure that this is not the instructor paying for the flight..... 
            //If the instructor / management fills in these details, we want to make sure that the actual user gets charged.
            // console.log("vm.this_pls_id_raw", vm.this_pls_id_raw);
            // console.log("vm.bookout.booking_id 1 - ", vm.bookout.booking_id);



            // //to generate the payment side::::
            // vm.plane_charges
            // vm.payment_card 
            // vm.user.id


            // //defects already reported
            // //receipts already reported

            // //need to check / update::: 
            // detail_type_id
            // from_airport_id
            // to_airport_id
            // //if from_airport_id == to_airport_id ==> detail_type_id = 1 (local)


            // pic_id
            // tacho_start
            // tacho_end
            // brakes_off
            // brakes_on
            // //need to total the added receipts's quantities
            // oil_uplift_litres
            // fuel_uplift_litres

            // full_stop_landings
            // touch_and_go 

            // booked_in = 1
            // flight_date = today


            // dual_flight - mention
            // var dual_flight = (vm.bookout.pic_id !== vm.bookout.user_id)? 1 : 0;


            // var from_airfield = (vm.bookout.)

            

            //
            var flag_flight = false;

            //need to check that the start tacho has not been altered ==> otherwise we need to flag this....
            var oil = 0;
            var fuel = 0;
            for(var i=0;i<vm.lubricant_receipts.length;i++){
                if(vm.lubricant_receipts[i].item == "Fuel"){
                    fuel = Number.parseFloat(fuel) + Number.parseFloat(vm.lubricant_receipts[i].quantity);
                } else {
                    oil = Number.parseFloat(oil) + Number.parseFloat(vm.lubricant_receipts[i].quantity);
                }
            }


            //landings
            var total_landings = (parseInt(vm.bookout.landings, 10) || 0) + (parseInt(vm.bookout.tng, 10) || 0) + (parseInt(vm.bookout.remote_landings, 10) || 0);
            if(total_landings < 1){
                // v2: "I didn't land" is acknowledged on the page (was confirm())
                if(vm.bk.noLand){
                    flag_flight = true;
                    //repositioning on airfield, maybe?
                } else {
                    vm.show_loading = false;
                    vm.bk_block('land');
                    return false;
                }
            }

            //only if we charge by tacho - surely?
            //if start tacho was not start tacho....
            if(vm.bookout.plane_charges.charge_type == "tacho" || vm.bookout.plane_charges.charge_type == "hobbs"){
                if(Number.parseFloat(vm.start_tacho_orig) !== Number.parseFloat(vm.bookout.start_tacho)){
                   // v2: "Yes, the start reading is …" is acknowledged on the page (was confirm())
                   if(vm.bk.startAck){
                        flag_flight = true;
                    } else {
                        vm.show_loading = false;
                        vm.bk_block('meters');
                        return false;
                    } 
                }
            }




            // WHEN A USER ENTERS A NEW AIRFIELD / STRIP INTO THE SYSTEM ::: 
            // the vm.bookout.from_airfield.id = 0 
            // OR
            // vm.bookout.to_airfield.id = 0
            // we need a switchcase to add the airport details in the send if a number is not already in there
            // then if the ID = 0, and the new_from_airport is filled in, we add it to the DB before we add the logbook entry
            // then we flag that entry as "NEW AIRFIELD --> PLEASE VERIFY THE ENTRY for an admin to double check"
            // should be straight forward entry 

            // then once this is complete - we need to look at the problem with empty brakes time / estimated flight time
            // then we need to look at the logbooks --> separate the Engine, Prop, Airframe logbooks, and keep a separate tab on there


            var is_dual_flight = 0;
            if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id > 0){
                is_dual_flight = 1;
            }

            if(is_dual_flight == 0 && vm.put_id > 0 && vm.pic_id !== vm.put_id){
                is_dual_flight = 1;
            } else if(is_dual_flight == 0 && vm.put_id > 0){
                is_dual_flight = 1;
            }

            var authorised_solo = 0;
            var authorised_by = 0;
            if(vm.this_was_supervised_solo){
                authorised_solo = 1;
                is_dual_flight = 0;   // the student flew alone — PIC time, never dual
                if(vm.bookout.instructor && vm.bookout.instructor.user_id){
                    authorised_by = vm.bookout.instructor.user_id;
                } else if(vm.bookout.instructor_id > 0){
                    authorised_by = vm.bookout.instructor_id;
                }
            }

            //must be a claimed flight
            var bookout_user_id = vm.bookout.user_id;
            if(!bookout_user_id || bookout_user_id == 0){
                bookout_user_id = vm.bookout.payer_id;
            }

            var bookout_instructor_id = vm.bookout.instructor_id;
            // Only a DUAL flight with no explicit instructor defaults the instructor
            // to the PIC. The old condition was `!x || (x == 0 && dual && pic)` —
            // operator precedence made every self-hire carry its pilot as "instructor".
            if((!bookout_instructor_id || bookout_instructor_id == 0) && is_dual_flight == 1 && vm.bookout.pic_id > 0){
                bookout_instructor_id = vm.bookout.pic_id;
            }
            if(is_dual_flight != 1 && !vm.this_was_supervised_solo && !vm.bookout.authorised_solo){
                bookout_instructor_id = 0;   // plain hire / P1: nobody instructed
            }



            var put_id = vm.bookout.put_id;
            if(put_id == 0 && is_dual_flight == 1){
                put_id = vm.bookout.payer_id;
            }
            if(authorised_solo == 1 && vm.bookout.pic_id > 0){
                // student solo: the PIC is also the student the training record belongs to
                // (backend logbook capacity stays PIC when put_id == pic_id / authorised_solo)
                put_id = vm.bookout.pic_id;
            }

            var pic_id = vm.bookout.pic_id;
            if(pic_id == 0 && is_dual_flight == 0){
                pic_id = vm.bookout.payer_id;
            }
            if(pic_id == 0 && vm.bookout.payer_id > 0 && bookout_instructor_id == 0){
                pic_id = vm.bookout.payer_id;
            }

            var to_airport_id = (vm.bookout.flight_type.id == 1)? vm.bookout.from_airfield.id : vm.bookout.to_airfield.id;

            if(is_dual_flight == 1 && bookout_instructor_id < 1){
                //instructor wasn't set above...
                console.log("did we forget to set the FI?");
            }

            var pay_with = {method: {}, method_name: ""};

            // if(payment == '' || payment == 'none'){
            //     // alert('unset payment method');
            // } else if(payment == 'cc'){
            //     // alert('pay by card');
            //     pay_with.method = vm.payment_card;
            //     pay_with.method_name = "stripe";
            // } else if (payment == 'dd'){
            //     // alert('pay by direct debit');
            //     pay_with.method = vm.info;
            //     pay_with.method_name = "gocardless";
            // } else if (payment == 'cm'){
            //     // alert('pay by card machine');
            //     pay_with.method_name = "cardmachine";
            // } else {
            //     alert('not sure on payment method');
            // }


           

            // console.log("PAY WITH : ", pay_with);
           // return false;


            var obj = {
                user_id: bookout_user_id,
                club_id: vm.bookout.club_id,
                plane_id: vm.bookout.plane_id,
                instructor_id: bookout_instructor_id,
                booking_id: vm.bookout.booking_id,
                payer_id: vm.bookout.payer_id,
                // top-level only: the backend's pilot gate reads it from the request and strips
                // it; inside plane_log_sheet every key becomes an UPDATE column (no such column).
                authorising_instructor_id: authorised_by,
                plane_log_sheet: {
                    dual_flight: is_dual_flight,
                    authorised_solo: authorised_solo,
                    authorised_by: authorised_by,
                    // The backend derives the sheet's / created booking's instructor from
                    // plane_log_sheet.instructor_id, falling back to "PIC when a different PUT
                    // exists" — which is 0 for an authorised solo (PIC == student). Send it so
                    // the authorising FI gets the flight in their debrief queue.
                    instructor_id: bookout_instructor_id,
                    tuition_id: vm.bookout.tuition_id,
                    course_id: vm.bookout.course_id,
                    club_id: vm.bookout.club_id,
                    plane_id: vm.bookout.plane_id,
                    pic_id: pic_id,
                    put_id: put_id,
                    user_id: bookout_user_id,
                    payer_id: vm.bookout.payer_id,
                    detail_type_id: vm.bookout.flight_type.id,
                    from_airport_id: vm.bookout.from_airfield.id,
                    to_airport_id: to_airport_id,
                    tacho_start: vm.bookout.start_tacho,
                    tacho_end: vm.bookout.end_tacho,
                    brakes_off: vm.bookout.brakes_off.time,
                    brakes_on: vm.bookout.brakes_on.time,
                    oil_uplift_litres: oil,
                    fuel_uplift_litres: fuel,
                    full_stop_landings: vm.bookout.landings,
                    touch_and_go: vm.bookout.tng,
                    remote_landings: vm.bookout.remote_landings,
                    booked_in: 1,
                    original_id: vm.this_pls_id_raw.id,
                    booked_in_by: vm.user.id //,
                    // authorised_solo: (vm.bookout.authorised_solo)? true : false
                },
                invoice: compile_invoice(),
                paying_now: vm.complete_flight,
                pay_with: pay_with,
                free_flight: vm.free_flight,
                paymentIntent: paymentIntent,
                // card_id: (vm.complete_flight && !vm.free_flight && !vm.can_authorise && vm.payment_card.id > 0)? vm.payment_card.id : 0,
                flag_flight: flag_flight
            };



            if(payment == "new-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "saved-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "direct-debit"){
                //nothing to add - it should just work...
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "card-machine"){
                //nothing here at the moment?
                obj.paymentIntent = paymentIntent;
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            } else if(payment == "free"){
                obj.method = payment;
                obj.pay_with.method = payment;
                obj.pay_with.method_name = payment;
            }

            //otherwise leave default




            if(to_airport_id == 0){
                obj.plane_log_sheet.new_to_airport = vm.bookout.to_airfield;
                obj.plane_log_sheet.new_to_airport.title = obj.plane_log_sheet.new_to_airport.title.replace("NOT LISTED : ", "");
            }

            if(vm.bookout.from_airfield.id == 0){
                obj.plane_log_sheet.new_from_airport = vm.bookout.from_airfield;
                obj.plane_log_sheet.new_from_airport.title = obj.plane_log_sheet.new_from_airport.title.replace("NOT LISTED : ", "");
            }    

            


            //we need to add some items if this links to a FOX AVIONIX FLIGHT LOG
            obj.plane_log_sheet.fox_log_id = vm.bookout.fox_log_id;
            obj.plane_log_sheet.fox_claimed = 1;

            obj.plane_log_sheet.takeoff_time = vm.bookout.takeoff_time;
            obj.plane_log_sheet.landing_time = vm.bookout.landing_time;

            if(vm.has_used_claimed_flight && vm.claimed_flight && vm.claimed_flight.takeoff_time && vm.claimed_flight.takeoff_time !== ""){
                obj.plane_log_sheet.takeoff_time = vm.claimed_flight.takeoff_time;
                obj.plane_log_sheet.landing_time = vm.claimed_flight.landing_time;

                obj.plane_log_sheet.landing_rounded = vm.claimed_flight.landing_rounded;
                obj.plane_log_sheet.takeoff_rounded = vm.claimed_flight.takeoff_rounded;
            }
            // console.log("TAKEOFF TIME 1 : ", obj.plane_log_sheet.takeoff_time);
            // console.log("TAKEOFF TIME 1 : ", vm.bookout.takeoff_time);
            // console.log("CLAIMED: ", vm.claimed_flight);

            
            
            // console.log("TAKEOFF TIME 2 : ", obj.plane_log_sheet.takeoff_time);

            // brakes_time / airborne_time are computed server-side at complete_book_in
            // (§6 FRONTEND_CHARGE_TYPES_AND_TIMES_GUIDE.md) - the backend ignores client values.


            //THIS IS THE KEY HERE delete this one once selected / complete
            obj.plane_log_sheet.claimed_fox_plane_log_sheet_id = vm.claimed_flight.id;

            if(vm.split_flight && vm.split_one){
                obj.plane_log_sheet.brakes_off_rounded = vm.split_one.brakes_off_rounded;
                obj.plane_log_sheet.brakes_on_rounded = vm.split_one.brakes_on_rounded;
                obj.plane_log_sheet.takeoff_time = vm.split_one.takeoff_time;
                obj.plane_log_sheet.landing_time = vm.split_one.landing_time;
                obj.plane_log_sheet.takeoff_rounded = vm.split_one.takeoff_rounded;
                obj.plane_log_sheet.landing_rounded = vm.split_one.landing_rounded;
                obj.plane_log_sheet.airborne_rounded = vm.split_one.airborne_rounded;
                obj.plane_log_sheet.brakes_times_rounded = vm.split_one.brakes_times_rounded;
                obj.plane_log_sheet.flight_time = vm.split_one.flight_time;
                obj.plane_log_sheet.flight_time = vm.split_one.flight_time;
            }

            if(vm.split_flight == 1 && vm.split_two && vm.split_two !== ""){

                //if there was a split - this is where we sort out the magic to go with it!
                console.log("vm.bookout.booking_id ", vm.bookout.booking_id);
                console.log("vm.split_two.booking ", vm.split_two.booking);
                delete vm.split_two.booking;
                delete vm.split_two.passengers;
                delete vm.split_two.from_airport;
                delete vm.split_two.to_airport;
                delete vm.split_two.plane_charges;
                delete vm.split_two.tuition_charges;
                delete vm.split_two.tuition_required;
                delete vm.split_two.pilot_in_command;
                delete vm.split_two.home_airport_id;
                delete vm.split_two.aircraft;
                delete vm.split_two.stops;
                delete vm.split_two.user;
                delete vm.split_two.last_tacho;
                delete vm.split_two.instructor;
                delete vm.split_two.id;

                // if there was an update of the destination on the book-in
                // and the flight was split - then they must start from that point 
                //on the next flight (hopefully anyway!!)

                if(to_airport_id > 0 && to_airport_id !== vm.split_two.from_airport_id){
                    vm.split_two.from_airport_id = to_airport_id;
                }
                //we didn't de-construct this - hence why this is not needed.
                // vm.split_two.brakes_on = vm.split_two.brakes_on.time;
                // vm.split_two.brakes_off = vm.split_two.brakes_off.time;

                if(vm.split_two && vm.split_two.brakes_on && vm.split_two.brakes_on.time){
                    vm.split_two.brakes_on = vm.split_two.brakes_on.time;
                }
                if(vm.split_two && vm.split_two.brakes_off && vm.split_two.brakes_off.time){
                    vm.split_two.brakes_off = vm.split_two.brakes_off.time;
                }
                if(vm.split_two){
                    vm.split_two.is_split_flight = 1;
                }

                if(vm.split_two && obj.plane_log_sheet.booking_id && obj.plane_log_sheet.booking_id > 0){
                    vm.split_two.booking_id = obj.plane_log_sheet.booking_id;
                }
                // who flew part 2 — same crew / student solo / somebody else
                // (FRONTEND_SPLIT_FLIGHT_SECOND_LEG_GUIDE.md)
                if(vm.split_two){
                    vm.split_two.crew_mode = vm.split_crew_mode || 'same';
                }
               

                obj.plane_log_sheet.split_two = vm.split_two;

                obj.plane_log_sheet.is_split_flight = 1;

            }
            
           

            //IF THIS IS THE COMPLETION OF THE SPLIT FLIGHTS
            if(vm.is_split_flight && vm.is_split_flight == 1 && vm.split_flight == 0){
                //chances are this is when it is complete??
                //vm.is_split_complete = 1;
                obj.plane_log_sheet.is_split_complete = 1;

            }

            // console.log("is_split_flight : ", vm.is_split_flight);
            // console.log("split_flight : ", vm.split_flight);
            // console.log("obj pls ", obj.plane_log_sheet);
            // return false;


            if(obj && obj.plane_log_sheet && obj.plane_log_sheet.takeoff_time && obj.plane_log_sheet.takeoff_time.time && obj.plane_log_sheet.takeoff_time.time !== ""){
                obj.plane_log_sheet.takeoff_time = obj.plane_log_sheet.takeoff_time.time;
            }

            if(obj && obj.plane_log_sheet && obj.plane_log_sheet.landing_time && obj.plane_log_sheet.landing_time.time && obj.plane_log_sheet.landing_time.time !== ""){
                obj.plane_log_sheet.landing_time = obj.plane_log_sheet.landing_time.time;
            }
            

             // console.log("TO BE SENDING : ", obj);
             // console.log("where_to : ", where_to);
             // console.log("TO BE SENDING : ", obj);

            // console.log(obj);
            // return false;

            //return false;
            //vm.bookout.id is actually a plane_log_sheet_id ??? 

            // v2: the commit (C4.3) sends this body as its `book_in` — build it, don't send it
            if(v2opts && v2opts.buildOnly){ vm.show_loading = false; return obj; }

            return BookoutService.BookInFlight(vm.bookout.id, obj)
            .then(function(data){
                ////console.log("SENT - ", data);

                vm.after_where_to = where_to;
                vm.after_data = data;
                

                //STOPPPPP
                            //return false;
                //vm.show_loading = false;
                
                if(data.success){
                    console.log("paymentID", vm.paymentID);
                    if(data.paymentID){
                        vm.payment_id = data.paymentID;
                        vm.paymentID = data.paymentID;
                    }

                    if(pay_with.method_name == "cardmachine"){
                        console.log("paymentID 1", vm.paymentID);
                        console.log("paymentID 2", data.paymentID);

                        vm.show_cardmachine = true;
                      
                        poll_check_payment(data.paymentID, 30, function(result) {
                            if (result) {
                                //alert("Payment confirmed!");
                                vm.stop_polling = true;
                                 vm.show_loading = false;
                                after_success_bookin(where_to, data);
                            } else {
                                //alert("Payment not confirmed - please try again");
                                 vm.show_loading = false;
                            }
                        });
                        console.log("check_payment ", check_payment);
                       


                    } else {
                         vm.show_loading = false;
                        vm.stop_polling = true;
                        if(v2opts && v2opts.onSaved){
                            v2opts.onSaved(data, where_to);     // v2 card machine: booked in, now the reader (booking_id)
                        } else {
                            after_success_bookin(where_to, data);
                        }
                    }

                
                } else {

                    if(pay_with.method_name == "stripe" && data.card_processor){
                        //we need to show the 3DS secondary auth
                        // alert("Your card processor requires authentication");
                        console.log("BEFORE STRIPE = ", data);

                      // Initialize Stripe.js with this club's per-club publishable key
                      PaymentService.GetClubStripeKey(vm.club_id).then(function(stripeKey){
                        var stripe = Stripe(stripeKey);
                        stripe.confirmCardPayment(
                          data.client_secret,
                          {
                            payment_method: data.payment_method,
                            return_url: data.card_url.return_url
                          },
                          // Disable the default next action handling.
                          // {handleActions: false}
                        ).then(function(result) {
                          // Handle result.error or result.paymentIntent
                          // More details in Step 2.
                          console.log(result);
                         
                          if(result.error) {
                            console.error(result.error);
                            if(result.error.code == "payment_intent_authentication_failure"){
                                //alert("You have failed to pass your card issuer's authentication - please try again or pay with another payment method.");
                                vm.show_loading = false;
                                after_success_bookin(where_to, data);
                            }
                          } else if(result.paymentIntent.status === 'succeeded') {
                            console.log('Payment successful!');
                            //we need to let the server know the payment was successful so it can be entered into the transaction list
                            BookoutService.CheckPayment(data.paymentID)
                                .then(function(data){
                                    if(data.success){
                                       
                                        vm.show_loading = false;
                                        after_success_bookin(where_to, data);
                                        
                                    } else {
                                       // alert("We encountered an error - this invoice will be visible in your invoices for completion");
                                        console.log("NOTHING SENT?");
                                        vm.show_loading = false;
                                    }
                                });

                            

                          } else {
                            console.log("not sure what happened");
                             vm.show_loading = false;
                          }


                        });
                      }).catch(function(err){
                        // No usable publishable key for this club, or Stripe.js
                        // never loaded (CDN blocked) — can't complete 3DS.
                        vm.show_loading = false;
                        if(err && err.code === 'stripe_js_unavailable'){
                            ToastService.error('Card form not loaded', "We couldn't load the secure card form. Your network or a browser extension may be blocking js.stripe.com — please allow it and try again.");
                        } else {
                            ToastService.error('Card payments unavailable', "Card payments aren't set up for this club yet. Please contact the club or try another payment method.");
                        }
                      }); // end GetClubStripeKey().then for booking 3DS auth


                    } else if(data.error && BOOK_IN_REFUSALS[data.error]){

                        // refused before anything was saved (§16.2) — this used to fall into
                        // the card-machine branch below
                        ToastService.warning(BOOK_IN_REFUSALS[data.error], (typeof data.message === 'string' && data.message) || 'This flight could not be booked in.');
                        vm.show_loading = false;

                    } else if(data.error){

                        // v2: v1 labelled every data.error "Card Machine Error" whatever the method; the v2 card
                        // machine starts only after the flight is saved, so this is a plain refusal
                        ToastService.error('Not booked in', (typeof data.message === 'string' && data.message) || 'The flight could not be booked in.');
                         vm.show_loading = false;

                    } else {
                        // v2: no "[object Object]" — the server's words when it sent some, else a plain sentence
                        ToastService.error('Not booked in', (typeof data.message === 'string' && data.message && !(data.status >= 500)) ? data.message : 'The server didn\'t answer — nothing was saved or charged. Try again in a moment.');
                         vm.show_loading = false;
                    }

                    // //console.log(data);
                }
            });

        }

        vm.close_machine_popup = function(){

            //clear the card machine and close the popup??

            //at this point the flight probably has already been booked back in... lets consider how to give options for payment
             BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                if(data.success){
                    console.log("machine should be clear now?", data);
                    vm.show_cardmachine = false;
                    vm.show_after_bookedin = true;

                } else {
                    console.log("No success on card machine clear");
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_cardmachine = false;
                    vm.show_after_bookedin = true;
                }
            });



            // vm.show_cardmachine = false;
            // vm.show_after_bookedin = true;

        }

        vm.cancel_machine = function(){

            //cancel the payment request?
            BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                if(data.success){
                    console.log("machine should be clear now?", data);
                    vm.show_cardmachine = false;
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_after_bookedin = true;
                    vm.stop_polling = true;

                } else {
                    console.log("No success on card machine clear");
                    //at this point the flight probably has already been booked back in... lets consider how to give options for payment
                    vm.show_after_bookedin = true;

                }
            });



        }

        vm.close_bookedin = function(){

            BookoutService.ClearMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                 //once cleared - we continue?
                 console.log("regardless of clear - should now be cleared?");
                 vm.show_cardmachine = false;
                 vm.show_after_bookedin = false;
                 vm.stop_polling = true;
                 after_success_bookin(vm.after_where_to, vm.after_data);
            });

        }


        vm.reset_card_machine = function(){

            console.log("retry", vm.payment_id);
            //try to send the request a second time to the machine?
             BookoutService.RetryPaymentMachine(vm.payment_id, vm.club_id)
            .then(function(data){
                console.log(data);
                if(data.success){
                    ToastService.success('Payment sent', 'The card machine should hopefully be displaying the payment now');
                    //create new poll??
                    vm.stop_polling = false;
                    poll_check_payment(vm.payment_id, 30, function(result) {
                        if (result) {
                            ToastService.success('Payment confirmed', 'Payment confirmed!');
                            vm.stop_polling = true;
                            after_success_bookin(vm.after_where_to, vm.after_data);
                        } else {
                            ToastService.error('Payment failed', 'Payment not confirmed - please try again');
                        }
                    });
                } else {
                    if(data.success == false && data.message == "The payment has already been successfully made."){
                        vm.stop_polling = true;
                        after_success_bookin(vm.after_where_to, vm.after_data);
                    }
                    ToastService.error('Payment error', data.message);
                }

            });


            vm.show_cardmachine = true;

        }

        function poll_check_payment(id, maxAttempts, finalCallback) {
            var attempts = 0;

                function attempt() {
                    check_payment(id, function(success) {
                        attempts++;
                        if (success) {
                            console.log("Payment confirmed!");
                            finalCallback(true);
                        } else if (attempts >= maxAttempts) {
                            console.log("Max attempts reached, giving up.");
                            finalCallback(false);
                        } else if (vm.stop_polling) {
                            console.log("called to stop polling");
                            finalCallback(false);
                            return;
                        } else {
                            console.log("Retrying in 10000 ms...");
                            setTimeout(attempt, 10000);
                        }
                    });
                }

                attempt(); // Start polling
        }

        function get_update_on_cardmachine(payment_id, retry, limit, callback2){
            if(retry <= limit){

                check_payment(payment_id, function(result) {
                    if (result) {
                        // do something if true
                        console.log("RESPONSE FROM CHECK PAYMENT IS TRUE");
                        callback2(true);//{success: true, message: "payment checked & done"};
                    } else {
                        // do something if false
                         console.log("delay and try again?");
                    
                        setTimeout(() => {
                          console.log("Delayed for 5 second.", payment_id);
                          console.log("Delayed for 5 second.", vm.payment_id);
                          retry++;
                          callback2(get_update_on_cardmachine(payment_id, retry, limit, callback));
                        }, 10000);
                    }
                });

                // var status_card = check_payment(payment_id);
                // console.log("STATUS HERE:", status_card);
                // if(status_card){
                //     console.log("RESPONSE FROM CHECK PAYMENT IS TRUE");
                //     return true;//{success: true, message: "payment checked & done"};
                // } else {
                //     console.log("delay and try again?");
                    
                //     setTimeout(() => {
                //       console.log("Delayed for 5 second.", payment_id);
                //       console.log("Delayed for 5 second.", vm.payment_id);
                //       retry++;
                //       return get_update_on_cardmachine(payment_id, retry, limit);
                //     }, 10000);
                // }
            } else {
                console.log("over limit?");
                callback2(false);// false;//{success: false, message: "too many attempts"};
            }
        }

        function check_payment(id, callback){

            BookoutService.CheckPayment(id)
            .then(function(data){
                if(data.success){
                    console.log("check payment", data);
                    if(data.status){
                        console.log("status = true");
                         callback(true);
                    } else {
                        console.log("status = false");
                         callback(false);
                    }
                    
                } else {
                        console.log("NOTHING SENT?");
                         callback(false);
                }
            });

           // return false;

        }



        // Part 2 of a split flight was just created by this book-in: go straight
        // to it rather than the dashboard (the debrief path carries it as
        // split_next_id instead). Returns true when it navigated.
        function go_to_split_leg_if_any(data){
            var next_id = (data && data.split && data.split.plane_log_sheet_id > 0) ? data.split.plane_log_sheet_id : 0;
            if(!next_id){ return false; }
            ToastService.success('Part 1 booked in', 'Now book in the second part of the flight.');
            $state.go('dashboard.my_account.book_in', {id: next_id}, { reload: true });
            return true;
        }

        function after_success_bookin(where_to, data){
                // A zero-charge (package/free) instructional flight was sent "home"
                // and never debriefed — the record is owed regardless of payment.
                if(where_to == "home" && vm.is_instructional_completion()){
                    where_to = "debrief";
                }
                vm.bk_arrival(where_to, data);   // v2: no done step — say what happened as we leave
                if(where_to == "home"){
                        if(go_to_split_leg_if_any(data)){ return; }
                        $state.go('dashboard.my_account', {}, { reload: true });
                    } else if(where_to == "debrief") {
                        console.log("DEBRIEF!!");
                        //if((vm.user.id == vm.bookout.instructor_id) && (vm.bookout.booking_id > 0 || vm.bookout.course_id > 0)){
                        // Route to the student record/debrief when the original gate
                        // passes OR when this is an instructor completing an
                        // instructional flight (covers claimed flights, where
                        // booking_id/course_id scalars may be 0 — see
                        // vm.is_instructional_completion).
                        if(((vm.user.id == vm.bookout.instructor_id || (vm.user.id == vm.bookout.pic_id && vm.bookout.put_id > 0)) && (vm.bookout.booking_id > 0 || vm.bookout.course_id > 0))
                           || vm.is_instructional_completion() ){
                          console.log("DEBRIEF 2!!");

                          // /debriefing/:booking_id/:plane_log_sheet_id
                          //:split_next_id/:split_booking_id
                          /*
                            "plane_log_sheet_id" => $split_two_id, --> data.split.plane_log_sheet_id
                            "booking_id" => $booking_id --> data.split.booking_id
                          */
                          //
                              var booking_id = 0;
                              if(vm.bookout.booking_id < 1){
                                  booking_id = (data && data.split && data.split.booking_id) ? data.split.booking_id : 0;
                              } else {
                                  booking_id = vm.bookout.booking_id;
                              }

                            if(data.split){
                              console.log("DEBRIEF WITH DATA RESPONSE");
                              console.log(data);
                              // return false;

                                $state.go('dashboard.manage_user.debriefing', { booking_id: booking_id, plane_log_sheet_id: vm.bookout.id, split_next_id: data.split.plane_log_sheet_id, split_booking_id: data.split.booking_id }, { reload: true });
                            } else {
                              console.log("DEBRIEF without DATA RESPONSE");
                              // return false;
                                $state.go('dashboard.manage_user.debriefing', { booking_id: booking_id, plane_log_sheet_id: vm.bookout.id, split_next_id: 0, split_booking_id: 0 }, { reload: true });
                            }

                        } else {
                          console.log("DEBRIEF 3!!");
                          // return false;
                            if(go_to_split_leg_if_any(data)){ return; }
                            $state.go('dashboard.my_account', {}, { reload: true });
                        }                        

                    } else if(where_to == "split") {

                        console.log("SPLIT HERE");
                        // //console.log("BOOKING _ID "+vm.bookout.booking_id);
                        //originally here --> but we don't want this...
                       // $state.go('dashboard.my_account.bookout_with_booking', {booking_id: vm.bookout.booking_id, claim_id: vm.claim_id, split: vm.split_two}, {reload: true });

                        var booking_id = 0;
                        if(vm.bookout.booking_id < 1){
                            booking_id = data.split.booking_id;
                        } else {
                            booking_id = vm.bookout.booking_id;
                        }

                       // same gate as the plain debrief branch (claimed instructional
                       // flights have booking_id/course_id 0 but still need a record)
                       if(((vm.user.id == vm.bookout.instructor_id || (vm.user.id == vm.bookout.pic_id && vm.bookout.put_id > 0)) && (vm.bookout.booking_id > 0 || vm.bookout.course_id > 0))
                          || vm.is_instructional_completion()){
                              console.log("SPLIT AND DEBRIEF???");
                          // /debriefing/:booking_id/:plane_log_sheet_id
                              // console.log("SPLIT and success in data obj");
                              // // split_flight_id: data.split.plane_log_sheet_id, 
                              // // split_flight_booking_id: data.split.booking_id, 
                              // // split: vm.split_two
                              // console.log("data.split.plane_log_sheet_id : ", data.split.plane_log_sheet_id);
                              // console.log("data.split.booking_id : ", data.split.booking_id);
                              // console.log("split : ", vm.split_two);
                              //  return false;
                              // leg 1's record belongs to leg 1's booking (booking_id computed above), not leg 2's
                              $state.go('dashboard.manage_user.debriefing', { booking_id: booking_id, plane_log_sheet_id: vm.bookout.id, split_next_id: data.split.plane_log_sheet_id, split_booking_id: data.split.booking_id }, { reload: true });

                            // $state.go('dashboard.manage_user.debriefing', {booking_id: vm.bookout.booking_id, plane_log_sheet_id: vm.bookout.id, split_flight_id: data.split.plane_log_sheet_id, split_flight_booking_id: data.split.booking_id, split: vm.split_two }, { reload: true });
                        } else {
                              // console.log("SPLIT back to account");
                              //  return false;
                            //$state.go('dashboard.my_account', {}, { reload: true });

                            //IF THIS PERSON IS BOOKING IT IN - I THINK THEY SHOULD CONTINUE THIS TO THE END....
                            $state.go('dashboard.my_account.book_in', {id: data.split.plane_log_sheet_id}, {reload: true });

                        }


                    } else {
                       $state.go('dashboard.my_account.bookout_with_booking', {booking_id: vm.bookout.booking_id}, {reload: true });
                    }
        }

        function preselect_course_and_tuition(){

            console.log("PRESELECT TUITION NOW");


            if(vm.club_courses.length == 1){
                //preset it??
                //console.log("length is 1", vm.bookout.course_id);
                if(!vm.bookout.course_id || vm.bookout.course_id == 0){
                   vm.bookout.course_id = vm.club_courses[0].id;
                   vm.bookout.course = vm.club_courses[0];
                    //console.log("HERE?", vm.bookout.course);
                }
            }
            console.log(vm.bookout.course_id);
            console.log(vm.club_courses);
            if(vm.bookout.course_id > 0){
                var selected_course = vm.club_courses.find(item => item.id === vm.bookout.course_id);
                vm.bookout.course = selected_course;
            }

            if(vm.instructor_charges.length == 1){
                //var selected_tuition = vm.instructor_charges.find(item => item.id === vm.bookout.instruction_required_id);
                vm.bookout.tuition_required = vm.instructor_charges[0];
            }

            vm.update_tuition_charges();

        }


        vm.this_claim_was_instructional = false;
        vm.this_was_supervised_solo = false;
        vm.start_tacho_orig;
        vm.send = {};

        function tagMemberSource(members) {
            if (!members || !members.length) return members || [];
            var bsPattern = /^bs\d+@toaviate\.com$/i;
            for (var i = 0; i < members.length; i++) {
                // a plain member's list carries no e-mails — the backend flags the stub as bs_placeholder
                members[i]._isBsMember = !!(members[i].bs_placeholder == 1 || (members[i].email && bsPattern.test(members[i].email)));
            }
            return members;
        }

        function process_bookout_to_bookin(booking){

            // console.log(booking);
            //vm.bookout is where we want to fill the content....
            vm.bookout.booking_id = booking.booking_id;
            vm.bookout.club_id = booking.club_id;
            vm.bookout.user_id = booking.user_id;
            vm.bookout.plane = booking.plane;
            vm.club_id = booking.club_id;
            vm.is_split_flight = booking.is_split_flight;
            // vm.bookout.return = new Date(booking.end);
            // vm.bookout.booking_start = new Date(booking.start);
            
            // vm.this_pls_id_raw = vm.bookout.id;
            //vm.this_pls_id_raw = Object.assign({}, booking);

            vm.send = {
                club_id: vm.bookout.club_id,
                user_id: vm.user.id
                // ,
                // plane_log_sheet_id: booking.id
            }
            // console.log("booking", booking);
            // console.log("booking_id", booking.booking_id);

            /*
            VM.SEND --> TO THE PAYMENT MODAL
                if invoice --> remove booking_id add invoice_id 
                if no invoice / booking --> remove both and add amount * 100
                ie: amount: vm.invoice_totals * 100,
                user must be the user for that invoice / PAYER ID --> careful on admin functions
            */



             PlaneService.GetCurrencies(vm.club_id)
             .then(function(data){
                        vm.currencies = data.currencies;   
                        vm.club_currency = data.club_currency;

                        vm.receipt.currency = $.grep(vm.currencies, function(e){ 
                            return e.iso_code == vm.club_currency; 
                        })[0];;

                });


            



             //&& vm.bookout.user_id !== vm.user.id --> if no bookout was done, this wont work
             if(((vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ) ){
                // //console.log("NOT BOOKING FOR SELF?");
                vm.can_authorise = true;

            }



            vm.invoices = [];
            vm.previous_total = 0;

            vm.free_flight = false;

            // //console.log("actual stuff = ", booking);
            //there should also be a PILOT / OWNER -> NO MONEY REQUIRED bit
            if(booking.booking && booking.booking.maintenance_flight == 1){
                // //console.log("FREE FLIGHT WOOO");
                vm.free_flight = true;
                //vm.plane_charges.total = 0;
            }



                //IF THIS IS NOT SPLIT FLIGHT??? OTHERWISE... DISASTER?
                //need to check functionality before release!!
                if(vm.is_split_flight == 1){
                    //console.log("IS SPLIT?");

                    
                    InvoicesService.GetAllByBooking(booking.booking_id)
                    .then(function (data) {
                            //console.log("invoice data is : ", data);
                            // FORBIDDEN: not on this booking and not the club's instructor / admin
                            // (BACKEND_MONEY_ACCESS_GUIDE.md §5) — say so; the invoices list stays empty
                            if(data && data.error === 'FORBIDDEN'){
                                ToastService.error('Invoices not loaded', (typeof data.message === 'string' && data.message) || "You can't see this booking's invoices.");
                            }
                            if(data.success){
                                //console.log("data", data.invoices);
                                // vm.previous_invoice = data.invoice;
                                vm.previous_invoice = data.invoices;

                                // data.invoices.forEach((invoice) => function(){
                                //     console.log("each invoice", invoice);
                                //     invoice.flights.forEach((flight) => function(){
                                //         console.log("each flight", flight);
                                //         vm.invoices.push(flight);
                                //         vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(flight.total));
                                //     });
                                // });
                                for(var i=0;i<data.invoices.length;i++){
                                     Object.keys(data.invoices[i].flights).forEach(function(key) {
                                        var flight = data.invoices[i].flights[key];
                                        //console.log(key, flight);
                                        vm.invoices.push(flight);
                                        vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(flight.total));
                                    });



                                }

                               

                                // for (var key in data.invoices.flights) {
                                //     console.log("KEY ", key);
                                //     vm.invoices.push(data.invoices.flights[key]);
                                //     vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(data.invoices.flights[key]["total"]));
                                //     // for(var i=0;i<data.invoice.flights[key].length;i++){
                                //     // }
                                // }


                                
                                
                                // console.log("invoices", vm.invoices);
                                // //console.log("FLIGHTS TOTAL", vm.previous_total);
                                // vm.invoices = data.invoice.flights;
                            } else {
                                // //console.log("no invoices have yet been issued for this flight");
                            }


                        });

                } else {
                    console.log("NOT SPLIT?");


                }

            


            PlaneService.GetOpenIssues(booking.plane_id)
            .then(function (data) {
                    ////console.log("data is : ", data);
                   vm.reported_defects = data;
                });

              PlaneService.GetAllSheetReceipts(vm.bookout.id)
                .then(function (data) {
                    ////console.log("data is : ", data);
                    vm.lubricant_receipts = data;
                });


                InstructorCharges.GetByClubId(booking.club_id)
                .then(function(data){
                    vm.instructor_charges = charges_of(data);
                });

                


                //vm.club_courses = data.items




            //we need to update the PICS now...

           
            //we need to know where the plane was last booked-in at 
            //(ie: if last flight bookout was completed - where the plane landed at last)
            //if the last booking was not yet completed, then we can assume that this last flight was returning to base.
            if((booking && booking.id > 0) || (vm.try_split)){
                console.log("PIC ID: ", booking.pic_id);
                if(vm.pics && booking.pic_id){
                    var selected_pic = vm.pics.find(item => item.user_id === booking.pic_id);
                    console.log("selected_pic : ", selected_pic);
                    vm.bookout.pic = selected_pic;
                }
                


                // //console.log("booking.detail_type_id", booking.detail_type_id);

                var selected_detail_type = vm.flight_types.find(item => item.id === booking.detail_type_id);
                vm.bookout.flight_type = selected_detail_type;

                // Resolve put_id: use put.id as fallback when put_id is 0 but the put object exists
                var effective_put_id = booking.put_id;
                if((!effective_put_id || effective_put_id == 0) && booking.put && booking.put.id > 0){
                    effective_put_id = booking.put.id;
                    vm.bookout.put_id = effective_put_id;
                }

                if(booking.instructor && booking.instructor !== "" && (booking.instructor.id == booking.pic_id || booking.instructor.user_id == booking.pic_id)){
                    // Instructor is PIC — the student (PUT) should be the user
                    if(!effective_put_id || effective_put_id == 0){
                        effective_put_id = booking.user_id;
                        vm.bookout.put_id = effective_put_id;
                    }
                    var selected_put = vm.pics.find(item => item.user_id === effective_put_id);
                    if(selected_put){
                        vm.bookout.put = selected_put;
                    } else if(booking.put && booking.put.id > 0){
                        vm.bookout.put = booking.put;
                    } else {
                        vm.bookout.put = booking.user;
                    }
                } else if(vm.pics && effective_put_id > 0){
                    var selected_put = vm.pics.find(item => item.user_id === effective_put_id);
                    console.log("selected_put : ", selected_put);
                    if(selected_put){
                        vm.bookout.put = selected_put;
                    }
                }

                vm.bookout.authorised_solo = (booking.authorised_solo == 1)? true : false;
                if(booking.authorised_solo == 1 && booking.instructor_id > 0){
                    vm.this_claim_was_instructional = true;
                    vm.this_was_supervised_solo = true;
                }


                vm.bookout.from_airfield = booking.from_airport;
                vm.bookout.to_airfield = booking.to_airport;
                
                if(booking.course_id > 0){
                    vm.bookout.course_id = booking.course_id;
                } else if(booking.booking && booking.booking.course_id && booking.booking.course_id > 0){
                    vm.bookout.course_id = booking.booking.course_id;
                }

                vm.bookout.start_tacho = Number.parseFloat(booking.last_tacho);
                
                vm.start_tacho_orig = booking.last_tacho;



               
                 //this is where we sort out some of the last bits....

                //var instructor = vm.pics.find(item => item.user_id === booking.instructor.id);
                vm.bookout.instructor = booking.instructor;
                var selected_pic = vm.pics.find(item => item.user_id === booking.pic_id);
                vm.bookout.pic = selected_pic;

                // Detect and pre-set instructional flight state from loaded bookout data
                if(booking.instructor_id > 0 && (
                    effective_put_id > 0 ||
                    booking.tuition_id > 0 ||
                    (booking.booking && booking.booking.course_id > 0) ||
                    (booking.user_id > 0 && booking.user_id !== booking.instructor_id)
                )){
                    vm.this_claim_was_instructional = true;
                }

            }





            // if(booking.instructor && booking.instructor !== "" && booking.instructor.id > 0){
            //     // then we need to set the PIC as the instructor
            //     //select from pics where user_id = booking.user_id;
            //     var selected_pic = vm.pics.find(item => item.user_id === booking.instructor.id);
            //     //set the PIC now...
            //     vm.bookout.pic = selected_pic;
            //     vm.bookout.instructor_id = booking.instructor.id;
            //     vm.bookout.instructor = booking.instructor;


            //     var selected_put = vm.pics.find(item => item.user_id === booking.user_id);
            //     vm.bookout.put = selected_put;

            // } else {
            //     //then the user is the PIC
            //     var selected_pic = vm.pics.find(item => item.user_id === booking.user_id);
            //     vm.bookout.pic = selected_pic;

            // }

       

            if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.wgs_n){
                vm.wgs_n = booking.plane_details.location.wgs_n
                vm.wgs_e = booking.plane_details.location.wgs_e;
            }
            var location_default = "";

            if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.code){
                location_default = booking.plane_details.location.code.slice(0, -1);
            } else {
                location_default = "EG";
            }

            //vm.update_book_in_options();

            BookoutService.GetAirfieldsByCode(location_default)
                .then(function (data) {
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                        // var selected_location = vm.airfields.find(item => item.id === booking.plane_details.location.id);
                        // //console.log("selected_location", selected_location);
                        // vm.bookout.from_airfield = selected_location;
                       }
                    });


            if(booking.fox_log_id && booking.fox_log_id > 0){
                vm.auto_claim = 1;
                //vm.has_used_claimed_flight = true;

                if(vm.bookout.from_airport.id == vm.bookout.to_airport.id){
                    if(vm.bookout.touch_and_go > 2){
                        // circuits 3?
                        var selected_detail_type = vm.flight_types.find(item => item.id === 3);
                        vm.bookout.flight_type = selected_detail_type;
                    } else {
                        //local flight? 1 
                        var selected_detail_type = vm.flight_types.find(item => item.id === 1);
                        vm.bookout.flight_type = selected_detail_type;
                    }

                } else {
                    var selected_detail_type = vm.flight_types.find(item => item.id === 2);
                    vm.bookout.flight_type = selected_detail_type;
                }

                vm.bookout.brakes_off = {time: vm.bookout.brakes_off};
                vm.bookout.brakes_on = {time: vm.bookout.brakes_on};

                //vm.bookout.touch_and_go = vm.bookout.touch_and_go;
                vm.bookout.tng = vm.bookout.touch_and_go;
                vm.bookout.landings = vm.bookout.full_stop_landings;
                prefill_counts_from_track(vm.bookout.id || booking.plane_log_sheet_id || $stateParams.id);

//                vm.bookout.fox_log_id = vm.claimed_flight.fox_log_id; already set
                vm.bookout.fox_claimed = 1;

                vm.has_used_claimed_flight = true;
                vm.has_requested_to_change_times = false;
                // vm.bookout.takeoff_time = vm.bookout.takeoff_time;
                // vm.bookout.landing_time = vm.bookout.landing_time;

                //THIS IS THE KEY HERE delete this one once selected / complete
                

                if(vm.claimed_flight && vm.claimed_flight.id > 0){
                    vm.bookout.claimed_fox_plane_log_sheet_id = vm.claimed_flight.id;
                }
                // (removed) claimed_fox_plane_log_sheet_id = fox_log_id — that is a
                // fox_entries id, not a log sheet id: the backend deletes the log
                // sheet with that id. A row loaded straight from Claim a Flight (or
                // part 2 of a split) IS the row being booked in; nothing to delete.




                //WHAT DOES THIS DO!?

                //set the important bits for the invoice now
                vm.flight_units.brakes_to_brakes = vm.bookout.brakes_time;
                vm.flight_units.airborne_times = vm.bookout.airborne_time;
                vm.flight_units.flight_time = vm.bookout.flight_time;
                vm.flight_units.brakes_times_rounded = vm.bookout.brakes_times_rounded;

                //calculate the invoice yay
                vm.calculate_invoice_for_flight();
                vm.flight_times_complete = true;

                // if(vm.bookout.instructor_id > 0 || vm.bookout.put_id > 0 || vm.this_was_instructional_claim || vm.this_claim_was_instructional || vm.bookout.course_id > 0){
                //    // console.log("process bookout to book in");

                //     preselect_course_and_tuition();
                // }

                //IF THE PIC is authorised to SOLO
                //OR IF THE USER IS OWNER-FLIER!!

                // we need to set the PIC as themselves automatically
                // it feels silly to have to fill it in otherwise. 



            } else { 
                if(vm.bookout.plane_charges.charge_type == "airborne" || vm.bookout.plane_charges.charge_type == "flight"){
                    vm.show_takeoff_landing_times = true;
                }
                // console.log('else');
                
            }



            CourseService.GetCoursesByClubId(booking.club_id)
                .then(function(data){
                    vm.club_courses = CourseService.sortByDisplayOrder(data.items);

                    if(vm.bookout.instructor_id > 0 || vm.bookout.put_id > 0 || vm.this_claim_was_instructional || vm.bookout.course_id > 0){
                        // console.log("process bookout to book in");
                        preselect_course_and_tuition();
                        //try_split??
                    }
                });
            //booking.plane_details.location.id
            // vm.bookout.pic = selected_pic;

            // $location.hash('top');
            // $anchorScroll();
            if(vm.scroll){
                vm.scroll = false;
                smoothScroll.toTop();
                vm.show_loading = false;
                vm.bk_loaded();
            }
            

        }


            //nice looking date pickers


            $scope.popup = [];

            $scope.open = function(id, $event) {
                // //console.log("THIS", id);
                //this comment would allow the event not to be affect by clicking it again... not sure this is a good idea
                if($scope.popup[id] && $scope.popup[id].opened == true){
                    $event.preventDefault();
                    $event.stopPropagation();
                } else {
                    $scope.popup[id] = {opened: true};
                }
            };

            $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = $scope.formats[0];

            $scope.datePickerOptions = {
                                        format: 'dd/MM/yyyy',
                                        showWeeks: false
                                    };

           

         
        


    
        /* ═══════════════════════════════════════════════════════════════════════════
           v2 BOOK IN — the view model of the approved design (mockups/my-account/book-in.html).
           Everything above is v1's BookinController, copied (v1 stays untouched; the cut-over deletes it).
           The page reads vm.bk (state), vm.quote (every money figure) and the vm.bk_* helpers below.
           ═══════════════════════════════════════════════════════════════════════════ */
        var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var SEVERITIES = [
            // the stored value (title) never changes: book-out and the aircraft pages match on it
            { key: 'nofly',  title: 'No Fly Item - Ground the plane',                    short: 'No fly',     desc: 'Ground the aircraft',              icon: 'fa-ban',             tone: 'bad' },
            { key: 'maint',  title: 'Flyable - needs to be checked at next maintenance', short: 'Flyable',    desc: 'Check at the next maintenance',    icon: 'fa-wrench',          tone: 'warn' },
            { key: 'note',   title: 'Not urgent - but needs noting',                     short: 'Not urgent', desc: 'Worth noting',                     icon: 'fa-sticky-note',     tone: 'muted' },
            { key: 'unsure', title: 'Unsure of severity',                                short: 'Unsure',     desc: 'Not sure how serious',             icon: 'fa-question-circle', tone: 'info' }
        ];
        vm.bk_severities = SEVERITIES;
        vm.bk_flight_types = [
            { id: 1, t: 'Local', i: 'fa-map-marker-alt' }, { id: 2, t: 'Departure', i: 'fa-plane-departure' },
            { id: 3, t: 'Circuits', i: 'fa-sync-alt' }, { id: 4, t: 'Other', i: 'fa-ellipsis-h' }
        ];

        vm.bk = {
            loaded: false, showErr: false, flash: null, busy: false, outcome: null,
            noLand: false, startAck: false, landEdited: false,
            defMode: null, mine: {}, delDef: null, delUp: null,
            t: { off: '', to: '', ld: '', on: '' },
            pk: null,                 // the open picker { f, q, hi, chip, limit, model }
            pick: null,               // the tracker flight highlighted in the claim panel
            dlg: null,                // 'mismatch' | 'defect' | 'machine'
            df: null,                 // the defect being reported
            up: null,                 // the add-an-uplift panel
            ready: { items: [], opt: [], left: [], total: 0, done: 0, pct: 0, all: false },
            quoteState: 'idle',       // idle | updating | ready
            m: { start: '', end: '' }
        };
        vm.quote = null;
        vm.club = null;
        vm.td = TimeDisplayService.context(null);
        vm.pay = null;                // BookinV2Payment state (the pay choice in the Finish card)
        // the runway while the flight is booked in and paid (<ta-runway> in the Finish card): saving, then the payment
        vm.bk_wait_steps = ['Saving the flight', 'Taking the payment', 'Done'];
        vm.bk_wait_step = function(){ return (vm.pay && vm.pay.busy) ? 1 : 0; };
        vm.bk_waiting = function(){ return !!(vm.bk_finish_parts().busy || (vm.pay && vm.pay.busy)); };

        /* ── leaving a half-filled book-in asks first (owner 9 Nov): the back link, browser Back, the menu and "Back to classic
              designs"; never when nothing was entered or once saved; the browser asks on reload. The snapshot follows the page
              until the pilot touches a card (so late pre-fills don't count), then what changed since is "entered". ── */
        function form_sig(){
            var b = vm.bookout || {}, t = vm.bk.t || {};
            return JSON.stringify([t.off, t.to, t.ld, t.on, vm.bk.m && vm.bk.m.start, vm.bk.m && vm.bk.m.end, b.landings, b.tng, b.remote_landings, b.flight_type && b.flight_type.id,
                b.from_airfield && b.from_airfield.id, b.to_airfield && b.to_airfield.id, vm.has_used_claimed_flight ? (vm.claimed_flight && vm.claimed_flight.id) : 0, vm.bk.defMode, vm.bk.noLand, vm.bk.startAck,
                b.pic_id, b.put_id, b.instructor_id, b.tuition_id, b.course && b.course.id, b.payer_id, vm.this_claim_was_instructional, vm.this_was_supervised_solo, vm.split_flight_confirmation]);
        }
        $scope.$watch(form_sig, function(v){ if(!vm.bk.touched){ vm.bk.snap = v; } });
        vm.bk_dirty = function(){ return !!(vm.bk.loaded && vm.bk.touched && !vm.bk.leaveOk && !vm.bk.committed && vm.bk.snap !== undefined && form_sig() !== vm.bk.snap); };
        function on_touch(ev){ if(ev.target && ev.target.closest && ev.target.closest('.bki-card, .bki-solo, .ta-pickmenu, .ta-dlg')){ vm.bk.touched = true; } }
        $timeout(function(){ var m = document.querySelector('main.bki'); if(m){ ['input', 'change', 'click'].forEach(function(e){ m.addEventListener(e, on_touch, true); }); } }, 0);
        $scope.$on('$stateChangeStart', function(ev, to, toParams){
            if(ev.defaultPrevented || !vm.bk_dirty()){ return; }
            ev.preventDefault();
            vm.bk.pk = null;
            vm.bk.leave = { to: to.name, params: angular.copy(toParams) };
            $timeout(function(){ var k = document.querySelector('[data-e2e=bki-leave-keep]'); if(k){ k.focus(); } }, 30);
        });
        vm.bk_leave_keep = function(){ vm.bk.leave = null; };   // "Back to classic designs" puts its switch back itself (DesignService)
        vm.bk_leave_go = function(){ var a = vm.bk.leave; vm.bk.leave = null; vm.bk.leaveOk = true; if(a){ $state.go(a.to, a.params); } };
        function on_unload(e){ if(vm.bk_dirty()){ e.preventDefault(); e.returnValue = ''; return ''; } }
        function on_leave_key(e){ if(vm.bk.leave && (e.key === 'Escape' || e.keyCode === 27)){ $scope.$apply(vm.bk_leave_keep); } }
        $window.addEventListener('beforeunload', on_unload);
        document.addEventListener('keydown', on_leave_key);
        $scope.$on('$destroy', function(){ $window.removeEventListener('beforeunload', on_unload); document.removeEventListener('keydown', on_leave_key); });

        vm.bk_loaded = function(){
            vm.bk.loaded = true;
            vm.bk.m.start = (vm.bookout.start_tacho === null || vm.bookout.start_tacho === undefined || isNaN(vm.bookout.start_tacho)) ? '' : String(vm.bookout.start_tacho);
            vm.bk.m.end = (vm.bookout.end_tacho === null || vm.bookout.end_tacho === undefined) ? '' : String(vm.bookout.end_tacho);
            ['landings', 'tng', 'remote_landings'].forEach(function(k){ if(vm.bookout[k] === null || vm.bookout[k] === undefined || vm.bookout[k] === ''){ vm.bookout[k] = 0; } else { vm.bookout[k] = parseInt(vm.bookout[k], 10) || 0; } });
            vm.bk.pick = (vm.claim_a_flight && vm.claim_a_flight.length) ? (best_matches()[0] || vm.claim_a_flight[0]).id : null;
            load_club(vm.bookout.club_id || vm.club_id);
            try { vm.bk.stripeReturn = sessionStorage.getItem('toaviate_bki_stripe_return') || null; sessionStorage.removeItem('toaviate_bki_stripe_return'); } catch(e){}
            schedule_quote();
        };

        function load_club(club_id){
            if(!club_id || (vm.club && vm.club.id == club_id)){ return; }
            vm.td.setClub(club_id);
            if(vm.bookout.aircraft && vm.bookout.aircraft.time_display){ vm.td.setPlane(vm.bookout.aircraft.time_display); }
            ClubService.GetById(club_id).then(function(data){
                if(!data || data.success === false){ vm.club = { id: club_id, title: '', vat_rate: 0 }; return; }
                vm.club = angular.extend(vm.club || {}, { id: club_id, title: String(data.title || '').trim() });
                if(!vm.ctx){ vm.club.vat_registered = data.vat_registered == 1; vm.club.vat_rate = (data.vat_registered == 1 && parseFloat(data.vat_rate) > 0) ? parseFloat(data.vat_rate) : 0; }
                schedule_quote();
            });
        }

        /* ═════ money: computeQuote(inputs) is the ONE place a figure is worked out ═════
           It returns exactly what be-alex-3e C4.2 (POST plane_log_sheets/v2/book_in/{pls}/quote) will return:
             { quote_hash, complete, missing[], units{basis,hours,billed_from,billed_to,label},
               lines[{key,title,detail,units,unit_price,amount,kind,rule}], packages_used[{member_package_id,title,hours_type,hours,remaining_after}],
               flight_total, previous_legs_total, booking_total, vat{registered,rate,included}, currency, free, warnings[] }
           key: aircraft | package | surcharge | tuition | landing | touch_and_go | reimbursement; kind: charge | included | credit | no_charge;
           every amount is gross and rounded to the penny, and the lines add up to flight_total (C4 "intentional differences" 1–3).
           It asks the server (C4.2, landed 19:28); v1's maths in the page (local_quote_v1 → shape_quote) is only the fallback
           when the quote route doesn't answer. The call site is async-ready: 200 ms debounce, the latest answer wins, the last figures stay on
           screen with vm.bk.quoteState = 'updating', and paying waits for a fresh, complete quote (vm.bk_fresh_quote()). */
        function computeQuote(inputs){
            var body = angular.copy(inputs); delete body._local;
            if(vm.ctx && vm.ctx.context_hash){ body.context_hash = vm.ctx.context_hash; }
            return BookinV2Data.Quote(vm.bookout.id, body).then(function(data){
                if(data && data.success){
                    // a stale context_hash is no error: the quote is worked out on the current context, which comes with it
                    if(data.context_changed && data.context){ set_context(data.context); }
                    var q = angular.copy(data); delete q.context; delete q.success;
                    q.source = 'server';
                    q.lines = q.lines || []; q.packages_used = q.packages_used || []; q.missing = q.missing || [];
                    q.units = q.units || { basis: null, hours: null, billed_from: null, billed_to: null, label: '' };
                    q.vat = q.vat || { registered: false, rate: 0, included: 0 };
                    return q;
                }
                // the server or the network failed: say so, with a way to ask again (finishing needs the server's quote anyway)
                if(!data || data.status === 0 || data.status >= 500){
                    return { source: 'server', complete: false, error: 'UNAVAILABLE', message: 'The server didn\'t answer. Check your connection, then try again.', missing: [], fields: [],
                             units: { basis: null, hours: null }, lines: [], packages_used: [], flight_total: NaN, previous_legs_total: 0, booking_total: NaN,
                             vat: { registered: false, rate: 0, included: 0 }, currency: vm.club_currency || 'GBP', free: !!vm.free_flight, warnings: [] };
                }
                // the route isn't deployed here: v1's maths in the page, said so (never a blank charges card)
                if(data.status === 404){
                    var local = shape_quote(inputs, local_quote_v1(inputs._local));
                    local.warnings = ['The charges were worked out in the page: the server\'s quote didn\'t answer.'];
                    return local;
                }
                var code = data.error || (data.message && data.message.error) || null;
                var msg = (typeof data.message === 'string' && data.message) || (data.message && data.message.message) || '';
                if(code === 'ALREADY_BOOKED_IN'){ ToastService.warning('Already booked in', msg || 'This flight has already been booked in.'); }
                else if(code === 'NOT_FOUND'){ ToastService.warning('Flight not found', msg || 'This flight could not be found.'); }
                if(code === 'BOOKING_NOT_LINKABLE'){   // C26: the booking can't take it — say so and price the flight on its own
                    vm.bk.link = { booking_id: vm.bk.link && vm.bk.link.booking_id, ok: false, error: code, message: msg };
                    $timeout(schedule_quote, 0);
                }
                var fields = data.fields || (data.message && data.message.fields) || [];
                return { source: 'server', complete: false, error: code || 'QUOTE_FAILED', message: msg, missing: fields, fields: fields,
                         units: { basis: null, hours: null }, lines: [], packages_used: [], flight_total: NaN, previous_legs_total: 0, booking_total: NaN,
                         vat: { registered: false, rate: 0, included: 0 }, currency: vm.club_currency || 'GBP', free: !!vm.free_flight, warnings: [] };
            });
        }

        // C4.1: once on load, again when the crew or the claimed flight changes
        vm.ctx = null;
        // C26 ("looks like yours"): a bookingless tracker sheet booked in on the member's own booking (?booking_id from the claim page)
        function link_booking_id(){
            if(vm.bk.link && vm.bk.link.ok === false){ return 0; }   // refused once: carry on without it
            var id = parseInt($stateParams.booking_id, 10);
            return (id > 0 && !(vm.bookout && vm.bookout.booking_id > 0)) ? id : 0;
        }
        vm.bk_linked = function(){ return !!(vm.bk.link && vm.bk.link.ok); };
        vm.bk_link_when = function(){
            var b = vm.ctx && vm.ctx.booking; if(!b || !b.start){ return ''; }
            return fday(b.start) + ' ' + String(b.start).slice(11, 16) + '–' + String(b.end || '').slice(11, 16);
        };
        function apply_link(ctx){
            if(!ctx.link){ return; }
            var first = !vm.bk.link;
            vm.bk.link = ctx.link;
            if(!ctx.link.ok || !first){ return; }
            if(!(vm.pics && vm.pics.length)){ link_pending = ctx; return; }   // the people list isn't in yet: pre-fill when it is
            prefill_from_link(ctx);
        }
        var link_pending = null;
        $scope.$watch(function(){ return (vm.pics || []).length; }, function(n){ if(n && link_pending){ var c = link_pending; link_pending = null; prefill_from_link(c); } });
        function prefill_from_link(ctx){
            // the booking's pilot / instructor pre-fill (the server worked the context out as if the sheet had that booking)
            var sh = ctx.sheet || {}, b = vm.bookout;
            var setp = function(key, id){ var p = person_of(id); if(p){ b[key] = p; b[key + '_id'] = p.user_id; } };
            if(!(b.pic_id > 0) && sh.pic_id > 0){ setp('pic', sh.pic_id); }
            if(sh.instructor_id > 0 && !(b.instructor_id > 0)){ var ins = person_of(sh.instructor_id); if(ins){ b.instructor = ins; b.instructor_id = ins.user_id; } }
            if(sh.put_id > 0 && !(b.put_id > 0)){ setp('put', sh.put_id); vm.this_claim_was_instructional = true; }
            if(sh.payer_id > 0){ b.payer_id = sh.payer_id; }
            vm.calculate_invoice_for_flight();
        }
        function set_context(ctx){
            vm.ctx = ctx;
            apply_link(ctx);
            if(ctx && ctx.club){
                vm.club = vm.club || { id: ctx.club.id, title: '' };
                vm.club.vat_registered = !!ctx.club.vat_registered;
                vm.club.vat_rate = ctx.club.vat_registered ? (Number(ctx.club.vat_rate) || 0) : 0;
                if(ctx.club.currency && !vm.club_currency){ vm.club_currency = ctx.club.currency; }
            }
        }
        var ctx_timer = null, ctx_seq = 0;
        function load_context(){
            if(!vm.bookout || !vm.bookout.id){ return; }
            var seq = ++ctx_seq;
            BookinV2Data.GetContext(vm.bookout.id, link_booking_id()).then(function(data){
                if(seq !== ctx_seq){ return; }
                if(data && data.success){ set_context(data); schedule_quote(); }
                else if(data && data.error === 'FORBIDDEN'){ vm.bk.ctxError = (typeof data.message === 'string' && data.message) || 'You can\'t book this flight in.'; }
            });
        }
        $scope.$watch(function(){
            var b = vm.bookout || {};
            return vm.bk.loaded ? [b.pic_id, b.put_id, b.instructor_id, b.tuition_id, (vm.claimed_flight && vm.claimed_flight.id) || 0, vm.has_used_claimed_flight].join('|') : null;
        }, function(key, old){
            if(!key){ return; }
            if(ctx_timer){ $timeout.cancel(ctx_timer); }
            ctx_timer = $timeout(load_context, old ? 300 : 0);
        });
        // the payer must be one of the context's payer_options (else the quote answers VALIDATION_ERROR payer_id)
        vm.bk_payer_ok = function(){
            var opts = (vm.ctx && vm.ctx.payer_options) || null;
            if(!opts){ return true; }
            return opts.some(function(o){ return o.user_id == vm.bookout.payer_id; });
        };
        vm.bk_payer_choice = function(){ return !!(vm.ctx && vm.ctx.payer_options && (vm.ctx.payer_options.length > 1 || !vm.bk_payer_ok())); };

        // the save (today's PUT) posts the QUOTE's lines — the server's figures — in v1's invoice item shape
        function invoice_items_from_quote(q){
            var items = [], org = 5, pkgs = (vm.ctx && vm.ctx.packages) || [];
            (q.packages_used || []).forEach(function(p){
                var cp = pkgs.filter(function(x){ return x.member_package_id == p.member_package_id; })[0]
                      || (vm.packages || []).filter(function(x){ return x.id == p.member_package_id; })[0] || {};
                items.push({ package_id: cp.package_id || null, title: 'Package: ' + p.title, hours: p.hours, hours_type: p.hours_type,
                             member_packages_id: p.member_package_id, unit_price: 0, total: 0, organise: 0 });
            });
            var pc = vm.bookout.plane_charges || {}, hasAircraft = false;
            (q.lines || []).forEach(function(l){
                var title = l.title, amt = round2(l.amount);
                switch(l.key){
                    case 'aircraft':
                        hasAircraft = true;
                        items.push({ title: /^Aircraft /.test(title) ? title : 'Aircraft ' + charge_type_label(pc.charge_type) + ' Charge', unit: l.units, unit_price: l.unit_price, total: amt, organise: 0 }); break;
                    case 'surcharge': if(amt > 0){ items.push({ title: /^Surcharge/.test(title) || /^Taxi/.test(title) ? title : 'Surcharge per ' + pc.surcharge_type, unit: l.units, unit_price: l.unit_price, total: amt, organise: 1 }); } break;
                    case 'tuition': if(amt > 0){ items.push({ title: /^Tuition Charge/.test(title) ? title : 'Tuition Charge - ' + ((vm.bookout.tuition_required && vm.bookout.tuition_required.title) || ''), unit: l.units, unit_price: l.unit_price, total: amt, organise: 2 }); } break;
                    case 'landing': if(amt > 0){ items.push({ title: 'Home Landing', unit: l.units, unit_price: l.unit_price, total: amt, organise: 4 }); } break;
                    case 'touch_and_go': if(amt > 0){ items.push({ title: 'Home Touch and Go', unit: l.units, unit_price: l.unit_price, total: amt, organise: 3 }); } break;
                    case 'reimbursement':
                        var qty = Number(l.units) || 0, credit = -amt;
                        items.push({ title: /^Reimbursement/.test(title) ? title : 'Reimbursement - ' + (/oil/i.test(title) ? 'Oil' : 'Fuel'), unit: l.units, unit_price: qty > 0 ? round2(credit / qty) : credit, total: amt, organise: org++ }); break;
                }
            });
            if(!hasAircraft){ items.push({ title: 'Aircraft ' + charge_type_label(pc.charge_type) + ' Charge', unit: 0, unit_price: pc.charge_rate_unit || 0, total: 0, organise: 0 }); }
            return items;
        }

        // the C4.2 request (the pilot's raw entries) + _local: the browser's rates and units for local_quote_v1 (dropped at the switch)
        function quote_inputs(){
            var pc = angular.copy((vm.bookout && vm.bookout.plane_charges) || {});
            var tc = (vm.bookout && vm.bookout.tuition_charges) ? angular.copy(vm.bookout.tuition_charges) : null;
            if(vm.free_flight){
                pc.charge_rate_unit = 0; pc.surcharge_fee = 0; pc.landing_fee = 0; pc.touch_and_go_fee = 0;
                if(tc){ tc.price = 0; }
            }
            // v1's "force it again": a sheet with stored brakes hours but no computed ones
            if((!vm.flight_units.brakes_to_brakes || vm.flight_units.brakes_to_brakes == 0) && vm.bookout.brakes_times && vm.bookout.brakes_times > 0){
                vm.flight_units.brakes_to_brakes = vm.bookout.brakes_times;
            }
            var units = 0;
            if(pc && pc.charge_type !== undefined){
                units = is_tpc_charging() ? vm.bookout.tpc_flight_time : billable_units(pc.charge_type);
            }
            var b = vm.bookout;
            return {
                times: { brakes_off: pad_time(b.brakes_off), takeoff: pad_time(b.takeoff_time), landing: pad_time(b.landing_time), brakes_on: pad_time(b.brakes_on) },
                tacho_end: (b.end_tacho === null || b.end_tacho === undefined || b.end_tacho === '') ? null : b.end_tacho,
                tacho_start: (b.start_tacho === null || b.start_tacho === undefined || isNaN(b.start_tacho)) ? null : b.start_tacho,   // not in C4.2 yet: asked for (fe-bookin.md)
                full_stop_landings: parseInt(b.landings, 10) || 0, touch_and_go: parseInt(b.tng, 10) || 0,
                pic_id: b.pic_id || 0, put_id: b.put_id || 0, instructor_id: b.instructor_id || 0, tuition_id: b.tuition_id || 0, payer_id: b.payer_id || 0,
                booking_id: vm.bk_linked() ? vm.bk.link.booking_id : undefined,   // C26: quote + commit on the linked booking
                claimed_fox_plane_log_sheet_id: (vm.split_flight_confirmation == 1) ? null : ((vm.has_used_claimed_flight && vm.claimed_flight && vm.claimed_flight.id) || null),
                // C46 (owner, 10 Nov): a confirmed split's part 1 is charged up to the picked split point, with no overlap with part 2
                split: split_quote(),
                receipt_ids: (vm.lubricant_receipts || []).filter(function(r){ return r.reimbursement == 1; }).map(function(r){ return r.id; }),
                _local: {
                    units: units, charge_type: pc.charge_type, tpc: is_tpc_charging(), claimed: !!vm.has_used_claimed_flight,
                    rounded: { off: b.brakes_off_rounded, on: b.brakes_on_rounded, to: b.takeoff_rounded, ld: b.landing_rounded },
                    flight_units: angular.copy(vm.flight_units), plane_charges: pc, tuition_charges: tc,
                    tuition_title: (b.tuition_required && b.tuition_required.title) || '',
                    instructor_id: b.instructor_id, tuition_id: b.tuition_id,
                    landings: b.landings, tng: b.tng,
                    packages: angular.copy(vm.packages || []),
                    receipts: angular.copy((vm.lubricant_receipts || []).filter(function(r){ return r.reimbursement == 1; })),
                    previous_total: (vm.previous_total === undefined || vm.previous_total === null) ? NaN : Number(vm.previous_total),
                    vat_rate: (vm.club && vm.club.vat_rate) || 0, vat_registered: !!(vm.club && vm.club.vat_registered),
                    currency: vm.club_currency || 'GBP', free: !!vm.free_flight,
                    need_to: vm.bk_need_to(), meter_charged: vm.bk_meter_charged()
                }
            };
        }

        var BASIS = { tacho: 'tacho', hobbs: 'hobbs', brakes: 'brakes_rounded', flight: 'brakes_rounded', brakes_rounded: 'brakes_rounded', brakes_exact: 'brakes_exact',
                      airborne: 'airborne_rounded', flight_rounded: 'airborne_rounded', flight_exact: 'airborne_exact', airborne_actual: 'airborne_actual', airborne_plus_allowance: 'airborne_plus_allowance' };
        function hash_of(o){ var s = JSON.stringify(o), h = 5381; for(var i = 0; i < s.length; i++){ h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return 'local-' + (h >>> 0).toString(16); }
        // v1's figures → the C4.2 response
        function shape_quote(inp, v1){
            var L = inp._local, pc = v1.plane_charges, lines = [], ct = L.charge_type, meter = (ct === 'tacho' || ct === 'hobbs');
            var rate = Number(pc.plane_unit_price) || 0, units = Number(pc.plane_units), t = inp.times, missing = [];
            // what the money needs (the rest of the checklist is the page's)
            if(!L.claimed){
                if(!t.brakes_off){ missing.push('brakes_off'); }
                if(!t.brakes_on){ missing.push('brakes_on'); }
                if(L.need_to && !t.takeoff){ missing.push('takeoff'); }
                if(L.need_to && !t.landing){ missing.push('landing'); }
            }
            if(meter && (inp.tacho_end === null || inp.tacho_end === undefined || isNaN(parseFloat(inp.tacho_end)))){ missing.push('tacho_end'); }
            if(inp.instructor_id > 0 && !(inp.tuition_id > 0)){ missing.push('tuition_id'); }
            if(!(inp.payer_id > 0)){ missing.push('payer_id'); }
            if(isNaN(L.previous_total)){ missing.push('previous_legs'); }
            if(isNaN(units) || isNaN(v1.total) || (meter && !(units > 0))){ if(missing.indexOf('tacho_end') < 0 && missing.indexOf('brakes_on') < 0){ missing.push('units'); } }

            var basis = L.tpc ? 'airborne_plus_allowance' : (BASIS[ct] || ct || 'brakes_rounded');
            var billed = { from: null, to: null };
            if(meter){ billed = { from: inp.tacho_start, to: inp.tacho_end }; }
            else if(basis === 'brakes_rounded'){ billed = { from: time_str(L.rounded.off) || nearest5(t.brakes_off), to: time_str(L.rounded.on) || nearest5(t.brakes_on) }; }
            else if(basis === 'brakes_exact'){ billed = { from: roundTimeToMinute(t.brakes_off) || null, to: roundTimeToMinute(t.brakes_on) || null }; }
            else if(basis === 'airborne_rounded' || basis === 'airborne_plus_allowance'){ billed = { from: time_str(L.rounded.to) || nearest5(t.takeoff) || nearest5(t.brakes_off), to: time_str(L.rounded.ld) || nearest5(t.landing) || nearest5(t.brakes_on) }; }
            else { billed = { from: roundTimeToMinute(t.takeoff) || null, to: roundTimeToMinute(t.landing) || null }; }
            var unitsOut = { basis: basis, hours: isNaN(units) ? null : Math.round(units * 10000) / 10000, billed_from: billed.from ? String(billed.from).slice(0, 5) : null,
                             billed_to: billed.to ? String(billed.to).slice(0, 5) : null, label: charge_words(ct, L.tpc) };

            var packages_used = [];
            (v1.package_removed || []).forEach(function(p){
                var spent = p.solo_dual === 'dual' ? p.hours_dual_spent : p.hours_solo_spent;
                var left = p.solo_dual === 'dual' ? p.hours_dual_remaining_after : p.hours_solo_remaining_after;
                packages_used.push({ member_package_id: p.member_packages_id, title: p.title, hours_type: p.solo_dual, hours: spent, remaining_after: left,
                                     other_remaining: p.solo_dual === 'dual' ? p.hours_solo_remaining_after : p.hours_dual_remaining_after });
                lines.push({ key: 'package', title: 'From your package', units: spent, unit_price: 0, amount: 0, kind: 'included',
                             detail: hm(spent) + ' ' + p.solo_dual + ' hours from ' + p.title + ' · ' + hm(left) + ' left',
                             rule: hm(spent) + ' ' + p.solo_dual + ' h covered by ' + p.title });
            });
            var aircraftRule = meter ? (dec1(inp.tacho_start) + '→' + dec1(inp.tacho_end) + ' on the ' + ct)
                             : L.tpc ? ((unitsOut.billed_from || '—') + '–' + (unitsOut.billed_to || '—') + ' + 10 min taxi allowance')
                             : ((unitsOut.billed_from || '—') + '–' + (unitsOut.billed_to || '—'));
            if(!(v1.package_used && !(units > 0) && packages_used.length)){
                var aAmt = round2(pc.plane_total);
                lines.push({ key: 'aircraft', title: 'Aircraft — ' + charge_words(ct, L.tpc), units: units, unit_price: rate, amount: aAmt, kind: aAmt ? 'charge' : 'no_charge',
                             detail: (meter ? dec1(units) + ' h' : hm(units)) + (packages_used.length ? ' after the package' : '') + ' × ' + money(rate) + ' an hour',
                             rule: aircraftRule + ' × ' + money(rate) + '/h' });
            }
            if(pc.surcharge_total > 0){
                var sAmt = round2(pc.surcharge_total);
                lines.push({ key: 'surcharge', title: pc.surcharge_charge_type === 'taxi' ? 'Taxi charge' : 'Surcharge per ' + pc.surcharge_charge_type, units: pc.surcharge_units,
                             unit_price: pc.surcharge_unit_price, amount: sAmt, kind: 'charge', detail: dec2(pc.surcharge_units) + ' × ' + money(pc.surcharge_unit_price), rule: 'surcharge_type ' + pc.surcharge_charge_type });
            }
            if(L.instructor_id > 0 && L.tuition_id > 0){
                var tq = Number(pc.tuition_units) || 0, tsession = pc.tuition_charge_type === 'session', tAmt = round2(pc.tuition_total);
                lines.push({ key: 'tuition', title: 'Tuition — ' + (L.tuition_title || 'instruction'), units: tq, unit_price: pc.tuition_unit_price, amount: tAmt, kind: tAmt ? 'charge' : 'no_charge',
                             detail: tAmt ? ((tsession ? '1 session' : hm(tq) + ' ' + pc.tuition_charge_type) + ' × ' + money(pc.tuition_unit_price) + (tsession ? '' : ' an hour')) : 'No tuition charge',
                             rule: 'tuition ' + (pc.tuition_charge_type || '') });
            }
            if(pc.landing_units > 0){
                var lAmt = round2(pc.landing_total);
                lines.push({ key: 'landing', title: 'Landing fees — full stops', units: pc.landing_units, unit_price: pc.landing_unit_price, amount: lAmt, kind: lAmt ? 'charge' : 'included',
                             detail: plural(pc.landing_units, 'full stop') + (pc.landing_unit_price > 0 ? ' × ' + money(pc.landing_unit_price) : ' · included'), rule: 'home full stops' });
            }
            if(pc.tng_units > 0){
                var gAmt = round2(pc.tng_total);
                lines.push({ key: 'touch_and_go', title: 'Landing fees — touch & goes', units: pc.tng_units, unit_price: pc.tng_unit_price, amount: gAmt, kind: gAmt ? 'charge' : 'included',
                             detail: plural(pc.tng_units, 'touch & go', 'touch & goes') + (pc.tng_unit_price > 0 ? ' × ' + money(pc.tng_unit_price) : ' · included'), rule: 'home touch & goes' });
            }
            (pc.receipts || []).forEach(function(r){
                var amt = round2(Number.parseFloat(r.reimbursed_amount) || 0);
                lines.push({ key: 'reimbursement', title: (r.item === 'Oil' ? 'Oil' : 'Fuel') + ' claim', units: Number(r.quantity) || 0, unit_price: null, amount: -amt, kind: 'credit', receipt_id: r.id,
                             detail: r.quantity + ' ' + (r.item === 'Oil' ? 'quarts of oil' : 'litres') + ' · ' + receipt_state(r).label.toLowerCase(),
                             rule: 'reimbursed_amount ' + money(amt, L.currency) });
            });
            var flight_total = round2(lines.reduce(function(s, l){ return s + (Number(l.amount) || 0); }, 0));
            var prev = isNaN(L.previous_total) ? 0 : round2(L.previous_total);
            var vatRate = L.vat_registered ? (L.vat_rate || 0) : 0;
            var q = {
                quote_hash: null, complete: !missing.length, missing: missing, units: unitsOut, lines: lines, packages_used: packages_used,
                flight_total: flight_total, previous_legs_total: prev, booking_total: round2(prev + flight_total),
                vat: { registered: !!L.vat_registered, rate: vatRate, included: vatRate ? round2(flight_total * vatRate / (100 + vatRate)) : 0 },
                currency: L.currency, free: L.free, warnings: [],
                source: 'browser', _v1: v1
            };
            q.quote_hash = hash_of({ l: lines, t: q.booking_total, m: missing });
            return q;
        }
        function split_quote(){
            if(vm.split_flight_confirmation != 1){ return undefined; }
            var at = pad_time(vm.split_at || (vm.bookout && vm.bookout.tpc_split_at));
            return at ? { at: at, part: 1, crew_mode: vm.split_crew_mode || 'same' } : undefined;
        }
        $scope.$watch(function(){ return vm.split_flight_confirmation == 1 ? (vm.split_crew_mode || 'same') : ''; }, function(n, o){ if(n !== o && n){ schedule_quote(); } });
        function pad_time(t){ t = time_str(t); if(!t){ return null; } var m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] + (m[3] ? ':' + m[3] : '') : null; }
        function nearest5(t){ t = time_str(t); return t ? TimeDisplayService.roundToFive(t) : null; }

        var quote_seq = 0, quote_timer = null, quote_waiters = [], quote_inflight = 0;
        vm.bk_requote = function(){ schedule_quote(); };   // the charges card's "Try again"
        function schedule_quote(){
            vm.bk.quoteState = 'updating';
            if(quote_timer){ $timeout.cancel(quote_timer); }
            quote_timer = $timeout(run_quote, 200);
        }
        function run_quote(){
            quote_timer = null;
            if(!vm.bookout || !vm.bookout.plane_charges){ flush_waiters(); return; }
            var seq = ++quote_seq, inputs;
            // the page's own meter check fails (end below start, not a number): no money on screen until the readings are right
            var me = meter_errs(false);
            if(me.start || me.end){
                apply_quote({ source: 'page', complete: false, error: 'METER_CHECK', message: '', missing: [], fields: [], units: { basis: null, hours: null }, lines: [], packages_used: [],
                              flight_total: NaN, previous_legs_total: 0, booking_total: NaN, vat: { registered: false, rate: 0, included: 0 }, currency: vm.club_currency || 'GBP', free: !!vm.free_flight, warnings: [] });
                vm.bk.quoteState = 'ready'; flush_waiters(); return;
            }
            try { inputs = quote_inputs(); } catch(e){ console.log('quote inputs', e); flush_waiters(); return; }
            vm.bk.quoteState = 'updating';
            quote_inflight++;
            computeQuote(inputs).then(function(q){
                quote_inflight--;
                if(seq !== quote_seq){ return; }          // a newer question was asked: its answer wins
                apply_quote(q);
                flush_waiters();
            }, function(){ quote_inflight--; if(seq === quote_seq){ vm.bk.quoteState = 'ready'; flush_waiters(); } });
        }
        function apply_quote(q){
            vm.quote = q;
            if(q._v1){
                // the local fallback: v1's fields, penny-rounded per line so the posted lines add up to the total charged
                var pc = angular.copy(q._v1.plane_charges);
                ['plane_total', 'surcharge_total', 'tuition_total', 'landing_total', 'tng_total'].forEach(function(k){ pc[k] = round2(pc[k]); });
                pc.total = q.flight_total;
                vm.plane_charges = pc;
                vm.package_removed = q._v1.package_removed;
                vm.package_used = q._v1.package_used;
            } else {
                vm.package_used = !!(q.packages_used && q.packages_used.length);
                if(vm.plane_charges){ vm.plane_charges.total = q.flight_total; }
            }
            vm.invoice_totals = q.booking_total;
            if(vm.send && !isNaN(q.booking_total)){ vm.send.amount = Math.round(q.booking_total * 100); }
            vm.calculated_invoice = !!q.complete;
            vm.bk.quoteState = q.complete ? 'ready' : 'incomplete';
            if(vm.pay){ vm.pay.amountChanged(); }
        }
        function flush_waiters(){
            if(quote_timer || quote_inflight > 0){ return; }
            var w = quote_waiters; quote_waiters = [];
            w.forEach(function(d){ d.resolve(vm.quote); });
        }
        // resolves with the latest quote once nothing is pending (paying waits for this)
        vm.bk_fresh_quote = function(){
            var d = $q.defer();
            if(!quote_timer && !quote_inflight && vm.bk.quoteState !== 'updating'){ d.resolve(vm.quote); return d.promise; }   // complete:false resolves too: the caller checks q.complete
            quote_waiters.push(d);
            return d.promise;
        };

        // a helper that builds an object for ng-if / ng-class gives the SAME object back while its value is the same
        var stable_cache = {};
        function stable(name, obj){
            var j = JSON.stringify(obj === undefined ? null : obj);
            var c = stable_cache[name];
            if(c && c.j === j){ return c.o; }
            stable_cache[name] = { j: j, o: obj };
            return obj;
        }
        /* ═════ small formatters ═════ */
        function round2(n){ n = Number(n); return isNaN(n) ? n : Math.round(n * 100) / 100; }
        function dec1(n){ n = Number(n); return isNaN(n) ? '—' : n.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
        function dec2(n){ n = Number(n); return isNaN(n) ? '—' : (Math.round(n * 100) / 100).toString(); }
        function plural(n, w, ws){ return n + ' ' + (n == 1 ? w : (ws || w + 's')); }
        function hm(h){ h = Number(h); if(isNaN(h) || h === null){ return '—'; } var m = Math.round(Math.abs(h) * 60); return (h < 0 ? '−' : '') + Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
        var money_fmt = {};
        function money(n, cur){
            n = Number(n); if(isNaN(n)){ return '—'; }
            cur = cur || vm.club_currency || 'GBP';
            if(!money_fmt[cur]){
                try { money_fmt[cur] = new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur }); }
                catch(e){ money_fmt[cur] = { format: function(x){ return cur + ' ' + x.toFixed(2); } }; }
            }
            return (n < 0 ? '−' : '') + money_fmt[cur].format(Math.abs(n));
        }
        vm.bk_money = money;
        vm.bk_hm = hm;
        vm.bk_dec1 = dec1;
        vm.bk_plural = plural;
        function charge_words(ct, tpc){
            if(tpc){ return 'takeoff to landing + taxi allowance'; }
            switch(ct){
                case 'tacho': return 'tacho'; case 'hobbs': return 'hobbs';
                case 'brakes_exact': return 'brakes to brakes';
                case 'brakes': case 'flight': case 'brakes_rounded': return 'brakes to brakes, rounded';
                case 'airborne_actual': return 'airborne, as recorded';
                case 'flight_exact': return 'takeoff to landing';
                case 'airborne': case 'flight_rounded': return 'takeoff to landing, rounded';
                case 'airborne_plus_allowance': return 'airborne + taxi allowance';
                default: return ct || 'flight';
            }
        }
        function charge_expl(ct, tpc){
            if(tpc){ return 'takeoff to landing plus a 10-minute taxi allowance (brakes off to brakes on + 10 min when no takeoff and landing are recorded)'; }
            switch(ct){
                case 'tacho': return 'the difference between the tacho readings';
                case 'hobbs': return 'the difference between the hobbs readings';
                case 'brakes_exact': return 'brakes off to brakes on, to the minute';
                case 'brakes': case 'flight': case 'brakes_rounded': return 'brakes off to brakes on, each end rounded to 5 minutes';
                case 'airborne_actual': return 'the recorded airborne time';
                case 'flight_exact': return 'takeoff to landing, to the minute';
                case 'airborne': case 'flight_rounded': return 'takeoff to landing, each end rounded to 5 minutes';
                case 'airborne_plus_allowance': return 'takeoff to landing plus a 10-minute taxi allowance';
                default: return 'the club\'s rule for this aircraft';
            }
        }
        vm.bk_charge_expl = function(){ var pc = vm.bookout && vm.bookout.plane_charges; return pc ? charge_expl(pc.charge_type, is_tpc_charging()) : ''; };
        vm.bk_charge_words = function(){ var pc = vm.bookout && vm.bookout.plane_charges; return pc ? charge_words(pc.charge_type, is_tpc_charging()) : ''; };

        function time_str(t){
            if(t && typeof t === 'object' && t.time !== undefined){ t = t.time; }
            if(!t || t === '00:00:00' || t === '00:00'){ return ''; }
            return String(t);
        }
        function to_min(t){ t = time_str(t); if(!t){ return null; } var m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (parseInt(m[3] || '0', 10) >= 30 ? 1 : 0) : null; }
        function hhmm(mins){ mins = ((Math.round(mins) % 1440) + 1440) % 1440; return ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2); }
        // a time on screen follows the club's display rule (clubs.time_display): nearest 5 min (2.5 rounds up) or the minute
        function shown(t, rounded_backend){
            t = time_str(t); if(!t){ return ''; }
            if(vm.td && vm.td.def && vm.td.def.rounded){
                var b = time_str(rounded_backend);
                return b ? roundTimeToMinute(b) : TimeDisplayService.roundToFive(t);
            }
            return roundTimeToMinute(t);
        }
        vm.bk_shown = shown;
        vm.bk_exact = function(t){ t = time_str(t); return t ? roundTimeToMinute(t) : ''; };
        vm.bk_rounded = function(){ return !!(vm.td && vm.td.def && vm.td.def.rounded); };
        vm.bk_club_air = function(){ return !!(vm.td && vm.td.def && vm.td.def.window === 'airborne'); };
        vm.bk_disp_note = function(){ return vm.bk_rounded() ? (vm.bk.showRec ? 'Shown to the nearest 5 minutes, as the club shows them (2.5 rounds up), with the recorded minute under each.' : 'Shown to the nearest 5 minutes, as the club shows them (2.5 rounds up); tap a time for the recorded minute.') : 'Recorded times, to the minute.'; };
        vm.bk_rec_toggle = function(){ if(vm.bk_rounded()){ vm.bk.showRec = !vm.bk.showRec; } };   // touch screens have no hover: a tap shows every recorded minute
        function fday(d){ var x = parse_date(d); return x ? DAY[x.getDay()] + ' ' + x.getDate() + ' ' + MON[x.getMonth()] : ''; }
        function parse_date(s){ if(!s){ return null; } var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
        function iso_day(d){ return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
        vm.bk_fday = fday;

        /* ═════ the flight being booked in ═════ */
        // the times this book-in charges: the claimed / split / recorded flight, else what was entered
        vm.bk_eff = function(){
            var b = vm.bookout || {};
            return { off: time_str(b.brakes_off), to: time_str(b.takeoff_time), ld: time_str(b.landing_time), on: time_str(b.brakes_on),
                     off_r: b.brakes_off_rounded, on_r: b.brakes_on_rounded, to_r: b.takeoff_rounded, ld_r: b.landing_rounded };
        };
        vm.bk_claimed = function(){ return !!vm.has_used_claimed_flight; };
        // a tracker flight whose times club staff amended before the claim (owner, 10 Nov; times_amended on the unclaimed rows):
        // who, when, why and what the tracker recorded — shown on its card and above the times once it's used
        var amended_cache = {};
        vm.bk_amended = function(f){
            var a = f && f.times_amended;
            if(!a || typeof a !== 'object'){ return null; }
            var key = f.id + '|' + (a.at || '') + '|' + (a.count || 1);
            if(amended_cache[key]){ return amended_cache[key]; }
            var o = a.original || {}, to = roundTimeToMinute(o.takeoff_time), ld = roundTimeToMinute(o.landing_time);
            var at = String(a.at || '');
            amended_cache[key] = { by: String(a.by_name || '').trim() || 'a club instructor', when: at ? fday(at.slice(0, 10)) : '',
                reason: String(a.reason || '').trim(), orig: (to && ld) ? 'take-off ' + to + ', landing ' + ld : 'different times' };
            return amended_cache[key];
        };
        // ── the tracker flight the Times card shows, and whether this viewer may amend its times (C47, owner 10 Nov) ──
        // a direct claim: the sheet being booked in IS the unclaimed tracker flight (fox_log_id, auto_claim; claimed_flight stays {});
        // a claim onto the pilot's own sheet: the flight picked from the unclaimed list. The backend's can_amend_times decides.
        function amend_target(){
            if(vm.has_used_claimed_flight && vm.claimed_flight && vm.claimed_flight.id){
                return { row: vm.claimed_flight, pls: vm.claimed_flight.id, can: vm.claimed_flight.can_amend_times === true, direct: false };
            }
            if(vm.auto_claim === 1 && vm.has_used_claimed_flight && vm.bookout && vm.bookout.id && vm.ctx && vm.ctx.sheet){
                var sh = vm.ctx.sheet, b = vm.bookout;
                var row = { id: b.id, registration: vm.bk_reg(), flight_date: b.flight_date, aircraft_colour: b.aircraft && b.aircraft.colour,
                    brakes_off: b.brakes_off, takeoff_time: b.takeoff_time, landing_time: b.landing_time, brakes_on: b.brakes_on,
                    times_amended: sh.times_amended || b.times_amended || null };
                return { row: row, pls: b.id, can: sh.can_amend_times === true, direct: true };
            }
            return null;
        }
        vm.bk_claimed_amended = function(){ var t = amend_target(); return t ? vm.bk_amended(t.row) : null; };
        vm.bk_amend_can = function(){ var t = amend_target(); return !!(t && t.can) && !vm.split_flight && !vm.split_flight_confirmation; };
        vm.bk_amend_open = function(){
            var t = amend_target(); if(!t || !t.can){ return; }
            vm.bk.amend = ClaimV2Data.form(t.row, is_tpc_charging(), (vm.ctx && vm.ctx.club && vm.ctx.club.tpc_pad_minutes) || 5, { pls: t.pls });
        };
        // after a save or a revert the sheet's stored times (and derived fields) changed: a direct claim reloads the page; a claim
        // onto the pilot's own sheet takes the row's new times, re-fills the card, re-fetches the context and re-quotes
        function amend_refresh(flight, word){
            var t = amend_target();
            vm.bk.amend = null; vm.bk.revertAsk = false;
            if(!t || t.direct){ ToastService.success(word, 'Reloading the flight with its new times…'); $timeout(function(){ $window.location.reload(); }, 900); return; }
            // the reply row is a tracker-list row (its id is the tracker entry, not the sheet): take only the times and the amend facts
            if(flight){
                ['brakes_off', 'takeoff_time', 'landing_time', 'brakes_on', 'brakes_off_rounded', 'takeoff_rounded', 'landing_rounded', 'brakes_on_rounded',
                 'brakes_time', 'brakes_times_rounded', 'airborne_time', 'airborne_rounded', 'flight_time', 'times_amended', 'airborne_seconds_amended', 'can_amend_times']
                    .forEach(function(k){ if(k in flight){ vm.claimed_flight[k] = flight[k]; } else if(k === 'times_amended' || k === 'airborne_seconds_amended'){ vm.claimed_flight[k] = null; } });
            }
            amended_cache = {}; flight_txt_cache = {};
            $scope.claim_my_flight(true);
            load_context(); schedule_quote();
            ToastService.success(word, 'The card shows the new times; the price follows them.');
        }
        vm.bk_amend_saved = function(flight){ amend_refresh(flight, 'Times amended'); };
        vm.bk_revert_ask = function(){ vm.bk.revertAsk = true; };
        vm.bk_revert_keep = function(){ vm.bk.revertAsk = false; };
        vm.bk_revert = function(){
            var t = amend_target(); if(!t || !t.can || vm.bk.reverting){ return; }
            vm.bk.reverting = true;
            return ClaimV2Data.RevertTimes(t.pls, {}).then(function(data){
                vm.bk.reverting = false;
                if(data && data.success){ amend_refresh(data.flight, 'Tracker times back'); return; }
                ToastService.handledInline();
                vm.bk.revertErr = ClaimV2Data.whyOf(data, 'The tracker’s times weren’t put back. Try again in a moment.');
            });
        };
        vm.bk_is_fox = function(){ return !!(vm.bookout && vm.bookout.fox_log_id > 0); };
        vm.bk_claim_avail = function(){
            return !!(vm.claim_a_flight && vm.claim_a_flight.length > 0 && !vm.has_used_claimed_flight && (!(vm.bookout.fox_log_id > 0) || vm.auto_claim !== 1));
        };
        // the club's window (block or airborne) for the hero and the summary — TimeDisplayService.pick
        vm.bk_window = function(){
            var e = vm.bk_eff();
            if(/after brakes off/.test(time_errs(false).on || '')){ return null; }   // reversed times: no flight time yet
            var row = { brakes_off: e.off, brakes_on: e.on, takeoff_time: e.to, landing_time: e.ld,
                        brakes_off_rounded: e.off_r, brakes_on_rounded: e.on_r, takeoff_rounded: e.to_r, landing_rounded: e.ld_r,
                        brakes_times_rounded: vm.has_used_claimed_flight ? vm.bookout.brakes_times_rounded : null };
            var key = JSON.stringify(row) + '|' + (vm.td && vm.td.mode);
            if(vm.bk._win_key === key){ return vm.bk._win; }
            var v = (e.off || e.to) ? TimeDisplayService.pick(row, vm.td.mode) : null;
            vm.bk._win_key = key;
            vm.bk._win = (v && !v.missing && v.durationMins !== null) ? { from: v.from, to: v.to, hm: v.durationHM, air: v.window === 'airborne', rounded: v.rounded,
                label: (v.window === 'airborne' ? 'Airborne' : 'Block') + (v.rounded ? ', to 5 min' : ', exact'), word: v.window === 'airborne' ? 'airborne' : 'block' } : null;
            return vm.bk._win;
        };
        function span_hm(a, b){ var m = minutesBetween(a, b); return m === null ? null : hm(m / 60); }
        vm.bk_block_tile = function(){ return stable('bt', bt_raw()); };
        // the tiles stay "—" while the times entered are the wrong way round (the field says why)
        function bt_raw(){ var e = vm.bk_eff(); var a = shown(e.off, e.off_r), b = shown(e.on, e.on_r); if(/after brakes off/.test(time_errs(false).on || '')){ return null; } return (a && b) ? { v: span_hm(a, b), s: a + ' to ' + b + (vm.bk_rounded() ? ', to 5 min' : '') } : null; };
        vm.bk_air_tile = function(){ return stable('at', at_raw()); };
        function at_raw(){ var e = vm.bk_eff(); var a = shown(e.to, e.to_r), b = shown(e.ld, e.ld_r); if(/after takeoff/.test(time_errs(false).ld || '')){ return null; } return (a && b) ? { v: span_hm(a, b), s: a + ' to ' + b + (vm.bk_rounded() ? ', to 5 min' : '') } : null; };
        vm.bk_charged_tile = function(){
            var q = vm.quote; if(!q || !q.complete || q.units.hours === null){ return null; }
            return (q.units.basis === 'tacho' || q.units.basis === 'hobbs') ? dec1(q.units.hours) + ' h' : hm(q.units.hours);
        };

        // charge type → the inputs it needs (decided: takeoff / landing are optional when the club shows airborne
        // times but charges another way; required for every airborne charge type)
        var AIR_TYPES = ['airborne', 'flight_rounded', 'flight_exact', 'airborne_actual'];
        vm.bk_need_to = function(){
            var pc = vm.bookout && vm.bookout.plane_charges; if(!pc || vm.has_used_claimed_flight){ return false; }
            // the server asks for takeoff / landing even with both brake times in: then they are required here too
            if(vm.quote && vm.quote.source === 'server' && vm.quote.missing && vm.bk.t.off && vm.bk.t.on && (vm.quote.missing.indexOf('takeoff') > -1 || vm.quote.missing.indexOf('landing') > -1)){ return true; }
            return AIR_TYPES.indexOf(pc.charge_type) > -1 && !is_tpc_charging();
        };
        vm.bk_show_to = function(){
            var pc = vm.bookout && vm.bookout.plane_charges; if(!pc || vm.has_used_claimed_flight){ return false; }
            return vm.bk_need_to() || is_tpc_charging() || pc.charge_type === 'flight' || pc.charge_type === 'airborne_plus_allowance' || vm.bk_club_air();
        };
        vm.bk_meter_charged = function(){ var pc = vm.bookout && vm.bookout.plane_charges; return !!(pc && (pc.charge_type === 'tacho' || pc.charge_type === 'hobbs')); };
        vm.bk_meters_shown = function(){ return vm.bk_meter_charged() || !!(vm.bookout && vm.bookout.aircraft && vm.bookout.aircraft.track_tacho == 1); };
        vm.bk_meter_word = function(){ var pc = vm.bookout && vm.bookout.plane_charges; return pc && pc.charge_type === 'hobbs' ? 'hobbs' : 'tacho'; };
        vm.bk_last_meter = function(){ var n = parseFloat(vm.start_tacho_orig); return isNaN(n) ? null : n; };
        vm.bk_meter_diff = function(){
            var a = parseFloat(vm.bookout.start_tacho), b = parseFloat(vm.bookout.end_tacho);
            return (!isNaN(a) && !isNaN(b) && b > a) ? Math.round((b - a) * 10) / 10 : null;
        };
        // book_in_flight's check, shown in place: only when charged on the meter (v1's rule)
        vm.bk_start_changed = function(){
            if(!vm.bk_meter_charged()){ return false; }
            var a = parseFloat(vm.bookout.start_tacho);
            return !isNaN(a) && Number.parseFloat(vm.start_tacho_orig) !== a;
        };
        vm.bk_meter_warn = function(){
            var d = vm.bk_meter_diff(); if(d === null){ return ''; }
            var bt = vm.bk_block_tile(), e = vm.bk_eff();
            var bh = (e.off && e.on) ? (minutesBetween(roundTimeToMinute(e.off), roundTimeToMinute(e.on)) || 0) / 60 : null;
            var ah = (e.to && e.ld) ? (minutesBetween(roundTimeToMinute(e.to), roundTimeToMinute(e.ld)) || 0) / 60 : null;
            if(d > 6){ return 'That\'s ' + dec1(d) + ' hours. Check the reading for a typo.'; }
            if(bh !== null && d > bh + 0.25){ return 'The meter moved ' + dec1(d) + ' h, more than the ' + hm(bh) + ' from brakes off to brakes on. Check the end reading.'; }
            if(ah !== null && ah > 0 && d < ah * 0.6){ return 'The meter moved only ' + dec1(d) + ' h for ' + hm(ah) + ' airborne. Check the end reading.'; }
            return '';
        };
        // a meter reading as typed: "4214.8", "4,214.8" (thousands) and "4214,8" (a decimal comma) all mean 4214.8; anything else is not a number
        function parse_meter(raw){
            var t = String(raw === null || raw === undefined ? '' : raw).replace(/\s/g, '');
            if(t === ''){ return null; }
            if(t.indexOf('.') < 0 && /^\d+,\d{1,2}$/.test(t)){ t = t.replace(',', '.'); } else { t = t.replace(/,/g, ''); }
            return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
        }
        vm.bk_meter_input = function(which){
            var n = parse_meter(vm.bk.m[which]);
            vm.bk.m.bad = vm.bk.m.bad || {}; vm.bk.m.bad[which] = (n !== null && isNaN(n));
            var v = (n === null || isNaN(n)) ? null : n;
            if(which === 'start'){ vm.bookout.start_tacho = v; vm.bk.startAck = false; } else { vm.bookout.end_tacho = v; }
            vm.tacho_error_highlight = !!(vm.bookout.start_tacho !== null && vm.bookout.end_tacho !== null && vm.bookout.end_tacho <= vm.bookout.start_tacho);
            vm.calculate_invoice_for_flight();
        };

        /* ═════ times (manual entry) ═════ */
        // <ta-time> fields (js/v2/core/timefield.js): typed or picked, 5-minute steps, v1's value format ('H:mm' in
        // {time}) so every v1 calculation reads them unchanged. (Until 11 Nov 2026: four native selects of 288 options.)
        // Where a field's list opens while it is still empty: at the time before it; brakes off at the booked-out time,
        // else the booking's start, else now.
        vm.bk_time_near = function(f){
            var t = vm.bk.t;
            if(f === 'to'){ return t.off || ''; }
            if(f === 'ld'){ return t.to || t.off || ''; }
            if(f === 'on'){ return t.ld || t.to || t.off || ''; }
            var b = vm.bookout || {}, c = b.created_at ? String(b.created_at) : '';
            if(c && b.flight_date && c.slice(0, 10) === String(b.flight_date).slice(0, 10) && /^\d{2}:\d{2}/.test(c.slice(11, 16))){ return c.slice(11, 16); }
            if(b.booking && b.booking.start && /^\d{2}:\d{2}/.test(String(b.booking.start).slice(11, 16))){ return String(b.booking.start).slice(11, 16); }
            var now = new Date(); return now.getHours() + ':' + ('0' + now.getMinutes()).slice(-2);
        };
        // the gap since the time before, said under the field ("10 min after brakes off") — it used to sit inside every
        // option of the lists. Nothing when either time is missing or they are out of order (the error says that).
        function gap_words(mins){ var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m || !h ? m + ' min' : ''); }
        vm.bk_time_gap = function(f){
            var t = vm.bk.t, v = to_min(t[f]); if(v === null){ return ''; }
            var ref = f === 'to' ? ['off', 'brakes off'] : f === 'ld' ? ['to', 'takeoff'] : f === 'on' ? (to_min(t.ld) !== null ? ['ld', 'landing'] : ['off', 'brakes off']) : null;
            if(!ref){ return ''; }
            var r = to_min(t[ref[0]]); if(r === null || v <= r){ return ''; }
            return gap_words(v - r) + ' after ' + ref[1];
        };
        vm.bk_time_changed = function(f){
            var v = vm.bk.t[f] || '';
            var map = { off: 'brakes_off', to: 'takeoff_time', ld: 'landing_time', on: 'brakes_on' };
            vm.bookout[map[f]] = v ? { time: v, disabled: 0 } : { time: '' };
            if(f === 'to' || f === 'ld'){ if(!v){ vm.bookout[map[f]] = ''; } }
            vm.calculate_my_airborne_duration();   // v1: flight units (+ the TPC allowance) and the invoice
            if(!(vm.bookout.brakes_off && vm.bookout.brakes_off.time) || !(vm.bookout.brakes_on && vm.bookout.brakes_on.time)){ vm.calculate_invoice_for_flight(); }
        };
        function time_errs(all){
            var e = {}; if(vm.has_used_claimed_flight){ return e; }
            var t = vm.bk.t, off = to_min(t.off), on = to_min(t.on), to = to_min(t.to), ld = to_min(t.ld);
            if(all && off === null){ e.off = 'Choose the brakes-off time'; }
            if(all && on === null){ e.on = 'Choose the brakes-on time'; }
            if(off !== null && on !== null && on <= off){ e.on = 'Brakes on must be after brakes off'; }
            if(vm.bk_show_to()){
                if(all && vm.bk_need_to() && to === null){ e.to = 'Choose the takeoff time'; }
                if(all && vm.bk_need_to() && ld === null){ e.ld = 'Choose the landing time'; }
                if(to !== null && off !== null && to < off){ e.to = 'Takeoff can\'t be before brakes off'; }
                if(to !== null && ld !== null && ld <= to){ e.ld = 'Landing must be after takeoff'; }
                else if(ld !== null && on !== null && ld > on){ e.ld = 'Landing can\'t be after brakes on'; }
                if((to === null) !== (ld === null) && !e.to && !e.ld){ if(to === null){ e.to = 'Choose the takeoff time too'; } else { e.ld = 'Choose the landing time too'; } }
            }
            return e;
        }
        vm.bk_time_err = function(f){ return time_errs(vm.bk.showErr)[f] || ''; };
        function meter_errs(all){
            var e = {}; if(!vm.bk_meters_shown()){ return e; }
            var a = parseFloat(vm.bookout.start_tacho), b = parseFloat(vm.bookout.end_tacho), req = vm.bk_meter_charged();
            if(all && req && isNaN(a)){ e.start = 'Enter the start reading'; }
            if(all && req && isNaN(b)){ e.end = 'Enter the end reading'; }
            var bad = (vm.bk.m && vm.bk.m.bad) || {};
            if(bad.start){ e.start = 'Enter the reading as a number, like 4214.8'; }
            if(bad.end){ e.end = 'Enter the reading as a number, like 4214.8'; }
            if(!isNaN(a) && !isNaN(b) && b <= a){ e.end = 'Must be higher than the start (' + dec1(a) + ')'; }
            // the server's own check (C4: tacho_start a number ≥ 0, end ≥ start), from the quote or a refused commit
            if(server_field('tacho_start') && !e.start){ e.start = 'The club\'s system can\'t take this start reading — check it'; }
            if(server_field('tacho_end') && !e.end){ e.end = 'The club\'s system can\'t take this end reading — check it'; }
            return e;
        }
        function server_field(f){
            var q = vm.quote;
            return !!(q && q.error === 'VALIDATION_ERROR' && (q.fields || q.missing || []).indexOf(f) > -1);
        }
        vm.bk_meter_err = function(f){ return meter_errs(vm.bk.showErr)[f] || ''; };

        /* ═════ route & landings ═════ */
        vm.bk_ft = function(){ return vm.bookout && vm.bookout.flight_type ? vm.bookout.flight_type.id : null; };
        vm.bk_set_ft = function(id){
            vm.bookout.flight_type = vm.flight_types.find(function(x){ return x.id === id; });
            if(id === 1){ vm.bookout.remote_landings = 0; }
            vm.bk.ftEdited = true;
        };
        vm.bk_needs_to = function(){ var f = vm.bk_ft(); return f === 2 || f === 4; };
        vm.bk_af = function(a){ return a && (a.code || a.title) ? a : null; };
        vm.bk_af_label = function(a){ if(!a){ return ''; } var t = String(a.title || '').replace('NOT LISTED : ', ''); return t; };
        vm.bk_land_total = function(){ return (parseInt(vm.bookout.landings, 10) || 0) + (parseInt(vm.bookout.tng, 10) || 0) + (vm.bk_ft() === 1 ? 0 : (parseInt(vm.bookout.remote_landings, 10) || 0)); };
        // how the ONE landings total splits: "8 full stops + 4 touch and goes" (owner, 14 Nov 2026: two counts and a total read as
        // 12 or as 8-including-4). One kind only: "all full stops". brackets = for the summary line: " (8 full stops + 4 touch and goes)",
        // nothing when there is one kind
        vm.bk_land_split = function(brackets){
            var fs = parseInt(vm.bookout.landings, 10) || 0, tg = parseInt(vm.bookout.tng, 10) || 0;
            var aw = vm.bk_ft() === 1 ? 0 : (parseInt(vm.bookout.remote_landings, 10) || 0), parts = [];
            if(fs){ parts.push(plural(fs, 'full stop')); }
            if(tg){ parts.push(plural(tg, 'touch and go', 'touch and goes')); }
            if(aw){ parts.push(aw + ' away'); }
            if(brackets){ return parts.length > 1 ? ' (' + parts.join(' + ') + ')' : ''; }
            if(parts.length > 1){ return parts.join(' + '); }
            if(fs){ return fs === 1 ? 'a full stop' : 'all full stops'; }
            if(tg){ return tg === 1 ? 'a touch and go' : 'all touch and goes'; }
            return aw ? (aw === 1 ? 'at another airfield' : 'all at other airfields') : '';
        };
        vm.bk_step = function(k, d){
            vm.bookout[k] = Math.max(0, (parseInt(vm.bookout[k], 10) || 0) + d);
            if(k === 'landings'){ vm.bookout.full_stop_landings = vm.bookout.landings; }
            if(k === 'tng'){ vm.bookout.touch_and_go = vm.bookout.tng; }
            vm.bk.landEdited = true;
            if(vm.bk_land_total() > 0){ vm.bk.noLand = false; }
            vm.calculate_invoice_for_flight();
        };
        vm.bk_counts_src = function(){
            var s = vm.bookout && vm.bookout.track_counts_source;
            if(!vm.has_used_claimed_flight && !(vm.bookout && vm.bookout.fox_log_id > 0)){ return null; }
            return s || 'tracker';
        };
        vm.bk_home_code = function(){ var a = vm.bookout && vm.bookout.from_airfield; return a ? (a.code || '') : ''; };

        /* ═════ crew ═════ */
        function person_of(id){
            id = parseInt(id, 10); if(!(id > 0)){ return null; }
            var p = (vm.pics || []).find(function(x){ return x.user_id === id; }) || (vm.instructors || []).find(function(x){ return x.user_id === id; });
            return p || null;
        }
        function person_name(id){
            var p = person_of(id);
            if(p){ return p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim(); }
            var b = vm.bookout || {};
            var cands = [b.user, b.pilot_in_command, b.instructor, b.put];
            for(var i = 0; i < cands.length; i++){ var c = cands[i]; if(c && (c.id == id || c.user_id == id) && c.first_name){ return (c.first_name + ' ' + (c.last_name || '')).trim(); } }
            return '';
        }
        vm.bk_name = person_name;
        vm.bk_first = function(id){ return (person_name(id) || '').split(' ')[0]; };
        vm.bk_is_instr = function(p){ return !!(p && p.instructor == 1); };
        vm.bk_initials = function(p){ var n = (p && (p.name || ((p.first_name || '') + ' ' + (p.last_name || '')))) || ''; return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function(w){ return w[0]; }).join('').toUpperCase(); };
        vm.bk_colour = function(p){ return (p && (p.instructor_colour || p.booking_colour)) || 'var(--ta-brand-2)'; };
        vm.bk_solo_mode = function(){ return !!(vm.this_claim_was_instructional && vm.bookout.pic && vm.bookout.pic.user_id > 0 && !vm.picIsInstructor()); };
        vm.bk_payer_why = function(){
            if(vm.this_was_supervised_solo || vm.bk_solo_mode()){ return 'the pilot in command pays for an authorised solo'; }
            if(vm.this_claim_was_instructional && vm.bookout.put_id > 0){ return 'the student pays for a lesson'; }
            if(vm.bookout.payer_id > 0 && vm.bookout.payer_id != vm.bookout.pic_id){ return 'the booking\'s pilot pays'; }
            return 'the pilot in command pays for a hire';
        };
        // v1 left "supervised solo" on when instructional was switched off, so a plain hire then demanded an authorising
        // instructor at the save (and v2 hides that toggle for a member PIC, so it could not be undone): off means off
        vm.bk_toggle_instructional = function(){
            vm.this_was_instructional_claim();
            if(!vm.this_claim_was_instructional && vm.this_was_supervised_solo){ vm.this_was_supervised_solo = false; vm.bookout.instructor = {}; vm.bookout.instructor_id = 0; vm.calculate_invoice_for_flight(); }
        };
        vm.bk_toggle_supervised = function(){
            vm.this_was_a_supervised_solo();
            if(vm.this_was_supervised_solo){ vm.bookout.put = {}; vm.bookout.put_id = 0; }
            else if(vm.picIsInstructor()){ vm.bookout.instructor = vm.bookout.pic; vm.bookout.instructor_id = vm.bookout.pic_id; }
            vm.calculate_invoice_for_flight();
        };
        vm.bk_show_course = function(){ return !!(vm.this_was_supervised_solo || vm.this_claim_was_instructional || vm.bookout.instructor_id > 0); };
        vm.bk_crew_sub = function(){
            var b = vm.bookout || {};
            if(!(b.pic && b.pic.user_id > 0)){ return 'Who flew, and who pays'; }
            if(vm.this_claim_was_instructional || vm.this_was_supervised_solo){
                if(vm.this_was_supervised_solo){ return 'Authorised solo · ' + (person_name(b.instructor_id) || 'instructor to choose'); }
                return person_name(b.pic_id) + ' instructing ' + (person_name(b.put_id) || '…');
            }
            return person_name(b.pic_id) + ' · self-fly hire';
        };
        function crew_errs(){
            var b = vm.bookout || {}, e = {};
            if(!(b.pic && b.pic.user_id > 0)){ e.pic = 'Choose the pilot in command'; return e; }
            if(vm.this_claim_was_instructional || vm.this_was_supervised_solo){
                if(vm.this_was_supervised_solo){
                    if(!(b.instructor_id > 0) || b.instructor_id == b.pic_id){ e.instr = 'Choose the instructor who authorised this solo'; }
                } else if(!(b.put_id > 0)){ e.put = 'Choose the student'; }
                else if(!(b.instructor_id > 0)){ e.put = 'Choose the student again'; }
                if(!(b.tuition_id > 0)){ e.tuition = 'Choose the tuition'; }
            } else if(b.instructor_id > 0 && !(b.tuition_id > 0)){ e.tuition = 'Choose the tuition'; }
            if(!e.pic && !(b.payer_id > 0)){ e.pic = 'Choose the pilot in command again'; }
            if(!e.pic && b.payer_id > 0 && vm.bk_payer_ok && !vm.bk_payer_ok()){ e.payer = 'Choose who the invoice goes to'; }
            return e;
        }
        vm.bk_crew_err = function(f){ return vm.bk.showErr ? (crew_errs()[f] || '') : ''; };

        /* ═════ readiness: what the finish button checks (complete_this_flight + the two confirm() boxes) ═════ */
        function first_key(o){ var k = Object.keys(o); return k.length ? o[k[0]] : ''; }
        function build_ready(){
            var b = vm.bookout || {}, items = [], opt = [];
            var te = time_errs(true);
            items.push({ k: 'times', card: 'times', t: 'Times recorded', done: !Object.keys(te).length,
                         n: vm.has_used_claimed_flight ? 'Check the times' : (vm.bk_claim_avail() ? 'Use the tracker or enter the times' : (Object.keys(te).map(function(k){ return te[k]; }).filter(function(m){ return m.indexOf('Choose ') !== 0; })[0] || 'Enter the times')) });
            if(vm.split_flight == 1 && vm.split_flight_confirmation == 0){
                items.push({ k: 'split', card: 'times', t: 'Split confirmed', n: 'Confirm or cancel the split', done: false });
            }
            if(vm.bk_meters_shown() && vm.bk_meter_charged()){
                var me = meter_errs(true);
                var mn = me.start && me.start !== 'Enter the start reading' ? me.start : (me.end && me.end !== 'Enter the end reading' ? me.end : (me.start ? 'Enter the start meter reading' : 'Enter the end meter reading'));
                items.push({ k: 'meter', card: 'meters', t: 'End meter reading', n: mn, done: !Object.keys(me).length });
                if(vm.bk_start_changed()){ items.push({ k: 'start', card: 'meters', t: 'Start reading confirmed', n: 'Confirm the start reading', done: !!vm.bk.startAck }); }
            } else if(vm.bk_meters_shown() && (meter_errs(false).end || meter_errs(false).start)){
                items.push({ k: 'meter', card: 'meters', t: 'Meter readings', n: meter_errs(false).start || meter_errs(false).end, done: false });
            }
            var ft = vm.bk_ft(), from = b.from_airfield && (b.from_airfield.id || b.from_airfield.id === 0) && b.from_airfield.title, to = b.to_airfield && b.to_airfield.title;
            items.push({ k: 'route', card: 'land', t: 'Route', n: !ft ? 'Choose the flight type' : !from ? 'Choose where you took off' : 'Choose the destination',
                         done: !!ft && !!from && (!vm.bk_needs_to() || !!to) });
            items.push({ k: 'land', card: 'land', t: 'Landings counted', n: 'Count your landings', done: vm.bk_land_total() > 0 || vm.bk.noLand });
            items.push({ k: 'def', card: 'def', t: 'New defects answered', n: 'Answer “Any new defects?”', done: !!vm.bk.defMode });
            var ce = first_key(crew_errs());
            items.push({ k: 'crew', card: 'crew', t: 'Crew & lesson', n: ce || 'Check crew & lesson', done: !ce });
            var pending = items.filter(function(i){ return !i.done; });
            if(!pending.length && vm.quote && !vm.quote.complete){
                items.push({ k: 'charges', card: 'charges', t: 'Charges worked out', n: vm.quote.error === 'UNAVAILABLE' ? 'Work out the charges again (the server didn\'t answer)' : 'The charges can\'t be worked out yet — check the times and readings', done: false });
            }
            var nUp = (vm.lubricant_receipts || []).length;
            opt.push({ k: 'fuel', card: 'fuel', t: nUp ? 'Fuel & oil · ' + nUp + ' added' : 'Fuel & oil (optional)', opt: true, done: nUp > 0 });
            var left = items.filter(function(i){ return !i.done; });
            var done = items.length - left.length;
            return { items: items, opt: opt, left: left, total: items.length, done: done, pct: items.length ? Math.round(done / items.length * 100) : 100, all: !left.length,
                     dash: (2 * Math.PI * 23), off: (2 * Math.PI * 23) * (1 - (items.length ? done / items.length : 1)) };
        }
        function ready_key(){
            var b = vm.bookout || {};
            return [vm.bk.loaded, vm.has_used_claimed_flight, vm.bk.t.off, vm.bk.t.to, vm.bk.t.ld, vm.bk.t.on, b.start_tacho, b.end_tacho, vm.start_tacho_orig, vm.bk.startAck,
                    b.flight_type && b.flight_type.id, b.from_airfield && b.from_airfield.title, b.to_airfield && b.to_airfield.title, b.landings, b.tng, b.remote_landings, vm.bk.noLand,
                    vm.bk.defMode, b.pic && b.pic.user_id, b.put_id, vm.quote && vm.quote.error, vm.quote && (vm.quote.fields || []).join(','), b.instructor_id, b.tuition_id, b.payer_id, vm.this_claim_was_instructional, vm.this_was_supervised_solo,
                    vm.split_flight, vm.split_flight_confirmation, (vm.lubricant_receipts || []).length, vm.quote && vm.quote.complete, vm.quote && vm.quote.quote_hash,
                    vm.ctx && vm.ctx.context_hash, vm.claim_a_flight && vm.claim_a_flight.length,
                    b.plane_charges && b.plane_charges.charge_type, vm.td && vm.td.mode].join('|');
        }
        $scope.$watch(ready_key, function(){ vm.bk.ready = build_ready(); });

        vm.bk_card_done = function(card){
            var r = vm.bk.ready;
            if(card === 'final'){ return r.all; }
            if(card === 'charges'){ return !!(vm.quote && vm.quote.complete); }
            var mine = r.items.filter(function(i){ return i.card === card; });
            if(!mine.length){ var o = r.opt.filter(function(i){ return i.card === card; })[0]; return !!(o && o.done); }
            return mine.every(function(i){ return i.done; });
        };
        vm.bk_ck_class = function(i, opt){
            return { 'ta-ck--opt': !!opt, 'ta-ck--done': i.done, 'ta-ck--bad': !i.done && !opt && vm.bk.showErr };
        };

        /* ═════ finishing: the one button (Finish card on desktop, the bottom bar on phones) ═════ */
        function viewer_is_payer(){ return !!(vm.bookout && vm.user.id == vm.bookout.payer_id); }
        function staff_here(){
            var c = vm.bookout && vm.bookout.club_id;
            return !!(vm.can_authorise || (vm.user.access && vm.user.access.super_admin && vm.user.access.super_admin.indexOf(c) > -1));
        }
        vm.bk_split_continue = function(){ return !!(vm.bookout && vm.bookout.fox_log_id > 0 && vm.split_flight_confirmation == 1); };
        // which finish this is — v1's pay sections, judged on the BOOKING total (v1 tested this leg only)
        vm.bk_mode = function(){
            if(vm.bk.ctxError){ return 'noperm'; }   // the server refused the context (FORBIDDEN): say so, nothing to finish
            var q = vm.quote;
            if(!q || !q.complete){ return 'incomplete'; }
            if(vm.bk_split_continue()){ return 'split'; }
            var due = q.booking_total;
            if(Math.abs(due) < 0.005){ return 'free'; }
            if(due < 0){ return 'credit'; }
            if(viewer_is_payer()){ return 'pay'; }
            if(staff_here() || vm.user.id == vm.bookout.instructor_id){ return 'invoice'; }
            return 'noperm';
        };
        // v1 counted the PIC as "the instructor" even when the PIC is the student on an authorised solo, so the student was sent
        // to the instructor's debrief page after paying ("Load Failed"). The viewer debriefs only as the booking's instructor,
        // or as a PIC who is an instructor. (The rest of v1's rule is unchanged.)
        vm.is_instructional_completion = function(){
            var b = vm.bookout || {};
            var hasStudent = (b.put_id > 0) || (b.put && b.put.user_id > 0) || vm.this_claim_was_instructional;
            var userIsInstructor = (b.instructor_id > 0 && vm.user.id == b.instructor_id) ||
                                   (vm.picIsInstructor() && ((b.pic_id > 0 && vm.user.id == b.pic_id) || (b.pic && b.pic.user_id > 0 && vm.user.id == b.pic.user_id)));
            return !!(hasStudent && userIsInstructor);
        };
        vm.bk_debriefs = function(){ return !!vm.is_instructional_completion() && !viewer_is_payer(); };
        vm.bk_student_first = function(){ var b = vm.bookout || {}; return vm.bk_first(b.put_id > 0 ? b.put_id : (b.put && b.put.user_id)) || vm.bk_first(b.payer_id) || 'the student'; };
        function bk_finish_parts_raw(){
            var mode = vm.bk_mode(), q = vm.quote, payer = vm.bk_first(vm.bookout && vm.bookout.payer_id);
            if(vm.bk.busy || vm.show_loading && vm.bk.loaded){ return { busy: true, t: 'Processing…', s: vm.pay && mode === 'pay' ? vm.pay.words() : '' }; }
            if(mode === 'incomplete'){ return { ic: 'fa-flag-checkered', t: 'Finish', s: '' }; }
            if(mode === 'split'){
                return vm.bk_debriefs() ? { ic: 'fa-clipboard-check', t: 'Finish part 1 & debrief ' + vm.bk_student_first(), s: 'Part 2 waits as an open flight' }
                                        : { ic: 'fa-cut', t: 'Book in part 1', s: 'Then part 2 · paid when the flight is finished' };
            }
            if(mode === 'free'){ return { ic: vm.bk_debriefs() ? 'fa-clipboard-check' : 'fa-flag-checkered', t: vm.bk_debriefs() ? 'Finish & debrief ' + vm.bk_student_first() : 'Finish · nothing to pay',
                                        s: package_used_line() || (vm.bk_debriefs() ? 'Nothing to pay' : 'Back to My Account') }; }
            if(mode === 'credit'){ return { ic: 'fa-flag-checkered', t: 'Finish · ' + money(-q.booking_total) + ' credit', s: vm.bk_debriefs() ? 'Then the debrief' : 'Back to My Account' }; }
            if(mode === 'pay' && vm.bk.committed && vm.pay && vm.pay.after){ return { ic: 'fa-lock', t: 'Pay ' + money(q.booking_total) + ' with the card', s: 'The flight is booked in' }; }
            if(mode === 'pay'){ return { ic: 'fa-lock', t: 'Finish & pay ' + money(q.booking_total), s: vm.pay ? vm.pay.words() : '' }; }
            if(mode === 'invoice'){
                return vm.bk_debriefs() ? { ic: 'fa-clipboard-check', t: 'Finish & debrief ' + vm.bk_student_first(), s: money(q.booking_total) + ' is invoiced to ' + payer }
                                        : { ic: 'fa-paper-plane', t: 'Finish & invoice ' + payer, s: money(q.booking_total) + ' goes to ' + person_name(vm.bookout.payer_id) };
            }
            return { ic: 'fa-lock', t: 'Finish', s: '', off: true };
        }
        vm.bk_finish_parts = function(){ return stable('bk_finish_parts' + '', bk_finish_parts_raw()); };
        function package_used_line(){
            var q = vm.quote; if(!q){ return ''; }
            var p = (q.packages_used || [])[0];
            return p ? hm(p.hours) + ' comes off your package' : '';
        }
        vm.bk_final_title = function(){ return vm.bk_mode() === 'pay' ? 'Finish & pay' : 'Finish'; };
        vm.bk_final_sub = function(){
            var mode = vm.bk_mode();
            if(vm.bk_debriefs() && mode !== 'pay'){ return 'Check the summary, then go straight to the debrief'; }
            if(mode === 'pay'){ return 'Check the summary, choose how to pay, then finish'; }
            return 'Check the summary, then finish';
        };
        // v1's rule (any sheet not booked from the tracker can add a leg) — kept, although the mockup hides it on tracker aircraft
        vm.bk_can_add_leg = function(){ return !!(vm.bookout && !(vm.bookout.fox_log_id > 0) && !vm.split_flight && vm.bk_mode() !== 'noperm'); };

        // Pressing Finish with things left: every missing item turns red, the page scrolls to the first and flashes it
        function stop_if_not_ready(){
            var r = build_ready(); vm.bk.ready = r;
            if(!r.left.length){ return false; }
            vm.bk.showErr = true;
            ToastService.warning(plural(r.left.length, 'thing') + ' left', r.left[0].n);
            vm.bk_goto(r.left[0].card);
            return true;
        }
        vm.bk_block = function(card){ vm.bk.showErr = true; vm.bk_goto(card); };

        /* ── the save: C4.3 POST plane_log_sheets/v2/book_in/{pls} — the server prices, saves, then charges. Split flights
              (and a refused SPLIT_NOT_SUPPORTED) stay on today's PUT plane_log_sheets/booking_in through v1's book_in_flight. ── */
        var IDEMPOTENCY_KEY = 'bki-' + $stateParams.id + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        vm.bk_use_commit = function(){
            if(vm.bk.legacy){ return false; }
            if(vm.split_flight == 1 || vm.split_flight_confirmation == 1 || vm.split_prev_leg || vm.is_split_flight == 1){ return false; }
            return !!(vm.quote && vm.quote.source === 'server');
        };
        var COMMIT_METHOD = { 'direct-debit': 'direct_debit', 'saved-card': 'saved_card', 'new-card': 'new_card', 'card-machine': 'card_machine' };
        // resolves { ok, data } — every refusal is said here, within the write guard's 150 ms
        function commit(method, extra, where_to){
            var obj = vm.book_in_flight(where_to || 'home', 'none', '', { buildOnly: true });
            if(!obj){ return $q.when({ ok: false }); }   // an acknowledgement is missing: book_in_flight scrolled to it
            ['invoice', 'pay_with', 'free_flight', 'paymentIntent', 'method', 'amount'].forEach(function(k){ delete obj[k]; });   // the server's, not ours
            var body = quote_inputs(); delete body._local;
            body.context_hash = vm.ctx && vm.ctx.context_hash;
            body.quote_hash = vm.quote && vm.quote.quote_hash;
            body.idempotency_key = IDEMPOTENCY_KEY;
            body.payment = angular.extend({ method: method }, extra || {});
            body.book_in = obj;
            vm.show_loading = true;
            return BookinV2Data.Commit(vm.bookout.id, body).then(function(data){
                vm.show_loading = false;
                if(data && data.success){ vm.bk.committed = data; return { ok: true, data: data }; }
                var code = (data && (data.error || (data.message && data.message.error))) || '';
                var msg = (data && ((typeof data.message === 'string' && data.message) || (data.message && data.message.message))) || '';
                if(code === 'QUOTE_CHANGED' || code === 'INCOMPLETE'){
                    if(data.quote){ apply_quote(normalise_quote(data.quote)); }
                    ToastService.warning(code === 'QUOTE_CHANGED' ? 'The charges changed' : 'Something is missing',
                        code === 'QUOTE_CHANGED' ? 'Nothing was saved. Check the new figures, then finish again.' : (msg || 'Nothing was saved. Fill in what is missing, then finish again.'));
                    vm.bk_goto(code === 'QUOTE_CHANGED' ? 'charges' : ((vm.bk.ready.left[0] || {}).card || 'charges'));
                    return { ok: false, error: code };
                }
                if(code === 'BOOKING_NOT_LINKABLE' || (code === 'FORBIDDEN' && vm.bk_linked() && /booking/i.test(msg))){   // C26: book it in without the booking
                    vm.bk.link = { booking_id: vm.bk.link && vm.bk.link.booking_id, ok: false, error: code, message: msg };
                    ToastService.warning('Not on your booking', (msg || 'This flight can\'t go on that booking.') + ' Nothing was saved: finish again to book it in on its own.');
                    schedule_quote(); load_context();
                    return { ok: false, error: code };
                }
                if(code === 'IN_PROGRESS'){ ToastService.warning('Already being booked in', 'This flight is being saved right now. Wait a moment, then try again.'); return { ok: false, error: code }; }
                if(code === 'SPLIT_NOT_SUPPORTED'){ vm.bk.legacy = true; return { ok: false, error: code, legacy: true }; }
                if(code === 'FORBIDDEN' && data.reason === 'CARD_MACHINE_STAFF_ONLY'){   // C10: nothing saved; the same quote works with another method
                    return { ok: false, error: 'CARD_MACHINE_STAFF_ONLY', message: msg || 'This club\'s card machine is for staff use.' };
                }
                if(code === 'FORBIDDEN'){ ToastService.warning('Not allowed', msg || 'You can\'t book this flight in.'); return { ok: false, error: code }; }
                if(code === 'VALIDATION_ERROR'){
                    var bad = data.fields || (data.message && data.message.fields) || [];
                    if(vm.quote && bad.length){ vm.quote.error = 'VALIDATION_ERROR'; vm.quote.fields = bad; vm.quote.complete = false; }
                    // the server's message names fields ("tacho_end must be …"): say it in the pilot's words, the fields turn red
                    var FW = { tacho_start: 'the start meter reading', tacho_end: 'the end meter reading', brakes_off: 'the brakes-off time', brakes_on: 'the brakes-on time', takeoff: 'the takeoff time', landing: 'the landing time',
                               full_stop_landings: 'the landings', touch_and_go: 'the touch & goes', payer_id: 'who pays', tuition_id: 'the tuition', pic_id: 'the pilot in command', put_id: 'the student', instructor_id: 'the instructor' };
                    var words = bad.map(function(f){ return FW[f] || null; }).filter(Boolean);
                    ToastService.warning('Check the flight', 'Nothing was saved: check ' + (words.length ? words.join(' and ') : 'the details') + ', then finish again.');
                    if(bad.indexOf('tacho_start') > -1 || bad.indexOf('tacho_end') > -1){ vm.bk.showErr = true; vm.bk_goto('meters'); }
                    return { ok: false, error: code };
                }
                // a server error / no connection: the body is the server's, not words for a pilot
                if(!data || (typeof data.status === 'number' && (data.status === 0 || data.status >= 500))){ msg = ''; }
                ToastService.error('Not booked in', msg || 'The server didn\'t answer — nothing was saved or charged. Try again in a moment.');
                return { ok: false, error: code || 'FAILED' };
            });
        }
        function normalise_quote(d){
            var q = angular.copy(d); delete q.context; delete q.success;
            q.source = 'server'; q.lines = q.lines || []; q.packages_used = q.packages_used || []; q.missing = q.missing || [];
            q.units = q.units || { basis: null, hours: null }; q.vat = q.vat || { registered: false, rate: 0, included: 0 };
            return q;
        }
        // after the commit: the server says where next (debrief / home)
        function after_commit(data, outcome){
            if(outcome){ vm.bk.outcome = outcome; }
            var where_to = vm.bk.outcome === 'next' ? 'next' : (data && data.next === 'debrief') ? 'debrief' : 'home';
            after_success_bookin(where_to, { success: true, split: null });
        }
        vm.bk_after_commit = after_commit;
        // a staff / free / credit finish, or "add another leg": nothing is charged here
        function finish_without_payment(outcome, legacy_fn){
            vm.bk.outcome = outcome;
            if(!vm.bk_use_commit()){ legacy_fn(); return; }
            vm.bk.busy = true;
            commit('pay_later', null, outcome === 'next' ? 'next' : 'home').then(function(res){
                vm.bk.busy = false;
                if(res.ok){ after_commit(res.data, outcome); return; }
                if(res.legacy){ legacy_fn(); }
            }, function(){ vm.bk.busy = false; });
        }

        vm.bk_finish = function(){
            if(vm.bk.busy || (vm.show_loading && vm.bk.loaded)){ return; }
            vm.bk.pk = null;
            // booked in already (new card): the button pays the card form
            if(vm.bk.committed && vm.pay && vm.pay.after){ vm.pay.go(); return; }
            if(stop_if_not_ready()){ return; }
            vm.bk.busy = true;
            vm.bk_fresh_quote().then(function(q){
                vm.bk.busy = false;
                if(stop_if_not_ready()){ return; }
                var mode = vm.bk_mode();
                if(mode === 'incomplete'){ ToastService.warning('Charges not ready', vm.bk_missing_words() ? 'Still needed: ' + vm.bk_missing_words() + '.' : 'The charges can\'t be worked out yet — check the times and readings.'); return; }
                if(mode === 'noperm'){ ToastService.warning('Not allowed', 'Only the pilot, the student, the payer or club staff can book this flight in.'); return; }
                if(mode === 'split'){ vm.bk.outcome = 'split'; vm.complete_flight = false; vm.book_in_flight('split'); return; }
                vm.complete_flight = true;   // v1: the "complete" step ran (paying_now)
                if(mode === 'free'){ finish_without_payment('free', function(){ vm.book_in_flight('home', 'free'); }); return; }
                if(mode === 'credit'){ finish_without_payment('credit', function(){ vm.book_in_flight((staff_here() && !viewer_is_payer()) ? 'debrief' : 'home'); }); return; }
                if(mode === 'invoice'){ finish_without_payment('invoice', function(){ vm.book_in_flight('debrief'); }); return; }
                if(mode === 'pay'){
                    if(!vm.pay || !vm.pay.ready()){ ToastService.warning('Choose how to pay', 'Pick a way to pay at the bottom of the page.'); vm.bk_goto('final'); return; }
                    vm.pay.go();
                }
            }, function(){ vm.bk.busy = false; });
        };
        // "Book in & add another leg — pay later" (v1's ADD ANOTHER LEG: not on tracker sheets)
        vm.bk_add_leg = function(){
            if(vm.bk.busy || (vm.show_loading && vm.bk.loaded)){ return; }
            if(stop_if_not_ready()){ return; }
            vm.bk.busy = true;
            vm.bk_fresh_quote().then(function(){
                vm.bk.busy = false;
                vm.complete_flight = false;
                finish_without_payment('next', function(){ vm.book_in_flight('next'); });
            }, function(){ vm.bk.busy = false; });
        };

        // no "done" step (decided): say what happened on the way out (instructors land on the debrief, members on My Account)
        vm.bk_arrival = function(where_to, data){
            vm.bk.leaveOk = true;   // saved: the navigation that follows doesn't ask
            if(data && data.split && data.split.plane_log_sheet_id > 0 && where_to !== 'debrief'){ return; }   // "Part 1 Booked In" says it
            var q = vm.quote || {}, due = q.booking_total, payer = person_name(vm.bookout.payer_id), o = vm.bk.outcome;
            var pay = vm.pay && vm.pay.paidWith;
            var sub;
            if(o === 'pay' && pay){ sub = pay.method === 'direct-debit' ? money(due) + ' added to your direct debit' : pay.method === 'card-machine' ? 'Paid ' + money(due) + ' at the card machine' : 'Paid ' + money(due) + ' ' + pay.words; }
            else if(o === 'free'){ sub = package_used_line() ? 'Nothing to pay · ' + package_used_line() : 'Nothing to pay'; }
            else if(o === 'credit'){ sub = money(-due) + ' credited to the account'; }
            else if(o === 'invoice'){ sub = money(due) + ' invoiced to ' + payer; }
            else if(o === 'machine_unpaid'){ sub = money(due) + ' to pay — it is on an invoice to ' + payer; }
            else if(o === 'next'){ sub = 'Now book out the next leg'; }
            else if(o === 'split'){ sub = 'Part 2 waits as an open flight'; }
            else { sub = ''; }
            if(o === 'pay_failed'){ sub = money(due) + ' is on an invoice to ' + payer + ' — ' + (String(vm.bk.payFailMsg || 'the payment didn\'t go through').replace(/[.\s]+$/, '')) + '. Pay it from Invoices & payments.'; }
            // the server says why (payment.detail, 11 Nov 2026: no usable Direct Debit any more, the club stopped collecting them …)
            if(o === 'dd_not_queued'){ sub = money(due) + ' is on an invoice to ' + payer + ' — ' + (vm.bk.ddFailMsg ? String(vm.bk.ddFailMsg).replace(/[.\s]+$/, '') + '.' : 'it couldn\'t be added to the direct debit.') + ' Pay it from Invoices & payments.'; }
            if(vm.pay && vm.pay.chargedRef){ return; }   // "Your card was charged — don't pay again" already said it all
            if(o === 'machine_unpaid' || o === 'pay_failed' || o === 'dd_not_queued'){ ToastService.warning('Flight booked in · not paid yet', sub); }
            else { ToastService.success('Flight booked in', sub, { confetti: false }); }
        };

        /* ═════ paying (the pay choice in the Finish card) ═════ */
        vm.bk_pay_needed = function(){ return vm.bk.loaded && vm.bk_mode() === 'pay'; };
        var pay_key = null;
        $scope.$watch(function(){ return vm.bk_pay_needed() ? (vm.bookout.payer_id + '|' + vm.bookout.club_id) : null; }, function(key){
            if(!key || key === pay_key){ return; }
            pay_key = key;
            prepare_pay();
        });
        function prepare_pay(){
            var club_id_confirmed = (vm.bookout.booking && vm.bookout.booking.club_id > 0) ? vm.bookout.booking.club_id : vm.bookout.club_id;
            if(!vm.pay){
                vm.pay = BookinV2Payment.create({
                    clubId: function(){ return club_id_confirmed; },
                    // complete_this_flight's two reads: members/{payer}/info/{club} (mandate + reader) and the payer's saved cards
                    mandate: function(payer, club){ return MemberService.GetMandate(payer, club); },
                    cards: function(payer, club){ return PaymentService.GetMemberCards({ user_id: payer, club_id: club, membership_id: 1 }); },
                    amount: function(){ return vm.quote ? vm.quote.booking_total : null; },
                    money: money,
                    staff: staff_here,
                    // v1's send (the browser total) for direct debit / cards — today's routes (§1 item 9 until C4)
                    send: function(){ return vm.send; },
                    onConfirm: function(method, paymentIntent){ vm.bk.outcome = 'pay'; return vm.donConfirm(method, paymentIntent); },   // today's route (split flights)
                    // C4.3: save first, then charge by the new invoice
                    useCommit: vm.bk_use_commit,
                    commit: function(method, extra){ vm.bk.outcome = 'pay'; return commit(COMMIT_METHOD[method] || method, extra, machine_where_to()).then(function(res){
                        if(!res.ok && res.legacy){ return { ok: false, legacy: true }; }   // the factory falls back to today's route
                        return res; }); },
                    onCommitted: function(data, how, msg){
                        if(how === 'failed'){ vm.bk.payFailMsg = msg || (data.payment && data.payment.message) || ''; after_commit(data, 'pay_failed'); return; }
                        if(how === 'not_queued'){ vm.bk.ddFailMsg = (data.payment && data.payment.detail) || ''; after_commit(data, 'dd_not_queued'); return; }
                        after_commit(data, 'pay');
                    },
                    // C3: the reader is started with invoice_id (commit) / booking_id (today's route) — never an amount
                    machineSend: machine_send_for,
                    onMachinePaid: machine_paid,
                    onMachineStopped: machine_stopped,
                    onMachineRefused: function(){ vm.bk_goto('final'); }
                });
            }
            vm.pay.load(vm.bookout.payer_id, club_id_confirmed);
        }
        var machine_saved = null;   // { data, where_to, booking_id | invoice_id } once the flight is booked in for a card machine payment
        function machine_send_for(){
            if(!vm.bk_use_commit()){ return machine_book_in_first(); }
            if(machine_saved && machine_saved.invoice_id){ return $q.when(machine_send()); }
            vm.bk.outcome = 'pay';
            return commit('card_machine', null, machine_where_to()).then(function(res){
                if(!res.ok){
                    if(res.legacy){ return machine_book_in_first(); }
                    if(res.error === 'CARD_MACHINE_STAFF_ONLY'){ return $q.reject({ booked_in: false, staffOnly: true, message: res.message }); }
                    return $q.reject({ booked_in: false });
                }
                machine_saved = { data: res.data, where_to: res.data.next === 'debrief' ? 'debrief' : 'home', invoice_id: res.data.invoice_id, committed: true };
                if(!(res.data.invoice_id > 0)){ vm.bk.machineUnpaid = 'no_booking'; return $q.reject({ booked_in: true }); }
                return machine_send();
            });
        }
        function machine_where_to(){
            if(vm.user.id !== vm.bookout.payer_id && (vm.user.id == vm.bookout.pic_id || vm.user.id == vm.bookout.instructor_id)){ return 'debrief'; }
            return vm.is_instructional_completion() ? 'debrief' : 'home';
        }
        function machine_book_in_first(){
            if(machine_saved){ return $q.when(machine_send()); }
            var where_to = machine_where_to(), saved = null;
            vm.bk.outcome = 'pay';
            vm.complete_flight = true;   // paying_now with no method: the invoice is issued, then the reader takes it
            var p = vm.book_in_flight(where_to, 'none', '', { onSaved: function(data, w){ saved = { data: data, where_to: w }; } });
            if(!p || !p.then){ return $q.reject({ booked_in: false }); }
            return p.then(function(){
                if(!saved){ return $q.reject({ booked_in: false }); }   // refused: book_in_flight has said why
                return resolve_booking_id(saved.data).then(function(booking_id){
                    machine_saved = { data: saved.data, where_to: saved.where_to, booking_id: booking_id };
                    if(!(booking_id > 0)){
                        vm.bk.machineUnpaid = 'no_booking';
                        vm.bk.dlg = 'machine';
                        return $q.reject({ booked_in: true });
                    }
                    vm.bk.dlg = 'machine';
                    return machine_send();
                });
            });
        }
        function machine_send(){
            if(machine_saved.invoice_id){ return { club_id: vm.bookout.club_id, user_id: vm.bookout.payer_id, invoice_id: machine_saved.invoice_id }; }
            return { club_id: vm.bookout.club_id, user_id: vm.bookout.payer_id, booking_id: machine_saved.booking_id };
        }
        // a claimed tracker sheet with no booking gets one when it is booked in: read it back from the sheet
        function resolve_booking_id(data){
            if(vm.bookout.booking_id > 0){ return $q.when(vm.bookout.booking_id); }
            return BookingService.GetForBookIn(vm.bookout.id).then(function(r){
                return (r && r.bookout && r.bookout.booking_id > 0) ? r.bookout.booking_id : 0;
            }, function(){ return 0; });
        }
        function machine_paid(paymentIntent){
            var s = machine_saved;
            // the commit's invoice: cards/check_payment already marked it paid (the intent was made for that invoice)
            if(s.committed){ vm.pay.paidWith = { method: 'card-machine', words: 'at the card machine' }; vm.bk.outcome = 'pay'; after_success_bookin(s.where_to, { success: true, split: null }); return $q.when(true); }
            return BookoutService.PayBooking(s.booking_id, {
                payer_id: vm.bookout.payer_id || vm.bookout.user_id, user_id: vm.bookout.user_id, club_id: vm.bookout.club_id,
                plane_id: vm.bookout.plane_id, booking_id: s.booking_id, paying_now: true, free_flight: false,
                method: 'card-machine', paymentIntent: paymentIntent
            }).then(function(data){
                if(!data || data.success === false){
                    ToastService.warning('Payment taken · not matched yet', (data && typeof data.message === 'string' && data.message) || 'The card machine took the payment; the club will match it to the invoice.');
                }
                vm.pay.paidWith = { method: 'card-machine', words: 'at the card machine' };
                vm.bk.outcome = 'pay';
                after_success_bookin(s.where_to, s.data);
            });
        }
        // cancelled / closed / refused after the flight was saved: it stays booked in with the invoice to pay
        function machine_stopped(reason){
            if(!machine_saved){ return; }
            vm.bk.machineUnpaid = reason || 'closed';
        }
        vm.bk_machine_done = function(){
            var s = machine_saved; if(!s){ vm.pay.closeMachine(); return; }
            vm.pay.mach = null; vm.bk.dlg = null;
            vm.bk.outcome = 'machine_unpaid';
            after_success_bookin(s.where_to, s.data);
        };
        vm.bk_booked_in_unpaid = function(){ return !!machine_saved; };
        vm.bk_pay_later = function(){ var d = vm.bk.committed; vm.bk.outcome = 'machine_unpaid'; after_success_bookin(d && d.next === 'debrief' ? 'debrief' : 'home', { success: true, split: null }); };

        /* ═════ scrolling + the flash on the card it lands on ═════ */
        vm.bk_goto = function(card){
            vm.bk.pk = null;
            $timeout(function(){
                var el = document.getElementById('bki-c-' + card); if(!el){ return; }
                var head = document.getElementById('main_header2');   // 12px under the app header, whatever its height
                var top = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - ((head ? head.offsetHeight : 50) + 12);
                try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch(e){ window.scrollTo(0, Math.max(0, top)); }
            }, 30);
            vm.bk.flash = card;
            $timeout(function(){ if(vm.bk.flash === card){ vm.bk.flash = null; } }, 1300);
        };
        vm.bk_next_item = function(){ return vm.bk.ready.left[0] || null; };

        /* ═════ the hero ═════ */
        vm.bk_reg = function(){ var b = vm.bookout || {}; return (b.aircraft && b.aircraft.registration) || (b.booking && b.booking.registration) || b.registration || ''; };
        vm.bk_type = function(){ var a = (vm.bookout && vm.bookout.aircraft) || {}; return a.plane_type || ''; };
        vm.bk_model = function(){ var a = (vm.bookout && vm.bookout.aircraft) || {}; return bkV2MakeModel(a.manufacturer ? title_case(a.manufacturer.replace(/ AIRCRAFT.*| CORP.*| INC.*/i, '')) : '', a.type_name ? title_case(a.type_name) : ''); };
        function title_case(s){ return String(s || '').toLowerCase().replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); }); }
        vm.bk_ac_colour = function(){ var a = (vm.bookout && vm.bookout.aircraft) || {}; return a.colour || 'var(--ta-brand-2)'; };
        // "Fri 6 Nov, 09:00–11:00" (the claim panel's best matches)
        vm.bk_booking_when = function(){ var s = vm.bk_booking_slot(); return fday(vm.bookout && vm.bookout.flight_date) + (s ? ', ' + s.replace(/^Booking /, '') : ''); };
        vm.bk_booking_slot = function(){
            var bk = vm.bookout && vm.bookout.booking; if(!bk || !bk.start){ return ''; }
            return 'Booking ' + String(bk.start).slice(11, 16) + '–' + String(bk.end || '').slice(11, 16);
        };
        vm.bk_booked_out_at = function(){
            var b = vm.bookout || {}, c = b.created_at ? String(b.created_at) : '';
            if(c && b.flight_date && c.slice(0, 10) === String(b.flight_date).slice(0, 10)){ return c.slice(11, 16); }
            return b.flight_date ? fday(b.flight_date) : '—';
        };
        function bk_return_raw(){
            var bk = vm.bookout && vm.bookout.booking; if(!bk || !bk.end){ return null; }
            var end = new Date(String(bk.end).replace(' ', 'T')), now = new Date();
            if(isNaN(end.getTime())){ return null; }
            var mins = Math.round((end - now) / 60000), sameDay = iso_day(end) === iso_day(now);
            var d = function(m){ m = Math.abs(m); var h = Math.floor(m / 60), mm = m % 60; return h ? h + 'h ' + ('0' + mm).slice(-2) + 'm' : mm + ' min'; };
            return { v: String(bk.end).slice(11, 16), late: mins < 0,
                     s: !sameDay ? fday(String(bk.end).slice(0, 10)) : (mins < 0 ? d(mins) + ' late' : 'in ' + d(mins)) };
        }
        vm.bk_return = function(){ return stable('bk_return' + '', bk_return_raw()); };
        function bk_crew_fact_raw(){
            var b = vm.bookout || {};
            if(!(b.pic && b.pic.user_id > 0)){ return { v: '—', s: 'Choose the crew below' }; }
            if((vm.this_claim_was_instructional && !vm.this_was_supervised_solo) && b.put_id > 0){ return { v: vm.bk_first(b.pic_id) + ' · ' + vm.bk_first(b.put_id), s: 'Dual lesson' }; }
            if(vm.this_was_supervised_solo){ return { v: person_name(b.pic_id), s: 'Solo · authorised by ' + (vm.bk_first(b.instructor_id) || '…') }; }
            return { v: person_name(b.pic_id), s: 'Self-fly hire' };
        }
        vm.bk_crew_fact = function(){ return stable('bk_crew_fact' + '', bk_crew_fact_raw()); };

        /* ═════ the tracker: unclaimed flights on this aircraft ═════ */
        function booking_day(){ var bk = vm.bookout && vm.bookout.booking; return (bk && bk.start) ? String(bk.start).slice(0, 10) : String((vm.bookout && vm.bookout.flight_date) || '').slice(0, 10); }
        function booking_start_min(){ var bk = vm.bookout && vm.bookout.booking; return (bk && bk.start) ? to_min(String(bk.start).slice(11, 19)) : null; }
        function best_matches(){
            var bd = booking_day(), st = booking_start_min(), all = vm.claim_a_flight || [];
            var key = all.length + '|' + bd + '|' + st;
            if(vm.bk._best_key === key){ return vm.bk._best; }
            var day = all.filter(function(f){ return String(f.flight_date).slice(0, 10) === bd; });
            if(st !== null){ day.sort(function(a, b){ return Math.abs((to_min(a.brakes_off) || 0) - st) - Math.abs((to_min(b.brakes_off) || 0) - st); }); }
            vm.bk._best_key = key; vm.bk._best = day.slice(0, 3);
            return vm.bk._best;
        }
        vm.bk_flight_cards = function(){ var all = vm.claim_a_flight || []; return all.length > 5 ? best_matches() : all; };
        vm.bk_many_flights = function(){ return (vm.claim_a_flight || []).length > 5; };
        vm.bk_other_day = function(f){ return String(f.flight_date).slice(0, 10) !== booking_day(); };
        var flight_txt_cache = {};
        vm.bk_flight_txt = function(f){
            var key = f.id + '|' + (vm.td && vm.td.mode);
            if(flight_txt_cache[key]){ return flight_txt_cache[key]; }
            var v = TimeDisplayService.pick(f, vm.td.mode);
            var from = f.from_airport || {}, to = f.to_airport || {}, local = from.id && from.id === to.id;
            var n = (parseInt(f.full_stop_landings, 10) || 0) + (parseInt(f.touch_and_go, 10) || 0);
            var other = v.window === 'airborne' ? ('block ' + (span_hm(roundTimeToMinute(f.brakes_off), roundTimeToMinute(f.brakes_on)) || '—'))
                                                : ('airborne ' + (span_hm(roundTimeToMinute(f.takeoff_time), roundTimeToMinute(f.landing_time)) || '—'));
            var stops = (f.stops || []).length;
            var out = { t: fday(f.flight_date) + ' · ' + (v.window === 'airborne' ? 'airborne' : 'block') + ' ' + v.from + '–' + v.to,
                        s: (local ? (from.code || '') + ' ' + af_name(from) + ', local' : (from.code || '') + ' → ' + (to.code || '') + ' ' + af_name(to)) + ' · ' + plural(n, 'landing') + ' · ' + other + (stops ? ' · ' + plural(stops, 'ground stop') : ''),
                        tip: (f.times_amended ? 'Amended times: brakes ' : 'Recorded: brakes ') + (roundTimeToMinute(f.brakes_off) || '—') + '–' + (roundTimeToMinute(f.brakes_on) || '—') + ', airborne ' + (roundTimeToMinute(f.takeoff_time) || '—') + '–' + (roundTimeToMinute(f.landing_time) || '—') };
            flight_txt_cache[key] = out;
            return out;
        };
        function af_name(a){ var t = String((a && a.title) || '').replace(/ (Aerodrome|Airport|Airfield)$/i, ''); return t; }
        vm.bk_af_name = af_name;
        vm.bk_use_flight = function(f){
            f = f || (vm.claim_a_flight || []).find(function(x){ return x.id === vm.bk.pick; });
            if(!f){ return; }
            vm.bk.pk = null;
            vm.bk.pick = f.id;
            vm.claimed_flight = f;
            pre_claim_snapshot = snapshot_manual();
            var ok = $scope.claim_my_flight();
            if(ok === false && vm.different_date_warning){ vm.bk.dlg = 'mismatch'; return; }
            after_claim();
        };
        vm.bk_claim_force = function(){
            vm.bk.dlg = null; vm.different_date_warning = false;
            $scope.claim_my_flight(true);
            after_claim();
        };
        vm.bk_mismatch_back = function(){ vm.bk.dlg = null; vm.different_date_warning = false; vm.claimed_flight = {}; };
        function after_claim(){
            vm.bk.landEdited = false;
            ToastService.success('From the tracker', 'Times and landings filled in from ' + vm.bk_reg() + '\'s tracker.', { confetti: false });
        }
        // "Enter the times myself": back to the manual entry this page had before the claim
        var pre_claim_snapshot = null;
        var MANUAL_KEYS = ['from_airfield', 'to_airfield', 'flight_type', 'flight_date', 'brakes_off_rounded', 'brakes_on_rounded', 'brakes_off', 'brakes_on',
                           'touch_and_go', 'landings', 'full_stop_landings', 'stops', 'track_counts_source', 'tng', 'fox_log_id', 'fox_claimed', 'takeoff_time',
                           'landing_time', 'takeoff_rounded', 'landing_rounded', 'claimed_fox_plane_log_sheet_id', 'tpc_flight_time', 'tpc_brakes_off', 'tpc_brakes_on'];
        function snapshot_manual(){ var s = {}; MANUAL_KEYS.forEach(function(k){ s[k] = angular.copy(vm.bookout[k]); }); s._units = angular.copy(vm.flight_units); return s; }
        vm.bk_unclaim = function(){
            var s = pre_claim_snapshot; if(!s){ return; }
            MANUAL_KEYS.forEach(function(k){ vm.bookout[k] = s[k]; });
            vm.flight_units = s._units;
            vm.has_used_claimed_flight = false;
            vm.claimed_flight = {};
            vm.this_pls_id_raw = 0;
            vm.split_flight = 0; vm.split_flight_confirmation = 0; vm.split_choices = []; vm.split_flight_time = null;
            vm.split_one = {}; vm.split_two = {};
            vm.bk.t = { off: '', to: '', ld: '', on: '' };
            vm.bk_time_changed('off');
            pre_claim_snapshot = null;
            vm.calculate_invoice_for_flight();
        };
        vm.bk_can_unclaim = function(){ return !!pre_claim_snapshot && vm.has_used_claimed_flight && !vm.split_flight_confirmation; };

        /* ═════ split this flight ═════ */
        vm.bk_split_can = function(){ return !!(vm.split_flight == 0 && vm.split_flight_confirmation == 0 && ((vm.bookout.stops || []).length > 0 || (vm.has_used_claimed_flight && vm.bookout.fox_log_id > 0))); };
        vm.bk_split_open = function(){ vm.split_this_flight(); };
        vm.bk_split_choose = function(c){
            if(!c || c.selectable === false){ return; }
            vm.split_flight_time = c;
            vm.update_split();
        };
        // C18: how the taxi time of a split flight is charged (TPC-timing clubs only). The server decides at the save:
        // part 2 flown solo → dual_to_solo (its own wording); otherwise the club's split_taxi_mode: once → taxi_once (leg 1 takeoff −5 →
        // landing, a later leg its own takeoff → landing +5: the time parked between legs isn't charged), each_leg → standard. Default once.
        // Shown as information — the save path only takes the admin's first_only_taxi as a per-flight override.
        vm.bk_split_taxi = function(){
            var club = vm.ctx && vm.ctx.club;
            var tpc = club && club.tpc_charging !== undefined ? !!club.tpc_charging : is_tpc_charging();
            if(!tpc){ return null; }
            var solo = vm.split_crew_mode === 'solo';
            var once = solo || String((club && club.split_taxi_mode) || 'once') !== 'each_leg';
            return stable('split_taxi', { once: once, solo: solo, club: !solo });
        };
        // a ground stop as the mockup words it: "10:10–10:15" (club display) / "Stop-and-go · on the ground 10:12–10:16 (recorded)"
        // "1.3 h × £168.00 an hour = £218.40": the amount is the quote's aircraft line (only when it charges the whole difference)
        // what was paid for an uplift, in its own currency ("£98.00", "€61.20")
        var up_fmt = {};
        vm.bk_up_paid = function(r){
            var cur = String((r && r.currency) || 'GBP').toUpperCase(), n = Number(r && r.price) || 0;
            if(!/^[A-Z]{3}$/.test(cur)){ return cur + n.toFixed(2); }
            if(!up_fmt[cur]){ try { up_fmt[cur] = new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur }); } catch(e){ up_fmt[cur] = { format: function(x){ return cur + ' ' + x.toFixed(2); } }; } }
            return up_fmt[cur].format(n);
        };
        // the VAT inside the whole booking: the quote's (this leg, C4.2 vat.included) + the earlier legs' invoice items (their own vat_rate)
        vm.bk_booking_vat = function(){
            var q = vm.quote; if(!q || !q.vat){ return 0; }
            var v = Number(q.vat.included) || 0;
            (vm.invoices || []).forEach(function(f){ (f.items || []).forEach(function(it){
                var r = (it.vat_rate === undefined || it.vat_rate === null || it.vat_rate === '') ? (Number(q.vat.rate) || 0) : Number(it.vat_rate) || 0;
                if(r > 0){ v += (Number(it.total) || 0) * r / (100 + r); }
            }); });
            return Math.round(v * 100) / 100;
        };
        vm.bk_meter_amount = function(){
            var q = vm.quote, d = vm.bk_meter_diff(); if(!q || !q.complete || d === null){ return ''; }
            var l = (q.lines || []).filter(function(x){ return x.key === 'aircraft'; })[0];
            return l && Math.abs((Number(l.units) || 0) - d) < 0.001 ? ' = ' + money(l.amount) : '';
        };
        vm.bk_split_title = function(c){ return c && c.from_hm ? shown(c.from_hm) + (c.to_hm && c.to_hm !== c.from_hm ? '–' + shown(c.to_hm) : '') : (c ? c.time : ''); };
        vm.bk_split_sub = function(c){
            if(!c){ return ''; }
            var cap = function(t){ return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
            if(c.selectable === false){ return cap((c.kind_label || 'tracker gap') + ' — the track stays airborne, so it can\'t be a split point'); }
            return cap([c.kind_label, c.from_hm ? 'on the ground ' + c.from_hm + '–' + c.to_hm + ' (recorded)' : '', c.warning].filter(Boolean).join(' · '));
        };
        vm.bk_split_close = function(){
            // nothing confirmed yet: just close the panel (v1's CANCEL SPLIT also restored the sheet)
            vm.split_flight = 0; vm.split_flight_time = null; vm.split_one = null; vm.split_two = null; vm.split_phantom = null; vm.split_at = null;
        };
        vm.bk_split_part = function(p, k){ // p: split_one | split_two; k: off|to|ld|on → the time shown
            if(!p){ return '—'; }
            var raw = { off: time_str(p.brakes_off), to: time_str(p.takeoff_time), ld: time_str(p.landing_time), on: time_str(p.brakes_on) }[k];
            var r = { off: p.brakes_off_rounded, on: p.brakes_on_rounded, to: p.takeoff_rounded, ld: p.landing_rounded }[k];
            return shown(raw, r) || '—';
        };
        vm.bk_split_raw = function(p, k){ if(!p){ return ''; } var raw = { off: time_str(p.brakes_off), to: time_str(p.takeoff_time), ld: time_str(p.landing_time), on: time_str(p.brakes_on) }[k]; return raw ? 'Recorded ' + roundTimeToMinute(raw) : ''; };

        // the hypothetical split's part 1 becomes the sheet being booked in (v1's confirm_split): keep the sheet's own fields
        // (id, rates, aircraft, booking…) when the split answer leaves them out
        var v1_confirm_split = vm.confirm_split;
        vm.confirm_split = function(){
            if(vm.split_one){
                ['id', 'club_id', 'plane_id', 'booking_id', 'user_id', 'plane_charges', 'tuition_charges', 'tuition_required', 'aircraft', 'fox_log_id', 'fox_claimed',
                 'flight_date', 'from_airport', 'to_airport', 'from_airfield', 'to_airfield', 'flight_type', 'stops', 'track_counts_source', 'registration', 'booking', 'user', 'last_tacho', 'start_tacho', 'end_tacho']
                    .forEach(function(k){ if(vm.split_one[k] === undefined && vm.bookout[k] !== undefined){ vm.split_one[k] = vm.bookout[k]; } });
            }
            v1_confirm_split();
            vm.calculate_invoice_for_flight();
        };

        /* ═════ fuel & oil ═════ */
        function receipt_state(r){
            if(r.reimbursement != 1){ return { tone: 'muted', label: 'Not claimed', icon: '' }; }
            if(r.approved == 1){ return { tone: 'good', label: 'Claim approved', icon: 'fa-check' }; }
            if(r.approved == 2){ return { tone: 'bad', label: 'Claim declined', icon: 'fa-times-circle' }; }
            return { tone: 'pend', label: 'Awaiting the club\'s approval', icon: 'fa-hourglass-half' };
        }
        vm.bk_receipt_state = receipt_state;
        vm.bk_up_open = function(){
            vm.receipt = { image: '', quantity: 0, price: 0, reimbursement: false, item: { title: 'Fuel' },
                           currency: (vm.currencies || []).filter(function(c){ return c.iso_code == vm.club_currency; })[0] };
            vm.bk.up = { qty: '', price: '', err: {} };
        };
        vm.bk_up_cancel = function(){ vm.bk.up = null; };
        vm.bk_up_item = function(t){ vm.receipt.item = { title: t }; };
        vm.bk_up_sync = function(){
            var q = parseFloat(String(vm.bk.up.qty || '').replace(/,/g, '')), p = parseFloat(String(vm.bk.up.price || '').replace(/,/g, ''));
            vm.receipt.quantity = isNaN(q) ? 0 : q;
            vm.receipt.price = isNaN(p) ? 0 : p;
        };
        vm.bk_up_check = function(){ vm.bk_up_sync(); if(vm.receipt.reimbursement){ vm.check_reimbursement(); } };
        vm.bk_up_foreign = function(){ return !!(vm.receipt && vm.receipt.currency && vm.receipt.currency.iso_code !== vm.club_currency); };
        vm.bk_up_add = function(){
            vm.bk_up_sync();
            var er = {};
            if(!(vm.receipt.quantity > 0)){ er.qty = 'Enter how much you put in'; }
            if(vm.receipt.reimbursement && !(vm.receipt.price > 0)){ er.price = 'Enter what you paid to claim it back'; }
            if(vm.receipt.reimbursement && !vm.receipt.image){ er.receipt = 'Add a photo of the receipt to claim it back'; }
            if(!vm.receipt.currency){ er.price = 'Choose the currency'; }
            vm.bk.up.err = er;
            if(Object.keys(er).length){ return; }
            if(vm.bk.up.busy){ return; }   // one request per press: a double click lands here while the first is in flight
            var before = (vm.lubricant_receipts || []).length, what = vm.receipt.item && vm.receipt.item.title === 'Oil' ? 'Oil' : 'Fuel';
            var p = vm.add_receipt();
            if(!p || !p.then){ return; }
            vm.bk.up.busy = true;
            p.then(function(){
                if(vm.bk.up){ vm.bk.up.busy = false; }
                if((vm.lubricant_receipts || []).length > before){ vm.bk.up = null; ToastService.success(what + ' uplift added', '', { confetti: false }); }
            }, function(){ if(vm.bk.up){ vm.bk.up.busy = false; } });
        };
        function now_ms(){ return (window.performance && performance.now) ? performance.now() : new Date().getTime(); }   // a monotonic clock for the double-click guards
        // two-step delete: the second press within 0.4 s of arming is a double click, not a "yes"
        vm.bk_up_del = function(r){
            if(vm.bk.delUp === r.id){ if(now_ms() - (vm.bk.delArmedAt || 0) < 400 || vm.bk.delBusy){ return; } vm.bk.delUp = null; vm.bk.delBusy = r.id;
                var p = vm.delete_receipt(r.id); if(p && p.then){ p.then(function(){ vm.bk.delBusy = null; }, function(){ vm.bk.delBusy = null; }); } else { vm.bk.delBusy = null; } return; }
            vm.bk.delUp = r.id; vm.bk.delArmedAt = now_ms();
            $timeout(function(){ if(vm.bk.delUp === r.id){ vm.bk.delUp = null; } }, 3500);
        };
        // ng-flow: the receipt photo (same upload as v1, /upload.php on the API)
        vm.bk_receipt_uploaded = function($flow){ $scope.processFiles($flow.files); if(vm.bk.up && vm.bk.up.err){ vm.bk.up.err.receipt = null; } };

        /* ═════ defects ═════ */
        function sev_of(d){
            var s = String((d && d.severity) || '').toLowerCase();
            if(s.indexOf('no fly') > -1){ return SEVERITIES[0]; }
            if(s.indexOf('flyable') > -1){ return SEVERITIES[1]; }
            if(s.indexOf('not urgent') > -1){ return SEVERITIES[2]; }
            if(s.indexOf('unsure') > -1){ return SEVERITIES[3]; }
            return { key: 'other', short: d && d.severity ? d.severity : 'Reported', icon: 'fa-exclamation-circle', tone: 'warn' };
        }
        vm.bk_sev = sev_of;
        vm.bk_def_status = function(d){ var s = String((d && d.status) || 'open').toLowerCase(); return s === 'deferred' ? { tone: 'muted', label: 'Deferred', icon: 'fa-clock' } : { tone: 'warn', label: s.charAt(0).toUpperCase() + s.slice(1), icon: 'fa-exclamation-circle' }; };
        vm.bk_mine_count = function(){ return Object.keys(vm.bk.mine).length; };
        vm.bk_def_none = function(){ if(vm.bk_mine_count()){ return; } vm.bk.defMode = 'none'; };
        vm.bk_def_open = function(){
            // closing the dialog (Esc, the scrim, ×, Cancel) keeps what was typed: reopening brings the draft back
            var d = vm.bk.df, draft = d && (String(d.text || '').trim() || d.sev || (d.files && d.files.length));
            if(!draft){ vm.bk.df = { text: '', sev: null, files: [], busy: false }; }
            vm.bk.dlg = 'defect';
            $timeout(function(){ var t = document.getElementById('bki-df-text'); if(t){ t.focus(); } }, 60);
        };
        var IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'webp'], VID_EXT = ['mp4', 'mov', 'webm', 'avi', 'mkv', '3gp'];
        vm.bk_df_files = function(files){   // defectReportPanel's limits: 10 photos (20 MB) and 1 video (100 MB)
            var df = vm.bk.df; if(!df || !files){ return; }
            var imgs = df.files.filter(function(f){ return f._mediaType === 'image'; }).length, vids = df.files.filter(function(f){ return f._mediaType === 'video'; }).length;
            var skipped = 0;   // the limits only show when a file is refused (the mockup's dialog has no hint line)
            for(var i = 0; i < files.length; i++){
                var f = files[i], ext = (f.name.split('.').pop() || '').toLowerCase();
                var isImg = IMG_EXT.indexOf(ext) > -1 || (f.type || '').indexOf('image/') === 0, isVid = VID_EXT.indexOf(ext) > -1 || (f.type || '').indexOf('video/') === 0;
                if(!isImg && !isVid){ skipped++; continue; }
                if((isImg && f.size > 20 * 1024 * 1024) || (isVid && f.size > 100 * 1024 * 1024) || (isImg && imgs >= 10) || (isVid && vids >= 1)){ skipped++; continue; }
                f._mediaType = isImg ? 'image' : 'video';
                df.files.push(f);
                if(isImg){ imgs++; } else { vids++; }
            }
            if(skipped){ ToastService.warning(plural(skipped, 'file') + ' not added', 'Photos or videos only: up to 10 photos (20 MB each) and 1 video (100 MB).'); }
        };
        vm.bk_df_remove = function(i){ vm.bk.df.files.splice(i, 1); };
        vm.bk_df_submit = function(){
            var df = vm.bk.df; if(!df || df.busy || !String(df.text || '').trim() || !df.sev){ return; }
            df.busy = true;
            var obj = { club_id: vm.bookout.club_id, user_id: vm.bookout.user_id, plane_id: vm.bookout.plane_id,
                        defect: String(df.text).trim(), severity: df.sev.title, status: 'open' };
            PlaneService.AddDefect(obj).then(function(data){
                df.busy = false;
                if(!data || data.success === false || !data.item){
                    ToastService.error('Defect not reported', (data && typeof data.message === 'string' && data.message) || 'The defect could not be saved. Please try again.');
                    return;
                }
                data.item.can_delete = true;
                vm.reported_defects = vm.reported_defects || [];
                vm.reported_defects.unshift(data.item);
                vm.bk.mine[data.item.id] = true;
                vm.bk.defMode = 'reported';
                vm.bk.dlg = null;
                vm.bk.df = null;   // reported: the next report starts empty
                ToastService.success('Defect reported', 'The club\'s maintenance team can see it now.', { confetti: false });
                df.files.forEach(function(file, idx){
                    DefectMediaService.UploadAndAttach(file, data.item.id, vm.bookout.club_id, idx, vm.user.id).then(function(r){
                        if(r && r.success){ data.item.media_count = (parseInt(data.item.media_count, 10) || 0) + 1; }
                    });
                });
            }, function(){ df.busy = false; });
        };
        vm.bk_def_del = function(d){
            if(vm.bk.delDef !== d.id){ vm.bk.delDef = d.id; vm.bk.delArmedAt = now_ms(); $timeout(function(){ if(vm.bk.delDef === d.id){ vm.bk.delDef = null; } }, 3500); return; }
            if(now_ms() - (vm.bk.delArmedAt || 0) < 400){ return; }   // a double click, not a "yes"
            vm.bk.delDef = null;
            PlaneService.DeleteDefect(d.id).then(function(data){
                if(data && data.success === false){ ToastService.error('Not deleted', (typeof data.message === 'string' && data.message) || 'The defect report could not be deleted.'); return; }
                delete vm.bk.mine[d.id];
                if(!vm.bk_mine_count() && vm.bk.defMode === 'reported'){ vm.bk.defMode = null; }
                ToastService.success('Defect report deleted', '', { confetti: false });
                PlaneService.GetOpenIssues(vm.bookout.plane_id).then(function(list){
                    if(angular.isArray(list)){ list.forEach(function(x){ if(vm.bk.mine[x.id]){ x.can_delete = true; } }); vm.reported_defects = list; }
                });
            });
        };
        vm.bk_is_mine = function(d){ return !!vm.bk.mine[d.id]; };
        vm.bk_existing_defects = function(){ return (vm.reported_defects || []).filter(function(d){ return !vm.bk.mine[d.id]; }).length; };

        /* ═════ smart pickers (shared .ta-pick + .ta-pickmenu): pic, put, instr, course, tuition, from, to, flight ═════ */
        var PK_TITLE = { payer: 'Who pays', pic: 'Pilot in command', put: 'Student', instr: 'Authorising instructor', course: 'Course', tuition: 'Tuition received', from: 'From', to: 'To', flight: 'Tracker flights' };
        var PK_PH = { payer: 'Search', pic: 'Search members and instructors', put: 'Search members by name', instr: 'Search instructors', course: 'Search courses', tuition: 'Search tuition', from: 'Airfield name or ICAO code', to: 'Airfield name or ICAO code', flight: 'Date, time or airfield' };
        vm.bk_pk_title = function(f){ return PK_TITLE[f]; };
        vm.bk_pk_ph = function(f){ return PK_PH[f]; };
        vm.bk_pk_open = function(f){
            if(vm.bk.pk && vm.bk.pk.f === f){ vm.bk.pk = null; return; }
            vm.bk.pk = { f: f, q: '', hi: 0, chip: 'all', limit: 20, model: null };
            if(PK_PEOPLE[f]){ pk_people(); } else if(f === 'flight'){ pk_flights(false); }
            pk_build();
            var cur = pk_current(f), flat = vm.bk.pk.model.flat;
            for(var i = 0; i < flat.length; i++){ if(cur !== null && flat[i].id === cur){ vm.bk.pk.hi = i; break; } }
            $timeout(function(){ var q = document.getElementById('bki-pk-q'); if(q){ try { q.focus({ preventScroll: true }); } catch(e){ q.focus(); } } }, 40);
        };
        vm.bk_pk_close = function(){ vm.bk.pk = null; };
        var af_timer = null;
        vm.bk_pk_q = function(){
            var pk = vm.bk.pk; if(!pk){ return; }
            pk.hi = 0; pk.limit = 20;
            if(PK_PEOPLE[pk.f] || pk.f === 'flight'){
                if(pk_timer){ $timeout.cancel(pk_timer); }
                pk_timer = $timeout(function(){ if(vm.bk.pk === pk){ if(pk.f === 'flight'){ pk_flights(false); } else { pk_people(); } } }, 250);   // debounced, latest wins
            }
            if((pk.f === 'from' || pk.f === 'to') && pk.q.length > 2){
                if(af_timer){ $timeout.cancel(af_timer); }
                af_timer = $timeout(function(){ $scope.get_airfields(pk.q); }, 250);
            }
            pk_build();
        };
        vm.bk_pk_chip = function(c){ vm.bk.pk.chip = c; vm.bk.pk.hi = 0; vm.bk.pk.limit = 20; if(vm.bk.pk.fsrv && vm.bk.pk.fsrv.ok){ pk_flights(false); } pk_build(); };
        vm.bk_pk_more = function(){ var pk = vm.bk.pk; if(pk.f === 'flight' && pk.fsrv && pk.fsrv.ok){ pk_flights(true); return; } pk.limit += 20; pk_build(); };
        /* C27: people and tracker flights come from the server (the page's lists only when it doesn't answer) */
        var PK_PEOPLE = { pic: 1, put: 1, instr: 1 }, pk_seq = 0, pk_timer = null;
        function pk_people(){
            var pk = vm.bk.pk, q = String(pk.q || '').trim(), seq = ++pk_seq;
            pk.srv = angular.extend(pk.srv || {}, { loading: true });
            BookinV2Data.People(vm.bookout.id, q.length >= 2 ? q : '', pk.f, 20).then(function(d){
                if(seq !== pk_seq || vm.bk.pk !== pk){ return; }
                // one row per person (the server can send a member twice), the best name match first
                var uniq = function(list){ var seen = {}; return (list || []).filter(function(p){ if(!p || seen[p.user_id]){ return false; } seen[p.user_id] = 1; return true; }); };
                var ql = q.toLowerCase(), people = uniq(d && d.people);
                if(ql.length >= 2){ people.sort(function(x, y){ return rank_name(x.name, ql) - rank_name(y.name, ql) || String(x.name).localeCompare(String(y.name)); }); }
                pk.srv = (d && d.success) ? { ok: true, q: q.length >= 2 ? q : '', people: people, suggested: uniq(d.suggested), more: !!d.more, loading: false } : { ok: false, loading: false };
                (pk.srv.people || []).concat(pk.srv.suggested || []).forEach(remember_person);
                pk_build();
            });
        }
        function remember_person(p){ if(p && p.user_id > 0 && !person_of(p.user_id)){ vm.pics = vm.pics || []; vm.pics.push(p); } }   // names resolve after a pick
        // "5 Nov", "yesterday", "today" (the booking's day) go in as a date; anything else is an airfield or a time
        function flight_query(q){
            var t = String(q || '').trim().toLowerCase(), bd = booking_day(), o = { q: t, date: bd };
            var d0 = parse_date(bd) || new Date();
            if(t === 'today' || t === 'booking day'){ return { q: '', date: bd, day: true }; }
            if(t === 'yesterday'){ var y = new Date(d0); y.setDate(y.getDate() - 1); return { q: '', date: iso_day(y), day: true }; }
            var m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?(?:\s+(.*))?$/) || t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(.*))?$/);
            if(m){
                var mon = isNaN(+m[2]) ? MON.map(function(x){ return x.toLowerCase(); }).indexOf(m[2]) : +m[2] - 1;
                if(mon >= 0){ var yr = m[3] ? +(String(m[3]).length === 2 ? '20' + m[3] : m[3]) : d0.getFullYear(); var dd = new Date(yr, mon, +m[1], 12); if(!m[3] && dd > d0){ dd.setFullYear(yr - 1); }
                    return { q: m[4] || '', date: iso_day(dd), day: true }; }
            }
            return o;
        }
        function pk_flights(append){
            var pk = vm.bk.pk, fq = flight_query(pk.q), seq = ++pk_seq;
            var offset = append && pk.fsrv ? (pk.fsrv.next_offset || 0) : 0;
            pk.fsrv = angular.extend(pk.fsrv || {}, { loading: true });
            BookinV2Data.TrackerFlights(vm.bookout.id, { range: fq.day ? 'day' : pk.chip, date: fq.date, q: fq.q, limit: 20, offset: offset }).then(function(d){
                if(seq !== pk_seq || vm.bk.pk !== pk){ return; }
                if(!(d && d.success)){ pk.fsrv = { ok: false, loading: false }; pk_build(); return; }
                var prev = append && pk.fsrv && pk.fsrv.flights ? pk.fsrv.flights : [];
                pk.fsrv = { ok: true, loading: false, flights: prev.concat(d.flights || []), counts: d.counts || null, total: d.total, has_more: !!d.has_more, next_offset: d.next_offset, q: pk.q, date: fq.day ? fq.date : null };
                pk_build();
            });
        }
        $scope.$watch(function(){ return vm.airfields; }, function(){ if(vm.bk.pk && (vm.bk.pk.f === 'from' || vm.bk.pk.f === 'to')){ pk_build(); } });
        function pk_current(f){
            var b = vm.bookout || {};
            switch(f){
                case 'pic': return b.pic && b.pic.user_id; case 'put': return b.put && b.put.user_id; case 'instr': return b.instructor && b.instructor.user_id;
                case 'course': return b.course && b.course.id; case 'tuition': return b.tuition_required && b.tuition_required.id;
                case 'from': return b.from_airfield && b.from_airfield.id; case 'to': return b.to_airfield && b.to_airfield.id;
                case 'flight': return vm.bk.pick;
                case 'payer': return b.payer_id;
            }
            return null;
        }
        function rank_name(n, ql){ n = String(n || '').toLowerCase(); return n.indexOf(ql) === 0 ? 0 : (n.split(/\s+/).some(function(w){ return w.indexOf(ql) === 0; }) ? 1 : 2); }
        function person_item(p, why){
            var tags = [p.instructor == 1 ? 'Instructor' : 'Member'];
            var b = vm.bookout || {};
            if(why){ tags.push(why); } else if(p.user_id == b.user_id || (b.booking && p.user_id == b.booking.instructor_id)){ tags.push('on this booking'); }
            if(p._isBsMember){ tags.push('BookedScheduler'); }
            return { id: p.user_id, kind: 'person', p: p, t: p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim(), sub: tags.join(' · ') };
        }
        function pk_build(){
            var pk = vm.bk.pk; if(!pk){ return; }
            var q = String(pk.q || '').trim(), ql = q.toLowerCase(), groups = [], hint = '', foot = '', empty = null, more = false;
            var b = vm.bookout || {};
            // one row per person (a member can have two club rows): the instructor row wins
            var seen = {}, pics = [];
            (vm.pics || []).forEach(function(p){ var k = p.user_id; if(seen[k] === undefined){ seen[k] = pics.length; pics.push(p); } else if(p.instructor == 1 && pics[seen[k]].instructor != 1){ pics[seen[k]] = p; } });
            var match = function(p){ var n = ((p.name || '') + ' ' + (p.first_name || '') + ' ' + (p.last_name || '')).toLowerCase(); return n.indexOf(ql) > -1; };
            var notPic = function(p){ return !((pk.f === 'put' || pk.f === 'instr') && b.pic && p.user_id == b.pic.user_id); };
            if(PK_PEOPLE[pk.f] && pk.srv && pk.srv.ok){
                var S = pk.srv, byName = function(x, y){ return String(x.name).localeCompare(String(y.name)); };
                if(q.length < 2){
                    var sug = (S.suggested || []).filter(notPic).map(function(p){ return person_item(p, p.user_id == vm.user.id ? 'you' : null); });
                    if(sug.length){ groups.push({ label: 'Suggested', items: sug }); }
                    if(pk.f === 'instr'){ var rest = (vm.instructors || []).filter(notPic).filter(function(p){ return !sug.some(function(x){ return x.id == p.user_id; }); }).sort(byName);
                        if(rest.length){ groups.push({ label: 'All instructors · ' + rest.length, items: rest.map(function(p){ return person_item(p); }) }); } }
                    hint = S.loading ? 'Searching…' : 'Type 2 letters to search ' + (pk.f === 'instr' ? 'the club\'s instructors' : pk.f === 'put' ? 'the club\'s members' : 'the club\'s members and instructors');
                } else {
                    var res = (S.people || []).filter(notPic);
                    if(res.length){ groups.push({ label: 'Results', items: res.map(function(p){ return person_item(p); }) }); foot = S.more ? 'Showing ' + res.length + ' · keep typing to narrow it down' : plural(res.length, 'match', 'matches'); }
                    else if(!S.loading && S.q === q){ empty = { t: 'No one called ‘' + q + '’', s: 'Only the club\'s current members can be chosen. Check the spelling, or try the surname.' }; }
                    if(S.loading || S.q !== q){ hint = 'Searching…'; }
                }
            } else if(pk.f === 'flight' && pk.fsrv && pk.fsrv.ok){
                var FS = pk.fsrv;
                if(FS.counts){ pk.counts = FS.counts; }
                if((FS.flights || []).length){
                    groups.push({ label: FS.date ? fday(FS.date) : '', items: FS.flights.map(function(f){ var tx = vm.bk_flight_txt(f); return { id: f.id, kind: 'flight', f: f, t: tx.t, sub: tx.s, tip: tx.tip, other: vm.bk_other_day(f) }; }) });
                    foot = 'Showing ' + FS.flights.length + ' of ' + Number(FS.total || FS.flights.length).toLocaleString('en-GB'); more = FS.has_more;
                } else if(!FS.loading){ empty = { t: q ? 'No tracker flight matches ‘' + q + '’' : 'No tracker flights here', s: 'Try a date (5 Nov, yesterday), a time (09:2) or an airfield (EGTK, Oxford).' }; }
                if(FS.loading){ hint = 'Searching…'; }
            } else if(pk.f === 'pic' || pk.f === 'put'){
                if(q.length < 2){
                    var sug = [], add = function(id, why){ var p = pics.find(function(x){ return x.user_id == id; }); if(p && !sug.some(function(s){ return s.id === p.user_id; }) && !(pk.f === 'put' && b.pic && p.user_id === b.pic.user_id)){ sug.push(person_item(p, why)); } };
                    if(pk.f === 'pic'){ add(b.user_id, 'on this booking'); add(b.booking && b.booking.instructor_id, 'on this booking'); add(b.instructor_id, 'on this booking'); add(vm.user.id, 'you'); }
                    else { add(b.user_id, 'on this booking'); if(vm.split_prev_leg){ add(vm.split_leg_student_id(), 'part 1\'s student'); } }
                    if(sug.length){ groups.push({ label: 'Suggested', items: sug }); }
                    hint = 'Type 2 letters to search ' + pics.length.toLocaleString('en-GB') + (pk.f === 'pic' ? ' members and instructors' : ' members');
                } else {
                    var pool = pics.filter(function(p){ return match(p) && !(pk.f === 'put' && b.pic && p.user_id === b.pic.user_id); });
                    pool.sort(function(x, y){ return rank_name(x.name, ql) - rank_name(y.name, ql) || String(x.name).localeCompare(String(y.name)); });
                    if(pool.length){ groups.push({ label: 'Results', items: pool.slice(0, 8).map(function(p){ return person_item(p); }) }); foot = pool.length > 8 ? 'Showing 8 of ' + pool.length + ' · keep typing to narrow it down' : plural(pool.length, 'match', 'matches'); }
                    else { empty = { t: 'No one called ‘' + q + '’', s: 'Check the spelling, or try the surname.' }; }
                }
            } else if(pk.f === 'instr'){
                var ipool = (vm.instructors || []).filter(function(p){ return !(b.pic && p.user_id === b.pic.user_id); });
                if(!q){
                    var first = ipool.filter(function(p){ return p.user_id == (b.booking && b.booking.instructor_id) || p.user_id == vm.user.id; });
                    if(first.length){ groups.push({ label: 'Suggested · on this booking or you', items: first.map(function(p){ return person_item(p, p.user_id == vm.user.id ? 'you' : null); }) }); }
                    groups.push({ label: 'All instructors · ' + ipool.length, items: ipool.filter(function(p){ return first.indexOf(p) < 0; }).sort(function(x, y){ return String(x.name).localeCompare(String(y.name)); }).map(function(p){ return person_item(p); }) });
                } else {
                    var hits = ipool.filter(match).sort(function(x, y){ return rank_name(x.name, ql) - rank_name(y.name, ql) || String(x.name).localeCompare(String(y.name)); });
                    if(hits.length){ groups.push({ label: 'Results', items: hits.map(function(p){ return person_item(p); }) }); foot = plural(hits.length, 'instructor'); }
                    else { empty = { t: 'No instructor called ‘' + q + '’', s: 'Searching all ' + ipool.length + ' instructors.' }; }
                }
            } else if(pk.f === 'payer'){
                var po = ((vm.ctx && vm.ctx.payer_options) || []).filter(function(o){ return !ql || String(o.name || '').toLowerCase().indexOf(ql) > -1; });
                if(po.length){ groups.push({ label: 'Who the invoice goes to', items: po.map(function(o){ var p = person_of(o.user_id) || { user_id: o.user_id, name: o.name };
                    return { id: o.user_id, kind: 'person', p: p, t: o.name, sub: o.user_id == b.pic_id ? 'Pilot in command' : o.user_id == b.put_id ? 'Student' : o.user_id == b.user_id ? 'The booking\'s member' : '' }; }) }); }
                else { empty = { t: 'No one to choose', s: '' }; }
            } else if(pk.f === 'course'){
                var cs = (vm.club_courses || []).filter(function(c){ return String(c.title || '').toLowerCase().indexOf(ql) > -1; });
                var citems = cs.map(function(c){ return { id: c.id, kind: 'course', c: c, t: c.title, sub: (b.booking && c.id == b.booking.course_id) ? 'The booking\'s course' : '' }; });
                if(!q && b.course && b.course.id){ citems.unshift({ id: 0, kind: 'course', c: null, t: 'No course', sub: 'Clear the course' }); }
                if(citems.length){ groups.push({ label: '', items: citems }); } else { empty = { t: 'No course called ‘' + q + '’', s: '' }; }
            } else if(pk.f === 'tuition'){
                var ts = (vm.instructor_charges || []).filter(function(c){ return String(c.title || '').toLowerCase().indexOf(ql) > -1; });
                if(ts.length){ groups.push({ label: '', items: ts.map(function(c){ return { id: c.id, kind: 'tuition', c: c, t: c.title, sub: tuition_sub(c) }; }) }); }
                else { empty = { t: (vm.instructor_charges || []).length ? 'No tuition called ‘' + q + '’' : 'No tuition rates for this course', s: (vm.instructor_charges || []).length ? '' : 'Try another course, or none.' }; }
            } else if(pk.f === 'from' || pk.f === 'to'){
                var list = vm.airfields || [];
                try { list = $filter('orderAirfields')(list, vm.wgs_n, vm.wgs_e) || list; } catch(e){}
                var af = list.filter(function(a){ return !ql || String(a.title || '').toLowerCase().indexOf(ql) > -1 || String(a.code || '').toLowerCase().indexOf(ql) > -1 || a.id === 0; });
                if(af.length){ groups.push({ label: q.length > 2 ? 'Airfields' : 'Nearby airfields', items: af.slice(0, 40).map(function(a){ return { id: a.id, kind: 'airfield', a: a, t: (a.code && a.code !== 'ZZZZ' ? a.code + ' · ' : '') + vm.bk_af_label(a), sub: a.id === 0 ? 'Not in the list: it is added for the club to check' : (a.country || '') }; }) }); }
                else { empty = { t: q.length > 2 ? 'Searching…' : 'Type 3 letters of the name or code', s: '' }; }
                if(q.length < 3){ hint = 'Type 3 letters to search every airfield'; }
            } else if(pk.f === 'flight'){
                var bd = booking_day(), weekAgo = (function(){ var d = parse_date(bd) || new Date(); d.setDate(d.getDate() - 6); return iso_day(d); })();
                var all = vm.claim_a_flight || [];
                var fpool = all.filter(function(f){ var d = String(f.flight_date).slice(0, 10); return pk.chip === 'day' ? d === bd : pk.chip === 'week' ? (d >= weekAgo && d <= bd) : true; })
                               .filter(function(f){ return flight_match(f, ql); });
                pk.counts = { day: all.filter(function(f){ return String(f.flight_date).slice(0, 10) === bd; }).length,
                              week: all.filter(function(f){ var d = String(f.flight_date).slice(0, 10); return d >= weekAgo && d <= bd; }).length, all: all.length };
                if(fpool.length){
                    groups.push({ label: '', items: fpool.slice(0, pk.limit).map(function(f){ var tx = vm.bk_flight_txt(f); return { id: f.id, kind: 'flight', f: f, t: tx.t, sub: tx.s, tip: tx.tip, other: vm.bk_other_day(f) }; }) });
                    foot = 'Showing ' + Math.min(pk.limit, fpool.length) + ' of ' + fpool.length.toLocaleString('en-GB'); more = fpool.length > pk.limit;
                } else { empty = { t: 'No tracker flight matches ‘' + q + '’', s: 'Try a date (5 Nov, yesterday), a time (09:2) or an airfield (EGTK, Oxford).' }; }
            }
            var flat = [], rows = []; groups.forEach(function(g, gi){ if(g.label){ rows.push({ grp: g.label, rk: 'g' + gi }); } g.items.forEach(function(it){ it.idx = flat.length; it.rk = 'o' + flat.length + '-' + it.id; flat.push(it); rows.push(it); }); });
            if(pk.hi >= flat.length){ pk.hi = Math.max(0, flat.length - 1); }
            pk.model = { groups: groups, flat: flat, rows: rows, hint: hint, foot: foot, empty: empty, more: more };
        }
        function tuition_sub(c){ if(!c){ return ''; } var p = Number(c.price) || 0; if(!p){ return 'No charge'; } return money(p) + (c.charge_type === 'session' ? ' a session' : ' an hour'); }
        vm.bk_tuition_sub = function(){ return tuition_sub(vm.bookout && vm.bookout.tuition_required); };
        function flight_key(f){
            var bd = booking_day(), d = String(f.flight_date).slice(0, 10), yd = (function(){ var x = parse_date(bd) || new Date(); x.setDate(x.getDate() - 1); return iso_day(x); })();
            var x = parse_date(d);
            var from = f.from_airport || {}, to = f.to_airport || {};
            return ' ' + [d === bd ? 'today booking day' : '', d === yd ? 'yesterday' : '', fday(d), x ? x.getDate() + ' ' + MON[x.getMonth()] + ' ' + x.getFullYear() : '',
                          roundTimeToMinute(f.brakes_off), roundTimeToMinute(f.brakes_on), shown(f.brakes_off, f.brakes_off_rounded), shown(f.brakes_on, f.brakes_on_rounded),
                          from.code, from.title, to.code, to.title].join(' ').toLowerCase();
        }
        function flight_match(f, ql){ if(!ql){ return true; } var k = flight_key(f); return k.indexOf(' ' + ql) > -1 || ql.split(/\s+/).filter(Boolean).every(function(t){ return k.indexOf(' ' + t) > -1; }); }
        vm.bk_pk_key = function($event){
            var pk = vm.bk.pk; if(!pk || !pk.model){ return; }
            var k = $event.key || $event.which;
            if(k === 'ArrowDown' || k === 40 || k === 'ArrowUp' || k === 38){
                $event.preventDefault();
                var down = (k === 'ArrowDown' || k === 40);
                pk.hi = Math.max(0, Math.min(pk.model.flat.length - 1, pk.hi + (down ? 1 : -1)));
                $timeout(function(){ var o = document.getElementById('bki-pk-o-' + pk.hi); if(o && o.scrollIntoView){ o.scrollIntoView({ block: 'nearest' }); } }, 0);
            } else if(k === 'Enter' || k === 13){
                $event.preventDefault();
                var it = pk.model.flat[pk.hi]; if(it){ vm.bk_pk_pick(it); }
            } else if(k === 'Escape' || k === 27){
                $event.preventDefault(); vm.bk.pk = null;
            }
        };
        vm.bk_pk_pick = function(it){
            var f = vm.bk.pk && vm.bk.pk.f; vm.bk.pk = null;
            if(!it || !f){ return; }
            if(f === 'flight'){ if(it.f && !(vm.claim_a_flight || []).some(function(x){ return x.id === it.f.id; })){ vm.claim_a_flight = (vm.claim_a_flight || []).concat([it.f]); } vm.bk.pick = it.id; vm.bk_use_flight(it.f); return; }
            if(f === 'pic'){ vm.bookout.pic = it.p; $scope.update_pic(); vm.calculate_invoice_for_flight(); return; }
            if(f === 'put'){
                if(vm.bookout.pic && it.p.user_id === vm.bookout.pic.user_id){ ToastService.warning('Choose someone else', 'The student can\'t be the pilot in command.'); return; }
                vm.bookout.put = it.p; $scope.update_put(); return;
            }
            if(f === 'instr'){ vm.bookout.instructor = it.p; $scope.update_instructor(); vm.calculate_invoice_for_flight(); return; }
            if(f === 'course'){ vm.bookout.course = it.c || {}; vm.update_course(); return; }
            if(f === 'tuition'){ vm.bookout.tuition_required = it.c; vm.update_tuition_charges(); return; }
            if(f === 'payer'){ vm.bookout.payer_id = it.id; vm.bk.payerPicked = true; vm.calculate_invoice_for_flight(); return; }
            if(f === 'from'){ vm.bookout.from_airfield = it.a; vm.bk.ftEdited = true; return; }
            if(f === 'to'){ vm.bookout.to_airfield = it.a; vm.bk.ftEdited = true; return; }
        };
        vm.bk_flight_chips = [{ id: 'day', t: 'Booking day' }, { id: 'week', t: 'Last 7 days' }, { id: 'all', t: 'All' }];
        var hl_cache = {};
        vm.bk_hl = function(text, other){   // the search match, highlighted (escaped first); other = the "Not the booking's day" tag after it
            var q = String((vm.bk.pk && vm.bk.pk.f !== 'flight' && vm.bk.pk.q) || '').trim(), t = String(text || ''), key = q + '\u0001' + t + (other ? '\u0001o' : '');
            if(hl_cache[key]){ return hl_cache[key]; }
            var esc = function(x){ return x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
            var i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
            var html = i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark class="ta-mark">' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
            if(other){ html += '<span class="bki-tag-warn">Not the booking\'s day</span>'; }
            hl_cache[key] = $sce.trustAsHtml(html);
            return hl_cache[key];
        };
        vm.bk_pk_is_on = function(it){ return it.id === pk_current(vm.bk.pk && vm.bk.pk.f); };


        /* ═════ view helpers for the template ═════ */
        // the card numbers (Meters only when shown)
        vm.bk_n = function(card){
            var order = ['times'].concat(vm.bk_meters_shown() ? ['meters'] : []).concat(['land', 'fuel', 'def', 'crew', 'charges', 'final']);
            return order.indexOf(card) + 1;
        };
        vm.pay_amount = function(){ return vm.quote ? vm.quote.booking_total : 0; };
        vm.pay_money = money;
        vm.mach_unpaid = function(){ return vm.bk.machineUnpaid || null; };
        vm.bk_machine_retry = function(){ vm.bk.machineUnpaid = null; if(vm.pay){ vm.pay.sel = 'machine'; vm.pay.go(); } };
        vm.bk_payer_first = function(){ return vm.bk_first(vm.bookout && vm.bookout.payer_id) || 'the pilot'; };
        vm.bk_leg_kind = function(){ return vm.this_was_supervised_solo ? 'solo' : ((vm.this_claim_was_instructional || vm.bookout.instructor_id > 0) && vm.bookout.put_id > 0 ? 'dual' : 'hire'); };
        vm.bk_from = function(){ var a = vm.bookout && vm.bookout.from_airfield; return a && a.title ? a : null; };
        vm.bk_to = function(){ var a = vm.bookout && vm.bookout.to_airfield; return a && a.title ? a : null; };
        vm.bk_code = function(a){ return a ? (a.code && a.code !== 'ZZZZ' ? a.code : vm.bk_af_label(a)) : ''; };
        vm.bk_route_line = function(){
            var ft = vm.bookout && vm.bookout.flight_type, f = vm.bk_from(), t = vm.bk_to();
            if(!ft){ return ''; }
            return ft.title + ' · ' + vm.bk_code(f) + (vm.bk_needs_to() && t ? ' → ' + vm.bk_code(t) : '');
        };
        // landings are named by the airfield ("Touch & goes at Denham"), as the mockup does
        // the club's landing fees are for its home airfield (the sheet's home_airport_id), not wherever this leg started
        function land_place(){
            var id = vm.bookout && vm.bookout.home_airport_id, f = vm.bk_from(), t = vm.bk_to(), a = null;
            if(id > 0){ a = (f && f.id == id) ? f : (t && t.id == id) ? t : (vm.airfields || []).find(function(x){ return x.id == id; }); }
            a = a || f; if(!a){ return ''; }
            return (a.code && a.code !== 'ZZZZ' ? af_name(a) : vm.bk_af_label(a)) || vm.bk_code(a);
        }
        vm.bk_land_at = function(){ var n = land_place(); return n ? ' at ' + n : ''; };
        vm.bk_fee_words = function(fee){ var home = land_place() || 'home'; fee = Number(fee) || 0; return fee > 0 ? money(fee) + ' each at ' + home : 'Included at ' + home; };
        // the kit's kind icons (mockups/_kit/kit.js Kit.KINDS)
        var KIND_IC = { dual: 'fa-user-friends', solo: 'fa-user', hire: 'fa-key', trial: 'fa-star', maint: 'fa-wrench' };
        var KIND_LB = { dual: 'Dual lesson', solo: 'Solo', hire: 'Self-fly hire', trial: 'Trial lesson', maint: 'Maintenance' };
        vm.bk_kind_icon = function(k){ return KIND_IC[k] || 'fa-plane'; };
        vm.bk_kind_label = function(k){ return KIND_LB[k] || ''; };
        // the leg panel's crew line: "Alex Reynier (instructor) · Sam Carter (student)"
        vm.bk_leg_crew = function(){
            var b = vm.bookout || {};
            if(!(b.pic && b.pic.user_id > 0)){ return ''; }
            if(vm.this_was_supervised_solo || vm.bk_solo_mode()){ return person_name(b.pic_id) + ', solo — authorised by ' + (person_name(b.instructor_id) || '…'); }
            if(vm.this_claim_was_instructional && b.put_id > 0){ return person_name(b.pic_id) + ' (instructor) · ' + person_name(b.put_id) + ' (student)'; }
            if(vm.this_claim_was_instructional){ return person_name(b.pic_id) + ' (instructor) · …'; }
            return person_name(b.pic_id) + ', self-fly hire';
        };
        // the payer, as a person row (for the avatar on the Invoice-to panel)
        vm.bk_payer_person = function(){ return person_of(vm.bookout && vm.bookout.payer_id); };
        // "3 Nov 2026 · 16:42 by Kate Ellis" (the mockup's defect line)
        vm.bk_def_when = function(d){
            if(vm.bk_is_mine(d)){ return 'by you · just now'; }
            var m = String((d && d.created_at) || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
            var when = m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] + ' · ' + m[4] + ':' + m[5] : '';
            var by = d && d.user_id > 0 ? person_name(d.user_id) : '';
            return (when || 'earlier') + (by ? ' by ' + by : '');
        };
        vm.bk_crew_line = function(){
            var b = vm.bookout || {};
            if(!(b.pic && b.pic.user_id > 0)){ return ''; }
            if(vm.this_was_supervised_solo){ return person_name(b.pic_id) + ', solo — authorised by ' + (person_name(b.instructor_id) || '…'); }
            if(vm.this_claim_was_instructional && b.put_id > 0){ return person_name(b.pic_id) + ' instructing ' + person_name(b.put_id); }
            if(vm.this_claim_was_instructional){ return person_name(b.pic_id) + ' instructing …'; }
            return person_name(b.pic_id) + ', self-fly hire';
        };
        vm.bk_fuel_line = function(){
            var r = vm.lubricant_receipts || [];
            if(!r.length){ return ''; }
            return r.map(function(x){ return x.quantity + ' ' + (x.item === 'Oil' ? 'qt oil' : 'L fuel') + (x.reimbursement == 1 ? ' (claimed)' : ''); }).join(', ');
        };
        vm.bk_missing_words = function(){
            var q = vm.quote; if(!q || !q.missing){ return ''; }
            var w = { brakes_off: 'brakes off', brakes_on: 'brakes on', takeoff: 'takeoff', landing: 'landing', tacho_end: 'the end meter reading', tuition_id: 'the tuition',
                      payer_id: 'the pilot in command', previous_legs: 'the earlier legs', units: 'the charged time', claimed_flight: 'the tracker flight',
                      tacho_start: 'a start meter reading the club can take' };
            var TIMES = { brakes_off: 1, brakes_on: 1, takeoff: 1, landing: 1, units: 1 }, out = [];
            q.missing.forEach(function(k){ var t = TIMES[k] ? 'the times' : (w[k] || k); if(out.indexOf(t) < 0){ out.push(t); } });
            return out.length > 1 ? out.slice(0, -1).join(', ') + ' and ' + out[out.length - 1] : (out[0] || '');
        };
        // "The charges appear once the times and the end meter reading are in."
        vm.bk_charges_wait = function(){
            if(vm.quote && vm.quote.error === 'METER_CHECK'){ return 'The charges appear once the meter readings are right: the end reading must be higher than the start.'; }
            var w = vm.bk_missing_words() || ('the times' + (vm.bk_meter_charged() ? ' and the end meter reading' : ''));
            var plural = / and |, /.test(w) || /^the times/.test(w);
            return 'The charges appear once ' + w + (plural ? ' are' : ' is') + ' in.';
        };
        vm.bk_line_amount = function(l){
            if(l.kind === 'included'){ return 'Included'; }
            if(l.kind === 'no_charge'){ return 'No charge'; }
            return money(l.amount);
        };
        // earlier legs on this booking (split / "add another leg"): the server's invoice lines
        var prev_key = null, prev_cache = [];
        vm.bk_prev_legs = function(){
            var inv = vm.invoices || [], key = inv.length + '|' + vm.previous_total;
            if(key === prev_key){ return prev_cache; }
            prev_cache = inv.map(function(f, i){
                var d = f.flight_details || {};
                var v = (d.brakes_off || d.takeoff_time) ? TimeDisplayService.pick(d, vm.td.mode) : null;
                var kind = d.holder_capacity === 'PUT' ? 'dual' : (d.authorised_solo > 0 || d.holder_capacity === 'PICUS') ? 'solo' : 'hire';
                var crew = d.holder_capacity === 'PUT' ? (d.pic_name || '') + ' (instructor) · ' + (d.put_name || '') + ' (student)'
                         : (d.authorised_solo > 0 || d.holder_capacity === 'PICUS') ? (d.pic_name || '') + ', solo — authorised by ' + (d.instructor_name || '')
                         : (d.pic_name ? d.pic_name + ', self-fly hire' : '');
                var from = leg_af(f.from, d.from_airport_id, d.from_icao), to = leg_af(f.to, d.to_airport_id, d.to_icao);   // C13: the legs carry their ICAO codes
                return { n: i + 1, kind: kind, from: from, to: to, away: !!(to.code || to.name) && (to.code || to.name) !== (from.code || from.name),
                         date: d.flight_date ? fday(d.flight_date) : '', inv: f.invoice_number || '',
                         time: v && !v.missing ? (v.window === 'airborne' ? 'Airborne ' : 'Block ') + v.from + '–' + v.to + (v.durationHM ? ' · ' + v.durationHM : '') + (v.rounded ? ' (to 5 min)' : '') : '',
                         crew: crew, total: Number(f.total) || 0,
                         lines: (f.items || []).filter(function(it){ return !it.ui_hidden; }).map(function(it){
                             var pkg = it.member_package_id > 0, vr = Number(it.vat_rate) || 0, up = Number(it.unit_price) || 0, un = Number(it.unit) || 0;
                             return { t: it.title, s: pkg ? 'From your package' : (Number(it.total) === 0 ? '' : (un % 1 === 0 ? String(un) : un.toFixed(2)) + ' × ' + money(vr > 0 ? up * (1 + vr / 100) : up)), a: pkg ? 'Included' : (Number(it.total) === 0 ? 'No charge' : money(it.total)), credit: Number(it.total) < 0, muted: pkg || Number(it.total) === 0 };
                         }) };
            });
            prev_key = key;
            return prev_cache;
        };
        // an earlier leg's airfield: the invoice API sends the airfield's title; the code comes from the airfields list when it has it
        function leg_af(title, id, icao){
            if(icao && icao !== 'ZZZZ'){ return { code: icao, name: af_name({ title: String(title || '').replace('NOT LISTED : ', '') }) }; }
            var a = id > 0 ? (vm.airfields || []).find(function(x){ return x.id == id; }) : null;
            if(a){ return { code: a.code && a.code !== 'ZZZZ' ? a.code : '', name: af_name(a) }; }
            title = String(title || '');
            if(/^[A-Z0-9]{4}$/.test(title)){ var k = (vm.airfields || []).find(function(x){ return x.code === title; }); return { code: title, name: k ? af_name(k) : '' }; }
            return { code: '', name: af_name({ title: title }) };
        }
        // the field-like button of each picker: what is chosen
        function bk_pf_raw(f){
            var b = vm.bookout || {};
            switch(f){
                case 'pic': return pf_person(b.pic, vm.bk_is_instr(b.pic) ? 'Instructor' : (vm.this_claim_was_instructional ? 'Student' : 'Member'));
                case 'put': return pf_person(b.put, 'Pilot under training');
                case 'instr': return pf_person(b.instructor && b.instructor.user_id ? (person_of(b.instructor.user_id) || b.instructor) : null, 'Instructor');
                case 'course': return { nm: (b.course && b.course.title) || '', sub: b.course && b.course.title ? 'Course' : '', icon: 'fa-book' };
                case 'tuition': return { nm: (b.tuition_required && b.tuition_required.title) || '', sub: vm.bk_tuition_sub(), icon: 'fa-chalkboard' };
                case 'from': var fa = vm.bk_from(); return { nm: fa ? vm.bk_code(fa) + (fa.code && fa.code !== 'ZZZZ' ? ' · ' + af_name(fa) : '') : '', sub: '', icon: 'fa-plane-departure' };
                case 'to': var ta = vm.bk_to(); return { nm: ta ? vm.bk_code(ta) + (ta.code && ta.code !== 'ZZZZ' ? ' · ' + af_name(ta) : '') : '', sub: '', icon: 'fa-plane-arrival' };
            }
            return { nm: '' };
        }
        vm.bk_pf = function(f){ return stable('bk_pf' + '|' + f, bk_pf_raw(f)); };
        function pf_person(p, role){
            if(!p || !(p.user_id > 0 || p.id > 0)){ return { nm: '', person: null }; }
            var name = p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
            return { nm: name, sub: role, person: p, bs: !!p._isBsMember };
        }

        // Escape closes the open picker / dialog (the card machine dialog keeps its own buttons)
        function on_key(ev){
            if(ev.key !== 'Escape'){ return; }
            if(vm.bk.pk){ $scope.$applyAsync(function(){ vm.bk.pk = null; }); return; }
            if(vm.bk.dlg && vm.bk.dlg !== 'machine'){ $scope.$applyAsync(function(){ if(vm.bk.dlg === 'mismatch'){ vm.bk_mismatch_back(); } else { vm.bk.dlg = null; } }); }
        }
        document.addEventListener('keydown', on_key);
        $scope.$on('$destroy', function(){
            document.removeEventListener('keydown', on_key);
            if(vm.pay){ vm.pay.destroy(); }
            if(quote_timer){ $timeout.cancel(quote_timer); }
        });

}
/* ═══════════════════════════════════════════════════════════════════════════
   BookinV2Payment — the pay choice of the v2 book-in and Finish & pay (mockup: "How would you like to pay £x?").
   The logic is the payment accordion's (js/directives/datetime.js → paymentAccordion), copied so the money flow is
   the same calls in the same order; the look is the mockup's option list, and the page's ONE big button pays.
     • direct debit  → onConfirm('direct-debit')                               (the book-in PUT queues the invoice)
     • saved card    → POST cards/create_saved_card_intent (+ 3-D Secure) → onConfirm('saved-card', intent)
     • new card      → POST cards/create_payment_intent_new_card → Stripe Payment Element → confirmPayment
                       → onConfirm('new-card', intent)   (the intent is made when "New card" is chosen, and again when
                       the amount changes, so the card form always charges what is on screen)
     • card machine  → machineSend() gives the body: booking_id / invoice_id, NEVER amount (be-alex-3e C3) — the
                       book-in books the flight in first —, POST cards/create_cardmachine_intent, poll
                       cards/check_payment, then onMachinePaid(intent). Cancel / Close clear the reader.
   With o.useCommit() (the v2 book-in, be-alex-3e C4.3) the order is SAVE, THEN CHARGE: o.commit(method) books the flight in
   and prices it on the server, then direct debit is queued / the saved card is charged by the server (3-D Secure finished
   here), and the card machine / new card are started with the returned invoice_id. Without it (split flights, Finish & pay)
   the calls above run as v1 runs them.
   Shown only: direct debit with a mandate; saved cards; the card machine while it is online — to club staff, and to
   members unless the club keeps it for staff (owner, 8 Nov: members keep it as today until the club setting
   `machine.members_allowed` on the pay facts says false; C10 `machine.can_use` — the caller's — wins when present);
   FORBIDDEN from the reader (or the commit's CARD_MACHINE_STAFF_ONLY) hides it with the server's note.
   ═══════════════════════════════════════════════════════════════════════════ */
app.factory('BookinV2Payment', BookinV2Payment);

BookinV2Payment.$inject = ['PaymentService', 'BookoutService', 'ToastService', '$timeout', '$q'];
function BookinV2Payment(PaymentService, BookoutService, ToastService, $timeout, $q) {
    var service = {};
    service.create = create;
    return service;

    function create(o) {
        var p = {
            loading: false, loaded: false,
            info: null, machine: null, cards: [], defaultCard: null,
            sel: null, busy: false, err: null, note: null,
            saveCard: false, machineHidden: false, machineNote: null,
            nc: { state: 'idle', amount: null, msg: '' },
            mach: null,               // { step: 0 sent | 1 waiting | 2 paid | -1 error, payment_id, msg }
            paidWith: null
        };
        var methods_key = null, methods_cache = [], stripe = null, elements = null, payment_el = null, intent = null, stop_polling = false, nc_timer = null;
        var payer_id = 0, club_id = 0;

        p.load = function(payerId, clubId){
            payer_id = payerId; club_id = clubId;
            p.loading = true;
            var mandate = (o.mandate ? o.mandate(payerId, clubId) : null);
            $q.all([mandate, o.cards ? o.cards(payerId, clubId) : $q.when(null)]).then(function(res){
                var m = res[0], c = res[1];
                if(m && m.success){
                    p.info = m.info || null;
                    p.machine = m.machine || null;
                    if(!c && angular.isArray(m.cards)){ p.cards = m.cards; }
                } else {
                    p.info = null; p.machine = null;
                }
                if(c && c.success !== false && angular.isArray(c.cards)){ p.cards = c.cards; p.defaultCard = c.default_card || null; }   // a failed cards call keeps the pay facts' cards
                p.loading = false; p.loaded = true;
                if(!p.sel || !p.available(p.sel)){ p.sel = p.firstChoice(); }
                if(p.sel === 'new'){ p.prepareNewCard(); }
            });
        };

        p.hasMandate = function(){ return !!(p.info && p.info.account_bank); };
        // the mandate as the mockup prints it: "Barclays", "Bacs"
        p.bankName = function(){ return p.info && p.info.account_bank ? title_case(p.info.account_bank) : ''; };
        p.schemeName = function(){ var x = String((p.info && p.info.mandate_scheme) || ''); return x ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : ''; };
        p.machineOnline = function(){ return !!(p.machine && p.machine.success); };
        p.machineExists = function(){ return !!(p.machine && (p.machine.success || p.machine.id)); };
        p.machineShown = function(){
            if(p.machineHidden || !p.machineExists()){ return false; }
            // be-alex-3e C10: the pay facts say whether THIS caller may use the reader (staff, or members while the club allows it)
            if(p.machine && typeof p.machine.can_use === 'boolean'){ return p.machine.can_use; }
            if(o.staff && o.staff()){ return true; }
            return !(p.machine && p.machine.members_allowed === false);   // field absent = today's rule: members may use it
        };
        function card_title(c){ return (c.brand ? c.brand.charAt(0).toUpperCase() + c.brand.slice(1) : 'Card') + ' •••• ' + (c.last4 || ''); }
        function two(n){ n = parseInt(n, 10); return isNaN(n) ? '' : ('0' + n).slice(-2); }
        p.methods = function(){
            var key = [p.hasMandate(), (p.cards || []).map(function(c){ return c.stripe_id; }).join(','), p.defaultCard, p.machineShown(), p.machineOnline(), p.info && p.info.account_ending, !!p.after].join('|');
            if(key === methods_key){ return methods_cache; }
            var m = [];
            if(p.hasMandate()){
                m.push({ id: 'dd', kind: 'direct-debit', ic: 'fas fa-university', t: 'Direct debit', tag: 'Recommended',
                         s: 'From ' + (p.info.account_bank ? title_case(p.info.account_bank) : 'your bank') + ' ••••' + (p.info.account_ending || '') + ' · collected by the club\'s next direct debit run' });
            }
            (p.cards || []).forEach(function(c){
                var brand = String(c.brand || '').toLowerCase();
                m.push({ id: 'card:' + c.stripe_id, kind: 'saved-card', card: c, ic: brand === 'visa' ? 'fab fa-cc-visa' : brand === 'mastercard' ? 'fab fa-cc-mastercard' : brand === 'amex' ? 'fab fa-cc-amex' : 'far fa-credit-card',
                         t: card_title(c), s: 'Saved card · expires ' + two(c.exp_month) + '/' + two(c.exp_year), tag: (p.defaultCard && c.stripe_id === p.defaultCard) ? 'Default' : '' });
            });
            m.push({ id: 'new', kind: 'new-card', ic: 'fas fa-plus', t: 'New card', s: 'Debit or credit card' });
            if(p.machineShown()){
                m.push({ id: 'machine', kind: 'card-machine', ic: 'fas fa-cash-register', t: 'Card machine', off: !p.machineOnline(),
                         s: p.machineOnline() ? 'At the club desk: the reader shows the amount' : 'Card machine offline — wake it up and try again' });
            }
            // booked in already, waiting for the new card (C4.3 awaiting_card): only the card form; "Pay later" leaves it on the invoice
            if(p.after){ m = m.filter(function(x){ return x.kind === 'new-card'; }); }
            methods_key = key; methods_cache = m;
            return m;
        };
        function title_case(s){ return String(s || '').toLowerCase().replace(/\b[a-z]/g, function(ch){ return ch.toUpperCase(); }); }
        p.available = function(id){ return p.methods().some(function(x){ return x.id === id && !x.off; }); };
        p.firstChoice = function(){
            var ms = p.methods().filter(function(x){ return !x.off; });
            if(p.hasMandate()){ return 'dd'; }
            var def = ms.filter(function(x){ return x.kind === 'saved-card' && x.tag === 'Default'; })[0] || ms.filter(function(x){ return x.kind === 'saved-card'; })[0];
            return def ? def.id : 'new';
        };
        p.method = function(){ var id = p.sel; return p.methods().filter(function(x){ return x.id === id; })[0] || null; };
        p.select = function(id){
            if(p.busy || p.after){ return; }   // booked in with a new card: that card form is the way now
            var m = p.methods().filter(function(x){ return x.id === id; })[0];
            if(!m || m.off){ return; }
            p.sel = id; p.err = null; p.note = null;
            if(m.kind === 'new-card'){ p.prepareNewCard(); }
        };
        p.ready = function(){
            var m = p.method(); if(!m || !p.loaded){ return false; }
            if(m.kind === 'new-card'){ return p.nc.state === 'ready' || p.nc.state === 'later'; }
            return true;
        };
        p.words = function(){
            var m = p.method(); if(!m){ return p.loaded ? '' : 'Loading the ways to pay…'; }
            if(m.kind === 'direct-debit'){ return 'By direct debit'; }
            if(m.kind === 'saved-card'){ return 'With ' + m.t; }
            if(m.kind === 'new-card'){ return 'With a new card'; }
            return 'At the card machine';
        };
        p.buttonWords = function(amount){
            var m = p.method(), a = o.money(amount);
            if(!m){ return 'Pay ' + a; }
            if(m.kind === 'direct-debit'){ return 'Add ' + a + ' to direct debit'; }
            if(m.kind === 'card-machine'){ return 'Send ' + a + ' to the reader'; }
            return 'Pay ' + a;
        };

        /* ── new card: the Payment Element, mounted in #bki-pay-el ── */
        p.prepareNewCard = function(){
            if(o.useCommit && o.useCommit() && !p.after){ p.nc = { state: 'later', amount: null, msg: '' }; return; }   // the card form opens once the flight is saved
            var send = p.sendOverride || o.send(); if(!send){ return; }
            var amount = send.amount !== undefined ? Math.round(send.amount) : (send.invoice_id ? 'i' + send.invoice_id : 'b' + send.booking_id);
            if(p.nc.state === 'loading' || (p.nc.state === 'ready' && p.nc.amount === amount)){ return; }
            p.nc = { state: 'loading', amount: amount, msg: '' };
            var body = angular.copy(send);
            if(body.amount !== undefined){ body.amount = Math.round(body.amount); }
            PaymentService.CreatePaymentIntentNewCard(body).then(function(data){
                // refused before Stripe (BELOW_MINIMUM, RATE_UNAVAILABLE, INVOICE_NOT_PAYABLE…): say why
                if(!data || data.success === false || !data.client_secret){
                    p.nc = { state: 'error', amount: amount, msg: (data && typeof data.message === 'string' && data.message) ? data.message : 'The card form could not be started — try again or use another way to pay.' };
                    return;
                }
                intent = data;
                PaymentService.GetClubStripeKey(o.clubId()).then(function(stripeKey){
                    stripe = Stripe(stripeKey);
                    var night = document.body.classList.contains('night-mode');
                    elements = stripe.elements({ clientSecret: data.client_secret,
                        appearance: { theme: night ? 'night' : 'stripe', rules: { '.ModalContent': { zIndex: 999999999999999991 }, '.ModalOverlay': { zIndex: 999999999999999991 } } },
                        wallets: { link: 'never' }, paymentMethodOrder: ['card', 'apple_pay', 'google_pay'] });
                    if(payment_el){ try { payment_el.destroy(); } catch(e){} }
                    payment_el = elements.create('payment', { layout: 'tabs' });
                    mount_when_there(0);
                }).catch(function(err){
                    $timeout(function(){
                        p.nc = { state: 'error', amount: amount, msg: (err && err.code === 'stripe_js_unavailable')
                            ? 'We couldn\'t load the secure card form. Your network or a browser extension may be blocking js.stripe.com — please allow it and try again.'
                            : 'Card payments aren\'t set up for this club yet. Please contact the club or choose another way to pay.' };
                    });
                });
            });
        };
        function mount_when_there(tries){
            $timeout(function(){
                var el = document.getElementById('bki-pay-el');
                if(!el){ if(tries < 40){ mount_when_there(tries + 1); } return; }
                try { payment_el.mount('#bki-pay-el'); p.nc.state = 'ready'; }
                catch(e){ console.log('payment element mount', e); p.nc = { state: 'error', amount: p.nc.amount, msg: 'The card form could not be shown — try again.' }; }
            }, 30);
        }
        // the quote changed: a new-card intent made for the old amount is made again (the card form re-opens empty)
        p.amountChanged = function(){
            var m = p.method(); if(!m || m.kind !== 'new-card' || p.after){ return; }
            if(nc_timer){ $timeout.cancel(nc_timer); }
            nc_timer = $timeout(function(){ var s = o.send(); if(s && s.amount !== undefined && Math.round(s.amount) !== p.nc.amount && p.nc.state !== 'loading'){ p.nc.state = 'idle'; p.prepareNewCard(); } }, 600);
        };

        /* ── pay with the chosen method (the page's ONE button) ── */
        p.go = function(){
            var m = p.method(); if(!m || p.busy){ return; }
            p.err = null; p.note = null;
            var useCommit = !!(o.useCommit && o.useCommit());
            if(m.kind === 'direct-debit'){ return useCommit ? commit_dd() : confirm_with('direct-debit', ''); }
            if(m.kind === 'saved-card'){ return useCommit ? commit_saved(m.card) : pay_saved(m.card); }
            if(m.kind === 'new-card'){ return (useCommit || p.after) ? commit_new() : pay_new(); }
            if(m.kind === 'card-machine'){ return start_machine(); }
        };
        // ── save first (C4.3) ──
        function commit_dd(){
            p.busy = true;
            return $q.when(o.commit('direct-debit')).then(function(res){
                if(!res || !res.ok){ p.busy = false; if(res && res.legacy){ return confirm_with('direct-debit', ''); } return; }
                p.paidWith = { method: 'direct-debit', words: 'by direct debit' };
                var st = res.data.payment && res.data.payment.status;
                o.onCommitted(res.data, st === 'not_queued' ? 'not_queued' : 'ok');
            }, function(){ p.busy = false; });
        }
        function commit_saved(card){
            p.busy = true;
            return $q.when(o.commit('saved-card', { card_id: card.stripe_id })).then(function(res){
                if(!res || !res.ok){ p.busy = false; if(res && res.legacy){ return pay_saved(card); } return; }
                var pay = res.data.payment || {}, st = pay.status;
                p.paidWith = { method: 'saved-card', words: 'with ' + card_title(card) };
                if(st === 'requires_action' && pay.client_secret){
                    // 3-D Secure: the bank's check here, then the payment is confirmed on the server
                    return PaymentService.GetClubStripeKey(o.clubId()).then(function(stripeKey){
                        var s = Stripe(stripeKey);
                        var opts = {};
                        if(pay.payment_method){ opts.payment_method = pay.payment_method; }
                        if(pay.card_url && pay.card_url.return_url){ opts.return_url = pay.card_url.return_url; }
                        return $q.when(s.confirmCardPayment(pay.client_secret, opts)).then(function(result){
                            if(result.error || !result.paymentIntent || result.paymentIntent.status !== 'succeeded'){
                                o.onCommitted(res.data, 'failed', result.error && result.error.code === 'payment_intent_authentication_failure' ? 'your card issuer\'s check didn\'t go through' : ((result.error && result.error.message) || 'the card payment didn\'t complete'));
                                return;
                            }
                            return BookoutService.CheckPayment(pay.paymentID || res.data.paymentID || pay.payment_id || result.paymentIntent.id).then(function(chk){
                                if(!chk || chk.success === false){ ToastService.warning('Paid · confirming', 'Your bank approved the payment; the club\'s records catch up shortly.'); }
                                o.onCommitted(res.data, 'ok');
                            });
                        });
                    }).catch(function(){ o.onCommitted(res.data, 'failed', 'the secure card check could not be loaded'); });
                }
                if(st === 'failed'){ o.onCommitted(res.data, 'failed', pay.message || ''); return; }
                o.onCommitted(res.data, 'ok');
            }, function(){ p.busy = false; });
        }
        function commit_new(){
            if(p.after){ return pay_new(); }   // booked in: the card form now charges the invoice
            p.busy = true;
            return $q.when(o.commit('new-card')).then(function(res){
                p.busy = false;
                if(!res || !res.ok){ if(res && res.legacy){ return pay_new(); } return; }
                var send = o.send() || {};
                p.after = { invoice_id: res.data.invoice_id, data: res.data };
                p.sendOverride = { club_id: o.clubId(), user_id: send.user_id, invoice_id: res.data.invoice_id };
                p.nc = { state: 'idle', amount: null, msg: '' };
                p.prepareNewCard();
                if(o.onAwaitingCard){ o.onAwaitingCard(res.data); }
            });
        }
        function confirm_with(method, paymentIntent){
            p.busy = true;
            p.paidWith = { method: method, words: p.words().replace(/^With /, 'with ').replace(/^By /, 'by ') };
            return $q.when(o.onConfirm(method, paymentIntent)).then(function(r){ p.busy = false; return r; }, function(){ p.busy = false; });
        }
        // the error is shown in the pay choice: keep the write guard's generic "Not saved" toast quiet (ToastService.handledInline)
        function inline(){ if(ToastService.handledInline){ ToastService.handledInline(); } }
        function fail(msg){ p.busy = false; p.err = msg; inline(); }
        function pay_saved(card){
            p.busy = true;
            var send = angular.copy(o.send());
            if(send.amount !== undefined){ send.amount = Math.round(send.amount); }
            send.card_id = card.stripe_id;
            PaymentService.CreateSavedPaymentIntent(send).then(function(data){
                if(data && data.success){ p.busy = false; return confirm_with('saved-card', data.payment); }
                // refused (FORBIDDEN: only the card holder or the club's admins) or failed without a 3-D Secure step
                if(!data || !data.client_secret){ return fail((data && typeof data.message === 'string' && data.message) ? data.message : 'The payment could not be taken — try again or choose another way to pay.'); }
                PaymentService.GetClubStripeKey(o.clubId()).then(function(stripeKey){
                    var s = Stripe(stripeKey);
                    $q.when(s.confirmCardPayment(data.client_secret, { payment_method: data.payment_method, return_url: data.card_url && data.card_url.return_url })).then(function(result){
                        if(result.error){
                            return fail(result.error.code === 'payment_intent_authentication_failure' ? 'Your card issuer\'s check didn\'t go through. Try again, or choose another way to pay.' : result.error.message);
                        }
                        if(result.paymentIntent && result.paymentIntent.status === 'succeeded'){
                            BookoutService.CheckPayment(data.paymentID).then(function(chk){
                                if(chk && chk.success){ p.busy = false; confirm_with('saved-card', result.paymentIntent); }
                                else { fail('The payment could not be confirmed — try again or choose another way to pay.'); }
                            });
                            return;
                        }
                        fail('The payment didn\'t complete — try again or choose another way to pay.');
                    });
                }).catch(function(err){
                    fail((err && err.code === 'stripe_js_unavailable') ? 'We couldn\'t load the secure card form. Your network or a browser extension may be blocking js.stripe.com.' : 'Card payments aren\'t set up for this club yet.');
                });
            });
        }
        function pay_new(){
            var send = p.sendOverride || o.send();
            if(p.nc.state !== 'ready' || !elements || !stripe){ return fail(p.nc.msg || 'The card form isn\'t ready yet.'); }
            if(send && send.amount !== undefined && Math.round(send.amount) !== p.nc.amount){
                p.nc.state = 'idle'; p.prepareNewCard();
                return fail('The total changed — enter the card details again.');
            }
            p.busy = true;
            var save = (p.saveCard && intent && intent.payment_intent_id && send && send.user_id > 0)
                ? PaymentService.SetSaveCardOnIntent({ payment_intent_id: intent.payment_intent_id, club_id: o.clubId(), user_id: send.user_id }) : $q.when(null);
            save.then(function(){
                return $q.when(stripe.confirmPayment({ elements: elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' }));
            }).then(function(res){
                if(!res){ return fail('The payment didn\'t complete.'); }
                if(res.error){
                    return fail(res.error.code === 'payment_intent_authentication_failure' ? 'Your card issuer\'s check didn\'t go through. Try again, or choose another way to pay.' : (res.error.message || 'The card was refused.'));
                }
                if(res.paymentIntent && res.paymentIntent.status === 'succeeded'){
                    if(p.after){   // C4.3: the invoice's intent — confirm it on the server, then leave
                        // be-alex-3e C4 additions: the new-card intent records no payment row, so check_payment can't finish it —
                        // payments/process_payment does (what My Account → Invoices does)
                        var ov = p.sendOverride || {};
                        return PaymentService.ProcessPayment({ invoice_id: p.after.invoice_id, paymentIntent: res.paymentIntent, method: 'new-card', club_id: o.clubId(), user_id: ov.user_id }).then(function(done){
                            p.busy = false; p.paidWith = { method: 'new-card', words: 'with your new card' };
                            if(done && done.success === false && done.payment_intent_id){
                                // charged, but the server couldn't apply it (AMOUNT / CURRENCY / CUSTOMER / INVOICE_MISMATCH, INVOICE_NOT_FOUND):
                                // the club's managers are e-mailed — never offer a second payment
                                p.chargedRef = done.payment_intent_id;
                                ToastService.warning('Your card was charged', 'Don\'t pay again: the club has been told (ref ' + done.payment_intent_id + ').', { duration: 12000 });
                            } else if(!done || done.success === false){
                                ToastService.warning('Paid · not matched yet', 'Your card was charged; the club will match the payment to the invoice. Don\'t pay again.', { duration: 9000 });
                            }
                            o.onCommitted(p.after.data, 'ok');
                        });
                    }
                    p.busy = false; return confirm_with('new-card', res.paymentIntent);
                }
                fail('There was an error processing your payment.');
            }, function(){ fail('The payment didn\'t complete — try again.'); });
        }

        /* ── the card machine ── */
        function start_machine(){
            p.busy = true;
            $q.when(o.machineSend()).then(function(send){
                p.mach = { step: 0, payment_id: null, msg: '' };
                return PaymentService.CreateCardMachinePaymentIntent(send).then(function(data){
                    if(data && data.success){
                        stop_polling = false;
                        p.mach.payment_id = data.paymentID;
                        poll(data.paymentID, 0);
                        return;
                    }
                    if(data && data.error === 'FORBIDDEN'){
                        p.machineHidden = true;
                        p.machineNote = (typeof data.message === 'string' && data.message) || 'You can\'t use this club\'s card machine for that payment.';
                        p.mach = null; p.busy = false; p.sel = p.firstChoice();
                        if(o.onMachineStopped){ o.onMachineStopped('forbidden'); }
                        return;
                    }
                    inline();
                    p.mach = { step: -1, payment_id: null, msg: (data && typeof data.message === 'string' && data.message) || 'We couldn\'t reach the card machine — check it is on and online, then try again.' };
                });
            }, function(why){
                p.busy = false;
                if(why && why.staffOnly){   // C10: refused before anything was saved — drop the reader, choose another way
                    p.machineHidden = true;
                    p.machineNote = why.message || 'This club\'s card machine is for staff use.';
                    p.mach = null;
                    p.sel = p.firstChoice();
                    if(p.method() && p.method().kind === 'new-card'){ p.prepareNewCard(); }
                    if(o.onMachineRefused){ o.onMachineRefused(); }
                    return;
                }
                if(why && why.message){ p.err = why.message; }
            });
        }
        function poll(id, attempts){
            if(stop_polling || !p.mach){ return; }
            BookoutService.CheckPayment(id).then(function(data){
                if(stop_polling || !p.mach){ return; }
                if(data && data.success && data.status){
                    stop_polling = true;
                    p.mach.step = 2;
                    p.paidWith = { method: 'card-machine', words: 'at the card machine' };
                    $timeout(function(){ $q.when(o.onMachinePaid(data.paymentIntent)).then(function(){ p.busy = false; }); }, 900);
                    return;
                }
                if(p.mach.step === 0){ p.mach.step = 1; }
                // the status check itself failed: said in the dialog, not as "Not saved"; three in a row stop the wait
                if(data && data.success === false && !(data.add_info && data.add_info.code) && !data.code){
                    inline(); p.mach.fails = (p.mach.fails || 0) + 1;
                    if(p.mach.fails >= 3){ stop_polling = true; p.mach.step = -1; p.mach.msg = 'We couldn\'t check the card machine payment' + (typeof data.message === 'string' && data.message ? ' (' + String(data.message).replace(/[.\s]+$/, '') + ')' : '') + '. Try again, or choose another way to pay.'; return; }
                    $timeout(function(){ poll(id, attempts + 1); }, 5000); return;
                }
                if(p.mach.fails){ p.mach.fails = 0; }
                var info = data && (data.add_info || (data.success === false ? data : null));
                if(info && info.code){
                    stop_polling = true;
                    p.mach.step = -1; p.mach.msg = 'The card was refused: ' + String(info.message || info.code).replace(/[.\s]+$/, '') + '. Try again, or choose another way to pay.';
                    return;
                }
                if(attempts + 1 >= 60){ stop_polling = true; p.mach.step = -1; p.mach.msg = 'No card was presented in time. Try again, or choose another way to pay.'; return; }
                $timeout(function(){ poll(id, attempts + 1); }, 5000);
            });
        }
        p.machRetry = function(){
            if(!p.mach){ return; }
            if(!p.mach.payment_id){ p.mach = null; p.busy = false; start_machine(); return; }
            var id = p.mach.payment_id;
            p.mach.step = 0; p.mach.msg = '';
            BookoutService.RetryPaymentMachine(id, o.clubId()).then(function(data){
                if(data && data.success){ stop_polling = false; poll(id, 0); return; }
                if(data && data.message === 'The payment has already been successfully made.'){
                    stop_polling = true; p.mach.step = 2;
                    $q.when(o.onMachinePaid(data.paymentIntent)).then(function(){ p.busy = false; });
                    return;
                }
                inline(); p.mach.step = -1; p.mach.msg = (data && typeof data.message === 'string' && data.message) || 'The reader could not be reached.';
            });
        };
        function clear_reader(reason){
            stop_polling = true;
            var id = p.mach && p.mach.payment_id;
            if(id){ BookoutService.ClearMachine(id, o.clubId()); }
            p.mach = null; p.busy = false;
            p.note = reason === 'cancelled' ? 'The card machine payment was cancelled on the reader. Nothing was paid.' : 'The card machine window was closed and the reader cleared. Nothing was paid.';
            if(o.onMachineStopped){ o.onMachineStopped(reason); }
        }
        p.machCancel = function(){ clear_reader('cancelled'); };
        p.closeMachine = function(){ clear_reader('closed'); };

        p.destroy = function(){
            stop_polling = true;
            if(payment_el){ try { payment_el.destroy(); } catch(e){} payment_el = null; }
            if(nc_timer){ $timeout.cancel(nc_timer); }
        };
        return p;
    }
}
 app.controller('FinishAndPayV2Controller', FinishAndPayV2Controller);

    FinishAndPayV2Controller.$inject = ['$sce', 'UserService', 'MemberService', 'InstructorService', 'MembershipService', 'HolidayService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', '$compile', '$interval', '$timeout', 'uiCalendarConfig', 'BookingService', 'LicenceService', 'BookoutService', '$filter', 'PlaneService', 'InstructorCharges', 'PaymentService', 'InvoicesService', 'EnvConfig', 'ToastService', 'BookinV2Payment', 'TimeDisplayService', '$q'];
    function FinishAndPayV2Controller($sce, UserService, MemberService, InstructorService, MembershipService, HolidayService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, $compile, $interval, $timeout, uiCalendarConfig, BookingService, LicenceService, BookoutService, $filter, PlaneService, InstructorCharges, PaymentService, InvoicesService, EnvConfig, ToastService, BookinV2Payment, TimeDisplayService, $q) {
        
        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        vm.show_loading = false;


        //this club ID needs to reflect the club that has been selected....
        vm.club_id = 0;   // v2: v1 hard-coded 6 until the booking loaded
        vm.booking = {};

        //base location to sort the airfields below
        vm.wgs_n = "51.51";
        vm.wgs_e = "0.12";

        vm.change_booking = {};
        vm.show_change_plane = false;
        //we need to get the booking ID to pull as much data as we can!

        vm.bookout = {
            start: true,
            passengers: [],
            pic: {
                id: vm.user_id
            },
            plane: {}
        };
      
        vm.dateFormat = 'date:HH:mm \'on\' dd/MM/yyyy';
        var setting_new_member;


        vm.reported_defects = [];

        vm.complete_flight = true;

        vm.previous_invoice;

        vm.defect_severity;
        vm.defect_severities = [
            { title: "No Fly Item - Ground the plane"},
            { title: "Flyable - needs to be checked at next maintenance"},
            { title: "Not urgent - but needs noting"},
            { title: "Unsure of severity"}
        ];  



        // vm.dmethods = [
        //     { id: 'direct-debit', title: 'Direct debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
        //     { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
        //     { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
        //     { id: 'card-machine', title: 'Card machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
        //   ];
        // vm.dsavedCards = [
        //   // { id:'card_1', brand:'Visa', last4:'4242', exp:'06/27', isDefault:true, nick:'Personal' },
        //   // { id:'card_2', brand:'Mastercard', last4:'1881', exp:'11/26', isDefault:false, nick:'Business' }
        // ];
        //direct-debit, saved-card, new-card, card-machine
        



        //SAMPLE ACCORDION MENU TO SELECT THE PAYMENT METHOD
        // // Right-side icons (same colour/style)
        // var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        //   var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        //   var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        //   var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconBank = '<svg viewBox="0 0 24 24"><path d="M3 10h18M4 10V8l8-5 8 5v2M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 20h20" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconCard = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M2 9h20M6 14h6" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconNew  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        var iconTerm = '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="14" rx="2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="8" y="5" width="8" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/><rect x="9" y="10" width="6" height="3" fill="none" stroke="#4f46e5" stroke-width="1.6"/></svg>';
        
          vm.donConfirm = function(methodLabel, paymentIntent){
            console.log("confirmation is called", methodLabel);
            console.log("paymentIntent", paymentIntent);
          //alert('Parent received D confirmation: ' + methodLabel);
            vm.book_in_flight(methodLabel, paymentIntent);
          };

          vm.default_payment = 'direct-debit';

          vm.methods = [
            { id: 'direct-debit', title: 'Direct debit', subtitle: 'Use your BACS mandate', type: 'direct-debit', iconSvg: $sce.trustAsHtml(iconBank), visible: true },
            { id: 'saved-card',   title: 'Saved card',   subtitle: 'Use a card on file',    type: 'saved-card',  iconSvg: $sce.trustAsHtml(iconCard), visible: true },
            { id: 'new-card',     title: 'New card',     subtitle: 'Add a new debit/credit card', type: 'new-card', iconSvg: $sce.trustAsHtml(iconNew), visible: true },
            { id: 'card-machine', title: 'Card machine', subtitle: 'Pay in person',          type: 'card-machine', iconSvg: $sce.trustAsHtml(iconTerm), visible: true }
          ];

           vm.savedCards = [];


          // vm.expandedId = 'direct-debit';
          // vm.selectedId = 'direct-debit';
         

          // vm.dd   = { name: '', email: '', sortCode: '', account: '' };
          // vm.card = { name: '', number: '', exp: '', cvc: '' };

          // vm.toggle = function(id){ vm.expandedId = (vm.expandedId === id) ? null : id; vm.selectedId = id; };
          // vm.isExpanded = function(id){ return vm.expandedId === id; };
          // vm.keyHeader = function(e,id){ var k=e.which||e.keyCode; if(k===13||k===32){ e.preventDefault(); vm.toggle(id);} };
          // vm.ddReady   = function(){ return !!(vm.dd.name && vm.dd.email && vm.dd.sortCode && vm.dd.account); };
          // vm.cardReady = function(){ return !!(vm.card.name && vm.card.number && vm.card.exp && vm.card.cvc); };
          // vm.confirm   = function(label){ alert('Selected: ' + label); };
          // vm.selectedTitle = function(){
          //   for (var i=0;i<vm.methods.length;i++){ if(vm.methods[i].id===vm.selectedId){ return vm.methods[i].title; } }
          //   return null;
          // };

          // vm.switchTo = function(type){
          //     // find by type (no Array.find for ES5)
          //     for (var i = 0; i < vm.methods.length; i++) {
          //       if (vm.methods[i].type === type) {
          //         vm.selectedId = vm.methods[i].id;
          //         vm.expandedId = vm.methods[i].id;
          //         return;
          //       }
          //     }
          //   };

          // vm.selectedSavedCardId = (vm.savedCards[0] && vm.savedCards[0].id) || null;

          //   vm.selectSavedCard = function(id){
          //     vm.selectedSavedCardId = id;
          //   };

          //   vm.keySelectTile = function(e, id){
          //     var k = e.which || e.keyCode;
          //     // Enter(13) or Space(32) selects
          //     if (k === 13 || k === 32) { e.preventDefault(); vm.selectSavedCard(id); }
          //     // Optional: ArrowLeft/ArrowRight to move focus
          //   };

          //   vm.cardBrandIcon = function(brand){
          //     // Simple inline SVGs; extend as needed
          //     var visa = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#0a4595"/><text x="18" y="16" text-anchor="middle" font-size="10" fill="#fff" font-family="Arial, Helvetica, sans-serif">VISA</text></svg>';
          //     var mc = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#1f2937"/><circle cx="15" cy="12" r="6.5" fill="#eb001b"/><circle cx="21" cy="12" r="6.5" fill="#f79e1b" opacity=".9"/></svg>';
          //     var amex = '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#2e77bb"/><text x="18" y="16" text-anchor="middle" font-size="9" fill="#fff" font-family="Arial, Helvetica, sans-serif">AMEX</text></svg>';

          //     var b = (brand || '').toLowerCase();
          //     var svg = /visa/.test(b) ? visa
          //             : /(master|mc)/.test(b) ? mc
          //             : /(amex|american)/.test(b) ? amex
          //             : '<svg viewBox="0 0 36 24"><rect width="36" height="24" rx="4" fill="#eef2ff"/><text x="18" y="15" text-anchor="middle" font-size="8" fill="#4f46e5" font-family="Arial, Helvetica, sans-serif">CARD</text></svg>';

          //     return $sce.trustAsHtml(svg);
          //   };

            // vm.pay_with_saved_card = function(){
            //     vm.show_loading = true;
            //     console.log("cardid = ", vm.selectedSavedCardId);
                
            //     // .. // .. /// .. /// .. // ... //
            //     //we need to create a payment intent for the booking rather than a singular invoice
            //     // PaymentService.CreatePaymentIntentBooking
            //     var obj = {
            //         booking_id: vm.bookout.booking_id,
            //         user_id: vm.user.id,
            //         card_id: vm.selectedSavedCardId
            //     }

            //     PaymentService.CreatePaymentIntentBooking(obj)
            //                 .then(function (data) {
            //                     //console.log(data);
            //                     if(data.success){
                                    








            //                         ////console.log("CARDS", vm.cards);
            //                     } else {
            //                        console.log("WOOOPSIES...", data);
            //                         //this should be very very rare...
            //                     }
            //     });


            // }
                





        vm.complete_flight = false;
        vm.complete_this_flight = function(){
            if(vm.tacho_error_highlight){
                ToastService.error('Meter error', 'You cannot complete a flight where the last meter reading is greater than the start meter reading!');
                return false;
            }
            vm.complete_flight = true;
            vm.fp_prepare_pay();   // v2: members/{payer}/info/{club} (mandate, cards, reader) through BookinV2Payment
        }


        $scope.get_airfields = function(name){

            if(name.length > 2 && name.length < 5){

                 BookoutService.GetAirfieldsByCode(name)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;
                       
                         if(vm.airfields.length == 0){
                            //console.log("SETTINGS HERE");
                               vm.airfields = [
                                    {
                                        id:0,
                                        title: "NOT LISTED : "+ name,
                                        code: "ZZZZ",
                                        wgs_n: "0",
                                        wgs_e: "0"
                                    }];
                        }

                    } else {


                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            }

            if(name.length > 4){
                var code = name.replace(/\s/g, "_");
                BookoutService.GetAirfields(code)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //use GB airfields first...
                        vm.airfields = data.airfields;


                        if(vm.airfields.length == 0){
                            //console.log("SETTINGS HERE");
                               vm.airfields = [
                                    {
                                        id:0,
                                        title: "NOT LISTED : "+ name,
                                        code: "ZZZZ",
                                        wgs_n: "0",
                                        wgs_e: "0"
                                    }];
                        }

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

            }
        }


        $scope.update_pic = function(){
            //console.log("--> ", vm.user.id);
            //console.log("--> ", vm.bookout.instructor_id);
            //console.log("--> ", vm.bookout.pic.user_id);

            if(vm.bookout.pic.user_id == vm.user.id && vm.bookout.instructor_id > 0){
                //console.log("okay... so you want the instructor to be put? interesting...");
                //adheres to booking

            } else if(vm.bookout.instructor_id > 0 && vm.bookout.pic.user_id == vm.bookout.instructor_id) {
                //console.log("okay so you now have your booked instructor as the PIC again - nice");
                //adheres to booking

            } else {
                //console.log("you've change instructor? what happened?");
                //availability has been checked hence we're OK

            }
        }


        // vm.cards = [];
        // PaymentService.GetByUserId(vm.user.id)
        //                     .then(function (data) {
        //                         //console.log(data);
        //                         if(data.success){
        //                             vm.cards = data.cards;
        //                             ////console.log("CARDS", vm.cards);
        //                         } else {
        //                            // //console.log("WOOOPSIES...");
        //                             //this should be very very rare...
        //                         }
        //                     });


        // the ARRIVAL option should be automatically filled in when there was a departure prior to the flight and home airfield was
        //entered as the destination

       

        switch($state.current.data.action){
            case "add":

                //console.log("bookout", $stateParams.id);
                //so now we can load the BOOKING with this ID, and therefore can sort it all out :)
                // let us preload the content required from the booking - fetch the booking
                //console.log("FETCH THE BOOKING");

                BookingService.GetForBookout(vm.user.id, $stateParams.id)
                 .then(function (data) {
                    ////console.log("data is : ", data);
                    if(data.success){
                        //console.log("success");

                        vm.bookout = data.booking;

                        //temporary bits to overcome the start and end times issues...
                        vm.bookout.start_date = new Date("2100/07/26");
                        vm.bookout.end_date = new Date("2100/07/26");

                        MemberService.GetAllByPics(data.booking.club_id, vm.user.id)
                            .then(function (pics) {
                                    vm.pics = pics;
                                    process_bookout_to_bookin(data.booking);
                            });



                    } else {
                        // v2: say why instead of an empty page (FORBIDDEN / NOT_FOUND)
                        vm.fp.loaded = true;
                        vm.fp.error = (data && typeof data.message === 'string' && data.message) || 'This flight could not be loaded.';
                    }
                });

                
            break;
            case "edit":

            



            break;
            case "list":

             


            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  
      

        vm.calculate_invoice_for_flight = function(){

            //vm.flight_units where the units are stored


            // //vm.bookout.plane_charges where the fees are stored
            // var plane_units = 0;
            // //plane units
            // if(vm.bookout.plane_charges.charge_type == "brakes"){
            //     //then the units relate to the entered numbers:
            //     plane_units = vm.flight_units.brakes_to_brakes;
            // } else {
            //     //then the units we need to calculate relate to the hours between brakes off and on.
            //     plane_units = (vm.bookout.end_tacho - vm.bookout.start_tacho);
            // }

            // var plane_total = (vm.bookout.plane_charges.charge_rate_unit * plane_units);


            // //plane surchages::::
            // var surcharge_units = 0;
            // if(vm.bookout.plane_charges.surcharge_type == "flight"){
            //     //then the units relate to the entered numbers:
            //     surcharge_units = 1;
            // } else if(vm.bookout.plane_charges.surcharge_type !== "none") {
            //     //then the units are based on the plane units
            //     surcharge_units = plane_units;
            // }

            // var surcharge_total = (vm.bookout.plane_charges.surcharge_fee * surcharge_units);


            // //landings and touch and goes etc...
            // var landing_units = vm.bookout.landings | 0;
            // var landings_total = (landing_units * vm.bookout.plane_charges.landing_fee);


            // var tg_units = vm.bookout.tng | 0;
            // var tng_total = (tg_units * vm.bookout.plane_charges.touch_and_go_fee);



            // //TUITION CHARGES
            // var tuition_charge_type = "none";
            // var tuition_price = 0;
            // var tuition_total = 0;
            // var tuition_units = 0;
            // if(vm.bookout.instructor_id > 0 && vm.bookout.tuition_id > 0 && vm.bookout.tuition_charges){

            //     tuition_charge_type = vm.bookout.tuition_charges.charge_type;
            //     tuition_price = vm.bookout.tuition_charges.price;

            //     if(tuition_charge_type == "brakes"){
            //         tuition_units = vm.flight_units.brakes_to_brakes;
            //         tuition_charge_type = "brakes off to brakes on hours";
            //     } else if(tuition_charge_type == "plane"){
            //         tuition_units = (vm.bookout.end_tacho - vm.bookout.start_tacho);
            //         tuition_charge_type = "plane units";
            //     } else if(tuition_charge_type == "session"){
            //         tuition_units = 1;
            //         tuition_charge_type = "session";
            //     }

            //     tuition_total = (tuition_units * tuition_price);

            // }

            // var total_to_remove = 0;
            // var receipts = [];
            // //need to process the reductions due to the receipts...
            // for(var i = 0;i<vm.lubricant_receipts.length;i++){

            //     if(vm.lubricant_receipts[i].reimbursement == 1){
            //         receipts.push(vm.lubricant_receipts[i]);
            //         total_to_remove = Number.parseFloat(Number.parseFloat(total_to_remove) + Number.parseFloat(vm.lubricant_receipts[i].price));
            //     }

            // }

            // //console.log("CALC HERE", total_to_remove);






            // var total = (plane_total + surcharge_total + landings_total + tng_total + tuition_total - total_to_remove);

            vm.invoice_totals = vm.previous_total;

            vm.plane_charges = {
                // plane_charge_type: vm.bookout.plane_charges.charge_type,
                // plane_unit_price: vm.bookout.plane_charges.charge_rate_unit,
                // plane_units: plane_units,
                // plane_total: plane_total,
                // surcharge_charge_type: vm.bookout.plane_charges.surcharge_type,
                // surcharge_unit_price: vm.bookout.plane_charges.surcharge_fee,
                // surcharge_units: surcharge_units,
                // surcharge_total: surcharge_total,
                // landing_units: landing_units,
                // landing_unit_price: vm.bookout.plane_charges.landing_fee,
                // landing_total: landings_total,
                // tng_units: tg_units,
                // tng_unit_price: vm.bookout.plane_charges.touch_and_go_fee,
                // tng_total: tng_total,
                // tuition_charge_type: tuition_charge_type,
                // tuition_unit_price: tuition_price,
                // tuition_units: tuition_units,
                // tuition_total: tuition_total,
                //receipts: receipts,
                total: 0
            };

            //vm.bookout.tuition_charges

        }

        vm.instructor_charges = []; 


        // vm.update_book_in_options = function(){
        //     vm.complete_flight = ( (vm.bookout.flight_type.title !== "Local" && vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) || vm.bookout.to_airfield.id !== vm.bookout.home_airport_id) ? false : true;
        // }
        vm.complete_flight = true;
       


        // var compile_invoice = function(){
        //     var items = [];
        //     // vm.plane_charges
        //     //add plane costs
        //     items.push({title: "Plane "+vm.plane_charges.plane_charge_type+" Charge", unit: vm.plane_charges.plane_units, unit_price: vm.plane_charges.plane_unit_price, total: vm.plane_charges.plane_total, organise: 0});
        //     if(vm.plane_charges.surcharge_total > 0){
        //         items.push({title: "Surcharge per "+vm.plane_charges.surcharge_charge_type, unit: vm.plane_charges.surcharge_units, unit_price: vm.plane_charges.surcharge_unit_price, total: vm.plane_charges.surcharge_total, organise: 1});
        //     }
        //     if(vm.plane_charges.tuition_total > 0){
        //         items.push({title: "Tuition Charge - "+vm.bookout.tuition_required.title, unit: vm.plane_charges.tuition_units, unit_price: vm.plane_charges.tuition_unit_price, total: vm.plane_charges.tuition_total, organise: 2});
        //     }
        //     if(vm.plane_charges.landing_total > 0){
        //         items.push({title: "Home Landing", unit: vm.plane_charges.landing_units, unit_price: vm.plane_charges.landing_unit_price, total: vm.plane_charges.landing_total, organise: 4});
        //     }
        //     if(vm.plane_charges.tng_total > 0){
        //         items.push({title: "Home Touch and Go", unit: vm.plane_charges.tng_units, unit_price: vm.plane_charges.tng_unit_price, total: vm.plane_charges.tng_total, organise: 3});
        //     }
           

        //     //RENTAL ITEMS !? --> make it free for now...

        //     for(var i=0;i<vm.plane_charges.receipts.length;i++){
        //         var org = parseInt(5 + i)
        //         items.push({title: "Reimbursement - "+vm.plane_charges.receipts[i].item, unit: vm.plane_charges.receipts[i].quantity, unit_price: (vm.plane_charges.receipts[i].price / vm.plane_charges.receipts[i].quantity), total: -vm.plane_charges.receipts[i].price, organise: org});
        //     }

        //     return items;
        // }






        //complete the booking back in
        vm.book_in_flight = function(method='', paymentIntent=null){

            var obj = {
                payer_id: vm.bookout.payer_id || vm.bookout.user_id,
                user_id: vm.bookout.user_id,
                club_id: vm.bookout.club_id,
                plane_id: vm.bookout.plane_id,
                booking_id: vm.bookout.booking_id,
                paying_now: vm.complete_flight,
                free_flight: (vm.invoice_totals == 0) ? true : false
            };

            //methods: bacs, card, new_card, cardmachine - overwritten
            //direct-debit, saved-card, new-card, card-machine
            if(method == "new-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = method;
            } else if(method == "saved-card"){
                obj.paymentIntent = paymentIntent;
                obj.method = method;
            } else if(method == "direct-debit"){
                //nothing to add - it should just work...
                obj.method = method;
            } else if(method == "card-machine"){
                //nothing here at the moment?
                obj.paymentIntent = paymentIntent;
                obj.method = method;
            }

            // //console.log("TO BE SENDING : ", obj);
            //return false;
            vm.show_loading = true;
            return BookoutService.PayBooking(vm.bookout.id, obj)
            .then(function(data){
                //console.log("SENT - ", data);
                if(data.success){
                        vm.show_loading = false;
                        vm.fp_arrival(method);   // v2: no done step — the toast says it
                        $state.go('dashboard.my_account', {}, { reload: true });
                } else if(data.error === 'FORBIDDEN' || data.error === 'NOT_FREE' || data.error === 'NOT_FOUND'){
                    // payment_for refusals (BACKEND_BOOKOUT_PILOT_CHECKS_GUIDE.md §16.3): not on this
                    // flight / not the club's desk, a "free" flight that has an amount to pay, or an
                    // unknown booking. FORBIDDEN is a writeGuard HANDLED code — say it here.
                    ToastService.warning(data.error === 'NOT_FREE' ? 'Not a free flight' : 'Payment not taken',
                        (typeof data.message === 'string' && data.message) || 'This payment could not be made.');
                    vm.show_loading = false;
                } else {
                    // v2: no "[object Object]" — the server's words when it sent some, else a plain sentence
                    ToastService.error('Not finished', (typeof data.message === 'string' && data.message && !(data.status >= 500)) ? data.message : 'The server didn\'t answer — nothing was paid. Try again in a moment.');
                    vm.show_loading = false;
                    //console.log(data);
                }
            });

        }




        vm.start_tacho_orig;





        function process_bookout_to_bookin(booking){


            //vm.bookout is where we want to fill the content....
            vm.bookout.booking_id = booking.id;
            vm.bookout.club_id = booking.club_id;
            vm.bookout.user_id = booking.user_id;
            vm.bookout.plane = booking.plane;
            vm.club_id = booking.club_id;
            // vm.bookout.return = new Date(booking.end);
            // vm.bookout.booking_start = new Date(booking.start);


              if(((vm.user.access.instructor.indexOf(vm.club_id) > -1) || (vm.user.access.manager.indexOf(vm.club_id) > -1) ) && vm.bookout.user_id !== vm.user.id){
                //console.log("NOT BOOKING FOR SELF?");
                vm.can_authorise = true;

            }


            vm.invoices = [];
            vm.previous_total = 0;
            InvoicesService.GetAllByBooking(booking.id)
            .then(function (data) {
                    console.log("invoice data is : ", data);
                    // FORBIDDEN: not on this booking and not the club's instructor / admin
                    // (BACKEND_MONEY_ACCESS_GUIDE.md §5) — say so; the invoices list stays empty
                    if(data && data.error === 'FORBIDDEN'){
                        ToastService.error('Invoices not loaded', (typeof data.message === 'string' && data.message) || "You can't see this booking's invoices.");
                    }
                    console.log("number of invoices returned: ", data.invoices ? Object.keys(data.invoices).length : 0);
                    if(data.success){
                        console.log("we already have invoices for this booking");
                        vm.previous_invoice = data.invoice;

                        for(var me in data.invoices){

                            console.log("Invoice [" + me + "] status:", data.invoices[me].status, "flights:", Object.keys(data.invoices[me].flights));

                            for (var key in data.invoices[me].flights) {
                                //console.log("KEY ", key);

                                if(data.invoices[me] && data.invoices[me].status && data.invoices[me].status.toLowerCase() !== "paid"){
                                   var flightEntry = data.invoices[me].flights[key];
                                   // Attach parent invoice data so the template can display aircraft and currency
                                   flightEntry.plane_registration = data.invoices[me].plane_registration;
                                   flightEntry.plane_type = data.invoices[me].plane_type;
                                   flightEntry.currency = data.invoices[me].currency || '£';
                                   flightEntry.invoice_number = data.invoices[me].invoice_number;
                                   flightEntry.club_title = data.invoices[me].club_title;
                                   vm.invoices.push(flightEntry);
                                    vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(flightEntry["total"]));
                                }
                                  

                                //vm.calculate_invoice_for_flight();
                                // for(var i=0;i<data.invoice.flights[key].length;i++){
                                // }
                            }

                        }
                        


                        // for (var key in data.invoice.flights) {
                        //     //console.log("KEY ", key);

                        //     if(data.invoice && data.invoice.status && data.invoice.status.toLowerCase() !== "paid"){
                        //        vm.invoices.push(data.invoice.flights[key]);
                        //         vm.previous_total = (Number.parseFloat(vm.previous_total) + Number.parseFloat(data.invoice.flights[key]["total"]));
                        //     }
                              

                        //     //vm.calculate_invoice_for_flight();
                        //     // for(var i=0;i<data.invoice.flights[key].length;i++){
                        //     // }
                        // }
                        
                        // Check if the logged-in user is the payer on any of these invoices
                        vm.is_payer = false;
                        for(var inv in data.invoices){
                            if(data.invoices[inv].user_id == vm.user.id){
                                vm.is_payer = true;
                            }
                            // Store the payer user_id from the invoice so GetMandate loads the right payment methods
                            if(data.invoices[inv].user_id){
                                vm.bookout.payer_id = data.invoices[inv].user_id;
                            }
                        }
                        // If the user is the payer, they should pay, not authorise
                        if(vm.is_payer){
                            vm.can_authorise = false;
                        }

                        vm.invoice_totals = vm.previous_total;
                        vm.complete_this_flight();
                        vm.fp.loaded = true;

                        //was var send before...
                        vm.send = {
                            club_id: vm.bookout.club_id,
                            user_id: vm.user.id,
                            booking_id: booking.id
                        }

                        /*
                        VM.SEND --> TO THE PAYMENT MODAL
                            if invoice --> remove booking_id add invoice_id 
                            if no invoice / booking --> remove both and add amount * 100
                            ie: amount: vm.invoice_totals * 100,
                            user must be the user for that invoice / PAYER ID --> careful on admin functions
                        */

                        vm.show_add_card = true;

                        //SETUP THE VM TO SEE THE MENU HERE???
                        //AND INCLUDE THE SEND OBJ?

                        if(vm.previous_total == 0 || vm.invoices.length == 0){
                            vm.fp.empty = true;

                            ToastService.warning('Already complete', 'It appears that you have already completed this flight!');
                            $state.go('dashboard.my_account', {}, { reload: true });
                            return;

                        }





                        /*
        --> ORIGINAL CODE HERE
                        PaymentService.CreatePaymentIntentNewCard(send)
                        .then(function (data) {
                            console.log("DATA HERE", data);
                            // Initialize Stripe.js
                            var stripe = Stripe('pk_test_51QttFFG8WiGSRCORyxkdZTO8oajcqz9OUsvcDJFpr9FB2PAdbzJc0tS7WNnfzKYsTiqHN1YDZi5UtXk4K52SeD4h00YWXuChNd');

                            const options = {
                              clientSecret: data.client_secret,
                              // Fully customizable with appearance API.
                              appearance: {},
                              paymentMethodOrder: ['card', 'apple_pay', 'google_pay']

                            };

                            // Set up Stripe.js and Elements using the SetupIntent's client secret
                            const elements = stripe.elements(options);

                            // Create and mount the Payment Element
                            const paymentElementOptions = { layout: 'tabs'};
                            const paymentElement = elements.create('payment', paymentElementOptions);
                            paymentElement.mount('#payment-element');


                            const submitButton = document.getElementById('submit-stripe');
                            if (submitButton) {
                              submitButton.addEventListener('click', async (event) => {

                                $scope.$apply(() => {
                                    vm.show_loading = true;
                                });
                                event.preventDefault();
                                //console.log('Submit button clicked!');
                                
                                // Process the payment manually
                                const {error, paymentIntent} = await stripe.confirmPayment({
                                  elements,
                                  confirmParams: {
                                   // return_url: 'https://example.com/order/confirmation',
                                  },
                                  redirect: 'if_required', // Only redirect if absolutely necessary
                                });
                                
                                if (error) {
                                  console.error(error);

                                  $scope.$apply(() => {
                                        vm.show_loading = false;
                                    });

                                } else if(paymentIntent){
                                    //console.log("SUCCESS??");
                                        if (paymentIntent.status === 'succeeded') {
                                            //console.log("PAYMENT SUCCEEDED!!");

                                            //this is where I will now look at confirming that this is paid etc...paymentIntent

                                            $scope.$apply(() => {
                                                vm.book_in_flight('new_card', paymentIntent);
                                            });
                                            

                                        } else {
                                             //console.log("There was an error processing your payment");
                                            $scope.$apply(() => {
                                                vm.show_loading = true;
                                            });
                                        }
                                }
                              });
                            }




                        });
 */







                //SAMPLE ACCORDION MENU TO SELECT THE PAYMENT METHOD

                        //console.log("FLIGHTS", vm.invoices);
                        //console.log("FLIGHTS TOTAL", vm.previous_total);
                        // vm.invoices = data.invoice.flights;
                    } else {
                        //console.log("no invoices have yet been issued for this flight");
                        vm.fp.loaded = true;
                        vm.fp.empty = true;
                    }


                });



            // PlaneService.GetOpenIssues(booking.plane_id)
            // .then(function (data) {
            //         ////console.log("data is : ", data);
            //        vm.reported_defects = data;
            //     });

            //   PlaneService.GetAllSheetReceipts(vm.bookout.id)
            //     .then(function (data) {
            //         ////console.log("data is : ", data);
            //         vm.lubricant_receipts = data;
            //     });


            //     InstructorCharges.GetByClubId(booking.club_id)
            //     .then(function(data){
            //         vm.instructor_charges = data.items;  
            //     });
            //we need to update the PICS now...

           
            //we need to know where the plane was last booked-in at 
            //(ie: if last flight bookout was completed - where the plane landed at last)
            //if the last booking was not yet completed, then we can assume that this last flight was returning to base.


            
            // var selected_pic = vm.pics.find(item => item.user_id === booking.pic_id);
            // vm.bookout.pic = selected_pic;

            // //console.log("booking.detail_type_id", booking.detail_type_id);

            // // var selected_detail_type = vm.flight_types.find(item => item.id === booking.detail_type_id);
            // // vm.bookout.flight_type = selected_detail_type;

            // if(booking.instructor && booking.instructor !== "" && booking.instructor.id == booking.pic_id){
            //     vm.bookout.put = vm.bookout.user;
            // }

           

            // vm.bookout.from_airfield = booking.from_airport;
            // vm.bookout.to_airfield = booking.to_airport;

            // vm.bookout.start_tacho = Number.parseFloat(booking.last_tacho);
            
            // vm.start_tacho_orig = booking.last_tacho;



           
             //this is where we sort out some of the last bits....



            // if(booking.instructor && booking.instructor !== "" && booking.instructor.id > 0){
            //     // then we need to set the PIC as the instructor
            //     //select from pics where user_id = booking.user_id;
            //     var selected_pic = vm.pics.find(item => item.user_id === booking.instructor.id);
            //     //set the PIC now...
            //     vm.bookout.pic = selected_pic;
            //     vm.bookout.instructor_id = booking.instructor.id;
            //     vm.bookout.instructor = booking.instructor;


            //     var selected_put = vm.pics.find(item => item.user_id === booking.user_id);
            //     vm.bookout.put = selected_put;

            // } else {
            //     //then the user is the PIC
            //     var selected_pic = vm.pics.find(item => item.user_id === booking.user_id);
            //     vm.bookout.pic = selected_pic;

            // }

       

            // if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.wgs_n){
            //     vm.wgs_n = booking.plane_details.location.wgs_n
            //     vm.wgs_e = booking.plane_details.location.wgs_e;
            // }
            // var location_default = "";

            // if(booking && booking.plane_details && booking.plane_details.location && booking.plane_details.location.code){
            //     location_default = booking.plane_details.location.code.slice(0, -1);
            // } else {
            //     location_default = "EG";
            // }

            // //vm.update_book_in_options();

            // BookoutService.GetAirfieldsByCode(location_default)
            //     .then(function (data) {
            //         if(data.success){
            //             //use GB airfields first...
            //             vm.airfields = data.airfields;
            //             // var selected_location = vm.airfields.find(item => item.id === booking.plane_details.location.id);
            //             // //console.log("selected_location", selected_location);
            //             // vm.bookout.from_airfield = selected_location;
            //            }
            //         });



            //booking.plane_details.location.id
            // vm.bookout.pic = selected_pic;


        }


            //nice looking date pickers


            $scope.popup = [];

            $scope.open = function(id, $event) {
                //console.log("THIS", id);
                //this comment would allow the event not to be affect by clicking it again... not sure this is a good idea
                if($scope.popup[id] && $scope.popup[id].opened == true){
                    $event.preventDefault();
                    $event.stopPropagation();
                } else {
                    $scope.popup[id] = {opened: true};
                }
            };

            $scope.formats = ['dd/MM/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = $scope.formats[0];

            $scope.datePickerOptions = {
                                        format: 'dd/MM/yyyy',
                                        showWeeks: false
                                    };

           

         
        


    
        /* ═══════════════════════════════════════════════════════════════════════════
           v2 FINISH & PAY — only for an unfinished flight opened later from My Account (legs booked in with
           "add another leg"); straight after a flight the charges and the payment are at the bottom of the book-in.
           Everything above is v1's FinishAndPayController, copied. The figures are the server's invoices
           (invoices/booking/{id}); paying uses BookinV2Payment with the booking (send.booking_id) — never an amount.
           ═══════════════════════════════════════════════════════════════════════════ */
        var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        vm.fp = { loaded: false, empty: false, error: '', busy: false, note: '' };
        vm.pay = null;
        vm.td = TimeDisplayService.context(null);

        function fday(d){ var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if(!m){ return ''; } var x = new Date(+m[1], +m[2] - 1, +m[3], 12); return DAY[x.getDay()] + ' ' + x.getDate() + ' ' + MON[x.getMonth()]; }
        vm.fp_fday = fday;
        var money_fmt = {};
        function currency_iso(sym){
            var s = String(sym || '').trim();
            if(/^[A-Z]{3}$/.test(s)){ return s; }
            return { '£': 'GBP', '€': 'EUR', '$': 'USD' }[s] || 'GBP';
        }
        function money(n){
            n = Number(n); if(isNaN(n)){ return '—'; }
            var cur = currency_iso(vm.invoices && vm.invoices[0] && vm.invoices[0].currency);
            if(!money_fmt[cur]){ try { money_fmt[cur] = new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur }); } catch(e){ money_fmt[cur] = { format: function(x){ return cur + ' ' + x.toFixed(2); } }; } }
            return (n < 0 ? '−' : '') + money_fmt[cur].format(Math.abs(n));
        }
        vm.fp_money = money;
        function hm(mins){ return Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2); }

        vm.fp_mode = function(){
            if(!vm.fp.loaded || vm.fp.empty || vm.fp.error){ return 'none'; }
            var t = Number(vm.invoice_totals) || 0;
            if(t > 0 && (!vm.can_authorise || vm.is_payer)){ return 'pay'; }
            if(t > 0 && vm.can_authorise && !vm.is_payer){ return 'invoice'; }
            if(t < 0 && !vm.can_authorise){ return 'credit'; }   // v1 read vm.plane_charges.total here, which is always 0 on this page
            return 'none';
        };
        // one leg = one invoiced flight (the server's lines, VAT inclusive as v1 shows them)
        var legs_key = null, legs_cache = [];
        vm.fp_legs = function(){
            var key = (vm.invoices || []).length + '|' + vm.invoice_totals + '|' + (vm.td && vm.td.mode);
            if(key === legs_key){ return legs_cache; }
            legs_cache = (vm.invoices || []).map(function(inv, i){
                var d = inv.flight_details || {};
                var v = (d.brakes_off || d.takeoff_time) ? TimeDisplayService.pick(d, vm.td.mode) : null;
                var kind = d.holder_capacity === 'PUT' ? 'dual' : (d.authorised_solo > 0 || d.holder_capacity === 'PICUS') ? 'solo' : 'hire';
                var crew = d.holder_capacity === 'PUT' ? (d.pic_name || '') + ' (instructor) · ' + (d.put_name || '') + ' (student)'
                         : (d.authorised_solo > 0 || d.holder_capacity === 'PICUS') ? (d.pic_name || '') + ', solo — authorised by ' + (d.instructor_name || '')
                         : (d.pic_name ? d.pic_name + ', self-fly hire' : '');
                var lines = (inv.items || []).filter(function(it){ return !it.ui_hidden; }).map(function(it){
                    var pkg = it.member_package_id > 0, vat = Number(it.vat_rate) || 0;
                    var unit = vat > 0 ? Number(it.unit_price) * (1 + vat / 100) : Number(it.unit_price);
                    var un = Number(it.unit) || 0, cnt = un % 1 === 0 ? String(un) : un.toFixed(2);   // whole counts as "3 × …"
                    return { t: it.title, s: pkg ? (un ? cnt + ' h from your package' : 'From your package') : (Number(it.total) === 0 ? '' : cnt + ' × ' + money(unit)),
                             a: Number(it.total) || 0, pkg: pkg, credit: Number(it.total) < 0 };
                });
                var fa = fp_af(inv.from, d.from_icao), ta = fp_af(inv.to, d.to_icao);   // C13: ICAO codes on the legs
                return { n: i + 1, kind: kind, from: fa, to: ta, away: !!(ta.code || ta.name) && (ta.code || ta.name) !== (fa.code || fa.name), reg: inv.plane_registration, type: inv.plane_type, inv: inv.invoice_number,
                         date: d.flight_date, time: v && !v.missing ? (v.window === 'airborne' ? 'Airborne ' : 'Block ') + v.from + '–' + v.to + (v.durationHM ? ' · ' + v.durationHM : '') + (v.rounded ? ' (to 5 min)' : '') : '',
                         mins: v && v.durationMins, crew: crew, lines: lines, total: Number(inv.total) || 0 };
            });
            legs_key = key;
            return legs_cache;
        };
        vm.fp_flight_time = function(){ var m = 0, any = false; vm.fp_legs().forEach(function(l){ if(l.mins !== null && l.mins !== undefined){ m += l.mins; any = true; } }); return any ? hm(m) : '—'; };
        vm.fp_vat = function(){
            var v = 0, any = false;
            (vm.invoices || []).forEach(function(inv){ (inv.items || []).forEach(function(it){ var r = Number(it.vat_rate) || 0; if(r > 0){ any = true; v += (Number(it.total) || 0) * r / (100 + r); } }); });
            return any ? { amount: Math.round(v * 100) / 100, rate: ((vm.invoices[0].items || []).filter(function(it){ return Number(it.vat_rate) > 0; })[0] || {}).vat_rate } : null;
        };
        vm.fp_vat_rate = function(){ var v = vm.fp_vat(); return v ? v.rate : 0; };
        vm.fp_vat_amount = function(){ var v = vm.fp_vat(); return v ? v.amount : 0; };
        vm.fp_reg = function(){ var i = vm.invoices && vm.invoices[0]; return i ? (i.plane_registration || '') : ((vm.bookout && vm.bookout.registration) || ''); };
        vm.fp_type = function(){ var i = vm.invoices && vm.invoices[0]; return i ? (i.plane_type || '') : ''; };
        vm.fp_date = function(){ var i = vm.invoices && vm.invoices[0]; return i && i.flight_details ? fday(i.flight_details.flight_date) : ''; };
        // the invoice API names the airfields (plane_log_sheets' airport titles): show the ICAO code when that is what came, else the short name
        function fp_af(t, icao){ t = String(t || ''); var nm = t.replace('NOT LISTED : ', '').replace(/ (Aerodrome|Airport|Airfield)$/i, '');
            if(icao && icao !== 'ZZZZ'){ return { code: icao, name: /^[A-Z0-9]{4}$/.test(t) ? '' : nm }; }
            if(/^[A-Z0-9]{4}$/.test(t)){ return { code: t, name: '' }; } return { code: '', name: nm }; }
        vm.fp_routes = function(){ return vm.fp_legs().map(function(l){ var a = l.from.code || l.from.name, b = l.to.code || l.to.name; return a + '→' + (b || a); }).join(' · '); };
        vm.fp_payer_why = function(){
            var d = (vm.invoices && vm.invoices[0] && vm.invoices[0].flight_details) || {};
            return d.holder_capacity === 'PUT' ? 'the student pays for a lesson' : (d.authorised_solo > 0 || d.holder_capacity === 'PICUS') ? 'the pilot in command pays for an authorised solo' : 'the booking\'s pilot pays';
        };
        vm.fp_payer_first = function(){ return (vm.fp_payer_name() || 'The pilot').split(' ')[0]; };
        // "Cessna 152" from the booking's aircraft (as the book-in's hero), else the invoice's type
        vm.fp_model = function(){
            var a = (vm.bookout && vm.bookout.plane) || {}, tc = function(x){ return String(x || '').toLowerCase().replace(/\b[a-z]/g, function(ch){ return ch.toUpperCase(); }); };
            var m = bkV2MakeModel(a.manufacturer ? tc(String(a.manufacturer).replace(/ AIRCRAFT.*| CORP.*| INC.*/i, '')) : '', a.type_name ? tc(a.type_name) : '');
            return m || vm.fp_type();
        };
        vm.fp_ac_colour = function(){ var a = (vm.bookout && vm.bookout.plane) || {}; return a.colour || a.booking_colour || 'var(--ta-brand-2)'; };
        // one phrasing for the rounding with the book-in: "Block, to 5 min" / "Airborne, exact"
        vm.fp_time_label = function(){ var d = vm.td && vm.td.def; if(!d){ return ''; } return (d.window === 'airborne' ? 'Airborne' : 'Block') + (d.rounded ? ', to 5 min' : ', exact'); };
        vm.fp_club = function(){ var i = vm.invoices && vm.invoices[0]; return (i && i.club_title) || ''; };
        var payer_key = null, payer_row_name = '';   // the payer's name from the members list (memoised: it is read every digest)
        vm.fp_payer_name = function(){
            var pid = vm.bookout && vm.bookout.payer_id, key = pid + '|' + (vm.pics || []).length;
            if(payer_key !== key){ payer_key = key; var row = pid > 0 ? (vm.pics || []).filter(function(x){ return x && x.user_id == pid; })[0] : null; payer_row_name = row ? (row.name || ((row.first_name || '') + ' ' + (row.last_name || '')).trim()) : ''; }
            if(payer_row_name){ return payer_row_name; }
            if(vm.is_payer){ return (vm.user.first_name + ' ' + (vm.user.last_name || '')).trim(); }
            var d = (vm.invoices && vm.invoices[0] && vm.invoices[0].flight_details) || {};
            return d.holder_capacity === 'PUT' ? (d.put_name || '') : (d.pic_name || '');
        };

        vm.fp_prepare_pay = function(){
            if(vm.bookout && vm.bookout.club_id){ vm.td.setClub(vm.bookout.club_id); }
            if(vm.fp_mode() !== 'pay' && !(Number(vm.invoice_totals) > 0)){ return; }
            if(!vm.pay){
                vm.pay = BookinV2Payment.create({
                    clubId: function(){ return vm.bookout.club_id; },
                    money: money,
                    staff: function(){ return !!(vm.can_authorise || ((vm.user.access.instructor || []).indexOf(vm.bookout.club_id) > -1) || ((vm.user.access.manager || []).indexOf(vm.bookout.club_id) > -1)); },
                    mandate: function(payer, club){ return MemberService.GetMandate(payer, club); },   // info + cards + reader in one
                    cards: function(payer, club){ return PaymentService.GetMemberCards({ user_id: payer, club_id: club, membership_id: 1 }); },   // the default card (as the book-in does)
                    send: function(){ return vm.send; },                                                // { club_id, user_id, booking_id }
                    onConfirm: function(method, paymentIntent){ return vm.donConfirm(method, paymentIntent); },
                    machineSend: function(){ return $q.when(vm.send); },                                // booking_id (C3), never an amount
                    onMachinePaid: function(paymentIntent){ vm.pay.mach = null; return vm.book_in_flight('card-machine', paymentIntent); },
                    onMachineStopped: function(){}
                });
            }
            vm.pay.load(vm.bookout.payer_id || vm.bookout.user_id, vm.bookout.club_id);
        };
        // v1's donConfirm called book_in_flight without returning it — the pay state waits on the promise
        vm.donConfirm = function(methodLabel, paymentIntent){ return vm.book_in_flight(methodLabel, paymentIntent); };

        vm.fp_finish = function(){
            if(vm.fp.busy || vm.show_loading){ return; }
            var mode = vm.fp_mode();
            if(mode === 'pay'){
                if(!vm.pay || !vm.pay.ready()){ ToastService.warning('Choose how to pay', 'Pick a way to pay first.'); return; }
                vm.pay.go();
                return;
            }
            if(mode === 'invoice' || mode === 'credit'){ vm.fp.outcome = mode; vm.book_in_flight(); }
        };
        vm.fp_button = function(){
            var mode = vm.fp_mode(), t = Number(vm.invoice_totals) || 0;
            if(vm.show_loading || (vm.pay && vm.pay.busy)){ return { busy: true, t: 'Processing…' }; }
            if(mode === 'pay'){ return { ic: vm.pay && vm.pay.method() && vm.pay.method().kind === 'direct-debit' ? 'fa-university' : vm.pay && vm.pay.method() && vm.pay.method().kind === 'card-machine' ? 'fa-cash-register' : 'fa-lock', t: vm.pay ? vm.pay.buttonWords(t) : 'Pay ' + money(t) }; }
            if(mode === 'invoice'){ return { ic: 'fa-paper-plane', t: 'Finish & send the invoice', s: money(t) + ' goes to ' + (vm.fp_payer_name() || 'the pilot') }; }
            if(mode === 'credit'){ return { ic: 'fa-flag-checkered', t: 'Finish', s: money(-t) + ' credit' }; }
            return { ic: 'fa-flag-checkered', t: 'Finish' };
        };
        vm.fp_arrival = function(method){
            var t = Number(vm.invoice_totals) || 0, w = vm.pay && vm.pay.paidWith;
            if(method === 'direct-debit'){ ToastService.success('Flight finished', money(t) + ' added to your direct debit', { confetti: false }); return; }
            if(method === 'card-machine'){ ToastService.success('Flight finished', 'Paid ' + money(t) + ' at the card machine', { confetti: false }); return; }
            if(method === 'new-card' || method === 'saved-card'){ ToastService.success('Flight finished', 'Paid ' + money(t) + (w && w.words ? ' ' + w.words : ''), { confetti: false }); return; }
            if(vm.fp.outcome === 'credit'){ ToastService.success('Flight finished', money(-t) + ' credited to your account', { confetti: false }); return; }
            ToastService.success('Flight finished', money(t) + ' invoiced to ' + (vm.fp_payer_name() || 'the pilot'), { confetti: false });
        };

        vm.pay_amount = function(){ return Number(vm.invoice_totals) || 0; };
        vm.pay_money = money;
        vm.mach_unpaid = function(){ return null; };
        $scope.$on('$destroy', function(){ if(vm.pay){ vm.pay.destroy(); } });

}