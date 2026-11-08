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
  - `.current_club_admin` (selected Manage Club club — full row in memory; its id is
    saved in localStorage `toaviate_selected_club_id`)
  - `.current_club_instructor` (default instructor club id)
  - `.access.manager` / `.instructor` / `.pilot` / `.super_admin` — **arrays of club IDs**.
    Check a role with `vm.user.access.manager.indexOf(vm.club_id) > -1`.
- One controller often serves list/add/edit; it branches on
  `vm.action = $state.current.data.action` (the `data.action` set on the route).
- Route params come from `$stateParams`.

### Persisted login state — the `globals` cookie is SLIM (2026-11-07)

A refresh restores `$rootScope.globals` from the `globals` cookie (app.js run block).
Browsers silently drop a cookie over 4 KB — the full `currentUser` (all membership rows +
the 80-column club row) passed that for admins, so their club vanished on refresh. The
cookie now holds only `id`, `email`, `first_name`, `last_name`, `authdata`,
`current_club_instructor`, the `access` role arrays + `show_*` flags, and
`current_club_admin` cut to `{id, title, edit_window_*_minutes}` (~0.9 KB).
**Write it only via `AuthenticationService.PersistGlobals()`** (never
`$cookieStore.put('globals', …)`) — it caps the cookie at 3.5 KB, trimming further with a
`console.warn` if needed. The rest (`access.items`, the full club row) comes back from
`AuthenticationService.Rehydrate()` (`GET users/{id}/access` + `GET
clubs/get_all_admin_for_user/{id}`, once per page load / login): DashboardController uses
it for the club list, and the Manage Club guard waits for it before the first Manage Club
page renders (it doubles as the guard's one server re-check). Elsewhere, read only the
persisted fields at controller init. It stays a session cookie cleared by logout — not
localStorage, which would outlive the browser session.

### Routing — all in `js/app.js`

States are nested (`dashboard.manage_club.members`, `dashboard.my_account.bookout`,
…). Each defines `url`, `controller`, `templateUrl`, `controllerAs: 'vm'`, and usually
`data: { action: 'list' | 'add' | 'edit' | … }`. Add new screens here following the
existing grouping/comment blocks.

**Manage Club is admins-only.** A `$stateChangeStart` guard in the `run` block lets
`dashboard.manage_club` and every state under it (dotted children *and* states
re-parented into it with `parent:`) open only for a manager / super-admin of some club
or ToAviate staff. Everyone else gets a toast; a deep link lands on My Account.
Non-admin exceptions live in one map, `MANAGE_CLUB_ROLE_STATES` (state name → the
`currentUser.access` role that opens it):
- `instructor` → `questionnaire_review`;
- `sms_post` → every `dashboard.manage_club.sms*` screen, for the club's SMS post
  holders (accountable manager, head of training, safety / compliance manager, CFI in
  `sms_settings` — the backend's `AccessControl::isClubSafetyAdmin`). `access.sms_post`
  comes from the per-membership `sms_post` flag of `GET users/{id}/access`; they reach
  SMS from the "Safety Management" menu entry (`access.show_sms`, shown when they
  aren't club admins), and `SmsController` works on their post club, not
  `current_club_admin` (which only club admins have).

If you link non-admins into a new `dashboard.manage_club.*` screen, add it to that map,
or put the screen outside Manage Club — engineers (maintenance-org members) are not
club admins, so the maintenance workspace's "Add maintenance check" is its own form
(`maintenance_access/occurrence`), not Manage Club's maintenance page.

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
- **Emoji are refused before sending** (2026-11-07): `unsupportedCharactersInterceptor`
  (same file, registered last in app.js) blocks any API write whose JSON body holds a
  character outside the BMP (every emoji — the DB connection can't store them), answers
  the caller with the backend's own refusal (`{success:false, error:'UNSUPPORTED_CHARACTERS',
  message, fields}`, as a 200) and toasts a warning naming the field(s). It toasts the
  backend's refusal too. FormData / files / password fields are never scanned.
  Backend: BACKEND_UNSUPPORTED_CHARACTERS_GUIDE.md; test `tests/unsupported-characters-interceptor-test.js`.
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

> **New design system — draft under review (2026-11-06):** [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) with ONE shared
> stylesheet set, [css/ta-base.css](css/ta-base.css) (tokens `--ta-*` + `.ta-*` primitives) and [css/ta-night.css](css/ta-night.css)
> (night-mode token swap), registered in index.html and the Gruntfile right after snazzy-pages.css. Once approved it replaces
> the snazzy rules below for new / redesigned pages. Redesigns are mocked first in `../mockups/` (kit: `../mockups/_kit/`,
> README = the brief; My Account set: `../mockups/my-account/index.html`; Instructor Dashboard set: `../mockups/instructor-dashboard/index.html`,
> whose debrief design is shared with the book-in mockup via `debrief-core.js`/`.css`; living reference: `../mockups/design-system.html`)
> and implemented one page at a time after the owner's review. **Shared components** that several mockups had re-invented
> (readiness rail `.ta-ready`, final card `.ta-final`/`.ta-sum`/`.ta-left`/`.ta-cta`, picker A `.ta-pick`+`.ta-pickmenu`,
> picker B `.ta-combo`, `.ta-stepper`, `.ta-confirm`, `.ta-drop`, `.ta-ic`, `.ta-sh`, `.ta-req`, `.ta-mark`, `.ta-desk-only`/
> `.ta-phone-only`) now live once in ta-base.css (guidelines 4.15); naming rules are in guidelines §9 ("Naming and
> structure": `ta-` only in ta-base, one page prefix + BEM, no `body.night-mode` in page CSS, `kit-` = mockup-only).
> Refactor a mockup with `../mockups/_kit/baseline.js` (screenshots every page × scenario × width × theme) before and
> after, then `python3 ../mockups/_kit/diff.py BEFORE AFTER` — the bar is 0 changed pixels.

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
  "Safety Management" menu entry (`views/dashboard.html`) → the same, for SMS post holders
  who aren't club admins (the Manage Club guard opens only the SMS screens to them; their
  BACK goes to My Account → Safety; settings stay club-admin only);
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

## Scheduler v2 (`/dashboard/bookings_v2`)

The new scheduler (added 2026-11-03) runs ALONGSIDE v1 (`/dashboard/bookings`, FullCalendar) until it is trusted.
Contract: backend repo `FRONTEND_SCHEDULER_V2_GUIDE.md` (§1 reads, §2 waiting list, §3/§4 libraries, §5 this integration).
- **Two framework-agnostic libraries** (plain ES5, no jQuery/Angular/moment, every colour a CSS custom property):
  `libs/js/toaviate-scheduler.js` (+`libs/css/toaviate-scheduler.css`, `.tas-*`, global `ToAviateScheduler`) and
  `libs/js/toaviate-datepicker.js` (+`libs/css/toaviate-datepicker.css`, `.tadp-*`, global `ToAviateDatePicker`).
  Thin wrappers: `<ta-scheduler>` ([js/directives/taScheduler.js](js/directives/taScheduler.js)) and `<ta-date-picker ng-model>`
  ([js/directives/taDatePicker.js](js/directives/taDatePicker.js)). The app will change framework one day — keep logic in the libs.
- **State** `dashboard.scheduler_v2` (`/bookings_v2?date&days`, `reloadOnSearch:false`) →
  [schedulerV2Controller.js](js/controllers/schedulerV2Controller.js) + `views/scheduler_v2.html` + [css/scheduler-v2.css](css/scheduler-v2.css)
  (`.sv2-*` page, `.sbk-*` booking card, `.scf-*` conflict dialog, `.wrq-*` member waiting form, `.wrp-*` staff panel).
  Reads: [schedulerV2Service.js](js/services/schedulerV2Service.js) (`scheduler/v2/day|booking|month|version`, month cache,
  copy helpers — name a kind/status through these) and [waitingRequestsService.js](js/services/waitingRequestsService.js) (`.enums`).
  URL ↔ state is a `notify:false` + `location:'replace'` `$state.go` (the student-records orphan-view rule). Version polled every
  30 s while the tab is visible. Day/3/7 only — no month view (the date picker's busy dots cover it).
- **Mutations stay on the LEGACY endpoints** — they carry the conflict/override rules. Move/resize = `GET bookings/edit/{user}/{id}`
  (the edit page's own fetch, the v1 event shape) → apply the drop → the payload `check_before_changing_event` builds
  (`resourceId`/`plane_id`, `"{id}w"` → `changed_to_waiting_list`, `update_rental_items:true`, same deleted keys, dates as
  `YYYY-MM-DD[T]HH:mm:ss` exactly like FullCalendar's ambiguously-zoned moments) → `BookingService.updateBooking` → the same
  `instructor` / `check_user` / `rental_items` error mapping (+ `plane`), restyled in `scheduler_conflict.html`; an override re-PUTs
  with the v1 flag (`currency_override`, `update_rental_items`, `instructor_override` — the last only when the backend says
  `can_override:true`). ⚠️ The legacy edit shape has NO `resourceId`/`plane_id` (only `plane:{id}`): the aircraft is resolved
  drop row → `plane.id` → the v2 booking, never sent empty (that produced "not assigned to aircraft ID ." on every resize). A drop
  onto another instructor's row sends `instructor_id` + `instructor:{id}`. **Overrides are cumulative** (same payload object
  re-PUT, `granted[]` → the dialog marks already-applied errors `.scf__err--granted`, no second button) and the dialog shows only
  the latest response's errors.
- **Times are club wall-clock, never shifted** — `SchedulerV2Service.parse / toWallClock / toLegacyDateTime` keep the digits of any
  API/lib string (zone-suffixed strings go through `moment.parseZone`); never `moment(str)` a `+00:00` string and format it. Small
  "Times are club local time" note in the sub-bar.
- **"Hide instructors not working today"** is the library's switch (`hideToggle:{on}` / `on.hideToggle` / `setHideToggle`), host-owned:
  localStorage `toaviate_sv2_hide_unavailable` → else the club setting. On → `GET scheduler/v2/day?hide_unavailable=1` (the one
  `available_on` rule whatever the club setting, **the viewer's own row is deliberately kept** — shown with "Not working today" —
  so an instructor can still book themselves on a day off); off → `show_all_instructors=1`. `instructor_filter {club_setting,
  applied, hidden}` reports what ran. Cancel = the reason picker `<cancel-reason-fields>` (v1's reasons + staff-only "Late cancellation" /
  "No-show", see Cancellation fees) + `CancellationFeesService.CancelBooking` → `BookingService.DeleteBooking(user, id, reason, notes)` →
  `DELETE bookings/{id}?user_id=&reason=&notes=`: the reason lands on the booking audit trail's "Deleted" entry
  (`reason` column, shown on the Audit Trail page) and on the `cancelled_bookings` archive row
  (`cancellation_reason` / `cancellation_notes` / `cancelled_by` / `deleted_at`); v1 still sends none. Create / edit = the booking form as a slide-out PANEL: child states `dashboard.scheduler_v2.add`
  (`/new?plane_id&instructor_id&start&duration`; `+ New booking` = `vm.date` at `day_start`, 60 min; an instructor-row
  drag-select carries `instructor_id`, no plane) and `dashboard.scheduler_v2.edit` (`/edit/:booking_id`) render into
  `<ui-view name="panel">` at the end of `scheduler_v2.html`; the parent is not re-instantiated, `syncUrl()` is a no-op while a
  child is active, the panel's `sv2:refresh {date}` broadcast moves the page to that day and refetches (a child → parent exit
  refetches too, de-duplicated). The old `dashboard.bookings` list state hands over to v2 while
  `localStorage.toaviate_scheduler_v2 === '1'` (set by "Try the new scheduler" and by being on v2; cleared by "Classic
  scheduler"); the last view is in sessionStorage `toaviate_sv2_view`.
- **Booking card** (`GET scheduler/v2/booking/{id}`): Book out → `dashboard.my_account.bookout_with_booking`; Book in →
  `dashboard.my_account.book_in` needs a plane_log_sheet id (not in the detail yet → falls back to My Account home); Edit →
  `dashboard.scheduler_v2.edit` (the panel). Contact details show only when the backend sends `contact` (club staff). Bottom sheet under 480px.
  **Access (2026-11-03):** the backend flags are authoritative — `can_edit` / `can_cancel` / `can_book_out` / `can_book_in` /
  `can_view_records` / `can_view_history` drive every button; never guess from the viewer's role. `clubs.booking_name_visibility`
  (`everyone` | `free_booking` | `staff_only`) is applied to day AND detail: a viewer it excludes (or a member of another club
  sharing the aircraft) gets pilot `{id:0, name:'Booked'}`, no description / passengers / lesson / booked_by; `contact` is staff-only
  (matrix in the guide §1 "Who sees what"). `can_book_out` / `can_book_in` = the PILOT or the booking's own INSTRUCTOR only
  (2026-11-05) — nobody books an aircraft out for someone else, other staff included. **Training record** (staff, student with a course) → `dashboard.manage_user.student_records`
  `{club_id, student_id, course_id}` (BACK returns to v2 — origin label "Scheduler"); **History** / the "Booked … by" link →
  `dashboard.my_account.booking_audit_trail` `{booking_id}`, whose backend (`booking_audit_trail/booking/{id}`) is now gated
  server-side (staff full; participants without actor email / IP; others `FORBIDDEN`). v1 is frozen and still leaks these.
- **Waiting list** (school-style "call me if a slot comes up", additive to the old `bookings.waiting_list` rows): `GET/POST/PUT
  waiting_requests`, `GET waiting_requests/matches`. Every list call needs `club_id` (from `settings.clubs` on the day response).
  Badge = `waiting_requests_open` (staff: the club's; member: their own). After a staff cancel/move the freed slot is checked
  and an in-page banner (+ toast) links to the panel — ToastService has no action buttons, so don't try to put one in a toast.
  **Status lives PER DATE (2026-11-05):** every `dates[]` row of a waiting request has its own `status` (open | contacted |
  fulfilled | declined, + `status_by/at`, `fulfilled_booking_id`; migration `2026_11_05_000001`); the request's `status` is only
  the DERIVED summary (cancelled/expired override; else open while ANY day is open → contacted → fulfilled → declined). The
  staff panel shows ONE day (‹ › / Today / `<ta-date-picker>`, default = the scheduler's date or the freed slot's day):
  `GET waiting_requests?club_id&date=&status=` where Open/Contacted/All mean THAT day's status and each row carries `day`;
  every button PUTs `{status, date}` for that day (a match acts on its `day`), the other days are chips with their own state
  (`.wrp__chip--contacted/--fulfilled/--declined`, viewed day `--day`) so staff see it is still live elsewhere; "Reopen day"
  undoes a declined/fulfilled day. A PUT without a date applies to every still-live day (old callers only — never send that
  from the UI). Matches only consider open/contacted days. Member "My requests" chips read "Sat 7 Nov · PM — Declined";
  Cancel request still cancels the whole request. Name a day's state through `WaitingRequestsService.dateTone/dateLabel/
  dayOf/liveDays`. After "Add a request" the panel jumps to the new request's first day.
  **FCFS queue + Book (2026-11-05, round 2):** the staff panel is a first-come-first-served queue — every list is in the
  backend's `created_at` order (never re-sort) with `#queue_position` (1..n among the live requests of that day, else of the
  club; a contacted member keeps their place, a settled day has none) and "Added N days ago". Views: **This day** (filter
  Waiting · Contacted · Booked · Couldn't take it · All = that day's state) and **Everyone waiting** (`status=live`, all day
  chips, click a chip to act on that day). Row actions on ONE day: Contacted (stamp + Undo, stays in queue), **Book**, Couldn't
  take it (= declined); settled days show their state + Undo. Every PUT updates the row IN PLACE from the response and a row
  that no longer fits slides out (`.wrp__req--out`) — no reload. UI words through `WaitingRequestsService.dateLabel/dateTone`
  (take the date ROW): Waiting / Contacted / Booked / **Booked elsewhere** (`fulfilled_elsewhere`) / Couldn't take it — never
  the backend's `status_label`. **Book** closes the panel → `dashboard.scheduler_v2.add?request_id&request_date&start&duration
  (&instructor_id)` (AM 09–11, PM 13–15, any 10–12, clipped to the club's opening hours); Bookings2Controller fetches
  `waiting_requests/{id}?date=`, shows the `#bkf-wrq` banner (switch "Still wants the other days", off by default; "Cancel —
  back to the waiting list" → `sv2:waiting {date}` reopens the panel), pre-fills member (`members/search?user_id=`),
  instructor (request's), aircraft (request's, else first FREE of its type; else that type grouped "Requested"), notes
  "Waiting list: …"; the save PUTs `{status:'fulfilled', date, fulfilled_booking_id, complete_request: !stillWants}` —
  `complete_request` closes every other live day as fulfilled + `fulfilled_elsewhere:1` (migration `2026_11_05_000002`, SHOW
  COLUMNS guarded). A fulfilled day carries `booking {id, registration, start}` → "Booked · G-BMTJ 09:00", a link to the card
  when the booking is on the scheduler's day. Tests: `WaitingRequestsTest` (22), mocked `wrq_queue.js`, real `wrq_staff.js`.
  **Staff add on a member's behalf** (2026-11-03): the panel's "Add a request" button opens the SAME member form
  (`waiting_request_form.html`, `WaitingRequestFormController`) with `ctx.staff:true` → a Member picker (current members of
  the chosen club via `MemberService.GetAllActiveByClub`, in-flow suggestion list — the modal clips overflow, so no floating
  dropdown), no "My requests" tab, `user_id` on the POST (backend: club staff only, must be a current member; the member gets
  the confirmation email); on success the form closes with `{changed, request}` and the panel widens its From/To to include
  the new request's dates so it is visible. uib stacks the two modals itself — don't add z-index rules.
  **Member pickers search the server (2026-11-05):** `GET members/search/{club_id}?q=&limit=` (`MemberService.SearchClubMembers`,
  `Members::search_current_members`) = every CURRENT member of the club (current = 1, membership not ended) by first / last /
  full name or email, alphabetical, 25 (max 50) + `more`. Use it for ANY member picker: `members/active_club` only returns
  members holding an unexpired PAID tier (35 of 1,912 at club 3 — it looked like an instructors-only list) and
  `members/club_and_name` matches emails only. The waiting-list form debounces 250 ms from 2 characters; the booking panel's
  `#field-member` loads the first 25 and re-queries through the ui-select `refresh=` (`vm.get_members` is re-pointed on v2
  for the name search; the passenger picker has its own handler, see Passengers). Don't add `minimum-input-length` to these ui-selects —
  this version stops rendering rows. `?instructors=1` = every current INSTRUCTOR of the club (available or not) — the
  waiting-list form's instructor picker uses it (an in-flow search list like the member one, not a native select; the
  scheduler's day rows were the wrong source: hidden / not-working instructors vanished). **Visual rule:** the brand initials
  circle means INSTRUCTOR everywhere; members get a neutral grey person icon (`.wrq__picked-av--member`, `.bkf-opt__av--mem`).
  **Access (2026-11-05):** `members/search` is STAFF of that club only (manager / club super-admin / instructor —
  `AccessControl::isClubInstructor`; it lists names AND emails — it was open to any login before); the one exception is
  `?instructors=1`, open to any current member of the club WITHOUT emails (the member waiting-list form). Tests:
  `api_tests/tests/MemberSearchTest.php`, HTTP `MemberSearchEndpointTest.php`.
- **Double bookings — `clubs.double_booking_by`** (`everyone` | `staff` | `admins`, migration `2026_11_03_000002`, Manage Club →
  Settings → Booking Settings, `.snazzy-seg` control): who may put a booking on an aircraft's waiting list (a second booking on a
  taken slot, `waiting_list ≥ 1` / `"{id}w"`). Backend authoritative: `Bookings::add` / `booking_change` answer
  `error:'DOUBLE_BOOKING_NOT_ALLOWED'` (in `HANDLED_CODES`; schedulerV2Controller toasts its own line) judged on the ACTING user's
  role (`Bookings::may_double_book`); never gated: a waiting booking moved back to a free slot, or one that keeps its
  aircraft+times; `plane_maintenance()`'s bump is not gated. The v2 day payload carries `settings.double_booking_by` (`'mixed'`
  across disagreeing clubs) and per-aircraft `can_wait`; `toaviate-scheduler.js` **v1.2.0** is slot-aware: a move over an
  aircraft row checks the range against that aircraft's non-waiting bookings — FREE → plain move even in the strip, TAKEN +
  `can_wait` → automatic waiting-list drop (`tas-ghost--inzone`), TAKEN without it → `tas-ghost--blocked` "Slot taken" and the
  drop reverts without calling `on.move`; `can_wait:false` rows have no strip and their sub-row refuses drops. Tests:
  `api_tests/tests/DoubleBookingByTest.php`, `SchedulerV2Test`; mocked drag harness `scratchpad/ih_e2e/dbb_lib.js`.
