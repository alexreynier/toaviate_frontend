# Backend Guide — Club-wide Flight Time Display Convention

**Audience:** backend team.
**Written:** October 2026, alongside the frontend change that introduces one
club-wide convention for how flight times are *shown*.
**Scope:** display only. Nothing here changes how a flight is **charged**
(`planes.charge_type`, `flight_details.charge_basis`) or how the logbook
`*_rounded` values are derived — those stay exactly as in
`BACKEND_TIME_ROUNDING_GUIDE.md`.

---

## 1. Why

Members and instructors see flight times on a dozen screens (flights list,
aircraft journey log, claim a flight, book-in, debriefs, training records,
member detail…). Until now each screen picked its own mix: some showed
brakes off/on rounded to 5 minutes, some showed raw takeoff/landing to the
second, one mislabelled brakes times as "Takeoff/Landing". A club such as
The Pilot Centre may want every page to speak the same language — e.g.
"first takeoff → last landing, exact" — while a training school wants
"brakes off → brakes on, nearest 5 minutes".

The frontend now resolves **one convention per club** and renders every
flight time through a single component (`<flight-times>`, backed by
`TimeDisplayService`). Training records are pinned to brakes off → brakes on
and only inherit the club's rounding choice.

Precedence on screen:

```
viewer's temporary "Times" switch  >  aircraft override  >  club setting  >  default
```

The viewer switch is browser-local and never stored server-side.

---

## 2. What we need from the API

### 2.1 `clubs.time_display` — the club setting

| Column | Type | Values | Default |
|---|---|---|---|
| `clubs.time_display` | `VARCHAR(32)` | `block_rounded` · `block_exact` · `airborne_rounded` · `airborne_exact` | `block_rounded` |

| Value | Meaning |
|---|---|
| `block_rounded` | brakes off → brakes on, each rounded to nearest 5 min (the current logbook convention) |
| `block_exact` | brakes off → brakes on, nearest minute |
| `airborne_rounded` | first takeoff → last landing, nearest 5 min |
| `airborne_exact` | first takeoff → last landing, nearest minute |

- **Read:** include it in `GET /api/v1/clubs/{id}` (the settings screen and
  the display service both read the club through this endpoint — members
  and instructors already call it, e.g. for exams).
- **Write:** accept it on `PUT /api/v1/clubs/{id}`. The settings screen PUTs
  the whole club object as today; `bookingSlotsAdminController` shows the
  endpoint already tolerates partial updates.
- Validate against the four values; reject anything else with the usual
  `{success:false, message}`; treat `NULL` as `block_rounded`.
- Until the column exists the frontend silently falls back to
  `block_rounded`, so this can ship frontend-first.

### 2.2 `planes.time_display` — optional per-aircraft override

| Column | Type | Values | Default |
|---|---|---|---|
| `planes.time_display` | `VARCHAR(32) NULL` | same four values, or `NULL` = club default | `NULL` |

- The aircraft form sends it with the rest of the plane on
  `POST /api/v1/planes/` and `PUT /api/v1/planes/{id}`; the frontend sends
  `null` (not `''`) for "club default".
- Return it on `GET /api/v1/planes/{id}` (edit form).
- **Pass it through wherever a flight row carries an `aircraft` / `plane`
  sub-object**, so lists can honour the override without extra requests.
  The frontend looks for, in order: `row.aircraft.time_display`,
  `row.plane.time_display`, `row.plane_time_display`, `row.time_display`.
  Endpoints where this matters most:
  - `planes/get_all_flights_by_club` (club flights list — `flight.aircraft`)
  - `planes/get_journey_log/{id}` (`aircraft` block — already a raw `planes` row, so it comes for free)
  - `fox` unclaimed entries (`to_claim[].aircraft[]` — add `time_display` next to `registration`)
  - member journey logs / aircraft status (`log.aircraft`)
  Where there is no aircraft object the row's club setting is used — that's
  acceptable, it just means an aircraft override isn't reflected on that
  screen.

### 2.3 Fields the display relies on (already present — please keep them)

For every endpoint that returns a flight / plane-log-sheet row the frontend
normalises these names (first match wins):

| Purpose | Field names accepted |
|---|---|
| brakes off (raw `HH:mm:ss`) | `brakes_off` |
| brakes on (raw) | `brakes_on` |
| takeoff (raw) | `takeoff_time`, `takeoff`, `first_takeoff` |
| landing (raw) | `landing_time`, `landing`, `last_landing` |
| nearest-5 brakes | `brakes_off_rounded`, `brakes_on_rounded` |
| nearest-5 airborne | `takeoff_rounded`, `landing_rounded` |
| block duration, decimal hours | `brakes_times_rounded` (used for `block_rounded` so totals match training records) |
| club of the row | `club_id` (used on multi-club member screens) |

When a `*_rounded` value is absent the frontend derives it client-side with
the same rule as `BACKEND_TIME_ROUNDING_GUIDE.md` §2 (nearest minute, then
nearest 5 with `.5` rounding up), so please keep the backend derivation
identical — the two must never disagree.

**Nice to have:** add `takeoff_rounded` / `landing_rounded` to the journey
log, club flights and Fox unclaimed payloads (they already exist on invoice
`flight_details`). Then `airborne_rounded` clubs see backend-owned values
rather than the client-side derivation.

**Fox unclaimed entries** currently carry only `brakes_off`/`brakes_on`/
`airborne_seconds`. If the tracker has them, please add `takeoff_time` and
`landing_time` — an airborne-mode club otherwise sees the brakes window on
Claim a Flight (clearly flagged in the tooltip as a fallback).

---

## 3. What does NOT change

- Charging: `charge_type` / `charge_basis` / `billable_units` are untouched.
  Invoices (in-app and PDF) keep the parity spec from
  `BACKEND_TIME_ROUNDING_GUIDE.md` §7 and ignore `time_display`.
- Training-record totals, tag minutes and `brakes_times_rounded` semantics.
- The `00:00:00` sentinel still means "not recorded".

---

## 4. Acceptance check

1. `PUT /clubs/{id}` with `{"time_display":"airborne_exact"}` → subsequent
   `GET /clubs/{id}` returns it.
2. `PUT /planes/{id}` with `{"time_display":null}` clears the override;
   with `"block_exact"` it is returned on `GET /planes/{id}` **and** inside
   `flight.aircraft` on `planes/get_all_flights_by_club`.
3. An invalid value (`"foo"`) is rejected.
4. No change to any invoice, charge or logbook figure anywhere.
