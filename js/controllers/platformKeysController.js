// ═══════════════════════════════════════════════════════════════════
//  PlatformKeysController
//  ToAviate super-admin — API keys for external platforms calling
//  ToAviate server-to-server (airshows.toaviate, future partners).
//  One controller for both screens, dispatched on
//  $state.current.data.screen:
//     'list'    → landing table (status, scopes, usage, quick actions)
//     'detail'  → one key: audit block, edit, rotate, revoke, delete
//  Create/edit happen in PlatformKeyFormModalCtrl; the full secret is
//  shown exactly once (create + rotate) by PlatformKeySecretModalCtrl.
//  Backend contract: FRONTEND_PLATFORM_KEYS_ADMIN_GUIDE.md
// ═══════════════════════════════════════════════════════════════════

app.controller('PlatformKeysController', PlatformKeysController);

PlatformKeysController.$inject = ['PlatformKeyService', 'ToastService', 'EnvConfig',
                                  '$rootScope', '$state', '$stateParams', '$uibModal', '$timeout'];
function PlatformKeysController(PlatformKeyService, ToastService, EnvConfig,
                                $rootScope, $state, $stateParams, $uibModal, $timeout) {
    var vm = this;

    // ── Access gate — ToAviate platform staff only (backend is authoritative) ──
    vm.user     = $rootScope.globals.currentUser;
    vm.is_staff = $rootScope.isToAviateStaff();

    vm.screen   = ($state.current.data && $state.current.data.screen) || 'list';

    vm.loading  = true;
    vm.busy     = false;      // an action (rotate/revoke/…) is in flight
    vm.confirm  = null;       // pending confirmation { action, key, title, message, label, danger }

    // ── Exposed API ──
    vm.statusOf     = PlatformKeyService.statusOf;
    vm.statusLabel  = statusLabel;
    vm.scopeParts   = PlatformKeyService.parseScope;
    vm.num          = num;                 // MySQL returns numerics as strings
    vm.ago          = ago;
    vm.askRotate     = askRotate;
    vm.askRevoke     = askRevoke;
    vm.askReactivate = askReactivate;
    vm.cancelConfirm = function () { vm.confirm = null; };
    vm.runConfirm    = runConfirm;
    vm.openCreate    = openCreate;
    vm.copyText      = copyText;

    if (!vm.is_staff) {
        vm.loading = false;
        return;
    }

    if (vm.screen === 'detail') { initDetail(); }
    else                        { initList(); }


    // ═══════════════════════════════════════════════════════════════
    //  SCREEN 1 — LIST
    // ═══════════════════════════════════════════════════════════════

    function initList() {
        vm.keys          = [];
        vm.search        = '';
        vm.status_filter = 'all';        // all | active | revoked | disabled
        vm.stats         = { total: 0, active: 0, calls: 0, last_used: null };

        vm.loadKeys        = loadKeys;
        vm.setStatusFilter = function (f) { vm.status_filter = f; };
        vm.rowVisible      = rowVisible;
        vm.visibleCount    = visibleCount;

        loadKeys();
    }

    function loadKeys() {
        vm.loading = true;
        PlatformKeyService.GetAll().then(function (data) {
            vm.loading = false;

            if (!data || data.success === false || !data.keys) {
                ToastService.error('Could not load platform keys',
                    messageOf(data, 'The key list did not load. Try again.'));
                return;
            }

            vm.keys = data.keys;

            var stats = { total: data.keys.length, active: 0, calls: 0, last_used: null };
            angular.forEach(data.keys, function (k) {
                if (vm.statusOf(k) === 'active') { stats.active++; }
                stats.calls += num(k.use_count);
                if (k.last_used_at && (!stats.last_used || k.last_used_at > stats.last_used)) {
                    stats.last_used = k.last_used_at;
                }
            });
            vm.stats = stats;
        });
    }

    function rowVisible(key) {
        if (vm.status_filter !== 'all' && vm.statusOf(key) !== vm.status_filter) {
            return false;
        }
        if (!vm.search) { return true; }
        var q = vm.search.toLowerCase();
        var haystack = [key.platform_name, key.description, key.key_prefix]
            .concat(key.allowed_endpoints || []).join(' ').toLowerCase();
        return haystack.indexOf(q) > -1;
    }

    function visibleCount() {
        var n = 0;
        angular.forEach(vm.keys, function (k) { if (rowVisible(k)) { n++; } });
        return n;
    }


    // ═══════════════════════════════════════════════════════════════
    //  SCREEN 2 — DETAIL
    // ═══════════════════════════════════════════════════════════════

    function initDetail() {
        vm.key       = null;
        vm.not_found = false;

        vm.openEdit   = openEdit;
        vm.askDelete  = askDelete;
        vm.curlSnippet = curlSnippet;

        loadKey();
    }

    function loadKey() {
        vm.loading = true;
        PlatformKeyService.GetOne($stateParams.id).then(function (data) {
            vm.loading = false;

            if (!data || data.success === false || !data.key) {
                if (data && data.error === 'NOT_FOUND') {
                    vm.not_found = true;
                    return;
                }
                ToastService.error('Could not load platform key',
                    messageOf(data, 'The key did not load. Try again.'));
                vm.not_found = true;
                return;
            }

            vm.key = data.key;
        });
    }

    function openEdit() {
        openFormModal(vm.key).result.then(function (outcome) {
            if (outcome && outcome.updated) {
                vm.key = outcome.updated;
                ToastService.success('Platform key updated',
                    vm.key.platform_name + ' has been saved.');
            }
        }, function () {});
    }

    // Server-to-server integration snippet to hand to the partner.
    function curlSnippet(key) {
        return "curl 'https://v1.toaviate.com/api/v1/airshows/aircraft/g-as' \\\n" +
               "  -H 'Api-Key: " + EnvConfig.getApiKey() + "' \\\n" +
               "  -H 'Platform-Key: " + (key ? key.key_prefix : 'tak_') + "…' \\\n" +
               "  -H 'Accept: application/json'";
    }


    // ═══════════════════════════════════════════════════════════════
    //  ACTIONS (shared) — every destructive action confirms first
    // ═══════════════════════════════════════════════════════════════

    function askRotate(key) {
        vm.confirm = {
            action: 'rotate', key: key, danger: true,
            title: 'Rotate this key?',
            message: 'Rotating issues a new key and instantly breaks the ' +
                     'platform’s current one. ' + key.platform_name +
                     ' will lose access until it installs the new key.',
            label: 'Rotate key'
        };
    }

    function askRevoke(key) {
        vm.confirm = {
            action: 'revoke', key: key, danger: true,
            title: 'Revoke this key?',
            message: key.platform_name + ' will be blocked immediately. The key ' +
                     'and its usage history are kept, and it can be re-activated later.',
            label: 'Revoke now'
        };
    }

    function askReactivate(key) {
        vm.confirm = {
            action: 'reactivate', key: key, danger: false,
            title: 'Re-activate this key?',
            message: key.platform_name + '’s existing secret will start ' +
                     'working again immediately.',
            label: 'Re-activate'
        };
    }

    function askDelete(key) {
        vm.confirm = {
            action: 'delete', key: key, danger: true,
            title: 'Delete this key permanently?',
            message: 'Revoked keys keep their audit history; deleting is permanent ' +
                     'and removes the usage record for ' + key.platform_name +
                     '. Prefer revoking unless the row was created in error.',
            label: 'Delete permanently'
        };
    }

    function runConfirm() {
        if (!vm.confirm || vm.busy) { return; }
        var action = vm.confirm.action;
        var key    = vm.confirm.key;

        vm.busy = true;

        if (action === 'rotate')          { doRotate(key); }
        else if (action === 'revoke')     { doRevoke(key); }
        else if (action === 'reactivate') { doReactivate(key); }
        else if (action === 'delete')     { doDelete(key); }
    }

    function doRotate(key) {
        PlatformKeyService.Regenerate(key.id).then(function (data) {
            finishAction();

            if (!data || data.success === false || !data.key) {
                ToastService.error('Rotate failed',
                    messageOf(data, 'The key was not rotated. Try again.'));
                return;
            }

            openSecretModal({
                mode: 'rotated',
                platform_name: key.platform_name,
                key: data.key,
                key_prefix: data.key_prefix
            });
            refresh();
        });
    }

    function doRevoke(key) {
        PlatformKeyService.Revoke(key.id).then(function (data) {
            finishAction();

            if (!data || data.success === false) {
                ToastService.error('Revoke failed',
                    messageOf(data, 'The key was not revoked. Try again.'));
                return;
            }

            ToastService.success('Key revoked',
                key.platform_name + ' is blocked with immediate effect.');
            applyUpdated(data.key, key);
        });
    }

    function doReactivate(key) {
        PlatformKeyService.Update(key.id, { active: 1 }).then(function (data) {
            finishAction();

            if (!data || data.success === false) {
                ToastService.error('Re-activate failed',
                    messageOf(data, 'The key was not re-activated. Try again.'));
                return;
            }

            ToastService.success('Key re-activated',
                key.platform_name + '’s key is live again.');
            applyUpdated(data.key, key);
        });
    }

    function doDelete(key) {
        PlatformKeyService.Delete(key.id).then(function (data) {
            finishAction();

            if (!data || data.success === false) {
                ToastService.error('Delete failed',
                    messageOf(data, 'The key was not deleted. Try again.'));
                return;
            }

            ToastService.success('Key deleted',
                key.platform_name + ' has been permanently removed.');

            if (vm.screen === 'detail') {
                $state.go('dashboard.super_admin.platform_keys');
            } else {
                refresh();
            }
        });
    }

    function finishAction() {
        vm.busy    = false;
        vm.confirm = null;
    }

    // After revoke / re-activate the backend returns the updated key —
    // patch it in place so the row/status flips without a full reload.
    function applyUpdated(updatedKey, fallbackKey) {
        if (vm.screen === 'detail') {
            if (updatedKey) { vm.key = updatedKey; }
            else            { loadKey(); }
            return;
        }
        if (updatedKey && vm.keys) {
            for (var i = 0; i < vm.keys.length; i++) {
                if (vm.keys[i].id == updatedKey.id) {
                    vm.keys[i] = updatedKey;
                    break;
                }
            }
            recount();
        } else {
            refresh();
        }
    }

    function recount() {
        var stats = { total: vm.keys.length, active: 0, calls: 0, last_used: null };
        angular.forEach(vm.keys, function (k) {
            if (vm.statusOf(k) === 'active') { stats.active++; }
            stats.calls += num(k.use_count);
            if (k.last_used_at && (!stats.last_used || k.last_used_at > stats.last_used)) {
                stats.last_used = k.last_used_at;
            }
        });
        vm.stats = stats;
    }

    function refresh() {
        if (vm.screen === 'detail') { loadKey(); }
        else                        { vm.loadKeys(); }
    }


    // ═══════════════════════════════════════════════════════════════
    //  MODALS
    // ═══════════════════════════════════════════════════════════════

    function openCreate() {
        openFormModal(null).result.then(function (outcome) {
            if (outcome && outcome.created) {
                openSecretModal({
                    mode: 'created',
                    platform_name: outcome.platform_name,
                    key: outcome.created.key,
                    key_prefix: outcome.created.key_prefix
                });
                refresh();
            }
        }, function () {});
    }

    function openFormModal(existing) {
        return $uibModal.open({
            templateUrl: 'views/modals/platform_key_form.html',
            controller: 'PlatformKeyFormModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static',
            resolve: {
                existing: function () { return existing ? angular.copy(existing) : null; }
            }
        });
    }

    // Show-once secret. backdrop 'static' + no Esc so a stray click can't
    // destroy the only chance to copy the key.
    function openSecretModal(payload) {
        $uibModal.open({
            templateUrl: 'views/modals/platform_key_secret.html',
            controller: 'PlatformKeySecretModalCtrl',
            controllerAs: 'vm',
            backdrop: 'static',
            keyboard: false,
            resolve: {
                payload: function () { return payload; }
            }
        });
    }


    // ═══════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════

    function statusLabel(key) {
        var s = vm.statusOf(key);
        if (s === 'active')  { return 'Active'; }
        if (s === 'revoked') { return 'Revoked'; }
        return 'Disabled';
    }

    function num(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    // "3 minutes ago" — the at-a-glance signal that an integration is alive.
    function ago(ts) {
        if (!ts) { return 'Never'; }
        var m = moment(ts);
        return m.isValid() ? m.fromNow() : ts;
    }

    function copyText(text, what) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        ToastService.success('Copied', (what || 'Text') + ' copied to the clipboard.');
    }

    function messageOf(data, fallback) {
        if (data && typeof data.message === 'string' && data.message) { return data.message; }
        return fallback;
    }
}


