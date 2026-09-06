# AirfieldHub — frontend test script

Walkthrough for the frontend built against
`FRONTEND_AIRFIELDHUB_INTEGRATION_GUIDE.md`. Mirrors the guide's §7 but
covers only what the browser can show; backend/queue behaviour is verified
through the UI surfaces rather than directly.

Run on `https://local.toaviate.com`. All six `airfieldhub_sync/*` routes were
confirmed present on `local-api` (they return 403 without a session, 200 for
`/cron`), so nothing here is stubbed.

---

## 0. Prerequisites

1. AirfieldHub dev/staging keys in `con.inc.php` (`$GLOBALS['AIRFIELDHUB_CONFIG']`).
   Without at least one, every environment shows **no key** and the staff page
   correctly refuses to let you select one — that is itself test 1b.
2. Migration applied: `php migrate.php migrate --env=local`.
3. `TOAVIATE_WEBHOOK_URL` configured **on AirfieldHub's side** pointing at your
   box, or decisions never come back (tests 8–10 will hang at "Awaiting PPR").
4. Log in as a `@toaviate.com` account for §A, and as a club manager for §B.

---

## A. Staff screen — Super Admin → AIRFIELDHUB

| # | Step | Expected |
|---|---|---|
| A1 | Open the tile | Page loads; environment pills across the top |
| A2 | Look at an unconfigured environment (usually `production`) | Shown **disabled** with a `no key` chip — visible, not hidden. Clicking does nothing |
| A3 | Open as a **non-staff** user | "ToAviate staff only" panel, pointing at the club page. No requests fired |
| A4 | **Overview** tab | Partner key = "Configured on server". Webhook secret = Set, or an amber "Missing — decisions can't come back" |
| A5 | Confirm no key is ever shown | Nothing key-shaped anywhere; the note explains keys stay server-side. **If you can see a key value, stop — that's a leak** |
| A6 | **Directory** tab, before any sync | Amber warning: "No AirfieldHub airfields synced yet…" |
| A7 | Click **Sync now** | Spinner → stat grid: Received / Added / Updated / Matched locally / **Can receive movements** (highlighted) |
| A8 | Read the hint under the stats | Explains `matched_local < received` is normal — pre-empts the "sync looks broken" ticket |
| A9 | Filter the directory | Table filters; >200 rows shows a "refine the filter" note rather than rendering thousands |
| A10 | **Queue** tab | Pending / In flight / Sent / Retrying / Dead |
| A11 | If `dead > 0` | Red banner *and* a count badge on the Queue tab (visible from other tabs) |
| A12 | Click **Send now** | Calls `/cron`, waits, refreshes counts, toast confirms |

---

## B. Club screen — Manage Club → Settings → AirfieldHub

| # | Step | Expected |
|---|---|---|
| B1 | Settings page | New **AirfieldHub** card after "Airfield Bookout System" |
| B2 | Open it | Header shows **Active** / **Not active** pill; hero explains the feature in one line |
| B3 | **Setup**, no environment chosen | Enable toggle is **disabled**, sub-label reads "Choose an environment first" |
| B4 | Environment dropdown | Lists **only** environments with a key. Hint says keys never appear in the browser |
| B5 | Choose one, toggle Enable, **Save** | Saves; pill flips to Active |
| B6 | Stage still 0 | Amber note: "Active, but the rollout stage is Off — nothing is sent yet" |
| B7 | Pick a stage | Radio cards 0–4 with the guide's exact help text |
| B8 | Change anything | "Unsaved changes" appears; Save is disabled until something is dirty |
| B9 | Force a refusal (env whose key you removed) | The **backend's** message shows verbatim, not a generic error |
| B10 | Get `enabled:true, effective:false` | Amber "Enabled, but not active" — a warning, **never** a success state |
| B11 | **Aircraft** tab → Sync now | Confirms count; `last_synced_at` populates; hint explains it is a full replace |
| B12 | **PPR status** tab | Table on desktop, cards on mobile |

### B13 — status wording (the dangerous one)

Verify each against the guide's §5 table. The rule that matters:

- **`New` on an ARRIVAL → "Awaiting PPR"**, info-blue. **Never green, never
  wording that implies the pilot may launch.**
