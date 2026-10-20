app.controller('RemindersController', RemindersController);

    RemindersController.$inject = ['RemindersService', 'MemberService', 'InstructorService', '$rootScope', '$scope', '$timeout', '$q', 'ToastService'];
    function RemindersController(RemindersService, MemberService, InstructorService, $rootScope, $scope, $timeout, $q, ToastService) {

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

        // Booking reminders ("evening before each booking") are a separate
        // system from the expiry digest above: one mute flag per club
        // MEMBERSHIP (mute_booking_reminders), saved via the same two
        // routes the membership edit page uses.
        vm.bookingLoading = true;
        vm.bookingMemberships = [];
        vm.bookingSaving = {};     // 'membershipId:prefKey' → true while saving
        vm.bookingSaved = {};      // membership id → true briefly after a save

        vm.typeIcon = typeIcon;
        vm.typeHint = typeHint;
        vm.toggleType = toggleType;
        vm.removeOffset = removeOffset;
        vm.addOffset = addOffset;
        vm.resetToDefault = resetToDefault;
        vm.toggleHistory = toggleHistory;
        vm.historyLabel = historyLabel;
        vm.toggleBookingReminder = toggleBookingReminder;

        activate();
        loadBookingReminders();

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

        // ── Booking emails (per club membership) ──
        // Mirrors the Email Preferences block on the membership edit page:
        // every member gets "Booking reminders"; instructors also get
        // "Booking notifications" and "Daily schedule summary". All three
        // live on the members row (string "0"/"1" flags — compare loosely).

        var BOOKING_PREFS = [
            { key: 'reminders',     field: 'mute_booking_reminders',   inverted: true,  instructorOnly: false,
              icon: 'fa-calendar-check', label: 'Booking reminders',      desc: 'An email the evening before each upcoming booking.' },
            { key: 'notifications', field: 'mute_booking_emails',      inverted: true,  instructorOnly: true,
              icon: 'fa-envelope',       label: 'Booking notifications',  desc: 'An email each time a student books a lesson with you.' },
            { key: 'summary',       field: 'instructor_daily_summary', inverted: false, instructorOnly: true,
              icon: 'fa-list-alt',       label: 'Daily schedule summary', desc: 'One combined email listing all your bookings for tomorrow.' }
        ];

        function loadBookingReminders() {
            MemberService.GetUserMemberships(vm.user.id).then(function (data) {
                if (!data || !data.success || !data.memberships) {
                    vm.bookingLoading = false;
                    return; // section simply stays empty — the expiry cards still work
                }
                var rows = [];
                for (var i = 0; i < data.memberships.length; i++) {
                    if (data.memberships[i].membership_id > 0) { rows.push(data.memberships[i]); }
                }
                // The list endpoint may not carry the email-preference flags
                // (see FRONTEND_REMINDERS_GUIDE.md §3) — fetch the full
                // membership for any row that lacks them. NB: never take
                // `id` from for_user; it is overwritten with the plan id.
                var fills = [];
                for (var j = 0; j < rows.length; j++) {
                    if (typeof rows[j].mute_booking_reminders === 'undefined') {
                        fills.push(fillMembership(rows[j]));
                    }
                }
                $q.all(fills).then(function () {
                    for (var k = 0; k < rows.length; k++) {
                        rows[k]._prefs = prefsFor(rows[k]);
                    }
                    vm.bookingMemberships = rows;
                    vm.bookingLoading = false;
                });
            });
        }

        function fillMembership(row) {
            return MemberService.GetOneForUser(row.id).then(function (data) {
                if (data && data.success && data.membership) {
                    row.instructor               = data.membership.instructor;
                    row.mute_booking_reminders   = data.membership.mute_booking_reminders;
                    row.mute_booking_emails      = data.membership.mute_booking_emails;
                    row.instructor_daily_summary = data.membership.instructor_daily_summary;
                } else {
                    row._loadFailed = true;
                }
            });
        }

        // Build the per-row toggle list from the membership's flags.
        function prefsFor(m) {
            var out = [];
            for (var i = 0; i < BOOKING_PREFS.length; i++) {
                var def = BOOKING_PREFS[i];
                if (def.instructorOnly && m.instructor != 1) { continue; }
                out.push({
                    key: def.key, icon: def.icon, label: def.label, desc: def.desc,
                    on: isOn(m, def)
                });
            }
            return out;
        }

        function isOn(m, def) {
            return def.inverted ? (m[def.field] == 0) : (m[def.field] == 1);
        }

        function defFor(key) {
            for (var i = 0; i < BOOKING_PREFS.length; i++) {
                if (BOOKING_PREFS[i].key === key) { return BOOKING_PREFS[i]; }
            }
            return null;
        }

        function toggleBookingReminder(m, pref) {
            var def = defFor(pref.key);
            if (!def) { return; }
            var wantOn = !pref.on;
            var newValue = def.inverted ? (wantOn ? 0 : 1) : (wantOn ? 1 : 0);
            pref.on = wantOn;                           // optimistic — reverted below on failure
            vm.bookingSaving[m.id + ':' + pref.key] = true;

            var request;
            if (m.instructor == 1) {
                // instructor_update writes all three flags at once —
                // echo the current values of the other two so they aren't reset.
                var payload = {
                    id: m.id,
                    mute_booking_emails:      m.mute_booking_emails,
                    mute_booking_reminders:   m.mute_booking_reminders,
                    instructor_daily_summary: m.instructor_daily_summary
                };
                payload[def.field] = newValue;
                request = InstructorService.UpdateInstructor(payload, m.club_id);
            } else {
                var obj = {};
                obj[def.field] = newValue;
                request = MemberService.UpdateOneByUser(m.id, obj);
            }

            request.then(function (data) {
                vm.bookingSaving[m.id + ':' + pref.key] = false;
                if (data && data.success) {
                    m[def.field] = newValue;
                    vm.bookingSaved[m.id] = true;
                    $timeout(function () { vm.bookingSaved[m.id] = false; }, 1600);
                } else {
                    pref.on = isOn(m, def); // revert
                    ToastService.error('Not Saved', (data && data.message) || 'Could not update your email preference — please try again.');
                }
            });
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
