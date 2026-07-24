// One controller serves both screens of the ToAviate-admin Platform Earnings
// section (split out of the GoCardless Monitor — health and money are
// separate concerns); the screen is chosen by the route's data.screen.
// Screens: earnings (Stripe + GoCardless fee drill-down, see
// FRONTEND_PLATFORM_FEES_GUIDE.md), revenue (monthly platform fees + tracker
// invoices, see FRONTEND_GCL_MONITOR_GUIDE.md §4). Read-only feature.
//
// Access: ToAviate staff only — the backend is authoritative, this mirrors
// TrackerAdminController's client-side bounce.
app.controller('PlatformEarningsController', PlatformEarningsController);
    PlatformEarningsController.$inject = ['GclMonitorService', 'ClubService', 'ToastService', '$rootScope', '$state', '$location'];
    function PlatformEarningsController(GclMonitorService, ClubService, ToastService, $rootScope, $state, $location) {
        var vm = this;
        vm.user = $rootScope.globals.currentUser;
        vm.is_toaviate_staff = !!(vm.user && vm.user.email && /@toaviate\.com$/i.test(vm.user.email));
        if (!vm.is_toaviate_staff) {
            $location.path('/dashboard');
            return;
        }

        vm.screen = $state.current.data.screen;
        vm.enums  = GclMonitorService.enums;
        vm.loading = false;

        // ── Sub-nav (shared partial views/manageclub/platform_earnings/_nav.html) ──
        vm.nav = [
            { screen: 'earnings', state: 'dashboard.super_admin.platform_earnings',         label: 'Earnings', icon: 'fa-coins' },
            { screen: 'revenue',  state: 'dashboard.super_admin.platform_earnings_revenue', label: 'Revenue',  icon: 'fa-chart-bar' }
        ];
        vm.go = function(state, params) { $state.go(state, params || {}); };

        // ── Shared helpers ────────────────────────────────────────────────
        vm.pretty = function(str) { return str ? String(str).replace(/_/g, ' ') : ''; };
        vm.cur = function(code) {
            if (code === 'GBP' || !code) { return '£'; }
            if (code === 'EUR') { return '€'; }
            if (code === 'USD') { return '$'; }
            return code + ' ';
        };
        vm.num = function(v) { return parseFloat(v) || 0; };

        function toastFail(title, data) {
            ToastService.error(title, (data && data.message) || 'Something went wrong. Please try again.');
        }
        // input[type=date] on Angular 1.4 needs Date objects, not strings
        function ymd(d) { return d ? moment(d).format('YYYY-MM-DD') : null; }

        init();
        function init() {
            switch (vm.screen) {
                case 'earnings': initEarnings(); break;
                case 'revenue':  initRevenue(); break;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // EARNINGS — Stripe + GoCardless fee drill-down (platform fees guide)
        // ══════════════════════════════════════════════════════════════════
        // Segment order inside a stacked bar, bottom → top. Sandbox/unknown
        // series only appear when the mode toggle is "All".
        var EARN_SERIES = [
            { key: 'live-gocardless',    cls: 'gc',           label: 'GoCardless' },
            { key: 'live-stripe',        cls: 'stripe',       label: 'Stripe' },
            { key: 'sandbox-gocardless', cls: 'gc-test',      label: 'GoCardless (test)' },
            { key: 'sandbox-stripe',     cls: 'stripe-test',  label: 'Stripe (test)' },
            { key: 'unknown-gocardless', cls: 'unknown',      label: 'GoCardless (unknown mode)' },
            { key: 'unknown-stripe',     cls: 'unknown',      label: 'Stripe (unknown mode)' }
        ];
        function initEarnings() {
            // Defaults per the guide: last 12 months, monthly, LIVE money only
            vm.f = {
                from: moment().subtract(11, 'months').startOf('month').toDate(),
                to: new Date(),
                granularity: 'month',
                mode: 'live',
                gateway: 'all',
                club_id: null
            };
            vm.preset = '12m';
            vm.clubs = [];
            ClubService.GetAll().then(function(data) {
                if (data && data.success === false) { return; }
                vm.clubs = (data && data.clubs) || [];
            });
            loadFees();
        }
        vm.presets = [
            { key: 'today', label: 'Today' },
            { key: 'week',  label: 'This week' },
            { key: 'month', label: 'This month' },
            { key: 'year',  label: 'This year' },
            { key: '12m',   label: 'Last 12 months' }
        ];
        vm.applyPreset = function(key) {
            vm.preset = key;
            switch (key) {
                case 'today':
                    vm.f.from = new Date(); vm.f.to = new Date(); vm.f.granularity = 'day'; break;
                case 'week':
                    vm.f.from = moment().startOf('isoWeek').toDate(); vm.f.to = new Date(); vm.f.granularity = 'day'; break;
                case 'month':
                    vm.f.from = moment().startOf('month').toDate(); vm.f.to = new Date(); vm.f.granularity = 'day'; break;
                case 'year':
                    vm.f.from = moment().startOf('year').toDate(); vm.f.to = new Date(); vm.f.granularity = 'month'; break;
                case '12m':
                    vm.f.from = moment().subtract(11, 'months').startOf('month').toDate(); vm.f.to = new Date(); vm.f.granularity = 'month'; break;
            }
            loadFees();
        };
        vm.setGranularity = function(g) { vm.f.granularity = g; vm.preset = 'custom'; loadFees(); };
        vm.setMode = function(m) { vm.f.mode = m; loadFees(); };
        vm.setGateway = function(g) { vm.f.gateway = g; loadFees(); };
        vm.customRangeChanged = function() { vm.preset = 'custom'; loadFees(); };
        vm.clubChanged = function() { loadFees(); };
        vm.clearClub = function() { vm.f.club_id = null; loadFees(); };
        vm.clubTitle = function() {
            for (var i = 0; i < (vm.clubs || []).length; i++) {
                if (vm.clubs[i].id == vm.f.club_id) { return vm.clubs[i].title; }
            }
            return vm.drilled_club_title || ('Club #' + vm.f.club_id);
        };
        function loadFees() {
            vm.loading = true;
            GclMonitorService.Fees({
                from: ymd(vm.f.from),
                to: ymd(vm.f.to),
                granularity: vm.f.granularity,
                club_id: vm.f.club_id,
                mode: vm.f.mode === 'all' ? null : vm.f.mode,
                gateway: vm.f.gateway === 'all' ? null : vm.f.gateway
            }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the earnings report', data); return; }
                vm.earnings = data;
                // Bind the controls to the RESOLVED filters the API echoes back
                var flt = data.filters || {};
                if (flt.granularity) { vm.f.granularity = flt.granularity; }
                if (flt.mode) { vm.f.mode = flt.mode; }
                if (flt.gateway) { vm.f.gateway = flt.gateway; }
                if (flt.from) { vm.f.from = moment(flt.from, 'YYYY-MM-DD').toDate(); }
                if (flt.to) { vm.f.to = moment(flt.to, 'YYYY-MM-DD').toDate(); }
                buildEarnings();
            });
        }
        // Headline money never mixes test traffic: with the toggle on "All"
        // the tiles show LIVE money and test/unknown appear as sub-lines.
        function tileMode() { return vm.f.mode === 'sandbox' ? 'sandbox' : 'live'; }
        function buildEarnings() {
            var rows = (vm.earnings && vm.earnings.summary) || [];
            var currencies = {};
            rows.forEach(function(r) { currencies[r.currency] = true; });
            vm.earn_currencies = Object.keys(currencies);
            vm.earn_tiles = vm.earn_currencies.map(function(c) {
                var t = { currency: c, fees: 0, gross: 0, refunded: 0, gateway_fees: 0, payments: 0,
                          pending: 0, lost: 0, test_fees: 0, unknown_fees: 0 };
                rows.forEach(function(r) {
                    if (r.currency !== c) { return; }
                    if (r.mode === tileMode()) {
                        if (r.fee_state === 'collected') {
                            t.fees += vm.num(r.platform_fees);
                            t.gross += vm.num(r.gross);
                            t.refunded += vm.num(r.refunded);
                            t.gateway_fees += vm.num(r.gateway_fees);
                            t.payments += (parseInt(r.payments, 10) || 0);
                        } else if (r.fee_state === 'pending') {
                            t.pending += vm.num(r.platform_fees);
                        } else {
                            t.lost += vm.num(r.platform_fees);
                        }
                    } else if (r.fee_state === 'collected' && r.mode === 'sandbox') {
                        t.test_fees += vm.num(r.platform_fees);
                    } else if (r.fee_state === 'collected' && r.mode === 'unknown') {
                        t.unknown_fees += vm.num(r.platform_fees);
                    }
                });
                return t;
            }).sort(function(a, b) { return b.fees - a.fees; });
            vm.earn_currency = vm.earn_tiles.length ? vm.earn_tiles[0].currency : null;
            buildModeHidden();
            buildEarnChart();
        }
        // "Empty because of the mode toggle" — mode_counts ignores the mode
        // filter, so when the current mode has nothing but other modes do,
        // explain it instead of rendering a wall of zeros (the normal state
        // on local/dev, where all traffic is sandbox).
        function buildModeHidden() {
            vm.mode_hidden = null;
            if (vm.earn_tiles.length || vm.f.mode === 'all') { return; }
            var others = ((vm.earnings && vm.earnings.mode_counts) || []).filter(function(r) {
                return r.mode !== vm.f.mode && (parseInt(r.payments, 10) || 0) > 0;
            });
            if (!others.length) { return; }
            var byMode = {};
            others.forEach(function(r) {
                byMode[r.mode] = (byMode[r.mode] || 0) + (parseInt(r.payments, 10) || 0);
            });
            var modeNames = { sandbox: 'sandbox', live: 'live', unknown: 'unknown-mode' };
            var parts = Object.keys(byMode).map(function(m) {
                return byMode[m] + ' ' + modeNames[m] + ' payment' + (byMode[m] === 1 ? '' : 's');
            });
            var filterName = vm.f.mode === 'live' ? 'Live' : 'Test';
            var target, targetLabel;
            if (vm.f.mode === 'live') {
                target = byMode.sandbox ? 'sandbox' : 'all';
                targetLabel = byMode.sandbox ? 'Show test mode' : 'Show all modes';
            } else {
                target = byMode.live ? 'live' : 'all';
                targetLabel = byMode.live ? 'Show live money' : 'Show all modes';
            }
            vm.mode_hidden = {
                message: 'No ' + vm.f.mode.replace('sandbox', 'test') + ' payments in this range — ' +
                         parts.join(' and ') + ' are hidden by the ' + filterName + ' filter.',
                target: target,
                targetLabel: targetLabel
            };
        }
        vm.showHiddenMode = function() {
            if (vm.mode_hidden) { vm.setMode(vm.mode_hidden.target); }
        };
        vm.setEarnCurrency = function(c) { vm.earn_currency = c; buildEarnChart(); };
        function buildEarnChart() {
            vm.earn_chart = [];
            vm.earn_legend = [];
            if (!vm.earn_currency || !vm.earnings) { return; }
            var periods = {};
            var present = {};
            ((vm.earnings.by_period) || []).forEach(function(r) {
                if (r.currency !== vm.earn_currency || r.fee_state !== 'collected') { return; }
                var key = r.mode + '-' + r.gateway;
                periods[r.period] = periods[r.period] || {};
                periods[r.period][key] = (periods[r.period][key] || 0) + vm.num(r.platform_fees);
                present[key] = true;
            });
            var keys = Object.keys(periods).sort();
            var max = 0;
            keys.forEach(function(p) {
                var total = 0;
                EARN_SERIES.forEach(function(s) { total += (periods[p][s.key] || 0); });
                periods[p].__total = total;
                max = Math.max(max, total);
            });
            vm.earn_chart = keys.map(function(p, i) {
                var segs = [];
                // DOM renders top-first, so walk the series bottom-up in reverse
                for (var s = EARN_SERIES.length - 1; s >= 0; s--) {
                    var val = periods[p][EARN_SERIES[s].key] || 0;
                    if (!val) { continue; }
                    segs.push({
                        cls: EARN_SERIES[s].cls,
                        label: EARN_SERIES[s].label,
                        val: val,
                        pct: max ? (val / max * 100) : 0
                    });
                }
                return {
                    period: p,
                    label: periodLabel(p),
                    total: periods[p].__total,
                    segs: segs,
                    delay: i * 35,
                    tip: segs.slice().reverse().map(function(sg) {
                        return sg.label + ' ' + vm.cur(vm.earn_currency) + sg.val.toFixed(2);
                    }).join(' · ')
                };
            });
            vm.earn_legend = EARN_SERIES.filter(function(s) { return present[s.key]; });
            // Dedupe the two unknown-gateway rows into one legend swatch
            vm.earn_legend = vm.earn_legend.filter(function(s, i) {
                return vm.earn_legend.map(function(x) { return x.cls; }).indexOf(s.cls) === i;
            });
        }
        function periodLabel(p) {
            switch (vm.f.granularity) {
                case 'day':   return moment(p, 'YYYY-MM-DD').format('D MMM');
                case 'week':  return p.replace(/^\d{4}-/, '') + ' ’' + p.slice(2, 4);
                case 'year':  return p;
                default:      return moment(p, 'YYYY-MM').format('MMM YY');
            }
        }
        // Click a bar → zoom the range to that period, one granularity finer
        vm.drillPeriod = function(c) {
            var finer = { year: 'month', month: 'week', week: 'day' }[vm.f.granularity];
            if (!finer) { return; }
            var m;
            var unit = vm.f.granularity === 'week' ? 'isoWeek' : vm.f.granularity;
            if (vm.f.granularity === 'year') { m = moment(c.period, 'YYYY'); }
            else if (vm.f.granularity === 'month') { m = moment(c.period, 'YYYY-MM'); }
            else { m = moment(c.period, 'GGGG-[W]WW'); }
            if (!m.isValid()) { return; }
            vm.f.from = moment(m).startOf(unit).toDate();
            vm.f.to = moment(m).endOf(unit).toDate();
            vm.f.granularity = finer;
            vm.preset = 'custom';
            loadFees();
        };
        vm.earnClubs = function() {
            var rows = (vm.earnings && vm.earnings.by_club) || [];
            return rows.filter(function(r) { return r.currency === vm.earn_currency; });
        };
        vm.drillClub = function(r) {
            vm.f.club_id = r.club_id;
            vm.drilled_club_title = r.club_title;
            loadFees();
        };
        vm.modeBadge = function(mode) {
            if (mode === 'live') { return 'trk-badge--green'; }
            if (mode === 'sandbox') { return 'trk-badge--amber'; }
            return 'trk-badge--grey';
        };

        // ── "Sync GoCardless fees" (§5) — import costs from the payout API.
        // The run is time-budgeted (~20s) and resumable: keep calling while
        // complete:false, accumulating the counters, then refetch the data.
        vm.syncFees = function() {
            if (vm.syncing) { return; }
            vm.syncing = true;
            vm.sync_progress = 'Syncing…';
            var acc = { payouts: 0, already: 0, archived: 0, gateway_fees: 0,
                        app_fees: 0, settled: 0, errors: [] };
            syncStep(acc);
        };
        function syncStep(acc) {
            var payload = {};
            if (vm.f.club_id) { payload.club_id = parseInt(vm.f.club_id, 10); }
            GclMonitorService.FeeSync(payload).then(function(data) {
                if (data && data.success === false) {
                    vm.syncing = false;
                    vm.sync_progress = null;
                    toastFail('Fee sync failed', data);
                    return;
                }
                acc.payouts += (parseInt(data.payouts_synced, 10) || 0);
                acc.already += (parseInt(data.payouts_already_synced, 10) || 0);
                acc.archived += (parseInt(data.payouts_archived, 10) || 0);
                acc.gateway_fees += (parseFloat(data.gateway_fees_recorded) || 0);
                acc.app_fees += (parseInt(data.app_fees_backfilled, 10) || 0);
                acc.settled += (parseInt(data.statuses_settled, 10) || 0);
                acc.errors = acc.errors.concat(data.errors || []);
                if (!data.complete) {
                    vm.sync_progress = 'Syncing… ' + acc.payouts + ' payout' + (acc.payouts === 1 ? '' : 's') + ' done';
                    syncStep(acc);
                    return;
                }
                vm.syncing = false;
                vm.sync_progress = null;
                var detail = '£' + acc.gateway_fees.toFixed(2) + ' gateway fees recorded, ' +
                             acc.app_fees + ' historical platform fee' + (acc.app_fees === 1 ? '' : 's') + ' recovered, ' +
                             acc.settled + ' stuck payment status' + (acc.settled === 1 ? '' : 'es') + ' settled.';
                if (acc.archived) {
                    detail += ' ' + acc.archived + ' payout' + (acc.archived === 1 ? '' : 's') +
                              ' are archived by GoCardless (older than ~6 months) and could not be fetched.';
                }
                ToastService.success('Synced ' + acc.payouts + ' payout' + (acc.payouts === 1 ? '' : 's'), detail);
                if (acc.errors.length) {
                    ToastService.warning('Some clubs failed to sync', acc.errors.map(function(e) {
                        return 'Club ' + e.club_id + ': ' + e.error;
                    }).join(' · '));
                }
                loadFees();
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // REVENUE — app fees + tracker invoices, always per-currency
        // ══════════════════════════════════════════════════════════════════
        function initRevenue() {
            vm.from = moment().subtract(11, 'months').startOf('month').toDate();
            vm.to = new Date();
            loadRevenue();
        }
        vm.applyRange = function() { loadRevenue(); };
        function loadRevenue() {
            vm.loading = true;
            GclMonitorService.Revenue({ from: ymd(vm.from), to: ymd(vm.to) }).then(function(data) {
                vm.loading = false;
                if (data && data.success === false) { toastFail('Could not load the revenue report', data); return; }
                vm.revenue = data;
                buildRevenueSummary();
            });
        }
        // NEVER sum across currencies — one tile row / chart per currency.
        function buildRevenueSummary() {
            var pf = (vm.revenue && vm.revenue.platform_fees) || {};
            var tr = (vm.revenue && vm.revenue.tracker_revenue) || {};
            var currencies = {};
            (pf.totals || []).forEach(function(r) { currencies[r.currency] = true; });
            (tr.totals || []).forEach(function(r) { currencies[r.currency] = true; });
            vm.currencies = Object.keys(currencies).sort();
            vm.summaries = vm.currencies.map(function(c) {
                var sums = { collected: 0, pending: 0, lost: 0, payments: 0 };
                (pf.totals || []).forEach(function(r) {
                    if (r.currency !== c) { return; }
                    var state = sums.hasOwnProperty(r.fee_state) ? r.fee_state : 'lost';
                    sums[state] += vm.num(r.fees);
                    if (r.fee_state === 'collected') { sums.payments += (parseInt(r.payments, 10) || 0); }
                });
                var tracker = { revenue: 0, invoices: 0 };
                (tr.totals || []).forEach(function(r) {
                    if (r.currency !== c) { return; }
                    tracker.revenue += vm.num(r.revenue);
                    tracker.invoices += (parseInt(r.invoices, 10) || 0);
                });
                return { currency: c, fees: sums, tracker: tracker };
            });
            // Biggest currency first — it also becomes the chart/table default
            vm.summaries.sort(function(a, b) {
                return (b.fees.collected + b.tracker.revenue) - (a.fees.collected + a.tracker.revenue);
            });
            vm.chartCurrency = vm.summaries.length ? vm.summaries[0].currency : null;
            buildChart();
        }
        vm.setChartCurrency = function(c) { vm.chartCurrency = c; buildChart(); };
        // Monthly stacked bars: collected platform fees + tracker revenue,
        // sized against the biggest month so the shape reads instantly.
        function buildChart() {
            vm.chart = [];
            if (!vm.chartCurrency || !vm.revenue) { return; }
            var pf = vm.revenue.platform_fees || {};
            var tr = vm.revenue.tracker_revenue || {};
            var months = {};
            (pf.by_month || []).forEach(function(r) {
                if (r.currency !== vm.chartCurrency || r.fee_state !== 'collected') { return; }
                months[r.month] = months[r.month] || { fees: 0, tracker: 0 };
                months[r.month].fees += vm.num(r.fees);
            });
            (tr.by_month || []).forEach(function(r) {
                if (r.currency !== vm.chartCurrency) { return; }
                months[r.month] = months[r.month] || { fees: 0, tracker: 0 };
                months[r.month].tracker += vm.num(r.revenue);
            });
            var keys = Object.keys(months).sort();
            var max = 0;
            keys.forEach(function(m) { max = Math.max(max, months[m].fees + months[m].tracker); });
            vm.chart = keys.map(function(m, i) {
                return {
                    month: m,
                    label: moment(m, 'YYYY-MM').format('MMM YY'),
                    fees: months[m].fees,
                    tracker: months[m].tracker,
                    feesPct: max ? (months[m].fees / max * 100) : 0,
                    trackerPct: max ? (months[m].tracker / max * 100) : 0,
                    delay: i * 40
                };
            });
        }
        vm.byClub = function() {
            var rows = ((vm.revenue || {}).platform_fees || {}).by_club || [];
            return rows.filter(function(r) { return !vm.chartCurrency || r.currency === vm.chartCurrency; });
        };
        vm.byMethod = function() {
            var rows = ((vm.revenue || {}).platform_fees || {}).by_method || [];
            return rows.filter(function(r) { return !vm.chartCurrency || r.currency === vm.chartCurrency; });
        };
    }