// ═══════════════════════════════════════════════════════════════════
//  PlatformKeyFormModalCtrl — create / edit a platform key.
//  Scopes are edited as method-dropdown + path-text rows and serialised
//  to "METHOD path" strings; IPs as removable tags (empty list = any IP).
// ═══════════════════════════════════════════════════════════════════

app.controller('PlatformKeyFormModalCtrl', PlatformKeyFormModalCtrl);

PlatformKeyFormModalCtrl.$inject = ['PlatformKeyService', 'ToastService',
                                    '$uibModalInstance', 'existing'];
function PlatformKeyFormModalCtrl(PlatformKeyService, ToastService,
                                  $uibModalInstance, existing) {
    var vm = this;

    vm.mode    = existing ? 'edit' : 'create';
    vm.methods = PlatformKeyService.scope_methods;
    vm.saving  = false;
    vm.errors  = {};

    vm.form = {
        platform_name: existing ? existing.platform_name : '',
        description:   existing ? (existing.description || '') : '',
        active:        existing ? parseInt(existing.active, 10) === 1 : true
    };

    // Scope rows: [{ method, path }]
    vm.scopes = [];
    if (existing && existing.allowed_endpoints && existing.allowed_endpoints.length) {
        angular.forEach(existing.allowed_endpoints, function (s) {
            vm.scopes.push(PlatformKeyService.parseScope(s));
        });
    } else {
        vm.scopes.push({ method: 'GET', path: '' });
    }

    // IP allow-list tags (empty = any IP)
    vm.ips    = (existing && existing.allowed_ips) ? existing.allowed_ips.slice() : [];
    vm.ip_new = '';

    vm.addScope    = function () { vm.scopes.push({ method: 'GET', path: '' }); };
    vm.removeScope = function (i) { vm.scopes.splice(i, 1); };
    vm.addIp       = addIp;
    vm.removeIp    = function (i) { vm.ips.splice(i, 1); };
    vm.save        = save;
    vm.cancel      = function () { $uibModalInstance.dismiss('cancel'); };

    function addIp() {
        var ip = String(vm.ip_new || '').trim();
        if (!ip) { return; }
        if (vm.ips.indexOf(ip) === -1) { vm.ips.push(ip); }
        vm.ip_new = '';
    }

    function save() {
        if (vm.saving) { return; }

        // Uncommitted text in the IP box counts — nobody presses Add twice.
        addIp();

        vm.errors = {};

        var scopes = [];
        angular.forEach(vm.scopes, function (s) {
            var path = String(s.path || '').trim().toLowerCase();
            if (path) { scopes.push(s.method + ' ' + path); }
        });

        if (!String(vm.form.platform_name || '').trim()) { vm.errors.platform_name = true; }
        if (!scopes.length)                              { vm.errors.scopes = true; }
        if (vm.errors.platform_name || vm.errors.scopes) {
            ToastService.warning('Missing details',
                'A platform name and at least one endpoint scope are required.');
            return;
        }

        var payload = {
            platform_name:     String(vm.form.platform_name).trim(),
            description:       String(vm.form.description || '').trim(),
            allowed_endpoints: scopes,
            allowed_ips:       vm.ips.length ? vm.ips : null
        };

        vm.saving = true;

        if (vm.mode === 'create') {
            PlatformKeyService.Create(payload).then(function (data) {
                vm.saving = false;

                if (!data || data.success === false || !data.key) {
                    ToastService.error('Could not create key',
                        failMessage(data, 'The key was not created. Try again.'));
                    return;
                }

                $uibModalInstance.close({
                    created: data,
                    platform_name: payload.platform_name
                });
            });
        } else {
            payload.active = vm.form.active ? 1 : 0;

            PlatformKeyService.Update(existing.id, payload).then(function (data) {
                vm.saving = false;

                if (!data || data.success === false || !data.key) {
                    ToastService.error('Could not save key',
                        failMessage(data, 'The changes were not saved. Try again.'));
                    return;
                }

                $uibModalInstance.close({ updated: data.key });
            });
        }
    }

    // VALIDATION errors arrive with success:false and a human-readable message.
    function failMessage(data, fallback) {
        if (data && typeof data.message === 'string' && data.message) { return data.message; }
        return fallback;
    }
}


