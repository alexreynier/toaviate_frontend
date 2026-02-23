# Night Mode Implementation Guide

## Current State

- **~31,000 lines** of CSS across 8 files, all using hardcoded color values (hex, rgba, hsl)
- **Zero CSS custom properties** (`var(--...)`) — everything is pre-CSS-variables era
- **No user preference storage** for display settings — only `toaviate_selected_club_id` and `toaviate_return_url` in localStorage
- **No existing theme infrastructure** — no dark/night/theme references anywhere in the codebase
- **Grunt build pipeline** concatenates CSS into `css/compiled.min.css`

---

## Recommended Approach: CSS Class Override Strategy

### Why Not CSS Custom Properties?

Refactoring ~31,000 lines of CSS to use `var(--color)` everywhere would be ideal long-term but is a massive undertaking with high regression risk. Instead, use a **body class toggle** (`body.night-mode`) with a dedicated override stylesheet. This:

- Requires **zero changes** to existing CSS files
- Can be built incrementally (page by page)
- Is easy to toggle on/off and roll back
- Works with the existing Grunt build pipeline

### Architecture

```
┌─────────────────────────────────────┐
│  User clicks toggle                 │
│         ↓                           │
│  NightModeService toggles           │
│  localStorage('toaviate_night_mode')│
│         ↓                           │
│  Adds/removes class on <body>       │
│  body.night-mode                    │
│         ↓                           │
│  night-mode.css overrides kick in   │
│  (all selectors prefixed with       │
│   body.night-mode)                  │
└─────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the Night Mode Service

Create `js/services/nightModeService.js`:

```javascript
(function () {
    'use strict';

    angular
        .module('app')
        .factory('NightModeService', NightModeService);

    NightModeService.$inject = ['$rootScope'];

    function NightModeService($rootScope) {
        var STORAGE_KEY = 'toaviate_night_mode';
        var service = {};

        service.isEnabled = isEnabled;
        service.toggle = toggle;
        service.enable = enable;
        service.disable = disable;
        service.init = init;

        return service;

        // ── Public ──────────────────────────

        function init() {
            // Apply saved preference on app startup
            if (isEnabled()) {
                _applyClass(true);
            }
        }

        function isEnabled() {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        }

        function toggle() {
            if (isEnabled()) {
                disable();
            } else {
                enable();
            }
            return isEnabled();
        }

        function enable() {
            localStorage.setItem(STORAGE_KEY, 'true');
            _applyClass(true);
            $rootScope.$broadcast('nightMode:changed', true);
        }

        function disable() {
            localStorage.setItem(STORAGE_KEY, 'false');
            _applyClass(false);
            $rootScope.$broadcast('nightMode:changed', false);
        }

        // ── Private ─────────────────────────

        function _applyClass(on) {
            var body = document.body;
            if (on) {
                body.classList.add('night-mode');
            } else {
                body.classList.remove('night-mode');
            }
        }
    }
})();
```

### Step 2: Initialise on App Startup

In `js/app.js`, inside the `.run()` block, inject and initialise the service:

```javascript
// Add NightModeService to the .run() injection list
.run(['$rootScope', /* ...existing deps... */ 'NightModeService',
    function($rootScope, /* ...existing deps... */ NightModeService) {
        // Apply saved night mode preference immediately
        NightModeService.init();

        // ... existing run block code ...
    }
]);
```

### Step 3: Add a Toggle to the UI

Add a toggle switch in the header area or a user settings dropdown. Using the existing `toggle-switch` dependency (already loaded in the app):

```html
<!-- In the header template or nav partial -->
<div class="night-mode-toggle" title="Toggle Night Mode">
    <label class="night-mode-toggle__label">
        <i class="fa fa-moon-o"></i>
        <input type="checkbox"
               ng-model="nightModeEnabled"
               ng-change="toggleNightMode()">
        <span class="night-mode-toggle__slider"></span>
    </label>
</div>
```

In the controller that manages the header/nav (or in a directive):

```javascript
// In whatever controller owns the header/nav
$scope.nightModeEnabled = NightModeService.isEnabled();

