# CLAUDE.md — ToAviate Frontend

Guidance for AI agents (and humans) working in this repository.

> **This is a legacy AngularJS 1.x application.** A future rewrite is planned, but
> **for now we keep it running exactly as it is.** Do not introduce a build-system
> rewrite, a framework migration, TypeScript, a module bundler, ES modules, or
> `'use strict'` IIFE wrapping unless explicitly asked. Match the surrounding code.

---

## 🚦 The Two Non-Negotiable Rules

Every change you make to the UI **must** satisfy both of these:

1. **Works on desktop AND mobile.**
   This is a responsive web app. Every view, modal, table, and form you touch
   must look and work correctly on both a wide desktop screen and a narrow phone
   screen. Always add/verify the `@media` rules. Never ship a layout that only
   works on one. (See [Responsive / Mobile](#responsive--mobile).)

2. **Uses the new "snazzy" design system.**
   All new pages and any page you redesign must use the snazzy BEM design
   language so the app stays visually consistent. Do **not** add new plain-Bootstrap
   `.panel` / `.table` / inline-`style=""` screens. (See [Design System](#design-system-snazzy).)

If a task can't satisfy both, say so and ask before proceeding.

---

## What this app is

AngularJS **1.x** single-page app (`ng-app="app"`) for flight-school / aviation
club management: bookings, members, memberships, aircraft maintenance & logbooks,
flights, vouchers, payments (Stripe + GoCardless), instructor scheduling, club
admin, and a separate maintenance-organisation workspace.

- **Router:** `ui-router` (state-based). All routes live in [js/app.js](js/app.js).
- **No npm runtime deps in the browser** — every library is a checked-in file in
  [libs/js/](libs/js/) and [libs/css/](libs/css/), loaded via `<script>`/`<link>` in
  [index.html](index.html).
- **Build:** Grunt → `dist/` (see [Build & Deploy](#build--deploy)).

---

## Directory map

```
index.html              Loads every CSS/JS file by hand. THE source of truth for what ships.
js/app.js               Bootstrap, ui-router states, HTTP interceptor, run block, global filters.
js/controllers/         One *Controller.js per screen (PascalCase name). ~120 files.
js/services/            One *Service.js per domain (app.factory). ~70 files. API access lives here.
js/directives/          Custom directives (datetime, dropzones, defect gallery, etc.).
views/                  HTML partials (ui-router templates). Mirrors the route tree:
  views/manageclub/       Club-admin screens (members, flights, planes, maintenance, vouchers…)
  views/my_account/       Member-facing screens (bookings, licences, payments, journey log…)
  views/manageuser/       Instructor screens (schedule, briefing, student records…)
  views/maintenance/      Maintenance-organisation workspace
  views/forms/            Multi-step signup wizards (club / user / passenger / invitation)
  views/modals/           $uibModal templates
css/                     App stylesheets. styles.css (old/global) + snazzy-pages.css (new design) + per-feature files.
libs/                    Checked-in third-party JS/CSS (angular, jquery, fullcalendar, moment, stripe helpers…).
Gruntfile.js             Build pipeline.
dist/                    Build OUTPUT (committed — see hygiene notes).
```

---

## Architecture & conventions

### Services (data layer) — `js/services/*Service.js`

Every service is an `app.factory`, lists `$inject`, exposes named methods, and
talks to the API with the `.then(handleSuccess, handleError2)` convention:

```javascript
app.factory('MemberService', MemberService);
MemberService.$inject = ['$http', '$location'];
function MemberService($http, $location) {
    var service = {};
    service.GetAll = GetAll;
    service.Create = Create;
    return service;

    function GetAll()        { return $http.get('/api/v1/members/').then(handleSuccess, handleError2); }
    function Create(member)  { return $http.post('/api/v1/members/', member).then(handleSuccess, handleError2); }

    function handleSuccess(res) { return res.data; }
    function handleError2(res) {
        if (res.status == 401) { $location.path('/login'); }
        return { success: false, message: res.data, status: res.status };  // resolves, never rejects
    }
}
```

- **API base URL is automatic.** Call `'/api/v1/...'` — the `apiUrlInterceptor` in
  [js/app.js](js/app.js) prefixes it with the per-environment base URL from `EnvConfig`.
- Services **resolve** (not reject) on error, returning `{ success:false, ... }`.
  Controllers branch on `data.success`.

### Controllers — `js/controllers/*Controller.js`

- `controllerAs: 'vm'` everywhere — put view state on `var vm = this;`.
- Always declare `$inject`.
- Read the logged-in user/role/club from `$rootScope.globals.currentUser`:
  - `.id`, `.email`, `.first_name`, `.last_name`
  - `.current_club_admin` (selected admin club object, persisted in `localStorage`)
  - `.current_club_instructor` (default instructor club id)
  - `.access.manager` / `.instructor` / `.pilot` / `.super_admin` — **arrays of club IDs**.
    Check a role with `vm.user.access.manager.indexOf(vm.club_id) > -1`.
- One controller often serves list/add/edit; it branches on
  `vm.action = $state.current.data.action` (the `data.action` set on the route).
- Route params come from `$stateParams`.

### Routing — all in `js/app.js`

States are nested (`dashboard.manage_club.members`, `dashboard.my_account.bookout`,
…). Each defines `url`, `controller`, `templateUrl`, `controllerAs: 'vm'`, and usually
`data: { action: 'list' | 'add' | 'edit' | … }`. Add new screens here following the
existing grouping/comment blocks.

### Modals — `$uibModal` (ui-bootstrap)

Open with `$uibModal.open({ templateUrl, controller, resolve, size, backdrop })`,
pass data via `resolve` (injected into the modal controller), and close with
`$uibModalInstance.close(data)` / `.dismiss('cancel')`. Template lives in
[views/modals/](views/modals/). See [flightEditModalController.js](js/controllers/flightEditModalController.js).

### Double-submit guard — app-wide, automatic

Every `ng-click` / `ng-submit` / `ng-change` (discrete controls) / `ng-key*` is
shadowed by a companion directive ([js/directives/busyGuard.js](js/directives/busyGuard.js)) backed by
[js/services/writeGuardService.js](js/services/writeGuardService.js) (an `$http` interceptor that
tracks in-flight POST/PUT/PATCH/DELETE). If a press starts a write, the pressed
element is disabled, gets `.wg-busy` + a ring spinner ([css/busy-guard.css](css/busy-guard.css)),
and a second press is swallowed until that write — and any write chained off its
response — settles. **Don't add per-button `saving` flags just for double-click
protection**; the guard already covers direct save/edit/delete handlers.

- A press that only validates, navigates or opens a modal never locks.
- `ng-change`: toggles / checkboxes / radios / selects / ui-select are locked (the
  wrapping `<label>` too); text-like inputs and textareas are deliberately NOT, so
  typing is never interrupted. `ng-keydown|keypress|keyup`: nothing is styled, but a
  repeat of the key that fired the write is swallowed while it's in flight.
- `ng-disabled` keeps the final say; buttons with their own `.fa-spin` don't get a second spinner.
- Opt out with the `no-busy-guard` attribute.
- **Outcome feedback is central too:** when a write fails (HTTP error, or a 2xx body
  with `success:false`) and no toast appeared within 150 ms, the interceptor shows a
  generic "Not saved" error toast (`ToastService.lastShownAt` is the de-dup signal).
  Handlers that toast their own message still win. Backend codes a controller handles
  with its own UI are in `HANDLED_CODES` (CONFIRM_REQUIRED, FORBIDDEN, requires_action…)
  and pre-auth endpoints in `SILENT_URLS` — add to those lists rather than suppressing
  the toast elsewhere.
- **Not covered:** flows whose write starts after an external step (Stripe.js
  `createToken`/`confirmSetup`/`confirmPayment`, a preceding GET, `$timeout`) and the
  three data-changing GET endpoints (`fox/reset_*`, `fox/fix_uncombined`,
  `plane_log_sheets/update_tuition_book_in`). Those need their own flag + `ng-disabled`
  — see `$scope.processing` in
  [newChargeModalInstanceController.js](js/controllers/newChargeModalInstanceController.js) and `vm.saving` in
  [dashboardClubVouchersAddController.js](js/controllers/dashboardClubVouchersAddController.js).

### Notifications & errors — **use ToastService, never `alert`/`confirm`/`prompt`**

See [AGENT_GUIDE_ERROR_HANDLING.md](AGENT_GUIDE_ERROR_HANDLING.md) (authoritative).
- `ToastService.success(title, sub)` / `.error(...)` / `.warning(...)`.
- Validate forms before submit with the `id="field-*"` + `.field-error` pattern.

---

## Design System (snazzy)

The new look lives in [css/snazzy-pages.css](css/snazzy-pages.css). It uses **BEM with
page-prefixed blocks**: a block per page, `__element`, `--modifier`.

```
.snazzy-page            page wrapper (centered, max-width ~1400px)
  __header / __title    gradient header band + title + subtitle
  __toolbar / __search-wrap / __count-badge
  __filter-bar / __filter-group / __filter-btn
  __summary-card / __summary-grid / __stat / __stat-value
  __table-card / __table-scroll  +  .snazzy-table (thead has the brand gradient)
  __btn--primary / --success / --danger / --outline
  __empty / __empty-icon         empty states
  __load-more / __spinner        pagination / loading
```

**Numbered pagination — reuse `<snazzy-pager>`** ([js/directives/snazzyPager.js](js/directives/snazzyPager.js),
[css/snazzy-pager.css](css/snazzy-pager.css)) for any server-paged list instead of another one-off pager:
`<snazzy-pager page="vm.page" total="vm.total" per-page="vm.perPage" label="flights" busy="vm.paging"
anchor="#list-top" on-change="vm.goPage(page)">`. Put `snazzy-pager-anchor` on the anchor (clears the fixed nav) and
`ng-class="{'snazzy-pager-busy': vm.paging}"` on the list. Phones show Prev · current · "of N" · Next. Used by the
debrief list (`bookings/instructor_debrief?fd_page&fd_per_page`, page remembered in sessionStorage) and Records to File
(page kept with its filters); both backends clamp a page past the end to the last page.

Page-specific blocks follow the same convention: `members-page__*`, `member-detail__*`,
`ib-card__*` (instructor bookings), `receipt-approval-card__*`, `shop-page__*`, etc.

**Canonical examples to copy from:**
- List page: [views/manageclub/members.html](views/manageclub/members.html)
- Detail/edit form: [views/manageclub/member_form.html](views/manageclub/member_form.html)
- Table with mobile-card fallback: [views/manageclub/flights.html](views/manageclub/flights.html)

### Design tokens (use these — don't invent new colours)

| Role | Value |
|---|---|
| Brand gradient (headers, primary) | `linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)` |
| Brand solid | `#1e3a5f` / `#2d5a8e` |
| Success | `#16a34a` (dot `#22c55e`) · Danger `#dc2626` · Warning `#fef3c7`/`#92400e` · Info `#dbeafe`/`#1e40af` |
| Text | `#1e293b` (dark) · `#334155` · `#64748b` (muted) · `#94a3b8` (light) |
| Surfaces | `#fff` · `#f8fafc` · hover `#f1f5f9` · border `#e2e8f0` |
| Radius | inputs/buttons `8px` · cards `12px` · header `16px` |
| Focus ring | `0 0 0 3px rgba(59,130,246,0.12)` |

### Rules for new/redesigned UI
- Use the snazzy BEM classes; **no inline `style=""`**, no new `.panel`/`.table` screens.
- Reuse existing component classes before adding new ones.
- Put new page CSS in a dedicated `css/<feature>.css` file **and register it in both
  [index.html](index.html) and [Gruntfile.js](Gruntfile.js)** (see the build gotcha below).
- Night mode: scope overrides under `body.night-mode` — see [NIGHT_MODE_GUIDE.md](NIGHT_MODE_GUIDE.md).

---

## Responsive / Mobile

The app must work on phones (`<meta name="viewport" content="width=device-width, initial-scale=1.0">`
is already set). When adding or changing UI:

- **Breakpoints in use:** `768px` (primary), `640px`, `600px`, `480px`, `420px`.
- **Common patterns:** flex/grid that wraps at 768px; `grid-template-columns: repeat(auto-fit, minmax(180px,1fr))`
  for stat grids; `.snazzy-table__hide-mobile` to drop non-essential table columns;
  swapping a wide table for stacked cards on narrow screens (see flights.html);
  footers/button-bars switching to `flex-direction: column`.
- **Always test/verify both widths.** A change is not done until it works on mobile.
- **Text controls stay ≥16px on phones.** iOS Safari zooms the page when a focused input is smaller and
  the SPA never zooms back out (the "everything is zoomed + horizontal scroll" bug). A global
  `≤768px → 16px !important` guard sits at the end of snazzy-pages.css; never add a smaller mobile input
  size and never reach for `maximum-scale=1` in the viewport meta.

---

## Build & Deploy

```bash
npm install -g grunt-cli && npm install
grunt                 # development build → dist/
grunt staging         # staging API endpoint
grunt production      # production API endpoint
```

The Grunt default task: clean → copy → concat (JS + CSS into bundles) →
`string-replace` the `environment` var → babel (transpile + `angularjs-annotate` DI) →
cssmin → uglify (`drop_console: true`, so `console.*` is stripped in prod only) →
rev (cache-bust) → usemin → clean. Output goes to `dist/`. See [README.md](README.md).

### ⚠️ Build gotchas — read before touching CSS/JS files

1. **Two registration points.** A new JS/CSS file must be added to **both**:
   - [index.html](index.html) `<script>`/`<link>` (used in dev), **and**
   - [Gruntfile.js](Gruntfile.js): JS is globbed (`js/controllers/*.js` etc.), but **CSS is an
     explicit hand-maintained list** in `concat.css`. Forgetting the CSS list = the file
     works in dev but is **silently missing in production**.
2. **CSS parity:** every `css/*.css` linked in index.html is now also in the Gruntfile
   `concat.css` list, so dev and prod match. When you add a new CSS file, remember to
   add it to **both** lists or it'll be missing from prod again. (`css/accordion.css`
   was previously bundled-but-not-linked; it carries a global `body { padding:24px }`
   that overrode `styles.css`'s `body { padding:50px 0 }` in the prod bundle only,
   pushing every page up under the fixed header. It is now removed from the Gruntfile
   concat list — don't re-add it.)
3. Environment config (API URLs, Stripe keys) lives in
   [js/services/envConfigService.js](js/services/envConfigService.js); the build swaps the
   `environment` value in the **output only**, never the source.

---

## Adding a feature — the repeatable checklist

1. **Service** in `js/services/<x>Service.js` (`app.factory`, `$inject`, `.then(handleSuccess, handleError2)`).
2. **Controller** in `js/controllers/<x>Controller.js` (`controllerAs: 'vm'`, `$inject`, read
   user/club from `$rootScope.globals.currentUser`, branch on `$state.current.data.action`).
3. **View** in `views/<area>/<x>.html` using the **snazzy** design + **mobile media queries**.
4. **Route** in `js/app.js`.
5. **Register** the new JS files in [index.html](index.html) (and new CSS in **both** index.html
   *and* `Gruntfile.js` `concat.css`).
6. **Notifications** via `ToastService` (never `alert`/`confirm`/`prompt`).
7. **Verify on desktop and mobile.**

---

## Glaring issues to be aware of (do NOT fix silently — flag/confirm first)

Catalogued here so agents don't trip over them. These are pre-existing; the app
"works as-is." If a task requires touching one, raise it explicitly.

**Security (highest priority for a future hardening pass):**
- **API key shipped in client JS** for all environments —
  [envConfigService.js](js/services/envConfigService.js) (`api_key` = base64 of a plaintext string).
- **Custom Base64 "auth"** (session+credential base64-encoded in request body) — encoding,
  not encryption; relies entirely on the server + HTTPS.
- **Client-side route guard** — the `$locationChangeStart` handler in [js/app.js](js/app.js)
  now redirects logged-out users to `/login`. It uses the full `publicPages` allow-list,
  `event.preventDefault()`s the disallowed navigation, and skips when already heading to
  `/login`, so it can't double-fire or loop with the services' 401 → `/login` redirects.
  Server-side auth is still the real enforcement; this is a UX guard.
- **Auth token scheme** — the Base64 in `authenticationService.js` encodes a single-use
  server-generated token (not the account username/password), so it is *not* a credential-
  exposure issue. Leave it as-is.

**Stripe (how card payments are wired — updated 2026-07):**
- **Publishable keys are per-club AND per payment mode, fetched at runtime** via
  `PaymentService.GetClubStripeKey(club_id)` (`GET /payment_mode/{club_id}/config`).
  There are **no Stripe keys in [envConfigService.js](js/services/envConfigService.js)** — don't add one.
  The helper also waits for Stripe.js itself to load (it's an `async` CDN script), caches
  the key with a 10-minute TTL (bounds staleness after a payment-mode switch), and rejects
  with `{code:'not_configured'}` / `{code:'stripe_js_unavailable'}` — always `.catch` and
  show the matching message (see existing call sites).
- **Modern flows** (payment accordion in [datetime.js](js/directives/datetime.js), booking 3DS,
  membership/my-account add-card, invitation signup) use PaymentIntents/SetupIntents +
  Payment Element. Saved cards live on a **per-club Stripe customer** (`cards/get_member_cards`,
  `update_default_card`, `delete_member_card`); add-card = `cards/create_new_customer`
  (returns a SetupIntent secret) → `confirmSetup` → `cards/confirm_setup` to finalise.
- **Legacy Tokens API still live in two flows** — voucher add
  ([dashboardClubVouchersAddController.js](js/controllers/dashboardClubVouchersAddController.js)) and the
  new-charge modal ([newChargeModalInstanceController.js](js/controllers/newChargeModalInstanceController.js))
  use a card Element + `stripe.createToken`, and their backend endpoints expect token ids.
  Migrating them to PaymentIntents **requires backend changes** — don't attempt it frontend-only.

**Correctness / maintainability:**
- `CheckLoggedIn` compares objects with `==` (reference compare → effectively always false) —
  [authenticationService.js:175](js/services/authenticationService.js#L175).
- Duplicated logic kept side-by-side: `SetCredentials`/`SetCredentials2`
  ([authenticationService.js](js/services/authenticationService.js)) and `propsFilter`/`propsFilterA`
  ([app.js](js/app.js)). Confirm which is live before editing either.
- Multi-step `Login0/1/2/3` flow — confirm which path is current before changing login.

**Repo hygiene (footguns when navigating):**
- Many stale backups committed: `views/**/*.bak`, `*.bak2`, `*-bkup`, `*=-v6-fail`,
  `*.htmlbkupnov25`, `*.bkupbkupbkup`, `the_shop.html.bak`, etc. **The live file is the one
  referenced by a route in `js/app.js`** — verify before editing a look-alike.
- Committed build/working artifacts: `dist/`, `temp/`, a 10 MB `airports.json`, and stray
  experiments at root (`ocr-poc*.html`, `analyze_divs*.py`, `upload_documents.php`).
  `.gitignore` only ignores `node_modules/` + `node_modules_bkup/`.

**Platform:** AngularJS 1.x is end-of-life (no security patches). The planned rewrite
addresses this; until then, no new Angular-1 dependencies.

---

## Safety Management System (SMS)

A self-contained module (added 2026-05) for hazard/occurrence reporting, risk
register, audits/findings, actions, management-of-change, meetings, documents,
instructor oversight, students, ERP, bulletins, acknowledgements and a CAA audit
view. Per-club and role-gated. Backend contract: `FRONTEND_SMS_GUIDE.md` /
`BACKEND_SMS_GUIDE.md`.

- **Service:** [js/services/smsService.js](js/services/smsService.js) — every endpoint;
  also exposes `.enums` (shared dropdown values). [js/services/smsAccessService.js](js/services/smsAccessService.js)
  resolves the user's SMS role (`isAdmin` / `isSafetyManager`) from club role + `/sms/settings`.
- **Controllers:** [js/controllers/smsController.js](js/controllers/smsController.js) (admin — one
  controller for all admin screens, dispatched by `$state.current.data.screen`),
  [js/controllers/smsMemberController.js](js/controllers/smsMemberController.js) (member screens),
  [js/controllers/smsModalControllers.js](js/controllers/smsModalControllers.js) (detail / risk / action / bulletin modals).
- **Views:** `views/manageclub/sms/` (admin; shared sub-nav in `_nav.html`, modals in `sms/modals/`)
  and `views/my_account/sms/` (member). **Design system:** [css/sms.css](css/sms.css) — `.sms-*` BEM,
  snazzy + mobile + animations. Reuse these classes; don't invent new ones.
- **Entry points:** admin tile in `views/manage_club.html` → `dashboard.manage_club.sms`;
  member tile in `views/my_account/home.html` → `dashboard.my_account.sms`.
- **Role gating:** the backend is authoritative — an `error:'FORBIDDEN'` response means
  hide/disable the control. The service normalises that onto `data.error`; controllers
  gate admin-only buttons with `vm.access.isAdmin` / `vm.access.isSafetyManager`.
- **Conventions:** references (`HAZ-2026-0001`…) are backend-generated — display, never send.
  Risk scores are computed server-side — submit only `likelihood`/`severity`. Hazards can be
  anonymous (`is_anonymous:1` → no reporter returned).

## Two-Factor Authentication & Passkeys

Optional TOTP 2FA + WebAuthn passkeys (added 2026-08). Backend contract:
`FRONTEND_TWO_FACTOR_GUIDE.md`.

- **Services:** [js/services/twoFactorService.js](js/services/twoFactorService.js) (status/setup/confirm/
  disable/recovery codes + super-admin club requirement & admin reset) and
  [js/services/webauthnService.js](js/services/webauthnService.js) (owns base64url⇄ArrayBuffer conversion and
  wraps each full ceremony — options → browser prompt → verify — in one promise).
  The 2FA *login* step (`users/login_2fa`) is `Login2FA` in
  [authenticationService.js](js/services/authenticationService.js), using the same `Base64.encode(token + "," + code)`
  convention as the login ladder.
- **Login screen** ([loginController.js](js/controllers/loginController.js) / [views/login.html](views/login.html)): `vm.stage`
  `'password'|'code'`; passkey button shows only when `WebauthnService.isSupported()`.
  All three entry paths funnel through `completeLogin()`.
- **Member page:** `dashboard.my_account.security` →
  [securitySettingsController.js](js/controllers/securitySettingsController.js) + [views/my_account/security.html](views/my_account/security.html);
  modals (enable wizard, show-once recovery codes, passkey add/rename/delete) in
  [securityModalControllers.js](js/controllers/securityModalControllers.js) + `views/modals/security_*.html`. CSS:
  [css/security.css](css/security.css) (`.sec-*` / `.security-page` / `.sa-security` / `.login-*` BEM).
- **Super-admin:** `dashboard.super_admin.security` → per-club "require 2FA" toggle +
  lockout reset ([superAdminSecurityController.js](js/controllers/superAdminSecurityController.js)).
- **Enrolment lock:** when login2 returns `two_factor_setup_required`, loginController
  sets localStorage `toaviate_2fa_setup_required=<user_id>`; the `$locationChangeStart`
  guard in app.js pins `/dashboard*` navigation to the Security page until
  SecuritySettingsController clears the flag (backend re-asserts it every login).
- **⚠️ Interceptor:** the pre-auth passkey endpoints are exempted via
  `'/api/v1/webauthn/login'` in the `unauthEndpoints` list in app.js — any new
  pre-auth auth endpoint must be added there (or named `users/login*`) or a 401
  from it triggers the global "session expired" logout.
- **Session freeze + idle blur** (index.html overlays + run block in app.js +
  interceptor): the first authenticated 401 no longer bounces to /login — it sets
  `$rootScope.sessionFrozen`, blurs the whole app under a "You've been logged out"
  overlay, and the `$locationChangeStart` guard swallows ALL navigation until the
  user clicks through (return-URL then works as usual). A 401 only freezes when a user is
  logged in AND the page isn't public (`$rootScope.isPublicPath` — the same `publicPages` list as the
  route guard): a logged-out invitee hitting a login-only endpoint on a signup wizard froze their form
  (2026-11-02). Separately, 5 min of
  inactivity sets `$rootScope.idleBlurred` (privacy blur, nothing logged out);
  waking probes `two_factor/status` — a 401 converts it into the frozen overlay.
  ToastService suppresses per-controller 401 toasts (object OR message-string
  form) so the overlay is the single voice. The overlays are LAST in `<body>`
  at z-index int32-max on purpose — the fixed header's 9999999999 clamps to the
  same value and only document order beats it.
- **QR codes** are rendered client-side (the TOTP secret must not leave the page)
  with the checked-in [libs/js/qrcode-generator.js](libs/js/qrcode-generator.js) (global `qrcode`), registered in
  both index.html and the Gruntfile `libs` concat list.
- Show-once secrets (TOTP secret, recovery codes) use `backdrop:'static'` modals
  and are never re-fetchable — don't add endpoints or caching that would change that.

## Account Email Addresses & Step-Up Authentication

One account, one primary + verified secondaries, every mutation behind a
step-up (password + second factor). Added 2026-10-26; contract and the list of
every file: `FRONTEND_ACCOUNT_EMAILS_GUIDE.md` (backend repo), rationale
`ACCOUNT_EMAILS_DESIGN.md`.

- **`StepUpService.Run(opts, action)`** ([js/services/stepUpService.js](js/services/stepUpService.js))
  is the one entry point for anything step-up-gated (now: emails; later:
  password change, passkey enrolment). It opens `views/modals/step_up.html`,
  retries once on `STEP_UP_REQUIRED`, resolves `{error:'CANCELLED'}` on back-out.
- **Security page card** `AccountEmailsController as ae` in
  [views/my_account/security.html](views/my_account/security.html) (`.ae-*`,
  [css/account-emails.css](css/account-emails.css)); make-primary updates
  `$rootScope.globals.currentUser.email` + re-persists the globals cookie, never
  re-runs `SetCredentials`.
- **Public pages** `/email_confirm/:token` and `/email_cancel/:token` are baked
  into emails — paths can never change; GET only displays, POST acts (mail
  scanners prefetch links). Any failure → one uniform "invalid or expired" panel.
- **Staff recovery** `AdminEmailRecoveryController as rec` on the super-admin
  Security page (`.aer-*`); backend enforces `FOUR_EYES` / `ADMIN_2FA_REQUIRED`.
- Every backend code from this feature is in the write-guard `HANDLED_CODES`;
  `/account_email_confirm/` is in `SILENT_URLS`. Add new codes there, not ad hoc.

## Track Data (per-leg replay, track events, reconciliation)

Fox tracker recordings now yield track-derived events and a tracker·track·sheet
reconciliation (added 2026-10-26; contract `FRONTEND_TRACK_DATA_GUIDE.md` /
`BACKEND_TRACK_DATA_GUIDE.md` in the backend repo).

- **Service:** [js/services/foxTrackService.js](js/services/foxTrackService.js) — every `fox_track/*`
  call plus the SHARED copy helpers (`verdictLabel`, `methodLabel`, `landingKindLabel`,
  `countsSourceChip`, `flagLabel`). Name a verdict/flag/source through these, never ad hoc.
- **Directives:** `<track-reconciliation pls-id club-id>` ([js/directives/trackReconciliation.js](js/directives/trackReconciliation.js),
  `.trc-*`) renders nothing on NO_TRACK/FORBIDDEN and emits `trackCounts:applied` after a
  staff Apply; `<track-counts-chip source>` (`.tcs-chip--*`) goes beside any landing counts.
  Mounted on the instructor debrief and the flight-edit modal; the book-in form uses the chip.
- **Replay:** events ride `FlightMapAdapter.setPins` (coloured dots — the adapter only draws
  circles) and ticks on the scrubber strip (the height profile canvas is a separate directive).
- **Admin:** `dashboard.super_admin.fox_track_tools?imei` (`.ftt-*`) — backfill loop, segments,
  inspect, links scan → repair / undo / resolve. Resolve and repair log under one batch label;
  Undo reverses the whole batch.
- **Suspect splits** (`<suspect-splits club-id admin>`, [js/directives/suspectSplits.js](js/directives/suspectSplits.js), `.ssp-*`):
  manager page `dashboard.manage_club.split_review` (`/flights/split_review`, linked from the flights
  toolbar) and a card on the admin track tools. Undo folds leg 2 back ONLY on a phantom boundary
  (`NOT_SUSPECT` otherwise) — a mistaken but genuine split is released through **Cancel claim**.
- **Where the reconciliation shows:** ONLY on the ToAviate-admin track tools page
  (`dashboard.super_admin.fox_track_tools?pls=<id>`, "Flight analysis" card, `start-open="true"`).
  The debrief and flight-edit screens show a link there for ToAviate staff (`isToAviateStaff()`)
  and nothing for anyone else; the `<track-counts-chip>` was removed from member-facing forms.
  The book-in form seeds landing counts from the live recommendation (`prefill_counts_from_track`).
  Claim a Flight shows ONE airborne time / landing count per row ("most accurate wins": the track file's
  figure when `track_calculated_status == 'ok'`, else the tracker's — `vm.best_airborne_seconds` /
  `vm.best_landings`); the source is a tooltip only. The maintenance-logbook side of the same rule
  (which airborne time the airframe/engine/prop logbooks sum, with an `airborne_source` stamp) is
  SPEC'd in the backend repo's `BACKEND_AIRBORNE_SOURCE_GUIDE.md` — not built yet.
- **Cancel claim** (Manage Club → Flights, manager only; `views/modals/cancelClaimModal.html`,
  `CancelClaimService`, contract `FRONTEND_FLIGHT_CLAIM_CANCELLATION_GUIDE.md`) is the "release this
  flight back to Claim a Flight" action: money reversed, invoices voided, records archived, sheet reset
  to `fox_claimed = 2`. On a split pair it releases BOTH legs and recombines them into one placeholder —
  contract `FRONTEND_FLIGHT_CLAIM_CANCELLATION_GUIDE.md` §9 (`split` block; `OTHER_LEG_ACKNOWLEDGEMENT_REQUIRED`
  → checkbox; `BLOCKED` + blockers; money for a shared booking is reversed once, on leg 1).
- The backend's error codes for this feature are in the write-guard `HANDLED_CODES`.

## Members hub (Manage Club → Members / Requests / Instructors / Missing Students)

`dashboard.manage_club.members_hub` is an abstract PARENT state (`views/manageclub/members_hub.html`,
`MembersHubController as hub`) that owns the gradient header + tab bar; the four screens are its children
(declared with `parent:` so their names, URLs, controllers and `data` are unchanged —
`dashboard.manage_instructor_bookings` keeps its top-level URL via `url: '^/dashboard/…'`). Only the nested
`<ui-view class="mhub__view">` swaps, so the chrome never re-renders and the width is stable. Each child sets
`data.hub = { title, subtitle, icon }`; child templates start at their body (`.snazzy-page--hub` /
`.members-page--hub`, padding 0). **ui-router gotcha:** a state is only queued when its DOTTED-name parent is
missing, so a child that names the hub via `parent:` must be registered AFTER the hub in app.js (the hub sits
directly under `dashboard.manage_club`). The host `ui-view` is widened with `:has(> .mhub)` because
`.centre_align_boxes2 > div` is a centred flex row that shrink-wraps pages to their content.

## Hours Instructed (instructor dashboard)

`dashboard.manage_user.instructed_hours` (tile HOURS INSTRUCTED) —
[instructedHoursController.js](js/controllers/instructedHoursController.js) + [instructorHoursService.js](js/services/instructorHoursService.js)
(`GET instructor_hours?from&to`, own flights only) + `views/manageuser/instructed_hours.html` + [css/instructed-hours.css](css/instructed-hours.css) (`.ih-*`).
Flights come tagged `kind: dual | solo`; totals, the month breakdown and the club filter are computed
client-side so the "Include supervised solos" toggle is instant. A supervised solo is NEVER logbook time for
the instructor (My Logbook / PDF exclude it — backend `PersonalLogbook::is_authorised_solo_not_flown_by`);
this page is where it is counted. Presets are built from today's date; date inputs hold real `Date` objects.
Each flight row closes the loop (added 2026-10-30): a **Track** button (`has_track`, same rule as every replay link) →
`dashboard.flight_replay`; a **Training record** chip from the backend's `record_status` — `import_note` (as `missing`, with an
"import note" tag — see TPC-import placeholder records below), `recorded` (green, opens
`student_records?…&flight=<pls>`, which auto-opens that flight's record popup and drops the param), `awaiting_confirmation`
(amber, same link — confirm in the popup), `missing` (red dashed "Fill in record" → debrief with `from=instructed_hours`,
whose save/BACK return here), `not_required`, `no_student`. A "Records outstanding" chip filters the list. Range, filters and
the last-opened flight live in sessionStorage (`toaviate_ih_view` / `toaviate_ih_focus`) so the return trip lands on the same
view with that row pulsed once.

## Bookings calendar — instructor rows & "hide unavailable instructors"

`/dashboard/bookings` ([bookingsController.js](js/controllers/bookingsController.js) + the inline FullCalendar Scheduler
1.8 setup in [views/bookings.html](views/bookings.html)) lists every current instructor of the viewer's clubs as a row,
then the planes. Club setting (2026-11-02) `clubs.hide_unavailable_instructors` (Manage Club → Settings → Booking
Settings; migration `2026_11_02_000002`): when on, `GET bookings/{user}/{start}/{end}` (`Bookings::get_all_fast` →
`get_schedule_instructors(…, $all_instructors = 0, …, $bookings)`) keeps only instructors available on at least one
viewed day. The ONE rule is `InstructorAvailability::available_on()` — a booking that day always shows the row; else not
on holiday (`instructor_holidays`) AND (regular weekday enabled with hours, or an ad-hoc date that day; ad-hoc mode needs
the date); no availability row = hidden. The viewer's own row is never hidden. The Schedule Display (TV) uses the same
helper behind its OWN token-level `show_all_instructors` toggle — the two settings are independent on purpose.
- Response carries `instructor_filter {club_setting, applied, hidden}`; the calendar shows a `.bkcal-filter` bar
  ([css/bookings-calendar.css](css/bookings-calendar.css)) only when `club_setting == 1`, with a per-browser "Show all
  instructors" override (localStorage `toaviate_bookings_show_all_instructors` → `?show_all_instructors=1`,
  `BookingService.GetAll(user, start, end, showAll)`).
- **Resources change per day now**, so the inline script calls `fullCalendar('refetchResources')` when `all_resources`
  changes after the first delivery (the old late `callback(newValue)` was a no-op in Scheduler 1.x).

## Student records — return path & URL syncing

`dashboard.manage_user.student_records` has many ways in (instructor dashboard tile, My Schedule, Hours Instructed,
Records to File, the debrief list, a CAA form). Rules (2026-10-30):
- **BACK goes where the user came from.** `$rootScope.previousState` / `$rootScope.cameFrom(name)` (set in the app.js
  run block) feed `resolve_origin()` in dashboardStudentRecordsController; the origin is kept in sessionStorage
  `toaviate_sr_origin` so a refresh keeps it. Leave for a page that comes back (replay, debrief, CAA form,
  questionnaire) through `go_and_return(state, params)` so the return trip doesn't overwrite the origin.
- **`&flight=<pls_id>`** opens that flight's record popup once, with a "Back to <origin>" button in its footer.
- **URL syncing must replace, and the state needs `reloadOnSearch: false`.** This ui-router (0.2.x) ui-view re-renders on
  `$viewContentLoading`: a `notify:false` `$state.go` that changes params swaps the state's locals without re-rendering,
  so the NEXT navigation away spawns an orphan copy of the page mid-transition whose late fetch drags the URL back.
  Same latent pattern (push-style, so not a drop-in fix) in tpc_import_run, exam_results, fox_track_tools and the
  CAA forms list.
- The CAA form and the member questionnaire result return to the record when opened from it (`cameFrom`).

## TPC-import placeholder records ("import note only")

The 2023+ TPC import wrote a training record for every dual flight so the flight counts on the student's course record.
When the source row had no exercise or remarks, that record's remarks are just `[TPC import 2026:410]` (7,401 of them
locally) — a placeholder, not a debrief. Rule (2026-10-30, backend `TrainingRecords::import_note_only_sql`): remarks are
the import tag and nothing else, no lesson, no graded/remarked item. Anything an instructor adds ("Ex: 10 — all stalls
satis", a lesson, a grade) makes it a real record; "Ex: 8b [TPC import …]" counts as filled in.
- Every "still needs a record" check uses it via `Bookings::open_record_sql()` (debrief list "Flights without a student
  record", Records to File + the student page's unfiled list); Hours Instructed reports `record_status: 'import_note'`.
- Filing the debrief REPLACES the placeholder (soft-deleted in the same transaction by `TrainingRecords::add`) instead of
  failing DUPLICATE. The placeholder is never deleted otherwise — it carries the flight's course hours.
- UI: `.rtf-chip--import` ("import note only", info blue, dashed) everywhere; Records to File filter `record_kind`
  (`none` | `import_note`) + `summary.import_notes`; the debrief page shows a "saving replaces the note" banner
  (`import_note` on `bookings/for_debrief_pls`). No migration: plain LIKE/LOCATE SQL, same on every MySQL.

## Signup flows (invitations, club, maintenance, passenger) — contract since 2026-11-02

Audited and reworked end to end; every flow was driven against the real local backend (scratchpad Playwright
scripts). Rules to keep:
- **Backend `$auth_exlusions` (api.class.php) is the gate.** A public page may only call endpoints on that list;
  everything else returns 401 (which the interceptor no longer turns into a freeze on public pages, but the call still
  fails). `<address-lookup>` needs a login and hides itself when there is none (pass `label="…"` so the label hides too).
- **Invitation signup = account FIRST, then pay AS that account.** `POST invitations/signup` creates the user, logs it
  in (`login: {user, session}` → `AuthenticationService.SetCredentials2`), and the invitation record — not the body —
  decides club / tier / request. Card: "Create Account & Add Card" → SetupIntent as the user → Stripe return →
  `cards/confirm_setup` → `Invitations::complete_stripe_signup` creates the membership. Direct debit: mandate link, own
  `gcl_session` cookie (the app's `session` cookie is the LOGIN). Skip: membership immediately (free / waived).
  The "account ready" email goes out only when the membership exists (`send_welcome_email`). Never read `uid` from a cookie.
- **Payment gate:** login returns `payment_setup_required {token}` for an accepted invitation whose paid request never
  completed → loginController stores `toaviate_payment_setup_required`, the app.js guard pins `/dashboard*` to
  `/invitations/{token}/your_club`, the wizard resumes at step 4 (logged in) or asks to log in, and clears the flag on completion.
- **Phone codes are 6 digits everywhere**; `users/verify_invited_user` needs the invitation token (or the login) and is
  rate-limited; every code screen has a resend. `ng-input` is not a directive — the input event is bound in JS.
- **Club / maintenance signup:** the verification email IS sent (club → `club_signup2/verified/…`, maintenance →
  `registration_verification/…`); a verified existing email returns `existing_account` (nothing created, "log in");
  only whitelisted club / organisation columns are inserted; result screens reflect the API's answer; a signed-in user
  creating a maintenance org uses `maintenance_organisations/register`.
- **Passengers:** `invitations/{booking}/passengers` is no longer public and `pax_code` never leaves the API; a finished
  link says so (`already_done`); resend works on the create-password step; passengers land on My Account after login.
- **Email confirmation at login (2026-11-02):** a correct password on an account with `users.verified = 0` returns
  `email_verification_required {email_verify_token, email_hint, code_sent}` instead of a session; loginController pivots to
  `vm.stage = 'email_code'` (login.html, `.login-email-code`), `AuthenticationService.LoginVerifyEmail(token, code)` →
  `users/login_verify_email` (same `Base64("token,code")` convention as 2FA; errors `WRONG_CODE {attempts_remaining}`,
  `EXPIRED`, `TOO_MANY_ATTEMPTS`), `ResendLoginEmailCode(token)` → `users/login_resend_email_code` (45 s cooldown, mirrored
  by `vm.resendIn`). Success verifies the account, then continues into 2FA if enabled, else `completeLogin`. Backend:
  `UsersTwo::complete_login_email_code` / `send_login_email_code`; migration `users.email_verification_code` +
  `email_code_sent_at`, guarded by `email_verification_supported()` (publish-before-migrate safe). `login_2fa` refuses an
  unverified account (`EMAIL_UNVERIFIED`). Both routes are in `$auth_exlusions` and match the interceptor's `users/login` prefix.
- **Existing-account acceptance (`invitations/accept_existing`)** — incl. BookedScheduler merge invitations (GET exposes
  `bs_merge: 1`, `user_id` = the real account): the wizard never asks for details — it shows "log in to accept"
  (`invite_existing_account` + `invMerge` wording) or, when already logged in as that user, auto-accepts via
  `LogbookSignupService.AcceptExisting`. The backend merges the stub first, then: free / waived → `accepted_existing`
  (the transferred member row takes the inviter's tier + dates, the request is closed); paid → `mode: 'payment_pending'`
  and the caller pays AS the account on `/invitations/{token}/your_club` (loginController and the wizard both set the
  payment gate; `pending_payment_setup` / `signup_status_for` treat a merge's transferred member row as unpaid).
  `Memberships::club_accepts_request` UPGRADES an existing current row (no duplicate), honours `membership_ends` and skips
  the initial charge when `payment_required = 0`; `complete_stripe_signup` completes the open request whatever method was
  pencilled in. Existing-account paths skip the next-of-kin checks (`account_created`). Verified on the REAL Stripe and
  GoCardless sandboxes (club 3) — card: Payment Element → `setup_intent` return → one upgraded row with `stripe_id`;
  DD: hosted pages → `redirect_flow_id` return → `save_mandate` → one upgraded row with `gcl`.
- `/register` + `/registration_success` are REMOVED from the router (RegisterController stays for `registration_verification`).
- Known / not changed: hardcoded Companies House / ClickSend keys (accepted for now); passkey login does not run the
  email-confirmation step (a passkey can only be enrolled from a logged-in session).

## Logbook Endorsements & Free-Logbook Signup Funnel

Instructor countersignatures ("stamps") on personal-logbook lines + the
growth funnel (added 2026-08). Contracts: `FRONTEND_LOGBOOK_ENDORSEMENTS_GUIDE.md`
/ `FRONTEND_LOGBOOK_SIGNUP_GUIDE.md`.

- **Services:** [logbookEndorsementsService.js](js/services/logbookEndorsementsService.js) (pilot/instructor/public
  endpoints + the shared `wordings` picker list) and [logbookSignupService.js](js/services/logbookSignupService.js)
  (neutral public signup, invites, `AcceptExisting`).
- **Signature pad:** `<sig-pad ng-model>` ([js/directives/signaturePad.js](js/directives/signaturePad.js), wraps the
  checked-in [libs/js/signature_pad.js](libs/js/signature_pad.js)). Model = `''` or a `data:image/png` URL
  (the only format the backend accepts); retina capped at 2×; the drawing is
  RESTORED on window resize (mobile keyboards fire resize — don't "fix" that
  back to clearing).
- **My Logbook:** stamp rosette in the Source cell; endorsements share the
  weather drawer row (`ng-show="e._wxOpen || e._endOpen"` — the colspan stays 19,
  no new column). Transient row state uses the `_underscore` convention. Modals in
  [endorsementModalControllers.js](js/controllers/endorsementModalControllers.js); request-signature is CLUB lines only,
  external works on both. The instructor picker prefers `entry.club_id` (backend
  now emits it) with a union-of-pilot-clubs fallback.
- **Instructor queue:** `dashboard.manage_user.pending_signatures` + SIGNATURES
  tile; sign modal remembers the instructor number in localStorage.
- **Public pages** (all three in `publicStates` + `publicPages`, and their API
  prefixes in the interceptor's `unauthEndpoints`): `/endorsement_confirm/:token`
  and `/logbook_invite/:token` are baked into emails — paths can never change;
  `/free_logbook` is the self-serve signup. Public signup responses are NEUTRAL
  ("check your email") — never branch on account existence.
- **Login flow:** club-less accounts (empty pilot access) land on My Logbook.
  The invitation wizard's `existing_account` response stores the token in
  localStorage `toaviate_accept_invitation`; after login, loginController calls
  `invitations/accept_existing` (FORBIDDEN keeps the token so re-login with the
  invited email works).
- `users/{id}/verify` takes `verify_token` (canonical, per the corrected
  signup guide); the backend also accepts `verify_link` as an alias.

## Address Lookup

Google-Places autocomplete via our API (added 2026-08; contract:
`FRONTEND_ADDRESS_LOOKUP_GUIDE.md`). Use the shared component on ANY form that
takes a postal address:

```html
<address-lookup on-select="vm.apply(address)" placeholder="Start typing…"></address-lookup>
```

- [js/directives/addressLookup.js](js/directives/addressLookup.js) + [js/services/addressLookupService.js](js/services/addressLookupService.js) +
  [css/address-lookup.css](css/address-lookup.css). Debounced 300 ms, min 3 chars, keyboard nav, ONE
  billing session per attempt (reused across suggestions + details, discarded
  on pick — that's how Google bills it).
- `on-select` receives the structured `address` (`line1..line4, locality,
  city, county, postcode, country, formatted`). Simple fills go inline in the
  expression; freeform textareas use `address.formatted`.
- **The lookup is an accelerator, never a gate**: manual fields stay visible
  and editable; `LOOKUP_UNAVAILABLE` hides the component entirely,
  `LOOKUP_FAILED` shows a transient message.
- `/addresses/*` needs a signed-in user, so the component hides itself for logged-out
  visitors (and on a 401): the public signup / invitation wizards get manual entry only.
  Opening it to the public would expose paid Google calls behind the client-side Api-Key.
- The old postcode → pick-your-house flow is dead upstream and fully removed
  (`PaymentService.GetAddresses` deleted) — don't reintroduce it. The only
  address field deliberately NOT migrated is the voucher form's Stripe billing
  postcode (raw DOM input for the Tokens flow).

## Style reminders for edits

- Match existing formatting (this codebase uses 4-space indent, `var`, and plain
  named functions — follow the conventions of the file you're in).
- Don't strip the existing `console.log` lines (uglify removes them in prod).
- Don't reformat or "tidy" files you aren't otherwise changing.
- Keep changes minimal and local; this is production software for live flying clubs.
</content>
</invoke>
