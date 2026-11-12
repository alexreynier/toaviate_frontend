// ─────────────────────────────────────────────────────────────────────────
// Manage Club → Ops → Members → Import a list (rebuilt 2026-11-12).
//   dashboard.manage_club.import_members · views/manageclub/member_import.html · css/member-import.css (.mim-*)
//
// Three steps: choose the file → match the columns → check and send, then a result page.
// Sending makes each ticked row the club's INVITATION (POST members/import → Members::send_invite_by_club, the
// "Invite a member" form's own path; owner, 12 Nov: "a much better design"): the person gets the club's e-mail,
// chooses a password if they are new, sets up payment unless nothing is due, and only then is a member.
// Nobody is added to the club here and no account is created. POST members/import_check is the dry run.
//  - a row with an END date is "paid up until then": nothing to pay on accepting;
//  - a row whose membership would already be over (a start years ago, no end) cannot be sent: the page offers
//    "Start them today instead", keeping the old date as "member since";
//  - "member since" and the club's own membership number ride on the offer and reach the member row at acceptance.
// History: the old import (inside DashboardClubMembersController) replaced every address with a1@toaviate.com (a
// test flag left on) and sent a tier VERSION id where the API wants the tier (memberships.id).
// ─────────────────────────────────────────────────────────────────────────
app.controller('MemberImportController', MemberImportController);

