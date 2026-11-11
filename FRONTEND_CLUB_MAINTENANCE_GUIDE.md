# Frontend — Manage Club → Maintenance (aircraft maintenance page)

*2026-11-10 · batch 16.3 (ops/plans/PLAN_MAINTENANCE_PAGE.md Part A, owner decisions 1–4). The Manage Club redesign is coming; this pass fixed the bugs and the UX with the existing components only — no night mode, no new styling era.*

## Files

| What | Where |
|---|---|
| Fleet list | `views/manageclub/maintenance.html` |
| Aircraft detail + the one slide-in panel | `views/manageclub/maintenance_detail.html` |
| Partials included by the panel | `views/manageclub/_mx_cert_fields.html` (ARC / permit), `_mx_crs_fields.html` (CRS), `_workpack_new_fields.html` (new workpack) |
| Workpack detail panel | `views/manageclub/workpack_detail.html` |
| Controller (list + detail, branching on `vm.action`) | `js/controllers/dashboardClubMaintenanceController.js` |
| **Pure page logic** (no $http / DOM) | `js/services/maintenanceFormService.js` → `MaintenanceFormService` (`vm.mf`) |
| Unit tests | `tests/club-maintenance-form-test.js` — `node tests/club-maintenance-form-test.js` (109 assertions) |
| CSS | `css/styles.css` block "Manage Club → Maintenance quick wins" (`.wp-hint`, `.wp-required`, `.wp-step*`, `.wp-explain*`, `.mx-offline-banner`, `.mx-advanced*`, `.mx-detail-stat__sub`) |

Routes: `dashboard.manage_club.maintenance` (list) and `.detail/:plane_id` (+ the three logbook children). The dead `.add_maintenance` (missing template) and `.review` (placeholder) states and `maintenance_review.html` were deleted.

Two controller instances live under the detail state (the list template wraps a `<ui-view>`); `vm.action` is `'edit'` only when `$stateParams.plane_id` is set, otherwise `'list'` — the parent instance used to fall back to `$state.current.data.action` and fetched `planes/undefined/club_maintenance2/…` on every detail load. The list / detail bootstrap runs in `initController()` (last thing in the file) so every `vm.*` function exists first.

## The panel — one slide-in, one mode (decision 1)

`show_overlay(type)` resets the form (`MF.resetAfterSave(vm)`) and sets exactly one of `vm.show_maintenance | show_offline | show_cert | show_insurance | show_radio | show_noise | show_crs | show_workpack_form`. Header / primary-button copy come from `vm.overlayTitle()` / `vm.overlayAction()` (U7: "Update ARC" / "Update Permit" by `airworthiness_type`).

### Record a check (`maintenance`)
Type first (`vm.form_type_options` = `MF.CHECK_TYPES` + `extension`). `MF.fieldsFor(type)` decides what shows:

| Type | Core fields | Optional collapsed steps (`vm.steps.*`) |
|---|---|---|
| 25 / 50 / 100 h, interim, 6 month | date, **time (required, defaults to now, to the minute)**, hours to next check (required), date of next check (required for 6 month), **type of next check**, checked by, notes | Resolve defects, Logbooks |
| annual | date, time, hours to next check (required — batch 17), date of next check (required), type of next check, checked by, notes | **Workpack** (link open / create new), **CRS**, **ARC / Permit renewal**, Resolve defects, Logbooks |
| extension | date + time granted, hours granted and/or until, granted by, notes | Resolve defects |

- U2: hours / next-check never pre-fill from the current figures; placeholders per type (`MF.hoursPlaceholder`, `MF.nextCheckHint`). Nothing inside a closed step is sent.
- U20: every hint is visible text (`.wp-hint`), no tooltips; required marks `.wp-required`.
- U10 / B7: ticking a defect shows the engineer confirmation and `validateCheck` / `validateExtension` refuse the save without it.
- Validation (`MF.validateCheck`, `validateExtension`, `validateOffline`, `validateWorkpack`) returns `{ok, title, message}` → one warning toast, panel stays open. Checks: type in the whitelist, date not in the future, time present, checked by, hours numeric 0–1000, next check ≥ check date, next-check type in the whitelist. Extension: time, granted by, hours (>0, ≤100) and/or until (≥ granted). Offline: until ≥ today.

### Save flow (U4 / B9 / B13)
`save_overlay()` → validate → `vm.saving = true` (panel busy, Cancel / close disabled) → `POST planes/{p}/maintenance` with `MF.buildCheckBlock` / `buildExtensionBlock` (+ `issues` = ticked defects, `cert` for the ARC step). On `success:false` → `ToastService.error('Not saved', data.message)`, panel stays open, nothing reset. On success the follow-ups run and each reports an outcome: CRS (`POST plane_crs`), logbook bulk-link, new workpack (`WorkpackService.Create`, linked to `maintenance_check_id`), per-defect workpack info / link. Then **one** toast (`MF.outcomeToast`: success, or "… — with problems: Not saved: …" listing `documents_refused` and failed follow-ups), `MF.resetAfterSave(vm)` (fresh `vm.obj`, empty `vm.files`, workpack sub-form, ticks, steps), close, `loadMaintenanceDetail()`.

Payload date rules: every date-only field goes through `MF.ymd` (local calendar day — never `Date.toISOString()`), `check_date` / `extension_granted` carry the time (`YYYY-MM-DD HH:mm:ss`), `extension_days` too (B5 — it used to be sent raw). `maintenance.hours_remaining` is always sent for a check (required for every type, the annual included — batch 17; `validateCheck` refuses a blank with "Hours required"), `expiry_date` / `next_check_type` are `null` when blank.

