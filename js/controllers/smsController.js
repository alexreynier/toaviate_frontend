// ─────────────────────────────────────────────────────
// SmsController — admin / SMS-staff Safety Management screens.
// One controller serves every admin SMS screen; the screen is chosen by the
// route's data.screen. Shared concerns (club id, access resolution, sub-nav,
// enums, helpers) live up top; each screen has its own init() + actions.
// Detail/create flows use $uibModal with inline templates kept in views/manageclub/sms/modals.
// ─────────────────────────────────────────────────────
app.controller('SmsController', SmsController);

    SmsController.$inject = ['SmsService', 'SmsAccessService', 'ToastService', 'PlaneService', 'MemberService', '$rootScope', '$scope', '$state', '$stateParams', '$uibModal', '$q'];
    function SmsController(SmsService, SmsAccessService, ToastService, PlaneService, MemberService, $rootScope, $scope, $state, $stateParams, $uibModal, $q) {
        var vm = this;

        vm.screen = $state.current.data.screen;
        vm.user = $rootScope.globals.currentUser;
        vm.club_id = vm.user.current_club_admin.id;
        vm.enums = SmsService.enums;

        vm.loading = false;
        vm.access = { isAdmin: false, isSafetyManager: false };   // resolved async

        // ── Sub-navigation (rendered by the shared partial) ──
        vm.nav = [
            { screen: 'dashboard',   state: 'dashboard.manage_club.sms',            label: 'Dashboard',   icon: 'fa-gauge-high' },
            { screen: 'hazards',     state: 'dashboard.manage_club.sms_hazards',     label: 'Hazards',     icon: 'fa-triangle-exclamation' },
            { screen: 'occurrences', state: 'dashboard.manage_club.sms_occurrences', label: 'Occurrences', icon: 'fa-bolt' },
            { screen: 'risks',       state: 'dashboard.manage_club.sms_risks',       label: 'Risk Register', icon: 'fa-table-cells' },
            { screen: 'actions',     state: 'dashboard.manage_club.sms_actions',     label: 'Actions',     icon: 'fa-list-check' },
            { screen: 'audits',      state: 'dashboard.manage_club.sms_audits',      label: 'Audits',      icon: 'fa-clipboard-check' },
            { screen: 'change',      state: 'dashboard.manage_club.sms_change',      label: 'Mgmt of Change', icon: 'fa-shuffle' },
            { screen: 'meetings',    state: 'dashboard.manage_club.sms_meetings',    label: 'Meetings',    icon: 'fa-people-group' },
            { screen: 'documents',   state: 'dashboard.manage_club.sms_documents',   label: 'Documents',   icon: 'fa-folder-open' },
            { screen: 'instructors', state: 'dashboard.manage_club.sms_instructors', label: 'Instructors', icon: 'fa-chalkboard-user' },
            { screen: 'students',    state: 'dashboard.manage_club.sms_students',    label: 'Students',    icon: 'fa-user-graduate' },
            { screen: 'erp',         state: 'dashboard.manage_club.sms_erp',         label: 'ERP',         icon: 'fa-kit-medical' },
            { screen: 'bulletins',   state: 'dashboard.manage_club.sms_bulletins',   label: 'Bulletins',   icon: 'fa-bullhorn' },
            { screen: 'audit_view',  state: 'dashboard.manage_club.sms_audit_view',  label: 'CAA Audit View', icon: 'fa-magnifying-glass-chart' },
            { screen: 'settings',    state: 'dashboard.manage_club.sms_settings',    label: 'Settings',    icon: 'fa-gear' }
        ];

        vm.back = function() { $state.go('dashboard.manage_club'); };
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

        // Resolve SMS access, then run the screen init.
        SmsAccessService.resolve(vm.club_id).then(function(acc) {
            vm.access = acc;
            init();
        }, function() {
            init();   // even without settings, member-level screens still work
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
                { key: 'hazards_open',        label: 'Open Hazards',      icon: 'fa-triangle-exclamation', tone: '',       state: 'dashboard.manage_club.sms_hazards' },
                { key: 'occurrences_open',    label: 'Open Occurrences',  icon: 'fa-bolt',                 tone: 'violet', state: 'dashboard.manage_club.sms_occurrences' },
                { key: 'risks_open',          label: 'Open Risks',        icon: 'fa-table-cells',          tone: '',       state: 'dashboard.manage_club.sms_risks' },
                { key: 'risks_high_extreme',  label: 'High / Extreme',    icon: 'fa-fire',                 tone: 'red',    state: 'dashboard.manage_club.sms_risks', alert: true },
                { key: 'findings_open',       label: 'Open Findings',     icon: 'fa-clipboard-list',       tone: 'amber',  state: 'dashboard.manage_club.sms_audits' },
                { key: 'actions_open',        label: 'Open Actions',      icon: 'fa-list-check',           tone: '',       state: 'dashboard.manage_club.sms_actions' },
                { key: 'actions_overdue',     label: 'Overdue Actions',   icon: 'fa-clock',                tone: 'red',    state: 'dashboard.manage_club.sms_actions', alert: true },
                { key: 'audits_open',         label: 'Open Audits',       icon: 'fa-clipboard-check',      tone: '',       state: 'dashboard.manage_club.sms_audits' },
                { key: 'instructor_alerts',   label: 'Instructor Alerts', icon: 'fa-chalkboard-user',      tone: 'amber',  state: 'dashboard.manage_club.sms_instructors' },
                { key: 'instructor_expired',  label: 'Instructor Expired',icon: 'fa-user-clock',           tone: 'red',    state: 'dashboard.manage_club.sms_instructors', alert: true },
                { key: 'student_concerns_open', label: 'Student Concerns', icon: 'fa-user-graduate',       tone: 'amber',  state: 'dashboard.manage_club.sms_students' },
                { key: 'changes_open',        label: 'Open Changes',      icon: 'fa-shuffle',              tone: 'violet', state: 'dashboard.manage_club.sms_change' }
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
                SmsService.GetSettings(vm.club_id),
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