MemberImportController.$inject = ['$rootScope', '$scope', '$q', '$timeout', '$state', 'MemberService', 'MembershipService', 'ToastService'];
function MemberImportController($rootScope, $scope, $q, $timeout, $state, MemberService, MembershipService, ToastService) {
    var vm = this;

    var MAX_BYTES = 2 * 1024 * 1024;
    var MAX_ROWS = 1000;
    var CHECK_BATCH = 200;
    var IMPORT_BATCH = 20;
    var PAGE = 50;
    var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    vm.club_id = $rootScope.globals.currentUser.current_club_admin.id;
    vm.club_title = $rootScope.globals.currentUser.current_club_admin.title || 'your club';

    // what a column of the file can be
    vm.FIELDS = [
        { k: 'first_name',       label: 'First name' },
        { k: 'last_name',        label: 'Last name' },
        { k: 'full_name',        label: 'Full name (first and last together)' },
        { k: 'email',            label: 'Email' },
        { k: 'tier',              label: 'Membership type' },
        { k: 'membership_number', label: 'Membership number (your club’s own)' },
        { k: 'membership_start',  label: 'This membership period starts' },
        { k: 'membership_ends',   label: 'Paid up to (membership ends or renews)' },
        { k: 'member_since',      label: 'Member since (the day they first joined)' }
    ];
    var DATE_FIELDS = ['membership_start', 'membership_ends', 'member_since'];
    var GUESS = [
        ['email',            /e-?mail/],
        ['first_name',       /first|forename|given|christian/],
        ['last_name',        /last|surname|family/],
        ['full_name',        /^name$|full.?name|member.?name|^member$/],
        ['member_since',     /since|joined|join.?date|date.?joined|enrol/],
        ['membership_ends',  /end|expir|until|renew|valid.?to|paid/],
        ['membership_start', /start|valid.?from|from|commence/],
        ['membership_number', /(member|membership).{0,3}(no\b|no\.|num|number|#|id\b|ref)|^(no\.?|number|ref)$/],
        ['tier',             /membership|type|categor|tier|class|plan/]
    ];

    vm.step = 1;              // 1 file · 2 columns · 3 check · 4 result
    vm.fileError = '';
    vm.fileName = '';
    vm.reading = false;
    vm.raw = [];              // every row of the file (arrays of cells)
    vm.hasHeader = true;
    vm.cols = [];             // { i, name, sample, field }
    vm.tiers = [];
    vm.tiersLoading = true;
    vm.defaultTier = null;
    vm.dateOrder = 'dmy';
    vm.dateOrderSet = false;  // true once the admin chose it
    vm.rows = [];
    vm.list = [];
    vm.filter = 'all';
    vm.shown = PAGE;
    vm.counts = { ready: 0, lapsed: 0, bad: 0, member: 0, off: 0, done: 0, total: 0 };
    vm.checking = false;
    vm.checkFailed = false;
    vm.importing = null;      // { done, total }
    vm.result = null;
    vm.today = ymdOf(new Date());
    var EXAMPLE = 'First name,Last name,Email,Membership type,Membership number,Period starts,Paid up to,Member since\r\n' +
        'Amelia,Stone,amelia.stone@example.com,Flying member,1987/114,01/04/2026,01/04/2027,14/09/2019\r\n' +
        'Raj,Mehta,raj.mehta@example.com,Flying member,2023/031,,,03/03/2023\r\n';

    var builtFor = '';        // the mapping the rows were built from

    MembershipService.GetAllByClub(vm.club_id).then(function (data) {
        vm.tiersLoading = false;
        var list = angular.isArray(data) ? data : [];
        vm.tiers = list.map(function (t) {
            return {
                id: parseInt(t.membership_id, 10),           // the TIER (memberships.id) — t.id is the version
                name: t.membership_name || 'Membership',
                term: t.payment_term,
                free: t.payment_term === 'free' || !(parseFloat(t.price) > 0),
                label: (t.membership_name || 'Membership') + priceText(t)
            };
        }).filter(function (t) { return t.id > 0; });
        if (vm.tiers.length === 1) { vm.defaultTier = vm.tiers[0].id; }
        if (!vm.tiers.length && data && data.success === false) { vm.tiersError = true; }
    });

    // ── small helpers ────────────────────────────────────────────────────
    function priceText(t) {
        var price = parseFloat(t.price);
        if (t.payment_term === 'free' || !(price > 0)) { return ' · free'; }
        var per = { daily: ' a day', monthly: ' a month', quarterly: ' a quarter', annually: ' a year', once: ' once' }[t.payment_term] || '';
        var cur = { GBP: '£', EUR: '€', USD: '$' }[(t.currency || 'GBP').toUpperCase()] || ((t.currency || '') + ' ');
        return ' · ' + cur + (price % 1 ? price.toFixed(2) : price) + per;
    }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function ymdOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function ymd(y, m, d) {
        var dt = new Date(y, m - 1, d);
        return (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) ? y + '-' + pad(m) + '-' + pad(d) : false;
    }
    function fullYear(y) {
        if (y >= 100) { return y; }
        return y <= (new Date().getFullYear() % 100) + 10 ? 2000 + y : 1900 + y;
    }
    vm.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
    vm.fDate = function (s) {
        if (!s) { return ''; }
        var p = String(s).split('-');
        return parseInt(p[2], 10) + ' ' + MONTH_NAMES[parseInt(p[1], 10) - 1].slice(0, 3) + ' ' + p[0];
    };
    vm.fieldLabel = function (k) {
        for (var i = 0; i < vm.FIELDS.length; i++) { if (vm.FIELDS[i].k === k) { return vm.FIELDS[i].label; } }
        return '';
    };
    vm.tierOf = function (id) {
        for (var i = 0; i < vm.tiers.length; i++) { if (vm.tiers[i].id === id) { return vm.tiers[i]; } }
        return null;
    };

    // A date as typed in a spreadsheet → 'YYYY-MM-DD' · null (empty) · false (not a date)
    function parseDate(value, order) {
        var s = String(value == null ? '' : value).trim();
        if (s === '') { return null; }
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
        if (m) { return ymd(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)); }
        m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?:\s.*)?$/);
        if (m) {
            var a = parseInt(m[1], 10), b = parseInt(m[2], 10), y = fullYear(parseInt(m[3], 10));
            return order === 'mdy' ? ymd(y, a, b) : ymd(y, b, a);
        }
        m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?[\s\-,]+(\d{4}|\d{2})$/);
        if (m && MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) > -1) {
            return ymd(fullYear(parseInt(m[3], 10)), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, parseInt(m[1], 10));
        }
        m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
        if (m && MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) > -1) {
            return ymd(parseInt(m[3], 10), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, parseInt(m[2], 10));
        }
        return false;
    }
    // start + one period of the tier, the API's rule (months keep the day, clamped to the month's end)
    function termEnd(start, term) {
        if (!start) { return null; }
        var p = start.split('-'), y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
        if (term === 'daily') { var nd = new Date(y, m - 1, d + 1); return ymdOf(nd); }
        if (term === 'once' || term === 'free') { return null; }      // lifetime
        var months = { monthly: 1, quarterly: 3, annually: 12 }[term] || 12;
        var total = (m - 1) + months, ny = y + Math.floor(total / 12), nm = (total % 12) + 1;
        var last = new Date(ny, nm, 0).getDate();
        return ny + '-' + pad(nm) + '-' + pad(Math.min(d, last));
    }
    function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }

    // ── step 1: the file ─────────────────────────────────────────────────
    vm.downloadExample = function () {
        var url = URL.createObjectURL(new Blob([EXAMPLE], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url; a.download = 'members-example.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        $timeout(function () { URL.revokeObjectURL(url); }, 1000);
    };
    vm.takeFile = function (file) {
        vm.fileError = '';
        if (!file) { return; }
        var name = String(file.name || '');
        if (/\.(xlsx|xls|numbers|ods)$/i.test(name)) {
            vm.fileError = '“' + name + '” is a spreadsheet file, not a CSV. Open it, choose File → Save as (or Export) → CSV, then choose the file it makes.';
            return;
        }
        if (file.size > MAX_BYTES) {
            vm.fileError = 'That file is too big for one import (over 2 MB). Split it into smaller files.';
            return;
        }
        vm.reading = true;
        var reader = new FileReader();
        reader.onerror = function () {
            $scope.$apply(function () { vm.reading = false; vm.fileError = 'That file could not be read. Please try again.'; });
        };
        reader.onload = function (e) {
            $scope.$apply(function () {
                vm.reading = false;
                var bytes = new Uint8Array(e.target.result);
                if (bytes.length > 1 && bytes[0] === 0x50 && bytes[1] === 0x4B) {
                    vm.fileError = '“' + name + '” is a spreadsheet file, not a CSV. Open it, choose File → Save as (or Export) → CSV, then choose the file it makes.';
                    return;
                }
                useText(decode(bytes), name);
            });
        };
        reader.readAsArrayBuffer(file);
    };

    // UTF-8, else the Windows encoding Excel uses for "CSV" (accents in names survive both)
    function decode(bytes) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (e) {
            try { return new TextDecoder('windows-1252').decode(bytes); } catch (e2) { return new TextDecoder().decode(bytes); }
        }
    }

    function guessDelimiter(text) {
        var line = text.split(/\r\n|\n|\r/)[0] || '', best = ',', bestN = 0;
        [',', ';', '\t'].forEach(function (d) {
            var n = line.split(d).length - 1;
            if (n > bestN) { bestN = n; best = d; }
        });
        return best;
    }

    // RFC 4180-style: quoted cells may hold the delimiter, line breaks and "" for a quote
    function parseCsv(text) {
        text = text.replace(/^\uFEFF/, '');
        var delim = guessDelimiter(text), rows = [], row = [], cell = '', quoted = false, i = 0, c;
        while (i < text.length) {
            c = text.charAt(i);
            if (quoted) {
                if (c === '"') {
                    if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; }
                    quoted = false; i++; continue;
                }
                cell += c; i++; continue;
            }
            if (c === '"' && cell.trim() === '') { quoted = true; cell = ''; i++; continue; }
            if (c === delim) { row.push(cell); cell = ''; i++; continue; }
            if (c === '\r') { if (text.charAt(i + 1) !== '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } i++; continue; }
            if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
            cell += c; i++;
        }
        if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
        return rows.map(function (r) { return r.map(function (x) { return String(x).trim(); }); })
            .filter(function (r) { return r.some(function (x) { return x !== ''; }); });
    }

    function useText(text, name) {
        var rows = parseCsv(text);
        if (rows.length === 0) { vm.fileError = 'That file is empty.'; return; }
        var first = rows[0];
        var headerLooksLikePerson = first.some(function (x) { return validEmail(x); });
        if (rows.length === 1 && !headerLooksLikePerson) { vm.fileError = 'That file has a heading row and nobody under it.'; return; }
        if (rows.length - 1 > MAX_ROWS) {
            vm.fileError = 'That file has ' + (rows.length - 1) + ' rows. One import takes up to ' + MAX_ROWS + ': split it into smaller files.';
            return;
        }
        vm.fileName = name;
        vm.raw = rows;
        vm.hasHeader = !headerLooksLikePerson;
        vm.dateOrderSet = false;
        vm.rows = []; vm.list = []; vm.result = null; builtFor = '';
        buildCols();
        vm.step = 2;
        toTop();
    }

    vm.people = function () { return vm.hasHeader ? vm.raw.slice(1) : vm.raw; };

    function buildCols() {
        var width = 0, people = vm.people();
        vm.raw.forEach(function (r) { width = Math.max(width, r.length); });
        var used = {};
        vm.cols = [];
        for (var i = 0; i < width; i++) {
            var name = vm.hasHeader ? (vm.raw[0][i] || '') : '';
            var sample = '';
            for (var j = 0; j < people.length && j < 25 && sample === ''; j++) { sample = people[j][i] || ''; }
            var field = '';
            if (name) {
                var key = name.toLowerCase();
                for (var g = 0; g < GUESS.length && !field; g++) {
                    if (GUESS[g][1].test(key) && !used[GUESS[g][0]]) { field = GUESS[g][0]; }
                }
            } else if (!used.email && validEmail(sample)) {
                field = 'email';
            }
            if (field) { used[field] = true; }
            vm.cols.push({ i: i, name: name || ('Column ' + (i + 1)), sample: sample, field: field });
        }
    }
    vm.headerChanged = function () { buildCols(); builtFor = ''; };

    vm.startOver = function () {
        vm.step = 1; vm.raw = []; vm.cols = []; vm.rows = []; vm.list = []; vm.fileName = ''; vm.fileError = ''; vm.result = null; builtFor = '';
        toTop();
    };

    // ── step 2: the columns ──────────────────────────────────────────────
    vm.colOf = function (field) {
        for (var i = 0; i < vm.cols.length; i++) { if (vm.cols[i].field === field) { return vm.cols[i]; } }
        return null;
    };
    // one column per field: choosing a field another column has takes it from that column
    vm.mapChanged = function (col) {
        if (!col.field) { return; }
        vm.cols.forEach(function (c) { if (c !== col && c.field === col.field) { c.field = ''; } });
    };
    vm.hasDates = function () {
        return DATE_FIELDS.some(function (f) { return !!vm.colOf(f); });
    };
    vm.mapProblems = function () {
        var out = [];
        if (!vm.colOf('email')) { out.push('Choose which column holds the email address.'); }
        if (!vm.colOf('full_name') && !(vm.colOf('first_name') && vm.colOf('last_name'))) {
            out.push('Choose the first name and last name columns (or one “Full name” column).');
        }
        if (!vm.defaultTier && vm.tiers.length) {
            out.push(vm.colOf('tier') ? 'Choose the membership for anyone whose row doesn’t name one of yours.' : 'Choose the membership these people are on.');
        }
        return out;
    };
    // the order a 03/04/2024 is read in: month first only when the file proves it and nothing says otherwise
    function detectOrder() {
        var dmy = false, mdy = false, people = vm.people();
        DATE_FIELDS.forEach(function (f) {
            var col = vm.colOf(f);
            if (!col) { return; }
            people.forEach(function (r) {
                var m = String(r[col.i] || '').match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]\d{2,4}/);
                if (!m) { return; }
                if (parseInt(m[1], 10) > 12) { dmy = true; }
                if (parseInt(m[2], 10) > 12) { mdy = true; }
            });
        });
        return (mdy && !dmy) ? 'mdy' : 'dmy';
    }
    vm.setOrder = function (o) { vm.dateOrder = o; vm.dateOrderSet = true; };
    vm.orderExample = function () { return vm.dateOrder === 'mdy' ? '3 April 2026' : '4 March 2026'; };
    $scope.$watch(function () { return vm.cols.map(function (c) { return c.field; }).join('|') + (vm.hasHeader ? 1 : 0); }, function () {
        if (!vm.dateOrderSet && vm.raw.length) { vm.dateOrder = detectOrder(); }
    });

    vm.toCheck = function () {
        if (vm.mapProblems().length) { return; }
        var sig = vm.cols.map(function (c) { return c.field; }).join('|') + '/' + vm.dateOrder + '/' + (vm.hasHeader ? 1 : 0) + '/' + vm.fileName;
        if (sig !== builtFor) {
            buildRows();
            builtFor = sig;
        } else {
            vm.rows.forEach(function (r) { if (!r.tierOwn) { r.tier = vm.defaultTier; } judge(r); });
        }
        vm.filter = 'all'; vm.shown = PAGE;
        vm.step = 3;
        refresh();
        runCheck();
        toTop();
    };

    // ── step 3: the rows ─────────────────────────────────────────────────
    function cell(raw, field) {
        var col = vm.colOf(field);
        return col ? (raw[col.i] || '') : '';
    }
    function splitName(full) {
        full = full.replace(/\s+/g, ' ').trim();
        if (full.indexOf(',') > -1) {                               // "Stone, Amelia"
            var p = full.split(',');
            return [p.slice(1).join(',').trim(), p[0].trim()];
        }
        var i = full.lastIndexOf(' ');
        return i < 0 ? [full, ''] : [full.slice(0, i), full.slice(i + 1)];
    }
    function tierByName(text) {
        var key = text.toLowerCase().replace(/\s+/g, ' ').trim();
        for (var i = 0; i < vm.tiers.length; i++) {
            if (vm.tiers[i].name.toLowerCase().replace(/\s+/g, ' ').trim() === key) { return vm.tiers[i]; }
        }
        return null;
    }

    function buildRows() {
        vm.rows = vm.people().map(function (raw, i) {
            var first = cell(raw, 'first_name'), last = cell(raw, 'last_name');
            if (vm.colOf('full_name') && !(first && last)) {
                var parts = splitName(cell(raw, 'full_name'));
                first = first || parts[0]; last = last || parts[1];
            }
            var tierText = cell(raw, 'tier'), named = tierText ? tierByName(tierText) : null;
            var r = {
                i: i, line: i + (vm.hasHeader ? 2 : 1),
                first: first, last: last, email: cell(raw, 'email').toLowerCase(),
                number: cell(raw, 'membership_number'),
                t: {                                                 // the dates as typed (editable)
                    start: cell(raw, 'membership_start'), end: cell(raw, 'membership_ends'),
                    since: cell(raw, 'member_since')
                },
                tier: named ? named.id : vm.defaultTier, tierOwn: !!named,
                tierMiss: (tierText && !named) ? tierText : '',
                on: true, check: null, done: null, serverError: '', editing: false
            };
            return r;
        });
        markDuplicates();
        vm.rows.forEach(judge);
    }

    function markDuplicates() {
        var seen = {};
        vm.rows.forEach(function (r) {
            r.dup = false;
            if (!r.email) { return; }
            if (seen[r.email]) { r.dup = seen[r.email]; } else { seen[r.email] = r.line; }
        });
    }

    // Decide where one row stands: r.d (the dates read), r.problems (it can't be sent), r.notes, r.pay, r.st
    function judge(r) {
        var problems = [], notes = [], d = {}, labels = { start: 'period start', end: 'paid-up-to date', since: 'member-since date' };
        ['start', 'end', 'since'].forEach(function (k) {
            d[k] = parseDate(r.t[k], vm.dateOrder);
            if (d[k] === false) { problems.push('“' + r.t[k] + '” isn’t a date we can read (' + labels[k] + ').'); d[k] = null; }
        });
        if (!r.email) { problems.push('No email address.'); }
        else if (!validEmail(r.email)) { problems.push('“' + r.email + '” isn’t an email address.'); }
        else if (r.dup) { problems.push('The same email as line ' + r.dup + ' of the file.'); }
        var known = r.check && r.check.has_account;
        if (!known && !(r.first && r.last)) { problems.push('Needs a first and a last name.'); }
        if (!r.tier) { problems.push('Choose a membership.'); }
        if (r.number && r.number.length > 50) { problems.push('The membership number is too long (50 characters at most).'); }
        var start = d.start || vm.today;
        if (d.end && d.end <= start) { problems.push('It ends (' + vm.fDate(d.end) + ') before it starts (' + vm.fDate(start) + ').'); }
        if (d.since && d.since > vm.today) { problems.push('“Member since” is in the future.'); }
        var tier = vm.tierOf(r.tier);
        var end = d.end || (tier ? termEnd(start, tier.term) : null);
        r.d = d; r.start = start; r.end = end;
        r.lifetime = !end && !!tier;
        r.lapsed = !!end && end <= vm.today;
        // what they pay when they accept (the API's rule: free, or paid up to the end date in the file)
        r.pay = !tier ? '' : tier.free ? 'Nothing to pay' : d.end ? 'Paid up: nothing to pay until ' + vm.fDate(d.end)
            : start > vm.today ? 'First payment on ' + vm.fDate(start) : 'Pays when they accept';
        if (r.serverError) { problems.push(r.serverError); }
        if (r.tierMiss && !r.tierOwn) { notes.push('“' + r.tierMiss + '” isn’t one of your membership types, so the one you chose for everyone is used.'); }
        if (r.check && r.check.invited && !r.check.offer_accepted) { notes.push('You have invited them before. That invitation is updated with these details and sent again.'); }
        r.problems = problems; r.notes = notes;
        var c = r.check || {};
        if (r.done) { r.st = r.done; }
        else if (c.already_member) { r.st = { k: 'member', tone: 'muted', text: 'Already a member', why: 'On your members list already. Nothing is sent to them.' }; }
        else if (c.asked_to_join) { r.st = { k: 'member', tone: 'info', text: 'Asked to join', why: 'They have asked to join themselves. Accept them under Members → Joining instead.' }; }
        else if (c.offer_accepted) { r.st = { k: 'member', tone: 'info', text: 'Already accepted', why: 'They accepted your earlier invitation. Finish it under Members → Joining.' }; }
        else if (problems.length) { r.st = { k: 'bad', tone: 'bad', text: 'Needs fixing' }; }
        else if (r.lapsed) { r.st = { k: 'lapsed', tone: 'warn', text: 'Already ended' }; }
        else { r.st = { k: 'ok', tone: 'good', text: 'Ready' }; }
        if (r.st.k === 'lapsed') {
            notes.push(d.end ? 'This membership ended on ' + vm.fDate(d.end) + ', so there is nothing to invite them to. Change the dates, or start them today.'
                : 'Starting on ' + vm.fDate(start) + ', one ' + periodWord(tier) + ' has already run out. If that is the day they joined, start them today and keep it as “member since”.');
        }
    }
    function periodWord(tier) {
        return tier ? ({ daily: 'day', monthly: 'month', quarterly: 'quarter', annually: 'year' }[tier.term] || 'period') : 'period';
    }

    vm.can = function (r) { return r.st.k === 'ok'; };
    vm.accountNote = function (r) {
        if (!r.check || r.st.k !== 'ok') { return ''; }
        return r.check.has_account ? 'Has a ToAviate account: accepts in My Account' : 'New to ToAviate: gets a sign-up link';
    };

    function refresh() {
        var c = { ready: 0, lapsed: 0, bad: 0, member: 0, off: 0, done: 0, total: vm.rows.length, send: 0 };
        vm.rows.forEach(function (r) {
            if (r.st.k === 'added') { c.done++; return; }
            if (r.st.k === 'member') { c.member++; return; }
            if (r.st.k === 'bad') { c.bad++; return; }
            if (r.st.k === 'lapsed') { c.lapsed++; return; }
            c.ready++;
            if (r.on) { c.send++; } else { c.off++; }
        });
        vm.counts = c;
        vm.list = vm.rows.filter(function (r) {
            if (vm.filter === 'all') { return true; }
            if (vm.filter === 'ready') { return r.st.k === 'ok'; }
            if (vm.filter === 'lapsed') { return r.st.k === 'lapsed'; }
            if (vm.filter === 'bad') { return r.st.k === 'bad'; }
            return r.st.k === 'member' || r.st.k === 'added';
        });
    }
    vm.refresh = refresh;
    vm.setFilter = function (f) { vm.filter = f; vm.shown = PAGE; refresh(); };
    vm.more = function () { vm.shown += PAGE; };
    vm.rowTier = function (r) { r.tierOwn = true; judge(r); refresh(); };
    vm.tickAll = function (on) { vm.rows.forEach(function (r) { if (vm.can(r)) { r.on = on; } }); refresh(); };

    // "Start them today instead": a start years ago + one period = a membership that has already ended
    vm.startLapsedToday = function () {
        vm.rows.forEach(function (r) {
            if (r.st.k !== 'lapsed') { return; }
            if (!r.d.since && r.d.start) { r.t.since = r.t.start; }   // keep the day they joined as "member since"
            r.t.start = ''; r.t.end = '';
            judge(r);
        });
        refresh();
    };

    vm.edit = function (r) {
        r.form = { first: r.first, last: r.last, email: r.email, number: r.number, start: r.t.start, end: r.t.end, since: r.t.since };
        r.editing = true;
    };
    vm.cancelEdit = function (r) { r.editing = false; r.form = null; };
    vm.saveEdit = function (r) {
        var f = r.form, emailChanged = String(f.email || '').trim().toLowerCase() !== r.email;
        r.first = String(f.first || '').trim(); r.last = String(f.last || '').trim();
        r.email = String(f.email || '').trim().toLowerCase();
        r.number = String(f.number || '').trim();
        r.t = { start: String(f.start || '').trim(), end: String(f.end || '').trim(), since: String(f.since || '').trim() };
        r.serverError = ''; r.editing = false; r.form = null;
        if (emailChanged) { r.check = null; }
        markDuplicates();
        vm.rows.forEach(judge);
        refresh();
        if (emailChanged && validEmail(r.email) && !r.dup) { runCheck([r]); }
    };

    function entryOf(r) {
        var e = { club_id: vm.club_id, membership_id: r.tier, membership_start: r.start,
            user: { email: r.email, first_name: r.first, last_name: r.last } };
        if (r.d.end) { e.membership_ends = r.d.end; }
        if (r.d.since) { e.member_since = r.d.since; }
        if (r.number) { e.membership_number = r.number; }
        return e;
    }

    // The dry run: who has an account, is a member already, has asked to join or was invited before. Nothing is written.
    function runCheck(only) {
        var rows = (only || vm.rows).filter(function (r) { return validEmail(r.email) && !r.dup && !r.check && !r.done; });
        if (!rows.length) { return; }
        vm.checking = true;
        if (!only) { vm.checkFailed = false; }
        var i = 0;
        function next() {
            if (i >= rows.length) { vm.checking = false; return $q.when(); }
            var batch = rows.slice(i, i + CHECK_BATCH);
            i += CHECK_BATCH;
            var body = batch.map(function (r) { return { club_id: vm.club_id, user: { email: r.email } }; });
            return MemberService.ImportCheck(body).then(function (data) {
                if (!data || data.success === false || !angular.isArray(data.results)) {
                    ToastService.handledInline();
                    vm.checkFailed = true; vm.checking = false;
                    return;
                }
                batch.forEach(function (r, k) { r.check = data.results[k] || null; judge(r); });
                refresh();
                return next();
            });
        }
        next();
    }

    // ── sending the invitations ──────────────────────────────────────────
    vm.startImport = function () {
        var rows = vm.rows.filter(function (r) { return vm.can(r) && r.on; });
        if (!rows.length || vm.importing) { return; }
        vm.importing = { done: 0, total: rows.length };
        var i = 0, tally = { invited: 0, again: 0, fresh: 0, existing: 0, failed: 0 };
        function next() {
            if (i >= rows.length) { return finish(); }
            var batch = rows.slice(i, i + IMPORT_BATCH);
            i += IMPORT_BATCH;
            return MemberService.Import(batch.map(entryOf)).then(function (data) {
                var results = (data && data.success !== false && angular.isArray(data.results)) ? data.results : null;
                if (!results) { ToastService.handledInline(); }
                batch.forEach(function (r, k) {
                    var res = results ? results[k] : null;
                    if (res && res.success && res.already_member) {
                        r.check = angular.extend({}, r.check, { has_account: true, already_member: true }); tally.existing++;
                    } else if (res && res.success && res.invited) {
                        r.done = { k: 'added', tone: 'good', text: res.reoffered ? 'Sent again' : 'Invited' };
                        tally.invited++;
                        if (res.reoffered) { tally.again++; }
                        if (!res.has_account) { tally.fresh++; }
                    } else if (res && res.error === 'REQUEST_PENDING') {
                        r.check = angular.extend({}, r.check, { asked_to_join: true }); tally.existing++;
                    } else if (res && res.error === 'OFFER_ALREADY_ACCEPTED') {
                        r.check = angular.extend({}, r.check, { invited: true, offer_accepted: true }); tally.existing++;
                    } else {
                        r.serverError = (res && typeof res.message === 'string' && res.message)
                            || (data && typeof data.message === 'string' && data.message)
                            || 'Not sent: the server did not answer. Try this row again.';
                        tally.failed++;
                    }
                    judge(r);
                });
                vm.importing.done = Math.min(i, rows.length);
                return next();
            });
        }
        function finish() {
            vm.importing = null;
            vm.result = tally;
            refresh();
            vm.step = 4;
            toTop();
        }
        next();
    };
    vm.progress = function () {
        return vm.importing ? Math.round(100 * vm.importing.done / Math.max(1, vm.importing.total)) + '%' : '0%';
    };
    vm.failedRows = function () { return vm.rows.filter(function (r) { return r.st.k === 'bad' && r.serverError; }); };
    vm.backToRows = function (filter) { vm.step = 3; vm.setFilter(filter || 'all'); toTop(); };
    vm.goJoining = function () { $state.go('dashboard.manage_club.member_requests'); };

    function toTop() {
        $timeout(function () {
            var el = document.getElementById('mim-top');
            if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start' }); }
            var head = document.getElementById('main_header2');
            window.scrollBy(0, -((head ? head.offsetHeight : 50) + 14));
        }, 0);
    }
}

