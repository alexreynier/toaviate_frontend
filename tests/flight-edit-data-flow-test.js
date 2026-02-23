/**
 * Flight Edit Modal — Data Flow Unit Tests
 * Tests the buildChanges() logic and data pipeline without a browser
 * Run: node tests/flight-edit-data-flow-test.js
 */

var passCount = 0;
var failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  ✅ ' + testName);
    passCount++;
  } else {
    console.log('  ❌ ' + testName);
    failCount++;
  }
}

function section(name) {
  console.log('\n=== ' + name + ' ===');
}

// ───────────────────────────────────────────────
// Simulate the buildChanges() function from the controller
// ───────────────────────────────────────────────
function buildChanges(form, original, hasBooking) {
  var bookingChanges = {};
  var plsChanges = {};
  var booking = (original && original.booking) ? original.booking : {};
  var pls;
  if (hasBooking) {
    pls = original.plane_log_sheets && original.plane_log_sheets[0]
      ? original.plane_log_sheets[0] : {};
  } else {
    pls = original.plane_log_sheet || original || {};
  }

  // Booking-level fields (only if there IS a booking)
  // NOTE: lesson_id deliberately excluded — lesson changes must be
  // done via the Training Records section, not flight editing.
  if (hasBooking) {
    var bookingFields = ['plane_id', 'user_id', 'instructor_id', 'voucher_id', 'maintenance_flight'];
    bookingFields.forEach(function(field) {
      if (String(form[field] || '') !== String(booking[field] || '')) {
        bookingChanges[field] = form[field];
      }
    });
  }

  // Shared fields (sent to PLS changes too)
  var sharedFields = ['plane_id', 'user_id', 'instructor_id'];
  sharedFields.forEach(function(field) {
    if (String(form[field] || '') !== String(pls[field] || '')) {
      plsChanges[field] = form[field];
    }
  });

  // PLS-only fields
  var plsOnlyFields = [
    'from_airport_id', 'to_airport_id', 'flight_date',
    'brakes_off', 'brakes_on', 'takeoff_time', 'landing_time',
    'tacho_start', 'tacho_end',
    'landings', 'touch_and_gos', 'night_landings',
    'authorised_solo', 'is_picus',
    'remarks', 'route',
    'pic_id', 'put_id', 'course_id', 'tuition_id'
  ];
  plsOnlyFields.forEach(function(field) {
    if (String(form[field] != null ? form[field] : '') !== String(pls[field] != null ? pls[field] : '')) {
      plsChanges[field] = form[field];
    }
  });

  // ── Training record handling ──
  var memberChanged = bookingChanges.hasOwnProperty('user_id') || plsChanges.hasOwnProperty('user_id');
  var instructorChanged = bookingChanges.hasOwnProperty('instructor_id') || plsChanges.hasOwnProperty('instructor_id');
  var trainingRecordAction = 'none';
  if (memberChanged || instructorChanged) {
    trainingRecordAction = 'remove_and_reset';
  }

  return {
    bookingChanges: bookingChanges,
    plsChanges: plsChanges,
    trainingRecordAction: trainingRecordAction,
    memberChanged: memberChanged,
    instructorChanged: instructorChanged
  };
}


// ═══════════════════════════════════════════════
// TEST 1: No changes detected when form matches original
// ═══════════════════════════════════════════════
section('TEST 1: No changes detected when form matches original');

var originalData = {
  booking: { plane_id: 3, user_id: 42, instructor_id: 15, lesson_id: 10, voucher_id: null, maintenance_flight: false },
  plane_log_sheets: [{
    plane_id: 3, user_id: 42, instructor_id: 15,
    pic_id: 15, put_id: 42,
    from_airport_id: 100, to_airport_id: 200,
    flight_date: '2025-03-15',
    brakes_off: '10:00', brakes_on: '11:30',
    takeoff_time: '10:05', landing_time: '11:25',
    tacho_start: 1234.5, tacho_end: 1235.0,
    landings: 1, touch_and_gos: 0, night_landings: 0,
    authorised_solo: false, is_picus: false,
    remarks: 'Normal flight', route: 'EGBJ-EGHH',
    course_id: 5, tuition_id: 8
  }]
};

