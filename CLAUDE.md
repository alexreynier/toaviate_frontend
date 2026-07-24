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

## Style reminders for edits

- Match existing formatting (this codebase uses 4-space indent, `var`, and plain
  named functions — follow the conventions of the file you're in).
- Don't strip the existing `console.log` lines (uglify removes them in prod).
- Don't reformat or "tidy" files you aren't otherwise changing.
- Keep changes minimal and local; this is production software for live flying clubs.
</content>
</invoke>
