# Backend API Guide — Invitation Signup Payment Methods

## Overview

The invitation signup flow now supports **three payment methods** instead of just Direct Debit:

1. **Direct Debit** (GoCardless) — existing flow, always available
2. **Stripe Card** — new, only if the club has `club_stripe_id` set
3. **Skip** — new, only for £0 memberships (instructor/admin/free tiers)

This guide describes the backend changes required.

---

## 1. `GET /api/v1/invitations/:token` — GetInvite

### What's needed

The response **must include** `club.club_stripe_id` (or equivalent boolean) so the frontend knows whether to show the Stripe card option.

**Check:** Does the current response already include `club_stripe_id` in the club object? If not, add it.

### Expected response shape (relevant fields only)

```json
{
  "club": {
    "id": 123,
    "name": "Example Flying Club",
    "club_stripe_id": "acct_1234..."   // ← REQUIRED — null/empty if no Stripe
  },
  "membership": {
    "id": 456,
    "name": "Student Pilot",
    "price": 50.00                      // ← REQUIRED — used to determine if Skip option appears
  }
}
```

**No structural changes needed** if `club_stripe_id` and `membership.price` are already returned. Just verify they are.

---

## 2. `POST /api/v1/invitations/signup` — InviteSignup

### Current behaviour

Creates the user account and returns a GoCardless redirect link for Direct Debit setup.

### New requirement

Accept a new field: **`payment_method`** — one of `'direct_debit'`, `'stripe'`, or `'skip'`.

The frontend sends all the same form data as before, plus:

```json
{
  "...all existing fields...",
  "payment_method": "stripe"    // or "direct_debit" or "skip"
}
```

### Behaviour per payment method

#### `payment_method = 'direct_debit'` (or field absent/null)

**No change.** Existing behaviour:
- Create the user account
- Set up GoCardless redirect
- Return `{ success: true, uid: <id>, session: <session>, link: <gocardless_redirect_url> }`

#### `payment_method = 'stripe'`

- Create the user account (same as DD flow — user details, NOK, license, etc.)
- **Do NOT** set up GoCardless mandate
- **Do** link the Stripe customer to the new user (see Section 3 below)
- Return: `{ success: true, uid: <id>, session: <session> }`
- The frontend handles Stripe SetupIntent confirmation client-side after receiving this response

#### `payment_method = 'skip'`

- Create the user account (same as DD flow)
- **Do NOT** set up GoCardless mandate
- **Do NOT** set up any payment method
- Return: `{ success: true, uid: <id>, session: <session> }`
- Optionally: flag the membership record as `payment_pending: true` or equivalent so admin can see it

### Summary table

| payment_method   | Create user | GoCardless mandate | Stripe link | Response includes `link` |
|-----------------|-------------|-------------------|-------------|-------------------------|
| `direct_debit`  | ✅          | ✅                | ❌          | ✅ (GoCardless URL)     |
| `stripe`        | ✅          | ❌                | ✅ (see §3) | ❌                     |
| `skip`          | ✅          | ❌                | ❌          | ❌                     |

---

## 3. `POST /api/v1/cards/create_new_customer` — CreateNewCustomer

### Current behaviour

Accepts `{ club_id, user_id }`, creates a Stripe Customer + SetupIntent, returns `{ secret: <client_secret> }`.

### The timing problem

In the invitation flow, the frontend calls `CreateNewCustomer` **before** the user account exists (the Stripe form is shown while the user is still filling in Step 5). At this point:

```javascript
var send = {
    club_id: $scope.formData.club_id,
    user_id: uid || 0    // uid is likely 0 or undefined
};
PaymentService.CreateNewCustomer(send);
```

### Required changes — choose one approach

#### Option A: Accept `user_id = 0` (Recommended)

- When `user_id` is `0` or absent, create a **standalone Stripe Customer** (no user linked yet) with a SetupIntent
- Store the Stripe Customer ID temporarily (e.g., keyed by SetupIntent ID or client_secret)
- Return `{ secret: <client_secret> }` as normal
- Later, when `InviteSignup` is called with `payment_method = 'stripe'`:
  - After creating the user, look up the Stripe Customer by the SetupIntent that will arrive via webhook
  - Link the Stripe Customer to the new user record
  - Alternatively: the frontend could pass the `setup_intent_client_secret` back in the `InviteSignup` payload so the backend can correlate

**If using this approach**, add an optional field to `InviteSignup`:

```json
{
  "payment_method": "stripe",
  "stripe_setup_secret": "seti_1ABC...secret_xyz"   // so backend can find the Stripe customer
}
```

#### Option B: Two-step — create user first, then init Stripe

- Change `InviteSignup` to always create the user first (for all payment methods) and return `{ uid, session }`
- Frontend then calls `CreateNewCustomer({ club_id, user_id: <new_uid> })` with the real user_id
- Then mounts Stripe Elements and confirms
- **Downside:** requires frontend refactor — the Stripe form can't be pre-rendered while user fills in details

#### Option C: Use Stripe webhooks (backend handles it all)

- When `user_id = 0`, create the Stripe Customer with metadata: `{ invitation_token: <token> }`
- When the SetupIntent succeeds, Stripe fires `setup_intent.succeeded` webhook
- Webhook handler: look up the invitation token from the Customer metadata → find the user → attach the payment method
- **Downside:** slightly more complex, relies on webhook timing