$scope.toggleNightMode = function() {
    NightModeService.toggle();
    $scope.nightModeEnabled = NightModeService.isEnabled();
};

// Stay in sync if toggled elsewhere
$scope.$on('nightMode:changed', function(event, enabled) {
    $scope.nightModeEnabled = enabled;
});
```

### Step 4: Create the Night Mode CSS File

Create `css/night-mode.css`. Every rule is prefixed with `body.night-mode` so it only applies when the class is present. Build this **incrementally** — start with the highest-impact surfaces.

```css
/* ============================================================
   NIGHT MODE OVERRIDES
   All rules scoped under body.night-mode so they only apply
   when the user has enabled dark theme.
   ============================================================ */

/* ── Color Reference ─────────────────────────────────────────
   Dark backgrounds:   #1a1a2e (deepest), #16213e (panels), #1e293b (cards)
   Surface:            #1e293b (cards/modals), #2d3748 (elevated)
   Borders:            #334155
   Primary text:       #e2e8f0
   Secondary text:     #94a3b8
   Muted text:         #64748b
   Primary accent:     #60a5fa (blue, replaces #1e3a5f on dark bg)
   Danger:             #f87171 (replaces #C23A5A / #dc3545)
   Success:            #4ade80
   Links:              #93c5fd
   ─────────────────────────────────────────────────────────── */


/* ── Base / Body ─────────────────────────────────────────── */

body.night-mode {
    background-color: #1a1a2e;
    color: #e2e8f0;
}


/* ── Main Container & Layout ─────────────────────────────── */

body.night-mode .main_container {
    background-color: #1a1a2e;
}

body.night-mode .main_div {
    background-color: #16213e;
}

body.night-mode .main_left {
    background-color: #16213e;
    border-color: #334155;
}


/* ── Header ──────────────────────────────────────────────── */

body.night-mode #main_header2 {
    background-color: #16213e !important;
    border-bottom-color: #334155;
}

body.night-mode #main_header2,
body.night-mode #main_header2 a,
body.night-mode #main_header2 .header_club_name {
    color: #e2e8f0;
}

body.night-mode #main_menu a {
    color: #94a3b8;
}

body.night-mode #main_menu a:hover,
body.night-mode #main_menu a.active {
    color: #e2e8f0;
}


/* ── Side Navigation ─────────────────────────────────────── */

body.night-mode .side_menu a {
    color: #94a3b8;
}

body.night-mode .side_menu a:hover,
body.night-mode .side_menu a.active {
    color: #e2e8f0;
    background-color: #1e293b;
}


/* ── Typography ──────────────────────────────────────────── */

body.night-mode h1,
body.night-mode h2,
body.night-mode h3,
body.night-mode h4,
body.night-mode h5,
body.night-mode h6 {
    color: #e2e8f0;
}

body.night-mode p,
body.night-mode span,
body.night-mode label,
body.night-mode li {
    color: #cbd5e1;
}

body.night-mode a {
    color: #93c5fd;
}

body.night-mode a:hover {
    color: #bfdbfe;
}

body.night-mode .text-muted,
body.night-mode .help-block {
    color: #64748b !important;
}


/* ── Cards & Panels ──────────────────────────────────────── */

