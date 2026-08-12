# BACKEND_CAA_CLASS_RATING_FIX.md
### `class_rating` is stripped on skill-test forms — one-line whitelist fix

**Audience:** the backend agent. One line in one file, no migrations.

**The bug.** `FRONTEND_CAA_FORMS_GUIDE.md` documents Type-vs-Class on the
SRG1157 skill test: fill `rating_tested` for a TYPE rating test or
`class_rating` for a CLASS rating test, and the printed Type/Class box ticks
off whichever is filled. The PDF map agrees —
`api/v1/caa_form_templates/srg1157/issue_12_skill_test.map.php` prints
`class_rating` (field, line 26) and `tick_class_rating` (line 115).

But `class_rating` is only whitelisted in `reval_schema()`
(`api/v1/models/caa_form_registry.model.php:50`), **not** in
`skill_test_schema()`. `apply whitelist` (line ~426) silently strips unknown
keys, so a `PUT caa_forms/{id}` with `class_rating` on any skill-test form
drops it: the value never stores, the Class line never prints, and the Class
tick never fires. A class-rating skill test (SEP/MEP/TMG) cannot be recorded.

The frontend editor now sends `class_rating` on skill tests, so this is live
as soon as the whitelist accepts it.

## Copy-paste

`api/v1/models/caa_form_registry.model.php` — in `skill_test_schema()`,
directly after the `rating_tested` line (~line 67):

```php
			'class_rating'         => array('type' => self::T_STRING, 'max' => 60),    // CLASS rating tests (SEP/MEP/TMG…) — fill this OR rating_tested, not both; ticks the printed Class box
```

Nothing else: the srg1157 skill-test map already prints it, the IR variant
map already `unset()`s it (issue_12_ir.map.php:19), and the 2128/2130/1176/
2199 maps simply have no placement for it, so a stray value is harmless
there.

## Acceptance criteria

1. `PUT caa_forms/{id}` on an `srg1157_skill_test` draft with
   `form_data.class_rating = "SEP (land)"` → `GET caa_forms/{id}` returns it.
2. The generated PDF ticks the Class box and prints "SEP (land)" on the class
   line; the Type box stays unticked when `rating_tested` is empty.
3. `srg1157_ir` PDFs still show neither Type nor Class (IR/SPA row instead).
4. Reval forms unchanged (they always tick Class automatically).
