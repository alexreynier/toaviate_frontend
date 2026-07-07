# BACKEND_SIGNUP_ROBUSTNESS_GUIDE.md
### Making every signup / invitation flow bullet-proof — backend work package

**Audience:** the backend agent. This guide is self-contained — you do not need
to read the frontend code. Each task states the endpoint, current behaviour,
required behaviour, and acceptance criteria.

**Context.** The frontend (AngularJS SPA) has just been hardened so that
accidental refreshes, browser back/forward, and part-completed signups no
longer lose data: every wizard auto-saves a sanitised draft to `localStorage`
(never passwords, verification codes, or T&C ticks), restores it on return,
and re-syncs its progress stepper from the URL. What the frontend **cannot**
fix alone is anything that depends on server state: tokens that die when a
link is clicked twice, signups that duplicate when a button is pressed twice,
and payment redirects that only complete if the user comes back in the same
browser. That is this work package.

**Response convention.** The frontend's HTTP layer resolves (never rejects)
and controllers branch on `data.success`. All endpoints below must return
HTTP 200 with `{ "success": true | false, ... }` (plus `message` on failure),
matching the rest of the API.

---

## The flows and the endpoints they touch

| Flow | Key endpoints |
|---|---|
| Club/organisation signup (`/club_signup`, `/club_signup2`) | `POST /api/v1/clubs/`, `POST /api/v1/users/:id/verify`, `POST /api/v1/users/verify_phone`, `POST /api/v1/go_card/setup` |
| Member invitation — **all roles**: passenger, student, rental member, instructor, administrator (`/invitations/:token`) | `GET /api/v1/invitations/:token`, `POST /api/v1/invitations/signup`, `POST /api/v1/go_card/create_mandate`, `POST /api/v1/users/verify_invited_user`, `POST /api/v1/users/verify_phone_invite` |
| Passenger invitation (`/passenger_signup/:token`) | `GET /api/v1/invitations/:token/:code`, `POST /api/v1/invitations/signup_pax`, `POST /api/v1/invitations/resend_pax_code` |
| Returning passenger → full account (`/passenger_signup_complete/:token`) | `POST /api/v1/invitations/verify_invitation_for_user`, passenger→user signup endpoint |
| Maintenance organisation (`/signup/maintenance`) | `POST /api/v1/maintenance_organisations/register`, maintenance invite lookup |
| Basic register (`/register`) | `POST /api/v1/users`, `POST /api/v1/users/:id/verify` |

---

## Task 1 — Idempotent email verification ⭐ high priority

`POST /api/v1/users/:id/verify` — body `{ "verify_token": "…" }`

**Problem:** users refresh the verification page, click the email link twice,
or an email client pre-fetches the URL. If the token is single-use, the second
call fails and the user sees *"verification failed"* even though their email
IS verified. This affects club signup (`/club_signup2/verified/:token/:userId`
re-calls this endpoint on every refresh), register, and user-invite flows.

**Required:**
- If the token matches and the user is **already verified**, return
  `{ "success": true, "already_verified": true }` — never an error.
- Keep the token valid (or treat it as satisfied) after first use; only reject
  genuinely wrong/expired tokens.

**Accept when:** calling the endpoint twice with the same valid token returns
`success: true` both times.

## Task 2 — Invitation lookup is read-only and reports status ⭐ high priority

`GET /api/v1/invitations/:token`

**Required:**
- Reading an invitation must **never** consume, expire, or mutate it (users
  refresh this page constantly now).
- Add a `status` field to the payload: `"pending" | "account_created" |
  "completed"` (naming up to you, but distinguishable), so the frontend can
  resume the user at the right stage after a refresh — e.g. jump straight to
  payment/verification if the account already exists.
- If the invitation was **already accepted**, return `success: true` with
  `status: "completed"` (and the associated `user_id`), *not* a generic
  error — the frontend will show "You've already signed up — please log in"
  instead of a scary failure.
- Genuinely unknown/expired tokens keep returning an error shape (the
  frontend already shows a friendly "ask your club to re-send it" screen).
