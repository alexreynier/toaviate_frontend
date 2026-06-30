# ToAviate — Frontend

AngularJS single-page application for the ToAviate flight school management platform.

---

## Prerequisites

- **Node.js** (v14+ recommended)
- **npm**
- **Grunt CLI** — install globally if you don't have it:

```bash
npm install -g grunt-cli
```

## Install Dependencies

```bash
npm install
```

---

## Build

The Grunt build compiles, concatenates, minifies, and revisions all JS/CSS into the `dist/` folder, ready for deployment.

### Quick Reference

| Command | Environment | Description |
|---------|-------------|-------------|
| `grunt` | development | Default build — local dev settings |
| `grunt --env=staging` | staging | Build with staging API endpoint |
| `grunt --env=production` | production | Build with production API endpoint |
| `grunt staging` | staging | Shorthand alias for `--env=staging` |
| `grunt production` | production | Shorthand alias for `--env=production` |

### What the build does

The default task runs these steps in order:

| # | Task | Purpose |
|---|------|---------|
| 1 | `clean:before` | Delete `dist/` and `.tmp/` from any previous build |
| 2 | `copy` | Copy views, images, CSS, fonts, `index.html`, etc. into `dist/` |
| 3 | `useminPrepare` | Prepare asset references for cache-busting |
| 4 | `concat` | Merge JS (controllers, directives, services, libs) and CSS into single files |
| 5 | `string-replace` | Swap the `environment` variable in the concatenated services file to the target env |
| 6 | `babel` | Transpile + annotate AngularJS dependency injection |
| 7 | `cssmin` | Minify concatenated CSS → `compiled.min.css` |
| 8 | `uglify` | Minify JS bundles (also strips all `console.*` calls) |
| 9 | `rev` | Add content-hash revisions to filenames for cache-busting |
| 10 | `usemin` | Update `index.html` with the revisioned filenames |
| 11 | `clean:after` | Remove intermediate (non-minified) files from `dist/` |

### Environment configuration

Environment-specific settings (API URL, debug flag) live in `js/services/envConfigService.js`. The source file always defaults to `development`; the Grunt build swaps the value in the **output** only — source is never modified.

| Environment | API Base URL | Debug |
|-------------|-------------|-------|
| development | `https://local-api.toaviate.com` | `true` |
| staging | `https://v1.toaviate.com` | `false` |
| production | `https://api.toaviate.com` | `false` |

To add a new environment:

1. Add a config block in `js/services/envConfigService.js` inside the `configs` object.
2. Optionally add a convenience alias task in `Gruntfile.js` following the existing pattern.
3. Build with `grunt --env=<name>`.

---

## Payment keys (Stripe / GoCardless)

> **The frontend does NOT hold Stripe or GoCardless API keys.** Do not add
> `pk_test_…` / `pk_live_…` keys to `envConfigService.js` — they are obtained
> per-club from the backend at runtime.

ToAviate is multi-tenant: each **club** runs in either **sandbox** (test) or
**live** payment mode, independently, and connects its own Stripe / GoCardless
account. So the publishable key is **per-club, per-mode**, not per-deployment.

### Where the keys actually live

| What | Where | Edited by |
|------|-------|-----------|
| Stripe **secret** + publishable, GoCardless OAuth creds (sandbox **and** live key sets) | Backend, per-server file `api/v1/includes/con.inc.php` (untracked / per-machine) | Platform staff, on each server — see the backend "§3 per-server checklist" |
| A club's active mode (`sandbox`/`live`) | Backend, `clubs.payment_mode` column | Platform super-admins, via the dashboard (Manage Club → Settings → **Payment Mode**) |
| Platform staff allowed to switch a club's mode | Backend, `$GLOBALS['PAYMENT_MODE_SUPER_ADMINS']` in `con.inc.php` | Platform staff |

### How the frontend gets a key

The frontend **fetches** the right publishable key for a club at runtime:

- `GET payment_mode/{club_id}/config` → `{ stripe_publishable_key, stripe_publishable_key_present, payment_mode }` (no secrets).
- `PaymentService.GetClubStripeKey(club_id)` wraps that call and **caches per club for the session** (one network hit per club). It is the single source every `Stripe(...)` init site uses. Call `PaymentService.ClearClubStripeKey(club_id)` after a mode switch so the new mode's key is re-fetched.
- If `stripe_publishable_key_present` is `false` (e.g. a club was flipped to live before that server's live keys were filled in), card flows refuse to mount the Stripe element and show a "card payments aren't configured yet" message instead of letting Stripe.js throw.

To change a club's keys or go live, **edit the backend `con.inc.php` on that
server**, then switch the club's mode in the dashboard — nothing in this repo
needs to change.

---

## Deploy

After building, upload the contents of the `dist/` folder to the target web server.

```
dist/
├── css/
│   ├── compiled.min.css   (all styles, minified)
│   ├── fonts/
│   ├── webfonts/
│   └── images/
├── js/
│   ├── libs.min.js        (third-party libraries)
│   ├── app.min.js
│   ├── controllers.min.js
│   ├── services.min.js
│   └── directives.min.js
├── views/                  (HTML partials)
├── images/
├── favicon/
└── index.html
```

---

## Project Structure

```
js/
├── app.js                  Application bootstrap & route config
├── controllers/            AngularJS controllers
├── directives/             Custom directives (+ HTML templates)
└── services/               Factories & services (incl. envConfigService.js)
css/                        Application stylesheets
libs/                       Third-party JS/CSS/fonts
views/                      HTML view templates
Gruntfile.js                Build configuration
package.json                npm dependencies
```
