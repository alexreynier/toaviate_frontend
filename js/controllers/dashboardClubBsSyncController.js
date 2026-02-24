// ─────────────────────────────────────────────────────
// DashboardClubBsSyncController
// BookedScheduler Sync management page
// ─────────────────────────────────────────────────────
app.controller('DashboardClubBsSyncController', DashboardClubBsSyncController);

    DashboardClubBsSyncController.$inject = ['BsSyncService', 'PlaneService', 'MemberService', 'ToastService', '$rootScope', '$scope', '$state', '$timeout', '$filter'];
    function DashboardClubBsSyncController(BsSyncService, PlaneService, MemberService, ToastService, $rootScope, $scope, $state, $timeout, $filter) {
        var vm = this;

        vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;

        // ── Tab state ──
        vm.activeTab = 'status';
        vm.setTab = function(t) { vm.activeTab = t; };

        // ── Loading flags ──
        vm.loading = { status: false, resources: false, users: false, sync: false, logs: false, imported: false, config: false };
        vm.discovering = { resources: false, users: false };

        // ── Status ──
        vm.status = null;
        vm.config = null;
        vm.configEditing = false;
        vm.configForm = {};

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
        vm.syncForm = { sync_type: 'incremental', start_date: '', end_date: '' };
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
                } else if (data && data.error) {
                    // No config found — show setup prompt
                    vm.status = null;
                    vm.config = null;
                }
            }, function() {
                vm.loading.status = false;
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
                sync_start_date: vm.configForm.sync_start_date,
                sync_end_date: vm.configForm.sync_end_date
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

        vm.saveResourceMap = function(res) {
            if (!res._selected_plane) {
                ToastService.warning('Select Aircraft', 'Please select a TA aircraft to map this resource to.');
                return;
            }
            var plane = vm.clubPlanes.find(function(p) { return p.id == res._selected_plane; });
            if (!plane) return;

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
            if (vm.syncForm.start_date) payload.start_date = vm.syncForm.start_date;
            if (vm.syncForm.end_date) payload.end_date = vm.syncForm.end_date;

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
            }
        });

        // ── Init ──
        vm.init();
    }
