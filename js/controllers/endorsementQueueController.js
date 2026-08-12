// ═══════════════════════════════════════════════════════════════════
//  EndorsementQueueController
//  Instructor → Pending signatures: logbook lines pilots have asked
//  this instructor to countersign. Sign opens the shared
//  EndorsementSignModalCtrl (drawn signature required); Decline is an
//  inline expand with an optional reason.
//  Backend contract: FRONTEND_LOGBOOK_ENDORSEMENTS_GUIDE.md §5
// ═══════════════════════════════════════════════════════════════════

app.controller('EndorsementQueueController', EndorsementQueueController);

EndorsementQueueController.$inject = ['LogbookEndorsementsService', 'ToastService', '$rootScope', '$uibModal'];
function EndorsementQueueController(LogbookEndorsementsService, ToastService, $rootScope, $uibModal) {
    var vm = this;

    vm.user = $rootScope.globals.currentUser;
    vm.loading = true;
    vm.requests = [];

    vm.openSign = openSign;
    vm.openStamp = openStamp;
    vm.askDecline = function(r) { r._declineOpen = true; r._reason = ''; };
    vm.cancelDecline = function(r) { r._declineOpen = false; };
    vm.confirmDecline = confirmDecline;

    load();

    // Manage the saved signature ("my stamp") used for one-tap signing.
    function openStamp() {
        $uibModal.open({
            templateUrl: 'views/modals/endorsement_stamp_modal.html',
            controller: 'EndorsementStampModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static',
            windowClass: 'sec-modal-window'
        }).result.then(function(changed) {
            if (changed) { ToastService.success('Stamp Updated', 'Your saved signature has been updated.'); }
        }, function() {});
    }

    function load() {
        vm.loading = true;
        LogbookEndorsementsService.Queue().then(function(data) {
            vm.loading = false;
            if (data && data.success === false) {
                ToastService.error('Could Not Load Queue', data.message || '');
                return;
            }
            vm.requests = data.requests || data.queue || [];
        });
    }

    function openSign(r) {
        $uibModal.open({
            templateUrl: 'views/modals/endorsement_sign_modal.html',
            controller: 'EndorsementSignModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static',
            size: 'lg',
            windowClass: 'sec-modal-window',
            resolve: { context: function() { return {
                mode: 'request', id: r.id, pilot_name: r.pilot_name, line: r.line }; } }
        }).result.then(function(signed) {
            if (signed) {
                ToastService.success('Signed', "The stamp is now on " + (r.pilot_name || 'the pilot') + "'s logbook.");
                load();
            }
        }, function() {});
    }

    function confirmDecline(r) {
        r._declining = true;
        LogbookEndorsementsService.Decline(r.id, (r._reason || '').trim()).then(function(data) {
            r._declining = false;
            if (data && data.success !== false) {
                ToastService.success('Declined', 'The pilot has been notified.');
                load();
            } else {
                ToastService.error('Could Not Decline', (data && data.message) || '');
            }
        });
    }
}
