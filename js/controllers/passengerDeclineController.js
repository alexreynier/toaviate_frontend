// ═══════════════════════════════════════════════════════════════════
//  PassengerDeclineController — public "can't make it" page.
//  /passenger_decline/:token — the link in every passenger invitation
//  email. GET only SHOWS the flight (who invited them, aircraft, when);
//  the invitation is declined by the explicit POST behind the button —
//  mail scanners prefetch links, so the GET must never act.
//  MUST work with no session: no $rootScope.globals access here; the
//  passenger_decline endpoints are exempted from the auth interceptor
//  (app.js unauthEndpoints) and from auth/Api-Key on the backend.
//  ANY failure renders the one uniform "invalid or expired" panel.
//  Backend: Invitations::decline_preview_by_token / decline_by_token.
// ═══════════════════════════════════════════════════════════════════

app.controller('PassengerDeclineController', PassengerDeclineController);

PassengerDeclineController.$inject = ['$stateParams', 'BookingService'];
function PassengerDeclineController($stateParams, BookingService) {
    var vm = this;
    var token = $stateParams.token;

    vm.state = 'loading';       // loading | summary | already | done | invalid
    vm.flight = null;           // {first_name, pilot_name, registration, club_title, whenLabel}
    vm.busy = false;
    vm.decline = decline;

    load();

    function load() {
        if (!token) { vm.state = 'invalid'; return; }
        BookingService.PassengerDeclineGet(token).then(function (data) {
            if (!data || data.success !== true) { vm.state = 'invalid'; return; }
            vm.flight = {
                first_name: data.first_name || '',
                pilot_name: String(data.pilot_name || '').trim() || 'the pilot',
                registration: data.registration || '',
                club_title: String(data.club_title || '').trim(),   // stored titles can carry a trailing space ("THE PILOT CENTRE ")
                whenLabel: whenLabel(data.start, data.end)
            };
            vm.state = data.already_declined ? 'already' : 'summary';
        });
    }

    function decline() {
        if (vm.busy) { return; }
        vm.busy = true;
        BookingService.PassengerDeclinePost(token).then(function (data) {
            vm.busy = false;
            vm.state = (data && data.success === true) ? 'done' : 'invalid';
        });
    }

    // "Wednesday 6 January 2027, 10:00 – 11:00" (club local time: the strings are wall-clock, never shifted)
    function whenLabel(start, end) {
        if (!start) { return ''; }
        var s = String(start).replace('T', ' '), e = end ? String(end).replace('T', ' ') : '';
        if (typeof moment === 'function') {
            var ms = moment(s.slice(0, 16), 'YYYY-MM-DD HH:mm');
            if (ms.isValid()) {
                var out = ms.format('dddd D MMMM YYYY, HH:mm');
                if (e) { var me = moment(e.slice(0, 16), 'YYYY-MM-DD HH:mm'); if (me.isValid()) { out += ' – ' + me.format('HH:mm'); } }
                return out;
            }
        }
        return s.slice(0, 16);
    }
}