var formNoChange = {
  plane_id: 3, user_id: 42, instructor_id: 15, lesson_id: 10, voucher_id: null, maintenance_flight: false,
  from_airport_id: 100, to_airport_id: 200,
  flight_date: '2025-03-15',
  brakes_off: '10:00', brakes_on: '11:30',
  takeoff_time: '10:05', landing_time: '11:25',
  tacho_start: 1234.5, tacho_end: 1235.0,
  landings: 1, touch_and_gos: 0, night_landings: 0,
  authorised_solo: false, is_picus: false,
  remarks: 'Normal flight', route: 'EGBJ-EGHH',
  pic_id: 15, put_id: 42,
  course_id: 5, tuition_id: 8
};

var result1 = buildChanges(formNoChange, originalData, true);
assert(Object.keys(result1.bookingChanges).length === 0, 'No booking changes detected');
assert(Object.keys(result1.plsChanges).length === 0, 'No PLS changes detected');


// ═══════════════════════════════════════════════
// TEST 2: Aircraft change detected
// ═══════════════════════════════════════════════
section('TEST 2: Aircraft change detected in both booking + PLS');

var formAircraftChange = Object.assign({}, formNoChange, { plane_id: 7 });
var result2 = buildChanges(formAircraftChange, originalData, true);
assert(result2.bookingChanges.plane_id === 7, 'Booking changes includes plane_id=7');
assert(result2.plsChanges.plane_id === 7, 'PLS changes includes plane_id=7');
assert(Object.keys(result2.bookingChanges).length === 1, 'Only plane_id in booking changes');
assert(Object.keys(result2.plsChanges).length === 1, 'Only plane_id in PLS changes');


// ═══════════════════════════════════════════════
// TEST 3: Time change detected
// ═══════════════════════════════════════════════
section('TEST 3: Time change detected');

var formTimeChange = Object.assign({}, formNoChange, { tacho_end: 1236.0 });
var result3 = buildChanges(formTimeChange, originalData, true);
assert(result3.plsChanges.tacho_end === 1236.0, 'PLS changes includes tacho_end=1236.0');
assert(Object.keys(result3.bookingChanges).length === 0, 'No booking changes for time edit');


// ═══════════════════════════════════════════════
// TEST 4: Student reassignment detected
// ═══════════════════════════════════════════════
section('TEST 4: Student reassignment detected');

var formStudentChange = Object.assign({}, formNoChange, { user_id: 99 });
var result4 = buildChanges(formStudentChange, originalData, true);
assert(result4.bookingChanges.user_id === 99, 'Booking changes includes user_id=99');
assert(result4.plsChanges.user_id === 99, 'PLS changes includes user_id=99');


// ═══════════════════════════════════════════════
// TEST 5: Flight date change detected
// ═══════════════════════════════════════════════
section('TEST 5: Flight date change detected');

var formDateChange = Object.assign({}, formNoChange, { flight_date: '2025-03-16' });
var result5 = buildChanges(formDateChange, originalData, true);
assert(result5.plsChanges.flight_date === '2025-03-16', 'PLS changes includes flight_date');
assert(Object.keys(result5.bookingChanges).length === 0, 'No booking changes for date edit');


// ═══════════════════════════════════════════════
// TEST 6: PIC/PUT change detected
// ═══════════════════════════════════════════════
section('TEST 6: PIC/PUT change detected');

var formPicChange = Object.assign({}, formNoChange, { pic_id: 42, put_id: 15 });
var result6 = buildChanges(formPicChange, originalData, true);
assert(result6.plsChanges.pic_id === 42, 'PLS changes includes pic_id=42');
assert(result6.plsChanges.put_id === 15, 'PLS changes includes put_id=15');


// ═══════════════════════════════════════════════
// TEST 7: Lesson change NO LONGER detected (removed from flight editing)
// ═══════════════════════════════════════════════
section('TEST 7: Lesson change excluded from flight editing');

