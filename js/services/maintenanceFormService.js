// MaintenanceFormService — the pure logic behind the Manage Club → Maintenance page
// (views/manageclub/maintenance_detail.html + dashboardClubMaintenanceController.js):
// the defect severity → tone map, the type-driven check form (which fields a check
// type shows, per-type placeholders), the validation of the check / extension /
// offline modes, the post-save state reset and the one combined outcome toast.
//
// Everything here is a plain function of its arguments (no $http, no DOM) so the
// node test `tests/club-maintenance-form-test.js` can require this file directly:
// the export guard at the bottom registers the Angular factory in the browser and
// module.exports under node. Guide: FRONTEND_CLUB_MAINTENANCE_GUIDE.md.
var MaintenanceFormLogic = (function () {

    // ── Check types (decision 1): the backend whitelist for maintenance.maintenance_type.
    // 'extension' is a MODE of the same panel (its own request block), never a check
    // type; 'workpack' is no longer a check type (workpacks never create checks).
    var CHECK_TYPES = ['annual', '25hours', '50hours', '100hours', 'interim', '6months'];

    var TYPE_LABELS = {
        annual: 'Annual',
        '25hours': '25 hour',
        '50hours': '50 hour',
        '100hours': '100 hour',
        interim: 'Interim',
        '6months': '6 month',
        extension: 'Extension',
        workpack: 'Workpack',
        legacy: 'Maintenance (type not recorded)'
    };

    // Short form for "Next: 100 h check" on the stat strip / fleet list.
    var TYPE_SHORT = {
        annual: 'Annual',
        '25hours': '25 h',
        '50hours': '50 h',
        '100hours': '100 h',
        interim: 'Interim',
        '6months': '6 month'
    };

    var HOUR_BASED = { '25hours': 25, '50hours': 50, '100hours': 100 };

    function typeLabel(type) {
        if (type === null || type === undefined || String(type).trim() === '') { return TYPE_LABELS.legacy; }
        var key = String(type).toLowerCase();
        // old rows: '50hour' (no s), free text
        if (key === '50hour') { key = '50hours'; }
        if (key === '100hour') { key = '100hours'; }
        if (key === '25hour') { key = '25hours'; }
        return TYPE_LABELS[key] || String(type);
    }

    function nextCheckLabel(type) {
        if (!type) { return ''; }
        var key = String(type).toLowerCase();
        return TYPE_SHORT[key] ? ('Next: ' + TYPE_SHORT[key] + ' check') : ('Next: ' + typeLabel(type));
    }

    // ── B1: one severity → tone map. Stored severities are the sentences from
    // defectReportPanel.js ("No Fly Item - Ground the plane", "Flyable - needs to be
    // checked at next maintenance", "Not urgent - but needs noting", "Unsure of
    // severity"); workpack_detail.html's indexOf('No Fly') logic, shared.
    function severityTone(severity) {
        var s = (severity === null || severity === undefined) ? '' : String(severity);
        var l = s.toLowerCase();
        if (l.indexOf('no fly') > -1 || l === 'high') { return 'nofly'; }
        if (l.indexOf('flyable') > -1 || l === 'medium') { return 'flyable'; }
        if (l.indexOf('not urgent') > -1 || l === 'low') { return 'noting'; }
        if (l.indexOf('unsure') > -1) { return 'unsure'; }
        return 'unsure';
    }

    // Tone → the house badge modifier (snazzy-table__badge--*) and the workpack chip class.
    var TONE_BADGE = { nofly: 'snazzy-table__badge--danger', flyable: 'snazzy-table__badge--warning', noting: 'snazzy-table__badge--info', unsure: '' };
    var TONE_CHIP = { nofly: 'wp-severity-nofly', flyable: 'wp-severity-flyable', noting: 'wp-severity-noting', unsure: 'wp-severity-unsure' };
    var TONE_SHORT = { nofly: 'No Fly', flyable: 'Flyable', noting: 'Not urgent', unsure: 'Unsure' };

    function severityBadgeClass(severity) { return TONE_BADGE[severityTone(severity)]; }
    function severityChipClass(severity) { return TONE_CHIP[severityTone(severity)]; }
    function severityShort(severity) { return TONE_SHORT[severityTone(severity)]; }

    // ── Type-driven fields (decision 1). One panel; the chosen type decides what shows.
    //   hours-based (25/50/100 h), interim, 6 month → date, time, hours to next check,
    //   date of next check, type of next check, checked by, notes.
    //   annual → the same core fields (hours included — required for EVERY check, owner batch 17),
    //   plus optional collapsed steps: workpack, CRS, ARC / permit upload. "Resolve defects" is
    //   always an optional step.
    //   extension → granted date, time, hours granted, until, checked by, notes.
    function fieldsFor(type) {
        var t = type ? String(type) : '';
        var isCheck = CHECK_TYPES.indexOf(t) > -1;
        var isAnnual = t === 'annual';
        var isExt = t === 'extension';
        return {
            chosen: isCheck || isExt,
            check: isCheck,
            extension: isExt,
            date: isCheck,
            time: isCheck || isExt,
            hours: isCheck,                       // core field for every check, the annual too (batch 17)
            next_check: isCheck,
            next_check_type: isCheck,
            checked_by: isCheck || isExt,
            notes: isCheck || isExt,
            // optional, collapsed steps (step_hours retired in batch 17: hours are a core field)
            step_hours: false,
            step_workpack: isAnnual,
            step_crs: isCheck,                    // every check may carry its CRS (owner, 10 Nov 2026) — was the annual only
            step_arc: isAnnual,
            step_defects: isCheck || isExt,
            step_logbooks: isCheck
        };
    }

    // ── U2: never pre-fill with the current figures; a per-type placeholder instead.
    function hoursPlaceholder(type) {
        var t = type ? String(type) : '';
        if (HOUR_BASED[t]) { return 'e.g. ' + HOUR_BASED[t]; }
        if (t === 'annual') { return 'e.g. 50 — the hours allowed until the next check'; }
        if (t === 'interim' || t === '6months') { return 'e.g. 50'; }
        return 'Flying hours until the next check';
    }

    function nextCheckHint(type) {
        var t = type ? String(type) : '';
        if (t === 'annual') { return 'e.g. 12 months from the check'; }
        if (t === '6months') { return 'e.g. 6 months from the check'; }
        if (HOUR_BASED[t]) { return 'Usually unchanged by an hours check — the calendar date carries over'; }
        return 'The date by which the next check must be done';
    }

    // ── Dates (local calendar, never UTC)
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function toDate(value) {
        if (value instanceof Date) { return isNaN(value.getTime()) ? null : value; }
        if (typeof value === 'string') {
            var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
            if (m) { return new Date(+m[1], +m[2] - 1, +m[3]); }
            var d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'number') { var n = new Date(value); return isNaN(n.getTime()) ? null : n; }
        return null;
    }

    function ymd(value) {
        var d = toDate(value);
        return d ? (d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())) : '';
    }

    function hms(value) {
        var d = toDate(value);
        if (!d) {
            // "HH:mm" / "HH:mm:ss" strings from a native <input type="time">
            if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) { return value.length === 5 ? value + ':00' : value.slice(0, 8); }
            return '';
        }
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }

    function dateTime(dateValue, timeValue) {
        var d = ymd(dateValue), t = hms(timeValue);
        return (d && t) ? (d + ' ' + t) : '';
    }

    // B11 / U15: dd/MM/yyyy everywhere, '0000-00-00' and blanks → fallback
    function displayDate(value, fallback) {
        var fb = (fallback === undefined) ? '' : fallback;
        if (value === null || value === undefined || value === '' || value === '0000-00-00' || value === '0000-00-00 00:00:00') { return fb; }
        var d = toDate(value);
        return d && d.getFullYear() > 1900 ? (pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear()) : fb;
    }

    function startOfDay(value) {
        var d = toDate(value);
        return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
    }

    function isNumberLike(v) {
        if (v === null || v === undefined || v === '') { return false; }
        return !isNaN(parseFloat(v)) && isFinite(v);
    }

    // ── Validation. Each returns { ok, title, message } — the controller toasts title/message.
    function fail(title, message) { return { ok: false, title: title, message: message }; }
    function pass() { return { ok: true }; }

    // obj = vm.obj; defects = vm.reported_defects (resolved flags)
    function validateCheck(obj, defects) {
        obj = obj || {};
        var f = fieldsFor(obj.maintenance_type);
        if (!f.check) { return fail('Check type required', 'Choose the type of check you are recording.'); }
        if (!ymd(obj.check_date)) { return fail('Date required', 'Enter the date the aircraft was released to service.'); }
        if (!hms(obj.check_time)) { return fail('Time required', 'Enter the time of release to service — flights before it count to the previous check, flights after it to this one.'); }
        if (!obj.checked_by || String(obj.checked_by).trim() === '') { return fail('Checked by required', 'Enter who signed the aircraft off.'); }
        var checkDay = startOfDay(obj.check_date);
        var today = startOfDay(obj._today || new Date());
        if (checkDay && today && checkDay.getTime() > today.getTime()) { return fail('Date in the future', 'The check date cannot be after today.'); }
        var hasHours = isNumberLike(obj.hours_remaining);
        if (f.hours && !hasHours) { return fail('Hours required', 'Enter the flying hours until the next check (' + hoursPlaceholder(obj.maintenance_type) + ').'); }
        if (hasHours) {
            var h = parseFloat(obj.hours_remaining);
            if (h < 0 || h > 1000) { return fail('Hours out of range', 'Hours to the next check must be between 0 and 1000.'); }
        }
        var nextDay = startOfDay(obj.next_check);
        if (obj.next_check && !nextDay) { return fail('Next check date invalid', 'Enter the date of the next check as a calendar date.'); }
        // required for EVERY type (Alex, 10 Nov 2026 — the backend has always required it; an hours check usually
        // keeps the calendar date it inherited, which the form pre-fills from the aircraft)
        if (!nextDay) {
            return fail('Next check date required', 'Enter the date by which the next check is due (' + nextCheckHint(obj.maintenance_type) + ').');
        }
        if (nextDay && checkDay && nextDay.getTime() < checkDay.getTime()) { return fail('Next check before the check', 'The date of the next check cannot be before the check itself.'); }
        if (obj.next_check_type && CHECK_TYPES.indexOf(String(obj.next_check_type)) === -1) { return fail('Next check type invalid', 'Choose the type of the next check from the list.'); }
        var ticked = resolvedDefects(defects);
        if (ticked.length > 0 && !obj.issue_confirmation) {
            return fail('Confirmation required', 'Tick the engineer confirmation before resolving defects.');
        }
        return pass();
    }

    function validateExtension(obj, defects) {
        obj = obj || {};
        if (!ymd(obj.extension_granted)) { return fail('Date required', 'Enter the date the extension was granted.'); }
        if (!hms(obj.check_time)) { return fail('Time required', 'Enter the time the extension was granted.'); }
        if (!obj.checked_by || String(obj.checked_by).trim() === '') { return fail('Granted by required', 'Enter who granted the extension.'); }
        var hasHours = isNumberLike(obj.extension_hours) && parseFloat(obj.extension_hours) > 0;
        var hasHoursValue = obj.extension_hours !== undefined && obj.extension_hours !== null && obj.extension_hours !== '';
        if (hasHoursValue && !hasHours) { return fail('Hours invalid', 'The hours granted must be a number above 0.'); }
        if (hasHours && parseFloat(obj.extension_hours) > 100) { return fail('Hours out of range', 'An extension is normally a few hours (max 100).'); }
        var untilDay = startOfDay(obj.extension_days);
        if (obj.extension_days && !untilDay) { return fail('Until date invalid', 'Enter the date the extension runs to.'); }
        if (!hasHours && !untilDay) { return fail('Extension incomplete', 'Enter the hours granted, the date it runs until, or both.'); }
        var grantedDay = startOfDay(obj.extension_granted);
        if (untilDay && grantedDay && untilDay.getTime() < grantedDay.getTime()) { return fail('Until before granted', 'The extension cannot end before the day it was granted.'); }
        var ticked = resolvedDefects(defects);
        if (ticked.length > 0 && !obj.issue_confirmation) { return fail('Confirmation required', 'Tick the engineer confirmation before resolving defects.'); }
        return pass();
    }

    // today: injectable for tests
    function validateOffline(obj, today) {
        obj = obj || {};
        var until = startOfDay(obj.offline_until);
        if (!until) { return fail('Offline until required', 'Enter the date the aircraft comes back online.'); }
        var t = startOfDay(today || new Date());
        if (until.getTime() < t.getTime()) { return fail('Date in the past', 'The offline-until date must be today or later.'); }
        return pass();
    }

    function validateWorkpack(wp) {
        wp = wp || {};
        if (!wp.workpack_number || String(wp.workpack_number).trim() === '') { return fail('Workpack number required', 'Enter the workpack number.'); }
        return pass();
    }

    function resolvedDefects(defects) {
        var out = [];
        if (!defects || !defects.length) { return out; }
        for (var i = 0; i < defects.length; i++) { if (defects[i] && defects[i].resolved) { out.push(defects[i]); } }
        return out;
    }

    // ── Payload builders (date-only fields through ymd — never Date.toISOString)
    function buildCheckBlock(obj) {
        var block = {
            maintenance_type: obj.maintenance_type,
            check_date: dateTime(obj.check_date, obj.check_time),
            expiry_date: ymd(obj.next_check) || null,
            next_check_type: obj.next_check_type || null,
            checked_by: obj.checked_by,
            description: obj.notes
        };
        if (isNumberLike(obj.hours_remaining)) { block.hours_remaining = parseFloat(obj.hours_remaining); }
        if (obj.workpack_option === 'existing' && obj.workpack_id) { block.workpack_id = parseInt(obj.workpack_id, 10); }
        return block;
    }

    function buildExtensionBlock(obj) {
        return {
            maintenance_type: 'extension',
            extension_hours: isNumberLike(obj.extension_hours) ? parseFloat(obj.extension_hours) : null,
            extension_days: ymd(obj.extension_days) || null,   // B5: through the local date, not toISOString
            extension_granted: dateTime(obj.extension_granted, obj.check_time),
            checked_by: obj.checked_by,
            description: obj.notes
        };
    }

    function buildOfflineBlock(obj, club_id) {
        return { offline_until: ymd(obj.offline_until), offline_notes: obj.offline_notes || '', club_id: club_id };
    }

    // ── U4 / B9: the state the panel starts from, and goes back to after a successful save.
    function freshObj(now) {
        var d = now || new Date();
        return {
            issues: [],
            issue_confirmation: false,
            maintenance_type: '',
            check_date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
            // decision 4: default to now, required — to the minute (a native <input type=time>
            // shows seconds + ms otherwise)
            check_time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0),
            extension_granted: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
            hours_remaining: undefined,              // U2: blank, placeholder only
            next_check: undefined,
            next_check_type: '',
            checked_by: '',
            notes: '',
            workpack_option: '',
            workpack_id: '',
            offline_until: undefined,
            offline_notes: ''
        };
    }

    function freshFiles() { return { radio: [], cert: [], noise_cert: [], insurance: [], crs: [] }; }

    // Apply the reset to a controller-like object (vm). Returns vm for chaining.
    function resetAfterSave(vm, now) {
        vm.obj = freshObj(now);
        vm.files = freshFiles();
        vm.new_workpack = { status: 'completed' };
        vm.workpack_files = { workpack_doc: [] };
        vm.one_ticked = false;
        vm.saving = false;
        vm.steps = {};
        vm.offline_confirm = false;
        if (vm.reported_defects && vm.reported_defects.length) {
            for (var i = 0; i < vm.reported_defects.length; i++) {
                var d = vm.reported_defects[i];
                d.resolved = false; d._link_to_workpack = false; d._uploaded_file = null;
            }
        }
        return vm;
    }

    // ── B13: one combined outcome toast.
    // outcomes: [{label, ok, message}] for the follow-up saves (CRS, logbook links,
    // workpack, defect workpacks) + documents_refused: [{label|document, message}].
    function outcomeToast(primaryTitle, outcomes, documentsRefused) {
        var problems = [];
        var i;
        if (documentsRefused && documentsRefused.length) {
            for (i = 0; i < documentsRefused.length; i++) {
                var r = documentsRefused[i] || {};
                problems.push((r.label || r.document || 'Document') + ': ' + (r.message || 'not saved'));
            }
        }
        if (outcomes && outcomes.length) {
            for (i = 0; i < outcomes.length; i++) {
                var o = outcomes[i] || {};
                if (o.ok === false) { problems.push((o.label || 'Step') + ': ' + (o.message || 'not saved')); }
            }
        }
        if (problems.length === 0) { return { kind: 'success', title: primaryTitle, message: 'Everything was recorded.' }; }
        return { kind: 'warning', title: primaryTitle + ' — with problems', message: 'Not saved: ' + problems.join(' · ') };
    }

    // ── U12 / B14: the event filter chips — every type present in the list, in a fixed order.
    function eventFilterOptions(events) {
        var order = ['annual', '25hours', '50hours', '100hours', 'interim', '6months', 'extension', 'workpack', 'legacy'];
        var seen = {};
        var i;
        for (i = 0; i < (events || []).length; i++) {
            var t = events[i] && events[i].maintenance_type;
            var key = (t === null || t === undefined || String(t).trim() === '') ? 'legacy' : String(t).toLowerCase();
            if (key === '50hour') { key = '50hours'; }
            seen[key] = true;
        }
        var out = [{ key: 'all', label: 'All' }];
        for (i = 0; i < order.length; i++) { if (seen[order[i]]) { out.push({ key: order[i], label: TYPE_LABELS[order[i]] || order[i] }); } }
        for (var k in seen) { if (seen.hasOwnProperty(k) && order.indexOf(k) === -1) { out.push({ key: k, label: k }); } }
        return out;
    }

    function eventMatchesFilter(event, filterKey) {
        if (!filterKey || filterKey === 'all') { return true; }
        var t = event && event.maintenance_type;
        var key = (t === null || t === undefined || String(t).trim() === '') ? 'legacy' : String(t).toLowerCase();
        if (key === '50hour') { key = '50hours'; }
        return key === filterKey;
    }

    // hours figure → "HH:MM", or the explicit "no check" wording (U15: never "N/A")
    function hoursDisplay(time) {
        if (time === null || time === undefined || time === '' || isNaN(parseFloat(time))) { return 'No check recorded'; }
        var t = parseFloat(time);
        var sign = t < 0 ? '-' : '';
        var hour = Math.floor(Math.abs(t));
        var min = Math.round((Math.abs(t) * 60) % 60);
        if (min === 60) { hour++; min = 0; }
        return sign + pad2(hour) + ':' + pad2(min);
    }

    // backend hours_status / days_status / document status → badge modifier (B10: 'ok' is the good colour)
    function statusBadgeClass(status) {
        var s = status ? String(status).toLowerCase() : '';
        if (s === 'ok' || s === 'green' || s === 'success') { return 'snazzy-table__badge--success'; }
        if (s === 'yellow' || s === 'warning' || s === 'amber') { return 'snazzy-table__badge--warning'; }
        if (s === 'red' || s === 'expired' || s === 'danger') { return 'snazzy-table__badge--danger'; }
        return '';
    }

    // ── Expiry-day wording (owner, batch 17): the backend counts days exclusively (tomorrow = 1,
    //   the expiry day = 0 and still valid, yesterday = −1) and flags the day itself with
    //   expires_today (documents: days_to_expiry) / due_today (the next check: days_remaining).
    //   A 0 WITHOUT the flag is "no date on file" → '—', as before.
    function expiryDaysWord(doc) {
        if (!doc) { return '—'; }
        if (doc.expires_today) { return 'Expires today'; }
        var d = doc.days_to_expiry;
        if (d === null || d === undefined || d === '' || isNaN(parseInt(d, 10)) || parseInt(d, 10) === 0) { return '—'; }
        return String(parseInt(d, 10));
    }
    function checkDaysWord(maintenance) {
        if (!maintenance) { return '—'; }
        if (maintenance.due_today) { return 'Due today'; }
        var d = maintenance.days_remaining;
        if (d === null || d === undefined || d === '' || isNaN(parseInt(d, 10))) { return '—'; }
        return String(parseInt(d, 10));
    }
    // the days figure is overdue: negative, or a 0 that is NOT the due day itself (no date on file)
    function daysOverdue(days, today_flag) {
        if (days === null || days === undefined || days === '' || isNaN(parseInt(days, 10))) { return false; }
        var d = parseInt(days, 10);
        return d < 0 || (d === 0 && !today_flag);
    }
    // ── An extension in force (owner, 10 Nov 2026): an extension sits ON TOP of the last check — its date extends the
    //   ARC and so the next-check date (usually up to a month), its hours add to the hours to the next check (usually
    //   up to 5 h). Never the radio licence or insurance. The figures come from the status block (extension_until /
    //   extension_hours, which the backend already applies); who granted it and when come from the latest extension
    //   event recorded after the anchor check. null when nothing is in force.
    function extensionInForce(maintenance, events, today) {
        if (!maintenance) { return null; }
        var t = today ? ymd(today) : ymd(new Date());
        // the backend's own block (status.extension — the extension that set the until-date, else the last one after the anchor)
        if (maintenance.extension !== undefined) {
            var x = maintenance.extension;
            if (!x || !x.in_force) { return null; }
            var xu = ymd(x.until), xh = parseFloat(x.hours) || 0, xev = null;
            if (xu && t && xu < t) { xu = null; }
            if (!xu && xh <= 0) { return null; }
            (events || []).forEach(function (e) { if (e && +e.id === +x.id) { xev = e; } });
            var xd = xu ? Math.round((parseYmd(xu).getTime() - parseYmd(t).getTime()) / 86400000) : null;
            return { until: xu, untilText: xu ? displayDate(xu) : '', daysLeft: xd, hours: xh > 0 ? xh : 0,
                by: x.granted_by ? String(x.granted_by).trim() : '', recorded: x.recorded_at ? displayDate(String(x.recorded_at).slice(0, 10)) : '', event: xev };
        }
        var until = ymd(maintenance.extension_until), hours = parseFloat(maintenance.extension_hours) || 0;
        if (until && t && until < t) { until = null; }          // ran out
        if (!until && hours <= 0) { return null; }
        var ev = null, anchorDate = maintenance.anchor_check_date ? String(maintenance.anchor_check_date) : '';
        (events || []).forEach(function (e) {
            if (!e || String(e.maintenance_type) !== 'extension') { return; }
            if (anchorDate && String(e.check_date || '') < anchorDate) { return; }   // before the last check: superseded
            if (!ev || String(e.check_date || '') > String(ev.check_date || '') || (String(e.check_date || '') === String(ev.check_date || '') && +e.id > +ev.id)) { ev = e; }
        });
        var daysLeft = until ? Math.round((parseYmd(until).getTime() - parseYmd(t).getTime()) / 86400000) : null;
        return {
            until: until, untilText: until ? displayDate(until) : '', daysLeft: daysLeft,
            hours: hours > 0 ? hours : 0,
            by: ev && ev.checked_by ? String(ev.checked_by).trim() : '',
            recorded: ev && ev.check_date ? displayDate(String(ev.check_date).slice(0, 10)) : '',
            event: ev
        };
    }
    function hoursShort(h) { h = parseFloat(h) || 0; return (h % 1 ? h.toFixed(1) : String(h)) + ' h'; }
    function parseYmd(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN); }
    // one sentence for banners and notes: "until 10/12/2026 · +5 h to the next check"
    function extensionWords(ext) {
        if (!ext) { return ''; }
        var parts = [];
        if (ext.until) { parts.push('until ' + ext.untilText); }
        if (ext.hours) { parts.push('+' + hoursShort(ext.hours) + ' to the next check'); }
        return parts.join(' · ');
    }

    // the anchor check carries no hours (a legacy row): prompt to edit it (batch 17)
    function hoursNotRecorded(maintenance) {
        return !!(maintenance && maintenance.anchor_check_id && (maintenance.hours_remaining === null || maintenance.hours_remaining === undefined));
    }

    function statusWord(status) {
        var s = status ? String(status).toLowerCase() : '';
        if (s === 'ok' || s === 'green') { return 'Valid'; }
        if (s === 'yellow') { return 'Due soon'; }
        if (s === 'expired' || s === 'red') { return 'Expired'; }
        return s ? status : 'Unknown';
    }

    return {
        CHECK_TYPES: CHECK_TYPES,
        typeLabel: typeLabel,
        nextCheckLabel: nextCheckLabel,
        severityTone: severityTone,
        severityBadgeClass: severityBadgeClass,
        severityChipClass: severityChipClass,
        severityShort: severityShort,
        fieldsFor: fieldsFor,
        hoursPlaceholder: hoursPlaceholder,
        nextCheckHint: nextCheckHint,
        ymd: ymd,
        hms: hms,
        dateTime: dateTime,
        displayDate: displayDate,
        validateCheck: validateCheck,
        validateExtension: validateExtension,
        validateOffline: validateOffline,
        validateWorkpack: validateWorkpack,
        resolvedDefects: resolvedDefects,
        buildCheckBlock: buildCheckBlock,
        buildExtensionBlock: buildExtensionBlock,
        buildOfflineBlock: buildOfflineBlock,
        freshObj: freshObj,
        freshFiles: freshFiles,
        resetAfterSave: resetAfterSave,
        outcomeToast: outcomeToast,
        eventFilterOptions: eventFilterOptions,
        eventMatchesFilter: eventMatchesFilter,
        hoursDisplay: hoursDisplay,
        expiryDaysWord: expiryDaysWord,
        checkDaysWord: checkDaysWord,
        extensionInForce: extensionInForce,
        extensionWords: extensionWords,
        hoursShort: hoursShort,
        daysOverdue: daysOverdue,
        hoursNotRecorded: hoursNotRecorded,
        statusBadgeClass: statusBadgeClass,
        statusWord: statusWord
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MaintenanceFormLogic;          // node tests
}
if (typeof app !== 'undefined' && app && typeof app.factory === 'function') {
    app.factory('MaintenanceFormService', function () { return MaintenanceFormLogic; });
}
