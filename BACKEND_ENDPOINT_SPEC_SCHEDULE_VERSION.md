# Backend Endpoint Specification: Schedule Version Polling (Auto-Refresh)

## Overview

The frontend schedule (desktop and mobile) now polls a lightweight endpoint every 30 seconds to detect booking changes. When the version number changes, it triggers a full calendar data refresh. This prevents double-bookings by ensuring all users see schedule updates within ~30 seconds.

This is the **same pattern** already used by the TV schedule display feature:
- TV display polls `GET /api/v1/schedule_display/:token/version` (unauthenticated, token-based)
- Desktop/mobile will poll `GET /api/v1/bookings/schedule_version/:user_id` (authenticated)

Both should return the **same `schedule_version` counter** — it just needs to be exposed via the authenticated bookings API as well.

---

## How It Works (Frontend)

1. User opens the schedule page → `BookingService.GetAll()` fetches events
2. Frontend captures `schedule_version` from the response (if present)
3. Frontend starts polling `GetScheduleVersion()` every **30 seconds**
4. Each poll returns just `{ success: true, schedule_version: N }` — **~100 bytes**
5. If `schedule_version` differs from the stored value → full `GetAll()` refresh
6. Polling stops when the user navigates away (`$scope.$on('$destroy')`)

**Data efficiency:** Hundreds of users polling = hundreds of tiny version checks per 30s. A full data reload only happens when something actually changed.

---

## Endpoint 1: GET `/api/v1/bookings/schedule_version/:user_id`

### Purpose

Lightweight version-check for the authenticated schedule. Returns only a version number — no booking data.

### Auth

Requires authenticated user. `:user_id` is the logged-in user's ID (same auth pattern as all other `/api/v1/bookings/` endpoints).

### Request

```
GET /api/v1/bookings/schedule_version/42
```

No query parameters needed.

### Response (200)

```json
{
  "success": true,
  "schedule_version": 1587
}
```

| Field              | Type    | Notes                                                    |
|--------------------|---------|----------------------------------------------------------|
| `success`          | Boolean | `true` if the request was valid                          |
| `schedule_version` | Integer | Current version counter for bookings visible to this user |

### Response (401)

Standard auth error — frontend interceptor handles redirect to login.

### What `schedule_version` Should Be

This should be the **same counter** used by the existing TV schedule display endpoint (`GET /api/v1/schedule_display/:token/version`).

It should increment whenever any booking is **created**, **updated**, or **deleted** for any club the user belongs to. Possible implementations:

#### Option A: Database Counter (Recommended — same as TV)
- A `schedule_version` column on the `clubs` table (or a separate `schedule_versions` table)
- Incremented by 1 on every booking INSERT, UPDATE, or DELETE
- The endpoint queries: "What is the max `schedule_version` across all clubs this user belongs to?"
- This is what the TV display already uses — just expose the same value here

#### Option B: Timestamp-Based
- Store `MAX(updated_at)` across all bookings for the user's clubs
- Return it as a Unix timestamp
- Frontend treats it as an opaque version number — works the same way

#### Option C: Hash-Based
- Compute a hash of booking IDs + updated_at timestamps
- More complex, but guarantees change detection even if timestamps aren't granular enough

**Option A is strongly recommended** since the infrastructure already exists for the TV display.

### Performance Considerations

- This endpoint will be called every 30 seconds per active user
- It must be **fast** — ideally a single indexed query, no JOINs to booking data
- If using Option A: `SELECT schedule_version FROM clubs WHERE id IN (user's club IDs)` with `MAX()`
- Consider caching (Redis/memcache) if load is high — the value only changes on booking mutations
- **Do NOT** query actual booking rows — that defeats the purpose of the lightweight check

---

## Endpoint 2 (Bonus): Include `schedule_version` in GetAll Response

### Endpoint

```
GET /api/v1/bookings/:user_id/:start/:end
```

This is the **existing** endpoint that returns all booking events and resources. No new endpoint needed — just add `schedule_version` to the response body.

### Current Response (example)

```json
{
  "events": [ ... ],
  "resources": [ ... ]
}
```

### Updated Response

```json
{
  "events": [ ... ],
  "resources": [ ... ],
  "schedule_version": 1587
}
```

### Why

The frontend needs an accurate baseline version on initial load. Without this, the first poll comparison would always trigger a redundant refresh (since `_scheduleVersion` starts at `-1`).

If `schedule_version` is present in the `GetAll` response, the frontend captures it immediately and the first poll that returns the same value is correctly treated as "no change."

---

## Frontend Code (for reference)

### BookingService (`js/services/bookingService.js`)

```javascript
service.GetScheduleVersion = GetScheduleVersion;

function GetScheduleVersion(user_id) {
    return $http.get('/api/v1/bookings/schedule_version/' + user_id)
        .then(handleSuccess, handleError2);
}
```

### Bookings2Controller (`js/controllers/bookings2Controller.js`)

```javascript
// State variables
var _scheduleVersion = -1;
var _pollTimer = null;
var _pollIntervalMs = 30000;  // 30 seconds

// Start polling after first data load
function _startSchedulePolling() {
    if (_pollTimer) return;
    _pollTimer = $interval(function() {
        BookingService.GetScheduleVersion(vm.user.id)
            .then(function(data) {
                if (data && data.success && 
                    data.schedule_version !== undefined && 
                    data.schedule_version !== _scheduleVersion) {
                    _scheduleVersion = data.schedule_version;
                    _refreshCalendarEvents();  // full GetAll + calendar update
                }
            });
    }, _pollIntervalMs);
}

// Cleanup
$scope.$on('$destroy', function() {
    if (_pollTimer) {
        $interval.cancel(_pollTimer);
        _pollTimer = null;
    }
});
```

---

## Relationship to Existing TV Schedule Display

| Aspect                | TV Display                                        | Desktop/Mobile (new)                              |
|-----------------------|---------------------------------------------------|---------------------------------------------------|
| Version endpoint      | `GET /api/v1/schedule_display/:token/version`     | `GET /api/v1/bookings/schedule_version/:user_id`  |
| Auth                  | Token-based (unauthenticated)                     | Standard user auth                                |
| Data endpoint         | `GET /api/v1/schedule_display/:token/:start/:end` | `GET /api/v1/bookings/:user_id/:start/:end`       |
| Poll interval         | 30 seconds                                        | 30 seconds                                        |
| Version source        | `schedule_version` counter on club                | Same counter — just exposed via authenticated API |
| Refresh trigger       | `$scope.$broadcast('schedule:version-changed')`   | Direct `GetAll` + FullCalendar update             |

The backend implementation for the new endpoint should be nearly identical to the existing `ScheduleDisplayController@getVersion` (or equivalent) — the only difference is auth method and how the user's clubs are determined.

---

## Testing Checklist

1. **Basic response:** `GET /api/v1/bookings/schedule_version/:user_id` returns `{ success: true, schedule_version: N }`
2. **Version increments:** Create a booking → version increases. Edit a booking → version increases. Delete a booking → version increases.
3. **Multi-club:** If user belongs to clubs A and B, a booking change in either club should change the version
4. **Performance:** Response time should be < 50ms under normal load
5. **Auth:** Unauthenticated requests return 401
6. **GetAll includes version:** `GET /api/v1/bookings/:user_id/:start/:end` response includes `schedule_version` field
7. **Consistency:** Version returned by `/schedule_version/:user_id` matches the version in the TV display endpoint for the same club