var formLessonChange = Object.assign({}, formNoChange, { lesson_id: 20 });
var result7 = buildChanges(formLessonChange, originalData, true);
assert(!result7.bookingChanges.lesson_id, 'lesson_id is NOT in booking changes (removed from flight editing)');
assert(!result7.plsChanges.lesson_id, 'lesson_id is NOT in PLS changes');
assert(Object.keys(result7.bookingChanges).length === 0, 'No booking changes when only lesson_id differs');


// ═══════════════════════════════════════════════
// TEST 8: Voucher change detected (booking field)
// ═══════════════════════════════════════════════
section('TEST 8: Voucher change detected (booking-level field)');

var formVoucherChange = Object.assign({}, formNoChange, { voucher_id: 55 });
var result8 = buildChanges(formVoucherChange, originalData, true);
assert(result8.bookingChanges.voucher_id === 55, 'Booking changes includes voucher_id=55');


// ═══════════════════════════════════════════════
// TEST 9: Multiple changes at once
// ═══════════════════════════════════════════════
section('TEST 9: Multiple changes detected simultaneously');

var formMultiChange = Object.assign({}, formNoChange, {
  plane_id: 7, instructor_id: 20, tacho_end: 1237.0, landings: 3, remarks: 'Changed'
});
var result9 = buildChanges(formMultiChange, originalData, true);
assert(result9.bookingChanges.plane_id === 7, 'Booking: plane_id changed');
assert(result9.bookingChanges.instructor_id === 20, 'Booking: instructor_id changed');
assert(result9.plsChanges.plane_id === 7, 'PLS: plane_id changed');
assert(result9.plsChanges.instructor_id === 20, 'PLS: instructor_id changed');
assert(result9.plsChanges.tacho_end === 1237.0, 'PLS: tacho_end changed');
assert(result9.plsChanges.landings === 3, 'PLS: landings changed');
assert(result9.plsChanges.remarks === 'Changed', 'PLS: remarks changed');


// ═══════════════════════════════════════════════
// TEST 10: PLS-only mode (no booking)
// ═══════════════════════════════════════════════
section('TEST 10: PLS-only mode changes');

var plsOnlyOriginal = {
  plane_log_sheet: {
    plane_id: 3, user_id: 42, instructor_id: 15,
    pic_id: 15, put_id: 42,
    from_airport_id: 100, to_airport_id: 200,
    flight_date: '2025-03-15',
    brakes_off: '10:00', brakes_on: '11:30',
    takeoff_time: '10:05', landing_time: '11:25',
    tacho_start: 1234.5, tacho_end: 1235.0,
    landings: 1, touch_and_gos: 0, night_landings: 0,
    authorised_solo: false, is_picus: false,
    remarks: 'Normal flight', route: 'EGBJ-EGHH',
    course_id: 5, tuition_id: 8
  }
};

var formPlsOnly = Object.assign({}, formNoChange, { plane_id: 7 });
var result10 = buildChanges(formPlsOnly, plsOnlyOriginal, false);
assert(Object.keys(result10.bookingChanges).length === 0, 'No booking changes in PLS-only mode');
assert(result10.plsChanges.plane_id === 7, 'PLS changes includes plane_id in PLS-only mode');


// ═══════════════════════════════════════════════
// TEST 11: Null handling
// ═══════════════════════════════════════════════
section('TEST 11: Null / undefined / empty string handling');

var formNullTest = Object.assign({}, formNoChange, { voucher_id: null });
var result11 = buildChanges(formNullTest, originalData, true);
assert(Object.keys(result11.bookingChanges).length === 0, 'null→null produces no change');

var formEmptyRemarks = Object.assign({}, formNoChange, { remarks: '' });
var result11b = buildChanges(formEmptyRemarks, originalData, true);
assert(result11b.plsChanges.remarks === '', 'Clearing remarks detected as change');


