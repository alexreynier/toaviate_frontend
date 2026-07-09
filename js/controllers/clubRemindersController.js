app.controller('ClubRemindersController', ClubRemindersController);

    ClubRemindersController.$inject = ['RemindersService', 'MemberService', '$rootScope', '$scope', '$timeout', 'ToastService'];
    function ClubRemindersController(RemindersService, MemberService, $rootScope, $scope, $timeout, ToastService) {

        // Club Admin → Reminders: aircraft / organisation expiry reminders
        // (ARC, CofA/Permit, maintenance, hours-to-maintenance, radio
        // licence, insurance) + who receives them. Rows auto-save.
        // Contract: FRONTEND_REMINDERS_GUIDE.md. The backend is
        // authoritative on permissions — non-managers may only edit their
        // own subscription rows.

        var vm = this;

        vm.user = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin.id;
        vm.is_manager = vm.user.access.manager.indexOf(vm.club_id) > -1;

        vm.loading = true;
        vm.load_failed = false;
        vm.load_failed_message = '';
        vm.settings = [];
        vm.people = [];
        vm.saving = {};        // reminder_type → true while a settings save is in flight
        vm.savedFlash = {};    // reminder_type → true briefly after a save
        vm.rowBusy = {};       // recipient row id → true while saving

        // Add-recipient panel
        vm.addOpen = false;
        vm.members = null;
        vm.membersLoading = false;
        vm.memberSearch = '';
        vm.addForm = { member: null, all: false, types: {} };
        vm.adding = false;

        // Preview + history
        vm.previewLoading = false;
        vm.preview = null;
        vm.historyOpen = false;
        vm.historyLoading = false;
        vm.history = null;

        vm.typeIcon = typeIcon;
        vm.chipLabel = chipLabel;
        vm.typeLabel = typeLabel;
        vm.unitFor = unitFor;
        vm.toggleSetting = toggleSetting;
        vm.removeSettingOffset = removeSettingOffset;
        vm.addSettingOffset = addSettingOffset;
        vm.resetSettingToDefault = resetSettingToDefault;

        vm.canEditRow = canEditRow;
        vm.toggleRecipientRow = toggleRecipientRow;
        vm.startCustomTimeline = startCustomTimeline;
        vm.removeOverrideOffset = removeOverrideOffset;
        vm.addOverrideOffset = addOverrideOffset;
        vm.inheritClubTimeline = inheritClubTimeline;
        vm.removeRecipientRow = removeRecipientRow;

        vm.openAdd = openAdd;
        vm.selectMember = selectMember;
        vm.submitAdd = submitAdd;
        vm.filterMembers = filterMembers;

        vm.runPreview = runPreview;
        vm.toggleHistory = toggleHistory;

        activate();

        function activate() {
            RemindersService.GetClubSettings(vm.club_id).then(function (data) {
                vm.loading = false;
                if (data && data.success) {
                    applyPayload(data);
                } else {
                    vm.load_failed = true;
                    vm.load_failed_message = (data && data.message) || 'We could not load the reminder settings.';
                }
            });
        }

        function applyPayload(data) {
            if (data.settings) {
                for (var i = 0; i < data.settings.length; i++) {
                    data.settings[i].offsets = sortDesc(data.settings[i].offsets || []);
                    data.settings[i].newOffset = '';
                }
                vm.settings = data.settings;
            }
            if (data.recipients) {
                applyRecipients(data.recipients);
            }
        }

        // Rows arrive one-per-person-per-type — group them by person.
        // offsets_override is a CSV string ("14,3") or null (= inherit).
        function applyRecipients(rows) {
            var byUser = {};
            var people = [];
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                row.override_arr = parseOverride(row.offsets_override);
                row.editingTimeline = row.override_arr !== null;
                row.newOffset = '';
                if (!byUser[row.user_id]) {
                    byUser[row.user_id] = {
                        user_id: row.user_id,
                        first_name: row.first_name,
                        last_name: row.last_name,
                        email: row.email,
                        rows: []
                    };
                    people.push(byUser[row.user_id]);
                }
                byUser[row.user_id].rows.push(row);
            }
            people.sort(function (a, b) {
                return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name);
            });
            vm.people = people;
        }

        function parseOverride(csv) {
            if (csv === null || csv === undefined || csv === '') { return null; }
            var out = [];
            var bits = String(csv).split(',');
            for (var i = 0; i < bits.length; i++) {
                var n = parseInt(bits[i], 10);
                if (!isNaN(n)) { out.push(n); }
            }
            return sortDesc(out);
        }

        function sortDesc(arr) {
            return arr.slice().sort(function (a, b) { return b - a; });
        }

        function maxFor(unit) { return unit === 'hours' ? 500 : 365; }

        function settingFor(type) {
            for (var i = 0; i < vm.settings.length; i++) {
                if (vm.settings[i].reminder_type === type) { return vm.settings[i]; }
            }
            return null;
        }

        // ── Club-level settings (manager only) ──

        function toggleSetting(setting) {
            if (!vm.is_manager) { return; }
            setting.enabled = setting.enabled ? 0 : 1;
            saveSetting(setting, false);
        }

        function removeSettingOffset(setting, index) {
            if (setting.offsets.length <= 1) {
                ToastService.warning('At Least One Reminder', 'Keep at least one reminder time — or turn this reminder off with the switch instead.');
                return;
            }
            setting.offsets.splice(index, 1);
            saveSetting(setting, true);
        }

        function addSettingOffset(setting) {
            var max = maxFor(setting.unit);
            var value = parseInt(setting.newOffset, 10);
            if (isNaN(value) || value < 0 || value > max || String(setting.newOffset).indexOf('.') > -1) {
                ToastService.warning('Invalid Value', 'Values must be whole numbers between 0 and ' + max + ' ' + (setting.unit || 'days') + '.');
                return;
            }
            if (setting.offsets.indexOf(value) > -1) { setting.newOffset = ''; return; }
            if (setting.offsets.length >= 8) {
                ToastService.warning('Maximum Reached', 'You can have up to 8 reminder times per item.');
                return;
            }
            setting.offsets.push(value);
            setting.offsets = sortDesc(setting.offsets);
            setting.newOffset = '';
            saveSetting(setting, true);
        }

        function resetSettingToDefault(setting) {
            setting.offsets = sortDesc(setting.default_offsets || []);
            saveSetting(setting, true);
        }

        // Omitting `offsets` in the PUT resets the type to defaults
        // server-side — always send them unless the row is on defaults.
        function saveSetting(setting, offsetsChanged) {
            var change = { reminder_type: setting.reminder_type, enabled: setting.enabled };
            if (offsetsChanged || !setting.is_default) {
                change.offsets = setting.offsets;
            }
            vm.saving[setting.reminder_type] = true;
            RemindersService.SaveClubSettings(vm.club_id, [change]).then(function (data) {
                vm.saving[setting.reminder_type] = false;
                if (data && data.success) {
                    applyPayload(data);
                    flashSaved(setting.reminder_type);
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'That change could not be saved — please try again.');
                    activate();
                }
            });
        }

        function flashSaved(type) {
            vm.savedFlash[type] = true;
            $timeout(function () { vm.savedFlash[type] = false; }, 1600);
        }

        // ── Recipients ──

        // By product decision (2026-07) club reminders are managed by club
        // admins only — members who want to stop receiving them ask their
        // admin, so there is no recipient self-editing here.
        function canEditRow(row) {
            return vm.is_manager;
        }

        function toggleRecipientRow(row) {
            if (!canEditRow(row)) { return; }
            var newVal = row.enabled ? 0 : 1;
            updateRow(row, { enabled: newVal }, function () { row.enabled = newVal; });
        }

        function startCustomTimeline(row) {
            if (!canEditRow(row)) { return; }
            var setting = settingFor(row.reminder_type);
            row.override_arr = sortDesc((setting && setting.offsets) || []).slice();
            row.editingTimeline = true;
            updateRow(row, { offsets_override: row.override_arr });
        }

        function removeOverrideOffset(row, index) {
            if (row.override_arr.length <= 1) {
                ToastService.warning('At Least One Reminder', 'Keep at least one time — or switch back to the club timeline.');
                return;
            }
            row.override_arr.splice(index, 1);
            updateRow(row, { offsets_override: row.override_arr });
        }

        function addOverrideOffset(row) {
            var setting = settingFor(row.reminder_type);
            var max = maxFor(setting && setting.unit);
            var value = parseInt(row.newOffset, 10);
            if (isNaN(value) || value < 0 || value > max || String(row.newOffset).indexOf('.') > -1) {
                ToastService.warning('Invalid Value', 'Values must be whole numbers between 0 and ' + max + ' ' + ((setting && setting.unit) || 'days') + '.');
                return;
            }
            if (row.override_arr.indexOf(value) > -1) { row.newOffset = ''; return; }
            if (row.override_arr.length >= 8) {
                ToastService.warning('Maximum Reached', 'You can have up to 8 reminder times.');
                return;
            }
            row.override_arr.push(value);
            row.override_arr = sortDesc(row.override_arr);
            row.newOffset = '';
            updateRow(row, { offsets_override: row.override_arr });
        }

        function inheritClubTimeline(row) {
            if (!canEditRow(row)) { return; }
            updateRow(row, { offsets_override: null }, function () {
                row.override_arr = null;
                row.editingTimeline = false;
            });
        }

        function updateRow(row, changes, onSuccess) {
            vm.rowBusy[row.id] = true;
            RemindersService.UpdateRecipient(vm.club_id, row.id, changes).then(function (data) {
                vm.rowBusy[row.id] = false;
                if (data && data.success) {
                    if (onSuccess) { onSuccess(); }
                    if (data.recipients) { applyRecipients(data.recipients); }
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'That change could not be saved — please try again.');
                    activate();
                }
            });
        }

        function removeRecipientRow(person, row) {
            if (!vm.is_manager) { return; }
            vm.rowBusy[row.id] = true;
            RemindersService.DeleteRecipient(vm.club_id, row.id).then(function (data) {
                vm.rowBusy[row.id] = false;
                if (data && data.success) {
                    applyRecipients(data.recipients || []);
                    ToastService.success('Removed', person.first_name + ' will no longer receive ' + typeLabel(row.reminder_type) + ' reminders.');
                } else {
                    ToastService.error('Not Removed', (data && data.message) || 'Please try again.');
                }
            });
        }

        // ── Add a recipient ──

        function openAdd() {
            vm.addOpen = !vm.addOpen;
            vm.addForm = { member: null, all: false, types: {} };
            vm.memberSearch = '';
            if (vm.addOpen && vm.members === null && !vm.membersLoading) {
                vm.membersLoading = true;
                MemberService.GetAllByClub(vm.club_id).then(function (data) {
                    vm.membersLoading = false;
                    vm.members = (data && data.members) || (data && data.items) || [];
                });
            }
        }

        function selectMember(member) {
            vm.addForm.member = member;
        }

        function filterMembers(member) {
            if (!vm.memberSearch) { return true; }
            var needle = vm.memberSearch.toLowerCase();
            var hay = ((member.first_name || '') + ' ' + (member.last_name || '') + ' ' + (member.email || '')).toLowerCase();
            return hay.indexOf(needle) > -1;
        }

        function submitAdd() {
            if (!vm.addForm.member) {
                ToastService.warning('Pick a Member', 'Please choose who should receive the reminders.');
                return;
            }
            var types;
            if (vm.addForm.all) {
                types = 'all';
            } else {
                types = [];
                for (var key in vm.addForm.types) {
                    if (vm.addForm.types.hasOwnProperty(key) && vm.addForm.types[key]) { types.push(key); }
                }
                if (!types.length) {
                    ToastService.warning('Pick Reminder Types', 'Choose at least one reminder type, or tick "All reminders".');
                    return;
                }
            }

            var user_id = vm.addForm.member.user_id || vm.addForm.member.id;
            vm.adding = true;
            RemindersService.AddRecipient(vm.club_id, user_id, types).then(function (data) {
                vm.adding = false;
                if (data && data.success) {
                    applyRecipients(data.recipients || []);
                    vm.addOpen = false;
                    ToastService.success('Recipient Added', vm.addForm.member.first_name + ' will now receive the selected reminders.');
                } else {
                    ToastService.error('Not Added', (data && data.message) || 'Please try again.');
                }
            });
        }

        // ── Preview ("what would go out today?") ──

        function runPreview() {
            if (vm.previewLoading) { return; }
            vm.previewLoading = true;
            vm.preview = null;
            RemindersService.RunOrgPreview(vm.club_id).then(function (data) {
                vm.previewLoading = false;
                if (data && data.success) {
                    data.recipients = data.recipients || [];
                    vm.preview = data;
                } else {
                    ToastService.error('Preview Failed', (data && data.message) || 'Please try again.');
                }
            });
        }

        // ── History ──

        function toggleHistory() {
            vm.historyOpen = !vm.historyOpen;
            if (vm.historyOpen && vm.history === null && !vm.historyLoading) {
                vm.historyLoading = true;
                RemindersService.GetClubHistory(vm.club_id, 100).then(function (data) {
                    vm.historyLoading = false;
                    vm.history = (data && data.success && data.rows) ? data.rows : [];
                });
            }
        }

        // ── Presentation helpers ──

        function typeLabel(type) {
            var setting = settingFor(type);
            return setting ? setting.label : type;
        }

        function unitFor(type) {
            var setting = settingFor(type);
            return (setting && setting.unit) || 'days';
        }

        function typeIcon(type) {
            switch (type) {
                case 'aircraft_arc':           return 'fa-clipboard-check';
                case 'aircraft_certificate':   return 'fa-file-contract';
                case 'aircraft_maintenance':   return 'fa-wrench';
                case 'aircraft_hours':         return 'fa-tachometer-alt';
                case 'aircraft_radio_licence': return 'fa-broadcast-tower';
                case 'aircraft_insurance':     return 'fa-umbrella';
                default:                       return 'fa-bell';
            }
        }

        // "30 days before" / "on the day" / "5 hrs remaining"
        function chipLabel(value, unit) {
            if (unit === 'hours') {
                return value + (value == 1 ? ' hour' : ' hrs') + ' remaining';
            }
            if (value === 0) { return 'on the day'; }
            if (value === 1) { return '1 day before'; }
            return value + ' days before';
        }
    }
