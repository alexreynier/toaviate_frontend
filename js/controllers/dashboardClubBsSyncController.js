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
        vm.clubMembersForResources = [];   // members/instructors for resource mapping dropdown
        vm.resourceMapOptions = [];         // flat array for ng-options: [{value, label, group}]
        vm.userMapOptions = [];             // flat array for ng-options on users tab: [{value, label}]

        // ── Users ──
        vm.users = [];
        vm.clubMembers = [];
        vm.usersFilter = 'all';       // 'all' | 'unmapped' | 'mapped'
        vm.usersSearch = '';
        vm.usersPage = 1;
        vm.usersPerPage = 50;

        // ── Cached computed lists (avoid recalculating on every $digest) ──
        vm._filteredUsers = [];
        vm._pagedUsers = [];
        vm._totalPages = 1;
        vm._filteredImported = [];

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
        // SHARED: Load club members once, share between resources & users tabs
        // ════════════════════════════════════════════
        var _membersLoaded = false;
        var _membersLoadedPromise = null;
        function _ensureMembersLoaded() {
            if (_membersLoaded) return _membersLoadedPromise;
            _membersLoaded = true;
            _membersLoadedPromise = MemberService.GetAllByClub(vm.club_id).then(function(data) {
                var members = angular.isArray(data) ? data : (data.members || []);
                vm.clubMembers = members;
                vm.clubMembersForResources = members;
                _rebuildUserMapOptions();
                _rebuildResourceMapOptions();
                return members;
            });
            return _membersLoadedPromise;
        }

        // Build the flat options array for user mapping dropdowns (used with ng-options)
        function _rebuildUserMapOptions() {
            vm.userMapOptions = vm.clubMembers.map(function(m) {
                var uid = String(m.user_id || m.id);
                return {
                    value: uid,
                    label: (m.first_name || '') + ' ' + (m.last_name || '') + (m.email ? ' (' + m.email + ')' : '')
                };
            });
        }

        // Build the flat options array for resource mapping dropdowns (planes + users, with group key)
        function _rebuildResourceMapOptions() {
            var opts = [];
            for (var i = 0; i < vm.clubPlanes.length; i++) {
                var p = vm.clubPlanes[i];
                opts.push({
                    value: 'plane_' + p.id,
                    label: (p.registration || p.name || '') + (p.plane_type ? ' (' + p.plane_type + ')' : ''),
                    group: 'Aircraft'
                });
            }
            for (var j = 0; j < vm.clubMembersForResources.length; j++) {
                var m = vm.clubMembersForResources[j];
                opts.push({
                    value: 'user_' + (m.user_id || m.id),
                    label: (m.first_name || '') + ' ' + (m.last_name || '') + (m.email ? ' (' + m.email + ')' : ''),
                    group: 'Users / Instructors'
                });
            }
            vm.resourceMapOptions = opts;
        }

        // Stamp _isMapped and _isMappedToUser flags directly on each resource object
        function _stampResourceFlags() {
            for (var i = 0; i < vm.resources.length; i++) {
                var r = vm.resources[i];
                r._isMapped = !!((r.ta_plane_id && r.ta_club_plane_id) || r.ta_user_id);
                r._isMappedToUser = !!(r.ta_user_id && !r.ta_plane_id);
            }
        }

        // Stamp _isMapped flags directly on each user object
        function _stampUserFlags() {
            for (var i = 0; i < vm.users.length; i++) {
                vm.users[i]._isMapped = !!vm.users[i].ta_user_id;
            }
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
                _stampResourceFlags();
            }, function() {
                vm.loading.resources = false;
            });

            // Also load club planes for the dropdown
            if (vm.clubPlanes.length === 0) {
                PlaneService.GetAllByClub(vm.club_id).then(function(data) {
                    vm.clubPlanes = data || [];
                    _rebuildResourceMapOptions();
                });
            }

            // Also load club members/instructors for the dropdown (shared with users tab)
            _ensureMembersLoaded();
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
            var selectedValue = res._selected_resource;
            if (!selectedValue) {
                ToastService.warning('Select Match', 'Please select an aircraft or user to map this resource to.');
                return;
            }

            // Values prefixed with 'plane_' or 'user_' to distinguish the two types
            var parts = selectedValue.split('_');
            var mapType = parts[0];     // 'plane' or 'user'
            var mapId   = parts.slice(1).join('_'); // the id (rejoin in case id contains underscores)

            res._saving = true;

            if (mapType === 'plane') {
                var plane = vm.clubPlanes.find(function(p) { return String(p.id) === String(mapId); });
                if (!plane) { res._saving = false; return; }

                BsSyncService.SaveResourceMap(vm.club_id, res.bs_resource_id, {
                    ta_plane_id: plane.plane_id || plane.id,
                    ta_club_plane_id: plane.cp_id || plane.id,
                    ta_user_id: null
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

            } else if (mapType === 'user') {
                var member = vm.clubMembersForResources.find(function(m) { return String(m.user_id || m.id) === String(mapId); });
                if (!member) { res._saving = false; return; }

                BsSyncService.SaveResourceMap(vm.club_id, res.bs_resource_id, {
                    ta_plane_id: null,
                    ta_club_plane_id: null,
                    ta_user_id: member.user_id || member.id
                }).then(function(data) {
                    res._saving = false;
                    if (data.success !== false) {
                        ToastService.success('Mapped', res.bs_resource_name + ' → ' + (member.first_name + ' ' + member.last_name));
                        vm.loadResources();
                    } else {
                        ToastService.error('Error', data.message || 'Failed to save mapping.');
                    }
                }, function() {
                    res._saving = false;
                    ToastService.error('Error', 'Could not connect to the server.');
                });
            }
        };

        vm.resourceMapped = function(res) {
            return res._isMapped;
        };

        vm.resourceMappedToUser = function(res) {
            return res._isMappedToUser;
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
                _stampUserFlags();
                vm.usersPage = 1;
                _recomputeFilteredUsers();
            }, function() {
                vm.loading.users = false;
            });

            // Load club members for mapping dropdown (shared with resources tab)
            _ensureMembersLoaded();
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

        // Recompute cached filtered/paged users — called by $watch, NOT from template
        function _recomputeFilteredUsers() {
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
            vm._filteredUsers = list;
            vm._totalPages = Math.ceil(list.length / vm.usersPerPage) || 1;
            if (vm.usersPage > vm._totalPages) vm.usersPage = 1;
            var start = (vm.usersPage - 1) * vm.usersPerPage;
            vm._pagedUsers = list.slice(start, start + vm.usersPerPage);
        }

        // Watch the inputs that affect filtering — debounced search, instant filter/page
        $scope.$watchGroup([
            function() { return vm.usersFilter; },
            function() { return vm.usersPage; }
        ], _recomputeFilteredUsers);

        // Debounced watch for search text (300ms)
        var _usersSearchDebounce = null;
        $scope.$watch(function() { return vm.usersSearch; }, function() {
            if (_usersSearchDebounce) $timeout.cancel(_usersSearchDebounce);
            _usersSearchDebounce = $timeout(function() {
                vm.usersPage = 1;
                _recomputeFilteredUsers();
            }, 300);
        });

        vm.usersSetPage = function(p) {
            if (p >= 1 && p <= vm._totalPages) vm.usersPage = p;
        };

        vm.userMapped = function(u) {
            return u._isMapped;
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
            var toConvert = vm._filteredImported.filter(function(u) { return !u._converted; });
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

        // Recompute filtered imported users — called by $watch
        function _recomputeFilteredImported() {
            if (!vm.importedSearch) {
                vm._filteredImported = vm.importedUsers;
            } else {
                var q = vm.importedSearch.toLowerCase();
                vm._filteredImported = vm.importedUsers.filter(function(u) {
                    return ((u.bs_first_name || '') + ' ' + (u.bs_last_name || '') + ' ' + (u.bs_email || '') + ' ' + (u.ta_email || '')).toLowerCase().indexOf(q) !== -1;
                });
            }
        }

        $scope.$watch(function() { return vm.importedUsers; }, _recomputeFilteredImported);

        // Debounced search for imported users
        var _importedSearchDebounce = null;
        $scope.$watch(function() { return vm.importedSearch; }, function() {
            if (_importedSearchDebounce) $timeout.cancel(_importedSearchDebounce);
            _importedSearchDebounce = $timeout(_recomputeFilteredImported, 300);
        });


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