// ═══════════════════════════════════════════════
// TEST 12: Payload structure for preview/apply
// ═══════════════════════════════════════════════
section('TEST 12: Payload structure matches backend spec');

// Simulate what previewChanges() builds
var changes = buildChanges(formAircraftChange, originalData, true);
var previewPayload = {
  booking_id: 123,
  plane_log_sheet_id: 456,
  booking_changes: changes.bookingChanges,
  pls_changes: changes.plsChanges
};
assert(previewPayload.booking_id === 123, 'Preview payload has booking_id');
assert(previewPayload.plane_log_sheet_id === 456, 'Preview payload has plane_log_sheet_id');
assert(typeof previewPayload.booking_changes === 'object', 'Preview payload has booking_changes object');
assert(typeof previewPayload.pls_changes === 'object', 'Preview payload has pls_changes object');

// Simulate what applyChanges() builds
var applyPayload = {
  booking_id: 123,
  plane_log_sheet_id: 456,
  booking_changes: changes.bookingChanges,
  pls_changes: changes.plsChanges,
  financial_action: 'new_invoice',
  payment_method: null,
  stripe_payment_intent_id: null
};
assert(applyPayload.financial_action === 'new_invoice', 'Apply payload has financial_action');
assert(applyPayload.payment_method === null, 'Apply payload has payment_method');
assert(applyPayload.stripe_payment_intent_id === null, 'Apply payload has stripe_payment_intent_id');


// ═══════════════════════════════════════════════
// TEST 13: Course/tuition change detected
// ═══════════════════════════════════════════════
section('TEST 13: Course and tuition changes');

var formCourseChange = Object.assign({}, formNoChange, { course_id: 10, tuition_id: 15 });
var result13 = buildChanges(formCourseChange, originalData, true);
assert(result13.plsChanges.course_id === 10, 'PLS changes includes course_id');
assert(result13.plsChanges.tuition_id === 15, 'PLS changes includes tuition_id');
assert(!result13.bookingChanges.course_id, 'course_id NOT in booking changes');


// ═══════════════════════════════════════════════
// TEST 14: Boolean handling (authorised_solo, is_picus, maintenance_flight)
// ═══════════════════════════════════════════════
section('TEST 14: Boolean field change detection');

var formBoolChange = Object.assign({}, formNoChange, { authorised_solo: true, is_picus: true });
var result14 = buildChanges(formBoolChange, originalData, true);
assert(result14.plsChanges.authorised_solo === true, 'PLS changes includes authorised_solo=true');
assert(result14.plsChanges.is_picus === true, 'PLS changes includes is_picus=true');


// ═══════════════════════════════════════════════
// TEST 15: Time format normalisation (HH:MM:SS → HH:MM)
// Reproduces the bug where API returns seconds but the
// form uses HH:MM, causing a false diff or stale value
// ═══════════════════════════════════════════════
section('TEST 15: Time normalisation — HH:MM:SS vs HH:MM');

// Simulate what the controller now does after findTimeSlot:
// normalise form values to the HH:MM format that findTimeSlot produces
function normaliseTime(timeStr) {
  if (!timeStr) return '';
  var parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  var hh = parseInt(parts[0], 10);
  var mm = parseInt(parts[1], 10);
  if (isNaN(hh) || isNaN(mm)) return timeStr;
  return ((hh < 10) ? '0' : '') + hh + ':' + ((mm < 10) ? '0' : '') + mm;
}

// Scenario A: API returns "10:25:00", form normalises to "10:25", no user change
var normalisedOrigA = {
  booking: { plane_id: 3, user_id: 42, instructor_id: 15, lesson_id: 10, voucher_id: null, maintenance_flight: false },
  plane_log_sheets: [{
    plane_id: 3, user_id: 42, instructor_id: 15,
    pic_id: 15, put_id: 42,
    from_airport_id: 100, to_airport_id: 200,
    flight_date: '2025-03-15',
    brakes_off: '10:00:00', brakes_on: '11:30:00',
    takeoff_time: '10:05:00', landing_time: '10:25:00',
    tacho_start: 1234.5, tacho_end: 1235.0,
    landings: 1, touch_and_gos: 0, night_landings: 0,
    authorised_solo: false, is_picus: false,
    remarks: 'Normal flight', route: 'EGBJ-EGHH',
    course_id: 5, tuition_id: 8
  }]
};

