// <member-email-prefs member-id="vm.member_id"></member-email-prefs>
//
// Manage Member → Email preferences (club admin) — and the same component serves
// the member themselves (the API answers with via:'self').
// Contract: FRONTEND_EMAIL_LOG_AND_PREFERENCES_GUIDE.md §2.
//
// Everything is staged locally and saved in ONE PUT containing only the fields the
// admin touched (+ an optional audit note); the response bundle then resets the
// switches, so the screen never trusts its own optimistic state.
app.directive('memberEmailPrefs', function() {
    return {
        restrict: 'E',
        scope: { memberId: '=' },
        templateUrl: 'views/manageclub/_member_email_prefs.html',
        controller: 'MemberEmailPrefsController',
        controllerAs: 'ep',
        bindToController: true
    };
});

app.controller('MemberEmailPrefsController', MemberEmailPrefsController);

    MemberEmailPrefsController.$inject = ['EmailLogService', '$scope', '$timeout', 'ToastService'];
    function MemberEmailPrefsController(EmailLogService, $scope, $timeout, ToastService) {
        var ep = this;

        // Switch semantics — "ON" always means "receives it" (guide §2 table).
        var SWITCHES = [
            { key: 'mute_booking_reminders',   inverted: true,  instructorOnly: false, icon: 'fa-calendar-check',
              label: 'Booking reminders',           desc: 'Same-day and day-ahead reminders for their own bookings.' },
            { key: 'instructor_daily_summary', inverted: false, instructorOnly: true,  icon: 'fa-list-alt',
              label: 'Daily schedule summary',      desc: 'One combined email each evening listing tomorrow\'s bookings.' },
            { key: 'mute_booking_emails',      inverted: true,  instructorOnly: true,  icon: 'fa-envelope',
              label: 'Instant "new booking" emails', desc: 'An email each time a student books a lesson with them.' },
            { key: 'mute_assignment_emails',   inverted: true,  instructorOnly: false, icon: 'fa-book-open',
              label: 'Course material shared with me', desc: 'An email when an instructor shares lesson content.' }
        ];

        ep.loading = true;
        ep.failed = false;
        ep.failed_message = '';
        ep.saving = false;
        ep.saved = false;
        ep.bundle = null;      // last response from the API
        ep.member = null;
        ep.master = null;
        ep.muteAll = false;
        ep.switches = [];      // [{key, label, desc, icon, on}]
        ep.reminders = [];     // reminder_preferences with chips
        ep.note = '';
        ep.touched = {};       // field → true (only these go in the PUT)
        ep.touchedReminders = {};
        ep.recentOpen = false;
        ep.historyOpen = false;

        ep.toggleMaster = toggleMaster;
        ep.toggleSwitch = toggleSwitch;
        ep.toggleReminder = toggleReminder;
        ep.removeOffset = removeOffset;
        ep.addOffset = addOffset;
        ep.resetOffsets = resetOffsets;
        ep.isDirty = isDirty;
        ep.discard = discard;
        ep.save = save;
        ep.reload = load;
        ep.typeIcon = typeIcon;
        ep.statusIcon = statusIcon;
        ep.changeText = changeText;
        ep.changedBy = changedBy;

        $scope.$watch('ep.memberId', function(id) { if (id) { load(); } });

        function load() {
            if (!ep.memberId) { return; }
            ep.loading = true;
            ep.failed = false;
            EmailLogService.GetMemberPreferences(ep.memberId).then(function(data) {
                ep.loading = false;
                if (data && data.success) {
                    apply(data);
                } else {
                    ep.failed = true;
                    ep.failed_message = (data && data.message) || 'We could not load this member\'s email preferences.';
                }
            });
        }

        function apply(bundle) {
            ep.bundle = bundle;
            ep.member = bundle.member || {};
            ep.master = bundle.master || {};
            ep.muteAll = ep.master.mute_all_notifications == 1;
            ep.switches = [];
            for (var i = 0; i < SWITCHES.length; i++) {
                var def = SWITCHES[i];
                if (def.instructorOnly && ep.member.instructor != 1) { continue; }
                var raw = ep.member[def.key];
                ep.switches.push({
                    key: def.key, label: def.label, desc: def.desc, icon: def.icon, inverted: def.inverted,
                    on: def.inverted ? (raw == 0) : (raw == 1)
                });
            }
            var prefs = bundle.reminder_preferences || [];
            for (var j = 0; j < prefs.length; j++) {
                prefs[j].offsets_days = (prefs[j].offsets_days || []).slice().sort(function(a, b) { return b - a; });
                prefs[j].newOffset = '';
            }
            ep.reminders = prefs;
            ep.touched = {};
            ep.touchedReminders = {};
            ep.note = '';
        }

        // ── Staging ──

        function toggleMaster() {
            ep.muteAll = !ep.muteAll;
            ep.touched.mute_all_notifications = true;
        }

        function toggleSwitch(sw) {
            sw.on = !sw.on;
            ep.touched[sw.key] = true;
        }

        function toggleReminder(pref) {
            pref.enabled = pref.enabled == 1 ? 0 : 1;
            ep.touchedReminders[pref.reminder_type] = true;
        }

        function removeOffset(pref, index) {
            if (pref.offsets_days.length <= 1) {
                ToastService.warning('At Least One Reminder', 'Keep at least one reminder time — or turn this reminder off with the switch instead.');
                return;
            }
            pref.offsets_days.splice(index, 1);
            ep.touchedReminders[pref.reminder_type] = true;
        }

        function addOffset(pref) {
            var value = parseInt(pref.newOffset, 10);
            if (isNaN(value) || value < 0 || value > 365 || String(pref.newOffset).indexOf('.') > -1) {
                ToastService.warning('Invalid Value', 'Reminder times must be whole numbers between 0 and 365 days.');
                return;
            }
            if (pref.offsets_days.indexOf(value) === -1) {
                if (pref.offsets_days.length >= 8) {
                    ToastService.warning('Maximum Reached', 'Up to 8 reminder times per item.');
                    return;
                }
                pref.offsets_days.push(value);
                pref.offsets_days.sort(function(a, b) { return b - a; });
                ep.touchedReminders[pref.reminder_type] = true;
            }
            pref.newOffset = '';
        }

        function resetOffsets(pref) {
            pref.offsets_days = (pref.default_offsets || []).slice().sort(function(a, b) { return b - a; });
            ep.touchedReminders[pref.reminder_type] = true;
        }

        function isDirty() {
            for (var k in ep.touched) { if (ep.touched[k]) { return true; } }
            for (var t in ep.touchedReminders) { if (ep.touchedReminders[t]) { return true; } }
            return false;
        }

        function discard() {
            if (ep.bundle) { apply(ep.bundle); }
        }

        // ── Save (one PUT, touched fields only) ──

        function save() {
            if (!isDirty() || ep.saving) { return; }
            var body = {};
            if (ep.touched.mute_all_notifications) { body.mute_all_notifications = ep.muteAll ? 1 : 0; }
            for (var i = 0; i < ep.switches.length; i++) {
                var sw = ep.switches[i];
                if (!ep.touched[sw.key]) { continue; }
                body[sw.key] = sw.inverted ? (sw.on ? 0 : 1) : (sw.on ? 1 : 0);
            }
            var rp = [];
            for (var j = 0; j < ep.reminders.length; j++) {
                var p = ep.reminders[j];
                if (!ep.touchedReminders[p.reminder_type]) { continue; }
                rp.push({ reminder_type: p.reminder_type, enabled: p.enabled ? 1 : 0, offsets_days: p.offsets_days });
            }
            if (rp.length) { body.reminder_preferences = rp; }
            if (ep.note && ep.note.trim()) { body.note = ep.note.trim(); }

            ep.saving = true;
            EmailLogService.SaveMemberPreferences(ep.memberId, body).then(function(data) {
                ep.saving = false;
                if (data && data.success) {
                    apply(data);
                    ep.saved = true;
                    $timeout(function() { ep.saved = false; }, 1800);
                    ToastService.success('Email preferences saved', (data.applied && data.applied.length)
                        ? 'Updated: ' + data.applied.join(', ').replace(/_/g, ' ')
                        : 'Nothing needed changing.');
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'Those changes could not be saved — please try again.');
                }
            });
        }

        // ── Presentation ──

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

        function statusIcon(status) {
            switch (status) {
                case 'sent':       return 'fa-check-circle';
                case 'suppressed': return 'fa-bell-slash';
                case 'failed':     return 'fa-exclamation-circle';
                default:           return 'fa-file-alt';
            }
        }

        // Audit rows: be forgiving about the exact column names.
        function changedBy(row) {
            if (!row) { return ''; }
            var name = row.changed_by_name || row.updated_by_name ||
                       ((row.changed_by_first_name || row.first_name || '') + ' ' + (row.changed_by_last_name || row.last_name || '')).trim();
            var via = row.changed_via || row.updated_via || row.via;
            var viaLabel = via === 'club_manager' ? 'club manager' : (via === 'self' ? 'themselves' : via);
            return (name || 'Someone') + (viaLabel ? ' (' + viaLabel + ')' : '');
        }

        function changeText(row) {
            if (!row) { return ''; }
            var field = row.field || row.setting || row.preference || row.reminder_type || row.key || 'preference';
            var label = String(field).replace(/_/g, ' ');
            var oldV = row.old_value !== undefined ? row.old_value : row.from;
            var newV = row.new_value !== undefined ? row.new_value : row.to;
            if (oldV === undefined && newV === undefined) { return row.description || row.message || ('changed ' + label); }
            return 'set ' + label + ' ' + fmt(oldV) + ' → ' + fmt(newV);
        }

        function fmt(v) {
            if (v === null || v === undefined || v === '') { return '—'; }
            if (angular.isArray(v)) { return v.join(', '); }
            if (angular.isObject(v)) { return angular.toJson(v); }
            return String(v);
        }
    }
