app.factory('BookingSlotsService', BookingSlotsService);

    BookingSlotsService.$inject = ['$http', '$location'];
    function BookingSlotsService($http, $location) {

        var service = {};

        // ── Slot CRUD (Admin) ──
        service.GetSlots = GetSlots;
        service.GetSlotsAdmin = GetSlotsAdmin;
        service.GetSlot = GetSlot;
        service.CreateSlot = CreateSlot;
        service.UpdateSlot = UpdateSlot;
        service.DeleteSlot = DeleteSlot;
        service.SeedDefaults = SeedDefaults;

        // ── Available Slot Search ──
        service.SearchAvailableSlots = SearchAvailableSlots;

        return service;

        // ── Active slots for a club (member view) ──
        function GetSlots(clubId) {
            return $http.get('/api/v1/booking_slots/club/' + clubId).then(handleSuccess, handleError2);
        }

        // ── All slots inc inactive (admin view) ──
        function GetSlotsAdmin(clubId) {
            return $http.get('/api/v1/booking_slots/club_admin/' + clubId).then(handleSuccess, handleError2);
        }

        // ── Single slot ──
        function GetSlot(slotId) {
            return $http.get('/api/v1/booking_slots/' + slotId).then(handleSuccess, handleError2);
        }

        // ── Create ──
        function CreateSlot(slot) {
            return $http.post('/api/v1/booking_slots', slot).then(handleSuccess, handleError2);
        }

        // ── Update ──
        function UpdateSlot(slotId, data) {
            return $http.put('/api/v1/booking_slots/' + slotId, data).then(handleSuccess, handleError2);
        }

        // ── Delete ──
        function DeleteSlot(slotId) {
            return $http.delete('/api/v1/booking_slots/' + slotId).then(handleSuccess, handleError2);
        }

        // ── Seed default slot pattern ──
        function SeedDefaults(clubId) {
            return $http.post('/api/v1/booking_slots/seed_defaults', { club_id: clubId }).then(handleSuccess, handleError2);
        }

        // ── Search available slots ──
        function SearchAvailableSlots(clubId, dateFrom, numDays, params) {
            var url = '/api/v1/bookings/available_slots/' + clubId + '/' + dateFrom + '/' + numDays;
            var qs = [];
            if (params.plane_type) qs.push('plane_type=' + encodeURIComponent(params.plane_type));
            if (params.instructor_id > 0) qs.push('instructor_id=' + params.instructor_id);
            if (params.double_slot) qs.push('double_slot=1');
            if (params.user_id) qs.push('user_id=' + params.user_id);
            if (qs.length) url += '?' + qs.join('&');
            return $http.get(url).then(handleSuccess, handleError2);
        }

        // ── Handlers ──
        function handleSuccess(res) {
            return res.data;
        }

        function handleError2(res) {
            console.log("BookingSlotsService ERROR", res);
            if (res.status == 401) {
                $location.path('/login');
            }
            return { success: false, message: res.data, status: res.status };
        }
    }
