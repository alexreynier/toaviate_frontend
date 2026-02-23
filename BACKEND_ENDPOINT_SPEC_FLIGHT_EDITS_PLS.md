# Backend Endpoint Specification: Flight Edits — PLS-Only Flow

## Overview

The frontend flight edit modal now supports editing **plane_log_sheet (PLS) entries that have no associated booking**. These are raw records from the boxes that have been cleaned up but were never tied to a booking in the system.

Previously, the modal only worked via `GET /api/v1/flight_edits/flight/{bookingId}` which loads data by booking ID. We now need a parallel endpoint that loads by PLS ID and returns the same response shape so the same modal can handle both flows.

The existing `Preview` and `Apply` endpoints already accept `plane_log_sheet_id` without `booking_id` — they just need to handle the case where `booking_id` is absent in the payload.

---

## How the Frontend Decides Which Endpoint to Call

In `dashboardClubFlightsController.js`, the `editFlight(flight)` function determines the mode:

```javascript
var flightBookingId = flight.booking_id || null;
var flightPlsId = flight.booking_id ? null : (flight.pls_id || flight.id);
```

- If `flight.booking_id` exists → calls `GET /api/v1/flight_edits/flight/{bookingId}` (existing)
- If no `booking_id` → calls `GET /api/v1/flight_edits/pls/{plsId}` (**NEW**)

---

## New Endpoint

### `GET /api/v1/flight_edits/pls/{plsId}`

**Purpose:** Load a plane_log_sheet record and all associated/contextual data needed by the flight edit modal, when no booking exists for this flight.

**Auth:** Requires authenticated user who is a manager/admin for the club that owns the aircraft on this PLS.

**URL Parameter:**

| Param   | Type | Description                          |
|---------|------|--------------------------------------|
| `plsId` | INT  | The `plane_log_sheets.id` to load    |

---

### Response Shape

The response **must** match the same top-level structure as the existing `GET /api/v1/flight_edits/flight/{bookingId}` endpoint, but with these differences:

- `booking` will be `null` (no booking exists)
- `plane_log_sheets` array is **not used** — instead return `plane_log_sheet` (singular) as the PLS object
- No invoices or payments will exist

```json
{
  "success": true,

  "plane_log_sheet": {
    "id": 53226,
    "plane_id": 42,
    "user_id": 1234,
    "instructor_id": 567,
    "from_airport_id": 89,
    "to_airport_id": 89,
    "flight_date": "2026-02-15",
    "brakes_off": "10:23",
    "takeoff_time": "10:28",
    "landing_time": "11:45",
    "brakes_on": "11:50",
    "tacho_start": 1234.5,
    "tacho_end": 1235.8,
    "landings": 3,
    "touch_and_gos": 2,
    "night_landings": 0,
    "authorised_solo": 0,
    "is_picus": 0,
    "remarks": "Circuit training",
    "route": "EGBJ - EGBJ",
    "pic_id": 1234,
    "put_id": null,
    "course_id": 15,
    "tuition_id": 8,

    "from_airport": {
      "id": 89,
      "code": "EGBJ",
      "title": "Gloucestershire Airport",
      "wgs_n": "51.8942",
      "wgs_e": "-2.1672"
    },
    "to_airport": {
      "id": 89,
      "code": "EGBJ",
      "title": "Gloucestershire Airport",
      "wgs_n": "51.8942",
      "wgs_e": "-2.1672"
    },

    "from_airport_code": "EGBJ",
    "from_airport_name": "Gloucestershire Airport",
    "to_airport_code": "EGBJ",
    "to_airport_name": "Gloucestershire Airport"
  },

  "booking": null,

  "user": {
    "id": 1234,
    "first_name": "John",
    "last_name": "Smith",
    "email": "john@example.com"
  },

  "instructor": {
    "id": 567,
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com"
  },

  "plane": {
    "id": 42,
    "registration": "G-ABCD",
    "plane_type": "PA-28"
  },

  "club": {
    "id": 10,
    "name": "Example Flying Club",
    "currency": "GBP"
  },

  "available_planes": [
    {
      "plane_id": 42,
      "registration": "G-ABCD",
      "plane_type": "PA-28"
    },
    {
      "plane_id": 43,
      "registration": "G-EFGH",
      "plane_type": "C172"
    }
  ],

  "available_instructors": [
    {
      "id": 567,
      "user_id": 567,
      "first_name": "Jane",
      "last_name": "Doe"
    }
  ],

  "available_members": [
    {
      "id": 1234,
      "user_id": 1234,
      "first_name": "John",
      "last_name": "Smith",
      "email": "john@example.com"
    }
  ],

  "invoices": [],
  "payments": [],
  "training_records": [],
  "edit_history": []
}
```

