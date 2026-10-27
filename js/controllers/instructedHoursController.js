// Hours instructed — every flight where the logged-in user was the instructor,
// split into dual instruction (aboard) and supervised solos (authorised, not
// aboard), over a date range with quick presets. Totals are computed here so
// the "include supervised solos" toggle is instant.
app.controller('InstructedHoursController', InstructedHoursController);
InstructedHoursController.$inject = ['$rootScope', '$filter', 'InstructorHoursService', 'ToastService'];
function InstructedHoursController($rootScope, $filter, InstructorHoursService, ToastService) {
    var vm = this;
    vm.user = $rootScope.globals.currentUser;

    vm.loading = false;
    vm.loaded = false;
    vm.flights = [];
    vm.include_solo = true;
    vm.preset = 'last30';
    vm.from_date = null;      // Date objects — input[type=date] needs real Dates
    vm.to_date = null;
    vm.totals = empty_totals();
    vm.months = [];
    vm.clubs = [];
    vm.students = [];
    vm.filter_club = null;

    vm.presets = build_presets();
    vm.use_preset = use_preset;
    vm.search = search;
    vm.toggle_solo = function(){ vm.include_solo = !vm.include_solo; recompute(); };
    vm.set_club = function(id){ vm.filter_club = (vm.filter_club === id) ? null : id; recompute(); };
    vm.kind_label = function(k){ return k === 'solo' ? 'Supervised solo' : (k === 'dual' ? 'Dual' : 'Other'); };
    vm.hours = function(h){ return hours_hm(h); };
    vm.shown_flights = function(){ return vm._shown || []; };

    use_preset('last30');

    // ── presets ──
    function build_presets(){
        var now = new Date();
        var y = now.getFullYear(), m = now.getMonth();
        var list = [
            { id: 'last30',  label: 'Last 30 days',  from: add_days(now, -30), to: now },
            { id: 'last90',  label: 'Last 90 days',  from: add_days(now, -90), to: now },
            { id: 'month',   label: month_name(y, m), from: new Date(y, m, 1), to: new Date(y, m + 1, 0) },
            { id: 'month-1', label: month_name(y, m - 1), from: new Date(y, m - 1, 1), to: new Date(y, m, 0) },
            { id: 'month-2', label: month_name(y, m - 2), from: new Date(y, m - 2, 1), to: new Date(y, m - 1, 0) },
            { id: 'year',    label: 'This year', from: new Date(y, 0, 1), to: now },
            { id: 'year-1',  label: String(y - 1), from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) },
            { id: 'custom',  label: 'Custom' }
        ];
        return list;
    }
    function use_preset(id){
        var p = null;
        for (var i = 0; i < vm.presets.length; i++) { if (vm.presets[i].id === id) { p = vm.presets[i]; } }
        vm.preset = id;
        if (!p || id === 'custom') { if (!vm.from_date) { vm.from_date = add_days(new Date(), -30); vm.to_date = new Date(); } return; }
        vm.from_date = new Date(p.from.getTime());
        vm.to_date = new Date(p.to.getTime());
        search();
    }
    function search(){
        if (!vm.from_date || !vm.to_date) { ToastService.warning('Dates', 'Pick both a from and a to date.'); return; }
        if (vm.from_date > vm.to_date) { ToastService.warning('Dates', 'The from date is after the to date.'); return; }
        vm.loading = true;
        InstructorHoursService.GetSummary(ymd(vm.from_date), ymd(vm.to_date)).then(function(data){
            vm.loading = false;
            vm.loaded = true;
            if (!data || !data.success) {
                vm.flights = [];
                recompute();
                ToastService.error('Could not load', (data && data.message && typeof data.message === 'string') ? data.message : 'Your instructed hours could not be loaded.');
                return;
            }
            vm.flights = angular.isArray(data.flights) ? data.flights : [];
            vm.clubs = angular.isArray(data.clubs) ? data.clubs : [];
            if (vm.filter_club && !vm.clubs.some(function(c){ return c.id == vm.filter_club; })) { vm.filter_club = null; }
            recompute();
        });
    }

    // ── totals (client-side so the toggle / club filter are instant) ──
    function recompute(){
        var shown = [], by_month = {}, students = {}, t = empty_totals();
        angular.forEach(vm.flights, function(f){
            if (f.kind === 'solo' && !vm.include_solo) { return; }
            if (vm.filter_club && f.club_id != vm.filter_club) { return; }
            shown.push(f);
            var h = num(f.hours), key = String(f.flight_date || '').slice(0, 7);
            if (!by_month[key]) { by_month[key] = { key: key, label: month_label(key), dual_hours: 0, solo_hours: 0, hours: 0, flights: 0 }; }
            var mo = by_month[key];
            mo.flights += 1; mo.hours += h; t.flights += 1; t.hours += h;
            t.landings += num(f.landings);
            if (f.kind === 'solo') { mo.solo_hours += h; t.solo_hours += h; t.solo_flights += 1; }
            else { mo.dual_hours += h; t.dual_hours += h; t.dual_flights += 1; }
            if (f.student_id) { students[f.student_id] = f.student_name || ('#' + f.student_id); }
        });
        t.students = Object.keys(students).length;
        vm.totals = t;
        vm.months = Object.keys(by_month).sort().reverse().map(function(k){ return by_month[k]; });
        vm._shown = shown;
    }

    function empty_totals(){ return { hours: 0, dual_hours: 0, solo_hours: 0, flights: 0, dual_flights: 0, solo_flights: 0, landings: 0, students: 0 }; }
    function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }
    function add_days(d, n){ var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
    function ymd(d){ return $filter('date')(d, 'yyyy-MM-dd'); }
    function month_name(y, m){ return $filter('date')(new Date(y, m, 1), 'MMMM'); }
    function month_label(key){ var p = key.split('-'); return p.length === 2 ? $filter('date')(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1), 'MMMM yyyy') : key; }
    // decimal hours → "H:MM"
    function hours_hm(h){ var n = num(h); var mins = Math.round(n * 60); return Math.floor(mins / 60) + ':' + ('0' + (mins % 60)).slice(-2); }
}
