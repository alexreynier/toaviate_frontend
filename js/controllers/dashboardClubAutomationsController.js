app.controller('DashboardClubAutomationsController', DashboardClubAutomationsController);

DashboardClubAutomationsController.$inject = ['$rootScope', '$scope', '$state', '$window', 'ToastService', 'ClubAutomationsService'];
function DashboardClubAutomationsController($rootScope, $scope, $state, $window, ToastService, ClubAutomationsService) {
    var vm = this;

    vm.user = $rootScope.globals.currentUser;
    vm.club_id = vm.user && vm.user.current_club_admin ? vm.user.current_club_admin.id : null;
    vm.is_super_admin = !!(vm.user && vm.user.access && vm.user.access.super_admin && vm.user.access.super_admin.indexOf(vm.club_id) > -1);

    vm.loading = true;
    vm.refreshing = false;
    vm.error = null;
    vm.last_refreshed = null;
    vm.schedules = [];
    vm.system_endpoints = [];
    vm.timezones = [];
    vm.timezones_loading = false;
    vm.timezones_error = null;

    vm.stats = { total: 0, enabled: 0, disabled: 0, dirty: 0, system: 0 };

    vm.hourOptions = buildHourOptions();
    vm.minuteOptions = buildMinuteOptions();

    vm.refreshSchedules = refreshSchedules;
    vm.isDirty = isDirty;
    vm.saveSchedule = saveSchedule;
    vm.onScheduleEdit = onScheduleEdit;
    vm.formatHour = formatHour;
    vm.formatMinute = formatMinute;
    vm.formatLastRun = formatLastRun;
    vm.formatNextRun = formatNextRun;
    vm.formatOutcome = formatOutcome;
    vm.getOutcomeClass = getOutcomeClass;
    vm.getSystemCadence = getSystemCadence;

    if (vm.is_super_admin && vm.club_id) {
        loadPage();
    } else {
        vm.loading = false;
    }

    $scope.$watch(function() {
        return $rootScope.globals.currentUser && $rootScope.globals.currentUser.current_club_admin
            ? $rootScope.globals.currentUser.current_club_admin.id
            : null;
    }, function(newClubId, oldClubId) {
        if (!newClubId || newClubId === oldClubId) return;
        vm.club_id = newClubId;
        vm.user = $rootScope.globals.currentUser;
        vm.is_super_admin = !!(vm.user && vm.user.access && vm.user.access.super_admin && vm.user.access.super_admin.indexOf(vm.club_id) > -1);
        if (vm.is_super_admin) {
            loadPage();
        } else {
            vm.loading = false;
            vm.schedules = [];
            vm.system_endpoints = [];
            vm.stats = { total: 0, enabled: 0, disabled: 0, dirty: 0, system: 0 };
        }
    });

    function loadPage() {
        vm.loading = true;
        vm.error = null;
        vm.timezones_error = null;
        loadTimezones();
        loadSchedules();
    }

    function refreshSchedules() {
        loadSchedules(true);
    }

    function loadSchedules(isRefresh) {
        if (!vm.club_id) return;

        if (isRefresh) {
            vm.refreshing = true;
        } else {
            vm.loading = true;
        }
        vm.error = null;

        ClubAutomationsService.GetClubSchedules(vm.club_id).then(function(data) {
            if (data && data.success) {
                vm.schedules = (data.schedules || []).map(normaliseSchedule);
                vm.system_endpoints = normaliseSystemEndpoints(data.system_endpoints || {});
                vm.last_refreshed = new Date();
                computeStats();
                vm.schedules.forEach(function(schedule) {
                    onScheduleEdit(schedule, true);
                });
            } else {
                handleLoadError(data, 'Failed to load automation schedules.');
            }
        }).catch(function() {
            vm.error = 'An unexpected error occurred while loading the automation schedules.';
        }).finally(function() {
            vm.loading = false;
            vm.refreshing = false;
        });
    }

    function loadTimezones() {
        vm.timezones_loading = true;
        ClubAutomationsService.GetTimezones().then(function(data) {
            if (data && data.success) {
                vm.timezones = (data.timezones || []).slice();
            } else {
                vm.timezones_error = (data && data.message) || 'Failed to load timezones.';
            }
        }).catch(function() {
            vm.timezones_error = 'Unable to load timezone options.';
        }).finally(function() {
            vm.timezones_loading = false;
        });
    }

    function handleLoadError(data, fallbackMessage) {
        if (data && data.status === 403) {
            ToastService.error('Access denied', 'You must be a club super admin to manage automations.');
            $state.go('dashboard.manage_club.settings', null, { reload: true });
            return;
        }

        if (data && data.status === 404) {
            $window.location.reload();
            return;
        }

        vm.error = (data && data.message) || fallbackMessage;
    }

    function saveSchedule(schedule) {
        if (!schedule || !schedule.id || !vm.isDirty(schedule) || schedule._saving) return;

        schedule._saving = true;
        schedule._fieldErrors = {};
        schedule._saveError = null;

        var payload = {
            club_id: vm.club_id,
            enabled: schedule.enabled ? 1 : 0,
            run_at_hour: parseInt(schedule.run_at_hour, 10),
            run_at_minute: parseInt(schedule.run_at_minute, 10),
            timezone: schedule.timezone
        };

        ClubAutomationsService.UpdateSchedule(schedule.id, payload).then(function(data) {
            if (data && data.success) {
                ToastService.success('Saved', schedule.label + ' updated successfully.');
                loadSchedules(true);
                return;
            }

            handleSaveError(schedule, data);
        }).catch(function() {
            schedule._saveError = 'Unable to save this schedule right now.';
        }).finally(function() {
            schedule._saving = false;
        });
    }

    function handleSaveError(schedule, data) {
        if (!schedule) return;

        if (data && data.status === 403) {
            ToastService.error('Access denied', 'You must be a club super admin to manage automations.');
            $state.go('dashboard.manage_club.settings', null, { reload: true });
            return;
        }

        if (data && data.status === 404) {
            $window.location.reload();
            return;
        }

        var message = (data && data.message) || 'Failed to update schedule.';
        var lowerMessage = message.toLowerCase();
        if (lowerMessage.indexOf('timezone') > -1) {
            schedule._fieldErrors.timezone = message;
        } else if (lowerMessage.indexOf('hour') > -1) {
            schedule._fieldErrors.run_at_hour = message;
        } else if (lowerMessage.indexOf('minute') > -1) {
            schedule._fieldErrors.run_at_minute = message;
        } else {
            schedule._saveError = message;
        }
    }

    function onScheduleEdit(schedule) {
        if (!schedule) return;
        schedule._fieldErrors = schedule._fieldErrors || {};
        schedule._saveError = null;
        schedule._next_run_preview = buildNextRunPreview(schedule);
        computeStats();
    }

    function isDirty(schedule) {
        if (!schedule || !schedule._original) return false;
        return String(schedule.enabled ? 1 : 0) !== String(schedule._original.enabled ? 1 : 0) ||
            String(schedule.run_at_hour) !== String(schedule._original.run_at_hour) ||
            String(schedule.run_at_minute) !== String(schedule._original.run_at_minute) ||
            String(schedule.timezone || '') !== String(schedule._original.timezone || '');
    }

    function computeStats() {
        vm.stats = {
            total: vm.schedules.length,
            enabled: 0,
            disabled: 0,
            dirty: 0,
            system: vm.system_endpoints.length
        };

        vm.schedules.forEach(function(schedule) {
            if (schedule.enabled) {
                vm.stats.enabled++;
            } else {
                vm.stats.disabled++;
            }
            if (vm.isDirty(schedule)) {
                vm.stats.dirty++;
            }
        });
    }

    function normaliseSchedule(schedule) {
        schedule.enabled = schedule.enabled === 1 || schedule.enabled === true;
        schedule.run_at_hour = parseInt(schedule.run_at_hour, 10);
        schedule.run_at_minute = parseInt(schedule.run_at_minute, 10);
        schedule._original = makeSnapshot(schedule);
        schedule._fieldErrors = {};
        schedule._saveError = null;
        schedule._saving = false;
        schedule._next_run_preview = buildNextRunPreview(schedule);
        return schedule;
    }

    function makeSnapshot(schedule) {
        return {
            enabled: schedule.enabled ? 1 : 0,
            run_at_hour: parseInt(schedule.run_at_hour, 10),
            run_at_minute: parseInt(schedule.run_at_minute, 10),
            timezone: schedule.timezone
        };
    }

    function normaliseSystemEndpoints(endpoints) {
        var items = [];
        Object.keys(endpoints).sort().forEach(function(key) {
            var item = endpoints[key] || {};
            item.endpoint = key;
            item.cadence = getSystemCadence(key);
            items.push(item);
        });
        return items;
    }

    function getSystemCadence(endpoint) {
        if (endpoint === 'bs_sync/cron') {
            return 'Runs every 5 minutes';
        }
        return 'Fixed cadence managed by ToAviate';
    }

    function formatHour(hour) {
        return padNumber(hour);
    }

    function formatMinute(minute) {
        return padNumber(minute);
    }

    function formatLastRun(schedule) {
        var dt = parseUtcDateTime(schedule && schedule.last_triggered_at);
        if (!dt) return 'No runs yet';
        return dt.toLocal().toFormat('d LLL yyyy, HH:mm');
    }

    function formatNextRun(schedule) {
        var preview = buildNextRunPreview(schedule);
        return preview ? preview.label : 'Select a timezone to preview the next run';
    }

    function buildNextRunPreview(schedule) {
        var DateTime = getDateTime();
        if (!DateTime || !schedule || !schedule.timezone) return null;

        var zoneNow = DateTime.now().setZone(schedule.timezone);
        if (!zoneNow.isValid) return null;

        var runMoment = zoneNow.set({
            hour: parseInt(schedule.run_at_hour, 10),
            minute: parseInt(schedule.run_at_minute, 10),
            second: 0,
            millisecond: 0
        });

        if (!runMoment.isValid) return null;
        if (runMoment <= zoneNow) {
            runMoment = runMoment.plus({ days: 1 });
        }

        var localClock = runMoment.toFormat('HH:mm ZZZZ');
        var utcClock = runMoment.toUTC().toFormat('HH:mm') + ' UTC';
        var label;

        if (runMoment.hasSame(zoneNow, 'day')) {
            label = 'Today at ' + localClock + ' (' + utcClock + ')';
        } else if (runMoment.hasSame(zoneNow.plus({ days: 1 }), 'day')) {
            label = 'Tomorrow at ' + localClock + ' (' + utcClock + ')';
        } else {
            label = runMoment.toFormat('ccc d LLL yyyy') + ' at ' + localClock + ' (' + utcClock + ')';
        }

        return {
            label: label,
            local: localClock,
            utc: utcClock
        };
    }

    function formatOutcome(outcome) {
        if (outcome === 'ok') return 'Ok';
        if (outcome === 'error') return 'Error';
        if (outcome === 'triggered') return 'Triggered';
        if (outcome === 'running') return 'Running';
        return outcome || 'Unknown';
    }

    function getOutcomeClass(outcome) {
        if (outcome === 'ok') return 'automation-outcome-badge--ok';
        if (outcome === 'error') return 'automation-outcome-badge--error';
        if (outcome === 'running') return 'automation-outcome-badge--running';
        return 'automation-outcome-badge--triggered';
    }

    function parseUtcDateTime(value) {
        var DateTime = getDateTime();
        if (!DateTime || !value) return null;

        var parsed = value.indexOf('T') > -1 || value.indexOf('Z') > -1 ?
            DateTime.fromISO(value, { zone: 'utc' }) :
            DateTime.fromSQL(value, { zone: 'utc' });

        if (!parsed.isValid) {
            parsed = DateTime.fromISO(value, { zone: 'utc' });
        }

        return parsed.isValid ? parsed : null;
    }

    function getDateTime() {
        return $window.luxon && $window.luxon.DateTime ? $window.luxon.DateTime : null;
    }

    function buildHourOptions() {
        var options = [];
        for (var hour = 0; hour < 24; hour++) {
            options.push({ value: hour, label: padNumber(hour) });
        }
        return options;
    }

    function buildMinuteOptions() {
        var ordered = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
        var options = [];
        var seen = {};

        ordered.forEach(function(minute) {
            seen[minute] = true;
            options.push({ value: minute, label: padNumber(minute) });
        });

        for (var minute = 0; minute < 60; minute++) {
            if (seen[minute]) continue;
            options.push({ value: minute, label: padNumber(minute) });
        }

        return options;
    }

    function padNumber(value) {
        var numeric = parseInt(value, 10);
        if (isNaN(numeric)) return '00';
        return numeric < 10 ? '0' + numeric : String(numeric);
    }
}