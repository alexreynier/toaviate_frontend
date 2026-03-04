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

Environment-specific settings (API URL, Stripe keys, debug flag) live in `js/services/envConfigService.js`. The source file always defaults to `development`; the Grunt build swaps the value in the **output** only — source is never modified.

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
