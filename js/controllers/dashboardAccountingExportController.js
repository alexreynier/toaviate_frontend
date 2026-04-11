app.controller('DashboardAccountingExportController', DashboardAccountingExportController);

DashboardAccountingExportController.$inject = ['AccountingExportService', '$scope', '$state', '$rootScope', '$timeout'];
function DashboardAccountingExportController(AccountingExportService, $scope, $state, $rootScope, $timeout) {
    var vm = this;

    // ─── User Context ───
    vm.user = $rootScope.globals.currentUser;
    vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;

    // ─── Page State ───
    vm.active_tab = 'settings';      // settings | codes | export
    vm.codes_tab = 'members';        // members | aircraft | items | memberships
    vm.loading = false;
    vm.saving = false;
    vm.message = null;               // { type: 'success'|'error'|'warning', text: '...' }

    // ─── Settings ───
    vm.accounting_enabled = false;
    vm.settings = {
        export_format: 'sage50',
        customer_prefix: '',
        default_aircraft_code: '4000',
        default_landing_code: '4001',
        default_touch_go_code: '4002',
        default_tuition_code: '4010',
        default_rental_code: '4020',
        default_membership_code: '4030',
        default_voucher_code: '4040',
        default_other_code: '4099',
        stripe_fee_code: '7901',
        gocardless_fee_code: '7902',
        platform_fee_code: '7903',
        bank_account_code: '1200',
        cash_account_code: '1230',
        card_account_code: '',
        vat_code_standard: 'T1',
        vat_code_exempt: 'T0',
        vat_code_zero: 'T0',
        include_vat_breakdown: true,
        include_fee_breakdown: true,
        export_paid_only: true
    };

    // ─── Codes ───
    vm.codes = {
        members: [],
        aircraft: [],
        items: [],
        memberships: [],
        instructor_charges: []
    };
    vm.codes_search = '';
    vm.auto_gen_prefix = '';
    vm.auto_gen_start = 1;
    vm.auto_gen_overwrite = false;

    // ─── Export ───
    vm.export_start_date = getFirstOfMonth();
    vm.export_end_date = getToday();
    vm.export_type = 'daybook';
    vm.include_fees = true;
    vm.preview = null;
    vm.previewing = false;
    vm.downloading = false;
    vm.history = [];
    vm.history_loading = false;

    // ─── Init ───
    loadSettings();

    // ─── Tab Navigation ───
    $scope.setTab = function(tab) {
        vm.active_tab = tab;
        vm.message = null;
        if (tab === 'codes' && !vm.codes.members.length && !vm.codes_loading && vm.accounting_enabled) {
            loadCodes();
        }
        if (tab === 'export' && !vm.history.length && !vm.history_loading && vm.accounting_enabled) {
            loadHistory();
        }
    };

    $scope.setCodesTab = function(tab) {
        vm.codes_tab = tab;
        vm.codes_search = '';
    };

    // ─── Settings Methods ───

    vm.saveSettings = function() {
        vm.saving = true;
        vm.message = null;
        var payload = {
            accounting_enabled: vm.accounting_enabled,
            export_format: vm.settings.export_format,
            customer_prefix: vm.settings.customer_prefix,
            default_aircraft_code: vm.settings.default_aircraft_code,
            default_landing_code: vm.settings.default_landing_code,
            default_touch_go_code: vm.settings.default_touch_go_code,
            default_tuition_code: vm.settings.default_tuition_code,
            default_rental_code: vm.settings.default_rental_code,
            default_membership_code: vm.settings.default_membership_code,
            default_voucher_code: vm.settings.default_voucher_code,
            default_other_code: vm.settings.default_other_code,
            stripe_fee_code: vm.settings.stripe_fee_code,
            gocardless_fee_code: vm.settings.gocardless_fee_code,
            platform_fee_code: vm.settings.platform_fee_code,
            bank_account_code: vm.settings.bank_account_code,
            cash_account_code: vm.settings.cash_account_code,
            card_account_code: vm.settings.card_account_code,
            vat_code_standard: vm.settings.vat_code_standard,
            vat_code_exempt: vm.settings.vat_code_exempt,
            vat_code_zero: vm.settings.vat_code_zero,
            include_vat_breakdown: vm.settings.include_vat_breakdown,
            include_fee_breakdown: vm.settings.include_fee_breakdown,
            export_paid_only: vm.settings.export_paid_only
        };
        AccountingExportService.SaveSettings(vm.club_id, payload).then(function(res) {
            vm.saving = false;
            if (res.success) {
                showMessage('success', 'Settings saved successfully');
                // Reload settings from server to ensure state is in sync
                loadSettings();
            } else {
                showMessage('error', res.message || 'Failed to save settings');
            }
        });
    };

    // ─── Codes Methods ───

    vm.saveMemberCodes = function() {
        vm.saving = true;
        vm.message = null;
        var codes = vm.codes.members
            .filter(function(m) { return m.accounting_code; })
            .map(function(m) {
                return { member_id: m.id || m.member_id, accounting_code: m.accounting_code };
            });
        AccountingExportService.SaveMemberCodes(vm.club_id, codes).then(function(res) {
            vm.saving = false;
            if (res.success) {
                showMessage('success', res.message || 'Member codes saved');
            } else {
                showMessage('error', res.message || 'Failed to save member codes');
            }
        });
    };

    vm.autoGenerateCodes = function() {
        if (vm.auto_gen_overwrite) {
            if (!confirm('This will overwrite existing member codes. Continue?')) return;
        }
        vm.saving = true;
        vm.message = null;
        AccountingExportService.AutoGenerateMemberCodes(
            vm.club_id,
            vm.auto_gen_prefix || vm.settings.customer_prefix,
            vm.auto_gen_start,
            vm.auto_gen_overwrite
        ).then(function(res) {
            vm.saving = false;
            if (res.success) {
                showMessage('success', res.message || 'Codes generated successfully');
                loadCodes();
            } else {
                showMessage('error', res.message || 'Failed to generate codes');
            }
        });
    };

    vm.saveAircraftCodes = function() {
        vm.saving = true;
        vm.message = null;
        var codes = vm.codes.aircraft.map(function(a) {
            return { club_plane_id: a.club_plane_id, accounting_code: a.club_override || a.plane_code || '' };
        });
        AccountingExportService.SaveAircraftCodes(vm.club_id, codes).then(function(res) {
            vm.saving = false;
            if (res.success) {
                showMessage('success', res.message || 'Aircraft codes saved');
            } else {
                showMessage('error', res.message || 'Failed to save aircraft codes');
            }
        });
    };

    vm.saveItemCodes = function() {
        vm.saving = true;
        vm.message = null;
        var codes = vm.codes.items.map(function(i) {
            return { item_id: i.item_id, accounting_code: i.accounting_code || '' };
        });
        AccountingExportService.SaveItemCodes(vm.club_id, codes).then(function(res) {
            vm.saving = false;
            if (res.success) {
                showMessage('success', res.message || 'Item codes saved');
            } else {
                showMessage('error', res.message || 'Failed to save item codes');
            }
        });
    };

    vm.saveMembershipCodes = function() {
        vm.saving = true;
        vm.message = null;
        var codes = vm.codes.memberships.map(function(m) {
            return { membership_id: m.membership_id, accounting_code: m.accounting_code || '' };
        });
        AccountingExportService.SaveMembershipCodes(vm.club_id, codes).then(function(res) {
            vm.saving = false;
            if (res.success) {
                showMessage('success', res.message || 'Membership codes saved');
            } else {
                showMessage('error', res.message || 'Failed to save membership codes');
            }
        });
    };

    // ─── Codes Search Filter ───
    $scope.searchCodes = function(item) {
        if (!vm.codes_search) return true;
        var q = vm.codes_search.toLowerCase();
        var name = (item.full_name || ((item.first_name || '') + ' ' + (item.last_name || '')).trim() || item.registration || item.title || item.membership_name || '').toLowerCase();
        var code = (item.accounting_code || '').toLowerCase();
        var email = (item.email || '').toLowerCase();
        return name.indexOf(q) !== -1 || code.indexOf(q) !== -1 || email.indexOf(q) !== -1;
    };

    // ─── Export Methods ───

    vm.loadPreview = function() {
        if (!vm.export_start_date || !vm.export_end_date) {
            showMessage('error', 'Please select a date range');
            return;
        }
        vm.previewing = true;
        vm.preview = null;
        vm.message = null;
        AccountingExportService.GetPreview(
            vm.club_id,
            formatDate(vm.export_start_date),
            formatDate(vm.export_end_date),
            vm.export_type,
            vm.include_fees
        ).then(function(res) {
            vm.previewing = false;
            if (res.success) {
                // The API nests the complete preview under res.data
                var data = res.data || {};

                // Use the backend-provided summary directly if available
                if (!data.summary) {
                    var totalFees = (res.payments ? (res.payments.total_transaction_fees || 0) + (res.payments.total_platform_fees || 0) : 0);
                    var totalGross = res.invoices ? (res.invoices.total_gross || 0) : 0;
                    var totalReceived = res.payments ? (res.payments.total_received || 0) : 0;
                    data.summary = {
                        invoice_count: res.invoices ? (res.invoices.count || 0) : 0,
                        payment_count: res.payments ? (res.payments.count || 0) : 0,
                        total_gross: totalGross || totalReceived,
                        total_fees: totalFees,
                        total_net: (totalGross || totalReceived) - totalFees
                    };
                }

                // Ensure transactions array exists
                if (!data.transactions) {
                    data.transactions = [];
                }

                // Normalise warnings into an array of strings
                var warnings = data.warnings || res.warnings;
                if (warnings && !Array.isArray(warnings)) {
                    var warningList = [];
                    if (warnings.members_without_codes) {
                        warningList.push(warnings.members_without_codes + ' members do not have accounting reference codes assigned');
                    }
                    warnings = warningList;
                }
                data.warnings = warnings || [];

                vm.preview = data;
            } else {
                showMessage('error', res.message || 'Failed to load preview');
            }
        });
    };

    vm.downloadExport = function() {
        if (!vm.export_start_date || !vm.export_end_date) {
            showMessage('error', 'Please select a date range');
            return;
        }
        vm.downloading = true;
        vm.message = null;
        AccountingExportService.DownloadExport(
            vm.club_id,
            formatDate(vm.export_start_date),
            formatDate(vm.export_end_date),
            vm.export_type,
            vm.include_fees
        ).then(function(res) {
            vm.downloading = false;
            if (res.success) {
                showMessage('success', 'Export downloaded successfully');
                loadHistory();
            } else {
                showMessage('error', res.message || 'Export failed');
            }
        });
    };

    // ─── Quick Date Presets ───
    vm.setDatePreset = function(preset) {
        var now = new Date();
        var y = now.getFullYear();
        var m = now.getMonth();
        switch (preset) {
            case 'this_month':
                vm.export_start_date = new Date(y, m, 1);
                vm.export_end_date = new Date();
                break;
            case 'last_month':
                vm.export_start_date = new Date(y, m - 1, 1);
                vm.export_end_date = new Date(y, m, 0);
                break;
            case 'this_quarter':
                var qStart = m - (m % 3);
                vm.export_start_date = new Date(y, qStart, 1);
                vm.export_end_date = new Date();
                break;
            case 'last_quarter':
                var lqStart = m - (m % 3) - 3;
                var lqEnd = m - (m % 3);
                vm.export_start_date = new Date(y, lqStart, 1);
                vm.export_end_date = new Date(y, lqEnd, 0);
                break;
            case 'this_year':
                vm.export_start_date = new Date(y, 0, 1);
                vm.export_end_date = new Date();
                break;
        }
    };

    // ─── Format Helpers ───

    vm.formatCurrency = function(amount) {
        if (amount === null || amount === undefined) return '£0.00';
        return '£' + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    vm.formatDate = function(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    vm.getTypeBadgeClass = function(type) {
        switch (type) {
            case 'SI': return 'acct-export__badge--invoice';
            case 'SR': return 'acct-export__badge--payment';
            case 'PP': return 'acct-export__badge--fee';
            default: return '';
        }
    };

    vm.getTypeLabel = function(type) {
        switch (type) {
            case 'SI': return 'Sales Invoice';
            case 'SR': return 'Sales Receipt';
            case 'PP': return 'Purchase Payment';
            default: return type;
        }
    };

    vm.getMembersWithoutCodes = function() {
        return vm.codes.members.filter(function(m) { return !m.accounting_code; }).length;
    };

    // ─── Data Loading ───

    function loadSettings() {
        vm.loading = true;
        AccountingExportService.GetSettings(vm.club_id).then(function(res) {
            vm.loading = false;

            // Detect error responses (handleError returns { success: false })
            if (res.success === false) {
                if (res.code === 'ACCOUNTING_NOT_ENABLED' || res.code === 'SETTINGS_NOT_FOUND') {
                    vm.accounting_enabled = false;
                }
                return;
            }

            // Club-level fields
            if (res.club) {
                vm.accounting_enabled = (res.club.accounting_enabled == 1 || res.club.accounting_enabled === true);
                if (res.club.accounting_customer_prefix) {
                    vm.settings.customer_prefix = res.club.accounting_customer_prefix;
                    vm.auto_gen_prefix = res.club.accounting_customer_prefix;
                }
                if (res.club.accounting_export_format) {
                    vm.settings.export_format = res.club.accounting_export_format;
                }
            }

            // Settings object (nominal codes, VAT, fees, etc.)
            if (res.settings) {
                angular.extend(vm.settings, res.settings);
            }
        });
    }

    function loadCodes() {
        if (!vm.accounting_enabled) {
            showMessage('warning', 'Please enable accounting export first in the Settings tab');
            return;
        }
        vm.codes_loading = true;
        AccountingExportService.GetCodes(vm.club_id).then(function(res) {
            vm.codes_loading = false;
            // Handle both { success, data: { members, ... } } and { success, members, ... }
            var codesData = res.data || res;
            if (res.success) {
                vm.codes.members = codesData.members || [];
                vm.codes.aircraft = codesData.aircraft || [];
                vm.codes.items = codesData.items || [];
                vm.codes.memberships = codesData.memberships || [];
                vm.codes.instructor_charges = codesData.instructor_charges || [];
            } else if (res.code === 'ACCOUNTING_NOT_ENABLED') {
                showMessage('warning', 'Please enable accounting export first in the Settings tab');
            } else {
                showMessage('error', res.message || 'Failed to load accounting codes');
            }
        });
    }

    function loadHistory() {
        vm.history_loading = true;
        AccountingExportService.GetHistory(vm.club_id).then(function(res) {
            vm.history_loading = false;
            if (res.success) {
                vm.history = res.history || res.data || [];
            }
        });
    }

    // ─── Helpers ───

    function showMessage(type, text) {
        vm.message = { type: type, text: text };
        $timeout(function() {
            if (vm.message && vm.message.text === text) {
                vm.message = null;
            }
        }, 6000);
    }

    function getToday() {
        return new Date();
    }

    function getFirstOfMonth() {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    function formatDate(d) {
        if (typeof d === 'string') return d;
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    }
}
