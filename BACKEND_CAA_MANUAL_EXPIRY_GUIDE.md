# BACKEND_CAA_MANUAL_EXPIRY_GUIDE.md
### Reval prefill: anchor the FCL.740.A computation to a manually entered expiry

**Audience:** the backend agent. Copy-paste ready — one new optional query
param threaded through three files, no schema changes, no migrations.

**Why.** When a pilot's profile has no current SEP/TMG rating with an expiry,
the reval prefill can only show today-anchored hours and an empty checklist.
But the instructor is usually holding the pilot's paper licence — they KNOW
the expiry. The frontend now shows a "Rating expiry (from the licence in
hand)" date box that re-calls prefill with `?expiry_date=YYYY-MM-DD`; the
backend should anchor the whole computation (12m/24m windows, all four
checks, training-flight evidence/candidates, `new_expiry_date` = +24 months,
and the §3.1 hour-field seeding) to that date — exactly as if the rating row
existed with that expiry.

The frontend is already live and degrades gracefully: if the param is
ignored it detects the still-empty checklist and toasts "the server may not
support manual expiry yet".

## Contract

`GET caa_forms/prefill/{form_type}/{user_id}?club_id=&expiry_date=YYYY-MM-DD`

- Only meaningful on the reval types (the eligibility hook); harmless elsewhere.
- **An explicit `expiry_date` wins** over the profile rating row (lets the
  instructor correct a stale profile too).
- Response `eligibility` gains `"anchor_source": "manual"` (vs `"rating"`);
  `has_rating` stays honest (`false` when no rating row exists);
  `window_anchor` is `"expiry_date"` so the existing §3.1 seeding condition
  in `CaaForms::prefill()` fires unchanged.
- Invalid/malformed dates are ignored (existing behaviour applies).

## Copy-paste

### 1. `api/v1/controllers/caa_forms.controller.php` (~line 77)

```php
            $course_id = isset($_GET['course_id']) ? (int) $_GET['course_id'] : 0;
            $expiry_date = isset($_GET['expiry_date']) ? trim($_GET['expiry_date']) : null;
            return $forms->prefill($auth, $arg, (int) $arg_id, $club_id, $course_id, $expiry_date);
```

### 2. `api/v1/models/caa_forms.model.php` — `prefill()` (~line 1297)

Signature:

```php
	public function prefill($authenticated, $form_type, $user_id, $club_id, $course_id = 0, $expiry_date = null){
```

And where the eligibility runs (~line 1329):

```php
			$check = $eligibility->run($entry['eligibility'], $user_id, $rating, $expiry_date);
```

### 3. `api/v1/models/caa_form_eligibility.model.php`

`run()` (~line 40):

```php
	public function run($check_name, $user_id, $class_rating = 'SEP', $expiry_override = null){
		if($check_name === 'fcl740a'){
			return $this->fcl740a($user_id, $class_rating, $expiry_override);
		}
		return null;
	}
```

`fcl740a()` — signature (~line 110):

```php
	public function fcl740a($user_id, $class_rating = 'SEP', $expiry_override = null){
```

Directly after `$family = ...`, validate the override:

```php
		// Manual anchor: the instructor entered the expiry off the paper
		// licence (profile has no/stale rating row). An explicit date WINS.
		$override = null;
		if($expiry_override !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$expiry_override)
			&& strtotime($expiry_override) !== false){
			$override = $expiry_override;
		}
```

Change the no-rating guard so it only fires without an override
(existing today-anchored block unchanged inside):

```php
		if(count($rows) === 0 && $override === null){
```

Where `$expiry` / `$abbreviation` are set from the rating row (~line 155),
let the override take precedence:

```php
		$manual = false;
		if($override !== null){
			$expiry = $override;
			$abbreviation = count($rows) > 0 ? $rows[0]['abbreviation'] : $family;
			$manual = true;
		} else {
			$expiry = $rows[0]['expiry_date'];
			$abbreviation = $rows[0]['abbreviation'];
		}
```

In the final (expiry-anchored) return array (~line 270, alongside
`"window_anchor" => "expiry_date"`), replace the hard-coded rating flag:

```php
			"has_rating"      => count($rows) > 0,
			"anchor_source"   => $manual ? "manual" : "rating",
```

## Acceptance criteria

1. No rating row + `?expiry_date=2026-10-31` → full `checks[]`, `windows`
   anchored 2025-10-31→2026-10-31 (12m) and 2024-10-31→2026-10-31 (24m),
   `new_expiry_date: 2028-10-31`, `has_rating: false`,
   `anchor_source: "manual"`, and `fields` seeded with
   `total_hours_validity` / `total_hours_12m` / `pic_hours_12m` /
   `previous_expiry_date` / `new_expiry_date`.
2. Rating row exists + `?expiry_date=` → the manual date wins,
   `anchor_source: "manual"`, `has_rating: true`.
3. No param → behaviour unchanged (`anchor_source: "rating"` on the normal
   path; today-anchored display block when no rating).
4. `?expiry_date=garbage` / `2026-13-45` → ignored, behaves like no param.
5. Non-reval form types are unaffected by the param.
