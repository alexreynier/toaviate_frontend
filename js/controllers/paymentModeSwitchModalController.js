 app.controller('PaymentModeSwitchModalCtrl', PaymentModeSwitchModalCtrl);

    PaymentModeSwitchModalCtrl.$inject = ['$uibModalInstance', 'status', 'club_name', 'PaymentModeService', 'ToastService'];
    function PaymentModeSwitchModalCtrl($uibModalInstance, status, club_name, PaymentModeService, ToastService) {
        var vm = this;

        vm.status = status || {};
        vm.club_name = club_name || 'this club';
        vm.club_id = vm.status.club_id;

        // The mode we are switching TO. Backend supplies target_mode; fall back to the
        // opposite of the current mode if it's missing.
        vm.target_mode = vm.status.target_mode ||
            (vm.status.payment_mode === 'live' ? 'sandbox' : 'live');

        vm.target_label = (vm.target_mode || '').toUpperCase();
        vm.is_live_target = vm.target_mode === 'live';

        // Switching back to a mode we've used before can restore previously-saved details.
        vm.has_archive = !!vm.status.target_mode_has_archive;

        vm.members_with_saved_card = vm.status.members_with_saved_card || 0;
        vm.members_with_direct_debit = vm.status.members_with_direct_debit || 0;

        // Typed-confirmation phrase the user must enter exactly.
        vm.confirm_phrase = 'SWITCH TO ' + vm.target_label;
        vm.confirm_text = '';
        vm.note = '';
        vm.submitting = false;

        // Action button is enabled only when the typed text matches exactly.
        vm.canSubmit = function() {
            return !vm.submitting && vm.confirm_text === vm.confirm_phrase;
        };

        vm.confirm = function() {
            if (!vm.canSubmit()) { return; }

            vm.submitting = true;

            var body = {
                to_mode: vm.target_mode,
                confirm: true,
                note: vm.note || null
            };

            PaymentModeService.Switch(vm.club_id, body).then(function(data) {
                if (data && data.success) {
                    $uibModalInstance.close(data);
                    return;
                }

                // All failure shapes come back as HTTP 200 with success:false.
                vm.submitting = false;

                if (data && data.code === 'forbidden') {
                    ToastService.error('Not Allowed', 'Only ToAviate staff can change a club\'s payment mode.');
                    return;
                }

                var msg = (data && (data.error || (data.message && data.message.error))) ||
                    'The payment mode could not be switched. Please try again.';
                ToastService.error('Switch Failed', msg);
            });
        };

        vm.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    }