### Recommendation

**Option A** is simplest for both frontend and backend. The flow would be:

1. Frontend calls `CreateNewCustomer({ club_id, user_id: 0 })` → gets `{ secret }`
2. User fills out Stripe form
3. User clicks "Set Up Card" → frontend calls `InviteSignup({ ..., payment_method: 'stripe', stripe_setup_secret: <secret> })`
4. Backend creates user, finds the Stripe Customer by the secret, links it to the new user
5. Frontend calls `stripe.confirmSetup()` → user gets redirected
6. On redirect return, Stripe has attached the payment method to the Customer (which is now linked to the user)

---

## 4. Stripe Redirect Return Handling

After `stripe.confirmSetup()`, Stripe redirects the user to:

```
/invitations/:token/direct_debit?stripe_success=1&setup_intent=seti_xxx&setup_intent_client_secret=seti_xxx_secret_xxx&redirect_status=succeeded
```

### What the frontend does

- Detects `stripe_success` or `setup_intent` in the URL query params
- Shows the "Card Added Successfully" confirmation screen
- **Does NOT call any additional backend endpoint**

### What the backend needs to handle

When Stripe's `setup_intent.succeeded` webhook fires:
- The SetupIntent's payment method is automatically attached to the Stripe Customer
- If you used **Option A** above, the Customer is already linked to the user (done during `InviteSignup`)
- **Verify the existing webhook handler covers this case** — it likely already works if the membership page's card flow uses the same pattern

### If you don't want to rely on webhooks

Add a new endpoint (or extend an existing one) that the frontend can call on return:

```
POST /api/v1/cards/confirm_setup
{
    "setup_intent_id": "seti_xxx",
    "user_id": 123,
    "club_id": 456
}
```

This endpoint would:
1. Retrieve the SetupIntent from Stripe API
2. Verify status is `succeeded`
3. Attach the payment method to the user's Stripe Customer
4. Set it as the default payment method
5. Return `{ success: true }`

**Note:** The existing membership card page (`manageMyMembershipsController`) seems to handle this via page reload + `GetMemberCards` — check if webhooks process the card attachment automatically.

---

## 5. No changes needed

These endpoints need **no modification**:

| Endpoint | Why |
|----------|-----|
| `POST /api/v1/go_card/create_mandate` | Still used for Direct Debit — unchanged |
| `POST /api/v1/users/verify_invited_user` | SMS verification — unchanged |
| `POST /api/v1/users/verify_phone_invite` | Phone code verification — unchanged |
| `GET /api/v1/cards/member_cards` | Can be used later if needed — unchanged |

---

## 6. Quick checklist

- [ ] **GetInvite** returns `club.club_stripe_id` and `membership.price`
- [ ] **InviteSignup** accepts `payment_method` field (`'direct_debit'` / `'stripe'` / `'skip'`)
- [ ] **InviteSignup** skips GoCardless when `payment_method` is `'stripe'` or `'skip'`
- [ ] **InviteSignup** returns `{ success, uid, session }` (without `link`) for stripe/skip
- [ ] **CreateNewCustomer** handles `user_id = 0` (creates unlinked Stripe Customer)
- [ ] **InviteSignup** accepts `stripe_setup_secret` and links Stripe Customer to new user
- [ ] **Stripe webhook** or confirm endpoint attaches payment method after SetupIntent succeeds
- [ ] (Optional) Flag skipped-payment memberships for admin visibility

---

## 7. Frontend fields sent to `InviteSignup`

For reference, here is the complete payload the frontend sends:

```javascript
var to_send = {
    // Existing fields (unchanged)
    club_id: ...,
    first_name: ...,
    last_name: ...,
    email: ...,
    phone: ...,
    address: { ... },
    license: { ... },
    nok: { first_name, last_name, phone },
    membership_tnc: true,
    tnc: true,
    request_id: ...,
    invitation: "<token>",
    payment_now: ...,
    first_payment: ...,

    // NEW fields
    payment_method: "direct_debit" | "stripe" | "skip",
    stripe_setup_secret: "seti_xxx_secret_xxx"  // Only when payment_method = 'stripe'
};
```

---

## 8. Error scenarios to handle

| Scenario | Backend response | Frontend behaviour |
|----------|-----------------|-------------------|
| `payment_method = 'stripe'` but club has no Stripe | `{ success: false, error: 'Club does not accept card payments' }` | Show toast error |
| `payment_method = 'skip'` but membership price > 0 | `{ success: false, error: 'Payment required for this membership' }` | Show toast error |
| `stripe_setup_secret` invalid/expired | `{ success: false, error: 'Card session expired. Please refresh.' }` | Show toast error |
| Stripe Customer creation fails (user_id=0) | `{ success: false, error: 'Unable to initialise card form' }` | Show toast error |

---

## Questions for backend team

1. Does `GET /api/v1/invitations/:token` already return `club.club_stripe_id`? If not, is it in the clubs table?
2. Does the existing Stripe webhook handler (`setup_intent.succeeded`) already attach payment methods to customers, or does the membership page rely on polling/page reload?
3. Should skipped-payment memberships be flagged differently in the database (e.g., `payment_status = 'pending'`)?
4. Is there a preference for Option A vs Option C for handling the user_id=0 Stripe Customer creation?
