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
            auth_method: 'api_key',
            api_username: '',
            api_password: '',
            api_id: '',
            api_key: '',
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
            _membersLoadedPromise = _loadAllMembers();
            return _membersLoadedPromise;
        }

        // Fetch ALL club members across all pages so the dropdowns include everyone
        function _loadAllMembers() {
            var allMembers = [];
            function loadPage(page) {
                return MemberService.GetAllByClubPaginated(vm.club_id, page, 200).then(function(data) {
                    if (data && data.members) {
                        // Paginated response — accumulate and check for more pages
                        allMembers = allMembers.concat(data.members);
                        if (data.pagination && data.pagination.has_more) {
                            return loadPage(page + 1);
                        }
                    } else if (angular.isArray(data)) {
                        // Legacy flat-array response — use as-is
                        allMembers = data;
                    }
                    // Stamp _isImported flag on BS-imported placeholder accounts
                    for (var i = 0; i < allMembers.length; i++) {
                        var email = allMembers[i].email || '';
                        allMembers[i]._isImported = /^bs\d+@toaviate\.com$/i.test(email);
                    }
                    vm.clubMembers = allMembers;
                    vm.clubMembersForResources = allMembers;
                    _rebuildUserMapOptions();
                    _rebuildResourceMapOptions();
                    return allMembers;
                });
            }
            return loadPage(1);
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
        // BACKGROUND SYNC POLLING
        // The sync endpoint now runs detached on the server and returns immediately
        // (async). We poll GetStatus until last_sync flips to completed/failed (or a
        // newer log row appears) and then report the outcome — instead of reading
        // stats off the trigger response (which no longer carries any).
        // ════════════════════════════════════════════
        var POLL_INTERVAL_MS = 4000;   // how often to check status
        var POLL_MAX_ATTEMPTS = 150;   // safety cap (~10 min) so we never poll forever
        var _pollPromise = null;

        // Live progress shown in the UI while a background sync is running.
        // Populated from the in-progress bs_sync_log row on each status poll.
        vm.syncProgress = null;

        // Cancel any in-flight polling (e.g. when leaving the page or re-triggering).
        function _stopPolling() {
            if (_pollPromise) { $timeout.cancel(_pollPromise); _pollPromise = null; }
        }
        $scope.$on('$destroy', _stopPolling);

        // Update vm.syncProgress from a (possibly in-progress) bs_sync_log row.
        function _updateProgress(ls) {
            if (!vm.syncProgress) return;
            vm.syncProgress.status   = (ls && ls.status) || vm.syncProgress.status || 'started';
            vm.syncProgress.fetched  = (ls && ls.reservations_fetched) || 0;
            vm.syncProgress.created  = (ls && ls.bookings_created) || 0;
            vm.syncProgress.updated  = (ls && ls.bookings_updated) || 0;
            vm.syncProgress.skipped  = (ls && ls.bookings_skipped) || 0;
            vm.syncProgress.errors   = (ls && ls.errors) || 0;
            vm.syncProgress.elapsed  = Math.max(0, Math.round((new Date().getTime() - vm.syncProgress.startedAt) / 1000));
        }

        // Was this sync log already finished when we started? Used as a baseline so
        // we don't mistake the PREVIOUS run's completed/failed row for this run.
        function _syncFingerprint() {
            var ls = vm.status && vm.status.last_sync;
            if (!ls) return null;
            return (ls.id || '') + '|' + (ls.started_at || '') + '|' + (ls.status || '');
        }

        // Begin polling after an async sync was started.
        //   onDone(lastSync)  — called once when the run reaches completed/failed
        //   baseline          — fingerprint captured BEFORE the run started
        function _pollSync(baseline, onDone) {
            var attempts = 0;
            _stopPolling();

            function tick() {
                attempts++;
                BsSyncService.GetStatus(vm.club_id).then(function(data) {
                    if (data && data.config) {
                        vm.status = data;
                        vm.config = data.config;
                    }
                    var ls = data && data.last_sync;
                    var finished = ls && (ls.status === 'completed' || ls.status === 'failed');
                    var isNewRun = _syncFingerprint() !== baseline;   // a fresh log row/started_at

                    // Reflect live counters in the UI once this run's row appears.
                    if (isNewRun) { _updateProgress(ls); }

                    if (finished && isNewRun) {
                        _pollPromise = null;
                        onDone(ls);
                        return;
                    }
                    if (attempts >= POLL_MAX_ATTEMPTS) {
                        // Give up watching — the sync may still finish server-side.
                        _pollPromise = null;
                        vm.syncRunning = false;
                        vm.syncProgress = null;
                        ToastService.warning('Still Running', 'Sync is taking a while. Check the logs tab for the result.');
                        vm.loadLogs();
                        return;
                    }
                    _pollPromise = $timeout(tick, POLL_INTERVAL_MS);
                }, function() {
                    // Transient status error — keep trying until the cap.
                    if (attempts >= POLL_MAX_ATTEMPTS) {
                        _pollPromise = null;
                        vm.syncRunning = false;
                        vm.syncProgress = null;
                        ToastService.warning('Status Unavailable', 'Could not confirm sync completion. Check the logs tab.');
                        return;
                    }
                    _pollPromise = $timeout(tick, POLL_INTERVAL_MS);
                });
            }

            _pollPromise = $timeout(tick, POLL_INTERVAL_MS);
        }

        // Shared handler for a RunSync response. Returns true if it kicked off async
        // polling (so callers shouldn't also treat the response as a final result).
        //   data      — the RunSync response
        //   onComplete(lastSync) — called when the background run finishes
        //   onError(message)     — called if the trigger itself failed
        function _handleSyncTrigger(data, onComplete, onError) {
            if (data && data.async) {
                // Background run started — poll for completion and show live progress.
                var baseline = _syncFingerprint();
                vm.syncProgress = {
                    startedAt: new Date().getTime(),
                    status: 'started',
                    fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0,
                    elapsed: 0,
                    sync_type: (data.sync_type || (data && data.sync_type)) || null
                };
                ToastService.success('Sync Started', 'Running in the background — this may take a few minutes.');
                _pollSync(baseline, function(ls) {
                    vm.syncRunning = false;
                    _updateProgress(ls);                 // final tally
                    vm.syncProgress = null;              // hide the live panel; result panel takes over
                    onComplete(ls);
                });
                return true;
            }
            // Synchronous / legacy response (e.g. ?wait=1, or exec() unavailable).
            vm.syncRunning = false;
            vm.syncProgress = null;
            if (data && data.success) {
                onComplete(data.last_sync || data.stats || data);
            } else {
                onError(data && data.message);
            }
            return false;
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

        // "1m 23s" / "12s" — used by the live sync-progress panel.
        vm.formatElapsed = function(secs) {
            secs = secs || 0;
            if (secs < 60) return secs + 's';
            return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
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
                if (data && data.success) {
                    _handleSyncTrigger(data, function(ls) {
                        if (ls && ls.status === 'failed') {
                            ToastService.error('Sync Failed', 'The background sync reported errors. Check the logs.');
                        } else {
                            ToastService.success('Sync Complete',
                                'Created: ' + ((ls && ls.bookings_created) || 0) + ', Updated: ' + ((ls && ls.bookings_updated) || 0));
                        }
                        vm.loadStatus();
                    }, function(msg) {
                        ToastService.error('Sync Failed', msg || 'The sync encountered an error.');
                    });
                } else {
                    vm.syncRunning = false;
                    ToastService.error('Sync Failed', (data && data.message) || 'The sync encountered an error.');
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
            vm.configForm.auth_method = vm.configForm.auth_method || 'session';
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
                sync_end_date: formatDate(vm.configForm.sync_end_date),
                auth_method: vm.configForm.auth_method || 'session'
            };
            if (payload.auth_method === 'api_key') {
                payload.api_id = vm.configForm.api_id;
                payload.api_key = vm.configForm.api_key;
            } else {
                if (vm.configForm.api_username) payload.api_username = vm.configForm.api_username;
                if (vm.configForm.api_password) payload.api_password = vm.configForm.api_password;
            }
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
            if (!vm.setupConfigForm.api_url) {
                ToastService.warning('Missing Fields', 'Please fill in the API URL.');
                return;
            }
            if (vm.setupConfigForm.auth_method === 'api_key') {
                if (!vm.setupConfigForm.api_id || !vm.setupConfigForm.api_key) {
                    ToastService.warning('Missing Fields', 'Please fill in the API ID and API Key.');
                    return;
                }
            } else {
                if (!vm.setupConfigForm.api_username || !vm.setupConfigForm.api_password) {
                    ToastService.warning('Missing Fields', 'Please fill in the username and password.');
                    return;
                }
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
                var list = angular.isArray(data) ? data : (data.memberships || []);
                // Normalise so the convert dropdown + expiry calc work whether the
                // list comes from here (name/payment_term) or from a
                // MEMBERSHIP_REQUIRED response (membership_name).
                vm.memberships = normaliseMemberships(list);
            });
        };

        // Build a clean tier list for the convert dropdown. The dropdown uses
        // ng-options="m.id as m.name", so whatever we put on `id` is the value SENT
        // to the convert endpoint as membership_id.
        //
        // CRITICAL: GetAllByClub returns TWO distinct ids per tier — a row `id`
        // (membership_versions row) and the real `membership_id` — and they DON'T
        // match. The backend's convert endpoint keys on membership_id. Example from
        // club 3:  Annual = { id:9, membership_id:8 },  Instructor = { id:10,
        // membership_id:9 }. Binding the row `id` meant picking "Annual" (id 9) sent
        // 9, which the backend read as membership_id 9 = "Instructor" — exactly the
        // mis-assignment reported. So we bind `membership_id` (falling back to `id`
        // only if a response shape lacks it). Blank/duplicate ids are dropped.
        function normaliseMemberships(list) {
            var seen = {};
            var out = [];
            (list || []).forEach(function(m) {
                // Prefer the real membership_id; fall back to id for shapes that
                // only carry one (e.g. a MEMBERSHIP_REQUIRED club_memberships list).
                var rawId = (m.membership_id != null) ? m.membership_id : m.id;
                if (rawId == null || rawId === '') {
                    console.warn('BS convert: dropping membership tier with no membership_id', m);
                    return;
                }
                var id = String(rawId);
                if (seen[id]) {
                    console.warn('BS convert: duplicate membership_id ' + id + ' — keeping first, dropping', m);
                    return;
                }
                seen[id] = true;
                out.push({
                    id: rawId,                                  // bound + sent as membership_id
                    name: m.membership_name || m.name,
                    payment_term: m.payment_term
                });
            });
            return out;
        }

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
                if (data && data.success) {
                    _handleSyncTrigger(data, function(ls) {
                        vm.stepByStep.sync = ls || {};
                        if (ls && ls.status === 'failed') {
                            ToastService.error('Sync Issue', 'Sync completed with issues. Check the logs.');
                        } else {
                            ToastService.success('Sync Complete', 'Bookings synced successfully.');
                        }
                    }, function(msg) {
                        ToastService.error('Sync Issue', msg || 'Sync completed with issues.');
                    });
                } else {
                    vm.syncRunning = false;
                    vm.stepByStep.sync = data || {};
                    ToastService.error('Sync Issue', (data && data.message) || 'Sync completed with issues.');
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

        vm.startRemapResource = function(res) {
            res._remapping = true;
            res._selected_resource = null;
        };

        vm.cancelRemapResource = function(res) {
            res._remapping = false;
            res._selected_resource = null;
        };

        vm.unmapResource = function(res) {
            if (!confirm('Remove the mapping for ' + res.bs_resource_name + '?')) return;
            res._saving = true;
            BsSyncService.SaveResourceMap(vm.club_id, res.bs_resource_id, {
                ta_plane_id: null,
                ta_club_plane_id: null,
                ta_user_id: null
            }).then(function(data) {
                res._saving = false;
                if (data.success !== false) {
                    ToastService.success('Unmapped', res.bs_resource_name + ' has been unmapped.');
                    vm.loadResources();
                } else {
                    ToastService.error('Error', data.message || 'Failed to unmap resource.');
                }
            }, function() {
                res._saving = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
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
            var memberObj = u._selected_member_obj;
            if (!memberObj) {
                ToastService.warning('Select Member', 'Please select a TA member to map this user to.');
                return;
            }
            u._saving = true;
            BsSyncService.SaveUserMap(vm.club_id, u.bs_user_id, {
                ta_user_id: memberObj.user_id || memberObj.id
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

        vm.startRemapUser = function(u) {
            u._remapping = true;
            // Pre-select the currently mapped member object
            u._selected_member_obj = null;
            var taId = String(u.ta_user_id || '');
            for (var i = 0; i < vm.clubMembers.length; i++) {
                var m = vm.clubMembers[i];
                if (String(m.user_id || m.id) === taId) {
                    u._selected_member_obj = m;
                    break;
                }
            }
        };

        vm.cancelRemapUser = function(u) {
            u._remapping = false;
            u._selected_member_obj = null;
        };

        vm.unmapUser = function(u) {
            if (!confirm('Remove the mapping for ' + u.bs_first_name + ' ' + u.bs_last_name + '?')) return;
            u._saving = true;
            BsSyncService.SaveUserMap(vm.club_id, u.bs_user_id, {
                ta_user_id: null
            }).then(function(data) {
                u._saving = false;
                if (data.success !== false) {
                    ToastService.success('Unmapped', u.bs_first_name + ' ' + u.bs_last_name + ' has been unmapped.');
                    vm.loadUsers();
                } else {
                    ToastService.error('Error', data.message || 'Failed to unmap user.');
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
                if (data && data.success) {
                    _handleSyncTrigger(data, function(ls) {
                        vm.syncResult = ls || {};
                        if (ls && ls.status === 'failed') {
                            ToastService.error('Sync Failed', 'The background sync reported errors. Check the logs.');
                        } else {
                            ToastService.success('Sync Complete', 'Reservations synced successfully.');
                        }
                        vm.loadLogs();
                        vm.loadStatus();
                    }, function(msg) {
                        ToastService.error('Sync Failed', msg || 'An error occurred during sync.');
                    });
                } else {
                    vm.syncRunning = false;
                    ToastService.error('Sync Failed', (data && data.message) || 'An error occurred during sync.');
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
            // Use the dedicated endpoint that returns users.imported_user = 1
            // (authoritative). The previous approach re-filtered the mappings list
            // by a 'bs0' login-email prefix, which silently excluded every
            // imported user numbered >= 1000 (e.g. bs1796@) — so most of the
            // roster never appeared and couldn't be converted.
            BsSyncService.GetImported(vm.club_id).then(function(data) {
                vm.loading.imported = false;
                var all = angular.isArray(data) ? data : (data.users || []);
                // Normalise to the field names the template + convertUser expect.
                vm.importedUsers = all.map(function(u) {
                    return {
                        ta_user_id:    u.user_id,
                        bs_user_id:    u.bs_user_id,
                        bs_first_name: u.first_name,
                        bs_last_name:  u.last_name,
                        ta_email:      u.login_email,     // fake bsNNNN@ login (temp)
                        bs_email:      u.original_email,  // real email to invite
                        booking_count: u.booking_count
                    };
                });
            }, function() {
                vm.loading.imported = false;
            });
        };

        // ── Convert: membership tier + term dates ──────────────────────────
        // Each imported user carries (set lazily in _ensureConvertDefaults):
        //   u._membershipId   — required tier id (must be picked before convert)
        //   u._termStart      — Date: current billing term start, default today
        //   u._membershipEnds — Date: computed expiry, editable
        //   u._endsOverridden — admin manually changed the expiry, so stop auto-computing
        //   u._membership     — backend `membership` block after a successful convert
        // NB: dates are Date OBJECTS in the model because <input type="date">
        // produces a Date; they're formatted to "YYYY-MM-DD" only at send time in
        // _convertPayload (same pattern as the CRS form). "Convert All" uses each
        // row's own dates (term start defaults to today).

        // Format a Date (or null) to "YYYY-MM-DD" for the API; null/invalid → null.
        function toYmd(d) {
            if (!d) return null;
            var m = moment(d);
            return m.isValid() ? m.format('YYYY-MM-DD') : null;
        }

        // term_start Date + a tier's payment_term → expiry Date (null if no expiry).
        function computeExpiry(termStart, paymentTerm) {
            if (!termStart) return null;
            var m = moment(termStart);
            if (!m.isValid()) return null;
            switch (paymentTerm) {
                case 'daily':    return m.add(1, 'day').toDate();
                case 'monthly':  return m.add(1, 'month').toDate();
                case 'annually': return m.add(1, 'year').toDate();
                // 'free' / 'once' (lifetime) → no expiry; let the backend decide.
                default: return null;
            }
        }

        function findMembership(id) {
            if (!id) return null;
            for (var i = 0; i < vm.memberships.length; i++) {
                if (String(vm.memberships[i].id) === String(id)) return vm.memberships[i];
            }
            return null;
        }

        // ── Payment-at-signup (require_payment) ──
        // The backend derives it from the expiry: future end date = paid up,
        // no payment requested; end date today/past (or none) = payment
        // requested at signup. The checkbox mirrors that derivation live as
        // the admin edits the dates, until they toggle it themselves.

        // Is this row's membership expiry today or in the past (or missing)?
        function isExpired(u) {
            if (!u._membershipEnds) return true;
            var m = moment(u._membershipEnds);
            if (!m.isValid()) return true;
            return !m.isAfter(moment(), 'day');
        }
        vm.isExpired = isExpired;

        // Re-derive the checkbox default unless the admin has toggled it.
        function recomputePayment(u) {
            if (u._payOverridden) return;
            u._requirePayment = isExpired(u);
        }

        // Marks the checkbox as admin-set so date edits stop moving it.
        vm.onPaymentToggled = function(u) { u._payOverridden = true; };

        // Live helper text under the checkbox, reflecting dates + choice.
        vm.paymentHint = function(u) {
            var endTxt = u._membershipEnds ? moment(u._membershipEnds).format('D MMM YYYY') : null;
            if (isExpired(u)) {
                return u._requirePayment
                    ? 'This membership has expired — payment for the new term will be requested at signup.'
                    : 'Expired, but payment will NOT be requested (admin override).';
            }
            return u._requirePayment
                ? 'Payment will be requested at signup even though the membership is paid up until ' + endTxt + '.'
                : 'Paid up until ' + endTxt + ' — no payment will be requested. They can skip adding a payment method (we\'ll encourage one for renewals).';
        };

        // Ensure a row has its date + payment defaults before the boxes render.
        function _ensureConvertDefaults(u) {
            if (!u._termStart) u._termStart = new Date();
            if (u._requirePayment === undefined) recomputePayment(u);
        }
        vm.ensureConvertDefaults = _ensureConvertDefaults;

        // Re-derive the expiry from the chosen tier + term start, unless the admin
        // has manually overridden it. Called on tier or term-start change.
        vm.recomputeExpiry = function(u) {
            if (!u._endsOverridden) {
                var m = findMembership(u._membershipId);
                u._membershipEnds = m ? computeExpiry(u._termStart, m.payment_term) : null;
            }
            recomputePayment(u);
        };

        // Marks the expiry as admin-edited so auto-compute stops fighting them.
        vm.onExpiryEdited = function(u) {
            u._endsOverridden = true;
            recomputePayment(u);
        };

        // Show the right confirmation toast for the backend's `mode`:
        //   signup          → brand-new person, complete-signup invite emailed
        //   invite_existing → already has a ToAviate account, join invite emailed
        //   merged          → already a member here, data merged immediately
        function showConvertResult(u, data) {
            var name = ((u.bs_first_name || '') + ' ' + (u.bs_last_name || '')).trim() || u.bs_email;
            switch (data.mode) {
                case 'invite_existing':
                    ToastService.success('Invitation Sent', name + ' already has an account — invitation to join sent; their data will merge on accept.');
                    break;
                case 'merged':
                    ToastService.success('Data Merged', 'Imported data merged into their existing account.');
                    break;
                case 'signup':
                default:
                    ToastService.success('Signup Invitation Sent', 'Signup invitation sent to ' + u.bs_email);
                    break;
            }
            if (data.membership && data.membership.already_expired) {
                ToastService.warning('Membership Expired', name + "'s membership term has already ended — it is due for renewal.");
            }
        }

        // MEMBERSHIP_REQUIRED → repopulate the tier dropdown from the response list.
        function handleMembershipRequired(u, data) {
            if (data.club_memberships && data.club_memberships.length) {
                vm.memberships = normaliseMemberships(data.club_memberships);
            }
            ToastService.warning('Membership Required', 'Please choose a membership tier for this user, then convert again.');
        }

        // Build the convert payload from a row's chosen tier + dates. Dates are
        // formatted to "YYYY-MM-DD" here (the model holds Date objects). The backend
        // uses exactly the membership_id it receives — so this must be the admin's
        // selected tier (the dropdown uses ng-options to keep that mapping correct).
        function _convertPayload(u) {
            return {
                membership_id: u._membershipId,
                term_start: toYmd(u._termStart) || toYmd(new Date()),
                membership_ends: toYmd(u._membershipEnds),
                // Always sent explicitly — an untouched checkbox equals the
                // backend-derived default, so the two never disagree.
                require_payment: u._requirePayment ? 1 : 0
            };
        }

        vm.convertUser = function(u) {
            _ensureConvertDefaults(u);
            if (!u._membershipId) {
                ToastService.warning('Membership Required', 'Please choose a membership tier before converting.');
                return;
            }
            u._converting = true;
            var payload = _convertPayload(u);
            // Trace what's actually sent (stripped in prod) so a "picked X, got Y"
            // membership mismatch can be diagnosed against the selected tier.
            console.log('BS convert payload', { ta_user_id: u.ta_user_id, selected: payload.membership_id, tier: findMembership(u._membershipId) });
            BsSyncService.ConvertUser(vm.club_id, u.ta_user_id, payload).then(function(data) {
                u._converting = false;
                if (data.success) {
                    u._converted = true;
                    u._membership = data.membership || null;
                    showConvertResult(u, data);
                } else if (data.error === 'MEMBERSHIP_REQUIRED') {
                    handleMembershipRequired(u, data);
                } else {
                    ToastService.error('Error', data.message || 'Failed to convert user.');
                }
            }, function() {
                u._converting = false;
                ToastService.error('Error', 'Could not connect to the server.');
            });
        };

        vm.convertAll = function() {
            // Every row needs a tier — block (and surface) if any are missing.
            var pending = vm._filteredImported.filter(function(u) { return !u._converted; });
            var missing = pending.filter(function(u) { return !u._membershipId; });
            if (missing.length) {
                ToastService.warning('Membership Required', missing.length + ' user(s) have no membership tier selected. Pick a tier for each before converting all.');
                return;
            }
            if (!confirm('This will send invitations to ALL imported users. Continue?')) return;
            vm.convertingAll = true;
            var idx = 0;

            function next() {
                if (idx >= pending.length) {
                    vm.convertingAll = false;
                    ToastService.success('Done', 'All imported users have been sent invitations.');
                    $scope.$apply();
                    return;
                }
                var u = pending[idx];
                _ensureConvertDefaults(u);
                u._converting = true;
                BsSyncService.ConvertUser(vm.club_id, u.ta_user_id, _convertPayload(u)).then(function(data) {
                    u._converting = false;
                    if (data.success) {
                        u._converted = true;
                        u._membership = data.membership || null;
                        if (data.membership && data.membership.already_expired) {
                            var name = ((u.bs_first_name || '') + ' ' + (u.bs_last_name || '')).trim() || u.bs_email;
                            ToastService.warning('Membership Expired', name + "'s membership is due for renewal.");
                        }
                    } else if (data.error === 'MEMBERSHIP_REQUIRED') {
                        handleMembershipRequired(u, data);
                    }
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
                case 'imported':  if (vm.importedUsers.length === 0) vm.loadImportedUsers(); vm.loadMemberships(); break;
                case 'setup':     vm.loadMemberships(); break;
            }
        });

        // ── Init ──
        vm.init();
    }