// Simulate the normalisation that now happens at init:
// pls values are normalised, form gets normalised values
var normalisedFormA = Object.assign({}, formNoChange, {
  brakes_off: normaliseTime('10:00:00'),    // "10:00"
  brakes_on: normaliseTime('11:30:00'),     // "11:30"
  takeoff_time: normaliseTime('10:05:00'),  // "10:05"
  landing_time: normaliseTime('10:25:00')   // "10:25"
});

// Also normalise the PLS comparison values (simulating what the init sync does)
var normalisedPLS_A = JSON.parse(JSON.stringify(normalisedOrigA));
normalisedPLS_A.plane_log_sheets[0].brakes_off = normaliseTime(normalisedPLS_A.plane_log_sheets[0].brakes_off);
normalisedPLS_A.plane_log_sheets[0].brakes_on = normaliseTime(normalisedPLS_A.plane_log_sheets[0].brakes_on);
normalisedPLS_A.plane_log_sheets[0].takeoff_time = normaliseTime(normalisedPLS_A.plane_log_sheets[0].takeoff_time);
normalisedPLS_A.plane_log_sheets[0].landing_time = normaliseTime(normalisedPLS_A.plane_log_sheets[0].landing_time);

var resultA = buildChanges(normalisedFormA, normalisedPLS_A, true);
assert(Object.keys(resultA.plsChanges).length === 0, 'No false positives after HH:MM:SS normalisation');

// Scenario B: User changes landing time to 11:25 (after normalisation)
var normalisedFormB = Object.assign({}, normalisedFormA, { landing_time: '11:25' });
var resultB = buildChanges(normalisedFormB, normalisedPLS_A, true);
assert(resultB.plsChanges.landing_time === '11:25', 'Landing time change detected: 10:25 → 11:25');
assert(!resultB.plsChanges.brakes_off, 'No false brakes_off diff after normalisation');
assert(!resultB.plsChanges.takeoff_time, 'No false takeoff_time diff after normalisation');
assert(!resultB.plsChanges.brakes_on, 'No false brakes_on diff after normalisation');


// ═══════════════════════════════════════════════
// TEST 16: $item-based onTimeChange sync
// When the user picks a new time, $item carries the correct value
// ═══════════════════════════════════════════════
section('TEST 16: $item-based onTimeChange sync');

// Simulate: user changes landing from 10:25 to 11:25
// With the old code, $scope.selectedLanding (on controller scope) was stale
// With the fix, $item is used to sync before reading

function simulateOnTimeChange_fixed(which, $item, state) {
  // This mirrors the fixed onTimeChange function
  if (which === 'brakes_off') state.selectedBrakesOff = $item;
  else if (which === 'takeoff') state.selectedTakeoff = $item;
  else if (which === 'landing') state.selectedLanding = $item;
  else if (which === 'brakes_on') state.selectedBrakesOn = $item;

  state.form.brakes_off = state.selectedBrakesOff ? state.selectedBrakesOff.time : '';
  state.form.takeoff_time = state.selectedTakeoff ? state.selectedTakeoff.time : '';
  state.form.landing_time = state.selectedLanding ? state.selectedLanding.time : '';
  state.form.brakes_on = state.selectedBrakesOn ? state.selectedBrakesOn.time : '';
}

function simulateOnTimeChange_old(which, state) {
  // This mirrors the OLD (broken) code — reads from scope which may be stale
  state.form.brakes_off = state.selectedBrakesOff ? state.selectedBrakesOff.time : '';
  state.form.takeoff_time = state.selectedTakeoff ? state.selectedTakeoff.time : '';
  state.form.landing_time = state.selectedLanding ? state.selectedLanding.time : '';
  state.form.brakes_on = state.selectedBrakesOn ? state.selectedBrakesOn.time : '';
}

