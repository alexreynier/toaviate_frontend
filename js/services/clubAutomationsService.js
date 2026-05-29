app.factory('ClubAutomationsService', ClubAutomationsService);

ClubAutomationsService.$inject = ['$http'];
function ClubAutomationsService($http) {
    var service = {};

    service.GetClubSchedules = GetClubSchedules;
    service.GetTimezones = GetTimezones;
    service.UpdateSchedule = UpdateSchedule;

    var cachedTimezonesPromise = null;

    return service;

    function GetClubSchedules(clubId) {
        return $http.get('/api/v1/cron_schedules/club/' + clubId)
            .then(handleSuccess, handleError);
    }

    function GetTimezones() {
        if (!cachedTimezonesPromise) {
            cachedTimezonesPromise = $http.get('/api/v1/cron_schedules/timezones')
                .then(handleSuccess, handleError);
        }
        return cachedTimezonesPromise;
    }

    function UpdateSchedule(scheduleId, payload) {
        return $http.put('/api/v1/cron_schedules/' + scheduleId, payload)
            .then(handleSuccess, handleError);
    }

    function handleSuccess(res) {
        return res.data;
    }

    function handleError(res) {
        return {
            success: false,
            message: (res.data && res.data.message) || 'Request failed.',
            status: res.status
        };
    }
}