- **Opening hours — `clubs.opening_hours`** (migration `2026_11_04_000001`, Manage Club → Settings → Booking Settings, `.coh-*`
  editor in `css/club-opening-hours.css`): a JSON object keyed by ISO weekday `"1"` (Mon)…`"7"` (Sun) → `{open:"HH:MM",close:"HH:MM"}`
  or `null` (closed all day); a missing key = not set for that day, column NULL = not configured. SOFT everywhere — the scheduler
  shades outside the hours and the booking panel warns; nothing is ever blocked. Backend: `Models\Clubs::normalise_opening_hours()`
  (string / array / stdClass; drops bad times and close ≤ open, `00:00` close = midnight, all-invalid → null), `opening_hours($club_id)`
  / `opening_hours_for($ids)` are the canonical readers, `edit()` normalises → JSON / NULL (dropped while unmigrated), and the
  `SELECT *` getters (`get_one`/`get_one2`/`get_all`) hand the DECODED object back via `expose_opening_hours()` — the settings
  page's `GET clubs/{id}` returns the object, never the string. Settings UI: `vm.oh.days` rows hold `Date`s (Angular 1.4
  `input[type=time]` binds to a Date), `vm.ohBuild()` rebuilds the exact object on save (toggle off → `null`, toggle on + empty
  times → key dropped, nothing set → `null`); a backwards day refuses the save. Tests: `api_tests/tests/ClubOpeningHoursTest.php`;
  mocked harness `scratchpad/ih_e2e/oh_settings.js`, real-backend `oh_real.js`.
