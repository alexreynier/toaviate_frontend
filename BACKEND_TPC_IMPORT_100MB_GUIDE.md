# BACKEND_TPC_IMPORT_100MB_GUIDE.md
### Raise the training-records workbook upload limit 30 MB → 100 MB

**Audience:** the backend agent. One constant + server config verification.
The frontend is already updated (client-side check, toasts, dropzone label,
and its upload timeout raised to 10 minutes).

## 1. The app-level check — one line

`api/v1/models/tpc_import.model.php` (~line 70):

```php
		if (isset($file['size']) && $file['size'] > 100 * 1024 * 1024) {
			return array('success' => false, 'error' => 'TOO_LARGE', 'message' => 'File is larger than 100 MB.');
		}
```

## 2. ⚠️ Server config — the part the code change can't do

The PHP/webserver limits sit OUTSIDE the repo and currently only need to
clear 30 MB. All of these must comfortably clear 100 MB on every
environment (local / staging / production) or uploads will die at the
gateway with an opaque error before the model ever runs:

```ini
; php.ini (or pool config)
upload_max_filesize = 120M   ; > 100M for multipart overhead
post_max_size       = 128M   ; must exceed upload_max_filesize
max_execution_time  = 300
memory_limit        = 1024M  ; see §3 — xlsx expands 10–50x when parsed
```

Nginx in front (if applicable): `client_max_body_size 128m;`.

Verify with an actual >30 MB upload on each environment, not just the ini
values — proxies and per-vhost overrides bite here.

## 3. Parser headroom — sanity-check, don't assume

A 100 MB .xlsx is zipped XML: parsing can balloon to **multi-GB** memory
depending on the reader. Before calling this done, run the processing step
against a real ~100 MB workbook and watch peak memory:

- If the reader loads whole sheets into arrays and peaks past `memory_limit`,
  either stream rows (row-by-row reader) or cap the limit lower (e.g. 60 MB)
  to what the parser genuinely survives — a limit the processor can't chew
  is worse than a smaller honest one.
- Also confirm the background "processing" phase (post-upload matching) has
  no separate timeout that a 10× bigger file now trips.

## Acceptance criteria

1. A 90 MB .xlsx uploads successfully on production config and processes to
   the review screen without memory/timeout errors.
2. A 105 MB file gets the clean `TOO_LARGE` JSON (not a gateway 413/500).
3. A 25 MB file behaves exactly as before (no regression).
