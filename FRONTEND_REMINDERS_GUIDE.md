# Frontend Reminders Guide

UI brief + API reference for the unified expiry-reminder system. Two
surfaces to build:

1. **Account Settings → Reminders** (any user) — toggle and re-time their
   own expiry reminder emails (medical, licence, rating, membership,
   payment card, proof of ID, qualifications).
2. **Club Admin → Reminders** (club managers) — configure the aircraft /
   organisation reminders (ARC, CofA/Permit, maintenance due, hours to
   maintenance, radio licence, insurance), choose **who** receives them,
   and let each recipient tune their own timeline.

Backend spec: [BACKEND_REMINDERS_GUIDE.md](BACKEND_REMINDERS_GUIDE.md).
All endpoints are under `/api/v1/reminders/` with the standard auth
(Basic `userId:session` + `Api-Key` header). Errors always come back as
`{"success": false, "message": "..."}`.

---

## Core concepts (read first)

- **Offsets** are "send this many days before expiry" values, e.g.
  `[30, 14, 1, 0]` = 1 month before, 2 weeks before, the day before, and
  on the day. They are **bands**: an item added 5 days before expiry
  still gets the 14-day-band email once, then the 1-day and 0-day ones.
  The UI should present offsets as editable chips/tags, sorted
  descending; the backend re-sorts and dedupes anyway.
- **Units**: every type is days **except `aircraft_hours`**, whose
  offsets are *flying hours remaining* (default `[5, 2]`). Always render
  the `unit` field from the API next to the input.
- **Validation** (server-enforced, mirror client-side): 1–8 integer
  values, each 0–365 for days, 0–500 for hours. Invalid input returns
  `success: false` with a human-readable `message` and **nothing is
  saved** for that request.
