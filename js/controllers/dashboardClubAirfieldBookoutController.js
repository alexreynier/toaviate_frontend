// ═══════════════════════════════════════════════════════════════════
//  DashboardClubAirfieldBookoutController
//  Admin settings panel: set base airfield, manage display tokens
// ═══════════════════════════════════════════════════════════════════

app.controller('DashboardClubAirfieldBookoutController', DashboardClubAirfieldBookoutController);

    DashboardClubAirfieldBookoutController.$inject = [
        'AirfieldBookoutService', 'BookoutService', 'ClubService',
        '$rootScope', '$scope', '$state', 'ToastService'
    ];
    function DashboardClubAirfieldBookoutController(
        AirfieldBookoutService, BookoutService, ClubService,
        $rootScope, $scope, $state, ToastService
    ) {
        var vm = this;

        // ── State ──
        vm.club_id      = $rootScope.globals.currentUser.current_club_admin.id;
        vm.loading       = true;
        vm.saving        = false;
        vm.active_tab    = 'settings';

        // Airfield
        vm.airfield       = null;       // { id, code, title }
        vm.airfield_search = '';
        vm.airfield_results = [];
        vm.searching       = false;

        // Tokens
        vm.tokens         = [];
        vm.new_label      = '';
        vm.generating     = false;

        // Bookout Settings
        vm.pilot_form_mode     = 'form';
        vm.display_allow_create = false;
        vm.allow_public_edit   = false;
        vm.saving_settings     = false;

        // Pilot form URL
        vm.pilot_form_url = '';

        // ── Public methods ──
        vm.setTab           = setTab;
        vm.searchAirfields  = searchAirfields;
        vm.selectAirfield   = selectAirfield;
        vm.generateToken    = generateToken;
        vm.revokeToken      = revokeToken;
        vm.copyUrl          = copyUrl;
        vm.getDisplayUrl    = getDisplayUrl;
        vm.getPilotFormUrl  = getPilotFormUrl;
        vm.saveSettings     = saveSettings;

        // ── Init ──
        init();


        function init() {
            vm.loading = true;
            AirfieldBookoutService.ListTokens(vm.club_id)
                .then(function(data) {
                    vm.loading = false;
                    if (data.success) {
                        vm.airfield = data.airfield || null;
                        vm.tokens   = data.tokens || [];
                        if (data.settings) {
                            vm.pilot_form_mode      = data.settings.pilot_form_mode || 'form';
                            vm.display_allow_create  = !!data.settings.display_allow_create;
                            vm.allow_public_edit     = !!data.settings.allow_public_edit;
                        }
                        if (vm.airfield && vm.airfield.code) {
                            vm.pilot_form_url = getPilotFormUrl();
                        }
                    }
                });
        }


        function setTab(tab) {
            vm.active_tab = tab;
        }


        // ── Airfield Search ──
        function searchAirfields() {
            if (!vm.airfield_search || vm.airfield_search.length < 2) {
                vm.airfield_results = [];
                return;
            }
            vm.searching = true;

            var search = vm.airfield_search.trim();
            var promise;

            // Short input (2-4 chars) → likely ICAO code
            if (search.length >= 2 && search.length <= 4) {
                promise = BookoutService.GetAirfieldsByCode(search);
            } else {
                // Longer input → name search (spaces → underscores for API)
                var code = search.replace(/\s+/g, '_');
                promise = BookoutService.GetAirfields(code);
            }

            promise.then(function(data) {
                vm.searching = false;
                // API may return { airfields: [...] } or a raw array
                if (data && Array.isArray(data)) {
                    vm.airfield_results = data;
                } else if (data && data.airfields) {
                    vm.airfield_results = data.airfields;
                } else if (data && Array.isArray(data.data)) {
                    vm.airfield_results = data.data;
                } else {
                    vm.airfield_results = [];
                }
            }, function() {
                vm.searching = false;
                vm.airfield_results = [];
            });
        }

        function selectAirfield(af) {
            vm.saving = true;
            vm.airfield_results = [];
            vm.airfield_search = '';

            AirfieldBookoutService.SetBaseAirfield(vm.club_id, af.id)
                .then(function(data) {
                    vm.saving = false;
                    if (data.success) {
                        vm.airfield = data.airfield || af;
                        vm.pilot_form_url = getPilotFormUrl();
                        ToastService.success('Airfield Set', 'Base airfield updated to ' + (vm.airfield.code || af.code));
                    } else {
                        ToastService.error('Error', data.message || 'Could not set base airfield');
                    }
                });
        }


        // ── Token Management ──
        function generateToken() {
            vm.generating = true;
            AirfieldBookoutService.GenerateToken(vm.club_id, vm.new_label)
                .then(function(data) {
                    vm.generating = false;
                    if (data.success) {
                        vm.tokens.push({
                            token:      data.token,
                            label:      data.label || vm.new_label || '',
                            created_at: new Date().toISOString()
                        });
                        vm.new_label = '';
                        ToastService.success('Token Created', 'Display token generated successfully');
                    } else {
                        ToastService.error('Error', data.message || 'Could not generate token');
                    }
                });
        }

        function revokeToken(token) {
            if (!confirm('Revoke this display token? The controller screen using it will stop working.')) return;

            AirfieldBookoutService.RevokeToken(vm.club_id, token.token)
                .then(function(data) {
                    if (data.success) {
                        var idx = vm.tokens.indexOf(token);
                        if (idx > -1) vm.tokens.splice(idx, 1);
                        ToastService.success('Revoked', 'Display token has been revoked');
                    } else {
                        ToastService.error('Error', data.message || 'Could not revoke token');
                    }
                });
        }


        // ── Save Bookout Settings ──
        function saveSettings() {
            vm.saving_settings = true;
            var payload = {
                pilot_form_mode:     vm.pilot_form_mode,
                display_allow_create: vm.display_allow_create,
                allow_public_edit:   vm.allow_public_edit
            };

            AirfieldBookoutService.UpdateSettings(vm.club_id, payload)
                .then(function(data) {
                    vm.saving_settings = false;
                    if (data.success) {
                        vm.pilot_form_mode      = data.pilot_form_mode || vm.pilot_form_mode;
                        vm.display_allow_create  = data.display_allow_create !== undefined ? !!data.display_allow_create : vm.display_allow_create;
                        vm.allow_public_edit     = data.allow_public_edit !== undefined ? !!data.allow_public_edit : vm.allow_public_edit;
                        ToastService.success('Settings Saved', 'Bookout settings updated successfully');
                    } else {
                        ToastService.error('Error', data.message || 'Could not save settings');
                    }
                }, function() {
                    vm.saving_settings = false;
                    ToastService.error('Error', 'Connection error — could not save settings');
                });
        }


        // ── URL helpers ──
        function getDisplayUrl(token) {
            var base = window.location.origin;
            return base + '/bookout-display/' + token.token;
        }

        function getPilotFormUrl() {
            if (!vm.airfield || !vm.airfield.code) return '';
            var base = window.location.origin;
            return base + '/bookout/' + vm.airfield.code;
        }

        function copyUrl(url) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(function() {
                    ToastService.success('Copied', 'URL copied to clipboard');
                });
            } else {
                // Fallback
                var el = document.createElement('textarea');
                el.value = url;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                ToastService.success('Copied', 'URL copied to clipboard');
            }
        }
    }
