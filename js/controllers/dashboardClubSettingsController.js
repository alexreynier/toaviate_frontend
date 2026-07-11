 app.controller('DashboardClubSettingsController', DashboardClubSettingsController);

    DashboardClubSettingsController.$inject = ['UserService', 'ClubService', 'PaymentService', '$rootScope', '$location', '$scope', '$state', '$stateParams', '$window', '$http', '$log', 'ToastService', 'AircraftChecksService', 'ScheduleDisplayService', 'VoucherWidgetService', 'DailyAircraftStatusService', 'PaymentModeService', '$uibModal', 'SoloRequirementsService', 'CourseService', 'QuestionnaireService', 'MedicalService'];
    function DashboardClubSettingsController(UserService, ClubService, PaymentService, $rootScope, $location, $scope, $state, $stateParams, $window, $http, $log, ToastService, AircraftChecksService, ScheduleDisplayService, VoucherWidgetService, DailyAircraftStatusService, PaymentModeService, $uibModal, SoloRequirementsService, CourseService, QuestionnaireService, MedicalService) {
        var vm = this;

        vm.user = null;
        vm.allUsers = [];
        vm.club = {};

        // ── Manager flag (used to gate the daily aircraft status section) ──
        vm.is_manager = !!($rootScope.globals.currentUser &&
            $rootScope.globals.currentUser.access &&
            $rootScope.globals.currentUser.access.manager &&
            $rootScope.globals.currentUser.access.manager.indexOf(
                $rootScope.globals.currentUser.current_club_admin
                    ? $rootScope.globals.currentUser.current_club_admin.id
                    : null
            ) > -1);

        vm.is_super_admin = !!($rootScope.globals.currentUser &&
            $rootScope.globals.currentUser.access &&
            $rootScope.globals.currentUser.access.super_admin &&
            $rootScope.globals.currentUser.access.super_admin.indexOf(
                $rootScope.globals.currentUser.current_club_admin
                    ? $rootScope.globals.currentUser.current_club_admin.id
                    : null
            ) > -1);

        // ── ToAviate platform staff ──
        // Payment-mode switching is a PLATFORM-staff action, not a per-club
        // super-admin one (access.super_admin is club-scoped). ToAviate staff are
        // identified by their @toaviate.com email, matching the backend's
        // PAYMENT_MODE_SUPER_ADMINS allow-list (see dashboardFoxTrackersController
        // for the same email-based platform gate). The backend remains
        // authoritative — a non-permitted user gets a 'forbidden' response — so
        // this only decides whether to surface the switch control.
        vm.is_toaviate_staff = !!($rootScope.globals.currentUser &&
            $rootScope.globals.currentUser.email &&
            /@toaviate\.com$/i.test($rootScope.globals.currentUser.email));

        // ── Voucher Widget status ──
        vm.voucher_widget_active = false;

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
        vm.user = $rootScope.globals.currentUser;
        vm.user_id = vm.user.id;

        // ── Aircraft Check Types ──
        // Role-based (backend updated 1 Jul 2026): code & name are freely editable;
        // the mandatory pre-flight types are identified by ROLE, not by code.
        //   a_check  — the "first flight of the day" check (satisfies Check A)
        //   transit  — the subsequent-flight check
        //   custom   — anything else (default)
        // The backend keeps exactly one a_check and one transit per club, auto-
        // demoting the previous holder when a role is reassigned.
        vm.check_types = [];
        vm.check_types_loading = false;
        vm.editing_check_type = false;
        vm.check_type_form = { is_active: true, display_order: 1, role: 'custom' };

        vm.check_type_roles = [
            { value: 'a_check', label: 'A Check (first flight of the day)' },
            { value: 'transit', label: 'Transit / Interim (subsequent flights)' },
            { value: 'custom',  label: 'Custom (no mandatory role)' }
        ];

        vm.roleLabel = function(role) {
            if (role === 'a_check') { return 'A CHECK'; }
            if (role === 'transit') { return 'TRANSIT'; }
            return 'CUSTOM';
        };
        vm.roleBadgeClass = function(role) {
            if (role === 'a_check') { return 'badge-success'; }
            if (role === 'transit') { return 'badge-info'; }
            return 'badge-default';
        };

        vm.loadCheckTypes = function() {
            vm.check_types_loading = true;
            AircraftChecksService.GetCheckTypes(vm.club_id)
                .then(function(data) {
                    vm.check_types_loading = false;
                    if (data.success) {
                        vm.check_types = data.check_types;
                    }
                });
        };

        // ── Pre-solo requirements editor (pilot checks / student solo) ──
        // Club-defined checklist a student must satisfy before flying solo.
        // Requirements are club-wide ("All courses") or scoped to one course,
        // and are manual (instructor sign-off) or auto-verified: 'medical'
        // (accepted certificate classes), 'questionnaire' (instructor-reviewed
        // attempt) or 'exam' (linked ground exam + optional pass mark).
        // BACKEND_PRE_SOLO_COURSE_REQUIREMENTS_GUIDE.md §4/§6.
        vm.solo = {
            loading: false,
            items: [],
            groups: [],       // [{ key, course_id, title, items }] — "All courses" first
            collapsed: {},    // group key → true (persists across reloads this session)
            filter: null,     // null = everything | 0 = all-courses items | course id
            busy: {},         // requirement id → true while its save is in flight
            seeding: false,
            saving: false,
            editor: null,     // open add/edit form (null = closed)
            lookups: { loaded: false, loading: false, courses: [], questionnaires: [], exams: [], examsByCourse: {}, medicalClasses: [] }
        };

        vm.loadSoloRequirements = function() {
            vm.solo.loading = true;
            vm.ensureSoloLookups();
            SoloRequirementsService.GetForClubAdmin(vm.club_id).then(function(data) {
                vm.solo.loading = false;
                if (data && data.success !== false) {
                    vm.solo.items = data.requirements || data.items || (angular.isArray(data) ? data : []);
                } else {
                    vm.solo.items = [];
                }
                soloRebuildGroups();
            });
        };

        // Courses / questionnaires / exams / medical classes powering the
        // course groups, the editor's pickers and the chips on each card.
        vm.ensureSoloLookups = function() {
            var lk = vm.solo.lookups;
            if (lk.loaded || lk.loading) return;
            lk.loading = true;
            CourseService.GetCoursesByClubId(vm.club_id).then(function(data) {
                lk.courses = (data && data.items) || [];
            });
            QuestionnaireService.ListByClub(vm.club_id).then(function(data) {
                lk.questionnaires = (data && (data.items || data.questionnaires)) || [];
            });
            SoloRequirementsService.GetExamsByClub(vm.club_id).then(function(data) {
                lk.exams = (data && (data.items || data.exams)) || (angular.isArray(data) ? data : []);
            });
            MedicalService.GetComponents().then(function(data) {
                var all = (data && data.items) || (angular.isArray(data) ? data : []);
                // Only actual certificate classes may satisfy a medical
                // requirement — never the date trackers (ECG / audiogram).
                lk.medicalClasses = all.filter(function(c) { return c.is_certificate == 1; });
                lk.loaded = true;
                lk.loading = false;
            });
        };

        // Group into "All courses" (course_id null) first, then one group per
        // course that has requirements. New courses appear once a requirement
        // is added to them via the editor's course picker.
        function soloRebuildGroups() {
            var groups = [{ key: 'all', course_id: null, title: 'All courses', items: [] }];
            var byCourse = {};
            angular.forEach(vm.solo.items, function(item) {
                if (!item.course_id) { groups[0].items.push(item); return; }
                var key = 'c' + item.course_id;
                if (!byCourse[key]) {
                    byCourse[key] = { key: key, course_id: parseInt(item.course_id, 10), title: item.course_title || ('Course #' + item.course_id), items: [] };
                    groups.push(byCourse[key]);
                }
                byCourse[key].items.push(item);
            });
            groups.forEach(function(g) {
                g.items.sort(function(a, b) { return (parseInt(a.display_order, 10) || 0) - (parseInt(b.display_order, 10) || 0); });
            });
            vm.solo.groups = groups;
        }

        // Course filter chips: null = everything; 0 = only the all-courses
        // items; a course id = all-courses + that course (what its students see).
        vm.soloSetFilter = function(val) {
            vm.solo.filter = (vm.solo.filter === val) ? null : val;
        };
        vm.soloGroupVisible = function(group) {
            if (vm.solo.filter === null) return true;
            if (vm.solo.filter === 0) return group.course_id === null;
            return group.course_id === null || group.course_id === vm.solo.filter;
        };
        vm.soloToggleGroup = function(group) {
            vm.solo.collapsed[group.key] = !vm.solo.collapsed[group.key];
        };

        vm.soloSeedDefaults = function() {
            if (vm.solo.seeding) return;
            vm.solo.seeding = true;
            SoloRequirementsService.SeedDefaults(vm.club_id).then(function(data) {
                vm.solo.seeding = false;
                if (data && data.success) {
                    ToastService.success('Defaults Added', 'Medical, pre-solo questionnaire and air law ground exam are now on your checklist.');
                    vm.loadSoloRequirements();
                } else {
                    ToastService.error('Not Added', (data && data.message) || 'Could not add the default requirements.');
                }
            });
        };

        // ── Requirement editor (shared by add + edit) ──
        // vtype 'manual' | 'medical' | 'questionnaire' | 'exam' → auto_type.
        vm.soloOpenAdd = function(group) {
            vm.ensureSoloLookups();
            vm.soloCloseEditor();
            vm.solo.editor = {
                id: null,
                name: '',
                description: '',
                course_id: (group && group.course_id) ? group.course_id : null,
                vtype: 'manual',
                med_ids: {},          // medical_components.id → true
                questionnaire_id: null,
                require_review: true,
                exam_id: null,
                min_score_percent: null
            };
        };

        vm.soloStartEdit = function(item) {
            vm.ensureSoloLookups();
            vm.soloCloseEditor();
            var med_ids = {};
            angular.forEach(String(item.medical_component_ids || '').split(','), function(id) {
                id = parseInt(id, 10);
                if (id) med_ids[id] = true;
            });
            item._editing = true;
            vm.solo.editor = {
                id: item.id,
                item: item,
                name: item.name,
                description: item.description || '',
                course_id: item.course_id ? parseInt(item.course_id, 10) : null,
                vtype: item.auto_type || 'manual',
                med_ids: med_ids,
                questionnaire_id: item.questionnaire_id ? parseInt(item.questionnaire_id, 10) : null,
                require_review: item.require_review === undefined || item.require_review === null || item.require_review == 1,
                exam_id: item.exam_id ? parseInt(item.exam_id, 10) : null,
                min_score_percent: (item.min_score_percent !== null && item.min_score_percent !== undefined && item.min_score_percent !== '') ? parseFloat(item.min_score_percent) : null
            };
            if (vm.solo.editor.course_id) vm.soloEditorCourseChanged();
        };

        vm.soloCloseEditor = function() {
            if (vm.solo.editor && vm.solo.editor.item) vm.solo.editor.item._editing = false;
            vm.solo.editor = null;
        };

        vm.soloToggleMedClass = function(component_id) {
            vm.solo.editor.med_ids[component_id] = !vm.solo.editor.med_ids[component_id];
        };

        // Course-scoped requirements offer that course's exams (the backend
        // rejects an exam from a different course); club-wide offers them all.
        vm.soloEditorCourseChanged = function() {
            var ed = vm.solo.editor;
            var lk = vm.solo.lookups;
            if (!ed || !ed.course_id || lk.examsByCourse[ed.course_id]) return;
            CourseService.GetExamsByCourseId(ed.course_id).then(function(data) {
                lk.examsByCourse[ed.course_id] = (data && (data.items || data.exams)) || [];
            });
        };
        vm.soloEditorExams = function() {
            var ed = vm.solo.editor;
            var lk = vm.solo.lookups;
            if (ed && ed.course_id) return lk.examsByCourse[ed.course_id] || [];
            return lk.exams;
        };

        vm.soloEditorSave = function() {
            if (vm.solo.saving || !vm.solo.editor) return;
            var ed = vm.solo.editor;
            if (!ed.name || !ed.name.trim()) {
                ToastService.warning('Name Required', 'Please give the requirement a name (e.g. "Pre-solo questionnaire").');
                return;
            }
            if (ed.vtype === 'questionnaire' && !ed.questionnaire_id) {
                ToastService.warning('Questionnaire Required', 'Choose which questionnaire verifies this requirement.');
                return;
            }
            if (ed.vtype === 'exam' && !ed.exam_id) {
                ToastService.warning('Exam Required', 'Choose which ground exam verifies this requirement.');
                return;
            }
            var score = (ed.min_score_percent === null || ed.min_score_percent === undefined || ed.min_score_percent === '') ? null : parseFloat(ed.min_score_percent);
            if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
                ToastService.warning('Pass Mark Invalid', 'The pass mark must be between 0 and 100%.');
                return;
            }
            var med_ids = [];
            angular.forEach(ed.med_ids, function(on, id) { if (on) med_ids.push(parseInt(id, 10)); });

            var payload = {
                club_id: vm.club_id,
                name: ed.name.trim(),
                description: (ed.description || '').trim(),
                course_id: ed.course_id || null,
                auto_type: ed.vtype === 'manual' ? null : ed.vtype,
                medical_component_ids: (ed.vtype === 'medical' && med_ids.length) ? med_ids.join(',') : null,
                questionnaire_id: ed.vtype === 'questionnaire' ? ed.questionnaire_id : null,
                require_review: (ed.vtype === 'questionnaire' && !ed.require_review) ? 0 : 1,
                exam_id: ed.vtype === 'exam' ? ed.exam_id : null,
                min_score_percent: (ed.vtype === 'questionnaire' || ed.vtype === 'exam') ? score : null
            };

            vm.solo.saving = true;
            var call;
            if (ed.id) {
                call = SoloRequirementsService.Update(ed.id, payload);
            } else {
                var maxOrder = 0;
                for (var i = 0; i < vm.solo.items.length; i++) {
                    var o = parseInt(vm.solo.items[i].display_order, 10) || 0;
                    if (o > maxOrder) maxOrder = o;
                }
                payload.active = 1;
                payload.display_order = maxOrder + 1;
                call = SoloRequirementsService.Create(payload);
            }
            call.then(function(data) {
                vm.solo.saving = false;
                if (data && data.success) {
                    ToastService.success(ed.id ? 'Requirement Updated' : 'Requirement Added', '"' + payload.name + '" saved to the pre-solo checklist.');
                    vm.soloCloseEditor();
                    vm.loadSoloRequirements();
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'Could not save the requirement.');
                }
            });
        };

        vm.soloToggleActive = function(item) {
            if (vm.solo.busy[item.id]) return;
            var newVal = item.active == 1 ? 0 : 1;
            vm.solo.busy[item.id] = true;
            SoloRequirementsService.Update(item.id, { active: newVal }).then(function(data) {
                vm.solo.busy[item.id] = false;
                if (data && data.success) {
                    item.active = newVal;
                } else {
                    ToastService.error('Not Saved', (data && data.message) || 'Could not update the requirement.');
                }
            });
        };

        // Chip helpers for the requirement cards.
        vm.soloMedNames = function(item) {
            var ids = String(item.medical_component_ids || '').split(',');
            var names = [];
            angular.forEach(ids, function(id) {
                id = parseInt(id, 10);
                if (!id) return;
                var match = null;
                angular.forEach(vm.solo.lookups.medicalClasses, function(c) { if (c.id == id) match = c; });
                names.push(match ? match.title : ('Class #' + id));
            });
            return names;
        };

        // Reorder with up/down buttons (works on touch too). Swap within the
        // course group, then persist display_order = overall position across
        // all groups for any row it changed.
        vm.soloMove = function(group, item, dir) {
            var idx = group.items.indexOf(item);
            var swapWith = group.items[idx + dir];
            if (!swapWith) return;
            group.items[idx] = swapWith;
            group.items[idx + dir] = item;
            var pos = 0;
            angular.forEach(vm.solo.groups, function(g) {
                angular.forEach(g.items, function(row) {
                    pos++;
                    if (parseInt(row.display_order, 10) !== pos) {
                        row.display_order = pos;
                        SoloRequirementsService.Update(row.id, { display_order: pos });
                    }
                });
            });
        };

        // Two-step inline delete (no browser confirm). Backend refuses when
        // sign-offs exist — surface its "set it inactive instead" message.
        vm.soloAskDelete = function(item) {
            item._confirmDelete = true;
        };
        vm.soloCancelDelete = function(item) {
            item._confirmDelete = false;
        };
        vm.soloDelete = function(item) {
            vm.solo.busy[item.id] = true;
            SoloRequirementsService.Delete(item.id).then(function(data) {
                vm.solo.busy[item.id] = false;
                item._confirmDelete = false;
                if (data && data.success) {
                    ToastService.success('Deleted', '"' + item.name + '" removed from the checklist.');
                    vm.loadSoloRequirements();
                } else {
                    ToastService.warning('Not Deleted', (data && data.message) || 'This requirement could not be deleted — set it inactive instead.');
                }
            });
        };

        vm.saveCheckType = function() {
            if (!vm.check_type_form.name || !vm.check_type_form.code) {
                ToastService.warning('Missing Fields', 'Please provide both a Name and Code for the check type.');
                return;
            }

            var payload = {
                club_id: vm.club_id,
                name: vm.check_type_form.name,
                code: vm.check_type_form.code,
                role: vm.check_type_form.role || 'custom',
                description: vm.check_type_form.description || '',
                is_active: vm.check_type_form.is_active ? 1 : 0,
                display_order: vm.check_type_form.display_order || 1
            };

            if (vm.editing_check_type && vm.check_type_form.id) {
                AircraftChecksService.UpdateCheckType(vm.check_type_form.id, payload)
                    .then(function(data) {
                        if (data.success) {
                            ToastService.success('Updated', 'Check type updated successfully.');
                            vm.closeCheckTypeModal();
                            vm.loadCheckTypes();
                        } else {
                            ToastService.error('Error', data.message || 'Failed to update check type.');
                        }
                    });
            } else {
                AircraftChecksService.CreateCheckType(payload)
                    .then(function(data) {
                        if (data.success) {
                            ToastService.success('Created', 'Check type created successfully.');
                            vm.closeCheckTypeModal();
                            vm.loadCheckTypes();
                        } else {
                            ToastService.error('Error', data.message || 'Failed to create check type.');
                        }
                    });
            }
        };

        vm.show_check_type_modal = false;

        vm.openCheckTypeModal = function() {
            vm.editing_check_type = false;
            vm.check_type_form = { is_active: true, display_order: 1, role: 'custom' };
            vm.show_check_type_modal = true;
        };

        vm.closeCheckTypeModal = function() {
            vm.show_check_type_modal = false;
            vm.editing_check_type = false;
            vm.check_type_form = { is_active: true, display_order: 1, role: 'custom' };
        };

        vm.editCheckType = function(ct) {
            vm.editing_check_type = true;
            vm.check_type_form = {
                id: ct.id,
                name: ct.name,
                code: ct.code,
                role: ct.role || 'custom',
                description: ct.description,
                is_active: ct.is_active == 1,
                display_order: ct.display_order
            };
            vm.show_check_type_modal = true;
        };

        vm.cancelEditCheckType = function() {
            vm.closeCheckTypeModal();
        };

        vm.deleteCheckType = function(ct) {
            if (!confirm('Are you sure you want to delete the check type "' + ct.name + '"?')) return;
            AircraftChecksService.DeleteCheckType(ct.id)
                .then(function(data) {
                    if (data.success) {
                        ToastService.success('Deleted', 'Check type deleted successfully.');
                        vm.loadCheckTypes();
                    } else {
                        ToastService.warning('Cannot Delete', data.message || 'Failed to delete check type.');
                    }
                });
        };

        // ── Schedule Display Token Management ──
        vm.display_token = null;
        vm.display_url = '';
        vm.display_loading = false;
        vm.display_copied = false;
        vm.show_all_instructors = true;
        vm.pairing_code = '';
        vm.pairing_loading = false;
        vm.display_pairing_url = window.location.origin + '/display/tv';

        vm.loadDisplayToken = function() {
            vm.display_loading = true;
            ScheduleDisplayService.GetToken(vm.club_id)
                .then(function(data) {
                    vm.display_loading = false;
                    if (data.success && data.token) {
                        vm.display_token = data.token;
                        vm.display_url = window.location.origin + '/display/' + data.token;
                        vm.show_all_instructors = data.show_all_instructors === 1 || data.show_all_instructors === true;
                    } else {
                        vm.display_token = null;
                        vm.display_url = '';
                    }
                }, function() {
                    vm.display_loading = false;
                });
        };

        vm.generateDisplayToken = function() {
            vm.display_loading = true;
            ScheduleDisplayService.GenerateToken(vm.club_id)
                .then(function(data) {
                    vm.display_loading = false;
                    if (data.success && data.token) {
                        vm.display_token = data.token;
                        vm.display_url = window.location.origin + '/display/' + data.token;
                        ToastService.success('Display Link Created', 'Copy the URL and open it on your clubhouse TV.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to generate display token.');
                    }
                }, function() {
                    vm.display_loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.revokeDisplayToken = function() {
            if (!confirm('Are you sure? This will immediately disable the schedule display on any TV currently using this link.')) return;
            vm.display_loading = true;
            ScheduleDisplayService.RevokeToken(vm.club_id)
                .then(function(data) {
                    vm.display_loading = false;
                    if (data.success) {
                        vm.display_token = null;
                        vm.display_url = '';
                        ToastService.success('Revoked', 'Schedule display access has been disabled.');
                    } else {
                        ToastService.error('Error', data.message || 'Failed to revoke token.');
                    }
                }, function() {
                    vm.display_loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        vm.copyDisplayUrl = function() {
            var input = document.getElementById('sd_token_url');
            if (input) {
                input.select();
                document.execCommand('copy');
                vm.display_copied = true;
                ToastService.success('Copied!', 'Display URL copied to clipboard.');
                setTimeout(function() {
                    $scope.$apply(function() { vm.display_copied = false; });
                }, 2000);
            }
        };

        vm.openDisplayInNewTab = function() {
            window.open(vm.display_url, '_blank');
        };

        vm.toggleShowAllInstructors = function() {
            ScheduleDisplayService.UpdateDisplaySettings(vm.club_id, {
                show_all_instructors: vm.show_all_instructors ? 1 : 0
            }).then(function(data) {
                if (data.success) {
                    ToastService.success('Updated', 'Display setting saved. The TV will update automatically.');
                } else {
                    ToastService.error('Error', data.message || 'Failed to update setting.');
                    vm.show_all_instructors = !vm.show_all_instructors; // revert
                }
            }, function() {
                ToastService.error('Error', 'Could not connect to the server.');
                vm.show_all_instructors = !vm.show_all_instructors; // revert
            });
        };

        vm.linkPairingCode = function() {
            if (!vm.pairing_code || vm.pairing_code.length < 6) return;
            vm.pairing_loading = true;
            ScheduleDisplayService.LinkPairingCode(vm.pairing_code, vm.club_id)
                .then(function(data) {
                    vm.pairing_loading = false;
                    if (data.success) {
                        ToastService.success('TV Paired!', data.message || 'The TV display is now connected and will show your schedule.');
                        vm.pairing_code = '';
                        // Refresh the token display in case it was auto-generated
                        vm.loadDisplayToken();
                    } else {
                        ToastService.error('Pairing Failed', data.message || 'Invalid or expired code. Please check the code on the TV screen.');
                    }
                }, function() {
                    vm.pairing_loading = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
        };

        // ── Booking Edit Time Limits helpers ──
        var standardPresets = ['0','30','60','120','240','720','1440','2880','10080'];

        vm.editWindowAdminPreset = '0';
        vm.editWindowInstructorPreset = '0';
        vm.editWindowMemberPreset = '60';

        vm.initEditWindowPresets = function() {
            vm.editWindowAdminPreset = standardPresets.indexOf(String(vm.club.settings.edit_window_admin_minutes)) !== -1
                ? String(vm.club.settings.edit_window_admin_minutes) : 'custom';
            vm.editWindowInstructorPreset = standardPresets.indexOf(String(vm.club.settings.edit_window_instructor_minutes)) !== -1
                ? String(vm.club.settings.edit_window_instructor_minutes) : 'custom';
            vm.editWindowMemberPreset = standardPresets.indexOf(String(vm.club.settings.edit_window_member_minutes)) !== -1
                ? String(vm.club.settings.edit_window_member_minutes) : 'custom';
        };

        vm.applyEditWindowPreset = function(role) {
            var presetMap = { admin: 'editWindowAdminPreset', instructor: 'editWindowInstructorPreset', member: 'editWindowMemberPreset' };
            var fieldMap  = { admin: 'edit_window_admin_minutes', instructor: 'edit_window_instructor_minutes', member: 'edit_window_member_minutes' };
            var val = vm[presetMap[role]];
            if (val !== 'custom') {
                vm.club.settings[fieldMap[role]] = parseInt(val);
            }
        };

        vm.formatEditWindow = function(mins) {
            if (!mins || mins == 0) return 'Unlimited';
            mins = parseInt(mins);
            if (mins < 60) return mins + ' min' + (mins !== 1 ? 's' : '');
            if (mins < 1440) { var h = Math.floor(mins / 60); var m = mins % 60; return h + ' hr' + (h !== 1 ? 's' : '') + (m > 0 ? ' ' + m + 'm' : ''); }
            var d = Math.floor(mins / 1440); var rem = mins % 1440; var rh = Math.floor(rem / 60);
            return d + ' day' + (d !== 1 ? 's' : '') + (rh > 0 ? ' ' + rh + 'h' : '');
        };

        // ─────────────────────────────────────────────────────────────
        // Daily Aircraft Status Report
        // ─────────────────────────────────────────────────────────────
        vm.das = {
            loading: false,
            saving: false,
            sending: false,
            settings: null,
            // local form-bound copies (so toggling/typing doesn't mutate the
            // server-loaded object until Save is pressed)
            form: {
                enabled: false,
                include_aircraft_status: true,
                include_offline_forms: true,
                include_student_summary: true
            },
            recipients: [],          // array of {email, error?}
            new_email: '',
            new_email_error: '',
            recipient_field_error: '',
            enable_error: '',
            runs: [],
            runs_loading: false,
            history_open: false,
            confirm_send: false,
            dirty: false
        };

        vm.dasLoadSettings = function() {
            vm.das.loading = true;
            DailyAircraftStatusService.GetSettings(vm.club_id)
                .then(function(data) {
                    vm.das.loading = false;
                    if (data && data.success && data.settings) {
                        vm.dasApplySettings(data.settings);
                    } else if (data && data.message) {
                        // 403 → not a manager → leave section hidden
                        if (/manager/i.test(data.message)) {
                            vm.das.settings = null;
                            return;
                        }
                        ToastService.error('Daily Report', data.message);
                    }
                });
        };

        vm.dasApplySettings = function(s) {
            vm.das.settings = s;
            vm.das.form = {
                enabled: !!parseInt(s.enabled),
                include_aircraft_status: parseInt(s.include_aircraft_status) !== 0,
                include_offline_forms: parseInt(s.include_offline_forms) !== 0,
                include_student_summary: parseInt(s.include_student_summary) !== 0
            };
            var arr = s.recipient_emails_array;
            if (!arr && s.recipient_emails) {
                arr = String(s.recipient_emails).split(/[,\n;]+/).map(function(x){ return x.trim(); }).filter(Boolean);
            }
            vm.das.recipients = (arr || []).map(function(e) { return { email: e }; });
            vm.das.dirty = false;
            vm.das.enable_error = '';
            vm.das.recipient_field_error = '';
        };

        vm.dasMarkDirty = function() { vm.das.dirty = true; };

        vm.dasIsValidEmail = function(e) {
            if (!e) return false;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
        };

        vm.dasAddRecipient = function() {
            var e = (vm.das.new_email || '').trim();
            if (!e) return;
            if (!vm.dasIsValidEmail(e)) {
                vm.das.new_email_error = 'Please enter a valid email address.';
                return;
            }
            // de-dupe (case-insensitive)
            var lower = e.toLowerCase();
            var exists = vm.das.recipients.some(function(r) { return r.email.toLowerCase() === lower; });
            if (exists) {
                vm.das.new_email_error = 'That address is already in the list.';
                return;
            }
            vm.das.recipients.push({ email: e });
            vm.das.new_email = '';
            vm.das.new_email_error = '';
            vm.das.recipient_field_error = '';
            vm.das.dirty = true;
        };

        vm.dasRecipientKey = function($event) {
            // Enter or comma adds; Backspace on empty removes last
            if ($event.keyCode === 13 || $event.keyCode === 188 /* , */ ) {
                $event.preventDefault();
                vm.dasAddRecipient();
            } else if ($event.keyCode === 8 && !vm.das.new_email && vm.das.recipients.length) {
                vm.das.recipients.pop();
                vm.das.dirty = true;
            }
        };

        vm.dasRemoveRecipient = function(idx) {
            vm.das.recipients.splice(idx, 1);
            vm.das.dirty = true;
        };

        vm.dasOnEnableToggle = function() {
            // server rejects enabled=1 with no recipients — guard locally too
            if (vm.das.form.enabled && !vm.das.recipients.length) {
                vm.das.form.enabled = false;
                vm.das.enable_error = 'Add at least one recipient before enabling the daily report.';
                return;
            }
            vm.das.enable_error = '';
            vm.das.dirty = true;
        };

        vm.dasCanEnable = function() {
            return vm.das.recipients.length > 0;
        };

        vm.dasSave = function() {
            // pre-flight checks
            if (vm.das.form.enabled && !vm.das.recipients.length) {
                vm.das.enable_error = 'Add at least one recipient before enabling the daily report.';
                vm.das.form.enabled = false;
                return;
            }
            // clear per-tag errors
            vm.das.recipients.forEach(function(r) { r.error = false; });

            var bad = vm.das.recipients.find(function(r) { return !vm.dasIsValidEmail(r.email); });
            if (bad) {
                bad.error = true;
                vm.das.recipient_field_error = 'One or more email addresses look invalid.';
                return;
            }

            var payload = {
                enabled: vm.das.form.enabled ? 1 : 0,
                recipient_emails: vm.das.recipients.map(function(r) { return r.email; }),
                include_aircraft_status: vm.das.form.include_aircraft_status ? 1 : 0,
                include_offline_forms: vm.das.form.include_offline_forms ? 1 : 0,
                include_student_summary: vm.das.form.include_student_summary ? 1 : 0
            };

            vm.das.saving = true;
            DailyAircraftStatusService.UpdateSettings(vm.club_id, payload)
                .then(function(data) {
                    vm.das.saving = false;
                    if (data && data.success) {
                        if (data.settings) vm.dasApplySettings(data.settings);
                        vm.das.dirty = false;
                        ToastService.success('Saved', 'Daily report settings updated.');
                    } else {
                        var msg = (data && data.message) || 'Could not save settings.';
                        // Highlight bad email if backend told us which one
                        var m = msg.match(/Invalid email address:\s*(.+)$/i);
                        if (m) {
                            var addr = m[1].trim().toLowerCase();
                            var hit = vm.das.recipients.find(function(r) { return r.email.toLowerCase() === addr; });
                            if (hit) hit.error = true;
                            vm.das.recipient_field_error = msg;
                        } else if (/at least one recipient/i.test(msg)) {
                            vm.das.enable_error = msg;
                        } else {
                            ToastService.error('Daily Report', msg);
                        }
                    }
                });
        };

        vm.dasAskSendNow = function() {
            if (!vm.das.recipients.length) {
                ToastService.warning('No Recipients', 'Add at least one recipient before sending.');
                return;
            }
            if (vm.das.dirty) {
                ToastService.warning('Unsaved Changes', 'Please save your changes before sending.');
                return;
            }
            vm.das.confirm_send = true;
        };

        vm.dasCancelSendNow = function() { vm.das.confirm_send = false; };

        vm.dasSendNow = function() {
            vm.das.confirm_send = false;
            vm.das.sending = true;
            DailyAircraftStatusService.RunNow(vm.club_id)
                .then(function(data) {
                    vm.das.sending = false;
                    if (data && data.success) {
                        var failed = parseInt(data.emails_failed) || 0;
                        if (failed > 0) {
                            ToastService.warning('Partial Send',
                                'Sent to ' + (data.emails_sent || 0) + ' recipient(s); ' + failed + ' failed.');
                        } else {
                            ToastService.success('Sent',
                                'Daily report sent to ' + (data.emails_sent || 0) + ' recipient(s).');
                        }
                        // Refresh settings (last_run_*) and history
                        vm.dasLoadSettings();
                        if (vm.das.history_open) vm.dasLoadRuns();
                    } else {
                        ToastService.error('Send Failed', (data && data.message) || 'Could not send the daily report.');
                    }
                });
        };

        vm.dasLoadRuns = function() {
            vm.das.runs_loading = true;
            DailyAircraftStatusService.GetRuns(vm.club_id, 30)
                .then(function(data) {
                    vm.das.runs_loading = false;
                    if (data && data.success) {
                        vm.das.runs = data.runs || [];
                    } else {
                        vm.das.runs = [];
                    }
                });
        };

        vm.dasToggleHistory = function() {
            vm.das.history_open = !vm.das.history_open;
            if (vm.das.history_open && !vm.das.runs.length) {
                vm.dasLoadRuns();
            }
        };

        vm.dasDownload = function(type, available) {
            if (!available) return;
            DailyAircraftStatusService.DownloadPdf(vm.club_id, type)
                .then(function(res) {
                    if (!res.success) {
                        ToastService.error('Download Failed',
                            res.message || 'The PDF could not be retrieved.');
                    }
                });
        };

        vm.dasStatusLabel = function(status) {
            if (!status) return '—';
            return status.charAt(0).toUpperCase() + status.slice(1);
        };

        vm.dasStatusTooltip = function(s) {
            if (!s) return '';
            switch (s.last_run_status) {
                case 'partial': return 'Some recipients failed — check addresses.';
                case 'skipped': return 'Within 24h cron lock — use Send now to retry.';
                case 'failure': return s.last_run_message || 'The last run failed.';
                default: return s.last_run_message || '';
            }
        };

        vm.dasFormatRunDate = function(ts) {
            if (!ts) return '';
            // Backend returns "YYYY-MM-DD HH:MM:SS" (server local time).
            // Parse as local — converting to UTC tends to mis-shift by hours
            // when the server is in the same TZ as the user.
            var d = new Date(ts.replace(' ', 'T'));
            if (isNaN(d.getTime())) return ts;
            return d.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        };

        vm.action = $state.current.data.action;


        switch(vm.action){
            case "list":
                //need to update this to be part of the authentication
                //to find out club id
                //'9' needs to refer the the user's account set to manage
                ClubService.GetById(vm.club_id)
                    .then(function(data){
                        vm.club.settings = data;
                        vm.club.settings.vat_registered = (vm.club.settings.vat_registered == 1)? true : false;
                        vm.club.settings.tpc_aircraft_surchages = (vm.club.settings.tpc_aircraft_surchages == 1)? true : false;
                        vm.club.settings.require_booking_confirmation = (vm.club.settings.require_booking_confirmation == 1)? true : false;
                        vm.club.settings.booking_name_visibility = vm.club.settings.booking_name_visibility || 'everyone';
                        vm.club.settings.airworthiness_booking_policy = vm.club.settings.airworthiness_booking_policy || 'allow';
                        vm.club.settings.airworthiness_bookout_policy = vm.club.settings.airworthiness_bookout_policy || 'allow';
                        vm.club.settings.pilot_checks_bookout_policy = vm.club.settings.pilot_checks_bookout_policy || 'allow';
                        // Reminder policy is effectively two-state (allow vs include
                        // warnings); the backend treats 'warn' and 'force' the same
                        // for reminders, so normalise 'force' → 'warn' for the toggle.
                        vm.club.settings.airworthiness_reminder_policy =
                            (vm.club.settings.airworthiness_reminder_policy === 'warn' || vm.club.settings.airworthiness_reminder_policy === 'force')
                            ? 'warn' : 'allow';

                        // ── Booking Edit Time Limits ──
                        vm.club.settings.edit_window_admin_minutes = parseInt(vm.club.settings.edit_window_admin_minutes) || 0;
                        vm.club.settings.edit_window_instructor_minutes = parseInt(vm.club.settings.edit_window_instructor_minutes) || 0;
                        vm.club.settings.edit_window_member_minutes = parseInt(vm.club.settings.edit_window_member_minutes) || 0;
                        vm.initEditWindowPresets();

                        vm.club.settings.vat_rate = parseFloat(vm.club.settings.vat_rate);
                        //console.log(vm.club);
                    });

                // Load aircraft check types
                vm.loadCheckTypes();

                // Load the pre-solo requirements checklist
                vm.loadSoloRequirements();

                // Load schedule display token
                vm.loadDisplayToken();

                // Load voucher widget token status
                VoucherWidgetService.GetToken(vm.club_id)
                    .then(function(data) {
                        vm.voucher_widget_active = !!(data.success && data.token && data.token.active);
                    });

                // Load daily aircraft status report settings (manager-gated)
                if (vm.is_manager) {
                    vm.dasLoadSettings();
                }

            break;
            case "stripe_return":
                //need to update this to be part of the authentication
                //to find out club id
                vm.stripe_id = $stateParams.stripe_id;
                //generate a link here and do something cool with it!!
                PaymentService.SaveStripeLink(vm.club_id, vm.stripe_id)
                .then(function(data){
                    console.log(data);

                    //$state.go('dashboard.manage_club');
                });

            break;
            case "stripe_refresh":
                //need to update this to be part of the authentication
                vm.stripe_id = $stateParams.stripe_id;
                //to find out club id
                PaymentService.RefreshStripeLink(vm.club_id, vm.stripe_id)
                    .then(function(data){
                        //vm.club.courses = data.items;   
                        console.log(data);
                    });
            break;
            default:
                //console.log("none of the above... redirect somewhere?");
            break;
        }  


       


        $scope.processFiles = function(files, image){

            for(var i=0; i<files.length; i++){
                // //console.log("JSON", files[i].file_return);
                var j = JSON.parse(files[i].file_return);
                // //console.log("PARSED", j);
                files[i].file.temp_path = j.saved_url;

                var update_text = "update_"+image;
                // //console.log("file", files[i].file);
                vm.club.settings[image] = files[i].file;
                vm.club.settings[image] = files[i].file.temp_path;
                vm.club.settings[update_text] = true;
                // //console.log(vm.club.settings[image]);
            }
           
        }

        vm.clearFieldError = function(event) { ToastService.clearFieldError(event); };

        $scope.save = function(){
            var checks = [
                { ok: vm.club.settings.title,   field: 'title',   label: 'Trading As' },
                { ok: vm.club.settings.email,   field: 'email',   label: 'Email' },
                { ok: vm.club.settings.address, field: 'address', label: 'Registered Address' }
            ];
            if (vm.club.settings.vat_registered) {
                checks.push({ ok: vm.club.settings.vat_number, field: 'vat_number', label: 'VAT Number' });
                checks.push({ ok: vm.club.settings.vat_rate != null && vm.club.settings.vat_rate !== '', field: 'vat_rate', label: 'VAT Rate' });
            }
            if (!ToastService.validateForm(checks)) return;

            if(!vm.club.settings.update_logo){
                    delete vm.club.settings.logo;
            }
            if(!vm.club.settings.update_invoice_logo){
                    delete vm.club.settings.invoice_logo;
            }

            if(vm.privacy_file){
                vm.club.settings.privacy_terms = vm.privacy_file;
            } else {
                delete(vm.club.settings.privacy_terms);
            }

            if(vm.membership_file){
                vm.club.settings.membership_terms = vm.membership_file;
            }else {
                delete(vm.club.settings.membership_terms);
            }

            if(vm.passenger_file){
                vm.club.settings.passenger_terms = vm.passenger_file;
            }else {
                delete(vm.club.settings.passenger_terms);
            }

            delete(vm.club.settings.membership_updated);
            delete(vm.club.settings.passenger_updated);
            delete(vm.club.settings.privacy_updated);

            delete(vm.club.settings.updated_at);
            delete(vm.club.settings.created_at);
            delete(vm.club.settings.gcl);
            delete(vm.club.settings.salt);
            delete(vm.club.settings.pepper);

            vm.club.settings.vat_registered = (vm.club.settings.vat_registered)? 1 : 0;
            vm.club.settings.tpc_aircraft_surchages = (vm.club.settings.tpc_aircraft_surchages)? 1 : 0;
            vm.club.settings.require_booking_confirmation = (vm.club.settings.require_booking_confirmation)? 1 : 0;

            // ── Booking Edit Time Limits ──
            vm.club.settings.edit_window_admin_minutes = parseInt(vm.club.settings.edit_window_admin_minutes) || 0;
            vm.club.settings.edit_window_instructor_minutes = parseInt(vm.club.settings.edit_window_instructor_minutes) || 0;
            vm.club.settings.edit_window_member_minutes = parseInt(vm.club.settings.edit_window_member_minutes) || 0;

            ClubService.Update(vm.club.settings)
                .then(function(data){
                    //console.log(data);
                    $state.go('dashboard.manage_club');
                });
        }

        initController();

        function initController() {
           //console.log("check if access is okay");
        }

        vm.called_stripe_setup = false;
        vm.generate_stripe_link = function(){

            vm.called_stripe_setup = true;

            //generate a link here and do something cool with it!!
            PaymentService.GenerateStripeLink(vm.club.settings)
                .then(function(data){
                    console.log(data);

                    if(data.success && data.onboarding_link !== ''){
                        ToastService.success('Stripe Redirect', 'You will be redirected to Stripe - please complete the setup and you will be returned to ToAviate');
                        window.location = data.onboarding_link;
                    } else {
                        ToastService.error('Stripe Error', "Please try the link again! Stripe didn't seem to want to connect to ToAviate");
                        vm.called_stripe_setup = false;
                    }


                    //$state.go('dashboard.manage_club');
                });


        }

        // ── Payment Mode (Sandbox vs Live) ──
        vm.payment_mode_status = null;
        vm.payment_mode_loading = false;

        vm.loadPaymentMode = function() {
            vm.payment_mode_loading = true;
            PaymentModeService.GetStatus(vm.club_id).then(function(data) {
                vm.payment_mode_loading = false;
                if (data && data.success) {
                    vm.payment_mode_status = data;
                }
            });
        };
        vm.loadPaymentMode();

        vm.openPaymentModeSwitch = function() {
            if (!vm.payment_mode_status) { return; }

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'views/modals/payment_mode_switch.html',
                controller: 'PaymentModeSwitchModalCtrl',
                controllerAs: 'vm',
                size: 'md',
                backdrop: 'static',
                resolve: {
                    status: function() { return vm.payment_mode_status; },
                    club_name: function() {
                        return (vm.club && (vm.club.name || (vm.club.item && vm.club.item.name))) ||
                            'this club';
                    }
                }
            });

            modalInstance.result.then(function(data) {
                // Switch succeeded. The leaving mode's saved methods were removed and the
                // club's gateway connections reset, so invalidate the cached Stripe key.
                PaymentService.ClearClubStripeKey(vm.club_id);

                var sub = (data && data.message) ? data.message :
                    ('Switched to ' + (data.to_mode || '').toUpperCase() + '. ' +
                     (data.members_cleared || 0) + ' saved method(s) were removed; ' +
                     'members must re-add their details.');
                ToastService.success('Payment Mode Updated', sub);

                vm.loadPaymentMode();
            }, function() {
                // dismissed — nothing to do
            });
        };

        vm.term_documents = [];

         $scope.processFiles2 = function(files, current_files){
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
                    switch(current_files){
                        case 'privacy':
                        vm.privacy_file = files[i].file;
                        break;
                        case 'membership':
                        vm.membership_file = files[i].file;
                        break;
                        case 'passenger':
                        vm.passenger_file = files[i].file;
                        break;
                    }
                    //vm.term_documents[current_files] = files[i].file;
                }


            }

            $scope.delete_file = function(filetype){
                var to_delete;
                    switch(filetype){
                        case 'privacy':
                        to_delete = vm.club.settings.privacy_terms;
                        vm.club.settings.privacy_terms = "";
                        break;
                        case 'membership':
                        to_delete = vm.club.settings.membership_terms;
                        vm.club.settings.membership_terms = "";
                        break;
                        case 'passenger':
                        to_delete = vm.club.settings.passenger_terms;
                        vm.club.settings.passenger_terms = "";
                        break;
                    }
                    
                    //think about deleting the actual file API call





            }

            $scope.remove_file = function(file, current_files){

                //remove_file
                var j = JSON.parse(file.file_return);
                //console.log("REMOVE: ", j);
                //console.log("REMOVE: ", j.saved_url);


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

            $scope.set_title = function(file){
                //console.log("return", file);
                return file.save_name;
            }

            $scope.back = function(){
                $rootScope.safeBack();
            }

            $scope.get_icon = function(file){

                var ft;
                if(file && file.name){
                     ft = file.name;
                } else {
                    ft = file;
                }
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
                    ToastService.error('Download Error', 'There was an error downloading the selected document(s)');
                })
        };

        function titlepath(path,name){

        //In this path defined as your pdf url and name (your pdf name)
            var prntWin = window.open();
            prntWin.document.write("<html><head><title>"+name+"</title></head><body>"
                + '<embed width="100%" height="100%" name="plugin" src="'+ path+ '" '
                + 'type="application/pdf" internalinstanceid="21"></body></html>');
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
                // Try using msSaveBlob if supported
                var blob = new Blob([data], 
                    //type: contentType
                    {type: 'application/pdf'}
                //}
                );


                var fileURL = URL.createObjectURL(blob);
                //window.open(fileURL);
                titlepath(fileURL, "Secure Documents");
                
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