- Include the club's terms-document references in the payload's `club`
  object — `membership_terms` (member invites) and `passenger_terms`
  (passenger invites), the same stored filenames used in club settings. The
  "Terms & Conditions of the flight organisation" link on the signup terms
  step resolves these; when absent the frontend shows a "document
  unavailable" notice instead of the document.

## Task 3 — Idempotent invitation signup (no duplicate accounts) ⭐ high priority

`POST /api/v1/invitations/signup` (member invites, all roles)
`POST /api/v1/invitations/signup_pax` (passenger invites)

**Problem:** double-click, refresh-after-submit, or browser back + resubmit
can hit these twice. Worst case in the direct-debit path: the account is
created, the user is redirected to GoCardless, abandons it, comes back and
submits again → duplicate user or hard error with no way forward.

**Required:**
- Enforce uniqueness server-side: one created user per invitation token.
- If an account **already exists for this token**, do not error and do not
  duplicate. Return `{ "success": true, "already_created": true, ... }` with
  everything the frontend needs to continue where the user left off:
  - direct-debit path: a **fresh** GoCardless redirect link + session
    (same shape as the first response: `mandate: { link, session }`),
  - stripe path: `uid` + `session` as on first creation,
  - skip path: `uid`.
- Validate that the email being registered doesn't collide with an existing
  *different* account; if it does, return `success: false` with a clear
  `message` ("An account with this email already exists — please log in").

**Accept when:** posting the same valid signup twice produces exactly one user
and both responses have `success: true`.

## Task 4 — Complete payment redirects without cookies ⭐ high priority

**Problem:** completing a GoCardless redirect currently depends on
browser-side state:
- invitation flow: `POST /api/v1/go_card/create_mandate` needs a `session`
  cookie set before the redirect;
- club signup flow: `POST /api/v1/go_card/setup` needs `mid`/`bid` cookies.

On mobile the signup often starts in an in-app email browser and GoCardless
returns in the default browser → cookies missing → mandate never completes,
user stuck, no recovery path.

**Required:**
- When generating a GoCardless redirect link, persist the linkage
  (invitation token / club id / user id ↔ redirect flow) server-side.
- Allow completion keyed by what survives the redirect **in the URL**:
  `redirect_flow_id` (+ the invitation `token`, which is in the return URL for
  invitation flows). Accept the cookie session when present, but fall back to
  the stored linkage when it isn't.
- Make completion idempotent: completing the same `redirect_flow_id` twice
  returns `success: true` both times (users refresh the confirmation page).

**Accept when:** a mandate completes successfully in a cookie-less browser
session using only the return-URL parameters, and refreshing the confirmation
page does not error.

## Task 5 — Server-side signup drafts (cross-device resume) — recommended

Local drafts already cover same-device refreshes. To let a user start on
their phone and finish on a laptop (or survive a cleared browser), add:

- `PUT /api/v1/invitations/:token/draft` — body `{ "draft": { …json… } }`
- Return the stored draft in `GET /api/v1/invitations/:token` as `draft`.

Rules:
- The token is the only auth (these users have no account yet) — treat the
  draft as untrusted user content, cap size (~16 KB), store as an opaque blob.
- **Reject or strip** keys named `password`, `password2`, `formcode`,
  `stripe_setup_secret` anywhere in the payload — the frontend never sends
  them, but enforce it server-side too.
- Delete the draft when the invitation completes.
- Rate-limit writes (the frontend debounces to ~1 save/second maximum).

The frontend has a single integration point ready (`SignupDraftService`), so
no coordination is needed — ship the endpoints and the frontend can adopt them
in a follow-up.

## Task 6 — Resend endpoints + server-side rate limiting

1. **Resend verification email** — `POST /api/v1/users/resend_verification`
   body `{ "email": "…" }`. Always return `{ "success": true }` (never reveal
   whether the email has an account). Rate-limit per email/IP (e.g. 45 s
   cooldown, max 5/day) — mirror the existing
   `POST /api/v1/invitations/resend_pax_code` behaviour, including the
   `"Too many…"` message convention the frontend already parses.
