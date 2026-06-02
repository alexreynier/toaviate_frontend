// ─────────────────────────────────────────────────────
// SmsMemberController — member-facing Safety (SMS) screens.
// One controller for: home, report_hazard, report_occurrence,
// acknowledgements, bulletins. The screen is chosen by $state route data.
// Designed to be effortless: big tappable pickers, minimal required fields,
// instant feedback via ToastService.
// ─────────────────────────────────────────────────────
app.controller('SmsMemberController', SmsMemberController);

    SmsMemberController.$inject = ['SmsService', 'PlaneService', 'ClubService', 'ToastService', '$rootScope', '$scope', '$state', '$timeout'];
    function SmsMemberController(SmsService, PlaneService, ClubService, ToastService, $rootScope, $scope, $state, $timeout) {
        var vm = this;

        var SMS_CLUB_KEY = 'toaviate_sms_club_id';

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        // ── Multi-club support ──
        // A member may belong to several clubs; SMS items are per-club, so they
        // choose which club this report/screen relates to. vm.clubs holds the
        // selectable clubs (with names); vm.club_id is the active one (persisted).
        vm.clubs = [];
        var access = vm.user.access || {};
        // Set of club IDs the user has any relationship with.
        var myClubIds = {};
        ['pilot', 'instructor', 'manager', 'super_admin'].forEach(function(role) {
            (access[role] || []).forEach(function(id) { myClubIds[id] = true; });
        });
        if (vm.user.current_club_admin && vm.user.current_club_admin.id) {
            myClubIds[vm.user.current_club_admin.id] = true;
        }
        var myClubIdList = Object.keys(myClubIds);

        // Initial club: persisted choice (if still valid) → first available.
        var savedClub = null;
        try { savedClub = localStorage.getItem(SMS_CLUB_KEY); } catch (e) {}
        vm.club_id = (savedClub && myClubIds[savedClub]) ? savedClub :
                     (myClubIdList.length ? myClubIdList[0] : null);

        vm.enums = SmsService.enums;
        vm.loading = false;
        vm.saving = false;

        // Whether to offer a club picker at all.
        vm.multiClub = myClubIdList.length > 1;

        // Resolve club names for the picker (only when the user has >1 club).
        if (vm.multiClub) {
            ClubService.GetAllForUser(vm.user_id).then(function(data) {
                var list = angular.isArray(data) ? data : (data && data.clubs ? data.clubs : []);
                vm.clubs = list.filter(function(c) { return myClubIds[String(c.id)] || myClubIds[c.id]; })
                               .map(function(c) { return { id: String(c.id), name: c.club_name || c.name || ('Club ' + c.id) }; });
                // If we couldn't match names, fall back to bare IDs so the picker still works.
                if (!vm.clubs.length) {
                    vm.clubs = myClubIdList.map(function(id) { return { id: String(id), name: 'Club ' + id }; });
                }
                syncClubName();
            });
        }

        vm.clubName = '';
        function syncClubName() {
            var match = vm.clubs.filter(function(c) { return String(c.id) === String(vm.club_id); })[0];
            vm.clubName = match ? match.name : '';
        }

        // Called by the club picker — switch club, persist, and reload the screen.
        vm.selectClub = function(id) {
            if (!id || String(id) === String(vm.club_id)) return;
            vm.club_id = String(id);
            try { localStorage.setItem(SMS_CLUB_KEY, vm.club_id); } catch (e) {}
            syncClubName();
            runScreen();   // re-fetch data / reset forms for the newly selected club
        };

        // ── Icons per hazard category (for the tappable picker) ──
        var CATEGORY_ICONS = {
            'Flight Operations': 'fa-plane-departure',
            'Aerodrome': 'fa-map-marker-alt',
            'Aircraft': 'fa-plane',
            'Maintenance': 'fa-wrench',
            'Human Factors': 'fa-user',
            'Fatigue': 'fa-bed',
            'Weather': 'fa-cloud-showers-heavy',
            'Security': 'fa-shield-alt',
            'IFR Operations': 'fa-cloud',
            'Aerobatics': 'fa-sync',
            'UPRT': 'fa-redo',
            'Student Performance': 'fa-user-graduate',
            'Instructor Performance': 'fa-chalkboard-teacher'
        };
        vm.categoryIcon = function(cat) { return CATEGORY_ICONS[cat] || 'fa-exclamation-triangle'; };

        vm.back = function() { $state.go('dashboard.my_account.sms'); };

        // ════════════════════════════════════════════
        // ROUTER
        // ════════════════════════════════════════════
        function runScreen() {
            switch (vm.screen) {
                case 'home':              initHome(); break;
                case 'report_hazard':     initReportHazard(); break;
                case 'report_occurrence': initReportOccurrence(); break;
                case 'acknowledgements':  initAcknowledgements(); break;
                case 'bulletins':         initBulletins(); break;
            }
        }
        syncClubName();
        runScreen();

        // ════════════════════════════════════════════
        // HOME — quick actions + pending-ack badge
        // ════════════════════════════════════════════
        function initHome() {
            vm.pendingCount = 0;
            if (!vm.club_id) return;
            SmsService.PendingAcks(vm.club_id).then(function(data) {
                vm.pending = angular.isArray(data) ? data : (data.items || []);
                vm.pendingCount = vm.pending ? vm.pending.length : 0;
            });
        }

        // ════════════════════════════════════════════
        // REPORT A HAZARD — the headline "never think twice" flow
        // ════════════════════════════════════════════
        function initReportHazard() {
            vm.hazard = {
                category: null,
                title: '',
                description: '',
                aerodrome: '',
                plane_id: null,
                immediate_actions: '',
                is_anonymous: 0
            };
            vm.planes = [];
            PlaneService.GetAllByClub(vm.club_id).then(function(data) {
                vm.planes = (data && data.planes) ? data.planes : (angular.isArray(data) ? data : []);
            });
        }

        vm.pickCategory = function(cat) { vm.hazard.category = cat; };
        vm.toggleAnonymous = function() { vm.hazard.is_anonymous = vm.hazard.is_anonymous ? 0 : 1; };

        vm.submitHazard = function() {
            if (!vm.hazard.category) {
                ToastService.warning('Pick a category', 'Tap the area that best describes the hazard.');
                return;
            }
            if (!vm.hazard.title || vm.hazard.title.trim().length < 3) {
                ToastService.warning('Add a title', 'A short summary helps the safety team triage it.');
                return;
            }
            if (!vm.hazard.description || vm.hazard.description.trim().length < 5) {
                ToastService.warning('Describe it', 'Tell us what you saw — a sentence or two is plenty.');
                return;
            }
            var payload = angular.copy(vm.hazard);
            payload.is_anonymous = payload.is_anonymous ? 1 : 0;
            if (!payload.plane_id) delete payload.plane_id;
            vm.saving = true;
            SmsService.SubmitHazard(vm.club_id, payload).then(function(data) {
                vm.saving = false;
                if (data && data.success) {
                    ToastService.success('Thank you!', 'Hazard ' + (data.reference || '') + ' submitted. You’ve helped keep everyone safer.');
                    $state.go('dashboard.my_account.sms');
                } else {
                    ToastService.error('Could not submit', (data && data.message) || 'Please try again.');
                }
            });
        };

        // ════════════════════════════════════════════
        // REPORT AN OCCURRENCE
        // ════════════════════════════════════════════
        function initReportOccurrence() {
            vm.occurrence = {
                occurrence_type: null,
                severity: null,
                description: '',
                personnel_involved: '',
                aerodrome: '',
                plane_id: null
            };
            vm.planes = [];
            PlaneService.GetAllByClub(vm.club_id).then(function(data) {
                vm.planes = (data && data.planes) ? data.planes : (angular.isArray(data) ? data : []);
            });
        }

        vm.pickType = function(t) { vm.occurrence.occurrence_type = t; };
        vm.pickSeverity = function(sv) { vm.occurrence.severity = sv; };

        vm.submitOccurrence = function() {
            if (!vm.occurrence.occurrence_type) {
                ToastService.warning('Pick a type', 'What kind of occurrence was it?');
                return;
            }
            if (!vm.occurrence.severity) {
                ToastService.warning('Pick a severity', 'Roughly how serious was it?');
                return;
            }
            if (!vm.occurrence.description || vm.occurrence.description.trim().length < 5) {
                ToastService.warning('Describe it', 'A short account of what happened.');
                return;
            }
            var payload = angular.copy(vm.occurrence);
            if (!payload.plane_id) delete payload.plane_id;
            vm.saving = true;
            SmsService.ReportOccurrence(vm.club_id, payload).then(function(data) {
                vm.saving = false;
                if (data && data.success) {
                    ToastService.success('Reported', 'Occurrence ' + (data.reference || '') + ' logged. Thank you.');
                    $state.go('dashboard.my_account.sms');
                } else {
                    ToastService.error('Could not report', (data && data.message) || 'Please try again.');
                }
            });
        };

        // ════════════════════════════════════════════
        // ACKNOWLEDGEMENTS — read & sign
        // ════════════════════════════════════════════
        function initAcknowledgements() {
            vm.signatureName = (vm.user.first_name || '') + ' ' + (vm.user.last_name || '');
            loadPending();
        }

        function loadPending() {
            vm.loading = true;
            SmsService.PendingAcks(vm.club_id).then(function(data) {
                vm.loading = false;
                vm.pending = angular.isArray(data) ? data : (data.items || []);
            });
        }

        vm.sign = function(item) {
            if (!vm.signatureName || vm.signatureName.trim().length < 2) {
                ToastService.warning('Type your name', 'Your typed name is your e-signature.');
                return;
            }
            item._signing = true;
            SmsService.SignAck(vm.club_id, {
                entity_type: item.entity_type,
                entity_id: item.entity_id,
                signature_name: vm.signatureName
            }).then(function(data) {
                item._signing = false;
                if (data && data.success) {
                    item._signed = true;
                    ToastService.success('Signed', 'Marked as read & understood.');
                    $timeout(function() {
                        vm.pending = vm.pending.filter(function(p) { return p !== item; });
                    }, 900);
                } else {
                    ToastService.error('Could not sign', (data && data.message) || 'Please try again.');
                }
            });
        };

        // ════════════════════════════════════════════
        // BULLETINS — read published items
        // ════════════════════════════════════════════
        function initBulletins() {
            vm.loading = true;
            SmsService.ListBulletins(vm.club_id, { published: 1 }).then(function(data) {
                vm.loading = false;
                vm.bulletins = angular.isArray(data) ? data : (data.items || []);
            });
            vm.openId = null;
            vm.toggleBulletin = function(b) { vm.openId = (vm.openId === b.id) ? null : b.id; };
        }

        vm.bulletinBadge = function(type) {
            switch (type) {
                case 'safety_bulletin':   return 'sms-badge--red';
                case 'lesson_learned':    return 'sms-badge--violet';
                case 'regulatory_update': return 'sms-badge--blue';
                default:                  return 'sms-badge--grey';
            }
        };
        vm.prettyType = function(t) { return t ? t.replace(/_/g, ' ') : ''; };
    }
