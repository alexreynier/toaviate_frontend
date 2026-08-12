# BACKEND_CAA_FORM_DATA_DECODE_FIX.md
### Every real-API form_data save fails: "form_data must be an object." — 2-line fix

**Audience:** the backend agent. One method in one file, no migrations.

**The bug (reproduced in the live app).** Creating a CAA form draft from the
wizard toasts *"Could Not Create — form_data must be an object."*; saving a
draft would fail the same way. Root cause:

- The API framework decodes request bodies **without** the assoc flag —
  `api/v1/api.php:126` `json_decode($raw_json)` and `api/v1/routes.php:83`
  `$this->content = json_decode($my_json)` — so every **nested** JSON object
  (like `form_data`) reaches the model as a `stdClass`, not an array.
- `CaaForms::body_to_array()` only array-ifies the TOP level of the body.
- `CaaForms::validate_and_clean_form_data()` (`caa_forms.model.php:436`)
  gates on `is_array($raw)` → a `stdClass` always fails → every
  `POST caa_forms` carrying `form_data` and every `PUT caa_forms/{id}`
  (the entire draft editor) is rejected over HTTP.

**Why the 137-check harness stayed green:** it exercises the model with PHP
arrays directly, so it never goes through the HTTP `json_decode` — add one
HTTP-shaped check (below) so this class of bug can't pass again.

## Copy-paste

`api/v1/models/caa_forms.model.php` — top of `validate_and_clean_form_data`
(line ~435):

```php
	/** Run the registry whitelist + size cap. Returns an error string or null. */
	private function validate_and_clean_form_data($form_type, $raw, &$clean){
		// The API decodes request bodies WITHOUT the assoc flag, so nested
		// JSON objects arrive as stdClass — normalise (recursively: sections,
		// eligibility, …) before the array-shaped whitelist logic runs.
		if(is_object($raw)){ $raw = json_decode(json_encode($raw), true); }
		if(!is_array($raw)){ return "form_data must be an object."; }
```

(Only the `is_object` line is new; everything below it is unchanged. The
round-trip re-encode converts nested `stdClass` — `sections`, the frozen
`eligibility` snapshot — to associative arrays in one go.)

No other caa_forms endpoint takes nested objects (sign/submit/decline/
external/deputies bodies are flat, and `body_to_array` covers their top
level), so this single spot is sufficient.

## Acceptance criteria

1. Real HTTP `POST /api/v1/caa_forms` with
   `{"club_id":…,"form_type":"srg1107_reval","subject_user_id":…,
   "form_data":{"forenames":"A","surname":"B"}}` → `{success:true, id, status:"draft"}`
   and the row stores the two keys.
2. Real HTTP `PUT /api/v1/caa_forms/{id}` with a `form_data` containing a
   nested `sections` object (e.g. `{"sections":{"1.1":"pass"}}` on a skill
   test) → saved, `GET` returns it intact.
3. `POST caa_forms` **without** `form_data` still works (unchanged path).
4. `form_data: "a string"` / `form_data: 5` still return
   "form_data must be an object."
5. Harness: add at least one test that feeds the model the output of
   `json_decode(json_encode($payload))` (assoc **false**) to mirror the real
   HTTP path.