2. **Resend phone verification code** for club signup and member invites
   (`verify_phone` / `verify_phone_invite` currently have no resend). Same
   pattern: `POST /api/v1/users/resend_phone_code` with `{ "id": … }`, same
   rate limits. Today the UI dead-ends at "please request a new code" with no
   way to request one.
3. **Server-side attempt limiting on all 6-digit code checks** —
   `GET /api/v1/invitations/:token/:code`,
   `POST /api/v1/invitations/verify_invitation_for_user`,
   `POST /api/v1/users/verify_phone`, `POST /api/v1/users/verify_phone_invite`.
   The frontend caps at 4 attempts, but that is cosmetic — enforce max
   attempts + lockout/regenerate server-side.

## Task 7 — Club signup: duplicate-safe create

`POST /api/v1/clubs/`

- If a submit is retried (double-click / refresh after a slow response),
  don't create a duplicate club+admin. Key on the admin email while the
  account is unverified: a repeat create for the same pending email should
  return `success: true` (and re-send the verification email) rather than
  erroring or duplicating.
- On validation failure return a human-readable `message` — the frontend now
  surfaces it in a toast.

## Task 8 — Phone number contract: **DECIDED (Option B — frontend sends E.164)**

**Agreed contract (2026-07):** every flow that collects a phone sends full
E.164 — `+` followed by digits only, e.g. `+447700900000`. No spaces, no
separate `phone_prefix` field. The backend passes the value through
**untouched**; legacy UK-national numbers already stored keep working via the
ClickSend account default.

**Frontend status — implemented:**
- Member invitation signup (`POST /api/v1/invitations/signup`): the selected
  country prefix is now prepended on every submit path (direct debit, stripe,
  skip, and the legacy T&C submit), spaces stripped, leading zero(s) of the
  national part dropped. The prefix dropdown is now required at validation.
- Club signup (`POST /api/v1/clubs/`): already prepended the prefix; now also
  strips spaces / national leading zero, so it is fully contract-compliant.
- Register form (`POST /api/v1/users`): collects **no phone** — nothing to do.
- BS import: unchanged by design — the sync copies whatever BookedScheduler
  holds verbatim; imported stubs self-heal when the member converts via the
  invitation flow (`create_user` overwrites `users.phone_number`).
- Maintenance-org signup: free-text phone (placeholder `+44…`), no SMS
  verification, not in the agreed scope — left as-is.

**Optional backend follow-ups (not blocking):**
1. A light server-side guard on the signup paths: accept `+…`; convert
   `00…` → `+…`; strip spaces; leave anything else untouched (legacy
   tolerance).
2. One-off UK backfill of the ~24 legacy national-format rows once production
   counts are confirmed.

## Task 9 — Confirm no emails link to `/user_signup/*`

The frontend has **unlinked** the `/user_signup` wizard (it was a
non-functional demo; its routes now redirect to `/login`). Account-email
verification links should use `/registration_verification/:userId/:token`.

**Check every outbound email template** (verification, welcome, invitation)
for links to `/user_signup/...` — in particular `/user_signup/verify/...`. If
any exist, repoint them at `/registration_verification/:userId/:token`.

## Explicitly out of scope

- **`/user_signup` (member self-signup wizard):** this frontend flow was a
  non-functional demo (hard-coded club list, submit did nothing) and has now
  been unlinked from the router. Do **not** build endpoints for it. Real
  member onboarding is the invitations flow, or `/register` followed by the
  in-app "Join Club" membership request.

## Suggested order

1. Tasks 1–3 (idempotency — highest user-facing pain, small diffs)
2. Task 9 (five-minute email-template check)
3. Task 4 (cookie-less payment completion)
4. Task 8 (phone-prefix investigation — report findings before coding)
5. Task 6 (resends + rate limits)
6. Task 7, then Task 5 (drafts) last.
