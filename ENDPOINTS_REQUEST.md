# New Endpoints Required for Instructor-First Booking Flow

## Endpoint 1: Get instructor by user_id

```
GET /api/v1/bookings/instructor_by_user/:user_id
```

**Purpose:** Given a user_id (the number after "fi_" in the calendar resource ID), return the full instructor object including which clubs they're associated with.

**Expected response:**
```json
{
  "id": 4,
  "user_id": 4,
  "first_name": "Eva",
  "last_name": "Ceh",
  "clubs": [
    { "id": 12, "title": "Flying Club A" },
    { "id": 15, "title": "Flying Club B" }
  ]
}
```

The `id` here should match whatever `id` is returned for this instructor when calling the existing `GET /api/v1/bookings/plane_instructors/:user_id/:plane_id/:start/:end` endpoint — so the frontend can match them as the same person. `user_id` should be the user's ID (the one used in `fi_4`). Include any other fields that already exist on instructor objects returned by `plane_instructors`.

---

## Endpoint 2: Get planes an instructor can teach on

```
GET /api/v1/bookings/instructor_planes/:user_id/:instructor_user_id/:start/:end
```

- `:user_id` — the logged-in user's ID (for auth, same as other booking endpoints)
- `:instructor_user_id` — the instructor's user_id (the number from `fi_4`)
- `:start` — ISO date string for availability window start
- `:end` — ISO date string for availability window end

**Purpose:** Return all planes this instructor is associated with as an instructor, across all clubs. This is the reverse of `GET /api/v1/bookings/plane_instructors` — instead of "which instructors for plane X", this is "which planes for instructor Y".

**Expected response** — array of plane objects, same shape as `GET /api/v1/bookings/planes/:user_id/:start/:end`:
```json
[
  { "id": 5, "title": "G-ABCD", "club_id": 12, "plane_type": "PA-28", "seats": 4 },
  { "id": 8, "title": "G-EFGH", "club_id": 12, "plane_type": "C152", "seats": 2 },
  { "id": 14, "title": "G-IJKL", "club_id": 15, "plane_type": "PA-28", "seats": 4 }
]
```

Each plane object should include `club_id` so the frontend can derive the club context when the user selects an aircraft. Include availability/booking conflict data if the existing `planes` endpoint already does that.
