// ═══════════════════════════════════════════════════════════════════
//  InstructorScheduleController
//  Combined view: weekly availability + ad-hoc dates + holidays
// ═══════════════════════════════════════════════════════════════════

app.controller('InstructorScheduleController', InstructorScheduleController);

InstructorScheduleController.$inject = [
    'InstructorService', 'AdhocAvailabilityService', 'HolidayService',
    'UserService',
    '$rootScope', '$scope', '$state', 'ToastService'
];

function InstructorScheduleController(
    InstructorService, AdhocAvailabilityService, HolidayService,
    UserService,
    $rootScope, $scope, $state, ToastService
) {
    var vm = this;

    // ─── State ───────────────────────────────────────────────────
    vm.user = $rootScope.globals.currentUser;
    vm.user_id = vm.user.id;

    vm.available_times = [];
    vm.available_time  = null;
    vm.loaded          = false;   // the clubs + availability fetch has finished (with or without a club)
    vm.loadError       = false;   // it failed: show "couldn't load" + Try again, not a spinner for ever
    vm.selected_club   = null;
    vm.activeTab       = 'schedule';

    vm.saving          = false;
    vm.addingAdhoc     = false;
    vm.addingHoliday   = false;
    vm.loadingAdhoc    = false;
    vm.savingEdit      = false;
    vm.editingSlot     = null;

    // Ad-hoc form state
    vm.adhocDates         = [];
    vm.adhocSelectedDates = [];
    vm.adhocCalendarDate  = null;
    vm.adhocNotes         = '';

    // Default times for ad-hoc
    var defaultFrom = new Date();
    defaultFrom.setHours(8, 0, 0, 0);
    var defaultTo = new Date();
    defaultTo.setHours(21, 0, 0, 0);
    vm.adhocFromTime = angular.copy(defaultFrom);
    vm.adhocToTime   = angular.copy(defaultTo);

    // Holiday form state
    vm.holidays        = [];
    vm.holidayStart    = null;
    vm.holidayEnd      = null;
    vm.holidayTitle    = '';
    vm.holidayAllDay   = true;
    vm.holidayStartOpen = false;
    vm.holidayEndOpen   = false;

    var holidayFromDefault = new Date();
    holidayFromDefault.setHours(8, 0, 0, 0);
    var holidayToDefault = new Date();
    holidayToDefault.setHours(18, 0, 0, 0);
    vm.holidayFromTime = angular.copy(holidayFromDefault);
    vm.holidayToTime   = angular.copy(holidayToDefault);

    vm.holidayDateOptions = { startingDay: 1 };

    // Datepicker options for ad-hoc calendar
    vm.datepickerOptions = {
        startingDay: 1,
        minDate:     new Date(),
        showWeeks:   false
    };


    // ─── Day definitions ─────────────────────────────────────────
    vm.days = [
        { day: 'Monday',    from_variable: 'monday_from_time',    to_variable: 'monday_to_time',    disabled_variable: 'monday_disabled' },
        { day: 'Tuesday',   from_variable: 'tuesday_from_time',   to_variable: 'tuesday_to_time',   disabled_variable: 'tuesday_disabled' },
        { day: 'Wednesday', from_variable: 'wednesday_from_time', to_variable: 'wednesday_to_time', disabled_variable: 'wednesday_disabled' },
        { day: 'Thursday',  from_variable: 'thursday_from_time',  to_variable: 'thursday_to_time',  disabled_variable: 'thursday_disabled' },
        { day: 'Friday',    from_variable: 'friday_from_time',    to_variable: 'friday_to_time',    disabled_variable: 'friday_disabled' },
        { day: 'Saturday',  from_variable: 'saturday_from_time',  to_variable: 'saturday_to_time',  disabled_variable: 'saturday_disabled' },
        { day: 'Sunday',    from_variable: 'sunday_from_time',    to_variable: 'sunday_to_time',    disabled_variable: 'sunday_disabled' }
    ];


    // ─── Init ────────────────────────────────────────────────────
    loadAvailability();
    loadHolidays();


    // ═════════════════════════════════════════════════════════════
    // SCOPE METHODS
    // ═════════════════════════════════════════════════════════════

    $scope.setTab = function(tab) {
        vm.activeTab = tab;
        vm.chosenTab = true;
    };

    $scope.selectClub = function(club) {
        if (!club || !club.club_id) return;
        vm.selected_club = club;
        var targetId = parseInt(club.club_id, 10);
        for (var i = 0; i < vm.available_times.length; i++) {
            if (parseInt(vm.available_times[i].club_id, 10) === targetId) {
                vm.available_time = vm.available_times[i];
                if (!vm.available_time.availability_mode) {
                    vm.available_time.availability_mode = 'regular';
                }
                loadAdhocDates();
                return;
            }
        }
    };

    $scope.changeClub = function() {
        if (!vm.selected_club || !vm.selected_club.club_id) return;
        var targetId = parseInt(vm.selected_club.club_id, 10);
        for (var i = 0; i < vm.available_times.length; i++) {
            if (parseInt(vm.available_times[i].club_id, 10) === targetId) {
                vm.available_time = vm.available_times[i];
                // Ensure mode is set
                if (!vm.available_time.availability_mode) {
                    vm.available_time.availability_mode = 'regular';
                }
                loadAdhocDates();
                return;
            }
        }
    };

    $scope.toggleDay = function(disabledVar) {
        vm.available_time[disabledVar] = vm.available_time[disabledVar] ? 0 : 1;
    };

    $scope.setMode = function(mode) {
        if (vm.available_time.availability_mode === mode) return;
        var before = vm.available_time.availability_mode;
        vm.available_time.availability_mode = mode;
        saveScheduleToBackend(function(resp) {
            if (failed(resp)) {
                vm.available_time.availability_mode = before;
                ToastService.error('Mode Not Changed', failMessage(resp, 'Your scheduling mode could not be changed.'));
                return;
            }
            ToastService.success('Mode Updated', 'Switched to ' + (mode === 'adhoc' ? 'ad-hoc' : 'regular') + ' scheduling.');
            if (mode === 'adhoc') {
                vm.activeTab = 'extra';
            }
        });
    };

    $scope.saveSchedule = function() {
        vm.saving = true;
        saveScheduleToBackend(function(resp) {
            vm.saving = false;
            if (failed(resp)) {
                ToastService.error('Schedule Not Saved', failMessage(resp, 'Your weekly availability could not be saved.'));
                return;
            }
            ToastService.success('Schedule Saved', 'Your weekly availability has been updated.');
        });
    };


    // ─── Ad-hoc dates ────────────────────────────────────────────

    $scope.onCalendarDateSelect = function() {
        if (!vm.adhocCalendarDate) return;
        // Check if date already selected
        var dateStr = formatDate(vm.adhocCalendarDate);
        var exists = vm.adhocSelectedDates.some(function(d) {
            return formatDate(d) === dateStr;
        });
        if (!exists) {
            vm.adhocSelectedDates.push(new Date(vm.adhocCalendarDate));
        }
        // Reset so user can pick again
        vm.adhocCalendarDate = null;
    };

    $scope.removeSelectedDate = function(idx) {
        vm.adhocSelectedDates.splice(idx, 1);
    };

    $scope.addAdhocDates = function() {
        if (!vm.adhocSelectedDates.length) return;

        var dates = vm.adhocSelectedDates.map(function(d) {
            return formatDate(d);
        });

        var fromStr = padTime(vm.adhocFromTime.getHours()) + ':' + padTime(vm.adhocFromTime.getMinutes());
        var toStr   = padTime(vm.adhocToTime.getHours()) + ':' + padTime(vm.adhocToTime.getMinutes());

        if (fromStr >= toStr) {
            ToastService.error('Invalid Times', '"From" must be before "To".');
            return;
        }

        var payload = {
            user_id:   vm.user_id,
            club_id:   vm.available_time.club_id,
            dates:     dates,
            from_time: fromStr,
            to_time:   toStr,
            notes:     vm.adhocNotes || null
        };

        // If single date, use available_date instead
        if (dates.length === 1) {
            payload.available_date = dates[0];
            delete payload.dates;
        }

        vm.addingAdhoc = true;
        AdhocAvailabilityService.Create(payload)
            .then(function(resp) {
                vm.addingAdhoc = false;
                if (failed(resp)) {
                    ToastService.error('Dates Not Added', failMessage(resp, 'Your extra dates could not be added.'));
                    return;
                }
                var added  = (resp && resp.added)   ? resp.added.length   : 0;
                var skipped = (resp && resp.skipped) ? resp.skipped.length : 0;
                var msg = added + ' date' + (added !== 1 ? 's' : '') + ' added';
                if (skipped) msg += ', ' + skipped + ' skipped (overlap)';
                ToastService.success('Dates Added', msg);

                vm.adhocSelectedDates = [];
                vm.adhocNotes = '';
                loadAdhocDates();
            });
    };

    $scope.editAdhocSlot = function(slot) {
        vm.editingSlot = slot;
        // Parse times for the timepicker
        vm.editSlotFrom  = parseTimeStr(slot.from_time);
        vm.editSlotTo    = parseTimeStr(slot.to_time);
        vm.editSlotNotes = slot.notes || '';
    };

    $scope.cancelEditSlot = function() {
        vm.editingSlot  = null;
        vm.editSlotFrom = null;
        vm.editSlotTo   = null;
        vm.editSlotNotes = '';
    };

    $scope.saveEditSlot = function() {
        if (!vm.editingSlot) return;
        var fromStr = padTime(vm.editSlotFrom.getHours()) + ':' + padTime(vm.editSlotFrom.getMinutes());
        var toStr   = padTime(vm.editSlotTo.getHours()) + ':' + padTime(vm.editSlotTo.getMinutes());

        if (fromStr >= toStr) {
            ToastService.error('Invalid Times', '"From" must be before "To".');
            return;
        }

        vm.savingEdit = true;
        AdhocAvailabilityService.Update(vm.editingSlot.id, {
            from_time: fromStr,
            to_time:   toStr,
            notes:     vm.editSlotNotes || null
        }).then(function(resp) {
            vm.savingEdit = false;
            if (failed(resp)) {
                // the edit popup stays open with what was typed
                ToastService.error('Slot Not Updated', failMessage(resp, 'Your availability slot could not be updated.'));
                return;
            }
            vm.editingSlot = null;
            ToastService.success('Slot Updated', 'Your availability slot has been updated.');
            loadAdhocDates();
        });
    };

    $scope.deleteAdhocSlot = function(slot) {
        if (!confirm('Remove availability on ' + slot.available_date + '?')) return;
        AdhocAvailabilityService.Delete(slot.id)
            .then(function(resp) {
                if (failed(resp)) {
                    ToastService.error('Not Removed', failMessage(resp, 'The availability slot could not be removed.'));
                    return;
                }
                ToastService.success('Removed', 'Availability slot deleted.');
                loadAdhocDates();
            });
    };


    // ─── Holidays ────────────────────────────────────────────────

    $scope.addHoliday = function() {
        if (!vm.holidayStart || !vm.holidayEnd) {
            ToastService.error('Missing Dates', 'Please select a start and end date for your holiday.');
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
        HolidayService.Create(vm.user_id, newHoliday)
            .then(function(data) {
                vm.addingHoliday = false;
                if (failed(data)) {
                    ToastService.error('Time Off Not Added', failMessage(data, 'Your time off could not be booked.'));
                    return;
                }
                ToastService.success('Holiday Added', 'Time off has been booked.');
                // Reset form
                vm.holidayStart  = null;
                vm.holidayEnd    = null;
                vm.holidayTitle  = '';
                vm.holidayAllDay = true;
                loadHolidays();
            });
    };

    $scope.deleteHoliday = function(hol, idx) {
        if (!confirm('Remove this holiday?')) return;
        HolidayService.Delete(vm.user_id, hol.id)
            .then(function(resp) {
                if (failed(resp)) {
                    ToastService.error('Not Removed', failMessage(resp, 'The holiday could not be removed.'));
                    return;
                }
                vm.holidays.splice(idx, 1);
                ToastService.success('Removed', 'Holiday deleted.');
            });
    };


    // ═════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═════════════════════════════════════════════════════════════

    $scope.retryLoad = function() {
        vm.loaded = false;
        vm.loadError = false;
        loadAvailability();
    };

    // The fetch has finished: without an instructor club there is no weekly / extra-date schedule to show,
    // but time off (per person, not per club) still is.
    function finishLoad(error) {
        vm.loaded = true;
        vm.loadError = !!error && !vm.available_time;
        if (!vm.available_time) { vm.activeTab = 'holidays'; }
        else if (vm.activeTab === 'holidays' && !vm.chosenTab) { vm.activeTab = 'schedule'; }   // back from a no-club / failed load
    }

    function loadAvailability() {
        // 1) Fetch all clubs this user is an instructor at
        // 2) Fetch existing availability records
        // 3) Merge: ensure every instructor club has an availability entry
        UserService.GetInstructorClubs(vm.user_id)
            .then(function(clubsResp) {
                if (failed(clubsResp)) { return finishLoad(true); }
                var clubs = (clubsResp && clubsResp.clubs) ? clubsResp.clubs : [];
                if (!clubs.length) {
                    // Fallback to availability-only if GetAdminClubs returns nothing
                    return loadAvailabilityOnly();
                }

                InstructorService.GetAvailability(vm.user_id)
                    .then(function(data) {
                        if (failed(data)) { return finishLoad(true); }
                        var existingRecords = (data && Array.isArray(data)) ? data : [];

                        // Index existing records by club_id for quick lookup
                        var byClubId = {};
                        existingRecords.forEach(function(rec) {
                            if (rec && rec.club_id) {
                                rec.club_id = parseInt(rec.club_id, 10);
                                byClubId[rec.club_id] = rec;
                            }
                        });

                        // Build the merged list — one entry per instructor club
                        var merged = [];
                        clubs.forEach(function(club) {
                            var cid = parseInt(club.id || club.club_id, 10);
                            var cname = club.title || club.club_name || club.name || '';
                            if (!cid) return;

                            if (byClubId[cid]) {
                                // Use existing availability record, ensure club_name is set
                                var rec = byClubId[cid];
                                rec.club_name = rec.club_name || cname;
                                normaliseAvailabilityRecord(rec);
                                merged.push(rec);
                            } else {
                                // Create a blank placeholder for this club
                                var blank = buildBlankAvailability(cid, cname);
                                normaliseAvailabilityRecord(blank);
                                merged.push(blank);
                            }
                        });

                        if (!merged.length) return finishLoad();

                        vm.available_times = merged;
                        vm.selected_club   = vm.available_times[0];
                        vm.available_time   = vm.available_times[0];

                        if (!vm.available_time.availability_mode) {
                            vm.available_time.availability_mode = 'regular';
                        }

                        finishLoad();
                        loadAdhocDates();
                    });
            });
    }

    // Fallback: load from availability endpoint only (legacy behaviour)
    function loadAvailabilityOnly() {
        InstructorService.GetAvailability(vm.user_id)
            .then(function(data) {
                if (failed(data)) return finishLoad(true);
                if (!data || !data.length) return finishLoad();

                var valid = data.filter(function(rec) {
                    return rec && rec.club_id && rec.club_name;
                });
                if (!valid.length) return finishLoad();

                for (var i = 0; i < valid.length; i++) {
                    valid[i].club_id = parseInt(valid[i].club_id, 10);
                    normaliseAvailabilityRecord(valid[i]);
                }

                vm.available_times = valid;
                vm.selected_club   = vm.available_times[0];
                vm.available_time   = vm.available_times[0];

                if (!vm.available_time.availability_mode) {
                    vm.available_time.availability_mode = 'regular';
                }

                finishLoad();
                loadAdhocDates();
            });
    }

    // Build a blank availability record for a club that has no saved data yet
    function buildBlankAvailability(clubId, clubName) {
        return {
            club_id:            clubId,
            club_name:          clubName,
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

    function normaliseAvailabilityRecord(rec) {
        var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        var fromDefault = new Date(); fromDefault.setHours(9, 0, 0, 0);
        var toDefault   = new Date(); toDefault.setHours(18, 0, 0, 0);

        dayNames.forEach(function(d) {
            var fk = d + '_from_time';
            var tk = d + '_to_time';
            var dk = d + '_disabled';

            // If from == to, reset to defaults
            if (rec[fk] === rec[tk]) {
                rec[fk] = angular.copy(fromDefault);
                rec[tk] = angular.copy(toDefault);
            } else {
                rec[fk] = parseISOTime(rec[fk]);
                rec[tk] = parseISOTime(rec[tk]);
            }
            rec[dk] = parseInt(rec[dk]) || 0;
        });
    }

    function parseISOTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return timeStr;
        try {
            return new Date(luxon.DateTime.fromISO('2021-01-01T' + timeStr + 'Z').setZone('UTC').toHTTP());
        } catch(e) {
            return new Date();
        }
    }

    function saveScheduleToBackend(callback) {
        // Build clean payload with HH:MM time strings and user_id + club_id for the URL
        var rec = vm.available_time;
        var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        var payload = {
            user_id:           vm.user_id,
            club_id:           parseInt(rec.club_id, 10),
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
                if (failed(data)) { if (callback) callback(data); return; }
                // Update the record in-place (don't mutate the array reference)
                var targetId = parseInt(rec.club_id, 10);
                for (var i = 0; i < vm.available_times.length; i++) {
                    if (parseInt(vm.available_times[i].club_id, 10) === targetId) {
                        vm.available_times[i] = vm.available_time;
                        break;
                    }
                }
                if (callback) callback(data);
            });
    }

    function dateToTimeStr(val) {
        if (!val) return '00:00';
        if (val instanceof Date) {
            return padTime(val.getHours()) + ':' + padTime(val.getMinutes());
        }
        return String(val);
    }

    function loadAdhocDates() {
        if (!vm.available_time) return;
        vm.loadingAdhoc = true;
        AdhocAvailabilityService.GetAll(vm.user_id)
            .then(function(data) {
                vm.loadingAdhoc = false;
                if (Array.isArray(data)) {
                    // Filter to current club (coerce to int for safe comparison)
                    var targetClubId = parseInt(vm.available_time.club_id, 10);
                    vm.adhocDates = data.filter(function(d) {
                        return parseInt(d.club_id, 10) === targetClubId;
                    });
                } else {
                    vm.adhocDates = [];
                }
            });
    }

    function loadHolidays() {
        HolidayService.GetAll(vm.user_id)
            .then(function(data) {
                if (!data || !Array.isArray(data)) {
                    vm.holidays = [];
                    return;
                }
                vm.holidays = data.map(function(h) {
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


    // ─── Helpers ─────────────────────────────────────────────────

    // A write was refused: {success:false} from a 200, or an HTTP error the services turned into
    // {success:false, message: <body>, status} (an overlapping extra date answers OVERLAP; acting as a lapsed
    // instructor answers 403).
    function failed(resp) {
        return !!resp && (resp.success === false || resp.success === 'false');
    }
    function failMessage(resp, fallback) {
        var body = resp && resp.message && typeof resp.message === 'object' ? resp.message : resp;
        var code = (body && body.error) || (resp && resp.error);
        if (code === 'OVERLAP') {
            return 'That overlaps availability you already have on that date. Change the times, or edit the existing slot.';
        }
        if ((resp && resp.status === 403) || code === 'FORBIDDEN') {
            return 'You are not a current instructor at this club, so this can\'t be changed here. Ask a club manager.';
        }
        var text = body && typeof body.message === 'string' ? body.message : (resp && typeof resp.message === 'string' ? resp.message : '');
        return text || fallback;
    }

    function formatDate(d) {
        var yyyy = d.getFullYear();
        var mm   = padTime(d.getMonth() + 1);
        var dd   = padTime(d.getDate());
        return yyyy + '-' + mm + '-' + dd;
    }

    function padTime(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function parseTimeStr(str) {
        if (!str) return new Date();
        var parts = str.split(':');
        var d = new Date();
        d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        return d;
    }

}