### Take Offline (U6)
Explain box (maintenance booking created; clashing bookings of this club → waiting list + e-mails; nobody can book; "change this in the scheduler" — bringing it back online is out of scope) → "Continue" validates and switches to the confirm box (`vm.offline_confirm`) → "Confirm — take offline" posts `{offline: {offline_until, offline_notes, club_id}}`. The detail page shows the `.mx-offline-banner` ("Offline until dd/MM/yyyy …") from the payload's `offline: {until, notes, booking_id} | null`.

### Documents (`cert` / `insurance` / `radio` / `noise` / `crs`)
Required marks + copy (U8): ARC / Permit = file + expiry (issue date optional); insurance = file + expiry; radio = file (expiry optional, "blank = no expiry"); noise = file + issue date; CRS = file + release date + time. Accepted types are pdf / jpg / jpeg / png (the old zones also took zip / mp4). A cancelled upload clears its slot (`vm.removeUpload(location)`).

### New workpack (`workpack`)
The "New workpack" button on the Workpacks card opens the sub-form standalone — no check is created (backend contract since batch 16). `vm.createWorkpack()` resolves `true | false` and toasts the refusal message.

## Detail page
- U19: `vm.detail_loading` → one page-level loader; `vm.detail_error` (a refused / failed read, `data.message`) replaces the cards.
- Stat strip: hours via `MF.hoursDisplay` ("No check recorded" when there is no figure — never "N/A"); "Days to next check" with the sub-line `MF.nextCheckLabel(maintenance.next_check_type)` → "Next: 100 h check" (or "Next check type not recorded").
- Defects: `MF.severityTone` (B1) shared by the detail badges, the panel's resolve list and `workpack_detail.html` — the stored severities are the sentences from `defectReportPanel.js`; short label shown, full sentence in `title`.
- Documents (B3 / U17 / U9 / U7 / B11): the download link only when a file exists, else "No file"; status via `MF.statusBadgeClass` / `statusWord` (`ok` → green "Valid"); dates via `MF.displayDate` (dd/MM/yyyy, `0000-00-00` guarded); noise = "On file · issued dd/MM/yyyy" / "Not on file", no pill; the CofA / ARC line under the ARC row (`airworthiness_document.kind` cofa | arc). Desktop table and mobile cards both updated.
- Logbooks (U21): the two rebuild buttons sit under an "Advanced" disclosure (`vm.show_advanced`) with their explanations visible.
- Events (B2 / U12 / B14): `check_date | myDateTime`, hours `| number:1`, `MF.typeLabel` for every type (blank → "Maintenance (type not recorded)", `50hour` normalised), chips from `MF.eventFilterOptions(events)` (every type present), filtering in the `ng-repeat` filter + `.mx-event-item.ng-leave {transition:none}` (the 2 s lag was ngAnimate waiting on the hover transition per row). Event meta shows `next_check_type` when the row has it.
- Workpack panel (B4): "Link a Maintenance Event" lists `vm.linkableEvents()` (= `vm.maintenance_events` without a `workpack_id`).
- U18: every read and every workpack write has an error branch with `data.message` (`readMessage()`, `workpackWrite()`); the list page shows `vm.list_error`.

## Expiry-day wording (batch 17)
The backend counts days exclusively — the expiry / due day itself = 0 and still valid until 23:59, tomorrow = 1, yesterday = −1 — and flags the day itself: `expires_today` beside every `days_to_expiry`, `due_today` beside `days_remaining`. A 0 WITHOUT the flag is "no date on file". `MF.expiryDaysWord(doc)` → "Expires today" / the number / "—"; `MF.checkDaysWord(maintenance)` → "Due today" / the number; `MF.daysOverdue(days, flag)` = negative, or 0 that is not the day itself. The fleet list's "ARC / Permit days" badge and the detail's "Days to next check" use them; the v2 and legacy book-out pages, the aircraft-status page and the v2 member aircraft page read the same flags (never "overdue" / "expired" on the day).

**Hours to next check** are a core, required field for every check type — the annual's optional "Hours" step is gone (`fieldsFor(...).hours` true for every check, `step_hours` always false). An anchor check without hours (a legacy row — the backend refuses a new one) shows "Hours to next check not recorded — edit this check to add it" on the detail page (`MF.hoursNotRecorded(maintenance)`); the link (`vm.editAnchorCheck`, `data-e2e="mx-edit-anchor-check"`) opens that event's edit panel by `maintenance.anchor_check_id`, loading the events first when needed.

## Fleet list
B10 `ok` → green badge (`MF.statusBadgeClass`); dd/MM/yyyy everywhere with "No expiry" / "Not on file" (B11 / U15); the column is "ARC / Permit days" (it was "Days Rem." — the detail's "days" is the next check); `next_check_type` under the hours badge; the hard-coded `club_id: '6'` ui-sref params are gone.

## Backend contract used (live local API, 2026-11-10 — matches)
- `GET planes/{p}/club_maintenance2/{c}`: `maintenance.next_check_type` (string|null), `maintenance.anchor_check_id`, `offline: {until, notes, booking_id} | null`.
- `GET planes/club_maintenance/{c}` rows: `next_check_type`.
- `POST planes/{p}/maintenance`: `maintenance.maintenance_type` in `annual, 25hours, 50hours, 100hours, interim, 6months`; `check_date` with a time; `maintenance.next_check_type`; `extension` its own block. Refusals `{success:false, error: VALIDATION_ERROR|FORBIDDEN|SAVE_FAILED, message}` — writeGuard's `HANDLED_CODES` swallows them, so the handlers toast `data.message` themselves.

## Out of scope (owner / later)
Night mode, the redesign pass (A7 items 2–4), defect row actions (U11), the edit-event panel's echo / delete (U13), bring-back-online from this page, `dist/` rebuild.
