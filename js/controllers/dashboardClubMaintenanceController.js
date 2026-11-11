 app.controller('DashboardClubMaintenanceController', DashboardClubMaintenanceController);

    DashboardClubMaintenanceController.$inject = ['UserService', 'PlaneService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$uibModal', '$log', '$window', 'LicenceService', 'MedicalService', 'DifferencesService', 'PlaneDocumentService', 'FoxService', '$http', 'WorkpackService', 'CrsService', 'LogbookLinkService', 'ToastService', 'DefectMediaService', 'AircraftChecksService', '$filter', 'MaintenanceFormService', '$q'];
    function DashboardClubMaintenanceController(UserService, PlaneService, $rootScope, $location, $scope, $state, $stateParams, $uibModal, $log, $window, LicenceService, MedicalService, DifferencesService, PlaneDocumentService, FoxService, $http, WorkpackService, CrsService, LogbookLinkService, ToastService, DefectMediaService, AircraftChecksService, $filter, MaintenanceFormService, $q) {
        var vm = this;
        // The pure page logic (severity tones, type-driven form, validation, reset,
        // outcome toast) lives in MaintenanceFormService so the node test can run it.
        var MF = MaintenanceFormService;
        vm.mf = MF;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {
            plane: {
                requirements: {
                    licence: [],
                    medical: [],
                    differences: []
                },
                documents: []
            }
        };

        vm.page_title = "";
        
        vm.plane_document = {};
        vm.plane_documents = [];

        var update_this_file = [];
        
        
        vm.currency_types = ["class", "type"];
        vm.gear_types = ["tricycle", "tailwheel", "monowheel", "floats", "skis"];

        vm.charge_type = ["brakes", "tacho", "hobbs"];
        vm.surcharge_type = ["none", "flight", "hour"];

        // Determine action from stateParams rather than $state.current.data.action,
        // because when a child state (e.g. airframe_logbook) is active, $state.current
        // points to the child whose data.action may differ from the parent's.
        // Two instances live at once under the detail state (the list template wraps a
        // <ui-view>); the parent one has no plane_id, so it is the list — falling back
        // to $state.current.data.action ('edit' there) made it fetch planes/undefined/….
        vm.action = $stateParams.plane_id ? 'edit' : 'list';
        vm.user = $rootScope.globals.currentUser;
        // //console.log("$rootScope.globals.currentUser : ", $rootScope.globals.currentUser);
        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user_id = vm.user.id;

        vm.show_overlay = false;
        vm.show_cert = false;
        vm.show_maintenance = false;
        vm.show_radio = false;
        vm.show_noise = false;
        vm.show_insurance = false;
        vm.show_offline = false;
        vm.show_crs = false;
        vm.crs_records = [];

        // Maintenance list view: false = table, true = cards
        vm.mxCardView = false;

        // The form state. freshObj(): check date + time default to now (decision 4),
        // hours / next check blank (U2). Reset after every successful save (U4 / B9).
        vm.obj = MF.freshObj();
        vm.files = MF.freshFiles();
        vm.saving = false;                  // U4: the panel stays open, busy, until the save resolves
        vm.steps = {};                      // optional collapsed steps of the check form (decision 1)
        vm.offline_confirm = false;         // U6: Take Offline is a two-step (explain → confirm)
        vm.show_workpack_form = false;      // "New workpack" from the card — the sub-form standalone
        vm.show_advanced = false;           // U21: the two rebuild buttons under an "Advanced" disclosure
        vm.detail_loading = false;          // U19
        vm.detail_error = null;             // U18: a refused / failed detail read is said on the page

       vm.reported_defects = [];

       // Decision 1: the check types the backend accepts for maintenance.maintenance_type.
       // 'extension' is a mode of the same panel (its own request block); 'workpack' is
       // no longer a check type (workpacks never create checks).
       vm.maintenance_types = MF.CHECK_TYPES.slice();
       vm.form_type_options = MF.CHECK_TYPES.concat(['extension']);
       // The edit-event panel must still show an old row's type ('extension', 'workpack', '').
       vm.editTypeOptions = function (current) {
           var list = MF.CHECK_TYPES.slice();
           if (current && list.indexOf(current) === -1) { list.push(current); }
           return list;
       };
       vm.typeLabel = MF.typeLabel;
       vm.nextCheckLabel = MF.nextCheckLabel;
       vm.fields = function () { return MF.fieldsFor(vm.obj.maintenance_type); };
       vm.hoursPlaceholder = function () { return MF.hoursPlaceholder(vm.obj.maintenance_type); };
       vm.nextCheckHint = function () { return MF.nextCheckHint(vm.obj.maintenance_type); };
       /**
        * The next-check date is required for every type (Alex, 10 Nov 2026). An hours check (25 / 50 / 100 h)
        * usually leaves the calendar date as it was, so when one is picked and the date is still blank it is
        * pre-filled from the aircraft's current due date (plane.maintenance.next_maintenance); the user can change it.
        */
       vm.prefillNextCheck = function () {
           var t = String(vm.obj.maintenance_type || '');
           if (!/hours$/.test(t) || vm.obj.next_check) { return; }
           var m = vm.club && vm.club.plane && vm.club.plane.maintenance;
           var due = m && m.next_maintenance ? String(m.next_maintenance).slice(0, 10) : '';
           var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
           if (!p) { return; }
           vm.obj.next_check = new Date(parseInt(p[1], 10), parseInt(p[2], 10) - 1, parseInt(p[3], 10));
       };
       vm.toggleStep = function (name) {
           vm.steps[name] = !vm.steps[name];
           // the CRS step (every check, owner 10 Nov 2026): the release date / time default to the check's own
           if (name === 'crs' && vm.steps.crs) {
               if (!vm.obj.crs_release_date && vm.obj.check_date) { vm.obj.crs_release_date = vm.obj.check_date; }
               if (!vm.obj.crs_release_time && vm.obj.check_time) { vm.obj.crs_release_time = vm.obj.check_time; }
           }
       };
       // B1: one severity → tone map for every defect badge on the page
       vm.severityBadgeClass = MF.severityBadgeClass;
       vm.severityChipClass = MF.severityChipClass;
       vm.severityShort = MF.severityShort;
       // B10 / B11 / U15
       vm.statusBadgeClass = MF.statusBadgeClass;
       vm.expiryDaysWord = MF.expiryDaysWord;      // "Expires today" / days (batch 17)
       vm.checkDaysWord = MF.checkDaysWord;        // "Due today" / days
       vm.hoursNotRecorded = MF.hoursNotRecorded;  // anchor check without hours (a legacy row)
       // an extension in force (owner, 10 Nov 2026): figures from the status block, who / when from the latest extension event
       vm.ext = null;
       vm.extWords = function () { return MF.extensionWords(vm.ext); };
       vm.hoursShort = MF.hoursShort;
       vm.refreshExtension = function () {
           vm.ext = MF.extensionInForce(vm.club && vm.club.plane ? vm.club.plane.maintenance : null, vm.maintenance_events);
       };
       vm.editExtension = function () { if (vm.ext && vm.ext.event) { vm.viewEvent(vm.ext.event); } };
       vm.isExtension = function (ev) { return !!ev && String(ev.maintenance_type) === 'extension'; };
       // the ARC row: the document's own extended_until (be-alex-3e, 10 Nov); an older backend: the extension in force
       vm.arcExtendedUntil = function (doc) {
           if (!doc) { return ''; }
           if (doc.extended_until !== undefined) { return doc.extended_until ? MF.displayDate(doc.extended_until) : ''; }
           return vm.ext && vm.ext.until ? vm.ext.untilText : '';
       };
       // the fleet list: the until-date of an extension in force on a row's status block ('' when none)
       vm.extUntilOf = function (m) { var e = MF.extensionInForce(m); return e && e.until ? e.untilText : ''; };
       vm.statusWord = MF.statusWord;
       vm.displayDate = MF.displayDate;
       vm.hoursDisplay = MF.hoursDisplay;

       // ── Workpacks ──
       vm.workpacks = [];
       vm.workpack = null;
       vm.open_workpacks = [];
       vm.new_workpack = {};
       vm.show_create_workpack = false;
       vm.show_workpack_detail = false;
       vm.workpack_files = { workpack_doc: [] };
       vm.defect_workpack_files = { defect_wp_doc: [] };
       vm.show_link_defect = false;
       vm.show_link_maintenance = false;
       vm.show_defect_workpack = false;
       vm.selected_defect_for_wp = null;
       vm.defect_wp = {};

       // ── Maintenance Events ──
       vm.maintenance_events = [];
       vm.selected_event = null;
       vm.show_event_detail = false;
       vm.event_filter = 'all';

       // ── Aircraft Checks (Transit / Check A) ──
       vm.aircraft_checks = [];
       vm.aircraft_checks_loading = false;
       vm.checks_filter_date = null;
       vm.checks_audit_log = [];
       vm.show_checks_audit = false;

       // ── Logbook Links ──
       vm.available_logbooks = [];
       vm.event_logbook_links = [];
       vm.logbook_checkboxes = [];
       vm.saving_logbook_links = false;
       vm.logbook_load_error = false;
       vm.create_logbook_checkboxes = [];
       vm.create_logbook_loading = false;
       vm.create_logbook_error = false;

      
        // ── List loading function (called on init and when returning from detail) ──
        function loadMaintenanceList() {
            vm.list_error = null;
            PlaneService.GetAllByClubMaintenance(vm.club_id)
                .then(function(data){
                    if (angular.isArray(data)) {
                        vm.club.planes = data;
                    } else {
                        // U18: a refused / failed read is said instead of an endless "Loading…"
                        vm.club.planes = [];
                        vm.list_error = (data && typeof data.message === 'string' && data.message) ? data.message : 'The fleet could not be loaded.';
                    }
                });
        }

        // ── Detail loading function (called on init and when returning from child states) ──
        // Every read has an error branch (U18): writeGuard's HANDLED_CODES swallows
        // FORBIDDEN etc., so a refused read would otherwise leave empty cards.
        function readMessage(data, fallback) {
            return (data && typeof data.message === 'string' && data.message) ? data.message : fallback;
        }

        function loadMaintenanceDetail() {
            vm.detail_loading = true;
            vm.detail_error = null;
            vm.this_plane_id = $stateParams.plane_id;
            PlaneService.GetByIdMaintenance2($stateParams.plane_id, vm.club_id)
                .then(function(data){
                    vm.detail_loading = false;
                    if (!data || data.success === false || !data.registration) {
                        vm.detail_error = readMessage(data, 'This aircraft could not be loaded.');
                        return;
                    }
                    vm.club.plane = data;
                    vm.refreshExtension();
                    // U2: the form never pre-fills from the current figures any more —
                    // hours / next check start blank with per-type placeholders.
                    vm.page_title = "Edit a Plane Maintenance - "+vm.club.plane.registration;
                });

            PlaneService.GetOpenIssues($stateParams.plane_id)
                .then(function (data) {
                    if (angular.isArray(data)) {
                        vm.reported_defects = data;
                    } else {
                        ToastService.error('Defects not loaded', readMessage(data, 'The open defects could not be loaded.'));
                    }
                });

            vm.loadWorkpacks();
            vm.loadOpenWorkpacks();
            vm.loadMaintenanceEvents();

            // Load aircraft checks for this plane
            vm.loadAircraftChecks();
        }

        // ── Aircraft Checks helpers ──
        vm.loadAircraftChecks = function() {
            if (!$stateParams.plane_id) return;
            vm.aircraft_checks_loading = true;
            AircraftChecksService.GetChecksByPlane($stateParams.plane_id)
                .then(function(data) {
                    vm.aircraft_checks_loading = false;
                    if (data && data.success) {
                        vm.aircraft_checks = data.checks;
                    } else {
                        ToastService.error('Checks not loaded', readMessage(data, 'The aircraft checks could not be loaded.'));
                    }
                });
        };

        vm.filterChecksByDate = function() {
            if (!vm.checks_filter_date || !$stateParams.plane_id) {
                vm.loadAircraftChecks();
                return;
            }
            vm.aircraft_checks_loading = true;
            var dateStr = $filter('date')(vm.checks_filter_date, 'yyyy-MM-dd');
            AircraftChecksService.GetChecksByPlaneDate($stateParams.plane_id, dateStr)
                .then(function(data) {
                    vm.aircraft_checks_loading = false;
                    if (data && data.success) {
                        vm.aircraft_checks = data.checks;
                    } else {
                        ToastService.error('Checks not loaded', readMessage(data, 'The aircraft checks for that day could not be loaded.'));
                    }
                });
        };

        vm.viewChecksAudit = function(check) {
            vm.show_checks_audit = true;
            vm.checks_audit_log = [];
            AircraftChecksService.GetAuditLog(check.id)
                .then(function(data) {
                    if (data && data.success) {
                        vm.checks_audit_log = data.audit_log;
                    } else {
                        ToastService.error('Audit not loaded', readMessage(data, 'The audit trail could not be loaded.'));
                    }
                });
        };

        // ONE logbook rebuild — the same Planes::rebuild_logbooks every other
        // "recheck" path lands on (BACKEND_AIRBORNE_SOURCE_GUIDE.md §7).
        vm.rebuild_logbooks_busy = false;
        vm.rebuild_logbooks = function(){
            if(!(vm.this_plane_id && vm.this_plane_id > 0) || vm.rebuild_logbooks_busy){ return; }
            vm.rebuild_logbooks_busy = true;
            PlaneService.UpdateAircraftLogbooks(vm.this_plane_id)
            .then(function(data){
                vm.rebuild_logbooks_busy = false;
                if(data && data.success){
                    ToastService.success('Logbooks Rebuilt', 'Airframe, engine and propeller logbooks were recalculated from the recorded flights.');
                    loadMaintenanceDetail();
                } else {
                    ToastService.error('Rebuild Failed', (data && data.message) || 'The logbooks could not be rebuilt.');
                }
            }, function(){
                vm.rebuild_logbooks_busy = false;
                ToastService.error('Rebuild Failed', 'The logbooks could not be rebuilt.');
            });
        };

        // Regenerates the UNCLAIMED tracker placeholder flights (fox/reset_aeroplane) —
        // not a logbook recalculation; the button says so now.
        vm.reset_aeroplane = function(){
            if(vm.this_plane_id && vm.this_plane_id > 0){
                var a = confirm("Rebuild tracker placeholders?\n\nThis deletes the UNCLAIMED tracker flights of the current tracker and recreates them from the tracker's recordings. Claimed and booked-in flights are not touched. Continue?");
                if(a){
                    FoxService.ResetOneClubPlane(vm.this_plane_id)
                    .then(function(data){
                        if(data && data.success){
                            ToastService.success('Placeholders Rebuilt', 'Unclaimed tracker flights were regenerated from the tracker\'s recordings.');
                            // Re-fetch so the recalculated hours / next-check show
                            // without a manual page refresh.
                            loadMaintenanceDetail();
                        } else {
                            // the club's admins or ToAviate staff only — FORBIDDEN otherwise
                            ToastService.error('Not rebuilt', (data && typeof data.message === 'string') ? data.message : 'The tracker placeholders could not be rebuilt.');
                        }
                        // //console.log(vm.club.planes);
                    });
                } else {
                    //ignore for now
                }
            } else {
                ToastService.error('Error', 'An unexpected error occurred.');
            }
        }

        //'9' needs to refer the the user's account set to manage
        vm.selected_type = "";
        vm.send_obj = {};
        // ONE panel, one mode at a time (decision 1): 'maintenance' is the type-driven
        // check form (the type chosen inside it decides the fields and the optional
        // steps); every document has its own mode; 'offline' explains + confirms;
        // 'workpack' is the new-workpack sub-form standalone (no check required).
        var MODES = ['cert', 'insurance', 'radio', 'noise', 'crs', 'offline', 'maintenance'];
        $scope.show_overlay = function(type){
            if (vm.saving) { return; }
            vm.show_overlay = true;
            vm.selected_type = type;
            for (var i = 0; i < MODES.length; i++) { vm['show_' + MODES[i]] = (MODES[i] === type); }
            vm.show_workpack_form = (type === 'workpack');
            vm.steps = {};
            vm.offline_confirm = false;
            // a fresh form every time: nothing from an earlier attempt leaks (B9)
            MF.resetAfterSave(vm);
            if (type === 'maintenance') {
                // Load available logbooks for the checkbox section
                vm.loadCreateLogbooks();
            }
       };
       vm.show_overlay_fn = $scope.show_overlay;

       $scope.close_overlay = function(){
            if (vm.saving) { return; }   // U4: never close under a save in flight
            vm.show_overlay = false;
            vm.offline_confirm = false;
       };
       vm.close_overlay = $scope.close_overlay;

       // The panel's title / primary button, by mode (U7: "Update ARC" / "Update Permit")
       vm.overlayTitle = function () {
           if (vm.show_maintenance) { return 'RECORD A CHECK'; }
           if (vm.show_offline) { return 'TAKE OFFLINE'; }
           if (vm.show_cert) { return (vm.club.plane && vm.club.plane.airworthiness_type === 'ptf') ? 'UPDATE PERMIT' : 'UPDATE ARC'; }
           if (vm.show_insurance) { return 'UPDATE INSURANCE'; }
           if (vm.show_radio) { return 'UPDATE RADIO LICENCE'; }
           if (vm.show_noise) { return 'UPDATE NOISE CERTIFICATE'; }
           if (vm.show_crs) { return 'UPDATE CRS'; }
           if (vm.show_workpack_form) { return 'NEW WORKPACK'; }
           return '';
       };
       vm.overlayAction = function () {
           if (vm.saving) { return 'Saving…'; }
           if (vm.show_maintenance) { return (vm.obj.maintenance_type === 'extension') ? 'Record extension' : 'Record check'; }
           if (vm.show_offline) { return vm.offline_confirm ? 'Confirm — take offline' : 'Continue'; }
           if (vm.show_cert) { return (vm.club.plane && vm.club.plane.airworthiness_type === 'ptf') ? 'Update Permit' : 'Update ARC'; }
           if (vm.show_insurance) { return 'Update Insurance'; }
           if (vm.show_radio) { return 'Update Radio Licence'; }
           if (vm.show_noise) { return 'Update Noise Certificate'; }
           if (vm.show_crs) { return 'Update CRS'; }
           if (vm.show_workpack_form) { return 'Create workpack'; }
           return 'Save';
       };


        // U15: a missing figure reads "No check recorded", never "N/A"
        $scope.get_hours_from_decimal = MF.hoursDisplay;



        $scope.filter_detail = function(show_all = 0){
                return (show_all == 0) ? {status: "open"} : {};
            }

            $scope.count_defects = function(defects, show_all = 0){

               var counter = 0;

               for(var i=0;i<defects.length;i++){
                   if(show_all == 1){
                       counter++;
                   } else {
                       if(defects[i].status == "open"){
                           counter++;
                       }
                   }
               }

               return counter;

           }




        // ─────────────────────────────────────────────────────────────
        // Format a Date / date-string as a plain YYYY-MM-DD using LOCAL
        // calendar values. This avoids the timezone drift that occurs
        // when a JS Date is JSON-serialized via toISOString() (UTC) — e.g.
        // a picker showing 2026-08-10 in UTC+10 would otherwise be sent
        // to the backend as 2026-08-09T14:00:00.000Z and stored as the
        // wrong day. Use this for every date-only field
        // (maintenance.expiry_date, extension.expiry_date,
        //  certificate expiry / date_issued, ARC date_expiry / date_issued,
        //  radio / insurance / noise expiry, offline_until, etc.).
        // ─────────────────────────────────────────────────────────────
        function toDateOnly(value) {
            if (value === null || value === undefined || value === '') return value;
            // Already a YYYY-MM-DD string — leave it alone.
            if (typeof value === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
                // Strip any trailing time / timezone from a longer string.
                var m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
                if (m) return m[1];
                // Fall through and let moment parse it.
            }
            var mom = moment(value);
            if (!mom.isValid()) return value;
            return mom.format('YYYY-MM-DD');
        }
        vm.toDateOnly = toDateOnly;

        // ─────────────────────────────────────────────────────────────
        // The panel's Save. One mode at a time; validation first (toast + stay open);
        // then the request, with the panel kept open and busy until it resolves
        // (U4 / B9): close + reset on success only, one combined outcome toast (B13).
        // Modes: maintenance (check or extension) → POST planes/{p}/maintenance;
        // documents (cert / insurance / radio / noise) → the same route; CRS → its own
        // endpoint; offline → explain, then confirm, then the request; workpack → the
        // standalone create.
        // ─────────────────────────────────────────────────────────────
        $scope.save_overlay = function(){
            if (vm.saving) { return false; }

            if (vm.show_workpack_form) { return saveWorkpackStandalone(); }
            if (vm.show_crs) { return vm.saveCrsStandalone(); }
            if (vm.show_offline) { return saveOffline(); }

            var send_obj = {};
            var send_update = false;
            var v;

            // ── Documents (their own modes, or the annual's optional ARC step) ──
            if (vm.show_radio) {
                if (!vm.files.radio[0]) {
                    ToastService.warning('Radio licence file required', 'Upload the new radio licence (PDF or image). The expiry date is optional.');
                    return false;
                }
                send_obj.radio = {
                    file: vm.files.radio[0].file,
                    // Date-only field — LOCAL calendar day, never Date.toISOString()
                    expiry: vm.obj.radio_expiry ? toDateOnly(vm.obj.radio_expiry) : ''
                };
                send_update = true;
            }

            var arcStep = vm.show_maintenance && vm.fields().step_arc && vm.steps.arc;
            if (vm.show_cert || arcStep) {
                var hasCertFile = !!vm.files.cert[0];
                var hasCertExpiry = !!vm.obj.certificate_expiry;
                var docName = (vm.club.plane && vm.club.plane.airworthiness_type === 'ptf') ? 'Permit to Fly' : 'ARC';
                if (vm.show_cert && (!hasCertFile || !hasCertExpiry)) {
                    ToastService.warning(docName + ' incomplete', 'Both the ' + docName + ' document and its expiry date are required.');
                    return false;
                }
                if (arcStep && (hasCertFile !== hasCertExpiry)) {
                    ToastService.warning(docName + ' incomplete', 'Add both the ' + docName + ' document and its expiry date, or leave the step empty.');
                    return false;
                }
                if (hasCertFile && hasCertExpiry) {
                    send_obj.cert = {
                        file: vm.files.cert[0].file,
                        expiry: toDateOnly(vm.obj.certificate_expiry),
                        date_issued: toDateOnly(vm.obj.certificate_issue)
                    };
                    send_update = true;
                }
            }

            if (vm.show_insurance) {
                if (!vm.files.insurance[0] || !vm.obj.insurance_expiry) {
                    ToastService.warning('Insurance incomplete', 'Both the insurance certificate and its expiry date are required.');
                    return false;
                }
                send_obj.insurance = {
                    file: vm.files.insurance[0].file,
                    expiry: toDateOnly(vm.obj.insurance_expiry)
                };
                send_update = true;
            }

            if (vm.show_noise) {
                if (!vm.files.noise_cert[0] || !vm.obj.noise_date) {
                    ToastService.warning('Noise certificate incomplete', 'Both the noise certificate and its issue date are required.');
                    return false;
                }
                send_obj.noise_cert = {
                    file: vm.files.noise_cert[0].file,
                    noise_level: vm.obj.noise_level,
                    date_issued: toDateOnly(vm.obj.noise_date)
                };
                send_update = true;
            }

            // ── CRS as the annual's optional step (its own endpoint, after the check) ──
            var crsStep = vm.show_maintenance && vm.fields().step_crs && vm.steps.crs;
            if (crsStep) {
                var hasCrsFile = !!vm.files.crs[0];
                var hasCrsWhen = !!(vm.obj.crs_release_date && vm.obj.crs_release_time);
                if (hasCrsFile !== hasCrsWhen) {
                    ToastService.warning('CRS incomplete', 'Add the CRS document with its release date and time, or leave the step empty.');
                    return false;
                }
                if (hasCrsFile) {
                    send_obj.crs = {
                        plane_id: parseInt(vm.this_plane_id),
                        release_date: toDateOnly(vm.obj.crs_release_date),
                        release_time: MF.hms(vm.obj.crs_release_time),
                        file: vm.files.crs[0].file
                    };
                    send_update = true;
                }
            }

            // ── The check / extension (type-driven, decision 1) ──
            var ticked = MF.resolvedDefects(vm.reported_defects);
            if (vm.show_maintenance) {
                var f = vm.fields();
                if (!f.chosen) {
                    ToastService.warning('Check type required', 'Choose what you are recording first.');
                    return false;
                }
                if (f.extension) {
                    v = MF.validateExtension(vm.obj, vm.reported_defects);
                    if (!v.ok) { ToastService.warning(v.title, v.message); return false; }
                    send_obj.extension = MF.buildExtensionBlock(vm.obj);
                } else {
                    v = MF.validateCheck(vm.obj, vm.reported_defects);
                    if (!v.ok) { ToastService.warning(v.title, v.message); return false; }
                    send_obj.maintenance = MF.buildCheckBlock(vm.obj);
                    if (vm.steps.workpack && vm.obj.workpack_option === 'new') {
                        var wv = MF.validateWorkpack(vm.new_workpack);
                        if (!wv.ok) { ToastService.warning(wv.title, wv.message); return false; }
                    }
                }
                send_update = true;
                // U10 / B7: the engineer confirmation is enforced by validateCheck /
                // validateExtension whenever a defect is ticked
                if (ticked.length > 0) {
                    send_obj.issues = ticked;
                }
            }

            if (!send_update) {
                ToastService.warning('Nothing to save', 'Fill in the form first.');
                return false;
            }

            vm.send_obj = send_obj;
            vm.saving = true;

            // Follow-up saves after the check: each reports an outcome for the one toast.
            var outcomes = [];
            function outcome(label, promise) {
                return $q.when(promise).then(function (d) {
                    var ok = !!(d && d.success !== false);
                    outcomes.push({ label: label, ok: ok, message: ok ? '' : readMessage(d, 'not saved') });
                    return d;
                }, function () {
                    outcomes.push({ label: label, ok: false, message: 'not saved' });
                });
            }

            function saveDefectWorkpacks(workpackId) {
                var ps = [];
                for (var d = 0; d < ticked.length; d++) {
                    var def = ticked[d];
                    if (workpackId && def._link_to_workpack) {
                        ps.push(outcome('Defect "' + (def.defect || '').slice(0, 30) + '" workpack link', WorkpackService.LinkDefect(workpackId, def.id)));
                    } else if (def.defect_workpack_number || def.defect_workpack_signatory || def._uploaded_file) {
                        var payload = {
                            workpack_number: def.defect_workpack_number || '',
                            signatory: def.defect_workpack_signatory || ''
                        };
                        if (def._uploaded_file) {
                            payload.document_temp_path = def._uploaded_file.temp_path;
                            payload.document_extension = def._uploaded_file.extension;
                            payload.document_original_name = def._uploaded_file.name;
                        }
                        ps.push(outcome('Defect "' + (def.defect || '').slice(0, 30) + '" workpack', WorkpackService.UpdateDefectWorkpack(def.id, payload)));
                    }
                }
                return $q.all(ps);
            }

            function saveFollowUps(data) {
                var ps = [];
                if (send_obj.crs) {
                    // the CRS records the check it was issued for (plane_crs.maintenance_check_id, 10 Nov 2026)
                    if (data.maintenance_check_id) { send_obj.crs.maintenance_check_id = data.maintenance_check_id; }
                    ps.push(outcome('CRS', CrsService.Create(send_obj.crs)));
                }
                if (data.maintenance_check_id) {
                    var links = vm.saveCreateLogbookLinks(data.maintenance_check_id);
                    if (links) { ps.push(outcome('Logbook links', links)); }
                }
                if (send_obj.maintenance && vm.steps.workpack && vm.obj.workpack_option === 'new' && vm.new_workpack.workpack_number) {
                    var wp = {
                        club_id: vm.club_id,
                        plane_id: parseInt(vm.this_plane_id),
                        workpack_number: vm.new_workpack.workpack_number,
                        authorised_signatory: vm.new_workpack.authorised_signatory,
                        description: vm.new_workpack.description,
                        status: vm.new_workpack.status || 'completed',
                        created_by_user_id: vm.user_id
                    };
                    if (data.maintenance_check_id) { wp.maintenance_check_id = data.maintenance_check_id; }
                    if (vm.workpack_files.workpack_doc && vm.workpack_files.workpack_doc.length > 0) {
                        var wf = vm.workpack_files.workpack_doc[0];
                        wp.document_temp_path = wf.temp_path;
                        wp.document_extension = wf.extension;
                        wp.document_original_name = wf.name;
                    }
                    ps.push(outcome('Workpack', WorkpackService.Create(wp)).then(function (wpData) {
                        return saveDefectWorkpacks(wpData && wpData.success ? wpData.id : null);
                    }));
                } else {
                    ps.push(saveDefectWorkpacks(null));
                }
                return $q.all(ps);
            }

            var primaryTitle = send_obj.maintenance ? 'Check recorded'
                : send_obj.extension ? 'Extension recorded'
                : send_obj.cert ? ((vm.club.plane && vm.club.plane.airworthiness_type === 'ptf') ? 'Permit updated' : 'ARC updated')
                : send_obj.insurance ? 'Insurance updated'
                : send_obj.radio ? 'Radio licence updated'
                : send_obj.noise_cert ? 'Noise certificate updated'
                : 'Saved';

            // Only a CRS (annual step without a check body) never happens: the check is
            // always in the body in maintenance mode. Documents-only modes post the same route.
            PlaneService.AddMaintenance(vm.this_plane_id, send_obj)
                .then(function (data) {
                    // handleError2 resolves with success:false — refusals come as
                    // {success:false, error, message}; say the message and stay open.
                    if (!data || data.success === false) {
                        vm.saving = false;
                        ToastService.error('Not saved', readMessage(data, 'The maintenance update could not be saved. Nothing was changed — check the form and try again.'));
                        return;
                    }
                    return saveFollowUps(data).then(function () {
                        var t = MF.outcomeToast(primaryTitle, outcomes, data.documents_refused);
                        if (t.kind === 'success') { ToastService.success(t.title, t.message); } else { ToastService.warning(t.title, t.message); }
                        MF.resetAfterSave(vm);
                        vm.show_overlay = false;
                        loadMaintenanceDetail();
                    });
                }, function () {
                    vm.saving = false;
                    ToastService.error('Not saved', 'The server could not be reached. Nothing was changed — try again.');
                });
            return true;
        };
        vm.save_overlay = $scope.save_overlay;

        // U6: Take Offline — explain what happens, confirm, then the request.
        function saveOffline() {
            var v = MF.validateOffline(vm.obj, new Date());
            if (!v.ok) { ToastService.warning(v.title, v.message); return false; }
            if (!vm.offline_confirm) {
                vm.offline_confirm = true;   // second click confirms
                return false;
            }
            vm.saving = true;
            PlaneService.AddMaintenance(vm.this_plane_id, { offline: MF.buildOfflineBlock(vm.obj, vm.club_id) })
                .then(function (data) {
                    if (!data || data.success === false) {
                        vm.saving = false;
                        vm.offline_confirm = false;
                        ToastService.error('Not taken offline', readMessage(data, 'The aircraft could not be taken offline. Nothing was changed.'));
                        return;
                    }
                    ToastService.success('Aircraft offline', vm.club.plane.registration + ' is offline until ' + MF.displayDate(vm.obj.offline_until) + '. Clashing bookings of this club were moved to the waiting list and those members e-mailed.');
                    MF.resetAfterSave(vm);
                    vm.show_overlay = false;
                    loadMaintenanceDetail();
                }, function () {
                    vm.saving = false;
                    vm.offline_confirm = false;
                    ToastService.error('Not taken offline', 'The server could not be reached. Nothing was changed — try again.');
                });
            return true;
        }

        // "New workpack" from the Workpacks card — the sub-form standalone (no check
        // required; the backend no longer creates a check for it).
        function saveWorkpackStandalone() {
            var v = MF.validateWorkpack(vm.new_workpack);
            if (!v.ok) { ToastService.warning(v.title, v.message); return false; }
            vm.saving = true;
            vm.createWorkpack().then(function (ok) {
                vm.saving = false;
                if (ok) {
                    ToastService.success('Workpack created', 'Workpack ' + (vm.new_workpack_last_number || '') + ' was added to this aircraft.');
                    MF.resetAfterSave(vm);
                    vm.show_overlay = false;
                }
            });
            return true;
        }

        $scope.check_ticked = function(){
            vm.one_ticked = MF.resolvedDefects(vm.reported_defects).length > 0;
        };
        vm.check_ticked = $scope.check_ticked;

        $scope.back = function(){
            $rootScope.safeBack();
        }

        $scope.save = function(){
            if(vm.action == "add"){
                $scope.create();
            } else {
                $scope.update();
            }
        }


        $scope.create = function(){
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;
            PlaneService.Create(vm.club.plane)
                .then(function(data){
                    $state.go('dashboard.manage_club.planes', {reload: true});

                });
        }

        function get_update_docs(){
            var documents = [];

            for(var i=0;i<update_this_file.length;i++){
                var id = update_this_file[i];
                // //console.log("looking for : ", id);
                // //console.log("in: ", vm.plane_documents);

                for(var k=0;k<vm.club.plane.plane_documents.length;k++){
                    // //console.log("comparing to : ", vm.club.plane.plane_documents[k].id);
                    if(vm.club.plane.plane_documents[k].id == id){
                        documents.push(vm.club.plane.plane_documents[k]);
                    }
                }

            }

            // //console.log("DOCS TO UPDATE : ", documents);

            return documents;
        }

        $scope.update = function(){
            // //console.log("CLICK");
            vm.club.plane.club_id = vm.club_id;
            vm.club.plane.add_documents = vm.plane_documents;

            vm.club.plane.update_documents = get_update_docs();
            //get_update_docs();

            PlaneService.Update(vm.club.plane)
                .then(function(data){
                    // //console.log(data);
                    // //console.log("saved");
                    $state.go('dashboard.manage_club.planes');
                });
        }


        function containsObject(obj, list, params) {

            // //console.log("obj", obj);
            // //console.log("list", list);
            // //console.log("params", params);

            for(var i=0; i<list.length; i++) {
                // //console.log("list i : ", list[i]);
                // //console.log("obj is: ", obj);

                var count_success = 0;
                for(var j=0;j<params.length;j++){
                    if(list[i][params[j]] && obj[params[j]] && list[i][params[j]] == obj[params[j]]){
                        count_success++;
                    }
                }

                if(count_success === params.length) {                    
                    return true;
                }
            }

            return false;
        }


        function check_all(){

            //maybe a nice to have one day... not yet though.


            //licences
            vm.club.plane.requirements.licence.forEach(function(obj){

            });

        }

      


        $scope.add_item = function(type){
            // //console.log("ADD");
            switch(type){
                case "licence":
                    // //console.log("licence");
                    if(vm.temporary.licence && vm.temporary.licence !== "" && vm.temporary.rating && vm.temporary.rating !== ""){
                        //then we can add it
                        // //console.log("here we go");
                        var add_licence = {
                            licence_id: vm.temporary.licence.id,
                            licence_title: vm.temporary.licence.abbreviation,
                            rating_title: vm.temporary.rating.abbreviation,
                            rating_id: vm.temporary.rating.id
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
                            vm.club.plane.requirements.licence.push(add_licence);
                        }

                        delete vm.temporary.licence;
                        delete vm.temporary.rating;

                    } else {
                        ToastService.warning('Missing Selection', 'Please select a licence and rating required to book the plane solo.');
                    }

                break;


                case "medical":
                    //console.log("medical");
                    if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_medical = {
                            authority_id: vm.temporary.medical_authority.id,
                            authority_title: vm.temporary.medical_authority.abbreviation,
                            medical_component_id: vm.temporary.medical_component.id,
                            medical_component_title: vm.temporary.medical_component.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
                            vm.club.plane.requirements.medical.push(add_medical);
                        }

                        delete vm.temporary.medical_authority;
                        delete vm.temporary.medical_component;

                    } else {
                        ToastService.warning('Missing Selection', 'Please select a medical required to book the plane solo.');
                    }

                break;


                case "differences":
                    //console.log("difference");
                    if(vm.temporary.difference && vm.temporary.difference !== ""){
                        //then we can add it
                        //console.log("here we go");
                        var add_difference = {
                            difference_id: vm.temporary.difference.id,
                            difference_title: vm.temporary.difference.title
                        };

                        //check if it doesnt exist first...
                        if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
                            vm.club.plane.requirements.differences.push(add_difference);
                        }

                        delete vm.temporary.difference;

                    } else {
                        ToastService.warning('Missing Selection', 'Please select a differences training required to book the plane solo.');
                    }

                break;


            }



        }


        $scope.remove_item = function(type, index){
            //console.log("REMOVE");

            vm.club.plane.requirements[type].splice(index, 1);


            // switch(type){
            //     case "licence":
            //             //console.log("licence");
                   
            //             //check if it doesnt exist first...
            //             // if(containsObject(add_licence, vm.club.plane.requirements.licence, new Array("licence_id", "rating_id")) == false){
            //             //     vm.club.plane.requirements.licence.push(add_licence);
            //             // }

            //             vm.club.plane.requirements.licence.splice(index, 1);
                      
                   

            //     break;


            //     case "medical":
            //         //console.log("medical");
            //         if(vm.temporary.medical_authority && vm.temporary.medical_authority !== "" && vm.temporary.medical_component && vm.temporary.medical_component !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_medical = {
            //                 authority_id: vm.temporary.medical_authority.id,
            //                 authority_title: vm.temporary.medical_authority.abbreviation,
            //                 medical_component_id: vm.temporary.medical_component.id,
            //                 medical_component_title: vm.temporary.medical_component.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_medical, vm.club.plane.requirements.medical, new Array("authority_id", "medical_component_id")) == false){
            //                 vm.club.plane.requirements.medical.push(add_medical);
            //             }

            //             delete vm.temporary.medical_authority;
            //             delete vm.temporary.medical_component;

            //         } else {
            //             alert("Please select a medical that is required to book the plane solo!");
            //         }

            //     break;


            //     case "differences":
            //         //console.log("difference");
            //         if(vm.temporary.difference && vm.temporary.difference !== ""){
            //             //then we can add it
            //             //console.log("here we go");
            //             var add_difference = {
            //                 difference_id: vm.temporary.difference.id,
            //                 difference_title: vm.temporary.difference.title
            //             };

            //             //check if it doesnt exist first...
            //             if(containsObject(add_difference, vm.club.plane.requirements.differences, new Array("difference_id", "difference_title")) == false){
            //                 vm.club.plane.requirements.differences.push(add_difference);
            //             }

            //             delete vm.temporary.difference;

            //         } else {
            //             alert("Please select a difference that is required to book the plane solo!");
            //         }

            //     break;


            // }



        }
















        $scope.update_this_file = function(file){
            //console.log("==== update is : ", file.id);
            if(update_this_file.indexOf(file.id) === -1){
                update_this_file.push(file.id)
            } else {
               ////console.log("This item already exists"); 
            } 
        }


         $scope.remove_real_file = function(file){

                //remove_file

                vm.club.plane.plane_documents = $.grep(vm.club.plane.plane_documents, function(e){ 
                        return e.id != file.id; 
                    });

                //no need to actually remove the file as it will be archived accordingly on the backend whilst it is missing! :)
                PlaneDocumentService.Delete(vm.user_id, file.id)
                .then(function (data) {
                    // //console.log(data);
                    if(data.success){
                        // //console.log("HUZZAH", current_files);
                        //then we need to remove this from the list of files...
                        //clear files
                        vm.plane_documents = [];
                        //and re-process available files
                        $scope.processFiles(current_files);

                    } else {
                        //console.log("WOOOPSIES...");
                        //this should be very very rare...
                    }

                });

          }


          
          $scope.remove_file = function(file, current_files){

            //remove_file
            var j = JSON.parse(file.file_return);
            // //console.log("REMOVE: ", j);
            // //console.log("REMOVE: ", j.saved_url);

            //to delete the temp file created: j.saved_url
            //tmp_rm.php POST tmp = filename
            

            //this SHOULD BE TO THE CURRENT POSITION

            // PoidService.DeleteTmp(j.saved_url)
            //     .then(function (data) {
            //         //console.log(data);
            //         if(data.success){
            //             //console.log("HUZZAH", current_files);
            //             //then we need to remove this from the list of files...
            //             //clear files
            //             vm.plane_documents = [];
            //             //and re-process available files
            //             $scope.processFiles(current_files);

            //         } else {
            //             //console.log("WOOOPSIES...");
            //             //this should be very very rare...
            //         }

            //     });

          }
          

          // $scope.$on('flow::fileAdded', function (event, $flow, flowFile) {
          //     event.preventDefault();//prevent file from uploading
          //     //console.log("FILE ADDED");
          //     //console.log($flow);
          //   });

            // vm.files is initialised with the form state above (MF.freshFiles()) and
            // reset after every successful save. A cancelled upload clears its slot so
            // a later upload is the one sent (B9).
            vm.removeUpload = function (location) {
                if (vm.files && vm.files[location]) { vm.files[location] = []; }
            };


            $scope.processFiles = function(files, location){
                // //console.log("files", files);

                for(var i=0; i<files.length; i++){
                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[i].file_return);
                    // //console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    files[i].file.temp_path = j.saved_url;
                    files[i].file.save_name = j.files.file.name;
                    var ft = j.files.file.name;
                    ft = ft.split('.').pop();
                    files[i].file.extension = ft;

                    // //console.log("file", files[i].file);
                    vm.files[location].push(files[i].file);
                }


            }


            /**
             * A finished upload whose answer says success:false (10 Nov 2026: an image the server could not read, or a
             * HEIC where it has no converter) is reported and taken out of the drop zone; true when the file is usable.
             */
            function mxUploadAccepted(j, flowFile) {
                if (j && j.success !== false) { return true; }
                ToastService.error('Upload failed', (j && j.message) || 'That file could not be uploaded. Please try a PDF, JPG or PNG.');
                if (flowFile && typeof flowFile.cancel === 'function') { flowFile.cancel(); }
                return false;
            }

             $scope.processFile = function(files, location){
                 //console.log("files", files[0].file_return);

                    // //console.log("JSON", files[i].file_return);
                    var j = JSON.parse(files[0].file_return);
                    // //console.log("PARSED", j);
                    // //console.log("J is : ",j);
                    // //console.log("name is : ", j.files.file.name);

                    if (!mxUploadAccepted(j, files[0])) { return; }
                    files[0].file.temp_path = j.saved_url;
                    files[0].file.save_name = j.files.file.name;

                    var ft = j.files.file.name;
                    // //console.log("ft", ft);
                    var fft = ft.split('.').pop();
                    // the stored extension is the upload's answer (every image is stored as a JPEG since 10 Nov 2026)
                    files[0].file.extension = j.extension || fft;
                    // //console.log("FILE is : ", files[0]);

                    // //console.log("file", files[i].file);
                    vm.files[location].push(files[0]);


            }

            $scope.set_title = function(file){
                // //console.log("return", file);
                return file.save_name;
            }

            $scope.get_icon = function(file){

                var ft = file.name;
                ft = ft.split('.').pop();
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }


            $scope.get_icon2 = function(file){
                ////console.log("FILE", file);
                if(!file || file == ""){
                    return "";
                }
                var ft = file.split('.').pop();
                // //console.log("ICON 2 : ", ft);
                var icon_name = "";

                // //console.log("FILE:", ft);
                // //console.log("index : ", ft.indexOf("pdf"));
                switch(true){
                    case (ft.indexOf("pdf") > -1):
                        icon_name = "pdf.png";
                    break;
                    case (ft.indexOf("doc") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("docx") > -1):
                        icon_name = "doc.png";
                    break;
                    case (ft.indexOf("xls") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("xlsx") > -1):
                        icon_name = "xls.png";
                    break;
                    case (ft.indexOf("ppt") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("pptx") > -1):
                        icon_name = "ppt.png";
                    break;
                    case (ft.indexOf("jpg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("jpeg") > -1):
                        icon_name = "jpg.png";
                    break;
                    case (ft.indexOf("png") > -1):
                        icon_name = "png.png";
                    break;
                    case (ft.indexOf("gif") > -1):
                        icon_name = "gif.png";
                    break;
                    case (ft.indexOf("zip") > -1):
                        icon_name = "zip.png";
                    break;
                    case (ft.indexOf("avi") > -1):
                        icon_name = "avi.png";
                    break;
                    case (ft.indexOf("mp4") > -1):
                        icon_name = "mp4.png";
                    break;
                    default:
                        icon_name = "file.png";
                    break;
                }

                // //console.log("FILE:", icon_name);

                return "images/file_icons/"+icon_name;
            }


            vm.defect_severity;
                vm.defect_severities = [
                    { title: "No Fly Item - Ground the plane"},
                    { title: "Flyable - needs to be checked at next maintenance"},
                    { title: "Not urgent - but needs noting"},
                    { title: "Unsure of severity"}
                ]; 


            // ── Defect report panel state ──
            vm.showDefectPanel = false;
            vm.defectPanelRegistration = '';

            vm.openDefectPanel = function () {
                vm.defectPanelRegistration = vm.club.plane.registration;
                vm.showDefectPanel = true;
            };

            vm.closeDefectPanel = function () {
                vm.showDefectPanel = false;
            };

            vm.submitDefect = function (defectData, pendingFiles) {
                var obj = {
                    club_id:  vm.club_id,
                    user_id:  vm.user_id,
                    plane_id: vm.this_plane_id,
                    defect:   defectData.defect,
                    severity: defectData.severity,
                    status:   'open'
                };

                PlaneService.AddDefect(obj)
                    .then(function (data) {
                        if (!data || !data.item) {
                            ToastService.error('Defect Error', (data && data.message) || 'The defect could not be saved.');
                            return;
                        }
                        data.item.can_delete = true;
                        vm.club.plane.defects.push(data.item);
                        // Keep the maintenance overlay's "resolve defects" list in
                        // sync too — it renders vm.reported_defects, not plane.defects.
                        vm.reported_defects.push(data.item);
                        ToastService.success('Defect Reported', 'The defect has been submitted.');

                        if (pendingFiles && pendingFiles.length > 0) {
                            pendingFiles.forEach(function (file, idx) {
                                DefectMediaService.UploadAndAttach(file, data.item.id, vm.club_id, idx, vm.user_id)
                                    .then(function (mediaResult) {
                                        if (mediaResult && mediaResult.success) {
                                            data.item.media_count = (data.item.media_count || 0) + 1;
                                        }
                                    });
                            });
                        }

                        vm.showDefectPanel = false;
                        vm.defect = '';
                        vm.defect_severity = '';
                    });
            };


            $scope.delete_poid = function(id){

              
                var a = prompt("Are you sure you wish to delete this poid? \n\n This change is irreversible! To confirm please type YES in the box below.");
                if(a == "YES"){


                    //console.log("WE DELETE IT");


                    // PoidService.Delete(vm.user_id, id)
                    //     .then(function (data) {
                    //         //console.log(data);
                    //         if(data.success){
                    //             //console.log("HUZZAH", data);
                    //             //then we need to remove this from the list of files...
                    //             vm.user_poids = $.grep(vm.user_poids, function(e){ 
                    //                 return e.id != id; 
                    //             });
                                
                    //             //refresh?
                    //             $state.reload();
                    //             $state.go('dashboard.my_account.poid');

                    //         } else {

                    //             alert("Something went terribly wrong... \n\n "+data.message);

                    //         }

                    //     });



                } else {
                    //console.log("ignore123");
                }


            }




            $scope.save_plane_documents = function(){

               
              

                // //console.log("plane_documents: ", vm.plane_documents);


                //compile the required elements YAY

                // //console.log("plane_document ", vm.plane_document);


                 //clean shizzle before sending
                 //why keep sending back heavy data?

                    // for(var i=0;i<vm.plane_document.images.length;i++){
                    //     delete vm.plane_document.images[i].data_uri;
                    // }

                    // // vm.plane_document.images = vm.plane_documents;
                    // vm.plane_document.images = vm.plane_document.images.concat(vm.plane_documents);
                    // vm.plane_document.user_id = vm.user_id;




            //     if(vm.plane_document.id){
            //         //then its an udpate

            //         //merge the images left?
            //         PoidService.Update(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                     $state.go('dashboard.my_account.poid', {}, { reload: true });





            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });

            //     } else {


                   


            //         //then its a create
            //         //console.log(vm.plane_document);

            //         PoidService.Create(vm.plane_document)
            //             .then(function (data) {
            //                 //console.log(data);
            //                 if(data.success){
            //                     //console.log("HUZZAH", vm.plane_document);
            //                     //console.log("HUZZAH", data);
            //                     //then we need to remove this from the list of files...
                                
                                
            //                     //move somewhere?
            //                    // $state.reload();
            //                    // $state.go('dashboard.my_account.poid', {}, { reload: true });


            //                 } else {

            //                     alert("Something went terribly wrong... \n\n "+data.message);

            //                 }

            //             });


            //     }



             };




             $scope.change_file_name = function(file){
                
                //this is terribly ineficient... unfortunately... can't 
                //work out how else to do it! (lol)

                // //console.log("TO BE CHANGED", file);

                // //console.log("BEFORE BEFORE", vm.plane_documents);

                vm.plane_documents = $.grep(vm.plane_documents, function(e){ 
                    return e.temp_path != file.temp_path; 
                });

                // //console.log("BEFORE", vm.plane_documents);

                vm.plane_documents.push(file);

                // //console.log("AFTER", vm.plane_documents);

             }


        // ═══════════════════════════════════════════════
        // WORKPACK METHODS
        // ═══════════════════════════════════════════════

        vm.loadWorkpacks = function () {
            if (!vm.this_plane_id) return;
            WorkpackService.GetByPlane(vm.this_plane_id)
                .then(function (data) {
                    if (data && data.success !== false) {
                        vm.workpacks = data.workpacks || [];
                    } else {
                        ToastService.error('Workpacks not loaded', readMessage(data, 'The workpacks could not be loaded.'));
                    }
                });
        };

        vm.loadOpenWorkpacks = function () {
            if (!vm.this_plane_id) return;
            WorkpackService.GetOpenByPlane(vm.this_plane_id)
                .then(function (data) {
                    if (data && data.success !== false) {
                        vm.open_workpacks = data.workpacks || [];
                    }
                    // the "link to an open workpack" option only — the full list toasts above
                });
        };

        // Standalone create (the "New workpack" button on the card). Resolves true on
        // success, false on a refusal (which is toasted with the server's message).
        vm.createWorkpack = function () {
            var wp = {
                club_id: vm.club_id,
                plane_id: parseInt(vm.this_plane_id),
                workpack_number: vm.new_workpack.workpack_number,
                authorised_signatory: vm.new_workpack.authorised_signatory,
                description: vm.new_workpack.description,
                status: vm.new_workpack.status || 'completed',
                created_by_user_id: vm.user_id
            };

            // If a document was uploaded
            if (vm.workpack_files.workpack_doc && vm.workpack_files.workpack_doc.length > 0) {
                var f = vm.workpack_files.workpack_doc[0];
                wp.document_temp_path = f.temp_path;
                wp.document_extension = f.extension;
                wp.document_original_name = f.name;
            }

            return WorkpackService.Create(wp)
                .then(function (data) {
                    if (data && data.success) {
                        vm.new_workpack_last_number = wp.workpack_number;
                        vm.show_create_workpack = false;
                        vm.new_workpack = { status: 'completed' };
                        vm.workpack_files = { workpack_doc: [] };
                        vm.loadWorkpacks();
                        vm.loadOpenWorkpacks();
                        return true;
                    }
                    ToastService.error('Workpack not created', readMessage(data, 'The workpack could not be created.'));
                    return false;
                }, function () {
                    ToastService.error('Workpack not created', 'The server could not be reached.');
                    return false;
                });
        };

        vm.viewWorkpack = function (id) {
            WorkpackService.GetById(id)
                .then(function (data) {
                    if (data && data.success !== false && data.workpack) {
                        vm.workpack = data.workpack;
                        vm.show_workpack_detail = true;
                    } else {
                        ToastService.error('Workpack not loaded', readMessage(data, 'The workpack could not be loaded.'));
                    }
                });
        };

        // U18: every workpack write says why it was refused (writeGuard swallows the codes)
        function workpackWrite(label, promise, onOk) {
            return $q.when(promise).then(function (data) {
                if (data && data.success) {
                    if (onOk) { onOk(data); }
                } else {
                    ToastService.error(label, readMessage(data, 'The change was not saved.'));
                }
                return data;
            }, function () {
                ToastService.error(label, 'The server could not be reached.');
            });
        }
        function refreshWorkpack() {
            if (vm.workpack) { vm.viewWorkpack(vm.workpack.id); }
            vm.loadWorkpacks();
            vm.loadOpenWorkpacks();
        }

        vm.closeWorkpackDetail = function () {
            vm.workpack = null;
            vm.show_workpack_detail = false;
            vm.show_link_defect = false;
            vm.show_link_maintenance = false;
        };

        vm.updateWorkpack = function (field, value) {
            if (!vm.workpack) return;
            var update = {};
            update[field] = value;
            workpackWrite('Workpack not updated', WorkpackService.Update(vm.workpack.id, update), refreshWorkpack);
        };

        vm.completeWorkpack = function () {
            if (!vm.workpack) return;
            var a = confirm('Are you sure you want to mark this workpack as completed?');
            if (a) {
                workpackWrite('Workpack not completed', WorkpackService.Update(vm.workpack.id, { status: 'completed' }), refreshWorkpack);
            }
        };

        vm.reopenWorkpack = function () {
            if (!vm.workpack) return;
            workpackWrite('Workpack not reopened', WorkpackService.Update(vm.workpack.id, { status: 'open' }), refreshWorkpack);
        };

        vm.deleteWorkpack = function () {
            if (!vm.workpack) return;
            var a = confirm('Are you sure you want to delete (archive) this workpack? This will unlink all defects and maintenance events.');
            if (a) {
                workpackWrite('Workpack not deleted', WorkpackService.Delete(vm.workpack.id), function () {
                    vm.closeWorkpackDetail();
                    vm.loadWorkpacks();
                    vm.loadOpenWorkpacks();
                    vm.loadMaintenanceEvents();
                });
            }
        };

        vm.uploadWorkpackDocument = function () {
            if (!vm.workpack) return;
            if (vm.workpack_files.workpack_doc && vm.workpack_files.workpack_doc.length > 0) {
                var f = vm.workpack_files.workpack_doc[0];
                workpackWrite('Document not uploaded', WorkpackService.Update(vm.workpack.id, {
                    document_temp_path: f.temp_path,
                    document_extension: f.extension,
                    document_original_name: f.name
                }), function () {
                    vm.workpack_files = { workpack_doc: [] };
                    vm.viewWorkpack(vm.workpack.id);
                });
            }
        };

        vm.removeWorkpackDocument = function () {
            if (!vm.workpack) return;
            workpackWrite('Document not removed', WorkpackService.Update(vm.workpack.id, { remove_document: true }), function () {
                vm.viewWorkpack(vm.workpack.id);
            });
        };

        $scope.downloadWorkpackDocument = function (filename) {
            if (!filename) return;
            $http.get('/api/v1/maintenance_workpacks/file/' + filename, {
                responseType: 'arraybuffer'
            }).success(function (data, status, headers) {
                var zipName = processArrayBufferToBlob(data, headers);
            }).error(function (data, status) {
                ToastService.error('Download Error', 'There was an error downloading the workpack document.');
            });
        };

        // ── Link / Unlink Defects ──

        vm.linkDefectToWorkpack = function (defect_id) {
            if (!vm.workpack || !defect_id) return;
            WorkpackService.LinkDefect(vm.workpack.id, defect_id)
                .then(function (data) {
                    if (data.success) {
                        vm.show_link_defect = false;
                        vm.viewWorkpack(vm.workpack.id);
                    } else {
                        ToastService.error('Link Error', data.message || 'Error linking defect.');
                    }
                });
        };

        vm.unlinkDefect = function (defect_id) {
            if (!defect_id) return;
            var a = confirm('Unlink this defect from the workpack?');
            if (a) {
                workpackWrite('Defect not unlinked', WorkpackService.UnlinkDefect(defect_id), function () {
                    vm.viewWorkpack(vm.workpack.id);
                });
            }
        };

        // ── Link / Unlink Maintenance Events ──

        // B4: the "Link a Maintenance Event" list — the aircraft's events (vm.maintenance_events)
        // not on a workpack yet. The old template read a key the backend never sent.
        vm.linkableEvents = function () {
            var out = [];
            for (var i = 0; i < (vm.maintenance_events || []).length; i++) {
                var e = vm.maintenance_events[i];
                if (!e.workpack_id || parseInt(e.workpack_id, 10) === 0) { out.push(e); }
            }
            return out;
        };

        vm.linkMaintenanceToWorkpack = function (maintenance_check_id) {
            if (!vm.workpack || !maintenance_check_id) return;
            workpackWrite('Event not linked', WorkpackService.LinkMaintenance(vm.workpack.id, maintenance_check_id), function () {
                vm.show_link_maintenance = false;
                vm.viewWorkpack(vm.workpack.id);
                vm.loadMaintenanceEvents();
            });
        };

        vm.unlinkMaintenance = function (maintenance_check_id) {
            if (!maintenance_check_id) return;
            var a = confirm('Unlink this maintenance event from the workpack?');
            if (a) {
                workpackWrite('Event not unlinked', WorkpackService.UnlinkMaintenance(maintenance_check_id), function () {
                    vm.viewWorkpack(vm.workpack.id);
                    vm.loadMaintenanceEvents();
                });
            }
        };

        // ── Standalone Defect Workpack ──

        vm.openDefectWorkpack = function (defect) {
            vm.selected_defect_for_wp = defect;
            vm.defect_wp = {
                workpack_number: defect.defect_workpack_number || '',
                signatory: defect.defect_workpack_signatory || ''
            };
            vm.show_defect_workpack = true;
        };

        vm.closeDefectWorkpack = function () {
            vm.selected_defect_for_wp = null;
            vm.defect_wp = {};
            vm.defect_workpack_files = { defect_wp_doc: [] };
            vm.show_defect_workpack = false;
        };

        vm.saveDefectWorkpack = function () {
            if (!vm.selected_defect_for_wp) return;

            var payload = {
                workpack_number: vm.defect_wp.workpack_number,
                signatory: vm.defect_wp.signatory
            };

            if (vm.defect_workpack_files.defect_wp_doc && vm.defect_workpack_files.defect_wp_doc.length > 0) {
                var f = vm.defect_workpack_files.defect_wp_doc[0];
                payload.document_temp_path = f.temp_path;
                payload.document_extension = f.extension;
                payload.document_original_name = f.name;
            }

            WorkpackService.UpdateDefectWorkpack(vm.selected_defect_for_wp.id, payload)
                .then(function (data) {
                    if (data && data.success) {
                        vm.closeDefectWorkpack();
                        loadMaintenanceDetail();
                    } else {
                        ToastService.error('Workpack not saved', readMessage(data, 'The defect workpack details could not be saved.'));
                    }
                });
        };

        // ── CRS (Certificate of Release to Service) ──

        vm.loadCrs = function () {
            CrsService.GetAll(vm.this_plane_id)
                .then(function (data) {
                    if (data.success) {
                        vm.crs_records = data.plane_crs || [];
                    }
                });
        };

        vm.deleteCrs = function (id) {
            var a = confirm('Are you sure you want to archive this CRS?');
            if (a) {
                CrsService.Delete(id)
                    .then(function (data) {
                        if (data && data.success) {
                            vm.loadCrs();
                            loadMaintenanceDetail();
                        } else {
                            ToastService.error('CRS not archived', readMessage(data, 'The CRS could not be archived.'));
                        }
                    });
            }
        };

        // Download the CRS the same way as the other plane documents (auth'd $http
        // arraybuffer → blob). A plain window.open on the signed URL bypasses the
        // $http auth interceptor and fails, so delegate to downloadDocument('crs').
        vm.downloadCrs = function (filename) {
            if (!filename) return;
            $scope.downloadDocument(filename, 'crs');
        };

        // Standalone CRS update (from document table UPDATE button)
        vm.saveCrsStandalone = function () {
            if (!vm.files.crs[0]) {
                ToastService.warning('CRS file required', 'Upload the CRS document (PDF or image).');
                return false;
            }
            if (!vm.obj.crs_release_date || !vm.obj.crs_release_time) {
                ToastService.warning('CRS incomplete', 'Both the release date and the release time are required.');
                return false;
            }
            var payload = {
                plane_id: parseInt(vm.this_plane_id),
                release_date: toDateOnly(vm.obj.crs_release_date),
                release_time: MF.hms(vm.obj.crs_release_time),
                file: vm.files.crs[0].file
            };
            vm.saving = true;
            CrsService.Create(payload)
                .then(function (data) {
                    if (data && data.success) {
                        ToastService.success('CRS updated', 'The Certificate of Release to Service was recorded.');
                        MF.resetAfterSave(vm);
                        vm.show_overlay = false;
                        loadMaintenanceDetail();
                    } else {
                        vm.saving = false;
                        ToastService.error('CRS not saved', readMessage(data, 'The Certificate of Release to Service could not be saved.'));
                    }
                }, function () {
                    vm.saving = false;
                    ToastService.error('CRS not saved', 'The server could not be reached.');
                });
            return true;
        };

        $scope.processWorkpackFile = function (files, location) {
            if (!files || files.length === 0) return;
            try {
                var j = JSON.parse(files[0].file_return);
                if (!mxUploadAccepted(j, files[0])) { return; }
                files[0].file.temp_path = j.saved_url;
                files[0].file.save_name = j.files.file.name;
                var ft = j.files.file.name;
                var fft = ft.split('.').pop();
                files[0].file.extension = j.extension || fft;   // images are stored as JPEG since 10 Nov 2026

                if (location === 'workpack_doc') {
                    vm.workpack_files.workpack_doc = [files[0].file];
                } else if (location === 'defect_wp_doc') {
                    vm.defect_workpack_files.defect_wp_doc = [files[0].file];
                }
            } catch (e) {
                console.error('Error processing workpack file upload:', e, files[0].file_return);
                ToastService.error('Upload Error', 'There was an error uploading the document. Please try again.');
            }
        };

        // Helper: process file upload for a resolved defect's workpack document
        vm.processDefectFile = function (files, defect) {
            if (!files || files.length === 0) return;
            try {
                var j = JSON.parse(files[0].file_return);
                if (!mxUploadAccepted(j, files[0])) { return; }
                files[0].file.temp_path = j.saved_url;
                files[0].file.save_name = j.files.file.name;
                var ft = j.files.file.name;
                var fft = ft.split('.').pop();
                files[0].file.extension = j.extension || fft;   // images are stored as JPEG since 10 Nov 2026
                defect._uploaded_file = files[0].file;
            } catch (e) {
                console.error('Error processing defect file upload:', e, files[0].file_return);
                ToastService.error('Upload Error', 'There was an error uploading the document. Please try again.');
            }
        };

        // ═══════════════════════════════════════════════
        // END WORKPACK METHODS
        // ═══════════════════════════════════════════════

        // ═══════════════════════════════════════════════
        // MAINTENANCE EVENT METHODS
        // ═══════════════════════════════════════════════

        vm.event_filter_options = [{ key: 'all', label: 'All' }];
        vm.loadMaintenanceEvents = function () {
            if (!vm.this_plane_id) return;
            PlaneService.GetMaintenanceEvents(vm.this_plane_id)
                .then(function (data) {
                    if (data && data.maintenance_events) {
                        vm.maintenance_events = data.maintenance_events;
                    } else if (data && data.events) {
                        vm.maintenance_events = data.events;
                    } else if (Array.isArray(data)) {
                        vm.maintenance_events = data;
                    } else {
                        ToastService.error('Events not loaded', readMessage(data, 'The maintenance events could not be loaded.'));
                        return;
                    }
                    vm.refreshExtension();
                    // B14 / U12: chips for every type present in the list
                    vm.event_filter_options = MF.eventFilterOptions(vm.maintenance_events);
                    if (vm.event_filter !== 'all' && !vm.event_filter_options.some(function (o) { return o.key === vm.event_filter; })) {
                        vm.event_filter = 'all';
                    }
                });
        };
        vm.eventMatchesFilter = function (event) { return MF.eventMatchesFilter(event, vm.event_filter); };

        vm.viewEvent = function (event) {
            vm.selected_event = angular.copy(event);
            // Parse dates for date inputs
            if (vm.selected_event.check_date) {
                vm.selected_event._check_date = new Date(vm.selected_event.check_date);
            }
            if (vm.selected_event.expiry_date) {
                vm.selected_event._expiry_date = new Date(vm.selected_event.expiry_date);
            }
            if (vm.selected_event.check_date) {
                vm.selected_event._check_time = new Date(vm.selected_event.check_date);
            }
            vm.show_event_detail = true;

            // Load logbook links for this event
            vm.loadLogbookLinks(event.id);
        };

        // batch 17: "Hours to next check not recorded — edit this check to add it" opens the anchor
        // check's edit panel (maintenance.anchor_check_id); loads the events first when needed
        vm.editAnchorCheck = function () {
            var m = vm.club && vm.club.plane && vm.club.plane.maintenance;
            var id = m ? parseInt(m.anchor_check_id, 10) : 0;
            if (!id) { return; }
            function open() {
                for (var i = 0; i < (vm.maintenance_events || []).length; i++) {
                    if (parseInt(vm.maintenance_events[i].id, 10) === id) {
                        vm.viewEvent(vm.maintenance_events[i]);     // the overlay edit panel
                        return true;
                    }
                }
                return false;
            }
            if (open()) { return; }
            PlaneService.GetMaintenanceEvents(vm.this_plane_id).then(function (data) {
                vm.maintenance_events = (data && data.maintenance_events) || (data && data.events) || data || [];
                vm.event_filter_options = MF.eventFilterOptions(vm.maintenance_events);
                open();
            });
        };

        vm.closeEventDetail = function () {
            vm.selected_event = null;
            vm.show_event_detail = false;
            vm.logbook_checkboxes = [];
            vm.event_logbook_links = [];
            vm.logbook_load_error = false;
        };

        vm.saveEvent = function () {
            if (!vm.selected_event || !vm.selected_event.id) return;

            var payload = {
                maintenance_type: vm.selected_event.maintenance_type,
                hours_remaining: vm.selected_event.hours_remaining,
                description: vm.selected_event.description,
                checked_by: vm.selected_event.checked_by
            };

            if (vm.selected_event._check_date) {
                var checkDateTime = moment(vm.selected_event._check_date).format('YYYY-MM-DD');
                if (vm.selected_event._check_time) {
                    checkDateTime += ' ' + moment(vm.selected_event._check_time).format('HH:mm:ss');
                }
                payload.check_date = checkDateTime;
            }

            if (vm.selected_event._expiry_date) {
                payload.expiry_date = moment(vm.selected_event._expiry_date).format('YYYY-MM-DD');
            }

            PlaneService.UpdateMaintenanceEvent(vm.selected_event.id, payload)
                .then(function (data) {
                    if (data && data.success !== false) {
                        vm.closeEventDetail();
                        // Refresh the figures, the events and the workpacks together
                        loadMaintenanceDetail();
                    } else {
                        ToastService.error('Update Error', (data && data.message) || 'Error updating maintenance event.');
                    }
                });
        };

        vm.getEventTypeIcon = function (type) {
            if (!type) return 'fa-wrench';
            switch (type.toLowerCase()) {
                case 'annual': return 'fa-calendar-check';
                case '50hours': case '25hours': case '100hours': return 'fa-tachometer-alt';
                case 'extension': return 'fa-clock';
                case 'interim': return 'fa-tools';
                case '6months': return 'fa-calendar';
                case 'workpack': return 'fa-archive';
                default: return 'fa-wrench';
            }
        };

        // B2: a label for every type, including 'workpack' and the blank legacy rows
        vm.getEventTypeLabel = MF.typeLabel;

        // ── Logbook Link Methods ──

        // Load available logbooks for the CREATE form
        vm.loadCreateLogbooks = function () {
            if (!vm.this_plane_id) return;
            vm.create_logbook_loading = true;
            vm.create_logbook_error = false;
            vm.create_logbook_checkboxes = [];

            LogbookLinkService.GetAvailableLogbooks(vm.this_plane_id)
                .then(function (data) {
                    vm.create_logbook_loading = false;
                    var available = (data && data.available_logbooks) ? data.available_logbooks : [];
                    // Pre-check airframe by default (backend auto-links airframe anyway)
                    vm.create_logbook_checkboxes = available.map(function (lb) {
                        return {
                            logbook_type: lb.logbook_type,
                            logbook_entity_id: lb.logbook_entity_id,
                            label: lb.label,
                            position: lb.position || null,
                            isLinked: lb.logbook_type === 'airframe'
                        };
                    });
                }, function () {
                    vm.create_logbook_loading = false;
                    vm.create_logbook_error = true;
                });
        };

        // Save logbook links after a new maintenance check is created
        vm.saveCreateLogbookLinks = function (maintenance_check_id) {
            if (!maintenance_check_id) return;

            var selectedLogbooks = vm.create_logbook_checkboxes
                .filter(function (lb) { return lb.isLinked; })
                .map(function (lb) {
                    return {
                        logbook_type: lb.logbook_type,
                        logbook_entity_id: lb.logbook_entity_id
                    };
                });

            // Backend already auto-links airframe, so if only airframe is checked nothing extra to do
            if (selectedLogbooks.length <= 1) return null;

            // returned so the save flow can report it in the one outcome toast
            return LogbookLinkService.BulkLink(maintenance_check_id, selectedLogbooks);
        };

        vm.toggleCreateLogbook = function (lb) {
            var checked = vm.create_logbook_checkboxes.filter(function (l) { return l.isLinked; }).length;
            if (!lb.isLinked && checked < 1) {
                lb.isLinked = true;
                ToastService.warning('Logbook Required', 'At least one logbook must be selected.');
            }
        };

        vm.loadAvailableLogbooks = function () {
            if (!vm.this_plane_id) return;
            LogbookLinkService.GetAvailableLogbooks(vm.this_plane_id)
                .then(function (data) {
                    if (data && data.available_logbooks) {
                        vm.available_logbooks = data.available_logbooks;
                    }
                });
        };

        vm.loadLogbookLinks = function (maintenance_check_id) {
            if (!maintenance_check_id) return;
            vm.logbook_checkboxes = [];
            vm.logbook_load_error = false;

            // Load both available logbooks and current links, then build checkbox state
            LogbookLinkService.GetAvailableLogbooks(vm.this_plane_id)
                .then(function (availData) {
                    var available = (availData && availData.available_logbooks) ? availData.available_logbooks : [];
                    vm.available_logbooks = available;

                    if (available.length === 0) {
                        vm.logbook_load_error = true;
                        return;
                    }

                    LogbookLinkService.GetLinks(maintenance_check_id)
                        .then(function (linkData) {
                            var links = [];
                            if (linkData && linkData.maintenance_check && linkData.maintenance_check.logbook_links) {
                                links = linkData.maintenance_check.logbook_links;
                            }
                            vm.event_logbook_links = links;

                            // Build checkbox array — include position for sorting
                            vm.logbook_checkboxes = available.map(function (lb) {
                                var isLinked = links.some(function (link) {
                                    return link.logbook_type === lb.logbook_type &&
                                           link.logbook_entity_id == lb.logbook_entity_id;
                                });
                                return {
                                    logbook_type: lb.logbook_type,
                                    logbook_entity_id: lb.logbook_entity_id,
                                    label: lb.label,
                                    position: lb.position || null,
                                    isLinked: isLinked
                                };
                            });
                        }, function () {
                            vm.logbook_load_error = true;
                        });
                }, function () {
                    vm.logbook_load_error = true;
                });
        };

        vm.saveLogbookLinks = function () {
            if (!vm.selected_event || !vm.selected_event.id) return;

            var selectedLogbooks = vm.logbook_checkboxes
                .filter(function (lb) { return lb.isLinked; })
                .map(function (lb) {
                    return {
                        logbook_type: lb.logbook_type,
                        logbook_entity_id: lb.logbook_entity_id
                    };
                });

            if (selectedLogbooks.length === 0) {
                ToastService.warning('Logbook Required', 'At least one logbook must be selected.');
                return;
            }

            vm.saving_logbook_links = true;
            LogbookLinkService.BulkLink(vm.selected_event.id, selectedLogbooks)
                .then(function (data) {
                    vm.saving_logbook_links = false;
                    if (data && data.success !== false) {
                        // Refresh the links
                        vm.loadLogbookLinks(vm.selected_event.id);
                    } else {
                        ToastService.error('Logbook Links', 'Error saving logbook links: ' + ((data && data.message) || 'Unknown error'));
                    }
                });
        };

        vm.getLogbookIcon = function (type) {
            switch (type) {
                case 'airframe': return 'fa-plane';
                case 'engine': return 'fa-cog';
                case 'propeller': return 'fa-sync-alt';
                default: return 'fa-book';
            }
        };

        // Count how many logbooks are currently checked
        vm.countCheckedLogbooks = function () {
            if (!vm.logbook_checkboxes || !vm.logbook_checkboxes.length) return 0;
            return vm.logbook_checkboxes.filter(function (lb) { return lb.isLinked; }).length;
        };

        // Prevent unchecking the very last logbook (at least one must remain)
        vm.toggleLogbook = function (lb) {
            if (!lb.isLinked && vm.countCheckedLogbooks() < 1) {
                // Re-check it — can't uncheck the last one
                lb.isLinked = true;
                ToastService.warning('Logbook Required', 'At least one logbook must remain linked.');
            }
        };

        // ═══════════════════════════════════════════════
        // END MAINTENANCE EVENT METHODS
        // ═══════════════════════════════════════════════


        initController();

        // Runs once everything above is defined: loadMaintenanceDetail() calls
        // vm.loadWorkpacks / vm.loadMaintenanceEvents, which are assigned further down
        // the file, so the list / detail bootstrap must not run before them.
        function initController() {
        switch(vm.action){
            case "add":
                // //console.log("adding a new plane please");
                vm.page_title = "Add a New Plane";
            break;
            case "edit":
                // //console.log("edit an existing plane");
                
                loadMaintenanceDetail();

                // Reload data when navigating back from child states (e.g. logbook pages)
                var deregisterStateChange = $scope.$on('$stateChangeSuccess', function(event, toState) {
                    if (toState.name === 'dashboard.manage_club.maintenance.detail') {
                        loadMaintenanceDetail();
                    }
                });
                $scope.$on('$destroy', deregisterStateChange);


               


            break;
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                loadMaintenanceList();

                // Reload list when navigating back from child states (e.g. detail page)
                var deregisterListChange = $scope.$on('$stateChangeSuccess', function(event, toState) {
                    if (toState.name === 'dashboard.manage_club.maintenance') {
                        loadMaintenanceList();
                    }
                });
                $scope.$on('$destroy', deregisterListChange);
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }
        }


          var warning_msg = "By deleting this plane, you will also cancel all reservations that this plane currently has."

          // $scope.open = function (plane_id) {
          //   var modalInstance = $uibModal.open({
          //     animation: true,
          //     templateUrl: 'views/modals/deleteModal.html',
          //     controller: 'ModalInstanceCtrl',
          //     //params: {},
          //     size: "lg",
          //     resolve: {
          //       id: function () {
          //         return plane_id;
          //       },
          //       warning: function(){
          //           return warning_msg;
          //       }
          //     }
          //   });
          //   modalInstance.result.then(function (plane_id) {
          //     $log.info('PRESSED GO: '+plane_id);
          //     PlaneService.Delete(plane_id)
          //     .then(function(){
          //       //console.log("HELLO DELETE");
          //       //update view?
          //        vm.club.planes = $.grep(vm.club.planes, function(e){ 
          //           return e.plane_id != plane_id; 
          //       });
          //     })
          //   }, function () {
          //     $log.info('Modal dismissed at: ' + new Date());
          //   });
          // };

            $scope.open = function (club_plane_id) {
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'views/modals/deleteModal.html',
              controller: 'ModalInstanceCtrl',
              size: "lg",
              resolve: {
                id: function () {
                  return club_plane_id;
                },
                params: function() {
                  return {id: club_plane_id};
                },
                warning: function(){
                    return warning_msg;
                }
              }
            });
            modalInstance.result.then(function (plane) {
                var id = plane.id;
              $log.info('PRESSED GO: ', id);
              
              PlaneService.Delete(id)
              .then(function(){
                // //console.log("HELLO DELETE");
                //update view?
                 vm.club.planes = $.grep(vm.club.planes, function(e){ 
                    return e.id != id; 
                });
             });

            }, function () {
              $log.info('Modal dismissed at: ' + new Date());
            });


          };
         
          


        //   $scope.downloadCertificate = function(doc) {
        //     var data = $.param({
        //         id: doc
        //     });

        //     var ddd = doc.replace(/^.*[\\\/]/, '');

        //     $http.get('api/v1/plane_certificate/show_file/'+ddd, {
        //             responseType: 'arraybuffer'
        //         })
        //         .success(function(data, status, headers) {
        //             var zipName = processArrayBufferToBlob(data, headers);

        //             //Delete file from temp folder in server - file needs to remain open until blob is created
        //             //deleteFileFromServerTemp(zipName);
        //         }).error(function(data, status) {
        //             alert("There was an error downloading the selected document(s).");
        //         })
        // };


        // $scope.downloadInsurance = function(doc) {
        //     var data = $.param({
        //         id: doc
        //     });

        //     var ddd = doc.replace(/^.*[\\\/]/, '');

        //     $http.get('api/v1/plane_insurance/show_file/'+ddd, {
        //             responseType: 'arraybuffer'
        //         })
        //         .success(function(data, status, headers) {
        //             var zipName = processArrayBufferToBlob(data, headers);

        //             //Delete file from temp folder in server - file needs to remain open until blob is created
        //             //deleteFileFromServerTemp(zipName);
        //         }).error(function(data, status) {
        //             alert("There was an error downloading the selected document(s).");
        //         })
        // };




        $scope.downloadDocument = function(doc, type = 'docs') {
            var data = $.param({
                id: doc
            });

            var controller = "plane_documents";

            switch(type){
                 case "radio": 
                    controller = "plane_radio_licence";
                break;
                 case "insurance": 
                    controller = "plane_insurance";
                break;
                 case "certificate":
                    controller = "plane_certificate";
                break;
                // the ARC (airworthiness_document.document_route === 'plane_arc')
                case "arc":
                    controller = "plane_arc";
                break;
                case "noise":
                    controller = "plane_noise_certificate";
                break;
                case "crs":
                    controller = "plane_crs";
                break;
                case "docs":
                    controller = "plane_documents";
                break;
                default:
                    controller = "plane_documents";
                break;

            }



            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/'+controller+'/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s).');
                })
        };

        $scope.downloadClubDocument = function(doc) {
            var data = $.param({
                id: doc
            });

            var ddd = doc.replace(/^.*[\\\/]/, '');

            $http.get('api/v1/club_documents/show_file/'+ddd, {
                    responseType: 'arraybuffer'
                })
                .success(function(data, status, headers) {
                    var zipName = processArrayBufferToBlob(data, headers);

                    //Delete file from temp folder in server - file needs to remain open until blob is created
                    //deleteFileFromServerTemp(zipName);
                }).error(function(data, status) {
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s).');
                })
        };

        // function processArrayBufferToBlob(data, headers) {
        //     var octetStreamMime = 'application/octet-stream';
        //     var success = false;

        //     // Get the headers
        //     headers = headers();
        //     //var ttt = title.toLowerCase().replace(/\W/g, '_');
        //     // Get the filename from the x-filename header or default to "download.bin"
        //     var filename = headers['x-filename'] || 'download.zip';

        //     // Determine the content type from the header or default to "application/octet-stream"
        //     var contentType = headers['content-type'] || octetStreamMime;

        //     try {
        //         // Try using msSaveBlob if supported
        //         var blob = new Blob([data], {
        //             type: contentType
        //         });
        //         if (navigator.msSaveBlob)
        //             navigator.msSaveBlob(blob, filename);
        //         else {
        //             // Try using other saveBlob implementations, if available
        //             var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
        //             if (saveBlob === undefined) throw "Not supported";
        //             saveBlob(blob, filename);
        //         }
        //         success = true;
        //     } catch (ex) {
        //         $log.info("saveBlob method failed with the following exception:");
        //         $log.info(ex);
        //     }

        //     if (!success) {
        //         // Get the blob url creator
        //         var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
        //         if (urlCreator) {
        //             // Try to use a download link
        //             var link = document.createElement('a');
        //             if ('download' in link) {
        //                 // Try to simulate a click
        //                 try {
        //                     // Prepare a blob URL
        //                     var blob = new Blob([data], {
        //                         type: contentType
        //                     });
        //                     var url = urlCreator.createObjectURL(blob);
        //                     link.setAttribute('href', url);

        //                     // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
        //                     link.setAttribute("download", filename);

        //                     // Simulate clicking the download link
        //                     var event = document.createEvent('MouseEvents');
        //                     event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        //                     link.dispatchEvent(event);
        //                     success = true;

        //                 } catch (ex) {
        //                     $log.info("Download link method with simulated click failed with the following exception:");
        //                     $log.info(ex);
        //                 }
        //             }

        //             if (!success) {
        //                 // Fallback to window.location method
        //                 try {
        //                     // Prepare a blob URL
        //                     // Use application/octet-stream when using window.location to force download
        //                     var blob = new Blob([data], {
        //                         type: octetStreamMime
        //                     });
        //                     var url = urlCreator.createObjectURL(blob);
        //                     window.location = url;
        //                     success = true;
        //                 } catch (ex) {
        //                     $log.info("Download link method with window.location failed with the following exception:");
        //                     $log.info(ex);
        //                 }
        //             }
        //         }
        //     }

        //     if (!success) {
        //         // Fallback to window.open method
        //         $log.info("No methods worked for saving the arraybuffer, using last resort window.open");
        //         window.open(httpPath, '_blank', '');
        //     }
        //     return filename;
        // };

        /** The first bytes say what a document is: JPEG, PNG, GIF, WebP, BMP or PDF; null when unknown. */
        function mxSniffMime(data) {
            try {
                var b = new Uint8Array(data, 0, Math.min(12, data.byteLength));
                if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) { return 'image/jpeg'; }
                if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) { return 'image/png'; }
                if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) { return 'image/gif'; }
                if (b[0] === 0x42 && b[1] === 0x4D) { return 'image/bmp'; }
                if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) { return 'image/webp'; }
                if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) { return 'application/pdf'; }
            } catch (e) { /* not an ArrayBuffer */ }
            return null;
        }

        function titlepath(path, name, mime) {

        //In this path defined as your pdf url and name (your pdf name)
            var prntWin = window.open();
            var isImage = typeof mime === 'string' && mime.indexOf('image/') === 0;
            var body = isImage
                ? '<img src="' + path + '" alt="' + name + '" style="display:block;max-width:100%;margin:0 auto">'
                : '<embed width="100%" height="100%" name="plugin" src="' + path + '" type="' + (mime || 'application/pdf') + '" internalinstanceid="21">';
            prntWin.document.write("<html><head><title>" + name + "</title></head><body style=\"margin:0;background:#262626\">" + body + "</body></html>");
            prntWin.document.close();
        }
        
        function processArrayBufferToBlob(data, headers) {
            var octetStreamMime = 'application/octet-stream';
            var success = false;

            // Get the headers
            headers = headers();
            //var ttt = title.toLowerCase().replace(/\W/g, '_');
            // Get the filename from the x-filename header or default to "download.bin"
            var filename = headers['x-filename'] || 'download.zip';

            // Determine the content type from the header or default to "application/octet-stream"
            var contentType = headers['content-type'] || octetStreamMime;

            try {

                $log.info("first try");
                // the API serves every document as application/octet-stream, so the type comes from the bytes
                // (10 Nov 2026: an image CRS used to be opened as a PDF → blank window)
                var mime = mxSniffMime(data) || ((contentType && contentType !== octetStreamMime) ? contentType : 'application/pdf');
                var blob = new Blob([data], { type: mime });

                var fileURL = URL.createObjectURL(blob);
                titlepath(fileURL, "Secure Documents", mime);

                // if (navigator.msSaveBlob)
                //     navigator.msSaveBlob(blob, filename);
                // else {
                //     // Try using other saveBlob implementations, if available
                //     var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
                //     if (saveBlob === undefined) throw "Not supported";
                //     saveBlob(blob, filename);
                // }
                success = true;
            } catch (ex) {
                $log.info("saveBlob method failed with the following exception:");
                $log.info(ex);
            }

            if (!success) {
                // Get the blob url creator
                var urlCreator = window.URL || window.webkitURL || window.mozURL || window.msURL;
                if (urlCreator) {
                    // Try to use a download link
                    var link = document.createElement('a');
                    if ('download' in link) {
                        // Try to simulate a click
                        try {
                            $log.info("second try");
                            // Prepare a blob URL
                            var blob = new Blob([data], {
                                type: contentType
                            });
                            var url = urlCreator.createObjectURL(blob);
                            link.setAttribute('href', url);

                            // Set the download attribute (Supported in Chrome 14+ / Firefox 20+)
                            link.setAttribute("download", filename);

                            // Simulate clicking the download link
                            var event = document.createEvent('MouseEvents');
                            event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                            link.dispatchEvent(event);
                            success = true;

                        } catch (ex) {
                            $log.info("Download link method with simulated click failed with the following exception:");
                            $log.info(ex);
                        }
                    }

                    if (!success) {
                        // Fallback to window.location method
                        try {

                            $log.info("third try");

                            // Prepare a blob URL
                            // Use application/octet-stream when using window.location to force download
                            var blob = new Blob([data], {
                                type: octetStreamMime
                            });
                            var url = urlCreator.createObjectURL(blob);
                            window.location = url;
                            success = true;
                        } catch (ex) {
                            $log.info("Download link method with window.location failed with the following exception:");
                            $log.info(ex);
                        }
                    }
                }
            }

            if (!success) {
                // Fallback to window.open method
                $log.info("No methods worked for saving the arraybuffer, using last resort window.open");
                window.open(httpPath, '_blank', '');
            }
            return filename;
        };






    }