// ═══════════════════════════════════════════════════════════════════
//  PlatformKeySecretModalCtrl — the show-once secret after create or
//  rotate. The key exists only inside this modal; it is never stored.
// ═══════════════════════════════════════════════════════════════════

app.controller('PlatformKeySecretModalCtrl', PlatformKeySecretModalCtrl);

PlatformKeySecretModalCtrl.$inject = ['ToastService', 'EnvConfig', '$uibModalInstance', 'payload'];
function PlatformKeySecretModalCtrl(ToastService, EnvConfig, $uibModalInstance, payload) {
    var vm = this;

    vm.mode          = payload.mode;                 // 'created' | 'rotated'
    vm.platform_name = payload.platform_name;
    vm.key           = payload.key;
    vm.key_prefix    = payload.key_prefix;
    vm.copied        = false;

    vm.snippet = "curl 'https://v1.toaviate.com/api/v1/airshows/aircraft/g-as' \\\n" +
                 "  -H 'Api-Key: " + EnvConfig.getApiKey() + "' \\\n" +
                 "  -H 'Platform-Key: " + payload.key + "' \\\n" +
                 "  -H 'Accept: application/json'";

    vm.copyKey     = function () { copy(vm.key, 'The key'); vm.copied = true; };
    vm.copySnippet = function () { copy(vm.snippet, 'The integration snippet'); vm.copied = true; };
    vm.done        = function () { $uibModalInstance.close(); };

    function copy(text, what) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        ToastService.success('Copied', what + ' is on the clipboard.');
    }
}
