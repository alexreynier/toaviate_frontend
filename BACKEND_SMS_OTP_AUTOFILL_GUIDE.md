# BACKEND_SMS_OTP_AUTOFILL_GUIDE.md
### Making verification codes auto-prefill from the user's messages app

**Audience:** the backend agent. Self-contained — no frontend reading needed.

**Goal:** when a signup verification SMS arrives, the phone should offer the
code automatically — iOS shows a **"From Messages: 123456"** suggestion above
the keyboard; Android Chrome shows an automatic **"Allow / use code"** bottom
sheet. Whether that happens is decided almost entirely by the **wording of
the SMS**. The frontend is already fully wired (see "What the frontend
already does" below) — the only backend work is changing the message text.

---

## The message template to send

For every verification-code SMS (club-signup phone verification, invited-member
phone verification, and any future ones):

```
Your ToAviate verification code is 123456. It expires in 10 minutes.

@<app-host> #123456
```

`<app-host>` = the exact hostname the user's browser shows while on the signup
page — **the web-app host, NOT the API host** (`api.toaviate.com` /
`v1.toaviate.com` are wrong unless the app itself is served from them). Use
the correct host per environment, e.g. staging SMS carries the staging host.
If club signup and invitations are ever served from different hosts, each
flow's SMS must carry its own host.

### Rules (why each part matters)

1. **Last line, exactly `@host #code`** — no scheme (`https://`), no path, no
   trailing text, separated from the human sentence by a blank line.
   - This is the cross-platform **origin-bound code** standard. Android
     Chrome's WebOTP API only fires on it, and iOS ≥14 uses it to offer the
     code **only on the matching domain** (anti-phishing — a code phished
     onto another site won't be suggested).
2. **The `#` code must be identical** to the code in the sentence.
3. **The code should be the only number in the message.** iOS's fallback is a
   heuristic: a 4–8 digit number near words like "code". Phone numbers,
   dates, or "24-48 hours" in the same SMS can confuse it. (That's why the
   expiry says "10 minutes", not a timestamp.)
4. **Keep the word "code" adjacent to the digits** ("verification code is
   123456") — this powers the iOS heuristic and Gboard suggestions on older
   Androids.
5. **Plain digits** — never format the code as `123-456` or `123 456`.
6. **One SMS segment if possible** (≤160 GSM-7 chars). The template above
   fits comfortably.
7. Sender ID (ClickSend alphanumeric vs number) does **not** affect autofill —
   keep whatever you use, just keep it consistent.

### Which messages to update

| SMS | Sent around | Verified by |
|---|---|---|
| Club-signup phone code | after club/admin creation | `POST /api/v1/users/verify_phone` |
| Invited-member phone code | `POST /api/v1/users/verify_invited_user` | `POST /api/v1/users/verify_phone_invite` |

**Passenger invitation codes currently go by email**, not SMS — see the email
section below. (If they're ever also sent by SMS, use the same template; the
frontend already listens for it.)

## Email codes (passenger flows)

Autofill from email is weaker (iOS 17+ Mail suggestions only), but format
still helps:

- Put the code in the **subject**: `123456 is your ToAviate code` — visible in
  the notification, so the user doesn't even need to open the email.
- In the body, same sentence shape: "Your ToAviate verification code is
  **123456**." Code as selectable text (never inside an image), only number
  in the email if practical.

## What the frontend already does (no action needed)

- The first code box on every code screen has
  `autocomplete="one-time-code"` + `inputmode="numeric"`, and a tapped iOS
  suggestion (or any autofill/paste) is automatically distributed across the
  six boxes and auto-submitted.
- The four code screens (club signup, member invitation, passenger, returning
  passenger) call the **WebOTP API** (`navigator.credentials.get({otp:…})`)
  on load — once the SMS carries the `@host #code` line, Android Chrome
  auto-prompts with the code and the form fills and submits itself. Requires
  HTTPS (already the case).

## Acceptance test

1. iPhone (iOS 15+), Safari: open the invitation phone-verification step,
   receive the SMS → the code appears as a keyboard suggestion; tapping it
   fills all six boxes and submits. It must NOT be suggested when the same
   SMS arrives while on an unrelated website (domain binding working).
2. Android (Chrome 93+): same step → a bottom-sheet appears offering the
   code without opening the messages app; accepting fills and submits.
3. Codes with the old wording keep working via manual typing — this change
   is purely additive.