---

### Key Fields the Frontend Reads

The controller reads these fields from the response. All must be present (use `null` / `[]` for absent data):

| Response Field           | Type        | Required | Notes                                                                 |
|--------------------------|-------------|----------|-----------------------------------------------------------------------|
| `success`                | boolean     | Yes      | `true` if the PLS was found                                          |
| `plane_log_sheet`        | object      | Yes      | The PLS record itself (see fields below)                              |
| `booking`                | object/null | Yes      | Always `null` for this endpoint                                       |
| `user`                   | object/null | Yes      | The member/student on this PLS (`user_id` lookup)                     |
| `instructor`             | object/null | Yes      | The instructor on this PLS (`instructor_id` lookup), `null` if none   |
| `plane`                  | object      | Yes      | The aircraft (`plane_id` lookup)                                      |
| `club`                   | object      | Yes      | The club owning the aircraft — needs at minimum `id`, `name`, `currency` |
| `available_planes`       | array       | Yes      | All aircraft in this club. Each needs `plane_id`, `registration`      |
| `available_instructors`  | array       | Yes      | All instructors for this club. Each needs `id`, `first_name`, `last_name` |
| `available_members`      | array       | Yes      | Can be `[]` — the frontend will search via `MemberService` as the user types |
| `invoices`               | array       | Yes      | `[]` for PLS-only (no billing)                                        |
| `payments`               | array       | Yes      | `[]` for PLS-only                                                     |
| `training_records`       | array       | Yes      | Any training records linked to this PLS, or `[]`                      |
| `edit_history`           | array       | Yes      | Previous edits to this PLS, or `[]`                                   |

### PLS Object Fields

These are the fields on the `plane_log_sheet` object that the frontend reads:

| PLS Field            | Type        | Notes                                                      |
|----------------------|-------------|-------------------------------------------------------------|
| `id`                 | int         | The PLS ID                                                   |
| `plane_id`           | int         | Aircraft ID                                                  |
| `user_id`            | int/null    | The flying member's user ID                                  |
| `instructor_id`      | int/null    | Instructor user ID, `null` if no instructor                  |
| `from_airport_id`    | int/null    | Departure airport ID                                         |
| `to_airport_id`      | int/null    | Arrival airport ID                                           |
| `flight_date`        | string      | `YYYY-MM-DD`                                                 |
| `brakes_off`         | string      | `HH:MM` format (may not be on 5-min boundary)               |
| `takeoff_time`       | string      | `HH:MM` format                                              |
| `landing_time`       | string      | `HH:MM` format                                              |
| `brakes_on`          | string      | `HH:MM` format                                              |
| `tacho_start`        | float/null  | Tacho reading at start                                       |
| `tacho_end`          | float/null  | Tacho reading at end                                         |
| `landings`           | int         | Number of landings                                           |
| `touch_and_gos`      | int         | Number of touch and go's                                     |
| `night_landings`     | int         | Number of night landings                                     |
| `authorised_solo`    | int/bool    | 0 or 1                                                       |
| `is_picus`           | int/bool    | 0 or 1                                                       |
| `remarks`            | string/null | Flight remarks                                               |
| `route`              | string/null | Route string                                                 |
| `pic_id`             | int/null    | Pilot in command user ID                                     |
| `put_id`             | int/null    | Pilot under training user ID                                 |
| `course_id`          | int/null    | Course ID if on a training course                            |
| `tuition_id`         | int/null    | Instructor charge / tuition type ID                          |
| `from_airport`       | object/null | **Joined airport object** — see below                        |
| `to_airport`         | object/null | **Joined airport object** — see below                        |
| `from_airport_code`  | string/null | Fallback: ICAO code (e.g. `"EGBJ"`) if `from_airport` not joined |
| `from_airport_name`  | string/null | Fallback: airport name if `from_airport` not joined          |
| `to_airport_code`    | string/null | Fallback: ICAO code if `to_airport` not joined               |
| `to_airport_name`    | string/null | Fallback: airport name if `to_airport` not joined            |

### Airport Object Shape

When joining the airports table, include:

```json
{
  "id": 89,
  "code": "EGBJ",
  "title": "Gloucestershire Airport",
  "wgs_n": "51.8942",
  "wgs_e": "-2.1672"
}
```

**Important:** The frontend needs the full airport objects (`from_airport`, `to_airport`) to pre-populate the airfield ui-select dropdowns. Without them, the user would see empty From/To fields. The `from_airport_code` / `from_airport_name` fields are a fallback if the join isn't possible.

