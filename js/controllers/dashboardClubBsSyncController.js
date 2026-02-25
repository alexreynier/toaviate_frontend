// ─────────────────────────────────────────────────────
// DashboardClubBsSyncController
// BookedScheduler Sync management page
// ─────────────────────────────────────────────────────
app.controller('DashboardClubBsSyncController', DashboardClubBsSyncController);

    DashboardClubBsSyncController.$inject = ['BsSyncService', 'PlaneService', 'MemberService', 'MembershipService', 'ToastService', '$rootScope', '$scope', '$state', '$timeout', '$filter'];
    function DashboardClubBsSyncController(BsSyncService, PlaneService, MemberService, MembershipService, ToastService, $rootScope, $scope, $state, $timeout, $filter) {
        var vm = this;

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;

        // ── Tab state ──
        vm.activeTab = 'status';
        vm.setTab = function(t) { vm.activeTab = t; };

        // ── Loading flags ──
        vm.loading = { status: false, resources: false, users: false, sync: false, logs: false, imported: false, config: false };
        vm.discovering = { resources: false, users: false, instructors: false, usersReservations: false };

        // ── Status ──
        vm.status = null;
        vm.config = null;
        vm.configEditing = false;
        vm.configForm = {};
        vm.noConfig = false;   // true if 404 — show setup form

        // ── Setup Wizard ──
        vm.setupStep = 1;          // 1=config, 2=upload, 3=importing, 4=review
        vm.setupConfigForm = {
            api_url: '',
            api_username: '',
            api_password: '',
            sync_enabled: 1,
            sync_interval_minutes: 30,
            sync_start_date: new Date(2024, 0, 1),
            sync_end_date: new Date(2026, 11, 31)
        };
        vm.setupSaving = false;

        // ── CSV Upload ──
        var _csvFile = null;   // kept off vm to avoid $digest serialization of native File
        vm.csvFileName = '';
        vm.uploadMode = 'full';    // 'full' | 'import_only'
        vm.uploadMembershipId = 0;
        vm.memberships = [];
        vm.uploading = false;
        vm.setupResult = null;     // result from full setup
        vm.importResult = null;    // result from import-only

        // ── Step-by-step after import-only ──
        vm.stepByStep = {
            discoverAircraft: null,
            discoverInstructors: null,
            discoverUsers: null,
            sync: null
        };

        // ── Purge ──
        vm.showPurgeConfirm = false;
        vm.purgeTyped = '';
        vm.purging = false;
        vm.purgeResult = null;

        // ── Resources ──
        vm.resources = [];
        vm.clubPlanes = [];

        // ── Users ──
        vm.users = [];
        vm.clubMembers = [];
        vm.usersFilter = 'all';       // 'all' | 'unmapped' | 'mapped'
        vm.usersSearch = '';
        vm.usersPage = 1;
        vm.usersPerPage = 50;

        // ── Sync ──
        vm.syncForm = { sync_type: 'incremental', start_date: null, end_date: null };
        vm.syncRunning = false;
        vm.syncResult = null;
        vm.logs = [];

        // ── Imported Users ──
        vm.importedUsers = [];
        vm.importedSearch = '';
        vm.convertingAll = false;

        // ── Delete bookings ──
        vm.showDeleteConfirm = false;
        vm.deleting = false;

        // ── Date helpers (input[type=date] requires Date objects) ──
        function parseDate(str) {
            if (!str) return null;
            if (str instanceof Date) return str;
            var parts = String(str).split('-');
            if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
            return null;
        }
        function formatDate(d) {
            if (!d) return '';
            if (typeof d === 'string') return d;
            var y = d.getFullYear();
            var m = ('0' + (d.getMonth() + 1)).slice(-2);
            var dd = ('0' + d.getDate()).slice(-2);
            return y + '-' + m + '-' + dd;
        }

        // ════════════════════════════════════════════
        // INIT
        // ════════════════════════════════════════════
        vm.init = function() {
            vm.loadStatus();
        };

        // ════════════════════════════════════════════
        // TAB 1: STATUS
        // ════════════════════════════════════════════
        vm.loadStatus = function() {
            vm.loading.status = true;
            BsSyncService.GetStatus(vm.club_id).then(function(data) {
                vm.loading.status = false;
                if (data && data.config) {
                    vm.status = data;
                    vm.config = data.config;
                    vm.configForm = angular.copy(data.config);
                    vm.configForm.sync_start_date = parseDate(vm.configForm.sync_start_date);
                    vm.configForm.sync_end_date = parseDate(vm.configForm.sync_end_date);
                    vm.noConfig = false;
                } else {
                    // No config found — show setup wizard
                    vm.status = null;
                    vm.config = null;
                    vm.noConfig = true;
                    vm.activeTab = 'setup';
                    vm.setupStep = 1;
                }
            }, function() {
                vm.loading.status = false;
                vm.noConfig = true;
                vm.activeTab = 'setup';
                vm.setupStep = 1;
            });
        };

        vm.timeAgo = function(dateStr) {
            if (!dateStr) return '—';
            var then = new Date(dateStr.replace(' ', 'T') + 'Z');
            var now = new Date();
            var diff = Math.floor((now - then) / 1000);
            if (diff < 60) return diff + 's ago';
            if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            return Math.floor(diff / 86400) + 'd ago';
        };

        vm.toggleSync = function() {
            var newVal = vm.config.sync_enabled == 1 ? 0 : 1;
            BsSyncService.UpdateConfig(vm.club_id, { sync_enabled: newVal }).then(function(data) {
                if (data.success) {
                    vm.config.sync_enabled = newVal;
                    ToastService.success('Sync ' + (newVal ? 'Enabled' : 'Disabled'), 'Automatic sync has been ' + (newVal ? 'enabled' : 'disabled') + '.');
                } else {
                    ToastService.error('Error', data.message || 'Failed to update sync setting.');
                }
            });
        };

        vm.quickSync = function() {
            vm.syncRunning = true;
            BsSyncService.RunSync(vm.club_id, { sync_type: 'manual' }).then(function(data) {
                vm.syncRunning = false;
                if (data.success) {
                    vm.syncResult = data.stats;
                    ToastService.success('Sync Complete', 'Created: ' + data.stats.bookings_created + ', Updated: ' + data.stats.bookings_updated);
                    vm.loadStatus();
                } else {
                    ToastService.error('Sync Failed', data.message || 'The sync encountered an error.');
                }
            }, function() {
                vm.syncRunning = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        // ── Config edit ──
        vm.startEditConfig = function() {
            vm.configForm = angular.copy(vm.config);
            vm.configForm.sync_start_date = parseDate(vm.configForm.sync_start_date);
            vm.configForm.sync_end_date = parseDate(vm.configForm.sync_end_date);
            vm.configEditing = true;
        };

        vm.cancelEditConfig = function() {
            vm.configEditing = false;
        };

        vm.saveConfig = function() {
            vm.loading.config = true;
            var payload = {
                sync_enabled: vm.configForm.sync_enabled ? 1 : 0,
                sync_interval_minutes: vm.configForm.sync_interval_minutes,
                sync_start_date: formatDate(vm.configForm.sync_start_date),
                sync_end_date: formatDate(vm.configForm.sync_end_date)
            };
            BsSyncService.UpdateConfig(vm.club_id, payload).then(function(data) {
                vm.loading.config = false;
                if (data.success) {
                    vm.configEditing = false;
                    ToastService.success('Config Saved', 'Sync configuration has been updated.');
                    vm.loadStatus();
                } else {
                    ToastService.error('Error', data.message || 'Failed to save configuration.');
                }
            }, function() {
                vm.loading.config = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };


        // ════════════════════════════════════════════
        // SETUP WIZARD
        // ════════════════════════════════════════════

        // Step 1: Save config
        vm.saveSetupConfig = function() {
            if (!vm.setupConfigForm.api_url || !vm.setupConfigForm.api_username || !vm.setupConfigForm.api_password) {
                ToastService.warning('Missing Fields', 'Please fill in the API URL, username, and password.');
                return;
            }
            vm.setupSaving = true;
            var setupPayload = angular.copy(vm.setupConfigForm);
            setupPayload.sync_start_date = formatDate(setupPayload.sync_start_date);
            setupPayload.sync_end_date = formatDate(setupPayload.sync_end_date);
            BsSyncService.UpdateConfig(vm.club_id, setupPayload).then(function(data) {
                vm.setupSaving = false;
                if (data.success) {
                    ToastService.success('Config Saved', 'BookedScheduler connection configured.');
                    vm.setupStep = 2;
                    vm.loadMemberships();
                } else {
                    ToastService.error('Error', data.message || 'Failed to save configuration.');
                }
            }, function() {
                vm.setupSaving = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        // Load memberships for the optional dropdown
        vm.loadMemberships = function() {
            if (vm.memberships.length > 0) return;
            MembershipService.GetAllByClub(vm.club_id).then(function(data) {
                vm.memberships = angular.isArray(data) ? data : (data.memberships || []);
            });
        };

        // Step 2: File input handler
        vm.onCsvFileSelect = function(files) {
            $scope.$apply(function() {
                if (files && files.length > 0) {
                    _csvFile = files[0];
                    vm.csvFileName = files[0].name;
                }
            });
        };

        vm.clearCsvFile = function() {
            _csvFile = null;
            vm.csvFileName = '';
        };

        // Step 2→3: Upload CSV
        vm.startUpload = function() {
            if (!_csvFile) {
                ToastService.warning('No File', 'Please select a CSV file to upload.');
                return;
            }
            vm.uploading = true;
            vm.setupResult = null;
            vm.importResult = null;
            vm.setupStep = 3;

            if (vm.uploadMode === 'full') {
                BsSyncService.FullSetup(vm.club_id, _csvFile, vm.uploadMembershipId).then(function(data) {
                    vm.uploading = false;
                    if (data.success) {
                        vm.setupResult = data.steps || data;
                        vm.setupStep = 4;
                        ToastService.success('Setup Complete', 'Full BookedScheduler setup finished successfully.');
                    } else {
                        vm.setupResult = data;
                        vm.setupStep = 4;
                        ToastService.error('Setup Issue', data.message || 'Setup completed with issues — check the results.');
                    }
                }, function() {
                    vm.uploading = false;
                    vm.setupStep = 2;
                    ToastService.error('Error', 'Could not connect to the server. Please try again.');
                });
            } else {
                BsSyncService.ImportCSV(vm.club_id, _csvFile, vm.uploadMembershipId).then(function(data) {
                    vm.uploading = false;
                    if (data.success) {
                        vm.importResult = data.stats || data;
                        vm.setupStep = 4;
                        ToastService.success('Import Complete', 'Users imported from CSV.');
                    } else {
                        vm.importResult = data;
                        vm.setupStep = 4;
                        ToastService.error('Import Issue', data.message || 'Import completed with issues.');
                    }
                }, function() {
                    vm.uploading = false;
                    vm.setupStep = 2;
                    ToastService.error('Error', 'Could not connect to the server. Please try again.');
                });
            }
        };

        // Step-by-step discover after import-only
        vm.stepDiscoverAircraft = function() {
            vm.discovering.resources = true;
            BsSyncService.DiscoverResources(vm.club_id).then(function(data) {
                vm.discovering.resources = false;
                vm.stepByStep.discoverAircraft = data;
                ToastService.success('Done', 'Aircraft resources discovered.');
            }, function() {
                vm.discovering.resources = false;
                ToastService.error('Error', 'Failed to discover aircraft.');
            });
        };

        vm.stepDiscoverInstructors = function() {
            vm.discovering.instructors = true;
            BsSyncService.DiscoverInstructors(vm.club_id).then(function(data) {
                vm.discovering.instructors = false;
                vm.stepByStep.discoverInstructors = data;
                ToastService.success('Done', 'Instructor resources discovered.');
            }, function() {
                vm.discovering.instructors = false;
                ToastService.error('Error', 'Failed to discover instructors.');
            });
        };

        vm.stepDiscoverUsers = function() {
            vm.discovering.usersReservations = true;
            BsSyncService.DiscoverUsersFromReservations(vm.club_id).then(function(data) {
                vm.discovering.usersReservations = false;
                vm.stepByStep.discoverUsers = data;
                ToastService.success('Done', 'User mappings discovered from reservations.');
            }, function() {
                vm.discovering.usersReservations = false;
                ToastService.error('Error', 'Failed to discover user mappings.');
            });
        };

        vm.stepRunSync = function() {
            vm.syncRunning = true;
            BsSyncService.RunSync(vm.club_id, { sync_type: 'full' }).then(function(data) {
                vm.syncRunning = false;
                vm.stepByStep.sync = data.stats || data;
                if (data.success) {
                    ToastService.success('Sync Complete', 'Bookings synced successfully.');
                } else {
                    ToastService.error('Sync Issue', data.message || 'Sync completed with issues.');
                }
            }, function() {
                vm.syncRunning = false;
                ToastService.error('Error', 'Failed to run sync.');
            });
        };

        // Finish setup → go to main dashboard
        vm.finishSetup = function() {
            vm.noConfig = false;
            vm.setupResult = null;
            vm.importResult = null;
            vm.stepByStep = { discoverAircraft: null, discoverInstructors: null, discoverUsers: null, sync: null };
            _csvFile = null;
            vm.csvFileName = '';
            vm.activeTab = 'status';
            vm.loadStatus();
        };

        // Re-run setup (go back to step 2)
        vm.rerunSetup = function() {
            vm.setupResult = null;
            vm.importResult = null;
            _csvFile = null;
            vm.csvFileName = '';
            vm.setupStep = 2;
            vm.loadMemberships();
        };


        // ════════════════════════════════════════════
        // PURGE (RESET)
        // ════════════════════════════════════════════
        vm.openPurge = function() {
            vm.showPurgeConfirm = true;
            vm.purgeTyped = '';
            vm.purgeResult = null;
        };

        vm.cancelPurge = function() {
            vm.showPurgeConfirm = false;
            vm.purgeTyped = '';
        };

        vm.executePurge = function() {
            if (vm.purgeTyped !== 'PURGE') {
                ToastService.warning('Confirmation Required', 'Please type PURGE to confirm.');
                return;
            }
            vm.purging = true;
            BsSyncService.Purge(vm.club_id).then(function(data) {
                vm.purging = false;
                if (data.success) {
                    vm.purgeResult = data.stats || data;
                    vm.showPurgeConfirm = false;
                    ToastService.success('Purged', 'All imported data has been removed. Config is preserved.');
                    vm.loadStatus();
                } else {
                    ToastService.error('Error', data.message || 'Purge failed.');
                }
            }, function() {
                vm.purging = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };


        // ════════════════════════════════════════════
        // TAB 2: RESOURCES
        // ════════════════════════════════════════════
        vm.loadResources = function() {
            vm.loading.resources = true;
            BsSyncService.GetResources(vm.club_id).then(function(data) {
                vm.loading.resources = false;
                vm.resources = angular.isArray(data) ? data : (data.resources || []);
            }, function() {
                vm.loading.resources = false;
            });

            // Also load club planes for the dropdown
            if (vm.clubPlanes.length === 0) {
                PlaneService.GetAllByClub(vm.club_id).then(function(data) {
                    vm.clubPlanes = data || [];
                });
            }
        };

        vm.discoverResources = function() {
            vm.discovering.resources = true;
            BsSyncService.DiscoverResources(vm.club_id).then(function(data) {
                vm.discovering.resources = false;
                if (data.success !== false) {
                    ToastService.success('Resources Discovered', 'Resource list has been refreshed from BookedScheduler.');
                    vm.loadResources();
                } else {
                    ToastService.error('Error', data.message || 'Failed to discover resources.');
                }
            }, function() {
                vm.discovering.resources = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.discoverInstructors = function() {
            vm.discovering.instructors = true;
            BsSyncService.DiscoverInstructors(vm.club_id).then(function(data) {
                vm.discovering.instructors = false;
                if (data.success !== false) {
                    ToastService.success('Instructors Discovered', 'Instructor resources refreshed from BookedScheduler.');
                    vm.loadResources();
                } else {
                    ToastService.error('Error', data.message || 'Failed to discover instructors.');
                }
            }, function() {
                vm.discovering.instructors = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.saveResourceMap = function(res) {
            // console.log("Saving resource map", res);
            if (!res._selected_plane) {
                ToastService.warning('Select Aircraft', 'Please select a TA aircraft to map this resource to.');
                return;
            }
            // console.log("vm.clubPlanes", vm.clubPlanes);
            // console.log("res._selected_plane", res._selected_plane);
            var plane = vm.clubPlanes.find(function(p) { return p.id == res._selected_plane; });
            // console.log("Selected plane for mapping", plane);
            if (!plane) return;
            // console.log("Saving map for resource", res.bs_resource_name, "to plane", plane.registration);

            res._saving = true;
            BsSyncService.SaveResourceMap(vm.club_id, res.bs_resource_id, {
                ta_plane_id: plane.plane_id || plane.id,
                ta_club_plane_id: plane.cp_id || plane.id
            }).then(function(data) {
                res._saving = false;
                if (data.success !== false) {
                    ToastService.success('Mapped', res.bs_resource_name + ' → ' + (plane.registration || plane.name));
                    vm.loadResources();
                } else {
                    ToastService.error('Error', data.message || 'Failed to save mapping.');
                }
            }, function() {
                res._saving = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.resourceMapped = function(res) {

            return res.ta_plane_id && res.ta_club_plane_id;
        };


        // ════════════════════════════════════════════
        // TAB 3: USERS
        // ════════════════════════════════════════════
        vm.loadUsers = function() {
            vm.loading.users = true;
            var unmapped = (vm.usersFilter === 'unmapped') ? 1 : 0;
            BsSyncService.GetUsers(vm.club_id, unmapped).then(function(data) {
                vm.loading.users = false;
                vm.users = angular.isArray(data) ? data : (data.users || []);
                vm.usersPage = 1;
            }, function() {
                vm.loading.users = false;
            });

            // Load club members for mapping dropdown
            if (vm.clubMembers.length === 0) {
                MemberService.GetAllByClub(vm.club_id).then(function(data) {
                    vm.clubMembers = angular.isArray(data) ? data : (data.members || []);
                });
            }
        };

        vm.discoverUsers = function() {
            vm.discovering.users = true;
            BsSyncService.DiscoverUsers(vm.club_id).then(function(data) {
                vm.discovering.users = false;
                if (data.success !== false) {
                    ToastService.success('Users Discovered', 'User list has been refreshed from BookedScheduler.');
                    vm.loadUsers();
                } else {
                    ToastService.error('Error', data.message || 'Failed to discover users.');
                }
            }, function() {
                vm.discovering.users = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.discoverUsersFromReservations = function() {
            vm.discovering.usersReservations = true;
            BsSyncService.DiscoverUsersFromReservations(vm.club_id).then(function(data) {
                vm.discovering.usersReservations = false;
                if (data.success !== false) {
                    ToastService.success('Users Discovered', 'User mappings refreshed from reservation data.');
                    vm.loadUsers();
                } else {
                    ToastService.error('Error', data.message || 'Failed to discover user mappings.');
                }
            }, function() {
                vm.discovering.usersReservations = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.saveUserMap = function(u) {
            if (!u._selected_member) {
                ToastService.warning('Select Member', 'Please select a TA member to map this user to.');
                return;
            }
            u._saving = true;
            BsSyncService.SaveUserMap(vm.club_id, u.bs_user_id, {
                ta_user_id: u._selected_member
            }).then(function(data) {
                u._saving = false;
                if (data.success !== false) {
                    ToastService.success('Mapped', u.bs_first_name + ' ' + u.bs_last_name + ' mapped successfully.');
                    vm.loadUsers();
                } else {
                    ToastService.error('Error', data.message || 'Failed to save mapping.');
                }
            }, function() {
                u._saving = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.filteredUsers = function() {
            var list = vm.users;
            if (vm.usersFilter === 'mapped') {
                list = list.filter(function(u) { return u.ta_user_id; });
            } else if (vm.usersFilter === 'unmapped') {
                list = list.filter(function(u) { return !u.ta_user_id; });
            }
            if (vm.usersSearch) {
                var q = vm.usersSearch.toLowerCase();
                list = list.filter(function(u) {
                    return (u.bs_first_name + ' ' + u.bs_last_name + ' ' + u.bs_email + ' ' + (u.ta_first_name || '') + ' ' + (u.ta_last_name || '')).toLowerCase().indexOf(q) !== -1;
                });
            }
            return list;
        };

        vm.pagedUsers = function() {
            var all = vm.filteredUsers();
            var start = (vm.usersPage - 1) * vm.usersPerPage;
            return all.slice(start, start + vm.usersPerPage);
        };

        vm.usersTotalPages = function() {
            return Math.ceil(vm.filteredUsers().length / vm.usersPerPage) || 1;
        };

        vm.usersSetPage = function(p) {
            if (p >= 1 && p <= vm.usersTotalPages()) vm.usersPage = p;
        };

        vm.userMapped = function(u) {
            return !!u.ta_user_id;
        };


        // ════════════════════════════════════════════
        // TAB 4: SYNC
        // ════════════════════════════════════════════
        vm.runSync = function() {
            vm.syncRunning = true;
            vm.syncResult = null;
            var payload = {
                sync_type: vm.syncForm.sync_type
            };
            if (vm.syncForm.start_date) payload.start_date = formatDate(vm.syncForm.start_date);
            if (vm.syncForm.end_date) payload.end_date = formatDate(vm.syncForm.end_date);

            BsSyncService.RunSync(vm.club_id, payload).then(function(data) {
                vm.syncRunning = false;
                if (data.success) {
                    vm.syncResult = data.stats;
                    ToastService.success('Sync Complete', 'Reservations synced successfully.');
                    vm.loadLogs();
                    vm.loadStatus();
                } else {
                    ToastService.error('Sync Failed', data.message || 'An error occurred during sync.');
                }
            }, function() {
                vm.syncRunning = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.loadLogs = function() {
            vm.loading.logs = true;
            BsSyncService.GetLogs(vm.club_id, 20).then(function(data) {
                vm.loading.logs = false;
                vm.logs = angular.isArray(data) ? data : (data.logs || []);
            }, function() {
                vm.loading.logs = false;
            });
        };

        vm.confirmDeleteBookings = function() {
            vm.showDeleteConfirm = true;
        };

        vm.cancelDelete = function() {
            vm.showDeleteConfirm = false;
        };

        vm.deleteBookings = function() {
            vm.deleting = true;
            BsSyncService.DeleteBookings(vm.club_id).then(function(data) {
                vm.deleting = false;
                vm.showDeleteConfirm = false;
                if (data.success) {
                    ToastService.success('Deleted', 'All synced bookings have been removed.');
                    vm.loadStatus();
                } else {
                    ToastService.error('Error', data.message || 'Failed to delete bookings.');
                }
            }, function() {
                vm.deleting = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };


        // ════════════════════════════════════════════
        // TAB 5: IMPORTED USERS
        // ════════════════════════════════════════════
        vm.loadImportedUsers = function() {
            vm.loading.imported = true;
            // Re-use the users endpoint — imported users have fake emails
            BsSyncService.GetUsers(vm.club_id, 0).then(function(data) {
                vm.loading.imported = false;
                var all = angular.isArray(data) ? data : (data.users || []);
                vm.importedUsers = all.filter(function(u) {
                    return u.ta_email && u.ta_email.indexOf('bs0') === 0 && u.ta_email.indexOf('@toaviate.com') !== -1;
                });
            }, function() {
                vm.loading.imported = false;
            });
        };

        vm.convertUser = function(u) {
            u._converting = true;
            BsSyncService.ConvertUser(vm.club_id, u.ta_user_id).then(function(data) {
                u._converting = false;
                if (data.success) {
                    u._converted = true;
                    ToastService.success('Converted', 'Invitation sent to ' + u.bs_email);
                } else {
                    ToastService.error('Error', data.message || 'Failed to convert user.');
                }
            }, function() {
                u._converting = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.convertAll = function() {
            if (!confirm('This will send invitations to ALL imported users. Continue?')) return;
            vm.convertingAll = true;
            var toConvert = vm.filteredImported().filter(function(u) { return !u._converted; });
            var idx = 0;

            function next() {
                if (idx >= toConvert.length) {
                    vm.convertingAll = false;
                    ToastService.success('Done', 'All imported users have been sent invitations.');
                    $scope.$apply();
                    return;
                }
                var u = toConvert[idx];
                u._converting = true;
                BsSyncService.ConvertUser(vm.club_id, u.ta_user_id).then(function(data) {
                    u._converting = false;
                    if (data.success) u._converted = true;
                    idx++;
                    next();
                }, function() {
                    u._converting = false;
                    idx++;
                    next();
                });
            }
            next();
        };

        vm.filteredImported = function() {
            if (!vm.importedSearch) return vm.importedUsers;
            var q = vm.importedSearch.toLowerCase();
            return vm.importedUsers.filter(function(u) {
                return ((u.bs_first_name || '') + ' ' + (u.bs_last_name || '') + ' ' + (u.bs_email || '') + ' ' + (u.ta_email || '')).toLowerCase().indexOf(q) !== -1;
            });
        };


        // ════════════════════════════════════════════
        // Tab switching triggers data load
        // ════════════════════════════════════════════
        $scope.$watch(function() { return vm.activeTab; }, function(newTab) {
            switch (newTab) {
                case 'status':    if (!vm.status) vm.loadStatus(); break;
                case 'resources': if (vm.resources.length === 0) vm.loadResources(); break;
                case 'users':     if (vm.users.length === 0) vm.loadUsers(); break;
                case 'sync':      if (vm.logs.length === 0) vm.loadLogs(); break;
                case 'imported':  if (vm.importedUsers.length === 0) vm.loadImportedUsers(); break;
                case 'setup':     vm.loadMemberships(); break;
            }
        });

        // ── Init ──
        vm.init();
    }
