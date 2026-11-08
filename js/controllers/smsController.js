// ─────────────────────────────────────────────────────
// SmsController — admin / SMS-staff Safety Management screens.
// One controller serves every admin SMS screen; the screen is chosen by the
// route's data.screen. Shared concerns (club id, access resolution, sub-nav,
// enums, helpers) live up top; each screen has its own init() + actions.
// Detail/create flows use $uibModal with inline templates kept in views/manageclub/sms/modals.
// ─────────────────────────────────────────────────────
app.controller('SmsController', SmsController);

    SmsController.$inject = ['SmsService', 'SmsAccessService', 'ToastService', 'PlaneService', 'MemberService', 'ClubService', '$rootScope', '$scope', '$state', '$stateParams', '$uibModal', '$q'];
    function SmsController(SmsService, SmsAccessService, ToastService, PlaneService, MemberService, ClubService, $rootScope, $scope, $state, $stateParams, $uibModal, $q) {
        var vm = this;

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        vm.enums = SmsService.enums;

        // ── Which club ──
        // The SMS clubs of a user are the clubs they run (manager / super-admin)
        // and the clubs where they hold an SMS post (access.sms_post — the
        // backend's AccessControl::isClubSafetyAdmin gives both the SMS admin
        // screens). BACKEND_SMS_GUIDE.md §2.
        //  - A club admin (or ToAviate staff — whom Manage Club is for) works on
        //    the club picked in Manage Club (header club switcher). If they ALSO
        //    hold a post at clubs they don't run, the picker in _nav.html lists
        //    the Manage Club club + those post clubs (2026-11-07: an admin of
        //    club A with a post at club B only ever saw club A). A post club
        //    picked there is remembered against the Manage Club club it was
        //    picked from, so switching club in the header goes back to that club.
        //  - An SMS post holder who is not a club admin (let in by the Manage
        //    Club route guard on access.sms_post, see app.js) works on their post
        //    club — the one last picked here or on My Account → Safety (shared
        //    key) when it is one of theirs, else the first; picker when several.
        var SMS_CLUB_KEY = 'toaviate_sms_club_id';
        var SMS_ADMIN_POST_KEY = 'toaviate_sms_admin_post_club';   // {club, over}: an admin's post club, picked over Manage Club club `over`
        var MANAGE_CLUB_KEY = 'toaviate_selected_club_id';           // DashboardController's Manage Club pick
        var userAccess = vm.user.access || {};
        function idList(list) { return angular.isArray(list) ? list.map(String) : []; }
        function has(list, id) { return id !== undefined && id !== null && list.indexOf(String(id)) > -1; }
        function readKey(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
        var adminClubIds = idList(userAccess.manager).concat(idList(userAccess.super_admin));
        var postClubIds = idList(userAccess.sms_post);
        var isClubAdmin = adminClubIds.length > 0 || $rootScope.isToAviateStaff();
        // post clubs an admin does not run — the Manage Club switcher can't reach them
        var postOnlyIds = postClubIds.filter(function(id) { return adminClubIds.indexOf(id) === -1; });
        vm.postHolderOnly = !isClubAdmin;
        vm.clubPicker = [];  // [{id, name}] — shown by _nav.html when it has more than one club
        vm.club_id = null;
        var manageClubId = null;   // an admin's Manage Club club

        function adminPostPick() {
            var raw = readKey(SMS_ADMIN_POST_KEY), pick = null;
            try { pick = raw ? JSON.parse(raw) : null; } catch (e) { pick = null; }
            return (pick && has(postOnlyIds, pick.club) && String(pick.over) === String(manageClubId)) ? String(pick.club) : null;
        }

        // The club names for the picker (clubs/get_all_for_user: every club the
        // user is a current member of, the post clubs included).
        function loadPicker(ids, knownNames) {
            if (ids.length < 2) { return; }
            ClubService.GetAllForUser(vm.user.id).then(function(data) {
                var list = angular.isArray(data) ? data : (data && data.clubs ? data.clubs : []);
                var names = angular.extend({}, knownNames || {});
                list.forEach(function(c) { if (!names[String(c.id)]) { names[String(c.id)] = c.title || c.name; } });
                vm.clubPicker = ids.map(function(id) { return { id: id, name: names[id] || ('Club ' + id) }; });
            });
        }

        // An admin's club: the Manage Club club, or a post club picked over it.
        // After a refresh the slim `globals` cookie carries the club's id and the
        // Manage Club guard waits for AuthenticationService.Rehydrate(), so it is
        // normally known here; belt and braces, fall back to the id the
        // dashboard persisted, else wait for it — SMS calls once went out for
        // club "undefined".
        function adminClubKnown() {
            var cca = vm.user.current_club_admin;
            if (cca && cca.id) { return String(cca.id); }
            var saved = readKey(MANAGE_CLUB_KEY);
            return (saved && (has(adminClubIds, saved) || $rootScope.isToAviateStaff())) ? String(saved) : null;
        }
        function chooseAdminClub(manageId) {
            manageClubId = manageId;
            vm.club_id = adminPostPick() || manageClubId;
            if (postOnlyIds.length) {
                var cca = vm.user.current_club_admin, known = {};
                if (cca && cca.id && String(cca.id) === manageClubId && cca.title) { known[manageClubId] = cca.title; }
                loadPicker([manageClubId].concat(postOnlyIds), known);
            }
        }

        var clubReady = $q.defer();
        if (isClubAdmin) {
            var known = adminClubKnown();
            if (known) {
                chooseAdminClub(known);
                clubReady.resolve();
            } else {
                var stopWatch = $scope.$watch(function() {
                    var cca = vm.user.current_club_admin;
                    return cca && cca.id ? String(cca.id) : null;
                }, function(id) {
                    if (!id) { return; }
                    stopWatch();
                    chooseAdminClub(id);
                    clubReady.resolve();
                });
            }
        } else {
            var savedClub = readKey(SMS_CLUB_KEY);
            vm.club_id = has(postClubIds, savedClub) ? String(savedClub) : postClubIds[0];
            loadPicker(postClubIds);
            clubReady.resolve();
        }

        vm.selectSmsClub = function(id) {
            if (String(id) === String(vm.club_id)) return;
            try {
                if (vm.postHolderOnly) {
                    localStorage.setItem(SMS_CLUB_KEY, String(id));
                } else if (String(id) === String(manageClubId)) {
                    localStorage.removeItem(SMS_ADMIN_POST_KEY);
                } else {
                    localStorage.setItem(SMS_ADMIN_POST_KEY, JSON.stringify({ club: String(id), over: String(manageClubId) }));
                }
            } catch (e) {}
            $state.reload();
        };
        vm.selectPostClub = vm.selectSmsClub;   // older name, kept for any template still using it

        vm.loading = false;
        vm.access = { isAdmin: false, isSafetyManager: false };   // resolved async

        // ── Sub-navigation (rendered by the shared partial) ──
        vm.nav = [
            { screen: 'dashboard',   state: 'dashboard.manage_club.sms',            label: 'Dashboard',   icon: 'fa-tachometer-alt' },
            { screen: 'hazards',     state: 'dashboard.manage_club.sms_hazards',     label: 'Hazards',     icon: 'fa-exclamation-triangle' },
            { screen: 'occurrences', state: 'dashboard.manage_club.sms_occurrences', label: 'Occurrences', icon: 'fa-bolt' },
            { screen: 'risks',       state: 'dashboard.manage_club.sms_risks',       label: 'Risk Register', icon: 'fa-th' },
            { screen: 'actions',     state: 'dashboard.manage_club.sms_actions',     label: 'Actions',     icon: 'fa-tasks' },
            { screen: 'audits',      state: 'dashboard.manage_club.sms_audits',      label: 'Audits',      icon: 'fa-clipboard-check' },
            { screen: 'change',      state: 'dashboard.manage_club.sms_change',      label: 'Mgmt of Change', icon: 'fa-random' },
            { screen: 'meetings',    state: 'dashboard.manage_club.sms_meetings',    label: 'Meetings',    icon: 'fa-users' },
            { screen: 'documents',   state: 'dashboard.manage_club.sms_documents',   label: 'Documents',   icon: 'fa-folder-open' },
            { screen: 'instructors', state: 'dashboard.manage_club.sms_instructors', label: 'Instructors', icon: 'fa-chalkboard-teacher' },
            { screen: 'students',    state: 'dashboard.manage_club.sms_students',    label: 'Students',    icon: 'fa-user-graduate' },
            { screen: 'erp',         state: 'dashboard.manage_club.sms_erp',         label: 'ERP',         icon: 'fa-first-aid' },
            { screen: 'bulletins',   state: 'dashboard.manage_club.sms_bulletins',   label: 'Bulletins',   icon: 'fa-bullhorn' },
            { screen: 'audit_view',  state: 'dashboard.manage_club.sms_audit_view',  label: 'CAA Audit View', icon: 'fa-search' },
            { screen: 'settings',    state: 'dashboard.manage_club.sms_settings',    label: 'Settings',    icon: 'fa-cog' }
        ];

        // Post holders can't open the Manage Club landing — back to My Account → Safety.
        vm.back = function() { $state.go(vm.postHolderOnly ? 'dashboard.my_account.sms' : 'dashboard.manage_club'); };
        vm.go = function(state) { $state.go(state); };

        // ── Shared helpers (used across screens + templates) ──
        vm.pretty = function(s) { return s ? String(s).replace(/_/g, ' ') : ''; };
        vm.capitalize = function(s) {
            if (!s) return '';
            s = vm.pretty(s);
            return s.charAt(0).toUpperCase() + s.slice(1);
        };
        vm.bandClass = function(band) { return 'sms-band--' + (band || 'low'); };
        vm.statusBadge = function(status) {
            switch (status) {
                case 'closed': case 'completed': case 'published': case 'verified': return 'sms-badge--green';
                case 'submitted': case 'open': return 'sms-badge--blue';
                case 'overdue': case 'failed': return 'sms-badge--red';
                case 'in_progress': case 'review': case 'monitoring': return 'sms-badge--amber';
                default: return 'sms-badge--grey';
            }
        };
        vm.severityBadge = function(sev) {
            switch (sev) {
                case 'catastrophic': case 'hazardous': return 'sms-badge--red';
                case 'major': return 'sms-badge--orange';
                case 'minor': return 'sms-badge--amber';
                default: return 'sms-badge--grey';
            }
        };
        // FORBIDDEN-aware list assignment: returns [] on a forbidden/failed response.
        function asList(data) {
            if (angular.isArray(data)) return data;
            if (data && data.items) return data.items;
            return [];
        }
        vm.isForbidden = function(data) { return data && data.success === false && data.error === 'FORBIDDEN'; };

        // Once the club is known: resolve SMS access, then run the screen init.
        // One request per SMS endpoint — the second entry a browser's network
        // log shows for each is its CORS preflight (OPTIONS), not a second call.
        // The Settings screen reuses the settings row that resolve() has just
        // fetched (its form used to fetch the same row a second time on a
        // fresh load); a cached access may be stale, so then it fetches anew.
        var freshSettings = null;
        clubReady.promise.then(function() {
            if (!vm.club_id) { return; }   // no SMS club at all: nothing to load
            var fetchingNow = !SmsAccessService.isCached(vm.club_id);
            SmsAccessService.resolve(vm.club_id).then(function(acc) {
                vm.access = acc;
                if (fetchingNow && acc && acc.settings && acc.settings.club_id) { freshSettings = acc.settings; }
                init();
            }, function() {
                init();   // even without settings, member-level screens still work
            });
        });

        function init() {
            switch (vm.screen) {
                case 'dashboard':   initDashboard(); break;
                case 'hazards':     initHazards(); break;
                case 'occurrences': initOccurrences(); break;
                case 'risks':       initRisks(); break;
                case 'actions':     initActions(); break;
                case 'audits':      initAudits(); break;
                case 'change':      initChange(); break;
                case 'meetings':    initMeetings(); break;
                case 'documents':   initDocuments(); break;
                case 'instructors': initInstructors(); break;
                case 'students':    initStudents(); break;
                case 'erp':         initErp(); break;
                case 'bulletins':   initBulletins(); break;
                case 'audit_view':  initAuditView(); break;
                case 'settings':    initSettings(); break;
            }
        }

        // ════════════════════════════════════════════
        // DASHBOARD
        // ════════════════════════════════════════════
        function initDashboard() {
            vm.loading = true;
            SmsService.GetDashboard(vm.club_id).then(function(data) {
                vm.loading = false;
                vm.spi = (data && data.spi) || {};
                vm.riskBands = (data && data.risk_bands) || {};
            });
            SmsService.GetTrends(vm.club_id).then(function(data) {
                vm.trends = data || {};
            });

            // SPI tiles definition → which dashboard counters to show, and where they link.
            vm.tiles = [
                { key: 'hazards_open',        label: 'Open Hazards',      icon: 'fa-exclamation-triangle', tone: '',       state: 'dashboard.manage_club.sms_hazards' },
                { key: 'occurrences_open',    label: 'Open Occurrences',  icon: 'fa-bolt',                 tone: 'violet', state: 'dashboard.manage_club.sms_occurrences' },
                { key: 'risks_open',          label: 'Open Risks',        icon: 'fa-th',          tone: '',       state: 'dashboard.manage_club.sms_risks' },
                { key: 'risks_high_extreme',  label: 'High / Extreme',    icon: 'fa-fire',                 tone: 'red',    state: 'dashboard.manage_club.sms_risks', alert: true },
                { key: 'findings_open',       label: 'Open Findings',     icon: 'fa-clipboard-list',       tone: 'amber',  state: 'dashboard.manage_club.sms_audits' },
                { key: 'actions_open',        label: 'Open Actions',      icon: 'fa-tasks',           tone: '',       state: 'dashboard.manage_club.sms_actions' },
                { key: 'actions_overdue',     label: 'Overdue Actions',   icon: 'fa-clock',                tone: 'red',    state: 'dashboard.manage_club.sms_actions', alert: true },
                { key: 'audits_open',         label: 'Open Audits',       icon: 'fa-clipboard-check',      tone: '',       state: 'dashboard.manage_club.sms_audits' },
                { key: 'instructor_alerts',   label: 'Instructor Alerts', icon: 'fa-chalkboard-teacher',      tone: 'amber',  state: 'dashboard.manage_club.sms_instructors' },
                { key: 'instructor_expired',  label: 'Instructor Expired',icon: 'fa-user-clock',           tone: 'red',    state: 'dashboard.manage_club.sms_instructors', alert: true },
                { key: 'student_concerns_open', label: 'Student Concerns', icon: 'fa-user-graduate',       tone: 'amber',  state: 'dashboard.manage_club.sms_students' },
                { key: 'changes_open',        label: 'Open Changes',      icon: 'fa-random',              tone: 'violet', state: 'dashboard.manage_club.sms_change' }
            ];
        }

        // ════════════════════════════════════════════
        // HAZARDS
        // ════════════════════════════════════════════
        function initHazards() {
            vm.hazardFilter = { status: '', category: '' };
            vm.search = '';
            loadHazards();
        }
        function loadHazards() {
            vm.loading = true;
            // Load all club hazards; the view filters by status/category/search client-side
            // (instant chips, no reload per click).
            SmsService.ListHazards(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.hazards = asList(data);
            });
        }
        vm.openHazard = function(h) {
            openDetailModal('hazard', h, 'views/manageclub/sms/modals/hazard_detail.html', loadHazards);
        };

        // ════════════════════════════════════════════
        // OCCURRENCES
        // ════════════════════════════════════════════
        function initOccurrences() {
            vm.occFilter = { status: '', occurrence_type: '' };
            loadOccurrences();
        }
        function loadOccurrences() {
            vm.loading = true;
            SmsService.ListOccurrences(vm.club_id, vm.occFilter).then(function(data) {
                vm.loading = false;
                vm.occurrences = asList(data);
            });
        }
        vm.openOccurrence = function(o) {
            openDetailModal('occurrence', o, 'views/manageclub/sms/modals/occurrence_detail.html', loadOccurrences);
        };

        // ════════════════════════════════════════════
        // RISK REGISTER
        // ════════════════════════════════════════════
        function initRisks() {
            vm.riskFilter = { status: '' };
            loadRisks();
        }
        function loadRisks() {
            vm.loading = true;
            SmsService.ListRisks(vm.club_id, vm.riskFilter).then(function(data) {
                vm.loading = false;
                vm.risks = asList(data).sort(function(a, b) { return (b.risk_score || 0) - (a.risk_score || 0); });
            });
        }
        vm.newRisk = function() { openRiskModal(null); };
        vm.editRisk = function(r) { openRiskModal(r); };
        function openRiskModal(risk) {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'sms-modal',
                templateUrl: 'views/manageclub/sms/modals/risk_form.html',
                controller: 'SmsRiskModalController', controllerAs: 'm',
                resolve: {
                    clubId: function() { return vm.club_id; },
                    risk: function() { return risk ? angular.copy(risk) : null; },
                    enums: function() { return vm.enums; }
                }
            }).result.then(loadRisks, function(){});
        }

        // ════════════════════════════════════════════
        // ACTIONS
        // ════════════════════════════════════════════
        function initActions() {
            vm.actionFilter = { status: '' };
            loadActions();
        }
        function loadActions() {
            vm.loading = true;
            SmsService.ListActions(vm.club_id, vm.actionFilter).then(function(data) {
                vm.loading = false;
                vm.actions = asList(data);
            });
        }
        vm.openCompleteAction = function(a) {
            $uibModal.open({
                animation: true, backdrop: 'static', windowClass: 'sms-modal',
                templateUrl: 'views/manageclub/sms/modals/action_complete.html',
                controller: 'SmsActionModalController', controllerAs: 'm',
                resolve: {
                    clubId: function() { return vm.club_id; },
                    action: function() { return angular.copy(a); }
                }
            }).result.then(loadActions, function(){});
        };

        // ════════════════════════════════════════════
        // AUDITS & FINDINGS
        // ════════════════════════════════════════════
        function initAudits() {
            loadAudits();
        }
        function loadAudits() {
            vm.loading = true;
            $q.all([
                SmsService.ListAudits(vm.club_id, {}),
                SmsService.ListFindings(vm.club_id, {})
            ]).then(function(res) {
                vm.loading = false;
                vm.audits = asList(res[0]);
                vm.findings = asList(res[1]);
            });
        }
        vm.openAudit = function(a) {
            openDetailModal('audit', a, 'views/manageclub/sms/modals/audit_detail.html', loadAudits);
        };
        vm.newAudit = function() {
            $uibModal.open({
                animation: true, backdrop: 'static', windowClass: 'sms-modal',
                templateUrl: 'views/manageclub/sms/modals/audit_form.html',
                controller: 'SmsAuditModalController', controllerAs: 'm',
                resolve: { clubId: function() { return vm.club_id; } }
            }).result.then(loadAudits, function(){});
        };

        // ════════════════════════════════════════════
        // MANAGEMENT OF CHANGE
        // ════════════════════════════════════════════
        function initChange() {
            loadChanges();
        }
        function loadChanges() {
            vm.loading = true;
            SmsService.ListChanges(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.changes = asList(data);
            });
        }
        vm.advanceChange = function(c, status) {
            SmsService.ChangeStatus(vm.club_id, c.id, status).then(function(data) {
                if (data && data.success) { ToastService.success('Updated', 'Change moved to ' + vm.pretty(status) + '.'); loadChanges(); }
                else { ToastService.error('Could not update', (data && data.message) || ''); }
            });
        };

        // ════════════════════════════════════════════
        // MEETINGS
        // ════════════════════════════════════════════
        function initMeetings() {
            loadMeetings();
        }
        function loadMeetings() {
            vm.loading = true;
            SmsService.ListMeetings(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.meetings = asList(data);
            });
        }

        // ════════════════════════════════════════════
        // DOCUMENTS
        // ════════════════════════════════════════════
        function initDocuments() {
            loadDocuments();
        }
        function loadDocuments() {
            vm.loading = true;
            SmsService.ListDocuments(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.documents = asList(data);
                vm.documentGroups = groupBy(vm.documents, 'doc_type');
            });
        }
        // Group a list into [{ key, items }] — avoids needing the angular-filter lib.
        function groupBy(list, field) {
            var map = {}, order = [];
            (list || []).forEach(function(item) {
                var k = item[field] || 'Other';
                if (!map[k]) { map[k] = { key: k, items: [] }; order.push(map[k]); }
                map[k].items.push(item);
            });
            return order;
        }

        // ════════════════════════════════════════════
        // INSTRUCTOR OVERSIGHT
        // ════════════════════════════════════════════
        function initInstructors() {
            vm.instructorTab = 'records';
            loadInstructorRecords();
            SmsService.InstructorAlerts(vm.club_id).then(function(data) { vm.instructorAlerts = asList(data); });
            SmsService.ListInstructorChecks(vm.club_id, {}).then(function(data) { vm.instructorChecks = asList(data); });
        }
        function loadInstructorRecords() {
            vm.loading = true;
            SmsService.ListInstructorRecords(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.instructorRecords = asList(data);
            });
        }
        vm.setInstructorTab = function(t) { vm.instructorTab = t; };
        vm.alertClass = function(alert) {
            switch (alert) {
                case 'expired':  return 'sms-badge--red';
                case 'critical': return 'sms-badge--red';
                case 'warning':  return 'sms-badge--orange';
                case 'notice':   return 'sms-badge--amber';
                default:         return 'sms-badge--green';
            }
        };

        // ════════════════════════════════════════════
        // STUDENTS
        // ════════════════════════════════════════════
        function initStudents() {
            vm.loading = true;
            SmsService.ListStudentRecords(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.studentRecords = asList(data);
            });
        }

        // ════════════════════════════════════════════
        // ERP
        // ════════════════════════════════════════════
        function initErp() {
            vm.erpTab = 'contacts';
            vm.loading = true;
            $q.all([
                SmsService.ListContacts(vm.club_id),
                SmsService.ListExercises(vm.club_id)
            ]).then(function(res) {
                vm.loading = false;
                vm.contacts = asList(res[0]);
                vm.exercises = asList(res[1]);
            });
        }
        vm.setErpTab = function(t) { vm.erpTab = t; };

        // ════════════════════════════════════════════
        // BULLETINS
        // ════════════════════════════════════════════
        function initBulletins() {
            loadBulletins();
        }
        function loadBulletins() {
            vm.loading = true;
            SmsService.ListBulletins(vm.club_id, {}).then(function(data) {
                vm.loading = false;
                vm.bulletins = asList(data);
            });
        }
        vm.publishBulletin = function(b) {
            SmsService.PublishBulletin(vm.club_id, b.id, {}).then(function(data) {
                if (data && data.success) { ToastService.success('Published', 'Bulletin is now live for members.'); loadBulletins(); }
                else { ToastService.error('Could not publish', (data && data.message) || ''); }
            });
        };
        vm.newBulletin = function() {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'sms-modal',
                templateUrl: 'views/manageclub/sms/modals/bulletin_form.html',
                controller: 'SmsBulletinModalController', controllerAs: 'm',
                resolve: { clubId: function() { return vm.club_id; }, enums: function() { return vm.enums; } }
            }).result.then(loadBulletins, function(){});
        };

        // ════════════════════════════════════════════
        // CAA AUDIT VIEW
        // ════════════════════════════════════════════
        function initAuditView() {
            vm.loading = true;
            SmsService.GetAuditView(vm.club_id).then(function(data) {
                vm.loading = false;
                vm.audit = (data && data.success === false) ? {} : (data || {});
            });
        }
        vm.printAuditView = function() { window.print(); };

        // ════════════════════════════════════════════
        // SETTINGS
        // ════════════════════════════════════════════
        function initSettings() {
            vm.loading = true;
            $q.all([
                freshSettings ? $q.when(freshSettings) : SmsService.GetSettings(vm.club_id),
                MemberService.GetAllByClub ? MemberService.GetAllByClub(vm.club_id) : $q.when([])
            ]).then(function(res) {
                vm.loading = false;
                var settings = res[0];
                vm.settings = (settings && settings.success === false) ? {} : (settings || {});
                vm.settingsForm = angular.copy(vm.settings);
                var members = res[1];
                vm.members = (members && members.members) ? members.members : asList(members);
            });
            vm.posts = [
                { field: 'accountable_manager_id', label: 'Accountable Manager' },
                { field: 'safety_manager_id',      label: 'Safety Manager' },
                { field: 'compliance_manager_id',  label: 'Compliance Manager' },
                { field: 'head_of_training_id',    label: 'Head of Training' },
                { field: 'cfi_id',                 label: 'Chief Flying Instructor' }
            ];
        }
        vm.saveSettings = function() {
            vm.saving = true;
            SmsService.SaveSettings(vm.club_id, vm.settingsForm).then(function(data) {
                vm.saving = false;
                if (data && data.success) { ToastService.success('Saved', 'SMS settings updated.'); }
                else if (vm.isForbidden(data)) { ToastService.error('Not allowed', 'Only club admins can change SMS settings.'); }
                else { ToastService.error('Could not save', (data && data.message) || ''); }
            });
        };

        // ── Generic detail modal opener (read + status/comment actions) ──
        function openDetailModal(kind, record, templateUrl, onClose) {
            $uibModal.open({
                animation: true, size: 'lg', backdrop: 'static', windowClass: 'sms-modal',
                templateUrl: templateUrl,
                controller: 'SmsDetailModalController', controllerAs: 'm',
                resolve: {
                    clubId: function() { return vm.club_id; },
                    kind: function() { return kind; },
                    recordId: function() { return record.id; },
                    access: function() { return vm.access; },
                    enums: function() { return vm.enums; }
                }
            }).result.then(function() { if (onClose) onClose(); }, function() { if (onClose) onClose(); });
        }
    }
