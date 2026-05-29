/**
 * Maintenance / Certificate / ARC — Date-only Timezone Regression Tests
 *
 * Verifies that date-only fields surfaced in the maintenance, certificate
 * and ARC payload builders are sent to the backend as plain YYYY-MM-DD
 * strings rather than UTC ISO timestamps, for users in *both* negative
 * and positive UTC offsets.
 *
 * The historical bug:
 *   - <input type="date"> binds a JS Date at LOCAL midnight.
 *   - JSON.stringify(date) -> date.toISOString() -> UTC.
 *   - For a user in UTC+10 picking 2026-08-10, the payload became
 *     "2026-08-09T14:00:00.000Z" and the DB stored 2026-08-09. Bad.
 *
 * The fix:
 *   Every date-only field is normalised with `toDateOnly()` (moment local
 *   format) before the payload leaves the browser. This test reproduces
 *   that helper and exercises it against simulated picker values in
 *   several timezones.
 *
 * Run: node tests/maintenance-dates-timezone-test.js
 *
 * NOTE: Node's Date uses the host TZ; we cannot truly switch TZ at runtime
 * without a child_process. Instead we simulate "the picker handed us a
 * Date at LOCAL midnight of YYYY-MM-DD" by constructing such a Date via
 * `new Date(y, m, d)` and we simulate a different host offset by
 * constructing a Date whose underlying epoch reflects that offset.
 * `toDateOnly()` only uses LOCAL calendar fields, so it must always
 * return the day the user actually clicked.
 */

// Minimal moment.format('YYYY-MM-DD') shim — uses LOCAL fields, which is
// exactly the behaviour the production helper relies on. Keeps the test
// runnable without installing the moment npm package.
var moment = function (input) {
    var d;
    if (input instanceof Date) {
        d = new Date(input.getTime());
    } else if (typeof input === 'string') {
        // Treat bare YYYY-MM-DD as LOCAL midnight (avoids UTC parsing).
        var bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
        if (bare) {
            d = new Date(+bare[1], +bare[2] - 1, +bare[3]);
        } else {
            d = new Date(input);
        }
    } else {
        d = new Date(input);
    }
    return {
        isValid: function () { return !isNaN(d.getTime()); },
        format: function (fmt) {
            if (fmt !== 'YYYY-MM-DD') throw new Error('shim only supports YYYY-MM-DD');
            var y = d.getFullYear();
            var m = d.getMonth() + 1;
            var dd = d.getDate();
            return y + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
        }
    };
};

var passCount = 0;
var failCount = 0;

function assert(condition, name) {
    if (condition) {
        console.log('  PASS  ' + name);
        passCount++;
    } else {
        console.log('  FAIL  ' + name);
        failCount++;
    }
}

function section(name) {
    console.log('\n=== ' + name + ' ===');
}

// ─────────────────────────────────────────────────────────────
// Helper under test — kept in lock-step with the version inlined
// in dashboardClubMaintenanceController.js and dashboardClubPlanesController.js.
// ─────────────────────────────────────────────────────────────
function toDateOnly(value) {
    if (value === null || value === undefined || value === '') return value;
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        var m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
        if (m) return m[1];
    }
    var mom = moment(value);
    return mom.isValid() ? mom.format('YYYY-MM-DD') : value;
}