- **Defaults**: a type with `is_default: 1` has no stored row — the user
  /club is on the standard timeline. Show a "default" badge and a
  "reset to default" affordance (send the type's `default_offsets` back).
- Reminder emails are **digests** — one email per person per day
  covering everything due — so there is no per-item send preview to
  render, only the timeline settings.

---

## 1. Account Settings → Reminders (individual)

### Load

`GET reminders/preferences`

```json
{
  "success": true,
  "preferences": [
    {
      "reminder_type": "medical",
      "label": "Medical expiry",
      "description": "Class 1 / Class 2 / LAPL medical components approaching their expiry date.",
      "enabled": 1,
      "offsets_days": [30, 14, 1, 0],
      "default_offsets": [30, 14, 1, 0],
      "is_default": 1
    },
    { "reminder_type": "licence",       "...": "..." },
    { "reminder_type": "rating",        "...": "..." },
    { "reminder_type": "membership",    "...": "..." },
    { "reminder_type": "card",          "...": "..." },
    { "reminder_type": "poid",          "...": "..." },
    { "reminder_type": "qualification", "...": "..." }
  ]
}
```

Render one row per type: label + description, an enable toggle, and the
offset chips. (Every individual type is days — no unit handling needed
on this screen.)

### Save

`PUT reminders/preferences` — partial: send **only the types the user
changed**. Omitting `offsets_days` resets that type to its defaults;
omitting `enabled` keeps its current value.

```json
{
  "preferences": [
    { "reminder_type": "medical", "enabled": 1, "offsets_days": [60, 30, 7, 1, 0] },
    { "reminder_type": "card",    "enabled": 0 }
  ]
}
```

Response = the same shape as the GET (full refreshed list) plus
`"updated": ["medical", "card"]`, so you can re-render straight from the
save response.

### Optional: history

`GET reminders/history?limit=50` → `{"success": true, "rows": [{
"reminder_type", "club_id", "entity_id", "due_key", "offset_value",
"sent_at"}]}` — most recent first. `due_key` is the expiry date the
email was about; `offset_value` is the band that fired. Useful for a
small "recently sent" list under the settings; skip if not needed.

### Copy suggestions

- Membership row: mention "only memberships that don't auto-renew get
  reminder emails — auto-renewing memberships renew automatically".
- Card row: "we remind you before the end of the card's expiry month".

---

## 2. Club Admin → Reminders (organisation / aircraft)

Permissions: `GET/PUT club_settings`, `POST/DELETE recipients`,
`club_history`, `run_org` require **club manager** (`members.is_manager`
or `club_super_admin`) on that club. `PUT recipients/{club}/{row}` is
also allowed for the **row's own user** (see "self-service" below).
Non-managers calling manager endpoints get
`{"success": false, "message": "Club manager privileges required."}`.

### Load

`GET reminders/club_settings/{club_id}`

```json
{
  "success": true,
  "club_id": 2,
  "settings": [
    {
      "reminder_type": "aircraft_arc",
      "label": "Aircraft ARC expiry",
      "description": "Airworthiness Review Certificate expiry (CofA aircraft).",
      "unit": "days",
      "enabled": 1,
      "offsets": [30, 7, 1, 0],
      "default_offsets": [30, 7, 1, 0],
      "is_default": 1
    },
    {
      "reminder_type": "aircraft_hours",
      "label": "Hours to maintenance",
      "unit": "hours",
      "offsets": [5, 2],
      "...": "..."
    },
    { "reminder_type": "aircraft_certificate",   "...": "..." },
    { "reminder_type": "aircraft_maintenance",   "...": "..." },
    { "reminder_type": "aircraft_radio_licence", "...": "..." },
    { "reminder_type": "aircraft_insurance",     "...": "..." }
  ],
  "recipients": [
    {
      "id": 12,
      "user_id": 42,
      "reminder_type": "aircraft_arc",
      "enabled": 1,
      "offsets_override": null,
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@example.com"
    }
  ]
}
```

Suggested layout: a settings table (one row per type — toggle + offset
chips, hours vs days labelled from `unit`), then a recipients section
**grouped by person** (recipients come back as one row per
person-per-type; group `user_id` and show which types each person gets).

⚠️ `offsets_override` in recipient rows is a **CSV string** (`"14,3"`)
or `null` (= inherit the club offsets). Parse before rendering; when
saving, send it back as an **array** (see below).

### Save club-level settings

`PUT reminders/club_settings/{club_id}` — partial, same semantics as
the individual PUT:

```json
{
  "settings": [
    { "reminder_type": "aircraft_hours", "enabled": 1, "offsets": [10, 5, 2] },
    { "reminder_type": "aircraft_insurance", "enabled": 0 }
  ]
}
```

Response = full refreshed `club_settings` payload.

### Manage recipients

Add (member picker — posts; recipient **must be a current member** of
the club, else `success: false`):

```
POST reminders/recipients/{club_id}
{ "user_id": 42, "reminder_types": ["aircraft_arc", "aircraft_hours"] }
// or subscribe to everything:
{ "user_id": 42, "reminder_types": "all" }
```

Idempotent — re-adding an existing (user, type) just re-enables it.
Response: `{"success": true, "added": [...], "recipients": [...]}`.

Update one row (toggle, or personal timeline):

```
PUT reminders/recipients/{club_id}/{row_id}
{ "enabled": 0 }
{ "offsets_override": [14, 3] }     // personal timeline (array!)
{ "offsets_override": null }        // back to inheriting the club offsets
```

Remove: `DELETE reminders/recipients/{club_id}/{row_id}` (manager only).
Both return the refreshed `recipients` array.

**Self-service — NOT implemented (product decision, 2026-07):** club
reminders are managed by club admins only; a member who wants to stop
receiving them asks their admin, who toggles/removes their recipient
row. The backend still supports recipient self-editing
(`PUT recipients/{club}/{row}` for the row's own user, and
`GET reminders/my_subscriptions` returning the caller's rows enriched
with `club_title`, labels, `unit`, `club_enabled`, `club_offsets`, a
parsed `offsets_override` array/`null` and computed
`effective_offsets`) — so the account-settings surface can be added
later without backend work, but the frontend deliberately does not use
these today.

**Fallback to owner:** if a type has *no recipient rows at all*, the
backend emails the club owner. Surface this: "No recipients configured —
reminders go to the club owner."

### Preview ("what would go out today?")

`GET reminders/run_org/{club_id}?dry_run=1` (manager) — runs the real
engine without sending or logging:

```json
{
  "success": true, "dry_run": 1, "club_id": 2, "would_email": 1,
  "recipients": [
    {
      "user_id": 42,
      "email": "jane@example.com",
      "items": [
        "G-ABCD: ARC expires in 7 days (2026-07-15)",
        "G-ABCD: 4.5 flying hours remaining until the next maintenance check"
      ]
    }
  ]
}
```

Great for a "Preview today's emails" button. Items already sent (deduped)
don't reappear, so an empty preview after a send is normal.
`dry_run=0` sends for real — don't expose that as a casual button.

### History

`GET reminders/club_history/{club_id}?limit=100` — rows like the user
history plus `first_name`/`last_name` of each recipient. Suitable for a
"sent log" tab.

---

## Reminder type keys (for switch statements / icons)

| Individual      | Organisation             |
|-----------------|--------------------------|
| `medical`       | `aircraft_arc`           |
| `licence`       | `aircraft_certificate`   |
| `rating`        | `aircraft_maintenance`   |
| `membership`    | `aircraft_hours` (hours!)|
| `card`          | `aircraft_radio_licence` |
| `poid`          | `aircraft_insurance`     |
| `qualification` |                          |

`GET reminders/types` returns both families with labels, descriptions,
units and default offsets — prefer building the UI from that instead of
hard-coding, so new types appear automatically.

---

## Cron / timing note (for the admin "Automations" page)

The org reminders run via the existing per-club cron scheduler
(`club_cron_schedules`, endpoint `reminders/cron`, default **06:00**
local) — the row appears automatically in the existing
`GET cron_schedules/club/{club_id}` list with label "Aircraft &
organisation reminders", so the current Automations UI picks it up with
no extra work. Individual reminders are a fixed daily system cron
(`users/process_reminders`) and are not per-club configurable.