// Set up initial state
var state = {
  selectedBrakesOff: { time: '10:00' },
  selectedTakeoff: { time: '10:05' },
  selectedLanding: { time: '10:25' },  // <-- this is on "controller scope"
  selectedBrakesOn: { time: '11:30' },
  form: { brakes_off: '10:00', takeoff_time: '10:05', landing_time: '10:25', brakes_on: '11:30' }
};

// OLD CODE: user picks 11:25, but $scope.selectedLanding is stale (wasn't updated by ngModel)
var stateOld = JSON.parse(JSON.stringify(state));
// In old code, the child scope gets updated but controller scope does NOT
// So stateOld.selectedLanding still points to { time: '10:25' }
simulateOnTimeChange_old('landing', stateOld);
assert(stateOld.form.landing_time === '10:25', 'OLD CODE: landing_time stays stale at 10:25 (BUG)');

// NEW CODE: $item carries the correct new value
var stateNew = JSON.parse(JSON.stringify(state));
var newItem = { time: '11:25' };
simulateOnTimeChange_fixed('landing', newItem, stateNew);
assert(stateNew.form.landing_time === '11:25', 'NEW CODE: landing_time correctly set to 11:25 via $item');
assert(stateNew.selectedLanding.time === '11:25', 'NEW CODE: selectedLanding synced to controller scope');


// ═══════════════════════════════════════════════
// TEST 17: Training record action — no crew change
// ═══════════════════════════════════════════════
section('TEST 17: Training record action — no crew change');

var formRemarks = Object.assign({}, formNoChange, { remarks: 'Updated remarks only' });
var result17 = buildChanges(formRemarks, originalData, true);
assert(result17.trainingRecordAction === 'none', 'No crew change → trainingRecordAction is "none"');
assert(result17.memberChanged === false, 'memberChanged is false');
assert(result17.instructorChanged === false, 'instructorChanged is false');


// ═══════════════════════════════════════════════
// TEST 18: Training record action — student changed
// ═══════════════════════════════════════════════
section('TEST 18: Training record action — student changed');

var formStudent18 = Object.assign({}, formNoChange, { user_id: 99 });
var result18 = buildChanges(formStudent18, originalData, true);
assert(result18.trainingRecordAction === 'remove_and_reset', 'Student change → remove_and_reset');
assert(result18.memberChanged === true, 'memberChanged is true');
assert(result18.instructorChanged === false, 'instructorChanged is false (only student changed)');


// ═══════════════════════════════════════════════
// TEST 19: Training record action — instructor changed
// ═══════════════════════════════════════════════
section('TEST 19: Training record action — instructor changed');

var formInstr19 = Object.assign({}, formNoChange, { instructor_id: 77 });
var result19 = buildChanges(formInstr19, originalData, true);
assert(result19.trainingRecordAction === 'remove_and_reset', 'Instructor change → remove_and_reset');
assert(result19.memberChanged === false, 'memberChanged is false (only instructor changed)');
assert(result19.instructorChanged === true, 'instructorChanged is true');


// ═══════════════════════════════════════════════
// TEST 20: Training record action — both changed
// ═══════════════════════════════════════════════
section('TEST 20: Training record action — both student + instructor changed');

var formBoth20 = Object.assign({}, formNoChange, { user_id: 99, instructor_id: 77 });
var result20 = buildChanges(formBoth20, originalData, true);
assert(result20.trainingRecordAction === 'remove_and_reset', 'Both changed → remove_and_reset');
assert(result20.memberChanged === true, 'memberChanged is true');
assert(result20.instructorChanged === true, 'instructorChanged is true');


// ═══════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════
console.log('\n════════════════════════════════════');
if (failCount > 0) {
  console.log('❌ FAILED: ' + failCount + ' tests failed, ' + passCount + ' passed');
  process.exit(1);
} else {
  console.log('✅ ALL ' + passCount + ' TESTS PASSED');
  process.exit(0);
}
