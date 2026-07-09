app.controller('RemindersController', RemindersController);

    RemindersController.$inject = ['RemindersService', '$rootScope', '$scope', '$timeout', 'ToastService'];
    function RemindersController(RemindersService, $rootScope, $scope, $timeout, ToastService) {

        // Account Settings → Reminders: the user's own expiry-reminder
        // emails (medical, licence, rating, membership, card, proof of ID,
        // qualifications). Each row auto-saves as it is changed.
        // Contract: FRONTEND_REMINDERS_GUIDE.md.

        var vm = this;

        vm.user = $rootScope.globals.currentUser;

        vm.loading = true;
        vm.load_failed = false;
        vm.preferences = [];
        vm.saving = {};        // reminder_type → true while a save is in flight
        vm.savedFlash = {};    // reminder_type → true briefly after a save

        vm.historyOpen = false;
        vm.historyLoading = false;
        vm.history = null;

        vm.typeIcon = typeIcon;
        vm.typeHint = typeHint;
        vm.toggleType = toggleType;
        vm.removeOffset = removeOffset;
        vm.addOffset = addOffset;
        vm.resetToDefault = resetToDefault;
        vm.toggleHistory = toggleHistory;
        vm.historyLabel = historyLabel;

        activate();

        function activate() {
            RemindersService.GetPreferences().then(function (data) {
                vm.loading = false;
                if (data && data.success && data.preferences) {
                    applyPreferences(data.preferences);
                } else {
                    vm.load_failed = true;
                    ToastService.error('Reminders Unavailable', (data && data.message) || 'We could not load your reminder settings. Please try again.');
                }
            });
        }

        function applyPreferences(preferences) {
            // Sort each type's offsets descending for display; keep any
            // in-flight "new offset" inputs empty.
            for (var i = 0; i < preferences.length; i++) {
                preferences[i].offsets_days = sortDesc(preferences[i].offsets_days || []);
                preferences[i].newOffset = '';
            }
            vm.preferences = preferences;
        }

        function sortDesc(arr) {
            return arr.slice().sort(function (a, b) { return b - a; });
        }

        // ── Row actions (each auto-saves) ──

        function toggleType(pref) {
            pref.enabled = pref.enabled ? 0 : 1;
            savePref(pref, false);
        }

        function removeOffset(pref, index) {
            if (pref.offsets_days.length <= 1) {
                ToastService.warning('At Least One Reminder', 'Keep at least one reminder time — or turn this reminder off with the switch instead.');
                return;
            }
            pref.offsets_days.splice(index, 1);
            savePref(pref, true);
        }

        function addOffset(pref) {
            var value = parseInt(pref.newOffset, 10);
            if (isNaN(value) || value < 0 || value > 365 || String(pref.newOffset).indexOf('.') > -1) {
                ToastService.warning('Invalid Value', 'Reminder times must be whole numbers between 0 and 365 days.');
                return;
            }
            if (pref.offsets_days.indexOf(value) > -1) {
                pref.newOffset = '';
                return; // already there — nothing to do
            }
            if (pref.offsets_days.length >= 8) {
                ToastService.warning('Maximum Reached', 'You can have up to 8 reminder times per item.');
                return;
            }
            pref.offsets_days.push(value);
            pref.offsets_days = sortDesc(pref.offsets_days);
            pref.newOffset = '';
            savePref(pref, true);
        }

        function resetToDefault(pref) {
            pref.offsets_days = sortDesc(pref.default_offsets || []);
            savePref(pref, true);
        }

        // NB: omitting offsets_days in the PUT resets that type to its
        // defaults server-side — so we always send the current offsets
        // unless the row is (and should stay) on the default timeline.
        function savePref(pref, offsetsChanged) {
            var change = { reminder_type: pref.reminder_type, enabled: pref.enabled };
            if (offsetsChanged || !pref.is_default) {
                change.offsets_days = pref.offsets_days;
            }

            vm.saving[pref.reminder_type] = true;
            RemindersService.SavePreferences([change]).then(function (data) {
                vm.saving[pref.reminder_type] = false;
                if (data && data.success && data.preferences) {
                    applyPreferences(data.preferences);
                    flashSaved(pref.reminder_type);
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'That change could not be saved — please try again.');
                    activate(); // re-sync with the server's actual state
                }
            });
        }

        function flashSaved(type) {
            vm.savedFlash[type] = true;
            $timeout(function () { vm.savedFlash[type] = false; }, 1600);
        }

        // ── History ──

        function toggleHistory() {
            vm.historyOpen = !vm.historyOpen;
            if (vm.historyOpen && vm.history === null && !vm.historyLoading) {
                vm.historyLoading = true;
                RemindersService.GetHistory(30).then(function (data) {
                    vm.historyLoading = false;
                    vm.history = (data && data.success && data.rows) ? data.rows : [];
                });
            }
        }

        function historyLabel(type) {
            for (var i = 0; i < vm.preferences.length; i++) {
                if (vm.preferences[i].reminder_type === type) { return vm.preferences[i].label; }
            }
            return type;
        }

        // ── Presentation helpers ──

        function typeIcon(type) {
            switch (type) {
                case 'medical':       return 'fa-medkit';
                case 'licence':       return 'fa-certificate';
                case 'rating':        return 'fa-star';
                case 'membership':    return 'fa-id-card';
                case 'card':          return 'fa-credit-card';
                case 'poid':          return 'fa-passport';
                case 'qualification': return 'fa-graduation-cap';
                default:              return 'fa-bell';
            }
        }

        function typeHint(type) {
            if (type === 'membership') {
                return "Only memberships that don't auto-renew get reminder emails — auto-renewing memberships renew automatically.";
            }
            if (type === 'card') {
                return "We remind you before the end of the card's expiry month.";
            }
            return '';
        }
    }
