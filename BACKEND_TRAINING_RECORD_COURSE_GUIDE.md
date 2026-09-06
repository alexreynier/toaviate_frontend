# BACKEND_TRAINING_RECORD_COURSE_GUIDE.md
### Course/lesson on import rows + a bulk "reassign to another course" tool

**Audience:** the backend agent. Two related pieces of work, both driven by
the same root problem. Copy-paste ready; no schema changes beyond one
nullable column pair on the staging table.

---

## The problem (confirmed in the code)

`TpcImport::maybe_training_record()` (`tpc_import.model.php:1459`) resolves a
training record's course from the workbook's free-text `exercise` cell:

1. numbered exercise → lesson token → **that lesson's course** (+ lesson set)
2. keyword exercise → `course_from_exercise()` title match (`cpl`, `imc|ir|cbir`,
   `fi`, `night`, `tailwheel`, `type`, `dual check`)
3. **blank / unrecognised → the student's majority course in the run → else
   the default (PPL) course**

Step 3 is why IMC, night-rating, type and check flights are landing on PPL:
any row whose exercise cell is empty or phrased outside the keyword map is
silently filed under PPL. Worse, the resolution is **invisible** — `row_out()`
(line ~575) doesn't return the resolved course/lesson, so the reviewer can't
see or correct it before applying.

Two fixes: **(A)** expose + allow editing the course/lesson per staged row,
**(B)** a bulk reassignment tool for records already applied.

---

# PART A — course/lesson on staged rows

### A1. Migration — remember the reviewer's choice

```sql
ALTER TABLE tpc_import_rows
  ADD COLUMN course_id INT NULL DEFAULT NULL AFTER exercise,
  ADD COLUMN lesson_id INT NULL DEFAULT NULL AFTER course_id;
```

### A2. `row_out()` (~line 575) — expose the resolution

Add to the returned array:

```php
			// Course/lesson the training record will be filed under.
			// *_resolved = what the importer worked out; course_id/lesson_id
			// = the reviewer's override (null until they set one).
			'course_id' => $r['course_id'] !== null ? intval($r['course_id']) : null,
			'lesson_id' => $r['lesson_id'] !== null ? intval($r['lesson_id']) : null,
			'course_resolved' => isset($r['_course_resolved']) ? $r['_course_resolved'] : null,
			'lesson_resolved' => isset($r['_lesson_resolved']) ? $r['_lesson_resolved'] : null,
			'course_source'   => isset($r['_course_source']) ? $r['_course_source'] : null,
```

`course_source` is a short string the UI shows as a provenance chip — one of:
`exercise_number` (numbered exercise → lesson), `exercise_keyword` (title
keyword match), `student_majority` (the run's majority course for this
student), `default` (**the PPL fallback — the case that needs review**),
`manual` (reviewer set it).

For the single-row endpoint `GET /tpc_import/row/{id}` also return the
resolved *names* (`course_title`, `lesson_title`) so the drawer can render
without a second lookup.

### A3. `maybe_training_record()` — honour the override

At the top of the course/lesson resolution block, prefer the stored override
and record how the value was reached:

```php
		$lesson = null;
		$course_id = null;
		$source = null;

		// Reviewer override wins over everything the importer guessed.
		if ($r['course_id'] !== null && intval($r['course_id']) > 0) {
			$course_id = intval($r['course_id']);
			$source = 'manual';
			if ($r['lesson_id'] !== null && intval($r['lesson_id']) > 0) {
				$lesson = array('id' => intval($r['lesson_id']), 'course_id' => $course_id);
			}
		}

		if ($course_id === null) {
			// …existing numbered-exercise / keyword / majority / default
			// logic unchanged, but set $source to 'exercise_number',
			// 'exercise_keyword', 'student_majority' or 'default' on each
			// branch so row_out() can report it…
		}
```

Keep everything else identical. When `$lesson` came from an override, don't
re-derive it from the exercise text.

### A4. `PUT /tpc_import/row/{id}` — accept the two new fields

The existing row-edit endpoint currently whitelists date/registration/times
etc. (`tpc_import.model.php:245`). Add `course_id` and `lesson_id` to that
whitelist, accepting `null` to clear:

