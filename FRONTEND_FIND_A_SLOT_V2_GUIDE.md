# Find a slot — v2 (10 Nov 2026)

The v2 design of "Find a slot" (approved mockup `../mockups/my-account/find-a-slot.html`), beside the v1 page
(`dashboard.slot_search`, `views/bookings/slot_search.html`, `SlotSearchController`) behind the global "Try our v2
designs" switch. Build tracker: `../mockups/v2-build/fe-find-a-slot.md`.

## Files
- `js/v2/find_a_slot/find_a_slot.js` — state `dashboard.v2.find_a_slot` (URL `/dashboard/v2/my_account/find_a_slot`, no
  params, like v1) + `DesignRoutesProvider.map('dashboard.slot_search', 'dashboard.v2.find_a_slot')`; `FindASlotV2Data`
  (the read); `fsl-date-pick` (the mockup's middle date button opens `ToAviateDatePicker.attach`, no past days);
  `FindASlotV2Controller`.
- `views/v2/find_a_slot/find_a_slot.html` — page bar, search card, tiles, Grid | List, booking sheet, waiting-list sheet.
- `css/v2/find_a_slot.css` — the mockup's page CSS verbatim (prefix `.fsl-`), app additions at the end.
- Registered in `index.html` (link + script) and `Gruntfile.js` (`concat.css`; the JS glob already covers `js/v2/*/*.js`).
- Manage Club → Settings → Booking Settings: "Find a slot: show the availability grid only (hide the list view)"
  (`views/manageclub/settings.html`, `dashboardClubSettingsController.js`; shown once the club read has the column).

## Data — one read per club / first day / range / single-or-double
`GET /api/v1/bookings/v2/find_a_slot/{club_id}/{YYYY-MM-DD}/{num_days 1–60}?double_slot=0|1` (backend
`Models\FindASlotV2`, which calls the v1 `Bookings::get_available_booking_slots` read-only for all pages at once):

```
{ success, club_id, today, range{date_from, num_days, double_slot}, allow_aircraft_selection 0|1, find_a_slot_grid_only 0|1,
  slots_config[{key s0…, label, start_time, end_time, is_double}],
  days[{date, dow, weekend, cells[{slot, slot_start, slot_end, free, reason past|full|null,
        planes[ids: every free bookable aircraft], picks{plane_type: plane_id}, instructors[free user ids],
        mine null|{booking_id, start, end, registration, instructor_first_name, status}}]}],
  counts{cells, free}, planes[{id, registration, plane_type, type_name, seats, colour}], plane_types[],
  instructors[{id, first_name, last_name, initials, booking_mode open|instructor_approval|admin_approval, colour}],
  course_instructors null|{course_id: [user ids]},          // null = no qualification rows: everyone teaches everything
  me{user_id, restricted, limit{max, used, exempt, at_limit}} }
errors: {success:false, error: FORBIDDEN|BAD_REQUEST|NO_SLOTS|NO_DOUBLE|NO_AIRCRAFT|UNAVAILABLE, message}
```
- The aircraft type, the instructor and the course filter **on the client** (instant): a cell is free when it has an aircraft
  of the type and, with an instructor or a course chosen, a matching free instructor — else "Not with Kate" / "No
  instructor" / "Taken" / "Past". Mine wins ("Yours").
- Clubs: `MemberService.GetUserClubs` (as v1). Courses: `CourseService.GetCoursesByClubId` (as v1; the course field hides
  when the club has none). No `MemberService.GetAllByClub` (v1 loaded every member to work out "restricted").
- Double slots are the backend's pairs of back-to-back slots (sliding: M1+M2, M2+A1, A1+A2 at a 4-slot club).

## Booking
`BookingService.Create` → `POST bookings/` (the scheduler v2 panel's path): `{club_id, user_id, plane_id, instructor_id|0,
start: slot_start, end: slot_end, booked_by, override: 0, course_id|0}`. `plane_id` = the registration chosen when the club
lets members pick and no instructor is chosen (`allow_aircraft_selection` — v1 ignored it), else `picks[type]` (the backend's
own per-type pick). `requires_approval` / `booking_status pending_*` → "Request sent"; `reason: max_future_bookings` → the
limit note; other refusals are shown in the sheet (`ToastService.handledInline()`). On success the cell turns "Yours" at
once and the search re-runs quietly when the sheet closes.

## Owner decisions (10 Nov)
- View: a phone opens on the **List**, a desktop on the **Grid** (`DEFAULT_VIEW`); the member's choice is remembered
  (`localStorage toaviate_fsl_view`); a club with `find_a_slot_grid_only = 1` shows the grid only (no tabs).
- "Join the waiting list" (empty state) stays on the page: a confirm sheet (days, what for, aircraft / instructor from the
  search, notice) → `WaitingRequestsService.Create` (`POST waiting_requests`, the scheduler v2 form's API) → "You're on the
  waiting list". The endpoint takes ≤ 10 dates (owner 11 Nov: the cap stays): the first 10 days of the range are ticked
  (swap by tapping). Since batch 21 (11 Nov) the chosen course goes as `course_id` and the length as `slots_needed`
  (`2` with Double slot on, else `1`) — real fields, no longer in `notes` (sent empty). The confirm sheet and the "You're
  on the waiting list" step show both as pills. Staff see them on the request (scheduler v2 waiting panel: course chip +
  "Double slot"); the matcher only offers a double-slot request a freed slot whose neighbouring club slot is free too
  (backend FRONTEND_SCHEDULER_V2_GUIDE.md §2).

## Waits
Skeletons for the first paint; a re-search running longer than 0.6 s shows `<ta-runway>`; the sheets show a compact runway
while booking / sending. The app-wide 1.2 s float needs nothing from the page.

## Tests
Backend `api_tests/tests/FindASlotV2Test.php` (suite `FindASlotV2`). Headless walk (read-only, writes mocked; desk 1280,
phone 390, night): scratchpad `walk/walk.js` of the builder session — see the tracker for the path and results.
