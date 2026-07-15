 app.controller('DashboardClubInstructorBookings', DashboardClubInstructorBookings);

    DashboardClubInstructorBookings.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'InstructorService', 'ToastService', 'AdhocAvailabilityService', 'HolidayService', 'InstructorQualificationsService', '$timeout', '$q', 'BookingPreferencesService'];
    function DashboardClubInstructorBookings(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, InstructorService, ToastService, AdhocAvailabilityService, HolidayService, InstructorQualificationsService, $timeout, $q, BookingPreferencesService) {
        var vm = this;

           //    /* PLEASE DO NOT COPY AND PASTE THIS CODE. */(function(){var w=window,C='___grecaptcha_cfg',cfg=w[C]=w[C]||{},N='grecaptcha';var gr=w[N]=w[N]||{};gr.ready=gr.ready||function(f){(cfg['fns']=cfg['fns']||[]).push(f);};(cfg['render']=cfg['render']||[]).push('explicit');(cfg['onload']=cfg['onload']||[]).push('initRecaptcha');w['__google_recaptcha_client']=true;var d=document,po=d.createElement('script');po.type='text/javascript';po.async=true;po.src='https://www.gstatic.com/recaptcha/releases/JPZ52lNx97aD96bjM7KaA0bo/recaptcha__en.js';var e=d.querySelector('script[nonce]'),n=e&&(e['nonce']||e.getAttribute('nonce'));if(n){po.setAttribute('nonce',n);}var s=d.getElementsByTagName('script')[0];s.parentNode.insertBefore(po, s);})();

           // var initRecaptcha = function () { 
           //     // document.getElementById("SearchModule").scope().vm.parent.isGrecaptchaLoaded = !0, 
           //     // document.getElementById("SearchModule").scope().vm.showRecaptcha();
           //     vm.showRecaptcha();
           // };
              




        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            plane: {
                requirements: {
                    licence: [],
                    medical: [],
                    differences: []
                },
                documents: []
            }
        };

        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        var update_this_file = [];
        
        
        vm.currency_types = ["class", "type"];
        vm.gear_types = ["tricycle", "tailwheel", "monowheel", "floats", "amphibian", "skis"];
        // vm.certificates = ["Certificate of Airworthiness", "National Certificate of Airworthiness", "Permit to Fly"];
        vm.certificates = [{id: 1, title: "Certificate of Airworthiness", value: "cofa"}, {id: 2, title: "National Certificate of Airworthiness", value: "cofa"}, {id: 2, title: "LAA Permit to Fly", value: "ptf"}];
        vm.classes = ["SEP (land)", "SEP (sea)", "SET (land)", "SET (sea)", "MEP (land)", "MEP (sea)", "ME"];

        vm.charge_type = ["airborne", "brakes", "tacho", "hobbs", "flight", "brakes_rounded"];
        vm.surcharge_type = ["none", "flight", "hour"];

        vm.action = $state.current.data.action;
        vm.user = $rootScope.globals.currentUser;

        //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        
        vm.club_id = parseInt($rootScope.globals.currentUser.current_club_admin.id, 10);
        vm.user_id = vm.user.id;




         vm.editing = false;

        // ── Slide-panel state ──────────────────────────────────────
        vm.show_instructor_panel = false;
        vm.selected_instructor   = null;
        vm.loadingAvailability   = false;
        vm.instructor_availability = null;
        vm.savingInstructor      = false;

        // ── Availability editor panel state ────────────────────────
        vm.show_avail_panel      = false;
        vm.availTab              = 'schedule';
        vm.savingAvailSchedule   = false;

        // Ad-hoc dates
        vm.adhocDates            = [];
        vm.adhocSelectedDates    = [];
        vm.adhocCalendarDate     = null;
        vm.adhocNotes            = '';
        vm.loadingAdhocDates     = false;
        vm.addingAdhoc           = false;

        var defaultAdhocFrom = new Date(); defaultAdhocFrom.setHours(8, 0, 0, 0);
        var defaultAdhocTo   = new Date(); defaultAdhocTo.setHours(21, 0, 0, 0);
        vm.adhocFromTime         = angular.copy(defaultAdhocFrom);
        vm.adhocToTime           = angular.copy(defaultAdhocTo);

        vm.adhocDatepickerOptions = { startingDay: 1, minDate: new Date(), showWeeks: false };

        // Ad-hoc edit
        vm.editingAdhocSlot      = null;
        vm.editSlotFrom          = null;
        vm.editSlotTo            = null;
        vm.editSlotNotes         = '';
        vm.savingEditSlot        = false;

        // Holidays
        vm.instrHolidays         = [];
        vm.holidayStart          = null;
        vm.holidayEnd            = null;
        vm.holidayTitle          = '';
        vm.holidayAllDay         = true;
        vm.holidayStartOpen      = false;
        vm.holidayEndOpen        = false;
        vm.addingHoliday         = false;
        vm.holidayDateOptions    = { startingDay: 1 };

        // ── Booking preferences state ────────────────────────────
        vm.bookingPrefs          = null;
        vm.bookingPrefsModes     = [];
        vm.loadingBookingPrefs   = false;
        vm.savingBookingMode     = false;
        vm.savingExpMode         = false;
        vm.bpSavedBooking        = false;
        vm.bpSavedExperience     = false;

        // ── Qualifications state ────────────────────────────────
        vm.show_qual_panel       = false;
        vm.qualTab               = 'courses';
        vm.loadingQualMatrix     = false;
        vm.loadingQualifications = false;
        vm.instrQualOverview     = null;

        // Matrix data (rows = instructors with nested qual arrays, columns = items)
        vm.qualCourseRows        = [];
        vm.qualCourseColumns     = [];
        vm.qualTuitionRows       = [];
        vm.qualTuitionColumns    = [];
        vm.qualExpRows           = [];
        vm.qualExpColumns        = [];

        // Debounce timers per instructor
        var qualSaveTimers       = {};

        var holFromDefault = new Date(); holFromDefault.setHours(8, 0, 0, 0);
        var holToDefault   = new Date(); holToDefault.setHours(18, 0, 0, 0);
        vm.holidayFromTime       = angular.copy(holFromDefault);
        vm.holidayToTime         = angular.copy(holToDefault);

        vm.avail_days = [
            { day: 'Monday',    short: 'Mon', from_variable: 'monday_from_time',    to_variable: 'monday_to_time',    disabled_variable: 'monday_disabled' },
            { day: 'Tuesday',   short: 'Tue', from_variable: 'tuesday_from_time',   to_variable: 'tuesday_to_time',   disabled_variable: 'tuesday_disabled' },
            { day: 'Wednesday', short: 'Wed', from_variable: 'wednesday_from_time', to_variable: 'wednesday_to_time', disabled_variable: 'wednesday_disabled' },
            { day: 'Thursday',  short: 'Thu', from_variable: 'thursday_from_time',  to_variable: 'thursday_to_time',  disabled_variable: 'thursday_disabled' },
            { day: 'Friday',    short: 'Fri', from_variable: 'friday_from_time',    to_variable: 'friday_to_time',    disabled_variable: 'friday_disabled' },
            { day: 'Saturday',  short: 'Sat', from_variable: 'saturday_from_time',  to_variable: 'saturday_to_time',  disabled_variable: 'saturday_disabled' },
            { day: 'Sunday',    short: 'Sun', from_variable: 'sunday_from_time',    to_variable: 'sunday_to_time',    disabled_variable: 'sunday_disabled' }
        ];
        
        switch(vm.action){
           


            // break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                //console.log("hey");
                vm.instructors_loading = true;
                InstructorService.GetAllByClub(vm.club_id, vm.user_id)
                    .then(function(data){
                        vm.instructors_loading = false;
                        vm.club.instructors = data.instructors;
                        // Initialise boolean toggles for email preferences
                        for (var i = 0; i < vm.club.instructors.length; i++) {
                            var inst = vm.club.instructors[i];
                            inst._receiveNotifications = (inst.mute_booking_emails == 0);
                            inst._receiveReminders     = (inst.mute_booking_reminders == 0);
                            inst._receiveDailySummary  = (inst.instructor_daily_summary == 1);
                            // Default availability mode badge (may be overridden when panel opens)
                            inst._availabilityMode     = inst.availability_mode || 'regular';
                            // Init daily limit display value
                            inst._maxExperienceFlights = parseInt(inst.max_experience_flights_per_day, 10) || 0;
                        }
                        vm.edit_instructor();

                        // Load booking preferences for all instructors (for card badges)
                        BookingPreferencesService.GetClubPreferences(vm.club_id)
                            .then(function(bpData) {
                                if (bpData && bpData.success !== false && bpData.instructors) {
                                    // Cache the modes list
                                    if (bpData.available_modes && bpData.available_modes.length) {
                                        vm.bookingPrefsModes = bpData.available_modes;
                                    }
                                    // Map preferences onto instructor cards
                                    for (var j = 0; j < bpData.instructors.length; j++) {
                                        var bp = bpData.instructors[j];
                                        for (var k = 0; k < vm.club.instructors.length; k++) {
                                            if (parseInt(vm.club.instructors[k].user_id, 10) === parseInt(bp.user_id, 10)) {
                                                vm.club.instructors[k]._bookingMode    = bp.booking_mode || 'open';
                                                vm.club.instructors[k]._expBookingMode = bp.experience_booking_mode || 'open';
                                                break;
                                            }
                                        }
                                    }
                                }
                            });
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  

        //'9' needs to refer the the user's account set to manage
       
        $scope.back = function(){
            $rootScope.safeBack();
        }

        function rgbaToHex (rgba) {
          var inParts = rgba.substring(rgba.indexOf("(")).split(","),
              r = parseInt(trim(inParts[0].substring(1)), 10),
              g = parseInt(trim(inParts[1]), 10),
              b = parseInt(trim(inParts[2]), 10);
             // a = parseFloat(trim(inParts[3].substring(0, inParts[3].length - 1))).toFixed(2);
          var outParts = [
            r.toString(16),
            g.toString(16),
            b.toString(16)
            //,Math.round(a * 255).toString(16).substring(0, 2)
          ];

          // Pad single-digit output values
          outParts.forEach(function (part, i) {
            if (part.length === 1) {
              outParts[i] = '0' + part;
            }
          })

          return ('#' + outParts.join(''));
        }

        function trim (str) {
          return str.replace(/^\s+|\s+$/gm,'');
        }
        function hexToRGBA(hex, opacity=1) {  
            let r = parseInt(hex.substring(1,3), 16);  
            let g = parseInt(hex.substring(3,5), 16);  
            let b = parseInt(hex.substring(5), 16);  
            var rtn = "rgba("+r+", "+g+", "+b+", "+opacity+")";
            return rtn;
        }

        // Parse ISO time strings ("09:00") into Date objects for date:'HH:mm' filter
        function normaliseAvailTimes(rec) {
            var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            dayNames.forEach(function(d) {
                var fk = d + '_from_time';
                var tk = d + '_to_time';
                var dk = d + '_disabled';
                rec[fk] = parseTimeString(rec[fk]);
                rec[tk] = parseTimeString(rec[tk]);
                rec[dk] = parseInt(rec[dk]) || 0;
            });
        }
        function parseTimeString(val) {
            if (!val || val === '0') {
                var d = new Date(); d.setHours(0, 0, 0, 0); return d;
            }
            if (val instanceof Date) return val;
            if (typeof val === 'string') {
                var parts = val.split(':');
                var dt = new Date();
                dt.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
                return dt;
            }
            return new Date(val);
        }

        vm.save_instructor = function(instructor){

            console.log(instructor.new_colour);

            if(instructor.new_colour && instructor.new_colour !== ""){
                instructor.instructor_colour = hexToRGBA(instructor.new_colour, 1);
                delete(instructor.new_colour);
            }
            console.log(instructor.new_booking_colour);

            if(instructor.new_booking_colour && instructor.new_booking_colour !== ""){
                instructor.booking_colour = hexToRGBA(instructor.new_booking_colour, 1);
                delete(instructor.new_booking_colour);
            }

            console.log("SAVE THIS : ", instructor);

            instructor.edit = false;

            delete(instructor.edit);

            InstructorService.UpdateInstructor(instructor, vm.club_id)
                .then(function(data){
                    //console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });


        }

        vm.edit_instructor = function(){
            
            for(var i=0; i < vm.club.instructors.length;i++){
                if(vm.club.instructors[i].instructor_colour && vm.club.instructors[i].instructor_colour !== ""){
                    vm.club.instructors[i].new_colour = rgbaToHex(vm.club.instructors[i].instructor_colour);
                }

                if(vm.club.instructors[i].booking_colour && vm.club.instructors[i].booking_colour !== ""){
                    vm.club.instructors[i].new_booking_colour = rgbaToHex(vm.club.instructors[i].booking_colour);
                }
            }
        }

        // ---- Email preference toggles ----
        vm.save_email_prefs = function(instructor) {
            var update = {
                id: instructor.id,
                mute_booking_emails:    instructor._receiveNotifications ? 0 : 1,
                mute_booking_reminders: instructor._receiveReminders    ? 0 : 1,
                instructor_daily_summary: instructor._receiveDailySummary ? 1 : 0
            };

            InstructorService.UpdateInstructor(update, vm.club_id)
                .then(function(data) {
                    if (data && data.success) {
                        // Sync the raw values back onto the local object
                        instructor.mute_booking_emails    = update.mute_booking_emails;
                        instructor.mute_booking_reminders = update.mute_booking_reminders;
                        instructor.instructor_daily_summary = update.instructor_daily_summary;
                        ToastService.success('Saved', 'Email preferences updated.');
                    } else {
                        // Revert toggles on failure
                        instructor._receiveNotifications = (instructor.mute_booking_emails == 0);
                        instructor._receiveReminders     = (instructor.mute_booking_reminders == 0);
                        instructor._receiveDailySummary  = (instructor.instructor_daily_summary == 1);
                        ToastService.error('Error', 'Could not save email preferences.');
                    }
                });
        };

        // ── Slide-panel methods ──────────────────────────────────────

        vm.openPanel = function(instructor) {
            vm.selected_instructor = instructor;
            vm.show_instructor_panel = true;
            vm.instructor_availability = null;
            vm.loadingAvailability = true;

            // Load qualifications overview for this instructor
            vm.loadInstructorQualOverview(instructor.user_id);

            // Load booking preferences for this instructor
            vm.loadBookingPreferences(instructor.user_id);

            // Ensure colour hex values are initialised for the pickers
            if (instructor.instructor_colour && !instructor.new_colour) {
                instructor.new_colour = rgbaToHex(instructor.instructor_colour);
            }
            if (instructor.booking_colour && !instructor.new_booking_colour) {
                instructor.new_booking_colour = rgbaToHex(instructor.booking_colour);
            }

            // Init daily-limit field (from backend or default to 0)
            if (typeof instructor._maxExperienceFlights === 'undefined') {
                instructor._maxExperienceFlights = parseInt(instructor.max_experience_flights_per_day, 10) || 0;
            }

            // Load availability for this club (use user_id + club_id)
            InstructorService.GetAvailability(instructor.user_id, vm.club_id)
                .then(function(data) {
                    vm.loadingAvailability = false;
                    // Single-club endpoint returns an object, not an array
                    var match = null;
                    if (data && !Array.isArray(data) && data.club_id) {
                        match = data;
                    } else if (data && Array.isArray(data)) {
                        // Fallback: array response — find matching club
                        for (var i = 0; i < data.length; i++) {
                            if (data[i] && parseInt(data[i].club_id, 10) === vm.club_id) {
                                match = data[i];
                                break;
                            }
                        }
                    }
                    if (!match) {
                        // Don't overwrite if the avail panel already created a blank record
                        if (!vm.instructor_availability) {
                            vm.instructor_availability = null;
                        }
                        return;
                    }
                    if (!match.availability_mode) {
                        match.availability_mode = 'regular';
                    }
                    // Normalise time strings into Date objects for display
                    normaliseAvailTimes(match);
                    vm.instructor_availability = match;
                    // Update the badge on the card
                    instructor._availabilityMode = match.availability_mode;
                })
                .catch(function() {
                    vm.loadingAvailability = false;
                    vm.instructor_availability = null;
                });
        };

        vm.closePanel = function() {
            vm.show_avail_panel = false;
            vm.show_instructor_panel = false;
        };

        // Close panel on Escape key (avail panel first, then instructor panel)
        var panelEscHandler = function(e) {
            if (e.keyCode === 27) {
                $scope.$apply(function() {
                    if (vm.editingAdhocSlot) {
                        vm.cancelEditSlot();
                    } else if (vm.show_avail_panel) {
                        vm.closeAvailPanel();
                    } else if (vm.show_instructor_panel) {
                        vm.closePanel();
                    }
                });
            }
        };
        document.addEventListener('keydown', panelEscHandler);
        $scope.$on('$destroy', function() {
            document.removeEventListener('keydown', panelEscHandler);
        });

        vm.saveAndClose = function() {
            if (!vm.selected_instructor) return;
            vm.savingInstructor = true;

            var instructor = vm.selected_instructor;

            // Apply colour changes
            if (instructor.new_colour && instructor.new_colour !== '') {
                instructor.instructor_colour = hexToRGBA(instructor.new_colour, 1);
            }
            if (instructor.new_booking_colour && instructor.new_booking_colour !== '') {
                instructor.booking_colour = hexToRGBA(instructor.new_booking_colour, 1);
            }

            // Build update payload
            var payload = {
                id:                          instructor.id,
                instructor_colour:           instructor.instructor_colour,
                booking_colour:              instructor.booking_colour,
                instructor_notes:            instructor.instructor_notes || '',
                max_experience_flights_per_day: instructor._maxExperienceFlights || 0
            };

            InstructorService.UpdateInstructor(payload, vm.club_id)
                .then(function(data) {
                    vm.savingInstructor = false;
                    if (data && data.success !== false) {
                        ToastService.success('Saved', instructor.first_name + '\'s settings updated.');
                        vm.show_instructor_panel = false;
                    } else {
                        ToastService.error('Error', 'Could not save instructor settings.');
                    }
                })
                .catch(function() {
                    vm.savingInstructor = false;
                    ToastService.error('Error', 'Could not save instructor settings.');
                });
        };

        // ══════════════════════════════════════════════════════════
        //  AVAILABILITY EDITOR PANEL
        // ══════════════════════════════════════════════════════════

        vm.openAvailPanel = function() {
            if (!vm.instructor_availability) {
                // Build a blank record for this club + user
                vm.instructor_availability = buildBlankAvailability(vm.club_id, vm.selected_instructor.user_id);
                normaliseAvailTimesForEditor(vm.instructor_availability);
            }
            vm.availTab = 'schedule';
            vm.show_avail_panel = true;
            // Reset ad-hoc form
            vm.adhocSelectedDates = [];
            vm.adhocCalendarDate  = null;
            vm.adhocNotes         = '';
            vm.adhocFromTime      = angular.copy(defaultAdhocFrom);
            vm.adhocToTime        = angular.copy(defaultAdhocTo);
            // Load ad-hoc dates & holidays
            loadInstructorAdhocDates();
            loadInstructorHolidays();
        };

        vm.closeAvailPanel = function() {
            vm.show_avail_panel = false;
            vm.editingAdhocSlot = null;
        };

        // ── Weekly schedule ──────────────────────────────────────

        vm.toggleAvailDay = function(disabledVar) {
            vm.instructor_availability[disabledVar] = vm.instructor_availability[disabledVar] ? 0 : 1;
        };

        vm.setAvailMode = function(mode) {
            if (vm.instructor_availability.availability_mode === mode) return;
            vm.instructor_availability.availability_mode = mode;
            saveAvailToBackend(function() {
                ToastService.success('Mode Updated', 'Switched to ' + (mode === 'adhoc' ? 'ad-hoc' : 'regular') + ' scheduling.');
                // Update badge on card
                vm.selected_instructor._availabilityMode = mode;
                if (mode === 'adhoc') {
                    vm.availTab = 'extra';
                }
            });
        };

        vm.saveAvailSchedule = function() {
            vm.savingAvailSchedule = true;
            saveAvailToBackend(function() {
                vm.savingAvailSchedule = false;
                ToastService.success('Schedule Saved', 'Weekly availability updated for this club.');
            });
        };

        function saveAvailToBackend(callback) {
            var rec = vm.instructor_availability;
            // Always ensure user_id and club_id are correct
            rec.user_id = vm.selected_instructor.user_id;
            rec.club_id = vm.club_id;

            // Build a clean payload — convert Date objects to HH:MM time strings
            var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            var payload = {
                user_id:           rec.user_id,
                club_id:           rec.club_id,
                availability_mode: rec.availability_mode
            };
            dayNames.forEach(function(d) {
                var fk = d + '_from_time';
                var tk = d + '_to_time';
                var dk = d + '_disabled';
                payload[fk] = dateToTimeStr(rec[fk]);
                payload[tk] = dateToTimeStr(rec[tk]);
                payload[dk] = rec[dk];
            });

            InstructorService.SetAvailability(payload)
                .then(function(data) {
                    if (callback) callback();
                });
        }

        function dateToTimeStr(val) {
            if (!val) return '00:00';
            if (val instanceof Date) {
                return padAvailTime(val.getHours()) + ':' + padAvailTime(val.getMinutes());
            }
            // Already a string — return as-is
            return String(val);
        }

        // ── Ad-hoc dates ─────────────────────────────────────────

        vm.onAdhocCalendarSelect = function() {
            if (!vm.adhocCalendarDate) return;
            var dateStr = formatAvailDate(vm.adhocCalendarDate);
            var exists = vm.adhocSelectedDates.some(function(d) {
                return formatAvailDate(d) === dateStr;
            });
            if (!exists) {
                vm.adhocSelectedDates.push(new Date(vm.adhocCalendarDate));
            }
            vm.adhocCalendarDate = null;
        };

        vm.removeAdhocDate = function(idx) {
            vm.adhocSelectedDates.splice(idx, 1);
        };

        vm.addAdhocDates = function() {
            if (!vm.adhocSelectedDates.length) return;

            var dates = vm.adhocSelectedDates.map(function(d) { return formatAvailDate(d); });
            var fromStr = padAvailTime(vm.adhocFromTime.getHours()) + ':' + padAvailTime(vm.adhocFromTime.getMinutes());
            var toStr   = padAvailTime(vm.adhocToTime.getHours()) + ':' + padAvailTime(vm.adhocToTime.getMinutes());

            if (fromStr >= toStr) {
                ToastService.error('Invalid Times', '"From" must be before "To".');
                return;
            }

            var payload = {
                user_id:   vm.selected_instructor.user_id,
                club_id:   vm.club_id,
                dates:     dates,
                from_time: fromStr,
                to_time:   toStr,
                notes:     vm.adhocNotes || null
            };
            if (dates.length === 1) {
                payload.available_date = dates[0];
                delete payload.dates;
            }

            vm.addingAdhoc = true;
            AdhocAvailabilityService.Create(payload)
                .then(function(resp) {
                    vm.addingAdhoc = false;
                    if (resp && resp.success === false) {
                        ToastService.error('Error', resp.message || 'Failed to add dates.');
                        return;
                    }
                    var added   = (resp && resp.added)   ? resp.added.length   : 0;
                    var skipped = (resp && resp.skipped) ? resp.skipped.length : 0;
                    var msg = added + ' date' + (added !== 1 ? 's' : '') + ' added';
                    if (skipped) msg += ', ' + skipped + ' skipped (overlap)';
                    ToastService.success('Dates Added', msg);
                    vm.adhocSelectedDates = [];
                    vm.adhocNotes = '';
                    loadInstructorAdhocDates();
                });
        };

        vm.editAdhocSlot = function(slot) {
            vm.editingAdhocSlot = slot;
            vm.editSlotFrom  = parseAvailTimeStr(slot.from_time);
            vm.editSlotTo    = parseAvailTimeStr(slot.to_time);
            vm.editSlotNotes = slot.notes || '';
        };

        vm.cancelEditSlot = function() {
            vm.editingAdhocSlot = null;
        };

        vm.saveEditSlot = function() {
            if (!vm.editingAdhocSlot) return;
            var fromStr = padAvailTime(vm.editSlotFrom.getHours()) + ':' + padAvailTime(vm.editSlotFrom.getMinutes());
            var toStr   = padAvailTime(vm.editSlotTo.getHours()) + ':' + padAvailTime(vm.editSlotTo.getMinutes());
            if (fromStr >= toStr) {
                ToastService.error('Invalid Times', '"From" must be before "To".');
                return;
            }
            vm.savingEditSlot = true;
            AdhocAvailabilityService.Update(vm.editingAdhocSlot.id, {
                from_time: fromStr, to_time: toStr, notes: vm.editSlotNotes || null
            }).then(function() {
                vm.savingEditSlot = false;
                vm.editingAdhocSlot = null;
                ToastService.success('Updated', 'Availability slot updated.');
                loadInstructorAdhocDates();
            });
        };

        vm.deleteAdhocSlot = function(slot) {
            if (!confirm('Remove availability on ' + slot.available_date + '?')) return;
            AdhocAvailabilityService.Delete(slot.id)
                .then(function() {
                    ToastService.success('Removed', 'Slot deleted.');
                    loadInstructorAdhocDates();
                });
        };

        function loadInstructorAdhocDates() {
            if (!vm.selected_instructor) return;
            vm.loadingAdhocDates = true;
            AdhocAvailabilityService.GetAll(vm.selected_instructor.user_id)
                .then(function(data) {
                    vm.loadingAdhocDates = false;
                    if (Array.isArray(data)) {
                        vm.adhocDates = data.filter(function(d) {
                            return parseInt(d.club_id, 10) === vm.club_id;
                        });
                    } else {
                        vm.adhocDates = [];
                    }
                });
        }

        // ── Holidays ────────────────────────────────────────────

        vm.addHoliday = function() {
            if (!vm.holidayStart || !vm.holidayEnd) {
                ToastService.error('Missing Dates', 'Please select start and end dates.');
                return;
            }
            var startDate = new Date(vm.holidayStart);
            var endDate   = new Date(vm.holidayEnd);
            if (!vm.holidayAllDay && vm.holidayFromTime && vm.holidayToTime) {
                startDate.setHours(vm.holidayFromTime.getHours(), vm.holidayFromTime.getMinutes(), 0, 0);
                endDate.setHours(vm.holidayToTime.getHours(), vm.holidayToTime.getMinutes(), 0, 0);
            }
            var newHoliday = {
                title:  vm.holidayTitle || 'Holiday',
                start:  startDate,
                end:    endDate,
                allDay: vm.holidayAllDay
            };
            vm.addingHoliday = true;
            HolidayService.Create(vm.selected_instructor.user_id, newHoliday)
                .then(function() {
                    vm.addingHoliday = false;
                    ToastService.success('Holiday Added', 'Time off booked.');
                    vm.holidayStart = null;
                    vm.holidayEnd   = null;
                    vm.holidayTitle = '';
                    vm.holidayAllDay = true;
                    loadInstructorHolidays();
                });
        };

        vm.deleteHoliday = function(hol, idx) {
            if (!confirm('Remove this holiday?')) return;
            HolidayService.Delete(vm.selected_instructor.user_id, hol.id)
                .then(function() {
                    vm.instrHolidays.splice(idx, 1);
                    ToastService.success('Removed', 'Holiday deleted.');
                });
        };

        function loadInstructorHolidays() {
            if (!vm.selected_instructor) return;
            HolidayService.GetAll(vm.selected_instructor.user_id)
                .then(function(data) {
                    if (!data || !Array.isArray(data)) {
                        vm.instrHolidays = [];
                        return;
                    }
                    vm.instrHolidays = data.map(function(h) {
                        return {
                            id:     h.id,
                            title:  h.title,
                            start:  new Date(h.from_date),
                            end:    new Date(h.to_date),
                            allDay: h.allDay
                        };
                    });
                });
        }

        // ── Availability helpers ─────────────────────────────────

        function buildBlankAvailability(clubId, userId) {
            return {
                club_id:            clubId,
                user_id:            userId,
                availability_mode:  'regular',
                monday_from_time:   '0', monday_to_time:   '0', monday_disabled:    0,
                tuesday_from_time:  '0', tuesday_to_time:  '0', tuesday_disabled:   0,
                wednesday_from_time:'0', wednesday_to_time:'0', wednesday_disabled: 0,
                thursday_from_time: '0', thursday_to_time: '0', thursday_disabled:  0,
                friday_from_time:   '0', friday_to_time:   '0', friday_disabled:    0,
                saturday_from_time: '0', saturday_to_time: '0', saturday_disabled:  0,
                sunday_from_time:   '0', sunday_to_time:   '0', sunday_disabled:    0
            };
        }

        function normaliseAvailTimesForEditor(rec) {
            var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            var fromDefault = new Date(); fromDefault.setHours(9, 0, 0, 0);
            var toDefault   = new Date(); toDefault.setHours(18, 0, 0, 0);
            dayNames.forEach(function(d) {
                var fk = d + '_from_time';
                var tk = d + '_to_time';
                var dk = d + '_disabled';
                if (rec[fk] === rec[tk]) {
                    rec[fk] = angular.copy(fromDefault);
                    rec[tk] = angular.copy(toDefault);
                } else {
                    rec[fk] = parseTimeString(rec[fk]);
                    rec[tk] = parseTimeString(rec[tk]);
                }
                rec[dk] = parseInt(rec[dk]) || 0;
            });
        }

        function formatAvailDate(d) {
            var yyyy = d.getFullYear();
            var mm   = padAvailTime(d.getMonth() + 1);
            var dd   = padAvailTime(d.getDate());
            return yyyy + '-' + mm + '-' + dd;
        }

        function padAvailTime(n) {
            return n < 10 ? '0' + n : '' + n;
        }

        function parseAvailTimeStr(str) {
            if (!str) return new Date();
            var parts = str.split(':');
            var d = new Date();
            d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
            return d;
        }

        $scope.save_instructor_order = function(){
            // //console.log("hiya");
            var update_order = [];
            for(var i=0; i < vm.club.instructors.length;i++){
                var me = {
                    id: vm.club.instructors[i].id,
                    display_order: i
                }
                update_order.push(me);
            }
            // //console.log("organised: ", update_order);



            InstructorService.UpdateOrder({"order": update_order}, vm.club_id)
                .then(function(data){
                    console.log(data);

                    // vm.items = data.items;
                    //$state.go('dashboard.manage_club.edit_lesson', {course_id: vm.club.lesson.course_id, lesson_id: data.id, reload: true});

                });

        }


        $scope.set_aircraft_details = function(){

            // console.log("get deeeets", vm.plane_search);

            PlaneService.GetAddAircraft(vm.plane_search.registration)
                .then(function (data) {
                    ////console.log(data);

                    // console.log(data);
                                // return false;

                    if(data){
                        //use GB airfields first...
                       
                         if(data.length == 0){
                            //console.log("SETTINGS HERE");
                                // vm.plane_search = 
                                //     {
                                //         id: 0,
                                //         registation: vm.plane_search.registration,
                                //         icao_type: "not known"
                                //     };

                                // vm.club.plane.manufacturer = vm.plane_search.manufacturer;      

                        } else {

                                vm.plane_search = data;
                                // console.log("SUCCESS FOUND", data);
                                processNewAircraft();
                        }


                        //console.log("PLANE SEARCHED", vm.plane_search);

                    } else {


                        console.log("WOOOPSIES... this aircraft isn't in our database?");
                        //this should be very very rare...

                         // vm.plane_search = 
                         //            {
                         //                registation: vm.plane_search.registration,
                         //                icao_type: "not known"
                         //            };
                                    // vm.club.plane.manufacturer = vm.plane_search.manufacturer;                        

                    }

                });


        }

        function processNewAircraft(){


            //vm.club.plane 

            //TYPES -->>>

              //aircraft_class --> FIXED-WING LANDPLANE
                  //is_propeller = 1
                  //number_of_engines  --> 1 = SEP
                                    // --> >1 = MEP

                  //is_propeller = 0
                  //number_of_engines  --> 1 = SET
                                    // --> >1 = ME


            vm.club.plane.manufacturer = vm.plane_search.manufacturer;                        
            vm.club.plane.serial_no = vm.plane_search.serial_number;                        
            vm.club.plane.plane_type = vm.plane_search.icao_type;                        
            vm.club.plane.type_name = vm.plane_search.type_name;                        
            vm.club.plane.year_built = vm.plane_search.year_built;                        
            vm.club.plane.aircraft_id = vm.plane_search.id;       
            vm.club.plane.mtow = parseInt(vm.plane_search.mtow);
            vm.club.plane.airframe_hours = vm.plane_search.airframe_hours;          


            // alert(vm.plane_search.gear_type);

            if(vm.plane_search.noise_level){

                var regex = /[+-]?\d+(\.\d+)?/g;

                vm.plane_noise.noise_level = vm.plane_search.noise_level.match(regex).map(function(v) { return parseFloat(v); });
                ////console.log(floats);

            }
            // vm.club.plane.noise_level = vm.plane_search.noise_level;//parseInt(vm.plane_search.noise_level);                 
            


            vm.plane_noise.noise_cert_issue = (vm.plane_search.noise_cert_issue)? new Date(vm.plane_search.noise_cert_issue) : "";                 

            if(vm.plane_search.aircraft_class.indexOf("FIXED-WING") > -1){

                if(vm.plane_search.is_propeller > 0 && vm.plane_search.engine_name.indexOf("PT6A-") == -1){

                    vm.club.plane.plane_class = (vm.club.plane.number_of_engines > 1) ? "MEP" : "SEP";

                } else {

                    vm.club.plane.plane_class = (vm.club.plane.number_of_engines > 1) ? "ME" : "SET";

                }

                if(vm.plane_search.aircraft_class.indexOf("LANDPLANE") > -1){
                    vm.club.plane.plane_class = vm.club.plane.plane_class + " (land)";
                    vm.club.plane.gear_type = "";
                }

                if(vm.plane_search.aircraft_class.indexOf("AMPHIBIAN") > -1 || vm.plane_search.aircraft_class.indexOf("FLOAT") > -1){
                    vm.club.plane.plane_class = vm.club.plane.plane_class + " (sea)";
                    vm.club.plane.gear_type = (vm.plane_search.aircraft_class.indexOf("AMPHIBIAN") > -1)? "amphibian" : "floats";
                }



            }        



            vm.club.plane.seats = (parseInt(vm.plane_search.seats) + 1);


            //Certificate of Airworthiness ==> National CofA
            //Permit to Fly ==> LAA permit
            //EASA Certificate of Airworthiness ==> EASA CofA
            vm.plane_maintenance.cofa_category =  (vm.plane_search.cofa_category.indexOf("cofa") > -1)? "Certificate of Airworthiness" : "Permit to Fly";//(vm.plane_search.cofa_category.indexOf("EASA") > -1)? "EASA Certificate of Airworthiness" : ((vm.plane_search.cofa_category.indexOf("Certificate of Airworthiness") > -1)? "National Certificate of Airworthiness" : "Permit to Fly");
            vm.plane_maintenance.certificate_expiry = new Date(vm.plane_search.cofa_expiry);
            
            vm.club.plane.cofa_category = vm.plane_maintenance.cofa_category;//(vm.plane_search.cofa_category.indexOf("EASA") > -1)? "easa_cofa" : ((vm.plane_search.cofa_category.indexOf("Certificate of Airworthiness") > -1)? "n_cofa" : "permit")

            vm.club.plane.gear_type = vm.plane_search.gear_type;



            //ENGINES AND PROPS!!!
            vm.plane_engine_1.make = vm.plane_search.engine_name;                        
            vm.plane_engine_1.model = vm.plane_search.engine_name;                     

            vm.plane_propeller_1.make = vm.plane_search.propeller_manufacturer;                        
            vm.plane_propeller_1.model = vm.plane_search.propeller_name;                        

            if(vm.plane_search.number_of_engines > 1){
                
                vm.number_of_engine = vm.plane_search.number_of_engines;

                vm.plane_engine_2.make = vm.plane_search.engine_name;                        
                vm.plane_engine_2.model = vm.plane_search.engine_name;
                
                vm.plane_propeller_2.make = vm.plane_search.propeller_manufacturer;                        
                vm.plane_propeller_2.model = vm.plane_search.propeller_name; 
            }   

        }


        $scope.save = function(){
            if(vm.action == "add"){
                //console.log("CREATE click");
                $scope.create();
            } else {
                //console.log("EDIT click");
                //console.log(vm.club.plane);
                $scope.update();
            }
        }



        vm.round_brake_times_start = function(input, earlier_input=null){
            
                if(input){
                  if(input.indexOf(":") > -1){
                    var split = input.split(":");
                    var x = split[1];



                    var min_nearest_five = ((x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5);
                    


                    if(min_nearest_five < 10){
                      min_nearest_five = "0"+min_nearest_five;
                    } else if(min_nearest_five == 60){
                      split[0]++;
                      min_nearest_five = "00";
                    } else if(min_nearest_five > 60){
                      split[0]++;
                      min_nearest_five = (min_nearest_five - 60);
                    }


                    if(earlier_input && earlier_input.indexOf(":") > -1){
                            // console.log("total calculated?");
                            // console.log("earlier_input: ", earlier_input);
                            // console.log("input: ", input);
                            var esplit = earlier_input.split(":");
                            var ehour = esplit[0];
                            var emin = esplit[1];
                            var etot = (parseInt(ehour)*60) + parseInt(emin); 
                            // console.log("etot: ", etot);
                            var hr = split[0];
                            var mn = min_nearest_five;
                            var tot = (parseInt(hr)*60) + parseInt(mn);
                            // console.log("tot: ", tot);

                            if(etot < tot){
                                //the earlier time is after the end time
                                // console.log("etot < tot");
                                min_nearest_five = parseInt(min_nearest_five) - 5;
                                if(min_nearest_five == 60){
                                    split[0]++; 
                                    min_nearest_five = "00";
                                } else if(min_nearest_five > 60){
                                    split[0]++;
                                    min_nearest_five = (min_nearest_five - 60);
                                    if(min_nearest_five < 10 ){
                                      min_nearest_five = "0"+min_nearest_five;
                                    }
                                } else if(min_nearest_five < 0){
                                    split[0]--;
                                    min_nearest_five = (60 + parseInt(min_nearest_five));
                                }
                                // console.log("split: ", split[0]);
                                // console.log("min_nearest_five: ", min_nearest_five);
                            }

                    }
                    //essentially we add 5 in case something happens over the limit

                    return split[0] + ":" + min_nearest_five;
                  } else {
                    return input;
                  }
                } else {
                  return '';
                }
          

          }


        $scope.create = function(){
            ////console.log("CREATE ME NOW");
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;
            vm.club.plane.registration = vm.plane_search.registration;

            vm.club.maintenance_type = vm.plane_maintenance.cofa_category.value;

            console.log("vm.plane_maintenance.cofa_category ", vm.club.maintenance_type );
            return false;
            vm.plane_maintenance.file = vm.files.cert[0];
            vm.plane_radio.file = vm.files.radio[0];
            vm.plane_noise.file = vm.files.noise[0];
            vm.plane_insurance.file = vm.files.insurance[0];

            vm.club.plane.maintenance = vm.plane_maintenance;
            vm.club.plane.insurance = vm.plane_insurance;
            vm.club.plane.noise_cert = vm.plane_noise;
            vm.club.plane.radio_licence= vm.plane_radio;

            vm.club.plane.vp = (vm.club.plane.vp)? 1:0;
            vm.club.plane.rg = (vm.club.plane.rg)? 1:0; 
            vm.club.plane.tb = (vm.club.plane.tb)? 1:0; 

            vm.club.plane.engine_1 = vm.plane_engine_1;
            vm.club.plane.engine_2 = vm.plane_engine_2;
            vm.club.plane.propeller_1 = vm.plane_propeller_1;
            vm.club.plane.propeller_2 = vm.plane_propeller_2;


            if(vm.club.plane.colour && vm.club.plane.colour !== "" && vm.club.plane.colour.indexOf("rgba") == -1){
                vm.club.plane.colour = hexToRGBA(vm.club.plane.colour, 0.75);
            } 

            if(vm.club.plane.bg_colour && vm.club.plane.bg_colour !== "" && vm.club.plane.bg_colour.indexOf("rgba") == -1){
                vm.club.plane.bg_colour = hexToRGBA(vm.club.plane.bg_colour, 0.25);
            } 


            //return false;
            //console.log("PLANE TO ADD, ", vm.club.plane);
            //return false;
            PlaneService.Create(vm.club.plane)
                .then(function(data){
                    ////console.log(data);
                    $state.go('dashboard.manage_club.planes', {reload: true});

                });
        }

        $scope.delete = function(){
            //console.log("CLICK");
            ToastService.warning('Confirm Delete', 'Are you sure you would like to delete this plane?');
            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    //console.log(data);
                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                //console.log("looking for : ", id);
                //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            //console.log("CLICK");
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;

            vm.club.plane.update_documents = get_update_docs();
            //get_update_docs();

            if(vm.club.plane.colour && vm.club.plane.colour !== "" && vm.club.plane.colour.indexOf("rgba") == -1){
                vm.club.plane.colour = hexToRGBA(vm.club.plane.colour, 0.75);
            } 

            if(vm.club.plane.bg_colour && vm.club.plane.bg_colour !== "" && vm.club.plane.bg_colour.indexOf("rgba") == -1){
                vm.club.plane.bg_colour = hexToRGBA(vm.club.plane.bg_colour, 0.25);
            } 

            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    //console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.planes');
                });
        }

        vm.save_new_aircraft_bit = function(item, num){
            
            // console.log(item);
            // console.log(num);

            //this assumes there was an engine and prop already saved


            var comb = "plane_"+item+"_"+num;
            var comb2 = "plane_"+item+"_"+num+"_replace";

            var item_update = {};
            
            if(vm[comb] && vm[comb] !== ""){
                //only if there is one set --> FIRST!!!
                vm[comb].removed_date = vm[comb2].removed_date;
                delete(vm[comb2].removed_date);

                item_update = {
                    old_item: vm[comb],
                    new_item: vm[comb2],
                    plane_id: vm.club.plane.id,
                    item: item,
                    no: num
                };
            } else {
                item_update = {
                    old_item: {},
                    new_item: vm[comb2],
                    plane_id: vm.club.plane.id,
                    item: item,
                    no: num
                };
            }

            

            // if(item == "engine"){
            //     if(num == 1){
                    
            //         console.log( "engine", vm );
            //         console.log( "engine", vm.plane_engine_1 );
            //         console.log( "engine", vm.plane_engine_1.removed_date );
            //         console.log( "engine", vm.plane_engine_1_replace );
            //         console.log( "engine", vm.plane_engine_1_replace.removed_date );

            //         vm.plane_engine_1.removed_date = vm.plane_engine_1_replace.removed_date;
            //         delete(vm.plane_engine_1_replace.removed_date);
            //         item_update.old_item = vm.plane_engine_1;
            //         item_update.new_item = vm.plane_engine_1_replace;

            //     } else if(num == 2){
            //         vm.plane_engine_2.removed_date = vm.plane_engine_2_replace.removed_date;
            //         delete(vm.plane_engine_2_replace.removed_date);
            //         item_update.old_item = vm.plane_engine_2;
            //         item_update.new_item = vm.plane_engine_2_replace;
            //     }
            // } else if(item == "propeller"){
            //     if(num == 1){
            //         vm.plane_propeller_1.removed_date = vm.plane_engine_1_replace.removed_date;
            //         delete(vm.plane_engine_1_replace.removed_date);
            //         item_update.old_item = vm.plane_propeller_1;
            //         item_update.new_item = vm.plane_engine_1_replace;
            //     } else if(num == 2){
            //         vm.plane_propeller_2.removed_date = vm.plane_engine_2_replace.removed_date;
            //         delete(vm.plane_engine_2_replace.removed_date);
            //         item_update.old_item = vm.plane_propeller_2;
            //         item_update.new_item = vm.plane_engine_2_replace;
            //     }
            // }

           
            console.log("LETS SEE WHAT WOULD BE SENT", item_update);


            PlaneService.UpdateAircraftBit(item_update)
                .then(function(data){
                    console.log(data);
                    //console.log("saved");
                    $state.go('dashboard.manage_club.planes');
                });

        }


        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }


        function check_all(){

            //maybe a nice to have one day... not yet though.


            //licences
            vm.club.plane.requirements.licence.forEach(function(obj){

            });

        }

      


        $scope.add_item = function(type){
            //console.log("ADD");
            switch(type){
                case "licence":
                    //console.log("licence");
                    if(vm.temporary.licence && vm.temporary.licence !== "" && vm.temporary.rating && vm.temporary.rating !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_licence = {
                            licence_id: vm.temporary.licence.id,
                            licence_title: vm.temporary.licence.abbreviation,
                            rating_title: vm.temporary.rating.abbreviation,
                            rating_id: vm.temporary.rating.id
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
                            vm.club.plane.requirements.licence.push(add_licence);
                        }

                        delete vm.temporary.licence;
                        delete vm.temporary.rating;

                    } else {
                        ToastService.warning('Missing Licence', 'Please select a licence and rating that is required to book the plane solo!');
                    }

                break;


                case "medical":
                    //console.log("medical");
                    if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_medical = {
                            authority_id: vm.temporary.medical_authority.id,
                            authority_title: vm.temporary.medical_authority.abbreviation,
                            medical_component_id: vm.temporary.medical_component.id,
                            medical_component_title: vm.temporary.medical_component.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
                            vm.club.plane.requirements.medical.push(add_medical);
                        }

                        delete vm.temporary.medical_authority;
                        delete vm.temporary.medical_component;

                    } else {
                        ToastService.warning('Missing Medical', 'Please select a medical that is required to book the plane solo!');
                    }

                break;


                case "differences":
                    //console.log("difference");
                    if(vm.temporary.difference && vm.temporary.difference !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_difference = {
                            difference_id: vm.temporary.difference.id,
                            difference_title: vm.temporary.difference.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
                            vm.club.plane.requirements.differences.push(add_difference);
                        }

                        delete vm.temporary.difference;

                    } else {
                        ToastService.warning('Missing Difference', 'Please select a difference that is required to book the plane solo!');
                    }

                break;


            }



        }


        $scope.remove_item = function(type, index){
            //console.log("REMOVE");

            vm.club.plane.requirements[type].splice(index, 1);


            // switch(type){
            //     case "licence":
            //             //console.log("licence");
                   
            //             //check if it doesnt exist first...
            //             // if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
            //             //     vm.club.plane.requirements.licence.push(add_licence);
            //             // }

            //             vm.club.plane.requirements.licence.splice(index, 1);
                      
                   

            //     break;


            //     case "medical":
            //         //console.log("medical");
            //         if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_medical = {
            //                 authority_id: vm.temporary.medical_authority.id,
            //                 authority_title: vm.temporary.medical_authority.abbreviation,
            //                 medical_component_id: vm.temporary.medical_component.id,
            //                 medical_component_title: vm.temporary.medical_component.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
            //                 vm.club.plane.requirements.medical.push(add_medical);
            //             }

            //             delete vm.temporary.medical_authority;
            //             delete vm.temporary.medical_component;

            //         } else {
            //             alert("Please select a medical that is required to book the plane solo!");
            //         }

            //     break;


            //     case "differences":
            //         //console.log("difference");
            //         if(vm.temporary.difference && vm.temporary.difference !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_difference = {
            //                 difference_id: vm.temporary.difference.id,
            //                 difference_title: vm.temporary.difference.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
            //                 vm.club.plane.requirements.differences.push(add_difference);
            //             }

            //             delete vm.temporary.difference;

            //         } else {
            //             alert("Please select a difference that is required to book the plane solo!");
            //         }

            //     break;


            // }



        }
















        $scope.update_this_file = function(file){
            //console.log("==== update is : ", file.id);
            if(update_this_file.indexOf(file.id) === -1){
                update_this_file.push(file.id)
            } else {
               ////console.log("This item already exists"); 
            } 
        }


         $scope.remove_real_file = function(file){

                //remove_file

                vm.club.plane.plane_documents = $.grep(vm.club.plane.plane_documents, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                PlaneDocumentService.Delete(vm.user_id, file.id)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }


        vm.files = {
            radio: [],
            cert: [],
            insurance: [],
            noise: []
        }


           $scope.processFile = function(files, location){
                 //console.log("files", files[0].file_return);

                     // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[0].file_return);
                     ////console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    files[0].file.temp_path = j.saved_url;
                    files[0].file.save_name = j.files.file.name;

                    var ft = j.files.file.name;
                    //console.log("ft", ft);
                    var fft = ft.split('.').pop();
                    files[0].file.extension = fft;
                    //console.log("FILE is : ", files[0]);

                    // //console.log("file", files[i].file);
                    vm.files[location].push(files[0].file);


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            //console.log("REMOVE: ", j);
            //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            
            PoidService.DeleteTmp(j.saved_url)
                .then(function (data) {
                    //console.log(data);
                    if(data.success){
                        //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }
          

          // $scope.$on('flow::fileAdded', function (event, $flow, flowFile) {
          //     event.preventDefault();//prevent file from uploading
          //     //console.log("FILE ADDED");
          //     //console.log($flow);
          //   });

            $scope.processFiles = function(files){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    //console.log("J is : ",j);
                    //console.log("name is : ", j.files.file.name);

                    files[i].file.temp_path = j.saved_url;
                    files[i].file.save_name = j.files.file.name;
                    var ft = j.files.file.name;
                    ft = ft.split('.').pop();
                    files[i].file.extension = ft;

                    // //console.log("file", files[i].file);
                    vm.plane_documents.push(files[i].file);
                }


            }

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }

            $scope.get_icon = function(file){

                var ft = file.name;
                ft = ft.split('.').pop();
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }


            $scope.get_icon2 = function(file){

                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }



            $scope.delete_poid = function(id){

              
                var a = prompt("Are you sure you wish to delete this poid? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){


                    //console.log("WE DELETE IT");


                    // PoidService.Delete(vm.user_id, id)
                    //     .then(function (data) {
                    //         //console.log(data);
                    //         if(data.success){
                    //             //console.log("HUZZAH", data);
                    //             //then we need to remove this from the list of files...
                    //             vm.user_poids = $.grep(vm.user_poids, function(e){ 
                    //                 return e.id != id; 
                    //             });
                                
                    //             //refresh?
                    //             $state.reload();
                    //             $state.go('dashboard.my_account.poid');

                    //         } else {

                    //             alert("Something went terribly wrong... \n\n "+data.message);

                    //         }

                    //     });



                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_plane_documents = function(){

               
              

                //console.log("plane_documents: ", vm.plane_documents);


                //compile the required elements YAY

                //console.log("plane_document ", vm.plane_document);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    // for(var i=0;i<vm.plane_document.images.length;i++){
                    //     delete vm.plane_document.images[i].data_uri;
                    // }

                    // // vm.plane_document.images = vm.plane_documents;
                    // vm.plane_document.images = vm.plane_document.images.concat(vm.plane_documents);
                    // vm.plane_document.user_id = vm.user_id;




            //     if(vm.plane_document.id){
            //         //then its an udpate

            //         //merge the images left?
            //         PoidService.Update(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                     $state.go('dashboard.my_account.poid', {}, { reload: true });





            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });

            //     } else {


                   


            //         //then its a create
            //         //console.log(vm.plane_document);

            //         PoidService.Create(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                    // $state.reload();
            //                    // $state.go('dashboard.my_account.poid', {}, { reload: true });


            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });


            //     }



             };




             $scope.change_file_name = function(file){
                
                //this is terribly ineficient... unfortunately... can't 
                //work out how else to do it! (lol)

                // //console.log("TO BE CHANGED", file);

                // //console.log("BEFORE BEFORE", vm.plane_documents);

                vm.plane_documents = $.grep(vm.plane_documents, function(e){ 
                    return e.temp_path != file.temp_path; 
                });

                // //console.log("BEFORE", vm.plane_documents);

                vm.plane_documents.push(file);

                // //console.log("AFTER", vm.plane_documents);

             }














        // ══════════════════════════════════════════════════════════
        //  INSTRUCTOR QUALIFICATIONS
        // ══════════════════════════════════════════════════════════

        // ── Open / close qualifications matrix panel ─────────────

        vm.openQualificationsPanel = function() {
            vm.show_qual_panel = true;
            vm.qualTab = 'courses';
            vm.loadQualMatrix('courses');
        };

        vm.closeQualificationsPanel = function() {
            vm.show_qual_panel = false;
            // Refresh the instructor detail panel's qualifications overview
            if (vm.selected_instructor && vm.selected_instructor.user_id) {
                vm.loadInstructorQualOverview(vm.selected_instructor.user_id);
            }
        };

        vm.switchQualTab = function(tab) {
            if (vm.qualTab === tab) return;
            vm.qualTab = tab;
            vm.loadQualMatrix(tab);
        };

        // ── Load matrix data ─────────────────────────────────────

        vm.loadQualMatrix = function(tab) {
            vm.loadingQualMatrix = true;

            var promise;
            if (tab === 'courses') {
                promise = InstructorQualificationsService.GetCourseMatrix(vm.club_id);
            } else if (tab === 'tuition') {
                promise = InstructorQualificationsService.GetTuitionMatrix(vm.club_id);
            } else {
                promise = InstructorQualificationsService.GetExperienceMatrix(vm.club_id);
            }

            promise.then(function(data) {
                vm.loadingQualMatrix = false;
                if (!data || data.success === false) {
                    ToastService.error('Error', 'Could not load qualifications matrix.');
                    return;
                }
                processMatrixData(tab, data);
            }).catch(function() {
                vm.loadingQualMatrix = false;
                ToastService.error('Error', 'Failed to load qualifications.');
            });
        };

        function processMatrixData(tab, data) {
            if (tab === 'courses') {
                vm.qualCourseColumns = data.courses || [];
                vm.qualCourseRows = (data.instructors || []).map(function(instr) {
                    instr._colour = getInstructorColour(instr.user_id);
                    instr._saving = false;
                    instr._saved = false;
                    instr._allSelected = checkAllSelected(instr.courses);
                    // Ensure boolean values
                    (instr.courses || []).forEach(function(c) {
                        c.qualified = !!c.qualified;
                    });
                    return instr;
                });
                updateColumnAllSelected('courses');
            } else if (tab === 'tuition') {
                vm.qualTuitionColumns = data.tuition_types || [];
                vm.qualTuitionRows = (data.instructors || []).map(function(instr) {
                    instr._colour = getInstructorColour(instr.user_id);
                    instr._saving = false;
                    instr._saved = false;
                    instr._allSelected = checkAllSelected(instr.tuition_types);
                    (instr.tuition_types || []).forEach(function(t) {
                        t.qualified = !!t.qualified;
                    });
                    return instr;
                });
                updateColumnAllSelected('tuition');
            } else {
                vm.qualExpColumns = data.experiences || [];
                vm.qualExpRows = (data.instructors || []).map(function(instr) {
                    instr._colour = getInstructorColour(instr.user_id);
                    instr._saving = false;
                    instr._saved = false;
                    instr._allSelected = checkAllSelected(instr.experiences);
                    (instr.experiences || []).forEach(function(e) {
                        e.qualified = !!e.qualified;
                    });
                    return instr;
                });
                updateColumnAllSelected('experiences');
            }
        }

        function updateColumnAllSelected(tab) {
            var cols = tab === 'courses' ? vm.qualCourseColumns :
                       tab === 'tuition' ? vm.qualTuitionColumns : vm.qualExpColumns;
            var rows = tab === 'courses' ? vm.qualCourseRows :
                       tab === 'tuition' ? vm.qualTuitionRows : vm.qualExpRows;
            var itemKey = tab === 'courses' ? 'courses' :
                          tab === 'tuition' ? 'tuition_types' : 'experiences';
            var idField = tab === 'courses' ? 'course_id' :
                          tab === 'tuition' ? 'tuition_type_id' : 'experience_id';
            (cols || []).forEach(function(col) {
                col._allSelected = (rows || []).length > 0 && (rows || []).every(function(instr) {
                    var items = instr[itemKey] || [];
                    var match = items.filter(function(q) { return String(q[idField]) === String(col.id); })[0];
                    return match && match.qualified;
                });
            });
        }

        function getInstructorColour(user_id) {
            if (!vm.club || !vm.club.instructors) return '#64748b';
            for (var i = 0; i < vm.club.instructors.length; i++) {
                if (parseInt(vm.club.instructors[i].user_id, 10) === parseInt(user_id, 10)) {
                    return vm.club.instructors[i].instructor_colour || '#64748b';
                }
            }
            return '#64748b';
        }

        function checkAllSelected(items) {
            if (!items || !items.length) return false;
            return items.every(function(i) { return !!i.qualified; });
        }

        // ── Toggle a single checkbox (debounced save) ────────────

        vm.onQualToggle = function(instr, tab) {
            instr._allSelected = checkAllSelected(
                tab === 'courses' ? instr.courses :
                tab === 'tuition' ? instr.tuition_types :
                instr.experiences
            );
            updateColumnAllSelected(tab);
            instr._saved = false;

            // Debounce: wait 600ms after last toggle before saving
            var timerKey = tab + '_' + instr.user_id;
            if (qualSaveTimers[timerKey]) {
                $timeout.cancel(qualSaveTimers[timerKey]);
            }
            qualSaveTimers[timerKey] = $timeout(function() {
                saveInstructorQuals(instr, tab);
            }, 600);
        };

        function saveInstructorQuals(instr, tab) {
            instr._saving = true;
            instr._saved = false;

            var promise;
            if (tab === 'courses') {
                var courseIds = (instr.courses || []).filter(function(c) { return c.qualified; }).map(function(c) { return c.course_id; });
                promise = InstructorQualificationsService.SetCourses(vm.club_id, instr.user_id, courseIds);
            } else if (tab === 'tuition') {
                var tuitionIds = (instr.tuition_types || []).filter(function(t) { return t.qualified; }).map(function(t) { return t.tuition_type_id; });
                promise = InstructorQualificationsService.SetTuition(vm.club_id, instr.user_id, tuitionIds);
            } else {
                var expIds = (instr.experiences || []).filter(function(e) { return e.qualified; }).map(function(e) { return e.experience_id; });
                promise = InstructorQualificationsService.SetExperiences(vm.club_id, instr.user_id, expIds);
            }

            promise.then(function(data) {
                instr._saving = false;
                if (data && data.success !== false) {
                    instr._saved = true;
                    updateColumnAllSelected(tab);
                    // Auto-hide "Saved" after 2s
                    $timeout(function() { instr._saved = false; }, 2000);
                } else {
                    ToastService.error('Error', 'Could not save qualifications for ' + instr.first_name + '.');
                }
            }).catch(function() {
                instr._saving = false;
                ToastService.error('Error', 'Failed to save qualifications.');
            });
        }

        // ── Row "Select All" / "Deselect All" ────────────────────

        vm.bulkSelectRow = function(instr, tab) {
            instr._saving = true;
            instr._saved = false;

            var mode, promise;
            if (tab === 'courses') {
                mode = 'all_courses_to_instructor';
                promise = InstructorQualificationsService.BulkCourses(vm.club_id, mode, instr.user_id);
            } else if (tab === 'tuition') {
                mode = 'all_tuition_to_instructor';
                promise = InstructorQualificationsService.BulkTuition(vm.club_id, mode, instr.user_id);
            } else {
                mode = 'all_experiences_to_instructor';
                promise = InstructorQualificationsService.BulkExperiences(vm.club_id, mode, instr.user_id);
            }

            promise.then(function(data) {
                instr._saving = false;
                if (data && data.success !== false) {
                    // Tick all checkboxes locally
                    var items = tab === 'courses' ? instr.courses : tab === 'tuition' ? instr.tuition_types : instr.experiences;
                    (items || []).forEach(function(i) { i.qualified = true; });
                    instr._allSelected = true;
                    instr._saved = true;
                    updateColumnAllSelected(tab);
                    $timeout(function() { instr._saved = false; }, 2000);
                    ToastService.success('All Assigned', 'All ' + tab + ' assigned to ' + instr.first_name + '.');
                } else {
                    ToastService.error('Error', 'Bulk assign failed.');
                }
            }).catch(function() {
                instr._saving = false;
                ToastService.error('Error', 'Bulk assign failed.');
            });
        };

        vm.bulkDeselectRow = function(instr, tab) {
            // "Deselect all" = set to empty array
            instr._saving = true;
            instr._saved = false;

            var promise;
            if (tab === 'courses') {
                promise = InstructorQualificationsService.SetCourses(vm.club_id, instr.user_id, []);
            } else if (tab === 'tuition') {
                promise = InstructorQualificationsService.SetTuition(vm.club_id, instr.user_id, []);
            } else {
                promise = InstructorQualificationsService.SetExperiences(vm.club_id, instr.user_id, []);
            }

            promise.then(function(data) {
                instr._saving = false;
                if (data && data.success !== false) {
                    var items = tab === 'courses' ? instr.courses : tab === 'tuition' ? instr.tuition_types : instr.experiences;
                    (items || []).forEach(function(i) { i.qualified = false; });
                    instr._allSelected = false;
                    instr._saved = true;
                    updateColumnAllSelected(tab);
                    $timeout(function() { instr._saved = false; }, 2000);
                    ToastService.success('Cleared', 'All ' + tab + ' removed from ' + instr.first_name + '.');
                } else {
                    ToastService.error('Error', 'Could not clear qualifications.');
                }
            }).catch(function() {
                instr._saving = false;
                ToastService.error('Error', 'Could not clear qualifications.');
            });
        };

        // ── Column "Select All" ───────────────────────────────────

        vm.bulkSelectColumn = function(tab, col) {
            var mode, targetId, promise;
            if (tab === 'courses') {
                mode = 'all_instructors_to_course';
                targetId = col.id;
                promise = InstructorQualificationsService.BulkCourses(vm.club_id, mode, targetId);
            } else if (tab === 'tuition') {
                mode = 'all_instructors_to_tuition';
                targetId = col.id;
                promise = InstructorQualificationsService.BulkTuition(vm.club_id, mode, targetId);
            } else {
                mode = 'all_instructors_to_experience';
                targetId = col.id;
                promise = InstructorQualificationsService.BulkExperiences(vm.club_id, mode, targetId);
            }

            promise.then(function(data) {
                if (data && data.success !== false) {
                    // Refresh the matrix to reflect the update
                    vm.loadQualMatrix(tab);
                    ToastService.success('Column Assigned', 'All instructors assigned to \'' + col.title + '\'.');
                } else {
                    ToastService.error('Error', 'Bulk column assign failed.');
                }
            }).catch(function() {
                ToastService.error('Error', 'Bulk column assign failed.');
            });
        };

        vm.bulkDeselectColumn = function(tab, col) {
            // Deselect a column: for each instructor, remove this item and save their list
            var rows = tab === 'courses' ? vm.qualCourseRows :
                       tab === 'tuition' ? vm.qualTuitionRows : vm.qualExpRows;
            var itemKey = tab === 'courses' ? 'courses' :
                          tab === 'tuition' ? 'tuition_types' : 'experiences';
            var promises = [];

            col._saving = true;
            var idField = tab === 'courses' ? 'course_id' :
                          tab === 'tuition' ? 'tuition_type_id' : 'experience_id';
            rows.forEach(function(instr) {
                var items = instr[itemKey] || [];
                // Find the item for this column and deselect it
                items.forEach(function(q) {
                    if (String(q[idField]) === String(col.id)) q.qualified = false;
                });
                // Build the list of still-qualified IDs
                var qualifiedIds = items.filter(function(q) { return q.qualified; })
                                       .map(function(q) { return q[idField]; });
                var promise;
                if (tab === 'courses') {
                    promise = InstructorQualificationsService.SetCourses(vm.club_id, instr.user_id, qualifiedIds);
                } else if (tab === 'tuition') {
                    promise = InstructorQualificationsService.SetTuition(vm.club_id, instr.user_id, qualifiedIds);
                } else {
                    promise = InstructorQualificationsService.SetExperiences(vm.club_id, instr.user_id, qualifiedIds);
                }
                promises.push(promise);
            });

            // Wait for all saves then refresh
            (promises.length ? promises.reduce(function(chain, p) {
                return chain.then(function() { return p; });
            }, $q.when()) : $q.when()).then(function() {
                col._saving = false;
                col._allSelected = false;
                rows.forEach(function(instr) {
                    instr._allSelected = checkAllSelected(instr[itemKey]);
                });
                ToastService.success('Column Cleared', 'All instructors removed from \'' + col.title + '\'.');
            }).catch(function() {
                col._saving = false;
                vm.loadQualMatrix(tab);
                ToastService.error('Error', 'Could not clear column.');
            });
        };

        // ── Load per-instructor overview (for detail panel) ──────

        vm.loadInstructorQualOverview = function(user_id) {
            vm.loadingQualifications = true;
            vm.instrQualOverview = null;

            InstructorQualificationsService.GetOverview(vm.club_id, user_id)
                .then(function(data) {
                    vm.loadingQualifications = false;
                    if (data && data.success !== false) {
                        vm.instrQualOverview = {
                            qualified_courses:       data.qualified_courses || [],
                            qualified_tuition_types: data.qualified_tuition_types || [],
                            qualified_experiences:   data.qualified_experiences || []
                        };
                    } else {
                        vm.instrQualOverview = {
                            qualified_courses: [],
                            qualified_tuition_types: [],
                            qualified_experiences: []
                        };
                    }
                })
                .catch(function() {
                    vm.loadingQualifications = false;
                    vm.instrQualOverview = {
                        qualified_courses: [],
                        qualified_tuition_types: [],
                        qualified_experiences: []
                    };
                });
        };

        // ── Close qual panel on Escape ───────────────────────────
        var qualEscHandler = function(e) {
            if (e.keyCode === 27 && vm.show_qual_panel) {
                $scope.$apply(function() {
                    vm.closeQualificationsPanel();
                });
            }
        };
        document.addEventListener('keydown', qualEscHandler);
        $scope.$on('$destroy', function() {
            document.removeEventListener('keydown', qualEscHandler);
            // Cancel any pending debounce timers
            Object.keys(qualSaveTimers).forEach(function(key) {
                $timeout.cancel(qualSaveTimers[key]);
            });
        });


        initController();

        function initController() {
           //console.log("check if access is okay");
        }


          var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          // $scope.open = function (plane_id) {
          //   var modalInstance = $uibModal.open({
          //     animation: true,
          //     templateUrl: 'views/modals/deleteModal.html',
          //     controller: 'ModalInstanceCtrl',
          //     //params: {},
          //     size: "lg",
          //     resolve: {
          //       id: function () {
          //         return plane_id;
          //       },
          //       warning: function(){
          //           return warning_msg;
          //       }
          //     }
          //   });
          //   modalInstance.result.then(function (plane_id) {
          //     $log.info('PRESSED GO: '+plane_id);
          //     PlaneService.Delete(plane_id)
          //     .then(function(){
          //       //console.log("HELLO DELETE");
          //       //update view?
          //        vm.club.planes = $.grep(vm.club.planes, function(e){ 
          //           return e.plane_id != plane_id; 
          //       });
          //     })
          //   }, function () {
          //     $log.info('Modal dismissed at: ' + new Date());
          //   });
          // };

            $scope.open = function (club_plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return club_plane_id;
                },
                params: function() {
                  return {id: club_plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane) {
                var id = plane.id;
              $log.info('PRESSED GO: ', id);
              
              PlaneService.Delete(id)
              .then(function(){
                //console.log("HELLO DELETE");
                //update view?
                 vm.club.planes = $.grep(vm.club.planes, function(e){ 
                    return e.id != id; 
                });
             });

            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });


          };
         

         vm.aircraft;
         vm.plane_search;
         vm.plane_to_add;

         $scope.get_aircraft = function(registration){

            if(registration.length > 3){

                 PlaneService.GetAddAircraft(registration)
                .then(function (data) {
                    ////console.log(data);
                    if(data){
                        //use GB airfields first...
                         
                        // vm.aircraft = data;
                        // console.log("one is : ", data[0]);
                       
                         if(data.length == 0){
                            // console.log("SETTINGS HERE");
                              vm.aircraft = [
                                    {
                                        icao_type: "not known",
                                        registration: registration.toUpperCase()
                                    }];
                        } else {
                            vm.aircraft = data;
                        }

                    } else {

                          vm.aircraft = [
                                    {
                                        icao_type: "not known",
                                        registration: registration.toUpperCase()
                                    }];

                                    //console.log(vm.aircraft);
                        // console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });


            }

            
        }

        // ══════════════════════════════════════════════════════════
        //  BOOKING PREFERENCES (per-instructor booking modes)
        // ══════════════════════════════════════════════════════════

        /**
         * Helper: map a mode string to a badge category for CSS classes
         */
        vm.getBpBadgeClass = function(mode) {
            switch (mode) {
                case 'open':                  return 'open';
                case 'admin_approval':
                case 'instructor_approval':   return 'approval';
                case 'admin_and_self':
                case 'self_only':             return 'restricted';
                default:                      return 'open';
            }
        };

        vm.getBpModeIcon = function(mode) {
            switch (mode) {
                case 'open':                  return 'fa-door-open';
                case 'admin_approval':        return 'fa-user-shield';
                case 'instructor_approval':   return 'fa-clipboard-check';
                case 'admin_and_self':        return 'fa-lock';
                case 'self_only':             return 'fa-user-lock';
                default:                      return 'fa-door-open';
            }
        };

        vm.getBpBadgeLabel = function(mode) {
            switch (mode) {
                case 'open':                  return 'Open';
                case 'admin_approval':        return 'Admin Approval';
                case 'instructor_approval':   return 'Approval';
                case 'admin_and_self':        return 'Admin Only';
                case 'self_only':             return 'Self Only';
                default:                      return 'Open';
            }
        };

        /**
         * Load preferences + available modes when the slide panel opens
         */
        vm.loadBookingPreferences = function(userId) {
            vm.loadingBookingPrefs = true;
            vm.bookingPrefs = null;
            vm.bpSavedBooking = false;
            vm.bpSavedExperience = false;

            // Load the modes reference list (once) and the instructor's prefs in parallel
            var modesPromise = vm.bookingPrefsModes.length
                ? $q.when(vm.bookingPrefsModes)
                : BookingPreferencesService.GetModes().then(function(data) {
                    if (data && data.success && data.modes) {
                        vm.bookingPrefsModes = data.modes;
                    }
                    return vm.bookingPrefsModes;
                });

            var prefsPromise = BookingPreferencesService.GetPreferences(userId, vm.club_id);

            $q.all([modesPromise, prefsPromise]).then(function(results) {
                var prefsData = results[1];
                vm.loadingBookingPrefs = false;
                if (prefsData && prefsData.success !== false && prefsData.preferences) {
                    vm.bookingPrefs = {
                        booking_mode:            prefsData.preferences.booking_mode || 'open',
                        experience_booking_mode: prefsData.preferences.experience_booking_mode || 'open',
                        is_default:              prefsData.preferences.is_default || false
                    };
                } else {
                    // Fallback to defaults
                    vm.bookingPrefs = {
                        booking_mode: 'open',
                        experience_booking_mode: 'open',
                        is_default: true
                    };
                }

                // Also update the instructor card badge data
                if (vm.selected_instructor) {
                    vm.selected_instructor._bookingMode    = vm.bookingPrefs.booking_mode;
                    vm.selected_instructor._expBookingMode = vm.bookingPrefs.experience_booking_mode;
                }
            }).catch(function() {
                vm.loadingBookingPrefs = false;
                vm.bookingPrefs = {
                    booking_mode: 'open',
                    experience_booking_mode: 'open',
                    is_default: true
                };
            });
        };

        /**
         * Set the booking mode (regular training flights)
         */
        vm.setBookingMode = function(mode) {
            if (!vm.bookingPrefs || vm.savingBookingMode) return;
            if (vm.bookingPrefs.booking_mode === mode) return;

            var previousMode = vm.bookingPrefs.booking_mode;
            vm.bookingPrefs.booking_mode = mode;
            vm.savingBookingMode = true;
            vm.bpSavedBooking = false;

            BookingPreferencesService.SavePreferences(
                vm.selected_instructor.user_id,
                vm.club_id,
                { booking_mode: mode }
            ).then(function(data) {
                vm.savingBookingMode = false;
                if (data && data.success !== false) {
                    vm.bookingPrefs.is_default = false;
                    vm.selected_instructor._bookingMode = mode;
                    vm.bpSavedBooking = true;
                    // Auto-hide the saved indicator after 2s
                    $timeout(function() { vm.bpSavedBooking = false; }, 2000);
                } else {
                    // Revert on failure
                    vm.bookingPrefs.booking_mode = previousMode;
                    ToastService.error('Error', data.message || 'Could not save booking preference.');
                }
            }).catch(function() {
                vm.savingBookingMode = false;
                vm.bookingPrefs.booking_mode = previousMode;
                ToastService.error('Error', 'Could not save booking preference.');
            });
        };

        /**
         * Set the experience/voucher booking mode
         */
        vm.setExperienceBookingMode = function(mode) {
            if (!vm.bookingPrefs || vm.savingExpMode) return;
            if (vm.bookingPrefs.experience_booking_mode === mode) return;

            var previousMode = vm.bookingPrefs.experience_booking_mode;
            vm.bookingPrefs.experience_booking_mode = mode;
            vm.savingExpMode = true;
            vm.bpSavedExperience = false;

            BookingPreferencesService.SavePreferences(
                vm.selected_instructor.user_id,
                vm.club_id,
                { experience_booking_mode: mode }
            ).then(function(data) {
                vm.savingExpMode = false;
                if (data && data.success !== false) {
                    vm.bookingPrefs.is_default = false;
                    vm.selected_instructor._expBookingMode = mode;
                    vm.bpSavedExperience = true;
                    $timeout(function() { vm.bpSavedExperience = false; }, 2000);
                } else {
                    vm.bookingPrefs.experience_booking_mode = previousMode;
                    ToastService.error('Error', data.message || 'Could not save booking preference.');
                }
            }).catch(function() {
                vm.savingExpMode = false;
                vm.bookingPrefs.experience_booking_mode = previousMode;
                ToastService.error('Error', 'Could not save booking preference.');
            });
        };


    }