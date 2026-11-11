/**
 * Manage Club → Maintenance — form logic unit tests
 *
 * Exercises js/services/maintenanceFormService.js (the pure logic behind
 * views/manageclub/maintenance_detail.html + dashboardClubMaintenanceController.js):
 *   - B1  the shared severity → tone map
 *   - decision 1  type-driven field visibility (checks vs annual vs extension)
 *   - U2  per-type placeholders, never pre-filled
 *   - U5 / U10  validation of the check, extension, offline and workpack modes
 *     (engineer confirmation enforced when a defect is ticked)
 *   - payload builders: local calendar dates (never toISOString), next_check_type
 *   - U4 / B9  the post-save state reset (mocked vm)
 *   - B13  the one combined outcome toast
 *   - U12 / B14  event filter chips for every type
 *   - U15 / B10 / B11  hours / status / date display helpers
 *
 * Run: node tests/club-maintenance-form-test.js
 */

var path = require('path');
var MF = require(path.join(__dirname, '..', 'js', 'services', 'maintenanceFormService.js'));

var passCount = 0, failCount = 0;
function assert(condition, name, detail) {
    if (condition) { console.log('  PASS  ' + name); passCount++; }
    else { console.log('  FAIL  ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); failCount++; }
}
function section(name) { console.log('\n=== ' + name + ' ==='); }
function d(y, m, day, h, min) { return new Date(y, m - 1, day, h || 0, min || 0, 0, 0); }

// ─────────────────────────────────────────────────────────────
section('B1 severity → tone map (stored sentences from defectReportPanel.js)');
assert(MF.severityTone('No Fly Item - Ground the plane') === 'nofly', 'No Fly sentence → nofly');
assert(MF.severityTone('Flyable - needs to be checked at next maintenance') === 'flyable', 'Flyable sentence → flyable');
assert(MF.severityTone('Not urgent - but needs noting') === 'noting', 'Not urgent sentence → noting');
assert(MF.severityTone('Unsure of severity') === 'unsure', 'Unsure sentence → unsure');
assert(MF.severityTone('high') === 'nofly' && MF.severityTone('low') === 'noting', 'legacy high / low still map');
assert(MF.severityTone(null) === 'unsure' && MF.severityTone('') === 'unsure', 'blank → unsure (never throws)');
assert(MF.severityBadgeClass('No Fly Item - Ground the plane') === 'snazzy-table__badge--danger', 'nofly → danger badge');
assert(MF.severityChipClass('Flyable - needs to be checked at next maintenance') === 'wp-severity-flyable', 'flyable → wp chip');
assert(MF.severityShort('Not urgent - but needs noting') === 'Not urgent', 'short label');

// ─────────────────────────────────────────────────────────────
section('decision 1: type-driven field visibility');
assert(MF.CHECK_TYPES.join(',') === 'annual,25hours,50hours,100hours,interim,6months', 'check types = backend whitelist (no workpack, no extension)');
var none = MF.fieldsFor('');
assert(!none.chosen && !none.check && !none.extension && !none.step_defects, 'no type → nothing shown');
var fifty = MF.fieldsFor('50hours');
assert(fifty.check && fifty.date && fifty.time && fifty.hours && fifty.next_check && fifty.next_check_type && fifty.checked_by && fifty.notes, '50 h → core fields incl. hours + next-check type');
assert(!fifty.step_hours && !fifty.step_workpack && !fifty.step_crs && !fifty.step_arc, '50 h → no annual-only steps');
assert(fifty.step_defects && fifty.step_logbooks, '50 h → resolve-defects + logbooks steps available');
['25hours', '100hours', 'interim', '6months'].forEach(function (t) {
    var f = MF.fieldsFor(t);
    assert(f.check && f.hours && !f.step_workpack, t + ' → same shape as 50 h');
});
var annual = MF.fieldsFor('annual');
assert(annual.check && annual.date && annual.time && annual.next_check && annual.next_check_type, 'annual → core fields');
assert(annual.hours && !annual.step_hours, 'annual → hours is a CORE field, not an optional step (batch 17: hours required for every check)');
assert(annual.step_workpack && annual.step_crs && annual.step_arc && annual.step_defects, 'annual → workpack / CRS / ARC / defects steps');
var ext = MF.fieldsFor('extension');
assert(ext.extension && ext.time && ext.checked_by && !ext.check && !ext.date && !ext.hours, 'extension → its own fields, not the check fields');
assert(ext.step_defects && !ext.step_logbooks && !ext.step_workpack, 'extension → defects step only');
assert(!MF.fieldsFor('workpack').chosen, 'workpack is not a selectable type');

section('U2 placeholders (never pre-filled)');
assert(MF.hoursPlaceholder('50hours') === 'e.g. 50' && MF.hoursPlaceholder('100hours') === 'e.g. 100' && MF.hoursPlaceholder('25hours') === 'e.g. 25', 'hour-based placeholders');
assert(/12 months/.test(MF.nextCheckHint('annual')), 'annual next-check hint says 12 months');
assert(/6 months/.test(MF.nextCheckHint('6months')), '6-month hint');
var fresh = MF.freshObj(d(2026, 11, 10, 14, 35));
assert(fresh.hours_remaining === undefined && fresh.next_check === undefined, 'fresh form: hours + next check blank');
assert(fresh.check_time instanceof Date && fresh.check_time.getHours() === 14 && fresh.check_time.getMinutes() === 35, 'fresh form: time defaults to now (decision 4)');
assert(MF.ymd(fresh.check_date) === '2026-11-10', 'fresh form: date defaults to today');
assert(fresh.maintenance_type === '' && fresh.next_check_type === '', 'fresh form: no type chosen');

// ─────────────────────────────────────────────────────────────
section('validateCheck');
var today = d(2026, 11, 10);
function okCheck(over) {
    var o = {
        maintenance_type: '50hours', check_date: d(2026, 11, 9), check_time: d(2026, 11, 9, 10, 30),
        hours_remaining: 50, next_check: d(2027, 5, 1), next_check_type: '100hours', checked_by: 'J. Smith', _today: today
    };
    for (var k in (over || {})) { o[k] = over[k]; }
    return o;
}
assert(MF.validateCheck(okCheck()).ok === true, 'a complete 50 h check passes');
assert(MF.validateCheck(okCheck({ maintenance_type: '' })).ok === false, 'type required');
assert(MF.validateCheck(okCheck({ maintenance_type: 'workpack' })).ok === false, 'workpack refused as a type');
assert(MF.validateCheck(okCheck({ check_date: null })).ok === false, 'date required');
var noTime = MF.validateCheck(okCheck({ check_time: null }));
assert(noTime.ok === false && /time/i.test(noTime.title), 'time required (decision 4)');
assert(MF.validateCheck(okCheck({ checked_by: '  ' })).ok === false, 'checked by required');
assert(MF.validateCheck(okCheck({ check_date: d(2026, 11, 11) })).ok === false, 'check date in the future refused');
assert(MF.validateCheck(okCheck({ hours_remaining: '' })).ok === false, '50 h: hours required');
assert(MF.validateCheck(okCheck({ hours_remaining: -2 })).ok === false, 'negative hours refused');
assert(MF.validateCheck(okCheck({ hours_remaining: 15689.3 })).ok === false, 'hours > 1000 refused (the 15689.3 tacho case)');
assert(MF.validateCheck(okCheck({ hours_remaining: '50.5' })).ok === true, 'string number accepted');
assert(MF.validateCheck(okCheck({ next_check: d(2026, 11, 1) })).ok === false, 'next check before the check refused');
assert(MF.validateCheck(okCheck({ next_check: undefined })).ok === true, '50 h: next-check date optional');
assert(MF.validateCheck(okCheck({ maintenance_type: 'annual', hours_remaining: undefined, next_check: undefined })).ok === false, 'annual: next-check date required');
var annualNoHours = MF.validateCheck(okCheck({ maintenance_type: 'annual', hours_remaining: undefined }));
assert(annualNoHours.ok === false && annualNoHours.title === 'Hours required', 'annual without hours REFUSED (batch 17: hours required for every check)');
assert(MF.validateCheck(okCheck({ maintenance_type: 'annual', hours_remaining: '' })).ok === false, 'annual with blank hours refused');
assert(MF.validateCheck(okCheck({ maintenance_type: 'annual', hours_remaining: 100 })).ok === true, 'annual with hours passes');
assert(/next check/.test(MF.hoursPlaceholder('annual')) && !/only if/.test(MF.hoursPlaceholder('annual')), 'annual placeholder no longer says "only if"');
assert(MF.validateCheck(okCheck({ next_check_type: 'extension' })).ok === false, 'next_check_type outside the whitelist refused');
assert(MF.validateCheck(okCheck({ next_check_type: '' })).ok === true, 'next_check_type optional');

section('U10 / B7 engineer confirmation enforced');
var defects = [{ id: 1, resolved: true }, { id: 2, resolved: false }];
var noConfirm = MF.validateCheck(okCheck({ issue_confirmation: false }), defects);
assert(noConfirm.ok === false && /confirm/i.test(noConfirm.title), 'ticked defect without confirmation refused');
assert(MF.validateCheck(okCheck({ issue_confirmation: true }), defects).ok === true, 'ticked defect with confirmation passes');
assert(MF.validateCheck(okCheck({ issue_confirmation: false }), [{ id: 2, resolved: false }]).ok === true, 'no ticked defect → no confirmation needed');
assert(MF.resolvedDefects(defects).length === 1 && MF.resolvedDefects(defects)[0].id === 1, 'resolvedDefects picks the ticked ones');

// ─────────────────────────────────────────────────────────────
section('validateExtension (U5 — used to always pass)');
function okExt(over) {
    var o = { extension_granted: d(2026, 11, 9), check_time: d(2026, 11, 9, 9, 0), extension_hours: 5, extension_days: d(2026, 12, 1), checked_by: 'J. Smith' };
    for (var k in (over || {})) { o[k] = over[k]; }
    return o;
}
assert(MF.validateExtension(okExt()).ok === true, 'complete extension passes');
assert(MF.validateExtension({}).ok === false, 'empty extension refused (used to pass: undefined !== "")');
assert(MF.validateExtension(okExt({ extension_hours: undefined, extension_days: undefined })).ok === false, 'neither hours nor until → refused');
assert(MF.validateExtension(okExt({ extension_hours: undefined })).ok === true, 'until only passes');
assert(MF.validateExtension(okExt({ extension_days: undefined })).ok === true, 'hours only passes');
assert(MF.validateExtension(okExt({ extension_hours: 0 })).ok === false, 'zero hours refused');
assert(MF.validateExtension(okExt({ extension_hours: 'abc' })).ok === false, 'non-numeric hours refused');
assert(MF.validateExtension(okExt({ check_time: null })).ok === false, 'time required');
assert(MF.validateExtension(okExt({ extension_days: d(2026, 11, 1) })).ok === false, 'until before granted refused');
assert(MF.validateExtension(okExt({ issue_confirmation: false }), defects).ok === false, 'ticked defect needs the confirmation here too');

section('validateOffline (U5 — used to always pass)');
assert(MF.validateOffline({}, today).ok === false, 'no date → refused (used to send offline_until: undefined)');
assert(MF.validateOffline({ offline_until: d(2026, 11, 9) }, today).ok === false, 'yesterday refused');
assert(MF.validateOffline({ offline_until: d(2026, 11, 10) }, today).ok === true, 'today passes');
assert(MF.validateOffline({ offline_until: '2026-11-20' }, today).ok === true, 'ISO string passes');
assert(MF.validateOffline({ offline_until: 'nonsense' }, today).ok === false, 'garbage refused');

section('validateWorkpack');
assert(MF.validateWorkpack({}).ok === false && MF.validateWorkpack({ workpack_number: 'WP-1' }).ok === true, 'workpack number required');

// ─────────────────────────────────────────────────────────────
section('payload builders (local calendar dates, next_check_type)');
var blk = MF.buildCheckBlock(okCheck({ notes: 'oil' }));
assert(blk.maintenance_type === '50hours' && blk.check_date === '2026-11-09 10:30:00', 'check_date carries the time, local');
assert(blk.expiry_date === '2027-05-01' && blk.next_check_type === '100hours', 'expiry_date local + next_check_type sent');
assert(blk.hours_remaining === 50 && blk.checked_by === 'J. Smith' && blk.description === 'oil', 'hours numeric, checked_by, description');
assert(!('workpack_id' in blk), 'no workpack_id unless linking an existing one');
var blk2 = MF.buildCheckBlock(okCheck({ hours_remaining: undefined, next_check: undefined, next_check_type: '', workpack_option: 'existing', workpack_id: '7' }));
assert(!('hours_remaining' in blk2) && blk2.expiry_date === null && blk2.next_check_type === null && blk2.workpack_id === 7, 'blank hours omitted, blanks null, workpack_id int');
var picked = d(2026, 8, 10); // local midnight; toISOString would shift this in UTC+ zones
assert(MF.ymd(picked) === '2026-08-10', 'ymd uses local fields');
var eb = MF.buildExtensionBlock(okExt({ extension_days: picked, notes: 'n' }));
assert(eb.extension_days === '2026-08-10' && eb.extension_granted === '2026-11-09 09:00:00' && eb.extension_hours === 5, 'extension: extension_days through the local date (B5), granted with time');
var ob = MF.buildOfflineBlock({ offline_until: picked, offline_notes: 'magneto' }, 2);
assert(ob.offline_until === '2026-08-10' && ob.offline_notes === 'magneto' && ob.club_id === 2, 'offline block');
assert(MF.hms('09:05') === '09:05:00' && MF.hms('09:05:30') === '09:05:30', 'hms accepts native time strings');
assert(MF.dateTime('2026-11-09', '10:30') === '2026-11-09 10:30:00', 'dateTime from strings');

// ─────────────────────────────────────────────────────────────
section('U4 / B9 reset after save (mocked vm)');
var vm = {
    obj: { maintenance_type: 'annual', hours_remaining: 12, issues: [{ id: 1 }], issue_confirmation: true },
    files: { radio: [{ file: 'x' }], cert: [{ file: 'y' }], noise_cert: [], insurance: [], crs: [{ file: 'z' }] },
    new_workpack: { workpack_number: 'WP-9' }, workpack_files: { workpack_doc: [{}] },
    one_ticked: true, saving: true, steps: { arc: true }, offline_confirm: true,
    reported_defects: [{ id: 1, resolved: true, _link_to_workpack: true, _uploaded_file: {} }]
};
MF.resetAfterSave(vm, d(2026, 11, 10, 8, 0));
assert(vm.files.radio.length === 0 && vm.files.cert.length === 0 && vm.files.crs.length === 0, 'files cleared (a retry no longer re-sends the earlier upload)');
assert(vm.obj.issues.length === 0 && vm.obj.hours_remaining === undefined && vm.obj.maintenance_type === '' && vm.obj.issue_confirmation === false, 'obj fresh (issues no longer accumulate)');
assert(vm.new_workpack.workpack_number === undefined && vm.workpack_files.workpack_doc.length === 0, 'workpack sub-form cleared');
assert(vm.saving === false && vm.one_ticked === false && vm.offline_confirm === false && Object.keys(vm.steps).length === 0, 'busy / ticked / confirm / steps reset');
assert(vm.reported_defects[0].resolved === false && vm.reported_defects[0]._link_to_workpack === false && vm.reported_defects[0]._uploaded_file === null, 'defect ticks cleared');

// ─────────────────────────────────────────────────────────────
section('B13 one combined outcome toast');
var t1 = MF.outcomeToast('Check recorded', [{ label: 'CRS', ok: true }], []);
assert(t1.kind === 'success' && t1.title === 'Check recorded', 'all good → one success toast');
var t2 = MF.outcomeToast('Check recorded', [{ label: 'CRS', ok: false, message: 'bad date' }], [{ label: 'Insurance', message: 'file missing' }]);
assert(t2.kind === 'warning' && /with problems/.test(t2.title), 'problems → one warning toast');
assert(/Insurance: file missing/.test(t2.message) && /CRS: bad date/.test(t2.message), 'warning lists every problem');
assert(MF.outcomeToast('Saved', null, undefined).kind === 'success', 'no follow-ups → success');

// ─────────────────────────────────────────────────────────────
section('U12 / B14 event filter chips');
var events = [
    { maintenance_type: 'annual' }, { maintenance_type: '50hour' }, { maintenance_type: 'extension' },
    { maintenance_type: 'workpack' }, { maintenance_type: '' }, { maintenance_type: null }, { maintenance_type: 'weird' }
];
var opts = MF.eventFilterOptions(events).map(function (o) { return o.key; });
assert(opts[0] === 'all', 'All first');
assert(opts.indexOf('annual') > -1 && opts.indexOf('50hours') > -1 && opts.indexOf('extension') > -1 && opts.indexOf('workpack') > -1, 'every type present gets a chip (50hour normalised)');
assert(opts.indexOf('legacy') > -1 && opts.indexOf('weird') > -1, 'blank → legacy chip, unknown kept');
assert(opts.indexOf('100hours') === -1, 'absent types get no chip');
assert(MF.eventMatchesFilter({ maintenance_type: '' }, 'legacy') && !MF.eventMatchesFilter({ maintenance_type: 'annual' }, 'legacy'), 'legacy filter matches blank rows');
assert(MF.eventMatchesFilter({ maintenance_type: '50hour' }, '50hours'), 'filter normalises 50hour');
assert(MF.eventMatchesFilter({ maintenance_type: 'annual' }, 'all'), 'all matches everything');
assert(MF.typeLabel('') === 'Maintenance (type not recorded)' && MF.typeLabel('workpack') === 'Workpack' && MF.typeLabel('50hours') === '50 hour', 'labels for every type');
assert(MF.nextCheckLabel('100hours') === 'Next: 100 h check' && MF.nextCheckLabel('annual') === 'Next: Annual check' && MF.nextCheckLabel(null) === '', 'next-check label');

// ─────────────────────────────────────────────────────────────
section('U15 / B10 / B11 display helpers');
assert(MF.hoursDisplay(null) === 'No check recorded' && MF.hoursDisplay('') === 'No check recorded', 'no figure → "No check recorded" (never N/A)');
assert(MF.hoursDisplay(0) === '00:00', 'zero is a figure');
assert(MF.hoursDisplay(15.6067) === '15:36' && MF.hoursDisplay(-2.5266) === '-02:32', 'HH:MM');
assert(MF.statusBadgeClass('ok') === 'snazzy-table__badge--success', "'ok' is the good colour (B10)");
assert(MF.statusBadgeClass('yellow') === 'snazzy-table__badge--warning' && MF.statusBadgeClass('expired') === 'snazzy-table__badge--danger' && MF.statusBadgeClass('red') === 'snazzy-table__badge--danger', 'warning / danger');
assert(MF.statusBadgeClass(undefined) === '', 'unknown → no colour');
assert(MF.statusWord('ok') === 'Valid' && MF.statusWord('expired') === 'Expired' && MF.statusWord('yellow') === 'Due soon', 'status words');
assert(MF.displayDate('2024-10-22') === '22/10/2024', 'dd/MM/yyyy');
assert(MF.displayDate('0000-00-00') === '' && MF.displayDate('0000-00-00', 'Not on file') === 'Not on file', "0000-00-00 guarded (B11)");
assert(MF.displayDate(null, '—') === '—' && MF.displayDate('', '—') === '—', 'blank → fallback');
assert(MF.displayDate('2024-08-15 13:56:54') === '15/08/2024', 'MySQL datetime → date');
assert(MF.displayDate('1908-07-31') === '31/07/1908', 'old but real date shown');

// ─────────────────────────────────────────────────────────────
section('batch 17: expiry-day wording (exclusive days + expires_today / due_today) and the hours prompt');
assert(MF.expiryDaysWord({ days_to_expiry: 0, expires_today: true, status: 'ok' }) === 'Expires today', 'document expiring today → "Expires today"');
assert(MF.expiryDaysWord({ days_to_expiry: 1, expires_today: false, status: 'ok' }) === '1', 'tomorrow → "1" (not the inclusive 2)');
assert(MF.expiryDaysWord({ days_to_expiry: -1, expires_today: false, status: 'expired' }) === '-1', 'yesterday → "-1"');
assert(MF.expiryDaysWord({ days_to_expiry: 0, expires_today: false, status: 'expired' }) === '—', 'a 0 without the flag = no date on file → dash');
assert(MF.expiryDaysWord({ days_to_expiry: null, status: 'ok' }) === '—' && MF.expiryDaysWord(null) === '—', 'no countdown (CofA / radio without expiry) → dash');
assert(MF.checkDaysWord({ days_remaining: 0, due_today: true }) === 'Due today', 'next check due today → "Due today"');
assert(MF.checkDaysWord({ days_remaining: 1, due_today: false }) === '1' && MF.checkDaysWord({ days_remaining: -3, due_today: false }) === '-3', 'tomorrow 1, overdue negative');
assert(MF.checkDaysWord({ days_remaining: 0, due_today: false }) === '0', 'a 0 without the flag (no date / no check) stays 0');
assert(MF.daysOverdue(-1, false) && !MF.daysOverdue(0, true) && MF.daysOverdue(0, false) && !MF.daysOverdue(1, false) && !MF.daysOverdue(null, false), 'overdue = negative, or 0 that is not the due day');
assert(MF.hoursNotRecorded({ anchor_check_id: 12, hours_remaining: null }) === true, 'anchor without hours → prompt');
assert(MF.hoursNotRecorded({ anchor_check_id: 12, hours_remaining: 0 }) === false, '0 hours is a recorded figure, no prompt');
assert(MF.hoursNotRecorded({ anchor_check_id: null, hours_remaining: null }) === false && MF.hoursNotRecorded(null) === false, 'no anchor at all → no prompt (no check recorded)');

// ─────────────────────────────────────────────────────────────
console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