body.night-mode .panel,
body.night-mode .panel-default,
body.night-mode .card,
body.night-mode .well {
    background-color: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .panel-heading {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .panel-body {
    background-color: #1e293b;
}


/* ── Tables ──────────────────────────────────────────────── */

body.night-mode table,
body.night-mode .table {
    color: #e2e8f0;
}

body.night-mode .table > thead > tr > th {
    background-color: #2d3748;
    border-color: #334155;
    color: #94a3b8;
}

body.night-mode .table > tbody > tr > td {
    border-color: #334155;
}

body.night-mode .table-striped > tbody > tr:nth-of-type(odd) {
    background-color: #1e293b;
}

body.night-mode .table-striped > tbody > tr:nth-of-type(even) {
    background-color: #16213e;
}

body.night-mode .table-hover > tbody > tr:hover {
    background-color: #2d3748;
}


/* ── Forms & Inputs ──────────────────────────────────────── */

body.night-mode .form-control,
body.night-mode input[type="text"],
body.night-mode input[type="email"],
body.night-mode input[type="password"],
body.night-mode input[type="number"],
body.night-mode input[type="tel"],
body.night-mode input[type="date"],
body.night-mode input[type="time"],
body.night-mode textarea,
body.night-mode select {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .form-control:focus,
body.night-mode input:focus,
body.night-mode textarea:focus,
body.night-mode select:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25);
}

body.night-mode .form-control::placeholder,
body.night-mode input::placeholder,
body.night-mode textarea::placeholder {
    color: #64748b;
}

body.night-mode .form-control:disabled,
body.night-mode .form-control[readonly] {
    background-color: #1e293b;
    color: #64748b;
}


/* ── Buttons ─────────────────────────────────────────────── */

body.night-mode .btn-primary {
    background-color: #2563eb;
    border-color: #1d4ed8;
    color: #fff;
}

body.night-mode .btn-primary:hover {
    background-color: #1d4ed8;
    border-color: #1e40af;
}

body.night-mode .btn-default {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .btn-default:hover {
    background-color: #334155;
    color: #fff;
}

body.night-mode .btn-danger {
    background-color: #dc2626;
    border-color: #b91c1c;
}

body.night-mode .btn-success {
    background-color: #16a34a;
    border-color: #15803d;
}


/* ── Modals ──────────────────────────────────────────────── */

body.night-mode .modal-content {
    background-color: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .modal-header {
    border-bottom-color: #334155;
}

body.night-mode .modal-footer {
    border-top-color: #334155;
}

body.night-mode .modal-header .close {
    color: #94a3b8;
}

body.night-mode .modal-backdrop {
    background-color: #000;
}


/* ── Dropdowns ───────────────────────────────────────────── */

body.night-mode .dropdown-menu {
    background-color: #1e293b;
    border-color: #334155;
}

body.night-mode .dropdown-menu > li > a {
    color: #e2e8f0;
}

body.night-mode .dropdown-menu > li > a:hover {
    background-color: #2d3748;
    color: #fff;
}


/* ── Bootstrap Alerts ────────────────────────────────────── */

body.night-mode .alert-info {
    background-color: rgba(96, 165, 250, 0.15);
    border-color: #60a5fa;
    color: #93c5fd;
}

body.night-mode .alert-success {
    background-color: rgba(74, 222, 128, 0.15);
    border-color: #4ade80;
    color: #86efac;
}

body.night-mode .alert-warning {
    background-color: rgba(251, 191, 36, 0.15);
    border-color: #fbbf24;
    color: #fcd34d;
}

body.night-mode .alert-danger {
    background-color: rgba(248, 113, 113, 0.15);
    border-color: #f87171;
    color: #fca5a5;
}


/* ── Members Page (BEM components) ───────────────────────── */

body.night-mode .members-page__header {
    background: linear-gradient(135deg, #1e293b 0%, #16213e 100%);
}

body.night-mode .members-page__card {
    background-color: #1e293b;
    border-color: #334155;
}

body.night-mode .members-page__search input {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}


/* ── Member Detail Page (BEM components) ─────────────────── */

body.night-mode .member-detail__header {
    background: linear-gradient(135deg, #1e293b 0%, #16213e 100%);
}

body.night-mode .member-detail__card {
    background-color: #1e293b;
    border-color: #334155;
}

body.night-mode .member-detail__section-title {
    color: #e2e8f0;
    border-bottom-color: #334155;
}


/* ── Dashboard ───────────────────────────────────────────── */

body.night-mode .dash_action_anchor {
    background-color: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .dash_action_anchor:hover {
    background-color: #2d3748;
}


/* ── Calendar / FullCalendar ─────────────────────────────── */

body.night-mode .fc {
    color: #e2e8f0;
}

body.night-mode .fc-toolbar {
    color: #e2e8f0;
}

body.night-mode .fc-toolbar button {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .fc-toolbar button:hover {
    background-color: #334155;
}

body.night-mode .fc-toolbar button.fc-state-active {
    background-color: #2563eb;
    border-color: #1d4ed8;
}

body.night-mode .fc-view,
body.night-mode .fc-view table {
    background-color: #16213e;
}

body.night-mode .fc td,
body.night-mode .fc th {
    border-color: #334155;
}

body.night-mode .fc-today {
    background-color: rgba(96, 165, 250, 0.1) !important;
}

body.night-mode .fc-event {
    border-color: #334155;
}

body.night-mode .fc-unthemed td.fc-today {
    background: rgba(96, 165, 250, 0.1);
}


/* ── Datepicker ──────────────────────────────────────────── */

body.night-mode .datepicker,
body.night-mode .ui-datepicker {
    background-color: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .ui-datepicker-header {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}

body.night-mode .ui-datepicker td a {
    color: #e2e8f0;
}

body.night-mode .ui-datepicker td a:hover {
    background-color: #2d3748;
}

body.night-mode .ui-datepicker .ui-state-active {
    background-color: #2563eb;
    color: #fff;
}


/* ── ui-select (Angular select dropdowns) ────────────────── */

body.night-mode .ui-select-container .ui-select-choices {
    background-color: #1e293b;
    border-color: #334155;
}

body.night-mode .ui-select-container .ui-select-choices-row:hover {
    background-color: #2d3748;
}

body.night-mode .ui-select-container .ui-select-match-text {
    color: #e2e8f0;
}

body.night-mode .ui-select-container .btn-default {
    background-color: #2d3748;
    border-color: #334155;
    color: #e2e8f0;
}


/* ── Tabs (Bootstrap) ────────────────────────────────────── */

body.night-mode .nav-tabs {
    border-bottom-color: #334155;
}

body.night-mode .nav-tabs > li > a {
    color: #94a3b8;
}

body.night-mode .nav-tabs > li > a:hover {
    background-color: #2d3748;
    border-color: #334155;
}

body.night-mode .nav-tabs > li.active > a,
body.night-mode .nav-tabs > li.active > a:focus,
body.night-mode .nav-tabs > li.active > a:hover {
    background-color: #1e293b;
    border-color: #334155;
    border-bottom-color: #1e293b;
    color: #e2e8f0;
}

body.night-mode .tab-content {
    background-color: #1e293b;
}


/* ── Pagination ──────────────────────────────────────────── */

body.night-mode .pagination > li > a {
    background-color: #1e293b;
    border-color: #334155;
    color: #93c5fd;
}

body.night-mode .pagination > li > a:hover {
    background-color: #2d3748;
}

body.night-mode .pagination > .active > a {
    background-color: #2563eb;
    border-color: #1d4ed8;
    color: #fff;
}


/* ── Tooltips & Popovers ─────────────────────────────────── */

body.night-mode .tooltip-inner {
    background-color: #2d3748;
    color: #e2e8f0;
}

body.night-mode .popover {
    background-color: #1e293b;
    border-color: #334155;
}

body.night-mode .popover-title {
    background-color: #2d3748;
    border-bottom-color: #334155;
    color: #e2e8f0;
}

body.night-mode .popover-content {
    color: #e2e8f0;
}


/* ── Snazzy Pages ────────────────────────────────────────── */

body.night-mode .snazzy-page {
    background-color: #16213e;
}

body.night-mode .snazzy-page__card {
    background-color: #1e293b;
    border-color: #334155;
}

body.night-mode .snazzy-page__header {
    background: linear-gradient(135deg, #1e293b 0%, #16213e 100%);
}


/* ── Settings Page ───────────────────────────────────────── */

body.night-mode .settings_page {
    background-color: #16213e;
}


/* ── Scrollbar (webkit) ──────────────────────────────────── */

body.night-mode ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

body.night-mode ::-webkit-scrollbar-track {
    background: #1a1a2e;
}

body.night-mode ::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 4px;
}

body.night-mode ::-webkit-scrollbar-thumb:hover {
    background: #475569;
}


/* ── Toggle Switch Styling ───────────────────────────────── */

.night-mode-toggle {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
}

.night-mode-toggle__label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    margin: 0;
    font-size: 14px;
    color: #777;
}

body.night-mode .night-mode-toggle__label {
    color: #fbbf24;
}

.night-mode-toggle__label input[type="checkbox"] {
    position: relative;
    width: 36px;
    height: 20px;
    appearance: none;
    -webkit-appearance: none;
    background: #ccc;
    border-radius: 10px;
    outline: none;
    cursor: pointer;
    transition: background 0.3s;
}

.night-mode-toggle__label input[type="checkbox"]:checked {
    background: #2563eb;
}

.night-mode-toggle__label input[type="checkbox"]::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.3s;
}

.night-mode-toggle__label input[type="checkbox"]:checked::before {
    transform: translateX(16px);
}


/* ── Smooth Transition ───────────────────────────────────── */
/* Optional: add a smooth transition when toggling.
   Can cause performance issues on large pages — test first. */

body.night-mode-transition,
body.night-mode-transition *,
body.night-mode-transition *::before,
body.night-mode-transition *::after {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease,
                box-shadow 0.3s ease !important;
}
```

### Step 5: Add to the HTML Build Block

In `index.html`, add the new CSS file inside the existing build comment block:

```html
<!-- build:css css/compiled.min.css -->
<!-- ... existing CSS files ... -->
<link rel="stylesheet" href="css/night-mode.css"/>
<!-- endbuild -->
```

And add the service JS file inside the JS build block:

```html
<!-- build:js js/compiled.min.js -->
<!-- ... existing JS files ... -->
<script src="js/services/nightModeService.js"></script>
<!-- endbuild -->
```

### Step 6: Rebuild

```bash
grunt build
```

---

## Rollout Strategy

### Phase 1 — Core Layout (do first)
These affect every page and give the biggest visual payoff:

| Target | Selectors to override |
|---|---|
| Body background | `body` |
| Main container | `.main_container`, `.main_div` |
| Header | `#main_header2`, `#main_menu` |
| Side navigation | `.main_left`, `.side_menu` |
| Typography | `h1`–`h6`, `p`, `a`, `label` |
| Forms & inputs | `.form-control`, `input`, `select`, `textarea` |
| Buttons | `.btn-primary`, `.btn-default`, `.btn-danger` |

### Phase 2 — Components
| Target | Selectors |
|---|---|
| Tables | `.table`, `.table-striped`, `.table-hover` |
| Modals | `.modal-content`, `.modal-header`, `.modal-footer` |
| Panels/Cards | `.panel`, `.well`, `.card` |
| Alerts | `.alert-info`, `.alert-danger`, `.alert-success` |
| Tabs | `.nav-tabs`, `.tab-content` |
| Dropdowns | `.dropdown-menu` |
| Pagination | `.pagination` |

### Phase 3 — Page-Specific
| Target | Selectors |
|---|---|
| Dashboard | `.dash_action_anchor` |
| Members page | `.members-page__*` |
| Member detail | `.member-detail__*` |
| Settings | `.settings_page` |
| Snazzy pages | `.snazzy-page__*` |

### Phase 4 — Third-Party Widgets
| Target | Notes |
|---|---|
| FullCalendar | `.fc-*` classes — most complex widget |
| jQuery UI Datepicker | `.ui-datepicker` |
| ui-select | `.ui-select-container` |
| Bootstrap Tooltips | `.tooltip-inner`, `.popover` |
| Timepicker | Test and override as needed |

---

## Dark Color Palette Reference

Use these consistently across all overrides:

| Role | Hex | Usage |
|---|---|---|
| **Deepest background** | `#1a1a2e` | `<body>`, page background |
| **Panel background** | `#16213e` | Side nav, main content area |
| **Card / surface** | `#1e293b` | Cards, modals, panels, tab content |
| **Elevated surface** | `#2d3748` | Table headers, panel headers, inputs |
| **Border** | `#334155` | All borders |
| **Primary text** | `#e2e8f0` | Headings, main body text |
| **Secondary text** | `#cbd5e1` | Paragraphs, labels |
| **Muted text** | `#94a3b8` | Help text, inactive items |
| **Dimmed text** | `#64748b` | Placeholders, disabled |
| **Primary accent** | `#2563eb` | Buttons, active states |
| **Primary accent (light)** | `#60a5fa` | Links on dark, highlighted borders |
| **Link text** | `#93c5fd` | Anchor tags |
| **Danger** | `#f87171` | Error states, danger alerts |
| **Success** | `#4ade80` | Success states |
| **Warning** | `#fbbf24` | Warning states |

---

## Edge Cases & Gotchas

### 1. Inline Styles
Some AngularJS directives and calendar plugins set colors via inline `style` attributes, which override CSS. For these you'll need `!important` on the night-mode rules, or to modify the JS that generates the inline styles to check `NightModeService.isEnabled()`.

### 2. Images & Icons
- Dark logos on dark backgrounds will disappear. Consider using `filter: invert(1) hue-rotate(180deg)` on specific images, or swapping `ng-src` based on night mode.
- Font Awesome icons inherit `color` — they'll pick up the text color overrides automatically.

### 3. Calendar Event Colors
FullCalendar events often have colours set dynamically (per-resource or per-event). You may need to adjust the event rendering callback to use lighter/more saturated colours in night mode.

### 4. Third-Party Iframes
PayBase payment forms (referenced in `theme.css`) load in iframes — you cannot style them. They'll remain light-themed.

### 5. Print Styles
Add a reset so printed pages are always light:

```css
@media print {
    body.night-mode,
    body.night-mode * {
        background-color: #fff !important;
        color: #000 !important;
        border-color: #ccc !important;
    }
}
```

### 6. Flash of Light on Load
If the user has night mode enabled and refreshes the page, there may be a brief flash of the light theme before AngularJS boots and `NightModeService.init()` runs. To prevent this, add a tiny inline script in `index.html` `<head>`:

```html
<script>
    if (localStorage.getItem('toaviate_night_mode') === 'true') {
        document.documentElement.classList.add('night-mode');
    }
</script>
```

Then duplicate the `body.night-mode` rules to also match `html.night-mode` for the body background:

```css
html.night-mode body {
    background-color: #1a1a2e;
    color: #e2e8f0;
}
```

### 7. `prefers-color-scheme` (Optional / Future)
You could also respect the OS-level dark mode preference as a default:

```javascript
function init() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
        // No explicit preference — follow OS setting
        var prefersDark = window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            enable();
            return;
        }
    }
    if (isEnabled()) {
        _applyClass(true);
    }
}
```

---

## Effort Estimate

| Phase | Scope | Effort |
|---|---|---|
| Phase 1 (Core layout) | Body, header, nav, typography, forms, buttons | 2–3 hours |
| Phase 2 (Components) | Tables, modals, panels, alerts, tabs, dropdowns | 2–3 hours |
| Phase 3 (Page-specific) | Dashboard, members, settings, snazzy pages | 3–4 hours |
| Phase 4 (Third-party) | FullCalendar, datepicker, ui-select, tooltips | 3–4 hours |
| Service + toggle UI | JS service, init, toggle switch, localStorage | 1 hour |
| Testing & polish | Cross-browser, edge cases, inline styles, print | 2–3 hours |
| **Total** | | **~13–18 hours** |

This is for a solid initial implementation. There will be an ongoing tail of page-specific tweaks as you discover corners of the app that need adjustment.

---

## Long-Term: CSS Custom Properties Migration

Once night mode is stable with the override approach, you could **optionally** migrate to CSS custom properties over time. This would mean:

1. Define all colours as variables in `:root` (light) and `body.night-mode` (dark)
2. Replace hardcoded hex values with `var(--color-name)` throughout the CSS files
3. Delete the override stylesheet since the variables handle both themes

This is a much larger effort (~31,000 lines to audit) but results in a cleaner, more maintainable system. It's not necessary for a working night mode — the override approach works well and is used by many production apps.