---

## Implementation Notes

### Query Strategy

```
1. Load the plane_log_sheet by ID
2. If not found → return { success: false, message: "Plane log sheet not found" }
3. Get the plane → planes table via pls.plane_id
4. Get the club → via plane.club_id
5. Verify requesting user is admin/manager of this club
6. Get the user → users table via pls.user_id (may be null)
7. Get the instructor → users table via pls.instructor_id (may be null)
8. Join from_airport → airports table via pls.from_airport_id (may be null)
9. Join to_airport → airports table via pls.to_airport_id (may be null)
10. Get available_planes → all active planes in this club
11. Get available_instructors → all instructors for this club (same query as booking screens use)
12. Get edit_history → any previous flight_edits records for this pls.id
13. Return the assembled response
```

### Matching the Existing `GetFlight` Endpoint Structure

The existing `GET /api/v1/flight_edits/flight/{bookingId}` returns:

```
{
  success: true,
  booking: { ... },
  plane_log_sheets: [ { ... } ],    ← array of PLS records for this booking
  user: { ... },
  instructor: { ... },
  plane: { ... },
  club: { ... },
  available_planes: [ ... ],
  available_instructors: [ ... ],
  available_members: [ ... ],
  invoices: [ ... ],
  payments: [ ... ],
  ...
}
```

The new PLS endpoint returns the same shape but:
- `booking` → `null`
- Uses `plane_log_sheet` (singular object) instead of `plane_log_sheets` (array)
- `invoices` → `[]`
- `payments` → `[]`

The frontend controller handles this branching:
```javascript
var pls;
if ($scope.hasBooking) {
    pls = data.plane_log_sheets && data.plane_log_sheets[0] ? data.plane_log_sheets[0] : null;
} else {
    pls = data.plane_log_sheet || data;
}
```

---

## Changes to `Preview` and `Apply` Endpoints

The existing `POST /api/v1/flight_edits/preview` and `POST /api/v1/flight_edits/apply` endpoints need to handle a payload **without** `booking_id`:

### Request Payload (PLS-only mode)

```json
{
  "plane_log_sheet_id": 53226,
  "booking_changes": {},
  "pls_changes": {
    "brakes_off": "10:25",
    "landing_time": "11:40",
    "instructor_id": 568,
    "course_id": 15,
    "tuition_id": 8
  }
}
```

Note: `booking_id` is **absent** from the payload when editing a PLS-only flight. The `booking_changes` object will always be empty `{}` in this case.

### Request Payload (Booking mode — existing, no changes needed)

```json
{
  "booking_id": 12345,
  "plane_log_sheet_id": 53226,
  "booking_changes": { "instructor_id": 568 },
  "pls_changes": { "instructor_id": 568, "brakes_off": "10:25" },
  "financial_action": "waive"
}
```

### Backend Logic for PLS-only Preview/Apply

When `booking_id` is absent:
1. Skip all booking-level mutation logic
2. Skip all financial recalculation (no invoice/payment cascade)
3. Apply `pls_changes` directly to the `plane_log_sheets` record
4. Still create an audit trail / `flight_edits` record for the changes
5. Still update any linked `training_records` if `instructor_id` or `course_id` changed
6. `financial_impact` in the preview response should be `{ has_impact: false }` (no billing)

---

## Error Responses

### 404 — PLS Not Found

```json
{
  "success": false,
  "message": "Plane log sheet not found"
}
```

### 403 — Not Authorised

```json
{
  "success": false,
  "message": "You are not authorised to edit flights for this club"
}
```

### 500 — Server Error

```json
{
  "success": false,
  "message": "An error occurred while loading the flight data"
}
```

---

## Summary of Backend Work Required

| # | Task                                                                 | Priority |
|---|----------------------------------------------------------------------|----------|
| 1 | **Create `GET /api/v1/flight_edits/pls/{plsId}`** endpoint          | HIGH     |
| 2 | Join `from_airport` and `to_airport` objects in the PLS response     | HIGH     |
| 3 | Load `available_planes` and `available_instructors` for the club     | HIGH     |
| 4 | Return `user` and `instructor` objects from user IDs on the PLS      | HIGH     |
| 5 | Return `club` object with at least `id`, `name`, `currency`         | HIGH     |
| 6 | Ensure `Preview` handles missing `booking_id` (PLS-only changes)    | MEDIUM   |
| 7 | Ensure `Apply` handles missing `booking_id` (skip financial cascade)| MEDIUM   |
| 8 | Audit logging for PLS-only edits (no booking reference)              | MEDIUM   |