// The drop zone: a <label> around a file input. Dropping or choosing a file hands it to mim-drop="fn(file)".
app.directive('mimDrop', ['$parse', function ($parse) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            var handler = $parse(attrs.mimDrop);
            var input = el[0].querySelector('input[type="file"]');
            function give(file) { scope.$apply(function () { handler(scope, { file: file }); }); }
            function over(e) { e.preventDefault(); el.addClass('ta-drop--over'); }
            function out() { el.removeClass('ta-drop--over'); }
            function drop(e) {
                e.preventDefault(); out();
                var files = e.dataTransfer && e.dataTransfer.files;
                if (files && files.length) { give(files[0]); }
            }
            function change() {
                if (input.files && input.files.length) { give(input.files[0]); }
                input.value = '';                                    // the same file can be chosen again
            }
            // native listeners: jQuery's event object has no dataTransfer
            var node = el[0];
            node.addEventListener('dragover', over); node.addEventListener('dragleave', out); node.addEventListener('drop', drop);
            if (input) { input.addEventListener('change', change); }
            scope.$on('$destroy', function () {
                node.removeEventListener('dragover', over); node.removeEventListener('dragleave', out); node.removeEventListener('drop', drop);
                if (input) { input.removeEventListener('change', change); }
            });
        }
    };
}]);
