# Backend Endpoint Spec — Maintenance & Journey Logbook Exports

**Status:** Frontend implemented; backend endpoints required.
**Author:** Frontend team
**Date:** 2026-06-17

This document specifies the backend export endpoints needed for the four
aircraft logbooks exposed on the maintenance side of the app:

- **Airframe logbook**
- **Engine logbook** (per engine)
- **Propeller logbook** (per propeller)
- **Aircraft journey logbook**

Each must support **three export formats**: `csv`, `excel`, and `pdf`.

> **Pattern to follow:** these endpoints mirror the already-shipped personal
> logbook export (`GET /api/v1/personal_logbook/export/{csv|excel}`). Implement
> them the same way — generate the file server-side and stream it back as a
> binary body with the right `Content-Type` and a `Content-Disposition`
> filename. The PDF format is **new** (personal logbook doesn't have it yet) and
> must use the **UK CAA logbook layout** described below.

---

## 1. Frontend contract (already implemented)

The frontend calls each endpoint with `responseType: 'blob'` (so the API-Key /
session headers from the `$http` interceptor are attached), then saves the
returned blob client-side. See
[js/services/planeService.js](js/services/planeService.js) — `DownloadAirframeLog`,
`DownloadEngineLog`, `DownloadPropLog`, `DownloadJourneyLog`.

The frontend determines the saved filename and extension itself
(`{REG}_Airframe_Logbook.csv` etc.), but **you should still send a
`Content-Disposition: attachment; filename="..."` header** as the authoritative
name and for non-blob clients. The frontend uses your `Content-Type` header to
build the blob, falling back to:

| format  | fallback Content-Type            | extension |
|---------|----------------------------------|-----------|
| `csv`   | `text/csv`                       | `.csv`    |
| `excel` | `application/vnd.ms-excel`       | `.xls`    |
| `pdf`   | `application/pdf`                | `.pdf`    |

Recommended response headers:

```
Content-Type: text/csv; charset=utf-8                          (csv)
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet   (excel, .xlsx)
        — or application/vnd.ms-excel for legacy .xls
Content-Type: application/pdf                                  (pdf)
Content-Disposition: attachment; filename="G-ABCD_Airframe_Logbook.pdf"
```

> **CSV note:** prefix the body with a UTF-8 BOM (`﻿`) so Excel renders
> accented pilot/engineer names correctly — same as the personal logbook export.

---

## 2. Endpoints

All are **GET**, all are **club-admin / maintenance authenticated** (same auth
as the corresponding read endpoints they sit beside), and `{format}` is one of
`csv | excel | pdf`. Return `400` for an unknown format.

| Logbook    | Endpoint                                                                   | Sits beside (read endpoint)                                  |
|------------|----------------------------------------------------------------------------|--------------------------------------------------------------|
| Airframe   | `GET /api/v1/planes/airframe_logbook/{plane_id}/export/{format}`           | `GET /api/v1/planes/airframe_logbook/{plane_id}`             |
| Engine     | `GET /api/v1/planes/{plane_id}/engine_logbook/{engine_id}/export/{format}` | `GET /api/v1/planes/{plane_id}/engine_logbook/{engine_id}`   |
| Propeller  | `GET /api/v1/planes/{plane_id}/propeller_logbook/{prop_id}/export/{format}`| `GET /api/v1/planes/{plane_id}/propeller_logbook/{prop_id}`  |
| Journey    | `GET /api/v1/planes/get_journey_log/{plane_id}/export/{format}`            | `GET /api/v1/planes/get_journey_log/{plane_id}`              |

**Important:** the export must include **the full logbook**, not a paginated
slice. The read endpoints take `?offset=&max=`; the export endpoints take
**no pagination** and return every entry (oldest → newest is the natural
logbook order).

### Query params

- `?from=YYYY-MM-DD&to=YYYY-MM-DD` — **date range filter (now sent by the
  frontend).** The export UI offers quick presets (Last 30 days / Last 90 days /
  This year) and manual From/To pickers. Either bound may be present on its own
  (open-ended range) or both omitted (full export — the default). Filter on the
  entry date (`entry_date` for the maintenance logbooks, `flight_date` for the
  journey log). Bounds are **inclusive**. Matches the personal logbook export's
  `qs()` style.
- `?format_standard=uk_caa|easa|faa` — see §5. Default `uk_caa`. Not sent yet
  (reserved for a future UI toggle).

---

## 3. Data to include per logbook

Use the **same data** the matching read endpoint already returns — just the
complete set. For reference, the fields each logbook currently exposes:

### 3.1 Airframe / Engine / Propeller (maintenance logbooks)

Each row is either a **flight** entry or a **maintenance_check** entry
(`entry_type`).

Common fields:

| Field                              | Notes                                                        |
|------------------------------------|--------------------------------------------------------------|
| `entry_date`                       | date of the entry                                            |
| `entry_type`                       | `flight` \| `maintenance_check`                              |
| `flights`                          | flight entries only                                          |
| `landings`                         | **airframe only**                                            |
| `cycles`                           | **engine & propeller only** (instead of landings)            |
| `hours_flown`                      | decimal hrs, flight entries                                  |
| `total_hours`                      | cumulative total at this entry                               |
| `steo_hours` / total STEO          | **engine only** (Start Engine Time on Oil)                   |
| `hours_remaining_to_next_check`    | decimal hrs or null                                          |
| `created_at`                       | record creation timestamp                                    |
| `maintenance_check.maintenance_type`| for maintenance rows (e.g. `100hour`, `annual`, `arc`…)     |
| `maintenance_check.description`    | free text                                                    |
| `maintenance_check.first_name/last_name` | recorded-by                                            |
| `maintenance_check.checked_by`     | signatory free text                                          |
| `maintenance_check.expiry_date`    | next-due date                                                |
| `maintenance_check.linked_workpack_number` / `_status` | workpack ref                             |

Plus the **header block** identifying the component (put this at the top of the
PDF / first rows of the CSV):

- Airframe: `registration`, `manufacturer`, `plane_type`, `plane_class`,
  `serial_no`, `year_built`, `mtow`, `mlw`, current `total_hours`.
- Engine: `make`, `model`, `serial_no`, `tbo_hours`, `date_fitted`,
  `total_hours_at_start`, `steo_hours_at_start`, current `total_hours`,
  `hours_remaining`, plus the parent aircraft `registration`.
- Propeller: `make`, `model`, `serial_no`, `tbo_hours`, `date_fitted`,
  `total_hours_at_start`, current `total_hours`, `hours_remaining`, plus the
  parent aircraft `registration`.

### 3.2 Journey logbook

One row per flight:

| Field                                          | Notes                                |
|------------------------------------------------|--------------------------------------|
| `flight_date`                                  |                                      |
| pilot — `pic_first_name`/`pic_last_name` (fallback `first_name`/`last_name`) | PIC |
| `instructor_first_name`/`instructor_last_name` | if instructional                     |
| `put_first_name`/`put_last_name`               | pilot under training                 |
| `departure_airport` / `departure_airport_code` |                                      |
| `destination_airport` / `destination_airport_code` |                                  |
| `brakes_off` / `brakes_off_rounded`            | rounded to nearest 5 min             |
| `takeoff_time`, `landing_time`                 |                                      |
| `brakes_on` / `brakes_on_rounded`              |                                      |
| `flight_time`                                  | decimal hrs (airborne)               |
| `brakes_times_rounded`                         | decimal hrs (brakes-off→on, rounded) |
| `fuel_uplift_litres`                           | litres                               |
| `oil_uplift_litres`                            | quarts                               |

Header block: aircraft `registration` and `type_name`.

---

## 4. Format details

### 4.1 CSV

- UTF-8 with BOM.
- One header row of column names, then one row per entry, oldest → newest.
- Include a small metadata preamble (a few `key,value` lines) identifying the
  aircraft/component and export date, then a blank line, then the table — or
  put the identity in the filename only; either is acceptable. Keep it simple
  and re-importable (no merged cells / fancy formatting in CSV).
- Times: provide decimal hours for hour columns (e.g. `1.30`). The journey log
  brakes/takeoff/landing time-of-day columns stay as `HH:MM`.

### 4.2 Excel

- Prefer real **`.xlsx`** (`application/vnd.openxmlformats-...spreadsheetml.sheet`).
  Legacy `.xls` is acceptable if that's what the personal logbook export
  already produces — **match whatever library/approach the personal logbook
  export uses** for consistency.
- Same columns as the CSV, plus: a styled header block (aircraft/component
  identity), bold column headers, frozen header row, sensible column widths,
  and a totals row at the bottom (sum of `hours_flown`, `flights`, `landings`/
  `cycles`).
- Highlight maintenance-check rows (e.g. a light fill) so they stand out from
  flight rows.

### 4.3 PDF — **UK CAA logbook format** (the important one)

The whole point of the PDF is that a club can **print it and file it / paste it
into a traditional paper logbook**, so it must follow the standard **UK CAA**
aircraft / engine / propeller logbook column layout.

General layout for all three maintenance logbooks:

```
┌───────────────────────────────────────────────────────────────────────────┐
│  <REGISTRATION>  —  AIRFRAME / ENGINE / PROPELLER LOG BOOK                   │
│  Make/Type ............  Serial No ............  TBO/Next Due ............    │
│  Sheet n of m                                       (UK CAA format)          │
├──────┬───────────────────────────┬─────────┬──────────┬──────────┬──────────┤
│ Date │ Particulars / Details of  │ Hours   │ Hours    │ Total    │ Cert /   │
│      │ flight or maintenance     │ this    │ Brought  │ Carried  │ Signature│
│      │ (incl. landings/cycles)   │ entry   │ Forward  │ Forward  │          │
├──────┼───────────────────────────┼─────────┼──────────┼──────────┼──────────┤
│ ...  │ ...                       │ ...     │ ...      │ ...      │ ...      │
└──────┴───────────────────────────┴─────────┴──────────┴──────────┴──────────┘
                              Carried forward:  <total hours>
```

Required CAA-style behaviour:

- **Brought-forward / carried-forward totals.** Each page (and the document)
  must show the running cumulative total carried forward — this is the defining
  feature of a CAA logbook page. Use `total_hours` for the carried-forward
  value at each entry; show the brought-forward total at the top of each page.
- **One row per entry**, chronological (oldest first), grouped into printed
  pages with the header repeated on each page and "Sheet n of m".
- **Maintenance entries** render in the "Particulars / Details" column with the
  maintenance type, description, next-due date, workpack number, and the
  certifying engineer name in the "Certificate / Signature" column.
- **Flight entries** show flights/landings (airframe) or cycles (engine/prop)
  and hours flown.
- **Engine** logbook: include the **STEO** column. **Engine & propeller**: use
  **Cycles** where the airframe uses **Landings**.
- Print-friendly: A4 portrait (landscape acceptable for journey log — see
  below), black-on-white, hairline table rules, generous row height so it can
  be signed by hand if printed. No screen-only colours that waste toner.

**Journey log PDF** uses the UK CAA **Aircraft Journey Log / Tech Log** column
set (landscape A4 fits best):

```
Date | Aircraft (Reg/Type) | PIC | From | To | Brakes Off | T/O | LDG | Brakes On | Flight Time | Block Time | Fuel | Oil
```

with a daily / page subtotal and an overall total of flight time and block
time at the foot.

---

## 5. Future: selectable logbook standard (UK CAA / EASA / FAA)

The frontend currently always requests the default (UK CAA) PDF. Please build
the PDF renderer so the **format standard is a parameter** (`uk_caa` default,
with `easa` and `faa` to follow) rather than hard-coding the UK CAA columns.
A future frontend change will add a small dropdown and pass
`?format_standard=...`. No contract change is needed now — just don't paint
yourself into a corner with the column layout.

---

## 6. Error handling

- Unknown `{format}` → `400` with `{ "success": false, "message": "..." }`.
- No entries → still return a valid (empty-but-headed) file, **not** a 404, so
  the user gets a printable blank CAA sheet.
- Auth failure → `401` (the frontend's interceptor redirects to `/login`).
- On any server error the frontend shows a generic "Export failed" toast; a
  JSON `{ success:false, message }` body is helpful for logs but the frontend
  only distinguishes success (binary 2xx) vs. not.