function localMidnightDate(y, m, d) {
    // m is 1-based here for readability.
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// ─────────────────────────────────────────────────────────────
// Child-process short-circuit. The parent re-invokes this script
// with --child under different TZ env vars; in that mode we emit
// a single JSON line and exit, without running the other suites.
// ─────────────────────────────────────────────────────────────
if (process.argv.indexOf('--child') !== -1) {
    var pickedChild = localMidnightDate(2026, 8, 10);
    process.stdout.write(JSON.stringify({
        tz: process.env.TZ,
        offsetMin: new Date(2026, 7, 10).getTimezoneOffset(),
        payload:   toDateOnly(pickedChild),
        legacyIso: pickedChild.toISOString()
    }));
    process.exit(0);
}

// ─────────────────────────────────────────────────────────────
// Simulated payload builders — mirror the structure of the real
// controllers (kept minimal: only the date-only fields).
// ─────────────────────────────────────────────────────────────
function buildMaintenancePayload(vmObj) {
    return {
        maintenance: {
            maintenance_type: vmObj.maintenance_type,
            expiry_date: toDateOnly(vmObj.next_check)
        },
        cert: {
            expiry: toDateOnly(vmObj.certificate_expiry),
            date_issued: toDateOnly(vmObj.certificate_issue)
        },
        radio: {
            expiry: toDateOnly(vmObj.radio_expiry)
        },
        insurance: {
            expiry: toDateOnly(vmObj.insurance_expiry)
        },
        noise_cert: {
            date_issued: toDateOnly(vmObj.noise_date)
        },
        offline: {
            offline_until: toDateOnly(vmObj.offline_until)
        }
    };
}

function buildArcPayload(vmObj) {
    // ARC is just maintenance_type === 'arc' carrying the same expiry_date,
    // plus the cert.date_issued used as the "date_issued" of the ARC.
    return {
        maintenance: {
            maintenance_type: 'arc',
            // ARC date_expiry
            expiry_date: toDateOnly(vmObj.next_check)
        },
        cert: {
            // ARC date_issued + ARC expiry doc
            expiry: toDateOnly(vmObj.certificate_expiry),
            date_issued: toDateOnly(vmObj.certificate_issue)
        }
    };
}

// ─────────────────────────────────────────────────────────────
// Simulate "the picker on the user's machine produced a Date at
// local midnight of <y, m, d>" but with the *host* running in an
// arbitrary UTC offset. We can't change Node's TZ here so we
// run the day-preserving assertion in the *current* TZ first, then
// re-spawn ourselves with TZ env overrides further below.
// ─────────────────────────────────────────────────────────────
function runPickerCases(label, cases) {
    section(label + ' — picker -> payload preserves day');
    cases.forEach(function (c) {
        var picked = localMidnightDate(c.y, c.m, c.d);
        var vmObj = {
            maintenance_type: 'arc',
            next_check:          picked,
            certificate_expiry:  picked,
            certificate_issue:   picked,
            radio_expiry:        picked,
            insurance_expiry:    picked,
            noise_date:          picked,
            offline_until:       picked
        };
        var payload = buildMaintenancePayload(vmObj);
        var arc     = buildArcPayload(vmObj);
        var expected = c.expected;

        assert(payload.maintenance.expiry_date === expected,
            label + ' maintenance.expiry_date === ' + expected +
            ' (got ' + payload.maintenance.expiry_date + ')');
        assert(payload.cert.expiry === expected,
            label + ' cert.expiry === ' + expected);
        assert(payload.cert.date_issued === expected,
            label + ' cert.date_issued === ' + expected);
        assert(payload.radio.expiry === expected,
            label + ' radio.expiry === ' + expected);
        assert(payload.insurance.expiry === expected,
            label + ' insurance.expiry === ' + expected);
        assert(payload.noise_cert.date_issued === expected,
            label + ' noise_cert.date_issued === ' + expected);
        assert(payload.offline.offline_until === expected,
            label + ' offline.offline_until === ' + expected);

        assert(arc.maintenance.expiry_date === expected,
            label + ' arc maintenance.expiry_date (date_expiry) === ' + expected);
        assert(arc.cert.date_issued === expected,
            label + ' arc cert.date_issued === ' + expected);

        // Guard against the historical bug: never an ISO timestamp.
        Object.keys(payload).forEach(function (k) {
            Object.keys(payload[k]).forEach(function (fk) {
                var v = payload[k][fk];
                if (typeof v === 'string') {
                    assert(v.indexOf('T') === -1 && v.indexOf('Z') === -1,
                        label + ' ' + k + '.' + fk + ' has no time/TZ component');
                }
            });
        });
    });
}

// ─────────────────────────────────────────────────────────────
// 1. Local picker -> payload (host TZ is whatever Node is running in).
//    The day the user selected must round-trip exactly.
// ─────────────────────────────────────────────────────────────
runPickerCases('host TZ ' + new Date().getTimezoneOffset() + 'min', [
    { y: 2026, m: 8,  d: 10, expected: '2026-08-10' },
    { y: 2026, m: 1,  d: 1,  expected: '2026-01-01' },
    { y: 2026, m: 12, d: 31, expected: '2026-12-31' },
    { y: 2026, m: 3,  d: 8,  expected: '2026-03-08' }, // US DST spring-forward
    { y: 2026, m: 11, d: 1,  expected: '2026-11-01' }  // US DST fall-back
]);

// ─────────────────────────────────────────────────────────────
// 2. Re-run inside a child_process where TZ is forced negative & positive,
//    to genuinely exercise users in different UTC offsets:
//       Pacific/Honolulu  -> UTC-10
//       America/New_York  -> UTC-5  (DST: -4)
//       UTC               -> UTC+0
//       Europe/London     -> UTC+0  (DST: +1)
//       Asia/Tokyo        -> UTC+9
//       Pacific/Kiritimati-> UTC+14
//
// The expectation in every TZ is the same: selecting 2026-08-10 in the
// UI must yield "2026-08-10" in the payload, and (per the test brief)
// the same string in the DB and on reload.
// ─────────────────────────────────────────────────────────────
section('Cross-timezone (positive & negative UTC offset) regression');

var child_process = require('child_process');
var path          = require('path');
var tzMatrix      = [
    'Pacific/Honolulu',     // UTC-10
    'America/New_York',     // UTC-5 / -4
    'UTC',
    'Europe/London',        // UTC+0 / +1
    'Asia/Tokyo',           // UTC+9
    'Pacific/Kiritimati'    // UTC+14
];

tzMatrix.forEach(function (tz) {
    var res = child_process.spawnSync(process.execPath, [
        path.resolve(__filename),
        '--child'
    ], {
        env: Object.assign({}, process.env, { TZ: tz })
    });
    if (res.status !== 0) {
        assert(false, tz + ' child runner exited ' + res.status);
        return;
    }
    var data;
    try { data = JSON.parse(res.stdout.toString()); }
    catch (e) { assert(false, tz + ' child JSON parse: ' + e.message); return; }

    assert(data.payload === '2026-08-10',
        tz + ' (offset ' + data.offsetMin + 'min) payload === 2026-08-10 (got '
        + data.payload + ')');

    // Confirm-the-fix witness: the LEGACY .toISOString() would have shifted
    // the day for at least one of these zones — proving the bug is real
    // and the new helper avoids it.
    var legacyDay = data.legacyIso.slice(0, 10);
    if (legacyDay !== '2026-08-10') {
        console.log('       (legacy ISO would have shipped ' + legacyDay
            + ' in ' + tz + ' — fix avoids this drift)');
    }
});

// ─────────────────────────────────────────────────────────────
// 3. "Reload from DB" round-trip: backend returns plain "2026-08-10"
//    -> picker hydrates Date -> save again -> still "2026-08-10".
// ─────────────────────────────────────────────────────────────
section('DB reload round-trip');

var dbStored = '2026-08-10';
// AngularJS <input type="date"> would parse the server string as a Date
// at LOCAL midnight.
var parts    = dbStored.split('-').map(Number);
var hydrated = localMidnightDate(parts[0], parts[1], parts[2]);
var resaved  = toDateOnly(hydrated);
assert(resaved === dbStored,
    'reloaded UI value re-saves as ' + dbStored + ' (got ' + resaved + ')');

// And if the backend ever sent the value as a full ISO timestamp, the
// helper must still extract the calendar date prefix.
var resavedFromIso = toDateOnly('2026-08-10T00:00:00.000Z');
assert(resavedFromIso === '2026-08-10',
    'ISO-suffixed server value normalises to 2026-08-10 (got ' + resavedFromIso + ')');

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount === 0 ? 0 : 1);
