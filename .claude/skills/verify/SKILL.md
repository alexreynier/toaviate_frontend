# Verify — ToAviate frontend (AngularJS 1.x)

How to drive this app end-to-end locally when the backend is unavailable.

## Handle

1. **Serve statically with SPA fallback** (html5Mode is on — deep URLs must
   fall back to index.html). A ~25-line node server suffices; serve the repo
   root on a spare port. Do NOT need grunt for dev verification — index.html
   loads every source file directly.
2. **Browser**: Playwright chromium (`npm i playwright && npx playwright
   install chromium` in the scratchpad, NOT in this repo). node lives at
   `~/.nvm/versions/node/v22.14.0/bin` (not on PATH in fresh shells).
3. **Auth without credentials**: the app trusts two cookies —
   `globals` = encodeURIComponent(JSON.stringify({currentUser: {id, email,
   first_name, last_name, authdata, access: {manager:[clubId], instructor:[clubId],
   pilot:[clubId], super_admin:[]}, current_club_admin:{id: clubId, title},
   current_club_instructor: clubId}})) and `session` (JSON string). Set them
   on the served origin before navigation.
4. **Backend**: dev API base is `https://local-api.toaviate.com` (EnvConfig).
   When it's down (SSL/conn refused is common), intercept with
   `page.route('**local-api.toaviate.com/**')` and mock per the relevant
   FRONTEND_*_GUIDE.md response shapes. Default unmatched calls to
   `{success:false, message:'mock-default (METHOD URL)'}` — pages tolerate
   failed side-sections.
5. **REAL-backend auth (no credentials needed)**: mint a session directly in
   the local MAMP DB the way login does. Client:
   `/Applications/MAMP/Library/bin/mysql80/bin/mysql
   --socket=/Applications/MAMP/tmp/mysql/mysql.sock -u toaviate_local -p'<see
   backend api/v1/includes/con.inc.php>' toaviate`. Insert into
   `user_sessions` (user_id, ip='127.0.0.1', asn=0, session_id=64-hex,
   browser=<the EXACT User-Agent Playwright will send — set a custom one>,
   active=1). Auth = `Basic base64(userId + ':' + session_id)`; cookies as in
   §3 with that authdata + session. ASN 0 always matches locally. User 2 =
   manager+instructor of club 2 (TOAVIATE, the dev club). The dev cert is
   invalid → `ignoreHTTPSErrors: true` + `NODE_TLS_REJECT_UNAUTHORIZED=0`.
   **Clean up after**: delete rows you created (via the UI = extra coverage)
   and `UPDATE user_sessions SET active=0 WHERE id=<yours>`.
   A live airfield-display token lives in `airfield_bookout_tokens`.

## Gotchas

- `snazzy-toggle` checkboxes are `opacity:0` — click `.snazzy-toggle__slider`.
- The book-in page (`/dashboard/my_account/book_in/:id`) can leave a blocking
  `snazzy-overlay` up ("Processing your flight...") when Fox/claim endpoints
  are stubbed; clear via
  `angular.element(document.querySelector('.bookingout_wrapper')).scope()`
  → `vm.show_loading = false; vm.different_date_warning = false; $applyAsync()`.
- Airfield display is public: `/bookout-display/:token` — mock
  `/api/v1/airfield_bookout_display/:token` (+ `/today`, `/delta/...`).
- Give pages ~3s after domcontentloaded (Angular bootstrap + $http mocks).
- Console/pageerror capture is essential — a DI typo kills the whole app at
  boot (blank page), which is itself a strong smoke signal.

## Flows worth driving

- `/dashboard/manage_club/settings` — club settings (mock `GET /api/v1/clubs/:id`
  returning the settings object at the response root).
- `/dashboard/my_account/book_in/:id` — mock `GET /api/v1/plane_log_sheets/:id`
  → `{success, unclaimed: [], bookout: {…}}`.
- `/bookout-display/:token` — tower display, no auth needed.