- `New` on a DEPARTURE → "Booked out".
- `Approved` on a departure does **not** say "PPR approved" — departures have
  no PPR.
- `Rejected` → the airfield's `rejection_message` is shown **verbatim**. A
  refusal with no reason forces a phone call and defeats the integration.
- `reopened: true` → "Your changes mean this flight needs approving again."
  (Silently showing "awaiting" after it was approved reads as a bug.)

---

## C. Pilot surface — book out

| # | Step | Expected |
|---|---|---|
| C1 | Book out, pick a destination **on** AirfieldHub | Green: "**PPR can be filed automatically.** … is on AirfieldHub" |
| C2 | Pick one **not** on the network | Neutral grey: "PPR must be arranged directly with this airfield." Not alarming |
| C3 | Type a free-text destination | No crash; treated as unknown |
| C4 | Club has AirfieldHub off / stage 0 | **Nothing renders at all** — no strip, no requests |
| C5 | Kill the API, pick a destination | Amber "We couldn't check AirfieldHub just now." Must **not** claim unsupported |
| C6 | **Save the booking** | Saves **immediately**. No spinner waiting for a PPR result — dispatch is queued and the decision arrives by webhook |
| C7 | Switch destinations rapidly | Strip matches the **current** destination (stale responses are discarded) |

---

## D. Cancel, never delete

| # | Step | Expected |
|---|---|---|
| D1 | Tower display, a live bookout | Action is a **ban icon**, tooltip "Cancel this bookout" — no trash icon |
| D2 | Click it | Confirm reads "…cancel the bookout and withdraw any PPR request… cannot be undone" |
| D3 | Confirm | Optional reason prompt |
| D4 | After cancelling | Row **stays** in the day's list, greyed at 45% with reg/route struck through, badge **CANCELLED** |
| D5 | Cancelled row | Edit and Cancel buttons are **gone** — it cannot be un-cancelled |
| D6 | Reload / next poll | Still present with `status='cancelled'` (from `get_by_date`) |

---

## E. Negative tests (most valuable)

| # | Step | Expected |
|---|---|---|
| E1 | **Stop the AFH dev API**, then book a flight | **The booking still saves.** A partner outage must never break bookings — the single most important test here |
| E2 | Select an unconfigured environment | Refused with a clear message |
| E3 | Destination with `network_confirmed: 0` | Nothing queued; pilot told to arrange PPR directly |
| E4 | Bad webhook signature | `401 BAD_SIGNATURE` (backend; no frontend surface) |
| E5 | Log in as non-staff, hit `/dashboard/super_admin/airfield_hub` | Access panel, not a broken page |

---

## F. Responsive + polish

- [ ] Both admin pages at 375px: tabs scroll, icons drop below 480px, tables
      become cards, buttons go full-width
- [ ] PPR strip wraps cleanly on a phone
- [ ] Night mode on both pages (`.afh-*` has a full night palette)
- [ ] `prefers-reduced-motion`: pulse dot, drop-in and press animations all stop
- [ ] Keyboard: tabs and toggles show a focus ring

---

## Known gaps / not built (deliberate)

1. **Production environment** is absent until AirfieldHub issues a live key —
   it shows as unconfigured. Expected, per §9.1.
2. **Not in AFH v1** and deliberately not built (§9.2): conditional approvals
   with pilot acknowledgement, student-solo child movements as AFH records,
   `flight_type` taxonomy, decline alternatives.
3. **Special requests** (fuel, parking, customs) use each airfield's own
   `special_request_fields`; there is no global service list. The PPR table
   *displays* `special_requests_outcome`, but the submit-side form that renders
   an airfield's own fields into `custom_data` is a follow-up once the core
   flow is live (§9.3).
4. **Stage 3/4 tower-display behaviour** — §3.3 says stage 3 should banner the
   ToAviate tower display ("being retired… available until [date]") and stage 4
   should redirect it to the AFH board. Not built: the banner needs a
   retirement **date** that no endpoint currently returns, and the redirect
   needs the AFH board URL. Both are per-airfield values the API does not yet
   expose. Flagged rather than guessed.
