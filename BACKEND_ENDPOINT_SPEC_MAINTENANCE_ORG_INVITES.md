# Backend Endpoint Spec — Maintenance Organisation Invitations

## Why
A club admin assigning a "Maintenance partner" to one of their aircraft may not find that organisation in the dropdown — because it isn't yet registered with ToAviate. We've added a frontend affordance that lets the admin invite the engineering company by email. The company receives a link, signs up via the existing maintenance-org flow, and is automatically linked to the inviting club's aircraft once they finish registering.

This document specifies the backend pieces required to make that loop work.

---

## 1. New table — `maintenance_org_invites`

| Column                | Type                        | Notes |
|-----------------------|-----------------------------|-------|
| `id`                  | int, PK, AI                 | |
| `token`               | varchar(64), unique, indexed| URL-safe random (e.g. `bin2hex(random_bytes(32))`) |
| `email`               | varchar(255), indexed       | Invitee's email (case-insensitive lookup) |
| `organisation_name`   | varchar(255), nullable      | Hint that the inviting club typed (pre-fills `org.title` on signup) |
| `message`             | text, nullable              | Free-text personal note from the inviter |
| `club_id`             | int, FK → `clubs.id`        | The inviting club |
| `plane_id`            | int, FK → `planes.id`, nullable | The specific aircraft this is about (optional but typical) |
| `inviter_user_id`     | int, FK → `users.id`        | Whoever clicked "Send invitation" |
| `status`              | enum('pending','accepted','expired','revoked') default 'pending' | |
| `accepted_user_id`    | int, FK → `users.id`, nullable | The new admin user created during signup |
| `accepted_org_id`     | int, FK → `maintenance_organisations.id`, nullable | The org created on signup |
| `expires_at`          | datetime                    | Suggest `now() + 30 days` |
| `created_at`          | datetime                    | |
| `accepted_at`         | datetime, nullable          | |

Indexes: `(token)` unique, `(email, status)`, `(club_id)`.

---

## 2. Endpoints

All three live under the existing `maintenance_organisations` namespace.

### 2.1 `POST /api/v1/maintenance_organisations/invite`
**Auth:** Logged-in club admin (`current_club_admin` for `club_id` must match, or super-admin).

**Request body:**
```json
{
  "email": "engineer@example.com",
  "organisation_name": "Skyline Aviation Engineering Ltd",
  "club_id": 42,
  "plane_id": 187,
  "message": "Hi! We'd love to set up our maintenance records with you."
}
```
`organisation_name`, `plane_id`, and `message` are all optional. `email` and `club_id` are required.