- **Club opening hours on the scheduler (2026-11-04):** the hours ride on `GET scheduler/v2/day` as `settings.clubs[].opening_hours`.
  The library (v1.3.0) shades the parts of each day outside the row's club hours on the TIMELINE — `.tas__closed` segments per
  row per day (aircraft, instructor and waiting-list rows, matched by the row's `club_id`), a hatched `--day` segment on a closed
  day, "Closed on Sundays" tooltip on the row label, legend "Outside opening hours" only when a row's club has hours; rows of
  clubs without hours draw nothing; the phone list only shows a "Club closed" header pill. Informative only — nothing is blocked
  and no backend rule reads it. The booking panel's `vm.bkf_hours_note()` is club-aware (`vm.bkf_hours_club()`: aircraft's club →
  edited booking's club → v2 club filter) and judges the FROM/TO weekdays via `SchedulerV2Service.openingHoursFor / openingHoursOn`
  ("Starts before the club opens on Tuesdays (08:30)…", "The club is closed on Sundays…" + "You can still book — just check with
  the club."); a club without hours falls back to the scheduler-hours note. Suites: `SchedulerV2Test::testSettingsClubsCarryOpeningHours`,
  mocked `ih_e2e/sv2_hours.js` + `bkf_when.js`; club 3 locally has NULL hours — `scratchpad/php/club_hours.php set|clear 3` for a real run.
- **Day window never clips a booking (2026-11-04):** `settings.day_start/day_end` = the 07:00–22:00 defaults widened by the
  clubs' booking slots AND by every booking in the requested range (`SchedulerV2::widen_hours_for_bookings`, whole hours;
  an end at midnight or a multi-day booking → `"24:00"`). The library collapses hours outside the window, so a 06:00 or a
  21:00–23:00 booking used to be cut off. The opening-hours shading and the now-line follow the widened window.
- **Override overbooking on CREATE (2026-11-04):** the "member already has a booking in this window" check in `Bookings::add`
  reads `override_overbooking` OR `admin_override` (managers / club super-admins only). The conflict dialog's retry only ever
  sent `admin_override`, so the override re-hit the same refusal (v1 too); the panel now sends both and toasts
  "Booking Conflict — nothing saved yet" so the write guard's generic "Not saved" toast stays quiet. Real-backend suite
  `scratchpad/ih_e2e/bkf_real_override.js`.
- **Scroll to now** (lib, 2026-11-03): `render()` calls `_scrollToNowOnce()`, which retries on animation frames until the
  `.tas__scroll` grid has a width — the first render happens before the route fade lays the page out, so a one-shot
  `scrollToNow()` silently did nothing (`scrolledToNow` was set true with scrollLeft 0). Per date/range change it re-arms.
- Library drag callbacks are not `ng-click`, so the busy guard does not cover them: the controller's own `inFlight` flag rejects
  a second move while one is saving. The lib reverts a chip when the promise rejects or resolves `{ok:false}`.
- **Club filter** (2026-11-03): chips in the page bar (All clubs · one chip per club, only when the viewer has >1 club) → `club_id` on day/month/version calls; remembered in localStorage `toaviate_sv2_club` (0 = all); busy-dot caches reset on change.
- **Page bar** (2026-11-05): two rows — title + hint with the actions (Find a slot → `dashboard.slot_search`, Waiting list,
  Classic scheduler) on the right; a filters row with "Showing" + the club chips (several clubs only) and the "Times are club
  local time" pill at the far right. Phones: the two buttons share a row, Classic scheduler below, chips full width.

## Cancellation fees (no-show / late cancellation)

A club MAY charge a fee when a booking is cancelled for a member-side reason (added 2026-11-05; The Pilot Centre charges
£50 for a no-show). Nothing is ever charged automatically — an instructor or admin decides per cancellation.
Backend: `models/cancellation_fees.model.php` (`Models\CancellationFees`), `controllers/cancellations.controller.php`,
migration `2026_11_05_000003` (every column read behind SHOW COLUMNS — before migrating there are simply no fees).
- **Reasons** (`CancellationFees::REASONS`, mirrored by `CancellationFeesService`): v1's eleven labels verbatim + "Late
  cancellation" and "No-show" (staff only). Labels are stored verbatim on `cancelled_bookings.cancellation_reason` and the audit
  trail — never rename one; `Bookings::delete` also stores `reason_key` (`reason_key_for_label`) and returns `cancelled_booking_id`.
  Only `no_show`, `late_cancellation`, `pilot_unwell`, `pilot_unavailable`, `other` can carry a fee; weather / aircraft /
  instructor / airfield / airspace are never charged.
- **Settings** (Manage Club → Settings → Booking Settings → Cancellation Fees, `.cxf-*`): `clubs.cancellation_fees` JSON
  `{reason_key: gross}` (normalised by `CancellationFees::normalise_fees` — chargeable keys only, 0 < x ≤ 10,000; `GET clubs/{id}`
  returns the decoded object; the row hides while the GET has no such key) and `clubs.cancellation_fee_claimers`
  `staff` (instructors + admins) | `admins`. Reversing is always admins only.
- **Claiming:** `<cancel-reason-fields club-id state pilot-name preset notes-id>` ([js/directives/cancelReasonFields.js](js/directives/cancelReasonFields.js),
  `.crf-*`) is the ONE reason picker — the v2 booking card's cancel step and the v2 panel's Delete popup (v1 untouched, sends no
  reason). It reads `GET cancellations/policy?club_id=` (reasons for the viewer's role + fee, `can_claim`, cached 60 s); whoever
  may claim gets a "Charge the fee" switch (ON by default for the staff-only reasons, OFF for the member-side ones); anyone else
  sees "The club may charge…". `CancellationFeesService.CancelBooking` = DELETE with the reason, then `POST cancellations/{id}/claim`.
  The card shows **No-show** to staff once a booking has started and was never booked out (`can_mark_no_show` on
  `scheduler/v2/booking`). Later: the scheduler bar's **Cancellations** button (staff) → `cancellations_panel.html`
  (`CancellationsPanelController`, `.cxl-*`): `GET cancellations?club_id&from&to&status=due|claimed|waived|reversed|all` with
  Charge / Waive / Reverse (two-step, admins) per row.
- **The charge** = `Invoices::create_single_item_invoice` for the booking's PILOT: one item (unit_price NET, total GROSS, club VAT
  when registered, category `other`, title "No-show fee - Wed 4 Nov 2026, 06:00 (G-BMTJ)" — never "book"/"trial"/"plane", the
  accounting export keyword-maps those). Status `direct_debit` (collected by the club's DD run) when the member has a usable
  mandate (`gcl` + `gcl_status` active / pending_submission / submitted), else `issued` (Pay Now in My Account). The pilot gets
  one email (`cancellation_fees.claim`). Reverse voids the invoice while uncollected (issued, or direct_debit with
  `collection_submitted_at` NULL); otherwise `ALREADY_COLLECTED` → credit note from the club invoices. A waived or reversed fee
  can still be claimed later; a claimed one can't be claimed twice. Error codes are in the write-guard `HANDLED_CODES`.
- Tests: `api_tests/tests/CancellationFeesTest.php` (13); real-backend `scratchpad/ih_e2e/cxf_real.js` (85, fixtures
  `php/cxf_fixtures.php`).

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
  The whole booking-passenger flow (panel → invitation → wizard → statuses) is in "Scheduler v2 booking panel" → Passengers.
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

## Scheduler v2 booking panel (New / Edit booking over the v2 scheduler)

The v2 create/edit step is a slide-out PANEL over the scheduler, not a page (added 2026-11-03). The
scheduler stays mounted behind it.

- **States** (js/app.js, right after `dashboard.scheduler_v2`): CHILD states `dashboard.scheduler_v2.add`
  (`/new?plane_id&instructor_id&start&duration`) and `dashboard.scheduler_v2.edit` (`/edit/:booking_id`), rendered
  into `<ui-view name="panel">` of `views/scheduler_v2.html` via `views: { 'panel@dashboard.scheduler_v2': … }`.
  They inherit the parent's `?date&days`; entering one never re-creates the parent (no second `scheduler/v2/day`).
  `start` is wall-clock club time `YYYY-MM-DDTHH:mm:ss`, `duration` in minutes.
- **Same controller as v1**: `Bookings2Controller` with the v1 pages' `data.action` (`'list'` for add, `'edit'`)
  plus `data.v2 = true` → `vm.is_v2`. Every `$('#calendar')` call is a no-op (no FullCalendar in the panel);
  the slot is pre-selected from the params (`?instructor_id` runs the instructor-first flow from a bare user id,
  `?plane_id` waits for the planes list — `vm.preselect_plane_id`); `<ta-date-picker>` strings are bridged to the
  controller's `Date`s by `vm.bkf` / `vm.bkf_date_picked` (local time, never `toISOString()`).
- **Templates**: `views/scheduler_v2/booking_add.html` / `booking_edit.html` (panel chrome) share
  `views/scheduler_v2/_booking_form.html` (Your-slot card → When / Who / What / Extras cards → sticky action bar,
  plus the conflict / cancel-confirm / invite popups). Keep every `ng-model` / `ng-click` / `id="field-*"` — the
  controller's `validateBookingFields` flags `.bkf-field.field-error` by those ids.
- **Lesson** (2026-11-03): `#field-lesson` (ui-select over `CourseService.GetLessonsByCourseId`, label "Lesson N: Title" like
  the debrief page) appears once a course AND a student are set; a new booking pre-selects the suggested next lesson from
  `GET bookings/next_lesson/{user_id}/{course_id}` (`BookingService.GetNextLesson`; staff-or-self; same
  `brief_get_next_lesson` rule as the debrief, now with a `reason`) and shows the "Suggested next lesson" hint until the user
  changes it; an edit re-selects the SAVED lesson (the legacy edit shape now carries `lesson_id`). Saved as
  `bookings.lesson_id` via `bkf_lesson_payload` (v2 sends `lesson_id` int|null; v1 payloads strip the key); the backend
  refuses a lesson from another course (`lesson_course_mismatch`). Day chips and the card already show the lesson title.
  Plane icons inside `.bkf` override the global `.fa.fa-plane` colour rule (white on the card squares).
- **Who before What + instructor cascade (2026-11-04):** card order is **When → Who → What → Extras**. The Instructor list is
  CLUB-level for the slot — `GET bookings/club_instructors/{user}/{club}/{from}/{to}?show_all&booking_id`
  (`BookingService.GetClubInstructors`; the `plane_instructors` row shape + `available/reason/busy_with`, plus `course_ids`,
  `courses_restricted`, `plane_ids`) — fetched ONCE per club+slot by `bkf_sync_who()`; the panel never calls `plane_instructors[2]`.
  Club = the aircraft's → an edited booking's → `vm.bkf_club` (v2 club filter → staff club → first club; `#field-who-club`
  chooser only with several clubs and no aircraft). Staff of ANY club get the Myself / Another member segment
  (`#field-booking-for`); `vm.booking_self` stays the one flag; staff default "someone else", explicit picks sticky
  (`bkf_self_explicit`); members load for the Who club (`bkf_load_members`). **Cascade:** the chosen instructor (or SELF when an
  instructor-not-manager books for a member — `vm.bkf_effective_instructor()`) narrows the Aircraft list to their `plane_ids`
  (else `bookings/instructor_planes`) and Course/tuition to `course_ids` (when `courses_restricted`); the ui-selects repeat over
  `vm.bkf_planes_list` / `vm.bkf_courses_list` (`vm.planes`/`vm.courses` stay full). A club manager/super-admin gets "Show all"
  on both (`vm.bkf_can_override`); nothing is cleared silently — an off-list pick stays with "Not on X's list — kept as you chose
  it". `?instructor_id` pre-selects on the club list (editable); `vm.instructor_first_booking` is v1-only. Aircraft order: real
  aircraft in endpoint order, then EVERY waiting-list row under "Waiting lists" (amber chip), club filter → "Other clubs" /
  "Other clubs — waiting lists". The "Your slot" card is hidden (`vm.bkf_show_slot_card`), "Find a slot" lives in the panel
  header, Solo chip on the What header. End-time shows `vm.bkf_short_duration` ("11h30"; model keeps v1's long string). Dropdown
  skin on `.ui-select-bootstrap.bkf-us` (+ `body >` prefixed rules): highlight = brand bold+underline, no block; hovered/active
  row `#f1f5f9` + dark text. The action bar is absolute at the panel's bottom; the body's bottom padding/scroll-padding =
  `--bkf-bar-h` (ResizeObserver) + 16px; its z-index is 10010 because select.css gives every `.ui-select-container.dropdown`
  9999 — a closed passenger picker sat OVER "Make booking" on phones (taps opened the picker); closed in-panel pickers are
  also forced to `z-index:auto`. Body-level open menus (1061) are outside the panel's stacking context, so they stay on top. ⚠️ `<ui-view name="panel">` is exempt from the global route fade (`animation:none`)
  and has a colour-only leave animation: an animated-opacity ancestor becomes the backdrop root, so the backdrop's blur arrived
  only when the fade ended (grid flashed through). A `<ui-select>` without `<ui-select-no-choice>` leaves an empty in-flow div
  the skin paints as a bar — every panel select has one (+ a CSS `:empty` guard). Panel-header tooltips use `tooltip-placement="bottom" tooltip-append-to-body="true"` — placed on top
  they hide under the fixed site nav. Placeholders: "Select member", "Select course". Suites: mocked `ih_e2e/bkf_cascade.js` (CDP
  frame probe), real `ih_e2e/bkf_real_cascade.js`; backend `BookingClubInstructorsTest`.
- **Passengers (2026-11-05, end to end).** ONE backend rule for every path (`Invitations::add_pax`, used by booking create,
  edit and the book-out page): resolve the person by `user_id` OR email; a CURRENT member of the booking's club (`current = 1`
  AND (`membership_ends` IS NULL OR > booking end)) → `accepted` at once + a short "you're on X's flight" note
  (`invitations.add_pax.member`); anyone else (no account, account at another club, lapsed) → `invited` + the code email
  (`invitations.add_pax.invited`); never a second live row for the same booking + person; `invited_by` = the ACTING user.
  `GET bookings/passenger_preview?club_id&booking_end&passengers=<json>` says what saving will do (no writes) — the panel's
  chips use it, so "Ready to fly" before save is what the save does. Edit-removal is SOFT (`removed = 1`) and sends NO email
  (owner's call: someone taken off a flight is simply not on it — the only passenger emails are the invitation / member note,
  plus the pilot's "can't make it" notice); deleting the booking soft-removes its invitations. Public `/passenger_decline/:token`
  (`PassengerDeclineController`, `.ec-*` page, in `publicStates`/`publicPages`/`unauthEndpoints`; GET shows, POST declines,
  the pilot is told) — staff re-invite with Resend (a declined MEMBER comes back accepted). `pax_code` / `invitation_token`
  are stripped from EVERY listing (bookings/edit, the v1 feed, scheduler/v2/booking, invitations/{booking}/passengers);
  `GET invitations/{booking}/passengers`, `POST resend_invitation/{id}`, `POST new_passenger/{booking}`, `PUT invitations/{id}`
  (whitelisted columns + statuses) and `DELETE invitations/{id}` (soft) need the booking's pilot / instructor or club staff;
  `check_is_member` is a prepared statement. **Panel:** the passenger picker has its own list `vm.bkf_pax_members` (staff
  only — current members minus the pilot, the instructor and anyone already added) and REMEMBERS the typed text
  (`vm.bkf_pax_search_members`; ui-select single mode never turns free text into a value) — "Invite passenger" with nothing
  picked opens the form pre-filled from the LIVE picker text (`bkf_pax_live_search`; the refresh callback runs 250 ms late):
  an email → email (lower-cased), "First Last" → names, one word → first name, plus a hint. Duplicates are refused on both
  paths; Cancel resets `vm.new_pax` (it used to be `-1`, which broke the form); ONE `resend_invitation(rowOrIndex)` (v1 passes
  either), ONE `close_passenger_invitation`, ONE `get_passenger_status`; Refresh MERGES server rows on v2. Chips via
  `vm.bkf_pax_chip(p)`: Ready to fly / Invitation on save / Invited — awaiting reply / Declined (Resend shows for invited +
  declined). The booking card lists "First Last · Ready to fly / Invited / Declined". ⚠️ A REAL Postmark send returns a
  `DynamicResponseModel` (ArrayAccess, no "success" key): `$r["success"] == false` is `null == false` = TRUE — check
  `isset($r["success"])` (`Invitations::email_failed`); the log-only test transport returns an array and hides this.
  Tests: backend `PassengerInvitationsTest` (16), mocked `ih_e2e/bkf_pax.js` (50), real `ih_e2e/pax_real.js` (59:
  every add path, the wizard for a new person and for an account at another club, resend, resend-code, decline, remove
  (no email), delete; fixtures `php/pax_real_fixtures.php`).
- **When card (2026-11-04):** FROM date · start time on one row, TO date · end time on the next (`.bkf-grid--when`, two
  columns on phones too); the date buttons use `<ta-date-picker format="short">` ("Tue 3 Nov 2026", `ToAviateDatePicker.shortDate`).
  The TO date FOLLOWS the FROM date both ways until the user picks a TO date of their own (`vm.bkf_end_explicit`; an edited
  booking that already spans days starts explicit, decided only once the edit has loaded) and can never end before it starts.
  v2 offers all 48 half-hours: v1's hard-coded `business_hours` 09:00–22:30 clip (dateTimeRangePickerOptions) is `null` on the
  panel — there is NO per-club opening-hours setting; the only hours concept is the scheduler's displayed day
  (`settings.day_start/day_end`, defaults 07:00–22:00 widened by `club_booking_slots`), cached as `SchedulerV2Service.lastSettings`
  by GetDay and used by `vm.bkf_hours_note()` for a soft amber note ("Starts before / Ends after the hours the scheduler shows…
  you can still book"). The backend has no opening-hours rule either. Suite: mocked `ih_e2e/bkf_when.js`.
- **Potential solo (2026-11-03).** `kind` on the v2 scheduler is `maint > trial > solo > dual > hire`, where **solo =
  `bookings.solo = 1` OR the booking's lesson has `lessons.solo = 1`** (migration `2026_11_03_000003`; every reader guards on
  SHOW COLUMNS). A course/tuition booking with no instructor and no flag is `hire` (the old "course = solo" rule is gone); the
  instructor stays on a solo booking (dual check → solo). Payloads carry `solo` + `solo_source: 'booking'|'lesson'|null` (flag
  wins); the card shows a purple "Potential solo · <lesson>" pill. `lessons.solo` is the "Solo lesson" snazzy toggle on
  `lesson_form.html` (club + default courses; `GET lessons/course/{id}` and `bookings/next_lesson` carry it). `bookings.solo` is
  the `#field-solo` toggle in the panel's What card, **club staff only** (`vm.bkf_is_staff()`; the backend ignores the key from
  anyone else and v1 never sends it): it follows the chosen lesson's flag until touched, then the explicit choice stays; an edit
  shows the saved value as explicit; `bkf_solo_payload` sits next to `bkf_lesson_payload`. Audit trail tracks it ("Potential
  solo: 0 → 1"). `bookings/for_bookout` carries `solo` + `lesson_id`: a flagged dual booking pre-sets `vm.solo_intent =
  'student_solo'` (the provisional STUDENT SOLO airfield book-out) and fetches the pre-solo readiness in bookoutController; the
  AirfieldHub form itself has no solo field. Tests: `BookingSoloFlagTest` + `SchedulerV2Test`; E2E models
  `scratchpad/ih_e2e/bkf_solo.js`, `bkf_real_solo.js`, `bookout_solo.js`, `lesson_form_real.js`.
- **Leaving** (close ×, backdrop, Back, after save, after delete): `vm.v2_close(changed, when)` broadcasts
  `$rootScope.$broadcast('sv2:refresh', { date: 'YYYY-MM-DD', changed: bool, booking_id })` (the booking's date,
  else `?date`, else today) then `$state.go('dashboard.scheduler_v2', {}, { inherit: true })`. SchedulerV2Controller
  refetches / jumps on it.
- **CSS**: [css/booking-form.css](css/booking-form.css) (`.bkf-*`, scoped under `.bkf`, registered in index.html +
  Gruntfile). 460px / max 92vw on the left under the 50px header, full-width sheet ≤768px, slide-in honours
  reduced motion, `animation-fill-mode: backwards` on purpose (a persisting transform would trap the fixed popups).
- The v1 pages (`views/bookings/new_add_booking.html`, `new_edit_booking.html`, states `dashboard.add_booking`
  / `edit_booking` / `edit_from_bookout`) are untouched and keep their embedded calendar.

## Style reminders for edits

- Match existing formatting (this codebase uses 4-space indent, `var`, and plain
  named functions — follow the conventions of the file you're in).
- Don't strip the existing `console.log` lines (uglify removes them in prod).
- Don't reformat or "tidy" files you aren't otherwise changing.
- Keep changes minimal and local; this is production software for live flying clubs.
</content>
</invoke>
