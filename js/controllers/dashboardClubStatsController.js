app.controller('DashboardClubStatsController', DashboardClubStatsController);

DashboardClubStatsController.$inject = ['ClubStatsService', '$rootScope', '$scope', '$state', 'ToastService', '$timeout'];

function DashboardClubStatsController(ClubStatsService, $rootScope, $scope, $state, ToastService, $timeout) {
    var vm = this;

    // ─── User / Club ───
    vm.user = $rootScope.globals.currentUser;
    vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
    vm.club = $rootScope.globals.currentUser.current_club_admin;

    // ─── Date Range ───
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    vm.preset = 'this_month';
    vm.start_date = formatDate(monthStart);
    vm.end_date = formatDate(now);
    vm.show_custom_dates = false;

    // ─── Active Tab ───
    vm.active_tab = 'instructors';

    // ─── Overview ───
    vm.overview = null;
    vm.overview_loading = true;

    // ─── Instructor Tab ───
    vm.instructors = [];
    vm.instructors_loading = false;
    vm.instructors_pagination = { total: 0, limit: 20, offset: 0, has_more: false };

    // ─── Aircraft Tab ───
    vm.aircraft = [];
    vm.aircraft_loading = false;
    vm.aircraft_time_type = 'airborne';
    vm.aircraft_pagination = { total: 0, limit: 20, offset: 0, has_more: false };
    vm.is_tpc = false;

    // ─── Members Tab ───
    vm.members = [];
    vm.members_loading = false;
    vm.members_sort_by = 'hours';
    vm.members_pagination = { total: 0, limit: 20, offset: 0, has_more: false };

    // ─── Financial Tab ───
    vm.financial = null;
    vm.financial_loading = false;

    // ─── Drill-down ───
    vm.drill = {
        open: false,
        type: null,
        entity_id: null,
        entity_name: '',
        loading: false,
        data: null
    };

    // ─── Chart instances (stored for cleanup) ───
    var chartInstances = {};

    // ─── Currency ───
    vm.currency = '';
    vm.currency_symbol = '£';

    // ─── Init ───
    loadAll();

    // ═══════════════════════════════════════════════════
    //  DATE RANGE
    // ═══════════════════════════════════════════════════

    $scope.applyPreset = function() {
        var today = new Date();
        vm.show_custom_dates = false;

        switch (vm.preset) {
            case 'this_month':
                vm.start_date = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
                vm.end_date = formatDate(today);
                break;
            case 'last_month':
                var lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                vm.start_date = formatDate(lm);
                vm.end_date = formatDate(new Date(today.getFullYear(), today.getMonth(), 0));
                break;
            case 'this_quarter':
                var qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
                vm.start_date = formatDate(qStart);
                vm.end_date = formatDate(today);
                break;
            case 'last_quarter':
                var pqStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - 3, 1);
                var pqEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 0);
                vm.start_date = formatDate(pqStart);
                vm.end_date = formatDate(pqEnd);
                break;
            case 'this_year':
                vm.start_date = formatDate(new Date(today.getFullYear(), 0, 1));
                vm.end_date = formatDate(today);
                break;
            case 'last_30':
                var d30 = new Date(today);
                d30.setDate(d30.getDate() - 30);
                vm.start_date = formatDate(d30);
                vm.end_date = formatDate(today);
                break;
            case 'last_90':
                var d90 = new Date(today);
                d90.setDate(d90.getDate() - 90);
                vm.start_date = formatDate(d90);
                vm.end_date = formatDate(today);
                break;
            case 'custom':
                vm.show_custom_dates = true;
                return; // Don't reload yet; user picks dates then clicks Apply
        }
        loadAll();
    };

    $scope.applyCustomRange = function() {
        if (vm.start_date && vm.end_date) {
            loadAll();
        }
    };

    // ═══════════════════════════════════════════════════
    //  TAB SWITCHING
    // ═══════════════════════════════════════════════════

    $scope.setTab = function(tab) {
        vm.active_tab = tab;
        // Load data if not yet loaded
        switch (tab) {
            case 'instructors':
                if (!vm.instructors.length && !vm.instructors_loading) loadInstructors();
                break;
            case 'aircraft':
                if (!vm.aircraft.length && !vm.aircraft_loading) loadAircraft();
                break;
            case 'members':
                if (!vm.members.length && !vm.members_loading) loadMembers();
                break;
            case 'financial':
                if (!vm.financial && !vm.financial_loading) loadFinancial();
                break;
        }
    };

    // ═══════════════════════════════════════════════════
    //  DATA LOADING
    // ═══════════════════════════════════════════════════

    function loadAll() {
        loadOverview();
        // Reset tab data
        vm.instructors = [];
        vm.aircraft = [];
        vm.members = [];
        vm.financial = null;
        // Load active tab
        switch (vm.active_tab) {
            case 'instructors': loadInstructors(); break;
            case 'aircraft': loadAircraft(); break;
            case 'members': loadMembers(); break;
            case 'financial': loadFinancial(); break;
        }
    }

    function loadOverview() {
        vm.overview_loading = true;
        vm.overview = null;
        ClubStatsService.GetOverview(vm.club_id, vm.start_date, vm.end_date).then(function(data) {
            vm.overview_loading = false;
            if (data && data.success) {
                vm.overview = data;
                vm.currency = data.club.currency || 'GBP';
                vm.currency_symbol = getCurrencySymbol(vm.currency);
                vm.is_tpc = data.club.is_tpc || false;
            } else {
                handleApiError(data);
            }
        });
    }

    function loadInstructors() {
        vm.instructors_loading = true;
        ClubStatsService.GetInstructors(vm.club_id, vm.start_date, vm.end_date,
            vm.instructors_pagination.limit, vm.instructors_pagination.offset
        ).then(function(data) {
            vm.instructors_loading = false;
            if (data && data.success) {
                vm.instructors = data.instructors || [];
                if (data.pagination) vm.instructors_pagination = data.pagination;
            } else {
                handleApiError(data);
            }
        });
    }

    $scope.reloadInstructors = function(resetOffset) {
        if (resetOffset) vm.instructors_pagination.offset = 0;
        loadInstructors();
    };

    function loadAircraft() {
        vm.aircraft_loading = true;
        ClubStatsService.GetAircraft(vm.club_id, vm.start_date, vm.end_date,
            vm.aircraft_time_type,
            vm.aircraft_pagination.limit, vm.aircraft_pagination.offset
        ).then(function(data) {
            vm.aircraft_loading = false;
            if (data && data.success) {
                vm.aircraft = data.aircraft || [];
                vm.is_tpc = data.is_tpc || false;
                if (data.pagination) vm.aircraft_pagination = data.pagination;
            } else {
                handleApiError(data);
            }
        });
    }

    $scope.reloadAircraft = function(resetOffset) {
        if (resetOffset) vm.aircraft_pagination.offset = 0;
        loadAircraft();
    };

    function loadMembers() {
        vm.members_loading = true;
        ClubStatsService.GetMembers(vm.club_id, vm.start_date, vm.end_date,
            vm.members_sort_by,
            vm.members_pagination.limit, vm.members_pagination.offset
        ).then(function(data) {
            vm.members_loading = false;
            if (data && data.success) {
                vm.members = data.members || [];
                if (data.pagination) vm.members_pagination = data.pagination;
            } else {
                handleApiError(data);
            }
        });
    }

    $scope.reloadMembers = function(resetOffset) {
        if (resetOffset) vm.members_pagination.offset = 0;
        loadMembers();
    };

    function loadFinancial() {
        vm.financial_loading = true;
        ClubStatsService.GetFinancial(vm.club_id, vm.start_date, vm.end_date).then(function(data) {
            vm.financial_loading = false;
            if (data && data.success) {
                vm.financial = data;
                vm.currency = data.currency || vm.currency;
                vm.currency_symbol = getCurrencySymbol(vm.currency);
                // Render charts after digest
                $timeout(function() {
                    renderFinancialCharts();
                }, 100);
            } else {
                handleApiError(data);
            }
        });
    }

    // ═══════════════════════════════════════════════════
    //  PAGINATION
    // ═══════════════════════════════════════════════════

    $scope.nextPage = function(tab) {
        var p = vm[tab + '_pagination'];
        if (p && p.has_more) {
            p.offset = p.offset + p.limit;
            reloadTab(tab);
        }
    };

    $scope.prevPage = function(tab) {
        var p = vm[tab + '_pagination'];
        if (p && p.offset > 0) {
            p.offset = Math.max(0, p.offset - p.limit);
            reloadTab(tab);
        }
    };

    function reloadTab(tab) {
        switch (tab) {
            case 'instructors': loadInstructors(); break;
            case 'aircraft': loadAircraft(); break;
            case 'members': loadMembers(); break;
        }
    }

    // ═══════════════════════════════════════════════════
    //  DRILL-DOWN
    // ═══════════════════════════════════════════════════

    $scope.openDrillDown = function(type, entity) {
        vm.drill.open = true;
        vm.drill.type = type;
        vm.drill.loading = true;
        vm.drill.data = null;

        var promise;
        switch (type) {
            case 'instructor':
                vm.drill.entity_id = entity.instructor_id;
                vm.drill.entity_name = entity.name;
                promise = ClubStatsService.GetInstructorAircraft(vm.club_id, entity.instructor_id, vm.start_date, vm.end_date);
                break;
            case 'member':
                vm.drill.entity_id = entity.user_id || entity.member_id;
                vm.drill.entity_name = entity.name;
                promise = ClubStatsService.GetMemberAircraft(vm.club_id, vm.drill.entity_id, vm.start_date, vm.end_date);
                break;
            case 'aircraft':
                vm.drill.entity_id = entity.plane_id;
                vm.drill.entity_name = entity.registration;
                promise = ClubStatsService.GetAircraftPilots(vm.club_id, entity.plane_id, vm.start_date, vm.end_date);
                break;
        }

        if (promise) {
            promise.then(function(data) {
                vm.drill.loading = false;
                if (data && data.success) {
                    vm.drill.data = data;
                    $timeout(function() {
                        renderDrillDownChart();
                    }, 100);
                } else {
                    handleApiError(data);
                    vm.drill.open = false;
                }
            });
        }
    };

    $scope.closeDrillDown = function() {
        vm.drill.open = false;
        vm.drill.type = null;
        vm.drill.data = null;
        destroyChart('drilldown_pie');
    };

    // ═══════════════════════════════════════════════════
    //  CSV EXPORT
    // ═══════════════════════════════════════════════════

    $scope.exportCsv = function(type, entityId) {
        ClubStatsService.ExportCsv(vm.club_id, type, vm.start_date, vm.end_date, entityId).then(function(data) {
            if (data && !data.success && data.message) {
                ToastService.showToast(data.message, 'error');
            }
        });
    };

    $scope.exportDrillDown = function() {
        if (!vm.drill.type || !vm.drill.entity_id) return;
        var exportType;
        var entityParam;
        switch (vm.drill.type) {
            case 'instructor':
                exportType = 'instructors';
                entityParam = 'instructor_id';
                break;
            case 'member':
                exportType = 'members';
                entityParam = 'user_id';
                break;
            case 'aircraft':
                exportType = 'aircraft';
                entityParam = 'plane_id';
                break;
        }
        if (exportType) {
            ClubStatsService.ExportCsv(vm.club_id, exportType, vm.start_date, vm.end_date, entityParam, vm.drill.entity_id).then(function(data) {
                if (data && !data.success && data.message) {
                    ToastService.showToast(data.message, 'error');
                }
            });
        }
    };

    // ═══════════════════════════════════════════════════
    //  CHARTS (Chart.js)
    // ═══════════════════════════════════════════════════

    var CHART_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
    var CHART_COLORS_SOFT = ['rgba(59,130,246,0.8)', 'rgba(239,68,68,0.8)', 'rgba(245,158,11,0.8)', 'rgba(16,185,129,0.8)', 'rgba(139,92,246,0.8)', 'rgba(236,72,153,0.8)', 'rgba(6,182,212,0.8)', 'rgba(132,204,22,0.8)', 'rgba(249,115,22,0.8)', 'rgba(99,102,241,0.8)'];

    function renderFinancialCharts() {
        if (!vm.financial) return;

        // Revenue by Source Pie
        if (vm.financial.revenue_by_source && vm.financial.revenue_by_source.length) {
            destroyChart('revenue_pie');
            var revCanvas = document.getElementById('clubStatsRevenuePie');
            if (revCanvas) {
                chartInstances['revenue_pie'] = new Chart(revCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: vm.financial.revenue_by_source.map(function(s) { return capitalise(s.source); }),
                        datasets: [{
                            data: vm.financial.revenue_by_source.map(function(s) { return s.amount; }),
                            backgroundColor: CHART_COLORS_SOFT,
                            borderColor: '#fff',
                            borderWidth: 3,
                            hoverBorderWidth: 0,
                            hoverOffset: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        cutout: '55%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12, weight: '500' } }
                            },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                padding: 12,
                                cornerRadius: 8,
                                titleFont: { size: 13, weight: '600' },
                                bodyFont: { size: 12 },
                                callbacks: {
                                    label: function(ctx) {
                                        return ctx.label + ': ' + vm.currency_symbol + formatNumber(ctx.parsed) + ' (' + vm.financial.revenue_by_source[ctx.dataIndex].percentage + '%)';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        // Payment Methods Bar
        if (vm.financial.payment_methods && vm.financial.payment_methods.length) {
            destroyChart('payment_bar');
            var payCanvas = document.getElementById('clubStatsPaymentBar');
            if (payCanvas) {
                chartInstances['payment_bar'] = new Chart(payCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: vm.financial.payment_methods.map(function(p) { return capitalise(p.method.replace(/_/g, ' ')); }),
                        datasets: [{
                            label: 'Amount',
                            data: vm.financial.payment_methods.map(function(p) { return p.amount; }),
                            backgroundColor: CHART_COLORS_SOFT.slice(0, vm.financial.payment_methods.length),
                            borderRadius: 6,
                            borderSkipped: false,
                            barThickness: 40,
                            maxBarThickness: 60
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                padding: 12,
                                cornerRadius: 8,
                                callbacks: {
                                    label: function(ctx) { return vm.currency_symbol + formatNumber(ctx.parsed.y); }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: '#f1f5f9' },
                                ticks: { font: { size: 11 }, callback: function(val) { return vm.currency_symbol + formatNumber(val); } }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { font: { size: 11, weight: '500' } }
                            }
                        }
                    }
                });
            }
        }

        // Daily Trend Line
        if (vm.financial.daily_trend && vm.financial.daily_trend.length) {
            destroyChart('daily_line');
            var lineCanvas = document.getElementById('clubStatsDailyLine');
            if (lineCanvas) {
                chartInstances['daily_line'] = new Chart(lineCanvas.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: vm.financial.daily_trend.map(function(d) { return formatShortDate(d.date); }),
                        datasets: [{
                            label: 'Daily Revenue',
                            data: vm.financial.daily_trend.map(function(d) { return d.revenue; }),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59,130,246,0.08)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 2,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderWidth: 2.5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                padding: 12,
                                cornerRadius: 8,
                                callbacks: {
                                    label: function(ctx) { return 'Revenue: ' + vm.currency_symbol + formatNumber(ctx.parsed.y); }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: '#f1f5f9' },
                                ticks: { font: { size: 11 }, callback: function(val) { return vm.currency_symbol + formatNumber(val); } }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { font: { size: 10 }, maxRotation: 45 }
                            }
                        }
                    }
                });
            }
        }
    }

    function renderDrillDownChart() {
        if (!vm.drill.data) return;
        destroyChart('drilldown_pie');

        var canvas = document.getElementById('clubStatsDrillDownPie');
        if (!canvas) return;

        var items, labelKey, dataKey;

        if (vm.drill.type === 'instructor' || vm.drill.type === 'member') {
            items = vm.drill.data.by_aircraft_type || [];
            labelKey = 'plane_type';
            dataKey = 'flights';
        } else if (vm.drill.type === 'aircraft') {
            items = (vm.drill.data.top_pilots || []).slice(0, 8);
            labelKey = 'name';
            dataKey = 'flights';
        }

        if (!items || !items.length) return;

        chartInstances['drilldown_pie'] = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: items.map(function(i) { return i[labelKey]; }),
                datasets: [{
                    data: items.map(function(i) { return i[dataKey]; }),
                    backgroundColor: CHART_COLORS_SOFT,
                    borderColor: '#fff',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '50%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 14, usePointStyle: true, font: { size: 12, weight: '500' } }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 8
                    }
                }
            }
        });
    }

    function destroyChart(key) {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            delete chartInstances[key];
        }
    }

    // Cleanup charts on scope destroy
    $scope.$on('$destroy', function() {
        Object.keys(chartInstances).forEach(function(key) {
            if (chartInstances[key]) chartInstances[key].destroy();
        });
        chartInstances = {};
    });

    // ═══════════════════════════════════════════════════
    //  FORMATTING HELPERS
    // ═══════════════════════════════════════════════════

    $scope.formatCurrency = function(amount) {
        if (amount == null) return vm.currency_symbol + '0.00';
        return vm.currency_symbol + formatNumber(amount);
    };

    $scope.formatHours = function(hours) {
        if (hours == null) return '0.0';
        return parseFloat(hours).toFixed(1);
    };

    $scope.rankBadgeClass = function(rank) {
        if (rank === 1) return 'rank-badge--gold';
        if (rank === 2) return 'rank-badge--silver';
        if (rank === 3) return 'rank-badge--bronze';
        return 'rank-badge--default';
    };

    function formatNumber(num) {
        if (num == null) return '0';
        return parseFloat(num).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatDate(d) {
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    }

    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1];
    }

    function capitalise(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
    }

    function getCurrencySymbol(code) {
        var symbols = { 'GBP': '£', 'USD': '$', 'EUR': '€', 'AUD': 'A$', 'NZD': 'NZ$', 'CAD': 'C$', 'ZAR': 'R', 'CHF': 'CHF ' };
        return symbols[code] || code + ' ';
    }

    function handleApiError(data) {
        var msg = (data && data.message) ? data.message : 'Failed to load statistics.';
        if (msg.indexOf('manager') !== -1) {
            ToastService.showToast('Access denied: Manager permissions required.', 'error');
            $state.go('dashboard.manage_club');
        } else {
            ToastService.showToast(msg, 'error');
        }
    }
}
