// ═══════════════════════════════════════════════════════════════════
//  AirfieldHubClubController
//  Per-CLUB AirfieldHub settings, for club managers:
//     – Enable / choose environment / rollout stage   (§3.2, §3.3)
//     – Push the aircraft registration link            (§3.5)
//     – PPR status for the club's flights              (§5)
//
//  Server-wide concerns (which environments have keys, directory sync, queue
//  health) live on the ToAviate STAFF screen — airfieldHubAdminController.js.
//
//  There is deliberately NO key input here. The `afh_` key is per-ENVIRONMENT
//  and server-held; clubs are identified inside the request, not by
//  credential. See the header of airfieldHubService.js.
//
//  Contract: FRONTEND_AIRFIELDHUB_INTEGRATION_GUIDE.md §3.2, §3.3, §3.5, §5
// ═══════════════════════════════════════════════════════════════════

app.controller('AirfieldHubClubController', AirfieldHubClubController);

AirfieldHubClubController.$inject = ['AirfieldHubService', 'ToastService', '$rootScope', '$scope', '$state'];
function AirfieldHubClubController(AirfieldHubService, ToastService, $rootScope, $scope, $state) {

    var vm = this;

    vm.user = $rootScope.globals.currentUser;
    vm.club = vm.user.current_club_admin;
    vm.club_id = vm.club ? vm.club.id : null;
    vm.state = $state;

    vm.active_tab = 'setup';
    vm.setTab = setTab;

    vm.loading = true;
    vm.saving = false;
    vm.config = null;
    vm.environments = [];
    vm.stages = AirfieldHubService.stages;

    // Bound to the form; kept separate from vm.config so we can tell whether
    // there are unsaved changes and can revert cleanly on a failed save.
    vm.form = { afh_enabled: 0, afh_environment: null, afh_stage: 0 };

    // Club link
    vm.linking = false;
    vm.link_result = null;

    // Flights / PPR
    vm.flights = [];
    vm.flights_loading = false;

    vm.save          = save;
    vm.pushClubLink  = pushClubLink;
    vm.loadFlights   = loadFlights;
    vm.isDirty       = isDirty;
    vm.stageHelp     = stageHelp;
    vm.describe      = AirfieldHubService.describeStatus;
    vm.canEnable     = canEnable;
    vm.configuredEnvironments = configuredEnvironments;

    init();


    function init() {
        if (!vm.club_id) {
            vm.loading = false;
            vm.error = 'Select a club first.';
            return;
        }

        // Environments are needed for the picker. This endpoint returns
        // BOOLEANS ONLY (no keys) by design, so it is safe for a club manager
        // to read — it tells them which environments they may choose.
        AirfieldHubService.GetEnvironments()
            .then(function (data) {
                vm.environments = (data && data.success) ? (data.environments || []) : [];
            });

        AirfieldHubService.GetConfig(vm.club_id)
            .then(function (data) {
                vm.loading = false;
                if (!data || !data.success) {
                    vm.error = (data && data.message) || 'Could not load AirfieldHub settings.';
                    return;
                }
                applyConfig(data);
            });
    }

    function applyConfig(data) {
        vm.config = data;
        vm.form = {
            afh_enabled:     data.enabled ? 1 : 0,
            afh_environment: data.environment || null,
            afh_stage:       Number(data.stage || 0)
        };
    }

    function setTab(tab) {
        vm.active_tab = tab;
        if (tab === 'flights' && !vm.flights.length) { loadFlights(); }
    }

    function configuredEnvironments() {
        var out = [];
        for (var i = 0; i < vm.environments.length; i++) {
            if (vm.environments[i].configured) { out.push(vm.environments[i]); }
        }
        return out;
    }

    // The backend refuses "enabled with no environment" with a specific
    // message. Disabling the control (and saying why) is friendlier than
    // letting them submit into a known refusal.
    function canEnable() {
        return !!vm.form.afh_environment;
    }

    function isDirty() {
        if (!vm.config) { return false; }
        return vm.form.afh_enabled     !== (vm.config.enabled ? 1 : 0)
            || vm.form.afh_environment !== (vm.config.environment || null)
            || Number(vm.form.afh_stage) !== Number(vm.config.stage || 0);
    }

    function stageHelp(stage) {
        var s = Number(stage);
        for (var i = 0; i < vm.stages.length; i++) {
            if (vm.stages[i].value === s) { return vm.stages[i].help; }
        }
        return '';
    }

    function save() {
        if (vm.saving) { return; }

        if (vm.form.afh_enabled && !vm.form.afh_environment) {
            ToastService.warning('Choose an environment',
                'Select an environment before enabling the integration.');
            return;
        }

        vm.saving = true;

        AirfieldHubService.SaveConfig(vm.club_id, {
            afh_enabled:     vm.form.afh_enabled ? 1 : 0,
            afh_environment: vm.form.afh_environment,
            afh_stage:       Number(vm.form.afh_stage)
        }).then(function (data) {
            vm.saving = false;

            if (!data || !data.success) {
                // The backend sends a precise reason for the two refusals
                // (no key for that environment / enabling with no
                // environment). Surface it verbatim rather than a generic
                // failure, otherwise the admin cannot act on it.
                ToastService.error('Could not save',
                    (data && data.message) || 'Please try again.');
                return;
            }

            applyConfig(data);

            // `effective` = enabled AND an environment chosen AND that
            // environment actually has a key. enabled:true + effective:false
            // is a MISCONFIGURATION and must read as a warning, not success.
            if (data.enabled && !data.effective) {
                ToastService.warning('Saved, but not active',
                    'The integration is enabled but not effective — check the environment has a key configured.');
            } else if (data.effective && Number(data.stage) === 0) {
                ToastService.success('Saved',
                    'Active, but stage 0 sends nothing yet. Move to Shadow when you are ready.');
            } else {
                ToastService.success('Saved', 'AirfieldHub settings updated.');
            }
        });
    }

    function pushClubLink() {
        if (vm.linking) { return; }
        vm.linking = true;
        vm.link_result = null;

        AirfieldHubService.PushClubLink(vm.club_id)
            .then(function (data) {
                vm.linking = false;
                if (!data || !data.success) {
                    ToastService.error('Registration sync failed',
                        (data && data.message) || 'Please try again.');
                    return;
                }
                vm.link_result = data;
                if (vm.config) { vm.config.last_synced_at = data.last_synced_at || vm.config.last_synced_at; }
                ToastService.success('Registrations synced',
                    'AirfieldHub can now mirror movements for your aircraft.');
            });
    }

    function loadFlights() {
        if (!vm.club_id) { return; }
        vm.flights_loading = true;

        AirfieldHubService.GetFlights(vm.club_id)
            .then(function (data) {
                vm.flights_loading = false;
                vm.flights = (data && data.success) ? (data.flights || []) : [];

                // Decorate once here rather than calling describeStatus from
                // the template on every digest.
                for (var i = 0; i < vm.flights.length; i++) {
                    var f = vm.flights[i];
                    f._d = AirfieldHubService.describeStatus(f.status, f.kind);
                }
            });
    }
}