**Behaviour:**
1. Validate the caller is an admin of `club_id`.
2. If an existing **active** maintenance org already has a verified user with this email → return `400` with `{success:false, message:"That email already belongs to a registered maintenance organisation — please pick them from the dropdown instead."}`.
3. If a **pending** invite already exists for `(email, club_id, plane_id)` and is not expired → reuse it (don't duplicate); optionally re-send the email.
4. Otherwise: create a row, generate a token, send the email.
5. Return:
```json
{ "success": true, "invite_id": 17, "expires_at": "2026-06-28T..." }
```

**Email:** Subject something like
> *{ClubTitle} has invited you to ToAviate*

Body should include the inviter's name, the club's name, the aircraft registration (if `plane_id` set), the personal `message` (if any), and a CTA button linking to:
```
https://app.toaviate.com/#!/signup/maintenance?invite=<token>
```

---

### 2.2 `GET /api/v1/maintenance_organisations/invite/:token`
**Auth:** Public (no session; respects standard API key).

Used by the signup page to pre-fill fields and show an invite banner.

**Response (200) when valid & pending:**
```json
{
  "success": true,
  "invite": {
    "token": "abc123…",
    "email": "engineer@example.com",
    "organisation_name": "Skyline Aviation Engineering Ltd",
    "message": "Hi! …",
    "club_title": "Cambridge Flying Club",
    "plane_registration": "G-ABCD",
    "inviter_name": "Jane Smith"
  }
}
```

**Response (404 / 410) when missing, expired, revoked, or accepted:**
```json
{ "success": false, "message": "This invite link is no longer valid." }
```
The frontend shows a warning toast in this case and lets the user sign up normally.

---

### 2.3 Modify `POST /api/v1/maintenance_organisations` (signup)
Already accepts `{tnc, user, organisation}`. **Now also accept an optional `invite_token`.**

When `invite_token` is present and valid (status = pending, not expired):
1. Create the user + organisation as usual.
2. Look up the invite row.
3. **If the invite's `email` matches the submitted `user.email` (case-insensitive)** — auto-verify the user's email (skip the verification step), because clicking a tokenised email link already proves email ownership.
4. **Auto-assign:** if `invite.plane_id` is set, insert into `plane_maintenance_org` (or whatever table powers `PlaneMaintenanceOrgService.Save`) linking `plane_id` → newly-created org, scoped to `invite.club_id`.
5. Mark the invite row: `status='accepted'`, `accepted_user_id`, `accepted_org_id`, `accepted_at=now()`.
6. **Notify the inviter** (`inviter_user_id`) via email + in-app notification:
   > *Skyline Aviation Engineering Ltd has accepted your invitation and is now linked to G-ABCD.*

Return the same success payload as a regular signup. The frontend already shows the success state.

---

## 3. Edge cases & rules

- **Token brute force:** rate-limit `GET /invite/:token` (e.g. 10 attempts per IP per minute). Tokens are 64 hex chars so guessing is infeasible, but defence in depth.
- **Expiry:** background job (or check on read) flips `status='expired'` for rows past `expires_at`.
- **Revocation:** add a future `DELETE /api/v1/maintenance_organisations/invite/:id` for the inviting club admin to cancel. Not needed for v1 frontend but worth scaffolding.
- **Plane already assigned:** if the plane already has a maintainer when the invitee accepts, **do not** overwrite it. Mark the invite accepted but skip the auto-assign and include `auto_assigned:false` in the signup response. The inviting club admin can then manually re-link.
- **Email match mismatch:** if `user.email` submitted on signup differs from `invite.email`, still accept the signup but **do not** auto-verify and **do not** auto-assign the plane. Treat as a regular signup that happens to carry a token; mark the invite `status='expired'`.
- **Duplicate sends:** the endpoint must be idempotent for `(email, club_id, plane_id)` while a pending invite is live — re-clicking "Send invitation" should resend the email, not create a second row.
- **GDPR:** invite rows hold an email address; include them in your user data-deletion flows.

---

## 4. Frontend touchpoints (already implemented)

For reference — no backend work needed here, but useful to know how the frontend will call you:

- Service: [js/services/maintenanceOrganisationService.js](js/services/maintenanceOrganisationService.js)
  - `Invite(payload)` → `POST /api/v1/maintenance_organisations/invite`
  - `GetInvite(token)` → `GET  /api/v1/maintenance_organisations/invite/:token`
  - `Signup(payload)` → already passes `invite_token` when present
- Club-side UI: "Maintenance partners" card on [views/manageclub/planes.html](views/manageclub/planes.html), with the inline invite panel (`mxo-invite-panel`) per aircraft row.
- Signup page: [views/forms/maintenance_signup/form.html](views/forms/maintenance_signup/form.html) shows an invite banner when `?invite=<token>` is in the URL and pre-fills `email` + `organisation_name`.
- Signup controller: [js/controllers/maintenanceSignupController.js](js/controllers/maintenanceSignupController.js) reads `$location.search().invite`.

---

## 5. Suggested response shape on failures

Keep consistent with the rest of the maintenance_organisations API:
```json
{ "success": false, "message": "Human-readable reason", "error": "machine_code_optional" }
```
The frontend shows `message` in a toast; `error` codes (e.g. `"invite_expired"`, `"email_taken"`) are nice-to-have for future i18n but not required.
