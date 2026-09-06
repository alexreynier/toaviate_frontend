# BACKEND_CAA_CANDIDATE_INSTRUCTOR_GUIDE.md
### Training-flight candidates = ONLY the calling instructor's own dual flights (v2)

**Audience:** the backend agent. Self-contained, copy-paste ready.
**v2 — supersedes the earlier version of this file**: instead of merely
labelling each candidate with its instructor, the list must be **filtered**
to flights the CALLING instructor conducted. If v1 was already applied,
keep the join from step 1 and apply steps 2–3 on top.

**Why.** An FCL.740.A training-flight endorsement asserts the signing
instructor personally conducted the training. The candidate strip currently
offers every dual flight of the subject — including colleagues' flights —
for one-click endorsement. Product rule (agreed): show only flights where
**the caller was the recorded instructor AND the student flew dual**.
The validity-period bound needs no change — the candidate loop already runs
inside the anchored 24-month window.

## Copy-paste

### 1. `api/v1/models/personal_logbook.model.php` — expose the instructor
*(identical to v1 — skip if already applied)*

Club entries SELECT (~line 101):

```php
                       pic_u.first_name AS pic_first, pic_u.last_name AS pic_last,
                       instr_u.first_name AS instr_first, instr_u.last_name AS instr_last
```

JOIN (next to the `pic_u` join):

```php
                LEFT JOIN users instr_u ON pls.instructor_id = instr_u.id
```

Club entry array — replace `"instructor_name" => null,` (~line 175):

```php
                "instructor_id"    => (int)$r['instructor_id'] > 0 ? (int)$r['instructor_id'] : null,
                "instructor_name"  => ((int)$r['instructor_id'] > 0 && $r['instr_first']) ? trim($r['instr_first'].' '.$r['instr_last']) : null,
```

Manual entry array (~line 361): `"instructor_id" => null,`

### 2. Thread the caller into the eligibility run

`api/v1/models/caa_forms.model.php` — both call sites already have
`$caller` in scope:

Prefill (~line 1336):

```php
			$check = $eligibility->run($entry['eligibility'], $user_id, $rating, $expiry_date, $caller);
```

Submit-time snapshot refresh (~line 571):

```php
			$check = $eligibility->run($entry['eligibility'], (int)$row['subject_user_id'], $rating, $anchor, $caller);
```

### 3. `api/v1/models/caa_form_eligibility.model.php` — filter the candidates

`run()` (~line 40):

```php
	public function run($check_name, $user_id, $class_rating = 'SEP', $expiry_override = null, $for_instructor_id = null){
		if($check_name === 'fcl740a'){
			return $this->fcl740a($user_id, $class_rating, $expiry_override, $for_instructor_id);
		}
		return null;
	}
```

`fcl740a()` signature (~line 120):

```php
	public function fcl740a($user_id, $class_rating = 'SEP', $expiry_override = null, $for_instructor_id = null){
```

Candidate builder (~line 272) — replace the `if($e_dual > 0){` guard:

```php
			// Candidates = dual flights the CALLING instructor personally
			// conducted (an FCL.740.A stamp asserts exactly that). A null
			// caller (legacy/internal callers) keeps the unfiltered list.
			if($e_dual > 0
				&& ($for_instructor_id === null
					|| (isset($e['instructor_id']) && (int)$e['instructor_id'] === (int)$for_instructor_id))){
				$dual_candidates[] = array(
					"flight_date"     => $e['flight_date'],
					"dual_time"       => $e_dual,
					"registration"    => isset($e['registration']) ? $e['registration'] : null,
					"ref_id"          => isset($e['ref_id']) ? (int)$e['ref_id'] : null,
					"kind"            => isset($e['kind']) ? $e['kind'] : null,
					"instructor_id"   => isset($e['instructor_id']) ? $e['instructor_id'] : null,
					"instructor_name" => isset($e['instructor_name']) ? $e['instructor_name'] : null,
				);
			}
```

## Acceptance criteria

1. Instructor A calls prefill for a pilot who flew dual with A (2 flights)
   and with instructor B (3 flights), all in the window → A gets exactly
   their 2 flights as candidates; B calling gets their 3.
2. A dual flight with **no** `pls.instructor_id` recorded is NOT offered to
   anyone (strict: the stamp asserts personal conduct).
3. Candidates remain bounded to the anchored validity window (unchanged).
4. `training_flight` **evidence/checks are unaffected** — an endorsement by
   ANY instructor still passes the check; only the candidate suggestions
   are caller-scoped.
5. The submit-time frozen snapshot's candidates are scoped to the
   submitting instructor.
6. Club logbook lines now carry real `instructor_id`/`instructor_name`
   (side effect from step 1 — logbook exports improve; eyeball one render).
