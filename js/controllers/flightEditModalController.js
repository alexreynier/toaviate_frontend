app.controller('FlightEditModalController', FlightEditModalController);

    FlightEditModalController.$inject = [
        '$scope', '$uibModalInstance', 'FlightEditsService', 'BookoutService',
        'MemberService', 'CourseService', 'InstructorCharges', 'ToastService',
        'VoucherService',
        'bookingId', 'plsId', 'clubId'
    ];
    function FlightEditModalController(
        $scope, $uibModalInstance, FlightEditsService, BookoutService,
        MemberService, CourseService, InstructorCharges, ToastService,
        VoucherService,
        bookingId, plsId, clubId
    ) {

        // ═══════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════
        $scope.step = 0;              // 0 = loading, 1 = edit form, 2 = preview, 3 = result
        $scope.loading = false;
        $scope.submitting = false;
        $scope.bookingId = bookingId;     // may be null for PLS-only
        $scope.plsOnlyId = plsId;         // PLS ID when no booking
        $scope.clubId = clubId;
        $scope.hasBooking = !!bookingId;  // true if flight has an associated booking
        $scope.crewChanged = false;       // true when student or instructor is changed

        // Original data from API
        $scope.original = null;
        $scope.plsId = null;              // resolved PLS ID after load

        // Form model (editable copy)
        $scope.form = {};

        // Preview / apply
        $scope.preview = null;
        $scope.result = null;
        $scope.financial = { action: '' };  // object so ng-if child scopes inherit by reference

        // ── Invoice payment state helpers (used to conditionally show financial action options) ──
        // Returns: 'unpaid', 'stripe', 'gocardless', or 'other'
        $scope.getInvoicePaymentState = function() {
            // Check if any invoice is unpaid
            var hasUnpaid = false;
            var paidMethod = null;

            if ($scope.invoices && $scope.invoices.length > 0) {
                for (var i = 0; i < $scope.invoices.length; i++) {
                    var inv = $scope.invoices[i];
                    if (inv.status !== 'paid') {
                        hasUnpaid = true;
                    }
                }
            }

            // Check payment method from payments array
            if ($scope.payments && $scope.payments.length > 0) {
                for (var p = 0; p < $scope.payments.length; p++) {
                    var pay = $scope.payments[p];
                    var method = (pay.method || pay.payment_method || '').toLowerCase();
                    if (method.indexOf('stripe') !== -1 || method === 'card') {
                        paidMethod = 'stripe';
                    } else if (method.indexOf('gocardless') !== -1 || method.indexOf('direct_debit') !== -1 || method === 'direct debit') {
                        paidMethod = 'gocardless';
                    } else if (!paidMethod) {
                        paidMethod = 'other';
                    }
                }
            }

            // If no payments exist or all invoices are unpaid
            if (!paidMethod || hasUnpaid) {
                // If there are payments AND unpaid invoices, the payments indicate method
                // But if there are NO payments at all, it's unpaid
                if (!paidMethod) return 'unpaid';
                // If some invoices paid but at least one unpaid, still return payment method
                // so we offer the right refund/credit options
            }

            return paidMethod || 'unpaid';
        };

        // Dropdowns
        $scope.availablePlanes = [];
        $scope.availableInstructors = [];
        $scope.availableMembers = [];
        $scope.courses = [];
        $scope.instructorCharges = [];
        $scope.lessons = [];
        $scope.piCandidates = [];
        $scope.availableVouchers = [];

        // Airfield search
        $scope.airfields = [];
        $scope.fromAirfield = null;
        $scope.toAirfield = null;

        // Time arrays
        $scope.brakesOffTimes = [];
        $scope.takeoffTimes = [];
        $scope.landingTimes = [];
        $scope.brakesOnTimes = [];

        // Selected time objects
        $scope.selectedBrakesOff = null;
        $scope.selectedTakeoff = null;
        $scope.selectedLanding = null;
        $scope.selectedBrakesOn = null;

        // Edit history & audit
        $scope.showHistory = false;
        $scope.editHistory = [];
        $scope.auditDetail = null;
        $scope.showAuditDetail = false;

        // Accordion sections
        $scope.sections = {
            aircraft: true,
            times: true,
            route: true,
            other: false,
            financial: false,
            history: false
        };


        // ═══════════════════════════════════════════════
        // TIME GENERATION (mirroring booking screens)
        // ═══════════════════════════════════════════════
        function initTimes() {
            var times = [];
            for (var i = 0; i < 24; i++) {
                for (var j = 0; j < 60; j += 5) {
                    var hh = ((i < 10) ? '0' : '') + i;
                    var mm = ((j < 10) ? '0' : '') + j;
                    times.push({ time: hh + ':' + mm, disabled: 0 });
                }
            }
            $scope.brakesOffTimes = angular.copy(times);
            $scope.takeoffTimes = angular.copy(times);
            $scope.landingTimes = angular.copy(times);
            $scope.brakesOnTimes = angular.copy(times);
        }

        function findTimeSlot(timeStr, timesArray) {
            if (!timeStr) return null;
            // Normalize: "8:30" -> "08:30", "14:5" -> "14:05", "10:23:00" -> "10:23"
            var parts = timeStr.split(':');
            if (parts.length < 2) return null;
            // Strip seconds if present (HH:MM:SS -> HH:MM)
            var hh = parseInt(parts[0], 10);
            var mm = parseInt(parts[1], 10);
            if (isNaN(hh) || isNaN(mm)) return null;
            var exactStr = ((hh < 10) ? '0' : '') + hh + ':' + ((mm < 10) ? '0' : '') + mm;

            // First try exact match (covers times already on 5-min boundary)
            for (var i = 0; i < timesArray.length; i++) {
                if (timesArray[i].time === exactStr) return timesArray[i];
            }

            // Not on a 5-min boundary — insert the original time into the array
            // so it appears as the pre-selected value; new picks will be 5-min slots
            var originalSlot = { time: exactStr, disabled: 0, isOriginal: true };
            var insertIdx = 0;
            var exactMinutes = hh * 60 + mm;
            for (var j = 0; j < timesArray.length; j++) {
                if (timeToMinutes(timesArray[j].time) < exactMinutes) {
                    insertIdx = j + 1;
                } else {
                    break;
                }
            }
            timesArray.splice(insertIdx, 0, originalSlot);
            return originalSlot;
        }

        function timeToMinutes(timeStr) {
            if (!timeStr) return -1;
            var parts = timeStr.split(':');
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }

        // Normalise time string to HH:MM (strip seconds if present)
        function normaliseTimeHHMM(timeStr) {
            if (!timeStr) return '';
            var parts = timeStr.split(':');
            if (parts.length < 2) return timeStr;
            var hh = parseInt(parts[0], 10);
            var mm = parseInt(parts[1], 10);
            if (isNaN(hh) || isNaN(mm)) return timeStr;
            return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
        }

        // Enforce sequential: each subsequent time must be >= previous
        function enforceSequential() {
            var boMin = $scope.selectedBrakesOff ? timeToMinutes($scope.selectedBrakesOff.time) : -1;
            var toMin = $scope.selectedTakeoff ? timeToMinutes($scope.selectedTakeoff.time) : -1;
            var ldMin = $scope.selectedLanding ? timeToMinutes($scope.selectedLanding.time) : -1;

            // Takeoff must be >= brakes off
            $scope.takeoffTimes.forEach(function(t) {
                var m = timeToMinutes(t.time);
                t.disabled = (boMin >= 0 && m < boMin) ? 1 : 0;
            });

            // Landing must be >= takeoff (or brakes off if no takeoff)
            var afterTakeoff = toMin >= 0 ? toMin : boMin;
            $scope.landingTimes.forEach(function(t) {
                var m = timeToMinutes(t.time);
                t.disabled = (afterTakeoff >= 0 && m < afterTakeoff) ? 1 : 0;
            });

            // Brakes on must be >= landing (or takeoff, or brakes off)
            var afterLanding = ldMin >= 0 ? ldMin : (toMin >= 0 ? toMin : boMin);
            $scope.brakesOnTimes.forEach(function(t) {
                var m = timeToMinutes(t.time);
                t.disabled = (afterLanding >= 0 && m < afterLanding) ? 1 : 0;
            });
        }

        $scope.onTimeChange = function(which, $item) {
            // Sync the selected item to the controller scope to avoid
            // Angular 1 child scope shadowing (ui-select uses scope:true,
            // so ngModel writes to the child scope, leaving $scope stale)
            if (which === 'brakes_off') $scope.selectedBrakesOff = $item;
            else if (which === 'takeoff') $scope.selectedTakeoff = $item;
            else if (which === 'landing') $scope.selectedLanding = $item;
            else if (which === 'brakes_on') $scope.selectedBrakesOn = $item;

            // Update form values from selected objects
            $scope.form.brakes_off = $scope.selectedBrakesOff ? $scope.selectedBrakesOff.time : '';
            $scope.form.takeoff_time = $scope.selectedTakeoff ? $scope.selectedTakeoff.time : '';
            $scope.form.landing_time = $scope.selectedLanding ? $scope.selectedLanding.time : '';
            $scope.form.brakes_on = $scope.selectedBrakesOn ? $scope.selectedBrakesOn.time : '';

            // Clear downstream selections if they are now before the upstream
            if (which === 'brakes_off' && $scope.selectedTakeoff) {
                if (timeToMinutes($scope.selectedTakeoff.time) < timeToMinutes($scope.selectedBrakesOff.time)) {
                    $scope.selectedTakeoff = null;
                    $scope.form.takeoff_time = '';
                    $scope.selectedLanding = null;
                    $scope.form.landing_time = '';
                    $scope.selectedBrakesOn = null;
                    $scope.form.brakes_on = '';
                }
            }
            if (which === 'takeoff' && $scope.selectedLanding) {
                if (timeToMinutes($scope.selectedLanding.time) < timeToMinutes($scope.selectedTakeoff.time)) {
                    $scope.selectedLanding = null;
                    $scope.form.landing_time = '';
                    $scope.selectedBrakesOn = null;
                    $scope.form.brakes_on = '';
                }
            }
            if (which === 'landing' && $scope.selectedBrakesOn) {
                if (timeToMinutes($scope.selectedBrakesOn.time) < timeToMinutes($scope.selectedLanding.time)) {
                    $scope.selectedBrakesOn = null;
                    $scope.form.brakes_on = '';
                }
            }

            enforceSequential();
        };


        // ═══════════════════════════════════════════════
        // AIRFIELD SEARCH (mirroring booking screens)
        // ═══════════════════════════════════════════════
        $scope.searchAirfields = function(search) {
            if (search && search.length >= 2 && search.length < 5) {
                BookoutService.GetAirfieldsByCode(search)
                    .then(function(data) {
                        if (data.success) {
                            $scope.airfields = data.airfields;
                            if ($scope.airfields.length === 0) {
                                $scope.airfields = [{ id: 0, title: 'NOT LISTED : ' + search, code: 'ZZZZ', wgs_n: '0', wgs_e: '0' }];
                            }
                        }
                    });
            }
            if (search && search.length > 4) {
                var code = search.replace(/\s/g, '_');
                BookoutService.GetAirfields(code)
                    .then(function(data) {
                        if (data.success) {
                            $scope.airfields = data.airfields;
                            if ($scope.airfields.length === 0) {
                                $scope.airfields = [{ id: 0, title: 'NOT LISTED : ' + search, code: 'ZZZZ', wgs_n: '0', wgs_e: '0' }];
                            }
                        }
                    });
            }
        };

        // ui-select uses scope:true, so ngModel writes land on a child scope
        // and $scope.fromAirfield/toAirfield here can be stale — sync from the
        // $item passed by on-select (same pattern as onTimeChange above).
        $scope.onFromAirfieldSelect = function($item) {
            if ($item) { $scope.fromAirfield = $item; }
            if ($scope.fromAirfield) {
                $scope.form.from_airport_id = $scope.fromAirfield.id;
            }
        };

        $scope.onToAirfieldSelect = function($item) {
            if ($item) { $scope.toAirfield = $item; }
            if ($scope.toAirfield) {
                $scope.form.to_airport_id = $scope.toAirfield.id;
            }
        };

        // Clearing a picker sends 0 — the backend stores it and the lists
        // render "Unknown" (see FRONTEND_FLIGHT_EDIT_AIRFIELDS_GUIDE.md).
        $scope.onFromAirfieldRemove = function() {
            $scope.fromAirfield = null;
            $scope.form.from_airport_id = 0;
        };

        $scope.onToAirfieldRemove = function() {
            $scope.toAirfield = null;
            $scope.form.to_airport_id = 0;
        };


        // ═══════════════════════════════════════════════
        // AIRCRAFT DISPLAY
        // ═══════════════════════════════════════════════
        $scope.getPlaneRegistration = function() {
            // Try the current plane object first
            if ($scope.currentPlane && $scope.currentPlane.registration) {
                return $scope.currentPlane.registration;
            }
            // Fall back to looking up the form's plane_id in availablePlanes
            if ($scope.form.plane_id && $scope.availablePlanes && $scope.availablePlanes.length) {
                for (var i = 0; i < $scope.availablePlanes.length; i++) {
                    if ($scope.availablePlanes[i].plane_id == $scope.form.plane_id) {
                        return $scope.availablePlanes[i].registration;
                    }
                }
            }
            return null;
        };


        // ═══════════════════════════════════════════════
        // MEMBER SEARCH
        // ═══════════════════════════════════════════════
        $scope.searchMembers = function(search) {
            if (search && search.length > 2) {
                MemberService.GetAllByClubAndName(clubId, search)
                    .then(function(data) {
                        if (data && data.success) {
                            $scope.availableMembers = data.members || [];
                        }
                    });
            }
        };

        $scope.onMemberSelect = function() {
            if ($scope.form.selectedMember) {
                $scope.form.user_id = $scope.form.selectedMember.user_id || $scope.form.selectedMember.id;
            } else {
                $scope.form.user_id = null;
            }
        };


        // ═══════════════════════════════════════════════
        // INSTRUCTOR CHANGE -> course/tuition cascade
        // ═══════════════════════════════════════════════
        $scope.onInstructorSelect = function() {
            if ($scope.form.selectedInstructor) {
                $scope.form.instructor_id = $scope.form.selectedInstructor.id || $scope.form.selectedInstructor.user_id;
            } else {
                doClearInstructor();
            }
            // Rebuild PIC/PUT candidates so the newly selected (or cleared)
            // instructor appears (or is removed from) the PIC dropdown.
            buildPicPutCandidates();
        };

        $scope.onInstructorRemove = function() {
            doClearInstructor();
            buildPicPutCandidates();
        };

        // Explicit clear button handler
        $scope.clearInstructor = function() {
            $scope.form.selectedInstructor = null;
            doClearInstructor();
            buildPicPutCandidates();
        };

        // Shared logic for removing the instructor and cascading course/tuition/lesson
        function doClearInstructor() {
            $scope.form.instructor_id = null;
            $scope.form.authorised_solo = false;
            $scope.form.is_picus = false;
            $scope.form.selectedCourse = null;
            $scope.form.course_id = null;
            $scope.form.selectedTuition = null;
            $scope.form.tuition_id = null;
            $scope.instructorCharges = [];
            $scope.form.selectedLesson = null;
            $scope.form.lesson_id = null;
            $scope.lessons = [];

            // No instructor → student is PIC, clear PUT
            var memberId = $scope.form.user_id
                || ($scope.form.selectedMember && ($scope.form.selectedMember.user_id || $scope.form.selectedMember.id))
                || ($scope.currentUser && $scope.currentUser.id)
                || null;
            $scope.form.pic_id = memberId ? parseInt(memberId, 10) : null;
            $scope.form.put_id = null;
        }

        $scope.onCourseSelect = function() {
            if ($scope.form.selectedCourse) {
                $scope.form.course_id = $scope.form.selectedCourse.id;
                // Load tuition types for the selected course
                loadInstructorCharges($scope.form.selectedCourse.id);
                // Load lessons for the selected course
                loadLessons($scope.form.selectedCourse.id);
            } else {
                $scope.form.course_id = null;
                $scope.form.selectedTuition = null;
                $scope.form.tuition_id = null;
                $scope.instructorCharges = [];
                $scope.form.selectedLesson = null;
                $scope.form.lesson_id = null;
                $scope.lessons = [];
            }
        };

        $scope.onTuitionSelect = function() {
            if ($scope.form.selectedTuition) {
                $scope.form.tuition_id = $scope.form.selectedTuition.id;
            } else {
                $scope.form.tuition_id = null;
            }
        };

        $scope.onLessonSelect = function() {
            if ($scope.form.selectedLesson) {
                $scope.form.lesson_id = $scope.form.selectedLesson.id;
            } else {
                $scope.form.lesson_id = null;
            }
        };


        // ═══════════════════════════════════════════════
        // VOUCHER SEARCH / SELECT
        // ═══════════════════════════════════════════════
        var vouchersLoaded = false;
        $scope.searchVouchers = function() {
            // Load all club vouchers once; ui-select propsFilterA handles filtering
            if (!vouchersLoaded) {
                vouchersLoaded = true;
                VoucherService.GetByClubId(clubId)
                    .then(function(data) {
                        var items = data.vouchers || data.items || (Array.isArray(data) ? data : []);
                        // Merge with any pre-selected voucher to avoid duplicates
                        if ($scope.form.selectedVoucher) {
                            var existingId = $scope.form.selectedVoucher.id;
                            var found = false;
                            for (var vi = 0; vi < items.length; vi++) {
                                if (items[vi].id == existingId) { found = true; break; }
                            }
                            if (!found) items.unshift($scope.form.selectedVoucher);
                        }
                        $scope.availableVouchers = items;
                    });
            }
        };

        $scope.onVoucherSelect = function() {
            if ($scope.form.selectedVoucher) {
                $scope.form.voucher_id = $scope.form.selectedVoucher.id;
            }
        };

        $scope.onVoucherRemove = function() {
            $scope.form.voucher_id = null;
        };

        $scope.clearVoucher = function() {
            $scope.form.selectedVoucher = null;
            $scope.form.voucher_id = null;
        };


        // ═══════════════════════════════════════════════
        // LOAD AUXILIARY DATA (courses, tuition types)
        // ═══════════════════════════════════════════════
        function loadCourses() {
            CourseService.GetCoursesByClubId(clubId)
                .then(function(data) {
                    if (data && data.items) {
                        $scope.courses = data.items;
                    } else if (data && data.courses) {
                        $scope.courses = data.courses;
                    } else if (Array.isArray(data)) {
                        $scope.courses = data;
                    }
                });
        }

        function loadInstructorCharges(courseId) {
            if (!courseId) {
                $scope.instructorCharges = [];
                return;
            }
            InstructorCharges.GetByCourseId(courseId)
                .then(function(data) {
                    if (data && data.items) {
                        $scope.instructorCharges = data.items;
                    } else if (data && data.instructor_charges) {
                        $scope.instructorCharges = data.instructor_charges;
                    } else if (Array.isArray(data)) {
                        $scope.instructorCharges = data;
                    }
                });
        }

        function loadLessons(courseId) {
            if (!courseId) {
                $scope.lessons = [];
                return;
            }
            CourseService.GetLessonsByCourseId(courseId)
                .then(function(data) {
                    if (data && data.items) {
                        $scope.lessons = data.items;
                    } else if (data && data.lessons) {
                        $scope.lessons = data.lessons;
                    } else if (Array.isArray(data)) {
                        $scope.lessons = data;
                    }
                });
        }

        function buildPicPutCandidates() {
            var candidates = [];
            if ($scope.currentUser && $scope.currentUser.id) {
                candidates.push({
                    id: parseInt($scope.currentUser.id, 10),
                    label: ($scope.currentUser.first_name || '') + ' ' + ($scope.currentUser.last_name || '') + ' (Student)'
                });
            }
            if ($scope.currentInstructor && $scope.currentInstructor.id) {
                candidates.push({
                    id: parseInt($scope.currentInstructor.id, 10),
                    label: ($scope.currentInstructor.first_name || '') + ' ' + ($scope.currentInstructor.last_name || '') + ' (Instructor)'
                });
            }
            // When a new instructor is selected (e.g. switching a solo flight to
            // have an instructor), include them as a PIC candidate — but only if
            // authorised-solo / PICUS is not ticked (in those cases the student is PIC).
            if ($scope.form.selectedInstructor && $scope.form.selectedInstructor.id
                && !$scope.form.authorised_solo && !$scope.form.is_picus) {
                var selInstrId = parseInt($scope.form.selectedInstructor.id || $scope.form.selectedInstructor.user_id, 10);
                var alreadyPresent = false;
                for (var si = 0; si < candidates.length; si++) {
                    if (candidates[si].id === selInstrId) { alreadyPresent = true; break; }
                }
                if (!alreadyPresent) {
                    candidates.push({
                        id: selInstrId,
                        label: ($scope.form.selectedInstructor.first_name || '') + ' ' + ($scope.form.selectedInstructor.last_name || '') + ' (Instructor)'
                    });
                }
            }
            // If the current PIC/PUT is a different person, include them
            if ($scope.form.pic_id) {
                var picId = parseInt($scope.form.pic_id, 10);
                var picFound = false;
                for (var i = 0; i < candidates.length; i++) {
                    if (candidates[i].id === picId) { picFound = true; break; }
                }
                if (!picFound) {
                    candidates.push({ id: picId, label: $scope.getMemberName(picId) });
                }
            }
            if ($scope.form.put_id) {
                var putId = parseInt($scope.form.put_id, 10);
                var putFound = false;
                for (var i = 0; i < candidates.length; i++) {
                    if (candidates[i].id === putId) { putFound = true; break; }
                }
                if (!putFound) {
                    candidates.push({ id: putId, label: $scope.getMemberName(putId) });
                }
            }
            $scope.piCandidates = candidates;
        }


        // ═══════════════════════════════════════════════
        // STEP 1 — LOAD FLIGHT DATA
        // ═══════════════════════════════════════════════
        $scope.loadFlight = function() {
            $scope.step = 0;
            $scope.loading = true;

            initTimes();

            var loadPromise;
            if (bookingId) {
                loadPromise = FlightEditsService.GetFlight(bookingId);
            } else {
                loadPromise = FlightEditsService.GetPlaneLogSheet(plsId);
            }

            loadPromise.then(function(data) {
                $scope.loading = false;

                if (!data || !data.success) {
                    ToastService.error('Error', data ? data.message : 'Failed to load flight data');
                    $uibModalInstance.dismiss('error');
                    return;
                }

                $scope.original = data;

                // Identify the PLS
                var pls;
                if ($scope.hasBooking) {
                    pls = data.plane_log_sheets && data.plane_log_sheets[0] ? data.plane_log_sheets[0] : null;
                } else {
                    pls = data.plane_log_sheet || data;
                }
                $scope.plsId = pls ? pls.id : null;

                var booking = data.booking || {};

                // Build editable form
                $scope.form = {
                    plane_id: booking.plane_id || (pls ? pls.plane_id : null),
                    user_id: booking.user_id || (pls ? pls.user_id : null),
                    instructor_id: booking.instructor_id || (pls ? pls.instructor_id : null),
                    lesson_id: booking.lesson_id || null,
                    voucher_id: booking.voucher_id || null,
                    maintenance_flight: booking.maintenance_flight ? true : false,
                    from_airport_id: pls ? pls.from_airport_id : null,
                    to_airport_id: pls ? pls.to_airport_id : null,
                    flight_date: pls ? pls.flight_date : null,
                    brakes_off: pls ? pls.brakes_off : '',
                    brakes_on: pls ? pls.brakes_on : '',
                    takeoff_time: pls ? pls.takeoff_time : '',
                    landing_time: pls ? pls.landing_time : '',
                    tacho_start: pls ? parseFloat(pls.tacho_start) || '' : '',
                    tacho_end: pls ? parseFloat(pls.tacho_end) || '' : '',
                    landings: pls ? parseInt(pls.landings) || 0 : 0,
                    touch_and_gos: pls ? parseInt(pls.touch_and_gos) || 0 : 0,
                    night_landings: pls ? parseInt(pls.night_landings) || 0 : 0,
                    authorised_solo: pls ? (pls.authorised_solo ? true : false) : false,
                    is_picus: pls ? (pls.is_picus ? true : false) : false,
                    remarks: pls ? pls.remarks || '' : '',
                    route: pls ? pls.route || '' : '',
                    pic_id: pls ? (pls.pic_id ? parseInt(pls.pic_id, 10) : null) : null,
                    put_id: pls ? (pls.put_id ? parseInt(pls.put_id, 10) : null) : null,
                    course_id: pls ? pls.course_id : null,
                    tuition_id: pls ? pls.tuition_id : null,
                    selectedMember: null,
                    selectedInstructor: null,
                    selectedCourse: null,
                    selectedTuition: null,
                    selectedLesson: null,
                    selectedVoucher: null
                };

                // Available options
                $scope.availablePlanes = data.available_planes || [];
                $scope.availableInstructors = data.available_instructors || [];
                $scope.availableMembers = data.available_members || [];

                // Current objects
                $scope.currentUser = data.user || {};
                $scope.currentInstructor = data.instructor || {};
                $scope.currentPlane = data.plane || {};
                $scope.invoices = data.invoices || [];
                $scope.payments = data.payments || [];
                $scope.trainingRecords = data.training_records || [];
                $scope.editHistory = data.edit_history || [];
                $scope.club = data.club || {};
                $scope.currencySymbol = getCurrencySymbol(data.club ? data.club.currency : 'GBP');

                // ── Airfield pre-select (both paths — the PLS loader also returns
                //    from_airport / to_airport objects + code/name fallbacks) ──
                // Pre-select airfields — try PLS, then booking, then top-level, then code fallback
                if (pls && pls.from_airport) {
                    $scope.fromAirfield = pls.from_airport;
                } else if (booking && booking.from_airport) {
                    $scope.fromAirfield = booking.from_airport;
                } else if (data.from_airport) {
                    $scope.fromAirfield = data.from_airport;
                }
                if (pls && pls.to_airport) {
                    $scope.toAirfield = pls.to_airport;
                } else if (booking && booking.to_airport) {
                    $scope.toAirfield = booking.to_airport;
                } else if (data.to_airport) {
                    $scope.toAirfield = data.to_airport;
                }

                // If we have airport IDs but no airport objects, look them up by ID
                if (!$scope.fromAirfield && $scope.form.from_airport_id) {
                    // Try code/name fallback first
                    var fCode = (pls && pls.from_airport_code) || (booking && booking.from_airport_code) || null;
                    var fName = (pls && pls.from_airport_name) || (booking && booking.from_airport_name) || fCode;
                    if (fCode) {
                        $scope.fromAirfield = { id: $scope.form.from_airport_id, code: fCode, title: fName };
                    } else {
                        // Look up by ID from API
                        BookoutService.GetAirfieldById($scope.form.from_airport_id)
                            .then(function(afData) {
                                console.log('GetAirfieldById FROM response:', afData);
                                var af = extractAirfield(afData);
                                if (af) {
                                    $scope.fromAirfield = af;
                                    if (!$scope.toAirfield && $scope.form.to_airport_id == $scope.form.from_airport_id) {
                                        $scope.toAirfield = af;
                                    }
                                    seedAirfieldsArray();
                                }
                            });
                    }
                }

                if (!$scope.toAirfield && $scope.form.to_airport_id) {
                    var tCode = (pls && pls.to_airport_code) || (booking && booking.to_airport_code) || null;
                    var tName = (pls && pls.to_airport_name) || (booking && booking.to_airport_name) || tCode;
                    if (tCode) {
                        $scope.toAirfield = { id: $scope.form.to_airport_id, code: tCode, title: tName };
                    } else if ($scope.form.to_airport_id != $scope.form.from_airport_id) {
                        BookoutService.GetAirfieldById($scope.form.to_airport_id)
                            .then(function(afData) {
                                console.log('GetAirfieldById TO response:', afData);
                                var af = extractAirfield(afData);
                                if (af) {
                                    $scope.toAirfield = af;
                                    seedAirfieldsArray();
                                }
                            });
                    }
                }

                // Seed the airfields array for ui-select
                function seedAirfieldsArray() {
                    $scope.airfields = [];
                    if ($scope.fromAirfield) $scope.airfields.push($scope.fromAirfield);
                    if ($scope.toAirfield && (!$scope.fromAirfield || $scope.toAirfield.id !== $scope.fromAirfield.id)) {
                        $scope.airfields.push($scope.toAirfield);
                    }
                }
                seedAirfieldsArray();

                // ── Booking-only setup: members, instructors, courses ──
                if ($scope.hasBooking) {

                // Pre-select member
                if ($scope.currentUser && $scope.currentUser.id) {
                    $scope.form.selectedMember = $scope.currentUser;
                    if ($scope.availableMembers.length === 0) {
                        $scope.availableMembers = [$scope.currentUser];
                    }
                }

                // Pre-select instructor
                if ($scope.currentInstructor && $scope.currentInstructor.id) {
                    $scope.form.selectedInstructor = $scope.currentInstructor;
                    var instrFound = false;
                    for (var ii = 0; ii < $scope.availableInstructors.length; ii++) {
                        if ($scope.availableInstructors[ii].id == $scope.currentInstructor.id) {
                            $scope.form.selectedInstructor = $scope.availableInstructors[ii];
                            instrFound = true;
                            break;
                        }
                    }
                    if (!instrFound) {
                        $scope.availableInstructors.push($scope.currentInstructor);
                    }
                }

                // Build PIC/PUT candidate list
                buildPicPutCandidates();

                // Pre-select voucher if the flight has one
                if ($scope.original.voucher && $scope.original.voucher.id) {
                    $scope.form.selectedVoucher = $scope.original.voucher;
                    $scope.availableVouchers = [$scope.original.voucher];
                }

                // Rebuild PIC/PUT candidates when authorised-solo or PICUS is toggled,
                // so the instructor is added/removed from PIC options accordingly.
                $scope.$watch('form.authorised_solo', function() { buildPicPutCandidates(); });
                $scope.$watch('form.is_picus', function() { buildPicPutCandidates(); });

                } // end hasBooking setup

                // Pre-select times and normalise form values to HH:MM format
                // (API may return HH:MM:SS which would cause false diffs in buildChanges)
                $scope.selectedBrakesOff = findTimeSlot($scope.form.brakes_off, $scope.brakesOffTimes);
                $scope.selectedTakeoff = findTimeSlot($scope.form.takeoff_time, $scope.takeoffTimes);
                $scope.selectedLanding = findTimeSlot($scope.form.landing_time, $scope.landingTimes);
                $scope.selectedBrakesOn = findTimeSlot($scope.form.brakes_on, $scope.brakesOnTimes);
                // Sync normalised HH:MM back to form so buildChanges compares like-for-like
                $scope.form.brakes_off = $scope.selectedBrakesOff ? $scope.selectedBrakesOff.time : '';
                $scope.form.takeoff_time = $scope.selectedTakeoff ? $scope.selectedTakeoff.time : '';
                $scope.form.landing_time = $scope.selectedLanding ? $scope.selectedLanding.time : '';
                $scope.form.brakes_on = $scope.selectedBrakesOn ? $scope.selectedBrakesOn.time : '';
                enforceSequential();

                // Load courses, tuition types, and lessons (booking flights only)
                if ($scope.hasBooking) {

                // Load courses
                loadCourses();

                // Pre-select course after load, then load tuition types for that course
                if ($scope.form.course_id) {
                    var unwatchCourse = $scope.$watch('courses', function(newVal) {
                        if (newVal && newVal.length > 0 && $scope.form.course_id && !$scope.form.selectedCourse) {
                            for (var ci = 0; ci < newVal.length; ci++) {
                                if (newVal[ci].id == $scope.form.course_id) {
                                    $scope.form.selectedCourse = newVal[ci];
                                    // Load tuition types and lessons for this course
                                    loadInstructorCharges(newVal[ci].id);
                                    loadLessons(newVal[ci].id);
                                    break;
                                }
                            }
                            unwatchCourse();
                        }
                    });
                }
                // Pre-select tuition after course-specific charges load
                if ($scope.form.tuition_id) {
                    var unwatchTuition = $scope.$watch('instructorCharges', function(newVal) {
                        if (newVal && newVal.length > 0 && $scope.form.tuition_id && !$scope.form.selectedTuition) {
                            for (var ti = 0; ti < newVal.length; ti++) {
                                if (newVal[ti].id == $scope.form.tuition_id) {
                                    $scope.form.selectedTuition = newVal[ti];
                                    break;
                                }
                            }
                            unwatchTuition();
                        }
                    });
                }
                // Pre-select lesson after course-specific lessons load
                if ($scope.form.lesson_id && $scope.form.course_id) {
                    var unwatchLesson = $scope.$watch('lessons', function(newVal) {
                        if (newVal && newVal.length > 0 && $scope.form.lesson_id && !$scope.form.selectedLesson) {
                            for (var li = 0; li < newVal.length; li++) {
                                if (newVal[li].id == $scope.form.lesson_id) {
                                    $scope.form.selectedLesson = newVal[li];
                                    break;
                                }
                            }
                            unwatchLesson();
                        }
                    });
                }

                } // end hasBooking course/tuition/lesson setup

                $scope.step = 1;
            });
        };


        // ═══════════════════════════════════════════════
        // STEP 2 — PREVIEW CHANGES
        // ═══════════════════════════════════════════════
        $scope.previewChanges = function() {
            var changes = buildChanges();

            if (Object.keys(changes.bookingChanges).length === 0 && Object.keys(changes.plsChanges).length === 0) {
                ToastService.warning('No Changes', 'Please modify at least one field before previewing.');
                return;
            }

            $scope.submitting = true;

            var payload = {
                plane_log_sheet_id: $scope.plsId,
                booking_changes: changes.bookingChanges,
                pls_changes: changes.plsChanges,
                training_record_action: changes.trainingRecordAction
            };
            if ($scope.hasBooking) {
                payload.booking_id = bookingId;
            }

            // Remember whether member/instructor changed so the
            // preview step can show/hide training-record information.
            $scope.crewChanged = changes.memberChanged || changes.instructorChanged;

            FlightEditsService.Preview(payload)
                .then(function(data) {
                    $scope.submitting = false;

                    if (!data || !data.success) {
                        ToastService.error('Preview Error', data ? data.message : 'Failed to preview changes');
                        return;
                    }
                    if (data.has_changes === false) {
                        ToastService.warning('No Changes', 'No actual changes detected.');
                        return;
                    }

                    $scope.preview = data;
                    $scope.financial.action = '';
                    $scope.step = 2;
                });
        };

        $scope.backToEdit = function() {
            $scope.step = 1;
            $scope.preview = null;
        };


        // ═══════════════════════════════════════════════
        // STEP 3 — APPLY CHANGES
        // ═══════════════════════════════════════════════
        $scope.applyChanges = function() {
            if ($scope.preview && $scope.preview.financial_impact && $scope.preview.financial_impact.has_impact) {
                if (!$scope.financial.action) {
                    ToastService.warning('Selection Required', 'Please choose how to handle the financial impact.');
                    return;
                }
            }

            $scope.submitting = true;
            var changes = buildChanges();

            var payload = {
                plane_log_sheet_id: $scope.plsId,
                booking_changes: changes.bookingChanges,
                pls_changes: changes.plsChanges,
                financial_action: $scope.financial.action || 'none',
                training_record_action: changes.trainingRecordAction,
                payment_method: null,
                stripe_payment_intent_id: null
            };
            if ($scope.hasBooking) {
                payload.booking_id = bookingId;
            }

            FlightEditsService.Apply(payload)
                .then(function(data) {
                    $scope.submitting = false;

                    if (!data || !data.success) {
                        ToastService.error('Apply Error', data ? data.message : 'Failed to apply changes');
                        return;
                    }

                    $scope.result = data;
                    $scope.step = 3;

                    if ($scope.financial.action === 'immediate_charge' && data.affected_entities) {
                        for (var i = 0; i < data.affected_entities.length; i++) {
                            if (data.affected_entities[i].type === 'admin_adjustment') {
                                $scope.pendingAdjustment = data.affected_entities[i];
                                break;
                            }
                        }
                    }
                });
        };


        // ═══════════════════════════════════════════════
        // WAIVE ADJUSTMENT
        // ═══════════════════════════════════════════════
        $scope.waiveReason = '';
        $scope.showWaiveConfirm = false;

        $scope.toggleWaiveConfirm = function() {
            $scope.showWaiveConfirm = !$scope.showWaiveConfirm;
        };

        $scope.waiveAdjustment = function(adjustmentId) {
            if (!$scope.waiveReason) {
                ToastService.warning('Reason Required', 'Please provide a reason for waiving this adjustment.');
                return;
            }
            $scope.submitting = true;
            FlightEditsService.WaiveAdjustment({
                adjustment_id: adjustmentId,
                reason: $scope.waiveReason
            }).then(function(data) {
                $scope.submitting = false;
                if (data && data.success) {
                    ToastService.success('Adjustment Waived', 'The adjustment has been waived successfully.');
                    $scope.showWaiveConfirm = false;
                } else {
                    ToastService.error('Error', data ? data.message : 'Failed to waive adjustment');
                }
            });
        };


        // ═══════════════════════════════════════════════
        // EDIT HISTORY & AUDIT
        // ═══════════════════════════════════════════════
        $scope.toggleHistory = function() {
            $scope.sections.history = !$scope.sections.history;
        };

        $scope.loadAuditDetail = function(editId) {
            $scope.showAuditDetail = true;
            $scope.auditDetail = null;
            FlightEditsService.GetAuditDetail(editId)
                .then(function(data) {
                    if (data && data.success) {
                        $scope.auditDetail = data;
                    } else {
                        ToastService.error('Error', 'Failed to load audit detail');
                        $scope.showAuditDetail = false;
                    }
                });
        };

        $scope.closeAuditDetail = function() {
            $scope.showAuditDetail = false;
            $scope.auditDetail = null;
        };


        // ═══════════════════════════════════════════════
        // ACCORDION TOGGLES
        // ═══════════════════════════════════════════════
        $scope.toggleSection = function(section) {
            $scope.sections[section] = !$scope.sections[section];
        };


        // ═══════════════════════════════════════════════
        // MODAL ACTIONS
        // ═══════════════════════════════════════════════
        $scope.close = function() {
            if ($scope.step === 3) {
                $uibModalInstance.close($scope.result);
            } else {
                $uibModalInstance.dismiss('cancel');
            }
        };

        $scope.closeAndRefresh = function() {
            $uibModalInstance.close($scope.result);
        };


        // ═══════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════

        // Extract an airfield object from any API response shape
        function extractAirfield(response) {
            if (!response) return null;
            // Shape: { airfield: { id, code, title, ... } }
            if (response.airfield && response.airfield.id) return response.airfield;
            // Shape: { airfields: [ { id, code, title, ... } ] }
            if (response.airfields && response.airfields.length > 0) return response.airfields[0];
            // Shape: { data: { id, code, title, ... } }
            if (response.data && response.data.id) return response.data;
            // Shape: { id, code, title, ... } (direct object)
            if (response.id && (response.code || response.title)) return response;
            // Shape: { success: true, id: ..., code: ..., title: ... }
            if (response.success && response.code) return response;
            return null;
        }

        function buildChanges() {
            // ── Sync time fields from the authoritative selected objects ──
            // ui-select uses scope:true which can cause Angular 1 child-scope
            // shadowing; the controller's $scope.form may be stale for time
            // fields. Re-read from the selected objects right now to guarantee
            // we send the latest user pick to the preview/apply API.
            $scope.form.brakes_off = $scope.selectedBrakesOff ? $scope.selectedBrakesOff.time : ($scope.form.brakes_off || '');
            $scope.form.takeoff_time = $scope.selectedTakeoff ? $scope.selectedTakeoff.time : ($scope.form.takeoff_time || '');
            $scope.form.landing_time = $scope.selectedLanding ? $scope.selectedLanding.time : ($scope.form.landing_time || '');
            $scope.form.brakes_on = $scope.selectedBrakesOn ? $scope.selectedBrakesOn.time : ($scope.form.brakes_on || '');

            var bookingChanges = {};
            var plsChanges = {};
            var booking = ($scope.original && $scope.original.booking) ? $scope.original.booking : {};
            var pls;
            if ($scope.hasBooking) {
                pls = $scope.original.plane_log_sheets && $scope.original.plane_log_sheets[0]
                    ? $scope.original.plane_log_sheets[0] : {};
            } else {
                pls = $scope.original.plane_log_sheet || $scope.original || {};
            }

            // Normalise original PLS time values for comparison (API may
            // return HH:MM:SS while form values are always HH:MM)
            var normalisedPls = {};
            var timeFields = ['brakes_off', 'brakes_on', 'takeoff_time', 'landing_time'];
            timeFields.forEach(function(f) {
                normalisedPls[f] = normaliseTimeHHMM(pls[f]);
            });

            // Booking-level fields (only if there IS a booking)
            if ($scope.hasBooking) {
                // NOTE: lesson_id deliberately excluded — lesson changes must be
                // done via the Training Records section, not flight editing.
                var bookingFields = ['plane_id', 'user_id', 'instructor_id', 'voucher_id', 'maintenance_flight'];
                bookingFields.forEach(function(field) {
                    if (String($scope.form[field] || '') !== String(booking[field] || '')) {
                        bookingChanges[field] = $scope.form[field];
                    }
                });
            }

            // Shared fields
            var sharedFields = ['plane_id', 'user_id', 'instructor_id'];
            sharedFields.forEach(function(field) {
                if (String($scope.form[field] || '') !== String(pls[field] || '')) {
                    plsChanges[field] = $scope.form[field];
                }
            });

            // PLS-only fields
            // When there is no booking, restrict editable fields to times/tacho/date only
            var plsOnlyFields = $scope.hasBooking ? [
                'from_airport_id', 'to_airport_id', 'flight_date',
                'brakes_off', 'brakes_on', 'takeoff_time', 'landing_time',
                'tacho_start', 'tacho_end',
                'landings', 'touch_and_gos', 'night_landings',
                'authorised_solo', 'is_picus',
                'remarks', 'route',
                'pic_id', 'put_id', 'course_id', 'tuition_id'
            ] : [
                'from_airport_id', 'to_airport_id', 'flight_date',
                'brakes_off', 'brakes_on', 'takeoff_time', 'landing_time',
                'tacho_start', 'tacho_end'
            ];
            plsOnlyFields.forEach(function(field) {
                var formVal = $scope.form[field] != null ? $scope.form[field] : '';
                // For time fields, compare against normalised original (HH:MM)
                var plsVal = normalisedPls.hasOwnProperty(field)
                    ? (normalisedPls[field] || '')
                    : (pls[field] != null ? pls[field] : '');
                if (String(formVal) !== String(plsVal)) {
                    plsChanges[field] = $scope.form[field];
                }
            });

            // ── Training record handling ──
            // Determine whether the student or instructor has been changed.
            // If NEITHER changed → do not touch training records at all.
            // If EITHER changed → flag for removal of existing training records
            //   (backend keeps audit trail) and reset debriefed = 0 so the new
            //   instructor/student pair can create a fresh training record.
            var memberChanged = bookingChanges.hasOwnProperty('user_id') || plsChanges.hasOwnProperty('user_id');
            var instructorChanged = bookingChanges.hasOwnProperty('instructor_id') || plsChanges.hasOwnProperty('instructor_id');
            var trainingRecordAction = 'none';   // default: leave training records alone
            if (memberChanged || instructorChanged) {
                trainingRecordAction = 'remove_and_reset';  // remove existing, set debriefed=0
            }

            return {
                bookingChanges: bookingChanges,
                plsChanges: plsChanges,
                trainingRecordAction: trainingRecordAction,
                memberChanged: memberChanged,
                instructorChanged: instructorChanged
            };
        }

        function getCurrencySymbol(currencyCode) {
            var symbols = {
                'GBP': '\u00A3', 'EUR': '\u20AC', 'USD': '$', 'AUD': 'A$', 'NZD': 'NZ$',
                'CAD': 'C$', 'CHF': 'CHF', 'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr',
                'ZAR': 'R', 'INR': '\u20B9', 'JPY': '\u00A5'
            };
            if (!currencyCode) return '\u00A3';  // default to £ if currency not set
            return symbols[currencyCode] || currencyCode + ' ';
        }

        $scope.getPlaneName = function(planeId) {
            if (!planeId) return '\u2014';
            for (var i = 0; i < $scope.availablePlanes.length; i++) {
                if ($scope.availablePlanes[i].id == planeId || $scope.availablePlanes[i].plane_id == planeId) {
                    return $scope.availablePlanes[i].registration;
                }
            }
            return 'Aircraft #' + planeId;
        };

        $scope.getInstructorName = function(instrId) {
            if (!instrId) return 'None';
            for (var i = 0; i < $scope.availableInstructors.length; i++) {
                if ($scope.availableInstructors[i].id == instrId || $scope.availableInstructors[i].user_id == instrId) {
                    return ($scope.availableInstructors[i].first_name || '') + ' ' + ($scope.availableInstructors[i].last_name || '');
                }
            }
            if ($scope.currentInstructor && ($scope.currentInstructor.id == instrId || $scope.currentInstructor.user_id == instrId)) {
                return ($scope.currentInstructor.first_name || '') + ' ' + ($scope.currentInstructor.last_name || '');
            }
            return 'Instructor #' + instrId;
        };

        $scope.getMemberName = function(userId) {
            if (!userId) return '\u2014';
            if ($scope.currentUser && ($scope.currentUser.id == userId)) {
                return ($scope.currentUser.first_name || '') + ' ' + ($scope.currentUser.last_name || '');
            }
            if ($scope.availableMembers) {
                for (var i = 0; i < $scope.availableMembers.length; i++) {
                    if ($scope.availableMembers[i].id == userId) {
                        return ($scope.availableMembers[i].first_name || '') + ' ' + ($scope.availableMembers[i].last_name || '');
                    }
                }
            }
            return 'Member #' + userId;
        };

        $scope.getWarningClass = function(level) {
            switch(level) {
                case 'critical': return 'fe-warning--critical';
                case 'high': return 'fe-warning--high';
                default: return 'fe-warning--info';
            }
        };

        $scope.getWarningIcon = function(level) {
            switch(level) {
                case 'critical': return 'fa-exclamation-circle';
                case 'high': return 'fa-exclamation-triangle';
                default: return 'fa-info-circle';
            }
        };

        $scope.getEntityIcon = function(type) {
            switch(type) {
                case 'booking': return 'fa-calendar';
                case 'plane_log_sheet': return 'fa-file-alt';
                case 'invoice': return 'fa-file-alt';
                case 'payment': return 'fa-credit-card';
                case 'training_record': return 'fa-graduation-cap';
                case 'aircraft_logbook': return 'fa-book';
                case 'admin_adjustment': return 'fa-balance-scale';
                case 'credit_note': return 'fa-sticky-note';
                default: return 'fa-circle';
            }
        };

        $scope.formatAmount = function(amount) {
            if (amount === null || amount === undefined) return '';
            return $scope.currencySymbol + parseFloat(amount).toFixed(2);
        };

        $scope.formatEditType = function(type) {
            if (!type) return '';
            return type.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
        };

        $scope.getEditTypeIcon = function(type) {
            switch(type) {
                case 'minor_update': return 'fa-pencil-alt';
                case 'time_change': return 'fa-clock';
                case 'aircraft_change': return 'fa-plane';
                case 'instructor_change': return 'fa-user';
                case 'student_reassignment': return 'fa-users';
                case 'full_reassignment': return 'fa-sync-alt';
                default: return 'fa-edit';
            }
        };

        $scope.requiresFinancialAction = function() {
            return $scope.preview && $scope.preview.financial_impact &&
                   $scope.preview.financial_impact.has_impact && !$scope.financial.action;
        };

        // Called by radio buttons via ng-click — bypasses ng-model child-scope
        // issues entirely since ng-click resolves the function via the
        // prototype chain and $scope inside is always the controller scope.
        $scope.setFinancialAction = function(action) {
            $scope.financial.action = action;
        };

        // Return affected entities, filtering out training_record entries
        // unless the student/instructor was changed.
        $scope.getVisibleAffectedEntities = function() {
            if (!$scope.preview || !$scope.preview.affected_entities) return [];
            if ($scope.crewChanged) return $scope.preview.affected_entities;
            return $scope.preview.affected_entities.filter(function(e) {
                return e.type !== 'training_record';
            });
        };


        // ═══════════════════════════════════════════════
        // INIT
        // ═══════════════════════════════════════════════
        $scope.loadFlight();
    }