```php
		foreach (array('flight_date', 'registration', 'brakes_off', /* …existing… */,
			'course_id', 'lesson_id') as $f) {
```

Validate: `course_id` must belong to this run's club (or be null);
`lesson_id` must belong to `course_id` (or be null). Reject with
`{success:false, message:"That lesson isn't part of the selected course."}`.
Editing these two must **not** trigger the re-match/clear behaviour that
date/registration edits do — they don't affect flight matching.

### A5. `GET /tpc_import/courses/{club_id}` — picker data

One call, everything the cascading pickers need:

```json
{ "success": true, "courses": [
  { "id": 12, "title": "PPL(A)", "lessons": [ { "id": 88, "title": "Ex 14 — First Solo" }, … ] },
  { "id": 19, "title": "IMC Rating", "lessons": [ … ] }
] }
```

Club managers/instructors; ordered by course title then lesson order.

---

# PART B — bulk reassignment of APPLIED training records

A club-manager screen (Settings → Data Import area) that finds training
records filed under the wrong course and moves them.

### B1. `GET /training_records/search`

Query params (all optional, AND-combined):
`club_id` (**required**), `course_id`, `student_user_id`, `instructor_user_id`,
`from`, `to` (YYYY-MM-DD, on the flight date), `registration`, `q`
(substring of `general_remarks` — this is where the importer wrote
`Ex: <exercise>`), `lesson_id` (`0` = "no lesson set"),
`imported_only` (1 = only rows whose remarks carry a `[TPC import …]` tag),
`page`, `per_page` (default 50, cap 200).

```json
{ "success": true, "total": 431, "page": 1, "per_page": 50, "items": [
  { "id": 9021, "flight_date": "2025-04-24", "registration": "G-WARV",
    "student_user_id": 88, "student_name": "Pilar Reina Caviedes",
    "instructor_name": "Celine Walley",
    "course_id": 12, "course_title": "PPL(A)",
    "lesson_id": null, "lesson_title": null,
    "exercise": "IMC nav", "general_remarks": "Ex: IMC nav [TPC import 2025:1354]",
    "imported": true, "plane_log_sheet_id": 63169 }
] }
```

`exercise` here = the text after `Ex: ` in `general_remarks` when present
(convenience for the UI; null otherwise).

### B2. `POST /training_records/reassign`

```json
{ "club_id": 3, "record_ids": [9021, 9022, …], "course_id": 19, "lesson_id": 305 }
```

- `lesson_id` optional/nullable — when omitted or null, **clear** the lesson
  (the instructor sets it later on the record itself).
- Validate every record belongs to `club_id`; validate `lesson_id` belongs to
  `course_id`. Cap `record_ids` at 500 per call (the UI batches).
- Response:

```json
{ "success": true, "result": { "moved": 24, "skipped": 0 }, "skipped_ids": [] }
```

- Errors: `BAD_COURSE` (course not in club), `BAD_LESSON` (lesson not in
  course), `NOT_FOUND` (no records matched), `FORBIDDEN` (not a manager).
- **Audit:** append a short note to each moved record's `general_remarks`
  (e.g. ` [moved PPL(A)→IMC Rating by {user} on {date}]`) or log to whatever
  audit table training records use — this is a bulk mutation of instructor
  records and needs a trail.

Club managers only (the frontend gates on the same, backend authoritative).

---

## Acceptance criteria

1. A staged row with a blank exercise returns `course_source: "default"` and
   the PPL course id — the UI flags it for review.
2. `PUT /tpc_import/row/{id}` with `{course_id: 19, lesson_id: null}` stores
   the override; re-fetching the row shows `course_id: 19`,
   `course_source: "manual"`, and applying files the training record under
   course 19 with no lesson.
3. `PUT` with a `lesson_id` that isn't in `course_id` → clean error message.
4. Editing course/lesson does NOT clear the flight match or re-run matching.
5. `GET /training_records/search?club_id=3&course_id=12&q=IMC` returns only
   PPL-filed records whose remarks mention IMC, paged, with course/lesson
   titles resolved.
6. `POST /training_records/reassign` moves 24 records to the IMC course,
   leaves `lesson_id` null when not supplied, and each record's remarks (or
   audit log) records the move.
7. Reassigning a record that isn't in `club_id` is refused, not silently
   skipped.
